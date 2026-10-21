import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { nextFrame, twoFrames } from '../../../../test/frames.js';
import './activity-feed.js';
import type { ActivityEntry, LyraActivityFeed } from './activity-feed.js';
import type { LyraVirtualList } from '../../layout/virtual-list/virtual-list.js';

function makeEntries(count: number): ActivityEntry[] {
  return Array.from({ length: count }, (_, index) => ({ id: `e${index}`, text: `Entry ${index}` }));
}

async function virtualFeed(): Promise<{ feed: LyraActivityFeed; list: LyraVirtualList }> {
  const feed = await fixture<LyraActivityFeed>(html`<lr-activity-feed expanded virtualize-at="1"
    style="--lr-activity-feed-max-height:160px"
    .entries=${makeEntries(60)}
  ></lr-activity-feed>`);
  await twoFrames();
  const list = feed.shadowRoot!.querySelector<LyraVirtualList>('lr-virtual-list')!;
  expect(list !== null).to.equal(true);
  return { feed, list };
}

function reportRange(list: LyraVirtualList, start: number, end: number): void {
  list.dispatchEvent(new CustomEvent('lr-visible-range-change', { detail: { start, end } }));
}

describe('activity feed virtual tail anchoring', () => {
  it('releases the tail anchor on the first frame once following was turned off meanwhile', async () => {
    const { feed, list } = await virtualFeed();
    const original = list.scrollToIndex;
    let armed = false;
    let scrolled!: () => void;
    const scrollDone = new Promise<void>((resolve) => { scrolled = resolve; });
    list.scrollToIndex = (...args: Parameters<LyraVirtualList['scrollToIndex']>) => {
      original.apply(list, args);
      if (armed) {
        armed = false;
        // The reader stops following after the tail scroll was issued but before its release frame.
        feed.follow = false;
        scrolled();
      }
    };
    try {
      armed = true;
      feed.entries = [...feed.entries, { id: 'tail', text: 'Tail entry' }];
      await scrollDone;
      await nextFrame();

      const changes: boolean[] = [];
      feed.addEventListener('lr-follow-change', (event) => changes.push((event as CustomEvent).detail.following));
      reportRange(list, 50, feed.entries.length - 1);
      await waitUntil(() => feed.follow === true, 'a visible-range report at the bottom re-engages follow');
      expect(changes).to.include(true);
    } finally {
      list.scrollToIndex = original;
    }
  });

  it('ignores a superseded first release frame that fires late', async () => {
    const { feed, list } = await virtualFeed();
    const originalScroll = list.scrollToIndex;
    const originalFrame = window.requestAnimationFrame;
    let frameRequests = 0;
    let captureNext = false;
    let firstFrame: FrameRequestCallback | undefined;
    let scrolls = 0;
    let staleExtraFrames = -1;
    let secondScroll!: () => void;
    const secondScrolled = new Promise<void>((resolve) => { secondScroll = resolve; });
    window.requestAnimationFrame = ((callback: FrameRequestCallback) => {
      frameRequests += 1;
      if (captureNext) {
        captureNext = false;
        firstFrame = callback;
      }
      return originalFrame.call(window, callback);
    }) as typeof window.requestAnimationFrame;
    list.scrollToIndex = (...args: Parameters<LyraVirtualList['scrollToIndex']>) => {
      originalScroll.apply(list, args);
      scrolls += 1;
      if (scrolls === 1) {
        captureNext = true;
      } else if (scrolls === 2) {
        const before = frameRequests;
        firstFrame!(0);
        staleExtraFrames = frameRequests - before;
        secondScroll();
      }
    };
    try {
      feed.entries = [...feed.entries, { id: 'a', text: 'A' }];
      await feed.updateComplete;
      await waitUntil(() => firstFrame !== undefined, 'the first release frame was requested');
      feed.entries = [...feed.entries, { id: 'b', text: 'B' }];
      await secondScrolled;
      expect(staleExtraFrames, 'a superseded frame must not request a second release frame').to.equal(0);
    } finally {
      window.requestAnimationFrame = originalFrame;
      list.scrollToIndex = originalScroll;
    }
  });

  it('ignores a superseded second release frame that fires late and keeps the new anchor', async () => {
    const { feed, list } = await virtualFeed();
    const originalScroll = list.scrollToIndex;
    const originalFrame = window.requestAnimationFrame;
    let captureFirst = false;
    let captureSecond = false;
    let secondFrame: FrameRequestCallback | undefined;
    let scrolls = 0;
    let firstScrolled!: () => void;
    let thirdScrolled!: () => void;
    const firstDone = new Promise<void>((resolve) => { firstScrolled = resolve; });
    const thirdDone = new Promise<void>((resolve) => { thirdScrolled = resolve; });
    const changes: boolean[] = [];
    window.requestAnimationFrame = ((callback: FrameRequestCallback) => {
      if (captureSecond) {
        captureSecond = false;
        secondFrame = callback;
      }
      if (captureFirst) {
        captureFirst = false;
        const wrapped: FrameRequestCallback = (time) => {
          captureSecond = true;
          try {
            callback(time);
          } finally {
            captureSecond = false;
          }
        };
        return originalFrame.call(window, wrapped);
      }
      return originalFrame.call(window, callback);
    }) as typeof window.requestAnimationFrame;
    list.scrollToIndex = (...args: Parameters<LyraVirtualList['scrollToIndex']>) => {
      originalScroll.apply(list, args);
      scrolls += 1;
      if (scrolls === 1) {
        captureFirst = true;
        queueMicrotask(firstScrolled);
      } else if (scrolls === 2) {
        // The newest anchor is in flight: a late callback from the superseded one must not end it.
        secondFrame!(0);
        reportRange(list, 0, 5);
        thirdScrolled();
      }
    };
    feed.addEventListener('lr-follow-change', (event) => changes.push((event as CustomEvent).detail.following));
    try {
      feed.entries = [...feed.entries, { id: 'a', text: 'A' }];
      await firstDone;
      await nextFrame();
      expect(secondFrame !== undefined, 'the first frame requested a second release frame').to.equal(true);

      feed.entries = [...feed.entries, { id: 'b', text: 'B' }];
      await thirdDone;
      expect(changes, 'range reports stay ignored while the newest anchor is active').to.deep.equal([]);
      expect(feed.follow).to.equal(true);
    } finally {
      window.requestAnimationFrame = originalFrame;
      list.scrollToIndex = originalScroll;
    }
  });
});

describe('activity feed adoption', () => {
  it('restores projected relationships when appended directly into another document', async () => {
    let wrapper: HTMLDivElement | undefined;
    let frame: HTMLIFrameElement | undefined;
    try {
      wrapper = await fixture<HTMLDivElement>(html`
        <div>
          <span id="feed-direct-name">Direct adopted name</span>
          <lr-activity-feed expanded aria-labelledby="feed-direct-name" .entries=${makeEntries(2)}></lr-activity-feed>
        </div>
      `);
      const feed = wrapper.querySelector<LyraActivityFeed>('lr-activity-feed')!;
      await feed.updateComplete;
      const name = wrapper.querySelector<HTMLElement>('#feed-direct-name')!;

      frame = document.createElement('iframe');
      document.body.append(frame);
      const foreignDocument = frame.contentDocument!;
      // No adoptNode(): the adoption happens inside the insertion, so the feed is already
      // connected when its adoptedCallback runs.
      foreignDocument.body.append(wrapper);
      expect(feed.ownerDocument === foreignDocument).to.equal(true);

      const reflected = (): readonly Element[] | null => {
        const owner = feed.shadowRoot!.querySelector<HTMLElement>('[role="list"]');
        if (!owner || !Reflect.has(owner, 'ariaLabelledByElements')) return null;
        return [...((Reflect.get(owner, 'ariaLabelledByElements') as Iterable<Element> | null) ?? [])];
      };
      if (reflected() !== null) {
        await waitUntil(() => reflected()?.[0] === name, 'the adopted feed restores its external label relationship');
      }
    } finally {
      if (wrapper && wrapper.ownerDocument !== document) document.adoptNode(wrapper);
      wrapper?.remove();
      frame?.remove();
    }
  });
});
