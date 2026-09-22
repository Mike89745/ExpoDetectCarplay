import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import test from 'node:test';

const execFileAsync = promisify(execFile);
const verifier = path.resolve('scripts/e2e/verify-hardware-evidence.mjs');

test('accepts complete Android and iOS hardware evidence', async (t) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'carplay-hardware-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  await fs.writeFile(path.join(directory, 'capture.txt'), 'evidence');
  const commonChecks = {
    permissions: 'pass',
    diagnostics: 'pass',
    wiredConnection: 'pass',
    wirelessConnection: 'pass',
    rapidTransitions: 'pass',
    backgroundAndRelaunch: 'pass',
    stopAndCleanup: 'pass',
    notifications: 'pass',
    eventStorage: 'pass',
    httpsForwarding: 'pass',
    failurePaths: 'pass',
  };
  const evidence = {
    schemaVersion: 1,
    repository: 'expo-detect-carplay',
    commit: '0123456789abcdef',
    packageVersion: '1.0.7',
    runs: {
      android: {
        device: 'Pixel',
        osVersion: 'Android 16 API 36',
        completedAt: '2026-09-21T10:00:00.000Z',
        checks: { ...commonChecks, rebootAndProcessRecovery: 'pass' },
        artifacts: ['capture.txt'],
      },
      ios: {
        device: 'iPhone',
        osVersion: 'iOS 26',
        completedAt: '2026-09-21T11:00:00.000Z',
        checks: { ...commonChecks, entitlements: 'pass' },
        artifacts: ['https://example.invalid/ios-evidence'],
      },
    },
  };
  const evidencePath = path.join(directory, 'evidence.json');
  await fs.writeFile(evidencePath, JSON.stringify(evidence));

  const result = await execFileAsync(process.execPath, [verifier, evidencePath]);
  assert.match(result.stdout, /Physical hardware evidence is complete/);
});

test('rejects an incomplete hardware evidence template', async () => {
  await assert.rejects(
    execFileAsync(process.execPath, [verifier, 'e2e/hardware-evidence.example.json']),
    (error) => /android\.checks\.permissions must be pass/.test(error.stderr)
  );
});
