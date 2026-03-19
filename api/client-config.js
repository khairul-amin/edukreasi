import { getSupabaseConfig, requireEnv } from '../lib/config.js';
import { methodNotAllowed, sendJson } from '../lib/http.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return methodNotAllowed(res, ['GET']);
  }

  try {
    const { url } = getSupabaseConfig();
    const anonKey = requireEnv('SUPABASE_ANON_KEY');

    return sendJson(res, 200, {
      success: true,
      supabaseUrl: url,
      supabaseAnonKey: anonKey
    });
  } catch (error) {
    return sendJson(res, error.statusCode || 500, {
      success: false,
      message: error.message || 'Konfigurasi browser auth belum lengkap.'
    });
  }
}
