import { expect, waitUntil } from '@open-wc/testing';
import type { LyraMap } from './map.class.js';
import './map.js';

const blankStyle = { version: 8 as const, sources: {}, layers: [] };

class DelayedLoadMap {
  static readonly instances: DelayedLoadMap[] = [];

  private readonly canvas: HTMLCanvasElement;
  private readonly listeners = new Map<string, Set<(event: unknown) => void>>();
  removals = 0;

  constructor(options: Record<string, unknown>) {
    this.canvas = document.createElement('canvas');
    (options['container'] as HTMLElement).append(this.canvas);
    DelayedLoadMap.instances.push(this);
  }

  on(name: string, listener: (event: unknown) => void): this {
    const listeners = this.listeners.get(name) ?? new Set<(event: unknown) => void>();
    listeners.add(listener);
    this.listeners.set(name, listeners);
    return this;
  }

  once(name: string, listener: (event: unknown) => void): this {
    const once = (event: unknown): void => {
      this.listeners.get(name)?.delete(once);
      listener(event);
    };
    return this.on(name, once);
  }

  fire(name: string): void {
    for (const listener of [...this.listeners.get(name) ?? []]) listener({});
  }

  getCanvas(): HTMLCanvasElement { return this.canvas; }
  getCenter(): { lng: number; lat: number } { return { lng: 0, lat: 0 }; }
  getZoom(): number { return 2; }
  setCenter(): void {}
  setZoom(): void {}
  resize(): void {}
  remove(): void { this.removals += 1; this.canvas.remove(); }
  setStyle(): this { return this; }
  getSource(): undefined { return undefined; }
  addSource(): this { return this; }
  removeSource(): this { return this; }
  getLayer(): undefined { return undefined; }
  addLayer(): this { return this; }
  removeLayer(): this { return this; }
  setPaintProperty(): this { return this; }
  queryRenderedFeatures(): unknown[] { return []; }
}

it('waits for a positive intersection and tolerates empty observer notifications', async () => {
  const originalIntersectionObserver = Object.getOwnPropertyDescriptor(window, 'IntersectionObserver');
  const originalGetContext = HTMLCanvasElement.prototype.getContext;
  let intersection: IntersectionObserverCallback | undefined;
  let observerDisconnected = false;
  let observedTarget: Element | undefined;
  class ControlledIntersectionObserver {
    constructor(callback: IntersectionObserverCallback) {
      intersection = callback;
    }
    observe(target: Element): void { observedTarget = target; }
    disconnect(): void { observerDisconnected = true; }
    takeRecords(): IntersectionObserverEntry[] { return []; }
    unobserve(): void {}
  }

  DelayedLoadMap.instances.length = 0;
  Object.defineProperty(window, 'IntersectionObserver', {
    configurable: true,
    value: ControlledIntersectionObserver,
  });
  Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
    configurable: true,
    writable: true,
    value(this: HTMLCanvasElement, kind: string, ...args: unknown[]): unknown {
      if (kind === 'webgl2') return {};
      return Reflect.apply(originalGetContext, this, [kind, ...args]);
    },
  });

  const element = document.createElement('lr-map') as LyraMap;
  element.engine = 'maplibre';
  element.mapStyle = blankStyle;
  (element as unknown as { loadLibrary(): Promise<unknown> }).loadLibrary = async () => ({ Map: DelayedLoadMap });

  try {
    document.body.append(element);
    await waitUntil(() => element.shadowRoot!.querySelector('[part="container"]') !== null);
    await element.updateComplete;
    expect(element.map === undefined).to.be.true;

    const notifyIntersection = intersection;
    if (!notifyIntersection) throw new Error('The map must observe its allocated container.');
    expect(() => notifyIntersection([], {} as IntersectionObserver)).to.not.throw();
    notifyIntersection([{ target: observedTarget, isIntersecting: false } as IntersectionObserverEntry], {} as IntersectionObserver);
    await element.updateComplete;
    expect(element.map === undefined).to.be.true;

    notifyIntersection([{ target: observedTarget, isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver);
    await waitUntil(() => element.map !== undefined);
    expect(DelayedLoadMap.instances.length).to.equal(1);
  } finally {
    element.remove();
    HTMLCanvasElement.prototype.getContext = originalGetContext;
    if (originalIntersectionObserver) {
      Object.defineProperty(window, 'IntersectionObserver', originalIntersectionObserver);
    } else {
      delete (window as unknown as { IntersectionObserver?: typeof IntersectionObserver }).IntersectionObserver;
    }
  }
  expect(observerDisconnected).to.be.true;
});

it('ignores a removed peer load after reconnect and publishes only the current map', async () => {
  const originalIntersectionObserver = Object.getOwnPropertyDescriptor(window, 'IntersectionObserver');
  const originalGetContext = HTMLCanvasElement.prototype.getContext;
  DelayedLoadMap.instances.length = 0;

  Object.defineProperty(window, 'IntersectionObserver', { configurable: true, value: undefined });
  Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
    configurable: true,
    writable: true,
    value(this: HTMLCanvasElement, kind: string, ...args: unknown[]): unknown {
      if (kind === 'webgl2') return {};
      return Reflect.apply(originalGetContext, this, [kind, ...args]);
    },
  });

  const element = document.createElement('lr-map') as LyraMap;
  element.engine = 'maplibre';
  element.mapStyle = blankStyle;
  (element as unknown as { loadLibrary(): Promise<unknown> }).loadLibrary = async () => ({ Map: DelayedLoadMap });
  let loadEvents = 0;
  element.addEventListener('lr-map-load', () => { loadEvents += 1; });

  try {
    document.body.append(element);
    await waitUntil(() => element.map !== undefined && DelayedLoadMap.instances.length === 1);
    const removedPeer = DelayedLoadMap.instances[0]!;

    element.remove();
    expect(removedPeer.removals).to.equal(1);
    document.body.append(element);
    await waitUntil(() => element.map !== undefined && DelayedLoadMap.instances.length === 2);
    const currentPeer = DelayedLoadMap.instances[1]!;

    removedPeer.fire('load');
    expect(loadEvents, 'the removed peer cannot publish a load').to.equal(0);
    expect(element.map === currentPeer).to.be.true;

    currentPeer.fire('load');
    expect(loadEvents, 'the current peer publishes its load once').to.equal(1);
    expect(element.map === currentPeer).to.be.true;
    expect(element.shadowRoot!.querySelectorAll('[part="error"]').length).to.equal(0);
  } finally {
    element.remove();
    HTMLCanvasElement.prototype.getContext = originalGetContext;
    if (originalIntersectionObserver) {
      Object.defineProperty(window, 'IntersectionObserver', originalIntersectionObserver);
    } else {
      delete (window as unknown as { IntersectionObserver?: typeof IntersectionObserver }).IntersectionObserver;
    }
  }
});
