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

    const incomingName = String(body.fileName || '').trim();
    if (incomingName) {
      const incomingExt = extname(incomingName);
      if (incomingExt && incomingExt !== item.expectedExt) {
        throw createHttpError(400, `File harus berformat ${item.expectedExt}.`);
      }
    }

    const bucketName = config.bucket;
    const supabase = createServiceClient();
    await ensurePublicBucket(supabase, bucketName);

    const { data, error } = await supabase.storage
      .from(bucketName)
      .createSignedUploadUrl(item.path, { upsert: true });

    if (error) {
      throw createHttpError(500, 'Gagal membuat signed upload URL.', { cause: error });
    }

    const { data: publicData } = supabase.storage.from(bucketName).getPublicUrl(item.path);

    return sendJson(res, 200, {
      success: true,
      platform: item.id,
      label: item.label,
      bucket: bucketName,
      path: item.path,
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

