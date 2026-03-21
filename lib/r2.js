import { S3Client } from '@aws-sdk/client-s3';
import { getEnv, requireEnv } from './config.js';

function stripTrailingSlashes(value) {
  return String(value || '').replace(/\/+$/g, '');
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
  const accountId = requireEnv('R2_ACCOUNT_ID');
  const accessKeyId = requireEnv('R2_ACCESS_KEY_ID');
  const secretAccessKey = requireEnv('R2_SECRET_ACCESS_KEY');
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

