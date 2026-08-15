import { aTimeout, expect, fixture, html } from '@open-wc/testing';
import './resize-observer.js';
import type { LyraResizeObserver } from './resize-observer.class.js';

// A wrapper component whose own shadow root puts a forwarding `<slot>` directly inside
// `<lr-resize-observer>` -- the one composition where the internal slot's own `slotchange` never
// fires (its assigned node stays the same forwarding `<slot>` element) even though the FLATTENED
// target set that `slottedElementTargets()` reads has changed completely.
class ResizeObserverForwardWrapper extends HTMLElement {
  constructor() {
    super();
    const root = this.attachShadow({ mode: 'open' });
    const observer = document.createElement('lr-resize-observer');
    observer.append(document.createElement('slot'));
    root.append(observer);
  }
}
if (!customElements.get('resize-observer-forward-wrapper')) {
  customElements.define('resize-observer-forward-wrapper', ResizeObserverForwardWrapper);
}

describe('<lr-resize-observer>', () => {
  it('observes slotted elements without adding layout', async () => {
    const el = await fixture<LyraResizeObserver>(html`<lr-resize-observer><button>Resize me</button></lr-resize-observer>`);
    expect(el.shadowRoot!.querySelector('[part="base"]')).to.exist;
    expect(getComputedStyle(el).display).to.equal('contents');
  });

  it('supports disabling observation', async () => {
    const el = await fixture<LyraResizeObserver>(html`<lr-resize-observer disabled><button>Resize me</button></lr-resize-observer>`);
    expect(el.disabled).to.equal(true);
  });

  it('is accessible', async () => {
    const el = await fixture<LyraResizeObserver>(html`<lr-resize-observer><button>Resize me</button></lr-resize-observer>`);
    await expect(el).to.be.accessible();
  });

  it('does not create a dangling observer when a property change re-observe is still queued at disconnect', async () => {
    const el = await fixture<LyraResizeObserver>(html`<lr-resize-observer><button>Resize me</button></lr-resize-observer>`);
    const parent = el.parentElement!;

    // Property change queues a re-observe via scheduleAfterUpdate; removing
    // the element right away races that queued microtask against disconnect.
    el.box = 'border-box';
    el.remove();
    await aTimeout(0);

    expect((el as unknown as { observer?: ResizeObserver }).observer, 'no observer should have been created post-disconnect').to.be.undefined;

    parent.append(el);
  });

  it('resumes observation after a bare reconnect with no property change (e.g. a reparent)', async () => {
    const el = await fixture<LyraResizeObserver>(html`<lr-resize-observer><button>Resize me</button></lr-resize-observer>`);
    const parent = el.parentElement!;
    await aTimeout(0);
    expect((el as unknown as { observer?: ResizeObserver }).observer, 'observer should exist after the initial connect').to.exist;

    // A pure reparent -- no property change, and the slot's assigned-node set
    // is unchanged, so slotchange never fires either.
    el.remove();
    expect((el as unknown as { observer?: ResizeObserver }).observer, 'observer should be torn down on disconnect').to.be.undefined;

    parent.append(el);
    await aTimeout(0);
    expect((el as unknown as { observer?: ResizeObserver }).observer, 'observer should be re-armed on reconnect').to.exist;
  });

  it('re-observes through a forwarding slot exactly once, driven solely by the internal <slot>', async () => {
    // The one composition that could plausibly need extra wiring: the forwarding `<slot>` is a
    // light-DOM child of <lr-resize-observer> living in the WRAPPER's shadow tree, so swapping the
    // wrapper's own light-DOM children changes the FLATTENED target set without changing the
    // internal slot's directly-assigned node (still that same forwarding `<slot>` element).
    // Verified in Chromium, Firefox and WebKit: the internal slot's own `slotchange` fires anyway,
    // so its `@slotchange` template binding is sufficient on its own -- matching the minimal
    // pattern <lr-mutation-observer>/<lr-intersection-observer> already use. The observer count
    // below is the load-bearing half of this assertion: a redundant *host-level* `slotchange`
    // listener would also fire here (slotchange bubbles within the wrapper's shadow tree, and
    // <lr-resize-observer> is the forwarding slot's parent in it), tearing down and rebuilding the
    // ResizeObserver twice for one slot change.
    const recorded: Element[][] = [];
    const originalObserver = window.ResizeObserver;
    class RecordingResizeObserver implements ResizeObserver {
      private readonly targets: Element[] = [];
      constructor() { recorded.push(this.targets); }
      observe(target: Element): void { this.targets.push(target); }
      unobserve(): void {}
      disconnect(): void {}
    }
    window.ResizeObserver = RecordingResizeObserver as unknown as typeof ResizeObserver;
    try {
      const wrapper = await fixture<HTMLElement>(
        html`<resize-observer-forward-wrapper><button id="first">First</button></resize-observer-forward-wrapper>`,
      );
      const observer = wrapper.shadowRoot!.querySelector('lr-resize-observer') as LyraResizeObserver;
      await observer.updateComplete;
      await aTimeout(0);
      expect(recorded.at(-1)?.map((node) => node.id)).to.deep.equal(['first']);
      const observersBefore = recorded.length;

      wrapper.replaceChildren(Object.assign(document.createElement('button'), { id: 'second' }));
      await observer.updateComplete;
      await aTimeout(0);

      // The freshly observed target must be the NEW flattened element, not the detached old one.
      expect(recorded.at(-1)?.map((node) => node.id)).to.deep.equal(['second']);
      expect(recorded.length - observersBefore, 'one slot change re-arms observation once').to.equal(1);
    } finally {
      window.ResizeObserver = originalObserver;
    }
  });

  it('uses the adopted owner constructor and rejects stale callbacks across disconnect/reconnect', async () => {
    interface ObserverRecord {
      callback: ResizeObserverCallback;
      observed: Element[];
      disconnects: number;
    }
    const iframe = document.createElement('iframe');
    document.body.append(iframe);
    const frameDocument = iframe.contentDocument!;
    const frameWindow = iframe.contentWindow!;
    const originalObserver = frameWindow.ResizeObserver;
    const records: ObserverRecord[] = [];
    class OwnerResizeObserver implements ResizeObserver {
      private readonly record: ObserverRecord;
      constructor(callback: ResizeObserverCallback) {
        this.record = { callback, observed: [], disconnects: 0 };
        records.push(this.record);
      }
      observe(target: Element): void { this.record.observed.push(target); }
      unobserve(): void {}
      disconnect(): void { this.record.disconnects += 1; }
    }
    frameWindow.ResizeObserver = OwnerResizeObserver;
    const el = await fixture<LyraResizeObserver>(
      html`<lr-resize-observer><div></div></lr-resize-observer>`,
    );
    await aTimeout(0);
    const target = el.querySelector('div')!;
    el.remove();
    let events = 0;
    let latestDetail:
      | Readonly<{ entries: readonly ResizeObserverEntry[] }>
      | undefined;
    el.addEventListener('lr-resize', (event) => {
      events += 1;
      latestDetail = event.detail;
    });

    try {
      frameDocument.body.append(frameDocument.adoptNode(el));
      await el.updateComplete;
      await aTimeout(0);
      expect(records.length, 'adoption constructs through the destination window').to.be.greaterThan(0);
      const adoptedCount = records.length;
      const adoptedObserver = records.at(-1)!;
      expect(adoptedObserver.observed.length).to.equal(1);
      expect(adoptedObserver.observed[0] === target).to.equal(true);

      el.remove();
      expect(adoptedObserver.disconnects, 'disconnect tears down the exact owner observer').to.equal(1);
      adoptedObserver.callback([], {} as ResizeObserver);
      expect(events, 'a retired callback cannot emit while detached').to.equal(0);

      frameDocument.body.append(el);
      await aTimeout(0);
      expect(records.length, 'reconnect constructs a fresh destination observer').to.be.greaterThan(adoptedCount);
      const reconnectedObserver = records.at(-1)!;
      adoptedObserver.callback([], {} as ResizeObserver);
      expect(events, 'the first lifecycle remains stale after reconnect').to.equal(0);
      const resizeEntry = { target } as ResizeObserverEntry;
      reconnectedObserver.callback([resizeEntry], {} as ResizeObserver);
      expect(events, 'the current lifecycle still forwards entries').to.equal(1);
      expect(latestDetail!.entries[0] === resizeEntry).to.equal(true);
      expect(Object.isFrozen(latestDetail)).to.equal(true);
      expect(Object.isFrozen(latestDetail!.entries)).to.equal(true);
    } finally {
      el.remove();
      frameWindow.ResizeObserver = originalObserver;
      if (el.ownerDocument !== document) document.adoptNode(el);
      iframe.remove();
    }
  });

  it('fails closed when the owner window has no ResizeObserver capability', async () => {
    const iframe = document.createElement('iframe');
    document.body.append(iframe);
    const frameDocument = iframe.contentDocument!;
    const frameWindow = iframe.contentWindow!;
    const originalObserver = frameWindow.ResizeObserver;
    const el = await fixture<LyraResizeObserver>(
      html`<lr-resize-observer><div></div></lr-resize-observer>`,
    );
    await aTimeout(0);
    el.remove();
    Object.defineProperty(frameWindow, 'ResizeObserver', { configurable: true, value: undefined });
    try {
      frameDocument.body.append(frameDocument.adoptNode(el));
      await el.updateComplete;
      await aTimeout(0);
      expect((el as unknown as { observer?: ResizeObserver }).observer === undefined).to.be.true;
    } finally {
      el.remove();
      Object.defineProperty(frameWindow, 'ResizeObserver', {
        configurable: true,
        writable: true,
        value: originalObserver,
      });
      if (el.ownerDocument !== document) document.adoptNode(el);
      iframe.remove();
    }
  });
});
