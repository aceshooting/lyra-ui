import { fixture, expect, html, oneEvent, waitUntil } from '@open-wc/testing';
import './xml-viewer.js';
import type { LyraXmlViewer } from './xml-viewer.js';
import { registerLyraLocale } from '../../../internal/localization.js';
import { DEFAULT_MAX_RESOURCE_BYTES } from '../../../internal/resource-loader.js';
import { resetMouse, sendMouse } from '../../../../test/wtr-mouse.js';

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

function stubClipboard(target: Navigator, value: unknown): () => void {
  const original = Object.getOwnPropertyDescriptor(target, 'clipboard');
  Object.defineProperty(target, 'clipboard', { configurable: true, value });
  return () => {
    if (original) Object.defineProperty(target, 'clipboard', original);
    else Reflect.deleteProperty(target, 'clipboard');
  };
}

describe('defaults', () => {
  it('defaults to empty src/xml/name, copyable false', async () => {
    const el = (await fixture(html`<lr-xml-viewer></lr-xml-viewer>`)) as LyraXmlViewer;
    expect(el.src).to.equal('');
    expect(el.xml).to.be.undefined;
    expect(el.source).to.equal(null);
    expect(el.name).to.equal('');
    expect(el.copyable).to.be.false;
  });

  it('exposes one discriminated source authority as inline content is set and cleared', () => {
    const el = document.createElement('lr-xml-viewer') as LyraXmlViewer;
    el.src = 'https://example.test/remote.xml';
    expect(el.source).to.deep.equal({ kind: 'url', url: 'https://example.test/remote.xml' });
    el.xml = '';
    expect(el.source).to.deep.equal({ kind: 'inline', value: '' });
    el.xml = SIMPLE_XML;
    expect(el.source).to.deep.equal({ kind: 'inline', value: SIMPLE_XML });
    el.xml = undefined;
    expect(el.source).to.deep.equal({ kind: 'url', url: 'https://example.test/remote.xml' });
  });

  it('renders the empty-document placeholder when neither src nor xml is set', async () => {
    const el = (await fixture(html`<lr-xml-viewer></lr-xml-viewer>`)) as LyraXmlViewer;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="tree"]') === null).to.equal(true);
    expect(el.shadowRoot!.querySelector('[part="error"]') === null).to.equal(true);
    expect(el.shadowRoot!.querySelector('[part="base"]')!.textContent).to.include('No document to display.');
  });
});

it('validates maxHeight before assigning the base custom property', async () => {
  const el = await fixture<LyraXmlViewer>(html`<lr-xml-viewer></lr-xml-viewer>`);
  el.maxHeight = '10rem;position:fixed';
  await el.updateComplete;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  expect(base.style.position).to.equal('');
  expect(base.style.getPropertyValue('--lr-xml-viewer-max-height')).to.equal('');
  el.maxHeight = 'calc(10rem + 2px)';
  await el.updateComplete;
  expect(base.style.getPropertyValue('--lr-xml-viewer-max-height')).to.equal('calc(10rem + 2px)');
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

  it('detects a parsererror nested inside the root element, not just one standing as the root itself', async () => {
    // Different browser engines shape DOMParser's synthesized error document differently: some
    // put <parsererror> as the document's own root, others nest it as the root's first child.
    // Stubbing parseFromString to return the nested shape deterministically exercises the branch
    // the currently-running engine's own <parsererror> shape does not happen to produce.
    const original = DOMParser.prototype.parseFromString;
    DOMParser.prototype.parseFromString = function (): Document {
      const doc = original.call(this, '<html></html>', 'application/xml');
      const errorEl = doc.createElement('parsererror');
      errorEl.textContent = 'engine-specific nested diagnostic';
      doc.documentElement.appendChild(errorEl);
      return doc;
    };
    try {
      const el = (await fixture(html`<lr-xml-viewer></lr-xml-viewer>`)) as LyraXmlViewer;
      const eventPromise = oneEvent(el, 'lr-render-error');
      el.xml = SIMPLE_XML;
      await eventPromise;
      await el.updateComplete;
      expect(el.shadowRoot!.querySelector('[part="error"]')!.textContent).to.equal('This document could not be parsed as XML.');
    } finally {
      DOMParser.prototype.parseFromString = original;
    }
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

  it('resumes the configured remote source when an inline xml override is cleared', async () => {
    let fetchCount = 0;
    const restore = stubFetch(async () => {
      fetchCount++;
      return textResponse('<remote><loaded/></remote>');
    });
    try {
      const el = (await fixture(
        html`<lr-xml-viewer src="https://example.test/remote.xml" .xml=${SIMPLE_XML}></lr-xml-viewer>`,
      )) as LyraXmlViewer;
      expect(fetchCount).to.equal(0);

      el.xml = undefined;
      await waitUntil(() => el.shadowRoot!.textContent!.includes('remote'));
      expect(fetchCount).to.equal(1);
      expect(el.shadowRoot!.textContent).to.include('loaded');
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

  it('does not mistake DOCTYPE-like text inside a comment or CDATA section for an actual doctype declaration', async () => {
    const el = (await fixture(html`<lr-xml-viewer></lr-xml-viewer>`)) as LyraXmlViewer;
    el.xml = '<root><!-- <!DOCTYPE fake> --><data><![CDATA[<!DOCTYPE alsofake>]]></data></root>';
    await el.updateComplete;
    // The scanner must skip past comment/CDATA contents wholesale rather than independently
    // spotting the "<!DOCTYPE" substring living inside them -- a false positive here would reject
    // a perfectly well-formed document with the parse-error state instead of rendering it.
    expect(el.shadowRoot!.querySelectorAll('[part="error"]').length).to.equal(0);
    const tags = [...el.shadowRoot!.querySelectorAll('[part="tag"]')].map((t) => t.textContent);
    expect(tags).to.deep.equal(['root', 'data']);
  });

  it('fails closed with the parse-error state when xml is set without a browsing context', async () => {
    const el = (await fixture(html`<lr-xml-viewer></lr-xml-viewer>`)) as LyraXmlViewer;
    const ownerlessDocument = document.implementation.createHTMLDocument('ownerless');
    el.remove();
    ownerlessDocument.adoptNode(el);
    try {
      const eventPromise = oneEvent(el, 'lr-render-error');
      el.xml = SIMPLE_XML;
      const event = await eventPromise as CustomEvent<{ error: unknown }>;
      expect(event.detail.error).to.be.instanceOf(Error);
      expect((event.detail.error as Error).message).to.equal('DOMParser is unavailable without a browsing context.');
    } finally {
      el.remove();
    }
  });

  it('renders namespace-prefixed tag and attribute names exactly as authored', async () => {
    const nsXml = '<ns:root xmlns:ns="urn:example:ns"><ns:item ns:attr="v">text</ns:item></ns:root>';
    const el = (await fixture(html`<lr-xml-viewer .xml=${nsXml}></lr-xml-viewer>`)) as LyraXmlViewer;
    await el.updateComplete;
    const tags = [...el.shadowRoot!.querySelectorAll('[part="tag"]')].map((t) => t.textContent);
    expect(tags).to.deep.equal(['ns:root', 'ns:item']);
    const attrNames = [...el.shadowRoot!.querySelectorAll('[part="attribute-name"]')].map((n) => n.textContent);
    expect(attrNames).to.include('ns:attr');
  });

  it('rejects document type declarations before DOMParser can expand internal entities', async () => {
    const el = await fixture<LyraXmlViewer>(html`<lr-xml-viewer></lr-xml-viewer>`);
    const original = DOMParser.prototype.parseFromString;
    let parseCalls = 0;
    DOMParser.prototype.parseFromString = function (...args): Document {
      parseCalls++;
      return original.apply(this, args);
    };
    try {
      const eventPromise = oneEvent(el, 'lr-render-error');
      el.xml = `<!DOCTYPE root [
        <!ENTITY a "1234567890">
        <!ENTITY b "&a;&a;&a;&a;&a;&a;&a;&a;&a;&a;">
        <!ENTITY c "&b;&b;&b;&b;&b;&b;&b;&b;&b;&b;">
      ]><root>&c;</root>`;
      const event = await eventPromise as CustomEvent<{ error: unknown }>;
      await el.updateComplete;
      expect(parseCalls).to.equal(0);
      expect(event.detail.error).to.be.instanceOf(Error);
      expect(el.shadowRoot!.querySelectorAll('[part="error"]').length).to.equal(1);
      expect(el.shadowRoot!.querySelector('[part="error"]')?.textContent).to.equal(
        'This document could not be parsed as XML.',
      );
    } finally {
      DOMParser.prototype.parseFromString = original;
    }
  });
});

describe('loading xml via src', () => {
  it('paints a visible busy treatment while pending and replaces it with parsed content', async () => {
    let resolveFetch!: (response: Response) => void;
    const restore = stubFetch(() => new Promise<Response>((resolve) => { resolveFetch = resolve; }));
    try {
      const el = await fixture<LyraXmlViewer>(html`<lr-xml-viewer></lr-xml-viewer>`);
      el.src = 'https://example.test/pending.xml';
      await waitUntil(() => el.shadowRoot!.querySelector('[part="spinner"]') !== null);
      const base = el.shadowRoot!.querySelector('[part="base"]')!;
      const label = el.shadowRoot!.querySelector<HTMLElement>('.viewer-loading-label')!;
      expect(base.getAttribute('aria-busy')).to.equal('true');
      expect(label.textContent).to.equal('Loading document…');
      expect(label.getBoundingClientRect().height).to.be.greaterThan(0);
      resolveFetch(textResponse(SIMPLE_XML));
      await waitUntil(() => el.shadowRoot!.querySelector('[part="tree"]') !== null);
      expect(base.getAttribute('aria-busy')).to.equal('false');
      expect(el.shadowRoot!.querySelector('[part="spinner"]') === null).to.equal(true);
    } finally {
      restore();
    }
  });

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

  it('re-fetches src after a disconnect/reconnect cycle', async () => {
    let fetchCount = 0;
    const restore = stubFetch(async () => {
      fetchCount++;
      return textResponse(SIMPLE_XML);
    });
    try {
      const el = (await fixture(html`<lr-xml-viewer src="https://example.test/doc.xml"></lr-xml-viewer>`)) as LyraXmlViewer;
      await waitUntil(() => el.shadowRoot!.querySelector('[part="tree"]') !== null);
      expect(fetchCount).to.equal(1);
      const parent = el.parentNode!;
      el.remove();
      await waitUntil(() => el.shadowRoot!.querySelector('[part="tree"]') === null);
      parent.appendChild(el);
      await waitUntil(() => fetchCount === 2);
      await waitUntil(() => el.shadowRoot!.querySelector('[part="tree"]') !== null);
      expect(fetchCount).to.equal(2);
    } finally {
      restore();
    }
  });

  it('discards a stale in-flight response once a faster later src wins', async () => {
    const pending = new Map<string, (response: Response) => void>();
    const restore = stubFetch((url) => new Promise<Response>((resolve) => { pending.set(url, resolve); }));
    try {
      const el = (await fixture(html`<lr-xml-viewer></lr-xml-viewer>`)) as LyraXmlViewer;
      el.src = 'https://example.test/first.xml';
      await waitUntil(() => pending.has('https://example.test/first.xml'));
      el.src = 'https://example.test/second.xml';
      await waitUntil(() => pending.has('https://example.test/second.xml'));

      // The second (later) request resolves first; the first (stale) request resolves after --
      // its result must never win over the second's.
      pending.get('https://example.test/second.xml')!(textResponse('<second><winner/></second>'));
      await waitUntil(() => el.shadowRoot!.querySelector('[part="tree"]') !== null);
      pending.get('https://example.test/first.xml')!(textResponse('<first><loser/></first>'));
      await el.updateComplete;

      const tags = [...el.shadowRoot!.querySelectorAll('[part="tag"]')].map((t) => t.textContent);
      expect(tags).to.include('second');
      expect(tags).to.not.include('first');
    } finally {
      restore();
    }
  });

  it('reports the same stable parse-error message for a DOCTYPE-bearing document reached via src, without ever calling DOMParser', async () => {
    const restore = stubFetch(async () => textResponse(`<!DOCTYPE root [
      <!ENTITY a "1234567890">
    ]><root>&a;</root>`));
    const original = DOMParser.prototype.parseFromString;
    let parseCalls = 0;
    DOMParser.prototype.parseFromString = function (...args): Document {
      parseCalls++;
      return original.apply(this, args);
    };
    try {
      const el = (await fixture(html`<lr-xml-viewer></lr-xml-viewer>`)) as LyraXmlViewer;
      const eventPromise = oneEvent(el, 'lr-render-error');
      el.src = 'https://example.test/doctype.xml';
      await eventPromise;
      await el.updateComplete;
      expect(parseCalls).to.equal(0);
      expect(el.shadowRoot!.querySelector('[part="error"]')!.textContent).to.equal('This document could not be parsed as XML.');
    } finally {
      DOMParser.prototype.parseFromString = original;
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
      const el = (await fixture(html`<lr-xml-viewer></lr-xml-viewer>`)) as LyraXmlViewer;
      const eventPromise = oneEvent(el, 'lr-render-error');
      el.src = 'javascript:alert(1)';
      expect((await eventPromise).detail.error).to.exist;
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
  it('clears copy feedback on its own after the feedback window elapses', async function () {
    this.timeout(5_000);
    const restore = stubClipboard(navigator, { writeText: async () => {} });
    try {
      const el = (await fixture(html`<lr-xml-viewer .xml=${SIMPLE_XML} copyable></lr-xml-viewer>`)) as LyraXmlViewer;
      await el.updateComplete;
      const button = el.shadowRoot!.querySelector('[part="toolbar"] [part="copy-button"]') as HTMLButtonElement;
      const eventPromise = oneEvent(el, 'lr-copy');
      button.click();
      await eventPromise;
      await el.updateComplete;
      expect(button.textContent!.trim()).to.equal('Copied!');
      await waitUntil(() => button.textContent!.trim() !== 'Copied!', 'copy feedback clears after its timer', {
        timeout: 3_000,
        interval: 50,
      });
      expect(button.textContent!.trim()).to.equal('Copy');
    } finally {
      restore();
    }
  });

  it('renders a whole-document copy button and emits success only after clipboard fulfillment', async () => {
    const writes: string[] = [];
    const restore = stubClipboard(navigator, { writeText: async (text: string) => { writes.push(text); } });
    try {
      const el = (await fixture(html`<lr-xml-viewer .xml=${SIMPLE_XML} copyable></lr-xml-viewer>`)) as LyraXmlViewer;
      await el.updateComplete;
      const button = el.shadowRoot!.querySelector('[part="toolbar"] [part="copy-button"]') as HTMLButtonElement;
      expect((button) != null).to.equal(true);
      const eventPromise = oneEvent(el, 'lr-copy');
      button.click();
      const event = await eventPromise;
      expect(event.detail).to.deep.include({ ok: true });
      expect(event.detail.text).to.include('<root>');
      expect(writes).to.deep.equal([event.detail.text]);
      await el.updateComplete;
      expect(button.textContent!.trim()).to.equal('Copied!');
    } finally {
      restore();
    }
  });

  it('uses the adopted owner clipboard and fails closed in an ownerless document', async () => {
    const frame = document.createElement('iframe');
    document.body.append(frame);
    const frameDocument = frame.contentDocument!;
    const frameWindow = frame.contentWindow!;
    const ownerlessDocument = document.implementation.createHTMLDocument('ownerless');
    const mainClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
    const frameClipboard = Object.getOwnPropertyDescriptor(frameWindow.navigator, 'clipboard');
    const MainXMLSerializer = window.XMLSerializer;
    const FrameXMLSerializer = frameWindow.XMLSerializer;
    let mainWrites = 0;
    let mainSerializations = 0;
    let frameSerializations = 0;
    const frameWrites: string[] = [];
    class MainTrackedXMLSerializer {
      serializeToString(node: Node): string {
        mainSerializations++;
        return new MainXMLSerializer().serializeToString(node);
      }
    }
    class FrameTrackedXMLSerializer {
      serializeToString(node: Node): string {
        frameSerializations++;
        return new FrameXMLSerializer().serializeToString(node);
      }
    }
    window.XMLSerializer = MainTrackedXMLSerializer as unknown as typeof XMLSerializer;
    frameWindow.XMLSerializer = FrameTrackedXMLSerializer as unknown as typeof XMLSerializer;
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: () => { mainWrites++; return Promise.resolve(); } },
    });
    Object.defineProperty(frameWindow.navigator, 'clipboard', {
      configurable: true,
      value: { writeText: (text: string) => { frameWrites.push(text); return Promise.resolve(); } },
    });
    const el = (await fixture(
      html`<lr-xml-viewer .xml=${SIMPLE_XML} copyable></lr-xml-viewer>`,
    )) as LyraXmlViewer;
    const button = el.shadowRoot!.querySelector('[part="toolbar"] [part="copy-button"]') as HTMLButtonElement;

    try {
      frameDocument.body.append(frameDocument.adoptNode(el));
      await el.updateComplete;
      const copied = oneEvent(el, 'lr-copy');
      button.click();
      expect((await copied).detail).to.deep.include({ ok: true });
      expect(mainWrites).to.equal(0);
      expect(frameWrites).to.have.length(1);
      expect(frameWrites[0]).to.include('<root>');
      expect(mainSerializations).to.equal(0);
      expect(frameSerializations).to.equal(1);

      el.remove();
      ownerlessDocument.adoptNode(el);
      button.click();
      await Promise.resolve();
      expect(mainWrites).to.equal(0);
      expect(frameWrites).to.have.length(1);
      expect(mainSerializations).to.equal(0);
      expect(frameSerializations).to.equal(1);
    } finally {
      el.remove();
      window.XMLSerializer = MainXMLSerializer;
      frameWindow.XMLSerializer = FrameXMLSerializer;
      if (mainClipboard) Object.defineProperty(navigator, 'clipboard', mainClipboard);
      else Reflect.deleteProperty(navigator, 'clipboard');
      if (frameClipboard) Object.defineProperty(frameWindow.navigator, 'clipboard', frameClipboard);
      else Reflect.deleteProperty(frameWindow.navigator, 'clipboard');
      frame.remove();
    }
  });
});

// `search`/`searchNext`/`searchPrevious`/`clearSearch` are a purely imperative API here -- the
// same uniform contract `lr-pdf-viewer`/`lr-ebook-viewer`/`lr-notebook-viewer` implement
// (see `AnchorTargetCapabilities.search`'s doc comment in `document-viewer/anchors.ts`), not a
// settable `search` property/attribute like `lr-json-viewer`'s -- a single class member can't
// be both a plain string field (readable bare) and a callable method, so this viewer, which
// mirrors the anchor-target family's search surface, picks the imperative form.
describe('search', () => {
  it('re-renders when a new query keeps the same active match index', async () => {
    const el = (await fixture(
      html`<lr-xml-viewer .xml=${'<root><first>foo</first><second>bar</second></root>'}></lr-xml-viewer>`,
    )) as LyraXmlViewer;
    await el.search('foo');
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="text"][data-match]')!.textContent).to.equal('foo');

    await el.search('bar');
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="text"][data-match]')!.textContent).to.equal('bar');

    await el.search('missing');
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll('[data-match]').length).to.equal(0);
  });

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
    expect((el.shadowRoot!.querySelector('[data-active-match]')) == null).to.be.true;
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

  it('emits a canonical empty search reset when the document is replaced', async () => {
    const el = await fixture<LyraXmlViewer>(html`
      <lr-xml-viewer .xml=${'<root><item/><item/><item/></root>'}></lr-xml-viewer>
    `);
    expect(await el.search('item')).to.equal(3);
    expect(await el.searchNext()).to.be.true;
    expect(await el.searchNext()).to.be.true;

    const eventPromise = oneEvent(el, 'lr-search-change');
    el.xml = '<root><item/></root>';
    const event = await eventPromise as CustomEvent<{
      query: string;
      matchCount: number;
      matchCountExact: boolean;
      activeIndex: number;
    }>;
    await el.updateComplete;
    expect(event.detail).to.deep.equal({ query: '', matchCount: 0, matchCountExact: true, activeIndex: -1 });
    expect(el.shadowRoot!.querySelectorAll('[data-active-match]').length).to.equal(0);
  });

  it('searchNext/searchPrevious no-op when there are no matches', async () => {
    const el = (await fixture(html`<lr-xml-viewer .xml=${SIMPLE_XML}></lr-xml-viewer>`)) as LyraXmlViewer;
    const count = await el.search('nonexistent-zzz');
    expect(count).to.equal(0);
    el.searchNext();
    el.searchPrevious();
    await el.updateComplete;
    expect((el.shadowRoot!.querySelector('[data-active-match]')) == null).to.be.true;
  });

  it('reports a retained lower bound when more than 10,000 nodes match', async function () {
    this.timeout(20_000);
    const xml = `<root>${'<hit/>'.repeat(10_001)}</root>`;
    const el = (await fixture(html`<lr-xml-viewer></lr-xml-viewer>`)) as LyraXmlViewer;
    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    const state = el as unknown as {
      xmlState: { kind: 'loaded'; doc: Document };
      scrollActiveMatchIntoView(): Promise<void>;
    };
    state.xmlState = { kind: 'loaded', doc };
    state.scrollActiveMatchIntoView = () => Promise.resolve();
    let detail: { matchCount: number; matchCountExact: boolean } | undefined;
    el.addEventListener('lr-search-change', (event) => { detail = event.detail; });

    expect(await el.search('hit')).to.equal(10_000);
    expect(detail).to.deep.include({ matchCount: 10_000, matchCountExact: false });
  });

  // Regression: this viewer moved `data-active-match` but never scrolled, so on a document taller
  // than the viewport searchNext()/searchPrevious() silently walked matches off-screen. Every other
  // search-capable viewer here brings the active match into view.
  it('scrolls the active match into view on search and on every navigation step', async () => {
    const rows = Array.from({ length: 40 }, (_unused, i) => `<item id="${i}">row ${i}</item>`).join('');
    const el = (await fixture(
      html`<lr-xml-viewer max-height="6rem" .xml=${`<root>${rows}<needle>found</needle><needle>found</needle></root>`}></lr-xml-viewer>`,
    )) as LyraXmlViewer;
    const original = HTMLElement.prototype.scrollIntoView;
    const scrolled: Array<string | null> = [];
    const behaviors: Array<ScrollBehavior | undefined> = [];
    HTMLElement.prototype.scrollIntoView = function (this: HTMLElement, options?: boolean | ScrollIntoViewOptions) {
      scrolled.push(this.getAttribute('part'));
      behaviors.push(typeof options === 'object' ? options.behavior : undefined);
    };
    try {
      expect(await el.search('needle')).to.equal(2);
      expect(scrolled, 'search() brings its first match on screen').to.deep.equal(['node']);
      expect(behaviors).to.deep.equal(['smooth']);

      expect(await el.searchNext()).to.be.true;
      expect(await el.searchPrevious()).to.be.true;
      expect(scrolled.length, 'every navigation step scrolls too').to.equal(3);
      expect(el.shadowRoot!.querySelectorAll('[data-active-match]').length).to.equal(1);
    } finally {
      HTMLElement.prototype.scrollIntoView = original;
    }
  });

  it('honors reduced motion when scrolling to the active match', async () => {
    const el = (await fixture(
      html`<lr-xml-viewer .xml=${'<root><needle>found</needle></root>'}></lr-xml-viewer>`,
    )) as LyraXmlViewer;
    const originalScrollIntoView = HTMLElement.prototype.scrollIntoView;
    const originalMatchMedia = window.matchMedia;
    const behaviors: Array<ScrollBehavior | undefined> = [];
    HTMLElement.prototype.scrollIntoView = function (this: HTMLElement, options?: boolean | ScrollIntoViewOptions) {
      behaviors.push(typeof options === 'object' ? options.behavior : undefined);
    };
    window.matchMedia = (() => ({ matches: true }) as MediaQueryList) as typeof window.matchMedia;
    try {
      expect(await el.search('needle')).to.equal(1);
      expect(behaviors).to.deep.equal(['auto']);
    } finally {
      HTMLElement.prototype.scrollIntoView = originalScrollIntoView;
      window.matchMedia = originalMatchMedia;
    }
  });

  it('recomputes an active search and re-emits lr-search-change when the effective locale changes on a loaded document', async () => {
    const el = (await fixture(html`<lr-xml-viewer .xml=${SIMPLE_XML}></lr-xml-viewer>`)) as LyraXmlViewer;
    await el.search('item');
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll('[data-match]').length).to.be.greaterThan(0);

    const eventPromise = oneEvent(el, 'lr-search-change');
    el.locale = 'fr';
    const event = await eventPromise as CustomEvent<{ query: string; matchCount: number }>;
    await el.updateComplete;
    expect(event.detail.query).to.equal('item');
    expect(event.detail.matchCount).to.be.greaterThan(0);
    expect(el.shadowRoot!.querySelectorAll('[data-match]').length).to.be.greaterThan(0);
  });

  it('matches only an element tag name, attribute names/values, and its own text -- never a comment, CDATA, or processing-instruction body', async () => {
    const el = (await fixture(html`<lr-xml-viewer .xml=${'<root><!-- secretword --><![CDATA[secretword]]><?pi secretword?><item>secretword</item></root>'}></lr-xml-viewer>`)) as LyraXmlViewer;
    const count = await el.search('secretword');
    // Only the <item> element's own text node counts as a hit -- the identical word living
    // inside the comment, CDATA section, and processing instruction is out of search's documented
    // scope and must not inflate the match count.
    expect(count).to.equal(1);
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll('[part="text"][data-match]').length).to.equal(1);
    expect(el.shadowRoot!.querySelectorAll('[part="comment"][data-match]').length).to.equal(0);
    expect(el.shadowRoot!.querySelectorAll('[part="cdata"][data-match]').length).to.equal(0);
    expect(el.shadowRoot!.querySelectorAll('[part="pi"][data-match]').length).to.equal(0);
  });

  it('a query matching only an attribute name (not its value) still marks that attribute-value part as matched', async () => {
    const el = (await fixture(html`<lr-xml-viewer .xml=${SIMPLE_XML}></lr-xml-viewer>`)) as LyraXmlViewer;
    // Both <item> elements carry an "id" attribute whose own value ("1"/"2") does not contain
    // "id" -- the hit comes solely from the attribute NAME, exercising the name-matching arm of
    // computeSearch()'s attribute loop rather than the (separately tested) value-matching arm.
    const count = await el.search('id');
    expect(count).to.equal(2);
    await el.updateComplete;
    const matchedValues = [...el.shadowRoot!.querySelectorAll('[part="attribute-value"][data-match]')].map((n) => n.textContent);
    expect(matchedValues).to.deep.equal(['1', '2']);
  });

  it('search()/clearSearch() fall back to an empty search state before any document is loaded', async () => {
    const el = (await fixture(html`<lr-xml-viewer></lr-xml-viewer>`)) as LyraXmlViewer;
    const count = await el.search('anything');
    expect(count).to.equal(0);
    el.clearSearch();
    await el.updateComplete;
    expect((el.shadowRoot!.querySelector('[data-match]')) == null).to.be.true;
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
    const eventPromise = oneEvent(el, 'lr-anchor-result');
    expect(await el.scrollToAnchor({ kind: 'node-path', path: [0, 1] })).to.be.true;
    const event = await eventPromise as CustomEvent<{ found: boolean }>;
    expect(event.detail).to.deep.equal({ found: true });
    expect(event.cancelable).to.be.false;
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

  it('distinguishes the specific attribute a trailing @segment addresses, not just its owning element', async () => {
    const multiAttr = '<root><item><link href="https://a.test" rel="next" title="A">A</link></item></root>';
    const el = (await fixture(html`<lr-xml-viewer .xml=${multiAttr}></lr-xml-viewer>`)) as LyraXmlViewer;
    await el.updateComplete;
    (el as unknown as { anchorTimeoutMs: number }).anchorTimeoutMs = 30;
    (el as unknown as { anchorRetryIntervalMs: number }).anchorRetryIntervalMs = 5;

    expect(await el.scrollToAnchor({ kind: 'node-path', path: [0, 0, '@rel'] })).to.be.true;
    await el.updateComplete;
    const active = el.shadowRoot!.querySelectorAll('[part="attribute"][data-active]');
    // Exactly one of the three attributes is distinguished, and it is the addressed one -- a
    // consumer citing one attribute value of a multi-attribute element could otherwise not tell
    // from the rendered DOM which attribute was meant.
    expect(active.length).to.equal(1);
    expect(active[0]!.querySelector('[part="attribute-name"]')!.textContent).to.equal('rel');
    expect(getComputedStyle(active[0]! as HTMLElement).outlineStyle).to.equal('solid');

    // Re-anchoring at element granularity clears the attribute-level distinction again.
    expect(await el.scrollToAnchor({ kind: 'node-path', path: [0, 0] })).to.be.true;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll('[part="attribute"][data-active]').length).to.equal(0);
  });

  it('resolves false for an empty or missing trailing attribute segment', async () => {
    const el = (await fixture(html`<lr-xml-viewer .xml=${RSS_XML}></lr-xml-viewer>`)) as LyraXmlViewer;
    await el.updateComplete;
    (el as unknown as { anchorTimeoutMs: number }).anchorTimeoutMs = 30;
    (el as unknown as { anchorRetryIntervalMs: number }).anchorRetryIntervalMs = 5;
    expect(await el.scrollToAnchor({ kind: 'node-path', path: [0, 1, 0, '@'] })).to.be.false;
    expect(await el.scrollToAnchor({ kind: 'node-path', path: [0, 1, 0, '@missing'] })).to.be.false;
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

  it('fails closed with a resource error instead of overflowing render on a deeply nested document', async () => {
    const depth = 1_500;
    const deep = `${'<n>'.repeat(depth)}leaf${'</n>'.repeat(depth)}`;
    const el = (await fixture(html`<lr-xml-viewer></lr-xml-viewer>`)) as LyraXmlViewer;
    const eventPromise = oneEvent(el, 'lr-render-error');
    el.xml = deep;
    await eventPromise;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll('[part="error"]').length).to.equal(1);
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

  it('mirrors a collapsed chevron for inherited RTL while keeping the expanded chevron downward', async () => {
    const wrapper = await fixture<HTMLDivElement>(html`
      <div dir="ltr">
        <lr-xml-viewer
          style="--lr-transition-fast: 0ms"
          collapsed-depth="0"
          .xml=${SIMPLE_XML}
        ></lr-xml-viewer>
      </div>
    `);
    const el = wrapper.querySelector('lr-xml-viewer') as LyraXmlViewer;
    await el.updateComplete;
    const toggle = el.shadowRoot!.querySelector('[part="toggle"]') as HTMLButtonElement;
    const chevron = toggle.querySelector('.chevron') as HTMLElement;
    const matrix = (): DOMMatrix => {
      const transform = getComputedStyle(chevron).transform;
      return transform === 'none' ? new DOMMatrix() : new DOMMatrix(transform);
    };

    expect(toggle.getAttribute('aria-expanded')).to.equal('false');
    expect(matrix().a).to.be.closeTo(1, 0.001);
    wrapper.dir = 'rtl';
    await waitUntil(() => matrix().a < -0.99);
    expect(matrix().a).to.be.closeTo(-1, 0.001);

    toggle.click();
    await el.updateComplete;
    expect(toggle.getAttribute('aria-expanded')).to.equal('true');
    expect(matrix().a).to.be.closeTo(0, 0.001);
    expect(matrix().b).to.be.closeTo(1, 0.001);
  });
});

describe('accessibility', () => {
  it('leaves a non-empty host accessible name on the host instead of duplicating a region owner', async () => {
    const el = (await fixture(html`<lr-xml-viewer aria-label="XML source" .xml=${SIMPLE_XML}></lr-xml-viewer>`)) as LyraXmlViewer;
    const base = el.shadowRoot!.querySelector('[part="base"]')!;
    expect(base.getAttribute('role')).to.be.null;
    expect(base.getAttribute('aria-label')).to.be.null;
    expect(el.getAttribute('aria-label')).to.equal('XML source');
  });

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
  it("a consumer's ::part(copy-button):hover wins over the internal reveal rule", async function () {
    if (window.matchMedia('(hover: none), (pointer: coarse)').matches) this.skip();
    // The reveal rule inside the shadow root is full-specificity ((0,3,0)) and this consumer
    // selector is (0,1,1) -- it still wins, because an outer tree's declarations sort ahead of the
    // shadow tree's regardless of specificity. Read off the rendered element under a real pointer,
    // never off the stylesheet text: the previous version of this test asserted the selector shape
    // instead and passed the whole time the reveal rule itself was being out-specificitied into
    // never applying.
    const style = document.createElement('style');
    style.textContent = `lr-xml-viewer::part(copy-button):hover { opacity: 0.5; }`;
    document.head.appendChild(style);
    try {
      const el = (await fixture(html`<lr-xml-viewer .xml=${SIMPLE_XML} copyable></lr-xml-viewer>`)) as LyraXmlViewer;
      await el.updateComplete;
      const button = el.shadowRoot!.querySelector('.row [part="copy-button"]') as HTMLElement;
      button.scrollIntoView({ block: 'center', inline: 'center' });
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const rect = button.getBoundingClientRect();
      await resetMouse();
      await sendMouse({
        type: 'move',
        position: [Math.round(rect.left + rect.width / 2), Math.round(rect.top + rect.height / 2)],
      });
      await waitUntil(
        () => getComputedStyle(button).opacity === '0.5',
        "the consumer's ::part(copy-button):hover opacity never took effect",
      );
    } finally {
      await resetMouse();
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
  it('uses a non-interactive alignment placeholder instead of a CSS-revealable hidden button', async () => {
    const el = (await fixture(
      html`<lr-xml-viewer .xml=${'<root><empty/><item>x</item></root>'}></lr-xml-viewer>`,
    )) as LyraXmlViewer;
    await el.updateComplete;
    const toggles = [...el.shadowRoot!.querySelectorAll('[part="toggle"]')] as HTMLButtonElement[];
    expect(toggles).to.have.lengthOf(2); // root and <item>; <empty/> owns no button at all
    const placeholder = el.shadowRoot!.querySelector('[part="toggle-placeholder"]')!;
    expect(placeholder.localName).to.equal('span');
    expect(placeholder.getAttribute('aria-hidden')).to.equal('true');
    expect(placeholder.hasAttribute('tabindex')).to.be.false;
    expect(placeholder.hasAttribute('aria-expanded')).to.be.false;
  });

  it('renders a bare root element with no children of any kind as one row, distinct from the error and no-document states', async () => {
    const el = (await fixture(html`<lr-xml-viewer .xml=${'<root></root>'}></lr-xml-viewer>`)) as LyraXmlViewer;
    await el.updateComplete;
    // A well-formed but entirely empty document is its own valid "loaded" render -- neither the
    // parse-error region nor the no-src/no-xml placeholder state.
    expect(el.shadowRoot!.querySelectorAll('[part="error"]').length).to.equal(0);
    expect(el.shadowRoot!.querySelectorAll('[part="tag"]').length).to.equal(1);
    expect(el.shadowRoot!.querySelector('[part="tag"]')!.textContent).to.equal('root');
    expect(el.shadowRoot!.querySelectorAll('[part="toggle"]').length).to.equal(0);
    const placeholder = el.shadowRoot!.querySelector('[part="toggle-placeholder"]');
    expect(placeholder !== null).to.equal(true);
  });

  it('preserves an explicitly empty host aria-label on the region owner', async () => {
    const el = await fixture<LyraXmlViewer>(
      html`<lr-xml-viewer name="Named document" aria-label="" .xml=${SIMPLE_XML}></lr-xml-viewer>`,
    );
    const base = el.shadowRoot!.querySelector('[part="base"]')!;
    expect(base.hasAttribute('aria-label')).to.be.true;
    expect(base.getAttribute('aria-label')).to.equal('');
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

  it('preserves mixed element, text, comment, CDATA, and processing-instruction source order', async () => {
    const el = await fixture<LyraXmlViewer>(html`
      <lr-xml-viewer
        .xml=${'<root>before<a/>between<!--note--><b/><![CDATA[data]]><?app value?>after</root>'}
      ></lr-xml-viewer>
    `);
    const rows = Array.from(el.shadowRoot!.querySelectorAll(
      '[part="node"], [part="text"], [part="comment"], [part="cdata"], [part="pi"]',
    ));
    const sequence = rows.map((row) => {
      const parts = row.getAttribute('part') ?? '';
      if (parts.split(/\s+/).includes('node')) {
        return `node:${row.querySelector('[part="tag"]')?.textContent ?? ''}`;
      }
      return `${parts}:${row.textContent?.trim() ?? ''}`;
    });
    expect(sequence).to.deep.equal([
      'node:root',
      'text:before',
      'node:a',
      'text:between',
      'comment:<!--note-->',
      'node:b',
      'cdata:<![CDATA[data]]>',
      'pi:<?app value?>',
      'text:after',
    ]);
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

  it('counts rendered text, comment, CDATA, and processing-instruction children in the preview', async () => {
    const el = await fixture<LyraXmlViewer>(
      html`<lr-xml-viewer
        .xml=${'<root>text<!--note--><![CDATA[data]]><?app value?></root>'}
        collapsed-depth="0"
      ></lr-xml-viewer>`,
    );
    expect(el.shadowRoot!.querySelector('.preview')!.textContent).to.equal('4 children');
  });
});

describe('per-node copy button', () => {
  it("copies a single node's serialized XML and stops the click from also toggling its row", async () => {
    const restore = stubClipboard(navigator, { writeText: async () => {} });
    try {
      const el = (await fixture(html`<lr-xml-viewer .xml=${SIMPLE_XML} copyable></lr-xml-viewer>`)) as LyraXmlViewer;
      await el.updateComplete;
      const nodeButtons = [...el.shadowRoot!.querySelectorAll('[part="node"] [part="copy-button"]')] as HTMLButtonElement[];
      const itemButton = nodeButtons[0]; // the first element row's own per-node button
      const eventPromise = oneEvent(el, 'lr-copy');
      itemButton.click();
      const event = await eventPromise;
      expect(event.detail).to.deep.include({ ok: true });
      expect(event.detail.text).to.include('<item');
      // A row-toggle click would have flipped an aria-expanded value; none did.
      expect(el.shadowRoot!.querySelectorAll('[part="toggle"][aria-expanded="false"]').length).to.equal(0);
    } finally {
      restore();
    }
  });
});

describe('clipboard failures', () => {
  it('localizes failure and emits lr-error/lr-copy-error, never lr-copy, after a synchronous throw', async () => {
    const error = new Error('denied');
    const restore = stubClipboard(navigator, { writeText: () => { throw error; } });
    try {
      const el = (await fixture(html`<lr-xml-viewer .xml=${SIMPLE_XML} copyable></lr-xml-viewer>`)) as LyraXmlViewer;
      el.strings = { copyFailed: 'Échec de la copie' };
      await el.updateComplete;
      const button = el.shadowRoot!.querySelector('[part="toolbar"] [part="copy-button"]') as HTMLButtonElement;
      let copies = 0;
      el.addEventListener('lr-copy', () => copies++);
      const genericError = oneEvent(el, 'lr-error');
      const detailedError = oneEvent(el, 'lr-copy-error');
      button.click();
      await genericError;
      const event = await detailedError;
      expect(copies).to.equal(0);
      expect(event.detail).to.deep.include({ ok: false, reason: 'failed', error });
      expect(event.detail.text).to.include('<root>');
      await el.updateComplete;
      expect(button.textContent!.trim()).to.equal('Échec de la copie');
      expect(button.getAttribute('aria-label')).to.equal('Échec de la copie');
    } finally {
      restore();
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

// -- Document-renderer registry entry ---------------------------------------

it('registers a application/xml renderer whose matches() and render() behave as declared', async () => {
  const { getDefaultDocumentRendererRegistry } = await import('../document-viewer/registry.js');
  const def = getDefaultDocumentRendererRegistry().get('application/xml');
  expect(def, 'importing the module registers the renderer').to.exist;
  expect(def!.matches!({ name: 'report.XML', mimeType: 'application/xml', src: 'https://example.test/f' }), 'report.XML').to.be.true;
  expect(def!.matches!({ name: 'feed.atom', mimeType: 'application/atom+xml', src: 'https://example.test/f' }), 'feed.atom').to.be.true;
  expect(def!.matches!({ name: 'notes.txt', mimeType: 'text/plain', src: 'https://example.test/f' }), 'notes.txt').to.be.false;
  expect(def!.capabilities, 'capabilities are declared for host feature-detection').to.exist;

  const host = (await fixture(html`<div>${def!.render!({
    name: 'report.XML', mimeType: 'application/xml', src: 'https://example.test/f',
  })}</div>`)) as HTMLElement;
  expect(host.querySelector('lr-xml-viewer'), 'render() produces the viewer element').to.exist;
});

it('also registers the same definition under text/xml', async () => {
  const { getDefaultDocumentRendererRegistry } = await import('../document-viewer/registry.js');
  const registry = getDefaultDocumentRendererRegistry();
  expect(registry.get('text/xml')).to.equal(registry.get('application/xml'));
});

// -- Non-integer node-path segments must not produce a false "found" ----------

describe('non-integer node-path segments', () => {
  const armed = async (): Promise<LyraXmlViewer> => {
    const el = (await fixture(html`<lr-xml-viewer .xml=${RSS_XML}></lr-xml-viewer>`)) as LyraXmlViewer;
    await el.updateComplete;
    (el as unknown as { anchorTimeoutMs: number }).anchorTimeoutMs = 30;
    (el as unknown as { anchorRetryIntervalMs: number }).anchorRetryIntervalMs = 5;
    return el;
  };

  it('reports not-found for a fractional or NaN trailing segment instead of a phantom jump', async () => {
    for (const path of [[0.5], [Number.NaN]]) {
      const el = await armed();
      expect(await el.scrollToAnchor({ kind: 'node-path', path }), JSON.stringify(path)).to.be.false;
      await el.updateComplete;
      expect(el.shadowRoot!.querySelectorAll('[data-active]').length, 'nothing may be active').to.equal(0);
    }
  });

  it('resolves false rather than rejecting when a non-trailing segment is non-integer', async () => {
    const el = await armed();
    let rejected = false;
    const result = await el.scrollToAnchor({ kind: 'node-path', path: [0.5, 0] }).catch(() => {
      rejected = true;
      return undefined;
    });
    expect(rejected, 'scrollToAnchor must never reject -- lr-anchor-result would never fire').to.be.false;
    expect(result).to.be.false;
  });
});

it('searchNext/searchPrevious resolve a boolean, matching the shared viewer search contract', async () => {
  // `internal/text-viewer-target.ts`'s `LyraTextViewerTarget` declares both as
  // `Promise<boolean>`. These returned `void`, so a host driving several viewers through that one
  // typed surface -- `if (await viewer.searchNext())` -- got `undefined` here and took the
  // "nothing to move to" branch on every press, while every other viewer returned a real boolean.
  const el = (await fixture(html`<lr-xml-viewer .xml=${'<root><first>foo</first><second>bar</second></root>'}></lr-xml-viewer>`)) as LyraXmlViewer;
  await el.updateComplete;

  expect(await el.search('foo')).to.be.greaterThan(0);
  expect(await el.searchNext(), 'moved to the next match').to.be.true;
  expect(await el.searchPrevious(), 'moved to the previous match').to.be.true;

  expect(await el.search('__definitely_absent__')).to.equal(0);
  expect(await el.searchNext(), 'no matches to move to').to.be.false;
  expect(await el.searchPrevious(), 'no matches to move to').to.be.false;
});

describe('host-supplied highlights', () => {
  const HIGHLIGHT_XML = '<root><alpha id="a">One</alpha><beta id="b">Two</beta><gamma id="c">Three</gamma></root>';

  function nodeRows(el: LyraXmlViewer): HTMLElement[] {
    return Array.from(el.shadowRoot!.querySelectorAll<HTMLElement>('[part~="node"]'));
  }

  it('paints a node-path highlight on the addressed element row, with its tone', async () => {
    const el = (await fixture(html`<lr-xml-viewer .xml=${HIGHLIGHT_XML}></lr-xml-viewer>`)) as LyraXmlViewer;
    await el.updateComplete;

    el.highlights = [{ id: 'h1', tone: 'success', anchor: { kind: 'node-path', path: [1] } }];
    await el.updateComplete;

    const highlighted = nodeRows(el).filter((row) => row.hasAttribute('data-highlight'));
    expect(highlighted.length, 'exactly the addressed element row is painted').to.equal(1);
    expect(highlighted[0]!.querySelector('[part="tag"]')!.textContent).to.equal('beta');
    expect(highlighted[0]!.getAttribute('data-highlight')).to.equal('success');
    // Rendered result, not stylesheet text: the tint must actually reach the box.
    expect(getComputedStyle(highlighted[0]!).backgroundColor).to.not.equal('rgba(0, 0, 0, 0)');
  });

  it('defaults an untoned highlight to accent and clears painting when highlights are removed', async () => {
    const el = (await fixture(html`<lr-xml-viewer .xml=${HIGHLIGHT_XML}></lr-xml-viewer>`)) as LyraXmlViewer;
    await el.updateComplete;

    el.highlights = [{ id: 'h1', anchor: { kind: 'node-path', path: [0] } }];
    await el.updateComplete;
    expect(nodeRows(el).filter((row) => row.hasAttribute('data-highlight'))[0]!.getAttribute('data-highlight'))
      .to.equal('accent');

    el.highlights = [];
    await el.updateComplete;
    expect(nodeRows(el).filter((row) => row.hasAttribute('data-highlight')).length).to.equal(0);
  });

  it('exposes each highlight as a focusable action emitting lr-highlight-activate', async () => {
    const el = (await fixture(html`<lr-xml-viewer .xml=${HIGHLIGHT_XML}></lr-xml-viewer>`)) as LyraXmlViewer;
    await el.updateComplete;

    el.highlights = [
      { id: 'h1', anchor: { kind: 'node-path', path: [0] }, label: 'First finding' },
      { id: 'h2', anchor: { kind: 'node-path', path: [2] } },
    ];
    await el.updateComplete;

    const actions = Array.from(el.shadowRoot!.querySelectorAll<HTMLButtonElement>('[part="highlight-action"]'));
    expect(actions.length).to.equal(2);
    expect(actions[0]!.getAttribute('aria-label')).to.equal('Highlight: First finding');
    expect(actions[1]!.getAttribute('aria-label')).to.equal('Highlight 2 of 2');

    const activated = oneEvent(el, 'lr-highlight-activate');
    actions[1]!.click();
    const event = await activated as CustomEvent<{ highlightId: string }>;
    expect(event.detail.highlightId).to.equal('h2');
    expect(event.cancelable).to.be.false;
  });

  it('marks the activeHighlightId row so a host can show which citation is current', async () => {
    const el = (await fixture(html`<lr-xml-viewer .xml=${HIGHLIGHT_XML}></lr-xml-viewer>`)) as LyraXmlViewer;
    await el.updateComplete;

    el.highlights = [
      { id: 'h1', anchor: { kind: 'node-path', path: [0] } },
      { id: 'h2', anchor: { kind: 'node-path', path: [1] } },
    ];
    el.activeHighlightId = 'h2';
    await el.updateComplete;

    const active = nodeRows(el).filter((row) => row.hasAttribute('data-active-highlight'));
    expect(active.length).to.equal(1);
    expect(active[0]!.querySelector('[part="tag"]')!.textContent).to.equal('beta');
    expect(getComputedStyle(active[0]!).outlineStyle).to.equal('solid');
  });

  it('bounds painted highlights while retaining an active entry beyond the candidate cap', async () => {
    const xml = `<root>${Array.from({ length: 1_001 }, (_, index) => `<item-${index}/>`).join('')}</root>`;
    const el = (await fixture(html`<lr-xml-viewer .xml=${xml}></lr-xml-viewer>`)) as LyraXmlViewer;
    await el.updateComplete;
    el.highlights = Array.from({ length: 1_001 }, (_, index) => ({
      id: `h${index}`,
      anchor: { kind: 'node-path' as const, path: [index] },
    }));
    el.activeHighlightId = 'h1000';
    await el.updateComplete;

    expect(el.shadowRoot!.querySelectorAll('[part="highlight-action"]').length).to.equal(100);
    const active = nodeRows(el).filter((row) => row.hasAttribute('data-active-highlight'));
    expect(active).to.have.length(1);
    expect(active[0]!.querySelector('[part="tag"]')!.textContent).to.equal('item-1000');
  });

  it('ignores highlights whose anchor kind or path this viewer cannot resolve', async () => {
    const el = (await fixture(html`<lr-xml-viewer .xml=${HIGHLIGHT_XML}></lr-xml-viewer>`)) as LyraXmlViewer;
    await el.updateComplete;

    el.highlights = [
      { id: 'wrong-kind', anchor: { kind: 'page', page: 2 } },
      { id: 'out-of-range', anchor: { kind: 'node-path', path: [99] } },
      { id: 'bad-attr', anchor: { kind: 'node-path', path: [0, '@missing'] } },
    ];
    await el.updateComplete;

    expect(nodeRows(el).filter((row) => row.hasAttribute('data-highlight')).length).to.equal(0);
    expect(el.shadowRoot!.querySelectorAll('[part="highlight-action"]').length).to.equal(0);
  });

  it('is accessible with highlights painted', async () => {
    const el = (await fixture(html`<lr-xml-viewer .xml=${HIGHLIGHT_XML}></lr-xml-viewer>`)) as LyraXmlViewer;
    await el.updateComplete;
    el.highlights = [{ id: 'h1', tone: 'danger', anchor: { kind: 'node-path', path: [1] } }];
    await el.updateComplete;
    await expect(el).to.be.accessible();
  });
});

describe('per-row copy-button reveal', () => {
  /** Two animation frames -- enough for a pointer move to have been dispatched and the resulting
   *  :hover state to have been applied and painted. */
  async function nextFrames(): Promise<void> {
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  }

  async function moveMouseTo(target: HTMLElement): Promise<void> {
    target.scrollIntoView({ block: 'center', inline: 'center' });
    await nextFrames();
    const rect = target.getBoundingClientRect();
    await sendMouse({
      type: 'move',
      position: [Math.round(rect.left + rect.width / 2), Math.round(rect.top + rect.height / 2)],
    });
    await nextFrames();
  }

  /** The document-element row, which carries both a real toggle button and its own copy button. */
  async function rootRow(): Promise<{ row: HTMLElement; button: HTMLElement }> {
    const el = (await fixture(
      html`<lr-xml-viewer .xml=${SIMPLE_XML} copyable></lr-xml-viewer>`,
    )) as LyraXmlViewer;
    await el.updateComplete;
    const row = el.shadowRoot!.querySelector<HTMLElement>('[part~="node"]')!;
    return { row, button: row.querySelector('[part="copy-button"]') as HTMLElement };
  }

  it('holds a per-row copy button hidden at rest', async () => {
    const { button } = await rootRow();
    expect(getComputedStyle(button).opacity).to.equal('0');
  });

  it('reveals a per-row copy button while the pointer rests on its row', async function () {
    if (window.matchMedia('(hover: none), (pointer: coarse)').matches) this.skip();
    const { row, button } = await rootRow();
    expect(getComputedStyle(button).opacity).to.equal('0');
    try {
      await resetMouse();
      await moveMouseTo(row);
      await waitUntil(
        () => getComputedStyle(button).opacity === '1',
        'row :hover never revealed the per-row copy button',
      );
    } finally {
      await resetMouse();
    }
  });

  it('reveals a per-row copy button while focus is anywhere inside its row', async () => {
    const { row, button } = await rootRow();
    expect(getComputedStyle(button).opacity).to.equal('0');
    // Focus a DIFFERENT control in the row -- the disclosure toggle -- so the reveal can only
    // come from the row's :focus-within arm, never from the button's own :focus-visible rule.
    const toggle = row.querySelector('[part="toggle"]') as HTMLElement;
    expect(toggle != null, 'expected a disclosure toggle in the document-element row').to.equal(true);
    toggle.focus();
    await waitUntil(
      () => getComputedStyle(button).opacity === '1',
      'row :focus-within never revealed the per-row copy button',
    );
  });

  it('leaves the toolbar copy button visible at rest -- it has no ancestor row', async () => {
    const el = (await fixture(
      html`<lr-xml-viewer .xml=${SIMPLE_XML} copyable></lr-xml-viewer>`,
    )) as LyraXmlViewer;
    await el.updateComplete;
    const toolbarButton = el.shadowRoot!.querySelector(
      '[part="toolbar"] [part="copy-button"]',
    ) as HTMLElement;
    expect(getComputedStyle(toolbarButton).opacity).to.equal('1');
  });
});
