import { expect, fixture, html, oneEvent } from "@open-wc/testing";
import "./carousel.js";
import "./carousel-item.js";
import type { LyraCarousel } from "./carousel.js";
import { styles } from "./carousel.styles.js";
import { ANNOUNCEMENT_SINK_ATTRIBUTE } from "../../../internal/announcer.js";

async function carousel(
  template = html`
    <lr-carousel navigation pagination>
      <div>One</div>
      <div>Two</div>
      <div>Three</div>
    </lr-carousel>
  `
): Promise<LyraCarousel> {
  const el = (await fixture(template)) as LyraCarousel;
  await el.updateComplete;
  return el;
}

describe("Web Awesome carousel surface", () => {
  it("uses the mapped defaults and keeps the Lyra aliases on the same state", async () => {
    const el = await carousel(html`
      <lr-carousel>
        <div>One</div>
        <div>Two</div>
        <div>Three</div>
      </lr-carousel>
    `);

    expect(el.currentSlide).to.equal(0);
    expect(el.index).to.equal(0);
    expect(el.navigation).to.be.false;
    expect(el.pagination).to.be.false;
    expect(el.showIndicators).to.be.false;
    expect(el.autoplayInterval).to.equal(3000);
    expect(el.slidesPerPage).to.equal(1);
    expect(el.slidesPerMove).to.equal(1);
    expect(el.orientation).to.equal("horizontal");
    expect(el.mouseDragging).to.be.false;
    expect(el.slides).to.equal(3);
    expect(el.getAttribute("current-slide")).to.equal("0");
    expect(el.getAttribute("index")).to.equal("0");
    expect(el.getAttribute("slides")).to.equal("3");
    expect(el.shadowRoot!.querySelector('[part~="navigation"]')).to.be.null;
    expect(el.shadowRoot!.querySelector('[part~="pagination"]')).to.be.null;

    el.index = 1;
    await el.updateComplete;
    expect(el.currentSlide).to.equal(1);
    expect(el.getAttribute("current-slide")).to.equal("1");

    el.currentSlide = 2;
    await el.updateComplete;
    expect(el.index).to.equal(2);
    expect(el.getAttribute("index")).to.equal("2");

    el.showIndicators = true;
    await el.updateComplete;
    expect(el.pagination).to.be.true;
    expect(el.shadowRoot!.querySelector('[part~="pagination"]')).to.exist;
  });

  it("exposes mapped navigation, pagination, slots, parts, and event detail", async () => {
    const el = await carousel(html`
      <lr-carousel navigation pagination>
        <span slot="previous-icon">Back</span>
        <span slot="next-icon">Forward</span>
        <lr-carousel-item>One</lr-carousel-item>
        <lr-carousel-item>Two</lr-carousel-item>
        <lr-carousel-item>Three</lr-carousel-item>
      </lr-carousel>
    `);
    const previous = el.shadowRoot!.querySelector(
      '[part~="navigation-button-previous"]'
    ) as HTMLButtonElement;
    const next = el.shadowRoot!.querySelector(
      '[part~="navigation-button-next"]'
    ) as HTMLButtonElement;
    const pagination = el.shadowRoot!.querySelector('[part~="pagination"]');
    const active = el.shadowRoot!.querySelector(
      '[part~="pagination-item-active"]'
    );

    expect(previous).to.exist;
    expect(previous.getAttribute("part")).to.include("navigation-button");
    expect(previous.getAttribute("part")).to.include(
      "navigation-button--previous"
    );
    expect(next).to.exist;
    expect(next.getAttribute("part")).to.include("navigation-button--next");
    expect(pagination).to.exist;
    expect(active).to.exist;
    expect(
      previous.querySelector('slot[name="previous-icon"]')
    ).to.exist;
    expect(next.querySelector('slot[name="next-icon"]')).to.exist;
    expect(
      el.shadowRoot!.querySelector('[part~="scroll-container"]')
    ).to.exist;

    const changed = oneEvent(el, "lr-slide-change");
    next.click();
    const event = await changed;
    expect(event.detail.index).to.equal(1);
    expect(event.detail.slide).to.equal(el.children[3]);
    expect(event.cancelable).to.be.false;
  });

  it("returns opt-in navigation and pagination to false when their attributes are removed", async () => {
    const el = await carousel(html`
      <lr-carousel navigation pagination>
        <lr-carousel-item>One</lr-carousel-item>
        <lr-carousel-item>Two</lr-carousel-item>
      </lr-carousel>
    `);
    expect(el.shadowRoot!.querySelector('[part~="navigation"]')).to.exist;
    expect(el.shadowRoot!.querySelector('[part~="pagination"]')).to.exist;

    el.removeAttribute("navigation");
    el.removeAttribute("pagination");
    await el.updateComplete;
    expect(el.navigation).to.be.false;
    expect(el.pagination).to.be.false;
    expect(el.shadowRoot!.querySelector('[part~="navigation"]')).to.be.null;
    expect(el.shadowRoot!.querySelector('[part~="pagination"]')).to.be.null;
  });

  it("moves by pages, exposes the correct final page, and keeps every visible slide operable", async () => {
    const el = await carousel(html`
      <lr-carousel
        navigation
        pagination
        slides-per-page="2"
        slides-per-move="2"
        style="inline-size: 320px"
      >
        <lr-carousel-item><button>One</button></lr-carousel-item>
        <lr-carousel-item><button>Two</button></lr-carousel-item>
        <lr-carousel-item><button>Three</button></lr-carousel-item>
        <lr-carousel-item><button>Four</button></lr-carousel-item>
        <lr-carousel-item><button>Five</button></lr-carousel-item>
      </lr-carousel>
    `);
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    const slides = [...el.children] as HTMLElement[];
    const viewport = el.shadowRoot!.querySelector(
      '[part~="scroll-container"]'
    ) as HTMLElement;
    const track = el.shadowRoot!.querySelector('[part="track"]') as HTMLElement;

    expect(
      el.shadowRoot!.querySelectorAll('[part~="pagination-item"]').length
    ).to.equal(3);
    expect(slides[0].inert).to.be.false;
    expect(slides[1].inert).to.be.false;
    expect(slides[2].inert).to.be.true;
    expect(Math.round(slides[0].getBoundingClientRect().width)).to.be.lessThan(
      Math.round(viewport.clientWidth)
    );
    const gap = Number.parseFloat(getComputedStyle(track).columnGap);
    expect(slides[0].getBoundingClientRect().width * 2 + gap).to.be.at.most(
      viewport.clientWidth + 1
    );

    el.next("instant");
    await el.updateComplete;
    expect(el.currentSlide).to.equal(2);
    expect(slides[2].inert).to.be.false;
    expect(slides[3].inert).to.be.false;

    el.next("instant");
    await el.updateComplete;
    expect(el.currentSlide).to.equal(3);
    expect(slides[3].inert).to.be.false;
    expect(slides[4].inert).to.be.false;
    await expect(el).to.be.accessible();
  });

  it("supports vertical layout and vertical keyboard navigation", async () => {
    const el = await carousel(html`
      <lr-carousel
        orientation="vertical"
        navigation
        pagination
        style="block-size: 320px"
      >
        <lr-carousel-item>One</lr-carousel-item>
        <lr-carousel-item>Two</lr-carousel-item>
        <lr-carousel-item>Three</lr-carousel-item>
      </lr-carousel>
    `);
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    const viewport = el.shadowRoot!.querySelector(
      '[part~="scroll-container"]'
    ) as HTMLElement;
    const track = el.shadowRoot!.querySelector('[part="track"]') as HTMLElement;
    expect(getComputedStyle(viewport).overflowY).to.equal("auto");
    expect(getComputedStyle(viewport).overflowX).to.equal("hidden");
    expect(getComputedStyle(track).flexDirection).to.equal("column");

    viewport.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true })
    );
    await el.updateComplete;
    expect(el.currentSlide).to.equal(1);
    viewport.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true })
    );
    await el.updateComplete;
    expect(el.currentSlide).to.equal(0);
  });

  it("adds and removes carousel items through the mapped methods and repairs shrinkage", async () => {
    const el = await carousel(html`
      <lr-carousel navigation pagination current-slide="2">
        <lr-carousel-item>One</lr-carousel-item>
        <lr-carousel-item>Two</lr-carousel-item>
        <lr-carousel-item>Three</lr-carousel-item>
      </lr-carousel>
    `);
    const added = document.createElement("lr-carousel-item");
    added.textContent = "Four";
    el.addSlide(added);
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    await el.updateComplete;
    expect(el.lastElementChild).to.equal(added);
    expect(el.slides).to.equal(4);

    el.goToSlide(3, "instant");
    await el.updateComplete;
    expect(el.currentSlide).to.equal(3);
    el.removeSlide(3);
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    await el.updateComplete;
    expect(added.isConnected).to.be.false;
    expect(el.slides).to.equal(3);
    expect(el.currentSlide).to.equal(2);
  });

  it("renders inert loop endcaps and wraps by slidesPerMove", async () => {
    const el = await carousel(html`
      <lr-carousel loop navigation slides-per-page="2" slides-per-move="2">
        <lr-carousel-item>One</lr-carousel-item>
        <lr-carousel-item>Two</lr-carousel-item>
        <lr-carousel-item>Three</lr-carousel-item>
        <lr-carousel-item>Four</lr-carousel-item>
      </lr-carousel>
    `);
    const clones = el.shadowRoot!.querySelectorAll("[data-carousel-clone]");
    expect(clones.length).to.be.at.least(4);
    for (const clone of clones) {
      expect((clone as HTMLElement).inert).to.be.true;
      expect(clone.getAttribute("aria-hidden")).to.equal("true");
    }

    el.goToSlide(2, "instant");
    await el.updateComplete;
    el.next("instant");
    await el.updateComplete;
    expect(el.currentSlide).to.equal(0);
    el.previous("instant");
    await el.updateComplete;
    expect(el.currentSlide).to.equal(2);
  });

  it("cancels mouse dragging without leaving transient drag state behind", async () => {
    const el = await carousel(html`
      <lr-carousel mouse-dragging style="inline-size: 320px">
        <lr-carousel-item>One</lr-carousel-item>
        <lr-carousel-item>Two</lr-carousel-item>
      </lr-carousel>
    `);
    const viewport = el.shadowRoot!.querySelector(
      '[part~="scroll-container"]'
    ) as HTMLElement;
    viewport.setPointerCapture = () => {};
    viewport.releasePointerCapture = () => {};
    viewport.hasPointerCapture = () => true;
    viewport.dispatchEvent(
      new PointerEvent("pointerdown", {
        pointerId: 4,
        pointerType: "mouse",
        button: 0,
        clientX: 200,
        bubbles: true,
      })
    );
    viewport.dispatchEvent(
      new PointerEvent("pointermove", {
        pointerId: 4,
        pointerType: "mouse",
        clientX: 100,
        bubbles: true,
      })
    );
    expect(viewport.hasAttribute("data-dragging")).to.be.true;
    viewport.dispatchEvent(
      new PointerEvent("pointercancel", {
        pointerId: 4,
        pointerType: "mouse",
        bubbles: true,
      })
    );
    expect(viewport.hasAttribute("data-dragging")).to.be.false;
    expect(el.currentSlide).to.equal(0);
  });

  it("pauses autoplay while the user interacts and while the document is hidden", async () => {
    const el = await carousel(html`
      <lr-carousel autoplay loop>
        <lr-carousel-item>One</lr-carousel-item>
        <lr-carousel-item>Two</lr-carousel-item>
      </lr-carousel>
    `);
    const viewport = el.shadowRoot!.querySelector(
      '[part~="scroll-container"]'
    ) as HTMLElement;
    expect((el as unknown as { timer?: number }).timer).to.not.be.undefined;

    viewport.dispatchEvent(new PointerEvent("pointerenter", { bubbles: true }));
    expect((el as unknown as { timer?: number }).timer).to.be.undefined;
    viewport.dispatchEvent(new PointerEvent("pointerleave", { bubbles: true }));
    expect((el as unknown as { timer?: number }).timer).to.not.be.undefined;

    const descriptor = Object.getOwnPropertyDescriptor(
      Document.prototype,
      "visibilityState"
    );
    try {
      Object.defineProperty(document, "visibilityState", {
        configurable: true,
        value: "hidden",
      });
      document.dispatchEvent(new Event("visibilitychange"));
      expect((el as unknown as { timer?: number }).timer).to.be.undefined;
    } finally {
      delete (document as unknown as { visibilityState?: string })
        .visibilityState;
      if (descriptor) {
        Object.defineProperty(Document.prototype, "visibilityState", descriptor);
      }
    }
  });
});

it("exposes one active slide and localized navigation controls", async () => {
  const el = await carousel();
  const slides = [...el.children] as HTMLElement[];

  // Every slide stays laid out -- the scroll-snap track needs real boxes to scroll between, so
  // off-screen slides are neutralized with `inert`/`aria-hidden` rather than `hidden` (which
  // would remove their boxes and make swiping impossible).
  expect(slides[0].hidden).to.be.false;
  expect(slides[1].hidden).to.be.false;
  expect(slides[0].inert).to.be.false;
  expect(slides[1].inert).to.be.true;
  expect(slides[0].getAttribute("aria-hidden")).to.be.null;
  expect(slides[1].getAttribute("aria-hidden")).to.equal("true");
  expect(slides[0].hasAttribute("role")).to.be.false;
  expect(slides[0].hasAttribute("aria-roledescription")).to.be.false;
  expect(el.shadowRoot!.querySelectorAll('[part~="indicator"]').length).to.equal(
    3
  );
  // The indicators are a plain labelled button group, not a tablist -- there is no tabpanel for
  // them to control, so role="tab"/aria-selected would announce a broken relationship to AT.
  expect(
    el.shadowRoot!.querySelector('[part~="indicators"]')!.getAttribute("role")
  ).to.equal("group");
  expect(
    el.shadowRoot!.querySelector('[part~="indicator"]')!.getAttribute("role")
  ).to.be.null;
});

it("gives each indicator the shared minimum hit area without inflating the visible dot", async () => {
  const el = await carousel();
  const indicator = el.shadowRoot!.querySelector(
    '[part~="indicator"]'
  ) as HTMLElement;
  const dot = indicator.querySelector('[part="indicator-dot"]') as HTMLElement;
  expect(getComputedStyle(indicator).minInlineSize).to.equal("40px");
  expect(getComputedStyle(indicator).minBlockSize).to.equal("40px");
  // The visible dot itself stays compact (--lr-size-0-5rem = 8px), not blown up to 40px -- the
  // button's own box grows around it via flex centering instead.
  expect(getComputedStyle(dot).inlineSize).to.equal("8px");
  expect(getComputedStyle(dot).blockSize).to.equal("8px");
});

it("omits the indicator group entirely when showIndicators is false", async () => {
  const el = await carousel(html`
    <lr-carousel .showIndicators=${false}>
      <lr-carousel-item>One</lr-carousel-item>
      <lr-carousel-item>Two</lr-carousel-item>
    </lr-carousel>
  `);
  expect(el.shadowRoot!.querySelector('[part~="indicators"]')).to.be.null;
});

it('honors a plain show-indicators="false" markup attribute, not just a JS property binding', async () => {
  const el = await carousel(html`
    <lr-carousel show-indicators="false">
      <lr-carousel-item>One</lr-carousel-item>
      <lr-carousel-item>Two</lr-carousel-item>
    </lr-carousel>
  `);
  expect(
    el.showIndicators,
    "the true-default converter must parse the literal string"
  ).to.be.false;
  expect(el.shadowRoot!.querySelector('[part~="indicators"]')).to.be.null;
});

it("removing the show-indicators attribute restores the mapped false default", async () => {
  const el = await carousel(html`
    <lr-carousel show-indicators="false">
      <div>One</div>
      <div>Two</div>
    </lr-carousel>
  `);
  expect(el.showIndicators).to.be.false;
  el.removeAttribute("show-indicators");
  await el.updateComplete;
  expect(el.showIndicators).to.be.false;
  expect(el.shadowRoot!.querySelector('[part~="indicators"]')).to.be.null;
});

it("emits slide changes and supports keyboard navigation", async () => {
  const el = await carousel();
  const next = el.shadowRoot!.querySelector(
    '[part~="next-button"]'
  ) as HTMLButtonElement;
  const eventPromise = oneEvent(el, "lr-slide-change");
  next.click();
  const event = await eventPromise;

  expect(event.detail).to.deep.equal({ index: 1, slide: el.children[1] });
  expect(el.index).to.equal(1);

  const viewport = el.shadowRoot!.querySelector(
    '[part~="viewport"]'
  ) as HTMLElement;
  viewport.dispatchEvent(
    new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true })
  );
  await el.updateComplete;
  expect(el.index).to.equal(0);
});

it("swaps ArrowLeft/ArrowRight under RTL so a key still moves toward the visually adjacent slide", async () => {
  const el = await carousel(html`
    <lr-carousel dir="rtl">
      <div>One</div>
      <div>Two</div>
      <div>Three</div>
    </lr-carousel>
  `);
  const viewport = el.shadowRoot!.querySelector(
    '[part~="viewport"]'
  ) as HTMLElement;

  // Under RTL, ArrowLeft is "forward" (matches the physically-mirrored next-button position).
  viewport.dispatchEvent(
    new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true })
  );
  await el.updateComplete;
  expect(el.index).to.equal(1);

  // ArrowRight is "backward" under RTL -- must NOT also advance (the bug this regresses had both
  // arrows calling next(), leaving no keyboard way to go back).
  viewport.dispatchEvent(
    new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true })
  );
  await el.updateComplete;
  expect(el.index).to.equal(0);
});

it("clamps a non-finite, negative, or oversized index to a valid slide instead of NaN/out-of-range", async () => {
  const el = await carousel();

  el.index = NaN;
  await el.updateComplete;
  expect(el.index).to.equal(0);
  expect(([...el.children] as HTMLElement[])[0].inert).to.be.false;

  el.index = Number.POSITIVE_INFINITY;
  await el.updateComplete;
  expect(el.index).to.equal(0);

  el.index = -5;
  await el.updateComplete;
  expect(el.index).to.equal(0);
  expect(
    (
      el.shadowRoot!.querySelectorAll('[part~="indicator"]')[0] as HTMLElement
    ).getAttribute("aria-current")
  ).to.equal("true");

  el.index = 999;
  await el.updateComplete;
  expect(el.index).to.equal(2);
  const indicators = el.shadowRoot!.querySelectorAll('[part~="indicator"]');
  expect(
    indicators[indicators.length - 1].getAttribute("aria-current")
  ).to.equal("true");
});

it("ignores non-finite goTo() requests without emitting or corrupting the active index", async () => {
  const el = await carousel();
  let changes = 0;
  el.addEventListener("lr-slide-change", () => (changes += 1));

  el.goTo(Number.NaN);
  el.goTo(Number.POSITIVE_INFINITY);
  el.goTo(Number.NEGATIVE_INFINITY);
  await el.updateComplete;

  expect(el.index).to.equal(0);
  expect(changes).to.equal(0);
  expect(([...el.children] as HTMLElement[])[0]!.inert).to.be.false;
});

it("clamps invalid indices in the current update without scheduling a follow-up update", async () => {
  const globalWarnings = (globalThis as { litIssuedWarnings?: Set<string> })
    .litIssuedWarnings;
  globalWarnings?.forEach((warning) => {
    if (warning.includes("scheduled an update")) globalWarnings.delete(warning);
  });
  const originalWarn = console.warn;
  const calls: unknown[][] = [];
  console.warn = (...args: unknown[]) => calls.push(args);
  try {
    const el = await carousel();
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    el.index = NaN;
    expect(await el.updateComplete).to.be.true;
    el.index = 999;
    expect(await el.updateComplete).to.be.true;
  } finally {
    console.warn = originalWarn;
  }
  expect(
    calls
      .flat()
      .map(String)
      .some((message) => message.includes("scheduled an update"))
  ).to.be.false;
});

it("treats a non-finite autoplayInterval as its 5s default instead of NaN math", async () => {
  const el = await carousel(html`
    <lr-carousel autoplay autoplay-interval="NaN">
      <div>One</div>
      <div>Two</div>
    </lr-carousel>
  `);
  // A non-finite interval falling through to `setInterval` unguarded would either throw or fire
  // immediately/never; asserting a timer actually got scheduled is the observable proxy for "the
  // sanitized 5s default was used", since the internal numeric timer id isn't itself meaningful.
  expect((el as unknown as { timer?: number }).timer).to.not.be.undefined;
});

it("mirrors the previous/next chevron glyphs under RTL", async () => {
  const el = await carousel(html`
    <lr-carousel dir="rtl" navigation>
      <div>One</div>
      <div>Two</div>
    </lr-carousel>
  `);
  const glyph = el.shadowRoot!.querySelector(
    '[part="previous-glyph"]'
  ) as HTMLElement;
  expect(getComputedStyle(glyph).transform).to.contain("matrix(-1");
});

it("disables autoplay under prefers-reduced-motion", async () => {
  const originalMatchMedia = window.matchMedia;
  window.matchMedia = ((query: string) => ({
    matches: query === "(prefers-reduced-motion: reduce)",
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as typeof window.matchMedia;

  try {
    const el = await carousel(html`
      <lr-carousel autoplay autoplay-interval="1000">
        <div>One</div>
        <div>Two</div>
        <div>Three</div>
      </lr-carousel>
    `);
    // The reduced-motion branch must gate autoplay before any timer is ever
    // scheduled, not just shorten it -- so no interval should exist at all.
    expect((el as any).reduceMotion).to.be.true;
    expect((el as any).timer).to.be.undefined;
    expect(
      el
        .shadowRoot!.querySelector('[part~="scroll-container"]')!
        .hasAttribute("aria-live")
    ).to.be.false;
    const sink = document.querySelector<HTMLElement>(
      `[${ANNOUNCEMENT_SINK_ATTRIBUTE}="polite"]`
    );
    expect(
      sink !== null,
      "the light-DOM sink is mounted before any change"
    ).to.be.true;
    expect(sink!.childElementCount).to.equal(0);
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(el.index).to.equal(0);
  } finally {
    window.matchMedia = originalMatchMedia;
  }
});

it("announces manual slide changes through a pre-mounted light-DOM sink without replaying mount or reconnect state", async () => {
  const container = (await fixture(html`<div></div>`)) as HTMLDivElement;
  const el = document.createElement("lr-carousel") as LyraCarousel;
  el.strings = { carouselSlidePosition: "Slide {index} of {total}" };
  el.innerHTML = "<div>One</div><div>Two</div><div>Three</div>";
  container.append(el);
  await el.updateComplete;

  const viewport = el.shadowRoot!.querySelector<HTMLElement>(
    '[part~="scroll-container"]'
  )!;
  let sink = document.querySelector<HTMLElement>(
    `[${ANNOUNCEMENT_SINK_ATTRIBUTE}="polite"]`
  )!;
  expect(viewport.hasAttribute("aria-live")).to.be.false;
  expect(sink.childElementCount, "initial state stays silent").to.equal(0);

  el.next("instant");
  await el.updateComplete;
  el.previous("instant");
  await el.updateComplete;
  el.next("instant");
  await el.updateComplete;
  expect([...sink.children].map((node) => node.textContent)).to.deep.equal([
    "Slide 2 of 3: Two",
    "Slide 1 of 3: One",
    "Slide 2 of 3: Two",
  ]);

  el.remove();
  expect(sink.isConnected, "disconnect releases the old sink").to.be.false;
  container.append(el);
  await Promise.resolve();
  await el.updateComplete;
  sink = document.querySelector<HTMLElement>(
    `[${ANNOUNCEMENT_SINK_ATTRIBUTE}="polite"]`
  )!;
  expect(sink.childElementCount, "reconnect does not replay the active slide").to.equal(0);

  el.previous("instant");
  await el.updateComplete;
  expect(sink.lastElementChild?.textContent).to.equal("Slide 1 of 3: One");
});

it("lets instance strings control announcement composition and separation", async () => {
  const el = await carousel(html`
    <lr-carousel slides-per-page="2">
      <div>One</div>
      <div>Two</div>
      <div>Three</div>
    </lr-carousel>
  `);
  el.strings = {
    carouselSlideAnnouncement: "CONTENT={content}; POSITION={position}",
    carouselSlideAnnouncementSeparator: " / ",
  };
  await el.updateComplete;

  el.next("instant");
  await el.updateComplete;

  const sink = document.querySelector<HTMLElement>(
    `[${ANNOUNCEMENT_SINK_ATTRIBUTE}="polite"]`
  )!;
  expect(sink.lastElementChild?.textContent).to.equal(
    "CONTENT=Two; POSITION=Slide 2 of 3 / CONTENT=Three; POSITION=Slide 3 of 3"
  );
});

it("announces method, property, click, and key changes while autoplay is enabled", async () => {
  const el = await carousel(html`
    <lr-carousel autoplay autoplay-interval="10000" navigation pagination>
      <div>One</div>
      <div>Two</div>
      <div>Three</div>
    </lr-carousel>
  `);
  const sink = document.querySelector<HTMLElement>(
    `[${ANNOUNCEMENT_SINK_ATTRIBUTE}="polite"]`
  )!;
  expect(sink.childElementCount).to.equal(0);

  el.next("instant");
  await el.updateComplete;
  el.currentSlide = 2;
  await el.updateComplete;
  (
    el.shadowRoot!.querySelector(
      '[part~="navigation-button-previous"]'
    ) as HTMLButtonElement
  ).click();
  await el.updateComplete;
  el.shadowRoot!.querySelector<HTMLElement>('[part~="scroll-container"]')!
    .dispatchEvent(new KeyboardEvent("keydown", { key: "Home", bubbles: true }));
  await el.updateComplete;

  expect([...sink.children].map((node) => node.textContent)).to.deep.equal([
    "Slide 2 of 3: Two",
    "Slide 3 of 3: Three",
    "Slide 2 of 3: Two",
    "Slide 1 of 3: One",
  ]);
});

it("keeps manual page changes silent while the host or a composed ancestor is accessibility-hidden", async () => {
  const container = (await fixture(html`
    <div>
      <lr-carousel>
        <div>One</div>
        <div>Two</div>
      </lr-carousel>
    </div>
  `)) as HTMLDivElement;
  const el = container.querySelector("lr-carousel") as LyraCarousel;
  el.strings = { carouselSlidePosition: "Slide {index} of {total}" };
  await el.updateComplete;
  const sink = document.querySelector<HTMLElement>(
    `[${ANNOUNCEMENT_SINK_ATTRIBUTE}="polite"]`
  )!;

  const suppressedChanges: Array<{
    label: string;
    apply: () => void;
    reset: () => void;
  }> = [
    {
      label: "hidden host",
      apply: () => { el.hidden = true; },
      reset: () => { el.hidden = false; },
    },
    {
      label: "inert ancestor",
      apply: () => { container.inert = true; },
      reset: () => { container.inert = false; },
    },
    {
      label: "case-insensitive aria-hidden ancestor",
      apply: () => { container.setAttribute("aria-hidden", " TRUE "); },
      reset: () => { container.removeAttribute("aria-hidden"); },
    },
    ...[
      "display: none",
      "visibility: hidden",
      "visibility: collapse",
      "content-visibility: hidden",
    ].map((style) => ({
      label: style,
      apply: () => { container.setAttribute("style", style); },
      reset: () => { container.removeAttribute("style"); },
    })),
  ];

  for (const suppression of suppressedChanges) {
    suppression.apply();
    el.goToSlide(el.currentSlide === 0 ? 1 : 0, "instant");
    await el.updateComplete;
    expect(sink.childElementCount, suppression.label).to.equal(0);
    suppression.reset();
  }

  el.goToSlide(el.currentSlide === 0 ? 1 : 0, "instant");
  await el.updateComplete;
  expect(sink.lastElementChild?.textContent).to.match(/^Slide [12] of 2:/);
});

it("excludes accessibility-hidden slide roots and descendants from page announcements", async () => {
  const el = await carousel(html`
    <lr-carousel>
      <div>One</div>
      <div hidden aria-label="Hidden authored label">Hidden root content</div>
      <div>
        Visible content
        <span aria-hidden=" TRUE ">ARIA hidden</span>
        <span inert>Inert</span>
        <span style="display: none">Display hidden</span>
        <span style="visibility: hidden">Visibility hidden <span style="visibility: visible">Visibility override</span></span>
        <span style="visibility: collapse">Visibility collapsed</span>
        <span style="content-visibility: hidden">Content hidden</span>
      </div>
    </lr-carousel>
  `);
  el.strings = { carouselSlidePosition: "Slide {index} of {total}" };
  await el.updateComplete;
  const sink = document.querySelector<HTMLElement>(
    `[${ANNOUNCEMENT_SINK_ATTRIBUTE}="polite"]`
  )!;

  el.next("instant");
  await el.updateComplete;
  expect(
    sink.childElementCount,
    "an author-hidden selected slide emits no position or content"
  ).to.equal(0);

  el.next("instant");
  await el.updateComplete;
  expect(sink.lastElementChild?.textContent).to.equal(
    "Slide 3 of 3: Visible content Visibility override"
  );
});

it("announces only a visible descendant that overrides a visibility-hidden slide root", async () => {
  const el = await carousel(html`
    <lr-carousel>
      <div>One</div>
      <div style="visibility: hidden">
        Hidden root text
        <span style="visibility: visible">Visible root override</span>
      </div>
    </lr-carousel>
  `);
  el.strings = { carouselSlidePosition: "Slide {index} of {total}" };
  await el.updateComplete;
  const sink = document.querySelector<HTMLElement>(
    `[${ANNOUNCEMENT_SINK_ATTRIBUTE}="polite"]`
  )!;

  el.next("instant");
  await el.updateComplete;
  expect(sink.lastElementChild?.textContent).to.equal(
    "Slide 2 of 2: Visible root override"
  );
  expect(sink.textContent).to.not.include("Hidden root text");
});

it("announces flattened assigned content from a nested forwarding slot without leaking its fallback", async () => {
  const host = (await fixture(html`
    <div><span id="forwarded-content">Assigned consumer text</span></div>
  `)) as HTMLDivElement;
  const shadow = host.attachShadow({ mode: "open" });
  shadow.innerHTML = `
    <lr-carousel>
      <div>First slide</div>
      <div><slot><span>Forwarding fallback</span></slot></div>
    </lr-carousel>
  `;
  const el = shadow.querySelector("lr-carousel") as LyraCarousel;
  const forwardingSlot = shadow.querySelector("slot")!;
  const assigned = host.querySelector("#forwarded-content") as HTMLSpanElement;
  el.strings = { carouselSlidePosition: "Slide {index} of {total}" };
  await el.updateComplete;
  expect(
    forwardingSlot.assignedNodes().some((node) => node === assigned),
    "precondition: the nested slot forwards the wrapper's consumer content"
  ).to.be.true;
  const sink = document.querySelector<HTMLElement>(
    `[${ANNOUNCEMENT_SINK_ATTRIBUTE}="polite"]`
  )!;
  expect(sink.childElementCount, "initial state remains silent").to.equal(0);

  const showForwardedSlide = async (): Promise<void> => {
    el.goToSlide(0, "instant");
    await el.updateComplete;
    el.goToSlide(1, "instant");
    await el.updateComplete;
  };

  await showForwardedSlide();
  expect(sink.lastElementChild?.textContent).to.equal(
    "Slide 2 of 2: Assigned consumer text"
  );
  expect(sink.lastElementChild?.textContent).to.not.include("Forwarding fallback");

  assigned.textContent = "Updated assigned text";
  await showForwardedSlide();
  expect(sink.lastElementChild?.textContent).to.equal(
    "Slide 2 of 2: Updated assigned text"
  );

  assigned.hidden = true;
  await showForwardedSlide();
  expect(sink.lastElementChild?.textContent).to.equal("Slide 2 of 2");
  expect(sink.lastElementChild?.textContent).to.not.include("Forwarding fallback");

  assigned.hidden = false;
  assigned.style.display = "none";
  await showForwardedSlide();
  expect(sink.lastElementChild?.textContent).to.equal("Slide 2 of 2");
  expect(sink.lastElementChild?.textContent).to.not.include("Forwarding fallback");

  assigned.remove();
  await Promise.resolve();
  await showForwardedSlide();
  expect(sink.lastElementChild?.textContent).to.equal(
    "Slide 2 of 2: Forwarding fallback"
  );
});

it("announces the rendered composed slide text, closed summary, and image alternative", async () => {
  const el = document.createElement("lr-carousel") as LyraCarousel;
  el.strings = { carouselSlidePosition: "Slide {index} of {total}" };
  const first = document.createElement("div");
  first.textContent = "First slide";
  const second = document.createElement("div");
  const shadowHost = document.createElement("div");
  const shadow = shadowHost.attachShadow({ mode: "open" });
  shadow.innerHTML = `<span>Rendered shadow slide</span><slot></slot>`;
  const assigned = document.createElement("span");
  assigned.textContent = "Rendered assigned slide";
  const unassigned = document.createElement("span");
  unassigned.slot = "missing";
  unassigned.textContent = "Unassigned slide leak";
  shadowHost.append(assigned, unassigned);
  const details = document.createElement("details");
  details.innerHTML = `<summary>Collapsed slide summary</summary><span>Collapsed slide body leak</span>`;
  const image = document.createElement("img");
  image.alt = "Slide diagram";
  second.append(shadowHost, details, image);
  el.append(first, second);
  document.body.append(el);
  await el.updateComplete;
  const sink = document.querySelector<HTMLElement>(
    `[${ANNOUNCEMENT_SINK_ATTRIBUTE}="polite"]`
  )!;

  el.next("instant");
  await el.updateComplete;

  expect(sink.lastElementChild?.textContent).to.equal(
    "Slide 2 of 2: Rendered shadow slide Rendered assigned slide Collapsed slide summary Slide diagram"
  );
  el.remove();
});

it("keeps only timer-driven autoplay advances silent", async () => {
  const originalSetInterval = window.setInterval;
  const originalClearInterval = window.clearInterval;
  let autoplayTick: (() => void) | undefined;
  let el: LyraCarousel | undefined;
  window.setInterval = ((handler: TimerHandler) => {
    if (typeof handler === "function") autoplayTick = handler;
    return 71;
  }) as typeof window.setInterval;
  window.clearInterval = (() => {}) as typeof window.clearInterval;

  try {
    el = await carousel(html`
      <lr-carousel autoplay loop autoplay-interval="1000">
        <div>One</div>
        <div>Two</div>
      </lr-carousel>
    `);
    const sink = document.querySelector<HTMLElement>(
      `[${ANNOUNCEMENT_SINK_ATTRIBUTE}="polite"]`
    )!;
    expect(typeof autoplayTick).to.equal("function");
    autoplayTick!();
    await el.updateComplete;

    expect(el.currentSlide).to.equal(1);
    expect(sink.childElementCount).to.equal(0);
  } finally {
    el?.remove();
    window.setInterval = originalSetInterval;
    window.clearInterval = originalClearInterval;
  }
});

it("rebinds carousel globals, timers, slides, and announcements to an adopted iframe document", async () => {
  const frame = document.createElement("iframe");
  const loaded = new Promise<void>((resolve) =>
    frame.addEventListener("load", () => resolve(), { once: true })
  );
  document.body.append(frame);
  await loaded;

  const frameDocument = frame.contentDocument!;
  const frameWindow = frame.contentWindow!;
  const originalFrameMatchMedia = frameWindow.matchMedia;
  const originalFrameSetInterval = frameWindow.setInterval;
  const originalFrameClearInterval = frameWindow.clearInterval;
  const visibilityDescriptor = Object.getOwnPropertyDescriptor(
    frameDocument,
    "visibilityState"
  );
  let frameMediaQueries = 0;
  let frameIntervalSchedules = 0;
  let frameIntervalClears = 0;
  let autoplayTick: (() => void) | undefined;
  let el: LyraCarousel | undefined;

  frameWindow.matchMedia = ((query: string) => {
    frameMediaQueries += 1;
    return {
      matches: false,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    } as unknown as MediaQueryList;
  }) as typeof frameWindow.matchMedia;
  frameWindow.setInterval = ((handler: TimerHandler) => {
    frameIntervalSchedules += 1;
    if (typeof handler === "function") autoplayTick = handler;
    return 83;
  }) as typeof frameWindow.setInterval;
  frameWindow.clearInterval = (() => {
    frameIntervalClears += 1;
  }) as typeof frameWindow.clearInterval;
  Object.defineProperty(frameDocument, "visibilityState", {
    configurable: true,
    value: "visible",
  });

  try {
    el = document.createElement("lr-carousel") as LyraCarousel;
    el.strings = { carouselSlidePosition: "Slide {index} of {total}" };
    document.body.append(el);
    await el.updateComplete;

    frameDocument.body.append(el);
    const first = frameDocument.createElement("div");
    const second = frameDocument.createElement("div");
    first.textContent = "Frame one";
    second.textContent = "Frame two";
    el.append(first, second);
    await new Promise<void>((resolve) => frameWindow.requestAnimationFrame(() => resolve()));
    await el.updateComplete;

    expect(el.slides, "iframe-realm HTML elements remain valid slides").to.equal(2);
    expect(frameMediaQueries, "reconnect reads the adopted document's media query").to.equal(1);
    expect(
      frameDocument.querySelector(
        `[${ANNOUNCEMENT_SINK_ATTRIBUTE}="polite"]`
      ) !== null,
      "the sink moves into the adopted document"
    ).to.be.true;

    el.loop = true;
    el.autoplay = true;
    await el.updateComplete;
    expect(frameIntervalSchedules, "autoplay uses the adopted window's timer").to.equal(1);

    const schedulesBeforeVisibility = frameIntervalSchedules;
    document.dispatchEvent(new Event("visibilitychange"));
    expect(
      frameIntervalSchedules,
      "the previous document no longer controls the adopted carousel"
    ).to.equal(schedulesBeforeVisibility);
    frameDocument.dispatchEvent(new frameWindow.Event("visibilitychange"));
    expect(
      frameIntervalSchedules,
      "the adopted document's visibility event restarts autoplay"
    ).to.equal(schedulesBeforeVisibility + 1);
    expect(frameIntervalClears).to.be.greaterThan(0);

    expect(typeof autoplayTick).to.equal("function");
    autoplayTick!();
    await el.updateComplete;
    const sink = frameDocument.querySelector<HTMLElement>(
      `[${ANNOUNCEMENT_SINK_ATTRIBUTE}="polite"]`
    )!;
    expect(el.currentSlide).to.equal(1);
    expect(sink.childElementCount, "iframe autoplay stays silent").to.equal(0);

    el.previous("instant");
    await el.updateComplete;
    expect(sink.lastElementChild?.textContent).to.equal(
      "Slide 1 of 2: Frame one"
    );

    el.remove();
    const schedulesAfterDisconnect = frameIntervalSchedules;
    frameDocument.dispatchEvent(new frameWindow.Event("visibilitychange"));
    expect(
      frameIntervalSchedules,
      "disconnect removes the adopted document's visibility listener"
    ).to.equal(schedulesAfterDisconnect);
  } finally {
    el?.remove();
    frameWindow.matchMedia = originalFrameMatchMedia;
    frameWindow.setInterval = originalFrameSetInterval;
    frameWindow.clearInterval = originalFrameClearInterval;
    if (visibilityDescriptor) {
      Object.defineProperty(frameDocument, "visibilityState", visibilityDescriptor);
    } else {
      delete (frameDocument as Document & { visibilityState?: string })
        .visibilityState;
    }
    frame.remove();
  }
});

it("localizes every default string via .strings, proving the call sites are actually wired up", async () => {
  const el = await carousel(html`
    <lr-carousel
      navigation
      pagination
      .strings=${{
        carousel: "carrousel",
        carouselLabel: "Carrousel",
        carouselSlide: "diapositive",
        carouselSlidePosition: "Diapositive {index} sur {total}",
        carouselIndicators: "Diapositives du carrousel",
        carouselGoTo: "Aller à la diapositive {index}",
        previous: "Précédent",
        next: "Suivant",
      }}
    >
      <lr-carousel-item>One</lr-carousel-item>
      <lr-carousel-item>Two</lr-carousel-item>
    </lr-carousel>
  `);
  const base = el.shadowRoot!.querySelector('[part~="base"]') as HTMLElement;
  expect(base.getAttribute("aria-roledescription")).to.equal("carrousel");
  expect(base.getAttribute("aria-label")).to.equal("Carrousel");
  expect(
    el
      .shadowRoot!.querySelector('[part~="previous-button"]')!
      .getAttribute("aria-label")
  ).to.equal("Précédent");
  expect(
    el
      .shadowRoot!.querySelector('[part~="next-button"]')!
      .getAttribute("aria-label")
  ).to.equal("Suivant");
  expect(
    el
      .shadowRoot!.querySelector('[part~="indicators"]')!
      .getAttribute("aria-label")
  ).to.equal("Diapositives du carrousel");
  expect(
    el
      .shadowRoot!.querySelector('[part~="indicator"]')!
      .getAttribute("aria-label")
  ).to.equal("Aller à la diapositive 1");
  const slide = el.children[0] as HTMLElement;
  expect(slide.getAttribute("aria-roledescription")).to.equal("diapositive");
  expect(slide.getAttribute("aria-label")).to.equal("Diapositive 1 sur 2");
});

it("preserves author semantics on arbitrary slides instead of replacing them with generated group names", async () => {
  const el = await carousel(html`
    <lr-carousel>
      <img
        alt="Dashboard overview"
        src="data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs="
      />
      <a href="#details" role="navigation" aria-label="Open detailed report"
        >Report</a
      >
    </lr-carousel>
  `);
  const [image, link] = [...el.children] as HTMLElement[];
  expect(image.hasAttribute("role")).to.be.false;
  expect(image.hasAttribute("aria-label")).to.be.false;
  expect(image.getAttribute("alt")).to.equal("Dashboard overview");
  expect(link.getAttribute("role")).to.equal("navigation");
  expect(link.getAttribute("aria-label")).to.equal("Open detailed report");
});

it("restores wrapper-owned inertness and slide metadata when slides are removed or the carousel disconnects", async () => {
  const el = await carousel(html`
    <lr-carousel>
      <lr-carousel-item aria-label="Author label">One</lr-carousel-item>
      <lr-carousel-item aria-hidden="false">Two</lr-carousel-item>
    </lr-carousel>
  `);
  const [first, second] = [...el.children] as HTMLElement[];
  expect(second.inert).to.be.true;

  second.remove();
  el.dispatchEvent(new Event("slotchange"));
  await el.updateComplete;
  expect(second.inert).to.be.false;
  expect(second.getAttribute("aria-hidden")).to.equal("false");

  const parent = el.parentElement!;
  el.remove();
  expect(first.inert).to.be.false;
  expect(first.getAttribute("aria-label")).to.equal("Author label");
  parent.append(el);
});

it("reapplies slide inertness after disconnect and reconnect", async () => {
  const el = await carousel(html`
    <lr-carousel>
      <lr-carousel-item>One</lr-carousel-item>
      <lr-carousel-item>Two</lr-carousel-item>
    </lr-carousel>
  `);
  const [first, second] = [...el.children] as HTMLElement[];
  const parent = el.parentElement!;
  expect(second.inert).to.be.true;

  el.remove();
  expect(first.inert).to.be.false;
  expect(second.inert).to.be.false;
  parent.append(el);
  await el.updateComplete;
  await new Promise<void>((resolve) => queueMicrotask(resolve));

  expect(first.inert).to.be.false;
  expect(second.inert).to.be.true;
  expect(second.getAttribute("aria-hidden")).to.equal("true");
});

it("preserves an author's own inert slide across the carousel's own inert bookkeeping", async () => {
  const el = await carousel(html`
    <lr-carousel>
      <lr-carousel-item inert>One</lr-carousel-item>
      <lr-carousel-item>Two</lr-carousel-item>
    </lr-carousel>
  `);
  const [first] = [...el.children] as HTMLElement[];
  expect(first.inert, "the active slide keeps the author's own inert").to.be.true;

  const parent = el.parentElement!;
  el.remove();
  expect(first.inert, "disconnect restores the author value, not `false`").to.be.true;
  parent.append(el);
});

it("refreshes generated carousel-item metadata after a live strings change", async () => {
  const el = await carousel(html`
    <lr-carousel>
      <lr-carousel-item>One</lr-carousel-item>
      <lr-carousel-item>Two</lr-carousel-item>
    </lr-carousel>
  `);
  const first = el.children[0] as HTMLElement;
  expect(first.getAttribute("aria-label")).to.equal("Slide 1 of 2");
  el.strings = { carouselSlidePosition: "Page {index}/{total}" };
  await el.updateComplete;
  expect(first.getAttribute("aria-label")).to.equal("Page 1/2");
});

it("formats generated slide indices with the effective locale", async () => {
  const el = await carousel(html`
    <lr-carousel locale="ar-EG" pagination>
      <lr-carousel-item>One</lr-carousel-item>
      <lr-carousel-item>Two</lr-carousel-item>
    </lr-carousel>
  `);
  const formattedOne = new Intl.NumberFormat("ar-EG").format(1);
  expect((el.children[0] as HTMLElement).getAttribute("aria-label")).to.include(
    formattedOne
  );
  expect(
    el
      .shadowRoot!.querySelector('[part~="indicator"]')!
      .getAttribute("aria-label")
  ).to.include(formattedOne);
});

it("is accessible and supports a consumer supplied accessible label", async () => {
  const el = await carousel(html`
    <lr-carousel aria-label="Product screenshots">
      <img
        alt="First screenshot"
        src="data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs="
      />
      <img
        alt="Second screenshot"
        src="data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs="
      />
    </lr-carousel>
  `);
  expect(
    el.shadowRoot!.querySelector('[part~="base"]')!.getAttribute("aria-label")
  ).to.equal("Product screenshots");
  await expect(el).to.be.accessible();
});

it("preserves an explicitly empty host aria-label on both carousel landmarks", async () => {
  const el = await carousel(html`
    <lr-carousel aria-label="" accessible-label="Fallback name">
      <div>One</div>
      <div>Two</div>
    </lr-carousel>
  `);
  const base = el.shadowRoot!.querySelector('[part~="base"]') as HTMLElement;
  const viewport = el.shadowRoot!.querySelector(
    '[part~="viewport"]'
  ) as HTMLElement;
  expect(base.getAttribute("aria-label")).to.equal("");
  expect(viewport.getAttribute("aria-label")).to.equal("");
});

it('names the focusable viewport with role="group", following the same label arbitration as the region', async () => {
  const el = await carousel(html`
    <lr-carousel>
      <div>Slide one</div>
      <div>Slide two</div>
    </lr-carousel>
  `);
  const viewport = el.shadowRoot!.querySelector(
    '[part~="viewport"]'
  ) as HTMLElement;
  expect(viewport.getAttribute("tabindex")).to.equal("0");
  expect(viewport.getAttribute("role")).to.equal("group");
  expect(viewport.getAttribute("aria-label")).to.equal("Carousel");

  el.setAttribute("aria-label", "Product screenshots");
  await el.updateComplete;
  expect(viewport.getAttribute("aria-label")).to.equal("Product screenshots");
});

it("gives indicator a hover state that recolors its dot", () => {
  const css = styles.cssText.replace(/\s+/g, " ").replaceAll('"', "'");
  expect(css).to.match(
    /\[part~='pagination-item'\]:hover \[part='indicator-dot'\]/
  );
});

it("gives the keyboard-focusable viewport matching hover feedback", () => {
  const css = styles.cssText.replace(/\s+/g, " ").replaceAll('"', "'");
  expect(css).to.match(/\[part~='scroll-container'\]:hover/);
});

describe("indicator current-state cssprops", () => {
  /** Resolves what a `declaration` would compute to *inside this component's shadow root*, where the
   *  `--lr-*` design tokens actually live. Used to assert the unset defaults byte-for-byte against
   *  the tokens they fall back to. */
  function resolvedInShadow(
    el: LyraCarousel,
    declaration: string,
    property: string
  ): string {
    const probe = document.createElement("span");
    probe.setAttribute("style", declaration);
    el.shadowRoot!.appendChild(probe);
    const value = getComputedStyle(probe).getPropertyValue(property);
    probe.remove();
    return value;
  }

  const overrides =
    "--lr-carousel-indicator-current-bg: rgb(0, 51, 102); --lr-carousel-indicator-current-border-color: rgb(0, 102, 51);";

  async function themed(style: string): Promise<LyraCarousel> {
    const wrapper = (await fixture(html`
      <div style=${style}>
        <lr-carousel pagination>
          <div>One</div>
          <div>Two</div>
          <div>Three</div>
        </lr-carousel>
      </div>
    `)) as HTMLElement;
    const el = wrapper.querySelector("lr-carousel") as LyraCarousel;
    await el.updateComplete;
    return el;
  }

  function currentDot(el: LyraCarousel): HTMLElement {
    return el.shadowRoot!.querySelector(
      '[part~="indicator"][aria-current="true"] [part="indicator-dot"]'
    ) as HTMLElement;
  }

  it("recolors the current indicator dot from an ancestor, not a :host-declared prop", async () => {
    const el = await themed(overrides);
    const dot = currentDot(el);
    expect(dot).to.exist;
    expect(getComputedStyle(dot).backgroundColor).to.equal("rgb(0, 51, 102)");
    expect(getComputedStyle(dot).borderTopColor).to.equal("rgb(0, 102, 51)");
    // A non-current dot keeps its resting surface/border tokens -- the props are scoped to
    // [aria-current='true'] only.
    const other = el.shadowRoot!.querySelector(
      '[part~="indicator"][aria-current="false"] [part="indicator-dot"]'
    ) as HTMLElement;
    expect(getComputedStyle(other).backgroundColor).to.equal(
      resolvedInShadow(
        el,
        "background: var(--lr-color-surface)",
        "background-color"
      )
    );
  });

  it("renders byte-identically to the pre-cssprop output when the props are unset", async () => {
    const el = await themed("");
    const dot = currentDot(el);
    expect(getComputedStyle(dot).backgroundColor).to.equal(
      resolvedInShadow(
        el,
        "background: var(--lr-color-brand-quiet)",
        "background-color"
      )
    );
    expect(getComputedStyle(dot).borderTopColor).to.equal(
      resolvedInShadow(
        el,
        "border-color: var(--lr-color-brand)",
        "border-top-color"
      )
    );
  });

  it("is accessible with the current-state props themed", async () => {
    const el = await themed(overrides);
    await expect(el).to.be.accessible();
  });
});

it("reacts to prefers-reduced-motion changing after mount", async () => {
  // The stub above deliberately no-ops addEventListener; this one captures the listener so the
  // preference can actually flip while the component is live, which is the only way to reach the
  // change handler (the media query itself can't be driven from inside the test page).
  const originalMatchMedia = window.matchMedia;
  const listeners = new Set<(e: MediaQueryListEvent) => void>();
  let matches = false;
  window.matchMedia = ((query: string) => ({
    get matches() {
      return query === "(prefers-reduced-motion: reduce)" ? matches : false;
    },
    media: query,
    addEventListener: (_t: string, fn: (e: MediaQueryListEvent) => void) => listeners.add(fn),
    removeEventListener: (_t: string, fn: (e: MediaQueryListEvent) => void) => listeners.delete(fn),
  })) as typeof window.matchMedia;

  try {
    const el = await carousel(html`
      <lr-carousel autoplay autoplay-interval="1000">
        <div>One</div>
        <div>Two</div>
        <div>Three</div>
      </lr-carousel>
    `);
    expect((el as any).reduceMotion).to.be.false;
    expect((el as any).timer, "autoplay is running while motion is allowed").to.not.be.undefined;

    matches = true;
    for (const fn of [...listeners]) fn({ matches: true } as MediaQueryListEvent);
    await el.updateComplete;
    expect((el as any).reduceMotion).to.be.true;
    expect((el as any).timer, "turning the preference on stops autoplay").to.be.undefined;

    matches = false;
    for (const fn of [...listeners]) fn({ matches: false } as MediaQueryListEvent);
    await el.updateComplete;
    expect((el as any).reduceMotion).to.be.false;
    expect((el as any).timer, "turning it back off resumes autoplay").to.not.be.undefined;
  } finally {
    window.matchMedia = originalMatchMedia;
  }
});

describe("touch scrolling and scroll-snap", () => {
  const SETTLE_WAIT = 400;

  function viewportOf(el: LyraCarousel): HTMLElement {
    return el.shadowRoot!.querySelector('[part~="viewport"]') as HTMLElement;
  }

  function slidesOf(el: LyraCarousel): HTMLElement[] {
    return [...el.children] as HTMLElement[];
  }

  /** Inline offset that would bring `slide` flush with the viewport's inline start. Mirrors what a
   *  swipe resolves to, and stays correct under RTL (where the inline start is the right edge). */
  function inlineDelta(el: LyraCarousel, slide: HTMLElement): number {
    const viewportRect = viewportOf(el).getBoundingClientRect();
    const slideRect = slide.getBoundingClientRect();
    return el.getAttribute("dir") === "rtl"
      ? slideRect.right - viewportRect.right
      : slideRect.left - viewportRect.left;
  }

  /** Waits for a smooth scroll to actually stop. Engines differ by a lot here -- Firefox's easing
   *  is still shedding its last couple of pixels well after Chromium has finished -- so the tests
   *  wait for the scroller to stop moving rather than for a fixed budget. */
  async function scrollAtRest(el: LyraCarousel): Promise<void> {
    const viewport = viewportOf(el);
    let previous = Number.NaN;
    for (let attempt = 0; attempt < 40; attempt += 1) {
      await new Promise<void>((resolve) => setTimeout(resolve, 50));
      if (viewport.scrollLeft === previous) return;
      previous = viewport.scrollLeft;
    }
  }

  async function sized(direction?: "rtl"): Promise<LyraCarousel> {
    const el = await carousel(html`
      <lr-carousel
        navigation
        dir=${direction ?? "ltr"}
        style="inline-size: 300px"
        aria-label="Panels"
      >
        <div style="block-size: 60px">One</div>
        <div style="block-size: 60px">Two</div>
        <div style="block-size: 60px">Three</div>
      </lr-carousel>
    `);
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    return el;
  }

  it("lays the slides out in a snapping, natively scrollable track", async () => {
    const el = await sized();
    const viewport = viewportOf(el);
    const viewportStyle = getComputedStyle(viewport);

    expect(viewportStyle.overflowX).to.equal("auto");
    expect(viewportStyle.overflowY).to.equal("hidden");
    expect(viewportStyle.scrollSnapType).to.contain("inline");
    expect(viewportStyle.scrollSnapType).to.contain("mandatory");
    expect(getComputedStyle(slidesOf(el)[0]).scrollSnapAlign).to.contain("start");
    // Three viewport-width slides in a 300px allocation: the track really overflows, which is what
    // makes the browser's own touch/momentum scrolling available at all.
    expect(viewport.scrollWidth).to.be.greaterThan(viewport.clientWidth);
    expect(Math.round(slidesOf(el)[0].getBoundingClientRect().width)).to.equal(
      Math.round(viewport.clientWidth)
    );
  });

  it("resolves a percentage --scroll-hint against the live allocation", async () => {
    const el = await sized();
    const viewport = viewportOf(el);
    el.style.setProperty("--scroll-hint", "10%");
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

    const viewportRect = viewport.getBoundingClientRect();
    const firstRect = slidesOf(el)[0].getBoundingClientRect();
    expect(Math.round(firstRect.left - viewportRect.left)).to.equal(30);
    expect(Math.round(firstRect.width)).to.equal(240);
  });

  it("adopts the slide the user scrolled to and announces it once", async () => {
    const el = await sized();
    const viewport = viewportOf(el);
    const delta = inlineDelta(el, slidesOf(el)[1]);
    let changes = 0;
    el.addEventListener("lr-slide-change", () => (changes += 1));

    const changed = oneEvent(el, "lr-slide-change");
    viewport.scrollBy({ left: delta, behavior: "instant" });
    const event = await changed;
    await new Promise<void>((resolve) => setTimeout(resolve, SETTLE_WAIT));

    expect(event.detail).to.deep.equal({ index: 1, slide: slidesOf(el)[1] });
    expect(el.index).to.equal(1);
    expect(changes, "one settled gesture emits exactly one change").to.equal(1);
    expect(slidesOf(el)[1].inert).to.be.false;
    expect(slidesOf(el)[0].inert).to.be.true;
  });

  it("settles instead of reacting to every scroll event of one gesture", async () => {
    const el = await sized();
    const viewport = viewportOf(el);
    let changes = 0;
    el.addEventListener("lr-slide-change", () => (changes += 1));

    viewport.scrollBy({ left: inlineDelta(el, slidesOf(el)[2]), behavior: "instant" });
    for (let tick = 0; tick < 6; tick += 1) {
      viewport.dispatchEvent(new Event("scroll"));
    }
    await new Promise<void>((resolve) => setTimeout(resolve, SETTLE_WAIT));

    expect(el.index).to.equal(2);
    expect(changes).to.equal(1);
  });

  it("maps a scroll to the visually adjacent slide under RTL", async () => {
    const el = await sized("rtl");
    const viewport = viewportOf(el);
    const delta = inlineDelta(el, slidesOf(el)[1]);

    expect(delta, "the second slide sits to the inline start, i.e. left, under RTL").to.be.lessThan(
      0
    );
    const changed = oneEvent(el, "lr-slide-change");
    viewport.scrollBy({ left: delta, behavior: "instant" });
    const event = await changed;

    expect(event.detail).to.deep.equal({ index: 1, slide: slidesOf(el)[1] });
    expect(el.index).to.equal(1);
  });

  it("does not scroll the track back when the index came from the user's own scroll", async () => {
    const el = await sized();
    const viewport = viewportOf(el);
    const delta = inlineDelta(el, slidesOf(el)[1]);
    const changed = oneEvent(el, "lr-slide-change");
    viewport.scrollBy({ left: delta, behavior: "instant" });
    await changed;

    const calls: unknown[] = [];
    const original = viewport.scrollBy.bind(viewport);
    viewport.scrollBy = ((...args: unknown[]) => {
      calls.push(args[0]);
      return (original as (...a: unknown[]) => void)(...args);
    }) as typeof viewport.scrollBy;
    try {
      await new Promise<void>((resolve) => setTimeout(resolve, SETTLE_WAIT));
      expect(calls.length, "adopting a scrolled slide must not re-drive the scroller").to.equal(0);
    } finally {
      viewport.scrollBy = original;
    }
  });

  it("scrolls the track when a button, key, or the index property changes the slide", async () => {
    const el = await sized();
    const viewport = viewportOf(el);
    const next = el.shadowRoot!.querySelector('[part~="next-button"]') as HTMLButtonElement;

    next.click();
    await el.updateComplete;
    await scrollAtRest(el);

    expect(el.index).to.equal(1);
    expect(
      Math.abs(inlineDelta(el, slidesOf(el)[1])),
      "slide two is flush with the viewport",
    ).to.be.at.most(2);
    expect(viewport.scrollLeft).to.not.equal(0);
  });

  it("scrolls instantly rather than smoothly under prefers-reduced-motion", async () => {
    // `instant`, not `auto`: `auto` defers to the stylesheet, whose own `scroll-behavior: smooth`
    // would animate the very scroll the preference asks not to animate.
    const originalMatchMedia = window.matchMedia;
    window.matchMedia = ((query: string) => ({
      matches: query === "(prefers-reduced-motion: reduce)",
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    })) as typeof window.matchMedia;

    try {
      const el = await sized();
      const viewport = viewportOf(el);
      const behaviors: (string | undefined)[] = [];
      const original = viewport.scrollBy.bind(viewport);
      viewport.scrollBy = ((options: ScrollToOptions) => {
        behaviors.push(options?.behavior);
        return (original as (o: ScrollToOptions) => void)(options);
      }) as typeof viewport.scrollBy;

      el.goTo(2);
      await el.updateComplete;
      expect(behaviors).to.deep.equal(["instant"]);
    } finally {
      window.matchMedia = originalMatchMedia;
    }
  });

  it("scrolls smoothly when motion is allowed", async () => {
    const el = await sized();
    const viewport = viewportOf(el);
    const behaviors: (string | undefined)[] = [];
    const original = viewport.scrollBy.bind(viewport);
    viewport.scrollBy = ((options: ScrollToOptions) => {
      behaviors.push(options?.behavior);
      return (original as (o: ScrollToOptions) => void)(options);
    }) as typeof viewport.scrollBy;

    el.goTo(2);
    await el.updateComplete;
    expect(behaviors).to.deep.equal(["smooth"]);
  });

  it("drops a pending scroll settle when the carousel disconnects mid-gesture", async () => {
    const el = await sized();
    const viewport = viewportOf(el);
    const parent = el.parentElement!;
    let changes = 0;
    el.addEventListener("lr-slide-change", () => (changes += 1));

    viewport.scrollBy({ left: inlineDelta(el, slidesOf(el)[1]), behavior: "instant" });
    el.remove();
    await new Promise<void>((resolve) => setTimeout(resolve, SETTLE_WAIT));

    expect(changes).to.equal(0);
    expect(el.index).to.equal(0);
    parent.append(el);
  });

  it("scrolls all the way to the last slide, without stopping at the ones it crosses", async () => {
    const el = await sized();
    const viewport = viewportOf(el);

    viewport.focus();
    viewport.dispatchEvent(new KeyboardEvent("keydown", { key: "End", bubbles: true }));
    await el.updateComplete;
    await scrollAtRest(el);

    expect(el.index).to.equal(2);
    // scroll-snap-stop: always would strand this a whole slide short.
    expect(Math.abs(inlineDelta(el, slidesOf(el)[2]))).to.be.at.most(2);
  });

  it("shows several slides at once through --lr-carousel-slide-basis", async () => {
    const el = await sized();
    const viewport = viewportOf(el);
    const slideWidth = () => slidesOf(el)[0].getBoundingClientRect().width;
    expect(Math.round(slideWidth()), "unset, one slide fills the viewport").to.equal(
      Math.round(viewport.clientWidth)
    );

    el.style.setProperty("--lr-carousel-slide-basis", "50%");
    await el.updateComplete;
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    expect(Math.round(slideWidth())).to.equal(Math.round(viewport.clientWidth / 2));
    expect(getComputedStyle(slidesOf(el)[0]).scrollSnapAlign).to.contain("start");
  });

  it("is accessible with focusable content inside an off-screen slide", async () => {
    const el = await carousel(html`
      <lr-carousel aria-label="Panels" style="inline-size: 300px">
        <div><a href="#one">First link</a></div>
        <div><a href="#two">Second link</a></div>
      </lr-carousel>
    `);
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    expect(slidesOf(el)[1].inert).to.be.true;
    await expect(el).to.be.accessible();
  });
});

describe("carousel drag completion", () => {
  function dragViewport(el: LyraCarousel): HTMLElement {
    const viewport = el.shadowRoot!.querySelector(
      '[part~="scroll-container"]'
    ) as HTMLElement;
    viewport.setPointerCapture = () => {};
    viewport.releasePointerCapture = () => {};
    viewport.hasPointerCapture = () => true;
    return viewport;
  }

  function startDrag(viewport: HTMLElement, pointerId: number): void {
    viewport.dispatchEvent(
      new PointerEvent("pointerdown", {
        pointerId,
        pointerType: "mouse",
        button: 0,
        clientX: 200,
        bubbles: true,
      })
    );
    viewport.dispatchEvent(
      new PointerEvent("pointermove", {
        pointerId,
        pointerType: "mouse",
        clientX: 120,
        bubbles: true,
      })
    );
  }

  it("ends a drag on pointerup and swallows the click the gesture would emit", async () => {
    const el = await carousel(html`
      <lr-carousel mouse-dragging style="inline-size: 320px">
        <lr-carousel-item>One</lr-carousel-item>
        <lr-carousel-item>Two</lr-carousel-item>
      </lr-carousel>
    `);
    const viewport = dragViewport(el);
    startDrag(viewport, 7);
    expect(viewport.hasAttribute("data-dragging")).to.be.true;

    viewport.dispatchEvent(
      new PointerEvent("pointerup", { pointerId: 7, pointerType: "mouse", bubbles: true })
    );
    expect(viewport.hasAttribute("data-dragging")).to.be.false;

    const swallowed = new MouseEvent("click", { bubbles: true, cancelable: true });
    viewport.dispatchEvent(swallowed);
    expect(swallowed.defaultPrevented, "the click that ends a drag never reaches a slide").to.be
      .true;

    // A pointerup for some other pointer is not this drag and must be ignored.
    viewport.dispatchEvent(
      new PointerEvent("pointerup", { pointerId: 99, pointerType: "mouse", bubbles: true })
    );
    expect(el.currentSlide).to.equal(0);
  });

  it("ends a drag when the viewport loses pointer capture", async () => {
    const el = await carousel(html`
      <lr-carousel mouse-dragging style="inline-size: 320px">
        <lr-carousel-item>One</lr-carousel-item>
        <lr-carousel-item>Two</lr-carousel-item>
      </lr-carousel>
    `);
    const viewport = dragViewport(el);
    startDrag(viewport, 8);
    expect(viewport.hasAttribute("data-dragging")).to.be.true;

    viewport.dispatchEvent(
      new PointerEvent("lostpointercapture", {
        pointerId: 8,
        pointerType: "mouse",
        bubbles: true,
      })
    );
    expect(viewport.hasAttribute("data-dragging")).to.be.false;
    expect(el.currentSlide).to.equal(0);
  });

  it("lets an ordinary click through when no drag preceded it", async () => {
    const el = await carousel(html`
      <lr-carousel mouse-dragging style="inline-size: 320px">
        <lr-carousel-item>One</lr-carousel-item>
        <lr-carousel-item>Two</lr-carousel-item>
      </lr-carousel>
    `);
    const viewport = dragViewport(el);
    const plain = new MouseEvent("click", { bubbles: true, cancelable: true });
    viewport.dispatchEvent(plain);
    expect(plain.defaultPrevented).to.be.false;
  });
});
