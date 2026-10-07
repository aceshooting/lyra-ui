import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isMainModule } from './is-main-module.mjs';

const packageDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const baselinePath = path.join(packageDir, 'scripts/fixtures/test-wait-baseline.json');
const WAIT = /\baTimeout\s*\(\s*(\d{3,})\s*\)|\bsetTimeout\s*\(\s*[A-Za-z_$][\w$]*\s*,\s*(\d{3,})\s*\)/g;
const TEST = /\b(?:it|test|specify)\s*\(\s*(['"`])([^'"`]+)\1/;

/** Stable test title + call fingerprint; line moves do not renew a wait allowance. */
export function literalLongWaits(source, file) {
  const rows = [];
  let scope = '<module>';
  const lines = source.split(/\r?\n/);
  for (let index = 0; index < lines.length; index++) {
    const title = TEST.exec(lines[index]);
    if (title) scope = title[2];
    for (const match of lines[index].matchAll(WAIT)) {
      const call = `${match[1] ? 'aTimeout' : 'setTimeout'}(${match[1] ?? match[2]})`;
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
  const rows = [...testFiles(path.join(packageDir, 'src'), 'src'), ...testFiles(path.join(packageDir, 'test'), 'test')]
    .flatMap(file => literalLongWaits(readFileSync(path.join(packageDir, file), 'utf8'), file));
  return newLongWaits(rows, baseline);
}

if (isMainModule(import.meta.url)) {
  const failures = checkTestWaits();
  if (failures.length) {
    process.stderr.write(`New literal waits of 100 ms or more need a nearby wait-reason comment:\n${failures.join('\n')}\n`);
    process.exitCode = 1;
  }
}
