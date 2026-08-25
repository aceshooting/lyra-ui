// Maintains scripts/coverage-floors.json -- the per-metric coverage floors that
// web-test-runner.config.js hands to `wtr`'s blocking threshold check.
// Why a generated data file instead of literals in the runner config: floors
// written by hand drift silently. They were last hand-edited to
// statements 75 / branches 65 / functions 65 / lines 75 while the suite was
// actually measuring 99 / 94 / 99 / 99, so roughly a quarter of the source tree
// could have gone uncovered without the gate firing. A floor is only a gate if
// it sits just under the measurement, and only stays there if refreshing it is a
// mechanical command producing a reviewable diff.
// Usage (from packages/lyra-ui, after a coverage run has written coverage/):
//   node scripts/write-coverage-floors.mjs                 # check stored floors against measured coverage
//   node scripts/write-coverage-floors.mjs --write-floors  # raise floors to floor(measured - margin)
//   node scripts/write-coverage-floors.mjs --write-floors --allow-lower
//                                                          # ALSO lower floors (explicit, reviewable)
//   ... --margin 2   # override the default 1.5-point slack
// `--write-floors` never lowers a floor without `--allow-lower`: a coverage
// regression must be an explicit, visible decision in the diff, not a silent
// re-baseline by whoever last ran the command.
import { existsSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const packageDir = fileURLToPath(new URL('..', import.meta.url));
const FLOORS_FILE = new URL('./coverage-floors.json', import.meta.url);
const LCOV_FILE = new URL('../coverage/lcov.info', import.meta.url);
const SUMMARY_FILE = new URL('../coverage/coverage-summary.json', import.meta.url);

export const METRICS = ['statements', 'branches', 'functions', 'lines'];
const DEFAULT_MARGIN = 1.5;
// A floor further than this below the measurement stopped being a gate.
const STALE_SLACK = 5;

/** Totals -> percentage, matching istanbul (an empty metric counts as 100%). */
export function percent(covered, total) {
  return total === 0 ? 100 : (covered / total) * 100;
}

/**
 * Sum the per-file totals of an lcov report.
 *
 * lcov carries no statement records: its `DA`/`LF`/`LH` lines are istanbul's
 * *line* coverage, i.e. statements collapsed onto their starting line, so
 * lines% >= statements%. When coverage/coverage-summary.json is available we
 * read the exact statement totals from it instead (see readCoverage).
 */
export function parseLcov(text) {
  const totals = { lines: [0, 0], functions: [0, 0], branches: [0, 0] };
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    const add = (key, index, value) => {
      totals[key][index] += Number(value);
    };
    if (line.startsWith('LF:')) add('lines', 1, line.slice(3));
    else if (line.startsWith('LH:')) add('lines', 0, line.slice(3));
    else if (line.startsWith('FNF:')) add('functions', 1, line.slice(4));
    else if (line.startsWith('FNH:')) add('functions', 0, line.slice(4));
    else if (line.startsWith('BRF:')) add('branches', 1, line.slice(4));
    else if (line.startsWith('BRH:')) add('branches', 0, line.slice(4));
  }
  const lines = percent(...totals.lines);
  return {
    statements: lines,
    lines,
    functions: percent(...totals.functions),
    branches: percent(...totals.branches),
  };
}

/** Read the `total` block istanbul's json-summary reporter writes. */
export function parseSummary(json) {
  const total = json?.total;
  if (!total) throw new Error('coverage-summary.json has no `total` block.');
  const measured = {};
  for (const metric of METRICS) {
    const entry = total[metric];
    if (!entry) throw new Error(`coverage-summary.json is missing the ${metric} totals.`);
    measured[metric] = percent(entry.covered, entry.total);
  }
  return measured;
}

export function readCoverage() {
  if (existsSync(SUMMARY_FILE)) {
    return {
      source: 'coverage/coverage-summary.json',
      measured: parseSummary(JSON.parse(readFileSync(SUMMARY_FILE, 'utf8'))),
      exact: true,
    };
  }
  if (existsSync(LCOV_FILE)) {
    return { source: 'coverage/lcov.info', measured: parseLcov(readFileSync(LCOV_FILE, 'utf8')), exact: false };
  }
  throw new Error(
    'No coverage report found. Run `pnpm test:coverage` first (it writes coverage/lcov.info and coverage/coverage-summary.json).',
  );
}

/** floor(measured - margin), clamped to [0, 100]. */
export function floorFor(measuredPercent, margin = DEFAULT_MARGIN) {
  return Math.max(0, Math.min(100, Math.floor(measuredPercent - margin)));
}

export function readFloors() {
  return JSON.parse(readFileSync(FLOORS_FILE, 'utf8'));
}

/**
 * Decide the next floor per metric.
 * Returns { next, changes: [{ metric, from, to, direction }] }.
 */
export function nextFloors({ current, measured, margin = DEFAULT_MARGIN, allowLower = false }) {
  const next = {};
  const changes = [];
  for (const metric of METRICS) {
    const proposed = floorFor(measured[metric], margin);
    const from = current[metric];
    if (proposed === from) {
      next[metric] = from;
      continue;
    }
    if (proposed < from && !allowLower) {
      next[metric] = from;
      changes.push({ metric, from, to: proposed, direction: 'blocked' });
      continue;
    }
    next[metric] = proposed;
    changes.push({ metric, from, to: proposed, direction: proposed > from ? 'raised' : 'lowered' });
  }
  return { next, changes };
}

function parseArgs(argv) {
  const options = { write: false, allowLower: false, margin: DEFAULT_MARGIN };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--write-floors') options.write = true;
    else if (arg === '--allow-lower') options.allowLower = true;
    else if (arg === '--margin') {
      const value = Number(argv[i + 1]);
      if (!Number.isFinite(value) || value < 0) throw new Error(`--margin needs a non-negative number, got ${argv[i + 1]}`);
      options.margin = value;
      i += 1;
    } else throw new Error(`Unknown argument: ${arg}`);
  }
  return options;
}

function format(measured) {
  return METRICS.map((metric) => `${metric} ${measured[metric].toFixed(2)}%`).join(', ');
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const { source, measured, exact } = readCoverage();
  const current = readFloors();

  console.log(`Measured (${source}): ${format(measured)}`);
  if (!exact) {
    console.log(
      'Note: lcov carries no statement records, so the statements figure reuses the line figure. Re-run with coverage/coverage-summary.json present for exact statement totals.',
    );
  }
  console.log(`Stored floors: ${METRICS.map((m) => `${m} ${current[m]}`).join(', ')}`);

  const { next, changes } = nextFloors({
    current,
    measured,
    margin: options.margin,
    allowLower: options.allowLower,
  });

  if (!options.write) {
    const problems = [];
    for (const metric of METRICS) {
      if (current[metric] > measured[metric]) {
        problems.push(
          `${metric}: floor ${current[metric]} is above the measured ${measured[metric].toFixed(2)}% -- the suite cannot pass.`,
        );
      } else if (measured[metric] - current[metric] > STALE_SLACK) {
        problems.push(
          `${metric}: floor ${current[metric]} is ${(measured[metric] - current[metric]).toFixed(1)} points below the measured ${measured[metric].toFixed(2)}% -- it no longer gates anything.`,
        );
      }
    }
    if (problems.length > 0) {
      for (const problem of problems) console.error(`  ${problem}`);
      console.error('Refresh with: node scripts/write-coverage-floors.mjs --write-floors');
      process.exitCode = 1;
      return;
    }
    console.log('Coverage floors track the measured coverage.');
    return;
  }

  const blocked = changes.filter((change) => change.direction === 'blocked');
  for (const change of changes) {
    const label = change.direction === 'blocked' ? 'kept (lowering needs --allow-lower)' : change.direction;
    console.log(`  ${change.metric}: ${change.from} -> ${change.to} [${label}]`);
  }

  const payload = {
    // Regenerate with `node scripts/write-coverage-floors.mjs --write-floors`
    // from packages/lyra-ui after `pnpm test:coverage`.
    $comment:
      'Blocking coverage floors consumed by web-test-runner.config.js. Generated by scripts/write-coverage-floors.mjs from the measured coverage minus a margin; lowering a value requires --allow-lower and shows up in this diff.',
    margin: options.margin,
    measuredAt: new Date().toISOString().slice(0, 10),
    measured: Object.fromEntries(METRICS.map((metric) => [metric, Number(measured[metric].toFixed(2))])),
    ...Object.fromEntries(METRICS.map((metric) => [metric, next[metric]])),
  };
  writeFileSync(FLOORS_FILE, `${JSON.stringify(payload, null, 2)}\n`);
  console.log(`Wrote ${fileURLToPath(FLOORS_FILE).slice(packageDir.length)}`);

  if (blocked.length > 0) {
    console.error(
      `Coverage dropped for: ${blocked.map((change) => change.metric).join(', ')}. Floors kept as-is; re-run with --allow-lower to accept the regression.`,
    );
    process.exitCode = 1;
  }
}

if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) {
  main();
}

