import { expect, fixture, fixtureCleanup, html, waitUntil } from '@open-wc/testing';
import { ControlMapEngine } from '../../../../test/map-control-engine.js';
import { installCameraPeerEnvironment } from '../../../../test/map-camera-peer.js';
import { twoFrames } from '../../../../test/frames.js';
import { LyraMap, LYRA_MAP_EMPTY_STYLE } from '../../lr-map.js';
void LyraMap;

class AllocationEngine extends ControlMapEngine {
  afterResize?: () => void;
  afterPadding?: () => void;
  reads = 0;
  constructor(options: Record<string, unknown>) {
    super(options);
    this.canvas.style.cssText = 'width:100%;height:100%';
    (options['container'] as HTMLElement).append(this.canvas);
  }
  override resize(): void { this.afterResize?.(); }
  setPadding(): void { this.afterPadding?.(); }
  unproject(point: readonly [number, number]) { this.reads++; return { lng: point[0] / 10, lat: -point[1] / 10 }; }
  getBounds() { this.reads++; return { getWest: () => 0, getSouth: () => -40, getEast: () => 60, getNorth: () => 0 }; }
}
async function mount() {
  const stage = await fixture<HTMLElement>(html`<section style="position:relative;width:600px;height:400px"></section>`);
  const element = document.createElement('lr-map') as LyraMap;
  element.style.cssText = 'position:absolute;left:90px;top:50px;width:480px;height:330px';
  element.engine = 'maplibre'; element.initialization = 'eager'; element.mapStyle = LYRA_MAP_EMPTY_STYLE;
  element.canvasTarget = stage; element.controls = { navigation: false, attribution: false };
  (element as unknown as { loadLibrary: () => Promise<unknown> }).loadLibrary = async () => ({ Map: AllocationEngine });
  stage.append(element); await waitUntil(() => element.map !== undefined);
  await element.updateComplete; await twoFrames();
  return { stage, element, engine: element.map as unknown as AllocationEngine };
}
function container(element: LyraMap): HTMLElement {
  const value = element.shadowRoot?.querySelector<HTMLElement>('[part="container"]');
  if (!value) throw new Error('Map container missing');
  return value;
}
function closeRect(a: Element, b: Element): boolean {
  const first = a.getBoundingClientRect(), second = b.getBoundingClientRect();
  return [first.left - second.left, first.top - second.top, first.width - second.width, first.height - second.height].every(value => Math.abs(value) < 0.15);
}

describe('canvas allocation geometry boundaries', () => {
  let restore: () => void;
  beforeEach(() => { restore = installCameraPeerEnvironment(); AllocationEngine.initialReady = true; });
  afterEach(() => { fixtureCleanup(); restore(); });

  for (const callback of ['afterResize', 'afterPadding'] as const) {
    for (const operation of ['fit', 'bounds'] as const) {
      it(`refuses a ${operation} on an engine retired by allocation ${callback}`, async () => {
        const { stage, element, engine } = await mount();
        engine[callback] = () => { engine[callback] = undefined; element.remove(); };
        element.style.left = '100px';
        const reads = engine.reads, fits = engine.fits;
        if (operation === 'fit') expect(element.fitBounds([[0, 0], [1, 1]], { animate: false })).to.equal(false);
        else expect(element.getVisibleBounds()).to.equal(null);
        expect(engine.fits).to.equal(fits); expect(engine.reads).to.equal(reads);
        // The disconnect releases the engine a microtask later; a same-task re-insertion would keep it.
        await Promise.resolve();
        expect(engine.removed).to.equal(true);
        stage.append(element);
        await waitUntil(() => element.map !== undefined && element.map !== (engine as unknown));
        await twoFrames(); expect(closeRect(container(element), stage)).to.equal(true);
      });
    }
  }

  it('uses unrounded local allocation for a fractional host beneath a large target', async () => {
    const { stage, element } = await mount();
    stage.style.width = '1000px'; stage.style.height = '600px';
    element.style.width = '48.5px'; element.style.height = '32.5px';
    await waitUntil(() => closeRect(container(element), stage), 'fractional host must not introduce false scaling');
    stage.style.transformOrigin = 'top left'; stage.style.transform = 'scale(0.75, 1.25)';
    await waitUntil(() => closeRect(container(element), stage), 'fractional dimensions retain actual positive scale');
  });

  it('positions against the base padding box when the public base part has borders', async () => {
    const { stage, element } = await mount();
    const base = element.shadowRoot!.querySelector<HTMLElement>('[part="base"]')!;
    base.style.border = '3px solid transparent'; base.style.boxSizing = 'border-box';
    await waitUntil(() => closeRect(container(element), stage), 'base border must not offset or enlarge the canvas');
    element.style.width = '48.5px'; element.style.height = '32.5px';
    await waitUntil(() => closeRect(container(element), stage), 'bordered fractional host keeps the target rectangle');
  });
});
