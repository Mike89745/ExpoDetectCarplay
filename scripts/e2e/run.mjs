import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const example = path.resolve(root, process.env.E2E_EXAMPLE_DIR ?? 'example');
const platform = process.argv[2];
const windows = process.platform === 'win32';

if (!new Set(['android', 'ios']).has(platform)) {
  console.error('Usage: node scripts/e2e/run.mjs <android|ios>');
  process.exit(1);
}

function execute(command, args, cwd = root) {
  console.log(`\n> ${command} ${args.join(' ')}`);
  const result = spawnSync(command, args, {
    cwd,
    env: { ...process.env, CI: '1', EXPO_NO_TELEMETRY: '1' },
    shell: windows,
    stdio: 'inherit',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} exited with status ${result.status ?? 1}`);
}

function cleanPrebuildArgs() {
  const result = spawnSync('npx', ['expo', 'prebuild', '--help'], {
    cwd: example,
    encoding: 'utf8',
    shell: windows,
  });
  if (result.status !== 0) throw new Error('Unable to inspect Expo prebuild options');
  return (result.stdout ?? '').includes('--clean') ? ['--clean'] : [];
}

function waitForReceiver() {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const result = spawnSync(
      process.execPath,
      [
        '-e',
        'fetch("http://127.0.0.1:19099/health").then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))',
      ],
      { stdio: 'ignore' }
    );
    if (result.status === 0) return;
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100);
  }
  throw new Error('Mock forwarding receiver did not start');
}

function androidApiLevel() {
  const result = spawnSync('adb', ['shell', 'getprop', 'ro.build.version.sdk'], {
    encoding: 'utf8',
    shell: windows,
  });
  return Number((result.stdout ?? '').trim());
}

function resolveMaestroCommand() {
  if (process.env.MAESTRO_BIN) return process.env.MAESTRO_BIN;
  if (windows && process.env.USERPROFILE) {
    const installed = path.join(process.env.USERPROFILE, '.maestro', 'bin', 'maestro.bat');
    if (fs.existsSync(installed)) return installed;
  }
  return 'maestro';
}

let receiver;
let reversedPort = false;
try {
  execute('node', ['scripts/e2e/doctor.mjs', platform]);
  execute('npm', ['run', 'build']);
  execute(
    'npx',
    ['expo', 'prebuild', ...cleanPrebuildArgs(), '--no-install', '--platform', platform],
    example
  );

  if (platform === 'android') {
    execute('npx', ['expo', 'run:android', '--variant', 'release', '--no-bundler'], example);
  } else {
    execute('npx', ['expo', 'run:ios', '--configuration', 'Release', '--no-bundler'], example);
  }

  const artifacts = path.join(root, '.e2e-artifacts');
  const forwardingLog = path.join(artifacts, `forwarding-${platform}.jsonl`);
  fs.mkdirSync(artifacts, { recursive: true });
  receiver = spawn(
    process.execPath,
    ['scripts/e2e/mock-receiver.mjs', '--port', '19099', '--log', forwardingLog],
    { cwd: root, stdio: 'inherit' }
  );
  waitForReceiver();

  if (platform === 'android') {
    execute('adb', ['reverse', 'tcp:19099', 'tcp:19099']);
    reversedPort = true;
    if (androidApiLevel() >= 31) {
      execute(resolveMaestroCommand(), ['test', 'e2e/maestro/permission-denied.yaml']);
    }
  } else {
    execute(resolveMaestroCommand(), ['test', 'e2e/maestro/permission-denied.yaml']);
  }
  execute(resolveMaestroCommand(), ['test', 'e2e/maestro/native-api.yaml']);
  execute('node', ['scripts/e2e/verify-forwarding.mjs', platform, forwardingLog]);
  if (platform === 'android') {
    execute('node', ['scripts/e2e/android-resilience.mjs']);
    execute('node', ['scripts/e2e/android-upgrade.mjs']);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  if (reversedPort) {
    spawnSync('adb', ['reverse', '--remove', 'tcp:19099'], {
      shell: windows,
      stdio: 'ignore',
    });
  }
  receiver?.kill();
}
