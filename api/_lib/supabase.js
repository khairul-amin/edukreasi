import { createClient } from '@supabase/supabase-js';
import { getSupabaseConfig } from './config.js';

function createServiceClient() {
  const { url, serviceRoleKey } = getSupabaseConfig();
  return createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}

export { createServiceClient };
