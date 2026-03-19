import { createHttpError, parseBearerToken } from './http.js';
import { getLicenseConfig } from './config.js';
import { createServiceClient } from './supabase.js';

async function requireAdmin(req) {
  const { adminSecret } = getLicenseConfig(req);
  const secretHeader = String(req.headers['x-admin-secret'] || '').trim();
  const bearer = parseBearerToken(req);

  if (adminSecret && secretHeader) {
    if (secretHeader === adminSecret) {
      return {
        mode: 'secret',
        profile: {
          role: 'superadmin',
          name: 'License Admin'
        }
      };
    }

    throw createHttpError(401, 'Admin secret tidak valid.');
  }

  if (adminSecret && bearer === adminSecret) {
    return {
      mode: 'secret',
      profile: {
        role: 'superadmin',
        name: 'License Admin'
      }
    };
  }

  const accessToken = bearer;
  if (!accessToken) {
    throw createHttpError(401, 'Admin secret atau token login admin tidak ditemukan.');
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
    throw createHttpError(403, 'Akses ini hanya untuk superadmin.');
  }

  return {
    mode: 'user',
    user,
    profile
  };
}

export { requireAdmin };
