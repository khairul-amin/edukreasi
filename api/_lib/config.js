function readMultilineEnv(name, fallback = '') {
  const value = String(process.env[name] || fallback || '').trim();
  return value ? value.replace(/\\n/g, '\n') : '';
}

function getEnv(name, fallback = '') {
  return String(process.env[name] || fallback || '').trim();
}

function requireEnv(name) {
  const value = getEnv(name);
  if (!value) {
    const error = new Error(`${name}_MISSING`);
    error.statusCode = 500;
    throw error;
  }
  return value;
}

function resolvePublicBaseUrl(req) {
  const configured = getEnv('PUBLIC_BASE_URL');
  if (configured) return configured.replace(/\/+$/g, '');

  const host = String(req.headers['x-forwarded-host'] || req.headers.host || '').trim();
  const proto = String(req.headers['x-forwarded-proto'] || 'https').trim();
  if (!host) return '';
  return `${proto}://${host}`.replace(/\/+$/g, '');
}

function getSupabaseConfig() {
  return {
    url: requireEnv('SUPABASE_URL'),
    anonKey: getEnv('SUPABASE_ANON_KEY'),
    serviceRoleKey: requireEnv('SUPABASE_SERVICE_ROLE_KEY')
  };
}

function getLicenseConfig(req) {
  return {
    plan: getEnv('LICENSE_PLAN', 'full').toLowerCase(),
    price: Number(getEnv('LICENSE_PRICE', '0')),
    currency: getEnv('LICENSE_CURRENCY', 'IDR').toUpperCase(),
    activationLimit: Number(getEnv('LICENSE_ACTIVATION_LIMIT', '1')),
    adminSecret: getEnv('LICENSE_ADMIN_SECRET'),
    publicBaseUrl: resolvePublicBaseUrl(req),
    privateKey: readMultilineEnv('LICENSE_PRIVATE_KEY'),
    publicKey: readMultilineEnv('LICENSE_PUBLIC_KEY')
  };
}

function getMidtransConfig() {
  return {
    merchantId: getEnv('MIDTRANS_MERCHANT_ID'),
    serverKey: getEnv('MIDTRANS_SERVER_KEY'),
    clientKey: getEnv('MIDTRANS_CLIENT_KEY'),
    isProduction: getEnv('MIDTRANS_IS_PRODUCTION') === '1'
  };
}

export {
  getEnv,
  getLicenseConfig,
  getMidtransConfig,
  getSupabaseConfig,
  readMultilineEnv,
  requireEnv,
  resolvePublicBaseUrl
};
