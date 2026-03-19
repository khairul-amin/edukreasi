import { getLicenseConfig, getMidtransConfig } from '../_lib/config.js';
import { requireAdmin } from '../_lib/auth.js';
import { formatCurrency, methodNotAllowed, sendJson } from '../_lib/http.js';
import { getDashboardSnapshot } from '../_lib/license-store.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return methodNotAllowed(res, ['GET']);
  }

  try {
    const admin = await requireAdmin(req);
    const limit = Math.max(5, Math.min(50, Number(req.query.limit || 12)));
    const snapshot = await getDashboardSnapshot(req, limit);
    const config = getLicenseConfig(req);
    const midtrans = getMidtransConfig();

    return sendJson(res, 200, {
      success: true,
      admin: admin.profile,
      config: {
        plan: config.plan,
        price: config.price,
        currency: config.currency,
        priceLabel: formatCurrency(config.price, config.currency),
        activationLimit: config.activationLimit,
        publicBaseUrl: config.publicBaseUrl,
        checkoutPageUrl: `${config.publicBaseUrl}/checkout`,
        publicKeyUrl: `${config.publicBaseUrl}/api/license/public-key`,
        webhookUrl: `${config.publicBaseUrl}/api/midtrans/webhook`,
        adminSecretConfigured: Boolean(config.adminSecret),
        privateKeyReady: Boolean(config.privateKey),
        publicKeyReady: Boolean(config.publicKey),
        authMode: admin.mode,
        midtransEnabled: Boolean(midtrans.serverKey),
        paymentMode: midtrans.isProduction ? 'production' : 'sandbox',
        midtransMerchantId: midtrans.merchantId || ''
      },
      ...snapshot
    });
  } catch (error) {
    return sendJson(res, error.statusCode || 500, {
      success: false,
      message: error.message || 'Gagal memuat dashboard lisensi.'
    });
  }
}
