import { aTimeout, expect, fixture, html, oneEvent } from '@open-wc/testing';
import './intersection-observer.js';
import type { LyraIntersectionObserver } from './intersection-observer.class.js';

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
      expect(latest?.options?.root).to.equal(wrapper.querySelector('#viewport'));
      expect(latest?.options?.threshold).to.deep.equal([0, 0.5, 1]);
      expect(latest?.observed).to.deep.equal([target]);

      const batchEvent = oneEvent(el, 'lr-intersection');
      const itemEvent = oneEvent(el, 'lr-intersect');
      const entry = { target, isIntersecting: true } as IntersectionObserverEntry;
      latest!.callback([entry], {} as IntersectionObserver);
      const [batch, item] = await Promise.all([batchEvent, itemEvent]);
      expect(batch.detail.entries).to.deep.equal([entry]);
      expect(item.detail.entry).to.equal(entry);
      expect(target.classList.contains('visible')).to.be.true;
      expect(latest?.unobserved).to.deep.equal([target]);
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

  it('is accessible', async () => {
    const el = await fixture<LyraIntersectionObserver>(html`<lr-intersection-observer><button>Observed</button></lr-intersection-observer>`);
    await expect(el).to.be.accessible();
  });
});
