import { expect, fixture, html, oneEvent } from "@open-wc/testing";
import type {
  CitationSelectEventDetail,
  MessagePart,
} from "../../../ai/types.js";
import "./message-parts.js";
import type { LyraMessageParts } from "./message-parts.class.js";
import { ANNOUNCEMENT_SINK_ATTRIBUTE } from "../../../internal/announcer.js";

function assertiveSinkTexts(doc: Document = document): string[] {
  return Array.from(
    doc.querySelectorAll<HTMLElement>(
      `[${ANNOUNCEMENT_SINK_ATTRIBUTE}="assertive"] > div`
    ),
    (node) => node.textContent ?? ""
  );
}

const parts: MessagePart[] = [
  { id: "text", type: "text", text: "**Answer**", state: "complete" },
  {
    id: "reasoning",
    type: "reasoning",
    text: "Checking sources",
    state: "streaming",
  },
  {
    id: "call",
    type: "tool-call",
    invocation: {
      id: "call-1",
      name: "search",
      args: { query: "Lyra" },
      status: "running",
    },
  },
  {
    id: "result",
    type: "tool-result",
    invocationId: "call-1",
    name: "search",
    result: { hits: 2 },
    state: "complete",
  },
  {
    id: "citation",
    type: "citation",
    citation: {
      id: "cite-1",
      sourceId: "doc-1",
      label: "[1]",
      quote: "Relevant passage",
    },
  },
  {
    id: "attachment",
    type: "attachment",
    document: { id: "doc-1", name: "report.pdf", mimeType: "application/pdf" },
  },
  { id: "data", type: "data", name: "scores", data: { groundedness: 0.9 } },
  { id: "audio", type: "audio", transcript: "Spoken answer" },
  { id: "error", type: "error", message: "Could not finish", retryable: true },
];

it("renders ordered provider-neutral message parts through existing Lyra primitives", async () => {
  const el = (await fixture(
    html`<lr-message-parts .parts=${parts}></lr-message-parts>`
  )) as LyraMessageParts;
  const rendered = el.shadowRoot!.querySelectorAll('[part~="part"]');
  expect(rendered).to.have.lengthOf(parts.length);
  expect(
    Array.from(rendered).map((node) => node.getAttribute("data-type"))
  ).to.deep.equal(parts.map((part) => part.type));
  expect(el.shadowRoot!.querySelectorAll("lr-markdown")).to.have.lengthOf(2);
  expect(el.shadowRoot!.querySelectorAll("lr-thinking-panel")).to.have.lengthOf(
    1
  );
  expect(el.shadowRoot!.querySelectorAll("lr-tool-call-chip")).to.have.lengthOf(
    1
  );
  expect(
    el.shadowRoot!.querySelectorAll("lr-tool-result-view")
  ).to.have.lengthOf(1);
  expect(el.shadowRoot!.querySelectorAll("lr-citation-badge")).to.have.lengthOf(
    1
  );
  expect(
    el.shadowRoot!.querySelectorAll("lr-attachment-chip")
  ).to.have.lengthOf(1);
});

it("forwards streaming state to text and reasoning Markdown until each same-id part completes", async () => {
  const streamingParts: MessagePart[] = [
    { id: "answer", type: "text", text: "**Partial", state: "streaming" },
    {
      id: "thought",
      type: "reasoning",
      text: "Still checking",
      state: "streaming",
    },
  ];
  const el = (await fixture(
    html`<lr-message-parts .parts=${streamingParts}></lr-message-parts>`
  )) as LyraMessageParts;
  type MarkdownHost = HTMLElement & {
    streaming: boolean;
    content: string;
    updateComplete: Promise<boolean>;
  };
  let markdown = Array.from(
    el.shadowRoot!.querySelectorAll("lr-markdown")
  ) as MarkdownHost[];
  await Promise.all(markdown.map((item) => item.updateComplete));
  expect(markdown.map((item) => item.streaming)).to.deep.equal([true, true]);

  el.parts = [
    { id: "answer", type: "text", text: "**Complete**", state: "complete" },
    { id: "thought", type: "reasoning", text: "Checked", state: "complete" },
  ];
  await el.updateComplete;
  markdown = Array.from(
    el.shadowRoot!.querySelectorAll("lr-markdown")
  ) as MarkdownHost[];
  await Promise.all(markdown.map((item) => item.updateComplete));
  expect(markdown.map((item) => item.streaming)).to.deep.equal([false, false]);
  expect(markdown.map((item) => item.content)).to.deep.equal([
    "**Complete**",
    "Checked",
  ]);
});

it("forwards citation activation as a typed citation selection", async () => {
  const el = (await fixture(
    html`<lr-message-parts .parts=${[parts[4]!]}></lr-message-parts>`
  )) as LyraMessageParts;
  let rawLeaked = false;
  el.addEventListener("lr-citation-activate", () => {
    rawLeaked = true;
  });
  const selected = oneEvent(el, "lr-citation-select");
  el.shadowRoot!.querySelector("lr-citation-badge")!.dispatchEvent(
    new CustomEvent("lr-citation-activate", {
      bubbles: true,
      composed: true,
      detail: { index: 1 },
    })
  );
  const event = (await selected) as CustomEvent<CitationSelectEventDetail>;
  expect(event.detail.citation.id).to.equal("cite-1");
  expect(rawLeaked).to.be.false;
});

it("computes citation ranks with at most one pass over a large mixed part list", async () => {
  const source: MessagePart[] = Array.from(
    { length: 400 },
    (_, index): MessagePart =>
      index % 2 === 0
        ? { id: `text-${index}`, type: "text", text: `Chunk ${index}` }
        : {
            id: `citation-${index}`,
            type: "citation",
            citation: {
              id: `cite-${index}`,
              sourceId: `source-${index}`,
              label: `Source ${index}`,
            },
          }
  );
  let prefixSlices = 0;
  const observed = new Proxy(source, {
    get(target, property, receiver) {
      if (property === "slice") {
        return (...args: Parameters<MessagePart[]["slice"]>) => {
          prefixSlices++;
          return target.slice(...args);
        };
      }
      return Reflect.get(target, property, receiver);
    },
  });
  const el = (await fixture(
    html`<lr-message-parts .parts=${observed}></lr-message-parts>`
  )) as LyraMessageParts;
  const badges = Array.from(
    el.shadowRoot!.querySelectorAll("lr-citation-badge")
  ) as Array<HTMLElement & { index: number }>;

  expect(prefixSlices).to.be.at.most(1);
  expect(badges.length).to.equal(200);
  expect([
    badges[0]?.index,
    badges[99]?.index,
    badges[199]?.index,
  ]).to.deep.equal([1, 100, 200]);
});

it("declares and preserves intentional composed child-event passthroughs", async () => {
  const el = (await fixture(
    html`<lr-message-parts .parts=${[parts[1]!]}></lr-message-parts>`
  )) as LyraMessageParts;
  const toggled = oneEvent(el, "lr-toggle");
  el.shadowRoot!.querySelector("lr-thinking-panel")!.dispatchEvent(
    new CustomEvent("lr-toggle", {
      bubbles: true,
      composed: true,
      detail: { expanded: true },
    })
  );
  expect(
    ((await toggled) as CustomEvent<{ expanded: boolean }>).detail
  ).to.deep.equal({ expanded: true });
});

it("passes through the attachment preview request and its cancellation state", async () => {
  const attachmentPart: MessagePart = {
    id: "attachment",
    type: "attachment",
    document: {
      id: "doc-1",
      name: "report.pdf",
      mimeType: "application/pdf",
      uri: "https://example.test/report.pdf",
    },
  };
  const el = (await fixture(
    html`<lr-message-parts .parts=${[attachmentPart]}></lr-message-parts>`
  )) as LyraMessageParts;
  const chip = el.shadowRoot!.querySelector("lr-attachment-chip")!;
  const received = oneEvent(el, "lr-preview-request");
  el.addEventListener("lr-preview-request", (event) => event.preventDefault(), {
    once: true,
  });
  const request = new CustomEvent("lr-preview-request", {
    bubbles: true,
    composed: true,
    cancelable: true,
    detail: {
      attachmentId: "doc-1",
      name: "report.pdf",
      mimeType: "application/pdf",
      src: "https://example.test/report.pdf",
    },
  });

  expect(chip.dispatchEvent(request)).to.be.false;
  expect((await received).detail.attachmentId).to.equal("doc-1");
  expect(request.defaultPrevented).to.be.true;
});

it("supports host rendering overrides without changing the ordered data model", async () => {
  const el = (await fixture(html`<lr-message-parts
    .parts=${parts.slice(0, 2)}
    .renderPart=${(part: MessagePart) =>
      part.type === "reasoning"
        ? html`<strong>Custom reasoning</strong>`
        : undefined}
  ></lr-message-parts>`)) as LyraMessageParts;
  expect(el.shadowRoot!.querySelectorAll("strong")).to.have.lengthOf(1);
  expect(el.shadowRoot!.querySelectorAll("lr-markdown")).to.have.lengthOf(1);
});

it("honors false literals for true-default rendering options", async () => {
  const el = (await fixture(
    html`<lr-message-parts
      content-mode="plain"
      show-reasoning="false"
      .parts=${parts.slice(0, 2)}
    ></lr-message-parts>`
  )) as LyraMessageParts;
  expect(el.contentMode).to.equal("plain");
  expect(el.showReasoning).to.be.false;
  expect(el.shadowRoot!.querySelectorAll("lr-markdown")).to.have.lengthOf(0);
  expect(
    el.shadowRoot!.querySelector('[data-type="text"]')?.textContent
  ).to.contain("Answer");
  expect(
    el.shadowRoot!.querySelectorAll('[data-type="reasoning"]')
  ).to.have.lengthOf(0);
});

it("uses safe public fallbacks for optional part fields and media sources", async () => {
  const widget = {
    type: "stat",
    props: { label: "Fallback widget", value: "1" },
  };
  const fallbackParts: MessagePart[] = [
    { id: "plain-reasoning", type: "reasoning", text: "Plain reasoning" },
    {
      id: "result",
      type: "tool-result",
      invocationId: "missing-result",
      result: null,
    },
    { id: "citation", type: "citation", citation: { id: "bare-citation" } },
    {
      id: "attachment",
      type: "attachment",
      document: { id: "bare-document", name: "Untyped file" },
    },
    { id: "widget", type: "data", widget },
    { id: "unsafe-audio", type: "audio", src: "javascript:alert(1)" },
    {
      id: "safe-audio",
      type: "audio",
      src: " data:audio/wav;base64,UklGRg== ",
      mimeType: "audio/wav",
    },
  ];
  const el = (await fixture(
    html`<lr-message-parts
      content-mode="plain"
      .parts=${fallbackParts}
    ></lr-message-parts>`
  )) as LyraMessageParts;

  const reasoning = el.shadowRoot!.querySelector(
    "lr-thinking-panel"
  ) as HTMLElement;
  const result = el.shadowRoot!.querySelector(
    "lr-tool-result-view"
  ) as HTMLElement & {
    toolName: string;
    result: unknown;
    status: string;
  };
  const citation = el.shadowRoot!.querySelector(
    "lr-citation-badge"
  ) as HTMLElement & {
    sourceId: string;
    label: string;
  };
  const attachment = el.shadowRoot!.querySelector(
    "lr-attachment-chip"
  ) as HTMLElement & {
    attachmentId: string;
    mimeType: string;
    previewSrc: string;
    previewable: boolean;
    status: string;
  };
  const renderer = el.shadowRoot!.querySelector(
    "lr-widget-renderer"
  ) as HTMLElement & {
    document: { version: string; root: unknown } | null;
    updateComplete: Promise<unknown>;
  };

  expect(reasoning.textContent).to.contain("Plain reasoning");
  expect(reasoning.querySelectorAll("lr-markdown")).to.have.lengthOf(0);
  expect([result.toolName, result.result, result.status]).to.deep.equal([
    "",
    null,
    "success",
  ]);
  expect([citation.sourceId, citation.label]).to.deep.equal(["", ""]);
  expect([
    attachment.attachmentId,
    attachment.mimeType,
    attachment.previewSrc,
    attachment.previewable,
    attachment.status,
  ]).to.deep.equal(["bare-document", "", "", false, "success"]);
  expect(renderer.document).to.deep.equal({ version: "2", root: widget });
  await renderer.updateComplete;
  expect(renderer.shadowRoot!.querySelectorAll("lr-stat")).to.have.lengthOf(1);

  const audio = el.shadowRoot!.querySelectorAll('audio[part="audio-control"]');
  expect(audio).to.have.lengthOf(1);
  const source = audio[0]!.querySelector("source")!;
  expect(source.getAttribute("src")).to.equal("data:audio/wav;base64,UklGRg==");
  expect(source.getAttribute("type")).to.equal("audio/wav");
  expect(
    el.shadowRoot!.querySelectorAll('[part="audio-transcript"]')
  ).to.have.lengthOf(0);
});

it("renders discriminated tool failures separately from an optional partial result", async () => {
  const errorPart: MessagePart = {
    id: "failed-result",
    type: "tool-result",
    invocationId: "call-failed",
    name: "search",
    error: "Search timed out",
    result: { partialHits: 1 },
  };
  const el = (await fixture(
    html`<lr-message-parts .parts=${[errorPart]}></lr-message-parts>`
  )) as LyraMessageParts;
  const error = el.shadowRoot!.querySelector(
    '[part="tool-result-error"]'
  ) as HTMLElement;
  const result = error.querySelector("lr-tool-result-view") as HTMLElement & {
    result: unknown;
    status: string;
  };
  expect(error.textContent).to.contain("Search timed out");
  expect(result.result).to.deep.equal({ partialHits: 1 });
  expect(
    result.status,
    "message-parts must leave renderer-owned status at its own default"
  ).to.equal("success");
});

it("uses first-wins identity for duplicate part ids", async () => {
  const duplicates: MessagePart[] = [
    { id: "same", type: "text", text: "first" },
    { id: "same", type: "text", text: "second" },
  ];
  const el = (await fixture(
    html`<lr-message-parts
      content-mode="plain"
      .parts=${duplicates}
    ></lr-message-parts>`
  )) as LyraMessageParts;
  const rendered = el.shadowRoot!.querySelectorAll('[part~="part"]');
  expect(rendered).to.have.lengthOf(1);
  expect(rendered[0]!.textContent?.trim()).to.equal("first");
});

it("drops a tool-call part missing its invocation instead of throwing", async () => {
  const el = (await fixture(
    html`<lr-message-parts content-mode="plain"></lr-message-parts>`
  )) as LyraMessageParts;
  el.parts = [
    { id: "a", type: "text", text: "kept" },
    { id: "b", type: "tool-call" } as unknown as MessagePart,
  ];
  await el.updateComplete;
  expect(el.shadowRoot!.textContent).to.contain("kept");
  expect(el.shadowRoot!.querySelectorAll('[part~="part"]')).to.have.lengthOf(
    1
  );
});

it("drops a citation part missing its citation instead of throwing", async () => {
  const el = (await fixture(
    html`<lr-message-parts content-mode="plain"></lr-message-parts>`
  )) as LyraMessageParts;
  el.parts = [
    { id: "a", type: "text", text: "kept" },
    { id: "c", type: "citation" } as unknown as MessagePart,
  ];
  await el.updateComplete;
  expect(el.shadowRoot!.textContent).to.contain("kept");
  expect(el.shadowRoot!.querySelectorAll('[part~="part"]')).to.have.lengthOf(
    1
  );
});

it("drops an attachment part missing its document instead of throwing", async () => {
  const el = (await fixture(
    html`<lr-message-parts content-mode="plain"></lr-message-parts>`
  )) as LyraMessageParts;
  el.parts = [
    { id: "a", type: "text", text: "kept" },
    { id: "d", type: "attachment" } as unknown as MessagePart,
  ];
  await el.updateComplete;
  expect(el.shadowRoot!.textContent).to.contain("kept");
  expect(el.shadowRoot!.querySelectorAll('[part~="part"]')).to.have.lengthOf(
    1
  );
});

it("applies per-instance strings to retry controls", async () => {
  const el = (await fixture(
    html`<lr-message-parts
      .parts=${[parts[8]!]}
      .strings=${{
        messagePartRetry: "Réessayer cette section",
        retry: "Réessayer",
      }}
    ></lr-message-parts>`
  )) as LyraMessageParts;
  const retry = el.shadowRoot!.querySelector("lr-button") as HTMLElement;
  expect(retry.getAttribute("aria-label")).to.equal("Réessayer cette section");
  expect(retry.textContent?.trim()).to.equal("Réessayer");
});

it("inherits independently rethemeable streaming, transcript, and error state longhands", async () => {
  const wrapper = (await fixture(html`
    <div
      style="
        --lr-message-parts-streaming-color: rgb(1, 2, 3);
        --lr-message-parts-audio-transcript-color: rgb(4, 5, 6);
        --lr-message-parts-error-border-color: rgb(7, 8, 9);
        --lr-message-parts-error-background: rgb(10, 11, 12);
        --lr-message-parts-error-color: rgb(13, 14, 15);
      "
    >
      <lr-message-parts
        .parts=${[parts[1]!, parts[7]!, parts[8]!]}
      ></lr-message-parts>
    </div>
  `)) as HTMLDivElement;
  const el = wrapper.querySelector("lr-message-parts") as LyraMessageParts;
  const streaming = el.shadowRoot!.querySelector(
    '[part~="part-streaming"]'
  ) as HTMLElement;
  const transcript = el.shadowRoot!.querySelector(
    '[part~="audio-transcript"]'
  ) as HTMLElement;
  const error = el.shadowRoot!.querySelector('[part~="error"]') as HTMLElement;

  expect(getComputedStyle(streaming).color).to.equal("rgb(1, 2, 3)");
  expect(getComputedStyle(transcript).color).to.equal("rgb(4, 5, 6)");
  expect(getComputedStyle(error).borderTopColor).to.equal("rgb(7, 8, 9)");
  expect(getComputedStyle(error).backgroundColor).to.equal("rgb(10, 11, 12)");
  expect(getComputedStyle(error).color).to.equal("rgb(13, 14, 15)");
});

it("announces only newly added error parts through the shared assertive light-DOM sink", async () => {
  const mountedError: MessagePart = {
    id: "old-error",
    type: "error",
    message: "Earlier failure",
  };
  const freshError: MessagePart = {
    id: "new-error",
    type: "error",
    message: "Fresh failure",
  };
  const el = (await fixture(
    html`<lr-message-parts .parts=${[mountedError]}></lr-message-parts>`
  )) as LyraMessageParts;
  expect(
    assertiveSinkTexts(),
    "historical errors present at mount stay silent"
  ).to.deep.equal([]);
  expect(
    el.shadowRoot!.querySelector('[data-type="error"]')!.hasAttribute("role")
  ).to.be.false;

  el.parts = [mountedError, freshError];
  await el.updateComplete;
  expect(assertiveSinkTexts()).to.deep.equal(["Fresh failure"]);

  el.parts = [mountedError];
  await el.updateComplete;
  el.parts = [mountedError, freshError];
  await el.updateComplete;
  expect(assertiveSinkTexts()).to.deep.equal([
    "Fresh failure",
    "Fresh failure",
  ]);

  el.remove();
  expect(
    document.querySelectorAll(`[${ANNOUNCEMENT_SINK_ATTRIBUTE}="assertive"]`)
      .length
  ).to.equal(0);
});

it("treats errors queued while detached as a silent reconnect baseline", async () => {
  const mountedError: MessagePart = {
    id: "old-error",
    type: "error",
    message: "Earlier failure",
  };
  const detachedError: MessagePart = {
    id: "detached-error",
    type: "error",
    message: "Detached failure",
  };
  const connectedError: MessagePart = {
    id: "connected-error",
    type: "error",
    message: "Connected failure",
  };
  const el = (await fixture(
    html`<lr-message-parts .parts=${[mountedError]}></lr-message-parts>`
  )) as LyraMessageParts;
  const parent = el.parentNode!;

  el.remove();
  el.parts = [mountedError, detachedError];
  parent.appendChild(el);
  await el.updateComplete;
  expect(
    assertiveSinkTexts(),
    "detached errors are resting content on reconnect"
  ).to.deep.equal([]);

  el.parts = [mountedError, detachedError, connectedError];
  await el.updateComplete;
  expect(
    assertiveSinkTexts(),
    "the next connected error still announces"
  ).to.deep.equal(["Connected failure"]);
});

it("localizes an added error part that has no caller-supplied message", async () => {
  const el = (await fixture(html`
    <lr-message-parts
      .strings=${{ messagePartError: "Échec de la section" }}
    ></lr-message-parts>
  `)) as LyraMessageParts;
  el.parts = [{ id: "new-error", type: "error", message: "" }];
  await el.updateComplete;
  expect(assertiveSinkTexts()).to.deep.equal(["Échec de la section"]);
});

it("is accessible with populated mixed content", async () => {
  const el = await fixture(
    html`<lr-message-parts .parts=${parts}></lr-message-parts>`
  );
  expect(el.shadowRoot!.querySelectorAll('[part~="part"]')).to.have.lengthOf(
    parts.length
  );
  await expect(el).to.be.accessible();
});

it("applies per-instance localized strings", async () => {
  const el = (await fixture(html`<lr-message-parts
    .strings=${{ messagePartsLabel: "Localized message content" }}
  ></lr-message-parts>`)) as LyraMessageParts;
  expect(
    el.shadowRoot!.querySelector('[part="base"]')!.getAttribute("aria-label")
  ).to.equal("Localized message content");
});

it("preserves an explicitly empty aria-label override by presence", async () => {
  const el = (await fixture(
    html`<lr-message-parts aria-label=""></lr-message-parts>`
  )) as LyraMessageParts;
  expect(
    el.shadowRoot!.querySelector('[part="base"]')!.getAttribute("aria-label")
  ).to.equal("");
});

it("uses one nonempty first-wins part projection for rendering and error announcements", async () => {
  const el = (await fixture(
    html`<lr-message-parts .parts=${[{ id: "baseline", type: "text", text: "ready" }]}></lr-message-parts>`
  )) as LyraMessageParts;

  el.parts = [
    { id: "", type: "error", message: "Empty failure" },
    { id: "duplicate", type: "error", message: "First failure" },
    { id: "duplicate", type: "error", message: "Later failure" },
    { id: "   ", type: "text", text: "Whitespace" },
  ];
  await el.updateComplete;

  const rendered = [...el.shadowRoot!.querySelectorAll<HTMLElement>('[part~="part"]')];
  expect(rendered).to.have.lengthOf(1);
  expect(rendered[0]!.textContent).to.contain("First failure");
  expect(assertiveSinkTexts()).to.deep.equal(["First failure"]);
});
