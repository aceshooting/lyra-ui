import { expect, fixture, fixtureCleanup, html, waitUntil } from '@open-wc/testing';
import { ControlMapEngine } from '../../../../test/map-control-engine.js';
import { normalizeMapControlOptions } from './map-control-options.js';
import {
  MapControlsLifecycle, type MapManagedControl, type MapManagedControlConstructor,
  type MapControlLifecyclePeer, type MapControlLifecycleEvent,
} from './map-controls-lifecycle.js';
import './map.js';
import { LYRA_MAP_EMPTY_STYLE, type LyraMap } from './map.js';

class NativeControl implements MapManagedControl {
  readonly root = document.createElement('div');
  readonly listeners = new Map<string, Set<(event: unknown) => void>>();
  readonly removedSubscriptions: string[] = [];
  beforeOff?: () => void;
  onAdd(): HTMLElement { return this.root; }
  on(type: string, callback: (event: unknown) => void): void {
    const listeners = this.listeners.get(type) ?? new Set();
    listeners.add(callback); this.listeners.set(type, listeners);
  }
  off(type: string, callback: (event: unknown) => void): void {
    this.listeners.get(type)?.delete(callback);
    this.removedSubscriptions.push(type);
    this.beforeOff?.();
  }
  fire(type: string, event: unknown): void {
    for (const callback of [...this.listeners.get(type) ?? []]) callback(event);
  }
}

const geolocate = normalizeMapControlOptions({ geolocate: true, attribution: false }).controls;

async function controls(load?: () => Promise<MapManagedControlConstructor | undefined>) {
  const corner = await fixture<HTMLDivElement>(html`<div></div>`);
  const created: NativeControl[] = [], removed: MapManagedControl[] = [];
  const events: MapControlLifecycleEvent[] = [], failures: string[] = [];
  const map: MapControlLifecyclePeer = {
    addControl(control) { const root = control.onAdd?.(); if (root) corner.append(root); },
    removeControl(control) { removed.push(control); (control as NativeControl).root.remove(); },
    controlContainer() { return corner; },
  };
  const context = {
    isCurrent: () => true,
    onEvent: (event: MapControlLifecycleEvent) => { events.push(event); },
    onFailure: (failure: { kind: string }) => { failures.push(failure.kind); },
  };
  const manager = new MapControlsLifecycle(load ?? (async () => class extends NativeControl {
    constructor() { super(); created.push(this); }
  }));
  return { manager, map, context, corner, created, removed, events, failures };
}

describe('native map control boundary containment', () => {
  afterEach(() => fixtureCleanup());

  it('reports failed corner lookup without losing the installed root and later synchronizes it', async () => {
    const h = await controls();
    h.map.controlContainer = () => { throw new Error('Native control corner unavailable'); };
    try {
      await h.manager.sync(h.map, geolocate, h.context);
      expect(h.failures).to.deep.equal(['geolocate']);
      expect(h.corner.children.length).to.equal(1);
      expect(h.created.length).to.equal(1);
      h.map.controlContainer = () => h.corner;
      await h.manager.sync(h.map, geolocate, h.context);
      expect(h.created.length).to.equal(1);
      h.created[0]!.fire('geolocate', { coords: { longitude: 6, latitude: 49, accuracy: 2 } });
      expect(h.events).to.deep.equal([{ kind: 'geolocate-success', lngLat: [6, 49], accuracy: 2 }]);
    } finally { h.manager.dispose(); }
    expect(h.corner.children.length).to.equal(0);
    expect(h.removed.length).to.equal(1);
  });

  it('contains failure feedback that throws during native corner reconciliation', async () => {
    const h = await controls();
    let feedback = 0;
    h.map.controlContainer = () => { throw new Error('Native corner unavailable'); };
    h.context.onFailure = () => { feedback++; throw new Error('Feedback unavailable'); };
    try {
      await h.manager.sync(h.map, geolocate, h.context);
      expect(feedback).to.equal(1);
      expect(h.corner.children.length).to.equal(1);
    } finally { h.manager.dispose(); }
    expect(h.corner.children.length).to.equal(0);
  });

  it('retires every exact listener even when native removal hooks throw', async () => {
    const h = await controls();
    await h.manager.sync(h.map, geolocate, h.context);
    const control = h.created[0]!;
    const retained = [...control.listeners.values()].flatMap(listeners => [...listeners]);
    control.beforeOff = () => { throw new Error('Native listener already removed'); };
    h.map.removeControl = () => { h.removed.push(control); control.root.remove(); throw new Error('Native root already removed'); };
    h.manager.dispose(); h.manager.dispose();
    for (const callback of retained) callback({ coords: { longitude: 6, latitude: 49, accuracy: 2 } });
    expect(control.removedSubscriptions).to.deep.equal(['error', 'outofmaxbounds', 'geolocate']);
    expect([...control.listeners.values()].every(listeners => listeners.size === 0)).to.equal(true);
    expect(h.removed.length).to.equal(1);
    expect(h.corner.children.length).to.equal(0);
    expect(h.events.length).to.equal(0);
  });

  it('does not install controls when the caller cannot validate its current lifecycle', async () => {
    const h = await controls();
    h.context.isCurrent = () => { throw new Error('Owner no longer available'); };
    try {
      await h.manager.sync(h.map, geolocate, h.context);
      expect(h.created.length).to.equal(0);
      expect(h.corner.children.length).to.equal(0);
      expect(h.failures.length).to.equal(0);
    } finally { h.manager.dispose(); }
  });

  it('contains failure feedback when a native control constructor is unavailable', async () => {
    const h = await controls(async () => undefined);
    let feedback = 0;
    h.context.onFailure = () => { feedback++; throw new Error('Feedback unavailable'); };
    try {
      await h.manager.sync(h.map, geolocate, h.context);
      expect(feedback).to.equal(1);
      expect(h.corner.children.length).to.equal(0);
      expect(h.removed.length).to.equal(0);
    } finally { h.manager.dispose(); }
  });

  it('omits positions from primitive native success payloads and accepts a later finite position', async () => {
    const h = await controls();
    try {
      await h.manager.sync(h.map, geolocate, h.context);
      for (const event of [null, undefined, 4, 'position']) h.created[0]!.fire('geolocate', event);
      expect(h.events).to.deep.equal(Array.from({ length: 4 }, () => ({ kind: 'geolocate-success' })));
      h.created[0]!.fire('geolocate', { coords: { longitude: 6, latitude: 49, accuracy: 0 } });
      expect(h.events.at(-1)).to.deep.equal({ kind: 'geolocate-success', lngLat: [6, 49], accuracy: 0 });
    } finally { h.manager.dispose(); }
  });

  it('does not publish a geolocation error whose native code getter retires its control', async () => {
    const h = await controls();
    await h.manager.sync(h.map, geolocate, h.context);
    h.created[0]!.fire('error', { get code() { h.manager.dispose(); return 1; } });
    expect(h.events.length).to.equal(0);
    expect(h.corner.children.length).to.equal(0);
    expect(h.removed.length).to.equal(1);
  });

  it('does not install a native root after reading onAdd retires its owner', async () => {
    let manager: MapControlsLifecycle;
    let reads = 0;
    class RetiringControl {
      get onAdd() { reads++; manager.dispose(); return () => document.createElement('div'); }
    }
    const h = await controls(async () => RetiringControl);
    manager = h.manager;
    try {
      await manager.sync(h.map, normalizeMapControlOptions({ navigation: true, attribution: false }).controls, h.context);
      expect(reads).to.equal(1);
      expect(h.corner.children.length).to.equal(0);
      expect(h.removed.length).to.equal(0);
      expect(h.failures.length).to.equal(0);
    } finally { manager.dispose(); }
  });
});

class MeasurementMap extends ControlMapEngine {
  override project(point: readonly [number, number]) { return { x: 100 + point[0] * 10, y: 100 + point[1] * 10 }; }
}
const observerDescriptor = Object.getOwnPropertyDescriptor(window, 'IntersectionObserver');
const contextDescriptor = Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, 'getContext');
const originalContext = HTMLCanvasElement.prototype.getContext;

async function mapFixture(configure: (element: LyraMap) => void) {
  const wrapper = await fixture<HTMLDivElement>(html`<div style="width:400px;height:300px"></div>`);
  const element = document.createElement('lr-map') as LyraMap;
  element.style.cssText = 'width:100%;height:100%';
  element.engine = 'maplibre'; element.initialization = 'eager'; element.mapStyle = LYRA_MAP_EMPTY_STYLE;
  element.controls = { attribution: false }; element.locale = 'en';
  (element as unknown as { loadLibrary: () => Promise<unknown> }).loadLibrary = async () => ({ Map: MeasurementMap });
  configure(element); wrapper.append(element);
  await waitUntil(() => element.map !== undefined); await element.updateComplete;
  const peer = element.map as unknown as MeasurementMap;
  peer.fire('load'); await element.whenStyleReady(); await element.updateComplete;
  peer.canvas.style.cssText = 'width:100%;height:100%;display:block';
  element.shadowRoot!.querySelector('[part="container"]')!.append(peer.canvas);
  await waitUntil(() => peer.canvas.clientWidth > 0 && peer.canvas.clientHeight > 0);
  return { element, peer };
}

async function vertex(element: LyraMap, peer: MeasurementMap, point: readonly [number, number]): Promise<void> {
  peer.fire('click', { point: { x: 100, y: 100 }, lngLat: { lng: point[0], lat: point[1] } });
  await element.updateComplete;
  peer.idle = true; peer.fire('idle');
  await element.whenIdle(); await element.updateComplete;
}

describe('lr-map rendered measurements and legend snapshots', () => {
  beforeEach(() => {
    MeasurementMap.initialReady = true; MeasurementMap.prepare = undefined;
    Object.defineProperty(window, 'IntersectionObserver', { configurable: true, value: undefined });
    Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
      configurable: true, writable: true,
      value(this: HTMLCanvasElement, id: string, ...rest: unknown[]) {
        return id === 'webgl2' ? {} : originalContext.call(this, id as never, ...(rest as []));
      },
    });
  });
  afterEach(() => {
    fixtureCleanup();
    if (observerDescriptor) Object.defineProperty(window, 'IntersectionObserver', observerDescriptor);
    else Reflect.deleteProperty(window, 'IntersectionObserver');
    if (contextDescriptor) Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', contextDescriptor);
  });

  for (const [longitude, expected] of [[0.001, /^Length: 111 m$/], [0.05, /^Length: 5\.56 km$/], [1, /^Length: 111\.2 km$/]] as const) {
    it(`renders the localized distance unit and precision for a ${longitude}-degree line`, async () => {
      const { element, peer } = await mapFixture(el => {
        el.drawMode = 'line'; el.drawingMeasurements = true;
        el.strings = { mapDrawingLength: 'Length: {value}' };
      });
      await waitUntil(() => element.shadowRoot?.querySelector<HTMLButtonElement>('[part="drawing-add"]')?.disabled === false);
      await vertex(element, peer, [0, 0]);
      expect(element.shadowRoot?.querySelectorAll('[part="drawing-summary"]').length).to.equal(0);
      await vertex(element, peer, [longitude, 0]);
      await waitUntil(() => element.shadowRoot?.querySelector('[part="drawing-summary"]') !== null);
      expect(element.shadowRoot?.querySelector('[part="drawing-summary"]')?.textContent).to.match(expected);
      await waitUntil(() => (element.shadowRoot?.querySelectorAll('[part="drawing-measurement"]').length ?? 0) > 0);
      expect(element.shadowRoot?.querySelector('[part="drawing-measurements"]')?.getAttribute('aria-hidden')).to.equal('true');
      element.drawingMeasurements = false; await element.updateComplete;
      expect(element.shadowRoot?.querySelectorAll('[part="drawing-summary"], [part="drawing-measurements"]').length).to.equal(0);
      expect(element.drawMode).to.equal('line');
    });
  }

  for (const [side, unit] of [[0.001, 'm2'], [0.02, 'km2']] as const) {
    it(`uses the caller's ${unit} area label in a rendered polygon summary`, async () => {
      const { element, peer } = await mapFixture(el => {
        el.drawMode = 'polygon'; el.drawingMeasurements = true;
        el.strings = { mapDrawingArea: 'Area: {value}', mapSquareMeters: 'm2 {value}', mapSquareKilometers: 'km2 {value}' };
      });
      await waitUntil(() => element.shadowRoot?.querySelector<HTMLButtonElement>('[part="drawing-add"]')?.disabled === false);
      await vertex(element, peer, [0, 0]); await vertex(element, peer, [side, 0]); await vertex(element, peer, [side, side]);
      await waitUntil(() => (element.shadowRoot?.querySelectorAll('[part="drawing-measurement"][data-kind="area"]').length ?? 0) > 0);
      expect(element.shadowRoot?.querySelector('[part="drawing-summary"]')?.textContent).to.match(new RegExp(`^Area: ${unit} [0-9]`));
      expect(element.shadowRoot?.querySelector('[part="drawing-measurement"][data-kind="area"]')?.textContent).to.match(new RegExp(`^Area: ${unit} [0-9]`));
      expect(element.completeDrawing()).to.equal(true); await element.updateComplete;
      expect(element.shadowRoot?.querySelectorAll('[part="drawing-summary"], [part="drawing-measurements"]').length).to.equal(0);
    });
  }

  it('keeps the rendered gradient snapshot when its original or canonical array is recommitted', async () => {
    const stops: [number, string][] = [[0, 'red'], [10, 'blue']];
    const ticks = [{ value: 5, label: 'Midpoint' }];
    const { element } = await mapFixture(el => { el.legendGradient = stops; el.legendGradientTicks = ticks; });
    const canonical = element.legendGradient;
    expect(element.shadowRoot?.querySelector('[part="legend-lo"]')?.textContent?.trim()).to.equal('0');
    stops[0]![0] = 100; ticks[0]!.label = 'Changed externally';
    element.legendGradient = stops; element.legendGradientTicks = ticks;
    await element.updateComplete;
    expect(element.legendGradient).to.deep.equal([[0, 'red'], [10, 'blue']]);
    expect(element.legendGradientTicks).to.deep.equal([{ value: 5, label: 'Midpoint' }]);
    expect(element.shadowRoot?.textContent).to.include('Midpoint');
    expect(element.shadowRoot?.textContent).not.to.include('Changed externally');
    element.legendGradient = canonical; await element.updateComplete;
    expect(element.shadowRoot?.querySelector('[part="legend-lo"]')?.textContent?.trim()).to.equal('0');
    element.legendGradientTicks = null as unknown as LyraMap['legendGradientTicks'];
    await element.updateComplete;
    expect(element.legendGradientTicks.length).to.equal(0);
    expect(element.shadowRoot?.textContent).not.to.include('Midpoint');
  });
});
