import { expect, fixture, fixtureCleanup, html, nextFrame, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import { setReducedMotion } from '../../../../test/wtr-media.js';
import { deepActiveElementIn } from '../../../internal/active-element.js';
import { activateOverlay } from '../../../internal/overlay-manager.js';
import { __setAnchoredOverlayRuntimeLoaderForTesting } from '../../../internal/anchored-overlay-runtime.js';
import type { AnchoredSurfaceOptions, PlacementResult } from '../../../internal/positioner.js';
import './map.js';
import { LYRA_MAP_EMPTY_STYLE, type LyraMap } from './map.js';

import { ControlMapEngine as ControlMap, FakeGeolocateControl as Geolocate, FakeAttributionControl as Attribution } from '../../../../test/map-control-engine.js';

const originalObserver = window.IntersectionObserver;
const originalContext = HTMLCanvasElement.prototype.getContext;
let originalUrl: string;
let originalState: unknown;
async function mount(configure: (element: LyraMap) => void = () => undefined) {
  const wrapper = await fixture<HTMLDivElement>(html`<div></div>`);
  const element = document.createElement('lr-map') as LyraMap;
  element.engine = 'maplibre'; element.mapStyle = LYRA_MAP_EMPTY_STYLE; element.style.inlineSize = '480px'; element.style.blockSize = '320px';
  (element as unknown as { loadLibrary: () => Promise<unknown> }).loadLibrary = async () => ({ Map: ControlMap, GeolocateControl: Geolocate, AttributionControl: Attribution });
  configure(element); wrapper.append(element);
  await waitUntil(() => element.map !== undefined); await element.updateComplete;
  const peer = element.map as unknown as ControlMap;
  peer.fire('load'); await element.updateComplete; await element.whenStyleReady();
  return { element, peer, wrapper };
}

function anchor(element: LyraMap): HTMLElement { const panel = element.shadowRoot!.querySelector<HTMLElement>('[part="anchor"]'); if (!panel) throw new Error('Expected anchor surface'); return panel; }
function content(): HTMLElement { const section = document.createElement('section'); section.slot = 'anchor'; const button = document.createElement('button'); button.textContent = 'Anchor action'; section.append(button); return section; }
function capture(element: LyraMap): unknown[] { const values: unknown[] = []; element.addEventListener('lr-map-anchor-close', event => { values.push((event as CustomEvent).detail); }); return values; }
async function placed(element: LyraMap): Promise<void> {
  await element.updateComplete;
  // The positioner loads asynchronously; parallel browser suites can delay that import beyond
  // waitUntil's 1-second default even though the real placement completes successfully.
  await waitUntil(() => { const panel = anchor(element); return !panel.hidden && panel.style.left !== '' && getComputedStyle(panel).visibility !== 'hidden'; }, 'anchor did not finish real placement', { timeout: 4000 });
}
async function open(configure?: (element: LyraMap) => void) {
  const slot = content(); const result = await mount(element => { element.append(slot); element.anchorLngLat = [0, 0]; configure?.(element); });
  await placed(result.element); return { ...result, slot };
}

describe('lr-map anchor placement and close ownership', () => {
  beforeEach(() => {
    originalUrl = location.href; originalState = history.state; ControlMap.initialReady = true; ControlMap.prepare = undefined;
    __setAnchoredOverlayRuntimeLoaderForTesting(undefined);
    Object.defineProperty(window, 'IntersectionObserver', { configurable: true, value: undefined });
    Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', { configurable: true, writable: true,
      value(this: HTMLCanvasElement, id: string, ...rest: unknown[]) { return id === 'webgl2' ? {} : originalContext.call(this, id as never, ...(rest as [])); } });
  });
  afterEach(() => {
    fixtureCleanup(); __setAnchoredOverlayRuntimeLoaderForTesting(undefined); history.replaceState(originalState, '', originalUrl);
    Object.defineProperty(window, 'IntersectionObserver', { configurable: true, value: originalObserver }); HTMLCanvasElement.prototype.getContext = originalContext;
  });

  it('keeps an unset anchor passive, hidden and unfocusable without a close event', async () => {
    const { element } = await mount(el => { el.append(content()); }); const closes = capture(element);
    expect(anchor(element).hidden).to.equal(true); expect(element.focusAnchor()).to.equal(false); expect(element.closeAnchor()).to.equal(false); expect(closes.length).to.equal(0);
    expect(element.shadowRoot!.querySelector('[part="anchor-close"]') === null).to.equal(true); expect(element.anchorClosable).to.equal(false);
  });
  it('does not treat a coordinate without assigned anchor content as visible or focusable', async () => {
    const { element } = await mount(el => { el.anchorLngLat = [0, 0]; el.anchorClosable = true; }); const closes = capture(element);
    expect(anchor(element).hidden).to.equal(true); expect(element.focusAnchor()).to.equal(false); expect(element.closeAnchor()).to.equal(false); expect(closes.length).to.equal(0);
  });
  it('opens declaratively without focus theft and leaves the default anchor passive on Escape', async () => {
    const outside = await fixture<HTMLButtonElement>(html`<button>Previous owner</button>`); await focusByKeyboard(outside);
    const { element, slot } = await open(); const closes = capture(element); expect(deepActiveElementIn(document) === outside).to.equal(true);
    await focusByKeyboard(slot.querySelector('button')!); await sendKeys({ press: 'Escape' }); expect(closes.length).to.equal(0); expect(element.anchorLngLat).to.deep.equal([0, 0]); expect(anchor(element).hidden).to.equal(false);
  });
  it('focuses existing usable content only after placement without changing caller descendants', async () => {
    const { element, slot } = await open(); const before = slot.outerHTML; expect(element.focusAnchor()).to.equal(true);
    expect(deepActiveElementIn(document) === slot.querySelector('button')).to.equal(true); expect(slot.outerHTML).to.equal(before); expect(slot.hasAttribute('tabindex')).to.equal(false);
  });
  it('returns false for empty/nonfocusable content, offscreen points and inert ancestors', async () => {
    const { element, peer, wrapper, slot } = await open(); slot.replaceChildren(document.createTextNode('Read only')); await element.updateComplete;
    expect(element.focusAnchor()).to.equal(false); slot.replaceWith(content()); await placed(element);
    peer.projected = { x: -50, y: 20 }; peer.fire('move'); await waitUntil(() => anchor(element).hidden); expect(element.focusAnchor()).to.equal(false);
    peer.projected = undefined; peer.fire('move'); await nextFrame(); await placed(element); wrapper.inert = true; expect(element.focusAnchor()).to.equal(false);
  });
  for (const priority of ['', ' !important']) {
    it(`keeps offscreen and closed anchors hidden under consumer display styling${priority}`, async () => {
      const { element, peer, wrapper } = await open(el => { el.anchorClosable = true; });
      element.classList.add('consumer-anchor');
      const style = document.createElement('style');
      style.textContent = `lr-map.consumer-anchor::part(anchor) { display: flex${priority}; }`;
      wrapper.append(style);
      const panel = anchor(element);
      expect(getComputedStyle(panel).display).to.equal('flex');
      expect(panel.getClientRects().length).to.be.greaterThan(0);

      peer.projected = { x: -50, y: 20 };
      peer.fire('move');
      await waitUntil(() => panel.hidden, 'offscreen anchor receives its hidden state');
      expect(getComputedStyle(panel).display).to.equal('none');
      expect(panel.getClientRects().length).to.equal(0);

      peer.projected = undefined;
      peer.fire('move');
      await placed(element);
      expect(getComputedStyle(panel).display).to.equal('flex');
      expect(panel.getClientRects().length).to.be.greaterThan(0);

      expect(element.closeAnchor()).to.equal(true);
      await element.updateComplete;
      expect(panel.hidden).to.equal(true);
      expect(getComputedStyle(panel).display).to.equal('none');
      expect(panel.getClientRects().length).to.equal(0);

      element.anchorLngLat = [0, 0];
      await placed(element);
      expect(getComputedStyle(panel).display).to.equal('flex');
      expect(panel.getClientRects().length).to.be.greaterThan(0);
    });
  }
  it('closes exactly once through the API with frozen reason and restores its previous focus owner', async () => {
    const outside = await fixture<HTMLButtonElement>(html`<button>Return here</button>`); await focusByKeyboard(outside);
    const { element } = await open(el => { el.anchorClosable = true; }); const closes = capture(element); expect(element.focusAnchor()).to.equal(true);
    expect(element.closeAnchor()).to.equal(true); expect(element.closeAnchor()).to.equal(false); await element.updateComplete;
    expect(closes).to.deep.equal([{ reason: 'api' }]); expect(Object.isFrozen(closes[0])).to.equal(true); expect(element.anchorLngLat).to.equal(null); expect(anchor(element).hidden).to.equal(true);
    expect(deepActiveElementIn(document) === outside).to.equal(true);
  });
  it('leaves a new outside focus owner in place when the anchor closes', async () => {
    const prior = await fixture<HTMLButtonElement>(html`<button>Original</button>`), next = await fixture<HTMLButtonElement>(html`<button>New owner</button>`); await focusByKeyboard(prior);
    const { element } = await open(el => { el.anchorClosable = true; }); element.focusAnchor(); await focusByKeyboard(next); expect(element.closeAnchor()).to.equal(true);
    expect(deepActiveElementIn(document) === next).to.equal(true);
  });
  it('does not reclaim focus from another placed anchor opened by a synchronous close callback', async () => {
    const outside = await fixture<HTMLButtonElement>(html`<button>Keyboard origin</button>`); await focusByKeyboard(outside);
    const first = await open(el => { el.anchorClosable = true; }), second = await open();
    await nextFrame(); await placed(second.element);
    expect(first.element.focusAnchor()).to.equal(true);
    first.element.addEventListener('lr-map-anchor-close', () => { expect(second.element.focusAnchor()).to.equal(true); }, { once: true });
    expect(first.element.closeAnchor()).to.equal(true); expect(deepActiveElementIn(document) === second.slot.querySelector('button')).to.equal(true);
  });
  it('preserves a callback reopen without stale close cleanup hiding the new request', async () => {
    const { element } = await open(el => { el.anchorClosable = true; }); const closes = capture(element);
    element.addEventListener('lr-map-anchor-close', () => { element.anchorLngLat = [1, 1]; }, { once: true }); expect(element.closeAnchor()).to.equal(true); await placed(element);
    expect(closes.length).to.equal(1); expect(element.anchorLngLat).to.deep.equal([1, 1]); expect(anchor(element).hidden).to.equal(false);
  });
  it('does not close a newer coordinate request authored during focus-repair capture', async () => {
    const outside = await fixture<HTMLButtonElement>(html`<button>Return target</button>`); await focusByKeyboard(outside);
    const { element } = await open(el => { el.anchorClosable = true; }); const closes = capture(element); expect(element.focusAnchor()).to.equal(true);
    const read = Object.getOwnPropertyDescriptor(Node.prototype, 'ownerDocument')!.get!; let changed = false;
    Object.defineProperty(outside, 'ownerDocument', { configurable: true, get() {
      if (!changed) { changed = true; element.anchorLngLat = [2, 2]; } return Reflect.apply(read, outside, []);
    } });
    try { expect(element.closeAnchor()).to.equal(false); expect(element.anchorLngLat).to.deep.equal([2, 2]); expect(closes.length).to.equal(0); }
    finally { delete (outside as unknown as Record<string, unknown>)['ownerDocument']; }
    await placed(element); expect(anchor(element).hidden).to.equal(false);
  });
  it('offers a localized native close button with a distinct exact-once reason', async () => {
    const { element } = await open(el => { el.anchorClosable = true; el.strings = { close: 'Close anchor details' }; }); const closes = capture(element);
    const button = element.shadowRoot!.querySelector<HTMLButtonElement>('[part="anchor-close"]')!;
    expect(button.getAttribute('aria-label') ?? button.textContent).to.equal('Close anchor details'); await focusByKeyboard(button); await sendKeys({ press: 'Enter' }); await element.updateComplete;
    expect(closes).to.deep.equal([{ reason: 'close-button' }]); expect(anchor(element).hidden).to.equal(true);
  });
  it('uses shared Escape ordering so a nested overlay closes before its anchor', async () => {
    const { element, peer, slot } = await open(el => { el.anchorClosable = true; }); const closes = capture(element);
    const panel = document.createElement('section'), button = document.createElement('button'); button.textContent = 'Nested overlay'; panel.append(button); slot.append(panel);
    let nestedClosed = false;
    const nested = activateOverlay({ host: panel, panel: () => panel, modal: false, trapFocus: false, lockScroll: false, beforeInitialFocus: () => false,
      onEscape: () => { nestedClosed = true; nested.deactivate({ restoreFocus: false }); } });
    try {
      await focusByKeyboard(button); peer.fire('move'); await nextFrame(); await placed(element);
      await sendKeys({ press: 'Escape' }); expect(nestedClosed).to.equal(true); expect(closes.length).to.equal(0); expect(anchor(element).hidden).to.equal(false);
      await focusByKeyboard(slot.querySelector('button')!); await sendKeys({ press: 'Escape' }); await element.updateComplete; expect(closes).to.deep.equal([{ reason: 'escape' }]);
    } finally { nested.deactivate({ restoreFocus: false }); panel.remove(); }
  });
  it('suspends Escape ownership while a previously placed anchor awaits deferred replacement', async () => {
    let hold = false, notify: ((result: PlacementResult) => void) | undefined;
    __setAnchoredOverlayRuntimeLoaderForTesting(async () => {
      // The real positioner loads on demand here too, as it does for components.
      const { placeAnchoredSurface, trackRect, releaseTopLayer } = await import('../../../internal/positioner.js');
      return {
        place: (reference, panel, options) => {
          if (!hold) return placeAnchoredSurface(reference, panel, options);
          notify = options?.onPlaced; return () => undefined;
        }, trackRect, releaseTopLayer,
      };
    });
    const outside = await fixture<HTMLButtonElement>(html`<button>Keyboard origin</button>`); await focusByKeyboard(outside);
    const { element } = await open(el => { el.anchorClosable = true; }); const closes = capture(element);
    hold = true; element.anchorSafeArea = { blockStart: 1 }; await element.updateComplete; await waitUntil(() => Boolean(notify));
    expect(element.focusAnchor()).to.equal(false); const prevented: boolean[] = [];
    const observe = (event: KeyboardEvent) => { if (event.key === 'Escape') prevented.push(event.defaultPrevented); };
    document.addEventListener('keydown', observe);
    try { await sendKeys({ press: 'Escape' }); expect(prevented).to.deep.equal([false]); expect(closes.length).to.equal(0); }
    finally { document.removeEventListener('keydown', observe); }
    element.anchorLngLat = null; await element.updateComplete; notify!({ placement: 'top' }); expect(anchor(element).hidden).to.equal(true);
  });
  it('suspends offscreen/empty anchors without emitting close and resumes without focus theft', async () => {
    const { element, peer, slot } = await open(el => { el.anchorClosable = true; }); const closes = capture(element);
    peer.projected = { x: 9999, y: 9999 }; peer.fire('move'); await waitUntil(() => anchor(element).hidden); expect(element.focusAnchor()).to.equal(false); expect(closes.length).to.equal(0);
    peer.projected = undefined; peer.fire('move'); await nextFrame(); await placed(element); slot.remove(); await waitUntil(() => anchor(element).hidden); expect(element.focusAnchor()).to.equal(false); expect(closes.length).to.equal(0);
    element.append(slot); await placed(element); expect(element.anchorLngLat).to.deep.equal([0, 0]);
  });
  it('refuses focus immediately for removed content and a newly offscreen native camera point', async () => {
    const { element, peer, slot } = await open(); slot.remove(); expect(element.focusAnchor()).to.equal(false);
    element.append(slot); await placed(element); peer.projected = { x: -50, y: 20 }; peer.fire('move');
    expect(element.focusAnchor()).to.equal(false); expect(element.closeAnchor()).to.equal(false);
  });
  it('fails closed for invalid/oversized safe areas and recovers after corrected options', async () => {
    const { element } = await open(); element.anchorSafeArea = { inlineStart: Number.MAX_VALUE }; await element.updateComplete; await waitUntil(() => anchor(element).hidden); expect(element.focusAnchor()).to.equal(false);
    element.anchorSafeArea = { blockStart: -1 }; await element.updateComplete; expect(anchor(element).hidden).to.equal(true);
    element.anchorSafeArea = {}; await placed(element); expect(anchor(element).hidden).to.equal(false);
  });
  for (const edge of ['blockStart', 'blockEnd'] as const) {
    it(`keeps the whole anchor and close action inside a growing ${edge} safe area`, async () => {
      const { element, peer, slot } = await open(el => { el.anchorClosable = true; el.style.blockSize = '544px'; });
      slot.style.blockSize = '48px';
      await placed(element);
      const map = element.getBoundingClientRect();
      const camera = { ...peer.center };
      element.anchorSafeArea = { [edge]: 396 };
      await element.updateComplete;
      // A completed style transaction is evidence that the new fence has been measured, even
      // when the previous placement was already visible and carried a resolved left coordinate.
      await waitUntil(() => parseFloat(getComputedStyle(anchor(element)).maxHeight) <= 132, 'anchor resized to the new safe area');
      await nextFrame();
      const panel = anchor(element).getBoundingClientRect();
      const close = element.shadowRoot!.querySelector<HTMLElement>('[part="anchor-close"]')!.getBoundingClientRect();
      const top = map.top + (edge === 'blockStart' ? 396 : 0) + 8;
      const bottom = map.bottom - (edge === 'blockEnd' ? 396 : 0) - 8;
      expect(anchor(element).hidden).to.equal(false);
      expect(panel.top).to.be.at.least(top - 1);
      expect(panel.bottom).to.be.at.most(bottom + 1);
      expect(close.top).to.be.at.least(top - 1);
      expect(close.bottom).to.be.at.most(bottom + 1);
      expect(peer.center).to.deep.equal(camera);
      expect(element.anchorLngLat).to.deep.equal([0, 0]);
      expect(element.closeAnchor()).to.equal(true);
    });
  }
  it('intersects dynamic connected custom boundaries with the real map allocation', async () => {
    const { element, peer, wrapper, slot } = await open(); slot.style.inlineSize = '400px'; const map = element.getBoundingClientRect();
    const boundary = document.createElement('div'); boundary.style.cssText = `position:fixed;left:${map.left + 80}px;top:${map.top + 20}px;width:240px;height:240px;pointer-events:none`;
    wrapper.append(boundary); element.anchorBoundary = boundary; await placed(element);
    const clip = boundary.getBoundingClientRect(), panel = anchor(element).getBoundingClientRect(); expect(panel.left).to.be.at.least(clip.left + 7); expect(panel.right).to.be.at.most(clip.right - 7);
    boundary.style.width = '180px'; peer.fire('resize'); await waitUntil(() => anchor(element).getBoundingClientRect().width <= 166);
    const tighter = anchor(element).getBoundingClientRect(); expect(tighter.right).to.be.at.most(boundary.getBoundingClientRect().right - 7);
  });
  it('fails closed for throwing boundary geometry and preserves newer intent from geometry reentry', async () => {
    const { element, wrapper } = await open(); const boundary = document.createElement('div'); wrapper.append(boundary);
    boundary.getBoundingClientRect = () => { throw new Error('Private boundary failure'); }; element.anchorBoundary = boundary;
    await element.updateComplete; await waitUntil(() => anchor(element).hidden); expect(element.focusAnchor()).to.equal(false); expect(element.shadowRoot!.textContent).not.to.include('Private boundary failure');
    let changed = false; const read = Element.prototype.getBoundingClientRect;
    boundary.getBoundingClientRect = () => { if (!changed) { changed = true; element.anchorLngLat = null; } return Reflect.apply(read, boundary, []); };
    element.anchorBoundary = [boundary]; await element.updateComplete; expect(element.anchorLngLat).to.equal(null); expect(anchor(element).hidden).to.equal(true);
  });
  it('maps logical safe areas under RTL at 320px and wraps long slotted content inside allocation', async () => {
    let placements = 0;
    __setAnchoredOverlayRuntimeLoaderForTesting(async () => {
      const runtime = await import('../../../internal/positioner.js');
      const observed = (options: AnchoredSurfaceOptions = {}): AnchoredSurfaceOptions => ({
        ...options, onPlaced: result => { placements++; options.onPlaced?.(result); },
      });
      return {
        place: (reference, panel, options) => runtime.placeAnchoredSurface(reference, panel, observed(options)),
        placeSession: (reference, panel, options) => runtime.placeAnchoredSurfaceSession(reference, panel, observed(options)),
        trackRect: runtime.trackRect, releaseTopLayer: runtime.releaseTopLayer,
      };
    });
    const { element, slot } = await open(el => { el.setAttribute('dir', 'rtl'); el.style.inlineSize = '320px'; el.anchorClosable = true; el.anchorSafeArea = { inlineStart: 70, inlineEnd: 20, blockStart: 15, blockEnd: 25 }; });
    const beforeGrowth = placements;
    slot.style.inlineSize = '600px'; slot.style.overflowWrap = 'anywhere'; slot.querySelector('button')!.textContent = 'A very long anchor action that must wrap within its current safe allocation';
    element.strings = { close: 'Close the current map anchor information' }; await placed(element);
    // An already visible panel still has its old coordinates while its larger content is measured.
    // Wait for that replacement publication, independently of the clipping bounds asserted below.
    await waitUntil(() => placements > beforeGrowth, 'Grown RTL content receives a fresh placement');
    const allocation = element.getBoundingClientRect(), panel = anchor(element).getBoundingClientRect(); expect(panel.left).to.be.at.least(allocation.left + 27); expect(panel.right).to.be.at.most(allocation.right - 77);
    expect(panel.top).to.be.at.least(allocation.top + 22); expect(panel.bottom).to.be.at.most(allocation.bottom - 32); await expect(element).to.be.accessible();
  });
  it('does not focus stale placement while an older runtime completion resolves after a declarative close', async () => {
    let notify: ((result: PlacementResult) => void) | undefined;
    __setAnchoredOverlayRuntimeLoaderForTesting(async () => ({
      place: (_reference, _panel, options) => { notify = options?.onPlaced; return () => undefined; }, trackRect: () => () => undefined,
    }));
    const slot = content(); const { element } = await mount(el => { el.append(slot); el.anchorClosable = true; el.anchorLngLat = [0, 0]; });
    await waitUntil(() => notify !== undefined); expect(element.focusAnchor()).to.equal(false); element.anchorLngLat = null; await element.updateComplete; notify!({ placement: 'top' });
    expect(anchor(element).hidden).to.equal(true); expect(element.focusAnchor()).to.equal(false);
  });
  it('invalidates placement when native projection reentry retires the coordinate request', async () => {
    const { element, peer } = await open(); peer.beforeProject = () => { peer.beforeProject = undefined; element.anchorLngLat = null; }; peer.fire('move');
    await waitUntil(() => anchor(element).hidden); expect(element.focusAnchor()).to.equal(false); expect(element.anchorLngLat).to.equal(null);
  });
  it('keeps placement and close controls usable under reduced motion and retires focus ownership on disconnect', async () => {
    try {
      await setReducedMotion('reduce'); const { element } = await open(el => { el.anchorClosable = true; }); const closes = capture(element); expect(element.focusAnchor()).to.equal(true);
      const close = element.shadowRoot!.querySelector<HTMLButtonElement>('[part="anchor-close"]')!, style = getComputedStyle(close);
      expect(style.animationName).to.equal('none'); element.remove(); expect(element.focusAnchor()).to.equal(false); expect(element.closeAnchor()).to.equal(false); expect(closes.length).to.equal(0);
    } finally { await setReducedMotion('no-preference'); }
  });
  it('preserves drawing cancel resting pointer/focus styles when adding anchor close styling', async () => {
    const { element } = await mount(el => { el.drawMode = 'line'; });
    await waitUntil(() => element.shadowRoot!.querySelector<HTMLButtonElement>('[part="drawing-cancel"]')?.disabled === false);
    const cancel = element.shadowRoot!.querySelector<HTMLButtonElement>('[part="drawing-cancel"]')!;
    const style = getComputedStyle(cancel); expect(style.cursor).to.equal('pointer');
    expect(style.outlineStyle === 'none' || Number.parseFloat(style.outlineWidth) === 0).to.equal(true);
  });
});

