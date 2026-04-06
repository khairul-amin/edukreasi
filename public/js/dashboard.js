import { getBrowserSupabase } from './supabase-browser.js';

const els = {
  heroSubtitle: document.getElementById('heroSubtitle'),
  dashboardHeader: document.getElementById('dashboardHeader'),
  dashboardContent: document.getElementById('dashboardContent'),
  updatedAtLabel: document.getElementById('updatedAtLabel'),
  userIdentity: document.getElementById('userIdentity'),
  refreshBtn: document.getElementById('refreshBtn'),
  logoutBtn: document.getElementById('logoutBtn'),
  flash: document.getElementById('flash'),
  accessDenied: document.getElementById('accessDenied'),
  publicKeyLink: document.getElementById('publicKeyLink'),
  publicConfigMeta: document.getElementById('publicConfigMeta'),
  setupGrid: document.getElementById('setupGrid'),
  metricsGrid: document.getElementById('metricsGrid'),
  licenseConfigForm: document.getElementById('licenseConfigForm'),
  checkoutPriceInput: document.getElementById('checkoutPriceInput'),
  saveLicenseConfigBtn: document.getElementById('saveLicenseConfigBtn'),
  licenseConfigMeta: document.getElementById('licenseConfigMeta'),
  studentApkPublicUrl: document.getElementById('studentApkPublicUrl'),
  studentApkUploadForm: document.getElementById('studentApkUploadForm'),
  studentApkFile: document.getElementById('studentApkFile'),
  studentApkUploadBtn: document.getElementById('studentApkUploadBtn'),
  studentApkAlternativeUrl: document.getElementById('studentApkAlternativeUrl'),
  studentApkAlternativeForm: document.getElementById('studentApkAlternativeForm'),
  studentApkAlternativeInput: document.getElementById('studentApkAlternativeInput'),
  studentApkAlternativeSaveBtn: document.getElementById('studentApkAlternativeSaveBtn'),
  adminExePublicUrl: document.getElementById('adminExePublicUrl'),
  adminExeUploadForm: document.getElementById('adminExeUploadForm'),
  adminExeFile: document.getElementById('adminExeFile'),
  adminExeUploadBtn: document.getElementById('adminExeUploadBtn'),
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
  orderSortSelect: document.getElementById('orderSortSelect'),
  deleteOrdersBtn: document.getElementById('deleteOrdersBtn'),
  selectAllOrders: document.getElementById('selectAllOrders'),
  ordersSummary: document.getElementById('ordersSummary'),
  licenseTable: document.getElementById('licenseTable'),
  orderTable: document.getElementById('orderTable'),
  activationTable: document.getElementById('activationTable')
};

const state = {
  supabase: null,
  session: null,
  admin: null,
  publicConfig: null,
  adminData: null,
  lastLoadedAt: null,
  orderSort: 'recent_desc',
  selectedOrders: new Set(),
  snapLoader: null
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
  if (!els.flash) return;

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

function formatRelative(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';

  const diffMs = date.getTime() - Date.now();
  const rtf = new Intl.RelativeTimeFormat('id-ID', { numeric: 'auto' });
  const minutes = Math.round(diffMs / 60000);

  if (Math.abs(minutes) < 60) {
    return rtf.format(minutes, 'minute');
  }

  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) {
    return rtf.format(hours, 'hour');
  }

  const days = Math.round(hours / 24);
  return rtf.format(days, 'day');
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

function formatNumber(value) {
  return Number(value || 0).toLocaleString('id-ID');
}

function nowMs() {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now();
  }
  return Date.now();
}

function formatDurationMs(value) {
  const ms = Number(value || 0);
  if (!Number.isFinite(ms) || ms <= 0) return '0 ms';
  if (ms < 1000) return `${Math.round(ms)} ms`;

  const seconds = ms / 1000;
  if (seconds < 60) {
    return `${seconds.toFixed(seconds >= 10 ? 1 : 2)} detik`;
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes} menit ${remainingSeconds.toFixed(1)} detik`;
}

function formatBytes(value) {
  const bytes = Number(value || 0);
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';

  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  const digits = size >= 100 || unitIndex === 0 ? 0 : size >= 10 ? 1 : 2;
  return `${size.toFixed(digits)} ${units[unitIndex]}`;
}

function humanizeStatus(value) {
  const text = String(value || '').trim().replace(/_/g, ' ');
  if (!text) return '-';
  return text.replace(/\b\w/g, (char) => char.toUpperCase());
}

function badgeClasses(kind, value) {
  const status = String(value || '').toLowerCase();

  if (kind === 'payment') {
    if (['paid', 'settlement', 'capture'].includes(status)) {
      return 'border-emerald-400/30 bg-emerald-500/10 text-emerald-100';
    }
    if (['pending', 'waiting_payment'].includes(status)) {
      return 'border-amber-400/30 bg-amber-500/10 text-amber-100';
    }
    if (['simulation'].includes(status)) {
      return 'border-sky-400/30 bg-sky-500/10 text-sky-100';
    }
    if (['cancel', 'deny', 'expire', 'error', 'failure'].includes(status)) {
      return 'border-rose-400/30 bg-rose-500/10 text-rose-100';
    }
  }

  if (kind === 'license') {
    if (status === 'active') {
      return 'border-emerald-400/30 bg-emerald-500/10 text-emerald-100';
    }
    if (status === 'suspended') {
      return 'border-amber-400/30 bg-amber-500/10 text-amber-100';
    }
    if (status === 'inactive') {
      return 'border-stone-400/30 bg-stone-500/10 text-stone-200';
    }
  }

  if (kind === 'activation') {
    if (status === 'active') {
      return 'border-teal-400/30 bg-teal-500/10 text-teal-100';
    }
    if (status === 'inactive') {
      return 'border-rose-400/30 bg-rose-500/10 text-rose-100';
    }
  }

  return 'border-white/15 bg-white/5 text-stone-200';
}

function renderBadge(value, kind = 'general') {
  return `<span class="inline-flex rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] ${badgeClasses(kind, value)}">${escapeHtml(humanizeStatus(value))}</span>`;
}

function setUpdatedAtLabel() {
  if (!els.updatedAtLabel) return;
  if (!state.lastLoadedAt) {
    els.updatedAtLabel.textContent = 'Menunggu sinkron data...';
    return;
  }

  els.updatedAtLabel.textContent = `Terakhir disegarkan ${formatDate(state.lastLoadedAt)} (${formatRelative(state.lastLoadedAt)})`;
}

function fillIdentity(admin) {
  const label = admin?.name || admin?.email || 'Superadmin';
  const email = admin?.email || 'Akun admin';
  const initials = label
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'SA';

  els.userIdentity.innerHTML = `
    <div class="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-left">
      <div class="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-300 to-sky-400 font-display text-sm font-bold text-slate-950">${escapeHtml(initials)}</div>
      <div>
        <div class="text-sm font-semibold text-white">${escapeHtml(label)}</div>
        <div class="text-xs uppercase tracking-[0.28em] text-stone-400">${escapeHtml(admin?.role || 'superadmin')}</div>
        <div class="mt-1 text-xs text-stone-500">${escapeHtml(email)}</div>
      </div>
    </div>
  `;
}

async function apiFetch(path, options = {}) {
  const headers = new Headers(options.headers || {});
  const accessToken = state.session?.access_token;

  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }

  if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json');
  }

  const method = String(options.method || 'GET').toUpperCase();
  const response = await fetch(path, {
    ...options,
    cache: options.cache || (method === 'GET' ? 'no-store' : undefined),
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

function isValidNpsn(value) {
  return /^[0-9]{8}$/.test(String(value || '').trim());
}

function buildCheckoutPreview() {
  const baseUrl = state.publicConfig?.checkoutPageUrl || `${window.location.origin}/checkout`;
  const params = new URLSearchParams();
  const npsn = els.builderNpsn?.value.trim() || '';
  const deviceId = els.builderDeviceId?.value.trim() || '';
  const schoolName = els.builderSchoolName?.value.trim() || '';
  const simulation = Boolean(els.builderSimulation?.checked);

  if (npsn) params.set('npsn', npsn);
  if (deviceId) params.set('device_id', deviceId);
  if (schoolName) params.set('school_name', schoolName);
  if (simulation) params.set('sim', '1');

  const url = `${baseUrl}${params.toString() ? `?${params.toString()}` : ''}`;
  if (els.checkoutPreview) {
    els.checkoutPreview.textContent = url;
    els.checkoutPreview.href = url;
  }
  return url;
}

function buildCheckoutPayload() {
  return {
    npsn: els.builderNpsn?.value.trim() || '',
    school_name: els.builderSchoolName?.value.trim() || '',
    device_id: els.builderDeviceId?.value.trim() || '',
    sim: els.builderSimulation?.checked ? '1' : '0'
  };
}

function openOrderStatus(orderId) {
  if (!orderId) return;
  const url = new URL('/checkout/complete', window.location.origin);
  url.searchParams.set('order_id', orderId);
  window.open(url.toString(), '_blank', 'noopener,noreferrer');
}

function loadMidtransSnap(config) {
  if (!config?.paymentEnabled || !config.paymentClientKey || !config.paymentScriptUrl) {
    return Promise.resolve(false);
  }

  if (window.snap) {
    return Promise.resolve(true);
  }

  if (state.snapLoader) {
    return state.snapLoader;
  }

  state.snapLoader = new Promise((resolve, reject) => {
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

  return state.snapLoader;
}

function openDashboardSnapPopup(order) {
  if (!window.snap || !order?.snap_token) {
    if (order?.redirect_url) {
      window.open(order.redirect_url, '_blank', 'noopener,noreferrer');
    }
    return;
  }

  showFlash('Popup pembayaran Midtrans sedang dibuka.', 'info');
  window.snap.pay(order.snap_token, {
    onSuccess: async () => {
      showFlash('Pembayaran berhasil. Status order dibuka di tab baru.', 'success');
      openOrderStatus(order.order_id);
      await loadAdminDashboard().catch(() => {});
    },
    onPending: async () => {
      showFlash('Pembayaran sedang menunggu penyelesaian. Status order dibuka di tab baru.', 'info');
      openOrderStatus(order.order_id);
      await loadAdminDashboard().catch(() => {});
    },
    onError: (result) => {
      console.error('Midtrans error', result);
      showFlash('Pembayaran gagal diproses Midtrans. Silakan coba lagi.', 'error');
    },
    onClose: async () => {
      showFlash('Popup pembayaran ditutup. Anda bisa membuka pembayaran lagi kapan saja.', 'info');
      await loadAdminDashboard().catch(() => {});
    }
  });
}
function renderPublicMeta() {
  const config = state.publicConfig;
  if (!config || !els.publicConfigMeta) return;

  const items = [
    {
      label: 'Harga Checkout',
      value: config.priceLabel || formatCurrency(config.price, config.currency),
      detail: config.priceSource === 'database'
        ? 'Nominal aktif dikelola dari dashboard admin'
        : 'Nominal aktif masih memakai fallback env server',
      tone: 'border-white/10 bg-white/5 text-white'
    },
    {
      label: 'Plan Default',
      value: String(config.plan || 'full').toUpperCase(),
      detail: `Batas aktivasi default ${formatNumber(config.activationLimit)} device`,
      tone: 'border-white/10 bg-white/5 text-white'
    },
    {
      label: 'Mode Pembayaran',
      value: config.paymentEnabled ? `Midtrans ${paymentModeLabel(config.paymentMode)}` : 'Simulasi Internal',
      detail: config.paymentEnabled ? 'Snap siap dibuka dari halaman checkout' : 'Lengkapi env Midtrans untuk popup checkout',
      tone: config.paymentEnabled
        ? 'border-teal-400/20 bg-teal-500/10 text-teal-100'
        : 'border-amber-400/20 bg-amber-500/10 text-amber-100'
    },
    {
      label: 'Public Base URL',
      value: config.publicBaseUrl || window.location.origin,
      detail: 'Domain dasar yang dipakai checkout dan webhook',
      tone: 'border-sky-400/20 bg-sky-500/10 text-sky-100'
    }
  ];

  if (els.publicKeyLink) {
    els.publicKeyLink.href = config.publicKeyUrl;
    els.publicKeyLink.textContent = config.publicKeyUrl;
  }
  els.publicConfigMeta.innerHTML = items.map((item) => `
    <article class="rounded-[1.6rem] border p-4 ${item.tone}">
      <p class="text-xs uppercase tracking-[0.3em] opacity-75">${escapeHtml(item.label)}</p>
      <p class="mt-3 break-words font-display text-xl font-bold leading-tight">${escapeHtml(item.value)}</p>
      <p class="mt-2 text-sm leading-6 opacity-85">${escapeHtml(item.detail)}</p>
    </article>
  `).join('');
}

function renderLicenseConfigPanel(config) {
  if (!config || !els.checkoutPriceInput) return;

  els.checkoutPriceInput.value = Number(config.price || 0) > 0 ? String(Number(config.price || 0)) : '';
  if (config.studentAlternativeDownloadUrl) {
    renderStudentAlternativeLink(config.studentAlternativeDownloadUrl);
  }
}

async function loadAppDownloads() {
  const response = await fetch('/api/app-downloads', { cache: 'no-store' });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.success) {
    throw new Error(data?.message || 'Gagal memuat link download aplikasi.');
  }
  return data.downloads || {};
}

function renderAppDownloads(downloads) {
  const student = downloads?.student_apk;
  if (els.studentApkPublicUrl) {
    if (student?.url) {
      els.studentApkPublicUrl.href = student.url;
      els.studentApkPublicUrl.textContent = student.url;
    } else {
      els.studentApkPublicUrl.href = '#';
      els.studentApkPublicUrl.textContent = 'Belum ada file APK. Silakan upload.';
    }
  }

  renderStudentAlternativeLink(student?.alternativeUrl || '');

  const admin = downloads?.admin_exe;
  if (els.adminExePublicUrl) {
    if (admin?.url) {
      els.adminExePublicUrl.href = admin.url;
      els.adminExePublicUrl.textContent = admin.url;
    } else {
      els.adminExePublicUrl.href = '#';
      els.adminExePublicUrl.textContent = 'Belum ada paket admin. Silakan upload.';
    }
  }
}

function renderStudentAlternativeLink(url) {
  const studentAlternativeUrl = String(url || '').trim();

  if (els.studentApkAlternativeUrl) {
    if (studentAlternativeUrl) {
      els.studentApkAlternativeUrl.href = studentAlternativeUrl;
      els.studentApkAlternativeUrl.textContent = studentAlternativeUrl;
      els.studentApkAlternativeUrl.classList.remove('opacity-60', 'pointer-events-none');
    } else {
      els.studentApkAlternativeUrl.href = '#';
      els.studentApkAlternativeUrl.textContent = 'Belum ada link alternatif. Isi dari dashboard jika diperlukan.';
      els.studentApkAlternativeUrl.classList.add('opacity-60', 'pointer-events-none');
    }
  }

  if (els.studentApkAlternativeInput && document.activeElement !== els.studentApkAlternativeInput) {
    els.studentApkAlternativeInput.value = studentAlternativeUrl;
  }
}

function normalizeDashboardOptionalUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';

  const candidate = /^[a-z]+:\/\//i.test(raw) ? raw : `https://${raw}`;

  try {
    const normalized = new URL(candidate);
    if (!['http:', 'https:'].includes(normalized.protocol)) {
      throw new Error('protocol');
    }
    return normalized.toString();
  } catch {
    throw new Error('Link alternatif harus berupa URL yang valid, misalnya https://github.com/.../file.apk');
  }
}

async function handleStudentAlternativeLinkSubmit(event) {
  event.preventDefault();

  const submitBtn = els.studentApkAlternativeSaveBtn;
  const originalLabel = submitBtn?.textContent || 'Simpan Link Alternatif';
  let url = '';

  try {
    url = normalizeDashboardOptionalUrl(els.studentApkAlternativeInput?.value || '');
  } catch (error) {
    showFlash(error.message, 'error');
    return;
  }

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Menyimpan...';
  }

  try {
    const result = await apiFetch('/api/admin/license-config', {
      method: 'PUT',
      body: JSON.stringify({
        studentAlternativeDownloadUrl: url
      })
    });
    const savedUrl = String(result?.config?.studentAlternativeDownloadUrl || '').trim();

    if (url && !savedUrl) {
      throw new Error('Link belum tersimpan di database. Jalankan update SQL `supabase/license-settings.sql` di Supabase, lalu coba simpan lagi.');
    }

    const downloads = await loadAppDownloads();
    const publicUrl = String(downloads?.student_apk?.alternativeUrl || '').trim();

    if (savedUrl && !publicUrl) {
      renderStudentAlternativeLink(savedUrl);
      showFlash('Link tersimpan di pengaturan admin, tetapi API publik belum mengembalikannya. Refresh sekali. Jika tetap kosong, jalankan SQL update di Supabase.', 'info');
      return;
    }

    renderAppDownloads(downloads);
    showFlash(result.message || 'Link alternatif siswa berhasil diperbarui.', 'success');
  } catch (error) {
    showFlash(error.message || 'Link alternatif siswa gagal disimpan.', 'error');
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = originalLabel;
    }
  }
}

function resolveUploadContentType(file, fallback) {
  const value = String(file?.type || '').trim();
  return value || fallback || 'application/octet-stream';
}

function uploadToSignedUrl(signedUrl, file, { method = 'PUT', headers = {}, onProgress } = {}) {
  return new Promise((resolve, reject) => {
    if (!signedUrl) {
      reject(new Error('Signed URL tidak tersedia. Silakan refresh dan coba lagi.'));
      return;
    }

    const xhr = new XMLHttpRequest();
    xhr.open(method, signedUrl, true);

    // Signed upload URL does not require auth headers.
    Object.entries(headers || {}).forEach(([key, value]) => {
      if (!key) return;
      if (value === undefined || value === null || value === '') return;
      try {
        xhr.setRequestHeader(key, String(value));
      } catch {
        // ignore invalid headers
      }
    });

    xhr.upload.onprogress = (event) => {
      if (!onProgress) return;
      if (!event || !event.lengthComputable) return;
      onProgress(event.loaded, event.total);
    };

    xhr.onerror = () => {
      reject(new Error('Upload gagal (koneksi/CORS). Pastikan CORS R2 mengizinkan domain kamu.'));
    };

    xhr.onabort = () => {
      reject(new Error('Upload dibatalkan.'));
    };

    xhr.onload = () => {
      const ok = xhr.status >= 200 && xhr.status < 300;
      if (!ok) {
        const hint = xhr.status ? ` (HTTP ${xhr.status})` : '';
        const body = String(xhr.responseText || '').trim();
        const detail = body ? ` ${body.slice(0, 300)}` : '';
        reject(new Error(`Upload gagal${hint}.${detail}`));
        return;
      }

      resolve(true);
    };

    xhr.send(file);
  });
}

async function handleAppUpload(platform, fileInput, button, defaultContentType) {
  const file = fileInput?.files?.[0];
  if (!file) {
    showFlash('Silakan pilih file terlebih dahulu.', 'error');
    return;
  }

  const submitBtn = button;
  const originalLabel = submitBtn?.textContent || 'Upload';
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Mengunggah...';
  }

  const totalStartMs = nowMs();
  const uploadLabel = `[upload:${platform}]`;
  console.info(`${uploadLabel} Mulai upload`, {
    fileName: file.name,
    fileSize: formatBytes(file.size),
    contentType: file.type || defaultContentType || 'application/octet-stream'
  });

  try {
    const contentType = resolveUploadContentType(file, defaultContentType);
    const signedUrlStartMs = nowMs();
    const uploadConfig = await apiFetch('/api/admin/app-downloads/upload-url', {
      method: 'POST',
      body: JSON.stringify({
        platform,
        fileName: file.name,
        contentType
      })
    });
    const signedUrlElapsedMs = nowMs() - signedUrlStartMs;

    console.info(`${uploadLabel} Signed URL siap`, {
      path: uploadConfig.path,
      publicUrl: uploadConfig.publicUrl,
      elapsed: formatDurationMs(signedUrlElapsedMs)
    });

    const transferStartMs = nowMs();
    let nextProgressLog = 25;

    await uploadToSignedUrl(uploadConfig.signedUrl, file, {
      method: uploadConfig.method || 'PUT',
      headers: uploadConfig.headers || { 'content-type': contentType },
      onProgress: (loaded, total) => {
        if (!submitBtn) return;
        const pct = total > 0 ? Math.min(100, Math.round((loaded / total) * 100)) : 0;
        submitBtn.textContent = `Mengunggah... ${pct}%`;

        if (pct >= nextProgressLog) {
          console.info(`${uploadLabel} Progres ${pct}%`, {
            uploaded: formatBytes(loaded),
            total: formatBytes(total),
            elapsed: formatDurationMs(nowMs() - transferStartMs)
          });
          while (nextProgressLog <= pct) {
            nextProgressLog += 25;
          }
        }
      }
    });

    const transferElapsedMs = nowMs() - transferStartMs;
    const totalElapsedMs = nowMs() - totalStartMs;

    console.info(`${uploadLabel} Upload selesai`, {
      fileName: file.name,
      fileSize: formatBytes(file.size),
      signedUrlDuration: formatDurationMs(signedUrlElapsedMs),
      transferDuration: formatDurationMs(transferElapsedMs),
      totalDuration: formatDurationMs(totalElapsedMs),
      publicUrl: uploadConfig.publicUrl
    });

    showFlash('Upload berhasil. Link download publik sudah siap dipakai.', 'success');
    if (fileInput) {
      fileInput.value = '';
    }

    try {
      const downloads = await loadAppDownloads();
      renderAppDownloads(downloads);
    } catch {
      // ignore
    }
  } catch (error) {
    console.error(`${uploadLabel} Upload gagal`, {
      fileName: file.name,
      fileSize: formatBytes(file.size),
      elapsed: formatDurationMs(nowMs() - totalStartMs),
      message: error.message || 'Upload file gagal diproses.'
    });
    showFlash(error.message || 'Upload file gagal diproses.', 'error');
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = originalLabel;
    }
  }
}

function renderSetupGrid(config) {
  if (!els.setupGrid) return;

  const paymentPopupReady = Boolean(state.publicConfig?.paymentEnabled);
  const items = [
    {
      label: 'Google Auth Superadmin',
      ok: config.authMode === 'user',
      detail: config.authMode === 'user'
        ? 'Akun login lolos validasi di tabel users dengan role superadmin.'
        : 'Akun aktif belum dikenali sebagai superadmin.'
    },
    {
      label: 'Key Pair Lisensi',
      ok: Boolean(config.privateKeyReady && config.publicKeyReady),
      detail: config.privateKeyReady && config.publicKeyReady
        ? 'Server sudah bisa sign token dan client bisa verifikasi public key.'
        : 'LICENSE_PRIVATE_KEY atau LICENSE_PUBLIC_KEY belum lengkap.'
    },
    {
      label: 'Supabase Server',
      ok: true,
      detail: 'Dashboard berhasil membaca lisensi, order, dan aktivasi dari Supabase.'
    },
    {
      label: 'Midtrans Snap',
      ok: paymentPopupReady,
      detail: paymentPopupReady
        ? `Popup checkout aktif dalam mode ${paymentModeLabel(config.paymentMode)}.`
        : 'MIDTRANS_SERVER_KEY atau MIDTRANS_CLIENT_KEY belum lengkap di Vercel.'
    }
  ];

  els.setupGrid.innerHTML = items.map((item) => {
    const tone = item.ok
      ? 'border-emerald-400/20 bg-emerald-500/10 text-emerald-100'
      : 'border-amber-400/20 bg-amber-500/10 text-amber-100';

    return `
      <article class="rounded-[1.6rem] border p-4 ${tone}">
        <div class="flex items-start justify-between gap-3">
          <div>
            <p class="text-sm font-semibold">${escapeHtml(item.label)}</p>
            <p class="mt-2 text-sm leading-6 opacity-90">${escapeHtml(item.detail)}</p>
          </div>
          <span class="mt-1 inline-flex h-3 w-3 shrink-0 rounded-full ${item.ok ? 'bg-emerald-300' : 'bg-amber-300'}"></span>
        </div>
      </article>
    `;
  }).join('');
}

function renderMetricCards(metrics, currency) {
  if (!els.metricsGrid) return;

  const cards = [
    {
      label: 'Total Lisensi',
      value: formatNumber(metrics.totalLicenses),
      note: 'Semua lisensi yang tersimpan di registry',
      accent: 'from-teal-400/20 via-teal-400/5 to-transparent'
    },
    {
      label: 'Device Aktif',
      value: formatNumber(metrics.activeActivations),
      note: 'Perangkat client yang saat ini masih aktif',
      accent: 'from-sky-400/20 via-sky-400/5 to-transparent'
    },
    {
      label: 'Order Sukses',
      value: formatNumber(metrics.successfulOrders),
      note: `Pending saat ini: ${formatNumber(metrics.pendingOrders)}`,
      accent: 'from-amber-400/20 via-amber-400/5 to-transparent'
    },
    {
      label: 'Omzet Tercatat',
      value: formatCurrency(metrics.revenue || 0, currency),
      note: 'Akumulasi order berstatus paid / settlement / capture',
      accent: 'from-cyan-400/20 via-cyan-400/5 to-transparent'
    }
  ];

  els.metricsGrid.innerHTML = cards.map((card) => `
    <article class="rounded-[1.7rem] border border-white/10 bg-gradient-to-br ${card.accent} p-5 backdrop-blur-xl">
      <p class="text-xs font-semibold uppercase tracking-[0.3em] text-stone-400">${escapeHtml(card.label)}</p>
      <p class="mt-4 font-display text-3xl font-bold text-white">${escapeHtml(card.value)}</p>
      <p class="mt-3 text-sm leading-6 text-stone-300">${escapeHtml(card.note)}</p>
    </article>
  `).join('');
}

function renderSystemInfo(config) {
  if (!els.systemInfo) return;

  const items = [
    {
      label: 'Checkout Publik',
      value: config.checkoutPageUrl,
      href: config.checkoutPageUrl,
      copy: config.checkoutPageUrl,
      caption: 'Link ini bisa Anda kirim langsung ke sekolah.'
    },
    {
      label: 'Webhook Midtrans',
      value: config.webhookUrl,
      copy: config.webhookUrl,
      caption: 'Masukkan ke Notification URL di dashboard Midtrans.'
    },
    {
      label: 'Public Key',
      value: config.publicKeyUrl,
      href: config.publicKeyUrl,
      copy: config.publicKeyUrl,
      caption: 'Dipakai client untuk verifikasi token lisensi.'
    },
    {
      label: 'Info Payment',
      value: config.midtransMerchantId
        ? `Merchant ${config.midtransMerchantId} - ${paymentModeLabel(config.paymentMode)}`
        : `Midtrans ${paymentModeLabel(config.paymentMode)}`,
      copy: config.midtransMerchantId || '',
      caption: 'Ringkasan koneksi payment yang aktif di server.'
    }
  ];

  els.systemInfo.innerHTML = items.map((item) => `
    <article class="rounded-[1.5rem] border border-white/10 bg-black/20 p-4">
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0 flex-1">
          <p class="text-xs uppercase tracking-[0.28em] text-stone-500">${escapeHtml(item.label)}</p>
          ${item.href
            ? `<a class="mt-3 block break-all text-sm leading-6 text-teal-200 underline decoration-teal-300/35 underline-offset-4" href="${escapeHtml(item.href)}" target="_blank" rel="noreferrer">${escapeHtml(item.value)}</a>`
            : `<p class="mt-3 break-all text-sm leading-6 text-stone-100">${escapeHtml(item.value)}</p>`}
          <p class="mt-2 text-sm leading-6 text-stone-400">${escapeHtml(item.caption)}</p>
        </div>
        ${item.copy ? `<button type="button" data-copy-text="${escapeHtml(item.copy)}" data-copy-label="${escapeHtml(item.label)}" class="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-white transition hover:bg-white/10">Salin</button>` : ''}
      </div>
    </article>
  `).join('');
}

function renderEmptyRow(colspan, message) {
  return `<tr><td colspan="${colspan}" class="px-5 py-8 text-center text-stone-400">${escapeHtml(message)}</td></tr>`;
}
function sortOrders(rows) {
  const cloned = [...rows];
  const getTime = (row) => new Date(row.paid_at || row.updated_at || row.created_at || 0).getTime();

  switch (state.orderSort) {
    case 'recent_asc':
      return cloned.sort((a, b) => getTime(a) - getTime(b));
    case 'amount_desc':
      return cloned.sort((a, b) => Number(b.amount || 0) - Number(a.amount || 0));
    case 'amount_asc':
      return cloned.sort((a, b) => Number(a.amount || 0) - Number(b.amount || 0));
    case 'status_asc':
      return cloned.sort((a, b) => String(a.status || '').localeCompare(String(b.status || '')));
    case 'recent_desc':
    default:
      return cloned.sort((a, b) => getTime(b) - getTime(a));
  }
}

function syncOrderSelectionState(totalRows = (state.adminData?.orders || []).length) {
  const selectedCount = state.selectedOrders.size;

  if (els.ordersSummary) {
    els.ordersSummary.textContent = selectedCount
      ? `${selectedCount} order dipilih dari ${totalRows} data. Anda bisa hapus semuanya sekaligus.`
      : `Menampilkan ${totalRows} order. Gunakan ceklis untuk memilih data yang ingin dihapus.`;
  }

  if (els.deleteOrdersBtn) {
    els.deleteOrdersBtn.disabled = selectedCount === 0;
    els.deleteOrdersBtn.textContent = selectedCount ? `Hapus Terpilih (${selectedCount})` : 'Hapus Terpilih';
  }

  if (els.selectAllOrders) {
    els.selectAllOrders.checked = totalRows > 0 && selectedCount === totalRows;
    els.selectAllOrders.indeterminate = selectedCount > 0 && selectedCount < totalRows;
  }
}

async function handleDeleteSelectedOrders() {
  const orderIds = [...state.selectedOrders];
  if (!orderIds.length) {
    showFlash('Pilih minimal satu order untuk dihapus.', 'error');
    return;
  }

  const confirmed = window.confirm(`Hapus ${orderIds.length} order yang dipilih? Tindakan ini tidak bisa dibatalkan.`);
  if (!confirmed) return;

  els.deleteOrdersBtn.disabled = true;
  const originalLabel = els.deleteOrdersBtn.textContent;
  els.deleteOrdersBtn.textContent = 'Menghapus...';

  try {
    const result = await apiFetch('/api/admin/orders', {
      method: 'DELETE',
      body: JSON.stringify({ order_ids: orderIds })
    });
    state.selectedOrders.clear();
    showFlash(result.message || 'Order berhasil dihapus.', 'success');
    await loadAdminDashboard();
  } catch (error) {
    showFlash(error.message || 'Gagal menghapus order.', 'error');
  } finally {
    els.deleteOrdersBtn.disabled = false;
    els.deleteOrdersBtn.textContent = originalLabel;
  }
}
function renderLicenseTable(rows) {
  if (!rows.length) {
    els.licenseTable.innerHTML = renderEmptyRow(3, 'Belum ada lisensi yang tersimpan.');
    return;
  }

  els.licenseTable.innerHTML = rows.map((row) => `
    <tr class="border-b border-white/5 align-top last:border-b-0">
      <td class="px-5 py-4">
        <div class="font-semibold text-white">${escapeHtml(row.school_name || 'Nama sekolah belum diisi')}</div>
        <div class="mt-2 font-mono text-xs text-stone-400">${escapeHtml(row.npsn || '-')}</div>
      </td>
      <td class="px-5 py-4">
        <div class="flex flex-wrap gap-2">${renderBadge(row.plan || 'full', 'license')}</div>
        <div class="mt-3 text-sm text-stone-300">Batas aktivasi: ${escapeHtml(String(row.activation_limit || 1))} device</div>
        <div class="mt-2 text-sm leading-6 text-stone-400">${escapeHtml(row.note || 'Tanpa catatan internal.')}</div>
      </td>
      <td class="px-5 py-4">
        ${renderBadge(row.status || 'active', 'license')}
        <div class="mt-3 text-sm text-stone-300">Update: ${escapeHtml(formatDate(row.updated_at))}</div>
        <div class="mt-1 text-xs text-stone-500">${escapeHtml(formatRelative(row.updated_at))}</div>
      </td>
    </tr>
  `).join('');
}

function renderOrderTable(rows, currency) {
  const orderedRows = sortOrders(rows);
  const validIds = new Set(orderedRows.map((row) => row.order_id));
  state.selectedOrders = new Set([...state.selectedOrders].filter((id) => validIds.has(id)));

  if (!orderedRows.length) {
    els.orderTable.innerHTML = renderEmptyRow(5, 'Belum ada order lisensi.');
    syncOrderSelectionState(0);
    return;
  }

  els.orderTable.innerHTML = orderedRows.map((row) => {
    const provider = [row.payment_provider, row.payment_type].filter(Boolean).join(' / ') || 'midtrans';
    const paidOrUpdated = row.paid_at || row.updated_at || row.created_at;
    const checked = state.selectedOrders.has(row.order_id) ? 'checked' : '';

    return `
      <tr class="border-b border-white/5 align-top last:border-b-0">
        <td class="px-5 py-4">
          <input type="checkbox" data-order-id="${escapeHtml(row.order_id)}" class="order-select h-4 w-4 rounded border-white/20 bg-stone-900 text-teal-300 focus:ring-teal-300" ${checked} />
        </td>
        <td class="px-5 py-4">
          <div class="font-mono text-xs text-stone-200">${escapeHtml(row.order_id)}</div>
          <div class="mt-2 font-semibold text-white">${escapeHtml(row.school_name || row.npsn || 'Sekolah belum diisi')}</div>
          <div class="mt-1 font-mono text-xs text-stone-500">Device: ${escapeHtml(row.device_id || '-')}</div>
        </td>
        <td class="px-5 py-4">
          <div class="font-display text-xl font-bold text-white">${escapeHtml(formatCurrency(row.amount, row.currency || currency))}</div>
          <div class="mt-2 text-sm text-stone-300">${escapeHtml(provider)}</div>
          <div class="mt-1 text-xs text-stone-500">${escapeHtml(formatDate(row.created_at))}</div>
        </td>
        <td class="px-5 py-4">
          ${renderBadge(row.status || 'pending', 'payment')}
          <div class="mt-3 text-sm text-stone-300">${row.paid_at ? 'Lunas pada' : 'Update terakhir'}: ${escapeHtml(formatDate(paidOrUpdated))}</div>
          <div class="mt-1 text-xs text-stone-500">${escapeHtml(formatRelative(paidOrUpdated))}</div>
        </td>
        <td class="px-5 py-4">
          <div class="flex flex-wrap gap-2">
            <a class="rounded-xl border border-sky-300/20 bg-sky-500/10 px-3 py-2 text-xs font-semibold text-sky-100 transition hover:bg-sky-500/20" href="/checkout/complete?order_id=${encodeURIComponent(row.order_id)}" target="_blank" rel="noreferrer">Lihat Status</a>
            <button type="button" data-copy-text="${escapeHtml(row.order_id)}" data-copy-label="Order ID" class="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-white transition hover:bg-white/10">Salin ID</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  syncOrderSelectionState(orderedRows.length);
}

function bindDeactivateButtons() {
  document.querySelectorAll('.deactivate-btn').forEach((button) => {
    button.addEventListener('click', async () => {
      const activationId = button.dataset.activationId;
      if (!activationId) return;
      if (!window.confirm('Nonaktifkan aktivasi device ini? Registry lisensi akan tetap aktif.')) return;
      button.disabled = true;
      try {
        const result = await apiFetch('/api/license/claim?deactivate=1', {
          method: 'POST',
          body: JSON.stringify({ activation_id: activationId })
        });
        if (result?.activation && state.adminData?.activations?.length) {
          state.adminData.activations = state.adminData.activations
            .map((row) => (row.id === result.activation.id ? { ...row, ...result.activation } : row))
            .sort((a, b) => new Date(b.updated_at || 0).getTime() - new Date(a.updated_at || 0).getTime());
          renderActivationTable(state.adminData.activations);
        }
        showFlash('Aktivasi device berhasil dinonaktifkan. Registry lisensi tetap aktif.', 'success');
        await loadAdminDashboard().catch(() => {});
      } catch (error) {
        showFlash(error.message, 'error');
      } finally {
        button.disabled = false;
      }
    });
  });
}

function renderActivationTable(rows) {
  if (!rows.length) {
    els.activationTable.innerHTML = renderEmptyRow(3, 'Belum ada aktivasi lisensi.');
    return;
  }

  els.activationTable.innerHTML = rows.map((row) => {
    const license = row.licenses || {};
    const isActive = String(row.status || '').toLowerCase() === 'active';
    const statusMeta = isActive
      ? `Aktif sejak: ${escapeHtml(formatDate(row.activated_at))}`
      : `Dinonaktifkan: ${escapeHtml(formatDate(row.deactivated_at))}`;
    return `
      <tr class="border-b border-white/5 align-top last:border-b-0">
        <td class="px-5 py-4">
          <div class="font-semibold text-white">${escapeHtml(license.school_name || license.npsn || 'Lisensi belum terhubung')}</div>
          <div class="mt-2 font-mono text-xs text-stone-400">${escapeHtml(row.device_id || '-')}</div>
        </td>
        <td class="px-5 py-4">
          ${renderBadge(row.status || 'active', 'activation')}
          <div class="mt-3 text-sm text-stone-300">${statusMeta}</div>
          <div class="mt-1 text-sm text-stone-400">Label: ${escapeHtml(row.device_label || 'Belum ada label')}</div>
          <div class="mt-1 text-xs text-stone-500">Status registry lisensi utama tidak berubah dari tombol ini.</div>
        </td>
        <td class="px-5 py-4">
          ${isActive
            ? `<button type="button" data-activation-id="${escapeHtml(row.id)}" class="deactivate-btn rounded-xl border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-200 transition hover:bg-rose-500/20">Nonaktifkan Device</button>`
            : '<span class="text-xs text-stone-500">Sudah nonaktif</span>'}
        </td>
      </tr>
    `;
  }).join('');

  bindDeactivateButtons();
}

function renderIssueResult(result) {
  els.issueResult.innerHTML = `
    <div class="rounded-[1.7rem] border border-emerald-400/20 bg-emerald-500/10 p-5 text-sm text-emerald-100">
      <p class="text-xs uppercase tracking-[0.3em] text-emerald-200/80">Token Siap Dipakai</p>
      <h4 class="mt-3 font-display text-xl font-bold text-white">Lisensi berhasil diterbitkan.</h4>
      <div class="mt-4 grid gap-3 sm:grid-cols-2">
        <div class="rounded-2xl border border-white/10 bg-black/20 p-3">
          <p class="text-xs uppercase tracking-[0.24em] text-emerald-200/70">License ID</p>
          <p class="mt-2 break-all font-mono text-xs text-white">${escapeHtml(result.license_id)}</p>
        </div>
        <div class="rounded-2xl border border-white/10 bg-black/20 p-3">
          <p class="text-xs uppercase tracking-[0.24em] text-emerald-200/70">Activation ID</p>
          <p class="mt-2 break-all font-mono text-xs text-white">${escapeHtml(result.activation_id)}</p>
        </div>
      </div>
      <textarea class="mt-4 min-h-[170px] w-full rounded-2xl border border-white/10 bg-black/30 p-3 font-mono text-xs text-white">${escapeHtml(result.token)}</textarea>
      <div class="mt-4 flex flex-wrap gap-3">
        <button type="button" id="copyIssuedToken" class="rounded-2xl border border-emerald-300/30 bg-emerald-400/10 px-4 py-2 font-semibold text-emerald-100 transition hover:bg-emerald-400/20">Salin Token</button>
        <a class="rounded-2xl border border-sky-300/30 bg-sky-400/10 px-4 py-2 font-semibold text-sky-100 transition hover:bg-sky-400/20" href="${escapeHtml(result.checkout_url)}" target="_blank" rel="noreferrer">Buka Checkout</a>
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

  if (!isValidNpsn(payload.npsn)) {
    showFlash('NPSN harus terdiri dari 8 digit angka.', 'error');
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

async function handleLicenseConfigSubmit(event) {
  event.preventDefault();

  const price = Number(els.checkoutPriceInput?.value || 0);
  if (!Number.isFinite(price) || price <= 0) {
    showFlash('Harga checkout harus lebih dari 0.', 'error');
    return;
  }

  const submitButton = els.saveLicenseConfigBtn;
  const originalLabel = submitButton.textContent;
  submitButton.disabled = true;
  submitButton.textContent = 'Menyimpan...';

  try {
    const result = await apiFetch('/api/admin/license-config', {
      method: 'PUT',
      body: JSON.stringify({ price })
    });

    await loadPublicConfig();
    renderPublicMeta();
    buildCheckoutPreview();
    await loadAdminDashboard();
    showFlash(result.message || 'Harga checkout berhasil diperbarui.', 'success');
  } catch (error) {
    showFlash(error.message || 'Harga checkout gagal diperbarui.', 'error');
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = originalLabel;
  }
}

async function handleOpenCheckout() {
  const payload = buildCheckoutPayload();
  if (!payload.npsn || !payload.device_id) {
    showFlash('NPSN dan Device ID wajib diisi sebelum membuka pembayaran.', 'error');
    return;
  }

  if (!isValidNpsn(payload.npsn)) {
    showFlash('NPSN harus terdiri dari 8 digit angka.', 'error');
    return;
  }

  const button = els.openCheckoutBtn;
  const originalLabel = button?.textContent || 'Buka Checkout';
  if (button) {
    button.disabled = true;
    button.textContent = 'Menyiapkan...';
  }

  try {
    if (!state.publicConfig) {
      await loadPublicConfig();
    }

    const order = await apiFetch('/api/checkout', {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    if (order.payment_mode === 'simulation') {
      showFlash('Order simulasi berhasil dibuat. Halaman status dibuka di tab baru.', 'success');
      if (order.redirect_url) {
        window.open(order.redirect_url, '_blank', 'noopener,noreferrer');
      }
      await loadAdminDashboard();
      return;
    }

    if (order.snap_token && state.publicConfig?.paymentEnabled) {
      try {
        await loadMidtransSnap(state.publicConfig);
        openDashboardSnapPopup(order);
      } catch (error) {
        console.error(error);
        showFlash('Popup Snap gagal dimuat. Pembayaran dibuka lewat redirect URL.', 'info');
        if (order.redirect_url) {
          window.open(order.redirect_url, '_blank', 'noopener,noreferrer');
        }
      }
      await loadAdminDashboard();
      return;
    }

    if (order.redirect_url) {
      window.open(order.redirect_url, '_blank', 'noopener,noreferrer');
      showFlash('Order berhasil dibuat. Halaman pembayaran dibuka di tab baru.', 'success');
      await loadAdminDashboard();
      return;
    }

    showFlash('Order berhasil dibuat.', 'success');
    await loadAdminDashboard();
  } catch (error) {
    showFlash(error.message || 'Checkout gagal diproses.', 'error');
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = originalLabel;
    }
  }
}

async function loadAdminDashboard() {
  const data = await apiFetch('/api/admin/dashboard?limit=12');
  state.adminData = data;
  state.admin = data.admin || null;
  state.lastLoadedAt = new Date().toISOString();

  fillIdentity(state.admin);
  setUpdatedAtLabel();

  els.heroSubtitle.textContent = 'Pantau checkout, webhook Midtrans, aktivasi device, dan penerbitan token dari dashboard admin yang ringkas dan mudah dibaca.';

  renderSetupGrid(data.config);
  renderMetricCards(data.metrics, data.config.currency);
  renderSystemInfo(data.config);
  renderLicenseConfigPanel(data.config);
  renderLicenseTable(data.licenses || []);
  renderOrderTable(data.orders || [], data.config.currency);
  renderActivationTable(data.activations || []);
}

function showAccessDenied(message) {
  if (els.dashboardHeader) {
    els.dashboardHeader.classList.add('hidden');
  }
  if (els.dashboardContent) {
    els.dashboardContent.classList.add('hidden');
  }
  if (els.flash) {
    els.flash.innerHTML = '';
  }
  els.accessDenied.classList.remove('hidden');
  els.accessDenied.classList.add('flex');
  els.accessDenied.innerHTML = `
    <div class="w-full rounded-[2rem] border border-rose-400/20 bg-rose-500/10 p-8 text-rose-100 shadow-2xl shadow-[#07131b]/40 backdrop-blur-xl lg:p-10">
      <p class="text-xs uppercase tracking-[0.3em] text-rose-200/80">Akses Dibatasi</p>
      <h2 class="mt-3 font-display text-3xl font-bold text-white">${escapeHtml(message)}</h2>
      <p class="mt-4 max-w-2xl text-sm leading-6 text-rose-100/80">Pastikan akun Google ini sudah ada di tabel users dan role-nya superadmin. Setelah itu login ulang ke dashboard admin.</p>
      <a class="mt-6 inline-flex rounded-2xl border border-white/10 bg-white/10 px-5 py-3 font-semibold text-white transition hover:bg-white/15" href="/admin">Kembali ke Login</a>
    </div>
  `;
}

async function handleAuthFailure(error) {
  els.userIdentity.innerHTML = '';
  showAccessDenied(error.message || 'Akses admin ditolak.');
  if (state.supabase) {
    await state.supabase.auth.signOut();
  }
}

async function init() {
  state.supabase = await getBrowserSupabase();
  const {
    data: { session }
  } = await state.supabase.auth.getSession();

  if (!session) {
    window.location.href = '/admin';
    return;
  }

  state.session = session;

  try {
    await loadAdminDashboard();
  } catch (error) {
    if (error instanceof ApiError && [401, 403].includes(error.status)) {
      await handleAuthFailure(error);
      return;
    }
    throw error;
  }

  try {
    await loadPublicConfig();
    renderPublicMeta();
    buildCheckoutPreview();
  } catch (error) {
    showFlash(error.message, 'error');
  }

  try {
    const downloads = await loadAppDownloads();
    renderAppDownloads(downloads);
  } catch (error) {
    showFlash(error.message || 'Link download aplikasi belum siap.', 'info');
  }
}
els.issueForm?.addEventListener('submit', handleIssueLicense);
els.licenseConfigForm?.addEventListener('submit', handleLicenseConfigSubmit);

els.studentApkUploadForm?.addEventListener('submit', (event) => {
  event.preventDefault();
  handleAppUpload('student_apk', els.studentApkFile, els.studentApkUploadBtn, 'application/vnd.android.package-archive');
});

els.studentApkAlternativeForm?.addEventListener('submit', handleStudentAlternativeLinkSubmit);

els.adminExeUploadForm?.addEventListener('submit', (event) => {
  event.preventDefault();
  handleAppUpload('admin_exe', els.adminExeFile, els.adminExeUploadBtn, 'application/octet-stream');
});

els.checkoutBuilderForm?.addEventListener('input', () => {
  buildCheckoutPreview();
});

els.orderSortSelect?.addEventListener('change', () => {
  state.orderSort = els.orderSortSelect.value;
  renderOrderTable(state.adminData?.orders || [], state.adminData?.config?.currency || 'IDR');
});

els.selectAllOrders?.addEventListener('change', (event) => {
  const rows = sortOrders(state.adminData?.orders || []);
  if (event.target.checked) {
    state.selectedOrders = new Set(rows.map((row) => row.order_id));
  } else {
    state.selectedOrders.clear();
  }
  renderOrderTable(state.adminData?.orders || [], state.adminData?.config?.currency || 'IDR');
});

els.deleteOrdersBtn?.addEventListener('click', handleDeleteSelectedOrders);

els.copyCheckoutBtn?.addEventListener('click', async () => {
  try {
    await copyText(buildCheckoutPreview(), 'Link checkout berhasil disalin.');
  } catch (error) {
    showFlash(error.message, 'error');
  }
});

els.openCheckoutBtn?.addEventListener('click', handleOpenCheckout);

els.refreshBtn?.addEventListener('click', async () => {
  const originalLabel = els.refreshBtn.textContent;
  els.refreshBtn.disabled = true;
  els.refreshBtn.textContent = 'Memuat...';

  try {
    const {
      data: { session }
    } = await state.supabase.auth.getSession();
    state.session = session;

    await loadPublicConfig();
    renderPublicMeta();
    buildCheckoutPreview();
    await loadAdminDashboard();
    showFlash('Dashboard lisensi berhasil diperbarui.', 'success');
  } catch (error) {
    if (error instanceof ApiError && [401, 403].includes(error.status)) {
      await handleAuthFailure(error);
      return;
    }
    showFlash(error.message || 'Dashboard gagal dimuat ulang.', 'error');
  } finally {
    els.refreshBtn.disabled = false;
    els.refreshBtn.textContent = originalLabel;
  }
});

els.logoutBtn?.addEventListener('click', async () => {
  if (state.supabase) {
    await state.supabase.auth.signOut();
  }
  window.location.href = '/admin';
});

document.addEventListener('click', async (event) => {
  const checkbox = event.target.closest('.order-select');
  if (checkbox) {
    const orderId = checkbox.dataset.orderId;
    if (orderId) {
      if (checkbox.checked) {
        state.selectedOrders.add(orderId);
      } else {
        state.selectedOrders.delete(orderId);
      }
      syncOrderSelectionState((state.adminData?.orders || []).length);
    }
    return;
  }

  const button = event.target.closest('[data-copy-text]');
  if (!button) return;

  try {
    await copyText(button.dataset.copyText || '', `${button.dataset.copyLabel || 'Teks'} berhasil disalin.`);
  } catch (error) {
    showFlash(error.message || 'Gagal menyalin teks.', 'error');
  }
});

init().catch((error) => {
  console.error(error);
  showFlash(error.message || 'Dashboard lisensi gagal dimuat.', 'error');
});
