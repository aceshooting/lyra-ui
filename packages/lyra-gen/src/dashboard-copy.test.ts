import assert from 'node:assert/strict';
import test from 'node:test';
import { createCatalog, dashboardCatalog } from './catalog.js';
import { copyDashboardPanel } from './dashboard-copy.js';
import { findNode, validateView } from './runtime.js';
import type { LyraGenCatalog, LyraGenNode, LyraGenView } from './types.js';

const base = dashboardCatalog();
const build = (catalog: LyraGenCatalog, surfaceId: string, ...children: LyraGenNode[]): LyraGenView => {
  const checked = validateView({ version: '1', catalog: { id: catalog.id, version: catalog.version }, surfaceId, revision: 1, root: { id: 'root', type: 'stack', children } }, catalog);
  assert.ok(checked.ok, JSON.stringify(checked.diagnostics));
  return (checked as { value: LyraGenView }).value;
};
const panel: LyraGenNode = { id: 'p', type: 'stack', children: [
  { id: 'title', type: 'heading', text: 'Panel' },
  { id: 'g', type: 'gauge', props: { label: 'Load', value: 3 } },
] };
const source = build(base, 'source', panel);

test('a panel is copied with a prefix on every id and the target revision advances', () => {
  const target = build(base, 'target', { id: 'keep', type: 'text', text: 'x' });
  const result = copyDashboardPanel(source, 'p', target, { catalog: base, parentId: 'root', newIdPrefix: 'copy' });
  assert.ok(result.ok, JSON.stringify(result.diagnostics));
  if (!result.ok) return;
  assert.equal(result.value.revision, target.revision + 1);
  assert.deepEqual(result.value.root.children!.map(child => child.id), ['keep', 'copy-p']);
  assert.deepEqual(result.value.root.children![1]!.children!.map(child => child.id), ['copy-title', 'copy-g']);
  assert.equal(findNode(source, 'p')!.id, 'p');
});

test('copying into the same view picks a collision-free prefix', () => {
  const first = copyDashboardPanel(source, 'p', source, { catalog: base, parentId: 'root', newIdPrefix: 'dup' });
  assert.ok(first.ok);
  if (!first.ok) return;
  const second = copyDashboardPanel(source, 'p', first.value, { catalog: base, parentId: 'root', newIdPrefix: 'dup' });
  assert.ok(second.ok, JSON.stringify(second.diagnostics));
  if (!second.ok) return;
  const all = JSON.stringify(second.value.root).match(/"id":"[^"]+"/gu)!;
  assert.equal(new Set(all).size, all.length);
  assert.ok(findNode(second.value, 'dup-2-g'));
});

test('bindings, reads and actions the target does not allow are dropped', () => {
  const rich = createCatalog({ ...base, id: 'rich', actions: { go: { payload: { type: 'object', properties: {}, additionalProperties: false } } }, components: { ...base.components } });
  const withInput: LyraGenNode = { id: 'f', type: 'stack', children: [
    { id: 'q', type: 'input', props: { label: 'Search' }, bindings: { value: '/q' } },
    { id: 'btn', type: 'button', text: 'Go', action: { name: 'go' } },
  ] };
  const rawSource = { ...source, root: { ...source.root, children: [withInput] } } as LyraGenView;
  const target = build(base, 'target', { id: 'keep', type: 'text', text: 'x' });
  const result = copyDashboardPanel(rawSource, 'f', target, { catalog: base, parentId: 'root', newIdPrefix: 'c' });
  assert.ok(result.ok, JSON.stringify(result.diagnostics));
  if (!result.ok) return;
  const input = findNode(result.value, 'c-q')!;
  const button = findNode(result.value, 'c-btn')!;
  assert.equal(button.action, undefined);
  assert.equal(input.bindings?.['value'], '/q');
  const taken = build(base, 'taken', { id: 'own', type: 'input', props: { label: 'Mine' }, bindings: { value: '/q' } });
  const again = copyDashboardPanel(rawSource, 'f', taken, { catalog: base, parentId: 'root', newIdPrefix: 'c' });
  assert.ok(again.ok, JSON.stringify(again.diagnostics));
  if (again.ok) assert.equal(findNode(again.value, 'c-q')!.bindings, undefined);
  const actionable = copyDashboardPanel(rawSource, 'f', build(rich, 'rich-target', { id: 'keep', type: 'text', text: 'x' }), { catalog: rich, parentId: 'root', newIdPrefix: 'c' });
  assert.ok(actionable.ok, JSON.stringify(actionable.diagnostics));
  if (actionable.ok) assert.equal(findNode(actionable.value, 'c-btn')!.action?.name, 'go');
});

test('failures return diagnostics instead of a view', () => {
  const target = build(base, 'target', { id: 'keep', type: 'text', text: 'x' });
  const code = (result: { ok: boolean; diagnostics: readonly { code: string }[] }): string => result.diagnostics[0]!.code;
  assert.equal(code(copyDashboardPanel(source, 'missing', target, { catalog: base, parentId: 'root', newIdPrefix: 'c' })), 'copy.source');
  assert.equal(code(copyDashboardPanel(source, 'p', target, { catalog: base, parentId: 'root', newIdPrefix: '1 bad' })), 'copy.prefix');
  assert.equal(copyDashboardPanel(source, 'p', target, { catalog: base, parentId: 'nowhere', newIdPrefix: 'c' }).ok, false);
  const narrow = createCatalog({ id: 'narrow', version: '1', components: { stack: base.components['stack']!, heading: base.components['heading']! } });
  const narrowTarget = build(narrow, 'narrow-target');
  assert.equal(copyDashboardPanel(source, 'p', narrowTarget, { catalog: narrow, parentId: 'root', newIdPrefix: 'c' }).ok, false);
});
