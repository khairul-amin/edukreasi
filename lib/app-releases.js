import { getEnv } from './config.js';

function normalizePath(value) {
  return String(value || '')
    .trim()
    .replace(/\\/g, '/')
    .replace(/^\/+/g, '');
}

function stripTrailingSlashes(value) {
  return String(value || '').replace(/\/+$/g, '');
}

function dirname(path) {
  const clean = stripTrailingSlashes(normalizePath(path));
  const idx = clean.lastIndexOf('/');
  if (idx < 0) return '';
  return clean.slice(0, idx);
}

function resolvePathMode(value, expectedExt, defaultDir) {
  const normalized = stripTrailingSlashes(normalizePath(value));
  const fallback = stripTrailingSlashes(normalizePath(defaultDir));
  const finalValue = normalized || fallback;

  if (finalValue.toLowerCase().endsWith(expectedExt)) {
    return {
      mode: 'fixed',
      fixedPath: finalValue,
      dir: dirname(finalValue)
    };
  }

  return {
    mode: 'dir',
    fixedPath: '',
    dir: finalValue
  };
}

function getAppReleaseConfig() {
  const bucket = String(getEnv('APP_RELEASE_BUCKET', 'releases') || '').trim() || 'releases';
  const publicBaseUrl = stripTrailingSlashes(getEnv('APP_RELEASE_PUBLIC_BASE_URL', ''));

  const studentApk = resolvePathMode(getEnv('APP_STUDENT_APK_PATH', 'student'), '.apk', 'student');
  const adminExe = resolvePathMode(getEnv('APP_ADMIN_EXE_PATH', 'admin'), '.exe', 'admin');

  return {
    bucket,
    publicBaseUrl,
    items: {
      student_apk: {
        id: 'student_apk',
        label: 'Exam Edu Kreasi Siswa (APK)',
        ...studentApk,
        expectedExt: '.apk',
        defaultContentType: 'application/vnd.android.package-archive'
      },
      admin_exe: {
        id: 'admin_exe',
        label: 'Exam Edu Kreasi Proktor/Admin (EXE)',
        ...adminExe,
        expectedExt: '.exe',
        defaultContentType: 'application/octet-stream'
      }
    }
  };
}

export { getAppReleaseConfig };
