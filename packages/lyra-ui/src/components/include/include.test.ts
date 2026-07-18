import { aTimeout, expect, fixture, html, oneEvent, waitUntil } from '@open-wc/testing';
import './include.js';
import type { LyraInclude } from './include.js';
import { __setHtmlSanitizerForTesting } from '../html-viewer/dompurify-loader.js';
import { DEFAULT_MAX_RESOURCE_BYTES } from '../../internal/resource-loader.js';

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
  afterEach(() => __setHtmlSanitizerForTesting(undefined));

  it('is a no-op when src is unset: no fetch, no aria-busy', async () => {
    let called = false;
    const original = window.fetch;
    window.fetch = (() => { called = true; return Promise.reject(new Error('fetch should not be called')); }) as typeof window.fetch;
    try {
      const el = await fixture<LyraInclude>(html`<lr-include></lr-include>`);
      await el.updateComplete;
      await aTimeout(10);
      expect(called).to.equal(false);
      expect(el.hasAttribute('aria-busy')).to.equal(false);
    } finally { window.fetch = original; }
  });

  it('shows author-supplied fallback content and sets aria-busy while a fetch is in flight', async () => {
    const original = window.fetch;
    let resolveFetch!: (value: Response) => void;
    window.fetch = (() => new Promise<Response>((resolve) => { resolveFetch = resolve; })) as typeof window.fetch;
    try {
      const el = await fixture<LyraInclude>(html`<lr-include src="https://example.test/pending.html">Loading…</lr-include>`);
      await waitUntil(() => el.hasAttribute('aria-busy'));
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
      expect(el.querySelector('script')).to.not.exist;
      expect(el.querySelector('h1')!.textContent).to.equal('Safe');
      expect(el.hasAttribute('aria-busy')).to.equal(false);
    } finally { window.fetch = original; }
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
      expect(el.hasAttribute('aria-busy')).to.equal(false);
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
    window.fetch = (() => Promise.resolve(response('<p>Too big</p>', { contentLength: DEFAULT_MAX_RESOURCE_BYTES + 1 }))) as typeof window.fetch;
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
      expect(el.querySelector('p')).to.not.exist;
    } finally { window.fetch = original; }
  });

  it('clears aria-busy when src is cleared to empty while a fetch is still in flight', async () => {
    const original = window.fetch;
    window.fetch = (() => new Promise<Response>(() => { /* never resolves */ })) as typeof window.fetch;
    try {
      const el = await fixture<LyraInclude>(html`<lr-include src="https://example.test/pending.html"></lr-include>`);
      await waitUntil(() => el.hasAttribute('aria-busy'));
      el.src = '';
      await waitUntil(() => !el.hasAttribute('aria-busy'));
      expect(el.hasAttribute('aria-busy')).to.equal(false);
    } finally { window.fetch = original; }
  });

  it('clears aria-busy when src switches to a blocked scheme while a fetch is still in flight', async () => {
    const original = window.fetch;
    window.fetch = (() => new Promise<Response>(() => { /* never resolves */ })) as typeof window.fetch;
    try {
      const el = await fixture<LyraInclude>(html`<lr-include src="https://example.test/pending.html"></lr-include>`);
      await waitUntil(() => el.hasAttribute('aria-busy'));
      const errorPromise = oneEvent(el, 'lr-include-error');
      el.src = 'javascript:alert(1)';
      const event = await errorPromise;
      expect(event.detail.reason).to.equal('blocked-url');
      expect(el.hasAttribute('aria-busy')).to.equal(false);
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
      expect(el.querySelector('p')).to.exist;
    } finally { window.fetch = original; }
  });

  it('does not mutate content once disconnected mid-flight, and throws nothing', async () => {
    const original = window.fetch;
    let resolveFetch!: (value: Response) => void;
    window.fetch = (() => new Promise<Response>((resolve) => { resolveFetch = resolve; })) as typeof window.fetch;
    try {
      const el = await fixture<LyraInclude>(html`<lr-include src="https://example.test/slow.html">Fallback</lr-include>`);
      await waitUntil(() => el.hasAttribute('aria-busy'));
      el.remove();
      resolveFetch(response('<h1>Late</h1>'));
      await aTimeout(20);
      expect(el.querySelector('h1')).to.not.exist;
      expect(el.textContent).to.equal('Fallback');
    } finally { window.fetch = original; }
  });

  it('honors a load scheduled while detached, once reconnected', async () => {
    const original = window.fetch;
    window.fetch = (() => Promise.resolve(response('<h1>Reconnected</h1>'))) as typeof window.fetch;
    try {
      const el = document.createElement('lr-include') as LyraInclude;
      el.src = 'https://example.test/detached.html';
      await aTimeout(10);
      expect(el.querySelector('h1'), 'nothing should load while detached').to.not.exist;
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

  // No .strings override test: this component renders no built-in visible
  // text of its own (no localize() call sites at all) -- see the class doc
  // comment for why. aria-busy is a boolean ARIA state, not translatable
  // text.

  it('exposes a part="base" non-layout wrapper', async () => {
    const el = await fixture<LyraInclude>(html`<lr-include></lr-include>`);
    expect(el.shadowRoot!.querySelector('[part="base"]')).to.exist;
    expect(getComputedStyle(el).display).to.equal('contents');
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
