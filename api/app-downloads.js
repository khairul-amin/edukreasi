import { HeadObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { getAppReleaseConfig } from '../lib/app-releases.js';
import { methodNotAllowed, sendJson } from '../lib/http.js';
import { createR2Client } from '../lib/r2.js';

function joinPublicUrl(baseUrl, path) {
  const base = String(baseUrl || '').trim().replace(/\/+$/g, '');
  const right = String(path || '').trim().replace(/^\/+/g, '');
  if (!base || !right) return '';
  return `${base}/${right}`;
}

function ensureTrailingSlash(value) {
  const clean = String(value || '').trim().replace(/^\/+/g, '').replace(/\/+$/g, '');
  return clean ? `${clean}/` : '';
}

function fileNameOfKey(key) {
  const raw = String(key || '').replace(/\\/g, '/');
  const parts = raw.split('/').filter(Boolean);
  return parts.length ? parts[parts.length - 1] : '';
}

function toIsoOrNull(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  const time = date.getTime();
  return Number.isFinite(time) ? date.toISOString() : null;
}

function getAcceptedExts(item) {
  const values = Array.isArray(item?.acceptedExts) && item.acceptedExts.length
    ? item.acceptedExts
    : [item?.expectedExt];

  return values
    .map((entry) => String(entry || '').trim().toLowerCase())
    .filter(Boolean);
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return methodNotAllowed(res, ['GET']);
  }

  try {
    const config = getAppReleaseConfig();
    const bucket = config.bucket;
    const publicBaseUrl = config.publicBaseUrl;
    const r2 = createR2Client();

    const downloads = {};

    await Promise.all(Object.entries(config.items).map(async ([key, item]) => {
      if (item.mode === 'fixed') {
        const fixedPath = item.fixedPath;
        const dir = item.dir || '';
        const fileName = fileNameOfKey(fixedPath);
        let available = false;
        let updatedAt = null;

        try {
          const head = await r2.send(new HeadObjectCommand({ Bucket: bucket, Key: fixedPath }));
          available = true;
          updatedAt = toIsoOrNull(head?.LastModified);
        } catch (error) {
          const status = error?.$metadata?.httpStatusCode || error?.statusCode;
          if (status && Number(status) !== 404) {
            throw error;
          }
        }

        downloads[key] = {
          id: item.id,
          label: item.label,
          bucket,
          mode: item.mode,
          dir,
          fileName,
          path: fixedPath,
          url: available ? joinPublicUrl(publicBaseUrl, fixedPath) : '',
          available,
          updatedAt
        };

        return;
      }

      const dir = item.dir || '';
      const prefix = ensureTrailingSlash(dir);

      let objects = [];
      try {
        const result = await r2.send(new ListObjectsV2Command({
          Bucket: bucket,
          Prefix: prefix,
          MaxKeys: 1000
        }));
        objects = result?.Contents || [];
      } catch {
        downloads[key] = {
          id: item.id,
          label: item.label,
          bucket,
          mode: item.mode,
          dir,
          fileName: '',
          path: '',
          url: '',
          available: false,
          updatedAt: null
        };
        return;
      }

      const matches = objects
        .filter((entry) => entry?.Key)
        .filter((entry) => {
          const key = String(entry.Key || '').toLowerCase();
          return getAcceptedExts(item).some((ext) => key.endsWith(ext));
        })
        .sort((a, b) => {
          const left = new Date(a?.LastModified || 0).getTime();
          const right = new Date(b?.LastModified || 0).getTime();
          return right - left;
        });

      const latest = matches[0] || null;
      if (!latest) {
        downloads[key] = {
          id: item.id,
          label: item.label,
          bucket,
          mode: item.mode,
          dir,
          fileName: '',
          path: '',
          url: '',
          available: false,
          updatedAt: null
        };
        return;
      }

      const fullPath = String(latest.Key || '');
      const fileName = fileNameOfKey(fullPath);

      downloads[key] = {
        id: item.id,
        label: item.label,
        bucket,
        mode: item.mode,
        dir,
        fileName,
        path: fullPath,
        url: joinPublicUrl(publicBaseUrl, fullPath),
        available: true,
        updatedAt: toIsoOrNull(latest.LastModified)
      };
    }));

    return sendJson(res, 200, {
      success: true,
      bucket,
      publicBaseUrl,
      downloads
    });
  } catch (error) {
    return sendJson(res, error.statusCode || 500, {
      success: false,
      message: error.message || 'Gagal memuat link download aplikasi.'
    });
  }
}
