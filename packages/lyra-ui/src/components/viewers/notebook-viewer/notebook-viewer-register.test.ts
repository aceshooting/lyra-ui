import { expect } from '@open-wc/testing';
import { render } from 'lit';
import { NOTEBOOK_VIEWER_TAG } from './notebook-viewer-register.js';
import { findDocumentRenderer, loadDocumentRenderer, type LyraDocumentFile } from '../document-viewer/registry.js';

const file: LyraDocumentFile = {
  name: 'analysis.ipynb',
  mimeType: 'application/x-ipynb+json',
  src: 'https://example.test/analysis.ipynb',
};

describe('notebook-viewer-register', () => {
  it('registers the notebook kind lazily, by MIME type and by filename, with its capabilities', () => {
    expect(NOTEBOOK_VIEWER_TAG).to.equal('lr-notebook-viewer');
    expect(customElements.get(NOTEBOOK_VIEWER_TAG)).to.equal(undefined);
    expect(findDocumentRenderer({ ...file, mimeType: 'application/octet-stream' })).to.exist;
    expect(findDocumentRenderer(file)!.capabilities).to.deep.equal({
      anchors: ['node-path', 'fragment'],
      search: true,
    });
  });

  it('loads the element and renders it with the file, anchor and highlights', async () => {
    const anchor = { kind: 'fragment' as const, id: 'cell-1' };
    const highlights = [{ id: 'note', anchor }];
    const definition = await loadDocumentRenderer(findDocumentRenderer(file)!);
    expect(customElements.get(NOTEBOOK_VIEWER_TAG)).to.exist;
    const host = document.createElement('div');
    render(definition.render!({ ...file, anchor, highlights }) as never, host);
    const viewer = host.querySelector(NOTEBOOK_VIEWER_TAG) as unknown as HTMLElement & {
      src: string;
      anchor: unknown;
      highlights: unknown[];
    };
    expect(viewer.src).to.equal(file.src);
    expect(viewer.anchor).to.deep.equal(anchor);
    expect(viewer.highlights).to.deep.equal(highlights);
  });
});
