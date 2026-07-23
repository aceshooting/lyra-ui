import { fixture, expect, oneEvent, html, aTimeout } from "@open-wc/testing";
import "./tabs.js";
import type { LyraTabs } from "./tabs.js";
import { styles } from "./tabs.styles.js";

const basic = () => html`
  <lr-tabs>
    <div slot="input" label="Input">Raw input</div>
    <div slot="preview" label="Preview">Rendered preview</div>
    <div slot="settings" label="Settings">Settings form</div>
  </lr-tabs>
`;

function tabButtons(el: LyraTabs): HTMLButtonElement[] {
  return [
    ...el.shadowRoot!.querySelectorAll('[part="tab"]'),
  ] as HTMLButtonElement[];
}

function panels(el: LyraTabs): HTMLElement[] {
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
  const el = (await fixture(basic())) as LyraTabs;
  const tablist = el.shadowRoot!.querySelector(
    '[part="tablist"]'
  ) as HTMLElement;
  expect(getComputedStyle(tablist).overflowY).to.equal("hidden");
});

it("adds a static, themeable edge fade to the scroll container", () => {
  const css = styles.cssText.replace(/\s+/g, " ").replaceAll('"', "'");
  expect(css).to.include("-webkit-mask-image: linear-gradient");
  expect(css).to.include("mask-image: linear-gradient");
  expect(css).to.include("var(--lr-scroll-fade-size)");
});

it('the internal [part="tab"]:hover rule is :where()-wrapped, so a consumer ::part(tab):hover override wins without needing !important', async () => {
  const el = (await fixture(basic())) as LyraTabs;
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
  const el = (await fixture(html`<lr-tabs></lr-tabs>`)) as LyraTabs;
  expect(tabButtons(el).length).to.equal(0);
  await expect(el).to.be.accessible();
});

it("is accessible with populated tabs", async () => {
  const el = (await fixture(basic())) as LyraTabs;
  await expect(el).to.be.accessible();
});

it("builds one tab per direct child that has both slot and label, defaulting active to the first", async () => {
  const el = (await fixture(basic())) as LyraTabs;
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
    <lr-tabs>
      <div slot="input" label="Input">Raw input</div>
      <div slot="preview">No label -- should be invisible</div>
    </lr-tabs>
  `)) as LyraTabs;
  const buttons = tabButtons(el);
  expect(buttons.length).to.equal(1);
  expect(panels(el).length).to.equal(1);
  const unlabeled = el.querySelector('[slot="preview"]') as HTMLElement;
  // Never assigned to any rendered <slot>, since this component only ever
  // renders a named slot for tabs that made it into the `tabs` state.
  expect(unlabeled.assignedSlot).to.be.null;
});

it("only the active panel is visible; the others are hidden", async () => {
  const el = (await fixture(basic())) as LyraTabs;
  const [input, preview, settings] = panels(el);
  expect(input.hidden).to.be.false;
  expect(preview.hidden).to.be.true;
  expect(settings.hidden).to.be.true;
});

it('roving tabindex: only the active tab button is tabindex="0"', async () => {
  const el = (await fixture(basic())) as LyraTabs;
  const buttons = tabButtons(el);
  expect(buttons.map((b) => b.getAttribute("tabindex"))).to.deep.equal([
    "0",
    "-1",
    "-1",
  ]);
});

it("each tab button aria-controls its own panel, and each panel is aria-labelledby its tab", async () => {
  const el = (await fixture(basic())) as LyraTabs;
  const [inputTab, previewTab] = tabButtons(el);
  const [inputPanel, previewPanel] = panels(el);
  expect(inputTab.getAttribute("aria-controls")).to.equal(inputPanel.id);
  expect(previewTab.getAttribute("aria-controls")).to.equal(previewPanel.id);
  expect(inputPanel.getAttribute("aria-labelledby")).to.equal(inputTab.id);
});

it("uses opaque ARIA ids when a public slot name contains whitespace or selector syntax", async () => {
  const slotName = 'tab with spaces"[data-hostile]';
  const el = (await fixture(html`
    <lr-tabs>
      <div slot=${slotName} label="Hostile">Content</div>
    </lr-tabs>
  `)) as LyraTabs;
  const tab = tabButtons(el)[0];
  const panel = panels(el)[0];
  expect(tab.id).to.match(/^lr-tabs-\d+-\d+-tab$/);
  expect(panel.id).to.match(/^lr-tabs-\d+-\d+-panel$/);
  expect(tab.id).to.not.include(slotName);
  expect(tab.getAttribute("aria-controls")).to.equal(panel.id);
  expect(panel.getAttribute("aria-labelledby")).to.equal(tab.id);
});

it("clicking a tab activates it and fires lr-tabs-change with the tab id", async () => {
  const el = (await fixture(basic())) as LyraTabs;
  const listener = oneEvent(el, "lr-tabs-change");
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
  const el = (await fixture(basic())) as LyraTabs;
  let fired = false;
  el.addEventListener("lr-tabs-change", () => (fired = true));
  tabButtons(el)[0].click();
  await el.updateComplete;
  expect(fired).to.be.false;
  expect(el.active).to.equal("input");
});

it("a disabled child renders its tab, but clicking it never activates it", async () => {
  const el = (await fixture(html`
    <lr-tabs>
      <div slot="input" label="Input">Raw input</div>
      <div slot="preview" label="Preview" disabled>Rendered preview</div>
    </lr-tabs>
  `)) as LyraTabs;
  const buttons = tabButtons(el);
  expect(buttons.length).to.equal(2);
  expect(buttons[1].getAttribute("aria-disabled")).to.equal("true");
  expect(buttons[1].getAttribute("tabindex")).to.equal("-1");

  let fired = false;
  el.addEventListener("lr-tabs-change", () => (fired = true));
  buttons[1].click();
  await el.updateComplete;
  expect(fired).to.be.false;
  expect(el.active).to.equal("input");
});

it("active defaults to the first non-disabled tab when the first tab is disabled", async () => {
  const el = (await fixture(html`
    <lr-tabs>
      <div slot="input" label="Input" disabled>Raw input</div>
      <div slot="preview" label="Preview">Rendered preview</div>
    </lr-tabs>
  `)) as LyraTabs;
  expect(el.active).to.equal("preview");
});

it("honors an explicit active attribute that points at a valid, enabled tab", async () => {
  const el = (await fixture(html`
    <lr-tabs active="settings">
      <div slot="input" label="Input">Raw input</div>
      <div slot="preview" label="Preview">Rendered preview</div>
      <div slot="settings" label="Settings">Settings form</div>
    </lr-tabs>
  `)) as LyraTabs;
  expect(el.active).to.equal("settings");
  expect(panels(el)[2].hidden).to.be.false;
});

it("falls back to the first enabled tab when active points at a disabled or unknown tab", async () => {
  const el = (await fixture(html`
    <lr-tabs active="preview">
      <div slot="input" label="Input">Raw input</div>
      <div slot="preview" label="Preview" disabled>Rendered preview</div>
      <div slot="settings" label="Settings">Settings form</div>
    </lr-tabs>
  `)) as LyraTabs;
  expect(el.active).to.equal("input");

  el.active = "does-not-exist";
  await el.updateComplete;
  expect(el.active).to.equal("input");
});

it("ArrowRight moves focus and selection to the next tab, wrapping from the last back to the first", async () => {
  const el = (await fixture(basic())) as LyraTabs;
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
  const el = (await fixture(basic())) as LyraTabs;
  press(tabButtons(el)[0], "ArrowLeft");
  await el.updateComplete;
  expect(el.active).to.equal("settings");
});

it("ArrowRight skips a disabled tab", async () => {
  const el = (await fixture(html`
    <lr-tabs>
      <div slot="input" label="Input">Raw input</div>
      <div slot="preview" label="Preview" disabled>Rendered preview</div>
      <div slot="settings" label="Settings">Settings form</div>
    </lr-tabs>
  `)) as LyraTabs;
  press(tabButtons(el)[0], "ArrowRight");
  await el.updateComplete;
  expect(el.active).to.equal("settings");
});

it('swaps ArrowLeft/ArrowRight under dir="rtl", matching lr-split/lr-tree physical-direction handling', async () => {
  const el = (await fixture(html`
    <lr-tabs dir="rtl">
      <div slot="input" label="Input">Raw input</div>
      <div slot="preview" label="Preview">Rendered preview</div>
      <div slot="settings" label="Settings">Settings form</div>
    </lr-tabs>
  `)) as LyraTabs;
  const buttons = tabButtons(el);

  press(buttons[0], "ArrowLeft");
  await el.updateComplete;
  expect(el.active).to.equal("preview");

  press(tabButtons(el)[1], "ArrowRight");
  await el.updateComplete;
  expect(el.active).to.equal("input");
});

it("Home and End jump to the first and last enabled tabs", async () => {
  const el = (await fixture(basic())) as LyraTabs;
  const buttons = tabButtons(el);

  press(buttons[1], "End");
  await el.updateComplete;
  expect(el.active).to.equal("settings");

  press(tabButtons(el)[2], "Home");
  await el.updateComplete;
  expect(el.active).to.equal("input");
});

it("emits lr-tabs-change on keyboard-driven activation too", async () => {
  const el = (await fixture(basic())) as LyraTabs;
  const listener = oneEvent(el, "lr-tabs-change");
  press(tabButtons(el)[0], "ArrowRight");
  const event = await listener;
  expect((event as CustomEvent<{ tabId: string }>).detail).to.deep.equal({
    tabId: "preview",
  });
});

it('a direct-child sibling with slot="<id>-icon" renders as that tab\'s leading icon, hidden from its accessible name', async () => {
  const el = (await fixture(html`
    <lr-tabs>
      <span slot="input-icon" aria-hidden="true">🔥</span>
      <div slot="input" label="Input">Raw input</div>
      <div slot="preview" label="Preview">Rendered preview</div>
    </lr-tabs>
  `)) as LyraTabs;
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
  const el = (await fixture(basic())) as LyraTabs;
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
  const el = (await fixture(basic())) as LyraTabs;
  const child = el.querySelector('[slot="preview"]')!;
  child.setAttribute("disabled", "");

  await aTimeout(0);
  await el.updateComplete;

  const buttons = tabButtons(el);
  expect(buttons[1].getAttribute("aria-disabled")).to.equal("true");
});

it("a mutation on a nested descendant (not a direct child) never forces a tabs recompute", async () => {
  const el = (await fixture(html`
    <lr-tabs>
      <div slot="input" label="Input"><button disabled>nested</button></div>
      <div slot="preview" label="Preview">Rendered preview</div>
    </lr-tabs>
  `)) as LyraTabs;
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
  const el = (await fixture(basic())) as LyraTabs;
  expect(el.active).to.equal("input");
  el.querySelector('[slot="input"]')!.remove();

  await aTimeout(0);
  await el.updateComplete;

  expect(el.active).to.equal("preview");
  expect(tabButtons(el).length).to.equal(2);
});

it("keeps real keyboard focus on the active tab when a tab BEFORE it is removed", async () => {
  const el = (await fixture(basic())) as LyraTabs;
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
  const el = (await fixture(basic())) as LyraTabs;
  const tablist = el.shadowRoot!.querySelector('[role="tablist"]')!;
  expect(tablist.hasAttribute("aria-label")).to.be.false;

  el.setAttribute("aria-label", "Editor views");
  await el.updateComplete;
  expect(el.accessibleLabel).to.equal("Editor views");
  expect(tablist.getAttribute("aria-label")).to.equal("Editor views");
});

it("does not steal focus by reassigning it when the invalid-active correction happens with focus elsewhere", async () => {
  const el = (await fixture(basic())) as LyraTabs;
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
    el: LyraTabs,
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

  async function themed(style: string): Promise<LyraTabs> {
    const wrapper = (await fixture(
      html`<div style=${style}>${basic()}</div>`
    )) as HTMLElement;
    const el = wrapper.querySelector("lr-tabs") as LyraTabs;
    await el.updateComplete;
    return el;
  }

  const overrides =
    "--lr-tabs-selected-color: rgb(0, 51, 102); --lr-tabs-indicator-color: rgb(0, 102, 51);";

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
      "var(--lr-tabs-hover-color, var(--lr-color-text))"
    );
    expect(hover.cssText).to.not.include("selected");
    expect(hover.cssText).to.not.include("indicator");
    expect(
      resolvedInShadow(el, "color: var(--lr-color-text)", "color")
    ).to.equal(
      resolvedInShadow(
        el,
        "color: var(--lr-tabs-hover-color, var(--lr-color-text))",
        "color"
      )
    );
  });

  it("recolors the hover treatment on its own, without touching the selected tab", async () => {
    const el = await themed("--lr-tabs-hover-color: rgb(7, 8, 9);");
    const selected = tabButtons(el)[0]!;
    const brand = resolvedInShadow(el, "color: var(--lr-color-brand)", "color");
    expect(getComputedStyle(selected).color).to.equal(brand);
    expect(getComputedStyle(selected).borderBlockEndColor).to.equal(brand);
    expect(
      resolvedInShadow(
        el,
        "color: var(--lr-tabs-hover-color, var(--lr-color-text))",
        "color"
      )
    ).to.equal("rgb(7, 8, 9)");
  });

  it("renders identically to the pre-cssprop output when every prop is unset", async () => {
    const el = (await fixture(basic())) as LyraTabs;
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
