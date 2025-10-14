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

const nama = document.getElementById('nama');
const npsn = document.getElementById('npsn');
const link = document.getElementById('link');
const hp = document.getElementById('hp');

let user = null;

async function init() {
  const { data } = await supabase.auth.getSession();
  if (!data.session) {
    window.location.href = '/admin';
    return;
  }

  user = data.session.user;
  userEmail.textContent = 'Login sebagai: ' + user.email;

  // Super admin email
  const superAdmin = 'khairul.amin1046@guru.sd.belajar.id';

  if (user.email === superAdmin) {
    adminTable.classList.remove('hidden');
    loadAllUsers();
  } else {
    userForm.classList.remove('hidden');
    loadUserData();
  }
}

async function loadUserData() {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();

  if (data) {
    nama.value = data.nama || '';
    npsn.value = data.npsn || '';
    link.value = data.link || '';
    hp.value = data.hp || '';
  }
}

saveBtn.onclick = async () => {
  if (!nama.value || !npsn.value || !link.value || !hp.value)
    return alert('Lengkapi semua data!');

  const { error } = await supabase.from('user_profiles').upsert({
    user_id: user.id,
    email: user.email,
    nama: nama.value,
    npsn: npsn.value,
    link: link.value,
    hp: hp.value,
  });

  if (error) alert('Gagal simpan data: ' + error.message);
  else alert('Data berhasil disimpan!');
};

async function loadAllUsers() {
  const { data, error } = await supabase.from('user_profiles').select('*');
  if (error) {
    console.error(error);
    return;
  }
  tableBody.innerHTML = data
    .map(
      (u) => `
      <tr>
        <td>${u.email}</td>
        <td>${u.nama || '-'}</td>
        <td>${u.npsn || '-'}</td>
        <td><a href="${u.link}" target="_blank">${u.link || '-'}</a></td>
        <td>${u.hp || '-'}</td>
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
