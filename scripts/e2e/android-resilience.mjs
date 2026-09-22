import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const windows = process.platform === 'win32';
const appId = 'expo.modules.detectcarplay.example';
const serviceName = 'expo.modules.detectcarplay.CarPlayForegroundService';

function command(binary, args, { capture = false, allowFailure = false } = {}) {
  const result = spawnSync(binary, args, {
    cwd: root,
    encoding: capture ? 'utf8' : undefined,
    env: process.env,
    shell: windows,
    stdio: capture ? 'pipe' : 'inherit',
  });
  if (!allowFailure && (result.error || result.status !== 0)) {
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
  command(maestroBinary(), ['test', `e2e/maestro/${flow}.yaml`]);
}

function sleep(milliseconds) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, milliseconds);
}

function serviceDump() {
  return command('adb', ['shell', 'dumpsys', 'activity', 'services', appId], {
    capture: true,
  }).stdout ?? '';
}

function assertServiceAlive(label) {
  if (!serviceDump().includes(serviceName)) {
    throw new Error(`Foreground service is not alive after ${label}`);
  }
  const notifications = command('adb', ['shell', 'dumpsys', 'notification', '--noredact'], {
    capture: true,
  }).stdout ?? '';
  if (!notifications.includes(appId)) {
    throw new Error(`Foreground notification is missing after ${label}`);
  }
}

function assertNoFatalCrash() {
  const log = command('adb', ['logcat', '-d'], { capture: true }).stdout ?? '';
  const fatalForApp = new RegExp(
    `FATAL EXCEPTION[\\s\\S]{0,800}Process: ${appId.replaceAll('.', '\\.')}`
  );
  if (fatalForApp.test(log)) throw new Error('Android logcat contains an application fatal exception');
}

function waitForBoot() {
  command('adb', ['wait-for-device']);
  for (let attempt = 0; attempt < 180; attempt += 1) {
    const result = command('adb', ['shell', 'getprop', 'sys.boot_completed'], {
      capture: true,
      allowFailure: true,
    });
    if ((result.stdout ?? '').trim() === '1') return;
    sleep(1000);
  }
  throw new Error('Android device did not finish rebooting');
}

command('adb', ['logcat', '-c']);
let seeded = false;
try {
  maestro('lifecycle-seed');
  seeded = true;
  sleep(1000);
  assertServiceAlive('lifecycle seed');

  command('adb', ['shell', 'input', 'keyevent', '3']);
  sleep(1000);
  assertServiceAlive('backgrounding');

  command('adb', ['shell', 'input', 'keyevent', '26']);
  sleep(500);
  assertServiceAlive('screen lock');
  command('adb', ['shell', 'input', 'keyevent', '224']);
  command('adb', ['shell', 'input', 'keyevent', '82']);

  command('adb', ['shell', 'dumpsys', 'battery', 'unplug']);
  command('adb', ['shell', 'dumpsys', 'deviceidle', 'force-idle']);
  sleep(1000);
  assertServiceAlive('Doze entry');
  command('adb', ['shell', 'dumpsys', 'deviceidle', 'unforce']);
  command('adb', ['shell', 'dumpsys', 'battery', 'reset']);

  command('adb', ['shell', 'am', 'force-stop', appId]);
  sleep(500);
  if (serviceDump().includes(serviceName)) {
    throw new Error('Foreground service survived an explicit force-stop');
  }
  maestro('lifecycle-verify');
  sleep(1000);
  assertServiceAlive('force-stop relaunch');

  if (process.env.E2E_INCLUDE_BLUETOOTH_TOGGLE === '1') {
    command('adb', ['shell', 'cmd', 'bluetooth_manager', 'disable']);
    sleep(1000);
    assertServiceAlive('Bluetooth disable');
    command('adb', ['shell', 'cmd', 'bluetooth_manager', 'enable']);
  }

  if (process.env.E2E_INCLUDE_REBOOT === '1') {
    command('adb', ['reboot']);
    waitForBoot();
    sleep(3000);
    assertServiceAlive('device reboot');
    maestro('lifecycle-verify');
  }

  assertNoFatalCrash();
  console.log('Android background, lock, Doze, force-stop, and relaunch checks passed.');
} finally {
  command('adb', ['shell', 'dumpsys', 'deviceidle', 'unforce'], { allowFailure: true });
  command('adb', ['shell', 'dumpsys', 'battery', 'reset'], { allowFailure: true });
  if (process.env.E2E_INCLUDE_BLUETOOTH_TOGGLE === '1') {
    command('adb', ['shell', 'cmd', 'bluetooth_manager', 'enable'], { allowFailure: true });
  }
  if (seeded) maestro('lifecycle-cleanup');
}
