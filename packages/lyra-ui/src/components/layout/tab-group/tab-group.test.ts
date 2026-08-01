import { fixture, expect, oneEvent, html, aTimeout } from "@open-wc/testing";
import "./tab-group.js";
import type { LyraTabGroup } from "./tab-group.js";
import { styles } from "./tab-group.styles.js";

const basic = () => html`
  <lr-tab-group>
    <div slot="input" label="Input">Raw input</div>
    <div slot="preview" label="Preview">Rendered preview</div>
    <div slot="settings" label="Settings">Settings form</div>
  </lr-tab-group>
`;

/** Two animation frames, long enough for the overflow controller's `ResizeObserver` callback to
 *  have landed on top of the synchronous measurement it already does in `hostUpdated()`. */
async function nextFrames(): Promise<void> {
  await new Promise((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(resolve))
  );
}

function tabButtons(el: LyraTabGroup): HTMLButtonElement[] {
  return [
    ...el.shadowRoot!.querySelectorAll('[part="tab"]'),
  ] as HTMLButtonElement[];
}

function panels(el: LyraTabGroup): HTMLElement[] {
  return [
    ...el.shadowRoot!.querySelectorAll('[part="panel"]'),
  ] as HTMLElement[];
}

function press(target: HTMLElement, key: string): void {
  target.dispatchEvent(
    new KeyboardEvent("keydown", {
      key,
      bubbles: true,
      cancelable: true,
      composed: true,
    })
  );
}

it("never scrolls vertically -- overflow-x:auto alone lets the y axis compute to auto too, which can show a phantom scrollbar", async () => {
  const el = (await fixture(basic())) as LyraTabGroup;
  const tablist = el.shadowRoot!.querySelector(
    '[part="tablist"]'
  ) as HTMLElement;
  expect(getComputedStyle(tablist).overflowY).to.equal("hidden");
});

it("declares a themeable edge fade, gated on the tablist overflowing", () => {
  const css = styles.cssText.replace(/\s+/g, " ").replaceAll('"', "'");
  expect(css).to.include("-webkit-mask-image: linear-gradient");
  expect(css).to.include("mask-image: linear-gradient");
  expect(css).to.include("var(--lr-scroll-fade-size)");
  // The gradient must live behind the overflow gate, never on the bare [part='tablist'] rule.
  expect(css).to.include("[part='tablist'][data-scroll-overflow] {");
});

it("applies the edge fade once the tablist actually overflows", async () => {
  const el = (await fixture(html`
    <lr-tab-group style="display: block; max-inline-size: 90px">
      <div slot="input" label="Raw input document">Raw input</div>
      <div slot="preview" label="Rendered preview pane">Rendered preview</div>
      <div slot="settings" label="Settings and preferences">Settings form</div>
    </lr-tab-group>
  `)) as LyraTabGroup;
  const tablist = el.shadowRoot!.querySelector('[part="tablist"]') as HTMLElement;
  await nextFrames();
  expect(tablist.scrollWidth).to.be.greaterThan(tablist.clientWidth);
  expect(getComputedStyle(tablist).maskImage).to.contain("linear-gradient");
});

it("leaves a tablist that fits completely unmasked", async () => {
  // The regression this guards: the fade used to be painted unconditionally, dimming the first
  // and last tab of a row with nothing to scroll to.
  const el = (await fixture(basic())) as LyraTabGroup;
  const tablist = el.shadowRoot!.querySelector('[part="tablist"]') as HTMLElement;
  await nextFrames();
  expect(tablist.scrollWidth - tablist.clientWidth).to.be.at.most(1);
  expect(getComputedStyle(tablist).maskImage).to.equal("none");
});

it("keeps the edge fade opaque when a consumer themes the shadow color translucent", async () => {
  // The regression this guards: the mask's opaque stops used to be var(--lr-color-shadow), a
  // documented consumer theming input. A mask reads alpha only, so a translucent shadow theme
  // dropped mask alpha across the whole tablist rather than just its edges.
  const el = (await fixture(html`
    <lr-tab-group
      style="display: block; max-inline-size: 90px; --lr-theme-color-shadow: rgb(0 0 0 / 0.25)"
    >
      <div slot="input" label="Raw input document">Raw input</div>
      <div slot="preview" label="Rendered preview pane">Rendered preview</div>
      <div slot="settings" label="Settings and preferences">Settings form</div>
    </lr-tab-group>
  `)) as LyraTabGroup;
  const tablist = el.shadowRoot!.querySelector('[part="tablist"]') as HTMLElement;
  await nextFrames();
  const mask = getComputedStyle(tablist).maskImage;
  expect(mask).to.contain("linear-gradient");
  expect(mask).to.not.contain("0.25");
});

it('the internal [part="tab"]:hover rule is :where()-wrapped, so a consumer ::part(tab):hover override wins without needing !important', async () => {
  const el = (await fixture(basic())) as LyraTabGroup;
  // Same technique as attachment-trigger.test.ts's identically-shaped specificity test: real
  // browser test runners don't synthesize a :hover pseudo-class from a dispatched event, so
  // assert via the rendered stylesheet's own selector text instead of a paint result.
  const internalRule = (el.shadowRoot!.adoptedStyleSheets ?? [])
    .flatMap((sheet) => Array.from(sheet.cssRules))
    .map((rule) => rule.cssText)
    .find((text) => text.includes(":hover") && text.includes("aria-disabled"));
  expect(internalRule, 'expected a [part="tab"]:hover rule').to.not.equal(
    undefined
  );
  expect(internalRule).to.contain(":where(");
});

it("gives keyboard-focusable tab panels a hover affordance", () => {
  const css = styles.cssText.replace(/\s+/g, " ").replaceAll('"', "'");
  expect(css).to.match(/\[part='panel'\]:hover/);
});

it("is accessible with no panel children (empty state)", async () => {
  const el = (await fixture(html`<lr-tab-group></lr-tab-group>`)) as LyraTabGroup;
  expect(tabButtons(el).length).to.equal(0);
  await expect(el).to.be.accessible();
});

it("is accessible with populated tabs", async () => {
  const el = (await fixture(basic())) as LyraTabGroup;
  await expect(el).to.be.accessible();
});

it("builds one tab per direct child that has both slot and label, defaulting active to the first", async () => {
  const el = (await fixture(basic())) as LyraTabGroup;
  const buttons = tabButtons(el);
  expect(buttons.map((b) => b.textContent?.trim())).to.deep.equal([
    "Input",
    "Preview",
    "Settings",
  ]);
  expect(el.active).to.equal("input");
  expect(buttons[0].getAttribute("aria-selected")).to.equal("true");
  expect(buttons[1].getAttribute("aria-selected")).to.equal("false");
});

it("a child with no label attribute never produces a tab or a rendered panel", async () => {
  const el = (await fixture(html`
    <lr-tab-group>
      <div slot="input" label="Input">Raw input</div>
      <div slot="preview">No label -- should be invisible</div>
    </lr-tab-group>
  `)) as LyraTabGroup;
  const buttons = tabButtons(el);
  expect(buttons.length).to.equal(1);
  expect(panels(el).length).to.equal(1);
  const unlabeled = el.querySelector('[slot="preview"]') as HTMLElement;
  // Never assigned to any rendered <slot>, since this component only ever
  // renders a named slot for tabs that made it into the `tabs` state.
  expect(unlabeled.assignedSlot).to.be.null;
});

it("only the active panel is visible; the others are hidden", async () => {
  const el = (await fixture(basic())) as LyraTabGroup;
  const [input, preview, settings] = panels(el);
  expect(input.hidden).to.be.false;
  expect(preview.hidden).to.be.true;
  expect(settings.hidden).to.be.true;
});

it('roving tabindex: only the active tab button is tabindex="0"', async () => {
  const el = (await fixture(basic())) as LyraTabGroup;
  const buttons = tabButtons(el);
  expect(buttons.map((b) => b.getAttribute("tabindex"))).to.deep.equal([
    "0",
    "-1",
    "-1",
  ]);
});

it("each tab button aria-controls its own panel, and each panel is aria-labelledby its tab", async () => {
  const el = (await fixture(basic())) as LyraTabGroup;
  const [inputTab, previewTab] = tabButtons(el);
  const [inputPanel, previewPanel] = panels(el);
  expect(inputTab.getAttribute("aria-controls")).to.equal(inputPanel.id);
  expect(previewTab.getAttribute("aria-controls")).to.equal(previewPanel.id);
  expect(inputPanel.getAttribute("aria-labelledby")).to.equal(inputTab.id);
});

it("uses opaque ARIA ids when a public slot name contains whitespace or selector syntax", async () => {
  const slotName = 'tab with spaces"[data-hostile]';
  const el = (await fixture(html`
    <lr-tab-group>
      <div slot=${slotName} label="Hostile">Content</div>
    </lr-tab-group>
  `)) as LyraTabGroup;
  const tab = tabButtons(el)[0];
  const panel = panels(el)[0];
  expect(tab.id).to.match(/^lr-tab-group-\d+-\d+-tab$/);
  expect(panel.id).to.match(/^lr-tab-group-\d+-\d+-panel$/);
  expect(tab.id).to.not.include(slotName);
  expect(tab.getAttribute("aria-controls")).to.equal(panel.id);
  expect(panel.getAttribute("aria-labelledby")).to.equal(tab.id);
});

it("clicking a tab activates it and fires lr-tab-show with the tab id", async () => {
  const el = (await fixture(basic())) as LyraTabGroup;
  const listener = oneEvent(el, "lr-tab-show");
  tabButtons(el)[1].click();
  const event = await listener;
  expect((event as CustomEvent<{ tabId: string }>).detail).to.deep.equal({
    tabId: "preview",
  });
  expect(el.active).to.equal("preview");
  await el.updateComplete;
  expect(panels(el)[1].hidden).to.be.false;
  expect(panels(el)[0].hidden).to.be.true;
});

it("clicking the already-active tab is a no-op: no event, no change", async () => {
  const el = (await fixture(basic())) as LyraTabGroup;
  let fired = false;
  el.addEventListener("lr-tab-show", () => (fired = true));
  tabButtons(el)[0].click();
  await el.updateComplete;
  expect(fired).to.be.false;
  expect(el.active).to.equal("input");
});

it("a disabled child renders its tab, but clicking it never activates it", async () => {
  const el = (await fixture(html`
    <lr-tab-group>
      <div slot="input" label="Input">Raw input</div>
      <div slot="preview" label="Preview" disabled>Rendered preview</div>
    </lr-tab-group>
  `)) as LyraTabGroup;
  const buttons = tabButtons(el);
  expect(buttons.length).to.equal(2);
  expect(buttons[1].getAttribute("aria-disabled")).to.equal("true");
  expect(buttons[1].getAttribute("tabindex")).to.equal("-1");

  let fired = false;
  el.addEventListener("lr-tab-show", () => (fired = true));
  buttons[1].click();
  await el.updateComplete;
  expect(fired).to.be.false;
  expect(el.active).to.equal("input");
});

it("active defaults to the first non-disabled tab when the first tab is disabled", async () => {
  const el = (await fixture(html`
    <lr-tab-group>
      <div slot="input" label="Input" disabled>Raw input</div>
      <div slot="preview" label="Preview">Rendered preview</div>
    </lr-tab-group>
  `)) as LyraTabGroup;
  expect(el.active).to.equal("preview");
});

it("honors an explicit active attribute that points at a valid, enabled tab", async () => {
  const el = (await fixture(html`
    <lr-tab-group active="settings">
      <div slot="input" label="Input">Raw input</div>
      <div slot="preview" label="Preview">Rendered preview</div>
      <div slot="settings" label="Settings">Settings form</div>
    </lr-tab-group>
  `)) as LyraTabGroup;
  expect(el.active).to.equal("settings");
  expect(panels(el)[2].hidden).to.be.false;
});

it("falls back to the first enabled tab when active points at a disabled or unknown tab", async () => {
  const el = (await fixture(html`
    <lr-tab-group active="preview">
      <div slot="input" label="Input">Raw input</div>
      <div slot="preview" label="Preview" disabled>Rendered preview</div>
      <div slot="settings" label="Settings">Settings form</div>
    </lr-tab-group>
  `)) as LyraTabGroup;
  expect(el.active).to.equal("input");

  el.active = "does-not-exist";
  await el.updateComplete;
  expect(el.active).to.equal("input");
});

it("ArrowRight moves focus and selection to the next tab, wrapping from the last back to the first", async () => {
  const el = (await fixture(basic())) as LyraTabGroup;
  const buttons = tabButtons(el);

  press(buttons[0], "ArrowRight");
  await el.updateComplete;
  expect(el.active).to.equal("preview");
  expect(el.shadowRoot!.activeElement).to.equal(tabButtons(el)[1]);

  press(tabButtons(el)[1], "ArrowRight");
  await el.updateComplete;
  expect(el.active).to.equal("settings");

  press(tabButtons(el)[2], "ArrowRight");
  await el.updateComplete;
  expect(el.active).to.equal("input");
});

it("ArrowLeft moves focus and selection to the previous tab, wrapping from the first to the last", async () => {
  const el = (await fixture(basic())) as LyraTabGroup;
  press(tabButtons(el)[0], "ArrowLeft");
  await el.updateComplete;
  expect(el.active).to.equal("settings");
});

it("ArrowRight skips a disabled tab", async () => {
  const el = (await fixture(html`
    <lr-tab-group>
      <div slot="input" label="Input">Raw input</div>
      <div slot="preview" label="Preview" disabled>Rendered preview</div>
      <div slot="settings" label="Settings">Settings form</div>
    </lr-tab-group>
  `)) as LyraTabGroup;
  press(tabButtons(el)[0], "ArrowRight");
  await el.updateComplete;
  expect(el.active).to.equal("settings");
});

it('swaps ArrowLeft/ArrowRight under dir="rtl", matching lr-split/lr-tree physical-direction handling', async () => {
  const el = (await fixture(html`
    <lr-tab-group dir="rtl">
      <div slot="input" label="Input">Raw input</div>
      <div slot="preview" label="Preview">Rendered preview</div>
      <div slot="settings" label="Settings">Settings form</div>
    </lr-tab-group>
  `)) as LyraTabGroup;
  const buttons = tabButtons(el);

  press(buttons[0], "ArrowLeft");
  await el.updateComplete;
  expect(el.active).to.equal("preview");

  press(tabButtons(el)[1], "ArrowRight");
  await el.updateComplete;
  expect(el.active).to.equal("input");
});

it("Home and End jump to the first and last enabled tabs", async () => {
  const el = (await fixture(basic())) as LyraTabGroup;
  const buttons = tabButtons(el);

  press(buttons[1], "End");
  await el.updateComplete;
  expect(el.active).to.equal("settings");

  press(tabButtons(el)[2], "Home");
  await el.updateComplete;
  expect(el.active).to.equal("input");
});

it("emits lr-tab-show on keyboard-driven activation too", async () => {
  const el = (await fixture(basic())) as LyraTabGroup;
  const listener = oneEvent(el, "lr-tab-show");
  press(tabButtons(el)[0], "ArrowRight");
  const event = await listener;
  expect((event as CustomEvent<{ tabId: string }>).detail).to.deep.equal({
    tabId: "preview",
  });
});

it('a direct-child sibling with slot="<id>-icon" renders as that tab\'s leading icon, hidden from its accessible name', async () => {
  const el = (await fixture(html`
    <lr-tab-group>
      <span slot="input-icon" aria-hidden="true">🔥</span>
      <div slot="input" label="Input">Raw input</div>
      <div slot="preview" label="Preview">Rendered preview</div>
    </lr-tab-group>
  `)) as LyraTabGroup;
  const buttons = tabButtons(el);

  const iconWrapper = buttons[0].querySelector('[part="tab-icon"]');
  expect(iconWrapper).to.exist;
  expect(iconWrapper!.getAttribute("aria-hidden")).to.equal("true");
  const assigned = (
    iconWrapper!.querySelector("slot") as HTMLSlotElement
  ).assignedElements();
  expect(assigned).to.have.length(1);
  expect(assigned[0].textContent).to.equal("🔥");

  // The button's visible text still includes the label, but the accessible
  // name stays exactly "Input" (verified below by the a11y check) -- the
  // icon wrapper's aria-hidden excludes its slotted content from the name.
  expect(buttons[0].textContent).to.include("Input");
  // A tab with no matching `<id>-icon` sibling renders no icon wrapper at all.
  expect(buttons[1].querySelector('[part="tab-icon"]')).to.be.null;

  await expect(el).to.be.accessible();
});

it("picks up a tab added dynamically after connect", async () => {
  const el = (await fixture(basic())) as LyraTabGroup;
  const extra = document.createElement("div");
  extra.setAttribute("slot", "extra");
  extra.setAttribute("label", "Extra");
  extra.textContent = "Extra content";
  el.appendChild(extra);

  await aTimeout(0);
  await el.updateComplete;

  expect(tabButtons(el).map((b) => b.dataset.slot)).to.deep.equal([
    "input",
    "preview",
    "settings",
    "extra",
  ]);
});

it("picks up a disabled attribute toggled on an already-rendered child", async () => {
  const el = (await fixture(basic())) as LyraTabGroup;
  const child = el.querySelector('[slot="preview"]')!;
  child.setAttribute("disabled", "");

  await aTimeout(0);
  await el.updateComplete;

  const buttons = tabButtons(el);
  expect(buttons[1].getAttribute("aria-disabled")).to.equal("true");
});

it("a mutation on a nested descendant (not a direct child) never forces a tabs recompute", async () => {
  const el = (await fixture(html`
    <lr-tab-group>
      <div slot="input" label="Input"><button disabled>nested</button></div>
      <div slot="preview" label="Preview">Rendered preview</div>
    </lr-tab-group>
  `)) as LyraTabGroup;
  await el.updateComplete;

  let updateCount = 0;
  const originalUpdated = (
    el as unknown as { updated: (changed: Map<string, unknown>) => void }
  ).updated.bind(el);
  (
    el as unknown as { updated: (changed: Map<string, unknown>) => void }
  ).updated = (changed) => {
    updateCount++;
    originalUpdated(changed);
  };

  // Matches attributeFilter (`disabled`) but the button is a grandchild, not
  // a direct child -- a panel is free to churn its own content without the
  // tabs strip resyncing/re-rendering on every unrelated mutation.
  el.querySelector("button")!.removeAttribute("disabled");

  await aTimeout(50);
  expect(updateCount).to.equal(0);
});

it("reassigns active when the currently-active child is removed", async () => {
  const el = (await fixture(basic())) as LyraTabGroup;
  expect(el.active).to.equal("input");
  el.querySelector('[slot="input"]')!.remove();

  await aTimeout(0);
  await el.updateComplete;

  expect(el.active).to.equal("preview");
  expect(tabButtons(el).length).to.equal(2);
});

it("rehomes focus when the focused active tab is removed", async () => {
  const el = (await fixture(basic())) as LyraTabGroup;
  tabButtons(el)[0].focus();
  el.querySelector('[slot="input"]')!.remove();

  await aTimeout(0);
  await el.updateComplete;

  const focused = el.shadowRoot!.activeElement as HTMLElement | null;
  expect(el.active).to.equal("preview");
  expect(focused?.dataset["slot"]).to.equal("preview");
  expect(focused?.tabIndex).to.equal(0);
});

it("rehomes focus when the focused active tab becomes disabled", async () => {
  const el = (await fixture(basic())) as LyraTabGroup;
  tabButtons(el)[0].focus();
  el.querySelector('[slot="input"]')!.setAttribute("disabled", "");

  await aTimeout(0);
  await el.updateComplete;

  const focused = el.shadowRoot!.activeElement as HTMLElement | null;
  expect(el.active).to.equal("preview");
  expect(focused?.dataset["slot"]).to.equal("preview");
  expect(focused?.tabIndex).to.equal(0);
});

it("keeps real keyboard focus on the active tab when a tab BEFORE it is removed", async () => {
  const el = (await fixture(basic())) as LyraTabGroup;
  tabButtons(el)[1].click();
  await el.updateComplete;
  tabButtons(el)[1].focus();
  expect(el.active).to.equal("preview");
  expect(el.shadowRoot!.activeElement).to.equal(tabButtons(el)[1]);

  el.querySelector('[slot="input"]')!.remove();
  await aTimeout(0);
  await el.updateComplete;

  const focused = el.shadowRoot!.activeElement as HTMLButtonElement | null;
  expect(el.active).to.equal("preview");
  expect(focused?.dataset.slot).to.equal("preview");
  expect(focused?.getAttribute("aria-selected")).to.equal("true");
});

it('forwards a host aria-label to the role="tablist" element, and omits the attribute when unset', async () => {
  const el = (await fixture(basic())) as LyraTabGroup;
  const tablist = el.shadowRoot!.querySelector('[role="tablist"]')!;
  expect(tablist.hasAttribute("aria-label")).to.be.false;

  el.setAttribute("aria-label", "Editor views");
  await el.updateComplete;
  expect(el.accessibleLabel).to.equal("Editor views");
  expect(tablist.getAttribute("aria-label")).to.equal("Editor views");
});

it("does not steal focus by reassigning it when the invalid-active correction happens with focus elsewhere", async () => {
  const el = (await fixture(basic())) as LyraTabGroup;
  const outside = document.createElement("button");
  document.body.appendChild(outside);
  outside.focus();

  el.querySelector('[slot="input"]')!.remove();

  await aTimeout(0);
  await el.updateComplete;

  expect(el.active).to.equal("preview");
  expect(document.activeElement).to.equal(outside);
  outside.remove();
});

describe("selected/hover cssprops", () => {
  /** Resolves what a `declaration` would compute to *inside this component's shadow root*, where the
   *  `--lr-*` design tokens actually live (they are declared on `:host`, so a light-DOM probe would
   *  see none of them). */
  function resolvedInShadow(
    el: LyraTabGroup,
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

  /** The declaration block of the first rule matching `selector`, read off the component's own
   *  constructed stylesheet rather than its serialized text. */
  function ruleFor(selector: string): CSSStyleDeclaration {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(styles.cssText);
    // CSSOM re-serializes attribute selectors with double quotes; compare quote-insensitively.
    const normalize = (text: string) => text.replace(/"/g, "'");
    const rule = [...sheet.cssRules].find(
      (candidate) =>
        candidate instanceof CSSStyleRule &&
        normalize(candidate.selectorText) === normalize(selector)
    ) as CSSStyleRule | undefined;
    expect(rule, `no rule for ${selector}`).to.exist;
    return rule!.style;
  }

  async function themed(style: string): Promise<LyraTabGroup> {
    const wrapper = (await fixture(
      html`<div style=${style}>${basic()}</div>`
    )) as HTMLElement;
    const el = wrapper.querySelector("lr-tab-group") as LyraTabGroup;
    await el.updateComplete;
    return el;
  }

  const overrides =
    "--lr-tab-group-selected-color: rgb(0, 51, 102); --lr-tab-group-indicator-color: rgb(0, 102, 51);";

  it("recolors the selected tab and its indicator independently, from an ancestor", async () => {
    const el = await themed(overrides);
    const [selected, unselected] = tabButtons(el);
    expect(selected!.getAttribute("aria-selected")).to.equal("true");
    expect(getComputedStyle(selected!).color).to.equal("rgb(0, 51, 102)");
    expect(getComputedStyle(selected!).borderBlockEndColor).to.equal(
      "rgb(0, 102, 51)"
    );

    // Unselected tabs keep the quiet resting treatment and a transparent underline.
    expect(getComputedStyle(unselected!).color).to.equal(
      resolvedInShadow(el, "color: var(--lr-color-text-quiet)", "color")
    );
    expect(getComputedStyle(unselected!).borderBlockEndColor).to.equal(
      "rgba(0, 0, 0, 0)"
    );
  });

  it("leaves the hover treatment of an UNSELECTED tab untouched -- the coupling the props exist to break", async () => {
    const el = await themed(overrides);
    // The hover rule resolves through its own prop, never through the selected-state props: before
    // this hook existed the only way to recolor the selected tab was to hijack library-wide
    // --lr-color-brand/--lr-color-text, which repainted hovered-unselected tabs with it too.
    const hover = ruleFor(
      ":where([part='tab']):hover:where(:not([aria-disabled='true']))"
    );
    expect(hover.getPropertyValue("color")).to.equal(
      "var(--lr-tab-group-hover-color, var(--lr-color-text))"
    );
    expect(hover.cssText).to.not.include("selected");
    expect(hover.cssText).to.not.include("indicator");
    expect(
      resolvedInShadow(el, "color: var(--lr-color-text)", "color")
    ).to.equal(
      resolvedInShadow(
        el,
        "color: var(--lr-tab-group-hover-color, var(--lr-color-text))",
        "color"
      )
    );
  });

  it("recolors the hover treatment on its own, without touching the selected tab", async () => {
    const el = await themed("--lr-tab-group-hover-color: rgb(7, 8, 9);");
    const selected = tabButtons(el)[0]!;
    const brand = resolvedInShadow(el, "color: var(--lr-color-brand)", "color");
    expect(getComputedStyle(selected).color).to.equal(brand);
    expect(getComputedStyle(selected).borderBlockEndColor).to.equal(brand);
    expect(
      resolvedInShadow(
        el,
        "color: var(--lr-tab-group-hover-color, var(--lr-color-text))",
        "color"
      )
    ).to.equal("rgb(7, 8, 9)");
  });

  it("renders identically to the pre-cssprop output when every prop is unset", async () => {
    const el = (await fixture(basic())) as LyraTabGroup;
    const selected = getComputedStyle(tabButtons(el)[0]!);
    const brand = resolvedInShadow(el, "color: var(--lr-color-brand)", "color");
    expect(selected.color).to.equal(brand);
    expect(selected.borderBlockEndColor).to.equal(brand);
  });

  it("is accessible with the selected-state props themed", async () => {
    const el = await themed(overrides);
    await expect(el).to.be.accessible();
  });
});

// --- Upstream child model (`<lr-tab>` / `<lr-tab-panel>`) --------------------------------------
// This is what makes `wa-tab-group`/`sl-tab-group` markup a mechanical rename: before it existed,
// that markup rendered nothing at all.

const elementModel = () => html`
  <lr-tab-group>
    <lr-tab panel="general">General</lr-tab>
    <lr-tab panel="advanced">Advanced</lr-tab>
    <lr-tab panel="danger" disabled>Danger</lr-tab>
    <lr-tab-panel name="general">General settings</lr-tab-panel>
    <lr-tab-panel name="advanced">Advanced settings</lr-tab-panel>
    <lr-tab-panel name="danger">Danger zone</lr-tab-panel>
  </lr-tab-group>
`;

it("builds one tab per <lr-tab> and activates the first enabled one", async () => {
  const el = (await fixture(elementModel())) as LyraTabGroup;
  await el.updateComplete;
  const buttons = tabButtons(el);
  expect(buttons).to.have.lengthOf(3);
  expect(el.active).to.equal("general");
  expect(buttons[0]!.getAttribute("aria-selected")).to.equal("true");
  expect(buttons[2]!.getAttribute("aria-disabled")).to.equal("true");
  await expect(el).to.be.accessible();
});

it("projects each <lr-tab>'s content into its own button, so the accessible name is that content", async () => {
  const el = (await fixture(elementModel())) as LyraTabGroup;
  await el.updateComplete;
  const slot = tabButtons(el)[0]!.querySelector("slot") as HTMLSlotElement;
  const assigned = slot.assignedElements({ flatten: true });
  expect(assigned).to.have.lengthOf(1);
  expect(assigned[0]!.localName).to.equal("lr-tab");
  expect(assigned[0]!.textContent!.trim()).to.equal("General");
});

it("assigns each <lr-tab-panel> the slot that lands it in the matching tabpanel", async () => {
  const el = (await fixture(elementModel())) as LyraTabGroup;
  await el.updateComplete;
  const panel = el.querySelector('lr-tab-panel[name="advanced"]') as HTMLElement;
  expect(panel.getAttribute("slot")).to.equal("advanced");
  const wrapper = panels(el)[1]!;
  const assigned = (wrapper.querySelector("slot") as HTMLSlotElement).assignedElements({ flatten: true });
  expect(assigned.map((node) => node.localName)).to.deep.equal(["lr-tab-panel"]);
});

it("only the active panel is visible", async () => {
  const el = (await fixture(elementModel())) as LyraTabGroup;
  await el.updateComplete;
  const [first, second] = panels(el);
  expect(first!.hasAttribute("hidden")).to.equal(false);
  expect(second!.hasAttribute("hidden")).to.equal(true);
});

it("switches panels on click and emits lr-tab-hide before lr-tab-show", async () => {
  const el = (await fixture(elementModel())) as LyraTabGroup;
  await el.updateComplete;
  const order: string[] = [];
  el.addEventListener("lr-tab-hide", (e) => order.push(`hide:${(e as CustomEvent).detail.tabId}`));
  el.addEventListener("lr-tab-show", (e) => order.push(`show:${(e as CustomEvent).detail.tabId}`));
  tabButtons(el)[1]!.click();
  await el.updateComplete;
  expect(el.active).to.equal("advanced");
  expect(order).to.deep.equal(["hide:general", "show:advanced"]);
});

it("never activates a disabled <lr-tab>", async () => {
  const el = (await fixture(elementModel())) as LyraTabGroup;
  await el.updateComplete;
  tabButtons(el)[2]!.click();
  await el.updateComplete;
  expect(el.active).to.equal("general");
});

it("gives an <lr-tab> with no panel attribute a stable synthetic name rather than dropping it", async () => {
  const el = (await fixture(html`
    <lr-tab-group>
      <lr-tab>Solo</lr-tab>
      <lr-tab panel="second">Second</lr-tab>
      <lr-tab-panel name="second">Second body</lr-tab-panel>
    </lr-tab-group>
  `)) as LyraTabGroup;
  await el.updateComplete;
  expect(tabButtons(el)).to.have.lengthOf(2);
  const firstName = el.active;
  el.requestUpdate();
  await el.updateComplete;
  expect(el.active).to.equal(firstName);
});

it("adopts a tab added after first render", async () => {
  const el = (await fixture(elementModel())) as LyraTabGroup;
  await el.updateComplete;
  const tab = document.createElement("lr-tab");
  tab.setAttribute("panel", "extra");
  tab.textContent = "Extra";
  const panel = document.createElement("lr-tab-panel");
  panel.setAttribute("name", "extra");
  panel.textContent = "Extra body";
  el.append(tab, panel);
  await nextFrames();
  await el.updateComplete;
  expect(tabButtons(el)).to.have.lengthOf(4);
});

// --- placement --------------------------------------------------------------------------------

it("defaults to a horizontal strip and reports it through aria-orientation", async () => {
  const el = (await fixture(basic())) as LyraTabGroup;
  await el.updateComplete;
  expect(el.placement).to.equal("top");
  const tablist = el.shadowRoot!.querySelector('[part="tablist"]') as HTMLElement;
  expect(tablist.getAttribute("aria-orientation")).to.equal("horizontal");
});

it("turns the tablist vertical for a start/end placement", async () => {
  const el = (await fixture(html`
    <lr-tab-group placement="start">
      <div slot="a" label="A">A body</div>
      <div slot="b" label="B">B body</div>
    </lr-tab-group>
  `)) as LyraTabGroup;
  await el.updateComplete;
  const tablist = el.shadowRoot!.querySelector('[part="tablist"]') as HTMLElement;
  expect(tablist.getAttribute("aria-orientation")).to.equal("vertical");
  // Rendered result, not stylesheet text.
  expect(getComputedStyle(tablist).flexDirection).to.equal("column");
});

it("navigates a vertical strip with Up/Down, not Left/Right", async () => {
  const el = (await fixture(html`
    <lr-tab-group placement="end">
      <div slot="a" label="A">A body</div>
      <div slot="b" label="B">B body</div>
    </lr-tab-group>
  `)) as LyraTabGroup;
  await el.updateComplete;
  const tablist = el.shadowRoot!.querySelector('[part="tablist"]') as HTMLElement;
  press(tablist, "ArrowRight");
  await el.updateComplete;
  expect(el.active).to.equal("a");
  press(tablist, "ArrowDown");
  await el.updateComplete;
  expect(el.active).to.equal("b");
});

// --- activation -------------------------------------------------------------------------------

it("moves focus without selecting under activation=manual, and commits on Enter", async () => {
  const el = (await fixture(html`
    <lr-tab-group activation="manual">
      <div slot="a" label="A">A body</div>
      <div slot="b" label="B">B body</div>
    </lr-tab-group>
  `)) as LyraTabGroup;
  await el.updateComplete;
  const tablist = el.shadowRoot!.querySelector('[part="tablist"]') as HTMLElement;
  press(tablist, "ArrowRight");
  await el.updateComplete;

  // Focus moved, selection did not -- which is the entire point of manual activation.
  expect(el.active).to.equal("a");
  expect(tabButtons(el)[1]!.getAttribute("tabindex")).to.equal("0");
  expect(tabButtons(el)[0]!.getAttribute("tabindex")).to.equal("-1");

  press(tabButtons(el)[1]!, "Enter");
  await el.updateComplete;
  expect(el.active).to.equal("b");
});

it("commits on Space under activation=manual", async () => {
  const el = (await fixture(html`
    <lr-tab-group activation="manual">
      <div slot="a" label="A">A body</div>
      <div slot="b" label="B">B body</div>
    </lr-tab-group>
  `)) as LyraTabGroup;
  await el.updateComplete;
  const tablist = el.shadowRoot!.querySelector('[part="tablist"]') as HTMLElement;
  press(tablist, "End");
  await el.updateComplete;
  expect(el.active).to.equal("a");
  press(tablist, " ");
  await el.updateComplete;
  expect(el.active).to.equal("b");
});

it("keeps selection and focus together under the default activation=auto", async () => {
  const el = (await fixture(basic())) as LyraTabGroup;
  await el.updateComplete;
  const tablist = el.shadowRoot!.querySelector('[part="tablist"]') as HTMLElement;
  press(tablist, "ArrowRight");
  await el.updateComplete;
  expect(el.active).to.equal("preview");
  expect(tabButtons(el)[1]!.getAttribute("tabindex")).to.equal("0");
});

// --- scroll controls --------------------------------------------------------------------------

/** Six long labels in a 220px box: wide enough that both 40px controls still measure their full
 *  hit area, narrow enough that the tab row genuinely overflows. */
const crowdedTabs = () =>
  [
    ["overview", "Overview of everything"],
    ["activity", "Activity history"],
    ["artifacts", "Generated artifacts"],
    ["evaluations", "Evaluations and scores"],
    ["settings", "Workspace settings"],
    ["permissions", "Permissions and access"],
  ].map(
    ([id, label]) => html`<div slot=${id} label=${label}>${label} panel</div>`
  );

async function crowded(): Promise<LyraTabGroup> {
  const el = (await fixture(html`
    <lr-tab-group style="display: block; max-inline-size: 220px">
      ${crowdedTabs()}
    </lr-tab-group>
  `)) as LyraTabGroup;
  await nextFrames();
  await el.updateComplete;
  return el;
}

function scrollControls(el: LyraTabGroup): HTMLButtonElement[] {
  return [
    ...el.shadowRoot!.querySelectorAll('[part~="scroll-button"]'),
  ] as HTMLButtonElement[];
}

function scrollControl(el: LyraTabGroup, edge: "start" | "end"): HTMLButtonElement {
  return el.shadowRoot!.querySelector(
    `[part~="scroll-button-${edge}"]`
  ) as HTMLButtonElement;
}

/** Records the `scrollBy()` calls one control makes, restoring the real method afterwards. */
async function recordScroll(
  el: LyraTabGroup,
  edge: "start" | "end"
): Promise<ScrollToOptions[]> {
  const tablist = el.shadowRoot!.querySelector('[part="tablist"]') as HTMLElement;
  const calls: ScrollToOptions[] = [];
  const original = tablist.scrollBy.bind(tablist);
  tablist.scrollBy = ((options: ScrollToOptions) => {
    calls.push(options);
  }) as typeof tablist.scrollBy;
  try {
    scrollControl(el, edge).click();
    await el.updateComplete;
  } finally {
    tablist.scrollBy = original;
  }
  return calls;
}

it("keeps the scroll controls out of layout while the tablist fits", async () => {
  const el = (await fixture(basic())) as LyraTabGroup;
  await nextFrames();
  const displays = scrollControls(el).map(
    (button) => getComputedStyle(button).display
  );
  expect(displays).to.deep.equal(["none", "none"]);
});

it("shows both scroll controls once the tablist actually overflows", async () => {
  const el = await crowded();
  const tablist = el.shadowRoot!.querySelector('[part="tablist"]') as HTMLElement;
  expect(tablist.hasAttribute("data-scroll-overflow")).to.equal(true);
  const displays = scrollControls(el).map(
    (button) => getComputedStyle(button).display
  );
  expect(displays).to.have.lengthOf(2);
  expect(displays.some((display) => display === "none")).to.equal(false);
});

it("each scroll control meets the shared 40px minimum hit area", async () => {
  const el = await crowded();
  for (const edge of ["start", "end"] as const) {
    const box = scrollControl(el, edge).getBoundingClientRect();
    expect(Math.round(box.width), `${edge} control width`).to.be.at.least(40);
    expect(Math.round(box.height), `${edge} control height`).to.be.at.least(40);
  }
});

it("without-scroll-controls removes them entirely, leaving native scrolling and the edge fade", async () => {
  const el = (await fixture(html`
    <lr-tab-group without-scroll-controls style="display: block; max-inline-size: 220px">
      ${crowdedTabs()}
    </lr-tab-group>
  `)) as LyraTabGroup;
  await nextFrames();
  expect(scrollControls(el)).to.have.lengthOf(0);
  const tablist = el.shadowRoot!.querySelector('[part="tablist"]') as HTMLElement;
  expect(tablist.hasAttribute("data-scroll-overflow")).to.equal(true);
  expect(getComputedStyle(tablist).maskImage).to.contain("linear-gradient");
});

it("accepts the Shoelace spelling no-scroll-controls for the same opt-out", async () => {
  const el = (await fixture(html`
    <lr-tab-group no-scroll-controls style="display: block; max-inline-size: 220px">
      ${crowdedTabs()}
    </lr-tab-group>
  `)) as LyraTabGroup;
  await nextFrames();
  expect(el.noScrollControls).to.equal(true);
  expect(el.withoutScrollControls).to.equal(false);
  expect(scrollControls(el)).to.have.lengthOf(0);
});

it("never renders scroll controls for a vertical placement", async () => {
  const el = (await fixture(html`
    <lr-tab-group placement="start" style="display: block; max-inline-size: 220px">
      ${crowdedTabs()}
    </lr-tab-group>
  `)) as LyraTabGroup;
  await nextFrames();
  expect(scrollControls(el)).to.have.lengthOf(0);
});

it("scrolls the tablist toward its inline end, then back, in LTR", async () => {
  const el = await crowded();
  const forward = await recordScroll(el, "end");
  expect(forward).to.have.lengthOf(1);
  expect(forward[0]!.left).to.be.greaterThan(0);
  const backward = await recordScroll(el, "start");
  expect(backward).to.have.lengthOf(1);
  expect(backward[0]!.left).to.be.lessThan(0);
});

it("scrolls by a viewport-sized step rather than a fixed pixel amount", async () => {
  const el = await crowded();
  const tablist = el.shadowRoot!.querySelector('[part="tablist"]') as HTMLElement;
  const calls = await recordScroll(el, "end");
  expect(Math.abs(calls[0]!.left!)).to.be.at.most(tablist.clientWidth);
  expect(Math.abs(calls[0]!.left!)).to.be.at.least(tablist.clientWidth / 2);
});

it("flips the physical scroll direction under dir=rtl", async () => {
  const host = await fixture(html`
    <div dir="rtl">
      <lr-tab-group style="display: block; max-inline-size: 220px">
        ${crowdedTabs()}
      </lr-tab-group>
    </div>
  `);
  const el = host.querySelector("lr-tab-group") as LyraTabGroup;
  await nextFrames();
  await el.updateComplete;
  // Per the CSSOM View spec scrollLeft runs 0 (inline-start) down to -max in RTL, so "next"
  // (toward the inline end) is a NEGATIVE delta -- the mirror image of the LTR case above.
  const forward = await recordScroll(el, "end");
  expect(forward[0]!.left).to.be.lessThan(0);
  const backward = await recordScroll(el, "start");
  expect(backward[0]!.left).to.be.greaterThan(0);
});

it("scrolls instantly under prefers-reduced-motion", async () => {
  const el = await crowded();
  const originalMatchMedia = window.matchMedia;
  window.matchMedia = ((query: string) => ({
    matches: query === "(prefers-reduced-motion: reduce)",
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as typeof window.matchMedia;
  try {
    const calls = await recordScroll(el, "end");
    // `instant`, not `auto`: `auto` defers to the stylesheet, so a consumer's own
    // `scroll-behavior: smooth` would animate the very scroll the preference asks not to animate.
    expect(calls[0]!.behavior).to.equal("instant");
  } finally {
    window.matchMedia = originalMatchMedia;
  }
});

it("scrolls smoothly when motion is allowed", async () => {
  const el = await crowded();
  const originalMatchMedia = window.matchMedia;
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as typeof window.matchMedia;
  try {
    const calls = await recordScroll(el, "end");
    expect(calls[0]!.behavior).to.equal("smooth");
  } finally {
    window.matchMedia = originalMatchMedia;
  }
});

it("names both scroll controls with localized strings, overridable through .strings", async () => {
  const el = await crowded();
  expect(scrollControl(el, "start").getAttribute("aria-label")).to.equal(
    "Scroll backward"
  );
  expect(scrollControl(el, "end").getAttribute("aria-label")).to.equal(
    "Scroll forward"
  );
  el.strings = { scrollPrevious: "Reculer", scrollNext: "Avancer" };
  await el.updateComplete;
  expect(scrollControl(el, "start").getAttribute("aria-label")).to.equal(
    "Reculer"
  );
  expect(scrollControl(el, "end").getAttribute("aria-label")).to.equal(
    "Avancer"
  );
});

it("keeps the scroll controls out of the tab order and the accessibility tree", async () => {
  const el = await crowded();
  for (const edge of ["start", "end"] as const) {
    const button = scrollControl(el, edge);
    expect(button.getAttribute("aria-hidden"), `${edge} aria-hidden`).to.equal(
      "true"
    );
    expect(button.getAttribute("tabindex"), `${edge} tabindex`).to.equal("-1");
  }
});

it("never takes focus off the tabs when a scroll control is pressed", async () => {
  const el = await crowded();
  const button = scrollControl(el, "end");
  const mousedown = new MouseEvent("mousedown", {
    bubbles: true,
    cancelable: true,
    composed: true,
  });
  button.dispatchEvent(mousedown);
  expect(mousedown.defaultPrevented).to.equal(true);
});

it("mirrors the chevron through the wrapping glyph part, never the icon itself", async () => {
  const ltr = await crowded();
  const ltrStart = getComputedStyle(
    scrollControl(ltr, "start").querySelector(
      '[part="scroll-button-glyph"]'
    ) as HTMLElement
  ).transform;
  const ltrEnd = getComputedStyle(
    scrollControl(ltr, "end").querySelector(
      '[part="scroll-button-glyph"]'
    ) as HTMLElement
  ).transform;
  expect(ltrStart).to.not.equal(ltrEnd);
  // The svg the wrapper holds is never itself transformed -- internal/icons.ts ships one
  // direction-free glyph and the wrapping part is what points it.
  const icon = scrollControl(ltr, "start").querySelector("svg") as SVGElement;
  expect(getComputedStyle(icon).transform).to.equal("none");

  const host = await fixture(html`
    <div dir="rtl">
      <lr-tab-group style="display: block; max-inline-size: 220px">
        ${crowdedTabs()}
      </lr-tab-group>
    </div>
  `);
  const rtl = host.querySelector("lr-tab-group") as LyraTabGroup;
  await nextFrames();
  await rtl.updateComplete;
  const rtlStart = getComputedStyle(
    scrollControl(rtl, "start").querySelector(
      '[part="scroll-button-glyph"]'
    ) as HTMLElement
  ).transform;
  expect(rtlStart).to.not.equal(ltrStart);
});

it("is accessible while the scroll controls are showing", async () => {
  const el = await crowded();
  await expect(el).to.be.accessible();
});

it("lets a consumer's own ::part(scroll-button) rule beat the internal hidden state", async () => {
  // The internal "not overflowing, so stay out of layout" rule keeps its qualifier in :where(),
  // so it never out-specifies the ::part() override a consumer would reach for.
  const host = await fixture(html`
    <div>
      <style>
        lr-tab-group::part(scroll-button) {
          display: flex;
        }
      </style>
      <lr-tab-group>
        <div slot="input" label="Input">Raw input</div>
        <div slot="preview" label="Preview">Rendered preview</div>
      </lr-tab-group>
    </div>
  `);
  const el = host.querySelector("lr-tab-group") as LyraTabGroup;
  await nextFrames();
  const tablist = el.shadowRoot!.querySelector('[part="tablist"]') as HTMLElement;
  expect(tablist.hasAttribute("data-scroll-overflow")).to.equal(false);
  expect(getComputedStyle(scrollControl(el, "start")).display).to.equal("flex");
});

it("lays the start control before the tabs in LTR and after them under RTL", async () => {
  const ltr = await crowded();
  const ltrTablist = ltr.shadowRoot!.querySelector(
    '[part="tablist"]'
  ) as HTMLElement;
  expect(
    scrollControl(ltr, "start").getBoundingClientRect().left
  ).to.be.lessThan(ltrTablist.getBoundingClientRect().left);

  const host = await fixture(html`
    <div dir="rtl">
      <lr-tab-group style="display: block; max-inline-size: 220px">
        ${crowdedTabs()}
      </lr-tab-group>
    </div>
  `);
  const rtl = host.querySelector("lr-tab-group") as LyraTabGroup;
  await nextFrames();
  await rtl.updateComplete;
  const rtlTablist = rtl.shadowRoot!.querySelector(
    '[part="tablist"]'
  ) as HTMLElement;
  // Logical, not physical: "toward the inline start" is the right-hand edge here, so the same
  // control moves to the other side of the strip with no :dir() rule involved in the layout.
  expect(
    scrollControl(rtl, "start").getBoundingClientRect().left
  ).to.be.greaterThan(rtlTablist.getBoundingClientRect().left);
});
