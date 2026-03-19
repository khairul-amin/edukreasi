import { createServiceClient } from '../../lib/supabase.js';
import { createHttpError, methodNotAllowed, readJsonBody, sendJson } from '../../lib/http.js';
import { deactivateActivationByDevice, deactivateActivationById } from '../../lib/license-store.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return methodNotAllowed(res, ['POST']);
  }

  try {
    const body = await readJsonBody(req);
    const activationId = String(body.activation_id || '').trim();
    const licenseId = String(body.license_id || '').trim();
    const deviceId = String(body.device_id || '').trim();

    if (!activationId && !(licenseId && deviceId)) {
      throw createHttpError(400, 'activation_id atau license_id + device_id wajib diisi.');
    }

    const supabase = createServiceClient();
    if (activationId) {
      await deactivateActivationById(supabase, activationId);
    } else {
      await deactivateActivationByDevice(supabase, licenseId, deviceId);
    }

    return sendJson(res, 200, { success: true, message: 'Aktivasi berhasil dinonaktifkan.' });
  } catch (error) {
    return sendJson(res, error.statusCode || 500, {
      success: false,
      message: error.message || 'Gagal menonaktifkan aktivasi.'
    });
  }
}
