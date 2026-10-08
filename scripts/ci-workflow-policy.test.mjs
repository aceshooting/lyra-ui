import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');

// Section of a top-level job body (up to the next sibling job).
function job(text, name) {
  const start = text.indexOf(`\n  ${name}:\n`);
  assert(start >= 0, `job ${name} exists`);
  const rest = text.slice(start + 1);
  const next = rest.slice(1).search(/\n  [a-z][a-z0-9-]*:\n/u);
  return next < 0 ? rest : rest.slice(0, next + 1);
}

test('the coverage shard step runs under the strict console gate', () => {
  const step = read('.github/workflows/ci.yml');
  const at = step.indexOf('name: Run coverage shard');
  assert(at >= 0);
  assert.match(step.slice(at, at + 400), /WTR_STRICT_CONSOLE: "1"/u);
});

test('static-checks does not repeat lint-owned contract gates', () => {
  const body = job(read('.github/workflows/ci.yml'), 'static-checks');
  assert.doesNotMatch(body, /^\s*- run: .*test:public-api/mu);
});

test('the browser sweeps reuse one build instead of rebuilding per lane', () => {
  assert.match(read('.github/workflows/test-all-browsers.yml'), /TEST_ALL_BROWSERS_SKIP_BUILD: '1'/u);
});

test('a failing browser sweep keeps its lane logs and prints their path', () => {
  const script = read('scripts/test_all_browsers.sh');
  assert.match(script, /lane logs kept for inspection: \$LOG_DIR/u);
  assert.match(script, /trap cleanup_logs EXIT/u);
});
