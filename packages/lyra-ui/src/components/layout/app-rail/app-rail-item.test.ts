import { fixture, expect, html } from "@open-wc/testing";
import "./app-rail-item.js";
import type { LyraAppRailItem } from "./app-rail-item.js";

it("renders a labeled link with icon and label parts", async () => {
  const el = (await fixture(html`
    <lr-app-rail-item href="/inbox" aria-label="Inbox">
      <span slot="icon" aria-hidden="true">📥</span>Inbox
    </lr-app-rail-item>
  `)) as LyraAppRailItem;

  expect(el.shadowRoot!.querySelector('[part="base"]')!.tagName).to.equal("A");
  expect(el.shadowRoot!.querySelector('[part="icon"]')).to.exist;
  expect(el.textContent).to.include("Inbox");
});

it("renders a disabled button when no href is available", async () => {
  const el = (await fixture(
    html`<lr-app-rail-item disabled>Settings</lr-app-rail-item>`
  )) as LyraAppRailItem;
  const button = el.shadowRoot!.querySelector(
    '[part="base"]'
  ) as HTMLButtonElement;
  expect(button.tagName).to.equal("BUTTON");
  expect(button.disabled).to.be.true;
});

it("hardens links opened in a new browsing context", async () => {
  const el = (await fixture(
    html`<lr-app-rail-item href="https://example.test" target="_blank"
      >Open</lr-app-rail-item
    >`
  )) as LyraAppRailItem;
  expect(
    el.shadowRoot!.querySelector('[part="base"]')!.getAttribute("rel")
  ).to.equal("noopener noreferrer");
});

it("floors the row at the shared target size without inflating it from the icon box", async () => {
  const el = (await fixture(html`
    <lr-app-rail-item href="/inbox" aria-label="Inbox">
      <span slot="icon" aria-hidden="true">📥</span>Inbox
    </lr-app-rail-item>
  `)) as LyraAppRailItem;
  const icon = el.shadowRoot!.querySelector('[part="icon"]')!;
  expect(getComputedStyle(icon).minInlineSize).to.equal("40px");
  expect(icon.getBoundingClientRect().width).to.be.at.least(40);
  // The row's tappable height comes from [part='base']'s own min-block-size, not from the icon.
  // Flooring the icon's block axis too would add nothing for target size while forcing every row
  // to --lr-icon-button-size + 2x --lr-space-s (56px at defaults) -- a density regression.
  expect(getComputedStyle(icon).minBlockSize).to.equal("auto");
  expect(
    el.shadowRoot!.querySelector('[part="base"]')!.getBoundingClientRect()
      .height
  ).to.equal(40);
});

it("is accessible", async () => {
  const el = (await fixture(
    html`<lr-app-rail-item href="/home" aria-label="Home"
      >Home</lr-app-rail-item
    >`
  )) as LyraAppRailItem;
  await expect(el).to.be.accessible();
});

it("hides the icon slot wrapper from assistive tech even without a host aria-label", async () => {
  const el = (await fixture(html`
    <lr-app-rail-item href="/inbox">
      <span slot="icon">📥</span>Inbox
    </lr-app-rail-item>
  `)) as LyraAppRailItem;
  const icon = el.shadowRoot!.querySelector('[part="icon"]')!;
  expect(icon.getAttribute("aria-hidden")).to.equal("true");
});

it('marks the base part aria-current="page" when active', async () => {
  const el = (await fixture(
    html`<lr-app-rail-item href="/home" active>Home</lr-app-rail-item>`
  )) as LyraAppRailItem;
  const base = el.shadowRoot!.querySelector('[part="base"]')!;
  expect(base.getAttribute("aria-current")).to.equal("page");
});

it("omits aria-current when not active", async () => {
  const el = (await fixture(
    html`<lr-app-rail-item href="/home">Home</lr-app-rail-item>`
  )) as LyraAppRailItem;
  const base = el.shadowRoot!.querySelector('[part="base"]')!;
  expect(base.hasAttribute("aria-current")).to.be.false;
});

it("reflects active as a host attribute", async () => {
  const el = (await fixture(
    html`<lr-app-rail-item href="/home" active>Home</lr-app-rail-item>`
  )) as LyraAppRailItem;
  expect(el.hasAttribute("active")).to.be.true;
  el.active = false;
  await el.updateComplete;
  expect(el.hasAttribute("active")).to.be.false;
});

describe("active", () => {
  it('reflects aria-current="page" onto [part=base] when true', async () => {
    const el = (await fixture(
      html`<lr-app-rail-item href="/inbox" active>Inbox</lr-app-rail-item>`
    )) as LyraAppRailItem;
    const base = el.shadowRoot!.querySelector('[part="base"]')!;
    expect(base.getAttribute("aria-current")).to.equal("page");
  });

  it("defaults to false and omits aria-current entirely", async () => {
    const el = (await fixture(
      html`<lr-app-rail-item href="/inbox">Inbox</lr-app-rail-item>`
    )) as LyraAppRailItem;
    expect(el.active).to.be.false;
    const base = el.shadowRoot!.querySelector('[part="base"]')!;
    expect(base.hasAttribute("aria-current")).to.be.false;
  });

  it("reflects on the button-rendering path too (no href)", async () => {
    const el = (await fixture(
      html`<lr-app-rail-item active>Settings</lr-app-rail-item>`
    )) as LyraAppRailItem;
    const base = el.shadowRoot!.querySelector('[part="base"]')!;
    expect(base.tagName).to.equal("BUTTON");
    expect(base.getAttribute("aria-current")).to.equal("page");
  });
});

describe("tooltip", () => {
  it("shows a flyout with the label text on hover/focus when tooltip is set and icon-only is active", async () => {
    const el = (await fixture(
      html`<lr-app-rail-item tooltip icon-only>Dashboard</lr-app-rail-item>`
    )) as LyraAppRailItem;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    let flyout = el.shadowRoot!.querySelector('[part="tooltip"]');
    expect(flyout).to.not.exist;
    base.dispatchEvent(new FocusEvent("focus", { bubbles: true }));
    await el.updateComplete;
    flyout = el.shadowRoot!.querySelector('[part="tooltip"]');
    expect(flyout).to.exist;
    expect(flyout!.textContent!.trim()).to.equal("Dashboard");
    base.dispatchEvent(new FocusEvent("blur", { bubbles: true }));
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="tooltip"]')).to.not.exist;
  });

  it("does not show a flyout when tooltip is unset (the default)", async () => {
    const el = (await fixture(
      html`<lr-app-rail-item icon-only>Dashboard</lr-app-rail-item>`
    )) as LyraAppRailItem;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    base.dispatchEvent(new FocusEvent("focus", { bubbles: true }));
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="tooltip"]')).to.not.exist;
  });

  it("does not show a flyout when tooltip is set but icon-only is not active (label is already visible)", async () => {
    const el = (await fixture(
      html`<lr-app-rail-item tooltip>Dashboard</lr-app-rail-item>`
    )) as LyraAppRailItem;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    base.dispatchEvent(new FocusEvent("focus", { bubbles: true }));
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="tooltip"]')).to.not.exist;
  });

  it("excludes icon-slot text from the flyout label, using only the default slot content", async () => {
    const el = (await fixture(html`
      <lr-app-rail-item tooltip icon-only>
        <span slot="icon">📥</span>Dashboard
      </lr-app-rail-item>
    `)) as LyraAppRailItem;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    base.dispatchEvent(new FocusEvent("focus", { bubbles: true }));
    await el.updateComplete;
    const flyout = el.shadowRoot!.querySelector('[part="tooltip"]');
    expect(flyout!.textContent!.trim()).to.equal("Dashboard");
  });

  it("clears transient tooltip state across disconnect and reconnect", async () => {
    const el = (await fixture(html`
      <lr-app-rail-item tooltip icon-only>Dashboard</lr-app-rail-item>
    `)) as LyraAppRailItem;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    base.dispatchEvent(new FocusEvent("focus", { bubbles: true }));
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll('[part="tooltip"]').length).to.equal(
      1
    );

    const parent = el.parentElement!;
    el.remove();
    parent.append(el);
    await el.updateComplete;

    expect(el.shadowRoot!.querySelectorAll('[part="tooltip"]').length).to.equal(
      0
    );
  });

  it("wraps a long tooltip within the available viewport width", async () => {
    const el = (await fixture(html`
      <lr-app-rail-item tooltip icon-only>
        Dashboard-with-a-very-long-unbroken-localized-navigation-label-that-must-wrap
      </lr-app-rail-item>
    `)) as LyraAppRailItem;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    base.dispatchEvent(new FocusEvent("focus", { bubbles: true }));
    await el.updateComplete;
    await new Promise((resolve) => setTimeout(resolve, 30));

    const flyout = el.shadowRoot!.querySelector(
      '[part="tooltip"]'
    ) as HTMLElement;
    expect(flyout.getBoundingClientRect().width).to.be.at.most(
      window.innerWidth - 16
    );
    expect(getComputedStyle(flyout).overflowWrap).to.equal("anywhere");
  });
});

describe("current-state cssprops", () => {
  /** Resolves what a `declaration` would compute to *inside this component's shadow root*, where the
   *  `--lr-*` design tokens actually live (they are declared on `:host`, so a light-DOM probe would
   *  see none of them). Used to assert the unset defaults byte-for-byte against the tokens they fall
   *  back to. */
  function resolvedInShadow(
    el: LyraAppRailItem,
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

  async function themed(style: string): Promise<LyraAppRailItem> {
    const wrapper = (await fixture(
      html`<div style=${style}>
        <lr-app-rail-item href="/home" active>Home</lr-app-rail-item>
      </div>`
    )) as HTMLElement;
    const el = wrapper.querySelector("lr-app-rail-item") as LyraAppRailItem;
    await el.updateComplete;
    return el;
  }

  const overrides =
    "--lr-app-rail-item-current-bg: rgb(0, 51, 102); --lr-app-rail-item-current-color: rgb(255, 255, 255);";

  it("recolors the aria-current item from an ancestor, not a :host-declared prop", async () => {
    const el = await themed(overrides);
    const base = el.shadowRoot!.querySelector('[part="base"]')!;
    expect(base.getAttribute("aria-current")).to.equal("page");
    const rendered = getComputedStyle(base);
    expect(rendered.backgroundColor).to.equal("rgb(0, 51, 102)");
    expect(rendered.color).to.equal("rgb(255, 255, 255)");
    // The prop is never declared on :host, so an ancestor value is not shadowed.
    expect(el.shadowRoot!.querySelector('[part="base"]')!).to.exist;
  });

  it("renders byte-identically to the pre-cssprop output when the props are unset", async () => {
    const el = await themed("");
    const base = el.shadowRoot!.querySelector('[part="base"]')!;
    const rendered = getComputedStyle(base);
    expect(rendered.backgroundColor).to.equal(
      resolvedInShadow(
        el,
        "background: var(--lr-color-brand-quiet)",
        "background-color"
      )
    );
    expect(rendered.color).to.equal(
      resolvedInShadow(el, "color: var(--lr-color-brand)", "color")
    );
  });

  it("is accessible with the current-state props themed", async () => {
    const el = await themed(overrides);
    await expect(el).to.be.accessible();
  });
});
