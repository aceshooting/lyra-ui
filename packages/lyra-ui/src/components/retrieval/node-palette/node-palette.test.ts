import { fixture, expect, html, waitUntil, oneEvent } from "@open-wc/testing";
import { LitElement, type PropertyValues } from "lit";
import "./node-palette.js";
import type {
  LyraNodePalette,
  LyraNodePaletteEventMap,
  LyraPaletteItem,
} from "./node-palette.js";
import { FLOW_PALETTE_MIME_TYPE } from "../../data/flow-canvas/flow-canvas.js";
import { styles } from "./node-palette.styles.js";
import { ANNOUNCEMENT_SINK_ATTRIBUTE } from "../../../internal/announcer.js";

function sinkElement(): HTMLElement | null {
  return document.querySelector<HTMLElement>(
    `[${ANNOUNCEMENT_SINK_ATTRIBUTE}="polite"]`
  );
}

function sinkTexts(): string[] {
  return Array.from(sinkElement()?.children ?? []).map(
    (child) => child.textContent ?? ""
  );
}

const items: LyraPaletteItem[] = [
  {
    type: "http-request",
    label: "HTTP Request",
    category: "Data",
    keywords: ["fetch", "api"],
  },
  { type: "transform", label: "Transform", category: "Data" },
  { type: "email", label: "Send Email", category: "Actions", disabled: true },
  { type: "webhook", label: "Webhook", category: "Actions" },
];

it("defaults to empty items and an unset label", async () => {
  const el = (await fixture(
    html`<lr-node-palette></lr-node-palette>`
  )) as LyraNodePalette;
  expect(el.items).to.deep.equal([]);
  expect(el.label).to.be.undefined;
});

it("keeps an explicitly empty label genuinely empty instead of falling back to the localized default", async () => {
  const el = (await fixture(
    html`<lr-node-palette label="" .items=${items}></lr-node-palette>`
  )) as LyraNodePalette;
  await el.updateComplete;
  const listbox = el.shadowRoot!.querySelector('[role="listbox"]')!;
  expect(el.label).to.equal("");
  expect(listbox.getAttribute("aria-label")).to.equal("");

  el.setAttribute("aria-label", "Custom");
  await el.updateComplete;
  expect(listbox.getAttribute("aria-label")).to.equal("");
});

it("keeps explicit-empty and dynamic host naming distinct from the listbox label", async () => {
  const el = (await fixture(
    html`<lr-node-palette .items=${items}></lr-node-palette>`
  )) as LyraNodePalette;
  await el.updateComplete;
  const listbox = el.shadowRoot!.querySelector('[role="listbox"]')!;
  expect(listbox.getAttribute("aria-label") === "Node palette").to.equal(true);

  el.label = "Workflow nodes";
  await el.updateComplete;
  expect(listbox.getAttribute("aria-label")).to.equal("Workflow nodes");

  el.setAttribute("aria-label", "Automation blocks");
  await el.updateComplete;
  expect(el.accessibleLabel).to.equal("Automation blocks");
  expect(el.getAttribute("aria-label")).to.equal("Automation blocks");
  expect(listbox.getAttribute("aria-label")).to.equal("Workflow nodes");

  el.setAttribute("aria-label", "");
  await el.updateComplete;
  expect(el.hasAttribute("aria-label")).to.equal(true);
  expect(el.getAttribute("aria-label")).to.equal("");
  expect(listbox.getAttribute("aria-label")).to.equal("Workflow nodes");

  el.setAttribute("aria-label", "Revised blocks");
  await el.updateComplete;
  expect(el.getAttribute("aria-label")).to.equal("Revised blocks");
  expect(listbox.getAttribute("aria-label")).to.equal("Workflow nodes");

  el.removeAttribute("aria-label");
  await el.updateComplete;
  expect(el.getAttribute("aria-label")).to.equal(null);
  expect(listbox.getAttribute("aria-label")).to.equal("Workflow nodes");
});

it("falls back to the localized listbox label when the host names itself but the palette's own label stays unset", async () => {
  const el = (await fixture(
    html`<lr-node-palette aria-label="Host name" .items=${items}></lr-node-palette>`
  )) as LyraNodePalette;
  await el.updateComplete;
  expect(el.label).to.be.undefined;
  const listbox = el.shadowRoot!.querySelector('[role="listbox"]')!;
  // hostLabel !== null (the host named itself) but el.label is unset, so the listbox falls all
  // the way through to the localized default instead of adopting the host's own name.
  expect(listbox.getAttribute("aria-label")).to.equal("Node palette");
});

it("renders one item per entry, grouped by category in first-appearance order", async () => {
  const el = (await fixture(
    html`<lr-node-palette .items=${items}></lr-node-palette>`
  )) as LyraNodePalette;
  await el.updateComplete;
  const headers = el.shadowRoot!.querySelectorAll('[part="group-header"]');
  expect(Array.from(headers).map((h) => h.textContent?.trim())).to.deep.equal([
    "Data",
    "Actions",
  ]);
  expect(el.shadowRoot!.querySelectorAll('[part="item"]').length).to.equal(4);
  const groups = [...el.shadowRoot!.querySelectorAll('[role="group"]')];
  expect(groups.length).to.equal(2);
  expect(groups[0]!.getAttribute("aria-labelledby")).to.equal(headers[0]!.id);
});

it("filters on label, keywords, and category, case-folded", async () => {
  const el = (await fixture(
    html`<lr-node-palette .items=${items}></lr-node-palette>`
  )) as LyraNodePalette;
  await el.updateComplete;
  const input = el.shadowRoot!.querySelector("input") as HTMLInputElement;
  input.value = "API";
  input.dispatchEvent(new Event("input", { bubbles: true }));
  await el.updateComplete;
  const labels = Array.from(
    el.shadowRoot!.querySelectorAll('[part="item-label"]')
  ).map((n) => n.textContent);
  expect(labels).to.deep.equal(["HTTP Request"]);
});

it("renders nodePaletteEmpty when the filter matches nothing", async () => {
  const el = (await fixture(
    html`<lr-node-palette .items=${items}></lr-node-palette>`
  )) as LyraNodePalette;
  await el.updateComplete;
  const input = el.shadowRoot!.querySelector("input") as HTMLInputElement;
  input.value = "nonexistent";
  input.dispatchEvent(new Event("input", { bubbles: true }));
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="empty"]')!.textContent).to.equal(
    "No matching nodes."
  );
});

it("ArrowDown from the search field moves real DOM focus to the first enabled item", async () => {
  const el = (await fixture(
    html`<lr-node-palette .items=${items}></lr-node-palette>`
  )) as LyraNodePalette;
  await el.updateComplete;
  const input = el.shadowRoot!.querySelector("input") as HTMLInputElement;
  input.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "ArrowDown",
      bubbles: true,
      cancelable: true,
    })
  );
  await waitUntil(
    () => el.shadowRoot!.activeElement?.getAttribute("part") === "item"
  );
  expect((el.shadowRoot!.activeElement as HTMLElement).textContent).to.include(
    "HTTP Request"
  );
});

it("ArrowUp from the first item returns focus to the search field", async () => {
  const el = (await fixture(
    html`<lr-node-palette .items=${items}></lr-node-palette>`
  )) as LyraNodePalette;
  await el.updateComplete;
  const firstItem = el.shadowRoot!.querySelector(
    '[part="item"]'
  ) as HTMLElement;
  firstItem.focus();
  firstItem.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "ArrowUp",
      bubbles: true,
      cancelable: true,
    })
  );
  // Deriving safe primitives (tagName + part attribute) instead of comparing DOM Element
  // references directly -- a direct `.to.equal()` of two live nodes would, on a future
  // regression where focus lands somewhere else, throw DataCloneError while
  // @web/test-runner-mocha serializes the failure via structuredClone, silently hanging the
  // whole test session instead of failing this one assertion normally.
  expect(el.shadowRoot!.activeElement?.tagName).to.equal("INPUT");
  expect(el.shadowRoot!.activeElement?.getAttribute("part")).to.equal("search");
});

it("ArrowUp from a non-first item moves real focus to its predecessor, not the search field", async () => {
  const el = (await fixture(
    html`<lr-node-palette .items=${items}></lr-node-palette>`
  )) as LyraNodePalette;
  await el.updateComplete;
  // rovingIndex 1 -- "Transform", the second enabled row.
  const second = el.shadowRoot!.querySelectorAll<HTMLElement>(
    '[part="item"]'
  )[1]!;
  second.focus();
  second.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "ArrowUp",
      bubbles: true,
      cancelable: true,
    })
  );
  await waitUntil(
    () =>
      el.shadowRoot!.activeElement?.textContent?.includes("HTTP Request") ??
      false
  );
  expect(el.shadowRoot!.activeElement?.textContent).to.include(
    "HTTP Request"
  );
  expect(el.shadowRoot!.activeElement?.getAttribute("part")).to.equal("item");
});

it("Enter on an item emits lr-palette-place and lr-select with the same type/item", async () => {
  const el = (await fixture(
    html`<lr-node-palette .items=${items}></lr-node-palette>`
  )) as LyraNodePalette;
  await el.updateComplete;
  let placeDetail: { type: string } | undefined;
  let selectDetail: { item: LyraPaletteItem } | undefined;
  el.addEventListener(
    "lr-palette-place",
    (e) => (placeDetail = (e as CustomEvent).detail)
  );
  el.addEventListener(
    "lr-select",
    (e) => (selectDetail = (e as CustomEvent).detail)
  );
  (el.shadowRoot!.querySelector('[part="item"]') as HTMLElement).dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "Enter",
      bubbles: true,
      cancelable: true,
    })
  );
  expect(placeDetail).to.deep.equal({ type: "http-request" });
  expect(selectDetail?.item.type).to.equal("http-request");
});

it("Space on a focused item also places it, matching Enter", async () => {
  const el = (await fixture(
    html`<lr-node-palette .items=${items}></lr-node-palette>`
  )) as LyraNodePalette;
  await el.updateComplete;
  let placeDetail: { type: string } | undefined;
  el.addEventListener(
    "lr-palette-place",
    (e) => (placeDetail = (e as CustomEvent).detail)
  );
  (el.shadowRoot!.querySelector('[part="item"]') as HTMLElement).dispatchEvent(
    new KeyboardEvent("keydown", {
      key: " ",
      bubbles: true,
      cancelable: true,
    })
  );
  expect(placeDetail).to.deep.equal({ type: "http-request" });
});

it("click on an item emits the same pair of events", async () => {
  const el = (await fixture(
    html`<lr-node-palette .items=${items}></lr-node-palette>`
  )) as LyraNodePalette;
  await el.updateComplete;
  let fired = false;
  el.addEventListener("lr-palette-place", () => (fired = true));
  (el.shadowRoot!.querySelector('[part="item"]') as HTMLElement).click();
  expect(fired).to.be.true;
});

it("a disabled item is not draggable, not roving-focusable, and does not place on click", async () => {
  const el = (await fixture(
    html`<lr-node-palette .items=${items}></lr-node-palette>`
  )) as LyraNodePalette;
  await el.updateComplete;
  const disabledItem = el.shadowRoot!.querySelectorAll(
    '[part="item"]'
  )[2] as HTMLElement; // "Send Email"
  expect(disabledItem.getAttribute("draggable")).to.equal("false");
  expect(disabledItem.getAttribute("tabindex")).to.equal("-1");
  expect(disabledItem.hasAttribute("aria-describedby")).to.be.false;
  let fired = false;
  el.addEventListener("lr-palette-place", () => (fired = true));
  disabledItem.click();
  expect(fired).to.be.false;
});

it("steps over disabled rows when moving focus through the enabled roving list", async () => {
  const el = (await fixture(
    html`<lr-node-palette .items=${items}></lr-node-palette>`
  )) as LyraNodePalette;
  const second =
    el.shadowRoot!.querySelectorAll<HTMLElement>('[part="item"]')[1]!;
  second.focus();
  second.dispatchEvent(
    new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true })
  );
  await el.updateComplete;
  expect(el.shadowRoot!.activeElement?.textContent).to.contain("Webhook");
});

it("moves focus via ArrowDown/Home/End through the exact filtered+categorized roving order", async () => {
  const el = (await fixture(
    html`<lr-node-palette .items=${items}></lr-node-palette>`
  )) as LyraNodePalette;
  await el.updateComplete;
  const input = el.shadowRoot!.querySelector("input") as HTMLInputElement;
  input.value = "e";
  input.dispatchEvent(new Event("input", { bubbles: true }));
  await el.updateComplete;

  // Matches "HTTP Request" (label/keyword), "Send Email" (label, but disabled), and "Webhook"
  // (label); "Transform" matches nothing. The roving order below must skip the disabled match
  // entirely -- this exercises filtered() -> categorized() -> rovingList() together, the exact
  // chain now cached once per update cycle.
  const labels = Array.from(
    el.shadowRoot!.querySelectorAll('[part="item-label"]')
  ).map((n) => n.textContent);
  expect(labels).to.deep.equal(["HTTP Request", "Send Email", "Webhook"]);

  input.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "ArrowDown",
      bubbles: true,
      cancelable: true,
    })
  );
  await waitUntil(
    () => el.shadowRoot!.activeElement?.getAttribute("part") === "item"
  );
  expect(el.shadowRoot!.activeElement?.textContent).to.include("HTTP Request");

  el.shadowRoot!.activeElement!.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "End",
      bubbles: true,
      cancelable: true,
    })
  );
  await waitUntil(
    () =>
      el.shadowRoot!.activeElement?.textContent?.includes("Webhook") ?? false
  );
  expect(el.shadowRoot!.activeElement?.textContent).to.include("Webhook");

  el.shadowRoot!.activeElement!.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "Home",
      bubbles: true,
      cancelable: true,
    })
  );
  await waitUntil(
    () =>
      el.shadowRoot!.activeElement?.textContent?.includes("HTTP Request") ??
      false
  );
  expect(el.shadowRoot!.activeElement?.textContent).to.include("HTTP Request");
});

it("ArrowDown from the search field is a no-op when an active filter matches nothing", async () => {
  const el = (await fixture(
    html`<lr-node-palette .items=${items}></lr-node-palette>`
  )) as LyraNodePalette;
  await el.updateComplete;
  const input = el.shadowRoot!.querySelector("input") as HTMLInputElement;
  input.value = "nonexistent";
  input.dispatchEvent(new Event("input", { bubbles: true }));
  await el.updateComplete;
  input.focus();
  // Exercises the `lastRenderedRovingList.length === 0` early-return in onFieldKeyDown -- the
  // cached field must reflect the just-rendered (empty) filtered/categorized state, not a stale
  // pre-filter list.
  input.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "ArrowDown",
      bubbles: true,
      cancelable: true,
    })
  );
  await el.updateComplete;
  expect(el.shadowRoot!.activeElement?.tagName).to.equal("INPUT");
});

it("assigns same-object duplicate entries distinct roving positions", async () => {
  const duplicate: LyraPaletteItem = { type: 'duplicate', label: 'Duplicate' };
  const el = (await fixture(
    html`<lr-node-palette .items=${[duplicate, duplicate]}></lr-node-palette>`
  )) as LyraNodePalette;
  const rows = [
    ...el.shadowRoot!.querySelectorAll<HTMLElement>('[part="item"]'),
  ];
  expect(rows.map((row) => row.getAttribute("tabindex"))).to.deep.equal([
    "0",
    "-1",
  ]);

  rows[0]!.focus();
  rows[0]!.dispatchEvent(
    new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true })
  );
  await waitUntil(
    () => rows.indexOf(el.shadowRoot!.activeElement as HTMLElement) === 1
  );
  expect(rows.indexOf(el.shadowRoot!.activeElement as HTMLElement)).to.equal(1);
  expect(rows.map((row) => row.getAttribute("tabindex"))).to.deep.equal([
    "-1",
    "0",
  ]);
});

it("keeps roving state and real focus on a surviving item across reorder, then transfers it on shrink", async () => {
  const first: LyraPaletteItem = { type: 'first', label: 'First' };
  const second: LyraPaletteItem = { type: 'second', label: 'Second' };
  const third: LyraPaletteItem = { type: 'third', label: 'Third' };
  const el = (await fixture(
    html`<lr-node-palette .items=${[first, second, third]}></lr-node-palette>`
  )) as LyraNodePalette;
  const initialRows = [
    ...el.shadowRoot!.querySelectorAll<HTMLElement>('[part="item"]'),
  ];
  initialRows[1]!.focus();
  await el.updateComplete;
  expect(initialRows.map((row) => row.getAttribute("tabindex"))).to.deep.equal([
    "-1",
    "0",
    "-1",
  ]);

  el.items = [third, first, second];
  await el.updateComplete;
  await new Promise((resolve) => requestAnimationFrame(resolve));
  expect(el.shadowRoot!.activeElement?.textContent).to.contain("Second");
  expect(
    [...el.shadowRoot!.querySelectorAll<HTMLElement>('[part="item"]')].map(
      (row) => row.getAttribute("tabindex")
    )
  ).to.deep.equal(["-1", "-1", "0"]);

  el.items = [third, first];
  await el.updateComplete;
  await new Promise((resolve) => requestAnimationFrame(resolve));
  expect(el.shadowRoot!.activeElement?.textContent).to.contain("First");
  expect(
    [...el.shadowRoot!.querySelectorAll<HTMLElement>('[part="item"]')].map(
      (row) => row.getAttribute("tabindex")
    )
  ).to.deep.equal(["-1", "0"]);
});

it("preserves focus on the correct occurrence of a same-object duplicate across a reorder", async () => {
  const dup: LyraPaletteItem = { type: "dup", label: "Dup" };
  const other: LyraPaletteItem = { type: "other", label: "Other" };
  const el = (await fixture(
    html`<lr-node-palette .items=${[dup, dup, other]}></lr-node-palette>`
  )) as LyraNodePalette;
  await el.updateComplete;
  const rows = [
    ...el.shadowRoot!.querySelectorAll<HTMLElement>('[part="item"]'),
  ];
  rows[1]!.focus(); // the *second* occurrence of dup
  await el.updateComplete;

  el.items = [other, dup, dup];
  await el.updateComplete;
  await new Promise((resolve) => requestAnimationFrame(resolve));

  // Focus must follow the second occurrence of dup (now at index 2), not just any dup.
  const newRows = [
    ...el.shadowRoot!.querySelectorAll<HTMLElement>('[part="item"]'),
  ];
  expect(newRows.indexOf(el.shadowRoot!.activeElement as HTMLElement)).to.equal(
    2
  );
  expect(newRows.map((row) => row.getAttribute("tabindex"))).to.deep.equal([
    "-1",
    "-1",
    "0",
  ]);
});

it("moves focus to the search field when items shrink to none while an item has real focus", async () => {
  const el = (await fixture(
    html`<lr-node-palette .items=${items}></lr-node-palette>`
  )) as LyraNodePalette;
  await el.updateComplete;
  const firstItem = el.shadowRoot!.querySelector(
    '[part="item"]'
  ) as HTMLElement;
  firstItem.focus();
  await el.updateComplete;

  el.items = [];
  await el.updateComplete;

  expect(el.shadowRoot!.activeElement?.tagName).to.equal("INPUT");
  expect(el.shadowRoot!.activeElement?.getAttribute("part")).to.equal(
    "search"
  );
});

it("focuses the search field as an interim fallback when the preserved item cannot be found among the previous elements, then the roving-position follow-up takes over", async () => {
  const original: LyraPaletteItem[] = [
    { type: "a", label: "Alpha" },
    { type: "b", label: "Beta" },
    { type: "c", label: "Gamma" },
  ];
  const el = (await fixture(
    html`<lr-node-palette .items=${original}></lr-node-palette>`
  )) as LyraNodePalette;
  await el.updateComplete;
  const rows = [
    ...el.shadowRoot!.querySelectorAll<HTMLElement>('[part="item"]'),
  ];
  rows[1]!.focus(); // "Beta"
  await el.updateComplete;

  const input = el.shadowRoot!.querySelector("input") as HTMLInputElement;
  let inputFocused = false;
  input.addEventListener("focus", () => (inputFocused = true));

  // A completely disjoint items array: nothing in the new roving list can be matched back to
  // any previously-rendered DOM element, so the survivingOldElement lookup misses and the code
  // falls back to focusing the search field as an interim step.
  const disjoint: LyraPaletteItem[] = [
    { type: "x", label: "Xi" },
    { type: "y", label: "Yo" },
    { type: "z", label: "Zed" },
  ];
  el.items = disjoint;
  await el.updateComplete;

  expect(inputFocused, "the search field is focused as a fallback").to.be
    .true;
  // The pendingFocusIndex follow-up in updated() then moves real focus on to the clamped roving
  // position once the new DOM has actually committed.
  const newRows = [
    ...el.shadowRoot!.querySelectorAll<HTMLElement>('[part="item"]'),
  ];
  expect(newRows.indexOf(el.shadowRoot!.activeElement as HTMLElement)).to.equal(
    1
  );
});

it("hides arbitrary item icons from the accessible name", async () => {
  const el = (await fixture(
    html`<lr-node-palette
      .items=${[{ type: "x", label: "Node", icon: html`Icon text` }]}
    ></lr-node-palette>`
  )) as LyraNodePalette;
  expect(
    el
      .shadowRoot!.querySelector('[part="item-icon"]')!
      .getAttribute("aria-hidden")
  ).to.equal("true");
});

it("renders an item's optional description text", async () => {
  const el = (await fixture(
    html`<lr-node-palette
      .items=${[
        { type: "x", label: "Node", description: "Does a thing" },
      ]}
    ></lr-node-palette>`
  )) as LyraNodePalette;
  await el.updateComplete;
  expect(
    el.shadowRoot!.querySelector('[part="item-description"]')!.textContent
  ).to.equal("Does a thing");
});

it("dragstart on an enabled item writes the FLOW_PALETTE_MIME_TYPE payload plus a text/plain fallback", async () => {
  const el = (await fixture(
    html`<lr-node-palette .items=${items}></lr-node-palette>`
  )) as LyraNodePalette;
  await el.updateComplete;
  const item = el.shadowRoot!.querySelector('[part="item"]') as HTMLElement;
  const dataTransfer = new DataTransfer();
  item.dispatchEvent(
    new DragEvent("dragstart", {
      bubbles: true,
      cancelable: true,
      dataTransfer,
    })
  );
  expect(
    JSON.parse(dataTransfer.getData(FLOW_PALETTE_MIME_TYPE))
  ).to.deep.equal({ type: "http-request" });
  expect(dataTransfer.getData("text/plain")).to.equal("HTTP Request");
  // effectAllowed isn't asserted here: Chromium silently discards writes to it for a synthetic
  // (non-native) DragEvent dispatch, unlike setData/getData which work fine -- an environment
  // limitation of testing HTML5 DnD via dispatchEvent(), not something the implementation controls.
});

it("every item carries the sr-only drag hint via aria-describedby", async () => {
  const el = (await fixture(
    html`<lr-node-palette .items=${items}></lr-node-palette>`
  )) as LyraNodePalette;
  await el.updateComplete;
  const item = el.shadowRoot!.querySelector('[part="item"]') as HTMLElement;
  const hintId = item.getAttribute("aria-describedby")!;
  expect(el.shadowRoot!.getElementById(hintId)!.textContent).to.equal(
    "Drag to the canvas, or press Enter to place"
  );
});

it("dims a disabled item through the shared disabled-opacity token", async () => {
  const wrapper = (await fixture(
    html`<div style="--lr-theme-opacity-disabled: 0.25">
      <lr-node-palette .items=${items}></lr-node-palette>
    </div>`
  )) as HTMLElement;
  const el = wrapper.querySelector("lr-node-palette") as LyraNodePalette;
  await el.updateComplete;
  const disabledItem = el.shadowRoot!.querySelectorAll(
    '[part="item"]'
  )[2] as HTMLElement;
  expect(disabledItem.getAttribute("aria-disabled")).to.equal("true");
  expect(getComputedStyle(disabledItem).opacity).to.equal("0.25");
});

it("keeps the search and compact item at the live hit-area token override", async () => {
  const el = (await fixture(
    html`<lr-node-palette
      style="--lr-icon-button-size: 52px; inline-size: 32px"
      .items=${[{ type: "x", label: "X" }]}
    ></lr-node-palette>`
  )) as LyraNodePalette;
  for (const part of ["search", "item"]) {
    const target = el.shadowRoot!.querySelector(
      `[part="${part}"]`
    ) as HTMLElement;
    const bounds = target.getBoundingClientRect();
    expect(bounds.width, part).to.be.at.least(52);
    expect(bounds.height, part).to.be.at.least(52);
  }
});

it("chains updated() to super.updated() so a mixin layered under LyraElement would still run", async () => {
  // No shared mixin actually overrides updated() today, so the only way to prove the chain is
  // live (rather than grepping source text for the call) is to patch the base-class hook itself
  // -- the exact hook a future mixin would extend -- and confirm it actually fires. Same pattern
  // as branch-picker.test.ts's identical check.
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
    const el = (await fixture(
      html`<lr-node-palette></lr-node-palette>`
    )) as LyraNodePalette;
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

describe("localization", () => {
  it("localizes the search field, listbox, empty state, and drag hint via .strings", async () => {
    const el = (await fixture(html`
      <lr-node-palette
        .strings=${{
          search: "Rechercher",
          nodePalettePlaceholder: "Rechercher des nœuds…",
          nodePaletteLabel: "Palette de nœuds",
          nodePaletteEmpty: "Aucun nœud correspondant.",
          nodePaletteDragHint:
            "Faites glisser vers le canevas, ou appuyez sur Entrée",
        }}
      ></lr-node-palette>
    `)) as LyraNodePalette;
    await el.updateComplete;
    const input = el.shadowRoot!.querySelector("input") as HTMLInputElement;
    expect(input.getAttribute("aria-label")).to.equal("Rechercher");
    expect(input.getAttribute("placeholder")).to.equal("Rechercher des nœuds…");
    expect(
      el
        .shadowRoot!.querySelector('[role="listbox"]')!
        .getAttribute("aria-label")
    ).to.equal("Palette de nœuds");
    expect(
      el.shadowRoot!.querySelector('[part="empty"]')!.textContent
    ).to.equal("Aucun nœud correspondant.");
    expect(el.shadowRoot!.querySelector("span.sr-only")!.textContent).to.equal(
      "Faites glisser vers le canevas, ou appuyez sur Entrée"
    );
  });

  it("recomputes locale-aware search matches when the effective locale changes", async () => {
    const el = (await fixture(
      html`<lr-node-palette
        locale="en"
        .items=${[{ type: "city", label: "İzmir" }]}
      ></lr-node-palette>`
    )) as LyraNodePalette;
    const input = el.shadowRoot!.querySelector("input") as HTMLInputElement;
    input.value = "iz";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll('[part="item"]')).to.have.length(0);

    el.locale = "tr";
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll('[part="item"]')).to.have.length(1);
    expect(
      el.shadowRoot!.querySelector('[part="item-label"]')!.textContent
    ).to.equal("İzmir");
  });
});

it("is accessible with items, groups, and a disabled item", async () => {
  const el = (await fixture(
    html`<lr-node-palette .items=${items}></lr-node-palette>`
  )) as LyraNodePalette;
  await el.updateComplete;
  await expect(el).to.be.accessible();
});

it("never announces the initial item count on mount, but does announce a later filter change", async () => {
  const el = (await fixture(
    html`<lr-node-palette .items=${items}></lr-node-palette>`
  )) as LyraNodePalette;
  await el.updateComplete;
  const mirror = el.shadowRoot!.querySelector('[part="live-region"]')!;
  const liveRegionText = () => mirror.textContent?.trim() ?? "";
  expect(liveRegionText()).to.equal("");
  expect(mirror.getAttribute("role")).to.equal(null);
  expect(mirror.getAttribute("aria-live")).to.equal(null);
  expect(mirror.getAttribute("aria-hidden")).to.equal("true");
  expect(sinkTexts()).to.deep.equal([]);
  // Real timer, margined past the Announcer's default 500ms throttle -- long enough for a
  // regression that re-introduces an unguarded mount announcement to actually flush and fail
  // this assertion, per this repo's "no fake timers under wtr" testing convention.
  await new Promise((r) => setTimeout(r, 600));
  expect(liveRegionText()).to.equal("");

  const input = el.shadowRoot!.querySelector("input") as HTMLInputElement;
  input.value = "API";
  input.dispatchEvent(new Event("input", { bubbles: true }));
  await el.updateComplete;
  await new Promise((r) => setTimeout(r, 600));
  expect(liveRegionText()).to.include("1");
  expect(sinkTexts().at(-1)).to.include("1");
});

it("localizes the whole filtered-result announcement and formats its count with the effective locale", async () => {
  const el = (await fixture(html`
    <lr-node-palette
      lang="ar-u-nu-arab"
      .items=${items}
      .strings=${{
        nodePaletteResultCount: {
          one: "{count} نتيجة",
          other: "{count} نتائج",
        },
      }}
    ></lr-node-palette>
  `)) as LyraNodePalette;
  await el.updateComplete;

  const input = el.shadowRoot!.querySelector("input") as HTMLInputElement;
  input.value = "Data";
  input.dispatchEvent(new Event("input", { bubbles: true }));
  await el.updateComplete;
  await new Promise((r) => setTimeout(r, 600));

  expect(
    el.shadowRoot!.querySelector('[part="live-region"]')!.textContent?.trim()
  ).to.equal("٢ نتائج");
  expect(sinkTexts().at(-1)).to.equal("٢ نتائج");
});

it("releases and reacquires its shared announcement sink across disconnect and reconnect", async () => {
  const el = (await fixture(
    html`<lr-node-palette></lr-node-palette>`
  )) as LyraNodePalette;
  expect(sinkElement() !== null).to.be.true;
  el.remove();
  expect(sinkElement() === null).to.be.true;
  document.body.append(el);
  expect(sinkElement() !== null).to.be.true;
  el.remove();
  expect(sinkElement() === null).to.be.true;
});

it("adoptedCallback re-arms the announcer's timer host in the new owner window", async () => {
  const el = (await fixture(
    html`<lr-node-palette .items=${items}></lr-node-palette>`
  )) as LyraNodePalette;
  await el.updateComplete;
  const frame = document.createElement("iframe");
  document.body.append(frame);
  const frameDocument = frame.contentDocument!;
  try {
    el.remove();
    frameDocument.body.append(frameDocument.adoptNode(el));
    // The reconnect re-arms isMounting (see disconnectedCallback), so this first post-reconnect
    // update stays silent by design, matching the "never announce on mount" contract -- spend it
    // before checking that the *next* change announces normally, which is what actually proves
    // adoptedCallback re-armed the announcer's timer host in the new window rather than leaving
    // it silently broken.
    el.items = [...items];
    await el.updateComplete;

    // If adoptedCallback failed to re-arm the announcer's timer host in the new window, this
    // announcement would silently never flush.
    const input = el.shadowRoot!.querySelector("input") as HTMLInputElement;
    input.value = "API";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await el.updateComplete;
    await new Promise((r) => setTimeout(r, 600));

    const mirror = el.shadowRoot!.querySelector('[part="live-region"]')!;
    expect(mirror.textContent?.trim()).to.include("1");
  } finally {
    el.remove();
    frame.remove();
  }
});

it("gives the search field a focus-visible ring and resets the native search-cancel glyph", () => {
  const css = styles.cssText.replace(/\s+/g, " ");
  expect(css).to.match(/\[part='search'\]:focus-visible\s*\{[^}]*outline:/);
  expect(css).to.match(/\[part='search'\]::-webkit-search-cancel-button/);
});

it("renders the search field's ::placeholder in the shared quiet-text token's color instead of the UA default", async () => {
  const el = (await fixture(
    html`<lr-node-palette
      style="--lr-color-text-quiet: rgb(12, 34, 56)"
    ></lr-node-palette>`
  )) as LyraNodePalette;
  await el.updateComplete;
  const input = el.shadowRoot!.querySelector(
    '[part="search"]'
  ) as HTMLInputElement;
  expect(getComputedStyle(input, "::placeholder").color).to.equal(
    "rgb(12, 34, 56)"
  );
});

it("relays one realm-correct native focus/blur pair with relatedTarget preserved", async () => {
  const el = (await fixture(
    html`<lr-node-palette .items=${items}></lr-node-palette>`
  )) as LyraNodePalette;
  await el.updateComplete;
  const input = el.shadowRoot!.querySelector("input") as HTMLInputElement;
  const related = document.createElement("button");
  const seen: FocusEvent[] = [];
  el.addEventListener("focus", (event) => seen.push(event));
  el.addEventListener("blur", (event) => seen.push(event));

  input.dispatchEvent(new FocusEvent("focus", { relatedTarget: related }));
  input.dispatchEvent(new FocusEvent("blur", { relatedTarget: related }));

  expect(seen.map((event) => event.type)).to.deep.equal(["focus", "blur"]);
  expect(seen.every((event) => event instanceof FocusEvent)).to.equal(true);
  expect(
    seen.every((event) => event.constructor === window.FocusEvent)
  ).to.equal(true);
  expect(seen.every((event) => event.bubbles && event.composed)).to.equal(true);
  expect(seen.map((event) => event.relatedTarget?.nodeName)).to.deep.equal([
    "BUTTON",
    "BUTTON",
  ]);
});

it("types the bridged focus and blur events in the public EventMap", () => {
  const events: [
    LyraNodePaletteEventMap["focus"],
    LyraNodePaletteEventMap["blur"]
  ] = [new FocusEvent("focus"), new FocusEvent("blur")];
  expect(events.map((event) => event.type)).to.deep.equal(["focus", "blur"]);
});

it("wraps the item hover/focus-visible rule in :where() so a consumer's ::part(item):hover wins without !important", async () => {
  const el = (await fixture(
    html`<lr-node-palette .items=${items}></lr-node-palette>`
  )) as LyraNodePalette;
  // jsdom/browser test runners don't synthesize a real :hover pseudo-class from a dispatched
  // event, so assert via the internal rule's specificity instead -- a :where()-wrapped selector
  // has the same *matching* semantics as the unwrapped form but zero specificity contribution
  // from the wrapped parts, so it loses (rather than beats) a consumer's own
  // `::part(item):hover` override. Same technique as attachment-trigger.test.ts's identical
  // "trigger-button hover specificity" check.
  // Chromium's CSSOM normalizes attribute-selector quoting to double quotes in cssText, unlike
  // the single-quoted form the source stylesheet is authored with.
  const internalRule = (el.shadowRoot!.adoptedStyleSheets ?? [])
    .flatMap((sheet) => Array.from(sheet.cssRules))
    .map((rule) => rule.cssText)
    .find(
      (text) =>
        text.includes(":hover") &&
        text.includes('[part="item"]') &&
        text.includes("background")
    );
  expect(internalRule?.includes(":where(")).to.be.true;
});

describe("reorderable", () => {
  function itemLabels(el: LyraNodePalette): string[] {
    return Array.from(
      el.shadowRoot!.querySelectorAll('[part="item-label"]')
    ).map((n) => n.textContent ?? "");
  }

  function pressReorder(row: HTMLElement, key: "ArrowUp" | "ArrowDown"): void {
    row.dispatchEvent(
      new KeyboardEvent("keydown", {
        key,
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      })
    );
  }

  it("is off by default: Ctrl+Arrow still just navigates and never emits lr-reorder", async () => {
    const el = (await fixture(
      html`<lr-node-palette .items=${items}></lr-node-palette>`
    )) as LyraNodePalette;
    await el.updateComplete;
    expect(el.reorderable).to.equal(false);

    let requests = 0;
    el.addEventListener("lr-reorder", () => requests++);
    const first = el.shadowRoot!.querySelector('[part="item"]') as HTMLElement;
    first.focus();
    pressReorder(first, "ArrowDown");
    await el.updateComplete;

    expect(requests, "no request without the opt-in").to.equal(0);
    expect(itemLabels(el), "and the rendered order is untouched").to.deep.equal(
      ["HTTP Request", "Transform", "Send Email", "Webhook"]
    );
    expect(
      el.shadowRoot!.activeElement?.textContent,
      "Ctrl+ArrowDown still moved focus"
    ).to.include("Transform");
  });

  it("requests a move past the next neighbour in the same category, indexed into items", async () => {
    const el = (await fixture(
      html`<lr-node-palette reorderable .items=${items}></lr-node-palette>`
    )) as LyraNodePalette;
    await el.updateComplete;
    const first = el.shadowRoot!.querySelector('[part="item"]') as HTMLElement;
    first.focus();

    const pending = oneEvent(el, "lr-reorder");
    pressReorder(first, "ArrowDown");
    const detail = (await pending)
      .detail as LyraNodePaletteEventMap["lr-reorder"]["detail"];
    expect(detail).to.deep.equal({
      type: "http-request",
      category: "Data",
      fromIndex: 0,
      toIndex: 1,
    });
    expect(
      itemLabels(el),
      "the palette never reorders its own items"
    ).to.deep.equal(["HTTP Request", "Transform", "Send Email", "Webhook"]);
  });

  it("counts a disabled neighbour, so a request never silently jumps over a visible row", async () => {
    const el = (await fixture(
      html`<lr-node-palette reorderable .items=${items}></lr-node-palette>`
    )) as LyraNodePalette;
    await el.updateComplete;
    // Actions group renders [Send Email (disabled), Webhook]; Webhook is the only focusable one.
    const webhook = Array.from(
      el.shadowRoot!.querySelectorAll<HTMLElement>('[part="item"]')
    ).find((row) => row.textContent?.includes("Webhook"))!;
    webhook.focus();
    const pending = oneEvent(el, "lr-reorder");
    pressReorder(webhook, "ArrowUp");
    const detail = (await pending)
      .detail as LyraNodePaletteEventMap["lr-reorder"]["detail"];
    expect(detail).to.deep.equal({
      type: "webhook",
      category: "Actions",
      fromIndex: 3,
      toIndex: 2,
    });
  });

  it("stays silent at a category boundary, so a reorder can never become a recategorization", async () => {
    const el = (await fixture(
      html`<lr-node-palette reorderable .items=${items}></lr-node-palette>`
    )) as LyraNodePalette;
    await el.updateComplete;
    let requests = 0;
    el.addEventListener("lr-reorder", () => requests++);

    const first = el.shadowRoot!.querySelector('[part="item"]') as HTMLElement;
    first.focus();
    pressReorder(first, "ArrowUp"); // already first in "Data"
    const last = Array.from(
      el.shadowRoot!.querySelectorAll<HTMLElement>('[part="item"]')
    ).find((row) => row.textContent?.includes("Webhook"))!;
    last.focus();
    pressReorder(last, "ArrowDown"); // already last in "Actions"
    await el.updateComplete;
    expect(requests).to.equal(0);
  });

  it("groups an uncategorized item under a null category", async () => {
    const loose: LyraPaletteItem[] = [
      { type: "a", label: "Alpha" },
      { type: "b", label: "Beta" },
    ];
    const el = (await fixture(
      html`<lr-node-palette reorderable .items=${loose}></lr-node-palette>`
    )) as LyraNodePalette;
    await el.updateComplete;
    const first = el.shadowRoot!.querySelector('[part="item"]') as HTMLElement;
    first.focus();
    const pending = oneEvent(el, "lr-reorder");
    pressReorder(first, "ArrowDown");
    const detail = (await pending)
      .detail as LyraNodePaletteEventMap["lr-reorder"]["detail"];
    expect(detail).to.deep.equal({
      type: "a",
      category: null,
      fromIndex: 0,
      toIndex: 1,
    });
  });

  it("announces the new position only once the host has actually applied the move", async () => {
    const el = (await fixture(
      html`<lr-node-palette reorderable .items=${items}></lr-node-palette>`
    )) as LyraNodePalette;
    await el.updateComplete;
    const before = sinkTexts().length;
    const first = el.shadowRoot!.querySelector('[part="item"]') as HTMLElement;
    first.focus();
    pressReorder(first, "ArrowDown");
    await el.updateComplete;
    expect(sinkTexts().length, "the request alone announces nothing").to.equal(
      before
    );

    // An unrelated items reassignment that does NOT apply the move must stay silent too.
    el.items = [...items];
    await el.updateComplete;
    expect(sinkTexts().length).to.equal(before);

    el.items = [items[1]!, items[0]!, items[2]!, items[3]!];
    await el.updateComplete;
    await waitUntil(() => sinkTexts().length > before);
    expect(sinkTexts().at(-1)).to.equal("Moved to position 2 of 2");
    expect(itemLabels(el)).to.deep.equal([
      "Transform",
      "HTTP Request",
      "Send Email",
      "Webhook",
    ]);
  });

  it("clears a pending reorder without announcing a move when the pending item is removed instead of swapped", async () => {
    const el = (await fixture(
      html`<lr-node-palette reorderable .items=${items}></lr-node-palette>`
    )) as LyraNodePalette;
    await el.updateComplete;
    const before = sinkTexts().length;
    const first = el.shadowRoot!.querySelector('[part="item"]') as HTMLElement; // "HTTP Request"
    first.focus();
    pressReorder(first, "ArrowDown");
    await el.updateComplete;

    // The host removes the pending item outright instead of ever applying the requested swap --
    // confirmPendingReorder must find it missing from its old category group and give up quietly
    // rather than reporting a bogus position.
    el.items = items.filter((item) => item.type !== "http-request");
    await el.updateComplete;
    await new Promise((r) => setTimeout(r, 600));

    // Exactly one announcement fires -- the ordinary filtered-result-count one from the items
    // change itself -- and it is never the reorder-confirmation text.
    expect(sinkTexts().length - before).to.equal(1);
    expect(sinkTexts().at(-1)).to.not.include("Moved");
  });
});
