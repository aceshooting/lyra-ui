import { expect } from '@open-wc/testing';
import { render } from 'lit';
import './docx-viewer-register.js';
import { DOCX_VIEWER_TAG } from './docx-viewer-register.js';
import { findDocumentRenderer, loadDocumentRenderer, type DocumentFile } from '../document-viewer/registry.js';
import type { LyraHighlight } from '../document-viewer/anchors.js';

function fetchedModuleEnding(suffix: string): boolean {
  return performance.getEntriesByType('resource').some((entry) => entry.name.endsWith(suffix));
}

const docx: DocumentFile = {
  name: 'memo.docx',
  mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  src: 'https://example.test/memo.docx',
};

describe('docx-viewer-register laziness', () => {
  it('never fetches the docx-viewer class module merely by importing the register-only entry', () => {
    expect(fetchedModuleEnding('/docx-viewer.class.ts')).to.equal(false);
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
    expect(fetchedModuleEnding('/docx-viewer.class.ts')).to.equal(true);
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
  });
});
