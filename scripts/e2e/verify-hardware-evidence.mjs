import fs from 'node:fs';
import path from 'node:path';

const evidenceArgument = process.argv[2];
if (!evidenceArgument) {
  console.error('Usage: npm run test:e2e:hardware:evidence -- <hardware-evidence.json>');
  process.exit(1);
}

const evidencePath = path.resolve(evidenceArgument);
const evidenceDirectory = path.dirname(evidencePath);
const evidence = JSON.parse(fs.readFileSync(evidencePath, 'utf8'));
const expectedChecks = {
  android: [
    'permissions',
    'diagnostics',
    'wiredConnection',
    'wirelessConnection',
    'rapidTransitions',
    'backgroundAndRelaunch',
    'rebootAndProcessRecovery',
    'stopAndCleanup',
    'notifications',
    'eventStorage',
    'httpsForwarding',
    'failurePaths',
  ],
  ios: [
    'permissions',
    'diagnostics',
    'wiredConnection',
    'wirelessConnection',
    'rapidTransitions',
    'backgroundAndRelaunch',
    'stopAndCleanup',
    'notifications',
    'eventStorage',
    'httpsForwarding',
    'failurePaths',
    'entitlements',
  ],
};

const errors = [];
if (evidence.schemaVersion !== 1) errors.push('schemaVersion must be 1');
if (evidence.repository !== 'expo-detect-carplay') {
  errors.push('repository must be expo-detect-carplay');
}
for (const field of ['commit', 'packageVersion']) {
  if (!evidence[field] || String(evidence[field]).startsWith('replace-')) {
    errors.push(`${field} must identify the tested release`);
  }
}

for (const [platform, checks] of Object.entries(expectedChecks)) {
  const run = evidence.runs?.[platform];
  if (!run) {
    errors.push(`${platform} run is missing`);
    continue;
  }
  for (const field of ['device', 'osVersion', 'completedAt']) {
    if (!run[field] || String(run[field]).startsWith('replace-')) {
      errors.push(`${platform}.${field} is missing`);
    }
  }
  if (Number.isNaN(Date.parse(run.completedAt))) {
    errors.push(`${platform}.completedAt must be an ISO date`);
  }
  for (const check of checks) {
    if (run.checks?.[check] !== 'pass') {
      errors.push(`${platform}.checks.${check} must be pass`);
    }
  }
  if (!Array.isArray(run.artifacts) || run.artifacts.length === 0) {
    errors.push(`${platform}.artifacts must contain captured evidence`);
  } else {
    for (const artifact of run.artifacts) {
      if (typeof artifact !== 'string' || artifact.startsWith('replace-')) {
        errors.push(`${platform} contains an invalid artifact reference`);
      } else if (
        !/^https:\/\//i.test(artifact) &&
        !fs.existsSync(path.resolve(evidenceDirectory, artifact))
      ) {
        errors.push(`${platform} artifact does not exist: ${artifact}`);
      }
    }
  }
}

if (errors.length) {
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`Physical hardware evidence is complete: ${evidencePath}`);
