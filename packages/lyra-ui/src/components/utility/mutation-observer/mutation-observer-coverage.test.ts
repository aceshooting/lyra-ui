import { expect, fixture, html, oneEvent } from '@open-wc/testing';
import './mutation-observer.js';
import type { LyraMutationObserver } from './mutation-observer.js';

it('re-arms observation when an observer implementation cannot drain pending records', async () => {
  const NativeObserver = window.MutationObserver;
  const observedTarget = document.createElement('div');
  let failedDrains = 0;
  let disconnects = 0;
  class UndrainableObserver extends NativeObserver {
    private observesFixtureTarget = false;

    override observe(target: Node, options: MutationObserverInit): void {
      if (target === observedTarget) this.observesFixtureTarget = true;
      super.observe(target, options);
    }

    override takeRecords(): MutationRecord[] {
      if (!this.observesFixtureTarget) return super.takeRecords();
      failedDrains += 1;
      throw new Error('Pending records unavailable');
    }

    override disconnect(): void {
      if (this.observesFixtureTarget) disconnects += 1;
      super.disconnect();
    }
  }
  window.MutationObserver = UndrainableObserver;
  let viewer: LyraMutationObserver | undefined;
  try {
    viewer = await fixture<LyraMutationObserver>(html`<lr-mutation-observer attr="data-before">${observedTarget}</lr-mutation-observer>`);
    await viewer.updateComplete;
    viewer.attr = 'data-after';
    await viewer.updateComplete;
    expect(failedDrains).to.be.greaterThan(0);
    expect(disconnects).to.be.greaterThan(0);
    const mutation = oneEvent(viewer, 'lr-mutation');
    observedTarget.setAttribute('data-after', 'changed');
    const event = await mutation;
    expect(event.detail.records.map((record: MutationRecord) => record.attributeName)).to.deep.equal(['data-after']);
    expect(Object.isFrozen(event.detail.records)).to.equal(true);
    expect(event.detail.records === event.detail.mutationList).to.equal(true);
  } finally {
    viewer?.remove();
    window.MutationObserver = NativeObserver;
  }
});
