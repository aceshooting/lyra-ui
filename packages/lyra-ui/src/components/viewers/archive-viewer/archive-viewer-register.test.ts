import { expect } from '@open-wc/testing';
import { render } from 'lit';
import './archive-viewer-register.js';
import { findDocumentRenderer, loadDocumentRenderer, type DocumentFile } from '../document-viewer/registry.js';
import type { LyraHighlight } from '../document-viewer/anchors.js';
import type { LyraArchiveViewer } from './archive-viewer.js';

const zip: DocumentFile = { name: 'archive.zip', mimeType: 'application/zip', src: 'https://example.test/archive.zip' };
describe('archive registry', () => {
  it('registers standard, legacy, and extension dispatch', async () => {
    expect(findDocumentRenderer(zip)).to.exist;
    expect(findDocumentRenderer({ ...zip, mimeType: 'application/x-zip-compressed' })).to.exist;
    expect(findDocumentRenderer({ ...zip, mimeType: 'application/octet-stream' })).to.exist;
    expect(findDocumentRenderer({ ...zip, name: 'archive.tar', mimeType: 'application/x-tar' })).to.not.exist;
    const definition = await loadDocumentRenderer(findDocumentRenderer(zip)!);
    expect(definition.render).to.exist;
    const rendered = definition.render!(zip) as { strings?: string };
    expect(rendered).to.exist;
  });

  it('declares its anchor/search/text-select capabilities', () => {
    const definition = findDocumentRenderer(zip)!;
    expect(definition.capabilities).to.deep.equal({
      anchors: ['text-quote', 'fragment'],
      search: true,
      textSelect: true,
    });
  });

  it('forwards document anchors/highlights and advertises its text contracts', async () => {
    const highlights: LyraHighlight[] = [{ id: 'h1', anchor: { kind: 'text-quote', quote: 'Ada' } }];
    const anchor = { kind: 'fragment' as const, id: 'section-one' };
    const definition = await loadDocumentRenderer(findDocumentRenderer(zip)!);
    const host = document.createElement('div');
    render(definition.render!({ ...zip, anchor, highlights }) as never, host);
    const rendered = host.querySelector('lr-archive-viewer') as LyraArchiveViewer;
    expect(rendered.anchor).to.equal(anchor);
    expect(rendered.highlights).to.deep.equal(highlights);
  });
});
