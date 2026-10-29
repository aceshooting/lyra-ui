import { fixture, html, waitUntil } from '@open-wc/testing';
import { LyraMap, LYRA_MAP_EMPTY_STYLE } from '../src/components/media/map/map.js';
import * as loaders from '../src/components/media/map/map-feature-loader.js';
import type { SceneRenderInput } from '../src/components/media/map/map-scene-render-contract.js';
import { ScriptedOverlayMap } from './map-scripted-engine.js';

type Realm = Window & typeof globalThis;
type Listener = (event: Record<string, unknown>) => void;
export interface RenderBridgeHost {
  readonly signal: AbortSignal;
  isCurrent(): boolean;
  captureRenderInput(): SceneRenderInput;
  subscribeRenderInput(listener: () => void): () => void;
  onState(value: { state: 'pending' | 'installed' | 'empty' | 'unavailable'; acceptedSceneRevision: number;
    presentationRevision: number; allocationRevision: number | undefined; markerInstallationRevision: number }): void;
  onError(code: 'engine' | 'limit' | 'render' | 'context-lost'): void;
}
export interface BridgeRecord {
  readonly peer: RenderPeer;
  readonly host: RenderBridgeHost;
  readonly inputs: SceneRenderInput[];
  readonly visibility: boolean[];
  readonly calls: string[];
  disposed: boolean;
  visible: boolean;
  capture(): void;
}

export class RenderPeer extends ScriptedOverlayMap {
  readonly events = new Map<string, Set<Listener>>();
  readonly container: HTMLElement;
  readonly renderCanvas: HTMLCanvasElement;
  ready = false;
  removed = false;
  width = 640;
  height = 480;
  ratio = 1.25;
  appliedRatio: number | undefined;
  padding = { top: 3, right: 5, bottom: 7, left: 11 };
  rejectPadding = false;
  reads = { container: 0, ratio: 0, padding: 0 };
  repaints = 0;
  onRead: ((name: string) => void) | undefined;
  style: Record<string, unknown>;
  constructor(options: Record<string, unknown>, readonly trace: string[]) {
    super(options);
    this.container = options['container'] as HTMLElement;
    this.style = options['style'] as Record<string, unknown>;
    this.renderCanvas = this.container.ownerDocument.createElement('canvas');
    this.container.append(this.renderCanvas);
    Object.defineProperties(this.container, { clientWidth: { configurable: true, get: () => this.width },
      clientHeight: { configurable: true, get: () => this.height } });
    this.syncBacking();
  }
  override on(type: string, listener: Listener): this {
    const set = this.events.get(type) ?? new Set<Listener>(); set.add(listener); this.events.set(type, set); return this;
  }
  off(type: string, listener: Listener): this { this.events.get(type)?.delete(listener); return this; }
  override once(type: string, listener: Listener): this {
    const wrapped: Listener = event => { this.off(type, wrapped); listener(event); }; return this.on(type, wrapped);
  }
  override fire(type: string, event: Record<string, unknown> = {}): void {
    for (const listener of [...this.events.get(type) ?? []]) listener({ type, ...event });
  }
  override getCanvas(): HTMLCanvasElement { this.onRead?.('canvas'); return this.renderCanvas; }
  getContainer(): HTMLElement { this.reads.container++; this.onRead?.('container'); return this.container; }
  getPixelRatio(): number { this.reads.ratio++; const value = this.ratio; this.onRead?.('ratio'); return value; }
  getPadding() { this.reads.padding++; const value = { ...this.padding }; this.onRead?.('padding'); return value; }
  getPitch(): number { return 0; }
  getBearing(): number { return 0; }
  getProjection(): unknown { return { type: 'mercator' }; }
  getTerrain(): null { return null; }
  getStyle(): Record<string, unknown> { return this.style; }
  loaded(): boolean { return this.ready; }
  isStyleLoaded(): boolean { return this.ready; }
  override isMoving(): boolean { return false; }
  prepareFeatures(): Promise<void> { return Promise.resolve(); }
  triggerRepaint(): void { this.repaints++; }
  override setPadding(value?: { top: number; right: number; bottom: number; left: number }): this {
    this.trace.push('native:padding');
    if (this.rejectPadding) throw new Error('Padding refused');
    if (value) this.padding = { ...value };
    this.fire('move'); return this;
  }
  override setStyle(value?: Record<string, unknown>): this {
    this.trace.push('native:style'); if (value) this.style = value;
    this.ready = true; this.fire('style.load'); return this;
  }
  syncBacking(): void {
    const ratio = this.appliedRatio ?? this.ratio;
    this.renderCanvas.width = Math.round(this.width * ratio); this.renderCanvas.height = Math.round(this.height * ratio);
  }
  override resize(): void { this.trace.push('native:resize'); this.syncBacking(); this.fire('resize'); }
  override remove(): void { this.trace.push('native:remove'); this.removed = true; this.events.clear(); }
}

interface Observation {
  readonly kind: 'intersection' | 'resize';
  readonly document: Document;
  readonly targets: Set<Element>;
  stopped: boolean;
  emit(target: Element, visible?: boolean, force?: boolean): void;
}
export function deferred<T>() {
  let resolve!: (value: T) => void, reject!: (error: Error) => void;
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}
export async function renderTurns(): Promise<void> {
  for (let index = 0; index < 8; index++) await Promise.resolve();
  await new Promise<void>(resolve => setTimeout(resolve, 0));
}

export async function renderEnvironment() {
  await loaders.loadMapOwnedFeatureRuntime(); await loaders.loadMapControlRuntime();
  const records: BridgeRecord[] = [], peers: RenderPeer[] = [], elements: LyraMap[] = [], trace: string[] = [];
  const observers: Observation[] = [], restorers: (() => void)[] = [], completions: (() => void)[] = [];
  let imports = 0, automaticVisibility = true, hidden = false;
  let onFactory: ((record: BridgeRecord) => void) | undefined;
  let importer: () => Promise<unknown> = async () => module();
  const setImporter = Reflect.get(loaders, '__setMapSceneBridgeImporterForTesting') as ((value?: () => Promise<unknown>) => void) | undefined;
  function patch(target: object, key: string, descriptor: PropertyDescriptor): void {
    const previous = Object.getOwnPropertyDescriptor(target, key);
    Object.defineProperty(target, key, { configurable: true, ...descriptor });
    restorers.push(() => { if (previous) Object.defineProperty(target, key, previous); else Reflect.deleteProperty(target, key); });
  }
  function installRealm(view: Realm): void {
    const originalContext = view.HTMLCanvasElement.prototype.getContext;
    patch(view.HTMLCanvasElement.prototype, 'getContext', { writable: true,
      value(this: HTMLCanvasElement, name: string, ...rest: unknown[]) {
        return name === 'webgl2' ? {} : Reflect.apply(originalContext, this, [name, ...rest]);
      } });
    patch(view.document, 'visibilityState', { get: () => hidden ? 'hidden' : 'visible' });
    patch(view.document, 'hidden', { get: () => hidden });
    const matchMedia = view.matchMedia.bind(view), motionEvents = new view.EventTarget();
    const motion = { matches: false, media: '(prefers-reduced-motion: reduce)', onchange: null,
      addEventListener: motionEvents.addEventListener.bind(motionEvents), removeEventListener: motionEvents.removeEventListener.bind(motionEvents),
      dispatchEvent: motionEvents.dispatchEvent.bind(motionEvents), addListener() {}, removeListener() {} } as unknown as MediaQueryList;
    patch(view, 'matchMedia', { writable: true, value: (query: string) => query === motion.media ? motion : matchMedia(query) });
    class Intersection implements IntersectionObserver {
      readonly root = null; readonly rootMargin = '0px'; readonly scrollMargin = '0px'; readonly thresholds = [0];
      readonly entry: Observation;
      constructor(readonly callback: IntersectionObserverCallback) {
        this.entry = { kind: 'intersection', document: view.document, targets: new Set(), stopped: false,
          emit: (target, visible = true, force = false) => {
            if (!force && (this.entry.stopped || !this.entry.targets.has(target))) return;
            const box = target.getBoundingClientRect();
            callback([{ target, time: 0, isIntersecting: visible, intersectionRatio: visible ? 1 : 0,
              boundingClientRect: box, rootBounds: null, intersectionRect: visible ? box : new view.DOMRect() }], this);
          } };
        observers.push(this.entry);
      }
      observe(target: Element): void { this.entry.targets.add(target); if (automaticVisibility) queueMicrotask(() => this.entry.emit(target, true)); }
      unobserve(target: Element): void { this.entry.targets.delete(target); }
      disconnect(): void { this.entry.stopped = true; this.entry.targets.clear(); }
      takeRecords(): IntersectionObserverEntry[] { return []; }
    }
    class Resize implements ResizeObserver {
      readonly entry: Observation;
      constructor(readonly callback: ResizeObserverCallback) {
        this.entry = { kind: 'resize', document: view.document, targets: new Set(), stopped: false,
          emit: (target, _visible, force = false) => {
            if (!force && (this.entry.stopped || !this.entry.targets.has(target))) return;
            const box = target.getBoundingClientRect(), size = { inlineSize: target.clientWidth, blockSize: target.clientHeight };
            callback([{ target, contentRect: box, contentBoxSize: [size], borderBoxSize: [size], devicePixelContentBoxSize: [size] }], this);
          } };
        observers.push(this.entry);
      }
      observe(target: Element): void { this.entry.targets.add(target); }
      unobserve(target: Element): void { this.entry.targets.delete(target); }
      disconnect(): void { this.entry.stopped = true; this.entry.targets.clear(); }
    }
    patch(view, 'IntersectionObserver', { writable: true, value: Intersection });
    patch(view, 'ResizeObserver', { writable: true, value: Resize });
  }
  function factory(peer: RenderPeer, host: RenderBridgeHost) {
    let release: (() => void) | undefined;
    const record: BridgeRecord = { peer, host, inputs: [], visibility: [], calls: [], disposed: false, visible: true,
      capture() { if (!record.disposed && host.isCurrent()) { trace.push('bridge:capture'); record.inputs.push(host.captureRenderInput()); } } };
    const capture = () => { queueMicrotask(() => record.capture()); };
    const dispose = () => {
      if (record.disposed) return;
      trace.push('bridge:dispose'); record.calls.push('dispose'); record.disposed = true;
      host.signal.removeEventListener('abort', dispose); release?.();
    };
    release = host.subscribeRenderInput(capture); host.signal.addEventListener('abort', dispose, { once: true });
    records.push(record); trace.push('bridge:create'); onFactory?.(record);
    if (host.signal.aborted) dispose(); else capture();
    return { dispose,
      invalidateStyle() { trace.push('bridge:style'); record.calls.push('style'); },
      setVisible(value: boolean) { record.visibility.push(value); record.visible = value; trace.push(`bridge:visible:${value}`); },
      requestFrame() { record.calls.push('frame'); if (record.visible && !record.disposed && host.isCurrent()) peer.triggerRepaint(); },
    };
  }
  function module() { return { createSceneBridge: factory }; }
  function installImporter(): void { setImporter?.(async () => { imports++; return importer(); }); }
  installRealm(window as Realm); installImporter();
  return {
    records, peers, elements, observers, trace, module, installRealm,
    get imports() { return imports; },
    get hasImporterSeam() { return typeof setImporter === 'function'; },
    set automaticVisibility(value: boolean) { automaticVisibility = value; },
    set onFactory(value: ((record: BridgeRecord) => void) | undefined) { onFactory = value; },
    setImporter(value: () => Promise<unknown>) { importer = value; installImporter(); },
    holdImport() { const gate = deferred<unknown>(); completions.push(() => gate.resolve(module())); importer = () => gate.promise; installImporter(); return gate; },
    visible(peer: RenderPeer, value: boolean) { for (const observer of observers) if (observer.kind === 'intersection') observer.emit(peer.container, value); },
    hidden(value: boolean, doc = document) {
      hidden = value; const view = doc.defaultView as Realm; doc.dispatchEvent(new view.Event('visibilitychange'));
    },
    resize(peer: RenderPeer) { for (const observer of observers) if (observer.kind === 'resize') observer.emit(peer.container); },
    async mount(configure?: (element: LyraMap) => void, configurePeer?: (peer: RenderPeer) => void) {
      const wrapper = await fixture<HTMLDivElement>(html`<div data-lr-motion="system" style="inline-size:640px;block-size:480px"></div>`);
      const element = document.createElement('lr-map') as LyraMap;
      element.initialization = 'eager'; element.mapStyle = LYRA_MAP_EMPTY_STYLE; element.controls = { attribution: false };
      element.style.cssText = 'display:block;inline-size:640px;block-size:480px';
      class Peer extends RenderPeer {
        constructor(options: Record<string, unknown>) { super(options, trace); peers.push(this); configurePeer?.(this); }
      }
      Object.defineProperty(element, 'loadLibrary', { configurable: true, value: async () => ({ Map: Peer }) });
      configure?.(element); elements.push(element); wrapper.append(element);
      await waitUntil(() => element.map !== undefined, 'native map constructed', { timeout: 2000 });
      const peer = element.map as unknown as RenderPeer; peer.ready = true; peer.fire('load');
      await element.whenStyleReady(); await element.updateComplete; await renderTurns();
      return { element, peer, wrapper };
    },
    async bridge(peer: RenderPeer): Promise<BridgeRecord> {
      await waitUntil(() => records.some(record => record.peer === peer && !record.disposed), 'scene bridge connected', { timeout: 1000 });
      await renderTurns(); return records.find(record => record.peer === peer && !record.disposed)!;
    },
    async close() {
      for (const element of elements) element.remove();
      for (const finish of completions) finish();
      await renderTurns(); setImporter?.();
      for (const restore of restorers.reverse()) restore();
      ScriptedOverlayMap.instances = ScriptedOverlayMap.instances.filter(peer => !peers.includes(peer as RenderPeer));
    },
  };
}
