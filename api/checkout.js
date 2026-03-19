import crypto from 'crypto';
import { getLicenseConfig } from '../lib/config.js';
import { createServiceClient } from '../lib/supabase.js';
import { createHttpError, methodNotAllowed, readJsonBody, sendJson } from '../lib/http.js';
import { buildCheckoutUrl, createMidtransTransaction, createOrder, updateOrder } from '../lib/license-store.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return methodNotAllowed(res, ['POST']);
  }

  try {
    const body = await readJsonBody(req);
    const { price, currency, publicBaseUrl } = getLicenseConfig(req);
    const npsn = String(body.npsn || req.query.npsn || '').trim();
    const deviceId = String(body.device_id || req.query.device_id || '').trim();
    const schoolName = String(body.school_name || '').trim();
    const simulation = String(body.sim || req.query.sim || '').trim() === '1';
    const amount = Number(body.amount || price);

    if (!npsn) throw createHttpError(400, 'NPSN wajib diisi.');
    if (!deviceId) throw createHttpError(400, 'Device ID wajib diisi.');
    if (!amount || amount <= 0) throw createHttpError(400, 'Harga lisensi belum dikonfigurasi.');
    if (!publicBaseUrl) throw createHttpError(500, 'PUBLIC_BASE_URL belum tersedia.');

    const orderId = `EXAM-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${crypto.randomUUID().slice(0, 8)}`;
    const supabase = createServiceClient();

    await createOrder(supabase, {
      order_id: orderId,
      npsn,
      school_name: schoolName,
      device_id: deviceId,
      amount,
      currency,
      status: 'pending',
      payment_provider: 'midtrans'
    });

    let redirectUrl = `${publicBaseUrl}/checkout/complete?order_id=${encodeURIComponent(orderId)}`;
    let paymentType = simulation ? 'simulation' : null;
    let snapToken = null;
    let rawJson = null;
    let nextStatus = 'pending';
    let paidAt = null;

    if (simulation) {
      nextStatus = 'paid';
      paidAt = new Date().toISOString();
      rawJson = {
        mode: 'simulation',
        message: 'Order ditandai lunas secara internal untuk kebutuhan testing.'
      };
    } else {
      try {
        const midtransResponse = await createMidtransTransaction(req, {
          orderId,
          amount,
          npsn,
          deviceId,
          schoolName
        });
        redirectUrl = midtransResponse?.redirect_url || redirectUrl;
        paymentType = midtransResponse?.payment_type || 'midtrans';
        snapToken = midtransResponse?.token || null;
        rawJson = midtransResponse;
        if (!midtransResponse) {
          paymentType = 'simulation';
        }
      } catch (error) {
        await updateOrder(supabase, orderId, {
          status: 'error',
          raw_json: { message: error.message || 'MIDTRANS_ERROR' }
        });
        throw error;
      }
    }

    await updateOrder(supabase, orderId, {
      redirect_url: redirectUrl,
      payment_type: paymentType,
      snap_token: snapToken,
      raw_json: rawJson,
      status: nextStatus,
      paid_at: paidAt
    });

    return sendJson(res, 200, {
      success: true,
      order_id: orderId,
      redirect_url: redirectUrl,
      amount,
      currency,
      checkout_url: buildCheckoutUrl(publicBaseUrl, npsn, deviceId)
    });
  } catch (error) {
    return sendJson(res, error.statusCode || 500, {
      success: false,
      message: error.message || 'Gagal membuat checkout lisensi.'
    });
  }
}
