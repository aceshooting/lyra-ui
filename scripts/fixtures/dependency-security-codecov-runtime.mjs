import assert from 'node:assert/strict';
import { createRequire, syncBuiltinESMExports } from 'node:module';
import { readFileSync, realpathSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import tls from 'node:tls';

const [repo, mode, flavor] = process.argv.slice(2);
assert(['override-only', 'patched'].includes(mode) && ['cjs', 'esm'].includes(flavor));
const escapes = [];
const denyNetwork = () => { escapes.push('socket'); throw new Error('Unexpected network socket'); };
for (const object of [http, https]) { object.request = denyNetwork; object.get = denyNetwork; }
net.connect = net.createConnection = net.Socket.prototype.connect = tls.connect = denyNetwork;
syncBuiltinESMExports();
globalThis.fetch = async () => { escapes.push('fetch'); throw new Error('Unexpected fetch outside a test route'); };
const rootRequire = createRequire(resolve(repo, 'package.json'));
const uiRequire = createRequire(resolve(repo, 'packages/lyra-ui/package.json'));
const viteEntry = rootRequire.resolve('@codecov/vite-plugin');
const analyzerEntry = uiRequire.resolve('@codecov/bundle-analyzer');
const coreCjs = createRequire(viteEntry).resolve('@codecov/bundler-plugin-core');
const analyzerCore = createRequire(analyzerEntry).resolve('@codecov/bundler-plugin-core');
assert.equal(realpathSync(coreCjs), realpathSync(analyzerCore), 'Both real parents must resolve the same patched core');
const coreRequire = createRequire(coreCjs);
const zodPath = coreRequire.resolve('zod/package.json');
const zodVersion = JSON.parse(readFileSync(zodPath, 'utf8')).version;
assert(coreRequire('semver').gte(zodVersion, '4.6.6'), 'Resolved Zod must include the collection-bound fix');
assert(!coreRequire.resolve('zod').includes('/v3/'));
const sourcePath = flavor === 'cjs' ? coreCjs : resolve(dirname(coreCjs), 'index.mjs');
const core = flavor === 'cjs' ? coreRequire(coreCjs) : await import(pathToFileURL(sourcePath).href);
console.log(JSON.stringify({ flavor, mode, zodVersion, sharedCore: true }));
const { normalizeOptions, Output, handleErrors } = core;
const normalized = input => { const result = normalizeOptions(input); assert.equal(result.success, true, JSON.stringify(result)); return result.options; };
const base = {
  apiUrl: 'https://api.codecov.io', bundleName: 'lyra-ui-docs', dryRun: false, retryCount: 3,
  enableBundleAnalysis: false, debug: false, telemetry: true
};
if (mode === 'override-only') {
  // Zod 4.6.7 accepts the one-argument record at runtime, but ignores legacy error options.
  // Losing the field name changes Codecov's actual invalid-configuration exit decision.
  for (const [input, received] of [[{}, 'undefined'], [{ bundleName: 1 }, 'number']]) {
    const result = normalizeOptions(input);
    assert.equal(result.success, false);
    assert.deepEqual(result.errors, [`Invalid input: expected string, received ${received}`]);
    assert.equal(handleErrors(result).shouldExit, false, 'Negative witness must expose the lost bundleName exit decision');
  }
  assert.equal(normalizeOptions({ bundleName: 'valid', retryCount: 2 ** 53 }).success, false,
    'Override-only int() newly rejects an integer previously accepted by the configuration');
  console.log('PASS expected override-only missing-field exit regression and integer acceptance regression');
}
if (mode === 'patched') {
  assert.deepEqual(normalized({ bundleName: 'lyra-ui-docs', ignored: 1 }), base);
  assert.deepEqual(normalized({ bundleName: 'lyra-ui-docs', oidc: {} }), {
    ...base, oidc: { useGitHubOIDC: false, gitHubOIDCTokenAudience: 'https://codecov.io' }
  });
  assert.deepEqual(normalized({ bundleName: 'lyra-ui-docs', uploadOverrides: { branch: 'main', ignored: 1 } }), {
    ...base, uploadOverrides: { branch: 'main' }
  });
  assert.deepEqual(normalized({ bundleName: 'lyra-ui-docs', oidc: { useGitHubOIDC: false, gitHubOIDCTokenAudience: '' } }).oidc,
    { useGitHubOIDC: false, gitHubOIDCTokenAudience: '' });
  for (const gitService of ['github', 'gitlab', 'bitbucket', 'github_enterprise', 'gitlab_enterprise', 'bitbucket_server']) {
    assert.equal(normalized({ bundleName: 'lyra-ui-docs', gitService }).gitService, gitService);
  }
  for (const uploadToken of [undefined, 'test-token']) {
    const options = normalized({ bundleName: 'lyra-ui-docs', uploadToken, enableBundleAnalysis: uploadToken !== undefined });
    assert.equal(options.uploadToken, uploadToken); assert.equal(options.enableBundleAnalysis, uploadToken !== undefined);
  }
  const analyzer = normalized({ uploadToken: 'test-token', bundleName: 'lyra-ui-dist', enableBundleAnalysis: true, retryCount: 3, dryRun: true });
  assert.equal(analyzer.bundleName, 'lyra-ui-dist'); assert.equal(analyzer.dryRun, true);
  assert.equal(normalized({ bundleName: 'lyra-ui-docs', retryCount: 2 ** 53 }).retryCount, 2 ** 53);
  for (const [input, message] of [
    [{}, '`bundleName` is required for uploading bundle analysis information.'],
    [{ bundleName: 1 }, '`bundleName` must be a string.']
  ]) {
    const result = normalizeOptions(input); assert.equal(result.success, false); assert(result.errors.includes(message));
    assert.equal(handleErrors(result).shouldExit, true);
  }
  const invalid = [
    { bundleName: '' }, { bundleName: 'has space' }, { apiUrl: 'not-url' }, { apiUrl: 5 },
    ...[0, -1, 1.5, '3', NaN, Infinity].map(retryCount => ({ retryCount })),
    ...['dryRun', 'enableBundleAnalysis', 'debug', 'telemetry'].map(key => ({ [key]: 'true' })),
    { uploadToken: 1 }, { uploadOverrides: 1 }, ...['branch', 'build', 'compareSha', 'pr', 'sha', 'slug'].map(key => ({ uploadOverrides: { [key]: 1 } })),
    { oidc: 1 }, { oidc: { useGitHubOIDC: 'true' } }, { oidc: { gitHubOIDCTokenAudience: 1 } }, { gitService: 'invalid' }, { gitService: 1 }
  ];
  for (const input of invalid) assert.equal(normalizeOptions({ bundleName: 'valid', ...input }).success, false, JSON.stringify(input));
  console.log('PASS actual option normalization/defaults/invalid configurations');
}

const jobsUrl = 'https://api.github.com/repos/example/project/actions/runs/123/jobs';
const jobUrl = 'https://github.com/example/project/actions/runs/123/job/456';
const runUrl = 'https://github.com/example/project/actions/runs/123';
const presignUrl = 'https://codecov.test/upload/bundle_analysis/v1';
const uploadUrl = 'https://uploads.test/bundle';
const normalJobs = { total_count: 1, metadata: { values: [null, true, false, 12, 'text', { deep: ['nested'] }] }, jobs: [{ name: 'build', html_url: jobUrl }] };
async function scenario(kind) {
  const calls = [], unexpected = [];
  const previousFetch = globalThis.fetch;
  let presign, upload;
  globalThis.fetch = async (url, init = {}) => {
    const address = String(url); calls.push({ address, method: init.method ?? 'GET' });
    if (address === jobsUrl && !init.method) {
      if (kind === 'http-fallback') return new Response('', { status: 404 });
      if (kind === 'invalid-json') return { status: 200, json: async () => ({ jobs: [], nested: { bad: undefined } }) };
      if (kind === 'nonfinite-json') return new Response('{"jobs":[],"value":1e400}', { status: 200 });
      return Response.json(kind === 'no-match' ? { jobs: [{ name: 'other', html_url: jobUrl }] } : normalJobs);
    }
    if (address === presignUrl && init.method === 'POST') {
      presign = JSON.parse(init.body);
      assert.equal(new Headers(init.headers).get('authorization'), 'token test-token');
      return Response.json(kind === 'invalid-presign' ? { url: 42 } : kind === 'missing-presign' ? {} : { url: uploadUrl });
    }
    if (address === uploadUrl && init.method === 'PUT') {
      const reader = init.body.getReader(), decoder = new TextDecoder();
      let text = '';
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        text += decoder.decode(value, { stream: true });
        assert(text.length < 65536, 'The fixture upload must remain bounded');
      }
      upload = JSON.parse(text + decoder.decode());
      return new Response('', { status: 200 });
    }
    unexpected.push({ address, method: init.method }); throw new Error('Unexpected routed fetch');
  };
  let failure;
  try {
    const output = new Output(normalized({
      bundleName: 'regression', telemetry: false, dryRun: false, uploadToken: 'test-token', apiUrl: 'https://codecov.test', retryCount: 1
    }), { metaFramework: 'bundle-analyzer' });
    output.assets = [{ name: 'entry.js', normalized: 'entry.js', size: 12, gzipSize: 20 }];
    output.chunks = []; output.modules = []; output.start(); output.end();
    try { await output.write(true); } catch (error) { failure = error; }
  } finally { globalThis.fetch = previousFetch; }
  assert.deepEqual(unexpected, []); assert.deepEqual(escapes, []);
  assert.equal(calls[0]?.address, jobsUrl, 'Must execute the real GitHub jobs path');
  if (['invalid-json', 'nonfinite-json'].includes(kind)) {
    assert.equal(failure?.name, 'ZodError'); assert.equal(calls.length, 1);
  } else if (['invalid-presign', 'missing-presign'].includes(kind)) {
    assert(failure); assert.match(failure.message, /validate pre-signed URL/); assert.equal(calls.length, 2);
  } else {
    assert.equal(failure, undefined); assert.equal(calls.length, 3);
    assert.equal(presign.buildURL, ['no-match', 'http-fallback'].includes(kind) ? runUrl : jobUrl);
    assert.equal(upload.bundleName, 'regression'); assert.equal(upload.assets[0].name, 'entry.js');
    assert.deepEqual(upload.chunks, []); assert.deepEqual(upload.modules, []);
  }
  console.log('PASS actual Output.write(true) ' + kind);
}
for (const kind of mode === 'override-only' ? ['valid'] : ['valid', 'no-match', 'http-fallback', 'invalid-json', 'nonfinite-json', 'invalid-presign', 'missing-presign']) await scenario(kind);
if (mode === 'patched') {
  const { z } = coreRequire('zod');
  let visits = 0;
  const schema = z.array(z.preprocess(value => { visits++; return value; }, z.string())).max(2);
  const oversized = schema.safeParse([1, 2, 3]);
  assert.equal(oversized.success, false); assert.equal(visits, 0);
  assert.deepEqual(oversized.error.issues.map(issue => [issue.code, issue.path]), [['too_big', []]]);
  const inside = schema.safeParse([1, 2]); assert.equal(inside.success, false); assert.equal(visits, 2);
  assert.deepEqual(inside.error.issues.map(issue => issue.path), [[0], [1]]);
  console.log('PASS actual patched Zod constrained-collection early rejection');
}
assert.deepEqual(escapes, []);
