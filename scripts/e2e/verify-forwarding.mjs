import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REQUIRED_EVENTS = [
  'onCarPlayConnected',
  'onCarPlayDisconnected',
  'onCarPlayError',
];

function invariant(value, message) {
  if (!value) throw new Error(message);
}

export function validateForwardingRecords(records, platform) {
  const normal = records.filter((record) => record.path === '/carplay-events');
  const types = normal.map((record) => record.body?.eventType);
  let previousIndex = -1;
  for (const eventType of REQUIRED_EVENTS) {
    const index = types.indexOf(eventType);
    invariant(index >= 0, `Missing forwarded ${eventType}`);
    invariant(index > previousIndex, `Forwarded ${eventType} arrived out of order`);
    previousIndex = index;
  }

  for (const record of normal) {
    invariant(record.headers?.['x-csfr-token'] === 'e2e-key', 'Forwarded API key header is missing');
    invariant(record.body?.id === 'e2e-device', 'Forwarded device ID is missing');
    invariant(record.body?.platform === platform, `Expected ${platform} forwarding payload`);
    invariant(typeof record.body?.timestamp === 'number', 'Forwarded timestamp is missing');
    invariant(typeof record.body?.sdkVersion === 'number', 'Forwarded SDK version is missing');
    invariant(!Object.hasOwn(record.body, 'apiKey'), 'API key leaked into a forwarding body');
  }

  const retryAttempts = records
    .filter((record) => record.path === '/retry/carplay-events')
    .map((record) => record.attempt);
  invariant(
    JSON.stringify(retryAttempts) === '[1,2,3]',
    `Expected retry attempts 1,2,3; got ${retryAttempts}`
  );
  invariant(
    records.filter((record) => record.path === '/client-error/carplay-events').length === 1,
    'HTTP 4xx forwarding was retried'
  );
}

function readRecords(logPath) {
  if (!fs.existsSync(logPath)) return [];
  return fs
    .readFileSync(logPath, 'utf8')
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

async function verifyEventually(logPath, platform) {
  const deadline = Date.now() + 20_000;
  let lastError = new Error('No forwarding requests were received');
  while (Date.now() < deadline) {
    try {
      const records = readRecords(logPath);
      validateForwardingRecords(records, platform);
      console.log(`Verified ${records.length} native forwarding requests.`);
      return;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  throw lastError;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const platform = process.argv[2];
  const logPath = path.resolve(process.argv[3] ?? '.e2e-artifacts/forwarding.jsonl');
  if (!new Set(['android', 'ios']).has(platform)) {
    throw new Error('Usage: node scripts/e2e/verify-forwarding.mjs <android|ios> [log-path]');
  }
  await verifyEventually(logPath, platform);
}
