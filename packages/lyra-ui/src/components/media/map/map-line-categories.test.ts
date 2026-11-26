import { expect, fixture, fixtureCleanup, html, waitUntil } from '@open-wc/testing';
import { getWorkerUrl, setWorkerUrl } from '@aceshooting/lyra-map';
import '../../lr-map.js';
import type { LyraMap, LyraMapGeoJsonDataLayer } from './map.class.js';
import { requireWebgl2 } from '../../../../test/webgl2.js';

let previousWorkerUrl: ReturnType<typeof getWorkerUrl>;
beforeEach(() => {
  previousWorkerUrl = getWorkerUrl();
  setWorkerUrl(new URL('/__lyra-map-worker__/worker.mjs', location.origin).href);
});
afterEach(() => { fixtureCleanup(); setWorkerUrl(previousWorkerUrl); });

for (const engine of ['modular', 'maplibre'] as const) {
  it(`renders categorical colors, dashed and solid routes with the ${engine} engine`, async function () {
    this.timeout(15000);
    requireWebgl2.call(this);
    let ready = false;
    const el = await fixture<LyraMap>(html`<lr-map .engine=${engine} zoom="12" center="[0,0]"
      style="width:320px;height:240px" .mapStyle=${{ version: 8, sources: {}, layers: [] }}
      @lr-map-load=${() => { ready = true; }}></lr-map>`);
    await waitUntil(() => ready, 'map load', { timeout: 10000 });
    const map = el.map as unknown as import('maplibre-gl').Map;
    const errors: string[] = [];
    map.on('error', event => errors.push(String(event.error)));
    const layer: LyraMapGeoJsonDataLayer = {
      sourceId: 'routes',
      geojson: { type: 'FeatureCollection', features: ['air', 'rail'].map((mode, index) => ({
        type: 'Feature', properties: { mode },
        geometry: { type: 'LineString', coordinates: [[-0.1, index * 0.01], [0.1, index * 0.01]] },
      })) },
      line: { field: 'mode', width: 5, colors: [['air', 'red'], ['rail', 'blue']], dash: [['air', [3, 3]]] },
    };
    el.dataLayers = [layer];
    await el.updateComplete;
    await waitUntil(() => map.loaded() && map.queryRenderedFeatures().length >= 2, 'routes visible', { timeout: 5000 });
    const countPixels = (channels = [0, 2]) => new Promise<number[]>(resolve => {
      map.once('render', () => {
        const canvas = document.createElement('canvas');
        const source = map.getCanvas();
        canvas.width = source.width;
        canvas.height = source.height;
        const context = canvas.getContext('2d')!;
        context.drawImage(source, 0, 0);
        resolve([0, 0.01].map((latitude, index) => {
          const y = Math.round(map.project([0, latitude]).y * source.height / source.clientHeight);
          const pixels = context.getImageData(0, y, canvas.width, 1).data;
          let count = 0;
          for (let offset = 0; offset < pixels.length; offset += 4) {
            if (pixels[offset + channels[index]!]! > 200 && pixels[offset + 3]! > 200) count++;
          }
          return count / canvas.width;
        }));
      });
      map.triggerRepaint();
    });
    const [air, rail] = await countPixels();
    expect(air).to.be.within(0.3, 0.7);
    expect(rail).to.be.greaterThan(0.95);
    for (const dash of [[2, 2], undefined] as const) {
      el.dataLayers = [{ ...layer, line: { ...layer.line, dash } }];
      await el.updateComplete;
      await waitUntil(() => map.loaded(), 'updated route paint ready');
      for (const fraction of await countPixels()) {
        expect(fraction).to.be.within(dash ? 0.3 : 0.95, dash ? 0.7 : 1);
      }
    }
    el.hiddenCategories = ['rail'];
    await el.updateComplete;
    await el.whenIdle();
    const [visible, hidden] = await countPixels();
    expect(visible).to.be.greaterThan(0.95);
    expect(hidden).to.equal(0);
    // A dash-only category still responds to legend muting when both routes share one ink.
    el.dataLayers = [{ ...layer, strokeColor: 'red', line: { field: 'mode', width: 5, dash: [['air', [3, 3]]] } }];
    await el.updateComplete; await el.whenIdle();
    const [dashed, muted] = await countPixels([0, 0]);
    expect(dashed).to.be.within(0.3, 0.7);
    expect(muted).to.equal(0);
    el.hiddenCategories = [];
    await el.updateComplete; await el.whenIdle();
    const [, restored] = await countPixels([0, 0]);
    expect(restored).to.be.greaterThan(0.95);
    expect(errors).to.deep.equal([]);
  });
}
