import { expect, fixture, html, oneEvent, waitUntil } from '@open-wc/testing';
import './html-viewer.js';
import type { LyraHtmlViewer } from './html-viewer.js';
import { __setHtmlSanitizerForTesting } from './dompurify-loader.js';

function response(body: string, ok = true): Response { return { ok, status: ok ? 200 : 500, statusText: ok ? 'OK' : 'Error', text: () => Promise.resolve(body) } as Response; }

describe('lyra-html-viewer', () => {
  afterEach(() => __setHtmlSanitizerForTesting(undefined));

  it('renders an empty localized state by default', async () => {
    const el = (await fixture(html`<lyra-html-viewer></lyra-html-viewer>`)) as LyraHtmlViewer;
    expect(el.shadowRoot!.querySelector('.empty-note')!.textContent).to.equal('No document to display.');
  });
  it('fetches and sanitizes HTML markup', async () => {
    const original = window.fetch;
    window.fetch = (() => Promise.resolve(response('<h1>Safe</h1><script>alert(1)</script>'))) as typeof window.fetch;
    try {
      const el = (await fixture(html`<lyra-html-viewer src="https://example.test/a.html" name="Report"></lyra-html-viewer>`)) as LyraHtmlViewer;
      await waitUntil(() => el.shadowRoot!.querySelector('[part="html"] h1') !== null);
      await el.updateComplete;
      expect(el.shadowRoot!.querySelector('[part="html"] h1')!.textContent).to.equal('Safe');
      expect(el.shadowRoot!.querySelector('[part="html"] script')).to.not.exist;
      expect(el.shadowRoot!.querySelector('[part="html"]')!.getAttribute('aria-label')).to.equal('Report');
    } finally { window.fetch = original; }
  });
  it('rejects unsafe URLs and emits lyra-render-error with a rendered failure message for a failed fetch', async () => {
    const el = (await fixture(html`<lyra-html-viewer src="javascript:alert(1)"></lyra-html-viewer>`)) as LyraHtmlViewer;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[role="alert"]')!.textContent).to.equal('Document URL is not allowed.');
    const original = window.fetch;
    window.fetch = (() => Promise.resolve(response('', false))) as typeof window.fetch;
    try {
      const eventPromise = oneEvent(el, 'lyra-render-error');
      el.src = 'https://example.test/b.html';
      const event = await eventPromise;
      expect(event.detail.error).to.exist;
      await el.updateComplete;
      expect(el.shadowRoot!.querySelector('[part="error"]')!.textContent).to.equal('Failed to load document.');
    } finally { window.fetch = original; }
  });
  it('shows a localized missing-sanitizer error instead of a silently empty document when the optional dompurify peer is unavailable', async () => {
    __setHtmlSanitizerForTesting(null);
    const original = window.fetch;
    window.fetch = (() => Promise.resolve(response('<p>Safe</p>'))) as typeof window.fetch;
    try {
      const el = (await fixture(html`<lyra-html-viewer src="https://example.test/c.html"></lyra-html-viewer>`)) as LyraHtmlViewer;
      await waitUntil(() => el.shadowRoot!.querySelector('[part="error"]') !== null);
      expect(el.shadowRoot!.querySelector('[part="error"]')!.textContent).to.equal(
        'This viewer needs the optional "dompurify" package installed to render safely.',
      );
      expect(el.shadowRoot!.querySelector('[part="html"]')).to.not.exist;
    } finally { window.fetch = original; }
  });
  it('renders a .strings override for the empty-state message', async () => {
    const el = (await fixture(
      html`<lyra-html-viewer .strings=${{ documentPreviewEmpty: 'Aucun {type} à afficher.' }}></lyra-html-viewer>`,
    )) as LyraHtmlViewer;
    expect(el.shadowRoot!.querySelector('.empty-note')!.textContent).to.equal('Aucun document à afficher.');
  });
  it('is accessible', async () => { const el = await fixture(html`<lyra-html-viewer></lyra-html-viewer>`); await expect(el).to.be.accessible(); });
});
