import { getLicenseConfig, getMidtransConfig } from '../../lib/config.js';
import { formatCurrency, methodNotAllowed, sendJson, sendText } from '../../lib/http.js';
import { getResolvedLicenseConfig } from '../../lib/license-settings.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return methodNotAllowed(res, ['GET']);
  }

  // `vercel.json` rewrites `/api/license/public-key` to this handler with `?publicKey=1`.
  // We keep the old URL working while staying under the Vercel Hobby function count limit.
  if (String(req.query?.publicKey || '') === '1') {
    const { publicKey } = getLicenseConfig(req);
    if (!publicKey) {
      return sendText(res, 404, '');
    }

    return sendText(res, 200, publicKey, 'text/plain; charset=utf-8');
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
