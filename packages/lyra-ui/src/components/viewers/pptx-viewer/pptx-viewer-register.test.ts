import { expect } from '@open-wc/testing';
import { render } from 'lit';
import './pptx-viewer-register.js';
import { PPTX_VIEWER_TAG } from './pptx-viewer-register.js';
import { findDocumentRenderer, loadDocumentRenderer, type LyraDocumentFile } from '../document-viewer/registry.js';
import type { LyraHighlight } from '../../../internal/document-anchors.js';
import { fetchedModule } from '../../../../test/resource-entries.js';

const pptx: LyraDocumentFile = {
  name: 'deck.pptx',
  mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  src: 'https://example.test/deck.pptx',
};

describe('pptx-viewer-register laziness', () => {
  it('never fetches the pptx-viewer class module merely by importing the register-only entry', () => {
    expect(fetchedModule('/pptx-viewer.class.ts', { control: '/pptx-viewer-register.ts' })).to.equal(false);
    expect(customElements.get(PPTX_VIEWER_TAG)).to.equal(undefined);
  });

  it('exposes a stable tag constant matching the real element tag name', () => {
    expect(PPTX_VIEWER_TAG).to.equal('lr-pptx-viewer');
  });
});

describe('pptx registry', () => {
  it('matches by extension and declares capabilities', () => {
    expect(findDocumentRenderer(pptx)).to.exist;
    expect(findDocumentRenderer(pptx)!.capabilities).to.deep.equal({
      anchors: ['text-quote', 'fragment', 'page'],
      search: true,
      textSelect: true,
    });
  });

  it('loads (fetching the class module lazily) and renders the tag, registering it', async () => {
    const definition = await loadDocumentRenderer(findDocumentRenderer(pptx)!);
    expect(fetchedModule('/pptx-viewer.class.ts')).to.equal(true);
    expect(customElements.get(PPTX_VIEWER_TAG)).to.not.equal(undefined);

    const highlights: LyraHighlight[] = [{ id: 'h1', anchor: { kind: 'text-quote', quote: 'Ada' } }];
    const anchor = { kind: 'fragment' as const, id: 'slide-two' };
    const host = document.createElement('div');
    render(definition.render!({ ...pptx, anchor, highlights }) as never, host);
    const rendered = host.querySelector(PPTX_VIEWER_TAG) as unknown as {
      anchor: unknown;
      highlights: unknown;
    };
    expect(rendered).to.exist;
    expect(rendered.anchor).to.deep.equal(anchor);
    expect(rendered.highlights).to.deep.equal(highlights);
  });
});
