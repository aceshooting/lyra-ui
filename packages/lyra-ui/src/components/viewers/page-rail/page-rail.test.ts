import { aTimeout, fixture, expect, html, oneEvent, waitUntil } from '@open-wc/testing';
import { LitElement, type PropertyValues } from 'lit';
import './page-rail.js';
import type { LyraPageRail, PageThumbnailSource } from './page-rail.js';
import type { LyraHighlight } from '../document-viewer/anchors.js';

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

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
      expect(el.shadowRoot!.querySelector('lr-virtual-list') !== null).to.be.true;
    } finally {
      viewer.remove();
    }
  });

  it('for= binds a late target and replaces a removed target that reuses the same id', async () => {
    const wrapper = await fixture<HTMLElement>(
      html`<div><lr-page-rail for="late-source"></lr-page-rail></div>`,
    );
    const el = wrapper.querySelector('lr-page-rail') as LyraPageRail;
    const makeViewer = (): HTMLDivElement & PageThumbnailSource => {
      const viewer = document.createElement('div') as HTMLDivElement & PageThumbnailSource;
      viewer.id = 'late-source';
      viewer.page = 1;
      viewer.renderPageThumbnail = async () => true;
      return viewer;
    };

    const first = makeViewer();
    wrapper.append(first);
    await aTimeout(0);
    first.dispatchEvent(new CustomEvent('lr-load', { detail: { pageCount: 2 } }));
    await waitUntil(() => {
      const list = el.shadowRoot!.querySelector('lr-virtual-list') as HTMLElement & { items?: unknown[] };
      return list.items?.length === 2;
    });

    first.remove();
    const second = makeViewer();
    wrapper.append(second);
    await aTimeout(0);
    second.dispatchEvent(new CustomEvent('lr-load', { detail: { pageCount: 4 } }));
    await waitUntil(() => {
      const list = el.shadowRoot!.querySelector('lr-virtual-list') as HTMLElement & { items?: unknown[] };
      return list.items?.length === 4;
    });

    first.dispatchEvent(new CustomEvent('lr-page-change', { detail: { page: 2 } }));
    second.dispatchEvent(new CustomEvent('lr-page-change', { detail: { page: 3 } }));
    await el.updateComplete;
    expect(el.page).to.equal(3);
  });

  it('clicking a page row emits lr-page-select and (wired mode) sets viewer.page', async () => {
    const viewer = new StubViewer();
    const el = await fixture<LyraPageRail>(html`<lr-page-rail .viewer=${viewer}></lr-page-rail>`);
    viewer.emitLoad(3);
    await el.updateComplete;
    // The page button renders inside <lr-virtual-list>'s own nested shadow root, one level deeper
    // than el.shadowRoot -- a plain descendant selector from el.shadowRoot can't pierce that second
    // shadow boundary, so the wait (and the lookup below) must walk both shadow roots explicitly.
    // The current row's `part` is a list (`page page-current`), so match with `~=`, not `=`.
    await waitUntil(() => el.shadowRoot!.querySelector('lr-virtual-list')?.shadowRoot?.querySelector('[part~="page"]') != null);
    const button = el.shadowRoot!.querySelector('lr-virtual-list')!.shadowRoot!.querySelector('[part~="page"]') as HTMLElement;
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
    await waitUntil(() => el.shadowRoot!.querySelector('lr-virtual-list')?.shadowRoot?.querySelector('[part~="page"]') != null);
    const list = el.shadowRoot!.querySelector('lr-virtual-list')!;
    const buttons = list.shadowRoot!.querySelectorAll('[part~="page"]');
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

  it('gives each same-count viewer reload fresh canvas ownership', async () => {
    const firstRender = deferred<void>();
    type RenderCall = { document: string; canvas: HTMLCanvasElement };
    class ReloadingViewer extends StubViewer {
      document = 'first';
      calls: RenderCall[] = [];

      override renderPageThumbnail(_page: number, canvas: HTMLCanvasElement): Promise<boolean> {
        const document = this.document;
        this.calls.push({ document, canvas });
        if (document === 'first') {
          return firstRender.promise.then(() => {
            canvas.dataset['document'] = document;
            return true;
          });
        }
        canvas.dataset['document'] = document;
        return Promise.resolve(true);
      }
    }
    const viewer = new ReloadingViewer();
    const el = await fixture<LyraPageRail>(html`<lr-page-rail .viewer=${viewer}></lr-page-rail>`);
    viewer.emitLoad(1);
    await waitUntil(() => viewer.calls.length >= 1);
    const firstCallCount = viewer.calls.length;
    const staleCanvases = viewer.calls.map((call) => call.canvas);

    viewer.document = 'second';
    viewer.emitLoad(1);
    await waitUntil(() => viewer.calls.length > firstCallCount);
    const currentCanvas = viewer.calls.at(-1)!.canvas;
    expect(staleCanvases.includes(currentCanvas)).to.be.false;
    expect(currentCanvas.dataset['document']).to.equal('second');

    firstRender.resolve();
    await aTimeout(0);
    const list = el.shadowRoot!.querySelector('lr-virtual-list')!;
    expect(list.shadowRoot!.querySelector('canvas')).to.equal(currentCanvas);
    expect(currentCanvas.dataset['document']).to.equal('second');
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
    expect(list.shadowRoot!.querySelector('lr-file-icon') !== null).to.be.true;
    expect(list.shadowRoot!.querySelector('canvas') === null).to.be.true;
  });

  it('typing a digit jumps to that page in mediated mode', async () => {
    const el = await fixture<LyraPageRail>(html`<lr-page-rail page-count="12"></lr-page-rail>`);
    await el.updateComplete;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    base.dispatchEvent(new KeyboardEvent('keydown', { key: '7', bubbles: true, composed: true }));
    await el.updateComplete;
    expect(el.page).to.equal(7);
  });

  it('typing a digit in wired mode updates the viewer and emits the normal selection event', async () => {
    const viewer = new StubViewer();
    const el = await fixture<LyraPageRail>(html`<lr-page-rail .viewer=${viewer}></lr-page-rail>`);
    viewer.emitLoad(12);
    await el.updateComplete;
    const eventPromise = oneEvent(el, 'lr-page-select');
    el.shadowRoot!.querySelector('[part="base"]')!.dispatchEvent(
      new KeyboardEvent('keydown', { key: '7', bubbles: true, composed: true }),
    );
    expect((await eventPromise).detail).to.deep.equal({ page: 7 });
    expect(viewer.page).to.equal(7);
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

  it('formats visible and accessible page numbers with the effective locale', async () => {
    const el = await fixture<LyraPageRail>(
      html`<lr-page-rail locale="ar-EG" page-count="12" page="12"></lr-page-rail>`,
    );
    await waitUntil(
      () => el.shadowRoot!.querySelector('lr-virtual-list')?.shadowRoot?.querySelectorAll('[part~="page"]').length === 12,
    );
    const listRoot = el.shadowRoot!.querySelector('lr-virtual-list')!.shadowRoot!;
    const last = listRoot.querySelectorAll('[part~="page"]')[11] as HTMLElement;
    expect(last.getAttribute('aria-label')).to.equal('Page ١٢');
    expect(last.querySelector('[part~="page-number"]')!.textContent).to.equal('١٢');
  });

  it('chains willUpdate() to super.willUpdate() so a mixin layered under LyraElement would still run', async () => {
    // No shared mixin actually overrides willUpdate() today, so the only way to prove the chain is
    // live (rather than grepping source text for the call) is to patch the base-class hook itself
    // -- the exact hook a future mixin would extend -- and confirm it actually fires.
    const hadOwn = Object.prototype.hasOwnProperty.call(LitElement.prototype, 'willUpdate');
    const original = (LitElement.prototype as unknown as { willUpdate?: (changed: PropertyValues) => void })
      .willUpdate;
    let called = false;
    (LitElement.prototype as unknown as { willUpdate: (changed: PropertyValues) => void }).willUpdate = function (
      this: LitElement,
      changed: PropertyValues,
    ) {
      called = true;
      original?.call(this, changed);
    };
    try {
      const el = (await fixture(html`<lr-page-rail></lr-page-rail>`)) as LyraPageRail;
      await el.updateComplete;
      expect(called).to.be.true;
    } finally {
      if (hadOwn) {
        (LitElement.prototype as unknown as { willUpdate: unknown }).willUpdate = original;
      } else {
        delete (LitElement.prototype as unknown as { willUpdate?: unknown }).willUpdate;
      }
    }
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

  it('caps a pathological page count before materializing virtual-list items', async () => {
    const el = await fixture<LyraPageRail>(html`<lr-page-rail page-count="1000000000"></lr-page-rail>`);
    const list = el.shadowRoot!.querySelector('lr-virtual-list') as HTMLElement & { items: unknown[] };
    expect(list.items.length).to.equal(100_000);
  });

  it('clamps thumbnail work to a narrow live allocation', async () => {
    const viewer = new StubViewer();
    const wrapper = await fixture<HTMLElement>(
      html`<div style="width: 120px"><lr-page-rail .viewer=${viewer} thumb-width="1000"></lr-page-rail></div>`,
    );
    const el = wrapper.querySelector('lr-page-rail') as LyraPageRail;
    viewer.emitLoad(1);
    await waitUntil(() => viewer.renderCalls.some((call) => (call.width ?? Infinity) <= 120));
    expect(viewer.renderCalls.at(-1)!.width).to.be.at.most(120);
    expect(el.shadowRoot!.querySelector('[part="base"]') !== null).to.be.true;
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

describe('lr-page-rail part reachability through the embedded virtual list', () => {
  // Page rows are produced by this component's `renderItem` but committed into
  // `<lr-virtual-list>`'s OWN shadow root, one boundary deeper than this component's stylesheet.
  // Every assertion below therefore reads back the *rendered* result on the real button/dot rather
  // than inspecting stylesheet text -- a declaration that never matches looks identical to one that
  // works from the source side.
  function resolveDeclaration(root: ShadowRoot, declaration: string, property: string): string {
    const probe = document.createElement('span');
    probe.setAttribute('style', declaration);
    root.appendChild(probe);
    const value = getComputedStyle(probe).getPropertyValue(property);
    probe.remove();
    return value;
  }

  async function rail(
    options: { style?: string; highlights?: LyraHighlight[]; className?: string } = {},
  ): Promise<{ el: LyraPageRail; vlistRoot: ShadowRoot }> {
    const wrapper = (await fixture(html`<div style=${options.style ?? ''}>
      <lr-page-rail
        class=${options.className ?? ''}
        page-count="3"
        .highlights=${options.highlights ?? []}
      ></lr-page-rail>
    </div>`)) as HTMLElement;
    const el = wrapper.querySelector('lr-page-rail') as LyraPageRail;
    await waitUntil(
      () => el.shadowRoot!.querySelector('lr-virtual-list')?.shadowRoot?.querySelector('[part~="page-current"]') != null,
    );
    return { el, vlistRoot: el.shadowRoot!.querySelector('lr-virtual-list')!.shadowRoot! };
  }

  it('applies the page-row layout instead of leaving raw UA button chrome', async () => {
    const { vlistRoot } = await rail();
    const button = vlistRoot.querySelector('[part~="page"]') as HTMLElement;
    const style = getComputedStyle(button);
    expect(style.display).to.equal('flex');
    expect(style.flexDirection).to.equal('column');
    expect(style.cursor).to.equal('pointer');
    expect(style.borderTopStyle).to.equal('none');

    const thumbnail = vlistRoot.querySelector('[part~="thumbnail"]') as HTMLElement;
    expect(getComputedStyle(thumbnail).display).to.equal('flex');
    expect(getComputedStyle(thumbnail).overflow).to.equal('hidden');

    const number = vlistRoot.querySelector('[part~="page-number"]') as HTMLElement;
    expect(getComputedStyle(number).color).to.equal(
      resolveDeclaration(vlistRoot, 'color: var(--lr-color-text-quiet)', 'color'),
    );
    expect(getComputedStyle(number).fontSize).to.equal(
      resolveDeclaration(vlistRoot, 'font-size: var(--lr-font-size-xs)', 'font-size'),
    );
  });

  it('tints the current page from --lr-page-rail-current-bg, defaulting to the brand-quiet token', async () => {
    const unset = await rail();
    const current = unset.vlistRoot.querySelector('[part~="page-current"]') as HTMLElement;
    expect(current.getAttribute('aria-current')).to.equal('true');
    expect(getComputedStyle(current).backgroundColor).to.equal(
      resolveDeclaration(unset.vlistRoot, 'background: var(--lr-color-brand-quiet)', 'background-color'),
    );

    const themed = await rail({ style: '--lr-page-rail-current-bg: rgb(0, 51, 102)' });
    const themedCurrent = themed.vlistRoot.querySelector('[part~="page-current"]') as HTMLElement;
    expect(getComputedStyle(themedCurrent).backgroundColor).to.equal('rgb(0, 51, 102)');
  });

  function heatHighlights(...tones: LyraHighlight['tone'][]): LyraHighlight[] {
    return tones.map((tone, i) => ({ id: `h${i}`, anchor: { kind: 'page', page: 1 } as const, tone }));
  }

  it('colors each heat dot from its tone token', async () => {
    const { vlistRoot } = await rail({ highlights: heatHighlights('danger', 'success', 'warning') });

    const cluster = vlistRoot.querySelector('[part~="heat"]') as HTMLElement;
    expect(getComputedStyle(cluster).display).to.equal('flex');

    const dot = vlistRoot.querySelector('[part~="heat-dot-danger"]') as HTMLElement;
    expect(dot.getAttribute('data-tone')).to.equal('danger');
    expect(getComputedStyle(dot).backgroundColor).to.equal(
      resolveDeclaration(vlistRoot, 'background: var(--lr-color-danger)', 'background-color'),
    );
    // The shared `heat-dot` rule still applies to the same element, since `part` is a list.
    expect(getComputedStyle(dot).borderTopLeftRadius).to.not.equal('0px');

    for (const [tone, token] of [
      ['success', '--lr-color-success'],
      ['warning', '--lr-color-warning'],
    ] as const) {
      const toned = vlistRoot.querySelector(`[part~="heat-dot-${tone}"]`) as HTMLElement;
      expect(getComputedStyle(toned).backgroundColor, tone).to.equal(
        resolveDeclaration(vlistRoot, `background: var(${token})`, 'background-color'),
      );
    }
  });

  it('neutralizes the +n overflow marker while keeping the neutral tone token', async () => {
    // Only three tones are shown, so the fourth collapses into the `+n` overflow marker.
    const { vlistRoot } = await rail({ highlights: heatHighlights('neutral', 'accent', 'accent', 'accent') });

    const neutral = vlistRoot.querySelector('[part~="heat-dot-neutral"]') as HTMLElement;
    expect(getComputedStyle(neutral).backgroundColor).to.equal(
      resolveDeclaration(vlistRoot, 'background: var(--lr-color-text-quiet)', 'background-color'),
    );

    const overflow = vlistRoot.querySelector('[part~="heat-dot-overflow"]') as HTMLElement;
    expect(overflow.textContent).to.equal('+1');
    expect(getComputedStyle(overflow).backgroundColor).to.equal('rgba(0, 0, 0, 0)');
    expect(getComputedStyle(overflow).color).to.equal(
      resolveDeclaration(vlistRoot, 'color: var(--lr-color-text-quiet)', 'color'),
    );
  });

  it('lets a consumer stylesheet reach the virtualized rows through exportparts', async () => {
    const sheet = document.createElement('style');
    sheet.textContent = `
      lr-page-rail.consumer-probe::part(page) { background: rgb(1, 2, 3); }
      lr-page-rail.consumer-probe::part(page-number) { color: rgb(4, 5, 6); }
    `;
    document.head.append(sheet);
    try {
      const { vlistRoot } = await rail({ className: 'consumer-probe' });
      const rows = vlistRoot.querySelectorAll('[part~="page"]');
      // Page 2: not the current row, so only the consumer rule and the base part rule compete.
      expect(getComputedStyle(rows[1] as HTMLElement).backgroundColor).to.equal('rgb(1, 2, 3)');
      expect(getComputedStyle(vlistRoot.querySelector('[part~="page-number"]') as HTMLElement).color).to.equal(
        'rgb(4, 5, 6)',
      );
    } finally {
      sheet.remove();
    }
  });

  it('is accessible in the current-page state with the prop themed', async () => {
    const { el, vlistRoot } = await rail({ style: '--lr-page-rail-current-bg: rgb(0, 51, 102)' });
    expect(vlistRoot.querySelectorAll('[part~="page"]')).to.have.lengthOf(3);
    await expect(el).to.be.accessible();
  });
});
