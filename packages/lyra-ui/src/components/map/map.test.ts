import { fixture, expect, html, waitUntil } from '@open-wc/testing';
import './map.js';
import type { LyraMap } from './map.js';

const RASTER_STYLE = {
  version: 8,
  sources: {
    demo: {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
    },
  },
  layers: [{ id: 'demo', type: 'raster', source: 'demo' }],
};

it('constructs a maplibregl.Map and exposes it via the map getter', async () => {
  const el = (await fixture(html`<lyra-map></lyra-map>`)) as LyraMap;
  el.mapStyle = RASTER_STYLE;
  await el.updateComplete;
  await waitUntil(() => el.map != null, 'map never initialized', { timeout: 2000 });
  expect(el.map).to.exist;
});

it('fires lyra-map-load once the underlying map loads', async () => {
  const el = (await fixture(html`<lyra-map></lyra-map>`)) as LyraMap;
  el.mapStyle = RASTER_STYLE;
  await el.updateComplete;
  await waitUntil(() => el.map != null, 'map never initialized', { timeout: 2000 });
  let fired = false;
  el.addEventListener('lyra-map-load', () => (fired = true));
  el.map!.fire('load');
  expect(fired).to.be.true;
});

it('renders a legend swatch per entry', async () => {
  const el = (await fixture(html`<lyra-map></lyra-map>`)) as LyraMap;
  el.legend = [
    { color: '#f00', label: 'High' },
    { color: '#0f0', label: 'Low' },
  ];
  await el.updateComplete;
  expect(el.shadowRoot!.querySelectorAll('[part="legend-swatch"]').length).to.equal(2);
});

it('does not render the legend panel when legend is empty (the default)', async () => {
  const el = (await fixture(html`<lyra-map></lyra-map>`)) as LyraMap;
  await el.updateComplete;
  // A Lit template's own whitespace/comment nodes mean `[part="legend"]:empty` in CSS
  // never matches (it always has child nodes), so the panel must be omitted from the
  // render output entirely rather than hidden via an `:empty` selector.
  expect(el.shadowRoot!.querySelector('[part="legend"]')).to.not.exist;
});

it('renders the legend panel once entries are set, and removes it again once cleared', async () => {
  const el = (await fixture(html`<lyra-map></lyra-map>`)) as LyraMap;
  el.legend = [{ color: '#f00', label: 'High' }];
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="legend"]')).to.exist;

  el.legend = [];
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="legend"]')).to.not.exist;
});

it('is accessible', async () => {
  const el = (await fixture(html`<lyra-map></lyra-map>`)) as LyraMap;
  el.mapStyle = RASTER_STYLE;
  await el.updateComplete;
  await waitUntil(() => el.map != null, 'map never initialized', { timeout: 2000 });
  await expect(el).to.be.accessible();
});

function choropleth(sourceId: string, stops: [number, string][]) {
  return {
    sourceId,
    field: 'value',
    stops,
    geojson: {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          id: 1,
          properties: { value: 5 },
          geometry: { type: 'Point', coordinates: [0, 0] },
        },
      ],
    },
  } as unknown as import('./map.js').ChoroplethLayer;
}

it('adds a choropleth source + fill layer, and re-applies the color expression on update', async () => {
  const el = (await fixture(html`<lyra-map></lyra-map>`)) as LyraMap;
  el.mapStyle = RASTER_STYLE;
  await el.updateComplete;
  await waitUntil(() => el.map != null, 'map never initialized', { timeout: 2000 });
  await waitUntil(() => el.map!.isStyleLoaded(), 'style never loaded', { timeout: 2000 });

  el.choropleth = choropleth('demo-choropleth', [
    [0, '#000000'],
    [10, '#ffffff'],
  ]);
  await el.updateComplete;
  await waitUntil(() => el.map!.getLayer('demo-choropleth-fill') != null, 'layer never added', {
    timeout: 2000,
  });

  expect(el.map!.getSource('demo-choropleth')).to.exist;
  expect(el.map!.getPaintProperty('demo-choropleth-fill', 'fill-color')).to.deep.equal([
    'interpolate',
    ['linear'],
    ['get', 'value'],
    0,
    '#000000',
    10,
    '#ffffff',
  ]);

  // Same sourceId, different stops — the fill-color expression must be re-applied,
  // not just the underlying GeoJSON data.
  el.choropleth = choropleth('demo-choropleth', [
    [0, '#111111'],
    [10, '#eeeeee'],
  ]);
  await el.updateComplete;
  await waitUntil(
    () => {
      const expr = el.map!.getPaintProperty('demo-choropleth-fill', 'fill-color') as unknown[];
      return expr[4] === '#111111';
    },
    'fill-color expression never updated',
    { timeout: 2000 },
  );

  expect(el.map!.getPaintProperty('demo-choropleth-fill', 'fill-color')).to.deep.equal([
    'interpolate',
    ['linear'],
    ['get', 'value'],
    0,
    '#111111',
    10,
    '#eeeeee',
  ]);
});

it('fires lyra-map-click with the lngLat and no feature when there is no choropleth', async () => {
  const el = (await fixture(html`<lyra-map></lyra-map>`)) as LyraMap;
  el.mapStyle = RASTER_STYLE;
  await el.updateComplete;
  await waitUntil(() => el.map != null, 'map never initialized', { timeout: 2000 });

  let detail: { lngLat: [number, number]; feature?: unknown } | undefined;
  el.addEventListener('lyra-map-click', (e) => (detail = (e as CustomEvent).detail));
  el.map!.fire('click', { lngLat: { lng: 1, lat: 2 }, point: { x: 0, y: 0 } });

  expect(detail).to.exist;
  expect(detail!.lngLat).to.deep.equal([1, 2]);
  expect(detail!.feature).to.be.undefined;
});

it('attaches the clicked choropleth feature to lyra-map-click when one exists at the point', async () => {
  const el = (await fixture(html`<lyra-map></lyra-map>`)) as LyraMap;
  el.mapStyle = RASTER_STYLE;
  await el.updateComplete;
  await waitUntil(() => el.map != null, 'map never initialized', { timeout: 2000 });
  await waitUntil(() => el.map!.isStyleLoaded(), 'style never loaded', { timeout: 2000 });

  el.choropleth = choropleth('click-choropleth', [
    [0, '#000000'],
    [10, '#ffffff'],
  ]);
  await el.updateComplete;
  await waitUntil(() => el.map!.getLayer('click-choropleth-fill') != null, 'layer never added', {
    timeout: 2000,
  });

  // queryRenderedFeatures requires the layer to actually be painted on screen,
  // which real raster/vector tiles aren't guaranteed to be in a headless test —
  // stub it to deterministically simulate a hit under the click point.
  const fakeFeature = {
    type: 'Feature',
    properties: { value: 5 },
    geometry: { type: 'Point', coordinates: [0, 0] },
  };
  el.map!.queryRenderedFeatures = (() => [fakeFeature]) as typeof el.map.queryRenderedFeatures;

  let detail: { lngLat: [number, number]; feature?: unknown } | undefined;
  el.addEventListener('lyra-map-click', (e) => (detail = (e as CustomEvent).detail));
  el.map!.fire('click', { lngLat: { lng: 3, lat: 4 }, point: { x: 10, y: 10 } });

  expect(detail).to.exist;
  expect(detail!.lngLat).to.deep.equal([3, 4]);
  expect(detail!.feature).to.equal(fakeFeature);
});

it('does not query the choropleth fill layer on click before it has been added to the style', async () => {
  const el = (await fixture(html`<lyra-map></lyra-map>`)) as LyraMap;
  el.mapStyle = RASTER_STYLE;
  // Set choropleth immediately — before the map's 'load' event has fired — so
  // applyChoropleth() hasn't run yet and the `-fill` layer doesn't exist.
  el.choropleth = choropleth('early-choropleth', [
    [0, '#000000'],
    [10, '#ffffff'],
  ]);
  await el.updateComplete;
  await waitUntil(() => el.map != null, 'map never initialized', { timeout: 2000 });
  expect(el.map!.getLayer('early-choropleth-fill')).to.not.exist;

  let queried = false;
  const original = el.map!.queryRenderedFeatures.bind(el.map);
  el.map!.queryRenderedFeatures = ((...args: Parameters<typeof original>) => {
    queried = true;
    return original(...args);
  }) as typeof el.map.queryRenderedFeatures;

  let detail: { lngLat: [number, number]; feature?: unknown } | undefined;
  el.addEventListener('lyra-map-click', (e) => (detail = (e as CustomEvent).detail));
  el.map!.fire('click', { lngLat: { lng: 5, lat: 6 }, point: { x: 0, y: 0 } });

  // Querying a layer id that doesn't exist yet in the style fires a maplibre-gl
  // error event; the click handler must check the layer exists first instead.
  expect(queried).to.be.false;
  expect(detail).to.exist;
  expect(detail!.feature).to.be.undefined;
});
