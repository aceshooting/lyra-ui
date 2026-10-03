import { expect, fixture, html, nextFrame } from '@open-wc/testing';
import './activity-feed.js';
import type { LyraActivityFeed } from './activity-feed.js';
import type { LyraVirtualList } from '../../layout/virtual-list/virtual-list.js';

describe('activity feed tail following', () => {
  it('exposes a warning-specific styling part on a populated warning entry', async () => {
    const feed = await fixture<LyraActivityFeed>(html`<lr-activity-feed expanded
      .entries=${[{ id: 'warning', text: 'Review required', variant: 'warning' }]}
    ></lr-activity-feed>`);
    expect(feed.shadowRoot!.querySelector('[part~="variant-dot-warning"]') !== null).to.equal(true);
    await expect(feed).to.be.accessible();
  });

  it('cancels a queued virtual tail scroll when the feed enters post-hoc mode before the list update settles', async () => {
    const feed = await fixture<LyraActivityFeed>(html`<lr-activity-feed expanded virtualize-at="1"
      style="--lr-activity-feed-max-height:160px"
      .entries=${Array.from({ length: 60 }, (_, index) => ({ id: `${index}`, text: `Entry ${index}` }))}
    ></lr-activity-feed>`);
    await nextFrame();
    await nextFrame();
    const list = feed.shadowRoot!.querySelector<LyraVirtualList>('lr-virtual-list')!;
    expect(list !== null).to.equal(true);
    const originalScroll = list.scrollToIndex;
    let tailRequests = 0;
    list.scrollToIndex = (...args: Parameters<LyraVirtualList['scrollToIndex']>) => {
      tailRequests += 1;
      originalScroll.apply(list, args);
    };
    try {
      feed.entries = [...feed.entries, { id: 'new', text: 'New entry' }];
      await feed.updateComplete;
      feed.mode = 'post-hoc';
      await feed.updateComplete;
      await nextFrame();
      expect(feed.mode).to.equal('post-hoc');
      expect(tailRequests).to.equal(0);
      feed.entries = [...feed.entries, { id: 'later', text: 'Later entry' }];
      await feed.updateComplete;
      await nextFrame();
      expect(tailRequests).to.equal(0);
    } finally {
      list.scrollToIndex = originalScroll;
    }
  });
});
