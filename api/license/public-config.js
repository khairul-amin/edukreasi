import { getMidtransConfig } from '../../lib/config.js';
import { formatCurrency, methodNotAllowed, sendJson } from '../../lib/http.js';
import { getResolvedLicenseConfig } from '../../lib/license-settings.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return methodNotAllowed(res, ['GET']);
  }

  try {
    const config = await getResolvedLicenseConfig(req);
    const midtrans = getMidtransConfig();
    const paymentEnabled = Boolean(midtrans.serverKey && midtrans.clientKey);
    const snapScriptUrl = midtrans.isProduction
      ? 'https://app.midtrans.com/snap/snap.js'
      : 'https://app.sandbox.midtrans.com/snap/snap.js';

    return sendJson(res, 200, {
      success: true,
      plan: config.plan,
      price: config.price,
      currency: config.currency,
      priceLabel: formatCurrency(config.price, config.currency),
      activationLimit: config.activationLimit,
      publicBaseUrl: config.publicBaseUrl,
      checkoutPageUrl: `${config.publicBaseUrl}/checkout`,
      publicKeyUrl: `${config.publicBaseUrl}/api/license/public-key`,
      paymentMode: midtrans.isProduction ? 'production' : 'sandbox',
      paymentEnabled,
      paymentClientKey: paymentEnabled ? midtrans.clientKey : '',
      paymentScriptUrl: paymentEnabled ? snapScriptUrl : '',
      priceSource: config.priceSource,
      priceUpdatedAt: config.priceUpdatedAt
    });
  } catch (error) {
    return sendJson(res, error.statusCode || 500, {
      success: false,
      message: error.message || 'Gagal memuat konfigurasi lisensi.'
    });
  }
}
