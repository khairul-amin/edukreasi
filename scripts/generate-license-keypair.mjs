import crypto from 'crypto';

const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: {
    type: 'spki',
    format: 'pem'
  },
  privateKeyEncoding: {
    type: 'pkcs8',
    format: 'pem'
  }
});

function toEnvMultiline(value) {
  return value.trim().replace(/\r?\n/g, '\\n');
}

const adminSecret = crypto.randomBytes(24).toString('base64url');

console.log('Tambahkan ke Vercel Environment Variables:');
console.log('');
console.log(`LICENSE_ADMIN_SECRET=${adminSecret}`);
console.log(`LICENSE_PRIVATE_KEY="${toEnvMultiline(privateKey)}"`);
console.log(`LICENSE_PUBLIC_KEY="${toEnvMultiline(publicKey)}"`);
