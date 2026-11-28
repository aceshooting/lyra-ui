import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  DEV_ONLY_FIELDS,
  REQUIRED_PUBLISHED_FIELDS,
  backupPath,
  findPackingProcess,
  packedManifestFindings,
  publishedManifest,
  restoreManifest,
  serializeManifest,
  stripManifest,
} from './packed-manifest.mjs';

const tool = fileURLToPath(new URL('packed-manifest.mjs', import.meta.url));
const packagesRoot = fileURLToPath(new URL('../../', import.meta.url));

const source = {
  name: '@example/pkg',
  version: '1.2.3',
  description: 'Example',
  license: 'MIT',
  type: 'module',
  repository: { type: 'git', url: 'git+https://example.invalid/repo.git' },
  engines: { node: '>=22' },
  files: ['index.js'],
  exports: { '.': './index.js' },
  bin: { example: './index.js' },
  sideEffects: false,
  scripts: { pretest: 'node never-shipped.mjs', test: 'node --test' },
  dependencies: { lit: '^3.0.0' },
  peerDependencies: { '@example/core': 'workspace:^' },
  devDependencies: { typescript: '6.0.0' },
  packageManager: 'pnpm@12.23.0',
};

function fixturePackage(manifest = source, text = `${JSON.stringify(manifest, null, 4)}\n`) {
  const dir = mkdtempSync(join(tmpdir(), 'lyra-packed-manifest-'));
  writeFileSync(join(dir, 'package.json'), text);
  return { dir, text };
}

test('the published manifest drops only contributor-only fields and keeps key order', () => {
  const published = publishedManifest(source);
  for (const field of DEV_ONLY_FIELDS) assert.equal(Object.hasOwn(published, field), false, field);
  assert.deepEqual(Object.keys(published), Object.keys(source).filter((key) => !DEV_ONLY_FIELDS.includes(key)));
  assert.deepEqual(packedManifestFindings(published, source), []);
  assert.throws(() => publishedManifest([]), /JSON object/u);
});

test('packed manifest findings name leaked, missing and altered fields', () => {
  assert.match(packedManifestFindings(source, source).join('\n'), /contributor-only 'scripts'[\s\S]*'devDependencies'[\s\S]*'packageManager'/u);
  for (const field of REQUIRED_PUBLISHED_FIELDS) {
    const { [field]: _omitted, ...rest } = publishedManifest(source);
    assert.match(packedManifestFindings(rest).join('\n'), new RegExp(`lacks required '${field}'`, 'u'), field);
  }
  const { bin: _bin, ...withoutBin } = publishedManifest(source);
  assert.match(packedManifestFindings(withoutBin, source).join('\n'), /dropped consumer field 'bin'/u);
  assert.match(
    packedManifestFindings({ ...publishedManifest(source), exports: { '.': './other.js' } }, source).join('\n'),
    /packed 'exports' differs/u,
  );
  // pnpm resolves workspace ranges while packing; dependency maps compare by name.
  assert.deepEqual(
    packedManifestFindings({ ...publishedManifest(source), peerDependencies: { '@example/core': '^1.0.0' } }, source),
    [],
  );
  assert.match(
    packedManifestFindings({ ...publishedManifest(source), dependencies: {} }, source).join('\n'),
    /packed 'dependencies' names differ/u,
  );
  assert.deepEqual(packedManifestFindings(null), ['The packed package/package.json is not a JSON object.']);
});

test('strip writes the published manifest and restore brings back the exact original bytes', () => {
  const { dir, text } = fixturePackage();
  try {
    stripManifest(dir);
    const stripped = readFileSync(join(dir, 'package.json'), 'utf8');
    assert.equal(stripped, serializeManifest(publishedManifest(source)));
    assert.equal(readFileSync(backupPath(dir), 'utf8'), text);
    assert.ok(backupPath(dir).startsWith(join(dir, 'node_modules')), 'the original is kept where no archive reaches');
    assert.equal(restoreManifest(dir), true);
    assert.equal(readFileSync(join(dir, 'package.json'), 'utf8'), text);
    assert.equal(existsSync(backupPath(dir)), false);
    assert.deepEqual(readdirSync(join(backupPath(dir), '..')), [], 'restore leaves nothing behind');
    assert.equal(restoreManifest(dir), false, 'a second restore is a no-op');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('a strip after an interrupted pack recovers the kept original instead of re-stripping', () => {
  const { dir, text } = fixturePackage();
  try {
    stripManifest(dir);
    stripManifest(dir);
    assert.equal(readFileSync(backupPath(dir), 'utf8'), text);
    restoreManifest(dir);
    assert.equal(readFileSync(join(dir, 'package.json'), 'utf8'), text);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('a stale original never overwrites a newer checkout manifest', () => {
  const { dir } = fixturePackage();
  try {
    mkdirSync(join(backupPath(dir), '..'), { recursive: true });
    writeFileSync(backupPath(dir), '{"name":"stale","scripts":{}}\n');
    const newer = `${JSON.stringify({ ...source, version: '1.2.4' }, null, 2)}\n`;
    writeFileSync(join(dir, 'package.json'), newer);
    stripManifest(dir);
    assert.equal(readFileSync(backupPath(dir), 'utf8'), newer);
    restoreManifest(dir);
    assert.equal(readFileSync(join(dir, 'package.json'), 'utf8'), newer);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('restore refuses to lose an edit made while packing or a missing original', () => {
  const { dir } = fixturePackage();
  try {
    stripManifest(dir);
    writeFileSync(join(dir, 'package.json'), '{"name":"edited"}\n');
    assert.throws(() => restoreManifest(dir), /changed while packing/u);
    rmSync(backupPath(dir));
    assert.throws(() => restoreManifest(dir), /restore it from version control/u);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  const published = fixturePackage(publishedManifest(source));
  try {
    assert.throws(() => stripManifest(published.dir), /no scripts to strip/u);
  } finally {
    rmSync(published.dir, { recursive: true, force: true });
  }
});

test('the guard follows the packing pnpm process, never the lifecycle shell', () => {
  const rows = new Map([
    [30, { ppid: 20, args: ['sh', '-c', 'pnpm run build && node packed-manifest.mjs strip'] }],
    [20, { ppid: 10, args: ['/usr/bin/pnpm', '--filter', '@aceshooting/lyra-ui', 'pack', '--pack-destination', 'out'] }],
    [10, { ppid: 1, args: ['bash'] }],
  ]);
  assert.equal(findPackingProcess(30, (pid) => rows.get(pid)), 20);
  assert.equal(findPackingProcess(10, (pid) => rows.get(pid)), undefined);
  assert.equal(findPackingProcess(30, () => { throw new Error('no ps'); }), undefined);
});

test('every published package strips its manifest last in prepack and restores it in postpack', () => {
  const packages = readdirSync(packagesRoot).filter((name) => existsSync(join(packagesRoot, name, 'package.json')));
  assert.ok(packages.length >= 9, packages.join(', '));
  for (const name of packages) {
    const manifest = JSON.parse(readFileSync(join(packagesRoot, name, 'package.json'), 'utf8'));
    if (manifest.private) continue;
    const command = name === 'lyra-ui' ? 'node scripts/packed-manifest.mjs' : 'node ../lyra-ui/scripts/packed-manifest.mjs';
    assert.ok(manifest.scripts.prepack.endsWith(` && ${command} strip`), `${name} prepack must end by stripping`);
    assert.equal(manifest.scripts.postpack, `${command} restore`, `${name} postpack`);
    for (const hook of ['preinstall', 'install', 'postinstall', 'prepare']) {
      assert.equal(manifest.scripts[hook], undefined, `${name} must not run ${hook} on consumer installs`);
    }
    const findings = packedManifestFindings(publishedManifest(manifest), manifest);
    assert.deepEqual(findings, [], `${name} must declare every required published field`);
  }
});

function pnpm(args, cwd) {
  return spawnSync('pnpm', args, { cwd, encoding: 'utf8' });
}

test('pnpm packs the stripped manifest, restores the checkout, and a dry run is restored by the guard', async () => {
  const manifest = {
    name: 'lyra-packed-manifest-fixture',
    version: '1.0.0',
    description: 'Fixture',
    license: 'MIT',
    type: 'module',
    repository: { type: 'git', url: 'git+https://example.invalid/repo.git' },
    engines: { node: '>=22' },
    exports: { '.': './index.js' },
    files: ['index.js'],
    scripts: { prepack: `node ${JSON.stringify(tool)} strip`, postpack: `node ${JSON.stringify(tool)} restore`, pretest: 'exit 1' },
    devDependencies: { typescript: '6.0.0' },
  };
  const { dir, text } = fixturePackage(manifest);
  try {
    writeFileSync(join(dir, 'index.js'), 'export default 1;\n');
    const packed = pnpm(['pack', '--pack-destination', dir], dir);
    assert.equal(packed.status, 0, packed.stderr || packed.stdout);
    assert.equal(readFileSync(join(dir, 'package.json'), 'utf8'), text, 'postpack restores the exact bytes');
    const tarball = readdirSync(dir).find((file) => file.endsWith('.tgz'));
    const inside = spawnSync('tar', ['-xOzf', join(dir, tarball), 'package/package.json'], { encoding: 'utf8' });
    assert.deepEqual(packedManifestFindings(JSON.parse(inside.stdout), manifest), []);
    const listing = spawnSync('tar', ['-tzf', join(dir, tarball)], { encoding: 'utf8' }).stdout;
    assert.doesNotMatch(listing, /node_modules/u);

    const dry = pnpm(['pack', '--dry-run'], dir);
    assert.equal(dry.status, 0, dry.stderr || dry.stdout);
    const deadline = Date.now() + 10_000;
    while (readFileSync(join(dir, 'package.json'), 'utf8') !== text && Date.now() < deadline) {
      await new Promise((settle) => setTimeout(settle, 100));
    }
    assert.equal(readFileSync(join(dir, 'package.json'), 'utf8'), text, 'the guard restores after a dry run skips postpack');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
