import crypto from 'crypto';
import { getLicenseConfig, getMidtransConfig } from './config.js';
import { createHttpError } from './http.js';
import { createServiceClient } from './supabase.js';

function nowIso() {
  return new Date().toISOString();
}

function randomId(prefix) {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, '')}`;
}

function normalizePlan(value) {
  const text = String(value || '').trim().toLowerCase();
  if (!text) return 'full';
  if (['pro', 'premium'].includes(text)) return 'full';
  return text;
}

function normalizeNpsn(value) {
  const cleanNpsn = String(value || '').trim();
  if (!cleanNpsn) {
    throw createHttpError(400, 'NPSN wajib diisi.');
  }

  if (!/^[0-9]{8}$/.test(cleanNpsn)) {
    throw createHttpError(400, 'NPSN harus terdiri dari 8 digit angka.');
  }

  return cleanNpsn;
}

function base64UrlEncode(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function signJwtToken(payload, req) {
  const { privateKey } = getLicenseConfig(req);
  if (!privateKey) {
    throw createHttpError(500, 'Private key lisensi belum dikonfigurasi.', {
      code: 'PRIVATE_KEY_MISSING'
    });
  }

  const header = base64UrlEncode(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const body = base64UrlEncode(JSON.stringify(payload));
  const data = `${header}.${body}`;
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(data);
  signer.end();
  const signature = signer.sign(privateKey);
  return `${data}.${base64UrlEncode(signature)}`;
}

function buildCheckoutUrl(baseUrl, npsn = '', deviceId = '', extra = {}) {
  const root = String(baseUrl || '').replace(/\/+$/g, '');
  if (!root) return '';

  const params = new URLSearchParams();
  if (npsn) params.set('npsn', npsn);
  if (deviceId) params.set('device_id', deviceId);
  Object.entries(extra || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).trim()) {
      params.set(key, String(value));
    }
  });

  const query = params.toString();
  return `${root}/checkout${query ? `?${query}` : ''}`;
}

function verifyMidtransSignature(payload) {
  const { serverKey } = getMidtransConfig();
  const orderId = String(payload?.order_id || '').trim();
  const statusCode = String(payload?.status_code || '').trim();
  const grossAmount = String(payload?.gross_amount || '').trim();
  const signatureKey = String(payload?.signature_key || '').trim();
  if (!serverKey || !orderId || !statusCode || !grossAmount || !signatureKey) {
    return false;
  }

  const raw = orderId + statusCode + grossAmount + serverKey;
  const expected = crypto.createHash('sha512').update(raw).digest('hex');
  return expected === signatureKey;
}

function createTokenPayload(license, activation) {
  return {
    iss: 'Exam Edukreasi License Server',
    plan: String(license.plan || 'full').toUpperCase(),
    license_id: license.id,
    activation_id: activation.id,
    npsn: license.npsn,
    device_id: activation.device_id,
    issued_at: nowIso(),
    iat: Math.floor(Date.now() / 1000)
  };
}

async function getLicenseByNpsn(supabase, npsn) {
  const { data, error } = await supabase
    .from('licenses')
    .select('*')
    .eq('npsn', npsn)
    .maybeSingle();

  if (error) {
    throw createHttpError(500, 'Gagal mengambil data lisensi.', { cause: error });
  }

  return data || null;
}

async function getLicenseById(supabase, id) {
  const { data, error } = await supabase
    .from('licenses')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    throw createHttpError(500, 'Gagal mengambil data lisensi.', { cause: error });
  }

  return data || null;
}

async function ensureLicense(supabase, { npsn, schoolName = '', plan = 'full', activationLimit = 1, note = '', createdBy = null }) {
  const cleanNpsn = normalizeNpsn(npsn);

  const normalizedPlan = normalizePlan(plan);
  const normalizedLimit = Math.max(1, Number(activationLimit || 1));
  const existing = await getLicenseByNpsn(supabase, cleanNpsn);
  const timestamp = nowIso();

  if (existing) {
    const updates = {
      updated_at: timestamp
    };

    if (schoolName && schoolName !== existing.school_name) updates.school_name = schoolName;
    if (note && note !== existing.note) updates.note = note;
    if (normalizedPlan && normalizedPlan !== existing.plan) updates.plan = normalizedPlan;
    if (normalizedLimit > Number(existing.activation_limit || 1)) {
      updates.activation_limit = normalizedLimit;
    }

    if (Object.keys(updates).length > 1) {
      const { error: updateError } = await supabase
        .from('licenses')
        .update(updates)
        .eq('id', existing.id);

      if (updateError) {
        throw createHttpError(500, 'Gagal memperbarui lisensi.', { cause: updateError });
      }
    }

    return (await getLicenseByNpsn(supabase, cleanNpsn)) || existing;
  }

  const payload = {
    id: randomId('lic'),
    npsn: cleanNpsn,
    school_name: schoolName || '',
    plan: normalizedPlan,
    activation_limit: normalizedLimit,
    status: 'active',
    note: note || '',
    created_at: timestamp,
    updated_at: timestamp
  };

  const { error: insertError } = await supabase.from('licenses').insert(payload);
  if (insertError) {
    throw createHttpError(500, 'Gagal membuat lisensi baru.', { cause: insertError });
  }

  return await getLicenseByNpsn(supabase, cleanNpsn);
}

async function ensureActivation(supabase, license, deviceId, deviceLabel = '') {
  const cleanDeviceId = String(deviceId || '').trim();
  if (!cleanDeviceId) {
    throw createHttpError(400, 'Device ID wajib diisi.');
  }

  const { data: existingActivation, error: existingError } = await supabase
    .from('license_activations')
    .select('*')
    .eq('license_id', license.id)
    .eq('device_id', cleanDeviceId)
    .maybeSingle();

  if (existingError) {
    throw createHttpError(500, 'Gagal memeriksa aktivasi.', { cause: existingError });
  }

  if (existingActivation?.status === 'active') {
    return existingActivation;
  }

  const { count, error: countError } = await supabase
    .from('license_activations')
    .select('id', { count: 'exact', head: true })
    .eq('license_id', license.id)
    .eq('status', 'active');

  if (countError) {
    throw createHttpError(500, 'Gagal menghitung aktivasi aktif.', { cause: countError });
  }

  const limit = Math.max(1, Number(license.activation_limit || 1));
  if (Number(count || 0) >= limit) {
    throw createHttpError(400, 'Batas aktivasi sudah tercapai.', { code: 'ACTIVATION_LIMIT' });
  }

  const timestamp = nowIso();

  if (existingActivation) {
    const { error: updateError } = await supabase
      .from('license_activations')
      .update({
        device_label: deviceLabel || existingActivation.device_label || '',
        status: 'active',
        activated_at: timestamp,
        deactivated_at: null,
        updated_at: timestamp
      })
      .eq('id', existingActivation.id);

    if (updateError) {
      throw createHttpError(500, 'Gagal mengaktifkan ulang lisensi.', { cause: updateError });
    }

    const { data: refreshed } = await supabase
      .from('license_activations')
      .select('*')
      .eq('id', existingActivation.id)
      .maybeSingle();

    return refreshed || existingActivation;
  }

  const payload = {
    id: randomId('act'),
    license_id: license.id,
    device_id: cleanDeviceId,
    device_label: deviceLabel || '',
    status: 'active',
    activated_at: timestamp,
    created_at: timestamp,
    updated_at: timestamp
  };

  const { data, error: insertError } = await supabase
    .from('license_activations')
    .insert(payload)
    .select('*')
    .maybeSingle();

  if (insertError) {
    throw createHttpError(500, 'Gagal membuat aktivasi baru.', { cause: insertError });
  }

  return data;
}

function issueToken(req, license, activation) {
  return signJwtToken(createTokenPayload(license, activation), req);
}

async function createOrder(supabase, payload) {
  const timestamp = nowIso();
  const order = {
    order_id: payload.order_id,
    license_id: payload.license_id || null,
    npsn: payload.npsn,
    school_name: payload.school_name || '',
    device_id: payload.device_id,
    amount: Number(payload.amount || 0),
    currency: payload.currency || 'IDR',
    status: payload.status || 'pending',
    payment_type: payload.payment_type || null,
    payment_provider: payload.payment_provider || 'midtrans',
    redirect_url: payload.redirect_url || null,
    snap_token: payload.snap_token || null,
    raw_json: payload.raw_json || null,
    created_at: timestamp,
    updated_at: timestamp,
    paid_at: payload.paid_at || null
  };

  const { error } = await supabase.from('license_orders').insert(order);
  if (error) {
    throw createHttpError(500, 'Gagal membuat order lisensi.', { cause: error });
  }
  return order;
}

async function updateOrder(supabase, orderId, fields) {
  const updates = {
    ...fields,
    updated_at: nowIso()
  };

  const { error } = await supabase
    .from('license_orders')
    .update(updates)
    .eq('order_id', orderId);

  if (error) {
    throw createHttpError(500, 'Gagal memperbarui order lisensi.', { cause: error });
  }
}

async function getOrder(supabase, orderId) {
  const { data, error } = await supabase
    .from('license_orders')
    .select('*')
    .eq('order_id', orderId)
    .maybeSingle();

  if (error) {
    throw createHttpError(500, 'Gagal mengambil order lisensi.', { cause: error });
  }

  return data || null;
}

async function deactivateActivationById(supabase, activationId) {
  const timestamp = nowIso();
  const { data, error } = await supabase
    .from('license_activations')
    .update({
      status: 'inactive',
      deactivated_at: timestamp,
      updated_at: timestamp
    })
    .eq('id', activationId)
    .eq('status', 'active')
    .select('id, license_id, device_id, device_label, status, activated_at, deactivated_at, updated_at')
    .maybeSingle();

  if (error) {
    throw createHttpError(500, 'Gagal menonaktifkan aktivasi.', { cause: error });
  }

  if (data) {
    return data;
  }

  const { data: existing, error: existingError } = await supabase
    .from('license_activations')
    .select('id, status')
    .eq('id', activationId)
    .maybeSingle();

  if (existingError) {
    throw createHttpError(500, 'Gagal memverifikasi status aktivasi.', { cause: existingError });
  }

  if (!existing) {
    throw createHttpError(404, 'Aktivasi device tidak ditemukan.');
  }

  if (String(existing.status || '').toLowerCase() === 'inactive') {
    throw createHttpError(409, 'Aktivasi device sudah nonaktif.');
  }

  throw createHttpError(409, 'Aktivasi device tidak dapat dinonaktifkan.');
}

async function deactivateActivationByDevice(supabase, licenseId, deviceId) {
  const timestamp = nowIso();
  const { data, error } = await supabase
    .from('license_activations')
    .update({
      status: 'inactive',
      deactivated_at: timestamp,
      updated_at: timestamp
    })
    .eq('license_id', licenseId)
    .eq('device_id', deviceId)
    .eq('status', 'active')
    .select('id, license_id, device_id, device_label, status, activated_at, deactivated_at, updated_at')
    .maybeSingle();

  if (error) {
    throw createHttpError(500, 'Gagal menonaktifkan device dari lisensi.', { cause: error });
  }

  if (data) {
    return data;
  }

  const { data: existing, error: existingError } = await supabase
    .from('license_activations')
    .select('id, status')
    .eq('license_id', licenseId)
    .eq('device_id', deviceId)
    .maybeSingle();

  if (existingError) {
    throw createHttpError(500, 'Gagal memverifikasi status device.', { cause: existingError });
  }

  if (!existing) {
    throw createHttpError(404, 'Aktivasi device untuk lisensi ini tidak ditemukan.');
  }

  if (String(existing.status || '').toLowerCase() === 'inactive') {
    throw createHttpError(409, 'Aktivasi device sudah nonaktif.');
  }

  throw createHttpError(409, 'Aktivasi device tidak dapat dinonaktifkan.');
}

async function createMidtransTransaction(req, { orderId, amount, npsn, deviceId, schoolName = '' }) {
  const { publicBaseUrl, currency } = getLicenseConfig(req);
  const { serverKey, isProduction } = getMidtransConfig();
  if (!serverKey) return null;

  const endpoint = isProduction
    ? 'https://app.midtrans.com/snap/v1/transactions'
    : 'https://app.sandbox.midtrans.com/snap/v1/transactions';

  const authToken = Buffer.from(`${serverKey}:`).toString('base64');
  const payload = {
    transaction_details: {
      order_id: orderId,
      gross_amount: Number(amount)
    },
    item_details: [
      {
        id: 'license-full',
        price: Number(amount),
        quantity: 1,
        name: `Lisensi Exam Edukreasi (${npsn})`
      }
    ],
    custom_field1: npsn,
    custom_field2: deviceId,
    customer_details: {
      first_name: schoolName || npsn,
      notes: `Aktivasi device ${deviceId}`
    },
    callbacks: {
      finish: `${publicBaseUrl}/checkout/complete?order_id=${encodeURIComponent(orderId)}`
    },
    enabled_payments: [
      'qris',
      'gopay',
      'bank_transfer',
      'echannel',
      'shopeepay'
    ],
    metadata: {
      currency,
      school_name: schoolName || ''
    }
  };

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${authToken}`,
      'Content-Type': 'application/json',
      Accept: 'application/json'
    },
    body: JSON.stringify(payload)
  });

  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw createHttpError(500, result?.error_messages?.join(' ') || 'Gagal membuat transaksi Midtrans.', {
      code: 'MIDTRANS_ERROR',
      details: result
    });
  }

  return result;
}

async function getDashboardSnapshot(req, limit = 12) {
  const supabase = createServiceClient();

  const [
    licenseCountResult,
    activationCountResult,
    pendingOrderCountResult,
    paidOrderCountResult,
    revenueResult,
    licensesResult,
    ordersResult,
    activationsResult
  ] = await Promise.all([
    supabase.from('licenses').select('id', { count: 'exact', head: true }),
    supabase.from('license_activations').select('id', { count: 'exact', head: true }).eq('status', 'active'),
    supabase.from('license_orders').select('order_id', { count: 'exact', head: true }).in('status', ['pending', 'waiting_payment']),
    supabase.from('license_orders').select('order_id', { count: 'exact', head: true }).in('status', ['paid', 'settlement', 'capture']),
    supabase.from('license_orders').select('amount').in('status', ['paid', 'settlement', 'capture']),
    supabase.from('licenses').select('*').order('updated_at', { ascending: false }).limit(limit),
    supabase.from('license_orders').select('*').order('updated_at', { ascending: false }).limit(limit),
    supabase
      .from('license_activations')
      .select('id, license_id, device_id, device_label, status, activated_at, deactivated_at, updated_at, licenses ( id, npsn, school_name, plan )')
      .order('updated_at', { ascending: false })
      .limit(limit)
  ]);

  const maybeThrow = (result, message) => {
    if (result.error) {
      throw createHttpError(500, message, { cause: result.error });
    }
  };

  maybeThrow(licenseCountResult, 'Gagal menghitung lisensi.');
  maybeThrow(activationCountResult, 'Gagal menghitung aktivasi.');
  maybeThrow(pendingOrderCountResult, 'Gagal menghitung order pending.');
  maybeThrow(paidOrderCountResult, 'Gagal menghitung order sukses.');
  maybeThrow(revenueResult, 'Gagal menghitung omzet lisensi.');
  maybeThrow(licensesResult, 'Gagal mengambil data lisensi.');
  maybeThrow(ordersResult, 'Gagal mengambil data order.');
  maybeThrow(activationsResult, 'Gagal mengambil data aktivasi.');

  const revenue = (revenueResult.data || []).reduce((sum, row) => sum + Number(row.amount || 0), 0);

  const activations = (activationsResult.data || []).map((activation) => {
    const license = activation.licenses || {};
    let token = null;
    try {
      token = issueToken(req, license, activation);
    } catch (error) {
      token = null;
    }
    return {
      ...activation,
      token
    };
  });

  return {
    metrics: {
      totalLicenses: Number(licenseCountResult.count || 0),
      activeActivations: Number(activationCountResult.count || 0),
      pendingOrders: Number(pendingOrderCountResult.count || 0),
      successfulOrders: Number(paidOrderCountResult.count || 0),
      revenue
    },
    licenses: licensesResult.data || [],
    orders: ordersResult.data || [],
    activations
  };
}

export {
  buildCheckoutUrl,
  createMidtransTransaction,
  createOrder,
  deactivateActivationByDevice,
  deactivateActivationById,
  ensureActivation,
  ensureLicense,
  getDashboardSnapshot,
  getLicenseById,
  getOrder,
  issueToken,
  normalizeNpsn,
  nowIso,
  normalizePlan,
  randomId,
  updateOrder,
  verifyMidtransSignature
};
