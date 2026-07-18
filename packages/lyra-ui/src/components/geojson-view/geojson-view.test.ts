import { fixture, expect, html, oneEvent, waitUntil } from '@open-wc/testing';
import './geojson-view.js';
import type { LyraGeojsonView } from './geojson-view.js';

const GEOJSON_URL = 'https://example.test/zones.geojson';

const FEATURE_COLLECTION = {
  type: 'FeatureCollection',
  features: [
    { type: 'Feature', geometry: { type: 'Point', coordinates: [-122.42, 37.77] }, properties: {} },
    { type: 'Feature', geometry: { type: 'Point', coordinates: [-122.5, 37.8] }, properties: {} },
  ],
};

function stubFetch(body: unknown, ok = true): void {
  (globalThis as { fetch: typeof fetch }).fetch = (() =>
    Promise.resolve(new Response(JSON.stringify(body), { status: ok ? 200 : 500 }))) as typeof fetch;
}

describe('fetching and parsing', () => {
  it('fetches, parses, and computes a feature count for a FeatureCollection', async () => {
    stubFetch(FEATURE_COLLECTION);
    const el = (await fixture(html`<lyra-geojson-view src=${GEOJSON_URL}></lyra-geojson-view>`)) as LyraGeojsonView;
    // `loadMaplibre()`'s real dynamic import of maplibre-gl takes well over a single
    // macrotask tick to settle in this test environment (measured ~300ms) -- poll for
    // the loaded-state marker rather than assuming one `setTimeout(0)` is enough, same
    // idiom `map.test.ts` already uses for this exact dependency.
    await waitUntil(
      () => el.shadowRoot!.querySelector('[part="status"]') != null,
      'geojson-view never reached the loaded state',
      { timeout: 2000 },
    );
    const status = el.shadowRoot!.querySelector('[role="status"]');
    expect(status).to.exist;
    expect(status!.textContent).to.include('2');
  });

  it('fires lyra-render-error and shows an error state for a non-GeoJSON shape', async () => {
    stubFetch({ not: 'geojson' });
    const el = (await fixture(html`<lyra-geojson-view src=${GEOJSON_URL}></lyra-geojson-view>`)) as LyraGeojsonView;
    const eventPromise = oneEvent(el, 'lyra-render-error');
    await eventPromise;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[role="alert"]')).to.exist;
  });

  it('resolves the invalid-GeoJSON error message through a .strings override for geojsonViewInvalid', async () => {
    // The error path localizes before maplibre-gl is ever touched, so this
    // exercises the .strings resolution without the optional peer.
    stubFetch({ not: 'geojson' });
    const el = (await fixture(
      html`<lyra-geojson-view
        src=${GEOJSON_URL}
        .strings=${{ geojsonViewInvalid: 'Fichier GeoJSON invalide.' }}
      ></lyra-geojson-view>`,
    )) as LyraGeojsonView;
    const eventPromise = oneEvent(el, 'lyra-render-error');
    await eventPromise;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[role="alert"]')!.textContent).to.equal('Fichier GeoJSON invalide.');
  });
});

describe('missing maplibre-gl peer', () => {
  it('falls back to lyra-json-viewer with a missing-library callout when loadMaplibre resolves null', async () => {
    stubFetch(FEATURE_COLLECTION);
    const el = (await fixture(html`<lyra-geojson-view src=${GEOJSON_URL}></lyra-geojson-view>`)) as LyraGeojsonView;
    (el as unknown as { forceMissingMaplibreForTesting: boolean }).forceMissingMaplibreForTesting = true;
    await el.updateComplete;
    await new Promise((resolve) => setTimeout(resolve, 0));
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('lyra-json-viewer')).to.exist;
    expect(el.shadowRoot!.querySelector('[part="missing-library"]')).to.exist;
  });
});

describe('accessibility', () => {
  it('is accessible once loaded', async () => {
    stubFetch(FEATURE_COLLECTION);
    const el = (await fixture(
      html`<lyra-geojson-view src=${GEOJSON_URL} name="zones.geojson"></lyra-geojson-view>`,
    )) as LyraGeojsonView;
    await waitUntil(
      () => el.shadowRoot!.querySelector('[part="status"]') != null,
      'geojson-view never reached the loaded state',
      { timeout: 2000 },
    );
    await expect(el).to.be.accessible();
  });
});
