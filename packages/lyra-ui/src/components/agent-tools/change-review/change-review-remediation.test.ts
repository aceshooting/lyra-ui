import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import './change-review.js';
import type { ChangeReviewFile, LyraChangeReview } from './change-review.class.js';
import { hoverUntilMatched, resetMouse } from '../../../../test/wtr-mouse.js';

const files: readonly ChangeReviewFile[] = [{ id: 'file', path: 'src/example.ts', hunks: [{ id: 'hunk', before: 'a', after: 'b' }] }];

describe('lr-change-review tokens', () => {
  it('reuses file and hunk identity projections until new snapshots arrive', async () => {
    const el = await fixture<LyraChangeReview>(html`<lr-change-review .files=${files}></lr-change-review>`);
    const snapshot = el.files;
    const hunks = snapshot[0]!.hunks;
    const iterator = Array.prototype[Symbol.iterator];
    let reads = 0;
    Array.prototype[Symbol.iterator] = function <T>(this: T[]): ArrayIterator<T> {
      if (Object.is(this, snapshot) || Object.is(this, hunks)) reads++;
      return iterator.call(this) as ArrayIterator<T>;
    };
    try {
      el.label = 'Review changes';
      await el.updateComplete;
      expect(reads).to.equal(0);
    } finally {
      Array.prototype[Symbol.iterator] = iterator;
    }
    el.files = [{ ...files[0]!, path: 'new.ts', hunks: [{ id: 'other', before: 'a', after: 'new' }] }];
    await el.updateComplete;
    expect(el.shadowRoot!.textContent).to.include('new.ts');
    expect(el.shadowRoot!.querySelectorAll('[part="hunk"]').length).to.equal(1);
  });

  it('paints the file frame and header hover from its public tokens', async () => {
    const el = await fixture<LyraChangeReview>(html`<lr-change-review data-lr-theme-scope .files=${files}
      style="--lr-change-review-file-border-color: rgb(1, 2, 3); --lr-change-review-file-radius: 9px; --lr-change-review-header-hover-bg: rgb(4, 5, 6); --lr-transition-fast: 0s"></lr-change-review>`);
    const file = el.shadowRoot!.querySelector<HTMLElement>('[part="file"]')!;
    expect(getComputedStyle(file).borderTopColor).to.equal('rgb(1, 2, 3)');
    expect(getComputedStyle(file).borderTopLeftRadius).to.equal('9px');
    const header = el.shadowRoot!.querySelector<HTMLElement>('[part="file-header"]')!;
    try {
      await hoverUntilMatched(header, 'file header never received hover');
      await waitUntil(() => getComputedStyle(header).backgroundColor === 'rgb(4, 5, 6)', 'header hover token never painted');
    } finally {
      await resetMouse();
    }
  });
});
