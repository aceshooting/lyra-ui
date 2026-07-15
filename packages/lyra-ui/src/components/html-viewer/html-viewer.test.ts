import { aTimeout, expect, fixture, html, waitUntil } from '@open-wc/testing';
import './html-viewer.js';
import type { LyraHtmlViewer } from './html-viewer.js';

function response(body: string): Response { return { ok: true, status: 200, statusText: 'OK', text: () => Promise.resolve(body) } as Response; }

describe('lyra-html-viewer', () => {
  it('renders an empty localized state by default', async () => {
    const el = (await fixture(html`<lyra-html-viewer></lyra-html-viewer>`)) as LyraHtmlViewer;
    expect(el.shadowRoot!.querySelector('.empty-note')!.textContent).to.equal('No document to display.');
  });
  it('fetches and sanitizes HTML markup', async () => {
    const original = window.fetch;
    window.fetch = (() => Promise.resolve(response('<h1>Safe</h1><script>alert(1)</script>'))) as typeof window.fetch;
    try {
      const el = (await fixture(html`<lyra-html-viewer src="https://example.test/a.html" name="Report"></lyra-html-viewer>`)) as LyraHtmlViewer;
      await aTimeout(20);
      await waitUntil(() => el.shadowRoot!.querySelector('[part="html"] h1') !== null);
      await el.updateComplete;
      expect(el.shadowRoot!.querySelector('[part="html"] h1')!.textContent).to.equal('Safe');
      expect(el.shadowRoot!.querySelector('[part="html"] script')).to.not.exist;
      expect(el.shadowRoot!.querySelector('[part="html"]')!.getAttribute('aria-label')).to.equal('Report');
    } finally { window.fetch = original; }
  });
  it('rejects unsafe URLs', async () => {
    const el = (await fixture(html`<lyra-html-viewer src="javascript:alert(1)"></lyra-html-viewer>`)) as LyraHtmlViewer;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[role="alert"]')!.textContent).to.equal('Document URL is not allowed.');
  });
  it('is accessible', async () => { const el = await fixture(html`<lyra-html-viewer></lyra-html-viewer>`); await expect(el).to.be.accessible(); });
});
