#!/usr/bin/env node
/** A disposable, pinned external-parser experiment. This is not a runtime importer. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { mkdtemp, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { pathToFileURL } from 'node:url';
import { gzipSync } from 'node:zlib';
import { initialCatalog } from '../dist/catalog.js';
import { tableToView, viewToTable, chartToView, viewToChart } from '../dist/converters.js';
import { validateView } from '../dist/runtime.js';

const run = promisify(execFile);
const manifestUrl = new URL('./fixtures/openui-experiment.json', import.meta.url);
const manifest = JSON.parse(await readFile(manifestUrl, 'utf8'));
const arguments_ = process.argv.slice(2);
assert.ok(arguments_.every(argument => argument === '--write'), 'Only --write is supported.');
const scratch = await mkdtemp(path.join(tmpdir(), 'lyra-gen-openui-experiment-'));
const modules = path.join(scratch, 'node_modules');
const metadata = [];
const originalFetch = globalThis.fetch;
let fetchAttempts = 0;
const savedEnvironment = new Map(['OPENUI_TELEMETRY_DISABLED', 'DO_NOT_TRACK'].map(key => [key, process.env[key]]));

async function download(url, maximumBytes) {
  const response = await originalFetch(url, { signal: AbortSignal.timeout(30000) });
  assert.ok(response.ok, `Download failed: ${response.status}`);
  const reader = response.body.getReader();
  const chunks = [];
  let bytes = 0;
  for (;;) {
    const chunk = await reader.read();
    if (chunk.done) break;
    bytes += chunk.value.byteLength;
    if (bytes > maximumBytes) { await reader.cancel(); throw new Error('Download exceeds its byte ceiling.'); }
    chunks.push(chunk.value);
  }
  return Buffer.concat(chunks);
}

async function fileBytes(directory) {
  let bytes = 0;
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) bytes += await fileBytes(target);
    else { assert.ok(entry.isFile(), 'Extracted packages must contain regular files only.'); bytes += (await stat(target)).size; }
  }
  return bytes;
}

async function extractPinned(pin) {
  const response = await download(`https://registry.npmjs.org/${encodeURIComponent(pin.name)}/${pin.version}`, 2 * 1024 * 1024);
  const descriptor = JSON.parse(response.toString('utf8'));
  assert.equal(descriptor.version, pin.version);
  assert.equal(descriptor.dist.integrity, pin.integrity, 'Published package integrity changed.');
  assert.equal(descriptor.license, 'MIT', 'License changes require a new review.');
  const archive = await download(descriptor.dist.tarball, 4 * 1024 * 1024);
  assert.equal(`sha512-${createHash('sha512').update(archive).digest('base64')}`, pin.integrity);
  const archivePath = path.join(scratch, `${pin.name.replaceAll('/', '-')}.tgz`);
  await writeFile(archivePath, archive);
  const listing = (await run('tar', ['-tzf', archivePath], { maxBuffer: 4 * 1024 * 1024 })).stdout.trim().split('\n');
  assert.ok(listing.every(name => name.startsWith('package/') && !name.split('/').includes('..')), 'Unsafe archive member.');
  const verbose = (await run('tar', ['-tvzf', archivePath], { maxBuffer: 4 * 1024 * 1024 })).stdout.trim().split('\n');
  assert.ok(verbose.every(line => line.startsWith('-') || line.startsWith('d')), 'Package links require separate review.');
  const destination = path.join(modules, pin.name);
  await mkdir(destination, { recursive: true });
  await run('tar', ['-xzf', archivePath, '--strip-components=1', '--no-same-owner', '-C', destination]);
  const installed = JSON.parse(await readFile(path.join(destination, 'package.json'), 'utf8'));
  assert.equal(installed.name, pin.name);
  assert.equal(installed.version, pin.version);
  return {
    name: pin.name, version: pin.version, integrity: pin.integrity, license: installed.license,
    repository: installed.repository, gitHead: descriptor.gitHead ?? null,
    tarballBytes: archive.byteLength, extractedRegularFileBytes: await fileBytes(destination),
    dependencies: installed.dependencies ?? {}, peerDependencies: installed.peerDependencies ?? {},
    peerDependenciesMeta: installed.peerDependenciesMeta ?? {}, lifecycleScripts: Object.fromEntries(Object.entries(installed.scripts ?? {}).filter(([key]) => /^(?:preinstall|install|postinstall|prepare)$/.test(key))),
  };
}

function convertLiteralTree(root) {
  const losses = [];
  const supplementalArtifacts = [];
  const convert = node => {
    if (!node || node.type !== 'element' || node.partial || node.hasDynamicProps) throw new Error('Dynamic, partial or non-element AST nodes are outside this experiment.');
    const props = node.props;
    const id = node.statementId;
    assert.equal(typeof id, 'string', 'Literal nodes need stable source statement identities.');
    if (node.typeName === 'Stack') {
      assert.ok(Array.isArray(props.children));
      return { id, type: 'stack', children: props.children.map(convert) };
    }
    if (node.typeName === 'CardHeader' || node.typeName === 'TextContent') {
      assert.equal(typeof props.text, 'string');
      return { id, type: node.typeName === 'CardHeader' ? 'heading' : 'text', text: props.text };
    }
    if (node.typeName === 'Metric') {
      assert.equal(typeof props.label, 'string');
      assert.ok(typeof props.value === 'number' && Number.isFinite(props.value));
      losses.push('A numeric Metric source value becomes the stat component display string; numeric source type/provenance is not preserved by this view alone.');
      return { id, type: 'stat', props: { label: props.label, value: String(props.value) } };
    }
    if (node.typeName === 'Table') {
      const converted = tableToView(props, { nodeId: id, surfaceId: 'openui-experiment' });
      assert.ok(converted.ok, JSON.stringify(converted.diagnostics));
      const restored = viewToTable(converted.value);
      assert.ok(restored.ok, JSON.stringify(restored.diagnostics));
      assert.deepEqual(restored.value, props, 'Table conversion must preserve source column types, names, values and nulls.');
      supplementalArtifacts.push({ nodeId: id, kind: 'table-column-metadata', columns: converted.value.columns });
      return converted.value.view.root;
    }
    if (node.typeName === 'Chart') {
      const converted = chartToView(props, { nodeId: id, surfaceId: 'openui-experiment' });
      assert.ok(converted.ok, JSON.stringify(converted.diagnostics));
      const restored = viewToChart(converted.value);
      assert.ok(restored.ok, JSON.stringify(restored.diagnostics));
      assert.deepEqual(restored.value, props, 'Chart conversion must preserve numeric values and null gaps.');
      return converted.value.root;
    }
    if (node.typeName === 'Input') throw new Error('Fields require an explicit host field/purpose policy; no field is imported by this experiment.');
    throw new Error('No reviewed literal mapping exists for this component or action.');
  };
  const converted = convert(root);
  const checked = validateView({ version: '1', catalog: { id: initialCatalog.id, version: initialCatalog.version }, surfaceId: 'openui-experiment', revision: 0, root: converted }, initialCatalog);
  assert.ok(checked.ok, JSON.stringify(checked.diagnostics));
  return { status: losses.length ? 'lossy' : 'supported', losses, view: checked.value, supplementalArtifacts };
}

try {
  // Manual extraction invokes no package lifecycle scripts, including the telemetry postinstall.
  for (const pin of manifest.packages) metadata.push(await extractPinned(pin));
  const core = path.join(modules, '@openuidev/lang-core');
  const indexSource = await readFile(path.join(core, 'dist/index.mjs'), 'utf8');
  const sharedFile = (await readdir(path.join(core, 'dist'))).find(name => /^shared-.*\.mjs$/.test(name));
  assert.ok(sharedFile);
  const sharedSource = await readFile(path.join(core, 'dist', sharedFile), 'utf8');
  const installationSource = await readFile(path.join(core, 'dist/postinstall.mjs'), 'utf8');
  assert.ok(installationSource.includes('pseudonymous installation telemetry'));
  assert.ok(sharedSource.includes('OPENUI_RUNTIME_TELEMETRY_ENABLED') && sharedSource.includes('OPENUI_TELEMETRY_DISABLED'));
  assert.ok(indexSource.includes('from "zod/v4"') && indexSource.includes('import("ci-info")'));

  process.env.OPENUI_TELEMETRY_DISABLED = '1';
  process.env.DO_NOT_TRACK = '1';
  globalThis.fetch = async () => { fetchAttempts++; throw new Error('External-parser experiment blocks runtime fetch.'); };
  const { createParser, createStreamingParser } = await import(pathToFileURL(path.join(core, 'dist/index.mjs')).href);
  const results = [];
  for (const fixture of manifest.fixtures) {
    const schema = { $defs: manifest.schemas };
    const parsed = createParser(schema, fixture.root).parse(fixture.source);
    const stream = createStreamingParser(schema, fixture.root);
    stream.set(fixture.source.slice(0, Math.floor(fixture.source.length / 2)));
    const completed = stream.set(fixture.source, true);
    const streamingRootMatchesBatch = JSON.stringify(completed.root) === JSON.stringify(parsed.root);
    assert.ok(streamingRootMatchesBatch, `${fixture.id}: sampled streaming split differs from batch root.`);
    let converted;
    if (!parsed.root || parsed.meta.incomplete || parsed.meta.unresolved.length || parsed.meta.orphaned.length || parsed.meta.errors.length) converted = { status: 'rejected', reason: 'Parser output is missing, incomplete, unresolved, orphaned, or reports errors.' };
    else try { converted = convertLiteralTree(parsed.root); } catch (error) { converted = { status: 'rejected', reason: error.message }; }
    assert.equal(converted.status, fixture.expected, `${fixture.id}: classification changed; review the experiment.`);
    results.push({ id: fixture.id, provenance: fixture.provenance, status: converted.status, reason: converted.reason ?? null, losses: converted.losses ?? [], streamingRootMatchesBatch, sourceBytes: Buffer.byteLength(fixture.source), parserRoot: parsed.root, parserMeta: parsed.meta, candidateView: converted.view ?? null, candidateSupplementalArtifacts: converted.supplementalArtifacts ?? [] });
  }
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(fetchAttempts, 0, 'Unexpected fetch attempt under explicit telemetry opt-out.');

  const require = createRequire(import.meta.url);
  const esbuildPath = createRequire(require.resolve('@web/dev-server-esbuild')).resolve('esbuild');
  const esbuild = await import(pathToFileURL(esbuildPath).href);
  const entry = path.join(scratch, 'parser-entry.mjs');
  await writeFile(entry, 'export { createParser, createStreamingParser } from "@openuidev/lang-core";\n');
  const bundle = await esbuild.build({ entryPoints: [entry], bundle: true, write: false, minify: true, treeShaking: true, format: 'esm', platform: 'browser', target: 'es2022', legalComments: 'none', metafile: true, logLevel: 'silent' });
  assert.equal(bundle.outputFiles.length, 1);
  const output = bundle.outputFiles[0].contents;
  const contributions = {};
  for (const outputMetadata of Object.values(bundle.metafile.outputs)) for (const [input, detail] of Object.entries(outputMetadata.inputs)) {
    const absolute = path.resolve(input);
    const relative = path.relative(modules, absolute).replaceAll(path.sep, '/');
    let owner = 'entry';
    if (!relative.startsWith('..')) owner = relative.startsWith('@') ? relative.split('/').slice(0, 2).join('/') : relative.split('/')[0];
    contributions[owner] = (contributions[owner] ?? 0) + detail.bytesInOutput;
  }
  const report = {
    experimentVersion: manifest.experimentVersion, observedDate: new Date().toISOString().slice(0, 10), node: process.version,
    upstream: { package: '@openuidev/lang-core', version: '1.0.1', officialRepository: 'https://github.com/thesysdev/openui', metadataUrl: 'https://registry.npmjs.org/@openuidev%2Flang-core/1.0.1' },
    installation: { mechanism: 'Integrity-checked tarball extraction; no package manager install or lifecycle execution.', scriptsExecuted: false, packages: metadata, totalTarballBytes: metadata.reduce((sum, item) => sum + item.tarballBytes, 0), totalExtractedRegularFileBytes: metadata.reduce((sum, item) => sum + item.extractedRegularFileBytes, 0) },
    telemetry: { sourceReview: 'Pinned package has opt-out installation telemetry and opt-in Node runtime parser/prompt telemetry. Public root imports zod/v4 and a shared telemetry module; ci-info is dynamically imported by telemetry.', disableFlags: ['OPENUI_TELEMETRY_DISABLED=1', 'DO_NOT_TRACK=1'], guardedImportAndParserFetchAttempts: fetchAttempts, scope: 'globalThis.fetch guarded during actual import, batch parse and sampled streaming parse; this is not an operating-system network sandbox.' },
    bundle: { boundary: 'Browser ESM bundle exporting public createParser and createStreamingParser only, with all dependency code bundled; no externals or telemetry rewrite.', tool: `esbuild@${esbuild.version}`, target: 'es2022', minifiedBytes: output.byteLength, gzipLevel9Bytes: gzipSync(output, { level: 9 }).byteLength, bytesInOutputByPackage: contributions, telemetryCaptureUrlRetained: Buffer.from(output).includes(Buffer.from('/capture/')) },
    fixtures: results,
    decision: { runtimeImporter: 'no-go', explanation: 'Literal host-schema mapping is feasible, but this experiment does not establish safe semantics for reactive expressions, actions, fields, query/mutation evaluation, source edits, arbitrary upstream libraries, or adversarial parser resource use. Keep the parser outside runtime dependencies until these boundaries have reviewed mappings and qualification.', supportedScope: 'Only the exercised static literal mappings under the checked experiment schema. Synthetic Table and Chart signatures are host-defined, not assertions about upstream built-in UI component parity.', streamingScope: 'One midpoint split per fixture matched its batch root; no exhaustive chunking, scheduling or memory bound is claimed.', paidModelCalls: 0 },
  };
  if (arguments_.includes('--write')) await writeFile(new URL('./fixtures/openui-experiment-report.json', import.meta.url), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({ decision: report.decision.runtimeImporter, packages: metadata.map(item => `${item.name}@${item.version}`), bundle: report.bundle, classifications: Object.fromEntries(['supported', 'lossy', 'rejected'].map(status => [status, results.filter(result => result.status === status).length])), fetchAttempts }, null, 2));
} finally {
  globalThis.fetch = originalFetch;
  for (const [key, value] of savedEnvironment) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  await rm(scratch, { recursive: true, force: true });
}
