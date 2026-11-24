import assert from 'node:assert/strict';
import test from 'node:test';
import { createCatalog, dashboardCatalog, initialCatalog } from '../catalog.js';
import { validateView } from '../runtime.js';
import { chartExtraRoles } from './charts-extra.js';
import type { JsonValue, LyraGenCatalog, LyraGenNode } from '../types.js';

const catalog: LyraGenCatalog = createCatalog({ id: 'charts-extra-test', version: '1', components: { ...initialCatalog.components, ...chartExtraRoles } });
const reserved = ['id', 'slot', 'text', 'bindings', 'reads', 'liveReads', 'dataQuery', 'repeat', 'itemReads', 'action'];
const view = (root: LyraGenNode) => ({ version: '1', catalog: { id: catalog.id, version: catalog.version }, surfaceId: 'charts-extra-test', revision: 0, root });
const rejects = (root: LyraGenNode): void => assert.equal(validateView(view(root), catalog).ok, false, JSON.stringify(root).slice(0, 200));
const accepts = (root: LyraGenNode): void => { const checked = validateView(view(root), catalog); assert.ok(checked.ok, JSON.stringify(checked.diagnostics)); };
const one = [{ label: 'Visits', data: [3, 2] }];

test('chart roles are collision-free, reviewed and validate their examples', () => {
  assert.deepEqual(Object.keys(chartExtraRoles), ['donut-chart', 'radial-chart', 'radar-chart', 'horizontal-bar', 'bar-list', 'bubble-chart', 'category-bar', 'tracker', 'chord']);
  const dashboard = dashboardCatalog();
  for (const [role, component] of Object.entries(chartExtraRoles)) {
    // The dashboard overlay adds these roles unchanged; no other overlay or built-in role uses the name.
    assert.equal(dashboard.components[role], component, role);
    assert.equal(Object.hasOwn(initialCatalog.components, role), false, role);
    assert.ok(component.useWhen && component.examples?.length === 1, role);
    assert.ok(component.load && component.documentation?.endsWith(`${component.tag}.md`), role);
    for (const key of Object.keys(component.properties)) assert.equal(reserved.includes(key), false, `${role}.${key}`);
    for (const key of component.hostProperties ?? []) assert.equal(Object.hasOwn(component.properties, key), false, `${role}.${key}`);
    const checked = validateView(view(component.examples![0]!), catalog);
    assert.ok(checked.ok, `${role}: ${JSON.stringify(checked.diagnostics)}`);
  }
});

test('the roles compose into the dashboard overlay without collisions', () => {
  const dashboard = dashboardCatalog();
  const composed = createCatalog({ ...dashboard, components: { ...dashboard.components, ...chartExtraRoles } });
  for (const role of Object.keys(chartExtraRoles)) assert.equal(composed.components[role], chartExtraRoles[role]);
});

test('bar profiles pin the horizontal index axis through the trusted adapter', () => {
  const horizontal = chartExtraRoles['horizontal-bar']!;
  assert.deepEqual(horizontal.hostProperties, ['indexAxis']);
  assert.deepEqual(horizontal.prepareProperties!({ label: 'Load', labels: ['a'], datasets: one as JsonValue }), { label: 'Load', labels: ['a'], datasets: one, indexAxis: 'y' });
  const list = chartExtraRoles['bar-list']!;
  const prepared = list.prepareProperties!({ label: 'Top pages', labels: ['/', '/docs'], datasets: one as JsonValue });
  assert.equal(prepared['indexAxis'], 'y');
  assert.equal(prepared['withoutLegend'], true);
  assert.equal(prepared['grid'], 'none');
  rejects({ id: 'h', type: 'horizontal-bar', props: { label: 'Load', labels: ['a'], datasets: one, indexAxis: 'x' } });
  rejects({ id: 'h', type: 'horizontal-bar', props: { label: 'Load', labels: ['a'], datasets: one, type: 'line' } });
  rejects({ id: 'b', type: 'bar-list', props: { label: 'Top', labels: ['a'], datasets: [...one, ...one] } });
});

test('chart roles bound generated data and refuse colours, callbacks and unknown members', () => {
  rejects({ id: 'd', type: 'donut-chart', props: { labels: ['a'], datasets: one } });
  rejects({ id: 'd', type: 'donut-chart', props: { label: 'Share', labels: ['a'], datasets: [{ label: 'x', data: [1], color: 'red' }] } });
  rejects({ id: 'd', type: 'donut-chart', props: { label: 'Share', labels: Array.from({ length: 51 }, (_, i) => `l${i}`), datasets: one } });
  rejects({ id: 'd', type: 'donut-chart', props: { label: 'Share', labels: ['a'], datasets: one, valueFormatter: 'x' } });
  rejects({ id: 'r', type: 'radar-chart', props: { label: 'Skills', labels: ['a'], datasets: Array.from({ length: 9 }, () => ({ label: 'x', data: [1] })) } });
  rejects({ id: 'b', type: 'bubble-chart', props: { label: 'Deals', datasets: [{ label: 'x', points: [{ x: 1, y: 2, r: -1 }] }] } });
  rejects({ id: 'c', type: 'category-bar', props: { label: 'Budget', segments: [{ label: 'a', value: -1 }] } });
  rejects({ id: 'c', type: 'category-bar', props: { label: 'Budget', segments: [{ label: 'a', value: 1, color: 'red' }] } });
  rejects({ id: 'c', type: 'category-bar', props: { label: 'Budget', segments: [{ label: 'a', value: 1 }], interactive: true } });
  rejects({ id: 't', type: 'tracker', props: { categories: [{ id: 'up', color: 'red' }], items: [{ id: '1', categoryId: 'up' }] } });
  rejects({ id: 't', type: 'tracker', props: { categories: [{ id: 'up', color: 'url(https://example.test/x)' }], items: [{ id: '1', categoryId: 'up' }] } });
  rejects({ id: 't', type: 'tracker', props: { categories: [{ id: 'up', color: 'var(--lr-color-success)' }], items: Array.from({ length: 201 }, (_, i) => ({ id: `${i}`, categoryId: 'up' })) } });
  rejects({ id: 'k', type: 'chord', props: { label: 'Flows', entities: [{ id: 'a', label: 'A' }], matrix: [[-1]] } });
  rejects({ id: 'k', type: 'chord', props: { label: 'Flows', entities: Array.from({ length: 33 }, (_, i) => ({ id: `${i}`, label: `${i}` })), matrix: [] } });
});

test('chart roles accept full-size bounded data', () => {
  accepts({ id: 't', type: 'tracker', props: { categories: [{ id: 'up', color: 'var(--lr-color-success)', label: 'Up' }], items: Array.from({ length: 200 }, (_, i) => ({ id: `${i}`, categoryId: 'up' })) } });
  accepts({ id: 'c', type: 'category-bar', props: { label: 'Budget', total: 100, segments: Array.from({ length: 12 }, (_, i) => ({ label: `s${i}`, value: i, tone: 'brand' })) } });
  accepts({ id: 'd', type: 'donut-chart', props: { label: 'Share', labels: Array.from({ length: 50 }, (_, i) => `l${i}`), datasets: [{ label: 'x', data: Array.from({ length: 50 }, () => 1) }] } });
});
