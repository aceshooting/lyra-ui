import { expect, fixture, fixtureCleanup, html, waitUntil } from '@open-wc/testing';
import { ControlMapEngine } from '../../../../test/map-control-engine.js';
import '../../lr-map.js';
import '../../lr-map-anchor.js';
import { LYRA_MAP_EMPTY_STYLE, type LyraMap } from '../../lr-map.js';
import { MapAnchorAvoidance, mergeSafeAreas } from './map-anchor-avoid.js';

const originalContext = HTMLCanvasElement.prototype.getContext;
const originalObserver = Object.getOwnPropertyDescriptor(window, 'IntersectionObserver');

async function mount(direction: 'ltr' | 'rtl' = 'ltr') {
  const wrapper = await fixture<HTMLDivElement>(html`<div style="position:relative;width:480px;height:320px"></div>`);
  const header = document.createElement('div');
  header.style.cssText = 'position:absolute;inset-block-start:0;inset-inline:0;block-size:80px;z-index:5';
  const map = document.createElement('lr-map') as LyraMap;
  map.engine = 'maplibre'; map.mapStyle = LYRA_MAP_EMPTY_STYLE; map.controls = { attribution: false }; map.dir = direction;
  map.style.cssText = 'width:480px;height:320px';
  (map as unknown as { loadLibrary: () => Promise<unknown> }).loadLibrary = async () => ({ Map: ControlMapEngine });
  wrapper.append(map, header);
  await waitUntil(() => map.map !== undefined); await map.updateComplete;
  const peer = map.map as unknown as ControlMapEngine;
  peer.ready = true; peer.projected = { x: 240, y: 40 }; peer.fire('load'); await map.whenStyleReady();
  const content = document.createElement('div');
  content.slot = 'anchor'; content.textContent = 'Place details'; content.style.cssText = 'width:120px;height:60px';
  map.append(content); map.anchorLngLat = [0, 0];
  return { map, header, wrapper, peer };
}
const panel = (map: LyraMap): HTMLElement => map.shadowRoot!.querySelector<HTMLElement>('[part="anchor"]')!;
const placed = (map: LyraMap) => waitUntil(() => !panel(map).hidden && panel(map).style.left !== '' && getComputedStyle(panel(map)).visibility !== 'hidden', 'anchor placed', { timeout: 4000 });
const top = (map: LyraMap): number => panel(map).getBoundingClientRect().top - map.getBoundingClientRect().top;

describe('lr-map anchorAvoid', () => {
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

  for (const direction of ['ltr', 'rtl'] as const) {
    it(`keeps the slot anchor below an observed header and follows its resizes in ${direction}`, async () => {
      const { map, header } = await mount(direction);
      await placed(map);
      const free = top(map);
      expect(free < 80, 'unobstructed placement overlaps the header area').to.equal(true);
      map.anchorAvoid = [header];
      await waitUntil(() => top(map) >= 80, 'the anchor clears the header');
      header.style.blockSize = '120px';
      await waitUntil(() => top(map) >= 120, 'a header resize re-places the anchor');
      map.anchorSafeArea = { blockStart: 150 };
      await waitUntil(() => top(map) >= 150, 'the larger authored edge wins');
      map.anchorSafeArea = undefined; map.anchorAvoid = [];
      await waitUntil(() => Math.abs(top(map) - free) < 1, 'removing the obstacle restores placement');
    });
  }

  it('applies the avoided area to child anchors without their own safe area and stops observing on disconnect', async () => {
    const { map, header, wrapper } = await mount();
    map.anchorLngLat = null;
    const child = document.createElement('lr-map-anchor') as HTMLElement & { lngLat: readonly [number, number]; open: boolean };
    child.textContent = 'Child'; child.lngLat = [0, 0]; child.open = true; map.append(child);
    const base = (): HTMLElement | null => child.shadowRoot?.querySelector<HTMLElement>('[part~="base"]') ?? null;
    await waitUntil(() => base() !== null && !base()!.hidden && base()!.style.left !== '', 'child placed', { timeout: 4000 });
    map.anchorAvoid = [header];
    await waitUntil(() => base()!.getBoundingClientRect().top - map.getBoundingClientRect().top >= 80, 'the child clears the header');
    const avoidance = (map as unknown as { anchorAvoidance: { observer?: ResizeObserver; area?: unknown } }).anchorAvoidance;
    expect(avoidance.observer === undefined).to.equal(false);
    map.remove(); await new Promise(resolve => setTimeout(resolve, 0));
    expect(avoidance.observer === undefined, 'disconnect releases the observers').to.equal(true);
    map.anchorAvoid = [header]; await map.updateComplete;
    expect(avoidance.observer === undefined, 'a detached map does not observe').to.equal(true);
    wrapper.append(map); await map.updateComplete;
    expect(avoidance.observer === undefined, 'a reconnect observes again').to.equal(false);
    header.remove(); map.dir = 'rtl'; await map.updateComplete;
    await waitUntil(() => avoidance.area === undefined, 'a removed obstacle no longer reserves space');
  });
});

describe('MapAnchorAvoidance', () => {
  it('ignores non-array input, non-overlapping obstacles and work scheduled after disconnect', async () => {
    const element = await fixture<HTMLDivElement>(html`<div style="position:relative;width:200px;height:100px"></div>`);
    const away = document.createElement('div'); away.style.cssText = 'position:fixed;left:-500px;top:-500px;width:50px;height:50px';
    document.body.append(away);
    try {
      let changes = 0;
      const avoidance = new MapAnchorAvoidance({ element, direction: () => 'ltr', changed: () => { changes++; } });
      avoidance.observe(away as unknown as readonly Element[]);
      avoidance.observe([away]);
      expect([avoidance.area, changes]).to.deep.equal([undefined, 0]);
      avoidance.disconnect();
      (avoidance as unknown as { schedule(): void }).schedule();
      expect((avoidance as unknown as { frame?: unknown }).frame === undefined).to.equal(true);
      expect(mergeSafeAreas(null as never, { blockStart: 2 })).to.equal(null);
    } finally { away.remove(); }
  });
});
