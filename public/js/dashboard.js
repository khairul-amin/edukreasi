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

const asalSekolah = document.getElementById('nama');
const npsn = document.getElementById('npsn');
const linkSpreadsheet = document.getElementById('link');
const noHp = document.getElementById('hp');

let user = null;

async function init() {
  const { data } = await supabase.auth.getSession();
  if (!data.session) {
    window.location.href = '/admin';
    return;
  }

  user = data.session.user;
  userEmail.textContent = 'Login sebagai: ' + user.email;

  // Ambil role dari tabel users
  const { data: userData } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single();

  const role = userData?.role || 'user';

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
  if (!asalSekolah.value || !npsn.value || !linkSpreadsheet.value || !noHp.value)
    return alert('Lengkapi semua data!');

  const { error } = await supabase.from('user_profiles').upsert({
    user_id: user.id,
    asal_sekolah: asalSekolah.value,
    npsn: npsn.value,
    link_spreadsheet: linkSpreadsheet.value,
    no_hp: noHp.value,
    updated_at: new Date().toISOString(),
  });

  if (error) alert('Gagal simpan data: ' + error.message);
  else alert('Data berhasil disimpan!');
};

async function loadAllUsers() {
  const { data, error } = await supabase
    .from('user_profiles')
    .select(`
      user_id,
      asal_sekolah,
      npsn,
      link_spreadsheet,
      no_hp,
      users (email, name)
    `);

  if (error) {
    console.error(error);
    return;
  }

  tableBody.innerHTML = data
    .map(
      (u) => `
      <tr>
        <td>${u.users?.email || '-'}</td>
        <td>${u.asal_sekolah || '-'}</td>
        <td>${u.npsn || '-'}</td>
        <td><a href="${u.link_spreadsheet}" target="_blank">${u.link_spreadsheet || '-'}</a></td>
        <td>${u.no_hp || '-'}</td>
      </tr>
    `
    )
    .join('');
}

logoutBtn.onclick = async () => {
  await supabase.auth.signOut();
  window.location.href = '/admin';
};

init();
