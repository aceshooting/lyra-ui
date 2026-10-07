import { resolvedColorIn } from '../../../../test/shadow-style.js';
// Focused rendering and accessibility cases. Test bodies and titles were moved intact from the prior suite.
import { fixture, expect, oneEvent, html, aTimeout, waitUntil } from "@open-wc/testing";
import "./combobox.js";
import "./option.js";
import "../input/input.js";
import "../select/select.js";
import "../button/button.js";
import "../token-input/token-input.js";
import "../color-picker/color-picker.js";
import "../../layout/segmented/segmented.js";
import type { ComboboxFilterDetail, LyraCombobox } from "./combobox.js";
import type { LyraOption } from "./option.js";
import { styles } from "./combobox.styles.js";
import { resetMouse, sendMouse, settlePointer } from '../../../../test/wtr-mouse.js';
import { sendKeys } from '@web/test-runner-commands';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import { setReducedMotion } from "../../../../test/wtr-media.js";
import { ANNOUNCEMENT_SINK_ATTRIBUTE } from "../../../internal/announcer.js";
import "../../../translations/ar/forms.js";
import "../../../translations/ar/shared.js";
import { settleComboboxSource } from '../../../../test/wtr-combobox.js';

const requiredItem = <T>(items: ArrayLike<T>, index: number, description: string): T => {
  const item = items[index];
  if (item === undefined) throw new Error(`Missing ${description} at index ${index}.`);
  return item;
};

function assertiveAnnouncements(): string[] {
  const sink = document.querySelector<HTMLElement>(
    `[${ANNOUNCEMENT_SINK_ATTRIBUTE}="assertive"]`
  );
  return sink
    ? Array.from(sink.children, (child) => child.textContent ?? "")
    : [];
}

const basic = () => html`
  <lr-combobox>
    <lr-option value="a">Apple</lr-option>
    <lr-option value="b">Banana</lr-option>
    <lr-option value="c">Cherry</lr-option>
  </lr-combobox>
`;

async function typeQuery(el: LyraCombobox, text: string) {
  const input = el.shadowRoot!.querySelector(
    '[part="combobox-input"]'
  ) as HTMLInputElement;
  input.value = text;
  input.dispatchEvent(
    new InputEvent("input", {
      bubbles: true,
      composed: true,
      data: text,
      inputType: "insertText",
    })
  );
  await el.updateComplete;
  return input;
}

const finishListboxAnimation = (el: LyraCombobox): void => {
  el.shadowRoot!.querySelector('[part="listbox"]')
    ?.getAnimations()
    .forEach((animation) => animation.finish());
};

it("rejects unsafe option dot colors while preserving valid CSS colors", async () => {
  const el = await fixture<LyraCombobox>(html`
    <lr-combobox open>
      <lr-option value="a" dot-color="url(data:image/svg+xml,&lt;svg/&gt;)"
        >A</lr-option
      >
    </lr-combobox>
  `);
  const dot = el.shadowRoot!.querySelector(
    '[part="option-dot"]'
  ) as HTMLElement;
  expect(dot.style.backgroundColor).to.equal("transparent");
  expect(dot.style.backgroundImage).to.not.contain("url(");

  const safe = await fixture<LyraCombobox>(html`
    <lr-combobox open>
      <lr-option value="a" dot-color="#123456">A</lr-option>
    </lr-combobox>
  `);
  expect(
    (safe.shadowRoot!.querySelector('[part="option-dot"]') as HTMLElement).style
      .backgroundColor
  ).to.not.equal("");
});

it("emits lr-input and lr-change with the new and previous value alongside native-style input/change", async () => {
  const el = (await fixture(basic())) as LyraCombobox;
  el.open = true;
  await el.updateComplete;
  const seen: Array<{ type: string; detail: unknown }> = [];
  for (const type of ["input", "lr-input", "change", "lr-change"]) {
    el.addEventListener(type, (e) =>
      seen.push({ type, detail: (e as CustomEvent).detail })
    );
  }
  const option = el.shadowRoot!.querySelectorAll(
    '[part="option"]'
  )[1] as HTMLElement;
  option.click();
  await el.updateComplete;

  expect(seen.map((s) => s.type)).to.deep.equal([
    "input",
    "lr-input",
    "change",
    "lr-change",
  ]);
  for (const s of seen) {
    expect(s.detail).to.deep.equal({ value: 'b', previousValue: '', data: [undefined] });
    expect(Object.isFrozen(s.detail)).to.equal(true);
  }
});

it("falls back to the raw value in a remove-tag's accessible name when the option's computed label is blank", async () => {
  const el = (await fixture(html`
    <lr-combobox multiple>
      <lr-option value="a">Apple</lr-option>
      <lr-option value="x"></lr-option>
    </lr-combobox>
  `)) as LyraCombobox;
  el.value = ["a", "x"];
  await el.updateComplete;
  const removeButtons = [
    ...el.shadowRoot!.querySelectorAll<HTMLButtonElement>(
      '[part="tag__remove-button"]'
    ),
  ];
  const blankOptionButton = removeButtons[1]!;
  expect(blankOptionButton.getAttribute("aria-label")).to.equal("Remove x");
});

it("describes a populated multiple combobox by every committed label, including collapsed ones", async () => {
  const el = (await fixture(html`
    <lr-combobox multiple max-options-visible="2" label="Fruit">
      <lr-option value="a">Alpha</lr-option>
      <lr-option value="b">Beta</lr-option>
      <lr-option value="c">Gamma</lr-option>
      <lr-option value="d">Delta</lr-option>
    </lr-combobox>
  `)) as LyraCombobox;
  el.value = ["a", "b", "c", "d"];
  await el.updateComplete;
  const input = el.shadowRoot!.querySelector('[part="combobox-input"]')!;
  const described = input
    .getAttribute("aria-describedby")!
    .split(" ")
    .map((id) => el.shadowRoot!.getElementById(id)?.textContent?.trim())
    .join(" ");
  expect(described).to.contain("Alpha, Beta, Gamma, Delta");
  for (const painted of el.shadowRoot!.querySelectorAll('[part="tag__content"], [part~="tag-overflow"]')) {
    expect(painted.closest('[aria-hidden="true"]') !== null, "painted tag text stays out of the accessibility tree").to.be.true;
  }
});

it("gives a blank-label option's listbox row the raw value as its name", async () => {
  const el = (await fixture(html`
    <lr-combobox>
      <lr-option value="x"></lr-option>
    </lr-combobox>
  `)) as LyraCombobox;
  el.open = true;
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="option"]')!.textContent!.trim()).to.equal("x");
});

it("renders the native autocomplete attribute only when configured", async () => {
  const el = (await fixture(basic())) as LyraCombobox;
  const input = () =>
    el.shadowRoot!.querySelector('[part="combobox-input"]') as HTMLInputElement;

  expect(input().getAttribute("autocomplete")).to.equal("off");
  el.autocomplete = "";
  await el.updateComplete;
  expect(input().hasAttribute("autocomplete")).to.be.false;
  el.autocomplete = "one-time-code";
  await el.updateComplete;
  expect(input().getAttribute("autocomplete")).to.equal("one-time-code");
});

it("is accessible", async () => {
  const el = (await fixture(basic())) as LyraCombobox;
  el.label = "Fruit";
  el.open = true;
  await el.updateComplete;
  finishListboxAnimation(el);
  await expect(el).to.be.accessible();
});

it("is accessible with the listbox open, a keyboard-active option, and selected tags (multiple)", async () => {
  // Populated-state axe check: selected-value tags with their remove buttons, and the
  // aria-activedescendant wiring, only render in this state — the open-but-untouched axe
  // test above exercises neither. Assert the populated markers rendered before running axe.
  const el = (await fixture(basic())) as LyraCombobox;
  el.label = "Fruit";
  el.multiple = true;
  el.value = ["a", "b"];
  el.open = true;
  await el.updateComplete;
  const input = el.shadowRoot!.querySelector(
    '[part="combobox-input"]'
  ) as HTMLInputElement;
  input.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "ArrowDown",
      bubbles: true,
      composed: true,
    })
  );
  await el.updateComplete;
  expect(
    el.shadowRoot!.querySelectorAll('[part="tag"]').length
  ).to.be.greaterThan(0);
  expect(el.shadowRoot!.querySelector('[part="tag__remove-button"]') !== null)
    .to.be.true;
  expect(input.getAttribute("aria-activedescendant")).to.not.be.empty;
  finishListboxAnimation(el);
  await expect(el).to.be.accessible();
});

it("transitions the listbox with the shared fast-transition token and respects reduced motion", async () => {
  const css = styles.cssText;
  const listboxBlock = /\[part=['"]?listbox['"]?]\s*{([^}]*)}/.exec(css);
  expect(listboxBlock, 'expected a base [part="listbox"] rule').to.not.equal(
    null
  );
  expect(listboxBlock![1]).to.include("var(--lr-transition-fast)");
  expect(css).to.match(/@media\s*\(prefers-reduced-motion:\s*reduce\)/);

  try {
    await setReducedMotion("no-preference");
    const el = (await fixture(html`
      <lr-combobox style="--lr-transition-fast: 2s">
        <lr-option value="a">Apple</lr-option>
      </lr-combobox>
    `)) as LyraCombobox;
    const listbox = el.shadowRoot!.querySelector<HTMLElement>('[part="listbox"]')!;
    expect(
      getComputedStyle(listbox)
        .transitionDuration.split(", ")
        .every((duration) => duration === "2s")
    ).to.equal(true);

    await setReducedMotion("reduce");
    await waitUntil(
      () => getComputedStyle(listbox).transitionDuration === "0s",
      "combobox listbox transition did not stop under reduced motion"
    );
  } finally {
    await setReducedMotion("no-preference");
  }
});

it("uses the shared disabled-opacity token for the disabled host and disabled options", async () => {
  const el = (await fixture(html`
    <lr-combobox open>
      <lr-option value="a">Apple</lr-option>
      <lr-option value="b" disabled>Banana</lr-option>
    </lr-combobox>
  `)) as LyraCombobox;
  await el.updateComplete;

  const css = styles.cssText;
  const disabledHostBlock =
    /:host\(:disabled\)\s*\[part=['"]?combobox['"]?]\s*{([^}]*)}/.exec(css);
  expect(
    disabledHostBlock,
    'expected a :host(:disabled) [part="combobox"] rule'
  ).to.not.equal(null);
  expect(disabledHostBlock![1]).to.include("var(--lr-opacity-disabled)");

  const disabledOptionBlock =
    /\[part=['"]?option['"]?]\[aria-disabled=['"]?true['"]?]\s*{([^}]*)}/.exec(
      css
    );
  expect(
    disabledOptionBlock,
    'expected a [part="option"][aria-disabled="true"] rule'
  ).to.not.equal(null);
  expect(disabledOptionBlock![1]).to.include("var(--lr-opacity-disabled)");

  const disabledOption = el.shadowRoot!.querySelectorAll(
    '[part="option"]'
  )[1] as HTMLElement;
  expect(getComputedStyle(disabledOption).opacity).to.equal("0.5");
});

it("inherits the theme-wide form-control radius at a compact size tier", async () => {
  const wrapper = await fixture<HTMLElement>(html`
    <div style="--lr-theme-form-control-radius: 17px">
      <lr-combobox size="xs"
        ><lr-option value="a">Apple</lr-option></lr-combobox
      >
    </div>
  `);
  const el = wrapper.querySelector("lr-combobox") as LyraCombobox;
  await el.updateComplete;
  const combobox = el.shadowRoot!.querySelector(
    '[part="combobox"]'
  ) as HTMLElement;
  expect(getComputedStyle(combobox).borderTopLeftRadius).to.equal("17px");
});

it("retunes the trigger gap and corner radius with no ::part(combobox) rule", async () => {
  const el = (await fixture(basic())) as LyraCombobox;
  el.style.setProperty("--lr-combobox-gap", "12px");
  el.style.setProperty("--lr-combobox-radius", "3px");
  await el.updateComplete;
  const combobox = el.shadowRoot!.querySelector(
    '[part="combobox"]'
  ) as HTMLElement;
  const cs = getComputedStyle(combobox);
  expect(cs.gap).to.equal("12px");
  expect(cs.borderRadius).to.equal("3px");
});

it("exposes --lr-combobox-tag-bg/-color/-radius, defaulting to the pre-existing shared tokens", async () => {
  const el = (await fixture(html`
    <lr-combobox multiple>
      <lr-option value="a" selected>Apple</lr-option>
    </lr-combobox>
  `)) as LyraCombobox;
  const tag = el.shadowRoot!.querySelector('[part="tag"]') as HTMLElement;
  const probe = document.createElement("span");
  probe.style.color = "var(--lr-color-brand-quiet)";
  el.shadowRoot!.append(probe);
  const sharedBrandQuiet = getComputedStyle(probe).color;
  probe.remove();
  expect(getComputedStyle(tag).backgroundColor).to.equal(sharedBrandQuiet);
  expect(getComputedStyle(tag).borderRadius).to.equal("8px");
});

it("lets a consumer retint the tag background/text/radius with no ::part(tag) rule", async () => {
  const el = (await fixture(html`
    <lr-combobox
      multiple
      style="--lr-combobox-tag-bg: rgb(1, 2, 3); --lr-combobox-tag-color: rgb(4, 5, 6); --lr-combobox-tag-radius: 3px;"
    >
      <lr-option value="a" selected>Apple</lr-option>
    </lr-combobox>
  `)) as LyraCombobox;
  const tag = el.shadowRoot!.querySelector('[part="tag"]') as HTMLElement;
  expect(getComputedStyle(tag).backgroundColor).to.equal("rgb(1, 2, 3)");
  expect(getComputedStyle(tag).color).to.equal("rgb(4, 5, 6)");
  expect(getComputedStyle(tag).borderRadius).to.equal("3px");
});

it("gives the clear button and expand icon a real touch target instead of collapsing to bare glyph height", async () => {
  const css = styles.cssText;
  // [part='clear-button'] and [part='expand-icon'] used to share one rule for their sizing; they
  // now resolve independently ([[part='clear-button'] to the full --lr-icon-button-size floor,
  // since it's a real independently-focusable button; [part='expand-icon'] to its smaller capped
  // box, since it's a decorative aria-hidden indicator with no click handler of its own) -- both
  // still reference the shared token.
  // Each part now has its own dedicated sizing rule (in addition to the shared base rule the two
  // still share for layout/color/cursor) -- there can be more than one block whose selector
  // matches either part, so scan every match and require at least one dedicated rule per part to
  // reference the shared token.
  const clearBlocks = [
    ...css.matchAll(/\[part=['"]?clear-button['"]?]\s*{([^}]*)}/g),
  ];
  expect(
    clearBlocks.length,
    'expected at least one [part="clear-button"] rule'
  ).to.be.greaterThan(0);
  expect(clearBlocks.some((match) => match[1]?.includes("var(--lr-icon-button-size)")))
    .to.be.true;
  const expandBlocks = [
    ...css.matchAll(/\[part=['"]?expand-icon['"]?]\s*{([^}]*)}/g),
  ];
  expect(
    expandBlocks.length,
    'expected at least one [part="expand-icon"] rule'
  ).to.be.greaterThan(0);
  expect(expandBlocks.some((match) => match[1]?.includes("var(--lr-icon-button-size)")))
    .to.be.true;

  const el = (await fixture(basic())) as LyraCombobox;
  el.withClear = true;
  el.value = "a";
  await el.updateComplete;
  const clearBtn = el.shadowRoot!.querySelector(
    '[part="clear-button"]'
  ) as HTMLElement;
  expect(clearBtn.getBoundingClientRect().height).to.be.greaterThan(24);
  // WCAG 2.2 SC 2.5.8 requires a 24x24 CSS-px minimum target *in both
  // dimensions* — a tall-but-narrow button still fails it.
  expect(clearBtn.getBoundingClientRect().width).to.be.greaterThan(24);

  const expandIcon = el.shadowRoot!.querySelector(
    '[part="expand-icon"]'
  ) as HTMLElement;
  expect(expandIcon.getBoundingClientRect().width).to.be.greaterThan(24);
});

it("meets the shared hit-area floor on the tag remove button and clear button", async () => {
  const el = (await fixture(basic())) as LyraCombobox;
  el.multiple = true;
  el.withClear = true;
  el.value = ["a"];
  await el.updateComplete;

  const removeBtn = el.shadowRoot!.querySelector(
    '[part="tag__remove-button"]'
  ) as HTMLElement;
  expect(getComputedStyle(removeBtn).minInlineSize).to.equal("36px");
  expect(getComputedStyle(removeBtn).minBlockSize).to.equal("36px");

  const clearBtn = el.shadowRoot!.querySelector(
    '[part="clear-button"]'
  ) as HTMLElement;
  expect(getComputedStyle(clearBtn).minInlineSize).to.equal("36px");
  expect(getComputedStyle(clearBtn).minBlockSize).to.equal("36px");
});

it("renders errorText in var(--lr-color-danger), distinct from and alongside the hint", async () => {
  const el = (await fixture(basic())) as LyraCombobox;
  el.hint = "Pick a fruit";
  el.errorText = "Selection required";
  await el.updateComplete;

  const errorPart = el.shadowRoot!.querySelector(
    '[part="error"]'
  ) as HTMLElement;
  const hintPart = el.shadowRoot!.querySelector('[part="hint"]') as HTMLElement;
  expect(errorPart !== null).to.be.true;
  expect(errorPart.textContent).to.contain("Selection required");
  expect(hintPart.textContent).to.contain("Pick a fruit");
  expect(getComputedStyle(errorPart).color).to.not.equal(
    getComputedStyle(hintPart).color
  );
});

it("shows a required-field asterisk after the label", async () => {
  const el = (await fixture(basic())) as LyraCombobox;
  el.label = "Fruit";
  el.required = true;
  await el.updateComplete;

  const label = el.shadowRoot!.querySelector(
    '[part="form-control-label"]'
  ) as HTMLElement;
  const after = getComputedStyle(label, "::after");
  expect(after.content).to.contain("*");
});

it("does not render an orphaned asterisk when required but no label is provided", async () => {
  const el = (await fixture(html`
    <lr-combobox required>
      <lr-option value="a">Apple</lr-option>
    </lr-combobox>
  `)) as LyraCombobox;
  await el.updateComplete;

  // The label box always contains a literal `<slot name="label">` child,
  // so `:empty` can never match it (same bug class already fixed for
  // hint/error) -- real emptiness must be tracked in JS and reflected via
  // `hidden`, or the required-asterisk `::after` (which attaches to this
  // box) renders a stray ' *' with nothing before it.
  const label = el.shadowRoot!.querySelector(
    '[part="form-control-label"]'
  ) as HTMLElement;
  expect(getComputedStyle(label).display).to.equal("none");
});

it("renders a data-value on each option row for delegated click/mousedown handling", async () => {
  const el = (await fixture(basic())) as LyraCombobox;
  el.open = true;
  await el.updateComplete;
  const first = el.shadowRoot!.querySelector('[part="option"]') as HTMLElement;
  expect(first.dataset['value']).to.equal("a");
});

it("resolves the correct row via a delegated listbox listener after a re-render reorders options", async () => {
  const el = (await fixture(basic())) as LyraCombobox;
  el.open = true;
  await el.updateComplete;
  // Force a re-render that changes row content (typing a filter) -- the
  // delegated listbox listener must resolve *current* row data via its
  // data-value lookup rather than any closure captured in an earlier render.
  await typeQuery(el, "a");
  await el.updateComplete;
  const row = el.shadowRoot!.querySelector('[part="option"]') as HTMLElement;
  setTimeout(() => row.click());
  await oneEvent(el, "change");
  expect(el.value).to.equal("a");
});

it("pairs the form-control label with the combobox input via for/id so clicking the label focuses it", async () => {
  const el = (await fixture(basic())) as LyraCombobox;
  el.label = "Fruit";
  await el.updateComplete;
  const label = el.shadowRoot!.querySelector(
    '[part="form-control-label"]'
  ) as HTMLLabelElement;
  const input = el.shadowRoot!.querySelector(
    '[part="combobox-input"]'
  ) as HTMLInputElement;
  expect(label.htmlFor, "label should have a for attribute").to.not.equal("");
  expect(label.htmlFor).to.equal(input.id);
});

it("renders sub and dot-color from light-DOM options", async () => {
  const el = (await fixture(html`
    <lr-combobox>
      <lr-option value="a" sub="Running" dot-color="green">Meter A</lr-option>
    </lr-combobox>
  `)) as LyraCombobox;
  el.open = true;
  await el.updateComplete;

  expect(
    el.shadowRoot!.querySelector('[part="option-sub"]')!.textContent
  ).to.equal("Running");
  expect(
    (el.shadowRoot!.querySelector('[part="option-dot"]') as HTMLElement).style
      .background
  ).to.equal("green");
});

it("formats the option-overflow count with the effective locale", async () => {
  const el = (await fixture(
    html`<lr-combobox lang="ar-EG" max-render="3"></lr-combobox>`
  )) as LyraCombobox;
  for (let i = 0; i < 10; i++) {
    const opt = document.createElement("lr-option");
    opt.value = `${i}`;
    opt.textContent = `Item ${i}`;
    el.appendChild(opt);
  }
  el.open = true;
  await el.updateComplete;
  expect(
    el.shadowRoot!.querySelector('[part="option-overflow"]')!.textContent
  ).to.include(new Intl.NumberFormat("ar-EG").format(7));
});

it("calls source with the current query (debounced) and renders its rows", async () => {
  const el = (await fixture(html`<lr-combobox></lr-combobox>`)) as LyraCombobox;
  const calls: string[] = [];
  el.source = async (query: string) => {
    calls.push(query);
    return [{ value: "x", label: `Result for "${query}"` }];
  };
  el.open = true;
  await el.updateComplete;
  await settleComboboxSource(el);
  await el.updateComplete;

  expect(calls).to.deep.equal([""]);
  expect(
    el.shadowRoot!.querySelector('[part="option"] [part="option-label"]')!
      .textContent
  ).to.contain('Result for ""');

  await typeQuery(el, "ban");
  await settleComboboxSource(el);
  await el.updateComplete;

  expect(calls).to.deep.equal(["", "ban"]);
});

it("uses a custom filter function instead of the default label/searchText matcher when provided", async () => {
  const el = (await fixture(basic())) as LyraCombobox;
  el.filter = (option, query) => option.value === query;
  el.open = true;
  await el.updateComplete;

  await typeQuery(el, "a");
  // The default label/searchText matcher would also match "Banana" (its
  // label contains "a"); only the custom filter narrows this to one row.
  const rows = el.shadowRoot!.querySelectorAll('[part="option"]');
  expect(rows.length).to.equal(1);
  expect(requiredItem(rows, 0, 'filtered option').textContent).to.contain("Apple");
});

it("renders a group-label header when option rows are grouped", async () => {
  const el = (await fixture(html`
    <lr-combobox>
      <lr-option value="a" group="Fruits">Apple</lr-option>
      <lr-option value="b" group="Fruits">Banana</lr-option>
      <lr-option value="c" group="Vegetables">Carrot</lr-option>
    </lr-combobox>
  `)) as LyraCombobox;
  el.open = true;
  await el.updateComplete;

  const groups = Array.from(
    el.shadowRoot!.querySelectorAll(".group-label")
  ).map((n) => n.textContent);
  expect(groups).to.deep.equal(["Fruits", "Vegetables"]);
});

it('exposes each option-group heading as part="group-label", the name lr-select uses', async () => {
  const el = (await fixture(html`
    <lr-combobox>
      <lr-option value="a" group="Fruits">Apple</lr-option>
      <lr-option value="b" group="Vegetables">Carrot</lr-option>
    </lr-combobox>
  `)) as LyraCombobox;
  el.open = true;
  await el.updateComplete;

  const labels = [...el.shadowRoot!.querySelectorAll('[part~="group-label"]')];
  expect(labels.map((node) => node.textContent)).to.deep.equal([
    "Fruits",
    "Vegetables",
  ]);
  // The part is the styling handle: an outer ::part() rule must reach it.
  const style = document.createElement("style");
  style.textContent = "lr-combobox::part(group-label) { letter-spacing: 3px; }";
  document.head.append(style);
  try {
    expect(getComputedStyle(labels[0] as HTMLElement).letterSpacing).to.equal(
      "3px"
    );
  } finally {
    style.remove();
  }
});

it("is accessible while showing the loading state (async source pending)", async () => {
  const el = (await fixture(
    html`<lr-combobox source-delay="0"></lr-combobox>`
  )) as LyraCombobox;
  el.source = () => new Promise(() => {});
  el.open = true;
  await el.updateComplete;

  await waitUntil(
    () => el.shadowRoot!.querySelector(".loading") !== null,
    "loading state was not rendered before the accessibility check",
    { timeout: 2000 }
  );
  finishListboxAnimation(el);
  await expect(el).to.be.accessible();
});

it("renders structured async-row adornments and preserves selected opaque data", async () => {
  const el = (await fixture(html`<lr-combobox></lr-combobox>`)) as LyraCombobox;
  const payload = { kind: "city", longitude: 6.13 };
  el.source = async () => [
    {
      value: "lux",
      label: "Luxembourg",
      sub: "Lëtzebuerg",
      start: html`<span id="async-row-start">LU</span>`,
      icon: html`<button id="nested-async-row-icon" type="button">⌖</button>`,
      badge: "City",
      end: html`<span id="async-row-end">EU</span>`,
      accessibleLabel: "Luxembourg, city in Luxembourg",
      data: payload,
    },
  ];
  el.open = true;
  await el.updateComplete;
  await settleComboboxSource(el);
  await el.updateComplete;

  const row = el.shadowRoot!.querySelector('[part="option"]') as HTMLElement;
  expect(row.getAttribute("aria-label")).to.equal(
    "Luxembourg, city in Luxembourg"
  );
  const icon = row.querySelector<HTMLElement>('[part="option-icon"]')!;
  const nestedIconButton = icon.querySelector<HTMLButtonElement>(
    "#nested-async-row-icon"
  )!;
  expect(icon.getAttribute("aria-hidden")).to.equal("true");
  expect(icon.hasAttribute("inert")).to.equal(true);
  expect(nestedIconButton.getBoundingClientRect().width).to.be.greaterThan(0);
  const start = row.querySelector<HTMLElement>('[part="option-start"]')!;
  const end = row.querySelector<HTMLElement>('[part="option-end"]')!;
  expect(start.getAttribute("aria-hidden")).to.equal("true");
  expect(start.hasAttribute("inert")).to.equal(true);
  expect(start.querySelector("#async-row-start")?.textContent).to.equal("LU");
  expect(end.getAttribute("aria-hidden")).to.equal("true");
  expect(end.hasAttribute("inert")).to.equal(true);
  expect(end.querySelector("#async-row-end")?.textContent).to.equal("EU");
  const input = el.shadowRoot!.querySelector<HTMLInputElement>(
    '[part="combobox-input"]'
  )!;
  input.focus();
  nestedIconButton.focus();
  expect(el.shadowRoot!.activeElement === input).to.equal(true);
  expect(row.querySelector('[part="option-badge"]')?.textContent).to.equal(
    "City"
  );
  finishListboxAnimation(el);
  await expect(el).to.be.accessible();
  row.click();
  await el.updateComplete;
  expect(el.selectedRows).to.have.length(1);
  expect(el.selectedRows[0]!.data).to.equal(payload);
});

it("is accessible while showing the empty state (no matching rows)", async () => {
  const el = (await fixture(html`<lr-combobox></lr-combobox>`)) as LyraCombobox;
  el.open = true;
  await el.updateComplete;

  expect(el.shadowRoot!.querySelector(".empty") !== null).to.be.true;
  finishListboxAnimation(el);
  await expect(el).to.be.accessible();
});

it("reflects required/invalid state onto the input as aria-required/aria-invalid", async () => {
  const el = (await fixture(html`
    <lr-combobox required>
      <lr-option value="a">Apple</lr-option>
    </lr-combobox>
  `)) as LyraCombobox;
  await el.updateComplete;
  const input = el.shadowRoot!.querySelector(
    '[part="combobox-input"]'
  ) as HTMLInputElement;
  expect(input.getAttribute("aria-required")).to.equal("true");
  expect(input.getAttribute("aria-invalid")).to.equal("false");

  input.dispatchEvent(new FocusEvent("focus"));
  input.dispatchEvent(new FocusEvent("blur"));
  await el.updateComplete;
  expect(input.getAttribute("aria-invalid")).to.equal("true");
});

it("keeps the dropdown open on a mousedown inside the listbox but outside any option (scrollbar, group label, overflow row)", async () => {
  const el = (await fixture(basic())) as LyraCombobox;
  const input = el.shadowRoot!.querySelector(
    '[part="combobox-input"]'
  ) as HTMLInputElement;
  input.focus();
  await el.updateComplete;
  expect(el.open).to.be.true;

  const listbox = el.shadowRoot!.querySelector(
    '[part="listbox"]'
  ) as HTMLElement;
  const ev = new MouseEvent("mousedown", {
    bubbles: true,
    composed: true,
    cancelable: true,
  });
  listbox.dispatchEvent(ev);
  // The browser's default action for an uncancelled mousedown moves focus to
  // the pressed element, blurring the input. Synthetic dispatchEvent never
  // runs default actions, so replicate that blur here for the un-prevented
  // path -- exactly what happens when a user grabs the listbox scrollbar.
  if (!ev.defaultPrevented) input.dispatchEvent(new FocusEvent("blur"));
  await el.updateComplete;

  expect(
    el.open,
    "dropdown must stay open while interacting with the listbox itself"
  ).to.be.true;
  expect(
    ev.defaultPrevented,
    "mousedown default must be prevented so the input keeps focus"
  ).to.be.true;
  expect(el.shadowRoot!.activeElement?.getAttribute("part")).to.equal(
    "combobox-input"
  );
});

it("prefers a host-level aria-label over label/placeholder for the input", async () => {
  const el = (await fixture(
    html`<lr-combobox
      aria-label="Filter items"
      placeholder="Search…"
    ></lr-combobox>`
  )) as LyraCombobox;
  const input = el.shadowRoot!.querySelector(
    '[part="combobox-input"]'
  ) as HTMLElement;
  expect(input.getAttribute("aria-label")).to.equal("Filter items");
});

it("falls back to placeholder when no host aria-label or label is set", async () => {
  const el = (await fixture(
    html`<lr-combobox placeholder="Search…"></lr-combobox>`
  )) as LyraCombobox;
  const input = el.shadowRoot!.querySelector(
    '[part="combobox-input"]'
  ) as HTMLElement;
  expect(input.getAttribute("aria-label")).to.equal("Search…");
});

it("re-renders when an already-slotted option mutates its own label", async () => {
  const el = (await fixture(
    html`<lr-combobox><lr-option value="x">Old label</lr-option></lr-combobox>`
  )) as LyraCombobox;
  // Open *before* mutating the option's label so the `lr-option-change`
  // notification path (MutationObserver -> emit -> `onOptionChange()`
  // reassigning `options`) is the only thing that can update the
  // already-rendered row afterward -- opening *after* the mutation (the
  // previous version of this test) forces an ordinary first-render read of
  // live option data regardless of whether that path ever fired.
  el.open = true;
  await el.updateComplete;
  const row = () => el.shadowRoot!.querySelector('[part="option"]')!;
  expect(row().textContent).to.include("Old label");

  const option = el.querySelector("lr-option")!;
  option.textContent = "New label";
  // The MutationObserver callback (and the `lr-option-change` ->
  // `onOptionChange()` -> `requestUpdate()` chain it triggers) runs on its
  // own microtask queue -- by the time this line reaches `updateComplete`,
  // the getter may still capture the *previous*, already-settled update
  // promise rather than the new one the mutation is about to schedule. Force
  // a macrotask boundary first (same fix as the slotchange/async-source
  // timing elsewhere in this file) so the new update is already pending (or
  // done) by the time `updateComplete` is evaluated below.
  await aTimeout(0);
  await el.updateComplete;
  expect(row().textContent).to.include("New label");
});

it("resolves a programmatically-set value to its label from asyncRows, warming the fetch before the listbox ever opens (single-select)", async () => {
  const el = (await fixture(html`<lr-combobox></lr-combobox>`)) as LyraCombobox;
  el.source = async () => [
    { value: "a", label: "Apple" },
    { value: "b", label: "Banana" },
  ];
  // Set the value first, then let the element render -- this must warm
  // `asyncRows` on its own, without the listbox ever having been opened.
  el.value = "b";
  await el.updateComplete;
  await settleComboboxSource(el);
  await el.updateComplete;

  const input = el.shadowRoot!.querySelector(
    '[part="combobox-input"]'
  ) as HTMLInputElement;
  expect(el.open).to.be.false;
  expect(input.value).to.equal("Banana");
});

it("associates grouped options through role=group and aria-labelledby", async () => {
  const el = (await fixture(html`
    <lr-combobox open>
      <lr-option value="a" group="Fruit">Apple</lr-option>
      <lr-option value="b" group="Fruit">Banana</lr-option>
      <lr-option value="c" group="Vegetables">Carrot</lr-option>
    </lr-combobox>
  `)) as LyraCombobox;
  await aTimeout(0);
  await el.updateComplete;
  const groups = [
    ...el.shadowRoot!.querySelectorAll('[role="group"]'),
  ] as HTMLElement[];
  expect(groups.length).to.equal(2);
  for (const group of groups) {
    const labelId = group.getAttribute("aria-labelledby")!;
    expect(labelId).to.not.equal("");
    expect(
      el.shadowRoot!.getElementById(labelId)?.textContent?.trim()
    ).to.not.equal("");
    expect(group.querySelectorAll('[role="option"]').length).to.be.greaterThan(
      0
    );
  }
});

it("omits aria-activedescendant when no option is active", async () => {
  const el = (await fixture(
    html`<lr-combobox open></lr-combobox>`
  )) as LyraCombobox;
  const input = el.shadowRoot!.querySelector(
    '[part="combobox-input"]'
  ) as HTMLInputElement;
  expect(input.hasAttribute("aria-activedescendant")).to.be.false;
});

it("localizes and locale-formats the selected-tag overflow count", async () => {
  const el = (await fixture(html`
    <lr-combobox
      multiple
      max-options-visible="1"
      locale="ar-EG"
      .strings=${{ comboboxSelectedOverflow: "{n} إضافية" }}
    >
      <lr-option value="a">A</lr-option>
      <lr-option value="b">B</lr-option>
      <lr-option value="c">C</lr-option>
    </lr-combobox>
  `)) as LyraCombobox;
  el.value = ["a", "b", "c"];
  await el.updateComplete;
  // [part~=] because the overflow tag now carries both 'tag' and 'tag-overflow'.
  expect(
    el.shadowRoot!.querySelectorAll('[part~="tag"]')[1]!.textContent?.trim()
  ).to.equal("٢ إضافية");
});

it("renders a localized, non-live error row and announces each async source failure in light DOM", async () => {
  const el = (await fixture(html`
    <lr-combobox
      source-delay="0"
      open
      .strings=${{ comboboxLoadError: "Options unavailable" }}
    ></lr-combobox>
  `)) as LyraCombobox;
  const originalWarn = console.warn;
  console.warn = () => {};
  try {
    el.source = async () => {
      throw new Error("private server detail");
    };
    await el.updateComplete;
    await aTimeout(20);
    await el.updateComplete;
    const error = el.shadowRoot!.querySelector(".source-error") as HTMLElement;
    // The copy now lives on the shared state renderer's composed <lr-empty>, whose heading is in
    // its own shadow root; the row itself is the presentational wrapper holding it and the retry.
    const state = error.querySelector('[part~="source-error"]') as HTMLElement;
    expect(state.getAttribute("heading")).to.equal("Options unavailable");
    expect(error.textContent).to.not.contain("private server detail");
    expect(error.getAttribute("role")).to.equal("presentation");
    expect(
      el.shadowRoot!.querySelectorAll(
        '[role="alert"], [role="status"], [aria-live]'
      ).length
    ).to.equal(0);
    expect(assertiveAnnouncements()).to.deep.equal(["Options unavailable"]);
    expect(el.shadowRoot!.querySelectorAll('[part="option"]').length).to.equal(
      0
    );

    el.source = async () => {
      throw new Error("different private detail");
    };
    await el.updateComplete;
    await aTimeout(20);
    await el.updateComplete;
    expect(assertiveAnnouncements()).to.deep.equal([
      "Options unavailable",
      "Options unavailable",
    ]);
  } finally {
    console.warn = originalWarn;
  }
});

it("resolves a programmatically-set value to its label from asyncRows in multi-select tag chips", async () => {
  const el = (await fixture(
    html`<lr-combobox multiple></lr-combobox>`
  )) as LyraCombobox;
  el.source = async () => [
    { value: "a", label: "Apple" },
    { value: "b", label: "Banana" },
  ];
  el.value = ["a", "b"];
  await el.updateComplete;
  await settleComboboxSource(el);
  await el.updateComplete;

  const tagLabels = Array.from(
    el.shadowRoot!.querySelectorAll('[part="tag"]')
  ).map((t) => t.textContent?.trim());
  expect(tagLabels).to.deep.equal(["Apple", "Banana"]);
});

it("uses a custom overflowText with a {n} token substitution instead of the hardcoded default", async () => {
  const el = (await fixture(
    html`<lr-combobox
      max-render="3"
      overflow-text="Only 3 shown, {n} hidden"
    ></lr-combobox>`
  )) as LyraCombobox;
  for (let i = 0; i < 10; i++) {
    const opt = document.createElement("lr-option");
    opt.value = `${i}`;
    opt.textContent = `Item ${i}`;
    el.appendChild(opt);
  }
  el.open = true;
  await el.updateComplete;

  expect(
    el.shadowRoot!.querySelector('[part="option-overflow"]')!.textContent
  ).to.equal("Only 3 shown, 7 hidden");
});

it('leaves an unrecognized {token} untouched in a custom overflowText override', async () => {
  const el = (await fixture(
    html`<lr-combobox
      max-render="3"
      overflow-text="Only 3 shown, {n} hidden ({label})"
    ></lr-combobox>`
  )) as LyraCombobox;
  for (let i = 0; i < 10; i++) {
    const opt = document.createElement("lr-option");
    opt.value = `${i}`;
    opt.textContent = `Item ${i}`;
    el.appendChild(opt);
  }
  el.open = true;
  await el.updateComplete;

  expect(
    el.shadowRoot!.querySelector('[part="option-overflow"]')!.textContent
  ).to.equal("Only 3 shown, 7 hidden ({label})");
});

it("folds the filter query and option labels through locale-aware toLocaleLowerCase, not the invariant toLowerCase", async () => {
  // Under a Turkish/Azeri locale, invariant `toLowerCase()` maps capital
  // dotted İ (U+0130) to 'i' + a combining dot above (U+0069 U+0307), not
  // plain 'i' -- so `'İstanbul'.toLowerCase()` never contains the substring
  // 'istanbul' a user actually types. `toLocaleLowerCase('tr')` folds it
  // correctly to plain 'istanbul'.
  //
  // No `tr` catalog ships (this library's purpose here is only the locale-aware casefold, not
  // Turkish strings), so this intentionally exercises the dev-mode locale-fallback warning path
  // rather than registering one -- swallow it rather than letting it reach strict-console lanes.
  const originalWarn = console.warn;
  console.warn = () => {};
  let el: LyraCombobox;
  try {
    el = (await fixture(html`
      <lr-combobox locale="tr">
        <lr-option value="ist">İstanbul</lr-option>
      </lr-combobox>
    `)) as LyraCombobox;
    el.open = true;
    await el.updateComplete;
  } finally {
    console.warn = originalWarn;
  }

  await typeQuery(el, "istanbul");
  const rows = el.shadowRoot!.querySelectorAll('[part="option"]');
  expect(rows.length).to.equal(1);
});

describe("size", () => {
  // Locked to literal pixels rather than to each other: adopting the shared form-control ladder
  // moved where these numbers are DECLARED, and the whole point is that it did not move the
  // numbers. A relative assertion would have passed either way.
  const TIER_HEIGHTS: ReadonlyArray<readonly [string, string]> = [
    ["2xs", "20px"],
    ["xs", "24px"],
    ["s", "32px"],
    ["m", "36px"],
    ["l", "40px"],
    ["xl", "56px"],
  ];

  it("renders the shared trigger height at every tier", async () => {
    for (const [size, px] of TIER_HEIGHTS) {
      const el = await fixture(
        html`<lr-combobox size=${size} label="Tags"></lr-combobox>`
      );
      const trigger = el.shadowRoot!.querySelector(
        '[part="combobox"]'
      ) as HTMLElement;
      expect(
        getComputedStyle(trigger).minBlockSize,
        `min-block-size at size=${size}`
      ).to.equal(px);
    }
  });

  it("renders the laid-out trigger box at the ladder floor, not the ambient font metrics, at every tier", async () => {
    // Deliberately the SAME six numbers TIER_HEIGHTS asserts as the min-block-size floor: the
    // trigger's laid-out height must be decided by the floor at every tier, never by its own
    // content. Content wins only if the search input's text box plus this row's block padding plus
    // its border outgrows the floor, and that text box is `line-height: normal` -- a metric of
    // whatever font family system-ui resolves to on the machine running the test. xs used to read
    // 25 for exactly that reason, which made the assertion a fingerprint of one machine's installed
    // fonts (a CI runner rendered 24) and left the trigger a pixel taller than the lr-input beside
    // it.
    const expected: ReadonlyArray<readonly [string, number]> = [
      ["2xs", 20],
      ["xs", 24],
      ["s", 32],
      ["m", 36],
      ["l", 40],
      ["xl", 56],
    ];
    for (const [size, px] of expected) {
      const el = await fixture(
        html`<lr-combobox size=${size} label="Tags"></lr-combobox>`
      );
      const trigger = el.shadowRoot!.querySelector(
        '[part="combobox"]'
      ) as HTMLElement;
      expect(
        trigger.getBoundingClientRect().height,
        `laid-out height at size=${size}`
      ).to.equal(px);
    }
  });

  it("scales the clear-button hit-area floor down at compact tiers instead of forcing the full unscaled icon-button-size on every tier", async () => {
    async function triggerHeight(size: string): Promise<number> {
      const el = (await fixture(html`
        <lr-combobox size=${size} label="Tags" clearable>
          <lr-option value="a" selected>Apple</lr-option>
        </lr-combobox>
      `)) as LyraCombobox;
      await el.updateComplete;
      expect(
        el.shadowRoot!.querySelector('[part="clear-button"]'),
        `clear button present at size=${size}`
      ).to.not.equal(null);
      return (
        el.shadowRoot!.querySelector('[part="combobox"]') as HTMLElement
      ).getBoundingClientRect().height;
    }
    // Before this fix, [part="clear-button"] forced min-inline/block-size to the unscaled
    // --lr-icon-button-size at every tier: this component's theme resolves that to 42px, so a
    // 2xs/xs/s row (whose own un-clearable height ladder is 20/24/30px) was always forced to 42.
    // Each compact tier's row must now render strictly under that unscaled floor.
    for (const size of ["2xs", "xs", "s"]) {
      expect(
        await triggerHeight(size),
        `size=${size} clear-button row must scale below the unscaled 42px --lr-icon-button-size floor`
      ).to.be.lessThan(42);
    }
  });

  // The invariant sizes.styles.ts actually promises -- "a control of any of those types sits at the
  // same height as its neighbours in a toolbar row at every tier" -- asserted as one row of real
  // neighbours rather than five separate per-component pixel tables. Nothing used to cover it past
  // size="s" (see the size="s" alignment test further down), which is how lr-combobox and
  // lr-token-input drifted 1-7px off the rest of the ladder at xs/l/xl without a red test.
  it("lays every laddered control out at the same height as its toolbar neighbours, at every tier", async () => {
    const SELECTORS: ReadonlyArray<readonly [string, string]> = [
      ["lr-input", "input-wrapper"],
      ["lr-select", "trigger"],
      ["lr-button", "base"],
      ["lr-combobox", "combobox"],
      ["lr-token-input", "input-wrapper"],
    ];
    for (const [size, px] of TIER_HEIGHTS) {
      const root = await fixture(html`
        <div style="display:flex;align-items:center;">
          <lr-input size=${size} aria-label="Input"></lr-input>
          <lr-select size=${size} aria-label="Select"></lr-select>
          <lr-button size=${size}>Go</lr-button>
          <lr-combobox size=${size} aria-label="Combobox"
            ><lr-option value="a">Apple</lr-option></lr-combobox
          >
          <lr-token-input size=${size} aria-label="Tokens"></lr-token-input>
        </div>
      `);
      const heights = SELECTORS.map(([tag, part]) => {
        const box = root
          .querySelector(tag)!
          .shadowRoot!.querySelector(`[part~="${part}"]`) as HTMLElement;
        return box.getBoundingClientRect().height;
      });
      const labelled = SELECTORS.map(([tag], i) => `${tag}=${heights[i]}`).join(
        ", "
      );
      expect(
        new Set(heights).size,
        `size=${size} heights: ${labelled}`
      ).to.equal(1);
      // ...and that one height is the ladder's own floor, not whatever the ambient font happened to
      // push every control to in unison.
      expect(`${heights[0]}px`, `size=${size} ladder floor`).to.equal(px);
    }
  });

  it("accepts the Web Awesome size spellings, rendering small/medium/large as s/m/l", async () => {
    const pairs: ReadonlyArray<readonly [string, string]> = [
      ["small", "s"],
      ["medium", "m"],
      ["large", "l"],
    ];
    for (const [alias, step] of pairs) {
      const aliasEl = await fixture(
        html`<lr-combobox size=${alias} label="Tags"></lr-combobox>`
      );
      const stepEl = await fixture(
        html`<lr-combobox size=${step} label="Tags"></lr-combobox>`
      );
      const box = (el: Element) =>
        el.shadowRoot!.querySelector('[part="combobox"]') as HTMLElement;
      expect(
        getComputedStyle(box(aliasEl)).minBlockSize,
        `min-block-size for ${alias}`
      ).to.equal(getComputedStyle(box(stepEl)).minBlockSize);
      expect(
        getComputedStyle(box(aliasEl)).fontSize,
        `font-size for ${alias}`
      ).to.equal(getComputedStyle(box(stepEl)).fontSize);
      expect(
        box(aliasEl).getBoundingClientRect().height,
        `laid-out height for ${alias}`
      ).to.equal(box(stepEl).getBoundingClientRect().height);
    }
  });

  it("rounds the trigger row to a pill without a ::part() rule", async () => {
    const plain = (await fixture(basic())) as LyraCombobox;
    const pill = (await fixture(html`
      <lr-combobox pill><lr-option value="a">Apple</lr-option></lr-combobox>
    `)) as LyraCombobox;
    const radius = (el: LyraCombobox) =>
      getComputedStyle(
        el.shadowRoot!.querySelector('[part="combobox"]') as HTMLElement
      ).borderStartStartRadius;
    expect(pill.pill).to.be.true;
    expect(pill.getAttribute("pill")).to.equal("");
    expect(radius(pill)).to.not.equal(radius(plain));
    expect(Number.parseFloat(radius(pill))).to.be.greaterThan(
      Number.parseFloat(radius(plain))
    );
  });

  it('defaults to size="m" and reflects the attribute', async () => {
    const el = (await fixture(basic())) as LyraCombobox;
    expect(el.size).to.equal("m");
    expect(el.getAttribute("size")).to.equal("m");
  });

  it('applies size="2xs" with a 20px trigger min-height', async () => {
    const el = await fixture(
      html`<lr-combobox size="2xs" label="Tags"></lr-combobox>`
    );
    const trigger = el.shadowRoot!.querySelector(
      '[part="combobox"]'
    ) as HTMLElement;
    expect(getComputedStyle(trigger).minBlockSize).to.equal("20px");
  });

  it('reflects size="2xs" as a host attribute', async () => {
    const el = (await fixture(
      html`<lr-combobox size="2xs"></lr-combobox>`
    )) as LyraCombobox;
    expect(el.size).to.equal("2xs");
    expect(el.getAttribute("size")).to.equal("2xs");
  });

  it("a non-default size changes the trigger min-block-size", async () => {
    const mEl = (await fixture(basic())) as LyraCombobox;
    const xsEl = (await fixture(html`
      <lr-combobox size="xs">
        <lr-option value="a">Apple</lr-option>
      </lr-combobox>
    `)) as LyraCombobox;
    const mBox = mEl.shadowRoot!.querySelector(
      '[part="combobox"]'
    ) as HTMLElement;
    const xsBox = xsEl.shadowRoot!.querySelector(
      '[part="combobox"]'
    ) as HTMLElement;
    expect(parseFloat(getComputedStyle(xsBox).minHeight)).to.be.lessThan(
      parseFloat(getComputedStyle(mBox).minHeight)
    );
  });

  it('aligns input, select, combobox, and segmented at size="s" without part overrides', async () => {
    const root = await fixture(html`
      <div style="display:flex;align-items:center;">
        <lr-input size="s" aria-label="Input"></lr-input>
        <lr-select size="s" aria-label="Select"></lr-select>
        <lr-combobox size="s" aria-label="Combobox"
          ><lr-option value="a">Apple</lr-option></lr-combobox
        >
        <lr-segmented
          size="s"
          value="a"
          .items=${[{ value: "a", label: "Alpha" }]}
        ></lr-segmented>
      </div>
    `);
    const input = root
      .querySelector("lr-input")!
      .shadowRoot!.querySelector('[part~="input-wrapper"]') as HTMLElement;
    const select = root
      .querySelector("lr-select")!
      .shadowRoot!.querySelector('[part="trigger"]') as HTMLElement;
    const combobox = root
      .querySelector("lr-combobox")!
      .shadowRoot!.querySelector('[part="combobox"]') as HTMLElement;
    const segmented = root
      .querySelector("lr-segmented")!
      .shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    const heights = [input, select, combobox, segmented].map(
      (element) => element.getBoundingClientRect().height
    );
    expect(
      new Set(heights).size,
      `control heights: ${heights.join(", ")}`
    ).to.equal(1);

    const expand = root
      .querySelector("lr-combobox")!
      .shadowRoot!.querySelector('[part="expand-icon"]') as HTMLElement;
    expect(expand.getAttribute("aria-hidden")).to.equal("true");
    expect(expand.hasAttribute("tabindex")).to.be.false;
    expect(expand.getBoundingClientRect().height).to.be.at.most(
      combobox.getBoundingClientRect().height
    );
  });

  it('the "+N" overflow tag scales its font-size with size', async () => {
    const mEl = (await fixture(html`
      <lr-combobox multiple max-options-visible="0">
        <lr-option value="a" selected>Apple</lr-option>
      </lr-combobox>
    `)) as LyraCombobox;
    const xsEl = (await fixture(html`
      <lr-combobox multiple max-options-visible="0" size="xs">
        <lr-option value="a" selected>Apple</lr-option>
      </lr-combobox>
    `)) as LyraCombobox;
    await mEl.updateComplete;
    await xsEl.updateComplete;
    // [part~=] because with max-options-visible="0" the only rendered chip is the overflow tag,
    // which now carries both 'tag' and 'tag-overflow'.
    const mTag = mEl.shadowRoot!.querySelector('[part~="tag"]') as HTMLElement;
    const xsTag = xsEl.shadowRoot!.querySelector('[part~="tag"]') as HTMLElement;
    expect(parseFloat(getComputedStyle(xsTag).fontSize)).to.be.lessThan(
      parseFloat(getComputedStyle(mTag).fontSize)
    );
  });
});

describe("exact-height escape hatch", () => {
  const combo = (el: LyraCombobox) =>
    el.shadowRoot!.querySelector('[part="combobox"]') as HTMLElement;

  it("keeps the per-size min-height floor when --lr-combobox-trigger-height is unset", async () => {
    const mEl = (await fixture(basic())) as LyraCombobox;
    const sEl = (await fixture(html`
      <lr-combobox size="s"><lr-option value="a">Apple</lr-option></lr-combobox>
    `)) as LyraCombobox;
    expect(getComputedStyle(combo(mEl)).minBlockSize).to.equal("36px");
    expect(getComputedStyle(combo(sEl)).minBlockSize).to.equal("32px");
  });

  it("pins an exact trigger height with no ::part() rule, at the default and non-default sizes", async () => {
    const mEl = (await fixture(basic())) as LyraCombobox;
    mEl.style.setProperty("--lr-combobox-trigger-height", "44px");
    await mEl.updateComplete;
    expect(getComputedStyle(combo(mEl)).blockSize).to.equal("44px");
    expect(getComputedStyle(combo(mEl)).minBlockSize).to.equal("44px");

    const sEl = (await fixture(html`
      <lr-combobox size="s"><lr-option value="a">Apple</lr-option></lr-combobox>
    `)) as LyraCombobox;
    sEl.style.setProperty("--lr-combobox-trigger-height", "44px");
    await sEl.updateComplete;
    expect(getComputedStyle(combo(sEl)).blockSize).to.equal("44px");
  });

  it("does not clip a wrapping multi-select tag row when a height is pinned", async () => {
    const el = (await fixture(html`
      <lr-combobox multiple max-options-visible="6" style="inline-size:9rem">
        <lr-option value="a" selected>Alphabet</lr-option>
        <lr-option value="b" selected>Buttercup</lr-option>
        <lr-option value="c" selected>Chrysanthemum</lr-option>
      </lr-combobox>
    `)) as LyraCombobox;
    await el.updateComplete;
    el.style.setProperty("--lr-combobox-trigger-height", "40px");
    await el.updateComplete;
    const box = combo(el);
    expect(getComputedStyle(box).blockSize).to.equal("40px");
    // Documented behaviour: the hatch is a single-row affordance. A tag row that wraps past the
    // pinned height overflows visibly rather than being clipped, so nothing becomes unreachable.
    expect(getComputedStyle(box).overflow).to.equal("visible");
    expect(box.scrollHeight).to.be.greaterThan(box.clientHeight);
  });

  it("renders lr-select, lr-combobox and lr-input at one exact toolbar height with no ::part() rule", async () => {
    const root = await fixture(html`
      <div style="display:flex;align-items:center;">
        <lr-input
          aria-label="Input"
          style="--lr-input-control-height:44px"
        ></lr-input>
        <lr-select
          aria-label="Select"
          style="--lr-select-trigger-height:44px"
        ></lr-select>
        <lr-combobox
          aria-label="Combobox"
          style="--lr-combobox-trigger-height:44px"
        >
          <lr-option value="a">Apple</lr-option>
        </lr-combobox>
      </div>
    `);
    const parts = [
      root
        .querySelector("lr-input")!
        .shadowRoot!.querySelector('[part~="input-wrapper"]') as HTMLElement,
      root
        .querySelector("lr-select")!
        .shadowRoot!.querySelector('[part="trigger"]') as HTMLElement,
      root
        .querySelector("lr-combobox")!
        .shadowRoot!.querySelector('[part="combobox"]') as HTMLElement,
    ];
    const heights = parts.map(
      (element) => element.getBoundingClientRect().height
    );
    expect(heights, `control heights: ${heights.join(", ")}`).to.deep.equal([
      44, 44, 44,
    ]);
  });
});

describe("start/end adornment slots", () => {
  const part = (el: LyraCombobox, name: string) =>
    el.shadowRoot!.querySelector(`[part="${name}"]`) as HTMLElement;

  it("renders a slotted glyph inside the trigger, before the field text, with no consumer padding", async () => {
    const el = (await fixture(html`
      <lr-combobox size="s" label="Fruit">
        <svg slot="start" width="12" height="12" aria-hidden="true">
          <circle cx="6" cy="6" r="5"></circle>
        </svg>
        <lr-option value="a">Apple</lr-option>
      </lr-combobox>
    `)) as LyraCombobox;
    await el.updateComplete;
    const start = part(el, "start");
    expect(start.hasAttribute("hidden")).to.be.false;
    const startRect = start.getBoundingClientRect();
    const boxRect = part(el, "combobox").getBoundingClientRect();
    const inputRect = part(el, "combobox-input").getBoundingClientRect();
    expect(startRect.width).to.be.greaterThan(0);
    expect(startRect.left).to.be.at.least(boxRect.left);
    expect(startRect.right).to.be.at.most(inputRect.left + 1);
  });

  it("places the end adornment before the expand icon", async () => {
    const el = (await fixture(html`
      <lr-combobox label="Fruit">
        <kbd slot="end">K</kbd>
        <lr-option value="a">Apple</lr-option>
      </lr-combobox>
    `)) as LyraCombobox;
    await el.updateComplete;
    const end = part(el, "end");
    expect(end.hasAttribute("hidden")).to.be.false;
    expect(
      end.compareDocumentPosition(part(el, "expand-icon")) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).to.be.greaterThan(0);
    expect(end.getBoundingClientRect().right).to.be.at.most(
      part(el, "expand-icon").getBoundingClientRect().left + 1
    );
  });

  it("hides both wrappers when nothing is slotted", async () => {
    const el = (await fixture(basic())) as LyraCombobox;
    await el.updateComplete;
    expect(part(el, "start").hasAttribute("hidden")).to.be.true;
    expect(part(el, "end").hasAttribute("hidden")).to.be.true;
    expect(getComputedStyle(part(el, "start")).display).to.equal("none");
    expect(getComputedStyle(part(el, "end")).display).to.equal("none");
  });

  it("reveals the wrapper when an adornment is slotted in after first render", async () => {
    const el = (await fixture(basic())) as LyraCombobox;
    const startSlot = el.shadowRoot!.querySelector(
      'slot[name="start"]'
    ) as HTMLSlotElement;
    const changed = oneEvent(startSlot, "slotchange");
    const glyph = document.createElement("span");
    glyph.slot = "start";
    glyph.textContent = "⌕";
    el.append(glyph);
    await changed;
    await el.updateComplete;
    expect(part(el, "start").hasAttribute("hidden")).to.be.false;
  });

  it('places the start adornment on the inline-start under dir="rtl"', async () => {
    const root = await fixture(html`
      <div dir="rtl">
        <lr-combobox label="Fruit">
          <span slot="start">⌕</span>
          <lr-option value="a">Apple</lr-option>
        </lr-combobox>
      </div>
    `);
    const el = root.querySelector("lr-combobox") as LyraCombobox;
    await el.updateComplete;
    const startRect = part(el, "start").getBoundingClientRect();
    const inputRect = part(el, "combobox-input").getBoundingClientRect();
    expect(startRect.left).to.be.greaterThan(inputRect.left);
  });

  it("does not collect adornment content as an option", async () => {
    const el = (await fixture(html`
      <lr-combobox label="Fruit" open>
        <span slot="start">⌕</span>
        <kbd slot="end">K</kbd>
        <lr-option value="a">Apple</lr-option>
        <lr-option value="b">Banana</lr-option>
      </lr-combobox>
    `)) as LyraCombobox;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll('[part="option"]').length).to.equal(
      2
    );
  });

  it("is accessible with adornments slotted and the listbox open", async () => {
    const el = (await fixture(html`
      <lr-combobox label="Fruit" open>
        <span slot="start" aria-hidden="true">⌕</span>
        <kbd slot="end">K</kbd>
        <lr-option value="a">Apple</lr-option>
      </lr-combobox>
    `)) as LyraCombobox;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll('[part="option"]').length).to.equal(
      1
    );
    await expect(el).to.be.accessible();
  });
});

describe("clear affordance on the filter axis", () => {
  const clearButton = (el: LyraCombobox) =>
    el.shadowRoot!.querySelector(
      '[part="clear-button"]'
    ) as HTMLButtonElement | null;
  const inputEl = (el: LyraCombobox) =>
    el.shadowRoot!.querySelector('[part="combobox-input"]') as HTMLInputElement;

  const center = (element: HTMLElement): [number, number] => {
    const rect = element.getBoundingClientRect();
    return [Math.round(rect.left + rect.width / 2), Math.round(rect.top + rect.height / 2)];
  };

  for (const asyncSource of [false, true]) {
    it(`reports a query-only clear after a native pointer click with ${asyncSource ? 'async' : 'slotted'} options`, async () => {
      const el = await fixture<LyraCombobox>(html`
        <lr-combobox clearable label="Fruit" style="--lr-transition-fast: 0s">
          <lr-option value="a">Apple</lr-option>
        </lr-combobox>
      `);
      const queries: string[] = [];
      if (asyncSource) {
        el.sourceDelay = 0;
        el.source = async (query) => {
          queries.push(query);
          return [{ value: 'a', label: 'Apple' }];
        };
      }
      try {
        await sendMouse({ type: 'click', position: center(inputEl(el)) });
        await sendKeys({ type: 'Apple' });
        await waitUntil(() => el.inputValue === 'Apple' && clearButton(el) !== null);
        if (asyncSource) await waitUntil(() => queries.includes('Apple'));
        const filters: string[] = [];
        const selectionEvents: string[] = [];
        el.addEventListener('lr-filter', (event) => filters.push((event as CustomEvent<ComboboxFilterDetail>).detail.value));
        for (const name of ['input', 'change', 'lr-input', 'lr-change', 'lr-clear']) {
          el.addEventListener(name, () => selectionEvents.push(name));
        }
        const button = clearButton(el)!;
        await sendMouse({ type: 'move', position: center(button) });
        await sendMouse({ type: 'down' });
        await settlePointer();
        expect(el.inputValue, 'the pointer press preserves the query until activation').to.equal('Apple');
        await sendMouse({ type: 'up' });
        await waitUntil(() => filters.length > 0, 'clear must report an empty filter');
        await el.updateComplete;
        expect(filters).to.deep.equal(['']);
        expect(selectionEvents).to.deep.equal([]);
        expect(inputEl(el).value).to.equal('');
        expect(el.value).to.equal('');
        expect(el.shadowRoot!.activeElement === inputEl(el)).to.equal(true);
        if (asyncSource) await waitUntil(() => queries.at(-1) === '');
      } finally {
        await resetMouse();
      }
    });
  }

  it('reports both axes exactly once when a native pointer clears selection and query', async () => {
    const el = await fixture<LyraCombobox>(html`
      <lr-combobox clearable label="Fruit" style="--lr-transition-fast: 0s">
        <lr-option value="a" selected>Apple</lr-option>
      </lr-combobox>
    `);
    try {
      await sendMouse({ type: 'click', position: center(inputEl(el)) });
      await sendKeys({ type: 'Banana' });
      await waitUntil(() => el.inputValue === 'Banana');
      const reported: string[] = [];
      for (const name of ['lr-filter', 'input', 'change', 'lr-input', 'lr-change', 'lr-clear']) {
        el.addEventListener(name, (event) => reported.push(name === 'lr-filter'
          ? `${name}:${(event as CustomEvent<ComboboxFilterDetail>).detail.value}` : name));
      }
      await sendMouse({ type: 'click', position: center(clearButton(el)!) });
      await waitUntil(() => el.value === '');
      expect(reported.sort()).to.deep.equal(['change', 'input', 'lr-change', 'lr-clear', 'lr-filter:', 'lr-input']);
      expect(inputEl(el).value).to.equal('');
    } finally {
      await resetMouse();
    }
  });

  it('clears a closed committed selection without opening the listbox', async () => {
    const el = await fixture<LyraCombobox>(html`
      <lr-combobox clearable label="Fruit" style="--lr-transition-fast: 0s">
        <lr-option value="a" selected>Apple</lr-option>
      </lr-combobox>
    `);
    let shows = 0;
    el.addEventListener('lr-show', () => shows++);
    expect(el.open).to.equal(false);
    try {
      await sendMouse({ type: 'click', position: center(clearButton(el)!) });
      await waitUntil(() => el.value === '');
      await settlePointer();
      expect(el.open).to.equal(false);
      expect(shows).to.equal(0);
      expect(el.shadowRoot!.activeElement === inputEl(el)).to.equal(true);
    } finally {
      await resetMouse();
    }
  });

  for (const key of ['Enter', 'Space']) {
    it(`preserves the query while tabbing to clear and activates it with ${key}`, async () => {
      const el = await fixture<LyraCombobox>(html`
        <lr-combobox clearable label="Fruit" style="--lr-transition-fast: 0s">
          <lr-option value="a">Apple</lr-option>
        </lr-combobox>
      `);
      await focusByKeyboard(inputEl(el));
      await sendKeys({ type: 'Apple' });
      await waitUntil(() => clearButton(el) !== null);
      const filters: string[] = [];
      el.addEventListener('lr-filter', (event) => filters.push((event as CustomEvent<ComboboxFilterDetail>).detail.value));
      await sendKeys({ press: 'Tab' });
      await el.updateComplete;
      expect(el.shadowRoot!.activeElement === clearButton(el), 'Tab reaches the retained clear control').to.equal(true);
      expect(el.inputValue).to.equal('Apple');
      await sendKeys({ press: key });
      await waitUntil(() => filters.length > 0);
      await el.updateComplete;
      expect(filters).to.deep.equal(['']);
      expect(inputEl(el).value).to.equal('');
      expect(el.shadowRoot!.activeElement === inputEl(el)).to.equal(true);
    });
  }

  it('closes and discards the query when Tab leaves the clear control', async () => {
    const wrapper = await fixture<HTMLDivElement>(html`
      <div>
        <lr-combobox clearable label="Fruit" style="--lr-transition-fast: 0s">
          <lr-option value="a">Apple</lr-option>
        </lr-combobox>
        <button id="after-clear">After</button>
      </div>
    `);
    const el = wrapper.querySelector<LyraCombobox>('lr-combobox')!;
    await focusByKeyboard(inputEl(el));
    await sendKeys({ type: 'Apple' });
    await sendKeys({ press: 'Tab' });
    expect(el.shadowRoot!.activeElement === clearButton(el)).to.equal(true);
    await sendKeys({ press: 'Tab' });
    await waitUntil(() => !el.open && el.inputValue === '');
    expect(document.activeElement?.id).to.equal('after-clear');
  });

  it("renders the clear button for a query-only state and clearing it emits lr-filter with an empty value", async () => {
    const el = (await fixture(html`
      <lr-combobox clearable label="Fruit">
        <lr-option value="a">Apple</lr-option>
        <lr-option value="b">Banana</lr-option>
      </lr-combobox>
    `)) as LyraCombobox;
    await typeQuery(el, "foo");
    expect(el.value).to.equal("");
    const button = clearButton(el);
    expect(
      button !== null,
      "clear button should render for a query with no selection"
    ).to.be.true;

    const filtered = oneEvent(el, "lr-filter");
    button!.click();
    const event = (await filtered) as CustomEvent<ComboboxFilterDetail>;
    expect(event.detail.value).to.equal("");
    await el.updateComplete;
    expect(inputEl(el).value).to.equal("");
    expect(clearButton(el) === null).to.be.true;
  });

  it("does not emit change/input/lr-clear for a query-only clear", async () => {
    const el = (await fixture(html`
      <lr-combobox clearable label="Fruit"
        ><lr-option value="a">Apple</lr-option></lr-combobox
      >
    `)) as LyraCombobox;
    await typeQuery(el, "foo");
    let changes = 0;
    let clears = 0;
    let inputs = 0;
    el.addEventListener("change", () => changes++);
    el.addEventListener("lr-clear", () => clears++);
    el.addEventListener("input", () => inputs++);

    clearButton(el)!.click();
    await el.updateComplete;
    expect(changes).to.equal(0);
    expect(clears).to.equal(0);
    expect(inputs).to.equal(0);
  });

  it("still emits change and lr-clear when a real selection is cleared", async () => {
    const el = (await fixture(html`
      <lr-combobox clearable label="Fruit"
        ><lr-option value="a" selected>Apple</lr-option></lr-combobox
      >
    `)) as LyraCombobox;
    await el.updateComplete;
    let changes = 0;
    el.addEventListener("change", () => changes++);
    const cleared = oneEvent(el, "lr-clear");
    clearButton(el)!.click();
    await cleared;
    await el.updateComplete;
    expect(changes).to.equal(1);
    expect(el.value).to.equal("");
  });

  it("announces both axes when a selection and a query are cleared together", async () => {
    const el = (await fixture(html`
      <lr-combobox clearable label="Fruit">
        <lr-option value="a">Apple</lr-option>
        <lr-option value="b" selected>Banana</lr-option>
      </lr-combobox>
    `)) as LyraCombobox;
    await el.updateComplete;
    await typeQuery(el, "app");
    const filters: string[] = [];
    let changes = 0;
    let clears = 0;
    el.addEventListener("lr-filter", (event) =>
      filters.push((event as CustomEvent<ComboboxFilterDetail>).detail.value)
    );
    el.addEventListener("change", () => changes++);
    el.addEventListener("lr-clear", () => clears++);

    clearButton(el)!.click();
    await el.updateComplete;
    expect(filters).to.deep.equal([""]);
    expect(changes).to.equal(1);
    expect(clears).to.equal(1);
    expect(el.value).to.equal("");
  });

  it("emits no lr-filter when a selection is cleared with an already-empty query", async () => {
    const el = (await fixture(html`
      <lr-combobox clearable label="Fruit"
        ><lr-option value="a" selected>Apple</lr-option></lr-combobox
      >
    `)) as LyraCombobox;
    await el.updateComplete;
    let filters = 0;
    el.addEventListener("lr-filter", () => filters++);
    clearButton(el)!.click();
    await el.updateComplete;
    expect(filters).to.equal(0);
  });

  it("hides the clear button for a single-select query the user cannot see (listbox closed)", async () => {
    const el = (await fixture(html`
      <lr-combobox clearable label="Fruit"
        ><lr-option value="a">Apple</lr-option></lr-combobox
      >
    `)) as LyraCombobox;
    await typeQuery(el, "foo");
    expect(clearButton(el) !== null).to.be.true;
    // A direct `open = false` write bypasses hide()'s own query reset, which is exactly the state
    // where `displayValue` shows the selected label (here: nothing) rather than `query`.
    el.open = false;
    await el.updateComplete;
    expect(inputEl(el).value).to.equal("");
    expect(clearButton(el) === null).to.be.true;
  });

  it("keeps the clear button for a multi-select query while closed, where the query is still visible", async () => {
    const el = (await fixture(html`
      <lr-combobox clearable multiple label="Fruit"
        ><lr-option value="a">Apple</lr-option></lr-combobox
      >
    `)) as LyraCombobox;
    await typeQuery(el, "foo");
    el.open = false;
    await el.updateComplete;
    expect(inputEl(el).value).to.equal("foo");
    expect(clearButton(el) !== null).to.be.true;
  });

  it("leaves the clear button absent when neither a selection nor a query exists", async () => {
    const el = (await fixture(html`
      <lr-combobox clearable label="Fruit" open
        ><lr-option value="a">Apple</lr-option></lr-combobox
      >
    `)) as LyraCombobox;
    await el.updateComplete;
    expect(clearButton(el) === null).to.be.true;
  });

  it('ignores a synthetic click on the clear button while disabled', async () => {
    const el = (await fixture(html`
      <lr-combobox clearable label="Fruit"
        ><lr-option value="a" selected>Apple</lr-option></lr-combobox
      >
    `)) as LyraCombobox;
    await el.updateComplete;
    const button = clearButton(el)!;
    el.disabled = true;
    await el.updateComplete;
    button.dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true, composed: true })
    );
    await el.updateComplete;
    expect(el.value, "a disabled clear button must not clear the selection").to.equal(
      "a"
    );
  });

  it('is a no-op the second time the clear button fires before a re-render drops it', async () => {
    const el = (await fixture(html`
      <lr-combobox clearable label="Fruit"
        ><lr-option value="a" selected>Apple</lr-option></lr-combobox
      >
    `)) as LyraCombobox;
    await el.updateComplete;
    const button = clearButton(el)!;
    let clearCount = 0;
    el.addEventListener("lr-clear", () => clearCount++);

    button.click();
    button.click(); // same closed-over element, fired again before Lit re-renders it away
    await el.updateComplete;

    expect(el.value).to.equal("");
    expect(
      clearCount,
      "the redundant second clear must not re-emit lr-clear"
    ).to.equal(1);
  });

  it('ignores a synthetic remove-tag click while disabled', async () => {
    const el = (await fixture(html`
      <lr-combobox multiple label="Fruit"
        ><lr-option value="a" selected>Apple</lr-option></lr-combobox
      >
    `)) as LyraCombobox;
    await el.updateComplete;
    const removeBtn = el.shadowRoot!.querySelector(
      '[part="tag__remove-button"]'
    ) as HTMLButtonElement;
    el.disabled = true;
    await el.updateComplete;
    removeBtn.dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true, composed: true })
    );
    await el.updateComplete;
    expect(
      el.value,
      "a disabled tag remove button must not remove the selection"
    ).to.deep.equal(["a"]);
  });

  it('ignores a synthetic input event on the filter input while disabled', async () => {
    const el = (await fixture(basic())) as LyraCombobox;
    el.disabled = true;
    await el.updateComplete;
    const input = inputEl(el);
    input.value = "ban";
    input.dispatchEvent(
      new InputEvent("input", { bubbles: true, composed: true, data: "ban" })
    );
    await el.updateComplete;

    expect(
      el.open,
      "typing into a disabled filter input must not open the listbox"
    ).to.be.false;
    expect((el as unknown as { query: string }).query).to.equal("");
  });
});

it('clamps its focused floating surface width through the shared popover-viewport-clamp token', async () => {
  const el = (await fixture(html`
    <lr-combobox
      style="--lr-popover-viewport-clamp: 10px; --lr-transition-fast: 0s"
    >
      <lr-option value="a">Apple</lr-option>
    </lr-combobox>
  `)) as LyraCombobox;
  const input = el.shadowRoot!.querySelector<HTMLInputElement>(
    '[part="combobox-input"]'
  )!;
  const listbox = el.shadowRoot!.querySelector<HTMLElement>('[part="listbox"]')!;

  input.focus();
  await waitUntil(
    () =>
      el.open &&
      listbox.hasAttribute('data-positioned') &&
      getComputedStyle(listbox).visibility === 'visible',
    'the focused combobox did not show a positioned listbox'
  );
  await waitUntil(
    () => getComputedStyle(listbox).maxInlineSize === '10px',
    'the visible combobox listbox did not receive the viewport clamp'
  );

  expect(getComputedStyle(listbox).maxInlineSize).to.equal('10px');
});

it("renders the combobox-input's ::placeholder in the shared quiet-text token's color (getComputedStyle, not just source text)", async () => {
  // The test above only proves the token string appears in the stylesheet source -- it can't
  // catch a rule that stops matching the real DOM (wrong selector, broken specificity, a
  // shadow-DOM part boundary issue). This reads the actual rendered pseudo-element instead.
  const el = (await fixture(
    html`<lr-combobox
      style="--lr-color-text-quiet: rgb(12, 34, 56)"
    ></lr-combobox>`
  )) as LyraCombobox;
  await el.updateComplete;
  const input = el.shadowRoot!.querySelector(
    '[part="combobox-input"]'
  ) as HTMLInputElement;
  expect(getComputedStyle(input, "::placeholder").color).to.equal(
    "rgb(12, 34, 56)"
  );
});

// -- Hover states (mouse-modality parity with the focus ring) --------------
it("gives the clear button a :hover rule, matching its own :focus-visible affordance", () => {
  const css = styles.cssText.replace(/\s+/g, " ");
  expect(css).to.match(/\[part=["']clear-button["']\]:hover/);
});

it("gives a selected tag's remove button a :hover rule, matching its own :focus-visible affordance", () => {
  const css = styles.cssText.replace(/\s+/g, " ");
  expect(css).to.match(/\[part=["']tag__remove-button["']\]:hover/);
});

// -- Per-component theming indirection --------------------------------------
describe("--lr-combobox-option-active-bg", () => {
  it("retints a hovered/active option row via the cssprop, not just the bare shared token", async () => {
    const el = (await fixture(basic())) as LyraCombobox;
    el.open = true;
    await el.updateComplete;
    el.style.setProperty("--lr-combobox-option-active-bg", "rgb(10, 20, 30)");
    const row = el.shadowRoot!.querySelector('[part="option"]') as HTMLElement;
    // [data-active] shares the same declaration as :hover in the stylesheet (comma-separated) --
    // real :hover can't be forced from test JS without an actual pointer move, so this exercises
    // the identical rule via its keyboard-active twin.
    row.setAttribute("data-active", "");
    expect(getComputedStyle(row).backgroundColor).to.equal("rgb(10, 20, 30)");
  });

  it("still falls back to the shared --lr-color-brand-quiet token when unset", async () => {
    const el = (await fixture(basic())) as LyraCombobox;
    el.open = true;
    await el.updateComplete;
    el.style.setProperty("--lr-color-brand-quiet", "rgb(40, 50, 60)");
    const row = el.shadowRoot!.querySelector('[part="option"]') as HTMLElement;
    row.setAttribute("data-active", "");
    expect(getComputedStyle(row).backgroundColor).to.equal("rgb(40, 50, 60)");
  });
});

describe("--lr-combobox-option-badge-bg", () => {
  it('retints the "not in catalog" badge via the cssprop, not just the bare shared token', async () => {
    const el = (await fixture(html`
      <lr-combobox with-unknown-option style="--lr-combobox-option-badge-bg: rgb(1, 2, 3);">
        <lr-option value="a">Apple</lr-option>
      </lr-combobox>
    `)) as LyraCombobox;
    el.value = "ghost";
    el.open = true;
    await el.updateComplete;
    const badge = el.shadowRoot!.querySelector(
      '[part="option-badge"]'
    ) as HTMLElement;
    expect(badge, "the synthetic unmatched-value row renders its badge while open")
      .to.exist;
    expect(getComputedStyle(badge).backgroundColor).to.equal("rgb(1, 2, 3)");
  });

  it("still falls back to the shared --lr-color-brand-quiet token when unset", async () => {
    const el = (await fixture(html`
      <lr-combobox with-unknown-option style="--lr-color-brand-quiet: rgb(40, 50, 60);">
        <lr-option value="a">Apple</lr-option>
      </lr-combobox>
    `)) as LyraCombobox;
    el.value = "ghost";
    el.open = true;
    await el.updateComplete;
    const badge = el.shadowRoot!.querySelector(
      '[part="option-badge"]'
    ) as HTMLElement;
    expect(getComputedStyle(badge).backgroundColor).to.equal("rgb(40, 50, 60)");
  });
});

describe("selected-state theming tokens", () => {
  it("honours --lr-combobox-option-selected-color on the selected row", async () => {
    const el = (await fixture(html`
      <lr-combobox style="--lr-combobox-option-selected-color: rgb(1, 2, 3);">
        <lr-option value="a">Apple</lr-option>
        <lr-option value="b">Banana</lr-option>
      </lr-combobox>
    `)) as LyraCombobox;
    el.value = "a";
    el.open = true;
    await el.updateComplete;
    const selected = el.shadowRoot!.querySelector(
      '[part="option"][aria-selected="true"]'
    ) as HTMLElement;
    expect(getComputedStyle(selected).color).to.equal("rgb(1, 2, 3)");
  });

  it("honours --lr-combobox-option-selected-bg on the selected row", async () => {
    const el = (await fixture(html`
      <lr-combobox style="--lr-combobox-option-selected-bg: rgb(4, 5, 6);">
        <lr-option value="a">Apple</lr-option>
        <lr-option value="b">Banana</lr-option>
      </lr-combobox>
    `)) as LyraCombobox;
    el.value = "a";
    el.open = true;
    await el.updateComplete;
    const selected = el.shadowRoot!.querySelector(
      '[part="option"][aria-selected="true"]'
    ) as HTMLElement;
    expect(getComputedStyle(selected).backgroundColor).to.equal("rgb(4, 5, 6)");
  });

  it("leaves the selected row at the brand color when the token is unset (regression)", async () => {
    const el = (await fixture(basic())) as LyraCombobox;
    el.value = "a";
    el.open = true;
    await el.updateComplete;
    const selected = el.shadowRoot!.querySelector(
      '[part="option"][aria-selected="true"]'
    ) as HTMLElement;
    const brand = getComputedStyle(el)
      .getPropertyValue("--lr-color-brand")
      .trim();
    const expected = resolvedColorIn(el.ownerDocument.body, brand);
    expect(getComputedStyle(selected).color).to.equal(expected);
  });
});

describe("focus indicator per appearance", () => {
  for (const appearance of [
    "outlined",
    "filled",
    "filled-outlined",
    "accent",
    "plain",
  ] as const) {
    it(`retints the ${appearance} combobox border while focus is inside it (WCAG 2.4.7)`, async () => {
      const el = (await fixture(html`
        <lr-combobox
          appearance=${appearance}
          style="--lr-transition-fast: 0s; --lr-color-brand: rgb(1, 2, 3);"
        >
          <lr-option value="a">Apple</lr-option>
        </lr-combobox>
      `)) as LyraCombobox;
      await el.updateComplete;
      const box = el.shadowRoot!.querySelector<HTMLElement>(
        '[part="combobox"]'
      )!;
      const input = el.shadowRoot!.querySelector<HTMLInputElement>(
        '[part="combobox-input"]'
      )!;
      const resting = getComputedStyle(box).borderTopColor;
      input.focus();
      await el.updateComplete;
      const focused = getComputedStyle(box).borderTopColor;
      expect(focused, `${appearance} focus-within border`).to.equal(
        "rgb(1, 2, 3)"
      );
      expect(focused, `${appearance} focus vs resting border`).to.not.equal(
        resting
      );
      input.blur();
    });
  }
});

describe("appearance renders the full shared vocabulary", () => {
  it("renders accent distinctly from the outlined default", async () => {
    const outlined = (await fixture(html`
      <lr-combobox appearance="outlined">
        <lr-option value="a">Apple</lr-option>
      </lr-combobox>
    `)) as LyraCombobox;
    const accent = (await fixture(html`
      <lr-combobox appearance="accent">
        <lr-option value="a">Apple</lr-option>
      </lr-combobox>
    `)) as LyraCombobox;
    await outlined.updateComplete;
    await accent.updateComplete;
    expect(accent.appearance).to.equal("accent");
    expect(accent.getAttribute("appearance")).to.equal("accent");
    const outlinedBox = outlined.shadowRoot!.querySelector<HTMLElement>(
      '[part="combobox"]'
    )!;
    const accentBox = accent.shadowRoot!.querySelector<HTMLElement>(
      '[part="combobox"]'
    )!;
    expect(
      getComputedStyle(accentBox).backgroundColor,
      "accent vs outlined background"
    ).to.not.equal(getComputedStyle(outlinedBox).backgroundColor);
  });

  it("renders plain distinctly from the outlined default", async () => {
    const outlined = (await fixture(html`
      <lr-combobox appearance="outlined">
        <lr-option value="a">Apple</lr-option>
      </lr-combobox>
    `)) as LyraCombobox;
    const plain = (await fixture(html`
      <lr-combobox appearance="plain">
        <lr-option value="a">Apple</lr-option>
      </lr-combobox>
    `)) as LyraCombobox;
    await outlined.updateComplete;
    await plain.updateComplete;
    expect(plain.appearance).to.equal("plain");
    expect(plain.getAttribute("appearance")).to.equal("plain");
    const outlinedBox = outlined.shadowRoot!.querySelector<HTMLElement>(
      '[part="combobox"]'
    )!;
    const plainBox = plain.shadowRoot!.querySelector<HTMLElement>(
      '[part="combobox"]'
    )!;
    expect(
      getComputedStyle(plainBox).borderTopColor,
      "plain vs outlined border"
    ).to.not.equal(getComputedStyle(outlinedBox).borderTopColor);
  });

  it("clamps a genuinely unknown attribute set at first parse to the default", async () => {
    const el = (await fixture(html`
      <lr-combobox appearance="bogus">
        <lr-option value="a">Apple</lr-option>
      </lr-combobox>
    `)) as LyraCombobox;
    await el.updateComplete;
    expect(el.appearance).to.equal("outlined");
    expect(el.getAttribute("appearance")).to.equal("outlined");
  });

  it("clamps a genuinely unknown attribute written later, repairing the raw attribute", async () => {
    const el = (await fixture(basic())) as LyraCombobox;
    el.setAttribute("appearance", "bogus");
    await el.updateComplete;
    expect(el.appearance).to.equal("outlined");
    expect(el.getAttribute("appearance")).to.equal("outlined");
  });

  it("keeps every documented value unchanged", async () => {
    for (const appearance of [
      "outlined",
      "filled",
      "filled-outlined",
      "accent",
      "plain",
    ] as const) {
      const el = (await fixture(basic())) as LyraCombobox;
      el.setAttribute("appearance", appearance);
      await el.updateComplete;
      expect(el.appearance).to.equal(appearance);
      expect(el.getAttribute("appearance")).to.equal(appearance);
    }
  });
});

it("preserves rendered label, hint and error behavior through shared slot changes", async () => {
  const el = (await fixture(html`
    <lr-combobox>
      <span slot="label">Fruit</span>
      <span slot="hint">Start typing</span>
      <span slot="error">Required</span>
      <lr-option value="a">Apple</lr-option>
    </lr-combobox>
  `)) as LyraCombobox;
  await el.updateComplete;
  const label = el.shadowRoot!.querySelector(
    '[part="form-control-label"]'
  ) as HTMLElement;
  const hint = el.shadowRoot!.querySelector('[part="hint"]') as HTMLElement;
  const error = el.shadowRoot!.querySelector('[part="error"]') as HTMLElement;
  expect(label.hidden).to.be.false;
  expect(hint.hidden).to.be.false;
  expect(error.hidden).to.be.false;
  const input = el.shadowRoot!.querySelector(
    '[part="combobox-input"]'
  ) as HTMLInputElement;
  expect(input.getAttribute("aria-invalid")).to.equal("true");
  expect(
    el.checkValidity(),
    "visible consumer error chrome does not rewrite FACE validity"
  ).to.be.true;

  for (const slot of ["label", "hint", "error"])
    el.querySelector(`[slot="${slot}"]`)!.remove();
  await new Promise((r) => requestAnimationFrame(() => r(null)));
  await el.updateComplete;
  expect(label.hidden).to.be.true;
  expect(hint.hidden).to.be.true;
  expect(error.hidden).to.be.true;
  expect(input.getAttribute("aria-invalid")).to.equal("false");
});

// Colour STRINGS are compared, never elements: a DOM node as chai's actual/expected hangs the file.
it("tints the tag remove button on hover and deepens that tint while it is pressed", async () => {
  const el = (await fixture(basic())) as LyraCombobox;
  el.multiple = true;
  el.value = ["a"];
  await el.updateComplete;
  const remove = el.shadowRoot!.querySelector(
    '[part="tag__remove-button"]'
  ) as HTMLElement;
  const rect = remove.getBoundingClientRect();
  const centre: [number, number] = [
    Math.round(rect.left + rect.width / 2),
    Math.round(rect.top + rect.height / 2),
  ];
  const rest = getComputedStyle(remove).backgroundColor;
  try {
    await sendMouse({ type: "move", position: centre });
    await waitUntil(
      () =>
        remove.matches(":hover") &&
        getComputedStyle(remove).backgroundColor !== rest,
      "the tag remove button never painted its hovered tint"
    );
    const hovered = getComputedStyle(remove).backgroundColor;
    await sendMouse({ type: "down" });
    await waitUntil(
      () =>
        remove.matches(":active") &&
        getComputedStyle(remove).backgroundColor !== hovered,
      "the tag remove button never painted its pressed tint"
    );
    const pressed = getComputedStyle(remove).backgroundColor;
    await sendMouse({ type: "up" });
    expect(
      hovered,
      "hover must tint the resting (transparent) background"
    ).to.not.equal(rest);
    expect(
      pressed,
      "pressed must be visibly stronger than hover, not identical to it"
    ).to.not.equal(hovered);
  } finally {
    await resetMouse();
  }
});

describe("reviewed Web Awesome Pro combobox surface", () => {
  const typeQuery = async (
    el: LyraCombobox,
    value: string
  ): Promise<HTMLInputElement> => {
    const input = el.shadowRoot!.querySelector(
      '[part~="combobox-input"]'
    ) as HTMLInputElement;
    input.value = value;
    input.dispatchEvent(
      new InputEvent("input", { bubbles: true, composed: true })
    );
    await el.updateComplete;
    return input;
  };

  it("exposes the reviewed defaults and public validation/editing members", async () => {
    const el = (await fixture(
      html`<lr-combobox></lr-combobox>`
    )) as LyraCombobox;
    await el.updateComplete;

    expect(el.allowCreate).to.be.false;
    expect(el.allowCustomValue).to.be.false;
    expect(el.appearance).to.equal("outlined");
    expect(el.inputValue).to.equal("");
    expect(el.placement).to.equal("bottom");
    expect(el.spellcheck).to.be.false;
    expect(el.withHint).to.be.false;
    expect(el.withLabel).to.be.false;
    expect(el.validators).to.deep.equal([]);
    expect(
      el.validationTarget ===
        el.shadowRoot!.querySelector('[part~="combobox-input"]')
    ).to.equal(true);
    expect(el.resetValidity).to.be.a("function");
    expect(el.show).to.be.a("function");
    expect(el.hide).to.be.a("function");
  });

  it("keeps the mapped autocorrect IDL boolean and forwards the on/off HTML vocabulary", async () => {
    const el = (await fixture(
      html`<lr-combobox></lr-combobox>`
    )) as LyraCombobox;
    el.inputmode = "search";
    el.enterkeyhint = "done";
    el.autocorrect = false;
    el.inputValue = "draft";
    await el.updateComplete;

    const input = el.shadowRoot!.querySelector(
      '[part~="combobox-input"]'
    ) as HTMLInputElement;
    expect(el.inputMode).to.equal("search");
    expect(el.enterKeyHint).to.equal("done");
    expect(el.autocorrect).to.equal(false);
    expect(input.getAttribute("inputmode")).to.equal("search");
    expect(input.getAttribute("enterkeyhint")).to.equal("done");
    expect(input.getAttribute("autocorrect")).to.equal("off");
    expect(input.value).to.equal("draft");

    el.setAttribute("autocorrect", "on");
    await el.updateComplete;
    expect(el.autocorrect).to.equal(true);
    expect(input.getAttribute("autocorrect")).to.equal("on");

    el.removeAttribute("autocorrect");
    await el.updateComplete;
    expect(el.autocorrect).to.equal(true);
    expect(input.hasAttribute("autocorrect")).to.equal(false);
  });

  it("renders a localized create row and lets lr-create veto the default append/select behavior", async () => {
    const el = (await fixture(html`
      <lr-combobox
        allow-create
        .strings=${{ comboboxCreate: "Ajouter {value}" }}
      >
        <lr-option value="existing">Existing</lr-option>
      </lr-combobox>
    `)) as LyraCombobox;
    await typeQuery(el, "New tag");

    const create = el.shadowRoot!.querySelector("[data-create]") as HTMLElement;
    expect(create != null).to.equal(true);
    expect(create.textContent).to.contain("Ajouter New tag");

    let detail: { inputValue: string } | undefined;
    el.addEventListener(
      "lr-create",
      (event) => {
        detail = event.detail;
        event.preventDefault();
      },
      { once: true }
    );
    create.click();
    await el.updateComplete;

    expect(detail).to.deep.equal({ inputValue: "New tag" });
    expect(el.value).to.equal("");
    expect(
      [...el.querySelectorAll("lr-option")].some(
        (option) => option.getAttribute("value") === "New tag"
      )
    ).to.be.false;
  });

  it("appends and selects a created lr-option by default in single and multiple modes", async () => {
    for (const multiple of [false, true]) {
      const el = (await fixture(html`
        <lr-combobox allow-create ?multiple=${multiple}>
          <lr-option value="existing" ?selected=${multiple}>Existing</lr-option>
        </lr-combobox>
      `)) as LyraCombobox;
      await typeQuery(el, "New tag");
      (el.shadowRoot!.querySelector("[data-create]") as HTMLElement).click();
      await el.updateComplete;

      const created = [...el.querySelectorAll("lr-option")].find(
        (option) => option.getAttribute("value") === "New tag"
      );
      expect(created).to.exist;
      expect(created!.textContent).to.equal("New tag");
      expect(multiple ? el.value : [el.value]).to.deep.equal(
        multiple ? ["existing", "New tag"] : ["New tag"]
      );
    }
  });

  it("commits an arbitrary single-select value on Enter without creating an option", async () => {
    const el = (await fixture(html`
      <lr-combobox allow-custom-value>
        <lr-option value="red">Red</lr-option>
      </lr-combobox>
    `)) as LyraCombobox;
    const input = await typeQuery(el, "Cerulean");
    input.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Enter",
        bubbles: true,
        composed: true,
        cancelable: true,
      })
    );
    await el.updateComplete;

    expect(el.value).to.equal("Cerulean");
    expect(el.querySelectorAll("lr-option")).to.have.length(1);
  });

  it("supports custom tags and every reviewed named slot/part alias", async () => {
    const el = (await fixture(html`
      <lr-combobox multiple with-clear with-label with-hint>
        <span slot="label">Label</span>
        <span slot="hint">Hint</span>
        <span slot="start">Start</span>
        <span slot="end">End</span>
        <span slot="clear-icon">Clear</span>
        <span slot="expand-icon">Expand</span>
        <lr-option value="a" selected>Apple</lr-option>
      </lr-combobox>
    `)) as LyraCombobox;
    el.getTag = (option, index) =>
      html`<span class="custom-tag">${index}:${option.label}</span>`;
    await el.updateComplete;

    expect(el.shadowRoot!.querySelector(".custom-tag")!.textContent).to.equal(
      "0:Apple"
    );
    expect(el.shadowRoot!.querySelector('slot[name="clear-icon"]')).to.exist;
    expect(el.shadowRoot!.querySelector('slot[name="expand-icon"]')).to.exist;
    el.getTag = undefined;
    await el.updateComplete;
    for (const part of [
      "form-control-input",
      "label",
      "tag__content",
      "tag__remove-button__base",
    ]) {
      expect(el.shadowRoot!.querySelector(`[part~="${part}"]`), part).to.exist;
    }
  });

  it("emits show/hide lifecycle events in before/after order from the public methods", async () => {
    const el = (await fixture(
      html`<lr-combobox></lr-combobox>`
    )) as LyraCombobox;
    el.style.setProperty("--show-duration", "0ms");
    el.style.setProperty("--hide-duration", "0ms");
    const order: string[] = [];
    for (const name of [
      "lr-show",
      "lr-after-show",
      "lr-hide",
      "lr-after-hide",
    ]) {
      el.addEventListener(name, () => order.push(name));
    }

    const afterShow = oneEvent(el, "lr-after-show");
    el.show();
    await afterShow;
    const afterHide = oneEvent(el, "lr-after-hide");
    el.hide();
    await afterHide;

    expect(order).to.deep.equal([
      "lr-show",
      "lr-after-show",
      "lr-hide",
      "lr-after-hide",
    ]);
  });
});

it("is a no-op the second time the same tag remove button fires before a re-render drops it", async () => {
  const el = (await fixture(html`
    <lr-combobox multiple>
      <lr-option value="a" selected>Apple</lr-option>
      <lr-option value="b" selected>Banana</lr-option>
    </lr-combobox>
  `)) as LyraCombobox;
  await el.updateComplete;
  const removeBtn = el.shadowRoot!.querySelector(
    '[part="tag__remove-button"]'
  ) as HTMLButtonElement;
  let changeCount = 0;
  el.addEventListener("change", () => changeCount++);

  removeBtn.click();
  removeBtn.click(); // same closed-over value, fired again before Lit re-renders the tag away
  await el.updateComplete;

  expect(el.value).to.deep.equal(["b"]);
  expect(
    changeCount,
    "the redundant second removal must not re-emit change"
  ).to.equal(1);
});

it("truncates a selected tag's label with an ellipsis instead of wrapping it mid-word", async () => {
  const el = (await fixture(html`
    <lr-combobox multiple>
      <lr-option value="received">Received</lr-option>
      <lr-option value="short">Ok</lr-option>
    </lr-combobox>
  `)) as LyraCombobox;
  el.value = ["received"];
  await el.updateComplete;

  const label = el.shadowRoot!.querySelector('[part="tag-label"]') as HTMLElement;
  expect(label, "the selected value renders a tag label").to.not.equal(null);

  // Asserting the rendered result, not the declaration: text-overflow only fires on inline
  // overflow, so a label left at white-space: normal wraps and scrollWidth never exceeds
  // clientWidth -- which is exactly how the ellipsis was unreachable while being declared.
  expect(
    getComputedStyle(label).whiteSpace,
    "the label keeps one line so text-overflow: ellipsis can fire"
  ).to.equal("nowrap");

  const singleLine = Math.round(label.getBoundingClientRect().height);
  el.value = ["short"];
  await el.updateComplete;
  const shortLabel = el.shadowRoot!.querySelector('[part="tag-label"]') as HTMLElement;
  expect(
    Math.round(shortLabel.getBoundingClientRect().height),
    "a label that fits and one that overflows are both a single line tall"
  ).to.equal(singleLine);
});

// contract the code did not have, not merely a missing feature.
describe('option adornments in the popup', () => {
  async function openWith(markup: unknown): Promise<LyraCombobox> {
    const el = (await fixture(markup as never)) as LyraCombobox;
    el.open = true;
    await el.updateComplete;
    await aTimeout(0);
    return el;
  }

  const rowFor = (el: LyraCombobox, value: string): HTMLElement =>
    el.shadowRoot!.querySelector<HTMLElement>(`[part="option"][data-value="${value}"]`)!;

  it('renders a start adornment inside the popup row', async () => {
    const el = await openWith(html`
      <lr-combobox>
        <lr-option value="fr"><span slot="start" id="fr-mark">FR</span>France</lr-option>
      </lr-combobox>
    `);
    const adornment = rowFor(el, 'fr').querySelector('[part~="option-start"]');

    expect(adornment, 'the documented start slot now renders').to.exist;
    expect(adornment!.textContent).to.contain('FR');
    expect(adornment!.getAttribute('aria-hidden'), 'decorative').to.equal('true');
    expect((adornment as HTMLElement).inert, 'not reachable').to.be.true;
  });

  it('renders an end adornment inside the popup row', async () => {
    const el = await openWith(html`
      <lr-combobox>
        <lr-option value="fr">France<span slot="end">€</span></lr-option>
      </lr-combobox>
    `);
    const adornment = rowFor(el, 'fr').querySelector('[part~="option-end"]');

    expect(adornment, 'the documented end slot now renders').to.exist;
    expect(adornment!.textContent).to.contain('€');
  });

  it('treats the Shoelace prefix/suffix aliases identically', async () => {
    const el = await openWith(html`
      <lr-combobox>
        <lr-option value="fr"><span slot="prefix">P</span>France<span slot="suffix">S</span></lr-option>
      </lr-combobox>
    `);
    const row = rowFor(el, 'fr');

    expect(row.querySelector('[part~="option-start"]')!.textContent).to.contain('P');
    expect(row.querySelector('[part~="option-end"]')!.textContent).to.contain('S');
  });

  it('leaves the author light-DOM option subtree untouched', async () => {
    const el = await openWith(html`
      <lr-combobox>
        <lr-option value="fr"><span slot="start" id="original">FR</span>France</lr-option>
      </lr-combobox>
    `);
    const original = el.querySelector('#original');

    expect(original, 'the author node is still where they put it').to.exist;
    expect(original!.parentElement!.tagName.toLowerCase()).to.equal('lr-option');
    expect(
      rowFor(el, 'fr').querySelector('[part~="option-start"]')!.contains(original!),
      'the popup renders a clone, not the original node',
    ).to.be.false;
  });

  it('emits no adornment wrapper for a plain option', async () => {
    const el = await openWith(html`
      <lr-combobox><lr-option value="fr">France</lr-option></lr-combobox>
    `);
    const row = rowFor(el, 'fr');

    expect(row.querySelector('[part~="option-start"]') === null, 'no empty start wrapper').to.be
      .true;
    expect(row.querySelector('[part~="option-end"]') === null, 'no empty end wrapper').to.be.true;
  });

  it('keeps the adornment out of the option accessible name', async () => {
    const el = await openWith(html`
      <lr-combobox>
        <lr-option value="fr"><span slot="start">FR</span>France</lr-option>
      </lr-combobox>
    `);
    const row = rowFor(el, 'fr');

    expect(row.querySelector('[part~="option-label"]')!.textContent!.trim()).to.equal('France');
  });

  it('upgrades a custom element used as an adornment in the clone', async () => {
    // Lit forbids a binding in a tag name, so the tag is written literally below and only the
    // definition is guarded.
    if (!customElements.get('test-combobox-adornment')) {
      customElements.define(
        'test-combobox-adornment',
        class extends HTMLElement {
          connectedCallback(): void {
            this.setAttribute('data-upgraded', 'yes');
          }
        },
      );
    }
    const el = await openWith(html`
      <lr-combobox>
        <lr-option value="fr"
          ><test-combobox-adornment slot="start"></test-combobox-adornment>France</lr-option
        >
      </lr-combobox>
    `);
    const clone = rowFor(el, 'fr').querySelector('test-combobox-adornment')!;

    expect(clone, 'the custom element reached the row').to.exist;
    expect(
      clone.getAttribute('data-upgraded'),
      'cloneNode keeps it upgradeable, unlike createElementNS',
    ).to.equal('yes');
  });
});

// -- only the presentation changes.
describe('unknown committed value presentation', () => {
  it('observes an initially empty local catalog and updates unknown feedback as options change', async () => {
    const el = await fixture<LyraCombobox>(html`
      <lr-combobox value="pending" with-unknown-option></lr-combobox>
    `);
    const input = el.shadowRoot!.querySelector<HTMLInputElement>('[part="combobox-input"]')!;
    await waitUntil(() => input.hasAttribute('data-unknown-value'));
    expect(input.value).to.equal('pending');
    expect(el.shadowRoot!.querySelector('[part="unknown-value"]') !== null).to.equal(true);

    const defaultSlot = el.shadowRoot!.querySelector<HTMLSlotElement>('slot:not([name])')!;
    const option = document.createElement('lr-option') as LyraOption;
    option.value = 'pending';
    option.textContent = 'Pending label';
    const added = oneEvent(defaultSlot, 'slotchange');
    el.append(option);
    await added;
    await el.updateComplete;
    expect(input.value).to.equal('Pending label');
    expect(input.hasAttribute('data-unknown-value')).to.equal(false);

    const removed = oneEvent(defaultSlot, 'slotchange');
    option.remove();
    await removed;
    await el.updateComplete;
    expect(el.value).to.equal('pending');
    expect(input.value).to.equal('pending');
    expect(input.hasAttribute('data-unknown-value')).to.equal(true);
  });

  it('flags the closed single-select input as unknown when the committed value matches no option', async () => {
    const el = (await fixture(html`
      <lr-combobox><lr-option value="a">Apple</lr-option></lr-combobox>
    `)) as LyraCombobox;
    el.value = 'ghost';
    await el.updateComplete;

    expect(el.value, 'the raw value is still reachable').to.equal('ghost');
    const input = el.shadowRoot!.querySelector('[part="combobox-input"]') as HTMLInputElement;
    expect(input.value, 'the native input value carries only the raw text, never markup').to.equal(
      'ghost',
    );
    expect(input.hasAttribute('data-unknown-value')).to.be.true;
    const badge = el.shadowRoot!.querySelector('[part="unknown-value"]');
    expect(badge, 'a distinguishing badge renders next to the input').to.exist;
  });

  it('renders the shipped English default for the unknown-value badge with no locale registered', async () => {
    const el = (await fixture(html`
      <lr-combobox><lr-option value="a">Apple</lr-option></lr-combobox>
    `)) as LyraCombobox;
    el.value = 'ghost';
    await el.updateComplete;
    const badge = el.shadowRoot!.querySelector('[part="unknown-value"]');
    expect(badge?.textContent).to.equal('not in catalog');
  });

  it('localizes the unknown-value badge through a .strings override', async () => {
    const el = (await fixture(html`
      <lr-combobox><lr-option value="a">Apple</lr-option></lr-combobox>
    `)) as LyraCombobox;
    el.strings = { notInCatalog: 'Hors catalogue' };
    el.value = 'ghost';
    await el.updateComplete;
    const badge = el.shadowRoot!.querySelector('[part="unknown-value"]');
    expect(badge?.textContent).to.equal('Hors catalogue');
  });

  it('does not flag a value that matches an option', async () => {
    const el = (await fixture(basic())) as LyraCombobox;
    el.value = 'a';
    await el.updateComplete;
    const input = el.shadowRoot!.querySelector('[part="combobox-input"]') as HTMLInputElement;
    expect(input.hasAttribute('data-unknown-value')).to.be.false;
    expect(el.shadowRoot!.querySelector('[part="unknown-value"]') === null).to.be.true;
  });

  it('does not flag while the listbox is open and the input shows the live query instead', async () => {
    const el = (await fixture(html`
      <lr-combobox><lr-option value="a">Apple</lr-option></lr-combobox>
    `)) as LyraCombobox;
    el.value = 'ghost';
    await el.updateComplete;
    el.open = true;
    await el.updateComplete;
    const input = el.shadowRoot!.querySelector('[part="combobox-input"]') as HTMLInputElement;
    expect(input.hasAttribute('data-unknown-value')).to.be.false;
  });

  it('flags only the unmatched tag in multiple mode, not every selected tag', async () => {
    const el = (await fixture(html`
      <lr-combobox multiple>
        <lr-option value="a">Apple</lr-option>
      </lr-combobox>
    `)) as LyraCombobox;
    el.value = ['a', 'ghost'];
    await el.updateComplete;

    const tags = el.shadowRoot!.querySelectorAll('[part="tag"]');
    expect(tags).to.have.length(2);
    expect(
      requiredItem(tags, 0, 'matched tag').hasAttribute('data-unknown-value'),
      'the matched value is not flagged',
    ).to.be.false;
    expect(
      requiredItem(tags, 1, 'unmatched tag').hasAttribute('data-unknown-value'),
      'the unmatched value is flagged',
    ).to.be.true;
    expect(
      requiredItem(tags, 1, 'unmatched tag').querySelector('[part="unknown-value"]'),
      'the unmatched chip carries the badge',
    ).to.exist;
  });

  it('never flags an allowCustomValue commit -- a sanctioned unmatched value, not a stale one', async () => {
    const el = (await fixture(html`
      <lr-combobox allow-custom-value>
        <lr-option value="red">Red</lr-option>
      </lr-combobox>
    `)) as LyraCombobox;
    const input = await typeQuery(el, 'Cerulean');
    input.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'Enter',
        bubbles: true,
        composed: true,
        cancelable: true,
      }),
    );
    await el.updateComplete;

    expect(el.value).to.equal('Cerulean');
    expect(input.hasAttribute('data-unknown-value'), 'a custom value is not "unknown"').to.be
      .false;
    expect(el.shadowRoot!.querySelector('[part="unknown-value"]') === null).to.be.true;
  });

  it('suppresses the badge while an in-flight source call has not resolved yet', async () => {
    const el = (await fixture(
      html`<lr-combobox source-delay="0"></lr-combobox>`,
    )) as LyraCombobox;
    let resolve!: (rows: { value: string; label: string }[]) => void;
    el.source = () => new Promise((r) => (resolve = r));
    el.value = 'ghost';
    await el.updateComplete;
    await waitUntil(
      () => (el as unknown as { sourceLoading: boolean }).sourceLoading,
      'the proactive warm-up fetch never started',
    );
    const input = el.shadowRoot!.querySelector('[part="combobox-input"]') as HTMLInputElement;
    expect(
      input.hasAttribute('data-unknown-value'),
      'still loading -- not yet known to be unknown',
    ).to.be.false;

    resolve([]);
    await waitUntil(
      () => !(el as unknown as { sourceLoading: boolean }).sourceLoading,
      'the source call never settled',
    );
    await el.updateComplete;
    expect(
      input.hasAttribute('data-unknown-value'),
      'resolved with no match -- genuinely unknown',
    ).to.be.true;
  });

  it('shows a loading placeholder in place of the raw value while a committed value has never resolved', async () => {
    const el = (await fixture(
      html`<lr-combobox source-delay="0"></lr-combobox>`,
    )) as LyraCombobox;
    let resolve!: (rows: { value: string; label: string }[]) => void;
    el.source = () => new Promise((r) => (resolve = r));
    el.value = 'ghost';
    await el.updateComplete;
    const input = el.shadowRoot!.querySelector('[part="combobox-input"]') as HTMLInputElement;
    // Before the debounced call has even started (`loading` is still false here), the raw
    // value must not leak either -- the gap is the whole unresolved window, not just the
    // in-flight span.
    expect(
      input.value,
      'a localized loading placeholder stands in even before the debounced fetch starts',
    ).to.equal('Loading…');
    await waitUntil(
      () => (el as unknown as { sourceLoading: boolean }).sourceLoading,
      'the proactive warm-up fetch never started',
    );
    expect(
      input.value,
      'the placeholder still stands in once the fetch is actually in flight',
    ).to.equal('Loading…');

    resolve([]);
    await waitUntil(
      () => !(el as unknown as { sourceLoading: boolean }).sourceLoading,
      'the source call never settled',
    );
    await el.updateComplete;
    expect(
      input.value,
      'settled with no match -- the raw value is the only thing left to show, now badged',
    ).to.equal('ghost');
    expect(input.hasAttribute('data-unknown-value')).to.be.true;
  });

  it('shows a loading placeholder on an unresolved tag in multiple mode too', async () => {
    const el = (await fixture(
      html`<lr-combobox multiple source-delay="0"></lr-combobox>`,
    )) as LyraCombobox;
    let resolve!: (rows: { value: string; label: string }[]) => void;
    el.source = () => new Promise((r) => (resolve = r));
    el.value = ['ghost'];
    await el.updateComplete;
    await waitUntil(
      () => (el as unknown as { sourceLoading: boolean }).sourceLoading,
      'the proactive warm-up fetch never started',
    );
    const tag = el.shadowRoot!.querySelector('[part="tag"]');
    expect(tag, 'the unresolved value still renders a tag').to.exist;
    expect(
      tag!.hasAttribute('data-unknown-value'),
      'not yet known to be unknown',
    ).to.be.false;
    expect(
      tag!.querySelector('[part="tag__content"]')?.textContent?.trim(),
      'a loading placeholder stands in for the raw value',
    ).to.equal('Loading…');
    resolve([]);
  });
});

// `<lr-option>` children asynchronously itself -- no `source` involved.
describe('public loading toggle (no source)', () => {
  it('defaults to false', async () => {
    const el = (await fixture(basic())) as LyraCombobox;
    expect(el.loading).to.be.false;
  });

  it('suppresses the unknown-value badge and shows a loading placeholder for a value whose option has not mounted yet', async () => {
    const el = (await fixture(
      html`<lr-combobox value="pending" loading></lr-combobox>`,
    )) as LyraCombobox;
    await el.updateComplete;

    const input = el.shadowRoot!.querySelector('[part="combobox-input"]') as HTMLInputElement;
    expect(
      input.hasAttribute('data-unknown-value'),
      'still loading -- not yet known to be unknown',
    ).to.be.false;
    expect(el.shadowRoot!.querySelector('[part="unknown-value"]') === null).to.be.true;
    expect(input.value, 'a loading placeholder stands in for the raw value').to.equal('Loading…');
    expect(el.value, 'the raw value is still reachable').to.equal('pending');
  });

  it('renders the real label once the matching option mounts, with no re-assignment of value', async () => {
    const el = (await fixture(
      html`<lr-combobox value="pending" loading></lr-combobox>`,
    )) as LyraCombobox;
    await el.updateComplete;

    const defaultSlot = el.shadowRoot!.querySelector('slot:not([name])') as HTMLSlotElement;
    const slotchangePromise = oneEvent(defaultSlot, 'slotchange');
    const option = document.createElement('lr-option') as LyraOption;
    option.setAttribute('value', 'pending');
    option.textContent = 'Pending Thing';
    el.append(option);
    await slotchangePromise;
    await el.updateComplete;

    expect(el.value, 'no re-assignment of value was needed').to.equal('pending');
    const input = el.shadowRoot!.querySelector('[part="combobox-input"]') as HTMLInputElement;
    expect(input.value, 'the real label renders once the option mounts').to.equal('Pending Thing');
  });

  it('flags a genuinely unmatched value once loading clears', async () => {
    const el = (await fixture(
      html`<lr-combobox value="ghost" loading></lr-combobox>`,
    )) as LyraCombobox;
    await el.updateComplete;
    const input = el.shadowRoot!.querySelector('[part="combobox-input"]') as HTMLInputElement;
    expect(input.hasAttribute('data-unknown-value')).to.be.false;

    el.loading = false;
    await el.updateComplete;
    expect(el.value, 'loading never touches value').to.equal('ghost');
    expect(input.value).to.equal('ghost');
    expect(input.hasAttribute('data-unknown-value')).to.be.true;
  });

  it('unset-regression: with loading false (the default), an unmatched value is flagged as before', async () => {
    const el = (await fixture(
      html`<lr-combobox value="ghost"></lr-combobox>`,
    )) as LyraCombobox;
    await el.updateComplete;
    const input = el.shadowRoot!.querySelector('[part="combobox-input"]') as HTMLInputElement;
    expect(input.hasAttribute('data-unknown-value')).to.be.true;
  });
});

// number adornments are wrapped in one span so the same rule reaches them.
describe("lr-combobox popup adornment truncation", () => {
  const LONG = "Adornment text that is far too long.";

  function expectTruncatedInside(adornment: HTMLElement, part: HTMLElement): void {
    const box = adornment.getBoundingClientRect();
    const partBox = part.getBoundingClientRect();
    expect(box.left, "start edge stays inside the part").to.be.at.least(partBox.left - 0.5);
    expect(box.right, "end edge stays inside the part").to.be.at.most(partBox.right + 0.5);
    expect(getComputedStyle(adornment).textOverflow).to.equal("ellipsis");
    const range = document.createRange();
    range.selectNodeContents(adornment);
    expect(
      range.getBoundingClientRect().width,
      "the text run is wider than its box"
    ).to.be.greaterThan(box.width + 0.01);
  }

  async function openRows(rows: unknown[]): Promise<HTMLElement> {
    const el = (await fixture(
      html`<lr-combobox style="inline-size: 240px"></lr-combobox>`
    )) as LyraCombobox;
    el.source = async () => rows as never;
    el.open = true;
    await el.updateComplete;
    await waitUntil(
      () => el.shadowRoot!.querySelector('[part="option"]') !== null,
      "the async row rendered",
      { timeout: 2000 }
    );
    return el.shadowRoot!.querySelector<HTMLElement>('[part="option"]')!;
  }

  for (const slot of ["start", "end"] as const) {
    it(`truncates a long cloned ${slot} text adornment with an ellipsis`, async () => {
      const el = (await fixture(html`
        <lr-combobox style="inline-size: 240px">
          <lr-option value="fr">France<span slot=${slot}>${LONG}</span></lr-option>
        </lr-combobox>
      `)) as LyraCombobox;
      el.open = true;
      await el.updateComplete;
      await aTimeout(0);
      const row = el.shadowRoot!.querySelector<HTMLElement>('[part="option"][data-value="fr"]')!;
      const part = row.querySelector<HTMLElement>(`[part~="option-${slot}"]`)!;
      expectTruncatedInside(part.firstElementChild as HTMLElement, part);
      expect(part.scrollWidth <= part.clientWidth + 1, "the part itself no longer overflows").to.equal(
        true
      );
    });
  }

  it("wraps an async string start adornment so it truncates from its start edge", async () => {
    const row = await openRows([{ value: "a", label: "Alpha", start: "x".repeat(36) }]);
    const part = row.querySelector<HTMLElement>('[part="option-start"]')!;
    const wrapper = part.firstElementChild as HTMLElement;
    expect(wrapper?.localName, "a wrapper span holds the text").to.equal("span");
    expect(
      Math.abs(wrapper.getBoundingClientRect().left - part.getBoundingClientRect().left),
      "the wrapper starts at the part's start edge"
    ).to.be.at.most(0.5);
    expectTruncatedInside(wrapper, part);
  });

  it("wraps an async number end adornment", async () => {
    const row = await openRows([{ value: "a", label: "Alpha", end: 42 }]);
    const part = row.querySelector<HTMLElement>('[part="option-end"]')!;
    expect(part.firstElementChild?.localName).to.equal("span");
    expect(part.textContent!.trim()).to.equal("42");
  });

  it("passes an async element adornment through without a wrapper", async () => {
    const row = await openRows([
      { value: "a", label: "Alpha", start: html`<lr-icon id="async-icon" name="star"></lr-icon>` },
    ]);
    const part = row.querySelector<HTMLElement>('[part="option-start"]')!;
    expect(part.firstElementChild?.id, "the icon stays the part's direct child").to.equal(
      "async-icon"
    );
  });
});

describe("--lr-combobox-color and its deprecated --lr-combobox-text-color alias", () => {
  for (const [name, style] of [
    ["canonical", "--lr-combobox-color: rgb(1, 2, 3)"],
    ["deprecated", "--lr-combobox-text-color: rgb(1, 2, 3)"],
    ["canonical over deprecated", "--lr-combobox-color: rgb(1, 2, 3); --lr-combobox-text-color: rgb(9, 9, 9)"],
  ] as const) {
    it(`checks trigger color reach for ${name}`, async () => {
      const el = (await fixture(html`
        <lr-combobox style=${style}><lr-option value="a">Apple</lr-option></lr-combobox>
      `)) as LyraCombobox;
      await el.updateComplete;
      const box = el.shadowRoot!.querySelector<HTMLElement>('[part="combobox"]')!;
      expect(getComputedStyle(box).color === "rgb(1, 2, 3)").to.equal(!name.startsWith('deprecated'));
    });
  }
});

describe('shared row content-aware decoration', () => {
  const cases = [
    { markup: html`<lr-select label="Role"><lr-option value="a">Editor</lr-option></lr-select>`, row: '[part="trigger"]', name: 'select' },
    { markup: html`<lr-combobox label="Role"><lr-option value="a">Editor</lr-option></lr-combobox>`, row: '[part="combobox"]', name: 'combobox' },
  ];

  it('fits each default decorative indicator inside the medium row content box', async () => {
    for (const testCase of cases) {
      const el = await fixture<HTMLElement>(testCase.markup);
      const row = el.shadowRoot!.querySelector<HTMLElement>(testCase.row)!;
      const indicator = el.shadowRoot!.querySelector<HTMLElement>('[part="expand-icon"]')!;
      const rowStyle = getComputedStyle(row);
      const contentHeight = row.getBoundingClientRect().height
        - parseFloat(rowStyle.paddingTop) - parseFloat(rowStyle.paddingBottom)
        - parseFloat(rowStyle.borderTopWidth) - parseFloat(rowStyle.borderBottomWidth);
      expect(row.getBoundingClientRect().height, testCase.name).to.equal(36);
      expect(indicator.getBoundingClientRect().height, testCase.name).to.be.at.most(contentHeight);
    }
  });

  it('honors authored decorative sizes and row padding while letting their content grow', async () => {
    for (const testCase of cases) {
      const el = await fixture<HTMLElement>(testCase.markup);
      const row = el.shadowRoot!.querySelector<HTMLElement>(testCase.row)!;
      const indicator = el.shadowRoot!.querySelector<HTMLElement>('[part="expand-icon"]')!;
      el.style.setProperty(`--lr-${testCase.name}-trigger-padding`, '12px');
      el.style.setProperty(`--lr-${testCase.name}-expand-size`, '32px');
      expect(getComputedStyle(row).paddingBlock, testCase.name).to.equal('12px');
      expect(getComputedStyle(indicator).minBlockSize, testCase.name).to.equal('32px');
      expect(row.getBoundingClientRect().height, testCase.name).to.be.at.least(58);
    }
  });
});
