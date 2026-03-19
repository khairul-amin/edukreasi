import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

let clientPromise;

async function getBrowserSupabase() {
  if (!clientPromise) {
    clientPromise = fetch('/api/client-config', {
      cache: 'no-store'
    })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.success) {
          throw new Error(data.message || 'Konfigurasi Supabase browser gagal dimuat.');
        }

        return createClient(data.supabaseUrl, data.supabaseAnonKey, {
          auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true,
            flowType: 'pkce'
          }
        });
      });
  }

  return clientPromise;
}

export { getBrowserSupabase };
