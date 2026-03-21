import { requireAdmin } from '../../../lib/auth.js';
import { createHttpError, methodNotAllowed, readJsonBody, sendJson } from '../../../lib/http.js';
import { createServiceClient } from '../../../lib/supabase.js';
import { getAppReleaseConfig } from '../../../lib/app-releases.js';

async function ensurePublicBucket(supabase, bucketName) {
  const { data, error } = await supabase.storage.getBucket(bucketName);

  if (error) {
    const { error: createError } = await supabase.storage.createBucket(bucketName, { public: true });
    if (createError) {
      throw createHttpError(
        500,
        `Gagal membuat bucket Supabase Storage "${bucketName}". Buat manual di Storage dan set menjadi public.`,
        { cause: createError }
      );
    }
    return;
  }

  if (data && data.public !== true) {
    const { error: updateError } = await supabase.storage.updateBucket(bucketName, { public: true });
    if (updateError) {
      throw createHttpError(
        500,
        `Bucket "${bucketName}" ada tetapi gagal diubah menjadi public. Silakan ubah manual di Supabase Storage.`,
        { cause: updateError }
      );
    }
  }
}

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

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return methodNotAllowed(res, ['POST']);
  }

  try {
    await requireAdmin(req);
    const body = await readJsonBody(req);

    const platform = String(body.platform || '').trim();
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
    const supabase = createServiceClient();
    await ensurePublicBucket(supabase, bucketName);

    const destinationPath = item.mode === 'fixed'
      ? item.fixedPath
      : joinPath(item.dir, incomingName);

    const { data, error } = await supabase.storage
      .from(bucketName)
      .createSignedUploadUrl(destinationPath, { upsert: true });

    if (error) {
      throw createHttpError(500, 'Gagal membuat signed upload URL.', { cause: error });
    }

    const { data: publicData } = supabase.storage.from(bucketName).getPublicUrl(destinationPath);

    return sendJson(res, 200, {
      success: true,
      platform: item.id,
      label: item.label,
      bucket: bucketName,
      path: destinationPath,
      token: data.token,
      signedUrl: data.signedUrl,
      publicUrl: publicData?.publicUrl || '',
      defaultContentType: item.defaultContentType
    });
  } catch (error) {
    return sendJson(res, error.statusCode || 500, {
      success: false,
      message: error.message || 'Upload URL gagal dibuat.'
    });
  }
}
