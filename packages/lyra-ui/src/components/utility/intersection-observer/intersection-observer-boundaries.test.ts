import { aTimeout, expect, fixture, html } from '@open-wc/testing';
import './intersection-observer.js';
import type { LyraIntersectionObserver } from './intersection-observer.class.js';

class BoundaryObserver implements IntersectionObserver {
  static instances: BoundaryObserver[] = [];
  readonly root: Element | Document | null;
  readonly rootMargin: string;
  readonly scrollMargin = '0px';
  readonly thresholds: readonly number[];
  observed: Element[] = [];
  cleanupFails = false;
  constructor(readonly callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
    this.root = options?.root ?? null;
    this.rootMargin = options?.rootMargin ?? '0px';
    const threshold = options?.threshold ?? 0;
    this.thresholds = Array.isArray(threshold) ? threshold : [threshold];
    BoundaryObserver.instances.push(this);
  }
  observe(target: Element): void { this.observed.push(target); }
  unobserve(): void { if (this.cleanupFails) throw new TypeError('cleanup unavailable'); }
  disconnect(): void { this.observed = []; }
  takeRecords(): IntersectionObserverEntry[] { return []; }
}

function latestObserver(): BoundaryObserver {
  const latest = BoundaryObserver.instances.at(-1);
  if (!latest) throw new Error('Expected a connected observer');
  return latest;
}

function entry(target: Element): IntersectionObserverEntry {
  const bounds = target.getBoundingClientRect();
  return {
    target, time: 0, rootBounds: null, boundingClientRect: bounds,
    intersectionRect: bounds, isIntersecting: true, intersectionRatio: 1,
  };
}

describe('intersection observer capability boundaries', () => {
  let originalObserver: typeof IntersectionObserver;
  beforeEach(() => {
    originalObserver = window.IntersectionObserver;
    BoundaryObserver.instances = [];
    window.IntersectionObserver = BoundaryObserver;
  });
  afterEach(() => { window.IntersectionObserver = originalObserver; });

  it('continues native notifications after malformed entries and a target class-list failure', async () => {
    const wrapper = await fixture<LyraIntersectionObserver>(html`<lr-intersection-observer intersect-class="visible"><div>Target</div></lr-intersection-observer>`);
    await aTimeout(0);
    const target = wrapper.firstElementChild!;
    const malformed = Object.defineProperty({}, 'target', { get() { throw new TypeError('inaccessible callback target'); } });
    const lookalike = { target: {}, isIntersecting: true };
    const native = entry(target);
    const itemTargets: string[] = [];
    let batches = 0;
    wrapper.addEventListener('lr-intersect', event => itemTargets.push(event.detail.entry.target.localName));
    wrapper.addEventListener('lr-intersection', event => { batches += 1; expect(event.detail.entries.length).to.equal(1); });
    Object.defineProperty(target, 'classList', { configurable: true, get() { throw new TypeError('class-list unavailable'); } });
    try {
      const observer = latestObserver();
      observer.callback([malformed, lookalike, native] as IntersectionObserverEntry[], observer);
      expect(itemTargets).to.deep.equal(['div']);
      expect(batches).to.equal(1);
    } finally {
      Reflect.deleteProperty(target, 'classList');
    }
  });

  it('retains earlier callback entries when iteration fails and keeps once targets consumed after failed cleanup', async () => {
    const wrapper = await fixture<LyraIntersectionObserver>(html`<lr-intersection-observer once><div>Target</div></lr-intersection-observer>`);
    await aTimeout(0);
    const target = wrapper.firstElementChild!;
    const native = entry(target);
    const entries = [native];
    Object.defineProperty(entries, Symbol.iterator, {
      configurable: true,
      value: function* () { yield native; throw new TypeError('callback iteration unavailable'); },
    });
    let items = 0;
    let batches = 0;
    wrapper.addEventListener('lr-intersect', () => { items += 1; });
    wrapper.addEventListener('lr-intersection', () => { batches += 1; });
    const observer = latestObserver();
    const initialObserverCount = BoundaryObserver.instances.length;
    observer.cleanupFails = true;
    observer.callback(entries, observer);
    expect(items).to.equal(1);
    expect(batches).to.equal(1);
    observer.callback([native], observer);
    expect(items).to.equal(1);
    wrapper.threshold = 0.5;
    await wrapper.updateComplete;
    await aTimeout(0);
    expect(BoundaryObserver.instances.length).to.equal(initialObserverCount);
    wrapper.once = false;
    await wrapper.updateComplete;
    await aTimeout(0);
    const resumed = latestObserver();
    expect(resumed.observed.length).to.equal(1);
    resumed.callback([native], resumed);
    expect(items).to.equal(2);
  });

  it('normalizes a revoked threshold array and invalid class value and rejects an element lookalike without reading its properties', async () => {
    const wrapper = await fixture<LyraIntersectionObserver>(html`<lr-intersection-observer><div>Target</div></lr-intersection-observer>`);
    await aTimeout(0);
    const revoked = Proxy.revocable([0.5], {});
    revoked.revoke();
    let propertyReads = 0;
    const lookalike = Object.defineProperty({}, 'nodeType', { get() { propertyReads += 1; return 1; } });
    wrapper.threshold = revoked.proxy;
    Reflect.set(wrapper, 'root', lookalike);
    Reflect.set(wrapper, 'intersectClass', { toString() { throw new TypeError('class coercion unavailable'); } });
    await wrapper.updateComplete;
    await aTimeout(0);
    expect(latestObserver().thresholds).to.deep.equal([0]);
    expect(latestObserver().root === null).to.equal(true);
    expect(latestObserver().observed.length).to.equal(1);
    expect(propertyReads).to.equal(0);
    const target = wrapper.firstElementChild!;
    let items = 0;
    wrapper.addEventListener('lr-intersect', () => { items += 1; });
    const observer = latestObserver();
    observer.callback([entry(target)], observer);
    expect(items).to.equal(1);
    expect(target.className).to.equal('');
  });

  it('stops observation when slot assignment is unavailable and recovers on the next option update', async () => {
    const wrapper = await fixture<LyraIntersectionObserver>(html`<lr-intersection-observer><div>Target</div></lr-intersection-observer>`);
    await aTimeout(0);
    const slot = wrapper.shadowRoot!.querySelector('slot')!;
    const previous = latestObserver();
    const initialObserverCount = BoundaryObserver.instances.length;
    Object.defineProperty(slot, 'assignedElements', { configurable: true, value() { throw new TypeError('assignment unavailable'); } });
    try {
      wrapper.threshold = 0.5;
      await wrapper.updateComplete;
      await aTimeout(0);
      expect(previous.observed.length).to.equal(0);
      expect(BoundaryObserver.instances.length).to.equal(initialObserverCount);
    } finally {
      Reflect.deleteProperty(slot, 'assignedElements');
    }
    wrapper.threshold = 0.75;
    await wrapper.updateComplete;
    await aTimeout(0);
    expect(latestObserver().observed.length).to.equal(1);
    expect(latestObserver().thresholds).to.deep.equal([0.75]);
  });

  it('resolves a root id inside the host shadow tree', async () => {
    const host = await fixture<HTMLDivElement>(html`<div></div>`);
    const shadow = host.attachShadow({ mode: 'open' });
    shadow.innerHTML =
      '<div id="scroller"></div><lr-intersection-observer root="scroller"><div>Target</div></lr-intersection-observer>';
    const wrapper = shadow.querySelector('lr-intersection-observer') as LyraIntersectionObserver;
    await wrapper.updateComplete;
    await aTimeout(0);
    expect(latestObserver().root === shadow.getElementById('scroller')).to.equal(true);
  });

  it('keeps its observer for a structurally equal threshold array and rebuilds for a different one', async () => {
    const wrapper = await fixture<LyraIntersectionObserver>(html`<lr-intersection-observer .threshold=${[0, 0.5]}><div>Target</div></lr-intersection-observer>`);
    await aTimeout(0);
    const count = BoundaryObserver.instances.length;
    wrapper.threshold = [0, 0.5];
    await wrapper.updateComplete;
    await aTimeout(0);
    expect(BoundaryObserver.instances.length).to.equal(count);
    wrapper.threshold = [0, 1];
    await wrapper.updateComplete;
    await aTimeout(0);
    expect(BoundaryObserver.instances.length).to.equal(count + 1);
  });
});
