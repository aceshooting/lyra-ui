import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { createCatalog, initialCatalog } from '../../../packages/lyra-gen/dist/catalog.js';
import { validateView, createSnapshot, restoreSnapshot } from '../../../packages/lyra-gen/dist/runtime.js';
import { A2uiProcessor, createA2uiCatalog } from '../../../packages/lyra-gen/dist/adapters/a2ui.js';
import { reportMessages, createReportCatalog, reportIdentity } from '../profile-fixture/workloads/a2ui.js';
import { sdkPayloads } from '../profile-fixture/workloads/ai-sdk.js';
import { directReportDefinition, expectedMemoryProtocols, createMemoryProtocols } from './protocols.js';

test('matched direct report equals actual owned A2UI admission, including exact stable node identities', () => {
  const { catalog } = createReportCatalog({ createCatalog, initialCatalog, createA2uiCatalog }, new Map([[reportIdentity.sourceId, reportIdentity.sourceLabel]]));
  const processor = new A2uiProcessor({ catalogs: [catalog] });
  for (const message of reportMessages()) assert.equal(processor.process(message, { ownerId: reportIdentity.ownerId }).ok, true);
  const admitted = processor.toView(reportIdentity.surfaceId); assert.equal(admitted.ok, true);
  assert.deepEqual(directReportDefinition(), admitted.value);
  assert.equal(JSON.stringify(directReportDefinition()), JSON.stringify(admitted.value));
  assert.equal(createHash('sha256').update(JSON.stringify(directReportDefinition())).digest('hex'), 'f2672325fa55d288709de855f532fb5c46cec26e41c0186fabcb626d794ee403');
});

test('direct report is publicly admissible and snapshot-restorable with the same lifetime-qualified identities', () => {
  const { viewCatalog } = createReportCatalog({ createCatalog, initialCatalog, createA2uiCatalog }, new Map([[reportIdentity.sourceId, reportIdentity.sourceLabel]]));
  const document = directReportDefinition();
  assert.deepEqual([document.root.id, ...document.root.children.map(node => node.id)],
    ['a2ui:0:4', 'a2ui:0:0', 'a2ui:0:1', 'a2ui:0:2', 'a2ui:0:3']);
  const admitted = validateView(document, viewCatalog);
  assert.equal(admitted.ok, true, JSON.stringify(admitted.diagnostics));
  assert.deepEqual(admitted.value, document);
  const restored = restoreSnapshot(createSnapshot(admitted.value), viewCatalog);
  assert.equal(restored.ok, true); assert.deepEqual(restored.value.view, document);
  for (const child of [false, true]) {
    const invalid = structuredClone(document);
    const target = child ? invalid.root.children[0] : invalid.root;
    target.id = JSON.stringify(['', child ? ['root', 'chart'] : ['root']]);
    const rejected = validateView(invalid, viewCatalog);
    assert.equal(rejected.ok, false); assert.equal(rejected.diagnostics.some(item => item.code === 'identity.invalid'), true);
    assert.equal(restoreSnapshot(createSnapshot(invalid), viewCatalog).ok, false);
  }
});

test('both admission paths retain exactly three views,45nodes,1800table cells and900chart values', () => {
  const sdk = sdkPayloads(), documents = [directReportDefinition(), sdk.data, sdk.tool];
  let nodes = 0, tableCells = 0, chartValues = 0, nulls = 0;
  const visit = node => {
    nodes++;
    if (node.type === 'table') tableCells += node.props.rows.length * node.props.columns.length;
    if (node.type === 'chart') for (const series of node.props.datasets) { chartValues += series.data.length; nulls += series.data.filter(value => value === null).length; }
    node.children?.forEach(visit);
  };
  documents.forEach(document => visit(document.root));
  assert.deepEqual({ nodes, tableCells, chartValues, nulls }, { nodes: 45, tableCells: 1800, chartValues: 900, nulls: 80 });
  assert.equal(new Set(documents.map(document => document.surfaceId)).size, 3);
  const direct = expectedMemoryProtocols('mounted', { admission: 'direct' }), adapters = expectedMemoryProtocols('mounted', { admission: 'adapters' });
  assert.deepEqual({ ...adapters, owners: 0 }, direct); assert.equal(adapters.owners, 2);
  for (const admission of ['direct', 'adapters']) assert.equal(expectedMemoryProtocols('restored-disposed', { admission }).views, 0);
});

test('aborted runtime loading cannot create protocol owners or touch DOM', async () => {
  const controller = new AbortController(); let resolveLoad;
  const pending = createMemoryProtocols({ host: new Proxy({}, { get() { assert.fail('Aborted setup touched DOM.'); } }), signal: controller.signal,
    admission: 'adapters', load: () => new Promise(resolve => { resolveLoad = resolve; }) });
  controller.abort(); resolveLoad([]); await assert.rejects(pending, /aborted/u);
});
