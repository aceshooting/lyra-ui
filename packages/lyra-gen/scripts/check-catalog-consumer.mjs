#!/usr/bin/env node
/** Qualify exported catalog documents against the source-pinned upstream JSON catalog consumer. */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build, version as compilerVersion } from 'esbuild';
import { catalogExportCohort, referenceRevision } from './catalog-export-cohort.mjs';

const args = process.argv.slice(2);
const option = name => { const index = args.indexOf(name); return index < 0 ? undefined : args[index + 1]; };
const reference = option('--reference');
const dependencies = option('--dependencies');
if (!reference || !dependencies || args.includes('--help')) {
  process.stdout.write('Usage: node scripts/check-catalog-consumer.mjs --reference <clean-pinned-checkout> --dependencies <pinned-dependency-directory> [--output <report.json>]\nNo installation, network access, or reference checkout writes are performed.\n');
  process.exit(args.includes('--help') ? 0 : 2);
}
const referenceRoot = resolve(reference);
const dependencyRoot = resolve(dependencies);
const packageRoot = fileURLToPath(new URL('../', import.meta.url));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
assert.equal(execFileSync('git', ['rev-parse', 'HEAD'], { cwd: referenceRoot, encoding: 'utf8' }).trim(), referenceRevision);
assert.equal(execFileSync('git', ['status', '--porcelain', '--', 'typescript/core/web_core/src'], { cwd: referenceRoot, encoding: 'utf8' }).trim(), '', 'Pinned reference source must be clean.');
const pins = JSON.parse(await readFile(new URL('../test/fixtures/a2ui/v0.9.1/reference-results.json', import.meta.url), 'utf8')).runtimeDependencies;
const lock = JSON.parse(await readFile(join(dependencyRoot, 'package-lock.json'), 'utf8'));
const installed = Object.fromEntries(Object.entries(lock.packages).filter(([name]) => name.startsWith('node_modules/'))
  .map(([name, value]) => [name.slice('node_modules/'.length), { version: value.version, integrity: value.integrity }]));
assert.deepEqual(installed, pins, 'Reference dependency versions and integrity must match the recorded cohort.');
for (const [name, pin] of Object.entries(pins)) {
  const manifest = JSON.parse(await readFile(join(dependencyRoot, 'node_modules', name, 'package.json'), 'utf8'));
  assert.equal(manifest.version, pin.version, `${name}: installed dependency version`);
}
const scratch = await mkdtemp(join(tmpdir(), 'lyra-catalog-proof-'));
try {
  const module = join(scratch, 'catalog.mjs');
  const built = await build({
    absWorkingDir: referenceRoot, entryPoints: ['typescript/core/web_core/src/catalog/types.ts'],
    bundle: true, platform: 'node', format: 'esm', target: 'node22', outfile: module,
    nodePaths: [join(dependencyRoot, 'node_modules')], metafile: true,
  });
  const sourceHashes = {};
  for (const input of Object.keys(built.metafile.inputs)) {
    const file = resolve(referenceRoot, input);
    const sourcePath = relative(referenceRoot, file);
    if (!sourcePath.startsWith('../')) {
      const bytes = await readFile(file);
      const committed = execFileSync('git', ['show', `${referenceRevision}:${sourcePath}`], { cwd: referenceRoot });
      assert.deepEqual(bytes, committed, `${sourcePath}: bundled source differs from the pin`);
      sourceHashes[sourcePath] = hash(bytes);
    } else {
      assert.ok(relative(dependencyRoot, file).startsWith('node_modules/'), 'All non-reference bundle inputs must come from the pinned dependency directory.');
    }
  }
  const { Catalog } = await import(pathToFileURL(module).href);
  const { stable, candidate, cases } = await catalogExportCohort();
  const profiles = [];
  for (const [version, artifact] of [['v0.9.1', stable], ['v1.0-candidate', candidate]]) {
    const consumer = Catalog.fromJson(artifact);
    assert.equal(consumer.id, artifact.catalogId);
    assert.deepEqual([...consumer.components.keys()], Object.keys(artifact.components));
    assert.deepEqual(consumer.toJson(), JSON.parse(JSON.stringify(artifact)), `${version}: catalog round trip`);
    const cohort = cases.filter(entry => entry.version === version);
    for (const entry of cohort) {
      // fromJson's component schema owns props; its serializer owns id/component envelopes.
      const props = { ...entry.value }; delete props.id; delete props.component;
      const checked = consumer.components.get(entry.role).schema.safeParse(props);
      assert.equal(checked.success, entry.accepted, `${version}/${entry.role}/${entry.name}: consumer differs from schema profile`);
    }
    profiles.push({ version, catalogId: artifact.catalogId, artifactSha256: hash(JSON.stringify(artifact)),
      components: consumer.components.size, cases: cohort.map(({ role, name, accepted }) => ({ role, name, accepted })),
      roundTrip: 'exact-json', coverage: 'JSON catalog ingestion and property schema validation; no message processor, DOM, action or rendering qualification.',
    });
  }
  const implementationHashes = {};
  for (const name of ['dist/catalog.js', 'dist/adapters/a2ui.js', 'dist/adapters/a2ui-candidate.js', 'scripts/catalog-export-cohort.mjs', 'scripts/check-catalog-consumer.mjs']) {
    implementationHashes[name] = hash(await readFile(join(packageRoot, name)));
  }
  const report = { revision: referenceRevision, node: process.version, compiler: { name: 'esbuild', version: compilerVersion },
    runtimeDependencies: pins, sourceHashes, consumerBundleSha256: hash(await readFile(module)), implementationHashes, profiles,
  };
  const output = `${JSON.stringify(report, null, 2)}\n`;
  if (option('--output')) await writeFile(resolve(option('--output')), output);
  else process.stdout.write(output);
} finally { await rm(scratch, { recursive: true, force: true }); }
