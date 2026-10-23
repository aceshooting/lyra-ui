import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import './geojson-viewer.js';
import { LyraMap } from '../../media/map/map.class.js';
import type { LyraGeoJsonViewer } from './geojson-viewer.class.js';
import { Map as NativeMap, getWorkerUrl, setWorkerUrl } from 'maplibre-gl';

const documentUrl = 'https://example.test/native-preview.geojson';
const geojson = { type: 'FeatureCollection', features: [
  { type: 'Feature', id: 7, geometry: { type: 'Point', coordinates: [0, 0] }, properties: { name: 'Place' } },
] };

it('uses the admitted native MapLibre peer for its nested map', async () => {
  const originalFetch = window.fetch;
  const OriginalObserver = window.IntersectionObserver;
  // Keep map construction visibility-gated while the public engine selection is inspected.
  window.IntersectionObserver = class extends OriginalObserver { override observe(): void {} };
  let fetches = 0;
  window.fetch = (input, options) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (url === documentUrl) { fetches++; return Promise.resolve(new Response(JSON.stringify(geojson))); }
    return originalFetch.call(window, input, options);
  };
  let viewer: LyraGeoJsonViewer | undefined;
  try {
    viewer = await fixture<LyraGeoJsonViewer>(html`<lr-geojson-viewer name="Native GeoJSON preview" src=${documentUrl}></lr-geojson-viewer>`);
    await waitUntil(() => viewer!.shadowRoot!.querySelector('lr-map') !== null, 'native peer preflight did not admit the valid document', { timeout: 3_000 });
    const child = viewer.shadowRoot!.querySelector<LyraMap>('lr-map');
    if (!child) throw new Error('Missing admitted GeoJSON map');
    expect(await LyraMap.preload('maplibre')).equal(true);
    expect(fetches).equal(1);
    expect(viewer.shadowRoot!.querySelector('[part="metadata"]')?.textContent).contain('Place');
    expect(viewer.shadowRoot!.querySelectorAll('[part="missing-library"]').length).equal(0);
    expect(child.dataLayers.length).equal(1);
    expect(child.dataLayers[0]?.sourceId).equal('lr-geojson');
    expect(child.engine).equal('maplibre');
  } finally {
    viewer?.remove();
    window.fetch = originalFetch;
    window.IntersectionObserver = OriginalObserver;
  }
});

it('renders admitted GeoJSON through a real native MapLibre map and module worker', async function () {
  if (!document.createElement('canvas').getContext('webgl2')) this.skip();
  const originalFetch = window.fetch;
  const previousWorkerUrl = getWorkerUrl();
  // Source tests serve the installed peer's matching self-contained worker asset directly.
  setWorkerUrl(new URL('../../../../node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs', import.meta.url).href);
  let fetches = 0;
  window.fetch = (input, options) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (url === documentUrl) { fetches++; return Promise.resolve(new Response(JSON.stringify(geojson))); }
    return originalFetch.call(window, input, options);
  };
  let viewer: LyraGeoJsonViewer | undefined;
  try {
    viewer = await fixture<LyraGeoJsonViewer>(html`<lr-geojson-viewer name="Native worker preview" src=${documentUrl}
      style="display:block;inline-size:640px"></lr-geojson-viewer>`);
    await waitUntil(() => viewer!.shadowRoot!.querySelector<LyraMap>('lr-map')?.map !== undefined,
      'the actual native map did not construct', { timeout: 5_000 });
    const child = viewer.shadowRoot!.querySelector<LyraMap>('lr-map');
    if (!child) throw new Error('Missing native preview map');
    const peer = child.map;
    if (!(peer instanceof NativeMap)) throw new Error('The viewer did not construct the actual native peer');
    await waitUntil(() => peer.loaded() && peer.queryRenderedFeatures().some(feature => feature.id === 7),
      'the native worker did not render the admitted GeoJSON feature', { timeout: 5_000 });
    const rendered = peer.queryRenderedFeatures().find(feature => feature.id === 7);
    expect(child.engine).equal('maplibre');
    expect(rendered?.properties['name']).equal('Place');
    expect(peer.getCanvas().getContext('webgl2') !== null).equal(true);
    expect(viewer.shadowRoot!.querySelectorAll('[part="missing-library"], [part="error"]').length).equal(0);
    expect(fetches).equal(1);
  } finally {
    viewer?.remove();
    window.fetch = originalFetch;
    setWorkerUrl(previousWorkerUrl);
  }
});
