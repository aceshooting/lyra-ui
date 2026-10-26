import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { A2uiProcessor, a2uiClientCapabilities, createA2uiCatalog, exportA2uiCatalog } from './a2ui.js';
import type { A2uiCatalog, A2uiComponentDefinition, A2uiResolvedNode } from './a2ui.js';
import { A2UI_CANDIDATE_PROFILE, exportA2uiCandidateCatalog } from './a2ui-candidate.js';
import type { JsonObject, LyraGenCatalog, LyraGenNode, LyraGenResult } from '../types.js';

const owner = { ownerId: 'agent-one' };
const basicId = 'https://a2ui.org/specification/v0_9/catalogs/basic/catalog.json';
const text = { schema: { type: 'string' as const }, dynamic: true };
const literal = { schema: { type: 'string' as const } };
const toNode = (node: A2uiResolvedNode, children: readonly LyraGenNode[]): LyraGenNode => ({ id: node.id, type: node.component, props: node.props, children, bindings: node.bindings, ...(node.action ? { action: node.action } : {}) });
const layout: A2uiComponentDefinition = { properties: { align: literal, justify: literal }, required: ['children'], children: 'children', toNode };
/** Deliberately test-only subset; registering it never establishes standard-catalog support. */
const fixtureCatalog: A2uiCatalog = {
  id: basicId, version: 'v0.9.1', viewCatalog: { id: 'fixture-view', version: '1' },
  components: {
    Text: { properties: { text, variant: literal }, required: ['text'], toNode },
    Column: layout, Row: layout, List: layout,
    Card: { properties: {}, child: 'child', required: ['child'], toNode },
    Button: { properties: { variant: literal }, child: 'child', action: 'action', checks: true, required: ['child', 'action'], toNode },
    TextField: { properties: { label: text, value: text }, required: ['label'], writable: ['value'], checks: true, toNode }
  },
  functions: {
    required: { args: { value: text }, required: ['value'], returnType: 'boolean', evaluate: args => args['value'] !== undefined && args['value'] !== '' },
    not: { args: { value: { schema: { type: 'boolean' }, dynamic: true } }, required: ['value'], returnType: 'boolean', evaluate: args => !args['value'] },
    and: { args: { values: { schema: { type: 'array', items: { type: 'boolean' }, minItems: 2 }, dynamic: true, itemsDynamic: true } }, required: ['values'], returnType: 'boolean', evaluate: args => (args['values'] as readonly boolean[]).every(Boolean) }
  }
};
function accepted<T>(result: LyraGenResult<T>): T { assert.equal(result.ok, true, JSON.stringify(result.diagnostics)); if (!result.ok) throw new Error('Expected success'); return result.value; }
function error<T>(result: LyraGenResult<T>, code: string): void { assert.equal(result.ok, false); assert.equal(result.diagnostics[0]?.code, code); }
function processor(): A2uiProcessor { return new A2uiProcessor({ catalogs: [fixtureCatalog] }); }
function create(p: A2uiProcessor, surfaceId = 'main', sendDataModel = false): void { accepted(p.process({ version: 'v0.9.1', createSurface: { surfaceId, catalogId: basicId, sendDataModel } }, owner)); }
function components(p: A2uiProcessor, entries: readonly unknown[], surfaceId = 'main'): void { accepted(p.process({ version: 'v0.9.1', updateComponents: { surfaceId, components: entries } }, owner)); }
function data(p: A2uiProcessor, value: unknown, path = '/', surfaceId = 'main'): void { accepted(p.process({ version: 'v0.9.1', updateDataModel: { surfaceId, path, value } }, owner)); }
function root(p: A2uiProcessor, surfaceId = 'main'): A2uiResolvedNode { const value = accepted(p.resolveSurface(surfaceId)).root; assert.ok(value); return value; }
function fixture(name: string): { messages: unknown[] } { return JSON.parse(readFileSync(resolve('test/fixtures/a2ui/v0.9.1', name), 'utf8')) as { messages: unknown[] }; }

for (const [name, surfaceId] of [['00_simple-text.json', 'gallery-simple-text'], ['00_interactive-button.json', 'gallery-interactive-button'], ['34_child-list-template.json', 'gallery-child-list-template']] as const) {
  test(`replays unmodified official v0_9_1-directory example ${name}`, () => {
    const p = processor(); const messages = fixture(name).messages;
    for (const message of messages) accepted(p.process(message, owner));
    const surface = p.getSurface(surfaceId)!;
    assert.equal(surface.version, 'v0.9');
    assert.equal(surface.revision, messages.length - 1);
    assert.equal(root(p, surfaceId).sourceComponentId, 'root');
    assert.deepEqual(a2uiClientCapabilities(p), { 'v0.9': { supportedCatalogIds: [] } });
    if (name === '00_simple-text.json') assert.equal(root(p, surfaceId).props['text'], 'Hello, Minimal Catalog!');
    if (name === '34_child-list-template.json') {
      const list = root(p, surfaceId).children[0]!.children[1]!;
      assert.deepEqual(list.children.map(row => row.children[0]!.props['text']), ['Apple', 'Banana', 'Cherry']);
      assert.deepEqual(list.children.map(row => row.children[2]!.props['text']), ['10', '5', '20']);
      assert.equal(new Set(list.children.map(row => row.id)).size, 3);
    }
    if (name === '00_interactive-button.json') {
      const button = root(p, surfaceId).children[1]!;
      const action = accepted(p.createAction(surfaceId, button.id, { ...owner, expectedRevision: surface.revision }, '2026-10-26T12:00:00.000Z'));
      assert.deepEqual(action.message, { version: 'v0.9', action: { name: 'button_clicked', surfaceId, sourceComponentId: 'action_button', timestamp: '2026-10-26T12:00:00.000Z', context: {} } });
    }
  });
}

test('requires creation, rejects duplicate creation and clears state on delete/recreate', () => {
  const p = processor(); error(p.process({ version: 'v0.9.1', deleteSurface: { surfaceId: 'main' } }, owner), 'a2ui-unknown-surface');
  create(p); data(p, { old: true });
  error(p.process({ version: 'v0.9.1', createSurface: { surfaceId: 'main', catalogId: basicId } }, owner), 'a2ui-duplicate-surface');
  accepted(p.process({ version: 'v0.9.1', deleteSurface: { surfaceId: 'main' } }, owner));
  assert.deepEqual(p.surfaceIds, []); create(p);
  assert.deepEqual(p.getSurface('main')?.data, {}); assert.equal(p.getSurface('main')?.revision, 3);
});

test('buffers forward references and preserves component definitions across incremental updates', () => {
  const p = processor(); create(p);
  components(p, [{ id: 'label', component: 'Text', text: 'Before' }]);
  assert.equal(accepted(p.resolveSurface('main')).root, undefined);
  components(p, [{ id: 'root', component: 'Column', children: ['label', 'later'] }]);
  assert.equal(root(p).children.length, 1);
  assert.equal(p.resolveSurface('main').diagnostics[0]?.code, 'a2ui-pending-component');
  const id = root(p).children[0]!.id;
  components(p, [{ id: 'label', component: 'Text', text: 'After' }, { id: 'later', component: 'Text', text: 'Arrived' }]);
  assert.equal(root(p).children[0]!.id, id); assert.equal(root(p).children.length, 2);
  assert.equal(root(p).children[0]!.props['text'], 'After');
});

test('component updates replace individual definitions, retain unrelated data and reject duplicates/cycles atomically', () => {
  const p = processor(); create(p); data(p, { keep: 2 });
  components(p, [{ id: 'root', component: 'Text', text: 'Before', variant: 'h1' }]);
  components(p, [{ id: 'root', component: 'Text', text: 'After' }]);
  assert.equal(root(p).props['variant'], undefined); assert.deepEqual(p.getSurface('main')?.data, { keep: 2 });
  const before = p.getSurface('main');
  for (const [entries, code] of [
    [[{ id: 'root', component: 'Text', text: 'One' }, { id: 'root', component: 'Text', text: 'Two' }], 'a2ui-duplicate-component'],
    [[{ id: 'root', component: 'Column', children: ['root'] }], 'a2ui-cycle'],
    [[{ id: 'root', component: 'Text', text: 'x', html: '<script>' }], 'a2ui-unsupported-member'],
    [[{ id: '__proto__', component: 'Text', text: 'x' }], 'a2ui-component-id']
  ] as const) {
    error(p.process({ version: 'v0.9.1', updateComponents: { surfaceId: 'main', components: entries } }, owner), code);
    assert.deepEqual(p.getSurface('main'), before);
  }
});

test('scopes nested templates, keeps absolute bindings absolute and writes only the selected instance', () => {
  const p = processor(); create(p);
  data(p, { title: 'Global', groups: [{ users: [{ name: 'Ada' }] }, { users: [{ name: 'Lin' }] }] });
  components(p, [
    { id: 'root', component: 'List', children: { componentId: 'group', path: '/groups' } },
    { id: 'group', component: 'List', children: { componentId: 'user', path: 'users' } },
    { id: 'user', component: 'TextField', label: { path: '/title' }, value: { path: 'name' } }
  ]);
  const user = root(p).children[1]!.children[0]!;
  assert.equal(user.scope, '/groups/1/users/0'); assert.equal(user.props['label'], 'Global');
  const before = p.getSurface('main')!.revision;
  accepted(p.writeBinding('main', user.id, 'value', 'Grace', { ...owner, expectedRevision: before }));
  assert.equal(root(p).children[1]!.children[0]!.props['value'], 'Grace');
  assert.equal(root(p).children[0]!.children[0]!.props['value'], 'Ada');
  error(p.writeBinding('main', user.id, 'value', 'stale', { ...owner, expectedRevision: before }), 'a2ui-revision');
  data(p, [], '/groups');
  error(p.writeBinding('main', user.id, 'value', 'gone', { ...owner, expectedRevision: p.getSurface('main')!.revision }), 'a2ui-instance');
});

test('uses RFC 6901 escaping and transactional upsert/replacement/delete semantics', () => {
  const p = processor(); create(p);
  data(p, 'ok', '/a~1b/~0key'); assert.deepEqual(p.getSurface('main')?.data, { 'a/b': { '~key': 'ok' } });
  data(p, { x: 1, y: 2 }, '/nested'); data(p, { z: 3 }, '/nested');
  assert.deepEqual((p.getSurface('main')!.data as JsonObject)['nested'], { z: 3 });
  accepted(p.process({ version: 'v0.9.1', updateDataModel: { surfaceId: 'main', path: '/nested/z' } }, owner));
  assert.deepEqual((p.getSurface('main')!.data as JsonObject)['nested'], {});
  data(p, ['one', 'two'], '/items'); const before = p.getSurface('main');
  for (const path of ['/items/nope', '/items/01', '/items/999999999', '/bad~2path', '/__proto__/x']) {
    assert.equal(p.process({ version: 'v0.9.1', updateDataModel: { surfaceId: 'main', path, value: 'bad' } }, owner).ok, false);
    assert.deepEqual(p.getSurface('main'), before);
  }
  accepted(p.process({ version: 'v0.9.1', updateDataModel: { surfaceId: 'main', path: '/items/0' } }, owner));
  assert.equal(((p.getSurface('main')!.data as JsonObject)['items'] as readonly unknown[])[0], undefined);
  accepted(p.process({ version: 'v0.9.1', updateDataModel: { surfaceId: 'main', path: '/items/3', value: 'gap' } }, owner));
  assert.equal(((p.getSurface('main')!.data as JsonObject)['items'] as readonly unknown[]).length, 4);
});

test('prevents ownership leaks and stale actions; data-model metadata includes only the originating surface', () => {
  const p = processor(); create(p, 'main', true); create(p, 'other', true); data(p, { secret: 'other surface' }, '/', 'other');
  data(p, { name: 'Ada' });
  components(p, [{ id: 'root', component: 'Button', child: 'label', action: { event: { name: 'save', context: { name: { path: '/name' } } } } }, { id: 'label', component: 'Text', text: 'Save' }]);
  const id = root(p).id; const revision = p.getSurface('main')!.revision;
  error(p.createAction('main', id, { ownerId: 'another-agent', expectedRevision: revision }), 'a2ui-owner');
  error(p.process({ version: 'v0.9.1', updateDataModel: { surfaceId: 'main', value: {} } }, { ownerId: 'another-agent' }), 'a2ui-owner');
  const action = accepted(p.createAction('main', id, { ...owner, expectedRevision: revision }));
  assert.equal(action.ownerId, owner.ownerId); assert.deepEqual(action.message.action.context, { name: 'Ada' });
  assert.deepEqual(action.dataModel, { version: 'v0.9.1', surfaces: { main: { name: 'Ada' } } });
  data(p, 'Grace', '/name'); error(p.createAction('main', id, { ...owner, expectedRevision: revision }), 'a2ui-revision');
});

test('evaluates nested admitted functions and rechecks validation before dispatch', () => {
  const p = processor(); create(p); data(p, { name: '' });
  const required = { call: 'required', args: { value: { path: '/name' } }, returnType: 'boolean' };
  components(p, [
    { id: 'root', component: 'Button', child: 'label', action: { event: { name: 'save' } }, checks: [{ condition: { call: 'and', args: { values: [required, { call: 'not', args: { value: false } }] } }, message: 'Name required' }] },
    { id: 'label', component: 'Text', text: 'Save' }
  ]);
  assert.deepEqual(root(p).checkErrors, ['Name required']);
  error(p.createAction('main', root(p).id, { ...owner, expectedRevision: p.getSurface('main')!.revision }), 'a2ui-action');
  data(p, 'Ada', '/name'); assert.deepEqual(root(p).checkErrors, []);
  accepted(p.createAction('main', root(p).id, { ...owner, expectedRevision: p.getSurface('main')!.revision }));
  const before = p.getSurface('main');
  error(p.process({ version: 'v0.9.1', updateComponents: { surfaceId: 'main', components: [{ id: 'label', component: 'Text', text: { call: 'eval', args: {} } }] } }, owner), 'a2ui-unsupported-function');
  assert.deepEqual(p.getSurface('main'), before);
});

test('rejects unresolved action context and unregistered local functions explicitly', () => {
  const p = processor(); create(p);
  components(p, [{ id: 'root', component: 'Button', child: 'label', action: { event: { name: 'save', context: { pending: { path: '/later' } } } } }, { id: 'label', component: 'Text', text: 'Save' }]);
  error(p.createAction('main', root(p).id, { ...owner, expectedRevision: p.getSurface('main')!.revision }), 'a2ui-pending-binding');
  error(p.process({ version: 'v0.9.1', updateComponents: { surfaceId: 'main', components: [{ id: 'root', component: 'Button', child: 'label', action: { functionCall: { call: 'openUrl', args: { url: 'https://example.com' } } } }] } }, owner), 'a2ui-unsupported-function');
});

test('bounds expanded template work and rolls back data that exceeds the instance budget', () => {
  const p = new A2uiProcessor({ catalogs: [fixtureCatalog], maxInstances: 3 }); create(p);
  components(p, [{ id: 'root', component: 'List', children: { path: '/items', componentId: 'item' } }, { id: 'item', component: 'Text', text: { path: 'name' } }]);
  data(p, [{ name: 'one' }, { name: 'two' }], '/items'); const before = p.getSurface('main');
  error(p.process({ version: 'v0.9.1', updateDataModel: { surfaceId: 'main', path: '/items', value: [{ name: 'one' }, { name: 'two' }, { name: 'three' }] } }, owner), 'a2ui-limit');
  assert.deepEqual(p.getSurface('main'), before);
});

test('owns snapshots, rejects non-JSON payloads and refuses candidate envelopes in stable processing', () => {
  const p = processor(); create(p); const input = { rows: ['original'] }; data(p, input); input.rows[0] = 'mutated';
  const returned = p.getSurface('main')!; (returned.data as { rows: string[] }).rows[0] = 'also mutated';
  assert.deepEqual(p.getSurface('main')!.data, { rows: ['original'] });
  error(p.process({ version: 'v1.0', deleteSurface: { surfaceId: 'main' } }, owner), 'a2ui-version');
  error(p.process({ version: 'v0.9.1', createSurface: {}, deleteSurface: {} }, owner), 'a2ui-envelope');
  assert.equal(p.process({ version: 'v0.9.1', updateDataModel: { surfaceId: 'main', value: NaN } }, owner).ok, false);
});

const reviewed: LyraGenCatalog = {
  id: 'lyra.test', version: '1', components: {
    text: { tag: 'span', properties: {}, text: true },
    stack: { tag: 'section', properties: {}, children: true },
    input: { tag: 'lr-input', properties: { value: { type: 'string' } }, bindings: { value: { event: 'lr-input', property: 'value' } } }
  }
};

test('exports Lyra-owned stable/candidate catalog identities and never implicitly advertises qualification', () => {
  const catalog = createA2uiCatalog(reviewed); const exported = exportA2uiCatalog(catalog); const candidate = exportA2uiCandidateCatalog(reviewed);
  assert.notEqual(exported['catalogId'], basicId); assert.notEqual(exported['catalogId'], candidate['catalogId']);
  assert.equal(candidate['protocolVersion'], '1.0'); assert.equal(A2UI_CANDIDATE_PROFILE.processorSupported, false);
  const p = new A2uiProcessor({ catalogs: [catalog] }); assert.deepEqual(a2uiClientCapabilities(p)['v0.9'].supportedCatalogIds, []);
  const qualified = new A2uiProcessor({ catalogs: [catalog], qualifiedCatalogIds: [catalog.id] });
  assert.deepEqual(a2uiClientCapabilities(qualified)['v0.9'].supportedCatalogIds, [catalog.id]);
  assert.throws(() => new A2uiProcessor({ catalogs: [catalog], qualifiedCatalogIds: [basicId] }));
  accepted(p.process({ version: 'v0.9.1', createSurface: { surfaceId: 'main', catalogId: catalog.id } }, owner));
  components(p, [{ id: 'root', component: 'stack', children: ['greeting'] }, { id: 'greeting', component: 'text', text: 'Hello' }]);
  const view = accepted(p.toView('main'));
  assert.deepEqual(view.catalog, { id: reviewed.id, version: reviewed.version }); assert.equal(view.root.children?.[0]?.text, 'Hello');
});

test('keeps literal action arrays literal instead of evaluating their object members', () => {
  const p = processor(); create(p);
  const values = [{ path: '/not-a-binding-in-a-literal-array' }];
  components(p, [{ id: 'root', component: 'Button', child: 'label', action: { event: { name: 'save', context: { values } } } }, { id: 'label', component: 'Text', text: 'Save' }]);
  const action = accepted(p.createAction('main', root(p).id, { ...owner, expectedRevision: p.getSurface('main')!.revision }));
  assert.deepEqual(action.message.action.context['values'], values);
});

test('requires object roots when data-model transport metadata is enabled', () => {
  const p = processor(); create(p, 'main', true); const before = p.getSurface('main');
  error(p.process({ version: 'v0.9.1', updateDataModel: { surfaceId: 'main', value: ['array'] } }, owner), 'a2ui-data-model');
  assert.deepEqual(p.getSurface('main'), before);
});

test('rejects a value that is ambiguous between catalog literal data and a binding', () => {
  const catalog = createA2uiCatalog({ id: 'objects', version: '1', components: { object: { tag: 'div', properties: { data: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'], additionalProperties: false } } } } });
  const p = new A2uiProcessor({ catalogs: [catalog] });
  accepted(p.process({ version: 'v0.9.1', createSurface: { surfaceId: 'main', catalogId: catalog.id } }, owner));
  error(p.process({ version: 'v0.9.1', updateComponents: { surfaceId: 'main', components: [{ id: 'root', component: 'object', data: { path: '/value' } }] } }, owner), 'a2ui-ambiguous-value');
});

test('array deletion preserves length, undefined slots and surviving instance identities', () => {
  const p = processor(); create(p, 'main', true);
  data(p, { items: [{ name: 'First' }, { name: 'Second' }, { name: 'Third' }] });
  components(p, [{ id: 'root', component: 'List', children: { path: '/items', componentId: 'item' } }, { id: 'item', component: 'Text', text: { path: 'name' } }]);
  const ids = root(p).children.map(node => node.id);
  accepted(p.process({ version: 'v0.9.1', updateDataModel: { surfaceId: 'main', path: '/items/1' } }, owner));
  const items = (p.getSurface('main')!.data as { items: unknown[] }).items;
  assert.equal(items.length, 3); assert.equal(items[1], undefined); assert.equal(Object.hasOwn(items, 1), true);
  assert.deepEqual(root(p).children.map(node => node.id), ids);
  assert.deepEqual(root(p).children.map(node => node.props['text']), ['First', '', 'Third']);
  components(p, [{ id: 'submit', component: 'Button', child: 'label', action: { event: { name: 'save', context: { items: { path: '/items' } } } } }, { id: 'label', component: 'Text', text: 'Save' }, { id: 'root', component: 'Column', children: ['submit'] }]);
  const action = accepted(p.createAction('main', root(p).children[0]!.id, { ...owner, expectedRevision: p.getSurface('main')!.revision }));
  assert.deepEqual(action.message.action.context['items'], [{ name: 'First' }, null, { name: 'Third' }]);
  assert.deepEqual(action.dataModel?.surfaces['main'], { items: [{ name: 'First' }, null, { name: 'Third' }] });
  assert.equal((p.getSurface('main')!.data as { items: unknown[] }).items[1], undefined);
});

test('sparse upserts materialize only written indices and absent deletes never create ancestors', () => {
  const p = processor(); create(p); data(p, 'value', '/groups/2/items/3/name');
  const state = p.getSurface('main')!.data as { groups: { items: unknown[] }[] };
  assert.equal(state.groups.length, 3); assert.equal(Object.hasOwn(state.groups, 0), false);
  assert.equal(state.groups[2]!.items.length, 4); assert.equal(Object.hasOwn(state.groups[2]!.items, 0), false);
  const before = p.getSurface('main')!.data;
  accepted(p.process({ version: 'v0.9.1', updateDataModel: { surfaceId: 'main', path: '/absent/deep/key' } }, owner));
  accepted(p.process({ version: 'v0.9.1', updateDataModel: { surfaceId: 'main', path: '/groups/20' } }, owner));
  assert.deepEqual(p.getSurface('main')!.data, before);
  data(p, null, '/nullable'); data(p, 'child', '/nullable/value');
  assert.deepEqual((p.getSurface('main')!.data as JsonObject)['nullable'], { value: 'child' });
});

test('a JSON null update remains a value, separately from omitted-value deletion', () => {
  const p = processor(); create(p); data(p, { value: 'before', items: ['before'] });
  data(p, null, '/value'); data(p, null, '/items/0');
  assert.deepEqual(p.getSurface('main')!.data, { value: null, items: [null] });
  accepted(p.process({ version: 'v0.9.1', updateDataModel: { surfaceId: 'main', path: '/value' } }, owner));
  assert.deepEqual(p.getSurface('main')!.data, { items: [null] });
});

function localProcessor(): A2uiProcessor {
  return new A2uiProcessor({ catalogs: [{ ...fixtureCatalog, functions: {
    ...fixtureCatalog.functions,
    openUrl: { args: { url: text }, required: ['url'], returnType: 'void', effect: 'host' }
  } }] });
}
function localButton(p: A2uiProcessor, call: unknown): void {
  components(p, [{ id: 'root', component: 'Button', child: 'label', action: { functionCall: call } }, { id: 'label', component: 'Text', text: 'Open' }]);
}

test('local host effects require current instance, revision and explicit host authorization', async () => {
  const p = localProcessor(); create(p); data(p, { url: 'https://example.com/allowed' });
  localButton(p, { call: 'openUrl', args: { url: { path: '/url' } }, returnType: 'void' });
  const node = root(p); assert.equal(node.localAction?.name, 'openUrl');
  let executions = 0;
  const denied = { authorize: () => false, execute: () => { executions++; } };
  error(await p.executeLocalAction('main', node.id, { ...owner, expectedRevision: p.getSurface('main')!.revision }, denied), 'a2ui-action-denied');
  assert.equal(executions, 0);
  const acceptedHost = { authorize: (request: { name: string }) => request.name === 'openUrl', execute: (request: { args: Readonly<Record<string, unknown>> }) => { assert.equal(request.args['url'], 'https://example.com/allowed'); executions++; } };
  const result = accepted(await p.executeLocalAction('main', node.id, { ...owner, expectedRevision: p.getSurface('main')!.revision }, acceptedHost));
  assert.equal(result.request.name, 'openUrl'); assert.equal(result.value, undefined); assert.equal(executions, 1);
  error(p.createAction('main', node.id, { ...owner, expectedRevision: p.getSurface('main')!.revision }), 'a2ui-action');
  const revision = p.getSurface('main')!.revision; data(p, 'https://example.com/new', '/url');
  error(await p.executeLocalAction('main', node.id, { ...owner, expectedRevision: revision }, acceptedHost), 'a2ui-revision');
  assert.equal(executions, 1);
});

test('host effects never run in bindings, checks, arguments or event contexts', () => {
  const p = localProcessor(); create(p);
  const call = { call: 'openUrl', args: { url: 'https://example.com' }, returnType: 'void' };
  for (const component of [
    { id: 'root', component: 'Text', text: call },
    { id: 'root', component: 'Button', child: 'label', checks: [{ condition: call, message: 'No' }], action: { event: { name: 'save' } } },
    { id: 'root', component: 'Button', child: 'label', action: { event: { name: 'save', context: { illegal: call } } } },
    { id: 'root', component: 'Button', child: 'label', action: { functionCall: { call: 'openUrl', args: { url: call } } } }
  ]) error(p.process({ version: 'v0.9.1', updateComponents: { surfaceId: 'main', components: [component] } }, owner), 'a2ui-function-effect');
  assert.equal(p.getSurface('main')!.revision, 0);
});

test('local actions recheck state after authorization and sanitize execution failures', async () => {
  const p = localProcessor(); create(p); localButton(p, { call: 'openUrl', args: { url: 'https://example.com' } });
  let executions = 0;
  error(await p.executeLocalAction('main', root(p).id, { ...owner, expectedRevision: p.getSurface('main')!.revision }, { authorize: () => { data(p, { changed: true }); return true; }, execute: () => { executions++; } }), 'a2ui-revision');
  assert.equal(executions, 0);
  const result = await p.executeLocalAction('main', root(p).id, { ...owner, expectedRevision: p.getSurface('main')!.revision }, { authorize: () => true, execute: () => { throw new Error('private host error'); } });
  error(result, 'a2ui-action-execution'); assert.equal(JSON.stringify(result).includes('private host error'), false);
});

test('pure local function actions execute after authorization and return their declared result', async () => {
  const p = processor(); create(p); localButton(p, { call: 'required', args: { value: 'present' }, returnType: 'boolean' });
  const result = accepted(await p.executeLocalAction('main', root(p).id, { ...owner, expectedRevision: p.getSurface('main')!.revision }, { authorize: () => true, execute: () => { throw new Error('A pure function must not dispatch an effect'); } }));
  assert.equal(result.value, true);
});

test('local action arguments resolve in the selected template scope and checks block effects', async () => {
  const p = localProcessor(); create(p); data(p, { items: [{ url: 'https://example.com/one' }, { url: 'https://example.com/two' }], enabled: false });
  components(p, [
    { id: 'root', component: 'List', children: { componentId: 'button', path: '/items' } },
    { id: 'button', component: 'Button', child: 'label', checks: [{ condition: { path: '/enabled' }, message: 'Disabled' }], action: { functionCall: { call: 'openUrl', args: { url: { path: 'url' } } } } },
    { id: 'label', component: 'Text', text: 'Open' }
  ]);
  const urls: unknown[] = []; const host = { authorize: () => true, execute: (request: { args: Readonly<Record<string, unknown>> }) => { urls.push(request.args['url']); } };
  error(await p.executeLocalAction('main', root(p).children[1]!.id, { ...owner, expectedRevision: p.getSurface('main')!.revision }, host), 'a2ui-action');
  assert.deepEqual(urls, []); data(p, true, '/enabled');
  accepted(await p.executeLocalAction('main', root(p).children[1]!.id, { ...owner, expectedRevision: p.getSurface('main')!.revision }, host));
  assert.deepEqual(urls, ['https://example.com/two']);
});

test('rejects prior-lifetime actions, writes and guarded mutations after same-owner surface recreation', () => {
  const p = processor();
  const populate = (name: string): void => {
    create(p);
    data(p, { name });
    components(p, [
      { id: 'root', component: 'Column', children: ['field', 'button'] },
      { id: 'field', component: 'TextField', label: 'Name', value: { path: '/name' } },
      { id: 'button', component: 'Button', child: 'label', action: { event: { name } } },
      { id: 'label', component: 'Text', text: 'Apply' },
    ]);
  };
  populate('original');
  const previous = p.getSurface('main')!;
  const oldField = root(p).children[0]!;
  const oldButton = root(p).children[1]!;
  accepted(p.process({ version: 'v0.9.1', deleteSurface: { surfaceId: 'main' } }, owner));
  populate('replacement');
  const current = p.getSurface('main')!;
  const stale = { ...owner, expectedRevision: previous.revision };
  error(p.createAction('main', oldButton.id, stale), 'a2ui-revision');
  error(p.writeBinding('main', oldField.id, 'value', 'stale', stale), 'a2ui-revision');
  for (const message of [
    { version: 'v0.9.1', deleteSurface: { surfaceId: 'main' } },
    { version: 'v0.9.1', updateDataModel: { surfaceId: 'main', value: { name: 'stale' } } },
    { version: 'v0.9.1', updateComponents: { surfaceId: 'main', components: [{ id: 'label', component: 'Text', text: 'Stale' }] } },
  ]) error(p.process(message, stale), 'a2ui-revision');
  assert.deepEqual(p.getSurface('main'), current);
  const fresh = { ...owner, expectedRevision: current.revision };
  error(p.createAction('main', oldButton.id, fresh), 'a2ui-instance');
  error(p.writeBinding('main', oldField.id, 'value', 'stale', fresh), 'a2ui-instance');
  assert.notEqual(root(p).children[1]!.id, oldButton.id);
  assert.equal(accepted(p.createAction('main', root(p).children[1]!.id, fresh)).message.action.name, 'replacement');
});
