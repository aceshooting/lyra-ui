import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { acquireAriaOwnership } from './aria-ownership.js';
import { acquireNativeControlDescription } from './native-control-description.js';

it('drops an owned attribute while retaining its live control relationship and adopting later author values', async () => {
  const wrapper = await fixture<HTMLDivElement>(html`<div><button aria-label="Author label">Toggle</button><section id="retained-control">Panel</section></div>`);
  const target = wrapper.querySelector('button')!;
  const panel = wrapper.querySelector('section')!;
  const lease = acquireAriaOwnership(target, { attributes: { 'aria-label': 'Generated label' }, controls: [panel] });
  try {
    expect(target.getAttribute('aria-label')).to.equal('Generated label');
    expect(target.getAttribute('aria-controls')).to.equal('retained-control');
    lease.update(target, { controls: [panel] });
    expect(target.getAttribute('aria-label')).to.equal('Author label');
    expect(target.getAttribute('aria-controls')).to.equal('retained-control');
    target.setAttribute('aria-label', 'Later author label');
    lease.update(target, { attributes: { 'aria-label': 'New generated label' }, controls: [panel] });
    expect(target.getAttribute('aria-label')).to.equal('New generated label');
    lease.release();
    expect(target.getAttribute('aria-label')).to.equal('Later author label');
    expect(target.hasAttribute('aria-controls')).to.equal(false);
  } finally { lease.release(); }
});

it('recovers description observation after setup and teardown errors and ignores retired callbacks', async () => {
  const wrapper = await fixture<HTMLDivElement>(html`<div><section aria-describedby="description-external"><button>Action</button><span id="description-local">Local hint</span></section><span id="description-external">External hint</span></div>`);
  const host = wrapper.querySelector('section')!;
  const target = wrapper.querySelector('button')!;
  const external = wrapper.querySelector('#description-external')!;
  const original = Object.getOwnPropertyDescriptor(window, 'MutationObserver');
  const NativeObserver = window.MutationObserver;
  const observers: Observer[] = [];
  let failSetup = true, failTeardown = true, setupFailures = 0, teardownFailures = 0;
  class Observer implements MutationObserver {
    private readonly native: MutationObserver;
    constructor(private readonly callback: MutationCallback) {
      this.native = new NativeObserver((records) => callback(records, this)); observers.push(this);
    }
    observe(node: Node, options?: MutationObserverInit): void {
      if (node === host && failSetup) {
        failSetup = false; setupFailures++; throw new DOMException('Observation unavailable', 'NotSupportedError');
      }
      this.native.observe(node, options);
    }
    disconnect(): void {
      this.native.disconnect();
      if (failTeardown) { failTeardown = false; teardownFailures++; throw new Error('Retired observer unavailable'); }
    }
    takeRecords(): MutationRecord[] { return this.native.takeRecords(); }
    deliver(): void { this.callback([], this); }
  }
  let reads = 0;
  Object.defineProperty(window, 'MutationObserver', { configurable: true, value: Observer });
  let lease: ReturnType<typeof acquireNativeControlDescription> | undefined;
  try {
    lease = acquireNativeControlDescription(host, target, () => { reads++; return 'description-local'; });
    expect(setupFailures).to.equal(1); expect(teardownFailures).to.equal(1);
    expect(target.ariaDescribedByElements?.map(node => node.id)).to.deep.equal(['description-external', 'description-local']);
    lease.update(target);
    expect(observers.length).to.equal(2);
    external.id = 'renamed-description';
    await waitUntil(() => target.getAttribute('aria-describedby') === 'description-local');
    host.setAttribute('aria-describedby', 'renamed-description');
    await waitUntil(() => target.ariaDescribedByElements?.some(node => node.id === 'renamed-description') === true);
    lease.release();
    const afterRelease = reads;
    observers.forEach(observer => observer.deliver());
    lease.update(target); lease.release();
    expect(reads).to.equal(afterRelease);
    expect(target.getAttribute('aria-describedby')).to.equal('description-local');
    expect(target.ariaDescribedByElements?.map(node => node.id)).to.deep.equal(['description-local']);
  } finally {
    lease?.release();
    observers.forEach(observer => observer.disconnect());
    if (original) Object.defineProperty(window, 'MutationObserver', original);
    else Reflect.deleteProperty(window, 'MutationObserver');
  }
});
