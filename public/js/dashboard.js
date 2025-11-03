import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
  'https://esmkveggutxzklavspnn.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVzbWt2ZWdndXR4emtsYXZzcG5uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAzODIyNTQsImV4cCI6MjA3NTk1ODI1NH0.18vlPWg1S_6ocoCWKaCh_KU41TbipXyQNS2r5GKRQ44'
);

const userEmail = document.getElementById('userEmail');
const userForm = document.getElementById('userForm');
const adminTable = document.getElementById('adminTable');
const tableBody = document.getElementById('tableBody');
const saveBtn = document.getElementById('saveBtn');
const logoutBtn = document.getElementById('logoutBtn');
const metricCards = document.getElementById('metricCards');

const asalSekolah = document.getElementById('nama');
const npsn = document.getElementById('npsn');
const linkSpreadsheet = document.getElementById('link');
const noHp = document.getElementById('hp');

let user = null;
let role = 'user';

// 🟩 elemen baru
const generateLinkBtn = document.getElementById('generateLinkBtn');
const linkTokenWrapper = document.getElementById('linkTokenWrapper');
const linkToken = document.getElementById('linkToken');
const copyLinkBtn = document.getElementById('copyLinkBtn');

async function init() {
  const { data } = await supabase.auth.getSession();
  if (!data.session) return window.location.href = '/admin';
  user = data.session.user;

  const { data: userData } = await supabase
    .from('users')
    .select('role, name')
    .eq('id', user.id)
    .maybeSingle();

  role = userData?.role || 'user';
  const displayName = userData?.name || user.email;
  userEmail.textContent = `Login sebagai: ${displayName} (${role})`;

  if (role === 'superadmin') {
    adminTable.classList.remove('hidden');
    loadAllUsers();
    loadMetrics();
  } else {
    userForm.classList.remove('hidden');
    loadUserData();
  }
}

async function loadUserData() {
  const { data } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();

  if (data) {
    asalSekolah.value = data.asal_sekolah || '';
    npsn.value = data.npsn || '';
    linkSpreadsheet.value = data.link_spreadsheet || '';
    noHp.value = data.no_hp || '';
  }
}

saveBtn.onclick = async () => {
  if (!asalSekolah.value || !npsn.value || !linkSpreadsheet.value || !noHp.value)
    return alert('Lengkapi semua data!');

  const { error } = await supabase
    .from('user_profiles')
    .upsert([{
      user_id: user.id,
      asal_sekolah: asalSekolah.value,
      npsn: npsn.value,
      link_spreadsheet: linkSpreadsheet.value,
      no_hp: noHp.value,
      updated_at: new Date().toISOString()
    }], { onConflict: ['user_id'] });

  if (error) alert('Gagal simpan data: ' + error.message);
  else {
    alert('Data berhasil disimpan!');
    loadUserData();
  }
};

// 🟩 tombol generate link token
if (generateLinkBtn) {
  generateLinkBtn.onclick = async () => {
    if (!npsn.value) {
      alert("Isi NPSN terlebih dahulu!");
      return;
    }

    const baseUrl = window.location.origin;
    const tokenUrl = `${baseUrl}/token.html?k=${npsn.value.trim()}`; // pakai NPSN langsung

    linkTokenWrapper.classList.remove("hidden");
    linkToken.href = tokenUrl;
    linkToken.textContent = tokenUrl;

    copyLinkBtn.onclick = () => {
      navigator.clipboard.writeText(tokenUrl);
      alert("Link token disalin ke clipboard!");
    };
  };
}

// ---- Admin ----
async function loadAllUsers() {
  const { data } = await supabase.from('users')
    .select(`
      id,
      email,
      name,
      role,
      user_profiles (
        asal_sekolah,
        npsn,
        link_spreadsheet,
        no_hp
      )
    `);

  const tableHead = document.getElementById('tableHead');
  tableHead.innerHTML = `
    <tr>
      <th class="border px-2 py-1">Email</th>
      <th class="border px-2 py-1">Nama</th>
      <th class="border px-2 py-1">Asal Sekolah</th>
      <th class="border px-2 py-1">NPSN</th>
      <th class="border px-2 py-1">Spreadsheet</th>
      <th class="border px-2 py-1">No HP</th>
      <th class="border px-2 py-1">Status</th>
      <th class="border px-2 py-1">Aksi</th>
    </tr>
  `;

  tableBody.innerHTML = data.map(u => {
    const p = u.user_profiles || {};
    const hasData = p.asal_sekolah || p.npsn || p.link_spreadsheet || p.no_hp;
    const status = hasData
      ? '<span class="text-green-600 font-semibold">Sudah</span>'
      : '<span class="text-red-600 font-semibold">Belum</span>';

    return `
      <tr>
        <td class="border px-2 py-1">${u.email}</td>
        <td class="border px-2 py-1">${u.name || '-'}</td>
        <td class="border px-2 py-1">${p.asal_sekolah || '-'}</td>
        <td class="border px-2 py-1">${p.npsn || '-'}</td>
        <td class="border px-2 py-1">${p.link_spreadsheet ? `<a href="${p.link_spreadsheet}" target="_blank" class="text-blue-600 underline">${p.link_spreadsheet}</a>` : '-'}</td>
        <td class="border px-2 py-1">${p.no_hp || '-'}</td>
        <td class="border px-2 py-1">${status}</td>
        <td class="border px-2 py-1">
          <button class="hapusBtn bg-red-600 text-white px-2 py-1 rounded hover:bg-red-700" data-id="${u.id}">Hapus</button>
        </td>
      </tr>
    `;
  }).join('');

  document.querySelectorAll('.hapusBtn').forEach(btn =>
    btn.addEventListener('click', async e => {
      const id = e.target.dataset.id;
      if (confirm('Yakin ingin menghapus user ini?')) await hapusUser(id);
    })
  );
}

async function loadMetrics() {
  const { data } = await supabase.from('users').select('*');
  const totalUsers = data.length;
  const totalFilled = data.filter(u => u.user_profiles).length;

  metricCards.innerHTML = `
    <div class="bg-white p-4 rounded shadow text-center">
      <p class="text-gray-500">Total Users</p>
      <p class="text-2xl font-bold">${totalUsers}</p>
    </div>
    <div class="bg-white p-4 rounded shadow text-center">
      <p class="text-gray-500">Profil Terisi</p>
      <p class="text-2xl font-bold">${totalFilled}</p>
    </div>
  `;
}

async function hapusUser(userId) {
  await supabase.from('user_profiles').delete().eq('user_id', userId);
  await supabase.from('users').delete().eq('id', userId);
  alert('User berhasil dihapus!');
  loadAllUsers();
  loadMetrics();
}

logoutBtn.onclick = async () => {
  await supabase.auth.signOut();
  window.location.href = '/admin';
};

init();
