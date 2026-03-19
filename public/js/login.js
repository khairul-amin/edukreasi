import { buildAdminHeaders, clearAdminSecret, getAdminSecret, setAdminSecret } from './admin-session.js';

const form = document.getElementById('loginForm');
const secretInput = document.getElementById('adminSecret');
const rememberInput = document.getElementById('rememberSecret');
const statusText = document.getElementById('statusText');
const loginBtn = document.getElementById('loginBtn');

function setStatus(message, tone = 'neutral') {
  const tones = {
    neutral: 'text-stone-400',
    success: 'text-emerald-400',
    error: 'text-rose-400'
  };
  statusText.className = `mt-4 text-sm ${tones[tone] || tones.neutral}`;
  statusText.textContent = message;
}

async function validateSecret(secret) {
  const response = await fetch('/api/admin/dashboard?limit=1', {
    headers: buildAdminHeaders(secret)
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.success) {
    throw new Error(data.message || 'Admin secret tidak valid.');
  }

  return data;
}

async function bootWithExistingSecret() {
  const storedSecret = getAdminSecret();
  if (!storedSecret) return;

  setStatus('Memeriksa sesi admin yang tersimpan...', 'neutral');
  try {
    await validateSecret(storedSecret);
    setStatus('Sesi admin valid, membuka dashboard...', 'success');
    window.location.href = '/admin/dashboard';
  } catch (error) {
    clearAdminSecret();
    setStatus(error.message || 'Sesi tersimpan tidak lagi valid.', 'error');
  }
}

form?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const secret = secretInput.value.trim();
  const remember = Boolean(rememberInput.checked);

  if (!secret) {
    setStatus('Admin secret wajib diisi.', 'error');
    secretInput.focus();
    return;
  }

  loginBtn.disabled = true;
  loginBtn.textContent = 'Memverifikasi...';
  setStatus('Memverifikasi akses admin ke server lisensi...', 'neutral');

  try {
    await validateSecret(secret);
    setAdminSecret(secret, remember);
    setStatus('Akses admin valid. Mengalihkan ke dashboard...', 'success');
    window.location.href = '/admin/dashboard';
  } catch (error) {
    clearAdminSecret();
    setStatus(error.message || 'Admin secret tidak valid.', 'error');
  } finally {
    loginBtn.disabled = false;
    loginBtn.textContent = 'Masuk ke Dashboard';
  }
});

bootWithExistingSecret();
