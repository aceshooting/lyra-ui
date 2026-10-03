import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { buildGeoJsonPropertyDiff, type LyraMap } from './map.class.js';
import './map.js';

const blankStyle = { version: 8 as const, sources: {}, layers: [] };

class RecoveryMap {
  readonly listeners = new Map<string, (event: Record<string, unknown>) => void>();
  readonly canvas = document.createElement('canvas');
  removals = 0;
  failSource = false;
  failRemove = false;
  center = { lng: 0, lat: 0 };
  zoom = 1;
  on(name: string, callback: (event: Record<string, unknown>) => void): this {
    this.listeners.set(name, callback);
    return this;
  }
  once(name: string, callback: (event: Record<string, unknown>) => void): this { return this.on(name, callback); }
  fire(name: string, event: Record<string, unknown> = {}): void { this.listeners.get(name)?.(event); }
  getCanvas(): HTMLCanvasElement { return this.canvas; }
  getSource(): undefined {
    if (this.failSource) throw new Error('source unavailable');
    return undefined;
  }
  getLayer(): undefined { return undefined; }
  getStyle(): never { throw new Error('style unavailable'); }
  getCenter(): { lng: number; lat: number } { return this.center; }
  getZoom(): number { return this.zoom; }
  isMoving(): never { throw new Error('movement unavailable'); }
  setCenter(center: readonly number[]): void { this.center = { lng: center[0]!, lat: center[1]! }; }
  setZoom(zoom: number): void { this.zoom = zoom; }
  setStyle(): void {}
  resize(): void {}
  remove(): void {
    this.removals += 1;
    if (this.failRemove) throw new Error('teardown unavailable');
  }
}

async function recoveryMap(): Promise<{ el: LyraMap; peer: RecoveryMap; restore(): void }> {
  const originalObserver = window.IntersectionObserver;
  const originalContext = HTMLCanvasElement.prototype.getContext;
  Object.defineProperty(window, 'IntersectionObserver', { configurable: true, value: undefined });
  Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
    configurable: true,
    value(this: HTMLCanvasElement, context: string, ...args: unknown[]): unknown {
      if (context === 'webgl2') return {};
      return Reflect.apply(originalContext, this, [context, ...args]);
    },
  });
  const restore = (): void => {
    Object.defineProperty(window, 'IntersectionObserver', { configurable: true, value: originalObserver });
    HTMLCanvasElement.prototype.getContext = originalContext;
  };
  try {
    const wrapper = await fixture<HTMLElement>(html`<div></div>`);
    const el = document.createElement('lr-map');
    (el as unknown as { loadLibrary(): Promise<unknown> }).loadLibrary = async () => ({ Map: RecoveryMap });
    el.mapStyle = blankStyle;
    wrapper.append(el);
    await waitUntil(() => el.map !== undefined);
    return { el, peer: el.map as unknown as RecoveryMap, restore };
  } catch (error) {
    restore();
    throw error;
  }
}

it('contains a peer source failure on initial load and clears the unusable map', async () => {
  const { el, peer, restore } = await recoveryMap();
  try {
    el.choropleth = { sourceId: 'regions', field: 'amount', stops: [], geojson: { type: 'FeatureCollection', features: [] } };
    await el.updateComplete;
    peer.failSource = true;
    peer.fire('load');
    await el.updateComplete;
    expect(el.map).to.equal(undefined);
    expect(peer.removals).to.equal(1);
    expect(el.shadowRoot!.querySelector('[part="error"]')?.textContent).to.include('initialize');
  } finally { el.remove(); restore(); }
});

it('contains failed reapplication after a style load and renders a localized fallback', async () => {
  const { el, peer, restore } = await recoveryMap();
  try {
    el.choropleth = { sourceId: 'regions', field: 'amount', stops: [], geojson: { type: 'FeatureCollection', features: [] } };
    await el.updateComplete;
    el.mapStyle = { ...blankStyle, name: 'replacement' };
    await el.updateComplete;
    peer.failSource = true;
    peer.fire('style.load');
    await waitUntil(() => el.map === undefined);
    expect(peer.removals).to.equal(1);
    expect(el.shadowRoot!.querySelectorAll('[part="error"]').length).to.equal(1);
  } finally { el.remove(); restore(); }
});

it('updates only the assigned camera axis when the peer cannot report motion or a valid camera', async () => {
  const { el, peer, restore } = await recoveryMap();
  try {
    el.zoom = 5;
    await el.updateComplete;
    expect(peer.zoom).to.equal(5);
    expect(peer.center).to.deep.equal({ lng: 0, lat: 0 });
    peer.center = { lng: Number.NaN, lat: 0 };
    el.center = [12, 34];
    await el.updateComplete;
    expect(peer.center).to.deep.equal({ lng: 12, lat: 34 });
    expect(peer.zoom).to.equal(5);
    peer.getCenter = (): never => { throw new Error('camera unavailable'); };
    el.zoom = 6;
    await el.updateComplete;
    expect(peer.zoom).to.equal(6);
  } finally { el.remove(); restore(); }
});

it('finishes failure cleanup even when a partially initialized peer cannot remove itself', async () => {
  const { el, peer, restore } = await recoveryMap();
  try {
    peer.failRemove = true;
    peer.fire('error');
    await el.updateComplete;
    expect(el.map).to.equal(undefined);
    expect(peer.removals).to.equal(1);
    expect(el.shadowRoot!.querySelectorAll('[part="error"]').length).to.equal(1);
  } finally { el.remove(); restore(); }
});

it('falls back to full GeoJSON replacement for holes, non-features and inaccessible geometry enumeration', () => {
  const valid = { type: 'FeatureCollection', features: [{ type: 'Feature', id: 'valid', properties: {}, geometry: { type: 'Point', coordinates: [0, 0] } }] };
  const holes = new Array(1);
  const hostileGeometry = new Proxy({ type: 'Point', coordinates: [0, 0] }, {
    ownKeys(): never { throw new Error('geometry unavailable'); },
  });
  const hostileProperties = new Proxy({}, {
    ownKeys(): never { throw new Error('properties unavailable'); },
  });
  for (const features of [holes, [null], [{ ...valid.features[0], geometry: hostileGeometry }], [{ ...valid.features[0], properties: hostileProperties }]]) {
    expect(buildGeoJsonPropertyDiff(valid, { type: 'FeatureCollection', features })).to.equal(null);
  }
});

it('omits a revoked legend icon without losing the named row or its color swatch', async () => {
  const icon = Proxy.revocable({}, {});
  icon.revoke();
  const el = await fixture<LyraMap>(html`<lr-map .legend=${[{ label: 'Safe row', color: '#ff0000', pattern: 'solid', icon: icon.proxy }]}></lr-map>`);
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="legend"]')?.textContent).to.include('Safe row');
  expect(el.shadowRoot!.querySelectorAll('[part="legend-swatch"]').length).to.equal(1);
});

it('contains teardown failure from a candidate that never finishes setup on reconnect', async () => {
  const { el, restore } = await recoveryMap();
  let failedRemovals = 0;
  class PartialMap extends RecoveryMap {
    override getCanvas(): never { throw new Error('canvas unavailable'); }
    override remove(): never { failedRemovals += 1; throw new Error('partial teardown unavailable'); }
  }
  try {
    el.remove();
    (el as unknown as { loadLibrary(): Promise<unknown> }).loadLibrary = async () => ({ Map: PartialMap });
    document.body.append(el);
    await waitUntil(() => el.shadowRoot!.querySelector('[part="error"]') !== null);
    expect(el.map).to.equal(undefined);
    expect(failedRemovals).to.equal(1);
  } finally { el.remove(); restore(); }
});

it('reports unavailable WebGL when a required style is supplied after the peer has loaded', async () => {
  const originalContext = HTMLCanvasElement.prototype.getContext;
  Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
    configurable: true,
    value(this: HTMLCanvasElement, context: string, ...args: unknown[]): unknown {
      return context === 'webgl2' ? null : Reflect.apply(originalContext, this, [context, ...args]);
    },
  });
  const el = document.createElement('lr-map');
  (el as unknown as { loadLibrary(): Promise<unknown> }).loadLibrary = async () => ({ Map: RecoveryMap });
  el.strings = { mapWebglUnavailable: 'Graphics support unavailable' };
  document.body.append(el);
  try {
    await waitUntil(() => el.shadowRoot!.querySelector('[part="error"]') !== null);
    el.mapStyle = blankStyle;
    await el.updateComplete;
    expect(el.map).to.equal(undefined);
    expect(el.shadowRoot!.querySelector('[part="error"]')?.textContent).to.equal('Graphics support unavailable');
  } finally { el.remove(); HTMLCanvasElement.prototype.getContext = originalContext; }
});
