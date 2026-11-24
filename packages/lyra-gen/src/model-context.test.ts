import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createModelContext, toPromptText, MODEL_CONTEXT_REDACTED } from './model-context.js';
import { createSurfaceState, setSurfaceState, validateView } from './runtime.js';
import type { JsonValue, LyraGenCatalog, LyraGenView } from './types.js';

const pwNode = { id: 'pw', type: 'secret', props: { label: 'Password' }, bindings: { value: '/form/password' } };
const catalog: LyraGenCatalog = { id: 'ctx', version: '1', components: {
  column: { tag: 'div', properties: {}, children: true },
  heading: { tag: 'h2', text: true, properties: {} },
  field: { tag: 'input', properties: { label: { type: 'string' }, value: { type: 'string' } }, bindings: { value: { event: 'input', property: 'value' } }, fieldPurpose: 'general' },
  secret: { tag: 'input', properties: { label: { type: 'string' }, value: { type: 'string' } }, bindings: { value: { event: 'input', property: 'value' } }, fieldPurpose: 'password' }
}, fieldPolicy: { approvedFields: [{ surfaceId: 'surface', node: pwNode, purpose: 'password', allowSensitive: true }] } };
const input: LyraGenView = { version: '1', catalog: { id: 'ctx', version: '1' }, surfaceId: 'surface', revision: 3, root: { id: 'root', type: 'column', children: [
  { id: 'title', type: 'heading', text: 'Account' },
  { id: 'name', type: 'field', props: { label: 'Full name' }, bindings: { value: '/form/name' } },
  pwNode
] } };
const admitted = validateView(input, catalog);
assert.equal(admitted.ok, true);
const view = (admitted as { value: LyraGenView }).value;
const makeState = () => {
  let state = createSurfaceState(view, { form: { name: 'a', password: 'x' } });
  state = (setSurfaceState(state, '/form/name', 'Ada Lovelace') as { value: typeof state }).value;
  state = (setSurfaceState(state, '/form/password', 'hunter2-token') as { value: typeof state }).value;
  return state;
};

test('outline, values and dirty pointers are emitted; password state is always redacted', () => {
  const result = createModelContext(view, makeState(), { catalog });
  assert.equal(result.ok, true); if (!result.ok) return;
  const context = result.value;
  assert.equal(context.surfaceId, 'surface');
  assert.equal(context.revision, 3);
  assert.deepEqual(context.nodes!.map(node => node.id), ['root', 'title', 'name', 'pw']);
  assert.equal(context.nodes![1]!.label, 'Account');
  assert.equal(context.nodes![2]!.label, 'Full name');
  assert.deepEqual(context.values, { form: { name: 'Ada Lovelace', password: MODEL_CONTEXT_REDACTED } });
  assert.deepEqual(context.dirty, ['/form/name']);
  assert.equal(JSON.stringify(context).includes('hunter2-token'), false);
  assert.equal(Object.isFrozen(context), true);
});

test('private pointers are omitted, including nested, array and descendant paths', () => {
  const state = { ...makeState(), values: { form: { name: 'Ada', list: [{ k: 'S1' }, { k: 'S2' }], deep: { a: { b: 'S3' } } } } as JsonValue };
  const result = createModelContext(view, state, { catalog, private: ['/form/list/1/k', '/form/deep/a'], liveData: { form: { name: 'S4' }, other: 1 } });
  assert.equal(result.ok, true); if (!result.ok) return;
  const text = JSON.stringify(result.value);
  for (const secret of ['S2', 'S3']) assert.equal(text.includes(secret), false);
  assert.equal(text.includes('S1'), true);
  const live = createModelContext(view, state, { catalog, private: ['/form/name'], liveData: { form: { name: 'S4' }, other: 1 } });
  assert.equal(live.ok && JSON.stringify(live.value).includes('S4'), false);
  assert.equal(live.ok && live.value.liveData !== undefined && 'other' in (live.value.liveData as object), true);
});

test('private dirty pointers are not named', () => {
  const result = createModelContext(view, makeState(), { catalog, private: ['/form'] });
  assert.equal(result.ok, true); if (!result.ok) return;
  assert.deepEqual(result.value.dirty, []);
  assert.equal(JSON.stringify(result.value).includes('Ada'), false);
});

test('invalid private pointers and mismatched surfaces fail closed', () => {
  assert.equal(createModelContext(view, makeState(), { catalog, private: ['form'] }).ok, false);
  assert.equal(createModelContext(view, { ...makeState(), surfaceId: 'other' }, { catalog }).ok, false);
});

test('the byte ceiling holds and truncation is marked', () => {
  const big = { ...makeState(), values: { rows: Array.from({ length: 50 }, (_, index) => ({ index, text: 'é'.repeat(200) })) } as JsonValue };
  const result = createModelContext(view, big, { catalog, maxBytes: 1024, liveData: { x: 'y'.repeat(5000) } });
  assert.equal(result.ok, true); if (!result.ok) return;
  assert.ok(new TextEncoder().encode(JSON.stringify(result.value)).length <= 1024);
  assert.equal(result.value.truncated, true);
  const roomy = createModelContext(view, makeState(), { catalog });
  assert.equal(roomy.ok && roomy.value.truncated, undefined);
});

test('maxNodes truncates the outline breadth-first and drops dangling child ids', () => {
  const result = createModelContext(view, makeState(), { catalog, maxNodes: 2 });
  assert.equal(result.ok, true); if (!result.ok) return;
  assert.deepEqual(result.value.nodes!.map(node => node.id), ['root', 'title']);
  assert.deepEqual(result.value.nodes![0]!.children, ['title']);
  assert.equal(result.value.truncated, true);
});

test('output and prompt text are deterministic', () => {
  const first = createModelContext(view, makeState(), { catalog, selection: { b: 1, a: [2] } });
  const second = createModelContext(view, makeState(), { catalog, selection: { a: [2], b: 1 } });
  assert.equal(JSON.stringify(first), JSON.stringify(second));
  if (!first.ok || !second.ok) return assert.fail();
  assert.equal(toPromptText(first.value), toPromptText(second.value));
  assert.match(toPromptText(first.value), /^surface surface revision 3\nnode root column > title,name,pw/u);
});

test('props that hint at sensitive input redact without a catalog declaration', () => {
  const plain: LyraGenView = { ...view, root: { id: 'root', type: 'column', children: [{ id: 'code', type: 'field', props: { type: 'password' }, bindings: { value: '/c' } }] } };
  let state = createSurfaceState(plain, { c: '' });
  state = (setSurfaceState(state, '/c', 'ZZ-123') as { value: typeof state }).value;
  const result = createModelContext(plain, state, { catalog });
  assert.equal(result.ok && JSON.stringify(result.value).includes('ZZ-123'), false);
});
