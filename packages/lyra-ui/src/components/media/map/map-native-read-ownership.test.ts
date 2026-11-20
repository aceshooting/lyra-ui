import { expect, fixture, fixtureCleanup, html, waitUntil } from '@open-wc/testing';
import { ControlMapEngine } from '../../../../test/map-control-engine.js';
import { loadMapFeatureStateRuntime, loadMapOwnedFeatureRuntime } from './map-feature-loader.js';
import { LYRA_MAP_EMPTY_STYLE, type LyraMap } from '../../lr-map.js';

const points = { type: 'FeatureCollection', features: [
  { type: 'Feature', id: 0, properties: {}, geometry: { type: 'Point', coordinates: [1, 2] } },
] };

class ReadBoundaryMap extends ControlMapEngine {
  afterStyleRead?: () => void;
  afterLayerRead?: (id: string) => void;
  afterMove?: () => void;
  moves = 0;
  // Even ordering-only overrides require the native style-property capability set.
  getPaintProperty(): unknown { return undefined; }
  getLayoutProperty(): unknown { return undefined; }
  setLayoutProperty(): this { return this; }
  constructor(options: Record<string, unknown>) {
    super(options);
    this.addSource('basemap', { type: 'geojson', data: points });
    for (const id of ['base', 'a', 'b', 'labels']) {
      const layer = { id, type: 'circle', source: 'basemap' };
      this.addLayer(layer);
    }
  }
  override getStyle() {
    const snapshot = super.getStyle();
    this.afterStyleRead?.();
    return snapshot;
  }
  override getLayer(id: string): unknown {
    const layer = super.getLayer(id);
    this.afterLayerRead?.(id);
    return layer;
  }
  override moveLayer(id: string, before?: string): void {
    this.moves++;
    super.moveLayer(id, before);
    this.afterMove?.();
  }
}

const observerDescriptor = Object.getOwnPropertyDescriptor(window, 'IntersectionObserver');
const contextDescriptor = Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, 'getContext')!;
const originalContext = HTMLCanvasElement.prototype.getContext;

async function ready(element: LyraMap): Promise<ReadBoundaryMap> {
  await waitUntil(() => element.map !== undefined, 'native map is created');
  const peer = element.map as unknown as ReadBoundaryMap;
  peer.fire('load');
  await element.updateComplete;
  await element.whenStyleReady();
  return peer;
}

async function mount() {
  const wrapper = await fixture<HTMLDivElement>(html`<div></div>`);
  const element = document.createElement('lr-map') as LyraMap;
  element.engine = 'maplibre'; element.initialization = 'eager';
  element.mapStyle = LYRA_MAP_EMPTY_STYLE; element.controls = { attribution: false };
  (element as unknown as { loadLibrary: () => Promise<unknown> }).loadLibrary = async () => ({ Map: ReadBoundaryMap });
  wrapper.append(element);
  return { element, wrapper, peer: await ready(element) };
}

describe('lr-map ownership after native style reads', () => {
  before(async () => { await loadMapOwnedFeatureRuntime(); await loadMapFeatureStateRuntime(); });
  beforeEach(() => {
    ReadBoundaryMap.initialReady = true;
    Object.defineProperty(window, 'IntersectionObserver', { configurable: true, value: undefined });
    Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', { configurable: true, writable: true,
      value(this: HTMLCanvasElement, id: string, ...rest: unknown[]) {
        return id === 'webgl2' ? {} : originalContext.call(this, id as never, ...(rest as []));
      } });
  });
  afterEach(() => {
    fixtureCleanup();
    if (observerDescriptor) Object.defineProperty(window, 'IntersectionObserver', observerDescriptor);
    else Reflect.deleteProperty(window, 'IntersectionObserver');
    Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', contextDescriptor);
  });

  for (const phase of ['verification', 'rollback inspection'] as const) {
    it(`stops basemap order writes when ${phase} disconnects, then applies the order after reconnection`, async () => {
      const { element, peer, wrapper } = await mount();
      let retired = false;
      peer.afterMove = () => {
        if (phase === 'verification' && peer.moves < 2) return;
        peer.afterMove = undefined;
        peer.afterStyleRead = () => {
          peer.afterStyleRead = undefined;
          retired = true;
          element.remove();
        };
        if (phase === 'rollback inspection') throw new Error('Move failed after changing native order');
      };
      element.styleOverrides = [{ layerId: 'a', before: null }, { layerId: 'b', before: null }];
      await element.updateComplete;
      await waitUntil(() => peer.removed, 'native read retires the map');
      expect(retired, 'the armed native read actually ran').to.equal(true);
      expect(peer.moves, 'no rollback writes follow the retiring read').to.equal(phase === 'verification' ? 2 : 1);
      const retiredOrder = [...peer.order];
      wrapper.append(element);
      const replacement = await ready(element);
      expect(replacement === peer).to.equal(false);
      expect(replacement.order).to.deep.equal(['base', 'labels', 'a', 'b']);
      expect(peer.order, 'replacement initialization leaves retired resources untouched').to.deep.equal(retiredOrder);
    });
  }

  for (const method of ['getStyle', 'getLayer'] as const) {
    it(`rejects basemap state after ${method} disconnects during opt-in and accepts it after reconnection`, async () => {
      const { element, peer, wrapper } = await mount();
      const target = { origin: 'basemap' as const, source: 'basemap', id: 0 };
      expect(element.setFeatureState(target, { selected: true }), 'basemap state requires opt-in').to.equal(false);
      let retired = false;
      const retire = () => {
        peer.afterStyleRead = undefined; peer.afterLayerRead = undefined;
        retired = true; element.remove();
      };
      if (method === 'getStyle') peer.afterStyleRead = retire;
      else peer.afterLayerRead = id => { if (id === 'base') retire(); };
      element.interactiveBasemapLayers = [{ layerId: 'base' }];
      await element.updateComplete;
      await waitUntil(() => peer.removed, 'native read retires the map');
      expect(retired, 'the selected native read actually ran').to.equal(true);
      expect(element.setFeatureState(target, { selected: true }), 'a retired route cannot accept state').to.equal(false);
      expect(peer.stateCalls.length, 'retired discovery never writes native state').to.equal(0);
      wrapper.append(element);
      const replacement = await ready(element);
      expect(replacement === peer).to.equal(false);
      expect(element.setFeatureState(target, { selected: true }), 'current basemap opt-in admits state').to.equal(true);
      expect(element.getFeatureState(target)).to.deep.equal({ selected: true });
      expect(replacement.stateCalls.some(call => call.kind === 'set' && call.target.source === 'basemap')).to.equal(true);
      expect(peer.stateCalls.length, 'recovery never replays into the retired map').to.equal(0);
    });
  }
});
