import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import './docx-viewer.js';
import type { LyraDocxViewer } from './docx-viewer.js';
import { findDocumentRenderer } from '../document-viewer/registry.js';
import { MINIMAL_DOCX_BASE64 } from './fixtures/minimal-docx-fixture.js';

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes.buffer;
}

function stubFetch(buffer: ArrayBuffer, ok = true): () => void {
  const original = window.fetch;
  window.fetch = (() => Promise.resolve({ ok, status: ok ? 200 : 500, statusText: ok ? 'OK' : 'Server Error', arrayBuffer: () => Promise.resolve(buffer) } as Response)) as typeof window.fetch;
  return () => { window.fetch = original; };
}

function useLibrary(el: LyraDocxViewer, deps: unknown): void {
  (el as unknown as { loadLibrary: () => Promise<unknown> }).loadLibrary = () => Promise.resolve(deps);
}

const BUFFER = base64ToArrayBuffer(MINIMAL_DOCX_BASE64);

describe('lyra-docx-viewer', () => {
  it('renders an empty localized state by default', async () => {
    const el = await fixture<LyraDocxViewer>(html`<lyra-docx-viewer></lyra-docx-viewer>`);
    expect(el.shadowRoot!.querySelector('.empty-note')!.textContent).to.equal('No document to display.');
  });

  it('converts and sanitizes DOCX HTML', async () => {
    const el = await fixture<LyraDocxViewer>(html`<lyra-docx-viewer></lyra-docx-viewer>`);
    useLibrary(el, {
      mammoth: { convertToHtml: () => Promise.resolve({ value: '<h1>Report</h1><script>bad()</script>', messages: [] }) },
      DOMPurify: { sanitize: (value: string) => value.replace('<script>bad()</script>', '') },
    });
    const restore = stubFetch(BUFFER);
    try {
      el.src = 'https://example.test/report.docx';
      await waitUntil(() => el.shadowRoot!.querySelector('[part="content"]') !== null);
      expect(el.shadowRoot!.querySelector('[part="content"]')!.textContent!.trim()).to.equal('Report');
      expect(el.shadowRoot!.querySelector('script')).to.not.exist;
    } finally {
      restore();
    }
  });

  it('shows a converter error when mammoth is unavailable', async () => {
    const el = await fixture<LyraDocxViewer>(html`<lyra-docx-viewer></lyra-docx-viewer>`);
    useLibrary(el, { mammoth: undefined, DOMPurify: { sanitize: (value: string) => value } });
    const restore = stubFetch(BUFFER);
    try {
      el.src = 'https://example.test/report.docx';
      await waitUntil(() => el.shadowRoot!.querySelector('[part="error"]') !== null);
      expect(el.shadowRoot!.querySelector('[part="error"]')!.textContent).to.equal(
        'This viewer needs the optional "mammoth" package installed to convert this document.',
      );
    } finally {
      restore();
    }
  });

  it('blocks rendering when DOMPurify is unavailable', async () => {
    const el = await fixture<LyraDocxViewer>(html`<lyra-docx-viewer></lyra-docx-viewer>`);
    useLibrary(el, { mammoth: { convertToHtml: () => Promise.resolve({ value: '<h1>Unsafe</h1>', messages: [] }) }, DOMPurify: undefined });
    const restore = stubFetch(BUFFER);
    try {
      el.src = 'https://example.test/report.docx';
      await waitUntil(() => el.shadowRoot!.querySelector('[part="error"]') !== null);
      expect(el.shadowRoot!.querySelector('[part="error"]')!.textContent).to.equal(
        'This viewer needs the optional "dompurify" package installed to render safely.',
      );
      expect(el.shadowRoot!.querySelector('[part="content"]')).to.not.exist;
    } finally {
      restore();
    }
  });

  it('emits non-fatal Mammoth messages after rendering', async () => {
    const el = await fixture<LyraDocxViewer>(html`<lyra-docx-viewer></lyra-docx-viewer>`);
    useLibrary(el, {
      mammoth: { convertToHtml: () => Promise.resolve({ value: '<p>Ready</p>', messages: [{ type: 'warning', message: 'style' }] }) },
      DOMPurify: { sanitize: (value: string) => value },
    });
    const restore = stubFetch(BUFFER);
    try {
      const event = new Promise<CustomEvent<{ error: unknown }>>((resolve) => el.addEventListener('lyra-render-error', resolve, { once: true }));
      el.src = 'https://example.test/report.docx';
      await waitUntil(() => el.shadowRoot!.querySelector('[part="content"]') !== null);
      expect((await event).detail.error).to.be.an('array');
    } finally {
      restore();
    }
  });

  it('rejects unsafe URLs without fetching', async () => {
    const el = await fixture<LyraDocxViewer>(html`<lyra-docx-viewer></lyra-docx-viewer>`);
    let called = false;
    const original = window.fetch;
    window.fetch = (() => { called = true; return Promise.reject(new Error('unexpected')); }) as typeof window.fetch;
    try {
      el.src = 'java\tscript:alert(1)';
      await waitUntil(() => el.shadowRoot!.querySelector('[part="error"]') !== null);
      expect(called).to.be.false;
      expect(el.shadowRoot!.querySelector('[part="error"]')!.textContent).to.equal('Document URL is not allowed.');
    } finally {
      window.fetch = original;
    }
  });

  it('applies max-height to the base custom property', async () => {
    const el = await fixture<LyraDocxViewer>(html`<lyra-docx-viewer max-height="32rem"></lyra-docx-viewer>`);
    expect((el.shadowRoot!.querySelector('[part="base"]') as HTMLElement).style.getPropertyValue('--lyra-docx-viewer-max-height')).to.equal('32rem');
  });

  it('is accessible in the empty state', async () => {
    const el = await fixture<LyraDocxViewer>(html`<lyra-docx-viewer></lyra-docx-viewer>`);
    await expect(el).to.be.accessible();
  });

  it('uses the localized document name', async () => {
    const el = await fixture<LyraDocxViewer>(html`<lyra-docx-viewer .strings=${{ docxViewerLabel: 'Word file' }}></lyra-docx-viewer>`);
    useLibrary(el, { mammoth: { convertToHtml: () => Promise.resolve({ value: '<p>Text</p>', messages: [] }) }, DOMPurify: { sanitize: (value: string) => value } });
    const restore = stubFetch(BUFFER);
    try {
      el.src = 'https://example.test/report.docx';
      await waitUntil(() => el.shadowRoot!.querySelector('[part="content"]') !== null);
      expect(el.shadowRoot!.querySelector('[part="content"]')!.getAttribute('aria-label')).to.equal('Word file');
    } finally {
      restore();
    }
  });

  it('forwards a host aria-label to the role="document" content region, winning over the localized default', async () => {
    const el = await fixture<LyraDocxViewer>(html`<lyra-docx-viewer aria-label="Q3 report"></lyra-docx-viewer>`);
    useLibrary(el, { mammoth: { convertToHtml: () => Promise.resolve({ value: '<p>Text</p>', messages: [] }) }, DOMPurify: { sanitize: (value: string) => value } });
    const restore = stubFetch(BUFFER);
    try {
      el.src = 'https://example.test/report.docx';
      await waitUntil(() => el.shadowRoot!.querySelector('[part="content"]') !== null);
      expect(el.shadowRoot!.querySelector('[part="content"]')!.getAttribute('aria-label')).to.equal('Q3 report');
    } finally {
      restore();
    }
  });

  it('prefers the name property over a host aria-label, which in turn wins over the localized default', async () => {
    const el = await fixture<LyraDocxViewer>(html`<lyra-docx-viewer name="Named report" aria-label="Q3 report"></lyra-docx-viewer>`);
    useLibrary(el, { mammoth: { convertToHtml: () => Promise.resolve({ value: '<p>Text</p>', messages: [] }) }, DOMPurify: { sanitize: (value: string) => value } });
    const restore = stubFetch(BUFFER);
    try {
      el.src = 'https://example.test/report.docx';
      await waitUntil(() => el.shadowRoot!.querySelector('[part="content"]') !== null);
      expect(el.shadowRoot!.querySelector('[part="content"]')!.getAttribute('aria-label')).to.equal('Named report');
    } finally {
      restore();
    }
  });
});

describe('DOCX registry', () => {
  it('registers the OOXML DOCX MIME type and extension fallback', () => {
    expect(findDocumentRenderer({ name: 'report.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', src: 'x' })).to.exist;
    expect(findDocumentRenderer({ name: 'report.docx', mimeType: 'application/octet-stream', src: 'x' })).to.exist;
    expect(findDocumentRenderer({ name: 'report.pdf', mimeType: 'application/pdf', src: 'x' })).to.not.exist;
  });
});
