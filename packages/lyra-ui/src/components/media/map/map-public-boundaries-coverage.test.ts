import { expect, fixture, fixtureCleanup, html, waitUntil } from '@open-wc/testing';
import type { FeatureCollection } from 'geojson';
import { ControlMapEngine } from '../../../../test/map-control-engine.js';
import './map.js';
import { LYRA_MAP_EMPTY_STYLE, type LyraMap } from './map.js';

type NativeStyle = ReturnType<ControlMapEngine['getStyle']>;

class PublicBoundaryMap extends ControlMapEngine {
  styleResult?: (style: NativeStyle) => NativeStyle;
  beforeBounds?: () => void;
  beforeUnproject?: () => void;
  beforeMinZoom?: () => void;
  visibleBounds = [-10, -20, 10, 20];
  unprojectedPoints: number[][] = [];
  minimumZoom = 0;
  maximumZoom = 22;

  override getStyle(): NativeStyle {
    const style = super.getStyle();
    return this.styleResult?.(style) ?? style;
  }

  getBounds() {
    this.beforeBounds?.();
    return {
      getWest: () => this.visibleBounds[0]!, getSouth: () => this.visibleBounds[1]!,
      getEast: () => this.visibleBounds[2]!, getNorth: () => this.visibleBounds[3]!,
    };
  }

  unproject(point: readonly [number, number]) {
    this.beforeUnproject?.();
    this.unprojectedPoints.push([...point]);
    return { lng: point[0] / 10, lat: -point[1] / 10 };
  }

  setPadding(): void {}
  getMaxZoom(): number { return this.maximumZoom; }
  setMinZoom(value: number): void {
    this.beforeMinZoom?.();
    this.minimumZoom = value;
    this.zoom = Math.max(this.zoom, value);
  }
  setMaxZoom(value: number): void {
    this.maximumZoom = value;
    this.zoom = Math.min(this.zoom, value);
  }
}

const POINTS: FeatureCollection = {
  type: 'FeatureCollection',
  features: [{ type: 'Feature', id: 'station', properties: { name: 'Station' },
    geometry: { type: 'Point', coordinates: [0, 0] } }],
};
const observerDescriptor = Object.getOwnPropertyDescriptor(window, 'IntersectionObserver');
const contextDescriptor = Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, 'getContext');
const originalContext = HTMLCanvasElement.prototype.getContext;

async function mount(configure: (element: LyraMap) => void = () => undefined) {
  const wrapper = await fixture<HTMLDivElement>(html`<div style="width:320px;height:240px"></div>`);
  const element = document.createElement('lr-map') as LyraMap;
  element.style.cssText = 'width:100%;height:100%';
  element.engine = 'maplibre';
  element.initialization = 'eager';
  element.mapStyle = LYRA_MAP_EMPTY_STYLE;
  element.controls = { attribution: false };
  (element as unknown as { loadLibrary: () => Promise<unknown> }).loadLibrary = async () => ({ Map: PublicBoundaryMap });
  configure(element);
  wrapper.append(element);
  await waitUntil(() => element.map !== undefined);
  await element.updateComplete;
  return { element, peer: element.map as unknown as PublicBoundaryMap };
}

async function load(element: LyraMap, peer: PublicBoundaryMap): Promise<void> {
  peer.ready = true;
  peer.fire('load');
  await element.whenStyleReady();
  await element.updateComplete;
}

function withFaces(style: NativeStyle, faces: unknown): NativeStyle {
  Object.defineProperty(style, 'font-faces', { value: faces, enumerable: true });
  return style;
}

function faceRanges(ranges: unknown): unknown {
  return { 'Test Font': [{ url: '/fonts/test.ttf', 'unicode-range': ranges }] };
}

function collect(element: LyraMap, name: string): Record<string, unknown>[] {
  const details: Record<string, unknown>[] = [];
  element.addEventListener(name, event => { details.push((event as CustomEvent<Record<string, unknown>>).detail); });
  return details;
}

function userMove(peer: PublicBoundaryMap): void {
  peer.fire('move');
  peer.fire('moveend', { originalEvent: new MouseEvent('mouseup') });
}

describe('lr-map loaded style and camera boundaries', () => {
  beforeEach(() => {
    PublicBoundaryMap.initialReady = false;
    PublicBoundaryMap.prepare = undefined;
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

  // A URL style is inspected after the renderer loads it, independently of inline-style admission.
  for (const [name, faces] of [
    ['no font families', {}],
    ['blank family', { ' ': '/fonts/test.ttf' }],
    ['blank shorthand URL', { 'Test Font': ' ' }],
    ['empty face list', { 'Test Font': [] }],
    ['sparse face list', { 'Test Font': new Array<unknown>(1) }],
    ['non-record face', { 'Test Font': [null] }],
    ['unexpected face member', { 'Test Font': [{ url: '/fonts/test.ttf', weight: 400 }] }],
    ['too many face members', { 'Test Font': [{ url: '/fonts/test.ttf', weight: 400, style: 'normal' }] }],
    ['missing face URL', { 'Test Font': [{}] }],
    ['non-string face URL', { 'Test Font': [{ url: 3 }] }],
    ['blank face URL', { 'Test Font': [{ url: ' ' }] }],
    ['non-array ranges', faceRanges('U+26')],
    ['sparse ranges', faceRanges(new Array<unknown>(1))],
    ['non-string range', faceRanges([26])],
    ['malformed range', faceRanges(['not-a-range'])],
    ['overlong wildcard', faceRanges(['U+12345??'])],
    ['descending range', faceRanges(['U+FF-00'])],
    ['range outside Unicode', faceRanges(['U+110000'])],
    ['too many families', Object.fromEntries(Array.from({ length: 65 }, (_, index) => [`Font ${index}`, '/fonts/test.ttf']))],
    ['too many faces', { 'Test Font': Array.from({ length: 257 }, () => ({ url: '/fonts/test.ttf' })) }],
    ['too many ranges', faceRanges(Array.from({ length: 65 }, () => 'U+26'))],
  ] as const) {
    it(`rejects a loaded URL style with ${name} before installing label layers`, async () => {
      const { element, peer } = await mount(el => {
        el.mapStyle = '/styles/labels.json';
        el.strings = { mapInitializationFailed: 'Labels unavailable' };
        el.dataLayers = [{ sourceId: 'points', geojson: POINTS, label: { field: 'name' } }];
      });
      peer.styleResult = style => withFaces(style, faces);
      peer.ready = true;
      peer.fire('load');
      await waitUntil(() => element.map === undefined);
      await element.updateComplete;
      expect(peer.layers.size).to.equal(0);
      expect(peer.removed).to.equal(true);
      expect(element.shadowRoot?.querySelector('[part="error"]')?.textContent).to.include('Labels unavailable');
    });
  }

  for (const location of ['style', 'glyphs', 'family', 'face URL', 'ranges', 'range entry'] as const) {
    it(`does not invoke a loaded native font ${location} getter`, async () => {
      let reads = 0;
      const accessor = { enumerable: true, get() { reads++; throw new Error('Unreadable font declaration'); } };
      const ranges = ['U+26'];
      const face = { url: '/fonts/test.ttf', 'unicode-range': ranges };
      const faces = { 'Test Font': [face] };
      if (location === 'family') Object.defineProperty(faces, 'Test Font', accessor);
      if (location === 'face URL') Object.defineProperty(face, 'url', accessor);
      if (location === 'ranges') Object.defineProperty(face, 'unicode-range', accessor);
      if (location === 'range entry') Object.defineProperty(ranges, '0', accessor);
      const { element, peer } = await mount(el => {
        el.mapStyle = '/styles/labels.json';
        el.dataLayers = [{ sourceId: 'points', geojson: POINTS, label: { field: 'name' } }];
      });
      peer.styleResult = style => {
        if (location === 'style') Object.defineProperty(style, 'font-faces', accessor);
        else withFaces(style, faces);
        if (location === 'glyphs') Object.defineProperty(style, 'glyphs', accessor);
        return style;
      };
      peer.ready = true;
      peer.fire('load');
      await waitUntil(() => element.map === undefined);
      expect(reads).to.equal(0);
      expect(peer.layers.size).to.equal(0);
    });
  }

  it('contains a loaded font record whose key enumeration throws', async () => {
    let enumerations = 0;
    const faces = new Proxy({}, { ownKeys() { enumerations++; throw new Error('Native font record unavailable'); } });
    const { element, peer } = await mount(el => {
      el.mapStyle = '/styles/labels.json';
      el.dataLayers = [{ sourceId: 'points', geojson: POINTS, label: { field: 'name' } }];
    });
    peer.styleResult = style => withFaces(style, faces);
    peer.ready = true;
    peer.fire('load');
    await waitUntil(() => element.map === undefined);
    expect(enumerations).to.be.greaterThan(0);
    expect(peer.layers.size).to.equal(0);
  });

  it('ignores hidden and symbolic native families while retaining a readable font fallback chain', async () => {
    const faces = {
      'Test Font': [{ url: '/fonts/test.ttf', 'unicode-range': ['U+26', 'U+0000-00FF', 'U+6??', 'U+10FFFF'] }],
      'Fallback Font': '/fonts/fallback.ttf',
    };
    Object.defineProperty(faces, 'Hidden Font', { value: null });
    Object.defineProperty(faces, Symbol('Font metadata'), { value: null, enumerable: true });
    const { element, peer } = await mount(el => {
      el.mapStyle = '/styles/labels.json';
      el.dataLayers = [{ sourceId: 'points', geojson: POINTS,
        label: { field: 'name', font: ['Test Font', 'Fallback Font'] } }];
    });
    peer.styleResult = style => withFaces(style, faces);
    await load(element, peer);
    const labels = [...peer.layers.values()].filter(layer => (layer as { type?: string }).type === 'symbol');
    expect(labels.length).to.equal(1);
    expect((labels[0] as { layout: Record<string, unknown> }).layout['text-font']).to.deep.equal(['Test Font', 'Fallback Font']);
    expect(element.map === peer).to.equal(true);
  });

  it('omits unreadable native bounds from movement events and resumes reporting after recovery', async () => {
    const { element, peer } = await mount();
    await load(element, peer);
    const moves = collect(element, 'lr-map-move');
    const views = collect(element, 'lr-map-view-change');
    peer.beforeBounds = () => { throw new Error('Native bounds unavailable'); };
    userMove(peer);
    expect(moves.length).to.equal(1);
    expect(views.length).to.equal(1);
    expect(Object.hasOwn(moves[0]!, 'bounds')).to.equal(false);
    expect(Object.hasOwn(views[0]!, 'bounds')).to.equal(false);
    peer.beforeBounds = undefined;
    peer.visibleBounds = [350, -100, 370, 100];
    userMove(peer);
    expect(moves[1]?.['bounds']).to.deep.equal([[-10, -90], [10, 90]]);
    expect(views[1]?.['bounds']).to.deep.equal([[-10, -90], [10, 90]]);
    expect(Object.isFrozen(views[1]?.['bounds'])).to.equal(true);
  });

  it('omits nonfinite bounds and normalizes a subsequently visible whole world', async () => {
    const { element, peer } = await mount();
    await load(element, peer);
    const moves = collect(element, 'lr-map-move');
    peer.visibleBounds = [Number.NaN, -20, 10, 20];
    userMove(peer);
    expect(Object.hasOwn(moves[0]!, 'bounds')).to.equal(false);
    peer.visibleBounds = [-220, -95, 220, 95];
    userMove(peer);
    expect(moves[1]?.['bounds']).to.deep.equal([[-180, -90], [180, 90]]);
  });

  it('contains padded viewport projection failures and later measures all four visible corners', async () => {
    const { element, peer } = await mount(el => { el.cameraPadding = { top: 10, right: 20, bottom: 30, left: 40 }; });
    await load(element, peer);
    const moves = collect(element, 'lr-map-move');
    peer.beforeUnproject = () => { throw new Error('Native viewport projection unavailable'); };
    userMove(peer);
    expect(Object.hasOwn(moves[0]!, 'bounds')).to.equal(false);
    peer.beforeUnproject = undefined;
    peer.unprojectedPoints = [];
    const container = peer.options['container'] as HTMLElement;
    const width = container.clientWidth, height = container.clientHeight;
    expect(width).to.be.greaterThan(60);
    expect(height).to.be.greaterThan(40);
    userMove(peer);
    expect(peer.unprojectedPoints.slice(0, 4)).to.deep.equal([[40, 10], [width - 20, 10], [width - 20, height - 30], [40, height - 30]]);
    expect(moves[1]?.['bounds']).to.deep.equal([[4, -(height - 30) / 10], [(width - 20) / 10, -1]]);
  });

  it('does not publish a failed native camera read or overwrite the last public camera', async () => {
    const { element, peer } = await mount(el => { el.center = [12, 34]; el.zoom = 5; });
    await load(element, peer);
    const moves = collect(element, 'lr-map-move');
    const views = collect(element, 'lr-map-view-change');
    peer.beforeGetCenter = () => { throw new Error('Native camera unavailable'); };
    userMove(peer);
    expect(moves.length).to.equal(0);
    expect(views.length).to.equal(0);
    expect(element.center).to.deep.equal([12, 34]);
    expect(element.zoom).to.equal(5);
    peer.beforeGetCenter = undefined;
    peer.center = { lng: 23, lat: 45 };
    userMove(peer);
    expect(moves[0]?.['center']).to.deep.equal([23, 45]);
    expect(views[0]?.['center']).to.deep.equal([23, 45]);
    expect(element.center).to.deep.equal([23, 45]);
  });

  it('contains a rejected native zoom limit and applies a later supported limit silently', async () => {
    const { element, peer } = await mount(el => { el.zoom = 5; });
    await load(element, peer);
    const views = collect(element, 'lr-map-view-change');
    peer.beforeMinZoom = () => { throw new Error('Native zoom limit unavailable'); };
    element.minZoom = 3;
    await element.updateComplete;
    expect(peer.minimumZoom).to.equal(0);
    expect(element.zoom).to.equal(5);
    expect(views.length).to.equal(0);
    peer.beforeMinZoom = undefined;
    element.minZoom = 4;
    element.maxZoom = 12;
    await element.updateComplete;
    expect(peer.minimumZoom).to.equal(4);
    expect(peer.maximumZoom).to.equal(12);
    expect(element.map === peer).to.equal(true);
    expect(views.length).to.equal(0);
  });
});
