import { methodNotAllowed, sendJson } from '../lib/http.js';
import { nowIso } from '../lib/license-store.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return methodNotAllowed(res, ['GET']);
  }

  return sendJson(res, 200, {
    success: true,
    service: 'exam-edukreasi-license-online',
    time: nowIso()
  });
}
