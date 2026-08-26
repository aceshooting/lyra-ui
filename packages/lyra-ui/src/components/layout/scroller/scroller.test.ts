import { expect, fixture, html, waitUntil } from "@open-wc/testing";
import "./scroller.js";
import type { LyraScroller } from "./scroller.class.js";
import {
  hoverUntilMatched,
  resetMouse,
} from "../../../../test/wtr-mouse.js";

/** `lr-scroll` and the edge recompute are coalesced through one `requestAnimationFrame` tick, so a
 *  synthetic `scroll` dispatch settles a frame later rather than synchronously. */
const nextFrame = (): Promise<void> =>
  new Promise((resolve) => requestAnimationFrame(() => resolve()));

describe("<lr-scroller>", () => {
  it("defaults the upstream without-* flags to false", async () => {
    const el = await fixture<LyraScroller>(
      html`<lr-scroller label="Items"><span>Content</span></lr-scroller>`
    );
    expect(el.orientation).to.equal("horizontal");
    expect(el.withoutScrollbar).to.be.false;
    expect(el.withoutShadow).to.be.false;
    expect("hideScrollbar" in el).to.be.false;
  });

  it("renders logical start/end shadow parts only where more content exists", async () => {
    const el = await fixture<LyraScroller>(html`
      <lr-scroller label="Items" style="inline-size: 100px;">
        <div style="inline-size: 500px;">wide content</div>
      </lr-scroller>
    `);
    const start = el.shadowRoot!.querySelector('[part="start-shadow"]') as HTMLElement;
    const end = el.shadowRoot!.querySelector('[part="end-shadow"]') as HTMLElement;
    await waitUntil(() => start.hidden && !end.hidden, "edge shadows did not settle");
    expect(start.getAttribute("aria-hidden")).to.equal("true");
    expect(end.getAttribute("aria-hidden")).to.equal("true");

    const viewport = el.shadowRoot!.querySelector('[part="viewport"]') as HTMLElement;
    Object.defineProperty(viewport, "scrollLeft", {
      configurable: true,
      value: 20,
      writable: true,
    });
    viewport.dispatchEvent(new Event("scroll"));
    await nextFrame();
    await el.updateComplete;
    expect(start.hidden).to.be.false;
    expect(end.hidden).to.be.false;
  });

  it("creates a real vertical scrollport from the host block allocation", async () => {
    const el = await fixture<LyraScroller>(html`
      <lr-scroller
        controls
        orientation="vertical"
        label="Tall items"
        style="block-size:100px"
      >
        <div style="block-size:400px">tall content</div>
      </lr-scroller>
    `);
    const viewport = el.shadowRoot!.querySelector('[part="viewport"]') as HTMLElement;
    const next = el.shadowRoot!.querySelector('[part~="next"]') as HTMLButtonElement;
    await waitUntil(
      () => viewport.scrollHeight > viewport.clientHeight,
      "vertical viewport never overflowed"
    );
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    expect(base.getBoundingClientRect().height).to.be.closeTo(100, 2);
    expect(viewport.clientHeight).to.be.greaterThan(0);
    expect(viewport.clientHeight).to.be.at.most(100);
    expect(viewport.scrollHeight).to.be.greaterThan(viewport.clientHeight);
    expect(next.disabled).to.be.false;
  });

  it("honors a max-block-size vertical allocation with long content", async () => {
    const el = await fixture<LyraScroller>(html`
      <lr-scroller
        controls
        orientation="vertical"
        label="Recent events"
        style="max-block-size:12rem"
      >
        ${Array.from({ length: 24 }, (_, index) => html`<span>Event ${index + 1}</span>`)}
      </lr-scroller>
    `);
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    const viewport = el.shadowRoot!.querySelector('[part="viewport"]') as HTMLElement;
    const next = el.shadowRoot!.querySelector('[part~="next"]') as HTMLButtonElement;
    await waitUntil(
      () => viewport.scrollHeight > viewport.clientHeight,
      "max-sized vertical viewport never overflowed"
    );
    expect(base.getBoundingClientRect().height).to.be.closeTo(el.getBoundingClientRect().height, 2);
    const rootFontSize = Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
    expect(el.getBoundingClientRect().height).to.be.at.most(12 * rootFontSize + 2);
    expect(next.disabled).to.be.false;
  });

  it("without-shadow removes both cues without disabling native scrolling", async () => {
    const el = await fixture<LyraScroller>(html`
      <lr-scroller without-shadow label="Items" style="inline-size: 100px;">
        <div style="inline-size: 500px;">wide content</div>
      </lr-scroller>
    `);
    const shadows = [...el.shadowRoot!.querySelectorAll<HTMLElement>('[part$="shadow"]')];
    expect(shadows).to.have.length(2);
    expect(shadows.every((shadow) => shadow.hidden)).to.be.true;
    expect(getComputedStyle(el.shadowRoot!.querySelector('[part="viewport"]')!).overflowX).to.equal(
      "auto"
    );
  });

  it("uses the canonical without-scrollbar opt-out", async () => {
    const el = await fixture<LyraScroller>(
      html`<lr-scroller label="Items" without-scrollbar><span>Content</span></lr-scroller>`
    );
    const viewport = el.shadowRoot!.querySelector('[part="viewport"]') as HTMLElement;
    expect(getComputedStyle(viewport).scrollbarWidth).to.equal("none");
  });

  it("keeps controls and edge cues inert until the first trustworthy measurement", async () => {
    const el = document.createElement("lr-scroller") as LyraScroller;
    el.controls = true;
    Object.assign(el as unknown as Record<string, unknown>, {
      armResizeObserver: () => undefined,
      scheduleEdgeUpdate: () => undefined,
    });
    document.body.append(el);
    try {
      await el.updateComplete;
      const previous = el.shadowRoot!.querySelector('[part~="previous"]') as HTMLButtonElement;
      const next = el.shadowRoot!.querySelector('[part~="next"]') as HTMLButtonElement;
      const start = el.shadowRoot!.querySelector('[part="start-shadow"]') as HTMLElement;
      const end = el.shadowRoot!.querySelector('[part="end-shadow"]') as HTMLElement;
      expect(previous.disabled).to.be.true;
      expect(next.disabled).to.be.true;
      expect(start.hidden).to.be.true;
      expect(end.hidden).to.be.true;
    } finally {
      el.remove();
    }
  });

  it("observes the slotted content wrapper so intrinsic-size-only changes refresh edges", async () => {
    const OriginalResizeObserver = window.ResizeObserver;
    let callback: ResizeObserverCallback | undefined;
    const observed = new Set<Element>();
    class TestResizeObserver implements ResizeObserver {
      constructor(next: ResizeObserverCallback) { callback = next; }
      observe(target: Element): void { observed.add(target); }
      unobserve(target: Element): void { observed.delete(target); }
      disconnect(): void { observed.clear(); }
    }
    window.ResizeObserver = TestResizeObserver;
    try {
      const el = await fixture<LyraScroller>(html`
        <lr-scroller controls><span>Content</span></lr-scroller>
      `);
      const content = el.shadowRoot!.querySelector('[part="content"]') as HTMLElement;
      const viewport = el.shadowRoot!.querySelector('[part="viewport"]') as HTMLElement;
      const next = el.shadowRoot!.querySelector('[part~="next"]') as HTMLButtonElement;
      expect(observed.has(content), "content wrapper is a resize target").to.be.true;

      Object.defineProperty(viewport, "clientWidth", { configurable: true, value: 100 });
      Object.defineProperty(viewport, "scrollWidth", { configurable: true, value: 300 });
      callback?.([], {} as ResizeObserver);
      await el.updateComplete;
      expect(next.disabled).to.be.false;

      let staleEvents = 0;
      el.addEventListener('lr-scroll', () => staleEvents += 1);
      el.remove();
      callback?.([], {} as ResizeObserver);
      await Promise.resolve();
      expect(staleEvents).to.equal(0);
    } finally {
      window.ResizeObserver = OriginalResizeObserver;
    }
  });

  it("consumes --shadow-size and --shadow-color on the rendered cue", async () => {
    const el = await fixture<LyraScroller>(html`
      <lr-scroller
        label="Items"
        style="inline-size: 100px; --shadow-size: 17px; --shadow-color: rgb(1, 2, 3)"
      >
        <div style="inline-size: 500px;">wide content</div>
      </lr-scroller>
    `);
    const end = el.shadowRoot!.querySelector('[part="end-shadow"]') as HTMLElement;
    await waitUntil(() => !end.hidden, "end shadow did not appear");
    const computed = getComputedStyle(end);
    expect(computed.width).to.equal("17px");
    expect(computed.backgroundImage).to.include("rgb(1, 2, 3)");
  });

  it("prefers --lr-scroller-shadow-size/--lr-scroller-shadow-color over the unprefixed upstream aliases", async () => {
    const el = await fixture<LyraScroller>(html`
      <lr-scroller
        label="Items"
        style="inline-size: 100px; --shadow-size: 17px; --shadow-color: rgb(1, 2, 3); --lr-scroller-shadow-size: 9px; --lr-scroller-shadow-color: rgb(9, 8, 7)"
      >
        <div style="inline-size: 500px;">wide content</div>
      </lr-scroller>
    `);
    const end = el.shadowRoot!.querySelector('[part="end-shadow"]') as HTMLElement;
    await waitUntil(() => !end.hidden, "end shadow did not appear");
    const computed = getComputedStyle(end);
    expect(computed.width).to.equal("9px");
    expect(computed.backgroundImage).to.include("rgb(9, 8, 7)");
  });

  it("reports scroll edges correctly at rest under RTL (CSSOM negative-scrollLeft convention)", async () => {
    const el = await fixture<LyraScroller>(html`
      <lr-scroller controls dir="rtl" style="inline-size: 100px;">
        <div style="inline-size: 400px;">wide content</div>
      </lr-scroller>
    `);
    const previous = el.shadowRoot!.querySelector(
      '[part~="previous"]'
    ) as HTMLButtonElement;
    const next = el.shadowRoot!.querySelector(
      '[part~="next"]'
    ) as HTMLButtonElement;
    // At rest (scrollLeft === 0), the start (previous) edge has nothing to scroll back to, and the
    // end (next) edge still has the rest of the overflowing content ahead.
    await waitUntil(
      () => previous.disabled === true,
      "previous never disabled at rest"
    );
    expect(next.disabled).to.be.false;
  });

  it("re-observes size changes after being moved in the DOM", async () => {
    const el = await fixture<LyraScroller>(
      html`<lr-scroller><span>Content</span></lr-scroller>`
    );
    const parent = el.parentElement!;
    expect(
      (el as unknown as { resizeObserver?: ResizeObserver }).resizeObserver
    ).to.exist;

    el.remove();
    expect(
      (el as unknown as { resizeObserver?: ResizeObserver }).resizeObserver
    ).to.be.undefined;
    parent.append(el);

    expect(
      (el as unknown as { resizeObserver?: ResizeObserver }).resizeObserver
    ).to.exist;
  });

  it("renders a labeled native scroll viewport", async () => {
    const el = await fixture<LyraScroller>(
      html`<lr-scroller label="Recent items"><span>Content</span></lr-scroller>`
    );
    // The role and accessible name live on [part="viewport"] — the element that
    // actually scrolls and carries tabindex="0" — so the keyboard tab stop is a
    // named region (same placement as lr-terminal's scrollable viewport), not
    // an unnamed focusable inside a labeled wrapper.
    const viewport = el.shadowRoot!.querySelector('[part="viewport"]')!;
    expect(viewport.getAttribute("role")).to.equal("region");
    expect(viewport.getAttribute("aria-label")).to.equal("Recent items");
    expect(viewport.getAttribute("tabindex")).to.equal("0");
    const base = el.shadowRoot!.querySelector('[part="base"]')!;
    expect(base.hasAttribute("role")).to.be.false;
  });

  it("gives a host aria-label precedence over label and preserves it across late changes", async () => {
    const el = await fixture<LyraScroller>(
      html`<lr-scroller label="Property label"><span>Content</span></lr-scroller>`
    );
    const viewport = () => el.shadowRoot!.querySelector('[part="viewport"]')!;

    expect(viewport().getAttribute("aria-label")).to.equal("Property label");

    el.setAttribute("aria-label", "Host label");
    await el.updateComplete;
    expect(viewport().getAttribute("aria-label")).to.equal("Host label");

    el.setAttribute("aria-label", "");
    await el.updateComplete;
    expect(viewport().getAttribute("aria-label")).to.equal("");

    el.removeAttribute("aria-label");
    await el.updateComplete;
    expect(viewport().getAttribute("aria-label")).to.equal("Property label");

    el.label = "";
    await el.updateComplete;
    expect(viewport().getAttribute("aria-label")).to.equal("Scrollable content");
  });

  it("supports optional navigation controls", async () => {
    const el = await fixture<LyraScroller>(
      html`<lr-scroller controls><span>Content</span></lr-scroller>`
    );
    expect(el.shadowRoot!.querySelector('[part~="previous"]')).to.exist;
    expect(el.shadowRoot!.querySelector('[part~="next"]')).to.exist;
  });

  it("wraps the horizontal chevrons in documented previous-glyph/next-glyph parts", async () => {
    const el = await fixture<LyraScroller>(
      html`<lr-scroller controls><span>Content</span></lr-scroller>`
    );
    const previousGlyph = el.shadowRoot!.querySelector(
      '[part="previous-glyph"]'
    )!;
    const nextGlyph = el.shadowRoot!.querySelector('[part="next-glyph"]')!;
    expect((previousGlyph) != null).to.equal(true);
    expect(previousGlyph.getAttribute("aria-hidden")).to.equal("true");
    expect(previousGlyph.textContent).to.equal("‹");
    expect((nextGlyph) != null).to.equal(true);
    expect(nextGlyph.getAttribute("aria-hidden")).to.equal("true");
    expect(nextGlyph.textContent).to.equal("›");
  });

  it("wraps the vertical-orientation glyphs in the same previous-glyph/next-glyph parts as horizontal, not bare text", async () => {
    const el = await fixture<LyraScroller>(
      html`<lr-scroller controls orientation="vertical"
        ><span>Content</span></lr-scroller
      >`
    );
    const previousGlyph = el.shadowRoot!.querySelector(
      '[part="previous-glyph"]'
    )!;
    const nextGlyph = el.shadowRoot!.querySelector('[part="next-glyph"]')!;
    expect((previousGlyph) != null).to.equal(true);
    expect(previousGlyph.getAttribute("aria-hidden")).to.equal("true");
    expect(previousGlyph.textContent).to.equal("↑");
    expect((nextGlyph) != null).to.equal(true);
    expect(nextGlyph.getAttribute("aria-hidden")).to.equal("true");
    expect(nextGlyph.textContent).to.equal("↓");
  });

  it("honors a strings override for scrollerLabel/scrollPrevious/scrollNext", async () => {
    const el = await fixture<LyraScroller>(html`
      <lr-scroller
        controls
        .strings=${{
          scrollerLabel: "Contenu défilable",
          scrollPrevious: "Défiler vers l’arrière",
          scrollNext: "Défiler vers l’avant",
        }}
      >
        <span>Content</span>
      </lr-scroller>
    `);
    const viewport = el.shadowRoot!.querySelector('[part="viewport"]')!;
    const previous = el.shadowRoot!.querySelector('[part~="previous"]')!;
    const next = el.shadowRoot!.querySelector('[part~="next"]')!;
    expect(viewport.getAttribute("aria-label")).to.equal("Contenu défilable");
    expect(previous.getAttribute("aria-label")).to.equal(
      "Défiler vers l’arrière"
    );
    expect(next.getAttribute("aria-label")).to.equal("Défiler vers l’avant");
  });

  it("gives the previous/next controls the shared minimum hit area", async () => {
    const el = await fixture<LyraScroller>(
      html`<lr-scroller controls><span>Content</span></lr-scroller>`
    );
    const previous = el.shadowRoot!.querySelector(
      '[part~="previous"]'
    ) as HTMLElement;
    const next = el.shadowRoot!.querySelector('[part~="next"]') as HTMLElement;

    expect(getComputedStyle(previous).minInlineSize).to.equal("40px");
    expect(getComputedStyle(previous).minBlockSize).to.equal("40px");
    expect(getComputedStyle(next).minInlineSize).to.equal("40px");
    expect(getComputedStyle(next).minBlockSize).to.equal("40px");
  });

  it("is accessible", async () => {
    const el = await fixture<LyraScroller>(
      html`<lr-scroller label="Recent items"><span>Content</span></lr-scroller>`
    );
    await expect(el).to.be.accessible();
  });

  // -- numeric guard regressions (scrollStep) --

  it("falls back to the viewport-percentage default instead of scrolling by NaN/Infinity when scrollStep is invalid", async () => {
    const el = await fixture<LyraScroller>(html`
      <lr-scroller controls style="inline-size: 100px;">
        <div style="inline-size: 400px;">wide content</div>
      </lr-scroller>
    `);
    const viewport = el.shadowRoot!.querySelector(
      '[part="viewport"]'
    ) as HTMLElement;
    const scrollBySpy: number[] = [];
    viewport.scrollBy = ((opts: ScrollToOptions) => {
      scrollBySpy.push(opts.left ?? 0);
    }) as typeof viewport.scrollBy;

    for (const scrollStep of [NaN, Infinity, -50]) {
      (el as unknown as { scrollStep: number }).scrollStep = scrollStep;
      const next = el.shadowRoot!.querySelector(
        '[part~="next"]'
      ) as HTMLButtonElement;
      next.click();
    }

    // Every call must fall through to the finite viewport-percentage default (80px for a 100px-wide
    // viewport) -- never a NaN/Infinity/negative `left` reaching the real scrollBy().
    expect(scrollBySpy).to.have.lengthOf(3);
    for (const left of scrollBySpy) {
      expect(Number.isFinite(left), String(left)).to.be.true;
      expect(left).to.be.greaterThan(0);
    }
  });

  it("honors a valid positive scrollStep as an explicit override amount", async () => {
    const el = await fixture<LyraScroller>(html`
      <lr-scroller controls scroll-step="42" style="inline-size: 100px;">
        <div style="inline-size: 400px;">wide content</div>
      </lr-scroller>
    `);
    const viewport = el.shadowRoot!.querySelector(
      '[part="viewport"]'
    ) as HTMLElement;
    let capturedLeft: number | undefined;
    viewport.scrollBy = ((opts: ScrollToOptions) => {
      capturedLeft = opts.left;
    }) as typeof viewport.scrollBy;

    const next = el.shadowRoot!.querySelector(
      '[part~="next"]'
    ) as HTMLButtonElement;
    next.click();

    expect(capturedLeft).to.equal(42);
  });

  it("mirrors one-step previous/next controls under RTL", async () => {
    const el = await fixture<LyraScroller>(html`
      <lr-scroller controls dir="rtl" scroll-step="42" style="inline-size: 100px;">
        <div style="inline-size: 400px;">wide content</div>
      </lr-scroller>
    `);
    const viewport = el.shadowRoot!.querySelector(
      '[part="viewport"]'
    ) as HTMLElement;
    Object.defineProperty(viewport, "scrollWidth", {
      configurable: true,
      value: 400,
    });
    Object.defineProperty(viewport, "clientWidth", {
      configurable: true,
      value: 100,
    });
    Object.defineProperty(viewport, "scrollLeft", {
      configurable: true,
      value: -20,
      writable: true,
    });
    viewport.dispatchEvent(new Event("scroll"));
    await nextFrame();
    await el.updateComplete;
    const calls: ScrollToOptions[] = [];
    viewport.scrollBy = ((options: ScrollToOptions) => {
      calls.push(options);
    }) as typeof viewport.scrollBy;

    (el.shadowRoot!.querySelector('[part~="next"]') as HTMLButtonElement).click();
    (el.shadowRoot!.querySelector('[part~="previous"]') as HTMLButtonElement).click();

    expect(calls).to.deep.equal([{ left: -42 }, { left: 42 }]);
  });

  it("moves and jumps controls along the block axis for a vertical scroller", async () => {
    const el = await fixture<LyraScroller>(html`
      <lr-scroller
        controls
        orientation="vertical"
        scroll-step="42"
        style="block-size: 100px;"
      >
        <div style="block-size: 400px;">tall content</div>
      </lr-scroller>
    `);
    const viewport = el.shadowRoot!.querySelector(
      '[part="viewport"]'
    ) as HTMLElement;
    Object.defineProperty(viewport, "scrollHeight", {
      configurable: true,
      value: 400,
    });
    Object.defineProperty(viewport, "clientHeight", {
      configurable: true,
      value: 100,
    });
    Object.defineProperty(viewport, "scrollTop", {
      configurable: true,
      value: 50,
      writable: true,
    });
    viewport.dispatchEvent(new Event("scroll"));
    await nextFrame();
    await el.updateComplete;
    const moveCalls: ScrollToOptions[] = [];
    const edgeCalls: ScrollToOptions[] = [];
    viewport.scrollBy = ((options: ScrollToOptions) => {
      moveCalls.push(options);
    }) as typeof viewport.scrollBy;
    viewport.scrollTo = ((options: ScrollToOptions) => {
      edgeCalls.push(options);
    }) as typeof viewport.scrollTo;
    const previous = el.shadowRoot!.querySelector(
      '[part~="previous"]'
    ) as HTMLButtonElement;
    const next = el.shadowRoot!.querySelector(
      '[part~="next"]'
    ) as HTMLButtonElement;

    next.click();
    previous.click();
    next.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
    previous.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));

    expect(moveCalls).to.deep.equal([{ top: 42 }, { top: -42 }]);
    expect(edgeCalls).to.deep.equal([{ top: viewport.scrollHeight }, { top: 0 }]);
  });

  it('uses eighty percent of block allocation as the default vertical step', async () => {
    const el = await fixture<LyraScroller>(html`
      <lr-scroller controls orientation="vertical">
        <div>tall content</div>
      </lr-scroller>
    `);
    const viewport = el.shadowRoot!.querySelector<HTMLElement>('[part="viewport"]')!;
    Object.defineProperty(viewport, 'clientHeight', { configurable: true, value: 100 });
    Object.defineProperty(viewport, 'scrollHeight', { configurable: true, value: 400 });
    Object.defineProperty(viewport, 'scrollTop', { configurable: true, value: 50, writable: true });
    viewport.dispatchEvent(new Event('scroll'));
    await nextFrame();
    await el.updateComplete;
    const calls: ScrollToOptions[] = [];
    viewport.scrollBy = ((options: ScrollToOptions) => calls.push(options)) as typeof viewport.scrollBy;

    el.shadowRoot!.querySelector<HTMLButtonElement>('[part~="next"]')!.click();
    el.shadowRoot!.querySelector<HTMLButtonElement>('[part~="previous"]')!.click();

    expect(calls).to.deep.equal([{ top: 80 }, { top: -80 }]);
  });

  // Asserted against rendered paint, not against styles.cssText: a stylesheet-text match proves
  // only that a rule was authored, never that it reaches the element or survives specificity.
  it("gives control a rendered hover fill", async function () {
    this.timeout(10000);
    const el = await fixture<LyraScroller>(html`
      <lr-scroller
        controls
        label="Items"
        style="inline-size: 200px; --lr-color-brand-quiet: rgb(1, 2, 3)"
      >
        <div style="inline-size: 800px">wide content</div>
      </lr-scroller>
    `);
    await el.updateComplete;
    const next = el.shadowRoot!.querySelector<HTMLButtonElement>(
      '[part~="next"]'
    )!;
    await waitUntil(
      () => !next.disabled,
      "the next control never became enabled after edge measurement"
    );
    expect(next.disabled, "the next control must be enabled to be hoverable").to
      .be.false;
    expect(getComputedStyle(next).backgroundColor).to.not.equal("rgb(1, 2, 3)");
    try {
      await hoverUntilMatched(
        next,
        "the scroller control never registered :hover"
      );
      await waitUntil(
        () => getComputedStyle(next).backgroundColor === "rgb(1, 2, 3)",
        "the control hover fill never rendered",
        { timeout: 2000 }
      );
    } finally {
      await resetMouse();
    }
  });

  it("gives the keyboard-focusable viewport a rendered hover affordance", async function () {
    this.timeout(10000);
    const el = await fixture<LyraScroller>(html`
      <lr-scroller
        label="Items"
        style="inline-size: 200px; --lr-color-border: rgb(4, 5, 6)"
      >
        <div style="inline-size: 800px">wide content</div>
      </lr-scroller>
    `);
    await el.updateComplete;
    const viewport = el.shadowRoot!.querySelector<HTMLElement>(
      '[part="viewport"]'
    )!;
    expect(getComputedStyle(viewport).outlineStyle).to.equal("none");
    try {
      await hoverUntilMatched(
        viewport,
        "the scroller viewport never registered :hover"
      );
      await waitUntil(
        () => getComputedStyle(viewport).outlineStyle === "solid",
        "the viewport hover outline never rendered",
        { timeout: 2000 }
      );
      expect(getComputedStyle(viewport).outlineColor).to.equal("rgb(4, 5, 6)");
    } finally {
      await resetMouse();
    }
  });

  it("emits lr-scroll for ordinary movement even when neither edge state changes", async () => {
    const el = await fixture<LyraScroller>(html`
      <lr-scroller label="Items" style="inline-size: 100px;">
        <div style="inline-size: 500px;">wide content</div>
      </lr-scroller>
    `);
    const viewport = el.shadowRoot!.querySelector(
      '[part="viewport"]'
    ) as HTMLElement;
    Object.defineProperty(viewport, "scrollWidth", {
      configurable: true,
      value: 500,
    });
    Object.defineProperty(viewport, "clientWidth", {
      configurable: true,
      value: 100,
    });
    const details: Array<{
      scrollLeft: number;
      scrollStart: boolean;
      scrollEnd: boolean;
    }> = [];
    el.addEventListener("lr-scroll", (event) => {
      details.push(
        (
          event as CustomEvent<{
            scrollLeft: number;
            scrollStart: boolean;
            scrollEnd: boolean;
          }>
        ).detail
      );
    });

    Object.defineProperty(viewport, "scrollLeft", {
      configurable: true,
      value: 20,
      writable: true,
    });
    viewport.dispatchEvent(new Event("scroll"));
    await nextFrame();
    viewport.scrollLeft = 30;
    viewport.dispatchEvent(new Event("scroll"));
    await nextFrame();

    expect(details).to.have.length(2);
    expect(details.map((detail) => detail.scrollLeft)).to.deep.equal([20, 30]);
    expect(details.every((detail) => !detail.scrollStart && !detail.scrollEnd))
      .to.be.true;
  });

  it("coalesces a burst of native scroll events into one lr-scroll per animation frame", async () => {
    const el = await fixture<LyraScroller>(html`
      <lr-scroller label="Items" style="inline-size: 100px;">
        <div style="inline-size: 500px;">wide content</div>
      </lr-scroller>
    `);
    const viewport = el.shadowRoot!.querySelector(
      '[part="viewport"]'
    ) as HTMLElement;
    Object.defineProperty(viewport, "scrollWidth", { configurable: true, value: 500 });
    Object.defineProperty(viewport, "clientWidth", { configurable: true, value: 100 });
    Object.defineProperty(viewport, "scrollLeft", {
      configurable: true,
      value: 20,
      writable: true,
    });
    // Settle away from both edges first, so the burst below can only produce position-change
    // emissions -- an edge-state transition emits on its own, independently of this coalescing.
    viewport.dispatchEvent(new Event("scroll"));
    await nextFrame();
    await el.updateComplete;
    await nextFrame();

    const positions: number[] = [];
    el.addEventListener("lr-scroll", (event) => {
      positions.push((event as CustomEvent<{ scrollLeft: number }>).detail.scrollLeft);
    });

    // One fling: a dozen native scroll ticks inside a single frame. Uncoalesced this emitted a
    // dozen CustomEvents (and did a dozen scrollWidth/clientWidth layout reads); lr-virtual-list's
    // identically-named lr-scroll already contracts at most one per frame.
    for (let step = 1; step <= 12; step += 1) {
      viewport.scrollLeft = 20 + step * 5;
      viewport.dispatchEvent(new Event("scroll"));
    }
    expect(positions, "nothing is emitted before the frame boundary").to.have.length(0);
    await nextFrame();
    expect(positions).to.deep.equal([80]);

    // A later, separate frame still reports.
    viewport.scrollLeft = 100;
    viewport.dispatchEvent(new Event("scroll"));
    await nextFrame();
    expect(positions).to.deep.equal([80, 100]);
  });
});

it("constructs its resize observer in the adopted owner realm and disconnects it on adoption", async () => {
  const el = await fixture<LyraScroller>(html`<lr-scroller>content</lr-scroller>`);
  await el.updateComplete;
  el.remove();
  const frame = document.createElement("iframe");
  document.body.append(frame);
  const frameDocument = frame.contentDocument;
  const frameWindow = frame.contentWindow;
  if (!frameDocument || !frameWindow) {
    frame.remove();
    throw new Error("The iframe realm was unavailable.");
  }
  const originalResizeObserver = frameWindow.ResizeObserver;
  let constructions = 0;
  let disconnects = 0;
  class OwnerResizeObserver implements ResizeObserver {
    constructor(_callback: ResizeObserverCallback) { constructions += 1; }
    observe(): void {}
    unobserve(): void {}
    disconnect(): void { disconnects += 1; }
  }
  frameWindow.ResizeObserver = OwnerResizeObserver;

  try {
    frameDocument.body.append(frameDocument.adoptNode(el));
    await el.updateComplete;
    expect(constructions, "the destination window constructs the observer").to.equal(1);
    document.adoptNode(el);
    expect(disconnects, "adoption tears down the old owner observer").to.equal(1);
  } finally {
    frameWindow.ResizeObserver = originalResizeObserver;
    if (el.ownerDocument !== document) document.adoptNode(el);
    el.remove();
    frame.remove();
  }
});

describe("double-click jumps to an edge", () => {
  const viewportOf = (el: LyraScroller): HTMLElement =>
    el.shadowRoot!.querySelector('[part~="viewport"]') as HTMLElement;
  const controlOf = (el: LyraScroller, which: "previous" | "next"): HTMLElement =>
    el.shadowRoot!.querySelector(`[part~="${which}"]`) as HTMLElement;

  /** The viewport sets `scroll-behavior: smooth`, so an edge jump animates across several frames
   *  and does not necessarily move on the very first one. Wait for the position to hold steady
   *  across several consecutive frames rather than accepting the first repeat (which would just
   *  observe the pre-animation value twice). */
  const settled = async (read: () => number): Promise<number> => {
    let previous = Number.NaN;
    let stable = 0;
    for (let i = 0; i < 180; i++) {
      await new Promise((r) => requestAnimationFrame(() => r(null)));
      const current = read();
      stable = current === previous ? stable + 1 : 0;
      if (stable >= 8) return current;
      previous = current;
    }
    return read();
  };

  it("jumps to the far end and back in a horizontal LTR scroller", async () => {
    const el = await fixture<LyraScroller>(html`
      <lr-scroller controls orientation="horizontal" style="inline-size: 100px;">
        <div style="inline-size: 800px;">wide content</div>
      </lr-scroller>
    `);
    await el.updateComplete;
    const viewport = viewportOf(el);
    const max = viewport.scrollWidth - viewport.clientWidth;
    expect(max, "the fixture must actually overflow").to.be.greaterThan(0);

    controlOf(el, "next").dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
    expect(Math.round(await settled(() => viewport.scrollLeft))).to.equal(Math.round(max));

    controlOf(el, "previous").dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
    expect(Math.round(await settled(() => viewport.scrollLeft))).to.equal(0);
  });

  it("mirrors the end edge under RTL, where the far end is a negative scrollLeft", async () => {
    const el = await fixture<LyraScroller>(html`
      <lr-scroller controls dir="rtl" orientation="horizontal" style="inline-size: 100px;">
        <div style="inline-size: 800px;">wide content</div>
      </lr-scroller>
    `);
    await el.updateComplete;
    const viewport = viewportOf(el);
    controlOf(el, "next").dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
    const end = await settled(() => viewport.scrollLeft);
    expect(end, "RTL scrolls away from zero in the negative direction").to.be.lessThan(0);

    controlOf(el, "previous").dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
    expect(Math.round(await settled(() => viewport.scrollLeft))).to.equal(0);
  });

  it("keeps controls inside exact 320px LTR and RTL allocations while the long row scrolls in its viewport", async () => {
    for (const direction of ["ltr", "rtl"] as const) {
      const wrapper = await fixture<HTMLElement>(html`
        <div dir=${direction} style="inline-size: 320px; max-inline-size: 100%;">
          <lr-scroller controls label="Project cards" style="inline-size: 100%;">
            <span>InternationalizedScrollerCardWithoutAnyNaturalBreakOpportunity</span>
            <span>InternationalizedSecondaryScrollerCardWithoutAnyNaturalBreakOpportunity</span>
          </lr-scroller>
        </div>
      `);
      const el = wrapper.querySelector("lr-scroller") as LyraScroller;
      await el.updateComplete;
      const base = el.shadowRoot!.querySelector<HTMLElement>('[part="base"]')!;
      const viewport = viewportOf(el);
      const previous = controlOf(el, "previous");
      const next = controlOf(el, "next");
      const baseRect = base.getBoundingClientRect();

      expect(wrapper.scrollWidth).to.be.at.most(wrapper.clientWidth + 1);
      expect(base.scrollWidth).to.be.at.most(base.clientWidth + 1);
      expect(viewport.scrollWidth).to.be.greaterThan(viewport.clientWidth);
      expect(previous.getBoundingClientRect().left).to.be.at.least(baseRect.left - 1);
      expect(next.getBoundingClientRect().right).to.be.at.most(baseRect.right + 1);
      expect(getComputedStyle(base).direction).to.equal(direction);
    }
  });

});
