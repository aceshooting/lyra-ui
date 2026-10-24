import { expect, fixture, fixtureCleanup, html, nextFrame, waitUntil } from '@open-wc/testing';
import { captureReentrantUpdateWarning } from '../../../../test/expected-lit-update.js';
import { ControlMapEngine } from '../../../../test/map-control-engine.js';
import { loadMapOwnedFeatureRuntime } from './map-feature-loader.js';
import { LYRA_MAP_EMPTY_STYLE, type LyraMap } from './map.js';

type Layer = { id: string; type?: string; source?: string; layout?: Record<string, unknown>;
  paint?: Record<string, unknown>; minzoom?: number; maxzoom?: number; filter?: unknown };
type Mutation = { kind: 'layout' | 'paint' | 'range' | 'filter'; id: string; key: string; value: unknown };
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(done => { resolve = done; });
  return { promise, resolve };
}

class TransitionMap extends ControlMapEngine {
  sourceAdds = 0;
  layerAdds = 0;
  repaints = 0;
  styles = 0;
  readonly mutations: Mutation[] = [];
  afterMutation?: (mutation: Mutation) => void;
  retiredLayers?: Layer[];
  preparation?: ReturnType<typeof deferred>;
  preparations = 0;
  override prepareFeatures(requirements: unknown): Promise<void> {
    this.preparations++;
    return this.preparation?.promise ?? super.prepareFeatures(requirements);
  }
  override addSource(id: string, source?: unknown): this { this.sourceAdds++; return super.addSource(id, source); }
  override addLayer(layer: { id: string }, before?: string): this { this.layerAdds++; return super.addLayer(structuredClone(layer), before); }
  override setStyle(): this { this.styles++; return super.setStyle(); }
  override remove(): void { this.retiredLayers = structuredClone([...this.layers.values()]) as Layer[]; super.remove(); }
  override triggerRepaint(): void { this.repaints++; super.triggerRepaint(); }
  layer(id: string): Layer {
    const layer = this.layers.get(id) as Layer | undefined;
    if (!layer) throw new Error(`Missing native layer ${id}`);
    return layer;
  }
  private write(kind: Mutation['kind'], id: string, key: string, value: unknown): void {
    const mutation = { kind, id, key, value: structuredClone(value) };
    this.mutations.push(mutation); this.afterMutation?.(mutation);
  }
  override setPaintProperty(id?: string, key?: string, value?: unknown): this {
    if (id === undefined || key === undefined) throw new Error('Missing native paint target');
    const paint = this.layer(id).paint ??= {};
    if (value === null) delete paint[key]; else paint[key] = structuredClone(value);
    this.write('paint', id, key, value); return this;
  }
  getPaintProperty(id: string, key: string): unknown { return this.layer(id).paint?.[key]; }
  setLayoutProperty(id: string, key: string, value: unknown): this {
    const layout = this.layer(id).layout ??= {};
    if (value === null) delete layout[key]; else layout[key] = structuredClone(value);
    this.write('layout', id, key, value); return this;
  }
  getLayoutProperty(id: string, key: string): unknown { return this.layer(id).layout?.[key]; }
  setFilter(id: string, value: unknown): this {
    if (value === null) delete this.layer(id).filter; else this.layer(id).filter = structuredClone(value);
    this.write('filter', id, 'filter', value); return this;
  }
  setLayerZoomRange(id: string, minzoom: number, maxzoom: number): this {
    Object.assign(this.layer(id), { minzoom, maxzoom });
    this.write('range', id, 'range', [minzoom, maxzoom]); return this;
  }
}

const points = { type: 'FeatureCollection' as const, features: [
  { type: 'Feature' as const, id: 'point', properties: { name: 'Place', kind: 'quiet' },
    geometry: { type: 'Point' as const, coordinates: [1, 2] } },
] };
const style = { ...LYRA_MAP_EMPTY_STYLE, glyphs: 'https://example.test/{fontstack}/{range}.pbf' };
const observerDescriptor = Object.getOwnPropertyDescriptor(window, 'IntersectionObserver');
const contextDescriptor = Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, 'getContext')!;
const originalContext = HTMLCanvasElement.prototype.getContext;

async function mount(rows: LyraMap['dataLayers']) {
  const wrapper = await fixture<HTMLDivElement>(html`<div style="--transition-ink:rgb(10, 20, 30)"></div>`);
  const element = document.createElement('lr-map') as LyraMap;
  element.style.cssText = 'inline-size:400px;block-size:300px';
  element.engine = 'maplibre'; element.initialization = 'eager';
  element.mapStyle = style; element.controls = { attribution: false }; element.dataLayers = rows;
  element.strings = { mapInitializationFailed: 'Map update unavailable' };
  (element as unknown as { loadLibrary: () => Promise<unknown> }).loadLibrary = async () => ({ Map: TransitionMap });
  wrapper.append(element);
  await waitUntil(() => element.map !== undefined); await element.updateComplete;
  const peer = element.map as unknown as TransitionMap;
  peer.fire('load'); await element.whenStyleReady(); await settle(element, peer);
  return { element, peer, wrapper };
}
async function settle(element: LyraMap, peer: TransitionMap): Promise<void> {
  await element.updateComplete; peer.idle = true; peer.fire('idle');
  await element.whenIdle(); await element.updateComplete;
}
async function rejected(element: LyraMap): Promise<void> {
  await element.updateComplete;
  await element.whenIdle().catch(() => undefined);
}
function label(peer: TransitionMap): Layer {
  const result = [...peer.layers.values()].find(value => (value as Layer).id.endsWith('-label')) as Layer | undefined;
  if (!result) throw new Error('Expected the native label layer');
  return result;
}

describe('lr-map resource transition ownership', () => {
  before(() => loadMapOwnedFeatureRuntime());
  beforeEach(() => {
    TransitionMap.initialReady = true; TransitionMap.prepare = undefined;
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

  it('rejects newly requested row bounds before mutation when the native capability is absent and recovers in place', async () => {
    const row = { sourceId: 'places', geojson: points };
    const { element, peer } = await mount([row]);
    const source = [...peer.sources.values()][0], previous = structuredClone([...peer.layers]);
    const sourceAdds = peer.sourceAdds, layerAdds = peer.layerAdds;
    Object.defineProperty(peer, 'setLayerZoomRange', { configurable: true, value: undefined });
    element.dataLayers = [{ ...row, minZoom: 2, maxZoom: 8 }];
    await rejected(element);
    await waitUntil(() => element.shadowRoot!.querySelector('[part="configuration-error"]') !== null);
    expect(peer.removed).to.equal(false);
    expect(peer.sourceAdds).to.equal(sourceAdds); expect(peer.layerAdds).to.equal(layerAdds);
    expect([...peer.layers]).to.deep.equal(previous);
    Reflect.deleteProperty(peer, 'setLayerZoomRange');
    element.dataLayers = [{ ...row, minZoom: 3, maxZoom: 7 }];
    await settle(element, peer);
    expect([...peer.sources.values()][0] === source).to.equal(true);
    expect(peer.sourceAdds).to.equal(sourceAdds); expect(peer.layerAdds).to.equal(layerAdds);
    for (const layer of peer.layers.values()) expect(layer).to.include({ minzoom: 3, maxzoom: 7 });
    expect(element.shadowRoot!.querySelectorAll('[part="configuration-error"]').length).to.equal(0);
  });

  it('keeps the committed order when native layer movement is unavailable and applies the corrected request once restored', async () => {
    const first = { sourceId: 'first', geojson: points }, second = { sourceId: 'second', geojson: points };
    const { element, peer } = await mount([first, second]);
    const original = [...peer.order], sources = [...peer.sources.values()], sourceAdds = peer.sourceAdds;
    Object.defineProperty(peer, 'moveLayer', { configurable: true, value: undefined });
    element.dataLayers = [first, { ...second, before: 'first' }];
    await rejected(element);
    await waitUntil(() => element.shadowRoot!.querySelector('[part="configuration-error"]') !== null);
    expect(peer.order).to.deep.equal(original); expect(peer.sourceAdds).to.equal(sourceAdds);
    expect(peer.removed).to.equal(false);
    Reflect.deleteProperty(peer, 'moveLayer');
    element.dataLayers = [first, { ...second, before: 'first' }];
    await settle(element, peer);
    expect(peer.order).to.deep.equal([...original.slice(3), ...original.slice(0, 3)]);
    expect([...peer.sources.values()].every((source, index) => source === sources[index])).to.equal(true);
    expect(peer.sourceAdds).to.equal(sourceAdds);
  });

  it('restores all changed label layout and paint after a native paint write mutates then fails, and reconnects with the new request', async () => {
    const row = { sourceId: 'places', geojson: points,
      label: { field: 'name', anchor: 'top' as const, size: 12, color: 'rgb(10, 20, 30)', haloWidth: 1 } };
    const { element, peer, wrapper } = await mount([row]);
    const previous = structuredClone(label(peer));
    const next = { ...row, label: { ...row.label, anchor: 'bottom' as const, size: 18, color: 'rgb(70, 80, 90)', haloWidth: 2 } };
    peer.mutations.length = 0;
    peer.afterMutation = mutation => {
      if (mutation.id === previous.id && mutation.kind === 'paint' && mutation.key === 'text-halo-width') {
        peer.afterMutation = undefined;
        throw new Error('Native label paint failed');
      }
    };
    element.dataLayers = [next]; await rejected(element);
    await waitUntil(() => peer.removed);
    expect(peer.retiredLayers?.find(layer => layer.id === previous.id)).to.deep.equal(previous);
    const writes = peer.mutations.filter(mutation => mutation.id === previous.id);
    expect(writes.some(write => write.kind === 'layout' && write.key === 'text-anchor' && write.value === 'bottom')).to.equal(true);
    expect(writes.some(write => write.kind === 'paint' && write.key === 'text-color' && write.value === 'rgb(70, 80, 90)')).to.equal(true);
    expect(writes.at(-1)).to.include({ kind: 'layout', key: 'text-size', value: 12 });
    await waitUntil(() => element.shadowRoot!.textContent?.includes('Map update unavailable') === true);
    expect(element.shadowRoot!.textContent).not.to.include('Native label paint failed');
    element.remove(); wrapper.append(element);
    await waitUntil(() => element.map !== undefined);
    const recovered = element.map as unknown as TransitionMap;
    recovered.fire('load'); await element.whenStyleReady(); await settle(element, recovered);
    expect(recovered === peer).to.equal(false);
    expect(label(recovered).layout).to.include({ 'text-anchor': 'bottom', 'text-size': 18 });
    expect(label(recovered).paint).to.include({ 'text-color': 'rgb(70, 80, 90)', 'text-halo-width': 2 });
  });

  it('abandons obsolete label paint after a native callback replaces both style and rows without rolling back the new style', async () => {
    const row = { sourceId: 'places', geojson: points, label: { field: 'name', color: 'rgb(10, 20, 30)', haloWidth: 1 } };
    const { element, peer } = await mount([row]);
    const originalSource = [...peer.sources.values()][0];
    const latest = { ...row, label: { field: 'name', color: 'rgb(100, 110, 120)', haloWidth: 3 } };
    let replaced = false;
    const oldWrites: string[] = [];
    peer.afterMutation = mutation => {
      if (!mutation.id.endsWith('-label')) return;
      if (peer.styles === 0) oldWrites.push(mutation.key);
      if (!replaced && mutation.key === 'text-color') {
        replaced = true;
        element.dataLayers = [latest];
        element.mapStyle = { ...style, name: 'Replacement basemap' };
      }
    };
    await captureReentrantUpdateWarning(element.localName, async () => {
      element.dataLayers = [{ ...row, label: { ...row.label, color: 'rgb(40, 50, 60)', haloWidth: 2 } }];
      await element.updateComplete; await element.whenStyleReady(); await settle(element, peer);
    });
    expect(replaced).to.equal(true);
    expect(oldWrites).to.deep.equal(['text-color']);
    expect(peer.styles).to.equal(1); expect(peer.removed).to.equal(false);
    expect(element.map === peer).to.equal(true);
    expect([...peer.sources.values()][0] === originalSource).to.equal(false);
    expect(label(peer).paint).to.include({ 'text-color': 'rgb(100, 110, 120)', 'text-halo-width': 3 });
    expect(element.shadowRoot!.querySelectorAll('[part="error"]').length).to.equal(0);
  });

  it('defers category repaint during pending native preparation and commits the latest theme with the new family', async () => {
    const row = { sourceId: 'places', geojson: points, color: 'var(--transition-ink)', point: { field: 'kind' } };
    const { element, peer, wrapper } = await mount([row]);
    const source = [...peer.sources.values()][0], before = structuredClone([...peer.layers]);
    const sourceAdds = peer.sourceAdds, preparations = peer.preparations;
    const pending = deferred(); peer.preparation = pending;
    element.dataLayers = [{ ...row, label: { field: 'name', color: 'var(--transition-ink)' } }];
    await element.updateComplete;
    await waitUntil(() => peer.preparations > preparations);
    let idle = false;
    const settled = element.whenIdle().then(() => { idle = true; });
    try {
      element.hiddenCategories = ['quiet'];
      wrapper.style.setProperty('--transition-ink', 'rgb(90, 100, 110)');
      await element.updateComplete; await nextFrame(); await nextFrame();
      expect(idle).to.equal(false);
      expect([...peer.layers]).to.deep.equal(before);
      expect(peer.sourceAdds).to.equal(sourceAdds);
      pending.resolve(); await settled; await settle(element, peer);
      expect([...peer.sources.values()][0] === source).to.equal(true);
      expect(peer.sourceAdds).to.equal(sourceAdds);
      expect(label(peer).paint?.['text-color']).to.equal('rgb(90, 100, 110)');
      const circle = [...peer.layers.values()].find(layer => (layer as Layer).type === 'circle') as Layer;
      expect(circle.paint?.['circle-color']).to.equal('rgb(90, 100, 110)');
      expect(circle.paint?.['circle-opacity']).to.deep.equal(['match', ['get', 'kind'], 'quiet', 0.15, 1]);
      expect(peer.removed).to.equal(false);
    } finally { pending.resolve(); await settled; }
  });

  it('finishes only the latest category repaint when a native paint callback changes public hidden categories', async () => {
    const row = { sourceId: 'places', geojson: points, point: { field: 'kind' } };
    const { element, peer } = await mount([row]);
    const source = [...peer.sources.values()][0], sourceAdds = peer.sourceAdds, layerAdds = peer.layerAdds;
    let replaced = false;
    peer.afterMutation = mutation => {
      if (!replaced && mutation.key === 'circle-opacity') {
        replaced = true;
        element.hiddenCategories = ['other'];
      }
    };
    await captureReentrantUpdateWarning(element.localName, async () => {
      element.hiddenCategories = ['quiet'];
      await element.updateComplete; await settle(element, peer);
    });
    expect(replaced).to.equal(true);
    expect(element.hiddenCategories).to.deep.equal(['other']);
    const circle = [...peer.layers.values()].find(layer => (layer as Layer).type === 'circle') as Layer;
    const expected = ['match', ['get', 'kind'], 'other', 0.15, 1];
    expect(circle.paint?.['circle-opacity']).to.deep.equal(expected);
    expect(circle.paint?.['circle-stroke-opacity']).to.deep.equal(expected);
    expect([...peer.sources.values()][0] === source).to.equal(true);
    expect(peer.sourceAdds).to.equal(sourceAdds); expect(peer.layerAdds).to.equal(layerAdds);
    expect(peer.removed).to.equal(false);
  });
});
