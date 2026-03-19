import { createServiceClient } from '../../lib/supabase.js';
import { createHttpError, methodNotAllowed, sendJson } from '../../lib/http.js';
import { ensureActivation, ensureLicense, getOrder, issueToken, updateOrder } from '../../lib/license-store.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return methodNotAllowed(res, ['GET']);
  }

  try {
    const orderId = String(req.query.order_id || '').trim();
    if (!orderId) {
      throw createHttpError(400, 'order_id wajib diisi.');
    }

    const supabase = createServiceClient();
    const order = await getOrder(supabase, orderId);
    if (!order) {
      throw createHttpError(404, 'Order tidak ditemukan.');
    }

    const normalizedStatus = String(order.status || '').toLowerCase();
    if (!['paid', 'settlement', 'capture'].includes(normalizedStatus)) {
      return sendJson(res, 400, {
        success: false,
        status: normalizedStatus || 'pending',
        message: 'Pembayaran belum selesai atau belum tervalidasi.'
      });
    }

    const license = await ensureLicense(supabase, {
      npsn: order.npsn,
      schoolName: order.school_name || '',
      note: 'Aktivasi dari checkout online'
    });
    const activation = await ensureActivation(supabase, license, order.device_id, order.school_name || '');
    await updateOrder(supabase, orderId, {
      license_id: license.id,
      status: 'paid',
      paid_at: order.paid_at || new Date().toISOString()
    });

    const token = issueToken(req, license, activation);

    return sendJson(res, 200, {
      success: true,
      order_id: orderId,
      token,
      license_id: license.id,
      activation_id: activation.id,
      npsn: license.npsn,
      plan: String(license.plan || 'full').toUpperCase()
    });
  } catch (error) {
    return sendJson(res, error.statusCode || 500, {
      success: false,
      message: error.message || 'Gagal mengklaim token lisensi.'
    });
  }
}
