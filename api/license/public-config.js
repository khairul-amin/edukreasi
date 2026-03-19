import { getLicenseConfig, getMidtransConfig } from '../../lib/config.js';
import { formatCurrency, methodNotAllowed, sendJson } from '../../lib/http.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return methodNotAllowed(res, ['GET']);
  }

  const config = getLicenseConfig(req);
  const midtrans = getMidtransConfig();
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
    paymentEnabled: Boolean(midtrans.serverKey)
  });
}
