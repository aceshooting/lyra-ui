import { expect, fixture, html } from '@open-wc/testing';
import type { LyraSearchChangeDetail } from '../../../internal/text-viewer-target.js';
import type { LyraDiffView } from './diff-view.js';
import './diff-view.js';

function trackScrollWrites(body: HTMLElement): () => number {
  const offset = Object.getOwnPropertyDescriptor(Element.prototype, 'scrollTop')!;
  let writes = 0;
  Object.defineProperty(body, 'scrollTop', {
    configurable: true,
    get: () => offset.get!.call(body) as number,
    set: (value: number) => { writes++; offset.set!.call(body, value); },
  });
  return () => writes;
}

function assertVisibleMatch(viewer: LyraDiffView, body: HTMLElement, query: string): void {
  const active = viewer.shadowRoot!.querySelector<HTMLElement>('[data-active-match]')!;
  const bounds = active.getBoundingClientRect();
  const port = body.getBoundingClientRect();
  expect(active.isConnected).to.equal(true);
  expect(active.textContent).to.include(query);
  expect(bounds.top).to.be.at.least(port.top - 1);
  expect(bounds.bottom).to.be.at.most(port.bottom + 1);
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
      const viewer = await fixture<LyraDiffView>(html`<lr-diff-view max-height="32px" .oldText=${text} .newText=${text}></lr-diff-view>`);
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
      const body = viewer.shadowRoot!.querySelector<HTMLElement>('[part=base]')!;
      const scrollWrites = trackScrollWrites(body);
      await expectRetiredNavigation(direction === 'next' ? viewer.searchNext() : viewer.searchPrevious());
      await viewer.updateComplete;
      expect(scrollWrites(), 'retired navigation does not scroll the viewer').to.equal(0);
      expect(changes.at(-1)).to.deep.equal({ query: '', matchCount: 0, matchCountExact: true, activeIndex: -1 });
      expect(viewer.shadowRoot!.querySelectorAll('[data-match], [data-active-match]').length).to.equal(0);
      expect(await viewer.searchNext()).to.equal(false);
      expect(await viewer.searchPrevious()).to.equal(false);

      body.scrollTop = body.scrollHeight;
      const before = body.scrollTop;
      expect(before).to.be.greaterThan(0);
      const query = retirement === 'clear' ? 'needle' : 'replacement';
      expect(await viewer.search(query)).to.equal(retirement === 'clear' ? 2 : 3);
      expect(body.scrollTop).to.be.lessThan(before);
      expect(scrollWrites()).to.equal(2);
      assertVisibleMatch(viewer, body, query);
    });
  }
}

const hiddenIndex = 22;
const sharedLines = Array.from({ length: 40 }, (_, index) => index === 20 ? 'needle hidden' : `shared-${index}`);

for (const operation of ['search navigation', 'anchor jump'] as const) {
  for (const retirement of ['source replacement', 'disconnect'] as const) {
    it(`retires a folded ${operation} across ${retirement} and accepts a fresh search`, async () => {
      const container = await fixture<HTMLDivElement>(html`<div><lr-diff-view max-height="32px"
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
      const body = viewer.shadowRoot!.querySelector<HTMLElement>('[part=base]')!;
      const scrollWrites = trackScrollWrites(body);
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
        expect(scrollWrites(), 'retired navigation does not scroll the viewer').to.equal(0);
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
        expect(body.scrollTop).to.be.greaterThan(0);
        expect(scrollWrites()).to.equal(1);
        assertVisibleMatch(viewer, body, query);
      } finally {
        viewer.remove();
      }
    });
  }
}
