import QRCode from 'https://cdn.jsdelivr.net/npm/qrcode/build/qrcode.min.js';

const generateBtn = document.getElementById('generateQRBtn');
const qrContainer = document.getElementById('qrCode');
const downloadLink = document.getElementById('downloadQR');
const linkSpreadsheetInput = document.getElementById('link');

generateBtn.addEventListener('click', async () => {
  const link = linkSpreadsheetInput.value.trim();
  if (!link) return alert('Isi link spreadsheet terlebih dahulu!');

  qrContainer.innerHTML = '';
  downloadLink.classList.add('hidden');

  const canvas = document.createElement('canvas');
  await QRCode.toCanvas(canvas, link, { width: 200 });
  qrContainer.appendChild(canvas);

  downloadLink.href = canvas.toDataURL('image/png');
  downloadLink.classList.remove('hidden');
});
