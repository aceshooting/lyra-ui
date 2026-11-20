import { expect, fixture, fixtureCleanup, html, waitUntil } from '@open-wc/testing';
import { ControlMapEngine } from '../../../../test/map-control-engine.js';
import { LyraMap, LYRA_MAP_EMPTY_STYLE } from '../../lr-map.js';
void LyraMap;

type ExtentMap = LyraMap & { canvasTarget?: HTMLElement | 'viewport' };
type Padding = { top: number; right: number; bottom: number; left: number };
class ExtentEngine extends ControlMapEngine {
  readonly paddingCalls: Padding[] = [];
  readonly fitOptions: Record<string, unknown>[] = [];
  resizeCalls = 0;
  constructor(options: Record<string, unknown>) {
    super(options);
    const container = options['container'] as HTMLElement;
    this.canvas.className = 'maplibregl-canvas';
    const chrome = document.createElement('div');
    chrome.className = 'maplibregl-control-container';
    chrome.innerHTML = '<div class="maplibregl-ctrl-top-left"><div class="maplibregl-ctrl"><button>Map action</button></div></div><div class="maplibregl-ctrl-top-right"></div><div class="maplibregl-ctrl-bottom-left"></div><div class="maplibregl-ctrl-bottom-right"></div>';
    container.append(this.canvas, chrome);
  }
  setPadding(padding: Padding): void {
    this.paddingCalls.push({ ...padding });
    this.fire('moveend');
  }
  unproject(point: readonly [number, number]): { lng: number; lat: number } {
    return { lng: point[0] / 10, lat: -point[1] / 10 };
  }
  getBounds() {
    const container = this.options['container'] as HTMLElement;
    return { getWest: () => 0, getSouth: () => -container.clientHeight / 10,
      getEast: () => container.clientWidth / 10, getNorth: () => 0 };
  }
  override fitBounds(_bounds?: unknown, options: Record<string, unknown> = {}): void {
    this.fits++; this.fitOptions.push(options);
  }
  override resize(): void { this.resizeCalls++; }
}
const originalContext = HTMLCanvasElement.prototype.getContext;
const originalObserver = Object.getOwnPropertyDescriptor(window, 'IntersectionObserver');

function query(root: ParentNode, selector: string): HTMLElement {
  const found = root.querySelector<HTMLElement>(selector);
  if (!found) throw new Error(`Missing fixture ${selector}`);
  return found;
}
function rect(element: Element): number[] {
  const box = element.getBoundingClientRect();
  return [box.left, box.top, box.width, box.height];
}
function sameRect(actual: readonly number[], expected: readonly number[]): boolean {
  return actual.every((value, index) => Math.abs(value - expected[index]!) < 0.8);
}
function assertRect(actual: readonly number[], expected: readonly number[]): void {
  actual.forEach((value, index) => expect(value, `rectangle coordinate ${index}`).to.be.closeTo(expected[index]!, 0.8));
}
async function frames(count = 3): Promise<void> {
  for (let index = 0; index < count; index++) await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
}
async function mount(engine: 'modular' | 'maplibre', target: 'ancestor' | 'viewport' | 'unset' = 'ancestor') {
  const stage = await fixture<HTMLElement>(html`<section style="position:relative;width:600px;height:400px"></section>`);
  const element = document.createElement('lr-map') as ExtentMap;
  element.style.cssText = 'position:absolute;left:90px;top:50px;width:480px;height:330px';
  element.engine = engine; element.initialization = 'eager'; element.mapStyle = LYRA_MAP_EMPTY_STYLE;
  element.controls = { navigation: false, attribution: false };
  element.center = [6, 49]; element.zoom = 5;
  if (target !== 'unset') element.canvasTarget = target === 'ancestor' ? stage : 'viewport';
  const legend = document.createElement('span'); legend.slot = 'legend'; legend.textContent = 'Map key'; element.append(legend);
  (element as unknown as { loadLibrary: () => Promise<unknown> }).loadLibrary = async () => ({ Map: ExtentEngine });
  stage.append(element);
  await waitUntil(() => element.map !== undefined, 'scripted map initializes');
  await element.updateComplete;
  await frames();
  return { stage, element, engine: element.map as unknown as ExtentEngine,
    container: query(element.shadowRoot!, '[part="container"]') };
}

// The engine seam supplies deterministic geographic projection; allocation assertions use real
// browser layout, including transformed ancestors. Separate native-engine tests prove peer fits.
describe('lr-map canvas target allocation', () => {
  beforeEach(() => {
    ExtentEngine.initialReady = true;
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

  for (const choice of ['modular', 'maplibre'] as const) {
    it(`${choice}: leaves the existing host allocation and camera unchanged when unset`, async () => {
      const { element, engine, container } = await mount(choice, 'unset');
      assertRect(rect(container), rect(element));
      expect(engine.paddingCalls).to.deep.equal([]);
      expect(engine.center).to.deep.equal({ lng: 6, lat: 49 });
      expect(engine.zoom).to.equal(5);
      expect(element.getVisibleBounds()).to.deep.equal([[0, -33], [48, 0]]);
    });

    it(`${choice}: fills an ancestor while controls, legend and geographic bounds use the host`, async () => {
      const { stage, element, engine, container } = await mount(choice);
      assertRect(rect(container), rect(stage));
      expect(engine.paddingCalls.at(-1)).to.deep.equal({ top: 50, right: 30, bottom: 20, left: 90 });
      assertRect(rect(query(element.shadowRoot!, '.maplibregl-control-container')), rect(element));
      const legend = query(element.shadowRoot!, '[part="legend"]').getBoundingClientRect();
      const host = element.getBoundingClientRect();
      expect(legend.left >= host.left && legend.right <= host.right && legend.top >= host.top && legend.bottom <= host.bottom).to.equal(true);
      expect(element.getVisibleBounds()).to.deep.equal([[9, -38], [57, -5]]);
      expect(element.getVisibleBounds({ padded: false })).to.deep.equal([[0, -40], [60, 0]]);
      expect(engine.center).to.deep.equal({ lng: 6, lat: 49 });
      expect(engine.zoom).to.equal(5);
    });

    it(`${choice}: adds authored and fit padding inside the host instead of exposing covered canvas`, async () => {
      const { element, engine } = await mount(choice);
      element.cameraPadding = { top: 7, right: 11, bottom: 13, left: 17 };
      await element.updateComplete; await frames();
      expect(engine.paddingCalls.at(-1)).to.deep.equal({ top: 57, right: 41, bottom: 33, left: 107 });
      const bounds = element.getVisibleBounds();
      expect(bounds === null).to.equal(false);
      const expected = [10.7, -36.7, 55.9, -5.7];
      bounds!.flat().forEach((value, index) => expect(value).to.be.closeTo(expected[index]!, 1e-9));
      expect(element.fitBounds([[0, 0], [1, 1]], { padding: 4, animate: false })).to.equal(true);
      // Native fits add their own padding to the map's persistent padding.
      expect(engine.fitOptions.at(-1)?.['padding']).to.deep.equal({ top: 4, right: 4, bottom: 4, left: 4 });
      expect(engine.paddingCalls.at(-1)).to.deep.equal({ top: 57, right: 41, bottom: 33, left: 107 });
    });

    it(`${choice}: follows host position and target size without reporting a camera command`, async () => {
      const { stage, element, engine, container } = await mount(choice);
      let changes = 0; element.addEventListener('lr-map-view-change', () => { changes++; });
      stage.style.width = '640px'; element.style.left = '110px';
      await waitUntil(() => sameRect(rect(container), rect(stage)) && engine.paddingCalls.at(-1)?.left === 110,
        'target allocation and host inset update');
      expect(engine.paddingCalls.at(-1)).to.deep.equal({ top: 50, right: 50, bottom: 20, left: 110 });
      expect(changes).to.equal(0);
      expect(engine.center).to.deep.equal({ lng: 6, lat: 49 });
      const writes = [engine.paddingCalls.length, engine.resizeCalls];
      await frames(5);
      expect([engine.paddingCalls.length, engine.resizeCalls]).to.deep.equal(writes);
    });

    it(`${choice}: fills the viewport beneath a translated and scaled query container`, async () => {
      const { stage, element, container } = await mount(choice, 'viewport');
      stage.style.transformOrigin = 'top left';
      stage.style.transform = 'translate(23px, 17px) scale(0.8)';
      stage.style.containerType = 'inline-size';
      const viewport = () => {
        const visual = window.visualViewport;
        return [visual?.offsetLeft ?? 0, visual?.offsetTop ?? 0,
          visual?.width ?? document.documentElement.clientWidth, visual?.height ?? document.documentElement.clientHeight];
      };
      await waitUntil(() => sameRect(rect(container), viewport()), 'canvas escapes the fixed containing-block allocation');
      assertRect(rect(query(element.shadowRoot!, '.maplibregl-control-container')), rect(element));
      stage.style.transform = 'translate(39px, 31px) scale(0.8)';
      await waitUntil(() => sameRect(rect(container), viewport()), 'position-only transform change is followed');
    });

    it(`${choice}: accepts neutral-Z translation but refuses real off-plane transforms`, async () => {
      const { stage, element, container } = await mount(choice, 'viewport');
      const viewport = () => [window.visualViewport?.offsetLeft ?? 0, window.visualViewport?.offsetTop ?? 0,
        window.visualViewport?.width ?? document.documentElement.clientWidth,
        window.visualViewport?.height ?? document.documentElement.clientHeight];
      stage.style.transformOrigin = 'top left';
      for (const transform of ['translateZ(0)', 'translate3d(23px, 17px, 0)',
        'matrix3d(1,0,0,0, 0,1,0,0, 0,0,1,0, 31,19,0,1)']) {
        stage.style.transform = transform; await frames();
        await waitUntil(() => sameRect(rect(container), viewport()), `viewport allocation under ${transform}`);
        assertRect(rect(query(element.shadowRoot!, '.maplibregl-control-container')), rect(element));
      }
      for (const transform of ['perspective(700px)', 'rotateY(10deg)']) {
        stage.style.transform = transform; await frames();
        await waitUntil(() => sameRect(rect(container), rect(element)), `host fallback under ${transform}`);
      }
    });

    it(`${choice}: changes target and clears it without leaving stale allocation or padding`, async () => {
      const { stage, element, engine, container } = await mount(choice);
      assertRect(rect(container), rect(stage));
      element.canvasTarget = 'viewport'; await element.updateComplete;
      await waitUntil(() => Math.abs(container.getBoundingClientRect().width - (window.visualViewport?.width ?? document.documentElement.clientWidth)) < 0.8);
      element.canvasTarget = undefined; await element.updateComplete;
      await waitUntil(() => sameRect(rect(container), rect(element)));
      expect(engine.paddingCalls.at(-1)).to.deep.equal({ top: 0, right: 0, bottom: 0, left: 0 });
      element.canvasTarget = stage; await element.updateComplete;
      await waitUntil(() => sameRect(rect(container), rect(stage)));
    });

    it(`${choice}: falls back for an unrelated target and an unsupported rotation`, async () => {
      const { stage, element, engine, container } = await mount(choice);
      assertRect(rect(container), rect(stage));
      element.canvasTarget = document.createElement('div'); await element.updateComplete;
      await waitUntil(() => sameRect(rect(container), rect(element)));
      expect(engine.paddingCalls.at(-1)).to.deep.equal({ top: 0, right: 0, bottom: 0, left: 0 });
      element.canvasTarget = stage; stage.style.transform = 'rotate(8deg)'; await element.updateComplete;
      await frames(); assertRect(rect(container), rect(element));
    });

    it(`${choice}: falls back when scrolling leaves the host partly or wholly outside the target`, async () => {
      const { stage, element, engine, container } = await mount(choice);
      assertRect(rect(container), rect(stage));
      stage.style.overflow = 'auto';
      const spacer = document.createElement('div'); spacer.style.cssText = 'width:900px;height:800px'; stage.append(spacer);
      stage.scrollLeft = 150;
      await waitUntil(() => sameRect(rect(container), rect(element)), 'partial host containment restores its allocation');
      expect(engine.paddingCalls.at(-1)).to.deep.equal({ top: 0, right: 0, bottom: 0, left: 0 });
      stage.scrollTop = 400; await frames();
      assertRect(rect(container), rect(element));
      stage.scrollLeft = 0; stage.scrollTop = 0;
      await waitUntil(() => sameRect(rect(container), rect(stage)), 'valid containment recovers automatically');
    });

    it(`${choice}: refuses collapsed host padding without losing explicit full-canvas bounds`, async () => {
      const { element, engine, container } = await mount(choice);
      expect(engine.paddingCalls.at(-1)?.left).to.equal(90);
      element.cameraPadding = { left: 300, right: 300 };
      await element.updateComplete; await frames();
      expect(element.getVisibleBounds()).to.equal(null);
      expect(element.getVisibleBounds({ padded: false })).to.deep.equal([[0, -40], [60, 0]]);
      const before = engine.fits;
      expect(element.fitBounds([[0, 0], [1, 1]], { animate: false })).to.equal(false);
      expect(engine.fits).to.equal(before);
      for (const padding of engine.paddingCalls) {
        expect(padding.left + padding.right < container.clientWidth).to.equal(true);
        expect(padding.top + padding.bottom < container.clientHeight).to.equal(true);
      }
      element.cameraPadding = undefined; await element.updateComplete; await frames();
      expect(element.getVisibleBounds()).to.deep.equal([[9, -38], [57, -5]]);
      expect(element.fitBounds([[0, 0], [1, 1]], { padding: 300, animate: false })).to.equal(false);
      expect(engine.fits).to.equal(before);
      expect(element.fitBounds([[0, 0], [1, 1]], { padding: 4, animate: false })).to.equal(true);
    });

    it(`${choice}: retires geometry work on disconnect and restores it on reconnect`, async () => {
      const { stage, element, engine, container } = await mount(choice);
      assertRect(rect(container), rect(stage));
      element.remove();
      const retired = [engine.paddingCalls.length, engine.resizeCalls];
      stage.style.width = '660px'; element.style.left = '120px';
      await frames(5);
      expect(engine.removed).to.equal(true);
      expect([engine.paddingCalls.length, engine.resizeCalls]).to.deep.equal(retired);
      stage.append(element);
      await waitUntil(() => element.map !== undefined && element.map !== (engine as unknown));
      await waitUntil(() => sameRect(rect(query(element.shadowRoot!, '[part="container"]')), rect(stage)));
      const replacement = element.map as unknown as ExtentEngine;
      expect(replacement.paddingCalls.at(-1)?.left).to.equal(120);
    });
  }
});
