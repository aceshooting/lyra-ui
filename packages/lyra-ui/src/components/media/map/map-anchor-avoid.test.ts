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

  it('keeps the anchor-avoid-gap beyond each reserved edge only', async () => {
    const { map } = await mount();
    map.anchorAvoid = [];
    await placed(map);
    map.setAttribute('anchor-avoid-gap', '24');
    await map.updateComplete;
    expect(map.anchorAvoidGap).to.equal(24);
    map.anchorAvoid = [document.querySelector<HTMLElement>('lr-map + div')!];
    await waitUntil(() => top(map) >= 80 + 24, 'the anchor keeps the gap below the header');
    const area = (map as unknown as { anchorAvoidance: { area?: Record<string, number> } }).anchorAvoidance.area;
    expect(area, 'free edges stay zero').to.deep.equal({ blockStart: 104, blockEnd: 0, inlineStart: 0, inlineEnd: 0 });
    map.anchorAvoidGap = 0;
    await waitUntil(() => (map as unknown as { anchorAvoidance: { area?: Record<string, number> } }).anchorAvoidance.area?.['blockStart'] === 80, 'a gap change re-measures');
    map.anchorAvoidGap = -5;
    await map.updateComplete; await new Promise(resolve => requestAnimationFrame(resolve));
    expect((map as unknown as { anchorAvoidance: { area?: Record<string, number> } }).anchorAvoidance.area?.['blockStart'], 'a negative gap is none').to.equal(80);
  });

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

type AvoidArea = Record<'blockStart' | 'blockEnd' | 'inlineStart' | 'inlineEnd', number> | undefined;
const avoidArea = (map: LyraMap): AvoidArea => (map as unknown as { anchorAvoidance?: { area?: AvoidArea } }).anchorAvoidance?.area;
const frame = (): Promise<void> => new Promise(resolve => requestAnimationFrame(() => { resolve(); }));

/** A 320x600 viewport whose map starts at y=56, under a floating search bar with its results open
 * (y 64-436, x 68-304): its cheapest edge is the inline side, not the top. */
async function mountSearch(direction: 'ltr' | 'rtl' = 'ltr') {
  const wrapper = await fixture<HTMLDivElement>(html`<div style="position:relative;width:320px;height:600px"></div>`);
  const bar = document.createElement('div');
  bar.style.cssText = 'position:absolute;top:64px;left:68px;width:236px;height:372px;z-index:5';
  const map = document.createElement('lr-map') as LyraMap;
  map.engine = 'maplibre'; map.mapStyle = LYRA_MAP_EMPTY_STYLE; map.controls = { attribution: false }; map.dir = direction;
  map.style.cssText = 'position:absolute;top:56px;left:0;width:320px;height:544px';
  (map as unknown as { loadLibrary: () => Promise<unknown> }).loadLibrary = async () => ({ Map: ControlMapEngine });
  wrapper.append(map, bar);
  await waitUntil(() => map.map !== undefined); await map.updateComplete;
  const peer = map.map as unknown as ControlMapEngine;
  peer.ready = true; peer.projected = { x: 160, y: 100 }; peer.fire('load'); await map.whenStyleReady();
  const content = document.createElement('div');
  content.slot = 'anchor'; content.textContent = 'Place details'; content.style.cssText = 'width:120px;height:60px';
  map.append(content); map.anchorLngLat = [0, 0];
  return { map, bar };
}

describe('lr-map anchorAvoid sides and hidden obstacles', () => {
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
    it(`places the anchor below a tall search bar given side block-end instead of squeezing it beside the bar in ${direction}`, async () => {
      const { map, bar } = await mountSearch(direction);
      map.anchorAvoid = [bar];
      await waitUntil(() => avoidArea(map) !== undefined, 'the bar is reserved');
      const inline = direction === 'rtl' ? 'inlineStart' : 'inlineEnd';
      expect(avoidArea(map), 'auto keeps the cheapest edge').to.deep.equal({ blockStart: 0, blockEnd: 0, inlineStart: 0, inlineEnd: 0, [inline]: 252 });
      map.anchorAvoid = [{ element: bar, side: 'block-end' }];
      await waitUntil(() => avoidArea(map)?.blockStart === 380, 'block-end reserves down to the bar bottom');
      expect(avoidArea(map)).to.deep.equal({ blockStart: 380, blockEnd: 0, inlineStart: 0, inlineEnd: 0 });
      await placed(map);
      await waitUntil(() => top(map) >= 380, 'the anchor sits below the bar');
      expect(panel(map).getBoundingClientRect().width >= 120, 'the panel keeps its width').to.equal(true);
      map.anchorAvoid = [{ element: bar, side: 'auto' }];
      await waitUntil(() => avoidArea(map)?.[inline] === 252, 'auto restores the cheapest edge');
    });
  }

  for (const [direction, side, expected] of [
    ['ltr', 'inline-start', { inlineEnd: 252 }], ['ltr', 'inline-end', { inlineStart: 304 }],
    ['rtl', 'inline-start', { inlineEnd: 304 }], ['rtl', 'inline-end', { inlineStart: 252 }],
    ['rtl', 'block-start', { blockEnd: 536 }],
  ] as const) {
    it(`reserves the logical ${side} side in ${direction}`, async () => {
      const { map, bar } = await mountSearch(direction);
      map.anchorAvoid = [{ element: bar, side }];
      await waitUntil(() => avoidArea(map) !== undefined, 'reserved');
      expect(avoidArea(map)).to.deep.equal({ blockStart: 0, blockEnd: 0, inlineStart: 0, inlineEnd: 0, ...expected });
    });
  }

  it('follows a direction change for a logical side and falls back to auto for an unknown side', async () => {
    const { map, bar } = await mountSearch('ltr');
    map.anchorAvoid = [{ element: bar, side: 'inline-start' }];
    await waitUntil(() => avoidArea(map)?.inlineEnd === 252, 'ltr inline-start');
    map.dir = 'rtl';
    await waitUntil(() => avoidArea(map)?.inlineEnd === 304, 'rtl inline-start is the other physical side');
    map.anchorAvoid = [{ element: bar, side: 'sideways' as never }, { element: 'nope' as never }, null as never];
    await waitUntil(() => avoidArea(map)?.inlineStart === 252 && avoidArea(map)?.inlineEnd === 0, 'unknown side is auto; invalid entries are ignored');
  });

  it('ignores obstacles that are not rendered and re-measures when one is shown again', async () => {
    const { map, bar } = await mountSearch();
    map.anchorAvoid = [{ element: bar, side: 'block-end' }];
    await waitUntil(() => avoidArea(map)?.blockStart === 380, 'reserved');
    bar.style.visibility = 'hidden';
    await waitUntil(() => avoidArea(map) === undefined, 'a visibility:hidden obstacle is ignored');
    bar.style.visibility = '';
    await waitUntil(() => avoidArea(map)?.blockStart === 380, 'showing it again reserves it');
    bar.style.display = 'none';
    await waitUntil(() => avoidArea(map) === undefined, 'a display:none obstacle is ignored');
    bar.style.display = '';
    await waitUntil(() => avoidArea(map)?.blockStart === 380, 'displayed again');
    bar.style.height = '0px';
    await waitUntil(() => avoidArea(map) === undefined, 'a zero-size obstacle is ignored');
    bar.style.height = '372px';
    await waitUntil(() => avoidArea(map)?.blockStart === 380, 'sized again');
    const parent = bar.parentElement!;
    parent.style.visibility = 'hidden';
    map.style.visibility = 'visible';
    (map as unknown as { anchorAvoidance: { refresh(): void } }).anchorAvoidance.refresh();
    await frame(); await frame();
    expect(avoidArea(map), 'an inherited visibility:hidden is ignored').to.equal(undefined);
    parent.style.visibility = '';
    bar.remove();
    (map as unknown as { anchorAvoidance: { refresh(): void } }).anchorAvoidance.refresh();
    await frame(); await frame();
    expect(avoidArea(map), 'a detached obstacle is ignored').to.equal(undefined);
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
