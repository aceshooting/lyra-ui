import { expect, fixture, html } from '@open-wc/testing';
import type { LyraSearchChangeDetail } from '../../../internal/text-viewer-target.js';
import type { LyraDiffView } from './diff-view.js';
import './diff-view.js';

interface ScrollRecord {
  text: string;
  index: string | null;
  connected: boolean;
}

function trackLineScrolling(viewer: LyraDiffView): { calls: ScrollRecord[]; restore(): void } {
  const descriptor = Object.getOwnPropertyDescriptor(Element.prototype, 'scrollIntoView');
  const original = Element.prototype.scrollIntoView;
  const calls: ScrollRecord[] = [];
  Object.defineProperty(Element.prototype, 'scrollIntoView', {
    configurable: true,
    writable: true,
    value(this: Element, options?: boolean | ScrollIntoViewOptions): void {
      if (viewer.shadowRoot!.contains(this) && this.hasAttribute('data-op-index')) {
        calls.push({ text: this.textContent?.trim() ?? '', index: this.getAttribute('data-op-index'), connected: this.isConnected });
        return;
      }
      original.call(this, options);
    },
  });
  return {
    calls,
    restore() {
      if (descriptor) Object.defineProperty(Element.prototype, 'scrollIntoView', descriptor);
      else Reflect.deleteProperty(Element.prototype, 'scrollIntoView');
    },
  };
}

async function expectRetiredNavigation(pending: Promise<boolean>): Promise<void> {
  const result = await pending.then(
    value => ({ rejected: false, value }),
    () => ({ rejected: true, value: undefined }),
  );
  expect(result.rejected, 'retiring navigation must not reject its public promise').to.equal(false);
  expect(result.value, 'retired navigation must not report a current target').to.equal(false);
}

for (const direction of ['next', 'previous'] as const) {
  for (const retirement of ['clear', 'replace'] as const) {
    it(`keeps ${direction} navigation retired when a search-change listener ${retirement === 'clear' ? 'clears the results' : 'replaces the compared source'}`, async () => {
      const text = 'needle first\nplain middle\nneedle last';
      const viewer = await fixture<LyraDiffView>(html`<lr-diff-view .oldText=${text} .newText=${text}></lr-diff-view>`);
      expect(await viewer.search('needle')).to.equal(2);
      expect(viewer.shadowRoot!.querySelector('[data-active-match]')?.textContent?.trim()).to.equal('needle first');
      const changes: LyraSearchChangeDetail[] = [];
      viewer.addEventListener('lr-search-change', event => changes.push(event.detail));
      viewer.addEventListener('lr-search-change', () => {
        if (retirement === 'clear') viewer.clearSearch();
        else {
          viewer.oldText = 'replacement first\nreplacement middle\nreplacement last';
          viewer.newText = viewer.oldText;
        }
      }, { once: true });
      const scrolling = trackLineScrolling(viewer);
      try {
        await expectRetiredNavigation(direction === 'next' ? viewer.searchNext() : viewer.searchPrevious());
        await viewer.updateComplete;
        expect(scrolling.calls.length, 'the superseded event cannot cause a line scroll').to.equal(0);
        expect(changes.at(-1)).to.deep.equal({ query: '', matchCount: 0, matchCountExact: true, activeIndex: -1 });
        expect(viewer.shadowRoot!.querySelectorAll('[data-match], [data-active-match]').length).to.equal(0);
        expect(await viewer.searchNext()).to.equal(false);
        expect(await viewer.searchPrevious()).to.equal(false);

        const query = retirement === 'clear' ? 'needle' : 'replacement';
        expect(await viewer.search(query)).to.equal(retirement === 'clear' ? 2 : 3);
        expect(scrolling.calls.length, 'a new search still scrolls its own accepted target').to.equal(1);
        expect(scrolling.calls[0]!.connected).to.equal(true);
        expect(scrolling.calls[0]!.text).to.include(query);
        expect(viewer.shadowRoot!.querySelector('[data-active-match]')?.textContent).to.include(query);
      } finally {
        scrolling.restore();
      }
    });
  }
}

const hiddenIndex = 22;
const sharedLines = Array.from({ length: 40 }, (_, index) => index === 20 ? 'needle hidden' : `shared-${index}`);

for (const operation of ['search navigation', 'anchor jump'] as const) {
  for (const retirement of ['source replacement', 'disconnect'] as const) {
    it(`retires a folded ${operation} across ${retirement} and accepts a fresh search`, async () => {
      const container = await fixture<HTMLDivElement>(html`<div><lr-diff-view
        .oldText=${['old start', ...sharedLines, 'old end'].join('\n')}
        .newText=${['needle start', ...sharedLines, 'new end'].join('\n')}
        .contextLines=${1}
      ></lr-diff-view></div>`);
      const viewer = container.querySelector<LyraDiffView>('lr-diff-view')!;
      expect(await viewer.search('needle')).to.equal(2);
      expect(viewer.shadowRoot!.querySelector('[data-active-match]')?.textContent?.trim()).to.equal('+ needle start');
      expect(viewer.shadowRoot!.querySelectorAll('[part="line"][data-type="fold"]').length).to.be.greaterThan(0);
      expect(viewer.shadowRoot!.querySelector(`[data-op-index="${hiddenIndex}"]`) === null).to.equal(true);
      const anchorResults: boolean[] = [];
      viewer.addEventListener('lr-anchor-result', event => anchorResults.push(event.detail.found));
      const scrolling = trackLineScrolling(viewer);
      try {
        const pending = operation === 'search navigation'
          ? viewer.searchNext()
          : viewer.scrollToAnchor({ kind: 'line-range', start: hiddenIndex });
        // The public anchor method first waits for the current render. Let it enter its folded
        // reveal before retiring the source; navigation already reaches that reveal synchronously.
        if (operation === 'anchor jump') await Promise.resolve();
        if (retirement === 'disconnect') viewer.remove();
        else {
          viewer.oldText = Array.from({ length: 44 }, (_, index) => `replacement-${index}`).join('\n');
          viewer.newText = viewer.oldText;
        }
        const found = await pending;
        await viewer.updateComplete;
        expect(scrolling.calls.length, 'retired reveal cannot scroll a detached or replacement line').to.equal(0);
        expect(found, 'the superseded operation reports no current target').to.equal(false);
        expect(anchorResults.some(result => result), 'no retired anchor success is published').to.equal(false);
        if (retirement === 'source replacement') {
          expect(viewer.shadowRoot!.querySelector(`[data-op-index="${hiddenIndex}"]`)?.textContent?.trim()).to.equal(`replacement-${hiddenIndex}`);
        } else {
          expect(viewer.isConnected).to.equal(false);
          container.append(viewer);
          await viewer.updateComplete;
        }

        const query = retirement === 'disconnect' ? 'needle hidden' : `replacement-${hiddenIndex}`;
        expect(await viewer.search(query)).to.equal(1);
        expect(scrolling.calls.length, 'the fresh current search reaches a real rendered line').to.equal(1);
        expect(scrolling.calls[0]!.connected).to.equal(true);
        expect(scrolling.calls[0]!.text).to.include(query);
        expect(viewer.shadowRoot!.querySelector('[data-active-match]')?.textContent).to.include(query);
      } finally {
        scrolling.restore();
        viewer.remove();
      }
    });
  }
}
