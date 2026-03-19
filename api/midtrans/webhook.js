import { createServiceClient } from '../_lib/supabase.js';
import { createHttpError, methodNotAllowed, readJsonBody, sendJson } from '../_lib/http.js';
import { ensureActivation, ensureLicense, issueToken, updateOrder, verifyMidtransSignature } from '../_lib/license-store.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return methodNotAllowed(res, ['POST']);
  }

  try {
    const body = await readJsonBody(req);
    if (!verifyMidtransSignature(body)) {
      throw createHttpError(401, 'Signature Midtrans tidak valid.');
    }

    const orderId = String(body.order_id || '').trim();
    const status = String(body.transaction_status || '').trim().toLowerCase();
    const fraud = String(body.fraud_status || '').trim().toLowerCase();
    if (!orderId) {
      throw createHttpError(400, 'Order ID kosong.');
    }

    const supabase = createServiceClient();
    await updateOrder(supabase, orderId, {
      status,
      payment_type: body.payment_type || 'midtrans',
      raw_json: body
    });

    if (['settlement', 'capture'].includes(status) && (!fraud || fraud === 'accept')) {
      const { data: order, error } = await supabase
        .from('license_orders')
        .select('*')
        .eq('order_id', orderId)
        .maybeSingle();

      if (error || !order) {
        throw createHttpError(404, 'Order tidak ditemukan saat webhook.', { cause: error });
      }

      try {
        const license = await ensureLicense(supabase, {
          npsn: order.npsn,
          schoolName: order.school_name || '',
          note: 'Aktivasi dari Midtrans webhook'
        });
        const activation = await ensureActivation(supabase, license, order.device_id, order.school_name || '');
        await updateOrder(supabase, orderId, {
          license_id: license.id,
          status: 'paid',
          paid_at: new Date().toISOString()
        });

        return sendJson(res, 200, {
          success: true,
          token: issueToken(req, license, activation)
        });
      } catch (activationError) {
        await updateOrder(supabase, orderId, {
          status: 'paid_pending_activation',
          raw_json: {
            source: 'midtrans-webhook',
            payload: body,
            activation_error: activationError.message || 'ACTIVATION_FAILED'
          }
        });
      }
    }

    return sendJson(res, 200, { success: true });
  } catch (error) {
    return sendJson(res, error.statusCode || 500, {
      success: false,
      message: error.message || 'Webhook Midtrans gagal diproses.'
    });
  }
}

