import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const windows = process.platform === 'win32';
const appId = 'expo.modules.detectcarplay.example';
const serviceName = 'expo.modules.detectcarplay.CarPlayForegroundService';
const currentApk = path.resolve(
  process.env.E2E_CURRENT_APK ??
    path.join(root, 'example/android/app/build/outputs/apk/release/app-release.apk')
);

function command(binary, args, { capture = false } = {}) {
  const result = spawnSync(binary, args, {
    cwd: root,
    encoding: capture ? 'utf8' : undefined,
    env: process.env,
    shell: windows,
    stdio: capture ? 'pipe' : 'inherit',
  });
  if (result.error || result.status !== 0) {
    throw result.error ?? new Error(`${binary} exited with status ${result.status}`);
  }
  return result;
}

function maestroBinary() {
  if (process.env.MAESTRO_BIN) return process.env.MAESTRO_BIN;
  if (windows && process.env.USERPROFILE) {
    const candidate = path.join(process.env.USERPROFILE, '.maestro', 'bin', 'maestro.bat');
    if (fs.existsSync(candidate)) return candidate;
  }
  return 'maestro';
}

function maestro(flow) {
  command(maestroBinary(), ['test', flow]);
}

function assertServiceRecovered() {
  const dump = command('adb', ['shell', 'dumpsys', 'activity', 'services', appId], {
    capture: true,
  }).stdout ?? '';
  if (!dump.includes(serviceName)) {
    throw new Error('Foreground monitoring did not recover after package replacement');
  }
}

if (!fs.existsSync(currentApk)) {
  throw new Error(`Current release APK not found: ${currentApk}. Run test:e2e:android first.`);
}

const previousApk = process.env.E2E_PREVIOUS_APK
  ? path.resolve(process.env.E2E_PREVIOUS_APK)
  : null;
if (previousApk) {
  if (!fs.existsSync(previousApk)) throw new Error(`Previous APK not found: ${previousApk}`);
  if (!process.env.E2E_PREVIOUS_SEED_FLOW) {
    throw new Error('E2E_PREVIOUS_SEED_FLOW is required with E2E_PREVIOUS_APK');
  }
  command('adb', ['install', '-r', '-d', previousApk]);
  maestro(path.resolve(process.env.E2E_PREVIOUS_SEED_FLOW));
} else {
  maestro('e2e/maestro/lifecycle-seed.yaml');
}

try {
  command('adb', ['install', '-r', currentApk]);
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 3000);
  assertServiceRecovered();
  maestro('e2e/maestro/lifecycle-verify.yaml');
  console.log(previousApk ? 'Previous-version upgrade state passed.' : 'In-place APK update state passed.');
} finally {
  maestro('e2e/maestro/lifecycle-cleanup.yaml');
}
