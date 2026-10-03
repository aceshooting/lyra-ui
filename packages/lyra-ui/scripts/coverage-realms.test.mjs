import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { Session } from 'node:inspector/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import istanbulCoverage from 'istanbul-lib-coverage';

const { createCoverageMap } = istanbulCoverage;

// Resolve the converter through its consumer so this exercises the runner's actual dependency.
const require = createRequire(import.meta.url);
const runnerRequire = createRequire(require.resolve('@web/test-runner-playwright'));
const { v8ToIstanbul } = runnerRequire('@web/test-runner-coverage-v8');

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
    });
  }
});
