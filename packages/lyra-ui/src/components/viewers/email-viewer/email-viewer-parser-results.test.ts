import { expect, fixture, html, oneEvent, waitUntil } from '@open-wc/testing';
import './email-viewer.js';
import type { LyraEmailViewer } from './email-viewer.js';
import { __setEmailDepsForTesting, type EmailDeps } from './email-loader.js';

const EML = ['Subject: Stub', 'Content-Type: text/plain; charset=utf-8', '', 'ignored', ''].join('\r\n');

function stubFetch(): () => void {
  const original = window.fetch;
  const bytes = new TextEncoder().encode(EML);
  window.fetch = (() => Promise.resolve({
    ok: true,
    status: 200,
    statusText: 'OK',
    arrayBuffer: () => Promise.resolve(bytes.buffer),
  } as Response)) as typeof window.fetch;
  return () => { window.fetch = original; };
}

async function mountWith(deps: EmailDeps, selector: string): Promise<{ el: LyraEmailViewer; restore: () => void }> {
  __setEmailDepsForTesting(deps);
  const restore = stubFetch();
  const el = await fixture<LyraEmailViewer>(html`<lr-email-viewer src="https://example.test/message.eml"></lr-email-viewer>`);
  await waitUntil(() => el.shadowRoot!.querySelector(selector) !== null, `${selector} never rendered`, { timeout: 5000 });
  return { el, restore };
}

function parserReturning(value: unknown): EmailDeps {
  return { PostalMime: { parse: () => Promise.resolve(value as never) }, DOMPurify: undefined };
}

describe('lr-email-viewer parser results', () => {
  afterEach(() => __setEmailDepsForTesting(undefined));

  it('shows the localized missing-parser error when the postal-mime peer is unavailable', async () => {
    const { el, restore } = await mountWith({ PostalMime: undefined, DOMPurify: undefined }, '[part="error"]');
    try {
      expect(el.shadowRoot!.querySelector('[part="error"]')!.textContent).to.equal(
        'This viewer needs the optional "postal-mime" package installed to parse this message.',
      );
    } finally {
      restore();
    }
  });

  it('treats a parser result that is not a record as a failed load', async () => {
    for (const value of [null, 'plain string', 42]) {
      const { el, restore } = await mountWith(parserReturning(value), '[part="error"]');
      try {
        expect(el.shadowRoot!.querySelector('[part="error"]')!.textContent, String(value))
          .to.equal('Failed to load document.');
      } finally {
        restore();
      }
    }
  });

  it('ignores a non-array attachment field while keeping the message body', async () => {
    const { el, restore } = await mountWith(
      parserReturning({ text: 'Body survives.', attachments: { 0: { filename: 'x.txt', content: 'x' }, length: 1 } }),
      '[part="body-text"]',
    );
    try {
      expect(el.shadowRoot!.querySelector('[part="body-text"]')!.textContent).to.contain('Body survives.');
      expect(el.shadowRoot!.querySelector('[part="attachments"]') === null).to.equal(true);
    } finally {
      restore();
    }
  });

  it('defaults a missing attachment filename and MIME type, and skips sparse recipient holes', async () => {
    const to: unknown[] = [];
    to[1] = { name: 'Grace Hopper', address: 'grace@example.test' };
    const { el, restore } = await mountWith(
      parserReturning({ text: 'Hi', to, attachments: [{ content: 'abc' }] }),
      '[part="attachment-button"]',
    );
    try {
      expect(el.shadowRoot!.querySelector('[part="to"]')!.textContent).to.contain('Grace Hopper');
      const button = el.shadowRoot!.querySelector<HTMLButtonElement>('[part="attachment-button"]')!;
      expect(el.shadowRoot!.querySelector('[part="attachment-name"]')!.textContent).to.equal('Unnamed attachment');
      const opened = oneEvent(el, 'lr-attachment-open');
      button.click();
      const { detail } = (await opened) as CustomEvent<{ attachment: { filename: string; mimeType: string; content?: Blob } }>;
      expect(detail.attachment.filename).to.equal('Unnamed attachment');
      expect(detail.attachment.mimeType).to.equal('');
      expect(await detail.attachment.content!.text()).to.equal('abc');
    } finally {
      restore();
    }
  });

  it('discards a parse that settles after the viewer was disconnected', async () => {
    let settle!: (value: unknown) => void;
    let parseCalls = 0;
    __setEmailDepsForTesting({
      PostalMime: {
        parse: () => {
          parseCalls += 1;
          return new Promise((resolve) => { settle = resolve as (value: unknown) => void; }) as never;
        },
      },
      DOMPurify: undefined,
    });
    const restore = stubFetch();
    try {
      const el = await fixture<LyraEmailViewer>(html`<lr-email-viewer src="https://example.test/message.eml"></lr-email-viewer>`);
      await waitUntil(() => parseCalls === 1, 'parse never started', { timeout: 5000 });
      let errors = 0;
      el.addEventListener('lr-render-error', () => { errors += 1; });
      el.remove();
      settle({ text: 'Too late.' });
      await new Promise((resolve) => setTimeout(resolve, 50));
      await el.updateComplete;
      expect(errors).to.equal(0);
      expect(el.shadowRoot!.querySelector('[part="body-text"]') === null).to.equal(true);
    } finally {
      restore();
    }
  });

  for (const stage of ['response', 'body'] as const) {
    it(`never parses a message whose ${stage} settles after the viewer was disconnected`, async () => {
      let parses = 0;
      __setEmailDepsForTesting({
        PostalMime: { parse: () => { parses += 1; return Promise.resolve({ text: 'Too late.' } as never); } },
        DOMPurify: undefined,
      });
      const bytes = new TextEncoder().encode(EML);
      let release: (() => void) | undefined;
      const original = window.fetch;
      window.fetch = (() => {
        const ready = (): Response => ({
          ok: true,
          status: 200,
          statusText: 'OK',
          arrayBuffer: () => stage === 'body'
            ? new Promise<ArrayBuffer>((resolve) => { release = () => resolve(bytes.buffer); })
            : Promise.resolve(bytes.buffer),
        } as Response);
        return stage === 'response'
          ? new Promise<Response>((resolve) => { release = () => resolve(ready()); })
          : Promise.resolve(ready());
      }) as typeof window.fetch;
      try {
        const el = await fixture<LyraEmailViewer>(html`<lr-email-viewer src="https://example.test/message.eml"></lr-email-viewer>`);
        await waitUntil(() => release !== undefined, `the ${stage} was never requested`, { timeout: 5000 });
        let errors = 0;
        el.addEventListener('lr-render-error', () => { errors += 1; });
        el.remove();
        release!();
        await new Promise((resolve) => setTimeout(resolve, 50));
        expect(parses).to.equal(0);
        expect(errors).to.equal(0);
      } finally {
        window.fetch = original;
      }
    });
  }
});
