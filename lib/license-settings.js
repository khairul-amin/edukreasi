import { readFileSync } from 'node:fs';
import { getLicenseConfig } from './config.js';
import { createHttpError } from './http.js';
import { createServiceClient } from './supabase.js';

const DEFAULT_LICENSE_SETTINGS_ID = 'default';
const DEFAULT_APP_UPDATE_SETTINGS = readBundledUpdateSettings();

function isMissingSettingsTable(error) {
  const raw = [
    error?.code,
    error?.message,
    error?.details,
    error?.hint
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return raw.includes('license_settings') && (
    raw.includes('does not exist') ||
    raw.includes('could not find') ||
    raw.includes('42p01') ||
    raw.includes('pgrst')
  );
}

function isMissingColumn(error, columnName) {
  const raw = [
    error?.code,
    error?.message,
    error?.details,
    error?.hint
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return raw.includes(String(columnName || '').toLowerCase()) && (
    raw.includes('does not exist') ||
    raw.includes('could not find') ||
    raw.includes('column')
  );
}

function readBundledUpdateSettings() {
  try {
    const raw = readFileSync(new URL('../public/update.json', import.meta.url), 'utf8');
    const parsed = JSON.parse(raw);
    const versionCode = Math.max(0, Math.round(Number(parsed?.latestVersionCode || 0)));
    return {
      studentLatestVersionCode: versionCode
    };
  } catch {
    return {
      studentLatestVersionCode: 0
    };
  }
}

function normalizePrice(value) {
  const amount = Math.round(Number(value || 0));
  if (!Number.isFinite(amount) || amount <= 0) {
    throw createHttpError(400, 'Harga checkout harus lebih dari 0.');
  }
  return amount;
}

function normalizeVersionCode(value) {
  const amount = Math.round(Number(value || 0));
  if (!Number.isFinite(amount) || amount <= 0) {
    throw createHttpError(400, 'Version code update harus berupa angka lebih dari 0.');
  }
  return amount;
}

function normalizeOptionalUrl(value, fieldLabel = 'URL') {
  const raw = String(value ?? '').trim();
  if (!raw) return null;

  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    throw createHttpError(400, `${fieldLabel} harus berupa URL yang valid.`);
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw createHttpError(400, `${fieldLabel} harus diawali http:// atau https://.`);
  }

  return parsed.toString();
}

async function readLicenseSettingsRow() {
  const supabase = createServiceClient();
  const readRow = async (columns) => supabase
    .from('license_settings')
    .select(columns)
    .eq('id', DEFAULT_LICENSE_SETTINGS_ID)
    .maybeSingle();

  const { data, error } = await readRow(
    'id, checkout_price, student_alt_download_url, student_latest_version_code, updated_at, updated_by'
  );

  if (error) {
    if (isMissingSettingsTable(error)) {
      return null;
    }

    const missingStudentAltColumn = isMissingColumn(error, 'student_alt_download_url');
    const missingStudentLatestVersionCodeColumn = isMissingColumn(error, 'student_latest_version_code');

    if (missingStudentAltColumn || missingStudentLatestVersionCodeColumn) {
      const fallbackColumns = [
        'id',
        'checkout_price',
        'updated_at',
        'updated_by'
      ];

      if (!missingStudentAltColumn) {
        fallbackColumns.splice(2, 0, 'student_alt_download_url');
      }

      if (!missingStudentLatestVersionCodeColumn) {
        fallbackColumns.splice(2, 0, 'student_latest_version_code');
      }

      const fallbackResult = await readRow(fallbackColumns.join(', '));

      if (fallbackResult.error) {
        throw createHttpError(500, 'Gagal membaca pengaturan checkout.', {
          cause: fallbackResult.error
        });
      }

      return fallbackResult.data
        ? {
            ...fallbackResult.data,
            student_alt_download_url: missingStudentAltColumn
              ? null
              : (fallbackResult.data.student_alt_download_url || null),
            student_latest_version_code: missingStudentLatestVersionCodeColumn
              ? null
              : fallbackResult.data.student_latest_version_code,
            missingStudentAltColumn,
            missingStudentLatestVersionCodeColumn
          }
        : null;
    }

    throw createHttpError(500, 'Gagal membaca pengaturan checkout.', {
      cause: error
    });
  }

  return data || null;
}

async function getResolvedLicenseConfig(req) {
  const baseConfig = getLicenseConfig(req);
  const row = await readLicenseSettingsRow();

  if (!row) {
    return {
      ...baseConfig,
      studentAlternativeDownloadUrl: null,
      studentLatestVersionCode: DEFAULT_APP_UPDATE_SETTINGS.studentLatestVersionCode,
      priceSource: 'env',
      priceUpdatedAt: null,
      priceUpdatedBy: null
    };
  }

  return {
    ...baseConfig,
    price: Number(row.checkout_price ?? baseConfig.price ?? 0),
    studentAlternativeDownloadUrl: row.student_alt_download_url || null,
    studentLatestVersionCode: Number(
      row.student_latest_version_code
      ?? DEFAULT_APP_UPDATE_SETTINGS.studentLatestVersionCode
      ?? 0
    ),
    priceSource: 'database',
    priceUpdatedAt: row.updated_at || null,
    priceUpdatedBy: row.updated_by || null
  };
}

async function updateLicenseSettings({
  price,
  studentAlternativeDownloadUrl,
  studentLatestVersionCode,
  updatedBy = null
}) {
  const hasPriceUpdate = price !== undefined;
  const hasStudentAlternativeDownloadUrlUpdate = studentAlternativeDownloadUrl !== undefined;
  const hasStudentLatestVersionCodeUpdate = studentLatestVersionCode !== undefined;

  if (!hasPriceUpdate && !hasStudentAlternativeDownloadUrlUpdate && !hasStudentLatestVersionCodeUpdate) {
    throw createHttpError(400, 'Tidak ada pengaturan yang dikirim untuk disimpan.');
  }

  const currentRow = await readLicenseSettingsRow();
  const supabase = createServiceClient();
  const payload = {
    id: DEFAULT_LICENSE_SETTINGS_ID,
    checkout_price: hasPriceUpdate
      ? normalizePrice(price)
      : Number(currentRow?.checkout_price ?? 0),
    updated_by: updatedBy ? String(updatedBy) : null
  };

  if (currentRow?.missingStudentAltColumn) {
    if (hasStudentAlternativeDownloadUrlUpdate) {
      throw createHttpError(
        500,
        'Kolom link alternatif belum tersedia. Jalankan file supabase/license-settings.sql di Supabase terlebih dahulu.'
      );
    }
  } else {
    payload.student_alt_download_url = hasStudentAlternativeDownloadUrlUpdate
      ? normalizeOptionalUrl(studentAlternativeDownloadUrl, 'Link unduhan alternatif siswa')
      : (currentRow?.student_alt_download_url || null);
  }

  if (currentRow?.missingStudentLatestVersionCodeColumn) {
    if (hasStudentLatestVersionCodeUpdate) {
      throw createHttpError(
        500,
        'Kolom version code update belum tersedia. Jalankan file supabase/license-settings.sql di Supabase terlebih dahulu.'
      );
    }
  } else {
    payload.student_latest_version_code = hasStudentLatestVersionCodeUpdate
      ? normalizeVersionCode(studentLatestVersionCode)
      : Number(currentRow?.student_latest_version_code ?? DEFAULT_APP_UPDATE_SETTINGS.studentLatestVersionCode);
  }

  const selectColumns = [
    'id',
    'checkout_price',
    'updated_at',
    'updated_by'
  ];

  if (!currentRow?.missingStudentAltColumn) {
    selectColumns.splice(2, 0, 'student_alt_download_url');
  }

  if (!currentRow?.missingStudentLatestVersionCodeColumn) {
    selectColumns.splice(2, 0, 'student_latest_version_code');
  }

  const { data, error } = await supabase
    .from('license_settings')
    .upsert(payload, { onConflict: 'id' })
    .select(selectColumns.join(', '))
    .single();

  if (error) {
    if (isMissingSettingsTable(error)) {
      throw createHttpError(
        500,
        'Tabel license_settings belum tersedia. Jalankan file supabase/license-settings.sql di Supabase.',
        { cause: error }
      );
    }

    throw createHttpError(500, 'Gagal menyimpan pengaturan checkout.', {
      cause: error
    });
  }

  return {
    ...data,
    student_alt_download_url: currentRow?.missingStudentAltColumn
      ? null
      : (data?.student_alt_download_url || null),
    student_latest_version_code: currentRow?.missingStudentLatestVersionCodeColumn
      ? DEFAULT_APP_UPDATE_SETTINGS.studentLatestVersionCode
      : data?.student_latest_version_code,
    missingStudentAltColumn: Boolean(currentRow?.missingStudentAltColumn),
    missingStudentLatestVersionCodeColumn: Boolean(currentRow?.missingStudentLatestVersionCodeColumn)
  };
}

export {
  getResolvedLicenseConfig,
  updateLicenseSettings
};
