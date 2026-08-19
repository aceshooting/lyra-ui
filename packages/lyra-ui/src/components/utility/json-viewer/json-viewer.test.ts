import {
  fixture,
  expect,
  oneEvent,
  html,
  waitUntil,
} from "@open-wc/testing";
import { resetMouse, sendMouse } from "../../../../test/wtr-mouse.js";
import { ANNOUNCEMENT_SINK_ATTRIBUTE } from "../../../internal/announcer.js";
import "./json-viewer.js";
import type { LyraJsonViewer } from "./json-viewer.js";
import { LyraElement } from "../../../internal/lyra-element.js";
import { styles } from "./json-viewer.styles.js";

const sample = {
  name: "Ada Lovelace",
  age: 36,
  active: true,
  bio: null,
  tags: ["mathematician", "writer"],
  address: { city: "London", country: "UK" },
};

let originalClipboard: PropertyDescriptor | undefined;

beforeEach(() => {
  originalClipboard = Object.getOwnPropertyDescriptor(navigator, "clipboard");
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText: () => Promise.resolve() },
  });
});

afterEach(() => {
  if (originalClipboard)
    Object.defineProperty(navigator, "clipboard", originalClipboard);
  else Reflect.deleteProperty(navigator, "clipboard");
});

async function withData(data: unknown): Promise<LyraJsonViewer> {
  const el = (await fixture(
    html`<lr-json-viewer></lr-json-viewer>`
  )) as LyraJsonViewer;
  el.data = data;
  await el.updateComplete;
  return el;
}

it("renders object keys and primitive values with typed parts", async () => {
  const el = await withData(sample);
  const keys = Array.from(el.shadowRoot!.querySelectorAll('[part="key"]')).map(
    (k) => k.textContent
  );
  expect(keys).to.include.members([
    "name",
    "age",
    "active",
    "bio",
    "tags",
    "address",
  ]);

  const values = el.shadowRoot!.querySelectorAll('[part="value"]');
  const stringValue = Array.from(values).find(
    (v) => v.textContent === '"Ada Lovelace"'
  );
  expect(stringValue != null).to.equal(true);
  expect(stringValue!.getAttribute("data-type")).to.equal("string");

  const numberValue = Array.from(values).find((v) => v.textContent === "36");
  expect(numberValue!.getAttribute("data-type")).to.equal("number");

  const boolValue = Array.from(values).find((v) => v.textContent === "true");
  expect(boolValue!.getAttribute("data-type")).to.equal("boolean");

  const nullValue = Array.from(values).find((v) => v.textContent === "null");
  expect(nullValue!.getAttribute("data-type")).to.equal("null");
});

it("renders nested arrays and objects with bracket parts", async () => {
  const el = await withData(sample);
  const brackets = Array.from(
    el.shadowRoot!.querySelectorAll('[part="bracket"]')
  ).map((b) => b.textContent);
  expect(brackets).to.include("{");
  expect(brackets).to.include("}");
  expect(brackets).to.include("[");
  expect(brackets).to.include("]");
});

it("everything is expanded by default when collapsed-depth is unset", async () => {
  const el = await withData(sample);
  // "London" only appears in the rendered tree once `address` (depth 1) is expanded.
  const values = Array.from(
    el.shadowRoot!.querySelectorAll('[part="value"]')
  ).map((v) => v.textContent);
  expect(values).to.include('"London"');
});

it('collapsed-depth="0" collapses the top-level node immediately', async () => {
  const el = await withData(sample);
  el.collapsedDepth = 0;
  await el.updateComplete;

  // Collapsed root shows a preview instead of rendering any nested keys/values.
  expect(el.shadowRoot!.querySelector('[part="key"]') == null).to.be.true;
  expect(el.shadowRoot!.querySelector(".preview")).to.exist;
});

it("normalizes a NaN collapsedDepth to 0 (fully collapsed) instead of silently disabling auto-collapse", async () => {
  const el = await withData(sample);
  el.collapsedDepth = NaN;
  await el.updateComplete;

  expect(el.shadowRoot!.querySelector('[part="key"]') == null).to.be.true;
  expect(el.shadowRoot!.querySelector(".preview")).to.exist;
});

it("collapsed-depth collapses nodes at or beyond that depth but leaves shallower ones expanded", async () => {
  const el = await withData(sample);
  el.collapsedDepth = 1;
  await el.updateComplete;

  // Top-level (depth 0) keys are visible...
  const keys = Array.from(el.shadowRoot!.querySelectorAll('[part="key"]')).map(
    (k) => k.textContent
  );
  expect(keys).to.include("address");
  // ...but address's own children (depth 1) start collapsed.
  const values = Array.from(
    el.shadowRoot!.querySelectorAll('[part="value"]')
  ).map((v) => v.textContent);
  expect(values).to.not.include('"London"');
});

it("toggles a node open/closed on clicking its toggle button", async () => {
  const el = await withData(sample);
  el.collapsedDepth = 0;
  await el.updateComplete;

  const toggle = el.shadowRoot!.querySelector(
    '[part="toggle"]'
  ) as HTMLButtonElement;
  expect(toggle.getAttribute("aria-expanded")).to.equal("false");

  toggle.click();
  await el.updateComplete;
  expect(toggle.getAttribute("aria-expanded")).to.equal("true");
  expect(el.shadowRoot!.querySelector('[part="key"]')!.textContent).to.equal(
    "name"
  );

  toggle.click();
  await el.updateComplete;
  expect(toggle.getAttribute("aria-expanded")).to.equal("false");
});

it("hides the toggle button for leaf/empty nodes but keeps its layout box", async () => {
  const el = await withData({ empty: {} });
  await el.updateComplete;
  const toggles = el.shadowRoot!.querySelectorAll('[part="toggle"]');
  // root (has entries) + the empty object's own placeholder toggle
  expect(toggles.length).to.equal(2);
  expect((toggles[1] as HTMLElement).hasAttribute("hidden")).to.be.true;
});

it("renders an empty object/array as a bare pair of brackets with no item count", async () => {
  const el = await withData({ emptyObject: {}, emptyArray: [] });
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector(".preview") == null).to.be.true;
});

it("shows an item/key count preview only for a collapsed, non-empty container", async () => {
  const el = await withData(sample);
  el.collapsedDepth = 0;
  await el.updateComplete;
  const preview = el.shadowRoot!.querySelector(".preview");
  expect(preview!.textContent).to.equal("6 keys");
});

it("labels a budget-truncated collapsed preview as a lower bound instead of a false total", async () => {
  const broad: Record<string, number> = {};
  for (let index = 0; index < 6000; index += 1) broad[`key-${index}`] = index;
  const el = (await fixture(
    html`<lr-json-viewer collapsed-depth="0" .data=${broad}></lr-json-viewer>`
  )) as LyraJsonViewer;
  const preview = el.shadowRoot!.querySelector(".preview")!;
  expect(preview.textContent?.trim().startsWith("≥")).to.be.true;
  expect(preview.textContent).not.to.equal("5000 keys");
  expect(el.shadowRoot!.querySelectorAll('[part="limit"]').length).to.equal(1);
});

it("locale-formats collapsed item/key counts before interpolation", async () => {
  const data = Object.fromEntries(
    Array.from({ length: 1234 }, (_, index) => [`key-${index}`, index])
  );
  const el = (await fixture(
    html`<lr-json-viewer
      lang="ar"
      collapsed-depth="0"
      .data=${data}
    ></lr-json-viewer>`
  )) as LyraJsonViewer;
  const expected = new Intl.NumberFormat(el.effectiveLocale).format(1234);
  expect(el.shadowRoot!.querySelector(".preview")!.textContent).to.contain(
    expected
  );
});

it("exposes nested JSON membership through list/listitem relationships", async () => {
  const el = await withData({ parent: { child: 1 }, sibling: 2 });
  const tree = el.shadowRoot!.querySelector('[part="tree"]')!;
  expect(tree.getAttribute("role")).to.equal("list");
  const items = [...tree.querySelectorAll('[role="listitem"]')];
  expect(items.length).to.be.greaterThan(2);
  expect(items.some((item) => item.querySelector(':scope > [role="list"]'))).to
    .be.true;
});

it("forwards a host aria-label to the root list owner", async () => {
  const el = (await fixture(
    html`<lr-json-viewer
      aria-label="Response payload"
      .data=${sample}
    ></lr-json-viewer>`
  )) as LyraJsonViewer;
  const tree = el.shadowRoot!.querySelector('[part="tree"]')!;
  expect(tree.getAttribute("role")).to.equal("list");
  expect(tree.getAttribute("aria-label")).to.equal("Response payload");
});

it("forwards an explicitly empty host aria-label to the root list owner", async () => {
  const el = (await fixture(
    html`<lr-json-viewer aria-label="" .data=${sample}></lr-json-viewer>`
  )) as LyraJsonViewer;
  const tree = el.shadowRoot!.querySelector('[part="tree"]')!;
  expect(tree.hasAttribute("aria-label")).to.equal(true);
  expect(tree.getAttribute("aria-label")).to.equal("");
});

it("keeps a dynamically emptied host aria-label on the root list owner and removes it when the host attribute is absent", async () => {
  const el = (await fixture(
    html`<lr-json-viewer
      aria-label="Response payload"
      .data=${sample}
    ></lr-json-viewer>`
  )) as LyraJsonViewer;
  const tree = el.shadowRoot!.querySelector('[part="tree"]')!;
  el.setAttribute("aria-label", "");
  await el.updateComplete;
  expect(tree.hasAttribute("aria-label")).to.equal(true);
  expect(tree.getAttribute("aria-label")).to.equal("");

  el.removeAttribute("aria-label");
  await el.updateComplete;
  expect(tree.getAttribute("role")).to.equal("list");
  expect(tree.hasAttribute("aria-label")).to.equal(false);
});

it("does not render a copy button by default", async () => {
  const el = await withData(sample);
  expect(el.shadowRoot!.querySelector('[part="copy-button"]') == null).to.be
    .true;
});

it("gives tree toggles and copy controls the shared minimum hit area", async () => {
  const el = await withData(sample);
  el.copyable = true;
  await el.updateComplete;

  const toggle = el.shadowRoot!.querySelector('[part="toggle"]') as HTMLElement;
  const copy = el.shadowRoot!.querySelector(
    '[part="copy-button"]'
  ) as HTMLElement;
  expect(getComputedStyle(toggle).minInlineSize).to.equal("40px");
  expect(getComputedStyle(toggle).minBlockSize).to.equal("40px");
  expect(getComputedStyle(copy).minInlineSize).to.equal("40px");
  expect(getComputedStyle(copy).minBlockSize).to.equal("40px");
});

it("renders a top-level copy button when copyable, and emits lr-copy with the full JSON on click", async () => {
  const el = await withData(sample);
  el.copyable = true;
  await el.updateComplete;

  const toolbarButton = el.shadowRoot!.querySelector(
    '[part="toolbar"] [part="copy-button"]'
  ) as HTMLButtonElement;
  expect(toolbarButton != null).to.equal(true);

  setTimeout(() => toolbarButton.click());
  const event = await oneEvent(el, "lr-copy");
  expect(event.detail).to.deep.equal({
    ok: true,
    text: JSON.stringify(sample, null, 2),
  });
  expect(Object.isFrozen(event.detail)).to.equal(true);
});

it("renders per-node copy buttons when copyable, and copies just that node on click", async () => {
  const el = await withData(sample);
  el.copyable = true;
  await el.updateComplete;

  const nodeButtons = Array.from(
    el.shadowRoot!.querySelectorAll('[part="copy-button"]')
  );
  // toolbar button + one per rendered row.
  expect(nodeButtons.length).to.be.greaterThan(1);

  const ageRow = Array.from(el.shadowRoot!.querySelectorAll(".row")).find(
    (row) => row.querySelector('[part="key"]')?.textContent === "age"
  ) as HTMLElement;
  const copyBtn = ageRow.querySelector(
    '[part="copy-button"]'
  ) as HTMLButtonElement;

  setTimeout(() => copyBtn.click());
  const event = await oneEvent(el, "lr-copy");
  expect(event.detail.text).to.equal("36");
});

it("emits frozen shared failure outcomes and no success event when the Clipboard API is unavailable", async () => {
  const original = Object.getOwnPropertyDescriptor(navigator, "clipboard");
  Object.defineProperty(navigator, "clipboard", {
    value: undefined,
    configurable: true,
  });

  try {
    const el = await withData(sample);
    el.copyable = true;
    el.strings = { copyFailed: "JSON copy failed" };
    await el.updateComplete;
    const toolbarButton = el.shadowRoot!.querySelector(
      '[part="copy-button"]'
    ) as HTMLButtonElement;
    let successes = 0;
    let errors = 0;
    el.addEventListener("lr-copy", () => successes++);
    el.addEventListener("lr-error", () => errors++);

    const failed = oneEvent(el, "lr-copy-error");
    toolbarButton.click();
    const event = await failed;
    expect(event.detail).to.include({
      ok: false,
      text: JSON.stringify(sample, null, 2),
      reason: "unsupported",
    });
    expect(Object.isFrozen(event.detail)).to.equal(true);
    expect(successes).to.equal(0);
    expect(errors).to.equal(1);
    expect(
      document.querySelector(`[${ANNOUNCEMENT_SINK_ATTRIBUTE}="polite"]`)
        ?.textContent
    ).to.contain("JSON copy failed");
  } finally {
    if (original) Object.defineProperty(navigator, "clipboard", original);
    else Reflect.deleteProperty(navigator, "clipboard");
  }
});

it("classifies a rejected clipboard write as denied without rendering the raw error", async () => {
  const original = Object.getOwnPropertyDescriptor(navigator, "clipboard");
  const rejection = new DOMException(
    "private clipboard detail",
    "NotAllowedError"
  );
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText: () => Promise.reject(rejection) },
  });
  try {
    const el = await withData({ secret: "redacted" });
    el.copyable = true;
    el.strings = { copyFailed: "Unable to copy JSON" };
    await el.updateComplete;
    const failed = oneEvent(el, "lr-copy-error");
    (
      el.shadowRoot!.querySelector(
        '[part="toolbar"] [part="copy-button"]'
      ) as HTMLButtonElement
    ).click();
    const event = await failed;

    expect(event.detail).to.include({
      ok: false,
      reason: "denied",
      error: rejection,
    });
    const sink = document.querySelector(
      `[${ANNOUNCEMENT_SINK_ATTRIBUTE}="polite"]`
    )!;
    expect(sink.textContent).to.contain("Unable to copy JSON");
    expect(sink.textContent).not.to.contain("private clipboard detail");
  } finally {
    if (original) Object.defineProperty(navigator, "clipboard", original);
    else Reflect.deleteProperty(navigator, "clipboard");
  }
});

it("reports a 'failed' outcome when serializing the value itself throws, never reaching the clipboard", async () => {
  const poison = {
    toJSON(): never {
      throw new Error("cannot serialize");
    },
  };
  const el = await withData({ poison });
  el.copyable = true;
  el.strings = { copyFailed: "JSON copy failed" };
  await el.updateComplete;

  let successes = 0;
  el.addEventListener("lr-copy", () => successes++);
  const errored = oneEvent(el, "lr-error");
  const failed = oneEvent(el, "lr-copy-error");
  (
    el.shadowRoot!.querySelector(
      '[part="toolbar"] [part="copy-button"]'
    ) as HTMLButtonElement
  ).click();
  const [, failedEvent] = await Promise.all([errored, failed]);

  expect(failedEvent.detail).to.include({ ok: false, reason: "failed" });
  expect(failedEvent.detail.error).to.be.instanceOf(Error);
  expect(successes).to.equal(0);
  expect(
    document.querySelector(`[${ANNOUNCEMENT_SINK_ATTRIBUTE}="polite"]`)
      ?.textContent
  ).to.contain("JSON copy failed");
});

it("never reports a serialization failure once the element has already disconnected", async () => {
  let el!: LyraJsonViewer;
  const poison = {
    toJSON(): never {
      el.remove();
      throw new Error("cannot serialize");
    },
  };
  el = await withData({ poison });
  el.copyable = true;
  await el.updateComplete;

  let errors = 0;
  let failures = 0;
  el.addEventListener("lr-error", () => errors++);
  el.addEventListener("lr-copy-error", () => failures++);
  (
    el.shadowRoot!.querySelector(
      '[part="toolbar"] [part="copy-button"]'
    ) as HTMLButtonElement
  ).click();
  // The synchronous toJSON already ran (and disconnected the element) by the time click()
  // returns, since copy()'s stringify step has no await before the catch block.
  expect(errors).to.equal(0);
  expect(failures).to.equal(0);
});

it('copies the literal string "undefined" when the root data is undefined', async () => {
  const el = await withData(undefined);
  el.copyable = true;
  await el.updateComplete;

  const toolbarButton = el.shadowRoot!.querySelector(
    '[part="copy-button"]'
  ) as HTMLButtonElement;
  setTimeout(() => toolbarButton.click());
  const event = await oneEvent(el, "lr-copy");
  expect(event.detail.text).to.equal("undefined");
});

it("copies root Symbol/function values as strings instead of emitting undefined", async () => {
  for (const value of [Symbol("root"), function rootValue() {}]) {
    const el = await withData(value);
    el.copyable = true;
    await el.updateComplete;
    const listener = oneEvent(el, "lr-copy");
    (
      el.shadowRoot!.querySelector(
        '[part="toolbar"] [part="copy-button"]'
      ) as HTMLButtonElement
    ).click();
    const event = await listener;
    expect(typeof event.detail.text).to.equal("string");
    expect(event.detail.text).to.equal(String(value));
  }
});

it("exposes every rendered JSON row as a public row part", async () => {
  const el = await withData({ nested: { value: 1 } });
  const rows = el.shadowRoot!.querySelectorAll(".row");
  expect(rows.length).to.be.greaterThan(0);
  expect(el.shadowRoot!.querySelectorAll('.row[part~="row"]').length).to.equal(
    rows.length
  );
});

it("routes row hover fill through --lr-json-viewer-row-hover-bg", () => {
  const css = styles.cssText.replace(/\s+/g, " ");
  expect(css).to.match(
    /\.row:hover\s*\{[^}]*background:\s*var\(--lr-json-viewer-row-hover-bg,\s*var\(--lr-color-brand-quiet\)\)/
  );
});

it("highlights matching keys/values with data-match when search is set", async () => {
  const el = await withData(sample);
  el.search = "ada";
  await el.updateComplete;

  const match = el.shadowRoot!.querySelector('[part="value"][data-match]');
  expect(match != null).to.equal(true);
  expect(match!.textContent).to.equal('"Ada Lovelace"');
});

it("auto-expands ancestors of a match even under a collapsing collapsed-depth", async () => {
  const el = await withData(sample);
  el.collapsedDepth = 0;
  el.search = "london";
  await el.updateComplete;

  // Root is forced open by the match living inside `address`, and `address`
  // itself is forced open too, so the matching value is actually rendered.
  const match = Array.from(
    el.shadowRoot!.querySelectorAll('[part="value"]')
  ).find((v) => v.textContent === '"London"');
  expect(match != null).to.equal(true);
  expect(match!.hasAttribute("data-match")).to.be.true;
});

it("matches keys as well as values", async () => {
  const el = await withData(sample);
  el.search = "address";
  await el.updateComplete;

  const keyMatch = Array.from(
    el.shadowRoot!.querySelectorAll('[part="key"]')
  ).find((k) => k.textContent === "address");
  expect(keyMatch!.hasAttribute("data-match")).to.be.true;
});

it("does not highlight anything when search is empty", async () => {
  const el = await withData(sample);
  el.search = "";
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector("[data-match]") == null).to.be.true;
});

it("preserves manual toggle overrides across a data reassignment with the same shape", async () => {
  const el = await withData(sample);
  el.collapsedDepth = 0;
  await el.updateComplete;

  const toggle = el.shadowRoot!.querySelector(
    '[part="toggle"]'
  ) as HTMLButtonElement;
  toggle.click();
  await el.updateComplete;
  expect(toggle.getAttribute("aria-expanded")).to.equal("true");

  el.data = { ...sample, age: 37 };
  await el.updateComplete;

  const toggleAfter = el.shadowRoot!.querySelector(
    '[part="toggle"]'
  ) as HTMLButtonElement;
  expect(toggleAfter.getAttribute("aria-expanded")).to.equal("true");
});

it("renders a self-referencing value without a stack overflow, showing a circular marker instead of recursing", async () => {
  const o: Record<string, unknown> = { name: "root" };
  o.self = o;
  const el = await withData(o);

  // The `self` key itself is rendered exactly once -- recursing into it
  // again (and again...) would either blow the stack or render it an
  // unbounded number of times.
  const keys = Array.from(el.shadowRoot!.querySelectorAll('[part="key"]')).map(
    (k) => k.textContent
  );
  expect(keys.filter((k) => k === "self")).to.have.length(1);

  const values = Array.from(
    el.shadowRoot!.querySelectorAll('[part="value"]')
  ).map((v) => v.textContent);
  expect(values).to.include("Circular reference");

  const marker = Array.from(
    el.shadowRoot!.querySelectorAll('[part="value"]')
  ).find((v) => v.textContent === "Circular reference");
  expect(marker!.getAttribute("data-type")).to.equal("circular");

  // The circular node has no children to toggle -- it renders as a leaf.
  const selfRow = Array.from(el.shadowRoot!.querySelectorAll(".row")).find(
    (row) => row.querySelector('[part="key"]')?.textContent === "self"
  ) as HTMLElement;
  expect(
    (selfRow.querySelector('[part="toggle"]') as HTMLElement).hasAttribute(
      "hidden"
    )
  ).to.be.true;
});

it("bounds valid acyclic deep rendering and reports the localized resource limit", async () => {
  let data: Record<string, unknown> = { leaf: true };
  for (let depth = 0; depth < 300; depth += 1) data = { child: data };

  const el = (await fixture(
    html`<lr-json-viewer
      lang="ar-EG"
      .data=${data}
      .strings=${{
        jsonViewerLimit:
          "Limited to {count} JSON nodes and {depth} nesting levels.",
      }}
    ></lr-json-viewer>`
  )) as LyraJsonViewer;
  const rows = el.shadowRoot!.querySelectorAll(".row");
  const formatter = new Intl.NumberFormat(el.effectiveLocale);
  const limit = el.shadowRoot!.querySelector('[part="limit"]')!;
  expect(rows.length).to.be.lessThan(300);
  expect(limit.textContent).to.equal(
    `Limited to ${formatter.format(5000)} JSON nodes and ${formatter.format(
      100
    )} nesting levels.`
  );
  expect(limit.hasAttribute("role")).to.be.false;
});

it("bounds rendering mid-sibling when the node budget runs out partway through a container's own entries", async () => {
  // Three sibling arrays, each individually far under the 5000-node budget (so entriesOf()
  // never truncates any one of them on its own), but whose combined leaf count blows the
  // shared render budget partway through the root's own entries loop -- this is the render
  // loop's own `budget.remaining <= 0` mid-iteration break, distinct from entriesOf()'s
  // per-container truncation exercised elsewhere.
  const data = {
    a: Array.from({ length: 3000 }, (_, index) => index),
    b: Array.from({ length: 3000 }, (_, index) => index),
    c: Array.from({ length: 3000 }, (_, index) => index),
  };
  const el = (await fixture(
    html`<lr-json-viewer .data=${data}></lr-json-viewer>`
  )) as LyraJsonViewer;
  const rows = el.shadowRoot!.querySelectorAll(".row");
  // 1 (root) + 3 (a/b/c) + 9000 (leaves) = 9004 possible rows -- rendering must stop short, and
  // in fact never even starts rendering "c" at all (the root's own entries loop runs out of
  // budget checking the third sibling, before recursing into it).
  expect(rows.length).to.be.lessThan(9004);
  expect(el.shadowRoot!.querySelector('[part="limit"]') !== null).to.be.true;
});

it("bounds broad search traversal instead of matching beyond the node budget", async () => {
  const data = Object.fromEntries(
    Array.from({ length: 5100 }, (_, index) => [
      `key-${index}`,
      index === 5099 ? "needle-at-tail" : index,
    ])
  );
  const el = (await fixture(
    html`<lr-json-viewer
      .data=${data}
      collapsed-depth="0"
      search="needle-at-tail"
    ></lr-json-viewer>`
  )) as LyraJsonViewer;
  expect(el.shadowRoot!.querySelectorAll("[data-match]").length).to.equal(0);
  expect(el.shadowRoot!.querySelector('[part="limit"]') !== null).to.be.true;
});

it("renders a bigint value via String() instead of throwing from JSON.stringify", async () => {
  const el = await withData({ count: 10n });
  const values = Array.from(
    el.shadowRoot!.querySelectorAll('[part="value"]')
  ).map((v) => v.textContent);
  expect(values).to.include("10");
});

it("copies a bigint value without throwing, downgrading it to a plain string", async () => {
  const el = await withData({ count: 10n });
  el.copyable = true;
  await el.updateComplete;

  const toolbarButton = el.shadowRoot!.querySelector(
    '[part="toolbar"] [part="copy-button"]'
  ) as HTMLButtonElement;
  setTimeout(() => toolbarButton.click());
  const event = await oneEvent(el, "lr-copy");
  expect(event.detail.text).to.equal(JSON.stringify({ count: "10" }, null, 2));
});

it("copies a self-referencing value without throwing, substituting the localized circular marker", async () => {
  const o: Record<string, unknown> = { name: "root" };
  o.self = o;
  const el = await withData(o);
  el.copyable = true;
  await el.updateComplete;

  const toolbarButton = el.shadowRoot!.querySelector(
    '[part="toolbar"] [part="copy-button"]'
  ) as HTMLButtonElement;
  setTimeout(() => toolbarButton.click());
  const event = await oneEvent(el, "lr-copy");
  expect(event.detail.text).to.equal(
    JSON.stringify({ name: "root", self: "Circular reference" }, null, 2)
  );
});

it("copies a value with the same object reachable via two non-cyclic paths without flagging it circular", async () => {
  const shared = { id: 1 };
  const el = await withData({ a: shared, b: shared });
  el.copyable = true;
  await el.updateComplete;

  const toolbarButton = el.shadowRoot!.querySelector(
    '[part="toolbar"] [part="copy-button"]'
  ) as HTMLButtonElement;
  setTimeout(() => toolbarButton.click());
  const event = await oneEvent(el, "lr-copy");
  expect(event.detail.text).to.equal(
    JSON.stringify({ a: { id: 1 }, b: { id: 1 } }, null, 2)
  );
});

it("sizes the closing-bracket spacer to the toggle's real (min-inline-size-driven) width, keeping brackets aligned", async () => {
  const el = await withData({ nested: { a: 1 } });
  await el.updateComplete;
  const toggle = el.shadowRoot!.querySelector(
    '[part="toggle"]:not([hidden])'
  ) as HTMLElement;
  const spacer = el.shadowRoot!.querySelector(".toggle-space") as HTMLElement;
  expect(
    toggle != null,
    "the nested object should render expanded with a real toggle"
  ).to.equal(true);
  expect(
    spacer != null,
    "the closing-bracket row should render its alignment spacer"
  ).to.equal(true);
  expect(getComputedStyle(spacer).getPropertyValue("inline-size")).to.equal(
    getComputedStyle(toggle).getPropertyValue("inline-size")
  );
});

it("does not re-walk the data tree to recompute search state on a toggle-only re-render", async () => {
  let accesses = 0;
  const trackedChild = new Proxy(
    { value: "no match here" },
    {
      get(target, prop, receiver) {
        accesses++;
        return Reflect.get(target, prop, receiver);
      },
    }
  );
  const el = (await fixture(
    html`<lr-json-viewer></lr-json-viewer>`
  )) as LyraJsonViewer;
  // "hidden" (depth 1) starts collapsed from this very first render (data,
  // collapsed-depth, and search are all assigned before the first await, so
  // Lit batches them into one update) -- normal rendering never descends
  // into it, so any access to trackedChild can only come from the search
  // walk itself, which -- unlike rendering -- traverses the whole tree
  // regardless of what's currently expanded.
  el.data = { other: { a: 1 }, hidden: { nested: trackedChild } };
  el.collapsedDepth = 1;
  el.search = "no-match-anywhere";
  await el.updateComplete;

  const accessesAfterFirstRender = accesses;
  // Sanity check: the initial search walk did reach into the collapsed
  // subtree, so the counter is a meaningful signal for the assertion below.
  expect(accessesAfterFirstRender).to.be.greaterThan(0);

  // "other" (not "hidden") is toggled, so `data`/`search` are unchanged --
  // this is an `expandedOverrides`-only re-render.
  const otherRow = Array.from(el.shadowRoot!.querySelectorAll(".row")).find(
    (row) => row.querySelector('[part="key"]')?.textContent === "other"
  ) as HTMLElement;
  const toggle = otherRow.querySelector('[part="toggle"]') as HTMLButtonElement;
  toggle.click();
  await el.updateComplete;

  expect(accesses).to.equal(accessesAfterFirstRender);
});

it("prunes stale expandedOverrides entries once their path no longer exists after a data reassignment", async () => {
  const el = await withData({ old: { deep: { x: 1 } } });
  el.collapsedDepth = 0;
  await el.updateComplete;

  const rootToggle = el.shadowRoot!.querySelector(
    '[part="toggle"]'
  ) as HTMLButtonElement;
  rootToggle.click();
  await el.updateComplete;

  const oldToggle = (
    Array.from(el.shadowRoot!.querySelectorAll(".row")).find(
      (row) => row.querySelector('[part="key"]')?.textContent === "old"
    ) as HTMLElement
  ).querySelector('[part="toggle"]') as HTMLButtonElement;
  oldToggle.click();
  await el.updateComplete;
  expect(oldToggle.getAttribute("aria-expanded")).to.equal("true");

  // Remove the "old" key entirely -- its ["old"] override has nothing left
  // to apply to.
  el.data = { fresh: 1 };
  await el.updateComplete;

  // Reintroduce an unrelated "old" node that coincidentally reuses the
  // exact same path key ('["old"]'). If the stale override had survived,
  // this brand-new node would render already-expanded despite
  // collapsed-depth="0" defaulting everything closed.
  el.data = { old: { other: 2 } };
  await el.updateComplete;

  const newOldToggle = (
    Array.from(el.shadowRoot!.querySelectorAll(".row")).find(
      (row) => row.querySelector('[part="key"]')?.textContent === "old"
    ) as HTMLElement
  ).querySelector('[part="toggle"]') as HTMLButtonElement;
  expect(newOldToggle.getAttribute("aria-expanded")).to.equal("false");
});

it("gives each per-node copy button a distinct aria-label naming its own key", async () => {
  const el = await withData(sample);
  el.copyable = true;
  await el.updateComplete;

  const ageButton = (
    Array.from(el.shadowRoot!.querySelectorAll(".row")).find(
      (row) => row.querySelector('[part="key"]')?.textContent === "age"
    ) as HTMLElement
  ).querySelector('[part="copy-button"]') as HTMLButtonElement;
  const nameButton = (
    Array.from(el.shadowRoot!.querySelectorAll(".row")).find(
      (row) => row.querySelector('[part="key"]')?.textContent === "name"
    ) as HTMLElement
  ).querySelector('[part="copy-button"]') as HTMLButtonElement;

  expect(ageButton.getAttribute("aria-label")).to.equal("Copy age");
  expect(nameButton.getAttribute("aria-label")).to.equal("Copy name");
  expect(ageButton.getAttribute("aria-label")).to.not.equal(
    nameButton.getAttribute("aria-label")
  );
});

it("renders a root primitive with no key label", async () => {
  const el = await withData("just a string");
  const value = el.shadowRoot!.querySelector('[part="value"]');
  expect(value!.textContent).to.equal('"just a string"');
  expect(el.shadowRoot!.querySelector('[part="key"]') == null).to.be.true;
});

it("respects max-height by setting the scoped custom property on the base part", async () => {
  const el = await withData(sample);
  el.maxHeight = "10rem";
  await el.updateComplete;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  expect(base.style.getPropertyValue("--lr-json-viewer-max-height")).to.equal(
    "10rem"
  );
});

it("rejects declaration-breaking maxHeight values", async () => {
  const el = await fixture<LyraJsonViewer>(
    html`<lr-json-viewer></lr-json-viewer>`
  );
  el.maxHeight = "10rem;position:fixed";
  await el.updateComplete;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  expect(base.style.position).to.equal("");
  expect(base.style.getPropertyValue("--lr-json-viewer-max-height")).to.equal(
    ""
  );
  el.maxHeight = "var(--viewer-height)";
  await el.updateComplete;
  expect(base.style.getPropertyValue("--lr-json-viewer-max-height")).to.equal(
    "var(--viewer-height)"
  );
});

it("keeps the tree LTR in RTL: a collapsed chevron still points right, expanded points down", async () => {
  // The tree is pinned direction:ltr (a JSON structure reads left-to-right in any locale, like
  // devtools/VS Code), so the disclosure chevron behaves identically to an LTR document rather
  // than mirroring -- collapsed points right (rotate 0), expanded points down (rotate 90).
  const wrapper = await fixture(html`
    <div dir="rtl">
      <lr-json-viewer
        .data=${{ nested: true }}
        collapsed-depth="0"
        style="--lr-transition-fast: 0s"
      ></lr-json-viewer>
    </div>
  `);
  const el = wrapper.querySelector("lr-json-viewer") as LyraJsonViewer;
  await el.updateComplete;
  const tree = el.shadowRoot!.querySelector('[part="tree"]') as HTMLElement;
  expect(getComputedStyle(tree).direction).to.equal("ltr");

  const toggle = el.shadowRoot!.querySelector(
    '[part="toggle"]'
  ) as HTMLButtonElement;
  const chevron = toggle.querySelector(".chevron") as HTMLElement;
  const collapsed = new DOMMatrixReadOnly(getComputedStyle(chevron).transform);
  expect(collapsed.a).to.be.closeTo(1, 0.001);
  expect(collapsed.b).to.be.closeTo(0, 0.001);
  expect(collapsed.d).to.be.closeTo(1, 0.001);

  toggle.click();
  await el.updateComplete;
  const expandedToggle = el.shadowRoot!.querySelector(
    '[part="toggle"]'
  ) as HTMLButtonElement;
  expect(expandedToggle.getAttribute("aria-expanded")).to.equal("true");
  const expandedChevron = expandedToggle.querySelector(
    ".chevron"
  ) as HTMLElement;
  const expanded = new DOMMatrixReadOnly(
    getComputedStyle(expandedChevron).transform
  );
  expect(expanded.a).to.be.closeTo(0, 0.001);
  expect(expanded.b).to.be.closeTo(1, 0.001);
});

it("is accessible with a populated, expanded tree", async () => {
  const el = await withData(sample);
  await expect(el).to.be.accessible();
});

it("is accessible with copyable buttons and a collapsed root", async () => {
  const el = await withData(sample);
  el.copyable = true;
  el.collapsedDepth = 0;
  await el.updateComplete;
  await expect(el).to.be.accessible();
});

it("is accessible with an empty/default (undefined) value", async () => {
  const el = (await fixture(
    html`<lr-json-viewer></lr-json-viewer>`
  )) as LyraJsonViewer;
  await expect(el).to.be.accessible();
});

it('localizes the root toggle\'s "array"/"object" fallback label via this.localize()', async () => {
  const arrayEl = await withData([1, 2]);
  arrayEl.strings = { jsonArray: "tableau" };
  await arrayEl.updateComplete;
  const arrayToggle = arrayEl.shadowRoot!.querySelector(
    '[part="toggle"]'
  ) as HTMLButtonElement;
  expect(arrayToggle.getAttribute("aria-label")).to.contain("tableau");

  const objectEl = await withData({ a: 1 });
  objectEl.strings = { jsonObject: "objet" };
  await objectEl.updateComplete;
  const objectToggle = objectEl.shadowRoot!.querySelector(
    '[part="toggle"]'
  ) as HTMLButtonElement;
  expect(objectToggle.getAttribute("aria-label")).to.contain("objet");
});

it('defaults to English "array"/"object" when no strings override is set', async () => {
  const arrayEl = await withData([1, 2]);
  const arrayToggle = arrayEl.shadowRoot!.querySelector(
    '[part="toggle"]'
  ) as HTMLButtonElement;
  expect(arrayToggle.getAttribute("aria-label")).to.contain("array");
});

describe("imperative search API", () => {
  const SAMPLE = {
    name: "Ada",
    role: "Mathematician",
    team: { name: "Analytical Engine", size: 3 },
  };

  // NB: the convenience method is `runSearch()`, not `search()` -- `search` is already this
  // component's pre-existing declarative `@property()` string (predating this quartet), and a
  // method can't share a class member name with a property. See the JSDoc on `runSearch()` in
  // json-viewer.class.ts for the full rationale.

  it("runSearch() resolves the count equal to the rendered data-match span count", async () => {
    const el = (await fixture(
      html`<lr-json-viewer .data=${SAMPLE}></lr-json-viewer>`
    )) as LyraJsonViewer;
    const count = await el.runSearch("name");
    await el.updateComplete;
    expect(count).to.equal(
      el.shadowRoot!.querySelectorAll("[data-match]").length
    );
    expect(count).to.equal(2); // "name" key at root and inside "team"
  });

  it("case-folds keys and values with the effective locale", async () => {
    const el = (await fixture(
      html`<lr-json-viewer
        lang="tr"
        .data=${{ city: "IĞDIR" }}
      ></lr-json-viewer>`
    )) as LyraJsonViewer;
    expect(await el.runSearch("ığdır")).to.equal(1);
    expect(el.shadowRoot!.querySelector('[part="value"][data-match]')).to.exist;
  });

  it("searchNext/searchPrevious move the cursor in document walk order (key before value at one path)", async () => {
    const el = (await fixture(
      html`<lr-json-viewer .data=${{ ada: "ada" }}></lr-json-viewer>`
    )) as LyraJsonViewer;
    await el.runSearch("ada"); // matches the key "ada" AND its own value "ada" at the same path
    let detail: { activeIndex: number } | undefined;
    el.addEventListener(
      "lr-search-change",
      (e) => (detail = (e as CustomEvent).detail)
    );
    expect(await el.searchNext()).to.be.true;
    expect(detail!.activeIndex).to.equal(0);
    expect(await el.searchNext()).to.be.true;
    expect(detail!.activeIndex).to.equal(1);
    expect(await el.searchNext()).to.be.true;
    expect(detail!.activeIndex).to.equal(0); // wraps
    const active = el.shadowRoot!.querySelector("[data-active]");
    expect(active!.getAttribute("aria-current")).to.equal("true");
  });

  it("activeIndex starts at -1 before any navigation", async () => {
    const el = (await fixture(
      html`<lr-json-viewer .data=${SAMPLE}></lr-json-viewer>`
    )) as LyraJsonViewer;
    let detail: { activeIndex: number } | undefined;
    el.addEventListener(
      "lr-search-change",
      (e) => (detail = (e as CustomEvent).detail)
    );
    await el.runSearch("name");
    expect(detail!.activeIndex).to.equal(-1);
  });

  it("reveals, marks, announces, and scrolls to a selected match hidden by a collapsed ancestor", async () => {
    const originalScrollIntoView = HTMLElement.prototype.scrollIntoView;
    let scrolledPart: string | null = null;
    HTMLElement.prototype.scrollIntoView = function () {
      scrolledPart = this.getAttribute("part");
    };
    try {
      const el = (await fixture(
        html`<lr-json-viewer
          .data=${SAMPLE}
          collapsed-depth=${99}
        ></lr-json-viewer>`
      )) as LyraJsonViewer;
      const sinkSelector = `[${ANNOUNCEMENT_SINK_ATTRIBUTE}="polite"]`;
      const sink = document.querySelector<HTMLElement>(sinkSelector)!;
      expect(Boolean(sink), "the sink exists before search navigation").to.be
        .true;
      expect(sink.childElementCount).to.equal(0);
      await el.runSearch("name");
      const teamRow = [
        ...el.shadowRoot!.querySelectorAll<HTMLElement>(".row"),
      ].find(
        (row) => row.querySelector('[part="key"]')?.textContent === "team"
      )!;
      const teamToggle = teamRow.querySelector(
        '[part="toggle"]'
      ) as HTMLButtonElement;
      teamToggle.click();
      await el.updateComplete;
      expect(teamToggle.getAttribute("aria-expanded")).to.equal("false");

      expect(await el.searchNext()).to.be.true;
      expect(await el.searchNext()).to.be.true;

      const active = el.shadowRoot!.querySelector<HTMLElement>("[data-active]");
      expect(active?.getAttribute("aria-current")).to.equal("true");
      expect(teamToggle.getAttribute("aria-expanded")).to.equal("true");
      expect(
        el.shadowRoot!.querySelectorAll('[part="key"][data-match]').length
      ).to.equal(2);
      const mirror = el.shadowRoot!.querySelector<HTMLElement>("span.sr-only")!;
      expect(mirror.textContent).to.equal("Match 2 of 2");
      expect(mirror.getAttribute("aria-hidden")).to.equal("true");
      expect(mirror.hasAttribute("role")).to.be.false;
      expect(mirror.hasAttribute("aria-live")).to.be.false;
      expect(
        Array.from(sink.children, (child) => child.textContent)
      ).to.deep.equal(["Match 1 of 2", "Match 2 of 2"]);
      expect(scrolledPart).to.equal("key");

      el.remove();
      expect(document.querySelector(sinkSelector) === null).to.be.true;
      document.body.append(el);
      expect(
        document.querySelector<HTMLElement>(sinkSelector)?.childElementCount
      ).to.equal(0);
      el.remove();
    } finally {
      HTMLElement.prototype.scrollIntoView = originalScrollIntoView;
    }
  });

  it("keeps public search navigation silent while the viewer host is hidden", async () => {
    const el = (await fixture(
      html`<lr-json-viewer hidden .data=${SAMPLE}></lr-json-viewer>`
    )) as LyraJsonViewer;
    await el.runSearch("name");
    const sink = document.querySelector<HTMLElement>(
      `[${ANNOUNCEMENT_SINK_ATTRIBUTE}="polite"]`
    )!;

    expect(await el.searchNext()).to.be.true;
    expect(
      sink.childElementCount,
      "a hidden source must not speak through a document sink"
    ).to.equal(0);

    el.hidden = false;
    expect(await el.searchNext()).to.be.true;
    expect(sink.lastElementChild?.textContent).to.equal("Match 2 of 2");
  });

  it("treats a detached cursor update that flushes after reconnect as the new silent baseline", async () => {
    const el = (await fixture(
      html`<lr-json-viewer .data=${SAMPLE}></lr-json-viewer>`
    )) as LyraJsonViewer;
    await el.runSearch("name");
    await el.searchNext();
    el.remove();

    const pendingMove = el.searchNext();
    document.body.append(el);
    await pendingMove;
    await el.updateComplete;
    const sink = document.querySelector<HTMLElement>(
      `[${ANNOUNCEMENT_SINK_ATTRIBUTE}="polite"]`
    )!;
    expect(
      sink.childElementCount,
      "the detached cursor becomes reconnect state"
    ).to.equal(0);

    await el.searchNext();
    expect(sink.lastElementChild?.textContent).to.equal("Match 1 of 2");
    el.remove();
  });

  it("uses the adopted document motion preference and clipboard", async () => {
    const frame = document.createElement("iframe");
    const loaded = oneEvent(frame, "load");
    frame.srcdoc = "<!doctype html><html><body></body></html>";
    document.body.append(frame);
    await loaded;

    const frameDocument = frame.contentDocument!;
    const frameWindow = frame.contentWindow!;
    const parentMatchMedia = window.matchMedia;
    const frameMatchMedia = frameWindow.matchMedia;
    const parentClipboard = Object.getOwnPropertyDescriptor(
      window.navigator,
      "clipboard"
    );
    const frameClipboard = Object.getOwnPropertyDescriptor(
      frameWindow.navigator,
      "clipboard"
    );
    let parentMediaQueries = 0;
    let frameMediaQueries = 0;
    const parentWrites: string[] = [];
    const frameWrites: string[] = [];
    const mediaResult = (query: string): MediaQueryList => ({
      matches: false,
      media: query,
      onchange: null,
      addListener() {},
      removeListener() {},
      addEventListener() {},
      removeEventListener() {},
      dispatchEvent: () => false,
    });

    window.matchMedia = ((query: string) => {
      parentMediaQueries += 1;
      return mediaResult(query);
    }) as typeof window.matchMedia;
    frameWindow.matchMedia = ((query: string) => {
      frameMediaQueries += 1;
      return mediaResult(query);
    }) as typeof frameWindow.matchMedia;
    Object.defineProperty(window.navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (text: string) => {
          parentWrites.push(text);
        },
      },
    });
    Object.defineProperty(frameWindow.navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (text: string) => {
          frameWrites.push(text);
        },
      },
    });

    let el: LyraJsonViewer | undefined;
    try {
      el = (await fixture(
        html` <lr-json-viewer copyable .data=${SAMPLE}></lr-json-viewer> `
      )) as LyraJsonViewer;
      await el.runSearch("name");
      el.remove();
      frameDocument.body.append(frameDocument.adoptNode(el));
      await el.updateComplete;

      await el.searchNext();
      expect(frameMediaQueries > 0).to.be.true;
      expect(parentMediaQueries).to.equal(0);

      const copied = oneEvent(el, "lr-copy");
      el.shadowRoot!.querySelector<HTMLButtonElement>(
        '[part="toolbar"] [part="copy-button"]'
      )!.click();
      const copyEvent = await copied;
      expect(frameWrites).to.deep.equal([JSON.stringify(SAMPLE, null, 2)]);
      expect(parentWrites).to.deep.equal([]);
      expect(copyEvent.detail.ok).to.equal(true);
    } finally {
      el?.remove();
      window.matchMedia = parentMatchMedia;
      frameWindow.matchMedia = frameMatchMedia;
      if (parentClipboard)
        Object.defineProperty(window.navigator, "clipboard", parentClipboard);
      else
        delete (window.navigator as Navigator & { clipboard?: Clipboard })
          .clipboard;
      if (frameClipboard) {
        Object.defineProperty(
          frameWindow.navigator,
          "clipboard",
          frameClipboard
        );
      } else {
        delete (frameWindow.navigator as Navigator & { clipboard?: Clipboard })
          .clipboard;
      }
      frame.remove();
    }
  });

  it("emits exactly one lr-search-change when data reshapes, resetting activeIndex to -1", async () => {
    const el = (await fixture(
      html`<lr-json-viewer .data=${SAMPLE}></lr-json-viewer>`
    )) as LyraJsonViewer;
    await el.runSearch("name");
    await el.searchNext();
    let callCount = 0;
    let lastDetail: { activeIndex: number } | undefined;
    el.addEventListener("lr-search-change", (e) => {
      callCount++;
      lastDetail = (e as CustomEvent).detail;
    });
    el.data = { other: "value" };
    await el.updateComplete;
    expect(callCount).to.equal(1);
    expect(lastDetail!.activeIndex).to.equal(-1);
  });

  it("clearSearch() resets query/matchCount/activeIndex", async () => {
    const el = (await fixture(
      html`<lr-json-viewer .data=${SAMPLE}></lr-json-viewer>`
    )) as LyraJsonViewer;
    await el.runSearch("name");
    const listener = oneEvent(el, "lr-search-change");
    el.clearSearch();
    const event = (await listener) as CustomEvent<{
      query: string;
      matchCount: number;
      matchCountExact: boolean;
      activeIndex: number;
    }>;
    expect(event.detail).to.deep.equal({
      query: "",
      matchCount: 0,
      matchCountExact: true,
      activeIndex: -1,
    });
    expect(el.search).to.equal("");
  });

  it("marks search event counts as lower bounds when traversal is truncated", async () => {
    const broad: Record<string, string> = {};
    for (let index = 0; index < 6000; index += 1)
      broad[`key-${index}`] = `value-${index}`;
    const el = (await fixture(
      html`<lr-json-viewer .data=${broad}></lr-json-viewer>`
    )) as LyraJsonViewer;
    let detail: { matchCount: number; matchCountExact: boolean } | undefined;
    el.addEventListener("lr-search-change", (event) => {
      detail = (
        event as CustomEvent<{ matchCount: number; matchCountExact: boolean }>
      ).detail;
    });
    await el.runSearch("key-0");
    expect(detail!.matchCount).to.equal(1);
    expect(detail!.matchCountExact).to.be.false;
  });

  it("back-compat: rendered DOM is unchanged until a cursor exists", async () => {
    const before = (await fixture(
      html`<lr-json-viewer .data=${SAMPLE} search="name"></lr-json-viewer>`
    )) as LyraJsonViewer;
    await before.updateComplete;
    const after = (await fixture(
      html`<lr-json-viewer .data=${SAMPLE}></lr-json-viewer>`
    )) as LyraJsonViewer;
    await after.runSearch("name");
    await after.updateComplete;
    const beforeMatches = [
      ...before.shadowRoot!.querySelectorAll<HTMLElement>("[data-match]"),
    ];
    const afterMatches = [
      ...after.shadowRoot!.querySelectorAll<HTMLElement>("[data-match]"),
    ];
    expect(afterMatches.map((match) => match.textContent)).to.deep.equal(
      beforeMatches.map((match) => match.textContent)
    );
    expect(after.shadowRoot!.querySelector("[data-active]") == null).to.be.true;
    expect(
      afterMatches.every(
        (match) => match.getAttribute("aria-current") === "false"
      )
    ).to.be.true;
  });
});

it("keeps per-node copy actions visible in coarse/no-hover mode without overflowing a narrow row", async () => {
  const el = (await fixture(html`
    <lr-json-viewer
      copyable
      style="display:block;inline-size:12rem"
      .data=${{ "a-very-long-property-name-that-must-wrap": "value" }}
    ></lr-json-viewer>
  `)) as LyraJsonViewer;
  const mediaRule = el
    .shadowRoot!.adoptedStyleSheets.flatMap((sheet) => [...sheet.cssRules])
    .find(
      (rule): rule is CSSMediaRule =>
        rule instanceof CSSMediaRule &&
        rule.conditionText.includes("hover: none") &&
        rule.conditionText.includes("pointer: coarse")
    );
  expect(mediaRule !== undefined).to.be.true;
  const original = mediaRule!.media.mediaText;
  try {
    mediaRule!.media.mediaText = "all";
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => resolve())
    );
    const button = [
      ...el.shadowRoot!.querySelectorAll<HTMLElement>(
        '.row [part="copy-button"]'
      ),
    ][0]!;
    const row = button.closest(".row") as HTMLElement;
    expect(getComputedStyle(button).opacity).to.equal("1");
    expect(button.getBoundingClientRect().right).to.be.at.most(
      row.getBoundingClientRect().right + 1
    );
  } finally {
    mediaRule!.media.mediaText = original;
  }
});

describe("hover-rule specificity (::part() theming escape hatch)", () => {
  it("wraps the toggle's hover retheme rule in :where() so a consumer's ::part(toggle):hover wins", () => {
    const css = styles.cssText.replace(/"/g, "'").replace(/\s+/g, " ");
    expect(css).to.match(
      /:where\(\[part='toggle'\]\):hover:where\(:not\(\[hidden\]\)\)\s*\{[^}]*background:\s*var\(--lr-color-brand-quiet\)/
    );
  });

  it("a ::part(copy-button):hover override actually wins over the internal reveal rule", async function () {
    if (window.matchMedia("(hover: none), (pointer: coarse)").matches)
      this.skip();
    // The reveal rule inside the shadow root is full-specificity ((0,3,0)) and this consumer
    // selector is (0,1,1) -- it still wins, because an outer tree's declarations sort ahead of the
    // shadow tree's regardless of specificity. Read off the rendered element under a real pointer,
    // never off the stylesheet text: the previous version of this test asserted the selector shape
    // instead and passed the whole time the reveal rule itself was being out-specificitied into
    // never applying.
    const style = document.createElement("style");
    style.textContent = `lr-json-viewer::part(copy-button):hover { opacity: 0.5; }`;
    document.head.appendChild(style);
    try {
      const el = await withData(sample);
      el.copyable = true;
      await el.updateComplete;
      const button = el.shadowRoot!.querySelector(
        '.row [part="copy-button"]'
      ) as HTMLElement;
      button.scrollIntoView({ block: "center", inline: "center" });
      await new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve))
      );
      const rect = button.getBoundingClientRect();
      await resetMouse();
      await sendMouse({
        type: "move",
        position: [
          Math.round(rect.left + rect.width / 2),
          Math.round(rect.top + rect.height / 2),
        ],
      });
      await waitUntil(
        () => getComputedStyle(button).opacity === "0.5",
        "the consumer's ::part(copy-button):hover opacity never took effect"
      );
    } finally {
      await resetMouse();
      style.remove();
    }
  });
});

describe("search-match highlight cssprop indirection", () => {
  it("recolors the match highlight from --lr-json-viewer-match-bg on an ancestor, not a bare shared token", async () => {
    const el = await withData(sample);
    el.style.setProperty("--lr-json-viewer-match-bg", "rgb(10, 20, 30)");
    el.search = "ada";
    await el.updateComplete;
    const match = el.shadowRoot!.querySelector(
      '[part="value"][data-match]'
    ) as HTMLElement;
    expect(getComputedStyle(match).backgroundColor).to.equal("rgb(10, 20, 30)");
  });

  it("renders byte-identically to the pre-cssprop-indirection output when the prop is unset", async () => {
    const el = await withData(sample);
    el.search = "ada";
    await el.updateComplete;
    const match = el.shadowRoot!.querySelector(
      '[part="value"][data-match]'
    ) as HTMLElement;
    // The invariant is that the fallback arm still resolves to --lr-color-warning-quiet -- NOT that
    // the token holds any particular hex. Resolving it here rather than restating its value keeps
    // this honest across a palette regeneration, which is what broke the literal it replaced.
    const probe = document.createElement("span");
    probe.style.color = getComputedStyle(el)
      .getPropertyValue("--lr-color-warning-quiet")
      .trim();
    el.shadowRoot!.append(probe);
    const quiet = getComputedStyle(probe).color;
    probe.remove();
    expect(quiet).to.match(/^rgb/);
    expect(getComputedStyle(match).backgroundColor).to.equal(quiet);
  });
});

describe("lifecycle: willUpdate calls super", () => {
  it("calls super.willUpdate() so a future base-class hook is not silently skipped", async () => {
    let sawCall = false;
    const original = LyraElement.prototype.willUpdate;
    (
      LyraElement.prototype as unknown as { willUpdate: () => void }
    ).willUpdate = function (this: LyraElement, ...args: unknown[]) {
      sawCall = true;
      return (original as (...a: unknown[]) => void).apply(this, args);
    };
    try {
      const el = await withData(sample);
      el.search = "ada";
      await el.updateComplete;
      expect(sawCall).to.be.true;
    } finally {
      LyraElement.prototype.willUpdate = original;
    }
  });
});

it("searchPrevious walks backwards and wraps past the first match", async () => {
  const el = (await fixture(
    html`<lr-json-viewer .data=${{ ada: "ada" }}></lr-json-viewer>`
  )) as LyraJsonViewer;
  await el.runSearch("ada");
  let detail: { activeIndex: number } | undefined;
  el.addEventListener(
    "lr-search-change",
    (e) => (detail = (e as CustomEvent).detail)
  );

  expect(await el.searchNext()).to.be.true;
  expect(detail!.activeIndex).to.equal(0);
  expect(await el.searchPrevious()).to.be.true;
  expect(
    detail!.activeIndex,
    "stepping back from the first match wraps to the last"
  ).to.equal(1);
  expect(await el.searchPrevious()).to.be.true;
  expect(detail!.activeIndex).to.equal(0);
  expect(
    el.shadowRoot!.querySelector("[data-active]")!.getAttribute("aria-current")
  ).to.equal("true");
});

it("searchPrevious resolves false when there is nothing to move to", async () => {
  const el = (await fixture(
    html`<lr-json-viewer .data=${{ ada: "ada" }}></lr-json-viewer>`
  )) as LyraJsonViewer;
  await el.runSearch("no-such-token");
  expect(await el.searchPrevious()).to.be.false;
});

describe("responsive: 320px allocation", () => {
  it("keeps a long unbroken key from forcing horizontal overflow instead of wrapping", async () => {
    // [part='value'] already wraps long unbroken text (overflow-wrap: anywhere +
    // min-inline-size: 0); this asserts the KEY -- flex: 0 0 auto in the row, with no
    // shrink/wrap handling of its own -- doesn't force the whole row (and with it, the
    // scrollable base part) wider than a 320px allocation.
    const longKey = `veryLongUnbrokenPropertyName${"Segment".repeat(20)}`;
    const wrapper = (await fixture(html`
      <div style="inline-size: 320px; max-inline-size: 320px;">
        <lr-json-viewer .data=${{ [longKey]: "x" }}></lr-json-viewer>
      </div>
    `)) as HTMLElement;
    const el = wrapper.querySelector("lr-json-viewer") as LyraJsonViewer;
    await el.updateComplete;

    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    expect(base.scrollWidth).to.be.at.most(
      Math.ceil(base.getBoundingClientRect().width) + 1
    );
    const key = el.shadowRoot!.querySelector('[part="key"]') as HTMLElement;
    expect(key.textContent).to.equal(longKey);
    expect(key.scrollWidth).to.be.at.most(
      Math.ceil(key.getBoundingClientRect().width) + 1
    );
  });
});

describe("per-row copy-button reveal", () => {
  /** Two animation frames -- enough for a pointer move to have been dispatched and the
   *  resulting :hover state to have been applied and painted. */
  async function nextFrames(): Promise<void> {
    await new Promise((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(resolve))
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
    await nextFrames();
  }

  /** The `age` row -- a leaf row that carries both a hidden toggle and its own copy button. */
  async function ageRow(): Promise<{ row: HTMLElement; button: HTMLElement }> {
    const el = await withData(sample);
    el.copyable = true;
    await el.updateComplete;
    const row = Array.from(el.shadowRoot!.querySelectorAll(".row")).find(
      (candidate) =>
        candidate.querySelector('[part="key"]')?.textContent === "age"
    ) as HTMLElement;
    return {
      row,
      button: row.querySelector('[part="copy-button"]') as HTMLElement,
    };
  }

  it("holds a per-row copy button hidden at rest", async () => {
    const { button } = await ageRow();
    expect(getComputedStyle(button).opacity).to.equal("0");
  });

  it("reveals a per-row copy button while the pointer rests on its row", async function () {
    if (window.matchMedia("(hover: none), (pointer: coarse)").matches)
      this.skip();
    const { row, button } = await ageRow();
    expect(getComputedStyle(button).opacity).to.equal("0");
    try {
      await resetMouse();
      await moveMouseTo(row);
      await waitUntil(
        () => getComputedStyle(button).opacity === "1",
        "row :hover never revealed the per-row copy button"
      );
    } finally {
      await resetMouse();
    }
  });

  it("reveals a per-row copy button while focus is anywhere inside its row", async () => {
    const { row, button } = await ageRow();
    expect(getComputedStyle(button).opacity).to.equal("0");
    // Focus a DIFFERENT control in the row, so the reveal can only come from the row's
    // :focus-within arm -- never from the button's own :focus-visible rule.
    const sibling = row.querySelector('[part="toggle"]') as HTMLElement;
    sibling.removeAttribute("hidden");
    sibling.tabIndex = 0;
    sibling.focus();
    await waitUntil(
      () => getComputedStyle(button).opacity === "1",
      "row :focus-within never revealed the per-row copy button"
    );
  });

  it("leaves the toolbar copy button visible at rest -- it has no ancestor row", async () => {
    const el = await withData(sample);
    el.copyable = true;
    await el.updateComplete;
    const toolbarButton = el.shadowRoot!.querySelector(
      '[part="toolbar"] [part="copy-button"]'
    ) as HTMLElement;
    expect(getComputedStyle(toolbarButton).opacity).to.equal("1");
  });
});
