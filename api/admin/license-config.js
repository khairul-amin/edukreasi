import { requireAdmin } from '../../lib/auth.js';
import { formatCurrency, methodNotAllowed, readJsonBody, sendJson } from '../../lib/http.js';
import { getResolvedLicenseConfig, updateLicenseSettings } from '../../lib/license-settings.js';

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'PUT') {
    return methodNotAllowed(res, ['GET', 'PUT']);
  }

  try {
    const admin = await requireAdmin(req);

    if (req.method === 'GET') {
      const config = await getResolvedLicenseConfig(req);
      return sendJson(res, 200, {
        success: true,
        config: {
          price: config.price,
          currency: config.currency,
          priceLabel: formatCurrency(config.price, config.currency),
          studentAlternativeDownloadUrl: config.studentAlternativeDownloadUrl || '',
          priceSource: config.priceSource,
          priceUpdatedAt: config.priceUpdatedAt,
          priceUpdatedBy: config.priceUpdatedBy
        }
      });
    }

    const body = await readJsonBody(req);
    const hasPriceUpdate = body.price !== undefined;
    const hasStudentAlternativeDownloadUrlUpdate = body.studentAlternativeDownloadUrl !== undefined;

    if (!hasPriceUpdate && !hasStudentAlternativeDownloadUrlUpdate) {
      return sendJson(res, 400, {
        success: false,
        message: 'Tidak ada perubahan pengaturan yang dikirim.'
      });
    }

    await updateLicenseSettings({
      ...(hasPriceUpdate ? { price: body.price } : {}),
      ...(hasStudentAlternativeDownloadUrlUpdate
        ? { studentAlternativeDownloadUrl: body.studentAlternativeDownloadUrl }
        : {}),
      updatedBy: admin?.profile?.id || null
    });

    const config = await getResolvedLicenseConfig(req);
    const altUrl = String(config.studentAlternativeDownloadUrl || '').trim();
    let message = 'Pengaturan checkout berhasil diperbarui dari dashboard admin.';

    if (!hasPriceUpdate && hasStudentAlternativeDownloadUrlUpdate) {
      message = altUrl
        ? 'Link unduhan alternatif siswa berhasil disimpan.'
        : 'Link unduhan alternatif siswa berhasil dihapus.';
    } else if (hasPriceUpdate && !hasStudentAlternativeDownloadUrlUpdate) {
      message = 'Harga checkout berhasil diperbarui dari dashboard admin.';
    }

    return sendJson(res, 200, {
      success: true,
      message,
      config: {
        price: config.price,
        currency: config.currency,
        priceLabel: formatCurrency(config.price, config.currency),
        studentAlternativeDownloadUrl: config.studentAlternativeDownloadUrl || '',
        priceSource: config.priceSource,
        priceUpdatedAt: config.priceUpdatedAt,
        priceUpdatedBy: config.priceUpdatedBy
      }
    });
  } catch (error) {
    return sendJson(res, error.statusCode || 500, {
      success: false,
      message: error.message || 'Gagal memproses pengaturan checkout.'
    });
  }
}
