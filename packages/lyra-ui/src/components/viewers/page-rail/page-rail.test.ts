import { aTimeout, fixture, expect, html, oneEvent, waitUntil } from '@open-wc/testing';
import { LitElement, type PropertyValues } from 'lit';
import './page-rail.js';
import type {
  LyraPageRail,
  LyraPageViewerSnapshot,
  PageThumbnailSource,
} from './page-rail.js';
import type { LyraVirtualList } from '../../layout/virtual-list/virtual-list.js';
import type { LyraHighlight, LyraHighlightTone } from '../document-viewer/anchors.js';

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

class SnapshotViewer extends StubViewer {
  pageViewerSnapshot: LyraPageViewerSnapshot = Object.freeze({
    identity: 0,
    status: 'idle',
    page: 1,
    pageCount: 0,
  });

  transition(snapshot: LyraPageViewerSnapshot): void {
    this.pageViewerSnapshot = Object.freeze({ ...snapshot });
    this.page = snapshot.page;
    this.dispatchEvent(new CustomEvent('lr-page-viewer-state-change', {
      detail: { snapshot: this.pageViewerSnapshot },
    }));
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
    const list = el.shadowRoot!.querySelector('lr-virtual-list') as HTMLElement & {
      items: unknown[];
      source: { count: number; itemAt(index: number): number };
    };
    expect(list.items).to.deep.equal([]);
    expect(list.source.count).to.equal(5);
    expect(Array.from({ length: list.source.count }, (_unused, index) => list.source.itemAt(index)))
      .to.deep.equal([1, 2, 3, 4, 5]);
  });

  it('hydrates wired state immediately from a snapshot even when binding after load', async () => {
    const viewer = new SnapshotViewer();
    viewer.transition({ identity: 7, status: 'ready', page: 3, pageCount: 8 });
    const el = await fixture<LyraPageRail>(html`<lr-page-rail .viewer=${viewer}></lr-page-rail>`);
    const list = el.shadowRoot!.querySelector('lr-virtual-list') as HTMLElement & {
      source: { count: number };
    };
    expect(list.source.count).to.equal(8);
    expect(el.page).to.equal(3);
  });

  it('atomically clears stale rows while the same wired viewer starts a replacement load', async () => {
    const viewer = new SnapshotViewer();
    viewer.transition({ identity: 1, status: 'ready', page: 2, pageCount: 8 });
    const el = await fixture<LyraPageRail>(html`<lr-page-rail .viewer=${viewer}></lr-page-rail>`);
    viewer.transition({ identity: 2, status: 'loading', page: 1, pageCount: 0 });
    await el.updateComplete;
    const list = el.shadowRoot!.querySelector('lr-virtual-list') as HTMLElement & {
      source: { count: number };
    };
    expect(list.source.count).to.equal(0);
    expect(el.page).to.equal(1);
  });

  it('does not expose the internal virtual-list range event', async () => {
    const el = await fixture<LyraPageRail>(html`<lr-page-rail page-count="2"></lr-page-rail>`);
    const list = el.shadowRoot!.querySelector('lr-virtual-list')!;
    let leaked = 0;
    el.addEventListener('lr-visible-range-changed', () => leaked++);
    list.dispatchEvent(new CustomEvent(
      'lr-visible-range-changed',
      { detail: { start: 0, end: 1 }, bubbles: true, composed: true },
    ));
    expect(leaked).to.equal(0);
  });

  it('does not expose the internal virtual-list scroll event', async () => {
    const el = await fixture<LyraPageRail>(html`<lr-page-rail page-count="2"></lr-page-rail>`);
    const list = el.shadowRoot!.querySelector('lr-virtual-list')!;
    let leaked = 0;
    el.addEventListener('lr-virtual-scroll', () => leaked++);
    list.dispatchEvent(new CustomEvent(
      'lr-virtual-scroll',
      { detail: { scrollTop: 0, viewportHeight: 100 }, bubbles: true, composed: true },
    ));
    expect(leaked).to.equal(0);
  });

  it('does not expose the internal virtual-list load-more event', async () => {
    const el = await fixture<LyraPageRail>(html`<lr-page-rail page-count="2"></lr-page-rail>`);
    const list = el.shadowRoot!.querySelector('lr-virtual-list')!;
    let leaked = 0;
    el.addEventListener('lr-load-more', () => leaked++);
    list.dispatchEvent(new CustomEvent(
      'lr-load-more',
      { bubbles: true, composed: true },
    ));
    expect(leaked).to.equal(0);
  });

  it('wired mode: tracks pageCount from the viewer\'s lr-load event', async () => {
    const viewer = new StubViewer();
    const el = await fixture<LyraPageRail>(html`<lr-page-rail .viewer=${viewer}></lr-page-rail>`);
    viewer.emitLoad(4);
    await el.updateComplete;
    const list = el.shadowRoot!.querySelector('lr-virtual-list') as HTMLElement & { source: { count: number } };
    expect(list.source.count).to.equal(4);
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
    const list = el.shadowRoot!.querySelector('lr-virtual-list') as HTMLElement & { source: { count: number } };
    expect(list.source.count, 'page-count tracking should survive a reparent').to.equal(5);
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
      const list = el.shadowRoot!.querySelector('lr-virtual-list') as HTMLElement & { source?: { count: number } };
      return list.source?.count === 2;
    });

    first.remove();
    const second = makeViewer();
    wrapper.append(second);
    await aTimeout(0);
    second.dispatchEvent(new CustomEvent('lr-load', { detail: { pageCount: 4 } }));
    await waitUntil(() => {
      const list = el.shadowRoot!.querySelector('lr-virtual-list') as HTMLElement & { source?: { count: number } };
      return list.source?.count === 4;
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

  it('supports renderer-owned DOM thumbnails and disposes their handles when rows are invalidated', async () => {
    class DomThumbnailViewer extends EventTarget implements PageThumbnailSource {
      page = 1;
      renders = 0;
      disposals = 0;
      async renderPageThumbnailToContainer(
        page: number,
        container: HTMLElement,
        options?: { width?: number },
      ) {
        this.renders++;
        const preview = document.createElement('div');
        preview.dataset['preview'] = `${page}:${options?.width}`;
        container.append(preview);
        return { dispose: () => { this.disposals++; preview.remove(); } };
      }
      emitLoad(pageCount: number): void {
        this.dispatchEvent(new CustomEvent('lr-load', { detail: { pageCount } }));
      }
    }
    const viewer = new DomThumbnailViewer();
    const el = await fixture<LyraPageRail>(html`<lr-page-rail .viewer=${viewer} thumb-width="72"></lr-page-rail>`);
    viewer.emitLoad(1);
    await waitUntil(() => viewer.renders > 0);
    const list = el.shadowRoot!.querySelector('lr-virtual-list')!;
    await waitUntil(() => list.shadowRoot!.querySelector('[data-preview="1:72"]') != null);
    expect(list.shadowRoot!.querySelector('canvas') === null).to.equal(true);

    viewer.emitLoad(1);
    await waitUntil(() => viewer.disposals > 0 && viewer.renders > 1);
    expect(viewer.disposals).to.be.greaterThan(0);
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
    expect(list.shadowRoot!.querySelector('canvas') === currentCanvas).to.be.true;
    expect(currentCanvas.dataset['document']).to.equal('second');
  });

  it('uses snapshot identity to give a same-count replacement fresh canvas ownership', async () => {
    const viewer = new SnapshotViewer();
    const el = await fixture<LyraPageRail>(html`<lr-page-rail .viewer=${viewer}></lr-page-rail>`);
    viewer.transition({ identity: 1, status: 'ready', page: 1, pageCount: 1 });
    await waitUntil(() => viewer.renderCalls.length > 0);
    const firstCanvas = el.shadowRoot!.querySelector('lr-virtual-list')!.shadowRoot!.querySelector('canvas');

    viewer.transition({ identity: 2, status: 'ready', page: 1, pageCount: 1 });
    await waitUntil(() => viewer.renderCalls.length > 1);
    const replacementCanvas = el.shadowRoot!.querySelector('lr-virtual-list')!.shadowRoot!.querySelector('canvas');
    expect(replacementCanvas === firstCanvas).to.equal(false);
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

  it('does not combine digits typed before and after a disconnect', async () => {
    const el = await fixture<LyraPageRail>(html`<lr-page-rail page-count="20"></lr-page-rail>`);
    const parent = el.parentElement!;
    let base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    base.dispatchEvent(new KeyboardEvent('keydown', { key: '1', bubbles: true, composed: true }));
    el.remove();
    parent.append(el);
    await el.updateComplete;

    base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    base.dispatchEvent(new KeyboardEvent('keydown', { key: '2', bubbles: true, composed: true }));
    await el.updateComplete;
    expect(el.page).to.equal(2);
  });

  it('resets the digit buffer once the real digit-buffer timeout elapses', async () => {
    const el = await fixture<LyraPageRail>(html`<lr-page-rail page-count="20"></lr-page-rail>`);
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    base.dispatchEvent(new KeyboardEvent('keydown', { key: '1', bubbles: true, composed: true }));
    await el.updateComplete;
    expect(el.page).to.equal(1);

    // DIGIT_BUFFER_MS is 500 -- give the real timer a comfortable margin before typing again, so a
    // buffer that failed to reset would combine into '12' (out of range) rather than plain '2'.
    await aTimeout(650);

    base.dispatchEvent(new KeyboardEvent('keydown', { key: '2', bubbles: true, composed: true }));
    await el.updateComplete;
    expect(el.page, 'the earlier digit should not still be buffered after the real timeout fired').to.equal(2);
  });

  it('resets the digit buffer immediately (no timer) when the owner document has no window', async () => {
    const el = await fixture<LyraPageRail>(html`<lr-page-rail page-count="20"></lr-page-rail>`);
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;

    Object.defineProperty(el, 'ownerDocument', {
      configurable: true,
      get: () => ({ defaultView: null }),
    });
    try {
      base.dispatchEvent(new KeyboardEvent('keydown', { key: '5', bubbles: true, composed: true }));
    } finally {
      delete (el as unknown as { ownerDocument?: unknown }).ownerDocument;
    }
    await el.updateComplete;
    expect(el.page).to.equal(5);

    // A follow-up digit proves the buffer was actually cleared (not just left to time out): if it
    // had survived, this would combine into '52' (out of range for 20 pages) and page would stay 5.
    base.dispatchEvent(new KeyboardEvent('keydown', { key: '2', bubbles: true, composed: true }));
    await el.updateComplete;
    expect(el.page, 'the digit buffer should already be empty, not still holding "5"').to.equal(2);
  });

  it('constructs observers and schedules and clears digit timing in the adopted owner realm', async () => {
    const el = await fixture<LyraPageRail>(html`<lr-page-rail></lr-page-rail>`);
    el.remove();
    const frame = await fixture<HTMLIFrameElement>(html`<iframe></iframe>`);
    const frameDocument = frame.contentDocument;
    const frameWindow = frame.contentWindow;
    if (!frameDocument || !frameWindow) {
      frame.remove();
      throw new Error('The iframe realm was unavailable.');
    }
    const originalResizeObserver = frameWindow.ResizeObserver;
    const originalMutationObserver = frameWindow.MutationObserver;
    const originalSetTimeout = frameWindow.setTimeout;
    const originalClearTimeout = frameWindow.clearTimeout;
    const mutationTargets: Node[] = [];
    const scheduled: number[] = [];
    const cleared: number[] = [];
    const resizeRecords: Array<{ targets: Element[]; disconnects: number }> = [];
    let mutationDisconnects = 0;

    class RealmResizeObserver {
      private readonly record = { targets: [] as Element[], disconnects: 0 };
      constructor(_callback: ResizeObserverCallback) { resizeRecords.push(this.record); }
      observe(target: Element): void { this.record.targets.push(target); }
      unobserve(): void {}
      disconnect(): void { this.record.disconnects += 1; }
    }
    class RealmMutationObserver {
      constructor(_callback: MutationCallback) {}
      observe(target: Node): void { mutationTargets.push(target); }
      takeRecords(): MutationRecord[] { return []; }
      disconnect(): void { mutationDisconnects += 1; }
    }
    frameWindow.ResizeObserver = RealmResizeObserver as unknown as typeof ResizeObserver;
    frameWindow.MutationObserver = RealmMutationObserver as unknown as typeof MutationObserver;

    try {
      frameDocument.adoptNode(el);
      el.for = 'missing-viewer';
      frameDocument.body.append(el);
      await el.updateComplete;

      const pageRailResizeRecords = resizeRecords.filter((record) => record.targets.includes(el));
      expect(pageRailResizeRecords.length).to.equal(1);
      const pageRailResizeRecord = pageRailResizeRecords[0]!;
      expect(mutationTargets.includes(frameDocument)).to.be.true;

      // Install the timer spies only after the component tree is mounted. Descendants may own
      // unrelated timers; this assertion is specifically about the synchronous digit-buffer path.
      frameWindow.setTimeout = ((_handler: TimerHandler) => {
        scheduled.push(81);
        return 81;
      }) as typeof frameWindow.setTimeout;
      frameWindow.clearTimeout = ((handle?: number) => {
        if (handle !== undefined) cleared.push(handle);
      }) as typeof frameWindow.clearTimeout;
      el.shadowRoot!.querySelector('[part="base"]')!.dispatchEvent(
        new frameWindow.KeyboardEvent('keydown', {
          key: '1',
          bubbles: true,
          composed: true,
        }),
      );
      expect(scheduled).to.deep.equal([81]);

      document.adoptNode(el);
      expect(cleared).to.deep.equal([81]);
      expect(pageRailResizeRecord.disconnects).to.be.greaterThan(0);
      expect(mutationDisconnects).to.be.greaterThan(0);
    } finally {
      el.remove();
      frameWindow.ResizeObserver = originalResizeObserver;
      frameWindow.MutationObserver = originalMutationObserver;
      frameWindow.setTimeout = originalSetTimeout;
      frameWindow.clearTimeout = originalClearTimeout;
      frame.remove();
    }
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

  it('moves focus to the nearest surviving page when the focused tail is removed', async () => {
    const el = await fixture<LyraPageRail>(html`<lr-page-rail page-count="5"></lr-page-rail>`);
    await waitUntil(
      () => el.shadowRoot!.querySelector('lr-virtual-list')?.shadowRoot?.querySelectorAll('[part~="page"]').length === 5,
    );
    const list = el.shadowRoot!.querySelector('lr-virtual-list')!;
    const fifth = list.shadowRoot!.querySelectorAll<HTMLButtonElement>('[part~="page"]')[4]!;
    fifth.focus();
    el.pageCount = 3;
    await waitUntil(() => list.shadowRoot!.querySelectorAll('[part~="page"]').length === 3);
    const focused = list.shadowRoot!.activeElement as HTMLButtonElement | null;
    expect(focused?.getAttribute('aria-label')).to.equal('Page 3');
  });

  it('recognizes an iframe-realm focused row when deciding whether to repair focus', async () => {
    const el = await fixture<LyraPageRail>(html`<lr-page-rail></lr-page-rail>`);
    const frame = await fixture<HTMLIFrameElement>(html`<iframe></iframe>`);
    const frameDocument = frame.contentDocument;
    const frameWindow = frame.contentWindow;
    if (!frameDocument || !frameWindow) {
      frame.remove();
      throw new Error('The iframe realm was unavailable.');
    }
    const list = el.shadowRoot!.querySelector('lr-virtual-list') as LyraVirtualList;
    const foreignButton = frameDocument.createElement('button');
    const foreignRow = frameDocument.createElement('div');
    foreignRow.dataset['rowIndex'] = '99';
    foreignRow.append(foreignButton);
    expect(foreignButton instanceof window.HTMLElement).to.be.false;
    const activeElementDescriptor = Object.getOwnPropertyDescriptor(list.shadowRoot!, 'activeElement');
    Object.defineProperty(list.shadowRoot!, 'activeElement', {
      configurable: true,
      get: () => foreignButton,
    });

    try {
      // Avoid materializing child custom elements in a second document: constructed stylesheets
      // cannot be shared across documents. Invoke the lifecycle decision with the same property
      // state Lit would present, then inspect its scalar pending-page result.
      Object.defineProperty(el, 'pageCount', { configurable: true, writable: true, value: 50 });
      const internals = el as unknown as {
        willUpdate(changed: PropertyValues): void;
        pendingFocusPage: number | null;
      };
      internals.willUpdate(new Map([['pageCount', 0]]) as PropertyValues);
      expect(internals.pendingFocusPage).to.equal(50);
    } finally {
      if (activeElementDescriptor) {
        Object.defineProperty(list.shadowRoot!, 'activeElement', activeElementDescriptor);
      } else {
        delete (list.shadowRoot! as unknown as { activeElement?: Element | null }).activeElement;
      }
      el.remove();
      frame.remove();
    }
  });

  it('schedules and cancels a pending focus-repair frame through the adopted owner window', async () => {
    const el = await fixture<LyraPageRail>(html`<lr-page-rail></lr-page-rail>`);
    el.remove();
    const frame = await fixture<HTMLIFrameElement>(html`<iframe></iframe>`);
    const frameDocument = frame.contentDocument;
    const frameWindow = frame.contentWindow;
    if (!frameDocument || !frameWindow) {
      frame.remove();
      throw new Error('The iframe realm was unavailable.');
    }
    frameDocument.adoptNode(el);
    frameDocument.body.append(el);
    await el.updateComplete;
    const originalRequestAnimationFrame = frameWindow.requestAnimationFrame;
    const originalCancelAnimationFrame = frameWindow.cancelAnimationFrame;
    const callbacks = new Map<number, FrameRequestCallback>();
    const cancelled: number[] = [];
    let nextHandle = 90;
    frameWindow.requestAnimationFrame = ((callback: FrameRequestCallback) => {
      const handle = ++nextHandle;
      callbacks.set(handle, callback);
      return handle;
    }) as typeof frameWindow.requestAnimationFrame;
    frameWindow.cancelAnimationFrame = ((handle: number) => {
      cancelled.push(handle);
      callbacks.delete(handle);
    }) as typeof frameWindow.cancelAnimationFrame;

    const internals = el as unknown as { waitForOwnerAnimationFrame(): Promise<boolean> };
    try {
      const frameWait = internals.waitForOwnerAnimationFrame();
      await waitUntil(() => callbacks.size > 0, 'focus repair never reached the owner frame queue');
      document.adoptNode(el);
      expect(await frameWait).to.be.false;
      expect(cancelled.length).to.be.greaterThan(0);
      expect(callbacks.size).to.equal(0);
    } finally {
      el.remove();
      frameWindow.requestAnimationFrame = originalRequestAnimationFrame;
      frameWindow.cancelAnimationFrame = originalCancelAnimationFrame;
      frame.remove();
    }
  });

  it('repairs focus by absolute page after a virtualized tail is removed', async () => {
    const el = await fixture<LyraPageRail>(html`<lr-page-rail page-count="100"></lr-page-rail>`);
    const list = el.shadowRoot!.querySelector('lr-virtual-list') as LyraVirtualList;
    await waitUntil(() => list.renderedRows.length > 0);

    list.scrollToIndex(90, { align: 'start', behavior: 'auto' });
    list.scrollContainer!.dispatchEvent(new Event('scroll'));
    await waitUntil(
      () => Number(list.renderedRows[0]?.dataset.rowIndex) > 50,
      'virtual list never materialized a high page window',
    );
    const focusedRow = list.renderedRows.at(-1)!;
    const focusedPage = Number(focusedRow.dataset.rowIndex) + 1;
    expect(focusedPage).to.be.greaterThan(50);
    focusedRow.querySelector<HTMLButtonElement>('[part~="page"]')!.focus();

    el.pageCount = 50;
    await waitUntil(
      () => (list.shadowRoot!.activeElement as HTMLElement | null)?.getAttribute('aria-label') === 'Page 50',
      'focus was not repaired to absolute page 50',
    );
    expect((list.shadowRoot!.activeElement as HTMLElement | null)?.getAttribute('aria-label')).to.equal('Page 50');
  });

  it('supersedes a stale focus repair when the page count shrinks again before materialization', async () => {
    const el = await fixture<LyraPageRail>(html`<lr-page-rail page-count="100"></lr-page-rail>`);
    const list = el.shadowRoot!.querySelector('lr-virtual-list') as LyraVirtualList;
    await waitUntil(() => list.renderedRows.length > 0);
    list.scrollToIndex(90, { align: 'start', behavior: 'auto' });
    list.scrollContainer!.dispatchEvent(new Event('scroll'));
    await waitUntil(
      () => Number(list.renderedRows[0]?.dataset.rowIndex) > 50,
      'virtual list never materialized a high page window',
    );
    list.renderedRows.at(-1)!.querySelector<HTMLButtonElement>('[part~="page"]')!.focus();

    const repairGate = deferred<void>();
    let updateCompleteReads = 0;
    Object.defineProperty(list, 'updateComplete', {
      configurable: true,
      get: () => {
        updateCompleteReads++;
        return repairGate.promise;
      },
    });

    el.pageCount = 50;
    await el.updateComplete;
    await waitUntil(() => updateCompleteReads > 0, 'first focus repair never reached its deferred materialization');
    await waitUntil(
      () => list.renderedRows.length > 0
        && list.renderedRows.every((row) => Number(row.dataset.rowIndex) < 50)
        && list.shadowRoot!.activeElement === null,
      'first shrink did not remove the focused high row',
    );

    el.pageCount = 40;
    await el.updateComplete;
    await waitUntil(
      () => list.renderedRows.length > 0
        && list.renderedRows.every((row) => Number(row.dataset.rowIndex) < 40),
      'second shrink did not reach the virtual list',
    );
    repairGate.resolve(undefined);

    await waitUntil(
      () => (list.shadowRoot!.activeElement as HTMLElement | null)?.getAttribute('aria-label') === 'Page 40',
      'the stale page-50 repair was not superseded by page 40',
    );
    expect((list.shadowRoot!.activeElement as HTMLElement | null)?.getAttribute('aria-label')).to.equal('Page 40');
  });

  it('clears a pending focus repair outright (not just reschedules it) when the count drops to zero before it resolves', async () => {
    const el = await fixture<LyraPageRail>(html`<lr-page-rail page-count="100"></lr-page-rail>`);
    const list = el.shadowRoot!.querySelector('lr-virtual-list') as LyraVirtualList;
    await waitUntil(() => list.renderedRows.length > 0);
    list.scrollToIndex(90, { align: 'start', behavior: 'auto' });
    list.scrollContainer!.dispatchEvent(new Event('scroll'));
    await waitUntil(
      () => Number(list.renderedRows[0]?.dataset.rowIndex) > 50,
      'virtual list never materialized a high page window',
    );
    list.renderedRows.at(-1)!.querySelector<HTMLButtonElement>('[part~="page"]')!.focus();

    // Gate the virtual list's own updateComplete so the async focusVirtualPage() dispatched by the
    // first shrink is still suspended (mid-repair) when the second, count-collapses-to-zero
    // property change below reaches willUpdate().
    const repairGate = deferred<void>();
    Object.defineProperty(list, 'updateComplete', {
      configurable: true,
      get: () => repairGate.promise,
    });

    const internals = el as unknown as {
      pendingFocusPage: number | null;
      focusRepairPending: boolean;
      focusRepairGeneration: number;
    };

    el.pageCount = 50; // schedules a repair: the focused row's index is now >= the new count
    await el.updateComplete;
    expect(internals.focusRepairPending, 'a repair should be pending after the first shrink').to.be.true;
    const generationBeforeClear = internals.focusRepairGeneration;

    el.pageCount = 0; // effectivePageCount() <= 0 -- the guard must clear the repair, not reschedule it
    await el.updateComplete;

    expect(internals.pendingFocusPage).to.equal(null);
    expect(internals.focusRepairPending).to.equal(false);
    expect(internals.focusRepairGeneration).to.be.greaterThan(generationBeforeClear);

    repairGate.resolve(undefined);
  });

  it('finishes the focus repair immediately when the virtual list has not rendered yet', async () => {
    // A freshly constructed, never-connected/never-updated element has an empty shadow root --
    // <lr-virtual-list> only exists there after the first render commits.
    const el = document.createElement('lr-page-rail') as LyraPageRail;
    const internals = el as unknown as {
      focusVirtualPage(page: number, generation: number): Promise<void>;
      focusRepairPending: boolean;
      focusRepairGeneration: number;
    };
    internals.focusRepairPending = true;
    await internals.focusVirtualPage(1, internals.focusRepairGeneration);
    expect(internals.focusRepairPending, 'the repair should finish rather than hang with no <lr-virtual-list>').to.equal(false);
  });

  it('finishes the focus repair when the repaired-to page count collapses to zero between scheduling and materialization', async () => {
    const el = await fixture<LyraPageRail>(html`<lr-page-rail page-count="0"></lr-page-rail>`);
    await el.updateComplete;
    const internals = el as unknown as {
      focusVirtualPage(page: number, generation: number): Promise<void>;
      focusRepairPending: boolean;
      focusRepairGeneration: number;
    };
    internals.focusRepairPending = true;
    await internals.focusVirtualPage(3, internals.focusRepairGeneration);
    expect(internals.focusRepairPending, 'a null repair index should still finish the repair').to.equal(false);
  });

  it('escalates to scrollToIndex() and real animation-frame retries when the repaired-to row is not yet rendered', async () => {
    const el = await fixture<LyraPageRail>(html`<lr-page-rail page-count="50"></lr-page-rail>`);
    const list = el.shadowRoot!.querySelector('lr-virtual-list') as LyraVirtualList;
    await waitUntil(() => list.renderedRows.length > 0);

    // The immediate lookup (before scrollToIndex) and the loop's first retry both report the row as
    // not-yet-rendered, so focusVirtualPage() must fall through into the scrollToIndex() + real
    // requestAnimationFrame retry loop rather than finding the button on its first check.
    let renderedRowsReads = 0;
    Object.defineProperty(list, 'renderedRows', {
      configurable: true,
      get(this: LyraVirtualList) {
        renderedRowsReads++;
        return renderedRowsReads <= 2 ? [] : [...this.renderRoot.querySelectorAll<HTMLElement>('[part="row"]')];
      },
    });
    const originalScrollToIndex = list.scrollToIndex.bind(list);
    const scrolledTo: number[] = [];
    list.scrollToIndex = (index: number, options?: { align?: 'start' | 'end' | 'auto'; behavior?: 'auto' | 'smooth' }) => {
      scrolledTo.push(index);
      originalScrollToIndex(index, options);
    };

    try {
      const internals = el as unknown as {
        focusVirtualPage(page: number, generation: number): Promise<void>;
        focusRepairGeneration: number;
      };
      await internals.focusVirtualPage(50, internals.focusRepairGeneration);

      expect(scrolledTo).to.deep.equal([49]);
      const focused = list.shadowRoot!.activeElement as HTMLElement | null;
      expect(focused?.getAttribute('aria-label')).to.equal('Page 50');
    } finally {
      delete (list as unknown as { renderedRows?: unknown }).renderedRows;
      list.scrollToIndex = originalScrollToIndex;
    }
  });

  it('exhausts its animation-frame retries and still finishes the repair when the row never renders', async () => {
    const el = await fixture<LyraPageRail>(html`<lr-page-rail page-count="50"></lr-page-rail>`);
    const list = el.shadowRoot!.querySelector('lr-virtual-list') as LyraVirtualList;
    await waitUntil(() => list.renderedRows.length > 0);

    Object.defineProperty(list, 'renderedRows', {
      configurable: true,
      get: () => [],
    });
    const originalScrollToIndex = list.scrollToIndex.bind(list);
    let scrollCalls = 0;
    list.scrollToIndex = (index: number, options?: { align?: 'start' | 'end' | 'auto'; behavior?: 'auto' | 'smooth' }) => {
      scrollCalls++;
      originalScrollToIndex(index, options);
    };

    try {
      const internals = el as unknown as {
        focusVirtualPage(page: number, generation: number): Promise<void>;
        focusRepairPending: boolean;
        focusRepairGeneration: number;
      };
      internals.focusRepairPending = true;
      await internals.focusVirtualPage(50, internals.focusRepairGeneration);
      expect(scrollCalls).to.equal(1);
      expect(internals.focusRepairPending, 'giving up should still finish the repair rather than hang forever').to.equal(false);
    } finally {
      delete (list as unknown as { renderedRows?: unknown }).renderedRows;
      list.scrollToIndex = originalScrollToIndex;
    }
  });

  it('finishes the repair when the page count collapses to zero between two retry-loop iterations', async () => {
    const el = await fixture<LyraPageRail>(html`<lr-page-rail page-count="50"></lr-page-rail>`);
    const list = el.shadowRoot!.querySelector('lr-virtual-list') as LyraVirtualList;
    await waitUntil(() => list.renderedRows.length > 0);

    // Never report the row as rendered, so focusVirtualPage() stays in its retry loop.
    Object.defineProperty(list, 'renderedRows', { configurable: true, get: () => [] });
    const originalScrollToIndex = list.scrollToIndex.bind(list);
    list.scrollToIndex = (index: number, options?: { align?: 'start' | 'end' | 'auto'; behavior?: 'auto' | 'smooth' }) =>
      originalScrollToIndex(index, options);

    // Direct invocation (see the sibling tests above) never sets focusRepairPending, so this
    // pageCount change -- unlike a real willUpdate()-scheduled repair -- does not bump
    // focusRepairGeneration; the loop's in-flight generation stays valid while effectivePageCount()
    // drops to 0 out from under it, on the loop's *own* recheck rather than before it even starts.
    let updateCompleteOwner: object | null = Object.getPrototypeOf(list) as object | null;
    let realUpdateComplete: PropertyDescriptor | undefined;
    while (updateCompleteOwner && !realUpdateComplete) {
      realUpdateComplete = Object.getOwnPropertyDescriptor(updateCompleteOwner, 'updateComplete');
      updateCompleteOwner = Object.getPrototypeOf(updateCompleteOwner) as object | null;
    }
    if (!realUpdateComplete?.get) throw new Error('updateComplete getter was not found on the prototype chain');
    let updateCompleteReads = 0;
    Object.defineProperty(list, 'updateComplete', {
      configurable: true,
      get(this: LyraVirtualList) {
        updateCompleteReads++;
        if (updateCompleteReads === 2) el.pageCount = 0;
        return (realUpdateComplete.get as (this: LyraVirtualList) => Promise<unknown>).call(this);
      },
    });

    try {
      const internals = el as unknown as {
        focusVirtualPage(page: number, generation: number): Promise<void>;
        focusRepairPending: boolean;
        focusRepairGeneration: number;
      };
      // focusRepairPending is deliberately left false (its default): setting it true beforehand
      // would make el.pageCount's own willUpdate() guard bump focusRepairGeneration itself
      // (case-1's clear/reschedule logic), invalidating this in-flight call *before* it ever
      // reaches its own recheck -- which would test the willUpdate() guard again, not this loop.
      const generationBefore = internals.focusRepairGeneration;
      await internals.focusVirtualPage(50, generationBefore);
      expect(internals.focusRepairGeneration, 'willUpdate() should not have intervened').to.equal(generationBefore);
      expect(internals.focusRepairPending, 'a null index mid-loop should still finish the repair').to.equal(false);
    } finally {
      delete (list as unknown as { renderedRows?: unknown }).renderedRows;
      delete (list as unknown as { updateComplete?: unknown }).updateComplete;
      list.scrollToIndex = originalScrollToIndex;
    }
  });

  it('registers lr-virtual-list, lr-skeleton, and lr-file-icon as a side effect of importing page-rail.js (regression)', async () => {
    // Importing a composed sub-component's *.class.js module alone never calls defineElement --
    // only its real barrel (*.js) does. Rendering an un-registered dependency silently produces a
    // plain, un-upgraded HTMLElement instead of the real component.
    expect(customElements.get('lr-virtual-list')).to.exist;
    expect(customElements.get('lr-skeleton')).to.exist;
    expect(customElements.get('lr-file-icon')).to.exist;
  });

  it('keeps loading thumbnail skeletons decorative inside the nested virtual list', async () => {
    const thumbnail = deferred<boolean>();
    const viewer = new StubViewer();
    viewer.renderPageThumbnail = () => thumbnail.promise;
    const el = await fixture<LyraPageRail>(html`<lr-page-rail .viewer=${viewer}></lr-page-rail>`);
    viewer.emitLoad(1);
    await waitUntil(
      () => el.shadowRoot!.querySelector('lr-virtual-list')?.shadowRoot?.querySelector('lr-skeleton') != null,
    );
    const listRoot = el.shadowRoot!.querySelector('lr-virtual-list')!.shadowRoot!;
    const skeleton = listRoot.querySelector('lr-skeleton') as HTMLElement & {
      updateComplete: Promise<unknown>;
    };
    await skeleton.updateComplete;
    expect(listRoot.querySelectorAll('[role="status"], [role="alert"], [aria-live]').length).to.equal(0);
    thumbnail.resolve(true);
  });

  it('falls back to the built-in English label and honors a strings override', async () => {
    const el = await fixture<LyraPageRail>(html`<lr-page-rail></lr-page-rail>`);
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal('Page thumbnails');
    el.strings = { pageRailLabel: 'Vignettes de page' };
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal('Vignettes de page');
  });

  it('does not duplicate a non-empty host name and preserves explicit-empty ownership', async () => {
    const labeled = await fixture<LyraPageRail>(
      html`<lr-page-rail label="Fallback" aria-label="Document pages"></lr-page-rail>`,
    );
    const labeledBase = labeled.shadowRoot!.querySelector('[part="base"]')!;
    expect(labeledBase.getAttribute('role')).to.be.null;
    expect(labeledBase.getAttribute('aria-label')).to.be.null;

    const decorative = await fixture<LyraPageRail>(
      html`<lr-page-rail label="Fallback" aria-label=""></lr-page-rail>`,
    );
    const decorativeBase = decorative.shadowRoot!.querySelector('[part="base"]')!;
    expect(decorativeBase.getAttribute('role')).to.equal('navigation');
    expect(decorativeBase.hasAttribute('aria-label')).to.be.true;
    expect(decorativeBase.getAttribute('aria-label')).to.equal('');
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
      const list = el.shadowRoot!.querySelector('lr-virtual-list') as HTMLElement & {
        source: { count: number };
      };
      expect(list.source.count, raw).to.equal(0);
    }
  });

  it('caps a pathological page count without materializing virtual-list items', async () => {
    const el = await fixture<LyraPageRail>(html`<lr-page-rail page-count="1000000000"></lr-page-rail>`);
    const list = el.shadowRoot!.querySelector('lr-virtual-list') as HTMLElement & {
      items: unknown[];
      source: { count: number; itemAt(index: number): number };
    };
    expect(list.items).to.deep.equal([]);
    expect(list.source.count).to.equal(100_000);
    expect(list.source.itemAt(99_999)).to.equal(100_000);
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

  it('falls back to the default allocation width when a ResizeObserver delivery has no entries, and no-ops when that matches the current width', async () => {
    class FakeResizeObserver {
      static instances: FakeResizeObserver[] = [];
      observedTargets: Element[] = [];
      constructor(public callback: ResizeObserverCallback) {
        FakeResizeObserver.instances.push(this);
      }
      observe(target: Element): void {
        this.observedTargets.push(target);
      }
      unobserve(): void {}
      disconnect(): void {}
    }
    const original = window.ResizeObserver;
    (window as unknown as { ResizeObserver: typeof ResizeObserver }).ResizeObserver =
      FakeResizeObserver as unknown as typeof ResizeObserver;
    try {
      const viewer = new StubViewer();
      const el = await fixture<LyraPageRail>(html`<lr-page-rail .viewer=${viewer}></lr-page-rail>`);
      viewer.emitLoad(1);
      await waitUntil(() => viewer.renderCalls.length > 0, 'the initial thumbnail render never happened');
      expect(viewer.renderCalls[0]!.width).to.equal(96);

      const pageRailObserver = FakeResizeObserver.instances.find((instance) => instance.observedTargets.includes(el));
      expect(pageRailObserver, 'page-rail should have registered its own ResizeObserver').to.exist;
      pageRailObserver!.callback([], pageRailObserver as unknown as ResizeObserver);
      await el.updateComplete;

      // An empty entry list falls back to the default allocation width (320px). That's unchanged
      // from the already-default allocationWidth, so no new thumbnail render should be triggered.
      expect(viewer.renderCalls.length).to.equal(1);
    } finally {
      window.ResizeObserver = original;
    }
  });

  it('invalidates and reloads thumbnails when thumbWidth changes after the first render', async () => {
    const viewer = new StubViewer();
    const el = await fixture<LyraPageRail>(html`<lr-page-rail .viewer=${viewer}></lr-page-rail>`);
    viewer.emitLoad(1);
    await waitUntil(() => viewer.renderCalls.length > 0);
    expect(viewer.renderCalls[0]!.width).to.equal(96);

    el.thumbWidth = 64;
    await el.updateComplete;
    await waitUntil(() => viewer.renderCalls.some((call) => call.width === 64), 'thumbWidth change never re-triggered a thumbnail render');
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

  it('lays the heat cluster out as a plain centered in-flow row, carrying no inert inset offset', async () => {
    const { vlistRoot } = await rail({ highlights: heatHighlights('danger', 'success') });
    const cluster = vlistRoot.querySelector('[part~="heat"]') as HTMLElement;
    const page = vlistRoot.querySelector('[part~="page"]') as HTMLElement;
    const clusterStyle = getComputedStyle(cluster);

    // The cluster is the third stacked child of the column-flex, center-aligned page button, so it
    // is positioned entirely by that flow. An inset declaration on a `position: static` box is
    // silently inert -- it survives every gate and every stylesheet-text check while doing
    // nothing -- so assert the box actually carries none rather than trusting the rule text.
    expect(clusterStyle.position).to.equal('static');
    expect(clusterStyle.insetInlineEnd).to.equal('auto');
    expect(clusterStyle.insetInlineStart).to.equal('auto');

    // ...and that the flow really does centre it, in both directions, which is what the inert
    // trailing-edge nudge would have broken had anyone "fixed" it by adding `position: relative`.
    const pageBox = page.getBoundingClientRect();
    const clusterBox = cluster.getBoundingClientRect();
    expect(Math.abs((clusterBox.left - pageBox.left) - (pageBox.right - clusterBox.right))).to.be.lessThan(1);
  });

  it('themes each heat-dot tone from its own cssprop, defaulting to the shared tone token', async () => {
    const cases: Array<[LyraHighlightTone, string]> = [
      ['accent', '--lr-page-rail-heat-accent-color'],
      ['success', '--lr-page-rail-heat-success-color'],
      ['warning', '--lr-page-rail-heat-warning-color'],
      ['danger', '--lr-page-rail-heat-danger-color'],
      ['neutral', '--lr-page-rail-heat-neutral-color'],
    ];
    for (const [tone, cssprop] of cases) {
      const { vlistRoot } = await rail({
        style: `${cssprop}: rgb(9, 8, 7)`,
        highlights: heatHighlights(tone),
      });
      const dot = vlistRoot.querySelector(`[part~="heat-dot-${tone}"]`) as HTMLElement;
      expect(getComputedStyle(dot).backgroundColor, tone).to.equal('rgb(9, 8, 7)');
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
