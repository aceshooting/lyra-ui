import { fixture, expect, oneEvent, html, waitUntil } from "@open-wc/testing";
import { resetMouse, sendMouse } from "@web/test-runner-commands";
import "./model-select.js";
import type { LyraModelSelect } from "./model-select.js";

const CATALOG = ["llama3.1", "mistral", "qwen2.5-coder"];
const OBJECT_CATALOG = [
  { id: "gpt-4.1", label: "GPT-4.1" },
  { id: "gpt-4.1-mini", label: "GPT-4.1 mini" },
];
const LONG_PROVIDER = `provider-${"unbroken-model-provider-name-".repeat(12)}`;

let originalWarn: typeof console.warn;
let scheduledUpdateWarnings: unknown[][];

beforeEach(() => {
  const globalWarnings = (globalThis as { litIssuedWarnings?: Set<string> })
    .litIssuedWarnings;
  if (globalWarnings) {
    [...globalWarnings]
      .filter((warning) => warning.includes("scheduled an update"))
      .forEach((warning) => globalWarnings.delete(warning));
  }
  originalWarn = console.warn;
  scheduledUpdateWarnings = [];
  console.warn = (...args: unknown[]) => {
    if (
      args
        .map(String)
        .some((message) => message.includes("scheduled an update"))
    ) {
      scheduledUpdateWarnings.push(args);
      return;
    }
    originalWarn(...args);
  };
});

afterEach(function () {
  console.warn = originalWarn;
  expect(
    scheduledUpdateWarnings,
    `${
      this.currentTest?.title ?? "model-select"
    } should not schedule a redundant update`
  ).to.be.empty;
});

function trigger(el: LyraModelSelect): HTMLButtonElement {
  return el.shadowRoot!.querySelector('[part="trigger"]') as HTMLButtonElement;
}
function input(el: LyraModelSelect): HTMLInputElement {
  return el.shadowRoot!.querySelector(
    '[part="combobox-input"]'
  ) as HTMLInputElement;
}
interface ModelSelectEditingFacade {
  readonly input: HTMLInputElement | null;
  selectionStart: number | null;
  selectionEnd: number | null;
  selectionDirection: "forward" | "backward" | "none" | null;
  select(): void;
  setSelectionRange(
    start: number | null,
    end: number | null,
    direction?: "forward" | "backward" | "none"
  ): void;
  setRangeText(replacement: string): void;
  setRangeText(
    replacement: string,
    start: number,
    end: number,
    selectMode?: SelectionMode
  ): void;
}
function rows(el: LyraModelSelect): NodeListOf<HTMLElement> {
  return el.shadowRoot!.querySelectorAll('[part="option"]');
}

// -- Mode selection ---------------------------------------------------------

it("renders a closed dropdown (trigger button) when catalog is non-empty and allow-custom is unset", async () => {
  const el = (await fixture(
    html`<lr-model-select .catalog=${CATALOG}></lr-model-select>`
  )) as LyraModelSelect;
  expect(trigger(el) != null).to.equal(true);
  expect(el.shadowRoot!.querySelector('[part="combobox-input"]') === null).to.be
    .true;
});

it("renders a free-text input when catalog is empty/undefined", async () => {
  const el = (await fixture(
    html`<lr-model-select></lr-model-select>`
  )) as LyraModelSelect;
  expect(input(el) != null).to.equal(true);
  expect(el.shadowRoot!.querySelector('[part="trigger"]') === null).to.be.true;
});

it("renders a free-text input when allow-custom is set, even with a non-empty catalog", async () => {
  const el = (await fixture(
    html`<lr-model-select allow-custom .catalog=${CATALOG}></lr-model-select>`
  )) as LyraModelSelect;
  expect(input(el) != null).to.equal(true);
  expect(el.shadowRoot!.querySelector('[part="trigger"]') === null).to.be.true;
});

it("preserves owned focus when a catalog change replaces the closed trigger with free text", async () => {
  const el = (await fixture(
    html`<lr-model-select .catalog=${CATALOG}></lr-model-select>`
  )) as LyraModelSelect;
  trigger(el).focus();

  el.catalog = [];
  await el.updateComplete;

  expect(el.shadowRoot!.activeElement === input(el)).to.equal(true);
});

it("preserves owned focus when allow-custom replaces free text with the closed trigger", async () => {
  const el = (await fixture(
    html`<lr-model-select allow-custom .catalog=${CATALOG}></lr-model-select>`
  )) as LyraModelSelect;
  input(el).focus();

  el.allowCustom = false;
  await el.updateComplete;

  expect(el.shadowRoot!.activeElement === trigger(el)).to.equal(true);
});

it("does not move external focus when its semantic control mode changes", async () => {
  const wrapper = await fixture(html`
    <div>
      <button id="outside">Outside</button>
      <lr-model-select .catalog=${CATALOG}></lr-model-select>
    </div>
  `);
  const el = wrapper.querySelector("lr-model-select") as LyraModelSelect;
  wrapper.querySelector<HTMLElement>("#outside")!.focus();

  el.catalog = [];
  await el.updateComplete;

  expect(el.ownerDocument.activeElement?.id).to.equal("outside");
});

it("forwards selection and range editing in free-text mode while synchronizing form state", async () => {
  const form = (await fixture(html`
    <form>
      <lr-model-select name="model" required value="mistral"></lr-model-select>
    </form>
  `)) as HTMLFormElement;
  const el = form.querySelector("lr-model-select") as LyraModelSelect;
  const facade = el as unknown as LyraModelSelect & ModelSelectEditingFacade;
  const native = input(el);
  const valueEvents: string[] = [];
  el.addEventListener("input", (event) => valueEvents.push(event.type));
  el.addEventListener("change", (event) => valueEvents.push(event.type));

  expect(facade.input === native).to.be.true;
  facade.select();
  expect(facade.selectionStart).to.equal(0);
  expect(facade.selectionEnd).to.equal("mistral".length);

  facade.setSelectionRange(1, 4, "forward");
  expect(facade.selectionStart).to.equal(1);
  expect(facade.selectionEnd).to.equal(4);
  expect(facade.selectionDirection).to.equal("forward");

  facade.selectionStart = 0;
  facade.selectionEnd = native.value.length;
  facade.selectionDirection = "backward";
  expect(native.selectionStart).to.equal(0);
  expect(native.selectionEnd).to.equal("mistral".length);
  expect(native.selectionDirection).to.equal("backward");

  facade.setRangeText("", 0, native.value.length, "end");
  expect(el.value).to.equal("");
  expect(el.validity.valueMissing).to.be.true;
  expect(new FormData(form).get("model")).to.equal("");

  facade.setRangeText("custom-model");
  expect(el.value).to.equal("custom-model");
  expect(el.validity.valid).to.be.true;
  expect(new FormData(form).get("model")).to.equal("custom-model");
  expect(valueEvents).to.deep.equal([]);
});

it("keeps the free-text editing facade inert outside free-text mode and before render", async () => {
  const closed = (await fixture(html`
    <lr-model-select value="mistral" .catalog=${CATALOG}></lr-model-select>
  `)) as LyraModelSelect;
  const closedFacade = closed as unknown as LyraModelSelect &
    ModelSelectEditingFacade;
  const detached = document.createElement(
    "lr-model-select"
  ) as LyraModelSelect & ModelSelectEditingFacade;

  for (const facade of [closedFacade, detached]) {
    expect(facade.input === null).to.be.true;
    expect(facade.selectionStart).to.equal(null);
    expect(facade.selectionEnd).to.equal(null);
    expect(facade.selectionDirection).to.equal(null);
    expect(() => {
      facade.selectionStart = 0;
      facade.selectionEnd = 0;
      facade.selectionDirection = "forward";
      facade.select();
      facade.setSelectionRange(0, 0);
      facade.setRangeText("ignored");
    }).to.not.throw();
  }
  expect(closed.value).to.equal("mistral");
});

it("treats each string in a plain string[] catalog as both id and label", async () => {
  const el = (await fixture(
    html`<lr-model-select .catalog=${CATALOG}></lr-model-select>`
  )) as LyraModelSelect;
  el.open = true;
  await el.updateComplete;
    expect(rows(el)[0]!.textContent).to.contain("llama3.1");
});

it("renders id/label object catalog rows by their label", async () => {
  const el = (await fixture(
    html`<lr-model-select .catalog=${OBJECT_CATALOG}></lr-model-select>`
  )) as LyraModelSelect;
  el.open = true;
  await el.updateComplete;
    expect(rows(el)[0]!.textContent).to.contain("GPT-4.1");
    expect(rows(el)[0]!.dataset["value"]).to.equal("gpt-4.1");
});

it("drops catalog records whose required label is missing, null, empty, or blank", async () => {
  const el = (await fixture(html`
    <lr-model-select
      .catalog=${[
        { id: "missing" },
        { id: "null", label: null },
        { id: "empty", label: "" },
        { id: "blank", label: "   " },
        { id: "valid", label: "Valid model" },
      ] as unknown as Array<{ id: string; label: string }>}
    ></lr-model-select>
  `)) as LyraModelSelect;
  el.open = true;
  await el.updateComplete;

    expect([...rows(el)].map((row) => row.dataset["value"])).to.deep.equal([
    "valid",
  ]);
  await expect(el).to.be.accessible();
});

it("renders optional catalog icons decoratively in both listbox modes", async () => {
  const catalog = [
    { id: "gpt-4.1", label: "GPT-4.1", icon: "✦" },
    { id: "gpt-4.1-mini", label: "GPT-4.1 mini" },
  ];

  for (const allowCustom of [false, true]) {
    const el = (await fixture(html`
      <lr-model-select
        ?allow-custom=${allowCustom}
        .catalog=${catalog}
      ></lr-model-select>
    `)) as LyraModelSelect;
    el.open = true;
    await el.updateComplete;

    const optionRows = rows(el);
    const icon = optionRows[0]!.querySelector<HTMLElement>(
      '[part="option-icon"]'
    );
    expect(icon?.textContent).to.equal("✦");
    expect(icon?.getAttribute("aria-hidden")).to.equal("true");
    expect(
      optionRows[1]!.querySelectorAll('[part="option-icon"]').length
    ).to.equal(0);
    el.shadowRoot!.querySelector('[part="listbox"]')
      ?.getAnimations()
      .forEach((animation) => animation.finish());
    await expect(el).to.be.accessible();
  }
});

// -- Closed-dropdown mode -----------------------------------------------

it("opens the closed dropdown by clicking the trigger and selects an option, emitting lr-change", async () => {
  const el = (await fixture(
    html`<lr-model-select .catalog=${CATALOG}></lr-model-select>`
  )) as LyraModelSelect;
  trigger(el).click();
  await el.updateComplete;
  expect(el.open).to.be.true;

  let detail: { value: string; inCatalog: boolean } | undefined;
  el.addEventListener("lr-change", (e) => (detail = (e as CustomEvent).detail));
    setTimeout(() => rows(el)[1]!.click());
  await oneEvent(el, "lr-change");
  expect(el.value).to.equal("mistral");
  expect(el.open).to.be.false;
  expect(detail).to.deep.equal({ value: "mistral", inCatalog: true });
});

it("navigates the closed dropdown with ArrowDown and commits with Enter", async () => {
  const el = (await fixture(
    html`<lr-model-select .catalog=${CATALOG}></lr-model-select>`
  )) as LyraModelSelect;
  const btn = trigger(el);
  btn.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "ArrowDown",
      bubbles: true,
      cancelable: true,
    })
  );
  await el.updateComplete;
  expect(el.open).to.be.true;

  btn.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "ArrowDown",
      bubbles: true,
      cancelable: true,
    })
  );
  await el.updateComplete;
  setTimeout(() =>
    btn.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Enter",
        bubbles: true,
        cancelable: true,
      })
    )
  );
  await oneEvent(el, "lr-change");
  expect(el.value).to.equal("llama3.1");
});

it("jumps to the last row with End and commits it", async () => {
  const el = (await fixture(
    html`<lr-model-select .catalog=${CATALOG}></lr-model-select>`
  )) as LyraModelSelect;
  const btn = trigger(el);
  el.open = true;
  await el.updateComplete;

  btn.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "End",
      bubbles: true,
      cancelable: true,
    })
  );
  await el.updateComplete;
  setTimeout(() =>
    btn.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Enter",
        bubbles: true,
        cancelable: true,
      })
    )
  );
  await oneEvent(el, "lr-change");
  expect(el.value).to.equal("qwen2.5-coder");
});

it("closes the closed dropdown on Escape without changing the value", async () => {
  const el = (await fixture(
    html`<lr-model-select .catalog=${CATALOG}></lr-model-select>`
  )) as LyraModelSelect;
  const btn = trigger(el);
  el.value = "mistral";
  el.open = true;
  await el.updateComplete;

  btn.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "ArrowDown",
      bubbles: true,
      cancelable: true,
    })
  );
  await el.updateComplete;
  btn.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "Escape",
      bubbles: true,
      cancelable: true,
    })
  );
  await el.updateComplete;
  expect(el.open).to.be.false;
  expect(el.value).to.equal("mistral");
});

it("navigates the closed dropdown with ArrowUp (opens when closed, moves the active index up while open, floored at 0)", async () => {
  const el = (await fixture(
    html`<lr-model-select .catalog=${CATALOG}></lr-model-select>`
  )) as LyraModelSelect;
  const btn = trigger(el);
  btn.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "ArrowUp",
      bubbles: true,
      cancelable: true,
    })
  );
  await el.updateComplete;
  expect(el.open, "ArrowUp must open the dropdown when it starts closed").to.be
    .true;

  btn.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "ArrowUp",
      bubbles: true,
      cancelable: true,
    })
  );
  await el.updateComplete;
  expect(
    (el as unknown as { activeIndex: number }).activeIndex,
    "floored at 0, not negative"
  ).to.equal(0);
});

it("jumps to the first row with Home in the closed dropdown", async () => {
  const el = (await fixture(
    html`<lr-model-select .catalog=${CATALOG}></lr-model-select>`
  )) as LyraModelSelect;
  const btn = trigger(el);
  el.open = true;
  await el.updateComplete;

  btn.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "End",
      bubbles: true,
      cancelable: true,
    })
  );
  await el.updateComplete;
  expect((el as unknown as { activeIndex: number }).activeIndex).to.equal(
    CATALOG.length - 1
  );

  btn.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "Home",
      bubbles: true,
      cancelable: true,
    })
  );
  await el.updateComplete;
  expect((el as unknown as { activeIndex: number }).activeIndex).to.equal(0);
});

it("Enter with no active row simply closes the closed dropdown without selecting anything", async () => {
  const el = (await fixture(
    html`<lr-model-select .catalog=${CATALOG}></lr-model-select>`
  )) as LyraModelSelect;
  const btn = trigger(el);
  btn.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "ArrowDown",
      bubbles: true,
      cancelable: true,
    })
  );
  await el.updateComplete;
  expect(el.open).to.be.true;
  expect(
    (el as unknown as { activeIndex: number }).activeIndex,
    "opening via ArrowDown leaves no row active"
  ).to.equal(-1);

  let changeFired = false;
  el.addEventListener("lr-change", () => (changeFired = true));
  btn.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "Enter",
      bubbles: true,
      cancelable: true,
    })
  );
  await el.updateComplete;
  expect(el.open).to.be.false;
  expect(changeFired, "no row was active, so Enter must not commit a value").to
    .be.false;
});

it("closes the closed dropdown by clicking the trigger a second time while it is open", async () => {
  const el = (await fixture(
    html`<lr-model-select .catalog=${CATALOG}></lr-model-select>`
  )) as LyraModelSelect;
  const btn = trigger(el);
  btn.click();
  await el.updateComplete;
  expect(el.open).to.be.true;

  btn.click();
  await el.updateComplete;
  expect(el.open).to.be.false;
});

it("onTriggerClick guards against a stale effectiveDisabled state (defensive branch, unreachable via a real disabled-button click)", async () => {
  const el = (await fixture(
    html`<lr-model-select .catalog=${CATALOG}></lr-model-select>`
  )) as LyraModelSelect;
  el.disabled = true;
  (el as unknown as { onTriggerClick(): void }).onTriggerClick();
  expect(el.open).to.be.false;
});

it("shows a synthetic, distinctly-marked row for a stale value not present in the catalog", async () => {
  const el = (await fixture(
    html`<lr-model-select
      value="ancient-model"
      .catalog=${CATALOG}
    ></lr-model-select>`
  )) as LyraModelSelect;
  el.open = true;
  await el.updateComplete;

  const all = rows(el);
  expect(all.length).to.equal(4);
    const synthetic = all[all.length - 1]!;
    expect(synthetic.dataset["value"]).to.equal("ancient-model");
  expect(synthetic.hasAttribute("data-synthetic")).to.be.true;
  expect(synthetic.querySelector('[part="option-badge"]')).to.exist;
  // The trigger label still shows the stale value's text, unmarked.
  expect(trigger(el).textContent).to.contain("ancient-model");
});

it("keeps a long provider badge inside a 320px allocation in both modes and text directions", async () => {
  for (const direction of ["ltr", "rtl"] as const) {
    for (const allowCustom of [false, true]) {
      const allocation = (await fixture(html`
        <div
          dir=${direction}
          style="display: grid; inline-size: 320px; max-inline-size: 100%"
        >
          <lr-model-select
            provider=${LONG_PROVIDER}
            ?allow-custom=${allowCustom}
            .catalog=${CATALOG}
          ></lr-model-select>
        </div>
      `)) as HTMLDivElement;
      const el = allocation.querySelector("lr-model-select") as LyraModelSelect;
      const control = allowCustom
        ? (el.shadowRoot!.querySelector('[part="combobox"]') as HTMLElement)
        : trigger(el);
      const badge = el.shadowRoot!.querySelector(
        '[part="provider-badge"]'
      ) as HTMLElement;
      const allocationRect = allocation.getBoundingClientRect();
      const controlRect = control.getBoundingClientRect();
      const badgeRect = badge.getBoundingClientRect();
      const context = `${direction} ${
        allowCustom ? "free-text" : "closed"
      } mode`;

      expect(
        controlRect.left,
        `${context}: control stays inside its allocation`
      ).to.be.at.least(allocationRect.left - 0.5);
      expect(
        controlRect.right,
        `${context}: control stays inside its allocation`
      ).to.be.at.most(allocationRect.right + 0.5);
      expect(
        badgeRect.left,
        `${context}: badge stays inside its control`
      ).to.be.at.least(controlRect.left - 0.5);
      expect(
        badgeRect.right,
        `${context}: badge stays inside its control`
      ).to.be.at.most(controlRect.right + 0.5);
      expect(
        badge.scrollWidth,
        `${context}: badge actually truncates long text`
      ).to.be.greaterThan(badge.clientWidth);
      expect(
        getComputedStyle(badge).textOverflow,
        `${context}: truncation has an ellipsis`
      ).to.equal("ellipsis");
    }
  }
});

describe("component-scoped geometry cssprops", () => {
  it("inherits gap and radius overrides across closed and free-text sizes", async () => {
    const themed = (await fixture(html`
      <div style="--lr-model-select-gap: 13px; --lr-model-select-radius: 17px">
        <lr-model-select size="2xs" .catalog=${CATALOG}></lr-model-select>
        <lr-model-select
          size="xl"
          allow-custom
          .catalog=${CATALOG}
        ></lr-model-select>
      </div>
    `)) as HTMLDivElement;
    const selects = Array.from(
      themed.querySelectorAll("lr-model-select")
    ) as LyraModelSelect[];
    const closed = selects[0]!;
    const freeText = selects[1]!;
    closed.open = true;
    freeText.open = true;
    await Promise.all([closed.updateComplete, freeText.updateComplete]);

    const closedTrigger = trigger(closed);
    const freeTextCombobox = freeText.shadowRoot!.querySelector(
      '[part="combobox"]'
    ) as HTMLElement;
    const closedListbox = closed.shadowRoot!.querySelector(
      '[part="listbox"]'
    ) as HTMLElement;
    const closedOption = rows(closed)[0]!;

    expect(getComputedStyle(closedTrigger).gap).to.equal("13px");
    expect(getComputedStyle(freeTextCombobox).gap).to.equal("13px");
    expect(getComputedStyle(closedOption).gap).to.equal("13px");
    expect(getComputedStyle(closedTrigger).borderTopLeftRadius).to.equal(
      "17px"
    );
    expect(getComputedStyle(freeTextCombobox).borderTopLeftRadius).to.equal(
      "17px"
    );
    expect(getComputedStyle(closedListbox).borderTopLeftRadius).to.equal(
      "17px"
    );
    expect(getComputedStyle(closedOption).borderTopLeftRadius).to.equal("17px");
  });
});

describe("open and synthetic-row theme cssprops", () => {
  it("inherits independent open-border and synthetic-border longhands in the combined state", async () => {
    const wrapper = (await fixture(html`
      <div
        style="
          --lr-model-select-open-border-color: rgb(1, 2, 3);
          --lr-model-select-option-synthetic-border-style: dotted;
          --lr-model-select-option-synthetic-border-color: rgb(4, 5, 6);
        "
      >
        <lr-model-select
          value="ancient-model"
          .catalog=${CATALOG}
        ></lr-model-select>
      </div>
    `)) as HTMLDivElement;
    const el = wrapper.querySelector("lr-model-select") as LyraModelSelect;
    el.open = true;
    await el.updateComplete;
    const synthetic = Array.from(rows(el)).find((row) =>
      row.hasAttribute("data-synthetic")
    ) as HTMLElement;

    expect(getComputedStyle(trigger(el)).borderTopColor).to.equal(
      "rgb(1, 2, 3)"
    );
    expect(getComputedStyle(synthetic).borderTopStyle).to.equal("dotted");
    expect(getComputedStyle(synthetic).borderTopColor).to.equal("rgb(4, 5, 6)");
  });
});

it('localizes the synthetic-row "not in catalog" badge via this.localize(), not hardcoded English', async () => {
  const el = (await fixture(
    html`<lr-model-select
      value="ancient-model"
      .catalog=${CATALOG}
      .strings=${{ notInCatalog: "absent du catalogue" }}
    ></lr-model-select>`
  )) as LyraModelSelect;
  el.open = true;
  await el.updateComplete;
    const synthetic = rows(el)[rows(el).length - 1]!;
  expect(
    synthetic.querySelector('[part="option-badge"]')!.textContent
  ).to.equal("absent du catalogue");
});

it('defaults to English "not in catalog" when no strings override is set', async () => {
  const el = (await fixture(
    html`<lr-model-select
      value="ancient-model"
      .catalog=${CATALOG}
    ></lr-model-select>`
  )) as LyraModelSelect;
  el.open = true;
  await el.updateComplete;
    const synthetic = rows(el)[rows(el).length - 1]!;
  expect(
    synthetic.querySelector('[part="option-badge"]')!.textContent
  ).to.equal("not in catalog");
});

it("does not append a synthetic row when catalog is empty, even for a set value", async () => {
  const el = (await fixture(
    html`<lr-model-select value="anything"></lr-model-select>`
  )) as LyraModelSelect;
  el.open = true;
  await el.updateComplete;
  expect(rows(el).length).to.equal(0);
});

// -- Free-text mode -------------------------------------------------------

it("filters suggestions by id/label substring, case-insensitively, as the user types", async () => {
  const el = (await fixture(
    html`<lr-model-select allow-custom .catalog=${CATALOG}></lr-model-select>`
  )) as LyraModelSelect;
  const inp = input(el);
  inp.focus();
  inp.value = "QWEN";
  inp.dispatchEvent(new Event("input"));
  await el.updateComplete;

  const visible = rows(el);
  expect(visible.length).to.equal(1);
    expect(visible[0]!.textContent).to.contain("qwen2.5-coder");
});

it("shows the localized empty-listbox message when no suggestions match the typed query", async () => {
  const el = (await fixture(
    html`<lr-model-select allow-custom .catalog=${CATALOG}></lr-model-select>`
  )) as LyraModelSelect;
  const inp = input(el);
  inp.focus();
  inp.value = "no-such-model";
  inp.dispatchEvent(new Event("input"));
  await el.updateComplete;

  const empty = el.shadowRoot!.querySelector('[part="empty"]') as HTMLElement;
  expect(empty != null).to.equal(true);
  expect(empty.textContent).to.equal("No matches");
});

it("localizes the empty-listbox message via this.localize() when .strings overrides noMatches", async () => {
  const el = (await fixture(
    html`<lr-model-select
      allow-custom
      .catalog=${CATALOG}
      .strings=${{ noMatches: "Aucun résultat" }}
    ></lr-model-select>`
  )) as LyraModelSelect;
  const inp = input(el);
  inp.focus();
  inp.value = "no-such-model";
  inp.dispatchEvent(new Event("input"));
  await el.updateComplete;

  const empty = el.shadowRoot!.querySelector('[part="empty"]') as HTMLElement;
  expect(empty.textContent).to.equal("Aucun résultat");
});

it("commits a highlighted suggestion with Enter, emitting lr-change with inCatalog true", async () => {
  const el = (await fixture(
    html`<lr-model-select allow-custom .catalog=${CATALOG}></lr-model-select>`
  )) as LyraModelSelect;
  const inp = input(el);
  inp.focus();
  await el.updateComplete;
  inp.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "ArrowDown",
      bubbles: true,
      cancelable: true,
    })
  );
  await el.updateComplete;

  let detail: { value: string; inCatalog: boolean } | undefined;
  el.addEventListener("lr-change", (e) => (detail = (e as CustomEvent).detail));
  setTimeout(() =>
    inp.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Enter",
        bubbles: true,
        cancelable: true,
      })
    )
  );
  await oneEvent(el, "lr-change");
  expect(el.value).to.equal("llama3.1");
  expect(detail).to.deep.equal({ value: "llama3.1", inCatalog: true });
});

it("commits raw typed text not in the catalog when allow-custom is set, with inCatalog false", async () => {
  const el = (await fixture(
    html`<lr-model-select allow-custom .catalog=${CATALOG}></lr-model-select>`
  )) as LyraModelSelect;
  const inp = input(el);
  inp.focus();
  inp.value = "my-custom-model";
  inp.dispatchEvent(new Event("input"));
  await el.updateComplete;

  let detail: { value: string; inCatalog: boolean } | undefined;
  el.addEventListener("lr-change", (e) => (detail = (e as CustomEvent).detail));
  setTimeout(() =>
    inp.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Enter",
        bubbles: true,
        cancelable: true,
      })
    )
  );
  await oneEvent(el, "lr-change");
  expect(el.value).to.equal("my-custom-model");
  expect(detail).to.deep.equal({ value: "my-custom-model", inCatalog: false });
});

it("commits arbitrary typed text when there is no catalog at all", async () => {
  const el = (await fixture(
    html`<lr-model-select></lr-model-select>`
  )) as LyraModelSelect;
  const inp = input(el);
  inp.focus();
  inp.value = "whatever-i-want";
  inp.dispatchEvent(new Event("input"));
  await el.updateComplete;

  setTimeout(() =>
    inp.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Enter",
        bubbles: true,
        cancelable: true,
      })
    )
  );
  await oneEvent(el, "lr-change");
  expect(el.value).to.equal("whatever-i-want");
});

it("reverts typed text back to the current value on Escape, without committing", async () => {
  const el = (await fixture(
    html`<lr-model-select
      allow-custom
      value="mistral"
      .catalog=${CATALOG}
    ></lr-model-select>`
  )) as LyraModelSelect;
  const inp = input(el);
  inp.focus();
  await el.updateComplete;
  inp.value = "something-else-entirely";
  inp.dispatchEvent(new Event("input"));
  await el.updateComplete;
  expect(el.open).to.be.true;

  inp.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "Escape",
      bubbles: true,
      cancelable: true,
    })
  );
  await el.updateComplete;
  expect(el.open).to.be.false;
  expect(el.value).to.equal("mistral");
  expect(input(el).value).to.equal("mistral");
});

it("shows a synthetic suggestion for a stale value in free-text mode", async () => {
  const el = (await fixture(
    html`<lr-model-select
      allow-custom
      value="ancient-model"
      .catalog=${CATALOG}
    ></lr-model-select>`
  )) as LyraModelSelect;
  const inp = input(el);
  inp.focus();
  await el.updateComplete;

  const all = rows(el);
  const synthetic = Array.from(all).find(
      (r) => r.dataset["value"] === "ancient-model"
  );
  expect(synthetic != null).to.equal(true);
  expect(synthetic!.hasAttribute("data-synthetic")).to.be.true;
});

it("opens the free-text suggestion popup on ArrowDown when not yet open", async () => {
  const el = (await fixture(
    html`<lr-model-select allow-custom .catalog=${CATALOG}></lr-model-select>`
  )) as LyraModelSelect;
  const inp = input(el);
  expect(el.open).to.be.false;
  inp.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "ArrowDown",
      bubbles: true,
      cancelable: true,
    })
  );
  await el.updateComplete;
  expect(el.open).to.be.true;
});

it("navigates free-text suggestions with ArrowUp (opens when closed, moves the active index up while open, floored at 0)", async () => {
  const el = (await fixture(
    html`<lr-model-select allow-custom .catalog=${CATALOG}></lr-model-select>`
  )) as LyraModelSelect;
  const inp = input(el);
  inp.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "ArrowUp",
      bubbles: true,
      cancelable: true,
    })
  );
  await el.updateComplete;
  expect(el.open, "ArrowUp must open the popup when it starts closed").to.be
    .true;

  inp.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "ArrowUp",
      bubbles: true,
      cancelable: true,
    })
  );
  await el.updateComplete;
  expect(
    (el as unknown as { activeIndex: number }).activeIndex,
    "floored at 0, not negative"
  ).to.equal(0);
});

it("jumps to the first and last suggestion rows with Home/End in free-text mode", async () => {
  const el = (await fixture(
    html`<lr-model-select allow-custom .catalog=${CATALOG}></lr-model-select>`
  )) as LyraModelSelect;
  const inp = input(el);
  el.open = true;
  await el.updateComplete;

  inp.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "End",
      bubbles: true,
      cancelable: true,
    })
  );
  await el.updateComplete;
  expect((el as unknown as { activeIndex: number }).activeIndex).to.equal(
    CATALOG.length - 1
  );

  inp.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "Home",
      bubbles: true,
      cancelable: true,
    })
  );
  await el.updateComplete;
  expect((el as unknown as { activeIndex: number }).activeIndex).to.equal(0);
});

it("suppresses the free-text input blur handler during a mode switch back to the closed dropdown", async () => {
  const el = (await fixture(
    html`<lr-model-select allow-custom .catalog=${CATALOG}></lr-model-select>`
  )) as LyraModelSelect;
  const inp = input(el);
  inp.focus();
  await el.updateComplete;
  expect(el.open, "focusing the free-text input opens the suggestion popup").to
    .be.true;

  el.allowCustom = false; // switches to closed-dropdown mode while the input is still focused,
  // which structurally blurs it synchronously mid-render (see suppressControlBlur's own doc).
  await el.updateComplete;
  expect(
    (el as unknown as { touched: boolean }).touched,
    "the structural blur during the mode switch must not mark the control touched"
  ).to.be.false;
});

it("returns focus externally when a replacement mode owner is disabled or inert", async () => {
  for (const unavailable of ["disabled", "inert"] as const) {
    const wrapper = await fixture(html`
      <div>
        <button id="model-select-return-${unavailable}">Before picker</button>
        <lr-model-select .catalog=${CATALOG}></lr-model-select>
      </div>
    `);
    const el = wrapper.querySelector("lr-model-select") as LyraModelSelect;
    const outside = wrapper.querySelector<HTMLElement>(
      `#model-select-return-${unavailable}`
    )!;
    outside.focus();
    trigger(el).focus();
    expect(
      (el as unknown as { focusReturnTarget?: HTMLElement })
        .focusReturnTarget === outside,
      `${unavailable} return target is captured before replacement`
    ).to.equal(true);

    el.allowCustom = true;
    if (unavailable === "disabled") el.disabled = true;
    else el.inert = true;
    await el.updateComplete;

    expect(el.ownerDocument.activeElement === outside, unavailable).to.equal(
      true
    );
  }
});

it("focuses the stable form-control owner when a disabled replacement has no external return target", async () => {
  const el = (await fixture(
    html`<lr-model-select .catalog=${CATALOG}></lr-model-select>`
  )) as LyraModelSelect;
  trigger(el).focus();
  (el as unknown as { focusReturnTarget?: HTMLElement }).focusReturnTarget =
    undefined;

  el.allowCustom = true;
  el.disabled = true;
  await el.updateComplete;

  expect(el.shadowRoot!.activeElement?.getAttribute("part")).to.equal(
    "form-control"
  );
});

describe("touched state (disabled-forced blur)", () => {
  // A focused native control (button/input) auto-blurs the instant it becomes `disabled` -- plain
  // platform behavior, not a user interaction. Marking `touched` for it too was capable of
  // reentering the very update that disabled the control.
  it("does not mark touched from a blur caused by the trigger itself becoming disabled (closed-dropdown mode)", async () => {
    const el = (await fixture(
      html`<lr-model-select .catalog=${CATALOG}></lr-model-select>`
    )) as LyraModelSelect;
    trigger(el).focus();
    await el.updateComplete;
    expect(
      el.shadowRoot!.activeElement != null,
      "the trigger is focused before disabling"
    ).to.equal(true);

    el.disabled = true; // forces the native blur once `disabled` reaches the trigger button
    await el.updateComplete;
    expect(
      (el as unknown as { touched: boolean }).touched,
      "a blur the platform forces by disabling the control must not mark it touched"
    ).to.be.false;
  });

  it("does not mark touched from a blur caused by the combobox input itself becoming disabled (free-text mode)", async () => {
    const el = (await fixture(
      html`<lr-model-select></lr-model-select>`
    )) as LyraModelSelect;
    input(el).focus();
    await el.updateComplete;
    expect(
      el.shadowRoot!.activeElement != null,
      "the combobox input is focused before disabling"
    ).to.equal(true);

    el.disabled = true; // forces the native blur once `disabled` reaches the combobox input
    await el.updateComplete;
    expect(
      (el as unknown as { touched: boolean }).touched,
      "a blur the platform forces by disabling the control must not mark it touched"
    ).to.be.false;
  });

  it("still marks touched from a real (non-disabled) blur of the trigger, unchanged", async () => {
    const el = (await fixture(
      html`<lr-model-select .catalog=${CATALOG}></lr-model-select>`
    )) as LyraModelSelect;
    const control = trigger(el);
    control.focus();
    await el.updateComplete;
    control.blur();
    await el.updateComplete;
    expect((el as unknown as { touched: boolean }).touched).to.be.true;
  });

  it("still marks touched from a real (non-disabled) blur of the combobox input, unchanged", async () => {
    const el = (await fixture(
      html`<lr-model-select></lr-model-select>`
    )) as LyraModelSelect;
    const control = input(el);
    control.focus();
    await el.updateComplete;
    control.blur();
    await el.updateComplete;
    expect((el as unknown as { touched: boolean }).touched).to.be.true;
  });
});

it("clears an active row when an open catalog is replaced, even if the same id remains", async () => {
  const el = (await fixture(
    html`<lr-model-select .catalog=${CATALOG}></lr-model-select>`
  )) as LyraModelSelect;
  el.open = true;
  await el.updateComplete;
  trigger(el).dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "ArrowDown",
      bubbles: true,
      cancelable: true,
    })
  );
  await el.updateComplete;
  expect((el as unknown as { activeIndex: number }).activeIndex).to.equal(0);

  el.catalog = [CATALOG[0]!, "replacement"];
  await el.updateComplete;
  let changed = false;
  el.addEventListener("lr-change", () => (changed = true));
  trigger(el).dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "Enter",
      bubbles: true,
      cancelable: true,
    })
  );

  expect(changed).to.be.false;
  expect(el.value).to.equal("");
});

it("preserves an open free-text draft while a replacement catalog is refiltered", async () => {
  const el = (await fixture(
    html`<lr-model-select
      allow-custom
      value="mistral"
      .catalog=${CATALOG}
    ></lr-model-select>`
  )) as LyraModelSelect;
  const inp = input(el);
  inp.focus();
  inp.value = "fresh";
  inp.dispatchEvent(new Event("input"));
  await el.updateComplete;

  el.catalog = ["fresh-model", "unrelated"];
  await el.updateComplete;

  expect(input(el).value).to.equal("fresh");
  expect((el as unknown as { activeIndex: number }).activeIndex).to.equal(-1);
  expect([...rows(el)].map((row) => row.textContent?.trim())).to.deep.equal([
    "fresh-model",
  ]);
  expect(el.value, "a catalog refresh must not commit the draft").to.equal(
    "mistral"
  );
});

it("rebases an open free-text query when the controlled value changes", async () => {
  const el = (await fixture(
    html`<lr-model-select
      allow-custom
      value="mistral"
      .catalog=${CATALOG}
    ></lr-model-select>`
  )) as LyraModelSelect;
  const inp = input(el);
  inp.focus();
  inp.value = "obsolete draft";
  inp.dispatchEvent(new Event("input"));
  await el.updateComplete;

  el.value = "qwen2.5-coder";
  await el.updateComplete;

  expect(input(el).value).to.equal("qwen2.5-coder");
  expect((el as unknown as { activeIndex: number }).activeIndex).to.equal(-1);
});

it("does not revive a stale free-text query after an open mode round trip", async () => {
  const el = (await fixture(
    html`<lr-model-select
      allow-custom
      value="mistral"
      .catalog=${CATALOG}
    ></lr-model-select>`
  )) as LyraModelSelect;
  const inp = input(el);
  inp.focus();
  inp.value = "obsolete draft";
  inp.dispatchEvent(new Event("input"));
  await el.updateComplete;

  el.allowCustom = false;
  await el.updateComplete;
  el.allowCustom = true;
  await el.updateComplete;

  expect(input(el).value).to.equal("mistral");
  expect((el as unknown as { activeIndex: number }).activeIndex).to.equal(-1);
});

describe("shared listbox (onListboxClick)", () => {
  it("selects a suggestion by clicking it in free-text mode (filteredEntries lookup path)", async () => {
    const el = (await fixture(
      html`<lr-model-select allow-custom .catalog=${CATALOG}></lr-model-select>`
    )) as LyraModelSelect;
    const inp = input(el);
    inp.focus();
    inp.value = "mist";
    inp.dispatchEvent(new Event("input"));
    await el.updateComplete;

    let detail: { value: string; inCatalog: boolean } | undefined;
    el.addEventListener(
      "lr-change",
      (e) => (detail = (e as CustomEvent).detail)
    );
      setTimeout(() => rows(el)[0]!.click());
    await oneEvent(el, "lr-change");
    expect(el.value).to.equal("mistral");
    expect(detail).to.deep.equal({ value: "mistral", inCatalog: true });
  });

  it("clicking the listbox itself (not a row) is a no-op", async () => {
    const el = (await fixture(
      html`<lr-model-select .catalog=${CATALOG}></lr-model-select>`
    )) as LyraModelSelect;
    el.open = true;
    await el.updateComplete;
    const listbox = el.shadowRoot!.querySelector(
      '[part="listbox"]'
    ) as HTMLElement;
    listbox.click();
    await el.updateComplete;
    expect(el.value).to.equal("");
    expect(
      el.open,
      "a click that resolves to no option must not close the popup either"
    ).to.be.true;
  });

  it("onListboxClick guards against a stale effectiveDisabled state (defensive branch)", async () => {
    const el = (await fixture(
      html`<lr-model-select .catalog=${CATALOG}></lr-model-select>`
    )) as LyraModelSelect;
    el.open = true;
    await el.updateComplete;
    const row = rows(el)[0];
    el.disabled = true;
    (el as unknown as { onListboxClick(e: MouseEvent): void }).onListboxClick({
      target: row,
    } as unknown as MouseEvent);
    expect(
      el.value,
      "a disabled control must not commit a click that arrived while effectiveDisabled flipped true"
    ).to.equal("");
  });
});

// -- Form participation -----------------------------------------------------

it('is present in FormData as "" when never touched, like a native <input>', async () => {
  const form = (await fixture(html`
    <form>
      <lr-model-select name="model" .catalog=${CATALOG}></lr-model-select>
    </form>
  `)) as HTMLFormElement;
  const fd = new FormData(form);
  expect(fd.has("model")).to.be.true;
  expect(fd.get("model")).to.equal("");
});

it("participates in a form: value reflects in FormData on submit", async () => {
  const form = (await fixture(html`
    <form>
      <lr-model-select name="model" .catalog=${CATALOG}></lr-model-select>
    </form>
  `)) as HTMLFormElement;
  const el = form.querySelector("lr-model-select") as LyraModelSelect;
  el.value = "mistral";
  await el.updateComplete;
  expect(new FormData(form).get("model")).to.equal("mistral");
});

it("updates disabled form participation synchronously without awaiting a Lit update", async () => {
  const form = (await fixture(html`
    <form>
      <lr-model-select name="model" .catalog=${CATALOG}></lr-model-select>
    </form>
  `)) as HTMLFormElement;
  const el = form.querySelector("lr-model-select") as LyraModelSelect;
  el.value = "mistral";
  expect(new FormData(form).get("model")).to.equal("mistral");

  el.disabled = true;
  expect(el.hasAttribute("disabled")).to.be.true;
  expect(new FormData(form).has("model")).to.be.false;

  el.disabled = false;
  expect(el.hasAttribute("disabled")).to.be.false;
  expect(new FormData(form).get("model")).to.equal("mistral");
});

it("submits under a programmatically assigned name in the same tick", async () => {
  const form = (await fixture(html`
    <form>
      <lr-model-select value="mistral" .catalog=${CATALOG}></lr-model-select>
    </form>
  `)) as HTMLFormElement;
  const el = form.querySelector("lr-model-select") as LyraModelSelect;

  el.name = "first";
  expect(el.getAttribute("name")).to.equal("first");
  expect(new FormData(form).get("first")).to.equal("mistral");

  el.name = "second";
  const renamed = new FormData(form);
  expect(renamed.has("first")).to.be.false;
  expect(renamed.get("second")).to.equal("mistral");

  el.name = "";
  expect(el.hasAttribute("name")).to.be.false;
  expect(el.name).to.equal("");
  expect(new FormData(form).has("second")).to.be.false;

  el.setAttribute("name", "from-attribute");
  expect(el.name).to.equal("from-attribute");
  expect(new FormData(form).get("from-attribute")).to.equal("mistral");
  el.removeAttribute("name");
  expect(el.name).to.equal("");
  expect(new FormData(form).has("from-attribute")).to.be.false;
});

it("blocks a required, empty model-select from submitting the form", async () => {
  const form = (await fixture(html`
    <form>
      <lr-model-select
        name="model"
        required
        .catalog=${CATALOG}
      ></lr-model-select>
    </form>
  `)) as HTMLFormElement;
  expect(form.reportValidity()).to.be.false;
});

it("allows a required model-select to submit once a value is set", async () => {
  const form = (await fixture(html`
    <form>
      <lr-model-select
        name="model"
        required
        .catalog=${CATALOG}
      ></lr-model-select>
    </form>
  `)) as HTMLFormElement;
  const el = form.querySelector("lr-model-select") as LyraModelSelect;
  el.value = "mistral";
  await el.updateComplete;
  expect(form.reportValidity()).to.be.true;
});

describe("validationMessage localization", () => {
  it("defaults to the built-in English validationMessage for a required, unset model-select", async () => {
    const el = (await fixture(
      html`<lr-model-select required .catalog=${CATALOG}></lr-model-select>`
    )) as LyraModelSelect;
    expect(el.validationMessage).to.equal("Please choose a model.");
  });

  it("localizes the validationMessage via this.localize() when .strings overrides modelSelectRequired", async () => {
    const el = (await fixture(
      html`<lr-model-select
        required
        .catalog=${CATALOG}
        .strings=${{ modelSelectRequired: "Veuillez choisir un modèle." }}
      ></lr-model-select>`
    )) as LyraModelSelect;
    expect(el.validationMessage).to.equal("Veuillez choisir un modèle.");

    el.value = "mistral";
    await el.updateComplete;
    expect(el.validationMessage).to.equal("");
  });
});

it("rebinds the validity focus anchor when switching from trigger to free-text mode", async () => {
  const form = (await fixture(html`
    <form>
      <button type="button">Before model select</button>
      <lr-model-select
        name="model"
        required
        .catalog=${CATALOG}
      ></lr-model-select>
    </form>
  `)) as HTMLFormElement;
  const sentinel = form.querySelector("button") as HTMLButtonElement;
  const el = form.querySelector("lr-model-select") as LyraModelSelect;
  let submitCount = 0;
  form.addEventListener("submit", (event) => {
    submitCount += 1;
    event.preventDefault();
  });

  sentinel.focus();
  expect(el.reportValidity()).to.be.false;
  expect(document.activeElement?.localName).to.equal("lr-model-select");
  expect(el.shadowRoot!.activeElement?.getAttribute("part")).to.equal(
    "trigger"
  );

  el.allowCustom = true;
  await el.updateComplete;
  sentinel.focus();
  form.requestSubmit();
  expect(submitCount).to.equal(0);
  expect(document.activeElement?.localName).to.equal("lr-model-select");
  expect(el.shadowRoot!.activeElement?.getAttribute("part")).to.equal(
    "combobox-input"
  );
});

it("updates dynamic required validity synchronously without awaiting a Lit update", async () => {
  const form = (await fixture(html`
    <form>
      <lr-model-select name="model" .catalog=${CATALOG}></lr-model-select>
    </form>
  `)) as HTMLFormElement;
  const el = form.querySelector("lr-model-select") as LyraModelSelect;
  expect(el.checkValidity()).to.be.true;

  el.required = true;
  expect(el.hasAttribute("required")).to.be.true;
  expect(el.checkValidity()).to.be.false;
  expect(form.checkValidity()).to.be.false;

  el.required = false;
  expect(el.hasAttribute("required")).to.be.false;
  expect(el.checkValidity()).to.be.true;
  expect(form.checkValidity()).to.be.true;
});

describe("formStateRestoreCallback (browser bfcache/autofill restore -- only reachable via a direct call)", () => {
  it("restores a string autofill/bfcache state directly", async () => {
    const el = (await fixture(
      html`<lr-model-select .catalog=${CATALOG}></lr-model-select>`
    )) as LyraModelSelect;
    el.formStateRestoreCallback("mistral", "restore");
    expect(el.value).to.equal("mistral");
  });

  it("falls back to an empty value for a non-string restored state (e.g. FormData)", async () => {
    const el = (await fixture(
      html`<lr-model-select .catalog=${CATALOG}></lr-model-select>`
    )) as LyraModelSelect;
    el.value = "mistral";
    el.formStateRestoreCallback(new FormData(), "restore");
    expect(el.value).to.equal("");
  });
});

it("normalizes a null value assignment to an empty string (defensive ?? fallback in the value setter)", async () => {
  const el = (await fixture(
    html`<lr-model-select .catalog=${CATALOG}></lr-model-select>`
  )) as LyraModelSelect;
  el.value = "mistral";
  expect(el.value).to.equal("mistral");
  (el as unknown as { value: string | null }).value = null;
  expect(el.value).to.equal("");
});

it("normalizes an explicitly empty value attribute to the canonical absent default", async () => {
  const el = (await fixture(
    html`<lr-model-select value="" .catalog=${CATALOG}></lr-model-select>`
  )) as LyraModelSelect;
  await el.updateComplete;

  expect(el.defaultValue).to.equal("");
  expect(el.value).to.equal("");
  expect(el.hasAttribute("value")).to.be.false;
});

it("dispatches one native Event input/change pair even from a detached/adopted document", async () => {
  const el = (await fixture(
    html`<lr-model-select .catalog=${CATALOG}></lr-model-select>`
  )) as LyraModelSelect;
  const detachedDoc = document.implementation.createHTMLDocument("detached");
  detachedDoc.adoptNode(el);
  expect(el.ownerDocument === detachedDoc).to.equal(true);
  expect(
    detachedDoc.defaultView,
    "precondition: a document created via createHTMLDocument() has no window"
  ).to.equal(null);

  const events: Event[] = [];
  el.addEventListener("input", (event) => events.push(event));
  el.addEventListener("change", (event) => events.push(event));
  rows(el)[0]!.click();
  expect(events.map((event) => event.type)).to.deep.equal(["input", "change"]);
  expect(events.every((event) => event.constructor === Event)).to.be.true;
  expect(
    events.every(
      (event) => event.target === el && event.bubbles && event.composed
    )
  ).to.be.true;
});

it("restores the declared default value (initial value attribute) on form.reset()", async () => {
  const form = (await fixture(html`
    <form>
      <lr-model-select
        name="model"
        value="llama3.1"
        .catalog=${CATALOG}
      ></lr-model-select>
    </form>
  `)) as HTMLFormElement;
  const el = form.querySelector("lr-model-select") as LyraModelSelect;
  await el.updateComplete;
  el.value = "mistral";
  await el.updateComplete;
  form.reset();
  expect(el.value).to.equal("llama3.1");
});

it("temporarily disables both modes through a fieldset without overwriting author state", async () => {
  const form = (await fixture(html`
    <form>
      <fieldset>
        <lr-model-select
          name="model"
          value="mistral"
          .catalog=${CATALOG}
        ></lr-model-select>
        <lr-model-select
          name="custom-model"
          value="custom"
          allow-custom
          .catalog=${CATALOG}
        ></lr-model-select>
        <lr-model-select
          name="always-disabled"
          value="llama3.1"
          disabled
          .catalog=${CATALOG}
        ></lr-model-select>
      </fieldset>
    </form>
  `)) as HTMLFormElement;
  const el = form.querySelector("lr-model-select") as LyraModelSelect;
  const freeText = form.querySelector(
    '[name="custom-model"]'
  ) as LyraModelSelect;
  const explicitlyDisabled = form.querySelector(
    '[name="always-disabled"]'
  ) as LyraModelSelect;
  const fieldset = form.querySelector("fieldset") as HTMLFieldSetElement;
  await Promise.all([
    el.updateComplete,
    freeText.updateComplete,
    explicitlyDisabled.updateComplete,
  ]);
  expect(el.disabled).to.be.false;
  expect(el.effectiveDisabled).to.be.false;
  expect(new FormData(form).get("model")).to.equal("mistral");
  expect(new FormData(form).get("custom-model")).to.equal("custom");
  el.open = true;
  await el.updateComplete;
  expect(el.open).to.be.true;

  fieldset.disabled = true;
  await Promise.all([
    el.updateComplete,
    freeText.updateComplete,
    explicitlyDisabled.updateComplete,
  ]);
  expect(el.disabled, "fieldset state must not mutate the public property").to
    .be.false;
  expect(el.hasAttribute("disabled")).to.be.false;
  expect(el.effectiveDisabled).to.be.true;
  expect(freeText.effectiveDisabled).to.be.true;
  expect(trigger(el).disabled).to.be.true;
  expect(input(freeText).disabled).to.be.true;
  expect(el.open, "disabling an open control closes its interactive popup").to
    .be.false;
  expect(getComputedStyle(trigger(el)).cursor).to.equal("not-allowed");
  expect(new FormData(form).get("model")).to.equal(null);
  expect(new FormData(form).get("custom-model")).to.equal(null);

  let delegatedCalls = 0;
  trigger(el).click = () => {
    delegatedCalls += 1;
  };
  trigger(el).focus = () => {
    delegatedCalls += 1;
  };
  input(freeText).click = () => {
    delegatedCalls += 1;
  };
  input(freeText).focus = () => {
    delegatedCalls += 1;
  };
  el.click();
  el.focus();
  freeText.click();
  freeText.focus();
  expect(
    delegatedCalls,
    "fieldset disablement gates host click/focus in both modes"
  ).to.equal(0);

  fieldset.disabled = false;
  await Promise.all([
    el.updateComplete,
    freeText.updateComplete,
    explicitlyDisabled.updateComplete,
  ]);
  expect(el.disabled).to.be.false;
  expect(el.effectiveDisabled).to.be.false;
  expect(freeText.effectiveDisabled).to.be.false;
  expect(trigger(el).disabled).to.be.false;
  expect(input(freeText).disabled).to.be.false;
  expect(new FormData(form).get("model")).to.equal("mistral");
  expect(new FormData(form).get("custom-model")).to.equal("custom");

  expect(
    explicitlyDisabled.disabled,
    "an explicit disabled state survives the fieldset cycle"
  ).to.be.true;
  expect(explicitlyDisabled.effectiveDisabled).to.be.true;
  expect(new FormData(form).get("always-disabled")).to.equal(null);
});

// -- Misc --------------------------------------------------------------

it("renders the provider badge when provider is set", async () => {
  const el = (await fixture(
    html`<lr-model-select
      provider="ollama"
      .catalog=${CATALOG}
    ></lr-model-select>`
  )) as LyraModelSelect;
  expect(
    el.shadowRoot!.querySelector('[part="provider-badge"]')!.textContent
  ).to.equal("ollama");
});

it("closes the popup on a pointerdown outside the element", async () => {
  const el = (await fixture(
    html`<lr-model-select .catalog=${CATALOG}></lr-model-select>`
  )) as LyraModelSelect;
  el.open = true;
  await el.updateComplete;
  expect(el.open).to.be.true;

  document.dispatchEvent(
    new PointerEvent("pointerdown", { bubbles: true, composed: true })
  );
  await el.updateComplete;
  expect(el.open).to.be.false;
});

it("re-binds positioning after a disconnect+reconnect while open, ending up closed rather than half-open with no listeners", async () => {
  const el = (await fixture(
    html`<lr-model-select open .catalog=${CATALOG}></lr-model-select>`
  )) as LyraModelSelect;
  await el.updateComplete;
  const parent = el.parentElement!;
  el.remove();
  parent.appendChild(el);
  await el.updateComplete;
  // `disconnectedCallback()` resets `open` to `false` -- asserting that
  // directly is what actually distinguishes the fix from the pre-fix bug
  // (a stranded, unclosable, unpositioned listbox with no outside-pointerdown
  // listener re-attached).
  expect(el.open).to.be.false;
});

it("does not open when disabled", async () => {
  const el = (await fixture(
    html`<lr-model-select disabled .catalog=${CATALOG}></lr-model-select>`
  )) as LyraModelSelect;
  trigger(el).click();
  await el.updateComplete;
  expect(el.open).to.be.false;
});

it("rejects direct open writes while disabled or synchronously fieldset-disabled", async () => {
  const fieldset = await fixture<HTMLFieldSetElement>(html`
    <fieldset><lr-model-select .catalog=${CATALOG}></lr-model-select></fieldset>
  `);
  const el = fieldset.querySelector("lr-model-select") as LyraModelSelect;
  el.disabled = true;
  el.open = true;
  expect(el.open).to.be.false;
  expect(el.hasAttribute("open")).to.be.false;

  el.disabled = false;
  fieldset.disabled = true;
  el.setAttribute("open", "");
  await el.updateComplete;
  expect(el.open).to.be.false;
  expect(el.hasAttribute("open")).to.be.false;
});

// -- Label -----------------------------------------------------------------

it("renders initial slotted label content in the standard form-control frame", async () => {
  const el = (await fixture(html`
    <lr-model-select required .catalog=${CATALOG}>
      <span slot="label">Deployment model</span>
    </lr-model-select>
  `)) as LyraModelSelect;
  const root = el.shadowRoot!;

  expect(root.querySelectorAll('[part="form-control"]').length).to.equal(1);
  expect(
    root.querySelectorAll('[part="form-control-label"] slot[name="label"]')
      .length
  ).to.equal(1);

  const label = root.querySelector<HTMLLabelElement>(
    '[part="form-control-label"]'
  )!;
  const labelSlot = label.querySelector<HTMLSlotElement>('slot[name="label"]')!;
  expect(label.hidden).to.be.false;
  expect(labelSlot.assignedElements().length).to.equal(1);
  expect(labelSlot.assignedElements()[0]?.textContent?.trim()).to.equal(
    "Deployment model"
  );
  expect(label.htmlFor).to.equal(trigger(el).id);
  expect(trigger(el).hasAttribute("aria-label")).to.be.false;
  expect(getComputedStyle(label, "::after").content).to.contain("*");
});

it("updates free-text naming when slotted label content is added and removed", async () => {
  const el = (await fixture(html`
    <lr-model-select
      allow-custom
      placeholder="Choose a model"
    ></lr-model-select>
  `)) as LyraModelSelect;
  const label = el.shadowRoot!.querySelector<HTMLLabelElement>(
    '[part="form-control-label"]'
  )!;
  expect(label.querySelectorAll('slot[name="label"]').length).to.equal(1);
  const labelSlot = label.querySelector<HTMLSlotElement>('slot[name="label"]')!;

  expect(label.hidden).to.be.true;
  expect(input(el).getAttribute("aria-label")).to.equal("Choose a model");

  const added = oneEvent(labelSlot, "slotchange");
  const slotted = document.createElement("span");
  slotted.slot = "label";
  slotted.textContent = "Generation model";
  el.append(slotted);
  await added;
  await el.updateComplete;

  expect(label.hidden).to.be.false;
  expect(label.htmlFor).to.equal(input(el).id);
  expect(input(el).hasAttribute("aria-label")).to.be.false;

  const removed = oneEvent(labelSlot, "slotchange");
  slotted.remove();
  await removed;
  await el.updateComplete;

  expect(label.hidden).to.be.true;
  expect(input(el).getAttribute("aria-label")).to.equal("Choose a model");
});

it("keeps an explicit host aria-label ahead of slotted label content", async () => {
  const el = (await fixture(html`
    <lr-model-select aria-label="Inference model" .catalog=${CATALOG}>
      <span slot="label">Model</span>
    </lr-model-select>
  `)) as LyraModelSelect;

  expect(trigger(el).getAttribute("aria-label")).to.equal("Inference model");
});

it("renders a visible form-control-label element once label is set", async () => {
  const el = (await fixture(
    html`<lr-model-select .catalog=${CATALOG}></lr-model-select>`
  )) as LyraModelSelect;
  const labelEl = el.shadowRoot!.querySelector(
    '[part="form-control-label"]'
  ) as HTMLLabelElement;
  expect(labelEl.hidden, "hidden by default when label is unset").to.be.true;

  el.label = "Model";
  await el.updateComplete;
  expect(labelEl.hidden).to.be.false;
  expect(labelEl.textContent).to.equal("Model");
  expect(
    labelEl.htmlFor,
    "label should be paired with the trigger via for/id"
  ).to.equal(trigger(el).id);
});

it("renders the visible label in free-text mode too, paired with the combobox input", async () => {
  const el = (await fixture(
    html`<lr-model-select label="Model"></lr-model-select>`
  )) as LyraModelSelect;
  const labelEl = el.shadowRoot!.querySelector(
    '[part="form-control-label"]'
  ) as HTMLLabelElement;
  expect(labelEl.hidden).to.be.false;
  expect(labelEl.textContent).to.equal("Model");
  expect(labelEl.htmlFor).to.equal(input(el).id);
});

it("derives the accessible name from label when set, omitting the redundant aria-label", async () => {
  const el = (await fixture(
    html`<lr-model-select label="Model" .catalog=${CATALOG}></lr-model-select>`
  )) as LyraModelSelect;
  expect(
    trigger(el).hasAttribute("aria-label"),
    "aria-label is unnecessary once a visible label exists"
  ).to.be.false;
});

it("prefers an explicit host aria-label over label, same precedence as lr-select", async () => {
  const el = (await fixture(
    html`<lr-model-select
      aria-label="Sort order"
      label="Model"
      .catalog=${CATALOG}
    ></lr-model-select>`
  )) as LyraModelSelect;
  expect(trigger(el).getAttribute("aria-label")).to.equal("Sort order");
});

it('preserves the exact aria-label/placeholder/"Model" fallback chain when label is unset', async () => {
  const withAriaLabel = (await fixture(
    html`<lr-model-select
      aria-label="Sort order"
      placeholder="Choose…"
      .catalog=${CATALOG}
    ></lr-model-select>`
  )) as LyraModelSelect;
  expect(trigger(withAriaLabel).getAttribute("aria-label")).to.equal(
    "Sort order"
  );

  const withPlaceholder = (await fixture(
    html`<lr-model-select
      placeholder="Choose…"
      .catalog=${CATALOG}
    ></lr-model-select>`
  )) as LyraModelSelect;
  expect(trigger(withPlaceholder).getAttribute("aria-label")).to.equal(
    "Choose…"
  );

  const bare = (await fixture(
    html`<lr-model-select .catalog=${CATALOG}></lr-model-select>`
  )) as LyraModelSelect;
  expect(trigger(bare).getAttribute("aria-label")).to.equal("Model");
});

it('localizes the "Model" aria-label fallback via this.localize() when .strings overrides model', async () => {
  const el = (await fixture(
    html`<lr-model-select
      .catalog=${CATALOG}
      .strings=${{ model: "Modèle" }}
    ></lr-model-select>`
  )) as LyraModelSelect;
  expect(trigger(el).getAttribute("aria-label")).to.equal("Modèle");
});

it("is accessible with a visible label set", async () => {
  const el = (await fixture(
    html`<lr-model-select label="Model" .catalog=${CATALOG}></lr-model-select>`
  )) as LyraModelSelect;
  await expect(el).to.be.accessible();
});

// -- Accessibility -------------------------------------------------------

it("is accessible (closed dropdown, default and open)", async () => {
  const el = (await fixture(
    html`<lr-model-select
      placeholder="Pick a model"
      .catalog=${CATALOG}
    ></lr-model-select>`
  )) as LyraModelSelect;
  await expect(el).to.be.accessible();

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

it("is accessible (free-text mode, default and open)", async () => {
  const el = (await fixture(
    html`<lr-model-select
      placeholder="Type a model"
      allow-custom
      .catalog=${CATALOG}
    ></lr-model-select>`
  )) as LyraModelSelect;
  await expect(el).to.be.accessible();

  el.open = true;
  await el.updateComplete;
  // See the identical comment in the test above -- `[part='listbox']`'s opacity transition is
  // still running at this point.
  el.shadowRoot!.querySelector('[part="listbox"]')
    ?.getAnimations()
    .forEach((animation) => animation.finish());
  await expect(el).to.be.accessible();
});

// -- Hint/error chrome -------------------------------------------------------

describe("hint/error chrome", () => {
  it("renders no hint/error chrome when hint/errorText are unset (today's exact bare output, closed dropdown mode)", async () => {
    const el = (await fixture(
      html`<lr-model-select .catalog=${CATALOG}></lr-model-select>`
    )) as LyraModelSelect;
    const hint = el.shadowRoot!.querySelector('[part="hint"]') as HTMLElement;
    const error = el.shadowRoot!.querySelector('[part="error"]') as HTMLElement;
    expect(hint.hidden).to.be.true;
    expect(error.hidden).to.be.true;
  });

  it("renders no hint/error chrome when hint/errorText are unset (free-text mode)", async () => {
    const el = (await fixture(
      html`<lr-model-select></lr-model-select>`
    )) as LyraModelSelect;
    const hint = el.shadowRoot!.querySelector('[part="hint"]') as HTMLElement;
    const error = el.shadowRoot!.querySelector('[part="error"]') as HTMLElement;
    expect(hint.hidden).to.be.true;
    expect(error.hidden).to.be.true;
  });

  it("renders hint/errorText text and un-hides the matching parts (closed dropdown mode)", async () => {
    const el = (await fixture(
      html`<lr-model-select
        hint="Pick a model"
        error-text="Required"
        .catalog=${CATALOG}
      ></lr-model-select>`
    )) as LyraModelSelect;
    const hint = el.shadowRoot!.querySelector('[part="hint"]') as HTMLElement;
    const error = el.shadowRoot!.querySelector('[part="error"]') as HTMLElement;
    expect(hint.hidden).to.be.false;
    expect(hint.textContent).to.contain("Pick a model");
    expect(error.hidden).to.be.false;
    expect(error.textContent).to.contain("Required");
  });

  it("renders hint/errorText text and un-hides the matching parts (free-text mode)", async () => {
    const el = (await fixture(
      html`<lr-model-select
        allow-custom
        hint="Pick a model"
        error-text="Required"
        .catalog=${CATALOG}
      ></lr-model-select>`
    )) as LyraModelSelect;
    const hint = el.shadowRoot!.querySelector('[part="hint"]') as HTMLElement;
    const error = el.shadowRoot!.querySelector('[part="error"]') as HTMLElement;
    expect(hint.hidden).to.be.false;
    expect(hint.textContent).to.contain("Pick a model");
    expect(error.hidden).to.be.false;
    expect(error.textContent).to.contain("Required");
  });

  it("renders slotted hint/error content and un-hides the matching parts", async () => {
    const el = (await fixture(html`
      <lr-model-select .catalog=${CATALOG}>
        <span slot="hint">Custom hint</span>
        <span slot="error">Custom error</span>
      </lr-model-select>
    `)) as LyraModelSelect;
    const hint = el.shadowRoot!.querySelector('[part="hint"]') as HTMLElement;
    const error = el.shadowRoot!.querySelector('[part="error"]') as HTMLElement;
    expect(hint.hidden).to.be.false;
    expect(error.hidden).to.be.false;
  });

  it("wires aria-describedby on the trigger to the rendered hint/error ids", async () => {
    const el = (await fixture(
      html`<lr-model-select
        hint="Pick a model"
        error-text="Required"
        .catalog=${CATALOG}
      ></lr-model-select>`
    )) as LyraModelSelect;
    const describedBy = trigger(el).getAttribute("aria-describedby") ?? "";
    expect(describedBy).to.contain("error");
    expect(describedBy).to.contain("hint");
  });

  it("wires aria-describedby on the combobox input to the rendered hint/error ids", async () => {
    const el = (await fixture(
      html`<lr-model-select
        allow-custom
        hint="Pick a model"
        error-text="Required"
      ></lr-model-select>`
    )) as LyraModelSelect;
    const describedBy = input(el).getAttribute("aria-describedby") ?? "";
    expect(describedBy).to.contain("error");
    expect(describedBy).to.contain("hint");
  });

  it("omits aria-describedby entirely when neither hint nor errorText is set", async () => {
    const el = (await fixture(
      html`<lr-model-select .catalog=${CATALOG}></lr-model-select>`
    )) as LyraModelSelect;
    expect(trigger(el).hasAttribute("aria-describedby")).to.be.false;
  });
});

// -- Editing-assistance and event-bridging passthrough (free-text mode) -----

describe("spellcheck/autocapitalize/autocorrect passthrough", () => {
  it("spellcheck defaults to true (matching the native input default)", async () => {
    const el = (await fixture(
      html`<lr-model-select></lr-model-select>`
    )) as LyraModelSelect;
    expect(input(el).spellcheck).to.be.true;
  });

  it("forwards spellcheck=false, autocapitalize, and autocorrect onto the native input", async () => {
    const el = (await fixture(html`
      <lr-model-select
        spellcheck="false"
        autocapitalize="off"
        autocorrect="off"
      ></lr-model-select>
    `)) as LyraModelSelect;
    const inp = input(el);
    expect(inp.spellcheck).to.be.false;
    expect(inp.getAttribute("autocapitalize")).to.equal("off");
    expect(inp.getAttribute("autocorrect")).to.equal("off");
  });

  it("forwards autocomplete, inputmode, and enterkeyhint onto the free-text input", async () => {
    const el = (await fixture(
      html`<lr-model-select
        autocomplete="off"
        inputmode="text"
        enterkeyhint="done"
      ></lr-model-select>`
    )) as LyraModelSelect;
    const inp = input(el);
    expect(inp.getAttribute("autocomplete")).to.equal("off");
    expect(inp.getAttribute("inputmode")).to.equal("text");
    expect(inp.getAttribute("enterkeyhint")).to.equal("done");
  });

  it("omits the autocomplete attribute when set to an empty string", async () => {
    const el = (await fixture(
      html`<lr-model-select autocomplete=""></lr-model-select>`
    )) as LyraModelSelect;
    expect(input(el).hasAttribute("autocomplete")).to.be.false;
  });
});

describe("native event relays", () => {
  async function expectFocusContract(
    wrapper: HTMLElement,
    el: LyraModelSelect,
    control: HTMLElement
  ): Promise<void> {
    const before = document.createElement("button");
    const after = document.createElement("button");
    wrapper.prepend(before);
    wrapper.append(after);
    const nativeEvents: FocusEvent[] = [];
    const aliases: string[] = [];
    wrapper.addEventListener("focus", (event) =>
      nativeEvents.push(event as FocusEvent)
    );
    wrapper.addEventListener("blur", (event) =>
      nativeEvents.push(event as FocusEvent)
    );
    wrapper.addEventListener("lr-focus", () => aliases.push("lr-focus"));
    wrapper.addEventListener("lr-blur", () => aliases.push("lr-blur"));

    before.focus();
    control.focus();
    after.focus();

    expect(nativeEvents.map((event) => event.type)).to.deep.equal([
      "focus",
      "blur",
    ]);
    expect(nativeEvents.every((event) => event instanceof FocusEvent)).to.be
      .true;
    expect(
      nativeEvents.every(
        (event) => event.target === el && event.bubbles && event.composed
      )
    ).to.be.true;
    expect(nativeEvents[0]!.relatedTarget === before).to.be.true;
    expect(nativeEvents[1]!.relatedTarget === after).to.be.true;
    // v9 dropped the v8 lr-focus/lr-blur compatibility aliases -- only the native pair remains.
    expect(aliases).to.deep.equal([]);
  }

  it('relays exactly one native focus/blur pair, and never lr-focus/lr-blur, in both rendering modes', async () => {
    const closedWrapper = await fixture<HTMLElement>(html`
      <div><lr-model-select .catalog=${CATALOG}></lr-model-select></div>
    `);
    const closed = closedWrapper.querySelector(
      "lr-model-select"
    ) as LyraModelSelect;
    await expectFocusContract(closedWrapper, closed, trigger(closed));

    const freeWrapper = await fixture<HTMLElement>(
      html`<div><lr-model-select></lr-model-select></div>`
    );
    const free = freeWrapper.querySelector(
      "lr-model-select"
    ) as LyraModelSelect;
    await expectFocusContract(freeWrapper, free, input(free));
  });

  it("preserves the free-text InputEvent payload without a shadow duplicate", async () => {
    const wrapper = await fixture<HTMLElement>(
      html`<div><lr-model-select></lr-model-select></div>`
    );
    const el = wrapper.querySelector("lr-model-select") as LyraModelSelect;
    const control = input(el);
    const events: InputEvent[] = [];
    wrapper.addEventListener("input", (event) =>
      events.push(event as InputEvent)
    );

    control.value = "m";
    control.dispatchEvent(
      new InputEvent("input", {
        bubbles: true,
        composed: true,
        data: "m",
        inputType: "insertText",
        isComposing: true,
      })
    );

    expect(events).to.have.lengthOf(1);
      const relayed = events[0]!;
      expect(relayed instanceof InputEvent).to.be.true;
      expect(relayed.target === el && relayed.bubbles && relayed.composed)
        .to.be.true;
      expect(relayed.data).to.equal("m");
      expect(relayed.inputType).to.equal("insertText");
      expect(relayed.isComposing).to.be.true;
  });
});

/** Render the max-inline-size declared on `selector` (read off the element's own applied stylesheets)
 *  into the component's shadow scope with the viewport-clamp token pinned to a tiny value, returning
 *  its resolved computed value. Wired to --lr-popover-viewport-clamp the min() collapses to that
 *  pinned value; a leftover 92vw/90vw literal would resolve to something else. */
function renderedClamp(el: HTMLElement, selector: string): string {
  const normalize = (text: string) => text.replace(/"/g, "'");
  let declared = "";
  for (const sheet of el.shadowRoot!.adoptedStyleSheets) {
    for (const rule of sheet.cssRules) {
      if (
        rule instanceof CSSStyleRule &&
        normalize(rule.selectorText) === normalize(selector) &&
        rule.style.maxInlineSize
      ) {
        declared = rule.style.maxInlineSize;
      }
    }
  }
  const probe = document.createElement("span");
  probe.style.display = "block";
  probe.style.setProperty("--lr-popover-viewport-clamp", "10px");
  probe.style.maxInlineSize = declared;
  el.shadowRoot!.appendChild(probe);
  const value = getComputedStyle(probe).maxInlineSize;
  probe.remove();
  return value;
}

it("clamps its floating surface width through the shared popover-viewport-clamp token", async () => {
  const el = (await fixture(
    html`<lr-model-select></lr-model-select>`
  )) as HTMLElement;
  await (el as HTMLElement & { updateComplete?: Promise<unknown> })
    .updateComplete;
  expect(renderedClamp(el, "[part='listbox']")).to.equal("10px");
});

it("renders the combobox-input's placeholder in the live quiet-text token color", async () => {
  const el = (await fixture(html`
    <lr-model-select
      style="--lr-color-text-quiet: rgb(12, 34, 56)"
    ></lr-model-select>
  `)) as LyraModelSelect;
  await el.updateComplete;
  const input = el.shadowRoot!.querySelector(
    '[part="combobox-input"]'
  ) as HTMLInputElement;

  expect(getComputedStyle(input, "::placeholder").color).to.equal(
    "rgb(12, 34, 56)"
  );
});

// -- Hover states (mouse-modality parity with the focus ring) --------------

it("renders the closed-dropdown trigger hover treatment", async () => {
  const el = await fixture<LyraModelSelect>(html`
    <lr-model-select
      style="--lr-color-brand-quiet: rgb(1, 2, 3)"
      .catalog=${CATALOG}
    ></lr-model-select>
  `);
  const trigger = el.shadowRoot!.querySelector<HTMLElement>('[part="trigger"]')!;
  trigger.scrollIntoView({ block: "center" });
  const rect = trigger.getBoundingClientRect();
  try {
    await sendMouse({
      type: "move",
      position: [Math.round(rect.left + rect.width / 2), Math.round(rect.top + rect.height / 2)],
    });
    await waitUntil(
      () => getComputedStyle(trigger).backgroundColor === "rgb(1, 2, 3)",
      "the model-select trigger hover background never appeared",
    );
  } finally {
    await resetMouse();
  }
});

describe("--lr-model-select-option-active-bg", () => {
  it("retints the keyboard-active option row via the cssprop, not just the bare shared token", async () => {
    const el = (await fixture(
      html`<lr-model-select
        style="--lr-model-select-option-active-bg: rgb(10, 20, 30)"
        .catalog=${CATALOG}
      ></lr-model-select>`
    )) as LyraModelSelect;
    el.open = true;
    await el.updateComplete;
    trigger(el).dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "ArrowDown",
        bubbles: true,
        cancelable: true,
      })
    );
    await el.updateComplete;
    const active = el.shadowRoot!.querySelector<HTMLElement>(
      '[part="option"][data-active]'
    )!;
    expect(active).to.exist;
    expect(getComputedStyle(active).backgroundColor).to.equal("rgb(10, 20, 30)");
  });

  it("renders byte-identically to the shared token default when unset", async () => {
    const el = (await fixture(
      html`<lr-model-select .catalog=${CATALOG}></lr-model-select>`
    )) as LyraModelSelect;
    el.open = true;
    await el.updateComplete;
      const row = rows(el)[0]!;
    row.setAttribute("data-active", "");
    const before = getComputedStyle(row).backgroundColor;
    el.style.setProperty(
      "--lr-model-select-option-active-bg",
      "var(--lr-color-brand-quiet)"
    );
    expect(getComputedStyle(row).backgroundColor).to.equal(before);
  });
});

// -- Host click() forwarding -------------------------------------------

it("forwards a host-level .click() to the internal trigger button (closed-dropdown mode)", async () => {
  const el = (await fixture(
    html`<lr-model-select .catalog=${CATALOG}></lr-model-select>`
  )) as LyraModelSelect;
  expect(el.open).to.be.false;
  el.click();
  await el.updateComplete;
  expect(
    el.open,
    "a host-level click() must actually open the picker, not be a no-op"
  ).to.be.true;
});

it("forwards a host-level .click() to the internal combobox input (free-text mode)", async () => {
  const el = (await fixture(
    html`<lr-model-select></lr-model-select>`
  )) as LyraModelSelect;
  let relayedClicks = 0;
  el.addEventListener("click", () => (relayedClicks += 1));
  expect(el.open).to.be.false;
  el.click();
  await el.updateComplete;
  expect(
    el.open,
    "clicking the free-text input focuses it, which opens the suggestion popup"
  ).to.be.true;
  expect(
    relayedClicks,
    "model-select retains its inner click relay before focusing"
  ).to.equal(1);
});

it("host .click() is a no-op while disabled, matching native disabled-control semantics", async () => {
  const el = (await fixture(
    html`<lr-model-select disabled .catalog=${CATALOG}></lr-model-select>`
  )) as LyraModelSelect;
  el.click();
  await el.updateComplete;
  expect(el.open).to.be.false;
});

// -- ElementInternals availability ---------------------------------------

describe("ElementInternals availability", () => {
  it("does not throw when constructed in an environment without a real ElementInternals implementation (e.g. a downstream Vitest + happy-dom suite)", async () => {
    const original = HTMLElement.prototype.attachInternals;
    // @ts-expect-error -- simulating an environment that lacks ElementInternals entirely
    delete HTMLElement.prototype.attachInternals;
    try {
      let el: LyraModelSelect | undefined;
      expect(() => {
        el = document.createElement("lr-model-select") as LyraModelSelect;
      }).to.not.throw();
      // Confirm the fallback keeps the rest of the public surface usable rather than merely
      // swallowing the constructor error.
      expect(el!.checkValidity()).to.be.true;
      expect(el!.form === null).to.equal(true);
    } finally {
      HTMLElement.prototype.attachInternals = original;
    }
  });

  it("falls back to noop internals when attachInternals() throws (e.g. called a second time)", async () => {
    const original = HTMLElement.prototype.attachInternals;
    HTMLElement.prototype.attachInternals = function () {
      throw new DOMException(
        "attachInternals already called",
        "InvalidStateError"
      );
    };
    try {
      let el: LyraModelSelect | undefined;
      expect(() => {
        el = document.createElement("lr-model-select") as LyraModelSelect;
      }).to.not.throw();
      expect(el!.checkValidity()).to.be.true;
      expect(el!.reportValidity()).to.be.true;
      expect(el!.form === null).to.equal(true);
    } finally {
      HTMLElement.prototype.attachInternals = original;
    }
  });
});

// -- size ------------------------------------------------------------------

describe("size", () => {
  it('defaults to size "m"', async () => {
    const el = (await fixture(
      html`<lr-model-select .catalog=${CATALOG}></lr-model-select>`
    )) as LyraModelSelect;
    expect(el.size).to.equal("m");
  });

  it("reflects a size attribute set as a plain HTML attribute", async () => {
    const el = (await fixture(
      html`<lr-model-select size="s" .catalog=${CATALOG}></lr-model-select>`
    )) as LyraModelSelect;
    expect(el.getAttribute("size")).to.equal("s");
    expect(el.size).to.equal("s");
  });

  it("enforces --lr-model-select-trigger-min-height at each non-default size (closed-dropdown mode)", async () => {
    const expected: Record<string, string> = {
      "2xs": "20px",
      xs: "24px",
      s: "30px",
      l: "48px",
      xl: "56px",
    };
    for (const [size, px] of Object.entries(expected)) {
      const el = (await fixture(
        html`<lr-model-select
          size=${size}
          .catalog=${CATALOG}
        ></lr-model-select>`
      )) as LyraModelSelect;
      expect(
        getComputedStyle(trigger(el)).minBlockSize,
        `size=${size}`
      ).to.equal(px);
    }
  });

  it('enforces --lr-model-select-trigger-min-height at the default "m" size too (40px)', async () => {
    const el = (await fixture(
      html`<lr-model-select .catalog=${CATALOG}></lr-model-select>`
    )) as LyraModelSelect;
    expect(getComputedStyle(trigger(el)).minBlockSize).to.equal("40px");
  });

  it("accepts the small/medium/large spellings as aliases of s/m/l", async () => {
    // The shared size ladder emits both spellings in one selector list, so migrating markup from a
    // library that spells its tiers out needs no attribute rewrite. Assert the RENDERED height:
    // a spelling the type accepts and the stylesheet ignores would fall back to the default tier.
    const heightAt = async (size: string): Promise<string> => {
      const el = (await fixture(
        html`<lr-model-select
          size=${size}
          .catalog=${CATALOG}
        ></lr-model-select>`
      )) as LyraModelSelect;
      return getComputedStyle(trigger(el)).minBlockSize;
    };
    expect(await heightAt("small"), "small === s").to.equal(
      await heightAt("s")
    );
    expect(await heightAt("medium"), "medium === m").to.equal(
      await heightAt("m")
    );
    expect(await heightAt("large"), "large === l").to.equal(
      await heightAt("l")
    );
    expect(
      await heightAt("small"),
      "small is not silently the default tier"
    ).to.not.equal(await heightAt("m"));
  });

  it("sizes its private trigger defaults off the shared --lr-form-control-* ladder while preserving the public override", async () => {
    const el = (await fixture(
      html`<lr-model-select size="l" .catalog=${CATALOG}></lr-model-select>`
    )) as LyraModelSelect;
    const hostStyle = getComputedStyle(el);
    expect(
      hostStyle.getPropertyValue("--lr-model-select-trigger-min-height").trim()
    ).to.equal("");
    expect(
      hostStyle.getPropertyValue("--lr-model-select-font-size").trim()
    ).to.equal("");
    expect(
      hostStyle.getPropertyValue("--_lr-model-select-trigger-min-height").trim()
    ).to.equal(hostStyle.getPropertyValue("--lr-form-control-height").trim());
    expect(
      hostStyle.getPropertyValue("--_lr-model-select-font-size").trim()
    ).to.equal(
      hostStyle.getPropertyValue("--lr-form-control-font-size").trim()
    );
    // The public knob is still an override point -- adopting the shared ladder moved the values,
    // not the surface.
    el.style.setProperty("--lr-model-select-trigger-min-height", "77px");
    await el.updateComplete;
    expect(getComputedStyle(trigger(el)).minBlockSize).to.equal("77px");
  });
});

describe("selected-state theming tokens", () => {
  it("honours --lr-model-select-option-selected-color on the selected row", async () => {
    const el = (await fixture(html`
      <lr-model-select
        .catalog=${CATALOG}
        style="--lr-model-select-option-selected-color: rgb(1, 2, 3);"
      ></lr-model-select>
    `)) as LyraModelSelect;
    el.value = "mistral";
    el.open = true;
    await el.updateComplete;
    const selected = el.shadowRoot!.querySelector(
      '[part="option"][aria-selected="true"]'
    ) as HTMLElement;
    expect(getComputedStyle(selected).color).to.equal("rgb(1, 2, 3)");
  });

  it("honours --lr-model-select-option-selected-bg on the selected row", async () => {
    const el = (await fixture(html`
      <lr-model-select
        .catalog=${CATALOG}
        style="--lr-model-select-option-selected-bg: rgb(4, 5, 6);"
      ></lr-model-select>
    `)) as LyraModelSelect;
    el.value = "mistral";
    el.open = true;
    await el.updateComplete;
    const selected = el.shadowRoot!.querySelector(
      '[part="option"][aria-selected="true"]'
    ) as HTMLElement;
    expect(getComputedStyle(selected).backgroundColor).to.equal("rgb(4, 5, 6)");
  });

  it("leaves the selected row at the brand color when the token is unset (regression)", async () => {
    const el = (await fixture(
      html`<lr-model-select .catalog=${CATALOG}></lr-model-select>`
    )) as LyraModelSelect;
    el.value = "mistral";
    el.open = true;
    await el.updateComplete;
    const selected = el.shadowRoot!.querySelector(
      '[part="option"][aria-selected="true"]'
    ) as HTMLElement;
    const brand = getComputedStyle(el)
      .getPropertyValue("--lr-color-brand")
      .trim();
    const probe = document.createElement("span");
    probe.style.color = brand;
    document.body.appendChild(probe);
    const expected = getComputedStyle(probe).color;
    document.body.removeChild(probe);
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

  /** Polls a pointer-driven condition for up to 500ms, reporting whether it ever held. Pointer
   *  state lands a variable number of frames after the mouse command resolves, per engine. */
  const settle = async (holds: () => boolean): Promise<boolean> => {
    for (let attempt = 0; attempt < 25; attempt++) {
      if (holds()) return true;
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    return holds();
  };

  const openWithSelectedMiddleRow = async (): Promise<LyraModelSelect> => {
    const el = (await fixture(html`
      <lr-model-select
        .catalog=${CATALOG}
        value="mistral"
        style="--lr-transition-fast: 0s; --lr-model-select-option-active-bg: rgb(1, 2, 3);"
      ></lr-model-select>
    `)) as LyraModelSelect;
    el.open = true;
    await el.updateComplete;
    // The listbox is placed by the Floating UI positioner a tick after the open render, so a
    // getBoundingClientRect() taken before that points the pointer at the pre-placement box.
    await new Promise((resolve) => setTimeout(resolve, 50));
    return el;
  };

  it("keeps the active-descendant highlight visible after arrowing onto the selected row", async () => {
    const el = await openWithSelectedMiddleRow();
    const btn = trigger(el);
    // Driven through the component's own ArrowDown handling rather than by hand-stamping
    // [data-active], so this covers the rendered aria-activedescendant highlight itself.
    let active: HTMLElement | null = null;
    for (let step = 0; step < 5; step++) {
      btn.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "ArrowDown",
          bubbles: true,
          cancelable: true,
        })
      );
      await el.updateComplete;
      active = el.shadowRoot!.querySelector<HTMLElement>(
        '[part="option"][data-active]'
      );
      if (active?.getAttribute("aria-selected") === "true") break;
    }
    expect(
      active?.getAttribute("aria-selected"),
      "arrowing reached the selected row"
    ).to.equal("true");
    expect(
      getComputedStyle(active!).backgroundColor,
      "aria-activedescendant highlight on the selected row"
    ).to.equal("rgb(1, 2, 3)");
  });

  /** Hovers and presses one row of a freshly opened listbox, returning both computed backgrounds
   *  (or null when the engine never put the pointer over the row). One fixture per row on purpose:
   *  releasing the button over an option commits that option and closes the listbox. */
  const measureRow = async (
    pick: (rows: HTMLElement[]) => HTMLElement
  ): Promise<{ hover: string; press: string } | null> => {
    const el = await openWithSelectedMiddleRow();
    const row = pick(
      Array.from(el.shadowRoot!.querySelectorAll<HTMLElement>('[part="option"]'))
    );
    const resting = getComputedStyle(row).backgroundColor;
    try {
      await sendMouse({ type: "move", position: centerOf(row) });
      // Earlier pointer tests in this file can leave Firefox with no document hover state at all
      // until a real pointer entry; an unverified reading would report the fixed cascade as
      // broken again, so report "no pointer" rather than a background.
      if (!(await settle(() => row.matches(":hover")))) return null;
      await settle(() => getComputedStyle(row).backgroundColor !== resting);
      const hover = getComputedStyle(row).backgroundColor;
      await sendMouse({ type: "down" });
      await settle(() => getComputedStyle(row).backgroundColor !== hover);
      return { hover, press: getComputedStyle(row).backgroundColor };
    } finally {
      await sendMouse({ type: "up" });
      await resetMouse();
      el.remove();
    }
  };

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
});

// -- Pointer handling in both modes -----------------------------------------

it("mousedown on the combobox shell focuses the input instead of letting the shell take selection", async () => {
  const el = (await fixture(
    html`<lr-model-select .catalog=${CATALOG} allow-custom></lr-model-select>`
  )) as LyraModelSelect;
  const shell = el.shadowRoot!.querySelector(
    '[part="combobox"]'
  ) as HTMLElement;
  const event = new MouseEvent("mousedown", {
    bubbles: true,
    cancelable: true,
  });
  shell.dispatchEvent(event);
  await el.updateComplete;
  expect(event.defaultPrevented).to.be.true;
  expect(
    el.shadowRoot!.activeElement ===
      el.shadowRoot!.querySelector('[part="combobox-input"]')
  ).to.equal(true);
});

it("preserves the native caret-placement default for a trusted mousedown on the editable input", async () => {
  const el = (await fixture(
    html`<lr-model-select
      .catalog=${CATALOG}
      allow-custom
      value="abcdefghij"
    ></lr-model-select>`
  )) as LyraModelSelect;
  const nativeInput = input(el);
  nativeInput.focus();
  nativeInput.setSelectionRange(0, nativeInput.value.length);
  let trustedMouseDown: MouseEvent | undefined;
  nativeInput.addEventListener("mousedown", (event) => {
    if (event.isTrusted) trustedMouseDown = event;
  });

  const rect = nativeInput.getBoundingClientRect();
  await sendMouse({
    type: "click",
    position: [
      Math.round(rect.right - 4),
      Math.round(rect.top + rect.height / 2),
    ],
  });

  expect(trustedMouseDown?.defaultPrevented).to.equal(false);
  expect(nativeInput.selectionStart).to.equal(nativeInput.selectionEnd);
});

it("mousedown on the combobox shell is inert while disabled", async () => {
  const el = (await fixture(
    html`<lr-model-select
      .catalog=${CATALOG}
      allow-custom
      disabled
    ></lr-model-select>`
  )) as LyraModelSelect;
  const shell = el.shadowRoot!.querySelector(
    '[part="combobox"]'
  ) as HTMLElement;
  const event = new MouseEvent("mousedown", {
    bubbles: true,
    cancelable: true,
  });
  shell.dispatchEvent(event);
  await el.updateComplete;
  expect(event.defaultPrevented).to.be.false;
});

it("prevents mousedown on a listbox option but not on listbox chrome", async () => {
  const el = (await fixture(
    html`<lr-model-select .catalog=${CATALOG}></lr-model-select>`
  )) as LyraModelSelect;
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
  expect(onChrome.defaultPrevented).to.be.false;
});

// -- Degraded-DOM form-association fallback ---------------------------------

describe("ElementInternals fallback (lr-model-select)", () => {
  /** Mirrors a DOM implementation without form-association support (a consumer's happy-dom/Vitest
   *  suite). `attachInternals()` is browser-only, so the component swaps in inert no-op internals
   *  rather than throwing at construction -- every member has to answer, and value changes must
   *  still work with form participation simply unavailable. */
  const withoutAttachInternals = async (
    impl: undefined | (() => never),
    assertion: (el: LyraModelSelect) => void | Promise<void>
  ): Promise<void> => {
    const proto = HTMLElement.prototype as unknown as {
      attachInternals?: unknown;
    };
    const original = proto.attachInternals;
    if (impl === undefined) delete proto.attachInternals;
    else proto.attachInternals = impl;
    try {
      const el = (await fixture(
        html`<lr-model-select .catalog=${CATALOG}></lr-model-select>`
      )) as LyraModelSelect;
      await el.updateComplete;
      await assertion(el);
    } finally {
      proto.attachInternals = original;
    }
  };

  it("answers inertly when attachInternals is missing", async () => {
    await withoutAttachInternals(undefined, async (el) => {
      const internals = (el as unknown as { internals: ElementInternals })
        .internals;
      expect(internals.form === null).to.equal(true);
      expect(internals.willValidate).to.be.false;
      expect(internals.validationMessage).to.equal("");
      expect(internals.checkValidity()).to.be.true;
      expect(internals.reportValidity()).to.be.true;
      expect(() => internals.setFormValue("x")).to.not.throw();
      expect(() => internals.setValidity({}, "")).to.not.throw();
      el.value = "mistral";
      await el.updateComplete;
    });
  });

  it("answers inertly when attachInternals throws", async () => {
    await withoutAttachInternals(
      () => {
        throw new DOMException("unsupported");
      },
      (el) => {
        const internals = (el as unknown as { internals: ElementInternals })
          .internals;
        expect(internals.willValidate).to.be.false;
        expect(internals.reportValidity()).to.be.true;
        expect(internals.checkValidity()).to.be.true;
      }
    );
  });
});

// Not every engine ships CustomStateSet, and `:state()` landed after it in some of them -- these
// guards are why the shared form-associated suite has the same pair, and a test without them fails
// on WebKit rather than reporting an unsupported feature.
const supportsCustomStates = (() => {
  try {
    return typeof CustomStateSet === "function";
  } catch {
    return false;
  }
})();
const supportsStateSelector = (() => {
  try {
    document.createElement("div").matches(":state(x)");
    return true;
  } catch {
    return false;
  }
})();

describe("validity custom states", () => {
  it("publishes required/optional and valid/invalid, matchable with :state()", async function () {
    if (!supportsCustomStates || !supportsStateSelector) this.skip();
    const el = (await fixture(
      html`<lr-model-select
        label="Model"
        .catalog=${CATALOG}
      ></lr-model-select>`
    )) as LyraModelSelect;
    await el.updateComplete;
    expect(el.matches(":state(optional)"), "pristine and not required").to.be
      .true;
    expect(el.matches(":state(required)")).to.be.false;
    expect(el.matches(":state(valid)")).to.be.true;
    expect(el.matches(":state(invalid)")).to.be.false;

    el.required = true;
    await el.updateComplete;
    expect(el.matches(":state(required)")).to.be.true;
    expect(el.matches(":state(optional)")).to.be.false;
    expect(el.matches(":state(invalid)")).to.be.true;
    expect(el.matches(":state(valid)")).to.be.false;

    el.value = "mistral";
    await el.updateComplete;
    expect(el.matches(":state(valid)")).to.be.true;
    expect(el.matches(":state(invalid)")).to.be.false;
  });

  it("withholds user-valid/user-invalid until the user has actually interacted", async function () {
    if (!supportsCustomStates || !supportsStateSelector) this.skip();
    const el = (await fixture(
      html`<lr-model-select
        label="Model"
        required
        .catalog=${CATALOG}
      ></lr-model-select>`
    )) as LyraModelSelect;
    await el.updateComplete;
    // A pristine required picker really is invalid -- but painting it red before the user has done
    // anything is hostile, which is exactly what the user-* pair exists to prevent.
    expect(el.matches(":state(invalid)")).to.be.true;
    expect(el.matches(":state(user-invalid)")).to.be.false;
    expect(el.matches(":state(user-valid)")).to.be.false;

    const control = el.shadowRoot!.querySelector(
      '[part="trigger"]'
    ) as HTMLButtonElement;
    control.focus();
    control.blur();
    await el.updateComplete;
    expect(el.matches(":state(user-invalid)")).to.be.true;
    expect(el.matches(":state(user-valid)")).to.be.false;

    el.value = "mistral";
    await el.updateComplete;
    expect(el.matches(":state(user-valid)")).to.be.true;
    expect(el.matches(":state(user-invalid)")).to.be.false;
  });

  it("counts a reportValidity() call — what a submit attempt runs — as interaction", async function () {
    if (!supportsCustomStates || !supportsStateSelector) this.skip();
    const el = (await fixture(
      html`<lr-model-select
        label="Model"
        required
        .catalog=${CATALOG}
      ></lr-model-select>`
    )) as LyraModelSelect;
    await el.updateComplete;
    expect(el.matches(":state(user-invalid)")).to.be.false;
    el.reportValidity();
    expect(
      el.matches(":state(user-invalid)"),
      "synchronously, not on the next Lit update"
    ).to.be.true;
  });

  it("goes pristine again after a form reset", async function () {
    if (!supportsCustomStates || !supportsStateSelector) this.skip();
    const form = await fixture<HTMLFormElement>(
      html`<form>
        <lr-model-select
          name="model"
          label="Model"
          required
          .catalog=${CATALOG}
        ></lr-model-select>
      </form>`
    );
    const el = form.querySelector("lr-model-select") as LyraModelSelect;
    await el.updateComplete;
    el.reportValidity();
    expect(el.matches(":state(user-invalid)")).to.be.true;
    form.reset();
    await el.updateComplete;
    expect(el.matches(":state(user-invalid)")).to.be.false;
    expect(
      el.matches(":state(invalid)"),
      'still invalid, just no longer "the user saw it"'
    ).to.be.true;
  });
});

describe("setCustomValidity()", () => {
  it("treats an untyped undefined message as clearing the custom error", async () => {
    const el = (await fixture(
      html`<lr-model-select label="Model" .catalog=${CATALOG}></lr-model-select>`
    )) as LyraModelSelect;
    el.setCustomValidity("Rejected");
    (el as unknown as { setCustomValidity(message: undefined): void }).setCustomValidity(undefined);

    expect(el.validity.customError).to.equal(false);
    expect(el.validationMessage).to.equal("");
  });

  it("blocks form submission with a consumer-supplied error, and reports it as validationMessage", async () => {
    const form = await fixture<HTMLFormElement>(
      html`<form>
        <lr-model-select
          name="model"
          label="Model"
          .catalog=${CATALOG}
        ></lr-model-select>
      </form>`
    );
    const el = form.querySelector("lr-model-select") as LyraModelSelect;
    await el.updateComplete;
    let submits = 0;
    // Registered before any requestSubmit() below, so a successful submission can never navigate
    // the test page.
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      submits += 1;
    });
    expect(el.checkValidity(), "valid before the custom error").to.be.true;

    el.setCustomValidity("That model was retired by the provider.");
    expect(el.validity.customError).to.be.true;
    expect(el.checkValidity()).to.be.false;
    expect(el.validationMessage).to.equal(
      "That model was retired by the provider."
    );
    expect(form.checkValidity()).to.be.false;
    form.requestSubmit();
    expect(submits, "a custom error blocks submission").to.equal(0);

    el.setCustomValidity("");
    expect(el.validity.customError).to.be.false;
    expect(el.validationMessage).to.equal("");
    form.requestSubmit();
    expect(
      submits,
      "submission is unblocked once the custom error is cleared"
    ).to.equal(1);
  });

  it("keeps a custom error through an intrinsic revalidation", async () => {
    const el = (await fixture(
      html`<lr-model-select
        label="Model"
        required
        .catalog=${CATALOG}
      ></lr-model-select>`
    )) as LyraModelSelect;
    await el.updateComplete;
    el.setCustomValidity("Rejected by the server.");
    expect(el.validity.customError).to.be.true;

    // Committing a value re-runs updateValidity() -- the traffic that would otherwise wipe the
    // consumer's error out on every change.
    el.value = "mistral";
    await el.updateComplete;
    expect(el.validity.valueMissing, "the intrinsic error cleared").to.be.false;
    expect(
      el.validity.customError,
      "the custom error survived the recomputation"
    ).to.be.true;
    expect(el.validationMessage).to.equal("Rejected by the server.");
    expect(el.checkValidity()).to.be.false;
  });

  it("keeps a custom error across a form reset, matching native setCustomValidity semantics", async () => {
    // Native `form.reset()` restores a control's value and pristine-ness, but never clears a
    // consumer-set custom error -- only another `setCustomValidity('')` does. This control matches.
    const form = await fixture<HTMLFormElement>(
      html`<form>
        <lr-model-select
          name="model"
          label="Model"
          value="mistral"
          .catalog=${CATALOG}
        ></lr-model-select>
      </form>`
    );
    const el = form.querySelector("lr-model-select") as LyraModelSelect;
    await el.updateComplete;
    el.value = "llama3.1";
    el.setCustomValidity("That model is not enabled for your account.");

    form.reset();
    await el.updateComplete;
    expect(el.value, "the reset restored the declarative default").to.equal(
      "mistral"
    );
    expect(el.validity.customError, "the custom error outlives the reset").to.be
      .true;
    expect(el.validationMessage).to.equal(
      "That model is not enabled for your account."
    );
    expect(el.checkValidity()).to.be.false;
  });

  it("restores the computed validity when a custom error is cleared, rather than forcing the control valid", async () => {
    const el = (await fixture(
      html`<lr-model-select
        label="Model"
        required
        .catalog=${CATALOG}
      ></lr-model-select>`
    )) as LyraModelSelect;
    await el.updateComplete;
    expect(el.validity.valueMissing, "required and empty to begin with").to.be
      .true;

    el.setCustomValidity("Rejected by the server.");
    expect(el.validity.customError).to.be.true;

    el.setCustomValidity("");
    expect(el.validity.customError).to.be.false;
    expect(
      el.validity.valueMissing,
      "an empty required picker still has no value"
    ).to.be.true;
    expect(
      el.checkValidity(),
      "clearing the custom error must not force the control valid"
    ).to.be.false;
    expect(
      el.validationMessage.length,
      "the intrinsic message is republished"
    ).to.be.greaterThan(0);
  });

  it("publishes a custom error through the validity custom states", async function () {
    if (!supportsCustomStates || !supportsStateSelector) this.skip();
    const el = (await fixture(
      html`<lr-model-select
        label="Model"
        .catalog=${CATALOG}
        value="mistral"
      ></lr-model-select>`
    )) as LyraModelSelect;
    await el.updateComplete;
    expect(el.matches(":state(valid)"), "valid before the custom error").to.be
      .true;

    el.setCustomValidity("Rejected by the server.");
    expect(
      el.matches(":state(invalid)"),
      "synchronously, not on the next Lit update"
    ).to.be.true;
    expect(el.matches(":state(valid)")).to.be.false;
    expect(
      el.matches(":state(user-invalid)"),
      "still pristine until the user has a turn"
    ).to.be.false;

    el.reportValidity();
    expect(
      el.matches(":state(user-invalid)"),
      "a reported validation counts as interaction"
    ).to.be.true;

    el.setCustomValidity("");
    expect(el.matches(":state(valid)")).to.be.true;
    expect(el.matches(":state(user-valid)")).to.be.true;
    expect(el.matches(":state(user-invalid)")).to.be.false;
  });
});

it("forwards focus and blur to the semantic control in both rendering modes", async () => {
  const el = (await fixture(html`
    <lr-model-select
      label="Model"
      .models=${CATALOG}
      value="mistral"
    ></lr-model-select>
  `)) as LyraModelSelect;
  await el.updateComplete;
  el.focus();
  expect(el.shadowRoot!.activeElement != null).to.equal(true);
  el.blur();
  expect(el.shadowRoot!.activeElement === null).to.equal(true);

  const disabled = (await fixture(html`
    <lr-model-select
      label="Model"
      disabled
      .models=${CATALOG}
    ></lr-model-select>
  `)) as LyraModelSelect;
  await disabled.updateComplete;
  disabled.focus();
  expect(disabled.shadowRoot!.activeElement === null).to.equal(true);
  disabled.blur();
  expect(disabled.shadowRoot!.activeElement === null).to.equal(true);
});

it("paints the shared required marker on the label, and lets a consumer retune or suppress it", async () => {
  const el = (await fixture(html`
    <lr-model-select
      label="Model"
      required
      .catalog=${CATALOG}
    ></lr-model-select>
  `)) as LyraModelSelect;
  await el.updateComplete;
  const label = el.shadowRoot!.querySelector(
    '[part="form-control-label"]'
  ) as HTMLElement;
  expect(getComputedStyle(label, "::after").content).to.contain("*");

  // The three knobs the shared sheet publishes are what make the glyph translatable, retunable and
  // suppressible -- a hardcoded `content: ' *'` left a consumer nowhere to say any of that.
  el.style.setProperty("--lr-form-control-required-content", '" (required)"');
  el.style.setProperty("--lr-form-control-required-color", "rgb(1, 2, 3)");
  await el.updateComplete;
  expect(getComputedStyle(label, "::after").content).to.contain("required");
  expect(getComputedStyle(label, "::after").color).to.equal("rgb(1, 2, 3)");

  el.style.setProperty("--lr-form-control-required-content", '""');
  await el.updateComplete;
  expect(
    getComputedStyle(label, "::after").content.replace(/["']/g, "")
  ).to.equal("");
});

it("leaves the required marker off an optional picker", async () => {
  const el = (await fixture(html`
    <lr-model-select label="Model" .catalog=${CATALOG}></lr-model-select>
  `)) as LyraModelSelect;
  await el.updateComplete;
  const label = el.shadowRoot!.querySelector(
    '[part="form-control-label"]'
  ) as HTMLElement;
  expect(getComputedStyle(label, "::after").content).to.not.contain("*");
});

it("bars constraint validation while disabled, natively and in the published states", async function () {
  if (!supportsCustomStates || !supportsStateSelector) this.skip();
  const el = (await fixture(html`
    <lr-model-select
      label="Model"
      required
      disabled
      .catalog=${CATALOG}
    ></lr-model-select>
  `)) as LyraModelSelect;
  await el.updateComplete;
  // A native `<input required disabled>` matches neither `:valid` nor `:invalid`; publishing
  // `invalid`/`user-invalid` from one is what painted every disabled required field red.
  expect(el.checkValidity(), "a barred control reports no violation").to.be
    .true;
  expect(el.matches(":state(invalid)")).to.be.false;
  expect(el.matches(":state(user-invalid)")).to.be.false;
  expect(el.matches(":state(valid)")).to.be.false;
  expect(
    el.matches(":state(required)"),
    "required/optional describe the attribute, not the outcome"
  ).to.be.true;

  el.disabled = false;
  await el.updateComplete;
  expect(el.checkValidity()).to.be.false;
  expect(el.matches(":state(invalid)")).to.be.true;
});

it("emits a cancelable lr-invalid alias whose cancellation cancels the native invalid event", async () => {
  const el = (await fixture(html`
    <lr-model-select
      label="Model"
      required
      .catalog=${CATALOG}
    ></lr-model-select>
  `)) as LyraModelSelect;
  await el.updateComplete;
  const aliases: CustomEvent[] = [];
  const nativePrevented: boolean[] = [];
  el.addEventListener("lr-invalid", (event) =>
    aliases.push(event as CustomEvent)
  );
  // Registered after the alias relay's own constructor-installed `invalid` listener, so it reads
  // the native event exactly as the relay left it.
  el.addEventListener("invalid", (event) =>
    nativePrevented.push(event.defaultPrevented)
  );

  expect(el.checkValidity()).to.be.false;
  expect(aliases).to.have.lengthOf(1);
    expect(aliases[0]!.cancelable, "lr-invalid is a real veto point").to.be.true;
  expect(nativePrevented).to.deep.equal([false]);

  el.addEventListener("lr-invalid", (event) => event.preventDefault(), {
    once: true,
  });
  expect(el.checkValidity()).to.be.false;
  expect(
    nativePrevented,
    "preventDefault() on lr-invalid suppresses the native validation bubble"
  ).to.deep.equal([false, true]);
});

describe("explicitly empty host aria-label", () => {
  it("keeps the closed-mode trigger explicitly unnamed instead of substituting the generic fallback", async () => {
    const explicit = (await fixture(
      html`<lr-model-select aria-label="" .catalog=${CATALOG}></lr-model-select>`
    )) as LyraModelSelect;
    await explicit.updateComplete;
    const trigger = explicit.shadowRoot!.querySelector('[part="trigger"]')!;
    expect(trigger.hasAttribute("aria-label")).to.equal(true);
    expect(trigger.getAttribute("aria-label")).to.equal("");

    const omitted = (await fixture(
      html`<lr-model-select .catalog=${CATALOG}></lr-model-select>`
    )) as LyraModelSelect;
    await omitted.updateComplete;
    expect(
      omitted.shadowRoot!.querySelector('[part="trigger"]')!.getAttribute("aria-label")
    ).to.equal("Model");
  });

  it("keeps the free-text combobox input explicitly unnamed instead of substituting the generic fallback", async () => {
    const explicit = (await fixture(
      html`<lr-model-select allow-custom aria-label="" .catalog=${CATALOG}></lr-model-select>`
    )) as LyraModelSelect;
    await explicit.updateComplete;
    const input = explicit.shadowRoot!.querySelector('[part="combobox-input"]')!;
    expect(input.hasAttribute("aria-label")).to.equal(true);
    expect(input.getAttribute("aria-label")).to.equal("");

    const omitted = (await fixture(
      html`<lr-model-select allow-custom .catalog=${CATALOG}></lr-model-select>`
    )) as LyraModelSelect;
    await omitted.updateComplete;
    expect(
      omitted.shadowRoot!.querySelector('[part="combobox-input"]')!.getAttribute("aria-label")
    ).to.equal("Model");
  });
});
