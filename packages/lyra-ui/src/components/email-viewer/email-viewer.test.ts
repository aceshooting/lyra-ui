import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import './email-viewer.js';
import type { LyraEmailViewer } from './email-viewer.js';
import { __setEmailDepsForTesting } from './email-loader.js';

const SAMPLE_EML = [
  'From: Ada Lovelace <ada@example.test>', 'To: Grace Hopper <grace@example.test>', 'Subject: Quarterly report',
  'Date: Tue, 14 Jul 2026 09:30:00 +0000', 'Content-Type: text/html; charset=utf-8', '', '<p>Totals are <strong>up 12%</strong>.</p>', '',
].join('\r\n');
const TEXT_EML = ['From: Ada <ada@example.test>', 'Subject: Plain note', 'Content-Type: text/plain; charset=utf-8', '', 'See you at noon.', ''].join('\r\n');
const EVIL_EML = ['Subject: Evil', 'Content-Type: text/html; charset=utf-8', '', '<p onclick="bad()">Click</p><script>bad()</script>', ''].join('\r\n');

function response(body: string, ok = true): Response {
  const bytes = new TextEncoder().encode(body);
  return { ok, status: ok ? 200 : 404, statusText: ok ? 'OK' : 'Not Found', arrayBuffer: () => Promise.resolve(bytes.buffer) } as Response;
}
function stubFetch(body: string, ok = true): () => void {
  const original = window.fetch;
  window.fetch = (() => Promise.resolve(response(body, ok))) as typeof window.fetch;
  return () => { window.fetch = original; };
}

async function loaded(body: string): Promise<{ el: LyraEmailViewer; restore: () => void }> {
  const restore = stubFetch(body);
  const el = await fixture<LyraEmailViewer>(html`<lyra-email-viewer src="https://example.test/message.eml"></lyra-email-viewer>`);
  await waitUntil(() => el.shadowRoot!.querySelector('[part="body"]') !== null);
  return { el, restore };
}

describe('lyra-email-viewer', () => {
  afterEach(() => __setEmailDepsForTesting(undefined));

  it('renders a localized empty state by default', async () => {
    const el = await fixture<LyraEmailViewer>(html`<lyra-email-viewer></lyra-email-viewer>`);
    expect(el.shadowRoot!.querySelector('.empty-note')!.textContent).to.equal('No email to display.');
  });

  it('parses and renders a sanitized HTML message', async () => {
    const { el, restore } = await loaded(SAMPLE_EML);
    try {
      expect(el.shadowRoot!.querySelector('[part="from"]')!.textContent).to.contain('Ada Lovelace');
      expect(el.shadowRoot!.querySelector('[part="subject"]')!.textContent).to.contain('Quarterly report');
      expect(el.shadowRoot!.querySelector('[part="body-html"] strong')!.textContent).to.equal('up 12%');
    } finally { restore(); }
  });

  it('removes scripts and event handlers from HTML', async () => {
    const { el, restore } = await loaded(EVIL_EML);
    try {
      const body = el.shadowRoot!.querySelector('[part="body-html"]')!;
      expect(body.querySelector('script')).to.not.exist;
      expect(body.querySelector('p')!.getAttribute('onclick')).to.be.null;
    } finally { restore(); }
  });

  it('falls back to plain text', async () => {
    const { el, restore } = await loaded(TEXT_EML);
    try {
      expect(el.shadowRoot!.querySelector('[part="body-html"]')).to.not.exist;
      expect(el.shadowRoot!.querySelector('[part="body-text"]')!.textContent).to.contain('See you at noon.');
    } finally { restore(); }
  });

  it('shows an error instead of a silently empty body when an HTML-only message has no sanitizer available', async () => {
    __setEmailDepsForTesting({
      PostalMime: { parse: () => Promise.resolve({ html: '<p>Totals are up 12%.</p>', attachments: [] }) },
      DOMPurify: undefined,
    });
    const restore = stubFetch(SAMPLE_EML);
    try {
      const el = await fixture<LyraEmailViewer>(html`<lyra-email-viewer src="https://example.test/message.eml"></lyra-email-viewer>`);
      await waitUntil(() => el.shadowRoot!.querySelector('[part="error"]') !== null);
      expect(el.shadowRoot!.querySelector('[part="error"]')!.textContent).to.equal(
        'This viewer needs the optional "dompurify" package installed to render safely.',
      );
      expect(el.shadowRoot!.querySelector('[part="body-html"]')).to.not.exist;
      expect(el.shadowRoot!.querySelector('[part="body-text"]')).to.not.exist;
    } finally { restore(); }
  });

  it('still falls back to plain text when DOMPurify is unavailable but the message has a text alternative', async () => {
    __setEmailDepsForTesting({
      PostalMime: { parse: () => Promise.resolve({ html: '<p>Ignored</p>', text: 'See you at noon.', attachments: [] }) },
      DOMPurify: undefined,
    });
    const restore = stubFetch(SAMPLE_EML);
    try {
      const el = await fixture<LyraEmailViewer>(html`<lyra-email-viewer src="https://example.test/message.eml"></lyra-email-viewer>`);
      await waitUntil(() => el.shadowRoot!.querySelector('[part="body"]') !== null);
      expect(el.shadowRoot!.querySelector('[part="body-text"]')!.textContent).to.contain('See you at noon.');
      expect(el.shadowRoot!.querySelector('[part="error"]')).to.not.exist;
    } finally { restore(); }
  });

  it('rejects unsafe URLs before fetch', async () => {
    let called = false;
    const original = window.fetch;
    window.fetch = (() => { called = true; return Promise.reject(new Error('unexpected')); }) as typeof window.fetch;
    try {
      const el = await fixture<LyraEmailViewer>(html`<lyra-email-viewer .src=${'java\tscript:alert(1)'}></lyra-email-viewer>`);
      await el.updateComplete;
      expect(called).to.be.false;
      expect(el.shadowRoot!.querySelector('[part="error"]')).to.exist;
    } finally { window.fetch = original; }
  });

  it('supports max-height and localization overrides', async () => {
    const el = await fixture<LyraEmailViewer>(html`<lyra-email-viewer max-height="20rem" .strings=${{ emailViewerFrom: 'De' }}></lyra-email-viewer>`);
    expect((el.shadowRoot!.querySelector('[part="base"]') as HTMLElement).style.getPropertyValue('--lyra-email-viewer-max-height')).to.equal('20rem');
    const { el: rendered, restore } = await loaded(SAMPLE_EML);
    try { rendered.strings = { emailViewerFrom: 'De' }; rendered.requestUpdate(); await rendered.updateComplete; expect(rendered.shadowRoot!.querySelector('[part="from-label"]')!.textContent).to.equal('De'); } finally { restore(); }
  });

  it('is accessible in the empty state', async () => {
    const el = await fixture<LyraEmailViewer>(html`<lyra-email-viewer></lyra-email-viewer>`);
    await expect(el).to.be.accessible();
  });

  it('uses name as the accessible name, falling back to a host aria-label and then a localized default', async () => {
    const named = await fixture<LyraEmailViewer>(html`<lyra-email-viewer name="message.eml"></lyra-email-viewer>`);
    expect(named.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal('message.eml');
    const labeled = await fixture<LyraEmailViewer>(html`<lyra-email-viewer aria-label="Inbox message"></lyra-email-viewer>`);
    expect(labeled.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal('Inbox message');
    const unnamed = await fixture<LyraEmailViewer>(html`<lyra-email-viewer></lyra-email-viewer>`);
    expect(unnamed.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal('Email viewer');
  });

  it('supports a .strings override for the emailViewerLabel fallback', async () => {
    const el = await fixture<LyraEmailViewer>(html`<lyra-email-viewer .strings=${{ emailViewerLabel: 'Visionneuse de courriels' }}></lyra-email-viewer>`);
    expect(el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal('Visionneuse de courriels');
  });
});
