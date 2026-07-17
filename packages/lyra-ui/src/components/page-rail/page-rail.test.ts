import { fixture, expect, html, oneEvent, waitUntil } from '@open-wc/testing';
import './page-rail.js';
import type { LyraPageRail, PageThumbnailSource } from './page-rail.js';
import type { LyraHighlight } from '../document-viewer/anchors.js';

class StubViewer extends EventTarget implements PageThumbnailSource {
  page = 1;
  renderCalls: { page: number; width?: number }[] = [];
  renderResult = true;

  renderPageThumbnail(page: number, _canvas: HTMLCanvasElement, options?: { width?: number }): Promise<boolean> {
    this.renderCalls.push({ page, width: options?.width });
    return Promise.resolve(this.renderResult);
  }

  emitLoad(pageCount: number): void {
    this.dispatchEvent(new CustomEvent('lyra-load', { detail: { pageCount } }));
  }

  emitPageChange(page: number): void {
    this.page = page;
    this.dispatchEvent(new CustomEvent('lyra-page-change', { detail: { page } }));
  }
}

describe('lyra-page-rail', () => {
  it('defaults to page-count 0, page 1, thumb-width 96', async () => {
    const el = await fixture<LyraPageRail>(html`<lyra-page-rail></lyra-page-rail>`);
    expect(el.pageCount).to.equal(0);
    expect(el.page).to.equal(1);
    expect(el.thumbWidth).to.equal(96);
    expect(el.highlights).to.deep.equal([]);
  });

  it('mediated mode: page-count host attribute drives the number of rows without a viewer', async () => {
    const el = await fixture<LyraPageRail>(html`<lyra-page-rail page-count="5"></lyra-page-rail>`);
    await waitUntil(() => el.shadowRoot!.querySelector('lyra-virtual-list') !== null);
    const list = el.shadowRoot!.querySelector('lyra-virtual-list') as HTMLElement & { items: unknown[] };
    expect(list.items).to.deep.equal([1, 2, 3, 4, 5]);
  });

  it('wired mode: tracks pageCount from the viewer\'s lyra-load event', async () => {
    const viewer = new StubViewer();
    const el = await fixture<LyraPageRail>(html`<lyra-page-rail .viewer=${viewer}></lyra-page-rail>`);
    viewer.emitLoad(4);
    await el.updateComplete;
    const list = el.shadowRoot!.querySelector('lyra-virtual-list') as HTMLElement & { items: unknown[] };
    expect(list.items).to.deep.equal([1, 2, 3, 4]);
  });

  it('wired mode: tracks the current page from the viewer\'s lyra-page-change event', async () => {
    const viewer = new StubViewer();
    const el = await fixture<LyraPageRail>(html`<lyra-page-rail .viewer=${viewer}></lyra-page-rail>`);
    viewer.emitLoad(3);
    viewer.emitPageChange(2);
    await el.updateComplete;
    expect(el.page).to.equal(2);
  });

  it('for= resolves a PageThumbnailSource by id in the same root', async () => {
    const viewer = document.createElement('div') as unknown as HTMLDivElement & PageThumbnailSource;
    viewer.id = 'doc-source';
    document.body.appendChild(viewer);
    try {
      const el = await fixture<LyraPageRail>(html`<lyra-page-rail for="doc-source" page-count="2"></lyra-page-rail>`);
      await el.updateComplete;
      expect(el.shadowRoot!.querySelector('lyra-virtual-list')).to.exist;
    } finally {
      viewer.remove();
    }
  });

  it('clicking a page row emits lyra-page-select and (wired mode) sets viewer.page', async () => {
    const viewer = new StubViewer();
    const el = await fixture<LyraPageRail>(html`<lyra-page-rail .viewer=${viewer}></lyra-page-rail>`);
    viewer.emitLoad(3);
    await el.updateComplete;
    // [part="page"] renders inside <lyra-virtual-list>'s own nested shadow root, one level deeper
    // than el.shadowRoot -- a plain descendant selector from el.shadowRoot can't pierce that second
    // shadow boundary, so the wait (and the lookup below) must walk both shadow roots explicitly.
    await waitUntil(() => el.shadowRoot!.querySelector('lyra-virtual-list')?.shadowRoot?.querySelector('[part="page"]') != null);
    const button = el.shadowRoot!.querySelector('lyra-virtual-list')!.shadowRoot!.querySelector('[part="page"]') as HTMLElement;
    const eventPromise = oneEvent(el, 'lyra-page-select');
    button.click();
    expect((await eventPromise).detail).to.deep.equal({ page: 1 });
    expect(viewer.page).to.equal(1);
  });

  it('renders heat markers for page-bearing highlights and names the button with the count', async () => {
    const highlights: LyraHighlight[] = [
      { id: 'h1', anchor: { kind: 'page', page: 2 }, tone: 'warning' },
      { id: 'h2', anchor: { kind: 'text-quote', quote: 'x', page: 2 }, tone: 'accent' },
    ];
    const el = await fixture<LyraPageRail>(html`<lyra-page-rail page-count="3" .highlights=${highlights}></lyra-page-rail>`);
    await waitUntil(() => el.shadowRoot!.querySelector('lyra-virtual-list')?.shadowRoot?.querySelector('[part="page"]') != null);
    const list = el.shadowRoot!.querySelector('lyra-virtual-list')!;
    const buttons = list.shadowRoot!.querySelectorAll('[part="page"]');
    expect(buttons[1].getAttribute('aria-label')).to.equal('Page 2, 2 highlighted passages');
    expect(buttons[0].getAttribute('aria-label')).to.equal('Page 1');
  });

  it('calls viewer.renderPageThumbnail(page, canvas, { width: thumbWidth }) as rows materialize', async () => {
    const viewer = new StubViewer();
    const el = await fixture<LyraPageRail>(html`<lyra-page-rail .viewer=${viewer} thumb-width="64"></lyra-page-rail>`);
    viewer.emitLoad(2);
    await el.updateComplete;
    await waitUntil(() => viewer.renderCalls.length > 0);
    expect(viewer.renderCalls[0].width).to.equal(64);
  });

  it('typing a digit jumps to that page in mediated mode', async () => {
    const el = await fixture<LyraPageRail>(html`<lyra-page-rail page-count="12"></lyra-page-rail>`);
    await el.updateComplete;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    base.dispatchEvent(new KeyboardEvent('keydown', { key: '7', bubbles: true, composed: true }));
    await el.updateComplete;
    expect(el.page).to.equal(7);
  });

  it('ignores a typed digit that is out of range', async () => {
    const el = await fixture<LyraPageRail>(html`<lyra-page-rail page-count="5"></lyra-page-rail>`);
    await el.updateComplete;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    base.dispatchEvent(new KeyboardEvent('keydown', { key: '9', bubbles: true, composed: true }));
    await el.updateComplete;
    expect(el.page).to.equal(1);
  });

  it('registers lyra-virtual-list, lyra-skeleton, and lyra-file-icon as a side effect of importing page-rail.js (regression)', async () => {
    // Importing a composed sub-component's *.class.js module alone never calls defineElement --
    // only its real barrel (*.js) does. Rendering an un-registered dependency silently produces a
    // plain, un-upgraded HTMLElement instead of the real component.
    expect(customElements.get('lyra-virtual-list')).to.exist;
    expect(customElements.get('lyra-skeleton')).to.exist;
    expect(customElements.get('lyra-file-icon')).to.exist;
  });

  it('falls back to the built-in English label and honors a strings override', async () => {
    const el = await fixture<LyraPageRail>(html`<lyra-page-rail></lyra-page-rail>`);
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal('Page thumbnails');
    el.strings = { pageRailLabel: 'Vignettes de page' };
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal('Vignettes de page');
  });

  it('is accessible in mediated mode with highlights present', async () => {
    const highlights: LyraHighlight[] = [{ id: 'h1', anchor: { kind: 'page', page: 1 } }];
    const el = await fixture<LyraPageRail>(html`<lyra-page-rail page-count="3" .highlights=${highlights}></lyra-page-rail>`);
    await el.updateComplete;
    await expect(el).to.be.accessible();
  });
});
