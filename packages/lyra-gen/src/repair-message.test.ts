import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formatRepairMessage } from './repair-message.js';
import { createRepairRequest, isRepairableDiagnostic } from './repair.js';
import { REPAIRABLE_DIAGNOSTIC_CODES, validateView } from './runtime.js';
import type { LyraGenCatalog, LyraGenDiagnostic, LyraGenView } from './types.js';

const error = (code: string, path: string, message = 'Problem.', hint?: string): LyraGenDiagnostic => ({ code, path, message, severity: 'error', ...(hint ? { hint } : {}) });
const catalog: LyraGenCatalog = { id: 'c', version: '1', components: {
  stack: { tag: 'div', properties: {}, children: true },
  text: { tag: 'span', properties: { label: { type: 'string' } }, text: true },
  input: { tag: 'input', properties: { label: { type: 'string' }, value: { type: 'string' } }, bindings: { value: { event: 'input', property: 'value' } } }
} };
const view: LyraGenView = { version: '1', catalog: { id: 'c', version: '1' }, surfaceId: 's', revision: 0, root: { id: 'root', type: 'stack', children: [
  { id: 'first', type: 'text', props: { label: 'A' } },
  { id: 'second', type: 'stack', children: [{ id: 'inner', type: 'text' }] }
] } };

test('formatRepairMessage orders diagnostics by node in document order and names node ids', () => {
  const message = formatRepairMessage([
    error('props.unknown', '/root/children/1/children/0/props/bogus', 'Property is not declared by the catalog.', 'Did you mean "label"?'),
    error('schema.type', '/root/children/0/props/label', 'Expected a string.'),
    error('catalog.component', '/root/children/10/type', 'Component is not in the active catalog.')
  ], { view });
  assert.equal(message, [
    'Fix these validation errors. Return a replacement for each listed node with the same id; keep every other node unchanged.',
    'Node "first" (/root/children/0):',
    '- schema.type at /props/label: Expected a string.',
    'Node "inner" (/root/children/1/children/0):',
    '- props.unknown at /props/bogus: Property is not declared by the catalog. Hint: Did you mean "label"?',
    'Node at /root/children/10:',
    '- catalog.component at /type: Component is not in the active catalog.'
  ].join('\n'));
});

test('formatRepairMessage is deterministic, deduplicated, single-line per entry and bounded', () => {
  const diagnostics = [error('a11y.name', '/root', 'Needs\na name.\u0007'), error('a11y.name', '/root', 'Needs\na name.\u0007'), error('view.catalog', '', 'Catalog mismatch.')];
  const message = formatRepairMessage(diagnostics);
  assert.equal(message, formatRepairMessage([...diagnostics].reverse()));
  assert.equal(message.split('\n').filter(line => line.startsWith('- ')).length, 2);
  assert.ok(message.includes('- a11y.name: Needs a name.'));
  assert.ok(message.includes('View:\n- view.catalog: Catalog mismatch.'));
  const many = Array.from({ length: 200 }, (_, index) => error('props.unknown', `/root/children/${index}/props/x`, 'Property is not declared by the catalog.', 'Allowed properties: a, b, c.'));
  const bounded = formatRepairMessage(many, { maxCharacters: 600 });
  assert.ok(bounded.length <= 600, String(bounded.length));
  assert.match(bounded, /\n\d+ more errors omitted\.$/u);
  assert.ok(bounded.includes('/root/children/0'));
  assert.ok(formatRepairMessage(many).length <= 4000);
  assert.ok(formatRepairMessage([error('x', '/root', 'y'.repeat(5000))], { maxCharacters: 300 }).length <= 300);
  assert.equal(formatRepairMessage([]), '');
  assert.equal(formatRepairMessage(null as unknown as LyraGenDiagnostic[]), '');
  assert.equal(formatRepairMessage([null, 3, { code: 1 }] as unknown as LyraGenDiagnostic[]), '');
  assert.ok(formatRepairMessage(many, { maxCharacters: Number.NaN }).length <= 4000);
});

test('formatRepairMessage renders real validation diagnostics with their hints', () => {
  const broken = { ...view, root: { ...view.root, children: [{ id: 'first', type: 'txet' }, view.root.children![1]!] } } as LyraGenView;
  const result = validateView(broken, catalog);
  assert.equal(result.ok, false);
  const message = formatRepairMessage(result.diagnostics, { view: broken });
  assert.match(message, /Node "first" \(\/root\/children\/0\):\n- catalog\.component at \/type: Component is not in the active catalog\. Hint: Did you mean "text"\?/u);
});

test('content-shape errors are repairable; identity, authority, policy and resource failures are not', () => {
  for (const code of ['props.unknown', 'catalog.component', 'read.unowned', 'props.required', 'schema.type', 'schema.range', 'schema.property', 'node.slot', 'children.type', 'query.unknown', 'a11y.name']) {
    assert.ok(REPAIRABLE_DIAGNOSTIC_CODES.includes(code), code);
  }
  for (const code of ['identity.duplicate', 'identity.binding', 'identity.invalid', 'content.url', 'content.url-binding', 'content.field', 'view.catalog', 'revision.conflict', 'limit.nodes', 'limit.validation', 'action.unknown', 'binding.unknown', 'block.expansion', 'json.syntax', 'repair.limit']) {
    assert.ok(!REPAIRABLE_DIAGNOSTIC_CODES.includes(code), code);
  }
  assert.equal(isRepairableDiagnostic(error('schema.type', '/root/children/0/props/label')), true);
  assert.equal(isRepairableDiagnostic(error('schema.type', '/root/children/0/action/payload/title')), false);
  assert.equal(isRepairableDiagnostic(error('schema.range', '/root/dataQuery/params/scope')), false);
  assert.equal(isRepairableDiagnostic(error('read.unowned', '/root/children/0/reads/label')), true);
  assert.equal(isRepairableDiagnostic(error('identity.duplicate', '/root/children/0/id')), false);
  assert.equal(isRepairableDiagnostic(null as unknown as LyraGenDiagnostic), false);
  assert.equal(createRepairRequest(view, ['first'], [error('schema.type', '/root/children/0/action/payload/title')]).ok, false);
  assert.equal(createRepairRequest(view, ['first'], [error('read.unowned', '/root/children/0/reads/label')]).ok, true);
});
