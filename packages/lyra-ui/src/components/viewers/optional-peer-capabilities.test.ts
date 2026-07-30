import { expect } from '@open-wc/testing';
import { loadArchiveLibrary } from './archive-viewer/archive-loader.js';
import { loadIcalDeps } from './calendar-viewer/calendar-loader.js';
import { loadMammothAndSanitizer } from './docx-viewer/docx-loader.js';
import { loadEpubJs } from './ebook-viewer/ebook-loader.js';
import { loadEmailAndSanitizer } from './email-viewer/email-loader.js';
import { loadHtmlSanitizerDeps } from './html-viewer/dompurify-loader.js';
import { loadNotebookSanitizerDeps } from './notebook-viewer/dompurify-loader.js';
import { loadPdfJsDeps } from './pdf-viewer/pdf-loader.js';
import { loadSheetJs } from './spreadsheet-viewer/spreadsheet-loader.js';
import { loadSvgSanitizerDeps } from './svg-viewer/dompurify-loader.js';

describe('viewer optional-peer capability validation', () => {
  it('rejects malformed parser, renderer, and sanitizer module shapes', async () => {
    expect(await loadArchiveLibrary(async () => ({}) as never)).to.equal(null);
    expect(await loadIcalDeps(async () => ({}) as never)).to.equal(null);
    expect(await loadEpubJs(async () => ({}) as never)).to.equal(null);
    expect(await loadHtmlSanitizerDeps(async () => ({}) as never)).to.equal(null);
    expect(await loadNotebookSanitizerDeps(async () => ({}) as never)).to.equal(null);
    expect(await loadPdfJsDeps(async () => ({ GlobalWorkerOptions: {} }) as never)).to.equal(null);
    expect(await loadSheetJs(async () => ({}) as never)).to.equal(null);
    expect(await loadSvgSanitizerDeps(async () => ({}) as never)).to.equal(null);
  });

  it('rejects malformed members independently for combined peer loaders', async () => {
    const docx = await loadMammothAndSanitizer(
      async () => ({}) as never,
      async () => ({}) as never,
    );
    expect(docx.mammoth).to.equal(undefined);
    expect(docx.DOMPurify).to.equal(undefined);

    const email = await loadEmailAndSanitizer(
      async () => ({}) as never,
      async () => ({}) as never,
    );
    expect(email.PostalMime).to.equal(undefined);
    expect(email.DOMPurify).to.equal(undefined);
  });
});
