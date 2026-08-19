import {
  fixture,
  expect,
  oneEvent,
  html,
  aTimeout,
  waitUntil,
} from "@open-wc/testing";
import "./tab-group.js";
import "./tab.js";
import "./tab-panel.js";
import type { LyraTabGroup } from "./tab-group.js";
import type { LyraTab } from "./tab.js";
import type { LyraTabPanel } from "./tab-panel.js";
import { styles } from "./tab-group.styles.js";
import { resetMouse, sendMouse } from "../../../../test/wtr-mouse.js";
import { setForcedColors } from "../../../../test/wtr-media.js";

const basic = () => html`
  <lr-tab-group>
    <lr-tab panel="input">Input</lr-tab>
    <lr-tab panel="preview">Preview</lr-tab>
    <lr-tab panel="settings">Settings</lr-tab>
    <lr-tab-panel name="input">Raw input</lr-tab-panel>
    <lr-tab-panel name="preview">Rendered preview</lr-tab-panel>
    <lr-tab-panel name="settings">Settings form</lr-tab-panel>
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

async function moveMouseTo(target: HTMLElement): Promise<void> {
  target.scrollIntoView({ block: "center", inline: "center" });
  await nextFrames();
  const rect = target.getBoundingClientRect();
  await sendMouse({
    type: "move",
    position: [
      Math.round(rect.left + rect.width / 2),
      Math.round(rect.top + rect.height / 2),
    ],
  });
  await new Promise((resolve) => requestAnimationFrame(resolve));
}

it("never scrolls vertically -- overflow-x:auto alone lets the y axis compute to auto too, which can show a phantom scrollbar", async () => {
  const el = (await fixture(basic())) as LyraTabGroup;
  const tablist = el.shadowRoot!.querySelector(
    '[part~="tablist"]'
  ) as HTMLElement;
  expect(getComputedStyle(tablist).overflowY).to.equal("hidden");
});

it("declares a themeable edge fade, gated on the tablist overflowing", () => {
  const css = styles.cssText.replace(/\s+/g, " ").replaceAll('"', "'");
  expect(css).to.include("-webkit-mask-image: linear-gradient");
  expect(css).to.include("mask-image: linear-gradient");
  expect(css).to.include("var(--lr-scroll-fade-size)");
  // The gradient must live behind the overflow gate, never on the bare [part~='tablist'] rule.
  // The per-edge conditions sit inside :where() so they cannot outrank the forced-colors override
  // below -- see the computed-style test that follows, which is what actually proves the cascade.
  expect(css).to.include("[part~='tablist'][data-scroll-overflow]:where(");
  expect(css).to.include("@media (forced-colors: active)");
  expect(css).to.include("mask-image: none");
});

it("actually renders no mask under forced colors, in both LTR and RTL, while only one logical edge is reachable", async () => {
  // The stylesheet-text assertions above cannot catch a specificity regression: they prove the
  // forced-colors override EXISTS, not that it WINS. Before the :where()-wrapping, the one-sided
  // mask rules carried four attribute selectors against the override's two, so the gradient mask
  // stayed painted under forced-colors -- erasing tab labels in exactly the high-contrast mode
  // that exists to make them legible. Assert the real computed style, not the source text.
  try {
    await setForcedColors("active");
    for (const direction of ["ltr", "rtl"] as const) {
      const el = (await fixture(html`
        <lr-tab-group dir=${direction} style="display: block; max-inline-size: 90px">
          <lr-tab panel="input">Raw input document</lr-tab>
          <lr-tab panel="preview">Rendered preview pane</lr-tab>
          <lr-tab panel="settings">Settings and preferences</lr-tab>
          <lr-tab-panel name="input">Input</lr-tab-panel>
          <lr-tab-panel name="preview">Preview</lr-tab-panel>
          <lr-tab-panel name="settings">Settings</lr-tab-panel>
        </lr-tab-group>
      `)) as LyraTabGroup;
      const tablist = el.shadowRoot!.querySelector(
        '[part~="tablist"]'
      ) as HTMLElement;
      await nextFrames();
      expect(
        tablist.hasAttribute("data-scroll-overflow"),
        `${direction} sanity: tablist overflows`
      ).to.be.true;
      // Only one logical edge is reachable at the initial unscrolled position -- precisely the
      // state whose one-sided selector used to outrank the forced-colors override.
      expect(
        tablist.hasAttribute("data-scroll-end"),
        `${direction} sanity: one-sided scroll state`
      ).to.be.true;
      expect(
        getComputedStyle(tablist).maskImage,
        `${direction} forced-colors mask`
      ).to.equal("none");
    }
  } finally {
    await setForcedColors("none");
  }
});

it("applies the edge fade once the tablist actually overflows", async () => {
  const el = (await fixture(html`
    <lr-tab-group style="display: block; max-inline-size: 90px">
      <lr-tab panel="input">Raw input document</lr-tab>
      <lr-tab panel="preview">Rendered preview pane</lr-tab>
      <lr-tab panel="settings">Settings and preferences</lr-tab>
      <lr-tab-panel name="input">Raw input</lr-tab-panel>
      <lr-tab-panel name="preview">Rendered preview</lr-tab-panel>
      <lr-tab-panel name="settings">Settings form</lr-tab-panel>
    </lr-tab-group>
  `)) as LyraTabGroup;
  const tablist = el.shadowRoot!.querySelector(
    '[part~="tablist"]'
  ) as HTMLElement;
  await nextFrames();
  expect(tablist.scrollWidth).to.be.greaterThan(tablist.clientWidth);
  expect(getComputedStyle(tablist).maskImage).to.contain("linear-gradient");
});

it("leaves a tablist that fits completely unmasked", async () => {
  // The regression this guards: the fade used to be painted unconditionally, dimming the first
  // and last tab of a row with nothing to scroll to.
  const el = (await fixture(basic())) as LyraTabGroup;
  const tablist = el.shadowRoot!.querySelector(
    '[part~="tablist"]'
  ) as HTMLElement;
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
      <lr-tab panel="input">Raw input document</lr-tab>
      <lr-tab panel="preview">Rendered preview pane</lr-tab>
      <lr-tab panel="settings">Settings and preferences</lr-tab>
      <lr-tab-panel name="input">Raw input</lr-tab-panel>
      <lr-tab-panel name="preview">Rendered preview</lr-tab-panel>
      <lr-tab-panel name="settings">Settings form</lr-tab-panel>
    </lr-tab-group>
  `)) as LyraTabGroup;
  const tablist = el.shadowRoot!.querySelector(
    '[part~="tablist"]'
  ) as HTMLElement;
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
  const el = (await fixture(
    html`<lr-tab-group></lr-tab-group>`
  )) as LyraTabGroup;
  expect(tabButtons(el).length).to.equal(0);
  await expect(el).to.be.accessible();
});

it("is accessible with populated tabs", async () => {
  const el = (await fixture(basic())) as LyraTabGroup;
  await expect(el).to.be.accessible();
});

it("builds one tab per canonical descriptor, defaulting active to the first", async () => {
  const el = (await fixture(basic())) as LyraTabGroup;
  const buttons = tabButtons(el);
  expect(buttons.map((b) => b.getAttribute("aria-label"))).to.deep.equal([
    "Input",
    "Preview",
    "Settings",
  ]);
  expect(el.active).to.equal("input");
  expect(buttons[0].getAttribute("aria-selected")).to.equal("true");
  expect(buttons[1].getAttribute("aria-selected")).to.equal("false");
});

it("an unpaired panel never produces a tab or rendered panel", async () => {
  const el = (await fixture(html`
    <lr-tab-group>
      <lr-tab panel="input">Input</lr-tab>
      <lr-tab-panel name="input">Raw input</lr-tab-panel>
      <lr-tab-panel name="preview">Unpaired panel</lr-tab-panel>
    </lr-tab-group>
  `)) as LyraTabGroup;
  const buttons = tabButtons(el);
  expect(buttons.length).to.equal(1);
  expect(panels(el).length).to.equal(1);
  const unpaired = el.querySelector(
    'lr-tab-panel[name="preview"]'
  ) as HTMLElement;
  expect(unpaired.slot).to.equal("");
  expect(unpaired.assignedSlot?.name).to.equal("");
  expect(el.defaultSlot.hidden).to.equal(true);
});

it("a plain slot/label child produces no tab and no rendered panel", async () => {
  // The pre-9.0 `<div slot="x" label="…">` attribute model was removed in 9.0.0; only
  // `<lr-tab>`/`<lr-tab-panel>` pairs build tabs. This locks that truth so the removal cannot
  // drift back into being documented as supported (README once promised it still worked).
  const el = (await fixture(html`
    <lr-tab-group>
      <div slot="general" label="General">General settings</div>
      <div slot="danger" label="Danger">Danger zone</div>
    </lr-tab-group>
  `)) as LyraTabGroup;
  expect(tabButtons(el).length).to.equal(0);
  expect(panels(el).length).to.equal(0);
  await expect(el).to.be.accessible();
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

it("uses opaque ARIA ids when a public panel name contains whitespace or selector syntax", async () => {
  const panelName = 'tab with spaces"[data-hostile]';
  const el = (await fixture(html`
    <lr-tab-group>
      <lr-tab panel=${panelName}>Hostile</lr-tab>
      <lr-tab-panel name=${panelName}>Content</lr-tab-panel>
    </lr-tab-group>
  `)) as LyraTabGroup;
  const tab = tabButtons(el)[0];
  const panel = panels(el)[0];
  expect(tab.id).to.match(/^lr-tab-group-\d+-\d+-tab$/);
  expect(panel.id).to.match(/^lr-tab-group-\d+-\d+-panel$/);
  expect(tab.id).to.not.include(panelName);
  expect(tab.getAttribute("aria-controls")).to.equal(panel.id);
  expect(panel.getAttribute("aria-labelledby")).to.equal(tab.id);
});

it("clicking a tab activates it and fires lr-tab-show with only the canonical name", async () => {
  const el = (await fixture(basic())) as LyraTabGroup;
  const listener = oneEvent(el, "lr-tab-show");
  tabButtons(el)[1].click();
  const event = await listener;
  expect((event as CustomEvent<{ name: string }>).detail).to.deep.equal({
    name: "preview",
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

it("a disabled descriptor renders its tab, but clicking it never activates it", async () => {
  const el = (await fixture(html`
    <lr-tab-group>
      <lr-tab panel="input">Input</lr-tab>
      <lr-tab panel="preview" disabled>Preview</lr-tab>
      <lr-tab-panel name="input">Raw input</lr-tab-panel>
      <lr-tab-panel name="preview">Rendered preview</lr-tab-panel>
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
      <lr-tab panel="input" disabled>Input</lr-tab>
      <lr-tab panel="preview">Preview</lr-tab>
      <lr-tab-panel name="input">Raw input</lr-tab-panel>
      <lr-tab-panel name="preview">Rendered preview</lr-tab-panel>
    </lr-tab-group>
  `)) as LyraTabGroup;
  expect(el.active).to.equal("preview");
});

it("honors an explicit active attribute that points at a valid, enabled tab", async () => {
  const el = (await fixture(html`
    <lr-tab-group active="settings">
      <lr-tab panel="input">Input</lr-tab>
      <lr-tab panel="preview">Preview</lr-tab>
      <lr-tab panel="settings">Settings</lr-tab>
      <lr-tab-panel name="input">Raw input</lr-tab-panel>
      <lr-tab-panel name="preview">Rendered preview</lr-tab-panel>
      <lr-tab-panel name="settings">Settings form</lr-tab-panel>
    </lr-tab-group>
  `)) as LyraTabGroup;
  expect(el.active).to.equal("settings");
  expect(panels(el)[2].hidden).to.be.false;
});

it("falls back to the first enabled tab when active points at a disabled or unknown tab", async () => {
  const el = (await fixture(html`
    <lr-tab-group active="preview">
      <lr-tab panel="input">Input</lr-tab>
      <lr-tab panel="preview" disabled>Preview</lr-tab>
      <lr-tab panel="settings">Settings</lr-tab>
      <lr-tab-panel name="input">Raw input</lr-tab-panel>
      <lr-tab-panel name="preview">Rendered preview</lr-tab-panel>
      <lr-tab-panel name="settings">Settings form</lr-tab-panel>
    </lr-tab-group>
  `)) as LyraTabGroup;
  expect(el.active).to.equal("input");

  el.active = "does-not-exist";
  await el.updateComplete;
  expect(el.active).to.equal("input");
});

it("leaves an all-unavailable tablist without a roving target or keyboard side effects", async () => {
  const el = (await fixture(html`
    <lr-tab-group>
      <lr-tab panel="disabled" disabled>Disabled</lr-tab>
      <lr-tab panel="inert" inert>Inert</lr-tab>
      <lr-tab-panel name="disabled">Disabled panel</lr-tab-panel>
      <lr-tab-panel name="inert">Inert panel</lr-tab-panel>
    </lr-tab-group>
  `)) as LyraTabGroup;
  await el.updateComplete;
  const tablist =
    el.shadowRoot!.querySelector<HTMLElement>('[part~="tablist"]')!;
  const event = new KeyboardEvent("keydown", {
    key: "ArrowRight",
    bubbles: true,
    cancelable: true,
    composed: true,
  });
  let changes = 0;
  el.addEventListener("lr-tab-show", () => changes++);

  tablist.dispatchEvent(event);
  await el.updateComplete;

  expect(el.active).to.equal("");
  expect(tabButtons(el).map((button) => button.tabIndex)).to.deep.equal([
    -1, -1,
  ]);
  expect(event.defaultPrevented).to.equal(false);
  expect(changes).to.equal(0);
});

it("ArrowRight moves focus and selection to the next tab, wrapping from the last back to the first", async () => {
  const el = (await fixture(basic())) as LyraTabGroup;
  const buttons = tabButtons(el);

  press(buttons[0], "ArrowRight");
  await el.updateComplete;
  expect(el.active).to.equal("preview");
  expect(el.shadowRoot!.activeElement === tabButtons(el)[1]).to.equal(true);

  press(tabButtons(el)[1], "ArrowRight");
  await el.updateComplete;
  expect(el.active).to.equal("settings");

  press(tabButtons(el)[2], "ArrowRight");
  await el.updateComplete;
  expect(el.active).to.equal("input");
});

it("starts arrow navigation from the event-target tab after a controlled active change", async () => {
  const el = (await fixture(basic())) as LyraTabGroup;
  tabButtons(el)[1]!.focus();
  el.active = "settings";
  await el.updateComplete;

  press(tabButtons(el)[1]!, "ArrowRight");
  await el.updateComplete;

  expect(el.active).to.equal("settings");
  expect(el.shadowRoot!.activeElement === tabButtons(el)[2]).to.equal(true);
});

it("uses a directly dispatched tab event ahead of remembered roving state", async () => {
  const el = (await fixture(basic())) as LyraTabGroup;
  press(tabButtons(el)[2]!, "ArrowRight");
  await el.updateComplete;

  expect(el.active).to.equal("input");
  expect(el.shadowRoot!.activeElement === tabButtons(el)[0]).to.equal(true);
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
      <lr-tab panel="input">Input</lr-tab>
      <lr-tab panel="preview" disabled>Preview</lr-tab>
      <lr-tab panel="settings">Settings</lr-tab>
      <lr-tab-panel name="input">Raw input</lr-tab-panel>
      <lr-tab-panel name="preview">Rendered preview</lr-tab-panel>
      <lr-tab-panel name="settings">Settings form</lr-tab-panel>
    </lr-tab-group>
  `)) as LyraTabGroup;
  press(tabButtons(el)[0], "ArrowRight");
  await el.updateComplete;
  expect(el.active).to.equal("settings");
});

it('swaps ArrowLeft/ArrowRight under dir="rtl", matching lr-multi-split/lr-tree physical-direction handling', async () => {
  const el = (await fixture(html`
    <lr-tab-group dir="rtl">
      <lr-tab panel="input">Input</lr-tab>
      <lr-tab panel="preview">Preview</lr-tab>
      <lr-tab panel="settings">Settings</lr-tab>
      <lr-tab-panel name="input">Raw input</lr-tab-panel>
      <lr-tab-panel name="preview">Rendered preview</lr-tab-panel>
      <lr-tab-panel name="settings">Settings form</lr-tab-panel>
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
  expect((event as CustomEvent<{ name: string }>).detail).to.deep.equal({
    name: "preview",
  });
});

it("picks up a tab added dynamically after connect", async () => {
  const el = (await fixture(basic())) as LyraTabGroup;
  const extraTab = document.createElement("lr-tab");
  extraTab.panel = "extra";
  extraTab.textContent = "Extra";
  const extraPanel = document.createElement("lr-tab-panel");
  extraPanel.name = "extra";
  extraPanel.textContent = "Extra content";
  el.append(extraTab, extraPanel);

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
  const child = el.querySelector('lr-tab[panel="preview"]')!;
  child.setAttribute("disabled", "");

  await aTimeout(0);
  await el.updateComplete;

  const buttons = tabButtons(el);
  expect(buttons[1].getAttribute("aria-disabled")).to.equal("true");
});

it("a mutation on a nested descendant (not a direct child) never forces a tabs recompute", async () => {
  const el = (await fixture(html`
    <lr-tab-group>
      <lr-tab panel="input">Input</lr-tab>
      <lr-tab panel="preview">Preview</lr-tab>
      <lr-tab-panel name="input"><button disabled>nested</button></lr-tab-panel>
      <lr-tab-panel name="preview">Rendered preview</lr-tab-panel>
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

  // Both mutations are in the observer's broad native coverage, but the
  // button is a panel grandchild, not a direct <lr-tab> child. A panel is
  // free to churn its own content without the tabs strip resyncing/re-
  // rendering on every unrelated mutation.
  const nested = el.querySelector("button")!;
  nested.removeAttribute("disabled");

  await aTimeout(50);
  expect(updateCount).to.equal(0);

  nested.firstChild!.textContent = "changed";
  await aTimeout(50);
  expect(updateCount).to.equal(0);
});

it("reassigns active when the currently-active child is removed", async () => {
  const el = (await fixture(basic())) as LyraTabGroup;
  expect(el.active).to.equal("input");
  el.querySelector('lr-tab[panel="input"]')!.remove();

  await aTimeout(0);
  await el.updateComplete;

  expect(el.active).to.equal("preview");
  expect(tabButtons(el).length).to.equal(2);
});

it("rehomes focus when the focused active tab is removed", async () => {
  const el = (await fixture(basic())) as LyraTabGroup;
  tabButtons(el)[0].focus();
  el.querySelector('lr-tab[panel="input"]')!.remove();

  await aTimeout(0);
  await el.updateComplete;

  const focused = el.shadowRoot!.activeElement as HTMLElement | null;
  expect(el.active).to.equal("preview");
  expect(focused?.dataset["slot"]).to.equal("preview");
  expect(focused?.tabIndex).to.equal(0);
});

it("ArrowRight steps past an inert tab, which never holds the roving tabindex", async () => {
  const el = (await fixture(html`
    <lr-tab-group>
      <lr-tab panel="input">Input</lr-tab>
      <lr-tab panel="preview" inert>Preview</lr-tab>
      <lr-tab panel="settings">Settings</lr-tab>
      <lr-tab-panel name="input">Raw input</lr-tab-panel>
      <lr-tab-panel name="preview">Rendered preview</lr-tab-panel>
      <lr-tab-panel name="settings">Settings form</lr-tab-panel>
    </lr-tab-group>
  `)) as LyraTabGroup;
  const buttons = tabButtons(el);
  // The button standing in for inert content is itself inert, so it refuses focus outright --
  // which is exactly why arrow navigation must never step onto it.
  expect(buttons[0].inert).to.be.false;
  expect(buttons[1].inert).to.be.true;
  expect(buttons[1].getAttribute("tabindex")).to.equal("-1");

  press(buttons[0], "ArrowRight");
  await el.updateComplete;
  expect(el.active).to.equal("settings");

  press(tabButtons(el)[2], "ArrowLeft");
  await el.updateComplete;
  expect(el.active).to.equal("input");

  press(tabButtons(el)[0], "End");
  await el.updateComplete;
  expect(el.active).to.equal("settings");
});

it("recognizes an inert tab created in an adopted owner realm", async () => {
  const frame = (await fixture(html`<iframe></iframe>`)) as HTMLIFrameElement;
  const frameDocument = frame.contentDocument!;
  const el = (await fixture(html`
    <lr-tab-group>
      <lr-tab panel="first">First</lr-tab>
      <lr-tab panel="last">Last</lr-tab>
      <lr-tab-panel name="first">First panel</lr-tab-panel>
      <lr-tab-panel name="last">Last panel</lr-tab-panel>
    </lr-tab-group>
  `)) as LyraTabGroup;
  const inert = frameDocument.createElement("lr-tab");
  inert.setAttribute("panel", "inert");
  inert.textContent = "Inert";
  inert.inert = true;

  try {
    el.insertBefore(inert, el.querySelector('lr-tab[panel="last"]'));
    expect(inert.ownerDocument === el.ownerDocument).to.equal(true);
    await nextFrames();
    await el.updateComplete;
    const buttons = tabButtons(el);
    expect(buttons.map((button) => button.inert)).to.deep.equal([
      false,
      true,
      false,
    ]);
    press(buttons[0]!, "ArrowRight");
    await el.updateComplete;
    expect(el.active).to.equal("last");
  } finally {
    el.remove();
    frame.remove();
  }
});

it("binds its child observer to the adopted owner and rejects the retired callback", async () => {
  interface ObserverRecord {
    callback: MutationCallback;
    disconnects: number;
    instance: MutationObserver;
  }
  const el = (await fixture(basic())) as LyraTabGroup;
  await el.updateComplete;
  el.remove();
  const frame = document.createElement("iframe");
  document.body.append(frame);
  const frameDocument = frame.contentDocument!;
  const frameWindow = frame.contentWindow!;
  const originalObserver = frameWindow.MutationObserver;
  const records: ObserverRecord[] = [];
  class OwnerMutationObserver implements MutationObserver {
    private readonly record: ObserverRecord;
    constructor(callback: MutationCallback) {
      this.record = { callback, disconnects: 0, instance: this };
      records.push(this.record);
    }
    observe(): void {}
    disconnect(): void {
      this.record.disconnects += 1;
    }
    takeRecords(): MutationRecord[] {
      return [];
    }
  }
  frameWindow.MutationObserver = OwnerMutationObserver;

  try {
    frameDocument.body.append(frameDocument.adoptNode(el));
    const ownedInstance = (
      el as unknown as { mutationObserver?: MutationObserver }
    ).mutationObserver;
    const adoptedObserver = records.find(
      (record) => record.instance === ownedInstance
    );
    expect(
      adoptedObserver !== undefined,
      "the destination window constructs the child observer"
    ).to.equal(true);
    let staleSyncs = 0;
    (el as unknown as { syncTabs: () => void }).syncTabs = () => {
      staleSyncs += 1;
    };

    el.remove();
    expect(
      adoptedObserver!.disconnects,
      "disconnect retires the destination observer"
    ).to.equal(1);
    adoptedObserver!.callback(
      [{ type: "childList", target: el } as MutationRecord],
      {} as MutationObserver
    );
    expect(
      staleSyncs,
      "a retired owner callback cannot resync while detached"
    ).to.equal(0);
  } finally {
    el.remove();
    frameWindow.MutationObserver = originalObserver;
    if (el.ownerDocument !== document) document.adoptNode(el);
    frame.remove();
  }
});

it("never activates an inert tab, and skips it when resolving the default active tab", async () => {
  const el = (await fixture(html`
    <lr-tab-group>
      <lr-tab panel="input" inert>Input</lr-tab>
      <lr-tab panel="preview">Preview</lr-tab>
      <lr-tab-panel name="input">Raw input</lr-tab-panel>
      <lr-tab-panel name="preview">Rendered preview</lr-tab-panel>
    </lr-tab-group>
  `)) as LyraTabGroup;
  expect(el.active).to.equal("preview");

  let fired = false;
  el.addEventListener("lr-tab-show", () => (fired = true));
  el.show("input");
  await el.updateComplete;
  expect(fired).to.be.false;
  expect(el.active).to.equal("preview");
});

it("rehomes focus when the focused active tab becomes inert", async () => {
  const el = (await fixture(basic())) as LyraTabGroup;
  tabButtons(el)[0].focus();
  (el.querySelector('lr-tab[panel="input"]') as HTMLElement).inert = true;

  await aTimeout(0);
  await el.updateComplete;

  const focused = el.shadowRoot!.activeElement as HTMLElement | null;
  expect(el.active).to.equal("preview");
  expect(focused?.dataset["slot"]).to.equal("preview");
  expect(focused?.tabIndex).to.equal(0);
});

it("leaves selection and panels alone when an ancestor inerts the whole group", async () => {
  const wrapper = (await fixture(html`
    <div>
      <lr-tab-group>
        <lr-tab panel="input">Input</lr-tab>
        <lr-tab panel="preview">Preview</lr-tab>
        <lr-tab-panel name="input">Raw input</lr-tab-panel>
        <lr-tab-panel name="preview">Rendered preview</lr-tab-panel>
      </lr-tab-group>
    </div>
  `)) as HTMLElement;
  const el = wrapper.querySelector("lr-tab-group") as LyraTabGroup;
  await el.updateComplete;
  expect(el.active).to.equal("input");

  // A modal inerting the page behind it must not blank every panel: uniform inertness needs no
  // per-tab handling, since focus cannot be inside the group at all.
  wrapper.inert = true;
  await aTimeout(0);
  await el.updateComplete;

  expect(el.active).to.equal("input");
  expect(tabButtons(el)[0].inert).to.be.false;
  expect(panels(el)[0].hasAttribute("hidden")).to.be.false;
});

it("rehomes focus when the focused active tab becomes disabled", async () => {
  const el = (await fixture(basic())) as LyraTabGroup;
  tabButtons(el)[0].focus();
  el.querySelector('lr-tab[panel="input"]')!.setAttribute("disabled", "");

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
  expect(el.shadowRoot!.activeElement === tabButtons(el)[1]).to.equal(true);

  el.querySelector('lr-tab[panel="input"]')!.remove();
  await aTimeout(0);
  await el.updateComplete;

  const focused = el.shadowRoot!.activeElement as HTMLButtonElement | null;
  expect(el.active).to.equal("preview");
  expect(focused?.dataset.slot).to.equal("preview");
  expect(focused?.getAttribute("aria-selected")).to.equal("true");
});

it('forwards a host aria-label to the role="tablist" element by presence', async () => {
  const el = (await fixture(basic())) as LyraTabGroup;
  const tablist = el.shadowRoot!.querySelector('[role="tablist"]')!;
  expect(tablist.hasAttribute("aria-label")).to.be.false;

  el.setAttribute("aria-label", "Editor views");
  await el.updateComplete;
  expect(el.accessibleLabel).to.equal("Editor views");
  expect(tablist.getAttribute("aria-label")).to.equal("Editor views");

  el.setAttribute("aria-label", "");
  await el.updateComplete;
  expect(tablist.hasAttribute("aria-label")).to.equal(true);
  expect(tablist.getAttribute("aria-label")).to.equal("");

  el.removeAttribute("aria-label");
  await el.updateComplete;
  expect(tablist.hasAttribute("aria-label")).to.equal(false);

  el.accessibleLabel = "";
  await el.updateComplete;
  expect(tablist.hasAttribute("aria-label")).to.equal(true);
  expect(tablist.getAttribute("aria-label")).to.equal("");

  el.accessibleLabel = null;
  await el.updateComplete;
  expect(tablist.hasAttribute("aria-label")).to.equal(false);
});

it("does not steal focus by reassigning it when the invalid-active correction happens with focus elsewhere", async () => {
  const el = (await fixture(basic())) as LyraTabGroup;
  const outside = document.createElement("button");
  document.body.appendChild(outside);
  outside.focus();

  el.querySelector('lr-tab[panel="input"]')!.remove();

  await aTimeout(0);
  await el.updateComplete;

  expect(el.active).to.equal("preview");
  expect(document.activeElement === outside).to.equal(true);
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
    el.style.setProperty("--lr-transition-fast", "0ms");
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

  it("inherits independent pressed-tab longhands without recoloring the selected sibling", async () => {
    const el = await themed(
      "--lr-tab-group-active-bg: rgb(1, 2, 3); --lr-tab-group-active-color: rgb(4, 5, 6);"
    );
    const [selected, pressed] = tabButtons(el);

    try {
      await resetMouse();
      await moveMouseTo(pressed!);
      await sendMouse({ type: "down" });
      await new Promise((resolve) => requestAnimationFrame(resolve));
      expect(getComputedStyle(pressed!).backgroundColor).to.equal(
        "rgb(1, 2, 3)"
      );
      expect(getComputedStyle(pressed!).color).to.equal("rgb(4, 5, 6)");
      expect(getComputedStyle(selected!).backgroundColor).to.equal(
        "rgba(0, 0, 0, 0)"
      );
      expect(getComputedStyle(selected!).color).to.equal(
        resolvedInShadow(el, "color: var(--lr-color-brand)", "color")
      );
    } finally {
      await resetMouse();
    }
  });

  it("retains the existing pressed-tab rendering when its new props are unset", async () => {
    const el = await themed("");
    const pressed = tabButtons(el)[1]!;

    try {
      await resetMouse();
      await moveMouseTo(pressed);
      await sendMouse({ type: "down" });
      await new Promise((resolve) => requestAnimationFrame(resolve));
      expect(getComputedStyle(pressed).backgroundColor).to.equal(
        resolvedInShadow(
          el,
          "background: color-mix(in oklab, transparent, var(--lr-color-mix-partner) var(--lr-color-mix-active))",
          "background-color"
        )
      );
      expect(getComputedStyle(pressed).color).to.equal(
        resolvedInShadow(
          el,
          "color: var(--lr-tab-group-hover-color, var(--lr-color-text))",
          "color"
        )
      );
    } finally {
      await resetMouse();
    }
  });

  it("themes scroll-control hover and pressed longhands independently from tabs", async () => {
    const el = await crowded(
      "--lr-tab-group-scroll-button-hover-color: rgb(7, 8, 9);" +
        "--lr-tab-group-scroll-button-active-bg: rgb(10, 11, 12);" +
        "--lr-tab-group-scroll-button-active-color: rgb(13, 14, 15);"
    );
    const control = scrollControl(el, "end");
    const tab = tabButtons(el)[0]!;

    try {
      await resetMouse();
      await moveMouseTo(control);
      await waitUntil(
        () => getComputedStyle(control).color === "rgb(7, 8, 9)",
        "scroll-control hover color did not settle"
      );
      expect(getComputedStyle(control).color).to.equal("rgb(7, 8, 9)");
      await sendMouse({ type: "down" });
      // A remote mouse command completing is not a DOM-event or paint barrier in Firefox.
      await waitUntil(() => {
        const computed = getComputedStyle(control);
        return (
          control.hasAttribute("data-pressed") &&
          computed.backgroundColor === "rgb(10, 11, 12)" &&
          computed.color === "rgb(13, 14, 15)"
        );
      }, "scroll-control pressed theme did not settle");
      expect(control.hasAttribute("data-pressed")).to.equal(true);
      expect(getComputedStyle(control).backgroundColor).to.equal(
        "rgb(10, 11, 12)"
      );
      expect(getComputedStyle(control).color).to.equal("rgb(13, 14, 15)");
      expect(getComputedStyle(tab).color).to.equal(
        resolvedInShadow(el, "color: var(--lr-color-brand)", "color")
      );
    } finally {
      await resetMouse();
    }
  });

  it("retains the existing scroll-control hover and pressed rendering when the new props are unset", async () => {
    const el = await crowded();
    const control = scrollControl(el, "end");
    const expectedColor = resolvedInShadow(
      el,
      "color: var(--lr-color-text)",
      "color"
    );
    const expectedBackground = resolvedInShadow(
      el,
      "background: color-mix(in oklab, transparent, var(--lr-color-mix-partner) var(--lr-color-mix-active))",
      "background-color"
    );

    try {
      await resetMouse();
      await moveMouseTo(control);
      await waitUntil(
        () => getComputedStyle(control).color === expectedColor,
        "default scroll-control hover color did not settle"
      );
      expect(getComputedStyle(control).color).to.equal(expectedColor);
      await sendMouse({ type: "down" });
      await waitUntil(() => {
        const computed = getComputedStyle(control);
        return (
          control.hasAttribute("data-pressed") &&
          computed.backgroundColor === expectedBackground &&
          computed.color === expectedColor
        );
      }, "default scroll-control pressed theme did not settle");
      expect(control.hasAttribute("data-pressed")).to.equal(true);
      expect(getComputedStyle(control).backgroundColor).to.equal(
        expectedBackground
      );
      expect(getComputedStyle(control).color).to.equal(expectedColor);
    } finally {
      await resetMouse();
    }
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

it("keeps the first element-model tab when duplicate panel names would share one panel", async () => {
  const el = (await fixture(html`
    <lr-tab-group aria-label="Workspace tabs">
      <lr-tab panel="general" active>General</lr-tab>
      <lr-tab panel="general">Duplicate general</lr-tab>
      <lr-tab-panel name="general">General body</lr-tab-panel>
    </lr-tab-group>
  `)) as LyraTabGroup;
  await el.updateComplete;

  expect(tabButtons(el)).to.have.lengthOf(1);
  expect(panels(el)).to.have.lengthOf(1);
  expect(tabButtons(el)[0]!.dataset["slot"]).to.equal("general");
  expect(tabButtons(el)[0]!.getAttribute("aria-label")).to.equal("General");
  expect(el.active).to.equal("general");
});

it("keeps a populated disabled active closable <lr-tab> accessible on its own tag", async () => {
  const tab = (await fixture(
    html`<lr-tab panel="general" active disabled closable>General</lr-tab>`
  )) as LyraTab;
  await tab.updateComplete;
  expect(
    tab
      .shadowRoot!.querySelector('[part~="close-button"]')
      ?.getAttribute("aria-hidden")
  ).to.equal("true");
  await expect(tab).to.be.accessible();
});

it("keeps active and hidden <lr-tab-panel> instances accessible on their own tags", async () => {
  const active = (await fixture(
    html`<lr-tab-panel name="general" active
      ><button type="button">Save</button></lr-tab-panel
    >`
  )) as LyraTabPanel;
  const hidden = (await fixture(
    html`<lr-tab-panel name="advanced" hidden>Advanced settings</lr-tab-panel>`
  )) as LyraTabPanel;
  await Promise.all([active.updateComplete, hidden.updateComplete]);
  await expect(active).to.be.accessible();
  expect(hidden.hidden).to.equal(true);
  expect(
    hidden.shadowRoot!.querySelector('[part~="base"]')?.localName
  ).to.equal("div");
  await expect(hidden).to.be.accessible();
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

it("keeps rich <lr-tab> content inert while the outer tab retains its flattened accessible name", async () => {
  const wrapper = await fixture<HTMLDivElement>(html`
    <div>
      <button id="outside" type="button">Outside</button>
      <lr-tab-group aria-label="Workspace tabs">
        <lr-tab panel="general">
          <span id="tab-content"
            ><a id="tab-link" href="#details"
              >Rich <strong>tab</strong></a
            ></span
          >
          <span>Workspace</span>
        </lr-tab>
        <lr-tab panel="advanced">Advanced</lr-tab>
        <lr-tab-panel name="general">General body</lr-tab-panel>
        <lr-tab-panel name="advanced">Advanced body</lr-tab-panel>
      </lr-tab-group>
    </div>
  `);
  const el = wrapper.querySelector<LyraTabGroup>("lr-tab-group")!;
  const outside = wrapper.querySelector<HTMLButtonElement>("#outside")!;
  const content = wrapper.querySelector<HTMLElement>("#tab-content")!;
  const link = wrapper.querySelector<HTMLAnchorElement>("#tab-link")!;
  await el.updateComplete;

  expect(content.inert).to.equal(true);
  expect(tabButtons(el)[0]!.getAttribute("aria-label")).to.equal(
    "Rich tab Workspace"
  );
  outside.focus();
  link.focus();
  expect(wrapper.ownerDocument.activeElement?.id).to.equal("outside");
  await expect(el).to.be.accessible();

  link.firstChild!.textContent = "Updated ";
  await aTimeout(0);
  await el.updateComplete;
  expect(tabButtons(el)[0]!.getAttribute("aria-label")).to.equal(
    "Updated tab Workspace"
  );

  content.inert = false;
  await aTimeout(0);
  expect(content.inert).to.equal(true);

  content.slot = "released";
  await aTimeout(0);
  await el.updateComplete;
  expect(content.hasAttribute("inert")).to.equal(false);
  expect(tabButtons(el)[0]!.getAttribute("aria-label")).to.equal("Workspace");

  content.removeAttribute("slot");
  await aTimeout(0);
  await el.updateComplete;
  expect(content.inert).to.equal(true);
  expect(tabButtons(el)[0]!.getAttribute("aria-label")).to.equal(
    "Updated tab Workspace"
  );

  el.querySelector("lr-tab")!.remove();
  await aTimeout(0);
  await el.updateComplete;
  expect(content.hasAttribute("inert")).to.equal(false);
});

it("derives a rich tab name from accessible default-slot content and observes visibility changes", async () => {
  const el = (await fixture(html`
    <lr-tab-group aria-label="Workspace tabs">
      <lr-tab panel="general">
        <span id="visible-label"
          >Visible
          <strong id="visible-suffix" aria-hidden="true">tab</strong></span
        >
        <span aria-hidden="true">Ignored aria-hidden</span>
        <span id="hidden-label" hidden>Ignored hidden</span>
        <span id="styled-hidden-label" style="display: none"
          >Ignored CSS hidden</span
        >
        <span inert>Ignored author inert</span>
        <span id="alternate-label" aria-hidden="true">Alternate label</span>
      </lr-tab>
      <lr-tab-panel name="general">General body</lr-tab-panel>
    </lr-tab-group>
  `)) as LyraTabGroup;
  const alternate = el.querySelector<HTMLElement>("#alternate-label")!;
  const visible = el.querySelector<HTMLElement>("#visible-label")!;
  const visibleSuffix = el.querySelector<HTMLElement>("#visible-suffix")!;
  const hidden = el.querySelector<HTMLElement>("#hidden-label")!;
  const styledHidden = el.querySelector<HTMLElement>("#styled-hidden-label")!;
  await el.updateComplete;

  expect(tabButtons(el)[0]!.getAttribute("aria-label")).to.equal("Visible");
  await expect(el).to.be.accessible();

  alternate.removeAttribute("aria-hidden");
  await aTimeout(0);
  await el.updateComplete;
  expect(tabButtons(el)[0]!.getAttribute("aria-label")).to.equal(
    "Visible Alternate label"
  );

  visibleSuffix.removeAttribute("aria-hidden");
  await aTimeout(0);
  await el.updateComplete;
  expect(tabButtons(el)[0]!.getAttribute("aria-label")).to.equal(
    "Visible tab Alternate label"
  );

  visible.hidden = true;
  hidden.hidden = false;
  await aTimeout(0);
  await el.updateComplete;
  expect(tabButtons(el)[0]!.getAttribute("aria-label")).to.equal(
    "Ignored hidden Alternate label"
  );

  styledHidden.style.display = "";
  await aTimeout(0);
  await el.updateComplete;
  expect(tabButtons(el)[0]!.getAttribute("aria-label")).to.equal(
    "Ignored hidden Ignored CSS hidden Alternate label"
  );
});

it("derives a rich tab name from aria-labelledby and image alternatives", async () => {
  const el = (await fixture(html`
    <lr-tab-group aria-label="Workspace tabs">
      <lr-tab panel="general">
        <span aria-labelledby="tab-semantic-name">Visible fallback</span>
        <span id="tab-semantic-name" hidden
          ><img alt="Settings diagram"
        /></span>
      </lr-tab>
      <lr-tab-panel name="general">General body</lr-tab-panel>
    </lr-tab-group>
  `)) as LyraTabGroup;
  await el.updateComplete;

  expect(tabButtons(el)[0]!.getAttribute("aria-label")).to.equal(
    "Settings diagram"
  );
  el.querySelector("img")!.alt = "Updated settings diagram";
  await aTimeout(0);
  await el.updateComplete;
  expect(tabButtons(el)[0]!.getAttribute("aria-label")).to.equal(
    "Updated settings diagram"
  );
});

it("omits a rich label branch skipped by content-visibility:auto", async () => {
  const el = (await fixture(html`
    <lr-tab-group aria-label="Workspace tabs">
      <lr-tab panel="general">
        <span>Visible label</span>
        <div
          style="content-visibility: auto; contain-intrinsic-size: 100px; position: absolute; inset-block-start: 10000px"
        >
          <span>Deferred label</span>
        </div>
      </lr-tab>
      <lr-tab-panel name="general">General body</lr-tab-panel>
    </lr-tab-group>
  `)) as LyraTabGroup;
  const tab = el.querySelector<HTMLElement>("lr-tab")!;
  const ownerWindow = el.ownerDocument.defaultView!;
  await el.updateComplete;
  await new Promise<void>((resolve) =>
    ownerWindow.requestAnimationFrame(() =>
      ownerWindow.requestAnimationFrame(() => resolve())
    )
  );

  tab.classList.add("refresh-accessible-label");
  await aTimeout(0);
  await el.updateComplete;

  expect(tabButtons(el)[0]!.getAttribute("aria-label")).to.equal(
    "Visible label"
  );
  await expect(el).to.be.accessible();
});

it("keeps a rich tab label when the browser does not expose checkVisibility", async () => {
  const descriptor = Object.getOwnPropertyDescriptor(
    Element.prototype,
    "checkVisibility"
  );
  Object.defineProperty(Element.prototype, "checkVisibility", {
    configurable: true,
    value: undefined,
  });

  try {
    const el = (await fixture(html`
      <lr-tab-group aria-label="Workspace tabs">
        <lr-tab panel="general"><span>Fallback label</span></lr-tab>
        <lr-tab-panel name="general">General body</lr-tab-panel>
      </lr-tab-group>
    `)) as LyraTabGroup;
    await el.updateComplete;

    expect(tabButtons(el)[0]!.getAttribute("aria-label")).to.equal(
      "Fallback label"
    );
  } finally {
    if (descriptor) {
      Object.defineProperty(Element.prototype, "checkVisibility", descriptor);
    } else {
      Reflect.deleteProperty(Element.prototype, "checkVisibility");
    }
  }
});

it("omits closed <details> text from a rich tab name and restores it when opened", async () => {
  const el = (await fixture(html`
    <lr-tab-group aria-label="Workspace tabs">
      <lr-tab panel="general"
        ><details id="tab-details">
          <summary>Summary</summary>
          Hidden details
        </details></lr-tab
      >
      <lr-tab-panel name="general">General body</lr-tab-panel>
    </lr-tab-group>
  `)) as LyraTabGroup;
  const details = el.querySelector<HTMLDetailsElement>("#tab-details")!;
  await el.updateComplete;

  expect(tabButtons(el)[0]!.getAttribute("aria-label")).to.equal("Summary");
  await expect(el).to.be.accessible();

  details.open = true;
  await aTimeout(0);
  await el.updateComplete;
  expect(tabButtons(el)[0]!.getAttribute("aria-label")).to.equal(
    "Summary Hidden details"
  );
});

it("assigns each <lr-tab-panel> the slot that lands it in the matching tabpanel", async () => {
  const el = (await fixture(elementModel())) as LyraTabGroup;
  await el.updateComplete;
  const panel = el.querySelector(
    'lr-tab-panel[name="advanced"]'
  ) as HTMLElement;
  expect(panel.getAttribute("slot")).to.equal("advanced");
  const wrapper = panels(el)[1]!;
  const assigned = (
    wrapper.querySelector("slot") as HTMLSlotElement
  ).assignedElements({ flatten: true });
  expect(assigned.map((node) => node.localName)).to.deep.equal([
    "lr-tab-panel",
  ]);
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
  el.addEventListener("lr-tab-hide", (e) =>
    order.push(`hide:${(e as CustomEvent).detail.name}`)
  );
  el.addEventListener("lr-tab-show", (e) =>
    order.push(`show:${(e as CustomEvent).detail.name}`)
  );
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

it("resyncs post-mount element-model identity mutations through properties and attributes", async () => {
  const el = (await fixture(elementModel())) as LyraTabGroup;
  const tabs = [...el.querySelectorAll<LyraTab>("lr-tab")];
  const tabPanels = [...el.querySelectorAll<LyraTabPanel>("lr-tab-panel")];
  const events: string[] = [];
  el.addEventListener("lr-tab-hide", (event) =>
    events.push(`hide:${(event as CustomEvent<{ name: string }>).detail.name}`)
  );
  el.addEventListener("lr-tab-show", (event) =>
    events.push(`show:${(event as CustomEvent<{ name: string }>).detail.name}`)
  );

  // The active pair uses the public property path; the inactive pair takes the
  // plain-markup attribute path. Both must update the group's identity model.
  tabs[0]!.panel = "overview";
  tabPanels[0]!.name = "overview";
  tabs[1]!.setAttribute("panel", "workspace");
  tabPanels[1]!.setAttribute("name", "workspace");
  await Promise.all([
    tabs[0]!.updateComplete,
    tabs[1]!.updateComplete,
    tabPanels[0]!.updateComplete,
    tabPanels[1]!.updateComplete,
  ]);
  await aTimeout(0);
  await el.updateComplete;

  const buttons = tabButtons(el);
  const wrappers = panels(el);
  expect(el.active).to.equal("overview");
  expect(buttons.map((button) => button.dataset.slot)).to.deep.equal([
    "overview",
    "workspace",
    "danger",
  ]);
  expect(tabs.map((tab) => tab.getAttribute("slot"))).to.deep.equal([
    "overview-tab",
    "workspace-tab",
    "danger-tab",
  ]);
  expect(tabPanels.map((panel) => panel.getAttribute("slot"))).to.deep.equal([
    "overview",
    "workspace",
    "danger",
  ]);
  expect(
    buttons.map((button) => button.getAttribute("aria-controls"))
  ).to.deep.equal(wrappers.map((wrapper) => wrapper.id));
  expect(
    wrappers.map((wrapper) => wrapper.getAttribute("aria-labelledby"))
  ).to.deep.equal(buttons.map((button) => button.id));
  expect(
    wrappers.map((wrapper) =>
      (wrapper.querySelector("slot") as HTMLSlotElement)
        .assignedElements({ flatten: true })
        .map((element) => element.getAttribute("name"))
    )
  ).to.deep.equal([["overview"], ["workspace"], ["danger"]]);
  expect(events).to.deep.equal([]);

  el.show("workspace");
  await el.updateComplete;
  expect(el.active).to.equal("workspace");
  expect(events).to.deep.equal(["hide:overview", "show:workspace"]);
  expect(
    buttons.map((button) => button.getAttribute("aria-selected"))
  ).to.deep.equal(["false", "true", "false"]);
  expect(wrappers.map((wrapper) => wrapper.hidden)).to.deep.equal([
    true,
    false,
    true,
  ]);
  expect(tabs.map((tab) => tab.active)).to.deep.equal([false, true, false]);
  expect(tabPanels.map((panel) => panel.active)).to.deep.equal([
    false,
    true,
    false,
  ]);
});

it("restores each descriptor and panel's latest author-owned slot when it is released", async () => {
  const el = await fixture<LyraTabGroup>(html`
    <lr-tab-group>
      <lr-tab panel="general" slot="authored-tab">General</lr-tab>
      <lr-tab-panel name="general" slot="authored-panel"
        >General body</lr-tab-panel
      >
    </lr-tab-group>
  `);
  const tab = el.querySelector<LyraTab>("lr-tab")!;
  const panel = el.querySelector<LyraTabPanel>("lr-tab-panel")!;
  expect(tab.slot).to.equal("general-tab");
  expect(panel.slot).to.equal("general");

  tab.slot = "latest-tab";
  panel.slot = "latest-panel";
  await aTimeout(0);
  await el.updateComplete;
  expect(tab.slot).to.equal("general-tab");
  expect(panel.slot).to.equal("general");

  tab.remove();
  panel.remove();
  await aTimeout(0);
  await el.updateComplete;
  expect(tab.slot).to.equal("latest-tab");
  expect(panel.slot).to.equal("latest-panel");
});

it("restores author slot state on disconnect and safely reprojects it after reconnect", async () => {
  const host = await fixture<HTMLElement>(html`
    <div>
      <lr-tab-group>
        <lr-tab panel="general" slot="tab-author">General</lr-tab>
        <lr-tab-panel name="general" slot="panel-author"
          >General body</lr-tab-panel
        >
      </lr-tab-group>
    </div>
  `);
  const el = host.querySelector<LyraTabGroup>("lr-tab-group")!;
  const tab = el.querySelector<LyraTab>("lr-tab")!;
  const panel = el.querySelector<LyraTabPanel>("lr-tab-panel")!;

  el.remove();
  expect(tab.slot).to.equal("tab-author");
  expect(panel.slot).to.equal("panel-author");

  host.append(el);
  await aTimeout(0);
  await el.updateComplete;
  expect(tab.slot).to.equal("general-tab");
  expect(panel.slot).to.equal("general");

  el.remove();
  expect(tab.slot).to.equal("tab-author");
  expect(panel.slot).to.equal("panel-author");
});

it("preserves author slot ownership across reparenting into another tab group", async () => {
  const host = await fixture<HTMLElement>(html`
    <div>
      <lr-tab-group id="first">
        <lr-tab panel="general" slot="tab-author">General</lr-tab>
        <lr-tab-panel name="general" slot="panel-author"
          >General body</lr-tab-panel
        >
      </lr-tab-group>
      <lr-tab-group id="second"></lr-tab-group>
    </div>
  `);
  const first = host.querySelector<LyraTabGroup>("#first")!;
  const second = host.querySelector<LyraTabGroup>("#second")!;
  const tab = first.querySelector<LyraTab>("lr-tab")!;
  const panel = first.querySelector<LyraTabPanel>("lr-tab-panel")!;
  second.append(tab, panel);
  await aTimeout(0);
  await Promise.all([first.updateComplete, second.updateComplete]);
  expect(tab.slot).to.equal("general-tab");
  expect(panel.slot).to.equal("general");

  tab.remove();
  panel.remove();
  await aTimeout(0);
  await second.updateComplete;
  expect(tab.slot).to.equal("tab-author");
  expect(panel.slot).to.equal("panel-author");
});

// --- placement --------------------------------------------------------------------------------

it("defaults to a horizontal strip and reports it through aria-orientation", async () => {
  const el = (await fixture(basic())) as LyraTabGroup;
  await el.updateComplete;
  expect(el.placement).to.equal("top");
  const tablist = el.shadowRoot!.querySelector(
    '[part~="tablist"]'
  ) as HTMLElement;
  expect(tablist.getAttribute("aria-orientation")).to.equal("horizontal");
});

it("turns the tablist vertical for a start/end placement", async () => {
  const el = (await fixture(html`
    <lr-tab-group placement="start">
      <lr-tab panel="a">A</lr-tab>
      <lr-tab panel="b">B</lr-tab>
      <lr-tab-panel name="a">A body</lr-tab-panel>
      <lr-tab-panel name="b">B body</lr-tab-panel>
    </lr-tab-group>
  `)) as LyraTabGroup;
  await el.updateComplete;
  const tablist = el.shadowRoot!.querySelector(
    '[part~="tablist"]'
  ) as HTMLElement;
  expect(tablist.getAttribute("aria-orientation")).to.equal("vertical");
  // Rendered result, not stylesheet text.
  expect(getComputedStyle(tablist).flexDirection).to.equal("column");
});

it("bounds and ellipsizes long vertical labels at an exact 320px allocation in LTR and RTL", async () => {
  const longLabel = "Localized navigation label ".repeat(32);
  const scenarios = [
    { direction: "ltr", placement: "start" },
    { direction: "ltr", placement: "end" },
    { direction: "rtl", placement: "start" },
    { direction: "rtl", placement: "end" },
  ] as const;

  for (const { direction, placement } of scenarios) {
    const wrapper = await fixture<HTMLElement>(html`
      <div dir=${direction} style="inline-size: 320px; max-inline-size: 100%;">
        <lr-tab-group placement=${placement} style="inline-size: 100%;">
          <lr-tab panel="long">${longLabel}</lr-tab>
          <lr-tab panel="details">Details</lr-tab>
          <lr-tab-panel name="long">Long-label panel</lr-tab-panel>
          <lr-tab-panel name="details">Details panel</lr-tab-panel>
        </lr-tab-group>
      </div>
    `);
    const el = wrapper.querySelector("lr-tab-group") as LyraTabGroup;
    await el.updateComplete;
    const nav = el.shadowRoot!.querySelector('[part="nav"]') as HTMLElement;
    const longTab = tabButtons(el)[0]!;
    const panel = panels(el)[0]!;
    const groupBox = el.getBoundingClientRect();
    const navBox = nav.getBoundingClientRect();
    const panelBox = panel.getBoundingClientRect();
    const navMaxInlineSize = Number.parseFloat(
      getComputedStyle(nav).maxInlineSize
    );

    expect(
      Math.round(groupBox.width),
      `${direction}/${placement} group width`
    ).to.equal(320);
    expect(
      Number.isFinite(navMaxInlineSize),
      `${direction}/${placement} nav maximum`
    ).to.equal(true);
    expect(navBox.width, `${direction}/${placement} nav width`).to.be.at.most(
      navMaxInlineSize + 1
    );
    expect(
      nav.scrollWidth,
      `${direction}/${placement} nav scroll width`
    ).to.be.at.most(Math.ceil(groupBox.width));
    expect(
      panelBox.width,
      `${direction}/${placement} panel width`
    ).to.be.greaterThan(0);
    expect(
      panelBox.left,
      `${direction}/${placement} panel start`
    ).to.be.at.least(groupBox.left - 1);
    expect(panelBox.right, `${direction}/${placement} panel end`).to.be.at.most(
      groupBox.right + 1
    );
    expect(
      longTab.scrollWidth,
      `${direction}/${placement} long label clipping`
    ).to.be.greaterThan(longTab.clientWidth);
    expect(getComputedStyle(longTab).textOverflow).to.equal("ellipsis");
  }
});

it("contains unbroken element-model tab labels and panel content at an exact 320px allocation in LTR and RTL", async () => {
  const longTab =
    "AnExtremelyLongUnbrokenElementModelTabLabelThatMustRemainContained".repeat(
      4
    );
  const longPanel =
    "AnExtremelyLongUnbrokenElementModelTabPanelValueThatMustRemainContained".repeat(
      4
    );

  for (const { direction, placement } of [
    { direction: "ltr", placement: "start" },
    { direction: "rtl", placement: "end" },
  ] as const) {
    const wrapper = await fixture<HTMLElement>(html`
      <div dir=${direction} style="inline-size: 320px; max-inline-size: 100%;">
        <lr-tab-group placement=${placement} style="inline-size: 100%;">
          <lr-tab panel="details" active>${longTab}</lr-tab>
          <lr-tab panel="history">History</lr-tab>
          <lr-tab-panel name="details" active>${longPanel}</lr-tab-panel>
          <lr-tab-panel name="history">History panel.</lr-tab-panel>
        </lr-tab-group>
      </div>
    `);
    const el = wrapper.querySelector("lr-tab-group") as LyraTabGroup;
    await el.updateComplete;
    const nav = el.shadowRoot!.querySelector('[part="nav"]') as HTMLElement;
    const panel = panels(el)[0]!;
    const groupBounds = el.getBoundingClientRect();
    const navBounds = nav.getBoundingClientRect();
    const panelBounds = panel.getBoundingClientRect();
    const activeTab = tabButtons(el)[0]!;

    expect(Math.round(groupBounds.width), `${direction} group width`).to.equal(
      320
    );
    expect(navBounds.left, `${direction} nav start`).to.be.at.least(
      groupBounds.left - 1
    );
    expect(navBounds.right, `${direction} nav end`).to.be.at.most(
      groupBounds.right + 1
    );
    expect(
      activeTab.scrollWidth,
      `${direction} long tab clipping`
    ).to.be.greaterThan(activeTab.clientWidth);
    expect(
      panel.scrollWidth,
      `${direction} panel horizontal overflow`
    ).to.be.at.most(panel.clientWidth + 1);
    expect(panelBounds.left, `${direction} panel start`).to.be.at.least(
      groupBounds.left - 1
    );
    expect(panelBounds.right, `${direction} panel end`).to.be.at.most(
      groupBounds.right + 1
    );
  }
});

it("contains a vertically overflowing strip and panel in an exact 320px by 160px allocation", async () => {
  const entries = Array.from({ length: 14 }, (_, index) => ({
    id: `panel-${index}`,
    label: `Navigation item ${index + 1}`,
  }));
  for (const direction of ["ltr", "rtl"] as const) {
    const wrapper = await fixture<HTMLElement>(html`
      <div dir=${direction} style="inline-size: 320px; block-size: 160px;">
        <lr-tab-group
          placement=${direction === "ltr" ? "start" : "end"}
          style="inline-size: 100%; block-size: 100%;"
        >
          ${entries.map(
            ({ id, label }) => html`<lr-tab panel=${id}>${label}</lr-tab>`
          )}
          ${entries.map(
            ({ id }) =>
              html`<lr-tab-panel name=${id}
                >${"Long panel content ".repeat(40)}</lr-tab-panel
              >`
          )}
        </lr-tab-group>
      </div>
    `);
    const el = wrapper.querySelector<LyraTabGroup>("lr-tab-group")!;
    await nextFrames();
    await el.updateComplete;
    const base = el.shadowRoot!.querySelector<HTMLElement>('[part~="base"]')!;
    const tablist =
      el.shadowRoot!.querySelector<HTMLElement>('[part~="tablist"]')!;
    const body = el.shadowRoot!.querySelector<HTMLElement>('[part="body"]')!;
    expect(
      Math.round(el.getBoundingClientRect().width),
      `${direction} width`
    ).to.equal(320);
    expect(
      Math.round(el.getBoundingClientRect().height),
      `${direction} height`
    ).to.equal(160);
    expect(base.scrollHeight, `${direction} base containment`).to.be.at.most(
      base.clientHeight + 1
    );
    expect(
      tablist.scrollHeight,
      `${direction} vertical overflow`
    ).to.be.greaterThan(tablist.clientHeight);
    expect(body.scrollHeight, `${direction} panel overflow`).to.be.greaterThan(
      body.clientHeight
    );

    const last = tabButtons(el).at(-1)!;
    last.focus();
    await nextFrames();
    expect(
      tablist.scrollTop,
      `${direction} focused tab scroll`
    ).to.be.greaterThan(0);
    expect(base.scrollTop, `${direction} base remains fixed`).to.equal(0);
  }
});

it("inherits the vertical nav maximum from an ancestor", async () => {
  const wrapper = await fixture<HTMLElement>(html`
    <div style="inline-size: 320px; max-inline-size: 100%;">
      <lr-tab-group placement="start" style="inline-size: 100%;">
        <lr-tab panel="long">${"Long navigation label ".repeat(32)}</lr-tab>
        <lr-tab panel="details">Details</lr-tab>
        <lr-tab-panel name="long">Long-label panel</lr-tab-panel>
        <lr-tab-panel name="details">Details panel</lr-tab-panel>
      </lr-tab-group>
    </div>
  `);
  const el = wrapper.querySelector("lr-tab-group") as LyraTabGroup;
  const ancestor = el.parentElement as HTMLElement;
  ancestor.style.setProperty(
    "--lr-tab-group-vertical-nav-max-inline-size",
    "8rem"
  );
  await el.updateComplete;
  const nav = el.shadowRoot!.querySelector('[part="nav"]') as HTMLElement;
  const navMaxInlineSize = Number.parseFloat(
    getComputedStyle(nav).maxInlineSize
  );

  expect(
    getComputedStyle(el)
      .getPropertyValue("--lr-tab-group-vertical-nav-max-inline-size")
      .trim()
  ).to.not.equal("");
  expect(navMaxInlineSize).to.be.closeTo(128, 0.1);
  expect(nav.getBoundingClientRect().width).to.be.closeTo(navMaxInlineSize, 1);
});

it("navigates a vertical strip with Up/Down, not Left/Right", async () => {
  const el = (await fixture(html`
    <lr-tab-group placement="end">
      <lr-tab panel="a">A</lr-tab>
      <lr-tab panel="b">B</lr-tab>
      <lr-tab-panel name="a">A body</lr-tab-panel>
      <lr-tab-panel name="b">B body</lr-tab-panel>
    </lr-tab-group>
  `)) as LyraTabGroup;
  await el.updateComplete;
  const tablist = el.shadowRoot!.querySelector(
    '[part~="tablist"]'
  ) as HTMLElement;
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
      <lr-tab panel="a">A</lr-tab>
      <lr-tab panel="b">B</lr-tab>
      <lr-tab-panel name="a">A body</lr-tab-panel>
      <lr-tab-panel name="b">B body</lr-tab-panel>
    </lr-tab-group>
  `)) as LyraTabGroup;
  await el.updateComplete;
  const tablist = el.shadowRoot!.querySelector(
    '[part~="tablist"]'
  ) as HTMLElement;
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
      <lr-tab panel="a">A</lr-tab>
      <lr-tab panel="b">B</lr-tab>
      <lr-tab-panel name="a">A body</lr-tab-panel>
      <lr-tab-panel name="b">B body</lr-tab-panel>
    </lr-tab-group>
  `)) as LyraTabGroup;
  await el.updateComplete;
  const tablist = el.shadowRoot!.querySelector(
    '[part~="tablist"]'
  ) as HTMLElement;
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
  const tablist = el.shadowRoot!.querySelector(
    '[part~="tablist"]'
  ) as HTMLElement;
  press(tablist, "ArrowRight");
  await el.updateComplete;
  expect(el.active).to.equal("preview");
  expect(tabButtons(el)[1]!.getAttribute("tabindex")).to.equal("0");
});

// --- scroll controls --------------------------------------------------------------------------

/** Six long labels in a 220px box: wide enough that both 40px controls still measure their full
 *  hit area, narrow enough that the tab row genuinely overflows. */
const crowdedTabEntries = [
  ["overview", "Overview of everything"],
  ["activity", "Activity history"],
  ["artifacts", "Generated artifacts"],
  ["evaluations", "Evaluations and scores"],
  ["settings", "Workspace settings"],
  ["permissions", "Permissions and access"],
] as const;

const crowdedTabs = () => html`
  ${crowdedTabEntries.map(
    ([id, label]) => html`<lr-tab panel=${id}>${label}</lr-tab>`
  )}
  ${crowdedTabEntries.map(
    ([id, label]) =>
      html`<lr-tab-panel name=${id}>${label} panel</lr-tab-panel>`
  )}
`;

async function crowded(style = ""): Promise<LyraTabGroup> {
  const el = (await fixture(html`
    <div style=${style}>
      <lr-tab-group style="display: block; max-inline-size: 220px">
        ${crowdedTabs()}
      </lr-tab-group>
    </div>
  `)) as LyraTabGroup;
  const group = el.querySelector("lr-tab-group") as LyraTabGroup;
  group.style.setProperty("--lr-transition-fast", "0ms");
  await nextFrames();
  await group.updateComplete;
  return group;
}

function scrollControls(el: LyraTabGroup): HTMLButtonElement[] {
  return [
    ...el.shadowRoot!.querySelectorAll('[part~="scroll-button"]'),
  ] as HTMLButtonElement[];
}

function scrollControl(
  el: LyraTabGroup,
  edge: "start" | "end"
): HTMLButtonElement {
  return el.shadowRoot!.querySelector(
    `[part~="scroll-button-${edge}"]`
  ) as HTMLButtonElement;
}

/** Records the `scrollBy()` calls one control makes, restoring the real method afterwards. */
async function recordScroll(
  el: LyraTabGroup,
  edge: "start" | "end"
): Promise<ScrollToOptions[]> {
  const tablist = el.shadowRoot!.querySelector(
    '[part~="tablist"]'
  ) as HTMLElement;
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

it("shows only the reachable end control at the initial edge of an overflowing row", async () => {
  const el = await crowded();
  const tablist = el.shadowRoot!.querySelector(
    '[part~="tablist"]'
  ) as HTMLElement;
  expect(tablist.hasAttribute("data-scroll-overflow")).to.equal(true);
  expect(tablist.hasAttribute("data-scroll-start")).to.equal(false);
  expect(tablist.hasAttribute("data-scroll-end")).to.equal(true);
  expect(getComputedStyle(scrollControl(el, "start")).display).to.equal("none");
  expect(getComputedStyle(scrollControl(el, "end")).display).to.not.equal(
    "none"
  );
});

it("tracks logical scroll edges for one-sided fades and controls in LTR and RTL", async () => {
  for (const direction of ["ltr", "rtl"] as const) {
    const host = await fixture<HTMLElement>(html`
      <div dir=${direction}>
        <lr-tab-group style="display: block; max-inline-size: 220px">
          ${crowdedTabs()}
        </lr-tab-group>
      </div>
    `);
    const el = host.querySelector<LyraTabGroup>("lr-tab-group")!;
    await nextFrames();
    await el.updateComplete;
    const tablist =
      el.shadowRoot!.querySelector<HTMLElement>('[part~="tablist"]')!;
    expect(
      tablist.hasAttribute("data-scroll-start"),
      `${direction} initial start`
    ).to.equal(false);
    expect(
      tablist.hasAttribute("data-scroll-end"),
      `${direction} initial end`
    ).to.equal(true);
    expect(
      getComputedStyle(tablist).maskImage,
      `${direction} initial fade`
    ).to.contain("linear-gradient");

    const maximum = tablist.scrollWidth - tablist.clientWidth;
    tablist.scrollLeft = direction === "rtl" ? -maximum : maximum;
    tablist.dispatchEvent(new Event("scroll"));
    await el.updateComplete;
    expect(
      tablist.hasAttribute("data-scroll-start"),
      `${direction} final start`
    ).to.equal(true);
    expect(
      tablist.hasAttribute("data-scroll-end"),
      `${direction} final end`
    ).to.equal(false);
    expect(getComputedStyle(scrollControl(el, "start")).display).to.not.equal(
      "none"
    );
    expect(getComputedStyle(scrollControl(el, "end")).display).to.equal("none");
  }
});

it("each scroll control meets the shared 40px minimum hit area", async () => {
  const el = await crowded();
  el.fixedScrollControls = true;
  await el.updateComplete;
  for (const edge of ["start", "end"] as const) {
    const box = scrollControl(el, edge).getBoundingClientRect();
    expect(Math.round(box.width), `${edge} control width`).to.be.at.least(40);
    expect(Math.round(box.height), `${edge} control height`).to.be.at.least(40);
  }
});

it("without-scroll-controls removes them entirely, leaving native scrolling and the edge fade", async () => {
  const el = (await fixture(html`
    <lr-tab-group
      without-scroll-controls
      style="display: block; max-inline-size: 220px"
    >
      ${crowdedTabs()}
    </lr-tab-group>
  `)) as LyraTabGroup;
  await nextFrames();
  expect(scrollControls(el)).to.have.lengthOf(0);
  const tablist = el.shadowRoot!.querySelector(
    '[part~="tablist"]'
  ) as HTMLElement;
  expect(tablist.hasAttribute("data-scroll-overflow")).to.equal(true);
  expect(getComputedStyle(tablist).maskImage).to.contain("linear-gradient");
});

it("accepts the Shoelace spelling no-scroll-controls for the same opt-out", async () => {
  const el = (await fixture(html`
    <lr-tab-group
      no-scroll-controls
      style="display: block; max-inline-size: 220px"
    >
      ${crowdedTabs()}
    </lr-tab-group>
  `)) as LyraTabGroup;
  await nextFrames();
  expect(el.noScrollControls).to.equal(true);
  expect(el.withoutScrollControls).to.equal(false);
  expect(scrollControls(el)).to.have.lengthOf(0);
});

it("fixed-scroll-controls keeps both controls laid out while inactive edges remain no-ops", async () => {
  const el = await crowded();
  const laidOut = (): string[] =>
    scrollControls(el).map((button) => getComputedStyle(button).display);
  expect(el.fixedScrollControls).to.equal(false);
  expect(el.hasAttribute("fixed-scroll-controls")).to.equal(false);
  expect(laidOut()[0]).to.equal("none");
  expect(laidOut()[1]).to.not.equal("none");
  expect(await recordScroll(el, "start")).to.have.lengthOf(0);

  el.fixedScrollControls = true;
  await el.updateComplete;
  await nextFrames();
  expect(el.hasAttribute("fixed-scroll-controls")).to.equal(true);
  expect(laidOut().every((display) => display !== "none")).to.equal(true);
  expect(await recordScroll(el, "start")).to.have.lengthOf(0);

  el.fixedScrollControls = false;
  await el.updateComplete;
  await nextFrames();
  expect(el.hasAttribute("fixed-scroll-controls")).to.equal(false);
  expect(laidOut()[0]).to.equal("none");
  expect(laidOut()[1]).to.not.equal("none");
});

it("never renders scroll controls for a vertical placement", async () => {
  const el = (await fixture(html`
    <lr-tab-group
      placement="start"
      style="display: block; max-inline-size: 220px"
    >
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
  const tablist = el.shadowRoot!.querySelector(
    '[part~="tablist"]'
  ) as HTMLElement;
  tablist.scrollLeft = tablist.scrollWidth - tablist.clientWidth;
  tablist.dispatchEvent(new Event("scroll"));
  await el.updateComplete;
  const backward = await recordScroll(el, "start");
  expect(backward).to.have.lengthOf(1);
  expect(backward[0]!.left).to.be.lessThan(0);
});

it("scrolls an internal tablist from a foreign owner realm", async () => {
  const frame = (await fixture(html`<iframe></iframe>`)) as HTMLIFrameElement;
  const frameDocument = frame.contentDocument!;
  const el = await crowded();
  const foreignTablist = frameDocument.createElement("div");
  Object.defineProperty(foreignTablist, "clientWidth", {
    configurable: true,
    value: 100,
  });
  const calls: ScrollToOptions[] = [];
  foreignTablist.scrollBy = ((options: ScrollToOptions) =>
    calls.push(options)) as typeof foreignTablist.scrollBy;
  const renderRoot = el.shadowRoot!;
  const querySelector = renderRoot.querySelector;
  renderRoot.querySelector = ((selectors: string) =>
    selectors === '[part~="tablist"]'
      ? foreignTablist
      : querySelector.call(
          renderRoot,
          selectors
        )) as typeof renderRoot.querySelector;

  try {
    expect(foreignTablist instanceof HTMLElement).to.be.false;
    (el as unknown as { scrollTabs(edge: "start" | "end"): void }).scrollTabs(
      "end"
    );
    expect(calls).to.have.lengthOf(1);
    expect(calls[0]!.left).to.be.greaterThan(0);
  } finally {
    renderRoot.querySelector = querySelector;
    frame.remove();
  }
});

it("scrolls by a viewport-sized step rather than a fixed pixel amount", async () => {
  const el = await crowded();
  const tablist = el.shadowRoot!.querySelector(
    '[part~="tablist"]'
  ) as HTMLElement;
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
  const tablist = el.shadowRoot!.querySelector(
    '[part~="tablist"]'
  ) as HTMLElement;
  tablist.scrollLeft = -(tablist.scrollWidth - tablist.clientWidth);
  tablist.dispatchEvent(new Event("scroll"));
  await el.updateComplete;
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
  ltr.fixedScrollControls = true;
  await ltr.updateComplete;
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
  rtl.fixedScrollControls = true;
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
        <lr-tab panel="input">Input</lr-tab>
        <lr-tab panel="preview">Preview</lr-tab>
        <lr-tab-panel name="input">Raw input</lr-tab-panel>
        <lr-tab-panel name="preview">Rendered preview</lr-tab-panel>
      </lr-tab-group>
    </div>
  `);
  const el = host.querySelector("lr-tab-group") as LyraTabGroup;
  await nextFrames();
  const tablist = el.shadowRoot!.querySelector(
    '[part~="tablist"]'
  ) as HTMLElement;
  expect(tablist.hasAttribute("data-scroll-overflow")).to.equal(false);
  expect(getComputedStyle(scrollControl(el, "start")).display).to.equal("flex");
});

it("lays the start control before the tabs in LTR and after them under RTL", async () => {
  const ltr = await crowded();
  ltr.fixedScrollControls = true;
  await ltr.updateComplete;
  const ltrTablist = ltr.shadowRoot!.querySelector(
    '[part~="tablist"]'
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
  rtl.fixedScrollControls = true;
  await rtl.updateComplete;
  const rtlTablist = rtl.shadowRoot!.querySelector(
    '[part~="tablist"]'
  ) as HTMLElement;
  // Logical, not physical: "toward the inline start" is the right-hand edge here, so the same
  // control moves to the other side of the strip with no :dir() rule involved in the layout.
  expect(
    scrollControl(rtl, "start").getBoundingClientRect().left
  ).to.be.greaterThan(rtlTablist.getBoundingClientRect().left);
});

describe("upstream tab surface", () => {
  it("exposes the mapped defaultSlot as the group's real unnamed slot", async () => {
    const el = await fixture<LyraTabGroup>(elementModel());
    await el.updateComplete;

    expect(el.defaultSlot instanceof HTMLSlotElement).to.equal(true);
    expect(el.defaultSlot.name).to.equal("");
    expect(el.defaultSlot.hidden).to.equal(true);
    expect(
      el.defaultSlot === el.shadowRoot!.querySelector("slot:not([name])")
    ).to.equal(true);
  });

  it("leaves the established tab content unchanged when closable is unset", async () => {
    const tab = await fixture<LyraTab>(
      html`<lr-tab panel="general">General</lr-tab>`
    );

    expect(tab.closable).to.equal(false);
    expect(
      tab.shadowRoot!.querySelectorAll('[part~="close-button"]').length
    ).to.equal(0);
    const content = tab.shadowRoot!.querySelector(
      '[part~="tab"]'
    ) as HTMLSlotElement;
    expect(content.part.contains("base")).to.equal(true);
    expect(content.assignedNodes({ flatten: true }).length).to.equal(1);
  });

  it("reflects closable and exposes both close-button part names on one localized control", async () => {
    const tab = await fixture<LyraTab>(html`
      <lr-tab panel="general" closable .strings=${{ close: "Close this tab" }}
        >General</lr-tab
      >
    `);

    expect(tab.closable).to.equal(true);
    expect(tab.hasAttribute("closable")).to.equal(true);
    const close = tab.shadowRoot!.querySelector(
      '[part~="close-button"]'
    ) as HTMLElement;
    expect(close.part.contains("close-button__base")).to.equal(true);
    expect(close.getAttribute("title")).to.equal("Close this tab");
    expect(close.getAttribute("aria-hidden")).to.equal("true");
    expect(close.hasAttribute("tabindex")).to.equal(false);
  });

  it("maps the upstream close notification to one bubbling, composed, noncancelable lr-close event", async () => {
    const host = await fixture<HTMLDivElement>(html`
      <div><lr-tab panel="general" closable>General</lr-tab></div>
    `);
    const tab = host.querySelector("lr-tab") as LyraTab;
    const close = tab.shadowRoot!.querySelector(
      '[part~="close-button"]'
    ) as HTMLElement;
    let rawUpstreamEvents = 0;
    tab.addEventListener("sl-close", () => rawUpstreamEvents++);
    const closed = oneEvent(host, "lr-close");

    close.click();
    const event = await closed;

    expect(event.type).to.equal("lr-close");
    expect(event.detail).to.equal(null);
    expect(event.bubbles).to.equal(true);
    expect(event.composed).to.equal(true);
    expect(event.cancelable).to.equal(false);
    expect(rawUpstreamEvents).to.equal(0);
  });

  it("does not select a different tab when its close control is clicked", async () => {
    const el = await fixture<LyraTabGroup>(html`
      <lr-tab-group aria-label="Workspace tabs">
        <lr-tab panel="general" active>General</lr-tab>
        <lr-tab panel="advanced" closable>Advanced</lr-tab>
        <lr-tab-panel name="general" active>General body</lr-tab-panel>
        <lr-tab-panel name="advanced">Advanced body</lr-tab-panel>
      </lr-tab-group>
    `);
    const advanced = el.querySelectorAll<LyraTab>("lr-tab")[1]!;
    const closed = oneEvent(el, "lr-close");

    (
      advanced.shadowRoot!.querySelector(
        '[part~="close-button"]'
      ) as HTMLElement
    ).click();
    await closed;
    await el.updateComplete;

    expect(el.active).to.equal("general");
    expect(el.querySelectorAll("lr-tab").length).to.equal(2);
    await expect(el).to.be.accessible();
  });

  it("advertises Delete only on enabled closable real tab buttons", async () => {
    const el = await fixture<LyraTabGroup>(html`
      <lr-tab-group aria-label="Workspace tabs">
        <lr-tab panel="general" active>General</lr-tab>
        <lr-tab panel="advanced" closable>Advanced</lr-tab>
        <lr-tab panel="locked" closable disabled>Locked</lr-tab>
        <lr-tab-panel name="general" active>General body</lr-tab-panel>
        <lr-tab-panel name="advanced">Advanced body</lr-tab-panel>
        <lr-tab-panel name="locked">Locked body</lr-tab-panel>
      </lr-tab-group>
    `);

    expect(
      tabButtons(el).map((button) => button.getAttribute("aria-keyshortcuts"))
    ).to.deep.equal([null, "Delete", null]);
  });

  it("routes Delete on the focused closable tab through the descriptor's lr-close emit path", async () => {
    const el = await fixture<LyraTabGroup>(html`
      <lr-tab-group aria-label="Workspace tabs">
        <lr-tab panel="general" active closable>General</lr-tab>
        <lr-tab panel="advanced" closable>Advanced</lr-tab>
        <lr-tab-panel name="general" active>General body</lr-tab-panel>
        <lr-tab-panel name="advanced">Advanced body</lr-tab-panel>
      </lr-tab-group>
    `);
    const button = tabButtons(el)[0]!;
    button.focus();
    const closed = oneEvent(el, "lr-close");

    press(button, "Delete");
    const event = await closed;

    expect((event.target as Element).localName).to.equal("lr-tab");
    expect((event.target as Element).getAttribute("panel")).to.equal("general");
    expect(event.detail).to.equal(null);
    expect(el.active).to.equal("general");
    expect(el.shadowRoot!.activeElement?.getAttribute("data-slot")).to.equal(
      "general"
    );
  });

  it("does not emit a close request from disabled tabs by pointer or Delete", async () => {
    const el = await fixture<LyraTabGroup>(html`
      <lr-tab-group aria-label="Workspace tabs">
        <lr-tab panel="general" active>General</lr-tab>
        <lr-tab panel="locked" closable disabled>Locked</lr-tab>
        <lr-tab-panel name="general" active>General body</lr-tab-panel>
        <lr-tab-panel name="locked">Locked body</lr-tab-panel>
      </lr-tab-group>
    `);
    const locked = el.querySelectorAll<LyraTab>("lr-tab")[1]!;
    let closeRequests = 0;
    el.addEventListener("lr-close", () => closeRequests++);

    (
      locked.shadowRoot!.querySelector('[part~="close-button"]') as HTMLElement
    ).click();
    press(tabButtons(el)[1]!, "Delete");
    await aTimeout(0);

    expect(closeRequests).to.equal(0);
    expect(el.active).to.equal("general");
  });

  it("exposes reflected active hints on tab and panel, and auto-slots a standalone tab into nav", async () => {
    const tab = await fixture<LyraTab>(
      html`<lr-tab panel="general">General</lr-tab>`
    );
    expect(tab.active).to.be.false;
    expect(tab.slot).to.equal("nav");
    tab.active = true;
    await tab.updateComplete;
    expect(tab.hasAttribute("active")).to.be.true;

    const panel = await fixture<LyraTabPanel>(
      html`<lr-tab-panel name="general" active style="--padding: 9px"
        >Body</lr-tab-panel
      >`
    );
    expect(panel.active).to.be.true;
    const panelBase = panel.shadowRoot!.querySelector(
      '[part="base"]'
    ) as HTMLElement;
    expect(getComputedStyle(panelBase).paddingInlineStart).to.equal("9px");
  });

  it("honors SSR active hints, then keeps tab and panel hints synchronized", async () => {
    const el = await fixture<LyraTabGroup>(html`<lr-tab-group>
      <lr-tab panel="general">General</lr-tab>
      <lr-tab panel="advanced" active>Advanced</lr-tab>
      <lr-tab-panel name="general">General body</lr-tab-panel>
      <lr-tab-panel name="advanced" active>Advanced body</lr-tab-panel>
    </lr-tab-group>`);
    expect(el.active).to.equal("advanced");

    el.show("general");
    await el.updateComplete;
    const tabs = [...el.querySelectorAll<LyraTab>("lr-tab")];
    const tabPanels = [...el.querySelectorAll<LyraTabPanel>("lr-tab-panel")];
    expect(tabs.map((tab) => tab.active)).to.deep.equal([true, false]);
    expect(tabPanels.map((panel) => panel.active)).to.deep.equal([true, false]);
  });

  it("emits only the canonical panel name from selection events", async () => {
    const el = await fixture<LyraTabGroup>(elementModel());
    const hidden = oneEvent(el, "lr-tab-hide");
    const shown = oneEvent(el, "lr-tab-show");
    el.show("advanced");
    expect((await hidden).detail).to.deep.equal({ name: "general" });
    expect((await shown).detail).to.deep.equal({ name: "advanced" });
  });

  it("exposes body/tabs/indicator and all scroll-button compatibility part names", async () => {
    const el = await crowded();
    const tabs = el.shadowRoot!.querySelector('[part~="tabs"]') as HTMLElement;
    expect(tabs.part.contains("tablist")).to.be.true;
    expect(el.shadowRoot!.querySelector('[part="body"]')).to.exist;
    expect(el.shadowRoot!.querySelector('[part="active-tab-indicator"]')).to
      .exist;
    const start = scrollControl(el, "start");
    expect(start.part.contains("scroll-button__base")).to.be.true;
    expect(start.part.contains("scroll-button-start")).to.be.true;
    expect(start.part.contains("scroll-button--start")).to.be.true;
  });

  it("consumes upstream indicator and track CSS properties", async () => {
    const el = await fixture<LyraTabGroup>(html`<lr-tab-group
      style="--indicator-color: rgb(1, 2, 3); --track-color: rgb(4, 5, 6); --track-width: 7px"
    >
      <lr-tab panel="general">General</lr-tab>
      <lr-tab-panel name="general">Body</lr-tab-panel>
    </lr-tab-group>`);
    const indicator = el.shadowRoot!.querySelector(
      '[part="active-tab-indicator"]'
    ) as HTMLElement;
    const tabs = el.shadowRoot!.querySelector('[part~="tabs"]') as HTMLElement;
    expect(getComputedStyle(indicator).backgroundColor).to.equal(
      "rgb(1, 2, 3)"
    );
    expect(getComputedStyle(tabs).borderBlockEndColor).to.equal("rgb(4, 5, 6)");
    expect(getComputedStyle(tabs).borderBlockEndWidth).to.equal("7px");
  });

  it("remains accessible with SSR hints and all public wrapper parts", async () => {
    const el = await fixture<LyraTabGroup>(html`<lr-tab-group
      aria-label="Settings"
    >
      <lr-tab panel="general" active>General</lr-tab>
      <lr-tab panel="advanced">Advanced</lr-tab>
      <lr-tab-panel name="general" active>General body</lr-tab-panel>
      <lr-tab-panel name="advanced">Advanced body</lr-tab-panel>
    </lr-tab-group>`);
    await expect(el).to.be.accessible();
  });
});
