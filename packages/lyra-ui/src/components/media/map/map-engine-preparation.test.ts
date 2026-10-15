import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import type { LyraMap, LyraMapEngine, LyraMapFeatureRequirements } from './map.class.js';
import './map.js';
import { LYRA_DEFAULT_STRINGS, registerLyraLocale } from '../../../internal/localization.js';

const blankStyle = { version: 8 as const, sources: {}, layers: [] };
const geojson = { type: 'FeatureCollection' as const, features: [] };

function deferred(): { promise: Promise<void>; resolve(): void; reject(error: Error): void } {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

class PreparedMap {
  readonly canvas = document.createElement('canvas');
  readonly listeners = new Map<string, Set<(event: Record<string, unknown>) => void>>();
  readonly sources = new Map<string, { setData(data: unknown): void }>();
  readonly layers = new Map<string, { id: string; type: string }>();
  readonly preparations: { requirements: LyraMapFeatureRequirements; signal?: AbortSignal; pending: ReturnType<typeof deferred> }[] = [];
  removals = 0;
  constructor(readonly options: { container: HTMLElement }) { options.container.append(this.canvas); }
  prepareFeatures(requirements: LyraMapFeatureRequirements, options?: { signal?: AbortSignal }): Promise<void> {
    const pending = deferred();
    this.preparations.push({ requirements, signal: options?.signal, pending });
    return pending.promise;
  }
  on(name: string, callback: (event: Record<string, unknown>) => void): this {
    if (!this.listeners.has(name)) this.listeners.set(name, new Set());
    this.listeners.get(name)!.add(callback);
    return this;
  }
  once(name: string, callback: (event: Record<string, unknown>) => void): this {
    const once = (event: Record<string, unknown>): void => { this.listeners.get(name)?.delete(once); callback(event); };
    return this.on(name, once);
  }
  fire(name: string): void { for (const callback of [...this.listeners.get(name) ?? []]) callback({}); }
  getCanvas(): HTMLCanvasElement { return this.canvas; }
  getCenter(): { lng: number; lat: number } { return { lng: 0, lat: 0 }; }
  getZoom(): number { return 2; }
  setCenter(): void {}
  setZoom(): void {}
  resize(): void {}
  remove(): void { this.removals++; this.canvas.remove(); }
  setStyle(): this { this.sources.clear(); this.layers.clear(); return this; }
  getSource(id: string): { setData(data: unknown): void } | undefined { return this.sources.get(id); }
  addSource(id: string): this { this.sources.set(id, { setData() {} }); return this; }
  removeSource(id: string): this { this.sources.delete(id); return this; }
  getLayer(id: string): unknown { return this.layers.get(id); }
  addLayer(layer: { id: string; type: string }): this { this.layers.set(layer.id, layer); return this; }
  removeLayer(id: string): this { this.layers.delete(id); return this; }
  setPaintProperty(): this { return this; }
  queryRenderedFeatures(): unknown[] { return []; }
}

async function setup(engine?: LyraMapEngine): Promise<{
  element: LyraMap; peer: PreparedMap; selected: LyraMapEngine[]; restore(): void;
}> {
  const observer = window.IntersectionObserver;
  const context = HTMLCanvasElement.prototype.getContext;
  Object.defineProperty(window, 'IntersectionObserver', { configurable: true, value: undefined });
  Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
    configurable: true,
    value(this: HTMLCanvasElement, kind: string, ...args: unknown[]): unknown {
      return kind === 'webgl2' ? {} : Reflect.apply(context, this, [kind, ...args]);
    },
  });
  const restore = (): void => {
    Object.defineProperty(window, 'IntersectionObserver', { configurable: true, value: observer });
    HTMLCanvasElement.prototype.getContext = context;
  };
  try {
    const wrapper = await fixture<HTMLElement>(html`<div></div>`);
    const element = document.createElement('lr-map');
    const selected: LyraMapEngine[] = [];
    const seam = element as unknown as { loadLibrary(engine: LyraMapEngine): Promise<unknown> };
    seam.loadLibrary = async selectedEngine => { selected.push(selectedEngine); return { Map: PreparedMap }; };
    if (engine) element.engine = engine;
    element.mapStyle = blankStyle;
    element.dataLayers = [{ sourceId: 'points', geojson }];
    wrapper.append(element);
    await waitUntil(() => element.map !== undefined);
    return { element, peer: element.map as unknown as PreparedMap, selected, restore };
  } catch (error) { restore(); throw error; }
}

it('defaults to the modular engine and waits for actual generated families before first source/layer mutations', async () => {
  const { element, peer, selected, restore } = await setup();
  let loads = 0;
  element.addEventListener('lr-map-load', () => loads++);
  try {
    expect(element.engine).to.equal('modular');
    expect(selected).to.deep.equal(['modular']);
    peer.fire('load');
    expect(peer.preparations.length).to.equal(1);
    expect(peer.sources.size).to.equal(0);
    expect(peer.layers.size).to.equal(0);
    expect(loads).to.equal(0);
    expect(Object.values(peer.preparations[0]!.requirements.sources ?? {})).to.deep.equal([{ type: 'geojson', data: geojson }]);
    expect(peer.preparations[0]!.requirements.layers?.map(layer => (layer as { type: string }).type)).to.deep.equal(['fill', 'line', 'circle']);
    peer.preparations[0]!.pending.resolve();
    await waitUntil(() => loads === 1);
    expect([...peer.layers.values()].map(layer => layer.type)).to.deep.equal(['fill', 'line', 'circle']);
    expect(element.map === peer).to.be.true;
  } finally { element.remove(); restore(); }
});

it('prepares a newly selected heatmap family before replacing existing geometry layers', async () => {
  const { element, peer, restore } = await setup();
  try {
    peer.fire('load');peer.preparations[0]!.pending.resolve();
    await waitUntil(() => peer.layers.size === 3);
    element.dataLayers = [{ sourceId: 'points', geojson, kind: 'heatmap' }];
    await element.updateComplete;
    expect(peer.preparations.length).to.equal(2);
    expect([...peer.layers.values()].some(layer => layer.type === 'heatmap')).to.be.false;
    expect(peer.layers.size).to.equal(3);
    expect(peer.preparations[1]!.requirements.layers?.map(layer => (layer as { type: string }).type)).to.deep.equal(['heatmap']);
    peer.preparations[1]!.pending.resolve();
    await waitUntil(() => [...peer.layers.values()].some(layer => layer.type === 'heatmap'));
    expect(peer.layers.size).to.equal(1);
  } finally { element.remove(); restore(); }
});

it('keeps same-family data updates synchronous after successful preparation', async () => {
  const { element, peer, restore } = await setup();
  try {
    peer.fire('load');peer.preparations[0]!.pending.resolve();
    await waitUntil(() => peer.layers.size === 3);
    element.dataLayers = [{ sourceId: 'points', geojson: { ...geojson } }];
    await element.updateComplete;
    expect(peer.preparations.length).to.equal(1);
    expect(peer.layers.size).to.equal(3);
  } finally { element.remove(); restore(); }
});

it('aborts old overlay readiness when a replacement style starts and prepares its new style load', async () => {
  const { element, peer, restore } = await setup();
  try {
    peer.fire('load');
    element.mapStyle = { ...blankStyle, name: 'Replacement style' };
    await element.updateComplete;
    expect(peer.preparations[0]!.signal?.aborted).to.be.true;
    peer.fire('style.load');
    expect(peer.preparations.length).to.equal(2);
    peer.preparations[0]!.pending.resolve();
    await Promise.resolve();
    expect(peer.layers.size).to.equal(0);
    peer.preparations[1]!.pending.resolve();
    await waitUntil(() => peer.layers.size === 3);
    expect(element.map === peer).to.be.true;
  } finally { element.remove(); restore(); }
});

it('contains an asynchronous preparation failure in localized visible and light-DOM feedback', async () => {
  const { element, peer, restore } = await setup();
  try {
    element.strings = { mapInitializationFailed: 'Map preparation unavailable' };
    peer.fire('load');peer.preparations[0]!.pending.reject(new Error('Feature module unavailable'));
    await waitUntil(() => element.map === undefined);
    await element.updateComplete;
    const error = element.shadowRoot!.querySelector('[part="error"]');
    expect(error?.textContent).to.include('Map preparation unavailable');
    expect(error?.getAttribute('role')).to.equal(null);
    expect(error?.hasAttribute('aria-live')).to.be.false;
    await waitUntil(() => document.querySelector('[data-lr-live-region="assertive"]')?.textContent?.includes('Map preparation unavailable') === true);
    expect(peer.sources.size).to.equal(0);
    expect(peer.removals).to.equal(1);
  } finally { element.remove(); restore(); }
});

it('aborts superseded generated requirements and ignores their late failure', async () => {
  const { element, peer, restore } = await setup();
  try {
    peer.fire('load');
    element.dataLayers = [{ sourceId: 'density', geojson, kind: 'heatmap' }];
    await element.updateComplete;
    expect(peer.preparations[0]!.signal?.aborted).to.be.true;
    peer.preparations[0]!.pending.reject(new Error('obsolete preparation'));
    peer.preparations[1]!.pending.resolve();
    await waitUntil(() => peer.layers.size === 1);
    expect([...peer.layers.values()][0]!.type).to.equal('heatmap');
    expect(element.map === peer).to.be.true;
    expect(element.shadowRoot!.querySelectorAll('[part="error"]').length).to.equal(0);
  } finally { element.remove(); restore(); }
});

it('cancels preparation on disconnect and prepares a fresh map after reconnect', async () => {
  const { element, peer, restore } = await setup();
  try {
    peer.fire('load');element.remove();
    expect(peer.preparations[0]!.signal?.aborted).to.be.true;
    document.body.append(element);
    await waitUntil(() => element.map !== undefined);
    const next = element.map as unknown as PreparedMap;
    expect(next === peer).to.be.false;
    next.fire('load');
    peer.preparations[0]!.pending.resolve();
    await Promise.resolve();
    expect(peer.sources.size).to.equal(0);
    expect(next.sources.size).to.equal(0);
    next.preparations[0]!.pending.resolve();
    await waitUntil(() => next.layers.size === 3);
  } finally { element.remove(); restore(); }
});

it('uses the explicit native selection and retains synchronous mutations when readiness is absent', async () => {
  const { element, peer, selected, restore } = await setup('maplibre');
  try {
    Object.defineProperty(peer, 'prepareFeatures', { value: undefined });
    peer.fire('load');
    expect(selected).to.deep.equal(['maplibre']);
    expect(peer.layers.size).to.equal(3);
    expect(peer.preparations.length).to.equal(0);
    expect(element.map === peer).to.be.true;
    element.engine = 'modular';await element.updateComplete;
    expect(selected).to.deep.equal(['maplibre']);
    expect(element.map === peer).to.be.true;
  } finally { element.remove(); restore(); }
});

it('keeps a missing selected companion visible without constructing a native substitute', async () => {
  const element = document.createElement('lr-map');
  (element as unknown as { loadLibrary(): Promise<null> }).loadLibrary = async () => null;
  element.strings = { mapMissingLibrary: 'Selected map engine unavailable' };
  element.mapStyle = blankStyle;
  document.body.append(element);
  try {
    await waitUntil(() => element.shadowRoot!.querySelector('[part="error"]') !== null);
    expect(element.engine).to.equal('modular');
    expect(element.map).to.equal(undefined);
    expect(element.shadowRoot!.querySelector('[part="error"]')?.textContent).to.include('Selected map engine unavailable');
  } finally { element.remove(); }
});


for (const engine of ['modular', 'maplibre'] as const) {
  it(`names the selected ${engine} package in missing-peer feedback`, async () => {
    const element = document.createElement('lr-map');
    (element as unknown as { loadLibrary(): Promise<null> }).loadLibrary = async () => null;
    element.engine = engine;
    element.mapStyle = blankStyle;
    document.body.append(element);
    try {
      await waitUntil(() => element.shadowRoot!.querySelector('[part="error"]') !== null);
      expect(element.shadowRoot!.querySelector('[part="error"]')?.textContent).to.include(engine === 'modular' ? '@aceshooting/lyra-map' : 'maplibre-gl');
    } finally { element.remove(); }
  });
}

it('interpolates selected-engine feedback through a registered locale', async () => {
  registerLyraLocale('fr-x-map-engine', { ...LYRA_DEFAULT_STRINGS, mapMissingLibrary: 'Installer {package} pour afficher la carte.' });
  const element = document.createElement('lr-map');
  (element as unknown as { loadLibrary(): Promise<null> }).loadLibrary = async () => null;
  element.locale = 'fr-x-map-engine';
  element.mapStyle = blankStyle;
  document.body.append(element);
  try {
    await waitUntil(() => element.shadowRoot!.querySelector('[part="error"]') !== null);
    expect(element.shadowRoot!.querySelector('[part="error"]')?.textContent).to.include('Installer @aceshooting/lyra-map pour afficher la carte.');
  } finally { element.remove(); }
});
