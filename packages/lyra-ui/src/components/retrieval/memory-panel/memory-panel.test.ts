import { fixture, expect, html, oneEvent } from "@open-wc/testing";
import "./memory-panel.js";
import type { LyraMemoryPanel, LyraMemoryItem } from "./memory-panel.js";
import { styles } from "./memory-panel.styles.js";
import {
  composedContains,
  deepActiveElement,
} from "../../../internal/overlay-manager.js";

/** Lets every queued `updateComplete.then()` focus hop settle before focus is asserted. */
async function settleFocus(el: LyraMemoryPanel): Promise<void> {
  await el.updateComplete;
  await new Promise((resolve) => requestAnimationFrame(resolve));
  await new Promise((resolve) => requestAnimationFrame(resolve));
}

/**
 * A dynamically-inserted `<lr-confirm-bar>` is created as part of `lr-memory-panel`'s own render
 * commit -- awaiting only the parent's `updateComplete` does not guarantee the freshly-connected
 * child (and in turn its own `<lr-button>` children) has completed *its* first Lit update cycle.
 * With the old hand-rolled native `<button>`s this never mattered (a native button needs no
 * upgrade/render cycle to be clickable); `<lr-button>` does. Every test that reaches into a
 * confirm-bar's shadow root right after it appears awaits this first.
 */
async function readyConfirmBar(el: Element): Promise<HTMLElement> {
  const confirmBar = el.querySelector("lr-confirm-bar") as HTMLElement & {
    updateComplete: Promise<unknown>;
  };
  await confirmBar.updateComplete;
  return confirmBar;
}

const shortTermItems: LyraMemoryItem[] = [
  {
    id: "s1",
    text: "User is debugging a TypeScript build error.",
    confidence: 0.9,
  },
  { id: "s2", text: "User prefers concise answers." },
];

const longTermItems: LyraMemoryItem[] = [
  {
    id: "l1",
    text: "User's name is Alex and they work at Acme Corp.",
    confidence: 0.4,
    provenance: { entities: [{ id: "e1", label: "Alex", type: "person" }] },
  },
  { id: "l2", text: "User is allergic to peanuts.", confidence: 0.85 },
];

async function populated(): Promise<LyraMemoryPanel> {
  const el = (await fixture(
    html`<lr-memory-panel></lr-memory-panel>`
  )) as LyraMemoryPanel;
  el.shortTerm = shortTermItems;
  el.longTerm = longTermItems;
  await el.updateComplete;
  return el;
}

describe("lr-memory-panel", () => {
  it("renders lr-empty and no sections when both shortTerm and longTerm are empty", async () => {
    const el = (await fixture(
      html`<lr-memory-panel></lr-memory-panel>`
    )) as LyraMemoryPanel;
    expect(el.shortTerm).to.deep.equal([]);
    expect(el.longTerm).to.deep.equal([]);
    expect(el.shadowRoot!.querySelector("lr-empty")).to.exist;
    expect(el.shadowRoot!.querySelector('[part="section"]') == null).to.be.true;
    const shell = el.shadowRoot!.querySelector('[part="base"]')!;
    expect(shell.getAttribute("role")).to.equal("group");
    expect(shell.getAttribute("aria-label")).to.equal("Memory");
    expect(el.label).to.be.undefined;
  });

  it("keeps an explicitly empty label distinct from an omitted one", async () => {
    const el = (await fixture(
      html`<lr-memory-panel label=""></lr-memory-panel>`
    )) as LyraMemoryPanel;
    expect(el.label).to.equal("");
    const shell = el.shadowRoot!.querySelector('[part="base"]')!;
    expect(shell.getAttribute("aria-label")).to.equal("");
  });

  it('renders one section per non-empty list with localized headings and role="list" wrappers', async () => {
    const el = await populated();
    const sections = el.shadowRoot!.querySelectorAll('[part="section"]');
    expect(sections.length).to.equal(2);
    const headings = [
      ...el.shadowRoot!.querySelectorAll('[part="heading"]'),
    ].map((h) => h.textContent);
    expect(headings).to.include("Short-term context");
    expect(headings).to.include("Long-term memories");
    const lists = el.shadowRoot!.querySelectorAll('[part="list"]');
    expect(lists.length).to.equal(2);
    for (const list of lists)
      expect(list.getAttribute("role")).to.equal("list");
    expect(el.shadowRoot!.querySelectorAll('[part="item"]').length).to.equal(4);
  });

  it("keeps exactly one stable owner across explicit-empty and dynamic host naming", async () => {
    const el = (await fixture(
      html`<lr-memory-panel
        label="Remembered context"
        aria-label=""
      ></lr-memory-panel>`
    )) as LyraMemoryPanel;
    el.shortTerm = shortTermItems;
    await el.updateComplete;
    const group = () =>
      el.shadowRoot!.querySelector<HTMLElement>('[part="base"]')!;

    expect(group().getAttribute("role")).to.equal("group");
    expect(el.hasAttribute("aria-label")).to.equal(true);
    expect(el.getAttribute("aria-label")).to.equal("");
    expect(group().getAttribute("aria-label")).to.equal("");

    el.shortTerm = [];
    await el.updateComplete;
    expect(group().getAttribute("role")).to.equal("group");
    expect(group().getAttribute("aria-label")).to.equal("");

    el.setAttribute("aria-label", "Author memories");
    await el.updateComplete;
    expect(el.getAttribute("aria-label")).to.equal("Author memories");
    expect(group().getAttribute("aria-label")).to.equal(null);
    expect(group().getAttribute("role")).to.equal(null);

    el.removeAttribute("aria-label");
    await el.updateComplete;
    expect(el.getAttribute("aria-label")).to.equal(null);
    expect(group().getAttribute("aria-label")).to.equal("Remembered context");
    expect(group().getAttribute("role")).to.equal("group");
  });

  it('shows a localized "no items" message for an empty section while the other section has items', async () => {
    const el = (await fixture(
      html`<lr-memory-panel></lr-memory-panel>`
    )) as LyraMemoryPanel;
    el.shortTerm = shortTermItems;
    await el.updateComplete;
    const emptySection = [
      ...el.shadowRoot!.querySelectorAll('[part="section"]'),
    ].find((s) => s.getAttribute("data-scope") === "long-term")!;
    expect(
      emptySection.querySelector('[part="section-empty"]')!.textContent
    ).to.equal("No data");
    expect(emptySection.querySelector('[part="list"]') == null).to.be.true;
  });

  it("renders a visible, tone-mapped confidence tier label (never color alone) reusing the citation confidence vocabulary", async () => {
    const el = await populated();
    const rows = [...el.shadowRoot!.querySelectorAll('[part="item"]')];
    const high = rows.find((r) => r.getAttribute("data-id") === "s1")!; // 0.9
    const medium = rows.find((r) => r.getAttribute("data-id") === "l1")!; // 0.4
    const highConfidence = high.querySelector('[part="confidence"]')!;
    expect(highConfidence.textContent).to.equal("High confidence");
    expect(highConfidence.getAttribute("data-tone")).to.equal("success");
    const mediumConfidence = medium.querySelector('[part="confidence"]')!;
    expect(mediumConfidence.textContent).to.equal("Low confidence");
    expect(mediumConfidence.getAttribute("data-tone")).to.equal("danger");
  });

  it("respects a custom thresholds prop when computing the confidence tier", async () => {
    const el = await populated();
    el.thresholds = { high: 0.95, medium: 0.1 };
    await el.updateComplete;
    const row = el.shadowRoot!.querySelector('[part="item"][data-id="s1"]')!; // 0.9, below the new high bar
    expect(row.querySelector('[part="confidence"]')!.textContent).to.equal(
      "Medium confidence"
    );
  });

  it("omits the confidence part entirely when an item has no confidence", async () => {
    const el = await populated();
    const row = el.shadowRoot!.querySelector('[part="item"][data-id="s2"]')!;
    expect(row.querySelector('[part="confidence"]') == null).to.be.true;
  });

  it("only renders the provenance expand-toggle (and disclosure body) when an item defines provenance, collapsed by default", async () => {
    const el = await populated();
    const withProvenance = el.shadowRoot!.querySelector(
      '[part="item"][data-id="l1"]'
    )!;
    const withoutProvenance = el.shadowRoot!.querySelector(
      '[part="item"][data-id="l2"]'
    )!;
    expect(
      withoutProvenance.querySelector('[part="expand-toggle"]') === null
    ).to.equal(true);
    expect(
      withoutProvenance.querySelector('[part="item-body"]') === null
    ).to.equal(true);

    const toggle = withProvenance.querySelector(
      '[part="expand-toggle"]'
    ) as HTMLButtonElement;
    const body = withProvenance.querySelector(
      '[part="item-body"]'
    ) as HTMLElement;
    expect(toggle == null).to.equal(false);
    expect(toggle.getAttribute("aria-expanded")).to.equal("false");
    // The body -- and its lr-provenance-panel -- stay mounted while collapsed (hidden via the
    // `hidden` attribute, not removed from the DOM), the same always-present-but-hidden pattern
    // lr-confirm-bar's own [part="status"] uses.
    expect(body == null).to.equal(false);
    expect(body.hasAttribute("hidden")).to.equal(true);
  });

  it("toggling the expand-toggle emits lr-expand, unhides the body, and reveals a populated lr-provenance-panel", async () => {
    const el = await populated();
    const withProvenance = el.shadowRoot!.querySelector(
      '[part="item"][data-id="l1"]'
    )!;
    const toggle = withProvenance.querySelector(
      '[part="expand-toggle"]'
    ) as HTMLButtonElement;

    const listener = oneEvent(el, "lr-expand");
    toggle.click();
    const event = await listener;
    expect(event.detail.memoryId).to.equal('l1');
    expect(event.detail.scope).to.equal('long-term');
    expect(event.detail.expanded).to.equal(true);
    await el.updateComplete;
    expect(toggle.getAttribute("aria-expanded")).to.equal("true");
    const body = withProvenance.querySelector(
      '[part="item-body"]'
    ) as HTMLElement;
    expect(body.hasAttribute("hidden")).to.equal(false);
    const panel = withProvenance.querySelector(
      "lr-provenance-panel"
    ) as HTMLElement & { provenance: unknown };
    const receivedEntities =
      (panel.provenance as { entities?: { id: string }[] })?.entities ?? [];
    expect(receivedEntities.length).to.equal(1);
    expect(receivedEntities[0]!.id).to.equal("e1");
  });

  it("toggling the expand-toggle a second time collapses it back and emits expanded: false", async () => {
    const el = await populated();
    const toggle = el.shadowRoot!.querySelector(
      '[part="item"][data-id="l1"] [part="expand-toggle"]'
    ) as HTMLButtonElement;
    toggle.click();
    await el.updateComplete;
    expect(toggle.getAttribute("aria-expanded")).to.equal("true");

    const listener = oneEvent(el, "lr-expand");
    toggle.click();
    const event = await listener;
    expect(event.detail).to.deep.equal({
      memoryId: 'l1',
      scope: 'long-term',
      expanded: false,
    });
    await el.updateComplete;
    expect(toggle.getAttribute("aria-expanded")).to.equal("false");
    const body = el.shadowRoot!.querySelector(
      '[part="item"][data-id="l1"] [part="item-body"]'
    ) as HTMLElement;
    expect(body.hasAttribute("hidden")).to.equal(true);
  });

  it("forwards types and thresholds through to the nested lr-provenance-panel", async () => {
    const el = await populated();
    el.types = [{ id: "person", label: "Person" }];
    el.thresholds = { high: 0.8, medium: 0.3 };
    (
      el.shadowRoot!.querySelector(
        '[part="item"][data-id="l1"] [part="expand-toggle"]'
      ) as HTMLButtonElement
    ).click();
    await el.updateComplete;
    const panel = el.shadowRoot!.querySelector(
      "lr-provenance-panel"
    ) as HTMLElement & {
      types: unknown;
      thresholds: unknown;
    };
    expect(panel.types).to.deep.equal([{ id: "person", label: "Person" }]);
    expect(panel.thresholds).to.deep.equal({ high: 0.8, medium: 0.3 });
  });

  it("short-term items show Add and Remove actions; long-term items show Remove only", async () => {
    const el = await populated();
    const shortRow = el.shadowRoot!.querySelector(
      '[part="item"][data-id="s1"]'
    )!;
    expect(shortRow.querySelector('[part="add-button"]')).to.exist;
    expect(shortRow.querySelector('[part="remove-button"]')).to.exist;

    const longRow = el.shadowRoot!.querySelector(
      '[part="item"][data-id="l1"]'
    )!;
    expect(longRow.querySelector('[part="add-button"]') == null).to.be.true;
    expect(longRow.querySelector('[part="remove-button"]')).to.exist;
  });

  it('Add opens an inline lr-confirm-bar; approving emits lr-add with the memory and reverts the row, mutating nothing itself', async () => {
    const el = await populated();
    const originalShortTerm = el.shortTerm;
    const row = el.shadowRoot!.querySelector('[part="item"][data-id="s1"]')!;
    (row.querySelector('[part="add-button"]') as HTMLButtonElement).click();
    await el.updateComplete;

    const confirmBar = (await readyConfirmBar(row)) as HTMLElement & {
      tone: string;
      heading: string;
    };
    expect(confirmBar != null).to.equal(true);
    expect(confirmBar.variant).to.equal("neutral");
    expect(confirmBar.heading).to.equal("Add this to long-term memory?");
    expect(row.querySelector('[part="add-button"]') == null).to.be.true;
    expect(row.querySelector('[part="remove-button"]') == null).to.be.true;

    const listener = oneEvent(el, "lr-add");
    (
      confirmBar.shadowRoot!.querySelector(
        '[part="approve-button"]'
      ) as HTMLButtonElement
    ).click();
    const event = await listener;
    expect(event.detail).to.deep.equal({ memory: shortTermItems[0] });
    await el.updateComplete;

    expect(row.querySelector("lr-confirm-bar") == null).to.be.true;
    expect(row.querySelector('[part="add-button"]')).to.exist;
    expect(el.shortTerm).to.equal(originalShortTerm); // controlled: never mutated by the component itself
  });

  it('Remove opens a danger-tone lr-confirm-bar; approving emits lr-remove with memoryId and scope', async () => {
    const el = await populated();
    const row = el.shadowRoot!.querySelector('[part="item"][data-id="l2"]')!;
    (row.querySelector('[part="remove-button"]') as HTMLButtonElement).click();
    await el.updateComplete;

    const confirmBar = (await readyConfirmBar(row)) as HTMLElement & {
      tone: string;
    };
    expect(confirmBar.variant).to.equal("danger");

    const listener = oneEvent(el, "lr-remove");
    (
      confirmBar.shadowRoot!.querySelector(
        '[part="approve-button"]'
      ) as HTMLButtonElement
    ).click();
    const event = await listener;
    expect(event.detail).to.deep.equal({
      memoryId: 'l2',
      scope: 'long-term',
    });
  });

  it("Deny cancels the pending action silently: no lr-add/lr-remove/lr-forget fires, and the row reverts", async () => {
    const el = await populated();
    let added = false;
    let removed = false;
    el.addEventListener("lr-add", () => (added = true));
    el.addEventListener("lr-remove", () => (removed = true));
    const row = el.shadowRoot!.querySelector('[part="item"][data-id="s1"]')!;
    (row.querySelector('[part="remove-button"]') as HTMLButtonElement).click();
    await el.updateComplete;
    const confirmBar = await readyConfirmBar(row);
    (
      confirmBar.shadowRoot!.querySelector(
        '[part="deny-button"]'
      ) as HTMLButtonElement
    ).click();
    await el.updateComplete;
    expect(added).to.be.false;
    expect(removed).to.be.false;
    expect(row.querySelector("lr-confirm-bar") == null).to.be.true;
    expect(row.querySelector('[part="remove-button"]')).to.exist;
  });

  it("only allows one pending confirmation at a time: starting a new action on a different item cancels the first", async () => {
    const el = await populated();
    const rowA = el.shadowRoot!.querySelector('[part="item"][data-id="s1"]')!;
    const rowB = el.shadowRoot!.querySelector('[part="item"][data-id="s2"]')!;
    (rowA.querySelector('[part="remove-button"]') as HTMLButtonElement).click();
    await el.updateComplete;
    expect(rowA.querySelector("lr-confirm-bar")).to.exist;

    (rowB.querySelector('[part="add-button"]') as HTMLButtonElement).click();
    await el.updateComplete;
    expect(rowA.querySelector("lr-confirm-bar") == null).to.be.true;
    expect(rowA.querySelector('[part="remove-button"]')).to.exist;
    expect(rowB.querySelector("lr-confirm-bar")).to.exist;
  });

  it('renders a section-level "Forget all" control only while longTerm is non-empty', async () => {
    const withLongTerm = await populated();
    expect(withLongTerm.shadowRoot!.querySelector('[part="forget-all-button"]'))
      .to.exist;

    const withoutLongTerm = (await fixture(
      html`<lr-memory-panel></lr-memory-panel>`
    )) as LyraMemoryPanel;
    withoutLongTerm.shortTerm = shortTermItems;
    await withoutLongTerm.updateComplete;
    expect(
      withoutLongTerm.shadowRoot!.querySelector('[part="forget-all-button"]') ==
        null
    ).to.be.true;
  });

  it("Forget all opens a danger-tone lr-confirm-bar with the memory count in its body; approving emits lr-forget with no id", async () => {
    const el = await populated();
    (
      el.shadowRoot!.querySelector(
        '[part="forget-all-button"]'
      ) as HTMLButtonElement
    ).click();
    await el.updateComplete;
    const confirmBar = (await readyConfirmBar(
      el.shadowRoot!.querySelector('[part="section"][data-scope="long-term"]')!
    )) as HTMLElement & {
      tone: string;
      heading: string;
    };
    expect(confirmBar.variant).to.equal("danger");
    expect(confirmBar.heading).to.equal("Forget all long-term memories?");
    expect(confirmBar.textContent).to.include("2");

    const listener = oneEvent(el, "lr-forget");
    (
      confirmBar.shadowRoot!.querySelector(
        '[part="approve-button"]'
      ) as HTMLButtonElement
    ).click();
    const event = await listener;
    expect(event.detail).to.be.null;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="forget-all-button"]')).to.exist;
  });

  it('Forget all: clicking Deny cancels silently and restores the "Forget all" control', async () => {
    const el = await populated();
    (
      el.shadowRoot!.querySelector(
        '[part="forget-all-button"]'
      ) as HTMLButtonElement
    ).click();
    await el.updateComplete;
    const section = el.shadowRoot!.querySelector(
      '[part="section"][data-scope="long-term"]'
    )!;
    const confirmBar = await readyConfirmBar(section);
    let forgot = false;
    el.addEventListener("lr-forget", () => (forgot = true));
    (
      confirmBar.shadowRoot!.querySelector(
        '[part="deny-button"]'
      ) as HTMLButtonElement
    ).click();
    await el.updateComplete;
    expect(forgot).to.be.false;
    expect(section.querySelector("lr-confirm-bar") == null).to.be.true;
    expect(el.shadowRoot!.querySelector('[part="forget-all-button"]')).to.exist;
  });

  it("falls back to a surviving item elsewhere when approving Forget all leaves no long-term section", async () => {
    const el = await populated();
    el.addEventListener(
      "lr-forget",
      () => {
        el.longTerm = [];
      },
      { once: true }
    );
    (
      el.shadowRoot!.querySelector(
        '[part="forget-all-button"]'
      ) as HTMLButtonElement
    ).click();
    await el.updateComplete;
    const section = el.shadowRoot!.querySelector(
      '[part="section"][data-scope="long-term"]'
    )!;
    const confirmBar = await readyConfirmBar(section);
    (
      confirmBar.shadowRoot!.querySelector(
        '[part="approve-button"]'
      ) as HTMLButtonElement
    ).click();
    await el.updateComplete;
    await new Promise((resolve) => requestAnimationFrame(resolve));
    expect(el.shadowRoot!.querySelector('[part="forget-all-button"]') == null)
      .to.be.true;
    expect(
      (el.shadowRoot!.activeElement as HTMLElement | null)
        ?.closest('[part="item"]')
        ?.getAttribute("data-scope")
    ).to.equal("short-term");
  });

  it("cancels a pending forget-all decision when controlled longTerm data changes", async () => {
    const el = await populated();
    (
      el.shadowRoot!.querySelector(
        '[part="forget-all-button"]'
      ) as HTMLButtonElement
    ).click();
    await el.updateComplete;
    const section = el.shadowRoot!.querySelector(
      '[part="section"][data-scope="long-term"]'
    )!;
    const staleConfirmBar = await readyConfirmBar(section);
    const staleApprove = staleConfirmBar.shadowRoot!.querySelector(
      '[part="approve-button"]'
    ) as HTMLButtonElement;
    let forgot = false;
    el.addEventListener("lr-forget", () => (forgot = true));
    expect(section.querySelectorAll("lr-confirm-bar").length).to.equal(1);

    el.longTerm = [
      ...longTermItems,
      { id: "l3", text: "A newly controlled memory." },
    ];
    await el.updateComplete;

    expect(section.querySelectorAll("lr-confirm-bar").length).to.equal(0);
    expect(
      section.querySelectorAll('[part="forget-all-button"]').length
    ).to.equal(1);
    staleApprove.click();
    expect(forgot).to.be.false;
  });

  it("rejects stale forget-all approval in the same turn as a controlled longTerm replacement", async () => {
    const el = await populated();
    (
      el.shadowRoot!.querySelector(
        '[part="forget-all-button"]'
      ) as HTMLButtonElement
    ).click();
    await el.updateComplete;
    const section = el.shadowRoot!.querySelector(
      '[part="section"][data-scope="long-term"]'
    )!;
    const staleConfirmBar = await readyConfirmBar(section);
    const staleApprove = staleConfirmBar.shadowRoot!.querySelector(
      '[part="approve-button"]'
    ) as HTMLButtonElement;
    let forgot = false;
    el.addEventListener("lr-forget", () => (forgot = true));

    el.longTerm = [
      ...longTermItems,
      { id: "l3", text: "A newly controlled memory." },
    ];
    staleApprove.click();

    expect(forgot).to.be.false;
    await el.updateComplete;
    expect(section.querySelectorAll("lr-confirm-bar").length).to.equal(0);
  });

  it("re-emits child events unmodified (lr-toggle bubbles up from a nested lr-provenance-panel)", async () => {
    const el = await populated();
    (
      el.shadowRoot!.querySelector(
        '[part="item"][data-id="l1"] [part="expand-toggle"]'
      ) as HTMLButtonElement
    ).click();
    await el.updateComplete;
    const listener = oneEvent(el, "lr-toggle");
    (
      el
        .shadowRoot!.querySelector("lr-provenance-panel")!
        .shadowRoot!.querySelector('[part="header"]') as HTMLButtonElement
    ).click();
    const event = await listener;
    expect(event.detail.section).to.equal("entities");
  });

  it("moves focus to a stable element after resolving a pending confirmation, never leaving it stranded", async () => {
    const el = await populated();
    const row = el.shadowRoot!.querySelector('[part="item"][data-id="s1"]')!;
    (row.querySelector('[part="remove-button"]') as HTMLButtonElement).click();
    await el.updateComplete;
    const confirmBar = await readyConfirmBar(row);
    (
      confirmBar.shadowRoot!.querySelector(
        '[part="deny-button"]'
      ) as HTMLButtonElement
    ).click();
    await el.updateComplete;
    await new Promise((r) => requestAnimationFrame(r));
    expect(el.shadowRoot!.activeElement != null).to.equal(true);
    expect(row.contains(el.shadowRoot!.activeElement)).to.be.true;
  });

  describe("keyboard focus across the confirmation step", () => {
    it("moves focus into the confirmation when a focused remove action is activated", async () => {
      const el = await populated();
      const row = el.shadowRoot!.querySelector('[part="item"][data-id="s1"]')!;
      const remove = row.querySelector(
        '[part="remove-button"]'
      ) as HTMLButtonElement;
      remove.focus();
      expect(el.shadowRoot!.activeElement?.getAttribute("part")).to.equal(
        "remove-button"
      );

      remove.click(); // what Enter on the focused button dispatches
      await el.updateComplete;
      const bar = await readyConfirmBar(row);
      await settleFocus(el);

      expect(deepActiveElement(document)?.localName).to.not.equal("body");
      expect(composedContains(bar, deepActiveElement(document))).to.be.true;
      expect(bar.shadowRoot!.activeElement?.getAttribute("part")).to.equal(
        "deny-button"
      );
    });

    it("moves focus into the confirmation when a focused add action is activated", async () => {
      const el = await populated();
      const row = el.shadowRoot!.querySelector('[part="item"][data-id="s2"]')!;
      const add = row.querySelector('[part="add-button"]') as HTMLButtonElement;
      add.focus();
      add.click();
      await el.updateComplete;
      const bar = await readyConfirmBar(row);
      await settleFocus(el);

      expect(deepActiveElement(document)?.localName).to.not.equal("body");
      expect(composedContains(bar, deepActiveElement(document))).to.be.true;
    });

    it('moves focus into the confirmation when the focused "forget all" action is activated', async () => {
      const el = await populated();
      const section = el.shadowRoot!.querySelector(
        '[part="section"][data-scope="long-term"]'
      )!;
      const forgetAll = section.querySelector(
        '[part="forget-all-button"]'
      ) as HTMLButtonElement;
      forgetAll.focus();
      forgetAll.click();
      await el.updateComplete;
      const bar = await readyConfirmBar(section);
      await settleFocus(el);

      expect(deepActiveElement(document)?.localName).to.not.equal("body");
      expect(composedContains(bar, deepActiveElement(document))).to.be.true;
    });

    it("returns focus to the row when the confirmation is denied from the keyboard", async () => {
      const el = await populated();
      const row = el.shadowRoot!.querySelector(
        '[part="item"][data-id="s1"]'
      ) as HTMLElement;
      const remove = row.querySelector(
        '[part="remove-button"]'
      ) as HTMLButtonElement;
      remove.focus();
      remove.click();
      await el.updateComplete;
      const bar = await readyConfirmBar(row);
      await settleFocus(el);

      (
        bar.shadowRoot!.querySelector('[part="deny-button"]') as HTMLElement
      ).click();
      await settleFocus(el);

      expect(el.shadowRoot!.querySelectorAll("lr-confirm-bar").length).to.equal(
        0
      );
      expect(deepActiveElement(document)?.localName).to.not.equal("body");
      expect(composedContains(row, deepActiveElement(document))).to.be.true;
    });

    it("cancels the confirmation on Escape and returns focus to the row", async () => {
      const el = await populated();
      const row = el.shadowRoot!.querySelector(
        '[part="item"][data-id="s1"]'
      ) as HTMLElement;
      const remove = row.querySelector(
        '[part="remove-button"]'
      ) as HTMLButtonElement;
      remove.focus();
      remove.click();
      await el.updateComplete;
      await readyConfirmBar(row);
      await settleFocus(el);

      let removed = false;
      el.addEventListener("lr-remove", () => (removed = true));
      (deepActiveElement(document) as HTMLElement).dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Escape",
          bubbles: true,
          composed: true,
        })
      );
      await settleFocus(el);

      expect(removed).to.be.false;
      expect(el.shadowRoot!.querySelectorAll("lr-confirm-bar").length).to.equal(
        0
      );
      expect(deepActiveElement(document)?.localName).to.not.equal("body");
      expect(composedContains(row, deepActiveElement(document))).to.be.true;
    });

    it('cancels the "forget all" confirmation on Escape and returns focus to its control', async () => {
      const el = await populated();
      const section = el.shadowRoot!.querySelector(
        '[part="section"][data-scope="long-term"]'
      ) as HTMLElement;
      const forgetAll = section.querySelector(
        '[part="forget-all-button"]'
      ) as HTMLButtonElement;
      forgetAll.focus();
      forgetAll.click();
      await el.updateComplete;
      await readyConfirmBar(section);
      await settleFocus(el);

      let forgot = false;
      el.addEventListener("lr-forget", () => (forgot = true));
      (deepActiveElement(document) as HTMLElement).dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Escape",
          bubbles: true,
          composed: true,
        })
      );
      await settleFocus(el);

      expect(forgot).to.be.false;
      expect(el.shadowRoot!.querySelectorAll("lr-confirm-bar").length).to.equal(
        0
      );
      expect(el.shadowRoot!.activeElement?.getAttribute("part")).to.equal(
        "forget-all-button"
      );
    });

    it("ignores a non-Escape key on the pending confirmation: no cancellation, no propagation stop", async () => {
      const el = await populated();
      const row = el.shadowRoot!.querySelector(
        '[part="item"][data-id="s1"]'
      ) as HTMLElement;
      const remove = row.querySelector(
        '[part="remove-button"]'
      ) as HTMLButtonElement;
      remove.focus();
      remove.click();
      await el.updateComplete;
      await readyConfirmBar(row);
      await settleFocus(el);

      let removed = false;
      el.addEventListener("lr-remove", () => (removed = true));
      (deepActiveElement(document) as HTMLElement).dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Enter",
          bubbles: true,
          composed: true,
        })
      );
      await settleFocus(el);

      expect(removed).to.be.false;
      expect(el.shadowRoot!.querySelectorAll("lr-confirm-bar").length).to.equal(
        1
      );
    });

    it("does not attempt to focus when a synchronous controlled change removes the item before its confirm bar ever mounts", async () => {
      const el = await populated();
      const row = el.shadowRoot!.querySelector(
        '[part="item"][data-id="s1"]'
      ) as HTMLElement;
      const remove = row.querySelector(
        '[part="remove-button"]'
      ) as HTMLButtonElement;
      remove.click();
      // Same tick, no await: the controlled replacement removes the item before Lit ever commits
      // the render that would have shown its lr-confirm-bar.
      el.shortTerm = el.shortTerm.filter((item) => item.id !== "s1");
      await el.updateComplete;
      await settleFocus(el);
      expect(el.shadowRoot!.querySelectorAll("lr-confirm-bar").length).to.equal(
        0
      );
      expect(
        el.shadowRoot!.querySelector('[part="item"][data-id="s1"]') == null
      ).to.be.true;
    });
  });

  it("uses instance-safe disclosure ids for hostile and duplicate caller ids", async () => {
    const hostile = 'same id"]';
    const item = (text: string): LyraMemoryItem => ({
      id: hostile,
      text,
      provenance: {
        entities: [{ id: "entity", label: "Entity", type: "person" }],
      },
    });
    const first = (await fixture(
      html`<lr-memory-panel></lr-memory-panel>`
    )) as LyraMemoryPanel;
    const second = (await fixture(
      html`<lr-memory-panel></lr-memory-panel>`
    )) as LyraMemoryPanel;
    first.shortTerm = [item("First")];
    first.longTerm = [item("Second")];
    second.shortTerm = [item("Third")];
    await Promise.all([first.updateComplete, second.updateComplete]);

    const toggles = [
      ...first.shadowRoot!.querySelectorAll('[part="expand-toggle"]'),
      ...second.shadowRoot!.querySelectorAll('[part="expand-toggle"]'),
    ];
    const ids = toggles.map((toggle) => toggle.getAttribute("aria-controls")!);
    expect(new Set(ids).size).to.equal(3);
    expect(ids.some((id) => id.includes(hostile))).to.be.false;
    for (const toggle of toggles) {
      expect(
        first.shadowRoot!.getElementById(
          toggle.getAttribute("aria-controls")!
        ) != null ||
          second.shadowRoot!.getElementById(
            toggle.getAttribute("aria-controls")!
          ) != null
      ).to.be.true;
    }
  });

  it("keys pending confirmations by item identity and scope, not a duplicate public id", async () => {
    const duplicateShort = { id: "duplicate", text: "Short" };
    const duplicateLong = { id: "duplicate", text: "Long" };
    const el = (await fixture(
      html`<lr-memory-panel></lr-memory-panel>`
    )) as LyraMemoryPanel;
    el.shortTerm = [duplicateShort];
    el.longTerm = [duplicateLong];
    await el.updateComplete;
    const longRow = el.shadowRoot!.querySelector(
      '[part="section"][data-scope="long-term"] [part="item"]'
    )!;
    (
      longRow.querySelector('[part="remove-button"]') as HTMLButtonElement
    ).click();
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll("lr-confirm-bar").length).to.equal(
      1
    );
    expect(longRow.querySelector("lr-confirm-bar")?.textContent).to.contain(
      "Long"
    );
  });

  it("cancels a pending decision when controlled data replaces the captured record", async () => {
    const el = await populated();
    const row = el.shadowRoot!.querySelector('[part="item"][data-id="s1"]')!;
    (row.querySelector('[part="remove-button"]') as HTMLButtonElement).click();
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll("lr-confirm-bar").length).to.equal(
      1
    );

    el.shortTerm = [{ ...shortTermItems[0]! }, shortTermItems[1]!];
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll("lr-confirm-bar").length).to.equal(
      0
    );
  });

  it("rejects stale item approval in the same turn as a controlled collection replacement", async () => {
    const el = await populated();
    const row = el.shadowRoot!.querySelector('[part="item"][data-id="l2"]')!;
    (row.querySelector('[part="remove-button"]') as HTMLButtonElement).click();
    await el.updateComplete;
    const staleConfirmBar = await readyConfirmBar(row);
    const staleApprove = staleConfirmBar.shadowRoot!.querySelector(
      '[part="approve-button"]'
    ) as HTMLButtonElement;
    let removed = false;
    el.addEventListener("lr-remove", () => (removed = true));

    el.longTerm = [
      { ...longTermItems[0]! },
      { id: "replacement", text: "Replacement memory." },
    ];
    staleApprove.click();

    expect(removed).to.be.false;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll("lr-confirm-bar").length).to.equal(
      0
    );
  });

  it("does not let a stale item handler clear a newly started pending action", async () => {
    const el = await populated();
    const firstRow = el.shadowRoot!.querySelector(
      '[part="item"][data-id="s1"]'
    )!;
    const secondRow = el.shadowRoot!.querySelector(
      '[part="item"][data-id="s2"]'
    )!;
    (
      firstRow.querySelector('[part="remove-button"]') as HTMLButtonElement
    ).click();
    await el.updateComplete;
    const staleConfirmBar = await readyConfirmBar(firstRow);
    const staleApprove = staleConfirmBar.shadowRoot!.querySelector(
      '[part="approve-button"]'
    ) as HTMLButtonElement;
    let removed = false;
    el.addEventListener("lr-remove", () => (removed = true));

    (
      secondRow.querySelector('[part="add-button"]') as HTMLButtonElement
    ).click();
    staleApprove.click();

    expect(removed).to.be.false;
    await el.updateComplete;
    const secondRowAfterUpdate = el.shadowRoot!.querySelector(
      '[part="item"][data-id="s2"]'
    )!;
    expect(
      secondRowAfterUpdate.querySelectorAll("lr-confirm-bar").length
    ).to.equal(1);
  });

  it("moves focus to a surviving row when approval synchronously removes the focused item", async () => {
    const el = await populated();
    const row = el.shadowRoot!.querySelector('[part="item"][data-id="s1"]')!;
    (row.querySelector('[part="remove-button"]') as HTMLButtonElement).click();
    await el.updateComplete;
    const confirmBar = await readyConfirmBar(row);
    el.addEventListener(
      "lr-remove",
      () => {
        el.shortTerm = el.shortTerm.slice(1);
      },
      { once: true }
    );
    (
      confirmBar.shadowRoot!.querySelector(
        '[part="approve-button"]'
      ) as HTMLButtonElement
    ).click();
    await el.updateComplete;
    await new Promise((resolve) => requestAnimationFrame(resolve));
    expect(
      (el.shadowRoot!.activeElement as HTMLElement | null)?.getAttribute(
        "data-id"
      )
    ).to.equal("s2");
  });

  it("falls back to any surviving item in a different scope when approval empties the whole originating scope", async () => {
    const el = await populated();
    el.shortTerm = [shortTermItems[0]!]; // only s1 left, so removing it empties short-term entirely
    await el.updateComplete;
    const row = el.shadowRoot!.querySelector('[part="item"][data-id="s1"]')!;
    (row.querySelector('[part="remove-button"]') as HTMLButtonElement).click();
    await el.updateComplete;
    const confirmBar = await readyConfirmBar(row);
    el.addEventListener(
      "lr-remove",
      () => {
        el.shortTerm = [];
      },
      { once: true }
    );
    (
      confirmBar.shadowRoot!.querySelector(
        '[part="approve-button"]'
      ) as HTMLButtonElement
    ).click();
    await el.updateComplete;
    await new Promise((resolve) => requestAnimationFrame(resolve));
    expect(el.shadowRoot!.querySelector('[part="item"][data-id="s1"]') == null)
      .to.be.true;
    expect(
      (el.shadowRoot!.activeElement as HTMLElement | null)
        ?.closest('[part="item"]')
        ?.getAttribute("data-scope")
    ).to.equal("long-term");
  });

  it("falls back to the stable base wrapper when the last memory anywhere is approved away", async () => {
    const el = (await fixture(
      html`<lr-memory-panel></lr-memory-panel>`
    )) as LyraMemoryPanel;
    el.shortTerm = [shortTermItems[0]!];
    await el.updateComplete;
    const row = el.shadowRoot!.querySelector('[part="item"][data-id="s1"]')!;
    (row.querySelector('[part="remove-button"]') as HTMLButtonElement).click();
    await el.updateComplete;
    const confirmBar = await readyConfirmBar(row);
    el.addEventListener(
      "lr-remove",
      () => {
        el.shortTerm = [];
      },
      { once: true }
    );
    (
      confirmBar.shadowRoot!.querySelector(
        '[part="approve-button"]'
      ) as HTMLButtonElement
    ).click();
    await el.updateComplete;
    await new Promise((resolve) => requestAnimationFrame(resolve));
    expect(el.shadowRoot!.querySelector('[part="item"]') == null).to.be.true;
    expect(
      (el.shadowRoot!.activeElement as HTMLElement | null)?.getAttribute("part")
    ).to.equal("base");
  });

  it("repairs focus when an externally controlled collection removes the focused item", async () => {
    const el = await populated();
    const rows = el.shadowRoot!.querySelectorAll<HTMLElement>(
      '[part="section"][data-scope="short-term"] [part="item"]'
    );
    rows[1]!
      .querySelector<HTMLButtonElement>('[part="remove-button"]')!
      .focus();

    el.shortTerm = el.shortTerm.slice(0, 1);
    await el.updateComplete;
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => resolve())
    );

    expect(el.shadowRoot!.activeElement?.getAttribute("part")).to.equal("item");
    expect(el.shadowRoot!.activeElement?.getAttribute("data-id")).to.equal(
      "s1"
    );
  });

  it("shrinks to a 320px allocation with long item text without horizontal overflow", async () => {
    const longItems: LyraMemoryItem[] = [
      {
        id: "long",
        text: "ThisIsAnIntentionallyLongUnbrokenPieceOfMemoryTextUsedToVerifyThatTheComponentWrapsInsteadOfOverflowingItsAllocatedWidth",
        confidence: 0.6,
      },
    ];
    const el = (await fixture(html`
      <lr-memory-panel
        style="inline-size: 320px; max-inline-size: 100%;"
      ></lr-memory-panel>
    `)) as LyraMemoryPanel;
    el.shortTerm = longItems;
    await el.updateComplete;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    expect(base.scrollWidth).to.be.at.most(el.clientWidth + 1);
  });

  it('renders correctly under dir="rtl" and stays accessible', async () => {
    const wrapper = (await fixture(
      html`<div dir="rtl"><lr-memory-panel></lr-memory-panel></div>`
    )) as HTMLElement;
    const el = wrapper.querySelector("lr-memory-panel") as LyraMemoryPanel;
    el.shortTerm = shortTermItems;
    el.longTerm = longTermItems;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll('[part="item"]').length).to.equal(4);
    await expect(el).to.be.accessible();
  });

  it("is accessible in the empty state", async () => {
    const el = (await fixture(
      html`<lr-memory-panel></lr-memory-panel>`
    )) as LyraMemoryPanel;
    await expect(el).to.be.accessible();
  });

  it("is accessible in a populated state with a pending confirmation open", async () => {
    const el = await populated();
    (
      el.shadowRoot!.querySelector(
        '[part="item"][data-id="l1"] [part="remove-button"]'
      ) as HTMLButtonElement
    ).click();
    await el.updateComplete;
    await readyConfirmBar(
      el.shadowRoot!.querySelector('[part="item"][data-id="l1"]')!
    );
    await expect(el).to.be.accessible();
  });

  it("gives expand-toggle, add-button, remove-button, and forget-all-button a hover state", () => {
    const css = styles.cssText.replace(/\s+/g, " ");
    expect(css).to.match(/\[part='expand-toggle'\]:hover/);
    expect(css).to.match(/\[part='add-button'\]:hover/);
    expect(css).to.match(/\[part='remove-button'\]:hover/);
    expect(css).to.match(/\[part='forget-all-button'\]:hover/);
  });

  describe("localization", () => {
    it("localizes section headings, action labels, and confirm headings via this.localize()", async () => {
      const el = (await fixture(html`
        <lr-memory-panel
          .strings=${{
            memoryPanelShortTermHeading: "Contexte à court terme",
            memoryPanelLongTermHeading: "Mémoire à long terme",
            memoryPanelAdd: "Ajouter à la mémoire",
            remove: "Supprimer",
            memoryPanelForgetAll: "Tout oublier",
            memoryPanelConfirmRemoveHeading: "Supprimer cet élément ?",
          }}
        ></lr-memory-panel>
      `)) as LyraMemoryPanel;
      el.shortTerm = shortTermItems;
      el.longTerm = longTermItems;
      await el.updateComplete;

      const headings = [
        ...el.shadowRoot!.querySelectorAll('[part="heading"]'),
      ].map((h) => h.textContent);
      expect(headings).to.include("Contexte à court terme");
      expect(headings).to.include("Mémoire à long terme");

      const shortRow = el.shadowRoot!.querySelector(
        '[part="item"][data-id="s1"]'
      )!;
      expect(
        (
          shortRow.querySelector('[part="add-button"]') as HTMLElement
        ).textContent!.trim()
      ).to.equal("Ajouter à la mémoire");
      expect(
        (
          shortRow.querySelector('[part="remove-button"]') as HTMLElement
        ).textContent!.trim()
      ).to.equal("Supprimer");
      expect(
        (
          el.shadowRoot!.querySelector(
            '[part="forget-all-button"]'
          ) as HTMLElement
        ).textContent!.trim()
      ).to.equal("Tout oublier");

      (
        shortRow.querySelector('[part="remove-button"]') as HTMLButtonElement
      ).click();
      await el.updateComplete;
      const confirmBar = shortRow.querySelector(
        "lr-confirm-bar"
      ) as HTMLElement & { heading: string };
      expect(confirmBar.heading).to.equal("Supprimer cet élément ?");
    });

    it("renders the built-in English fallback with no locale registered", async () => {
      const el = await populated();
      const groupLabel = (
        el.shadowRoot!.querySelector('[part="base"]') as HTMLElement
      ).getAttribute("aria-label");
      expect(groupLabel).to.equal("Memory");
    });
  });

  describe("--lr-memory-panel-confidence-<tone>-color", () => {
    it("recolors only the confidence indicator that reads the matching custom property", async () => {
      const el = await populated();
      const successConfidence = el.shadowRoot!.querySelector(
        '[part="item"][data-id="s1"] [part="confidence"]'
      ) as HTMLElement; // data-tone="success"
      el.style.setProperty(
        "--lr-memory-panel-confidence-success-color",
        "rgb(10, 20, 30)"
      );
      expect(getComputedStyle(successConfidence).color).to.equal(
        "rgb(10, 20, 30)"
      );

      const dangerConfidence = el.shadowRoot!.querySelector(
        '[part="item"][data-id="l1"] [part="confidence"]'
      ) as HTMLElement; // data-tone="danger"
      expect(getComputedStyle(dangerConfidence).color).to.not.equal(
        "rgb(10, 20, 30)"
      );
    });

    it("renders identically to the shared success/warning/danger tokens when unset", async () => {
      const el = await populated();
      const successConfidence = el.shadowRoot!.querySelector(
        '[part="item"][data-id="s1"] [part="confidence"]'
      ) as HTMLElement;
      const unset = getComputedStyle(successConfidence).color;
      el.style.setProperty(
        "--lr-memory-panel-confidence-success-color",
        "var(--lr-color-success)"
      );
      expect(getComputedStyle(successConfidence).color).to.equal(unset);
    });
  });
});

it("formats the forget-all confirmation count with the effective locale", async () => {
  const el = (await fixture(
    html`<lr-memory-panel lang="ar-u-nu-arab"></lr-memory-panel>`
  )) as LyraMemoryPanel;
  el.longTerm = Array.from({ length: 12 }, (_, index) => ({
    id: `memory-${index}`,
    text: `Memory ${index}`,
  }));
  await el.updateComplete;
  (
    el.shadowRoot!.querySelector(
      '[part="forget-all-button"]'
    ) as HTMLButtonElement
  ).click();
  await el.updateComplete;
  const section = el.shadowRoot!.querySelector(
    '[part="section"][data-scope="long-term"]'
  )!;
  expect((await readyConfirmBar(section)).textContent).to.include("١٢");
});

it("keeps focus when a controlled longTerm replacement closes an open forget-all confirmation", async () => {
  // The forget-all <lr-confirm-bar> renders outside every [part="item"] and had no `part`, so
  // `captureControlledFocus()` matched neither its row branch nor its forget-all-button branch.
  // A host reassigning `longTerm` while that confirmation was open unmounted the bar and dropped
  // focus to <body> -- a keyboard user was thrown back to the top of the page.
  const el = await populated();
  const section = el.shadowRoot!.querySelector(
    '[part="section"][data-scope="long-term"]'
  )!;
  const forgetAll = el.shadowRoot!.querySelector(
    '[part="forget-all-button"]'
  ) as HTMLButtonElement;
  forgetAll.focus();
  forgetAll.click(); // what Enter on the focused action dispatches
  await el.updateComplete;
  const bar = await readyConfirmBar(section);
  await settleFocus(el);

  expect(
    bar.getAttribute("part"),
    "the confirmation is addressable as a part"
  ).to.equal("forget-all-confirm");
  expect(
    composedContains(bar, deepActiveElement(document)),
    "focus starts in the bar"
  ).to.be.true;

  // Controlled replacement that still leaves long-term memories: the bar unmounts, the
  // "Forget all" action comes back, and focus must land on it rather than on <body>.
  el.longTerm = el.longTerm.slice(0, Math.max(1, el.longTerm.length - 1));
  await el.updateComplete;
  await settleFocus(el);

  expect(
    deepActiveElement(document)?.localName,
    "focus must not fall to body"
  ).to.not.equal("body");
  expect(
    (deepActiveElement(document) as HTMLElement | null)?.getAttribute("part"),
    "focus returns to the Forget all action"
  ).to.equal("forget-all-button");
});

it("moves focus to the stable base wrapper when a controlled longTerm clear empties the list while the forget-all confirmation holds focus", async () => {
  const el = await populated();
  const forgetAll = el.shadowRoot!.querySelector(
    '[part="forget-all-button"]'
  ) as HTMLButtonElement;
  forgetAll.focus();
  forgetAll.click();
  await el.updateComplete;
  const section = el.shadowRoot!.querySelector(
    '[part="section"][data-scope="long-term"]'
  )!;
  await readyConfirmBar(section);
  await settleFocus(el);

  // Unlike the "still has memories" case above, this controlled replacement empties longTerm
  // entirely -- the section itself loses its "Forget all" control, so focus has nowhere stable to
  // land but the root.
  el.longTerm = [];
  await settleFocus(el);

  expect(el.shadowRoot!.querySelector('[part="forget-all-button"]') == null).to
    .be.true;
  expect(el.shadowRoot!.activeElement?.getAttribute("part")).to.equal("base");
});

it('moves focus to the stable base wrapper when a controlled longTerm clear empties the list while the focused "Forget all" button itself disappears', async () => {
  const el = await populated();
  const forgetAll = el.shadowRoot!.querySelector(
    '[part="forget-all-button"]'
  ) as HTMLButtonElement;
  forgetAll.focus();
  el.longTerm = [];
  await settleFocus(el);
  expect(el.shadowRoot!.querySelector('[part="forget-all-button"]') == null).to
    .be.true;
  expect(el.shadowRoot!.activeElement?.getAttribute("part")).to.equal("base");
});

describe("lr-memory-panel controlled-list focus restoration", () => {
  const shortTerm: LyraMemoryItem[] = [
    { id: "s1", text: "First short-term memory." },
    { id: "s2", text: "Second short-term memory." },
    { id: "s3", text: "Third short-term memory." },
  ];
  const longTerm: LyraMemoryItem[] = [{ id: "l1", text: "Long-term memory." }];

  async function controlled(): Promise<LyraMemoryPanel> {
    const el = (await fixture(
      html`<lr-memory-panel></lr-memory-panel>`
    )) as LyraMemoryPanel;
    el.shortTerm = [...shortTerm];
    el.longTerm = [...longTerm];
    await el.updateComplete;
    return el;
  }

  function focusRowAction(el: LyraMemoryPanel, id: string): void {
    const row = el.shadowRoot!.querySelector(`[part="item"][data-id="${id}"]`)!;
    (row.querySelector('[part="remove-button"]') as HTMLButtonElement).focus();
  }

  it("keeps focus in the same section when the focused row disappears", async () => {
    const el = await controlled();
    focusRowAction(el, "s2");
    expect(el.shadowRoot!.activeElement != null).to.equal(true);

    el.shortTerm = [shortTerm[0]!, shortTerm[2]!];
    await settleFocus(el);
    const focused = el.shadowRoot!.activeElement!;
    expect(focused.closest('[part="item"]')?.getAttribute("data-id")).to.equal(
      "s3"
    );
  });

  it("follows a surviving row to its new position when an earlier sibling is removed", async () => {
    const el = await controlled();
    focusRowAction(el, "s3");
    el.shortTerm = [shortTerm[1]!, shortTerm[2]!]; // drop s1; s3 survives, shifting index 2 -> 1
    await settleFocus(el);
    expect(
      el
        .shadowRoot!.activeElement!.closest('[part="item"]')
        ?.getAttribute("data-id")
    ).to.equal("s3");
  });

  it("clamps to the last surviving row when the tail is removed", async () => {
    const el = await controlled();
    focusRowAction(el, "s3");
    el.shortTerm = [shortTerm[0]!];
    await settleFocus(el);
    expect(
      el
        .shadowRoot!.activeElement!.closest('[part="item"]')
        ?.getAttribute("data-id")
    ).to.equal("s1");
  });

  it("leaves focus alone when the focused row keeps its position", async () => {
    const el = await controlled();
    focusRowAction(el, "s2");
    el.shortTerm = [...shortTerm];
    await settleFocus(el);
    expect(
      el
        .shadowRoot!.activeElement!.closest('[part="item"]')
        ?.getAttribute("data-id")
    ).to.equal("s2");
  });

  it("parks focus on the panel itself once every memory is gone", async () => {
    const el = await controlled();
    focusRowAction(el, "s1");
    el.shortTerm = [];
    el.longTerm = [];
    await settleFocus(el);
    expect(el.shadowRoot!.activeElement?.getAttribute("part")).to.equal("base");
  });

  it("ignores a replacement of the other section entirely", async () => {
    const el = await controlled();
    focusRowAction(el, "s2");
    const before = el.shadowRoot!.activeElement;
    el.longTerm = [];
    await settleFocus(el);
    expect(el.shadowRoot!.activeElement === before).to.equal(true);
  });
});

it('omits blank and later duplicate memory ids before rows, counts, and actions', async () => {
  const first = { id: 'same', text: 'First memory' };
  const el = (await fixture(
    html`<lr-memory-panel></lr-memory-panel>`
  )) as LyraMemoryPanel;
  el.shortTerm = [
    { id: '', text: 'Empty id' },
    { id: '   ', text: 'Blank id' },
    first,
    { id: 'same', text: 'Later duplicate' },
  ];
  await el.updateComplete;

  const rows = el.shadowRoot!.querySelectorAll('[part="item"]');
  expect(rows.length).to.equal(1);
  expect(rows[0]!.textContent).to.contain('First memory');
  expect(rows[0]!.textContent).not.to.contain('Later duplicate');

  const pending = oneEvent(el, 'lr-remove');
  (
    rows[0]!.querySelector('[part="remove-button"]') as HTMLButtonElement
  ).click();
  await el.updateComplete;
  const confirm = await readyConfirmBar(rows[0]!);
  (
    confirm.shadowRoot!.querySelector(
      '[part="approve-button"]'
    ) as HTMLButtonElement
  ).click();
  expect((await pending).detail).to.deep.equal({
    memoryId: 'same',
    scope: 'short-term',
  });
});
