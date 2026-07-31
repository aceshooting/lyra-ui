import { fixture, expect, html, oneEvent } from "@open-wc/testing";
import { LitElement, type PropertyValues } from "lit";
import "./details.js";
import "./accordion.js";
import "./accordion-item.js";
import type { LyraDetails } from "./details.js";
import type { LyraAccordion } from "./accordion.js";
import { styles as detailsStyles } from "./details.styles.js";
import { styles as accordionStyles } from "./accordion.styles.js";

it("renders a disclosure panel and reports its state", async () => {
  const el = (await fixture(
    html`<lr-details summary="More">Content</lr-details>`
  )) as LyraDetails;
  const summary = el.shadowRoot!.querySelector(
    '[part="summary"]'
  ) as HTMLElement;
  expect(summary.getAttribute("aria-expanded")).to.equal("false");
  el.open = true;
  await el.updateComplete;
  expect(
    (el.shadowRoot!.querySelector('[part="base"]') as HTMLDetailsElement).open
  ).to.be.true;
  expect(summary.getAttribute("aria-expanded")).to.equal("true");
  await expect(el).to.be.accessible();
});

it("closes sibling panels when multiple is false", async () => {
  const el = await fixture(html`<lr-accordion>
    <lr-accordion-item open summary="One">A</lr-accordion-item>
    <lr-accordion-item summary="Two">B</lr-accordion-item>
  </lr-accordion>`);
  const panels = [...el.querySelectorAll("lr-accordion-item")] as LyraDetails[];
  panels[1].open = true;
  panels[1].dispatchEvent(
    new CustomEvent("lr-toggle", {
      detail: { open: true },
      bubbles: true,
      composed: true,
    })
  );
  await Promise.all(panels.map((panel) => panel.updateComplete));
  expect(panels[0].open).to.be.false;
});

it("reconciles multiple initially-open panels when multiple is false", async () => {
  const el = await fixture(html`<lr-accordion>
    <lr-accordion-item open summary="One">A</lr-accordion-item>
    <lr-accordion-item open summary="Two">B</lr-accordion-item>
  </lr-accordion>`);
  const panels = [...el.querySelectorAll("lr-accordion-item")] as LyraDetails[];
  await Promise.all(panels.map((panel) => panel.updateComplete));

  expect(panels.map((panel) => panel.open)).to.deep.equal([true, false]);
});

it("reconciles open panels when multiple changes from true to false", async () => {
  const el = (await fixture(html`<lr-accordion multiple>
    <lr-accordion-item open summary="One">A</lr-accordion-item>
    <lr-accordion-item open summary="Two">B</lr-accordion-item>
  </lr-accordion>`)) as LyraAccordion;
  el.multiple = false;
  await el.updateComplete;
  const panels = [...el.querySelectorAll("lr-accordion-item")] as LyraDetails[];
  await Promise.all(panels.map((panel) => panel.updateComplete));

  expect(panels.map((panel) => panel.open)).to.deep.equal([true, false]);
});

it("reconciles accordion listener ownership when panels are appended, removed, or moved", async () => {
  const first = await fixture(html`<lr-accordion>
    <lr-accordion-item open summary="One">A</lr-accordion-item>
  </lr-accordion>`);
  const second = await fixture(html`<lr-accordion>
    <lr-accordion-item open summary="Other">Other</lr-accordion-item>
  </lr-accordion>`);
  const original = first.querySelector("lr-accordion-item") as LyraDetails;
  const appended = document.createElement("lr-accordion-item") as LyraDetails;
  appended.summary = "Two";
  first.append(appended);
  await new Promise((resolve) => setTimeout(resolve, 0));

  appended.open = true;
  appended.dispatchEvent(
    new CustomEvent("lr-toggle", {
      detail: { open: true },
      bubbles: true,
      composed: true,
    })
  );
  expect(original.open).to.be.false;

  const secondSibling = second.querySelector(
    "lr-accordion-item"
  ) as LyraDetails;
  second.append(appended);
  original.open = true;
  secondSibling.open = true;
  await new Promise((resolve) => setTimeout(resolve, 0));

  appended.open = true;
  appended.dispatchEvent(
    new CustomEvent("lr-toggle", {
      detail: { open: true },
      bubbles: true,
      composed: true,
    })
  );
  expect(original.open).to.be.true;
  expect(secondSibling.open).to.be.false;

  appended.remove();
  await new Promise((resolve) => setTimeout(resolve, 0));
  secondSibling.open = true;
  appended.dispatchEvent(
    new CustomEvent("lr-toggle", {
      detail: { open: true },
      bubbles: true,
      composed: true,
    })
  );
  expect(secondSibling.open).to.be.true;
});

it("does not treat panels owned by a nested accordion as direct siblings", async () => {
  const outer = await fixture(html`<lr-accordion>
    <lr-accordion-item open summary="Outer">Outer</lr-accordion-item>
    <lr-accordion>
      <lr-accordion-item summary="Inner">Inner</lr-accordion-item>
    </lr-accordion>
  </lr-accordion>`);
  const panels = [
    ...outer.querySelectorAll("lr-accordion-item"),
  ] as LyraDetails[];
  panels[1].open = true;
  panels[1].dispatchEvent(
    new CustomEvent("lr-toggle", {
      detail: { open: true },
      bubbles: true,
      composed: true,
    })
  );
  expect(panels[0].open).to.be.true;
});

it('suppresses the localized "Details" fallback once rich content is slotted into summary', async () => {
  const el = (await fixture(
    html`<lr-details
      ><span slot="summary">Custom Label</span>Content</lr-details
    >`
  )) as LyraDetails;
  const summary = el.shadowRoot!.querySelector(
    '[part="summary"]'
  ) as HTMLElement;
  // Slotted light-DOM content isn't reparented into the shadow tree, so `textContent` on the
  // shadow part only ever reflects the shadow-side fallback text node -- it must be empty once a
  // slot="summary" child exists, or the fallback renders ahead of the real label.
  expect(summary.textContent?.trim()).to.equal("");
  expect(el.textContent?.trim()).to.equal("Custom LabelContent");
});

it("exposes disabled to assistive tech via aria-disabled on the summary, rendered in both states", async () => {
  const el = (await fixture(
    html`<lr-details summary="More" disabled>Content</lr-details>`
  )) as LyraDetails;
  const summary = el.shadowRoot!.querySelector(
    '[part="summary"]'
  ) as HTMLElement;
  expect(summary.getAttribute("aria-disabled")).to.equal("true");

  el.disabled = false;
  await el.updateComplete;
  expect(summary.getAttribute("aria-disabled")).to.equal("false");
});

it("blocks both pointer and synthesized keyboard activation while disabled", async () => {
  const el = (await fixture(
    html`<lr-details summary="More" disabled>Content</lr-details>`
  )) as LyraDetails;
  const base = el.shadowRoot!.querySelector(
    '[part="base"]'
  ) as HTMLDetailsElement;
  const summary = el.shadowRoot!.querySelector(
    '[part="summary"]'
  ) as HTMLElement;

  // A native <summary> synthesizes a click for Enter/Space activation, so exercising the click
  // path (which onClick guards with event.preventDefault()) covers the keyboard path too.
  summary.click();
  await el.updateComplete;
  expect(el.open).to.be.false;
  expect(base.open).to.be.false;
});

it("mirrors the disclosure marker rotation under RTL so it still points down/up instead of sideways", () => {
  const css = detailsStyles.cssText.replace(/\s+/g, " ");
  expect(css).to.include(
    ":host(:dir(rtl)) [part='summary']::after { transform: rotate(-45deg); }"
  );
  expect(css).to.include(
    ":host([open]:dir(rtl)) [part='summary']::after { transform: rotate(-225deg); }"
  );
});

it('actually rotates the rendered chevron under a real dir="rtl" fixture instead of pointing sideways (getComputedStyle, not just source text)', async () => {
  // The test above only proves the declarations exist as raw stylesheet source text -- it can't
  // catch a regression that breaks the real cascade (specificity conflict, a :dir(rtl) selector
  // typo, the `[open]` compound no longer matching under rtl). This reads the actual rendered
  // ::after transform on freshly-rendered closed and open fixtures (rather than toggling `open`
  // on one already-connected instance, which doesn't reliably re-invalidate this particular
  // dynamic-attribute + :dir() compound selector).
  function chevronAngleDeg(el: HTMLElement): number {
    const matrix = new DOMMatrixReadOnly(
      getComputedStyle(el, "::after").transform
    );
    return Math.atan2(matrix.b, matrix.a) * (180 / Math.PI);
  }
  const closedWrapper = await fixture(
    html`<div dir="rtl"><lr-details summary="More">Content</lr-details></div>`
  );
  const closedSummary = (
    closedWrapper.querySelector("lr-details") as LyraDetails
  ).shadowRoot!.querySelector('[part="summary"]') as HTMLElement;
  expect(chevronAngleDeg(closedSummary)).to.be.closeTo(-45, 0.01);

  const openWrapper = await fixture(
    html`<div dir="rtl">
      <lr-details summary="More" open>Content</lr-details>
    </div>`
  );
  const openSummary = (
    openWrapper.querySelector("lr-details") as LyraDetails
  ).shadowRoot!.querySelector('[part="summary"]') as HTMLElement;
  // rotate(-225deg) normalizes to the same matrix as rotate(135deg) -- atan2's range is (-180, 180].
  expect(chevronAngleDeg(openSummary)).to.be.closeTo(135, 0.01);
});

it('renders a localized "Details" fallback from a .strings override when no summary/slot is supplied', async () => {
  const el = (await fixture(
    html`<lr-details .strings=${{ details: "Détails" }}>Content</lr-details>`
  )) as LyraDetails;
  const summary = el.shadowRoot!.querySelector(
    '[part="summary"]'
  ) as HTMLElement;
  expect(summary.textContent?.trim()).to.equal("Détails");
});

it("chains willUpdate() to super.willUpdate() so a mixin layered under LyraElement would still run", async () => {
  // No shared mixin actually overrides willUpdate() today, so the only way to prove the chain is
  // live (rather than grepping source text for the call) is to patch the base-class hook itself
  // -- the exact hook a future mixin would extend -- and confirm it actually fires.
  const hadOwn = Object.prototype.hasOwnProperty.call(
    LitElement.prototype,
    "willUpdate"
  );
  const original = (
    LitElement.prototype as unknown as {
      willUpdate?: (changed: PropertyValues) => void;
    }
  ).willUpdate;
  let called = false;
  (
    LitElement.prototype as unknown as {
      willUpdate: (changed: PropertyValues) => void;
    }
  ).willUpdate = function (this: LitElement, changed: PropertyValues) {
    called = true;
    original?.call(this, changed);
  };
  try {
    const el = (await fixture(
      html`<lr-details summary="More">Content</lr-details>`
    )) as LyraDetails;
    await el.updateComplete;
    expect(called).to.be.true;
  } finally {
    if (hadOwn) {
      (LitElement.prototype as unknown as { willUpdate: unknown }).willUpdate =
        original;
    } else {
      delete (LitElement.prototype as unknown as { willUpdate?: unknown })
        .willUpdate;
    }
  }
});

it("gives the summary (the real focusable/clickable surface) hover and focus-visible treatment", () => {
  const css = detailsStyles.cssText.replace(/\s+/g, " ");
  expect(css).to.match(/\[part='summary'\]:hover\s*\{[^}]*background:/);
  expect(css).to.match(/\[part='summary'\]:focus-visible\s*\{[^}]*outline:/);
});

it("gives lr-accordion its own stylesheet instead of reusing details.styles.ts wholesale", () => {
  const css = accordionStyles.cssText.replace(/\s+/g, " ");
  // details.styles.ts's [part='base'] rule paints a border-block-end meant for <lr-details>'s
  // own root; the accordion's [part='base'] is a plain wrapper div, so inheriting that rule
  // doubled up with the last panel's own border. None of details.styles.ts's <details>-shaped
  // selectors (summary/content/disabled/reduced-motion) apply to the accordion's shadow root.
  expect(css).to.not.include("border-block-end");
  expect(css).to.not.include("[part='summary']");
  expect(css).to.not.include("[part='content']");
});

describe("unified show/hide lifecycle", () => {
  it("emits lr-show, then lr-toggle, then lr-after-show when opening", async () => {
    const el = (await fixture(
      html`<lr-details summary="More">Content</lr-details>`
    )) as LyraDetails;
    const order: string[] = [];
    let openWhenShowFired: boolean | undefined;
    el.addEventListener("lr-show", () => {
      order.push("lr-show");
      openWhenShowFired = el.open;
    });
    el.addEventListener("lr-toggle", () => order.push("lr-toggle"));
    el.addEventListener("lr-after-show", () => order.push("lr-after-show"));

    const afterShow = oneEvent(el, "lr-after-show");
    el.show();
    expect(el.open).to.be.true;
    await afterShow;

    expect(order).to.deep.equal(["lr-show", "lr-toggle", "lr-after-show"]);
    expect(openWhenShowFired).to.be.false;
  });

  it("emits lr-hide, then lr-toggle, then lr-after-hide when closing", async () => {
    const el = (await fixture(
      html`<lr-details summary="More" open>Content</lr-details>`
    )) as LyraDetails;
    await el.updateComplete;
    const order: string[] = [];
    el.addEventListener("lr-hide", () => order.push("lr-hide"));
    el.addEventListener("lr-toggle", () => order.push("lr-toggle"));
    el.addEventListener("lr-after-hide", () => order.push("lr-after-hide"));

    const afterHide = oneEvent(el, "lr-after-hide");
    el.hide();
    expect(el.open).to.be.false;
    await afterHide;

    expect(order).to.deep.equal(["lr-hide", "lr-toggle", "lr-after-hide"]);
  });

  it("honours a vetoed lr-show from the summary click, leaving the native details closed", async () => {
    const el = (await fixture(
      html`<lr-details summary="More">Content</lr-details>`
    )) as LyraDetails;
    const base = el.shadowRoot!.querySelector(
      '[part="base"]'
    ) as HTMLDetailsElement;
    const summary = el.shadowRoot!.querySelector(
      '[part="summary"]'
    ) as HTMLElement;
    let toggles = 0;
    el.addEventListener("lr-toggle", () => toggles++);
    el.addEventListener("lr-show", (event) => (event as Event).preventDefault());

    summary.click();
    await el.updateComplete;

    expect(el.open).to.be.false;
    expect(base.open, "a vetoed open must not leave the native panel expanded").to
      .be.false;
    expect(el.hasAttribute("open")).to.be.false;
    expect(toggles).to.equal(0);
  });

  it("honours a vetoed lr-hide from the summary click", async () => {
    const el = (await fixture(
      html`<lr-details summary="More" open>Content</lr-details>`
    )) as LyraDetails;
    await el.updateComplete;
    const base = el.shadowRoot!.querySelector(
      '[part="base"]'
    ) as HTMLDetailsElement;
    const summary = el.shadowRoot!.querySelector(
      '[part="summary"]'
    ) as HTMLElement;
    el.addEventListener("lr-hide", (event) => (event as Event).preventDefault());

    summary.click();
    await el.updateComplete;

    expect(el.open).to.be.true;
    expect(base.open).to.be.true;
    expect(el.hasAttribute("open")).to.be.true;
  });

  it("toggles from the summary click through the lifecycle when nothing vetoes", async () => {
    const el = (await fixture(
      html`<lr-details summary="More">Content</lr-details>`
    )) as LyraDetails;
    const base = el.shadowRoot!.querySelector(
      '[part="base"]'
    ) as HTMLDetailsElement;
    const summary = el.shadowRoot!.querySelector(
      '[part="summary"]'
    ) as HTMLElement;
    let toggles = 0;
    el.addEventListener("lr-toggle", () => toggles++);

    summary.click();
    await el.updateComplete;
    expect(el.open).to.be.true;
    expect(base.open).to.be.true;

    summary.click();
    await el.updateComplete;
    expect(el.open).to.be.false;
    expect(base.open).to.be.false;
    expect(toggles, "exactly one lr-toggle per real state change").to.equal(2);
  });

  it("assigning open drives the same lifecycle, and initially-open markup emits nothing", async () => {
    let fired = 0;
    const initiallyOpen = (await fixture(
      html`<lr-details summary="More" open>Content</lr-details>`
    )) as LyraDetails;
    for (const name of ["lr-show", "lr-after-show", "lr-hide", "lr-after-hide", "lr-toggle"]) {
      initiallyOpen.addEventListener(name, () => fired++);
    }
    await initiallyOpen.updateComplete;
    expect(fired).to.equal(0);

    const el = (await fixture(
      html`<lr-details summary="More">Content</lr-details>`
    )) as LyraDetails;
    const shown = oneEvent(el, "lr-show");
    el.open = true;
    await shown;
    expect(el.open).to.be.true;

    const hidden = oneEvent(el, "lr-hide");
    el.open = false;
    await hidden;
    expect(el.open).to.be.false;
  });

  it("lr-after-show and lr-after-hide are not cancelable", async () => {
    const el = (await fixture(
      html`<lr-details summary="More">Content</lr-details>`
    )) as LyraDetails;
    const shown = oneEvent(el, "lr-after-show");
    el.show();
    expect((await shown).cancelable).to.be.false;
    const hidden = oneEvent(el, "lr-after-hide");
    el.hide();
    expect((await hidden).cancelable).to.be.false;
  });

  it("never opens through show() while disabled", async () => {
    const el = (await fixture(
      html`<lr-details summary="More" disabled>Content</lr-details>`
    )) as LyraDetails;
    let fired = 0;
    el.addEventListener("lr-show", () => fired++);
    el.show();
    await el.updateComplete;
    expect(el.open).to.be.false;
    expect(fired).to.equal(0);
  });
});
