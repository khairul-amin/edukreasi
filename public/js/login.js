import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient('https://YOUR_PROJECT.supabase.co', 'YOUR_ANON_KEY');

const loginBtn = document.getElementById('loginBtn');

loginBtn.onclick = async () => {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
  });
  if (error) alert('Gagal login: ' + error.message);
};

// Cek status login
supabase.auth.onAuthStateChange((event, session) => {
  if (session) {
    window.location.href = './dashboard.html';
  }
});
