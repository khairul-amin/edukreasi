import { requireAdmin } from '../../../lib/auth.js';
import { createHttpError, methodNotAllowed, readJsonBody, sendJson } from '../../../lib/http.js';
import { getResolvedLicenseConfig, updateLicenseSettings } from '../../../lib/license-settings.js';

export default async function handler(req, res) {
  if (req.method !== 'PUT') {
    return methodNotAllowed(res, ['PUT']);
  }

  try {
    const admin = await requireAdmin(req);
    const body = await readJsonBody(req);
    const platform = String(body.platform || '').trim() || 'student_apk';

    if (platform !== 'student_apk') {
      throw createHttpError(400, 'Platform link alternatif belum didukung.');
    }

    await updateLicenseSettings({
      studentAlternativeDownloadUrl: body.url,
      updatedBy: admin?.profile?.id || null
    });

    const config = await getResolvedLicenseConfig(req);
    const url = String(config.studentAlternativeDownloadUrl || '').trim();

    return sendJson(res, 200, {
      success: true,
      platform,
      url,
      message: url
        ? 'Link unduhan alternatif siswa berhasil disimpan.'
        : 'Link unduhan alternatif siswa berhasil dihapus.'
    });
  } catch (error) {
    return sendJson(res, error.statusCode || 500, {
      success: false,
      message: error.message || 'Gagal menyimpan link unduhan alternatif siswa.'
    });
  }
}
