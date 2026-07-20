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
    this.dispatchEvent(new CustomEvent('lr-load', { detail: { pageCount } }));
  }

  emitPageChange(page: number): void {
    this.page = page;
    this.dispatchEvent(new CustomEvent('lr-page-change', { detail: { page } }));
  }
}

describe('lr-page-rail', () => {
  it('defaults to page-count 0, page 1, thumb-width 96', async () => {
    const el = await fixture<LyraPageRail>(html`<lr-page-rail></lr-page-rail>`);
    expect(el.pageCount).to.equal(0);
    expect(el.page).to.equal(1);
    expect(el.thumbWidth).to.equal(96);
    expect(el.highlights).to.deep.equal([]);
  });

  it('mediated mode: page-count host attribute drives the number of rows without a viewer', async () => {
    const el = await fixture<LyraPageRail>(html`<lr-page-rail page-count="5"></lr-page-rail>`);
    await waitUntil(() => el.shadowRoot!.querySelector('lr-virtual-list') !== null);
    const list = el.shadowRoot!.querySelector('lr-virtual-list') as HTMLElement & { items: unknown[] };
    expect(list.items).to.deep.equal([1, 2, 3, 4, 5]);
  });

  it('wired mode: tracks pageCount from the viewer\'s lr-load event', async () => {
    const viewer = new StubViewer();
    const el = await fixture<LyraPageRail>(html`<lr-page-rail .viewer=${viewer}></lr-page-rail>`);
    viewer.emitLoad(4);
    await el.updateComplete;
    const list = el.shadowRoot!.querySelector('lr-virtual-list') as HTMLElement & { items: unknown[] };
    expect(list.items).to.deep.equal([1, 2, 3, 4]);
  });

  it('wired mode: tracks the current page from the viewer\'s lr-page-change event', async () => {
    const viewer = new StubViewer();
    const el = await fixture<LyraPageRail>(html`<lr-page-rail .viewer=${viewer}></lr-page-rail>`);
    viewer.emitLoad(3);
    viewer.emitPageChange(2);
    await el.updateComplete;
    expect(el.page).to.equal(2);
  });

  it('wired mode: keeps tracking the viewer after a bare reconnect with no property change (e.g. a reparent)', async () => {
    const viewer = new StubViewer();
    const el = await fixture<LyraPageRail>(html`<lr-page-rail .viewer=${viewer}></lr-page-rail>`);
    viewer.emitLoad(3);
    await el.updateComplete;

    // A pure reparent: disconnectedCallback unbinds the viewer, and neither
    // `viewer` nor `for` changes, so no willUpdate pass would rebind it.
    const parent = el.parentElement!;
    el.remove();
    parent.append(el);
    await el.updateComplete;

    viewer.emitPageChange(2);
    await el.updateComplete;
    expect(el.page, 'page tracking should survive a reparent').to.equal(2);

    viewer.emitLoad(5);
    await el.updateComplete;
    const list = el.shadowRoot!.querySelector('lr-virtual-list') as HTMLElement & { items: unknown[] };
    expect(list.items, 'page-count tracking should survive a reparent').to.deep.equal([1, 2, 3, 4, 5]);
  });

  it('for= resolves a PageThumbnailSource by id in the same root', async () => {
    const viewer = document.createElement('div') as unknown as HTMLDivElement & PageThumbnailSource;
    viewer.id = 'doc-source';
    document.body.appendChild(viewer);
    try {
      const el = await fixture<LyraPageRail>(html`<lr-page-rail for="doc-source" page-count="2"></lr-page-rail>`);
      await el.updateComplete;
      expect(el.shadowRoot!.querySelector('lr-virtual-list')).to.exist;
    } finally {
      viewer.remove();
    }
  });

  it('clicking a page row emits lr-page-select and (wired mode) sets viewer.page', async () => {
    const viewer = new StubViewer();
    const el = await fixture<LyraPageRail>(html`<lr-page-rail .viewer=${viewer}></lr-page-rail>`);
    viewer.emitLoad(3);
    await el.updateComplete;
    // [part="page"] renders inside <lr-virtual-list>'s own nested shadow root, one level deeper
    // than el.shadowRoot -- a plain descendant selector from el.shadowRoot can't pierce that second
    // shadow boundary, so the wait (and the lookup below) must walk both shadow roots explicitly.
    await waitUntil(() => el.shadowRoot!.querySelector('lr-virtual-list')?.shadowRoot?.querySelector('[part="page"]') != null);
    const button = el.shadowRoot!.querySelector('lr-virtual-list')!.shadowRoot!.querySelector('[part="page"]') as HTMLElement;
    const eventPromise = oneEvent(el, 'lr-page-select');
    button.click();
    expect((await eventPromise).detail).to.deep.equal({ page: 1 });
    expect(viewer.page).to.equal(1);
  });

  it('renders heat markers for page-bearing highlights and names the button with the count', async () => {
    const highlights: LyraHighlight[] = [
      { id: 'h1', anchor: { kind: 'page', page: 2 }, tone: 'warning' },
      { id: 'h2', anchor: { kind: 'text-quote', quote: 'x', page: 2 }, tone: 'accent' },
    ];
    const el = await fixture<LyraPageRail>(html`<lr-page-rail page-count="3" .highlights=${highlights}></lr-page-rail>`);
    await waitUntil(() => el.shadowRoot!.querySelector('lr-virtual-list')?.shadowRoot?.querySelector('[part="page"]') != null);
    const list = el.shadowRoot!.querySelector('lr-virtual-list')!;
    const buttons = list.shadowRoot!.querySelectorAll('[part="page"]');
    expect(buttons[1].getAttribute('aria-label')).to.equal('Page 2, 2 highlighted passages');
    expect(buttons[0].getAttribute('aria-label')).to.equal('Page 1');
  });

  it('calls viewer.renderPageThumbnail(page, canvas, { width: thumbWidth }) as rows materialize', async () => {
    const viewer = new StubViewer();
    const el = await fixture<LyraPageRail>(html`<lr-page-rail .viewer=${viewer} thumb-width="64"></lr-page-rail>`);
    viewer.emitLoad(2);
    await el.updateComplete;
    await waitUntil(() => viewer.renderCalls.length > 0);
    expect(viewer.renderCalls[0].width).to.equal(64);
  });

  it('falls back to lr-file-icon when renderPageThumbnail() rejects, same as resolving false (regression)', async () => {
    class RejectingViewer extends StubViewer {
      renderPageThumbnail(page: number, canvas: HTMLCanvasElement, options?: { width?: number }): Promise<boolean> {
        this.renderCalls.push({ page, width: options?.width });
        return Promise.reject(new Error('decode failed'));
      }
    }
    const viewer = new RejectingViewer();
    const el = await fixture<LyraPageRail>(html`<lr-page-rail .viewer=${viewer}></lr-page-rail>`);
    viewer.emitLoad(1);
    await el.updateComplete;
    await waitUntil(() => viewer.renderCalls.length > 0);
    await waitUntil(() => {
      const list = el.shadowRoot!.querySelector('lr-virtual-list');
      return list?.shadowRoot?.querySelector('lr-file-icon') != null;
    });
    const list = el.shadowRoot!.querySelector('lr-virtual-list')!;
    expect(list.shadowRoot!.querySelector('lr-file-icon')).to.exist;
    expect(list.shadowRoot!.querySelector('canvas')).to.not.exist;
  });

  it('typing a digit jumps to that page in mediated mode', async () => {
    const el = await fixture<LyraPageRail>(html`<lr-page-rail page-count="12"></lr-page-rail>`);
    await el.updateComplete;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    base.dispatchEvent(new KeyboardEvent('keydown', { key: '7', bubbles: true, composed: true }));
    await el.updateComplete;
    expect(el.page).to.equal(7);
  });

  it('ignores a typed digit that is out of range', async () => {
    const el = await fixture<LyraPageRail>(html`<lr-page-rail page-count="5"></lr-page-rail>`);
    await el.updateComplete;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    base.dispatchEvent(new KeyboardEvent('keydown', { key: '9', bubbles: true, composed: true }));
    await el.updateComplete;
    expect(el.page).to.equal(1);
  });

  it('registers lr-virtual-list, lr-skeleton, and lr-file-icon as a side effect of importing page-rail.js (regression)', async () => {
    // Importing a composed sub-component's *.class.js module alone never calls defineElement --
    // only its real barrel (*.js) does. Rendering an un-registered dependency silently produces a
    // plain, un-upgraded HTMLElement instead of the real component.
    expect(customElements.get('lr-virtual-list')).to.exist;
    expect(customElements.get('lr-skeleton')).to.exist;
    expect(customElements.get('lr-file-icon')).to.exist;
  });

  it('falls back to the built-in English label and honors a strings override', async () => {
    const el = await fixture<LyraPageRail>(html`<lr-page-rail></lr-page-rail>`);
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal('Page thumbnails');
    el.strings = { pageRailLabel: 'Vignettes de page' };
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal('Vignettes de page');
  });

  it('is accessible in mediated mode with highlights present', async () => {
    const highlights: LyraHighlight[] = [{ id: 'h1', anchor: { kind: 'page', page: 1 } }];
    const el = await fixture<LyraPageRail>(html`<lr-page-rail page-count="3" .highlights=${highlights}></lr-page-rail>`);
    await el.updateComplete;
    await expect(el).to.be.accessible();
  });

  // -- numeric guard regressions (pageCount / page / thumbWidth) --

  it('sanitizes a negative or NaN page-count instead of a negative/NaN-length Array.from crash', async () => {
    for (const raw of ['-5', 'NaN']) {
      const el = await fixture<LyraPageRail>(html`<lr-page-rail page-count=${raw}></lr-page-rail>`);
      await waitUntil(() => el.shadowRoot!.querySelector('lr-virtual-list') !== null);
      const list = el.shadowRoot!.querySelector('lr-virtual-list') as HTMLElement & { items: unknown[] };
      expect(list.items, raw).to.deep.equal([]);
    }
  });

  it('sanitizes a negative or NaN thumb-width before it reaches renderPageThumbnail', async () => {
    const viewer = new StubViewer();
    const el = await fixture<LyraPageRail>(
      html`<lr-page-rail .viewer=${viewer} thumb-width="-40"></lr-page-rail>`,
    );
    viewer.emitLoad(1);
    await el.updateComplete;
    await waitUntil(() => viewer.renderCalls.length > 0);
    expect(viewer.renderCalls[0].width).to.equal(0);
  });

  it('clamps an out-of-range or NaN page into [1, pageCount] for the virtual-list active-id binding', async () => {
    const el = await fixture<LyraPageRail>(html`<lr-page-rail page-count="5"></lr-page-rail>`);
    await waitUntil(() => el.shadowRoot!.querySelector('lr-virtual-list') !== null);
    const list = el.shadowRoot!.querySelector('lr-virtual-list') as HTMLElement & { activeId: unknown };

    el.page = 999;
    await el.updateComplete;
    expect(list.activeId).to.equal(5);

    el.page = NaN;
    await el.updateComplete;
    expect(list.activeId).to.equal(1);

    el.page = -3;
    await el.updateComplete;
    expect(list.activeId).to.equal(1);
  });
});

describe('current-page cssprop escape hatch', () => {
  // The `[part='page']` buttons are produced by this component's `renderItem` but are rendered by
  // `<lr-virtual-list>` INTO ITS OWN shadow root, so page-rail's stylesheet cannot reach them at all
  // -- `[part='page'][aria-current='true']` is inert today, and the button falls back to the UA
  // button appearance (a separate, pre-existing data-mode gap, the same class as the one tracked for
  // thread-list/conversation-item; NOT introduced or fixed here).
  //
  // The hatch itself is therefore verified where it is observable: a real probe element rendered in
  // the very shadow root and custom-property context the page button lives in, carrying the exact
  // declaration the rule ships. That proves both arms of the `var()` chain -- an ancestor override
  // wins, and an unset consumer still resolves the original token.
  function resolveDeclaration(vlistRoot: ShadowRoot, declaration: string, property: string): string {
    const probe = document.createElement('span');
    probe.setAttribute('style', declaration);
    vlistRoot.appendChild(probe);
    const value = getComputedStyle(probe).getPropertyValue(property);
    probe.remove();
    return value;
  }
  const HATCH = 'background: var(--lr-page-rail-current-bg, var(--lr-color-brand-quiet))';

  async function currentPage(style = ''): Promise<{ el: LyraPageRail; vlistRoot: ShadowRoot }> {
    const wrapper = (await fixture(html`<div style=${style}><lr-page-rail page-count="3"></lr-page-rail></div>`)) as HTMLElement;
    const el = wrapper.querySelector('lr-page-rail') as LyraPageRail;
    await waitUntil(
      () => el.shadowRoot!.querySelector('lr-virtual-list')?.shadowRoot?.querySelector('[part="page"][aria-current="true"]') != null,
    );
    return { el, vlistRoot: el.shadowRoot!.querySelector('lr-virtual-list')!.shadowRoot! };
  }

  it('resolves the current-page background to an ancestor --lr-page-rail-current-bg', async () => {
    const { vlistRoot } = await currentPage('--lr-page-rail-current-bg: rgb(0, 51, 102)');
    expect(resolveDeclaration(vlistRoot, HATCH, 'background-color')).to.equal('rgb(0, 51, 102)');
  });

  it('resolves byte-identical to the brand-quiet token when unset', async () => {
    const { vlistRoot } = await currentPage();
    expect(resolveDeclaration(vlistRoot, HATCH, 'background-color')).to.equal(
      resolveDeclaration(vlistRoot, 'background: var(--lr-color-brand-quiet)', 'background-color'),
    );
  });

  it('is accessible in the current-page state with the prop themed', async () => {
    const { el } = await currentPage('--lr-page-rail-current-bg: rgb(0, 51, 102)');
    await expect(el).to.be.accessible();
  });
});
