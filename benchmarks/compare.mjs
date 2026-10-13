#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { BROWSERS, aggregate, validateResult } from './lib/results.mjs';

const equal = (left, right) => JSON.stringify(left) === JSON.stringify(right);
export function compareResults(baseline, candidate, catalog, options = {}) {
  validateResult(baseline, catalog); validateResult(candidate, catalog);
  const relative = options.relative ?? 0.15, absoluteMs = options.absoluteMs ?? 1;
  if (![relative, absoluteMs].every(value => Number.isFinite(value) && value >= 0)) throw new Error('invalid-thresholds');
  const output = { schemaVersion: 1, status: 'passed', thresholds: { relative, absoluteMs, statistics: ['median', 'p95'], rule: 'relative-and-absolute' }, compatibility: { overridden: Boolean(options.allowIncompatible), mismatches: [] }, comparisons: [] };
  const mismatch = code => output.compatibility.mismatches.push(code);
  if (!equal(baseline.harness, candidate.harness)) mismatch('harness');
  if (!equal(baseline.environment, candidate.environment)) mismatch('environment');
  if (!equal(baseline.configuration, candidate.configuration)) mismatch('configuration');
  for (const browser of baseline.browsers) {
    const other = candidate.browsers.find(item => item.id === browser.id);
    if (!other) { mismatch('browser-selection'); continue; }
    if (browser.version !== other.version) mismatch('browser-version');
    for (const scenario of browser.scenarios) {
      const counterpart = other.scenarios.find(item => item.id === scenario.id);
      if (counterpart && !equal(scenario.parameters, counterpart.parameters)) mismatch('workload');
    }
  }
  output.compatibility.mismatches = [...new Set(output.compatibility.mismatches)];
  const complete = baseline.status === 'passed' && candidate.status === 'passed'
    && [...baseline.browsers, ...candidate.browsers].every(browser => browser.status === 'passed');
  if (!complete) { output.status = 'incomplete'; return output; }
  if (output.compatibility.mismatches.length && !options.allowIncompatible) { output.status = 'incompatible'; return output; }
  let regression = false;
  for (const browser of baseline.browsers) {
    const other = candidate.browsers.find(item => item.id === browser.id);
    if (!other) continue;
    for (const scenario of browser.scenarios) {
      const counterpart = other.scenarios.find(item => item.id === scenario.id);
      if (!counterpart) continue;
      for (const [metric, metadata] of Object.entries(catalog.METRICS)) {
        const before = scenario.samples.map(sample => sample.metrics[metric]);
        const after = counterpart.samples.map(sample => sample.metrics[metric]);
        const beforeStats = aggregate(before), afterStats = aggregate(after);
        const statistics = Object.fromEntries(['median', 'p95'].map(statistic => {
          const deltaMs = afterStats[statistic] - beforeStats[statistic];
          const ratio = beforeStats[statistic] === 0 ? null : afterStats[statistic] / beforeStats[statistic];
          const regressed = deltaMs > absoluteMs && deltaMs > beforeStats[statistic] * relative;
          if (regressed) regression = true;
          return [statistic, { deltaMs, ratio, regressed }];
        }));
        output.comparisons.push({ browser: browser.id, scenario: scenario.id, metric, unit: metadata.unit, kind: metadata.kind ?? 'elapsed', baseline: { samples: before, ...beforeStats }, candidate: { samples: after, ...afterStats }, statistics });
      }
    }
  }
  output.status = regression ? 'regression' : output.compatibility.mismatches.length ? 'incomparable-override' : output.comparisons.length ? 'passed' : 'incomplete';
  return output;
}

export function renderComparisonSummary(comparison, catalog) {
  const invalid = () => { throw new Error('invalid-comparison'); };
  const statuses = ['passed', 'regression', 'incomplete', 'incompatible', 'incomparable-override'];
  const reasons = ['harness', 'environment', 'configuration', 'browser-selection', 'browser-version', 'workload'];
  if (!comparison || !statuses.includes(comparison.status)
    || typeof comparison.compatibility?.overridden !== 'boolean'
    || !Array.isArray(comparison.compatibility.mismatches)
    || comparison.compatibility.mismatches.some(reason => !reasons.includes(reason))
    || !Array.isArray(comparison.comparisons)) invalid();
  const { relative, absoluteMs } = comparison.thresholds ?? {};
  if (![relative, absoluteMs].every(value => typeof value === 'number' && Number.isFinite(value) && value >= 0)) invalid();
  const changes = [];
  let regressedCount = 0, improvedCount = 0;
  for (const entry of comparison.comparisons) {
    if (!BROWSERS.includes(entry.browser) || !catalog.SCENARIOS.some(scenario => scenario.id === entry.scenario)
      || !Object.hasOwn(catalog.METRICS, entry.metric)) invalid();
    let regressed = false, improved = false, magnitude = 0;
    for (const statistic of ['median', 'p95']) {
      const before = entry.baseline?.[statistic], after = entry.candidate?.[statistic];
      if (![before, after].every(value => typeof value === 'number' && Number.isFinite(value) && value >= 0)) invalid();
      const delta = after - before;
      const material = Math.abs(delta) > absoluteMs && Math.abs(delta) > before * relative;
      if (material) {
        regressed ||= delta > 0; improved ||= delta < 0;
        magnitude = Math.max(magnitude, Math.abs(delta));
      }
    }
    if (regressed) regressedCount++;
    if (improved) improvedCount++;
    if (regressed || improved) changes.push({ entry, magnitude, label: regressed && improved ? 'mixed changes' : regressed ? 'regression' : 'improvement' });
  }
  changes.sort((left, right) => right.magnitude - left.magnitude);
  const number = value => value > 0 && value < 0.001 ? value.toExponential(2) : String(Number(value.toFixed(3)));
  const mismatches = comparison.compatibility.mismatches;
  const compatibility = mismatches.length
    ? `${comparison.compatibility.overridden ? 'explicit override' : 'incompatible'} (${mismatches.join(', ')})`
    : 'matched metadata';
  const lines = [
    `Comparison: ${comparison.status}`,
    `Compatibility: ${compatibility}`,
    `Thresholds: more than ${number(relative * 100)}% AND ${number(absoluteMs)} ms (median or p95).`,
    `Observed metric changes: ${regressedCount} regressed, ${improvedCount} improved; ${comparison.comparisons.length} compared.`,
    'Changes are observed, not causal; a metric can improve in one statistic and regress in another.',
  ];
  if (!comparison.comparisons.length) lines.push('Timing changes were not evaluated.');
  else if (!changes.length) lines.push('No changes exceeded both thresholds.');
  else {
    lines.push(`Largest material changes (${Math.min(changes.length, 20)} of ${changes.length}, ranked by absolute time change):`);
    for (const { entry, label } of changes.slice(0, 20)) {
      lines.push(`  ${entry.browser} / ${entry.scenario} / ${entry.metric}: median ${number(entry.baseline.median)} → ${number(entry.candidate.median)} ms; p95 ${number(entry.baseline.p95)} → ${number(entry.candidate.p95)} ms (observed ${label})`);
    }
    if (changes.length > 20) lines.push(`${changes.length - 20} additional material changes; use --json or --output for all details.`);
  }
  return `${lines.join('\n')}\n`;
}

async function main(args) {
  if (args.includes('--help')) { process.stdout.write('Usage: node benchmarks/compare.mjs BASELINE CANDIDATE [--relative 0.15] [--absolute-ms 1] [--allow-incompatible] [--output FILE] [--json]\n'); return 0; }
  if (args.length < 2 || args[0].startsWith('--') || args[1].startsWith('--')) throw new Error('invalid-options');
  const options = {}; let output; let jsonOutput = false;
  for (let index = 2; index < args.length; index++) {
    const flag = args[index];
    if (flag === '--json') jsonOutput = true;
    else if (flag === '--allow-incompatible') options.allowIncompatible = true;
    else if (['--relative', '--absolute-ms', '--output'].includes(flag)) {
      const value = args[++index]; if (value === undefined) throw new Error('invalid-options');
      if (flag === '--output') output = value;
      else options[flag === '--relative' ? 'relative' : 'absoluteMs'] = Number(value);
    } else throw new Error('invalid-options');
  }
  const catalog = await import('./fixtures/catalog.mjs');
  const comparison = compareResults(JSON.parse(await readFile(args[0], 'utf8')), JSON.parse(await readFile(args[1], 'utf8')), catalog, options);
  const json = `${JSON.stringify(comparison, null, 2)}\n`;
  if (output) await writeFile(output, json, { flag: 'wx' });
  process.stdout.write(jsonOutput ? json : renderComparisonSummary(comparison, catalog));
  return comparison.status === 'passed' ? 0 : comparison.status === 'regression' ? 1 : 2;
}
function isMainModule() {
  if (!process.argv[1]) return false;
  try { return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url)); }
  catch { return false; }
}

if (isMainModule()) {
  try { process.exitCode = await main(process.argv.slice(2)); }
  catch { process.stderr.write('Benchmark comparison failed: invalid input, schema, options, or output.\n'); process.exitCode = 3; }
}
