// Focused rendering and accessibility cases. Test bodies and titles were moved intact from the prior suite.
import { expectStaleAttribute } from '../../../../test/expected-stale-attributes.js';
import { fixture, expect, html, elementUpdated, waitUntil } from "@open-wc/testing";
import "./slider.js";
import type { LyraSlider } from "./slider.js";
import { styles } from "./slider.styles.js";
import { resetMouse, sendMouse } from "../../../../test/wtr-mouse.js";
import { setReducedMotion } from "../../../../test/wtr-media.js";
import { expectDeprecatedUsage } from "../../../../test/expected-deprecations.js";
import "../../../translations/ar/forms.js";

expectDeprecatedUsage("lr-slider", "property", "showValue");

expectStaleAttribute('lr-slider', 'show-value');

function mockTrackWidth(el: LyraSlider, width: number): void {
  const track = el.shadowRoot!.querySelector('[part="track"]') as HTMLElement;
  track.getBoundingClientRect = () =>
    ({
      left: 0,
      top: 0,
      right: width,
      bottom: 0,
      width,
      height: 0,
      x: 0,
      y: 0,
      toJSON() {
        return {};
      },
    } as DOMRect);
}

function handles(el: LyraSlider): HTMLElement[] {
  return Array.from(
    el.shadowRoot!.querySelectorAll('[part~="thumb"]')
  ) as HTMLElement[];
}

function stubPointerCapture(el: LyraSlider): void {
  for (const handle of handles(el)) handle.setPointerCapture = () => {};
}

function paintsHeadFirst(host: Element, text: string, head: number): boolean {
  const walker = document.createTreeWalker(host, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node && node.textContent !== text) node = walker.nextNode();
  if (!node) return false;
  const a = document.createRange();
  a.setStart(node, 0);
  a.setEnd(node, head);
  const b = document.createRange();
  b.setStart(node, head);
  b.setEnd(node, text.length);
  return a.getBoundingClientRect().left < b.getBoundingClientRect().left;
}

it("themes slider thumb rest, hover, and pressed paint through component hooks", async () => {
  const el = (await fixture(html`
    <lr-slider
      aria-label="Volume"
      style="
        --lr-slider-thumb-bg: rgb(1, 2, 3);
        --lr-slider-thumb-border-color: rgb(4, 5, 6);
        --lr-slider-thumb-hover-ring-color: rgb(7, 8, 9);
        --lr-slider-thumb-active-ring-color: rgb(10, 11, 12);
      "
    ></lr-slider>
  `)) as LyraSlider;
  const thumb = el.shadowRoot!.querySelector<HTMLElement>('[part~="thumb"]')!;
  expect(getComputedStyle(thumb).backgroundColor).to.equal("rgb(1, 2, 3)");
  expect(getComputedStyle(thumb).borderTopColor).to.equal("rgb(4, 5, 6)");
  const rect = thumb.getBoundingClientRect();
  try {
    await sendMouse({
      type: "move",
      position: [
        Math.round(rect.left + rect.width / 2),
        Math.round(rect.top + rect.height / 2),
      ],
    });
    // A single synchronous read right after sendMouse resolves can race a still-settling
    // :hover/:active recalculation under CI load (real, observed cross-run flake on this exact
    // assertion) -- poll instead of snapshotting once, mirroring menu.test.ts's identical
    // waitUntil(() => getComputedStyle(...)) pattern for a transitioning visual state.
    await waitUntil(
      () => getComputedStyle(thumb).boxShadow.includes("rgb(7, 8, 9)"),
      "hover ring never painted"
    );
    await sendMouse({ type: "down" });
    await waitUntil(
      () => getComputedStyle(thumb).boxShadow.includes("rgb(10, 11, 12)"),
      "active ring never painted"
    );
  } finally {
    await sendMouse({ type: "up" });
    await resetMouse();
  }
});

it("contains standalone unbroken label, reference, and hint content at 320px in LTR and RTL", async () => {
  const text =
    "InternationalizedSliderContentWithoutAnyNaturalBreakOpportunity";
  for (const direction of ["ltr", "rtl"] as const) {
    const wrapper = await fixture<HTMLDivElement>(html`
      <div dir=${direction} style="inline-size: 320px; max-inline-size: 320px">
        <lr-slider label=${text} hint=${text} with-value>
          <span slot="reference">${text}</span>
        </lr-slider>
      </div>
    `);
    const slider = wrapper.querySelector("lr-slider")!;
    expect(wrapper.scrollWidth, `dir=${direction} wrapper`).to.be.at.most(
      wrapper.clientWidth
    );
    expect(
      slider.getBoundingClientRect().width,
      `dir=${direction} host`
    ).to.be.at.most(wrapper.getBoundingClientRect().width);
  }
});

describe("mapped presentation surface", () => {
  it("renders label/reference slots and their named parts", async () => {
    const el = (await fixture(html`
      <lr-slider with-label label="Budget">
        <strong slot="label">Range</strong>
        <span slot="reference">Low — High</span>
      </lr-slider>
    `)) as LyraSlider;
    expect(
      el.shadowRoot!.querySelectorAll('[part~="label"] slot[name="label"]')
        .length
    ).to.equal(1);
    expect(
      el.shadowRoot!.querySelectorAll(
        '[part="references"] slot[name="reference"]'
      ).length
    ).to.equal(1);
  });

  it("uses indicatorOffset and exposes tooltip placement/distance subparts", async () => {
    const el = (await fixture(html`
      <lr-slider
        value="25"
        indicator-offset="50"
        with-tooltip
        tooltip-placement="bottom"
        tooltip-distance="12"
      ></lr-slider>
    `)) as LyraSlider;
    const indicator = el.shadowRoot!.querySelector(
      '[part="indicator"]'
    ) as HTMLElement;
    expect(indicator.style.insetInlineStart).to.equal("25%");
    expect(indicator.style.inlineSize).to.equal("25%");
    expect(el.tooltipPlacement).to.equal("bottom");
    expect(el.tooltipDistance).to.equal(12);
    expect(
      el.shadowRoot!.querySelectorAll('[part~="tooltip__tooltip"]').length
    ).to.equal(1);
    expect(
      el.shadowRoot!.querySelectorAll('[part="tooltip__content"]').length
    ).to.equal(1);
    expect(
      el.shadowRoot!.querySelectorAll('[part="tooltip__arrow"]').length
    ).to.equal(1);
  });

  it("forwards autofocus to the actual first thumb", async () => {
    const el = (await fixture(
      html`<lr-slider autofocus></lr-slider>`
    )) as LyraSlider;
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => resolve())
    );
    expect(el.shadowRoot!.activeElement?.getAttribute("part")).to.equal(
      "thumb"
    );
  });

  it("schedules and cancels autofocus through the first-render owner window", async () => {
    const frame = document.createElement("iframe");
    document.body.append(frame);
    const frameDocument = frame.contentDocument!;
    const frameWindow = frame.contentWindow!;
    const originalRequest = frameWindow.requestAnimationFrame;
    const originalCancel = frameWindow.cancelAnimationFrame;
    const callbacks = new Map<number, FrameRequestCallback>();
    const cancelled: number[] = [];
    let nextHandle = 90;
    let el: LyraSlider | undefined;

    try {
      frameWindow.requestAnimationFrame = ((callback: FrameRequestCallback) => {
        const handle = ++nextHandle;
        callbacks.set(handle, callback);
        return handle;
      }) as typeof requestAnimationFrame;
      frameWindow.cancelAnimationFrame = ((handle: number) => {
        cancelled.push(handle);
        callbacks.delete(handle);
      }) as typeof cancelAnimationFrame;
      el = document.createElement("lr-slider") as LyraSlider;
      el.autofocus = true;
      // Attach the defining realm's constructed styles before adoption without starting an update;
      // the first real render can then create its controls in the iframe document.
      const lifecycle = el as unknown as {
        renderRoot: HTMLElement | DocumentFragment;
        createRenderRoot(): ShadowRoot;
      };
      lifecycle.renderRoot = lifecycle.createRenderRoot();
      frameDocument.body.append(frameDocument.adoptNode(el));
      await el.updateComplete;

      expect([...callbacks.keys()]).to.deep.equal([91]);
      el.remove();
      expect(cancelled).to.deep.equal([91]);
      expect(callbacks.size).to.equal(0);
    } finally {
      el?.remove();
      frameWindow.requestAnimationFrame = originalRequest;
      frameWindow.cancelAnimationFrame = originalCancel;
      frame.remove();
    }
  });

  it("anchors both range tooltips on the value axis in horizontal, vertical, and RTL layouts", async () => {
    const horizontal = (await fixture(html`
      <lr-slider
        dir="rtl"
        range
        with-tooltip
        min-value="20"
        max-value="80"
      ></lr-slider>
    `)) as LyraSlider;
    const horizontalTooltips = [
      ...horizontal.shadowRoot!.querySelectorAll<HTMLElement>(
        '[part~="tooltip"]'
      ),
    ];
    expect(
      horizontalTooltips.map((tooltip) => tooltip.style.insetInlineStart)
    ).to.deep.equal(["20%", "80%"]);
    expect(
      horizontalTooltips.every(
        (tooltip) => !tooltip.style.cssText.includes("NaN")
      )
    ).to.be.true;

    const vertical = (await fixture(html`
      <lr-slider
        dir="rtl"
        orientation="vertical"
        range
        with-tooltip
        min-value="20"
        max-value="80"
      ></lr-slider>
    `)) as LyraSlider;
    const verticalTooltips = [
      ...vertical.shadowRoot!.querySelectorAll<HTMLElement>(
        '[part~="tooltip"]'
      ),
    ];
    expect(
      verticalTooltips.map((tooltip) => tooltip.style.insetBlockEnd)
    ).to.deep.equal(["20%", "80%"]);
    expect(
      verticalTooltips.every(
        (tooltip) => !tooltip.style.cssText.includes("NaN")
      )
    ).to.be.true;
  });
});

it("renders the indicator and thumb position from the current percent-of-range", async () => {
  const el = (await fixture(
    html`<lr-slider min="0" max="100" value="25"></lr-slider>`
  )) as LyraSlider;
  const indicator = el.shadowRoot!.querySelector(
    '[part="indicator"]'
  ) as HTMLElement;
  const thumb = el.shadowRoot!.querySelector('[part="thumb"]') as HTMLElement;
  expect(indicator.style.inlineSize).to.equal("25%");
  expect(indicator.style.insetInlineStart).to.equal("0%");
  expect(thumb.style.insetInlineStart).to.equal("25%");
  // The filled portion is exposed as `indicator` (matching the wider slider
  // vocabulary); the former `fill` name is gone rather than aliased.
  expect(el.shadowRoot!.querySelectorAll('[part~="fill"]').length).to.equal(0);
});

it("renders the visible value readout when requested, and omits it by default", async () => {
  const shown = (await fixture(
    html`<lr-slider value="42" with-value></lr-slider>`
  )) as LyraSlider;
  const readout = shown.shadowRoot!.querySelector(
    '[part="value"]'
  ) as HTMLElement;
  expect(readout != null).to.equal(true);
  expect(readout.textContent).to.equal("42");
  expect(readout.getAttribute("aria-hidden")).to.equal("true");

  const hidden = (await fixture(
    html`<lr-slider value="42" .withValue=${false}></lr-slider>`
  )) as LyraSlider;
  expect(hidden.shadowRoot!.querySelector('[part="value"]') === null).to.equal(
    true
  );
});

it("maps a numeric value to opt-in human-readable aria-valuetext without changing the visible readout", async () => {
  const el = (await fixture(html`
    <lr-slider
      with-value
      min="0"
      max="2"
      value="1"
      .valueFormatter=${(value: number) => ["Cold", "Warm", "Hot"][value]}
    ></lr-slider>
  `)) as LyraSlider;
  const thumb = el.shadowRoot!.querySelector('[part="thumb"]') as HTMLElement;
  const readout = el.shadowRoot!.querySelector('[part="value"]') as HTMLElement;

  expect(thumb.getAttribute("aria-valuenow")).to.equal("1");
  expect(thumb.getAttribute("aria-valuetext")).to.equal("Warm");
  expect(readout.textContent).to.equal("1");
});

it("formats the default visible value and aria-valuetext with the effective locale", async () => {
  const el = (await fixture(
    html`<lr-slider
      with-value
      lang="ar-EG"
      min="0"
      max="2000"
      value="1234"
    ></lr-slider>`
  )) as LyraSlider;
  const formatted = new Intl.NumberFormat("ar-EG", {
    maximumFractionDigits: 20,
  }).format(1234);
  expect(
    el
      .shadowRoot!.querySelector('[part="thumb"]')!
      .getAttribute("aria-valuetext")
  ).to.equal(formatted);
  expect(el.shadowRoot!.querySelector('[part="value"]')!.textContent).to.equal(
    formatted
  );
});

it("preserves numeric aria-valuetext when valueFormatter is unset and omits it for a nullish result", async () => {
  const el = (await fixture(
    html`<lr-slider value="42"></lr-slider>`
  )) as LyraSlider;
  const thumb = el.shadowRoot!.querySelector('[part="thumb"]') as HTMLElement;
  expect(thumb.getAttribute("aria-valuetext")).to.equal("42");

  el.valueFormatter = () => undefined;
  await el.updateComplete;
  expect(thumb.hasAttribute("aria-valuetext")).to.be.false;
});

it("lets a forwarded host aria-label win on the thumb while retaining the label prop fallback", async () => {
  const labeled = (await fixture(
    html`<lr-slider label="Temperature"></lr-slider>`
  )) as LyraSlider;
  const thumb1 = labeled.shadowRoot!.querySelector(
    '[part="thumb"]'
  ) as HTMLElement;
  expect(thumb1.getAttribute("aria-labelledby")).to.equal("slider-label");
  expect(
    labeled.shadowRoot!.querySelector('[part~="label"]')!.textContent
  ).to.contain("Temperature");

  const forwarded = (await fixture(
    html`<lr-slider aria-label="Forwarded label"></lr-slider>`
  )) as LyraSlider;
  const thumb2 = forwarded.shadowRoot!.querySelector(
    '[part="thumb"]'
  ) as HTMLElement;
  expect(thumb2.getAttribute("aria-label")).to.equal("Forwarded label");

  const hostOverride = (await fixture(
    html`<lr-slider label="Temperature" aria-label="Author label"></lr-slider>`
  )) as LyraSlider;
  const thumb3 = hostOverride.shadowRoot!.querySelector(
    '[part="thumb"]'
  ) as HTMLElement;
  expect(thumb3.getAttribute("aria-label")).to.equal("Author label");
});

it("preserves an explicitly empty host aria-label on both slider role-owner shapes", async () => {
  const single = (await fixture(
    html`<lr-slider aria-label="" label="Volume"></lr-slider>`
  )) as LyraSlider;
  const thumb = single.shadowRoot!.querySelector(
    '[part="thumb"]'
  ) as HTMLElement;
  expect(thumb.hasAttribute("aria-label")).to.equal(true);
  expect(thumb.getAttribute("aria-label")).to.equal("");
  expect(thumb.hasAttribute("aria-labelledby")).to.equal(false);

  const range = (await fixture(
    html`<lr-slider range aria-label="" label="Budget"></lr-slider>`
  )) as LyraSlider;
  const base = range.shadowRoot!.querySelector('[part~="base"]') as HTMLElement;
  expect(base.hasAttribute("aria-label")).to.equal(true);
  expect(base.getAttribute("aria-label")).to.equal("");
  expect(base.hasAttribute("aria-labelledby")).to.equal(false);
});

it("falls back to the localized generic slider label when neither `label` nor a host aria-label is set", async () => {
  const el = (await fixture(html`<lr-slider></lr-slider>`)) as LyraSlider;
  const thumb = el.shadowRoot!.querySelector('[part="thumb"]') as HTMLElement;
  expect(thumb.getAttribute("aria-label")).to.equal("Slider");
});

it("resolves the generic slider label through the strings override", async () => {
  const el = (await fixture(
    html`<lr-slider .strings=${{ sliderLabel: "Curseur" }}></lr-slider>`
  )) as LyraSlider;
  const thumb = el.shadowRoot!.querySelector('[part="thumb"]') as HTMLElement;
  expect(thumb.getAttribute("aria-label")).to.equal("Curseur");
});

it('does not render invalid CSS or an aria-valuenow="Infinity" when max is Infinity', async () => {
  // No `value` attribute: the default still has to remain finite against a hostile domain.
  const el = (await fixture(
    html`<lr-slider min="0" max="Infinity"></lr-slider>`
  )) as LyraSlider;
  await elementUpdated(el);
  const thumb = el.shadowRoot!.querySelector('[part="thumb"]') as HTMLElement;
  // Before the fix, domain()'s `isNaN(this.max)` guard let Infinity straight
  // through (isNaN(Infinity) is false), poisoning value, CSS geometry, and ARIA.
  expect(thumb.style.insetInlineStart).to.match(/^-?\d+(\.\d+)?%$/);
  expect(thumb.getAttribute("aria-valuenow")).to.not.equal("Infinity");
  expect(Number.isFinite(Number(thumb.getAttribute("aria-valuenow")))).to.be
    .true;
});

it('flips the thumb and hit-area centering translate under dir="rtl"', async () => {
  const ltr = (await fixture(
    html`<lr-slider value="20"></lr-slider>`
  )) as LyraSlider;
  const ltrThumb = ltr.shadowRoot!.querySelector(
    '[part="thumb"]'
  ) as HTMLElement;
  expect(
    new DOMMatrixReadOnly(getComputedStyle(ltrThumb).transform).m41
  ).to.be.lessThan(0);
  expect(
    new DOMMatrixReadOnly(getComputedStyle(ltrThumb, "::before").transform).m41
  ).to.be.lessThan(0);

  // The thumb (and its enlarged ::before hit-area) is positioned via a logical
  // inset-inline-start percentage, which anchors to the physical right edge under RTL -- the
  // centering translateX must flip to positive there or the visible dot (and the drag hit
  // zone) lands a full box-width off from its true track position.
  const rtl = (await fixture(
    html`<lr-slider dir="rtl" value="20"></lr-slider>`
  )) as LyraSlider;
  const rtlThumb = rtl.shadowRoot!.querySelector(
    '[part="thumb"]'
  ) as HTMLElement;
  expect(
    new DOMMatrixReadOnly(getComputedStyle(rtlThumb).transform).m41
  ).to.be.greaterThan(0);
  expect(
    new DOMMatrixReadOnly(getComputedStyle(rtlThumb, "::before").transform).m41
  ).to.be.greaterThan(0);
});

it("gives every thumb a :hover rule alongside its :focus-visible ring, gated on neither disabled nor readonly", () => {
  const css = styles.cssText.replace(/"/g, "'").replace(/\s+/g, " ");
  expect(css).to.match(
    /:host\(:not\(:disabled\):not\(\[readonly\]\)\)\s*\[part~='thumb'\]:hover\s*\{[^}]*box-shadow:/
  );
});

it("applies the thumb hover ring to both range handles, and withdraws the grab cursor while readonly", async () => {
  const el = (await fixture(
    html`<lr-slider range min-value="20" max-value="80"></lr-slider>`
  )) as LyraSlider;
  // Rendered result rather than stylesheet text: the [part~='thumb'] selector
  // really reaches a handle whose part attribute is "thumb thumb-max".
  for (const handle of handles(el)) {
    expect(getComputedStyle(handle).cursor).to.equal("grab");
  }

  const readonlySlider = (await fixture(
    html`<lr-slider readonly></lr-slider>`
  )) as LyraSlider;
  expect(
    getComputedStyle(
      readonlySlider.shadowRoot!.querySelector('[part="thumb"]') as HTMLElement
    ).cursor
  ).to.equal("default");
});

it("is accessible in the default (unset value, no label) state", async () => {
  const el = (await fixture(
    html`<lr-slider aria-label="Volume"></lr-slider>`
  )) as LyraSlider;
  await expect(el).to.be.accessible();
});

it("is accessible in a populated, labeled state with a fractional step", async () => {
  const el = (await fixture(
    html`<lr-slider
      label="Temperature"
      min="0"
      max="1"
      step="0.1"
      value="0.7"
    ></lr-slider>`
  )) as LyraSlider;
  await expect(el).to.be.accessible();
});

it("projects both aria-invalid polarities to every focusable range thumb", async () => {
  const el = (await fixture(html`
    <lr-slider
      range
      aria-label="Allowed interval"
      min="0"
      max="100"
      min-value="20"
      max-value="80"
    ></lr-slider>
  `)) as LyraSlider;
  const thumbs = [
    ...el.shadowRoot!.querySelectorAll('[role="slider"]'),
  ] as HTMLElement[];
  expect(
    thumbs.map((thumb) => thumb.getAttribute("aria-invalid"))
  ).to.deep.equal(["false", "false"]);

  el.setCustomValidity("Choose another interval.");
  el.reportValidity();
  await el.updateComplete;
  expect(el.checkValidity()).to.equal(false);
  expect(
    thumbs.map((thumb) => thumb.getAttribute("aria-invalid"))
  ).to.deep.equal(["true", "true"]);
  await expect(el).to.be.accessible();

  el.setCustomValidity("");
  await el.updateComplete;
  expect(
    thumbs.map((thumb) => thumb.getAttribute("aria-invalid"))
  ).to.deep.equal(["false", "false"]);
});

// ---------------------------------------------------------------------------
it('renders two independently named role="slider" handles in range mode', async () => {
  const el = (await fixture(html`
    <lr-slider
      range
      min="0"
      max="100"
      min-value="20"
      max-value="80"
    ></lr-slider>
  `)) as LyraSlider;

  expect(handles(el).length).to.equal(2);
  const minThumb = el.shadowRoot!.querySelector(
    '[part~="thumb-min"]'
  ) as HTMLElement;
  const maxThumb = el.shadowRoot!.querySelector(
    '[part~="thumb-max"]'
  ) as HTMLElement;
  expect(minThumb.getAttribute("role")).to.equal("slider");
  expect(maxThumb.getAttribute("role")).to.equal("slider");
  // Which handle is which is announced, never left to visual position (which
  // mirrors under RTL anyway).
  expect(minThumb.getAttribute("aria-label")).to.equal("Range start");
  expect(maxThumb.getAttribute("aria-label")).to.equal("Range end");
  expect(minThumb.getAttribute("tabindex")).to.equal("0");
  expect(maxThumb.getAttribute("tabindex")).to.equal("0");
  expect(el.minValue).to.equal(20);
  expect(el.maxValue).to.equal(80);
});

it("names the two-handle group from label/aria-label while each handle keeps its own name", async () => {
  const el = (await fixture(html`
    <lr-slider range label="Price" min-value="20" max-value="80"></lr-slider>
  `)) as LyraSlider;
  const base = el.shadowRoot!.querySelector('[part~="base"]') as HTMLElement;
  expect(base.getAttribute("role")).to.equal("group");
  expect(base.getAttribute("aria-labelledby")).to.equal("slider-label");

  const forwarded = (await fixture(html`
    <lr-slider range aria-label="Budget"></lr-slider>
  `)) as LyraSlider;
  expect(
    (
      forwarded.shadowRoot!.querySelector('[part~="base"]') as HTMLElement
    ).getAttribute("aria-label")
  ).to.equal("Budget");

  // A single-handle slider is not a group -- the thumb itself owns the name.
  const single = (await fixture(
    html`<lr-slider label="Price"></lr-slider>`
  )) as LyraSlider;
  expect(
    (
      single.shadowRoot!.querySelector('[part~="base"]') as HTMLElement
    ).hasAttribute("role")
  ).to.be.false;
});

it("renders the range indicator from min-value to max-value, not from the domain floor", async () => {
  const el = (await fixture(html`
    <lr-slider
      range
      min="0"
      max="100"
      min-value="20"
      max-value="80"
    ></lr-slider>
  `)) as LyraSlider;
  const indicator = el.shadowRoot!.querySelector(
    '[part="indicator"]'
  ) as HTMLElement;
  expect(indicator.style.insetInlineStart).to.equal("20%");
  expect(indicator.style.inlineSize).to.equal("60%");
});

it("shows both handle values in the readout, formatted with the effective locale", async () => {
  const el = (await fixture(html`
    <lr-slider
      with-value
      range
      lang="ar-EG"
      min="0"
      max="2000"
      min-value="1234"
      max-value="1500"
    ></lr-slider>
  `)) as LyraSlider;
  const readout = el.shadowRoot!.querySelector('[part="value"]') as HTMLElement;
  const formatter = new Intl.NumberFormat("ar-EG", {
    maximumFractionDigits: 20,
  });
  expect(readout.textContent).to.contain(formatter.format(1234));
  expect(readout.textContent).to.contain(formatter.format(1500));
});

// ---------------------------------------------------------------------------
it("announces aria-orientation on every handle in both orientations", async () => {
  const horizontal = (await fixture(
    html`<lr-slider></lr-slider>`
  )) as LyraSlider;
  expect(
    (
      horizontal.shadowRoot!.querySelector('[part="thumb"]') as HTMLElement
    ).getAttribute("aria-orientation")
  ).to.equal("horizontal");

  const vertical = (await fixture(html`
    <lr-slider range orientation="vertical"></lr-slider>
  `)) as LyraSlider;
  for (const handle of handles(vertical)) {
    expect(handle.getAttribute("aria-orientation")).to.equal("vertical");
  }
});

it("clamps an out-of-vocabulary orientation attribute to the declared default instead of forwarding it to aria-orientation", async () => {
  const el = (await fixture(
    html`<lr-slider orientation="diagonal"></lr-slider>`
  )) as LyraSlider;
  expect(el.orientation).to.equal("horizontal");
  expect(el.getAttribute("orientation")).to.equal("horizontal");
  expect(
    (
      el.shadowRoot!.querySelector('[part="thumb"]') as HTMLElement
    ).getAttribute("aria-orientation")
  ).to.equal("horizontal");
});

it("clamps an out-of-vocabulary orientation set directly on the property instead of forwarding it to aria-orientation", async () => {
  const el = (await fixture(html`<lr-slider></lr-slider>`)) as LyraSlider;
  (el as unknown as { orientation: string }).orientation = "diagonal";
  await el.updateComplete;
  expect(
    (
      el.shadowRoot!.querySelector('[part="thumb"]') as HTMLElement
    ).getAttribute("aria-orientation")
  ).to.equal("horizontal");
});

// ---------------------------------------------------------------------------
it("renders aria-readonly in both states", async () => {
  const el = (await fixture(html`<lr-slider></lr-slider>`)) as LyraSlider;
  const thumb = el.shadowRoot!.querySelector('[part="thumb"]') as HTMLElement;
  expect(thumb.getAttribute("aria-readonly")).to.equal("false");

  el.readonly = true;
  await elementUpdated(el);
  expect(thumb.getAttribute("aria-readonly")).to.equal("true");
});

// ---------------------------------------------------------------------------
it("renders one marker per step position when with-markers is set", async () => {
  const el = (await fixture(html`
    <lr-slider with-markers min="0" max="100" step="25"></lr-slider>
  `)) as LyraSlider;
  const markers = el.shadowRoot!.querySelectorAll('[part="marker"]');
  expect(markers.length).to.equal(5);
  expect((markers[0] as HTMLElement).style.insetInlineStart).to.equal("0%");
  expect((markers[4] as HTMLElement).style.insetInlineStart).to.equal("100%");
  expect(
    (
      el.shadowRoot!.querySelector('[part="markers"]') as HTMLElement
    ).getAttribute("aria-hidden")
  ).to.equal("true");
});

// ---------------------------------------------------------------------------
it("shows a locale-formatted tooltip while a handle is focused, and hides it on blur", async () => {
  const el = (await fixture(html`
    <lr-slider
      with-tooltip
      lang="ar-EG"
      min="0"
      max="2000"
      value="1234"
    ></lr-slider>
  `)) as LyraSlider;
  const tooltip = el.shadowRoot!.querySelector(
    '[part~="tooltip"]'
  ) as HTMLElement;
  expect(tooltip.textContent!.trim()).to.equal(
    new Intl.NumberFormat("ar-EG", { maximumFractionDigits: 20 }).format(1234)
  );
  expect(tooltip.getAttribute("aria-hidden")).to.equal("true");
  expect(tooltip.getAttribute("part")).to.equal("tooltip tooltip__tooltip");

  el.focus();
  await elementUpdated(el);
  expect(
    (
      el.shadowRoot!.querySelector('[part~="tooltip"]') as HTMLElement
    ).getAttribute("part")
  ).to.equal("tooltip tooltip__tooltip tooltip-visible");

  el.blur();
  await elementUpdated(el);
  expect(
    (
      el.shadowRoot!.querySelector('[part~="tooltip"]') as HTMLElement
    ).getAttribute("part")
  ).to.equal("tooltip tooltip__tooltip");
});

it("shows the dragged handle`s tooltip for the duration of the drag", async () => {
  const el = (await fixture(html`
    <lr-slider
      with-tooltip
      range
      min="0"
      max="100"
      step="1"
      min-value="20"
      max-value="80"
    ></lr-slider>
  `)) as LyraSlider;
  const maxThumb = el.shadowRoot!.querySelector(
    '[part~="thumb-max"]'
  ) as HTMLElement;
  stubPointerCapture(el);
  mockTrackWidth(el, 200);

  maxThumb.dispatchEvent(
    new PointerEvent("pointerdown", {
      bubbles: true,
      pointerId: 41,
      clientX: 160,
    })
  );
  window.dispatchEvent(
    new PointerEvent("pointermove", { pointerId: 41, clientX: 120 })
  );
  await elementUpdated(el);
  expect(
    el.shadowRoot!.querySelectorAll('[part~="tooltip-visible"]').length
  ).to.equal(1);
  const visible = el.shadowRoot!.querySelector(
    '[part~="tooltip-visible"]'
  ) as HTMLElement;
  expect(visible.textContent!.trim()).to.equal("60");

  window.dispatchEvent(new PointerEvent("pointerup", { pointerId: 41 }));
  await elementUpdated(el);
  expect(
    el.shadowRoot!.querySelectorAll('[part~="tooltip-visible"]').length
  ).to.equal(0);
});

it("uses valueFormatter for the tooltip text when one is supplied", async () => {
  const el = (await fixture(html`
    <lr-slider
      with-tooltip
      min="0"
      max="2"
      value="1"
      .valueFormatter=${(value: number) => ["Cold", "Warm", "Hot"][value]}
    ></lr-slider>
  `)) as LyraSlider;
  const tooltip = el.shadowRoot!.querySelector(
    '[part~="tooltip"]'
  ) as HTMLElement;
  expect(tooltip.textContent!.trim()).to.equal("Warm");
});

it("keeps a numeric tooltip when valueFormatter intentionally omits aria-valuetext", async () => {
  const el = (await fixture(html`
    <lr-slider
      with-tooltip
      min="0"
      max="100"
      value="42"
      .valueFormatter=${() => null}
    ></lr-slider>
  `)) as LyraSlider;
  const thumb = el.shadowRoot!.querySelector('[part="thumb"]') as HTMLElement;
  const tooltip = el.shadowRoot!.querySelector(
    '[part~="tooltip__content"]'
  ) as HTMLElement;

  expect(thumb.hasAttribute("aria-valuetext")).to.equal(false);
  expect(tooltip.textContent!.trim()).to.equal("42");
});

it("transitions the tooltip with motion tokens and stops under prefers-reduced-motion", async () => {
  const css = styles.cssText.replace(/"/g, "'").replace(/\s+/g, " ");
  expect(css).to.match(
    /@media \(prefers-reduced-motion: reduce\) \{[^]*\[part~='tooltip'\]\s*\{[^}]*transition: none/
  );

  try {
    await setReducedMotion("no-preference");
    const el = (await fixture(
      html`<lr-slider data-lr-theme-scope
        style="--lr-transition-fast: 2s"
        with-tooltip
        value="20"
      ></lr-slider>`
    )) as LyraSlider;
    const tooltip = el.shadowRoot!.querySelector(
      '[part~="tooltip"]'
    ) as HTMLElement;
    expect(getComputedStyle(tooltip).transitionDuration).to.equal("2s");

    await setReducedMotion("reduce");
    await waitUntil(
      () => getComputedStyle(tooltip).transitionDuration === "0s",
      "slider tooltip transition did not stop under reduced motion"
    );
  } finally {
    await setReducedMotion("no-preference");
  }
});

// ---------------------------------------------------------------------------
it("renders error text and associates it before the hint on every handle", async () => {
  const el = (await fixture(html`
    <lr-slider
      range
      error-text="Choose a valid range"
      hint="Lower must not exceed upper"
    ></lr-slider>
  `)) as LyraSlider;

  expect(el.shadowRoot!.querySelectorAll('[part="error"]').length).to.equal(1);
  const error = el.shadowRoot!.querySelector('[part="error"]') as HTMLElement;
  expect(error.textContent).to.contain("Choose a valid range");
  expect(error.hasAttribute("hidden")).to.equal(false);
  for (const handle of handles(el)) {
    expect(handle.getAttribute("aria-describedby")).to.equal(
      "slider-error slider-hint"
    );
  }
});

it("tracks rich error-slot content and removes its description when unset", async () => {
  const el = (await fixture(html`
    <lr-slider><strong slot="error">Resolve this value</strong></lr-slider>
  `)) as LyraSlider;
  await elementUpdated(el);

  const error = el.shadowRoot!.querySelector('[part="error"]') as HTMLElement;
  expect(error.hasAttribute("hidden")).to.equal(false);
  expect(el.querySelector('[slot="error"]')!.textContent).to.equal(
    "Resolve this value"
  );
  expect(handles(el)[0]!.getAttribute("aria-describedby")).to.equal(
    "slider-error"
  );

  el.querySelector('[slot="error"]')!.remove();
  await waitUntil(() => error.hasAttribute("hidden"));
  expect(error.hasAttribute("hidden")).to.equal(true);
  expect(handles(el)[0]!.hasAttribute("aria-describedby")).to.equal(false);
});

it("renders hint text and describes every handle with it", async () => {
  const el = (await fixture(html`
    <lr-slider range hint="Pick a budget window"></lr-slider>
  `)) as LyraSlider;
  const hintEl = el.shadowRoot!.querySelector('[part~="hint"]') as HTMLElement;
  expect(hintEl.textContent).to.contain("Pick a budget window");
  expect(hintEl.hasAttribute("hidden")).to.be.false;
  for (const handle of handles(el)) {
    expect(handle.getAttribute("aria-describedby")).to.equal(hintEl.id);
  }
  expect(hintEl.id.length).to.be.greaterThan(0);
});

it("renders slotted hint content and describes the thumb with it", async () => {
  const el = (await fixture(html`
    <lr-slider><span slot="hint">Slotted help</span></lr-slider>
  `)) as LyraSlider;
  await elementUpdated(el);
  const hintEl = el.shadowRoot!.querySelector('[part~="hint"]') as HTMLElement;
  expect(hintEl.hasAttribute("hidden")).to.be.false;
  const thumb = el.shadowRoot!.querySelector('[part="thumb"]') as HTMLElement;
  expect(thumb.getAttribute("aria-describedby")).to.equal(hintEl.id);
});

it("hides the hint region and adds no aria-describedby when no hint is provided", async () => {
  const el = (await fixture(html`<lr-slider></lr-slider>`)) as LyraSlider;
  const hintEl = el.shadowRoot!.querySelector('[part~="hint"]') as HTMLElement;
  expect(hintEl.hasAttribute("hidden")).to.be.true;
  expect(getComputedStyle(hintEl).display).to.equal("none");
  const thumb = el.shadowRoot!.querySelector('[part="thumb"]') as HTMLElement;
  expect(thumb.hasAttribute("aria-describedby")).to.be.false;
});

it('projects a host aria-describedby onto both handles of a two-handle range slider', async () => {
  const wrapper = await fixture<HTMLDivElement>(html`
    <div>
      <span id="range-note">External note</span>
      <lr-slider range aria-describedby="range-note"></lr-slider>
    </div>
  `);
  const el = wrapper.querySelector<LyraSlider>('lr-slider')!;
  await el.updateComplete;
  const [minThumb, maxThumb] = handles(el);
  const note = wrapper.querySelector<HTMLElement>('#range-note')!;

  expect(el.getAttribute('aria-describedby')).to.equal('range-note');
  const described = (thumb: HTMLElement & { ariaDescribedByElements?: readonly Element[] | null }):
    readonly Element[] | undefined => {
    if (!('ariaDescribedByElements' in thumb)) return undefined;
    return thumb.ariaDescribedByElements ?? [];
  };
  const minDescribed = described(minThumb!);
  const maxDescribed = described(maxThumb!);
  if (minDescribed === undefined || maxDescribed === undefined) {
    // Engines without cross-shadow element-reference reflection cannot serialize the host id into
    // either shadow root; the host source remains intact and the bridge fails closed.
    return;
  }
  expect([...minDescribed]).to.include(note);
  expect([...maxDescribed]).to.include(note);
});

it("is accessible as a labeled two-handle range with markers, a tooltip and a hint", async () => {
  const el = (await fixture(html`
    <lr-slider
      range
      with-markers
      with-tooltip
      label="Budget"
      hint="Choose a price window"
      min="0"
      max="100"
      step="10"
      min-value="20"
      max-value="80"
    ></lr-slider>
  `)) as LyraSlider;
  expect(handles(el).length).to.equal(2);
  expect(el.shadowRoot!.querySelectorAll('[part="marker"]').length).to.equal(
    11
  );
  await expect(el).to.be.accessible();
});

it("is accessible as a vertical, readonly slider", async () => {
  const el = (await fixture(html`
    <lr-slider
      orientation="vertical"
      readonly
      label="Volume"
      value="30"
    ></lr-slider>
  `)) as LyraSlider;
  expect(
    (
      el.shadowRoot!.querySelector('[part="thumb"]') as HTMLElement
    ).getAttribute("aria-readonly")
  ).to.equal("true");
  await expect(el).to.be.accessible();
});

describe("size", () => {
  async function slider(markup: unknown): Promise<LyraSlider> {
    const el = (await fixture(markup as never)) as LyraSlider;
    await el.updateComplete;
    return el;
  }
  const rectOf = (el: LyraSlider, part: string): DOMRect =>
    (
      el.shadowRoot!.querySelector(`[part~="${part}"]`) as HTMLElement
    ).getBoundingClientRect();

  it('defaults to the "m" tier and reflects it', async () => {
    const el = await slider(html`<lr-slider label="Temp"></lr-slider>`);
    expect(el.size).to.equal("m");
    expect(el.getAttribute("size")).to.equal("m");
  });

  it('grows the rendered thumb and track from size="s" to size="l"', async () => {
    const small = await slider(
      html`<lr-slider size="s" label="Temp"></lr-slider>`
    );
    const large = await slider(
      html`<lr-slider size="l" label="Temp"></lr-slider>`
    );
    expect(rectOf(large, "thumb").width).to.be.greaterThan(
      rectOf(small, "thumb").width
    );
    expect(rectOf(large, "thumb").height).to.be.greaterThan(
      rectOf(small, "thumb").height
    );
    expect(rectOf(large, "track").height).to.be.greaterThan(
      rectOf(small, "track").height
    );
    expect(rectOf(large, "base").height).to.be.greaterThan(
      rectOf(small, "base").height
    );
  });

  it('renders "small"/"large" at the same geometry as "s"/"l"', async () => {
    const s = await slider(html`<lr-slider size="s" label="Temp"></lr-slider>`);
    const small = await slider(
      html`<lr-slider size="small" label="Temp"></lr-slider>`
    );
    const l = await slider(html`<lr-slider size="l" label="Temp"></lr-slider>`);
    const large = await slider(
      html`<lr-slider size="large" label="Temp"></lr-slider>`
    );
    expect(rectOf(small, "thumb").width).to.be.closeTo(
      rectOf(s, "thumb").width,
      0.5
    );
    expect(rectOf(large, "thumb").width).to.be.closeTo(
      rectOf(l, "thumb").width,
      0.5
    );
  });

  it("keeps the handle drag area at or above 28px at every tier", async () => {
    for (const size of ["2xs", "xs", "s", "m", "l", "xl"] as const) {
      const el = await slider(
        html`<lr-slider size=${size} label="Temp"></lr-slider>`
      );
      const thumb = el.shadowRoot!.querySelector(
        '[part~="thumb"]'
      ) as HTMLElement;
      const area = Number.parseFloat(
        getComputedStyle(thumb, "::before").inlineSize
      );
      expect(area, `${size} drag area`).to.be.at.least(28);
    }
  });

  it("is accessible at a non-default tier", async () => {
    const el = await slider(
      html`<lr-slider size="l" label="Temp"></lr-slider>`
    );
    await expect(el).to.be.accessible();
  });
});

it("exposes the required flag and the native label/validation surface", async () => {
  const form = (await fixture(html`
    <form>
      <label id="volume-label" for="volume">Volume</label>
      <lr-slider id="volume" name="volume" value="20"></lr-slider>
    </form>
  `)) as HTMLFormElement;
  const el = form.querySelector("lr-slider") as LyraSlider;
  expect(el.required).to.equal(false);
  expect(el.willValidate).to.equal(true);
  expect([...el.labels].map((node) => (node as Element).id)).to.deep.equal([
    "volume-label",
  ]);

  el.required = true;
  await elementUpdated(el);
  expect(el.hasAttribute("required")).to.equal(true);
  // A slider always carries a numeric value, so `required` never makes it invalid on its own.
  expect(el.checkValidity()).to.equal(true);

  el.required = false;
  await elementUpdated(el);
  expect(el.hasAttribute("required")).to.equal(false);
});

it("renders markers only for a finite, reasonably sized grid", async () => {
  const el = (await fixture(
    html`<lr-slider with-markers min="0" max="100" step="25"></lr-slider>`
  )) as LyraSlider;
  await elementUpdated(el);
  expect(el.shadowRoot!.querySelectorAll('[part~="marker"]').length).to.equal(
    5
  );

  el.step = 0;
  await elementUpdated(el);
  expect(el.shadowRoot!.querySelectorAll('[part~="marker"]').length).to.equal(
    0
  );

  el.step = 0.000001;
  await elementUpdated(el);
  expect(
    el.shadowRoot!.querySelectorAll('[part~="marker"]').length,
    "an absurd interval count renders no markers at all"
  ).to.equal(0);

  el.step = 25;
  el.max = 0;
  await elementUpdated(el);
  expect(el.shadowRoot!.querySelectorAll('[part~="marker"]').length).to.equal(
    0
  );
});

it("prefers a handle-aware value formatter over the tooltip formatter", async () => {
  const el = (await fixture(html`
    <lr-slider
      range
      min="0"
      max="100"
      min-value="20"
      max-value="80"
      tooltip="top"
    ></lr-slider>
  `)) as LyraSlider;
  el.tooltipFormatter = (value) => `T${value}`;
  await elementUpdated(el);
  const tooltipText = (): string[] =>
    [...el.shadowRoot!.querySelectorAll('[part~="tooltip__content"]')].map(
      (node) => node.textContent!.trim()
    );
  expect(tooltipText()).to.deep.equal(["T20", "T80"]);

  el.valueFormatter = (value, handle) => `${handle}:${value}`;
  await elementUpdated(el);
  expect(tooltipText()).to.deep.equal(["min:20", "max:80"]);

  Reflect.set(el, "valueFormatter", null);
  Reflect.set(el, "tooltipFormatter", null);
  await elementUpdated(el);
  expect(tooltipText()).to.deep.equal(["20", "80"]);
});

it("renders a required marker on the slider label from the shared themeable rule", async () => {
  // Rendered result, not stylesheet text: a marker declared on a selector that never matched would
  // still substring-match the sheet source.
  const el = (await fixture(html`
    <lr-slider required label="Volume"></lr-slider>
  `)) as LyraSlider;
  await elementUpdated(el);
  const label = el.shadowRoot!.querySelector(
    '[part~="form-control-label"]'
  ) as HTMLElement;
  expect(getComputedStyle(label, "::after").content).to.contain("*");

  const suppressed = (await fixture(html`
    <lr-slider
      required
      label="Volume"
      style="--lr-form-control-required-content: ''"
    ></lr-slider>
  `)) as LyraSlider;
  await elementUpdated(suppressed);
  const suppressedLabel = suppressed.shadowRoot!.querySelector(
    '[part~="form-control-label"]'
  ) as HTMLElement;
  expect(getComputedStyle(suppressedLabel, "::after").content).to.not.contain(
    "*"
  );
});

it('keeps numeric inline readouts by default and opts into formatted label-row values', async () => {
  const el = await fixture<LyraSlider>(html`<lr-slider label="Speed" value="30" with-value
    .valueFormatter=${(value: number) => `${value}%`}></lr-slider>`);
  const readout = () => el.shadowRoot!.querySelector<HTMLElement>('[part="value"]')!;
  expect(readout().textContent).to.equal('30');
  expect(el.shadowRoot!.querySelector('[part="label-row"]') === null).to.equal(true);
  el.valueDisplay = 'formatted';
  el.valuePlacement = 'label';
  await el.updateComplete;
  expect(readout().textContent).to.equal('30%');
  expect(readout().parentElement!.getAttribute('part')).to.equal('label-row');
  const label = el.shadowRoot!.querySelector<HTMLElement>('[part~="form-control-label"]')!;
  expect(label.textContent!.trim()).to.equal('Speed');
  expect(readout().getBoundingClientRect().top).to.be.lessThan(el.shadowRoot!.querySelector('[part="track"]')!.getBoundingClientRect().top);
  expect(readout().getBoundingClientRect().left).to.be.greaterThan(label.getBoundingClientRect().left);
  el.dir = 'rtl';
  await el.updateComplete;
  expect(readout().getBoundingClientRect().left).to.be.lessThan(label.getBoundingClientRect().left);
  await expect(el).to.be.accessible();
});

it('uses localized numeric fallback for nullish formatted values and bounds long label rows', async () => {
  const el = await fixture<LyraSlider>(html`<lr-slider lang="ar" dir="rtl" value="30" with-value
    value-display="formatted" value-placement="label" style="inline-size:320px"
    .valueFormatter=${() => null}><span slot="label">${'Long label '.repeat(20)}</span></lr-slider>`);
  const value = el.shadowRoot!.querySelector<HTMLElement>('[part="value"]')!;
  expect(value.textContent).to.equal(new Intl.NumberFormat('ar').format(30));
  el.valueFormatter = () => '0.3 hours '.repeat(40);
  await el.updateComplete;
  expect(el.scrollWidth).to.be.at.most(el.clientWidth + 1);
  el.withValue = false;
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="label-row"]') === null).to.equal(true);
  expect(el.shadowRoot!.querySelector('[part="value"]') === null).to.equal(true);
});

it('keeps number-first formatted readout, tooltip and range ends in reading order under dir="rtl"', async () => {
  const el = (await fixture(html`
    <div dir="rtl">
      <lr-slider
        with-value
        with-tooltip="always"
        value-display="formatted"
        min="-10"
        max="10"
        value="2"
        .valueFormatter=${(v: number) => `${v} MiB/s`}
      ></lr-slider>
    </div>
  `)) as HTMLElement;
  const slider = el.querySelector('lr-slider') as LyraSlider;
  await slider.updateComplete;
  const value = slider.shadowRoot!.querySelector('[part="value"]')!;
  expect(paintsHeadFirst(value, '2 MiB/s', 1)).to.equal(true);
  const tip = slider.shadowRoot!.querySelector('[part="tooltip__content"]');
  expect(tip).to.not.equal(null);
  expect(paintsHeadFirst(tip!, '2 MiB/s', 1)).to.equal(true);
  slider.range = true;
  slider.minValue = -3;
  slider.maxValue = 4;
  slider.valueFormatter = (v: number) => String(v);
  await slider.updateComplete;
  const range = slider.shadowRoot!.querySelector('[part="value"]')!;
  expect(paintsHeadFirst(range, '-3', 1)).to.equal(true);
});
