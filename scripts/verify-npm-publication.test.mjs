import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { verifyNpmPublication } from './verify-npm-publication.mjs';

const bytes = Buffer.from('the exact verified release archive bytes');
const sha256 = createHash('sha256').update(bytes).digest('hex');
const integrity = `sha512-${createHash('sha512').update(bytes).digest('base64')}`;
const metadataUrl = 'https://registry.npmjs.org/%40aceshooting%2Flyra-ui/1.2.3';
const tarballUrl = 'https://registry.npmjs.org/@aceshooting/lyra-ui/-/lyra-ui-1.2.3.tgz';
const credentialUrl = new URL(tarballUrl);
credentialUrl.username = 'fixture-user';
credentialUrl.password = 'fixture-password';
const metadata = (changes = {}) => new Response(JSON.stringify({ name: '@aceshooting/lyra-ui', version: '1.2.3',
  dist: { integrity, tarball: tarballUrl }, ...changes }));
const archive = () => new Response(bytes, { headers: { 'content-length': String(bytes.length) } });

async function fixture(run) {
  const directory = await mkdtemp(join(tmpdir(), 'lyra-npm-publication-'));
  const tarball = join(directory, 'release.tgz'); await writeFile(tarball, bytes);
  const options = { tag: 'lyra-ui@1.2.3', tarball, expectedSha256: sha256, timeoutMs: 100, retryMs: 10, requestTimeoutMs: 10 };
  const calls = [], sleeps = [];
  let clock = 0;
  const dependencies = response => ({ now: () => clock, sleep: async milliseconds => { sleeps.push(milliseconds); clock += milliseconds; },
    fetch: async (url, init) => {
      assert.equal(init.redirect, 'manual'); assert.equal(init.credentials, 'omit');
      assert.deepEqual(Object.keys(init.headers).sort(), ['accept', 'accept-encoding']);
      calls.push({ url, init }); return response(url, calls.length);
    } });
  try { await run({ options, calls, sleeps, dependencies, advance: milliseconds => { clock += milliseconds; } }); }
  finally { await rm(directory, { recursive: true, force: true }); }
}

test('publication succeeds only after hashing the canonical tarball bytes', async () => fixture(async ({ options, calls, dependencies }) => {
  const receipt = await verifyNpmPublication(options, dependencies(url => url === metadataUrl ? metadata() : archive()));
  assert.deepEqual(calls.map(call => call.url), [metadataUrl, tarballUrl]);
  assert.deepEqual(receipt, { packageName: '@aceshooting/lyra-ui', version: '1.2.3', byteLength: bytes.length, integrity });
}));

test('metadata-ready with canonical tarball404 cannot finish green', async () => fixture(async ({ options, calls, sleeps, dependencies }) => {
  await assert.rejects(verifyNpmPublication({ ...options, timeoutMs: 20 }, dependencies(url => url === metadataUrl ? metadata() : new Response(null, { status: 404 }))), /still does not serve/u);
  assert.deepEqual(calls.map(call => call.url), [metadataUrl, tarballUrl, metadataUrl, tarballUrl]);
  assert.deepEqual(sleeps, [10, 10]);
}));

test('transient metadata, tarball and network failures retry before the same deadline', async () => fixture(async ({ options, calls, sleeps, dependencies }) => {
  const responses = [() => new Response(null, { status: 404 }), () => { throw new Error('untrusted transport detail'); },
    metadata, () => new Response(null, { status: 503 }), metadata, archive];
  await verifyNpmPublication(options, dependencies((_url, count) => responses[count - 1]()));
  assert.equal(calls.length, 6); assert.deepEqual(sleeps, [10, 10, 10]);
}));

test('wrong downloaded bytes fail immediately even when metadata integrity is correct', async () => fixture(async ({ options, calls, sleeps, dependencies }) => {
  const wrong = Buffer.from(bytes); wrong[0] ^= 1;
  await assert.rejects(verifyNpmPublication(options, dependencies(url => url === metadataUrl ? metadata() : new Response(wrong))), /downloaded npm tarball integrity differs/u);
  assert.equal(calls.length, 2); assert.deepEqual(sleeps, []);
}));

for (const declaredLength of [false, true]) test(`truncated downloaded bytes fail closed with content-length ${declaredLength}`, async () => fixture(async ({ options, sleeps, dependencies }) => {
  await assert.rejects(verifyNpmPublication(options, dependencies(url => url === metadataUrl ? metadata()
    : new Response(bytes.subarray(0, -1), declaredLength ? { headers: { 'content-length': String(bytes.length) } } : undefined))), /truncated/u);
  assert.deepEqual(sleeps, []);
}));

test('oversize header is rejected before reading the tarball body', async () => fixture(async ({ options, sleeps, dependencies }) => {
  let cancelled = false;
  const body = new ReadableStream({ cancel() { cancelled = true; } });
  await assert.rejects(verifyNpmPublication(options, dependencies(url => url === metadataUrl ? metadata()
    : new Response(body, { headers: { 'content-length': String(bytes.length + 1) } }))), /byte ceiling/u);
  assert.equal(cancelled, true); assert.deepEqual(sleeps, []);
}));

test('streamed oversize bytes are bounded without trusting content-length', async () => fixture(async ({ options, dependencies }) => {
  let cancelled = false;
  const body = new ReadableStream({ start(controller) { controller.enqueue(bytes); controller.enqueue(new Uint8Array([0])); }, cancel() { cancelled = true; } });
  await assert.rejects(verifyNpmPublication(options, dependencies(url => url === metadataUrl ? metadata() : new Response(body))), /byte ceiling/u);
  assert.equal(cancelled, true);
}));

test('body timeout aborts reading and cannot outlive the publication deadline', async () => fixture(async ({ options, calls, sleeps, dependencies }) => {
  let cancelled = false;
  const body = new ReadableStream({ start(controller) { controller.enqueue(bytes.subarray(0, 3)); }, cancel() { cancelled = true; } });
  await assert.rejects(verifyNpmPublication({ ...options, timeoutMs: 10, retryMs: 10, requestTimeoutMs: 5 }, dependencies(url => url === metadataUrl ? metadata() : new Response(body))), /still does not serve/u);
  assert.equal(cancelled, true); assert.equal(calls.at(-1).init.signal.aborted, true); assert.deepEqual(sleeps, [10]);
}));

test('header timeout is bounded even when the transport ignores its abort signal', async () => fixture(async ({ options, calls, dependencies }) => {
  await assert.rejects(verifyNpmPublication({ ...options, timeoutMs: 10, retryMs: 10, requestTimeoutMs: 5 }, dependencies(() => new Promise(() => {}))), /still does not serve/u);
  assert.equal(calls.length, 1); assert.equal(calls[0].init.signal.aborted, true);
}));

test('a correct download completing after the overall deadline cannot pass', async () => fixture(async ({ options, advance, dependencies }) => {
  await assert.rejects(verifyNpmPublication(options, dependencies(url => { if (url === metadataUrl) return metadata(); advance(101); return archive(); })), /still does not serve/u);
}));

for (const [name, url] of [
  ['HTTP', 'http://registry.npmjs.org/@aceshooting/lyra-ui/-/lyra-ui-1.2.3.tgz'],
  ['foreign host', 'https://example.com/archive.tgz'],
  ['credentials', credentialUrl.href],
  ['nonstandard port', 'https://registry.npmjs.org:444/@aceshooting/lyra-ui/-/lyra-ui-1.2.3.tgz'],
  ['query', `${tarballUrl}?token=untrusted`], ['fragment', `${tarballUrl}#fragment`],
  ['different package', 'https://registry.npmjs.org/@aceshooting/lyra-gen/-/lyra-gen-1.2.3.tgz'],
  ['different version', 'https://registry.npmjs.org/@aceshooting/lyra-ui/-/lyra-ui-1.2.4.tgz'],
]) test(`noncanonical tarball URL is refused: ${name}`, async () => fixture(async ({ options, calls, sleeps, dependencies }) => {
  await assert.rejects(verifyNpmPublication(options, dependencies(() => metadata({ dist: { integrity, tarball: url } }))), /canonical release tarball URL/u);
  assert.equal(calls.length, 1); assert.deepEqual(sleeps, []);
}));

test('metadata identity/integrity conflicts, redirects and auth errors fail without retry', async () => fixture(async ({ options, sleeps, dependencies }) => {
  for (const response of [() => metadata({ name: '@aceshooting/lyra-gen' }), () => metadata({ version: '1.2.4' }),
    () => metadata({ dist: { integrity: 'sha512-wrong', tarball: tarballUrl } }),
    () => new Response(null, { status: 302, headers: { location: 'https://example.com/' } }), () => new Response(null, { status: 401 })]) {
    await assert.rejects(verifyNpmPublication(options, dependencies(response)), /verified release identity|metadata integrity differs|unsupported response/u);
  }
  assert.deepEqual(sleeps, []);
}));

test('tarball redirects, partial responses, foreign response URLs and encoded bodies are refused', async () => fixture(async ({ options, sleeps, dependencies }) => {
  for (const response of [() => new Response(null, { status: 302, headers: { location: 'https://example.com/' } }),
    () => new Response(bytes, { status: 206 }),
    () => Object.defineProperty(archive(), 'url', { value: 'https://example.com/archive.tgz' }),
    () => new Response(bytes, { headers: { 'content-encoding': 'gzip' } })]) {
    await assert.rejects(verifyNpmPublication(options, dependencies(url => url === metadataUrl ? metadata() : response())), /unsupported response or URL|unsupported content encoding/u);
  }
  assert.deepEqual(sleeps, []);
}));

test('metadata body limit and local artifact digest are checked before trusting publication', async () => fixture(async ({ options, calls, dependencies }) => {
  await assert.rejects(verifyNpmPublication({ ...options, expectedSha256: '0'.repeat(64) }, dependencies(metadata)), /local tarball differs/u);
  assert.equal(calls.length, 0);
  await assert.rejects(verifyNpmPublication(options, dependencies(() => new Response('{}', { headers: { 'content-length': '1048577' } }))), /byte ceiling/u);
}));

test('malformed/missing metadata retries only until deadline and invalid tags never fetch', async () => fixture(async ({ options, calls, dependencies }) => {
  for (const body of ['{', '{}']) await assert.rejects(verifyNpmPublication({ ...options, timeoutMs: 10 }, dependencies(() => new Response(body))), /still does not serve/u);
  const before = calls.length;
  for (const tag of ['other@1.2.3', 'lyra-ui@01.2.3', 'lyra-ui@1.2.3-beta.1', 'lyra-ui@1.2.3/../../other']) {
    await assert.rejects(verifyNpmPublication({ ...options, tag }, dependencies(metadata)), /verified stable release tag/u);
  }
  assert.equal(calls.length, before);
}));

test('CLI fails concisely before network when the local verified artifact differs', async () => fixture(async ({ options }) => {
  const result = spawnSync(process.execPath, ['scripts/verify-npm-publication.mjs'], { encoding: 'utf8',
    env: { ...process.env, TAG: options.tag, TARBALL: options.tarball, EXPECTED_SHA256: '0'.repeat(64) } });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /::error::The local tarball differs from the verified release artifact/u);
  assert.doesNotMatch(result.stderr, /release\.tgz|Error:|at file:|the exact verified release archive bytes/u);
}));
