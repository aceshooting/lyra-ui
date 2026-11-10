import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { Session } from 'node:inspector/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import istanbulCoverage from 'istanbul-lib-coverage';

const { createCoverageMap } = istanbulCoverage;

// Resolve the converter through its consumer so this exercises the runner's actual dependency.
const require = createRequire(import.meta.url);
const runnerRequire = createRequire(require.resolve('@web/test-runner-playwright'));
const { v8ToIstanbul } = runnerRequire('@web/test-runner-coverage-v8');
const { getTestCoverage } = runnerRequire(join(dirname(runnerRequire.resolve('@web/test-runner-core')), 'coverage/getTestCoverage.js'));
const nativeConverter = createRequire(runnerRequire.resolve('@web/test-runner-coverage-v8'))('v8-to-istanbul');

function branchSession(rows) {
  const path = '/fixture/branches.ts';
  const branchMap = {}, b = {};
  for (const [id, [start, end, count]] of rows.entries()) {
    const loc = { start: { line: 1, column: start }, end: { line: 1, column: end } };
    branchMap[id] = { type: 'branch', line: 1, loc, locations: [loc] };
    b[id] = [count];
  }
  return { testCoverage: { [path]: { path, statementMap: {}, s: {}, fnMap: {}, f: {}, branchMap, b } } };
}

function sessionBranchCounts(sessions) {
  const { coverageMap } = getTestCoverage(new Set(sessions), {});
  const coverage = coverageMap.fileCoverageFor('/fixture/branches.ts');
  return Object.fromEntries(Object.entries(coverage.branchMap).map(([id, branch]) =>
    [`${branch.loc.start.column}:${branch.loc.end.column}`, coverage.b[id][0]]));
}

for (const reverse of [false, true]) {
  test(`session coverage preserves explicit same-line counters in ${reverse ? 'child' : 'parent'}-first order`, () => {
    const rows = [[0, 80, 5], [20, 60, 2], [30, 50, 0]];
    const session = branchSession(reverse ? rows.reverse() : rows);
    const before = structuredClone(session);
    assert.deepEqual(sessionBranchCounts([session]), { '0:80': 5, '20:60': 2, '30:50': 0 });
    assert.deepEqual(session, before, 'coverage assembly must not mutate captured counters');
  });
}

for (const bounds of [[20, 60], [0, 60]]) {
  test(`missing session branches inherit the nearest enclosing range ${bounds.join(':')}`, () => {
    const first = branchSession([[0, 80, 1], [30, 50, 1]]);
    const second = branchSession([[0, 80, 3], [...bounds, 0]]);
    const expected = { '0:80': 4, '30:50': 1, [bounds.join(':')]: 1 };
    assert.deepEqual(sessionBranchCounts([first, second]), expected);
    assert.deepEqual(sessionBranchCounts([second, first]), expected, 'session order must not change the result');
  });
}

for (const callbackPresent of [false, true]) {
  test(`missing branches cannot inherit across a ${callbackPresent ? 'coarse' : 'missing'} callback boundary`, () => {
    const active = branchSession([[0, 100, 2], [20, 80, 1], [30, 50, 0], [60, 70, 1]]);
    const idle = branchSession([[0, 100, 3]]);
    for (const [session, present, calls] of [[active, true, 1], [idle, callbackPresent, 0]]) {
      if (!present) continue;
      const coverage = session.testCoverage['/fixture/branches.ts'];
      const loc = { start: { line: 1, column: 20 }, end: { line: 1, column: 80 } };
      coverage.fnMap[0] = { name: 'callback', line: 1, loc, decl: loc };
      coverage.f[0] = calls;
    }
    const before = structuredClone([active, idle]);
    const expected = { '0:100': 5, '20:80': 1, '30:50': 0, '60:70': 1 };
    assert.deepEqual(sessionBranchCounts([active, idle]), expected);
    assert.deepEqual(sessionBranchCounts([idle, active]), expected);
    assert.deepEqual([active, idle], before);
  });
}

test('Chromium coarse callback coverage preserves an unexecuted nullish arm', async () => {
  // Captured with Playwright precise coverage: both pages construct the class, but only
  // the first calls its callback. Chromium omits branches for the idle callback.
  const fixture = JSON.parse(await readFile(new URL('./fixtures/coverage-callback.json', import.meta.url), 'utf8'));
  const filename = '/fixture/callback.js';
  const sessions = await Promise.all(fixture.sessions.map(async (functions) => {
    const converter = nativeConverter(filename, 0, { source: fixture.source });
    await converter.load();
    converter.applyCoverage(functions);
    return { testCoverage: converter.toIstanbul() };
  }));
  const idle = fixture.sessions[1].find((fn) => fn.functionName === 'fallback');
  assert.equal(idle.isBlockCoverage, false);
  assert.equal(idle.ranges[0].count, 0);
  const before = structuredClone(sessions);
  for (const ordered of [sessions, [...sessions].reverse()]) {
    const coverage = getTestCoverage(ordered, {}).coverageMap.fileCoverageFor(filename);
    const callback = Object.entries(coverage.fnMap).find(([, fn]) => fn.name === 'fallback');
    assert.equal(coverage.f[callback[0]], 1, 'callback is invoked exactly once');
    const branches = Object.entries(coverage.branchMap).filter(([, branch]) =>
      branch.loc.start.line === 2 && branch.loc.start.column >= callback[1].loc.start.column);
    assert.equal(branches.length, 2, 'callback and nullish arm are both retained');
    assert.deepEqual(branches.map(([id]) => coverage.b[id][0]).sort((a, b) => a - b), [0, 1]);
    assert.equal(Object.keys(coverage.branchMap).length, 5, 'all recorded branches survive');
    assert.deepEqual(Object.keys(coverage.getLineCoverage()), ['1', '2', '3', '4', '5']);
  }
  assert.deepEqual(sessions, before);
});

test('missing callback branches still inherit execution within that callback', () => {
  const first = branchSession([[0, 100, 1], [20, 80, 1], [30, 50, 0]]);
  const second = branchSession([[0, 100, 4], [20, 80, 3]]);
  for (const [session, calls] of [[first, 1], [second, 3]]) {
    const coverage = session.testCoverage['/fixture/branches.ts'];
    const loc = { start: { line: 1, column: 20 }, end: { line: 1, column: 80 } };
    coverage.fnMap[0] = { name: 'callback', line: 1, loc, decl: loc };
    coverage.f[0] = calls;
  }
  for (const sessions of [[first, second], [second, first]]) {
    assert.deepEqual(sessionBranchCounts(sessions), { '0:100': 5, '20:80': 4, '30:50': 3 });
  }
});

test('V8 coverage unions execution from independent realms sharing one source URL', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'lyra-coverage-realms-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const source = [
    'function choose(parent) {',
    '  if (parent) {',
    '    return "parent";',
    '  } else {',
    '    return "iframe";',
    '  }',
    '}',
    'function neverCalled() {',
    '  return "uncovered";',
    '}',
    'globalThis.result = choose(globalThis.parent);',
    'globalThis.explicit = fallback("authored");',
    'function fallback(value) { return value ?? "fallback"; }',
    '',
  ].join('\n');
  const filename = join(directory, 'realm.js');
  await writeFile(filename, source);
  const server = createServer((_request, response) => {
    response.setHeader('Content-Type', 'application/javascript');
    response.end(source);
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  }));
  const port = server.address().port;
  const url = `http://127.0.0.1:${port}/realm.js`;
  const session = new Session();
  session.connect();
  t.after(() => session.disconnect());
  await session.post('Profiler.enable');
  await session.post('Profiler.startPreciseCoverage', { callCount: true, detailed: true });
  const parent = { parent: true };
  const iframe = { parent: false };
  // Take each realm's snapshot separately: Node can reuse a compiled Script across contexts,
  // whereas browser frames report separate entries for the same module URL.
  runInNewContext(source, parent, { filename: url });
  const parentSnapshot = await session.post('Profiler.takePreciseCoverage');
  runInNewContext(source, iframe, { filename: url });
  const iframeSnapshot = await session.post('Profiler.takePreciseCoverage');
  await session.post('Profiler.stopPreciseCoverage');
  assert.equal(parent.result, 'parent');
  assert.equal(iframe.result, 'iframe');
  assert.equal(parent.explicit, 'authored');
  assert.equal(iframe.explicit, 'authored');
  const entries = [parentSnapshot, iframeSnapshot].flatMap(({ result }) =>
    result.filter((entry) => entry.url === url));
  assert.equal(entries.length, 2, 'both realm snapshots contain the shared source');
  const config = {
    rootDir: directory,
    protocol: 'http:',
    hostname: '127.0.0.1',
    port,
    coverageConfig: { include: ['**/*.js'], exclude: ['**/ignored/**'] },
  };
  const convert = async (scripts) => createCoverageMap(await v8ToIstanbul(config, [], scripts));
  const individual = await Promise.all(entries.map((entry) => convert([entry])));
  const counts = individual.map((map) => map.fileCoverageFor(filename).getLineCoverage());
  assert.deepEqual(counts.map((lines) => [lines[3], lines[5]]).sort(), [[0, 1], [1, 0]]);

  for (const [label, scripts] of [['parent first', entries], ['iframe first', [...entries].reverse()]]) {
    await t.test(label, async () => {
      const map = await convert(scripts);
      assert.deepEqual(map.files(), [filename]);
      const coverage = map.fileCoverageFor(filename);
      const lines = coverage.getLineCoverage();
      assert.equal(lines[3], 1, 'parent-only execution survives');
      assert.equal(lines[5], 1, 'iframe-only execution survives');
      assert.equal(lines[9], 0, 'unexecuted code remains uncovered');
      assert.deepEqual(Object.keys(lines), Object.keys(counts[0]), 'source denominator is unchanged');
      const choose = Object.entries(coverage.fnMap).find(([, fn]) => fn.name === 'choose')[0];
      assert.equal(coverage.f[choose], 2, 'shared function execution counts are added');
      const assembled = getTestCoverage(new Set([{ testCoverage: map.toJSON() }]), {}).coverageMap.fileCoverageFor(filename);
      const fallbackCounts = Object.entries(assembled.branchMap)
        .filter(([, branch]) => branch.loc.start.line === 13)
        .map(([id]) => assembled.b[id][0]).sort((a, b) => a - b);
      assert.deepEqual(fallbackCounts, [0, 2], 'the unexecuted nullish arm stays uncovered after session assembly');
    });
  }
});
