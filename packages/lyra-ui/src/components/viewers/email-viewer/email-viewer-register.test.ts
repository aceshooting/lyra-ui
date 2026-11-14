import { expect } from '@open-wc/testing';
import { render } from 'lit';
import { EMAIL_VIEWER_TAG } from './email-viewer-register.js';
import { findDocumentRenderer, loadDocumentRenderer, type LyraDocumentFile } from '../document-viewer/registry.js';
import type { LyraHighlight } from '../document-viewer/anchors.js';

const eml: LyraDocumentFile = { name: 'Thread.EML', mimeType: 'application/octet-stream', src: 'https://example.test/thread.eml' };

describe('email-viewer-register', () => {
  it('matches .eml files case-insensitively and declares its anchor capabilities', () => {
    expect(EMAIL_VIEWER_TAG).to.equal('lr-email-viewer');
    expect(findDocumentRenderer(eml)!.capabilities).to.deep.equal({
      anchors: ['text-quote', 'fragment'],
      search: true,
      textSelect: true,
    });
  });

  it('loads the element and forwards the file anchor and highlights', async () => {
    const definition = await loadDocumentRenderer(findDocumentRenderer(eml)!);
    expect(customElements.get(EMAIL_VIEWER_TAG)).to.not.equal(undefined);
    const anchor = { kind: 'text-quote' as const, quote: 'Hello' };
    const highlights: LyraHighlight[] = [{ id: 'h1', anchor }];
    const host = document.createElement('div');
    render(definition.render!({ ...eml, anchor, highlights }) as never, host);
    const rendered = host.querySelector(EMAIL_VIEWER_TAG) as unknown as { src: string; anchor: unknown; highlights: unknown };
    expect(rendered.src).to.equal(eml.src);
    expect(rendered.anchor).to.deep.equal(anchor);
    expect(rendered.highlights).to.deep.equal(highlights);
  });

  it('renders a file with no anchor or highlights as a null anchor and an empty highlight list', async () => {
    const definition = await loadDocumentRenderer(findDocumentRenderer(eml)!);
    const host = document.createElement('div');
    render(definition.render!(eml) as never, host);
    const rendered = host.querySelector(EMAIL_VIEWER_TAG) as unknown as { anchor: unknown; highlights: unknown };
    expect(rendered.anchor).to.equal(null);
    expect(rendered.highlights).to.deep.equal([]);
  });
});
