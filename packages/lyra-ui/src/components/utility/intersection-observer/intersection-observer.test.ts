import { aTimeout, expect, fixture, html, oneEvent } from '@open-wc/testing';
import './intersection-observer.js';
import type { LyraIntersectionObserver } from './intersection-observer.class.js';

function intersectionEntry(target: Element, isIntersecting: boolean): IntersectionObserverEntry {
  const targetBounds = target.getBoundingClientRect();
  return {
    target,
    time: performance.now(),
    rootBounds: null,
    boundingClientRect: targetBounds,
    intersectionRect: isIntersecting ? targetBounds : new DOMRectReadOnly(),
    isIntersecting,
    intersectionRatio: isIntersecting ? 1 : 0,
  };
}

describe('<lr-intersection-observer>', () => {
  it('renders a non-layout observer wrapper', async () => {
    const el = await fixture<LyraIntersectionObserver>(html`<lr-intersection-observer><div>Observed</div></lr-intersection-observer>`);
    expect(getComputedStyle(el).display).to.equal('contents');
    expect(el.shadowRoot!.querySelector('[part="base"]')).to.exist;
  });

  it('supports root margins and thresholds', async () => {
    const el = await fixture<LyraIntersectionObserver>(html`<lr-intersection-observer root-margin="16px"><div>Observed</div></lr-intersection-observer>`);
    el.threshold = [0, 0.5, 1];
    await el.updateComplete;
    expect(el.rootMargin).to.equal('16px');
    expect(el.threshold).to.deep.equal([0, 0.5, 1]);
  });

  it('supports mapped string root/threshold, intersect-class, once, and event aliases', async () => {
    const OriginalIntersectionObserver = window.IntersectionObserver;
    let latest: {
      callback: IntersectionObserverCallback;
      options?: IntersectionObserverInit;
      observed: Element[];
      unobserved: Element[];
    } | undefined;
    class FakeIntersectionObserver {
      readonly root: Element | Document | null;
      readonly rootMargin: string;
      readonly thresholds: readonly number[];
      constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
        latest = { callback, options, observed: [], unobserved: [] };
        this.root = options?.root ?? null;
        this.rootMargin = options?.rootMargin ?? '0px';
        const threshold = options?.threshold ?? 0;
        this.thresholds = Array.isArray(threshold) ? threshold : [threshold];
      }
      observe(target: Element): void { latest!.observed.push(target); }
      unobserve(target: Element): void { latest!.unobserved.push(target); }
      disconnect(): void {}
      takeRecords(): IntersectionObserverEntry[] { return []; }
    }
    window.IntersectionObserver = FakeIntersectionObserver as unknown as typeof IntersectionObserver;

    try {
      const wrapper = await fixture<HTMLElement>(html`
        <div>
          <div id="viewport"></div>
          <lr-intersection-observer
            root="viewport"
            threshold="0 0.5 1"
            intersect-class="visible"
            once
          ><div id="target">Observed</div></lr-intersection-observer>
        </div>
      `);
      const el = wrapper.querySelector('lr-intersection-observer') as LyraIntersectionObserver;
      await el.updateComplete;
      await aTimeout(0);
      const target = el.querySelector('#target')!;
      expect((latest?.options?.root) === (wrapper.querySelector('#viewport'))).to.equal(true);
      expect(latest?.options?.threshold).to.deep.equal([0, 0.5, 1]);
      expect(latest?.observed.length).to.equal(1);
      expect(latest?.observed[0] === target).to.equal(true);

      const batchEvent = oneEvent(el, 'lr-intersection');
      const itemEvent = oneEvent(el, 'lr-intersect');
      const entry = { target, isIntersecting: true } as IntersectionObserverEntry;
      latest!.callback([entry], {} as IntersectionObserver);
      const [batch, item] = await Promise.all([batchEvent, itemEvent]);
      expect(batch.detail.entries).to.deep.equal([entry]);
      expect(batch.detail.entries[0] === entry).to.equal(true);
      expect(Object.isFrozen(batch.detail)).to.equal(true);
      expect(Object.isFrozen(batch.detail.entries)).to.equal(true);
      expect(item.detail.entry).to.equal(entry);
      expect(target.classList.contains('visible')).to.be.true;
      expect(latest?.unobserved.length).to.equal(1);
      expect(latest?.unobserved[0] === target).to.equal(true);
    } finally {
      window.IntersectionObserver = OriginalIntersectionObserver;
    }
  });

  it('keeps once-consumed targets inert across observer rebuilds and reconnects', async () => {
    interface ObserverRecord {
      callback: IntersectionObserverCallback;
      observed: Element[];
    }
    const OriginalIntersectionObserver = window.IntersectionObserver;
    const records: ObserverRecord[] = [];
    class FakeIntersectionObserver implements IntersectionObserver {
      private readonly record: ObserverRecord;
      readonly root: Element | Document | null = null;
      readonly rootMargin = '0px';
      readonly scrollMargin = '0px';
      readonly thresholds: readonly number[] = [0];
      constructor(callback: IntersectionObserverCallback) {
        this.record = { callback, observed: [] };
        records.push(this.record);
      }
      observe(target: Element): void { this.record.observed.push(target); }
      unobserve(): void {}
      disconnect(): void {}
      takeRecords(): IntersectionObserverEntry[] { return []; }
    }
    window.IntersectionObserver = FakeIntersectionObserver as unknown as typeof IntersectionObserver;

    try {
      const el = await fixture<LyraIntersectionObserver>(html`
        <lr-intersection-observer once><div id="target">Observed</div></lr-intersection-observer>
      `);
      await aTimeout(0);
      const target = el.querySelector('#target')!;
      let intersections = 0;
      el.addEventListener('lr-intersect', () => { intersections += 1; });

      records.at(-1)!.callback(
        [{ target, isIntersecting: true } as IntersectionObserverEntry],
        {} as IntersectionObserver,
      );
      expect(intersections).to.equal(1);

      const afterFirstIntersection = records.length;
      el.rootMargin = '1px';
      await el.updateComplete;
      await aTimeout(0);
      expect(records.length, 'an option rebuild must not re-arm a once-consumed target').to.equal(
        afterFirstIntersection,
      );

      const parent = el.parentElement!;
      el.remove();
      parent.append(el);
      await aTimeout(0);
      expect(records.length, 'a reconnect must not re-arm a once-consumed target').to.equal(
        afterFirstIntersection,
      );
      expect(intersections).to.equal(1);
    } finally {
      window.IntersectionObserver = OriginalIntersectionObserver;
    }
  });

  it('normalizes invalid rootMargin and threshold options instead of rejecting an update', async () => {
    const el = await fixture<LyraIntersectionObserver>(
      html`<lr-intersection-observer><div>Observed</div></lr-intersection-observer>`,
    );
    el.rootMargin = 'not a margin';
    el.threshold = [-1, 0.5, 2, Number.NaN];
    await el.updateComplete;
    await aTimeout(0);

    expect((el as unknown as { observer?: IntersectionObserver }).observer).to.exist;
  });

  it('re-observes slotted content when the default slot changes, via the inline @slotchange binding on the shadow <slot>', async () => {
    const el = await fixture<LyraIntersectionObserver>(html`<lr-intersection-observer><div>Observed</div></lr-intersection-observer>`);
    await el.updateComplete;
    expect((el as unknown as { observer?: IntersectionObserver }).observer, 'initial slotted content should be observed').to.exist;

    const extra = document.createElement('span');
    extra.textContent = 'More';
    el.append(extra);
    // The <slot>'s own slotchange event (not composed) is what re-triggers
    // observeTargets -- a host-level slotchange listener never fires here.
    await aTimeout(0);

    expect((el as unknown as { observer?: IntersectionObserver }).observer, 'observer should survive a slot change').to.exist;
  });

  it('does not create a dangling observer when a property change re-observe is still queued at disconnect', async () => {
    const el = await fixture<LyraIntersectionObserver>(html`<lr-intersection-observer><div>Observed</div></lr-intersection-observer>`);
    const parent = el.parentElement!;

    // Property change queues a re-observe via scheduleAfterUpdate; removing
    // the element right away races that queued microtask against disconnect.
    el.threshold = 0.5;
    el.remove();
    await aTimeout(0);

    expect((el as unknown as { observer?: IntersectionObserver }).observer, 'no observer should have been created post-disconnect').to.be.undefined;

    parent.append(el);
  });

  it('resumes observation after a bare reconnect with no property change (e.g. a reparent)', async () => {
    const el = await fixture<LyraIntersectionObserver>(html`<lr-intersection-observer><div>Observed</div></lr-intersection-observer>`);
    const parent = el.parentElement!;
    await aTimeout(0);
    expect((el as unknown as { observer?: IntersectionObserver }).observer, 'observer should exist after the initial connect').to.exist;

    // A pure reparent -- no property change, and the slot's assigned-node set
    // is unchanged, so slotchange never fires either.
    el.remove();
    expect((el as unknown as { observer?: IntersectionObserver }).observer, 'observer should be torn down on disconnect').to.be.undefined;

    parent.append(el);
    await aTimeout(0);
    expect((el as unknown as { observer?: IntersectionObserver }).observer, 'observer should be re-armed on reconnect').to.exist;
  });

  it('uses the adopted owner constructor, accepts a foreign root, and rejects stale callbacks', async () => {
    interface ObserverRecord {
      callback: IntersectionObserverCallback;
      options?: IntersectionObserverInit;
      observed: Element[];
      unobserved: Element[];
      disconnects: number;
    }
    const iframe = document.createElement('iframe');
    document.body.append(iframe);
    const frameDocument = iframe.contentDocument!;
    const frameWindow = iframe.contentWindow!;
    const originalObserver = frameWindow.IntersectionObserver;
    const records: ObserverRecord[] = [];
    class OwnerIntersectionObserver implements IntersectionObserver {
      private readonly record: ObserverRecord;
      readonly root: Element | Document | null;
      readonly rootMargin: string;
      readonly scrollMargin = '0px';
      readonly thresholds: readonly number[];
      constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
        this.record = { callback, options, observed: [], unobserved: [], disconnects: 0 };
        records.push(this.record);
        this.root = options?.root ?? null;
        this.rootMargin = options?.rootMargin ?? '0px';
        const threshold = options?.threshold ?? 0;
        this.thresholds = Array.isArray(threshold) ? threshold : [threshold];
      }
      observe(target: Element): void { this.record.observed.push(target); }
      unobserve(target: Element): void { this.record.unobserved.push(target); }
      disconnect(): void { this.record.disconnects += 1; }
      takeRecords(): IntersectionObserverEntry[] { return []; }
    }
    frameWindow.IntersectionObserver = OwnerIntersectionObserver;
    const root = frameDocument.createElement('div');
    frameDocument.body.append(root);
    const el = await fixture<LyraIntersectionObserver>(
      html`<lr-intersection-observer><div></div></lr-intersection-observer>`,
    );
    await aTimeout(0);
    const target = el.querySelector('div')!;
    el.remove();
    el.root = root;
    el.intersectClass = 'visible';
    el.once = true;
    let events = 0;
    el.addEventListener('lr-intersection', () => { events += 1; });

    try {
      expect(root instanceof Element, 'the regression root must come from another realm').to.equal(false);
      frameDocument.body.append(frameDocument.adoptNode(el));
      await el.updateComplete;
      await aTimeout(0);
      expect(records.length, 'adoption constructs through the destination window').to.be.greaterThan(0);
      const adoptedCount = records.length;
      const adoptedObserver = records.at(-1)!;
      expect(adoptedObserver.options?.root === root, 'the foreign-realm Element root is retained').to.equal(true);
      expect(adoptedObserver.observed.length).to.equal(1);
      expect(adoptedObserver.observed[0] === target).to.equal(true);

      const staleEntry = intersectionEntry(target, true);
      el.remove();
      expect(adoptedObserver.disconnects, 'disconnect tears down the exact owner observer').to.equal(1);
      adoptedObserver.callback([staleEntry], {} as IntersectionObserver);
      expect(events, 'a retired callback cannot emit while detached').to.equal(0);
      expect(target.classList.contains('visible'), 'a retired callback cannot mutate its target').to.equal(false);
      expect(adoptedObserver.unobserved.length, 'a retired once callback cannot unobserve').to.equal(0);

      frameDocument.body.append(el);
      await aTimeout(0);
      expect(records.length, 'reconnect constructs a fresh destination observer').to.be.greaterThan(adoptedCount);
      const reconnectedObserver = records.at(-1)!;
      adoptedObserver.callback([staleEntry], {} as IntersectionObserver);
      expect(events, 'the first lifecycle remains stale after reconnect').to.equal(0);
      reconnectedObserver.callback([staleEntry], {} as IntersectionObserver);
      expect(events, 'the current lifecycle still forwards entries').to.equal(1);
      expect(target.classList.contains('visible')).to.equal(true);
      expect(reconnectedObserver.unobserved.length).to.equal(1);
      expect(reconnectedObserver.unobserved[0] === target).to.equal(true);

      el.remove();
      target.classList.remove('visible');
      const reentrantTarget = frameDocument.createElement('div');
      el.append(reentrantTarget);
      const recordsBeforeReentrantConnect = records.length;
      frameDocument.body.append(el);
      await aTimeout(0);
      expect(records.length).to.be.greaterThan(recordsBeforeReentrantConnect);
      const reentrantObserver = records.at(-1)!;
      expect(reentrantObserver.observed.length).to.equal(1);
      expect(reentrantObserver.observed[0] === reentrantTarget).to.equal(true);
      const eventsBeforeReentrantDisconnect = events;
      el.addEventListener('lr-intersect', () => el.remove(), { once: true });
      reentrantObserver.callback(
        [intersectionEntry(reentrantTarget, true)],
        {} as IntersectionObserver,
      );
      expect(
        events,
        'a per-entry listener disconnect prevents the retired callback from emitting its batch',
      ).to.equal(eventsBeforeReentrantDisconnect);
      expect(
        reentrantObserver.unobserved.length,
        'a per-entry listener disconnect prevents unobserve through the retired observer',
      ).to.equal(0);
    } finally {
      el.remove();
      root.remove();
      frameWindow.IntersectionObserver = originalObserver;
      if (el.ownerDocument !== document) document.adoptNode(el);
      iframe.remove();
    }
  });

  it('fails closed when the owner window has no IntersectionObserver capability', async () => {
    const iframe = document.createElement('iframe');
    document.body.append(iframe);
    const frameDocument = iframe.contentDocument!;
    const frameWindow = iframe.contentWindow!;
    const originalObserver = frameWindow.IntersectionObserver;
    const el = await fixture<LyraIntersectionObserver>(
      html`<lr-intersection-observer><div></div></lr-intersection-observer>`,
    );
    await aTimeout(0);
    el.remove();
    Object.defineProperty(frameWindow, 'IntersectionObserver', { configurable: true, value: undefined });
    try {
      frameDocument.body.append(frameDocument.adoptNode(el));
      await el.updateComplete;
      await aTimeout(0);
      expect((el as unknown as { observer?: IntersectionObserver }).observer === undefined).to.be.true;
    } finally {
      el.remove();
      Object.defineProperty(frameWindow, 'IntersectionObserver', {
        configurable: true,
        writable: true,
        value: originalObserver,
      });
      if (el.ownerDocument !== document) document.adoptNode(el);
      iframe.remove();
    }
  });

  it('is accessible', async () => {
    const el = await fixture<LyraIntersectionObserver>(html`<lr-intersection-observer><button>Observed</button></lr-intersection-observer>`);
    await expect(el).to.be.accessible();
  });
});
