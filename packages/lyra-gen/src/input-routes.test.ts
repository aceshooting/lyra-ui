import assert from 'node:assert/strict';
import { test } from 'node:test';
import { restoreSnapshot } from './runtime.js';
import type { LyraGenView } from './types.js';
import { positiveRouteFixtures, refusalRouteFixtures, routeIds } from '../test/fixtures/input-routes.js';
import { assertFullView, assertPositiveRoute, assertRefusal } from '../test/input-routes.js';

test('semantic route cohorts have distinct names and every declared route', () => {
  assert.equal(positiveRouteFixtures.length, 3);
  assert.equal(refusalRouteFixtures.length, 9);
  assert.equal(new Set([...positiveRouteFixtures, ...refusalRouteFixtures].map(fixture => fixture.id)).size, 12);
  assert.equal(new Set(routeIds).size, 5);
});

for (const fixture of positiveRouteFixtures) {
  for (const route of routeIds) {
    test(`full input semantics: ${fixture.id}/${route}`, () => {
      assertPositiveRoute(fixture, route);
      if (route.endsWith('-stream')) assertPositiveRoute(fixture, route, [1]);
    });
  }
}
for (const fixture of refusalRouteFixtures) {
  for (const route of routeIds) {
    test(`matched input refusal: ${fixture.id}/${route}`, () => assertRefusal(fixture, route));
  }
  test(`matched input refusal: ${fixture.id}/snapshot-restore`, () => {
    const restored = restoreSnapshot(structuredClone(fixture.forgedSnapshot), fixture.catalog, { limits: fixture.limits });
    assert.equal(restored.ok, false);
    assert.equal('value' in restored, false);
    assert.equal(restored.diagnostics[0]?.code, fixture.code);
    if (fixture.diagnosticPath) assert.equal(restored.diagnostics[0]?.path, fixture.diagnosticPath);
  });
}

const form = positiveRouteFixtures[0]!;
for (const [name, state, code] of [
  ['wrong-owner', { ...form.expectedSnapshot.state, owners: {
    ...form.expectedSnapshot.state.owners, '/form/name': { nodeId: 'notify', property: 'checked', type: 'checkbox' },
  } }, 'state.unauthorized'],
  ['undeclared-value', { ...form.expectedSnapshot.state, values: { form: { name: 'Edited & retained', notify: true }, secret: 'unexpected' } }, 'state.unauthorized'],
  ['undeclared-dirty-pointer', { ...form.expectedSnapshot.state, dirty: ['/form/name', '/secret'] }, 'state.unauthorized'],
  ['wrong-revision', { ...form.expectedSnapshot.state, revision: 8 }, 'snapshot.state'],
] as const) {
  test(`restore refuses authored state forgery: ${name}`, () => {
    const result = restoreSnapshot({ ...form.expectedSnapshot, state }, form.catalog);
    assert.equal(result.ok, false);
    assert.equal('value' in result, false);
    assert.equal(result.diagnostics[0]?.code, code);
  });
}

test('the complete oracle detects envelope, node order, typed values, slots, bindings and actions', () => {
  const slots = positiveRouteFixtures[1]!.expectedView;
  const report = positiveRouteFixtures[2]!.expectedView;
  const mutations: readonly [LyraGenView, LyraGenView][] = [
    [{ ...form.expectedView, revision: 8 }, form.expectedView],
    [{ ...form.expectedView, surfaceId: 'other' }, form.expectedView],
    [{ ...form.expectedView, catalog: { ...form.expectedView.catalog, version: 'other' } }, form.expectedView],
    [{ ...form.expectedView, root: { ...form.expectedView.root, children: [...form.expectedView.root.children!].reverse() } }, form.expectedView],
    [{ ...slots, root: { ...slots.root, children: [{ ...slots.root.children![0]!, children: slots.root.children![0]!.children!.map(node => node.id === 'empty' ? { id: node.id, type: node.type, slot: '' } : node) }] } }, slots],
    [{ ...slots, root: { ...slots.root, children: [{ ...slots.root.children![0]!, children: slots.root.children![0]!.children!.map(node => node.id === 'empty' ? { ...node, slot: 'label' } : node) }] } }, slots],
    [{ ...form.expectedView, root: { ...form.expectedView.root, children: form.expectedView.root.children!.map(node => node.id === 'save' ? { ...node, action: { name: 'erase' } } : node) } }, form.expectedView],
    [{ ...form.expectedView, root: { ...form.expectedView.root, children: form.expectedView.root.children!.map(node => node.id === 'name' ? { ...node, bindings: { value: '/other' } } : node) } }, form.expectedView],
    [{ ...report, root: { ...report.root, children: [...report.root.children!, { id: 'extra', type: 'text', text: 'Unlisted' }] } }, report],
    [{ ...report, root: { ...report.root, children: report.root.children!.map(node => node.id === 'table' ? { ...node, props: { ...node.props, rows: [{ c0: 'Café 🚀', c1: false }, { c0: 'قلم', c1: 12 }] } } : node) } }, report],
  ];
  for (const [actual, expected] of mutations) assert.throws(() => assertFullView(actual, expected), assert.AssertionError);
});
