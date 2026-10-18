import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');

// Section of a top-level job body (up to the next sibling job).
function job(text, name) {
  const start = text.indexOf(`\n  ${name}:\n`);
  assert(start >= 0, `job ${name} exists`);
  const rest = text.slice(start + 1);
  const next = rest.slice(1).search(/\n  [a-z][a-z0-9_-]*:\n/u);
  return next < 0 ? rest : rest.slice(0, next + 1);
}

test('the coverage shard step runs under the strict console gate', () => {
  const step = read('.github/workflows/ci.yml');
  const at = step.indexOf('name: Run coverage shard');
  assert(at >= 0);
  assert.match(step.slice(at, at + 400), /WTR_STRICT_CONSOLE: "1"/u);
});

test('complete browser suites receive the built Map companion before their shards run', () => {
  const library = JSON.parse(read('packages/lyra-ui/package.json'));
  assert.match(library.scripts.build, /@aceshooting\/lyra-map run build/u);
  for (const [workflowPath, buildJob, testJob, buildCommand, testCommand] of [
    ['.github/workflows/ci.yml', 'build_and_coverage_build', 'build_and_coverage_coverage_shard',
      'run: pnpm build', 'name: Run coverage shard'],
    ['.github/workflows/ci.yml', 'build_and_coverage_build', 'scale-budgets',
      'run: pnpm build', 'run: pnpm --filter @aceshooting/lyra-ui test:scale'],
    ['.github/workflows/full-engine.yml', 'build', 'full-engine',
      'run: pnpm --filter @aceshooting/lyra-ui build', 'name: Run complete non-coverage test shard'],
    ['.github/workflows/test-all-browsers.yml', 'build', 'test',
      'run: pnpm --filter @aceshooting/lyra-ui build', 'name: Run complete browser shard'],
  ]) {
    const workflow = read(workflowPath);
    const build = job(workflow, buildJob);
    const shard = job(workflow, testJob);
    const builtAt = build.indexOf(buildCommand);
    const uploadedAt = build.indexOf('name: lyra-map-dist\n          path: packages/lyra-map/dist');
    const downloadedAt = shard.indexOf('name: lyra-map-dist\n          path: packages/lyra-map/dist');
    const testedAt = shard.indexOf(testCommand);
    assert.ok(builtAt >= 0 && uploadedAt > builtAt, `${workflowPath} uploads built Map dist`);
    assert.ok(downloadedAt >= 0 && testedAt > downloadedAt, `${workflowPath} downloads Map dist before tests`);
  }
});

test('Storybook contract loads the Map Vite entry built by the docs producer', () => {
  const workflow = read('.github/workflows/ci.yml');
  const build = job(workflow, 'docs_build');
  const contract = job(workflow, 'docs_storybook_contract');
  const builtAt = build.indexOf('run: pnpm build');
  const uploadedAt = build.indexOf('name: storybook-lyra-map-dist\n          path: packages/lyra-map/dist');
  assert.ok(builtAt >= 0 && uploadedAt > builtAt);
  const downloadedAt = contract.indexOf('name: storybook-lyra-map-dist\n          path: packages/lyra-map/dist');
  assert.ok(downloadedAt >= 0 && downloadedAt < contract.indexOf('run: pnpm storybook:check'));
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
