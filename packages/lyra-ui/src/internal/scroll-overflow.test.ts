import { expect, fixture, html } from '@open-wc/testing';
import type { ReactiveController, ReactiveControllerHost } from 'lit';
import {
  ScrollOverflowController,
  SCROLL_OVERFLOW_ATTRIBUTE,
  SCROLL_START_ATTRIBUTE,
  SCROLL_END_ATTRIBUTE,
} from './scroll-overflow.js';

/** A minimal `ReactiveControllerHost` that records the controller so a test can drive
 *  `hostUpdated()`/`hostDisconnected()` by hand — the controller measures real layout, so it needs
 *  real elements but not a real LitElement. Mirrors orientation-breakpoint.test.ts's stub host. */
function makeHost(): ReactiveControllerHost & { update(): void; connect(): void; disconnect(): void } {
  const controllers: ReactiveController[] = [];
  return {
    addController(c: ReactiveController) {
      controllers.push(c);
    },
    removeController() {},
    requestUpdate() {},
    updateComplete: Promise.resolve(true),
    update() {
      for (const c of controllers) c.hostUpdated?.();
    },
    connect() {
      for (const c of controllers) c.hostConnected?.();
    },
    disconnect() {
      for (const c of controllers) c.hostDisconnected?.();
    },
  };
}

interface ResizeRecord {
  callback: ResizeObserverCallback;
  observed: Element[];
  disconnectCalls: number;
  observer: ResizeObserver;
}

function installResizeObserverStub(owner: Window): { records: ResizeRecord[]; restore(): void } {
  const original = owner.ResizeObserver;
  const records: ResizeRecord[] = [];
  class StubResizeObserver implements ResizeObserver {
    private readonly record: ResizeRecord;

    constructor(callback: ResizeObserverCallback) {
      this.record = { callback, observed: [], disconnectCalls: 0, observer: this };
      records.push(this.record);
    }

    observe(target: Element): void {
      this.record.observed.push(target);
    }

    unobserve(): void {}

    disconnect(): void {
      this.record.disconnectCalls += 1;
    }
  }
  (owner as unknown as { ResizeObserver: typeof ResizeObserver }).ResizeObserver = StubResizeObserver;
  return {
    records,
    restore(): void {
      (owner as unknown as { ResizeObserver: typeof ResizeObserver }).ResizeObserver = original;
    },
  };
}

/** A fixed-width scroll container holding one child of `contentWidth`. */
async function makeTrack(contentWidth: string): Promise<HTMLElement> {
  return (await fixture(html`
    <div style="inline-size: 100px; overflow-x: auto; white-space: nowrap;">
      <div style="inline-size: ${contentWidth}; block-size: 10px;"></div>
    </div>
  `)) as HTMLElement;
}

/** Same shape as `makeTrack`, but under `dir="rtl"` so the tracked element's own computed
 *  direction (what `isRtl()` reads) is RTL -- exercising the CSSOM View convention where
 *  `scrollLeft` runs 0 (logical start) down to a negative `extent` (logical end). */
async function makeRtlTrack(contentWidth: string): Promise<HTMLElement> {
  return (await fixture(html`
    <div dir="rtl" style="inline-size: 100px; overflow-x: auto; white-space: nowrap;">
      <div style="inline-size: ${contentWidth}; block-size: 10px; display: inline-block;"></div>
    </div>
  `)) as HTMLElement;
}

describe('ScrollOverflowController', () => {
  it('leaves the attribute off when the content fits', async () => {
    const track = await makeTrack('50px');
    const host = makeHost();
    new ScrollOverflowController(host, () => track);
    host.update();
    expect(track.hasAttribute(SCROLL_OVERFLOW_ATTRIBUTE)).to.be.false;
  });

  it('sets the attribute when the content overflows', async () => {
    const track = await makeTrack('400px');
    const host = makeHost();
    new ScrollOverflowController(host, () => track);
    host.update();
    expect(track.hasAttribute(SCROLL_OVERFLOW_ATTRIBUTE)).to.be.true;
  });

  it('clears the attribute when overflowing content shrinks to fit', async () => {
    const track = await makeTrack('400px');
    const host = makeHost();
    new ScrollOverflowController(host, () => track);
    host.update();
    expect(track.hasAttribute(SCROLL_OVERFLOW_ATTRIBUTE)).to.be.true;

    (track.firstElementChild as HTMLElement).style.inlineSize = '20px';
    host.update();
    expect(track.hasAttribute(SCROLL_OVERFLOW_ATTRIBUTE)).to.be.false;
  });

  it('does not treat a one-pixel sub-pixel rounding difference as overflow', async () => {
    const track = await makeTrack('100.4px');
    const host = makeHost();
    new ScrollOverflowController(host, () => track);
    host.update();
    expect(track.hasAttribute(SCROLL_OVERFLOW_ATTRIBUTE)).to.be.false;
  });

  it('re-targets when the resolver starts returning a different element', async () => {
    const first = await makeTrack('400px');
    const second = await makeTrack('10px');
    let current = first;
    const host = makeHost();
    new ScrollOverflowController(host, () => current);
    host.update();
    expect(first.hasAttribute(SCROLL_OVERFLOW_ATTRIBUTE)).to.be.true;

    current = second;
    host.update();
    expect(second.hasAttribute(SCROLL_OVERFLOW_ATTRIBUTE)).to.be.false;
  });

  it('tolerates a missing element', async () => {
    const host = makeHost();
    new ScrollOverflowController(host, () => null);
    expect(() => host.update()).to.not.throw();
  });

  it('stops observing on disconnect', async () => {
    const track = await makeTrack('400px');
    const host = makeHost();
    const controller = new ScrollOverflowController(host, () => track);
    host.update();
    host.disconnect();

    // measure() is now a no-op: the tracked element was released, so a later size change can't
    // flip the attribute back on behind a detached component's back.
    track.removeAttribute(SCROLL_OVERFLOW_ATTRIBUTE);
    controller.measure();
    expect(track.hasAttribute(SCROLL_OVERFLOW_ATTRIBUTE)).to.be.false;
  });

  it('uses the observed element owner constructor and replaces it across adoption with stale callbacks inert', async () => {
    const frame = (await fixture(html`<iframe></iframe>`)) as HTMLIFrameElement;
    const frameDocument = frame.contentDocument;
    const frameWindow = frame.contentWindow;
    if (!frameDocument || !frameWindow) throw new Error('The iframe realm was unavailable.');
    const ambient = installResizeObserverStub(window);
    const destination = installResizeObserverStub(frameWindow);
    const track = frameDocument.createElement('div');
    let scrollWidth = 400;
    let clientWidth = 100;
    Object.defineProperties(track, {
      scrollWidth: { configurable: true, get: () => scrollWidth },
      clientWidth: { configurable: true, get: () => clientWidth },
    });
    frameDocument.body.append(track);
    const host = makeHost();
    new ScrollOverflowController(host, () => track);

    try {
      host.update();
      expect(destination.records.length).to.equal(1);
      expect(destination.records[0]!.observed[0] === track).to.equal(true);
      expect(ambient.records.length, 'the ambient constructor must stay inert').to.equal(0);
      expect(track.hasAttribute(SCROLL_OVERFLOW_ATTRIBUTE)).to.be.true;

      const stale = destination.records[0]!;
      host.disconnect();
      expect(stale.disconnectCalls).to.equal(1);
      document.adoptNode(track);
      document.body.append(track);
      scrollWidth = 50;
      clientWidth = 100;
      host.connect();
      expect(ambient.records.length).to.equal(1);
      expect(track.hasAttribute(SCROLL_OVERFLOW_ATTRIBUTE)).to.be.false;

      scrollWidth = 400;
      stale.callback([], stale.observer);
      expect(
        track.hasAttribute(SCROLL_OVERFLOW_ATTRIBUTE),
        'a callback retained by the old owner must not measure the new binding',
      ).to.be.false;
      ambient.records[0]!.callback([], ambient.records[0]!.observer);
      expect(track.hasAttribute(SCROLL_OVERFLOW_ATTRIBUTE)).to.be.true;
    } finally {
      host.disconnect();
      track.remove();
      destination.restore();
      ambient.restore();
      frame.remove();
    }
  });

  it('leaves both logical-edge attributes off when the content fits', async () => {
    const track = await makeTrack('50px');
    const host = makeHost();
    new ScrollOverflowController(host, () => track);
    host.update();
    expect(track.hasAttribute(SCROLL_START_ATTRIBUTE)).to.be.false;
    expect(track.hasAttribute(SCROLL_END_ATTRIBUTE)).to.be.false;
  });

  it('sets only the end attribute at the initial (start) scroll position of an overflowing LTR track', async () => {
    const track = await makeTrack('400px');
    const host = makeHost();
    new ScrollOverflowController(host, () => track);
    host.update();
    expect(track.hasAttribute(SCROLL_START_ATTRIBUTE)).to.be.false;
    expect(track.hasAttribute(SCROLL_END_ATTRIBUTE)).to.be.true;
  });

  it('flips to only the start attribute once a LTR track is scrolled to its end', async () => {
    const track = await makeTrack('400px');
    const host = makeHost();
    new ScrollOverflowController(host, () => track);
    host.update();

    track.scrollLeft = track.scrollWidth - track.clientWidth;
    track.dispatchEvent(new Event('scroll'));
    expect(track.hasAttribute(SCROLL_START_ATTRIBUTE)).to.be.true;
    expect(track.hasAttribute(SCROLL_END_ATTRIBUTE)).to.be.false;
  });

  it('sets both logical-edge attributes while an overflowing track sits mid-scroll', async () => {
    const track = await makeTrack('400px');
    const host = makeHost();
    new ScrollOverflowController(host, () => track);
    host.update();

    const maximum = track.scrollWidth - track.clientWidth;
    track.scrollLeft = Math.round(maximum / 2);
    track.dispatchEvent(new Event('scroll'));
    expect(track.hasAttribute(SCROLL_START_ATTRIBUTE)).to.be.true;
    expect(track.hasAttribute(SCROLL_END_ATTRIBUTE)).to.be.true;
  });

  it('normalizes the logical edges under RTL, where scrollLeft runs 0 down to a negative extent', async () => {
    const track = await makeRtlTrack('400px');
    const host = makeHost();
    new ScrollOverflowController(host, () => track);
    host.update();
    // At the logical start (scrollLeft 0 under the CSSOM View RTL convention), only the end
    // (further into the row) should read as reachable -- the same shape the LTR test above
    // asserts, just with the physical scrollLeft convention inverted.
    expect(track.hasAttribute(SCROLL_START_ATTRIBUTE)).to.be.false;
    expect(track.hasAttribute(SCROLL_END_ATTRIBUTE)).to.be.true;

    const maximum = track.scrollWidth - track.clientWidth;
    track.scrollLeft = -maximum;
    track.dispatchEvent(new Event('scroll'));
    expect(track.hasAttribute(SCROLL_START_ATTRIBUTE)).to.be.true;
    expect(track.hasAttribute(SCROLL_END_ATTRIBUTE)).to.be.false;
  });

  it('re-measures on a native scroll event without waiting for a host update or ResizeObserver callback', async () => {
    const track = await makeTrack('400px');
    const host = makeHost();
    new ScrollOverflowController(host, () => track);
    host.update();
    expect(track.hasAttribute(SCROLL_START_ATTRIBUTE)).to.be.false;

    track.scrollLeft = track.scrollWidth - track.clientWidth;
    // No host.update() call: the fix under test is that the controller's own scroll listener
    // (not a Lit re-render) is what re-measures here.
    track.dispatchEvent(new Event('scroll'));
    expect(track.hasAttribute(SCROLL_START_ATTRIBUTE)).to.be.true;
  });

  it('stops listening for scroll once disconnected', async () => {
    const track = await makeTrack('400px');
    const host = makeHost();
    new ScrollOverflowController(host, () => track);
    host.update();
    host.disconnect();

    track.removeAttribute(SCROLL_START_ATTRIBUTE);
    track.scrollLeft = track.scrollWidth - track.clientWidth;
    track.dispatchEvent(new Event('scroll'));
    expect(
      track.hasAttribute(SCROLL_START_ATTRIBUTE),
      'a detached controller must not react to a scroll event on a track it no longer owns',
    ).to.be.false;
  });

  it('re-measures descendants added via observeExtra when their own box grows without the tracked element resizing', async () => {
    // Reproduces the defect this lift fixes: a fixed-width track whose *content* grows (a
    // slotted/child element's own border box, not the track's) must still flip the overflow
    // attributes once that descendant is registered via observeExtra -- the plain ResizeObserver
    // on the track alone cannot see this, because the track's own border box never changes.
    const track = (await fixture(html`
      <div style="inline-size: 100px; overflow-x: auto; white-space: nowrap;">
        <span style="display: inline-block; inline-size: 40px; block-size: 10px;"></span>
      </div>
    `)) as HTMLElement;
    const child = track.firstElementChild as HTMLElement;
    const host = makeHost();
    const controller = new ScrollOverflowController(host, () => track);
    host.update();
    expect(track.hasAttribute(SCROLL_OVERFLOW_ATTRIBUTE)).to.be.false;

    controller.observeExtra([child]);
    child.style.inlineSize = '400px';
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    expect(track.hasAttribute(SCROLL_OVERFLOW_ATTRIBUTE)).to.be.true;
  });
});
