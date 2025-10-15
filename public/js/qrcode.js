document.addEventListener('DOMContentLoaded', () => {
  // ambil elemen
  const generateBtn = document.getElementById('generateQRBtn');
  const qrContainer = document.getElementById('qrCode');
  const downloadLink = document.getElementById('downloadQR');
  const linkSpreadsheetInput = document.getElementById('link');

  if (!generateBtn || !qrContainer || !linkSpreadsheetInput) return;

  // tambahkan listener
  generateBtn.addEventListener('click', async () => {
    const link = linkSpreadsheetInput.value.trim();
    if (!link) return alert('Isi link spreadsheet terlebih dahulu!');

    // hapus QR lama
    qrContainer.innerHTML = '';
    downloadLink.classList.add('hidden');

    // generate QR ke canvas
    const canvas = document.createElement('canvas');

    // gunakan QRCode.js versi non-module
    new QRCode(canvas, {
      text: link,
      width: 200,
      height: 200,
      colorDark: "#000000",
      colorLight: "#ffffff",
    });

    qrContainer.appendChild(canvas);

    // siapkan download
    downloadLink.href = canvas.toDataURL("image/png");
    downloadLink.classList.remove('hidden');
  });
});
