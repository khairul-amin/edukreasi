import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { requireAdmin } from '../../../lib/auth.js';
import { getAppReleaseConfig } from '../../../lib/app-releases.js';
import { createHttpError, methodNotAllowed, readJsonBody, sendJson } from '../../../lib/http.js';
import { createR2Client } from '../../../lib/r2.js';

function extname(value) {
  const name = String(value || '').trim();
  const idx = name.lastIndexOf('.');
  if (idx < 0) return '';
  return name.slice(idx).toLowerCase();
}

function basename(value) {
  const raw = String(value || '').trim().replace(/\\/g, '/');
  const parts = raw.split('/').filter(Boolean);
  return parts.length ? parts[parts.length - 1] : '';
}

function sanitizeFileName(value) {
  const name = basename(value).replace(/\0/g, '').trim();
  if (!name || name === '.' || name === '..') return '';
  return name.length > 180 ? name.slice(0, 180) : name;
}

function joinPath(dir, fileName) {
  const left = String(dir || '').trim().replace(/^\/+/g, '').replace(/\/+$/g, '');
  const right = String(fileName || '').trim().replace(/^\/+/g, '');
  if (!left) return right;
  if (!right) return left;
  return `${left}/${right}`;
}

function joinPublicUrl(baseUrl, path) {
  const base = String(baseUrl || '').trim().replace(/\/+$/g, '');
  const right = String(path || '').trim().replace(/^\/+/g, '');
  if (!base || !right) return '';
  return `${base}/${right}`;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return methodNotAllowed(res, ['POST']);
  }

  try {
    await requireAdmin(req);
    const body = await readJsonBody(req);

    const platform = String(body.platform || '').trim();
    const requestedContentType = String(body.contentType || '').trim();
    const config = getAppReleaseConfig();
    const item = config.items[platform];

    if (!item) {
      throw createHttpError(400, 'Platform aplikasi tidak valid.');
    }

    const incomingName = sanitizeFileName(body.fileName);
    if (item.mode === 'dir' && !incomingName) {
      throw createHttpError(400, 'Nama file belum tersedia. Silakan pilih file dan coba lagi.');
    }

    if (incomingName) {
      const incomingExt = extname(incomingName);
      if (!incomingExt || incomingExt !== item.expectedExt) {
        throw createHttpError(400, `File harus berformat ${item.expectedExt}.`);
      }
    }

    const bucketName = config.bucket;
    const destinationPath = item.mode === 'fixed'
      ? item.fixedPath
      : joinPath(item.dir, incomingName);

    const contentType = requestedContentType || item.defaultContentType || 'application/octet-stream';
    const r2 = createR2Client();
    const expiresIn = 60 * 15; // 15 minutes

    const signedUrl = await getSignedUrl(
      r2,
      new PutObjectCommand({
        Bucket: bucketName,
        Key: destinationPath,
        ContentType: contentType
      }),
      { expiresIn }
    );

    const publicUrl = joinPublicUrl(config.publicBaseUrl, destinationPath);

    return sendJson(res, 200, {
      success: true,
      platform: item.id,
      label: item.label,
      bucket: bucketName,
      path: destinationPath,
      key: destinationPath,
      method: 'PUT',
      headers: {
        'content-type': contentType
      },
      expiresIn,
      signedUrl,
      publicUrl,
      defaultContentType: item.defaultContentType
    });
  } catch (error) {
    return sendJson(res, error.statusCode || 500, {
      success: false,
      message: error.message || 'Upload URL gagal dibuat.'
    });
  }
}
