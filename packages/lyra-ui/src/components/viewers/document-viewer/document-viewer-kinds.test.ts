import { expect } from '@open-wc/testing';
import './document-viewer-kinds.js';
import {
  ARCHIVE_VIEWER_TAG,
  EBOOK_VIEWER_TAG,
  PDF_VIEWER_TAG,
  DOCX_VIEWER_TAG,
  PPTX_VIEWER_TAG,
  SPREADSHEET_VIEWER_TAG,
  CSV_VIEWER_TAG,
  XML_VIEWER_TAG,
  NOTEBOOK_VIEWER_TAG,
  DATASET_VIEWER_TAG,
  EMAIL_VIEWER_TAG,
  CALENDAR_VIEWER_TAG,
  CONTACT_VIEWER_TAG,
  HTML_VIEWER_TAG,
  SVG_VIEWER_TAG,
} from './document-viewer-kinds.js';
import { findDocumentRenderer, loadDocumentRenderer, type LyraDocumentFile } from './registry.js';

const files: readonly [tag: string, file: LyraDocumentFile][] = [
  [ARCHIVE_VIEWER_TAG, { name: 'a.zip', mimeType: 'application/zip', src: 'https://example.test/a.zip' }],
  [EBOOK_VIEWER_TAG, { name: 'a.epub', mimeType: 'application/epub+zip', src: 'https://example.test/a.epub' }],
  [PDF_VIEWER_TAG, { name: 'a.pdf', mimeType: 'application/pdf', src: 'https://example.test/a.pdf' }],
  [
    DOCX_VIEWER_TAG,
    {
      name: 'a.docx',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      src: 'https://example.test/a.docx',
    },
  ],
  [
    PPTX_VIEWER_TAG,
    {
      name: 'a.pptx',
      mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      src: 'https://example.test/a.pptx',
    },
  ],
  [
    SPREADSHEET_VIEWER_TAG,
    {
      name: 'a.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      src: 'https://example.test/a.xlsx',
    },
  ],
  [CSV_VIEWER_TAG, { name: 'a.csv', mimeType: 'text/csv', src: 'https://example.test/a.csv' }],
  [XML_VIEWER_TAG, { name: 'a.xml', mimeType: 'application/xml', src: 'https://example.test/a.xml' }],
  [NOTEBOOK_VIEWER_TAG, { name: 'a.ipynb', mimeType: 'application/x-ipynb+json', src: 'https://example.test/a.ipynb' }],
  [DATASET_VIEWER_TAG, { name: 'a.tsv', mimeType: 'text/plain', src: 'https://example.test/a.tsv' }],
  [EMAIL_VIEWER_TAG, { name: 'a.eml', mimeType: 'message/rfc822', src: 'https://example.test/a.eml' }],
  [CALENDAR_VIEWER_TAG, { name: 'a.ics', mimeType: 'text/calendar', src: 'https://example.test/a.ics' }],
  [CONTACT_VIEWER_TAG, { name: 'a.vcf', mimeType: 'text/vcard', src: 'https://example.test/a.vcf' }],
  [HTML_VIEWER_TAG, { name: 'a.html', mimeType: 'text/html', src: 'https://example.test/a.html' }],
  [SVG_VIEWER_TAG, { name: 'a.svg', mimeType: 'image/svg+xml', src: 'https://example.test/a.svg' }],
];

function fetchedModuleEnding(suffix: string): boolean {
  return performance.getEntriesByType('resource').some((entry) => entry.name.endsWith(suffix));
}

describe('document-viewer-kinds bundle entry', () => {
  it('registers every built-in kind, with a stable tag alias for each, none registered as an element yet', () => {
    for (const [tag, file] of files) {
      expect(findDocumentRenderer(file), `${tag} should be registered`).to.exist;
      expect(customElements.get(tag), `${tag} must stay unregistered until a matching file loads`).to.equal(
        undefined,
      );
    }
    expect(new Set(files.map(([tag]) => tag)).size, 'every tag alias must be distinct').to.equal(
      files.length,
    );
  });

  it('never fetches any of the heavy viewer class modules merely by importing the bundle', () => {
    for (const suffix of [
      '/archive-viewer.class.ts',
      '/ebook-viewer.class.ts',
      '/pdf-viewer.class.ts',
      '/docx-viewer.class.ts',
      '/pptx-viewer.class.ts',
      '/spreadsheet-viewer.class.ts',
      '/csv-viewer.class.ts',
      '/xml-viewer.class.ts',
      '/notebook-viewer.class.ts',
      '/dataset-viewer.class.ts',
      '/email-viewer.class.ts',
      '/calendar-viewer.class.ts',
      '/contact-viewer.class.ts',
      '/html-viewer.class.ts',
      '/svg-viewer.class.ts',
    ]) {
      expect(fetchedModuleEnding(suffix), `the bundle must not eagerly fetch ${suffix}`).to.equal(false);
    }
  });

  it('retains each new kind matcher and capability declaration before loading', () => {
    const cases: ReadonlyArray<readonly [LyraDocumentFile, readonly string[], boolean, boolean]> = [
      [{ name: 'a.psv', mimeType: 'text/plain', src: '' }, ['cell-range'], true, false],
      [{ name: 'a.dat', mimeType: 'text/plain', src: '' }, ['cell-range'], true, false],
      [{ name: 'a.htm', mimeType: 'text/plain', src: '' }, ['text-quote', 'fragment'], true, true],
      ...files.slice(-5).map(([, file]) => [file, file.mimeType === 'image/svg+xml' ? ['region'] : ['text-quote', 'fragment'], file.mimeType !== 'image/svg+xml', file.mimeType !== 'image/svg+xml'] as const),
    ];
    for (const [file, anchors, search, textSelect] of cases) {
      const definition = findDocumentRenderer(file);
      expect(definition, file.name).to.exist;
      expect(definition!.capabilities).to.deep.equal({ anchors, search, textSelect });
      expect('load' in definition!).to.equal(true);
    }
    expect(findDocumentRenderer({ name: 'a.unknown', mimeType: 'application/x-unknown', src: '' })).to.equal(undefined);
  });

  it('loads the six new element entries only when their matching definitions load', async () => {
    for (const [tag, file] of files.slice(-6)) {
      const definition = findDocumentRenderer(file)!;
      const resolved = await loadDocumentRenderer(definition);
      expect(customElements.get(tag), `${tag} should upgrade after load`).to.exist;
      expect('render' in resolved && typeof resolved.render === 'function').to.equal(true);
    }
  });
});
