import { fixture, expect, oneEvent } from '@open-wc/testing';
import { html as litHtml, nothing, type PropertyValues } from 'lit';
import { property } from 'lit/decorators.js';
import { LyraElement } from './lyra-element.js';
import { TextViewerTarget, type LyraTextViewerTargetEventMap } from './text-viewer-target.js';
import { defineElement } from './prefix.js';

const PARAGRAPH_ONE = 'The quick brown fox jumps over the lazy dog.';
const PARAGRAPH_TWO = 'The fox runs fast under the bright sun.';

class StubTextViewerBase extends LyraElement<LyraTextViewerTargetEventMap> {
  /** Hides `[part="body"]` entirely so tests can exercise the "no body root" branches. */
  @property({ type: Boolean, attribute: 'no-body' }) noBody = false;
  /** Optional id placed on the body root itself, for the "root IS the fragment target" case. */
  @property({ attribute: 'root-id' }) rootId: string | null = null;

  render() {
    if (this.noBody) return litHtml`<div part="not-body">no body here</div>${this.renderAnchorLiveRegion()}`;
    return litHtml`<div part="body" id=${this.rootId ?? nothing}
      ><p id="section-one">${PARAGRAPH_ONE}</p><p>${PARAGRAPH_TWO}</p><p>İzmir</p></div
    >${this.renderAnchorLiveRegion()}`;
  }
}

class StubTextViewer extends TextViewerTarget(StubTextViewerBase) {
  @property({ type: Number }) loadToken = 0;
  scheduledLoadCount = 0;

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    if (this.hasUpdated && changed.has('loadToken')) {
      this.scheduleAfterUpdate(() => {
        this.scheduledLoadCount += 1;
      });
    }
  }
}
defineElement('text-viewer-target-test-stub', StubTextViewer);

declare global {
  interface HTMLElementTagNameMap {
    'lr-text-viewer-target-test-stub': StubTextViewer;
  }
}

type Internals = {
  searchActiveIndex: number;
  searchRanges: Range[];
  searchQuery: string;
  selectionRoot: Element | null;
  selectionCleanup?: () => void;
  searchHandle?: { release(): void; setRanges: unknown; setActive: unknown; flash: unknown };
  anchorRetryIntervalMs: number;
  anchorTimeoutMs: number;
};

function internals(el: StubTextViewer): Internals {
  return el as unknown as Internals;
}

async function stubFixture(): Promise<StubTextViewer> {
  return fixture<StubTextViewer>(litHtml`<lr-text-viewer-target-test-stub></lr-text-viewer-target-test-stub>`);
}

/** Shrinks the inherited anchor retry/timeout so "not found" scrollToAnchor cases resolve fast
 *  instead of waiting out the real 5s default (same technique as anchor-target.test.ts). */
function shrinkAnchorTimeouts(el: StubTextViewer): void {
  internals(el).anchorRetryIntervalMs = 5;
  internals(el).anchorTimeoutMs = 30;
}

describe('TextViewerTarget mixin', () => {
  it('search(query) finds matches, sets activeIndex to 0, emits lr-search-change, and scrolls the active match', async () => {
    const el = await stubFixture();
    const firstParagraph = el.shadowRoot!.querySelector('#section-one') as HTMLElement;
    let scrolled = false;
    firstParagraph.scrollIntoView = () => {
      scrolled = true;
    };

    const eventPromise = oneEvent(el, 'lr-search-change');
    const count = await el.search('fox');
    expect(count).to.equal(2);
    expect(internals(el).searchActiveIndex).to.equal(0);
    const { detail } = await eventPromise;
    expect(detail).to.deep.equal({ query: 'fox', matchCount: 2, activeIndex: 0 });
    expect(scrolled).to.be.true;
  });

  it('search("") resolves 0 matches and leaves searchActiveIndex at -1', async () => {
    const el = await stubFixture();
    expect(internals(el).searchActiveIndex).to.equal(-1);
    const count = await el.search('');
    expect(count).to.equal(0);
    expect(internals(el).searchActiveIndex).to.equal(-1);
  });

  it('search(query) with zero matches resolves 0 and leaves searchActiveIndex at -1', async () => {
    const el = await stubFixture();
    const eventPromise = oneEvent(el, 'lr-search-change');
    const count = await el.search('no-such-phrase-in-body');
    expect(count).to.equal(0);
    expect(internals(el).searchActiveIndex).to.equal(-1);
    const { detail } = await eventPromise;
    expect(detail).to.deep.equal({ query: 'no-such-phrase-in-body', matchCount: 0, activeIndex: -1 });
  });

  it('recomputes an active search with locale-aware case folding when the inherited locale changes', async () => {
    const wrapper = await fixture<HTMLDivElement>(
      litHtml`<div lang="en"><lr-text-viewer-target-test-stub></lr-text-viewer-target-test-stub></div>`,
    );
    const el = wrapper.querySelector('lr-text-viewer-target-test-stub') as StubTextViewer;
    await el.updateComplete;
    expect(await el.search('izmir')).to.equal(0);

    let localeChangeDetail: { query: string; matchCount: number; activeIndex: number } | undefined;
    el.addEventListener('lr-search-change', (event) => {
      localeChangeDetail = event.detail;
    });
    wrapper.setAttribute('lang', 'tr');
    await Promise.resolve();
    await el.updateComplete;
    await Promise.resolve();
    await el.updateComplete;

    expect(internals(el).searchRanges).to.have.length(1);
    expect(internals(el).searchRanges[0]!.toString()).to.equal('İzmir');
    expect(internals(el).searchActiveIndex).to.equal(0);
    expect(localeChangeDetail).to.deep.equal({ query: 'izmir', matchCount: 1, activeIndex: 0 });
  });

  it('does not consume a viewer load callback when locale search recomputation is also queued', async () => {
    const wrapper = await fixture<HTMLDivElement>(
      litHtml`<div lang="en"><lr-text-viewer-target-test-stub></lr-text-viewer-target-test-stub></div>`,
    );
    const el = wrapper.querySelector('lr-text-viewer-target-test-stub') as StubTextViewer;
    await el.updateComplete;
    expect(await el.search('izmir')).to.equal(0);
    const loadsBeforeChange = el.scheduledLoadCount;

    wrapper.setAttribute('lang', 'tr');
    el.loadToken = 1;
    await Promise.resolve();
    await el.updateComplete;
    await Promise.resolve();
    await el.updateComplete;

    expect(el.scheduledLoadCount - loadsBeforeChange).to.equal(1);
    expect(internals(el).searchRanges).to.have.length(1);
  });

  it('does not emit a search-change event when only host highlights change', async () => {
    const el = await stubFixture();
    await el.search('fox');
    let eventCount = 0;
    el.addEventListener('lr-search-change', () => {
      eventCount += 1;
    });

    el.highlights = [];
    await el.updateComplete;
    await Promise.resolve();

    expect(eventCount).to.equal(0);
  });

  it('searchNext()/searchPrevious() cycle through matches and wrap around in both directions', async () => {
    const el = await stubFixture();
    await el.search('fox'); // 2 matches, activeIndex 0

    // backward wrap: 0 -> last (1)
    let eventPromise = oneEvent(el, 'lr-search-change');
    let ok = await el.searchPrevious();
    expect(ok).to.be.true;
    expect(internals(el).searchActiveIndex).to.equal(1);
    expect((await eventPromise).detail).to.deep.equal({ query: 'fox', matchCount: 2, activeIndex: 1 });

    // forward wrap: last (1) -> 0
    eventPromise = oneEvent(el, 'lr-search-change');
    ok = await el.searchNext();
    expect(ok).to.be.true;
    expect(internals(el).searchActiveIndex).to.equal(0);
    expect((await eventPromise).detail).to.deep.equal({ query: 'fox', matchCount: 2, activeIndex: 0 });

    // normal forward step: 0 -> 1
    eventPromise = oneEvent(el, 'lr-search-change');
    ok = await el.searchNext();
    expect(ok).to.be.true;
    expect(internals(el).searchActiveIndex).to.equal(1);
    expect((await eventPromise).detail).to.deep.equal({ query: 'fox', matchCount: 2, activeIndex: 1 });
  });

  it('searchNext()/searchPrevious() return false and emit nothing when there are no ranges', async () => {
    const el = await stubFixture();
    let eventCount = 0;
    el.addEventListener('lr-search-change', () => eventCount++);

    expect(await el.searchNext()).to.be.false;
    expect(await el.searchPrevious()).to.be.false;
    expect(eventCount).to.equal(0);
  });

  it('clearSearch() resets query/ranges/index and emits lr-search-change with matchCount 0', async () => {
    const el = await stubFixture();
    await el.search('fox');
    expect(internals(el).searchRanges.length).to.equal(2);

    const eventPromise = oneEvent(el, 'lr-search-change');
    el.clearSearch();
    const { detail } = await eventPromise;
    expect(detail).to.deep.equal({ query: '', matchCount: 0, activeIndex: -1 });
    expect(internals(el).searchQuery).to.equal('');
    expect(internals(el).searchRanges).to.deep.equal([]);
    expect(internals(el).searchActiveIndex).to.equal(-1);
    // ranges are really gone, not just index reset
    expect(await el.searchNext()).to.be.false;
  });

  describe('applyAnchor via scrollToAnchor', () => {
    it('fragment: finds a descendant element by id inside the body root and scrolls it into view', async () => {
      const el = await stubFixture();
      const target = el.shadowRoot!.querySelector('#section-one') as HTMLElement;
      let scrolled = false;
      target.scrollIntoView = () => {
        scrolled = true;
      };
      const ok = await el.scrollToAnchor({ kind: 'fragment', id: 'section-one' });
      expect(ok).to.be.true;
      expect(scrolled).to.be.true;
    });

    it('fragment: matches when the body root itself carries the id', async () => {
      const el = await stubFixture();
      el.rootId = 'root-target';
      await el.updateComplete;
      const root = el.shadowRoot!.querySelector('[part="body"]') as HTMLElement;
      expect(root.id).to.equal('root-target');
      let scrolled = false;
      root.scrollIntoView = () => {
        scrolled = true;
      };
      const ok = await el.scrollToAnchor({ kind: 'fragment', id: 'root-target' });
      expect(ok).to.be.true;
      expect(scrolled).to.be.true;
    });

    it('fragment: resolves false when no element with that id exists', async () => {
      const el = await stubFixture();
      shrinkAnchorTimeouts(el);
      const ok = await el.scrollToAnchor({ kind: 'fragment', id: 'does-not-exist' });
      expect(ok).to.be.false;
    });

    it('fragment: resolves false when the body root is absent', async () => {
      const el = await stubFixture();
      el.noBody = true;
      await el.updateComplete;
      shrinkAnchorTimeouts(el);
      const ok = await el.scrollToAnchor({ kind: 'fragment', id: 'section-one' });
      expect(ok).to.be.false;
    });

    it('text-quote: resolves via resolveTextQuote and scrolls the match into view', async () => {
      const el = await stubFixture();
      const paragraph = el.shadowRoot!.querySelector('#section-one') as HTMLElement;
      let scrolled = false;
      paragraph.scrollIntoView = () => {
        scrolled = true;
      };
      const ok = await el.scrollToAnchor({ kind: 'text-quote', quote: 'brown fox' });
      expect(ok).to.be.true;
      expect(scrolled).to.be.true;
    });

    it('text-quote: resolves false when the quote cannot be found', async () => {
      const el = await stubFixture();
      shrinkAnchorTimeouts(el);
      const ok = await el.scrollToAnchor({ kind: 'text-quote', quote: 'this phrase is nowhere in the body' });
      expect(ok).to.be.false;
    });
  });

  describe('paintRanges()/updated() search-handle lifecycle', () => {
    it('releases the search highlight handle when the body root disappears on re-render', async () => {
      const el = await stubFixture();
      await el.updateComplete;
      const handle = internals(el).searchHandle;
      expect(handle, 'a highlight handle should be acquired once a body root exists').to.exist;

      let released = false;
      const originalRelease = handle!.release.bind(handle);
      handle!.release = () => {
        released = true;
        originalRelease();
      };

      el.noBody = true;
      await el.updateComplete;
      expect(released).to.be.true;
    });

    it('unbinds the old selection root when the body disappears', async () => {
      const el = await stubFixture();
      expect(typeof internals(el).selectionCleanup).to.equal('function');

      el.noBody = true;
      await el.updateComplete;

      expect(internals(el).selectionRoot).to.be.null;
      expect(internals(el).selectionCleanup).to.be.undefined;
    });
  });

  describe('disconnectedCallback()', () => {
    it('releases the search handle and clears internal root/handle state', async () => {
      const el = await stubFixture();
      await el.updateComplete;
      const handle = internals(el).searchHandle;
      expect(handle).to.exist;

      let released = false;
      const originalRelease = handle!.release.bind(handle);
      handle!.release = () => {
        released = true;
        originalRelease();
      };

      el.remove();
      expect(released).to.be.true;
      expect(internals(el).searchHandle).to.be.undefined;
    });

    it('rebinds selection and repaints an active search after reconnect', async () => {
      const el = await stubFixture();
      const parent = el.parentElement!;
      await el.search('fox');
      const originalHandle = internals(el).searchHandle;
      expect(originalHandle !== undefined).to.be.true;

      el.remove();
      expect(internals(el).searchHandle).to.be.undefined;
      expect(internals(el).selectionRoot).to.be.null;

      parent.append(el);
      await Promise.resolve();
      await el.updateComplete;

      expect(internals(el).selectionRoot?.getAttribute('part')).to.equal('body');
      expect(internals(el).searchHandle !== undefined).to.be.true;
      expect(internals(el).searchHandle === originalHandle).to.be.false;
      expect(internals(el).searchRanges).to.have.length(2);
    });

    it('does not reacquire a highlight handle when an in-flight search resumes detached', async () => {
      const el = await stubFixture();
      const pendingSearch = el.search('fox');

      el.remove();
      await pendingSearch;

      expect(internals(el).searchHandle).to.be.undefined;
    });

    it('finishes an in-flight search after a synchronous disconnect and reconnect', async () => {
      const el = await stubFixture();
      const parent = el.parentElement!;
      const pendingSearch = el.search('fox');

      el.remove();
      parent.append(el);

      expect(await pendingSearch).to.equal(2);
      await el.updateComplete;
      expect(internals(el).searchQuery).to.equal('fox');
      expect(internals(el).searchRanges).to.have.length(2);
      expect(internals(el).searchHandle).to.not.be.undefined;
    });
  });

  it('is accessible', async () => {
    const el = await stubFixture();
    await expect(el).to.be.accessible();
  });
});
