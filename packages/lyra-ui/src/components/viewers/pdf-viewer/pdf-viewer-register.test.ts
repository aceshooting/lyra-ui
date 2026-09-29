import { expect } from '@open-wc/testing';
import { render } from 'lit';
import './pdf-viewer-register.js';
import { PDF_VIEWER_TAG } from './pdf-viewer-register.js';
import { findDocumentRenderer, loadDocumentRenderer, type DocumentFile } from '../document-viewer/registry.js';
import type { LyraHighlight } from '../document-viewer/anchors.js';

/** True once the browser has actually fetched a module whose URL ends with `suffix` -- the
 *  reliable proxy for "reached by the static import graph" under `@web/test-runner`'s unbundled
 *  ESM serving (mirrors `toaster.test.ts`'s identical helper). */
function fetchedModuleEnding(suffix: string): boolean {
  return performance.getEntriesByType('resource').some((entry) => entry.name.endsWith(suffix));
}

const pdf: DocumentFile = { name: 'report.pdf', mimeType: 'application/pdf', src: 'https://example.test/report.pdf' };

describe('pdf-viewer-register laziness', () => {
  it('never fetches the pdf-viewer class module merely by importing the register-only entry', () => {
    expect(
      fetchedModuleEnding('/pdf-viewer.class.ts'),
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
    expect(fetchedModuleEnding('/pdf-viewer.class.ts'), 'loading must now fetch the class module').to.equal(
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
  });
});
