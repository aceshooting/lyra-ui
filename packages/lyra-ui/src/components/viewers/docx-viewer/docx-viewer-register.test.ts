import { expect } from '@open-wc/testing';
import { render } from 'lit';
import './docx-viewer-register.js';
import { DOCX_VIEWER_TAG } from './docx-viewer-register.js';
import { findDocumentRenderer, loadDocumentRenderer, type LyraDocumentFile } from '../document-viewer/registry.js';
import type { LyraHighlight } from '../../../internal/document-anchors.js';
import { fetchedModule } from '../../../../test/resource-entries.js';

const docx: LyraDocumentFile = {
  name: 'memo.docx',
  mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  src: 'https://example.test/memo.docx',
};

describe('docx-viewer-register laziness', () => {
  it('never fetches the docx-viewer class module merely by importing the register-only entry', () => {
    expect(fetchedModule('/docx-viewer.class.ts', { control: '/docx-viewer-register.ts' })).to.equal(false);
    expect(customElements.get(DOCX_VIEWER_TAG)).to.equal(undefined);
  });

  it('exposes a stable tag constant matching the real element tag name', () => {
    expect(DOCX_VIEWER_TAG).to.equal('lr-docx-viewer');
  });
});

describe('docx registry', () => {
  it('matches by extension and declares capabilities', () => {
    expect(findDocumentRenderer(docx)).to.exist;
    expect(findDocumentRenderer(docx)!.capabilities).to.deep.equal({
      anchors: ['fragment', 'text-quote'],
      search: true,
      textSelect: true,
    });
  });

  it('loads (fetching the class module lazily) and renders the tag, registering it', async () => {
    const definition = await loadDocumentRenderer(findDocumentRenderer(docx)!);
    expect(fetchedModule('/docx-viewer.class.ts')).to.equal(true);
    expect(customElements.get(DOCX_VIEWER_TAG)).to.not.equal(undefined);

    const highlights: LyraHighlight[] = [{ id: 'h1', anchor: { kind: 'text-quote', quote: 'Ada' } }];
    const anchor = { kind: 'fragment' as const, id: 'section-one' };
    const host = document.createElement('div');
    render(definition.render!({ ...docx, anchor, highlights }) as never, host);
    const rendered = host.querySelector(DOCX_VIEWER_TAG) as unknown as {
      anchor: unknown;
      highlights: unknown;
    };
    expect(rendered).to.exist;
    expect(rendered.anchor).to.deep.equal(anchor);
    expect(rendered.highlights).to.deep.equal(highlights);
    // The lazy definition (not the eager one the loaded module re-registers) falls back to a null
    // anchor and an empty highlight list for a file that carries neither.
    const bare = document.createElement('div');
    render(definition.render!(docx) as never, bare);
    const fallback = bare.querySelector(DOCX_VIEWER_TAG) as unknown as { anchor: unknown; highlights: unknown };
    expect(fallback.anchor).to.equal(null);
    expect(fallback.highlights).to.deep.equal([]);
  });
});
