const statusBox = document.getElementById('checkoutStatus');
const checkoutForm = document.getElementById('checkoutForm');
const npsnInput = document.getElementById('checkoutNpsn');
const schoolNameInput = document.getElementById('checkoutSchoolName');
const deviceInput = document.getElementById('checkoutDeviceId');
const submitBtn = document.getElementById('checkoutSubmit');
const priceMeta = document.getElementById('checkoutPriceMeta');

function setStatus(message, tone = 'info') {
  const tones = {
    info: 'border-sky-400/30 bg-sky-500/10 text-sky-100',
    success: 'border-emerald-400/30 bg-emerald-500/10 text-emerald-100',
    error: 'border-rose-400/30 bg-rose-500/10 text-rose-100'
  };
  statusBox.className = `rounded-2xl border px-4 py-3 text-sm ${tones[tone] || tones.info}`;
  statusBox.textContent = message;
}

function paymentModeLabel(mode) {
  return String(mode || '').toLowerCase() === 'production' ? 'production' : 'sandbox';
}

async function loadConfig() {
  const response = await fetch('/api/license/public-config');
  const data = await response.json();
  if (response.ok && data.success) {
    const paymentState = data.paymentEnabled
      ? `Midtrans ${paymentModeLabel(data.paymentMode)}`
      : 'simulasi internal';
    priceMeta.textContent = `${data.priceLabel} • maksimal ${data.activationLimit} device per lisensi • mode ${paymentState}`;
  }
}

function preloadQuery() {
  const params = new URLSearchParams(window.location.search);
  npsnInput.value = params.get('npsn') || '';
  schoolNameInput.value = params.get('school_name') || '';
  deviceInput.value = params.get('device_id') || '';
}

checkoutForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  submitBtn.disabled = true;
  submitBtn.textContent = 'Menyiapkan Checkout...';

  try {
    const params = new URLSearchParams(window.location.search);
    const body = {
      npsn: npsnInput.value.trim(),
      school_name: schoolNameInput.value.trim(),
      device_id: deviceInput.value.trim(),
      sim: params.get('sim') === '1' ? '1' : '0'
    };

    if (!body.npsn || !body.device_id) {
      throw new Error('NPSN dan Device ID wajib diisi.');
    }

    setStatus('Membuat order pembayaran lisensi...', 'info');
    const response = await fetch('/api/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.message || 'Checkout gagal dibuat.');
    }

    setStatus('Checkout siap. Anda akan diarahkan ke halaman pembayaran...', 'success');
    window.location.href = data.redirect_url;
  } catch (error) {
    setStatus(error.message || 'Checkout gagal diproses.', 'error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Lanjut ke Pembayaran';
  }
});

preloadQuery();
loadConfig().catch(() => {
  priceMeta.textContent = 'Konfigurasi harga belum terbaca. Anda tetap bisa melanjutkan bila server sudah siap.';
});
