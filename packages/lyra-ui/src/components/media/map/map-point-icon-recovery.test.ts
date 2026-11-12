import { expect, fixture, fixtureCleanup, html, waitUntil } from '@open-wc/testing';
import { ControlMapEngine } from '../../../../test/map-control-engine.js';
import { LYRA_MAP_EMPTY_STYLE, type LyraMap, type LyraMapGeoJsonDataLayer } from './map.js';

class IconMap extends ControlMapEngine {
  updateImage(id: string, pixels: ImageData): void { this.images.set(id, pixels); }
}

const contextDescriptor = Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, 'getContext')!;
const pathDescriptor = Object.getOwnPropertyDescriptor(window, 'Path2D')!;
const observerDescriptor = Object.getOwnPropertyDescriptor(window, 'IntersectionObserver');
const originalContext = HTMLCanvasElement.prototype.getContext;
let rasterFailure: 'none' | 'missing' | 'throw' = 'none';
let rasterCalls = 0;
let rejectedRaster = 0;

function layer(color = '#112233', strokeWidth = 1): LyraMapGeoJsonDataLayer {
  return {
    sourceId: 'stations',
    geojson: { type: 'FeatureCollection', features: [{ type: 'Feature', properties: { kind: 'station' },
      geometry: { type: 'Point', coordinates: [0, 0] } }] },
    point: { field: 'kind', strokeWidth, iconColor: color,
      icons: [{ value: 'station', path: 'M0 0H24V24H0Z' }] },
  };
}

async function mount() {
  const parent = await fixture<HTMLDivElement>(html`<div style="width:320px;height:240px"></div>`);
  const element = document.createElement('lr-map') as LyraMap;
  element.style.cssText = 'width:100%;height:100%';
  element.engine = 'maplibre';
  element.initialization = 'eager';
  element.mapStyle = LYRA_MAP_EMPTY_STYLE;
  element.controls = { attribution: false };
  (element as unknown as { loadLibrary: () => Promise<unknown> }).loadLibrary = async () => ({ Map: IconMap });
  parent.append(element);
  await waitUntil(() => element.map !== undefined);
  const peer = element.map as unknown as IconMap;
  peer.ready = true;
  peer.fire('load');
  await element.whenStyleReady();
  return { element, peer };
}

async function apply(element: LyraMap, value: LyraMapGeoJsonDataLayer): Promise<void> {
  element.dataLayers = [value];
  await element.updateComplete;
  await element.whenStyleReady();
}

function firstPixel(peer: IconMap): number[] {
  const image = [...peer.images.values()][0];
  return image ? Array.from(image.data.slice(0, 4)) : [];
}

describe('map point icon raster recovery', () => {
  beforeEach(() => {
    rasterFailure = 'none';
    rasterCalls = rejectedRaster = 0;
    Object.defineProperty(window, 'IntersectionObserver', { configurable: true, value: undefined });
    Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
      configurable: true, writable: true,
      value(this: HTMLCanvasElement, id: string, ...rest: unknown[]) {
        if (id === 'webgl2') return {};
        if (id === '2d' && this.width === 64 && this.height === 64) {
          if (++rasterCalls === rejectedRaster) return null;
          if (rasterFailure === 'missing') return null;
          if (rasterFailure === 'throw') throw new Error('Raster allocation unavailable');
        }
        return originalContext.call(this, id as never, ...(rest as []));
      },
    });
  });

  afterEach(() => {
    fixtureCleanup();
    Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', contextDescriptor);
    Object.defineProperty(window, 'Path2D', pathDescriptor);
    if (observerDescriptor) Object.defineProperty(window, 'IntersectionObserver', observerDescriptor);
    else Reflect.deleteProperty(window, 'IntersectionObserver');
  });

  for (const failure of ['missing', 'throw', 'path'] as const) {
    it(`retains circle geometry when ${failure} prevents icon rasterization and retries changed paint`, async () => {
      const { element, peer } = await mount();
      if (failure === 'path') Object.defineProperty(window, 'Path2D', { configurable: true, value: undefined });
      else rasterFailure = failure;
      await apply(element, layer());
      expect(peer.images.size).to.equal(0);
      expect([...peer.layers.keys()].some(id => id.endsWith('-circle'))).to.equal(true);
      expect([...peer.layers.keys()].some(id => id.endsWith('-point-icon'))).to.equal(false);
      expect(peer.removed).to.equal(false);
      const source = [...peer.sources.values()][0];
      rasterFailure = 'none';
      Object.defineProperty(window, 'Path2D', pathDescriptor);
      await apply(element, layer('#445566', 2));
      expect(peer.images.size).to.equal(1);
      expect(firstPixel(peer)).to.deep.equal([68, 85, 102, 255]);
      expect([...peer.sources.values()][0] === source).to.equal(true);
      element.dataLayers = [];
      await element.updateComplete;
      await element.whenStyleReady();
      expect(peer.images.size).to.equal(0);
    });
  }

  for (const failure of ['missing', 'throw'] as const) {
    it(`retries the desired color after a ${failure} raster during a repaint`, async () => {
      const { element, peer } = await mount();
      await apply(element, layer());
      expect(firstPixel(peer)).to.deep.equal([17, 34, 51, 255]);
      const ids = [...peer.images.keys()];
      rasterFailure = failure;
      await apply(element, layer('#445566'));
      expect(firstPixel(peer)).to.deep.equal([17, 34, 51, 255]);
      rasterFailure = 'none';
      await apply(element, layer('#445566', 2));
      expect(firstPixel(peer)).to.deep.equal([68, 85, 102, 255]);
      expect([...peer.images.keys()]).to.deep.equal(ids);
    });
  }

  it('replaces an incomplete icon atlas without leaking its successfully allocated image', async () => {
    const { element, peer } = await mount();
    const initial = layer();
    const value = { ...initial, point: { ...initial.point, icons: [
      { value: 'station', path: 'M0 0H24V24H0Z' },
      { value: 'depot', path: 'M0 0H24V24H0Z' },
    ] } };
    rejectedRaster = rasterCalls + 2;
    await apply(element, value);
    const previousIds = [...peer.images.keys()];
    expect(previousIds.length).to.equal(1);
    rejectedRaster = 0;
    await apply(element, { ...value, point: { ...value.point, strokeWidth: 2 } });
    expect(peer.images.size).to.equal(2);
    expect(previousIds.some(id => peer.images.has(id))).to.equal(false);
    expect([...peer.layers.keys()].filter(id => id.endsWith('-point-icon')).length).to.equal(1);
  });

  for (const restoreOriginal of [false, true]) {
    it(`recovers every icon after a partially failed repaint ${restoreOriginal ? 'back to the original color' : 'to the requested color'}`, async () => {
      const { element, peer } = await mount();
      const twoIcons = (color: string, width: number): LyraMapGeoJsonDataLayer => {
        const value = layer(color, width);
        return { ...value, point: { ...value.point,
          icons: [{ value: 'station', path: 'M0 0H24V24H0Z' }, { value: 'depot', path: 'M0 0H24V24H0Z' }] } };
      };
      await apply(element, twoIcons('#112233', 1));
      const ids = [...peer.images.keys()];
      expect(ids.length).to.equal(2);
      rejectedRaster = rasterCalls + 2;
      await apply(element, twoIcons('#445566', 1));
      rejectedRaster = 0;
      await apply(element, twoIcons(restoreOriginal ? '#112233' : '#445566', 2));
      const expected = restoreOriginal ? [17, 34, 51, 255] : [68, 85, 102, 255];
      expect([...peer.images.values()].map(image => Array.from(image.data.slice(0, 4)))).to.deep.equal([expected, expected]);
      expect([...peer.images.keys()]).to.deep.equal(ids);
    });
  }
});
