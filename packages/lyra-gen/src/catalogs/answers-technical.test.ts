import assert from 'node:assert/strict';
import test from 'node:test';
import { createCatalog, initialCatalog } from '../catalog.js';
import { validateView } from '../runtime.js';
import { technicalAnswerRoles } from './answers-technical.js';
import type { LyraGenCatalog, LyraGenNode } from '../types.js';

const catalog: LyraGenCatalog = createCatalog({ id: 'technical-test', version: '1', components: { ...initialCatalog.components, ...technicalAnswerRoles } });
const reserved = ['id', 'slot', 'text', 'bindings', 'reads', 'liveReads', 'dataQuery', 'repeat', 'itemReads', 'action'];
const view = (root: LyraGenNode) => ({ version: '1', catalog: { id: catalog.id, version: catalog.version }, surfaceId: 'technical-test', revision: 0, root });
const rejects = (root: LyraGenNode): void => assert.equal(validateView(view(root), catalog).ok, false, JSON.stringify(root).slice(0, 200));
const span = (id: string) => ({ id, name: id, kind: 'tool', startMs: 0, endMs: 5, status: 'success' });

test('technical roles are collision-free, reviewed and validate their examples', () => {
  assert.deepEqual(Object.keys(technicalAnswerRoles), ['code-block', 'json-viewer', 'diff-view', 'test-results', 'trace-tree', 'span-waterfall']);
  for (const [role, component] of Object.entries(technicalAnswerRoles)) {
    assert.equal(Object.hasOwn(initialCatalog.components, role), false, role);
    assert.ok(component.useWhen && component.examples?.length === 1, role);
    for (const key of Object.keys(component.properties)) assert.equal(reserved.includes(key), false, `${role}.${key}`);
    const checked = validateView(view(component.examples![0]!), catalog);
    assert.ok(checked.ok, `${role}: ${JSON.stringify(checked.diagnostics)}`);
  }
});

test('technical roles bound text, depth, counts and refuse unknown members', () => {
  rejects({ id: 'c', type: 'code-block', props: { label: 'Code', code: 'x', language: 'cobol' } });
  rejects({ id: 'c', type: 'code-block', props: { label: 'Code', code: 'x'.repeat(16385) } });
  rejects({ id: 'c', type: 'code-block', props: { label: 'Code', code: 'x', withoutCopy: false } });
  rejects({ id: 'c', type: 'code-block', props: { code: 'x' } });
  rejects({ id: 'j', type: 'json-viewer', props: { data: { a: { b: { c: { d: { e: { f: 1 } } } } } } } });
  rejects({ id: 'j', type: 'json-viewer', props: { data: { a: 1 }, treeSource: {} } });
  rejects({ id: 'd', type: 'diff-view', props: { oldText: 'a', newText: 'b'.repeat(16385) } });
  rejects({ id: 'd', type: 'diff-view', props: { oldText: 'a', newText: 'b', highlights: [] } });
  rejects({ id: 't', type: 'test-results', props: { suites: [{ id: 's', name: 'S', tests: [{ id: 'a', name: 'A', status: 'broken' }] }] } });
  rejects({ id: 't', type: 'test-results', props: { suites: [] } });
  rejects({ id: 'tr', type: 'trace-tree', props: { label: 'T', spans: Array.from({ length: 501 }, (_, i) => span(`s${i}`)) } });
  rejects({ id: 'tr', type: 'trace-tree', props: { label: 'T', spans: [{ ...span('a'), status: 'exploded' }] } });
  rejects({ id: 'w', type: 'span-waterfall', props: { label: 'W', spans: [span('a')], treeSource: {} } });
});

test('technical roles accept nested JSON and a full-size trace', () => {
  const ok = (root: LyraGenNode): void => { const checked = validateView(view(root), catalog); assert.ok(checked.ok, JSON.stringify(checked.diagnostics)); };
  ok({ id: 'j', type: 'json-viewer', props: { data: { a: { b: [{ c: 1 }] }, d: [1, 'x', null, true] } } });
  ok({ id: 'j', type: 'json-viewer', props: { data: [1, 2, 3] } });
  ok({ id: 'tr', type: 'trace-tree', props: { label: 'T', spans: Array.from({ length: 500 }, (_, i) => span(`s${i}`)) } });
});
