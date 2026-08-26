import { fixture, expect, oneEvent, waitUntil } from '@open-wc/testing';
import { html as litHtml, nothing, type PropertyValues } from 'lit';
import { property } from 'lit/decorators.js';
import { LyraElement } from './lyra-element.js';
import { TextViewerTarget, type LyraTextViewerTargetEventMap } from './text-viewer-target.js';
import { defineElement } from './prefix.js';
import { HIGHLIGHT_SNAPSHOT_LIMIT } from './anchor-target.js';
import { TEXT_QUOTE_LIMITS } from './text-quote.js';

const PARAGRAPH_ONE = 'The quick brown fox jumps over the lazy dog.';
const PARAGRAPH_TWO = 'The fox runs fast under the bright sun.';

class StubTextViewerBase extends LyraElement<LyraTextViewerTargetEventMap> {
  /** Hides `[part="body"]` entirely so tests can exercise the "no body root" branches. */
  @property({ type: Boolean, attribute: 'no-body' }) noBody = false;
  /** Optional id placed on the body root itself, for the "root IS the fragment target" case. */
  @property({ attribute: 'root-id' }) rootId: string | null = null;
  @property({ attribute: false }) bodyText: string | null = null;

  override render() {
    if (this.noBody) return litHtml`<div part="not-body">no body here</div>${this.renderAnchorLiveRegion()}`;
    if (this.bodyText !== null) {
      return litHtml`<div part="body" id=${this.rootId ?? nothing}><p>${this.bodyText}</p></div
      >${this.renderAnchorLiveRegion()}`;
    }
    return litHtml`<div part="body" id=${this.rootId ?? nothing}
      ><p id="section-one">${PARAGRAPH_ONE}</p><p>${PARAGRAPH_TWO}</p><p>İzmir</p></div
    >${this.renderAnchorLiveRegion()}`;
  }
}

interface StubTextViewerBase {
  renderAnchorLiveRegion(): unknown;
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
  searchMatches: { length: number; matchCountExact: boolean };
  searchMatchCountExact: boolean;
  activeSearchRange(): Range | null;
  searchQuery: string;
  selectionRoot: Element | null;
  selectionCleanup?: () => void;
  searchHandle?: {
    release(): void;
    setRanges(tone: string, ranges: Range[]): void;
    setActive(range: Range | null): void;
    flash: unknown;
  };
  anchorRetryIntervalMs: number;
  anchorTimeoutMs: number;
  textScopeBuildCount(): number;
  textQuoteScanCount(): number;
  highlightPaintedRangeCount(): number;
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
    expect(detail).to.deep.equal({ query: 'fox', matchCount: 2, matchCountExact: true, activeIndex: 0 });
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
    expect(detail).to.deep.equal({ query: 'no-such-phrase-in-body', matchCount: 0, matchCountExact: true, activeIndex: -1 });
  });

  it('recomputes an active search with locale-aware case folding when the inherited locale changes', async () => {
    const wrapper = await fixture<HTMLDivElement>(
      litHtml`<div lang="en"><lr-text-viewer-target-test-stub></lr-text-viewer-target-test-stub></div>`,
    );
    const el = wrapper.querySelector('lr-text-viewer-target-test-stub') as StubTextViewer;
    await el.updateComplete;
    expect(await el.search('izmir')).to.equal(0);

    let localeChangeDetail: {
      query: string;
      matchCount: number;
      matchCountExact: boolean;
      activeIndex: number;
    } | undefined;
    el.addEventListener('lr-search-change', (event) => {
      localeChangeDetail = event.detail;
    });
    wrapper.setAttribute('lang', 'tr');
    await Promise.resolve();
    await el.updateComplete;
    await Promise.resolve();
    await el.updateComplete;

    expect(internals(el).searchMatches).to.have.length(1);
    // The mixin retains offsets, not Ranges; materialize the active one to read its text.
    expect(internals(el).activeSearchRange()!.toString()).to.equal('İzmir');
    expect(internals(el).searchActiveIndex).to.equal(0);
    expect(localeChangeDetail).to.deep.equal({ query: 'izmir', matchCount: 1, matchCountExact: true, activeIndex: 0 });
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
    expect(internals(el).searchMatches).to.have.length(1);
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
    expect((await eventPromise).detail).to.deep.equal({ query: 'fox', matchCount: 2, matchCountExact: true, activeIndex: 1 });

    // forward wrap: last (1) -> 0
    eventPromise = oneEvent(el, 'lr-search-change');
    ok = await el.searchNext();
    expect(ok).to.be.true;
    expect(internals(el).searchActiveIndex).to.equal(0);
    expect((await eventPromise).detail).to.deep.equal({ query: 'fox', matchCount: 2, matchCountExact: true, activeIndex: 0 });

    // normal forward step: 0 -> 1
    eventPromise = oneEvent(el, 'lr-search-change');
    ok = await el.searchNext();
    expect(ok).to.be.true;
    expect(internals(el).searchActiveIndex).to.equal(1);
    expect((await eventPromise).detail).to.deep.equal({ query: 'fox', matchCount: 2, matchCountExact: true, activeIndex: 1 });
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
    expect(internals(el).searchMatches.length).to.equal(2);

    const eventPromise = oneEvent(el, 'lr-search-change');
    el.clearSearch();
    const { detail } = await eventPromise;
    expect(detail).to.deep.equal({ query: '', matchCount: 0, matchCountExact: true, activeIndex: -1 });
    expect(internals(el).searchQuery).to.equal('');
    expect(internals(el).searchMatches.length).to.equal(0);
    expect(internals(el).searchMatchCountExact).to.be.true;
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

    it('fragment: uses a bounded walk without materializing every matching element', async () => {
      const el = await stubFixture();
      const root = el.shadowRoot!.querySelector('[part="body"]') as HTMLElement;
      Object.defineProperty(root, 'querySelectorAll', {
        configurable: true,
        value: () => { throw new Error('must not enumerate an unbounded NodeList'); },
      });
      const target = el.shadowRoot!.querySelector('#section-one') as HTMLElement;
      let scrolled = false;
      target.scrollIntoView = () => { scrolled = true; };

      expect(await el.scrollToAnchor({ kind: 'fragment', id: 'section-one' })).to.be.true;
      expect(scrolled).to.be.true;

      const fragment = document.createDocumentFragment();
      for (let index = 0; index <= TEXT_QUOTE_LIMITS.maxTraversalNodes; index++) {
        const child = document.createElement('span');
        if (index === TEXT_QUOTE_LIMITS.maxTraversalNodes) child.id = 'past-bound';
        fragment.append(child);
      }
      root.replaceChildren(fragment);
      expect(await (el as unknown as {
        applyAnchor(anchor: { kind: 'fragment'; id: string }): Promise<boolean>;
      }).applyAnchor({ kind: 'fragment', id: 'past-bound' })).to.be.false;
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

    it('scrolls a quote and search match whose common ancestor is the body element', async () => {
      const el = await stubFixture();
      const body = el.shadowRoot!.querySelector<HTMLElement>('[part="body"]')!;
      let scrolls = 0;
      body.scrollIntoView = () => {
        scrolls += 1;
      };

      expect(await el.search('dog.The fox')).to.equal(1);
      expect(await el.scrollToAnchor({ kind: 'text-quote', quote: 'dog.The fox' })).to.equal(true);
      expect(scrolls).to.equal(2);
    });

    it('text-quote: resolves false when the quote cannot be found', async () => {
      const el = await stubFixture();
      shrinkAnchorTimeouts(el);
      const ok = await el.scrollToAnchor({ kind: 'text-quote', quote: 'this phrase is nowhere in the body' });
      expect(ok).to.be.false;
    });
  });

  describe('paintRanges()/updated() search-handle lifecycle', () => {
    it('reuses one scope across highlight/search/active-only updates', async () => {
      const el = await stubFixture();
      await el.search('fox');
      const builds = internals(el).textScopeBuildCount();

      el.highlights = [{ id: 'same', anchor: { kind: 'text-quote', quote: 'fox' } }];
      await el.updateComplete;
      el.activeHighlightId = 'same';
      await el.updateComplete;
      el.requestUpdate();
      await el.updateComplete;

      expect(internals(el).textScopeBuildCount()).to.equal(builds);
    });

    it('does not rebuild fallback scope/index state on unrelated stable updates', async () => {
      const originalHighlight = Object.getOwnPropertyDescriptor(window, 'Highlight');
      let el: StubTextViewer | undefined;
      try {
        Object.defineProperty(window, 'Highlight', { configurable: true, value: undefined });
        el = await stubFixture();
        await el.search('fox');
        const builds = internals(el).textScopeBuildCount();
        const scans = internals(el).textQuoteScanCount();

        for (let index = 0; index < 3; index++) {
          el.requestUpdate();
          await el.updateComplete;
        }

        expect(internals(el).textScopeBuildCount()).to.equal(builds);
        expect(internals(el).textQuoteScanCount()).to.equal(scans);
      } finally {
        el?.remove();
        if (originalHighlight) Object.defineProperty(window, 'Highlight', originalHighlight);
        else Reflect.deleteProperty(window, 'Highlight');
      }
    });

    it('invalidates the cached scope and active search after an external DOM mutation', async () => {
      const el = await stubFixture();
      await el.search('fox');
      const builds = internals(el).textScopeBuildCount();
      let latest: { matchCount: number; matchCountExact: boolean } | undefined;
      el.addEventListener('lr-search-change', (event) => {
        latest = event.detail;
      });

      const paragraph = el.shadowRoot!.querySelector('#section-one')!;
      const walker = paragraph.ownerDocument.createTreeWalker(paragraph, NodeFilter.SHOW_TEXT);
      let textNode: Text | null = null;
      while (walker.nextNode()) {
        const candidate = walker.currentNode as Text;
        if (candidate.data.includes('fox')) {
          textNode = candidate;
          break;
        }
      }
      expect(textNode !== null).to.be.true;
      textNode!.data = textNode!.data.replace('fox', 'cat');
      await waitUntil(() => latest?.matchCount === 1);

      expect(latest!.matchCountExact).to.be.true;
      expect(internals(el).textScopeBuildCount()).to.be.greaterThan(builds);
    });

    it('drains a same-task DOM mutation before search navigation emits state', async () => {
      const el = await stubFixture();
      await el.search('fox');
      const details: Array<{
        query: string;
        matchCount: number;
        matchCountExact: boolean;
        activeIndex: number;
      }> = [];
      el.addEventListener('lr-search-change', (event) => details.push(event.detail));
      const body = el.shadowRoot!.querySelector('[part="body"]')!;
      const walker = body.ownerDocument.createTreeWalker(body, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) {
        const textNode = walker.currentNode as Text;
        textNode.data = textNode.data.replaceAll('fox', 'cat');
      }

      expect(await el.searchNext()).to.be.false;
      expect(details).to.deep.equal([{ query: 'fox', matchCount: 0, matchCountExact: true, activeIndex: -1 }]);
      await Promise.resolve();
      await el.updateComplete;
      await Promise.resolve();
      expect(details).to.have.length(1);
    });

    it('clamps a stale active match when same-task content shrink leaves one occurrence', async () => {
      const el = await stubFixture();
      await el.search('fox');
      await el.searchNext();
      expect(internals(el).searchActiveIndex).to.equal(1);
      const secondParagraph = el.shadowRoot!.querySelectorAll('p')[1]!;
      const walker = secondParagraph.ownerDocument.createTreeWalker(secondParagraph, NodeFilter.SHOW_TEXT);
      let secondText: Text | null = null;
      while (walker.nextNode()) {
        const candidate = walker.currentNode as Text;
        if (candidate.data.includes('fox')) {
          secondText = candidate;
          break;
        }
      }
      expect(secondText !== null).to.equal(true);
      secondText!.data = secondText!.data.replace('fox', 'cat');
      const eventPromise = oneEvent(el, 'lr-search-change');

      expect(await el.searchNext()).to.equal(true);
      expect(internals(el).searchMatches.length).to.equal(1);
      expect(internals(el).searchActiveIndex).to.equal(0);
      expect((await eventPromise).detail).to.deep.include({ matchCount: 1, activeIndex: 0 });
    });

    it('refreshes node mappings without emitting when an external mutation preserves normalized text', async () => {
      const el = await stubFixture();
      await el.search('fox');
      const builds = internals(el).textScopeBuildCount();
      let eventCount = 0;
      el.addEventListener('lr-search-change', () => { eventCount++; });
      const paragraph = el.shadowRoot!.querySelector('#section-one')!;
      const walker = paragraph.ownerDocument.createTreeWalker(paragraph, NodeFilter.SHOW_TEXT);
      let textNode: Text | null = null;
      while (walker.nextNode()) {
        const candidate = walker.currentNode as Text;
        if (candidate.data.length > 2) {
          textNode = candidate;
          break;
        }
      }
      expect(textNode !== null).to.be.true;
      textNode!.splitText(1);

      await waitUntil(() => internals(el).textScopeBuildCount() > builds);
      await Promise.resolve();
      expect(eventCount).to.equal(0);
      expect(internals(el).searchMatches).to.have.length(2);
    });

    it('reuses identical quote occurrences and bounds distinct highlight scan work', async () => {
      const el = await stubFixture();
      el.bodyText = `${'needle '.repeat(70_000)}target`;
      await el.updateComplete;
      const identical = Array.from({ length: 100 }, (_, index) => ({
        id: `same-${index}`,
        anchor: { kind: 'text-quote' as const, quote: 'target' },
      }));
      el.highlights = identical;
      await el.updateComplete;
      const afterIdentical = internals(el).textQuoteScanCount();
      expect(afterIdentical).to.equal(1);

      el.highlights = Array.from({ length: 100 }, (_, index) => ({
        id: `distinct-${index}`,
        anchor: { kind: 'text-quote' as const, quote: `absent-${index}` },
      }));
      await el.updateComplete;
      expect(internals(el).textQuoteScanCount() - afterIdentical).to.be.at.most(8);
      expect(internals(el).highlightPaintedRangeCount()).to.be.at.most(100);
    });

    it('retains an active host highlight at the end of the bounded snapshot', async () => {
      const el = await stubFixture();
      const handle = internals(el).searchHandle!;
      let activeText = '';
      const originalSetActive = handle.setActive.bind(handle);
      handle.setActive = (range) => {
        activeText = range?.toString() ?? '';
        originalSetActive(range);
      };
      let idReads = 0;
      el.highlights = Array.from({ length: 50_000 }, (_, index) => ({
        get id() {
          idReads++;
          return index === HIGHLIGHT_SNAPSHOT_LIMIT - 1 ? 'snapshot-end-active' : `ordinary-${index}`;
        },
        anchor: {
          kind: 'text-quote' as const,
          quote: index === HIGHLIGHT_SNAPSHOT_LIMIT - 1 ? 'İzmir' : 'fox',
        },
      }));
      el.activeHighlightId = 'snapshot-end-active';
      await el.updateComplete;

      expect(activeText).to.equal('İzmir');
      expect(idReads).to.be.at.most(HIGHLIGHT_SNAPSHOT_LIMIT);
      expect(internals(el).highlightPaintedRangeCount()).to.be.at.most(100);
    });

    it('bounds active-id inspection and retains an active host highlight inside the candidate cap', async () => {
      const el = await stubFixture();
      const handle = internals(el).searchHandle!;
      let activeText = '';
      const originalSetActive = handle.setActive as (range: Range | null) => void;
      handle.setActive = ((range: Range | null) => {
        activeText = range?.toString() ?? '';
        originalSetActive.call(handle, range);
      }) as typeof handle.setActive;
      let idReads = 0;
      el.highlights = Array.from({ length: 50_000 }, (_, index) => ({
        get id() {
          idReads++;
          return index === 999 ? 'active-at-cap' : `ordinary-${index}`;
        },
        anchor: { kind: 'text-quote' as const, quote: index === 999 ? 'İzmir' : 'fox' },
      }));
      el.activeHighlightId = 'active-at-cap';
      await el.updateComplete;

      expect(activeText).to.equal('İzmir');
      expect(idReads).to.be.at.most(HIGHLIGHT_SNAPSHOT_LIMIT);
      expect(internals(el).highlightPaintedRangeCount()).to.be.at.most(100);
    });

    it('does not retain a separate 201st Range for the active search match', async () => {
      const el = await stubFixture();
      const handle = internals(el).searchHandle!;
      let accentRanges: Range[] = [];
      let activeRange: Range | null = null;
      const originalSetRanges = handle.setRanges.bind(handle);
      const originalSetActive = handle.setActive.bind(handle);
      handle.setRanges = (tone, ranges) => {
        if (tone === 'accent') accentRanges = ranges;
        originalSetRanges(tone, ranges);
      };
      handle.setActive = (range) => {
        activeRange = range;
        originalSetActive(range);
      };
      el.bodyText = 'x '.repeat(300);
      await el.updateComplete;

      expect(await el.search('x')).to.equal(300);
      expect(accentRanges).to.have.length(200);
      expect(activeRange).to.not.be.null;
      expect(accentRanges.includes(activeRange!)).to.be.true;
      expect(new Set([...accentRanges, activeRange!]).size).to.equal(200);
    });

    it('reports a retained lower bound when the shared match ceiling is exceeded', async () => {
      const el = await stubFixture();
      el.bodyText = 'x '.repeat(10_001);
      await el.updateComplete;
      let detail: { matchCount: number; matchCountExact: boolean } | undefined;
      el.addEventListener('lr-search-change', (event) => {
        detail = event.detail;
      });

      expect(await el.search('x')).to.equal(10_000);
      expect(detail).to.deep.include({ matchCount: 10_000, matchCountExact: false });
    });

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
      expect(internals(el).searchMatches).to.have.length(2);
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
      expect(internals(el).searchMatches).to.have.length(2);
      expect(internals(el).searchHandle).to.not.be.undefined;
    });

    it('rebinds scope observation and search painting after cross-document adoption', async () => {
      const iframe = document.createElement('iframe');
      document.body.append(iframe);
      const el = await stubFixture();
      await el.search('fox');
      try {
        const adopted = iframe.contentDocument!.adoptNode(el);
        iframe.contentDocument!.body.append(adopted);
        await Promise.resolve();
        await el.updateComplete;
        expect(internals(el).selectionRoot?.ownerDocument === iframe.contentDocument).to.be.true;

        let detail: { matchCount: number; matchCountExact: boolean } | undefined;
        el.addEventListener('lr-search-change', (event) => { detail = event.detail; });
        const paragraph = el.shadowRoot!.querySelector('#section-one')!;
        const walker = iframe.contentDocument!.createTreeWalker(paragraph, NodeFilter.SHOW_TEXT);
        while (walker.nextNode()) {
          const candidate = walker.currentNode as Text;
          if (candidate.data.includes('fox')) {
            candidate.data = candidate.data.replace('fox', 'cat');
            break;
          }
        }
        await waitUntil(() => detail?.matchCount === 1);
        expect(detail!.matchCountExact).to.be.true;
      } finally {
        el.remove();
        iframe.remove();
      }
    });
  });

  it('is accessible', async () => {
    const el = await stubFixture();
    await expect(el).to.be.accessible();
  });
});
