import { aTimeout, expect, fixture, html, oneEvent, waitUntil } from '@open-wc/testing';
import './include.js';
import type { LyraInclude } from './include.js';
import { __setHtmlSanitizerForTesting } from '../html-viewer/dompurify-loader.js';
import type { HtmlSanitizer } from '../../../internal/optional-peer-capabilities.js';
import {
  __clearIncludeResourceCacheForTesting,
  MAX_INCLUDE_BYTES,
} from './include-resource.js';

interface MockResponseOptions {
  ok?: boolean;
  status?: number;
  contentLength?: number;
}

function response(body: string, opts: MockResponseOptions = {}): Response {
  const { ok = true, status = ok ? 200 : 500, contentLength } = opts;
  return {
    ok,
    status,
    statusText: ok ? 'OK' : 'Error',
    text: () => Promise.resolve(body),
    headers: {
      get: (name: string) => (contentLength !== undefined && name.toLowerCase() === 'content-length' ? String(contentLength) : null),
    },
  } as unknown as Response;
}

function abortError(): Error {
  const error = new Error('The operation was aborted.');
  error.name = 'AbortError';
  return error;
}

describe('lr-include', () => {
  afterEach(() => {
    __setHtmlSanitizerForTesting(undefined);
    __clearIncludeResourceCacheForTesting();
  });

  it('is a no-op when src is unset: no fetch, no aria-busy', async () => {
    let called = false;
    const original = window.fetch;
    window.fetch = (() => { called = true; return Promise.reject(new Error('fetch should not be called')); }) as typeof window.fetch;
    try {
      const el = await fixture<LyraInclude>(html`<lr-include></lr-include>`);
      await el.updateComplete;
      await aTimeout(10);
      expect(called).to.equal(false);
      expect(el.getAttribute('aria-busy')).to.equal('false');
      el.src = '   ';
      await aTimeout(10);
      expect(called, 'whitespace-only src is also empty').to.equal(false);
      expect(el.getAttribute('aria-busy')).to.equal('false');
    } finally { window.fetch = original; }
  });

  it('shows author-supplied fallback content and sets aria-busy while a fetch is in flight', async () => {
    const original = window.fetch;
    let resolveFetch!: (value: Response) => void;
    window.fetch = (() => new Promise<Response>((resolve) => { resolveFetch = resolve; })) as typeof window.fetch;
    try {
      const el = await fixture<LyraInclude>(html`<lr-include src="https://example.test/pending.html">Loading…</lr-include>`);
      await waitUntil(() => el.getAttribute('aria-busy') === 'true');
      expect(el.getAttribute('aria-busy')).to.equal('true');
      expect(el.textContent).to.equal('Loading…');
      resolveFetch(response('<p>Done</p>'));
      await waitUntil(() => el.querySelector('p') !== null);
    } finally { window.fetch = original; }
  });

  it('fetches, sanitizes, and emits lr-load with the resolved src', async () => {
    const original = window.fetch;
    window.fetch = (() => Promise.resolve(response('<h1>Safe</h1><script>alert(1)</script>'))) as typeof window.fetch;
    try {
      const el = await fixture<LyraInclude>(html`<lr-include></lr-include>`);
      const loadPromise = oneEvent(el, 'lr-load');
      el.src = 'https://example.test/a.html';
      const event = await loadPromise;
      expect(event.detail.src).to.equal('https://example.test/a.html');
      // Light DOM, not shadow DOM: the fetched fragment becomes the host's
      // own children, projected through the shadow root's default <slot>.
      expect((el.querySelector('script')) == null).to.equal(true);
      expect(el.querySelector('h1')!.textContent).to.equal('Safe');
      expect(el.getAttribute('aria-busy')).to.equal('false');
    } finally { window.fetch = original; }
  });

  it('isolates retained remote work by owner realm and uses owner URL, fetch, and cancellation', async () => {
    const iframe = document.createElement('iframe');
    document.body.append(iframe);
    const frameDocument = iframe.contentDocument!;
    const frameWindow = iframe.contentWindow!;
    const base = frameDocument.createElement('base');
    base.href = 'https://realm-cache.example/base/';
    frameDocument.head.append(base);
    const ParentAbortController = window.AbortController;
    const OwnerAbortController = frameWindow.AbortController;
    const ParentURL = window.URL;
    const OwnerURL = frameWindow.URL;
    const originalParentFetch = window.fetch;
    const originalOwnerFetch = frameWindow.fetch;
    let parentControllers = 0;
    let ownerControllers = 0;
    let parentUrlCreations = 0;
    let ownerUrlCreations = 0;
    let parentFetches = 0;
    let ownerFetches = 0;

    class ParentTrackedAbortController extends ParentAbortController {
      constructor() {
        super();
        parentControllers++;
      }
    }
    class OwnerTrackedAbortController extends OwnerAbortController {
      constructor() {
        super();
        ownerControllers++;
      }
    }
    class ParentTrackedURL extends ParentURL {
      constructor(url: string | URL, baseUrl?: string | URL) {
        super(url, baseUrl);
        parentUrlCreations++;
      }
    }
    class OwnerTrackedURL extends OwnerURL {
      constructor(url: string | URL, baseUrl?: string | URL) {
        super(url, baseUrl);
        ownerUrlCreations++;
      }
    }

    window.AbortController = ParentTrackedAbortController;
    frameWindow.AbortController = OwnerTrackedAbortController;
    window.URL = ParentTrackedURL;
    frameWindow.URL = OwnerTrackedURL;
    window.fetch = (() => {
      parentFetches++;
      return Promise.resolve(response('<p>Parent realm</p>'));
    }) as typeof fetch;
    frameWindow.fetch = (() => {
      ownerFetches++;
      return Promise.resolve(response('<p>Owner realm</p>'));
    }) as typeof fetch;

    let ownerElement: LyraInclude | undefined;
    try {
      const parentElement = await fixture<LyraInclude>(html`
        <lr-include src="https://realm-cache.example/base/shared.html"></lr-include>
      `);
      await waitUntil(() => parentElement.textContent === 'Parent realm');
      const parentUrlsAfterParentLoad = parentUrlCreations;

      ownerElement = await fixture<LyraInclude>(html`<lr-include></lr-include>`);
      frameDocument.body.append(frameDocument.adoptNode(ownerElement));
      const loaded = oneEvent(ownerElement, 'lr-load');
      ownerElement.src = 'shared.html';
      await loaded;

      expect(ownerElement.textContent).to.equal('Owner realm');
      expect(parentFetches).to.equal(1);
      expect(ownerFetches).to.equal(1);
      expect(parentControllers).to.equal(1);
      expect(ownerControllers).to.equal(1);
      expect(parentUrlCreations, 'owner resolution must not fall back to ambient URL').to.equal(
        parentUrlsAfterParentLoad,
      );
      expect(ownerUrlCreations).to.be.greaterThan(0);
    } finally {
      ownerElement?.remove();
      window.AbortController = ParentAbortController;
      frameWindow.AbortController = OwnerAbortController;
      window.URL = ParentURL;
      frameWindow.URL = OwnerURL;
      window.fetch = originalParentFetch;
      frameWindow.fetch = originalOwnerFetch;
      iframe.remove();
    }
  });

  it('invalidates an active search after fetched light-DOM content is replaced', async () => {
    const original = window.fetch;
    let body = '<p>needle</p>';
    window.fetch = (() => Promise.resolve(response(body))) as typeof window.fetch;
    try {
      const el = await fixture<LyraInclude>(html`<lr-include></lr-include>`);
      let searchChanges = 0;
      let lastMatchCount = -1;
      el.addEventListener('lr-search-change', (event) => {
        searchChanges++;
        lastMatchCount = (event as CustomEvent<{ matchCount: number }>).detail.matchCount;
      });
      const firstLoad = oneEvent(el, 'lr-load');
      el.src = 'https://example.test/first.html';
      await firstLoad;
      expect(await el.search('needle')).to.equal(1);

      body = '<p>replacement</p>';
      const secondLoad = oneEvent(el, 'lr-load');
      el.src = 'https://example.test/second.html';
      await secondLoad;
      await waitUntil(() => searchChanges >= 2);

      expect(lastMatchCount).to.equal(0);
      expect(await el.searchNext()).to.be.false;
    } finally {
      window.fetch = original;
    }
  });

  it('defaults mode to same-origin when the attribute is unset', async () => {
    const original = window.fetch;
    const calls: (RequestInit | undefined)[] = [];
    window.fetch = ((_url: string, init?: RequestInit) => { calls.push(init); return Promise.resolve(response('<p>ok</p>')); }) as typeof window.fetch;
    try {
      const el = await fixture<LyraInclude>(html`<lr-include src="https://example.test/default-mode.html"></lr-include>`);
      await waitUntil(() => calls.length > 0);
      await el.updateComplete;
      expect(calls[0]?.mode).to.equal('same-origin');
    } finally { window.fetch = original; }
  });

  it('forwards an explicit mode to fetch', async () => {
    const original = window.fetch;
    const calls: (RequestInit | undefined)[] = [];
    window.fetch = ((_url: string, init?: RequestInit) => { calls.push(init); return Promise.resolve(response('<p>ok</p>')); }) as typeof window.fetch;
    try {
      const el = await fixture<LyraInclude>(html`<lr-include src="https://example.test/cors-mode.html" mode="cors"></lr-include>`);
      await waitUntil(() => calls.length > 0);
      expect(calls[0]?.mode).to.equal('cors');
    } finally { window.fetch = original; }
  });

  it('blocks a disallowed URL scheme without calling fetch, and leaves existing content untouched', async () => {
    let called = false;
    const original = window.fetch;
    window.fetch = (() => { called = true; return Promise.reject(new Error('fetch should not be called')); }) as typeof window.fetch;
    try {
      const el = await fixture<LyraInclude>(html`<lr-include src="javascript:alert(1)">Fallback</lr-include>`);
      await el.updateComplete;
      await aTimeout(10);
      expect(called).to.equal(false);
      expect(el.textContent).to.equal('Fallback');
    } finally { window.fetch = original; }
  });

  it('emits lr-include-error with reason blocked-url for a disallowed scheme', async () => {
    const el = await fixture<LyraInclude>(html`<lr-include></lr-include>`);
    const errorPromise = oneEvent(el, 'lr-include-error');
    el.src = 'javascript:alert(1)';
    const event = await errorPromise;
    expect(event.detail.status).to.equal(0);
    expect(event.detail.reason).to.equal('blocked-url');
  });

  it('announces the same failure under both upstream spellings, with one shared detail object', async () => {
    // Web Awesome spells this `wa-include-error` and Shoelace spells it `sl-error`, so both
    // migrated listeners have to reach identical behaviour. Neither spelling is deprecated.
    const original = window.fetch;
    window.fetch = (() => Promise.resolve(response('', { ok: false, status: 503 }))) as typeof window.fetch;
    try {
      const el = await fixture<LyraInclude>(html`<lr-include>Fallback</lr-include>`);
      const canonicalPromise = oneEvent(el, 'lr-include-error');
      const aliasPromise = oneEvent(el, 'lr-error');
      el.src = 'https://example.test/unavailable.html';
      const [canonical, alias] = await Promise.all([canonicalPromise, aliasPromise]);
      expect(
        alias.detail === canonical.detail,
        'both names carry the very same detail object',
      ).to.equal(true);
      expect(alias.detail.status).to.equal(503);
      expect(alias.detail.reason).to.equal('http');
      expect(alias.bubbles).to.equal(canonical.bubbles);
      expect(alias.composed).to.equal(canonical.composed);
      expect(alias.cancelable, 'neither spelling is a veto point').to.equal(false);
      expect(canonical.cancelable).to.equal(false);
    } finally { window.fetch = original; }
  });

  it('emits the alias for a rejected src that never reaches fetch()', async () => {
    // The blocked-url path returns before `fail()`, so it needs its own coverage: an alias that
    // only fires from one of the two failure paths is worse than no alias at all.
    const el = await fixture<LyraInclude>(html`<lr-include></lr-include>`);
    const aliasPromise = oneEvent(el, 'lr-error');
    el.src = 'javascript:alert(1)';
    const event = await aliasPromise;
    expect(event.detail.status).to.equal(0);
    expect(event.detail.reason).to.equal('blocked-url');
  });

  it('does not emit the alias on a successful include', async () => {
    const original = window.fetch;
    window.fetch = (() => Promise.resolve(response('<p>Loaded</p>'))) as typeof window.fetch;
    try {
      const el = await fixture<LyraInclude>(html`<lr-include></lr-include>`);
      let aliasCount = 0;
      el.addEventListener('lr-error', () => { aliasCount += 1; });
      const loaded = oneEvent(el, 'lr-load');
      el.src = 'https://example.test/ok.html';
      await loaded;
      await aTimeout(10);
      expect(aliasCount).to.equal(0);
    } finally { window.fetch = original; }
  });

  it('emits lr-include-error with reason http for a failed fetch, without an unhandled rejection', async () => {
    const original = window.fetch;
    window.fetch = (() => Promise.resolve(response('', { ok: false, status: 404 }))) as typeof window.fetch;
    try {
      const el = await fixture<LyraInclude>(html`<lr-include>Fallback</lr-include>`);
      const errorPromise = oneEvent(el, 'lr-include-error');
      el.src = 'https://example.test/missing.html';
      const event = await errorPromise;
      expect(event.detail.status).to.equal(404);
      expect(event.detail.reason).to.equal('http');
      expect(el.textContent).to.equal('Fallback');
      expect(el.getAttribute('aria-busy')).to.equal('false');
    } finally { window.fetch = original; }
  });

  it('emits lr-include-error with reason network for a rejected fetch', async () => {
    const original = window.fetch;
    window.fetch = (() => Promise.reject(new Error('network down'))) as typeof window.fetch;
    try {
      const el = await fixture<LyraInclude>(html`<lr-include></lr-include>`);
      const errorPromise = oneEvent(el, 'lr-include-error');
      el.src = 'https://example.test/unreachable.html';
      const event = await errorPromise;
      expect(event.detail.status).to.equal(0);
      expect(event.detail.reason).to.equal('network');
      expect(event.detail.error).to.exist;
    } finally { window.fetch = original; }
  });

  it('emits lr-include-error with reason resource-too-large for an oversized response', async () => {
    const original = window.fetch;
    window.fetch = (() => Promise.resolve(response('<p>Too big</p>', { contentLength: MAX_INCLUDE_BYTES + 1 }))) as typeof window.fetch;
    try {
      const el = await fixture<LyraInclude>(html`<lr-include></lr-include>`);
      const errorPromise = oneEvent(el, 'lr-include-error');
      el.src = 'https://example.test/huge.html';
      const event = await errorPromise;
      expect(event.detail.status).to.equal(0);
      expect(event.detail.reason).to.equal('resource-too-large');
    } finally { window.fetch = original; }
  });

  it('emits lr-include-error with reason missing-sanitizer and writes nothing when the optional dompurify peer is unavailable', async () => {
    __setHtmlSanitizerForTesting(null);
    const original = window.fetch;
    window.fetch = (() => Promise.resolve(response('<p>Safe</p>'))) as typeof window.fetch;
    try {
      const el = await fixture<LyraInclude>(html`<lr-include>Fallback</lr-include>`);
      const errorPromise = oneEvent(el, 'lr-include-error');
      el.src = 'https://example.test/needs-sanitizer.html';
      const event = await errorPromise;
      expect(event.detail.status).to.equal(0);
      expect(event.detail.reason).to.equal('missing-sanitizer');
      expect(el.textContent).to.equal('Fallback');
    } finally { window.fetch = original; }
  });

  it('drops a stale response when src changes before the first request resolves', async () => {
    const original = window.fetch;
    const signals: (AbortSignal | null | undefined)[] = [];
    let resolveSecond!: (value: Response) => void;
    window.fetch = ((url: string, init?: RequestInit) => {
      signals.push(init?.signal);
      if (url === 'https://example.test/first.html') {
        // Never resolves on its own; only settles if the caller aborts it.
        return new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(abortError()));
        });
      }
      return new Promise<Response>((resolve) => { resolveSecond = resolve; });
    }) as typeof window.fetch;
    try {
      const el = await fixture<LyraInclude>(html`<lr-include src="https://example.test/first.html"></lr-include>`);
      await waitUntil(() => signals.length > 0);
      el.src = 'https://example.test/second.html';
      await waitUntil(() => signals.length > 1);
      expect(signals[0]?.aborted, 'the first request should have been aborted').to.equal(true);

      resolveSecond(response('<h1>Second</h1>'));
      await waitUntil(() => el.querySelector('h1') !== null);
      expect(el.querySelector('h1')!.textContent).to.equal('Second');
      expect((el.querySelector('p')) == null).to.equal(true);
    } finally { window.fetch = original; }
  });

  it('clears aria-busy when src is cleared to empty while a fetch is still in flight', async () => {
    const original = window.fetch;
    window.fetch = (() => new Promise<Response>(() => { /* never resolves */ })) as typeof window.fetch;
    try {
      const el = await fixture<LyraInclude>(html`<lr-include src="https://example.test/pending.html"></lr-include>`);
      await waitUntil(() => el.getAttribute('aria-busy') === 'true');
      el.src = '';
      await waitUntil(() => el.getAttribute('aria-busy') === 'false');
      expect(el.getAttribute('aria-busy')).to.equal('false');
    } finally { window.fetch = original; }
  });

  it('clears aria-busy when src switches to a blocked scheme while a fetch is still in flight', async () => {
    const original = window.fetch;
    window.fetch = (() => new Promise<Response>(() => { /* never resolves */ })) as typeof window.fetch;
    try {
      const el = await fixture<LyraInclude>(html`<lr-include src="https://example.test/pending.html"></lr-include>`);
      await waitUntil(() => el.getAttribute('aria-busy') === 'true');
      const errorPromise = oneEvent(el, 'lr-include-error');
      el.src = 'javascript:alert(1)';
      const event = await errorPromise;
      expect(event.detail.reason).to.equal('blocked-url');
      expect(el.getAttribute('aria-busy')).to.equal('false');
    } finally { window.fetch = original; }
  });

  it('is a no-op when src is cleared back to empty, leaving prior content untouched', async () => {
    const original = window.fetch;
    let callCount = 0;
    window.fetch = (() => { callCount++; return Promise.resolve(response('<p>content</p>')); }) as typeof window.fetch;
    try {
      const el = await fixture<LyraInclude>(html`<lr-include src="https://example.test/a.html">Fallback</lr-include>`);
      await waitUntil(() => el.querySelector('p') !== null);
      expect(callCount).to.equal(1);
      el.src = '';
      await aTimeout(20);
      expect(callCount).to.equal(1);
      expect((el.querySelector('p')) != null).to.equal(true);
    } finally { window.fetch = original; }
  });

  it('does not mutate content once disconnected mid-flight, and throws nothing', async () => {
    const original = window.fetch;
    let resolveFetch!: (value: Response) => void;
    window.fetch = (() => new Promise<Response>((resolve) => { resolveFetch = resolve; })) as typeof window.fetch;
    try {
      const el = await fixture<LyraInclude>(html`<lr-include src="https://example.test/slow.html">Fallback</lr-include>`);
      await waitUntil(() => el.getAttribute('aria-busy') === 'true');
      el.remove();
      resolveFetch(response('<h1>Late</h1>'));
      await aTimeout(20);
      expect((el.querySelector('h1')) == null).to.equal(true);
      expect(el.textContent).to.equal('Fallback');
    } finally { window.fetch = original; }
  });

  it('restarts an interrupted same-src load after reconnecting', async () => {
    const original = window.fetch;
    let calls = 0;
    window.fetch = ((_url: string, init?: RequestInit) => {
      calls++;
      if (calls === 1) {
        return new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(abortError()));
        });
      }
      return Promise.resolve(response('<h1>Reconnected</h1>'));
    }) as typeof window.fetch;
    try {
      const el = await fixture<LyraInclude>(
        html`<lr-include src="https://example.test/reconnect.html">Fallback</lr-include>`,
      );
      await waitUntil(() => el.getAttribute('aria-busy') === 'true');
      const parent = el.parentElement!;
      el.remove();
      parent.append(el);
      await waitUntil(() => el.querySelector('h1') !== null);
      expect(calls).to.equal(2);
      expect(el.querySelector('h1')!.textContent).to.equal('Reconnected');
    } finally { window.fetch = original; }
  });

  it('honors a load scheduled while detached, once reconnected', async () => {
    const original = window.fetch;
    window.fetch = (() => Promise.resolve(response('<h1>Reconnected</h1>'))) as typeof window.fetch;
    try {
      const el = document.createElement('lr-include') as LyraInclude;
      el.src = 'https://example.test/detached.html';
      await aTimeout(10);
      expect((el.querySelector('h1')) == null, 'nothing should load while detached').to.equal(true);
      document.body.append(el);
      await waitUntil(() => el.querySelector('h1') !== null);
      expect(el.querySelector('h1')!.textContent).to.equal('Reconnected');
      el.remove();
    } finally { window.fetch = original; }
  });

  it('never sets its own dir attribute', async () => {
    const original = window.fetch;
    window.fetch = (() => Promise.resolve(response('<p>content</p>'))) as typeof window.fetch;
    try {
      const el = await fixture<LyraInclude>(html`<lr-include src="https://example.test/dir-check.html"></lr-include>`);
      await waitUntil(() => el.querySelector('p') !== null);
      expect(el.hasAttribute('dir')).to.equal(false);
    } finally { window.fetch = original; }
  });

  it('renders default slotted content unchanged (the component introduces no built-in English copy)', async () => {
    const el = await fixture<LyraInclude>(html`<lr-include>Fallback text</lr-include>`);
    expect(el.textContent).to.equal('Fallback text');
  });

  it('clones same-page template content without fetching, moving sources, or duplicating ids', async () => {
    const original = window.fetch;
    let fetches = 0;
    window.fetch = (() => {
      fetches += 1;
      return Promise.reject(new Error('same-page fragments must not fetch'));
    }) as typeof window.fetch;
    const fixtureRoot = await fixture<HTMLDivElement>(html`
      <div>
        <template id="include-template">
          <label for="template-field">Template field</label>
          <input id="template-field" />
          <script>window.__includeScriptShouldNotRun = true;<\/script>
        </template>
        <lr-include>Fallback one</lr-include>
        <lr-include>Fallback two</lr-include>
      </div>
    `);
    try {
      const template = fixtureRoot.querySelector('template')!;
      const [first, second] = [...fixtureRoot.querySelectorAll<LyraInclude>('lr-include')];
      const firstLoaded = oneEvent(first, 'lr-load');
      const secondLoaded = oneEvent(second, 'lr-load');
      first.src = '#include-template';
      second.src = '#include-template';
      await Promise.all([firstLoaded, secondLoaded]);

      expect(fetches).to.equal(0);
      expect(template.content.querySelectorAll('input').length).to.equal(1);
      expect(first.querySelectorAll('input').length).to.equal(1);
      expect(second.querySelectorAll('input').length).to.equal(1);
      expect(first.querySelectorAll('script').length).to.equal(0);
      expect(second.querySelectorAll('script').length).to.equal(0);
      const firstInputId = first.querySelector('input')!.id;
      const secondInputId = second.querySelector('input')!.id;
      expect(firstInputId).to.not.equal('template-field');
      expect(secondInputId).to.not.equal(firstInputId);
      expect(first.querySelector('label')!.htmlFor).to.equal(firstInputId);
      expect(second.querySelector('label')!.htmlFor).to.equal(secondInputId);
      expect(document.querySelectorAll(`#${CSS.escape(firstInputId)}`).length).to.equal(1);
      expect(document.querySelectorAll(`#${CSS.escape(secondInputId)}`).length).to.equal(1);
    } finally {
      window.fetch = original;
    }
  });

  it('clones a same-page element’s children rather than the source wrapper', async () => {
    const fixtureRoot = await fixture<HTMLDivElement>(html`
      <div>
        <section id="include-element"><p>Element child</p></section>
        <lr-include></lr-include>
      </div>
    `);
    const source = fixtureRoot.querySelector('#include-element')!;
    const el = fixtureRoot.querySelector('lr-include') as LyraInclude;
    const loaded = oneEvent(el, 'lr-load');
    el.src = '#include-element';
    await loaded;

    expect(source.querySelectorAll('p').length).to.equal(1);
    expect(el.querySelectorAll(':scope > p').length).to.equal(1);
    expect(el.querySelectorAll(':scope > section').length).to.equal(0);
  });

  it('fetches a remote document without its fragment, sanitizes it, then selects the target', async () => {
    const original = window.fetch;
    const requested: string[] = [];
    window.fetch = ((url: string) => {
      requested.push(url);
      return Promise.resolve(
        response(
          '<main><section id="first">First</section><template id="chosen"><h2 id="heading">Chosen</h2><script>alert(1)<\/script></template></main>',
        ),
      );
    }) as typeof window.fetch;
    try {
      const el = await fixture<LyraInclude>(html`<lr-include>Fallback</lr-include>`);
      const loaded = oneEvent(el, 'lr-load');
      el.src = '/partials.html#chosen';
      await loaded;

      expect(requested).to.deep.equal([new URL('/partials.html', document.baseURI).href]);
      expect(el.textContent!.trim()).to.equal('Chosen');
      expect(el.querySelectorAll('script').length).to.equal(0);
      expect(el.querySelectorAll('#first').length).to.equal(0);
      expect(el.querySelector('h2')!.id).to.not.equal('heading');
    } finally {
      window.fetch = original;
    }
  });

  it('shares only fragmentless remote work while selecting each subscriber’s own fragment', async () => {
    const original = window.fetch;
    const requested: string[] = [];
    window.fetch = ((url: string) => {
      requested.push(url);
      return Promise.resolve(
        response('<section id="alpha"><p>Alpha</p></section><section id="beta"><p>Beta</p></section>'),
      );
    }) as typeof window.fetch;
    try {
      const first = await fixture<LyraInclude>(html`<lr-include></lr-include>`);
      const second = await fixture<LyraInclude>(html`<lr-include></lr-include>`);
      const firstLoaded = oneEvent(first, 'lr-load');
      const secondLoaded = oneEvent(second, 'lr-load');
      first.src = '/shared-partials.html#alpha';
      second.src = '/shared-partials.html#beta';
      await Promise.all([firstLoaded, secondLoaded]);

      expect(requested).to.deep.equal([
        new URL('/shared-partials.html', document.baseURI).href,
      ]);
      expect(first.textContent).to.equal('Alpha');
      expect(second.textContent).to.equal('Beta');
    } finally {
      window.fetch = original;
    }
  });

  it('keys retained resources by request mode as well as the fragmentless URL', async () => {
    const original = window.fetch;
    const modes: Array<RequestMode | undefined> = [];
    window.fetch = ((_url: string, init?: RequestInit) => {
      modes.push(init?.mode);
      return Promise.resolve(response('<p>Mode-specific response</p>'));
    }) as typeof window.fetch;
    try {
      const sameOrigin = await fixture<LyraInclude>(html`
        <lr-include src="https://example.test/mode-key.html"></lr-include>
      `);
      await waitUntil(() => sameOrigin.querySelector('p') !== null);
      const cors = await fixture<LyraInclude>(html`
        <lr-include src="https://example.test/mode-key.html" mode="cors"></lr-include>
      `);
      await waitUntil(() => cors.querySelector('p') !== null);
      expect(modes).to.deep.equal(['same-origin', 'cors']);
    } finally {
      window.fetch = original;
    }
  });

  it('reports a missing same-page or remote fragment without replacing prior content', async () => {
    const samePage = await fixture<LyraInclude>(html`<lr-include>Fallback</lr-include>`);
    const samePageError = oneEvent(samePage, 'lr-include-error');
    samePage.src = '#does-not-exist';
    expect((await samePageError).detail.reason).to.equal('missing-fragment');
    expect(samePage.textContent).to.equal('Fallback');

    const original = window.fetch;
    window.fetch = (() => Promise.resolve(response('<p id="available">Available</p>'))) as typeof window.fetch;
    try {
      const remote = await fixture<LyraInclude>(html`<lr-include>Prior</lr-include>`);
      const remoteError = oneEvent(remote, 'lr-include-error');
      remote.src = '/partials.html#missing';
      expect((await remoteError).detail.reason).to.equal('missing-fragment');
      expect(remote.textContent).to.equal('Prior');
    } finally {
      window.fetch = original;
    }
  });

  it('deduplicates sanitized requests and keeps shared work alive for a connected subscriber', async () => {
    const original = window.fetch;
    let calls = 0;
    let signal: AbortSignal | null | undefined;
    let resolveFetch!: (value: Response) => void;
    window.fetch = ((_url: string, init?: RequestInit) => {
      calls += 1;
      signal = init?.signal;
      return new Promise<Response>((resolve, reject) => {
        resolveFetch = resolve;
        init?.signal?.addEventListener('abort', () => reject(abortError()));
      });
    }) as typeof window.fetch;
    try {
      const first = await fixture<LyraInclude>(html`<lr-include></lr-include>`);
      const second = await fixture<LyraInclude>(html`<lr-include></lr-include>`);
      first.src = 'https://example.test/shared-fragment.html';
      second.src = 'https://example.test/shared-fragment.html';
      await waitUntil(() => calls === 1);
      first.remove();
      expect(signal?.aborted).to.equal(false);

      const loaded = oneEvent(second, 'lr-load');
      resolveFetch(response('<p>Shared</p>'));
      await loaded;
      expect(second.textContent).to.equal('Shared');
      expect(calls).to.equal(1);
    } finally {
      window.fetch = original;
    }
  });

  it('retains successful sanitized resources, supports cache opt-out, and reloads explicitly', async () => {
    const original = window.fetch;
    let calls = 0;
    window.fetch = (() => Promise.resolve(response(`<p>Call ${++calls}</p>`))) as typeof window.fetch;
    try {
      const first = await fixture<LyraInclude>(html`<lr-include></lr-include>`);
      const firstLoaded = oneEvent(first, 'lr-load');
      first.src = 'https://example.test/cached-fragment.html';
      await firstLoaded;

      const retained = await fixture<LyraInclude>(html`<lr-include></lr-include>`);
      const retainedLoaded = oneEvent(retained, 'lr-load');
      retained.src = 'https://example.test/cached-fragment.html';
      await retainedLoaded;
      expect(calls).to.equal(1);
      expect(retained.textContent).to.equal('Call 1');

      const noStore = await fixture<LyraInclude>(html`<lr-include cache="false"></lr-include>`);
      expect(noStore.cache).to.equal(false);
      const noStoreLoaded = oneEvent(noStore, 'lr-load');
      noStore.src = 'https://example.test/cached-fragment.html';
      await noStoreLoaded;
      expect(calls).to.equal(2);
      expect(noStore.textContent).to.equal('Call 2');

      await retained.reload();
      expect(calls).to.equal(3);
      expect(retained.textContent).to.equal('Call 3');
    } finally {
      window.fetch = original;
    }
  });

  it('falls back to the literal fragment text when it is not valid percent-encoding', async () => {
    // decodeURIComponent('%') throws a URIError (a lone '%' is not a full escape sequence);
    // decodedFragment() must recover by treating the text as a literal id rather than throwing.
    const el = await fixture<LyraInclude>(html`<lr-include>Fallback</lr-include>`);
    const errorPromise = oneEvent(el, 'lr-include-error');
    el.src = '#%';
    const event = await errorPromise;
    expect(event.detail.reason).to.equal('missing-fragment');
    expect(el.textContent).to.equal('Fallback');
  });

  it('normalizes an invalid/typo\'d mode attribute back to same-origin for the actual fetch', async () => {
    const original = window.fetch;
    const calls: (RequestInit | undefined)[] = [];
    window.fetch = ((_url: string, init?: RequestInit) => { calls.push(init); return Promise.resolve(response('<p>ok</p>')); }) as typeof window.fetch;
    try {
      const el = await fixture<LyraInclude>(
        html`<lr-include src="https://example.test/invalid-mode.html" mode="bogus"></lr-include>`,
      );
      await waitUntil(() => calls.length > 0);
      expect(calls[0]?.mode, 'effectiveMode falls back for an unrecognized value').to.equal('same-origin');
    } finally { window.fetch = original; }
  });

  it('reload() is a silent no-op when src is empty', async () => {
    const original = window.fetch;
    let called = false;
    window.fetch = (() => { called = true; return Promise.reject(new Error('fetch should not be called')); }) as typeof window.fetch;
    try {
      const el = await fixture<LyraInclude>(html`<lr-include></lr-include>`);
      await el.reload();
      expect(called).to.equal(false);
    } finally { window.fetch = original; }
  });

  it('reload() is a silent no-op while the element is disconnected', async () => {
    // reload() calls load() directly rather than through scheduleAfterUpdate, which is the one
    // path that reaches load()'s own isConnected guard with a non-empty src still set.
    const original = window.fetch;
    let called = false;
    window.fetch = (() => { called = true; return Promise.reject(new Error('fetch should not be called')); }) as typeof window.fetch;
    try {
      const el = document.createElement('lr-include') as LyraInclude;
      el.src = '#reload-while-disconnected';
      await el.reload();
      expect(called, 'a same-page reload must not fetch while disconnected').to.equal(false);
      expect(el.childElementCount, 'nothing should be cloned while disconnected').to.equal(0);
    } finally { window.fetch = original; }
  });

  it('recovers when resolveSource\'s own URL re-parse throws (defensive catch)', async () => {
    // resolveOwnerFetchTarget() already validates and resolves the URL; resolveSource() re-parses
    // the resolved href a final time to split off any #fragment. That reparse of an
    // already-valid absolute href should never throw in practice, but the catch exists in case a
    // patched/foreign URL implementation misbehaves -- verify it fails closed as blocked-url
    // instead of throwing out of load().
    const targetHref = 'https://example.test/defensive-url-catch.html';
    const original = window.fetch;
    let fetchCalled = false;
    window.fetch = (() => { fetchCalled = true; return Promise.reject(new Error('fetch should not be called')); }) as typeof window.fetch;
    const OriginalURL = window.URL;
    class ThrowingURL extends OriginalURL {
      constructor(url: string | URL, base?: string | URL) {
        if (base === undefined && String(url) === targetHref) {
          throw new Error('simulated URL re-parse failure');
        }
        super(url, base);
      }
    }
    window.URL = ThrowingURL as unknown as typeof URL;
    try {
      const el = await fixture<LyraInclude>(html`<lr-include></lr-include>`);
      const errorPromise = oneEvent(el, 'lr-include-error');
      el.src = targetHref;
      const event = await errorPromise;
      expect(event.detail.reason).to.equal('blocked-url');
      expect(fetchCalled).to.equal(false);
    } finally {
      window.URL = OriginalURL;
      window.fetch = original;
    }
  });

  it('reports resource-too-large for an oversized same-page source', async () => {
    const fixtureRoot = await fixture<HTMLDivElement>(html`
      <div>
        <div id="huge-same-page-source"></div>
        <lr-include>Fallback</lr-include>
      </div>
    `);
    const source = fixtureRoot.querySelector('#huge-same-page-source')!;
    source.textContent = 'x'.repeat(MAX_INCLUDE_BYTES + 16);
    const el = fixtureRoot.querySelector('lr-include') as LyraInclude;
    const errorPromise = oneEvent(el, 'lr-include-error');
    el.src = '#huge-same-page-source';
    const event = await errorPromise;
    expect(event.detail.reason).to.equal('resource-too-large');
    expect(el.textContent).to.equal('Fallback');
  });

  it('reports missing-sanitizer for a same-page source when dompurify is unavailable', async () => {
    __setHtmlSanitizerForTesting(null);
    const fixtureRoot = await fixture<HTMLDivElement>(html`
      <div>
        <p id="same-page-missing-sanitizer-source">Safe</p>
        <lr-include>Fallback</lr-include>
      </div>
    `);
    const el = fixtureRoot.querySelector('lr-include') as LyraInclude;
    const errorPromise = oneEvent(el, 'lr-include-error');
    el.src = '#same-page-missing-sanitizer-source';
    const event = await errorPromise;
    expect(event.detail.reason).to.equal('missing-sanitizer');
    expect(el.textContent).to.equal('Fallback');
  });

  it('discards a same-page sanitize result once the generation is stale', async () => {
    const fixtureRoot = await fixture<HTMLDivElement>(html`
      <div>
        <div id="stale-generation-source"><p>Stale</p></div>
        <lr-include></lr-include>
      </div>
    `);
    const el = fixtureRoot.querySelector('lr-include') as LyraInclude;
    const source = fixtureRoot.querySelector('#stale-generation-source')!;
    const access = el as unknown as {
      sanitizeSamePage(source: Element, generation: number): Promise<string | null>;
    };
    // The element's own generation counter only ever increments from 0, so -1 can never match --
    // exercising the post-await staleness guard without racing a real timing window.
    const result = await access.sanitizeSamePage(source, -1);
    expect(result).to.equal(null);
  });

  it('emits reason network -- not IncludeResourceError -- when the same-page sanitizer throws unexpectedly', async () => {
    const throwingSanitizer: HtmlSanitizer = {
      sanitize: () => {
        throw new Error('sanitizer exploded');
      },
    };
    __setHtmlSanitizerForTesting(throwingSanitizer);
    const fixtureRoot = await fixture<HTMLDivElement>(html`
      <div>
        <p id="sanitizer-throws-source">Safe</p>
        <lr-include>Fallback</lr-include>
      </div>
    `);
    const el = fixtureRoot.querySelector('lr-include') as LyraInclude;
    const errorPromise = oneEvent(el, 'lr-include-error');
    el.src = '#sanitizer-throws-source';
    const event = await errorPromise;
    expect(event.detail.reason).to.equal('network');
    expect(event.detail.error).to.be.instanceOf(Error);
    expect(el.textContent).to.equal('Fallback');
  });

  it('leaves a dangling internal hash href unchanged after rebasing ids', async () => {
    const fixtureRoot = await fixture<HTMLDivElement>(html`
      <div>
        <div id="href-dangling-source"><a href="#not-in-fragment">Link</a></div>
        <lr-include></lr-include>
      </div>
    `);
    const el = fixtureRoot.querySelector('lr-include') as LyraInclude;
    const loaded = oneEvent(el, 'lr-load');
    el.src = '#href-dangling-source';
    await loaded;
    expect(el.querySelector('a')!.getAttribute('href')).to.equal('#not-in-fragment');
  });

  it('rewrites an internal hash href that resolves to a rebased id', async () => {
    const fixtureRoot = await fixture<HTMLDivElement>(html`
      <div>
        <div id="href-rewrite-source">
          <a href="#link-target">Link</a>
          <span id="link-target">Target</span>
        </div>
        <lr-include></lr-include>
      </div>
    `);
    const el = fixtureRoot.querySelector('lr-include') as LyraInclude;
    const loaded = oneEvent(el, 'lr-load');
    el.src = '#href-rewrite-source';
    await loaded;
    const target = el.querySelector('span[id]')!;
    expect(target.id).to.not.equal('link-target');
    expect(el.querySelector('a')!.getAttribute('href')).to.equal(`#${target.id}`);
  });

  it('rewrites a url(#id) reference attribute to the rebased id', async () => {
    const fixtureRoot = await fixture<HTMLDivElement>(html`
      <div>
        <div id="url-rewrite-source">
          <div id="grad-target"></div>
          <div data-fill="url(#grad-target)"></div>
        </div>
        <lr-include></lr-include>
      </div>
    `);
    const el = fixtureRoot.querySelector('lr-include') as LyraInclude;
    const loaded = oneEvent(el, 'lr-load');
    el.src = '#url-rewrite-source';
    await loaded;
    const gradDiv = el.querySelector('div[id]')!;
    expect(gradDiv.id).to.not.equal('grad-target');
    expect(el.querySelector('[data-fill]')!.getAttribute('data-fill')).to.equal(`url(#${gradDiv.id})`);
  });

  it('leaves a dangling url(#id) reference attribute unchanged', async () => {
    const fixtureRoot = await fixture<HTMLDivElement>(html`
      <div>
        <div id="url-dangling-source"><div data-fill="url(#not-a-real-id)"></div></div>
        <lr-include></lr-include>
      </div>
    `);
    const el = fixtureRoot.querySelector('lr-include') as LyraInclude;
    const loaded = oneEvent(el, 'lr-load');
    el.src = '#url-dangling-source';
    await loaded;
    expect(el.querySelector('[data-fill]')!.getAttribute('data-fill')).to.equal('url(#not-a-real-id)');
  });

  // No .strings override test: this component renders no built-in visible
  // text of its own (no localize() call sites at all) -- see the class doc
  // comment for why. aria-busy is a boolean ARIA state, not translatable
  // text.

  it('exposes a part="base" non-layout wrapper', async () => {
    const el = await fixture<LyraInclude>(html`<lr-include></lr-include>`);
    expect(el.shadowRoot!.querySelector('[part="base"]')).to.exist;
    expect(getComputedStyle(el).display).to.equal('contents');
  });

  it('keeps the shared anchor live region visually hidden once it carries an announcement', async () => {
    const el = await fixture<LyraInclude>(html`<lr-include>Fallback text</lr-include>`);
    // An unresolvable highlight id announces `anchorNotFound` immediately -- no retry loop.
    await el.scrollToAnchor('no-such-highlight');
    await el.updateComplete;
    const region = el.shadowRoot!.querySelector('[part="anchor-live-region"]') as HTMLElement;
    expect((region) != null, 'the mixin live region is rendered').to.equal(true);
    expect(
      (region.textContent ?? '').trim().length,
      'the live region actually carries announcement text',
    ).to.be.greaterThan(0);
    // Rendered geometry, not stylesheet text: an unhidden live region lays out as a normal block
    // and paints its announcement on screen next to the transcluded fragment.
    const rect = region.getBoundingClientRect();
    expect(rect.height, 'live-region block size stays clipped to 1px').to.be.at.most(1);
    expect(rect.width, 'live-region inline size stays clipped to 1px').to.be.at.most(1);
  });

  it('is accessible when idle', async () => {
    const el = await fixture(html`<lr-include></lr-include>`);
    await expect(el).to.be.accessible();
  });

  it('is accessible after a successful load, preserving the fragment’s own semantics', async () => {
    const original = window.fetch;
    window.fetch = (() => Promise.resolve(response('<nav><a href="#">Link</a></nav>'))) as typeof window.fetch;
    try {
      const el = await fixture<LyraInclude>(html`<lr-include src="https://example.test/nav.html"></lr-include>`);
      await waitUntil(() => el.querySelector('nav') !== null);
      await expect(el).to.be.accessible();
    } finally { window.fetch = original; }
  });
});

it('selects nested template content after adoption into another document', () => {
  const iframe = document.createElement('iframe');
  document.body.append(iframe);
  try {
    const foreignDocument = iframe.contentDocument!;
    const el = foreignDocument.adoptNode(document.createElement('lr-include')) as LyraInclude;
    const access = el as unknown as {
      fragmentFromSanitized(markup: string, fragmentId: string): DocumentFragment | null;
    };
    const fragment = access.fragmentFromSanitized(
      '<main><template id="chosen"><p id="inside">Chosen content</p></template></main>',
      'chosen',
    );

    expect(fragment?.ownerDocument === foreignDocument).to.equal(true);
    expect(fragment?.querySelector('p')?.textContent).to.equal('Chosen content');
  } finally {
    iframe.remove();
  }
});
