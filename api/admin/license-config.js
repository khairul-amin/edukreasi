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
          priceSource: config.priceSource,
          priceUpdatedAt: config.priceUpdatedAt,
          priceUpdatedBy: config.priceUpdatedBy
        }
      });
    }

    const body = await readJsonBody(req);
    await updateLicenseSettings({
      price: body.price,
      updatedBy: admin?.profile?.id || null
    });

    const config = await getResolvedLicenseConfig(req);
    return sendJson(res, 200, {
      success: true,
      message: 'Harga checkout berhasil diperbarui dari dashboard admin.',
      config: {
        price: config.price,
        currency: config.currency,
        priceLabel: formatCurrency(config.price, config.currency),
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
