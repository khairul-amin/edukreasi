import { createHttpError, parseBearerToken } from './http.js';
import { createServiceClient } from './supabase.js';

async function requireAdmin(req) {
  const accessToken = parseBearerToken(req);
  if (!accessToken) {
    throw createHttpError(401, 'Token login admin tidak ditemukan.');
  }

  const supabase = createServiceClient();
  const {
    data: { user },
    error: authError
  } = await supabase.auth.getUser(accessToken);

  if (authError || !user) {
    throw createHttpError(401, 'Sesi login tidak valid atau sudah berakhir.', {
      cause: authError
    });
  }

  const { data: profile, error: profileError } = await supabase
    .from('users')
    .select('id, email, name, role')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError) {
    throw createHttpError(500, 'Gagal memverifikasi role admin.', {
      cause: profileError
    });
  }

  if (!profile || String(profile.role || '').toLowerCase() !== 'superadmin') {
    throw createHttpError(403, 'Akses ini hanya untuk akun Google superadmin yang terdaftar di tabel users.');
  }

  return {
    mode: 'user',
    user,
    profile
  };
}

export { requireAdmin };
