import assert from 'node:assert/strict';
import test from 'node:test';
import { createCatalog, dashboardCatalog, initialCatalog, liveDashboardCatalog, liveDashboardRoles } from '../catalog.js';
import { buildCatalogPrompt } from '../prompts.js';
import { validateView } from '../runtime.js';
import { dashboardRoleNames } from './dashboard.js';
import type { LyraGenCatalog, LyraGenNode } from '../types.js';

const view = (catalog: LyraGenCatalog, root: LyraGenNode) => ({ version: '1', catalog: { id: catalog.id, version: catalog.version }, surfaceId: 'dashboard-test', revision: 0, root });

test('the dashboard overlay adds reviewed roles without changing the base catalog', () => {
  const overlay = dashboardCatalog();
  assert.equal(overlay.id, `${initialCatalog.id}+dashboard`);
  assert.equal(overlay.version, initialCatalog.version);
  assert.ok(Object.isFrozen(overlay));
  for (const role of dashboardRoleNames) {
    assert.ok(Object.hasOwn(overlay.components, role), role);
    assert.equal(Object.hasOwn(initialCatalog.components, role), false, role);
    const component = overlay.components[role]!;
    assert.ok(component.useWhen && component.examples?.length, `${role}: reviewed usage and example`);
    for (const example of component.examples!) {
      const checked = validateView(view(overlay, example), overlay);
      assert.ok(checked.ok, `${role}: ${JSON.stringify(checked.diagnostics)}`);
    }
  }
  for (const [role, component] of Object.entries(initialCatalog.components)) assert.equal(overlay.components[role], component);
  const custom = createCatalog({ id: 'host', version: '2', components: { gauge: initialCatalog.components['text']! } });
  assert.throws(() => dashboardCatalog(custom), /already defines gauge/u);
});

test('dashboard roles bound generated data and refuse URL or callback members', () => {
  const overlay = dashboardCatalog();
  const rejects = (root: LyraGenNode): void => assert.equal(validateView(view(overlay, root), overlay).ok, false, JSON.stringify(root));
  rejects({ id: 'g', type: 'gauge', props: { value: 3 } });
  rejects({ id: 'g', type: 'gauge', props: { label: 'Load', value: 3, thresholds: Array.from({ length: 9 }, (_, at) => ({ at, variant: 'brand' })) } });
  rejects({ id: 's', type: 'sparkline', props: { label: 'Trend', values: [] } });
  rejects({ id: 's', type: 'sparkline', props: { label: 'Trend', values: Array.from({ length: 501 }, () => 1) } });
  rejects({ id: 'f', type: 'funnel', props: { label: 'Funnel', stages: [{ label: 'A', value: 1, color: 'red' }] } });
  rejects({ id: 'n', type: 'number-ticker', props: { value: 1, valueFormatter: 'x' } });
  rejects({ id: 'n', type: 'number-ticker', props: { value: 1, currency: 'EURO' } });
  rejects({ id: 'p', type: 'poll-status', props: { withRefresh: true } });
});

test('a slider drives a gauge through reads in the live dashboard preset', () => {
  const catalog = liveDashboardCatalog;
  assert.equal(catalog.id, `${initialCatalog.id}+dashboard/live`);
  assert.deepEqual(Object.keys(catalog.components), [...liveDashboardRoles]);
  assert.deepEqual(catalog.actions ?? {}, {});
  const root: LyraGenNode = { id: 'root', type: 'stack', children: [
    { id: 'limit', type: 'slider', props: { label: 'Limit', min: 0, max: 100, step: 1, value: 40 }, bindings: { value: '/limit' } },
    { id: 'gauge', type: 'gauge', props: { label: 'Limit preview', value: 40, max: 100 }, reads: { value: '/limit' } },
  ] };
  assert.ok(validateView(view(catalog, root), catalog).ok);
  // The full overlay is a pool; the preset must fit the default prompt budget with room to spare.
  assert.ok(buildCatalogPrompt(catalog).length < 60000);
});

test('the map overlay keeps the basemap host-owned and bounds generated geography', async () => {
  const { mapCatalog } = await import('../catalog.js');
  assert.throws(() => mapCatalog(initialCatalog, { mapStyle: '' }), /mapStyle/u);
  const style = { version: 8, sources: {}, layers: [] };
  const catalog = mapCatalog(liveDashboardCatalog, { mapStyle: style });
  assert.equal(catalog.id, `${initialCatalog.id}+dashboard/live+map`);
  assert.throws(() => mapCatalog(catalog, { mapStyle: style }), /already defines map/u);
  const map = catalog.components['map']!;
  assert.deepEqual(map.hostProperties, ['mapStyle']);
  assert.equal(Object.hasOwn(map.properties, 'mapStyle'), false);
  assert.equal(buildCatalogPrompt(catalog).includes('"version":8'), false);
  const prepared = map.prepareProperties!({ label: 'Sites' });
  assert.deepEqual(prepared['mapStyle'], style);
  const ok = (root: LyraGenNode): boolean => validateView(view(catalog, root), catalog).ok;
  assert.equal(ok(map.examples![0]!), true);
  assert.equal(ok({ id: 'm', type: 'map', props: { label: 'Sites', mapStyle: 'https://tiles.invalid/style.json' } }), false);
  assert.equal(ok({ id: 'm', type: 'map', props: { label: 'Sites', center: [200, 0] } }), false);
  assert.equal(ok({ id: 'm', type: 'map', props: { label: 'Sites', markers: [{ lngLat: [1, 2], label: 'A', unsafeHtml: '<b>x</b>' }] } }), false);
  assert.equal(ok({ id: 'm', type: 'map', props: { label: 'Sites', markers: Array.from({ length: 501 }, () => ({ lngLat: [1, 2], label: 'A' })) } }), false);
});

test('map choropleth colours only host-declared regions from generated values', async () => {
  const { mapCatalog } = await import('../catalog.js');
  const square = (id: string, x: number) => ({ type: 'Feature' as const, properties: { code: id }, geometry: { type: 'Polygon', coordinates: [[[x, 0], [x + 1, 0], [x + 1, 1], [x, 1], [x, 0]]] } });
  const regions = { geojson: { type: 'FeatureCollection' as const, features: [square('north', 0), square('south', 2)] }, idProperty: 'code', palette: ['#eef', '#33a'] };
  assert.throws(() => mapCatalog(initialCatalog, { mapStyle: 'https://tiles.example.com/style.json', regions: { ...regions, idProperty: 'missing' } }), /unique string id/u);
  const catalog = mapCatalog(initialCatalog, { mapStyle: 'https://tiles.example.com/style.json', regions });
  const map = catalog.components['map']!;
  assert.match(map.useWhen!, /north, south/u);
  const ok = (props: Record<string, unknown>): boolean => validateView(view(catalog, { id: 'm', type: 'map', props: { label: 'Sales', ...props } } as LyraGenNode), catalog).ok;
  assert.equal(ok({ choropleth: { values: { north: 4, south: 10 } } }), true);
  assert.equal(ok({ choropleth: { values: { north: 4, south: 10, west: 1 } } }), false);
  assert.equal(ok({ choropleth: { values: {}, geojson: {} } }), false);
  const prepared = map.prepareProperties!({ label: 'Sales', choropleth: { values: { north: 4, south: 10 } } });
  const layer = prepared['choropleth'] as { sourceId: string; field: string; stops: unknown; geojson: { features: { properties: Record<string, unknown> }[] } };
  assert.equal(layer.field, 'value');
  assert.deepEqual(layer.stops, [[4, '#eef'], [10, '#33a']]);
  assert.deepEqual(layer.geojson.features.map(feature => [feature.properties['code'], feature.properties['value']]), [['north', 4], ['south', 10]]);
  assert.throws(() => map.prepareProperties!({ label: 'Sales', choropleth: { values: { east: 1 } } }), /declared regions/u);
  assert.equal(Object.hasOwn(mapCatalog(initialCatalog, { mapStyle: 'https://tiles.example.com/style.json' }).components['map']!.properties, 'choropleth'), false);
});
