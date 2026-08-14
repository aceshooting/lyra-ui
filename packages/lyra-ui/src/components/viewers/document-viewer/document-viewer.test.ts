import { aTimeout, expect, fixture, html, oneEvent } from '@open-wc/testing';
import './document-viewer.js';
import { clearDocumentRenderers, registerDocumentRenderer, type DocumentFile } from './registry.js';
import type { LyraDocumentViewer } from './document-viewer.js';
import type { DialogCloseReason } from '../../overlays/dialog/dialog.class.js';

afterEach(() => {
  clearDocumentRenderers();
});

describe('defaults', () => {
  it('defaults to closed with optional file properties unset', async () => {
    const el = (await fixture(html`<lr-document-viewer></lr-document-viewer>`)) as LyraDocumentViewer;
    expect(el.open).to.be.false;
    expect(el.name).to.equal('');
    expect(el.mimeType).to.equal('');
    expect(el.src).to.equal('');
    expect(el.alt).to.equal(undefined);
  });
});

describe('registry dispatch', () => {
  it('renders the matched renderer output when a MIME type is registered', async () => {
    registerDocumentRenderer('application/pdf', { render: (file) => html`<p id="matched">${file.name}</p>` });
    const el = (await fixture(html`
      <lr-document-viewer open name="report.pdf" mime-type="application/pdf" src="https://example.test/report.pdf"></lr-document-viewer>
    `)) as LyraDocumentViewer;
    await el.updateComplete;
    const matched = el.shadowRoot!.querySelector('[part="body"] #matched');
    expect((matched) != null).to.equal(true);
    expect(matched!.textContent).to.equal('report.pdf');
  });

  it('falls back to lr-document-preview when no renderer matches', async () => {
    const el = (await fixture(html`
      <lr-document-viewer open name="report.pdf" mime-type="application/pdf" src="https://example.test/report.pdf"></lr-document-viewer>
    `)) as LyraDocumentViewer;
    await el.updateComplete;
    const preview = el.shadowRoot!.querySelector('[part="body"] lr-document-preview');
    expect((preview) != null).to.equal(true);
    expect(preview!.getAttribute('filename')).to.equal('report.pdf');
  });

  it('does not mount fallback or lazy renderer content while closed', async () => {
    let loads = 0;
    registerDocumentRenderer('application/pdf', {
      load: async () => {
        loads++;
        return { render: () => html`<p id="loaded"></p>` };
      },
    });
    const el = (await fixture(html`
      <lr-document-viewer name="report.pdf" mime-type="application/pdf" src="https://example.test/report.pdf"></lr-document-viewer>
    `)) as LyraDocumentViewer;
    await aTimeout(20);
    expect(loads).to.equal(0);
    expect(el.shadowRoot!.querySelectorAll('lr-document-preview, #loaded').length).to.equal(0);

    el.open = true;
    await aTimeout(20);
    await el.updateComplete;
    expect(loads).to.equal(1);
    expect(el.shadowRoot!.querySelectorAll('#loaded').length).to.equal(1);
  });

  it('resolves a lazy renderer and renders its output', async () => {
    registerDocumentRenderer('application/pdf', {
      load: () => Promise.resolve({ render: (file) => html`<p id="lazy">${file.name}</p>` }),
    });
    const el = (await fixture(html`
      <lr-document-viewer open name="report.pdf" mime-type="application/pdf" src="https://example.test/report.pdf"></lr-document-viewer>
    `)) as LyraDocumentViewer;
    await aTimeout(20);
    await el.updateComplete;
    const lazy = el.shadowRoot!.querySelector('[part="body"] #lazy');
    expect((lazy) != null).to.equal(true);
    expect(lazy!.textContent).to.equal('report.pdf');
  });

  it('re-dispatches when MIME type changes to another registered format', async () => {
    registerDocumentRenderer('application/pdf', { render: () => html`<p id="pdf-output"></p>` });
    registerDocumentRenderer('application/json', { render: () => html`<p id="json-output"></p>` });
    const el = (await fixture(html`
      <lr-document-viewer open name="f" mime-type="application/pdf" src="https://example.test/f"></lr-document-viewer>
    `)) as LyraDocumentViewer;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('#pdf-output')).to.exist;
    el.mimeType = 'application/json';
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('#json-output')).to.exist;
    expect((el.shadowRoot!.querySelector('#pdf-output')) == null).to.be.true;
  });

  it('renders ordinary visible error text without a shadow-root live region', async () => {
    registerDocumentRenderer('application/pdf', { matches: () => true });
    const el = (await fixture(html`
      <lr-document-viewer open name="f" mime-type="application/pdf" src="https://example.test/f"></lr-document-viewer>
    `)) as LyraDocumentViewer;
    await el.updateComplete;
    const body = el.shadowRoot!.querySelector('[part="body"]')!;
    expect(body.textContent).to.include('Something went wrong.');
    expect(body.querySelectorAll('[role="alert"], [role="status"], [aria-live]').length).to.equal(0);
  });

  it('supports a per-instance registry override', async () => {
    const customRegistry = new Map();
    customRegistry.set('application/pdf', { render: () => html`<p id="custom-registry-output"></p>` });
    const el = (await fixture(html`<lr-document-viewer open></lr-document-viewer>`)) as LyraDocumentViewer;
    el.registry = customRegistry;
    el.name = 'f';
    el.mimeType = 'application/pdf';
    el.src = 'https://example.test/f';
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('#custom-registry-output')).to.exist;
  });

  it('preserves unset, explicit-empty, and nonempty alt values for registered renderers', async () => {
    const observed: Array<string | undefined> = [];
    registerDocumentRenderer('image/png', {
      render: (file) => {
        observed.push(file.alt);
        return html`<span>image</span>`;
      },
    });
    const el = await fixture<LyraDocumentViewer>(
      html`<lr-document-viewer open mime-type="image/png" src="https://example.test/image.png"></lr-document-viewer>`,
    );
    await el.updateComplete;
    el.alt = '';
    await el.updateComplete;
    el.alt = 'Diagram';
    await el.updateComplete;
    expect(observed).to.deep.equal([undefined, '', 'Diagram']);
  });

  it('marks the lazy-renderer body busy while keeping its visible loading text non-live', async () => {
    registerDocumentRenderer('application/pdf', {
      load: () => new Promise(() => {}),
    });
    const el = await fixture<LyraDocumentViewer>(
      html`<lr-document-viewer open mime-type="application/pdf" src="https://example.test/report.pdf"></lr-document-viewer>`,
    );
    await el.updateComplete;
    const body = el.shadowRoot!.querySelector('[part="body"]')!;
    expect(body.getAttribute('aria-busy')).to.equal('true');
    expect(body.textContent).to.include('Loading document…');
    expect(body.querySelectorAll('[role="status"], [role="alert"], [aria-live]').length).to.equal(0);
  });

  for (const [hook, definition] of [
    ['matcher', {
      matches: () => { throw new Error('consumer matcher failed'); },
      render: () => html`<p>unreachable</p>`,
    }],
    ['renderer', {
      matches: () => true,
      render: () => { throw new Error('consumer renderer failed'); },
    }],
  ] as const) {
    it(`localizes a thrown consumer ${hook} and completes its anchor exactly once`, async () => {
      const registry = new Map([['consumer-hook', definition]]);
      const el = await fixture<LyraDocumentViewer>(html`
        <lr-document-viewer
          name="report.custom"
          mime-type="application/x-custom"
          src="https://example.test/report.custom"
          .registry=${registry}
          .anchor=${{ kind: 'page', page: 1 }}
          .strings=${{ documentPreviewGenericError: 'Localized display failure.' }}
        ></lr-document-viewer>
      `);
      const results: boolean[] = [];
      el.addEventListener('lr-anchor-result', (event) => {
        results.push((event as CustomEvent<{ found: boolean }>).detail.found);
      });

      el.open = true;
      await el.updateComplete;
      await aTimeout(30);

      expect(el.shadowRoot!.querySelector('[part="body"]')?.textContent)
        .to.include('Localized display failure.');
      expect(results).to.deep.equal([false]);
    });
  }
});

describe('dialog wiring', () => {
  it('forwards name as the nested dialog heading', async () => {
    const el = (await fixture(html`
      <lr-document-viewer open name="report.pdf"></lr-document-viewer>
    `)) as LyraDocumentViewer;
    await el.updateComplete;
    const dialog = el.shadowRoot!.querySelector('lr-dialog')!;
    expect(dialog.getAttribute('heading')).to.equal('report.pdf');
  });

  it('closes and fires lr-close when the nested dialog closes', async () => {
    const el = (await fixture(html`<lr-document-viewer open name="f"></lr-document-viewer>`)) as LyraDocumentViewer;
    const dialog = el.shadowRoot!.querySelector('lr-dialog')!;
    const eventPromise = oneEvent(el, 'lr-close');
    dialog.dispatchEvent(
      new CustomEvent<DialogCloseReason>('lr-dialog-close', {
        detail: 'escape',
        bubbles: true,
        composed: true,
      }),
    );
    const event = await eventPromise;
    expect(event.detail).to.equal('escape');
    expect(el.open).to.be.false;
  });

  it('consumes the raw child close event when emitting the translated wrapper event', async () => {
    const wrapper = await fixture(html`<div><lr-document-viewer open name="f"></lr-document-viewer></div>`);
    const el = wrapper.querySelector('lr-document-viewer') as LyraDocumentViewer;
    const dialog = el.shadowRoot!.querySelector('lr-dialog')!;
    let rawClose = 0;
    let wrapperClose = 0;
    wrapper.addEventListener('lr-dialog-close', () => rawClose++);
    wrapper.addEventListener('lr-close', () => wrapperClose++);
    dialog.dispatchEvent(new CustomEvent('lr-dialog-close', { detail: 'escape', bubbles: true, composed: true }));
    expect(rawClose).to.equal(0);
    expect(wrapperClose).to.equal(1);
  });

  it('does not close the viewer when a registered renderer closes its own descendant dialog', async () => {
    registerDocumentRenderer('application/x-dialog-renderer', {
      render: () => html`<lr-dialog id="renderer-dialog" open></lr-dialog>`,
    });
    const wrapper = await fixture(html`
      <div>
        <lr-document-viewer
          open
          name="nested-dialog"
          mime-type="application/x-dialog-renderer"
          src="https://example.test/nested"
        ></lr-document-viewer>
      </div>
    `);
    const el = wrapper.querySelector('lr-document-viewer') as LyraDocumentViewer;
    await el.updateComplete;
    const rendererDialog = el.shadowRoot!.querySelector('#renderer-dialog') as HTMLElement;
    let rawCloses = 0;
    let wrapperCloses = 0;
    wrapper.addEventListener('lr-dialog-close', () => rawCloses++);
    wrapper.addEventListener('lr-close', () => wrapperCloses++);

    rendererDialog.dispatchEvent(
      new CustomEvent<DialogCloseReason>('lr-dialog-close', {
        detail: 'close-button',
        bubbles: true,
        composed: true,
      }),
    );

    expect(el.open).to.equal(true);
    expect(rawCloses).to.equal(1);
    expect(wrapperCloses).to.equal(0);
  });

  it('renders a download action and emits lr-download for safe sources', async () => {
    const el = (await fixture(html`
      <lr-document-viewer open name="report.pdf" mime-type="application/pdf" src="https://example.test/report.pdf"></lr-document-viewer>
    `)) as LyraDocumentViewer;
    const link = el.shadowRoot!.querySelector('[part="download-link"]') as HTMLAnchorElement;
    expect((link) != null).to.equal(true);
    expect(link.href).to.equal('https://example.test/report.pdf');
    expect(link.download).to.equal('report.pdf');

    link.addEventListener('click', (event) => event.preventDefault(), { once: true });
    const eventPromise = oneEvent(el, 'lr-download');
    link.click();
    const event = await eventPromise;
    expect(event.detail).to.deep.equal({ src: 'https://example.test/report.pdf', filename: 'report.pdf' });
  });

  it('omits the download action for an unsafe source', async () => {
    const el = (await fixture(html`
      <lr-document-viewer open name="dangerous.html" src="javascript:alert(1)"></lr-document-viewer>
    `)) as LyraDocumentViewer;
    expect((el.shadowRoot!.querySelector('[part="download-link"]')) == null).to.be.true;
  });

  // `mailto:` is safe to *navigate* to but names no retrievable bytes, so pairing it with this
  // anchor's `download` attribute is meaningless -- the affordance degrades to absent rather than
  // rendering a download link that cannot download anything.
  it('omits the download action for a mailto: source', async () => {
    const el = (await fixture(html`
      <lr-document-viewer open name="contact" src="mailto:hello@example.com"></lr-document-viewer>
    `)) as LyraDocumentViewer;
    // Count, not the node itself: a failing `to.not.exist` on a DOM node hangs the whole file
    // while chai tries to serialize it as `actual`.
    expect(el.shadowRoot!.querySelectorAll('[part="download-link"]').length).to.equal(0);
  });
});

describe('accessibility', () => {
  it('is accessible when open with fallback content', async () => {
    const el = await fixture(html`
      <lr-document-viewer open name="report.pdf" mime-type="application/pdf" src="https://example.test/report.pdf"></lr-document-viewer>
    `);
    await expect(el).to.be.accessible();
  });
});

describe('localization', () => {
  it('localizes the nested dialog label via strings', async () => {
    const el = (await fixture(html`
      <lr-document-viewer open .strings=${{ documentViewerLabel: 'Visionneuse de document' }}></lr-document-viewer>
    `)) as LyraDocumentViewer;
    await el.updateComplete;
    const dialog = el.shadowRoot!.querySelector('lr-dialog')!;
    expect(dialog.getAttribute('label')).to.equal('Visionneuse de document');
  });
});

describe('accessible name override', () => {
  it('lets a host aria-label win over the localized dialog label', async () => {
    const el = (await fixture(html`
      <lr-document-viewer open name="report.pdf" aria-label="Custom label"></lr-document-viewer>
    `)) as LyraDocumentViewer;
    await el.updateComplete;
    const dialog = el.shadowRoot!.querySelector('lr-dialog')!;
    await (dialog as unknown as { updateComplete: Promise<unknown> }).updateComplete;
    const panel = dialog.shadowRoot!.querySelector('[part~="panel"]')!;
    expect(panel.getAttribute('aria-label')).to.equal('Custom label');
  });

  it('preserves an explicitly empty host aria-label ahead of the localized dialog label', async () => {
    const el = (await fixture(html`
      <lr-document-viewer open name="report.pdf" aria-label=""></lr-document-viewer>
    `)) as LyraDocumentViewer;
    await el.updateComplete;
    const dialog = el.shadowRoot!.querySelector('lr-dialog')!;
    await (dialog as unknown as { updateComplete: Promise<unknown> }).updateComplete;
    const panel = dialog.shadowRoot!.querySelector('[part~="panel"]')!;
    expect(panel.hasAttribute('aria-label')).to.be.true;
    expect(panel.getAttribute('aria-label')).to.equal('');
  });
});

describe('anchor/highlights/alt widening', () => {
  afterEach(() => {
    clearDocumentRenderers();
  });

  it('forwards anchor/highlights/alt to the resolved renderer\'s render(file)', async () => {
    let capturedFile: DocumentFile | undefined;
    registerDocumentRenderer('application/pdf', {
      capabilities: { anchors: ['page'] },
      render: (file) => {
        capturedFile = file;
        return html`<div>stub</div>`;
      },
    });
    const highlight = { id: 'cite-1', anchor: { kind: 'page' as const, page: 3 } };
    const el = await fixture(html`
      <lr-document-viewer
        open
        name="report.pdf"
        mime-type="application/pdf"
        src="https://example.test/report.pdf"
        .highlights=${[highlight]}
        alt="Annual report"
      ></lr-document-viewer>
    `);
    await el.updateComplete;
    expect(capturedFile?.highlights).to.deep.equal([highlight]);
    expect(capturedFile?.alt).to.equal('Annual report');
  });

  it('forwards alt and highlights to the built-in fallback preview', async () => {
    const highlight = {
      id: 'cite-1',
      label: 'Chart',
      anchor: { kind: 'region' as const, rect: { x: 10, y: 20, width: 30, height: 40 } },
    };
    const el = (await fixture(html`
      <lr-document-viewer
        open
        name="chart.png"
        mime-type="image/png"
        src="data:image/png;base64,iVBORw0KGgo="
        alt="Quarterly chart"
        .highlights=${[highlight]}
      ></lr-document-viewer>
    `)) as LyraDocumentViewer;
    const preview = el.shadowRoot!.querySelector('lr-document-preview') as HTMLElement & {
      alt?: string;
      highlights: unknown[];
    };
    expect(preview.alt).to.equal('Quarterly chart');
    expect(preview.highlights).to.deep.equal([highlight]);
  });

  it('lets the fallback preview resolve a matching region anchor', async () => {
    const highlight = {
      id: 'cite-1',
      anchor: { kind: 'region' as const, rect: { x: 10, y: 20, width: 30, height: 40 } },
    };
    const el = (await fixture(html`
      <lr-document-viewer
        open
        name="chart.png"
        mime-type="image/png"
        src="data:image/png;base64,iVBORw0KGgo="
        .highlights=${[highlight]}
      ></lr-document-viewer>
    `)) as LyraDocumentViewer;
    const resultPromise = oneEvent(el, 'lr-anchor-result');
    el.anchor = 'cite-1';
    expect((await resultPromise).detail).to.deep.equal({ found: true });
  });

  it('leaves the shell as the only download-action owner for generic fallback content', async () => {
    const el = (await fixture(html`
      <lr-document-viewer
        open
        name="archive.bin"
        mime-type="application/octet-stream"
        src="https://example.test/archive.bin"
      ></lr-document-viewer>
    `)) as LyraDocumentViewer;
    const preview = el.shadowRoot!.querySelector('lr-document-preview')!;
    expect(el.shadowRoot!.querySelectorAll('[part="download-link"]').length).to.equal(1);
    expect(preview.shadowRoot!.querySelectorAll('[part="download-link"]').length).to.equal(0);
  });

  it('re-resolves (re-renders with a fresh file) when anchor/highlights/alt change without a fresh load', async () => {
    let renderCount = 0;
    let lastFile: DocumentFile | undefined;
    registerDocumentRenderer('application/pdf', {
      capabilities: { anchors: ['page'] },
      render: (file) => {
        renderCount++;
        lastFile = file;
        return html`<div>stub</div>`;
      },
    });
    const el = (await fixture(html`
      <lr-document-viewer open name="report.pdf" mime-type="application/pdf" src="https://example.test/report.pdf"></lr-document-viewer>
    `)) as HTMLElement & { highlights: unknown[] };
    await el.updateComplete;
    const countAfterOpen = renderCount;
    el.highlights = [{ id: 'cite-1', anchor: { kind: 'page', page: 1 } }];
    await el.updateComplete;
    expect(renderCount).to.be.greaterThan(countAfterOpen);
    expect(lastFile?.highlights).to.deep.equal([{ id: 'cite-1', anchor: { kind: 'page', page: 1 } }]);
  });

  it('emits lr-anchor-result { found: false } when the resolved renderer declares no capabilities', async () => {
    registerDocumentRenderer('application/pdf', { render: () => html`<div>stub</div>` });
    const el = await fixture(html`<lr-document-viewer open name="report.pdf" mime-type="application/pdf" src="https://example.test/report.pdf"></lr-document-viewer>`);
    const eventPromise = oneEvent(el, 'lr-anchor-result');
    (el as unknown as { anchor: unknown }).anchor = { kind: 'page', page: 1 };
    expect((await eventPromise).detail).to.deep.equal({ found: false });
  });

  it('emits lr-anchor-result { found: false } when the anchor kind is unsupported by the renderer\'s capabilities', async () => {
    registerDocumentRenderer('application/pdf', { capabilities: { anchors: ['page'] }, render: () => html`<div>stub</div>` });
    const el = await fixture(html`<lr-document-viewer open name="report.pdf" mime-type="application/pdf" src="https://example.test/report.pdf"></lr-document-viewer>`);
    const eventPromise = oneEvent(el, 'lr-anchor-result');
    (el as unknown as { anchor: unknown }).anchor = { kind: 'fragment', id: 'sec-1' };
    expect((await eventPromise).detail).to.deep.equal({ found: false });
  });

  it('emits lr-anchor-result { found: false } when the file falls back to document-preview', async () => {
    const el = await fixture(html`<lr-document-viewer open name="unknown.bin" mime-type="application/octet-stream" src="https://example.test/unknown.bin"></lr-document-viewer>`);
    const eventPromise = oneEvent(el, 'lr-anchor-result');
    (el as unknown as { anchor: unknown }).anchor = { kind: 'page', page: 1 };
    expect((await eventPromise).detail).to.deep.equal({ found: false });
  });

  it('does not self-emit lr-anchor-result when the resolved renderer is capable of the anchor kind', async () => {
    registerDocumentRenderer('application/pdf', { capabilities: { anchors: ['page'] }, render: () => html`<div>stub</div>` });
    const el = await fixture(html`<lr-document-viewer open name="report.pdf" mime-type="application/pdf" src="https://example.test/report.pdf"></lr-document-viewer>`);
    let fired = false;
    el.addEventListener('lr-anchor-result', () => {
      fired = true;
    });
    (el as unknown as { anchor: unknown }).anchor = { kind: 'page', page: 1 };
    await el.updateComplete;
    await new Promise((resolve) => setTimeout(resolve, 20));
    // A capable renderer's own DocumentAnchorTarget mixin is responsible for this event, not the
    // shell (this stub renderer isn't a real adopting element, so nothing should fire at all).
    expect(fired).to.be.false;
  });

  it('re-assigning anchor on an already-open viewer re-fires lr-anchor-result', async () => {
    registerDocumentRenderer('application/pdf', { render: () => html`<div>stub</div>` });
    const el = await fixture(html`<lr-document-viewer open name="report.pdf" mime-type="application/pdf" src="https://example.test/report.pdf"></lr-document-viewer>`);
    (el as unknown as { anchor: unknown }).anchor = { kind: 'page', page: 1 };
    await oneEvent(el, 'lr-anchor-result');
    const secondPromise = oneEvent(el, 'lr-anchor-result');
    (el as unknown as { anchor: unknown }).anchor = { kind: 'page', page: 2 };
    await secondPromise;
  });

  it('existing <lr-document-viewer name= mime-type= src=> usage renders identically with anchor/highlights/alt unset', async () => {
    registerDocumentRenderer('application/pdf', { render: (file) => html`<div>${file.name}</div>` });
    const el = await fixture(html`<lr-document-viewer open name="report.pdf" mime-type="application/pdf" src="https://example.test/report.pdf"></lr-document-viewer>`);
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="body"]')!.textContent).to.contain('report.pdf');
    let fired = false;
    el.addEventListener('lr-anchor-result', () => {
      fired = true;
    });
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(fired).to.be.false; // no anchor was ever set, so the event contract remains inactive
  });
});
