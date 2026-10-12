import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { expectValidAriaRules } from '../../../../test/aria-rules.js';
import './pdf-viewer.js';
import type { LyraPdfViewer } from './pdf-viewer.js';

it('keeps loaded toolbar zoom text accessible without a generic-span label', async () => {
  const viewer = await fixture<LyraPdfViewer>(html`<lr-pdf-viewer
    .strings=${{ pdfViewerCurrentZoom: 'Scale {percent} percent' }}
  ></lr-pdf-viewer>`);
  const page = {
    getViewport: ({ scale }: { scale: number }) => ({ width: 200 * scale, height: 300 * scale, scale }),
    render: () => ({ promise: Promise.resolve(), cancel() {} }),
    getTextContent: () => Promise.resolve({ items: [] }),
  };
  (viewer as unknown as { loadLibrary: () => Promise<unknown> }).loadLibrary = async () => ({
    getDocument: () => ({ promise: Promise.resolve({ numPages: 1, getPage: async () => page }) }),
  });
  const url = URL.createObjectURL(new Blob(['%PDF-test'], { type: 'application/pdf' }));
  try {
    viewer.src = url;
    await waitUntil(() => viewer.shadowRoot!.querySelector('[part="toolbar"]') !== null);
    await viewer.updateComplete;
    const zoom = viewer.shadowRoot!.querySelector<HTMLElement>('[part="zoom-indicator"]')!;
    expect(zoom.textContent).to.equal('Scale 100 percent');
    await expectValidAriaRules(viewer, ['aria-prohibited-attr']);
    expect(zoom.hasAttribute('aria-label')).to.equal(false);
    viewer.zoom = 1.25;
    await viewer.updateComplete;
    expect(zoom.textContent).to.equal('Scale 125 percent');
    expect(zoom.hasAttribute('role')).to.equal(false);
  } finally {
    viewer.remove();
    URL.revokeObjectURL(url);
  }
});
