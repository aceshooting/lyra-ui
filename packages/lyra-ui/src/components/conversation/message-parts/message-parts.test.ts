import { expect, fixture, html, oneEvent } from "@open-wc/testing";
import type {
  CitationSelectEventDetail,
  MessagePart,
} from "../../../ai/types.js";
import "./message-parts.js";
import type {
  LyraMessageParts,
  MessagePartsContentMode,
} from "./message-parts.class.js";
import { ANNOUNCEMENT_SINK_ATTRIBUTE } from "../../../internal/announcer.js";
import { sendKeys } from "@web/test-runner-commands";

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
    metadata: { durationMs: 1_240 },
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

const declaredMessagePartsContentModes: readonly MessagePartsContentMode[] = [
  "plain",
  "markdown",
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

it("keeps the default tool display as a separate chip and result view", async () => {
  const el = (await fixture(
    html`<lr-message-parts .parts=${[
      {
        id: "call",
        type: "tool-call",
        invocation: {
          id: "call-default",
          name: "search",
          args: { query: "Lyra" },
          status: "success",
        },
      },
      {
        id: "result",
        type: "tool-result",
        invocationId: "call-default",
        name: "search",
        result: { hits: 2 },
      },
    ] satisfies MessagePart[]}></lr-message-parts>`
  )) as LyraMessageParts;
  expect(el.toolDisplay).to.equal("chip");
  expect(el.shadowRoot!.querySelector("lr-tool-call-chip")).to.exist;
  expect(el.shadowRoot!.querySelector("lr-tool-result-view")).to.exist;
  expect(el.shadowRoot!.querySelector("lr-details[part='tool-disclosure']") === null).to.be
    .true;
});

it("pairs a tool call and result in one collapsed disclosure and keeps it open when the result arrives", async () => {
  const call: MessagePart = {
    id: "call-part",
    type: "tool-call",
    metadata: { durationMs: 1_240 },
    invocation: {
      id: "invoke-1",
      name: "search",
      args: { query: "Lyra" },
      status: "running",
    },
  };
  const el = (await fixture(
    html`<lr-message-parts tool-display="disclosure" .parts=${[call]}></lr-message-parts>`
  )) as LyraMessageParts;
  const disclosure = el.shadowRoot!.querySelector("lr-details[part='tool-disclosure']") as
    | (HTMLElement & { open: boolean; updateComplete: Promise<unknown> })
    | null;
  expect(disclosure).to.exist;
  expect(disclosure!.open).to.equal(false);
  const summary = disclosure!.shadowRoot!.querySelector<HTMLElement>("[part='summary']")!;
  expect(summary.getAttribute("aria-expanded")).to.equal("false");
  expect(el.shadowRoot!.querySelector("[part='tool-status']")?.textContent).to.contain(
    "Running"
  );
  expect(el.shadowRoot!.querySelector("[part='tool-duration']")?.textContent).to.contain(
    "1.2s"
  );
  expect(el.shadowRoot!.querySelector("lr-tool-call-chip") === null).to.be.true;
  expect(el.shadowRoot!.querySelector("lr-tool-result-view") === null).to.be.true;

  disclosure!.open = true;
  await disclosure!.updateComplete;
  el.parts = [
    call,
    {
      id: "result-part",
      type: "tool-result",
      invocationId: "invoke-1",
      name: "search",
      result: { hits: 3 },
    },
  ];
  await el.updateComplete;
  const updatedDisclosure = el.shadowRoot!.querySelector(
    "lr-details[part='tool-disclosure']"
  );
  expect(updatedDisclosure === disclosure).to.be.true;
  expect(disclosure!.open).to.equal(true);
  expect(disclosure!.shadowRoot!.querySelector("[part='summary']")?.getAttribute("aria-expanded"))
    .to.equal("true");
  expect(el.shadowRoot!.querySelectorAll("[part~='part'][data-type='tool-result']")).to.have
    .lengthOf(0);
  expect(disclosure!.querySelector("[part='tool-result']")).to.exist;
  expect(disclosure!.querySelector("lr-tool-result-view")).to.exist;
});

it("still pairs built-in tool parts when a renderer delegates them and customizes another part", async () => {
  const rendered: string[] = [];
  const el = (await fixture(
    html`<lr-message-parts
      tool-display="disclosure"
      show-reasoning="false"
      .parts=${[
        { id: "answer", type: "text", text: "Answer" },
        { id: "hidden-reasoning", type: "reasoning", text: "Hidden", state: "complete" },
        {
          id: "delegated-call",
          type: "tool-call",
          invocation: { id: "delegated", name: "lookup", args: {}, status: "success" },
        },
        {
          id: "delegated-result",
          type: "tool-result",
          invocationId: "delegated",
          name: "lookup",
          result: { value: "found" },
        },
      ] satisfies MessagePart[]}
      .renderPart=${(part: MessagePart) => {
        rendered.push(part.id);
        return part.id === "answer" ? html`<span>Custom answer</span>` : undefined;
      }}
    ></lr-message-parts>`
  )) as LyraMessageParts;
  expect(el.shadowRoot!.querySelector("lr-details[part='tool-disclosure']")).to.exist;
  expect(el.shadowRoot!.querySelectorAll("[part~='part'][data-type='tool-result']")).to.have
    .lengthOf(0);
  expect(el.shadowRoot!.textContent).to.contain("Custom answer");
  expect(rendered).to.deep.equal(["answer", "delegated-call", "delegated-result"]);
});

it("keeps explicitly customized call or result renderers visible instead of pairing them away", async () => {
  const el = (await fixture(
    html`<lr-message-parts
      tool-display="disclosure"
      .parts=${[
        {
          id: "custom-call",
          type: "tool-call",
          invocation: { id: "custom-call-id", name: "call", args: {}, status: "success" },
        },
        {
          id: "call-result",
          type: "tool-result",
          invocationId: "custom-call-id",
          name: "call",
          result: { value: "kept" },
        },
        {
          id: "builtin-call",
          type: "tool-call",
          invocation: { id: "custom-result-id", name: "result", args: {}, status: "success" },
        },
        {
          id: "custom-result",
          type: "tool-result",
          invocationId: "custom-result-id",
          name: "result",
          result: { value: "custom" },
        },
      ] satisfies MessagePart[]}
      .renderPart=${(part: MessagePart) => {
        if (part.id === "custom-call") return html`<span part="custom-call">Custom call</span>`;
        if (part.id === "custom-result") return html`<span part="custom-result">Custom result</span>`;
        return undefined;
      }}
    ></lr-message-parts>`
  )) as LyraMessageParts;
  expect(el.shadowRoot!.querySelector("[part='custom-call']")).to.exist;
  expect(el.shadowRoot!.querySelector("[part='custom-result']")).to.exist;
  expect(el.shadowRoot!.querySelector("[part~='part'][data-type='tool-result'] lr-tool-result-view"))
    .to.exist;
  expect(el.shadowRoot!.querySelectorAll("lr-details[part='tool-disclosure']")).to.have.lengthOf(1);
});

it("supports keyboard disclosure and exposes the call header, arguments, and result parts", async () => {
  const el = (await fixture(
    html`<lr-message-parts tool-display="disclosure" .parts=${[
      {
        id: "call",
        type: "tool-call",
        invocation: {
          id: "keyboard-call",
          name: "lookup",
          args: { term: "example" },
          status: "success",
        },
      },
      {
        id: "result",
        type: "tool-result",
        invocationId: "keyboard-call",
        name: "lookup",
        result: { value: "found" },
      },
    ] satisfies MessagePart[]}></lr-message-parts>`
  )) as LyraMessageParts;
  const disclosure = el.shadowRoot!.querySelector("lr-details[part='tool-disclosure']") as
    | (HTMLElement & { open: boolean; updateComplete: Promise<unknown> })
    | null;
  const summary = disclosure!.shadowRoot!.querySelector<HTMLElement>("[part='summary']")!;
  summary.focus();
  await sendKeys({ press: "Enter" });
  await disclosure!.updateComplete;
  expect(disclosure!.open).to.equal(true);
  expect(summary.getAttribute("aria-expanded")).to.equal("true");
  expect(disclosure!.querySelector("[part='tool-header']")).to.exist;
  const argsViewer = disclosure!.querySelector("[part='tool-args'] lr-json-viewer") as
    | (HTMLElement & { updateComplete: Promise<unknown> })
    | null;
  expect(argsViewer).to.exist;
  await argsViewer!.updateComplete;
  expect(argsViewer!.shadowRoot!.textContent).to.contain('"example"');
  expect(disclosure!.querySelector("[part='tool-result']")).to.exist;
});

it("keeps unmatched results visible and renders paired failures inside the disclosure", async () => {
  const el = (await fixture(
    html`<lr-message-parts tool-display="disclosure" .parts=${[
      {
        id: "call",
        type: "tool-call",
        invocation: {
          id: "failed-call",
          name: "lookup",
          args: { term: "example" },
          status: "error",
        },
      },
      {
        id: "failed-result",
        type: "tool-result",
        invocationId: "failed-call",
        name: "lookup",
        error: "Unavailable",
      },
      {
        id: "unmatched-result",
        type: "tool-result",
        invocationId: "missing-call",
        name: "search",
        result: { hits: 1 },
      },
    ] satisfies MessagePart[]}></lr-message-parts>`
  )) as LyraMessageParts;
  const disclosure = el.shadowRoot!.querySelector("lr-details[part='tool-disclosure']")!;
  expect(el.shadowRoot!.querySelectorAll("[part~='part'][data-type='tool-result']")).to.have
    .lengthOf(1);
  const details = disclosure as HTMLElement & { updateComplete: Promise<unknown> };
  details.shadowRoot!.querySelector<HTMLElement>("[part='summary']")!.click();
  await details.updateComplete;
  await el.updateComplete;
  expect(disclosure.querySelector("[part='tool-error']")?.textContent).to.contain("Unavailable");
  expect(el.shadowRoot!.querySelectorAll("lr-tool-result-view")).to.have.lengthOf(1);
});

it("defers argument/result getters and redaction work until a disclosure expands", async () => {
  let argsReads = 0;
  let resultReads = 0;
  const call = {
    id: "call",
    type: "tool-call",
    metadata: { redactedFields: ["args.apiKey", "result.token"] },
    invocation: {
      id: "secret-call",
      name: "request",
      status: "running",
      get args() {
        argsReads += 1;
        return { apiKey: "do-not-show", query: "safe" };
      },
    },
  } as unknown as MessagePart;
  const result = {
    id: "result",
    type: "tool-result",
    invocationId: "secret-call",
    name: "request",
    get result() {
      resultReads += 1;
      return { token: "private-result", ok: true };
    },
  } as unknown as MessagePart;
  const el = (await fixture(
    html`<lr-message-parts tool-display="disclosure"></lr-message-parts>`
  )) as LyraMessageParts;
  const host = el as unknown as {
    openedToolCallIds: Set<string>;
    renderToolDisclosure: (call: MessagePart, result: MessagePart) => unknown;
  };
  const closedDetailsHost = await fixture(html`${host.renderToolDisclosure(call, result)}`);
  expect(argsReads).to.equal(0);
  expect(resultReads).to.equal(0);
  expect(closedDetailsHost.querySelector("lr-details")?.getAttribute("open")).to.not.equal("true");

  host.openedToolCallIds = new Set(["secret-call"]);
  const openedDetailsHost = await fixture(html`${host.renderToolDisclosure(call, result)}`);
  const argsViewer = openedDetailsHost.querySelector("lr-json-viewer") as
    | (HTMLElement & { data: Record<string, unknown>; updateComplete: Promise<unknown> })
    | null;
  expect(argsViewer?.data).to.deep.equal({ apiKey: "Value hidden", query: "safe" });
  expect(JSON.stringify(argsViewer?.data)).to.not.contain("do-not-show");
  await argsViewer!.updateComplete;
  expect(argsViewer!.shadowRoot!.textContent).to.contain('"safe"');
  const resultView = openedDetailsHost.querySelector("[part='tool-result'] lr-tool-result-view") as
    | (HTMLElement & { result: Record<string, unknown> })
    | null;
  expect(resultView?.result).to.deep.equal({ token: "Value hidden", ok: true });
  expect(JSON.stringify(resultView?.result)).to.not.contain("private-result");
  expect(argsReads).to.equal(1);
  expect(resultReads).to.equal(1);
});

it("renders a paired success result even when its explicitly present value is undefined", async () => {
  const el = (await fixture(
    html`<lr-message-parts tool-display="disclosure" .parts=${[
      {
        id: "call",
        type: "tool-call",
        invocation: { id: "empty-success", name: "lookup", args: {}, status: "success" },
      },
      {
        id: "result",
        type: "tool-result",
        invocationId: "empty-success",
        name: "lookup",
        result: undefined,
      },
    ] satisfies MessagePart[]}></lr-message-parts>`
  )) as LyraMessageParts;
  const disclosure = el.shadowRoot!.querySelector("lr-details[part='tool-disclosure']")!;
  disclosure.shadowRoot!.querySelector<HTMLElement>("[part='summary']")!.click();
  await (disclosure as HTMLElement & { updateComplete: Promise<unknown> }).updateComplete;
  await el.updateComplete;
  expect(disclosure.querySelector("[part='tool-result'] lr-tool-result-view")).to.exist;
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

it("renders every part with no ceiling by default, even a very large count", async () => {
  const source: MessagePart[] = Array.from(
    { length: 800 },
    (_, index): MessagePart => ({
      id: `text-${index}`,
      type: "text",
      text: `Chunk ${index}`,
    })
  );
  const el = (await fixture(
    html`<lr-message-parts .parts=${source}></lr-message-parts>`
  )) as LyraMessageParts;
  expect(el.maxRenderedParts).to.equal(0);
  expect(
    el.shadowRoot!.querySelectorAll('[part~="part"]')
  ).to.have.lengthOf(800);
});

it("windows to the newest N parts once max-rendered-parts opts in, keeping citation ranks stable against the full sequence", async () => {
  const source: MessagePart[] = Array.from(
    { length: 10 },
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
  const el = (await fixture(
    html`<lr-message-parts
      .parts=${source}
      max-rendered-parts="4"
    ></lr-message-parts>`
  )) as LyraMessageParts;
  expect(el.maxRenderedParts).to.equal(4);
  const rendered = el.shadowRoot!.querySelectorAll('[part~="part"]');
  expect(rendered).to.have.lengthOf(4);
  // Newest 4 of 10 parts (indices 6..9), oldest 6 dropped.
  expect(
    Array.from(rendered, (node) => node.getAttribute("data-type"))
  ).to.deep.equal(["text", "citation", "text", "citation"]);
  const badge = el.shadowRoot!.querySelector(
    "lr-citation-badge"
  ) as HTMLElement & { index: number };
  // Rank 4 in the full 10-part sequence (citations at index 1,3,5,7,9), not renumbered
  // to 1 just because earlier citations were windowed out of view.
  expect(badge.index).to.equal(4);
});

it("treats an explicit 0 the same as the unset default -- renders every part", async () => {
  const source: MessagePart[] = Array.from(
    { length: 12 },
    (_, index): MessagePart => ({
      id: `text-${index}`,
      type: "text",
      text: `Chunk ${index}`,
    })
  );
  const el = (await fixture(
    html`<lr-message-parts
      .parts=${source}
      max-rendered-parts="0"
    ></lr-message-parts>`
  )) as LyraMessageParts;
  expect(
    el.shadowRoot!.querySelectorAll('[part~="part"]')
  ).to.have.lengthOf(12);
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

it("a renderPart override for an interactive part type fully replaces its built-in affordance, per its documented contract", async () => {
  const el = (await fixture(html`<lr-message-parts
    .parts=${[parts[8]!]}
    .renderPart=${(part: MessagePart) =>
      part.type === "error" ? html`<em>Custom error</em>` : undefined}
  ></lr-message-parts>`)) as LyraMessageParts;
  // The built-in `error` renderer would have produced a retry `lr-button` (part="retry") wired to
  // emit `lr-part-retry`; a defined renderPart return replaces it entirely, so neither exists.
  expect(el.shadowRoot!.querySelectorAll("em")).to.have.lengthOf(1);
  expect(el.shadowRoot!.querySelectorAll("lr-button")).to.have.lengthOf(0);
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

it("canonicalizes unsupported content modes to reflected markdown across direct, attribute, and lifecycle writes", async () => {
  expect(declaredMessagePartsContentModes).to.deep.equal(["plain", "markdown"]);

  const el = (await fixture(html`
    <lr-message-parts
      .parts=${[
        { id: "answer", type: "text", text: "**Markdown remains active**" },
      ]}
    ></lr-message-parts>
  `)) as LyraMessageParts;
  el.setAttribute("content-mode", "unsupported-attribute-mode");
  await el.updateComplete;

  expect(el.contentMode).to.equal("markdown");
  expect(el.getAttribute("content-mode")).to.equal("markdown");
  expect(el.shadowRoot!.querySelectorAll("lr-markdown")).to.have.lengthOf(1);

  (el as unknown as { contentMode: unknown }).contentMode =
    "unsupported-direct-mode";
  await el.updateComplete;

  expect(el.contentMode).to.equal("markdown");
  expect(el.getAttribute("content-mode")).to.equal("markdown");
  expect(el.shadowRoot!.querySelectorAll("lr-markdown")).to.have.lengthOf(1);

  const lifecycle = document.createElement(
    "lr-message-parts"
  ) as LyraMessageParts;
  try {
    lifecycle.setAttribute("content-mode", "unsupported-preconnect-mode");
    expect(lifecycle.contentMode).to.equal("markdown");
    expect(lifecycle.getAttribute("content-mode")).to.equal("markdown");

    document.body.append(lifecycle);
    await lifecycle.updateComplete;
    expect(lifecycle.contentMode).to.equal("markdown");
    expect(lifecycle.getAttribute("content-mode")).to.equal("markdown");

    lifecycle.remove();
    lifecycle.setAttribute("content-mode", "unsupported-reconnect-mode");
    document.body.append(lifecycle);
    await lifecycle.updateComplete;

    expect(lifecycle.contentMode).to.equal("markdown");
    expect(lifecycle.getAttribute("content-mode")).to.equal("markdown");
  } finally {
    lifecycle.remove();
  }
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
  const retried = oneEvent(el, "lr-part-retry");
  retry.click();
  expect((await retried).detail.part).to.deep.equal(parts[8]);
});

it("keeps an unbroken error message and retry action inside a narrow row", async () => {
  const el = (await fixture(html`
    <lr-message-parts
      style="display:block; inline-size:160px;"
      .parts=${[
        {
          id: "narrow-error",
          type: "error",
          message: "ThisUnbrokenFailureMessageCannotWrapAtOrdinaryWordBoundaries",
          retryable: true,
        },
      ]}
    ></lr-message-parts>
  `)) as LyraMessageParts;
  await el.updateComplete;
  const error = el.shadowRoot!.querySelector('[part~="error"]') as HTMLElement;
  const message = error.querySelector("span") as HTMLSpanElement;
  const retry = error.querySelector('[part="retry"]') as HTMLElement;
  const errorRect = error.getBoundingClientRect();
  const messageRect = message.getBoundingClientRect();
  const retryRect = retry.getBoundingClientRect();

  expect(error.scrollWidth, "the error row must not overflow horizontally").to.be.at.most(
    Math.ceil(errorRect.width) + 1
  );
  expect(messageRect.right, "the message stays inside the row").to.be.at.most(
    errorRect.right + 1
  );
  expect(retryRect.right, "the retry action stays inside the row").to.be.at.most(
    errorRect.right + 1
  );
  expect(retryRect.width, "the retry action remains operable").to.be.greaterThan(0);
});

it("wraps ordinary and unbroken error text without overflowing, and centers retry targets in their enlarged floors", async () => {
  const el = (await fixture(html`
    <lr-message-parts
      style="display:block; inline-size:160px;"
      .parts=${[
        {
          id: "breakable-error",
          type: "error",
          message:
            "A normal error message keeps ordinary words intact before retry moves rows",
          retryable: true,
        },
        {
          id: "unbroken-error",
          type: "error",
          message:
            "ThisUnbrokenFailureMessageStillBreaksOnlyWhenItsTokenCannotFit",
          retryable: true,
        },
      ]}
    ></lr-message-parts>
  `)) as LyraMessageParts;
  await el.updateComplete;

  const rows = [
    ...el.shadowRoot!.querySelectorAll<HTMLElement>('[part~="error"]'),
  ];
  expect(rows).to.have.lengthOf(2);

  for (const row of rows) {
    const message = row.querySelector("span") as HTMLSpanElement | null;
    const retry = row.querySelector<HTMLElement>('[part="retry"]');
    expect(message === null).to.equal(false);
    expect(retry === null).to.equal(false);
    if (!message || !retry) continue;
    await (retry as HTMLElement & { updateComplete?: Promise<unknown> })
      .updateComplete;

    const target =
      retry.shadowRoot?.querySelector<HTMLElement>('[part~="base"]');
    expect(target === null).to.equal(false);
    if (!target) continue;
    const rowRect = row.getBoundingClientRect();
    const messageRect = message.getBoundingClientRect();
    const retryRect = retry.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();

    expect(getComputedStyle(message).overflowWrap).to.equal("break-word");
    expect(row.scrollWidth).to.be.at.most(Math.ceil(rowRect.width) + 1);
    expect(messageRect.right).to.be.at.most(rowRect.right + 1);
    expect(retryRect.right).to.be.at.most(rowRect.right + 1);
    expect(
      Math.abs(
        targetRect.left +
          targetRect.width / 2 -
          (retryRect.left + retryRect.width / 2)
      )
    ).to.be.at.most(1);
    expect(
      Math.abs(
        targetRect.top +
          targetRect.height / 2 -
          (retryRect.top + retryRect.height / 2)
      )
    ).to.be.at.most(1);
  }

  const breakableMessage = rows[0]?.querySelector(
    "span"
  ) as HTMLSpanElement | null;
  const breakableRetry = rows[0]?.querySelector<HTMLElement>('[part="retry"]');
  expect(breakableMessage === null).to.equal(false);
  expect(breakableRetry === null).to.equal(false);
  if (breakableMessage && breakableRetry) {
    expect(breakableMessage.getBoundingClientRect().height).to.be.greaterThan(
      breakableRetry.getBoundingClientRect().height
    );
  }
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
