import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import './document-viewer.js';
import '../xml-viewer/xml-viewer.js';
import { createDocumentRendererRegistry, type DocumentFile } from './registry.js';
import type { LyraDocumentViewer } from './document-viewer.js';
import type { LyraXmlViewer } from '../xml-viewer/xml-viewer.js';

const originalFetch = window.fetch;
const requestedUrls: string[] = [];
const xmlText = '<root><item>Routing control</item></root>';

beforeEach(() => {
  requestedUrls.length = 0;
  window.fetch = async (input) => {
    requestedUrls.push(input instanceof Request ? input.url : String(input));
    return new Response(xmlText, { headers: { 'Content-Type': 'application/xml' } });
  };
});

afterEach(() => {
  window.fetch = originalFetch;
});

async function renderedXml(viewer: LyraDocumentViewer): Promise<LyraXmlViewer> {
  await viewer.updateComplete;
  expect(viewer.shadowRoot!.querySelectorAll('lr-xml-viewer').length, 'the actual registered XML renderer is selected').to.equal(1);
  expect(viewer.shadowRoot!.querySelectorAll('lr-document-preview').length).to.equal(0);
  const xml = viewer.shadowRoot!.querySelector<LyraXmlViewer>('lr-xml-viewer')!;
  await waitUntil(() => xml.shadowRoot?.querySelector('[part="tag"]')?.textContent === 'root', 'the registered renderer loads and parses XML');
  return xml;
}

for (const mimeType of [
  'application/rss+xml; charset=utf-8',
  '  APPLICATION/ATOM+XML ; Charset=UTF-8  ',
  ' application/vnd.example+xml  ',
  'application/rss+xml',
  ' APPLICATION/XML ; charset=utf-8 ',
  ' text/xml; charset=utf-8 ',
]) {
  it(`routes an extensionless ${mimeType} file through the real XML registration`, async () => {
    const src = 'https://example.test/extensionless';
    const viewer = await fixture<LyraDocumentViewer>(html`<lr-document-viewer open
      name="extensionless" .mimeType=${mimeType} .src=${src}
    ></lr-document-viewer>`);
    const xml = await renderedXml(viewer);
    expect(xml.name).to.equal('extensionless');
    expect(xml.src).to.equal(src);
    expect(viewer.mimeType).to.equal(mimeType);
    expect(requestedUrls).to.deep.equal([src]);
  });
}

it('uses the original authoritative payload for a parameterized XML-suffix route', async () => {
  const file = {
    name: 'payload-document',
    mimeType: ' APPLICATION/RSS+XML ; charset=UTF-8 ',
    src: 'https://example.test/payload-document',
    anchor: { kind: 'node-path' as const, path: [0] },
    highlights: [{ id: 'item', anchor: { kind: 'node-path' as const, path: [0] } }],
    alt: 'Authored payload description',
  };
  const viewer = await fixture<LyraDocumentViewer>(html`<lr-document-viewer open
    name="ignored" mime-type="application/octet-stream" src="https://example.test/ignored"
    .payload=${{ kind: 'document', file }}
  ></lr-document-viewer>`);
  const xml = await renderedXml(viewer);
  expect(xml.name).to.equal(file.name);
  expect(xml.src).to.equal(file.src);
  expect(xml.anchor).to.deep.equal(file.anchor);
  expect(xml.highlights).to.deep.equal(file.highlights);
  expect(viewer.payload?.file).to.deep.equal(file);
  expect(requestedUrls).to.deep.equal([file.src]);
});

for (const source of ['scalar', 'payload'] as const) {
  it(`preserves exact-key precedence and the original ${source} file before the XML suffix/extension fallback`, async () => {
    const file: DocumentFile = {
      name: 'document.XML',
      mimeType: ' APPLICATION/RSS+XML ; charset=UTF-8 ',
      src: 'https://example.test/exact',
      anchor: { kind: 'node-path', path: [0] },
      highlights: [{ id: 'exact', anchor: { kind: 'node-path', path: [0] } }],
      alt: 'Exact renderer description',
    };
    let received: DocumentFile | undefined;
    const registry = new Map(createDocumentRendererRegistry());
    registry.set('application/rss+xml', {
      capabilities: { anchors: ['node-path'] },
      render: (value) => {
        received = value;
        return html`<p data-exact-renderer>Exact renderer</p>`;
      },
    });
    const viewer = await fixture<LyraDocumentViewer>(html`<lr-document-viewer
      .name=${source === 'scalar' ? file.name : 'ignored'}
      .mimeType=${source === 'scalar' ? file.mimeType : 'application/octet-stream'}
      .src=${source === 'scalar' ? file.src : 'https://example.test/ignored'}
      .anchor=${file.anchor} .highlights=${file.highlights} .alt=${file.alt}
      .payload=${source === 'payload' ? { kind: 'document', file } : undefined}
      .registry=${registry} open
    ></lr-document-viewer>`);
    await viewer.updateComplete;
    expect(viewer.shadowRoot!.querySelectorAll('[data-exact-renderer]').length).to.equal(1);
    expect(viewer.shadowRoot!.querySelectorAll('lr-xml-viewer').length).to.equal(0);
    expect(received).to.deep.equal(file);
    expect(requestedUrls).to.deep.equal([]);
  });
}

for (const extension of ['.XML', '.XSD', '.XSL', '.XSLT', '.RSS', '.ATOM']) {
  it(`preserves the existing ${extension} extension fallback with an unknown MIME essence`, async () => {
    const viewer = await fixture<LyraDocumentViewer>(html`<lr-document-viewer open
      .name=${`document${extension}`} mime-type="application/octet-stream; charset=utf-8"
      src="https://example.test/extension-control"
    ></lr-document-viewer>`);
    await renderedXml(viewer);
    expect(requestedUrls).to.deep.equal(['https://example.test/extension-control']);
  });
}

for (const mimeType of ['application/octet-stream', 'application/xmlish']) {
  it(`keeps unsupported extensionless ${mimeType} files on the existing preview fallback`, async () => {
    const viewer = await fixture<LyraDocumentViewer>(html`<lr-document-viewer open
      name="extensionless" .mimeType=${mimeType} src="https://example.test/unsupported"
    ></lr-document-viewer>`);
    await viewer.updateComplete;
    expect(viewer.shadowRoot!.querySelectorAll('lr-xml-viewer').length).to.equal(0);
    expect(viewer.shadowRoot!.querySelectorAll('lr-document-preview').length).to.equal(1);
    expect(requestedUrls).to.deep.equal([]);
  });
}

it('retains the XML renderer URL guard after parameterized suffix dispatch', async () => {
  const viewer = await fixture<LyraDocumentViewer>(html`<lr-document-viewer open
    name="extensionless" mime-type="application/rss+xml; charset=utf-8"
    src="javascript:void(0)"
  ></lr-document-viewer>`);
  await viewer.updateComplete;
  const xml = viewer.shadowRoot!.querySelector<LyraXmlViewer>('lr-xml-viewer');
  expect(xml !== null).to.equal(true);
  await waitUntil(() => xml!.shadowRoot?.querySelector('[part="error"]') != null, 'unsafe XML URL is visibly rejected');
  expect(requestedUrls).to.deep.equal([]);
});
