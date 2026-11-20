import { expect } from '@open-wc/testing';
import { render } from 'lit';
import './pdf-viewer-register.js';
import { PDF_VIEWER_TAG } from './pdf-viewer-register.js';
import { findDocumentRenderer, loadDocumentRenderer, type LyraDocumentFile } from '../document-viewer/registry.js';
import type { LyraHighlight } from '../document-viewer/anchors.js';
import { fetchedModule } from '../../../../test/resource-entries.js';

const pdf: LyraDocumentFile = { name: 'report.pdf', mimeType: 'application/pdf', src: 'https://example.test/report.pdf' };

describe('pdf-viewer-register laziness', () => {
  it('never fetches the pdf-viewer class module merely by importing the register-only entry', () => {
    expect(
      fetchedModule('/pdf-viewer.class.ts', { control: '/pdf-viewer-register.ts' }),
      'importing pdf-viewer-register.js alone must not pull in pdf-viewer.class.ts',
    ).to.equal(false);
    expect(customElements.get(PDF_VIEWER_TAG), 'the element must stay unregistered').to.equal(undefined);
  });

  it('exposes a stable tag constant matching the real element tag name', () => {
    expect(PDF_VIEWER_TAG).to.equal('lr-pdf-viewer');
  });
});

describe('pdf registry', () => {
  it('matches by extension and declares capabilities', () => {
    expect(findDocumentRenderer(pdf)).to.exist;
    expect(findDocumentRenderer(pdf)!.capabilities).to.deep.equal({
      anchors: ['page', 'text-quote', 'region'],
      textSelect: true,
      search: true,
    });
  });

  it('loads (fetching the class module lazily) and renders the tag, registering it', async () => {
    const definition = await loadDocumentRenderer(findDocumentRenderer(pdf)!);
    expect(fetchedModule('/pdf-viewer.class.ts'), 'loading must now fetch the class module').to.equal(
      true,
    );
    expect(customElements.get(PDF_VIEWER_TAG)).to.not.equal(undefined);

    const highlights: LyraHighlight[] = [{ id: 'h1', anchor: { kind: 'text-quote', quote: 'Ada' } }];
    const anchor = { kind: 'page' as const, page: 3 };
    const host = document.createElement('div');
    render(definition.render!({ ...pdf, anchor, highlights }) as never, host);
    const rendered = host.querySelector(PDF_VIEWER_TAG) as unknown as {
      anchor: unknown;
      highlights: unknown;
    };
    expect(rendered).to.exist;
    expect(rendered.anchor).to.deep.equal(anchor);
    expect(rendered.highlights).to.deep.equal(highlights);
    // The lazy definition (not the eager one the loaded module re-registers) falls back to a null
    // anchor and an empty highlight list for a file that carries neither.
    const bare = document.createElement('div');
    render(definition.render!(pdf) as never, bare);
    const fallback = bare.querySelector(PDF_VIEWER_TAG) as unknown as { anchor: unknown; highlights: unknown };
    expect(fallback.anchor).to.equal(null);
    expect(fallback.highlights).to.deep.equal([]);
  });
});
