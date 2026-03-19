import { getBrowserSupabase } from './supabase-browser.js';

const loginBtn = document.getElementById('loginBtn');
const statusText = document.getElementById('statusText');

function setStatus(message, tone = 'neutral') {
  const tones = {
    neutral: 'text-stone-400',
    success: 'text-emerald-400',
    error: 'text-rose-400'
  };
  statusText.className = `mt-4 text-sm ${tones[tone] || tones.neutral}`;
  statusText.textContent = message;
}

async function redirectIfSessionExists() {
  const supabase = await getBrowserSupabase();
  const {
    data: { session }
  } = await supabase.auth.getSession();

  if (!session) return;

  setStatus('Sesi Google ditemukan, membuka dashboard lisensi...', 'success');
  window.location.href = '/admin/dashboard';
}

loginBtn?.addEventListener('click', async () => {
  loginBtn.disabled = true;
  setStatus('Menghubungkan ke Google Login...', 'neutral');

  try {
    const supabase = await getBrowserSupabase();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/admin/dashboard`
      }
    });

    if (error) {
      throw error;
    }
  } catch (error) {
    loginBtn.disabled = false;
    setStatus(error.message || 'Google login gagal diproses.', 'error');
  }
});

redirectIfSessionExists().catch((error) => {
  setStatus(error.message || 'Konfigurasi Google login gagal dimuat.', 'error');
});
