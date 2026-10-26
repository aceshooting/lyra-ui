#!/usr/bin/env node
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const revision = '409ded29ccac3eebc541979ae5320771703248e8';
const packageRoot = fileURLToPath(new URL('../', import.meta.url));
const args = process.argv.slice(2);
function option(name) { const index = args.indexOf(name); return index >= 0 ? args[index + 1] : undefined; }
const checkout = option('--reference');
if (!checkout || args.includes('--help')) {
  process.stdout.write('Usage: node scripts/compare-a2ui-reference.mjs --reference <pinned-built-a2ui-checkout> [--output <report.json>] [--compiler-version <version>]\nThe checkout must be at the documented revision with typescript/core/web_core/dist built. No installation or network access is performed.\n');
  process.exit(checkout ? 0 : 2);
}
const referenceRoot = resolve(checkout);
const actualRevision = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: referenceRoot, encoding: 'utf8' }).trim();
assert.equal(actualRevision, revision, 'Reference checkout revision differs from the fixture pin.');
assert.equal(execFileSync('git', ['status', '--porcelain', '--', 'typescript/core/web_core/src'], { cwd: referenceRoot, encoding: 'utf8' }).trim(), '', 'Reference source tree must be clean.');
const referenceSource = 'typescript/core/web_core/src/state/data-model.ts';
const committedSource = execFileSync('git', ['show', `${revision}:${referenceSource}`], { cwd: referenceRoot });
assert.deepEqual(await readFile(resolve(referenceRoot, referenceSource)), committedSource, 'Reference state implementation has uncommitted changes.');
const sourceHash = createHash('sha256').update(committedSource).digest('hex');
const referenceModule = relative => import(pathToFileURL(resolve(referenceRoot, 'typescript/core/web_core/dist/src', relative)).href);
const [{ DataModel }, { MessageProcessor }, { NodeResolver }, { peekValue }, { basicCatalog }, { A2uiProcessor }] = await Promise.all([
  referenceModule('state/data-model.js'), referenceModule('processing/message-processor.js'), referenceModule('resolution/node-resolver.js'),
  referenceModule('reactivity/signals.js'), referenceModule('v0_9/basic_catalog/catalog.js'), import(new URL('../dist/adapters/a2ui.js', import.meta.url))
]);
const catalogId = 'https://a2ui.org/specification/v0_9/catalogs/basic/catalog.json';
const toNode = node => ({ id: node.id, type: node.component, props: node.props });
const literal = { schema: { type: 'string' } };
const layout = { properties: { align: literal, justify: literal }, required: ['children'], children: 'children', toNode };
const catalog = { id: catalogId, version: 'v0.9.1', viewCatalog: { id: 'reference-cohort', version: '1' }, components: {
  Text: { properties: { text: { schema: { type: 'string' }, dynamic: true }, variant: literal }, required: ['text'], toNode },
  Column: layout, Row: layout, List: layout,
  Card: { properties: {}, child: 'child', required: ['child'], toNode },
  Button: { properties: { variant: literal }, child: 'child', action: 'action', required: ['child', 'action'], toNode }
} };
const owner = { ownerId: 'reference-agent' };
function accepted(result) { assert.equal(result.ok, true, JSON.stringify(result.diagnostics)); return result.value; }
function inspect(data) {
  const undefinedPaths = []; const holePaths = [];
  const escape = value => value.replaceAll('~', '~0').replaceAll('/', '~1');
  const visit = (value, path) => {
    if (Array.isArray(value)) {
      for (let i = 0; i < value.length; i++) {
        if (!Object.hasOwn(value, i)) holePaths.push(`${path}/${i}`);
        else if (value[i] === undefined) undefinedPaths.push(`${path}/${i}`);
        else visit(value[i], `${path}/${i}`);
      }
    } else if (value && typeof value === 'object') for (const [key, child] of Object.entries(value)) visit(child, `${path}/${escape(key)}`);
  };
  visit(data, ''); return { json: JSON.parse(JSON.stringify(data)), undefinedPaths, holePaths };
}
const compiledStateSha256 = createHash('sha256').update(await readFile(resolve(referenceRoot, 'typescript/core/web_core/dist/src/state/data-model.js'))).digest('hex');
const implementationHashes = {};
for (const file of ['src/adapters/a2ui.ts', 'src/adapters/a2ui-state.ts', 'src/schema.ts', 'src/types.ts']) implementationHashes[file] = createHash('sha256').update(await readFile(resolve(packageRoot, file))).digest('hex');
let dependencyLock = {};
try { dependencyLock = JSON.parse(await readFile(resolve(referenceRoot, 'typescript/core/web_core/package-lock.json'), 'utf8')); } catch (error) { if (error.code !== 'ENOENT') throw error; }
const runtimeDependencies = Object.fromEntries(Object.entries(dependencyLock.packages ?? {}).filter(([name, value]) => name.startsWith('node_modules/') && !value.dev).map(([name, value]) => [name.slice('node_modules/'.length), { version: value.version, integrity: value.integrity }]));
const report = { revision, runtime: { node: process.version, platform: process.platform, architecture: process.arch }, compilerVersion: option('--compiler-version') ?? 'not-recorded', runtimeDependencies, implementationHashes, referenceStateSha256: sourceHash, compiledStateSha256, cohort: 'v0.9.1', coverage: 'Reference renderer state, resolved node model and action envelopes; excludes DOM, layout, accessibility and full basic-catalog coverage.', cases: [], examples: [] };
const fixtureRoot = resolve(packageRoot, 'test/fixtures/a2ui/v0.9.1');
const stateCases = JSON.parse(await readFile(resolve(fixtureRoot, 'state-cases.json'), 'utf8'));
for (const entry of stateCases.cases) {
  const local = new A2uiProcessor({ catalogs: [catalog] });
  accepted(local.process({ version: 'v0.9.1', createSurface: { surfaceId: 'state', catalogId } }, owner));
  accepted(local.process({ version: 'v0.9.1', updateDataModel: { surfaceId: 'state', value: entry.initial } }, owner));
  const reference = new DataModel(structuredClone(entry.initial));
  for (const update of entry.updates) {
    accepted(local.process({ version: 'v0.9.1', updateDataModel: { surfaceId: 'state', ...update } }, owner));
    reference.set(update.path, update.value);
  }
  const actual = inspect(local.getSurface('state').data); const referenceActual = inspect(reference.get('/'));
  assert.deepEqual(actual, { json: entry.expectedJson, undefinedPaths: entry.undefinedPaths, holePaths: entry.holePaths }, entry.name);
  if (entry.referenceDivergence) {
    const expected = entry.referenceDivergence;
    assert.deepEqual(referenceActual, { json: expected.expectedReferenceJson, undefinedPaths: expected.expectedReferenceUndefinedPaths, holePaths: expected.expectedReferenceHolePaths }, `${entry.name}: reference divergence changed`);
    report.cases.push({ name: entry.name, status: 'normative-pass-reference-divergence', reason: expected.reason });
  } else {
    assert.deepEqual(referenceActual, actual, entry.name);
    report.cases.push({ name: entry.name, status: 'match' });
  }
  reference.dispose();
}
function referenceNodes(node, output = []) {
  if (!node) return output;
  const props = peekValue(node.props); output.push({ node, props });
  if (props.child) referenceNodes(props.child, output);
  if (Array.isArray(props.children)) for (const child of props.children) referenceNodes(child, output);
  return output;
}
function localNodes(node, output = []) { if (node) { output.push(node); for (const child of node.children) localNodes(child, output); } return output; }
for (const name of ['00_simple-text.json', '00_interactive-button.json', '34_child-list-template.json']) {
  const fixture = JSON.parse(await readFile(resolve(fixtureRoot, name), 'utf8'));
  const local = new A2uiProcessor({ catalogs: [catalog] }); const actions = [];
  const reference = new MessageProcessor([basicCatalog], action => { actions.push(action); });
  for (const message of fixture.messages) { accepted(local.process(message, owner)); reference.processMessages(message); }
  const surfaceId = fixture.messages[0].createSurface.surfaceId;
  const surface = reference.getSurface(surfaceId); assert.ok(surface);
  const resolver = new NodeResolver(surface);
  const theirs = referenceNodes(peekValue(resolver.rootNode)); const ours = localNodes(accepted(local.resolveSurface(surfaceId)).root);
  const text = value => value == null ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value);
  assert.deepEqual(theirs.map(({ node }) => node.type), ours.map(node => node.component), `${name}: component traversal`);
  assert.deepEqual(theirs.filter(({ node }) => node.type === 'Text').map(({ props }) => text(props.text?.value ?? props.text)), ours.filter(node => node.component === 'Text').map(node => node.props.text), `${name}: resolved text`);
  assert.deepEqual(inspect(surface.dataModel.get('/')), inspect(local.getSurface(surfaceId).data), `${name}: data model`);
  for (const { node, props } of theirs.filter(({ node }) => node.type === 'Button')) {
    assert.equal(typeof props.action, 'function'); await props.action();
    const oursButton = ours.find(item => item.sourceComponentId === node.componentId);
    assert.ok(oursButton, 'An action source must map to the same source component ID.');
    const envelope = accepted(local.createAction(surfaceId, oursButton.id, { ...owner, expectedRevision: local.getSurface(surfaceId).revision }));
    const { timestamp: localTimestamp, ...localAction } = envelope.message.action;
    const { timestamp: referenceTimestamp, ...referenceAction } = actions.at(-1);
    assert.ok(Number.isFinite(Date.parse(localTimestamp))); assert.ok(Number.isFinite(Date.parse(referenceTimestamp)));
    assert.deepEqual(referenceAction, localAction, `${name}: action envelope`);
  }
  report.examples.push({ name, status: 'match', components: ours.length });
  resolver.dispose(); reference.dispose();
}
// Compare a local function action with a captured reference browser sink; no navigation occurs.
{
  const fixture = JSON.parse(await readFile(resolve(fixtureRoot, 'local-action.json'), 'utf8'));
  const localCatalog = { ...catalog, functions: { openUrl: { args: { url: literal }, required: ['url'], returnType: 'void', effect: 'host' } } };
  const local = new A2uiProcessor({ catalogs: [localCatalog] });
  const reference = new MessageProcessor([basicCatalog]);
  for (const message of fixture.messages) { accepted(local.process(message, owner)); reference.processMessages(message); }
  const surfaceId = 'local-action'; const resolver = new NodeResolver(reference.getSurface(surfaceId));
  const referenceCalls = []; const localCalls = [];
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  try {
    Object.defineProperty(globalThis, 'window', { configurable: true, value: { open: (...args) => { referenceCalls.push(args); } } });
    await peekValue(peekValue(resolver.rootNode).props).action();
    const node = accepted(local.resolveSurface(surfaceId)).root;
    const context = { ...owner, expectedRevision: local.getSurface(surfaceId).revision };
    assert.equal((await local.executeLocalAction(surfaceId, node.id, context, { authorize: () => false, execute: request => { localCalls.push(request); } })).ok, false);
    assert.equal(localCalls.length, 0);
    accepted(await local.executeLocalAction(surfaceId, node.id, context, { authorize: request => request.name === 'openUrl' && request.args.url === 'https://example.com/approved', execute: request => { localCalls.push(request); } }));
    assert.deepEqual(referenceCalls, [['https://example.com/approved', '_blank', 'noopener,noreferrer']]);
    assert.equal(localCalls.length, 1); assert.equal(localCalls[0].name, 'openUrl'); assert.equal(localCalls[0].args.url, referenceCalls[0][0]);
    report.examples.push({ name: 'local-action.json', status: 'match', hostAuthorization: 'explicit', browserSink: 'captured; no navigation' });
  } finally {
    if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow); else delete globalThis.window;
    resolver.dispose(); reference.dispose();
  }
}
if (option('--output')) await writeFile(resolve(option('--output')), `${JSON.stringify(report, null, 2)}\n`);
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
