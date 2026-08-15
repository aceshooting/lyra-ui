import { expect, fixture, html, oneEvent } from '@open-wc/testing';
import './archive-viewer/archive-viewer.js';
import './docx-viewer/docx-viewer.js';
import './ebook-viewer/ebook-viewer.js';
import './notebook-viewer/notebook-viewer.js';
import './pdf-viewer/pdf-viewer.js';
import './pptx-viewer/pptx-viewer.js';
import './xml-viewer/xml-viewer.js';
import { VIEWER_SEARCH_QUERY_LIMIT } from './viewer-search-limits.js';

interface LocaleSearchViewer extends HTMLElement {
  lang: string;
  updateComplete: Promise<boolean>;
  search(query: string): Promise<number>;
}

describe('viewer locale-sensitive search state', () => {
  const cases: Array<{
    name: string;
    create: () => Promise<LocaleSearchViewer>;
  }> = [
    { name: 'archive', create: () => fixture(html`<lr-archive-viewer></lr-archive-viewer>`) },
    { name: 'DOCX', create: () => fixture(html`<lr-docx-viewer></lr-docx-viewer>`) },
    { name: 'ebook', create: () => fixture(html`<lr-ebook-viewer></lr-ebook-viewer>`) },
    { name: 'notebook', create: () => fixture(html`<lr-notebook-viewer></lr-notebook-viewer>`) },
    { name: 'PDF', create: () => fixture(html`<lr-pdf-viewer></lr-pdf-viewer>`) },
    { name: 'PPTX', create: () => fixture(html`<lr-pptx-viewer></lr-pptx-viewer>`) },
    {
      name: 'XML',
      create: () => fixture(html`<lr-xml-viewer .xml=${'<root />'}></lr-xml-viewer>`),
    },
  ];

  for (const testCase of cases) {
    it(`${testCase.name} re-evaluates query exactness and emits after lang changes`, async () => {
      const viewer = await testCase.create();
      viewer.lang = 'tr';
      await viewer.updateComplete;
      const query = '\u0130'.repeat(VIEWER_SEARCH_QUERY_LIMIT);
      expect(await viewer.search(query)).to.equal(0);

      const changed = oneEvent(viewer, 'lr-search-change');
      viewer.lang = 'en';
      const event = await changed as CustomEvent;
      expect(event.detail).to.deep.equal({
        query,
        matchCount: 0,
        matchCountExact: false,
        activeIndex: -1,
      });
    });
  }
});
