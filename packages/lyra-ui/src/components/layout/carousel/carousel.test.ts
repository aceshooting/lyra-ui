import { expect, fixture, html, oneEvent } from "@open-wc/testing";
import "./carousel.js";
import "./carousel-item.js";
import type { LyraCarousel } from "./carousel.js";
import { styles } from "./carousel.styles.js";

async function carousel(
  template = html`
    <lr-carousel>
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

it("exposes one visible slide and localized navigation controls", async () => {
  const el = await carousel();
  const slides = [...el.children] as HTMLElement[];

  expect(slides[0].hidden).to.be.false;
  expect(slides[1].hidden).to.be.true;
  expect(slides[0].hasAttribute("role")).to.be.false;
  expect(slides[0].hasAttribute("aria-roledescription")).to.be.false;
  expect(el.shadowRoot!.querySelectorAll('[part="indicator"]').length).to.equal(
    3
  );
  // The indicators are a plain labelled button group, not a tablist -- there is no tabpanel for
  // them to control, so role="tab"/aria-selected would announce a broken relationship to AT.
  expect(
    el.shadowRoot!.querySelector('[part="indicators"]')!.getAttribute("role")
  ).to.equal("group");
  expect(
    el.shadowRoot!.querySelector('[part="indicator"]')!.getAttribute("role")
  ).to.be.null;
});

it("gives each indicator the shared minimum hit area without inflating the visible dot", async () => {
  const el = await carousel();
  const indicator = el.shadowRoot!.querySelector(
    '[part="indicator"]'
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
  expect(el.shadowRoot!.querySelector('[part="indicators"]')).to.be.null;
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
  expect(el.shadowRoot!.querySelector('[part="indicators"]')).to.be.null;
});

it("removing the show-indicators attribute restores the true default", async () => {
  const el = await carousel(html`
    <lr-carousel show-indicators="false">
      <div>One</div>
      <div>Two</div>
    </lr-carousel>
  `);
  expect(el.showIndicators).to.be.false;
  el.removeAttribute("show-indicators");
  await el.updateComplete;
  expect(el.showIndicators).to.be.true;
  expect(el.shadowRoot!.querySelector('[part="indicators"]')).to.not.be.null;
});

it("emits slide changes and supports keyboard navigation", async () => {
  const el = await carousel();
  const next = el.shadowRoot!.querySelector(
    '[part="next-button"]'
  ) as HTMLButtonElement;
  const eventPromise = oneEvent(el, "lr-slide-change");
  next.click();
  const event = await eventPromise;

  expect(event.detail).to.deep.equal({ index: 1 });
  expect(el.index).to.equal(1);

  const viewport = el.shadowRoot!.querySelector(
    '[part="viewport"]'
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
    '[part="viewport"]'
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

it("clamps a NaN, negative, or oversized index to a valid slide instead of NaN/out-of-range", async () => {
  const el = await carousel();

  el.index = NaN;
  await el.updateComplete;
  expect(el.index).to.equal(0);
  expect(([...el.children] as HTMLElement[])[0].hidden).to.be.false;

  el.index = -5;
  await el.updateComplete;
  expect(el.index).to.equal(0);
  expect(
    (
      el.shadowRoot!.querySelectorAll('[part="indicator"]')[0] as HTMLElement
    ).getAttribute("aria-current")
  ).to.equal("true");

  el.index = 999;
  await el.updateComplete;
  expect(el.index).to.equal(2);
  const indicators = el.shadowRoot!.querySelectorAll('[part="indicator"]');
  expect(
    indicators[indicators.length - 1].getAttribute("aria-current")
  ).to.equal("true");
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
    <lr-carousel dir="rtl">
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
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(el.index).to.equal(0);
  } finally {
    window.matchMedia = originalMatchMedia;
  }
});

it("localizes every default string via .strings, proving the call sites are actually wired up", async () => {
  const el = await carousel(html`
    <lr-carousel
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
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  expect(base.getAttribute("aria-roledescription")).to.equal("carrousel");
  expect(base.getAttribute("aria-label")).to.equal("Carrousel");
  expect(
    el
      .shadowRoot!.querySelector('[part="previous-button"]')!
      .getAttribute("aria-label")
  ).to.equal("Précédent");
  expect(
    el
      .shadowRoot!.querySelector('[part="next-button"]')!
      .getAttribute("aria-label")
  ).to.equal("Suivant");
  expect(
    el
      .shadowRoot!.querySelector('[part="indicators"]')!
      .getAttribute("aria-label")
  ).to.equal("Diapositives du carrousel");
  expect(
    el
      .shadowRoot!.querySelector('[part="indicator"]')!
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

it("restores wrapper-owned visibility and slide metadata when slides are removed or the carousel disconnects", async () => {
  const el = await carousel(html`
    <lr-carousel>
      <lr-carousel-item aria-label="Author label">One</lr-carousel-item>
      <lr-carousel-item aria-hidden="false">Two</lr-carousel-item>
    </lr-carousel>
  `);
  const [first, second] = [...el.children] as HTMLElement[];
  expect(second.hidden).to.be.true;

  second.remove();
  el.dispatchEvent(new Event("slotchange"));
  await el.updateComplete;
  expect(second.hidden).to.be.false;
  expect(second.getAttribute("aria-hidden")).to.equal("false");

  const parent = el.parentElement!;
  el.remove();
  expect(first.hidden).to.be.false;
  expect(first.getAttribute("aria-label")).to.equal("Author label");
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
    <lr-carousel locale="ar-EG">
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
      .shadowRoot!.querySelector('[part="indicator"]')!
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
    el.shadowRoot!.querySelector('[part="base"]')!.getAttribute("aria-label")
  ).to.equal("Product screenshots");
  await expect(el).to.be.accessible();
});

it('names the focusable viewport with role="group", following the same label arbitration as the region', async () => {
  const el = await carousel(html`
    <lr-carousel>
      <div>Slide one</div>
      <div>Slide two</div>
    </lr-carousel>
  `);
  const viewport = el.shadowRoot!.querySelector(
    '[part="viewport"]'
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
  expect(css).to.match(/\[part='indicator'\]:hover \[part='indicator-dot'\]/);
});

it("gives the keyboard-focusable viewport matching hover feedback", () => {
  const css = styles.cssText.replace(/\s+/g, " ").replaceAll('"', "'");
  expect(css).to.match(/\[part='viewport'\]:hover/);
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
        <lr-carousel>
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
      '[part="indicator"][aria-current="true"] [part="indicator-dot"]'
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
      '[part="indicator"][aria-current="false"] [part="indicator-dot"]'
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
