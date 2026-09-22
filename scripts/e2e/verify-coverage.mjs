import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'e2e/coverage.json'), 'utf8'));

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8').replaceAll('\r\n', '\n');
}

function sorted(values) {
  return [...values].sort((left, right) => left.localeCompare(right));
}

function compare(label, actual, covered) {
  const missing = actual.filter((name) => !covered.includes(name));
  const stale = covered.filter((name) => !actual.includes(name));
  if (missing.length || stale.length) {
    if (missing.length) console.error(`${label} missing from coverage.json: ${missing.join(', ')}`);
    if (stale.length) console.error(`${label} no longer in the public API: ${stale.join(', ')}`);
    process.exitCode = 1;
  }
}

const moduleSource = read(manifest.declarations.moduleFile);
const classStart = moduleSource.indexOf(`class ${manifest.declarations.moduleType}`);
const classEnd = moduleSource.indexOf('\n}', classStart);
if (classStart < 0 || classEnd < 0)
  throw new Error('Could not locate the public native module class');
const classBody = moduleSource.slice(classStart, classEnd);
const methods = sorted(
  [...classBody.matchAll(/^\s{2}([A-Za-z_$][\w$]*)\s*\(/gm)].map((match) => match[1])
);

const eventSource = read(manifest.declarations.eventsFile);
const eventStart = eventSource.indexOf(`type ${manifest.declarations.eventsType}`);
const eventEnd = eventSource.indexOf('\n};', eventStart);
if (eventStart < 0 || eventEnd < 0) throw new Error('Could not locate the public event type');
const eventBody = eventSource.slice(eventStart, eventEnd);
const events = sorted(
  [...eventBody.matchAll(/^\s{2}([A-Za-z_$][\w$]*):/gm)].map((match) => match[1])
);

compare('Public methods', methods, sorted(Object.keys(manifest.coverage.methods)));
compare('Public events', events, sorted(Object.keys(manifest.coverage.events)));

for (const [surface, entries] of Object.entries(manifest.coverage)) {
  for (const [name, scenarioIds] of Object.entries(entries)) {
    if (!Array.isArray(scenarioIds) || scenarioIds.length === 0) {
      console.error(`${surface}.${name} has no E2E scenario`);
      process.exitCode = 1;
      continue;
    }
    for (const scenarioId of scenarioIds) {
      const scenario = manifest.scenarios[scenarioId];
      if (!scenario) {
        console.error(`${surface}.${name} references unknown scenario ${scenarioId}`);
        process.exitCode = 1;
        continue;
      }
      if (!fs.existsSync(path.join(root, scenario.evidence))) {
        console.error(`${scenarioId} evidence does not exist: ${scenario.evidence}`);
        process.exitCode = 1;
      }
    }
  }
}

if (!process.exitCode) {
  console.log(
    `E2E coverage map is complete: ${methods.length} methods, ${events.length} events, ` +
      `${Object.keys(manifest.coverage.supplemental).length} supplemental surfaces.`
  );
}
