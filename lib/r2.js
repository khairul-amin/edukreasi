import { S3Client } from '@aws-sdk/client-s3';
import { getEnv, requireEnv } from './config.js';

function stripTrailingSlashes(value) {
  return String(value || '').replace(/\/+$/g, '');
}

function validateR2Value(name, value, { length, pattern } = {}) {
  const normalized = String(value || '').trim();

  if (!normalized) {
    const error = new Error(`${name} belum diisi.`);
    error.statusCode = 500;
    throw error;
  }

  if (length && normalized.length !== length) {
    const error = new Error(`${name} tidak valid. Panjang yang diterima harus ${length} karakter.`);
    error.statusCode = 500;
    throw error;
  }

  if (pattern && !pattern.test(normalized)) {
    const error = new Error(`${name} tidak valid. Format nilainya tidak sesuai.`);
    error.statusCode = 500;
    throw error;
  }

  return normalized;
}

function getR2Config() {
  const accountId = getEnv('R2_ACCOUNT_ID');
  const accessKeyId = getEnv('R2_ACCESS_KEY_ID');
  const secretAccessKey = getEnv('R2_SECRET_ACCESS_KEY');
  const endpoint = stripTrailingSlashes(getEnv('R2_ENDPOINT')) || (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : '');

  return {
    accountId,
    accessKeyId,
    secretAccessKey,
    endpoint
  };
}

function createR2Client() {
  const accountId = validateR2Value('R2_ACCOUNT_ID', requireEnv('R2_ACCOUNT_ID'), {
    length: 32,
    pattern: /^[a-f0-9]+$/i
  });
  const accessKeyId = validateR2Value('R2_ACCESS_KEY_ID', requireEnv('R2_ACCESS_KEY_ID'), {
    length: 32,
    pattern: /^[a-f0-9]+$/i
  });
  const secretAccessKey = validateR2Value('R2_SECRET_ACCESS_KEY', requireEnv('R2_SECRET_ACCESS_KEY'), {
    length: 64,
    pattern: /^[a-f0-9]+$/i
  });
  const endpoint = stripTrailingSlashes(getEnv('R2_ENDPOINT')) || `https://${accountId}.r2.cloudflarestorage.com`;

  return new S3Client({
    region: 'auto', // Required by AWS SDK but not used by R2.
    endpoint,
    credentials: {
      accessKeyId,
      secretAccessKey
    }
  });
}

export { createR2Client, getR2Config };
