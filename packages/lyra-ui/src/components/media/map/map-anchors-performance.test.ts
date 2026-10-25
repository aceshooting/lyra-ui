import { expect, fixture, fixtureCleanup, html, nextFrame, waitUntil } from '@open-wc/testing';
import { platform } from '@floating-ui/dom';
import { measureElementArrayLookups } from '../../../../test/element-array-lookup-cost.js';
import { expectDevWarning } from '../../../../test/expected-dev-warnings.js';
import {
  addAnchor, base, hidden, mountMap, placed, restoreMapEnvironment, stubMapEnvironment,
} from '../../../../test/map-anchors.js';
import { __setAnchoredOverlayRuntimeLoaderForTesting, type AnchoredOverlayRuntime } from '../../../internal/anchored-overlay-runtime.js';
import { MapAnchorChildren, type MapAnchorChildrenHost } from './map-anchor-controller.js';
import { MAP_ANCHOR_SEAM, type MapAnchorChild, type MapAnchorChildOperation } from './map-anchor-seam.js';

const checkpoint = () => new Promise<void>(resolve => setTimeout(resolve, 0));
async function settle(): Promise<void> { for (let index = 0; index < 6; index++) await nextFrame(); }

/** Delegates native observations while attributing their lifetime to the actual observed panels. */
function observeSubscriptions() {
  const original = window.ResizeObserver;
  const records: { targets: Set<Element>; active: Set<Element>; disconnects: number }[] = [];
  class CountedResizeObserver implements ResizeObserver {
    private readonly record = { targets: new Set<Element>(), active: new Set<Element>(), disconnects: 0 };
    private readonly delegate: ResizeObserver;
    constructor(callback: ResizeObserverCallback) {
      records.push(this.record);
      this.delegate = new original(entries => callback(entries, this));
    }
    observe(target: Element, options?: ResizeObserverOptions): void {
      this.record.targets.add(target); this.record.active.add(target); this.delegate.observe(target, options);
    }
    unobserve(target: Element): void { this.record.active.delete(target); this.delegate.unobserve(target); }
    disconnect(): void {
      this.record.disconnects += 1; this.record.active.clear(); this.delegate.disconnect();
    }
  }
  window.ResizeObserver = CountedResizeObserver;
  return {
    counts(panels: ReadonlySet<Element>) {
      const relevant = records.filter(record => [...record.targets].some(target => panels.has(target)));
      return {
        created: relevant.length,
        disconnected: relevant.reduce((sum, record) => sum + record.disconnects, 0),
        active: relevant.filter(record => [...record.active].some(target => panels.has(target))).length,
      };
    },
    restore() { window.ResizeObserver = original; },
  };
}

/** Only placement's scroll/resize subscriptions on this fixture's window and ancestors count. */
function observeListeners(targets: ReadonlySet<EventTarget>) {
  const add = EventTarget.prototype.addEventListener, remove = EventTarget.prototype.removeEventListener;
  let additions = 0, removals = 0;
  EventTarget.prototype.addEventListener = function (type, callback, options) {
    if (targets.has(this) && (type === 'scroll' || type === 'resize')) additions += 1;
    add.call(this, type, callback, options);
  };
  EventTarget.prototype.removeEventListener = function (type, callback, options) {
    if (targets.has(this) && (type === 'scroll' || type === 'resize')) removals += 1;
    remove.call(this, type, callback, options);
  };
  return {
    counts: () => ({ additions, removals }),
    restore() { EventTarget.prototype.addEventListener = add; EventTarget.prototype.removeEventListener = remove; },
  };
}

function holdFrames() {
  const request = window.requestAnimationFrame, cancel = window.cancelAnimationFrame;
  const queued = new Map<number, FrameRequestCallback>();
  let serial = 0;
  window.requestAnimationFrame = callback => { const id = ++serial; queued.set(id, callback); return id; };
  window.cancelAnimationFrame = id => { queued.delete(id); };
  return {
    restore() { window.requestAnimationFrame = request; window.cancelAnimationFrame = cancel; },
    flush() {
      const callbacks = [...queued.values()]; queued.clear();
      for (const callback of callbacks) callback(performance.now());
    },
  };
}

describe('map anchor placement subscription lifetime', () => {
  beforeEach(() => { stubMapEnvironment(); __setAnchoredOverlayRuntimeLoaderForTesting(undefined); });
  afterEach(() => { fixtureCleanup(); restoreMapEnvironment(); __setAnchoredOverlayRuntimeLoaderForTesting(undefined); });

  for (const count of [1, 2, 16]) {
    it(`retains the real placement subscriptions across 120 camera frames with ${count} anchors`, async function () {
      this.timeout(30000);
      const observers = observeSubscriptions();
      const readRects = platform.getElementRects;
      let listeners: ReturnType<typeof observeListeners> | undefined;
      try {
        const { map, engine, wrapper } = await mountMap();
        const anchors = Array.from({ length: count }, (_, index) => addAnchor(map, {
          lngLat: [(index % 4) * 3 - 4, Math.floor(index / 4) * 3 - 4],
        }));
        await placed(...anchors); await settle();
        const panels = new Set<Element>(anchors.map(base));
        const targets = new Set<EventTarget>([window, document, wrapper, map]);
        if (window.visualViewport) targets.add(window.visualViewport);
        const container = map.shadowRoot!.querySelector('[part="container"]');
        if (container) targets.add(container);
        listeners = observeListeners(targets);
        const before = observers.counts(panels);
        expect(before.active, 'Each placed panel has a native resize subscription').to.equal(count);
        const computations = new Map<Element, number>();
        platform.getElementRects = async function (...args) {
          const floating = args[0].floating;
          if (panels.has(floating)) computations.set(floating, (computations.get(floating) ?? 0) + 1);
          return readRects.apply(this, args);
        };
        let maximumPerFrame = 0;
        for (let frame = 0; frame < 120; frame++) {
          const previous = new Map(computations), left = base(anchors[0]!).style.left;
          engine.center = { lng: frame % 2 === 0 ? 0.25 : -0.25, lat: 0 };
          for (let event = 0; event < 20; event++) engine.fire('move');
          await nextFrame();
          await waitUntil(() => base(anchors[0]!).style.left !== left, 'Current camera geometry must reach the panel');
          for (const panel of panels) maximumPerFrame = Math.max(maximumPerFrame,
            (computations.get(panel) ?? 0) - (previous.get(panel) ?? 0));
        }
        const after = observers.counts(panels), listenerCounts = listeners.counts();
        expect(after.created - before.created, 'Camera geometry must not construct replacement ResizeObservers').to.equal(0);
        expect(after.disconnected - before.disconnected, 'Camera geometry must retain existing ResizeObservers').to.equal(0);
        expect(listenerCounts.additions, 'Camera geometry must retain scroll/resize listeners').to.equal(0);
        expect(listenerCounts.removals, 'Camera geometry must not remove scroll/resize listeners').to.equal(0);
        expect(maximumPerFrame, 'Stable camera updates compute once per anchor and frame').to.equal(1);
        for (const panel of panels) expect(computations.get(panel) ?? 0).to.equal(120);
        map.remove(); await settle();
        expect(observers.counts(panels).active, 'Removal releases every panel observation').to.equal(0);
      } finally {
        platform.getElementRects = readRects;
        fixtureCleanup(); listeners?.restore(); observers.restore();
      }
    });
  }

  for (const rejects of [false, true]) {
    it(`rejects stale ${rejects ? 'failed' : 'successful'} geometry immediately while a camera frame is queued`, async () => {
      const { map, engine } = await mountMap();
      const anchor = addAnchor(map, { closable: true });
      await placed(anchor); await settle();
      const panel = base(anchor), readRects = platform.getElementRects;
      let release!: () => void, reject!: (reason: Error) => void;
      const held = new Promise<void>((resolve, fail) => { release = resolve; reject = fail; });
      let entered = false;
      platform.getElementRects = async function (...args) {
        if (args[0].floating === panel) { entered = true; await held; }
        return readRects.apply(this, args);
      };
      const frames = holdFrames();
      try {
        window.dispatchEvent(new Event('resize')); await checkpoint();
        expect(entered).to.equal(true);
        const left = panel.style.left, top = panel.style.top;
        engine.center = { lng: 1, lat: 0 }; engine.fire('move');
        expect(anchor.focusContent(), 'Queued camera geometry cannot be focused').to.equal(false);
        platform.getElementRects = readRects;
        if (rejects) reject(new Error('Obsolete geometry')); else release();
        await checkpoint();
        expect(panel.style.left).to.equal(left); expect(panel.style.top).to.equal(top);
        expect(anchor.focusContent(), 'An old completion cannot make stale geometry focusable').to.equal(false);
        frames.restore(); frames.flush();
        await waitUntil(() => panel.style.left !== left, 'Latest camera position publishes after the frame');
        expect(anchor.focusContent()).to.equal(true);
      } finally { release(); platform.getElementRects = readRects; frames.restore(); }
    });
  }

  it('retains the legacy slot anchor subscription across camera updates', async () => {
    const observers = observeSubscriptions();
    try {
      const { map, engine } = await mountMap(element => {
        const action = document.createElement('button'); action.slot = 'anchor'; action.textContent = 'Anchor action';
        element.append(action); element.anchorLngLat = [0, 0];
      });
      const panel = map.shadowRoot!.querySelector<HTMLElement>('[part="anchor"]')!;
      await waitUntil(() => !panel.hidden && panel.style.left !== '' && getComputedStyle(panel).visibility !== 'hidden');
      await settle();
      const panels = new Set<Element>([panel]), before = observers.counts(panels);
      expect(before.active).to.equal(1);
      for (let index = 0; index < 12; index++) {
        const left = panel.style.left;
        engine.center = { lng: index % 2 === 0 ? 0.5 : -0.5, lat: 0 }; engine.fire('move');
        await waitUntil(() => panel.style.left !== left, 'The slot anchor follows the current camera');
      }
      expect(observers.counts(panels).created).to.equal(before.created);
      map.remove(); await settle(); expect(observers.counts(panels).active).to.equal(0);
    } finally { fixtureCleanup(); observers.restore(); }
  });

  for (const kind of ['child', 'slot'] as const) {
    it(`recovers the ${kind} anchor on the next camera move after a current placement computation fails`, async () => {
      const observers = observeSubscriptions();
      const readRects = platform.getElementRects;
      try {
        const { map, engine } = await mountMap(element => {
          if (kind !== 'slot') return;
          const action = document.createElement('button'); action.slot = 'anchor'; action.textContent = 'Anchor action';
          element.append(action); element.anchorLngLat = [0, 0];
        });
        const anchor = kind === 'child' ? addAnchor(map) : undefined;
        if (anchor) await placed(anchor);
        const panel = anchor ? base(anchor) : map.shadowRoot!.querySelector<HTMLElement>('[part="anchor"]')!;
        await waitUntil(() => !panel.hidden && panel.style.left !== '' && getComputedStyle(panel).visibility !== 'hidden');
        await settle();
        const panels = new Set<Element>([panel]), before = observers.counts(panels), left = panel.style.left;
        let rejected = false;
        platform.getElementRects = async function (...args) {
          if (args[0].floating === panel) { rejected = true; throw new Error('Current geometry unavailable'); }
          return readRects.apply(this, args);
        };
        window.dispatchEvent(new Event('resize'));
        await waitUntil(() => rejected, 'The current placement reaches the failing geometry read');
        await settle();
        expect(observers.counts(panels).active, 'A failed computation releases its observers').to.equal(0);
        expect(panel.style.left, 'Failure cannot commit partial coordinates').to.equal(left);
        platform.getElementRects = readRects;
        engine.center = { lng: 1, lat: 0 }; engine.fire('move');
        expect(anchor ? anchor.focusContent() : map.focusAnchor(), 'Replacement geometry is not focusable before placement').to.equal(false);
        await waitUntil(() => panel.style.left !== left, 'A later camera move must recover the failed placement');
        await settle();
        expect(observers.counts(panels).active).to.equal(1);
        expect(observers.counts(panels).created).to.equal(before.created + 1);
        expect(anchor ? anchor.focusContent() : map.focusAnchor()).to.equal(true);
        map.remove(); await settle(); expect(observers.counts(panels).active).to.equal(0);
      } finally { platform.getElementRects = readRects; fixtureCleanup(); observers.restore(); }
    });
  }

  it('retries a deferred runtime rejection received while a camera frame has invalidated the first placement', async () => {
    let reject!: (reason: Error) => void;
    const failedImport = new Promise<AnchoredOverlayRuntime>((_resolve, fail) => { reject = fail; });
    let imports = 0;
    __setAnchoredOverlayRuntimeLoaderForTesting(async () => {
      if (++imports === 1) return failedImport;
      const runtime = await import('../../../internal/positioner.js');
      return { place: runtime.placeAnchoredSurface, placeSession: runtime.placeAnchoredSurfaceSession,
        trackRect: runtime.trackRect, releaseTopLayer: runtime.releaseTopLayer };
    });
    const { map, engine } = await mountMap();
    const anchor = addAnchor(map);
    await waitUntil(() => imports === 1, 'First placement starts the deferred runtime import');
    const frames = holdFrames();
    try {
      engine.center = { lng: 1, lat: 0 }; engine.fire('move');
      reject(new Error('Positioning runtime unavailable')); await checkpoint();
      expect(anchor.focusContent()).to.equal(false);
      frames.restore(); frames.flush();
      await placed(anchor);
      expect(imports, 'Current geometry retries the rejected cached runtime').to.equal(2);
      expect(anchor.focusContent()).to.equal(true);
    } finally { frames.restore(); }
  });

  it('re-admits mutated option objects and replaces observation when the same boundary array changes', async () => {
    const observers = observeSubscriptions();
    try {
      const { map, engine, wrapper } = await mountMap();
      const frame = map.getBoundingClientRect();
      const first = document.createElement('div'), second = document.createElement('div');
      first.style.cssText = `position:fixed;left:${frame.left + 20}px;top:${frame.top}px;width:170px;height:320px;pointer-events:none`;
      second.style.cssText = `position:fixed;left:${frame.left + 240}px;top:${frame.top}px;width:200px;height:320px;pointer-events:none`;
      wrapper.append(first, second);
      const safeArea = { blockStart: 0 }, boundaries = [first];
      const anchor = addAnchor(map); anchor.safeArea = safeArea; anchor.boundary = boundaries;
      await placed(anchor); await settle();
      const panel = base(anchor), panels = new Set<Element>([panel]), before = observers.counts(panels);
      expect(panel.getBoundingClientRect().right).to.be.at.most(first.getBoundingClientRect().right - 7);
      safeArea.blockStart = 180; engine.fire('move');
      await waitUntil(() => panel.getBoundingClientRect().top >= frame.top + 187, 'The mutated safe area clips the panel');
      await settle();
      expect(observers.counts(panels).created).to.equal(before.created + 1);
      boundaries[0] = second; engine.fire('move');
      await waitUntil(() => panel.getBoundingClientRect().left >= second.getBoundingClientRect().left + 7, 'The replaced boundary clips the panel');
      await settle();
      expect(observers.counts(panels).created).to.equal(before.created + 2);
      expect(observers.counts(new Set([first])).active).to.equal(0);
      expect(observers.counts(new Set([second])).active).to.equal(1);
      second.remove(); engine.fire('move'); await hidden(anchor);
      expect(anchor.open).to.equal(true);
      wrapper.append(second); engine.fire('move'); await placed(anchor);
    } finally { fixtureCleanup(); observers.restore(); }
  });

  it('releases a demoted overflow anchor observation and restores it when that child is promoted', async () => {
    expectDevWarning('lyra-map-anchor-limit');
    const observers = observeSubscriptions();
    try {
      const { map, wrapper } = await mountMap();
      const frame = map.getBoundingClientRect(), boundary = document.createElement('div');
      boundary.style.cssText = `position:fixed;left:${frame.left}px;top:${frame.top}px;width:480px;height:320px;pointer-events:none`;
      wrapper.append(boundary);
      const anchors = Array.from({ length: 17 }, () => addAnchor(map));
      anchors[15]!.boundary = boundary;
      await placed(...anchors.slice(0, 16)); await settle();
      const panels = new Set<Element>(anchors.map(base));
      expect(observers.counts(panels).active).to.equal(16);
      expect(observers.counts(new Set([boundary])).active).to.equal(1);
      map.prepend(anchors[16]!);
      await placed(anchors[16]!); await hidden(anchors[15]!); await settle();
      expect(observers.counts(panels).active).to.equal(16);
      expect(observers.counts(new Set([boundary])).active).to.equal(0);
      anchors[16]!.open = false;
      await placed(anchors[15]!); await settle();
      expect(observers.counts(panels).active).to.equal(16);
      expect(observers.counts(new Set([boundary])).active).to.equal(1);
      map.remove(); await settle();
      expect(observers.counts(panels).active).to.equal(0);
      expect(observers.counts(new Set([boundary])).active).to.equal(0);
    } finally { fixtureCleanup(); observers.restore(); }
  });
});

describe('map anchor bounded document-order admission', () => {
  afterEach(() => { fixtureCleanup(); });

  for (const count of [17, 64, 256]) {
    it(`admits the first sixteen of ${count} children with linear selection and membership work`, async () => {
      expectDevWarning('lyra-map-anchor-limit');
      const element = await fixture<HTMLDivElement>(html`<div></div>`);
      const anchors = Array.from({ length: count }, (_, index) => Object.assign(document.createElement('div'), {
        id: `anchor-${index}`, open: true, closable: false, isUpdatePending: false,
        [MAP_ANCHOR_SEAM](_operation: MapAnchorChildOperation): boolean { return false; },
      }));
      element.append(...anchors);
      const host: MapAnchorChildrenHost = {
        element: Object.assign(element, {
          isUpdatePending: false,
          project(_coordinates: readonly [number, number]): readonly [number, number] | undefined { return undefined; },
        }),
        container: () => undefined, map: () => undefined, generations: () => [0, 0],
        updateActive: () => false, afterUpdate: callback => { callback(); },
        interactionBlocked: () => false, direction: () => 'ltr', engineReady: () => false, canvas: () => null,
      };
      const children = new MapAnchorChildren(host, [...anchors].reverse());
      const inspected = children as unknown as {
        entries: ReadonlyMap<MapAnchorChild, { readonly admitted: boolean }>;
      };
      const nativeCompare = Node.prototype.compareDocumentPosition;
      let comparisons = 0;
      for (const anchor of anchors) anchor.compareDocumentPosition = function (other: Node) {
        comparisons += 1; return nativeCompare.call(this, other);
      };
      try {
        const measure = () => {
          comparisons = 0;
          const membership = measureElementArrayLookups(anchors, () => { children.sync(); });
          const actual = [...inspected.entries].filter(([, entry]) => entry.admitted).map(([anchor]) => anchor.id).sort();
          const expected = [...element.children].filter(anchor => (anchor as typeof anchors[number]).open)
            .slice(0, 16).map(anchor => anchor.id).sort();
          expect(actual).to.deep.equal(expected);
          expect(membership, 'No per-child scan of the complete open array').to.equal(0);
          expect(comparisons, 'Document-order selection keeps only a bounded candidate set').to.be.at.most(6 * count);
        };
        measure();
        element.prepend(anchors.at(-1)!); measure();
        anchors[0]!.open = false; measure();
        anchors[0]!.open = true; element.append(anchors[0]!); measure();
      } finally {
        for (const anchor of anchors) Reflect.deleteProperty(anchor, 'compareDocumentPosition');
        children.dispose();
      }
    });
  }
});
