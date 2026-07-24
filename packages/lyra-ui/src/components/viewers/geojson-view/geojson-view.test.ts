import { fixture, expect, html, oneEvent, waitUntil } from '@open-wc/testing';
import './geojson-view.js';
import type { LyraGeojsonView } from './geojson-view.js';
import { DEFAULT_MAX_RESOURCE_BYTES } from '../../../internal/resource-loader.js';
import { getDefaultDocumentRendererRegistry } from '../document-viewer/registry.js';
import type { LyraHighlight } from '../document-viewer/anchors.js';

const GEOJSON_URL = 'https://example.test/zones.geojson';

const FEATURE_COLLECTION = {
  type: 'FeatureCollection',
  features: [
    { type: 'Feature', geometry: { type: 'Point', coordinates: [-122.42, 37.77] }, properties: {} },
    { type: 'Feature', geometry: { type: 'Point', coordinates: [-122.5, 37.8] }, properties: {} },
  ],
};

const EMPTY_MAP_STYLE = { version: 8, sources: {}, layers: [] };
const OriginalIntersectionObserver = window.IntersectionObserver;
const testObservers = new WeakMap<Element, TestIntersectionObserver>();

class TestIntersectionObserver {
  constructor(private readonly callback: IntersectionObserverCallback) {}

  observe(target: Element): void {
    testObservers.set(target, this);
  }

  unobserve(): void {}
  disconnect(): void {}
  takeRecords(): IntersectionObserverEntry[] { return []; }

  reveal(target: Element): void {
    this.callback([{ target, isIntersecting: true } as IntersectionObserverEntry], this as unknown as IntersectionObserver);
  }
}

beforeEach(() => {
  (window as unknown as { IntersectionObserver: typeof IntersectionObserver }).IntersectionObserver =
    TestIntersectionObserver as unknown as typeof IntersectionObserver;
});

afterEach(() => {
  (window as unknown as { IntersectionObserver: typeof IntersectionObserver }).IntersectionObserver = OriginalIntersectionObserver;
});

async function useDeterministicMapStyle(el: LyraGeojsonView): Promise<void> {
  const map = el.shadowRoot!.querySelector('lr-map') as HTMLElement & {
    mapStyle: unknown;
    map?: unknown;
  } | null;
  if (!map) return;
  map.mapStyle = EMPTY_MAP_STYLE;
  await (map as unknown as { updateComplete: Promise<unknown> }).updateComplete;
  testObservers.get(map)?.reveal(map);
  await waitUntil(() => map.map != null, 'map never initialized with the deterministic test style', { timeout: 2000 });
}

function stubFetch(body: unknown, ok = true): void {
  (globalThis as { fetch: typeof fetch }).fetch = (() =>
    Promise.resolve(new Response(JSON.stringify(body), { status: ok ? 200 : 500 }))) as typeof fetch;
}

describe('fetching and parsing', () => {
  it('fetches, parses, and computes a feature count for a FeatureCollection', async () => {
    stubFetch(FEATURE_COLLECTION);
    const el = (await fixture(html`<lr-geojson-view src=${GEOJSON_URL}></lr-geojson-view>`)) as LyraGeojsonView;
    // `loadMaplibre()`'s real dynamic import of maplibre-gl takes well over a single
    // macrotask tick to settle in this test environment (measured ~300ms) -- poll for
    // the loaded-state marker rather than assuming one `setTimeout(0)` is enough, same
    // idiom `map.test.ts` already uses for this exact dependency.
    await waitUntil(
      () => el.shadowRoot!.querySelector('[part="status"]') != null,
      'geojson-view never reached the loaded state',
      { timeout: 2000 },
    );
    await useDeterministicMapStyle(el);
    const status = el.shadowRoot!.querySelector('[role="status"]');
    expect(status).to.exist;
    expect(status!.textContent).to.include('2');
  });

  it('formats the feature count with the effective locale', async () => {
    stubFetch(FEATURE_COLLECTION);
    const el = (await fixture(html`<lr-geojson-view lang="ar" src=${GEOJSON_URL}></lr-geojson-view>`)) as LyraGeojsonView;
    await waitUntil(() => el.shadowRoot!.querySelector('[part="status"]') != null, 'geojson-view never loaded', { timeout: 2000 });
    expect(el.shadowRoot!.querySelector('[part="status"]')!.textContent).to.include(new Intl.NumberFormat('ar').format(2));
  });

  it('fires lr-render-error and shows an error state for a non-GeoJSON shape', async () => {
    stubFetch({ not: 'geojson' });
    const el = (await fixture(html`<lr-geojson-view src=${GEOJSON_URL}></lr-geojson-view>`)) as LyraGeojsonView;
    const eventPromise = oneEvent(el, 'lr-render-error');
    await eventPromise;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[role="alert"]')).to.exist;
  });

  it('resolves the invalid-GeoJSON error message through a .strings override for geojsonViewInvalid', async () => {
    // The error path localizes before maplibre-gl is ever touched, so this
    // exercises the .strings resolution without the optional peer.
    stubFetch({ not: 'geojson' });
    const el = (await fixture(
      html`<lr-geojson-view
        src=${GEOJSON_URL}
        .strings=${{ geojsonViewInvalid: 'Fichier GeoJSON invalide.' }}
      ></lr-geojson-view>`,
    )) as LyraGeojsonView;
    const eventPromise = oneEvent(el, 'lr-render-error');
    await eventPromise;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[role="alert"]')!.textContent).to.equal('Fichier GeoJSON invalide.');
  });
});

describe('missing maplibre-gl peer', () => {
  it('falls back to lr-json-viewer and emits exactly one render error when loadMaplibre resolves null', async () => {
    stubFetch(FEATURE_COLLECTION);
    const el = (await fixture(html`<lr-geojson-view></lr-geojson-view>`)) as LyraGeojsonView;
    (el as unknown as { forceMissingMaplibreForTesting: boolean }).forceMissingMaplibreForTesting = true;
    let count = 0;
    el.addEventListener('lr-render-error', () => { count++; });
    const event = oneEvent(el, 'lr-render-error');
    el.src = GEOJSON_URL;
    await event;
    await waitUntil(() => el.shadowRoot!.querySelector('lr-json-viewer') !== null);
    expect(count).to.equal(1);
    expect(el.shadowRoot!.querySelector('lr-json-viewer')).to.exist;
    expect(el.shadowRoot!.querySelector('[part="missing-library"]')).to.exist;
  });

  it('suppresses undeclared composed events from the fallback JSON viewer', async () => {
    stubFetch(FEATURE_COLLECTION);
    const el = (await fixture(html`<lr-geojson-view></lr-geojson-view>`)) as LyraGeojsonView;
    (el as unknown as { forceMissingMaplibreForTesting: boolean }).forceMissingMaplibreForTesting = true;
    el.src = GEOJSON_URL;
    await waitUntil(() => el.shadowRoot!.querySelector('lr-json-viewer') !== null);
    const child = el.shadowRoot!.querySelector('lr-json-viewer')!;
    const leaked: string[] = [];
    el.addEventListener('lr-copy', () => leaked.push('lr-copy'));
    el.addEventListener('lr-search-change', () => leaked.push('lr-search-change'));
    child.dispatchEvent(new CustomEvent('lr-copy', { bubbles: true, composed: true }));
    child.dispatchEvent(new CustomEvent('lr-search-change', { bubbles: true, composed: true }));
    expect(leaked).to.deep.equal([]);
  });
});

describe('document renderer contract', () => {
  it('forwards anchor/highlights and advertises the implemented text capabilities', () => {
    const definition = getDefaultDocumentRendererRegistry().get('application/geo+json')!;
    const highlights: LyraHighlight[] = [{
      id: 'feature',
      anchor: { kind: 'text-quote', exact: 'feature' },
    }];
    const anchor = { kind: 'fragment' as const, id: 'feature' };
    const rendered = definition.render!({
      name: 'zones.geojson',
      mimeType: 'application/geo+json',
      src: GEOJSON_URL,
      anchor,
      highlights,
    }) as LyraGeojsonView;
    expect(rendered.anchor).to.equal(anchor);
    expect(rendered.highlights).to.equal(highlights);
    expect(definition.capabilities).to.deep.equal({
      anchors: ['text-quote', 'fragment'],
      search: true,
      textSelect: true,
    });
  });
});

describe('child map event ownership', () => {
  it('suppresses undeclared composed map events', async () => {
    stubFetch(FEATURE_COLLECTION);
    const el = (await fixture(html`<lr-geojson-view src=${GEOJSON_URL}></lr-geojson-view>`)) as LyraGeojsonView;
    await waitUntil(() => el.shadowRoot!.querySelector('lr-map') !== null, 'map branch never rendered', { timeout: 2000 });
    const child = el.shadowRoot!.querySelector('lr-map')!;
    const leaked: string[] = [];
    el.addEventListener('lr-map-load', () => leaked.push('lr-map-load'));
    el.addEventListener('lr-map-click', () => leaked.push('lr-map-click'));
    child.dispatchEvent(new CustomEvent('lr-map-load', { bubbles: true, composed: true }));
    child.dispatchEvent(new CustomEvent('lr-map-click', { bubbles: true, composed: true }));
    expect(leaked).to.deep.equal([]);
  });
});

describe('aria-label forwarding', () => {
  it('forwards a host aria-label to [part="base"], winning over the localized default', async () => {
    const el = (await fixture(
      html`<lr-geojson-view aria-label="Zones"></lr-geojson-view>`,
    )) as LyraGeojsonView;
    expect(el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal('Zones');
  });

  it('lets a host aria-label override the name property', async () => {
    const el = (await fixture(
      html`<lr-geojson-view name="Named zones" aria-label="Zones"></lr-geojson-view>`,
    )) as LyraGeojsonView;
    const base = el.shadowRoot!.querySelector('[part="base"]')!;
    expect(base.getAttribute('aria-label')).to.equal('Zones');
    expect(base.getAttribute('role')).to.equal('region');
  });

  it('forwards the host aria-label to the nested map role owner', async () => {
    stubFetch(FEATURE_COLLECTION);
    const el = (await fixture(html`<lr-geojson-view name="Named zones" aria-label="Host zones" src=${GEOJSON_URL}></lr-geojson-view>`)) as LyraGeojsonView;
    await waitUntil(() => el.shadowRoot!.querySelector('lr-map') !== null, 'map branch never rendered', { timeout: 2000 });
    expect(el.shadowRoot!.querySelector('lr-map')!.getAttribute('label')).to.equal('Host zones');
  });
});

describe('accessibility', () => {
  it('is accessible once loaded', async () => {
    stubFetch(FEATURE_COLLECTION);
    const el = (await fixture(
      html`<lr-geojson-view src=${GEOJSON_URL} name="zones.geojson"></lr-geojson-view>`,
    )) as LyraGeojsonView;
    await waitUntil(
      () => el.shadowRoot!.querySelector('[part="status"]') != null,
      'geojson-view never reached the loaded state',
      { timeout: 2000 },
    );
    await useDeterministicMapStyle(el);
    await expect(el).to.be.accessible();
  });
});

describe('GeoJSON shape validation and coordinate extraction', () => {
  it('rejects a top-level JSON value that is not an object (a bare primitive) as invalid GeoJSON', async () => {
    stubFetch(42); // JSON.parse('42') === 42, a number -- typeof !== 'object'
    const el = (await fixture(html`<lr-geojson-view src=${GEOJSON_URL}></lr-geojson-view>`)) as LyraGeojsonView;
    const eventPromise = oneEvent(el, 'lr-render-error');
    await eventPromise;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[role="alert"]')!.textContent).to.equal('This file is not valid GeoJSON.');
  });

  it('rejects top-level JSON null as invalid GeoJSON', async () => {
    stubFetch(null); // JSON.parse('null') === null
    const el = (await fixture(html`<lr-geojson-view src=${GEOJSON_URL}></lr-geojson-view>`)) as LyraGeojsonView;
    const eventPromise = oneEvent(el, 'lr-render-error');
    await eventPromise;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[role="alert"]')!.textContent).to.equal('This file is not valid GeoJSON.');
  });

  it('treats a bare Feature (not wrapped in a FeatureCollection) as a single feature and fits the view to its geometry', async () => {
    stubFetch({ type: 'Feature', geometry: { type: 'Point', coordinates: [10, 20] }, properties: {} });
    const el = (await fixture(html`<lr-geojson-view src=${GEOJSON_URL}></lr-geojson-view>`)) as LyraGeojsonView;
    await waitUntil(
      () => el.shadowRoot!.querySelector('[part="status"]') != null,
      'geojson-view never reached the loaded state',
      { timeout: 2000 },
    );
    expect(el.shadowRoot!.querySelector('[role="status"]')!.textContent).to.equal('1 feature');
    const map = el.shadowRoot!.querySelector('lr-map') as HTMLElement & { center: [number, number]; zoom: number };
    expect(map.center).to.deep.equal([10, 20]);
    expect(map.zoom).to.equal(18);
  });

  it('treats a bare geometry (not a Feature or FeatureCollection) as a single feature and fits the view to it', async () => {
    stubFetch({ type: 'Point', coordinates: [5, 6] });
    const el = (await fixture(html`<lr-geojson-view src=${GEOJSON_URL}></lr-geojson-view>`)) as LyraGeojsonView;
    await waitUntil(
      () => el.shadowRoot!.querySelector('[part="status"]') != null,
      'geojson-view never reached the loaded state',
      { timeout: 2000 },
    );
    expect(el.shadowRoot!.querySelector('[role="status"]')!.textContent).to.equal('1 feature');
    const map = el.shadowRoot!.querySelector('lr-map') as HTMLElement & { center: [number, number]; zoom: number };
    expect(map.center).to.deep.equal([5, 6]);
    expect(map.zoom).to.equal(18);
  });

  it("flattens a top-level GeometryCollection's nested geometries when computing the bounding box", async () => {
    stubFetch({
      type: 'GeometryCollection',
      geometries: [
        { type: 'Point', coordinates: [1, 2] },
        { type: 'LineString', coordinates: [[3, 4], [5, 6]] },
      ],
    });
    const el = (await fixture(html`<lr-geojson-view src=${GEOJSON_URL}></lr-geojson-view>`)) as LyraGeojsonView;
    await waitUntil(
      () => el.shadowRoot!.querySelector('[part="status"]') != null,
      'geojson-view never reached the loaded state',
      { timeout: 2000 },
    );
    const map = el.shadowRoot!.querySelector('lr-map') as HTMLElement & { center: [number, number]; zoom: number };
    // bbox spans lng [1,5] / lat [2,6] across the Point plus both LineString vertices.
    expect(map.center).to.deep.equal([3, 4]);
    expect(map.zoom).to.equal(5);
  });

  it('rejects a Feature with no geometry member', async () => {
    stubFetch({ type: 'Feature', properties: { name: 'Empty' } });
    const el = (await fixture(html`<lr-geojson-view src=${GEOJSON_URL}></lr-geojson-view>`)) as LyraGeojsonView;
    await waitUntil(() => el.shadowRoot!.querySelector('[role="alert"]') !== null);
    expect(el.shadowRoot!.querySelector('[role="alert"]')!.textContent).to.equal('This file is not valid GeoJSON.');
  });

  it('rejects a FeatureCollection with no features array', async () => {
    stubFetch({ type: 'FeatureCollection' });
    const el = (await fixture(html`<lr-geojson-view src=${GEOJSON_URL}></lr-geojson-view>`)) as LyraGeojsonView;
    await waitUntil(() => el.shadowRoot!.querySelector('[role="alert"]') !== null);
    expect(el.shadowRoot!.querySelector('[role="alert"]')!.textContent).to.equal('This file is not valid GeoJSON.');
  });

  it('rejects malformed coordinate shapes and enforces a coordinate ceiling', async () => {
    stubFetch({ type: 'Point', coordinates: [10] });
    const malformed = (await fixture(html`<lr-geojson-view src=${GEOJSON_URL}></lr-geojson-view>`)) as LyraGeojsonView;
    await waitUntil(() => malformed.shadowRoot!.querySelector('[role="alert"]') !== null);

    stubFetch({ type: 'MultiPoint', coordinates: Array.from({ length: 10001 }, (_unused, index) => [index % 180, 0]) });
    const oversized = (await fixture(html`<lr-geojson-view src=${GEOJSON_URL}></lr-geojson-view>`)) as LyraGeojsonView;
    await waitUntil(() => oversized.shadowRoot!.querySelector('[role="alert"]') !== null);
    expect(oversized.shadowRoot!.querySelector('[role="alert"]')!.textContent).to.equal('This document is too large to preview.');
  });

  it('accepts a MultiPoint containing a single valid position', async () => {
    stubFetch({ type: 'MultiPoint', coordinates: [[10, 20]] });
    const el = (await fixture(html`<lr-geojson-view src=${GEOJSON_URL}></lr-geojson-view>`)) as LyraGeojsonView;
    await waitUntil(() => el.shadowRoot!.querySelector('lr-map') !== null, 'single-point MultiPoint was rejected', { timeout: 2000 });
  });

  it('accepts every bounded GeoJSON geometry shape in a FeatureCollection', async () => {
    stubFetch({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: null,
          geometry: { type: 'LineString', coordinates: [[0, 0], [1, 1]] },
        },
        {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'Polygon',
            coordinates: [[[0, 0], [2, 0], [2, 2], [0, 0]]],
          },
        },
        {
          type: 'Feature',
          properties: {},
          geometry: { type: 'MultiPoint', coordinates: [[3, 3], [4, 4]] },
        },
        {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'MultiLineString',
            coordinates: [[[5, 5], [6, 6]], [[7, 7], [8, 8]]],
          },
        },
        {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'MultiPolygon',
            coordinates: [[[[9, 9], [10, 9], [10, 10], [9, 9]]]],
          },
        },
        {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'GeometryCollection',
            geometries: [{ type: 'Point', coordinates: [11, 11] }],
          },
        },
      ],
    });
    const el = (await fixture(html`<lr-geojson-view></lr-geojson-view>`)) as LyraGeojsonView;
    (el as unknown as { forceMissingMaplibreForTesting: boolean }).forceMissingMaplibreForTesting = true;
    const missingPeer = oneEvent(el, 'lr-render-error');
    el.src = GEOJSON_URL;
    await missingPeer;
    await waitUntil(() => el.shadowRoot!.querySelector('lr-json-viewer') !== null);
    expect((el as unknown as {
      loadState: { kind: string; featureCount?: number };
    }).loadState.featureCount).to.equal(6);
  });

  it('accepts a Feature with null geometry and uses the world fallback view', async () => {
    stubFetch({ type: 'Feature', properties: null, geometry: null });
    const el = (await fixture(html`<lr-geojson-view></lr-geojson-view>`)) as LyraGeojsonView;
    (el as unknown as { forceMissingMaplibreForTesting: boolean }).forceMissingMaplibreForTesting = true;
    const missingPeer = oneEvent(el, 'lr-render-error');
    el.src = GEOJSON_URL;
    await missingPeer;
    await waitUntil(() => el.shadowRoot!.querySelector('lr-json-viewer') !== null);
    const state = (el as unknown as {
      loadState: { kind: string; center?: [number, number]; zoom?: number };
    }).loadState;
    expect(state.center).to.deep.equal([0, 0]);
    expect(state.zoom).to.equal(1);
  });

  it('rejects malformed members, coordinate types, bounds, and polygon rings', async () => {
    const malformed: Array<[string, unknown]> = [
      ['missing type', { coordinates: [0, 0] }],
      ['non-string type', { type: 42, coordinates: [0, 0] }],
      ['unknown type', { type: 'Circle', coordinates: [0, 0] }],
      ['missing coordinates', { type: 'Point' }],
      ['non-finite coordinate', { type: 'Point', coordinates: [Number.POSITIVE_INFINITY, 0] }],
      ['non-number coordinate', { type: 'Point', coordinates: ['0', 0] }],
      ['longitude out of bounds', { type: 'Point', coordinates: [181, 0] }],
      ['latitude out of bounds', { type: 'Point', coordinates: [0, -91] }],
      ['short line', { type: 'LineString', coordinates: [[0, 0]] }],
      ['short polygon ring', {
        type: 'Polygon',
        coordinates: [[[0, 0], [1, 0], [0, 0]]],
      }],
      ['open polygon ring', {
        type: 'Polygon',
        coordinates: [[[0, 0], [1, 0], [1, 1], [0, 1]]],
      }],
      ['invalid feature properties', {
        type: 'Feature',
        geometry: null,
        properties: [],
      }],
      ['feature inside a geometry', {
        type: 'GeometryCollection',
        geometries: [{ type: 'Feature', geometry: null, properties: {} }],
      }],
      ['feature collection inside a geometry', {
        type: 'GeometryCollection',
        geometries: [{ type: 'FeatureCollection', features: [] }],
      }],
      ['non-feature collection member', {
        type: 'FeatureCollection',
        features: [{ type: 'Point', coordinates: [0, 0] }],
      }],
      ['non-array geometries', { type: 'GeometryCollection', geometries: {} }],
      ['non-array multi-line', { type: 'MultiLineString', coordinates: {} }],
      ['non-array multi-polygon', { type: 'MultiPolygon', coordinates: {} }],
    ];

    for (const [description, value] of malformed) {
      stubFetch(value);
      const el = (await fixture(
        html`<lr-geojson-view src=${GEOJSON_URL}></lr-geojson-view>`,
      )) as LyraGeojsonView;
      await waitUntil(
        () => el.shadowRoot!.querySelector('[role="alert"]') !== null,
        description,
      );
      expect(
        el.shadowRoot!.querySelector('[role="alert"]')?.textContent,
        description,
      ).to.equal('This file is not valid GeoJSON.');
    }
  });

  it('enforces nested-value and nesting-depth ceilings before map rendering', async () => {
    const oversizedPositions = Array.from(
      { length: 50_001 },
      (_unused, index) => [index % 180, 0],
    );
    const values: Array<[string, unknown]> = [
      ['coordinate task ceiling', { type: 'MultiPoint', coordinates: oversizedPositions }],
      ['feature task ceiling', {
        type: 'FeatureCollection',
        features: Array.from({ length: 50_001 }, () => ({
          type: 'Feature',
          geometry: null,
          properties: null,
        })),
      }],
    ];
    let nested: Record<string, unknown> = { type: 'Point', coordinates: [0, 0] };
    for (let depth = 0; depth < 66; depth++) {
      nested = { type: 'GeometryCollection', geometries: [nested] };
    }
    values.push(['nesting depth ceiling', nested]);

    for (const [description, value] of values) {
      stubFetch(value);
      const el = (await fixture(
        html`<lr-geojson-view src=${GEOJSON_URL}></lr-geojson-view>`,
      )) as LyraGeojsonView;
      await waitUntil(
        () => el.shadowRoot!.querySelector('[role="alert"]') !== null,
        description,
      );
      expect(
        el.shadowRoot!.querySelector('[role="alert"]')?.textContent,
        description,
      ).to.equal('This document is too large to preview.');
    }
  });

  it('fits dateline-crossing coordinates across the short antimeridian span', async () => {
    stubFetch({ type: 'MultiPoint', coordinates: [[179, 10], [-179, 12]] });
    const el = (await fixture(html`<lr-geojson-view src=${GEOJSON_URL}></lr-geojson-view>`)) as LyraGeojsonView;
    await waitUntil(() => el.shadowRoot!.querySelector('lr-map') !== null, 'map branch never rendered', { timeout: 2000 });
    const map = el.shadowRoot!.querySelector('lr-map') as HTMLElement & { center: [number, number]; zoom: number };
    expect(Math.abs(Math.abs(map.center[0]) - 180)).to.be.lessThan(0.001);
    expect(map.zoom).to.be.greaterThan(5);
  });
});

describe('fetch lifecycle edge cases', () => {
  it('shows a URL-not-allowed error without fetching and emits exactly one render error', async () => {
    const original = (globalThis as { fetch: typeof fetch }).fetch;
    let fetchCalled = false;
    (globalThis as { fetch: typeof fetch }).fetch = ((..._args: unknown[]) => {
      fetchCalled = true;
      return Promise.reject(new Error('fetch must not be called for a disallowed URL scheme'));
    }) as typeof fetch;
    try {
      const el = (await fixture(html`<lr-geojson-view></lr-geojson-view>`)) as LyraGeojsonView;
      let renderErrorCount = 0;
      el.addEventListener('lr-render-error', () => { renderErrorCount++; });
      const event = oneEvent(el, 'lr-render-error');
      el.src = 'javascript:alert(1)';
      await event;
      await waitUntil(
        () => el.shadowRoot!.querySelector('[role="alert"]') != null,
        'the disallowed URL never produced an error state',
      );
      expect(el.shadowRoot!.querySelector('[role="alert"]')!.textContent).to.equal('Document URL is not allowed.');
      expect(fetchCalled, 'fetch must never be invoked for a rejected URL').to.equal(false);
      expect(renderErrorCount).to.equal(1);
    } finally {
      (globalThis as { fetch: typeof fetch }).fetch = original;
    }
  });

  it('reloads an already-loaded source after reconnecting', async () => {
    const original = (globalThis as { fetch: typeof fetch }).fetch;
    let calls = 0;
    (globalThis as { fetch: typeof fetch }).fetch = (() => {
      calls++;
      return Promise.resolve(new Response(JSON.stringify(FEATURE_COLLECTION), { status: 200 }));
    }) as typeof fetch;
    try {
      const el = (await fixture(html`<lr-geojson-view src=${GEOJSON_URL}></lr-geojson-view>`)) as LyraGeojsonView;
      await waitUntil(() => calls === 1 && el.shadowRoot!.querySelector('[part="status"]') !== null, 'initial load failed', { timeout: 2000 });
      const parent = el.parentElement!;
      el.remove();
      parent.append(el);
      await waitUntil(() => calls === 2);
    } finally { (globalThis as { fetch: typeof fetch }).fetch = original; }
  });

  it('shows the generic invalid-GeoJSON error and fires lr-render-error for a non-2xx fetch response', async () => {
    stubFetch(FEATURE_COLLECTION, false);
    // The non-2xx path throws immediately after the fetch settles (no readResponseText/JSON.parse
    // await chain in between), so the event listener must be attached before `src` is set -- setting
    // it as part of the fixture template risks the event firing before oneEvent() can attach.
    const el = (await fixture(html`<lr-geojson-view></lr-geojson-view>`)) as LyraGeojsonView;
    const eventPromise = oneEvent(el, 'lr-render-error');
    el.src = GEOJSON_URL;
    const event = (await eventPromise) as CustomEvent<{ error: unknown }>;
    expect(event.detail.error).to.be.instanceOf(Error);
    expect((event.detail.error as Error).message).to.include('500');
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[role="alert"]')!.textContent).to.equal('This file is not valid GeoJSON.');
  });

  it('reports a resource-too-large error for an oversized response instead of the generic invalid-GeoJSON error', async () => {
    const original = (globalThis as { fetch: typeof fetch }).fetch;
    (globalThis as { fetch: typeof fetch }).fetch = (() =>
      Promise.resolve({
        ok: true,
        status: 200,
        statusText: 'OK',
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(1)),
        headers: { get: (name: string) => (name.toLowerCase() === 'content-length' ? String(DEFAULT_MAX_RESOURCE_BYTES + 1) : null) },
      } as unknown as Response)) as typeof fetch;
    try {
      // Same ordering concern as the non-2xx test above: the content-length check throws right
      // after the fetch settles, so attach the listener before triggering the load.
      const el = (await fixture(html`<lr-geojson-view></lr-geojson-view>`)) as LyraGeojsonView;
      const eventPromise = oneEvent(el, 'lr-render-error');
      el.src = GEOJSON_URL;
      await eventPromise;
      await el.updateComplete;
      expect(el.shadowRoot!.querySelector('[role="alert"]')!.textContent).to.equal('This document is too large to preview.');
    } finally {
      (globalThis as { fetch: typeof fetch }).fetch = original;
    }
  });

  it('drops an aborted in-flight fetch without surfacing an error, once a newer src supersedes it', async () => {
    const original = (globalThis as { fetch: typeof fetch }).fetch;
    const signals: (AbortSignal | undefined)[] = [];
    (globalThis as { fetch: typeof fetch }).fetch = ((_url: string, init?: RequestInit) => {
      signals.push(init?.signal ?? undefined);
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          const error = new Error('The operation was aborted.');
          error.name = 'AbortError';
          reject(error);
        });
      });
    }) as typeof fetch;
    try {
      const el = (await fixture(html`<lr-geojson-view src="https://example.test/first.geojson"></lr-geojson-view>`)) as LyraGeojsonView;
      await waitUntil(() => signals.length === 1, 'the first fetch never started');
      let renderErrorFired = false;
      el.addEventListener('lr-render-error', () => { renderErrorFired = true; });
      el.src = 'https://example.test/second.geojson'; // aborts the first fetch via beginAbortableLoad()
      await waitUntil(() => signals[0]?.aborted === true, 'the first request should have been aborted');
      await new Promise((resolve) => setTimeout(resolve, 20));
      expect(renderErrorFired, 'an aborted load must not surface as a render error').to.equal(false);
      expect(el.shadowRoot!.querySelector('[role="alert"]'), 'an aborted load must not render an error region').to.not.exist;
    } finally {
      (globalThis as { fetch: typeof fetch }).fetch = original;
    }
  });

  it('ignores a stale successful response once a newer src has superseded it (fetch-completion generation guard)', async () => {
    const original = (globalThis as { fetch: typeof fetch }).fetch;
    const resolvers: Array<(response: Response) => void> = [];
    (globalThis as { fetch: typeof fetch }).fetch = ((..._args: unknown[]) =>
      new Promise<Response>((resolve) => { resolvers.push(resolve); })) as typeof fetch;
    try {
      const el = (await fixture(html`<lr-geojson-view src="https://example.test/stale.geojson"></lr-geojson-view>`)) as LyraGeojsonView;
      await waitUntil(() => resolvers.length === 1, 'the first fetch never started');
      el.src = 'https://example.test/fresh.geojson';
      await waitUntil(() => resolvers.length === 2, 'the second fetch never started');
      // Resolve the newer (second) request first and let it fully settle into the loaded state.
      resolvers[1](new Response(JSON.stringify(FEATURE_COLLECTION), { status: 200 }));
      await waitUntil(
        () => el.shadowRoot!.querySelector('[part="status"]') != null,
        'the newer request never reached the loaded state',
        { timeout: 2000 },
      );
      const statusBefore = el.shadowRoot!.querySelector('[role="status"]')!.textContent;
      // Now resolve the stale (first, superseded) request; its captured generation no longer
      // matches, so it must be dropped instead of overwriting the newer loaded state.
      resolvers[0](new Response(JSON.stringify({ not: 'geojson' }), { status: 200 }));
      await new Promise((resolve) => setTimeout(resolve, 20));
      expect(el.shadowRoot!.querySelector('[role="alert"]'), 'the stale response must not overwrite the newer loaded state with an error').to.not.exist;
      expect(el.shadowRoot!.querySelector('[role="status"]')!.textContent).to.equal(statusBefore);
    } finally {
      (globalThis as { fetch: typeof fetch }).fetch = original;
    }
  });

  it('omits the fetch AbortSignal when AbortController is unavailable in the environment', async () => {
    const originalAbortController = (globalThis as { AbortController?: typeof AbortController }).AbortController;
    const originalFetch = (globalThis as { fetch: typeof fetch }).fetch;
    let fetchCalled = false;
    let observedSignal: AbortSignal | undefined;
    (globalThis as { fetch: typeof fetch }).fetch = ((_url: string, init?: RequestInit) => {
      fetchCalled = true;
      observedSignal = init?.signal;
      return new Promise<Response>(() => {}); // the assertion only needs the call shape, not the resolution
    }) as typeof fetch;
    (globalThis as { AbortController?: typeof AbortController }).AbortController = undefined;
    try {
      await fixture(html`<lr-geojson-view src=${GEOJSON_URL}></lr-geojson-view>`);
      await waitUntil(() => fetchCalled, 'fetch was never called');
      expect(observedSignal).to.equal(undefined);
    } finally {
      (globalThis as { fetch: typeof fetch }).fetch = originalFetch;
      (globalThis as { AbortController?: typeof AbortController }).AbortController = originalAbortController;
    }
  });
});
