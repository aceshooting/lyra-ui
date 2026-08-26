import {
  aTimeout,
  expect,
  fixture,
  html,
  oneEvent,
  waitUntil,
} from "@open-wc/testing";
import { LitElement, render, type PropertyValues } from "lit";
import "./pptx-viewer.js";
import type { LyraPptxViewer } from "./pptx-viewer.js";
import type {
  PptxRendererModule,
  PptxTextSearchResult,
  PptxViewerApi,
} from "./pptx-loader.js";
import { getDefaultDocumentRendererRegistry } from "../document-viewer/registry.js";
import type { LyraHighlight } from "../document-viewer/anchors.js";
import { resetMouse, sendMouse } from '../../../../test/wtr-mouse.js';
import {
  VIEWER_SEARCH_QUERY_LIMIT,
  VIEWER_SEARCH_WORK_LIMIT,
} from "../viewer-search-limits.js";

function zipWithDeclaredSize(uncompressedBytes = 1): ArrayBuffer {
  const localSize = 32;
  const directorySize = 47;
  const source = new ArrayBuffer(localSize + directorySize + 22);
  const view = new DataView(source);
  view.setUint32(0, 0x04034b50, true);
  view.setUint32(18, 1, true);
  view.setUint32(22, uncompressedBytes, true);
  view.setUint16(26, 1, true);
  view.setUint8(30, 0x61);
  view.setUint8(31, 0);
  view.setUint32(localSize, 0x02014b50, true);
  view.setUint32(localSize + 20, 1, true);
  view.setUint32(localSize + 24, uncompressedBytes, true);
  view.setUint16(localSize + 28, 1, true);
  view.setUint32(localSize + 42, 0, true);
  view.setUint8(localSize + 46, 0x61);
  const endOffset = localSize + directorySize;
  view.setUint32(endOffset, 0x06054b50, true);
  view.setUint16(endOffset + 8, 1, true);
  view.setUint16(endOffset + 10, 1, true);
  view.setUint32(endOffset + 12, directorySize, true);
  view.setUint32(endOffset + 16, localSize, true);
  return source;
}

function response(ok = true): Response {
  return {
    ok,
    status: ok ? 200 : 404,
    statusText: ok ? "OK" : "Not Found",
    arrayBuffer: () => Promise.resolve(zipWithDeclaredSize()),
  } as unknown as Response;
}

/** A promise plus its externally-callable resolve/reject, for precisely timing a stale in-flight
 *  `mount()` against a later superseding `src` change. */
function deferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
} {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function fakeModule(
  slideCount = 2,
  searchResults: PptxTextSearchResult[] = []
) {
  const calls = {
    open: 0,
    goToSlide: 0,
    destroy: 0,
    searchText: 0,
    highlightSearchResult: 0,
    clearSearchHighlights: 0,
    renderThumbnail: 0,
    disposeThumbnail: 0,
    highlighted: [] as PptxTextSearchResult[],
  };
  const viewer = new EventTarget() as PptxViewerApi;
  viewer.slideCount = slideCount;
  viewer.currentSlideIndex = 0;
  viewer.goToSlide = async (index: number) => {
    calls.goToSlide++;
    viewer.currentSlideIndex = index;
    viewer.dispatchEvent(new CustomEvent("slidechange", { detail: { index } }));
  };
  viewer.searchText = () => {
    calls.searchText++;
    return searchResults;
  };
  viewer.highlightSearchResult = async (result) => {
    calls.highlightSearchResult++;
    calls.highlighted.push(result);
    return { dispose() {} };
  };
  viewer.renderThumbnailToContainer = (index, container, options) => {
    calls.renderThumbnail++;
    const preview = document.createElement("div");
    preview.dataset["slideIndex"] = String(index);
    preview.dataset["width"] = String(options?.width);
    container.append(preview);
    return {
      ready: Promise.resolve(),
      dispose() {
        calls.disposeThumbnail++;
        preview.remove();
      },
    };
  };
  viewer.clearSearchHighlights = () => {
    calls.clearSearchHighlights++;
  };
  viewer.destroy = () => {
    calls.destroy++;
  };
  return {
    calls,
    viewer,
    module: {
      PptxViewer: {
        open: async () => {
          calls.open++;
          return viewer;
        },
      },
      RECOMMENDED_ZIP_LIMITS: {},
    } as never,
  };
}

function stubFetch(ok = true): () => void {
  const original = window.fetch;
  window.fetch = (() => Promise.resolve(response(ok))) as typeof window.fetch;
  return () => {
    window.fetch = original;
  };
}

describe("lr-pptx-viewer", () => {
  it("leaves a non-empty host aria-label on the host, then uses label, then falls through to name and a localized default when label is omitted", async () => {
    const el = (await fixture(
      html`<lr-pptx-viewer
        aria-label="Host deck"
        label="API deck"
        name="Visible deck"
      ></lr-pptx-viewer>`
    )) as LyraPptxViewer;
    const base = () => el.shadowRoot!.querySelector('[part="base"]')!;

    expect(base().getAttribute("aria-label")).to.be.null;
    expect(base().getAttribute("role")).to.be.null;
    el.removeAttribute("aria-label");
    await el.updateComplete;
    expect(base().getAttribute("aria-label")).to.equal("API deck");
    el.label = undefined;
    await el.updateComplete;
    expect(base().getAttribute("aria-label")).to.equal("Visible deck");
    el.name = "";
    await el.updateComplete;
    expect(base().getAttribute("aria-label")).to.equal("Presentation viewer");
  });

  it("honors an explicitly empty label as genuinely empty, distinct from omitting it (which falls through to name)", async () => {
    const el = (await fixture(
      html`<lr-pptx-viewer label="API deck" name="Visible deck"></lr-pptx-viewer>`
    )) as LyraPptxViewer;
    const base = () => el.shadowRoot!.querySelector('[part="base"]')!;
    expect(base().getAttribute("aria-label")).to.equal("API deck");

    el.label = "";
    await el.updateComplete;
    expect(el.label).to.equal("");
    expect(base().getAttribute("aria-label")).to.equal("");

    el.label = undefined;
    await el.updateComplete;
    expect(base().getAttribute("aria-label")).to.equal("Visible deck");
  });

  it("preserves an explicitly empty host aria-label on the region owner", async () => {
    const el = await fixture<LyraPptxViewer>(
      html`<lr-pptx-viewer label="API deck" aria-label=""></lr-pptx-viewer>`
    );
    const base = el.shadowRoot!.querySelector('[part="base"]')!;
    expect(base.getAttribute("role")).to.equal("region");
    expect(base.hasAttribute("aria-label")).to.be.true;
    expect(base.getAttribute("aria-label")).to.equal("");
  });

  it("shows its persistent fidelity notice and idle state", async () => {
    const el = await fixture(html`<lr-pptx-viewer></lr-pptx-viewer>`);
    expect(el.shadowRoot!.querySelector('[part="notice"]')).to.exist;
    expect(el.shadowRoot!.querySelector('[part="container"]') == null).to.be
      .true;
    await expect(el).to.be.accessible();
  });

  it("applies max-height to the base custom property", async () => {
    const el = await fixture<LyraPptxViewer>(
      html`<lr-pptx-viewer max-height="32rem"></lr-pptx-viewer>`
    );
    expect(
      (
        el.shadowRoot!.querySelector('[part="base"]') as HTMLElement
      ).style.getPropertyValue("--lr-pptx-viewer-max-height")
    ).to.equal("32rem");
  });

  it("keeps the nested loading skeleton out of the viewer live-region contract", async () => {
    const el = await fixture<LyraPptxViewer>(
      html`<lr-pptx-viewer></lr-pptx-viewer>`
    );
    expect(
      el.shadowRoot!.querySelector('[part="base"]')!.getAttribute("aria-busy")
    ).to.equal("false");
    (el as unknown as { phase: string }).phase = "loading";
    el.requestUpdate();
    await el.updateComplete;
    expect(
      el.shadowRoot!.querySelector("lr-skeleton + .sr-only")?.textContent
    ).to.equal("Loading…");
    expect(
      el.shadowRoot!.querySelector('[part="base"]')!.getAttribute("aria-busy")
    ).to.equal("true");
    expect(el.shadowRoot!.querySelectorAll("lr-skeleton").length).to.equal(1);
    const skeleton = el.shadowRoot!.querySelector(
      "lr-skeleton"
    ) as HTMLElement & {
      updateComplete: Promise<unknown>;
    };
    await skeleton.updateComplete;
    expect(
      el.shadowRoot!.querySelectorAll(
        '[role="status"], [role="alert"], [aria-live]'
      ).length
    ).to.equal(0);
  });

  it("mounts the renderer, navigates, and cleans up", async () => {
    const fake = fakeModule();
    const restore = stubFetch();
    try {
      const el = (await fixture(
        html`<lr-pptx-viewer aria-label="Deck"></lr-pptx-viewer>`
      )) as LyraPptxViewer;
      el.loadRenderer = async () => fake.module;
      el.src = "https://example.test/deck.pptx";
      await aTimeout(30);
      expect(el.shadowRoot!.querySelector('[part="container"]')).to.exist;
      (
        el.shadowRoot!.querySelector(
          '[part="next-button"]'
        ) as HTMLButtonElement
      ).click();
      expect(fake.calls.goToSlide).to.equal(1);
      el.remove();
      expect(fake.calls.destroy).to.equal(1);
    } finally {
      restore();
    }
  });

  it('contains rejected slide navigation with the localized error state and lr-render-error', async () => {
    const fake = fakeModule();
    const boom = new Error('slide navigation failed');
    fake.viewer.goToSlide = async () => {
      throw boom;
    };
    const restore = stubFetch();
    try {
      const el = await fixture<LyraPptxViewer>(html`<lr-pptx-viewer></lr-pptx-viewer>`);
      el.loadRenderer = async () => fake.module;
      el.src = 'https://example.test/deck.pptx';
      await oneEvent(el, 'lr-load');

      const errors: unknown[] = [];
      el.addEventListener('lr-render-error', (event) => errors.push(event.detail.error));
      const outcome = await el.goToSlide(1).then(
        () => 'resolved',
        () => 'rejected',
      );
      await el.updateComplete;

      expect(outcome).to.equal('resolved');
      expect(errors).to.deep.equal([boom]);
      expect(el.shadowRoot!.querySelector('[part="error"]')?.textContent)
        .to.equal('Failed to render this presentation.');
      expect(fake.calls.destroy).to.equal(1);

      let laterSlideChanges = 0;
      el.addEventListener('lr-slide-change', () => laterSlideChanges++);
      fake.viewer.currentSlideIndex = 1;
      fake.viewer.dispatchEvent(new CustomEvent('slidechange', { detail: { index: 1 } }));
      await aTimeout(0);

      expect(laterSlideChanges).to.equal(0);
      expect(el.pageViewerSnapshot).to.deep.include({
        status: 'error',
        page: 1,
        pageCount: 0,
      });
    } finally {
      restore();
    }
  });

  it("publishes atomic page state and maps one-based page assignments to slide navigation", async () => {
    const fake = fakeModule(3);
    const restore = stubFetch();
    try {
      const el = await fixture<LyraPptxViewer>(
        html`<lr-pptx-viewer></lr-pptx-viewer>`
      );
      el.loadRenderer = async () => fake.module;
      el.src = "https://example.test/deck.pptx";
      await oneEvent(el, "lr-load");
      const identity = el.pageViewerSnapshot.identity;
      expect(el.pageViewerSnapshot).to.deep.equal({
        identity,
        status: "ready",
        page: 1,
        pageCount: 3,
      });

      const stateChanged = oneEvent(el, "lr-page-viewer-state-change");
      el.page = 3;
      const snapshot = (await stateChanged).detail.snapshot;
      expect(snapshot).to.deep.equal({
        identity,
        status: "ready",
        page: 3,
        pageCount: 3,
      });
      expect(fake.viewer.currentSlideIndex).to.equal(2);

      const replacementReady = oneEvent(el, "lr-load");
      fake.viewer.currentSlideIndex = 0;
      el.src = "https://example.test/replacement.pptx";
      await replacementReady;
      expect(el.pageViewerSnapshot.identity).to.be.greaterThan(identity);
      expect(el.pageViewerSnapshot).to.deep.include({
        status: "ready",
        page: 1,
        pageCount: 3,
      });
    } finally {
      restore();
    }
  });

  it("renders bounded one-based DOM thumbnails and transfers handle ownership to the caller", async () => {
    const fake = fakeModule(2);
    const restore = stubFetch();
    try {
      const el = await fixture<LyraPptxViewer>(
        html`<lr-pptx-viewer></lr-pptx-viewer>`
      );
      el.loadRenderer = async () => fake.module;
      el.src = "https://example.test/deck.pptx";
      await oneEvent(el, "lr-load");
      const target = el.ownerDocument.createElement("div");
      el.parentElement!.append(target);

      expect(await el.renderPageThumbnailToContainer(0, target)).to.be.false;
      expect(
        await el.renderPageThumbnailToContainer(1, target, {
          width: Number.POSITIVE_INFINITY,
        })
      ).to.be.false;
      expect(
        await el.renderPageThumbnailToContainer(1, target, { width: 2_049 })
      ).to.be.false;
      expect(fake.calls.renderThumbnail).to.equal(0);

      const handle = await el.renderPageThumbnailToContainer(2, target, {
        width: 80,
      });
      expect(handle).to.not.equal(false);
      expect(
        target.firstElementChild?.getAttribute("data-slide-index")
      ).to.equal("1");
      expect(target.firstElementChild?.getAttribute("data-width")).to.equal(
        "80"
      );
      (handle as { dispose(): void }).dispose();
      expect(fake.calls.disposeThumbnail).to.equal(1);
    } finally {
      restore();
    }
  });

  it("disposes and rejects a thumbnail whose async resources settle after disconnect", async () => {
    const fake = fakeModule(1);
    const ready = deferred<void>();
    fake.viewer.renderThumbnailToContainer = (_index, container) => {
      const preview = document.createElement("div");
      container.append(preview);
      return {
        ready: ready.promise,
        dispose() {
          fake.calls.disposeThumbnail++;
          preview.remove();
        },
      };
    };
    const restore = stubFetch();
    try {
      const el = await fixture<LyraPptxViewer>(
        html`<lr-pptx-viewer></lr-pptx-viewer>`
      );
      el.loadRenderer = async () => fake.module;
      el.src = "https://example.test/deck.pptx";
      await oneEvent(el, "lr-load");
      const target = el.ownerDocument.createElement("div");
      const committed = el.ownerDocument.createElement('span');
      committed.textContent = 'committed preview';
      target.append(committed);
      el.parentElement!.append(target);
      const result = el.renderPageThumbnailToContainer(1, target);
      el.remove();
      ready.resolve();
      expect(await result).to.be.false;
      expect(fake.calls.disposeThumbnail).to.equal(1);
      expect(target.childNodes.length).to.equal(1);
      expect(target.firstChild === committed).to.be.true;
    } finally {
      restore();
    }
  });

  it("searches the complete presentation model when the matching slide is not mounted", async () => {
    const offscreenMatch: PptxTextSearchResult = {
      slideIndex: 89,
      nodeId: "shape-offscreen",
      matchStart: 0,
      matchEnd: 6,
      text: "needle",
    };
    const fake = fakeModule(100, [offscreenMatch]);
    const restore = stubFetch();
    try {
      const el = await fixture<LyraPptxViewer>(
        html`<lr-pptx-viewer></lr-pptx-viewer>`
      );
      el.loadRenderer = async () => fake.module;
      el.src = "https://example.test/deck.pptx";
      await oneEvent(el, "lr-load");

      const changed = oneEvent(el, "lr-search-change");
      expect(await el.search("needle")).to.equal(1);
      expect((await changed).detail).to.deep.equal({
        query: "needle",
        matchCount: 1,
        matchCountExact: true,
        activeIndex: 0,
      });
      expect(fake.calls.searchText).to.equal(1);
      expect(fake.calls.goToSlide).to.equal(1);
      expect(fake.viewer.currentSlideIndex).to.equal(89);
      expect(fake.calls.highlighted).to.deep.equal([offscreenMatch]);
      // The fake renderer intentionally mounted no slide DOM. A DOM-derived search would have
      // returned zero, so this proves the model adapter owns the complete windowed-deck contract.
      expect(
        el.shadowRoot!.querySelector('[part="container"]')!.childElementCount
      ).to.equal(0);
    } finally {
      restore();
    }
  });

  it("caps model search results before retaining or navigating them", async () => {
    const matches = Array.from(
      { length: 10_050 },
      (_unused, index): PptxTextSearchResult => ({
        slideIndex: index,
        nodeId: `node-${index}`,
        matchStart: 0,
        matchEnd: 1,
        text: "x",
      })
    );
    const fake = fakeModule(10_050, matches);
    const restore = stubFetch();
    try {
      const el = await fixture<LyraPptxViewer>(
        html`<lr-pptx-viewer></lr-pptx-viewer>`
      );
      el.loadRenderer = async () => fake.module;
      el.src = "https://example.test/deck.pptx";
      await oneEvent(el, "lr-load");
      const changed = oneEvent(el, "lr-search-change");
      expect(await el.search("x")).to.equal(10_000);
      expect((await changed).detail).to.deep.include({
        matchCount: 10_000,
        matchCountExact: false,
      });
    } finally {
      restore();
    }
  });

  it("rejects an oversized query before invoking the renderer search operation", async () => {
    const fake = fakeModule();
    const restore = stubFetch();
    try {
      const el = await fixture<LyraPptxViewer>(
        html`<lr-pptx-viewer></lr-pptx-viewer>`
      );
      el.loadRenderer = async () => fake.module;
      el.src = "https://example.test/deck.pptx";
      await oneEvent(el, "lr-load");
      const changed = oneEvent(el, "lr-search-change");
      const query = "x".repeat(VIEWER_SEARCH_QUERY_LIMIT + 1);

      expect(await el.search(query)).to.equal(0);
      expect(fake.calls.searchText).to.equal(0);
      expect((await changed).detail).to.deep.equal({
        query,
        matchCount: 0,
        matchCountExact: false,
        activeIndex: -1,
      });
    } finally {
      restore();
    }
  });

  it("forwards recoverable peer slide/node failures through typed diagnostics without unmounting", async () => {
    const fake = fakeModule();
    const restore = stubFetch();
    try {
      const el = await fixture<LyraPptxViewer>(
        html`<lr-pptx-viewer></lr-pptx-viewer>`
      );
      el.loadRenderer = async () => fake.module;
      el.src = "https://example.test/deck.pptx";
      await oneEvent(el, "lr-load");

      const slideCause = new Error("slide failed");
      const diagnosticEvent = oneEvent(el, "lr-viewer-diagnostic");
      let terminalErrors = 0;
      el.addEventListener("lr-render-error", () => terminalErrors++);
      fake.viewer.dispatchEvent(
        new CustomEvent("slideerror", {
          detail: { index: 1, error: slideCause },
        })
      );
      expect((await diagnosticEvent).detail.diagnostic).to.deep.include({
        code: "pptx-slide-render-error",
        severity: "error",
        fatal: false,
        source: "pptx-renderer",
        cause: slideCause,
        page: 2,
      });
      await aTimeout(0);
      expect(terminalErrors).to.equal(0);
      expect(el.shadowRoot!.querySelector('[part="container"]')).to.exist;

      const nodeCause = new Error("node failed");
      const nodeDiagnostic = oneEvent(el, "lr-viewer-diagnostic");
      fake.viewer.dispatchEvent(
        new CustomEvent("nodeerror", {
          detail: { nodeId: "chart-4", error: nodeCause },
        })
      );
      expect((await nodeDiagnostic).detail.diagnostic).to.deep.include({
        code: "pptx-node-render-error",
        nodeId: "chart-4",
        cause: nodeCause,
      });
    } finally {
      restore();
    }
  });

  it("turns a peer-classified fatal render diagnostic into one terminal state and removes listeners", async () => {
    const fake = fakeModule();
    const restore = stubFetch();
    try {
      const el = await fixture<LyraPptxViewer>(
        html`<lr-pptx-viewer></lr-pptx-viewer>`
      );
      el.loadRenderer = async () => fake.module;
      el.src = "https://example.test/deck.pptx";
      await oneEvent(el, "lr-load");

      const cause = new Error("renderer unusable");
      const diagnosticEvent = oneEvent(el, "lr-viewer-diagnostic");
      const terminalEvent = oneEvent(el, "lr-render-error");
      fake.viewer.dispatchEvent(
        new CustomEvent("slideerror", {
          detail: { index: 0, error: cause, fatal: true },
        })
      );
      expect((await diagnosticEvent).detail.diagnostic).to.deep.include({
        code: "pptx-slide-render-error",
        fatal: true,
        page: 1,
        cause,
      });
      expect((await terminalEvent).detail.error).to.equal(cause);
      await el.updateComplete;
      expect(
        el.shadowRoot!.querySelector('[part="error"]')?.textContent
      ).to.equal("Failed to render this presentation.");
      expect(
        el.shadowRoot!.querySelector('[part="container"]') === null
      ).to.equal(true);
      expect(fake.calls.destroy).to.equal(1);

      let laterDiagnostics = 0;
      el.addEventListener("lr-viewer-diagnostic", () => laterDiagnostics++);
      fake.viewer.dispatchEvent(
        new CustomEvent("nodeerror", {
          detail: { nodeId: "late", error: new Error("late") },
        })
      );
      expect(laterDiagnostics).to.equal(0);
    } finally {
      restore();
    }
  });

  it("remounts the presentation after a synchronous reparent while connected, instead of leaving stale-looking live controls over an empty container", async () => {
    // Regression test: disconnectedCallback() used to tear the renderer down
    // without resetting `phase`/`slideCount`/`currentSlideIndex` -- and
    // nothing re-armed the mount on reconnect, since updated()'s
    // `changed.has('src')` gate never fires again for a reparent that leaves
    // `src` unchanged. The element re-rendered as an empty container with
    // live-looking nav controls whose prev/next buttons silently no-op
    // against a destroyed (undefined) viewer.
    const fake = fakeModule();
    const restore = stubFetch();
    try {
      const el = (await fixture(
        html`<lr-pptx-viewer></lr-pptx-viewer>`
      )) as LyraPptxViewer;
      el.loadRenderer = async () => fake.module;
      el.src = "https://example.test/deck.pptx";
      await aTimeout(30);
      expect(el.shadowRoot!.querySelector('[part="container"]')).to.exist;

      const otherContainer = document.createElement("div");
      document.body.appendChild(otherContainer);
      otherContainer.appendChild(el); // disconnect + reconnect synchronously, same instance
      await el.updateComplete;

      // Right after the reparent, the previous renderer was torn down -- the
      // viewer must fall back to an idle/empty state, not keep rendering nav
      // controls against a destroyed viewer.
      expect(fake.calls.destroy).to.equal(1);
      expect(
        el.shadowRoot!.querySelector('[part="container"]') == null,
        "must not still render a container as if a presentation were mounted"
      ).to.be.true;

      // The reconnect re-arms the mount, so the presentation comes back
      // rather than the viewer staying permanently blank.
      await aTimeout(30);
      expect(
        el.shadowRoot!.querySelector('[part="container"]'),
        "a reconnect must remount the presentation"
      ).to.exist;

      otherContainer.remove();
    } finally {
      restore();
    }
  });

  it("gives the previous/next slide-nav buttons the shared minimum hit area", async () => {
    const fake = fakeModule();
    const restore = stubFetch();
    try {
      const el = (await fixture(
        html`<lr-pptx-viewer></lr-pptx-viewer>`
      )) as LyraPptxViewer;
      el.loadRenderer = async () => fake.module;
      el.src = "https://example.test/deck.pptx";
      await aTimeout(30);
      const previous = el.shadowRoot!.querySelector(
        '[part="previous-button"]'
      ) as HTMLElement;
      const next = el.shadowRoot!.querySelector(
        '[part="next-button"]'
      ) as HTMLElement;

      expect(getComputedStyle(previous).minInlineSize).to.equal("40px");
      expect(getComputedStyle(previous).minBlockSize).to.equal("40px");
      expect(getComputedStyle(next).minInlineSize).to.equal("40px");
      expect(getComputedStyle(next).minBlockSize).to.equal("40px");
    } finally {
      restore();
    }
  });

  it('keeps the next-slide button reachable within [part="base"] when a long slide-count string would otherwise overflow the nav row', async () => {
    // A large slide count (or a longer localized "Slide X of Y" phrasing) produces a slide-count
    // string that can't shrink without min-inline-size: 0, forcing [part='nav'] wider than
    // [part='base']. Since [part='base'] has overflow: hidden, that overflow gets silently
    // clipped -- potentially pushing next-button out of the visible/reachable region -- instead of
    // the slide-count text truncating.
    const fake = fakeModule(123_456_789);
    const restore = stubFetch();
    try {
      const el = (await fixture(
        html`<lr-pptx-viewer style="inline-size:150px"></lr-pptx-viewer>`
      )) as LyraPptxViewer;
      el.loadRenderer = async () => fake.module;
      el.src = "https://example.test/deck.pptx";
      await aTimeout(30);
      const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
      const next = el.shadowRoot!.querySelector(
        '[part="next-button"]'
      ) as HTMLElement;
      const baseRect = base.getBoundingClientRect();
      const nextRect = next.getBoundingClientRect();

      expect(
        nextRect.right,
        "next-button must stay within the visible/reachable base region, not be pushed past it by an unshrinkable slide-count string"
      ).to.be.at.most(baseRect.right + 1);
    } finally {
      restore();
    }
  });

  it("chains updated() to super.updated() so a mixin layered under LyraElement would still run", async () => {
    // No shared mixin actually overrides updated() today, so the only way to prove the chain is
    // live (rather than grepping source text for the call) is to patch the base-class hook itself
    // -- the exact hook a future mixin would extend -- and confirm it actually fires.
    const hadOwn = Object.prototype.hasOwnProperty.call(
      LitElement.prototype,
      "updated"
    );
    const original = (
      LitElement.prototype as unknown as {
        updated?: (changed: PropertyValues) => void;
      }
    ).updated;
    let called = false;
    (
      LitElement.prototype as unknown as {
        updated: (changed: PropertyValues) => void;
      }
    ).updated = function (this: LitElement, changed: PropertyValues) {
      called = true;
      original?.call(this, changed);
    };
    try {
      const el = (await fixture(
        html`<lr-pptx-viewer></lr-pptx-viewer>`
      )) as LyraPptxViewer;
      await el.updateComplete;
      expect(called).to.be.true;
    } finally {
      if (hadOwn) {
        (LitElement.prototype as unknown as { updated: unknown }).updated =
          original;
      } else {
        delete (LitElement.prototype as unknown as { updated?: unknown })
          .updated;
      }
    }
  });

  it("honors a strings override for the persistent fidelity notice", async () => {
    const el = (await fixture(
      html`<lr-pptx-viewer></lr-pptx-viewer>`
    )) as LyraPptxViewer;
    expect(
      el.shadowRoot!.querySelector('[part="notice"]')!.textContent
    ).to.equal("Some slide content may not display.");
    el.strings = {
      pptxViewerFidelityNotice:
        "Certains contenus de diapositive peuvent ne pas s’afficher.",
    };
    await el.updateComplete;
    expect(
      el.shadowRoot!.querySelector('[part="notice"]')!.textContent
    ).to.equal("Certains contenus de diapositive peuvent ne pas s’afficher.");
  });

  it("keeps the shared anchor live region visually hidden once it carries an announcement", async () => {
    const el = (await fixture(
      html`<lr-pptx-viewer name="Deck"></lr-pptx-viewer>`
    )) as LyraPptxViewer;
    // An unresolvable highlight id announces `anchorNotFound` immediately -- no retry loop.
    await el.scrollToAnchor("no-such-highlight");
    await el.updateComplete;
    const region = el.shadowRoot!.querySelector(
      '[part="anchor-live-region"]'
    ) as HTMLElement;
    expect(region != null, "the mixin live region is rendered").to.equal(true);
    expect(
      (region.textContent ?? "").trim().length,
      "the live region actually carries announcement text"
    ).to.be.greaterThan(0);
    // Rendered geometry, not stylesheet text: an unhidden live region lays out as a flex item of
    // [part="base"] and paints its announcement under the fidelity notice.
    const rect = region.getBoundingClientRect();
    expect(
      rect.height,
      "live-region block size stays clipped to 1px"
    ).to.be.at.most(1);
    expect(
      rect.width,
      "live-region inline size stays clipped to 1px"
    ).to.be.at.most(1);
  });

  it('reports found:false for generated id-less presentation output', async () => {
    const fake = fakeModule();
    const restore = stubFetch();
    try {
      const el = await fixture<LyraPptxViewer>(
        html`<lr-pptx-viewer></lr-pptx-viewer>`,
      );
      el.loadRenderer = async () => fake.module;
      const loaded = oneEvent(el, 'lr-load');
      el.src = 'https://example.test/deck.pptx';
      await loaded;
      const timing = el as unknown as {
        anchorTimeoutMs: number;
        anchorRetryIntervalMs: number;
      };
      timing.anchorTimeoutMs = 20;
      timing.anchorRetryIntervalMs = 2;
      expect(
        el.shadowRoot!.querySelector('[part="container"]')!.hasAttribute('id'),
      ).to.equal(false);
      const resultEvent = oneEvent(el, 'lr-anchor-result');
      expect(
        await el.scrollToAnchor({ kind: 'fragment', id: 'slide-1' }),
      ).to.equal(false);
      expect((await resultEvent).detail).to.deep.equal({ found: false });
    } finally {
      restore();
    }
  });

  it("is accessible with a mounted presentation and its slide-nav controls visible", async () => {
    const fake = fakeModule();
    const restore = stubFetch();
    try {
      const el = (await fixture(
        html`<lr-pptx-viewer aria-label="Deck"></lr-pptx-viewer>`
      )) as LyraPptxViewer;
      el.loadRenderer = async () => fake.module;
      el.src = "https://example.test/deck.pptx";
      await aTimeout(30);
      expect(el.shadowRoot!.querySelectorAll('[part="nav"]').length).to.equal(
        1
      );
      expect(
        el.shadowRoot!.querySelectorAll('[part="previous-button"]').length
      ).to.equal(1);
      expect(
        el.shadowRoot!.querySelectorAll('[part="next-button"]').length
      ).to.equal(1);
      await expect(el).to.be.accessible();
    } finally {
      restore();
    }
  });

  it("renders unsafe-url and missing-renderer errors", async () => {
    const unsafe = (await fixture(
      html`<lr-pptx-viewer .src=${"javascript:alert(1)"}></lr-pptx-viewer>`
    )) as LyraPptxViewer;
    await aTimeout(10);
    expect(
      unsafe.shadowRoot!.querySelector('[part="error"]')!.textContent
    ).to.contain("Document URL is not allowed");
    const restore = stubFetch();
    try {
      const el = (await fixture(
        html`<lr-pptx-viewer></lr-pptx-viewer>`
      )) as LyraPptxViewer;
      el.loadRenderer = async () => null;
      el.src = "https://example.test/deck.pptx";
      await aTimeout(20);
      expect(
        el.shadowRoot!.querySelector('[part="error"]')!.textContent
      ).to.contain("Failed to render this presentation");
    } finally {
      restore();
    }
  });

  it("emits one render error for unsafe URL, missing renderer, and non-ok HTTP routes", async () => {
    const unsafe = (await fixture(
      html`<lr-pptx-viewer></lr-pptx-viewer>`
    )) as LyraPptxViewer;
    const unsafeEvent = oneEvent(unsafe, "lr-render-error");
    unsafe.src = "javascript:alert(1)";
    expect((await unsafeEvent).detail.error).to.exist;

    const restoreOk = stubFetch();
    try {
      const missing = (await fixture(
        html`<lr-pptx-viewer></lr-pptx-viewer>`
      )) as LyraPptxViewer;
      missing.loadRenderer = async () => null;
      const missingEvent = oneEvent(missing, "lr-render-error");
      missing.src = "https://example.test/deck.pptx";
      expect((await missingEvent).detail.error).to.exist;
    } finally {
      restoreOk();
    }

    const fake = fakeModule();
    const restoreMissing = stubFetch(false);
    try {
      const http = (await fixture(
        html`<lr-pptx-viewer></lr-pptx-viewer>`
      )) as LyraPptxViewer;
      http.loadRenderer = async () => fake.module;
      const httpEvent = oneEvent(http, "lr-render-error");
      http.src = "https://example.test/missing.pptx";
      expect((await httpEvent).detail.error).to.exist;
    } finally {
      restoreMissing();
    }
  });

  it("loads without an abort signal when AbortController is unavailable", async () => {
    const fake = fakeModule();
    const restore = stubFetch();
    const originalAbortController = window.AbortController;
    (window as unknown as { AbortController?: unknown }).AbortController =
      undefined;
    try {
      const el = (await fixture(
        html`<lr-pptx-viewer></lr-pptx-viewer>`
      )) as LyraPptxViewer;
      el.loadRenderer = async () => fake.module;
      const listener = oneEvent(el, "lr-load");
      el.src = "https://example.test/deck.pptx";
      expect((await listener).detail).to.deep.equal({ slideCount: 2 });
    } finally {
      window.AbortController = originalAbortController;
      restore();
    }
  });

  it("fails closed with a localized error when the pptx renderer peer fails to load", async () => {
    const restore = stubFetch();
    try {
      const el = (await fixture(
        html`<lr-pptx-viewer></lr-pptx-viewer>`
      )) as LyraPptxViewer;
      el.loadRenderer = async () => {
        throw new Error("peer unavailable");
      };
      const listener = oneEvent(el, "lr-render-error");
      el.src = "https://example.test/deck.pptx";
      const event = (await listener) as CustomEvent<{ error: unknown }>;
      expect(event.detail.error).to.exist;
      await el.updateComplete;
      expect(
        el.shadowRoot!.querySelector('[part="error"]')!.textContent
      ).to.equal("Failed to load document.");
    } finally {
      restore();
    }
  });

  it("shows a failed-to-load error when the presentation fetch fails but the renderer peer loaded fine", async () => {
    const fake = fakeModule();
    const restore = stubFetch(false);
    try {
      const el = (await fixture(
        html`<lr-pptx-viewer></lr-pptx-viewer>`
      )) as LyraPptxViewer;
      el.loadRenderer = async () => fake.module;
      el.src = "https://example.test/missing.pptx";
      await waitUntil(
        () => el.shadowRoot!.querySelector('[part="error"]') !== null
      );
      expect(
        el.shadowRoot!.querySelector('[part="error"]')!.textContent
      ).to.equal("Failed to load document.");
    } finally {
      restore();
    }
  });

  it("shows the resource-too-large error when the presentation exceeds the size limit", async () => {
    const fake = fakeModule();
    const original = window.fetch;
    window.fetch = (() =>
      Promise.resolve({
        ok: true,
        status: 200,
        statusText: "OK",
        headers: {
          get: (name: string) =>
            name === "content-length" ? String(30 * 1024 * 1024) : null,
        },
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
      } as unknown as Response)) as typeof window.fetch;
    try {
      const el = (await fixture(
        html`<lr-pptx-viewer></lr-pptx-viewer>`
      )) as LyraPptxViewer;
      el.loadRenderer = async () => fake.module;
      const listener = oneEvent(el, "lr-render-error");
      el.src = "https://example.test/huge.pptx";
      const event = (await listener) as CustomEvent<{ error: unknown }>;
      expect(event.detail.error).to.exist;
      await el.updateComplete;
      expect(
        el.shadowRoot!.querySelector('[part="error"]')!.textContent
      ).to.equal("This document is too large to preview.");
    } finally {
      window.fetch = original;
    }
  });

  it("rejects declared archive expansion before the renderer can open the presentation", async () => {
    const fake = fakeModule();
    const original = window.fetch;
    window.fetch = (() =>
      Promise.resolve({
        ok: true,
        status: 200,
        statusText: "OK",
        arrayBuffer: () =>
          Promise.resolve(zipWithDeclaredSize(256 * 1024 * 1024 + 1)),
      } as unknown as Response)) as typeof window.fetch;
    try {
      const el = (await fixture(
        html`<lr-pptx-viewer></lr-pptx-viewer>`
      )) as LyraPptxViewer;
      el.loadRenderer = async () => fake.module;
      let errors = 0;
      el.addEventListener("lr-render-error", () => {
        errors++;
      });
      el.src = "https://example.test/expansion-bomb.pptx";
      await aTimeout(50);
      expect(fake.calls.open).to.equal(0);
      expect(errors).to.equal(1);
      expect(
        el.shadowRoot!.querySelector('[part="error"]')!.textContent
      ).to.equal("This document is too large to preview.");
    } finally {
      window.fetch = original;
    }
  });

  it("fails closed with a localized render error when opening the presentation throws", async () => {
    const restore = stubFetch();
    try {
      const el = (await fixture(
        html`<lr-pptx-viewer></lr-pptx-viewer>`
      )) as LyraPptxViewer;
      el.loadRenderer = async () =>
        ({
          PptxViewer: {
            open: async () => {
              throw new Error("corrupt");
            },
          },
          RECOMMENDED_ZIP_LIMITS: {},
        } as never);
      const listener = oneEvent(el, "lr-render-error");
      el.src = "https://example.test/corrupt.pptx";
      const event = (await listener) as CustomEvent<{ error: unknown }>;
      expect(event.detail.error).to.exist;
      await el.updateComplete;
      expect(
        el.shadowRoot!.querySelector('[part="error"]')!.textContent
      ).to.equal("Failed to render this presentation.");
    } finally {
      restore();
    }
  });

  it("a src change while awaiting the renderer peer supersedes the earlier mount (stale generation)", async () => {
    const restore = stubFetch();
    const rendererLoad = deferred<PptxRendererModule>();
    try {
      const el = (await fixture(
        html`<lr-pptx-viewer></lr-pptx-viewer>`
      )) as LyraPptxViewer;
      el.loadRenderer = () => rendererLoad.promise;
      el.src = "https://example.test/first.pptx";
      await aTimeout(20); // let mount() reach `await Promise.all(...)` and suspend on the renderer import
      const fake = fakeModule(3);
      el.loadRenderer = async () => fake.module;
      const loadPromise = oneEvent(el, "lr-load");
      el.src = "https://example.test/second.pptx"; // bumps generation, superseding the first mount
      expect((await loadPromise).detail).to.deep.equal({ slideCount: 3 });
      let extraLoadFired = false;
      el.addEventListener("lr-load", () => {
        extraLoadFired = true;
      });
      // The stale first mount's renderer import now resolves late; it must bail silently instead of
      // clobbering the second (current) presentation.
      rendererLoad.resolve(fake.module);
      await aTimeout(20);
      expect(extraLoadFired).to.be.false;
      expect(el.shadowRoot!.querySelector('[part="container"]')).to.exist;
    } finally {
      restore();
    }
  });

  it("a src change while awaiting the presentation bytes supersedes the earlier mount (stale generation)", async () => {
    const fake = fakeModule(4);
    const bufferGate = deferred<ArrayBuffer>();
    const original = window.fetch;
    window.fetch = (() =>
      Promise.resolve({
        ok: true,
        status: 200,
        statusText: "OK",
        arrayBuffer: () => bufferGate.promise,
      } as unknown as Response)) as typeof window.fetch;
    try {
      const el = (await fixture(
        html`<lr-pptx-viewer></lr-pptx-viewer>`
      )) as LyraPptxViewer;
      el.loadRenderer = async () => fake.module;
      el.src = "https://example.test/first.pptx";
      await aTimeout(20); // let mount() resolve Promise.all and suspend inside readResponseArrayBuffer()
      const loadPromise = oneEvent(el, "lr-load");
      el.src = "https://example.test/second.pptx"; // bumps generation, superseding the first mount
      await aTimeout(20); // let the second mount also reach and suspend on the same gated read
      bufferGate.resolve(zipWithDeclaredSize()); // release both suspended reads together
      expect((await loadPromise).detail).to.deep.equal({ slideCount: 4 });
      let extraLoadFired = false;
      el.addEventListener("lr-load", () => {
        extraLoadFired = true;
      });
      await aTimeout(20);
      expect(extraLoadFired).to.be.false;
      expect(el.shadowRoot!.querySelector('[part="container"]')).to.exist;
    } finally {
      window.fetch = original;
    }
  });

  it("a src change while the presentation is opening supersedes the earlier mount and destroys the late viewer (stale generation)", async () => {
    const restore = stubFetch();
    const openGate = deferred<{
      slideCount: number;
      currentSlideIndex: number;
      addEventListener: () => void;
      removeEventListener: () => void;
      goToSlide: () => Promise<void>;
      destroy: () => void;
    }>();
    let staleDestroyCalls = 0;
    const staleViewer = {
      slideCount: 1,
      currentSlideIndex: 0,
      addEventListener: () => {},
      removeEventListener: () => {},
      goToSlide: async () => {},
      destroy: () => {
        staleDestroyCalls++;
      },
    };
    try {
      const el = (await fixture(
        html`<lr-pptx-viewer></lr-pptx-viewer>`
      )) as LyraPptxViewer;
      el.loadRenderer = async () =>
        ({
          PptxViewer: { open: async () => openGate.promise },
          RECOMMENDED_ZIP_LIMITS: {},
        } as never);
      el.src = "https://example.test/first.pptx";
      await aTimeout(20); // let mount() reach `await module.PptxViewer.open(...)` and suspend there
      const fake = fakeModule(5);
      el.loadRenderer = async () => fake.module;
      const loadPromise = oneEvent(el, "lr-load");
      el.src = "https://example.test/second.pptx"; // bumps generation, superseding the first mount
      expect((await loadPromise).detail).to.deep.equal({ slideCount: 5 });
      // The stale first mount's pending open() now resolves late; it must be torn down immediately
      // instead of being adopted as the live viewer.
      openGate.resolve(staleViewer);
      await aTimeout(20);
      expect(staleDestroyCalls).to.equal(1);
      expect(el.shadowRoot!.querySelector('[part="container"]')).to.exist;
    } finally {
      restore();
    }
  });

  it('fails closed when the peer search returns a non-array result', async () => {
    const fake = fakeModule();
    fake.viewer.searchText = () => null as unknown as PptxTextSearchResult[];
    const restore = stubFetch();
    try {
      const el = await fixture<LyraPptxViewer>(html`<lr-pptx-viewer></lr-pptx-viewer>`);
      el.loadRenderer = async () => fake.module;
      el.src = 'https://example.test/deck.pptx';
      await oneEvent(el, 'lr-load');

      const diagnostic = oneEvent(el, 'lr-viewer-diagnostic');
      const changed = oneEvent(el, 'lr-search-change');
      expect(await el.search('x')).to.equal(0);
      expect((await diagnostic).detail.diagnostic).to.deep.include({
        code: 'pptx-search-error',
        fatal: false,
        source: 'pptx-renderer',
      });
      expect((await changed).detail).to.deep.equal({
        query: 'x',
        matchCount: 0,
        matchCountExact: false,
        activeIndex: -1,
      });
      // A non-fatal search diagnostic must not tear down the mounted presentation.
      expect(el.shadowRoot!.querySelector('[part="container"]')).to.exist;
    } finally {
      restore();
    }
  });

  it('filters malformed search candidates while retaining well-formed ones', async () => {
    const valid: PptxTextSearchResult = { slideIndex: 1, nodeId: 'n1', matchStart: 0, matchEnd: 2, text: 'ok' };
    const invalidCandidates: unknown[] = [
      null,
      'not-an-object',
      { slideIndex: 1.5, nodeId: 'a', matchStart: 0, matchEnd: 1, text: 'x' }, // non-integer slideIndex
      { slideIndex: -1, nodeId: 'a', matchStart: 0, matchEnd: 1, text: 'x' }, // negative slideIndex
      { slideIndex: 5, nodeId: 'a', matchStart: 0, matchEnd: 1, text: 'x' }, // slideIndex >= slideCount
      { slideIndex: 0, nodeId: 42, matchStart: 0, matchEnd: 1, text: 'x' }, // non-string nodeId
      { slideIndex: 0, nodeId: 'a', matchStart: 0, matchEnd: 1, text: 7 }, // non-string text
      { slideIndex: 0, nodeId: 'a', matchStart: 0.5, matchEnd: 1, text: 'x' }, // non-integer matchStart
      { slideIndex: 0, nodeId: 'a', matchStart: 0, matchEnd: 1.5, text: 'x' }, // non-integer matchEnd
      { slideIndex: 0, nodeId: 'a', matchStart: -1, matchEnd: 1, text: 'x' }, // negative matchStart
      { slideIndex: 0, nodeId: 'a', matchStart: 2, matchEnd: 1, text: 'x' }, // matchEnd < matchStart
      { slideIndex: 0, nodeId: 'a', matchStart: 0, matchEnd: 99, text: 'x' }, // matchEnd > text.length
    ];
    const fake = fakeModule(2, [...invalidCandidates, valid] as unknown as PptxTextSearchResult[]);
    const restore = stubFetch();
    try {
      const el = await fixture<LyraPptxViewer>(html`<lr-pptx-viewer></lr-pptx-viewer>`);
      el.loadRenderer = async () => fake.module;
      el.src = 'https://example.test/deck.pptx';
      await oneEvent(el, 'lr-load');

      expect(await el.search('x')).to.equal(1);
    } finally {
      restore();
    }
  });

  it('ignores a search result superseded synchronously by a newer search generation', async () => {
    const match: PptxTextSearchResult = {
      slideIndex: 0,
      nodeId: 'stale',
      matchStart: 0,
      matchEnd: 1,
      text: 'x',
    };
    const fake = fakeModule(1, [match]);
    const restore = stubFetch();
    try {
      const el = await fixture<LyraPptxViewer>(html`<lr-pptx-viewer></lr-pptx-viewer>`);
      el.loadRenderer = async () => fake.module;
      el.src = 'https://example.test/deck.pptx';
      await oneEvent(el, 'lr-load');
      fake.viewer.searchText = () => {
        el.clearSearch();
        return [match];
      };

      expect(await el.search('x')).to.equal(0);
      expect(fake.calls.highlightSearchResult).to.equal(0);
    } finally {
      restore();
    }
  });

  it('rejects an individual search result that exceeds the shared model-work budget', async () => {
    const fake = fakeModule(1, [{
      slideIndex: 0,
      nodeId: 'x'.repeat(VIEWER_SEARCH_WORK_LIMIT + 1),
      matchStart: 0,
      matchEnd: 1,
      text: 'x',
    }]);
    const restore = stubFetch();
    try {
      const el = await fixture<LyraPptxViewer>(html`<lr-pptx-viewer></lr-pptx-viewer>`);
      el.loadRenderer = async () => fake.module;
      el.src = 'https://example.test/deck.pptx';
      await oneEvent(el, 'lr-load');

      expect(await el.search('x')).to.equal(0);
      expect(fake.calls.highlightSearchResult).to.equal(0);
    } finally {
      restore();
    }
  });

  it('disposes a late search highlight after clearSearch supersedes it', async () => {
    const match: PptxTextSearchResult = {
      slideIndex: 0,
      nodeId: 'late-highlight',
      matchStart: 0,
      matchEnd: 1,
      text: 'x',
    };
    const fake = fakeModule(1, [match]);
    const highlight = deferred<{ dispose(): void }>();
    let disposals = 0;
    fake.viewer.highlightSearchResult = async () => highlight.promise;
    const restore = stubFetch();
    try {
      const el = await fixture<LyraPptxViewer>(html`<lr-pptx-viewer></lr-pptx-viewer>`);
      el.loadRenderer = async () => fake.module;
      el.src = 'https://example.test/deck.pptx';
      await oneEvent(el, 'lr-load');
      const pending = el.search('x');
      await waitUntil(() => fake.calls.goToSlide === 1);

      el.clearSearch();
      highlight.resolve({ dispose: () => disposals++ });

      expect(await pending).to.equal(0);
      expect(disposals).to.equal(1);
    } finally {
      restore();
    }
  });

  it('reports a non-fatal diagnostic when navigating to a search match fails', async () => {
    const matches: PptxTextSearchResult[] = [
      { slideIndex: 1, nodeId: 'n', matchStart: 0, matchEnd: 1, text: 'x' },
    ];
    const fake = fakeModule(2, matches);
    const restore = stubFetch();
    try {
      const el = await fixture<LyraPptxViewer>(html`<lr-pptx-viewer></lr-pptx-viewer>`);
      el.loadRenderer = async () => fake.module;
      el.src = 'https://example.test/deck.pptx';
      await oneEvent(el, 'lr-load');

      const boom = new Error('nav failed');
      fake.viewer.goToSlide = async () => {
        throw boom;
      };
      const diagnostic = oneEvent(el, 'lr-viewer-diagnostic');
      expect(await el.search('x')).to.equal(1);
      expect((await diagnostic).detail.diagnostic).to.deep.include({
        code: 'pptx-search-error',
        fatal: false,
        source: 'pptx-renderer',
        cause: boom,
        page: 2,
      });
      // Non-fatal: the mounted presentation must remain up.
      expect(el.shadowRoot!.querySelector('[part="container"]')).to.exist;
    } finally {
      restore();
    }
  });

  it('wraps forward and backward through search matches, focusing each one', async () => {
    const matches: PptxTextSearchResult[] = [0, 1, 2].map((index) => ({
      slideIndex: index,
      nodeId: `n${index}`,
      matchStart: 0,
      matchEnd: 1,
      text: 'x',
    }));
    const fake = fakeModule(3, matches);
    const restore = stubFetch();
    try {
      const el = await fixture<LyraPptxViewer>(html`<lr-pptx-viewer></lr-pptx-viewer>`);
      el.loadRenderer = async () => fake.module;
      el.src = 'https://example.test/deck.pptx';
      await oneEvent(el, 'lr-load');
      expect(await el.search('x')).to.equal(3);

      expect(await el.searchNext()).to.be.true;
      expect(fake.viewer.currentSlideIndex).to.equal(1);
      expect(await el.searchNext()).to.be.true;
      expect(fake.viewer.currentSlideIndex).to.equal(2);
      expect(await el.searchNext()).to.be.true; // wraps forward to the first match
      expect(fake.viewer.currentSlideIndex).to.equal(0);

      expect(await el.searchPrevious()).to.be.true; // wraps backward to the last match
      expect(fake.viewer.currentSlideIndex).to.equal(2);
    } finally {
      restore();
    }
  });

  it('searchNext/searchPrevious are no-ops without a mounted viewer or active matches', async () => {
    const el = await fixture<LyraPptxViewer>(html`<lr-pptx-viewer></lr-pptx-viewer>`);
    expect(await el.searchNext()).to.be.false;
    expect(await el.searchPrevious()).to.be.false;
  });

  it('clearSearch resets active search state, disposes highlights, and emits a reset change', async () => {
    const matches: PptxTextSearchResult[] = [
      { slideIndex: 0, nodeId: 'n', matchStart: 0, matchEnd: 1, text: 'x' },
    ];
    const fake = fakeModule(2, matches);
    const restore = stubFetch();
    try {
      const el = await fixture<LyraPptxViewer>(html`<lr-pptx-viewer></lr-pptx-viewer>`);
      el.loadRenderer = async () => fake.module;
      el.src = 'https://example.test/deck.pptx';
      await oneEvent(el, 'lr-load');
      expect(await el.search('x')).to.equal(1);
      const clearHighlightsBefore = fake.calls.clearSearchHighlights;

      const changed = oneEvent(el, 'lr-search-change');
      el.clearSearch();
      expect((await changed).detail).to.deep.equal({
        query: '',
        matchCount: 0,
        matchCountExact: true,
        activeIndex: -1,
      });
      expect(fake.calls.clearSearchHighlights).to.equal(clearHighlightsBefore + 1);
    } finally {
      restore();
    }
  });

  it('rejects additional invalid thumbnail requests: no viewer, non-integer page, out-of-range page, non-positive width', async () => {
    const fake = fakeModule(2);
    const restore = stubFetch();
    try {
      const el = await fixture<LyraPptxViewer>(html`<lr-pptx-viewer></lr-pptx-viewer>`);
      const target = el.ownerDocument.createElement('div');
      el.parentElement!.append(target);
      // No viewer mounted yet.
      expect(await el.renderPageThumbnailToContainer(1, target)).to.be.false;

      el.loadRenderer = async () => fake.module;
      el.src = 'https://example.test/deck.pptx';
      await oneEvent(el, 'lr-load');

      expect(await el.renderPageThumbnailToContainer(1.5, target)).to.be.false;
      expect(await el.renderPageThumbnailToContainer(3, target)).to.be.false; // beyond slideCount
      expect(await el.renderPageThumbnailToContainer(1, target, { width: 0 })).to.be.false;
      expect(await el.renderPageThumbnailToContainer(1, target, { width: -10 })).to.be.false;
      expect(fake.calls.renderThumbnail).to.equal(0);
    } finally {
      restore();
    }
  });

  it('returns false when the renderer declines to hand back a thumbnail handle', async () => {
    const fake = fakeModule(2);
    fake.viewer.renderThumbnailToContainer = () => false as unknown as ReturnType<typeof fake.viewer.renderThumbnailToContainer>;
    const restore = stubFetch();
    try {
      const el = await fixture<LyraPptxViewer>(html`<lr-pptx-viewer></lr-pptx-viewer>`);
      el.loadRenderer = async () => fake.module;
      el.src = 'https://example.test/deck.pptx';
      await oneEvent(el, 'lr-load');
      const target = el.ownerDocument.createElement('div');
      const committed = el.ownerDocument.createElement('span');
      committed.textContent = 'committed preview';
      target.append(committed);
      el.parentElement!.append(target);

      expect(await el.renderPageThumbnailToContainer(1, target)).to.be.false;
      expect(target.childNodes.length).to.equal(1);
      expect(target.firstChild === committed).to.be.true;
    } finally {
      restore();
    }
  });

  it('returns false and preserves prior content when thumbnail rendering throws synchronously', async () => {
    const fake = fakeModule(2);
    fake.viewer.renderThumbnailToContainer = () => {
      throw new Error('thumbnail render failed synchronously');
    };
    const restore = stubFetch();
    try {
      const el = await fixture<LyraPptxViewer>(html`<lr-pptx-viewer></lr-pptx-viewer>`);
      el.loadRenderer = async () => fake.module;
      el.src = 'https://example.test/deck.pptx';
      await oneEvent(el, 'lr-load');
      const target = el.ownerDocument.createElement('div');
      const committed = el.ownerDocument.createElement('span');
      committed.textContent = 'committed preview';
      target.append(committed);
      el.parentElement!.append(target);

      const outcome = await el.renderPageThumbnailToContainer(1, target).then(
        (value) => value,
        () => 'rejected' as const,
      );
      expect(outcome).to.equal(false);
      expect(target.childNodes.length).to.equal(1);
      expect(target.firstChild === committed).to.be.true;
    } finally {
      restore();
    }
  });

  it("disposes and returns false when a thumbnail's async setup rejects", async () => {
    const fake = fakeModule(2);
    let disposed = 0;
    fake.viewer.renderThumbnailToContainer = (_index, container) => {
      const preview = document.createElement('div');
      container.append(preview);
      return {
        ready: Promise.reject(new Error('thumbnail render failed')),
        dispose() {
          disposed++;
          preview.remove();
        },
      };
    };
    const restore = stubFetch();
    try {
      const el = await fixture<LyraPptxViewer>(html`<lr-pptx-viewer></lr-pptx-viewer>`);
      el.loadRenderer = async () => fake.module;
      el.src = 'https://example.test/deck.pptx';
      await oneEvent(el, 'lr-load');
      const target = el.ownerDocument.createElement('div');
      const committed = el.ownerDocument.createElement('span');
      committed.textContent = 'committed preview';
      target.append(committed);
      el.parentElement!.append(target);

      expect(await el.renderPageThumbnailToContainer(1, target)).to.be.false;
      expect(disposed).to.equal(1);
      expect(target.childNodes.length).to.equal(1);
      expect(target.firstChild === committed).to.be.true;
    } finally {
      restore();
    }
  });

  it('clamps out-of-range page assignments both before and after mount', async () => {
    const fake = fakeModule(3);
    const restore = stubFetch();
    try {
      const el = await fixture<LyraPptxViewer>(html`<lr-pptx-viewer></lr-pptx-viewer>`);
      el.page = 999;
      await el.updateComplete;
      expect(el.page).to.equal(1); // no slideCount yet -> clamps to the floor
      el.page = -5;
      await el.updateComplete;
      expect(el.page).to.equal(1);

      el.loadRenderer = async () => fake.module;
      el.src = 'https://example.test/deck.pptx';
      await oneEvent(el, 'lr-load');

      el.page = 999;
      await el.updateComplete;
      expect(el.page).to.equal(3); // clamps to the mounted slide count
    } finally {
      restore();
    }
  });

  it('rejects negative and out-of-range renderer-owned initial slide indices', async () => {
    const restore = stubFetch();
    try {
      for (const initialIndex of [-1, 2]) {
        const fake = fakeModule(2);
        fake.viewer.currentSlideIndex = initialIndex;
        const el = await fixture<LyraPptxViewer>(html`<lr-pptx-viewer></lr-pptx-viewer>`);
        el.loadRenderer = async () => fake.module;
        el.src = `https://example.test/deck-${initialIndex}.pptx`;
        await oneEvent(el, 'lr-load');

        expect(el.page, `initial index ${initialIndex}`).to.equal(1);
        expect(el.pageViewerSnapshot, `initial index ${initialIndex}`).to.deep.include({
          status: 'ready',
          page: 1,
          pageCount: 2,
        });
      }
    } finally {
      restore();
    }
  });

  it('re-runs the active search after an effective locale change', async () => {
    const matches: PptxTextSearchResult[] = [
      { slideIndex: 0, nodeId: 'n', matchStart: 0, matchEnd: 1, text: 'x' },
    ];
    const fake = fakeModule(2, matches);
    const restore = stubFetch();
    try {
      const el = await fixture<LyraPptxViewer>(html`<lr-pptx-viewer></lr-pptx-viewer>`);
      el.loadRenderer = async () => fake.module;
      el.src = 'https://example.test/deck.pptx';
      await oneEvent(el, 'lr-load');
      expect(await el.search('x')).to.equal(1);
      const searchesBefore = fake.calls.searchText;

      el.locale = 'fr';
      await waitUntil(() => fake.calls.searchText > searchesBefore);
      expect(fake.calls.searchText).to.equal(searchesBefore + 1);
    } finally {
      restore();
    }
  });

  it('fails closed and destroys the peer viewer when it does not expose the required capabilities', async () => {
    const restore = stubFetch();
    let destroyCalls = 0;
    try {
      const el = await fixture<LyraPptxViewer>(html`<lr-pptx-viewer></lr-pptx-viewer>`);
      el.loadRenderer = async () =>
        ({
          PptxViewer: {
            open: async () => ({
              // Missing goToSlide/searchText/etc. -> adaptPptxViewer() must reject this as null.
              slideCount: 2,
              currentSlideIndex: 0,
              destroy: () => {
                destroyCalls++;
              },
            }),
          },
          RECOMMENDED_ZIP_LIMITS: {},
        } as never);
      const listener = oneEvent(el, 'lr-render-error');
      el.src = 'https://example.test/deck.pptx';
      const event = (await listener) as CustomEvent<{ error: unknown }>;
      expect(event.detail.error).to.exist;
      await el.updateComplete;
      expect(el.shadowRoot!.querySelector('[part="error"]')!.textContent)
        .to.equal('Failed to render this presentation.');
      expect(destroyCalls).to.equal(1);
    } finally {
      restore();
    }
  });
});

describe("styling", () => {
  it("changes both rendered slide buttons under real pointer hover", async () => {
    const fake = fakeModule();
    const restore = stubFetch();
    try {
      const el = await fixture<LyraPptxViewer>(html`
        <lr-pptx-viewer
          style="--lr-color-brand-quiet: rgb(1, 2, 3)"
        ></lr-pptx-viewer>
      `);
      el.loadRenderer = async () => fake.module;
      const loaded = oneEvent(el, 'lr-load');
      el.src = 'https://example.test/deck.pptx';
      await loaded;

      for (const selector of [
        '[part="previous-button"]',
        '[part="next-button"]',
      ]) {
        const button = el.shadowRoot!.querySelector(selector) as HTMLElement;
        const resting = getComputedStyle(button).backgroundColor;
        const box = button.getBoundingClientRect();
        await resetMouse();
        await sendMouse({
          type: 'move',
          position: [
            Math.round(box.left + box.width / 2),
            Math.round(box.top + box.height / 2),
          ],
        });
        await waitUntil(
          () => getComputedStyle(button).backgroundColor !== resting,
          `${selector} never entered its rendered hover state`,
        );
        expect(getComputedStyle(button).backgroundColor).to.equal(
          'rgb(1, 2, 3)',
        );
      }
    } finally {
      await resetMouse();
      restore();
    }
  });

  it('mirrors slide-navigation chevrons when inherited direction changes', async () => {
    const fake = fakeModule();
    const restore = stubFetch();
    try {
      const wrapper = await fixture<HTMLDivElement>(html`
        <div dir="ltr"><lr-pptx-viewer></lr-pptx-viewer></div>
      `);
      const el = wrapper.querySelector('lr-pptx-viewer') as LyraPptxViewer;
      el.loadRenderer = async () => fake.module;
      el.src = 'https://example.test/deck.pptx';
      await oneEvent(el, 'lr-load');
      const previous = el.shadowRoot!.querySelector('[part="previous-icon"]') as HTMLElement;
      const next = el.shadowRoot!.querySelector('[part="next-icon"]') as HTMLElement;
      const horizontalScale = (icon: HTMLElement): number => {
        const transform = getComputedStyle(icon).transform;
        return transform === 'none' ? 1 : new DOMMatrix(transform).a;
      };

      expect(horizontalScale(previous)).to.be.closeTo(-1, 0.001);
      expect(horizontalScale(next)).to.be.closeTo(1, 0.001);
      wrapper.dir = 'rtl';
      await waitUntil(() => horizontalScale(previous) > 0.99 && horizontalScale(next) < -0.99);
      expect(horizontalScale(previous)).to.be.closeTo(1, 0.001);
      expect(horizontalScale(next)).to.be.closeTo(-1, 0.001);
    } finally {
      restore();
    }
  });
});

describe("PPTX registry", () => {
  it("forwards document anchors/highlights and advertises its text contracts", () => {
    const definition = getDefaultDocumentRendererRegistry().get(
      "application/vnd.openxmlformats-officedocument.presentationml.presentation"
    )!;
    const highlights: LyraHighlight[] = [
      { id: "h1", anchor: { kind: "text-quote", quote: "Ada" } },
    ];
    const anchor = { kind: "fragment" as const, id: "section-one" };
    const host = document.createElement("div");
    render(
      definition.render!({
        name: "deck.pptx",
        mimeType:
          "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        src: "https://example.test/deck.pptx",
        anchor,
        highlights,
      }) as never,
      host
    );
    const rendered = host.querySelector("lr-pptx-viewer") as LyraPptxViewer;
    expect(rendered.anchor).to.deep.equal(anchor);
    expect(rendered.highlights).to.deep.equal(highlights);
    expect(definition.capabilities).to.deep.equal({
      anchors: ["text-quote", "fragment"],
      search: true,
      textSelect: true,
    });
  });
});

// -- Document-renderer registry entry ---------------------------------------

it("registers a application/vnd.openxmlformats-officedocument.presentationml.presentation renderer whose matches() and render() behave as declared", async () => {
  const { getDefaultDocumentRendererRegistry } = await import(
    "../document-viewer/registry.js"
  );
  const def = getDefaultDocumentRendererRegistry().get(
    "application/vnd.openxmlformats-officedocument.presentationml.presentation"
  );
  expect(def, "importing the module registers the renderer").to.exist;
  expect(
    def!.matches!({
      name: "Deck.PPTX",
      mimeType:
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      src: "https://example.test/f",
    }),
    "Deck.PPTX"
  ).to.be.true;
  expect(
    def!.matches!({
      name: "deck.pdf",
      mimeType: "application/pdf",
      src: "https://example.test/f",
    }),
    "deck.pdf"
  ).to.be.false;
  expect(
    def!.capabilities,
    "capabilities are declared for host feature-detection"
  ).to.exist;

  const host = (await fixture(
    html`<div>
      ${def!.render!({
        name: "Deck.PPTX",
        mimeType:
          "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        src: "https://example.test/f",
      })}
    </div>`
  )) as HTMLElement;
  expect(
    host.querySelector("lr-pptx-viewer"),
    "render() produces the viewer element"
  ).to.exist;
});

it("validates maxHeight before assigning the base custom property", async () => {
  const el = await fixture<LyraPptxViewer>(
    html`<lr-pptx-viewer></lr-pptx-viewer>`
  );
  el.maxHeight = "10rem;position:fixed";
  await el.updateComplete;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  expect(base.style.position).to.equal("");
  expect(base.style.getPropertyValue("--lr-pptx-viewer-max-height")).to.equal(
    ""
  );
  el.maxHeight = "calc(10rem + 2px)";
  await el.updateComplete;
  expect(base.style.getPropertyValue("--lr-pptx-viewer-max-height")).to.equal(
    "calc(10rem + 2px)"
  );
});
