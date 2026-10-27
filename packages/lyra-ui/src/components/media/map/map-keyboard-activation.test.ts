import { expect, fixture, fixtureCleanup, html, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import { ControlMapEngine, FakeAttributionControl } from '../../../../test/map-control-engine.js';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import { loadMapFeatureStateRuntime } from './map-feature-loader.js';
import { LyraMap, LYRA_MAP_EMPTY_STYLE } from './map.js';
void LyraMap;

/** A peer whose focusable canvas lives in the container, as the native canvas does. */
class FocusMap extends ControlMapEngine {
  static override initialReady = true;
  queryPoint?: unknown;
  box: { west: number; south: number; east: number; north: number } | 'throw' = { west: 1, south: 2, east: 3, north: 4 };
  constructor(options: Record<string, unknown>) {
    super(options);
    this.canvas.tabIndex = 0; this.canvas.setAttribute('aria-label', 'Map');
    (options['container'] as HTMLElement).append(this.canvas);
  }
  override queryRenderedFeatures(point: unknown, options: { layers: readonly string[] }): unknown[] {
    this.queryPoint = point; return super.queryRenderedFeatures(point, options);
  }
  getBounds() {
    const box = this.box;
    if (box === 'throw') throw new Error('Private native failure');
    return { getWest: () => box.west, getSouth: () => box.south, getEast: () => box.east, getNorth: () => box.north };
  }
  unproject([x, y]: [number, number]) { return { lng: x / 10 - 50, lat: 40 - y / 10 }; }
  setPadding(): void {}
}
const POINTS = { type: 'FeatureCollection' as const, features: [{ type: 'Feature' as const, id: 0, properties: { name: 'Centre' }, geometry: { type: 'Point' as const, coordinates: [1, 2] } }] };
const originalObserver = Object.getOwnPropertyDescriptor(window, 'IntersectionObserver');
const originalContext = HTMLCanvasElement.prototype.getContext;

async function mount(configure: (element: LyraMap) => void = () => undefined, wrapperAttributes = '') {
  const wrapper = await fixture<HTMLDivElement>(html`<div style="inline-size:400px;block-size:300px"></div>`);
  if (wrapperAttributes === 'inert') wrapper.inert = true;
  const element = document.createElement('lr-map') as LyraMap;
  element.engine = 'maplibre'; element.initialization = 'eager'; element.mapStyle = LYRA_MAP_EMPTY_STYLE;
  element.style.cssText = 'inline-size:400px;block-size:300px'; element.controls = { attribution: false };
  element.dataLayers = [{ sourceId: 'points', geojson: POINTS }];
  (element as unknown as { loadLibrary: () => Promise<unknown> }).loadLibrary = async () => ({ Map: FocusMap, AttributionControl: FakeAttributionControl });
  configure(element); wrapper.append(element);
  await waitUntil(() => element.map !== undefined); await element.updateComplete;
  const peer = element.map as unknown as FocusMap;
  peer.fire('load'); await element.updateComplete; await element.whenStyleReady(); await element.updateComplete;
  const layer = [...peer.layers].find(([, value]) => (value as { type?: string }).type === 'circle')![0];
  peer.hits = [{ type: 'Feature', id: 0, source: 'points', layer: { id: layer }, properties: { name: 'Centre' }, geometry: { type: 'Point', coordinates: [1, 2] } }];
  const clicks: Record<string, unknown>[] = [], picks: unknown[] = [];
  element.addEventListener('lr-map-click', event => { clicks.push((event as CustomEvent<Record<string, unknown>>).detail); });
  element.addEventListener('lr-map-pick', event => { picks.push((event as CustomEvent).detail); });
  const prevented: boolean[] = [];
  wrapper.addEventListener('keydown', event => { prevented.push(event.defaultPrevented); });
  return { element, peer, wrapper, layer, clicks, picks, prevented };
}

describe('lr-map keyboard activation at the view centre', () => {
  before(() => loadMapFeatureStateRuntime());
  beforeEach(() => {
    Object.defineProperty(window, 'IntersectionObserver', { configurable: true, value: undefined });
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, id: string, ...rest: unknown[]) {
      return id === 'webgl2' ? {} : originalContext.call(this, id as never, ...(rest as []));
    } as typeof originalContext;
  });
  afterEach(() => {
    fixtureCleanup(); HTMLCanvasElement.prototype.getContext = originalContext;
    if (originalObserver) Object.defineProperty(window, 'IntersectionObserver', originalObserver);
    else Reflect.deleteProperty(window, 'IntersectionObserver');
  });

  it('leaves Enter and Space untouched while unset', async () => {
    const h = await mount();
    expect(h.element.keyboardActivation).to.equal(false);
    await focusByKeyboard(h.peer.canvas);
    await sendKeys({ press: 'Enter' }); await sendKeys({ press: 'Space' });
    expect(h.clicks.length).to.equal(0);
    expect(h.peer.queryCount).to.equal(0);
    expect(h.prevented).to.deep.equal([false, false]);
  });
  it('activates the interactive feature at the view centre through the click contract', async () => {
    const h = await mount(element => { element.keyboardActivation = true; });
    h.peer.projected = { x: 120, y: 80 };
    await focusByKeyboard(h.peer.canvas);
    for (const key of ['Enter', 'Space']) await sendKeys({ press: key });
    expect(h.clicks.length).to.equal(2);
    for (const detail of h.clicks) {
      expect(detail['trigger']).to.equal('keyboard');
      expect(detail['lngLat']).to.deep.equal([h.peer.center.lng, h.peer.center.lat]);
      expect((detail['hit'] as { layerId: string }).layerId).to.equal(h.layer);
      expect(detail['origin']).to.equal('data-layer'); expect(detail['sourceId']).to.equal('points');
    }
    expect(h.peer.queryPoint).to.deep.equal([120, 80]);
    expect(h.prevented).to.deep.equal([true, true]);
    expect(h.picks.length).to.equal(0);
    h.peer.fire('click', { point: { x: 1, y: 2 }, lngLat: { lng: 1, lat: 2 } });
    expect(h.clicks.length).to.equal(3);
    expect(Object.hasOwn(h.clicks[2]!, 'trigger')).to.equal(false);
  });
  it('reports an empty centre as a keyboard click without a feature', async () => {
    const h = await mount(element => { element.keyboardActivation = true; });
    h.peer.hits = [];
    await focusByKeyboard(h.peer.canvas); await sendKeys({ press: 'Enter' });
    expect(h.clicks.length).to.equal(1);
    expect(h.clicks[0]!['feature']).to.equal(undefined); expect(h.clicks[0]!['trigger']).to.equal('keyboard');
  });
  it('does not activate while picking or drawing, and ignores modified or repeated keys', async () => {
    const h = await mount(element => { element.keyboardActivation = true; element.pickMode = true; });
    await focusByKeyboard(h.peer.canvas); await sendKeys({ press: 'Enter' });
    expect(h.clicks.length).to.equal(0); expect(h.picks.length).to.equal(0);
    h.element.pickMode = false; h.element.drawMode = 'line'; await h.element.updateComplete;
    await focusByKeyboard(h.peer.canvas); await sendKeys({ press: 'Enter' });
    expect(h.clicks.length).to.equal(0);
    h.element.drawMode = 'none'; await h.element.updateComplete;
    await focusByKeyboard(h.peer.canvas);
    await sendKeys({ press: 'Control+Enter' });
    h.peer.canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', repeat: true, bubbles: true, composed: true }));
    expect(h.clicks.length).to.equal(0);
    await sendKeys({ press: 'Enter' });
    expect(h.clicks.length).to.equal(1);
  });
  it('does not activate a disabled or inert map', async () => {
    const disabled = await mount(element => { element.keyboardActivation = true; });
    disabled.element.setAttribute('disabled', '');
    disabled.peer.canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, composed: true, cancelable: true }));
    expect(disabled.clicks.length).to.equal(0);
    fixtureCleanup();
    const inert = await mount(element => { element.keyboardActivation = true; }, 'inert');
    inert.peer.canvas.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true, composed: true, cancelable: true }));
    expect(inert.clicks.length).to.equal(0);
  });
});

describe('lr-map visible bounds', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'IntersectionObserver', { configurable: true, value: undefined });
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, id: string, ...rest: unknown[]) {
      return id === 'webgl2' ? {} : originalContext.call(this, id as never, ...(rest as []));
    } as typeof originalContext;
  });
  afterEach(() => {
    fixtureCleanup(); HTMLCanvasElement.prototype.getContext = originalContext;
    if (originalObserver) Object.defineProperty(window, 'IntersectionObserver', originalObserver);
    else Reflect.deleteProperty(window, 'IntersectionObserver');
  });

  it('returns null before the engine exists', () => {
    const element = document.createElement('lr-map') as LyraMap;
    expect(element.getVisibleBounds()).to.equal(null);
    expect(element.getVisibleBounds({ padded: false })).to.equal(null);
  });
  it('reads the padded and full viewport synchronously as frozen normalized boxes', async () => {
    const h = await mount(element => { element.cameraPadding = { top: 30, right: 40, bottom: 50, left: 60 }; });
    const padded = h.element.getVisibleBounds()!;
    expect(padded).to.deep.equal([[-44, 15], [-14, 37]]);
    expect(Object.isFrozen(padded) && Object.isFrozen(padded[0]) && Object.isFrozen(padded[1])).to.equal(true);
    expect(h.element.getVisibleBounds({ padded: true })).to.deep.equal(padded);
    expect(h.element.getVisibleBounds({ padded: false })).to.deep.equal([[1, 2], [3, 4]]);
    h.peer.box = { west: 190, south: -95, east: 200, north: 95 };
    expect(h.element.getVisibleBounds({ padded: false })).to.deep.equal([[-170, -90], [-160, 90]]);
    h.peer.box = 'throw';
    expect(h.element.getVisibleBounds({ padded: false })).to.equal(null);
  });
  it('uses the full viewport when no padding applies', async () => {
    const h = await mount();
    expect(h.element.getVisibleBounds()).to.deep.equal([[1, 2], [3, 4]]);
  });
});
