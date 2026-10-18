import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const informational = /(?:ms$|time|duration|heap|memory|bytes)/i;
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
function validateCounters(counters) {
  if (!object(counters) || !Object.keys(counters).length) throw new Error('Counters must be a nonempty object');
  for (const [key, value] of Object.entries(counters)) {
    if (informational.test(key) || !Number.isSafeInteger(value) || value < 0) throw new Error(`Invalid deterministic counter: ${key}`);
  }
}
function validateComponentTag(tag, componentTags) {
  if (componentTags && !componentTags.has(tag)) throw new Error(`Unknown scale component: ${tag}`);
}
function indexMeasurements(rows, componentTags) {
  const result = new Map();
  for (const row of rows) {
    if (!object(row) || !/^lr-[a-z0-9-]+$/.test(row.tag) || typeof row.scenario !== 'string' || !row.scenario.trim() || row.engine !== 'chromium') throw new Error('Invalid scale measurement identity or engine');
    validateComponentTag(row.tag, componentTags);
    validateCounters(row.counters);
    const key = JSON.stringify([row.tag, row.scenario]);
    if (result.has(key)) throw new Error(`Duplicate measurement: ${key}`);
    result.set(key, row);
  }
  return result;
}
export function validateScaleBudgetFixture(fixture, componentTags) {
  if (!object(fixture) || !object(fixture.budgets) || !Number.isFinite(fixture.margin) || fixture.margin < 0 || fixture.margin > 1) throw new Error('Invalid scale budget fixture');
  for (const [tag, scenarios] of Object.entries(fixture.budgets)) {
    if (!/^lr-[a-z0-9-]+$/.test(tag) || !object(scenarios)) throw new Error('Invalid budget tag');
    validateComponentTag(tag, componentTags);
    for (const [scenario, counters] of Object.entries(scenarios)) {
      if (!scenario.trim()) throw new Error('Invalid budget scenario');
      validateCounters(counters);
    }
  }
}
function budgetFor(fixture, row, counter) {
  const scenarios = Object.hasOwn(fixture.budgets, row.tag) ? fixture.budgets[row.tag] : undefined;
  const counters = scenarios && Object.hasOwn(scenarios, row.scenario) ? scenarios[row.scenario] : undefined;
  return counters && Object.hasOwn(counters, counter) ? counters[counter] : undefined;
}
export function parseMeasurements(text, { componentTags } = {}) {
  const rows = text.split('\n').filter(line => line.trim()).map(line => JSON.parse(line));
  if (rows.pop()?.complete !== true || !rows.length) throw new Error('Missing completed scale run');
  indexMeasurements(rows, componentTags);
  return rows;
}
export function checkBudgets(rows, fixture, { componentTags } = {}) {
  validateScaleBudgetFixture(fixture, componentTags);
  const measured = indexMeasurements(rows, componentTags);
  const errors = [];
  for (const row of rows) {
    for (const [counter, value] of Object.entries(row.counters)) {
      const budget = budgetFor(fixture, row, counter);
      const key = `${row.tag}/${row.scenario}/${counter}`;
      if (budget === undefined) errors.push(`${key}: missing budget`);
      else if (value > budget) errors.push(`${key}: ${value} exceeds ${budget}`);
      else if (budget > value * 2) errors.push(`${key}: stale budget ${budget} for ${value}`);
    }
  }
  for (const [tag, scenarios] of Object.entries(fixture.budgets)) {
    for (const [scenario, counters] of Object.entries(scenarios)) {
      for (const counter of Object.keys(counters)) {
        if (measured.get(JSON.stringify([tag, scenario]))?.counters[counter] === undefined) errors.push(`${tag}/${scenario}/${counter}: missing measurement`);
      }
    }
  }
  if (!rows.length && !errors.length) errors.push('No scale measurements');
  return errors;
}
export function writeBudgets(rows, fixture, { allowHigher = false, componentTags } = {}) {
  const errors = checkBudgets(rows, fixture, { componentTags }).filter(error => error.includes('missing measurement'));
  if (!rows.length || errors.length) throw new Error(errors.join('\n') || 'No scale measurements');
  const budgets = Object.create(null);
  for (const row of [...rows].sort((a, b) => `${a.tag}/${a.scenario}`.localeCompare(`${b.tag}/${b.scenario}`))) {
    const counters = Object.create(null);
    for (const [counter, value] of Object.entries(row.counters).sort(([a], [b]) => a.localeCompare(b))) {
      const next = Math.ceil(value * (1 + fixture.margin));
      if (!Number.isSafeInteger(next)) throw new Error('Scale budget exceeds safe integer range');
      const previous = budgetFor(fixture, row, counter);
      if (previous !== undefined && next > previous && !allowHigher) throw new Error(`Refusing to raise ${row.tag}/${row.scenario}/${counter}; review and use --allow-higher`);
      counters[counter] = next;
    }
    (budgets[row.tag] ??= Object.create(null))[row.scenario] = counters;
  }
  return { ...fixture, measuredAt: new Date().toISOString(), budgets };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    if (args.some(arg => !['--write-budgets', '--allow-higher'].includes(arg)) || (args.includes('--allow-higher') && !args.includes('--write-budgets'))) throw new Error('Usage: check-scale-budgets.mjs [--write-budgets [--allow-higher]]');
    const path = new URL('./fixtures/scale-budgets.json', import.meta.url);
    const fixture = JSON.parse(readFileSync(path, 'utf8'));
    const inventory = JSON.parse(readFileSync(new URL('./fixtures/component-inventory.json', import.meta.url), 'utf8'));
    if (inventory?.schemaVersion !== 1 || !Array.isArray(inventory.components) || !inventory.components.length)
      throw new Error('Scale budgets require a component inventory');
    const componentTags = new Set(inventory.components.map(component => component.tag));
    const rows = parseMeasurements(readFileSync(new URL('../coverage/scale-measurements.jsonl', import.meta.url), 'utf8'), { componentTags });
    if (args.includes('--write-budgets')) writeFileSync(path, `${JSON.stringify(writeBudgets(rows, fixture, { allowHigher: args.includes('--allow-higher'), componentTags }), null, 2)}\n`);
    else {
      const errors = checkBudgets(rows, fixture, { componentTags });
      if (errors.length) throw new Error(errors.join('\n'));
      console.info(`Scale budgets passed (${rows.length} scenarios)`);
    }
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
