import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const repo = fileURLToPath(new URL('..', import.meta.url));
const fixture = fileURLToPath(new URL('./fixtures/dependency-security-codecov-runtime.mjs', import.meta.url));
for (const flavor of ['cjs', 'esm']) {
  test(`Codecov ${flavor} validates configuration and GitHub jobs with patched Zod`, () => {
    const env = Object.fromEntries(['PATH', 'HOME', 'TMPDIR', 'LANG', 'LD_LIBRARY_PATH']
      .filter(key => process.env[key]).map(key => [key, process.env[key]]));
    Object.assign(env, {
      GITHUB_ACTIONS: 'true', GITHUB_REPOSITORY: 'example/project', GITHUB_RUN_ID: '123', GITHUB_JOB: 'build',
      GITHUB_EVENT_NAME: 'push', GITHUB_SHA: '0123456789012345678901234567890123456789', GITHUB_SERVER_URL: 'https://github.com'
    });
    const result = spawnSync(process.execPath, [fixture, repo, 'patched', flavor], {
      cwd: repo, env, encoding: 'utf8', timeout: 60000, maxBuffer: 4 * 1024 * 1024
    });
    assert.equal(result.error, undefined, result.error?.message);
    assert.equal(result.status, 0, (result.stdout ?? '') + (result.stderr ?? ''));
  });
}
