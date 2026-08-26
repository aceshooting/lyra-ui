import { fixture, expect, html, oneEvent } from "@open-wc/testing";
import { LitElement, type PropertyValues } from "lit";
import "./details.js";
import "./accordion.js";
import "./accordion-item.js";
import type { LyraDetails } from "./details.js";
import type { LyraAccordion } from "./accordion.js";
import type { LyraAccordionItem } from "./accordion-item.js";
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

it("forwards a host aria-label to the native summary by presence and restores content naming when removed", async () => {
  const el = (await fixture(
    html`<lr-details summary="Fallback details" aria-label=""
      >Content</lr-details
    >`
  )) as LyraDetails;
  const summary = el.shadowRoot!.querySelector(
    '[part="summary"]'
  ) as HTMLElement;

  expect(summary.hasAttribute("aria-label")).to.equal(true);
  expect(summary.getAttribute("aria-label")).to.equal("");

  el.setAttribute("aria-label", "Author details");
  await el.updateComplete;
  expect(summary.getAttribute("aria-label")).to.equal("Author details");

  el.removeAttribute("aria-label");
  await el.updateComplete;
  expect(summary.hasAttribute("aria-label")).to.equal(false);
  expect(summary.textContent).to.contain("Fallback details");
});

it("does not toggle for an interactive summary child created in another realm", async () => {
  const el = (await fixture(
    html`<lr-details>Content</lr-details>`
  )) as LyraDetails;
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

    expect(
      link instanceof Element,
      "fixture really crosses constructor realms"
    ).to.equal(false);
    link.click();
    await el.updateComplete;
    expect(el.open).to.be.false;
  } finally {
    iframe.remove();
  }
});

it("closes sibling items in single-collapsible mode", async () => {
  const el = await fixture(html`<lr-accordion mode="single-collapsible">
    <lr-accordion-item expanded label="One">A</lr-accordion-item>
    <lr-accordion-item label="Two">B</lr-accordion-item>
  </lr-accordion>`);
  const panels = [
    ...el.querySelectorAll("lr-accordion-item"),
  ] as LyraAccordionItem[];
  await panels[1]!.expand();
  await Promise.all(panels.map((panel) => panel.updateComplete));
  expect(panels[0]!.expanded).to.be.false;
});

it("reconciles multiple initially-expanded items in a single mode", async () => {
  const el = await fixture(html`<lr-accordion mode="single-collapsible">
    <lr-accordion-item expanded label="One">A</lr-accordion-item>
    <lr-accordion-item expanded label="Two">B</lr-accordion-item>
  </lr-accordion>`);
  const panels = [
    ...el.querySelectorAll("lr-accordion-item"),
  ] as LyraAccordionItem[];
  await Promise.all(panels.map((panel) => panel.updateComplete));

  expect(panels.map((panel) => panel.expanded)).to.deep.equal([true, false]);
});

it("reconciles expanded items when mode changes from multiple to single", async () => {
  const el = (await fixture(html`<lr-accordion mode="multiple">
    <lr-accordion-item expanded label="One">A</lr-accordion-item>
    <lr-accordion-item expanded label="Two">B</lr-accordion-item>
  </lr-accordion>`)) as LyraAccordion;
  el.mode = "single-collapsible";
  await el.updateComplete;
  const panels = [
    ...el.querySelectorAll("lr-accordion-item"),
  ] as LyraAccordionItem[];
  await Promise.all(panels.map((panel) => panel.updateComplete));

  expect(panels.map((panel) => panel.expanded)).to.deep.equal([true, false]);
});

it("reconciles accordion listener ownership when panels are appended, removed, or moved", async () => {
  const first = await fixture(html`<lr-accordion mode="single-collapsible">
    <lr-accordion-item expanded label="One">A</lr-accordion-item>
  </lr-accordion>`);
  const second = await fixture(html`<lr-accordion mode="single-collapsible">
    <lr-accordion-item expanded label="Other">Other</lr-accordion-item>
  </lr-accordion>`);
  const original = first.querySelector(
    "lr-accordion-item"
  ) as LyraAccordionItem;
  const appended = document.createElement(
    "lr-accordion-item"
  ) as LyraAccordionItem;
  appended.label = "Two";
  first.append(appended);
  await new Promise((resolve) => setTimeout(resolve, 0));

  await appended.expand();
  expect(original.expanded).to.be.false;

  const secondSibling = second.querySelector(
    "lr-accordion-item"
  ) as LyraAccordionItem;
  second.append(appended);
  original.expanded = true;
  await new Promise((resolve) => setTimeout(resolve, 0));

  await appended.expand();
  expect(original.expanded).to.be.true;
  expect(secondSibling.expanded).to.be.false;

  appended.remove();
  await new Promise((resolve) => setTimeout(resolve, 0));
  secondSibling.expanded = true;
  await appended.expand();
  expect(secondSibling.expanded).to.be.true;
});

it("does not treat panels owned by a nested accordion as direct siblings", async () => {
  const outer = await fixture(html`<lr-accordion>
    <lr-accordion-item expanded label="Outer">Outer</lr-accordion-item>
    <lr-accordion>
      <lr-accordion-item label="Inner">Inner</lr-accordion-item>
    </lr-accordion>
  </lr-accordion>`);
  const panels = [
    ...outer.querySelectorAll("lr-accordion-item"),
  ] as LyraAccordionItem[];
  await panels[1]!.expand();
  expect(panels[0]!.expanded).to.be.true;
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

it("renders header actions inside the summary row while keeping them outside its toggle behavior", async () => {
  const el = (await fixture(html`
    <lr-details summary="Projects"
      ><button slot="header-actions" id="add">+</button>Content</lr-details
    >`)) as LyraDetails;
  const summary = el.shadowRoot!.querySelector('[part="summary"]') as HTMLElement;
  const slot = el.shadowRoot!.querySelector('slot[name="header-actions"]');
  expect(slot, "a header-actions slot must exist in the summary row").to.exist;
  expect(
    summary.contains(slot),
    "the header-actions slot must remain outside the native details-content subtree",
  ).to.be.true;
});

it("keeps collapsed header actions rendered, visible, and hit-testable", async () => {
  const el = (await fixture(html`
    <lr-details summary="Projects" style="max-inline-size:400px"
      ><button slot="header-actions" id="add">+</button>Panel body</lr-details
    >`)) as LyraDetails;
  const button = el.querySelector("#add") as HTMLButtonElement;
  await el.updateComplete;
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

  expect(
    button.checkVisibility({
      checkVisibilityCSS: true,
      contentVisibilityAuto: true,
    })
  ).to.be.true;
  const rect = button.getBoundingClientRect();
  expect(
    document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2)?.id
  ).to.equal("add");
});

it("lays short open content below the full summary row", async () => {
  const el = (await fixture(html`
    <lr-details open summary="Projects" style="max-inline-size:400px"
      ><span>Short panel body</span></lr-details
    >`)) as LyraDetails;
  const summary = el.shadowRoot!.querySelector('[part="summary"]') as HTMLElement;
  const content = el.shadowRoot!.querySelector('[part="content"]') as HTMLElement;
  const summaryRect = summary.getBoundingClientRect();
  const contentRect = content.getBoundingClientRect();
  expect(contentRect.left).to.be.closeTo(summaryRect.left, 1);
  expect(contentRect.top).to.be.at.least(summaryRect.bottom - 1);
});

it("does not toggle the panel when a header-actions control is activated (bug)", async () => {
  const el = (await fixture(html`
    <lr-details summary="Projects"
      ><button slot="header-actions" id="add">+</button>Content</lr-details
    >`)) as LyraDetails;
  const button = el.querySelector("#add") as HTMLButtonElement;
  let clicked = 0;
  button.addEventListener("click", () => { clicked += 1; });

  button.click();

  expect(clicked, "the header-actions button must still receive its own click").to.equal(1);
  expect(el.open, "activating a header-actions control must not also toggle the panel").to.be.false;
});

it("does not toggle when the header-actions wrapper itself is activated", async () => {
  const el = (await fixture(html`
    <lr-details summary="Projects"
      ><span slot="header-actions">Status</span>Content</lr-details
    >`)) as LyraDetails;
  const actions = el.shadowRoot!.querySelector('[part~="header-actions"]') as HTMLElement;

  actions.click();
  await el.updateComplete;

  expect(el.open).to.be.false;
});

it("hides the header-actions wrapper and reclaims its layout space when the slot is empty", async () => {
  const el = (await fixture(
    html`<lr-details summary="Projects">Content</lr-details>`
  )) as LyraDetails;
  const actions = el.shadowRoot!.querySelector('[part~="header-actions"]') as HTMLElement;
  expect(actions.hidden, "an unused header-actions wrapper must not claim visible layout space").to.be.true;
});

it("exposes disabled to assistive tech via aria-disabled on the summary, rendered in both states", async () => {
  const el = (await fixture(
    html`<lr-details summary="More" disabled>Content</lr-details>`
  )) as LyraDetails;
  const summary = el.shadowRoot!.querySelector(
    '[part="summary"]'
  ) as HTMLElement;
  expect(summary.getAttribute("aria-disabled")).to.equal("true");
  expect(summary.getAttribute('tabindex')).to.equal('-1');

  el.disabled = false;
  await el.updateComplete;
  expect(summary.getAttribute("aria-disabled")).to.equal("false");
  expect(summary.hasAttribute('tabindex')).to.be.false;
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

it("keeps disabled summary paint unchanged on hover and press", async () => {
  const el = (await fixture(html`
    <lr-details
      summary="More"
      disabled
      style="--lr-details-summary-hover-bg:rgb(1,2,3);--lr-details-summary-active-bg:rgb(4,5,6)"
      >Content</lr-details
    >
  `)) as LyraDetails;
  const summary =
    el.shadowRoot!.querySelector<HTMLElement>('[part="summary"]')!;
  const rest = getComputedStyle(summary).backgroundColor;
  const rect = summary.getBoundingClientRect();
  try {
    await sendMouse({
      type: "move",
      position: [
        Math.round(rect.left + rect.width / 2),
        Math.round(rect.top + rect.height / 2),
      ],
    });
    expect(getComputedStyle(summary).backgroundColor).to.equal(rest);
    await sendMouse({ type: "down" });
    expect(getComputedStyle(summary).backgroundColor).to.equal(rest);
  } finally {
    await sendMouse({ type: "up" });
    await resetMouse();
  }
});

it("keeps the disclosure marker vertical under RTL in both states", () => {
  const css = detailsStyles.cssText.replace(/\s+/g, " ");
  expect(css).to.include(
    ".icon-fallback { display: inline-flex; transform: rotate(90deg)"
  );
  expect(css).to.include(
    ":host([open]) .icon-fallback { transform: rotate(-90deg)"
  );
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
  ).shadowRoot!.querySelector(".icon-fallback") as HTMLElement;
  expect(chevronAngleDeg(closedIcon)).to.be.closeTo(90, 0.01);

  const openWrapper = await fixture(
    html`<div dir="rtl">
      <lr-details summary="More" open>Content</lr-details>
    </div>`
  );
  const openIcon = (
    openWrapper.querySelector("lr-details") as LyraDetails
  ).shadowRoot!.querySelector(".icon-fallback") as HTMLElement;
  expect(chevronAngleDeg(openIcon)).to.be.closeTo(-90, 0.01);
});

it("contains an expanded long summary, content, and action in an exact 320px RTL allocation", async () => {
  const wrapper = await fixture<HTMLElement>(html`
    <div dir="rtl" style="inline-size: 320px; max-inline-size: 100%;">
      <lr-details open>
        <span slot="summary"
          >عنوانتفاصيلمحليطويلجداًبدونأيفرصةللفصلالتلقائي</span
        >
        <p>محتوىتفصيليمحليطويلجداًبدونأيفرصةللفصلالتلقائي</p>
        <button type="button">إجراءمحليطويلجداًبدونأيفرصةللفصلالتلقائي</button>
      </lr-details>
    </div>
  `);
  const el = wrapper.querySelector("lr-details") as LyraDetails;
  await el.updateComplete;
  const base = el.shadowRoot!.querySelector<HTMLElement>('[part~="base"]')!;
  const summary =
    el.shadowRoot!.querySelector<HTMLElement>('[part="summary"]')!;
  const content =
    el.shadowRoot!.querySelector<HTMLElement>('[part="content"]')!;

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
  const css = detailsStyles.cssText.replace(/"/g, "'").replace(/\s+/g, " ");
  expect(css).to.match(/\[part='summary'\]:hover\s*\{[^}]*background:/);
  expect(css).to.match(/\[part='summary'\]:focus-visible\s*\{[^}]*outline:/);
});

it("inherits independent appearance and pointer-state paint without retinting shared tokens", async () => {
  const wrapper = await fixture<HTMLElement>(html`
    <div
      style="
      --lr-details-outlined-bg: rgb(1, 2, 3);
      --lr-details-outlined-border-color: rgb(4, 5, 6);
      --lr-details-filled-bg: rgb(7, 8, 9);
      --lr-details-filled-border-color: rgb(10, 11, 12);
      --lr-details-filled-outlined-bg: rgb(13, 14, 15);
      --lr-details-filled-outlined-border-color: rgb(16, 17, 18);
      --lr-details-summary-hover-bg: rgb(19, 20, 21);
      --lr-details-summary-active-bg: rgb(22, 23, 24);
    "
    >
      <lr-details appearance="outlined" summary="Outlined">Content</lr-details>
      <lr-details appearance="filled" summary="Filled">Content</lr-details>
      <lr-details appearance="filled-outlined" summary="Filled outlined"
        >Content</lr-details
      >
    </div>
  `);
  const items = [...wrapper.querySelectorAll("lr-details")] as LyraDetails[];
  await Promise.all(items.map((item) => item.updateComplete));
  const bases = items.map(
    (item) => item.shadowRoot!.querySelector<HTMLElement>('[part~="base"]')!
  );

  expect(getComputedStyle(bases[0]!).backgroundColor).to.equal("rgb(1, 2, 3)");
  expect(getComputedStyle(bases[0]!).borderTopColor).to.equal("rgb(4, 5, 6)");
  expect(getComputedStyle(bases[1]!).backgroundColor).to.equal("rgb(7, 8, 9)");
  expect(getComputedStyle(bases[1]!).borderTopColor).to.equal(
    "rgb(10, 11, 12)"
  );
  expect(getComputedStyle(bases[2]!).backgroundColor).to.equal(
    "rgb(13, 14, 15)"
  );
  expect(getComputedStyle(bases[2]!).borderTopColor).to.equal(
    "rgb(16, 17, 18)"
  );

  const summary =
    items[0]!.shadowRoot!.querySelector<HTMLElement>('[part="summary"]')!;
  summary.scrollIntoView();
  const rect = summary.getBoundingClientRect();
  try {
    await sendMouse({
      type: "move",
      position: [
        Math.round(rect.left + rect.width / 2),
        Math.round(rect.top + rect.height / 2),
      ],
    });
    expect(getComputedStyle(summary).backgroundColor).to.equal(
      "rgb(19, 20, 21)"
    );
    await sendMouse({ type: "down" });
    expect(getComputedStyle(summary).backgroundColor).to.equal(
      "rgb(22, 23, 24)"
    );
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
    const header =
      item.shadowRoot!.querySelector<HTMLElement>('[part="header"]')!;
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

  it("reports whether an accepted toggle came from a user, API call, or named peer", async () => {
    const el = (await fixture(
      html`<lr-details summary="More">Content</lr-details>`
    )) as LyraDetails;
    const summary = el.shadowRoot!.querySelector(
      '[part="summary"]'
    ) as HTMLElement;

    const userToggle = oneEvent(el, "lr-toggle") as Promise<
      CustomEvent<{ open: boolean; source: string }>
    >;
    summary.click();
    expect((await userToggle).detail).to.deep.equal({
      open: true,
      source: "user",
    });

    const apiToggle = oneEvent(el, "lr-toggle") as Promise<
      CustomEvent<{ open: boolean; source: string }>
    >;
    await el.hide();
    expect((await apiToggle).detail).to.deep.equal({
      open: false,
      source: "programmatic",
    });

    const pair = await fixture<HTMLElement>(html`
      <div>
        <lr-details name="answers" summary="First" open>First panel</lr-details>
        <lr-details name="answers" summary="Second">Second panel</lr-details>
      </div>
    `);
    const [first, second] = [
      ...pair.querySelectorAll("lr-details"),
    ] as [LyraDetails, LyraDetails];
    await Promise.all([first.updateComplete, second.updateComplete]);
    const peerToggle = oneEvent(first, "lr-toggle") as Promise<
      CustomEvent<{ open: boolean; source: string }>
    >;
    await second.show();
    expect((await peerToggle).detail).to.deep.equal({
      open: false,
      source: "peer",
    });
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
    el.addEventListener("lr-show", (event) =>
      (event as Event).preventDefault()
    );

    summary.click();
    await el.updateComplete;

    expect(el.open).to.be.false;
    expect(base.open, "a vetoed open must not leave the native panel expanded")
      .to.be.false;
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
    el.addEventListener("lr-hide", (event) =>
      (event as Event).preventDefault()
    );

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
    for (const name of [
      "lr-show",
      "lr-after-show",
      "lr-hide",
      "lr-after-hide",
      "lr-toggle",
    ]) {
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
    getComputedStyle(
      el.shadowRoot!.querySelector('[part="summary"]') as HTMLElement
    );
  const contentOf = (el: LyraDetails): CSSStyleDeclaration =>
    getComputedStyle(
      el.shadowRoot!.querySelector('[part="content"]') as HTMLElement
    );

  const render = async (size?: string): Promise<LyraDetails> =>
    (await fixture(
      size === undefined
        ? html`<lr-details summary="More">Content</lr-details>`
        : html`<lr-details summary="More" size=${size}>Content</lr-details>`
    )) as LyraDetails;

  it('defaults to "m", and the unset default renders identically to the explicit tier', async () => {
    const unset = await render();
    const explicit = await render("m");
    expect(unset.size).to.equal("m");
    expect(unset.getAttribute("size")).to.equal("m");
    expect(summaryOf(unset).paddingBlockStart).to.equal(
      summaryOf(explicit).paddingBlockStart
    );
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
      expect(measured[i]!.padding, `summary padding tier ${i}`).to.be.at.least(
        measured[i - 1]!.padding
      );
      expect(measured[i]!.font, `summary font tier ${i}`).to.be.at.least(
        measured[i - 1]!.font
      );
      expect(measured[i]!.content, `content padding tier ${i}`).to.be.at.least(
        measured[i - 1]!.content
      );
    }
    expect(measured.at(-1)!.padding, "xl padding beats 2xs").to.be.greaterThan(
      measured[0]!.padding
    );
    expect(measured.at(-1)!.font, "xl font beats 2xs").to.be.greaterThan(
      measured[0]!.font
    );
  });

  it("accepts the Web Awesome size spellings as exact synonyms of the step names", async () => {
    for (const [step, alias] of [
      ["s", "small"],
      ["m", "medium"],
      ["l", "large"],
    ] as const) {
      const stepped = summaryOf(await render(step));
      const aliased = summaryOf(await render(alias));
      expect(aliased.paddingBlockStart, `${alias} padding`).to.equal(
        stepped.paddingBlockStart
      );
      expect(aliased.fontSize, `${alias} font`).to.equal(stepped.fontSize);
    }
  });

  it("stays accessible and keyboard-operable at the smallest tier", async () => {
    const el = await render("2xs");
    await expect(el).to.be.accessible();
    const summary = el.shadowRoot!.querySelector(
      '[part="summary"]'
    ) as HTMLElement;
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
    const [one, two, other] = [
      ...wrapper.querySelectorAll("lr-details"),
    ] as [LyraDetails, LyraDetails, LyraDetails];

    await two.show();

    expect(one.open).to.be.false;
    expect(two.open).to.be.true;
    expect(other.open).to.be.true;
    expect(
      (two.shadowRoot!.querySelector('[part~="base"]') as HTMLDetailsElement)
        .name
    ).to.equal("faq");
  });

  it("reconciles a live name change with changed-disclosure-wins semantics", async () => {
    const wrapper = await fixture(html`<div>
      <lr-details
        id="rename-first"
        name="faq"
        summary="One"
        open
        style="--hide-duration: 1ms"
        >One</lr-details
      >
      <lr-details id="rename-winner" name="other" summary="Two" open
        >Two</lr-details
      >
    </div>`);
    const first = wrapper.querySelector<LyraDetails>("#rename-first")!;
    const winner = wrapper.querySelector<LyraDetails>("#rename-winner")!;
    const peerToggle = oneEvent(first, "lr-toggle") as Promise<
      CustomEvent<{ open: boolean; source: string }>
    >;

    winner.name = "faq";
    await winner.updateComplete;

    expect(first.open).to.be.false;
    expect(winner.open).to.be.true;
    expect(winner.name).to.equal("faq");
    expect((await peerToggle).detail).to.deep.equal({
      open: false,
      source: "peer",
    });
  });

  it("rejects a live name change when a conflicting peer vetoes its close", async () => {
    const wrapper = await fixture(html`<div>
      <lr-details name="locked" summary="Locked" open>Locked</lr-details>
      <lr-details name="other" summary="Candidate" open>Candidate</lr-details>
    </div>`);
    const [locked, candidate] = [
      ...wrapper.querySelectorAll("lr-details"),
    ] as [LyraDetails, LyraDetails];
    locked.addEventListener("lr-hide", (event) => event.preventDefault());

    candidate.name = "locked";
    await candidate.updateComplete;

    expect(locked.open).to.be.true;
    expect(candidate.open).to.be.true;
    expect(candidate.name).to.equal("other");
    expect(candidate.getAttribute("name")).to.equal("other");
  });

  it("reconciles open named disclosures after moving into another shadow root", async () => {
    const wrapper = await fixture<HTMLElement>(html`<div>
      <div id="details-root"></div>
      <lr-details id="details-moving" name="faq" summary="Moving" open
        >Moving</lr-details
      >
    </div>`);
    const host = wrapper.querySelector<HTMLElement>("#details-root")!;
    const shadow = host.attachShadow({ mode: "open" });
    const incumbent = document.createElement("lr-details") as LyraDetails;
    incumbent.name = "faq";
    incumbent.summary = "Incumbent";
    incumbent.open = true;
    incumbent.style.setProperty("--hide-duration", "1ms");
    shadow.append(incumbent);
    await incumbent.updateComplete;
    const moving = wrapper.querySelector<LyraDetails>("#details-moving")!;

    shadow.append(moving);
    await new Promise<void>((resolve) => queueMicrotask(resolve));
    await Promise.all([incumbent.updateComplete, moving.updateComplete]);

    expect(incumbent.open).to.be.false;
    expect(moving.open).to.be.true;
  });

  it("keeps a named group single-open when an existing peer vetoes its hide", async () => {
    const wrapper = await fixture(html`<div>
      <lr-details name="faq" summary="One" open>One</lr-details>
      <lr-details name="faq" summary="Two">Two</lr-details>
    </div>`);
    const [one, two] = [
      ...wrapper.querySelectorAll("lr-details"),
    ] as [LyraDetails, LyraDetails];
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
    expect(icon != null).to.equal(true);
    expect(icon.part.contains("summary-icon")).to.be.true;
    expect(el.shadowRoot!.querySelector('slot[name="expand-icon"]')).to.exist;

    await el.show();
    expect(el.shadowRoot!.querySelector('slot[name="collapse-icon"]')).to.exist;
  });

  it("publishes the animating custom state only while a transition is settling", async () => {
    const el = (await fixture(html`<lr-details
      summary="Animation state"
      style="--show-duration: 40ms"
      >Content</lr-details
    >`)) as LyraDetails;

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
      >Content</lr-details
    >`)) as LyraDetails;
    const header = el.shadowRoot!.querySelector(
      '[part="header"]'
    ) as HTMLElement;
    const icon = el.shadowRoot!.querySelector('[part~="icon"]') as HTMLElement;
    const summary = el.shadowRoot!.querySelector(
      '[part="summary"]'
    ) as HTMLElement;
    expect(
      header.firstElementChild ===
        el.shadowRoot!.querySelector(".summary-content")
    ).to.equal(true);
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
