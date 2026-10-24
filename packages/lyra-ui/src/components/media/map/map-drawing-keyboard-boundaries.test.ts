import { expect, fixture, fixtureCleanup, html, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import { ControlMapEngine, FakeAttributionControl as AttributionControl } from '../../../../test/map-control-engine.js';
import { MapDrawing, type LyraMapDrawingSnapshot } from './map-drawing.js';
import { loadMapDrawingRuntime } from './map-feature-loader.js';
import { LYRA_MAP_EMPTY_STYLE, type LyraMap } from './map.js';

class DrawingMap extends ControlMapEngine {
  offsetX = 0;
  override project(point: readonly [number, number]) {
    this.beforeProject?.();
    return { x: point[0] * 10 + 100 + this.offsetX, y: point[1] * 10 + 100 };
  }
  unproject(point: readonly [number, number]) {
    return { lng: (point[0] - 100 - this.offsetX) / 10, lat: (point[1] - 100) / 10 };
  }
}

const observerDescriptor = Object.getOwnPropertyDescriptor(window, 'IntersectionObserver');
const contextDescriptor = Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, 'getContext')!;
const originalContext = HTMLCanvasElement.prototype.getContext;
let originalUrl: string;
let originalState: unknown;

async function settle(element: LyraMap, peer: DrawingMap) {
  await element.updateComplete;
  peer.idle = true; peer.fire('idle');
  await element.whenIdle(); await element.updateComplete;
}

async function mount() {
  const wrapper = await fixture<HTMLDivElement>(html`<div></div>`);
  const element = document.createElement('lr-map') as LyraMap;
  element.engine = 'maplibre'; element.mapStyle = LYRA_MAP_EMPTY_STYLE;
  element.setAttribute('dir', 'ltr');
  element.style.cssText = 'inline-size:320px;block-size:320px';
  (element as unknown as { loadLibrary: () => Promise<unknown> }).loadLibrary = async () => ({ Map: DrawingMap, AttributionControl });
  wrapper.append(element);
  await waitUntil(() => element.map !== undefined); await element.updateComplete;
  const peer = element.map as unknown as DrawingMap;
  peer.fire('load'); await element.whenStyleReady(); await element.updateComplete;
  peer.canvas.style.cssText = 'width:100%;height:100%;display:block';
  element.shadowRoot!.querySelector('[part="container"]')!.append(peer.canvas);
  await waitUntil(() => peer.canvas.clientWidth > 0 && peer.canvas.clientHeight > 0);
  return { element, peer };
}

function completed() {
  const drawing = new MapDrawing('line');
  drawing.add([0, 0]); drawing.add([5, 0]); drawing.add([10, 0]);
  return drawing.complete().state;
}

function handles(element: LyraMap) {
  return [...element.shadowRoot!.querySelectorAll<HTMLButtonElement>('[part="drawing-vertex"]')];
}

describe('lr-map drawing keyboard boundaries', () => {
  before(() => loadMapDrawingRuntime());
  beforeEach(() => {
    originalUrl = location.href; originalState = history.state;
    DrawingMap.initialReady = true; DrawingMap.prepare = undefined; DrawingMap.initialZoomGesture = true;
    Object.defineProperty(window, 'IntersectionObserver', { configurable: true, value: undefined });
    Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', { configurable: true, writable: true,
      value(this: HTMLCanvasElement, id: string, ...rest: unknown[]) {
        return id === 'webgl2' ? {} : originalContext.call(this, id as never, ...(rest as []));
      } });
  });
  afterEach(() => {
    fixtureCleanup(); history.replaceState(originalState, '', originalUrl);
    if (observerDescriptor) Object.defineProperty(window, 'IntersectionObserver', observerDescriptor);
    else Reflect.deleteProperty(window, 'IntersectionObserver');
    Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', contextDescriptor);
  });

  it('moves selection to End and PageUp without changing geometry and clamps at the first handle', async () => {
    const { element, peer } = await mount();
    expect(element.editDrawing(completed())).to.equal(true); await settle(element, peer);
    await waitUntil(() => handles(element).length === 3);
    let changes = 0;
    element.addEventListener('lr-map-draw-change', () => { changes += 1; });
    await focusByKeyboard(handles(element)[0]!);
    for (const [key, selected] of [['End', 2], ['PageUp', 1], ['PageUp', 0], ['PageUp', 0]] as const) {
      await sendKeys({ press: key }); await element.updateComplete;
      await waitUntil(() => element.shadowRoot!.activeElement === handles(element)[selected]);
      expect(handles(element).map(handle => handle.tabIndex)).to.deep.equal([0, 1, 2].map(index => index === selected ? 0 : -1));
    }
    expect(changes).to.equal(0);
  });

  it('moves an LTR vertex by normal and accelerated arrow steps with one end event per accepted move', async () => {
    const { element, peer } = await mount();
    expect(element.editDrawing(completed())).to.equal(true); await settle(element, peer);
    await waitUntil(() => handles(element).length === 3);
    const changes: LyraMapDrawingSnapshot[] = [], ends: number[] = [];
    element.addEventListener('lr-map-draw-change', event => { changes.push((event as CustomEvent<LyraMapDrawingSnapshot>).detail); });
    element.addEventListener('lr-map-draw-vertex-end', event => { ends.push((event as CustomEvent<{ index: number }>).detail.index); });
    await focusByKeyboard(handles(element)[0]!);
    for (const [key, expected] of [
      ['ArrowRight', [0.8, 0]], ['Shift+ArrowLeft', [-2.4, 0]],
      ['Shift+ArrowUp', [-2.4, -3.2]], ['ArrowDown', [-2.4, -2.4]],
    ] as const) {
      const count = changes.length;
      await sendKeys({ press: key }); await settle(element, peer);
      expect(changes.length).to.equal(count + 1);
      expect(changes.at(-1)!.vertices[0]![0]).to.be.closeTo(expected[0], 0.0001);
      expect(changes.at(-1)!.vertices[0]![1]).to.be.closeTo(expected[1], 0.0001);
      expect(changes.at(-1)!.vertices.slice(1)).to.deep.equal([[5, 0], [10, 0]]);
    }
    expect(ends).to.deep.equal([0, 0, 0, 0]);
  });

  it('selects the first remaining visible vertex after a pan removes the selected handle', async () => {
    const { element, peer } = await mount();
    expect(element.editDrawing(completed())).to.equal(true); await settle(element, peer);
    await waitUntil(() => handles(element).length === 3);
    expect(handles(element)[0]!.tabIndex).to.equal(0);
    peer.offsetX = -125; peer.fire('move'); await settle(element, peer);
    await waitUntil(() => handles(element).length === 2);
    expect(handles(element).map(handle => handle.getAttribute('aria-label'))).to.deep.equal(['Vertex 2', 'Vertex 3']);
    expect(handles(element).map(handle => handle.tabIndex)).to.deep.equal([0, -1]);
    peer.offsetX = 0; peer.fire('move'); await settle(element, peer);
    await waitUntil(() => handles(element).length === 3);
    expect(handles(element).map(handle => handle.tabIndex)).to.deep.equal([-1, 0, -1]);
  });

  it('restores pre-existing canvas shortcuts after cancelling an editing session', async () => {
    const { element, peer } = await mount();
    peer.canvas.setAttribute('aria-keyshortcuts', 'Alt+ArrowLeft Alt+ArrowRight');
    expect(element.editDrawing(completed())).to.equal(true); await settle(element, peer);
    expect(peer.canvas.getAttribute('aria-keyshortcuts')).to.equal('Enter');
    expect(element.cancelDrawing()).to.equal(true); await settle(element, peer);
    expect(peer.canvas.getAttribute('aria-keyshortcuts')).to.equal('Alt+ArrowLeft Alt+ArrowRight');
    expect(handles(element).length).to.equal(0);
  });

  it('reports a failed native center lookup without adding a vertex and allows the next center action', async () => {
    const { element, peer } = await mount();
    element.strings = { mapDrawingUnavailable: 'Center is unavailable' };
    element.drawMode = 'line'; await settle(element, peer);
    const add = element.shadowRoot!.querySelector<HTMLButtonElement>('[part="drawing-add"]')!;
    await waitUntil(() => !add.disabled);
    const changes: LyraMapDrawingSnapshot[] = [];
    element.addEventListener('lr-map-draw-change', event => { changes.push((event as CustomEvent<LyraMapDrawingSnapshot>).detail); });
    peer.beforeGetCenter = () => { peer.beforeGetCenter = undefined; throw new Error('Native center read failed'); };
    await focusByKeyboard(add); await sendKeys({ press: 'Enter' }); await settle(element, peer);
    expect(changes.length).to.equal(0); expect(element.drawMode).to.equal('line');
    expect(element.shadowRoot!.textContent).to.include('Center is unavailable');
    peer.beforeGetCenter = undefined; peer.center = { lng: 2, lat: 3 };
    await sendKeys({ press: 'Enter' }); await settle(element, peer);
    expect(changes.length).to.equal(1); expect(changes[0]!.vertices).to.deep.equal([[2, 3]]);
    expect(element.shadowRoot!.textContent).not.to.include('Center is unavailable');
  });
});
