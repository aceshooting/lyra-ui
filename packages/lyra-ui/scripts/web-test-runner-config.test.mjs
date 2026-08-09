import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';

const packageDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const configUrl = pathToFileURL(resolve(packageDirectory, 'web-test-runner.config.js')).href;

function inspectConfig(coverage) {
  const environment = { ...process.env };
  if (coverage) environment.WTR_COVERAGE = '1';
  else delete environment.WTR_COVERAGE;

  const source = `
    import config from ${JSON.stringify(configUrl)};
    process.stdout.write(JSON.stringify({
      coverage: config.coverage,
      concurrency: config.concurrency ?? null,
      mediaCommand: config.plugins.some((plugin) => plugin.name === 'lyra-media-command'),
    }));
  `;
  const result = spawnSync(process.execPath, ['--input-type=module', '--eval', source], {
    cwd: packageDirectory,
    env: environment,
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return JSON.parse(result.stdout);
}

test('caps coverage browser sessions without changing ordinary test concurrency', () => {
  assert.deepEqual(inspectConfig(true), { coverage: true, concurrency: 1, mediaCommand: true });
  assert.deepEqual(inspectConfig(false), { coverage: false, concurrency: null, mediaCommand: true });
});
