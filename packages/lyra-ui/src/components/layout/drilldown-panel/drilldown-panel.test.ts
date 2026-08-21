import { fixture, expect, html, oneEvent, waitUntil } from "@open-wc/testing";
import "./drilldown-panel.js";
import type {
  LyraDrilldownEntity,
  LyraDrilldownNode,
  LyraDrilldownPanel,
} from "./drilldown-panel.js";
import type { LyraTabGroup } from "../tab-group/tab-group.js";
import type { LyraSourceCard } from "../../retrieval/source-card/source-card.js";
import type { LyraDocumentPreview } from "../../viewers/document-preview/document-preview.js";
import type { LyraEntityCard } from "../../retrieval/entity-card/entity-card.js";
import { ANNOUNCEMENT_SINK_ATTRIBUTE } from "../../../internal/announcer.js";

const entity: LyraDrilldownEntity = {
  entityId: "entity-1",
  label: "Marie Curie",
  type: "person",
};

const nodeWithEvidenceOnly: LyraDrilldownNode = {
  nodeId: "datum-1",
  label: "Q3 revenue anomaly",
  evidence: [
    {
      evidenceId: "evidence-1",
      title: "annual_report.pdf",
      page: 12,
      href: "https://example.com/report.pdf",
      excerpt: "Revenue grew 12%…",
      full: "Revenue grew 12% year over year, driven by…",
    },
  ],
};

const nodeWithAllCategories: LyraDrilldownNode = {
  nodeId: "datum-2",
  label: "EMEA region",
  evidence: [
    {
      evidenceId: "evidence-2",
      title: "field_notes.txt",
      excerpt: "Observed a spike…",
    },
  ],
  documents: [
    {
      documentId: "document-1",
      name: "contract.pdf",
      mimeType: "application/pdf",
      uri: "https://example.com/contract.pdf",
    },
  ],
  entities: [entity],
};

async function populated(): Promise<LyraDrilldownPanel> {
  const el = (await fixture(
    html`<lr-drilldown-panel></lr-drilldown-panel>`
  )) as LyraDrilldownPanel;
  el.path = [nodeWithEvidenceOnly, nodeWithAllCategories];
  await el.updateComplete;
  const tabs = el.shadowRoot!.querySelector("lr-tab-group") as LyraTabGroup;
  await waitForTabCount(tabs, 3);
  return el;
}

async function waitForTabCount(
  tabs: LyraTabGroup,
  count: number
): Promise<void> {
  await waitUntil(
    () => tabs.shadowRoot!.querySelectorAll('[part="tab"]').length === count,
    `expected ${count} drilldown tabs`
  );
}

function tabLabels(tabs: LyraTabGroup): string[] {
  return [...tabs.querySelectorAll("lr-tab")].map(
    (tab) => tab.textContent?.trim() ?? ""
  );
}

function textDocuments(
  count: number,
  prefix = "document"
): LyraDrilldownNode["documents"] {
  return Array.from({ length: count }, (_, index) => ({
    documentId: `${prefix}-${index}`,
    name: `${prefix}-${index}.txt`,
    mimeType: "text/plain",
    uri: `https://example.test/${prefix}-${index}.txt`,
  }));
}

it("defaults to an empty path, empty types, and showFocusButton=true", async () => {
  const el = (await fixture(
    html`<lr-drilldown-panel></lr-drilldown-panel>`
  )) as LyraDrilldownPanel;
  expect(el.path).to.deep.equal([]);
  expect(el.types).to.deep.equal([]);
  expect(el.communityLabel).to.equal("");
  expect(el.showFocusButton).to.be.true;
});

it("announces post-mount schema limits through the shared light-DOM sink", async () => {
  const el = (await fixture(
    html`<lr-drilldown-panel></lr-drilldown-panel>`
  )) as LyraDrilldownPanel;
  const sink = document.querySelector(
    `[${ANNOUNCEMENT_SINK_ATTRIBUTE}="polite"]`
  ) as HTMLElement;

  expect(sink).to.exist;
  expect(sink.parentElement === document.body).to.equal(true);
  expect(sink.children).to.have.length(0);
  expect(
    el.shadowRoot!.querySelectorAll(
      '[role="status"], [role="alert"], [aria-live]'
    )
  ).to.have.length(0);

  el.path = Array.from({ length: 300 }, (_, index) => ({
    nodeId: `limited-node-${index}`,
    label: `Limited node ${index}`,
  }));
  await el.updateComplete;
  await waitUntil(
    () => sink.lastElementChild?.textContent?.includes("300") === true,
    "the shared light-DOM sink did not receive the schema-limit announcement"
  );

  expect(sink.lastElementChild!.textContent).to.include("45");
  expect(
    el.shadowRoot!.querySelector('[part="limit"]')!.textContent
  ).to.include("300");
});

it("uses bounded immutable realm-neutral snapshots and skips hostile structured records", async () => {
  const frame = document.createElement("iframe");
  document.body.append(frame);
  const foreignPath = new frame.contentWindow!.Array();
  const hostile = {};
  Object.defineProperty(hostile, "nodeId", {
    get(): never {
      throw new Error("hostile node id");
    },
  });
  const source = {
    nodeId: "safe-node",
    label: "Safe label",
    evidence: [
      {
        evidenceId: "safe-evidence",
        title: "Safe title",
        excerpt: "Safe excerpt",
      },
    ],
    entities: [
      {
        entityId: "safe-entity",
        label: "Safe entity",
        properties: { score: 4 },
      },
    ],
  };
  foreignPath.push(hostile, { id: "legacy-id", label: "No domain id" }, source);
  const el = (await fixture(
    html`<lr-drilldown-panel></lr-drilldown-panel>`
  )) as LyraDrilldownPanel;
  el.path = foreignPath as unknown as readonly LyraDrilldownNode[];
  frame.remove();
  await el.updateComplete;

  source.label = "Caller mutation";
  source.evidence[0]!.title = "Caller mutation";
  source.entities[0]!.properties.score = 99;
  expect(el.path).to.have.length(1);
  expect(el.path[0]!.label).to.equal("Safe label");
  expect(el.path[0]!.evidence![0]!.title).to.equal("Safe title");
  expect(el.path[0]!.entities![0]!.properties!.score).to.equal(4);
  expect(Object.isFrozen(el.path)).to.equal(true);
  expect(Object.isFrozen(el.path[0])).to.equal(true);
  expect(Object.isFrozen(el.path[0]!.evidence)).to.equal(true);
  expect(Object.isFrozen(el.path[0]!.entities![0]!.properties)).to.equal(true);
  expect(el.shadowRoot!.querySelector('[part="limit"]') == null).to.equal(true);

  el.path = Array.from({ length: 300 }, (_, index) => ({
    nodeId: `node-${index}`,
    label: `Node ${index}`,
  }));
  await el.updateComplete;
  expect(el.path).to.have.length(256);
  expect(el.path.at(-1)!.nodeId).to.equal("node-299");
  expect(
    el.shadowRoot!.querySelector('[part="limit"]')!.textContent
  ).to.include("45");
  expect(
    el.shadowRoot!.querySelector('[part="limit"]')!.textContent
  ).to.include("300");
});

it('fails closed on hostile collection descriptors and malformed nested records', async () => {
  const el = await fixture<LyraDrilldownPanel>(html`
    <lr-drilldown-panel></lr-drilldown-panel>
  `);
  const lengthTrap = new Proxy([{}], {
    getOwnPropertyDescriptor(target, key) {
      if (key === 'length') throw new Error('hostile path length');
      return Reflect.getOwnPropertyDescriptor(target, key);
    },
  });
  expect(() => {
    el.path = lengthTrap as unknown as LyraDrilldownNode[];
  }).not.to.throw();
  expect(el.path).to.deep.equal([]);

  const indexTrap = new Proxy([{ nodeId: 'unsafe', label: 'Unsafe' }], {
    getOwnPropertyDescriptor(target, key) {
      if (key === '0') throw new Error('hostile path entry');
      return Reflect.getOwnPropertyDescriptor(target, key);
    },
  });
  el.path = indexTrap;
  expect(el.path).to.deep.equal([]);

  let accessorReads = 0;
  const accessorPath: unknown[] = [];
  Object.defineProperty(accessorPath, '0', {
    configurable: true,
    enumerable: true,
    get() {
      accessorReads += 1;
      return { nodeId: 'unsafe-accessor', label: 'Unsafe accessor' };
    },
  });
  Object.defineProperty(accessorPath, 'length', { value: 1 });
  el.path = accessorPath as LyraDrilldownNode[];
  expect(el.path).to.deep.equal([]);
  expect(accessorReads).to.equal(0);

  const prototypeTrap = new Proxy({}, {
    getPrototypeOf(): never {
      throw new Error('hostile node prototype');
    },
  });
  const identityTrap = new Proxy(
    { nodeId: 'unsafe-id', label: 'Unsafe id' },
    {
      getOwnPropertyDescriptor(target, key) {
        if (key === 'nodeId') throw new Error('hostile node identity');
        return Reflect.getOwnPropertyDescriptor(target, key);
      },
    }
  );
  const propertyKeysTrap = new Proxy(
    { score: 1 },
    {
      ownKeys(): never {
        throw new Error('hostile property keys');
      },
    }
  );
  const propertyDescriptorTrap = new Proxy(
    { safe: 'kept', unsafe: 'dropped' },
    {
      getOwnPropertyDescriptor(target, key) {
        if (key === 'unsafe') throw new Error('hostile property descriptor');
        return Reflect.getOwnPropertyDescriptor(target, key);
      },
    }
  );
  const mixedProperties: Record<string, unknown> = {
    '': 'empty key',
    ['x'.repeat(257)]: 'oversized key',
    finite: 2,
    infinite: Number.POSITIVE_INFINITY,
    text: 'kept',
    oversized: 'x'.repeat(65_537),
  };
  Object.defineProperty(mixedProperties, 'hidden', {
    enumerable: false,
    value: 'hidden',
  });
  Object.defineProperty(mixedProperties, 'accessor', {
    enumerable: true,
    get() {
      accessorReads += 1;
      return 'unsafe';
    },
  });
  const validNode = {
    nodeId: 'safe-node',
    label: 'Safe node',
    evidence: [
      new Date(),
      { evidenceId: '', title: 'Missing id' },
      { evidenceId: 'page-omitted', title: 'Page omitted', page: Number.NaN },
      { evidenceId: 'kept-evidence', title: 'Kept evidence', page: 3 },
    ],
    documents: [
      new Date(),
      { documentId: ' ', name: 'Bad document id' },
      { documentId: 'kept-document', name: 'Kept document' },
    ],
    entities: [
      new Date(),
      { entityId: '', label: 'Missing id' },
      { entityId: 'keys-trap', label: 'Keys trap', properties: propertyKeysTrap },
      { entityId: 'descriptor-trap', label: 'Descriptor trap', properties: propertyDescriptorTrap },
      { entityId: 'mixed', label: 'Mixed', degree: Number.NaN, properties: mixedProperties },
      { entityId: 'empty-properties', label: 'Empty properties', properties: { infinite: Number.NaN } },
    ],
  };

  el.path = [prototypeTrap, identityTrap, validNode] as unknown as LyraDrilldownNode[];
  el.types = [
    new Date(),
    { id: '', label: 'Missing id' },
    { id: 'circle', label: 'Circle', shape: 'circle' },
    { id: 'square', label: 'Square', shape: 'square', color: 'red' },
    { id: 'diamond', label: 'Diamond', shape: 'diamond' },
    { id: 'other', label: 'Other', shape: 'triangle' },
  ] as unknown as typeof el.types;
  await el.updateComplete;

  expect(el.path).to.have.length(1);
  expect(el.path[0]!.evidence).to.have.length(2);
  expect(Object.hasOwn(el.path[0]!.evidence![0]!, 'page')).to.be.false;
  expect(el.path[0]!.documents).to.have.length(1);
  expect(el.path[0]!.entities).to.have.length(4);
  expect(el.path[0]!.entities![0]!.properties).to.equal(undefined);
  expect(el.path[0]!.entities![1]!.properties).to.deep.equal({ safe: 'kept' });
  expect(el.path[0]!.entities![2]!.properties).to.deep.equal({ finite: 2, text: 'kept' });
  expect(el.path[0]!.entities![3]!.properties).to.equal(undefined);
  expect(accessorReads).to.equal(0);
  expect(el.types.map((type) => type.id)).to.deep.equal(['circle', 'square', 'diamond', 'other']);
  expect(el.types.map((type) => type.shape)).to.deep.equal(['circle', 'square', 'diamond', undefined]);

  el.path = {} as unknown as LyraDrilldownNode[];
  expect(el.path).to.deep.equal([]);
});

it("enforces first-valid domain identity uniqueness at every keyed level", async () => {
  const el = (await fixture(
    html`<lr-drilldown-panel></lr-drilldown-panel>`
  )) as LyraDrilldownPanel;
  el.path = [
    {
      nodeId: "node-a",
      label: "First node",
      evidence: [
        { evidenceId: "evidence-a", title: "First evidence" },
        { evidenceId: "evidence-a", title: "Duplicate evidence" },
      ],
      documents: [
        { documentId: "document-a", name: "First document" },
        { documentId: "document-a", name: "Duplicate document" },
      ],
      entities: [
        { entityId: "entity-a", label: "First entity" },
        { entityId: "entity-a", label: "Duplicate entity" },
      ],
    },
    { nodeId: "node-a", label: "Duplicate node" },
  ];
  el.types = [
    { id: "person", label: "Person" },
    { id: "person", label: "Duplicate person" },
  ];
  await el.updateComplete;

  expect(el.path).to.have.length(1);
  expect(el.path[0]!.label).to.equal("First node");
  expect(el.path[0]!.evidence).to.deep.equal([
    { evidenceId: "evidence-a", title: "First evidence" },
  ]);
  expect(el.path[0]!.documents).to.deep.equal([
    { documentId: "document-a", name: "First document" },
  ]);
  expect(el.path[0]!.entities).to.deep.equal([
    { entityId: "entity-a", label: "First entity" },
  ]);
  expect(el.types).to.deep.equal([{ id: "person", label: "Person" }]);
  expect(Object.isFrozen(el.types)).to.equal(true);
  expect(Object.isFrozen(el.types[0])).to.equal(true);
});

it('renders a "no item selected" empty state and no breadcrumb when path is empty', async () => {
  const el = (await fixture(
    html`<lr-drilldown-panel></lr-drilldown-panel>`
  )) as LyraDrilldownPanel;
  const empty = el.shadowRoot!.querySelector('[part="empty"]');
  expect(empty != null).to.equal(true);
  expect(empty!.getAttribute("heading")).to.equal("No item selected");
  expect(el.shadowRoot!.querySelector("lr-breadcrumb") == null).to.be.true;
});

it("renders the noData empty state when the current node has no content in any category", async () => {
  const el = (await fixture(
    html`<lr-drilldown-panel></lr-drilldown-panel>`
  )) as LyraDrilldownPanel;
  el.path = [{ nodeId: "datum-3", label: "Empty datum" }];
  await el.updateComplete;
  const empty = el.shadowRoot!.querySelector('[part="empty"]');
  expect(empty != null).to.equal(true);
  expect(empty!.getAttribute("heading")).to.equal("No data");
  // The breadcrumb still renders -- only the content area is empty.
  expect(el.shadowRoot!.querySelector("lr-breadcrumb")).to.exist;
});

it("renders one lr-breadcrumb-item per path node, marking only the last as current", async () => {
  const el = await populated();
  const items = el.shadowRoot!.querySelectorAll("lr-breadcrumb-item");
  expect(items.length).to.equal(2);
  expect(items[0].hasAttribute("current")).to.be.false;
  expect(items[1].hasAttribute("current")).to.be.true;
  expect(items[0].textContent!.trim()).to.equal("Q3 revenue anomaly");
  expect(items[1].textContent!.trim()).to.equal("EMEA region");
});

it("renders a clickable button for every non-current step and plain text (no button) for the current step", async () => {
  const el = await populated();
  const items = el.shadowRoot!.querySelectorAll("lr-breadcrumb-item");
  expect(items[0].shadowRoot!.querySelector('button[part~="base"]')).to.exist;
  expect(items[0].getAttribute("exportparts")).to.equal(
    "base: breadcrumb-button"
  );
  expect(items[1].shadowRoot!.querySelector('button[part~="base"]') == null).to
    .be.true;
});

it("fires lr-drilldown-navigate with the step's nodeId/index when a non-current breadcrumb button is activated", async () => {
  const el = await populated();
  const first = el.shadowRoot!.querySelector("lr-breadcrumb-item")!;
  const button = first.shadowRoot!.querySelector(
    'button[part~="base"]'
  ) as HTMLButtonElement;
  const listener = oneEvent(el, "lr-drilldown-navigate");
  button.click();
  const event = await listener;
  expect(event.detail).to.deep.equal({ nodeId: "datum-1", index: 0 });
  expect(Object.isFrozen(event.detail)).to.equal(true);
  // Controlled component: the panel never mutates `path` itself in response.
  expect(el.path).to.deep.equal([nodeWithEvidenceOnly, nodeWithAllCategories]);
});

it("renders a single category directly with no lr-tab-group chrome when only one category has content", async () => {
  const el = (await fixture(
    html`<lr-drilldown-panel></lr-drilldown-panel>`
  )) as LyraDrilldownPanel;
  el.path = [nodeWithEvidenceOnly];
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector("lr-tab-group") == null).to.be.true;
  const category = el.shadowRoot!.querySelector('[part="category"]');
  expect(category != null).to.equal(true);
  expect(category!.getAttribute("aria-label")).to.equal("Sources");
  expect(category!.querySelector("lr-source-card")).to.exist;
});

it("keeps a present host aria-label when categories shrink to a single region", async () => {
  const el = (await fixture(
    html`<lr-drilldown-panel aria-label="Related content"></lr-drilldown-panel>`
  )) as LyraDrilldownPanel;
  el.path = [nodeWithAllCategories];
  await el.updateComplete;

  el.path = [nodeWithEvidenceOnly];
  await el.updateComplete;
  const category =
    el.shadowRoot!.querySelector<HTMLElement>('[part="category"]')!;
  expect(category.getAttribute("aria-label")).to.equal("Related content");

  el.setAttribute("aria-label", "");
  await el.updateComplete;
  expect(category.hasAttribute("aria-label")).to.equal(true);
  expect(category.getAttribute("aria-label")).to.equal("");

  el.removeAttribute("aria-label");
  await el.updateComplete;
  expect(category.getAttribute("aria-label")).to.equal("Sources");

  el.accessibleLabel = "Programmatic content";
  await el.updateComplete;
  expect(category.getAttribute("aria-label")).to.equal("Programmatic content");

  el.path = [nodeWithAllCategories];
  await el.updateComplete;
  const tabs = el.shadowRoot!.querySelector("lr-tab-group") as LyraTabGroup;
  expect(tabs.getAttribute("aria-label")).to.equal("Programmatic content");
  await tabs.updateComplete;
  const tablist = tabs.shadowRoot!.querySelector('[role="tablist"]')!;
  expect(tablist.getAttribute("aria-label")).to.equal("Programmatic content");

  el.accessibleLabel = "";
  await el.updateComplete;
  await tabs.updateComplete;
  expect(tablist.hasAttribute("aria-label")).to.equal(true);
  expect(tablist.getAttribute("aria-label")).to.equal("");

  el.accessibleLabel = null;
  await el.updateComplete;
  await tabs.updateComplete;
  expect(tablist.hasAttribute("aria-label")).to.equal(false);
});

it("wraps content in lr-tab-group, labelled Sources/Documents/Entities, when the current node spans multiple categories", async () => {
  const el = await populated();
  const tabs = el.shadowRoot!.querySelector("lr-tab-group") as LyraTabGroup;
  expect(tabs).to.exist;
  await waitForTabCount(tabs, 3);
  expect(tabLabels(tabs)).to.deep.equal(["Sources", "Documents", "Entities"]);
});

it("keeps category selection controlled, freezes its request detail, and mounts only the active category", async () => {
  const el = await populated();
  const tabs = el.shadowRoot!.querySelector("lr-tab-group") as LyraTabGroup;
  await tabs.updateComplete;
  expect(el.activeCategory).to.equal("");
  expect(el.shadowRoot!.querySelectorAll("lr-source-card")).to.have.length(1);
  expect(el.shadowRoot!.querySelectorAll("lr-document-preview")).to.have.length(
    0
  );
  expect(el.shadowRoot!.querySelectorAll("lr-entity-card")).to.have.length(0);

  let rawShows = 0;
  let rawHides = 0;
  el.addEventListener("lr-tab-show", () => {
    rawShows += 1;
  });
  el.addEventListener("lr-tab-hide", () => {
    rawHides += 1;
  });
  const request = oneEvent(el, "lr-drilldown-category-change");
  const documentTab = [
    ...tabs.shadowRoot!.querySelectorAll<HTMLElement>('[part="tab"]'),
  ].find((button) => button.dataset["slot"] === "documents")!;
  documentTab.click();
  const event = await request;
  expect(event.detail).to.deep.equal({
    nodeId: "datum-2",
    category: "documents",
    previousCategory: "evidence",
  });
  expect(Object.isFrozen(event.detail)).to.equal(true);
  await tabs.updateComplete;
  expect(el.activeCategory).to.equal("");
  expect(tabs.active).to.equal("evidence");
  expect(el.shadowRoot!.querySelectorAll("lr-document-preview")).to.have.length(
    0
  );
  expect(rawShows).to.equal(0);
  expect(rawHides).to.equal(0);

  el.activeCategory = "documents";
  await el.updateComplete;
  await tabs.updateComplete;
  expect(el.getAttribute("active-category")).to.equal("documents");
  expect(el.shadowRoot!.querySelectorAll("lr-source-card")).to.have.length(0);
  expect(el.shadowRoot!.querySelectorAll("lr-document-preview")).to.have.length(
    1
  );
  expect(el.shadowRoot!.querySelectorAll("lr-entity-card")).to.have.length(0);

  el.activeCategory = "foreign" as "documents";
  await el.updateComplete;
  expect(el.activeCategory).to.equal("");
  expect(el.getAttribute("active-category")).to.equal("");
});

it("contains raw repeated child events and emits a correlated frozen drilldown event for the second item", async () => {
  const el = (await fixture(
    html`<lr-drilldown-panel></lr-drilldown-panel>`
  )) as LyraDrilldownPanel;
  el.path = [
    {
      nodeId: "entity-node",
      label: "Entities",
      entities: [
        { entityId: "entity-first", label: "First entity" },
        { entityId: "entity-second", label: "Second entity" },
      ],
    },
  ];
  await el.updateComplete;
  const cards = [
    ...el.shadowRoot!.querySelectorAll<LyraEntityCard>("lr-entity-card"),
  ];
  await Promise.all(cards.map((card) => card.updateComplete));
  let rawSelects = 0;
  el.addEventListener("lr-entity-select", () => {
    rawSelects += 1;
  });
  const translated = oneEvent(el, "lr-drilldown-entity-activate");
  cards[1]!.shadowRoot!.querySelector<HTMLElement>("lr-button")!.click();
  const event = await translated;
  expect(rawSelects).to.equal(0);
  expect(event.detail).to.deep.equal({
    nodeId: "entity-node",
    entityId: "entity-second",
  });
  expect(Object.isFrozen(event.detail)).to.equal(true);
});

it("translates the entity-card gesture exactly once, with no raw lr-entity-select escaping", async () => {
  const el = (await fixture(
    html`<lr-drilldown-panel></lr-drilldown-panel>`
  )) as LyraDrilldownPanel;
  el.path = [
    {
      nodeId: "entity-node",
      label: "Entities",
      entities: [{ entityId: "entity-first", label: "First entity" }],
    },
  ];
  await el.updateComplete;
  const card = el.shadowRoot!.querySelector<LyraEntityCard>(
    "lr-entity-card"
  )!;
  await card.updateComplete;
  let rawSelects = 0;
  let translations = 0;
  el.addEventListener("lr-entity-select", () => {
    rawSelects += 1;
  });
  el.addEventListener("lr-drilldown-entity-activate", () => {
    translations += 1;
  });
  card.shadowRoot!.querySelector<HTMLElement>("lr-button")!.click();
  expect(rawSelects).to.equal(0);
  expect(translations).to.equal(1);
});

it("translates every owned evidence/document event with authoritative node and item identities", async () => {
  const renderError = new Error("preview failed");
  const el = (await fixture(
    html`<lr-drilldown-panel></lr-drilldown-panel>`
  )) as LyraDrilldownPanel;
  el.path = [
    {
      nodeId: "event-node",
      label: "Event node",
      evidence: [
        { evidenceId: "evidence-first", title: "First" },
        {
          evidenceId: "evidence-second",
          title: "Second",
          href: "https://example.test/evidence",
        },
      ],
      documents: [
        { documentId: "document-first", name: "First.pdf" },
        { documentId: "document-second", name: "Second.pdf" },
      ],
    },
  ];
  await el.updateComplete;
  const evidence = el.shadowRoot!.querySelectorAll("lr-source-card")[1]!;

  let rawExpand = 0;
  el.addEventListener("lr-expand", () => {
    rawExpand += 1;
  });
  const expand = oneEvent(el, "lr-drilldown-evidence-expand");
  evidence.dispatchEvent(
    new CustomEvent("lr-expand", {
      bubbles: true,
      composed: true,
      detail: { sourceId: "spoofed", expanded: true },
    })
  );
  expect((await expand).detail).to.deep.equal({
    nodeId: "event-node",
    evidenceId: "evidence-second",
    expanded: true,
  });
  expect(rawExpand).to.equal(0);

  const open = oneEvent(el, "lr-drilldown-evidence-open");
  evidence.dispatchEvent(
    new CustomEvent("lr-open", {
      bubbles: true,
      composed: true,
      detail: { sourceId: "spoofed", href: "https://attacker.invalid" },
    })
  );
  expect((await open).detail).to.deep.equal({
    nodeId: "event-node",
    evidenceId: "evidence-second",
    href: "https://example.test/evidence",
  });

  el.activeCategory = "documents";
  await el.updateComplete;
  const preview = el.shadowRoot!.querySelectorAll("lr-document-preview")[1]!;
  const download = oneEvent(el, "lr-drilldown-document-download");
  preview.dispatchEvent(
    new CustomEvent("lr-download", {
      bubbles: true,
      composed: true,
      detail: {
        src: "https://example.test/second.pdf",
        filename: "Second.pdf",
      },
    })
  );
  expect((await download).detail).to.deep.equal({
    nodeId: "event-node",
    documentId: "document-second",
    src: "https://example.test/second.pdf",
    filename: "Second.pdf",
  });

  const error = oneEvent(el, "lr-drilldown-document-render-error");
  preview.dispatchEvent(
    new CustomEvent("lr-render-error", {
      bubbles: true,
      composed: true,
      detail: { error: renderError },
    })
  );
  expect((await error).detail).to.deep.equal({
    nodeId: "event-node",
    documentId: "document-second",
    error: renderError,
  });

  const highlight = oneEvent(el, "lr-drilldown-document-highlight-activate");
  preview.dispatchEvent(
    new CustomEvent("lr-highlight-activate", {
      bubbles: true,
      composed: true,
      detail: { highlightId: "highlight-second" },
    })
  );
  expect((await highlight).detail).to.deep.equal({
    nodeId: "event-node",
    documentId: "document-second",
    highlightId: "highlight-second",
  });
});

it("renders lr-source-card per evidence item with source-id/title/page/href and excerpt/full slots mapped field-for-field", async () => {
  const el = (await fixture(
    html`<lr-drilldown-panel></lr-drilldown-panel>`
  )) as LyraDrilldownPanel;
  el.path = [nodeWithEvidenceOnly];
  await el.updateComplete;
  const card = el.shadowRoot!.querySelector("lr-source-card") as LyraSourceCard;
  expect(card.sourceId).to.equal("evidence-1");
  expect(card.title).to.equal("annual_report.pdf");
  expect(card.page).to.equal(12);
  expect(card.href).to.equal("https://example.com/report.pdf");
  expect(card.querySelector('[slot="excerpt"]')!.textContent).to.equal(
    "Revenue grew 12%…"
  );
  expect(card.querySelector('[slot="full"]')!.textContent).to.equal(
    "Revenue grew 12% year over year, driven by…"
  );
});

it("renders lr-document-preview per normalized LyraDrilldownDocument", async () => {
  const el = await populated();
  el.activeCategory = "documents";
  await el.updateComplete;
  const preview = el.shadowRoot!.querySelector(
    "lr-document-preview"
  ) as LyraDocumentPreview;
  expect(preview.src).to.equal("https://example.com/contract.pdf");
  expect(preview.mimeType).to.equal("application/pdf");
  expect(preview.filename).to.equal("contract.pdf");
});

it("renders lr-entity-card per entity with entity/types/communityLabel/showFocusButton forwarded", async () => {
  const el = await populated();
  el.activeCategory = "entities";
  el.types = [{ id: "person", label: "Person" }];
  el.communityLabel = "Nobel laureates";
  el.showFocusButton = false;
  await el.updateComplete;
  const card = el.shadowRoot!.querySelector("lr-entity-card") as LyraEntityCard;
  expect(card.entity).to.deep.equal({
    id: "entity-1",
    label: "Marie Curie",
    type: "person",
  });
  expect(card.types).to.deep.equal([{ id: "person", label: "Person" }]);
  expect(card.communityLabel).to.equal("Nobel laureates");
  expect(card.showFocusButton).to.be.false;
});

it("pages a 1k-document category truthfully and keeps fetch concurrency, replacement, and disconnect ownership bounded", async () => {
  const originalFetch = window.fetch;
  const signals: AbortSignal[] = [];
  let live = 0;
  let peak = 0;
  window.fetch = ((_input: RequestInfo | URL, init?: RequestInit) =>
    new Promise<Response>((_resolve, reject) => {
      const signal = init?.signal;
      if (!signal) {
        reject(new Error("missing AbortSignal"));
        return;
      }
      signals.push(signal);
      live += 1;
      peak = Math.max(peak, live);
      const abort = (): void => {
        live -= 1;
        reject(new DOMException("Aborted", "AbortError"));
      };
      if (signal.aborted) abort();
      else signal.addEventListener("abort", abort, { once: true });
    })) as typeof window.fetch;

  try {
    const el = (await fixture(
      html`<lr-drilldown-panel></lr-drilldown-panel>`
    )) as LyraDrilldownPanel;
    el.activeCategory = "documents";
    el.path = [
      {
        nodeId: "large-node",
        label: "Large node",
        evidence: [{ evidenceId: "fallback", title: "Fallback evidence" }],
        documents: textDocuments(1_000, "large"),
      },
    ];
    await el.updateComplete;
    await waitUntil(
      () => signals.length === 8,
      "the first bounded document page did not start"
    );
    expect(el.path[0]!.documents).to.have.length(1_000);
    expect(
      el.shadowRoot!.querySelectorAll("lr-document-preview")
    ).to.have.length(8);
    expect(
      el
        .shadowRoot!.querySelector('[part="pagination-summary"]')!
        .textContent!.replace(/\s+/g, " ")
        .trim()
    ).to.equal("1–8 of 1,000 Documents");
    expect(peak).to.equal(8);

    const firstSignals = signals.slice();
    el.shadowRoot!.querySelector<HTMLElement>('[part="next-button"]')!.click();
    await el.updateComplete;
    await waitUntil(
      () => signals.length === 16,
      "the second bounded document page did not start"
    );
    expect(firstSignals.every((signal) => signal.aborted)).to.equal(true);
    expect(
      el
        .shadowRoot!.querySelector('[part="pagination-summary"]')!
        .textContent!.replace(/\s+/g, " ")
        .trim()
    ).to.equal("9–16 of 1,000 Documents");
    expect(peak).to.be.at.most(8);

    const secondSignals = signals.slice(8);
    el.path = [
      {
        nodeId: "replacement-node",
        label: "Replacement",
        evidence: [
          { evidenceId: "replacement-evidence", title: "Replacement evidence" },
        ],
        documents: textDocuments(80, "replacement"),
      },
    ];
    await el.updateComplete;
    await waitUntil(
      () => signals.length === 24,
      "replacement previews did not start"
    );
    expect(secondSignals.every((signal) => signal.aborted)).to.equal(true);
    expect(peak).to.be.at.most(8);

    const replacementSignals = signals.slice(16);
    el.activeCategory = "evidence";
    await el.updateComplete;
    await waitUntil(
      () => replacementSignals.every((signal) => signal.aborted),
      "leaving the documents category did not abort its previews"
    );
    expect(
      el.shadowRoot!.querySelectorAll("lr-document-preview")
    ).to.have.length(0);

    el.activeCategory = "documents";
    await el.updateComplete;
    await waitUntil(
      () => signals.length === 32,
      "re-entered previews did not start"
    );
    const disconnectSignals = signals.slice(24);
    el.remove();
    await waitUntil(
      () => disconnectSignals.every((signal) => signal.aborted),
      "disconnect did not abort the active document page"
    );
    expect(live).to.equal(0);
    expect(peak).to.be.at.most(8);
  } finally {
    window.fetch = originalFetch;
  }
});

it("reports category input omitted by the 1k schema ceiling without mounting it", async () => {
  const documents = Array.from({ length: 1_005 }, (_, index) => ({
    documentId: `bounded-${index}`,
    name: `bounded-${index}.pdf`,
    mimeType: "application/pdf",
  }));
  const el = (await fixture(
    html`<lr-drilldown-panel></lr-drilldown-panel>`
  )) as LyraDrilldownPanel;
  el.activeCategory = "documents";
  el.path = [{ nodeId: "bounded-node", label: "Bounded node", documents }];
  await el.updateComplete;

  expect(el.path[0]!.documents).to.have.length(1_000);
  expect(el.shadowRoot!.querySelectorAll("lr-document-preview")).to.have.length(
    8
  );
  expect(
    el
      .shadowRoot!.querySelector('[part="limit"]')!
      .textContent!.replace(/\s+/g, " ")
      .trim()
  ).to.equal("1–1,000 of 1,005 Documents");
});

it('honors the plain show-focus-button="false" attribute form, not just a property binding', async () => {
  const el = (await fixture(
    html`<lr-drilldown-panel show-focus-button="false"></lr-drilldown-panel>`
  )) as LyraDrilldownPanel;
  expect(el.showFocusButton).to.be.false;
  el.path = [nodeWithAllCategories];
  el.activeCategory = "entities";
  await el.updateComplete;
  const card = el.shadowRoot!.querySelector("lr-entity-card") as LyraEntityCard;
  expect(card.showFocusButton).to.be.false;
});

it("shows the Agent runs tab only once content is projected into the runs slot, keyed off the light DOM directly", async () => {
  const el = (await fixture(
    html`<lr-drilldown-panel></lr-drilldown-panel>`
  )) as LyraDrilldownPanel;
  el.path = [nodeWithEvidenceOnly];
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector("lr-tab-group") == null).to.be.true;

  const runContent = document.createElement("div");
  runContent.setAttribute("slot", "runs");
  runContent.textContent = "Run #42 — success";
  el.appendChild(runContent);
  // hasRunsSlot is recomputed by a MutationObserver, which fires asynchronously.
  await new Promise((resolve) => setTimeout(resolve, 0));
  await el.updateComplete;

  const tabs = el.shadowRoot!.querySelector("lr-tab-group") as LyraTabGroup;
  expect(tabs).to.exist;
  await waitForTabCount(tabs, 2);
  expect(tabLabels(tabs)).to.include("Agent runs");
  expect(el.querySelector('[slot="runs"]')!.textContent).to.equal(
    "Run #42 — success"
  );
});

it('detects a slot="runs" attribute toggled on an already-connected child, not just a newly appended one', async () => {
  const el = (await fixture(
    html`<lr-drilldown-panel></lr-drilldown-panel>`
  )) as LyraDrilldownPanel;
  el.path = [nodeWithEvidenceOnly];
  await el.updateComplete;

  const runContent = document.createElement("div");
  runContent.textContent = "Run #99 — success";
  el.appendChild(runContent); // connected, but not slotted into "runs" yet
  await new Promise((resolve) => setTimeout(resolve, 0));
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector("lr-tab-group") == null).to.be.true;

  runContent.setAttribute("slot", "runs"); // toggled on an already-connected child
  await new Promise((resolve) => setTimeout(resolve, 0));
  await el.updateComplete;

  const tabs = el.shadowRoot!.querySelector("lr-tab-group") as LyraTabGroup;
  expect(tabs).to.exist;
  await waitForTabCount(tabs, 2);
  expect(tabLabels(tabs)).to.include("Agent runs");
});

it('renders the runs-only category when the controlled category selects projected content', async () => {
  const el = await fixture<LyraDrilldownPanel>(html`
    <lr-drilldown-panel active-category="runs">
      <div slot="runs">Run details</div>
    </lr-drilldown-panel>
  `);
  el.path = [{ nodeId: 'runs-node', label: 'Runs node' }];
  await waitUntil(
    () => el.shadowRoot!.querySelector('slot[name="runs"]') !== null,
    'the runs-only slot was not rendered'
  );
  await el.updateComplete;

  expect(el.shadowRoot!.querySelectorAll('lr-tab-group')).to.have.length(0);
  expect(el.shadowRoot!.querySelectorAll('slot[name="runs"]')).to.have.length(1);
  expect(el.shadowRoot!.querySelector('[part="category"]')?.getAttribute('role')).to.equal('region');
});

it('operates without a MutationObserver in a detached owner document', async () => {
  const el = await fixture<LyraDrilldownPanel>(html`
    <lr-drilldown-panel></lr-drilldown-panel>
  `);
  el.remove();
  const detachedDocument = document.implementation.createHTMLDocument('drilldown-without-observer');

  try {
    detachedDocument.body.append(detachedDocument.adoptNode(el));
    expect(detachedDocument.defaultView).to.equal(null);
    expect(el.ownerDocument === detachedDocument).to.equal(true);
    expect(el.path).to.deep.equal([]);
  } finally {
    el.remove();
    document.adoptNode(el);
  }
});

it("forwards a host aria-label to the internal lr-tab-group strip by presence", async () => {
  const el = (await fixture(
    html`<lr-drilldown-panel aria-label="Related content"></lr-drilldown-panel>`
  )) as LyraDrilldownPanel;
  el.path = [nodeWithAllCategories];
  await el.updateComplete;
  const tabs = el.shadowRoot!.querySelector("lr-tab-group") as LyraTabGroup;
  expect(tabs.getAttribute("aria-label")).to.equal("Related content");
  await tabs.updateComplete;
  const tablist = tabs.shadowRoot!.querySelector('[role="tablist"]')!;
  expect(tablist.getAttribute("aria-label")).to.equal("Related content");

  el.setAttribute("aria-label", "");
  await el.updateComplete;
  await tabs.updateComplete;
  expect(tabs.hasAttribute("aria-label")).to.equal(true);
  expect(tabs.getAttribute("aria-label")).to.equal("");
  expect(tablist.hasAttribute("aria-label")).to.equal(true);
  expect(tablist.getAttribute("aria-label")).to.equal("");

  el.removeAttribute("aria-label");
  await el.updateComplete;
  await tabs.updateComplete;
  expect(tabs.hasAttribute("aria-label")).to.equal(false);
  expect(tablist.hasAttribute("aria-label")).to.equal(false);
});

it("honors a .strings override of a component-local key (drilldownDocuments) on the documents tab label", async () => {
  const el = (await fixture(
    html`<lr-drilldown-panel></lr-drilldown-panel>`
  )) as LyraDrilldownPanel;
  el.strings = { drilldownDocuments: "Fichiers" };
  el.path = [nodeWithAllCategories];
  await el.updateComplete;
  const tabs = el.shadowRoot!.querySelector("lr-tab-group") as LyraTabGroup;
  await waitForTabCount(tabs, 3);
  expect(tabLabels(tabs)).to.include("Fichiers");
});

it("survives disconnect + reconnect and keeps tracking the runs slot afterward", async () => {
  const el = (await fixture(
    html`<lr-drilldown-panel></lr-drilldown-panel>`
  )) as LyraDrilldownPanel;
  const parent = el.parentElement!;
  parent.removeChild(el);
  parent.appendChild(el);
  el.path = [nodeWithEvidenceOnly];
  await el.updateComplete;

  const runContent = document.createElement("div");
  runContent.setAttribute("slot", "runs");
  runContent.textContent = "Run #7";
  el.appendChild(runContent);
  await new Promise((resolve) => setTimeout(resolve, 0));
  await el.updateComplete;
  const tabs = el.shadowRoot!.querySelector("lr-tab-group") as LyraTabGroup;
  await waitForTabCount(tabs, 2);
  expect(tabLabels(tabs)).to.include("Agent runs");
});

it("recreates its slot observer in the adopted owner realm and disconnects it on adoption", async () => {
  const el = (await fixture(
    html`<lr-drilldown-panel></lr-drilldown-panel>`
  )) as LyraDrilldownPanel;
  await el.updateComplete;
  el.remove();
  const iframe = document.createElement("iframe");
  document.body.append(iframe);
  const frameDocument = iframe.contentDocument;
  const frameWindow = iframe.contentWindow;
  if (!frameDocument || !frameWindow) {
    iframe.remove();
    throw new Error("The iframe realm was unavailable.");
  }
  const originalMutationObserver = frameWindow.MutationObserver;
  let observations = 0;
  let disconnects = 0;
  const callbacks: MutationCallback[] = [];
  const observers: MutationObserver[] = [];
  class OwnerMutationObserver implements MutationObserver {
    private observesPanel = false;
    constructor(callback: MutationCallback) {
      callbacks.push(callback);
      observers.push(this);
    }
    observe(target: Node, options?: MutationObserverInit): void {
      if (target === el && options?.attributeFilter?.includes("slot")) {
        this.observesPanel = true;
        observations += 1;
      }
    }
    takeRecords(): MutationRecord[] {
      return [];
    }
    disconnect(): void {
      if (this.observesPanel) disconnects += 1;
    }
  }
  frameWindow.MutationObserver = OwnerMutationObserver;

  try {
    frameDocument.body.append(frameDocument.adoptNode(el));
    expect(observations, "the destination window observes the panel").to.equal(
      1
    );
    document.adoptNode(el);
    expect(disconnects, "adoption disconnects the previous observer").to.equal(
      1
    );
    callbacks[0]!([], observers[0]!);
    expect(observations, 'a stale owner-realm callback is ignored').to.equal(1);
  } finally {
    frameWindow.MutationObserver = originalMutationObserver;
    if (el.ownerDocument !== document) document.adoptNode(el);
    el.remove();
    iframe.remove();
  }
});

it("can shrink to a 320px allocation with a multi-category tabbed node", async () => {
  const wrapper = await fixture(html`
    <div style="display: flex; inline-size: 320px;">
      <lr-drilldown-panel></lr-drilldown-panel>
    </div>
  `);
  const el = wrapper.querySelector("lr-drilldown-panel") as LyraDrilldownPanel;
  el.path = [nodeWithEvidenceOnly, nodeWithAllCategories];
  await el.updateComplete;

  expect(getComputedStyle(el).minInlineSize).to.equal("0px");
  expect(el.getBoundingClientRect().width).to.be.at.most(320);
  expect(el.shadowRoot!.querySelector("lr-tab-group")).to.exist;
});

it("contains complete unbroken content inside a 319px allocation in LTR and RTL", async () => {
  const long = "unbroken-content-".repeat(100);
  for (const direction of ["ltr", "rtl"] as const) {
    const wrapper = await fixture(html`
      <div dir=${direction} style="display:flex;inline-size:319px;">
        <lr-drilldown-panel></lr-drilldown-panel>
      </div>
    `);
    const el = wrapper.querySelector(
      "lr-drilldown-panel"
    ) as LyraDrilldownPanel;
    el.path = [
      {
        nodeId: "long-parent",
        label: long,
        evidence: [
          {
            evidenceId: "long-evidence",
            title: long,
            excerpt: long,
          },
        ],
      },
      {
        nodeId: "long-current",
        label: long,
        evidence: [
          {
            evidenceId: "long-current-evidence",
            title: long,
            excerpt: long,
          },
        ],
        documents: [
          {
            documentId: "long-document",
            name: `${long}.pdf`,
            mimeType: "application/pdf",
          },
        ],
      },
    ];
    await el.updateComplete;
    await waitForTabCount(
      el.shadowRoot!.querySelector("lr-tab-group") as LyraTabGroup,
      2
    );
    const allocation = wrapper.getBoundingClientRect();
    const bounded = [
      el,
      el.shadowRoot!.querySelector<HTMLElement>('[part="base"]')!,
      el.shadowRoot!.querySelector<HTMLElement>('[part="breadcrumb"]')!,
      el.shadowRoot!.querySelector<HTMLElement>('[part="content"]')!,
      el.shadowRoot!.querySelector<HTMLElement>('[part="tabs"]')!,
      el.shadowRoot!.querySelector<HTMLElement>('[part="category"]')!,
      el.shadowRoot!.querySelector<HTMLElement>("lr-source-card")!,
    ];
    for (const candidate of bounded) {
      const rect = candidate.getBoundingClientRect();
      expect(
        rect.left,
        `${direction} ${candidate.localName} inline start`
      ).to.be.at.least(allocation.left - 1);
      expect(
        rect.right,
        `${direction} ${candidate.localName} inline end`
      ).to.be.at.most(allocation.right + 1);
    }
    expect(
      (el.shadowRoot!.querySelector("lr-source-card") as LyraSourceCard).title
    ).to.equal(long);
  }
});

it('renders correctly under dir="rtl"', async () => {
  const wrapper = await fixture(
    html`<div dir="rtl"><lr-drilldown-panel></lr-drilldown-panel></div>`
  );
  const el = wrapper.querySelector("lr-drilldown-panel") as LyraDrilldownPanel;
  el.path = [nodeWithEvidenceOnly, nodeWithAllCategories];
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector("lr-tab-group")).to.exist;
  await expect(el).to.be.accessible();
});

it("is accessible in the empty (path=[]) state", async () => {
  const el = (await fixture(
    html`<lr-drilldown-panel></lr-drilldown-panel>`
  )) as LyraDrilldownPanel;
  await expect(el).to.be.accessible();
});

it("is accessible in the fully populated, multi-category tabbed state", async () => {
  const el = await populated();
  await expect(el).to.be.accessible();
});

it("ignores a tab-show event naming an unavailable category, reverting the tab strip and emitting no request", async () => {
  const el = await populated();
  const tabs = el.shadowRoot!.querySelector("lr-tab-group") as LyraTabGroup;
  await tabs.updateComplete;
  expect(tabs.active).to.equal("evidence");

  let changeEvents = 0;
  el.addEventListener("lr-drilldown-category-change", () => {
    changeEvents += 1;
  });
  tabs.dispatchEvent(
    new CustomEvent("lr-tab-show", {
      bubbles: true,
      composed: true,
      detail: { name: "not-a-real-category" },
    })
  );
  await tabs.updateComplete;
  expect(changeEvents).to.equal(0);
  expect(tabs.active).to.equal("evidence");
  expect(el.activeCategory).to.equal("");
});

it('ignores a late tab event from the panel detached when the path cleared', async () => {
  const el = await populated();
  const staleTabs = el.shadowRoot!.querySelector('lr-tab-group') as LyraTabGroup;
  let changeEvents = 0;
  el.addEventListener('lr-drilldown-category-change', () => {
    changeEvents += 1;
  });

  el.path = [];
  await el.updateComplete;
  expect(staleTabs.isConnected).to.equal(false);

  staleTabs.dispatchEvent(new CustomEvent('lr-tab-show', {
    bubbles: true,
    composed: true,
    detail: { name: 'documents' },
  }));
  await el.updateComplete;

  expect(changeEvents).to.equal(0);
  expect(el.path).to.deep.equal([]);
});

it("does not emit lr-drilldown-category-change when a tab-show event repeats the already-active category", async () => {
  const el = await populated();
  const tabs = el.shadowRoot!.querySelector("lr-tab-group") as LyraTabGroup;
  await tabs.updateComplete;
  expect(tabs.active).to.equal("evidence");

  let changeEvents = 0;
  el.addEventListener("lr-drilldown-category-change", () => {
    changeEvents += 1;
  });
  tabs.dispatchEvent(
    new CustomEvent("lr-tab-show", {
      bubbles: true,
      composed: true,
      detail: { name: "evidence" },
    })
  );
  await tabs.updateComplete;
  expect(changeEvents).to.equal(0);
  expect(tabs.active).to.equal("evidence");
});

it("omits href from the evidence-open detail when the source evidence item carries none", async () => {
  const el = (await fixture(
    html`<lr-drilldown-panel></lr-drilldown-panel>`
  )) as LyraDrilldownPanel;
  el.path = [
    {
      nodeId: "no-href-node",
      label: "No href node",
      evidence: [{ evidenceId: "no-href-evidence", title: "No href title" }],
    },
  ];
  await el.updateComplete;
  const card = el.shadowRoot!.querySelector("lr-source-card")!;
  const open = oneEvent(el, "lr-drilldown-evidence-open");
  card.dispatchEvent(
    new CustomEvent("lr-open", {
      bubbles: true,
      composed: true,
      detail: { sourceId: "no-href-evidence" },
    })
  );
  const event = await open;
  expect(event.detail).to.deep.equal({
    nodeId: "no-href-node",
    evidenceId: "no-href-evidence",
  });
  expect("href" in event.detail).to.equal(false);
});

it("returns to an earlier page via the previous-page button and resets categoryPage when the current node changes", async () => {
  const el = (await fixture(
    html`<lr-drilldown-panel></lr-drilldown-panel>`
  )) as LyraDrilldownPanel;
  el.activeCategory = "documents";
  el.path = [
    {
      nodeId: "paged-node",
      label: "Paged node",
      documents: Array.from({ length: 20 }, (_, index) => ({
        documentId: `paged-${index}`,
        name: `paged-${index}.txt`,
        mimeType: "text/plain",
      })),
    },
  ];
  await el.updateComplete;

  const summary = () =>
    el
      .shadowRoot!.querySelector('[part="pagination-summary"]')!
      .textContent!.replace(/\s+/g, " ")
      .trim();
  expect(summary()).to.equal("1–8 of 20 Documents");

  el.shadowRoot!.querySelector<HTMLElement>('[part="next-button"]')!.click();
  await el.updateComplete;
  expect(summary()).to.equal("9–16 of 20 Documents");

  el.shadowRoot!
    .querySelector<HTMLElement>('[part="previous-button"]')!
    .click();
  await el.updateComplete;
  expect(summary()).to.equal("1–8 of 20 Documents");

  el.shadowRoot!.querySelector<HTMLElement>('[part="next-button"]')!.click();
  await el.updateComplete;
  expect(summary()).to.equal("9–16 of 20 Documents");

  el.path = [
    {
      nodeId: "other-paged-node",
      label: "Other paged node",
      documents: Array.from({ length: 20 }, (_, index) => ({
        documentId: `other-${index}`,
        name: `other-${index}.txt`,
        mimeType: "text/plain",
      })),
    },
  ];
  await el.updateComplete;
  expect(summary()).to.equal("1–8 of 20 Documents");
});

it("normalizes a string evidence page, a document version, and the full optional entity surface", async () => {
  const el = (await fixture(
    html`<lr-drilldown-panel></lr-drilldown-panel>`
  )) as LyraDrilldownPanel;
  el.path = [
    {
      nodeId: "rich-node",
      label: "Rich node",
      evidence: [
        {
          evidenceId: "string-page-evidence",
          title: "Appendix evidence",
          page: "Appendix B",
        },
      ],
      documents: [
        {
          documentId: "versioned-document",
          name: "versioned.pdf",
          version: "v2.3",
        },
      ],
      entities: [
        {
          entityId: "rich-entity",
          label: "Rich entity",
          description: "Physicist and chemist",
          degree: 3.9,
          communityId: "community-7",
          properties: { affiliation: "Sorbonne", citationCount: 42 },
        },
      ],
    },
  ];
  await el.updateComplete;

  expect(el.path[0]!.evidence![0]!.page).to.equal("Appendix B");
  const sourceCard = el.shadowRoot!.querySelector(
    "lr-source-card"
  ) as LyraSourceCard;
  expect(sourceCard.page).to.equal("Appendix B");

  expect(el.path[0]!.documents![0]!.version).to.equal("v2.3");

  el.activeCategory = "entities";
  await el.updateComplete;
  const entityCard = el.shadowRoot!.querySelector(
    "lr-entity-card"
  ) as LyraEntityCard;
  expect(entityCard.entity).to.deep.equal({
    id: "rich-entity",
    label: "Rich entity",
    description: "Physicist and chemist",
    properties: { affiliation: "Sorbonne", citationCount: 42 },
    degree: 3,
    communityId: "community-7",
  });
});

it("clamps a negative entity degree to zero instead of dropping it", async () => {
  const el = (await fixture(
    html`<lr-drilldown-panel></lr-drilldown-panel>`
  )) as LyraDrilldownPanel;
  el.activeCategory = "entities";
  el.path = [
    {
      nodeId: "negative-degree-node",
      label: "Negative degree node",
      entities: [
        { entityId: "negative-degree-entity", label: "Low degree", degree: -5 },
      ],
    },
  ];
  await el.updateComplete;
  const entityCard = el.shadowRoot!.querySelector(
    "lr-entity-card"
  ) as LyraEntityCard;
  expect(entityCard.entity.degree).to.equal(0);
});
