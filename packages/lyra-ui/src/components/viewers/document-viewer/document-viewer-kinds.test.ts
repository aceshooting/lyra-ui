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
} from './document-viewer-kinds.js';
import { findDocumentRenderer, type DocumentFile } from './registry.js';

const files: readonly [tag: string, file: DocumentFile][] = [
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

  it('never fetches any of the eight heavy viewer class modules merely by importing the bundle', () => {
    for (const suffix of [
      '/archive-viewer.class.ts',
      '/ebook-viewer.class.ts',
      '/pdf-viewer.class.ts',
      '/docx-viewer.class.ts',
      '/pptx-viewer.class.ts',
      '/spreadsheet-viewer.class.ts',
      '/csv-viewer.class.ts',
      '/xml-viewer.class.ts',
    ]) {
      expect(fetchedModuleEnding(suffix), `the bundle must not eagerly fetch ${suffix}`).to.equal(false);
    }
  });
});
