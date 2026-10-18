import { expect, fixture, html, oneEvent, waitUntil } from '@open-wc/testing';
import './archive-viewer/archive-viewer.js';
import './csv-viewer/csv-viewer.js';
import './dataset-viewer/dataset-viewer.js';
import './ebook-viewer/ebook-viewer.js';
import './notebook-viewer/notebook-viewer.js';
import './pdf-viewer/pdf-viewer.js';
import './pptx-viewer/pptx-viewer.js';
import './spreadsheet-viewer/spreadsheet-viewer.js';
import './xml-viewer/xml-viewer.js';

interface SearchResetViewer extends HTMLElement {
  updateComplete: Promise<boolean>;
  requestUpdate(name?: PropertyKey, oldValue?: unknown): void;
  searchNext(): Promise<boolean>;
}

interface TabularSearchResetViewer extends SearchResetViewer {
  src: string;
  search(query: string): Promise<number>;
}

const canonicalReset = {
  query: '',
  matchCount: 0,
  matchCountExact: true,
  activeIndex: -1,
};

async function expectSourceReset(
  viewer: SearchResetViewer,
  seed: (target: Record<string, unknown>) => void,
): Promise<void> {
  const target = viewer as unknown as Record<string, unknown>;
  seed(target);
  const reset = oneEvent(viewer, 'lr-search-change');
  viewer.requestUpdate('src', 'previous-source');
  const event = await reset as CustomEvent;
  await viewer.updateComplete;
  expect(event.detail).to.deep.equal(canonicalReset);
  expect(await viewer.searchNext()).to.be.false;
}

describe('viewer source search resets', () => {
  const rows = [['Value'], ...Array.from({ length: 1_001 }, () => ['hit'])];
  const tabularCases: Array<{
    name: string;
    create: () => Promise<TabularSearchResetViewer>;
  }> = [
    {
      name: 'CSV',
      create: () => fixture(html`<lr-csv-viewer src="previous-source" .rows=${rows}></lr-csv-viewer>`),
    },
    {
      name: 'dataset',
      create: () => fixture(html`<lr-dataset-viewer src="previous-source" .table=${{
        fields: ['Value'], rows: Array.from({ length: 1_001 }, () => ({ Value: 'hit' })),
      }}></lr-dataset-viewer>`),
    },
    {
      name: 'spreadsheet',
      create: () => fixture(html`<lr-spreadsheet-viewer src="previous-source" .workbook=${{
        sheets: [{ name: 'One', rows }],
      }}></lr-spreadsheet-viewer>`),
    },
  ];

  for (const testCase of tabularCases) {
    it(`${testCase.name} emits the canonical reset before new-source navigation`, async () => {
      const viewer = await testCase.create();
      const renderedRow = (current = false): Element | null | undefined => viewer.shadowRoot
        ?.querySelector('lr-virtual-list')?.shadowRoot
        ?.querySelector(current ? '[part="row"][aria-current="true"]' : '[part="row"]');
      await waitUntil(() => Boolean(renderedRow()));
      const searched = oneEvent(viewer, 'lr-search-change');
      expect(await viewer.search('hit')).to.equal(1_000);
      expect((await searched as CustomEvent).detail).to.deep.equal({
        query: 'hit', matchCount: 1_000, matchCountExact: false, activeIndex: 0,
      });
      expect(renderedRow(true)?.textContent ?? '').to.include('hit');

      const reset = oneEvent(viewer, 'lr-search-change');
      viewer.src = '';
      expect((await reset as CustomEvent).detail).to.deep.equal(canonicalReset);
      await viewer.updateComplete;
      await waitUntil(() => Boolean(renderedRow()) && !renderedRow(true));
      expect(await viewer.searchNext()).to.be.false;
    });
  }

  const cases: Array<{
    name: string;
    create: () => Promise<SearchResetViewer>;
    seed: (target: Record<string, unknown>) => void;
  }> = [
    {
      name: 'ebook',
      create: () => fixture(html`<lr-ebook-viewer></lr-ebook-viewer>`),
      seed: (target) => Object.assign(target, {
        searchQuery: 'hit',
        searchMatches: [{ cfi: 'epubcfi(/6/2)', excerpt: 'hit' }],
        searchMatchCountExact: false,
        searchActiveIndex: 0,
      }),
    },
    {
      name: 'PPTX',
      create: () => fixture(html`<lr-pptx-viewer></lr-pptx-viewer>`),
      seed: (target) => Object.assign(target, {
        pptxSearchQuery: 'hit',
        pptxSearchMatches: [{ slideIndex: 0, text: 'hit' }],
        pptxSearchMatchCountExact: false,
        pptxSearchActiveIndex: 0,
      }),
    },
    {
      name: 'notebook',
      create: () => fixture(html`<lr-notebook-viewer></lr-notebook-viewer>`),
      seed: (target) => Object.assign(target, {
        searchQuery: 'hit',
        searchMatches: [0],
        searchMatchCountExact: false,
        activeSearchIndex: 0,
      }),
    },
    {
      name: 'archive',
      create: () => fixture(html`<lr-archive-viewer></lr-archive-viewer>`),
      seed: (target) => Object.assign(target, {
        archiveSearchQuery: 'hit',
        archiveSearchMatches: [{}],
        archiveSearchMatchCountExact: false,
        archiveSearchActiveIndex: 0,
      }),
    },
    {
      name: 'XML',
      create: () => fixture(html`<lr-xml-viewer></lr-xml-viewer>`),
      seed: (target) => Object.assign(target, {
        searchQuery: 'hit',
        searchState: { ordered: ['[]'], matchCountExact: false },
        activeSearchIndex: 0,
      }),
    },
    {
      name: 'PDF',
      create: () => fixture(html`<lr-pdf-viewer></lr-pdf-viewer>`),
      seed: (target) => Object.assign(target['searchState'] as object, {
        query: 'hit',
        matches: [{ page: 1, start: 0, length: 3 }],
        exact: false,
        activeIndex: 0,
      }),
    },
  ];

  for (const testCase of cases) {
    it(`${testCase.name} emits the canonical reset before new-source navigation`, async () => {
      await expectSourceReset(await testCase.create(), testCase.seed);
    });
  }
});
