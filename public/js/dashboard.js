import { buildAdminHeaders, clearAdminSecret, getAdminSecret } from './admin-session.js';

const els = {
  heroSubtitle: document.getElementById('heroSubtitle'),
  userIdentity: document.getElementById('userIdentity'),
  refreshBtn: document.getElementById('refreshBtn'),
  logoutBtn: document.getElementById('logoutBtn'),
  flash: document.getElementById('flash'),
  accessDenied: document.getElementById('accessDenied'),
  publicKeyLink: document.getElementById('publicKeyLink'),
  publicConfigMeta: document.getElementById('publicConfigMeta'),
  setupGrid: document.getElementById('setupGrid'),
  metricsGrid: document.getElementById('metricsGrid'),
  builderSchoolName: document.getElementById('builderSchoolName'),
  builderNpsn: document.getElementById('builderNpsn'),
  builderDeviceId: document.getElementById('builderDeviceId'),
  builderSimulation: document.getElementById('builderSimulation'),
  checkoutBuilderForm: document.getElementById('checkoutBuilderForm'),
  checkoutPreview: document.getElementById('checkoutPreview'),
  openCheckoutBtn: document.getElementById('openCheckoutBtn'),
  copyCheckoutBtn: document.getElementById('copyCheckoutBtn'),
  issueForm: document.getElementById('issueForm'),
  issueSchoolName: document.getElementById('issueSchoolName'),
  issueNpsn: document.getElementById('issueNpsn'),
  issueDeviceId: document.getElementById('issueDeviceId'),
  issuePlan: document.getElementById('issuePlan'),
  issueActivationLimit: document.getElementById('issueActivationLimit'),
  issueNote: document.getElementById('issueNote'),
  issueResult: document.getElementById('issueResult'),
  systemInfo: document.getElementById('systemInfo'),
  licenseTable: document.getElementById('licenseTable'),
  orderTable: document.getElementById('orderTable'),
  activationTable: document.getElementById('activationTable')
};

const state = {
  adminSecret: '',
  admin: null,
  publicConfig: null,
  adminData: null
};

class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function showFlash(message, tone = 'info') {
  const tones = {
    info: 'border-sky-400/40 bg-sky-500/10 text-sky-100',
    success: 'border-emerald-400/40 bg-emerald-500/10 text-emerald-100',
    error: 'border-rose-400/40 bg-rose-500/10 text-rose-100'
  };

  els.flash.innerHTML = `
    <div class="rounded-2xl border px-4 py-3 text-sm shadow-lg backdrop-blur ${tones[tone] || tones.info}">
      ${escapeHtml(message)}
    </div>
  `;

  window.clearTimeout(showFlash._timer);
  showFlash._timer = window.setTimeout(() => {
    els.flash.innerHTML = '';
  }, 5000);
}

function formatDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(date);
}

function formatCurrency(amount, currency = 'IDR') {
  try {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0
    }).format(Number(amount || 0));
  } catch {
    return `${currency} ${Number(amount || 0).toLocaleString('id-ID')}`;
  }
}

function fillIdentity(admin) {
  const label = admin?.name || 'License Admin';
  const role = admin?.role || 'superadmin';

  els.userIdentity.innerHTML = `
    <div class="rounded-2xl border border-amber-300/20 bg-amber-400/10 px-4 py-2 text-sm text-amber-100">
      <div class="font-semibold">${escapeHtml(label)}</div>
      <div class="text-xs uppercase tracking-[0.3em] opacity-80">${escapeHtml(role)}</div>
    </div>
  `;
}

async function apiFetch(path, options = {}) {
  const headers = new Headers(buildAdminHeaders(state.adminSecret, options.headers || {}));
  if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(path, {
    ...options,
    headers
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ApiError(response.status, data?.message || 'Request gagal diproses.');
  }
  return data;
}

async function loadPublicConfig() {
  const response = await fetch('/api/license/public-config');
  const data = await response.json();
  if (!response.ok || !data.success) {
    throw new Error(data?.message || 'Gagal memuat konfigurasi lisensi.');
  }
  state.publicConfig = data;
  return data;
}

async function copyText(text, message = 'Teks berhasil disalin.') {
  await navigator.clipboard.writeText(text);
  showFlash(message, 'success');
}

function paymentModeLabel(mode) {
  return String(mode || '').toLowerCase() === 'production' ? 'Production' : 'Sandbox';
}

function paymentModeTone(mode) {
  return String(mode || '').toLowerCase() === 'production'
    ? 'border-emerald-400/20 bg-emerald-500/10 text-emerald-100'
    : 'border-amber-400/20 bg-amber-500/10 text-amber-100';
}

function buildCheckoutPreview() {
  const baseUrl = state.publicConfig?.checkoutPageUrl || `${window.location.origin}/checkout`;
  const params = new URLSearchParams();
  const npsn = els.builderNpsn.value.trim();
  const deviceId = els.builderDeviceId.value.trim();
  const schoolName = els.builderSchoolName.value.trim();
  const simulation = els.builderSimulation.checked;

  if (npsn) params.set('npsn', npsn);
  if (deviceId) params.set('device_id', deviceId);
  if (schoolName) params.set('school_name', schoolName);
  if (simulation) params.set('sim', '1');

  const url = `${baseUrl}${params.toString() ? `?${params.toString()}` : ''}`;
  els.checkoutPreview.textContent = url;
  els.checkoutPreview.href = url;
  return url;
}

function renderPublicMeta() {
  const config = state.publicConfig;
  if (!config) return;

  els.publicKeyLink.href = config.publicKeyUrl;
  els.publicKeyLink.textContent = config.publicKeyUrl;
  els.publicConfigMeta.innerHTML = `
    <div class="rounded-2xl border border-white/10 bg-white/5 p-4">
      <p class="text-xs uppercase tracking-[0.3em] text-stone-400">Paket Default</p>
      <p class="mt-2 text-lg font-semibold text-white">${escapeHtml(String(config.plan || 'full').toUpperCase())}</p>
    </div>
    <div class="rounded-2xl border border-white/10 bg-white/5 p-4">
      <p class="text-xs uppercase tracking-[0.3em] text-stone-400">Harga Checkout</p>
      <p class="mt-2 text-lg font-semibold text-white">${escapeHtml(config.priceLabel || formatCurrency(config.price, config.currency))}</p>
    </div>
    <div class="rounded-2xl border ${paymentModeTone(config.paymentMode)} p-4">
      <p class="text-xs uppercase tracking-[0.3em] opacity-80">Mode Pembayaran</p>
      <p class="mt-2 text-lg font-semibold">${escapeHtml(paymentModeLabel(config.paymentMode))}</p>
    </div>
  `;
}

function renderSetupGrid(config) {
  const items = [
    {
      label: 'Supabase API',
      ok: true,
      detail: 'Terhubung karena dashboard berhasil membaca data lisensi.'
    },
    {
      label: 'Admin Secret',
      ok: Boolean(config.adminSecretConfigured),
      detail: config.adminSecretConfigured ? 'Sudah diset di environment Vercel.' : 'Belum ada LICENSE_ADMIN_SECRET di environment.'
    },
    {
      label: 'Key Pair Lisensi',
      ok: Boolean(config.privateKeyReady && config.publicKeyReady),
      detail: config.privateKeyReady && config.publicKeyReady
        ? 'Private key dan public key siap untuk signing token.'
        : 'LICENSE_PRIVATE_KEY / LICENSE_PUBLIC_KEY belum lengkap.'
    },
    {
      label: 'Midtrans',
      ok: Boolean(config.midtransEnabled),
      detail: config.midtransEnabled
        ? `Server key aktif dalam mode ${paymentModeLabel(config.paymentMode)}.`
        : 'MIDTRANS_SERVER_KEY belum diisi. Checkout hanya bisa simulasi.'
    }
  ];

  els.setupGrid.innerHTML = items.map((item) => {
    const tone = item.ok
      ? 'border-emerald-400/20 bg-emerald-500/10 text-emerald-100'
      : 'border-amber-400/20 bg-amber-500/10 text-amber-100';
    const badge = item.ok ? 'SIAP' : 'PERLU DIISI';
    return `
      <div class="rounded-3xl border ${tone} p-4">
        <div class="flex items-center justify-between gap-3">
          <p class="text-sm font-semibold">${escapeHtml(item.label)}</p>
          <span class="rounded-full border border-current/20 px-3 py-1 text-[11px] font-bold tracking-[0.25em]">${badge}</span>
        </div>
        <p class="mt-3 text-sm opacity-90">${escapeHtml(item.detail)}</p>
      </div>
    `;
  }).join('');
}

function renderMetricCards(metrics, currency) {
  const cards = [
    {
      label: 'Total Lisensi',
      value: metrics.totalLicenses,
      accent: 'from-sky-400/20 to-sky-500/5',
      note: 'Lisensi yang tersimpan di Supabase'
    },
    {
      label: 'Aktivasi Hidup',
      value: metrics.activeActivations,
      accent: 'from-emerald-400/20 to-emerald-500/5',
      note: 'Perangkat client yang masih aktif'
    },
    {
      label: 'Order Pending',
      value: metrics.pendingOrders,
      accent: 'from-amber-400/20 to-amber-500/5',
      note: 'Menunggu pembayaran atau webhook'
    },
    {
      label: 'Omzet Tercatat',
      value: formatCurrency(metrics.revenue || 0, currency),
      accent: 'from-fuchsia-400/20 to-fuchsia-500/5',
      note: 'Akumulasi order sukses'
    }
  ];

  els.metricsGrid.innerHTML = cards.map((card) => `
    <article class="rounded-3xl border border-white/10 bg-gradient-to-br ${card.accent} p-5 shadow-lg shadow-stone-950/40">
      <p class="text-xs uppercase tracking-[0.3em] text-stone-400">${escapeHtml(card.label)}</p>
      <p class="mt-4 text-3xl font-semibold text-white">${escapeHtml(String(card.value))}</p>
      <p class="mt-2 text-sm text-stone-300">${escapeHtml(card.note)}</p>
    </article>
  `).join('');
}

function renderSystemInfo(config) {
  const paymentStatus = config.midtransEnabled
    ? `${paymentModeLabel(config.paymentMode)} aktif`
    : 'Belum aktif';

  els.systemInfo.innerHTML = `
    <div class="grid gap-4 lg:grid-cols-2">
      <div class="rounded-2xl border border-white/10 bg-white/5 p-4 lg:col-span-2">
        <p class="text-xs uppercase tracking-[0.3em] text-stone-400">Checkout</p>
        <a class="mt-2 block break-all text-sm text-sky-300 underline" href="${escapeHtml(config.checkoutPageUrl)}" target="_blank" rel="noreferrer">${escapeHtml(config.checkoutPageUrl)}</a>
      </div>
      <div class="rounded-2xl border border-white/10 bg-white/5 p-4">
        <p class="text-xs uppercase tracking-[0.3em] text-stone-400">Webhook Midtrans</p>
        <p class="mt-2 break-all text-sm text-stone-200">${escapeHtml(config.webhookUrl)}</p>
      </div>
      <div class="rounded-2xl border border-white/10 bg-white/5 p-4">
        <p class="text-xs uppercase tracking-[0.3em] text-stone-400">Public Key</p>
        <a class="mt-2 block break-all text-sm text-emerald-300 underline" href="${escapeHtml(config.publicKeyUrl)}" target="_blank" rel="noreferrer">${escapeHtml(config.publicKeyUrl)}</a>
      </div>
      <div class="rounded-2xl border border-white/10 bg-white/5 p-4">
        <p class="text-xs uppercase tracking-[0.3em] text-stone-400">Metode Admin</p>
        <p class="mt-2 text-sm text-white">${escapeHtml(config.authMode === 'secret' ? 'Admin secret dari browser ini' : 'Session user superadmin')}</p>
      </div>
      <div class="rounded-2xl border border-white/10 bg-white/5 p-4">
        <p class="text-xs uppercase tracking-[0.3em] text-stone-400">Status Midtrans</p>
        <p class="mt-2 text-sm text-white">${escapeHtml(paymentStatus)}</p>
      </div>
    </div>
  `;
}

function renderLicenseTable(rows) {
  if (!rows.length) {
    els.licenseTable.innerHTML = '<tr><td colspan="6" class="px-4 py-5 text-center text-stone-400">Belum ada lisensi yang tersimpan.</td></tr>';
    return;
  }

  els.licenseTable.innerHTML = rows.map((row) => `
    <tr class="border-b border-white/5">
      <td class="px-4 py-3 font-mono text-xs text-stone-200">${escapeHtml(row.npsn || '-')}</td>
      <td class="px-4 py-3">${escapeHtml(row.school_name || '-')}</td>
      <td class="px-4 py-3 uppercase text-stone-300">${escapeHtml(String(row.plan || 'full'))}</td>
      <td class="px-4 py-3">${escapeHtml(String(row.activation_limit || 1))}</td>
      <td class="px-4 py-3">${escapeHtml(row.status || 'active')}</td>
      <td class="px-4 py-3 text-stone-400">${escapeHtml(formatDate(row.updated_at))}</td>
    </tr>
  `).join('');
}

function renderOrderTable(rows, currency) {
  if (!rows.length) {
    els.orderTable.innerHTML = '<tr><td colspan="7" class="px-4 py-5 text-center text-stone-400">Belum ada order lisensi.</td></tr>';
    return;
  }

  els.orderTable.innerHTML = rows.map((row) => `
    <tr class="border-b border-white/5">
      <td class="px-4 py-3 font-mono text-xs text-stone-200">${escapeHtml(row.order_id)}</td>
      <td class="px-4 py-3">${escapeHtml(row.school_name || row.npsn || '-')}</td>
      <td class="px-4 py-3 font-mono text-xs text-stone-300">${escapeHtml(row.device_id || '-')}</td>
      <td class="px-4 py-3">${escapeHtml(formatCurrency(row.amount, row.currency || currency))}</td>
      <td class="px-4 py-3 uppercase text-stone-300">${escapeHtml(row.status || 'pending')}</td>
      <td class="px-4 py-3 text-stone-400">${escapeHtml(formatDate(row.updated_at))}</td>
      <td class="px-4 py-3">
        <a class="text-sky-300 underline" href="/checkout/complete?order_id=${encodeURIComponent(row.order_id)}" target="_blank" rel="noreferrer">Lihat</a>
      </td>
    </tr>
  `).join('');
}

function renderActivationTable(rows) {
  if (!rows.length) {
    els.activationTable.innerHTML = '<tr><td colspan="6" class="px-4 py-5 text-center text-stone-400">Belum ada aktivasi lisensi.</td></tr>';
    return;
  }

  els.activationTable.innerHTML = rows.map((row) => {
    const license = row.licenses || {};
    return `
      <tr class="border-b border-white/5">
        <td class="px-4 py-3">${escapeHtml(license.school_name || license.npsn || '-')}</td>
        <td class="px-4 py-3 font-mono text-xs text-stone-300">${escapeHtml(row.device_id || '-')}</td>
        <td class="px-4 py-3">${escapeHtml(row.device_label || '-')}</td>
        <td class="px-4 py-3 uppercase text-stone-300">${escapeHtml(row.status || 'active')}</td>
        <td class="px-4 py-3 text-stone-400">${escapeHtml(formatDate(row.activated_at))}</td>
        <td class="px-4 py-3">
          <button type="button" data-activation-id="${escapeHtml(row.id)}" class="deactivate-btn rounded-xl border border-rose-400/30 bg-rose-500/10 px-3 py-1 text-xs font-semibold text-rose-200 hover:bg-rose-500/20">
            Nonaktifkan
          </button>
        </td>
      </tr>
    `;
  }).join('');

  document.querySelectorAll('.deactivate-btn').forEach((button) => {
    button.addEventListener('click', async () => {
      const activationId = button.dataset.activationId;
      if (!activationId) return;
      if (!window.confirm('Nonaktifkan aktivasi ini dari dashboard lisensi?')) return;
      button.disabled = true;
      try {
        await apiFetch('/api/license/deactivate', {
          method: 'POST',
          body: JSON.stringify({ activation_id: activationId })
        });
        showFlash('Aktivasi berhasil dinonaktifkan.', 'success');
        await loadAdminDashboard();
      } catch (error) {
        showFlash(error.message, 'error');
      } finally {
        button.disabled = false;
      }
    });
  });
}

function renderIssueResult(result) {
  els.issueResult.innerHTML = `
    <div class="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-4 text-sm text-emerald-100">
      <p class="font-semibold">Lisensi berhasil diterbitkan.</p>
      <p class="mt-2">License ID: <span class="font-mono text-xs">${escapeHtml(result.license_id)}</span></p>
      <p>Activation ID: <span class="font-mono text-xs">${escapeHtml(result.activation_id)}</span></p>
      <textarea class="mt-3 min-h-[140px] w-full rounded-2xl border border-white/10 bg-stone-950/70 p-3 font-mono text-xs text-white">${escapeHtml(result.token)}</textarea>
      <div class="mt-3 flex flex-wrap gap-3">
        <button type="button" id="copyIssuedToken" class="rounded-2xl border border-emerald-300/30 bg-emerald-400/10 px-4 py-2 font-semibold text-emerald-100 hover:bg-emerald-400/20">Salin Token</button>
        <a class="rounded-2xl border border-sky-300/30 bg-sky-400/10 px-4 py-2 font-semibold text-sky-100 hover:bg-sky-400/20" href="${escapeHtml(result.checkout_url)}" target="_blank" rel="noreferrer">Buka Checkout</a>
      </div>
    </div>
  `;

  document.getElementById('copyIssuedToken')?.addEventListener('click', () => {
    copyText(result.token, 'Token lisensi berhasil disalin.').catch((error) => {
      showFlash(error.message, 'error');
    });
  });
}

async function handleIssueLicense(event) {
  event.preventDefault();
  const payload = {
    school_name: els.issueSchoolName.value.trim(),
    npsn: els.issueNpsn.value.trim(),
    device_id: els.issueDeviceId.value.trim(),
    plan: els.issuePlan.value,
    activation_limit: Number(els.issueActivationLimit.value || 1),
    note: els.issueNote.value.trim()
  };

  if (!payload.npsn || !payload.device_id) {
    showFlash('NPSN dan device ID wajib diisi untuk menerbitkan lisensi.', 'error');
    return;
  }

  const submitButton = els.issueForm.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  submitButton.textContent = 'Menerbitkan...';

  try {
    const result = await apiFetch('/api/admin/issue', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    renderIssueResult(result);
    showFlash('Lisensi manual berhasil diterbitkan.', 'success');
    await loadAdminDashboard();
  } catch (error) {
    showFlash(error.message, 'error');
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = 'Terbitkan Lisensi';
  }
}

async function loadAdminDashboard() {
  const data = await apiFetch('/api/admin/dashboard?limit=12');
  state.adminData = data;
  state.admin = data.admin || null;
  fillIdentity(state.admin);

  els.heroSubtitle.textContent = 'Semua checkout, webhook Midtrans, aktivasi device, dan penerbitan token berjalan online dari dashboard admin yang sama.';

  renderSetupGrid(data.config);
  renderMetricCards(data.metrics, data.config.currency);
  renderSystemInfo(data.config);
  renderLicenseTable(data.licenses || []);
  renderOrderTable(data.orders || [], data.config.currency);
  renderActivationTable(data.activations || []);
}

function showAccessDenied(message) {
  els.accessDenied.classList.remove('hidden');
  els.accessDenied.innerHTML = `
    <div class="rounded-3xl border border-rose-400/20 bg-rose-500/10 p-8 text-rose-100">
      <p class="text-xs uppercase tracking-[0.3em] text-rose-200/80">Akses Dibatasi</p>
      <h2 class="mt-3 text-2xl font-semibold">${escapeHtml(message)}</h2>
      <p class="mt-3 text-sm text-rose-100/80">Secret admin pada browser ini sudah tidak valid atau belum diisi.</p>
      <a class="mt-5 inline-flex rounded-2xl border border-white/10 bg-white/10 px-5 py-3 font-semibold text-white hover:bg-white/15" href="/admin">Kembali ke Login</a>
    </div>
  `;
}

function handleAuthFailure(error) {
  clearAdminSecret();
  els.userIdentity.innerHTML = '';
  showAccessDenied(error.message || 'Akses admin ditolak.');
}

async function init() {
  state.adminSecret = getAdminSecret();
  if (!state.adminSecret) {
    window.location.href = '/admin';
    return;
  }

  try {
    await loadPublicConfig();
    renderPublicMeta();
    buildCheckoutPreview();
  } catch (error) {
    showFlash(error.message, 'error');
  }

  try {
    await loadAdminDashboard();
  } catch (error) {
    if (error instanceof ApiError && [401, 403].includes(error.status)) {
      handleAuthFailure(error);
      return;
    }
    throw error;
  }
}

els.issueForm?.addEventListener('submit', handleIssueLicense);

els.checkoutBuilderForm?.addEventListener('input', () => {
  buildCheckoutPreview();
});

els.copyCheckoutBtn?.addEventListener('click', async () => {
  try {
    await copyText(buildCheckoutPreview(), 'Link checkout berhasil disalin.');
  } catch (error) {
    showFlash(error.message, 'error');
  }
});

els.openCheckoutBtn?.addEventListener('click', () => {
  window.open(buildCheckoutPreview(), '_blank', 'noopener,noreferrer');
});

els.refreshBtn?.addEventListener('click', async () => {
  try {
    await loadPublicConfig();
    renderPublicMeta();
    buildCheckoutPreview();
    await loadAdminDashboard();
    showFlash('Dashboard lisensi berhasil diperbarui.', 'success');
  } catch (error) {
    if (error instanceof ApiError && [401, 403].includes(error.status)) {
      handleAuthFailure(error);
      return;
    }
    showFlash(error.message || 'Dashboard gagal dimuat ulang.', 'error');
  }
});

els.logoutBtn?.addEventListener('click', () => {
  clearAdminSecret();
  window.location.href = '/admin';
});

init().catch((error) => {
  console.error(error);
  showFlash(error.message || 'Dashboard lisensi gagal dimuat.', 'error');
});
