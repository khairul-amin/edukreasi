import { getLicenseConfig } from '../_lib/config.js';
import { methodNotAllowed, sendText } from '../_lib/http.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return methodNotAllowed(res, ['GET']);
  }

  const { publicKey } = getLicenseConfig(req);
  if (!publicKey) {
    return sendText(res, 404, '');
  }

  return sendText(res, 200, publicKey, 'text/plain; charset=utf-8');
}
