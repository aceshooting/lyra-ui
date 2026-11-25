import { aTimeout, expect, fixture, html, oneEvent, waitUntil } from '@open-wc/testing';
import '../../lr-geojson-viewer.js';
import type { LyraMap } from '../../media/map/map.class.js';
import type { LyraGeoJsonViewer } from './geojson-viewer.class.js';

const FEATURES = {
  type: 'FeatureCollection',
  features: [
    { type: 'Feature', geometry: { type: 'Point', coordinates: [-122.42, 37.77] }, properties: { name: 'Depot' } },
    { type: 'Feature', geometry: { type: 'Point', coordinates: [-122.5, 37.8] }, properties: null },
  ],
};
const FETCHED = { type: 'Feature', geometry: { type: 'Point', coordinates: [1, 2] }, properties: { name: 'Fetched' } };
const INVALID = 'This file is not valid GeoJSON.';
const TOO_LARGE = 'This document is too large to preview.';

const OriginalObserver = window.IntersectionObserver;
const originalFetch = window.fetch;
let fetches = 0;

beforeEach(() => {
  // Keep the nested map visibility-gated: these tests cover admission, not map construction.
  window.IntersectionObserver = class extends OriginalObserver { override observe(): void {} };
  fetches = 0;
  window.fetch = (() => {
    fetches++;
    return Promise.resolve(new Response(JSON.stringify(FETCHED)));
  }) as typeof window.fetch;
});

afterEach(() => {
  window.IntersectionObserver = OriginalObserver;
  window.fetch = originalFetch;
});

const part = (el: LyraGeoJsonViewer, name: string): Element | null => el.shadowRoot!.querySelector(`[part="${name}"]`);

async function settled(el: LyraGeoJsonViewer): Promise<void> {
  await waitUntil(() => part(el, 'status') !== null || part(el, 'error') !== null || part(el, 'missing-library') !== null, 'viewer never settled', { timeout: 4000 });
}

async function withData(data: unknown, src = ''): Promise<LyraGeoJsonViewer> {
  const el = await fixture<LyraGeoJsonViewer>(html`<lr-geojson-viewer src=${src} .data=${data}></lr-geojson-viewer>`);
  await settled(el);
  return el;
}

async function rejection(data: unknown): Promise<string | null | undefined> {
  const el = await fixture<LyraGeoJsonViewer>(html`<lr-geojson-viewer></lr-geojson-viewer>`);
  const failure = oneEvent(el, 'lr-render-error');
  el.data = data;
  await failure;
  await el.updateComplete;
  return part(el, 'error')?.textContent;
}

describe('lr-geojson-viewer plain data', () => {
  it('renders a supplied FeatureCollection without fetching src and fires lr-load', async () => {
    const el = await fixture<LyraGeoJsonViewer>(html`<lr-geojson-viewer src="https://example.test/zones.geojson"></lr-geojson-viewer>`);
    await settled(el);
    expect(fetches).to.equal(1);
    const loaded = oneEvent(el, 'lr-load');
    el.data = FEATURES;
    await loaded;
    await waitUntil(() => part(el, 'metadata')?.textContent?.includes('Depot') === true);
    expect(part(el, 'status')!.textContent).to.include('2');
    expect(fetches).to.equal(1);
    const map = el.shadowRoot!.querySelector<LyraMap>('lr-map')!;
    expect(map.dataLayers[0]?.sourceId).to.equal('lr-geojson');
    const layer = map.dataLayers[0] as { geojson?: unknown } | undefined;
    expect(layer?.geojson === (FEATURES as unknown)).to.equal(false);
    el.src = 'https://example.test/other.geojson';
    await aTimeout(30);
    expect(fetches).to.equal(1);
    expect(part(el, 'metadata')!.textContent).to.include('Depot');
  });

  it('accepts a bare Feature and a bare geometry', async () => {
    const feature = await withData(FETCHED);
    expect(part(feature, 'metadata')!.textContent).to.include('Fetched');
    const geometry = await withData({ type: 'LineString', coordinates: [[0, 0], [1, 1]] });
    expect(part(geometry, 'metadata')!.textContent).to.include('LineString');
    expect(fetches).to.equal(0);
  });

  it('falls back to src once data is cleared, and supersedes an in-flight src load', async () => {
    let release!: (value: Response) => void;
    window.fetch = (() => {
      fetches++;
      return new Promise<Response>(resolve => { release = resolve; });
    }) as typeof window.fetch;
    const el = await fixture<LyraGeoJsonViewer>(html`<lr-geojson-viewer src="https://example.test/slow.geojson"></lr-geojson-viewer>`);
    await waitUntil(() => release !== undefined);
    el.data = FEATURES;
    await settled(el);
    release(new Response(JSON.stringify(FETCHED)));
    await aTimeout(30);
    expect(part(el, 'metadata')!.textContent).to.include('Depot');
    window.fetch = (() => {
      fetches++;
      return Promise.resolve(new Response(JSON.stringify(FETCHED)));
    }) as typeof window.fetch;
    el.data = null;
    await waitUntil(() => part(el, 'metadata')?.textContent?.includes('Fetched') === true, 'src did not resume', { timeout: 4000 });
    expect(fetches).to.equal(2);
  });

  it('rejects invalid shapes with the localized invalid-GeoJSON message', async () => {
    const cyclic: Record<string, unknown> = { type: 'Feature', geometry: null };
    cyclic['properties'] = { self: cyclic };
    const invalid: Array<[string, unknown]> = [
      ['non-GeoJSON object', { not: 'geojson' }],
      ['primitive', 'FeatureCollection'],
      ['array', [FETCHED]],
      ['unclosed ring', { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 1]]] }],
      ['out-of-range position', { type: 'Point', coordinates: [200, 0] }],
      ['non-finite coordinate', { type: 'Point', coordinates: [Number.NaN, 0] }],
      ['undefined member', { type: 'Point', coordinates: [0, 0], extra: undefined }],
      ['function member', { type: 'Point', coordinates: [0, 0], extra: () => 1 }],
      ['cyclic graph', cyclic],
      ['shared object reference', (() => { const point = { type: 'Point', coordinates: [0, 0] }; return { type: 'GeometryCollection', geometries: [point, point] }; })()],
    ];
    for (const [description, value] of invalid) {
      expect(await rejection(value), description).to.equal(INVALID);
    }
  });

  it('resolves the data rejection message through a .strings override', async () => {
    const el = await fixture<LyraGeoJsonViewer>(html`<lr-geojson-viewer .strings=${{ geojsonViewInvalid: 'Fichier GeoJSON invalide.' }}></lr-geojson-viewer>`);
    const failure = oneEvent(el, 'lr-render-error');
    el.data = { not: 'geojson' };
    await failure;
    await el.updateComplete;
    expect(part(el, 'error')!.textContent).to.equal('Fichier GeoJSON invalide.');
  });

  it('applies the same position, node, and depth ceilings as fetched content', async () => {
    let nested: Record<string, unknown> = { type: 'Point', coordinates: [0, 0] };
    for (let depth = 0; depth < 66; depth++) nested = { type: 'GeometryCollection', geometries: [nested] };
    const oversized: Array<[string, unknown]> = [
      ['positions', { type: 'MultiPoint', coordinates: Array.from({ length: 10_001 }, (_, index) => [index % 180, 0]) }],
      ['nodes', { type: 'FeatureCollection', features: Array.from({ length: 50_001 }, () => ({ type: 'Feature', geometry: null, properties: null })) }],
      ['depth', nested],
      ['text', { type: 'Feature', geometry: null, properties: { note: 'x'.repeat(2 * 1024 * 1024 + 1) } }],
    ];
    for (const [description, value] of oversized) {
      expect(await rejection(value), description).to.equal(TOO_LARGE);
    }
  });

  it('snapshots the supplied object without mutating it', async () => {
    const data = structuredClone(FEATURES);
    const el = await withData(data);
    expect(Object.isFrozen(data)).to.equal(false);
    data.features[0]!.properties = { name: 'Mutated' };
    el.requestUpdate();
    await el.updateComplete;
    expect(part(el, 'metadata')!.textContent).to.include('Depot');
    expect(part(el, 'metadata')!.textContent).to.not.include('Mutated');
  });

  it('keeps supplied data across reconnection and is accessible', async () => {
    const el = await withData(FEATURES);
    const parent = el.parentElement!;
    el.remove();
    parent.append(el);
    await settled(el);
    expect(part(el, 'metadata')!.textContent).to.include('Depot');
    expect(fetches).to.equal(0);
    expect(part(el, 'status')).to.not.equal(null);
    await expect(el).to.be.accessible();
  });
});
