import { aTimeout, expect, fixture, html, waitUntil } from '@open-wc/testing';
import type { LyraContactViewer } from './contact-viewer.js';
import './contact-viewer.js';

describe('lr-contact-viewer request cancellation ownership', () => {
  it('reports an active fetch AbortError through localized error chrome and clears loading', async () => {
    const originalFetch = window.fetch;
    const failure = new DOMException('Transport stopped unexpectedly', 'AbortError');
    const message = 'The remote document could not be loaded';
    let rejectFetch: ((reason: unknown) => void) | undefined;
    let signal: AbortSignal | null | undefined;
    let el: LyraContactViewer | undefined;
    window.fetch = async (_input, init) => {
      signal = init?.signal;
      return new Promise<Response>((_resolve, reject) => { rejectFetch = reject; });
    };
    try {
      el = await fixture<LyraContactViewer>(html`<lr-contact-viewer
        .strings=${{ documentPreviewFailedToLoad: message }}></lr-contact-viewer>`);
      const errors: unknown[] = [];
      el.addEventListener('lr-render-error', event => { errors.push(event.detail.error); });
      el.src = 'https://example.test/active.vcf';
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
    const source = 'https://example.test/pending-move.vcf';
    const documentText = ['BEGIN:VCARD', 'VERSION:4.0', 'FN:Resumed document', 'END:VCARD'].join('\r\n');
    let resolveFirst: ((response: Response) => void) | undefined;
    let firstSignal: AbortSignal | null | undefined;
    let el: LyraContactViewer | undefined;
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
      el = await fixture<LyraContactViewer>(html`<lr-contact-viewer></lr-contact-viewer>`);
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

      await waitUntil(() => el!.shadowRoot!.querySelector('[part~="contact"]') !== null &&
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
    const documentText = ['BEGIN:VCARD', 'VERSION:4.0', 'FN:Resumed document', 'END:VCARD'].join('\r\n');
    let bodyReadStarted = false;
    let bodyController!: ReadableStreamDefaultController<Uint8Array>;
    const pendingBody = new ReadableStream<Uint8Array>({
      start(controller) { bodyController = controller; },
      pull() { bodyReadStarted = true; },
    }, { highWaterMark: 0 });
    let firstSignal: AbortSignal | null | undefined;
    let fetched = false;
    let el: LyraContactViewer | undefined;
    window.fetch = async (_input, init) => {
      if (fetched) return new Response(documentText);
      fetched = true;
      firstSignal = init?.signal;
      return new Response(pendingBody);
    };
    try {
      el = await fixture<LyraContactViewer>(html`<lr-contact-viewer></lr-contact-viewer>`);
      const errors: unknown[] = [];
      el.addEventListener('lr-render-error', event => { errors.push(event.detail.error); });
      el.src = 'https://example.test/pending-body.vcf';
      await waitUntil(() => bodyReadStarted, 'the viewer has started reading the response body');
      await el.updateComplete;
      expect(firstSignal?.aborted).to.equal(false);
      expect(el.shadowRoot!.querySelector('[part~="spinner"]') !== null).to.equal(true);
      const parent = el.parentNode!;
      el.remove();
      parent.appendChild(el);
      await waitUntil(() => el!.shadowRoot!.querySelector('[part~="contact"]') !== null &&
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

  for (const retirement of ['replacement', 'disconnect'] as const) {
    it(`keeps an owner-cancelled fetch silent after ${retirement}`, async () => {
      const originalFetch = window.fetch;
      const requests: Array<{ signal: AbortSignal | null | undefined; reject: (reason: unknown) => void }> = [];
      let el: LyraContactViewer | undefined;
      window.fetch = async (_input, init) => new Promise<Response>((_resolve, reject) => {
        requests.push({ signal: init?.signal, reject });
        init?.signal?.addEventListener('abort', () => {
          reject(new DOMException('Owner retired the request', 'AbortError'));
        }, { once: true });
      });
      try {
        el = await fixture<LyraContactViewer>(html`<lr-contact-viewer></lr-contact-viewer>`);
        const errors: unknown[] = [];
        el.addEventListener('lr-render-error', event => { errors.push(event.detail.error); });
        el.src = 'https://example.test/retired.vcf';
        await waitUntil(() => requests.length === 1, 'the first request starts');
        expect(requests[0]!.signal?.aborted).to.equal(false);
        if (retirement === 'replacement') {
          el.src = 'https://example.test/current.vcf';
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
