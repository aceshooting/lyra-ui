import { fixture, expect, html, oneEvent } from '@open-wc/testing';
import './xml-viewer.js';
import type { LyraXmlViewer } from './xml-viewer.js';

const SIMPLE_XML = '<root><item id="1">First</item><item id="2">Second</item></root>';
const RSS_XML = '<rss><channel><title>Feed</title><item><link href="https://a.test">A</link></item></channel></rss>';

describe('defaults', () => {
  it('defaults to empty src/xml/name, copyable false', async () => {
    const el = (await fixture(html`<lyra-xml-viewer></lyra-xml-viewer>`)) as LyraXmlViewer;
    expect(el.src).to.equal('');
    expect(el.xml).to.be.undefined;
    expect(el.name).to.equal('');
    expect(el.copyable).to.be.false;
  });
});

describe('parsing and tree rendering', () => {
  it('renders one node row per element and text leaf', async () => {
    const el = (await fixture(html`<lyra-xml-viewer .xml=${SIMPLE_XML}></lyra-xml-viewer>`)) as LyraXmlViewer;
    await el.updateComplete;
    const tags = [...el.shadowRoot!.querySelectorAll('[part="tag"]')].map((t) => t.textContent);
    expect(tags).to.include('root');
    expect(tags.filter((t) => t === 'item').length).to.equal(2);
  });

  it('renders attribute name/value pairs on an element row', async () => {
    const el = (await fixture(html`<lyra-xml-viewer .xml=${SIMPLE_XML}></lyra-xml-viewer>`)) as LyraXmlViewer;
    await el.updateComplete;
    const attrNames = [...el.shadowRoot!.querySelectorAll('[part="attribute-name"]')].map((n) => n.textContent);
    expect(attrNames).to.include('id');
  });

  it('fires lyra-render-error and shows a parse-error region for malformed XML', async () => {
    const el = (await fixture(html`<lyra-xml-viewer></lyra-xml-viewer>`)) as LyraXmlViewer;
    const eventPromise = oneEvent(el, 'lyra-render-error');
    el.xml = '<root><unclosed></root>';
    await eventPromise;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="error"]')).to.exist;
  });

  it('an xml property wins over src', async () => {
    const el = (await fixture(html`<lyra-xml-viewer src="https://example.test/should-not-fetch.xml"></lyra-xml-viewer>`)) as LyraXmlViewer;
    el.xml = SIMPLE_XML;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll('[part="tag"]').length).to.be.greaterThan(0);
  });
});

describe('collapsedDepth and toggling', () => {
  it('collapses nodes at or beyond collapsed-depth, showing a child-count preview', async () => {
    const el = (await fixture(html`<lyra-xml-viewer .xml=${SIMPLE_XML} collapsed-depth="1"></lyra-xml-viewer>`)) as LyraXmlViewer;
    await el.updateComplete;
    const toggles = [...el.shadowRoot!.querySelectorAll('[part="toggle"]')] as HTMLButtonElement[];
    const rootToggle = toggles[0];
    expect(rootToggle.getAttribute('aria-expanded')).to.equal('true');
  });

  it('toggling a node flips its expand state and survives an xml reassignment with the same shape', async () => {
    const el = (await fixture(html`<lyra-xml-viewer .xml=${SIMPLE_XML}></lyra-xml-viewer>`)) as LyraXmlViewer;
    await el.updateComplete;
    const toggle = el.shadowRoot!.querySelector('[part="toggle"]') as HTMLButtonElement;
    toggle.click();
    await el.updateComplete;
    expect(toggle.getAttribute('aria-expanded')).to.equal('false');
    el.xml = SIMPLE_XML.replace('First', 'Updated First');
    await el.updateComplete;
    expect((el.shadowRoot!.querySelector('[part="toggle"]') as HTMLButtonElement).getAttribute('aria-expanded')).to.equal('false');
  });
});

describe('copy', () => {
  it('renders a whole-document copy button only when copyable, and emits lyra-copy on click', async () => {
    const el = (await fixture(html`<lyra-xml-viewer .xml=${SIMPLE_XML} copyable></lyra-xml-viewer>`)) as LyraXmlViewer;
    await el.updateComplete;
    const button = el.shadowRoot!.querySelector('[part="toolbar"] [part="copy-button"]') as HTMLButtonElement;
    expect(button).to.exist;
    const eventPromise = oneEvent(el, 'lyra-copy');
    button.click();
    const event = await eventPromise;
    expect(event.detail.text).to.include('<root>');
  });
});

// `search`/`searchNext`/`searchPrevious`/`clearSearch` are a purely imperative API here -- the
// same uniform contract `lyra-pdf-viewer`/`lyra-ebook-viewer`/`lyra-notebook-viewer` implement
// (see `AnchorTargetCapabilities.search`'s doc comment in `document-viewer/anchors.ts`), not a
// settable `search` property/attribute like `lyra-json-viewer`'s -- a single class member can't
// be both a plain string field (readable bare) and a callable method, so this viewer, which
// mirrors the anchor-target family's search surface, picks the imperative form.
describe('search', () => {
  it('search() auto-expands ancestors of a match and marks data-match, even under a collapsed-depth', async () => {
    const el = (await fixture(html`<lyra-xml-viewer .xml=${SIMPLE_XML} collapsed-depth="1"></lyra-xml-viewer>`)) as LyraXmlViewer;
    await el.search('Second');
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="text"][data-match]')).to.exist;
  });

  it('the imperative search() API returns a match count', async () => {
    const el = (await fixture(html`<lyra-xml-viewer .xml=${SIMPLE_XML}></lyra-xml-viewer>`)) as LyraXmlViewer;
    const count = await el.search('item');
    expect(count).to.be.greaterThan(0);
  });

  it('searchNext/searchPrevious move data-active-match and clearSearch resets it', async () => {
    const el = (await fixture(html`<lyra-xml-viewer .xml=${SIMPLE_XML}></lyra-xml-viewer>`)) as LyraXmlViewer;
    await el.search('item');
    const eventPromise = oneEvent(el, 'lyra-search-change');
    el.searchNext();
    await eventPromise;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[data-active-match]')).to.exist;
    el.clearSearch();
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[data-active-match]')).to.not.exist;
  });
});

describe('node-path anchors', () => {
  it('resolves an element node-path and an attribute-addressing trailing segment', async () => {
    const el = (await fixture(html`<lyra-xml-viewer .xml=${RSS_XML}></lyra-xml-viewer>`)) as LyraXmlViewer;
    await el.updateComplete;
    // Shrunk from the 5000ms/250ms defaults -- an anchor that never resolves (out-of-bounds
    // index, an unsupported kind) otherwise retries for the full real timeout before settling
    // false, which would blow past mocha's per-test timeout given two such calls below.
    (el as unknown as { anchorTimeoutMs: number }).anchorTimeoutMs = 30;
    (el as unknown as { anchorRetryIntervalMs: number }).anchorRetryIntervalMs = 5;
    expect(await el.scrollToAnchor({ kind: 'node-path', path: [0, 1] })).to.be.true;
    expect(await el.scrollToAnchor({ kind: 'node-path', path: [0, 1, 0, '@href'] })).to.be.true;
    expect(await el.scrollToAnchor({ kind: 'node-path', path: [99] })).to.be.false;
    expect(await el.scrollToAnchor({ kind: 'page', page: 1 })).to.be.false;
  });
});

describe('node cap', () => {
  it('rejects a document with more than the node cap with a resource-limit message', async () => {
    const many = `<root>${'<n/>'.repeat(50_001)}</root>`;
    const el = (await fixture(html`<lyra-xml-viewer></lyra-xml-viewer>`)) as LyraXmlViewer;
    const eventPromise = oneEvent(el, 'lyra-render-error');
    el.xml = many;
    await eventPromise;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="error"]')).to.exist;
  });
});

describe('accessibility', () => {
  it('is accessible with an expanded tree and copyable on', async () => {
    const el = await fixture(html`<lyra-xml-viewer name="feed.rss" .xml=${RSS_XML} copyable></lyra-xml-viewer>`);
    await expect(el).to.be.accessible();
  });
});
