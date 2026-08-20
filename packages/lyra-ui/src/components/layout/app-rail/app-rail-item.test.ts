import { fixture, expect, html } from "@open-wc/testing";
import "./app-rail-item.js";
import "./app-rail.js";
import type { LyraAppRailItem } from "./app-rail-item.js";
import { resetMouse, sendMouse } from '../../../../test/wtr-mouse.js';

if (!customElements.get('app-rail-icon-forwarder')) {
  customElements.define(
    'app-rail-icon-forwarder',
    class extends HTMLElement {
      constructor() {
        super();
        this.attachShadow({ mode: 'open' }).append(document.createElement('slot'));
      }
    },
  );
}

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

it('does not inspect an unavailable render root during the server-side first update', () => {
  const el = document.createElement('lr-app-rail-item') as LyraAppRailItem;
  el.href = '/inbox';
  const access = el as unknown as { willUpdate(changed: Map<PropertyKey, unknown>): void };

  expect(() => access.willUpdate(new Map([['href', '']]))).not.to.throw();
});

it('inherits independent hover and pressed paint from an ancestor', async () => {
  const wrapper = await fixture<HTMLElement>(html`
    <div style="
      --lr-app-rail-item-hover-bg: rgb(1, 2, 3);
      --lr-app-rail-item-hover-color: rgb(4, 5, 6);
      --lr-app-rail-item-active-bg: rgb(7, 8, 9);
      --lr-app-rail-item-active-color: rgb(10, 11, 12);
    ">
      <lr-app-rail-item>Reports</lr-app-rail-item>
    </div>
  `);
  const el = wrapper.querySelector('lr-app-rail-item') as LyraAppRailItem;
  const target = el.shadowRoot!.querySelector<HTMLElement>('[part="base"]')!;
  const rect = target.getBoundingClientRect();
  try {
    await sendMouse({ type: 'move', position: [Math.round(rect.left + rect.width / 2), Math.round(rect.top + rect.height / 2)] });
    expect(getComputedStyle(target).backgroundColor).to.equal('rgb(1, 2, 3)');
    expect(getComputedStyle(target).color).to.equal('rgb(4, 5, 6)');
    await sendMouse({ type: 'down' });
    expect(getComputedStyle(target).backgroundColor).to.equal('rgb(7, 8, 9)');
    expect(getComputedStyle(target).color).to.equal('rgb(10, 11, 12)');
  } finally {
    await resetMouse();
  }
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
  expect(button.getAttribute("aria-disabled")).to.equal("true");
});

it('keeps disabled rail-item paint unchanged on hover and press', async () => {
  const el = (await fixture(html`
    <lr-app-rail-item
      disabled
      style="--lr-app-rail-item-hover-bg:rgb(1,2,3);--lr-app-rail-item-active-bg:rgb(4,5,6)"
    >Settings</lr-app-rail-item>
  `)) as LyraAppRailItem;
  const target = el.shadowRoot!.querySelector<HTMLElement>('[part="base"]')!;
  const rest = getComputedStyle(target).backgroundColor;
  const rect = target.getBoundingClientRect();
  try {
    await sendMouse({
      type: 'move',
      position: [Math.round(rect.left + rect.width / 2), Math.round(rect.top + rect.height / 2)],
    });
    expect(getComputedStyle(target).backgroundColor).to.equal(rest);
    await sendMouse({ type: 'down' });
    expect(getComputedStyle(target).backgroundColor).to.equal(rest);
  } finally {
    await sendMouse({ type: 'up' });
    await resetMouse();
  }
});

it("preserves focus when href changes replace the native link and button owners", async () => {
  const el = (await fixture(
    html`<lr-app-rail-item href="/inbox">Inbox</lr-app-rail-item>`
  )) as LyraAppRailItem;
  (el.shadowRoot!.querySelector('[part="base"]') as HTMLElement).focus();

  el.href = "";
  await el.updateComplete;
  expect(el.shadowRoot!.activeElement?.tagName).to.equal("BUTTON");

  el.href = "/archive";
  await el.updateComplete;
  expect(el.shadowRoot!.activeElement?.tagName).to.equal("A");
});

it("does not move external focus when href changes its native owner", async () => {
  const wrapper = await fixture(html`
    <div>
      <button id="outside">Outside</button>
      <lr-app-rail-item href="/inbox">Inbox</lr-app-rail-item>
    </div>
  `);
  const el = wrapper.querySelector('lr-app-rail-item') as LyraAppRailItem;
  wrapper.querySelector<HTMLElement>('#outside')!.focus();
  el.href = "";
  await el.updateComplete;
  expect(el.ownerDocument.activeElement?.id).to.equal('outside');
});

it('returns focus externally when a replacement owner is disabled or inert', async () => {
  for (const unavailable of ['disabled', 'inert'] as const) {
    const wrapper = await fixture(html`
      <div>
        <button id="app-rail-return-${unavailable}">Before rail</button>
        <lr-app-rail-item href="/inbox">Inbox</lr-app-rail-item>
      </div>
    `);
    const el = wrapper.querySelector('lr-app-rail-item') as LyraAppRailItem;
    const outside = wrapper.querySelector<HTMLElement>(`#app-rail-return-${unavailable}`)!;
    outside.focus();
    el.shadowRoot!.querySelector<HTMLElement>('[part="base"]')!.focus();

    el.href = '';
    if (unavailable === 'disabled') el.disabled = true;
    else el.inert = true;
    await el.updateComplete;

    expect(el.ownerDocument.activeElement === outside, unavailable).to.equal(true);
  }
});

it('focuses the stable owning rail when a disabled replacement has no external return target', async () => {
  const rail = await fixture<HTMLElement>(html`
    <lr-app-rail>
      <lr-app-rail-item href="/inbox">Inbox</lr-app-rail-item>
    </lr-app-rail>
  `);
  const el = rail.querySelector('lr-app-rail-item') as LyraAppRailItem;
  el.shadowRoot!.querySelector<HTMLElement>('[part="base"]')!.focus();
  (el as unknown as { focusReturnTarget?: HTMLElement }).focusReturnTarget = undefined;

  el.href = '';
  el.disabled = true;
  await el.updateComplete;

  expect(rail.shadowRoot!.activeElement?.getAttribute('part')).to.contain('base');
});

describe("host aria-label precedence", () => {
  for (const [name, markup] of [
    [
      "link",
      html`<lr-app-rail-item href="/inbox" aria-label="">Inbox</lr-app-rail-item>`,
    ],
    [
      "button",
      html`<lr-app-rail-item aria-label="">Settings</lr-app-rail-item>`,
    ],
  ] as const) {
    it(`preserves an explicit empty host label on its ${name} owner and restores name-from-content when removed`, async () => {
      const el = (await fixture(markup)) as LyraAppRailItem;
      const base = el.shadowRoot!.querySelector<HTMLElement>('[part="base"]')!;

      expect(base.getAttribute("aria-label")).to.equal("");

      el.setAttribute("aria-label", "Archived item");
      await el.updateComplete;
      expect(base.getAttribute("aria-label")).to.equal("Archived item");

      el.removeAttribute("aria-label");
      await el.updateComplete;
      expect(base.hasAttribute("aria-label")).to.be.false;
    });
  }

  it("does not replace an explicit empty host label with tooltip text", async () => {
    const el = (await fixture(html`
      <lr-app-rail-item tooltip icon-only aria-label="">Dashboard</lr-app-rail-item>
    `)) as LyraAppRailItem;
    const base = el.shadowRoot!.querySelector<HTMLElement>('[part="base"]')!;

    base.dispatchEvent(new FocusEvent("focus", { bubbles: true }));
    await el.updateComplete;

    expect(
      el.shadowRoot!.querySelector<HTMLElement>('[part="tooltip"]')!.textContent!.trim()
    ).to.equal("");
  });
});

describe("host click()", () => {
  for (const [name, markup] of [
    ["button", html`<lr-app-rail-item>Settings</lr-app-rail-item>`],
    ["link", html`<lr-app-rail-item href="/settings">Settings</lr-app-rail-item>`],
  ] as const) {
    it(`activates the internal ${name}`, async () => {
      const el = (await fixture(markup)) as LyraAppRailItem;
      const base = el.shadowRoot!.querySelector<HTMLElement>('[part="base"]')!;
      let activations = 0;
      base.addEventListener("click", (event) => {
        event.preventDefault();
        activations += 1;
      });

      el.click();

      expect(activations).to.equal(1);
    });
  }

  it("does not activate the internal button while disabled", async () => {
    const el = (await fixture(
      html`<lr-app-rail-item disabled>Settings</lr-app-rail-item>`
    )) as LyraAppRailItem;
    const base = el.shadowRoot!.querySelector<HTMLElement>('[part="base"]')!;
    let activations = 0;
    base.addEventListener("click", () => (activations += 1));

    el.click();

    expect(activations).to.equal(0);
  });
});

it('renders aria-disabled="false" on an enabled item', async () => {
  const el = (await fixture(
    html`<lr-app-rail-item href="/settings">Settings</lr-app-rail-item>`
  )) as LyraAppRailItem;
  expect(
    el.shadowRoot!.querySelector('[part="base"]')!.getAttribute("aria-disabled")
  ).to.equal("false");
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

it('keeps flattened interactive icon content visible but inert and outside the focus order', async () => {
  const root = await fixture<HTMLElement>(html`
    <div>
      <button id="before-app-rail-icon" type="button">Before</button>
      <lr-app-rail-item href="/inbox">
        <app-rail-icon-forwarder slot="icon">
          <button id="nested-app-rail-icon" type="button">Decorative icon control</button>
        </app-rail-icon-forwarder>
        Inbox
      </lr-app-rail-item>
      <a id="after-app-rail-icon" href="#after-app-rail-icon">After</a>
    </div>
  `);
  const el = root.querySelector<LyraAppRailItem>('lr-app-rail-item')!;
  const nested = root.querySelector<HTMLButtonElement>('#nested-app-rail-icon')!;
  const before = root.querySelector<HTMLButtonElement>('#before-app-rail-icon')!;
  const slot = el.shadowRoot!.querySelector<HTMLSlotElement>('slot[name="icon"]')!;

  expect(slot.assignedElements({ flatten: true }).length).to.equal(1);
  expect(slot.closest<HTMLElement>('[inert]')?.getAttribute('aria-hidden')).to.equal('true');
  expect(nested.getBoundingClientRect().width).to.be.greaterThan(0);

  before.focus();
  nested.focus();
  expect(document.activeElement?.id).to.equal(before.id);
  await expect(el).to.be.accessible();
});

it('marks the base part aria-current="page" when current', async () => {
  const el = (await fixture(
    html`<lr-app-rail-item href="/home" current>Home</lr-app-rail-item>`
  )) as LyraAppRailItem;
  const base = el.shadowRoot!.querySelector('[part="base"]')!;
  expect(base.getAttribute("aria-current")).to.equal("page");
});

it('renders aria-current="false" (not omitted) when not current', async () => {
  const el = (await fixture(
    html`<lr-app-rail-item href="/home">Home</lr-app-rail-item>`
  )) as LyraAppRailItem;
  const base = el.shadowRoot!.querySelector('[part="base"]')!;
  expect(base.getAttribute("aria-current")).to.equal("false");
});

it("reflects current as a host attribute", async () => {
  const el = (await fixture(
    html`<lr-app-rail-item href="/home" current>Home</lr-app-rail-item>`
  )) as LyraAppRailItem;
  expect(el.hasAttribute("current")).to.be.true;
  el.current = false;
  await el.updateComplete;
  expect(el.hasAttribute("current")).to.be.false;
});

describe("current", () => {
  it('reflects aria-current="page" onto [part=base] when true', async () => {
    const el = (await fixture(
      html`<lr-app-rail-item href="/inbox" current>Inbox</lr-app-rail-item>`
    )) as LyraAppRailItem;
    const base = el.shadowRoot!.querySelector('[part="base"]')!;
    expect(base.getAttribute("aria-current")).to.equal("page");
  });

  it('defaults to false and renders aria-current="false" (not omitted)', async () => {
    const el = (await fixture(
      html`<lr-app-rail-item href="/inbox">Inbox</lr-app-rail-item>`
    )) as LyraAppRailItem;
    expect(el.current).to.be.false;
    const base = el.shadowRoot!.querySelector('[part="base"]')!;
    expect(base.getAttribute("aria-current")).to.equal("false");
  });

  it("reflects on the button-rendering path too (no href)", async () => {
    const el = (await fixture(
      html`<lr-app-rail-item current>Settings</lr-app-rail-item>`
    )) as LyraAppRailItem;
    const base = el.shadowRoot!.querySelector('[part="base"]')!;
    expect(base.tagName).to.equal("BUTTON");
    expect(base.getAttribute("aria-current")).to.equal("page");
  });

  it('renders aria-current="false" (not omitted) on the button-rendering path too', async () => {
    const el = (await fixture(
      html`<lr-app-rail-item>Settings</lr-app-rail-item>`
    )) as LyraAppRailItem;
    const base = el.shadowRoot!.querySelector('[part="base"]')!;
    expect(base.tagName).to.equal("BUTTON");
    expect(base.getAttribute("aria-current")).to.equal("false");
  });
});

describe("tooltip", () => {
  it("shows a flyout with the label text on hover/focus when tooltip is set and icon-only is active", async () => {
    const el = (await fixture(
      html`<lr-app-rail-item tooltip icon-only>Dashboard</lr-app-rail-item>`
    )) as LyraAppRailItem;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    let flyout = el.shadowRoot!.querySelector('[part="tooltip"]');
    expect((flyout) == null).to.equal(true);
    base.dispatchEvent(new FocusEvent("focus", { bubbles: true }));
    await el.updateComplete;
    flyout = el.shadowRoot!.querySelector('[part="tooltip"]');
    expect((flyout) != null).to.equal(true);
    expect(flyout!.textContent!.trim()).to.equal("Dashboard");
    base.dispatchEvent(new FocusEvent("blur", { bubbles: true }));
    await el.updateComplete;
    expect((el.shadowRoot!.querySelector('[part="tooltip"]')) == null).to.be.true;
  });

  it("does not show a flyout when tooltip is unset (the default)", async () => {
    const el = (await fixture(
      html`<lr-app-rail-item icon-only>Dashboard</lr-app-rail-item>`
    )) as LyraAppRailItem;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    base.dispatchEvent(new FocusEvent("focus", { bubbles: true }));
    await el.updateComplete;
    expect((el.shadowRoot!.querySelector('[part="tooltip"]')) == null).to.be.true;
  });

  it("does not show a flyout when tooltip is set but icon-only is not active (label is already visible)", async () => {
    const el = (await fixture(
      html`<lr-app-rail-item tooltip>Dashboard</lr-app-rail-item>`
    )) as LyraAppRailItem;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    base.dispatchEvent(new FocusEvent("focus", { bubbles: true }));
    await el.updateComplete;
    expect((el.shadowRoot!.querySelector('[part="tooltip"]')) == null).to.be.true;
  });

  it("dismisses a visible flyout when tooltip is revoked", async () => {
    const el = (await fixture(
      html`<lr-app-rail-item tooltip icon-only>Dashboard</lr-app-rail-item>`
    )) as LyraAppRailItem;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    base.dispatchEvent(new FocusEvent("focus", { bubbles: true }));
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll('[part="tooltip"]').length).to.equal(
      1
    );

    el.tooltip = false;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll('[part="tooltip"]').length).to.equal(
      0
    );
  });

  it("dismisses a visible flyout when icon-only is revoked", async () => {
    const el = (await fixture(
      html`<lr-app-rail-item tooltip icon-only>Dashboard</lr-app-rail-item>`
    )) as LyraAppRailItem;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    base.dispatchEvent(new FocusEvent("focus", { bubbles: true }));
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll('[part="tooltip"]').length).to.equal(
      1
    );

    el.removeAttribute("icon-only");
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll('[part="tooltip"]').length).to.equal(
      0
    );
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
    expect(base.contains(flyout)).to.be.false;
    expect(flyout!.getAttribute("aria-hidden")).to.equal("true");
  });

  it("refreshes an open flyout when a slotted label subtree mutates", async () => {
    const el = (await fixture(html`
      <lr-app-rail-item tooltip icon-only><span>Inbox</span></lr-app-rail-item>
    `)) as LyraAppRailItem;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    base.dispatchEvent(new FocusEvent("focus", { bubbles: true }));
    await el.updateComplete;
    const label = el.querySelector("span")!;
    label.textContent = "Archive";
    await new Promise((resolve) => queueMicrotask(resolve));
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="tooltip"]')!.textContent!.trim()).to.equal("Archive");
  });

  it("reads a destination-realm element label after adoption", async () => {
    const el = (await fixture(
      html`<lr-app-rail-item tooltip icon-only></lr-app-rail-item>`
    )) as LyraAppRailItem;
    el.remove();
    const frame = (await fixture(html`<iframe></iframe>`)) as HTMLIFrameElement;
    const frameDocument = frame.contentDocument;
    const frameWindow = frame.contentWindow;
    if (!frameDocument || !frameWindow)
      throw new Error("The iframe realm was unavailable.");

    try {
      frameDocument.adoptNode(el);
      frameDocument.body.append(el);
      const label = frameDocument.createElement("span");
      label.textContent = "Destination dashboard";
      el.append(label);
      await el.updateComplete;

      const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
      base.dispatchEvent(new frameWindow.FocusEvent("focus", { bubbles: true }));
      await el.updateComplete;

      expect(
        el.shadowRoot!.querySelector('[part="tooltip"]')!.textContent!.trim()
      ).to.equal("Destination dashboard");
    } finally {
      el.remove();
      frame.remove();
    }
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
        <lr-app-rail-item href="/home" current>Home</lr-app-rail-item>
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

// `active` was ADDED as public API and documented ("`lr-app-rail-item`: add an `active` property
// that reflects `aria-current="page"` onto the item"), then renamed to `current` with no CHANGELOG
// entry, no alias and no deprecation record. A shipped consumer's `.active=${...}` binding did not
// error -- Lit property bindings on a custom element are untyped, so it silently became a dead
// expando. The measured consequence downstream was an app rail with no active-nav indicator and a
// permanent `aria-current="false"`, which is an accessibility regression that no test, no type
// check and no build step could see. `active` is therefore restored as a deprecated alias read
// alongside the canonical property, per the house rule that a rename adds a second name rather
// than swapping one out from under shipped consumers.
describe('active (deprecated alias for current)', () => {
  it('marks the item current when only the deprecated alias is set', async () => {
    const el = (await fixture(
      html`<lr-app-rail-item active>Reports</lr-app-rail-item>`
    )) as LyraAppRailItem;
    await el.updateComplete;
    const base = el.shadowRoot!.querySelector('[part~="base"]')!;
    expect(base.getAttribute('aria-current')).to.equal('page');
  });

  it('still marks the item current when only the canonical property is set', async () => {
    const el = (await fixture(
      html`<lr-app-rail-item current>Reports</lr-app-rail-item>`
    )) as LyraAppRailItem;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part~="base"]')!.getAttribute('aria-current')).to.equal(
      'page'
    );
  });

  it('renders aria-current="false" when neither is set', async () => {
    const el = (await fixture(html`<lr-app-rail-item>Reports</lr-app-rail-item>`)) as LyraAppRailItem;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part~="base"]')!.getAttribute('aria-current')).to.equal(
      'false'
    );
  });

  it('reacts to the deprecated alias being set as a property after mount', async () => {
    const el = (await fixture(html`<lr-app-rail-item>Reports</lr-app-rail-item>`)) as LyraAppRailItem;
    el.active = true;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part~="base"]')!.getAttribute('aria-current')).to.equal(
      'page'
    );
  });
});
