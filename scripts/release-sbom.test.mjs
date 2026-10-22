import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { generateSbom, normalizeSbom } from './release-artifacts.mjs';

const root = {
  type: 'library', name: 'lyra-ui', group: '@aceshooting', version: '1.2.3',
  purl: 'pkg:npm/%40aceshooting/lyra-ui@1.2.3', 'bom-ref': 'pkg:npm/%40aceshooting/lyra-ui@1.2.3',
};
const component = (name, version) => ({
  type: 'library', name, version, purl: `pkg:npm/${name}@${version}`, 'bom-ref': `pkg:npm/${name}@${version}`,
});
const lit = component('lit', '3.3.3');
const tslib = component('tslib', '2.8.1');
const litHtml = component('lit-html', '3.3.3');

/** What `pnpm sbom` returns: random serial number and clock, components in hash-map order. */
const pnpmDocument = (order) => ({
  bomFormat: 'CycloneDX',
  specVersion: '1.6',
  serialNumber: `urn:uuid:${Math.random().toString(16).slice(2).padEnd(32, '0').slice(0, 32)}`,
  version: 1,
  metadata: { timestamp: new Date().toISOString(), tools: { components: [{ name: 'pnpm', version: '12.14.0' }] }, component: root },
  components: order.map((index) => [lit, tslib, litHtml][index]),
  dependencies: order.map((index) => ({
    ref: [lit, tslib, litHtml][index]['bom-ref'],
    dependsOn: index === 0 ? [litHtml['bom-ref'], tslib['bom-ref']] : [],
  })),
});

test('a normalized SBOM does not depend on pnpm ordering, the clock or a random serial number', () => {
  const options = { sourceSha: 'a'.repeat(40), timestamp: '2026-10-22T10:00:00.000Z' };
  const first = normalizeSbom(pnpmDocument([0, 1, 2]), options);
  assert.equal(normalizeSbom(pnpmDocument([2, 0, 1]), options), first);
  assert.equal(normalizeSbom(pnpmDocument([1, 2, 0]), options), first);
  const bom = JSON.parse(first);
  assert.match(bom.serialNumber, /^urn:uuid:[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u);
  assert.equal(bom.metadata.timestamp, '2026-10-22T10:00:00.000Z');
  // Code-unit order of the package URLs: `lit-html@` sorts before `lit@` because '-' precedes '@'.
  assert.deepEqual(bom.components.map((entry) => entry.name), ['lit-html', 'lit', 'tslib']);
  assert.deepEqual(bom.dependencies.find((entry) => entry.ref === lit['bom-ref']).dependsOn, [litHtml['bom-ref'], tslib['bom-ref']]);
  assert.equal(bom.metadata.tools.components[0].version, '12.14.0', 'other fields pass through');
  assert.ok(first.endsWith('}\n'));
  const other = JSON.parse(normalizeSbom(pnpmDocument([0, 1, 2]), { ...options, sourceSha: 'b'.repeat(40) }));
  assert.notEqual(other.serialNumber, bom.serialNumber, 'the serial number follows the commit');
});

function fixtureRepository() {
  const fixture = mkdtempSync(path.join(tmpdir(), 'lyra-sbom-'));
  const git = (...args) => {
    const result = spawnSync('git', args, {
      cwd: fixture, encoding: 'utf8', env: { ...process.env, GIT_COMMITTER_DATE: '2026-10-22T10:00:00Z', GIT_AUTHOR_DATE: '2026-10-22T10:00:00Z' },
    });
    assert.equal(result.status, 0, result.stderr);
    return result.stdout.trim();
  };
  git('init', '--quiet');
  git('config', 'user.email', 'fixture@example.invalid');
  git('config', 'user.name', 'SBOM fixture');
  const expected = { directory: 'packages/lyra-ui', packageName: '@aceshooting/lyra-ui', version: '1.2.3' };
  mkdirSync(path.join(fixture, expected.directory), { recursive: true });
  writeFileSync(path.join(fixture, 'package.json'), '{"private":true}\n');
  writeFileSync(path.join(fixture, 'pnpm-workspace.yaml'), "packages:\n  - 'packages/*'\n");
  writeFileSync(path.join(fixture, 'pnpm-lock.yaml'), "lockfileVersion: '9.0'\n");
  writeFileSync(path.join(fixture, expected.directory, 'package.json'), `${JSON.stringify({ name: expected.packageName, version: expected.version })}\n`);
  git('add', '.');
  git('commit', '--quiet', '-m', 'Fixture');
  return { fixture, expected, sourceSha: git('rev-parse', 'HEAD') };
}

test('the generated SBOM is reproducible bytes stamped with the tagged commit time', () => {
  const { fixture, expected, sourceSha } = fixtureRepository();
  try {
    const run = () => pnpmDocument([0, 1, 2].sort(() => Math.random() - 0.5));
    const first = generateSbom({ expected, sourceSha, repositoryRoot: fixture, run });
    const second = generateSbom({ expected, sourceSha, repositoryRoot: fixture, run });
    assert.ok(first.equals(second));
    assert.equal(JSON.parse(first).metadata.timestamp, '2026-10-22T10:00:00.000Z');
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});

test('an SBOM that does not describe the tagged package is rejected', () => {
  const { fixture, expected, sourceSha } = fixtureRepository();
  try {
    const attempt = (mutate) => () => generateSbom({
      expected, sourceSha, repositoryRoot: fixture,
      run: () => mutate(structuredClone(pnpmDocument([0, 1, 2]))),
    });
    const wrong = /does not describe the tagged package/u;
    assert.throws(attempt((bom) => ({ ...bom, bomFormat: 'SPDX' })), wrong);
    assert.throws(attempt((bom) => ({ ...bom, specVersion: '1.7' })), wrong);
    assert.throws(attempt((bom) => { bom.metadata.component.version = '9.9.9'; return bom; }), wrong);
    assert.throws(attempt((bom) => { bom.metadata.component.name = 'lyra-map'; return bom; }), wrong);
    assert.doesNotThrow(attempt((bom) => bom));
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});

test('the SBOM is only generated from a checkout that holds the tagged lockfile and manifests', () => {
  const { fixture, expected, sourceSha } = fixtureRepository();
  try {
    for (const file of ['pnpm-lock.yaml', 'package.json', 'pnpm-workspace.yaml', `${expected.directory}/package.json`]) {
      const original = path.join(fixture, file);
      writeFileSync(original, `${JSON.stringify({ drift: file })}\n`);
      // No injected generator: the real one must refuse before it would ever start pnpm.
      assert.throws(
        () => generateSbom({ expected, sourceSha, repositoryRoot: fixture }),
        new RegExp(`${file.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')} differs from commit`, 'u'),
      );
      spawnSync('git', ['checkout', '--quiet', '--', file], { cwd: fixture });
    }
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});
