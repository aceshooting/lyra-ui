import { expect, fixture, html, oneEvent, waitUntil } from '@open-wc/testing';
import './email-viewer.js';
import type { LyraEmailViewer } from './email-viewer.js';
import { __setEmailDepsForTesting } from './email-loader.js';
import { DEFAULT_MAX_RESOURCE_BYTES } from '../../../internal/resource-loader.js';
import { styles } from './email-viewer.styles.js';

const SAMPLE_EML = [
  'From: Ada Lovelace <ada@example.test>', 'To: Grace Hopper <grace@example.test>', 'Subject: Quarterly report',
  'Date: Tue, 14 Jul 2026 09:30:00 +0000', 'Content-Type: text/html; charset=utf-8', '', '<p>Totals are <strong>up 12%</strong>.</p>', '',
].join('\r\n');
const TEXT_EML = ['From: Ada <ada@example.test>', 'Subject: Plain note', 'Content-Type: text/plain; charset=utf-8', '', 'See you at noon.', ''].join('\r\n');
const EVIL_EML = ['Subject: Evil', 'Content-Type: text/html; charset=utf-8', '', '<p onclick="bad()">Click</p><script>bad()</script>', ''].join('\r\n');

const LONG_FILENAME = 'ThisIsAnIntentionallyVeryLongUnbrokenAttachmentFileNameWithoutAnySpacesOrHyphensForcingOverflow.txt';
const LONG_FILENAME_ATTACHMENT_EML = [
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
  `Content-Type: text/plain; name="${LONG_FILENAME}"`,
  `Content-Disposition: attachment; filename="${LONG_FILENAME}"`,
  'Content-Transfer-Encoding: base64',
  '',
  typeof Buffer !== 'undefined' ? Buffer.from('hello attachment').toString('base64') : btoa('hello attachment'),
  '--BOUNDARY--',
  '',
].join('\r\n');

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
  const el = await fixture<LyraEmailViewer>(html`<lr-email-viewer src="https://example.test/message.eml"></lr-email-viewer>`);
  await waitUntil(() => el.shadowRoot!.querySelector('[part="body"]') !== null);
  return { el, restore };
}

/** An `Error` shaped like `DOMException('AbortError')` -- matches `<lr-docx-viewer>`/`<lr-include>`'s
 *  own test helper of the same name, since all three components reject a stale/aborted fetch the same way. */
function abortError(): Error {
  const error = new Error('The operation was aborted.');
  error.name = 'AbortError';
  return error;
}

describe('lr-email-viewer', () => {
  afterEach(() => __setEmailDepsForTesting(undefined));

  it('renders a localized empty state by default', async () => {
    const el = await fixture<LyraEmailViewer>(html`<lr-email-viewer></lr-email-viewer>`);
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
      const el = await fixture<LyraEmailViewer>(html`<lr-email-viewer src="https://example.test/message.eml"></lr-email-viewer>`);
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
      const el = await fixture<LyraEmailViewer>(html`<lr-email-viewer src="https://example.test/message.eml"></lr-email-viewer>`);
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
      const el = await fixture<LyraEmailViewer>(html`<lr-email-viewer .src=${'java\tscript:alert(1)'}></lr-email-viewer>`);
      await el.updateComplete;
      expect(called).to.be.false;
      expect(el.shadowRoot!.querySelector('[part="error"]')).to.exist;
    } finally { window.fetch = original; }
  });

  it('shows the generic failed-to-load error when the response is not ok', async () => {
    const restore = stubFetch('irrelevant body', false);
    try {
      const el = await fixture<LyraEmailViewer>(html`<lr-email-viewer src="https://example.test/missing.eml"></lr-email-viewer>`);
      await waitUntil(() => el.shadowRoot!.querySelector('[part="error"]') !== null);
      expect(el.shadowRoot!.querySelector('[part="error"]')!.textContent).to.equal('Failed to load document.');
    } finally {
      restore();
    }
  });

  it('reports a distinct message when the response exceeds the resource size limit', async () => {
    const original = window.fetch;
    window.fetch = (() =>
      Promise.resolve({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: { get: (name: string) => (name.toLowerCase() === 'content-length' ? String(DEFAULT_MAX_RESOURCE_BYTES + 1) : null) },
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
      } as unknown as Response)) as typeof window.fetch;
    try {
      const el = await fixture<LyraEmailViewer>(html`<lr-email-viewer src="https://example.test/huge.eml"></lr-email-viewer>`);
      await waitUntil(() => el.shadowRoot!.querySelector('[part="error"]') !== null);
      expect(el.shadowRoot!.querySelector('[part="error"]')!.textContent).to.equal('This document is too large to preview.');
    } finally {
      window.fetch = original;
    }
  });

  it('aborts a stale in-flight request when src changes, and never surfaces its rejection as an error', async () => {
    const el = await fixture<LyraEmailViewer>(html`<lr-email-viewer></lr-email-viewer>`);
    const original = window.fetch;
    const signals: (AbortSignal | null | undefined)[] = [];
    window.fetch = ((url: string, init?: RequestInit) => {
      signals.push(init?.signal);
      if (url === 'https://example.test/stale.eml') {
        // Never resolves on its own; only settles once the caller aborts it.
        return new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(abortError()));
        });
      }
      return Promise.resolve(response(SAMPLE_EML));
    }) as typeof window.fetch;
    let renderErrorCount = 0;
    el.addEventListener('lr-render-error', () => { renderErrorCount += 1; });
    try {
      el.src = 'https://example.test/stale.eml';
      await waitUntil(() => signals.length > 0);
      el.src = 'https://example.test/fresh.eml';
      await waitUntil(() => el.shadowRoot!.querySelector('[part="body"]') !== null);
      expect(signals[0]?.aborted, 'the stale request should have been aborted').to.be.true;
      expect(el.shadowRoot!.querySelector('[part="error"]')).to.not.exist;
      expect(renderErrorCount).to.equal(0);
    } finally {
      window.fetch = original;
    }
  });

  it('loads without an abort signal when AbortController is unavailable', async () => {
    const restore = stubFetch(SAMPLE_EML);
    const originalAbortController = window.AbortController;
    (window as unknown as { AbortController?: unknown }).AbortController = undefined;
    try {
      const el = await fixture<LyraEmailViewer>(html`<lr-email-viewer src="https://example.test/message.eml"></lr-email-viewer>`);
      await waitUntil(() => el.shadowRoot!.querySelector('[part="body"]') !== null);
      expect(el.shadowRoot!.querySelector('[part="subject"]')!.textContent).to.contain('Quarterly report');
    } finally {
      window.AbortController = originalAbortController;
      restore();
    }
  });

  it('supports max-height and localization overrides', async () => {
    const el = await fixture<LyraEmailViewer>(html`<lr-email-viewer max-height="20rem" .strings=${{ emailViewerFrom: 'De' }}></lr-email-viewer>`);
    expect((el.shadowRoot!.querySelector('[part="base"]') as HTMLElement).style.getPropertyValue('--lr-email-viewer-max-height')).to.equal('20rem');
    const { el: rendered, restore } = await loaded(SAMPLE_EML);
    try { rendered.strings = { emailViewerFrom: 'De' }; rendered.requestUpdate(); await rendered.updateComplete; expect(rendered.shadowRoot!.querySelector('[part="from-label"]')!.textContent).to.equal('De'); } finally { restore(); }
  });

  it('is accessible in the empty state', async () => {
    const el = await fixture<LyraEmailViewer>(html`<lr-email-viewer></lr-email-viewer>`);
    await expect(el).to.be.accessible();
  });

  it('is accessible once a message has loaded (headers grid, attachment list/buttons)', async () => {
    const { el, restore } = await loaded(ATTACHMENT_EML);
    try {
      expect(el.shadowRoot!.querySelectorAll('[part="headers"]').length).to.equal(1);
      expect(el.shadowRoot!.querySelectorAll('[part="attachment-button"]').length).to.be.greaterThan(0);
      await expect(el).to.be.accessible();
    } finally {
      restore();
    }
  });

  it('is accessible with the quote-fold toggle expanded', async () => {
    const restore = stubFetch(QUOTED_TEXT_EML);
    try {
      const el = await fixture<LyraEmailViewer>(html`<lr-email-viewer fold-quotes src="https://example.test/message.eml"></lr-email-viewer>`);
      await waitUntil(() => el.shadowRoot!.querySelector('[part="quote-toggle"]') !== null);
      (el.shadowRoot!.querySelector('[part="quote-toggle"]') as HTMLButtonElement).click();
      await el.updateComplete;
      expect(el.shadowRoot!.querySelector('[part="quoted"]')!.hasAttribute('hidden')).to.be.false;
      await expect(el).to.be.accessible();
    } finally {
      restore();
    }
  });

  it('uses name as the accessible name, falling back to a host aria-label and then a localized default', async () => {
    const named = await fixture<LyraEmailViewer>(html`<lr-email-viewer name="message.eml"></lr-email-viewer>`);
    expect(named.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal('message.eml');
    const labeled = await fixture<LyraEmailViewer>(html`<lr-email-viewer aria-label="Inbox message"></lr-email-viewer>`);
    expect(labeled.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal('Inbox message');
    const unnamed = await fixture<LyraEmailViewer>(html`<lr-email-viewer></lr-email-viewer>`);
    expect(unnamed.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal('Email viewer');
  });

  it('supports a .strings override for the emailViewerLabel fallback', async () => {
    const el = await fixture<LyraEmailViewer>(html`<lr-email-viewer .strings=${{ emailViewerLabel: 'Visionneuse de courriels' }}></lr-email-viewer>`);
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
          const listener = oneEvent(el, 'lr-attachment-open');
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

    it('emits lr-attachment-open on keyboard activation (Enter)', async () => {
      const { el, restore } = await loaded(ATTACHMENT_EML);
      try {
        const listener = oneEvent(el, 'lr-attachment-open');
        const button = el.shadowRoot!.querySelector('[part="attachment-button"]') as HTMLButtonElement;
        button.focus();
        button.click(); // jsdom-free Chromium test environment: Enter on a focused <button> triggers click natively
        await listener;
      } finally {
        restore();
      }
    });

    it('localizes the attachment file-size unit via this.localize(), not a hardcoded English abbreviation', async () => {
      // 'hello attachment' is 16 bytes -- under the 1024 threshold, so this exercises the 'B' unit.
      const restore = stubFetch(ATTACHMENT_EML);
      try {
        const el = await fixture<LyraEmailViewer>(
          html`<lr-email-viewer src="https://example.test/message.eml" .strings=${{ fileSizeUnitB: 'o' }}></lr-email-viewer>`,
        );
        await waitUntil(() => el.shadowRoot!.querySelector('[part="body"]') !== null);
        const button = el.shadowRoot!.querySelector('[part="attachment-button"]') as HTMLButtonElement;
        const sizeText = button.querySelectorAll('span')[1]!.textContent;
        expect(sizeText).to.equal('16 o');
      } finally {
        restore();
      }
    });

    it('defaults to the English file-size unit abbreviation when no strings override is set', async () => {
      const { el, restore } = await loaded(ATTACHMENT_EML);
      try {
        const button = el.shadowRoot!.querySelector('[part="attachment-button"]') as HTMLButtonElement;
        const sizeText = button.querySelectorAll('span')[1]!.textContent;
        expect(sizeText).to.equal('16 B');
      } finally {
        restore();
      }
    });

    it('formats group and address-only/name-only/empty senders, and normalizes Uint8Array/ArrayBuffer/string attachment content', async () => {
      __setEmailDepsForTesting({
        PostalMime: {
          parse: () =>
            Promise.resolve({
              from: {
                group: [
                  { name: 'Ada Lovelace', address: 'ada@example.test' },
                  { address: 'bob@example.test' },
                  { name: 'NoAddress' },
                  {}, // neither name nor address -- exercises the final `?? ''` fallback
                ],
              },
              to: [{ address: 'grace@example.test' }],
              subject: 'Group test',
              date: '',
              text: 'Hi there',
              attachments: [
                { filename: 'bytes.bin', mimeType: 'application/octet-stream', content: new Uint8Array([1, 2, 3]) },
                { filename: 'note.txt', mimeType: 'text/plain', content: 'plain string content' },
                { filename: 'blob.bin', mimeType: 'application/octet-stream', content: new ArrayBuffer(4) },
              ],
            }),
        },
        DOMPurify: undefined,
      });
      const restore = stubFetch(SAMPLE_EML);
      try {
        const el = await fixture<LyraEmailViewer>(html`<lr-email-viewer src="https://example.test/message.eml"></lr-email-viewer>`);
        await waitUntil(() => el.shadowRoot!.querySelector('[part="body"]') !== null);
        // The empty `{}` group member formats to '' and is dropped by formatAddress's own
        // `.filter(Boolean)`, so it contributes coverage of the fallback without appearing here.
        expect(el.shadowRoot!.querySelector('[part="from"]')!.textContent).to.equal(
          'Ada Lovelace <ada@example.test>, bob@example.test, NoAddress',
        );
        expect(el.shadowRoot!.querySelector('[part="to"]')!.textContent).to.equal('grace@example.test');
        const buttons = el.shadowRoot!.querySelectorAll('[part="attachment-button"]');
        expect(buttons.length).to.equal(3);

        const bytesListener = oneEvent(el, 'lr-attachment-open');
        (buttons[0] as HTMLButtonElement).click();
        const bytesEvent = (await bytesListener) as CustomEvent<{ attachment: { content?: Uint8Array } }>;
        expect(bytesEvent.detail.attachment.content).to.be.instanceOf(Uint8Array);
        expect(Array.from(bytesEvent.detail.attachment.content!)).to.deep.equal([1, 2, 3]);

        const stringListener = oneEvent(el, 'lr-attachment-open');
        (buttons[1] as HTMLButtonElement).click();
        const stringEvent = (await stringListener) as CustomEvent<{ attachment: { content?: Uint8Array } }>;
        expect(stringEvent.detail.attachment.content).to.be.instanceOf(Uint8Array);
        expect(new TextDecoder().decode(stringEvent.detail.attachment.content)).to.equal('plain string content');

        const bufferListener = oneEvent(el, 'lr-attachment-open');
        (buttons[2] as HTMLButtonElement).click();
        const bufferEvent = (await bufferListener) as CustomEvent<{ attachment: { content?: Uint8Array } }>;
        expect(bufferEvent.detail.attachment.content).to.be.instanceOf(Uint8Array);
        expect(bufferEvent.detail.attachment.content!.byteLength).to.equal(4);
      } finally {
        restore();
      }
    });

    it('lets a no-space filename shrink/wrap inside a narrow host instead of overflowing the row', async () => {
      const restore = stubFetch(LONG_FILENAME_ATTACHMENT_EML);
      try {
        const el = await fixture<LyraEmailViewer>(
          html`<lr-email-viewer style="width: 220px" src="https://example.test/message.eml"></lr-email-viewer>`,
        );
        await waitUntil(() => el.shadowRoot!.querySelector('[part="body"]') !== null);
        const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
        const button = el.shadowRoot!.querySelector('[part="attachment-button"]') as HTMLButtonElement;
        expect(button.querySelector('span')!.textContent).to.equal(LONG_FILENAME);
        // [part='base'] clips overflow (overflow: hidden) -- its scrollWidth reports the full
        // unclipped layout size, so a mismatch against clientWidth confirms the long filename
        // forced the row past the host's own allocation instead of shrinking/eliding.
        expect(base.scrollWidth, 'the long filename must not force [part="base"] to overflow its own allocation').to.be.at.most(base.clientWidth);
      } finally {
        restore();
      }
    });
  });

  describe('fold-quotes (text body)', () => {
    it('folds a >= 3 line trailing quote run behind a toggle', async () => {
      const restore = stubFetch(QUOTED_TEXT_EML);
      const el = await fixture<LyraEmailViewer>(html`<lr-email-viewer fold-quotes src="https://example.test/message.eml"></lr-email-viewer>`);
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
      const el = await fixture<LyraEmailViewer>(html`<lr-email-viewer fold-quotes src="https://example.test/message.eml"></lr-email-viewer>`);
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
      const el = await fixture<LyraEmailViewer>(html`<lr-email-viewer fold-quotes src="https://example.test/message.eml"></lr-email-viewer>`);
      try {
        await waitUntil(() => el.shadowRoot!.querySelector('[part="quote-toggle"]') !== null);
        const quoted = el.shadowRoot!.querySelector('[part="quoted"]') as HTMLElement;
        expect(quoted.hasAttribute('hidden')).to.be.true;
        expect(quoted.textContent).to.contain('Let us meet at noon');
      } finally {
        restore();
      }
    });

    it('toggles a folded HTML quote block via the delegated body click handler, and ignores clicks outside the toggle', async () => {
      const restore = stubFetch(GMAIL_QUOTE_EML);
      const el = await fixture<LyraEmailViewer>(html`<lr-email-viewer fold-quotes src="https://example.test/message.eml"></lr-email-viewer>`);
      try {
        await waitUntil(() => el.shadowRoot!.querySelector('[part="quote-toggle"]') !== null);
        const bodyHtml = el.shadowRoot!.querySelector('[part="body-html"]') as HTMLElement;
        const quoted = el.shadowRoot!.querySelector('[part="quoted"]') as HTMLElement;
        const toggle = el.shadowRoot!.querySelector('[part="quote-toggle"]') as HTMLButtonElement;
        expect(quoted.hasAttribute('hidden')).to.be.true;

        // A click elsewhere in the sanitized body (not on the toggle) must not touch the quote block.
        (bodyHtml.querySelector('p') as HTMLElement).click();
        expect(quoted.hasAttribute('hidden')).to.be.true;

        toggle.click();
        expect(quoted.hasAttribute('hidden')).to.be.false;
        expect(toggle.getAttribute('aria-expanded')).to.equal('true');
        expect(toggle.textContent).to.equal('Hide quoted text');

        toggle.click();
        expect(quoted.hasAttribute('hidden')).to.be.true;
        expect(toggle.getAttribute('aria-expanded')).to.equal('false');
        expect(toggle.textContent).to.equal('Show quoted text');
      } finally {
        restore();
      }
    });

    it('leaves the toggle untouched if its matching quote block is no longer in the DOM', async () => {
      const restore = stubFetch(GMAIL_QUOTE_EML);
      const el = await fixture<LyraEmailViewer>(html`<lr-email-viewer fold-quotes src="https://example.test/message.eml"></lr-email-viewer>`);
      try {
        await waitUntil(() => el.shadowRoot!.querySelector('[part="quote-toggle"]') !== null);
        const toggle = el.shadowRoot!.querySelector('[part="quote-toggle"]') as HTMLButtonElement;
        // Simulate the block/toggle pairing going stale (e.g. external DOM mutation) so the
        // `data-quote-index` lookup in the click handler comes back empty.
        el.shadowRoot!.querySelector('[data-quote-index="0"]')!.remove();
        toggle.click();
        expect(toggle.getAttribute('aria-expanded')).to.equal('false');
        expect(toggle.textContent).to.equal('Show quoted text');
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

describe('styling', () => {
  it('gives quote-toggle a hover state', () => {
    const css = styles.cssText.replace(/\s+/g, ' ');
    expect(css).to.match(/\[part='quote-toggle'\]:hover/);
  });
});
