import { fixture, expect, html, oneEvent, waitUntil } from "@open-wc/testing";
import "./document-library.js";
import type {
  LyraDocumentLibrary,
  LibraryDocument,
} from "./document-library.js";
import { ANNOUNCEMENT_SINK_ATTRIBUTE } from "../../../internal/announcer.js";

const docs: LibraryDocument[] = [
  {
    id: "d2",
    name: "Zeta Runbook.pdf",
    mimeType: "application/pdf",
    version: "v2",
    owner: "Priya",
    tags: ["ops", "runbook"],
    freshness: "stale",
    updatedAt: "2024-01-05T00:00:00.000Z",
  },
  {
    id: "d1",
    name: "Alpha Overview.docx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    version: "v10",
    owner: "Jordan",
    tags: ["onboarding"],
    freshness: "fresh",
    updatedAt: "2024-06-01T00:00:00.000Z",
  },
  {
    id: "d3",
    name: "Mid Spec.md",
    version: "v1",
    owner: "Alex",
    freshness: "aging",
    updatedAt: "2024-03-15T00:00:00.000Z",
  },
];

function sinkElement(doc: Document = document): HTMLElement | null {
  return doc.querySelector<HTMLElement>(
    `[${ANNOUNCEMENT_SINK_ATTRIBUTE}="polite"]`
  );
}

function sinkTexts(doc: Document = document): string[] {
  const sink = sinkElement(doc);
  return sink
    ? Array.from(sink.children, (child) => child.textContent ?? "")
    : [];
}

function findCheckbox(table: HTMLElement, rowIndex: number): HTMLElement {
  const rows = table.shadowRoot!.querySelectorAll("[data-row-key]");
  return rows[rowIndex]!.querySelector(
    "lr-checkbox"
  )!.shadowRoot!.querySelector('[part~="base"]') as HTMLElement;
}

it("renders every document as a grid row, sorted by name ascending by default (unsorted input)", async () => {
  const el = (await fixture(
    html`<lr-document-library .documents=${docs}></lr-document-library>`
  )) as LyraDocumentLibrary;
  const table = el.shadowRoot!.querySelector("lr-table") as HTMLElement;
  const names = [
    ...table.shadowRoot!.querySelectorAll('[part="document-name"]'),
  ].map((btn) => btn.textContent!.trim());
  // Input order is d2 (Zeta), d1 (Alpha), d3 (Mid) -- deliberately unsorted, so this only
  // passes if the component actually sorts rather than merely preserving input order.
  expect(names).to.deep.equal([
    "Alpha Overview.docx",
    "Mid Spec.md",
    "Zeta Runbook.pdf",
  ]);
});

it("keeps the first unique nonempty document id before filtering, selection, rows, counts, and open events", async () => {
  const first: LibraryDocument = { id: "shared", name: "First document", tags: ["first"] };
  const duplicate: LibraryDocument = { id: "shared", name: "Later duplicate", tags: ["duplicate"] };
  const el = (await fixture(
    html`<lr-document-library
      .documents=${[
        { id: "", name: "Blank document" },
        { id: "   ", name: "Whitespace document" },
        first,
        duplicate,
        { id: "other", name: "Other document" },
      ]}
      .selectedDocumentIds=${["", "   ", "shared", "missing"]}
    ></lr-document-library>`
  )) as LyraDocumentLibrary;

  expect(el.documents.map((document) => [document.id, document.name])).to.deep.equal([
    ["shared", "First document"],
    ["other", "Other document"],
  ]);
  expect(el.selectedDocumentIds).to.deep.equal(["shared"]);
  const table = el.shadowRoot!.querySelector("lr-table")!;
  await waitUntil(() => table.shadowRoot!.querySelectorAll('[part="row"]').length === 2);
  expect(table.shadowRoot!.textContent).to.contain("First document");
  expect(table.shadowRoot!.textContent).not.to.contain("Later duplicate");

  const input = el.shadowRoot!.querySelector("lr-input")!;
  const filterEvent = oneEvent(el, "lr-filter-change");
  input.dispatchEvent(new CustomEvent("lr-input", {
    detail: { value: "duplicate" },
    bubbles: true,
    composed: true,
  }));
  expect((await filterEvent as CustomEvent).detail.matchCount).to.equal(0);

  input.dispatchEvent(new CustomEvent("lr-input", {
    detail: { value: "" },
    bubbles: true,
    composed: true,
  }));
  await waitUntil(() => table.shadowRoot!.querySelectorAll('[part="document-name"]').length === 2);
  const openEvent = oneEvent(el, "lr-open");
  (table.shadowRoot!.querySelector('[part="document-name"]') as HTMLButtonElement).click();
  expect((await openEvent as CustomEvent).detail).to.deep.equal({ documentId: "shared" });
});

it("is accessible with no documents", async () => {
  const el = await fixture(html`<lr-document-library></lr-document-library>`);
  await expect(el).to.be.accessible();
});

it("is accessible with populated, tagged, selected, sorted rows", async () => {
  const el = (await fixture(
    html`<lr-document-library
      .documents=${docs}
      .selectedDocumentIds=${["d1"]}
    ></lr-document-library>`
  )) as LyraDocumentLibrary;
  await el.updateComplete;
  const table = el.shadowRoot!.querySelector("lr-table") as HTMLElement;
  expect(table.shadowRoot!.querySelectorAll("[data-row-key]")).to.have.length(
    3
  );
  expect(el.shadowRoot!.querySelector('[part="selection-bar"]')).to.exist;
  await expect(el).to.be.accessible();
});

it("announces post-mount selection counts as light-DOM additions while the visible bar stays non-live", async () => {
  const el = (await fixture(
    html`<lr-document-library
      .documents=${docs}
      .selectedDocumentIds=${["d1"]}
    ></lr-document-library>`
  )) as LyraDocumentLibrary;
  const bar = el.shadowRoot!.querySelector(
    '[part="selection-bar"]'
  ) as HTMLElement;
  expect(sinkTexts(), "preselection on mount must stay silent").to.deep.equal(
    []
  );
  expect(bar.getAttribute("role")).to.equal(null);
  expect(bar.getAttribute("aria-live")).to.equal(null);

  el.selectedDocumentIds = ["d2"];
  await el.updateComplete;
  el.selectedDocumentIds = ["d2"];
  await el.updateComplete;
  el.selectedDocumentIds = [];
  await el.updateComplete;
  expect(sinkTexts()).to.deep.equal(["1 selected", "1 selected", "0 selected"]);

  el.remove();
  expect(sinkElement() === null).to.be.true;
});

it("re-targets selection announcements after cross-document adoption", async () => {
  const el = (await fixture(
    html`<lr-document-library .documents=${docs}></lr-document-library>`
  )) as LyraDocumentLibrary;
  const iframe = document.createElement("iframe");
  document.body.append(iframe);
  const frameDocument = iframe.contentDocument!;
  try {
    frameDocument.body.append(el);
    el.selectedDocumentIds = ["d1"];
    await el.updateComplete;
    expect(
      sinkElement() === null,
      "the original document releases the adopted library"
    ).to.be.true;
    expect(sinkTexts(frameDocument)).to.deep.equal(["1 selected"]);
  } finally {
    el.remove();
    iframe.remove();
  }
});

it("filters by search text (name/owner/tag substring) and emits lr-filter-change with matchCount", async () => {
  const el = (await fixture(
    html`<lr-document-library .documents=${docs}></lr-document-library>`
  )) as LyraDocumentLibrary;
  const input = el.shadowRoot!.querySelector("lr-input")!;
  const listener = oneEvent(el, "lr-filter-change");
  (input as unknown as { value: string }).value = "priya";
  input.dispatchEvent(
    new CustomEvent("lr-input", {
      detail: { value: "priya" },
      bubbles: true,
      composed: true,
    })
  );
  const event = await listener;
  expect((event as CustomEvent).detail).to.deep.equal({
    searchTerm: "priya",
    tags: [],
    matchCount: 1,
  });
  const table = el.shadowRoot!.querySelector("lr-table") as HTMLElement;
  await waitUntil(
    () => table.shadowRoot!.querySelectorAll("[data-row-key]").length === 1
  );
});

it("translates child filter and selection events without leaking any native or prefixed aliases", async () => {
  const el = (await fixture(
    html`<lr-document-library .documents=${docs}></lr-document-library>`
  )) as LyraDocumentLibrary;
  const rawCounts = { input: 0, change: 0, lrInput: 0, lrChange: 0 };
  let filterCount = 0;
  let selectionCount = 0;
  el.addEventListener("input", () => rawCounts.input++);
  el.addEventListener("change", () => rawCounts.change++);
  el.addEventListener("lr-input", () => rawCounts.lrInput++);
  el.addEventListener("lr-change", () => rawCounts.lrChange++);
  el.addEventListener("lr-filter-change", () => filterCount++);
  el.addEventListener("lr-selection-change", () => selectionCount++);

  const input = el.shadowRoot!.querySelector("lr-input") as HTMLElement & {
    value: string;
  };
  input.value = "priya";
  input.dispatchEvent(new InputEvent("input", { bubbles: true, composed: true }));
  input.dispatchEvent(
    new CustomEvent("lr-input", {
      detail: { value: "priya" },
      bubbles: true,
      composed: true,
    })
  );
  input.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
  input.dispatchEvent(new CustomEvent("lr-change", { bubbles: true, composed: true }));
  await el.updateComplete;

  const combobox = el.shadowRoot!.querySelector(
    "lr-combobox"
  ) as HTMLElement & { value: string[] };
  combobox.value = ["ops"];
  combobox.dispatchEvent(new InputEvent("input", { bubbles: true, composed: true }));
  combobox.dispatchEvent(new CustomEvent("lr-input", { bubbles: true, composed: true }));
  combobox.dispatchEvent(
    new Event("change", { bubbles: true, composed: true })
  );
  combobox.dispatchEvent(new CustomEvent("lr-change", { bubbles: true, composed: true }));
  await el.updateComplete;

  const table = el.shadowRoot!.querySelector("lr-table") as HTMLElement;
  const checkbox = table.shadowRoot!.querySelector(
    "tbody lr-checkbox"
  ) as HTMLElement;
  checkbox.dispatchEvent(new InputEvent("input", { bubbles: true, composed: true }));
  checkbox.dispatchEvent(new CustomEvent("lr-input", { bubbles: true, composed: true }));
  checkbox.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
  checkbox.dispatchEvent(
    new CustomEvent("lr-change", {
      detail: { checked: true },
      bubbles: true,
      composed: true,
    })
  );
  await el.updateComplete;

  expect(filterCount).to.equal(2);
  expect(selectionCount).to.equal(1);
  expect(rawCounts).to.deep.equal({ input: 0, change: 0, lrInput: 0, lrChange: 0 });
});

it("filters by tag facet with AND semantics across multiple selected tags", async () => {
  const el = (await fixture(
    html`<lr-document-library
      .documents=${docs}
      .tagFilter=${["ops", "runbook"]}
    ></lr-document-library>`
  )) as LyraDocumentLibrary;
  await el.updateComplete;
  const table = el.shadowRoot!.querySelector("lr-table") as HTMLElement;
  const names = [
    ...table.shadowRoot!.querySelectorAll('[part="document-name"]'),
  ].map((btn) => btn.textContent!.trim());
  expect(names).to.deep.equal(["Zeta Runbook.pdf"]);
});

it("does not render the tag filter combobox when no document declares a tag", async () => {
  const untagged: LibraryDocument[] = [{ id: "x", name: "Plain.txt" }];
  const el = await fixture(
    html`<lr-document-library .documents=${untagged}></lr-document-library>`
  );
  expect((el.shadowRoot!.querySelector("lr-combobox")) == null).to.be.true;
});

it("prunes a self-managed tag filter when its tag disappears so results remain clearable", async () => {
  const el = (await fixture(
    html`<lr-document-library
      .documents=${docs}
      .tagFilter=${["ops"]}
    ></lr-document-library>`
  )) as LyraDocumentLibrary;
  await el.updateComplete;
  expect(el.tagFilter).to.deep.equal(["ops"]);

  el.documents = [{ id: "plain", name: "Plain.txt" }];
  await el.updateComplete;

  expect(el.tagFilter).to.deep.equal([]);
  const table = el.shadowRoot!.querySelector("lr-table") as HTMLElement;
  expect(table.shadowRoot!.querySelectorAll("[data-row-key]").length).to.equal(
    1
  );
});

it("toggles sort direction on a repeated header activation and re-sorts rows (unsorted input)", async () => {
  const el = (await fixture(
    html`<lr-document-library .documents=${docs}></lr-document-library>`
  )) as LyraDocumentLibrary;
  const table = el.shadowRoot!.querySelector("lr-table") as HTMLElement;
  const nameHeader = table.shadowRoot!.querySelector(
    '[data-col-key="name"]'
  ) as HTMLElement;

  const sortListener = oneEvent(el, "lr-sort");
  nameHeader.click();
  const sortEvent = await sortListener;
  expect((sortEvent as CustomEvent).detail).to.deep.equal({
    phase: "commit",
    sortKey: "name",
    sortDir: "desc",
  });
  await el.updateComplete;
  let names = [
    ...table.shadowRoot!.querySelectorAll('[part="document-name"]'),
  ].map((btn) => btn.textContent!.trim());
  expect(names).to.deep.equal([
    "Zeta Runbook.pdf",
    "Mid Spec.md",
    "Alpha Overview.docx",
  ]);

  const secondListener = oneEvent(el, "lr-sort");
  nameHeader.click();
  const secondEvent = await secondListener;
  expect((secondEvent as CustomEvent).detail).to.deep.equal({
    phase: "commit",
    sortKey: "name",
    sortDir: "asc",
  });
  await el.updateComplete;
  names = [...table.shadowRoot!.querySelectorAll('[part="document-name"]')].map(
    (btn) => btn.textContent!.trim()
  );
  expect(names).to.deep.equal([
    "Alpha Overview.docx",
    "Mid Spec.md",
    "Zeta Runbook.pdf",
  ]);
});

it("emits one host lr-sort event for one bubbling table lr-sort event", async () => {
  const el = (await fixture(
    html`<lr-document-library .documents=${docs}></lr-document-library>`
  )) as LyraDocumentLibrary;
  const table = el.shadowRoot!.querySelector("lr-table") as HTMLElement;
  let count = 0;
  el.addEventListener("lr-sort", () => count++);

  table.dispatchEvent(
    new CustomEvent("lr-sort", {
      detail: { phase: "commit", sortKey: "name", sortDir: "desc" },
      bubbles: true,
      composed: true,
    })
  );
  await el.updateComplete;

  expect(count).to.equal(1);
});

it("does not leak the composed lr-table lr-row-click event past the host under its own name", async () => {
  const el = (await fixture(
    html`<lr-document-library .documents=${docs}></lr-document-library>`
  )) as LyraDocumentLibrary;
  const table = el.shadowRoot!.querySelector("lr-table") as HTMLElement;
  let count = 0;
  el.addEventListener("lr-row-click", () => count++);

  table.dispatchEvent(
    new CustomEvent("lr-row-click", {
      detail: { row: docs[0] },
      bubbles: true,
      composed: true,
    })
  );
  await el.updateComplete;

  expect(count).to.equal(0);
});

it("sorts numerically-aware by version (v2 before v10)", async () => {
  const el = (await fixture(
    html`<lr-document-library
      .documents=${docs}
      sort-key="version"
    ></lr-document-library>`
  )) as LyraDocumentLibrary;
  await el.updateComplete;
  const table = el.shadowRoot!.querySelector("lr-table") as HTMLElement;
  const names = [
    ...table.shadowRoot!.querySelectorAll('[part="document-name"]'),
  ].map((btn) => btn.textContent!.trim());
  expect(names).to.deep.equal([
    "Mid Spec.md",
    "Zeta Runbook.pdf",
    "Alpha Overview.docx",
  ]);
});

it("toggles a row selection via its checkbox and emits lr-selection-change", async () => {
  const el = (await fixture(
    html`<lr-document-library .documents=${docs}></lr-document-library>`
  )) as LyraDocumentLibrary;
  const table = el.shadowRoot!.querySelector("lr-table") as HTMLElement;
  const listener = oneEvent(el, "lr-selection-change");
  findCheckbox(table, 0).click(); // sorted order: row 0 is Alpha (d1)
  const event = await listener;
  expect((event as CustomEvent).detail).to.deep.equal({ documentIds: ["d1"] });
  expect(el.selectedDocumentIds).to.deep.equal(["d1"]);
});

it("select-all header checkbox selects/deselects every currently visible row and reflects indeterminate state", async () => {
  const el = (await fixture(
    html`<lr-document-library .documents=${docs}></lr-document-library>`
  )) as LyraDocumentLibrary;
  const table = el.shadowRoot!.querySelector("lr-table") as HTMLElement;
  const headerCheckboxBase = () =>
    (
      table.shadowRoot!.querySelector("thead lr-checkbox") as HTMLElement
    ).shadowRoot!.querySelector('[part~="base"]') as HTMLElement;

  const listener = oneEvent(el, "lr-selection-change");
  headerCheckboxBase().click();
  const event = await listener;
  expect((event as CustomEvent).detail.documentIds).to.have.members(["d1", "d2", "d3"]);
  // The checkbox `.checked` property is set synchronously as part of this update, but reflecting
  // it into `aria-checked` requires `<lr-checkbox>`'s own nested update cycle to also complete --
  // a second, independent async cycle `el.updateComplete` (the outer element's own) does not wait
  // on. Poll instead of assuming one `await el.updateComplete` drains every nested level.
  await waitUntil(
    () => headerCheckboxBase().getAttribute("aria-checked") === "true"
  );

  // Deselect one row -- the header checkbox should now read indeterminate, not checked.
  const secondListener = oneEvent(el, "lr-selection-change");
  findCheckbox(table, 0).click(); // sorted order: row 0 is Alpha (d1)
  const secondEvent = await secondListener;
  expect((secondEvent as CustomEvent).detail.documentIds).to.have.members(["d2", "d3"]);
  await waitUntil(
    () => headerCheckboxBase().getAttribute("aria-checked") === "mixed"
  );
});

it('"Clear selection" empties selectedDocumentIds and emits lr-selection-change with an empty array', async () => {
  const el = (await fixture(
    html`<lr-document-library
      .documents=${docs}
      .selectedDocumentIds=${["d1", "d2"]}
    ></lr-document-library>`
  )) as LyraDocumentLibrary;
  await el.updateComplete;
  const clearButton = el.shadowRoot!.querySelector(
    '[part="clear-selection"]'
  ) as HTMLElement;
  const listener = oneEvent(el, "lr-selection-change");
  clearButton.click();
  const event = await listener;
  expect((event as CustomEvent).detail).to.deep.equal({ documentIds: [] });
  expect(el.selectedDocumentIds).to.deep.equal([]);
  await el.updateComplete;
  expect((el.shadowRoot!.querySelector('[part="selection-bar"]')) == null).to.be.true;
});

it("prunes a selected id that no longer exists in documents, without firing lr-selection-change", async () => {
  const el = (await fixture(
    html`<lr-document-library
      .documents=${docs}
      .selectedDocumentIds=${["d1", "ghost-id"]}
    ></lr-document-library>`
  )) as LyraDocumentLibrary;
  await el.updateComplete;
  expect(el.selectedDocumentIds).to.deep.equal(["d1"]);

  let fired = false;
  el.addEventListener("lr-selection-change", () => {
    fired = true;
  });
  el.documents = docs.filter((d) => d.id !== "d1");
  await el.updateComplete;
  expect(el.selectedDocumentIds).to.deep.equal([]);
  expect(fired).to.be.false;
});

it("normalizes stale and duplicate selectedDocumentIds assigned after mount", async () => {
  const el = (await fixture(
    html`<lr-document-library .documents=${docs}></lr-document-library>`
  )) as LyraDocumentLibrary;
  el.selectedDocumentIds = ["ghost-id", "d1", "d1"];
  await el.updateComplete;
  expect(el.selectedDocumentIds).to.deep.equal(["d1"]);
  expect(
    el
      .shadowRoot!.querySelector('[part="selection-count"]')!
      .textContent!.trim()
  ).to.equal("1 selected");
});

it("formats the selected count with the effective locale", async function () {
  // Rendering 1000 rows is inherently more expensive than the framework's default budget assumes,
  // especially on non-Chromium engines and under CI/full-suite contention -- give this one test a
  // margined threshold instead of the shared 6000ms default (see web-test-runner.config.js).
  this.timeout(20_000);
  const many = Array.from({ length: 1000 }, (_, index) => ({
    id: `d${index}`,
    name: `Document ${index}`,
  }));
  const el = (await fixture(
    html`<lr-document-library
      locale="de-DE"
      .documents=${many}
      .selectedDocumentIds=${many.map((document) => document.id)}
    ></lr-document-library>`
  )) as LyraDocumentLibrary;
  await el.updateComplete;
  expect(
    el
      .shadowRoot!.querySelector('[part="selection-count"]')!
      .textContent!.trim()
  ).to.equal("1.000 selected");
});

it("opens a document via its name button, firing lr-open with the document id", async () => {
  const el = (await fixture(
    html`<lr-document-library .documents=${docs}></lr-document-library>`
  )) as LyraDocumentLibrary;
  const table = el.shadowRoot!.querySelector("lr-table") as HTMLElement;
  const nameButton = table.shadowRoot!.querySelectorAll(
    '[part="document-name"]'
  )[0] as HTMLElement; // Alpha (d1)
  const listener = oneEvent(el, "lr-open");
  nameButton.click();
  const event = await listener;
  expect((event as CustomEvent).detail).to.deep.equal({ documentId: "d1" });
});

it("opens a document by activating its row elsewhere (non-interactive area), via lr-table lr-row-click", async () => {
  const el = (await fixture(
    html`<lr-document-library .documents=${docs}></lr-document-library>`
  )) as LyraDocumentLibrary;
  const table = el.shadowRoot!.querySelector("lr-table") as HTMLElement;
  const row = table.shadowRoot!.querySelectorAll(
    "[data-row-key]"
  )[0] as HTMLElement; // Alpha (d1)
  const listener = oneEvent(el, "lr-open");
  row.click();
  const event = await listener;
  expect((event as CustomEvent).detail).to.deep.equal({ documentId: "d1" });
});

it("renders the built-in English fallback with no locale/strings registered", async () => {
  const el = await fixture(html`<lr-document-library></lr-document-library>`);
  const input = el.shadowRoot!.querySelector("lr-input")!;
  expect(input.getAttribute("placeholder")).to.equal("Search documents");
});

it("reaches the DOM with a .strings override for the region label and search placeholder", async () => {
  const el = (await fixture(
    html`<lr-document-library
      .strings=${{
        documentLibraryLabel: "Bibliothèque de documents",
        documentLibrarySearchPlaceholder: "Rechercher",
      }}
    ></lr-document-library>`
  )) as LyraDocumentLibrary;
  expect(
    el.shadowRoot!.querySelector('[part="base"]')!.getAttribute("aria-label")
  ).to.equal("Bibliothèque de documents");
  expect(
    el.shadowRoot!.querySelector("lr-input")!.getAttribute("placeholder")
  ).to.equal("Rechercher");
});

it("treats an explicitly empty label as a real override, distinct from an omitted one", async () => {
  const explicit = (await fixture(
    html`<lr-document-library label="" .documents=${docs}></lr-document-library>`
  )) as LyraDocumentLibrary;
  await explicit.updateComplete;
  expect(
    explicit.shadowRoot!.querySelector('[part="base"]')!.getAttribute("aria-label")
  ).to.equal("");

  const omitted = (await fixture(
    html`<lr-document-library .documents=${docs}></lr-document-library>`
  )) as LyraDocumentLibrary;
  await omitted.updateComplete;
  expect(
    omitted.shadowRoot!.querySelector('[part="base"]')!.getAttribute("aria-label")
  ).to.equal("Document library");
});

it("lets a host aria-label override label on the region and table, including late changes", async () => {
  const el = (await fixture(
    html`<lr-document-library
      label="Library"
      aria-label="Deployment documents"
      .documents=${docs}
    ></lr-document-library>`
  )) as LyraDocumentLibrary;
  await el.updateComplete;
  const base = el.shadowRoot!.querySelector('[part="base"]')!;
  const table = el.shadowRoot!.querySelector("lr-table")!;
  expect(base.getAttribute("aria-label")).to.equal("Deployment documents");
  expect(table.getAttribute("aria-label")).to.equal("Deployment documents");

  el.setAttribute("aria-label", "Runtime documents");
  await el.updateComplete;
  expect(base.getAttribute("aria-label")).to.equal("Runtime documents");
  expect(table.getAttribute("aria-label")).to.equal("Runtime documents");

  el.removeAttribute("aria-label");
  await el.updateComplete;
  expect(base.getAttribute("aria-label")).to.equal("Library");
  expect(table.getAttribute("aria-label")).to.equal("Library");
});

it('renders under dir="rtl" and keeps document-open interaction working', async () => {
  const el = (await fixture(
    html`<lr-document-library
      dir="rtl"
      .documents=${docs}
    ></lr-document-library>`
  )) as LyraDocumentLibrary;
  await el.updateComplete;
  const table = el.shadowRoot!.querySelector("lr-table") as HTMLElement;
  const nameButton = table.shadowRoot!.querySelectorAll(
    '[part="document-name"]'
  )[0] as HTMLElement;
  const listener = oneEvent(el, "lr-open");
  nameButton.click();
  const event = await listener;
  expect((event as CustomEvent).detail).to.deep.equal({ documentId: "d1" });
});

it("scrolls a 320px allocation horizontally rather than overflowing, hiding low-priority columns", async () => {
  const container = document.createElement("div");
  container.style.inlineSize = "320px";
  const el = (await fixture(
    html`<lr-document-library
      style="display:block"
      .documents=${docs}
    ></lr-document-library>`,
    { parentNode: container }
  )) as LyraDocumentLibrary;
  await el.updateComplete;
  expect((el as HTMLElement).getBoundingClientRect().width).to.be.at.most(320);

  const table = el.shadowRoot!.querySelector("lr-table") as HTMLElement;
  await waitUntil(() => {
    const tagsHeader = table.shadowRoot!.querySelector(
      '[part="header-cell"][data-col-key="tags"]'
    );
    return (
      tagsHeader !== null && getComputedStyle(tagsHeader).display === "none"
    );
  });
  const nameHeader = table.shadowRoot!.querySelector(
    '[part="header-cell"][data-col-key="name"]'
  ) as HTMLElement;
  expect(getComputedStyle(nameHeader).display).to.not.equal("none");
});

it("sorts the Updated column chronologically, not alphabetically by its formatted date", async () => {
  // This component already orders `visibleDocuments` itself, comparing real timestamps. It then
  // handed `<lr-table>` both those ordered rows *and* a `sortKey`, without `sortMode="server"` --
  // so the table re-sorted them in client mode. With no `sortValue` on the column, client mode
  // falls back to `String(cell(row))`, and this column's `cell()` returns a *formatted* date, so
  // the order became alphabetical by month name and overrode the correct chronological one.
  const dated = [
    { id: "a", name: "Ancient.md", updatedAt: "2019-03-02T00:00:00Z" },
    { id: "b", name: "Recent.md", updatedAt: "2026-01-05T00:00:00Z" },
    { id: "c", name: "Middle.md", updatedAt: "2020-02-03T00:00:00Z" },
  ];
  const el = (await fixture(
    html`<lr-document-library
      .documents=${dated}
      sort-key="updatedAt"
      sort-dir="asc"
    ></lr-document-library>`
  )) as LyraDocumentLibrary;
  await el.updateComplete;

  const table = el.shadowRoot!.querySelector("lr-table") as HTMLElement;
  const names = [
    ...table.shadowRoot!.querySelectorAll('[part="document-name"]'),
  ].map((btn) => btn.textContent!.trim());
  // Chronological. The alphabetical-by-formatted-date order would be
  // "Feb 3, 2020" < "Jan 5, 2026" < "Mar 2, 2019" -- i.e. Middle, Recent, Ancient.
  expect(names).to.deep.equal(["Ancient.md", "Middle.md", "Recent.md"]);
});

describe("v9 controlled and immutable contracts", () => {
  it("snapshots readonly collection inputs at assignment time", async () => {
    const inputDate = new Date("2026-01-02T00:00:00.000Z");
    const inputDocuments: LibraryDocument[] = [
      { id: "owned", name: "Owned.md", tags: ["stable"], updatedAt: inputDate },
    ];
    const inputSelected = ["owned"];
    const inputTags = ["stable"];
    const el = (await fixture(
      html`<lr-document-library></lr-document-library>`
    )) as LyraDocumentLibrary;
    el.documents = inputDocuments;
    el.selectedDocumentIds = inputSelected;
    el.tagFilter = inputTags;

    inputDocuments[0]!.name = "Mutated.md";
    inputDocuments[0]!.tags!.push("mutated");
    inputDocuments.length = 0;
    inputDate.setUTCFullYear(2030);
    inputSelected.length = 0;
    inputTags.length = 0;
    await el.updateComplete;

    expect(el.documents).to.have.lengthOf(1);
    expect(el.documents[0]!.name).to.equal("Owned.md");
    expect(el.documents[0]!.tags).to.deep.equal(["stable"]);
    expect((el.documents[0]!.updatedAt as Date).toISOString()).to.equal("2026-01-02T00:00:00.000Z");
    expect(el.selectedDocumentIds).to.deep.equal(["owned"]);
    expect(el.tagFilter).to.deep.equal(["stable"]);
    expect(Object.isFrozen(el.documents)).to.equal(true);
    expect(Object.isFrozen(el.documents[0])).to.equal(true);
    expect(Object.isFrozen(el.documents[0]!.tags)).to.equal(true);
    expect(Object.isFrozen(el.selectedDocumentIds)).to.equal(true);
    expect(Object.isFrozen(el.tagFilter)).to.equal(true);

    const publicDate = el.documents[0]!.updatedAt as Date;
    publicDate.setUTCFullYear(2040);
    expect((el.documents[0]!.updatedAt as Date).toISOString()).to.equal("2026-01-02T00:00:00.000Z");
  });

  it("exposes controlled searchTerm and emits an isolated readonly filter snapshot", async () => {
    const el = (await fixture(
      html`<lr-document-library .documents=${docs}></lr-document-library>`
    )) as LyraDocumentLibrary;
    (el as unknown as { searchTerm: string }).searchTerm = "alpha";
    await el.updateComplete;

    const table = el.shadowRoot!.querySelector("lr-table") as HTMLElement;
    expect(table.shadowRoot!.querySelectorAll('[part="row"]').length).to.equal(1);

    let detail: Record<string, unknown> | undefined;
    el.addEventListener("lr-filter-change", (event) => {
      detail = (event as CustomEvent).detail;
    });
    const search = el.shadowRoot!.querySelector("lr-input")! as unknown as HTMLElement & { value: string };
    search.value = "zeta";
    search.dispatchEvent(
      new CustomEvent("lr-input", { detail: { value: "zeta" }, bubbles: true, composed: true })
    );

    expect(detail).to.deep.equal({ searchTerm: "zeta", tags: [], matchCount: 1 });
    expect(Object.isFrozen(detail)).to.equal(true);
    expect(Object.isFrozen(detail?.["tags"])).to.equal(true);
  });

  it("publishes fresh frozen selection snapshots that cannot mutate component state or prior events", async () => {
    const el = (await fixture(
      html`<lr-document-library .documents=${docs}></lr-document-library>`
    )) as LyraDocumentLibrary;
    const details: Array<{ documentIds: readonly string[] }> = [];
    el.addEventListener("lr-selection-change", (event) => details.push(event.detail));
    const table = el.shadowRoot!.querySelector("lr-table") as HTMLElement;

    findCheckbox(table, 0).click();
    await el.updateComplete;
    findCheckbox(table, 1).click();
    await el.updateComplete;

    expect(details.length).to.equal(2);
    expect(Object.isFrozen(details[0])).to.equal(true);
    expect(Object.isFrozen(details[0]!.documentIds)).to.equal(true);
    expect(details[0]!.documentIds).to.deep.equal(["d1"]);
    expect(details[1]!.documentIds).to.deep.equal(["d1", "d3"]);
    expect(details[0]!.documentIds === details[1]!.documentIds).to.equal(false);
    expect([...el.selectedDocumentIds]).to.deep.equal(["d1", "d3"]);
  });

  it("puts the composed table in multiple selection mode so selected ids reach row semantics", async () => {
    const el = (await fixture(
      html`<lr-document-library .documents=${docs} .selectedDocumentIds=${["d1"]}></lr-document-library>`
    )) as LyraDocumentLibrary;
    const table = el.shadowRoot!.querySelector("lr-table") as HTMLElement & { selectionMode: string };
    expect(table.selectionMode).to.equal("multiple");
    const selectedRows = table.shadowRoot!.querySelectorAll('[part="row"][aria-selected="true"]');
    expect(selectedRows.length).to.equal(1);
  });

  it("contains the table selection event and keeps row activation from changing checkbox-owned selection", async () => {
    const el = (await fixture(
      html`<lr-document-library .documents=${docs} .selectedDocumentIds=${["d1"]}></lr-document-library>`
    )) as LyraDocumentLibrary;
    const table = el.shadowRoot!.querySelector("lr-table") as HTMLElement & {
      selectedRowKeys: ReadonlySet<string | number>;
      updateComplete: Promise<unknown>;
    };
    let leakedTableSelections = 0;
    el.addEventListener("lr-selection-change", (event) => {
      if (event.composedPath()[0] === table) leakedTableSelections++;
    });

    const secondRow = table.shadowRoot!.querySelectorAll<HTMLElement>('[part="row"]')[1]!;
    secondRow.click();
    await table.updateComplete;

    expect(leakedTableSelections).to.equal(0);
    expect(el.selectedDocumentIds).to.deep.equal(["d1"]);
    expect([...table.selectedRowKeys]).to.deep.equal(['d1']);
  });

  it("translates canonical sort request/commit phases and honors a wrapper veto", async () => {
    const el = (await fixture(
      html`<lr-document-library .documents=${docs}></lr-document-library>`
    )) as LyraDocumentLibrary;
    const table = el.shadowRoot!.querySelector("lr-table") as HTMLElement;
    const headers = table.shadowRoot!.querySelectorAll('[part="header-cell"]');
    const details: Array<Record<string, unknown>> = [];
    el.addEventListener("lr-sort-request", (event) => details.push((event as CustomEvent).detail));
    el.addEventListener("lr-sort", (event) => details.push((event as CustomEvent).detail));
    (headers[3] as HTMLElement).click();

    expect(details).to.deep.equal([
      { phase: "request", sortKey: "version", sortDir: "asc" },
      { phase: "commit", sortKey: "version", sortDir: "asc" },
    ]);
    expect((el as unknown as { sortDir: string }).sortDir).to.equal("asc");

    el.addEventListener("lr-sort-request", (event) => event.preventDefault(), { once: true });
    (headers[4] as HTMLElement).click();
    expect((el as unknown as { sortKey: string }).sortKey).to.equal("version");
  });

  it("contains the composed table pagination event and inherits the bounded default projection", async () => {
    const many = Array.from({ length: 130 }, (_, index) => ({
      id: `d-${index}`,
      name: `Document ${String(index).padStart(3, "0")}`,
    }));
    const el = (await fixture(
      html`<lr-document-library .documents=${many}></lr-document-library>`
    )) as LyraDocumentLibrary;
    const table = el.shadowRoot!.querySelector("lr-table") as HTMLElement;
    expect(table.shadowRoot!.querySelectorAll('[part="row"]').length).to.equal(100);
    expect(table.shadowRoot!.querySelectorAll("lr-pagination").length).to.equal(1);

    let leaked = 0;
    el.addEventListener("lr-page-change", () => leaked++);
    table.dispatchEvent(
      new CustomEvent("lr-page-change", { detail: { page: 2 }, bubbles: true, composed: true })
    );
    expect(leaked).to.equal(0);
  });
});
