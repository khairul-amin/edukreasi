import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
  'https://esmkveggutxzklavspnn.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVzbWt2ZWdndXR4emtsYXZzcG5uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAzODIyNTQsImV4cCI6MjA3NTk1ODI1NH0.18vlPWg1S_6ocoCWKaCh_KU41TbipXyQNS2r5GKRQ44'
);

const generateBtn = document.getElementById('generateQRBtn');
const qrCodeContainer = document.getElementById('qrCode');
const downloadLink = document.getElementById('downloadQR');
const linkSpreadsheet = document.getElementById('link');

// 🔹 Sembunyikan QR di awal
if (qrCodeContainer) qrCodeContainer.parentElement.style.display = 'none';

// 🔒 Fungsi buat hash acak kuat (10–15 karakter)
function generateSecureHash() {
  const length = Math.floor(Math.random() * 6) + 10; // 10–15 karakter
  const charset =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_-+=<>?';
  let result = '';
  const randomValues = new Uint32Array(length);
  window.crypto.getRandomValues(randomValues);
  for (let i = 0; i < length; i++) {
    result += charset[randomValues[i] % charset.length];
  }
  return result;
}

// 🔹 Event: klik tombol Generate
generateBtn?.addEventListener('click', async () => {
  const link = linkSpreadsheet.value.trim();
  if (!link) return alert('Isi link spreadsheet terlebih dahulu!');

  // ambil user aktif
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session) return alert('Sesi login habis, silakan login ulang.');
  const userId = sessionData.session.user.id;

  // buat hash acak aman
  const hash = generateSecureHash();

  // simpan ke tabel Supabase
  const { error } = await supabase.from('qr_map').upsert(
    [
      {
        user_id: userId,
        hash: hash,
        link_asli: link,
      },
    ],
    { onConflict: ['user_id'] }
  );

  if (error) return alert('Gagal menyimpan QR ke database: ' + error.message);

  // teks di dalam QR
  const qrText = `edukreasi|${hash}`;

  // tampilkan QR
  qrCodeContainer.innerHTML = '';
  downloadLink.classList.add('hidden');

  const qr = new QRCode(qrCodeContainer, {
    text: qrText,
    width: 200,
    height: 200,
    colorDark: '#000000',
    colorLight: '#ffffff',
  });

  qrCodeContainer.parentElement.style.display = 'block';

  // tombol download muncul otomatis
  setTimeout(() => {
    const img = qrCodeContainer.querySelector('img') || qrCodeContainer.querySelector('canvas');
    if (img) {
      const dataUrl = img.src || img.toDataURL('image/png');
      downloadLink.href = dataUrl;
      downloadLink.classList.remove('hidden');
    }
  }, 500);
});
