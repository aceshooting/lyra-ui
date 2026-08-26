import { expect } from '@open-wc/testing';
import { render } from 'lit';
import './ebook-viewer-register.js';
import { findDocumentRenderer, loadDocumentRenderer, type DocumentFile } from '../document-viewer/registry.js';

const file: DocumentFile = { name: 'book.epub', mimeType: 'application/epub+zip', src: 'https://example.test/book.epub' };

it('registers EPUB MIME and filename fallback renderers', async () => {
  expect(findDocumentRenderer(file)).to.exist;
  expect(findDocumentRenderer({ ...file, mimeType: 'application/octet-stream' })).to.exist;
  const definition = await loadDocumentRenderer(findDocumentRenderer(file)!);
  const host = document.createElement('div');
  render(definition.render!(file) as never, host);
  expect(host.querySelector('lr-ebook-viewer')).to.exist;
});

it('forwards registry anchors and highlights to the lazy ebook renderer', async () => {
  const anchor = { kind: 'cfi' as const, cfi: 'epubcfi(/6/2)' };
  const highlights = [{ id: 'chapter-note', anchor }];
  const definition = await loadDocumentRenderer(findDocumentRenderer(file)!);
  const host = document.createElement('div');
  render(definition.render!({ ...file, anchor, highlights }) as never, host);
  const viewer = host.querySelector('lr-ebook-viewer') as unknown as HTMLElement & {
    anchor: unknown;
    highlights: unknown[];
  };
  expect(viewer.anchor).to.deep.equal(anchor);
  expect(viewer.highlights).to.deep.equal(highlights);
});
