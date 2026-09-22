import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const output = fs.mkdtempSync(path.join(os.tmpdir(), 'expo-carplay-pack-'));
const required = [
  'package.json',
  'app.plugin.js',
  'build/index.js',
  'build/index.d.ts',
  'build/cjs/index.js',
  'plugin/build/index.js',
  'plugin/build/index.d.ts',
  'android/src/main/AndroidManifest.xml',
  'ios/ExpoDetectCarplay.podspec',
];

try {
  const result = spawnSync(
    'npm',
    ['pack', '--json', '--ignore-scripts', '--pack-destination', output],
    { cwd: root, encoding: 'utf8', shell: process.platform === 'win32' }
  );
  if (result.error || result.status !== 0) {
    throw result.error ?? new Error(result.stderr || `npm pack exited with ${result.status}`);
  }
  const jsonStart = result.stdout.lastIndexOf('\n[');
  assert(jsonStart >= 0, 'npm pack did not return a JSON manifest');
  const [manifest] = JSON.parse(result.stdout.slice(jsonStart + 1));
  const files = new Set(manifest.files.map((item) => item.path.replaceAll('\\', '/')));
  for (const file of required) assert(files.has(file), `Packed package is missing ${file}`);
  for (const file of files) {
    assert(!file.startsWith('src/__tests__/'), `Packed package contains test file ${file}`);
    assert(!file.startsWith('e2e/'), `Packed package contains E2E fixture ${file}`);
    assert(!file.startsWith('example/'), `Packed package contains example file ${file}`);
  }
  console.log(`Package smoke test passed for ${manifest.filename} (${files.size} files).`);
} finally {
  fs.rmSync(output, { recursive: true, force: true });
}
