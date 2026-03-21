import { getEnv } from './config.js';

function normalizePath(value) {
  return String(value || '')
    .trim()
    .replace(/\\/g, '/')
    .replace(/^\/+/g, '');
}

function getAppReleaseConfig() {
  const bucket = String(getEnv('APP_RELEASE_BUCKET', 'releases') || '').trim() || 'releases';

  const studentApkPath = normalizePath(getEnv('APP_STUDENT_APK_PATH', 'edukreasi-siswa.apk'));
  const adminExePath = normalizePath(getEnv('APP_ADMIN_EXE_PATH', 'edukreasi-proktor-admin.exe'));

  return {
    bucket,
    items: {
      student_apk: {
        id: 'student_apk',
        label: 'Exam Edu Kreasi Siswa (APK)',
        path: studentApkPath,
        expectedExt: '.apk',
        defaultContentType: 'application/vnd.android.package-archive'
      },
      admin_exe: {
        id: 'admin_exe',
        label: 'Exam Edu Kreasi Proktor/Admin (EXE)',
        path: adminExePath,
        expectedExt: '.exe',
        defaultContentType: 'application/octet-stream'
      }
    }
  };
}

export { getAppReleaseConfig };

