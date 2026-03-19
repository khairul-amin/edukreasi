import { requireAdmin } from '../../lib/auth.js';
import { createHttpError, methodNotAllowed, readJsonBody, sendJson } from '../../lib/http.js';
import { createServiceClient } from '../../lib/supabase.js';

export default async function handler(req, res) {
  if (req.method !== 'DELETE') {
    return methodNotAllowed(res, ['DELETE']);
  }

  try {
    await requireAdmin(req);
    const body = await readJsonBody(req);
    const orderIds = Array.isArray(body?.order_ids)
      ? [...new Set(body.order_ids.map((value) => String(value || '').trim()).filter(Boolean))]
      : [];

    if (!orderIds.length) {
      throw createHttpError(400, 'Pilih minimal satu order untuk dihapus.');
    }

    const supabase = createServiceClient();
    const { error } = await supabase.from('license_orders').delete().in('order_id', orderIds);

    if (error) {
      throw createHttpError(500, 'Gagal menghapus order lisensi.', { cause: error });
    }

    return sendJson(res, 200, {
      success: true,
      deleted_count: orderIds.length,
      message: `${orderIds.length} order berhasil dihapus.`
    });
  } catch (error) {
    return sendJson(res, error.statusCode || 500, {
      success: false,
      message: error.message || 'Gagal memproses penghapusan order.'
    });
  }
}
