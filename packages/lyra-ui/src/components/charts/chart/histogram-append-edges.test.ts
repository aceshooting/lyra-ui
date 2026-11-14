import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { expectDevWarning } from '../../../../test/expected-dev-warnings.js';
import { collectionTruncationWarningKey } from '../../../internal/collection-snapshot.js';
import type { LyraHistogram } from './histogram.class.js';
import './histogram.js';

/** An append source whose single read at `index` runs `onRead` first (a re-entrant caller). */
function reentrant(length: number, index: number, onRead: () => void, throwAfterRead: boolean): readonly number[] {
  return new Proxy(Array.from({ length }, (_, position) => position + 100), {
    get(target, key, receiver) {
      if (key === String(index)) {
        onRead();
        if (throwAfterRead) throw new Error('unreadable sample');
      }
      return Reflect.get(target, key, receiver);
    },
  });
}

describe('lr-histogram appendSamples edges', () => {
  it('treats a non-finite window size as the default window', () => {
    const el = document.createElement('lr-histogram') as LyraHistogram;
    el.values = [1, 2];
    el.appendSamples([3, 4], Number.NaN);
    expect(el.values).to.deep.equal([1, 2, 3, 4]);
    el.appendSamples([5], Number.POSITIVE_INFINITY);
    expect(el.values).to.deep.equal([1, 2, 3, 4, 5]);
  });

  it('abandons an append whose read replaces the values, whether or not the read throws', () => {
    for (const throwAfterRead of [false, true]) {
      const el = document.createElement('lr-histogram') as LyraHistogram;
      el.values = [1];
      el.appendSamples(reentrant(5, 3, () => { el.values = [42]; }, throwAfterRead));
      expect(el.values, `throwAfterRead=${throwAfterRead}`).to.deep.equal([42]);
      // The queue is empty again, so a later append applies immediately.
      el.appendSamples([7]);
      expect(el.values).to.deep.equal([42, 7]);
    }
  });

  it('skips an unreadable sample but keeps the readable ones', () => {
    const el = document.createElement('lr-histogram') as LyraHistogram;
    el.appendSamples(reentrant(3, 1, () => undefined, true));
    expect(el.values).to.deep.equal([100, 102]);
  });

  it('names the histogram-specific sample limit when values exceed the retained bound', async () => {
    expectDevWarning(collectionTruncationWarningKey('lr-histogram', 'values'));
    const el = await fixture<LyraHistogram>(html`<lr-histogram style="width:320px"></lr-histogram>`);
    el.values = Array.from({ length: 10_001 }, (_, index) => index % 50);
    await el.updateComplete;
    await waitUntil(() => el.shadowRoot!.querySelector('[part="limit"]'), 'limit notice missing');
    const limit = el.shadowRoot!.querySelector('[part="limit"]');
    expect(limit?.textContent).to.include('10,000 samples');
    el.values = [1, 2, 3];
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="limit"]')).to.equal(null);
  });
});
