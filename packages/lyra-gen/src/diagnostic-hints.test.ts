import assert from 'node:assert/strict';
import { test } from 'node:test';
import { nearestName, schemaHint } from './diagnostic-hints.js';
import { validateView } from './runtime.js';
import type { LyraGenCatalog, LyraGenDiagnostic, LyraGenNode, LyraGenView } from './types.js';

const catalog: LyraGenCatalog = {
  id: 'hints', version: '1',
  components: {
    stack: { tag: 'div', properties: {}, children: true, slots: ['aside'] },
    list: { tag: 'ul', properties: {}, children: ['text'] },
    text: { tag: 'span', properties: { tone: { type: 'string', enum: ['info', 'warning'] }, size: { type: 'integer', minimum: 1, maximum: 6 }, label: { type: 'string', maxLength: 8 } }, text: true },
    metric: { tag: 'div', properties: { label: { type: 'string' }, value: { type: 'number' }, items: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, weight: { type: 'number' } }, required: ['name'] }, maxItems: 3 } }, required: ['label'] },
    input: { tag: 'input', properties: { value: { type: 'string' }, label: { type: 'string' }, secretToken: { type: 'string' } }, accessibleName: { required: true, properties: ['label'] }, bindings: { value: { event: 'input', property: 'value' } } },
    button: { tag: 'button', properties: {}, text: true, events: ['click'] }
  },
  actions: { save: { payload: { type: 'object', properties: { title: { type: 'string' } }, required: ['title'] } } },
  queries: { metrics: { params: { type: 'object', properties: { scope: { type: 'string', maxLength: 32 } }, additionalProperties: false } } }
};
const view = (root: LyraGenNode): LyraGenView => ({ version: '1', catalog: { id: 'hints', version: '1' }, surfaceId: 's', revision: 0, root });
const errors = (root: LyraGenNode): readonly LyraGenDiagnostic[] => { const result = validateView(view(root), catalog); assert.equal(result.ok, false); return result.diagnostics; };
const only = (root: LyraGenNode, code: string): LyraGenDiagnostic => { const found = errors(root).find(diagnostic => diagnostic.code === code); assert.ok(found, `expected ${code}`); return found; };

test('nearestName returns the closest declared name within two edits, deterministically', () => {
  assert.equal(nearestName('labelz', ['label', 'value']), 'label');
  assert.equal(nearestName('valuz', ['label', 'value']), 'value');
  assert.equal(nearestName('completely-different', ['label', 'value']), undefined);
  assert.equal(nearestName('ab', ['ac', 'ad']), 'ac');
  assert.equal(nearestName('x'.repeat(500), ['x'.repeat(499)]), undefined);
});

test('schemaHint names allowed values, bounds and shapes from the declared schema', () => {
  assert.equal(schemaHint('schema.enum', { type: 'string', enum: ['a', 'b'] }, ''), 'Allowed values: "a", "b".');
  assert.equal(schemaHint('schema.range', { type: 'integer', minimum: 1, maximum: 6 }, ''), 'Expected an integer from 1 to 6.');
  assert.equal(schemaHint('schema.length', { type: 'string', maxLength: 8 }, ''), 'Expected a string of at most 8 characters.');
  assert.equal(schemaHint('schema.type', { type: 'array', items: { type: 'number' }, maxItems: 3 }, ''), 'Expected an array of at most 3 items, each a number.');
  assert.equal(schemaHint('schema.required', { type: 'array', items: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] } }, '/0/name'), 'Add the required property "name" (a string).');
  assert.equal(schemaHint('schema.property', { type: 'object', properties: { name: { type: 'string' } } }, '/namz'), 'Did you mean "name"? Allowed properties: name.');
  assert.equal(schemaHint('schema.any-of', { anyOf: [{ type: 'string' }, { type: 'number' }] }, ''), 'Expected one of: a string, a number.');
  assert.equal(schemaHint('schema.type', { type: 'string' }, '/deep/missing'), undefined);
});

test('content errors carry actionable hints with nearest names and declared alternatives', () => {
  assert.equal(only({ id: 'r', type: 'stack', children: [{ id: 't', type: 'txet' }] }, 'catalog.component').hint, 'Did you mean "text"? Declared components: stack, list, text, metric, input, button.');
  assert.match(only({ id: 'r', type: 'stack', children: [{ id: 't', type: 'text', props: { labelz: 'x' } }] }, 'props.unknown').hint ?? '', /^Did you mean "label"\? Allowed properties: tone, size, label\.$/u);
  assert.equal(only({ id: 'r', type: 'stack', children: [{ id: 't', type: 'text', props: { tone: 'loud' } }] }, 'schema.enum').hint, 'Allowed values: "info", "warning".');
  assert.equal(only({ id: 'r', type: 'stack', children: [{ id: 't', type: 'text', props: { size: 9 } }] }, 'schema.range').hint, 'Expected an integer from 1 to 6.');
  assert.equal(only({ id: 'r', type: 'stack', children: [{ id: 'm', type: 'metric', props: { label: 'L', value: 'high' } }] }, 'schema.type').hint, 'Expected a number.');
  assert.equal(only({ id: 'r', type: 'stack', children: [{ id: 'm', type: 'metric', props: { label: 'L', items: [{ weight: 1 }] } }] }, 'schema.required').hint, 'Add the required property "name" (a string).');
  assert.equal(only({ id: 'r', type: 'stack', children: [{ id: 'm', type: 'metric', props: {} }] }, 'props.required').hint, 'Add the required property "label" (a string).');
  assert.equal(only({ id: 'r', type: 'list', children: [{ id: 'b', type: 'button', text: 'Go' }] }, 'children.type').hint, 'Allowed child types: text.');
  assert.equal(only({ id: 'r', type: 'stack', children: [{ id: 't', type: 'text', slot: 'asid' }] }, 'node.slot').hint, 'Did you mean "aside"? Declared slots: aside.');
  assert.equal(only({ id: 'r', type: 'stack', children: [{ id: 't', type: 'text', reads: { labelz: '/x' } }] }, 'read.unknown').hint, 'Did you mean "label"? Declared properties: tone, size, label.');
  assert.equal(only({ id: 'r', type: 'stack', children: [{ id: 'i', type: 'input' }] }, 'a11y.name').hint, 'Set a non-empty label property or a11y.label.');
  assert.equal(only({ id: 'r', type: 'stack', children: [{ id: 'b', type: 'button', text: 'Go', action: { name: 'savz' } }] }, 'action.unknown').hint, 'Did you mean "save"? Declared actions: save.');
  assert.equal(only({ id: 'r', type: 'stack', children: [{ id: 't', type: 'text', dataQuery: { name: 'metric' } }] }, 'query.unknown').hint, 'Did you mean "metrics"? Declared queries: metrics.');
});

test('ownership errors name the nearest owned state path and its owning node', () => {
  const root: LyraGenNode = { id: 'r', type: 'stack', children: [
    { id: 'name', type: 'input', props: { label: 'Name' }, bindings: { value: '/form/name' } },
    { id: 'echo', type: 'text', reads: { label: '/form/nam' } }
  ] };
  assert.equal(only(root, 'read.unowned').hint, 'Did you mean "/form/name" (bound by node "name")? Reads need a path a binding in this view owns.');
  const unrelated: LyraGenNode = { id: 'r', type: 'stack', children: [{ id: 'echo', type: 'text', reads: { label: '/nowhere/owned' } }] };
  assert.equal(only(unrelated, 'read.unowned').hint, 'No binding in this view owns this path; bind it on an input or read a bound path.');
  const overlap: LyraGenNode = { id: 'r', type: 'stack', children: [
    { id: 'a', type: 'input', props: { label: 'A' }, bindings: { value: '/form' } },
    { id: 'b', type: 'input', props: { label: 'B' }, bindings: { value: '/form/b' } }
  ] };
  assert.equal(only(overlap, 'identity.binding').hint, 'The path overlaps the binding of node "a"; choose a separate state path.');
  assert.equal(only({ id: 'r', type: 'stack', children: [{ id: 'r', type: 'text' }] }, 'identity.duplicate').hint, 'The identity is already used by the node at /root; choose a unique id.');
});

test('hints never echo generated values, including values of secret-like properties', () => {
  const secret = 'sk-live-0123456789';
  const diagnostics = errors({ id: 'r', type: 'stack', children: [
    { id: 'i', type: 'input', props: { label: 'Key', secretToken: 7 as unknown as string, valux: secret } },
    { id: 't', type: 'text', props: { tone: secret, label: `${secret}${secret}` } }
  ] });
  assert.ok(diagnostics.length >= 3);
  for (const diagnostic of diagnostics) assert.ok(!JSON.stringify(diagnostic).includes(secret), diagnostic.code);
});
