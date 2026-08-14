import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { gzipSync } from 'node:zlib';
import test from 'node:test';

import {
  downloadPinnedManifest,
  extractTarEntries,
  validatePinConfiguration,
  validatePinnedUpstreamContract,
  writeInventoryFromVerifiedManifests,
} from './check-pinned-upstream-manifests.mjs';

const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const integrity = (value) => `sha512-${createHash('sha512').update(value).digest('base64')}`;

function tarHeader(name, size) {
  const header = Buffer.alloc(512);
  header.write(name, 0, 100, 'utf8');
  header.write('0000644\0', 100, 8, 'ascii');
  header.write('0000000\0', 108, 8, 'ascii');
  header.write('0000000\0', 116, 8, 'ascii');
  header.write(`${size.toString(8).padStart(11, '0')}\0`, 124, 12, 'ascii');
  header.write('00000000000\0', 136, 12, 'ascii');
  header.fill(0x20, 148, 156);
  header.write('0', 156, 1, 'ascii');
  header.write('ustar\0', 257, 6, 'ascii');
  header.write('00', 263, 2, 'ascii');
  const checksum = header.reduce((total, byte) => total + byte, 0);
  header.write(`${checksum.toString(8).padStart(6, '0')}\0 `, 148, 8, 'ascii');
  return header;
}

function makeTarball(entries) {
  const parts = [];
  for (const [name, source] of Array.isArray(entries) ? entries : Object.entries(entries)) {
    const body = Buffer.from(source);
    parts.push(tarHeader(name, body.length), body);
    const padding = (512 - (body.length % 512)) % 512;
    if (padding) parts.push(Buffer.alloc(padding));
  }
  parts.push(Buffer.alloc(1024));
  return gzipSync(Buffer.concat(parts));
}

function fixture() {
  const name = '@example/surface';
  const version = '1.2.3';
  const manifestPath = 'package/dist/custom-elements.json';
  const manifest = Buffer.from(
    `${JSON.stringify({
      schemaVersion: '1.0.0',
      modules: [],
      package: { name, version },
    })}\n`,
  );
  const packageJson = Buffer.from(`${JSON.stringify({ name, version })}\n`);
  const tarball = makeTarball({
    'package/package.json': packageJson,
    [manifestPath]: manifest,
  });
  const tarballUrl = 'https://registry.npmjs.org/@example/surface/-/surface-1.2.3.tgz';
  const pin = {
    name,
    version,
    tarballUrl,
    tarballIntegrity: integrity(tarball),
    manifestPath,
    manifestSha256: sha256(manifest),
  };
  return { manifest, pin, tarball };
}

function registryFetch(pin, tarball, mutateMetadata = (value) => value) {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url: String(url), options });
    if (String(url) === `https://registry.npmjs.org/${encodeURIComponent(pin.name)}/${pin.version}`) {
      const metadata = mutateMetadata({
        name: pin.name,
        version: pin.version,
        dist: { tarball: pin.tarballUrl, integrity: pin.tarballIntegrity },
      });
      return new Response(JSON.stringify(metadata), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    if (String(url) === pin.tarballUrl) {
      return new Response(tarball, {
        status: 200,
        headers: { 'content-type': 'application/octet-stream' },
      });
    }
    return new Response('not found', { status: 404 });
  };
  return { calls, fetchImpl };
}

test('downloads an exact pinned package artifact and returns its public manifest', async () => {
  const { manifest, pin, tarball } = fixture();
  const { calls, fetchImpl } = registryFetch(pin, tarball);

  const result = await downloadPinnedManifest(pin, { fetchImpl });

  assert.equal(result.manifest.package.name, pin.name);
  assert.equal(result.manifest.package.version, pin.version);
  assert.equal(result.manifestSha256, sha256(manifest));
  assert.equal(result.tarballIntegrity, pin.tarballIntegrity);
  assert.equal(calls.length, 2);
  assert.ok(calls.every((call) => call.options?.redirect === 'error'));
});

test('fails closed before downloading when registry metadata identity or integrity drifts', async () => {
  const { pin, tarball } = fixture();
  for (const mutateMetadata of [
    (metadata) => ({ ...metadata, name: '@example/other' }),
    (metadata) => ({ ...metadata, version: '1.2.4' }),
    (metadata) => ({
      ...metadata,
      dist: { ...metadata.dist, integrity: `sha512-${Buffer.alloc(64).toString('base64')}` },
    }),
    (metadata) => ({
      ...metadata,
      dist: { ...metadata.dist, tarball: 'https://registry.npmjs.org/@example/surface/-/surface-1.2.4.tgz' },
    }),
  ]) {
    const { calls, fetchImpl } = registryFetch(pin, tarball, mutateMetadata);
    await assert.rejects(downloadPinnedManifest(pin, { fetchImpl }), /metadata|identity|integrity|tarball/u);
    assert.equal(calls.length, 1);
  }
});

test('rejects changed tarball and manifest bytes', async () => {
  const { pin, tarball } = fixture();
  const changedTarball = Buffer.from(tarball);
  changedTarball[changedTarball.length - 1] ^= 1;
  const changedTarballFetch = registryFetch(pin, changedTarball);
  await assert.rejects(
    downloadPinnedManifest(pin, { fetchImpl: changedTarballFetch.fetchImpl }),
    /tarball integrity/u,
  );

  const changedManifestPin = { ...pin, manifestSha256: '0'.repeat(64) };
  const changedManifestFetch = registryFetch(changedManifestPin, tarball);
  await assert.rejects(
    downloadPinnedManifest(changedManifestPin, { fetchImpl: changedManifestFetch.fetchImpl }),
    /manifest SHA-256/u,
  );
});

test('validates embedded package and manifest identities and requires each entry exactly once', async () => {
  const { pin } = fixture();
  const badIdentityTarball = makeTarball({
    'package/package.json': `${JSON.stringify({ name: pin.name, version: '9.9.9' })}\n`,
    [pin.manifestPath]: `${JSON.stringify({
      schemaVersion: '1.0.0',
      modules: [],
      package: { name: pin.name, version: pin.version },
    })}\n`,
  });
  const identityPin = {
    ...pin,
    tarballIntegrity: integrity(badIdentityTarball),
    manifestSha256: sha256(
      Buffer.from(`${JSON.stringify({
        schemaVersion: '1.0.0',
        modules: [],
        package: { name: pin.name, version: pin.version },
      })}\n`),
    ),
  };
  const identityFetch = registryFetch(identityPin, badIdentityTarball);
  await assert.rejects(
    downloadPinnedManifest(identityPin, { fetchImpl: identityFetch.fetchImpl }),
    /embedded package identity/u,
  );

  const wrongManifest = Buffer.from(`${JSON.stringify({
    schemaVersion: '1.0.0',
    modules: [],
    package: { name: '@example/other', version: pin.version },
  })}\n`);
  const wrongManifestTarball = makeTarball({
    'package/package.json': `${JSON.stringify({ name: pin.name, version: pin.version })}\n`,
    [pin.manifestPath]: wrongManifest,
  });
  const wrongManifestPin = {
    ...pin,
    tarballIntegrity: integrity(wrongManifestTarball),
    manifestSha256: sha256(wrongManifest),
  };
  const wrongManifestFetch = registryFetch(wrongManifestPin, wrongManifestTarball);
  await assert.rejects(
    downloadPinnedManifest(wrongManifestPin, { fetchImpl: wrongManifestFetch.fetchImpl }),
    /manifest package identity/u,
  );

  assert.throws(
    () =>
      extractTarEntries(
        makeTarball([
          ['package/package.json', '{}'],
          [pin.manifestPath, '{}'],
          [pin.manifestPath, '{}'],
        ]),
        ['package/package.json', pin.manifestPath],
      ),
    /duplicate required archive entry/u,
  );
  assert.throws(
    () => extractTarEntries(makeTarball({ 'package/package.json': '{}' }), [pin.manifestPath]),
    /missing required archive entry/u,
  );
});

test('feeds the verified manifests into strict inventory and pinned-surface validation', () => {
  const inventory = { marker: 'inventory' };
  const upstreamTags = { marker: 'tags' };
  const lyraManifest = { marker: 'lyra' };
  const manifests = {
    webawesome: { marker: 'wa' },
    shoelace: { marker: 'sl' },
  };
  const expanded = { marker: 'expanded' };
  let strictCall = 0;
  let pinnedCall = 0;

  const findings = validatePinnedUpstreamContract(
    { inventory, upstreamTags, lyraManifest, manifests },
    {
      expandLyraManifestImpl(value) {
        assert.equal(value, lyraManifest);
        return expanded;
      },
      validateInventoryImpl(value, options) {
        strictCall += 1;
        assert.equal(value, inventory);
        assert.equal(options.upstreamTags, upstreamTags);
        assert.equal(options.lyraManifest, expanded);
        assert.equal(options.strict, true);
        return ['z-finding', 'duplicate'];
      },
      validatePinnedManifestsImpl(value, options) {
        pinnedCall += 1;
        assert.equal(value, inventory);
        assert.equal(options.webawesomeManifest, manifests.webawesome);
        assert.equal(options.shoelaceManifest, manifests.shoelace);
        assert.equal(options.upstreamTags, upstreamTags);
        return ['a-finding', 'duplicate'];
      },
    },
  );

  assert.equal(strictCall, 1);
  assert.equal(pinnedCall, 1);
  assert.deepEqual(findings, ['a-finding', 'duplicate', 'z-finding']);
});

test('writes inventory from verified manifests through private temporary inputs', () => {
  const directory = fs.mkdtempSync(path.join(tmpdir(), 'lyra-inventory-output-'));
  const output = path.join(directory, 'component-inventory.json');
  const manifests = {
    webawesome: { schemaVersion: '1.0.0', modules: [{ path: 'wa.js' }] },
    shoelace: { schemaVersion: '1.0.0', modules: [{ path: 'sl.js' }] },
  };
  let manifestDirectory;
  try {
    const generated = writeInventoryFromVerifiedManifests(manifests, {
      output,
      generateInventoryImpl(options) {
        manifestDirectory = path.dirname(options.webawesomeManifest);
        assert.notEqual(manifestDirectory, directory);
        assert.deepEqual(JSON.parse(fs.readFileSync(options.webawesomeManifest, 'utf8')), manifests.webawesome);
        assert.deepEqual(JSON.parse(fs.readFileSync(options.shoelaceManifest, 'utf8')), manifests.shoelace);
        assert.equal(options.output, output);
        return { schemaVersion: 7, components: [{ tag: 'lr-example' }] };
      },
    });
    assert.deepEqual(generated, { schemaVersion: 7, components: [{ tag: 'lr-example' }] });
    assert.equal(
      fs.readFileSync(output, 'utf8'),
      `${JSON.stringify(generated, null, 2)}\n`,
    );
    assert.equal(fs.existsSync(manifestDirectory), false);
  } finally {
    fs.rmSync(directory, { force: true, recursive: true });
  }
});

test('pin configuration must match the canonical packages and upstream versions', () => {
  const fixturePins = {
    schemaVersion: 1,
    registry: 'https://registry.npmjs.org/',
    packages: {
      webawesome: {
        name: '@awesome.me/webawesome',
        version: '3.11.0',
        tarballUrl: 'https://registry.npmjs.org/@awesome.me/webawesome/-/webawesome-3.11.0.tgz',
        tarballIntegrity: `sha512-${Buffer.alloc(64).toString('base64')}`,
        manifestPath: 'package/dist/custom-elements.json',
        manifestSha256: 'a'.repeat(64),
      },
      shoelace: {
        name: '@shoelace-style/shoelace',
        version: '2.20.1',
        tarballUrl: 'https://registry.npmjs.org/@shoelace-style/shoelace/-/shoelace-2.20.1.tgz',
        tarballIntegrity: `sha512-${Buffer.alloc(64).toString('base64')}`,
        manifestPath: 'package/dist/custom-elements.json',
        manifestSha256: 'b'.repeat(64),
      },
    },
  };
  const upstreamTags = {
    webawesome: { version: '3.11.0' },
    shoelace: {
      version: '2.20.1',
      runtimeEventCancelability: {
        source: {
          package: '@shoelace-style/shoelace',
          version: '2.20.1',
          tarballIntegrity: fixturePins.packages.shoelace.tarballIntegrity,
        },
      },
    },
  };
  const inventory = {
    pins: {
      webawesome: { version: '3.11.0' },
      shoelace: { version: '2.20.1' },
    },
    upstreams: {
      webawesome: { version: '3.11.0' },
      shoelace: { version: '2.20.1' },
    },
  };

  assert.doesNotThrow(() => validatePinConfiguration(fixturePins, { inventory, upstreamTags }));
  const staleTags = structuredClone(upstreamTags);
  staleTags.shoelace.version = '2.20.0';
  assert.throws(
    () => validatePinConfiguration(fixturePins, { inventory, upstreamTags: staleTags }),
    /Shoelace.*2\.20\.0.*2\.20\.1/u,
  );

  const staleEvidence = structuredClone(upstreamTags);
  staleEvidence.shoelace.runtimeEventCancelability.source.tarballIntegrity =
    `sha512-${Buffer.alloc(64, 1).toString('base64')}`;
  assert.throws(
    () => validatePinConfiguration(fixturePins, { inventory, upstreamTags: staleEvidence }),
    /Shoelace: runtime evidence integrity does not match the reviewed artifact/u,
  );
});
