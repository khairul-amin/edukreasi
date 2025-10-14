import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient('https://esmkveggutxzklavspnn.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVzbWt2ZWdndXR4emtsYXZzcG5uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAzODIyNTQsImV4cCI6MjA3NTk1ODI1NH0.18vlPWg1S_6ocoCWKaCh_KU41TbipXyQNS2r5GKRQ44');

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
