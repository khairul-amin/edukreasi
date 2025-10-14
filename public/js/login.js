import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
  'https://esmkveggutxzklavspnn.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVzbWt2ZWdndXR4emtsYXZzcG5uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAzODIyNTQsImV4cCI6MjA3NTk1ODI1NH0.18vlPWg1S_6ocoCWKaCh_KU41TbipXyQNS2r5GKRQ44'
);

const loginBtn = document.getElementById('loginBtn');

loginBtn.onclick = async () => {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: 'https://edukreasi.vercel.app/admin/dashboard', // langsung ke dashboard
    },
  });
  if (error) alert('Gagal login: ' + error.message);
};

// Kalau sudah login, langsung redirect
supabase.auth.getSession().then(({ data }) => {
  if (data.session) {
    window.location.href = '/admin/dashboard';
  }
});
