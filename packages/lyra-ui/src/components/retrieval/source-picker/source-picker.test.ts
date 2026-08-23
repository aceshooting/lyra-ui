import { fixture, expect, html, oneEvent, waitUntil } from "@open-wc/testing";
import "./source-picker.js";
import type { LyraSourcePicker, LyraSourceEntry } from "./source-picker.js";
import { styles } from "./source-picker.styles.js";
import { ANNOUNCEMENT_SINK_ATTRIBUTE } from "../../../internal/announcer.js";

type CheckboxElement = HTMLElement & {
  checked: boolean;
  indeterminate: boolean;
  updateComplete: Promise<unknown>;
};

const selectAllCheckbox = (el: LyraSourcePicker): CheckboxElement =>
  el.shadowRoot!.querySelector<CheckboxElement>(
    'lr-checkbox[part="select-all-control"]'
  )!;

const checkboxControl = (checkbox: CheckboxElement): HTMLElement =>
  checkbox.shadowRoot!.querySelector<HTMLElement>('[role="checkbox"]')!;

const checkboxBox = (checkbox: CheckboxElement): HTMLElement =>
  checkbox.shadowRoot!.querySelector<HTMLElement>('[part~="box"]')!;

const sources: LyraSourceEntry[] = [
  {
    id: "folder1",
    label: "Research papers",
    children: [
      { id: "doc1", label: "curie-bio.pdf", mimeType: "application/pdf" },
      { id: "doc2", label: "nobel-list.csv", mimeType: "text/csv" },
    ],
  },
  { id: "doc3", label: "notes.txt", mimeType: "text/plain" },
];

it('defaults to empty sources/selectedSourceIds, showSelectAll=true, searchable=true, omitted label', async () => {
  const el = (await fixture(
    html`<lr-source-picker></lr-source-picker>`
  )) as LyraSourcePicker;
  expect(el.sources).to.deep.equal([]);
  expect(el.selectedSourceIds).to.deep.equal([]);
  expect(el.showSelectAll).to.be.true;
  expect(el.searchable).to.be.true;
  expect(el.label).to.equal(undefined);
});

it('fails closed for non-array collections and omits entries with blank or non-string labels', async () => {
  const el = (await fixture(
    html`<lr-source-picker></lr-source-picker>`,
  )) as LyraSourcePicker;
  (el as unknown as { sources: unknown }).sources = [
    { id: 'missing-label' },
    { id: 'blank-label', label: '   ' },
    { id: 'valid', label: 'Valid source' },
  ];
  (el as unknown as { selectedSourceIds: unknown }).selectedSourceIds = null;
  await el.updateComplete;

  const rows = el.shadowRoot!.querySelectorAll('[role="treeitem"]');
  expect(rows).to.have.length(1);
  expect(rows[0]!.getAttribute('aria-label')).to.not.equal('');

  (el as unknown as { sources: unknown }).sources = null;
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('lr-empty')).to.exist;
});

it('renders a role="tree" with one treeitem per visible entry (top-level collapsed by default)', async () => {
  const el = (await fixture(
    html`<lr-source-picker></lr-source-picker>`
  )) as LyraSourcePicker;
  el.sources = sources;
  await el.updateComplete;
  const items = el.shadowRoot!.querySelectorAll('[role="treeitem"]');
  expect(items.length).to.equal(2); // folder1 (collapsed) + doc3
  expect(
    el
      .shadowRoot!.querySelector('[part="tree"]')!
      .getAttribute("aria-multiselectable")
  ).to.equal("true");
});

it("uses aria-checked as the sole false, true, and mixed treeitem selection state", async () => {
  const el = (await fixture(
    html`<lr-source-picker></lr-source-picker>`
  )) as LyraSourcePicker;
  el.sources = sources;
  el.selectedSourceIds = ['doc1'];
  await el.updateComplete;
  const folderRow = el.shadowRoot!.querySelector('[role="treeitem"]')!;
  expect(folderRow.getAttribute("aria-checked")).to.equal("mixed");
  expect(folderRow.getAttribute("aria-selected")).to.equal(null);

  el.selectedSourceIds = ['doc1', 'doc2'];
  await el.updateComplete;
  expect(
    el
      .shadowRoot!.querySelector('[role="treeitem"]')!
      .getAttribute("aria-checked")
  ).to.equal("true");
  expect(
    el
      .shadowRoot!.querySelector('[role="treeitem"]')!
      .getAttribute("aria-selected")
  ).to.equal(null);

  el.selectedSourceIds = [];
  await el.updateComplete;
  expect(
    el
      .shadowRoot!.querySelector('[role="treeitem"]')!
      .getAttribute("aria-checked")
  ).to.equal("false");
  expect(
    el
      .shadowRoot!.querySelector('[role="treeitem"]')!
      .getAttribute("aria-selected")
  ).to.equal(null);
});

it("toggling a folder selects/deselects all of its descendant leaves and emits lr-sources-change", async () => {
  const el = (await fixture(
    html`<lr-source-picker></lr-source-picker>`
  )) as LyraSourcePicker;
  el.sources = sources;
  await el.updateComplete;
  const folderRow = el.shadowRoot!.querySelector(
    '[role="treeitem"]'
  ) as HTMLElement;
  const listener = oneEvent(el, "lr-sources-change");
  folderRow.click();
  const event = await listener;
  expect([...event.detail.selectedSourceIds].sort()).to.deep.equal(['doc1', 'doc2']);
  expect([...el.selectedSourceIds].sort()).to.deep.equal(['doc1', 'doc2']);
});

it("toggling select-all selects/deselects every leaf", async () => {
  const el = (await fixture(
    html`<lr-source-picker></lr-source-picker>`
  )) as LyraSourcePicker;
  el.sources = sources;
  await el.updateComplete;
  const selectAll = selectAllCheckbox(el);
  const listener = oneEvent(el, "lr-sources-change");
  selectAll.click();
  const event = await listener;
  expect([...event.detail.selectedSourceIds].sort()).to.deep.equal([
    "doc1",
    "doc2",
    "doc3",
  ]);
  expect(
    el.shadowRoot!.querySelector('[part="summary"]')!.textContent
  ).to.include("3 of 3");
});

it("search filters by label, auto-expanding and keeping visible any matching descendant", async () => {
  const el = (await fixture(
    html`<lr-source-picker></lr-source-picker>`
  )) as LyraSourcePicker;
  el.sources = sources;
  await el.updateComplete;
  const input = el.shadowRoot!.querySelector('[part="search"]')!;
  input.dispatchEvent(
    new CustomEvent("lr-input", { detail: { value: "curie" }, bubbles: true })
  );
  await el.updateComplete;
  const labels = [...el.shadowRoot!.querySelectorAll('[part="label"]')].map(
    (l) => l.textContent
  );
  expect(labels).to.include("curie-bio.pdf");
  expect(labels).to.include("Research papers"); // ancestor stays visible
  expect(labels).to.not.include("nobel-list.csv");
  expect(labels).to.not.include("notes.txt");
});

it("shows noMatches when the filter empties the tree, and noData when sources itself is empty", async () => {
  const el = (await fixture(
    html`<lr-source-picker></lr-source-picker>`
  )) as LyraSourcePicker;
  el.sources = sources;
  await el.updateComplete;
  const input = el.shadowRoot!.querySelector('[part="search"]')!;
  input.dispatchEvent(
    new CustomEvent("lr-input", {
      detail: { value: "zzz-no-match" },
      bubbles: true,
    })
  );
  await el.updateComplete;
  expect(
    el.shadowRoot!.querySelector('[part="empty"]')!.textContent
  ).to.include("No matches");

  el.sources = [];
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector("lr-empty")).to.exist;
});

it("keyboard: Space toggles the focused row, ArrowDown moves focus, ArrowRight expands a folder", async () => {
  const el = (await fixture(
    html`<lr-source-picker></lr-source-picker>`
  )) as LyraSourcePicker;
  el.sources = sources;
  await el.updateComplete;
  const tree = el.shadowRoot!.querySelector('[part="tree"]')!;
  tree.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "ArrowRight",
      bubbles: true,
      cancelable: true,
    })
  );
  await el.updateComplete;
  // folder1 expanded: folder1 + its 2 children (doc1, doc2) + doc3 = 4. This matches the `sources`
  // fixture and the tri-state/folder-toggle tests, which also treat both children as visible.
  expect(el.shadowRoot!.querySelectorAll('[role="treeitem"]').length).to.equal(
    4
  );

  const listener = oneEvent(el, "lr-sources-change");
  tree.dispatchEvent(
    new KeyboardEvent("keydown", { key: " ", bubbles: true, cancelable: true })
  );
  const event = await listener;
  expect([...event.detail.selectedSourceIds].sort()).to.deep.equal(['doc1', 'doc2']);
});

it("keyboard: the shared select-all checkbox toggles with Space and leaves Enter to the form", async () => {
  const el = (await fixture(
    html`<lr-source-picker></lr-source-picker>`
  )) as LyraSourcePicker;
  el.sources = sources;
  await el.updateComplete;
  const selectAll = selectAllCheckbox(el);
  await selectAll.updateComplete;
  const control = checkboxControl(selectAll);

  const selectListener = oneEvent(el, "lr-sources-change");
  const space = new KeyboardEvent("keydown", {
    key: " ",
    bubbles: true,
    cancelable: true,
  });
  control.dispatchEvent(space);
  const selected = await selectListener;
  expect([...selected.detail.selectedSourceIds].sort()).to.deep.equal([
    "doc1",
    "doc2",
    "doc3",
  ]);
  expect(space.defaultPrevented).to.be.true; // Space must not scroll

  el.selectedSourceIds = ['doc1', 'doc2', 'doc3'];
  await el.updateComplete;
  let enterChanges = 0;
  el.addEventListener("lr-sources-change", () => enterChanges++);
  control.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "Enter",
      bubbles: true,
      cancelable: true,
    })
  );
  await el.updateComplete;
  expect(enterChanges).to.equal(0);

  const deselectListener = oneEvent(el, "lr-sources-change");
  control.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: " ",
      bubbles: true,
      cancelable: true,
    })
  );
  const deselected = await deselectListener;
  expect(deselected.detail.selectedSourceIds).to.deep.equal([]);
});

it('keeps explicit-empty and dynamic host naming distinct from the source tree', async () => {
  const el = (await fixture(
    html`<lr-source-picker
      aria-label="Grounding sources"
      label="Sources"
    ></lr-source-picker>`
  )) as LyraSourcePicker;
  el.sources = sources;
  await el.updateComplete;
  expect(el.accessibleLabel).to.equal("Grounding sources");
  expect(el.getAttribute("aria-label")).to.equal("Grounding sources");
  const tree = el.shadowRoot!.querySelector('[role="tree"]')!;
  expect(tree.getAttribute("aria-label")).to.equal("Sources");

  el.setAttribute("aria-label", "");
  await el.updateComplete;
  expect(el.getAttribute("aria-label")).to.equal("");
  expect(tree.getAttribute("aria-label")).to.equal("Sources");

  el.setAttribute("aria-label", "Revised sources");
  await el.updateComplete;
  expect(el.getAttribute("aria-label")).to.equal("Revised sources");
  expect(tree.getAttribute("aria-label")).to.equal("Sources");

  el.removeAttribute("aria-label");
  await el.updateComplete;
  expect(el.getAttribute("aria-label")).to.equal(null);
  expect(
    el.shadowRoot!.querySelector('[role="tree"]')!.getAttribute("aria-label")
  ).to.equal("Sources");
});

it('honors an explicitly empty label as genuinely empty, distinct from omitting it', async () => {
  const el = (await fixture(
    html`<lr-source-picker></lr-source-picker>`
  )) as LyraSourcePicker;
  el.sources = sources;
  await el.updateComplete;
  const tree = () => el.shadowRoot!.querySelector('[role="tree"]')!;
  expect(el.label).to.equal(undefined);
  expect(tree().getAttribute("aria-label")).to.equal("Sources");

  el.label = "";
  await el.updateComplete;
  expect(tree().getAttribute("aria-label")).to.equal("");

  el.label = undefined;
  await el.updateComplete;
  expect(tree().getAttribute("aria-label")).to.equal("Sources");
});

it('honors an explicitly empty label as genuinely empty when the host already has an aria-label', async () => {
  const el = (await fixture(
    html`<lr-source-picker aria-label="Grounding sources"></lr-source-picker>`
  )) as LyraSourcePicker;
  el.sources = sources;
  await el.updateComplete;
  const tree = () => el.shadowRoot!.querySelector('[role="tree"]')!;
  expect(el.label).to.equal(undefined);
  expect(tree().getAttribute("aria-label")).to.equal("Sources");

  el.label = "";
  await el.updateComplete;
  expect(tree().getAttribute("aria-label")).to.equal("");

  el.label = undefined;
  await el.updateComplete;
  expect(tree().getAttribute("aria-label")).to.equal("Sources");
});

it("honors a .strings override for the select-all label and the empty/no-matches states", async () => {
  const el = (await fixture(
    html`<lr-source-picker></lr-source-picker>`
  )) as LyraSourcePicker;
  el.sources = sources;
  el.strings = {
    selectAllSources: "Tout sélectionner",
    noMatches: "Aucun résultat",
    noData: "Aucune donnée",
  };
  await el.updateComplete;

  const selectAll = selectAllCheckbox(el);
  expect(selectAll.textContent).to.equal("Tout sélectionner");

  const input = el.shadowRoot!.querySelector('[part="search"]')!;
  input.dispatchEvent(
    new CustomEvent("lr-input", {
      detail: { value: "zzz-no-match" },
      bubbles: true,
    })
  );
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="empty"]')!.textContent).to.equal(
    "Aucun résultat"
  );

  el.sources = [];
  await el.updateComplete;
  const emptyHeading = el
    .shadowRoot!.querySelector("lr-empty")!
    .getAttribute("heading");
  expect(emptyHeading).to.equal("Aucune donnée");
});

it("delegates select-all interaction semantics to lr-checkbox and maps the component state tokens", async () => {
  const css = styles.cssText.replace(/\s+/g, " ");
  expect(css).to.include('[part="select-all-control"]');
  expect(css).to.include("--lr-checkbox-checked-bg");
  const el = (await fixture(
    html`<lr-source-picker
      .sources=${sources}
      .selectedSourceIds=${['doc1']}
    ></lr-source-picker>`
  )) as LyraSourcePicker;
  const checkbox = selectAllCheckbox(el);
  await checkbox.updateComplete;
  expect(checkbox.indeterminate).to.equal(true);
  expect(checkboxControl(checkbox).getAttribute("role")).to.equal("checkbox");
  expect(checkboxControl(checkbox).getAttribute("aria-checked")).to.equal(
    "mixed"
  );
});

it("is not FormAssociated -- no internals/checkValidity surface", async () => {
  const el = (await fixture(
    html`<lr-source-picker></lr-source-picker>`
  )) as LyraSourcePicker;
  expect((el as unknown as { checkValidity?: unknown }).checkValidity).to.equal(
    undefined
  );
});

it("is accessible with a mixed-selection tree", async () => {
  const el = (await fixture(
    html`<lr-source-picker></lr-source-picker>`
  )) as LyraSourcePicker;
  el.sources = sources;
  el.selectedSourceIds = ['doc1'];
  await el.updateComplete;
  await expect(el).to.be.accessible();
});

it("toggling a fully-selected folder deselects all of its descendant leaves", async () => {
  const el = (await fixture(
    html`<lr-source-picker></lr-source-picker>`
  )) as LyraSourcePicker;
  el.sources = sources;
  el.selectedSourceIds = ['doc1', 'doc2'];
  await el.updateComplete;
  const folderRow = el.shadowRoot!.querySelector(
    '[role="treeitem"]'
  ) as HTMLElement;
  expect(folderRow.getAttribute("aria-checked")).to.equal("true");
  const listener = oneEvent(el, "lr-sources-change");
  folderRow.click();
  const event = await listener;
  expect(event.detail.selectedSourceIds).to.deep.equal([]);
  expect(el.selectedSourceIds).to.deep.equal([]);
});

it("keyboard: ArrowDown/ArrowUp move the active row and DOM focus between top-level entries", async () => {
  const el = (await fixture(
    html`<lr-source-picker></lr-source-picker>`
  )) as LyraSourcePicker;
  el.sources = sources;
  await el.updateComplete;
  const tree = el.shadowRoot!.querySelector('[part="tree"]')!;

  tree.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "ArrowDown",
      bubbles: true,
      cancelable: true,
    })
  );
  await el.updateComplete;
  let items = el.shadowRoot!.querySelectorAll('[role="treeitem"]');
  expect(items[1]!.getAttribute("tabindex")).to.equal("0");
  expect(items[0]!.getAttribute("tabindex")).to.equal("-1");
  expect(el.shadowRoot!.activeElement === items[1]).to.equal(true);

  tree.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "ArrowUp",
      bubbles: true,
      cancelable: true,
    })
  );
  await el.updateComplete;
  items = el.shadowRoot!.querySelectorAll('[role="treeitem"]');
  expect(items[0]!.getAttribute("tabindex")).to.equal("0");
  expect(el.shadowRoot!.activeElement === items[0]).to.equal(true);
});

it("keeps an in-flight keyboard focus target by id when sources reorder before the update", async () => {
  const el = (await fixture(
    html`<lr-source-picker
      .sources=${[
        { id: "a", label: "Alpha" },
        { id: "b", label: "Beta" },
        { id: "c", label: "Gamma" },
      ]}
    ></lr-source-picker>`
  )) as LyraSourcePicker;
  const tree = el.shadowRoot!.querySelector('[part="tree"]')!;

  tree.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "ArrowDown",
      bubbles: true,
      cancelable: true,
    })
  );
  el.sources = [
    { id: "c", label: "Gamma" },
    { id: "a", label: "Alpha" },
    { id: "b", label: "Beta" },
  ];
  await el.updateComplete;
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

  expect(el.shadowRoot!.activeElement?.textContent).to.include("Beta");
  expect(
    el.shadowRoot!.querySelectorAll('[role="treeitem"][tabindex="0"]')
  ).to.have.length(1);
  expect(
    el.shadowRoot!.querySelector('[role="treeitem"][tabindex="0"]')?.textContent
  ).to.include("Beta");
});

it("keyboard: Home/End jump the active row to the first/last visible entry", async () => {
  const el = (await fixture(
    html`<lr-source-picker></lr-source-picker>`
  )) as LyraSourcePicker;
  el.sources = sources;
  await el.updateComplete;
  const tree = el.shadowRoot!.querySelector('[part="tree"]')!;

  tree.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "ArrowRight",
      bubbles: true,
      cancelable: true,
    })
  ); // expand folder1
  await el.updateComplete;
  expect(el.shadowRoot!.querySelectorAll('[role="treeitem"]').length).to.equal(
    4
  );

  tree.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "End",
      bubbles: true,
      cancelable: true,
    })
  );
  await el.updateComplete;
  let items = el.shadowRoot!.querySelectorAll('[role="treeitem"]');
  expect(items[3]!.getAttribute("tabindex")).to.equal("0"); // doc3, the last visible row
  expect(el.shadowRoot!.activeElement === items[3]).to.equal(true);

  tree.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "Home",
      bubbles: true,
      cancelable: true,
    })
  );
  await el.updateComplete;
  items = el.shadowRoot!.querySelectorAll('[role="treeitem"]');
  expect(items[0]!.getAttribute("tabindex")).to.equal("0"); // folder1, the first visible row
  expect(el.shadowRoot!.activeElement === items[0]).to.equal(true);
});

it("keyboard: ArrowRight on an already-expanded, focused folder moves focus into its first child", async () => {
  const el = (await fixture(
    html`<lr-source-picker></lr-source-picker>`
  )) as LyraSourcePicker;
  el.sources = sources;
  await el.updateComplete;
  const tree = el.shadowRoot!.querySelector('[part="tree"]')!;

  tree.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "ArrowRight",
      bubbles: true,
      cancelable: true,
    })
  ); // expand
  await el.updateComplete;
  tree.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "ArrowRight",
      bubbles: true,
      cancelable: true,
    })
  ); // move into child
  await el.updateComplete;

  const items = el.shadowRoot!.querySelectorAll('[role="treeitem"]');
  expect(items.length).to.equal(4);
  expect(items[1]!.getAttribute("tabindex")).to.equal("0"); // doc1, folder1's first child
  expect(el.shadowRoot!.activeElement === items[1]).to.equal(true);
});

it("keyboard: ArrowLeft collapses an expanded, focused folder", async () => {
  const el = (await fixture(
    html`<lr-source-picker></lr-source-picker>`
  )) as LyraSourcePicker;
  el.sources = sources;
  await el.updateComplete;
  const tree = el.shadowRoot!.querySelector('[part="tree"]')!;

  tree.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "ArrowRight",
      bubbles: true,
      cancelable: true,
    })
  ); // expand
  await el.updateComplete;
  expect(el.shadowRoot!.querySelectorAll('[role="treeitem"]').length).to.equal(
    4
  );

  tree.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "ArrowLeft",
      bubbles: true,
      cancelable: true,
    })
  ); // collapse
  await el.updateComplete;
  const items = el.shadowRoot!.querySelectorAll('[role="treeitem"]');
  expect(items.length).to.equal(2);
  expect(items[0]!.getAttribute("aria-expanded")).to.equal("false");
});

it("keyboard: ArrowLeft on a focused leaf walks focus back to its ancestor folder", async () => {
  const el = (await fixture(
    html`<lr-source-picker></lr-source-picker>`
  )) as LyraSourcePicker;
  el.sources = sources;
  await el.updateComplete;
  const tree = el.shadowRoot!.querySelector('[part="tree"]')!;

  tree.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "ArrowRight",
      bubbles: true,
      cancelable: true,
    })
  ); // expand folder1
  await el.updateComplete;
  tree.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "ArrowDown",
      bubbles: true,
      cancelable: true,
    })
  ); // focus doc1
  await el.updateComplete;
  let items = el.shadowRoot!.querySelectorAll('[role="treeitem"]');
  expect(items[1]!.getAttribute("tabindex")).to.equal("0"); // sanity: doc1 is focused, has no children

  tree.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "ArrowLeft",
      bubbles: true,
      cancelable: true,
    })
  );
  await el.updateComplete;
  items = el.shadowRoot!.querySelectorAll('[role="treeitem"]');
  expect(items[0]!.getAttribute("tabindex")).to.equal("0"); // back to folder1
  expect(el.shadowRoot!.activeElement === items[0]).to.equal(true);
});

it("keyboard: Enter on the focused tree row toggles it, same as Space", async () => {
  const el = (await fixture(
    html`<lr-source-picker></lr-source-picker>`
  )) as LyraSourcePicker;
  el.sources = sources;
  await el.updateComplete;
  const tree = el.shadowRoot!.querySelector('[part="tree"]')!;
  const listener = oneEvent(el, "lr-sources-change");
  tree.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "Enter",
      bubbles: true,
      cancelable: true,
    })
  );
  const event = await listener;
  expect([...event.detail.selectedSourceIds].sort()).to.deep.equal(['doc1', 'doc2']);
});

it('keyboard: under dir="rtl", ArrowLeft expands and ArrowRight collapses (expand/collapse keys swap)', async () => {
  const el = (await fixture(
    html`<lr-source-picker dir="rtl"></lr-source-picker>`
  )) as LyraSourcePicker;
  el.sources = sources;
  await el.updateComplete;
  const tree = el.shadowRoot!.querySelector('[part="tree"]')!;

  tree.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "ArrowLeft",
      bubbles: true,
      cancelable: true,
    })
  );
  await el.updateComplete;
  expect(el.shadowRoot!.querySelectorAll('[role="treeitem"]').length).to.equal(
    4
  );

  tree.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "ArrowRight",
      bubbles: true,
      cancelable: true,
    })
  );
  await el.updateComplete;
  expect(el.shadowRoot!.querySelectorAll('[role="treeitem"]').length).to.equal(
    2
  );
});

it("keyboard: an unrecognized key is a no-op", async () => {
  const el = (await fixture(
    html`<lr-source-picker></lr-source-picker>`
  )) as LyraSourcePicker;
  el.sources = sources;
  await el.updateComplete;
  const tree = el.shadowRoot!.querySelector('[part="tree"]')!;
  let fired = false;
  el.addEventListener("lr-sources-change", () => {
    fired = true;
  });

  tree.dispatchEvent(
    new KeyboardEvent("keydown", { key: "a", bubbles: true, cancelable: true })
  );
  await el.updateComplete;
  expect(fired).to.be.false;
  expect(
    el
      .shadowRoot!.querySelectorAll('[role="treeitem"]')[0]!
      .getAttribute("tabindex")
  ).to.equal("0");
});

it("focusing a row directly (e.g. via Tab) moves the active/tabindex row to it", async () => {
  const el = (await fixture(
    html`<lr-source-picker></lr-source-picker>`
  )) as LyraSourcePicker;
  el.sources = sources;
  await el.updateComplete;
  const items = el.shadowRoot!.querySelectorAll('[role="treeitem"]');
  expect(items[0]!.getAttribute("tabindex")).to.equal("0");

  (items[1] as HTMLElement).focus();
  await el.updateComplete;
  const updated = el.shadowRoot!.querySelectorAll('[role="treeitem"]');
  expect(updated[1]!.getAttribute("tabindex")).to.equal("0");
  expect(updated[0]!.getAttribute("tabindex")).to.equal("-1");
});

it("moves real DOM focus to the closest survivor when the focused source is removed", async () => {
  const el = (await fixture(
    html`<lr-source-picker
      .sources=${[
        { id: "a", label: "Alpha" },
        { id: "b", label: "Beta" },
        { id: "c", label: "Gamma" },
      ]}
    ></lr-source-picker>`
  )) as LyraSourcePicker;
  const rows =
    el.shadowRoot!.querySelectorAll<HTMLElement>('[role="treeitem"]');
  rows[1]!.focus();
  expect(el.shadowRoot!.activeElement?.textContent).to.include("Beta");

  el.sources = [
    { id: "a", label: "Alpha" },
    { id: "c", label: "Gamma" },
  ];
  await el.updateComplete;
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

  expect(el.shadowRoot!.activeElement?.getAttribute("role")).to.equal(
    "treeitem"
  );
  expect(el.shadowRoot!.activeElement?.textContent).to.include("Gamma");
  expect(
    el.shadowRoot!.querySelectorAll('[role="treeitem"][tabindex="0"]')
  ).to.have.length(1);
});

it("moves real DOM focus to a stable base when the focused source is removed with the whole tree", async () => {
  const el = (await fixture(
    html`<lr-source-picker
      .sources=${[{ id: "only", label: "Only source" }]}
    ></lr-source-picker>`
  )) as LyraSourcePicker;
  el.shadowRoot!.querySelector<HTMLElement>('[role="treeitem"]')!.focus();

  el.sources = [];
  await el.updateComplete;
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

  expect(el.shadowRoot!.activeElement?.getAttribute("part")).to.equal("base");
  expect(
    (el.shadowRoot!.activeElement as HTMLElement | null)?.tabIndex
  ).to.equal(-1);
});

it("moves real DOM focus to the visible survivor when filtering removes the focused source", async () => {
  const el = (await fixture(
    html`<lr-source-picker
      .sources=${[
        { id: "a", label: "Alpha" },
        { id: "b", label: "Beta" },
        { id: "c", label: "Gamma" },
      ]}
    ></lr-source-picker>`
  )) as LyraSourcePicker;
  const rows =
    el.shadowRoot!.querySelectorAll<HTMLElement>('[role="treeitem"]');
  rows[1]!.focus();
  el.shadowRoot!.querySelector("lr-input")!.dispatchEvent(
    new CustomEvent("lr-input", {
      detail: { value: "gamma" },
      bubbles: true,
      composed: true,
    })
  );
  await el.updateComplete;
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

  expect(el.shadowRoot!.activeElement?.getAttribute("role")).to.equal(
    "treeitem"
  );
  expect(el.shadowRoot!.activeElement?.textContent).to.include("Gamma");
  expect(
    el.shadowRoot!.querySelectorAll('[role="treeitem"][tabindex="0"]')
  ).to.have.length(1);
});

it("searchable=false omits the built-in filter input", async () => {
  const el = (await fixture(
    html`<lr-source-picker></lr-source-picker>`
  )) as LyraSourcePicker;
  el.searchable = false;
  el.sources = sources;
  await el.updateComplete;
  expect(el.shadowRoot!.querySelectorAll('[part="search"]').length).to.equal(0);
});

it('searchable="false" set as a plain HTML attribute (not a property binding) also omits the filter input', async () => {
  // Unlike the `.searchable = false` property-assignment test above, this proves the *attribute*
  // form actually clears the `true` default too -- the gap a stock `type: Boolean` converter
  // can't close, since removing an attribute that was never present fires no
  // `attributeChangedCallback`.
  const el = (await fixture(
    html`<lr-source-picker searchable="false"></lr-source-picker>`
  )) as LyraSourcePicker;
  expect(el.searchable).to.be.false;
  el.sources = sources;
  await el.updateComplete;
  expect(el.shadowRoot!.querySelectorAll('[part="search"]').length).to.equal(0);
});

it("showSelectAll=false omits the select-all header row", async () => {
  const el = (await fixture(
    html`<lr-source-picker></lr-source-picker>`
  )) as LyraSourcePicker;
  el.showSelectAll = false;
  el.sources = sources;
  await el.updateComplete;
  expect(
    el.shadowRoot!.querySelectorAll('[part="select-all"]').length
  ).to.equal(0);
});

it('show-select-all="false" set as a plain HTML attribute (not a property binding) also omits the select-all row', async () => {
  const el = (await fixture(
    html`<lr-source-picker show-select-all="false"></lr-source-picker>`
  )) as LyraSourcePicker;
  expect(el.showSelectAll).to.be.false;
  el.sources = sources;
  await el.updateComplete;
  expect(
    el.shadowRoot!.querySelectorAll('[part="select-all"]').length
  ).to.equal(0);
});

it("keyboard: a non-activation key on the select-all checkbox is a no-op", async () => {
  const el = (await fixture(
    html`<lr-source-picker></lr-source-picker>`
  )) as LyraSourcePicker;
  el.sources = sources;
  await el.updateComplete;
  const selectAll = selectAllCheckbox(el);
  await selectAll.updateComplete;
  let fired = false;
  el.addEventListener("lr-sources-change", () => {
    fired = true;
  });
  const tab = new KeyboardEvent("keydown", {
    key: "Tab",
    bubbles: true,
    cancelable: true,
  });
  checkboxControl(selectAll).dispatchEvent(tab);
  await el.updateComplete;
  expect(fired).to.be.false;
  expect(tab.defaultPrevented).to.be.false;
});

describe("checked-state cssprop escape hatch", () => {
  function resolvedInShadow(
    el: LyraSourcePicker,
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

  async function picker(
    selectedSourceIds: string[],
    style = ""
  ): Promise<LyraSourcePicker> {
    const wrapper = (await fixture(
      html`<div style=${style}><lr-source-picker></lr-source-picker></div>`
    )) as HTMLElement;
    const el = wrapper.querySelector("lr-source-picker") as LyraSourcePicker;
    el.sources = sources;
    el.selectedSourceIds = selectedSourceIds;
    await el.updateComplete;
    await selectAllCheckbox(el).updateComplete;
    return el;
  }
  const selectAllControl = (el: LyraSourcePicker) =>
    checkboxControl(selectAllCheckbox(el));
  const selectAllBox = (el: LyraSourcePicker) =>
    checkboxBox(selectAllCheckbox(el));
  const folderCheckbox = (el: LyraSourcePicker) =>
    el.shadowRoot!.querySelector(
      '[role="treeitem"] [part="checkbox"]'
    ) as HTMLElement;

  it("--lr-source-picker-checked-bg recolors both the checked select-all pill and a fully-selected folder box", async () => {
    const el = await picker(
      ["doc1", "doc2", "doc3"],
      "--lr-source-picker-checked-bg: rgb(0, 51, 102)"
    );
    expect(selectAllControl(el).getAttribute("aria-checked")).to.equal("true");
    expect(getComputedStyle(selectAllBox(el)).backgroundColor).to.equal(
      "rgb(0, 51, 102)"
    );
    expect(folderCheckbox(el).getAttribute("data-state")).to.equal("true");
    expect(getComputedStyle(folderCheckbox(el)).backgroundColor).to.equal(
      "rgb(0, 51, 102)"
    );
  });

  it("--lr-source-picker-checked-border recolors the checked border", async () => {
    const el = await picker(
      ["doc1", "doc2", "doc3"],
      "--lr-source-picker-checked-border: rgb(0, 51, 102)"
    );
    expect(getComputedStyle(selectAllBox(el)).borderTopColor).to.equal(
      "rgb(0, 51, 102)"
    );
    expect(getComputedStyle(folderCheckbox(el)).borderTopColor).to.equal(
      "rgb(0, 51, 102)"
    );
  });

  it("--lr-source-picker-mixed-bg recolors a partially-selected folder box", async () => {
    const el = await picker(
      ["doc1"],
      "--lr-source-picker-mixed-bg: rgb(0, 51, 102)"
    );
    expect(folderCheckbox(el).getAttribute("data-state")).to.equal("mixed");
    expect(getComputedStyle(folderCheckbox(el)).backgroundColor).to.equal(
      "rgb(0, 51, 102)"
    );
  });

  it("renders byte-identical to the pre-hatch tokens when unset", async () => {
    const allSel = await picker(["doc1", "doc2", "doc3"]);
    expect(getComputedStyle(selectAllBox(allSel)).backgroundColor).to.equal(
      resolvedInShadow(
        allSel,
        "background: var(--lr-color-brand-quiet)",
        "background-color"
      )
    );
    expect(getComputedStyle(selectAllBox(allSel)).borderTopColor).to.equal(
      resolvedInShadow(
        allSel,
        "border-top-color: var(--lr-color-brand)",
        "border-top-color"
      )
    );
    expect(getComputedStyle(folderCheckbox(allSel)).backgroundColor).to.equal(
      resolvedInShadow(
        allSel,
        "background: var(--lr-color-brand)",
        "background-color"
      )
    );
    const mixed = await picker(["doc1"]);
    expect(getComputedStyle(folderCheckbox(mixed)).backgroundColor).to.equal(
      resolvedInShadow(
        mixed,
        "background: color-mix(in srgb, var(--lr-color-brand) 50%, var(--lr-color-surface))",
        "background-color"
      )
    );
  });

  // A LIGHT checked background on purpose: the select-all pill carries its own label text in
  // `--lr-color-text`, which this hatch deliberately does not restyle, so the contrast floor there
  // is the consumer's to keep -- the same tradeoff every bg-only cssprop in the library carries.
  it("is accessible with the checked-state props themed", async () => {
    const el = await picker(
      ["doc1", "doc2", "doc3"],
      "--lr-source-picker-checked-bg: rgb(255, 243, 205); --lr-source-picker-checked-border: rgb(120, 80, 0)"
    );
    await expect(el).to.be.accessible();
  });
});

it("exposes tree levels and a separate pointer disclosure affordance for folders", async () => {
  const el = (await fixture(
    html`<lr-source-picker .sources=${sources}></lr-source-picker>`
  )) as LyraSourcePicker;
  const folder = el.shadowRoot!.querySelector('[role="treeitem"]')!;
  expect(folder.getAttribute("aria-level")).to.equal("1");
  const disclosure = folder.querySelector('[part="disclosure"]') as HTMLElement;
  expect(disclosure.tagName).to.equal("SPAN");
  expect(disclosure.getAttribute("role")).to.equal(null);
  expect(disclosure.getAttribute("aria-hidden")).to.equal("true");
  expect(getComputedStyle(disclosure).minInlineSize).to.equal("40px");
  expect(getComputedStyle(disclosure).minBlockSize).to.equal("40px");
  disclosure.click();
  await el.updateComplete;
  expect(el.shadowRoot!.querySelectorAll('[role="treeitem"]').length).to.equal(
    4
  );
  expect(
    el
      .shadowRoot!.querySelectorAll('[role="treeitem"]')[1]!
      .getAttribute("aria-level")
  ).to.equal("2");
});

it("case-folds source search with the effective locale", async () => {
  const el = (await fixture(
    html`<lr-source-picker
      lang="tr"
      .sources=${[{ id: "i", label: "İzmir" }]}
    ></lr-source-picker>`
  )) as LyraSourcePicker;
  const input = el.shadowRoot!.querySelector("lr-input") as HTMLElement & {
    value: string;
  };
  input.dispatchEvent(
    new CustomEvent("lr-input", {
      detail: { value: "iz" },
      bubbles: true,
      composed: true,
    })
  );
  await el.updateComplete;
  expect(el.shadowRoot!.querySelectorAll('[role="treeitem"]').length).to.equal(
    1
  );
});

it("suppresses the raw child input event after consuming it", async () => {
  const el = (await fixture(
    html`<lr-source-picker .sources=${sources}></lr-source-picker>`
  )) as LyraSourcePicker;
  let leaked = 0;
  el.addEventListener("lr-input", () => leaked++);
  el.shadowRoot!.querySelector("lr-input")!.dispatchEvent(
    new CustomEvent("lr-input", {
      detail: { value: "paper" },
      bubbles: true,
      composed: true,
    })
  );
  await el.updateComplete;
  expect(leaked).to.equal(0);
});

it("formats the selection summary counts with the effective locale", async () => {
  const el = (await fixture(
    html`<lr-source-picker
      lang="ar-u-nu-arab"
      .sources=${sources}
    ></lr-source-picker>`
  )) as LyraSourcePicker;
  expect(
    el.shadowRoot!.querySelector('[part="summary"]')!.textContent
  ).to.contain("٠");
  expect(
    el.shadowRoot!.querySelector('[part="summary"]')!.textContent
  ).to.contain("٣");
});

it("renders and selects only the first source occurrence for duplicate ids", async () => {
  const el = (await fixture(
    html`<lr-source-picker></lr-source-picker>`
  )) as LyraSourcePicker;
  el.sources = [
    { id: "duplicate", label: "First occurrence" },
    { id: "duplicate", label: "Second occurrence" },
  ];
  await el.updateComplete;
  const rows = el.shadowRoot!.querySelectorAll('[role="treeitem"]');
  expect(rows.length).to.equal(1);
  expect(rows[0]!.textContent).to.include("First occurrence");
  const pending = oneEvent(el, "lr-sources-change");
  (rows[0] as HTMLElement).click();
  expect((await pending).detail.selectedSourceIds).to.deep.equal(['duplicate']);
});

it('rejects empty and whitespace-only source ids before rendering or selection', async () => {
  const el = (await fixture(
    html`<lr-source-picker></lr-source-picker>`,
  )) as LyraSourcePicker;
  el.sources = [
    { id: '', label: 'Empty source id' },
    { id: '   ', label: 'Blank source id' },
    { id: 'valid', label: 'Valid source' },
  ];
  await el.updateComplete;

  const rows = el.shadowRoot!.querySelectorAll('[part~="item"]');
  expect(rows.length).to.equal(1);
  expect(rows[0]!.textContent).to.include('Valid source');

  const pending = oneEvent(el, 'lr-sources-change');
  (rows[0] as HTMLElement).click();
  expect((await pending).detail.selectedSourceIds).to.deep.equal(['valid']);
});

it("normalizes cyclic and repeated-identity source trees without recursion or duplicate controls", async () => {
  const leaf: LyraSourceEntry = { id: "leaf", label: "Leaf" };
  const root: LyraSourceEntry = { id: "root", label: "Root", children: [] };
  root.children = [root, leaf, leaf];
  const el = (await fixture(
    html`<lr-source-picker .sources=${[root]}></lr-source-picker>`
  )) as LyraSourcePicker;

  el.shadowRoot!.querySelector('[part="search"]')!.dispatchEvent(
    new CustomEvent("lr-input", {
      detail: { value: "Leaf" },
      bubbles: true,
      composed: true,
    })
  );
  await el.updateComplete;
  const rows = [
    ...el.shadowRoot!.querySelectorAll<HTMLElement>('[role="treeitem"]'),
  ];
  expect(
    rows.map((row) => row.querySelector('[part="label"]')?.textContent)
  ).to.deep.equal(["Root", "Leaf"]);
  const pending = oneEvent(el, "lr-sources-change");
  rows[1]!.click();
  expect((await pending).detail.selectedSourceIds).to.deep.equal(['leaf']);
});

it("caps adversarial depth and breadth and exposes a localized visible limit state", async () => {
  let deep: LyraSourceEntry = { id: "deep-leaf", label: "Deep leaf" };
  for (let depth = 80; depth >= 0; depth--) {
    deep = { id: `depth-${depth}`, label: `Depth ${depth}`, children: [deep] };
  }
  const wideValues = Array.from({ length: 2_100 }, (_, index) => ({
    id: `wide-${index}`,
    label: `Wide ${index}`,
  }));
  let sourceValueReads = 0;
  const wide = new Proxy(wideValues, {
    get(target, property, receiver) {
      if (typeof property === "string" && /^\d+$/.test(property))
        sourceValueReads++;
      return Reflect.get(target, property, receiver);
    },
  });
  const el = (await fixture(
    html`<lr-source-picker
      .strings=${{ valueInvalid: "Source tree limited" }}
    ></lr-source-picker>`
  )) as LyraSourcePicker;

  el.sources = [deep];
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="limit"]')!.textContent).to.equal(
    "Source tree limited"
  );

  el.sources = wide;
  await el.updateComplete;
  expect(el.shadowRoot!.querySelectorAll('[role="treeitem"]').length).to.equal(
    2_000
  );
  expect(
    el.shadowRoot!.querySelector('[part="summary"]')!.textContent
  ).to.include("2,000");
  expect(el.shadowRoot!.querySelector('[part="limit"]')!.textContent).to.equal(
    "Source tree limited"
  );
  expect(sourceValueReads).to.equal(0);
});

it("announces post-mount no-match transitions only through the light-DOM sink", async () => {
  const el = (await fixture(
    html`<lr-source-picker .sources=${sources}></lr-source-picker>`
  )) as LyraSourcePicker;
  const sink = document.querySelector<HTMLElement>(
    `[${ANNOUNCEMENT_SINK_ATTRIBUTE}="polite"]`
  )!;
  const before = sink.children.length;
  const search = el.shadowRoot!.querySelector('[part="search"]')!;

  search.dispatchEvent(
    new CustomEvent("lr-input", {
      detail: { value: "no-such-source" },
      bubbles: true,
      composed: true,
    })
  );
  await el.updateComplete;
  await waitUntil(() => sink.children.length > before);
  expect(sink.lastElementChild?.textContent).to.equal("No matches");
  expect(
    el.shadowRoot!.querySelector('[part="empty"]')!.getAttribute("role")
  ).to.equal(null);

  search.dispatchEvent(
    new CustomEvent("lr-input", {
      detail: { value: "" },
      bubbles: true,
      composed: true,
    })
  );
  await el.updateComplete;
  expect(sink.children.length).to.equal(before + 1);
  expect(
    el.shadowRoot!.querySelectorAll('[role="status"], [role="alert"]').length
  ).to.equal(0);
});

it('canonicalizes and prunes controlled source ids across replacement and emitted toggles', async () => {
  const el = (await fixture(
    html`<lr-source-picker
      .sources=${[
        { id: "a", label: "Alpha" },
        { id: "b", label: "Beta" },
      ]}
      .selectedSourceIds=${['a', 'a', 'ghost']}
    ></lr-source-picker>`
  )) as LyraSourcePicker;

  expect(el.selectedSourceIds).to.deep.equal(['a']);
  expect(
    el.shadowRoot!.querySelector('[part="summary"]')!.textContent
  ).to.include("1 of 2");

  const pending = oneEvent(el, "lr-sources-change");
  el.shadowRoot!.querySelectorAll<HTMLElement>('[role="treeitem"]')[1]!.click();
  expect((await pending).detail.selectedSourceIds).to.deep.equal(['a', 'b']);

  el.sources = [{ id: "b", label: "Beta" }];
  await el.updateComplete;
  expect(el.selectedSourceIds).to.deep.equal(['b']);
  expect(
    el.shadowRoot!.querySelector('[part="summary"]')!.textContent
  ).to.include("1 of 1");
});

describe("depth indent", () => {
  const deep: LyraSourceEntry[] = [
    {
      id: "l0",
      label: "Level 0",
      children: [
        {
          id: "l1",
          label: "Level 1",
          children: [{ id: "l2", label: "Level 2", mimeType: "text/plain" }],
        },
      ],
    },
  ];

  async function expandedDeepPicker(): Promise<LyraSourcePicker> {
    const el = (await fixture(
      html`<lr-source-picker></lr-source-picker>`
    )) as LyraSourcePicker;
    el.sources = deep;
    await el.updateComplete;
    // Filtering auto-expands every folder, which is the cheapest way to render all three levels
    // without driving two disclosure clicks.
    el.shadowRoot!.querySelector('[part="search"]')!.dispatchEvent(
      new CustomEvent("lr-input", {
        detail: { value: "Level" },
        bubbles: true,
        composed: true,
      })
    );
    await el.updateComplete;
    return el;
  }

  function rows(el: LyraSourcePicker): HTMLElement[] {
    return Array.from(
      el.shadowRoot!.querySelectorAll<HTMLElement>('[part="item"]')
    );
  }

  it("drives the per-level indent from a retheme-able token instead of a hardcoded literal", async () => {
    const el = await expandedDeepPicker();
    expect(rows(el).length).to.equal(3);
    const before = rows(el).map((row) =>
      Number.parseFloat(getComputedStyle(row).paddingInlineStart)
    );
    expect(
      before[1]! - before[0]!,
      "one indent step per level"
    ).to.be.greaterThan(0);
    expect(before[2]! - before[1]!, "and the step is uniform").to.be.closeTo(
      before[1]! - before[0]!,
      0.5
    );

    el.style.setProperty("--lr-source-picker-indent-size", "3rem");
    await el.updateComplete;
    const after = rows(el).map((row) =>
      Number.parseFloat(getComputedStyle(row).paddingInlineStart)
    );
    expect(
      after[1]! - after[0]!,
      "the override reaches the rendered indent"
    ).to.be.closeTo(48, 0.5);
    expect(after[2]! - after[1]!).to.be.closeTo(48, 0.5);
  });

  it("caps runaway nesting so a deep tree cannot push its labels out of view", async () => {
    const el = await expandedDeepPicker();
    // 8rem = 128px is the shared cap; a 20rem step would otherwise indent level 1 by 320px.
    el.style.setProperty("--lr-source-picker-indent-size", "20rem");
    await el.updateComplete;
    const padding = rows(el).map((row) =>
      Number.parseFloat(getComputedStyle(row).paddingInlineStart)
    );
    const base = padding[0]!;
    for (const value of padding) {
      expect(value - base, "no row indents past the cap").to.be.at.most(128.5);
    }
    expect(
      padding[1]! - base,
      "and the cap is what actually bit"
    ).to.be.closeTo(128, 0.5);
  });
});

it('returns focus to the search control when filtering removes every focused row', async () => {
  const el = await fixture<LyraSourcePicker>(html`
    <lr-source-picker .sources=${sources}></lr-source-picker>
  `);
  el.shadowRoot!.querySelector<HTMLElement>('[role="treeitem"]')!.focus();
  el.shadowRoot!.querySelector('lr-input')!.dispatchEvent(
    new CustomEvent('lr-input', {
      detail: { value: 'no matching source' },
      bubbles: true,
      composed: true,
    }),
  );
  await el.updateComplete;

  expect(el.shadowRoot!.querySelectorAll('[role="treeitem"]')).to.have.length(0);
  expect(el.shadowRoot!.activeElement?.getAttribute('part')).to.include('search');
});

it('collapses an expanded folder from its pointer disclosure without toggling selection', async () => {
  const el = await fixture<LyraSourcePicker>(html`
    <lr-source-picker .sources=${sources}></lr-source-picker>
  `);
  const disclosure = () =>
    el.shadowRoot!.querySelector<HTMLElement>('[role="treeitem"] [part="disclosure"]')!;
  disclosure().click();
  await el.updateComplete;
  expect(el.shadowRoot!.querySelectorAll('[role="treeitem"]')).to.have.length(4);

  disclosure().click();
  await el.updateComplete;
  expect(el.shadowRoot!.querySelectorAll('[role="treeitem"]')).to.have.length(2);
  expect(el.selectedSourceIds).to.deep.equal([]);
});
