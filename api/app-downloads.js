import { getAppReleaseConfig } from '../lib/app-releases.js';
import { methodNotAllowed, sendJson } from '../lib/http.js';
import { createServiceClient } from '../lib/supabase.js';

function joinPath(dir, fileName) {
  const left = String(dir || '').trim().replace(/^\/+/g, '').replace(/\/+$/g, '');
  const right = String(fileName || '').trim().replace(/^\/+/g, '');
  if (!left) return right;
  if (!right) return left;
  return `${left}/${right}`;
}

function timestampOf(entry) {
  const raw = entry?.updated_at || entry?.created_at || '';
  const value = Date.parse(String(raw));
  return Number.isFinite(value) ? value : 0;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return methodNotAllowed(res, ['GET']);
  }

  try {
    const supabase = createServiceClient();
    const config = getAppReleaseConfig();
    const bucket = config.bucket;

    const downloads = {};

    await Promise.all(Object.entries(config.items).map(async ([key, item]) => {
      if (item.mode === 'fixed') {
        const fixedPath = item.fixedPath;
        const dir = item.dir || '';
        const searchName = fixedPath.split('/').filter(Boolean).slice(-1)[0] || '';

        const { data, error } = await supabase.storage
          .from(bucket)
          .list(dir, { limit: 100, offset: 0, search: searchName });

        if (error) {
          downloads[key] = {
            id: item.id,
            label: item.label,
            bucket,
            mode: item.mode,
            dir,
            fileName: searchName,
            path: fixedPath,
            url: '',
            available: false,
            updatedAt: null
          };
          return;
        }

        const match = (data || [])
          .filter((entry) => entry?.id)
          .find((entry) => entry?.name === searchName);

        const fullPath = fixedPath;
        const { data: publicData } = supabase.storage.from(bucket).getPublicUrl(fullPath);

        downloads[key] = {
          id: item.id,
          label: item.label,
          bucket,
          mode: item.mode,
          dir,
          fileName: searchName,
          path: fullPath,
          url: match ? (publicData?.publicUrl || '') : '',
          available: Boolean(match),
          updatedAt: match?.updated_at || match?.created_at || null
        };

        return;
      }

      const dir = item.dir || '';
      const { data, error } = await supabase.storage
        .from(bucket)
        .list(dir, { limit: 100, offset: 0 });

      if (error) {
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

      const files = (data || [])
        .filter((entry) => entry?.id)
        .filter((entry) => String(entry?.name || '').toLowerCase().endsWith(item.expectedExt));

      files.sort((a, b) => timestampOf(b) - timestampOf(a));
      const latest = files[0] || null;

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

      const fileName = String(latest.name || '');
      const fullPath = joinPath(dir, fileName);
      const { data: publicData } = supabase.storage.from(bucket).getPublicUrl(fullPath);

      downloads[key] = {
        id: item.id,
        label: item.label,
        bucket,
        mode: item.mode,
        dir,
        fileName,
        path: fullPath,
        url: publicData?.publicUrl || '',
        available: true,
        updatedAt: latest.updated_at || latest.created_at || null
      };
    }));

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
