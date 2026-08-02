import { getLicenseConfig } from '../../lib/config.js';
import { requireAdmin } from '../../lib/auth.js';
import { createServiceClient } from '../../lib/supabase.js';
import { createHttpError, methodNotAllowed, readJsonBody, sendJson } from '../../lib/http.js';
import { buildCheckoutUrl, ensureActivation, ensureLicense, getLicenseById, issueToken } from '../../lib/license-store.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return methodNotAllowed(res, ['POST']);
  }

  try {
    const admin = await requireAdmin(req);
    const body = await readJsonBody(req);
    const licenseId = String(body.license_id || '').trim();
    const npsn = String(body.npsn || '').trim();
    const schoolName = String(body.school_name || '').trim();
    const deviceId = String(body.device_id || '').trim();
    const plan = String(body.plan || 'full').trim();
    const activationLimit = Number(body.activation_limit || 1);
    const note = String(body.note || '').trim();

    if (!licenseId && !npsn) {
      throw createHttpError(400, 'license_id atau npsn wajib diisi.');
    }

    const supabase = createServiceClient();
    let license = null;

    if (licenseId) {
      license = await getLicenseById(supabase, licenseId);
      if (!license) {
        throw createHttpError(404, 'License ID tidak ditemukan.');
      }
    } else {
      license = await ensureLicense(supabase, {
        npsn,
        schoolName,
        plan,
        activationLimit,
        note,
        createdBy: admin?.profile?.id || null
      });
    }

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
