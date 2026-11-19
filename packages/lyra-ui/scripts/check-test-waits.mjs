import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isMainModule } from './is-main-module.mjs';

const packageDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const baselinePath = path.join(packageDir, 'scripts/fixtures/test-wait-baseline.json');
const TEST = /\b(?:it|test|specify)\s*\(\s*(['"`])([^'"`]+)\1/;
const MIN_WAIT_MS = 100;
const CONSTANT = /\bconst\s+([A-Za-z_$][\w$]*)\s*=\s*(\d{3,})\s*(?:;|,|$)/;
const SLEEP_WRAPPER = /(?:\bconst|\blet)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*(?::[^=]+)?=>|\bfunction\s+([A-Za-z_$][\w$]*)\s*\(/;

/** Names of local helpers whose body wraps `setTimeout` in a promise, so `sleep(300)` is a wait too. */
function sleepWrappers(lines) {
  const names = new Set();
  lines.forEach((line, index) => {
    const declared = SLEEP_WRAPPER.exec(line);
    if (!declared) return;
    const body = lines.slice(index, index + 4).join('\n');
    if (/new Promise/.test(body) && /setTimeout\s*\(/.test(body)) names.add(declared[1] ?? declared[2]);
  });
  return names;
}

/** Stable test title + call fingerprint; line moves do not renew a wait allowance. */
export function literalLongWaits(source, file) {
  const rows = [];
  let scope = '<module>';
  const lines = source.split(/\r?\n/);
  const constants = new Map();
  for (const line of lines) {
    const constant = CONSTANT.exec(line);
    if (constant) constants.set(constant[1], Number(constant[2]));
  }
  const callees = ['aTimeout', ...sleepWrappers(lines)].map(name => name.replace(/[$]/g, '\\$'));
  const direct = new RegExp(`\\b(${callees.join('|')})\\s*\\(\\s*(\\d{3,}|[A-Za-z_$][\\w$]*)\\s*\\)`, 'g');
  const timer = /\bsetTimeout\s*\(\s*[A-Za-z_$][\w$]*\s*,\s*(\d{3,}|[A-Za-z_$][\w$]*)\s*\)/g;
  for (let index = 0; index < lines.length; index++) {
    const title = TEST.exec(lines[index]);
    if (title) scope = title[2];
    const calls = [];
    for (const match of lines[index].matchAll(direct)) calls.push([match[1], match[2]]);
    for (const match of lines[index].matchAll(timer)) calls.push(['setTimeout', match[1]]);
    for (const [name, argument] of calls) {
      const literal = /^\d+$/.test(argument);
      const milliseconds = literal ? Number(argument) : constants.get(argument);
      if (milliseconds === undefined || milliseconds < MIN_WAIT_MS) continue;
      const call = `${name}(${literal ? argument : `${argument}=${milliseconds}`})`;
      const key = `${file}\t${scope}\t${call}`;
      const reason = lines.slice(Math.max(0, index - 2), index + 1).some(line => /wait-reason:\s*\S/.test(line));
      rows.push({ key, reason, line: index + 1 });
    }
  }
  return rows;
}

export function newLongWaits(rows, baseline) {
  const grouped = new Map();
  for (const row of rows) {
    const group = grouped.get(row.key) ?? [];
    group.push(row);
    grouped.set(row.key, group);
  }
  const failures = [];
  for (const [key, group] of grouped) {
    const allowance = (baseline[key] ?? 0) + group.filter(row => row.reason).length;
    if (group.length > allowance) failures.push(`${key} (${group.length - allowance} new wait${group.length - allowance === 1 ? '' : 's'})`);
  }
  return failures.sort();
}

function testFiles(dir, prefix = '') {
  const files = [];
  for (const item of readdirSync(dir, { withFileTypes: true })) {
    const relative = path.posix.join(prefix, item.name);
    if (item.isDirectory()) files.push(...testFiles(path.join(dir, item.name), relative));
    else if (/\.test\.(?:ts|js|mjs)$/.test(item.name)) files.push(relative);
  }
  return files;
}

export function checkTestWaits() {
  const baseline = JSON.parse(readFileSync(baselinePath, 'utf8'));
  const files = [...testFiles(path.join(packageDir, 'src'), 'src'), ...testFiles(path.join(packageDir, 'test'), 'test')];
  const rows = files.flatMap(file => literalLongWaits(readFileSync(path.join(packageDir, file), 'utf8'), file));
  return { failures: newLongWaits(rows, baseline), waits: rows.length, files: files.length };
}

if (isMainModule(import.meta.url)) {
  const { failures, waits, files } = checkTestWaits();
  process.stdout.write(`Examined ${waits} waits of ${MIN_WAIT_MS} ms or more across ${files} test files.\n`);
  if (failures.length) {
    process.stderr.write(`New waits of ${MIN_WAIT_MS} ms or more need a nearby wait-reason comment:\n${failures.join('\n')}\n`);
    process.exitCode = 1;
  }
}
