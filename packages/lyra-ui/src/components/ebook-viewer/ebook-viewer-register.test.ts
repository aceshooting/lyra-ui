import { expect } from '@open-wc/testing';
import { html, render } from 'lit';
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
