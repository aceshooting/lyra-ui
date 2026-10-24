import { expect, fixture, fixtureCleanup, html, waitUntil } from '@open-wc/testing';
import { ControlMapEngine, FakeGeolocateControl } from '../../../../test/map-control-engine.js';
import './map.js';
import { LYRA_MAP_EMPTY_STYLE, LyraMapImageExportError, type LyraMap, type LyraMapInteractionDetail } from './map.class.js';

/** A loaded vector basemap and controllable failures at the public renderer boundary. */
class BoundaryMap extends ControlMapEngine {
  unprojected = { lng: 12, lat: 34 };
  rejectUnproject = false;
  rejectCommand = false;
  commands = 0;

  constructor(options: Record<string, unknown>) {
    super(options);
    this.sourceDescriptors.set('tiles', { type: 'vector' });
    this.layers.set('places', { id: 'places', type: 'circle', source: 'tiles', 'source-layer': 'places' });
    this.order.push('places');
  }

  unproject(_point: readonly [number, number]) {
    if (this.rejectUnproject) throw new Error('Renderer projection unavailable');
    return this.unprojected;
  }

  override jumpTo(options: Parameters<ControlMapEngine['jumpTo']>[0], data?: Record<string, unknown>): void {
    if (this.rejectCommand) throw new Error('Renderer camera unavailable');
    this.commands++;
    super.jumpTo(options, data);
  }
}

const observerDescriptor = Object.getOwnPropertyDescriptor(window, 'IntersectionObserver');
const contextDescriptor = Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, 'getContext');
const originalContext = HTMLCanvasElement.prototype.getContext;

async function mount(configure: (element: LyraMap) => void = () => undefined) {
  const wrapper = await fixture<HTMLDivElement>(html`<div style="width:320px;height:240px"></div>`);
  const element = document.createElement('lr-map') as LyraMap;
  element.engine = 'maplibre';
  element.initialization = 'eager';
  element.mapStyle = LYRA_MAP_EMPTY_STYLE;
  element.controls = { attribution: false };
  (element as unknown as { loadLibrary: () => Promise<unknown> }).loadLibrary = async () => ({
    Map: BoundaryMap,
    GeolocateControl: FakeGeolocateControl,
  });
  configure(element);
  wrapper.append(element);
  await waitUntil(() => element.map !== undefined);
  const peer = element.map as unknown as BoundaryMap;
  await element.updateComplete;
  peer.ready = true;
  peer.fire('load');
  await element.whenStyleReady();
  await element.updateComplete;
  return { element, peer };
}

function capture<T>(element: LyraMap, name: string): T[] {
  const details: T[] = [];
  element.addEventListener(name, event => { details.push((event as CustomEvent<T>).detail); });
  return details;
}

function hover(peer: BoundaryMap, feature: Record<string, unknown>): void {
  peer.hits = [{ type: 'Feature', id: 7, source: 'tiles', layer: { id: 'places' }, properties: { name: 'Place' }, ...feature }];
  peer.fire('mousemove', { point: { x: 10, y: 20 }, lngLat: { lng: 1, lat: 2 } });
}

function leave(peer: BoundaryMap): void {
  peer.hits = [];
  peer.fire('mousemove', { point: { x: 30, y: 40 }, lngLat: { lng: 3, lat: 4 } });
}

describe('lr-map public renderer and input boundaries', () => {
  beforeEach(() => {
    BoundaryMap.initialReady = false;
    BoundaryMap.prepare = undefined;
    Object.defineProperty(window, 'IntersectionObserver', { configurable: true, value: undefined });
    Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
      configurable: true,
      writable: true,
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

  it('contains renderer projection failures and resumes with detached finite points', async () => {
    const { element, peer } = await mount();
    peer.projected = { x: Number.NaN, y: 10 };
    expect(element.project([1, 2])).to.equal(undefined);
    peer.projected = { x: 10, y: Number.POSITIVE_INFINITY };
    expect(element.project([1, 2])).to.equal(undefined);
    peer.beforeProject = () => { throw new Error('Renderer projection unavailable'); };
    expect(element.project([1, 2])).to.equal(undefined);
    peer.beforeProject = undefined;
    peer.projected = { x: 11, y: 22 };
    const point = element.project([1, 2]);
    expect(point).to.deep.equal([11, 22]);
    expect(Object.isFrozen(point)).to.equal(true);
    peer.projected.x = 99;
    expect(point).to.deep.equal([11, 22]);
  });

  it('rejects invalid inverse projection input and contains invalid renderer output', async () => {
    const { element, peer } = await mount();
    for (const point of [null, {}, [0, Number.NaN], [Number.POSITIVE_INFINITY, 0]]) {
      expect(element.unproject(point as unknown as Parameters<LyraMap['unproject']>[0])).to.equal(undefined);
    }
    for (const value of [{ lng: Number.NaN, lat: 0 }, { lng: 0, lat: Number.NEGATIVE_INFINITY }]) {
      peer.unprojected = value;
      expect(element.unproject([10, 20])).to.equal(undefined);
    }
    peer.rejectUnproject = true;
    expect(element.unproject([10, 20])).to.equal(undefined);
    peer.rejectUnproject = false;
    peer.unprojected = { lng: 540, lat: 100 };
    const coordinate = element.unproject([10, 20]);
    expect(coordinate).to.deep.equal([180, 90]);
    expect(Object.isFrozen(coordinate)).to.equal(true);
    peer.unprojected = { lng: -540, lat: -100 };
    expect(element.unproject([10, 20])).to.deep.equal([180, -90]);
    expect(coordinate).to.deep.equal([180, 90]);
    element.remove();
    expect(element.unproject([10, 20])).to.equal(undefined);
    expect(element.project([1, 2])).to.equal(undefined);
  });

  it('returns false for a failed native camera command and keeps later commands usable', async () => {
    const { element, peer } = await mount();
    const views = capture<{ source: string; center: readonly number[] }>(element, 'lr-map-view-change');
    const prior = [...element.center];
    peer.rejectCommand = true;
    expect(element.jumpTo({ center: [10, 20], zoom: 5 })).to.equal(false);
    expect(element.center).to.deep.equal(prior);
    expect(views.length).to.equal(0);
    peer.rejectCommand = false;
    expect(element.jumpTo({ center: [10, 20], zoom: 5 })).to.equal(true);
    await element.updateComplete;
    expect(element.center).to.deep.equal([10, 20]);
    expect(element.zoom).to.equal(5);
    expect(peer.commands).to.equal(1);
    expect(views.map(detail => detail.source)).to.deep.equal(['command']);
  });

  it('leaves the URL camera intact when native orientation reads fail and resumes history navigation', async () => {
    const originalUrl = location.href, originalState: unknown = history.state;
    let element: LyraMap | undefined;
    try {
      history.replaceState({ retained: true }, '', '#section&camera=5/2/1/10/15');
      const mounted = await mount(el => { el.hash = 'camera'; });
      element = mounted.element;
      const peer = mounted.peer;
      const initialCommands = peer.commands;
      window.dispatchEvent(new HashChangeEvent('hashchange'));
      expect(peer.commands).to.equal(initialCommands);
      expect(peer.center).to.deep.equal({ lng: 1, lat: 2 });
      for (const method of ['getBearing', 'getPitch'] as const) {
        const read = peer[method];
        peer[method] = () => { throw new Error('Renderer orientation unavailable'); };
        const next = '#section&camera=6/4/3/20/25';
        history.replaceState({ retained: true }, '', next);
        window.dispatchEvent(new HashChangeEvent('hashchange'));
        expect(peer.commands).to.equal(initialCommands);
        expect(peer.center).to.deep.equal({ lng: 1, lat: 2 });
        peer.fire('moveend');
        expect(location.hash).to.equal(next);
        expect(history.state).to.deep.equal({ retained: true });
        peer[method] = read;
      }
      window.dispatchEvent(new PopStateEvent('popstate'));
      expect(peer.commands).to.equal(initialCommands + 1);
      expect(element.center).to.deep.equal([3, 4]);
      expect(element.zoom).to.equal(6);
      expect(peer.bearing).to.equal(20);
      expect(peer.pitch).to.equal(25);
      expect(location.hash).to.equal('#section&camera=6/4/3/20/25');
    } finally {
      element?.remove();
      history.replaceState(originalState, '', originalUrl);
    }
  });

  it('detaches every supported GeoJSON geometry shape in public hover payloads', async () => {
    const { element, peer } = await mount(el => { el.interactiveBasemapLayers = [{ layerId: 'places' }]; });
    const enters = capture<LyraMapInteractionDetail>(element, 'lr-map-feature-enter');
    const leaves = capture<LyraMapInteractionDetail>(element, 'lr-map-feature-leave');
    const geometries = [
      { type: 'Point', coordinates: [1, 2, 3, 4] },
      { type: 'MultiPoint', coordinates: [[1, 2], [3, 4]] },
      { type: 'LineString', coordinates: [[1, 2], [3, 4]] },
      { type: 'MultiLineString', coordinates: [[[1, 2], [3, 4]]] },
      { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] },
      { type: 'MultiPolygon', coordinates: [[[[0, 0], [1, 0], [1, 1], [0, 0]]]] },
      { type: 'GeometryCollection', geometries: [{ type: 'Point', coordinates: [1, 2] }, { type: 'LineString', coordinates: [[1, 2], [3, 4]] }] },
    ];
    for (const geometry of geometries) {
      hover(peer, { geometry });
      expect(enters.length).to.equal(leaves.length + 1);
      const feature = enters.at(-1)!.feature!;
      expect(feature).to.deep.equal({ type: 'Feature', id: 7, properties: { name: 'Place' }, geometry });
      expect(feature.geometry === geometry).to.equal(false);
      const assertFrozen = (value: unknown): void => {
        if (value === null || typeof value !== 'object') return;
        expect(Object.isFrozen(value)).to.equal(true);
        for (const nested of Object.values(value)) assertFrozen(nested);
      };
      assertFrozen(feature);
      leave(peer);
      expect(leaves.at(-1)!.feature === feature).to.equal(true);
    }
    geometries[0]!.coordinates![0] = 99;
    expect(enters[0]!.feature!.geometry).to.deep.equal({ type: 'Point', coordinates: [1, 2, 3, 4] });
  });

  it('preserves feature identity while replacing malformed geometry with null', async () => {
    const { element, peer } = await mount(el => { el.interactiveBasemapLayers = [{ layerId: 'places' }]; });
    const enters = capture<LyraMapInteractionDetail>(element, 'lr-map-feature-enter');
    const geometries: unknown[] = [
      undefined, null, { type: 'Unsupported', coordinates: [1, 2] },
      { type: 'Point', coordinates: '1,2' }, { type: 'Point', coordinates: [1] },
      { type: 'Point', coordinates: [1, 2, 3, 4, 5] }, { type: 'Point', coordinates: [1, Number.NaN] },
      { type: 'Point', coordinates: [1, '2'] }, { type: 'MultiPoint', coordinates: [null] },
      { type: 'GeometryCollection', geometries: {} },
      { type: 'GeometryCollection', geometries: [{ type: 'GeometryCollection', geometries: [] }] },
      { type: 'MultiPoint', coordinates: Array.from({ length: 50_001 }, () => [1, 2]) },
    ];
    for (const geometry of geometries) {
      hover(peer, { geometry });
      expect(enters.at(-1)!.feature).to.deep.equal({ type: 'Feature', id: 7, properties: { name: 'Place' }, geometry: null });
      leave(peer);
    }
    hover(peer, { geometry: { type: 'Point', coordinates: [5, 6] } });
    expect(enters.length).to.equal(geometries.length + 1);
    expect(enters.at(-1)!.feature!.geometry).to.deep.equal({ type: 'Point', coordinates: [5, 6] });
  });

  it('contains a throwing geometry getter without dropping the feature enter and leave', async () => {
    const { element, peer } = await mount(el => { el.interactiveBasemapLayers = [{ layerId: 'places' }]; });
    const enters = capture<LyraMapInteractionDetail>(element, 'lr-map-feature-enter');
    const leaves = capture<LyraMapInteractionDetail>(element, 'lr-map-feature-leave');
    const feature = { type: 'Feature', source: 'tiles', layer: { id: 'places' }, properties: { name: 'Place' } };
    Object.defineProperty(feature, 'geometry', { get() { throw new Error('Geometry unavailable'); } });
    peer.hits = [feature];
    peer.fire('mousemove', { point: { x: 10, y: 20 }, lngLat: { lng: 1, lat: 2 } });
    expect(enters.length).to.equal(1);
    expect(enters[0]!.feature).to.deep.equal({ type: 'Feature', properties: { name: 'Place' }, geometry: null });
    leave(peer);
    expect(leaves.length).to.equal(1);
    expect(leaves[0]!.feature === enters[0]!.feature).to.equal(true);
  });

  it('rejects hostile export option shapes without evaluating accessors or exposing their errors', async () => {
    const { element } = await mount(el => { el.strings = { mapExportUnavailable: 'Export unavailable' }; });
    const errors = capture<{ code: string }>(element, 'lr-map-export-error');
    let reads = 0;
    const accessor = { get type() { reads++; throw new Error('Caller export secret'); } };
    const revoked = Proxy.revocable({}, {});
    revoked.revoke();
    const options: unknown[] = [
      null, [], new Date(), { unexpected: true }, { type: 'image/png', attribution: true, extra: true },
      { [Symbol('extra')]: true }, accessor, revoked.proxy,
      new Proxy({}, { ownKeys() { throw new Error('Caller export secret'); } }),
      new Proxy({ type: 'image/png' }, { getOwnPropertyDescriptor() { throw new Error('Caller export secret'); } }),
    ];
    for (const option of options) {
      const error: unknown = await element.exportImage(option as Parameters<LyraMap['exportImage']>[0]).then(() => undefined, (failure: unknown) => failure);
      expect(error instanceof LyraMapImageExportError).to.equal(true);
      expect((error as LyraMapImageExportError).code).to.equal('invalid-options');
      expect((error as Error).message).not.to.include('Caller export secret');
      expect(errors.at(-1)).to.deep.equal({ code: 'invalid-options' });
      expect(Object.isFrozen(errors.at(-1))).to.equal(true);
    }
    await element.updateComplete;
    await waitUntil(() => element.shadowRoot!.textContent!.includes('Export unavailable'));
    expect(reads).to.equal(0);
    expect(errors.length).to.equal(options.length);
    expect(element.shadowRoot!.textContent).not.to.include('Caller export secret');
    element.remove();
    const error: unknown = await element.exportImage().catch((failure: unknown) => failure);
    expect((error as LyraMapImageExportError).code).to.equal('not-ready');
    expect(errors.length).to.equal(options.length);
  });

  it('localizes position, timeout and unknown geolocation failures and clears them on success', async () => {
    const { element, peer } = await mount(el => {
      el.controls = { geolocate: true, attribution: false };
      el.strings = { mapGeolocatePositionUnavailable: 'Position missing', mapGeolocateTimeout: 'Position timed out', mapGeolocateError: 'Position failed' };
    });
    await waitUntil(() => peer.controls.size === 1);
    const control = [...peer.controls][0]!;
    const errors = capture<{ code: string }>(element, 'lr-map-geolocate-error');
    const positions = capture<{ lngLat: readonly number[]; accuracy: number }>(element, 'lr-map-geolocate');
    for (const [code, expected, message] of [[2, 'position-unavailable', 'Position missing'], [3, 'timeout', 'Position timed out'], [99, 'unknown', 'Position failed']] as const) {
      control.fire('error', { code, message: 'Renderer location secret' });
      await element.updateComplete;
      await waitUntil(() => element.shadowRoot!.textContent!.includes(message));
      expect(errors.at(-1)).to.deep.equal({ code: expected });
      expect(element.shadowRoot!.textContent).not.to.include('Renderer location secret');
    }
    control.fire('geolocate', { coords: { longitude: 6, latitude: 49, accuracy: 12 } });
    await element.updateComplete;
    await waitUntil(() => element.shadowRoot!.querySelector('[part="configuration-error"]') === null);
    expect(positions).to.deep.equal([{ lngLat: [6, 49], accuracy: 12 }]);
  });

  it('keeps color swatches when legend icons have invalid view boxes', async () => {
    const { element } = await mount();
    const boxes: unknown[] = [[0, 0, 24], [0, 0, Number.NaN, 24], [0, 0, 10_001, 24], [0, 0, '24', 24], [0, 0, 0, 24]];
    element.legend = boxes.map((viewBox, index) => ({
      label: `Category ${index}`, color: '#ff0000', pattern: 'solid' as const,
      icon: { path: 'M0 0L1 1', viewBox } as unknown as NonNullable<NonNullable<LyraMap['legend']>[number]['icon']>,
    }));
    await element.updateComplete;
    const swatches = element.shadowRoot!.querySelectorAll<HTMLElement>('[part="legend-swatch"]');
    expect(swatches.length).to.equal(boxes.length);
    for (const swatch of swatches) {
      expect(swatch.querySelectorAll('svg').length).to.equal(0);
      expect(getComputedStyle(swatch).backgroundColor).to.equal('rgb(255, 0, 0)');
    }
    element.legend = [{ label: 'Valid', color: '#ff0000', pattern: 'solid', icon: { path: 'M0 0L1 1' } }];
    await element.updateComplete;
    const path = element.shadowRoot!.querySelector('[part="legend-swatch"] path');
    expect(path?.getAttribute('d')).to.equal('M0 0L1 1');
    expect(path?.getAttribute('fill')).to.equal('currentColor');
  });

  it('drops primitive and blank legend rows and respects the total visible label budget', async () => {
    const { element } = await mount();
    element.legend = [null, 'invalid', { label: '   ', color: '#ff0000', pattern: 'solid' },
      ...Array.from({ length: 40 }, (_, index) => ({ label: `${index}:` + 'x'.repeat(254), color: '#ff0000', pattern: 'solid' })),
    ] as unknown as LyraMap['legend'];
    await element.updateComplete;
    expect(element.shadowRoot!.querySelectorAll('[part="legend-swatch"]').length).to.equal(32);
    expect(element.legend.length).to.equal(32);
    expect(element.legend.reduce((sum, entry) => sum + entry.label.length, 0)).to.equal(8192);
    const revoked = Proxy.revocable([], {});
    revoked.revoke();
    element.legend = revoked.proxy;
    await element.updateComplete;
    expect(element.legend.length).to.equal(0);
    expect(element.shadowRoot!.querySelectorAll('[part="legend-swatch"]').length).to.equal(0);
  });
});
