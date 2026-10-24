import { expect, fixture, fixtureCleanup, html, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import { ControlMapEngine } from '../../../../test/map-control-engine.js';
import { MapDrawing, type LyraMapDrawingSnapshot } from './map-drawing.js';
import { loadMapDrawingRuntime } from './map-feature-loader.js';
import { LYRA_MAP_EMPTY_STYLE, type LyraMap } from './map.js';

class DrawingPeer extends ControlMapEngine {
  canvasUnavailable = false;
  failedLongitude?: number;
  offsetX = 0;
  override getCanvas(): HTMLCanvasElement {
    if (this.canvasUnavailable) throw new Error('Native canvas unavailable');
    return super.getCanvas();
  }
  override project(point: readonly [number, number]) {
    if (point[0] === this.failedLongitude) throw new Error('Native projection unavailable');
    return { x: 100 + point[0] * 10 + this.offsetX, y: 100 + point[1] * 10 };
  }
  unproject(point: readonly [number, number]) { return { lng: (point[0] - 100 - this.offsetX) / 10, lat: (point[1] - 100) / 10 }; }
}
const observerDescriptor = Object.getOwnPropertyDescriptor(window, 'IntersectionObserver');
const contextDescriptor = Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, 'getContext')!;
const originalContext = HTMLCanvasElement.prototype.getContext;
async function settle(element: LyraMap, peer: DrawingPeer) {
  await element.updateComplete; peer.idle = true; peer.fire('idle');
  await element.whenIdle(); await element.updateComplete;
}
async function mount() {
  const wrapper = await fixture<HTMLDivElement>(html`<div></div>`);
  const element = document.createElement('lr-map') as LyraMap;
  element.engine = 'maplibre'; element.initialization = 'eager'; element.mapStyle = LYRA_MAP_EMPTY_STYLE;
  element.controls = { attribution: false }; element.dir = 'ltr';
  element.strings = { mapDrawingUnavailable: 'Drawing is unavailable' };
  element.style.cssText = 'inline-size:320px;block-size:320px';
  (element as unknown as { loadLibrary: () => Promise<unknown> }).loadLibrary = async () => ({ Map: DrawingPeer });
  wrapper.append(element);
  await waitUntil(() => element.map !== undefined); await element.updateComplete;
  const peer = element.map as unknown as DrawingPeer;
  peer.fire('load'); await element.whenStyleReady(); await element.updateComplete;
  peer.canvas.style.cssText = 'display:block;width:100%;height:100%';
  element.shadowRoot!.querySelector('[part="container"]')!.append(peer.canvas);
  await waitUntil(() => peer.canvas.clientWidth > 0 && peer.canvas.clientHeight > 0);
  return { element, peer };
}
async function arm(element: LyraMap) {
  element.drawMode = 'line'; await element.updateComplete;
  await waitUntil(() => element.shadowRoot!.querySelector<HTMLButtonElement>('[part="drawing-add"]')?.disabled === false);
}
async function vertex(element: LyraMap, peer: DrawingPeer, lng: number) {
  peer.fire('click', { point: { x: 100 + lng * 10, y: 100 }, lngLat: { lng, lat: 0 } });
  await settle(element, peer);
}
function completed(): LyraMapDrawingSnapshot {
  const drawing = new MapDrawing('line');
  for (const point of [[0, 0], [5, 0], [10, 0]]) drawing.add(point);
  return drawing.complete().state;
}
function capture(element: LyraMap, type: string) {
  const states: LyraMapDrawingSnapshot[] = [];
  element.addEventListener(type, event => { states.push((event as CustomEvent<LyraMapDrawingSnapshot>).detail); });
  return states;
}
const handles = (element: LyraMap) => [...element.shadowRoot!.querySelectorAll<HTMLButtonElement>('[part="drawing-vertex"]')];
const labels = (element: LyraMap) => [...element.shadowRoot!.querySelectorAll<HTMLElement>('[part="drawing-measurement"]')];

describe('lr-map drawing native recovery', () => {
  before(() => loadMapDrawingRuntime());
  beforeEach(() => {
    DrawingPeer.initialReady = true; DrawingPeer.prepare = undefined; DrawingPeer.initialZoomGesture = true;
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

  it('rejects a partially failing native zoom lease without starting a drawing and accepts a corrected request', async () => {
    const { element, peer } = await mount(), disable = peer.doubleClickZoom.disable;
    const starts = capture(element, 'lr-map-draw-start'), completions = capture(element, 'lr-map-draw-complete');
    peer.doubleClickZoom.disable = () => { disable(); throw new Error('Native zoom lease failed'); };
    element.drawMode = 'line'; await element.updateComplete;
    await waitUntil(() => element.shadowRoot!.textContent?.includes('Drawing is unavailable') === true);
    expect(peer.zoomGesture).to.equal(true); expect(peer.sources.size).to.equal(0);
    expect(starts.length).to.equal(0); expect(element.completeDrawing()).to.equal(false);
    expect(element.shadowRoot!.textContent).not.to.include('Native zoom lease failed');
    peer.doubleClickZoom.disable = disable;
    element.drawMode = 'none'; await element.updateComplete; await arm(element);
    await vertex(element, peer, 0); await vertex(element, peer, 5);
    expect(element.completeDrawing()).to.equal(true); await settle(element, peer);
    expect(starts.length).to.equal(1); expect(completions[0]?.vertices).to.deep.equal([[0, 0], [5, 0]]);
    expect(peer.zoomGesture).to.equal(true); expect(peer.sources.size).to.equal(0);
    expect(element.shadowRoot!.querySelectorAll('[part="configuration-error"]').length).to.equal(0);
  });

  it('contains a native canvas lookup failure during drawing setup and installs controls after style recovery', async () => {
    const { element, peer } = await mount();
    await fixture<HTMLSpanElement>(html`<span id="drawing-map-description">Drawing help</span>`);
    const descriptionNames = () => {
      const reflected = Reflect.get(peer.canvas, 'ariaDescribedByElements') as readonly Element[] | null | undefined;
      if (reflected) return [...reflected].map(description => description.textContent);
      const root = peer.canvas.getRootNode();
      const ids = (peer.canvas.getAttribute('aria-describedby') ?? '').split(/\s+/).filter(Boolean);
      return ids.map(id => root instanceof Document || root instanceof ShadowRoot ? root.getElementById(id)?.textContent : undefined)
        .filter((text): text is string => typeof text === 'string');
    };
    element.setAttribute('aria-describedby', 'drawing-map-description');
    await waitUntil(() => descriptionNames().join(' ') === 'Drawing help');
    expect(descriptionNames()).to.deep.equal(['Drawing help']);
    peer.canvasUnavailable = true;
    element.drawMode = 'line'; await element.updateComplete;
    await waitUntil(() => element.shadowRoot!.textContent?.includes('Drawing is unavailable') === true);
    expect(descriptionNames()).to.deep.equal([]);
    expect(peer.canvas.getAttribute('aria-keyshortcuts')).to.equal(null);
    expect(peer.sources.size).to.equal(0); expect(peer.removed).to.equal(false);
    expect(element.shadowRoot!.textContent).not.to.include('Native canvas unavailable');
    peer.canvasUnavailable = false;
    element.mapStyle = { ...LYRA_MAP_EMPTY_STYLE, name: 'Recovered drawing style' };
    await element.updateComplete; await element.whenStyleReady(); await settle(element, peer);
    expect(descriptionNames()).to.deep.equal(['Drawing help']);
    await waitUntil(() => peer.canvas.getAttribute('aria-keyshortcuts') === 'Enter Backspace');
    await vertex(element, peer, 0); await vertex(element, peer, 5);
    await waitUntil(() => handles(element).length === 2);
    expect(element.completeDrawing()).to.equal(true); await settle(element, peer);
    expect(peer.canvas.getAttribute('aria-keyshortcuts')).to.equal(null);
    expect(peer.zoomGesture).to.equal(true); expect(peer.removed).to.equal(false);
  });

  it('omits only unprojectable or offscreen measurement labels and restores them without changing the drawing', async () => {
    const { element, peer } = await mount(); element.drawingMeasurements = true; await element.updateComplete;
    const original = completed(), changes = capture(element, 'lr-map-draw-change'), completions = capture(element, 'lr-map-draw-complete');
    expect(element.editDrawing(original)).to.equal(true); await settle(element, peer);
    await waitUntil(() => labels(element).length === 3 && handles(element).length === 3);
    peer.failedLongitude = 5; peer.fire('move');
    await waitUntil(() => labels(element).length === 1 && handles(element).length === 2);
    expect(labels(element)[0]!.dataset['kind']).to.equal('length');
    peer.failedLongitude = undefined; peer.offsetX = -1000; peer.fire('move');
    await waitUntil(() => labels(element).length === 0 && handles(element).length === 0);
    peer.offsetX = 0; peer.fire('move');
    await waitUntil(() => labels(element).length === 3 && handles(element).length === 3);
    expect(changes.length).to.equal(0);
    expect(element.completeDrawing()).to.equal(true); await settle(element, peer);
    expect(completions[0]?.vertices).to.deep.equal(original.vertices);
  });

  it('leaves a keyboard edit unchanged when native projection fails and accepts the next key after recovery', async () => {
    const { element, peer } = await mount();
    expect(element.editDrawing(completed())).to.equal(true); await settle(element, peer);
    await waitUntil(() => handles(element).length === 3);
    const changes = capture(element, 'lr-map-draw-change'), ends = capture(element, 'lr-map-draw-vertex-end');
    await focusByKeyboard(handles(element)[0]!);
    peer.failedLongitude = 0; await sendKeys({ press: 'ArrowRight' }); await element.updateComplete;
    expect(changes.length).to.equal(0); expect(ends.length).to.equal(0);
    expect(handles(element)[0]!.tabIndex).to.equal(0);
    peer.failedLongitude = undefined; await sendKeys({ press: 'ArrowRight' }); await settle(element, peer);
    expect(changes.length).to.equal(1); expect(ends.length).to.equal(1);
    expect(changes[0]!.vertices).to.deep.equal([[0.8, 0], [5, 0], [10, 0]]);
  });

});
