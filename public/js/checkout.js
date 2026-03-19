const statusBox = document.getElementById('checkoutStatus');
const checkoutForm = document.getElementById('checkoutForm');
const npsnInput = document.getElementById('checkoutNpsn');
const schoolNameInput = document.getElementById('checkoutSchoolName');
const deviceInput = document.getElementById('checkoutDeviceId');
const submitBtn = document.getElementById('checkoutSubmit');
const priceMeta = document.getElementById('checkoutPriceMeta');

const checkoutState = {
  config: null,
  snapLoader: null
};

function setStatus(message, tone = 'info') {
  const tones = {
    info: 'border-sky-400/30 bg-sky-500/10 text-sky-100',
    success: 'border-emerald-400/30 bg-emerald-500/10 text-emerald-100',
    error: 'border-rose-400/30 bg-rose-500/10 text-rose-100'
  };
  statusBox.className = `mt-5 rounded-2xl border px-4 py-3 text-sm ${tones[tone] || tones.info}`;
  statusBox.textContent = message;
}

function paymentModeLabel(mode) {
  return String(mode || '').toLowerCase() === 'production' ? 'production' : 'sandbox';
}

function redirectToComplete(orderId) {
  if (!orderId) return;
  const url = new URL('/checkout/complete', window.location.origin);
  url.searchParams.set('order_id', orderId);
  window.location.href = url.toString();
}

function loadMidtransSnap(config) {
  if (!config?.paymentEnabled || !config.paymentClientKey || !config.paymentScriptUrl) {
    return Promise.resolve(false);
  }

  if (window.snap) {
    return Promise.resolve(true);
  }

  if (checkoutState.snapLoader) {
    return checkoutState.snapLoader;
  }

  checkoutState.snapLoader = new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-midtrans-snap="1"]');
    if (existing) {
      existing.addEventListener('load', () => resolve(Boolean(window.snap)), { once: true });
      existing.addEventListener('error', () => reject(new Error('Script Midtrans gagal dimuat.')), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = config.paymentScriptUrl;
    script.setAttribute('data-client-key', config.paymentClientKey);
    script.setAttribute('data-midtrans-snap', '1');
    script.async = true;
    script.onload = () => resolve(Boolean(window.snap));
    script.onerror = () => reject(new Error('Script Midtrans gagal dimuat.'));
    document.head.appendChild(script);
  });

  return checkoutState.snapLoader;
}

async function loadConfig() {
  const response = await fetch('/api/license/public-config');
  const data = await response.json();
  if (!response.ok || !data.success) {
    throw new Error(data.message || 'Konfigurasi checkout belum tersedia.');
  }

  checkoutState.config = data;

  const paymentState = data.paymentEnabled
    ? `Midtrans Snap ${paymentModeLabel(data.paymentMode)}`
    : 'simulasi internal';
  priceMeta.textContent = `${data.priceLabel} - maksimal ${data.activationLimit} device per lisensi - mode ${paymentState}`;

  if (data.paymentEnabled) {
    await loadMidtransSnap(data);
    setStatus('Midtrans Snap siap. Setelah submit, popup pembayaran akan dibuka di halaman ini.', 'info');
    return;
  }

  setStatus('Midtrans belum aktif di server. Gunakan mode simulasi atau lengkapi env Vercel lebih dulu.', 'error');
}

function preloadQuery() {
  const params = new URLSearchParams(window.location.search);
  npsnInput.value = params.get('npsn') || '';
  schoolNameInput.value = params.get('school_name') || '';
  deviceInput.value = params.get('device_id') || '';
}

function openSnapPopup(data) {
  if (!window.snap || !data?.snap_token) {
    window.location.href = data.redirect_url;
    return;
  }

  setStatus('Popup pembayaran Midtrans sedang dibuka...', 'success');
  window.snap.pay(data.snap_token, {
    onSuccess: () => redirectToComplete(data.order_id),
    onPending: () => redirectToComplete(data.order_id),
    onError: (result) => {
      console.error('Midtrans error', result);
      setStatus('Pembayaran gagal diproses Midtrans. Silakan coba lagi atau cek dashboard order.', 'error');
    },
    onClose: () => {
      setStatus('Popup pembayaran ditutup. Anda bisa klik lagi tombol pembayaran untuk membuat order baru.', 'info');
    }
  });
}

checkoutForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  submitBtn.disabled = true;
  submitBtn.textContent = 'Menyiapkan Checkout...';

  try {
    const params = new URLSearchParams(window.location.search);
    const simulation = params.get('sim') === '1';
    const body = {
      npsn: npsnInput.value.trim(),
      school_name: schoolNameInput.value.trim(),
      device_id: deviceInput.value.trim(),
      sim: simulation ? '1' : '0'
    };

    if (!body.npsn || !body.device_id) {
      throw new Error('NPSN dan Device ID wajib diisi.');
    }

    if (!checkoutState.config) {
      await loadConfig();
    }

    if (!simulation && checkoutState.config?.paymentEnabled) {
      await loadMidtransSnap(checkoutState.config);
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

    if (data.payment_mode === 'simulation') {
      setStatus('Order simulasi siap. Mengalihkan ke halaman token lisensi...', 'success');
      window.location.href = data.redirect_url;
      return;
    }

    if (data.snap_token && checkoutState.config?.paymentEnabled) {
      openSnapPopup(data);
      return;
    }

    setStatus('Token popup tidak tersedia. Mengalihkan ke halaman pembayaran Midtrans...', 'info');
    window.location.href = data.redirect_url;
  } catch (error) {
    setStatus(error.message || 'Checkout gagal diproses.', 'error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Lanjut ke Pembayaran';
  }
});

preloadQuery();
loadConfig().catch((error) => {
  priceMeta.textContent = 'Konfigurasi harga belum terbaca. Lengkapi env server lalu refresh halaman ini.';
  setStatus(error.message || 'Konfigurasi checkout gagal dimuat.', 'error');
});
