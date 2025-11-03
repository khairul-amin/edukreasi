import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
  'https://esmkveggutxzklavspnn.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVzbWt2ZWdndXR4emtsYXZzcG5uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAzODIyNTQsImV4cCI6MjA3NTk1ODI1NH0.18vlPWg1S_6ocoCWKaCh_KU41TbipXyQNS2r5GKRQ44'
);

const loginBtn = document.getElementById('loginBtn');

loginBtn.onclick = async () => {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: 'https://edukreasi.vercel.app/admin/dashboard',
    },
  });
  if (error) alert('Gagal login: ' + error.message);
};

// Cek kalau sudah login
supabase.auth.getSession().then(async ({ data }) => {
  if (data.session) {
    const user = data.session.user;

    // Simpan data user ke tabel users jika belum ada
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('id', user.id)
      .single();

if (!existingUser) {
  // --- Tentukan role otomatis ---
  const role = (user.email === 'khairulamin2409@gmail.com')
    ? 'superadmin'
    : 'user';

  // --- Simpan user baru ke tabel users ---
  const { error: insertError } = await supabase.from('users').insert({
    id: user.id,
    email: user.email,
    name: user.user_metadata.full_name || user.email,
    role,
  });

  if (insertError) console.error('Gagal simpan user baru:', insertError.message);
}

    window.location.href = '/admin/dashboard';
  }
});
