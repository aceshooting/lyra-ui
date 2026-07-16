import { aTimeout, expect, fixture, html } from '@open-wc/testing';
import './ebook-viewer.js';
import { __setEpubJsForTesting } from './ebook-loader.js';
import type { LyraEbookViewer } from './ebook-viewer.js';

function response(ok = true): Response {
  return { ok, status: ok ? 200 : 404, statusText: ok ? 'OK' : 'Not Found', arrayBuffer: () => Promise.resolve(new ArrayBuffer(1)) } as unknown as Response;
}

function fakeBook() {
  const calls = { next: 0, prev: 0, destroy: 0 };
  const rendition = {
    display: () => Promise.resolve(),
    next: () => { calls.next++; return Promise.resolve(); },
    prev: () => { calls.prev++; return Promise.resolve(); },
  };
  const book = {
    ready: Promise.resolve(),
    renderTo: () => rendition,
    destroy: () => { calls.destroy++; },
  };
  return { calls, book, factory: () => book };
}

function stubFetch(): () => void {
  const original = window.fetch;
  window.fetch = (() => Promise.resolve(response())) as typeof window.fetch;
  return () => { window.fetch = original; };
}

afterEach(() => __setEpubJsForTesting(undefined));

describe('lyra-ebook-viewer', () => {
  it('keeps a stable mount and renders an idle state by default', async () => {
    const el = (await fixture(html`<lyra-ebook-viewer></lyra-ebook-viewer>`)) as LyraEbookViewer;
    expect(el.shadowRoot!.querySelector('[part="mount"]')).to.exist;
    expect(el.shadowRoot!.querySelector('[part="error"]')).to.not.exist;
    expect((el.shadowRoot!.querySelector('[part="next-button"]') as HTMLButtonElement).disabled).to.be.true;
  });

  it('loads a book, enables navigation, and destroys it when disconnected', async () => {
    const fake = fakeBook();
    __setEpubJsForTesting(fake.factory as never);
    const restore = stubFetch();
    try {
      const el = (await fixture(html`<lyra-ebook-viewer src="https://example.test/book.epub"></lyra-ebook-viewer>`)) as LyraEbookViewer;
      await aTimeout(20);
      const next = el.shadowRoot!.querySelector('[part="next-button"]') as HTMLButtonElement;
      const previous = el.shadowRoot!.querySelector('[part="previous-button"]') as HTMLButtonElement;
      expect(next.disabled).to.be.false;
      next.click();
      previous.click();
      expect(fake.calls.next).to.equal(1);
      expect(fake.calls.prev).to.equal(1);
      el.remove();
      expect(fake.calls.destroy).to.equal(1);
    } finally {
      restore();
    }
  });

  it('reloads the book after a synchronous reparent while connected, instead of leaving stale-looking enabled controls', async () => {
    const fake = fakeBook();
    __setEpubJsForTesting(fake.factory as never);
    const restore = stubFetch();
    try {
      const el = (await fixture(html`<lyra-ebook-viewer src="https://example.test/book.epub"></lyra-ebook-viewer>`)) as LyraEbookViewer;
      await aTimeout(20);
      const next = el.shadowRoot!.querySelector('[part="next-button"]') as HTMLButtonElement;
      expect(next.disabled).to.be.false;

      const otherContainer = document.createElement('div');
      document.body.appendChild(otherContainer);
      otherContainer.appendChild(el); // disconnect + reconnect synchronously, same instance
      await el.updateComplete;

      // Right after the reparent, the previous rendition was torn down -- the
      // controls must not still look live against a destroyed rendition.
      expect(fake.calls.destroy).to.equal(1);
      expect(next.disabled, 'controls must not stay enabled against a destroyed rendition').to.be.true;

      // The reconnect re-arms the load, so the book comes back rather than the
      // viewer staying permanently blank.
      await aTimeout(20);
      expect(next.disabled, 'a reconnect must reload the book').to.be.false;

      otherContainer.remove();
    } finally {
      restore();
    }
  });

  it('renders safe-url, fetch, and missing-peer errors', async () => {
    const restore = stubFetch();
    try {
      const unsafe = (await fixture(html`<lyra-ebook-viewer .src=${'javascript:alert(1)'}></lyra-ebook-viewer>`)) as LyraEbookViewer;
      await aTimeout(10);
      expect(unsafe.shadowRoot!.querySelector('[part="error"]')!.textContent).to.contain('Document URL is not allowed');
      __setEpubJsForTesting(null);
      const missing = (await fixture(html`<lyra-ebook-viewer src="https://example.test/book.epub"></lyra-ebook-viewer>`)) as LyraEbookViewer;
      await aTimeout(20);
      expect(missing.shadowRoot!.querySelector('[part="error"]')!.textContent).to.contain('Failed to load the ebook');
    } finally {
      restore();
    }
  });

  it('is accessible and supports localized navigation labels', async () => {
    const el = await fixture(html`<lyra-ebook-viewer .strings=${{ previous: 'Précédent', next: 'Suivant' }}></lyra-ebook-viewer>`);
    expect(el.shadowRoot!.querySelector('[part="previous-button"]')!.getAttribute('aria-label')).to.equal('Précédent');
    await expect(el).to.be.accessible();
  });
});
