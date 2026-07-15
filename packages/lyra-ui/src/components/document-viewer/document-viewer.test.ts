import { aTimeout, expect, fixture, html, oneEvent } from '@open-wc/testing';
import './document-viewer.js';
import { clearDocumentRenderers, registerDocumentRenderer } from './registry.js';
import type { LyraDocumentViewer } from './document-viewer.js';
import type { DialogCloseReason } from '../dialog/dialog.class.js';

afterEach(() => {
  clearDocumentRenderers();
});

describe('defaults', () => {
  it('defaults to closed with optional file properties unset', async () => {
    const el = (await fixture(html`<lyra-document-viewer></lyra-document-viewer>`)) as LyraDocumentViewer;
    expect(el.open).to.be.false;
    expect(el.name).to.equal('');
    expect(el.mimeType).to.equal('');
    expect(el.src).to.equal('');
  });
});

describe('registry dispatch', () => {
  it('renders the matched renderer output when a MIME type is registered', async () => {
    registerDocumentRenderer('application/pdf', { render: (file) => html`<p id="matched">${file.name}</p>` });
    const el = (await fixture(html`
      <lyra-document-viewer open name="report.pdf" mime-type="application/pdf" src="https://example.test/report.pdf"></lyra-document-viewer>
    `)) as LyraDocumentViewer;
    await el.updateComplete;
    const matched = el.shadowRoot!.querySelector('[part="body"] #matched');
    expect(matched).to.exist;
    expect(matched!.textContent).to.equal('report.pdf');
  });

  it('falls back to lyra-document-preview when no renderer matches', async () => {
    const el = (await fixture(html`
      <lyra-document-viewer open name="report.pdf" mime-type="application/pdf" src="https://example.test/report.pdf"></lyra-document-viewer>
    `)) as LyraDocumentViewer;
    await el.updateComplete;
    const preview = el.shadowRoot!.querySelector('[part="body"] lyra-document-preview');
    expect(preview).to.exist;
    expect(preview!.getAttribute('filename')).to.equal('report.pdf');
  });

  it('resolves a lazy renderer and renders its output', async () => {
    registerDocumentRenderer('application/pdf', {
      load: () => Promise.resolve({ render: (file) => html`<p id="lazy">${file.name}</p>` }),
    });
    const el = (await fixture(html`
      <lyra-document-viewer open name="report.pdf" mime-type="application/pdf" src="https://example.test/report.pdf"></lyra-document-viewer>
    `)) as LyraDocumentViewer;
    await aTimeout(20);
    await el.updateComplete;
    const lazy = el.shadowRoot!.querySelector('[part="body"] #lazy');
    expect(lazy).to.exist;
    expect(lazy!.textContent).to.equal('report.pdf');
  });

  it('re-dispatches when MIME type changes to another registered format', async () => {
    registerDocumentRenderer('application/pdf', { render: () => html`<p id="pdf-output"></p>` });
    registerDocumentRenderer('application/json', { render: () => html`<p id="json-output"></p>` });
    const el = (await fixture(html`
      <lyra-document-viewer open name="f" mime-type="application/pdf" src="https://example.test/f"></lyra-document-viewer>
    `)) as LyraDocumentViewer;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('#pdf-output')).to.exist;
    el.mimeType = 'application/json';
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('#json-output')).to.exist;
    expect(el.shadowRoot!.querySelector('#pdf-output')).to.not.exist;
  });

  it('renders an alert when a matched definition has no render function', async () => {
    registerDocumentRenderer('application/pdf', { matches: () => true });
    const el = (await fixture(html`
      <lyra-document-viewer open name="f" mime-type="application/pdf" src="https://example.test/f"></lyra-document-viewer>
    `)) as LyraDocumentViewer;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="body"] [role="alert"]')).to.exist;
  });

  it('supports a per-instance registry override', async () => {
    const customRegistry = new Map();
    customRegistry.set('application/pdf', { render: () => html`<p id="custom-registry-output"></p>` });
    const el = (await fixture(html`<lyra-document-viewer open></lyra-document-viewer>`)) as LyraDocumentViewer;
    el.registry = customRegistry;
    el.name = 'f';
    el.mimeType = 'application/pdf';
    el.src = 'https://example.test/f';
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('#custom-registry-output')).to.exist;
  });
});

describe('dialog wiring', () => {
  it('forwards name as the nested dialog heading', async () => {
    const el = (await fixture(html`
      <lyra-document-viewer open name="report.pdf"></lyra-document-viewer>
    `)) as LyraDocumentViewer;
    await el.updateComplete;
    const dialog = el.shadowRoot!.querySelector('lyra-dialog')!;
    expect(dialog.getAttribute('heading')).to.equal('report.pdf');
  });

  it('closes and fires lyra-close when the nested dialog closes', async () => {
    const el = (await fixture(html`<lyra-document-viewer open name="f"></lyra-document-viewer>`)) as LyraDocumentViewer;
    const dialog = el.shadowRoot!.querySelector('lyra-dialog')!;
    const eventPromise = oneEvent(el, 'lyra-close');
    dialog.dispatchEvent(
      new CustomEvent<DialogCloseReason>('lyra-dialog-close', {
        detail: 'escape',
        bubbles: true,
        composed: true,
      }),
    );
    const event = await eventPromise;
    expect(event.detail).to.equal('escape');
    expect(el.open).to.be.false;
  });
});

describe('accessibility', () => {
  it('is accessible when open with fallback content', async () => {
    const el = await fixture(html`
      <lyra-document-viewer open name="report.pdf" mime-type="application/pdf" src="https://example.test/report.pdf"></lyra-document-viewer>
    `);
    await expect(el).to.be.accessible();
  });
});

describe('localization', () => {
  it('localizes the nested dialog label via strings', async () => {
    const el = (await fixture(html`
      <lyra-document-viewer open .strings=${{ documentViewerLabel: 'Visionneuse de document' }}></lyra-document-viewer>
    `)) as LyraDocumentViewer;
    await el.updateComplete;
    const dialog = el.shadowRoot!.querySelector('lyra-dialog')!;
    expect(dialog.getAttribute('label')).to.equal('Visionneuse de document');
  });
});
