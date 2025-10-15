import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
  'https://esmkveggutxzklavspnn.supabase.co',
  'YOUR_ANON_KEY_HERE' // ganti dengan key Supabase mu
);

const userEmail = document.getElementById('userEmail');
const userForm = document.getElementById('userForm');
const adminTable = document.getElementById('adminTable');
const tableBody = document.getElementById('tableBody');
const saveBtn = document.getElementById('saveBtn');
const logoutBtn = document.getElementById('logoutBtn');

const asalSekolah = document.getElementById('nama');
const npsn = document.getElementById('npsn');
const linkSpreadsheet = document.getElementById('link');
const noHp = document.getElementById('hp');

let user = null;
let role = 'user';

async function init() {
  const { data } = await supabase.auth.getSession();
  if (!data.session) {
    window.location.href = '/admin';
    return;
  }

  user = data.session.user;

  // Ambil role dari tabel users
  const { data: userData, error: roleError } = await supabase
    .from('users')
    .select('role, name')
    .eq('id', user.id)
    .maybeSingle();

  if (roleError) console.error('Role error:', roleError.message);

  role = userData?.role || 'user';
  const displayName = userData?.name || user.email;

  userEmail.textContent = `Login sebagai: ${displayName} (${role})`;

  if (role === 'superadmin') {
    adminTable.classList.remove('hidden');
    loadAllUsers();
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
  if (!asalSekolah.value || !npsn.value || !linkSpreadsheet.value || !noHp.value) {
    return alert('Lengkapi semua data!');
  }

  try {
    const { error } = await supabase
      .from('user_profiles')
      .upsert(
        [{
          user_id: user.id,
          asal_sekolah: asalSekolah.value,
          npsn: npsn.value,
          link_spreadsheet: linkSpreadsheet.value,
          no_hp: noHp.value,
          updated_at: new Date().toISOString(),
        }],
        { onConflict: ['user_id'] }
      );

    if (error) {
      console.error('Error upsert:', error);
      return alert('Gagal simpan data: ' + error.message);
    }

    alert('Data berhasil disimpan!');
    loadUserData();
  } catch (err) {
    console.error('Unexpected error:', err);
    alert('Terjadi kesalahan saat menyimpan data.');
  }
};

async function loadAllUsers() {
  const { data, error } = await supabase
    .from('users')
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

  if (error) {
    console.error('Error loading users:', error.message);
    return;
  }

  // Header tabel
  const tableHead = document.querySelector('#tableHead');
  if (tableHead && tableHead.innerHTML.trim() === '') {
    tableHead.innerHTML = `
      <tr>
        <th>Email</th>
        <th>Nama</th>
        <th>Asal Sekolah</th>
        <th>NPSN</th>
        <th>Link Spreadsheet</th>
        <th>No HP</th>
        <th>Status Profil</th>
        <th>Aksi</th>
      </tr>
    `;
  }

  // Isi tabel
  tableBody.innerHTML = data
    .map(u => {
      const p = u.user_profiles || {}; // objek atau {} jika null
      const hasData = p.asal_sekolah || p.npsn || p.link_spreadsheet || p.no_hp;
      const statusProfil = hasData
        ? '<span class="text-green-600 font-semibold">Sudah</span>'
        : '<span class="text-red-600 font-semibold">Belum</span>';

      return `
        <tr>
          <td>${u.email}</td>
          <td>${u.name || '-'}</td>
          <td>${p.asal_sekolah || '-'}</td>
          <td>${p.npsn || '-'}</td>
          <td>${p.link_spreadsheet ? `<a href="${p.link_spreadsheet}" target="_blank" class="text-blue-600 underline">${p.link_spreadsheet}</a>` : '-'}</td>
          <td>${p.no_hp || '-'}</td>
          <td>${statusProfil}</td>
          <td>
            <button class="hapusBtn bg-red-500 text-white px-2 py-1 rounded" data-id="${u.id}">
              Hapus
            </button>
          </td>
        </tr>
      `;
    })
    .join('');

  document.querySelectorAll('.hapusBtn').forEach(btn =>
    btn.addEventListener('click', async e => {
      const id = e.target.dataset.id;
      if (confirm('Yakin ingin menghapus user ini?')) {
        await hapusUser(id);
      }
    })
  );
}

async function hapusUser(userId) {
  try {
    await supabase.from('user_profiles').delete().eq('user_id', userId);
    await supabase.from('users').delete().eq('id', userId);
    alert('User berhasil dihapus!');
    loadAllUsers();
  } catch (err) {
    alert('Gagal hapus user: ' + err.message);
  }
}

logoutBtn.onclick = async () => {
  await supabase.auth.signOut();
  window.location.href = '/admin';
};

init();
