import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { timingReporter } from './wtr-timing-reporter.mjs';

const require = createRequire(import.meta.url);
const runnerRequire = createRequire(require.resolve('@web/test-runner-playwright'));
const coreDirectory = dirname(runnerRequire.resolve('@web/test-runner-core'));
const { TestSessionManager } = runnerRequire(join(coreDirectory, 'test-session/TestSessionManager.js'));

function harness(t, names = ['a.test.ts', 'b.test.ts']) {
  const directory = mkdtempSync(join(tmpdir(), 'lyra-wtr-timing-'));
  const output = join(directory, 'timing.jsonl');
  let clock = 0;
  t.mock.method(Date, 'now', () => clock);
  const sessions = new TestSessionManager([], names.map((name, index) => ({
    id: String(index), testFile: join(directory, name), testRun: 0,
    status: 'SCHEDULED', browser: { name: 'Chromium' }, group: { name: 'default' },
    debug: false, errors: [], logs: [], request404s: [],
  })));
  const reporter = timingReporter(output, { cwd: directory });
  const start = () => {
    reporter.start?.({ sessions, config: {}, browsers: [], browserNames: ['Chromium'],
      testFiles: names.map(name => join(directory, name)), startTime: clock });
    reporter.onTestRunStarted({ testRun: 0 });
  };
  const update = (id, status, testRun = 0) => {
    sessions.updateStatus({ ...sessions.get(String(id)), testRun }, status);
  };
  const report = (id, testRun = 0) => {
    const session = sessions.get(String(id));
    reporter.reportTestFileResults({ testFile: session.testFile, testRun,
      sessionsForTestFile: [...sessions.forTestFile(session.testFile)], logger: {} });
  };
  t.after(() => {
    reporter.stop?.({ sessions: [...sessions.all()] });
    rmSync(directory, { recursive: true, force: true });
  });
  return { sessions, reporter, start, update, report,
    at(value) { clock = value; },
    advance(value) { clock += value; },
    rows() { return readFileSync(output, 'utf8').trim().split('\n').filter(Boolean).map(line => JSON.parse(line)); },
  };
}

test('records both file completions before synchronous whole-run coverage aggregation', t => {
  const item = harness(t);
  // The runner registers this status listener before the CLI starts the reporters.
  item.sessions.on('session-status-updated', session => {
    if (session.status === 'FINISHED' && [...item.sessions.all()].every(value => value.status === 'FINISHED')) {
      item.advance(10_000);
    }
  });
  item.start();
  item.at(100);
  item.update(0, 'FINISHED');
  item.report(0);
  item.at(250);
  item.update(1, 'FINISHED');
  item.report(1);
  assert.deepEqual(item.rows(), [
    { file: 'a.test.ts', deltaMs: 100 },
    { file: 'b.test.ts', deltaMs: 150 },
  ]);
});

test('does not replace an observed completion time on duplicate session updates', t => {
  const item = harness(t, ['a.test.ts']);
  item.start();
  item.at(80);
  item.update(0, 'FINISHED');
  item.at(5_000);
  item.sessions.update({ ...item.sessions.get('0'), logs: [['late diagnostic']] });
  item.update(0, 'FINISHED');
  item.report(0);
  assert.deepEqual(item.rows(), [{ file: 'a.test.ts', deltaMs: 80 }]);
});

test('resets completion captures when watch mode reuses session ids in a new test run', t => {
  const item = harness(t, ['a.test.ts']);
  item.start();
  item.at(100);
  item.update(0, 'FINISHED');
  item.report(0);
  item.at(20_000);
  item.reporter.onTestRunStarted({ testRun: 1 });
  item.update(0, 'SCHEDULED', 1);
  item.update(0, 'INITIALIZING', 1);
  item.at(20_075);
  item.update(0, 'FINISHED', 1);
  item.at(30_000);
  item.report(0, 1);
  assert.deepEqual(item.rows(), [
    { file: 'a.test.ts', deltaMs: 100 },
    { file: 'a.test.ts', deltaMs: 75 },
  ]);
});

test('releases its early session observation when the reporter stops', t => {
  const item = harness(t, ['a.test.ts']);
  const subscribed = new Set();
  const originalOn = item.sessions.on.bind(item.sessions);
  const originalOff = item.sessions.off.bind(item.sessions);
  t.mock.method(item.sessions, 'on', (name, listener) => {
    if (name === 'session-updated') subscribed.add(listener);
    originalOn(name, listener);
  });
  t.mock.method(item.sessions, 'off', (name, listener) => {
    if (name === 'session-updated') subscribed.delete(listener);
    originalOff(name, listener);
  });
  item.start();
  assert.equal(subscribed.size, 1, 'observe completion before the later status listeners run');
  item.reporter.stop?.({ sessions: [...item.sessions.all()] });
  assert.equal(subscribed.size, 0, 'do not retain the session manager after reporter shutdown');
});
