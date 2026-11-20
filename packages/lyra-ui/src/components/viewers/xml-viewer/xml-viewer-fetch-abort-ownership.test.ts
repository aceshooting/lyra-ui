import { aTimeout, expect, fixture, html, waitUntil } from '@open-wc/testing';
import type { LyraXmlViewer } from '../../lr-xml-viewer.js';
import '../../lr-xml-viewer.js';

describe('lr-xml-viewer request cancellation ownership', () => {
  it('reports an active fetch AbortError through localized error chrome and clears loading', async () => {
    const originalFetch = window.fetch;
    const failure = new DOMException('Transport stopped unexpectedly', 'AbortError');
    const message = 'The remote document could not be loaded';
    let rejectFetch: ((reason: unknown) => void) | undefined;
    let signal: AbortSignal | null | undefined;
    let el: LyraXmlViewer | undefined;
    window.fetch = async (_input, init) => {
      signal = init?.signal;
      return new Promise<Response>((_resolve, reject) => { rejectFetch = reject; });
    };
    try {
      el = await fixture<LyraXmlViewer>(html`<lr-xml-viewer
        .strings=${{ documentPreviewFailedToLoad: message }}></lr-xml-viewer>`);
      const errors: unknown[] = [];
      el.addEventListener('lr-render-error', event => { errors.push(event.detail.error); });
      el.src = 'https://example.test/active.xml';
      await waitUntil(() => rejectFetch !== undefined, 'the active fetch starts');
      await el.updateComplete;
      expect(signal?.aborted).to.equal(false);
      expect(el.isConnected).to.equal(true);
      expect(el.shadowRoot!.querySelector('[part~="spinner"]') !== null).to.equal(true);
      expect(el.shadowRoot!.querySelector('[part~="base"]')?.getAttribute('aria-busy')).to.equal('true');

      rejectFetch!(failure);
      await waitUntil(() => el!.shadowRoot!.querySelector('[part~="error"]') !== null,
        'the active abort-shaped rejection receives visible failure feedback');
      await el.updateComplete;
      expect(errors.length).to.equal(1);
      expect(errors[0] === failure).to.equal(true);
      expect(signal?.aborted).to.equal(false);
      expect(el.shadowRoot!.querySelector('[part~="error"]')?.textContent).to.equal(message);
      expect(el.shadowRoot!.textContent).not.to.include(failure.message);
      expect(el.shadowRoot!.querySelector('[part~="spinner"]') === null).to.equal(true);
      expect(el.shadowRoot!.querySelector('[part~="base"]')?.getAttribute('aria-busy')).to.equal('false');
    } finally {
      el?.remove();
      window.fetch = originalFetch;
    }
  });

  it('finishes a pending document load after a same-task DOM move without changing src', async () => {
    const originalFetch = window.fetch;
    const source = 'https://example.test/pending-move.xml';
    const documentText = '<root><item>Resumed document</item></root>';
    let resolveFirst: ((response: Response) => void) | undefined;
    let firstSignal: AbortSignal | null | undefined;
    let el: LyraXmlViewer | undefined;
    window.fetch = async (_input, init) => {
      if (resolveFirst) return new Response(documentText);
      firstSignal = init?.signal;
      return new Promise<Response>((resolve, reject) => {
        resolveFirst = resolve;
        init?.signal?.addEventListener('abort', () => {
          reject(new DOMException('Owner retired the pending request', 'AbortError'));
        }, { once: true });
      });
    };
    try {
      el = await fixture<LyraXmlViewer>(html`<lr-xml-viewer></lr-xml-viewer>`);
      const errors: unknown[] = [];
      el.addEventListener('lr-render-error', event => { errors.push(event.detail.error); });
      el.src = source;
      await waitUntil(() => resolveFirst !== undefined, 'the pending document fetch starts');
      await el.updateComplete;
      expect(firstSignal?.aborted).to.equal(false);
      expect(el.shadowRoot!.querySelector('[part~="spinner"]') !== null).to.equal(true);
      const parent = el.parentNode!;
      el.remove();
      parent.appendChild(el);
      expect(el.isConnected).to.equal(true);
      resolveFirst!(new Response(documentText));

      await waitUntil(() => el!.shadowRoot!.querySelector('[part~="tag"]') !== null &&
        el!.shadowRoot!.textContent!.includes('Resumed document'),
      'the moved viewer eventually renders its unchanged source', { timeout: 5000 });
      await el.updateComplete;
      expect(el.src).to.equal(source);
      expect(el.shadowRoot!.querySelector('[part~="spinner"]') === null).to.equal(true);
      expect(el.shadowRoot!.querySelector('[part~="base"]')?.getAttribute('aria-busy')).to.equal('false');
      expect(el.shadowRoot!.querySelector('[part~="error"]') === null).to.equal(true);
      expect(errors).to.deep.equal([]);
    } finally {
      el?.remove();
      window.fetch = originalFetch;
    }
  });

  it('recovers from a same-task move during body reading and ignores the late retired body', async () => {
    const originalFetch = window.fetch;
    const documentText = '<root><item>Resumed document</item></root>';
    let bodyReadStarted = false;
    let bodyController!: ReadableStreamDefaultController<Uint8Array>;
    const pendingBody = new ReadableStream<Uint8Array>({
      start(controller) { bodyController = controller; },
      pull() { bodyReadStarted = true; },
    }, { highWaterMark: 0 });
    let firstSignal: AbortSignal | null | undefined;
    let fetched = false;
    let el: LyraXmlViewer | undefined;
    window.fetch = async (_input, init) => {
      if (fetched) return new Response(documentText);
      fetched = true;
      firstSignal = init?.signal;
      return new Response(pendingBody);
    };
    try {
      el = await fixture<LyraXmlViewer>(html`<lr-xml-viewer></lr-xml-viewer>`);
      const errors: unknown[] = [];
      el.addEventListener('lr-render-error', event => { errors.push(event.detail.error); });
      el.src = 'https://example.test/pending-body.xml';
      await waitUntil(() => bodyReadStarted, 'the viewer has started reading the response body');
      await el.updateComplete;
      expect(firstSignal?.aborted).to.equal(false);
      expect(el.shadowRoot!.querySelector('[part~="spinner"]') !== null).to.equal(true);
      const parent = el.parentNode!;
      el.remove();
      parent.appendChild(el);
      await waitUntil(() => el!.shadowRoot!.querySelector('[part~="tag"]') !== null &&
        el!.shadowRoot!.textContent!.includes('Resumed document'),
      'the moved viewer renders the current response', { timeout: 5000 });
      expect(firstSignal?.aborted).to.equal(true);

      // A detached response stream may ignore transport cancellation and finish late.
      bodyController.enqueue(new TextEncoder().encode(documentText.replace('Resumed document', 'Retired document')));
      bodyController.close();
      // wait-reason: settle the retired body continuation before checking that it cannot replace current content
      await aTimeout(0);
      await el.updateComplete;
      expect(el.shadowRoot!.textContent).to.include('Resumed document');
      expect(el.shadowRoot!.textContent).not.to.include('Retired document');
      expect(el.shadowRoot!.querySelector('[part~="spinner"]') === null).to.equal(true);
      expect(el.shadowRoot!.querySelector('[part~="base"]')?.getAttribute('aria-busy')).to.equal('false');
      expect(el.shadowRoot!.querySelector('[part~="error"]') === null).to.equal(true);
      expect(errors).to.deep.equal([]);
    } finally {
      el?.remove();
      window.fetch = originalFetch;
      if (pendingBody.locked) bodyController.error(new DOMException('Fixture cleanup', 'AbortError'));
    }
  });

  it('preserves inline XML assigned before a queued reconnect reload without another fetch', async () => {
    const originalFetch = window.fetch;
    let resolveFetch: ((response: Response) => void) | undefined;
    let fetches = 0;
    let signal: AbortSignal | null | undefined;
    let el: LyraXmlViewer | undefined;
    window.fetch = async (_input, init) => {
      fetches++;
      signal = init?.signal;
      return new Promise<Response>((resolve, reject) => {
        resolveFetch = resolve;
        init?.signal?.addEventListener('abort', () => {
          reject(new DOMException('Owner retired the XML request', 'AbortError'));
        }, { once: true });
      });
    };
    try {
      el = await fixture<LyraXmlViewer>(html`<lr-xml-viewer></lr-xml-viewer>`);
      const errors: unknown[] = [];
      el.addEventListener('lr-render-error', event => { errors.push(event.detail.error); });
      el.src = 'https://example.test/inline-wins.xml';
      await waitUntil(() => resolveFetch !== undefined, 'the original remote request starts');
      await el.updateComplete;
      expect(signal?.aborted).to.equal(false);
      const parent = el.parentNode!;
      el.remove();
      parent.appendChild(el);
      el.xml = '<root><item>Inline authority</item></root>';
      resolveFetch!(new Response('<root><item>Retired remote document</item></root>'));
      await waitUntil(() => el!.shadowRoot!.textContent!.includes('Inline authority'), 'inline XML renders');
      // wait-reason: the queued reconnect callback must finish without starting another remote fetch
      await aTimeout(0);
      await el.updateComplete;
      expect(fetches).to.equal(1);
      expect(signal?.aborted).to.equal(true);
      expect(el.shadowRoot!.textContent).to.include('Inline authority');
      expect(el.shadowRoot!.textContent).not.to.include('Retired remote document');
      expect(el.shadowRoot!.querySelector('[part~="spinner"]') === null).to.equal(true);
      expect(el.shadowRoot!.querySelector('[part~="base"]')?.getAttribute('aria-busy')).to.equal('false');
      expect(errors).to.deep.equal([]);
    } finally {
      el?.remove();
      window.fetch = originalFetch;
    }
  });

  for (const retirement of ['replacement', 'disconnect'] as const) {
    it(`keeps an owner-cancelled fetch silent after ${retirement}`, async () => {
      const originalFetch = window.fetch;
      const requests: Array<{ signal: AbortSignal | null | undefined; reject: (reason: unknown) => void }> = [];
      let el: LyraXmlViewer | undefined;
      window.fetch = async (_input, init) => new Promise<Response>((_resolve, reject) => {
        requests.push({ signal: init?.signal, reject });
        init?.signal?.addEventListener('abort', () => {
          reject(new DOMException('Owner retired the request', 'AbortError'));
        }, { once: true });
      });
      try {
        el = await fixture<LyraXmlViewer>(html`<lr-xml-viewer></lr-xml-viewer>`);
        const errors: unknown[] = [];
        el.addEventListener('lr-render-error', event => { errors.push(event.detail.error); });
        el.src = 'https://example.test/retired.xml';
        await waitUntil(() => requests.length === 1, 'the first request starts');
        expect(requests[0]!.signal?.aborted).to.equal(false);
        if (retirement === 'replacement') {
          el.src = 'https://example.test/current.xml';
          await waitUntil(() => requests.length === 2, 'the replacement request starts');
        } else {
          el.remove();
        }
        await waitUntil(() => requests[0]!.signal?.aborted === true, 'the owner aborts the retired request');
        // wait-reason: allow the retired fetch rejection to settle before checking silent cancellation
        await aTimeout(0);
        await el.updateComplete;
        expect(errors).to.deep.equal([]);
        expect(el.shadowRoot!.querySelector('[part~="error"]') === null).to.equal(true);
        if (retirement === 'replacement') {
          expect(requests[1]!.signal?.aborted).to.equal(false);
          expect(el.shadowRoot!.querySelector('[part~="base"]')?.getAttribute('aria-busy')).to.equal('true');
          const currentFailure = new Error('Current transport failed');
          requests[1]!.reject(currentFailure);
          await waitUntil(() => errors.length === 1, 'the current request still reports its own failure');
          await el.updateComplete;
          expect(errors[0] === currentFailure).to.equal(true);
          expect(el.shadowRoot!.querySelector('[part~="error"]') !== null).to.equal(true);
          expect(el.shadowRoot!.querySelector('[part~="spinner"]') === null).to.equal(true);
        }
      } finally {
        el?.remove();
        window.fetch = originalFetch;
      }
    });
  }
});
