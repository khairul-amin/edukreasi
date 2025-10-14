import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
const supabase = createClient('https://YOUR_PROJECT.supabase.co', 'YOUR_ANON_KEY');

const nama = document.getElementById('nama');
const npsn = document.getElementById('npsn');
const link = document.getElementById('link');
const list = document.getElementById('list');
const userEmail = document.getElementById('userEmail');
const saveBtn = document.getElementById('saveBtn');
const logoutBtn = document.getElementById('logoutBtn');

let user = null;

async function checkSession() {
  const { data } = await supabase.auth.getSession();
  if (!data.session) window.location.href = './admin.html';
  else {
    user = data.session.user;
    userEmail.textContent = 'Login sebagai: ' + user.email;
    loadData();
  }
}

async function loadData() {
  const { data } = await supabase.from('schools').select('*').eq('admin_email', user.email);
  list.innerHTML = data.map(d => `
    <div class="card">
      <h3>${d.nama}</h3>
      <p>NPSN: ${d.npsn}</p>
      <p>${d.link}</p>
      <canvas id="qr-${d.id}"></canvas>
    </div>
  `).join('');

  data.forEach(d => {
    const canvas = document.getElementById(`qr-${d.id}`);
    QRCode.toCanvas(canvas, d.link, { width: 120 });
  });
}

saveBtn.onclick = async () => {
  if (!nama.value || !npsn.value || !link.value) return alert('Lengkapi data!');
  await supabase.from('schools').insert({
    admin_email: user.email,
    nama: nama.value,
    npsn: npsn.value,
    link: link.value
  });
  nama.value = npsn.value = link.value = '';
  loadData();
};

logoutBtn.onclick = async () => {
  await supabase.auth.signOut();
  window.location.href = './admin.html';
};

checkSession();
