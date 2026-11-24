import assert from 'node:assert/strict';
import test from 'node:test';
import { createCatalog, initialCatalog } from '../catalog.js';
import type { JsonObject, LyraGenCatalog, LyraGenNode } from '../types.js';
import { A2uiProcessor, createA2uiCatalog } from './a2ui.js';
import { A2UI_CANDIDATE_PROFILE } from './a2ui-candidate.js';
import { A2UI_V1_PROFILE, A2uiV1Processor, createA2uiV1Catalog, exportA2uiV1Catalog } from './a2ui-v1.js';
import type { A2uiV1ProcessResult } from './a2ui-v1.js';
import {
  dataCatalogId, dataRoles, fixtureAllowedParents, fixtureRoles, layoutCatalogId, layoutRoles, salesComponentUpdate,
  salesCreate, salesDataUpdate, salesSurface, unregisteredCatalogId, v1ErrorCases,
} from '../../test/fixtures/a2ui/v1.0-candidate/processor-cases.js';

const owner = { ownerId: 'sales-agent' };
const viewCatalog: LyraGenCatalog = createCatalog({
  id: 'lyra-v1-fixture', version: '1',
  components: Object.fromEntries(fixtureRoles.map(role => [role, initialCatalog.components[role]!])),
  actions: { 'review-figures': { payload: { type: 'object', properties: { total: { type: 'string' }, scope: { type: 'string' } }, required: ['total', 'scope'], additionalProperties: false } } },
});
const layout = createA2uiV1Catalog(viewCatalog, { catalogId: layoutCatalogId, roles: layoutRoles, allowedParents: fixtureAllowedParents });
const data = createA2uiV1Catalog(viewCatalog, { catalogId: dataCatalogId, roles: dataRoles, allowedParents: fixtureAllowedParents });
const processor = (): A2uiV1Processor => new A2uiV1Processor({ viewCatalog, catalogs: [layout, data] });

function accepted(result: A2uiV1ProcessResult): void {
  assert.equal(result.ok, true, result.ok ? '' : JSON.stringify(result.error));
}
function flatten(node: LyraGenNode): LyraGenNode[] { return [node, ...(node.children ?? []).flatMap(flatten)]; }

test('a v1.0 createSurface with an initial tree and mixed catalogs produces a validated view', () => {
  const p = processor();
  accepted(p.process(salesCreate, owner));
  const result = p.toView(salesSurface);
  assert.equal(result.ok, true, JSON.stringify(result.diagnostics));
  if (!result.ok) return;
  assert.deepEqual(result.value.catalog, { id: viewCatalog.id, version: viewCatalog.version });
  const nodes = flatten(result.value.root);
  assert.deepEqual(nodes.map(node => node.type), ['stack', 'heading', 'text', 'stat', 'table']);
  assert.equal(nodes[1]!.text, 'Quarterly sales');
  assert.deepEqual(nodes[3]!.props, { label: 'Total revenue', value: '1,204' });
  // The @accessibility label lands on the role's declared accessible-name property.
  assert.equal(nodes[4]!.props?.['caption'], 'Revenue by region');
  assert.deepEqual(nodes[4]!.props?.['rows'], [{ c0: 'North', c1: 700 }, { c0: 'South', c1: 504 }]);
});

test('component and data updates keep stable node identities and revisions advance', () => {
  const p = processor();
  accepted(p.process(salesCreate, owner));
  const first = p.toView(salesSurface);
  assert.ok(first.ok);
  const before = new Map(flatten(first.value.root).map(node => [node.type + (node.text ?? ''), node.id]));
  accepted(p.process(salesDataUpdate, owner));
  accepted(p.process(salesComponentUpdate, owner));
  const second = p.toView(salesSurface);
  assert.equal(second.ok, true, JSON.stringify(second.diagnostics));
  if (!second.ok) return;
  assert.ok(second.value.revision > first.value.revision);
  const nodes = flatten(second.value.root);
  assert.deepEqual(nodes.map(node => node.type), ['stack', 'heading', 'text', 'alert', 'text', 'button', 'stat', 'table']);
  assert.equal(nodes[0]!.id, first.value.root.id);
  assert.equal(nodes[1]!.id, before.get('headingQuarterly sales'));
  assert.equal(nodes[6]!.id, flatten(first.value.root)[3]!.id);
  assert.equal(nodes[2]!.text, 'Revenue by region, revised.');
  assert.equal(nodes[2]!.id, flatten(first.value.root)[2]!.id);
  assert.equal(nodes[6]!.props?.['value'], '1,377');
  assert.deepEqual(nodes[5]!.action, { name: 'review-figures', payload: { total: '1,377', scope: 'quarter' } });
});

test('explicit null deletes a data key and the root accepts whole-model replacement', () => {
  const p = processor();
  accepted(p.process(salesCreate, owner));
  accepted(p.process({ version: '1.0', updateDataModel: { surfaceId: salesSurface, path: '/title', value: null } }, owner));
  assert.equal(Object.hasOwn(p.getSurface(salesSurface)!.data, 'title'), false);
  accepted(p.process({ version: '1.0', updateDataModel: { surfaceId: salesSurface, value: { total: '9' } } }, owner));
  assert.deepEqual(p.getSurface(salesSurface)!.data, { total: '9' });
  accepted(p.process({ version: '1.0', updateDataModel: { surfaceId: salesSurface, path: '/', value: null } }, owner));
  assert.deepEqual(p.getSurface(salesSurface)!.data, {});
});

test('every out-of-profile input yields a coded A2UI error message and leaves state unchanged', () => {
  for (const entry of v1ErrorCases) {
    const p = processor();
    for (const message of entry.prior) accepted(p.process(message, owner));
    const snapshot = JSON.stringify(p.surfaceIds.map(id => p.getSurface(id)));
    const result = p.process(entry.message, owner);
    assert.equal(result.ok, false, entry.name);
    if (result.ok) continue;
    assert.equal(result.error.version, '1.0', entry.name);
    assert.equal(result.error.error.code, entry.code, `${entry.name}: ${JSON.stringify(result.error)}`);
    if (entry.path !== undefined) assert.equal(result.error.error.path, entry.path, entry.name);
    assert.equal(result.error.error.surfaceId, entry.surfaceId, entry.name);
    assert.equal(result.error.error.functionCallId, entry.functionCallId, entry.name);
    assert.ok(!(result.error.error.surfaceId !== undefined && result.error.error.functionCallId !== undefined), entry.name);
    if (['VALIDATION_FAILED', 'UNALLOWED_PARENT', 'UNALLOWED_CHILD'].includes(entry.code) && entry.surfaceId) assert.equal(typeof result.error.error.path, 'string', entry.name);
    assert.ok(result.error.error.message.length > 0, entry.name);
    assert.equal(result.diagnostics[0]?.code, entry.code, entry.name);
    assert.equal(JSON.stringify(p.surfaceIds.map(id => p.getSurface(id))), snapshot, entry.name);
  }
});

test('ownership and expected revisions are host guards reported as integrity errors', () => {
  const p = processor();
  accepted(p.process(salesCreate, owner));
  const other = p.process(salesDataUpdate, { ownerId: 'other-agent' });
  assert.equal(other.ok, false);
  if (!other.ok) assert.equal(other.error.error.code, 'INTEGRITY_ERROR');
  const stale = p.process(salesDataUpdate, { ...owner, expectedRevision: 99 });
  assert.equal(stale.ok, false);
  const current = p.getSurface(salesSurface)!.revision;
  accepted(p.process(salesDataUpdate, { ...owner, expectedRevision: current }));
});

test('forward references are buffered until root arrives, then views validate', () => {
  const p = processor();
  accepted(p.process({ version: '1.0', createSurface: { surfaceId: 'late', catalogId: layoutCatalogId } }, owner));
  accepted(p.process({ version: '1.0', updateComponents: { surfaceId: 'late', components: [{ id: 'note', component: 'text', text: 'Later' }] } }, owner));
  const pending = p.toView('late');
  assert.equal(pending.ok, false);
  assert.equal(pending.diagnostics[0]?.code, 'a2ui-v1-pending-root');
  accepted(p.process({ version: '1.0', updateComponents: { surfaceId: 'late', components: [{ id: 'root', component: 'stack', children: ['note', 'missing'] }] } }, owner));
  const view = p.toView('late');
  assert.equal(view.ok, true);
  assert.ok(view.diagnostics.some(diagnostic => diagnostic.code === 'a2ui-v1-pending-component'));
});

test('view admission failures return a VALIDATION_FAILED message naming the source component', () => {
  const p = processor();
  accepted(p.process({ version: '1.0', createSurface: { surfaceId: 'partial', catalogId: layoutCatalogId, components: [
    { id: 'root', component: 'stack', children: ['metric'] },
    { id: 'metric', component: 'stat', '@catalogId': dataCatalogId, label: 'Total', value: { '@path': '/missing' } },
  ] } }, owner));
  const view = p.toView('partial');
  assert.equal(view.ok, false);
  assert.equal(view.error?.error.code, 'VALIDATION_FAILED');
  assert.equal(view.error?.error.surfaceId, 'partial');
  assert.match(view.error?.error.path ?? '', /^\/components\/metric/);
});

test('templates expand per data item with scoped relative bindings and index identities', () => {
  const p = processor();
  accepted(p.process({ version: '1.0', createSurface: { surfaceId: 'list', catalogId: layoutCatalogId, dataModel: { items: [{ name: 'A' }, { name: 'B' }] }, components: [
    { id: 'root', component: 'stack', children: { componentId: 'item', path: '/items' } },
    { id: 'item', component: 'text', text: { '@path': 'name' } },
  ] } }, owner));
  const first = p.toView('list');
  assert.ok(first.ok);
  assert.deepEqual(first.value.root.children?.map(node => node.text), ['A', 'B']);
  accepted(p.process({ version: '1.0', updateDataModel: { surfaceId: 'list', path: '/items/2', value: { name: 'C' } } }, owner));
  const second = p.toView('list');
  assert.ok(second.ok);
  assert.deepEqual(second.value.root.children?.map(node => node.text), ['A', 'B', 'C']);
  assert.deepEqual(second.value.root.children?.slice(0, 2).map(node => node.id), first.value.root.children?.map(node => node.id));
});

test('catalog registration is restricted, separate from stable metadata and exportable', () => {
  assert.throws(() => new A2uiV1Processor({ viewCatalog, catalogs: [layout, layout] }), /unique/i);
  assert.throws(() => new A2uiV1Processor({ viewCatalog: initialCatalog, catalogs: [layout] }), /view catalog/i);
  assert.throws(() => createA2uiV1Catalog(viewCatalog, { roles: ['missing'] }), /unknown role/i);
  assert.throws(() => createA2uiV1Catalog(viewCatalog, { allowedParents: { stack: ['nowhere'] } }), /unknown/i);
  const p = processor();
  assert.deepEqual(p.registeredCatalogIds, [dataCatalogId, layoutCatalogId]);
  assert.equal(p.registeredCatalogIds.includes(unregisteredCatalogId), false);
  // Stable processor and candidate schema metadata are unaffected.
  const stable = new A2uiProcessor({ catalogs: [createA2uiCatalog(viewCatalog)] });
  assert.deepEqual(stable.supportedCatalogIds, []);
  assert.equal(stable.process(salesCreate, owner).ok, false);
  assert.equal(A2UI_CANDIDATE_PROFILE.processorSupported, false);
  assert.equal(A2UI_V1_PROFILE.version, '1.0');
  assert.deepEqual(A2UI_V1_PROFILE.supportedCatalogIds, []);
  const exported = exportA2uiV1Catalog(layout);
  assert.equal(exported['catalogId'], layoutCatalogId);
  assert.equal(exported['protocolVersion'], '1.0');
  const components = exported['components'] as Record<string, JsonObject>;
  assert.deepEqual(Object.keys(components), ['stack', 'text', 'heading', 'alert', 'button']);
  assert.deepEqual(components['stack']!['allowedParents'], ['Surface']);
  assert.deepEqual(components['heading']!['allowedParents'], ['stack']);
  assert.deepEqual(components['alert']!['allowedChildren'], ['text', 'button']);
  assert.deepEqual(components['text']!['allowedChildren'], []);
  assert.equal(Object.hasOwn(components['stack']!, 'allowedChildren'), false);
});

test('deleting a surface clears state but keeps its lifetime-unique identity reserved', () => {
  const p = processor();
  accepted(p.process(salesCreate, owner));
  const deleted = p.process({ version: '1.0', deleteSurface: { surfaceId: salesSurface } }, owner);
  assert.equal(deleted.ok, true);
  assert.equal(p.getSurface(salesSurface), undefined);
  assert.equal(p.toView(salesSurface).ok, false);
  const again = p.process(salesCreate, owner);
  assert.equal(again.ok, false);
  if (!again.ok) assert.equal(again.error.error.code, 'INTEGRITY_ERROR');
});
