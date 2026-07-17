import { expect, fixture, html, oneEvent, waitUntil } from '@open-wc/testing';
import './email-viewer.js';
import type { LyraEmailViewer } from './email-viewer.js';
import { __setEmailDepsForTesting } from './email-loader.js';

const SAMPLE_EML = [
  'From: Ada Lovelace <ada@example.test>', 'To: Grace Hopper <grace@example.test>', 'Subject: Quarterly report',
  'Date: Tue, 14 Jul 2026 09:30:00 +0000', 'Content-Type: text/html; charset=utf-8', '', '<p>Totals are <strong>up 12%</strong>.</p>', '',
].join('\r\n');
const TEXT_EML = ['From: Ada <ada@example.test>', 'Subject: Plain note', 'Content-Type: text/plain; charset=utf-8', '', 'See you at noon.', ''].join('\r\n');
const EVIL_EML = ['Subject: Evil', 'Content-Type: text/html; charset=utf-8', '', '<p onclick="bad()">Click</p><script>bad()</script>', ''].join('\r\n');

const ATTACHMENT_EML = [
  'From: Ada <ada@example.test>',
  'Subject: Report attached',
  'Content-Type: multipart/mixed; boundary="BOUNDARY"',
  '',
  '--BOUNDARY',
  'Content-Type: text/plain; charset=utf-8',
  '',
  'See attached.',
  '',
  '--BOUNDARY',
  'Content-Type: text/plain; name="notes.txt"',
  'Content-Disposition: attachment; filename="notes.txt"',
  'Content-Transfer-Encoding: base64',
  '',
  typeof Buffer !== 'undefined' ? Buffer.from('hello attachment').toString('base64') : btoa('hello attachment'),
  '--BOUNDARY--',
  '',
].join('\r\n');

const QUOTED_TEXT_EML = [
  'From: Ada <ada@example.test>',
  'Subject: Re: thread',
  'Content-Type: text/plain; charset=utf-8',
  '',
  'Sounds good.',
  '',
  '> On Tue, Grace wrote:',
  '> Let’s meet at noon.',
  '> I will bring the report.',
  '',
].join('\r\n');

const SHORT_QUOTE_EML = [
  'From: Ada <ada@example.test>',
  'Subject: Re: thread',
  'Content-Type: text/plain; charset=utf-8',
  '',
  'Sounds good.',
  '',
  '> just one line',
  '',
].join('\r\n');

const GMAIL_QUOTE_EML = [
  'From: Ada <ada@example.test>',
  'Subject: Re: thread',
  'Content-Type: text/html; charset=utf-8',
  '',
  '<p>Sounds good.</p><div class="gmail_quote"><p>On Tue, Grace wrote:</p><p>Let us meet at noon.</p></div>',
  '',
].join('\r\n');

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

  describe('attachments', () => {
    it('retains attachment content as Uint8Array and never creates an object URL itself', async () => {
      const originalCreateObjectURL = URL.createObjectURL;
      let createObjectUrlCalled = false;
      URL.createObjectURL = (() => {
        createObjectUrlCalled = true;
        return '';
      }) as typeof URL.createObjectURL;
      try {
        const { el, restore } = await loaded(ATTACHMENT_EML);
        try {
          const listener = oneEvent(el, 'lyra-attachment-open');
          (el.shadowRoot!.querySelector('[part="attachment-button"]') as HTMLButtonElement).click();
          const event = (await listener) as CustomEvent<{ attachment: { filename: string; content?: Uint8Array } }>;
          expect(event.detail.attachment.filename).to.equal('notes.txt');
          expect(event.detail.attachment.content).to.be.instanceOf(Uint8Array);
          expect(new TextDecoder().decode(event.detail.attachment.content)).to.equal('hello attachment');
          expect(createObjectUrlCalled).to.be.false;
        } finally {
          restore();
        }
      } finally {
        URL.createObjectURL = originalCreateObjectURL;
      }
    });

    it('emits lyra-attachment-open on keyboard activation (Enter)', async () => {
      const { el, restore } = await loaded(ATTACHMENT_EML);
      try {
        const listener = oneEvent(el, 'lyra-attachment-open');
        const button = el.shadowRoot!.querySelector('[part="attachment-button"]') as HTMLButtonElement;
        button.focus();
        button.click(); // jsdom-free Chromium test environment: Enter on a focused <button> triggers click natively
        await listener;
      } finally {
        restore();
      }
    });
  });

  describe('fold-quotes (text body)', () => {
    it('folds a >= 3 line trailing quote run behind a toggle', async () => {
      const restore = stubFetch(QUOTED_TEXT_EML);
      const el = await fixture<LyraEmailViewer>(html`<lyra-email-viewer fold-quotes src="https://example.test/message.eml"></lyra-email-viewer>`);
      try {
        await waitUntil(() => el.shadowRoot!.querySelector('[part="quote-toggle"]') !== null);
        const quoted = el.shadowRoot!.querySelector('[part="quoted"]') as HTMLElement;
        expect(quoted.hasAttribute('hidden')).to.be.true;
        const toggle = el.shadowRoot!.querySelector('[part="quote-toggle"]') as HTMLButtonElement;
        expect(toggle.getAttribute('aria-expanded')).to.equal('false');
        toggle.click();
        await el.updateComplete;
        expect(quoted.hasAttribute('hidden')).to.be.false;
        expect(toggle.getAttribute('aria-expanded')).to.equal('true');
      } finally {
        restore();
      }
    });

    it('does not fold a short (< 3 line) quote-looking tail', async () => {
      const restore = stubFetch(SHORT_QUOTE_EML);
      const el = await fixture<LyraEmailViewer>(html`<lyra-email-viewer fold-quotes src="https://example.test/message.eml"></lyra-email-viewer>`);
      try {
        await waitUntil(() => el.shadowRoot!.querySelector('[part="body-text"]') !== null);
        expect(el.shadowRoot!.querySelector('[part="quote-toggle"]')).to.not.exist;
      } finally {
        restore();
      }
    });
  });

  describe('fold-quotes (html body)', () => {
    it('folds a gmail_quote block behind a toggle', async () => {
      const restore = stubFetch(GMAIL_QUOTE_EML);
      const el = await fixture<LyraEmailViewer>(html`<lyra-email-viewer fold-quotes src="https://example.test/message.eml"></lyra-email-viewer>`);
      try {
        await waitUntil(() => el.shadowRoot!.querySelector('[part="quote-toggle"]') !== null);
        const quoted = el.shadowRoot!.querySelector('[part="quoted"]') as HTMLElement;
        expect(quoted.hasAttribute('hidden')).to.be.true;
        expect(quoted.textContent).to.contain('Let us meet at noon');
      } finally {
        restore();
      }
    });
  });

  describe('back-compat', () => {
    it('body rendering is byte-identical with fold-quotes off (the default)', async () => {
      const { el, restore } = await loaded(SAMPLE_EML);
      try {
        expect(el.shadowRoot!.querySelector('[part="quote-toggle"]')).to.not.exist;
        expect(el.shadowRoot!.querySelector('[part="body-html"] strong')!.textContent).to.equal('up 12%');
      } finally {
        restore();
      }
    });
  });
});
