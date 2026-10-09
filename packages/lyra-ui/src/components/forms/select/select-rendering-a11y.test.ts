import { resolvedColorIn, resolvedInShadow } from '../../../../test/shadow-style.js';
import { measureListboxRow, settlePointerStyle as settle } from '../../../../test/row-style.js';
import { fixture, expect, oneEvent, html, waitUntil, aTimeout } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import './select.js';
import '../combobox/option.js';
import '../combobox/combobox.js';
import type { LyraSelect } from './select.js';
import type { LyraCombobox } from '../combobox/combobox.js';
import { styles } from './select.styles.js';
import { resetMouse, sendMouse, settlePointer } from '../../../../test/wtr-mouse.js';


const basic = () => html`
  <lr-select>
    <lr-option value="a">Apple</lr-option>
    <lr-option value="b">Banana</lr-option>
    <lr-option value="c">Cherry</lr-option>
  </lr-select>
`;

function trigger(el: LyraSelect): HTMLButtonElement {
  return el.shadowRoot!.querySelector('[part="trigger"]') as HTMLButtonElement;
}

function rows(el: LyraSelect): NodeListOf<HTMLElement> {
  return el.shadowRoot!.querySelectorAll('[part="option"]');
}

function clearButton(el: LyraSelect): HTMLButtonElement | null {
  return el.shadowRoot!.querySelector('[part="clear-button"]');
}

/** Resolve a token expression inside the component's own shadow scope, so a computed
 *  `rgb(...)` can be compared against a `var(--lr-*)` declaration like-for-like. */
function resolved(
  el: LyraSelect,
  property: string,
  declaration: string
): string {
  return resolvedInShadow(el, `${property}: ${declaration}`, property);
}




it("renders lr-option children as listbox rows with the placeholder shown as the trigger label", async () => {
  const el = (await fixture(basic())) as LyraSelect;
  el.placeholder = "Pick a fruit…";
  el.open = true;
  await el.updateComplete;

  expect(rows(el).length).to.equal(3);
  expect(trigger(el).textContent).to.contain("Pick a fruit…");
  expect(el.value).to.equal("");
});


it("rejects unsafe option dot colors while preserving valid CSS colors", async () => {
  const el = await fixture<LyraSelect>(html`
    <lr-select open>
      <lr-option value="a" dot-color="red;position:fixed">A</lr-option>
    </lr-select>
  `);
  const dot = el.shadowRoot!.querySelector(
    '[part="option-dot"]'
  ) as HTMLElement;
  expect(dot.style.position).to.equal("");
  expect(dot.style.backgroundColor).to.equal("transparent");

  const safe = await fixture<LyraSelect>(html`
    <lr-select open>
      <lr-option value="a" dot-color="color-mix(in srgb, red 50%, blue)"
        >A</lr-option
      >
    </lr-select>
  `);
  expect(
    (safe.shadowRoot!.querySelector('[part="option-dot"]') as HTMLElement).style
      .backgroundColor
  ).to.not.equal("");
});


it("does not override an explicit `label` slot with the fallback aria-label", async () => {
  const el = (await fixture(
    html`<lr-select><span slot="label">Region</span></lr-select>`
  )) as LyraSelect;
  await el.updateComplete;
  const triggerEl = el.shadowRoot!.querySelector(
    '[part="trigger"]'
  ) as HTMLButtonElement;
  expect(triggerEl.getAttribute("aria-label")).to.not.equal("Select");
});


it("re-renders when an already-slotted option mutates its own label", async () => {
  const el = (await fixture(
    html`<lr-select><lr-option value="x">Old label</lr-option></lr-select>`
  )) as LyraSelect;
  // Open BEFORE mutating, with no further `open` toggle afterward — this is
  // what makes the test discriminating: opening AFTER the mutation would
  // force an ordinary re-render that reads the option's live (already-new)
  // textContent regardless of whether the lr-option-change/MutationObserver
  // mechanism fired at all.
  el.open = true;
  await el.updateComplete;
  const option = el.querySelector("lr-option")!;
  option.textContent = "New label";
  await new Promise((r) => setTimeout(r, 0)); // let the MutationObserver's microtask + onOptionChange's re-render land
  await el.updateComplete;
  const row = el.shadowRoot!.querySelector('[part="option"]')!;
  expect(row.textContent).to.include("New label");
});


it("renders sub and dot-color from light-DOM options", async () => {
  const el = (await fixture(html`
    <lr-select>
      <lr-option value="a" sub="Running" dot-color="green">Meter A</lr-option>
    </lr-select>
  `)) as LyraSelect;
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


it("lays out option status dots and labels in a vertically centered row", async () => {
  const el = (await fixture(html`
    <lr-select>
      <lr-option value="a" sub="Running" dot-color="green">Meter A</lr-option>
    </lr-select>
  `)) as LyraSelect;
  el.open = true;
  await el.updateComplete;

  const row = el.shadowRoot!.querySelector('[part="option"]') as HTMLElement;
  const dot = el.shadowRoot!.querySelector(
    '[part="option-dot"]'
  ) as HTMLElement;
  const label = el.shadowRoot!.querySelector(
    '[part="option-label"]'
  ) as HTMLElement;
  row.style.minBlockSize = "80px";

  const rowStyle = getComputedStyle(row);
  expect(rowStyle.flexDirection).to.equal("row");
  expect(rowStyle.alignItems).to.equal("center");

  const dotRect = dot.getBoundingClientRect();
  const labelRect = label.getBoundingClientRect();
  expect(
    dotRect.right < labelRect.left,
    "the shared option gap must separate the leading dot and label"
  ).to.be.true;
  expect(
    Math.abs(
      (dotRect.top + dotRect.bottom) / 2 -
        (labelRect.top + labelRect.bottom) / 2
    )
  ).to.be.lessThan(1);
});


it("renders a group-label header when option rows are grouped", async () => {
  const el = (await fixture(html`
    <lr-select>
      <lr-option value="a" group="Fruits">Apple</lr-option>
      <lr-option value="b" group="Fruits">Banana</lr-option>
      <lr-option value="c" group="Vegetables">Carrot</lr-option>
    </lr-select>
  `)) as LyraSelect;
  el.open = true;
  await el.updateComplete;

  const groups = Array.from(
    el.shadowRoot!.querySelectorAll(".group-label")
  ).map((n) => n.textContent);
  expect(groups).to.deep.equal(["Fruits", "Vegetables"]);

  const semanticGroups = [
    ...el.shadowRoot!.querySelectorAll<HTMLElement>('[role="group"]'),
  ];
  expect(semanticGroups).to.have.lengthOf(2);
  expect(
    semanticGroups.map(
      (group) => group.querySelectorAll('[role="option"]').length
    )
  ).to.deep.equal([2, 1]);
  for (const group of semanticGroups) {
    const labelId = group.getAttribute("aria-labelledby");
    const label = labelId ? el.shadowRoot!.getElementById(labelId) : null;
    expect(Boolean(labelId), "each group owns a stable label reference").to.be
      .true;
    expect(label?.classList.contains("group-label")).to.be.true;
    expect(
      group.contains(label),
      "the label and options share the semantic group"
    ).to.be.true;
  }
});


it("pairs the form-control label with the trigger via for/id so clicking the label focuses it", async () => {
  const el = (await fixture(basic())) as LyraSelect;
  el.label = "Fruit";
  await el.updateComplete;
  const label = el.shadowRoot!.querySelector(
    '[part="form-control-label"]'
  ) as HTMLLabelElement;
  const btn = trigger(el);
  expect(label.htmlFor, "label should have a for attribute").to.not.equal("");
  expect(label.htmlFor).to.equal(btn.id);
});


it("hides the error and hint parts when empty, shows them once populated", async () => {
  const el = (await fixture(basic())) as LyraSelect;
  await el.updateComplete;

  const errorPart = el.shadowRoot!.querySelector(
    '[part="error"]'
  ) as HTMLElement;
  const hintPart = el.shadowRoot!.querySelector(
    '[part~="hint"]'
  ) as HTMLElement;
  expect(getComputedStyle(errorPart).display).to.equal("none");
  expect(getComputedStyle(hintPart).display).to.equal("none");

  el.errorText = "Selection required";
  el.hint = "Pick a fruit";
  await el.updateComplete;
  expect(getComputedStyle(errorPart).display).to.not.equal("none");
  expect(getComputedStyle(hintPart).display).to.not.equal("none");
});


it("associates the trigger with the hint/error text via aria-describedby, like lr-combobox", async () => {
  const el = (await fixture(basic())) as LyraSelect;
  await el.updateComplete;
  const btn = trigger(el);
  expect(btn.hasAttribute("aria-describedby")).to.be.false;

  el.hint = "Pick a fruit";
  await el.updateComplete;
  expect(btn.getAttribute("aria-describedby")).to.equal("select-hint");

  el.errorText = "Selection required";
  await el.updateComplete;
  expect(btn.getAttribute("aria-describedby")).to.equal(
    "select-error select-hint"
  );
});


it("is accessible", async () => {
  const el = (await fixture(basic())) as LyraSelect;
  el.label = "Fruit";
  await el.updateComplete;
  await expect(el).to.be.accessible();
});


it("is accessible while open", async () => {
  const el = (await fixture(basic())) as LyraSelect;
  el.label = "Fruit";
  el.open = true;
  await el.updateComplete;
  // `[part='listbox']`'s opacity transition (gated by :host([open])) is still running right after
  // `open` is set and the update settles. Left running, axe's color-contrast check factors in the
  // listbox's current (transitional) opacity, so sampling mid-fade blends its text and background
  // toward each other and reports a false "serious" violation. Finishing it outright matches the
  // idiom overlay.test.ts already uses for this same kind of reveal animation.
  el.shadowRoot!.querySelector('[part="listbox"]')
    ?.getAnimations()
    .forEach((animation) => animation.finish());
  await expect(el).to.be.accessible();
});


it("applies a size attribute that reflects to the host", async () => {
  const el = (await fixture(
    html`<lr-select size="s"></lr-select>`
  )) as LyraSelect;
  expect(el.getAttribute("size")).to.equal("s");
  expect(el.size).to.equal("s");
});


it('defaults to size "m"', async () => {
  const el = (await fixture(html`<lr-select></lr-select>`)) as LyraSelect;
  expect(el.size).to.equal("m");
});


it("prefers a host-level aria-label over label/placeholder for the trigger", async () => {
  const el = (await fixture(
    html`<lr-select aria-label="Sort order" placeholder="Choose…"></lr-select>`
  )) as LyraSelect;
  const trigger = el.shadowRoot!.querySelector(
    '[part="trigger"]'
  ) as HTMLElement;
  expect(trigger.getAttribute("aria-label")).to.equal("Sort order");
});


it("preserves an explicitly empty host aria-label on the trigger", async () => {
  const el = (await fixture(
    html`<lr-select
      aria-label=""
      label="Choice"
      placeholder="Choose…"
    ></lr-select>`
  )) as LyraSelect;
  const trigger = el.shadowRoot!.querySelector(
    '[part="trigger"]'
  ) as HTMLElement;
  expect(trigger.hasAttribute("aria-label")).to.equal(true);
  expect(trigger.getAttribute("aria-label")).to.equal("");
});


it("falls back to placeholder when no host aria-label or label is set", async () => {
  const el = (await fixture(
    html`<lr-select placeholder="Choose…"></lr-select>`
  )) as LyraSelect;
  const trigger = el.shadowRoot!.querySelector(
    '[part="trigger"]'
  ) as HTMLElement;
  expect(trigger.getAttribute("aria-label")).to.equal("Choose…");
});


describe("trigger aria-label localization", () => {
  it('falls back to the localized "Select" when no aria-label, label, or placeholder is set', async () => {
    const el = (await fixture(html`<lr-select></lr-select>`)) as LyraSelect;
    expect(trigger(el).getAttribute("aria-label")).to.equal("Select");
  });

  it("localizes the fallback trigger aria-label via this.localize() when .strings overrides select", async () => {
    const el = (await fixture(
      html`<lr-select .strings=${{ select: "Sélectionner" }}></lr-select>`
    )) as LyraSelect;
    expect(trigger(el).getAttribute("aria-label")).to.equal("Sélectionner");
  });
});


it("lets a consumer pin an exact trigger height via --lr-select-trigger-height, bypassing the min-height floor", async () => {
  const el = (await fixture(
    html`<lr-select label="Role"><lr-option value="a">A</lr-option></lr-select>`
  )) as LyraSelect;
  el.style.setProperty("--lr-select-trigger-height", "43px");
  await el.updateComplete;
  const trigger = el.shadowRoot!.querySelector(
    '[part="trigger"]'
  ) as HTMLElement;
  expect(getComputedStyle(trigger).blockSize).to.equal("43px");
});


it("leaves today's min-height-floor-only behavior unchanged when the override is unset", async () => {
  const el = (await fixture(
    html`<lr-select label="Role"><lr-option value="a">A</lr-option></lr-select>`
  )) as LyraSelect;
  await el.updateComplete;
  const trigger = el.shadowRoot!.querySelector(
    '[part="trigger"]'
  ) as HTMLElement;
  expect(getComputedStyle(trigger).blockSize).to.not.equal("0px");
  // No forced block-size -- the trigger's rendered height still comes from its own
  // padding/line-height/border, only floored by --lr-select-trigger-min-height as before.
});


describe("per-size min-height floor", () => {
  it("actually enforces --lr-select-trigger-min-height at each non-default size", async () => {
    // --lr-select-trigger-min-height is declared per size tier (xs=1.5rem, s=2rem,
    // l=2.5rem, xl=3.5rem) but was never wired to min-block-size for those tiers -- this is the
    // regression test for that fix.
    const expected: Record<string, string> = {
      xs: "24px",
      s: "32px",
      l: "40px",
      xl: "56px",
    };
    for (const [size, px] of Object.entries(expected)) {
      const el = (await fixture(
        html`<lr-select size=${size} label="Role"
          ><lr-option value="a">A</lr-option></lr-select
        >`
      )) as LyraSelect;
      const t = el.shadowRoot!.querySelector('[part="trigger"]') as HTMLElement;
      expect(getComputedStyle(t).minBlockSize, `size=${size}`).to.equal(px);
    }
  });

  it("enforces the same floor on the default (m) tier, matching lr-input/lr-combobox at that tier", async () => {
    const el = (await fixture(
      html`<lr-select label="Role"
        ><lr-option value="a">A</lr-option></lr-select
      >`
    )) as LyraSelect;
    const t = el.shadowRoot!.querySelector('[part="trigger"]') as HTMLElement;
    expect(getComputedStyle(t).minBlockSize).to.equal("36px");
  });

  it("lets a consumer raise --lr-select-trigger-min-height at the default tier", async () => {
    const el = (await fixture(
      html`<lr-select label="Role"
        ><lr-option value="a">A</lr-option></lr-select
      >`
    )) as LyraSelect;
    el.style.setProperty("--lr-select-trigger-min-height", "52px");
    await el.updateComplete;
    const t = el.shadowRoot!.querySelector('[part="trigger"]') as HTMLElement;
    expect(getComputedStyle(t).minBlockSize).to.equal("52px");
  });

  it('keeps --lr-select-trigger-min-height live at size="s" with no specificity patch rule', async () => {
    const el = (await fixture(
      html`<lr-select size="s" label="Role"
        ><lr-option value="a">A</lr-option></lr-select
      >`
    )) as LyraSelect;
    const t = el.shadowRoot!.querySelector('[part="trigger"]') as HTMLElement;
    expect(getComputedStyle(t).minBlockSize).to.equal("32px");
    el.style.setProperty("--lr-select-trigger-min-height", "33px");
    await el.updateComplete;
    expect(getComputedStyle(t).minBlockSize).to.equal("33px");
  });

  it("a consumer-pinned --lr-select-trigger-height still overrides the per-size floor", async () => {
    const el = (await fixture(
      html`<lr-select size="s" label="Role"
        ><lr-option value="a">A</lr-option></lr-select
      >`
    )) as LyraSelect;
    el.style.setProperty("--lr-select-trigger-height", "43px");
    await el.updateComplete;
    const t = el.shadowRoot!.querySelector('[part="trigger"]') as HTMLElement;
    expect(getComputedStyle(t).blockSize).to.equal("43px");
    expect(getComputedStyle(t).minBlockSize).to.equal("43px");
  });
});


describe("trigger gap/radius cssprops", () => {
  it("exposes --lr-select-gap and --lr-select-radius, defaulting to the shared token defaults", async () => {
    const el = (await fixture(basic())) as LyraSelect;
    const cs = getComputedStyle(trigger(el));
    expect(cs.gap).to.equal("4px");
    expect(cs.borderRadius).to.equal("8px");
  });

  it("retunes the trigger gap and corner radius with no ::part(trigger) rule", async () => {
    const el = (await fixture(basic())) as LyraSelect;
    el.style.setProperty("--lr-select-gap", "12px");
    el.style.setProperty("--lr-select-radius", "3px");
    await el.updateComplete;
    const cs = getComputedStyle(trigger(el));
    expect(cs.gap).to.equal("12px");
    expect(cs.borderRadius).to.equal("3px");
  });

  it("keeps the trigger gap constant across tiers while the radius follows the shared ladder", async () => {
    const triggerOf = (host: LyraSelect) =>
      host.shadowRoot!.querySelector('[part="trigger"]') as HTMLElement;
    const mEl = (await fixture(basic())) as LyraSelect;
    const xsEl = (await fixture(
      html`<lr-select size="xs"></lr-select>`
    )) as LyraSelect;
    // The trigger's adornment gap is deliberately outside the ladder -- it never varied by tier.
    expect(getComputedStyle(triggerOf(mEl)).gap).to.equal("4px");
    expect(getComputedStyle(triggerOf(xsEl)).gap).to.equal("4px");
    // The radius does vary: an 8px corner on a 24px-tall trigger reads as a lozenge.
    expect(getComputedStyle(triggerOf(mEl)).borderTopLeftRadius).to.equal(
      "8px"
    );
    expect(getComputedStyle(triggerOf(xsEl)).borderTopLeftRadius).to.equal(
      "4px"
    );
  });
});


it('clamps its keyboard-opened floating surface width through the shared popover-viewport-clamp token', async () => {
  const el = (await fixture(html`
    <lr-select data-lr-theme-scope style="--lr-popover-viewport-clamp: 10px; --lr-transition-fast: 0s">
      <lr-option value="a">Apple</lr-option>
    </lr-select>
  `)) as LyraSelect;
  const trigger = el.shadowRoot!.querySelector<HTMLButtonElement>('[part="trigger"]')!;
  const listbox = el.shadowRoot!.querySelector<HTMLElement>('[part="listbox"]')!;

  trigger.focus();
  await sendKeys({ press: 'ArrowDown' });
  await waitUntil(
    () => el.open && getComputedStyle(listbox).visibility === 'visible',
    'the keyboard-opened select did not show its listbox'
  );
  await waitUntil(
    () => getComputedStyle(listbox).maxInlineSize === '10px',
    'the visible select listbox did not receive the viewport clamp'
  );

  expect(getComputedStyle(listbox).maxInlineSize).to.equal('10px');
});

// `sync` is the shared anchored-surface sizing vocabulary `<lr-popup>`, `<lr-popover>`,
// `<lr-dropdown>` and `<lr-combobox>` already spell; this is the fourth trigger-plus-listbox
// control to take it, with the same type (`PlaceSync`), the same unset default, and the same
// corrected clamp -- a synced listbox is bounded by the measured available space alone, never by
// `--lr-popover-viewport-clamp`.

describe('sync (listbox sizing shared with lr-popup/lr-dropdown/lr-combobox)', () => {
  // The clamp tokens are authored to fixed pixel values so the content-sized default is a
  // deterministic measured number on any test-runner window, rather than a root-font-size guess.
  const clampedTokens =
    '--lr-size-12rem: 150px; --lr-size-28rem: 300px; --lr-transition-fast: 0s';

  async function openPositioned(el: LyraSelect): Promise<HTMLElement> {
    const listbox = el.shadowRoot!.querySelector<HTMLElement>('[part="listbox"]')!;
    el.open = true;
    await el.updateComplete;
    // `deferredPlaceReady` keeps the popup concealed until the first placement has actually run,
    // so a visible listbox is a placed listbox -- the synced width is already written here.
    await waitUntil(
      () => el.open && getComputedStyle(listbox).visibility === 'visible',
      'the opened select never showed a placed listbox'
    );
    return listbox;
  }

  const triggerWidth = (el: LyraSelect): number =>
    el
      .shadowRoot!.querySelector<HTMLElement>('[part="trigger"]')!
      .getBoundingClientRect().width;

  it('is unset by default and leaves the content-sized listbox clamp untouched', async () => {
    const el = (await fixture(html`
      <lr-select style="width: 500px; ${clampedTokens}">
        <lr-option value="a">Apple</lr-option>
      </lr-select>
    `)) as LyraSelect;

    expect(el.sync, 'sync is unset by default').to.equal(undefined);
    expect(el.hasAttribute('sync'), 'nothing is reflected for an unset sync').to.be.false;

    const listbox = await openPositioned(el);
    expect(triggerWidth(el), 'the fixture trigger is much wider than the content clamp').to.be.greaterThan(
      400
    );
    expect(getComputedStyle(listbox).minInlineSize).to.equal('150px');
    expect(getComputedStyle(listbox).maxInlineSize).to.equal('300px');
    expect(
      listbox.getBoundingClientRect().width,
      'an unsynced listbox still sizes to its own content floor'
    ).to.be.closeTo(150, 0.5);
  });

  it('renders the listbox at the rendered trigger width under sync="width"', async () => {
    const el = (await fixture(html`
      <lr-select sync="width" style="width: 500px; ${clampedTokens}">
        <lr-option value="a">Apple</lr-option>
      </lr-select>
    `)) as LyraSelect;

    expect(el.sync).to.equal('width');
    const listbox = await openPositioned(el);
    expect(
      listbox.getBoundingClientRect().width,
      'the width-synced listbox aligns to its own trigger edges'
    ).to.be.closeTo(triggerWidth(el), 0.5);
  });

  it('matches a width-synced listbox to a trigger wider than the viewport clamp', async () => {
    // The corrected clamp ported from `<lr-combobox>`: `--lr-popover-viewport-clamp` defaults to
    // 92vw, so a trigger wider than 92vw is a trigger wider than the clamp. Authoring the token
    // below the trigger width reproduces that at any window size.
    const el = (await fixture(html`
      <lr-select data-lr-theme-scope
        sync="width"
        style="width: 500px; --lr-popover-viewport-clamp: 200px; --lr-transition-fast: 0s"
      >
        <lr-option value="a">Apple</lr-option>
      </lr-select>
    `)) as LyraSelect;

    const listbox = await openPositioned(el);
    expect(triggerWidth(el), 'the fixture trigger is wider than the authored clamp').to.be.greaterThan(
      200
    );
    expect(
      listbox.getBoundingClientRect().width,
      'no viewport-clamp shortfall against the trigger'
    ).to.be.closeTo(triggerWidth(el), 0.5);
  });

  it('still bounds a width-synced listbox by the measured available inline space', async () => {
    const el = (await fixture(html`
      <lr-select data-lr-theme-scope sync="width" style="width: 3000px; --lr-transition-fast: 0s">
        <lr-option value="a">Apple</lr-option>
      </lr-select>
    `)) as LyraSelect;

    const listbox = await openPositioned(el);
    const available = Number.parseFloat(
      listbox.style.getPropertyValue('--lr-positioner-available-inline-size')
    );
    expect(available, 'the positioner published an available inline size').to.be.greaterThan(0);
    const rendered = listbox.getBoundingClientRect().width;
    expect(rendered, 'the over-wide trigger width was not copied verbatim').to.be.lessThan(
      triggerWidth(el)
    );
    expect(rendered, 'the listbox settles on the measured available space').to.be.closeTo(
      available,
      0.5
    );
  });

  it('accepts exactly the value set lr-combobox accepts, with the same unset default', async () => {
    const select = (await fixture(html`<lr-select></lr-select>`)) as LyraSelect;
    const combobox = (await fixture(
      html`<lr-combobox></lr-combobox>`
    )) as LyraCombobox;

    expect(select.sync, 'the same unset default').to.equal(combobox.sync);
    for (const value of ['width', 'height', 'both'] as const) {
      select.sync = value;
      combobox.sync = value;
      await Promise.all([select.updateComplete, combobox.updateComplete]);
      expect(select.getAttribute('sync'), `sync="${value}" reflects`).to.equal(
        combobox.getAttribute('sync')
      );
      expect(select.sync).to.equal(combobox.sync);
    }
  });

  it('returns to the content-sized clamp when sync is unset again', async () => {
    // AGENTS.md: every new opt-in property gets an explicit unset-regression test. Unsetting has
    // to release the inline width the positioner wrote, not merely stop maintaining it.
    const el = (await fixture(html`
      <lr-select sync="width" style="width: 500px; ${clampedTokens}">
        <lr-option value="a">Apple</lr-option>
      </lr-select>
    `)) as LyraSelect;

    const listbox = await openPositioned(el);
    expect(listbox.getBoundingClientRect().width).to.be.closeTo(triggerWidth(el), 0.5);

    el.sync = undefined;
    await el.updateComplete;
    expect(el.hasAttribute('sync'), 'the reflected attribute is removed').to.be.false;
    await waitUntil(
      () =>
        getComputedStyle(listbox).visibility === 'visible' &&
        Math.abs(listbox.getBoundingClientRect().width - 150) < 0.5,
      'the still-open listbox never returned to its content-sized clamp'
    );

    expect(getComputedStyle(listbox).minInlineSize).to.equal('150px');
    expect(getComputedStyle(listbox).maxInlineSize).to.equal('300px');
  });

  it('is accessible while open and width-synced', async () => {
    const el = (await fixture(html`
      <lr-select data-lr-theme-scope sync="width" label="Fruit" style="width: 500px; --lr-transition-fast: 0s">
        <lr-option value="a">Apple</lr-option>
        <lr-option value="b">Banana</lr-option>
      </lr-select>
    `)) as LyraSelect;

    const listbox = await openPositioned(el);
    // Same mid-fade color-contrast guard the other open-state axe check uses.
    listbox.getAnimations().forEach((animation) => animation.finish());
    await expect(el).to.be.accessible();
  });
});


it('inherits a 20px host font into its clear and tag-remove controls and their one-em glyphs', async () => {
  const el = (await fixture(html`
    <lr-select
      multiple
      clearable
      style="font: 20px/1 monospace; --lr-select-tag-font-size: 20px"
    >
      <lr-option value="a">Apple</lr-option>
    </lr-select>
  `)) as LyraSelect;
  el.value = ['a'];
  await el.updateComplete;

  expect(getComputedStyle(el).fontSize).to.equal('20px');
  for (const selector of ['[part="clear-button"]', '[part~="tag__remove-button"]']) {
    const control = el.shadowRoot!.querySelector<HTMLElement>(selector)!;
    const glyph = control.querySelector<SVGElement>('svg')!;
    expect(getComputedStyle(control).fontSize, `${selector} font size`).to.equal('20px');
    expect(getComputedStyle(control).fontFamily, `${selector} font family`).to.equal(
      getComputedStyle(el).fontFamily
    );
    expect(getComputedStyle(glyph).width, `${selector} one-em glyph size`).to.equal('20px');
    expect(getComputedStyle(glyph).height, `${selector} one-em glyph height`).to.equal('20px');
  }
});


it("renders a populated open listbox with vertical scrolling and horizontal overflow clipped", async () => {
  // Per the CSS overflow spec, pinning one axis to a non-'visible' value forces the other axis's
  // used value to 'auto' too -- an implicit overflow-x: auto here risks a phantom horizontal
  // scrollbar even though this listbox only ever scrolls vertically. Same class of bug already
  // fixed on lr-tab-group' tablist (overflow-x: auto; overflow-y: hidden;), just the opposite axis.
  const el = (await fixture(html`
    <lr-select open style="--lr-size-18rem: 40px;">
      <lr-option value="a">Apple</lr-option>
      <lr-option value="b">Banana</lr-option>
      <lr-option value="c">Cherry</lr-option>
    </lr-select>
  `)) as LyraSelect;
  await el.updateComplete;
  const listbox =
    el.shadowRoot!.querySelector<HTMLElement>('[part="listbox"]')!;
  await waitUntil(() => getComputedStyle(listbox).visibility === 'visible');
  const computed = getComputedStyle(listbox);

  expect(computed.visibility).to.equal("visible");
  expect(listbox.scrollHeight).to.be.greaterThan(listbox.clientHeight);
  expect(computed.overflowY).to.equal("auto");
  expect(computed.overflowX).to.equal("hidden");
});


it("contains long form and option content at a 320px allocation", async () => {
  const long = `generated-${"identifier".repeat(24)}`;
  const wrapper = await fixture(html`
    <div style="display:flex; inline-size:320px;">
      <lr-select style="min-inline-size:0; flex:1 1 auto;">
        <lr-option value="long" group=${long} sub=${long} dot-color="green"
          >${long}</lr-option
        >
      </lr-select>
    </div>
  `);
  const el = wrapper.querySelector("lr-select") as LyraSelect;
  el.label = long;
  el.hint = long;
  el.errorText = long;
  el.open = true;
  await el.updateComplete;

  expect(el.getBoundingClientRect().width).to.be.at.most(321);
  for (const selector of [
    '[part="form-control"]',
    '[part="form-control-label"]',
    '[part~="hint"]',
    '[part="error"]',
    '[part="option"]',
    '[part="option-label"]',
    '[part="option-sub"]',
    ".group-label",
  ]) {
    const part = el.shadowRoot!.querySelector(selector) as HTMLElement;
    const rect = part.getBoundingClientRect();
    expect(
      getComputedStyle(part).display,
      `${selector} should be visible`
    ).to.not.equal("none");
    expect(
      part.scrollWidth,
      `${selector} should contain its rendered text`
    ).to.be.at.most(Math.ceil(rect.width) + 1);
  }
});


it("lets its trigger shrink below a long placeholder's min-content width", async () => {
  const placeholder = `SelecioneUmaOpcaoLocalizada${"MuitoLonga".repeat(12)}`;
  const wrapper = (await fixture(html`
    <div style="display:flex; inline-size:228px; min-inline-size:0;">
      <lr-select
        style="min-inline-size:0; flex:1 1 auto;"
        placeholder=${placeholder}
      ></lr-select>
    </div>
  `)) as HTMLElement;
  const el = wrapper.querySelector("lr-select") as LyraSelect;
  await el.updateComplete;

  const trigger =
    el.shadowRoot!.querySelector<HTMLElement>('[part="trigger"]')!;
  const label = trigger.querySelector<HTMLElement>(".trigger-label")!;
  const wrapperRect = wrapper.getBoundingClientRect();
  const triggerRect = trigger.getBoundingClientRect();

  expect(triggerRect.width).to.be.at.most(wrapperRect.width + 1);
  expect(triggerRect.right).to.be.at.most(wrapperRect.right + 1);
  expect(label.scrollWidth).to.be.greaterThan(label.clientWidth);
  expect(getComputedStyle(label).textOverflow).to.equal("ellipsis");
});


it("contains a long selected value and adornments at 320px in LTR and RTL", async () => {
  const label = `primary-${"production-region-identifier".repeat(8)}`;
  for (const direction of ["ltr", "rtl"] as const) {
    const wrapper = await fixture<HTMLDivElement>(html`
      <div dir=${direction} style="inline-size: 320px; max-inline-size: 320px">
        <lr-select value="primary" label="Deployment region">
          <span slot="start" aria-hidden="true">◉</span>
          <kbd slot="end">R</kbd>
          <lr-option value="primary">${label}</lr-option>
          <lr-option value="backup">Backup</lr-option>
        </lr-select>
      </div>
    `);
    const el = wrapper.querySelector("lr-select") as LyraSelect;
    await el.updateComplete;
    const trigger =
      el.shadowRoot!.querySelector<HTMLElement>('[part="trigger"]')!;
    expect(wrapper.scrollWidth, `dir=${direction} wrapper`).to.be.at.most(
      wrapper.clientWidth
    );
    expect(
      trigger.getBoundingClientRect().width,
      `dir=${direction} trigger`
    ).to.be.at.most(wrapper.getBoundingClientRect().width);
  }
});


it("contains multiple long selected tags at 320px in LTR and RTL", async () => {
  const values = ["alpha", "beta", "gamma"];
  const labels = values.map(
    (value) => `${value}-${"generated-selection-identifier".repeat(6)}`
  );
  for (const direction of ["ltr", "rtl"] as const) {
    const wrapper = await fixture<HTMLDivElement>(html`
      <div dir=${direction} style="inline-size: 320px; max-inline-size: 320px">
        <lr-select multiple .value=${values} label="Regions">
          ${labels.map(
            (label, index) =>
              html`<lr-option value=${values[index]}>${label}</lr-option>`
          )}
        </lr-select>
      </div>
    `);
    const el = wrapper.querySelector("lr-select") as LyraSelect;
    await el.updateComplete;
    const tags = el.shadowRoot!.querySelector<HTMLElement>('[part="tags"]')!;
    expect(wrapper.scrollWidth, `dir=${direction} wrapper`).to.be.at.most(
      wrapper.clientWidth
    );
    expect(
      tags.getBoundingClientRect().width,
      `dir=${direction} tags`
    ).to.be.at.most(wrapper.getBoundingClientRect().width);
  }
});


it("gives the trigger a :hover rule alongside its :focus-visible ring", () => {
  const css = styles.cssText.replace(/"/g, "'").replace(/\s+/g, " ");
  expect(css).to.match(
    /:where\(\[part='trigger'\]\):hover:where\(:not\(:disabled\)\)\s*\{[^}]*background:\s*var\(--lr-select-trigger-hover-bg,\s*var\(--lr-color-brand-quiet\)\)/
  );
});


describe("active-option row cssprop indirection", () => {
  it("recolors the active option row from --lr-select-option-active-bg on an ancestor, not a :host-declared prop", async () => {
    const el = (await fixture(basic())) as LyraSelect;
    el.style.setProperty("--lr-select-option-active-bg", "rgb(10, 20, 30)");
    el.open = true;
    await el.updateComplete;
    trigger(el).dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "b",
        bubbles: true,
        cancelable: true,
      })
    );
    await el.updateComplete;
    const active = el.shadowRoot!.querySelector(
      '[part="option"][data-active]'
    ) as HTMLElement;
    expect(getComputedStyle(active).backgroundColor).to.equal(
      "rgb(10, 20, 30)"
    );
  });

  it("renders byte-identically to the pre-cssprop-indirection output when the prop is unset", async () => {
    const el = (await fixture(basic())) as LyraSelect;
    el.open = true;
    await el.updateComplete;
    trigger(el).dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "b",
        bubbles: true,
        cancelable: true,
      })
    );
    await el.updateComplete;
    const active = el.shadowRoot!.querySelector(
      '[part="option"][data-active]'
    ) as HTMLElement;
    // Resolve the brand-quiet token in the same shadow root for a like-for-like comparison,
    // rather than comparing a raw custom-property string against getComputedStyle's rgb(...) form.
    const probe = document.createElement("span");
    probe.setAttribute("style", "background: var(--lr-color-brand-quiet)");
    el.shadowRoot!.appendChild(probe);
    const expected = getComputedStyle(probe).backgroundColor;
    probe.remove();
    expect(getComputedStyle(active).backgroundColor).to.equal(expected);
  });
});


describe("start/end adornment slots", () => {
  const part = (el: LyraSelect, name: string) =>
    el.shadowRoot!.querySelector(`[part="${name}"]`) as HTMLElement;

  it("renders a slotted glyph inside the trigger, before the value label", async () => {
    const el = (await fixture(html`
      <lr-select>
        <svg slot="start" width="12" height="12" aria-hidden="true">
          <circle cx="6" cy="6" r="5"></circle>
        </svg>
        <lr-option value="a">Apple</lr-option>
      </lr-select>
    `)) as LyraSelect;
    await el.updateComplete;
    const start = part(el, "start");
    expect(start.hasAttribute("hidden")).to.be.false;
    const startRect = start.getBoundingClientRect();
    const triggerRect = trigger(el).getBoundingClientRect();
    expect(startRect.width).to.be.greaterThan(0);
    expect(startRect.left).to.be.at.least(triggerRect.left);
  });

  it("places the end adornment before the expand icon", async () => {
    const el = (await fixture(html`
      <lr-select>
        <kbd slot="end">K</kbd>
        <lr-option value="a">Apple</lr-option>
      </lr-select>
    `)) as LyraSelect;
    await el.updateComplete;
    const end = part(el, "end");
    expect(end.hasAttribute("hidden")).to.be.false;
    expect(
      end.compareDocumentPosition(part(el, "expand-icon")) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).to.be.greaterThan(0);
  });

  it("hides both wrappers when nothing is slotted", async () => {
    const el = (await fixture(basic())) as LyraSelect;
    await el.updateComplete;
    expect(part(el, "start").hasAttribute("hidden")).to.be.true;
    expect(part(el, "end").hasAttribute("hidden")).to.be.true;
    expect(getComputedStyle(part(el, "start")).display).to.equal("none");
    expect(getComputedStyle(part(el, "end")).display).to.equal("none");
  });

  it("reveals the wrapper when an adornment is slotted in after first render", async () => {
    const el = (await fixture(basic())) as LyraSelect;
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

  it("makes every mirrored adornment wrapper decorative and inert", async () => {
    const el = (await fixture(html`
      <lr-select aria-label="Choice">
        <button slot="start" aria-label="Icon action">i</button>
        <a slot="end" href="/details">Details</a>
        <button slot="prefix" aria-label="Prefix action">p</button>
        <a slot="suffix" href="/suffix">Suffix</a>
        <lr-option value="a">A</lr-option>
      </lr-select>
    `)) as LyraSelect;
    await el.updateComplete;
    const wrappers = [part(el, "start"), part(el, "end")];
    for (const wrapper of wrappers) {
      expect(wrapper.inert).to.be.true;
      expect(wrapper.getAttribute("aria-hidden")).to.equal("true");
      expect(getComputedStyle(wrapper).pointerEvents).to.equal("none");
    }
    for (const candidate of el.querySelectorAll<HTMLElement>("button, a")) {
      candidate.focus();
      expect(
        document.activeElement === candidate,
        `${candidate.slot} content is not a nested focus stop`
      ).to.be.false;
    }
    await expect(el).to.be.accessible();
  });
});


it('applies size="2xs" with a 20px trigger min-height', async () => {
  const el = await fixture(
    html`<lr-select size="2xs" label="Role"
      ><lr-option value="a">A</lr-option></lr-select
    >`
  );
  const trigger = el.shadowRoot!.querySelector(
    '[part="trigger"]'
  ) as HTMLElement;
  expect(getComputedStyle(trigger).minBlockSize).to.equal("20px");
});


it('reflects size="2xs" as a host attribute', async () => {
  const el = (await fixture(
    html`<lr-select size="2xs"></lr-select>`
  )) as LyraSelect;
  expect(el.size).to.equal("2xs");
  expect(el.getAttribute("size")).to.equal("2xs");
});


describe("selected-state theming tokens", () => {
  it("honours --lr-select-option-selected-color on the selected row", async () => {
    const el = (await fixture(html`
      <lr-select
        value="a"
        style="--lr-select-option-selected-color: rgb(1, 2, 3);"
      >
        <lr-option value="a">Apple</lr-option>
        <lr-option value="b">Banana</lr-option>
      </lr-select>
    `)) as LyraSelect;
    el.open = true;
    await el.updateComplete;
    const selected = el.shadowRoot!.querySelector(
      '[part="option"][aria-selected="true"]'
    ) as HTMLElement;
    expect(getComputedStyle(selected).color).to.equal("rgb(1, 2, 3)");
  });

  it("honours --lr-select-option-selected-bg on a selected row that is not the active one", async () => {
    const el = (await fixture(html`
      <lr-select
        multiple
        style="--lr-select-option-selected-bg: rgb(4, 5, 6);"
      >
        <lr-option value="a" selected>Apple</lr-option>
        <lr-option value="b" selected>Banana</lr-option>
      </lr-select>
    `)) as LyraSelect;
    el.open = true;
    await el.updateComplete;
    const selected = el.shadowRoot!.querySelector(
      '[part="option"][aria-selected="true"]:not([data-active])'
    ) as HTMLElement;
    expect(getComputedStyle(selected).backgroundColor).to.equal("rgb(4, 5, 6)");
  });

  it("leaves the selected row at the brand color when the token is unset (regression)", async () => {
    const el = (await fixture(html`
      <lr-select value="a">
        <lr-option value="a">Apple</lr-option>
      </lr-select>
    `)) as LyraSelect;
    el.open = true;
    await el.updateComplete;
    const selected = el.shadowRoot!.querySelector(
      '[part="option"][aria-selected="true"]'
    ) as HTMLElement;
    const brand = getComputedStyle(el)
      .getPropertyValue("--lr-color-brand")
      .trim();
    // Resolve the brand token through a probe element so we compare like-for-like rgb() values.
    const expected = resolvedColorIn(el.ownerDocument.body, brand);
    expect(getComputedStyle(selected).color).to.equal(expected);
  });
});


describe("row state feedback on the already-selected option", () => {
  const centerOf = (node: Element): [number, number] => {
    const rect = node.getBoundingClientRect();
    return [
      Math.round(rect.left + rect.width / 2),
      Math.round(rect.top + rect.height / 2),
    ];
  };


  const arrow = (el: LyraSelect, key: "ArrowDown" | "ArrowUp"): void => {
    trigger(el).dispatchEvent(
      new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true })
    );
  };

  const openWithSelectedMiddleRow = async (): Promise<LyraSelect> => {
    const el = (await fixture(html`
      <lr-select data-lr-theme-scope
        value="b"
        style="--lr-transition-fast: 0s; --lr-select-option-active-bg: rgb(1, 2, 3);"
      >
        <lr-option value="a">Apple</lr-option>
        <lr-option value="b">Banana</lr-option>
        <lr-option value="c">Cherry</lr-option>
      </lr-select>
    `)) as LyraSelect;
    const shown = oneEvent(el, 'lr-after-show');
    el.open = true;
    await el.updateComplete;
    // The listbox is placed by the Floating UI positioner a tick after the open render, so a
    // getBoundingClientRect() taken before that points the pointer at the pre-placement box.
    await shown;
    return el;
  };

  it("keeps the active-descendant highlight visible after arrowing onto the selected row", async () => {
    const el = await openWithSelectedMiddleRow();
    // Driven the way a keyboard user reaches it -- ArrowUp to the first row, ArrowDown back onto
    // the selected one -- rather than hand-stamping [data-active], so the assertion covers the
    // component's own rendering of the active-descendant highlight.
    arrow(el, "ArrowUp");
    await el.updateComplete;
    arrow(el, "ArrowDown");
    await el.updateComplete;
    const active = el.shadowRoot!.querySelector<HTMLElement>(
      '[part="option"][data-active]'
    )!;
    expect(
      active.getAttribute("aria-selected"),
      "the arrowed-to row is the selected one"
    ).to.equal("true");
    expect(
      getComputedStyle(active).backgroundColor,
      "aria-activedescendant highlight on the selected row"
    ).to.equal("rgb(1, 2, 3)");
  });

  const measureRow = (pick: (rows: HTMLElement[]) => HTMLElement) =>
    measureListboxRow(openWithSelectedMiddleRow, pick);

  it("hovers and presses the selected row exactly like an unselected one", async function () {
    const control = await measureRow(
      (rows) => rows.find((row) => row.getAttribute("aria-selected") !== "true")!
    );
    const selected = await measureRow(
      (rows) => rows.find((row) => row.getAttribute("aria-selected") === "true")!
    );
    if (control === null || selected === null) {
      this.skip();
    }
    expect(control.hover, "an unselected row hovers to the row tint").to.equal(
      "rgb(1, 2, 3)"
    );
    expect(selected.hover, "hovered selected row").to.equal(control.hover);
    // Compared against the unselected row rather than asserted absolutely: an option cancels its
    // own mousedown, and Firefox suppresses :active for a cancelled activation while Chromium
    // keeps it. Equality is the contract either way -- the selected row must not be the only one
    // without pressed feedback.
    expect(selected.press, "pressed selected row").to.equal(control.press);
  });

  it('does not paint hover or pressed feedback on a disabled option row', async function () {
    const el = (await fixture(html`
      <lr-select data-lr-theme-scope style="--lr-transition-fast: 0s; --lr-select-option-active-bg: rgb(1, 2, 3);">
        <lr-option value="disabled" disabled>Disabled</lr-option>
        <lr-option value="enabled">Enabled</lr-option>
      </lr-select>
    `)) as LyraSelect;
    const shown = oneEvent(el, 'lr-after-show');
    el.open = true;
    await el.updateComplete;
    await shown;
    const row = el.shadowRoot!.querySelector<HTMLElement>(
      '[part="option"][aria-disabled="true"]'
    )!;
    const resting = getComputedStyle(row).backgroundColor;

    try {
      await sendMouse({ type: 'move', position: centerOf(row) });
      if (!(await settle(() => row.matches(':hover')))) {
        this.skip();
      }
      expect(getComputedStyle(row).backgroundColor, 'disabled hover').to.equal(resting);

      await sendMouse({ type: 'down' });
      // wait-reason: a press that must change nothing has no observable to poll
      await aTimeout(20);
      // A press that must change nothing cannot be polled for; settle first so the read is real.
      await settlePointer();
      expect(getComputedStyle(row).backgroundColor, 'disabled press').to.equal(resting);
    } finally {
      await sendMouse({ type: 'up' });
      await resetMouse();
    }
  });
});


describe("lr-select filled (Shoelace compatibility alias)", () => {
  const centerOf = (node: Element): [number, number] => {
    const rect = node.getBoundingClientRect();
    return [
      Math.round(rect.left + rect.width / 2),
      Math.round(rect.top + rect.height / 2),
    ];
  };

  const settle = async (holds: () => boolean): Promise<boolean> => {
    for (let attempt = 0; attempt < 25; attempt++) {
      if (holds()) return true;
      // wait-reason: poll interval of the settle() retry loop
      await aTimeout(20);
    }
    return holds();
  };

  it("keeps the trigger's hover and press feedback", async function () {
    const el = (await fixture(html`
      <lr-select data-lr-theme-scope filled style="--lr-transition-fast: 0s">
        <lr-option value="a">Apple</lr-option>
      </lr-select>
    `)) as LyraSelect;
    await el.updateComplete;
    const button = trigger(el);
    const resting = getComputedStyle(button).backgroundColor;
    try {
      await sendMouse({ type: "move", position: centerOf(button) });
      // Prove the pointer actually reached the trigger before reading a background: an engine that
      // silently dropped the move would otherwise report this cascade fix as broken.
      if (!(await settle(() => button.matches(":hover")))) {
        this.skip();
      }
      await settle(
        () => getComputedStyle(button).backgroundColor !== resting
      );
      const hovered = getComputedStyle(button).backgroundColor;
      expect(hovered, "filled trigger hover vs resting").to.not.equal(resting);
      await sendMouse({ type: "down" });
      await settle(
        () => getComputedStyle(button).backgroundColor !== hovered
      );
      expect(
        getComputedStyle(button).backgroundColor,
        "filled trigger press vs hover"
      ).to.not.equal(hovered);
    } finally {
      await sendMouse({ type: "up" });
      await resetMouse();
    }
  });
});

// -- Slotted supporting text and listbox pointer handling -------------------


it("preserves rendered error behavior while shared slot presence changes", async () => {
  const el = (await fixture(html`
    <lr-select label="Meter">
      <span slot="error">Pick one</span>
      <lr-option value="a">A</lr-option>
    </lr-select>
  `)) as LyraSelect;
  await el.updateComplete;
  const error = el.shadowRoot!.querySelector('[part="error"]') as HTMLElement;
  expect(error.hidden).to.be.false;
  el.querySelector('[slot="error"]')!.remove();
  await new Promise((r) => requestAnimationFrame(() => r(null)));
  await el.updateComplete;
  expect(error.hidden).to.be.true;
});


it("prevents mousedown across the whole listbox so headings/chrome cannot steal trigger focus", async () => {
  const el = (await fixture(html`
    <lr-select label="Meter"><lr-option value="a">A</lr-option></lr-select>
  `)) as LyraSelect;
  el.open = true;
  await el.updateComplete;
  const onOption = new MouseEvent("mousedown", {
    bubbles: true,
    cancelable: true,
  });
  el.shadowRoot!.querySelector('[part="option"]')!.dispatchEvent(onOption);
  expect(onOption.defaultPrevented).to.be.true;

  const onChrome = new MouseEvent("mousedown", {
    bubbles: true,
    cancelable: true,
  });
  el.shadowRoot!.querySelector('[part="listbox"]')!.dispatchEvent(onChrome);
  expect(onChrome.defaultPrevented).to.be.true;
});

// -- Degraded-DOM form-association fallback ---------------------------------


describe("appearance and pill", () => {
  it("defaults to outlined and reflects the attribute", async () => {
    const el = (await fixture(basic())) as LyraSelect;
    expect(el.appearance).to.equal("outlined");
    await el.updateComplete;
    expect(el.getAttribute("appearance")).to.equal("outlined");
  });

  it("fills the trigger for filled and filled-outlined, keeping the border only for the latter", async () => {
    const el = (await fixture(basic())) as LyraSelect;
    const raised = resolved(
      el,
      "background-color",
      "var(--lr-color-surface-raised)"
    );
    const border = resolved(el, "color", "var(--lr-color-border)");

    el.appearance = "filled";
    await el.updateComplete;
    expect(getComputedStyle(trigger(el)).backgroundColor).to.equal(raised);
    expect(getComputedStyle(trigger(el)).borderTopColor).to.equal(
      "rgba(0, 0, 0, 0)"
    );

    el.appearance = "filled-outlined";
    await el.updateComplete;
    expect(getComputedStyle(trigger(el)).backgroundColor).to.equal(raised);
    expect(getComputedStyle(trigger(el)).borderTopColor).to.equal(border);
  });

  it("drops both the fill and the border for plain", async () => {
    const el = (await fixture(basic())) as LyraSelect;
    el.appearance = "plain";
    await el.updateComplete;
    const cs = getComputedStyle(trigger(el));
    expect(cs.backgroundColor).to.equal("rgba(0, 0, 0, 0)");
    expect(cs.borderTopColor).to.equal("rgba(0, 0, 0, 0)");
  });

  it("paints accent with the loud brand fill and its on-brand text color", async () => {
    const el = (await fixture(basic())) as LyraSelect;
    const brand = resolved(el, "background-color", "var(--lr-color-brand)");
    const onBrand = resolved(el, "color", "var(--lr-color-on-brand)");
    el.appearance = "accent";
    await el.updateComplete;
    const cs = getComputedStyle(trigger(el));
    expect(cs.backgroundColor).to.equal(brand);
    expect(cs.color).to.equal(onBrand);
  });

  it("rounds the trigger fully with pill, through the same radius property", async () => {
    const el = (await fixture(basic())) as LyraSelect;
    el.pill = true;
    await el.updateComplete;
    expect(getComputedStyle(trigger(el)).borderRadius).to.equal("999px");
    expect(el.getAttribute("pill")).to.equal("");
  });

  it("is accessible in every appearance", async () => {
    for (const appearance of [
      "accent",
      "filled",
      "outlined",
      "filled-outlined",
      "plain",
    ] as const) {
      const el = (await fixture(basic())) as LyraSelect;
      el.label = "Fruit";
      el.appearance = appearance;
      await el.updateComplete;
      await expect(el).to.be.accessible();
    }
  });
});


describe("lr-select clear-button spelling parity", () => {
  // Mirror of the lr-input parity test: `with-clear` is Web Awesome's spelling and `clearable`
  // Shoelace's, so a select that honours only one silently loses the control for half the
  // migrations the README promises are mechanical.
  it("renders the clear button for either upstream spelling", async () => {
    for (const attribute of ["with-clear", "clearable"]) {
      const el = (await fixture(basic())) as LyraSelect;
      el.setAttribute(attribute, "");
      el.value = "b";
      await el.updateComplete;
      expect(clearButton(el) !== null, attribute).to.equal(true);
    }
  });

  it("leaves the clear button absent when neither spelling is set", async () => {
    const el = (await fixture(basic())) as LyraSelect;
    el.value = "b";
    await el.updateComplete;
    expect(clearButton(el) === null).to.equal(true);
  });
});


describe("lr-select — the shared size ladder", () => {
  const trigger = (el: LyraSelect) =>
    el.shadowRoot!.querySelector('[part="trigger"]') as HTMLElement;
  const height = (el: LyraSelect) => trigger(el).getBoundingClientRect().height;

  it("renders the Web Awesome size spellings at the same geometry as the canonical steps", async () => {
    for (const [alias, step] of [
      ["small", "s"],
      ["medium", "m"],
      ["large", "l"],
    ] as const) {
      const aliasEl = (await fixture(
        html`<lr-select size=${alias}></lr-select>`
      )) as LyraSelect;
      const stepEl = (await fixture(
        html`<lr-select size=${step}></lr-select>`
      )) as LyraSelect;
      expect(height(aliasEl), `size=${alias} height`).to.equal(height(stepEl));
      expect(
        getComputedStyle(trigger(aliasEl)).fontSize,
        `size=${alias} font-size`
      ).to.equal(getComputedStyle(trigger(stepEl)).fontSize);
      expect(
        getComputedStyle(trigger(aliasEl)).paddingTop,
        `size=${alias} padding-block`
      ).to.equal(getComputedStyle(trigger(stepEl)).paddingTop);
    }
  });

  it("sits at the shared form-control height at every tier", async () => {
    const expected: Record<string, number> = {
      "2xs": 20,
      xs: 24,
      s: 32,
      m: 36,
      l: 40,
      xl: 56,
    };
    for (const [size, px] of Object.entries(expected)) {
      const el = (await fixture(
        html`<lr-select size=${size}></lr-select>`
      )) as LyraSelect;
      expect(height(el), `size=${size}`).to.equal(px);
    }
  });
});

describe("lr-select hover and press feedback", () => {
  const centerOf = (node: Element): [number, number] => {
    const rect = node.getBoundingClientRect();
    return [
      Math.round(rect.left + rect.width / 2),
      Math.round(rect.top + rect.height / 2),
    ];
  };

  // --lr-transition-fast is zeroed on each fixture: the trigger transitions its background, so
  // reading getComputedStyle one frame after the pointer arrives would otherwise catch the
  // INTERPOLATED colour -- still the resting one at t=0 -- and report a working hover as broken.
  for (const appearance of ["outlined", "filled", "accent"] as const) {
    it(`presses an appearance="${appearance}" trigger deeper than it hovers it`, async () => {
      const el = (await fixture(html`
        <lr-select data-lr-theme-scope appearance=${appearance} style="--lr-transition-fast: 0s">
          <lr-option value="a">Apple</lr-option>
        </lr-select>
      `)) as LyraSelect;
      await el.updateComplete;
      const trigger = el.shadowRoot!.querySelector(
        '[part="trigger"]'
      ) as HTMLElement;
      const resting = getComputedStyle(trigger).backgroundColor;
      try {
        await sendMouse({ type: "move", position: centerOf(trigger) });
        await waitUntil(
          () =>
            trigger.matches(":hover") &&
            getComputedStyle(trigger).backgroundColor !== resting,
          `${appearance} trigger never painted its hovered background`
        );
        const hovered = getComputedStyle(trigger).backgroundColor;
        expect(hovered, `${appearance} hover vs resting`).to.not.equal(resting);
        await sendMouse({ type: "down" });
        await waitUntil(
          () =>
            trigger.matches(":active") &&
            getComputedStyle(trigger).backgroundColor !== hovered,
          `${appearance} trigger never painted its pressed background`
        );
        expect(
          getComputedStyle(trigger).backgroundColor,
          `${appearance} pressed vs hovered`
        ).to.not.equal(hovered);
      } finally {
        await sendMouse({ type: "up" });
        await resetMouse();
      }
    });
  }

  it("themes trigger hover, pressed, and open border paint through component hooks", async () => {
    const el = (await fixture(html`
      <lr-select data-lr-theme-scope
        open
        style="
          --lr-transition-fast: 0s;
          --lr-select-trigger-hover-bg: rgb(1, 2, 3);
          --lr-select-trigger-active-bg: rgb(4, 5, 6);
          --lr-select-open-border-color: rgb(7, 8, 9);
        "
      >
        <lr-option value="a">Apple</lr-option>
        <lr-option value="b">Banana</lr-option>
      </lr-select>
    `)) as LyraSelect;
    await el.updateComplete;
    const trigger =
      el.shadowRoot!.querySelector<HTMLElement>('[part="trigger"]')!;
    expect(getComputedStyle(trigger).borderTopColor).to.equal("rgb(7, 8, 9)");
    try {
      await sendMouse({ type: "move", position: centerOf(trigger) });
      await waitUntil(
        () =>
          trigger.matches(":hover") &&
          getComputedStyle(trigger).backgroundColor === "rgb(1, 2, 3)",
        "the select trigger never painted its themed hover background"
      );
      expect(getComputedStyle(trigger).backgroundColor).to.equal(
        "rgb(1, 2, 3)"
      );
      await sendMouse({ type: "down" });
      await waitUntil(
        () =>
          trigger.matches(":active") &&
          getComputedStyle(trigger).backgroundColor === "rgb(4, 5, 6)",
        "the select trigger never painted its themed pressed background"
      );
      expect(getComputedStyle(trigger).backgroundColor).to.equal(
        "rgb(4, 5, 6)"
      );
    } finally {
      await sendMouse({ type: "up" });
      await resetMouse();
    }
  });

  it("lets a consumer retint the tag remove-button hover/pressed background through --lr-select-tag-remove-hover-bg with no ::part(tag__remove-button) rule", async () => {
    const el = (await fixture(html`
      <lr-select data-lr-theme-scope
        multiple
        style="--lr-transition-fast: 0s; --lr-select-tag-remove-hover-bg: rgb(1, 2, 3);"
      >
        <lr-option value="a">Apple</lr-option>
        <lr-option value="b">Banana</lr-option>
      </lr-select>
    `)) as LyraSelect;
    el.value = ["a"];
    await el.updateComplete;
    const removeButton = el.shadowRoot!.querySelector(
      '[part~="tag__remove-button"]'
    ) as HTMLElement;
    try {
      await sendMouse({ type: "move", position: centerOf(removeButton) });
      await waitUntil(
        () =>
          removeButton.matches(":hover") &&
          getComputedStyle(removeButton).backgroundColor === "rgb(1, 2, 3)",
        "the tag remove-button never painted its themed hover background"
      );
      expect(getComputedStyle(removeButton).backgroundColor).to.equal(
        "rgb(1, 2, 3)"
      );
      await sendMouse({ type: "down" });
      await waitUntil(
        () =>
          removeButton.matches(":active") &&
          getComputedStyle(removeButton).backgroundColor !== "rgb(1, 2, 3)",
        "the tag remove-button pressed background never mixed away from the flat hover cssprop"
      );
    } finally {
      await sendMouse({ type: "up" });
      await resetMouse();
    }
  });
});


describe('lr-option start/end adornments in the select listbox', () => {
  async function openWith(markup: unknown): Promise<LyraSelect> {
    const el = (await fixture(markup as never)) as LyraSelect;
    el.open = true;
    await el.updateComplete;
    await aTimeout(0);
    return el;
  }

  const rowFor = (el: LyraSelect, value: string): HTMLElement =>
    el.shadowRoot!.querySelector<HTMLElement>(`[part="option"][data-value="${value}"]`)!;

  it('renders a start adornment inside the popup row', async () => {
    const el = await openWith(html`
      <lr-select>
        <lr-option value="fr"><span slot="start" id="fr-mark">FR</span>France</lr-option>
      </lr-select>
    `);
    const adornment = rowFor(el, 'fr').querySelector('[part~="option-start"]');

    expect(adornment, 'the documented start slot now renders').to.exist;
    expect(adornment!.textContent).to.contain('FR');
    expect(adornment!.getAttribute('aria-hidden'), 'decorative').to.equal('true');
    expect((adornment as HTMLElement).inert, 'not reachable').to.be.true;
  });

  it('renders an end adornment inside the popup row', async () => {
    const el = await openWith(html`
      <lr-select>
        <lr-option value="fr">France<span slot="end">€</span></lr-option>
      </lr-select>
    `);
    const adornment = rowFor(el, 'fr').querySelector('[part~="option-end"]');

    expect(adornment, 'the documented end slot now renders').to.exist;
    expect(adornment!.textContent).to.contain('€');
  });

  it('treats the Shoelace prefix/suffix aliases identically', async () => {
    const el = await openWith(html`
      <lr-select>
        <lr-option value="fr"><span slot="prefix">P</span>France<span slot="suffix">S</span></lr-option>
      </lr-select>
    `);
    const row = rowFor(el, 'fr');

    expect(row.querySelector('[part~="option-start"]')!.textContent).to.contain('P');
    expect(row.querySelector('[part~="option-end"]')!.textContent).to.contain('S');
  });

  it('emits no adornment wrapper for a plain option', async () => {
    const el = await openWith(html`
      <lr-select><lr-option value="fr">France</lr-option></lr-select>
    `);
    const row = rowFor(el, 'fr');

    expect(row.querySelector('[part~="option-start"]') === null, 'no empty start wrapper').to.be
      .true;
    expect(row.querySelector('[part~="option-end"]') === null, 'no empty end wrapper').to.be.true;
  });

  it('leaves the author light-DOM option subtree untouched', async () => {
    const el = await openWith(html`
      <lr-select>
        <lr-option value="fr"><span slot="start" id="original">FR</span>France</lr-option>
      </lr-select>
    `);
    const original = el.querySelector('#original');

    expect(original, 'the author node is still where they put it').to.exist;
    expect(original!.parentElement!.tagName.toLowerCase()).to.equal('lr-option');
    expect(
      rowFor(el, 'fr').querySelector('[part~="option-start"]')!.contains(original!),
      'the popup renders a clone, not the original node'
    ).to.be.false;
  });

  it('upgrades a custom element used as an adornment in the clone', async () => {
    // Lit forbids a binding in a tag name, so the tag is written literally below and only the
    // definition is guarded.
    if (!customElements.get('test-select-adornment')) {
      customElements.define(
        'test-select-adornment',
        class extends HTMLElement {
          connectedCallback(): void {
            this.setAttribute('data-upgraded', 'yes');
          }
        }
      );
    }
    const el = await openWith(html`
      <lr-select>
        <lr-option value="fr"
          ><test-select-adornment slot="start"></test-select-adornment>France</lr-option
        >
      </lr-select>
    `);
    const clone = rowFor(el, 'fr').querySelector('test-select-adornment')!;

    expect(clone, 'the custom element reached the row').to.exist;
    expect(
      clone.getAttribute('data-upgraded'),
      'cloneNode keeps it upgradeable, unlike createElementNS'
    ).to.equal('yes');
  });

  it('places the start adornment before the end adornment under dir="rtl"', async () => {
    const root = await fixture(html`
      <div dir="rtl">
        <lr-select open>
          <lr-option value="fr"><span slot="start">FR</span>France<span slot="end">€</span></lr-option>
        </lr-select>
      </div>
    `);
    const el = root.querySelector('lr-select') as LyraSelect;
    await el.updateComplete;
    await aTimeout(0);
    const row = rowFor(el, 'fr');
    const start = row.querySelector('[part~="option-start"]')!.getBoundingClientRect();
    const end = row.querySelector('[part~="option-end"]')!.getBoundingClientRect();
    expect(
      start.left,
      'DOM-first "start" renders on the visual right under RTL, matching a plain flex row'
    ).to.be.greaterThan(end.left);
  });
});


describe("lr-select popup adornment truncation", () => {
  const LONG = "Adornment text that is far too long.";

  for (const slot of ["start", "end"] as const) {
    it(`truncates a long cloned ${slot} text adornment with an ellipsis`, async () => {
      const el = (await fixture(html`
        <lr-select style="inline-size: 240px">
          <lr-option value="fr">France<span slot=${slot}>${LONG}</span></lr-option>
        </lr-select>
      `)) as LyraSelect;
      el.open = true;
      await el.updateComplete;
      await aTimeout(0);
      const row = el.shadowRoot!.querySelector<HTMLElement>('[part="option"][data-value="fr"]')!;
      const part = row.querySelector<HTMLElement>(`[part~="option-${slot}"]`)!;
      const adornment = part.firstElementChild as HTMLElement;
      const box = adornment.getBoundingClientRect();
      const partBox = part.getBoundingClientRect();
      expect(box.left, "start edge stays inside the part").to.be.at.least(partBox.left - 0.5);
      expect(box.right, "end edge stays inside the part").to.be.at.most(partBox.right + 0.5);
      expect(getComputedStyle(adornment).textOverflow).to.equal("ellipsis");
      expect(adornment.scrollWidth > adornment.clientWidth, "text overflows its box").to.equal(true);
    });
  }
});


it("names a chip, the trigger and the listbox row by the raw value when the option's label is blank", async () => {
  const multi = (await fixture(html`
    <lr-select multiple>
      <lr-option value="a">Apple</lr-option>
      <lr-option value="x"></lr-option>
    </lr-select>
  `)) as LyraSelect;
  multi.value = ["a", "x"];
  await multi.updateComplete;
  const remove = [...multi.shadowRoot!.querySelectorAll<HTMLButtonElement>('[part~="tag__remove-button"]')];
  expect(remove[1]!.getAttribute("aria-label")).to.equal("Remove x");
  multi.open = true;
  await multi.updateComplete;
  expect(rows(multi)[1]!.textContent!.trim()).to.equal("x");

  const single = (await fixture(html`<lr-select value="x"><lr-option value="x"></lr-option></lr-select>`)) as LyraSelect;
  await single.updateComplete;
  expect(trigger(single).textContent).to.contain("x");
});
