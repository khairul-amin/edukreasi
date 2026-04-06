import { getLicenseConfig } from './config.js';
import { createHttpError } from './http.js';
import { createServiceClient } from './supabase.js';

const DEFAULT_LICENSE_SETTINGS_ID = 'default';

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

function isMissingStudentAltColumn(error) {
  const raw = [
    error?.code,
    error?.message,
    error?.details,
    error?.hint
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return raw.includes('student_alt_download_url') && (
    raw.includes('does not exist') ||
    raw.includes('could not find') ||
    raw.includes('column')
  );
}

function normalizePrice(value) {
  const amount = Math.round(Number(value || 0));
  if (!Number.isFinite(amount) || amount <= 0) {
    throw createHttpError(400, 'Harga checkout harus lebih dari 0.');
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
  const modernQuery = supabase
    .from('license_settings')
    .select('id, checkout_price, student_alt_download_url, updated_at, updated_by')
    .eq('id', DEFAULT_LICENSE_SETTINGS_ID)
    .maybeSingle();

  const { data, error } = await modernQuery;

  if (error) {
    if (isMissingSettingsTable(error)) {
      return null;
    }

    if (isMissingStudentAltColumn(error)) {
      const legacyResult = await supabase
        .from('license_settings')
        .select('id, checkout_price, updated_at, updated_by')
        .eq('id', DEFAULT_LICENSE_SETTINGS_ID)
        .maybeSingle();

      if (legacyResult.error) {
        throw createHttpError(500, 'Gagal membaca pengaturan checkout.', {
          cause: legacyResult.error
        });
      }

      return legacyResult.data
        ? {
            ...legacyResult.data,
            student_alt_download_url: null,
            legacySchema: true
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
      priceSource: 'env',
      priceUpdatedAt: null,
      priceUpdatedBy: null
    };
  }

  return {
    ...baseConfig,
    price: Number(row.checkout_price ?? baseConfig.price ?? 0),
    studentAlternativeDownloadUrl: row.student_alt_download_url || null,
    priceSource: 'database',
    priceUpdatedAt: row.updated_at || null,
    priceUpdatedBy: row.updated_by || null
  };
}

async function updateLicenseSettings({ price, studentAlternativeDownloadUrl, updatedBy = null }) {
  const hasPriceUpdate = price !== undefined;
  const hasStudentAlternativeDownloadUrlUpdate = studentAlternativeDownloadUrl !== undefined;

  if (!hasPriceUpdate && !hasStudentAlternativeDownloadUrlUpdate) {
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

  if (currentRow?.legacySchema) {
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

  const { data, error } = await supabase
    .from('license_settings')
    .upsert(payload, { onConflict: 'id' })
    .select(
      currentRow?.legacySchema
        ? 'id, checkout_price, updated_at, updated_by'
        : 'id, checkout_price, student_alt_download_url, updated_at, updated_by'
    )
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

  if (currentRow?.legacySchema) {
    return {
      ...data,
      student_alt_download_url: null,
      legacySchema: true
    };
  }

  return data;
}

export {
  getResolvedLicenseConfig,
  updateLicenseSettings
};
