import { fixture, expect, html, oneEvent, aTimeout } from '@open-wc/testing';
import './document-preview.js';
import type { LyraDocumentPreview } from './document-preview.js';

/** Stubs `window.fetch` for the duration of one test, restoring the original
 *  afterward. `@sinonjs/fake-timers` is unavailable in this test environment
 *  (see `<lyra-stream-status>`'s test file), but this needs no timers at
 *  all -- a plain function swap is enough to control a real fetch() call. */
function stubFetch(impl: (url: string) => Promise<Response>): () => void {
  const original = window.fetch;
  window.fetch = ((url: string) => impl(url)) as typeof window.fetch;
  return () => {
    window.fetch = original;
  };
}

function textResponse(body: string, ok = true, status = 200): Response {
  return {
    ok,
    status,
    statusText: ok ? 'OK' : 'Not Found',
    text: () => Promise.resolve(body),
  } as Response;
}

describe('defaults', () => {
  it('defaults to status="idle" (reflected) with every optional prop unset', async () => {
    const el = (await fixture(html`<lyra-document-preview></lyra-document-preview>`)) as LyraDocumentPreview;
    expect(el.status).to.equal('idle');
    expect(el.getAttribute('status')).to.equal('idle');
    expect(el.src).to.equal('');
    expect(el.mimeType).to.equal('');
    expect(el.filename).to.equal('');
    expect(el.progress).to.be.undefined;
    expect(el.errorMessage).to.equal('');
  });

  it('hides the header entirely when filename is unset', async () => {
    const el = (await fixture(html`<lyra-document-preview></lyra-document-preview>`)) as LyraDocumentPreview;
    const header = el.shadowRoot!.querySelector('[part="header"]') as HTMLElement;
    expect(header.hidden).to.be.true;
  });

  it('shows the header and filename text when filename is set', async () => {
    const el = (await fixture(
      html`<lyra-document-preview filename="report.txt"></lyra-document-preview>`,
    )) as LyraDocumentPreview;
    const header = el.shadowRoot!.querySelector('[part="header"]') as HTMLElement;
    expect(header.hidden).to.be.false;
    expect(el.shadowRoot!.querySelector('[part="filename"]')!.textContent).to.equal('report.txt');
  });

  it('reflects status changes onto the host attribute', async () => {
    const el = (await fixture(html`<lyra-document-preview></lyra-document-preview>`)) as LyraDocumentPreview;
    el.status = 'ready';
    await el.updateComplete;
    expect(el.getAttribute('status')).to.equal('ready');
  });
});

describe('text/* and application/json dispatch', () => {
  it('fetches src as text and renders it in a scrollable <pre>', async () => {
    const unstub = stubFetch(() => Promise.resolve(textResponse('line one\nline two')));
    try {
      const el = (await fixture(html`
        <lyra-document-preview src="https://example.test/a.txt" mime-type="text/plain"></lyra-document-preview>
      `)) as LyraDocumentPreview;
      await aTimeout(20);
      await el.updateComplete;
      const pre = el.shadowRoot!.querySelector('[part="body"] pre') as HTMLElement;
      expect(pre).to.exist;
      expect(pre.textContent).to.equal('line one\nline two');
    } finally {
      unstub();
    }
  });

  it('treats application/json the same as a text/* prefix', async () => {
    const unstub = stubFetch(() => Promise.resolve(textResponse('{"a":1}')));
    try {
      const el = (await fixture(html`
        <lyra-document-preview src="https://example.test/a.json" mime-type="application/json"></lyra-document-preview>
      `)) as LyraDocumentPreview;
      await aTimeout(20);
      await el.updateComplete;
      expect(el.shadowRoot!.querySelector('[part="body"] pre')!.textContent).to.equal('{"a":1}');
    } finally {
      unstub();
    }
  });

  it('shows the indeterminate spinner while the fetch is in flight', async () => {
    let resolveFetch: (r: Response) => void = () => {};
    const unstub = stubFetch(
      () =>
        new Promise((resolve) => {
          resolveFetch = resolve;
        }),
    );
    try {
      const el = (await fixture(html`
        <lyra-document-preview src="https://example.test/a.txt" mime-type="text/plain"></lyra-document-preview>
      `)) as LyraDocumentPreview;
      const spinner = el.shadowRoot!.querySelector('[part="spinner"]') as HTMLElement;
      expect(spinner).to.exist;
      expect(spinner.getAttribute('role')).to.equal('status');
      expect(spinner.querySelector('.sr-only')!.textContent).to.equal('Loading document…');
      resolveFetch(textResponse('done'));
      await aTimeout(20);
      await el.updateComplete;
      expect(el.shadowRoot!.querySelector('[part="body"] pre')!.textContent).to.equal('done');
    } finally {
      unstub();
    }
  });

  it('renders [part="error"] and fires lyra-render-error on a non-ok response', async () => {
    // The element mounts first (with fetch still un-stubbed/inert), then the
    // listener is registered *before* the src assignment that synchronously
    // triggers willUpdate -> fetchText() -- registering oneEvent only after
    // an already-connected-with-src fixture resolves would race the fetch's
    // own microtask chain (a stubbed fetch() can resolve in under a tick).
    const el = (await fixture(
      html`<lyra-document-preview mime-type="text/plain"></lyra-document-preview>`,
    )) as LyraDocumentPreview;
    const unstub = stubFetch(() => Promise.resolve(textResponse('', false, 404)));
    try {
      const eventPromise = oneEvent(el, 'lyra-render-error');
      el.src = 'https://example.test/missing.txt';
      const ev = await eventPromise;
      expect(ev.detail.error).to.exist;
      await el.updateComplete;
      const error = el.shadowRoot!.querySelector('[part="error"]') as HTMLElement;
      expect(error).to.exist;
      expect(error.getAttribute('role')).to.equal('alert');
      expect(error.textContent).to.contain('404');
      // A fetch failure is this component's own rendering concern, not the
      // host-owned status prop -- it stays whatever the host set it to.
      expect(el.status).to.equal('idle');
    } finally {
      unstub();
    }
  });

  it('refetches when src changes', async () => {
    const urls: string[] = [];
    const unstub = stubFetch((url) => {
      urls.push(url);
      return Promise.resolve(textResponse(`content for ${url}`));
    });
    try {
      const el = (await fixture(html`
        <lyra-document-preview src="https://example.test/a.txt" mime-type="text/plain"></lyra-document-preview>
      `)) as LyraDocumentPreview;
      await aTimeout(20);
      await el.updateComplete;
      el.src = 'https://example.test/b.txt';
      await aTimeout(20);
      await el.updateComplete;
      expect(el.shadowRoot!.querySelector('[part="body"] pre')!.textContent).to.equal(
        'content for https://example.test/b.txt',
      );
      expect(urls).to.deep.equal(['https://example.test/a.txt', 'https://example.test/b.txt']);
    } finally {
      unstub();
    }
  });

  it('skips the fetch and renders gracefully when src is absent', async () => {
    const unstub = stubFetch(() => Promise.reject(new Error('should not be called')));
    try {
      const el = (await fixture(
        html`<lyra-document-preview mime-type="text/plain"></lyra-document-preview>`,
      )) as LyraDocumentPreview;
      await aTimeout(10);
      expect(el.shadowRoot!.querySelector('[part="spinner"]')).to.not.exist;
      expect(el.shadowRoot!.querySelector('[part="body"] pre')).to.exist;
    } finally {
      unstub();
    }
  });

  it('does not fetch while status="converting", even with a text src already set', async () => {
    let called = false;
    const unstub = stubFetch(() => {
      called = true;
      return Promise.resolve(textResponse('x'));
    });
    try {
      await fixture(html`
        <lyra-document-preview
          src="https://example.test/a.txt"
          mime-type="text/plain"
          status="converting"
        ></lyra-document-preview>
      `);
      await aTimeout(20);
      expect(called).to.be.false;
    } finally {
      unstub();
    }
  });
});

describe('image/* dispatch', () => {
  it('renders a contained <img> with src and a sensible alt', async () => {
    const el = (await fixture(html`
      <lyra-document-preview
        src="https://example.test/photo.png"
        mime-type="image/png"
        filename="photo.png"
      ></lyra-document-preview>
    `)) as LyraDocumentPreview;
    const img = el.shadowRoot!.querySelector('[part="body"] img') as HTMLImageElement;
    expect(img).to.exist;
    expect(img.getAttribute('src')).to.equal('https://example.test/photo.png');
    expect(img.getAttribute('alt')).to.equal('photo.png');
  });

  it('never calls fetch for an image', async () => {
    let called = false;
    const unstub = stubFetch(() => {
      called = true;
      return Promise.resolve(textResponse('x'));
    });
    try {
      await fixture(html`
        <lyra-document-preview src="https://example.test/photo.png" mime-type="image/png"></lyra-document-preview>
      `);
      await aTimeout(20);
      expect(called).to.be.false;
    } finally {
      unstub();
    }
  });
});

describe('generic-download fallback', () => {
  it('renders a file glyph, message, and download link for an unrecognized mime-type', async () => {
    const el = (await fixture(html`
      <lyra-document-preview
        src="https://example.test/report.pdf"
        mime-type="application/pdf"
        filename="report.pdf"
      ></lyra-document-preview>
    `)) as LyraDocumentPreview;
    const link = el.shadowRoot!.querySelector('[part="download-link"]') as HTMLAnchorElement;
    expect(link).to.exist;
    expect(link.getAttribute('href')).to.equal('https://example.test/report.pdf');
    expect(link.getAttribute('download')).to.equal('report.pdf');
    expect(el.shadowRoot!.querySelector('.fallback-text')!.textContent).to.contain('report.pdf');
  });

  it('also falls back for an empty/unset mime-type', async () => {
    const el = (await fixture(
      html`<lyra-document-preview src="https://example.test/x" filename="x"></lyra-document-preview>`,
    )) as LyraDocumentPreview;
    expect(el.shadowRoot!.querySelector('[part="download-link"]')).to.exist;
  });

  it('omits the download link entirely when src is unset', async () => {
    const el = (await fixture(
      html`<lyra-document-preview mime-type="application/pdf" filename="report.pdf"></lyra-document-preview>`,
    )) as LyraDocumentPreview;
    expect(el.shadowRoot!.querySelector('[part="download-link"]')).to.not.exist;
  });

  it('fires lyra-download with { src, filename } when the link is activated', async () => {
    const el = (await fixture(html`
      <lyra-document-preview
        src="https://example.test/report.pdf"
        mime-type="application/pdf"
        filename="report.pdf"
      ></lyra-document-preview>
    `)) as LyraDocumentPreview;
    const link = el.shadowRoot!.querySelector('[part="download-link"]') as HTMLAnchorElement;
    // Prevent the actual navigation/download inside the test runner while
    // still exercising the real click -> handler -> emit path.
    link.addEventListener('click', (e) => e.preventDefault());
    setTimeout(() => link.click());
    const ev = await oneEvent(el, 'lyra-download');
    expect(ev.detail).to.deep.equal({ src: 'https://example.test/report.pdf', filename: 'report.pdf' });
    expect(ev.bubbles).to.be.true;
    expect(ev.composed).to.be.true;
  });
});

describe('unsupported slot escape hatch', () => {
  it('renders slotted content instead of the download fallback for an unsupported mime-type', async () => {
    const el = (await fixture(html`
      <lyra-document-preview src="https://example.test/report.pdf" mime-type="application/pdf">
        <div slot="unsupported" id="custom-viewer">Custom PDF viewer</div>
      </lyra-document-preview>
    `)) as LyraDocumentPreview;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="download-link"]')).to.not.exist;
    const slot = el.shadowRoot!.querySelector('slot[name="unsupported"]') as HTMLSlotElement;
    const assigned = slot.assignedElements({ flatten: true });
    expect(assigned).to.have.lengthOf(1);
    expect(assigned[0].id).to.equal('custom-viewer');
  });

  it('falls back to the download link once the unsupported slot is emptied', async () => {
    const el = (await fixture(html`
      <lyra-document-preview src="https://example.test/report.pdf" mime-type="application/pdf">
        <div slot="unsupported" id="custom-viewer">Custom PDF viewer</div>
      </lyra-document-preview>
    `)) as LyraDocumentPreview;
    await el.updateComplete;
    el.querySelector('#custom-viewer')!.remove();
    // slotchange is async relative to the mutation.
    await aTimeout(20);
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="download-link"]')).to.exist;
  });
});

describe('status="converting"', () => {
  it('shows the indeterminate spinner regardless of mime-type/src when no progress is given', async () => {
    const el = (await fixture(html`
      <lyra-document-preview
        status="converting"
        src="https://example.test/a.pdf"
        mime-type="application/pdf"
      ></lyra-document-preview>
    `)) as LyraDocumentPreview;
    const spinner = el.shadowRoot!.querySelector('[part="spinner"]') as HTMLElement;
    expect(spinner).to.exist;
    expect(spinner.getAttribute('role')).to.equal('status');
    expect(spinner.querySelector('.sr-only')!.textContent).to.equal('Converting document…');
    expect(el.shadowRoot!.querySelector('[part="download-link"]')).to.not.exist;
  });

  it('shows a determinate role="progressbar" once progress is set', async () => {
    const el = (await fixture(html`
      <lyra-document-preview status="converting" progress="42"></lyra-document-preview>
    `)) as LyraDocumentPreview;
    const spinner = el.shadowRoot!.querySelector('[part="spinner"]') as HTMLElement;
    expect(spinner.getAttribute('role')).to.equal('progressbar');
    expect(spinner.getAttribute('aria-valuenow')).to.equal('42');
    expect(spinner.getAttribute('aria-valuemin')).to.equal('0');
    expect(spinner.getAttribute('aria-valuemax')).to.equal('100');
    expect(spinner.querySelector('.spinner-text')!.textContent).to.equal('42%');
  });

  it('clamps an out-of-range progress value into [0, 100]', async () => {
    const el = (await fixture(html`
      <lyra-document-preview status="converting" progress="150"></lyra-document-preview>
    `)) as LyraDocumentPreview;
    const spinner = el.shadowRoot!.querySelector('[part="spinner"]') as HTMLElement;
    expect(spinner.getAttribute('aria-valuenow')).to.equal('100');
  });
});

describe('status="error"', () => {
  it('renders errorMessage in [part="error"] with role="alert", regardless of mime-type', async () => {
    const el = (await fixture(html`
      <lyra-document-preview
        status="error"
        error-message="Conversion failed: unsupported source encoding."
        mime-type="text/plain"
        src="https://example.test/a.txt"
      ></lyra-document-preview>
    `)) as LyraDocumentPreview;
    const error = el.shadowRoot!.querySelector('[part="error"]') as HTMLElement;
    expect(error).to.exist;
    expect(error.getAttribute('role')).to.equal('alert');
    expect(error.textContent).to.equal('Conversion failed: unsupported source encoding.');
    expect(el.shadowRoot!.querySelector('pre')).to.not.exist;
  });
});

describe('max-height', () => {
  it('sets the --lyra-document-preview-max-height custom property on [part="base"] when given', async () => {
    const el = (await fixture(
      html`<lyra-document-preview max-height="12rem"></lyra-document-preview>`,
    )) as LyraDocumentPreview;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    expect(base.style.getPropertyValue('--lyra-document-preview-max-height').trim()).to.equal('12rem');
  });
});

describe('accessibility', () => {
  it('is accessible in the default (idle, empty) state', async () => {
    const el = await fixture(html`<lyra-document-preview></lyra-document-preview>`);
    await expect(el).to.be.accessible();
  });

  it('is accessible with a populated text preview', async () => {
    const unstub = stubFetch(() => Promise.resolve(textResponse('hello world')));
    try {
      const el = (await fixture(html`
        <lyra-document-preview
          src="https://example.test/a.txt"
          mime-type="text/plain"
          filename="a.txt"
        ></lyra-document-preview>
      `)) as LyraDocumentPreview;
      await aTimeout(20);
      await el.updateComplete;
      await expect(el).to.be.accessible();
    } finally {
      unstub();
    }
  });

  it('is accessible in the converting state with progress', async () => {
    const el = await fixture(html`
      <lyra-document-preview status="converting" progress="55" filename="deck.pptx"></lyra-document-preview>
    `);
    await expect(el).to.be.accessible();
  });

  it('is accessible in the error state', async () => {
    const el = await fixture(html`
      <lyra-document-preview status="error" error-message="Conversion failed." filename="deck.pptx"></lyra-document-preview>
    `);
    await expect(el).to.be.accessible();
  });

  it('is accessible in the generic download fallback state', async () => {
    const el = await fixture(html`
      <lyra-document-preview
        src="https://example.test/report.pdf"
        mime-type="application/pdf"
        filename="report.pdf"
      ></lyra-document-preview>
    `);
    await expect(el).to.be.accessible();
  });
});
