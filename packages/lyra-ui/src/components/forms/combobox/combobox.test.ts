// Focused interaction and event contracts cases. Test bodies and titles were moved intact from the prior suite.
import { fixture, expect, oneEvent, html, aTimeout, waitUntil } from "@open-wc/testing";
import { LitElement, type PropertyValues } from "lit";
import "./combobox.js";
import "./option.js";
import "../input/input.js";
import "../select/select.js";
import "../button/button.js";
import "../token-input/token-input.js";
import "../color-picker/color-picker.js";
import "../../layout/segmented/segmented.js";
import type { ComboboxSourceRow, LyraCombobox } from "./combobox.js";
import type { LyraOption } from "./option.js";
import type { LyraColorPicker } from "../color-picker/color-picker.js";
import { styles } from "./combobox.styles.js";
import { resetMouse, sendMouse } from "../../../../test/wtr-mouse.js";
import { chooseOption } from "../../../testing/interaction-drivers.js";
import { RESET_OPTION_SELECTED_FROM_OWNER, SET_OPTION_SELECTED_FROM_OWNER } from "../../../internal/option-selection.js";
import { __setAnchoredOverlayRuntimeLoaderForTesting, type AnchoredOverlayRuntime } from '../../../internal/anchored-overlay-runtime.js';
import "../../../translations/ar/forms.js";
import "../../../translations/ar/shared.js";

const requiredItem = <T>(items: ArrayLike<T>, index: number, description: string): T => {
  const item = items[index];
  if (item === undefined) throw new Error(`Missing ${description} at index ${index}.`);
  return item;
};

function positionedRuntime(onPlace?: () => void): AnchoredOverlayRuntime {
  return {
    place: (_anchor, _popup, options = {}) => {
      onPlace?.();
      queueMicrotask(() => options.onPlaced?.({ placement: options.placement ?? 'bottom-start' }));
      return () => undefined;
    },
  } as AnchoredOverlayRuntime;
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

async function affectedStatusTexts(overrides: {
  loadingText: string;
  emptyText: string;
  overflowText: string;
}): Promise<string[]> {
  const strings = {
    loading: "Chargement…",
    noMatches: "Aucun résultat",
    comboboxOverflow: "+{n} de plus",
  };
  const loading = (await fixture(
    html`<lr-combobox .strings=${strings}></lr-combobox>`
  )) as LyraCombobox;
  Object.assign(loading, overrides);
  loading.source = () => new Promise(() => {});
  loading.open = true;
  await loading.updateComplete;
  await aTimeout(250);
  await loading.updateComplete;

  const empty = (await fixture(
    html`<lr-combobox open .strings=${strings}></lr-combobox>`
  )) as LyraCombobox;
  Object.assign(empty, overrides);
  await empty.updateComplete;

  const overflow = (await fixture(
    html`<lr-combobox open max-render="3" .strings=${strings}>
      <lr-option value="0">Item 0</lr-option>
      <lr-option value="1">Item 1</lr-option>
      <lr-option value="2">Item 2</lr-option>
      <lr-option value="3">Item 3</lr-option>
    </lr-combobox>`
  )) as LyraCombobox;
  Object.assign(overflow, overrides);
  await overflow.updateComplete;

  return [
    loading.shadowRoot!.querySelector(".loading")!.textContent!.trim(),
    empty.shadowRoot!.querySelector(".empty")!.textContent!.trim(),
    overflow
      .shadowRoot!.querySelector('[part="option-overflow"]')!
      .textContent!.trim(),
  ];
}

it('keeps the first-open listbox hidden and defers after-show until positioning is ready', async () => {
  let resolveRuntime!: (runtime: AnchoredOverlayRuntime) => void;
  const pendingRuntime = new Promise<AnchoredOverlayRuntime>((resolve) => {
    resolveRuntime = resolve;
  });
  __setAnchoredOverlayRuntimeLoaderForTesting(() => pendingRuntime);
  try {
    const el = await fixture<LyraCombobox>(basic());
    el.style.setProperty('--show-duration', '0ms');
    let afterShow = false;
    el.addEventListener('lr-after-show', () => {
      afterShow = true;
    });
    const shown = el.show();
    await el.updateComplete;
    const listbox = el.shadowRoot!.querySelector<HTMLElement>('[part="listbox"]')!;

    expect(getComputedStyle(listbox).visibility).to.equal('hidden');
    expect(afterShow).to.equal(false);
    resolveRuntime(positionedRuntime());
    await shown;

    expect(getComputedStyle(listbox).visibility).to.equal('visible');
    expect(afterShow).to.equal(true);
  } finally {
    __setAnchoredOverlayRuntimeLoaderForTesting(undefined);
  }
});

it('closes after a positioning runtime failure even when ordinary hide is vetoed', async () => {
  __setAnchoredOverlayRuntimeLoaderForTesting(() => Promise.reject(new Error('positioning unavailable')));
  try {
    const el = await fixture<LyraCombobox>(basic());
    el.style.setProperty('--show-duration', '0ms');
    el.style.setProperty('--hide-duration', '0ms');
    const cancelable: boolean[] = [];
    const vetoHide = (event: Event) => {
      cancelable.push(event.cancelable);
      event.preventDefault();
    };
    el.addEventListener('lr-hide', vetoHide);
    const afterHide = oneEvent(el, 'lr-after-hide');
    const shown = el.show();
    await Promise.all([shown, afterHide]);
    expect(cancelable).to.deep.equal([false]);
    expect(el.open, 'a failed positioning runtime cannot leave the listbox open').to.equal(false);
    expect(el.hasAttribute('open')).to.equal(false);
    expect(el.shadowRoot!.querySelector<HTMLElement>('[part="listbox"]')!.hidden).to.equal(true);

    __setAnchoredOverlayRuntimeLoaderForTesting(() => Promise.resolve(positionedRuntime()));
    await el.show();
    await el.hide();
    expect(cancelable).to.deep.equal([false, true]);
    expect(el.open, 'ordinary dismissal remains vetoable after recovery').to.equal(true);
    el.removeEventListener('lr-hide', vetoHide);
    await el.hide();
  } finally {
    __setAnchoredOverlayRuntimeLoaderForTesting(undefined);
  }
});

it('invalidates a deferred listbox generation when disconnected before the runtime loads', async () => {
  let resolveRuntime!: (runtime: AnchoredOverlayRuntime) => void;
  const pendingRuntime = new Promise<AnchoredOverlayRuntime>((resolve) => {
    resolveRuntime = resolve;
  });
  let placeCalls = 0;
  __setAnchoredOverlayRuntimeLoaderForTesting(() => pendingRuntime);
  try {
    const el = await fixture<LyraCombobox>(basic());
    void el.show();
    await el.updateComplete;
    el.remove();
    resolveRuntime(positionedRuntime(() => placeCalls++));
    await Promise.resolve();
    await Promise.resolve();

    expect(placeCalls).to.equal(0);
  } finally {
    __setAnchoredOverlayRuntimeLoaderForTesting(undefined);
  }
});

it("collects an option constructed by a same-origin foreign custom-element realm", async () => {
  const frame = document.createElement("iframe");
  document.body.append(frame);
  const frameWindow = frame.contentWindow;
  const frameDocument = frame.contentDocument;
  if (!frameWindow || !frameDocument) {
    frame.remove();
    throw new Error("The iframe realm was unavailable.");
  }

  class ForeignOption extends frameWindow.HTMLElement {
    value = "foreign";
    label = "Foreign option";
    selected = true;
    defaultSelected = false;

    [SET_OPTION_SELECTED_FROM_OWNER](selected: boolean): void {
      this.selected = selected;
    }

    [RESET_OPTION_SELECTED_FROM_OWNER](selected: boolean): void {
      this.selected = selected;
    }
  }

  frameWindow.customElements.define("lr-option", ForeignOption);
  const foreign = frameDocument.createElement("lr-option");
  const el = await fixture<LyraCombobox>(html`<lr-combobox></lr-combobox>`);
  try {
    const LocalOption = customElements.get("lr-option")!;
    expect(
      foreign instanceof LocalOption,
      "the fixture must not satisfy the ambient class guard"
    ).to.equal(false);
    el.append(document.adoptNode(foreign));
    await aTimeout(0);
    await el.updateComplete;

    expect(el.value).to.equal("foreign");
  } finally {
    frame.remove();
  }
});

it("exposes exactly one composed InputEvent when the user types", async () => {
  const el = (await fixture(basic())) as LyraCombobox;
  const inputEvents: Event[] = [];
  let changeCount = 0;
  el.addEventListener("input", (event) => inputEvents.push(event));
  el.addEventListener("change", () => changeCount++);

  await typeQuery(el, "ban");

  expect(inputEvents.length).to.equal(1);
  const inputEvent = requiredItem(inputEvents, 0, 'input event');
  if (!(inputEvent instanceof InputEvent)) throw new Error('The relayed input was not an InputEvent.');
  expect(inputEvent.constructor.name).to.equal("InputEvent");
  expect(inputEvent.bubbles).to.be.true;
  expect(inputEvent.composed).to.be.true;
  expect(inputEvent.cancelable).to.be.false;
  expect((inputEvent.target as Element).localName).to.equal("lr-combobox");
  expect(inputEvent.data).to.equal("ban");
  expect(inputEvent.inputType).to.equal("insertText");
  expect(inputEvent.isComposing).to.be.false;
  expect(changeCount).to.equal(0);
});

it("emits one native input/change pair, in order, when a row changes the selection", async () => {
  const el = (await fixture(basic())) as LyraCombobox;
  el.open = true;
  await el.updateComplete;
  const events: Event[] = [];
  el.addEventListener("input", (event) => events.push(event));
  el.addEventListener("change", (event) => events.push(event));

  (
    el.shadowRoot!.querySelectorAll('[part="option"]')[1] as HTMLElement
  ).click();

  expect(events.map((event) => event.type)).to.deep.equal(["input", "change"]);
  expect(events.map((event) => event.constructor.name)).to.deep.equal([
    "CustomEvent",
    "CustomEvent",
  ]);
  expect(events.every((event) => event.bubbles && event.composed)).to.be.true;
  expect(events.every((event) => !event.cancelable)).to.be.true;
});

it("emits one native input/change pair for keyboard selection", async () => {
  const el = (await fixture(basic())) as LyraCombobox;
  const input = el.shadowRoot!.querySelector(
    '[part="combobox-input"]'
  ) as HTMLInputElement;
  input.focus();
  el.open = true;
  await el.updateComplete;
  const events: Event[] = [];
  el.addEventListener("input", (event) => events.push(event));
  el.addEventListener("change", (event) => events.push(event));

  input.dispatchEvent(
    new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true })
  );
  input.dispatchEvent(
    new KeyboardEvent("keydown", { key: "Enter", bubbles: true })
  );

  expect(events.map((event) => event.type)).to.deep.equal(["input", "change"]);
  expect(events.map((event) => event.constructor.name)).to.deep.equal([
    "CustomEvent",
    "CustomEvent",
  ]);
});

it("emits one native input/change pair for both adding and toggling off a multiple value", async () => {
  const el = (await fixture(basic())) as LyraCombobox;
  el.multiple = true;
  el.open = true;
  await el.updateComplete;
  const events: Event[] = [];
  el.addEventListener("input", (event) => events.push(event));
  el.addEventListener("change", (event) => events.push(event));

  (
    el.shadowRoot!.querySelectorAll('[part="option"]')[0] as HTMLElement
  ).click();
  expect(events.map((event) => event.type)).to.deep.equal(["input", "change"]);
  expect(events.map((event) => event.constructor.name)).to.deep.equal([
    "CustomEvent",
    "CustomEvent",
  ]);

  events.length = 0;
  await el.updateComplete;
  (
    el.shadowRoot!.querySelectorAll('[part="option"]')[0] as HTMLElement
  ).click();
  expect(events.map((event) => event.type)).to.deep.equal(["input", "change"]);
  expect(events.map((event) => event.constructor.name)).to.deep.equal([
    "CustomEvent",
    "CustomEvent",
  ]);
});

it("emits the same native input/change pair when a selected tag is removed", async () => {
  const el = (await fixture(basic())) as LyraCombobox;
  el.multiple = true;
  el.value = ["a", "b"];
  await el.updateComplete;
  const events: Event[] = [];
  el.addEventListener("input", (event) => events.push(event));
  el.addEventListener("change", (event) => events.push(event));

  (
    el.shadowRoot!.querySelector(
      '[part="tag__remove-button"]'
    ) as HTMLButtonElement
  ).click();

  expect(events.map((event) => event.type)).to.deep.equal(["input", "change"]);
  expect(events.map((event) => event.constructor.name)).to.deep.equal([
    "CustomEvent",
    "CustomEvent",
  ]);
  expect(events.every((event) => !event.cancelable)).to.be.true;
});

it("removes only the clicked occurrence of a duplicate-valued tag, not every occurrence", async () => {
  const el = (await fixture(basic())) as LyraCombobox;
  el.multiple = true;
  el.value = ["a", "a", "b"];
  await el.updateComplete;

  const removeButtons = [
    ...el.shadowRoot!.querySelectorAll<HTMLButtonElement>(
      '[part="tag__remove-button"]'
    ),
  ];
  expect(removeButtons.length).to.equal(3);
  removeButtons[0]!.click();
  await el.updateComplete;

  expect(el.value).to.deep.equal(["a", "b"]);
});

it("Backspace on an empty query removes only the last occurrence of a duplicate-valued tag", async () => {
  const el = (await fixture(basic())) as LyraCombobox;
  el.multiple = true;
  el.value = ["a", "b", "a"];
  await el.updateComplete;
  const input = el.shadowRoot!.querySelector(
    '[part="combobox-input"]'
  ) as HTMLInputElement;
  input.dispatchEvent(
    new KeyboardEvent("keydown", { key: "Backspace", bubbles: true, composed: true })
  );
  await el.updateComplete;

  expect(el.value).to.deep.equal(["a", "b"]);
});

it("emits the native input/change pair when Backspace removes the last tag", async () => {
  const el = (await fixture(basic())) as LyraCombobox;
  el.multiple = true;
  el.value = ["a"];
  await el.updateComplete;
  const input = el.shadowRoot!.querySelector(
    '[part="combobox-input"]'
  ) as HTMLInputElement;
  const events: Event[] = [];
  el.addEventListener("input", (event) => events.push(event));
  el.addEventListener("change", (event) => events.push(event));

  input.dispatchEvent(
    new KeyboardEvent("keydown", { key: "Backspace", bubbles: true })
  );

  expect(el.value).to.deep.equal([]);
  expect(events.map((event) => event.type)).to.deep.equal(["input", "change"]);
});

it("emits one input/change pair and one lr-clear event when cleared", async () => {
  const el = (await fixture(basic())) as LyraCombobox;
  el.withClear = true;
  el.value = "a";
  await el.updateComplete;
  const events: Event[] = [];
  el.addEventListener("input", (event) => events.push(event));
  el.addEventListener("change", (event) => events.push(event));
  el.addEventListener("lr-clear", (event) => events.push(event));

  (
    el.shadowRoot!.querySelector('[part="clear-button"]') as HTMLButtonElement
  ).click();

  expect(events.map((event) => event.type)).to.deep.equal([
    "input",
    "change",
    "lr-clear",
  ]);
  expect(
    events.slice(0, 2).map((event) => event.constructor.name)
  ).to.deep.equal(["CustomEvent", "CustomEvent"]);
  expect(events.slice(0, 2).every((event) => !event.cancelable)).to.be.true;
});

it("does not emit input/change for programmatic values or re-picking the current single value", async () => {
  const el = (await fixture(basic())) as LyraCombobox;
  let eventCount = 0;
  el.addEventListener("input", () => eventCount++);
  el.addEventListener("change", () => eventCount++);

  el.value = "a";
  await el.updateComplete;
  el.open = true;
  await el.updateComplete;
  (
    el.shadowRoot!.querySelectorAll('[part="option"]')[0] as HTMLElement
  ).click();

  expect(eventCount).to.equal(0);
});

it("keeps a programmatic value write silent on lr-change too, not just input/change", async () => {
  const el = (await fixture(basic())) as LyraCombobox;
  let count = 0;
  for (const type of ["input", "change", "lr-change"]) {
    el.addEventListener(type, () => count++);
  }
  el.value = "a";
  await el.updateComplete;
  el.multiple = true;
  el.value = ["a", "b"];
  await el.updateComplete;
  expect(count).to.equal(0);
});

it("keeps programmatic multiple-value writes silent", async () => {
  const el = (await fixture(basic())) as LyraCombobox;
  el.multiple = true;
  let eventCount = 0;
  el.addEventListener("input", () => eventCount++);
  el.addEventListener("change", () => eventCount++);

  el.value = ["a", "b"];
  await el.updateComplete;

  expect(eventCount).to.equal(0);
});

it("filters options and emits change on select (single)", async () => {
  const el = (await fixture(basic())) as LyraCombobox;
  el.open = true;
  await el.updateComplete;

  await typeQuery(el, "ban");
  const rows = el.shadowRoot!.querySelectorAll('[part="option"]');
  expect(rows.length).to.equal(1);

  setTimeout(() => (rows[0] as HTMLElement).click());
  await oneEvent(el, "change");
  expect(el.value).to.equal("b");
});

it("supports multiple selection with tags and array value", async () => {
  const el = (await fixture(basic())) as LyraCombobox;
  el.multiple = true;
  el.open = true;
  await el.updateComplete;

  const rows = () => el.shadowRoot!.querySelectorAll('[part="option"]');
  (rows()[0] as HTMLElement).click();
  await el.updateComplete;
  (rows()[2] as HTMLElement).click();
  await el.updateComplete;

  expect(el.value).to.deep.equal(["a", "c"]);
  expect(el.shadowRoot!.querySelectorAll('[part="tag"]').length).to.equal(2);
});

it("removes a value via its tag button", async () => {
  const el = (await fixture(basic())) as LyraCombobox;
  el.multiple = true;
  el.value = ["a", "b"];
  await el.updateComplete;

  const removeBtn = el.shadowRoot!.querySelector(
    '[part="tag__remove-button"]'
  ) as HTMLButtonElement;
  removeBtn.click();
  await el.updateComplete;
  expect(el.value).to.deep.equal(["b"]);
});

it("clears the value with the clear button", async () => {
  const el = (await fixture(basic())) as LyraCombobox;
  el.withClear = true;
  el.value = "a";
  await el.updateComplete;

  const clear = el.shadowRoot!.querySelector(
    '[part="clear-button"]'
  ) as HTMLButtonElement;
  setTimeout(() => clear.click());
  await oneEvent(el, "lr-clear");
  expect(el.value).to.equal("");
});

it("opens the listbox on ArrowUp when closed, same as ArrowDown", async () => {
  const el = (await fixture(basic())) as LyraCombobox;
  const input = el.shadowRoot!.querySelector(
    '[part="combobox-input"]'
  ) as HTMLInputElement;
  expect(el.open).to.be.false;

  input.dispatchEvent(
    new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true })
  );
  await el.updateComplete;
  expect(el.open).to.be.true;
});

it("selects with keyboard (ArrowDown + Enter)", async () => {
  const el = (await fixture(basic())) as LyraCombobox;
  const input = el.shadowRoot!.querySelector(
    '[part="combobox-input"]'
  ) as HTMLInputElement;
  input.focus();
  el.open = true;
  await el.updateComplete;

  input.dispatchEvent(
    new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true })
  );
  await el.updateComplete;
  input.dispatchEvent(
    new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true })
  );
  await el.updateComplete;
  setTimeout(() =>
    input.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", bubbles: true })
    )
  );
  await oneEvent(el, "change");
  expect(el.value).to.equal("b");
});

it("forwards selection editing methods to the native input and handles an empty name", async () => {
  const el = (await fixture(basic())) as LyraCombobox;
  const input = el.shadowRoot!.querySelector(
    '[part="combobox-input"]'
  ) as HTMLInputElement;
  input.value = "Apple";
  input.setSelectionRange(1, 3);

  el.selectionStart = 0;
  el.selectionEnd = 2;
  el.selectionDirection = "backward";
  expect(el.selectionStart).to.equal(0);
  expect(el.selectionEnd).to.equal(2);
  expect(el.selectionDirection).to.equal("backward");

  el.setRangeText("X");
  expect(input.value).to.equal("Xple");
  expect((el as unknown as { query: string }).query).to.equal("Xple");

  el.name = "fruit";
  expect(el.getAttribute("name")).to.equal("fruit");
  el.name = "";
  expect(el.hasAttribute("name")).to.be.false;

  el.name = "fruit";
  el.name = null as unknown as string;
  expect(el.name).to.equal("");
  expect(el.hasAttribute("name")).to.be.false;
});

it("keeps the native editing facade safe before the internal input exists", () => {
  const el = document.createElement("lr-combobox") as LyraCombobox;

  expect(el.input === null).to.be.true;
  expect(el.selectionStart).to.equal(null);
  expect(el.selectionEnd).to.equal(null);
  expect(el.selectionDirection).to.equal(undefined);
  expect(() => {
    el.selectionStart = 0;
    el.selectionEnd = 0;
    el.selectionDirection = "forward";
    el.setSelectionRange(0, 0);
    el.setRangeText("ignored");
  }).to.not.throw();
});

it("resolves selectedRows from local rows and uncached async rows", async () => {
  const el = (await fixture(basic())) as LyraCombobox;
  el.value = "a";
  const state = el as unknown as {
    _selectedRowCache: Map<string, unknown>;
    asyncRows: Array<{ value: string; label: string }>;
  };
  state._selectedRowCache.clear();
  expect(el.selectedRows[0]?.value).to.equal("a");

  el.value = "remote";
  state._selectedRowCache.clear();
  state.asyncRows = [{ value: "remote", label: "Remote" }];
  expect(el.selectedRows[0]?.label).to.equal("Remote");
});

it('carries a light-DOM option\'s opaque data payload by reference through selectedRows', async () => {
  const payload = { record: 'b' };
  const el = (await fixture(basic())) as LyraCombobox;
  const option = el.querySelectorAll('lr-option')[1] as LyraOption;
  option.data = payload;
  el.value = 'b';
  await el.updateComplete;

  expect(el.selectedRows[0]?.data).to.equal(payload);
});

it('leaves selectedRows[].data undefined for an option with no data set', async () => {
  const el = (await fixture(basic())) as LyraCombobox;
  el.value = 'a';
  await el.updateComplete;

  expect(el.selectedRows[0]?.data).to.equal(undefined);
});

it('surfaces each newly committed row\'s data by reference in the change/input event details', async () => {
  const payload = { record: 'b' };
  const el = (await fixture(basic())) as LyraCombobox;
  const option = el.querySelectorAll('lr-option')[1] as LyraOption;
  option.data = payload;
  el.open = true;
  await el.updateComplete;

  const seen: unknown[] = [];
  for (const type of ['input', 'change', 'lr-change']) {
    el.addEventListener(type, (e) => seen.push((e as CustomEvent<{ data: unknown[] }>).detail.data));
  }
  (el.shadowRoot!.querySelectorAll('[part="option"]')[1] as HTMLElement).click();
  await el.updateComplete;

  expect(seen.length).to.equal(3);
  for (const data of seen) {
    expect((data as unknown[])[0]).to.equal(payload);
  }
});

it('keeps selectedRows-derived event data index-aligned with value when a stale committed value has no live option/row', async () => {
  const payload = { record: 'b' };
  const el = (await fixture(basic())) as LyraCombobox;
  const option = el.querySelectorAll('lr-option')[1] as LyraOption;
  option.data = payload;
  el.multiple = true;
  // A stale committed value that currently matches no live option -- see `isUnknownValue()`.
  el.value = ['stale'];
  await el.updateComplete;
  el.open = true;
  await el.updateComplete;

  const seen: unknown[][] = [];
  for (const type of ['input', 'change', 'lr-change']) {
    el.addEventListener(type, (e) => seen.push((e as CustomEvent<{ data: unknown[] }>).detail.data));
  }
  (el.shadowRoot!.querySelectorAll('[part="option"]')[1] as HTMLElement).click();
  await el.updateComplete;

  expect(el.value).to.deep.equal(['stale', 'b']);
  // `data` stays the same length as `value`: the stale value's own slot is `undefined`, never
  // dropped, so `b`'s payload lands at index 1 -- not shifted into index 0.
  expect(seen.length).to.equal(3);
  for (const data of seen) {
    expect(data.length).to.equal(2);
    expect(data[0]).to.equal(undefined);
    expect(data[1]).to.equal(payload);
  }
});

it('maps writable selectedRows onto current local values without user-change events', async () => {
  const el = (await fixture(basic())) as LyraCombobox;
  el.multiple = true;
  el.value = ['a', 'b'];
  await el.updateComplete;
  const rows = el.selectedRows;
  el.value = [];
  const events: string[] = [];
  for (const type of ['input', 'change', 'lr-input', 'lr-change']) {
    el.addEventListener(type, () => events.push(type));
  }

  el.selectedRows = [
    rows[1]!,
    { value: 'detached', label: 'Detached' },
    rows[0]!,
    rows[1]!,
  ];
  await el.updateComplete;

  expect(el.value).to.deep.equal(['b', 'a']);
  expect(el.selectedRows.map((row) => row.value)).to.deep.equal(['b', 'a']);
  expect(events, 'controlled structured selection stays silent').to.deep.equal([]);

  el.multiple = false;
  el.selectedRows = [rows[0]!, rows[1]!];
  await el.updateComplete;
  expect(el.value, 'single mode keeps the first current row').to.equal('a');

  (el as unknown as { selectedRows: unknown }).selectedRows = null;
  await el.updateComplete;
  expect(el.value, 'a non-array write clears selection').to.equal('');
  expect(events).to.deep.equal([]);
});

it('defers an initial selectedRows property binding until local options are collected', async () => {
  const selected: ComboboxSourceRow[] = [{ value: 'b', label: 'Caller copy' }];
  const el = (await fixture(html`
    <lr-combobox multiple .selectedRows=${selected}>
      <lr-option value="a">Apple</lr-option>
      <lr-option value="b">Banana</lr-option>
    </lr-combobox>
  `)) as LyraCombobox;
  await el.updateComplete;

  expect(el.value).to.deep.equal(['b']);
  expect(el.selectedRows.map((row) => row.label)).to.deep.equal(['Banana']);
});

it('canonicalizes writable selectedRows against the current async source', async () => {
  const payload = { kind: 'city' };
  const sourceRows: ComboboxSourceRow[] = [
    { value: 'lux', label: 'Luxembourg', data: payload },
    { value: 'par', label: 'Paris', data: { kind: 'city' } },
  ];
  const el = (await fixture(
    html`<lr-combobox source-delay="0" open></lr-combobox>`,
  )) as LyraCombobox;
  el.source = async () => sourceRows;
  await waitUntil(
    () => el.shadowRoot!.querySelectorAll('[part="option"]').length === 2,
    'the async source rows did not render',
  );

  el.selectedRows = [sourceRows[0]!, { value: 'unknown', label: 'Unknown' }];
  await el.updateComplete;

  expect(el.value).to.equal('lux');
  expect(el.selectedRows).to.have.length(1);
  expect(el.selectedRows[0]!.label).to.equal('Luxembourg');
  expect(el.selectedRows[0]!.data).to.equal(payload);
  expect(el.selectedRows[0]).to.not.equal(sourceRows[0]);
});

it('warms a closed async source to resolve an initial selectedRows binding', async () => {
  const payload = { kind: 'city' };
  const sourceRows: ComboboxSourceRow[] = [
    { value: 'lux', label: 'Luxembourg', data: payload },
  ];
  let sourceCalls = 0;
  const el = (await fixture(html`
    <lr-combobox
      source-delay="0"
      .selectedRows=${[sourceRows[0]!]}
      .source=${async () => {
        sourceCalls += 1;
        return sourceRows;
      }}
    ></lr-combobox>
  `)) as LyraCombobox;

  await waitUntil(() => el.value === 'lux', 'the deferred async selection did not resolve');

  expect(el.open).to.equal(false);
  expect(sourceCalls).to.equal(1);
  expect(el.selectedRows[0]!.data).to.equal(payload);
});

it("switches the submitted single/multiple representation synchronously", async () => {
  const form = (await fixture(
    html` <form><lr-combobox name="tags"></lr-combobox></form> `
  )) as HTMLFormElement;
  const el = form.querySelector("lr-combobox") as LyraCombobox;
  el.value = ["a", "b"];
  expect(new FormData(form).getAll("tags")).to.deep.equal(["a"]);

  el.multiple = true;
  expect(el.hasAttribute("multiple")).to.be.true;
  expect(new FormData(form).getAll("tags")).to.deep.equal(["a", "b"]);

  el.multiple = false;
  expect(el.hasAttribute("multiple")).to.be.false;
  expect(new FormData(form).getAll("tags")).to.deep.equal(["a"]);
});

it("seeds the initial selection from a declaratively-selected <lr-option>", async () => {
  const el = (await fixture(html`
    <lr-combobox>
      <lr-option value="a">Apple</lr-option>
      <lr-option value="b" selected>Banana</lr-option>
    </lr-combobox>
  `)) as LyraCombobox;
  await el.updateComplete;
  expect(el.value).to.equal("b");
});

it("keeps only the first declared default selected when a single combobox resets", async () => {
  const form = (await fixture(html`
    <form>
      <lr-combobox name="fruit">
        <lr-option value="a" selected>Apple</lr-option>
        <lr-option value="b" selected>Banana</lr-option>
      </lr-combobox>
    </form>
  `)) as HTMLFormElement;
  const el = form.querySelector("lr-combobox") as LyraCombobox;
  const options = [...el.querySelectorAll("lr-option")];
  await el.updateComplete;

  el.value = "b";
  form.reset();

  expect(el.value).to.equal("a");
  expect(options.map((option) => option.selected)).to.deep.equal([true, false]);
});

it("applies post-mount defaultSelected changes to a pristine live selection", async () => {
  const el = (await fixture(
    html` <lr-combobox><lr-option value="a">Apple</lr-option></lr-combobox> `
  )) as LyraCombobox;
  const option = el.querySelector("lr-option")!;
  await el.updateComplete;
  expect(el.value).to.equal("");

  option.defaultSelected = true;
  await option.updateComplete;
  await el.updateComplete;
  expect(el.value).to.equal("a");
  expect(option.selected).to.equal(true);

  option.defaultSelected = false;
  await option.updateComplete;
  await el.updateComplete;
  expect(el.value).to.equal("");
  expect(option.selected).to.equal(false);
});

describe('collecting already-slotted options without relying on the initial slotchange', () => {
  it('populates options and lets chooseOption() succeed when the initial slotchange is suppressed (simulating happy-dom)', async () => {
    // happy-dom (through at least 20.14.5) never fires `slotchange` for a slot's INITIAL
    // assignment. This suite runs in a real browser, which DOES fire it -- so to reproduce the
    // happy-dom condition deterministically here, swallow that one event with a capture-phase
    // listener on the render root: capture-phase fires on the way down to the <slot> itself,
    // before the slot's own bubble-phase `@slotchange` binding (`collectOptions`) ever sees it.
    const a = document.createElement('lr-option') as LyraOption;
    a.value = 'a';
    a.textContent = 'Apple';
    const b = document.createElement('lr-option') as LyraOption;
    b.value = 'b';
    b.textContent = 'Banana';
    const el = document.createElement('lr-combobox') as LyraCombobox;
    el.append(a, b);
    document.body.append(el);
    // Synchronously after connect: `renderRoot` already exists (created in the constructor,
    // before the first render), well before the browser can dispatch the initial event.
    let intercepted = 0;
    el.renderRoot!.addEventListener(
      'slotchange',
      (e) => {
        intercepted++;
        e.stopImmediatePropagation();
      },
      { capture: true, once: true }
    );
    try {
      await el.updateComplete;
      // Give a real initial slotchange (queued around slot assignment) time to arrive and be
      // swallowed, so the assertions below only see whatever `firstUpdated()` alone collected.
      await aTimeout(50);
      expect(
        intercepted,
        "a real browser does fire the slot's initial slotchange -- this test suppresses it to reproduce happy-dom, which never fires it at all"
      ).to.equal(1);
      const values = Array.from(
        el.renderRoot!.querySelectorAll<HTMLElement>('[part="option"]')
      ).map((row) => row.dataset['value']);
      expect(
        values,
        "firstUpdated() collected the already-slotted options and rendered a row per option, with no slotchange ever reaching the component's own listener"
      ).to.deep.equal(['a', 'b']);
      await chooseOption(el, 'b');
      expect(el.value).to.equal('b');
    } finally {
      el.remove();
    }
  });

  it('is idempotent: a real slotchange landing on top of the firstUpdated() collection does not double-apply declarative selection', async () => {
    // No interception here -- both `firstUpdated()`'s own call and the real, un-suppressed
    // initial `slotchange` fire for the same batch. The diagnostic listener below proves the
    // second (real) firing actually happened, so this test exercises the double-invocation path
    // it claims to, rather than accidentally passing because the browser only fired the event
    // once (or fixture timing let `firstUpdated()` win a race that never actually repeats).
    const a = document.createElement('lr-option') as LyraOption;
    a.value = 'a';
    a.textContent = 'Apple';
    const b = document.createElement('lr-option') as LyraOption;
    b.value = 'b';
    b.textContent = 'Banana';
    b.selected = true;
    const el = document.createElement('lr-combobox') as LyraCombobox;
    el.append(a, b);
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
        'the real initial slotchange must actually have fired for this to prove anything about double-invocation'
      ).to.be.greaterThan(0);
      // Same outcome as the suppressed-event test above: one seeded selection, no duplicated
      // rows, no thrown error from a second pass over an already-known element set.
      expect(el.value, 'the declaratively-selected option wins, exactly once').to.equal('b');
      const values = Array.from(
        el.renderRoot!.querySelectorAll<HTMLElement>('[part="option"]')
      ).map((row) => row.dataset['value']);
      expect(values).to.deep.equal(['a', 'b']);
    } finally {
      el.remove();
    }
  });
});

it('uses a dirty property-only selected write to seed the initial single-select value', async () => {
  const el = (await fixture(html`
    <lr-combobox>
      <lr-option value="a" .selected=${true}>Apple</lr-option>
      <lr-option value="b">Banana</lr-option>
    </lr-combobox>
  `)) as LyraCombobox;
  await el.updateComplete;
  expect(el.value).to.equal("a");
});

it('falls back to declarative selection when a dirty property write left nothing selected initially', async () => {
  const el = (await fixture(html`
    <lr-combobox>
      <lr-option value="a" .selected=${false}>Apple</lr-option>
      <lr-option value="b" selected>Banana</lr-option>
    </lr-combobox>
  `)) as LyraCombobox;
  await el.updateComplete;
  expect(el.value).to.equal("b");
});

it('marks the value dirty from an initial property-only deselect that selects nothing, blocking a later default', async () => {
  // Unlike the "falls back to declarative selection" case above, no sibling option is
  // declaratively selected here -- so the dirty-but-unselected write leaves `initial` empty and
  // the `if (optionDirty) this._valueDirty = true;` fallback (rather than an early return from a
  // selection write) is what has to mark the value dirty.
  const el = (await fixture(html`
    <lr-combobox>
      <lr-option value="a" .selected=${false}>Apple</lr-option>
    </lr-combobox>
  `)) as LyraCombobox;
  await el.updateComplete;
  expect(el.value).to.equal("");

  const option = el.querySelector("lr-option")!;
  option.defaultSelected = true;
  await option.updateComplete;
  await el.updateComplete;
  expect(
    el.value,
    "the initial dirty write already marked the value dirty, so a later default must not override it"
  ).to.equal("");
});

it("keeps a late-slotted default selection pristine for subsequent default changes", async () => {
  const el = (await fixture(html`<lr-combobox></lr-combobox>`)) as LyraCombobox;
  await el.updateComplete;

  const option = document.createElement("lr-option");
  option.value = "d";
  option.textContent = "Date";
  option.defaultSelected = true;
  el.append(option);
  await aTimeout(0);
  await el.updateComplete;
  expect(el.value).to.equal("d");

  option.defaultSelected = false;
  await option.updateComplete;
  await el.updateComplete;
  expect(el.value).to.equal("");
  expect(option.selected).to.equal(false);
});

it("retains a defaultSelected refresh when the parent detaches during option notification", async () => {
  const form = (await fixture(html`
    <form>
      <lr-combobox name="fruit"
        ><lr-option value="a">Apple</lr-option></lr-combobox
      >
    </form>
  `)) as HTMLFormElement;
  const el = form.querySelector("lr-combobox") as LyraCombobox;
  const option = el.querySelector("lr-option")!;
  await el.updateComplete;

  option.addEventListener("lr-option-change", () => el.remove(), {
    once: true,
  });
  option.defaultSelected = true;
  await option.updateComplete;
  await Promise.resolve();
  form.append(el);
  await el.updateComplete;

  expect(el.value).to.equal("a");
  el.value = "";
  form.reset();
  expect(el.value).to.equal("a");
});

it("uses shared svg icons instead of literal glyphs for chevron, clear, and tag-remove", async () => {
  const el = (await fixture(basic())) as LyraCombobox;
  el.multiple = true;
  el.withClear = true;
  el.value = ["a"];
  await el.updateComplete;

  const expandIcon = el.shadowRoot!.querySelector(
    '[part="expand-icon"]'
  ) as HTMLElement;
  expect(expandIcon.querySelector("svg") !== null).to.be.true;
  expect(expandIcon.textContent?.trim()).to.equal("");

  const clearBtn = el.shadowRoot!.querySelector(
    '[part="clear-button"]'
  ) as HTMLElement;
  expect(clearBtn.querySelector("svg") !== null).to.be.true;
  expect(clearBtn.textContent?.trim()).to.equal("");

  const removeBtn = el.shadowRoot!.querySelector(
    '[part="tag__remove-button"]'
  ) as HTMLElement;
  expect(removeBtn.querySelector("svg") !== null).to.be.true;
  expect(removeBtn.textContent?.trim()).to.equal("");

  // The chevron is rotated to a "down" glyph via its wrapping part, not the svg itself.
  expect(styles.cssText).to.match(/\[part=["']expand-icon["']\]\s+svg/);
});

it("keeps gap/radius defaults private and consumes inherited public hooks first", () => {
  const css = styles.cssText.replace(/\s+/g, " ");
  expect(css).to.match(
    /:host \{[^}]*--_lr-combobox-gap: var\(--lr-space-xs\);/
  );
  expect(css).to.match(
    /:host \{[^}]*--_lr-combobox-radius: var\(--lr-form-control-radius\);/
  );
  expect(css).to.include(
    "gap: var(--lr-combobox-gap, var(--_lr-combobox-gap));"
  );
  expect(css).to.include(
    "border-radius: var(--lr-combobox-radius, var(--_lr-combobox-radius));"
  );
});

it("hides the error and hint parts when empty, shows them once populated", async () => {
  const el = (await fixture(basic())) as LyraCombobox;
  await el.updateComplete;

  const errorPart = el.shadowRoot!.querySelector(
    '[part="error"]'
  ) as HTMLElement;
  const hintPart = el.shadowRoot!.querySelector('[part="hint"]') as HTMLElement;
  // Neither part can rely on `:empty` — each always contains a literal
  // `<slot>` child element, so `:empty` never matches regardless of
  // assigned/text content (same bug class fixed for lr-stat).
  expect(getComputedStyle(errorPart).display).to.equal("none");
  expect(getComputedStyle(hintPart).display).to.equal("none");

  el.errorText = "Selection required";
  el.hint = "Pick a fruit";
  await el.updateComplete;
  expect(getComputedStyle(errorPart).display).to.not.equal("none");
  expect(getComputedStyle(hintPart).display).to.not.equal("none");
});

it("does not mark touched from a blur caused by the control itself becoming disabled", async () => {
  // Regression test: disabling a focused native form control forces
  // a browser blur that is plain native HTML behavior, not a real user interaction, and must not
  // flip the interaction-tracking `touched` state (the same fix already landed on <lr-input>'s own
  // onBlur).
  const el = (await fixture(basic())) as LyraCombobox;
  const input = el.shadowRoot!.querySelector(
    '[part="combobox-input"]'
  ) as HTMLInputElement;
  input.focus();
  expect(el.shadowRoot!.activeElement === input).to.be.true;

  el.disabled = true;
  await el.updateComplete;

  expect(el.hasAttribute("disabled")).to.be.true;
  expect((el as unknown as { touched: boolean }).touched).to.be.false;
});

it('ignores a synthetic focus event on the input while disabled instead of relaying it or reopening', async () => {
  const el = (await fixture(basic())) as LyraCombobox;
  el.disabled = true;
  await el.updateComplete;
  const input = el.shadowRoot!.querySelector(
    '[part="combobox-input"]'
  ) as HTMLInputElement;

  let hostFocusCount = 0;
  el.addEventListener("focus", () => {
    hostFocusCount += 1;
  });
  input.dispatchEvent(
    new FocusEvent("focus", { bubbles: true, composed: true })
  );
  await el.updateComplete;

  expect(el.open, "focus while disabled must not open the listbox").to.be
    .false;
  expect(
    hostFocusCount,
    "the focus event must not be relayed to the host while disabled"
  ).to.equal(0);
});

it('ignores keyboard navigation on the input while disabled', async () => {
  const el = (await fixture(basic())) as LyraCombobox;
  el.disabled = true;
  await el.updateComplete;
  const input = el.shadowRoot!.querySelector(
    '[part="combobox-input"]'
  ) as HTMLInputElement;

  input.dispatchEvent(
    new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true })
  );
  await el.updateComplete;

  expect(el.open, "ArrowDown must not open the listbox while disabled").to.be
    .false;
});

it("still marks touched from a real blur unrelated to the control becoming disabled", async () => {
  const el = (await fixture(basic())) as LyraCombobox;
  const input = el.shadowRoot!.querySelector(
    '[part="combobox-input"]'
  ) as HTMLInputElement;
  input.focus();
  input.blur();

  expect((el as unknown as { touched: boolean }).touched).to.be.true;
});

it("applies the shared focus-ring tokens to the clear and tag-remove buttons", () => {
  const css = styles.cssText;
  const clearFocusBlock =
    /\[part=['"]?clear-button['"]?]:focus-visible,\s*\[part=['"]?tag__remove-button['"]?]:focus-visible\s*{([^}]*)}/.exec(
      css
    );
  expect(
    clearFocusBlock,
    "expected a shared clear/tag-remove :focus-visible rule"
  ).to.not.equal(null);
  expect(clearFocusBlock![1]).to.include("var(--lr-focus-ring-width)");
  expect(clearFocusBlock![1]).to.include("var(--lr-focus-ring-color)");
});

it("sanitizes maxOptionsVisible/maxRender to finite non-negative integers instead of poisoning the row cap/tag cap with NaN", async () => {
  const el = (await fixture(html`<lr-combobox></lr-combobox>`)) as LyraCombobox;

  el.maxOptionsVisible = NaN;
  expect(el.maxOptionsVisible).to.equal(3); // falls back to the documented default

  el.maxOptionsVisible = -5;
  expect(el.maxOptionsVisible).to.equal(0); // clamped to the non-negative floor

  el.maxRender = NaN;
  expect(el.maxRender).to.equal(200); // falls back to the documented default

  el.maxRender = -5;
  expect(el.maxRender).to.equal(0); // clamped to the non-negative floor

  el.maxRender = Number.MAX_SAFE_INTEGER;
  expect(el.maxRender).to.equal(1000); // bounded resource ceiling, not an effectively-unlimited scan
  el.maxRender = 0;

  // A capped-to-0 maxRender must not crash renderRows()/renderedRows -- rendering falls through to
  // the empty-listbox message (no rows survive the 0-sized cap), rather than throwing.
  const opt = document.createElement("lr-option");
  opt.value = "0";
  opt.textContent = "Item 0";
  el.appendChild(opt);
  el.open = true;
  expect(async () => await el.updateComplete).to.not.throw();
  await el.updateComplete;
  expect(el.shadowRoot!.querySelectorAll('[part="option"]').length).to.equal(0);
});

it("caps rendered rows at maxRender and shows an overflow indicator", async () => {
  const el = (await fixture(
    html`<lr-combobox max-render="3"></lr-combobox>`
  )) as LyraCombobox;
  for (let i = 0; i < 10; i++) {
    const opt = document.createElement("lr-option");
    opt.value = `${i}`;
    opt.textContent = `Item ${i}`;
    el.appendChild(opt);
  }
  el.open = true;
  await el.updateComplete;

  expect(el.shadowRoot!.querySelectorAll('[part="option"]').length).to.equal(3);
  expect(
    el.shadowRoot!.querySelector('[part="option-overflow"]')!.textContent
  ).to.contain("+7 more");
});

it("keeps a create action in a capped filtered list and reports only hidden option rows as overflow", async () => {
  const el = (await fixture(html`
    <lr-combobox allow-create max-render="1">
      <lr-option value="a">Apple</lr-option>
      <lr-option value="b">Banana</lr-option>
      <lr-option value="c">Cherry</lr-option>
    </lr-combobox>
  `)) as LyraCombobox;
  // An application-owned filter can keep contextual options visible while the
  // entered value is still new and therefore eligible for creation.
  el.filter = () => true;

  await typeQuery(el, "Dragonfruit");

  expect(el.shadowRoot!.querySelectorAll('[part="option"]')).to.have.length(2);
  expect(el.shadowRoot!.querySelector("[data-create]")?.textContent).to.contain(
    "Dragonfruit"
  );
  expect(
    el.shadowRoot!.querySelector('[part="option-overflow"]')!.textContent
  ).to.contain("+2 more");
});

it("always keeps the current selection visible even when capped out", async () => {
  const el = (await fixture(
    html`<lr-combobox max-render="3"></lr-combobox>`
  )) as LyraCombobox;
  for (let i = 0; i < 10; i++) {
    const opt = document.createElement("lr-option");
    opt.value = `${i}`;
    opt.textContent = `Item ${i}`;
    el.appendChild(opt);
  }
  el.value = "9";
  el.open = true;
  await el.updateComplete;

  const rows = Array.from(el.shadowRoot!.querySelectorAll('[part="option"]'));
  expect(rows.some((r) => r.textContent?.includes("Item 9"))).to.be.true;
});

it("passes a hard limit to sources and exposes truthful envelope totals/truncation", async () => {
  const el = (await fixture(
    html`<lr-combobox source-delay="0"></lr-combobox>`
  )) as LyraCombobox;
  let receivedLimit = 0;
  el.source = async (_query, options) => {
    receivedLimit = options.limit;
    return {
      rows: [
        { value: "a", label: "Alpha" },
        { value: "b", label: "Beta" },
      ],
      total: 5_000,
    };
  };
  el.open = true;
  await waitUntil(
    () => el.sourceTotal === 5_000,
    "bounded source response never settled"
  );
  await el.updateComplete;

  expect(receivedLimit).to.equal(2_000);
  expect(el.sourceTruncated).to.be.true;
  expect(el.shadowRoot!.querySelectorAll('[part="option"]')).to.have.length(2);
  expect(
    el.shadowRoot!.querySelector('[part="option-overflow"]')!.textContent
  ).to.contain("+4,998 more");
});

it("shows a loading row while an in-flight source call is pending", async () => {
  const el = (await fixture(
    html`<lr-combobox source-delay="500"></lr-combobox>`
  )) as LyraCombobox;
  let resolve!: (rows: { value: string; label: string }[]) => void;
  el.source = () => new Promise((r) => (resolve = r));
  el.open = true;
  await el.updateComplete;
  await waitUntil(
    () => el.shadowRoot!.querySelector(".loading") !== null,
    "loading state was not rendered after the source debounce",
    { timeout: 2000 }
  );

  // Resolving the source promise only fires the `.then()` -> set asyncRows -> `.finally()` ->
  // set loading=false chain on later microtask ticks (`.finally()` is itself a `.then()` under
  // the hood), so a single already-scheduled `updateComplete` await can resolve before that
  // chain -- and the render it triggers -- has actually run. `aTimeout(0)` forces a macrotask
  // boundary that lets all of those microtasks (and the resulting Lit update) drain first.
  resolve([{ value: "x", label: "Found" }]);
  await aTimeout(0);
  await el.updateComplete;

  // Boolean-cast rather than `.to.not.exist` on the live element: if this ever regresses, chai/
  // loupe formatting a failing HTMLElement can stall long enough to blow through the test
  // runner's timeout, hiding the real assertion failure behind a misleading "did not finish" hang.
  expect(!!el.shadowRoot!.querySelector(".loading")).to.equal(false);
});

it("ignores a stale source response that resolves after a newer query", async () => {
  const el = (await fixture(html`<lr-combobox></lr-combobox>`)) as LyraCombobox;
  const resolvers: Array<(rows: { value: string; label: string }[]) => void> =
    [];
  el.source = () => new Promise((r) => resolvers.push(r));
  el.open = true;
  await el.updateComplete;
  await aTimeout(250);

  await typeQuery(el, "second");
  await aTimeout(250);

  expect(resolvers).to.have.length(2);
  requiredItem(resolvers, 0, 'stale source resolver')([{ value: "stale", label: "Stale result" }]);
  await aTimeout(0);
  await el.updateComplete;
  requiredItem(resolvers, 1, 'fresh source resolver')([{ value: "fresh", label: "Fresh result" }]);
  // See the comment in the "shows a loading row" test above: resolving triggers a `.then()` ->
  // set asyncRows -> render chain that needs a macrotask boundary to fully settle before a
  // subsequent `updateComplete` reliably reflects it.
  await aTimeout(0);
  await el.updateComplete;

  // `.trim()`: `[part="option-label"]`'s textContent includes the template's own whitespace
  // (it wraps the label in a nested `<span>` alongside a conditional `sub` span), so comparing
  // the raw textContent against a bare label string was never actually going to match.
  const labels = Array.from(
    el.shadowRoot!.querySelectorAll('[part="option-label"]')
  ).map((n) => n.textContent?.trim());
  expect(labels).to.deep.equal(["Fresh result"]);
});

it("registers the click-outside listener and fires lr-show/lr-hide when `open` is set directly, bypassing show()/hide()", async () => {
  const el = (await fixture(basic())) as LyraCombobox;
  await el.updateComplete;

  setTimeout(() => {
    el.open = true;
  });
  await oneEvent(el, "lr-show");
  await el.updateComplete;
  expect(el.open).to.be.true;

  // A pointerdown anywhere outside the element must still dismiss it, even
  // though `show()` (which normally registers the listener) was never called.
  setTimeout(() => {
    document.dispatchEvent(
      new PointerEvent("pointerdown", { bubbles: true, composed: true })
    );
  });
  await oneEvent(el, "lr-hide");
  expect(el.open).to.be.false;
});

it("closes the listbox on a pointerdown outside the element after it was opened via focus", async () => {
  const el = (await fixture(basic())) as LyraCombobox;
  const input = el.shadowRoot!.querySelector(
    '[part="combobox-input"]'
  ) as HTMLInputElement;
  input.dispatchEvent(new FocusEvent("focus"));
  await el.updateComplete;
  expect(el.open).to.be.true;

  document.dispatchEvent(
    new PointerEvent("pointerdown", { bubbles: true, composed: true })
  );
  await el.updateComplete;
  expect(el.open).to.be.false;
});

it('keeps the listbox open for a pointerdown whose composed path targets the combobox itself', async () => {
  // Distinct from the mousedown-on-[part=combobox] coverage elsewhere: `onDocPointer` listens for
  // 'pointerdown' specifically, so this proves the document-level listener's own
  // `composedPath().includes(this)` early return, not `onComboMouseDown`'s separate guard.
  const el = (await fixture(basic())) as LyraCombobox;
  const input = el.shadowRoot!.querySelector(
    '[part="combobox-input"]'
  ) as HTMLInputElement;
  input.dispatchEvent(new FocusEvent("focus"));
  await el.updateComplete;
  expect(el.open).to.be.true;

  input.dispatchEvent(
    new PointerEvent("pointerdown", { bubbles: true, composed: true })
  );
  await el.updateComplete;
  expect(
    el.open,
    "a pointerdown that composes back to the host itself must not be treated as outside"
  ).to.be.true;
});

it("shares visual order and topmost dismissal with other managed nonmodal overlays", async () => {
  const root = (await fixture(html`
    <div>
      <lr-color-picker label="Accent"></lr-color-picker>
      ${basic()}
      <button id="outside" type="button">Outside</button>
    </div>
  `)) as HTMLElement;
  const color = root.querySelector("lr-color-picker") as LyraColorPicker;
  const combo = root.querySelector("lr-combobox") as LyraCombobox;
  const outside = root.querySelector("#outside") as HTMLButtonElement;
  const input = combo.shadowRoot!.querySelector(
    '[part="combobox-input"]'
  ) as HTMLInputElement;
  const listbox = combo.shadowRoot!.querySelector(
    '[part="listbox"]'
  ) as HTMLElement;

  color.open = true;
  await color.updateComplete;
  input.focus();
  combo.open = true;
  await combo.updateComplete;
  await aTimeout(0);
  const comboOverlay = (
    combo as unknown as {
      overlayHandle?: { isActive(): boolean; isTopmost(): boolean };
    }
  ).overlayHandle;
  expect(comboOverlay?.isActive()).to.be.true;
  expect(comboOverlay?.isTopmost()).to.be.true;

  const colorStack = Number.parseInt(
    color.style.getPropertyValue("--lr-overlay-stack-index"),
    10
  );
  const comboStack = Number.parseInt(
    combo.style.getPropertyValue("--lr-overlay-stack-index"),
    10
  );
  expect(Number.isFinite(colorStack)).to.be.true;
  expect(comboStack).to.be.greaterThan(colorStack);
  expect(Number.parseInt(getComputedStyle(listbox).zIndex, 10)).to.equal(
    comboStack
  );

  input.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "Escape",
      bubbles: true,
      composed: true,
    })
  );
  await combo.updateComplete;
  await color.updateComplete;
  expect(combo.open, "Escape closes only the newest overlay").to.be.false;
  expect(color.open, "the older overlay remains open").to.be.true;

  combo.open = true;
  await combo.updateComplete;
  outside.dispatchEvent(
    new PointerEvent("pointerdown", { bubbles: true, composed: true })
  );
  outside.focus();
  await combo.updateComplete;
  await color.updateComplete;
  expect(combo.open, "outside pointer closes only the newest overlay").to.be
    .false;
  expect(
    color.open,
    "the older overlay remains open after the same pointer event"
  ).to.be.true;
  // The combobox closed while focus sat on the pressed outside control, not in its listbox, so the
  // manager must leave that focus alone instead of pulling it into the older overlay beneath.
  expect(
    document.activeElement === outside,
    "the pressed outside control keeps focus"
  ).to.be.true;
  expect(
    color.shadowRoot!.activeElement === null,
    "the surviving overlay beneath does not take focus"
  ).to.be.true;

  color.open = false;
  await color.updateComplete;

  combo.open = true;
  await combo.updateComplete;
  color.open = true;
  await color.updateComplete;
  await aTimeout(0);
  const reverseComboStack = Number.parseInt(
    combo.style.getPropertyValue("--lr-overlay-stack-index"),
    10
  );
  const reverseColorStack = Number.parseInt(
    color.style.getPropertyValue("--lr-overlay-stack-index"),
    10
  );
  const colorPanel = color.shadowRoot!.querySelector(
    '[part~="panel"]'
  ) as HTMLElement;
  expect(reverseColorStack).to.be.greaterThan(reverseComboStack);
  expect(Number.parseInt(getComputedStyle(colorPanel).zIndex, 10)).to.equal(
    reverseColorStack
  );

  document.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "Escape",
      bubbles: true,
      cancelable: true,
    })
  );
  await color.updateComplete;
  await combo.updateComplete;
  expect(color.open, "reverse order Escape closes only the newest color picker")
    .to.be.false;
  expect(combo.open, "reverse order leaves the older combobox open").to.be.true;

  combo.open = false;
  await combo.updateComplete;
});

it('returns automatic focus handling to the surviving older combobox when a newer stacked overlay dismisses via outside pointer', async () => {
  const root = (await fixture(html`
    <div>
      ${basic()}
      <lr-color-picker label="Accent"></lr-color-picker>
      <button id="outside" type="button">Outside</button>
    </div>
  `)) as HTMLElement;
  const combo = root.querySelector("lr-combobox") as LyraCombobox;
  const color = root.querySelector("lr-color-picker") as LyraColorPicker;
  const outside = root.querySelector("#outside") as HTMLButtonElement;

  // Deliberately never focuses the combobox's own input: color-picker grabs real DOM focus for
  // itself as soon as it activates (its `activatePanel()` calls `focusInitial()` unconditionally),
  // and a real blur of the combobox's input closes it immediately (`onInputBlur`) -- unrelated to
  // the outside-pointer/overlay-stack behavior this test targets.
  combo.open = true;
  await combo.updateComplete;
  color.open = true;
  await color.updateComplete;
  await aTimeout(0);

  outside.dispatchEvent(
    new PointerEvent("pointerdown", { bubbles: true, composed: true })
  );
  await combo.updateComplete;
  await color.updateComplete;

  expect(
    color.open,
    "outside pointer dismisses only the newest, topmost overlay"
  ).to.be.false;
  expect(
    combo.open,
    "the older combobox underneath stays open and resumes stack ownership"
  ).to.be.true;

  combo.open = false;
  await combo.updateComplete;
});

it("seeds the selection from a <lr-option selected> appended after the initial slotchange", async () => {
  const el = (await fixture(basic())) as LyraCombobox;
  await el.updateComplete;
  expect(el.value).to.equal("");

  const opt = document.createElement("lr-option");
  opt.setAttribute("value", "d");
  opt.textContent = "Date";
  opt.selected = true;
  el.appendChild(opt);
  // slotchange fires on its own microtask queue -- force a macrotask
  // boundary (see the source-debounce tests above) before asserting.
  await aTimeout(0);
  await el.updateComplete;

  expect(el.value).to.equal("d");
  expect(opt.selected).to.be.true;
});

it("clears the pending debounced source timer on disconnect so a detached element never invokes a stale fetch", async () => {
  const el = (await fixture(html`<lr-combobox></lr-combobox>`)) as LyraCombobox;
  let called = false;
  el.source = async () => {
    called = true;
    return [];
  };
  await typeQuery(el, "ban");
  el.remove();
  await aTimeout(250);
  expect(called).to.be.false;
});

it('caps visible tags at maxOptionsVisible and shows a "+N" overflow tag', async () => {
  const el = (await fixture(html`
    <lr-combobox multiple max-options-visible="2">
      <lr-option value="a">Apple</lr-option>
      <lr-option value="b">Banana</lr-option>
      <lr-option value="c">Cherry</lr-option>
      <lr-option value="d">Date</lr-option>
    </lr-combobox>
  `)) as LyraCombobox;
  el.value = ["a", "b", "c", "d"];
  await el.updateComplete;

  // [part~=] because the overflow tag now carries both 'tag' and 'tag-overflow'.
  const tags = el.shadowRoot!.querySelectorAll('[part~="tag"]');
  expect(tags.length).to.equal(3);
  const overflowTag = requiredItem(tags, 2, 'overflow tag');
  expect(overflowTag.getAttribute('part')).to.equal('tag tag-overflow');
  expect(overflowTag.textContent?.trim()).to.equal("+2 more");
});

it("shows the empty-state message with a custom emptyText when no rows match", async () => {
  const el = (await fixture(basic())) as LyraCombobox;
  el.emptyText = "Nothing here";
  el.open = true;
  await el.updateComplete;

  await typeQuery(el, "zzz");
  const empty = el.shadowRoot!.querySelector(".empty");
  expect(empty !== null).to.be.true;
  expect(empty!.textContent).to.equal("Nothing here");
});

// (covered by the emptyText test above).
it("resolves the loading message through .strings when loadingText is unset", async () => {
  const el = (await fixture(
    html`<lr-combobox .strings=${{ loading: "Chargement…" }}></lr-combobox>`
  )) as LyraCombobox;
  el.source = () => new Promise(() => {});
  el.open = true;
  await el.updateComplete;
  await aTimeout(250);
  await el.updateComplete;

  expect(el.shadowRoot!.querySelector(".loading")!.textContent).to.equal(
    "Chargement…"
  );
});

it("resolves the no-matches message through .strings when emptyText is unset", async () => {
  const el = (await fixture(
    html`<lr-combobox
      .strings=${{ noMatches: "Aucun résultat" }}
    ></lr-combobox>`
  )) as LyraCombobox;
  el.open = true;
  await el.updateComplete;

  expect(el.shadowRoot!.querySelector(".empty")!.textContent).to.equal(
    "Aucun résultat"
  );
});

it("resolves the overflow indicator through .strings, interpolating {n}, when overflowText is unset", async () => {
  const el = (await fixture(
    html`<lr-combobox
      max-render="3"
      .strings=${{ comboboxOverflow: "+{n} de plus" }}
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
  ).to.contain("+7 de plus");
});

it("keeps explicit built-in status text ahead of .strings and still interpolates {n}", async () => {
  expect(
    await affectedStatusTexts({
      loadingText: "Loading…",
      emptyText: "No matches",
      overflowText: "+{n} more — refine your search",
    })
  ).to.deep.equal(["Loading…", "No matches", "+1 more — refine your search"]);
});

it("keeps explicit empty status text empty", async () => {
  expect(
    await affectedStatusTexts({
      loadingText: "",
      emptyText: "",
      overflowText: "",
    })
  ).to.deep.equal(["", "", ""]);
});

it('normalizes a numeric badge and a disabled flag from an async source row', async () => {
  const el = (await fixture(html`<lr-combobox></lr-combobox>`)) as LyraCombobox;
  el.source = async () => [
    {
      value: "a",
      label: "Alpha",
      badge: 42,
      disabled: true,
      dotColor: "#ff0000",
      group: "Greek",
    },
    { value: "b", label: "Beta" },
  ];
  el.open = true;
  await el.updateComplete;
  await aTimeout(250);
  await el.updateComplete;

  const rows = [...el.shadowRoot!.querySelectorAll('[part="option"]')];
  expect(rows.length).to.equal(2);
  const alpha = rows[0]!;
  expect(alpha.querySelector('[part="option-badge"]')?.textContent).to.equal(
    "42"
  );
  expect(alpha.getAttribute("aria-disabled")).to.equal("true");
  expect(rows[1]!.getAttribute("aria-disabled")).to.equal("false");
  expect(alpha.querySelector('[part="option-dot"]')).to.exist;
  expect(
    el.shadowRoot!.querySelector('[part="group-label"]')?.textContent
  ).to.equal("Greek");
});

it('throws on a non-array, non-{rows} source result instead of silently accepting it', async () => {
  const el = (await fixture(
    html`<lr-combobox source-delay="0" open></lr-combobox>`
  )) as LyraCombobox;
  const originalWarn = console.warn;
  console.warn = () => {};
  try {
    el.source = async () => "not a valid envelope" as unknown as never;
    await el.updateComplete;
    await aTimeout(20);
    await el.updateComplete;

    expect(
      el.shadowRoot!.querySelector(".source-error") !== null,
      "a malformed (non-array, non-object) result fails closed"
    ).to.equal(true);
  } finally {
    console.warn = originalWarn;
  }
});

it('stops accepting rows once the cumulative text ceiling is exceeded, truncating the rest', async () => {
  const el = (await fixture(html`<lr-combobox></lr-combobox>`)) as LyraCombobox;
  const bigValue = "v".repeat(4000);
  const bigLabel = "l".repeat(4000);
  // 8,000 units/row; the 250,000-unit ceiling (MAX_SOURCE_TEXT_UNITS) is crossed partway through
  // 40 rows, so the tail must be dropped by the accumulator's `break`, not merely capped by count.
  const hugeRowSet = Array.from({ length: 40 }, (_, i) => ({
    value: `${bigValue}${i}`,
    label: bigLabel,
  }));
  el.source = async () => hugeRowSet;
  el.open = true;
  await el.updateComplete;
  await aTimeout(250);
  await el.updateComplete;

  expect(
    el.sourceTotal,
    "the provider-reported total is preserved even though rows were dropped"
  ).to.equal(40);
  expect(
    el.shadowRoot!.querySelectorAll('[part="option"]').length,
    "rows past the text-unit ceiling must not be retained"
  ).to.be.lessThan(40);
  expect(el.sourceTruncated).to.be.true;
});

it("retains a loaded async row when its value is selected programmatically before a later query omits it", async () => {
  const el = (await fixture(html`<lr-combobox></lr-combobox>`)) as LyraCombobox;
  const payload = { kind: "city", longitude: 6.13 };
  el.source = async (query) =>
    query ? [] : [{ value: "lux", label: "Luxembourg", data: payload }];
  el.open = true;
  await el.updateComplete;
  await aTimeout(250);
  await el.updateComplete;

  el.value = "lux";
  await el.updateComplete;
  await typeQuery(el, "elsewhere");
  await aTimeout(250);
  await el.updateComplete;

  expect(el.selectedRows).to.have.length(1);
  expect(el.selectedRows[0]!.data).to.equal(payload);
});

it("closes the listbox when the input blurs (e.g. tabbing away), not just on outside click or Escape", async () => {
  const el = (await fixture(basic())) as LyraCombobox;
  const input = el.shadowRoot!.querySelector(
    '[part="combobox-input"]'
  ) as HTMLInputElement;
  input.dispatchEvent(new FocusEvent("focus"));
  await el.updateComplete;
  expect(el.open).to.be.true;

  input.dispatchEvent(new FocusEvent("blur"));
  await el.updateComplete;
  expect(el.open).to.be.false;
});

it("ignores a mousedown on the combobox container while disabled", async () => {
  const el = (await fixture(basic())) as LyraCombobox;
  el.disabled = true;
  await el.updateComplete;

  const container = el.shadowRoot!.querySelector(
    '[part="combobox"]'
  ) as HTMLElement;
  container.dispatchEvent(
    new MouseEvent("mousedown", { bubbles: true, cancelable: true })
  );
  await el.updateComplete;

  expect(el.open).to.be.false;
});

it("reflects `name` onto the attribute synchronously, with no await/microtask in between", async () => {
  // `reflect: true` alone defers the attribute write to Lit's async update
  // cycle (a microtask), not the property setter itself -- so
  // `el.name = 'b'; new FormData(form)` (no `await` in between) could still
  // observe the stale attribute. The hand-written `name` accessor must write
  // the attribute inline, matching the `FormAssociated.name` contract.
  const el = (await fixture(basic())) as LyraCombobox;
  el.name = "b";
  expect(el.getAttribute("name")).to.equal("b");
});

it("keeps the clear and tag-remove buttons disabled while the combobox is disabled", async () => {
  const el = (await fixture(html`
    <lr-combobox disabled multiple with-clear
      ><lr-option value="x" selected></lr-option
    ></lr-combobox>
  `)) as LyraCombobox;
  await el.updateComplete;
  const clearBtn = el.shadowRoot!.querySelector(
    '[part="clear-button"]'
  ) as HTMLButtonElement | null;
  const removeBtn = el.shadowRoot!.querySelector(
    '[part="tag__remove-button"]'
  ) as HTMLButtonElement | null;
  expect(clearBtn?.disabled).to.be.true;
  expect(removeBtn?.disabled).to.be.true;
});

it("resets `open` to false on disconnect so a reconnect never resumes half-open with stale positioning/listeners", async () => {
  // The actual fix behavior: `disconnectedCallback()` sets `open = false`
  // rather than leaving it `true` across the disconnect -- a naive assertion
  // that `listbox.style.position` is non-empty after reconnect would pass
  // regardless, since that inline style is set once on first open and never
  // cleared, whether or not reconnect logic runs at all.
  const el = (await fixture(
    html`<lr-combobox open><lr-option value="x"></lr-option></lr-combobox>`
  )) as LyraCombobox;
  await el.updateComplete;
  expect(el.open).to.be.true;

  const parent = el.parentElement!;
  let teardownHide: CustomEvent | undefined;
  el.addEventListener(
    "lr-hide",
    (event) => (teardownHide = event as CustomEvent)
  );
  el.remove();
  await el.updateComplete;
  expect(teardownHide !== undefined).to.be.true;
  expect(
    teardownHide!.cancelable,
    "a disconnected control cannot honour a hide veto"
  ).to.be.false;
  parent.appendChild(el);
  await el.updateComplete;
  expect(el.open).to.be.false;
});

it('never settles a stale lr-after-show promise when disconnected mid-transition', async () => {
  const el = (await fixture(basic())) as LyraCombobox;
  let afterShowFired = false;
  el.addEventListener("lr-after-show", () => {
    afterShowFired = true;
  });

  el.open = true;
  await el.updateComplete; // updated() runs while still connected: settleTransition('lr-after-show')
  // starts and is awaiting its own internal updateComplete/rAF chain.
  el.remove(); // disconnectedCallback() bumps transitionToken synchronously before that chain settles.
  await aTimeout(50);

  expect(
    afterShowFired,
    "a disconnect mid-transition must not fire a stale lr-after-show"
  ).to.be.false;
});

it('binds the outside-pointer listener only once when reopening races the queued reconnect handler', async () => {
  const el = (await fixture(basic())) as LyraCombobox;
  el.open = true;
  await el.updateComplete;
  const parent = el.parentElement!;
  el.remove();
  await el.updateComplete;
  expect(el.open, "disconnectedCallback() forces the listbox closed").to.be
    .false;

  const originalAdd = document.addEventListener.bind(document);
  let pointerAddCalls = 0;
  document.addEventListener = ((
    ...args: Parameters<typeof originalAdd>
  ) => {
    if (args[0] === "pointerdown") pointerAddCalls++;
    return originalAdd(...args);
  }) as typeof document.addEventListener;
  try {
    // Reconnecting then immediately reopening in the same synchronous tick races
    // connectedCallback()'s queued reconnectOpenPopup() microtask against updated()'s own
    // open-driven activateListboxOverlay() call -- both may bind the document pointer listener,
    // and bindDocumentPointer()'s idempotency check must keep the real registration to one.
    parent.appendChild(el);
    el.open = true;
    await el.updateComplete;
    await new Promise<void>((resolve) => queueMicrotask(resolve));
    await el.updateComplete;

    expect(
      pointerAddCalls,
      "reopening on reconnect must not double-register the outside-pointer listener"
    ).to.equal(1);
  } finally {
    document.addEventListener = originalAdd;
  }
});

it("recovers loading=false and does not throw when source() rejects", async () => {
  const el = (await fixture(html`<lr-combobox></lr-combobox>`)) as LyraCombobox;
  // A bare `.finally()` (with no `.catch()`) would also reset `loading` back
  // to `false` while leaving the rejection unhandled -- spy on
  // `console.warn` to prove the `.catch()` handler itself specifically ran
  // and consumed the rejection, not just that `loading` incidentally ended
  // up `false` via a code path that was never actually broken.
  const originalWarn = console.warn;
  const warnCalls: unknown[][] = [];
  console.warn = (...args: unknown[]) => {
    warnCalls.push(args);
  };
  try {
    el.source = async () => {
      throw new Error("network failure");
    };
    el.open = true;
    await el.updateComplete;
    await aTimeout(250);
    expect((el as unknown as { sourceLoading: boolean }).sourceLoading).to.be.false;
    expect(warnCalls.length).to.be.greaterThan(0);
    expect(String(requiredItem(requiredItem(warnCalls, 0, 'warning call'), 0, 'warning argument'))).to.include("rejected");
  } finally {
    console.warn = originalWarn;
  }
});

it("recovers loading=false when source() throws synchronously instead of returning a rejected promise", async () => {
  const el = (await fixture(html`<lr-combobox></lr-combobox>`)) as LyraCombobox;
  const error = new Error("synchronous failure");
  const originalWarn = console.warn;
  const warnCalls: unknown[][] = [];
  console.warn = (...args: unknown[]) => warnCalls.push(args);
  try {
    el.source = (() => {
      throw error;
    }) as unknown as (
      query: string
    ) => Promise<import("./combobox.js").ComboboxSourceRow[]>;
    el.open = true;
    await el.updateComplete;
    await aTimeout(250);
    expect((el as unknown as { sourceLoading: boolean }).sourceLoading).to.be.false;
  } finally {
    console.warn = originalWarn;
  }
  expect(warnCalls.flat()).to.contain(error);
  expect(String(requiredItem(requiredItem(warnCalls, 0, 'warning call'), 0, 'warning argument'))).to.include("rejected");
});

it("fails closed with the source-error state when a resolved source result's rows getter throws", async () => {
  const el = (await fixture(
    html`<lr-combobox source-delay="0" open></lr-combobox>`
  )) as LyraCombobox;
  const originalWarn = console.warn;
  console.warn = () => {};
  try {
    el.source = async () =>
      ({
        get rows(): never {
          throw new Error("hostile getter");
        },
      }) as unknown as import("./combobox.js").ComboboxSourceResult;
    await el.updateComplete;
    await aTimeout(20);
    await el.updateComplete;

    const error = el.shadowRoot!.querySelector(".source-error");
    expect(error !== null, "a hostile result fails closed, not open").to.equal(
      true
    );
    expect(el.shadowRoot!.querySelectorAll('[part="option"]').length).to.equal(
      0
    );
  } finally {
    console.warn = originalWarn;
  }
});

it("invalidates an in-flight request when source is replaced and clamps active state after shrink", async () => {
  let resolveOld!: (rows: import("./combobox.js").ComboboxSourceRow[]) => void;
  const oldRows = new Promise<import("./combobox.js").ComboboxSourceRow[]>(
    (resolve) => {
      resolveOld = resolve;
    }
  );
  const el = (await fixture(
    html`<lr-combobox source-delay="0" open></lr-combobox>`
  )) as LyraCombobox;
  el.source = () => oldRows;
  await el.updateComplete;
  await aTimeout(10);

  el.source = async () => [{ value: "new", label: "New" }];
  await el.updateComplete;
  await aTimeout(10);
  await el.updateComplete;
  resolveOld([{ value: "old", label: "Old" }]);
  await aTimeout(0);
  await el.updateComplete;

  const labels = [...el.shadowRoot!.querySelectorAll('[part="option"]')].map(
    (row) => row.textContent?.trim()
  );
  expect(labels).to.deep.equal(["New"]);
  const input = el.shadowRoot!.querySelector(
    '[part="combobox-input"]'
  ) as HTMLInputElement;
  expect(input.hasAttribute("aria-activedescendant")).to.be.false;
});

it("resets an abandoned single-select filter query on close (Escape) so a reopen does not show stale text", async () => {
  const el = (await fixture(basic())) as LyraCombobox;
  el.open = true;
  await el.updateComplete;

  const input = await typeQuery(el, "ban");
  expect(el.shadowRoot!.querySelectorAll('[part="option"]').length).to.equal(1);
  const overlay = (
    el as unknown as {
      overlayHandle?: { isActive(): boolean; isTopmost(): boolean };
    }
  ).overlayHandle;
  expect(overlay?.isActive()).to.be.true;
  expect(overlay?.isTopmost()).to.be.true;

  // Dismiss via Escape without picking a row.
  const escape = new KeyboardEvent("keydown", {
    key: "Escape",
    bubbles: true,
    cancelable: true,
  });
  input.dispatchEvent(escape);
  expect(escape.defaultPrevented, "the topmost combobox owns Escape").to.be
    .true;
  expect(el.open, "Escape closes synchronously before the render").to.be.false;
  await el.updateComplete;
  expect(el.open).to.be.false;

  el.open = true;
  await el.updateComplete;
  const reopenedInput = el.shadowRoot!.querySelector(
    '[part="combobox-input"]'
  ) as HTMLInputElement;
  expect(reopenedInput.value).to.equal("");
  expect(el.shadowRoot!.querySelectorAll('[part="option"]').length).to.equal(3);
});

it("resets an abandoned single-select filter query on close (blur) so a reopen does not show stale text", async () => {
  const el = (await fixture(basic())) as LyraCombobox;
  el.open = true;
  await el.updateComplete;

  const input = await typeQuery(el, "ban");
  input.dispatchEvent(new FocusEvent("blur"));
  await el.updateComplete;
  expect(el.open).to.be.false;

  el.open = true;
  await el.updateComplete;
  const reopenedInput = el.shadowRoot!.querySelector(
    '[part="combobox-input"]'
  ) as HTMLInputElement;
  expect(reopenedInput.value).to.equal("");
});

it("keeps a preserved out-of-cap selection in its own group instead of duplicating the group header at the tail", async () => {
  const el = (await fixture(
    html`<lr-combobox multiple max-render="4"></lr-combobox>`
  )) as LyraCombobox;
  for (const v of ["a0", "a1", "a2", "a3", "a4", "a5"]) {
    const opt = document.createElement("lr-option");
    opt.value = v;
    opt.setAttribute("group", "Fruits");
    opt.textContent = v;
    el.appendChild(opt);
  }
  for (const v of ["b0", "b1", "b2"]) {
    const opt = document.createElement("lr-option");
    opt.value = v;
    opt.setAttribute("group", "Vegetables");
    opt.textContent = v;
    el.appendChild(opt);
  }
  await el.updateComplete;

  // 'b0' precedes 'a4' in `_selected` even though 'a4' comes first in
  // document order -- the old append-at-the-tail logic rendered them in
  // this (wrong) relative order, splitting the "Fruits" group into two
  // blocks separated by "Vegetables" and duplicating its header.
  el.value = ["b0", "a4"];
  el.open = true;
  await el.updateComplete;

  const groupLabels = Array.from(
    el.shadowRoot!.querySelectorAll(".group-label")
  ).map((n) => n.textContent);
  expect(groupLabels).to.deep.equal(["Fruits", "Vegetables"]);
});

it("uses a custom loadingText instead of the hardcoded default while a source call is pending", async () => {
  const el = (await fixture(
    html`<lr-combobox loading-text="Fetching…"></lr-combobox>`
  )) as LyraCombobox;
  el.source = () => new Promise(() => {});
  el.open = true;
  await el.updateComplete;
  await aTimeout(250);
  await el.updateComplete;

  expect(el.shadowRoot!.querySelector(".loading")!.textContent).to.equal(
    "Fetching…"
  );
});

it('re-runs an active async source when inputValue is set programmatically', async () => {
  const el = (await fixture(
    html`<lr-combobox source-delay="0"></lr-combobox>`
  )) as LyraCombobox;
  const queries: string[] = [];
  el.source = async (query: string) => {
    queries.push(query);
    return query === "ban" ? [{ value: "b", label: "Banana" }] : [];
  };
  await el.updateComplete;

  el.inputValue = "ban";
  await el.updateComplete;
  await aTimeout(50);
  await el.updateComplete;

  expect(queries).to.deep.equal(["ban"]);
  expect(el.inputValue).to.equal("ban");
});

it('normalizes a nullish inputValue write to an empty string', async () => {
  const el = (await fixture(basic())) as LyraCombobox;
  (el as unknown as { inputValue: string }).inputValue =
    null as unknown as string;
  expect(el.inputValue).to.equal("");
});

it("jumps to the first row on Home and the last navigable row on End", async () => {
  const el = (await fixture(basic())) as LyraCombobox;
  const input = el.shadowRoot!.querySelector(
    '[part="combobox-input"]'
  ) as HTMLInputElement;
  input.focus();
  el.open = true;
  await el.updateComplete;

  input.dispatchEvent(
    new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true })
  );
  await el.updateComplete;
  input.dispatchEvent(
    new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true })
  );
  await el.updateComplete;

  input.dispatchEvent(
    new KeyboardEvent("keydown", { key: "Home", bubbles: true })
  );
  await el.updateComplete;
  let activeRow = el.shadowRoot!.getElementById(
    input.getAttribute("aria-activedescendant")!
  );
  expect(activeRow?.textContent).to.contain("Apple");

  input.dispatchEvent(
    new KeyboardEvent("keydown", { key: "End", bubbles: true })
  );
  await el.updateComplete;
  activeRow = el.shadowRoot!.getElementById(
    input.getAttribute("aria-activedescendant")!
  );
  expect(activeRow?.textContent).to.contain("Cherry");
});

it("skips a trailing disabled option so End lands on the last navigable row", async () => {
  const el = (await fixture(html`
    <lr-combobox>
      <lr-option value="a">Apple</lr-option>
      <lr-option value="b">Banana</lr-option>
      <lr-option value="c" disabled>Cherry</lr-option>
    </lr-combobox>
  `)) as LyraCombobox;
  const input = el.shadowRoot!.querySelector(
    '[part="combobox-input"]'
  ) as HTMLInputElement;
  input.focus();
  el.open = true;
  await el.updateComplete;

  input.dispatchEvent(
    new KeyboardEvent("keydown", { key: "End", bubbles: true })
  );
  await el.updateComplete;
  const activeRow = el.shadowRoot!.getElementById(
    input.getAttribute("aria-activedescendant")!
  );
  expect(activeRow?.textContent).to.contain("Banana");
});

it("normalizes the active descendant after local option removal and disablement", async () => {
  const el = (await fixture(basic())) as LyraCombobox;
  const input = el.shadowRoot!.querySelector<HTMLInputElement>(
    '[part="combobox-input"]'
  )!;
  el.open = true;
  await el.updateComplete;

  input.dispatchEvent(
    new KeyboardEvent("keydown", { key: "End", bubbles: true, composed: true })
  );
  await el.updateComplete;
  let activeId = input.getAttribute("aria-activedescendant");
  expect(
    el.shadowRoot!.getElementById(activeId ?? "")?.getAttribute("data-value")
  ).to.equal("c");

  el.querySelector<HTMLElement>('lr-option[value="c"]')!.remove();
  await aTimeout(0);
  await el.updateComplete;
  activeId = input.getAttribute("aria-activedescendant");
  expect(
    el.shadowRoot!.getElementById(activeId ?? "")?.getAttribute("data-value")
  ).to.equal("b");

  (
    el.querySelector('lr-option[value="b"]') as HTMLElement & {
      disabled: boolean;
    }
  ).disabled = true;
  await aTimeout(0);
  await el.updateComplete;
  activeId = input.getAttribute("aria-activedescendant");
  expect(
    el.shadowRoot!.getElementById(activeId ?? "")?.getAttribute("data-value")
  ).to.equal("a");

  (
    el.querySelector('lr-option[value="a"]') as HTMLElement & {
      disabled: boolean;
    }
  ).disabled = true;
  await aTimeout(0);
  await el.updateComplete;
  expect(input.hasAttribute("aria-activedescendant")).to.be.false;

  input.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "ArrowUp",
      bubbles: true,
      composed: true,
    })
  );
  await el.updateComplete;
  expect(input.hasAttribute("aria-activedescendant")).to.be.false;
});

it("scrolls the keyboard-active option into view in a scrolling listbox", async () => {
  const el = (await fixture(html`<lr-combobox></lr-combobox>`)) as LyraCombobox;
  for (let i = 0; i < 20; i++) {
    const opt = document.createElement("lr-option");
    opt.value = `${i}`;
    opt.textContent = `Item ${i}`;
    el.appendChild(opt);
  }
  const input = el.shadowRoot!.querySelector(
    '[part="combobox-input"]'
  ) as HTMLInputElement;
  input.focus();
  el.open = true;
  await el.updateComplete;
  const box = el.shadowRoot!.querySelector('[part="listbox"]') as HTMLElement;

  // The listbox is height-capped (max-block-size: 18rem) and scrollable --
  // 20 rows overflow it, so arrowing this far down would otherwise leave the
  // active row scrolled out of view (same fix/test shape as
  // lr-mention-popover's identical listbox).
  for (let i = 0; i < 15; i++) {
    input.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true })
    );
    await el.updateComplete;
  }

  const activeRow = el.shadowRoot!.querySelector(
    '[part="option"][data-active]'
  ) as HTMLElement;
  expect(activeRow !== null).to.be.true;
  const rowRect = activeRow.getBoundingClientRect();
  const boxRect = box.getBoundingClientRect();
  expect(
    rowRect.top >= boxRect.top - 1,
    "active row top must be within the scrolled listbox viewport"
  ).to.be.true;
  expect(
    rowRect.bottom <= boxRect.bottom + 1,
    "active row bottom must be within the scrolled listbox viewport"
  ).to.be.true;
});

it("prunes _selectedLabelCache back to the live selection instead of growing unboundedly", async () => {
  const el = (await fixture(html`<lr-combobox></lr-combobox>`)) as LyraCombobox;
  el.source = async () => [{ value: "lux", label: "Luxembourg" }];
  el.open = true;
  await el.updateComplete;
  await aTimeout(250);
  await el.updateComplete;

  // pickRow() -- driven here via a real row click, not a direct `value`
  // assignment -- is the only place that ever writes into
  // `_selectedLabelCache`.
  const row = el.shadowRoot!.querySelector('[part="option"]') as HTMLElement;
  row.click();
  await el.updateComplete;
  const labelCache = (
    el as unknown as { _selectedLabelCache: Map<string, string> }
  )._selectedLabelCache;
  expect(labelCache.has("lux")).to.be.true;

  // Deselecting -- the same `value` setter that already prunes
  // `_selectedRowCache` back to the live selection -- must prune the label
  // cache the same way instead of leaving a permanent orphaned entry.
  el.value = "";
  await el.updateComplete;
  expect(labelCache.has("lux")).to.be.false;
});

it("registers the outside-click pointerdown listener on this.ownerDocument, not the bare global document", async () => {
  const el = (await fixture(basic())) as LyraCombobox;
  const fakeDoc = document.implementation.createHTMLDocument("fake");
  let pointerAddCalls = 0;
  let pointerRemoveCalls = 0;
  const originalAdd = fakeDoc.addEventListener.bind(fakeDoc);
  const originalRemove = fakeDoc.removeEventListener.bind(fakeDoc);
  fakeDoc.addEventListener = ((...args: Parameters<typeof originalAdd>) => {
    if (args[0] === "pointerdown") pointerAddCalls++;
    return originalAdd(...args);
  }) as typeof fakeDoc.addEventListener;
  fakeDoc.removeEventListener = ((
    ...args: Parameters<typeof originalRemove>
  ) => {
    if (args[0] === "pointerdown") pointerRemoveCalls++;
    return originalRemove(...args);
  }) as typeof fakeDoc.removeEventListener;
  // Swaps what `this.ownerDocument` resolves to for this instance only --
  // proves the listener is registered against the *instance's own*
  // document rather than the bare global `document` the module closure
  // captured at evaluation time (the bug this regression guards against
  // only manifests when those two differ, e.g. a same-origin iframe).
  Object.defineProperty(el, "ownerDocument", {
    value: fakeDoc,
    configurable: true,
  });

  el.open = true;
  await el.updateComplete;
  expect(pointerAddCalls).to.equal(1);

  el.open = false;
  await el.updateComplete;
  expect(pointerRemoveCalls).to.equal(1);
});

it('leaves the default content-sized listbox clamp at 28rem when sync is unset', async () => {
  const el = (await fixture(html`
    <lr-combobox style="width: 500px; --lr-transition-fast: 0s">
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

  expect(listbox.getBoundingClientRect().width).to.be.lessThan(500);
});

it('syncs the listbox width to a wider trigger when sync="width" is set', async () => {
  const el = (await fixture(html`
    <lr-combobox sync="width" style="width: 500px; --lr-transition-fast: 0s">
      <lr-option value="a">Apple</lr-option>
    </lr-combobox>
  `)) as LyraCombobox;
  const anchor = el.shadowRoot!.querySelector<HTMLElement>('[part="combobox"]')!;
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
    () =>
      Math.round(listbox.getBoundingClientRect().width) ===
      Math.round(anchor.getBoundingClientRect().width),
    'the synced listbox width never matched the anchor'
  );

  expect(Math.round(listbox.getBoundingClientRect().width)).to.equal(
    Math.round(anchor.getBoundingClientRect().width)
  );
});

// or the reposition guard cannot silently strand a listbox at its anchor's width.
it('releases the synced inline width when sync is unset while the listbox is open', async () => {
  const el = (await fixture(html`
    <lr-combobox sync="width" style="width: 500px; --lr-transition-fast: 0s">
      <lr-option value="a">Apple</lr-option>
    </lr-combobox>
  `)) as LyraCombobox;
  const anchor = el.shadowRoot!.querySelector<HTMLElement>('[part="combobox"]')!;
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
    () =>
      Math.round(listbox.getBoundingClientRect().width) ===
      Math.round(anchor.getBoundingClientRect().width),
    'the synced listbox width never matched the anchor'
  );

  el.sync = undefined;
  await el.updateComplete;
  await waitUntil(
    () =>
      Math.round(listbox.getBoundingClientRect().width) <
      Math.round(anchor.getBoundingClientRect().width),
    'the listbox stayed at the anchor width after sync was unset'
  );

  expect(
    Math.round(listbox.getBoundingClientRect().width),
    'an unsynced listbox falls back to its own content-sized clamp'
  ).to.be.lessThan(Math.round(anchor.getBoundingClientRect().width));
});

it('matches a width-synced listbox to an anchor wider than the viewport clamp', async () => {
  // `--lr-popover-viewport-clamp` defaults to 92vw, so a trigger wider than 92vw is exactly a
  // trigger wider than the clamp. Authoring the token below the anchor width reproduces that
  // relationship deterministically at any test-runner window size. Before the fix the synced
  // listbox rendered at the clamp (200px) against a 500px anchor.
  const el = (await fixture(html`
    <lr-combobox
      sync="width"
      style="width: 500px; --lr-popover-viewport-clamp: 200px; --lr-transition-fast: 0s"
    >
      <lr-option value="a">Apple</lr-option>
    </lr-combobox>
  `)) as LyraCombobox;
  const anchor = el.shadowRoot!.querySelector<HTMLElement>('[part="combobox"]')!;
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

  const anchorWidth = anchor.getBoundingClientRect().width;
  expect(anchorWidth, 'the fixture anchor is wider than the authored clamp').to.be.greaterThan(200);
  expect(
    listbox.getBoundingClientRect().width,
    'the width-synced listbox is still short of its own anchor'
  ).to.be.closeTo(anchorWidth, 0.5);
});

it('still bounds a width-synced listbox by the measured available inline space', async () => {
  // The viewport-clamp term is gone, but the available-space term must still keep an anchor far
  // wider than the viewport from pushing the listbox off-screen.
  const el = (await fixture(html`
    <lr-combobox sync="width" style="width: 3000px; --lr-transition-fast: 0s">
      <lr-option value="a">Apple</lr-option>
    </lr-combobox>
  `)) as LyraCombobox;
  const anchor = el.shadowRoot!.querySelector<HTMLElement>('[part="combobox"]')!;
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

  const available = Number.parseFloat(
    listbox.style.getPropertyValue('--lr-positioner-available-inline-size')
  );
  expect(available, 'the positioner published an available inline size').to.be.greaterThan(0);
  const rendered = listbox.getBoundingClientRect().width;
  expect(rendered, 'the over-wide anchor width was not copied verbatim').to.be.lessThan(
    anchor.getBoundingClientRect().width
  );
  expect(rendered, 'the listbox settles on the measured available space').to.be.closeTo(
    available,
    0.5
  );
});

it('keeps the unsynced listbox capped by the viewport clamp under an over-wide trigger', async () => {
  // The paired half of the two rules above: with `sync` unset the content clamp is unchanged, so
  // a wide trigger must NOT widen the listbox past `min(--lr-popover-viewport-clamp, 28rem)`.
  const el = (await fixture(html`
    <lr-combobox
      style="width: 500px; --lr-popover-viewport-clamp: 200px; --lr-transition-fast: 0s"
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
    () => getComputedStyle(listbox).maxInlineSize === '200px',
    'the unsynced listbox did not keep the viewport clamp'
  );

  expect(listbox.getBoundingClientRect().width).to.be.at.most(200);
});

it('inherits a 20px host font into clear and tag-remove controls and their one-em glyphs', async () => {
  const el = (await fixture(html`
    <lr-combobox
      multiple
      clearable
      style="font: 20px/1 monospace; --lr-combobox-font-size: 20px; --lr-font-size-m: 20px"
    >
      <lr-option value="a">Apple</lr-option>
    </lr-combobox>
  `)) as LyraCombobox;
  el.value = ['a'];
  await el.updateComplete;

  const clear = el.shadowRoot!.querySelector<HTMLElement>('[part="clear-button"]')!;
  const clearGlyph = clear.querySelector<SVGElement>('svg')!;
  const remove = el.shadowRoot!.querySelector<HTMLElement>(
    '[part~="tag__remove-button"]'
  )!;
  const removeGlyph = remove.querySelector<SVGElement>('svg')!;

  expect(getComputedStyle(el).fontSize).to.equal('20px');
  expect(getComputedStyle(clear).fontSize).to.equal('20px');
  expect(getComputedStyle(clear).fontFamily).to.equal(getComputedStyle(el).fontFamily);
  expect(getComputedStyle(clearGlyph).width).to.equal('20px');
  expect(getComputedStyle(clearGlyph).height).to.equal('20px');
  expect(getComputedStyle(remove).fontSize).to.equal('20px');
  expect(getComputedStyle(remove).fontFamily).to.equal(getComputedStyle(el).fontFamily);
  expect(getComputedStyle(removeGlyph).width).to.equal('20px');
  expect(getComputedStyle(removeGlyph).height).to.equal('20px');
});

it("colors the combobox-input's placeholder text instead of leaving the UA default", () => {
  const css = styles.cssText.replace(/\s+/g, " ");
  expect(css).to.match(
    /\[part=["']combobox-input["']\]::placeholder\s*\{[^}]*color:\s*var\(--lr-color-text-quiet\)/
  );
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
      await aTimeout(20);
    }
    return holds();
  };

  const openWithSelectedMiddleRow = async (): Promise<LyraCombobox> => {
    const el = (await fixture(html`
      <lr-combobox
        value="b"
        style="--lr-transition-fast: 0s; --lr-combobox-option-active-bg: rgb(1, 2, 3);"
      >
        <lr-option value="a">Apple</lr-option>
        <lr-option value="b">Banana</lr-option>
        <lr-option value="c">Cherry</lr-option>
      </lr-combobox>
    `)) as LyraCombobox;
    el.open = true;
    await el.updateComplete;
    // The listbox is placed by the Floating UI positioner a tick after the open render, so a
    // getBoundingClientRect() taken before that points the pointer at the pre-placement box.
    await aTimeout(50);
    return el;
  };

  it("keeps the active-descendant highlight visible after arrowing onto the selected row", async () => {
    const el = await openWithSelectedMiddleRow();
    const input = el.shadowRoot!.querySelector<HTMLInputElement>(
      '[part="combobox-input"]'
    )!;
    // Driven through the component's own keyboard handling rather than by hand-stamping
    // [data-active], so this covers the rendered aria-activedescendant highlight itself.
    for (const key of ["ArrowUp", "ArrowDown"]) {
      input.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
      await el.updateComplete;
    }
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

// -- Host click() forwarding -------------------------------------------------
it("forwards host click() to opening the listbox and focusing the filter input", async () => {
  const el = (await fixture(basic())) as LyraCombobox;
  expect(el.open).to.be.false;

  el.click();
  await el.updateComplete;

  expect(el.open).to.be.true;
  const input = el.shadowRoot!.querySelector('[part="combobox-input"]');
  expect(el.shadowRoot!.activeElement === input).to.be.true;
});

it("does not open or steal focus when host click() is called while disabled", async () => {
  const el = (await fixture(html`
    <lr-combobox disabled>
      <lr-option value="a">Apple</lr-option>
    </lr-combobox>
  `)) as LyraCombobox;
  await el.updateComplete;

  el.click();
  await el.updateComplete;

  expect(el.open).to.be.false;
});

// -- Lifecycle super calls ---------------------------------------------------
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
    // Deliberately no slotted `<lr-option>` children: they're LyraElement subclasses too, and if
    // this used `basic()` a passing result couldn't distinguish "the combobox itself chained the
    // call" from "some sibling LyraElement in the fixture happened to trigger the patched hook".
    const el = (await fixture(
      html`<lr-combobox></lr-combobox>`
    )) as LyraCombobox;
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

it("chains updated() to super.updated() so a mixin layered under LyraElement would still run", async () => {
  const hadOwn = Object.prototype.hasOwnProperty.call(
    LitElement.prototype,
    "updated"
  );
  const original = (
    LitElement.prototype as unknown as {
      updated?: (changed: PropertyValues) => void;
    }
  ).updated;
  let called = false;
  (
    LitElement.prototype as unknown as {
      updated: (changed: PropertyValues) => void;
    }
  ).updated = function (this: LitElement, changed: PropertyValues) {
    called = true;
    original?.call(this, changed);
  };
  try {
    // Deliberately no slotted `<lr-option>` children -- see the identical note in the
    // willUpdate() version of this test above.
    const el = (await fixture(
      html`<lr-combobox></lr-combobox>`
    )) as LyraCombobox;
    await el.updateComplete;
    expect(called).to.be.true;
  } finally {
    if (hadOwn) {
      (LitElement.prototype as unknown as { updated: unknown }).updated =
        original;
    } else {
      delete (LitElement.prototype as unknown as { updated?: unknown }).updated;
    }
  }
});

describe("source AbortSignal and configurable debounce", () => {
  it("passes an AbortSignal and aborts the prior request when a newer query supersedes it", async () => {
    const el = (await fixture(
      html`<lr-combobox></lr-combobox>`
    )) as LyraCombobox;
    const signals: AbortSignal[] = [];
    el.source = (_query: string, { signal }: { signal: AbortSignal }) => {
      signals.push(signal);
      return new Promise(() => {
        /* never resolves — kept in-flight so a newer query must abort it */
      });
    };
    el.open = true;
    await el.updateComplete;
    await aTimeout(250);

    await typeQuery(el, "newer");
    await aTimeout(250);

    expect(signals.length).to.equal(2);
    expect(
      signals[0]!.aborted,
      "the first request should be aborted by the second"
    ).to.equal(true);
    expect(
      signals[1]!.aborted,
      "the current request should still be live"
    ).to.equal(false);
  });

  it("aborts the in-flight request on disconnect", async () => {
    const el = (await fixture(
      html`<lr-combobox></lr-combobox>`
    )) as LyraCombobox;
    let captured!: AbortSignal;
    el.source = (_query: string, { signal }: { signal: AbortSignal }) => {
      captured = signal;
      return new Promise(() => {});
    };
    el.open = true;
    await el.updateComplete;
    await aTimeout(250);
    expect(captured.aborted).to.equal(false);

    el.remove();
    await el.updateComplete;
    expect(captured.aborted).to.equal(true);
  });

  it("remains compatible with a legacy single-argument source", async () => {
    const el = (await fixture(
      html`<lr-combobox></lr-combobox>`
    )) as LyraCombobox;
    // A source that ignores the options bag (the pre-7.x signature) must still work.
    const legacy = ((query: string) =>
      Promise.resolve([
        { value: "x", label: `Result "${query}"` },
      ])) as unknown as typeof el.source;
    el.source = legacy;
    el.open = true;
    await el.updateComplete;
    await aTimeout(250);
    await el.updateComplete;
    expect(
      el.shadowRoot!.querySelector('[part="option"] [part="option-label"]')!
        .textContent
    ).to.contain('Result ""');
  });

  it("honours a custom sourceDelay (sanitized to a finite non-negative duration)", async () => {
    const el = (await fixture(
      html`<lr-combobox source-delay="0"></lr-combobox>`
    )) as LyraCombobox;
    await el.updateComplete;
    expect(el.sourceDelay).to.equal(0);
    el.sourceDelay = -50;
    expect(el.sourceDelay, "negative clamps to 0").to.equal(0);
    el.sourceDelay = Number.NaN;
    expect(el.sourceDelay, "NaN falls back to the default").to.equal(200);
  });
});

it("ArrowDown and ArrowUp open a closed list before moving within it", async () => {
  const el = (await fixture(basic())) as LyraCombobox;
  const input = el.shadowRoot!.querySelector(
    '[part="combobox-input"]'
  ) as HTMLInputElement;
  expect(el.open).to.be.false;
  input.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "ArrowDown",
      bubbles: true,
      cancelable: true,
    })
  );
  await el.updateComplete;
  expect(el.open).to.be.true;

  const second = (await fixture(basic())) as LyraCombobox;
  const secondInput = second.shadowRoot!.querySelector(
    '[part="combobox-input"]'
  ) as HTMLInputElement;
  secondInput.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "ArrowUp",
      bubbles: true,
      cancelable: true,
    })
  );
  await second.updateComplete;
  expect(second.open).to.be.true;
});

it("ignores a listbox click that lands on chrome rather than an option", async () => {
  const el = (await fixture(basic())) as LyraCombobox;
  el.open = true;
  await el.updateComplete;
  const listbox = el.shadowRoot!.querySelector(
    '[part="listbox"]'
  ) as HTMLElement;
  listbox.dispatchEvent(
    new MouseEvent("click", { bubbles: true, composed: true })
  );
  await el.updateComplete;
  expect(el.value).to.equal("");
  expect(el.open, "a click on listbox chrome neither selects nor closes").to.be
    .true;
});

it("ignores option activation entirely while disabled", async () => {
  const el = (await fixture(basic())) as LyraCombobox;
  el.open = true;
  await el.updateComplete;
  const option = el.shadowRoot!.querySelector('[part="option"]') as HTMLElement;
  el.disabled = true;
  await el.updateComplete;
  option.dispatchEvent(
    new MouseEvent("click", { bubbles: true, composed: true })
  );
  await el.updateComplete;
  expect(el.value).to.equal("");
});

it("mirrors the lowercase IDL aliases of the native input hints", async () => {
  const el = (await fixture(
    html`<lr-combobox label="City"
      ><lr-option value="paris">Paris</lr-option></lr-combobox
    >`
  )) as LyraCombobox;
  expect(el.inputmode).to.equal("");
  expect(el.enterkeyhint).to.equal("");

  el.inputmode = "numeric";
  el.enterkeyhint = "search";
  await el.updateComplete;
  expect(el.inputMode).to.equal("numeric");
  expect(el.enterKeyHint).to.equal("search");
  expect(el.inputmode).to.equal("numeric");
  expect(el.enterkeyhint).to.equal("search");
  // Assert what the component actually renders -- `inputmode=`/`enterkeyhint=` ATTRIBUTES on the
  // inner input (combobox.class.ts). The matching IDL properties are engine-dependent: Chromium
  // reflects both, WebKit implements the attributes but leaves `input.enterKeyHint` undefined, so
  // reading the IDL here would assert a browser feature rather than this component's contract.
  expect(el.input?.getAttribute("inputmode")).to.equal("numeric");
  expect(el.input?.getAttribute("enterkeyhint")).to.equal("search");
  if (el.input && "inputMode" in el.input)
    expect(el.input.inputMode).to.equal("numeric");
  if (el.input && "enterKeyHint" in el.input)
    expect(el.input.enterKeyHint).to.equal("search");

  el.inputmode = null as unknown as string;
  el.enterkeyhint = null as unknown as string;
  await el.updateComplete;
  expect(el.inputmode).to.equal("");
  expect(el.enterkeyhint).to.equal("");
});

it("honours preventDefault() on lr-show and lr-hide, keeping property and attribute in step", async () => {
  const el = (await fixture(basic())) as LyraCombobox;
  await el.updateComplete;

  el.addEventListener("lr-show", (event) => event.preventDefault(), {
    once: true,
  });
  await el.show();
  await el.updateComplete;
  await aTimeout(60);
  expect(el.open, "a vetoed open never applies").to.be.false;
  expect(el.hasAttribute("open")).to.be.false;

  await el.show();
  await el.updateComplete;
  await aTimeout(60);
  expect(el.open, "the veto was one-shot; the next request opens normally").to
    .be.true;

  el.addEventListener("lr-hide", (event) => event.preventDefault(), {
    once: true,
  });
  el.open = false;
  await el.updateComplete;
  await aTimeout(60);
  expect(el.open, "a vetoed close stays open even for a direct property write")
    .to.be.true;
  expect(el.hasAttribute("open")).to.be.true;
});

it("preserves source query, rows, and active option when hide() is vetoed", async () => {
  const el = (await fixture(html`<lr-combobox></lr-combobox>`)) as LyraCombobox;
  el.source = async (query: string) =>
    query
      ? [
          { value: "one", label: `One ${query}` },
          { value: "two", label: `Two ${query}` },
        ]
      : [];
  await el.show();
  await typeQuery(el, "ban");
  await aTimeout(250);
  await el.updateComplete;
  const input = el.shadowRoot!.querySelector<HTMLInputElement>(
    '[part="combobox-input"]'
  )!;
  input.dispatchEvent(
    new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true })
  );
  await el.updateComplete;
  const activeBefore = input.getAttribute("aria-activedescendant");
  const labelsBefore = [
    ...el.shadowRoot!.querySelectorAll<HTMLElement>('[part="option"]'),
  ].map((option) => option.textContent?.trim() ?? "");

  el.addEventListener("lr-hide", (event) => event.preventDefault(), {
    once: true,
  });
  await el.hide();
  await el.updateComplete;
  expect(el.open).to.equal(true);
  expect(input.value).to.equal("ban");
  expect(input.getAttribute("aria-activedescendant")).to.equal(activeBefore);
  expect(
    [...el.shadowRoot!.querySelectorAll<HTMLElement>('[part="option"]')].map(
      (option) => option.textContent?.trim() ?? ""
    )
  ).to.deep.equal(labelsBefore);

  await el.hide();
  await el.updateComplete;
  expect(el.open).to.equal(false);
});

it("makes lr-show/lr-hide cancelable and the settled after-events not", async () => {
  const el = (await fixture(basic())) as LyraCombobox;
  const seen: CustomEvent[] = [];
  for (const type of ["lr-show", "lr-after-show", "lr-hide", "lr-after-hide"]) {
    el.addEventListener(type, (event) => seen.push(event as CustomEvent));
  }
  el.open = true;
  await el.updateComplete;
  await aTimeout(80);
  el.open = false;
  await el.updateComplete;
  await aTimeout(80);

  const byType = new Map(seen.map((event) => [event.type, event.cancelable]));
  expect(byType.get("lr-show"), "lr-show is a veto point").to.equal(true);
  expect(byType.get("lr-hide"), "lr-hide is a veto point").to.equal(true);
  // Whichever after-events settled inside the window are pure notifications.
  for (const event of seen.filter((candidate) =>
    candidate.type.startsWith("lr-after")
  )) {
    expect(
      event.cancelable,
      `${event.type} is a notification, not a veto point`
    ).to.equal(false);
  }
});

// -- Reconnect lifecycle, source edge cases, and keyboard/mouse edge paths ---------------------
it("re-runs source on reconnect while closed with a stale selection and empty async rows", async () => {
  const el = document.createElement("lr-combobox") as LyraCombobox;
  const queries: string[] = [];
  el.source = (q: string) => {
    queries.push(q);
    return new Promise(() => {
      /* never resolves -- keeps asyncRows empty so the reconnect guard stays satisfied */
    });
  };
  document.body.appendChild(el);
  await el.updateComplete;

  el.value = "x"; // selects without ever opening -- triggers willUpdate()'s one-shot warm-up
  await el.updateComplete;
  await aTimeout(250);
  expect(queries, "the initial warm-up fetch fired once").to.deep.equal([""]);

  el.remove();
  await el.updateComplete;
  document.body.appendChild(el); // reconnect while still closed
  await new Promise<void>((resolve) => queueMicrotask(resolve));
  await el.updateComplete;
  await aTimeout(250);

  expect(
    queries,
    "reconnecting while closed refreshes the stale empty async rows again"
  ).to.deep.equal(["", ""]);
  el.remove();
});

it("rebinds positioning and refreshes empty async rows when reconnected while open", async () => {
  const el = (await fixture(
    html`<lr-combobox open><lr-option value="x">X</lr-option></lr-combobox>`
  )) as LyraCombobox;
  await el.updateComplete;
  const parent = el.parentElement!;

  el.remove();
  await el.updateComplete;
  expect(el.open, "disconnectedCallback() forces the listbox closed").to.be
    .false;

  let sourceCalls = 0;
  el.source = () => {
    sourceCalls++;
    return new Promise(() => {});
  };
  el.open = true; // simulate a consumer (e.g. a drag-drop reparent) reopening it while detached
  await el.updateComplete;
  expect(
    sourceCalls,
    "setting open/source while disconnected must not itself fetch"
  ).to.equal(0);

  parent.appendChild(el);
  await new Promise<void>((resolve) => queueMicrotask(resolve));
  await el.updateComplete;

  const listbox = el.shadowRoot!.querySelector(
    '[part="listbox"]'
  ) as HTMLElement;
  expect(
    listbox.style.position,
    "reconnectOpenPopup() re-positions the listbox"
  ).to.not.equal("");
  await aTimeout(250);
  expect(
    sourceCalls,
    "reconnecting while open with empty async rows refreshes them"
  ).to.equal(1);
});

it("aborts an in-flight source request when adopted into a new document", async () => {
  const el = (await fixture(html`<lr-combobox></lr-combobox>`)) as LyraCombobox;
  let captured!: AbortSignal;
  el.source = (_query: string, { signal }: { signal: AbortSignal }) => {
    captured = signal;
    return new Promise(() => {});
  };
  el.open = true;
  await el.updateComplete;
  await aTimeout(250);
  expect(captured.aborted).to.equal(false);

  const iframe = document.createElement("iframe");
  document.body.append(iframe);
  const frameDocument = iframe.contentDocument;
  if (!frameDocument) {
    iframe.remove();
    throw new Error("The iframe realm was unavailable.");
  }
  try {
    frameDocument.body.append(frameDocument.adoptNode(el));
    expect(
      captured.aborted,
      "adoptedCallback() aborts the stale in-flight request"
    ).to.equal(true);
  } finally {
    if (el.ownerDocument !== document) document.adoptNode(el);
    el.remove();
    iframe.remove();
  }
});

it("merges multiple lazily-appended live-selected options in multiple mode", async () => {
  const el = (await fixture(html`
    <lr-combobox multiple>
      <lr-option value="a" selected>Apple</lr-option>
    </lr-combobox>
  `)) as LyraCombobox;
  await el.updateComplete;
  expect(el.value).to.deep.equal(["a"]);

  const b = document.createElement("lr-option");
  b.setAttribute("value", "b");
  b.textContent = "Banana";
  b.selected = true; // live property write, not the declarative attribute
  const c = document.createElement("lr-option");
  c.setAttribute("value", "c");
  c.textContent = "Cherry";
  c.selected = true;
  el.appendChild(b);
  el.appendChild(c);
  await aTimeout(0);
  await el.updateComplete;

  expect(el.value).to.deep.equal(["a", "b", "c"]);
});

it("suppresses the create row on an exact case-insensitive match against a local option", async () => {
  const el = (await fixture(html`
    <lr-combobox allow-create>
      <lr-option value="existing">Existing</lr-option>
    </lr-combobox>
  `)) as LyraCombobox;
  await typeQuery(el, "EXISTING");
  expect(el.shadowRoot!.querySelector("[data-create]") === null).to.equal(true);
});

it("checks async source rows, not local options, for an exact match when allow-create is combined with source", async () => {
  const el = (await fixture(
    html`<lr-combobox allow-create></lr-combobox>`
  )) as LyraCombobox;
  el.source = async (q: string) =>
    q ? [{ value: "known", label: "Known Row" }] : [];
  el.open = true;
  await el.updateComplete;

  await typeQuery(el, "known row");
  await aTimeout(250);
  await el.updateComplete;
  expect(
    el.shadowRoot!.querySelector("[data-create]") === null,
    "an exact async-row label match suppresses the create row"
  ).to.equal(true);

  await typeQuery(el, "brand new");
  await aTimeout(250);
  await el.updateComplete;
  expect(
    el.shadowRoot!.querySelector("[data-create]"),
    "a nonmatching query still offers to create"
  ).to.exist;
});

it("clears stale async rows when hide() dismisses a non-empty query in source mode", async () => {
  const el = (await fixture(html`<lr-combobox></lr-combobox>`)) as LyraCombobox;
  el.source = async (q: string) =>
    q ? [{ value: "x", label: `Result ${q}` }] : [];
  el.open = true;
  await el.updateComplete;
  await typeQuery(el, "ban");
  await aTimeout(250);
  await el.updateComplete;
  expect(el.shadowRoot!.querySelectorAll('[part="option"]')).to.have.length(1);

  el.hide();
  await el.updateComplete;

  el.open = true;
  await el.updateComplete;
  await aTimeout(250);
  await el.updateComplete;
  // Without the fix, the stale row would still be sitting in `asyncRows` and the reopen guard
  // (`asyncRows.length === 0`) would never even re-run source() to replace it.
  expect(
    el.shadowRoot!.querySelectorAll('[part="option"]'),
    "the stale row must not linger"
  ).to.have.length(0);
});

it("clamps a stale activeIndex when a fresh source response has fewer navigable rows", async () => {
  // Multiple mode + a mouse pick (not a keyboard/typing path) is deliberate: both `onInput()` and
  // `hide()` already reset `activeIndex` themselves, which would mask the clamp this test targets.
  // Picking a row by mouse leaves `activeIndex` untouched while still re-running source() with the
  // now-blank query, so a stale, now-out-of-range index is exactly what the next response sees.
  const el = (await fixture(
    html`<lr-combobox multiple></lr-combobox>`
  )) as LyraCombobox;
  let callCount = 0;
  el.source = async () => {
    callCount++;
    return callCount === 1
      ? [
          { value: "a", label: "A" },
          { value: "b", label: "B" },
          { value: "c", label: "C" },
        ]
      : [{ value: "a", label: "A" }];
  };
  el.open = true;
  await el.updateComplete;
  await aTimeout(250);
  await el.updateComplete;
  expect(el.shadowRoot!.querySelectorAll('[part="option"]')).to.have.length(3);

  const input = el.shadowRoot!.querySelector(
    '[part="combobox-input"]'
  ) as HTMLInputElement;
  const arrowDown = () =>
    input.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "ArrowDown",
        bubbles: true,
        cancelable: true,
      })
    );
  arrowDown();
  arrowDown();
  arrowDown();
  await el.updateComplete;
  expect(
    el
      .shadowRoot!.querySelector('[part="option"][data-active]')
      ?.getAttribute("data-value")
  ).to.equal("c");

  (el.shadowRoot!.querySelector('[part="option"]') as HTMLElement).click();
  await el.updateComplete;
  await aTimeout(250);
  await el.updateComplete;

  const active = el.shadowRoot!.querySelector('[part="option"][data-active]');
  expect(
    active?.getAttribute("data-value"),
    "the out-of-range index clamps to the last remaining row"
  ).to.equal("a");
});

it("silently drops a source rejection that arrives after disconnect", async () => {
  const el = (await fixture(html`<lr-combobox></lr-combobox>`)) as LyraCombobox;
  let reject!: (err: unknown) => void;
  el.source = () =>
    new Promise((_resolve, rej) => {
      reject = rej;
    });
  el.open = true;
  await el.updateComplete;
  await aTimeout(250);

  el.remove();
  await el.updateComplete;
  const originalWarn = console.warn;
  let warned = false;
  console.warn = () => {
    warned = true;
  };
  try {
    reject(new Error("boom"));
    await aTimeout(0);
    expect(
      warned,
      "a stale rejection after disconnect must not be warned about"
    ).to.be.false;
    expect(
      el.shadowRoot!.querySelector(".source-error") === null,
      "a stale rejection must not surface the error state"
    ).to.equal(true);
  } finally {
    console.warn = originalWarn;
  }
});

it("swallows an AbortError the source rejects with while its request is still current, without warning", async () => {
  // Deliberately reject the *current* (not superseded) request: aborting via a newer runSource()
  // call, disconnect, or adoption all also bump the internal request token, so the earlier
  // "stale response" guard would return first and this AbortError-specific branch would never be
  // reached. A source can independently reject with an AbortError (e.g. its own unrelated
  // cancellation) while still being this component's current, non-superseded request.
  const el = (await fixture(html`<lr-combobox></lr-combobox>`)) as LyraCombobox;
  let reject!: (err: unknown) => void;
  el.source = () =>
    new Promise((_resolve, rej) => {
      reject = rej;
    });
  el.open = true;
  await el.updateComplete;
  await aTimeout(250);

  const originalWarn = console.warn;
  let warned = false;
  console.warn = () => {
    warned = true;
  };
  try {
    reject(new DOMException("aborted", "AbortError"));
    await aTimeout(0);
    expect(warned, "an AbortError must not be warned about").to.be.false;
    expect(
      el.shadowRoot!.querySelector(".source-error") === null,
      "an AbortError must not surface the failure state"
    ).to.equal(true);
  } finally {
    console.warn = originalWarn;
  }
});

it("moves the active option up with ArrowUp while the listbox is already open", async () => {
  const el = (await fixture(basic())) as LyraCombobox;
  const input = el.shadowRoot!.querySelector(
    '[part="combobox-input"]'
  ) as HTMLInputElement;
  input.focus();
  el.open = true;
  await el.updateComplete;

  const dispatch = (key: string) =>
    input.dispatchEvent(
      new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true })
    );
  dispatch("ArrowDown");
  dispatch("ArrowDown");
  await el.updateComplete;
  expect(
    el
      .shadowRoot!.querySelector('[part="option"][data-active]')
      ?.getAttribute("data-value")
  ).to.equal("b");

  dispatch("ArrowUp");
  await el.updateComplete;
  expect(
    el
      .shadowRoot!.querySelector('[part="option"][data-active]')
      ?.getAttribute("data-value")
  ).to.equal("a");
});

it("creates a new option via Enter when the create row is showing but not keyboard-highlighted", async () => {
  const el = (await fixture(html`
    <lr-combobox allow-create>
      <lr-option value="existing">Existing</lr-option>
    </lr-combobox>
  `)) as LyraCombobox;
  const input = await typeQuery(el, "Brand new");
  input.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "Enter",
      bubbles: true,
      composed: true,
      cancelable: true,
    })
  );
  await el.updateComplete;

  expect(el.value).to.equal("Brand new");
  expect(
    [...el.querySelectorAll("lr-option")].some(
      (option) => option.getAttribute("value") === "Brand new"
    )
  ).to.be.true;
});

it("focuses the input and opens the listbox on a mousedown inside the trigger row that is not on a button, without stealing caret placement from the input itself", async () => {
  const el = (await fixture(basic())) as LyraCombobox;
  await el.updateComplete;
  const container = el.shadowRoot!.querySelector(
    '[part="combobox"]'
  ) as HTMLElement;
  const input = el.shadowRoot!.querySelector(
    '[part="combobox-input"]'
  ) as HTMLInputElement;

  // A mousedown on the chrome around the input (not the input itself, not a button) must still be
  // cancelled -- the browser's default action there would otherwise leave focus wherever the press
  // landed instead of on the input.
  const containerEvent = new MouseEvent("mousedown", {
    bubbles: true,
    cancelable: true,
    composed: true,
  });
  container.dispatchEvent(containerEvent);
  await el.updateComplete;

  expect(containerEvent.defaultPrevented).to.be.true;
  expect(el.open).to.be.true;
  expect(el.shadowRoot!.activeElement === input).to.equal(true);

  // A mousedown ON the free-text input itself must remain uncancelled -- preventing it strips the
  // browser's native caret-placement/shift-click-selection behavior from the combobox's own text
  // field, which is basic text editing.
  const inputEvent = new MouseEvent("mousedown", {
    bubbles: true,
    cancelable: true,
    composed: true,
  });
  input.dispatchEvent(inputEvent);
  await el.updateComplete;

  expect(inputEvent.defaultPrevented).to.be.false;
});

// command available here can hold a modifier, so shift-extension has to be synthesized instead.
it("places the caret where a real pointer press lands inside the free-text input", async () => {
  const el = (await fixture(basic())) as LyraCombobox;
  await el.updateComplete;
  const input = await typeQuery(el, "Ban");
  input.focus();
  await el.updateComplete;
  el.setSelectionRange(0, 0);

  const presses: MouseEvent[] = [];
  el.addEventListener("mousedown", (event) => presses.push(event as MouseEvent), {
    once: true,
  });

  const rect = input.getBoundingClientRect();
  try {
    await sendMouse({
      type: "click",
      position: [
        Math.round(rect.right - 4),
        Math.round(rect.top + rect.height / 2),
      ],
    });
    // Pointer-driven state settles at its own pace per engine -- poll for the caret rather than
    // reading it once on whichever tick the command happens to resolve on.
    await waitUntil(
      () => presses.length > 0 && (el.selectionStart ?? 0) > 0,
      "the pointer press never moved the caret off position 0"
    );
  } finally {
    await resetMouse();
  }

  expect(
    presses[0]?.defaultPrevented,
    "cancelling the input's own mousedown is exactly what strips caret placement"
  ).to.be.false;
  expect(el.selectionStart).to.equal(el.selectionEnd);
});

it("leaves a shift-click on the free-text input uncancelled so its selection can be extended", async () => {
  const el = (await fixture(basic())) as LyraCombobox;
  await el.updateComplete;
  const input = await typeQuery(el, "Banana");
  input.focus();
  await el.updateComplete;
  el.setSelectionRange(1, 3);

  const shiftPress = new MouseEvent("mousedown", {
    bubbles: true,
    cancelable: true,
    composed: true,
    shiftKey: true,
  });
  input.dispatchEvent(shiftPress);
  await el.updateComplete;

  expect(
    shiftPress.defaultPrevented,
    "the browser extends a selection only while the shift-click's own mousedown stays uncancelled"
  ).to.be.false;
  expect(el.selectionStart, "the handler must leave the anchor alone").to.equal(
    1
  );
  expect(el.selectionEnd).to.equal(3);
});

it("sets an inputValue programmatically while source is configured, triggering a fresh fetch", async () => {
  const el = (await fixture(html`<lr-combobox></lr-combobox>`)) as LyraCombobox;
  const queries: string[] = [];
  el.source = async (q: string) => {
    queries.push(q);
    return [];
  };
  // Let the source-changed willUpdate() branch (which clears any in-flight timer) settle first --
  // otherwise it would run *after* inputValue's own runSource() call in the same microtask batch
  // and cancel the very timer that call just armed.
  await el.updateComplete;
  el.inputValue = "typed";
  await el.updateComplete;
  await aTimeout(250);

  expect(el.inputValue).to.equal("typed");
  expect(queries).to.deep.equal(["typed"]);
});

it("runs source again after setRangeText() while source is configured", async () => {
  const el = (await fixture(basic())) as LyraCombobox;
  const queries: string[] = [];
  el.source = async (q: string) => {
    queries.push(q);
    return [];
  };
  await el.updateComplete; // let the source-changed willUpdate() branch settle first (see above)
  const input = el.shadowRoot!.querySelector(
    '[part="combobox-input"]'
  ) as HTMLInputElement;
  input.value = "Apple";
  el.setRangeText("X", 0, 1);
  await el.updateComplete;
  await aTimeout(250);

  expect(el.inputValue).to.equal("Xpple");
  expect(queries).to.deep.equal(["Xpple"]);
});

describe("explicitly empty host aria-label", () => {
  it("keeps the combobox input explicitly unnamed instead of substituting the localized fallback", async () => {
    const explicit = (await fixture(
      html`<lr-combobox aria-label=""><lr-option value="a">A</lr-option></lr-combobox>`
    )) as LyraCombobox;
    await explicit.updateComplete;
    const input = explicit.shadowRoot!.querySelector('[part="combobox-input"]')!;
    expect(input.hasAttribute("aria-label")).to.equal(true);
    expect(input.getAttribute("aria-label")).to.equal("");

    const omitted = (await fixture(
      html`<lr-combobox><lr-option value="a">A</lr-option></lr-combobox>`
    )) as LyraCombobox;
    await omitted.updateComplete;
    expect(
      omitted.shadowRoot!.querySelector('[part="combobox-input"]')!.getAttribute("aria-label")
    ).to.equal("Combobox");
  });
});

it("contains the internal lr-option-change notification instead of leaking it past the host", async () => {
  const el = (await fixture(html`
    <lr-combobox><lr-option value="a">Apple</lr-option></lr-combobox>
  `)) as LyraCombobox;
  await el.updateComplete;
  const option = el.querySelector("lr-option")!;

  let atOption = 0;
  let pastHost = 0;
  let pastDocument = 0;
  option.addEventListener("lr-option-change", () => atOption++);
  el.addEventListener("lr-option-change", () => pastHost++);
  const onDocument = (): void => {
    pastDocument++;
  };
  document.addEventListener("lr-option-change", onDocument);

  try {
    // A real option-data mutation, not a synthetic dispatch: `updated()` on
    // `<lr-option>` emits `lr-option-change` for a `group` change, so this
    // proves the event genuinely fires before asserting where it stops.
    option.group = "Fruit";
    await option.updateComplete;
    await aTimeout(0);
    await el.updateComplete;
  } finally {
    document.removeEventListener("lr-option-change", onDocument);
  }

  expect(atOption, "the option still emits its own notification").to.equal(1);
  expect(
    pastHost,
    "lr-option-change is <lr-combobox> implementation detail and must not reach a host listener"
  ).to.equal(0);
  expect(pastDocument, "and must not reach the document either").to.equal(0);
  // Containment must not disable the refresh the notification exists to drive.
  const groupLabels = Array.from(
    el.shadowRoot!.querySelectorAll('[part="group-label"]')
  ).map((node) => node.textContent?.trim() ?? "");
  expect(
    groupLabels,
    "the contained notification still refreshes the rendered rows"
  ).to.deep.equal(["Fruit"]);
});

describe('visible-options cap', () => {
  function manyOptions(count: number): unknown[] {
    return Array.from(
      { length: count },
      (_unused, index) => html`<lr-option value=${`v${index}`}>Option ${index}</lr-option>`,
    );
  }

  async function openWith(attrs: string, count = 30): Promise<LyraCombobox> {
    const el = (await fixture(
      html`<lr-combobox>${manyOptions(count)}</lr-combobox>`,
    )) as LyraCombobox;
    if (attrs) {
      const [name, value] = attrs.split('=');
      el.setAttribute(name!, value!);
    }
    el.open = true;
    await el.updateComplete;
    await aTimeout(0);
    return el;
  }

  const listbox = (el: LyraCombobox): HTMLElement =>
    el.shadowRoot!.querySelector<HTMLElement>('[part="listbox"]')!;

  it('imposes no bound of its own while unset', async () => {
    const el = await openWith('');
    expect(el.visibleOptions).to.equal(undefined);
    expect(
      listbox(el).style.getPropertyValue('max-block-size'),
      'nothing applied, so the stylesheet max-block-size chain is untouched',
    ).to.equal('');
  });

  it('bounds the listbox to the requested row count and leaves the rest scrollable', async () => {
    const el = await openWith('visible-options=3');
    expect(el.visibleOptions).to.equal(3);
    const box = listbox(el);
    await waitUntil(
      () => box.style.getPropertyValue('max-block-size') !== '',
      'the cap is measured and published',
    );

    expect(box.scrollHeight, 'the remainder is reachable by scrolling').to.be.greaterThan(
      box.clientHeight,
    );
  });

  it('imposes no bound when there are fewer options than the cap', async () => {
    const el = await openWith('visible-options=10', 3);
    expect(
      listbox(el).style.getPropertyValue('max-block-size'),
      'nothing to cap',
    ).to.equal('');
  });

  it('normalizes a garbage, zero, or negative cap instead of collapsing the popup', async () => {
    for (const raw of ['not-a-number', '0', '-4']) {
      const el = await openWith(`visible-options=${raw}`);
      expect(
        listbox(el).style.getPropertyValue('max-block-size'),
        `${raw} must not collapse the listbox`,
      ).to.equal('');
    }
  });
});

describe("lr-combobox activation event", () => {
  const openCombobox = async (
    template = html`
      <lr-combobox value="b">
        <lr-option value="a">Apple</lr-option>
        <lr-option value="b">Banana</lr-option>
        <lr-option value="c">Cherry</lr-option>
      </lr-combobox>
    `
  ): Promise<LyraCombobox> => {
    const el = (await fixture(template)) as LyraCombobox;
    await el.updateComplete;
    el.open = true;
    await el.updateComplete;
    await aTimeout(0);
    return el;
  };

  const rows = (el: LyraCombobox): HTMLElement[] =>
    [...el.shadowRoot!.querySelectorAll('[part="option"]')] as HTMLElement[];

  it("fires lr-activate without change/lr-change when the already-selected row is picked again", async () => {
    const el = await openCombobox();
    const activated: string[] = [];
    let changeCount = 0;
    el.addEventListener("change", () => changeCount++);
    el.addEventListener("lr-change", () => changeCount++);
    el.addEventListener("lr-activate", (e) =>
      activated.push((e as CustomEvent<{ value: string }>).detail.value)
    );
    rows(el)[1]!.click();
    await el.updateComplete;
    expect(activated).to.deep.equal(["b"]);
    expect(el.value).to.equal("b");
    expect(changeCount, "re-picking the current row is not a change").to.equal(0);
  });

  it("emits change and lr-change before lr-activate for a moving pick, and bubbles composed and uncancelable", async () => {
    const el = await openCombobox();
    const order: string[] = [];
    const flags: Array<Record<string, boolean>> = [];
    el.addEventListener("change", () => order.push("change"));
    el.addEventListener("lr-change", () => order.push("lr-change"));
    const documentListener = (e: Event): void => {
      order.push("lr-activate");
      flags.push({
        bubbles: e.bubbles,
        cancelable: e.cancelable,
        composed: e.composed,
      });
    };
    document.addEventListener("lr-activate", documentListener);
    try {
      rows(el)[2]!.click();
      await el.updateComplete;
    } finally {
      document.removeEventListener("lr-activate", documentListener);
    }
    expect(el.value).to.equal("c");
    expect(order).to.deep.equal(["change", "lr-change", "lr-activate"]);
    expect(flags).to.deep.equal([
      { bubbles: true, cancelable: false, composed: true },
    ]);
  });

  it("stays silent for a disabled row and for a programmatic value assignment", async () => {
    const el = await openCombobox(html`
      <lr-combobox value="a">
        <lr-option value="a">Apple</lr-option>
        <lr-option value="b" disabled>Banana</lr-option>
      </lr-combobox>
    `);
    let activateCount = 0;
    el.addEventListener("lr-activate", () => activateCount++);
    rows(el)[1]!.click();
    await el.updateComplete;
    expect(el.value, "the disabled row never selects").to.equal("a");
    expect(activateCount, "a disabled row activates nothing").to.equal(0);

    el.value = "b";
    await el.updateComplete;
    expect(el.value, "the assignment still lands").to.equal("b");
    expect(
      activateCount,
      "a host writing `value` is not a user activation"
    ).to.equal(0);
  });
});
