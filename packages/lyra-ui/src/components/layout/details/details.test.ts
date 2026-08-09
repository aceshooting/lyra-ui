import { fixture, expect, html, oneEvent } from "@open-wc/testing";
import { LitElement, type PropertyValues } from "lit";
import "./details.js";
import "./accordion.js";
import "./accordion-item.js";
import type { LyraDetails } from "./details.js";
import type { LyraAccordion } from "./accordion.js";
import { styles as detailsStyles } from "./details.styles.js";
import { styles as accordionStyles } from "./accordion.styles.js";
import { resetMouse, sendMouse } from "../../../../test/wtr-mouse.js";

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
    (el.shadowRoot!.querySelector('[part~="base"]') as HTMLDetailsElement).open
  ).to.be.true;
  expect(summary.getAttribute("aria-expanded")).to.equal("true");
  await expect(el).to.be.accessible();
});

it("does not toggle for an interactive summary child created in another realm", async () => {
  const el = (await fixture(html`<lr-details>Content</lr-details>`)) as LyraDetails;
  const iframe = document.createElement("iframe");
  document.body.append(iframe);
  try {
    const link = iframe.contentDocument!.createElement("a");
    link.slot = "summary";
    link.href = "#foreign-details-target";
    link.textContent = "Read more";
    link.addEventListener("click", (event) => event.preventDefault());
    el.append(link);
    await el.updateComplete;

    expect(link instanceof Element, "fixture really crosses constructor realms").to.equal(false);
    link.click();
    await el.updateComplete;
    expect(el.open).to.be.false;
  } finally {
    iframe.remove();
  }
});

it("closes sibling panels when multiple is false", async () => {
  const el = await fixture(html`<lr-accordion multiple="false">
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
  const el = await fixture(html`<lr-accordion multiple="false">
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
  const first = await fixture(html`<lr-accordion multiple="false">
    <lr-accordion-item open summary="One">A</lr-accordion-item>
  </lr-accordion>`);
  const second = await fixture(html`<lr-accordion multiple="false">
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
    '[part~="base"]'
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

it("keeps the disclosure marker vertical under RTL in both states", () => {
  const css = detailsStyles.cssText.replace(/\s+/g, " ");
  expect(css).to.include(".icon-fallback { display: inline-flex; transform: rotate(90deg)");
  expect(css).to.include(":host([open]) .icon-fallback { transform: rotate(-90deg)");
});

it('actually rotates the rendered chevron under a real dir="rtl" fixture instead of pointing sideways (getComputedStyle, not just source text)', async () => {
  function chevronAngleDeg(el: HTMLElement): number {
    const matrix = new DOMMatrixReadOnly(getComputedStyle(el).transform);
    return Math.atan2(matrix.b, matrix.a) * (180 / Math.PI);
  }
  const closedWrapper = await fixture(
    html`<div dir="rtl"><lr-details summary="More">Content</lr-details></div>`
  );
  const closedIcon = (
    closedWrapper.querySelector("lr-details") as LyraDetails
  ).shadowRoot!.querySelector('.icon-fallback') as HTMLElement;
  expect(chevronAngleDeg(closedIcon)).to.be.closeTo(90, 0.01);

  const openWrapper = await fixture(
    html`<div dir="rtl">
      <lr-details summary="More" open>Content</lr-details>
    </div>`
  );
  const openIcon = (
    openWrapper.querySelector("lr-details") as LyraDetails
  ).shadowRoot!.querySelector('.icon-fallback') as HTMLElement;
  expect(chevronAngleDeg(openIcon)).to.be.closeTo(-90, 0.01);
});

it("contains an expanded long summary, content, and action in an exact 320px RTL allocation", async () => {
  const wrapper = await fixture<HTMLElement>(html`
    <div dir="rtl" style="inline-size: 320px; max-inline-size: 100%;">
      <lr-details open>
        <span slot="summary">عنوانتفاصيلمحليطويلجداًبدونأيفرصةللفصلالتلقائي</span>
        <p>محتوىتفصيليمحليطويلجداًبدونأيفرصةللفصلالتلقائي</p>
        <button type="button">إجراءمحليطويلجداًبدونأيفرصةللفصلالتلقائي</button>
      </lr-details>
    </div>
  `);
  const el = wrapper.querySelector("lr-details") as LyraDetails;
  await el.updateComplete;
  const base = el.shadowRoot!.querySelector<HTMLElement>('[part~="base"]')!;
  const summary = el.shadowRoot!.querySelector<HTMLElement>('[part="summary"]')!;
  const content = el.shadowRoot!.querySelector<HTMLElement>('[part="content"]')!;

  expect(wrapper.scrollWidth).to.be.at.most(wrapper.clientWidth);
  expect(el.scrollWidth).to.be.at.most(el.clientWidth);
  expect(base.scrollWidth).to.be.at.most(base.clientWidth);
  expect(summary.scrollWidth).to.be.at.most(summary.clientWidth);
  expect(content.scrollWidth).to.be.at.most(content.clientWidth);
  expect(getComputedStyle(base).direction).to.equal("rtl");
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

it("inherits independent appearance and pointer-state paint without retinting shared tokens", async () => {
  const wrapper = await fixture<HTMLElement>(html`
    <div style="
      --lr-details-outlined-bg: rgb(1, 2, 3);
      --lr-details-outlined-border-color: rgb(4, 5, 6);
      --lr-details-filled-bg: rgb(7, 8, 9);
      --lr-details-filled-border-color: rgb(10, 11, 12);
      --lr-details-filled-outlined-bg: rgb(13, 14, 15);
      --lr-details-filled-outlined-border-color: rgb(16, 17, 18);
      --lr-details-summary-hover-bg: rgb(19, 20, 21);
      --lr-details-summary-active-bg: rgb(22, 23, 24);
    ">
      <lr-details appearance="outlined" summary="Outlined">Content</lr-details>
      <lr-details appearance="filled" summary="Filled">Content</lr-details>
      <lr-details appearance="filled-outlined" summary="Filled outlined">Content</lr-details>
    </div>
  `);
  const items = [...wrapper.querySelectorAll("lr-details")] as LyraDetails[];
  await Promise.all(items.map((item) => item.updateComplete));
  const bases = items.map((item) => item.shadowRoot!.querySelector<HTMLElement>('[part~="base"]')!);

  expect(getComputedStyle(bases[0]!).backgroundColor).to.equal("rgb(1, 2, 3)");
  expect(getComputedStyle(bases[0]!).borderTopColor).to.equal("rgb(4, 5, 6)");
  expect(getComputedStyle(bases[1]!).backgroundColor).to.equal("rgb(7, 8, 9)");
  expect(getComputedStyle(bases[1]!).borderTopColor).to.equal("rgb(10, 11, 12)");
  expect(getComputedStyle(bases[2]!).backgroundColor).to.equal("rgb(13, 14, 15)");
  expect(getComputedStyle(bases[2]!).borderTopColor).to.equal("rgb(16, 17, 18)");

  const summary = items[0]!.shadowRoot!.querySelector<HTMLElement>('[part="summary"]')!;
  summary.scrollIntoView();
  const rect = summary.getBoundingClientRect();
  try {
    await sendMouse({
      type: "move",
      position: [Math.round(rect.left + rect.width / 2), Math.round(rect.top + rect.height / 2)],
    });
    expect(getComputedStyle(summary).backgroundColor).to.equal("rgb(19, 20, 21)");
    await sendMouse({ type: "down" });
    expect(getComputedStyle(summary).backgroundColor).to.equal("rgb(22, 23, 24)");
  } finally {
    await resetMouse();
  }
});

it("inherits independent gap and radius hooks across the extreme size tiers", async () => {
  const wrapper = await fixture<HTMLElement>(html`
    <div style="--lr-details-gap: 27px; --lr-details-radius: 19px;">
      <lr-details size="2xs" summary="Small">Content</lr-details>
      <lr-details size="xl" summary="Large">Content</lr-details>
    </div>
  `);
  const items = [...wrapper.querySelectorAll("lr-details")] as LyraDetails[];
  await Promise.all(items.map((item) => item.updateComplete));

  for (const item of items) {
    const base = item.shadowRoot!.querySelector<HTMLElement>('[part~="base"]')!;
    const header = item.shadowRoot!.querySelector<HTMLElement>('[part="header"]')!;
    expect(getComputedStyle(base).borderTopLeftRadius).to.equal("19px");
    expect(getComputedStyle(header).columnGap).to.equal("27px");
  }
});

it("gives lr-accordion its own stylesheet instead of reusing details.styles.ts wholesale", () => {
  const css = accordionStyles.cssText.replace(/\s+/g, " ");
  // details.styles.ts's [part~='base'] rule paints a border-block-end meant for <lr-details>'s
  // own root; the accordion's [part~='base'] is a plain wrapper div, so inheriting that rule
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
      '[part~="base"]'
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
      '[part~="base"]'
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
      '[part~="base"]'
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

// -- size --------------------------------------------------------------------

describe("size", () => {
  const summaryOf = (el: LyraDetails): CSSStyleDeclaration =>
    getComputedStyle(el.shadowRoot!.querySelector('[part="summary"]') as HTMLElement);
  const contentOf = (el: LyraDetails): CSSStyleDeclaration =>
    getComputedStyle(el.shadowRoot!.querySelector('[part="content"]') as HTMLElement);

  const render = async (size?: string): Promise<LyraDetails> =>
    (await fixture(
      size === undefined
        ? html`<lr-details summary="More">Content</lr-details>`
        : html`<lr-details summary="More" size=${size}>Content</lr-details>`
    )) as LyraDetails;

  it("defaults to \"m\", and the unset default renders identically to the explicit tier", async () => {
    const unset = await render();
    const explicit = await render("m");
    expect(unset.size).to.equal("m");
    expect(unset.getAttribute("size")).to.equal("m");
    expect(summaryOf(unset).paddingBlockStart).to.equal(summaryOf(explicit).paddingBlockStart);
    expect(summaryOf(unset).fontSize).to.equal(summaryOf(explicit).fontSize);
  });

  it("grows the rendered summary rhythm and font size monotonically across the ladder", async () => {
    const measured: { padding: number; font: number; content: number }[] = [];
    for (const size of ["2xs", "xs", "s", "m", "l", "xl"] as const) {
      const el = await render(size);
      measured.push({
        padding: Number.parseFloat(summaryOf(el).paddingBlockStart),
        font: Number.parseFloat(summaryOf(el).fontSize),
        content: Number.parseFloat(contentOf(el).paddingBlockEnd),
      });
    }
    for (let i = 1; i < measured.length; i++) {
      expect(measured[i]!.padding, `summary padding tier ${i}`).to.be.at.least(measured[i - 1]!.padding);
      expect(measured[i]!.font, `summary font tier ${i}`).to.be.at.least(measured[i - 1]!.font);
      expect(measured[i]!.content, `content padding tier ${i}`).to.be.at.least(measured[i - 1]!.content);
    }
    expect(measured.at(-1)!.padding, "xl padding beats 2xs").to.be.greaterThan(measured[0]!.padding);
    expect(measured.at(-1)!.font, "xl font beats 2xs").to.be.greaterThan(measured[0]!.font);
  });

  it("accepts the Web Awesome size spellings as exact synonyms of the step names", async () => {
    for (const [step, alias] of [["s", "small"], ["m", "medium"], ["l", "large"]] as const) {
      const stepped = summaryOf(await render(step));
      const aliased = summaryOf(await render(alias));
      expect(aliased.paddingBlockStart, `${alias} padding`).to.equal(stepped.paddingBlockStart);
      expect(aliased.fontSize, `${alias} font`).to.equal(stepped.fontSize);
    }
  });

  it("stays accessible and keyboard-operable at the smallest tier", async () => {
    const el = await render("2xs");
    await expect(el).to.be.accessible();
    const summary = el.shadowRoot!.querySelector('[part="summary"]') as HTMLElement;
    summary.click();
    await el.updateComplete;
    expect(el.open).to.be.true;
  });
});

describe("Web Awesome disclosure surface", () => {
  it("defaults and reflects appearance/icon placement while preserving the Lyra size default", async () => {
    const el = (await fixture(
      html`<lr-details summary="More">Content</lr-details>`
    )) as LyraDetails;
    expect(el.appearance).to.equal("outlined");
    expect(el.getAttribute("appearance")).to.equal("outlined");
    expect(el.iconPlacement).to.equal("end");
    expect(el.getAttribute("icon-placement")).to.equal("end");
    expect(el.size).to.equal("m");
  });

  it("groups same-name details in one root and leaves other names alone", async () => {
    const wrapper = await fixture(html`<div>
      <lr-details name="faq" summary="One" open>One</lr-details>
      <lr-details name="faq" summary="Two">Two</lr-details>
      <lr-details name="other" summary="Other" open>Other</lr-details>
    </div>`);
    const [one, two, other] = [...wrapper.querySelectorAll("lr-details")] as LyraDetails[];

    await two.show();

    expect(one.open).to.be.false;
    expect(two.open).to.be.true;
    expect(other.open).to.be.true;
    expect(
      (two.shadowRoot!.querySelector('[part~="base"]') as HTMLDetailsElement).name
    ).to.equal("faq");
  });

  it("keeps a named group single-open when an existing peer vetoes its hide", async () => {
    const wrapper = await fixture(html`<div>
      <lr-details name="faq" summary="One" open>One</lr-details>
      <lr-details name="faq" summary="Two">Two</lr-details>
    </div>`);
    const [one, two] = [...wrapper.querySelectorAll("lr-details")] as LyraDetails[];
    one.addEventListener("lr-hide", (event) => event.preventDefault());

    await two.show();

    expect(one.open).to.be.true;
    expect(two.open).to.be.false;
  });

  it("returns promises from show()/hide() that settle after the matching after-event", async () => {
    const el = (await fixture(
      html`<lr-details summary="More">Content</lr-details>`
    )) as LyraDetails;
    const events: string[] = [];
    el.addEventListener("lr-after-show", () => events.push("show"));
    el.addEventListener("lr-after-hide", () => events.push("hide"));

    const showing = el.show();
    expect(showing).to.be.instanceOf(Promise);
    await showing;
    expect(events).to.deep.equal(["show"]);

    const hiding = el.hide();
    expect(hiding).to.be.instanceOf(Promise);
    await hiding;
    expect(events).to.deep.equal(["show", "hide"]);
  });

  it("exposes header/icon parts and switches between custom expand/collapse icon slots", async () => {
    const el = (await fixture(html`<lr-details summary="More">
      <span slot="expand-icon">plus</span>
      <span slot="collapse-icon">minus</span>
      Content
    </lr-details>`)) as LyraDetails;
    expect(el.shadowRoot!.querySelector('[part="header"]')).to.exist;
    const icon = el.shadowRoot!.querySelector('[part~="icon"]') as HTMLElement;
    expect((icon) != null).to.equal(true);
    expect(icon.part.contains("summary-icon")).to.be.true;
    expect(el.shadowRoot!.querySelector('slot[name="expand-icon"]')).to.exist;

    await el.show();
    expect(el.shadowRoot!.querySelector('slot[name="collapse-icon"]')).to.exist;
  });

  it("publishes the animating custom state only while a transition is settling", async () => {
    const el = (await fixture(html`<lr-details
      summary="Animation state"
      style="--show-duration: 40ms"
    >Content</lr-details>`)) as LyraDetails;

    const showing = el.show();
    await el.updateComplete;
    expect(el.matches(":state(animating)")).to.be.true;
    await showing;
    expect(el.matches(":state(animating)")).to.be.false;
  });

  it("places the icon at logical start and consumes the upstream --spacing hook", async () => {
    const el = (await fixture(html`<lr-details
      summary="More"
      icon-placement="start"
      style="--spacing: 13px"
    >Content</lr-details>`)) as LyraDetails;
    const header = el.shadowRoot!.querySelector('[part="header"]') as HTMLElement;
    const icon = el.shadowRoot!.querySelector('[part~="icon"]') as HTMLElement;
    const summary = el.shadowRoot!.querySelector('[part="summary"]') as HTMLElement;
    expect((header.firstElementChild) === (el.shadowRoot!.querySelector(".summary-content"))).to.equal(true);
    expect(getComputedStyle(icon).order).to.equal("-1");
    expect(getComputedStyle(summary).paddingInlineStart).to.equal("13px");
  });

  it("does not toggle when a slotted summary link is activated", async () => {
    const el = (await fixture(html`<lr-details>
      <a slot="summary" href="#details-link-target">Read more</a>
      Content
    </lr-details>`)) as LyraDetails;
    const link = el.querySelector("a")!;
    link.addEventListener("click", (event) => event.preventDefault());
    link.click();
    await el.updateComplete;
    expect(el.open).to.be.false;
  });

  it("is accessible with custom icons, grouping, and a populated open panel", async () => {
    const el = (await fixture(html`<lr-details name="faq" summary="Answer" open>
      <span slot="expand-icon" aria-hidden="true">+</span>
      <span slot="collapse-icon" aria-hidden="true">−</span>
      The answer.
    </lr-details>`)) as LyraDetails;
    await expect(el).to.be.accessible();
  });
});
