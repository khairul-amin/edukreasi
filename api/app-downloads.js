import { getAppReleaseConfig } from '../lib/app-releases.js';
import { requireEnv } from '../lib/config.js';
import { methodNotAllowed, sendJson } from '../lib/http.js';

function encodePath(path) {
  return String(path || '')
    .split('/')
    .filter(Boolean)
    .map((part) => encodeURIComponent(part))
    .join('/');
}

function buildPublicObjectUrl(supabaseUrl, bucket, path) {
  const baseUrl = String(supabaseUrl || '').trim().replace(/\/+$/g, '');
  const cleanBucket = String(bucket || '').trim().replace(/^\/+/g, '').replace(/\/+$/g, '');
  const cleanPath = String(path || '').trim().replace(/^\/+/g, '');

  return `${baseUrl}/storage/v1/object/public/${encodeURIComponent(cleanBucket)}/${encodePath(cleanPath)}`;
}

async function isPublicObjectAvailable(url) {
  try {
    const response = await fetch(url, { method: 'HEAD' });
    if (response.status === 405) {
      const probe = await fetch(url, {
        method: 'GET',
        headers: { Range: 'bytes=0-0' }
      });
      return probe.ok || probe.status === 206;
    }
    return response.ok;
  } catch {
    return false;
  }
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return methodNotAllowed(res, ['GET']);
  }

  try {
    const supabaseUrl = requireEnv('SUPABASE_URL');
    const config = getAppReleaseConfig();
    const bucket = config.bucket;

    const downloads = Object.fromEntries(
      Object.entries(config.items).map(([key, item]) => {
        const url = buildPublicObjectUrl(supabaseUrl, bucket, item.path);
        return [
          key,
          {
            id: item.id,
            label: item.label,
            bucket,
            path: item.path,
            url
          }
        ];
      })
    );

    await Promise.all(
      Object.values(downloads).map(async (item) => {
        const ok = await isPublicObjectAvailable(item.url);
        item.available = ok;
        if (!ok) {
          item.url = '';
        }
      })
    );

    return sendJson(res, 200, {
      success: true,
      bucket,
      downloads
    });
  } catch (error) {
    return sendJson(res, error.statusCode || 500, {
      success: false,
      message: error.message || 'Gagal memuat link download aplikasi.'
    });
  }
}
