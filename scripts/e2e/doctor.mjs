import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const platform = process.argv[2] ?? (process.platform === 'darwin' ? 'ios' : 'android');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const windows = process.platform === 'win32';
const failures = [];

function run(command, args) {
  return spawnSync(command, args, {
    encoding: 'utf8',
    env: process.env,
    shell: windows,
  });
}

function requireCommand(command, args = ['--version'], label = command) {
  const result = run(command, args);
  if (result.error || result.status !== 0) failures.push(`${label} is not available`);
  else console.log(`✓ ${label}`);
  return result;
}

function resolveMaestroCommand() {
  if (process.env.MAESTRO_BIN) return process.env.MAESTRO_BIN;
  if (windows && process.env.USERPROFILE) {
    const installed = path.join(process.env.USERPROFILE, '.maestro', 'bin', 'maestro.bat');
    if (fs.existsSync(installed)) return installed;
  }
  return 'maestro';
}

requireCommand('node');
requireCommand('npm');
requireCommand(resolveMaestroCommand(), ['--version'], 'maestro');
if (!fs.existsSync(path.join(root, 'node_modules'))) {
  failures.push('root dependencies are missing; run npm ci');
}
if (!fs.existsSync(path.join(root, 'example/node_modules/expo/package.json'))) {
  failures.push('example dependencies are missing; run npm --prefix example ci');
}

if (platform === 'android') {
  requireCommand('java', ['-version']);
  const adb = requireCommand('adb', ['version']);
  if (adb.status === 0) {
    const devices = run('adb', ['devices']);
    const connected = (devices.stdout ?? '').split(/\r?\n/).some((line) => /\sdevice$/.test(line));
    if (!connected) failures.push('no booted Android emulator or connected device was found');
    else console.log('✓ Android device');
  }
} else if (platform === 'ios') {
  if (process.platform !== 'darwin') failures.push('iOS E2E requires macOS and Xcode');
  const xcrun = requireCommand('xcrun', ['--version']);
  if (xcrun.status === 0) {
    const simulators = run('xcrun', ['simctl', 'list', 'devices', 'booted']);
    if (!/\(Booted\)/.test(simulators.stdout ?? '')) {
      failures.push('no booted iOS simulator was found');
    } else console.log('✓ iOS simulator');
  }
} else {
  failures.push(`unsupported platform ${platform}; expected android or ios`);
}

if (failures.length) {
  for (const failure of failures) console.error(`✗ ${failure}`);
  process.exit(1);
}
