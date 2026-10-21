#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
import { isMainModule } from './is-main-module.mjs';

const KINDS = {
  tests: { file: 'test-file-costs.json', key: 'file', seconds: (record) => record.deltaMs / 1000 },
  lint: { file: 'lint-command-costs.json', key: 'command', seconds: (record) => record.seconds },
};
const tablePath = (kind) => new URL(`./fixtures/${KINDS[kind].file}`, import.meta.url);

const median = (values) => {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};

/**
 * Per-key seconds from WTR_TIMING_REPORT (`tests`) or LINT_TIMING_REPORT (`lint`) JSON lines. Pass the
 * reports of several runs: a file's cost is the median of its observations, because one slow runner
 * (or a completion delta attributed to the neighbouring file) would otherwise dominate a maximum.
 */
export function costsFromTimingReports(kind, texts) {
  const { key, seconds } = KINDS[kind];
  const observations = new Map();
  for (const line of texts.join('\n').split('\n').filter((entry) => entry.trim())) {
    const record = JSON.parse(line);
    const value = seconds(record);
    if (typeof record[key] !== 'string' || !record[key] || !Number.isFinite(value) || value < 0) {
      throw new TypeError(`Invalid ${kind} timing record: ${line}`);
    }
    observations.set(record[key], [...(observations.get(record[key]) ?? []), value]);
  }
  if (observations.size === 0) throw new Error(`No ${kind} timing records.`);
  const table = [...observations].map(([name, values]) => [name, Math.max(0.1, Math.round(median(values) * 10) / 10)]);
  return Object.fromEntries(table.sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0)));
}

/** The committed table as a Map plus its median, the cost of anything it does not list. */
export function readCosts(kind, file = tablePath(kind)) {
  const entries = Object.entries(JSON.parse(readFileSync(file, 'utf8')));
  if (entries.length === 0 || entries.some(([, value]) => !Number.isFinite(value) || value <= 0)) {
    throw new TypeError(`${file} must map every entry to positive seconds.`);
  }
  const sorted = entries.map(([, value]) => value).sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return { costs: new Map(entries), fallback: sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2 };
}

if (isMainModule(import.meta.url)) {
  const [kind, ...reports] = process.argv.slice(2);
  if (!KINDS[kind] || reports.length === 0) throw new Error('Usage: ci-costs.mjs <tests|lint> <timing.jsonl>...');
  const table = costsFromTimingReports(kind, reports.map((report) => readFileSync(report, 'utf8')));
  writeFileSync(tablePath(kind), `${JSON.stringify(table, null, 2)}\n`);
  console.log(`Wrote ${Object.keys(table).length} ${kind} costs.`);
}
