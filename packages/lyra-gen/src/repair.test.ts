import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRepairRequest, LyraGenRepairSession } from './repair.js';
import type { LyraGenCatalog, LyraGenView } from './types.js';
const catalog: LyraGenCatalog = { id: 'test', version: '1', components: { text: { tag: 'span', text: true, properties: {} } } };
const view: LyraGenView = { version: '1', catalog: { id: 'test', version: '1' }, surfaceId: 'surface', revision: 0, root: { id: 'text', type: 'text', text: 'Old' } };
test('repair budgets and revision preconditions prevent stale or expanded-scope writes', () => {
  const request = createRepairRequest(view, ['text'], [{ code: 'a11y.name', path: '/root', message: 'Name required.', severity: 'error' }]);
  assert.equal(request.ok, true); if (!request.ok) return;
  const patch = { surfaceId: 'surface', expectedRevision: 0, operations: [{ op: 'replace' as const, nodeId: 'text', node: { id: 'text', type: 'text', text: 'Fixed' } }] };
  const repair = new LyraGenRepairSession(request.value, { maxAttempts: 2, maxTokens: 10 });
  assert.equal(repair.apply({ ...view, revision: 1 }, patch, catalog, 1).ok, false);
  assert.equal(repair.apply(view, patch, catalog, 1).ok, true);
  assert.equal(repair.apply(view, patch, catalog, 1).ok, false);
  assert.equal(new LyraGenRepairSession(request.value, { maxTokens: 1 }).apply(view, patch, catalog, 2).ok, false);
  assert.equal(createRepairRequest(view, ['text'], [{ code: 'identity.duplicate', path: '/root', message: 'Duplicate.', severity: 'error' }]).ok, false);
});
test('content-only rejected boundaries can be repaired, authority failures cannot', () => {
  const boundedCatalog: LyraGenCatalog = { id: 'test', version: '1', components: { text: { tag: 'span', properties: { label: { type: 'string' } } } } };
  const invalid = { ...view, root: { id: 'text', type: 'text', props: { label: 42 } } };
  const request = createRepairRequest(invalid, ['text'], [{ code: 'schema.type', path: '/root/props/label', message: 'Expected string.', severity: 'error' }]);
  assert.equal(request.ok, true); if (!request.ok) return;
  const patch = { surfaceId: 'surface', expectedRevision: 0, operations: [{ op: 'replace' as const, nodeId: 'text', node: { id: 'text', type: 'text', props: { label: 'Fixed' } } }] };
  assert.equal(new LyraGenRepairSession(request.value).apply(invalid, patch, boundedCatalog, 1).ok, true);
  for (const code of ['catalog.component', 'view.catalog', 'action.unknown', 'binding.unknown', 'state.unauthorized']) {
    assert.equal(createRepairRequest(view, ['text'], [{ code, path: '/root', message: 'Forbidden.', severity: 'error' }]).ok, false);
  }
});
