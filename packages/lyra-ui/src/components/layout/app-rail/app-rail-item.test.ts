import { fixture, expect, html, oneEvent, waitUntil, aTimeout } from "@open-wc/testing";
import "./app-rail-item.js";
import "./app-rail.js";
import type { LyraAppRailItem } from "./app-rail-item.js";
import { hoverUntilMatched, resetMouse, sendMouse, settlePointer } from '../../../../test/wtr-mouse.js';
import { sendKeys } from '@web/test-runner-commands';
import { focusAfterPointer, focusByKeyboard } from '../../../../test/wtr-focus.js';

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
  try {
    await hoverUntilMatched(target, 'the app-rail-item never reported :hover');
    await waitUntil(
      () => getComputedStyle(target).backgroundColor === 'rgb(1, 2, 3)',
      'target background color never reached its hover value',
    );
    expect(getComputedStyle(target).color).to.equal('rgb(4, 5, 6)');
    await sendMouse({ type: 'down' });
    await waitUntil(() => getComputedStyle(target).backgroundColor === 'rgb(7, 8, 9)', 'target background color never reached rgb(7, 8, 9)');
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
      style="--lr-app-rail-item-hover-bg:rgb(1,2,3);--lr-app-rail-item-active-bg:rgb(4,5,6);--lr-transition-fast:0s"
    >Settings</lr-app-rail-item>
  `)) as LyraAppRailItem;
  const target = el.shadowRoot!.querySelector<HTMLElement>('[part="base"]')!;
  const rest = getComputedStyle(target).backgroundColor;
  try {
    // One move to a rect read beforehand proves nothing: sendMouse resolves when the synthesized
    // command completes, not when the browser processed the pointer event, and a late layout settle
    // can move the target out from under the dispatched position -- so "nothing changed" would pass
    // with the pointer never on the item. Land :hover for real, then settle, so the read separates
    // an inert disabled control from a missed one. --lr-transition-fast is zeroed on the fixture:
    // the base transitions its background, so an erroneous tint would still read as the resting
    // colour one frame in.
    await hoverUntilMatched(target, 'the disabled rail item never reported :hover');
    // A hover that must change nothing cannot be polled for; settle first so the read is real.
    await settlePointer();
    expect(getComputedStyle(target).backgroundColor).to.equal(rest);
    await sendMouse({ type: 'down' });
    // A press that must change nothing cannot be polled for; settle first so the read is real.
    await settlePointer();
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

    base.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    await el.updateComplete;

    expect(
      el.shadowRoot!.querySelector<HTMLElement>('[part="tooltip"]')!.textContent!.trim()
    ).to.equal("");
  });
});

it('renders a stable initial tooltip label when MutationObserver is unavailable', async () => {
  const descriptor = Object.getOwnPropertyDescriptor(window, 'MutationObserver');
  Object.defineProperty(window, 'MutationObserver', {
    configurable: true,
    value: undefined,
  });
  try {
    const el = await fixture<LyraAppRailItem>(html`
      <lr-app-rail-item tooltip icon-only>Static dashboard</lr-app-rail-item>
    `);
    const base = el.shadowRoot!.querySelector<HTMLElement>('[part="base"]')!;
    base.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    await el.updateComplete;

    expect(el.shadowRoot!.querySelector('[part="tooltip"]')?.textContent?.trim()).to.equal(
      'Static dashboard',
    );
  } finally {
    if (descriptor) Object.defineProperty(window, 'MutationObserver', descriptor);
    else Reflect.deleteProperty(window, 'MutationObserver');
  }
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
    base.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    await el.updateComplete;
    flyout = el.shadowRoot!.querySelector('[part="tooltip"]');
    expect((flyout) != null).to.equal(true);
    expect(flyout!.textContent!.trim()).to.equal("Dashboard");
    base.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));
    await el.updateComplete;
    expect((el.shadowRoot!.querySelector('[part="tooltip"]')) == null).to.be.true;
  });

  it('shows the flyout on keyboard focus only, still recording the focus-return target', async () => {
    const wrapper = await fixture(html`
      <div>
        <button id="app-rail-flyout-outside">Outside</button>
        <lr-app-rail-item tooltip icon-only>Dashboard</lr-app-rail-item>
      </div>
    `);
    const el = wrapper.querySelector('lr-app-rail-item') as LyraAppRailItem;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    const outside = wrapper.querySelector<HTMLButtonElement>('#app-rail-flyout-outside')!;
    const flyout = () => el.shadowRoot!.querySelector('[part="tooltip"]');

    await focusByKeyboard(base);
    await el.updateComplete;
    expect(flyout() != null, 'keyboard focus shows the flyout').to.equal(true);
    await expect(el).to.be.accessible();
    base.blur();
    await el.updateComplete;
    expect(flyout() == null).to.equal(true);

    await focusAfterPointer(base);
    await el.updateComplete;
    expect(flyout() == null, 'pointer-then-script focus shows no flyout').to.equal(true);
    base.blur();

    outside.focus();
    window.dispatchEvent(new PointerEvent('pointerdown'));
    base.focus();
    await el.updateComplete;
    expect(flyout() == null, 'pointer focus shows no flyout').to.equal(true);
    const recorded = (el as unknown as { focusReturnTarget?: HTMLElement }).focusReturnTarget;
    expect(recorded?.id, 'the focus-return target is still recorded').to.equal('app-rail-flyout-outside');
    base.blur();
  });

  it("does not show a flyout when tooltip is unset (the default)", async () => {
    const el = (await fixture(
      html`<lr-app-rail-item icon-only>Dashboard</lr-app-rail-item>`
    )) as LyraAppRailItem;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    base.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    await el.updateComplete;
    expect((el.shadowRoot!.querySelector('[part="tooltip"]')) == null).to.be.true;
  });

  it("does not show a flyout when tooltip is set but icon-only is not active (label is already visible)", async () => {
    const el = (await fixture(
      html`<lr-app-rail-item tooltip>Dashboard</lr-app-rail-item>`
    )) as LyraAppRailItem;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    base.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    await el.updateComplete;
    expect((el.shadowRoot!.querySelector('[part="tooltip"]')) == null).to.be.true;
  });

  it("dismisses a visible flyout when tooltip is revoked", async () => {
    const el = (await fixture(
      html`<lr-app-rail-item tooltip icon-only>Dashboard</lr-app-rail-item>`
    )) as LyraAppRailItem;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    base.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
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
    base.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
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
    base.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
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
    base.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    await el.updateComplete;
    const label = el.querySelector("span")!;
    label.textContent = "Archive";
    await new Promise<void>((resolve) => queueMicrotask(resolve));
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
      base.dispatchEvent(new frameWindow.MouseEvent('mouseenter', { bubbles: true }));
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
    base.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
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
    base.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
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
    // :host is a flex row (so [part="meta"]/[part="end"] can sit beside the item's own control),
    // which makes anything appended to this shadow root a flex item -- including this probe. Left
    // shrinkable it reports the squeezed width rather than the token it was asked to resolve.
    probe.style.flexShrink = "0";
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
    "--lr-app-rail-item-current-bg: rgb(0, 51, 102); --lr-app-rail-item-current-color: rgb(255, 255, 255); --lr-app-rail-item-current-font-weight: 900;";

  it("recolors the aria-current item from an ancestor, not a :host-declared prop", async () => {
    const el = await themed(overrides);
    const base = el.shadowRoot!.querySelector('[part="base"]')!;
    expect(base.getAttribute("aria-current")).to.equal("page");
    const rendered = getComputedStyle(base);
    expect(rendered.backgroundColor).to.equal("rgb(0, 51, 102)");
    expect(rendered.color).to.equal("rgb(255, 255, 255)");
    // The current item's font-weight has its own dedicated cssprop, decoupled from the shared
    // --lr-font-weight-semibold token every other semibold-weighted element in the page also
    // reads -- retheming it must not repaint any of those. Mirrors lr-stepper's
    // --lr-stepper-current-font-weight/lr-segmented's --lr-segmented-selected-font-weight.
    expect(rendered.fontWeight).to.equal("900");
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
    expect(rendered.fontWeight).to.equal(
      resolvedInShadow(
        el,
        "font-weight: var(--lr-font-weight-semibold)",
        "font-weight"
      )
    );
  });

  it("is accessible with the current-state props themed", async () => {
    const el = await themed(overrides);
    await expect(el).to.be.accessible();
  });
});

// `active` was ADDED as public API and documented ("`lr-app-rail-item`: add an `active` property
// that reflects `aria-current="page"` onto the item"), then renamed to `current` with no CHANGELOG
// entry, no alias and no deprecation record. It was restored in 11.2.0 as a deprecated alias read
// alongside `current`, with `removalNotBefore: '13.0.0'`. That version is long past, so 16.0.0
// removes it outright -- `active` is now a plain, unobserved expando: Lit no longer manages it as
// a reactive property, and setting it (as an attribute or after mount) has no effect on the
// rendered current state.
describe('active (removed 16.0.0; no longer an alias for current)', () => {
  it('is not registered as a Lit reactive property', async () => {
    const el = (await fixture(html`<lr-app-rail-item>Reports</lr-app-rail-item>`)) as LyraAppRailItem;
    const ctor = el.constructor as unknown as { elementProperties: Map<string, unknown> };
    expect(ctor.elementProperties.has('active')).to.be.false;
  });

  it('does not mark the item current when set as the active attribute', async () => {
    const el = (await fixture(
      html`<lr-app-rail-item active>Reports</lr-app-rail-item>`
    )) as LyraAppRailItem;
    await el.updateComplete;
    const base = el.shadowRoot!.querySelector('[part~="base"]')!;
    expect(base.getAttribute('aria-current')).to.equal('false');
  });

  it('does not mark the item current when set as a property after mount', async () => {
    const el = (await fixture(html`<lr-app-rail-item>Reports</lr-app-rail-item>`)) as LyraAppRailItem;
    (el as unknown as { active: boolean }).active = true;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part~="base"]')!.getAttribute('aria-current')).to.equal(
      'false'
    );
  });
});

describe('current-indicator part', () => {
  function resolvedInShadow(
    el: LyraAppRailItem,
    declaration: string,
    property: string
  ): string {
    const probe = document.createElement('span');
    probe.setAttribute('style', declaration);
    // :host is a flex row (so [part="meta"]/[part="end"] can sit beside the item's own control),
    // which makes anything appended to this shadow root a flex item -- including this probe. Left
    // shrinkable it reports the squeezed width rather than the token it was asked to resolve.
    probe.style.flexShrink = '0';
    el.shadowRoot!.appendChild(probe);
    const value = getComputedStyle(probe).getPropertyValue(property);
    probe.remove();
    return value;
  }

  it('is absent when the item is not current', async () => {
    const el = (await fixture(
      html`<lr-app-rail-item href="/home">Home</lr-app-rail-item>`
    )) as LyraAppRailItem;
    expect(
      el.shadowRoot!.querySelector('[part="current-indicator"]') === null,
      'current-indicator should not render when the item is not current'
    ).to.be.true;
  });

  it('renders only while aria-current="page" (the `current` property)', async () => {
    const el = (await fixture(
      html`<lr-app-rail-item href="/home" current>Home</lr-app-rail-item>`
    )) as LyraAppRailItem;
    expect(el.shadowRoot!.querySelector('[part="current-indicator"]')).to.exist;

    el.current = false;
    await el.updateComplete;
    expect(
      el.shadowRoot!.querySelector('[part="current-indicator"]') === null,
      'current-indicator should not render once current is cleared'
    ).to.be.true;
  });

  it('does not render for the removed `active` attribute', async () => {
    const el = (await fixture(
      html`<lr-app-rail-item href="/home" active>Home</lr-app-rail-item>`
    )) as LyraAppRailItem;
    expect(
      el.shadowRoot!.querySelector('[part="current-indicator"]') === null,
      'current-indicator should not render for the removed active attribute'
    ).to.be.true;
  });

  it('renders in both the link and button paths', async () => {
    const link = (await fixture(
      html`<lr-app-rail-item href="/home" current>Home</lr-app-rail-item>`
    )) as LyraAppRailItem;
    expect(link.shadowRoot!.querySelector('[part="base"]')!.tagName).to.equal('A');
    expect(link.shadowRoot!.querySelector('[part="current-indicator"]')).to.exist;

    const button = (await fixture(
      html`<lr-app-rail-item current>Home</lr-app-rail-item>`
    )) as LyraAppRailItem;
    expect(button.shadowRoot!.querySelector('[part="base"]')!.tagName).to.equal('BUTTON');
    expect(button.shadowRoot!.querySelector('[part="current-indicator"]')).to.exist;
  });

  it('renders its color/width/inset-inline tokens byte-identical to the mirrored lr-conversation-item defaults when unset', async () => {
    const el = (await fixture(
      html`<lr-app-rail-item href="/home" current>Home</lr-app-rail-item>`
    )) as LyraAppRailItem;
    const indicator = el.shadowRoot!.querySelector(
      '[part="current-indicator"]'
    ) as HTMLElement;
    const rendered = getComputedStyle(indicator);
    expect(rendered.backgroundColor).to.equal(
      resolvedInShadow(el, 'background: var(--lr-color-brand)', 'background-color')
    );
    expect(rendered.width).to.equal(
      resolvedInShadow(el, 'width: var(--lr-size-2px)', 'width')
    );
    expect(rendered.insetInlineStart).to.equal('0px');
  });

  it('recolors, resizes, and repositions the indicator from an ancestor', async () => {
    const wrapper = (await fixture(html`
      <div style="
        --lr-app-rail-item-current-indicator-color: rgb(1, 2, 3);
        --lr-app-rail-item-current-indicator-width: 6px;
        --lr-app-rail-item-current-indicator-inset-inline: auto 0;
      ">
        <lr-app-rail-item href="/home" current>Home</lr-app-rail-item>
      </div>
    `)) as HTMLElement;
    const el = wrapper.querySelector('lr-app-rail-item') as LyraAppRailItem;
    const indicator = el.shadowRoot!.querySelector(
      '[part="current-indicator"]'
    ) as HTMLElement;
    const rendered = getComputedStyle(indicator);
    expect(rendered.backgroundColor).to.equal('rgb(1, 2, 3)');
    expect(rendered.width).to.equal('6px');
    expect(rendered.insetInlineEnd).to.equal('0px');
  });

  it('is accessible while current with the indicator rendered', async () => {
    const el = (await fixture(
      html`<lr-app-rail-item href="/home" aria-label="Home" current>Home</lr-app-rail-item>`
    )) as LyraAppRailItem;
    await expect(el).to.be.accessible();
  });
});

describe('current-indicator icon-only presentation', () => {
  it('renders the indicator display byte-identical to unset (block, via absolute positioning) in full presentation', async () => {
    const el = (await fixture(
      html`<lr-app-rail-item href="/home" current>Home</lr-app-rail-item>`
    )) as LyraAppRailItem;
    const indicator = el.shadowRoot!.querySelector(
      '[part="current-indicator"]'
    ) as HTMLElement;
    expect(getComputedStyle(indicator).display).to.not.equal('none');
  });

  it('suppresses the indicator by default in icon-only presentation', async () => {
    const el = (await fixture(
      html`<lr-app-rail-item icon-only current href="/home">Home</lr-app-rail-item>`
    )) as LyraAppRailItem;
    const indicator = el.shadowRoot!.querySelector(
      '[part="current-indicator"]'
    ) as HTMLElement;
    // Still rendered (current drives its presence in the DOM, not icon-only) -- only its
    // computed display is suppressed, so a set --lr-app-rail-item-current-indicator-display can
    // restore it without a re-render.
    expect(indicator).to.exist;
    expect(getComputedStyle(indicator).display).to.equal('none');
  });

  it('restores the icon-only indicator from a set --lr-app-rail-item-current-indicator-display', async () => {
    const wrapper = (await fixture(html`
      <div style="--lr-app-rail-item-current-indicator-display: block;">
        <lr-app-rail-item icon-only current href="/home">Home</lr-app-rail-item>
      </div>
    `)) as HTMLElement;
    const el = wrapper.querySelector('lr-app-rail-item') as LyraAppRailItem;
    const indicator = el.shadowRoot!.querySelector(
      '[part="current-indicator"]'
    ) as HTMLElement;
    expect(getComputedStyle(indicator).display).to.equal('block');
  });

  it('suppresses the icon-only indicator the same way under dir="rtl"', async () => {
    const el = (await fixture(
      html`<lr-app-rail-item dir="rtl" icon-only current href="/home">Home</lr-app-rail-item>`
    )) as LyraAppRailItem;
    const indicator = el.shadowRoot!.querySelector(
      '[part="current-indicator"]'
    ) as HTMLElement;
    expect(getComputedStyle(indicator).display).to.equal('none');
  });
});

describe('current-ring token', () => {
  it('renders no ring in full presentation when unset (regression)', async () => {
    const el = (await fixture(
      html`<lr-app-rail-item href="/home" current>Home</lr-app-rail-item>`
    )) as LyraAppRailItem;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    expect(getComputedStyle(base).boxShadow).to.equal('none');
  });

  it('renders no ring on a non-current icon-only item', async () => {
    const el = (await fixture(
      html`<lr-app-rail-item icon-only href="/home">Home</lr-app-rail-item>`
    )) as LyraAppRailItem;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    expect(getComputedStyle(base).boxShadow).to.equal('none');
  });

  it('adds a non-color-only ring on a current icon-only item by default, replacing the suppressed bar', async () => {
    const el = (await fixture(
      html`<lr-app-rail-item icon-only current href="/home">Home</lr-app-rail-item>`
    )) as LyraAppRailItem;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    const boxShadow = getComputedStyle(base).boxShadow;
    expect(boxShadow).to.not.equal('none');
    expect(boxShadow).to.contain('inset');
  });

  it('applies an explicit --lr-app-rail-item-current-ring identically in full and icon-only presentations', async () => {
    const wrapper = (await fixture(html`
      <div style="--lr-app-rail-item-current-ring: inset 0 0 0 3px rgb(9, 8, 7);">
        <lr-app-rail-item href="/home" current id="full-current">Home</lr-app-rail-item>
        <lr-app-rail-item icon-only current href="/inbox" id="icon-current">Inbox</lr-app-rail-item>
      </div>
    `)) as HTMLElement;
    const full = wrapper.querySelector('#full-current') as LyraAppRailItem;
    const icon = wrapper.querySelector('#icon-current') as LyraAppRailItem;
    const fullBase = full.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    const iconBase = icon.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    const expected = getComputedStyle(fullBase).boxShadow;
    expect(expected).to.not.equal('none');
    expect(getComputedStyle(iconBase).boxShadow).to.equal(expected);
  });

  it('keeps the ring perceivable under dir="rtl"', async () => {
    const el = (await fixture(
      html`<lr-app-rail-item dir="rtl" icon-only current href="/home">Home</lr-app-rail-item>`
    )) as LyraAppRailItem;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    expect(getComputedStyle(base).boxShadow).to.not.equal('none');
  });

  it('is accessible while current, icon-only, and ringed', async () => {
    const el = (await fixture(
      html`<lr-app-rail-item href="/home" aria-label="Home" icon-only current
        ><span slot="icon" aria-hidden="true">*</span>Home</lr-app-rail-item
      >`
    )) as LyraAppRailItem;
    await expect(el).to.be.accessible();
  });
});

describe('geometry hooks (min-block-size, padding, gap, icon-size)', () => {
  function resolvedInShadow(
    el: LyraAppRailItem,
    declaration: string,
    property: string
  ): string {
    const probe = document.createElement('span');
    probe.setAttribute('style', declaration);
    // :host is a flex row (so [part="meta"]/[part="end"] can sit beside the item's own control),
    // which makes anything appended to this shadow root a flex item -- including this probe. Left
    // shrinkable it reports the squeezed width rather than the token it was asked to resolve.
    probe.style.flexShrink = '0';
    el.shadowRoot!.appendChild(probe);
    const value = getComputedStyle(probe).getPropertyValue(property);
    probe.remove();
    return value;
  }

  it('renders min-block-size/padding/gap/icon-size byte-identical to their prior hard-wired values when unset', async () => {
    const el = (await fixture(
      html`<lr-app-rail-item href="/home"
        ><span slot="icon" aria-hidden="true">*</span>Home</lr-app-rail-item
      >`
    )) as LyraAppRailItem;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    const icon = el.shadowRoot!.querySelector('[part="icon"]') as HTMLElement;
    expect(getComputedStyle(base).minBlockSize).to.equal(
      resolvedInShadow(el, 'min-block-size: var(--lr-icon-button-size)', 'min-block-size')
    );
    expect(getComputedStyle(base).padding).to.equal(
      resolvedInShadow(el, 'padding: var(--lr-space-s)', 'padding')
    );
    expect(getComputedStyle(base).gap).to.equal(
      resolvedInShadow(el, 'gap: var(--lr-space-s)', 'gap')
    );
    expect(getComputedStyle(icon).inlineSize).to.equal(
      resolvedInShadow(el, 'inline-size: var(--lr-icon-button-size)', 'inline-size')
    );
  });

  it('grows the row height, padding, gap, and icon column from ancestor overrides', async () => {
    const wrapper = (await fixture(html`
      <div style="
        --lr-app-rail-item-min-block-size: 64px;
        --lr-app-rail-item-padding: 20px;
        --lr-app-rail-item-gap: 24px;
        --lr-app-rail-item-icon-size: 40px;
      ">
        <lr-app-rail-item href="/home"
          ><span slot="icon" aria-hidden="true">*</span>Home</lr-app-rail-item
        >
      </div>
    `)) as HTMLElement;
    const el = wrapper.querySelector('lr-app-rail-item') as LyraAppRailItem;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    const icon = el.shadowRoot!.querySelector('[part="icon"]') as HTMLElement;
    expect(getComputedStyle(base).minBlockSize).to.equal('64px');
    expect(getComputedStyle(base).padding).to.equal('20px');
    expect(getComputedStyle(base).gap).to.equal('24px');
    expect(getComputedStyle(icon).inlineSize).to.equal('40px');
  });

  it('never shrinks the row below the WCAG 2.5.8 --lr-icon-button-size hit-area floor', async () => {
    const wrapper = (await fixture(html`
      <div style="--lr-app-rail-item-min-block-size: 4px;">
        <lr-app-rail-item href="/home">Home</lr-app-rail-item>
      </div>
    `)) as HTMLElement;
    const el = wrapper.querySelector('lr-app-rail-item') as LyraAppRailItem;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    const floor = parseFloat(
      resolvedInShadow(el, 'min-block-size: var(--lr-icon-button-size)', 'min-block-size')
    );
    const actual = parseFloat(getComputedStyle(base).minBlockSize);
    expect(actual).to.be.at.least(floor);
    expect(actual).to.not.equal(4);
  });

  it('renders font-size byte-identical to the inherited value when unset', async () => {
    const wrapper = (await fixture(html`
      <div style="font-size: 22px;">
        <lr-app-rail-item href="/home">Home</lr-app-rail-item>
      </div>
    `)) as HTMLElement;
    const el = wrapper.querySelector('lr-app-rail-item') as LyraAppRailItem;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    expect(getComputedStyle(base).fontSize).to.equal('22px');
  });

  it('resizes the label text from an ancestor override', async () => {
    const wrapper = (await fixture(html`
      <div style="--lr-app-rail-item-font-size: 24px;">
        <lr-app-rail-item href="/home">Home</lr-app-rail-item>
      </div>
    `)) as HTMLElement;
    const el = wrapper.querySelector('lr-app-rail-item') as LyraAppRailItem;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    expect(getComputedStyle(base).fontSize).to.equal('24px');
  });
});

describe('icon-only square hit area', () => {
  it('resolves the icon-only item to a square instead of stretching the row', async () => {
    const el = (await fixture(html`
      <lr-app-rail-item icon-only href="/inbox">
        <span slot="icon" aria-hidden="true">*</span>Inbox
      </lr-app-rail-item>
    `)) as LyraAppRailItem;
    await el.updateComplete;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    const rect = base.getBoundingClientRect();
    expect(rect.width).to.be.above(0);
    expect(Math.abs(rect.width - rect.height)).to.be.below(1);
  });

  it('does not constrain the row to a square outside icon-only mode', async () => {
    const wrapper = (await fixture(html`
      <div style="inline-size: 240px;">
        <lr-app-rail-item href="/inbox">
          <span slot="icon" aria-hidden="true">*</span>Inbox
        </lr-app-rail-item>
      </div>
    `)) as HTMLElement;
    const el = wrapper.querySelector('lr-app-rail-item') as LyraAppRailItem;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    const rect = base.getBoundingClientRect();
    expect(rect.width).to.be.above(rect.height);
  });

  it('keeps deriving the square from a taller row height when --lr-app-rail-item-icon-only-size is unset (regression)', async () => {
    const wrapper = (await fixture(html`
      <div style="--lr-app-rail-item-min-block-size: 64px;">
        <lr-app-rail-item icon-only href="/inbox">
          <span slot="icon" aria-hidden="true">*</span>Inbox
        </lr-app-rail-item>
      </div>
    `)) as HTMLElement;
    const el = wrapper.querySelector('lr-app-rail-item') as LyraAppRailItem;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    const rect = base.getBoundingClientRect();
    expect(Math.abs(rect.width - rect.height)).to.be.below(1);
    expect(Math.round(rect.height)).to.equal(64);
  });

  it('sizes the icon-only square from --lr-app-rail-item-icon-only-size independently of a taller row height', async () => {
    const wrapper = (await fixture(html`
      <div
        style="
          --lr-app-rail-item-min-block-size: 64px;
          --lr-app-rail-item-icon-only-size: 40px;
        "
      >
        <lr-app-rail-item icon-only href="/inbox">
          <span slot="icon" aria-hidden="true">*</span>Inbox
        </lr-app-rail-item>
      </div>
    `)) as HTMLElement;
    const el = wrapper.querySelector('lr-app-rail-item') as LyraAppRailItem;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    const rect = base.getBoundingClientRect();
    expect(Math.abs(rect.width - rect.height)).to.be.below(1);
    expect(Math.round(rect.width)).to.equal(40);
  });
});

// -- end / meta slots (siblings of the activation target) -------------------

describe('end and meta slots', () => {
  it('renders `end` content as a sibling of the item control, never inside it', async () => {
    const el = (await fixture(html`
      <lr-app-rail-item href="/inbox">
        Inbox
        <button slot="end" id="rail-end-action">Archive</button>
      </lr-app-rail-item>
    `)) as LyraAppRailItem;
    await el.updateComplete;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    const end = el.shadowRoot!.querySelector('[part="end"]') as HTMLElement;

    expect(end.localName).to.equal('span');
    expect(base.contains(end)).to.equal(
      false,
      'the end wrapper must not live inside the link/button'
    );
    expect(end.parentNode === base.parentNode).to.equal(
      true,
      'the end wrapper is a sibling of the activation target'
    );
    const slot = end.querySelector('slot') as HTMLSlotElement;
    expect(slot.assignedElements().map((node) => node.id).join()).to.equal('rail-end-action');
  });

  it('keeps `end` activation out of the item own activation target', async () => {
    const el = (await fixture(html`
      <lr-app-rail-item>
        Inbox
        <button slot="end" id="rail-end-action-2">Archive</button>
      </lr-app-rail-item>
    `)) as LyraAppRailItem;
    await el.updateComplete;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLButtonElement;
    let itemClicks = 0;
    base.addEventListener('click', () => {
      itemClicks += 1;
    });
    let endClicks = 0;
    const action = el.querySelector('#rail-end-action-2') as HTMLButtonElement;
    action.addEventListener('click', () => {
      endClicks += 1;
    });

    action.click();
    expect(endClicks).to.equal(1);
    expect(itemClicks).to.equal(0);

    base.click();
    expect(itemClicks).to.equal(1);
  });

  it('activates the item from the keyboard while a slotted end control is present', async () => {
    const el = (await fixture(html`
      <lr-app-rail-item>
        Inbox
        <button slot="end">Archive</button>
      </lr-app-rail-item>
    `)) as LyraAppRailItem;
    await el.updateComplete;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLButtonElement;
    let clicks = 0;
    base.addEventListener('click', () => {
      clicks += 1;
    });
    base.focus();
    expect(el.shadowRoot!.activeElement === base).to.equal(true);
    // A real key press, and no programmatic .click(): a synthetic KeyboardEvent never produces a
    // native click, so a dispatch-then-click pair asserts nothing about the keyboard.
    await sendKeys({ press: 'Enter' });
    await waitUntil(
      () => clicks === 1,
      'Enter on the focused item activates it past the slotted end control'
    );
  });

  it('renders `meta` content between the label and the end slot', async () => {
    const el = (await fixture(html`
      <lr-app-rail-item href="/inbox">
        Inbox
        <span slot="meta" id="rail-meta">12</span>
        <button slot="end" id="rail-end-3">Archive</button>
      </lr-app-rail-item>
    `)) as LyraAppRailItem;
    await el.updateComplete;
    // Queries `.row` -- the internal structural wrapper the `children` feature introduced to
    // stack `[part="children"]` beneath the row -- rather than `shadowRoot.children` directly;
    // see the no-children regression test below for proof that wrapper adds nothing observable
    // when an item has no nested items.
    const row = el.shadowRoot!.querySelector('.row')!;
    const nodes = Array.from(row.children)
      .map((node) => node.getAttribute('part'))
      .filter((part): part is string => part !== null);
    expect(nodes.join(' ')).to.equal('base meta end');
  });

  it('hides both wrappers when nothing is slotted into them', async () => {
    const el = (await fixture(html`
      <lr-app-rail-item href="/inbox">Inbox</lr-app-rail-item>
    `)) as LyraAppRailItem;
    await el.updateComplete;
    const end = el.shadowRoot!.querySelector('[part="end"]') as HTMLElement;
    const meta = el.shadowRoot!.querySelector('[part="meta"]') as HTMLElement;
    expect(end.hasAttribute('hidden')).to.equal(true);
    expect(meta.hasAttribute('hidden')).to.equal(true);
    expect(getComputedStyle(end).display).to.equal('none');
    expect(getComputedStyle(meta).display).to.equal('none');
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    expect(base.getBoundingClientRect().width).to.equal(el.getBoundingClientRect().width);
  });

  it('reveals the wrappers when content is slotted in later', async () => {
    const el = (await fixture(html`
      <lr-app-rail-item href="/inbox">Inbox</lr-app-rail-item>
    `)) as LyraAppRailItem;
    await el.updateComplete;
    const badge = document.createElement('span');
    badge.slot = 'meta';
    badge.textContent = '3';
    el.appendChild(badge);
    await waitUntil(
      () => !(el.shadowRoot!.querySelector('[part="meta"]') as HTMLElement).hasAttribute('hidden'),
      'the meta wrapper reveals itself on slotchange'
    );
    expect(
      (el.shadowRoot!.querySelector('[part="meta"]') as HTMLElement).hasAttribute('hidden')
    ).to.equal(false);
  });

  it('places the end slot at the inline-end edge under dir="rtl"', async () => {
    const el = (await fixture(html`
      <lr-app-rail-item dir="rtl" href="/inbox">
        Inbox
        <button slot="end">Archive</button>
      </lr-app-rail-item>
    `)) as LyraAppRailItem;
    await el.updateComplete;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    const end = el.shadowRoot!.querySelector('[part="end"]') as HTMLElement;
    expect(end.getBoundingClientRect().left).to.be.below(base.getBoundingClientRect().left);
  });

  it('keeps meta available to assistive technology while icon-only clips it', async () => {
    const el = (await fixture(html`
      <lr-app-rail-item icon-only href="/inbox">
        Inbox
        <span slot="meta">12</span>
      </lr-app-rail-item>
    `)) as LyraAppRailItem;
    await el.updateComplete;
    const meta = el.shadowRoot!.querySelector('[part="meta"]') as HTMLElement;
    expect(getComputedStyle(meta).display).to.not.equal('none');
    expect(meta.getBoundingClientRect().width).to.be.below(2);
  });

  it('stays accessible with both slots populated', async () => {
    const el = (await fixture(html`
      <lr-app-rail-item href="/inbox">
        <span slot="icon" aria-hidden="true">📥</span>
        Inbox
        <span slot="meta">12</span>
        <button slot="end" aria-label="Archive inbox">x</button>
      </lr-app-rail-item>
    `)) as LyraAppRailItem;
    await el.updateComplete;
    await expect(el).to.be.accessible();
  });
});

describe('nested children (treeitem-with-link)', () => {
  it('renders no disclosure and no [part="children"] when nothing is slotted into children (regression)', async () => {
    const el = (await fixture(html`
      <lr-app-rail-item href="/projects">Projects</lr-app-rail-item>
    `)) as LyraAppRailItem;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="toggle"]') === null).to.equal(true);
    expect(el.shadowRoot!.querySelector('[part="children"]') === null).to.equal(true);
    // The row still fills the item's full width, exactly as it did before `children` existed --
    // proves the new :host column layout and its (absent) second flex item add no visual seam.
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    expect(base.getBoundingClientRect().width).to.equal(el.getBoundingClientRect().width);
  });

  it('renders a disclosure and [part="children"] once something is slotted into children, wired to each other', async () => {
    const el = (await fixture(html`
      <lr-app-rail-item href="/projects">
        Projects
        <lr-app-rail-item slot="children" href="/projects/one">One</lr-app-rail-item>
      </lr-app-rail-item>
    `)) as LyraAppRailItem;
    await el.updateComplete;
    const toggle = el.shadowRoot!.querySelector('[part="toggle"]') as HTMLButtonElement;
    const children = el.shadowRoot!.querySelector('[part="children"]') as HTMLElement;
    expect(toggle).to.not.equal(null);
    expect(children).to.not.equal(null);
    expect(toggle.getAttribute('aria-expanded')).to.equal('false');
    expect(toggle.getAttribute('aria-controls')).to.equal(children.id);
    expect(children.hasAttribute('hidden')).to.equal(true);
    // A sibling of [part="base"], never nested inside it.
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    expect(base.contains(toggle)).to.equal(false);
    expect(toggle.parentNode === base.parentNode).to.equal(true);
  });

  it('toggles through the request/commit pair and announces the settled state', async () => {
    const el = (await fixture(html`
      <lr-app-rail-item>
        Projects
        <lr-app-rail-item slot="children">One</lr-app-rail-item>
      </lr-app-rail-item>
    `)) as LyraAppRailItem;
    await el.updateComplete;
    const toggle = el.shadowRoot!.querySelector('[part="toggle"]') as HTMLButtonElement;
    const order: string[] = [];
    el.addEventListener('lr-toggle-request', () => order.push('request'));
    el.addEventListener('lr-toggle', () => order.push('toggle'));
    const settled = oneEvent(el, 'lr-toggle');
    toggle.click();
    const event = await settled;
    expect((event as CustomEvent<{ open: boolean }>).detail.open).to.equal(true);
    expect(order.join()).to.equal('request,toggle');
    await el.updateComplete;
    expect(el.expanded).to.equal(true);
    expect(
      (el.shadowRoot!.querySelector('[part="children"]') as HTMLElement).hasAttribute('hidden')
    ).to.equal(false);
    expect(toggle.getAttribute('aria-expanded')).to.equal('true');
  });

  it('keeps the item collapsed when the request is vetoed, and emits no settled event', async () => {
    const el = (await fixture(html`
      <lr-app-rail-item>
        Projects
        <lr-app-rail-item slot="children">One</lr-app-rail-item>
      </lr-app-rail-item>
    `)) as LyraAppRailItem;
    await el.updateComplete;
    let settled = 0;
    el.addEventListener('lr-toggle', () => {
      settled += 1;
    });
    el.addEventListener('lr-toggle-request', (event) => {
      event.preventDefault();
    });
    (el.shadowRoot!.querySelector('[part="toggle"]') as HTMLButtonElement).click();
    await el.updateComplete;
    expect(el.expanded).to.equal(false);
    expect(settled).to.equal(0);
  });

  it('lets a listener resolve the toggle itself without the default commit clobbering it', async () => {
    const el = (await fixture(html`
      <lr-app-rail-item>
        Projects
        <lr-app-rail-item slot="children">One</lr-app-rail-item>
      </lr-app-rail-item>
    `)) as LyraAppRailItem;
    await el.updateComplete;
    // Writes back the value the property already holds: a before/after value compare cannot see
    // this, which is exactly why the pair tracks writes instead (see VetoWriteGuard).
    el.addEventListener('lr-toggle-request', () => {
      el.expanded = false;
    });
    let settled = 0;
    el.addEventListener('lr-toggle', () => {
      settled += 1;
    });
    (el.shadowRoot!.querySelector('[part="toggle"]') as HTMLButtonElement).click();
    await el.updateComplete;
    expect(el.expanded).to.equal(false);
    expect(settled).to.equal(0);
  });

  it('toggles from the keyboard when the disclosure itself holds focus', async () => {
    const el = (await fixture(html`
      <lr-app-rail-item>
        Projects
        <lr-app-rail-item slot="children">One</lr-app-rail-item>
      </lr-app-rail-item>
    `)) as LyraAppRailItem;
    await el.updateComplete;
    const toggle = el.shadowRoot!.querySelector('[part="toggle"]') as HTMLButtonElement;
    toggle.focus();
    expect(el.shadowRoot!.activeElement === toggle).to.equal(true);
    // A real key press, and no programmatic .click(): a synthetic KeyboardEvent never produces a
    // native click, so a dispatch-then-click pair would assert nothing about the keyboard.
    await sendKeys({ press: 'Enter' });
    await waitUntil(() => el.expanded === true, 'Enter on the focused disclosure expands the item');
    await sendKeys({ press: ' ' });
    await waitUntil(() => el.expanded === false, 'Space on the focused disclosure collapses it again');
  });

  it('never activates the link/button when the disclosure is clicked, and never toggles when it is activated', async () => {
    const el = (await fixture(html`
      <lr-app-rail-item>
        Projects
        <lr-app-rail-item slot="children">One</lr-app-rail-item>
      </lr-app-rail-item>
    `)) as LyraAppRailItem;
    await el.updateComplete;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLButtonElement;
    const toggle = el.shadowRoot!.querySelector('[part="toggle"]') as HTMLButtonElement;
    let baseClicks = 0;
    base.addEventListener('click', () => {
      baseClicks += 1;
    });
    toggle.click();
    await el.updateComplete;
    expect(baseClicks).to.equal(0);
    expect(el.expanded).to.equal(true);

    base.click();
    await el.updateComplete;
    expect(el.expanded).to.equal(true);
  });

  it("stops a toggle click from crossing the item's own host boundary, so it can never reach the rail's nav-slot click listener that closes the mobile overlay", async () => {
    // <lr-app-rail>'s own nav slot listens for any click reaching it (composed events cross
    // shadow boundaries) to close the mobile overlay -- toggling a disclosure is not navigation,
    // so it must never trigger that close the way activating the link does. Asserted here at the
    // item's own host boundary rather than with a full rail+mobile-overlay fixture: stopping
    // propagation this early already guarantees nothing further up the light-DOM tree ever sees
    // the event.
    const el = (await fixture(html`
      <lr-app-rail-item>
        Projects
        <lr-app-rail-item slot="children">One</lr-app-rail-item>
      </lr-app-rail-item>
    `)) as LyraAppRailItem;
    await el.updateComplete;
    let hostClicks = 0;
    el.addEventListener('click', () => {
      hostClicks += 1;
    });
    (el.shadowRoot!.querySelector('[part="toggle"]') as HTMLButtonElement).click();
    expect(hostClicks).to.equal(0);
    (el.shadowRoot!.querySelector('[part="base"]') as HTMLButtonElement).click();
    expect(hostClicks).to.equal(1);
  });

  it('forwards icon-only to its own children, including one added later', async () => {
    const el = (await fixture(html`
      <lr-app-rail-item>
        Projects
        <lr-app-rail-item slot="children" id="one">One</lr-app-rail-item>
      </lr-app-rail-item>
    `)) as LyraAppRailItem;
    await el.updateComplete;
    el.setAttribute('icon-only', '');
    await el.updateComplete;
    await waitUntil(
      () => (el.querySelector('#one') as HTMLElement).hasAttribute('icon-only'),
      'the slotted child mirrors the parent item icon-only state'
    );

    const late = document.createElement('lr-app-rail-item');
    late.setAttribute('slot', 'children');
    el.appendChild(late);
    await waitUntil(() => late.hasAttribute('icon-only'), 'a later child mirrors it too');

    el.removeAttribute('icon-only');
    await waitUntil(
      () =>
        !(el.querySelector('#one') as HTMLElement).hasAttribute('icon-only') &&
        !late.hasAttribute('icon-only'),
      'clearing the parent state clears every child'
    );
  });

  it('stops forwarding icon-only once it disconnects', async () => {
    const el = (await fixture(html`
      <lr-app-rail-item icon-only>
        Projects
        <lr-app-rail-item slot="children" id="one">One</lr-app-rail-item>
      </lr-app-rail-item>
    `)) as LyraAppRailItem;
    await el.updateComplete;
    await waitUntil(() => (el.querySelector('#one') as HTMLElement).hasAttribute('icon-only'));
    el.remove();
    const late = document.createElement('lr-app-rail-item');
    late.setAttribute('slot', 'children');
    el.appendChild(late);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(late.hasAttribute('icon-only')).to.equal(false);
  });

  it('points the toggle glyph the opposite way under dir="rtl"', async () => {
    const glyph = (el: LyraAppRailItem): string =>
      getComputedStyle(el.shadowRoot!.querySelector('[part="toggle-icon"]') as HTMLElement)
        .transform;
    const ltr = (await fixture(html`
      <lr-app-rail-item>A<lr-app-rail-item slot="children">B</lr-app-rail-item></lr-app-rail-item>
    `)) as LyraAppRailItem;
    const rtl = (await fixture(html`
      <lr-app-rail-item dir="rtl">A<lr-app-rail-item slot="children">B</lr-app-rail-item></lr-app-rail-item>
    `)) as LyraAppRailItem;
    await ltr.updateComplete;
    await rtl.updateComplete;
    expect(glyph(rtl)).to.not.equal(glyph(ltr));
  });

  it('indents [part="children"] via --lr-app-rail-item-indent, mirrored under dir="rtl"', async () => {
    const el = (await fixture(html`
      <div style="--lr-app-rail-item-indent: 40px;">
        <lr-app-rail-item>
          Projects
          <lr-app-rail-item slot="children">One</lr-app-rail-item>
        </lr-app-rail-item>
      </div>
    `)) as HTMLElement;
    const item = el.querySelector('lr-app-rail-item') as LyraAppRailItem;
    item.expanded = true;
    await item.updateComplete;
    const children = item.shadowRoot!.querySelector('[part="children"]') as HTMLElement;
    expect(getComputedStyle(children).paddingInlineStart).to.equal('40px');

    const rtl = (await fixture(html`
      <div dir="rtl" style="--lr-app-rail-item-indent: 40px;">
        <lr-app-rail-item>
          Projects
          <lr-app-rail-item slot="children">One</lr-app-rail-item>
        </lr-app-rail-item>
      </div>
    `)) as HTMLElement;
    const rtlItem = rtl.querySelector('lr-app-rail-item') as LyraAppRailItem;
    rtlItem.expanded = true;
    await rtlItem.updateComplete;
    const rtlChildren = rtlItem.shadowRoot!.querySelector('[part="children"]') as HTMLElement;
    const nested = rtlItem.querySelector('lr-app-rail-item') as HTMLElement;
    const hostRect = rtlItem.getBoundingClientRect();
    const nestedRect = nested.getBoundingClientRect();
    // padding-inline-start under dir="rtl" resolves to the physical right edge -- the nested
    // item's right edge must sit inset from the host's own right edge, not its left.
    expect(hostRect.right - nestedRect.right).to.be.greaterThan(20);
    expect(getComputedStyle(rtlChildren).paddingRight).to.equal('40px');
  });

  it('is accessible expanded and collapsed', async () => {
    const el = (await fixture(html`
      <lr-app-rail-item href="/projects">
        Projects
        <lr-app-rail-item slot="children" href="/projects/one">One</lr-app-rail-item>
        <lr-app-rail-item slot="children" href="/projects/two">Two</lr-app-rail-item>
      </lr-app-rail-item>
    `)) as LyraAppRailItem;
    await el.updateComplete;
    await expect(el).to.be.accessible();

    el.expanded = true;
    await el.updateComplete;
    await expect(el).to.be.accessible();
  });

  it('renders the English fallback disclosure name interpolating this item\'s own label, with no locale registered', async () => {
    const el = (await fixture(html`
      <lr-app-rail-item>
        Projects
        <lr-app-rail-item slot="children">One</lr-app-rail-item>
      </lr-app-rail-item>
    `)) as LyraAppRailItem;
    await el.updateComplete;
    const toggle = el.shadowRoot!.querySelector('[part="toggle"]') as HTMLButtonElement;
    expect(toggle.getAttribute('aria-label')).to.equal('Expand Projects');
    el.expanded = true;
    await el.updateComplete;
    expect(
      (el.shadowRoot!.querySelector('[part="toggle"]') as HTMLElement).getAttribute('aria-label')
    ).to.equal('Collapse Projects');
  });

  it('honors a strings override for the disclosure name', async () => {
    const el = (await fixture(html`
      <lr-app-rail-item .strings=${{ appRailItemCollapse: 'Replier {label}', appRailItemExpand: 'Déplier {label}' }}>
        Projects
        <lr-app-rail-item slot="children">One</lr-app-rail-item>
      </lr-app-rail-item>
    `)) as LyraAppRailItem;
    await el.updateComplete;
    const toggle = el.shadowRoot!.querySelector('[part="toggle"]') as HTMLButtonElement;
    expect(toggle.getAttribute('aria-label')).to.equal('Déplier Projects');
    el.expanded = true;
    await el.updateComplete;
    expect(
      (el.shadowRoot!.querySelector('[part="toggle"]') as HTMLElement).getAttribute('aria-label')
    ).to.equal('Replier Projects');
  });
});

describe('collecting already-slotted meta/end content without relying on the initial slotchange', () => {
  function slotted(): { el: LyraAppRailItem; meta: HTMLSpanElement; end: HTMLSpanElement } {
    const meta = document.createElement('span');
    meta.slot = 'meta';
    meta.textContent = 'meta text';
    const end = document.createElement('span');
    end.slot = 'end';
    end.textContent = 'end text';
    const el = document.createElement('lr-app-rail-item') as LyraAppRailItem;
    el.append(meta, end);
    return { el, meta, end };
  }

  it('populates hasMetaSlot/hasEndSlot when the initial slotchange is suppressed (simulating happy-dom)', async () => {
    // happy-dom (through at least 20.14.5) never fires `slotchange` for a slot's INITIAL
    // assignment. This suite runs in a real browser, which DOES fire it -- so to reproduce the
    // happy-dom condition deterministically here, swallow every such event with a capture-phase
    // listener on the render root: capture-phase fires on the way down to each `<slot>` itself,
    // before that slot's own bubble-phase `@slotchange` binding ever sees it.
    const { el } = slotted();
    document.body.append(el);
    let intercepted = 0;
    el.renderRoot!.addEventListener(
      'slotchange',
      (e) => {
        intercepted++;
        e.stopImmediatePropagation();
      },
      { capture: true }
    );
    try {
      await el.updateComplete;
      await aTimeout(50);
      expect(
        intercepted,
        "a real browser does fire each named slot's own initial slotchange -- this test suppresses them to reproduce happy-dom, which never fires either at all"
      ).to.equal(2);
      expect(
        el.shadowRoot!.querySelector('[part="meta"]')!.hasAttribute('hidden'),
        "firstUpdated() collected the already-slotted meta content, with no slotchange ever reaching the component's own listener"
      ).to.equal(false);
      expect(
        el.shadowRoot!.querySelector('[part="end"]')!.hasAttribute('hidden'),
        "firstUpdated() collected the already-slotted end content, with no slotchange ever reaching the component's own listener"
      ).to.equal(false);
    } finally {
      el.remove();
    }
  });

  it('is idempotent: a real slotchange landing on top of the firstUpdated() collection does not change the result', async () => {
    // No interception here -- both firstUpdated()'s own call and the real, un-suppressed initial
    // slotchange events fire for the same batch. The diagnostic listener below proves the real
    // firing actually happened, so this test exercises the double-invocation path it claims to.
    const { el } = slotted();
    document.body.append(el);
    let realSlotchangeCount = 0;
    el.renderRoot!.addEventListener(
      'slotchange',
      () => realSlotchangeCount++,
      { capture: true }
    );
    try {
      await el.updateComplete;
      await aTimeout(50);
      expect(
        realSlotchangeCount,
        'the real initial slotchange events must actually have fired for this to prove anything about double-invocation'
      ).to.be.greaterThan(0);
      expect(el.shadowRoot!.querySelector('[part="meta"]')!.hasAttribute('hidden')).to.equal(false);
      expect(el.shadowRoot!.querySelector('[part="end"]')!.hasAttribute('hidden')).to.equal(false);
    } finally {
      el.remove();
    }
  });
});

it('hides nested disclosure in icon-only while preserving its expansion and accessible item', async () => {
  const rail = await fixture<import('./app-rail.class.js').LyraAppRail>(html`<lr-app-rail force-mode="icon-only" label="Workspace"><lr-app-rail-item expanded><span slot="icon">A</span>Account<lr-app-rail-item slot="children">Profile</lr-app-rail-item></lr-app-rail-item></lr-app-rail>`);
  const el = rail.querySelector<LyraAppRailItem>('lr-app-rail-item')!;
  await el.updateComplete;
  expect(getComputedStyle(el.shadowRoot!.querySelector('[part="toggle"]')!).display).to.equal('none');
  expect(getComputedStyle(el.shadowRoot!.querySelector('[part="children"]')!).display).to.equal('none');
  expect(el.expanded).to.equal(true);
  await expect(el).to.be.accessible();
  rail.forceMode = 'full'; await rail.updateComplete; await el.updateComplete;
  expect(getComputedStyle(el.shadowRoot!.querySelector('[part="toggle"]')!).display).not.to.equal('none');
  expect(getComputedStyle(el.shadowRoot!.querySelector('[part="children"]')!).display).not.to.equal('none');
  expect(el.expanded).to.equal(true);
});
