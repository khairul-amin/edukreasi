import { getLicenseConfig } from '../_lib/config.js';
import { requireAdmin } from '../_lib/auth.js';
import { createServiceClient } from '../_lib/supabase.js';
import { methodNotAllowed, readJsonBody, sendJson } from '../_lib/http.js';
import { buildCheckoutUrl, ensureActivation, ensureLicense, issueToken } from '../_lib/license-store.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return methodNotAllowed(res, ['POST']);
  }

  try {
    const admin = await requireAdmin(req);
    const body = await readJsonBody(req);
    const npsn = String(body.npsn || '').trim();
    const schoolName = String(body.school_name || '').trim();
    const deviceId = String(body.device_id || '').trim();
    const plan = String(body.plan || 'full').trim();
    const activationLimit = Number(body.activation_limit || 1);
    const note = String(body.note || '').trim();

    const supabase = createServiceClient();
    const license = await ensureLicense(supabase, {
      npsn,
      schoolName,
      plan,
      activationLimit,
      note,
      createdBy: admin?.profile?.id || null
    });
    const activation = await ensureActivation(supabase, license, deviceId, schoolName);
    const token = issueToken(req, license, activation);
    const { publicBaseUrl } = getLicenseConfig(req);

    return sendJson(res, 200, {
      success: true,
      license_id: license.id,
      activation_id: activation.id,
      token,
      checkout_url: buildCheckoutUrl(publicBaseUrl, npsn, deviceId)
    });
  } catch (error) {
    return sendJson(res, error.statusCode || 500, {
      success: false,
      message: error.message || 'Gagal menerbitkan lisensi.'
    });
  }
}
