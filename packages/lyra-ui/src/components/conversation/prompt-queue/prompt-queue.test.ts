import { expect, fixture, html, oneEvent } from "@open-wc/testing";
import type { DocumentRef } from "../../../ai/types.js";
import "./prompt-queue.js";
import type {
  LyraPromptQueue,
  PromptQueueChangeDetail,
  PromptQueueItem,
} from "./prompt-queue.class.js";

const items: PromptQueueItem[] = [
  { id: "one", value: "First follow-up" },
  { id: "two", value: "Second follow-up" },
];

it("renders an editable ordered queue", async () => {
  const el = (await fixture(
    html`<lr-prompt-queue .items=${items}></lr-prompt-queue>`
  )) as LyraPromptQueue;
  expect(el.shadowRoot!.querySelectorAll('[part~="item"]')).to.have.lengthOf(2);
  expect(el.shadowRoot!.querySelectorAll("lr-textarea")).to.have.lengthOf(2);
  expect(
    el.shadowRoot!.querySelector('[part="list"]')?.getAttribute("role")
  ).to.equal("list");
});

it("centers every action target within its retained enlarged hit floor", async () => {
  const el = (await fixture(
    html`<lr-prompt-queue .items=${[items[0]!]}></lr-prompt-queue>`
  )) as LyraPromptQueue;
  const actions = [
    ...el.shadowRoot!.querySelectorAll<HTMLElement>('[part~="action"]'),
  ];
  expect(actions).to.have.lengthOf(4);

  for (const action of actions) {
    await (action as HTMLElement & { updateComplete?: Promise<unknown> })
      .updateComplete;
    const target =
      action.shadowRoot?.querySelector<HTMLElement>('[part~="base"]');
    expect(target === null).to.equal(false);
    if (!target) continue;
    const floor = action.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();

    expect(
      Math.abs(
        targetRect.left + targetRect.width / 2 - (floor.left + floor.width / 2)
      )
    ).to.be.at.most(1);
    expect(
      Math.abs(
        targetRect.top + targetRect.height / 2 - (floor.top + floor.height / 2)
      )
    ).to.be.at.most(1);
  }
});

it("keeps the visible heading separate from an assistive-only region name", async () => {
  const el = (await fixture(html`
    <lr-prompt-queue
      label="Visible queue"
      aria-label="Assistive queue"
    ></lr-prompt-queue>
  `)) as LyraPromptQueue;
  expect(
    el.shadowRoot!.querySelector('[part="heading"]')?.textContent?.trim()
  ).to.equal("Visible queue");
  const base = el.shadowRoot!.querySelector('[part="base"]')!;
  expect(base.getAttribute("aria-label")).to.equal("Assistive queue");

  el.accessibleLabel = "";
  await el.updateComplete;
  expect(base.getAttribute("aria-label")).to.equal("");

  el.accessibleLabel = null;
  await el.updateComplete;
  expect(base.getAttribute("aria-label")).to.equal("Visible queue");
});

it("renders queued attachment names and retains them in send-now detail", async () => {
  const queued: PromptQueueItem[] = [
    {
      id: "attached",
      value: "Summarize this",
      attachments: [
        { id: "report", name: "annual-report.pdf" },
        { id: "notes", name: "notes.txt" },
      ],
    },
  ];
  const el = (await fixture(html`
    <lr-prompt-queue .items=${queued}></lr-prompt-queue>
  `)) as LyraPromptQueue;
  const attachmentList = el.shadowRoot!.querySelector('[part="attachments"]')!;
  expect(attachmentList.getAttribute("aria-label")).to.equal("Attachments");
  expect(
    [...attachmentList.querySelectorAll('[part="attachment"]')].map((item) =>
      item.textContent?.trim()
    )
  ).to.deep.equal(["annual-report.pdf", "notes.txt"]);

  const sent = oneEvent(el, "lr-send-now");
  el.shadowRoot!.querySelector<HTMLElement>('[data-action="send"]')!.click();
  const detail = ((await sent) as CustomEvent<{ item: PromptQueueItem }>)
    .detail;
  expect(
    detail.item.attachments?.map((attachment) => attachment.name)
  ).to.deep.equal(["annual-report.pdf", "notes.txt"]);
});

it("uses first-wins unique nonempty item ids before rendering and mutation", async () => {
  const malformed: PromptQueueItem[] = [
    { id: "same", value: "First" },
    { id: "same", value: "Duplicate" },
    { id: "  ", value: "Empty identity" },
  ];
  const el = (await fixture(html`
    <lr-prompt-queue .items=${malformed}></lr-prompt-queue>
  `)) as LyraPromptQueue;
  const rows = el.shadowRoot!.querySelectorAll('[part~="item"]');
  expect(rows).to.have.lengthOf(1);
  expect(
    (rows[0]?.querySelector("lr-textarea") as HTMLElement & { value: string })
      .value
  ).to.equal("First");

  const removed = oneEvent(el, "lr-queue-change");
  el.shadowRoot!.querySelector<HTMLElement>('[data-action="remove"]')!.click();
  const detail = ((await removed) as CustomEvent<PromptQueueChangeDetail>)
    .detail;
  expect(detail.itemId).to.equal("same");
  expect(detail.items).to.have.lengthOf(0);

  const withMalformedRows = (await fixture(html`
    <lr-prompt-queue .items=${[
      null,
      { value: "Draft" },
      { id: 42 },
      { id: "ok", value: "Fine" },
    ] as never}></lr-prompt-queue>
  `)) as LyraPromptQueue;
  const malformedRows = withMalformedRows.shadowRoot!.querySelectorAll(
    '[part~="item"]'
  );
  expect(malformedRows).to.have.lengthOf(1);
  expect(
    (
      malformedRows[0]?.querySelector("lr-textarea") as HTMLElement & {
        value: string;
      }
    ).value
  ).to.equal("Fine");
});

it("projects prompt and attachment data through own descriptors once, preserving opaque metadata and admitting the first valid duplicate", async () => {
  let unsafeReads = 0;
  const hostile = Object.create(null);
  Object.defineProperty(hostile, "id", {
    configurable: true,
    enumerable: true,
    get(): never {
      unsafeReads += 1;
      throw new Error("prompt projection must not invoke source accessors");
    },
  });
  const invalidFirstDuplicate = Object.create(null);
  Object.defineProperties(invalidFirstDuplicate, {
    id: { configurable: true, enumerable: true, value: "same" },
    value: {
      configurable: true,
      enumerable: true,
      get(): never {
        unsafeReads += 1;
        throw new Error("invalid duplicate value must not reserve its id");
      },
    },
  });
  const opaqueMetadata = () => "retained without inspection";
  const metadata = { opaqueMetadata };
  Object.defineProperty(metadata, "unrelated", {
    configurable: true,
    enumerable: true,
    get(): never {
      unsafeReads += 1;
      throw new Error("opaque metadata must not be inspected");
    },
  });
  const hostileAttachment = Object.create(null);
  Object.defineProperties(hostileAttachment, {
    id: { configurable: true, enumerable: true, value: "hostile-report" },
    name: {
      configurable: true,
      enumerable: true,
      get(): never {
        unsafeReads += 1;
        throw new Error(
          "attachment projection must not invoke source accessors"
        );
      },
    },
  });
  const attachment: DocumentRef = {
    id: "report",
    name: "annual-report.pdf",
    mimeType: "application/pdf",
    uri: "https://example.test/report.pdf",
    version: "v1",
  };
  Object.defineProperty(attachment, "unrelated", {
    configurable: true,
    enumerable: true,
    get(): never {
      unsafeReads += 1;
      throw new Error("attachment projection must not inspect unknown fields");
    },
  });
  const source: PromptQueueItem = {
    id: "same",
    value: "First valid prompt",
    attachments: [hostileAttachment as DocumentRef, attachment],
    createdAt: 42,
    metadata,
  };
  Object.defineProperty(source, "unrelated", {
    configurable: true,
    enumerable: true,
    get(): never {
      unsafeReads += 1;
      throw new Error("prompt projection must not inspect unknown fields");
    },
  });
  const sourceReads = new Map<string, number>();
  const attachmentReads = new Map<string, number>();
  const originalGetOwnPropertyDescriptor = Object.getOwnPropertyDescriptor;
  Object.getOwnPropertyDescriptor = ((target: object, key: PropertyKey) => {
    if (target === source && typeof key === "string") {
      sourceReads.set(key, (sourceReads.get(key) ?? 0) + 1);
    }
    if (target === attachment && typeof key === "string") {
      attachmentReads.set(key, (attachmentReads.get(key) ?? 0) + 1);
    }
    return originalGetOwnPropertyDescriptor.call(Object, target, key);
  }) as typeof Object.getOwnPropertyDescriptor;
  let el: LyraPromptQueue;
  try {
    el = (await fixture(html`
      <lr-prompt-queue
        .items=${[
          hostile,
          invalidFirstDuplicate,
          source,
          { id: "same", value: "Later duplicate" },
        ] as unknown as PromptQueueItem[]}
      ></lr-prompt-queue>
    `)) as LyraPromptQueue;
    await el.updateComplete;
  } finally {
    Object.getOwnPropertyDescriptor = originalGetOwnPropertyDescriptor;
  }

  expect(unsafeReads).to.equal(0);
  expect(el!.items[2] === source).to.equal(true);
  expect(el!.shadowRoot!.querySelectorAll('[part~="item"]')).to.have.lengthOf(
    1
  );
  expect(
    (
      el!.shadowRoot!.querySelector("lr-textarea") as HTMLElement & {
        value: string;
      }
    ).value
  ).to.equal("First valid prompt");
  expect(
    el!.shadowRoot!.querySelector('[part="attachment"]')?.textContent?.trim()
  ).to.equal("annual-report.pdf");
  for (const field of ["id", "value", "attachments", "createdAt", "metadata"]) {
    expect(sourceReads.get(field), field).to.equal(1);
  }
  expect(sourceReads.get("unrelated") ?? 0).to.equal(0);
  for (const field of ["id", "name", "mimeType", "uri", "version"]) {
    expect(attachmentReads.get(field), field).to.equal(1);
  }
  expect(attachmentReads.get("unrelated") ?? 0).to.equal(0);

  Object.defineProperty(source, "value", {
    configurable: true,
    enumerable: true,
    get(): never {
      unsafeReads += 1;
      throw new Error("a cached projection must not reread the source");
    },
  });
  el!.label = "Canonical queue";
  await el!.updateComplete;
  const sent = oneEvent(el!, "lr-send-now");
  el!.shadowRoot!.querySelector<HTMLElement>('[data-action="send"]')!.click();
  const detail = (await sent) as CustomEvent<{ item: PromptQueueItem }>;

  expect(unsafeReads).to.equal(0);
  expect(detail.detail.item.value).to.equal("First valid prompt");
  expect(detail.detail.item.createdAt).to.equal(42);
  expect(
    detail.detail.item.attachments?.map((candidate) => candidate.id)
  ).to.deep.equal(["report"]);
  expect(
    detail.detail.item.attachments?.map((candidate) => candidate.mimeType)
  ).to.deep.equal(["application/pdf"]);
  expect(
    detail.detail.item.attachments?.map((candidate) => candidate.uri)
  ).to.deep.equal(["https://example.test/report.pdf"]);
  expect(
    detail.detail.item.attachments?.map((candidate) => candidate.version)
  ).to.deep.equal(["v1"]);
  expect(detail.detail.item.metadata?.["opaqueMetadata"]).to.equal(
    opaqueMetadata
  );
});

it("keeps opaque metadata by identity without reflecting it through direct queue events", async () => {
  const plainMetadata = { source: "plain" };
  let metadataReflections = 0;
  const hostileMetadata = new Proxy(
    { source: "hostile" },
    {
      ownKeys(): never[] {
        metadataReflections += 1;
        throw new Error("event snapshots must not reflect opaque metadata");
      },
    }
  );
  const el = (await fixture(html`
    <lr-prompt-queue
      .items=${[
        { id: "plain", value: "Plain metadata", metadata: plainMetadata },
        {
          id: "hostile",
          value: "Hostile metadata",
          metadata: hostileMetadata,
        },
      ]}
    ></lr-prompt-queue>
  `)) as LyraPromptQueue;

  const sent = oneEvent(el, "lr-send-now");
  el.shadowRoot!
    .querySelector<HTMLElement>('[data-id="hostile"] [data-action="send"]')!
    .click();
  const sentEvent = (await sent) as CustomEvent<
    { item: PromptQueueItem } | null
  >;
  expect(sentEvent.detail === null).to.equal(false);
  if (sentEvent.detail === null) return;
  expect(sentEvent.detail.item.metadata === hostileMetadata).to.equal(true);

  const changed = oneEvent(el, "lr-queue-change");
  el.shadowRoot!
    .querySelector<HTMLElement>('[data-id="hostile"] lr-textarea')!
    .dispatchEvent(
      new CustomEvent("lr-input", {
        bubbles: true,
        composed: true,
        detail: { value: "Updated hostile metadata" },
      })
    );
  const changedEvent = (await changed) as CustomEvent<
    PromptQueueChangeDetail | null
  >;
  expect(changedEvent.detail === null).to.equal(false);
  if (changedEvent.detail === null) return;
  expect(changedEvent.detail.items[0]?.metadata === plainMetadata).to.equal(
    true
  );
  expect(changedEvent.detail.items[1]?.metadata === hostileMetadata).to.equal(
    true
  );
  expect(metadataReflections).to.equal(0);
});

it("reuses the admitted previous projection during a focused controlled removal", async () => {
  let oldSourceDescriptorReads = 0;
  let rejectOldSourceReads = false;
  const source = new Proxy(
    { id: "first", value: "First prompt" },
    {
      getOwnPropertyDescriptor(target, key): PropertyDescriptor | undefined {
        oldSourceDescriptorReads += 1;
        if (rejectOldSourceReads) {
          throw new Error("a prior controlled row must not be reprojected");
        }
        return Reflect.getOwnPropertyDescriptor(target, key);
      },
    }
  ) as PromptQueueItem;
  const el = (await fixture(html`
    <lr-prompt-queue
      .items=${[source, { id: "second", value: "Second prompt" }]}
    ></lr-prompt-queue>
  `)) as LyraPromptQueue;
  await el.updateComplete;

  const remove = el.shadowRoot!.querySelector<HTMLElement>(
    '[data-id="first"] [data-action="remove"]'
  )!;
  remove.focus();
  oldSourceDescriptorReads = 0;
  el.addEventListener(
    "lr-queue-change",
    (event) => {
      rejectOldSourceReads = true;
      el.items = (event as CustomEvent<PromptQueueChangeDetail>).detail.items;
    },
    { once: true }
  );
  remove.click();
  await el.updateComplete;

  expect(oldSourceDescriptorReads).to.equal(0);
  expect(
    (el.shadowRoot!.activeElement as HTMLElement | null)?.getAttribute(
      "data-action"
    )
  ).to.equal("remove");
  expect(
    (el.shadowRoot!.activeElement as HTMLElement | null)
      ?.closest("[data-id]")
      ?.getAttribute("data-id")
  ).to.equal("second");
});

it("drops malformed item identities while retaining a valid neighboring prompt", async () => {
  const el = (await fixture(html`
    <lr-prompt-queue .items=${[
      null,
      { value: "Missing id" },
      { id: 42, value: "Numeric id" },
      { id: "kept", value: "Fine" },
    ] as unknown as PromptQueueItem[]}></lr-prompt-queue>
  `)) as LyraPromptQueue;

  const rows = el.shadowRoot!.querySelectorAll('[part~="item"]');
  expect(rows).to.have.lengthOf(1);
  expect(
    (rows[0]!.querySelector("lr-textarea") as HTMLElement & { value: string }).value
  ).to.equal("Fine");
});

it("emits the complete reordered value without mutating the controlled items property", async () => {
  const el = (await fixture(
    html`<lr-prompt-queue .items=${items}></lr-prompt-queue>`
  )) as LyraPromptQueue;
  const changed = oneEvent(el, "lr-queue-change");
  (el.shadowRoot!.querySelector('[data-action="down"]') as HTMLElement).click();
  const event = (await changed) as CustomEvent<PromptQueueChangeDetail>;
  expect(event.detail.items.map((item) => item.id)).to.deep.equal([
    "two",
    "one",
  ]);
  expect(el.items.map((item) => item.id)).to.deep.equal(["one", "two"]);
  expect(event.detail.reason).to.equal("reorder");
});

it("emits edit, remove, and send-now requests with stable ids", async () => {
  const el = (await fixture(
    html`<lr-prompt-queue .items=${items}></lr-prompt-queue>`
  )) as LyraPromptQueue;

  const edited = oneEvent(el, "lr-queue-change");
  el.shadowRoot!.querySelector("lr-textarea")!.dispatchEvent(
    new CustomEvent("lr-input", {
      bubbles: true,
      composed: true,
      detail: { value: "Edited" },
    })
  );
  const editEvent = (await edited) as CustomEvent<PromptQueueChangeDetail>;
  expect(editEvent.detail.items[0]?.value).to.equal("Edited");
  expect(editEvent.detail.reason).to.equal("edit");

  const removed = oneEvent(el, "lr-queue-change");
  (
    el.shadowRoot!.querySelector('[data-action="remove"]') as HTMLElement
  ).click();
  const removeEvent = (await removed) as CustomEvent<PromptQueueChangeDetail>;
  expect(removeEvent.detail.items.map((item) => item.id)).to.deep.equal([
    "two",
  ]);
  expect(removeEvent.detail.reason).to.equal("remove");

  const sent = oneEvent(el, "lr-send-now");
  (el.shadowRoot!.querySelector('[data-action="send"]') as HTMLElement).click();
  const sendEvent = (await sent) as CustomEvent<{ item: PromptQueueItem }>;
  expect(sendEvent.detail.item.id).to.equal("one");
});

it("contains native input/change events from its child editors", async () => {
  const wrapper = await fixture(html`<div>
    <lr-prompt-queue .items=${items}></lr-prompt-queue>
  </div>`);
  const el = wrapper.querySelector("lr-prompt-queue") as LyraPromptQueue;
  const editor = el.shadowRoot!.querySelector("lr-textarea")!;
  let inputs = 0;
  let changes = 0;
  wrapper.addEventListener("input", () => inputs++);
  wrapper.addEventListener("change", () => changes++);

  editor.dispatchEvent(
    new InputEvent("input", { bubbles: true, composed: true })
  );
  editor.dispatchEvent(new Event("change", { bubbles: true, composed: true }));

  expect(inputs).to.equal(0);
  expect(changes).to.equal(0);
});

it("contains native focus and blur events relayed by every composed child (editor and row actions) without silencing the child itself", async () => {
  // Three rows so the middle row (index 1) has every action enabled -- the first row's "up" and
  // the last row's "down" are disabled by design, and a disabled lr-button's focus() is a no-op.
  const threeItems: PromptQueueItem[] = [
    { id: "one", value: "First follow-up" },
    { id: "two", value: "Second follow-up" },
    { id: "three", value: "Third follow-up" },
  ];
  const wrapper = await fixture(html`<div>
    <lr-prompt-queue .items=${threeItems}></lr-prompt-queue>
  </div>`);
  const el = wrapper.querySelector("lr-prompt-queue") as LyraPromptQueue;
  const middleRow = el.shadowRoot!.querySelectorAll('[part~="item"]')[1]!;
  const editor = middleRow.querySelector(
    "lr-textarea"
  ) as HTMLElement & { focus(): void; blur(): void };
  const actions = [
    ...middleRow.querySelectorAll<HTMLElement & { focus(): void; blur(): void }>(
      '[data-action]'
    ),
  ];
  const composedChildren = [editor, ...actions];
  expect(composedChildren).to.have.lengthOf(5);

  let leakedFocuses = 0;
  let leakedBlurs = 0;
  wrapper.addEventListener("focus", () => leakedFocuses++);
  wrapper.addEventListener("blur", () => leakedBlurs++);

  for (const child of composedChildren) {
    let childFocuses = 0;
    let childBlurs = 0;
    child.addEventListener("focus", () => childFocuses++);
    child.addEventListener("blur", () => childBlurs++);

    child.focus();
    child.blur();

    expect(childFocuses, `${child.tagName} focus reached itself`).to.equal(1);
    expect(childBlurs, `${child.tagName} blur reached itself`).to.equal(1);
  }

  expect(leakedFocuses, "no focus leaked past the host").to.equal(0);
  expect(leakedBlurs, "no blur leaked past the host").to.equal(0);
});

it("blocks genuine child edits and actions when capture changes state in the same dispatch", async () => {
  const el = (await fixture(html`
    <lr-prompt-queue .items=${items}></lr-prompt-queue>
  `)) as LyraPromptQueue;
  const editor = el.shadowRoot!.querySelector("lr-textarea")!;
  let requests = 0;
  el.addEventListener("lr-queue-change", () => requests++);
  el.addEventListener(
    "lr-input",
    () => {
      el.disabled = true;
    },
    { capture: true, once: true }
  );

  editor.dispatchEvent(
    new CustomEvent("lr-input", {
      bubbles: true,
      composed: true,
      detail: { value: "Blocked edit" },
    })
  );
  expect(el.disabled).to.be.true;
  expect(requests).to.equal(0);

  el.disabled = false;
  await el.updateComplete;
  el.addEventListener(
    "click",
    () => {
      el.disabled = true;
    },
    { capture: true, once: true }
  );
  el.shadowRoot!.querySelector<HTMLElement>('[data-action="remove"]')!.click();
  expect(el.disabled).to.be.true;
  expect(requests).to.equal(0);
});

it("moves focus to the equivalent action on the nearest survivor after controlled removal", async () => {
  const controlledItems: PromptQueueItem[] = [
    { id: "one", value: "First follow-up" },
    { id: "two", value: "Second follow-up" },
    { id: "three", value: "Third follow-up" },
  ];
  const el = (await fixture(
    html`<lr-prompt-queue .items=${controlledItems}></lr-prompt-queue>`
  )) as LyraPromptQueue;
  el.addEventListener("lr-queue-change", (event) => {
    el.items = event.detail.items;
  });
  const removeActions = el.shadowRoot!.querySelectorAll<HTMLElement>(
    '[data-action="remove"]'
  );
  removeActions[1]!.focus();
  removeActions[1]!.click();
  await el.updateComplete;

  const focusedAction = el.shadowRoot!.activeElement as HTMLElement | null;
  expect(focusedAction?.getAttribute("data-action")).to.equal("remove");
  expect(focusedAction?.closest("[data-id]")?.getAttribute("data-id")).to.equal(
    "three"
  );
});

it("uses the nearest enabled action when the equivalent action becomes disabled after removal", async () => {
  const controlledItems: PromptQueueItem[] = [
    { id: "one", value: "First follow-up" },
    { id: "two", value: "Second follow-up" },
    { id: "three", value: "Third follow-up" },
  ];
  const el = (await fixture(
    html`<lr-prompt-queue .items=${controlledItems}></lr-prompt-queue>`
  )) as LyraPromptQueue;
  el.addEventListener("lr-queue-change", (event) => {
    el.items = event.detail.items;
  });
  const middleDown = el.shadowRoot!.querySelectorAll<HTMLElement>(
    '[data-action="down"]'
  )[1]!;
  middleDown.focus();
  el.shadowRoot!.querySelectorAll<HTMLElement>(
    '[data-action="remove"]'
  )[1]!.click();
  await el.updateComplete;

  const focusedAction = el.shadowRoot!.activeElement as HTMLElement | null;
  expect(focusedAction?.getAttribute("data-action")).to.equal("up");
  expect(focusedAction?.closest("[data-id]")?.getAttribute("data-id")).to.equal(
    "three"
  );
});

it("moves focus from an editor to the nearest enabled row action when editable becomes false", async () => {
  const el = (await fixture(
    html`<lr-prompt-queue .items=${items}></lr-prompt-queue>`
  )) as LyraPromptQueue;
  const editor = el.shadowRoot!.querySelector("lr-textarea") as HTMLElement & {
    updateComplete: Promise<unknown>;
  };
  await editor.updateComplete;
  editor.focus();

  el.editable = false;
  await el.updateComplete;

  const focusedAction = el.shadowRoot!.activeElement as HTMLElement | null;
  expect(focusedAction?.getAttribute("data-action")).to.equal("down");
  expect(focusedAction?.closest("[data-id]")?.getAttribute("data-id")).to.equal(
    "one"
  );
});

it("moves focus to the queue region when controlled removal empties the queue", async () => {
  const el = (await fixture(
    html`<lr-prompt-queue .items=${[items[0]!]}></lr-prompt-queue>`
  )) as LyraPromptQueue;
  el.addEventListener("lr-queue-change", (event) => {
    el.items = event.detail.items;
  });
  const removeAction = el.shadowRoot!.querySelector<HTMLElement>(
    '[data-action="remove"]'
  )!;
  removeAction.focus();
  removeAction.click();
  await el.updateComplete;

  expect(el.items).to.have.lengthOf(0);
  expect(el.shadowRoot!.activeElement?.getAttribute("part")).to.equal("base");
});

it("does not steal external focus when a controlled update removes an unfocused row", async () => {
  const wrapper = await fixture(html`
    <div>
      <button id="outside">Outside</button>
      <lr-prompt-queue .items=${items}></lr-prompt-queue>
    </div>
  `);
  const el = wrapper.querySelector("lr-prompt-queue") as LyraPromptQueue;
  wrapper.querySelector<HTMLElement>("#outside")!.focus();
  el.items = [items[1]!];
  await el.updateComplete;

  expect(el.ownerDocument.activeElement?.id).to.equal("outside");
});

it("applies per-instance strings to the queue label", async () => {
  const el = (await fixture(
    html`<lr-prompt-queue
      .items=${items}
      .strings=${{ promptQueueLabel: "Invites en attente" }}
    ></lr-prompt-queue>`
  )) as LyraPromptQueue;
  expect(
    el.shadowRoot!.querySelector('[part="base"]')?.getAttribute("aria-label")
  ).to.equal("Invites en attente");
  expect(
    el.shadowRoot!.querySelector('[part="heading"]')?.textContent?.trim()
  ).to.equal("Invites en attente");
});

it("localizes the editable item label as a whole template with a locale-formatted index", async () => {
  const el = (await fixture(html`
    <lr-prompt-queue
      lang="ar"
      .items=${items}
      .strings=${{ promptQueueItemLabel: "ITEM {index}" }}
    ></lr-prompt-queue>
  `)) as LyraPromptQueue;
  const textarea = el.shadowRoot!.querySelector(
    "lr-textarea"
  ) as HTMLElement & { label: string };
  expect(textarea.label).to.equal(
    `ITEM ${new Intl.NumberFormat("ar").format(1)}`
  );
});

it("gives every repeated action a row-contextual accessible name", async () => {
  const el = (await fixture(
    html`<lr-prompt-queue .items=${items}></lr-prompt-queue>`
  )) as LyraPromptQueue;
  const names = [
    ...el.shadowRoot!.querySelectorAll<HTMLElement>('[data-action="send"]'),
  ].map((button) => button.getAttribute("aria-label"));
  expect(names).to.deep.equal([
    "Send now, queued prompt 1",
    "Send now, queued prompt 2",
  ]);
  expect(new Set(names).size).to.equal(items.length);

  const removeNames = [
    ...el.shadowRoot!.querySelectorAll<HTMLElement>('[data-action="remove"]'),
  ].map((button) => button.getAttribute("aria-label"));
  expect(removeNames).to.deep.equal([
    "Remove, queued prompt 1",
    "Remove, queued prompt 2",
  ]);
});

it('honors editable="false" and is accessible while populated', async () => {
  const el = (await fixture(
    html`<lr-prompt-queue editable="false" .items=${items}></lr-prompt-queue>`
  )) as LyraPromptQueue;
  expect(el.editable).to.be.false;
  expect(el.shadowRoot!.querySelectorAll("lr-textarea")).to.have.lengthOf(0);
  expect(el.shadowRoot!.querySelectorAll('[part="value"]')).to.have.lengthOf(2);
  await expect(el).to.be.accessible();
});

it("applies per-instance localized strings", async () => {
  const el = (await fixture(html`<lr-prompt-queue
    .strings=${{ promptQueueLabel: "Localized prompt backlog" }}
  ></lr-prompt-queue>`)) as LyraPromptQueue;
  expect(
    el.shadowRoot!.querySelector('[part="base"]')!.getAttribute("aria-label")
  ).to.equal("Localized prompt backlog");
});
