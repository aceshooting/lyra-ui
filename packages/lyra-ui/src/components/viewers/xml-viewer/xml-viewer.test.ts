import { fixture, expect, html, oneEvent, waitUntil } from '@open-wc/testing';
import './xml-viewer.js';
import type { LyraXmlViewer } from './xml-viewer.js';
import { registerLyraLocale } from '../../../internal/localization.js';
import { DEFAULT_MAX_RESOURCE_BYTES } from '../../../internal/resource-loader.js';
import { styles } from './xml-viewer.styles.js';

const SIMPLE_XML = '<root><item id="1">First</item><item id="2">Second</item></root>';
const RSS_XML = '<rss><channel><title>Feed</title><item><link href="https://a.test">A</link></item></channel></rss>';

/** Stubs `window.fetch` for the duration of one test, restoring the original afterward --
 *  mirrors `document-preview.test.ts`'s helper of the same name. */
function stubFetch(impl: (url: string, init?: RequestInit) => Promise<Response>): () => void {
  const original = window.fetch;
  window.fetch = ((url: string, init?: RequestInit) => impl(url, init)) as typeof window.fetch;
  return () => {
    window.fetch = original;
  };
}

function textResponse(body: string, ok = true, status = 200): Response {
  return {
    ok,
    status,
    statusText: ok ? 'OK' : 'Not Found',
    headers: { get: () => null },
    text: () => Promise.resolve(body),
  } as unknown as Response;
}

describe('defaults', () => {
  it('defaults to empty src/xml/name, copyable false', async () => {
    const el = (await fixture(html`<lr-xml-viewer></lr-xml-viewer>`)) as LyraXmlViewer;
    expect(el.src).to.equal('');
    expect(el.xml).to.be.undefined;
    expect(el.name).to.equal('');
    expect(el.copyable).to.be.false;
  });
});

describe('parsing and tree rendering', () => {
  it('renders one node row per element and text leaf', async () => {
    const el = (await fixture(html`<lr-xml-viewer .xml=${SIMPLE_XML}></lr-xml-viewer>`)) as LyraXmlViewer;
    await el.updateComplete;
    const tags = [...el.shadowRoot!.querySelectorAll('[part="tag"]')].map((t) => t.textContent);
    expect(tags).to.include('root');
    expect(tags.filter((t) => t === 'item').length).to.equal(2);
  });

  it('renders attribute name/value pairs on an element row', async () => {
    const el = (await fixture(html`<lr-xml-viewer .xml=${SIMPLE_XML}></lr-xml-viewer>`)) as LyraXmlViewer;
    await el.updateComplete;
    const attrNames = [...el.shadowRoot!.querySelectorAll('[part="attribute-name"]')].map((n) => n.textContent);
    expect(attrNames).to.include('id');
  });

  it('fires lr-render-error and shows a parse-error region for malformed XML', async () => {
    const el = (await fixture(html`<lr-xml-viewer></lr-xml-viewer>`)) as LyraXmlViewer;
    const eventPromise = oneEvent(el, 'lr-render-error');
    el.xml = '<root><unclosed></root>';
    await eventPromise;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll('[part="error"]').length).to.equal(1);
  });

  it('renders the stable localized parse-error message, never the raw browser-engine parser diagnostic glued onto it', async () => {
    const el = (await fixture(html`<lr-xml-viewer></lr-xml-viewer>`)) as LyraXmlViewer;
    const eventPromise = oneEvent(el, 'lr-render-error');
    el.xml = '<root><unclosed></root>';
    await eventPromise;
    await el.updateComplete;
    // Exact-equality (not just "contains the localized text") is the point: the raw,
    // engine-dependent <parsererror> diagnostic (Chrome/Firefox/Safari each word this
    // completely differently) must never be appended to the stable localized message.
    expect(el.shadowRoot!.querySelector('[part="error"]')!.textContent).to.equal('This document could not be parsed as XML.');
  });

  it('an xml property wins over src', async () => {
    const el = (await fixture(html`<lr-xml-viewer src="https://example.test/should-not-fetch.xml"></lr-xml-viewer>`)) as LyraXmlViewer;
    el.xml = SIMPLE_XML;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll('[part="tag"]').length).to.be.greaterThan(0);
  });

  it('the deferred src-load no-ops once an xml assignment already won, without ever fetching', async () => {
    const el = (await fixture(html`<lr-xml-viewer src="https://example.test/should-not-fetch.xml"></lr-xml-viewer>`)) as LyraXmlViewer;
    let fetchCalled = false;
    const restore = stubFetch(() => {
      fetchCalled = true;
      return Promise.reject(new Error('unexpected fetch'));
    });
    try {
      el.xml = SIMPLE_XML;
      // Directly re-invokes the same private method scheduleAfterUpdate()'s queued microtask
      // would call, deterministically exercising the "a synchronous xml assignment already won"
      // guard instead of racing that microtask's actual timing (see loadFromSrc()'s doc comment).
      await (el as unknown as { loadFromSrc(): Promise<void> }).loadFromSrc();
      expect(fetchCalled).to.be.false;
      expect(el.shadowRoot!.querySelectorAll('[part="tag"]').length).to.be.greaterThan(0);
    } finally {
      restore();
    }
  });

  it('handles a synchronous DOMParser throw with the same error state as a parser-reported error', async () => {
    const original = DOMParser.prototype.parseFromString;
    DOMParser.prototype.parseFromString = function (): never {
      throw new Error('boom');
    };
    try {
      const el = (await fixture(html`<lr-xml-viewer></lr-xml-viewer>`)) as LyraXmlViewer;
      const eventPromise = oneEvent(el, 'lr-render-error');
      el.xml = SIMPLE_XML;
      const event = await eventPromise;
      await el.updateComplete;
      expect(el.shadowRoot!.querySelector('[part="error"]')!.textContent).to.equal('This document could not be parsed as XML.');
      expect(event.detail.error).to.exist;
    } finally {
      DOMParser.prototype.parseFromString = original;
    }
  });
});

describe('loading xml via src', () => {
  it('fetches, parses, and renders a document reached via src', async () => {
    const restore = stubFetch(async () => textResponse(SIMPLE_XML));
    try {
      const el = (await fixture(html`<lr-xml-viewer src="https://example.test/doc.xml"></lr-xml-viewer>`)) as LyraXmlViewer;
      await waitUntil(() => el.shadowRoot!.querySelector('[part="tree"]') !== null);
      const tags = [...el.shadowRoot!.querySelectorAll('[part="tag"]')].map((t) => t.textContent);
      expect(tags).to.include('root');
    } finally {
      restore();
    }
  });

  it('reports a generic failure message for a non-OK HTTP response', async () => {
    const restore = stubFetch(async () => textResponse('', false, 404));
    try {
      // Mounted without src first so the lr-render-error listener attaches before the load that
      // src= triggers -- setting src straight in the fixture markup risks the whole (stubbed,
      // fast-resolving) fetch settling during fixture()'s own await, before oneEvent() ever runs.
      const el = (await fixture(html`<lr-xml-viewer></lr-xml-viewer>`)) as LyraXmlViewer;
      const eventPromise = oneEvent(el, 'lr-render-error');
      el.src = 'https://example.test/missing.xml';
      await waitUntil(() => el.shadowRoot!.querySelector('[part="error"]') !== null);
      expect(el.shadowRoot!.querySelector('[part="error"]')!.textContent).to.equal('Failed to load document.');
      expect((await eventPromise).detail.error).to.exist;
    } finally {
      restore();
    }
  });

  it('reports a distinct message when the response exceeds the resource size limit', async () => {
    const restore = stubFetch(
      async () =>
        ({
          ok: true,
          status: 200,
          statusText: 'OK',
          headers: { get: (name: string) => (name.toLowerCase() === 'content-length' ? String(DEFAULT_MAX_RESOURCE_BYTES + 1) : null) },
          text: () => Promise.resolve(''),
        }) as unknown as Response,
    );
    try {
      const el = (await fixture(html`<lr-xml-viewer src="https://example.test/huge.xml"></lr-xml-viewer>`)) as LyraXmlViewer;
      await waitUntil(() => el.shadowRoot!.querySelector('[part="error"]') !== null);
      expect(el.shadowRoot!.querySelector('[part="error"]')!.textContent).to.equal('This document is too large to preview.');
    } finally {
      restore();
    }
  });

  it('rejects a disallowed src URL without ever fetching', async () => {
    let called = false;
    const restore = stubFetch(async () => {
      called = true;
      return textResponse('');
    });
    try {
      const el = (await fixture(html`<lr-xml-viewer src="javascript:alert(1)"></lr-xml-viewer>`)) as LyraXmlViewer;
      await waitUntil(() => el.shadowRoot!.querySelector('[part="error"]') !== null);
      expect(called).to.be.false;
      expect(el.shadowRoot!.querySelector('[part="error"]')!.textContent).to.equal('Document URL is not allowed.');
    } finally {
      restore();
    }
  });
});

describe('collapsedDepth and toggling', () => {
  it('collapses nodes at or beyond collapsed-depth, showing a child-count preview', async () => {
    const el = (await fixture(html`<lr-xml-viewer .xml=${SIMPLE_XML} collapsed-depth="1"></lr-xml-viewer>`)) as LyraXmlViewer;
    await el.updateComplete;
    const toggles = [...el.shadowRoot!.querySelectorAll('[part="toggle"]')] as HTMLButtonElement[];
    const rootToggle = toggles[0];
    expect(rootToggle.getAttribute('aria-expanded')).to.equal('true');
  });

  it('normalizes a NaN collapsedDepth to 0 (fully collapsed) instead of silently disabling auto-collapse', async () => {
    const el = (await fixture(html`<lr-xml-viewer .xml=${SIMPLE_XML}></lr-xml-viewer>`)) as LyraXmlViewer;
    el.collapsedDepth = NaN;
    await el.updateComplete;
    const rootToggle = el.shadowRoot!.querySelector('[part="toggle"]') as HTMLButtonElement;
    expect(rootToggle.getAttribute('aria-expanded')).to.equal('false');
  });

  it('toggling a node flips its expand state and survives an xml reassignment with the same shape', async () => {
    const el = (await fixture(html`<lr-xml-viewer .xml=${SIMPLE_XML}></lr-xml-viewer>`)) as LyraXmlViewer;
    await el.updateComplete;
    const toggle = el.shadowRoot!.querySelector('[part="toggle"]') as HTMLButtonElement;
    toggle.click();
    await el.updateComplete;
    expect(toggle.getAttribute('aria-expanded')).to.equal('false');
    el.xml = SIMPLE_XML.replace('First', 'Updated First');
    await el.updateComplete;
    expect((el.shadowRoot!.querySelector('[part="toggle"]') as HTMLButtonElement).getAttribute('aria-expanded')).to.equal('false');
  });

  it('prunes a stale expandedOverrides entry once its path no longer exists after a reshape', async () => {
    const el = (await fixture(html`<lr-xml-viewer .xml=${SIMPLE_XML}></lr-xml-viewer>`)) as LyraXmlViewer;
    await el.updateComplete;
    const toggles = [...el.shadowRoot!.querySelectorAll('[part="toggle"]')] as HTMLButtonElement[];
    toggles[1].click(); // collapses the first <item>, creating an override keyed to path "[0]"
    await el.updateComplete;
    const overrides = () => (el as unknown as { expandedOverrides: Map<string, boolean> }).expandedOverrides;
    expect(overrides().has('[0]')).to.be.true;
    el.xml = '<root></root>'; // reshapes away path "[0]" entirely
    await el.updateComplete;
    expect(overrides().has('[0]')).to.be.false;
  });
});

describe('copy', () => {
  it('renders a whole-document copy button only when copyable, and emits lr-copy on click', async () => {
    const el = (await fixture(html`<lr-xml-viewer .xml=${SIMPLE_XML} copyable></lr-xml-viewer>`)) as LyraXmlViewer;
    await el.updateComplete;
    const button = el.shadowRoot!.querySelector('[part="toolbar"] [part="copy-button"]') as HTMLButtonElement;
    expect(button).to.exist;
    const eventPromise = oneEvent(el, 'lr-copy');
    button.click();
    const event = await eventPromise;
    expect(event.detail.text).to.include('<root>');
  });
});

// `search`/`searchNext`/`searchPrevious`/`clearSearch` are a purely imperative API here -- the
// same uniform contract `lr-pdf-viewer`/`lr-ebook-viewer`/`lr-notebook-viewer` implement
// (see `AnchorTargetCapabilities.search`'s doc comment in `document-viewer/anchors.ts`), not a
// settable `search` property/attribute like `lr-json-viewer`'s -- a single class member can't
// be both a plain string field (readable bare) and a callable method, so this viewer, which
// mirrors the anchor-target family's search surface, picks the imperative form.
describe('search', () => {
  it('search() auto-expands ancestors of a match and marks data-match, even under a collapsed-depth', async () => {
    const el = (await fixture(html`<lr-xml-viewer .xml=${SIMPLE_XML} collapsed-depth="1"></lr-xml-viewer>`)) as LyraXmlViewer;
    await el.search('Second');
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="text"][data-match]')).to.exist;
  });

  it('the imperative search() API returns a match count', async () => {
    const el = (await fixture(html`<lr-xml-viewer .xml=${SIMPLE_XML}></lr-xml-viewer>`)) as LyraXmlViewer;
    const count = await el.search('item');
    expect(count).to.be.greaterThan(0);
  });

  it('searchNext/searchPrevious move data-active-match and clearSearch resets it', async () => {
    const el = (await fixture(html`<lr-xml-viewer .xml=${SIMPLE_XML}></lr-xml-viewer>`)) as LyraXmlViewer;
    await el.search('item');
    const eventPromise = oneEvent(el, 'lr-search-change');
    el.searchNext();
    await eventPromise;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[data-active-match]')).to.exist;
    el.clearSearch();
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[data-active-match]')).to.not.exist;
  });

  it('searchPrevious wraps backward, mirroring searchNext', async () => {
    const el = (await fixture(html`<lr-xml-viewer .xml=${SIMPLE_XML}></lr-xml-viewer>`)) as LyraXmlViewer;
    await el.search('item');
    const eventPromise = oneEvent(el, 'lr-search-change');
    el.searchPrevious();
    await eventPromise;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[data-active-match]')).to.exist;
  });

  it('searchNext/searchPrevious no-op when there are no matches', async () => {
    const el = (await fixture(html`<lr-xml-viewer .xml=${SIMPLE_XML}></lr-xml-viewer>`)) as LyraXmlViewer;
    const count = await el.search('nonexistent-zzz');
    expect(count).to.equal(0);
    el.searchNext();
    el.searchPrevious();
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[data-active-match]')).to.not.exist;
  });

  it('search()/clearSearch() fall back to an empty search state before any document is loaded', async () => {
    const el = (await fixture(html`<lr-xml-viewer></lr-xml-viewer>`)) as LyraXmlViewer;
    const count = await el.search('anything');
    expect(count).to.equal(0);
    el.clearSearch();
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[data-match]')).to.not.exist;
  });
});

describe('node-path anchors', () => {
  it('resolves an element node-path and an attribute-addressing trailing segment', async () => {
    const el = (await fixture(html`<lr-xml-viewer .xml=${RSS_XML}></lr-xml-viewer>`)) as LyraXmlViewer;
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

  it('resolves false for a malformed node-path: a non-@ string segment, or an @-segment mid-path', async () => {
    const el = (await fixture(html`<lr-xml-viewer .xml=${RSS_XML}></lr-xml-viewer>`)) as LyraXmlViewer;
    await el.updateComplete;
    (el as unknown as { anchorTimeoutMs: number }).anchorTimeoutMs = 30;
    (el as unknown as { anchorRetryIntervalMs: number }).anchorRetryIntervalMs = 5;
    expect(await el.scrollToAnchor({ kind: 'node-path', path: ['bogus'] })).to.be.false;
    expect(await el.scrollToAnchor({ kind: 'node-path', path: ['@href', 0] })).to.be.false;
  });
});

describe('node cap', () => {
  it('rejects a document with more than the node cap with a resource-limit message', async () => {
    const many = `<root>${'<n/>'.repeat(50_001)}</root>`;
    const el = (await fixture(html`<lr-xml-viewer></lr-xml-viewer>`)) as LyraXmlViewer;
    const eventPromise = oneEvent(el, 'lr-render-error');
    el.xml = many;
    await eventPromise;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="error"]')).to.exist;
  });
});

describe('toggle geometry', () => {
  it('floors the node toggle at the shared icon-button target size on both axes', async () => {
    const el = (await fixture(html`<lr-xml-viewer .xml=${SIMPLE_XML}></lr-xml-viewer>`)) as LyraXmlViewer;
    await el.updateComplete;
    const toggle = el.shadowRoot!.querySelector('[part="toggle"]') as HTMLButtonElement;
    const style = getComputedStyle(toggle);
    expect(style.minInlineSize).to.equal('40px');
    expect(style.minBlockSize).to.equal('40px');
    const box = toggle.getBoundingClientRect();
    expect(box.width).to.be.at.least(40);
    expect(box.height).to.be.at.least(40);
  });

  it('keeps the chevron box at its own size when --lr-icon-button-size is themed below it', async () => {
    const el = (await fixture(html`
      <lr-xml-viewer .xml=${SIMPLE_XML} style="--lr-icon-button-size: 1rem"></lr-xml-viewer>
    `)) as LyraXmlViewer;
    await el.updateComplete;
    const box = el.shadowRoot!.querySelector('[part="toggle"]')!.getBoundingClientRect();
    // The target size is a floor, so lowering it never squashes the glyph box below its own
    // 1.25rem size (the same shape lr-code-block's toggle already uses).
    expect(box.width).to.equal(20);
    expect(box.height).to.equal(20);
  });
});

describe('accessibility', () => {
  it('is accessible with an expanded tree and copyable on', async () => {
    const el = await fixture(html`<lr-xml-viewer name="feed.rss" .xml=${RSS_XML} copyable></lr-xml-viewer>`);
    await expect(el).to.be.accessible();
  });
});

describe('active-match cssprop escape hatch', () => {
  function resolvedInShadow(el: LyraXmlViewer, declaration: string, property: string): string {
    const probe = document.createElement('span');
    probe.setAttribute('style', declaration);
    el.shadowRoot!.appendChild(probe);
    const value = getComputedStyle(probe).getPropertyValue(property);
    probe.remove();
    return value;
  }

  async function activeMatch(style = ''): Promise<{ el: LyraXmlViewer; node: HTMLElement }> {
    const wrapper = (await fixture(html`<div style=${style}><lr-xml-viewer .xml=${SIMPLE_XML}></lr-xml-viewer></div>`)) as HTMLElement;
    const el = wrapper.querySelector('lr-xml-viewer') as LyraXmlViewer;
    await el.updateComplete;
    await el.search('item'); // activeSearchIndex starts at 0 -> the first match node carries data-active-match
    await el.updateComplete;
    const node = el.shadowRoot!.querySelector('[part="node"][data-active-match]') as HTMLElement;
    return { el, node };
  }

  it('recolors the active-match outline from an ancestor via --lr-xml-viewer-active-match-color', async () => {
    const { node } = await activeMatch('--lr-xml-viewer-active-match-color: rgb(0, 51, 102)');
    expect(getComputedStyle(node).outlineColor).to.equal('rgb(0, 51, 102)');
  });

  it('renders byte-identical to the warning token when unset', async () => {
    const { el, node } = await activeMatch();
    expect(getComputedStyle(node).outlineColor).to.equal(
      resolvedInShadow(el, 'outline: 1px solid var(--lr-color-warning)', 'outline-color'),
    );
  });

  it('is accessible with the active-match prop themed', async () => {
    const { el } = await activeMatch('--lr-xml-viewer-active-match-color: rgb(0, 51, 102)');
    await expect(el).to.be.accessible();
  });
});

describe('non-active match cssprop escape hatch', () => {
  // Every part of this single element matches the query 'match': its tag name, its `id`
  // attribute's value, and its own text -- so one fixture exercises the node outline, the
  // tag/attribute-value background, and the text tint all at once. Two identical siblings so
  // one match is the active one (index 0) and the other stays non-active, the state this
  // describe block is about (the active one already has its own dedicated cssprop, tested
  // above).
  const MATCH_XML = '<root><match id="value-match">TextMatchHere</match><match id="value-match">TextMatchHere</match></root>';

  function resolvedInShadow(el: LyraXmlViewer, declaration: string, property: string): string {
    const probe = document.createElement('span');
    probe.setAttribute('style', declaration);
    el.shadowRoot!.appendChild(probe);
    const value = getComputedStyle(probe).getPropertyValue(property);
    probe.remove();
    return value;
  }

  async function nonActiveMatch(
    style = '',
  ): Promise<{ el: LyraXmlViewer; node: HTMLElement; tag: HTMLElement; attrValue: HTMLElement; text: HTMLElement }> {
    const wrapper = (await fixture(html`<div style=${style}><lr-xml-viewer .xml=${MATCH_XML}></lr-xml-viewer></div>`)) as HTMLElement;
    const el = wrapper.querySelector('lr-xml-viewer') as LyraXmlViewer;
    await el.updateComplete;
    await el.search('match');
    await el.updateComplete;
    const nodes = [...el.shadowRoot!.querySelectorAll('[part="node"][data-match]')] as HTMLElement[];
    const node = nodes.find((n) => !n.hasAttribute('data-active-match'))!;
    const tag = el.shadowRoot!.querySelector('[part="tag"][data-match]') as HTMLElement;
    const attrValue = el.shadowRoot!.querySelector('[part="attribute-value"][data-match]') as HTMLElement;
    const text = el.shadowRoot!.querySelector('[part="text"][data-match]') as HTMLElement;
    return { el, node, tag, attrValue, text };
  }

  it('recolors a non-active match outline from --lr-xml-viewer-match-color', async () => {
    const { node } = await nonActiveMatch('--lr-xml-viewer-match-color: rgb(10, 20, 30)');
    expect(getComputedStyle(node).outlineColor).to.equal('rgb(10, 20, 30)');
  });

  it('recolors the text-match tint from the same --lr-xml-viewer-match-color', async () => {
    const { el, text } = await nonActiveMatch('--lr-xml-viewer-match-color: rgb(10, 20, 30)');
    expect(getComputedStyle(text).backgroundColor).to.equal(
      resolvedInShadow(el, 'background: color-mix(in srgb, rgb(10, 20, 30) 30%, transparent)', 'background-color'),
    );
  });

  it('recolors the tag/attribute-value match background from --lr-xml-viewer-match-bg', async () => {
    const { tag, attrValue } = await nonActiveMatch('--lr-xml-viewer-match-bg: rgb(40, 50, 60)');
    expect(getComputedStyle(tag).backgroundColor).to.equal('rgb(40, 50, 60)');
    expect(getComputedStyle(attrValue).backgroundColor).to.equal('rgb(40, 50, 60)');
  });

  it('renders byte-identical to the shared warning tokens when the cssprops are unset', async () => {
    const { el, node, tag, text } = await nonActiveMatch();
    expect(getComputedStyle(node).outlineColor).to.equal(
      resolvedInShadow(el, 'outline: 1px dashed var(--lr-color-warning)', 'outline-color'),
    );
    expect(getComputedStyle(tag).backgroundColor).to.equal(resolvedInShadow(el, 'background: var(--lr-color-warning-quiet)', 'background-color'));
    expect(getComputedStyle(text).backgroundColor).to.equal(
      resolvedInShadow(el, 'background: color-mix(in srgb, var(--lr-color-warning) 30%, transparent)', 'background-color'),
    );
  });

  it('is accessible with the non-active match outline color themed', async () => {
    const { el } = await nonActiveMatch('--lr-xml-viewer-match-color: rgb(10, 20, 30)');
    await expect(el).to.be.accessible();
  });

  it('is accessible with the non-active match background themed to a contrast-safe color', async () => {
    // A dark override here would fail axe's text-contrast check against the fixed tag/
    // attribute-value text colors -- a themed-contrast concern for the consumer choosing the
    // color, not a defect in this cssprop indirection, so this uses a pale tone (in the same
    // register as the default --lr-color-warning-quiet) to isolate the two concerns.
    const { el } = await nonActiveMatch('--lr-xml-viewer-match-bg: rgb(255, 244, 200)');
    await expect(el).to.be.accessible();
  });
});

describe('hover-rule specificity (::part() theming escape hatch)', () => {
  it("wraps the row's own copy-button reveal-on-hover rule in :where() so a consumer's ::part(copy-button):hover wins", () => {
    const css = styles.cssText.replace(/\s+/g, ' ');
    // Both the .row ancestor and the [part='copy-button'] target must be inside a :where() --
    // otherwise the attribute-selector contribution alone keeps this rule out-specificitying a
    // consumer's ::part(copy-button):hover ((0,1,1)).
    expect(css).to.match(/:where\(\.row\):hover :where\(\[part='copy-button'\]\)/);
    expect(css).to.match(/:where\(\.row\):focus-within :where\(\[part='copy-button'\]\)/);
  });

  it('renders correctly with a competing ::part(copy-button):hover stylesheet present', async () => {
    const style = document.createElement('style');
    style.textContent = `lr-xml-viewer::part(copy-button):hover { opacity: 0.5; }`;
    document.head.appendChild(style);
    try {
      const el = (await fixture(html`<lr-xml-viewer .xml=${SIMPLE_XML} copyable></lr-xml-viewer>`)) as LyraXmlViewer;
      await el.updateComplete;
      // jsdom/browser test runners don't synthesize a real :hover pseudo-class from a dispatched
      // event, so the actual specificity win is asserted via the stylesheet-text check above --
      // this test just proves the fixture still renders correctly with the competing consumer
      // stylesheet present.
      expect(el.shadowRoot!.querySelectorAll('[part="copy-button"]').length).to.be.greaterThan(0);
    } finally {
      style.remove();
    }
  });
});

describe('localization coverage', () => {
  it('a .strings override actually reaches the rendered parse-error message', async () => {
    const el = (await fixture(
      html`<lr-xml-viewer .strings=${{ xmlViewerParseError: 'Document XML invalide.' }}></lr-xml-viewer>`,
    )) as LyraXmlViewer;
    const eventPromise = oneEvent(el, 'lr-render-error');
    el.xml = '<root><unclosed></root>';
    await eventPromise;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="error"]')!.textContent).to.equal('Document XML invalide.');
  });

  it('a registered locale supplies xmlViewerLabel without an explicit .strings override', async () => {
    registerLyraLocale('fr-test-xml-viewer', { xmlViewerLabel: 'Visionneuse XML' });
    const el = (await fixture(html`<lr-xml-viewer locale="fr-test-xml-viewer"></lr-xml-viewer>`)) as LyraXmlViewer;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal('Visionneuse XML');
  });
});

describe('stale generation guards', () => {
  it('setDoc() ignores a call carrying a generation older than the current one', async () => {
    const el = (await fixture(html`<lr-xml-viewer .xml=${SIMPLE_XML}></lr-xml-viewer>`)) as LyraXmlViewer;
    await el.updateComplete;
    const before = el.shadowRoot!.querySelectorAll('[part="tag"]').length;
    const staleDoc = new DOMParser().parseFromString('<other/>', 'application/xml');
    (el as unknown as { setDoc(doc: Document, generation: number): void }).setDoc(staleDoc, -1);
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll('[part="tag"]').length).to.equal(before);
  });
});

describe('leaf elements (no children of any kind)', () => {
  it('hides the toggle and omits its aria attributes for a truly childless element', async () => {
    const el = (await fixture(
      html`<lr-xml-viewer .xml=${'<root><empty/><item>x</item></root>'}></lr-xml-viewer>`,
    )) as LyraXmlViewer;
    await el.updateComplete;
    const toggles = [...el.shadowRoot!.querySelectorAll('[part="toggle"]')] as HTMLButtonElement[];
    const leafToggle = toggles[1]; // toggles[0] is root's own (it has children)
    expect(leafToggle.hasAttribute('hidden')).to.be.true;
    expect(leafToggle.getAttribute('tabindex')).to.equal('-1');
    expect(leafToggle.getAttribute('aria-hidden')).to.equal('true');
    expect(leafToggle.hasAttribute('aria-expanded')).to.be.false;
    expect(leafToggle.hasAttribute('aria-label')).to.be.false;
  });
});

describe('comment, CDATA, and processing-instruction leaves', () => {
  const RICH_XML = '<root><!-- a comment --><![CDATA[raw <data>]]><?myapp key="value"?></root>';

  it('renders one row each for a comment, a CDATA section, and a processing instruction', async () => {
    const el = (await fixture(html`<lr-xml-viewer .xml=${RICH_XML}></lr-xml-viewer>`)) as LyraXmlViewer;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="comment"]')!.textContent).to.equal('<!-- a comment -->');
    expect(el.shadowRoot!.querySelector('[part="cdata"]')!.textContent).to.include('raw <data>');
    expect(el.shadowRoot!.querySelector('[part="pi"]')!.textContent).to.include('myapp');
  });
});

describe('collapsed child-count preview pluralization', () => {
  it('uses the singular key for exactly one child, plural for more than one', async () => {
    const one = (await fixture(
      html`<lr-xml-viewer .xml=${'<root><only/></root>'} collapsed-depth="0"></lr-xml-viewer>`,
    )) as LyraXmlViewer;
    await one.updateComplete;
    expect(one.shadowRoot!.querySelector('.preview')!.textContent).to.equal('1 child');

    const two = (await fixture(html`<lr-xml-viewer .xml=${SIMPLE_XML} collapsed-depth="0"></lr-xml-viewer>`)) as LyraXmlViewer;
    await two.updateComplete;
    expect(two.shadowRoot!.querySelector('.preview')!.textContent).to.equal('2 children');
  });
});

describe('per-node copy button', () => {
  it("copies a single node's serialized XML and stops the click from also toggling its row", async () => {
    const el = (await fixture(html`<lr-xml-viewer .xml=${SIMPLE_XML} copyable></lr-xml-viewer>`)) as LyraXmlViewer;
    await el.updateComplete;
    const nodeButtons = [...el.shadowRoot!.querySelectorAll('[part="node"] [part="copy-button"]')] as HTMLButtonElement[];
    const itemButton = nodeButtons[0]; // the first element row's own per-node button
    const eventPromise = oneEvent(el, 'lr-copy');
    itemButton.click();
    const event = await eventPromise;
    expect(event.detail.text).to.include('<item');
    // A row-toggle click would have flipped an aria-expanded value; none did.
    expect(el.shadowRoot!.querySelectorAll('[part="toggle"][aria-expanded="false"]').length).to.equal(0);
  });
});

describe('writeClipboard defensive catch', () => {
  it('still emits lr-copy when navigator.clipboard.writeText throws synchronously', async () => {
    const original = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: () => {
          throw new Error('denied');
        },
      },
    });
    try {
      const el = (await fixture(html`<lr-xml-viewer .xml=${SIMPLE_XML} copyable></lr-xml-viewer>`)) as LyraXmlViewer;
      await el.updateComplete;
      const button = el.shadowRoot!.querySelector('[part="toolbar"] [part="copy-button"]') as HTMLButtonElement;
      const eventPromise = oneEvent(el, 'lr-copy');
      button.click();
      const event = await eventPromise;
      expect(event.detail.text).to.include('<root>');
    } finally {
      if (original) Object.defineProperty(navigator, 'clipboard', original);
      else delete (navigator as unknown as { clipboard?: unknown }).clipboard;
    }
  });
});

describe('max-height', () => {
  it('exposes max-height as the --lr-xml-viewer-max-height cssprop on the base part', async () => {
    const el = (await fixture(html`<lr-xml-viewer .xml=${SIMPLE_XML} max-height="20rem"></lr-xml-viewer>`)) as LyraXmlViewer;
    await el.updateComplete;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    expect(base.style.getPropertyValue('--lr-xml-viewer-max-height').trim()).to.equal('20rem');
  });
});
