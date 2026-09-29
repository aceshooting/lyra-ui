import { expect } from '@open-wc/testing';
import { render } from 'lit';
import './xml-viewer-register.js';
import { XML_VIEWER_TAG } from './xml-viewer-register.js';
import { findDocumentRenderer, loadDocumentRenderer, type DocumentFile } from '../document-viewer/registry.js';

function fetchedModuleEnding(suffix: string): boolean {
  return performance.getEntriesByType('resource').some((entry) => entry.name.endsWith(suffix));
}

const xml: DocumentFile = { name: 'data.xml', mimeType: 'application/xml', src: 'https://example.test/data.xml' };
const rss: DocumentFile = { name: 'feed.rss', mimeType: 'application/octet-stream', src: 'https://example.test/feed.rss' };

describe('xml-viewer-register laziness', () => {
  it('never fetches the xml-viewer class module merely by importing the register-only entry', () => {
    expect(fetchedModuleEnding('/xml-viewer.class.ts')).to.equal(false);
    expect(customElements.get(XML_VIEWER_TAG)).to.equal(undefined);
  });

  it('exposes a stable tag constant matching the real element tag name', () => {
    expect(XML_VIEWER_TAG).to.equal('lr-xml-viewer');
  });
});

describe('xml registry', () => {
  it('matches by MIME essence, +xml suffix, and known extensions, and declares capabilities', () => {
    expect(findDocumentRenderer(xml)).to.exist;
    expect(findDocumentRenderer({ ...xml, mimeType: 'text/xml' })).to.exist;
    expect(findDocumentRenderer({ ...xml, mimeType: 'application/atom+xml' })).to.exist;
    expect(findDocumentRenderer(rss)).to.exist;
    expect(findDocumentRenderer(xml)!.capabilities).to.deep.equal({
      anchors: ['node-path'],
      search: true,
    });
  });

  it('loads (fetching the class module lazily) and renders the tag, registering it', async () => {
    const definition = await loadDocumentRenderer(findDocumentRenderer(xml)!);
    expect(fetchedModuleEnding('/xml-viewer.class.ts')).to.equal(true);
    expect(customElements.get(XML_VIEWER_TAG)).to.not.equal(undefined);

    const anchor = { kind: 'node-path' as const, path: ['root', 0, 'child'] };
    const host = document.createElement('div');
    render(definition.render!({ ...xml, anchor }) as never, host);
    const rendered = host.querySelector(XML_VIEWER_TAG) as unknown as { anchor: unknown };
    expect(rendered).to.exist;
    expect(rendered.anchor).to.deep.equal(anchor);
  });
});
