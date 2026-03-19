const statusText = document.getElementById('claimStatus');
const tokenBox = document.getElementById('claimToken');
const metaBox = document.getElementById('claimMeta');
const refreshBtn = document.getElementById('refreshClaimBtn');
const copyBtn = document.getElementById('copyClaimBtn');

let currentToken = '';

function setStatus(message, tone = 'info') {
  const tones = {
    info: 'text-sky-100',
    success: 'text-emerald-100',
    error: 'text-rose-100'
  };
  statusText.className = `text-sm ${tones[tone] || tones.info}`;
  statusText.textContent = message;
}

async function copyToken() {
  if (!currentToken) return;
  await navigator.clipboard.writeText(currentToken);
  setStatus('Token lisensi berhasil disalin.', 'success');
}

async function loadClaim() {
  const params = new URLSearchParams(window.location.search);
  const orderId = params.get('order_id');
  if (!orderId) {
    setStatus('order_id tidak ditemukan di URL.', 'error');
    tokenBox.value = '';
    return;
  }

  setStatus('Memeriksa status pembayaran dan menyiapkan token lisensi...', 'info');
  tokenBox.value = '';
  metaBox.innerHTML = '';
  copyBtn.disabled = true;

  const response = await fetch(`/api/license/claim?order_id=${encodeURIComponent(orderId)}`);
  const data = await response.json();

  if (!response.ok || !data.success) {
    currentToken = '';
    tokenBox.value = '';
    setStatus(data.message || 'Pembayaran belum selesai. Silakan refresh beberapa saat lagi.', 'error');
    metaBox.innerHTML = `<p class="text-sm text-slate-300">Order ID: <span class="font-mono text-xs">${orderId}</span></p>`;
    return;
  }

  currentToken = data.token;
  tokenBox.value = data.token;
  copyBtn.disabled = false;
  setStatus('Pembayaran sukses. Tempel token berikut ke aplikasi client.', 'success');
  metaBox.innerHTML = `
    <p class="text-sm text-slate-200">License ID: <span class="font-mono text-xs">${data.license_id}</span></p>
    <p class="text-sm text-slate-200">Activation ID: <span class="font-mono text-xs">${data.activation_id}</span></p>
    <p class="text-sm text-slate-200">NPSN: <span class="font-mono text-xs">${data.npsn}</span></p>
  `;
}

refreshBtn?.addEventListener('click', () => {
  loadClaim().catch((error) => {
    setStatus(error.message || 'Gagal memeriksa status pembayaran.', 'error');
  });
});

copyBtn?.addEventListener('click', () => {
  copyToken().catch((error) => {
    setStatus(error.message || 'Token gagal disalin.', 'error');
  });
});

loadClaim().catch((error) => {
  setStatus(error.message || 'Halaman token tidak dapat dimuat.', 'error');
});
