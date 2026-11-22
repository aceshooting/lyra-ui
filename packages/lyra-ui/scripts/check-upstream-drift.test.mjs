import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { gzipSync } from 'node:zlib';

import {
  compareVersions,
  diffManifests,
  hasDrift,
  issueFor,
  renderMarkdown,
  runUpstreamDrift,
} from './check-upstream-drift.mjs';

const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const integrity = (value) => `sha512-${createHash('sha512').update(value).digest('base64')}`;

function tarHeader(name, size) {
  const header = Buffer.alloc(512);
  header.write(name, 0, 100, 'utf8');
  header.write('0000644\0', 100, 8, 'ascii');
  header.write(`${size.toString(8).padStart(11, '0')}\0`, 124, 12, 'ascii');
  header.fill(0x20, 148, 156);
  header.write('0', 156, 1, 'ascii');
  const checksum = header.reduce((total, byte) => total + byte, 0);
  header.write(`${checksum.toString(8).padStart(6, '0')}\0 `, 148, 8, 'ascii');
  return header;
}

function makeTarball(entries) {
  const parts = [];
  for (const [name, source] of Object.entries(entries)) {
    const body = Buffer.from(source);
    parts.push(tarHeader(name, body.length), body, Buffer.alloc((512 - (body.length % 512)) % 512));
  }
  parts.push(Buffer.alloc(1024));
  return gzipSync(Buffer.concat(parts));
}

const NAME = '@awesome.me/webawesome';
const MANIFEST_PATH = 'package/dist/custom-elements.json';

const cls = (tagName, extra = {}) => ({ kind: 'class', tagName, ...extra });
const manifestOf = (version, declarations) => ({
  schemaVersion: '1.0.0',
  package: { name: NAME, version },
  modules: [{ kind: 'javascript-module', path: 'x.js', declarations }],
});

const OLD = manifestOf('1.0.0', [
  cls('wa-a', {
    attributes: [{ name: 'size' }, { name: 'gone' }],
    members: [
      { kind: 'field', name: 'size' },
      { kind: 'field', name: 'hidden', privacy: 'private' },
      { kind: 'method', name: 'show' },
    ],
    slots: [{ name: '' }],
    cssParts: [{ name: 'base' }],
    events: [{ name: 'wa-x' }],
    cssProperties: [{ name: '--w' }],
  }),
  cls('wa-removed'),
  cls('wa-b'),
]);
const NEW = manifestOf('1.1.0', [
  cls('wa-a', {
    attributes: [{ name: 'size' }, { name: 'tone' }],
    members: [
      { kind: 'field', name: 'size', deprecated: true },
      { kind: 'field', name: 'hidden2', privacy: 'private' },
      { kind: 'method', name: 'show' },
      { kind: 'method', name: 'hide' },
    ],
    slots: [{ name: '' }, { name: 'footer' }],
    cssParts: [{ name: 'base' }, { name: 'body' }],
    events: [],
    cssProperties: [{ name: '--w' }, { name: '--h' }],
  }),
  cls('wa-new'),
  cls('wa-b', { deprecated: 'use wa-a' }),
]);

function registry(versions) {
  const responses = new Map();
  for (const [version, manifest] of Object.entries(versions)) {
    const manifestBytes = JSON.stringify(manifest);
    const tarball = makeTarball({
      'package/package.json': JSON.stringify({ name: NAME, version }),
      [MANIFEST_PATH]: manifestBytes,
    });
    const url = `https://registry.npmjs.org/${NAME}/-/webawesome-${version}.tgz`;
    const meta = JSON.stringify({ name: NAME, version, dist: { integrity: integrity(tarball), tarball: url } });
    responses.set(`https://registry.npmjs.org/${encodeURIComponent(NAME)}/${version}`, meta);
    responses.set(url, tarball);
    versions[version] = { tarball, manifestBytes, meta };
  }
  const latest = Object.keys(versions).sort(compareVersions).at(-1);
  responses.set(`https://registry.npmjs.org/${encodeURIComponent(NAME)}/latest`, versions[latest].meta);
  const requested = [];
  const fetchImpl = async (url) => {
    requested.push(url);
    if (!responses.has(url)) return new Response('missing', { status: 404 });
    return new Response(responses.get(url));
  };
  return { fetchImpl, requested };
}

function pinFor(version, tarball, manifestBytes) {
  return {
    packages: {
      webawesome: {
        name: NAME,
        version,
        tarballUrl: `https://registry.npmjs.org/${NAME}/-/webawesome-${version}.tgz`,
        tarballIntegrity: integrity(tarball),
        manifestPath: MANIFEST_PATH,
        manifestSha256: sha256(manifestBytes),
      },
    },
  };
}

test('compareVersions orders numerically', () => {
  assert.equal(compareVersions('3.9.0', '3.11.0'), -1);
  assert.equal(compareVersions('3.15.0', '3.15.0'), 0);
  assert.equal(compareVersions('4.0.0', '3.99.9'), 1);
});

test('diffManifests reports tags, members, and new deprecations', () => {
  const diff = diffManifests(OLD, NEW);
  assert.deepEqual(diff.addedTags, ['wa-new']);
  assert.deepEqual(diff.removedTags, ['wa-removed']);
  assert.deepEqual(diff.newlyDeprecatedTags, ['wa-b']);
  assert.deepEqual(Object.keys(diff.changedTags), ['wa-a']);
  const a = diff.changedTags['wa-a'];
  assert.deepEqual(a.attributes, { added: ['tone'], removed: ['gone'], deprecated: [] });
  assert.deepEqual(a.properties, { added: [], removed: [], deprecated: ['size'] });
  assert.deepEqual(a.methods.added, ['hide']);
  assert.deepEqual(a.slots.added, ['footer']);
  assert.deepEqual(a.parts.added, ['body']);
  assert.deepEqual(a.cssProperties.added, ['--h']);
  assert.deepEqual(a.events.removed, ['wa-x']);
  assert.ok(hasDrift(diff));
  assert.equal(hasDrift(diffManifests(OLD, OLD)), false);
});

test('runUpstreamDrift diffs a newer release against the verified pin without network', async () => {
  const versions = { '1.0.0': OLD, '1.1.0': NEW };
  const { fetchImpl } = registry(versions);
  const pins = pinFor('1.0.0', versions['1.0.0'].tarball, versions['1.0.0'].manifestBytes);
  const [result] = await runUpstreamDrift({ pins, fetchImpl });
  assert.equal(result.latest, '1.1.0');
  assert.equal(result.drift, true);
  assert.deepEqual(result.diff.addedTags, ['wa-new']);
  const markdown = renderMarkdown([result]);
  assert.match(markdown, /pinned 1\.0\.0, latest 1\.1\.0/u);
  assert.match(markdown, /Added tags: `wa-new`/u);
  assert.match(markdown, /attributes added: `tone`/u);
});

test('runUpstreamDrift reports no drift and skips the pinned download when current', async () => {
  const versions = { '1.0.0': OLD };
  const { fetchImpl, requested } = registry(versions);
  const pins = pinFor('1.0.0', versions['1.0.0'].tarball, versions['1.0.0'].manifestBytes);
  const [result] = await runUpstreamDrift({ pins, fetchImpl });
  assert.equal(result.drift, false);
  assert.equal(requested.filter((url) => url.endsWith('/1.0.0')).length, 0);
  assert.match(renderMarkdown([result]), /No newer stable release/u);
});

test('runUpstreamDrift rejects a tarball that does not match the registry integrity', async () => {
  const versions = { '1.0.0': OLD, '1.1.0': NEW };
  const { fetchImpl } = registry(versions);
  const pins = pinFor('1.0.0', versions['1.0.0'].tarball, versions['1.0.0'].manifestBytes);
  const tampered = async (url) =>
    url.endsWith('webawesome-1.1.0.tgz') ? new Response(makeTarball({ 'package/package.json': '{}' })) : fetchImpl(url);
  await assert.rejects(runUpstreamDrift({ pins, fetchImpl: tampered }), /does not match registry integrity/u);
});

test('runUpstreamDrift rejects a prerelease latest tag', async () => {
  const versions = { '1.0.0': OLD };
  const { fetchImpl } = registry(versions);
  const pins = pinFor('1.0.0', versions['1.0.0'].tarball, versions['1.0.0'].manifestBytes);
  const pre = async (url) =>
    url.endsWith('/latest')
      ? new Response(JSON.stringify({ name: NAME, version: '2.0.0-beta.1', dist: {} }))
      : fetchImpl(url);
  await assert.rejects(runUpstreamDrift({ pins, fetchImpl: pre }), /not a stable version/u);
});

test('issueFor builds a stable title and a bounded body', async () => {
  const versions = { '1.0.0': OLD, '1.1.0': NEW };
  const { fetchImpl } = registry(versions);
  const pins = pinFor('1.0.0', versions['1.0.0'].tarball, versions['1.0.0'].manifestBytes);
  const [result] = await runUpstreamDrift({ pins, fetchImpl });
  const issue = issueFor(result);
  assert.equal(issue.title, `Upstream drift: ${NAME} 1.0.0 \u2192 1.1.0`);
  assert.match(issue.body, /Added tags: `wa-new`/u);
  assert.ok(issue.body.length < 61_000);
});
