import { expect, fixture, fixtureCleanup, html, nextFrame, waitUntil } from '@open-wc/testing';
import { ControlMapEngine } from '../../../../test/map-control-engine.js';
import { LYRA_MAP_EMPTY_STYLE, type LyraMap } from './map.js';

class ReadinessMap extends ControlMapEngine {
  static configure: ((peer: ReadinessMap) => void) | undefined;
  static instances: ReadinessMap[] = [];
  constructor(options: Record<string, unknown>) {
    super(options);
    ReadinessMap.instances.push(this);
    ReadinessMap.configure?.(this);
  }
}

const observerDescriptor = Object.getOwnPropertyDescriptor(window, 'IntersectionObserver');
const contextDescriptor = Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, 'getContext')!;
const originalContext = HTMLCanvasElement.prototype.getContext;

async function mount() {
  const wrapper = await fixture<HTMLDivElement>(html`<div style="width:320px;height:240px"></div>`);
  const element = document.createElement('lr-map') as LyraMap;
  element.engine = 'maplibre'; element.initialization = 'eager';
  element.mapStyle = LYRA_MAP_EMPTY_STYLE; element.controls = { attribution: false };
  element.strings = { mapInitializationFailed: 'Map could not start' };
  (element as unknown as { loadLibrary(): Promise<unknown> }).loadLibrary = async () => ({ Map: ReadinessMap });
  const styles: number[] = [], idles: number[] = [];
  element.addEventListener('lr-map-style-load', event => { styles.push(event.detail.generation); });
  element.addEventListener('lr-map-idle', event => { idles.push(event.detail.generation); });
  wrapper.append(element);
  await waitUntil(() => ReadinessMap.instances.length > 0);
  await element.updateComplete;
  return { element, wrapper, peer: ReadinessMap.instances[0]!, styles, idles };
}

async function rejected(work: Promise<void>, name: string): Promise<void> {
  let caught: unknown;
  try { await work; } catch (error) { caught = error; }
  expect(caught instanceof Error ? caught.name : '').to.equal(name);
  expect(String(caught)).not.to.include('Private renderer failure');
}

async function settle(element: LyraMap): Promise<void> {
  await element.updateComplete; await nextFrame(); await nextFrame();
}

describe('lr-map readiness capability recovery', () => {
  beforeEach(() => {
    ReadinessMap.initialReady = false; ReadinessMap.prepare = undefined;
    ReadinessMap.configure = undefined; ReadinessMap.instances = [];
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

  it('uses loaded when the renderer has no isStyleLoaded capability', async () => {
    ReadinessMap.configure = peer => { Object.defineProperty(peer, 'isStyleLoaded', { value: undefined }); peer.idle = true; };
    const { element, peer, styles, idles } = await mount();
    await element.whenStyleReady(); await element.whenIdle();
    expect(styles.length).to.equal(1); expect(idles).to.deep.equal(styles);
    expect(element.map === peer).to.equal(true);
    expect(element.shadowRoot!.querySelectorAll('[part="error"]').length).to.equal(0);
  });

  it('requires fresh idle evidence after movement when the renderer has no loaded probe', async () => {
    ReadinessMap.configure = peer => {
      Object.defineProperty(peer, 'loaded', { value: undefined });
      Object.defineProperty(peer, 'isStyleLoaded', { value: undefined });
    };
    const { element, peer, styles, idles } = await mount();
    peer.fire('load'); await element.whenStyleReady();
    let completed = false;
    const pending = element.whenIdle().then(() => { completed = true; });
    await settle(element);
    expect(completed).to.equal(false); expect(idles.length).to.equal(0);
    peer.fire('idle'); await pending;
    expect(idles).to.deep.equal(styles);
    peer.fire('movestart'); completed = false;
    const next = element.whenIdle().then(() => { completed = true; });
    await settle(element);
    expect(completed).to.equal(false);
    peer.fire('idle'); await next;
    expect(idles).to.deep.equal([styles[0], styles[0]]);
  });

  for (const event of ['dataloading', 'style.load'] as const) {
    it(`contains a failed ${event} subscription and allows a clean reconnect`, async () => {
      const captured: (() => void)[] = [];
      ReadinessMap.configure = peer => {
        const on = peer.on;
        peer.on = function(type, listener) {
          captured.push(() => listener({ type }));
          if (type === event) throw new Error('Private renderer failure');
          return on.call(this, type, listener);
        };
      };
      const { element, wrapper, peer, styles } = await mount();
      await rejected(element.whenStyleReady(), 'MapReadinessError');
      await waitUntil(() => element.shadowRoot!.querySelector('[part="error"]') !== null);
      expect(peer.removed).to.equal(true);
      expect([...peer.listeners.values()].every(listeners => listeners.size === 0)).to.equal(true);
      expect(element.shadowRoot!.querySelector('[part="error"]')!.textContent).to.include('Map could not start');
      expect(element.shadowRoot!.textContent).not.to.include('Private renderer failure');
      element.remove(); ReadinessMap.configure = undefined; wrapper.append(element);
      await waitUntil(() => ReadinessMap.instances.length === 2 && element.map !== undefined);
      const replacement = ReadinessMap.instances[1]!;
      replacement.ready = true; replacement.fire('load'); await element.whenStyleReady();
      for (const dispatch of captured) dispatch();
      await settle(element);
      expect(element.map === replacement).to.equal(true);
      expect(styles.length).to.equal(1);
      expect(element.shadowRoot!.querySelectorAll('[part="error"]').length).to.equal(0);
    });
  }

  it('completes replacement readiness when retiring a busy listener throws', async () => {
    const { element, peer, styles, idles } = await mount();
    peer.ready = true; peer.fire('load'); await element.whenStyleReady();
    const oldBusy = [...peer.listeners.get('dataloading')!];
    const off = peer.off; let failures = 0;
    peer.off = function(type, listener) {
      if (type === 'dataloading' && oldBusy.includes(listener)) {
        failures++; throw new Error('Private renderer failure');
      }
      return off.call(this, type, listener);
    };
    element.mapStyle = { version: 8, sources: {}, layers: [] };
    await element.updateComplete; await element.whenStyleReady();
    expect(failures).to.equal(1); expect(styles.length).to.equal(2);
    const pending = element.whenIdle(); peer.idle = true; peer.fire('idle'); await pending;
    const completed = [...idles];
    for (const dispatch of oldBusy) dispatch({ type: 'dataloading' });
    await element.whenIdle();
    expect(idles).to.deep.equal(completed);
    expect(element.map === peer).to.equal(true);
    expect(element.shadowRoot!.querySelectorAll('[part="error"]').length).to.equal(0);
    peer.off = off;
  });
});
