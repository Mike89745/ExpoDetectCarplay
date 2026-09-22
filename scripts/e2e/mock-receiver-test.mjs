import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { startMockReceiver } from './mock-receiver.mjs';
import { validateForwardingRecords } from './verify-forwarding.mjs';

test('records payloads and applies deterministic retry policies', async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'expo-carplay-e2e-'));
  const logPath = path.join(directory, 'requests.jsonl');
  const receiver = await startMockReceiver({ port: 0, logPath });
  t.after(async () => {
    await receiver.close();
    fs.rmSync(directory, { recursive: true, force: true });
  });

  const post = (pathname) =>
    fetch(`${receiver.url}${pathname}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-csfr-token': 'test-key',
      },
      body: JSON.stringify({ eventType: 'onCarPlayConnected', id: 'device-1' }),
    });

  assert.equal((await post('/carplay-events')).status, 204);
  assert.equal((await post('/retry/carplay-events')).status, 503);
  assert.equal((await post('/retry/carplay-events')).status, 503);
  assert.equal((await post('/retry/carplay-events')).status, 204);
  assert.equal((await post('/client-error/carplay-events')).status, 422);

  const records = fs
    .readFileSync(logPath, 'utf8')
    .trim()
    .split(/\r?\n/)
    .map((line) => JSON.parse(line));
  assert.equal(records.length, 5);
  assert.deepEqual(
    records.filter((record) => record.path.startsWith('/retry/')).map((record) => record.attempt),
    [1, 2, 3]
  );
  assert.equal(records[0].headers['x-csfr-token'], 'test-key');
  assert.equal(records[0].body.id, 'device-1');
});

test('validates the complete CarPlay forwarding contract', () => {
  const record = (requestPath, eventType, attempt = 1) => ({
    path: requestPath,
    attempt,
    headers: { 'content-type': 'application/json', 'x-csfr-token': 'e2e-key' },
    body: { eventType, id: 'e2e-device', platform: 'ios', timestamp: 1, sdkVersion: 18 },
  });
  const records = [
    record('/carplay-events', 'onCarPlayConnected'),
    record('/carplay-events', 'onCarPlayDisconnected'),
    record('/carplay-events', 'onCarPlayError'),
    ...[1, 2, 3].map((attempt) => record('/retry/carplay-events', 'onCarPlayError', attempt)),
    record('/client-error/carplay-events', 'onCarPlayError'),
  ];

  assert.doesNotThrow(() => validateForwardingRecords(records, 'ios'));
  assert.throws(
    () => validateForwardingRecords(records.filter((item) => item.body.eventType !== 'onCarPlayDisconnected'), 'ios'),
    /onCarPlayDisconnected/
  );
});
