import assert from 'node:assert/strict';
import test from 'node:test';
import { exportLyraTemplate } from './export.js';
import type { DashboardExportPolicy } from './export.js';
import type { LyraGenCatalog, LyraGenView } from './types.js';

const catalog: LyraGenCatalog = { id: 'public', version: '1', components: {
  text: { tag: 'p', properties: {}, text: true },
  card: { tag: 'lr-card', properties: { appearance: { type: 'string' }, data: { type: 'array', items: { type: 'number' } } }, children: true },
} };
const policy: DashboardExportPolicy = {
  components: { text: { tag: 'p', properties: [] }, card: { tag: 'lr-card', import: '@aceshooting/lyra-ui/components/lr-card.js', properties: ['appearance', 'data'] } },
  allowProperty: (_node, name) => name !== 'data', allowText: () => true,
};
const view: LyraGenView = { version: '1', catalog: { id: 'public', version: '1' }, surfaceId: 'dashboard', revision: 1, root: { id: 'panel', type: 'card', props: { appearance: 'outlined', data: [42] }, children: [{ id: 'label', type: 'text', text: 'Hello <script>danger</script> ${alert(1)} `world`' }] } };
test('export contains public imports and only individually approved literal values', () => {
  const result = exportLyraTemplate(view, catalog, policy);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(result.value.imports, ['@aceshooting/lyra-ui/components/lr-card.js']);
  assert.match(result.value.code, /\.appearance=\$\{"outlined"\}/);
  assert.ok(result.value.code.includes('\\u003cscript>danger\\u003c/script>'));
  assert.ok(result.value.code.includes('\\u003cscript>'));
  assert.ok(!result.value.code.includes('<script>'));
  assert.ok(!result.value.code.includes('[42]'));
  assert.ok(result.diagnostics.some(diagnostic => diagnostic.code === 'export.redacted'));
});
test('export rejects arbitrary imports, unsafe tags, undeclared props and incompatible catalog versions', () => {
  assert.equal(exportLyraTemplate(view, catalog, { ...policy, components: { ...policy.components, card: { tag: 'lr-card', import: 'https://example.test/code.js', properties: ['appearance'] } } }).ok, false);
  assert.equal(exportLyraTemplate({ ...view, catalog: { id: 'public', version: '2' } }, catalog, policy).ok, false);
  assert.equal(exportLyraTemplate({ ...view, root: { id: 'x', type: 'card', props: { onclick: 'alert(1)' } } }, catalog, policy).ok, false);
  assert.equal(exportLyraTemplate(view, { ...catalog, components: { ...catalog.components, card: { ...catalog.components['card']!, tag: 'script' } } }, { ...policy, components: { ...policy.components, card: { tag: 'script', properties: [] } } }).ok, false);
});
test('text is omitted unless the host approves it, and accessors are never invoked', () => {
  const result = exportLyraTemplate(view, catalog, { ...policy, allowText: () => false });
  assert.equal(result.ok, true);
  if (result.ok) assert.ok(!result.value.code.includes('Hello'));
  let getterCalls = 0;
  const malicious = { ...view, get revision() { getterCalls++; return 2; } };
  assert.equal(exportLyraTemplate(malicious, catalog, policy).ok, false);
  assert.equal(getterCalls, 0);
});
test('bounded export rejects a deeply nested or duplicate-identity input', () => {
  assert.equal(exportLyraTemplate(view, catalog, { ...policy, maxNodes: 1 }).ok, false);
  assert.equal(exportLyraTemplate(view, catalog, { ...policy, maxBytes: 10 }).ok, false);
  assert.equal(exportLyraTemplate({ ...view, root: { id: 'panel', type: 'card', children: [{ id: 'panel', type: 'text', text: 'Duplicate' }] } }, catalog, policy).ok, false);
});
test('export preserves trusted structural styles and rejects redacted required accessible names', () => {
  const namedCatalog: LyraGenCatalog = { ...catalog, components: { ...catalog.components, text: { ...catalog.components['text']!, accessibleName: { required: true, text: true } } } };
  assert.equal(exportLyraTemplate(view, namedCatalog, { ...policy, allowText: () => false }).ok, false);
  const result = exportLyraTemplate(view, catalog, policy);
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.ok(result.value.code.includes('export const dashboardStyles = css`'));
    assert.ok(result.value.code.includes('gap: var(--lr-space-m)'));
    assert.ok(result.value.code.includes('data-gen-type=${"card"}'));
  }
});
test('only the reviewed public table adapter is emitted; arbitrary host adapters reject', () => {
  const adaptedCatalog: LyraGenCatalog = { ...catalog, components: { ...catalog.components, card: { ...catalog.components['card']!, prepareProperties: props => props } } };
  const result = exportLyraTemplate(view, adaptedCatalog, policy);
  assert.equal(result.ok, false);
  assert.ok(result.diagnostics.some(diagnostic => diagnostic.message.includes('no qualified static export')));
});


test('formatted table export refuses silently different locale presentation', async () => {
  const { initialCatalog } = await import('./catalog.js');
  const document: LyraGenView = { version: '1', catalog: { id: initialCatalog.id, version: initialCatalog.version }, surfaceId: 'formatted', revision: 0, root: { id: 'records', type: 'table', props: { caption: 'Records', columns: [{ key: 'c0', label: 'Count', format: { kind: 'number' } }], rows: [{ c0: 1234.5 }] } } };
  const result = exportLyraTemplate(document, initialCatalog, { components: { table: { tag: 'lr-table', import: '@aceshooting/lyra-ui/components/lr-table.js', properties: ['caption', 'columns', 'rows'] } }, allowText: () => true, allowProperty: () => true });
  assert.equal(result.ok, false);
  assert.ok(result.diagnostics.some(diagnostic => diagnostic.message.includes('host locale')));
});
