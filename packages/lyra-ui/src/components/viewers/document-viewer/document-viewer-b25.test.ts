import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import './document-viewer.js';
import { createDocumentRendererRegistry, type LyraDocumentRendererDefinition } from './registry.js';
import type { LyraDocumentViewer } from './document-viewer.js';

describe('lr-document-viewer remediation', () => {
  it('forwards activeHighlightId to the fallback preview', async () => {
    const el = await fixture<LyraDocumentViewer>(html`
      <lr-document-viewer open name="a.bin" mime-type="application/x-none" active-highlight-id="h1" .registry=${createDocumentRendererRegistry([])}></lr-document-viewer>
    `);
    await waitUntil(() => el.shadowRoot!.querySelector('lr-document-preview') !== null, 'no fallback preview');
    const preview = el.shadowRoot!.querySelector('lr-document-preview') as unknown as { activeHighlightId: string | null };
    expect(preview.activeHighlightId).to.equal('h1');
  });

  it('keeps a rendered renderer when the viewer is moved within the same task', async () => {
    let renders = 0;
    const definition = {
      render: () => {
        renders += 1;
        return html`<p data-custom>Custom</p>`;
      },
    } as LyraDocumentRendererDefinition;
    const registry = createDocumentRendererRegistry([['application/x-move', definition]]);
    const host = await fixture<HTMLDivElement>(html`<div><div id="a"></div><div id="b"></div></div>`);
    const el = document.createElement('lr-document-viewer');
    el.open = true;
    el.mimeType = 'application/x-move';
    el.name = 'moved';
    el.registry = registry;
    host.querySelector('#a')!.append(el);
    await waitUntil(() => el.shadowRoot!.querySelector('[data-custom]') !== null);
    const before = renders;
    host.querySelector('#b')!.append(el);
    await el.updateComplete;
    await Promise.resolve();
    expect(el.shadowRoot!.querySelector('[data-custom]') !== null).to.equal(true);
    expect(renders).to.equal(before);
  });

  it('makes an overflowing body keyboard scrollable', async () => {
    const registry = createDocumentRendererRegistry([
      ['application/x-tall', { render: () => html`<div data-tall style="block-size: 2000px; flex: none">tall</div>` } as LyraDocumentRendererDefinition],
    ]);
    const el = await fixture<LyraDocumentViewer>(html`
      <lr-document-viewer open name="Tall.doc" mime-type="application/x-tall" .registry=${registry}></lr-document-viewer>
    `);
    const body = el.shadowRoot!.querySelector<HTMLElement>('[part="body"]')!;
    await waitUntil(() => body.getAttribute('tabindex') === '0', 'overflowing body never became focusable');
    expect(body.getAttribute('role')).to.equal('region');
    expect(body.getAttribute('aria-label')).to.equal('Tall.doc');
  });
});
