import { expect, fixture, fixtureCleanup, html, oneEvent, waitUntil } from '@open-wc/testing';
import { AnchorMapEngine, mountMap, restoreMapEnvironment, stubMapEnvironment } from '../../../../test/map-anchors.js';
import { LYRA_MAP_EMPTY_STYLE, type LyraMap, type LyraMapGeoJsonDataLayer } from '../../lr-map.js';
import { getWorkerUrl, setWorkerUrl } from '@aceshooting/lyra-map';
import { requireWebgl2 } from '../../../../test/webgl2.js';
import { sendMouse } from '../../../../test/wtr-mouse.js';

class PhotoMap extends AnchorMapEngine {
  readonly layouts = new Map<string, unknown>();
  setLayoutProperty(id: string, name: string, value: unknown): void { this.layouts.set(`${id}:${name}`, value); }
}

const svgResponse = (markup: string): Response => {
  const response = new Response(markup, { headers: { 'content-type': 'image/svg+xml' } });
  Object.defineProperty(response, 'type', { value: 'basic' });
  return response;
};

const photos: LyraMapGeoJsonDataLayer = { sourceId: 'gallery', cluster: { zoomOnClick: true },
  geojson: { type: 'FeatureCollection', features: Array.from({ length: 2000 }, (_, id) => ({
    type: 'Feature', id, properties: { thumb: `/photos/${id}.png` }, geometry: { type: 'Point', coordinates: [id / 100, 0] },
  })) }, point: { image: { field: 'thumb', border: 'blue' } } };

describe('map per-feature thumbnails', () => {
  const nativeFetch = window.fetch;
  beforeEach(stubMapEnvironment);
  afterEach(() => { fixtureCleanup(); restoreMapEnvironment(); window.fetch = nativeFetch; });

  it('keeps plain points and clusters free of image work unless opted in', async () => {
    const { engine } = await mountMap(map => { map.dataLayers = [{ ...photos, point: {} }]; }, PhotoMap);
    expect(engine.order.some(id => id.endsWith('-point-image'))).to.equal(false);
    expect(engine.images.size).to.equal(0);
  });

  it('retains circles without scanning the viewport when the peer lacks the symbol layout setter', async () => {
    const { engine, map } = await mountMap(el => { el.dataLayers = [photos]; }, AnchorMapEngine);
    expect(engine.order.some(id => id.endsWith('-circle'))).to.equal(true);
    expect(engine.order.some(id => id.endsWith('-point-image'))).to.equal(false);
    const queries = engine.queryCount;
    engine.hits = [{ properties: { thumb: '/photos/absent.svg' } }];
    engine.fire('idle'); await map.whenIdle();
    expect(engine.queryCount).to.equal(queries);
    expect(engine.images.size).to.equal(0);
  });

  it('requests only rendered unclustered URLs, clips their pixels and evicts them after panning', async () => {
    const requests: string[] = [];
    window.fetch = async url => {
      requests.push(String(url));
      const response = new Response('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 10"><rect width="40" height="10" fill="blue"/><rect x="15" width="10" height="10" fill="red"/></svg>',
        { headers: { 'content-type': 'image/svg+xml' } });
      Object.defineProperty(response, 'type', { value: 'basic' });
      return response;
    };
    const { map, engine } = await mountMap(el => { el.dataLayers = [photos]; }, PhotoMap);
    expect(requests.length).to.equal(0);
    const symbol = engine.order.find(id => id.endsWith('-point-image'))!;
    expect(typeof symbol).to.equal('string');
    engine.hits = [{ properties: { thumb: '/photos/a.svg' } }, { properties: { thumb: '/photos/a.svg' } },
      { properties: { thumb: '/photos/cluster.svg', point_count: 2 } }];
    engine.fire('idle');
    await waitUntil(() => engine.images.size === 1, 'visible thumbnail is installed');
    expect(requests.map(url => new URL(url).pathname)).to.deep.equal(['/photos/a.svg']);
    const [id, pixels] = [...engine.images.entries()][0]!;
    expect(pixels.width).to.equal(32);
    expect(pixels.data[3]).to.equal(0);
    const center = (16 * 32 + 16) * 4;
    expect([...pixels.data.slice(center, center + 4)]).to.deep.equal([255, 0, 0, 255]);
    const upperCenter = (4 * 32 + 16) * 4;
    expect([...pixels.data.slice(upperCenter, upperCenter + 4)]).to.deep.equal([255, 0, 0, 255]);
    expect((engine as PhotoMap).layouts.get(`${symbol}:icon-image`)).to.deep.equal(['match', ['get', 'thumb'], '/photos/a.svg', id, '']);
    engine.hits = []; engine.fire('idle');
    expect(engine.images.size).to.equal(0);
    map.dataLayers = [];
    await map.updateComplete;
    await waitUntil(() => !engine.layers.has(symbol), 'symbol layer is retired');
  });

  it('cancels an in-flight thumbnail when its field changes and uses the new square crop', async () => {
    let oldSignal: AbortSignal | undefined;
    let finishOld: ((response: Response) => void) | undefined;
    const image = () => {
      const response = new Response('<svg xmlns="http://www.w3.org/2000/svg" width="40" height="10"><rect width="40" height="10" fill="red"/></svg>',
        { headers: { 'content-type': 'image/svg+xml' } });
      Object.defineProperty(response, 'type', { value: 'basic' });
      return response;
    };
    window.fetch = (url, options) => {
      if (String(url).endsWith('/old.svg')) {
        oldSignal = options?.signal ?? undefined;
        return new Promise(resolve => { finishOld = resolve; });
      }
      return Promise.resolve(image());
    };
    const { map, engine } = await mountMap(el => { el.dataLayers = [photos]; }, PhotoMap);
    const symbol = engine.order.find(id => id.endsWith('-point-image'))!;
    engine.hits = [{ properties: { thumb: '/old.svg', replacement: '/new.svg' } }];
    engine.fire('idle');
    await waitUntil(() => !!finishOld, 'old image request starts');
    map.dataLayers = [{ ...photos, point: { image: { field: 'replacement', shape: 'square', size: 24 } } }];
    await map.updateComplete;
    await waitUntil(() => oldSignal?.aborted === true, 'reconfiguration aborts the old transfer');
    finishOld!(image());
    engine.fire('idle');
    await waitUntil(() => engine.images.size === 1, 'replacement pixels are installed');
    await map.whenIdle();
    const [id, pixels] = [...engine.images.entries()][0]!;
    expect(pixels.width).to.equal(24);
    expect(Array.from(pixels.data.slice(0, 4))).to.deep.equal([255, 0, 0, 255]);
    expect((engine as PhotoMap).layouts.get(`${symbol}:icon-image`)).to.deep.equal(['match', ['get', 'replacement'], '/new.svg', id, '']);
    expect(engine.order.filter(value => value.endsWith('-point-image'))).to.deep.equal([symbol]);
  });

  for (const interruption of ['throws', 'disconnects'] as const) {
    it(`preserves foreign images when native installation ${interruption} after mutating the atlas`, async () => {
      const { map, engine } = await mountMap(el => { el.dataLayers = [photos]; }, PhotoMap);
      const foreign = new ImageData(1, 1);
      engine.addImage('lr-point-photo-0', foreign);
      let attempts = 0;
      const install = engine.addImage.bind(engine);
      engine.addImage = (id, pixels) => {
        install(id, pixels);
        attempts++;
        if (interruption === 'throws') throw new Error('Native image installation failed');
        map.remove();
      };
      window.fetch = async () => {
        const response = new Response('<svg xmlns="http://www.w3.org/2000/svg"><rect width="300" height="150" fill="red"/></svg>',
          { headers: { 'content-type': 'image/svg+xml' } });
        Object.defineProperty(response, 'type', { value: 'basic' });
        return response;
      };
      engine.hits = [{ properties: { thumb: '/photo.svg' } }];
      engine.fire('idle');
      await waitUntil(() => attempts === 1 && engine.images.size === 1, 'partial installation is retired');
      if (map.isConnected) await map.whenIdle();
      expect(attempts).to.equal(1);
      expect([...engine.images.keys()]).to.deep.equal(['lr-point-photo-0']);
      expect(engine.images.get('lr-point-photo-0') === foreign).to.equal(true);
      if (map.isConnected) { engine.fire('idle'); await map.whenIdle(); }
      expect(attempts).to.equal(1);
    });
  }

  it('bounds visible URLs across layers and keeps failed thumbnails on their fallback circles', async () => {
    let attempts = 0;
    window.fetch = async () => { attempts++; return new Response(null, { status: 404 }); };
    const { engine, map } = await mountMap(el => { el.dataLayers = [photos, { ...photos, sourceId: 'places' }]; }, PhotoMap);
    engine.hits = Array.from({ length: 500 }, (_, id) => ({ properties: { thumb: `/photos/${id}.png` } }));
    engine.fire('idle');
    await waitUntil(() => attempts === 128, 'every visible thumbnail is attempted');
    await new Promise(resolve => setTimeout(resolve, 50));
    engine.fire('idle');
    await map.whenIdle();
    await new Promise(resolve => setTimeout(resolve, 50));
    expect(attempts).to.equal(128);
    expect(engine.order.filter(id => id.endsWith('-circle')).length).to.equal(2);
    expect(engine.images.size).to.equal(0);
  });

  it('settles the map while thumbnail scanning throws or a transfer stalls', async () => {
    let release: ((response: Response) => void) | undefined;
    window.fetch = () => new Promise(resolve => { release = resolve; });
    const { map, engine } = await mountMap(el => { el.dataLayers = [photos]; }, PhotoMap);
    const settles = () => Promise.race([map.whenIdle().then(() => 'idle', () => 'failed'),
      new Promise(resolve => setTimeout(resolve, 1000, 'held'))]);
    engine.hits = [{ properties: { thumb: '/photos/slow.svg' } }];
    engine.queryError = true;
    engine.fire('idle');
    expect(await settles()).to.equal('idle');
    engine.queryError = false;
    engine.fire('idle');
    await waitUntil(() => !!release, 'thumbnail transfer starts');
    expect(await settles()).to.equal('idle');
    release!(svgResponse('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2 2"><rect width="2" height="2" fill="red"/></svg>'));
    await waitUntil(() => engine.images.size === 1, 'the stalled thumbnail still installs');
  });

  it('rasterizes thumbnails for the display density within the atlas pixel-ratio bound', async () => {
    const own = Object.getOwnPropertyDescriptor(window, 'devicePixelRatio');
    window.fetch = async () => svgResponse('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2 2"><rect width="2" height="2" fill="red"/></svg>');
    const { engine } = await mountMap(el => { el.dataLayers = [photos]; }, PhotoMap);
    const installs: { width: number; ratio: unknown }[] = [];
    const install = engine.addImage.bind(engine);
    engine.addImage = (id: string, pixels: ImageData, options?: { pixelRatio?: number }) => {
      installs.push({ width: pixels.width, ratio: options?.pixelRatio });
      install(id, pixels);
    };
    try {
      for (const ratio of [2, 9]) {
        Object.defineProperty(window, 'devicePixelRatio', { configurable: true, value: ratio });
        engine.hits = [{ properties: { thumb: `/photos/${ratio}.svg` } }];
        engine.fire('idle');
        await waitUntil(() => installs.length === (ratio === 2 ? 1 : 2), 'density thumbnail installs');
      }
    } finally {
      if (own) Object.defineProperty(window, 'devicePixelRatio', own);
      else delete (window as { devicePixelRatio?: number }).devicePixelRatio;
    }
    expect(installs).to.deep.equal([{ width: 64, ratio: 2 }, { width: 128, ratio: 4 }]);
  });

  it('limits parallel transfers and aborts retired viewport requests', async () => {
    const signals: AbortSignal[] = [];
    window.fetch = (_url, options) => new Promise((_resolve, reject) => {
      const signal = options!.signal!;
      signals.push(signal);
      signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
    });
    const { map, engine } = await mountMap(el => { el.dataLayers = [photos]; }, PhotoMap);
    engine.hits = Array.from({ length: 500 }, (_, id) => ({ properties: { thumb: `/photos/${id}.png` } }));
    engine.fire('idle');
    await waitUntil(() => signals.length === 4, 'four transfers start');
    engine.hits = []; engine.fire('idle');
    expect(signals.every(signal => signal.aborted)).to.equal(true);
    await map.whenIdle();
    expect(signals.length).to.equal(4);
    expect(engine.images.size).to.equal(0);
  });
});

describe('point thumbnails with native map engines', function () {
  this.timeout(45000);
  const originalFetch = window.fetch;
  let worker: string;
  before(requireWebgl2);
  beforeEach(() => {
    worker = getWorkerUrl();
    setWorkerUrl(new URL('/__lyra-map-worker__/worker.mjs', location.origin).href);
    window.fetch = async (url, options) => {
      if (!String(url).endsWith('/photos/single.svg')) return originalFetch(url, options);
      const response = new Response('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><rect width="20" height="20" fill="red"/></svg>',
        { headers: { 'content-type': 'image/svg+xml' } });
      Object.defineProperty(response, 'type', { value: 'basic' });
      return response;
    };
  });
  afterEach(() => { fixtureCleanup(); setWorkerUrl(worker); window.fetch = originalFetch; });

  for (const engine of ['modular', 'maplibre'] as const) {
    it(`${engine} renders a pickable photo on the clustered source`, async () => {
      const host = await fixture<HTMLDivElement>(html`<div></div>`);
      const map = document.createElement('lr-map') as LyraMap;
      map.engine = engine; map.initialization = 'eager'; map.mapStyle = LYRA_MAP_EMPTY_STYLE;
      map.style.cssText = 'width:320px;height:240px';
      map.center = [0, 0]; map.zoom = 10;
      map.dataLayers = [{ ...photos, geojson: { type: 'Feature', id: 7, properties: { thumb: '/photos/single.svg' },
        geometry: { type: 'Point', coordinates: [0, 0] } } }];
      host.append(map);
      await map.whenStyleReady();
      const native = map.map as unknown as { getCanvas(): HTMLCanvasElement;
        queryRenderedFeatures(point: [number, number]): { layer: { id: string } }[] };
      // Beyond the five-pixel circle, only a successfully placed 32px thumbnail is pickable.
      await waitUntil(() => native.queryRenderedFeatures([170, 120]).some(hit => hit.layer.id.endsWith('-point-image')),
        'the native renderer places the thumbnail', { timeout: 10000 });
      const box = native.getCanvas().getBoundingClientRect();
      const clicked = oneEvent(map, 'lr-map-click');
      await sendMouse({ type: 'click', position: [Math.round(box.left + 170), Math.round(box.top + 120)] });
      const detail = (await clicked).detail;
      expect(detail.sourceId).to.equal('gallery');
      expect(detail.feature.id).to.equal(7);
      // An ordinary feature can own a point_count property as application data.
      map.dataLayers = [{ ...photos, cluster: undefined, geojson: { type: 'Feature', id: 9,
        properties: { thumb: '/photos/single.svg', point_count: 4 }, geometry: { type: 'Point', coordinates: [0, 0] } } }];
      await map.updateComplete;
      // Thumbnail transfers do not hold readiness, so wait for the progressive repaint itself.
      await waitUntil(() => native.queryRenderedFeatures([170, 120]).some(hit =>
        hit.layer.id.endsWith('-point-image') && (hit as { id?: number }).id === 9), 'the ordinary photo is placed', { timeout: 10000 });
    });
  }
});
