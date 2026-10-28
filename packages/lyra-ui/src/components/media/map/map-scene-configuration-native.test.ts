import { expect, fixture, fixtureCleanup, html } from '@open-wc/testing';
import { getWorkerUrl, setWorkerUrl } from '@aceshooting/lyra-map';
import { LyraMap, LYRA_MAP_EMPTY_STYLE } from './map.js';
import type { LyraMapInstance } from './map.class.js';

interface SceneMapElement extends LyraMap {
  projection: 'mercator' | 'globe' | undefined;
  terrain: { readonly source: string; readonly exaggeration?: number } | null | undefined;
}
interface NativeSceneMap extends LyraMapInstance {
  getProjection(): { type: unknown } | undefined;
  getTerrain(): unknown;
  getStyle(): { sources: Record<string, unknown>; layers: readonly { id: string }[] };
}
const style = () => ({ ...LYRA_MAP_EMPTY_STYLE, projection: { type: 'globe' }, layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#eeeeee' } }] });
async function mount(engine: 'modular' | 'maplibre'): Promise<SceneMapElement> {
  const el = await fixture<SceneMapElement>(html`<lr-map style="inline-size:400px;block-size:300px" .engine=${engine} .mapStyle=${style()} .controls=${{ attribution: false }}></lr-map>`);
  await el.whenStyleReady(); await el.whenIdle(); return el;
}
const native = (el: SceneMapElement) => el.map as NativeSceneMap;
async function idle(el: SceneMapElement) { await el.updateComplete; await el.whenIdle(); }

for (const engine of ['modular', 'maplibre'] as const) describe(`lr-map scene configuration with the ${engine} engine`, function () {
  this.timeout(45000);
  let previousWorkerUrl: string;
  before(function () { if (!document.createElement('canvas').getContext('webgl2')) this.skip(); });
  beforeEach(() => { previousWorkerUrl = getWorkerUrl(); setWorkerUrl(new URL('/__lyra-map-worker__/worker.mjs', location.origin).href); });
  afterEach(() => { fixtureCleanup(); setWorkerUrl(previousWorkerUrl); });

  it('switches projection without replacing the map or caller layers and restores the baseline', async () => {
    const el = await mount(engine); const map = native(el); const center = map.getCenter();
    el.projection = 'mercator'; await idle(el);
    expect(map.getProjection()?.type).to.equal('mercator'); expect(el.map === map).to.equal(true);
    expect(map.getStyle().layers.map(layer => layer.id)).to.deep.equal(['background']);
    el.projection = undefined; await idle(el);
    expect(map.getProjection()?.type).to.equal('globe');
    expect(map.getCenter().lng).to.equal(center.lng); expect(map.getCenter().lat).to.equal(center.lat);
  });
  it('restores a full style projection expression through metadata-only feature preparation', async () => {
    const el = await mount(engine);
    const expression = ['interpolate', ['linear'], ['zoom'], 0, 'globe', 10, 'mercator'];
    el.mapStyle = { ...style(), projection: { type: expression } }; await idle(el);
    el.projection = 'mercator'; await idle(el);
    expect(native(el).getProjection()?.type).to.equal('mercator');
    el.projection = undefined; await idle(el);
    expect(native(el).getProjection()?.type).to.deep.equal(expression);
  });
  it('enables, scales and disables caller-owned terrain without removing its source', async () => {
    const el = await mount(engine); const canvas = document.createElement('canvas'); canvas.width = 128; canvas.height = 128;
    const context = canvas.getContext('2d')!; context.fillStyle = 'rgb(1, 134, 160)'; context.fillRect(0, 0, 128, 128);
    const tile = canvas.toDataURL('image/png');
    el.mapStyle = { ...style(), projection: { type: engine === 'maplibre' ? 'mercator' : 'globe' }, sources: { elevation: { type: 'raster-dem', tiles: [tile], tileSize: 128, maxzoom: 0, encoding: 'mapbox' } } };
    await idle(el);
    el.terrain = { source: 'elevation', exaggeration: 12 }; await idle(el);
    expect(native(el).getTerrain()).to.deep.equal({ source: 'elevation', exaggeration: 12 });
    el.terrain = { source: 'elevation', exaggeration: 0 }; await idle(el);
    expect(native(el).getTerrain()).to.deep.equal({ source: 'elevation', exaggeration: 0 });
    el.terrain = undefined; await idle(el); expect(native(el).getTerrain()).to.equal(null);
    el.terrain = { source: 'elevation', exaggeration: 1 }; await idle(el);
    el.terrain = null; await idle(el); expect(native(el).getTerrain()).to.equal(null);
    expect(Object.hasOwn(native(el).getStyle().sources, 'elevation')).to.equal(true);
  });

  it('captures the committed URL style instead of retaining the previous style baseline', async () => {
    const el = await mount(engine); el.projection = 'globe'; await idle(el);
    const url = URL.createObjectURL(new Blob([JSON.stringify({ ...style(), projection: { type: 'mercator' } })], { type: 'application/json' }));
    try {
      el.mapStyle = url; await el.whenStyleReady(); await idle(el);
      expect(native(el).getProjection()?.type).to.equal('globe');
      el.projection = undefined; await idle(el);
      expect(native(el).getProjection()?.type).to.equal('mercator');
    } finally { URL.revokeObjectURL(url); }
  });

});
