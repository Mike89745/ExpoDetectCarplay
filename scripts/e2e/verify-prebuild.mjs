import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const sourceExample = path.resolve(root, process.env.E2E_EXAMPLE_DIR ?? 'example');
const example = fs.mkdtempSync(path.join(root, '.e2e-prebuild-'));
const platform = process.argv[2] ?? (process.platform === 'darwin' ? 'ios' : 'android');
const generated = path.join(example, platform);
const windows = process.platform === 'win32';
const ignoredDirectories = new Set(['.gradle', '.kotlin', 'build', 'Pods', 'DerivedData']);

if (!new Set(['android', 'ios']).has(platform)) {
  console.error('Usage: node scripts/e2e/verify-prebuild.mjs <android|ios>');
  process.exit(1);
}

function execute(command, args, cwd = root) {
  const result = spawnSync(command, args, {
    cwd,
    env: { ...process.env, CI: '1', EXPO_NO_TELEMETRY: '1' },
    shell: windows,
    stdio: 'inherit',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} exited with status ${result.status ?? 1}`);
}

function prebuildFlags() {
  const result = spawnSync('npx', ['expo', 'prebuild', '--help'], {
    cwd: example,
    encoding: 'utf8',
    shell: windows,
  });
  if (result.status !== 0) throw new Error('Unable to inspect Expo prebuild options');
  const help = result.stdout ?? '';
  return {
    clean: help.includes('--clean') ? ['--clean'] : [],
    reuse: help.includes('--no-clean') ? ['--no-clean'] : [],
  };
}

function snapshot(directory, prefix = '') {
  const result = new Map();
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) continue;
    const absolute = path.join(directory, entry.name);
    const relative = path.join(prefix, entry.name).replaceAll('\\', '/');
    if (entry.isDirectory()) {
      for (const [name, hash] of snapshot(absolute, relative)) result.set(name, hash);
    } else {
      result.set(
        relative,
        crypto.createHash('sha256').update(fs.readFileSync(absolute)).digest('hex')
      );
    }
  }
  return result;
}

try {
  fs.cpSync(sourceExample, example, {
    recursive: true,
    filter: (source) => {
      const relative = path.relative(sourceExample, source);
      const topLevel = relative.split(path.sep)[0];
      return !new Set(['.expo', 'android', 'ios', 'node_modules']).has(topLevel);
    },
  });
  execute('npm', ['run', 'build']);
  const flags = prebuildFlags();
  execute(
    'npx',
    ['expo', 'prebuild', ...flags.clean, '--no-install', '--platform', platform],
    example
  );
  const first = snapshot(generated);
  execute(
    'npx',
    ['expo', 'prebuild', ...flags.reuse, '--no-install', '--platform', platform],
    example
  );
  const second = snapshot(generated);

  const changed = [...new Set([...first.keys(), ...second.keys()])].filter(
    (name) => first.get(name) !== second.get(name)
  );
  if (changed.length) {
    throw new Error(
      `Prebuild is not idempotent; changed files:\n${changed
        .slice(0, 30)
        .map((name) => `- ${name}`)
        .join('\n')}`
    );
  }

  console.log(`Prebuild is idempotent across ${first.size} generated ${platform} files.`);
} finally {
  fs.rmSync(example, { recursive: true, force: true });
}
