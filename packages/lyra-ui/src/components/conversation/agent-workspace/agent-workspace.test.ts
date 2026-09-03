import { expect, fixture, html, oneEvent } from "@open-wc/testing";
import type {
  AgentRun,
  CancelEventDetail,
  ChatMessage,
  RetrievalChunk,
} from "../../../ai/types.js";
import "../../forms/button/button.js";
import "./agent-workspace.js";
import type { LyraAgentWorkspace } from "./agent-workspace.class.js";

const run: AgentRun = {
  id: "run-1",
  status: { kind: "collecting", message: "Gathering sources" },
  startedAt: Date.now() - 1_000,
  model: "lyra-test",
  steps: [
    {
      id: "step-1",
      kind: "retrieval",
      label: "Find sources",
      status: { kind: "running" },
    },
  ],
};

const chunk: RetrievalChunk = {
  id: "chunk-1",
  text: "A retrieved passage.",
  score: 0.93,
  source: { id: "doc-1", name: "Guide.md" },
};

const messages: ChatMessage[] = [
  { id: "message-1", role: "assistant", text: "Hello from the agent." },
];

it("renders an empty conversation and the built-in composer", async () => {
  const el = await fixture<LyraAgentWorkspace>(
    html`<lr-agent-workspace></lr-agent-workspace>`
  );
  expect(el.shadowRoot!.querySelector('[part="messages-empty"]')).to.exist;
  expect(el.shadowRoot!.querySelector("lr-chat-composer")).to.exist;
});

it("uses a plain-frame fallback composer without changing a supplied composer", async () => {
  const fallbackHost = await fixture<LyraAgentWorkspace>(
    html`<lr-agent-workspace></lr-agent-workspace>`
  );
  const fallback = fallbackHost.shadowRoot!.querySelector(
    "lr-chat-composer"
  ) as (HTMLElement & { updateComplete: Promise<unknown> }) | null;
  expect(
    fallback !== null,
    "the built-in composer renders by default"
  ).to.equal(true);
  if (fallback === null) return;

  await fallback.updateComplete;
  expect(fallback.getAttribute("frame")).to.equal("plain");
  const fallbackBase = fallback.shadowRoot!.querySelector(
    '[part="base"]'
  ) as HTMLElement | null;
  expect(
    fallbackBase !== null,
    "the built-in composer exposes its base part"
  ).to.equal(true);
  if (fallbackBase === null) return;
  const fallbackChrome = getComputedStyle(fallbackBase);
  expect(fallbackChrome.borderTopWidth).to.equal("0px");
  expect(fallbackChrome.paddingTop).to.equal("0px");

  const slottedHost = await fixture<LyraAgentWorkspace>(html`
    <lr-agent-workspace>
      <lr-chat-composer slot="composer" frame="card"></lr-chat-composer>
    </lr-agent-workspace>
  `);
  const supplied = slottedHost.querySelector(
    "lr-chat-composer"
  ) as HTMLElement | null;
  expect(
    supplied !== null,
    "the supplied composer remains in the light DOM"
  ).to.equal(true);
  if (supplied === null) return;
  expect(supplied.getAttribute("frame")).to.equal("card");
  const composerSlot = slottedHost.shadowRoot!.querySelector(
    'slot[name="composer"]'
  ) as HTMLSlotElement | null;
  expect(
    composerSlot !== null,
    "the workspace exposes its composer slot"
  ).to.equal(true);
  if (composerSlot === null) return;
  expect(composerSlot.assignedElements().length).to.equal(1);
});

it('clears follow/showDetails/showComposer from plain HTML `="false"` attributes, not just property bindings', async () => {
  const el = await fixture<LyraAgentWorkspace>(html`
    <lr-agent-workspace
      follow="false"
      show-details="false"
      show-composer="false"
      .run=${run}
    ></lr-agent-workspace>
  `);
  expect(el.follow).to.be.false;
  expect(el.showDetails).to.be.false;
  expect(el.showComposer).to.be.false;
  await el.updateComplete;
  const viewport = el.shadowRoot!.querySelector(
    "lr-chat-viewport"
  ) as unknown as { follow: boolean };
  expect(viewport.follow).to.be.false;
  // showDetails=false hides the stable details pane even though `run` alone would otherwise show it.
  expect(
    (el.shadowRoot!.querySelector('[part="details"]') as HTMLElement).hidden
  ).to.be.true;
  expect(el.shadowRoot!.querySelectorAll("lr-chat-composer").length).to.equal(
    0
  );
});

it("still defaults follow/showDetails/showComposer to true with no attribute set", async () => {
  const el = await fixture<LyraAgentWorkspace>(
    html`<lr-agent-workspace></lr-agent-workspace>`
  );
  expect(el.follow).to.be.true;
  expect(el.showDetails).to.be.true;
  expect(el.showComposer).to.be.true;
});

it("uses localized workspace chrome", async () => {
  const el = await fixture<LyraAgentWorkspace>(html`
    <lr-agent-workspace
      .strings=${{ agentWorkspaceLabel: "Assistant panel" }}
    ></lr-agent-workspace>
  `);
  expect(
    el.shadowRoot!.querySelector('[part="heading"]')!.textContent
  ).to.equal("Assistant panel");
});

it("composes transcript and agent details from controlled data", async () => {
  const el = await fixture<LyraAgentWorkspace>(html`
    <lr-agent-workspace
      .messages=${messages}
      .run=${run}
      .tools=${[{ id: "tool-1", name: "search", args: {}, status: "success" }]}
      .retrievalChunks=${[chunk]}
      .groundingAssessment=${{
        supportedClaims: 1,
        unsupportedClaims: 0,
        coverage: 1,
      }}
      .contextSegments=${[
        { id: "context-1", label: "Source", text: "Passage", tokens: 3 },
      ]}
      .metrics=${[{ id: "tokens", label: "Tokens", value: 42 }]}
    ></lr-agent-workspace>
  `);
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector("lr-chat-message")).to.exist;
  expect(el.shadowRoot!.querySelector("lr-agent-run")).to.exist;
  expect(el.shadowRoot!.querySelector("lr-tool-timeline")).to.exist;
  expect(el.shadowRoot!.querySelector("lr-retrieval-results")).to.exist;
  expect(el.shadowRoot!.querySelector("lr-grounding-summary")).to.exist;
  expect(el.shadowRoot!.querySelector("lr-context-inspector")).to.exist;
  expect(el.shadowRoot!.querySelector('[part="details"]')).to.exist;
});

it('forwards retrieval, context-total, and composer state and restores opt-in defaults', async () => {
  const el = await fixture<LyraAgentWorkspace>(html`
    <lr-agent-workspace
      retrieval-loading
      retrieval-has-more
      context-total="4321"
      composer-status="streaming"
      composer-min-rows="3"
      composer-max-rows="6"
      .contextSegments=${[
        { id: 'context-1', label: 'Source', text: 'Passage', tokens: 3 },
      ]}
    ></lr-agent-workspace>
  `);
  const results = el.shadowRoot!.querySelector('lr-retrieval-results') as HTMLElement & {
    loading: boolean;
    hasMore: boolean;
  };
  const inspector = el.shadowRoot!.querySelector('lr-context-inspector') as HTMLElement & {
    total: number;
  };
  const composer = el.shadowRoot!.querySelector('lr-chat-composer') as HTMLElement & {
    status: string;
    minRows: number;
    maxRows: number;
  };

  expect(results.loading).to.equal(true);
  expect(results.hasMore).to.equal(true);
  expect(inspector.total).to.equal(4321);
  expect(el.composerStatus).to.equal('streaming');
  expect(el.composerMinRows).to.equal(3);
  expect(el.composerMaxRows).to.equal(6);
  expect(composer.status).to.equal('streaming');
  expect(composer.minRows).to.equal(3);
  expect(composer.maxRows).to.equal(6);

  el.retrievalLoading = false;
  el.retrievalHasMore = false;
  el.contextSegments = [];
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('lr-retrieval-results') === null).to.be.true;
  expect(el.shadowRoot!.querySelector('lr-context-inspector') === null).to.be.true;

  const unset = await fixture<LyraAgentWorkspace>(
    html`<lr-agent-workspace></lr-agent-workspace>`
  );
  const defaultComposer = unset.shadowRoot!.querySelector('lr-chat-composer') as HTMLElement & {
    status: string;
    minRows: number;
    maxRows: number;
  };
  expect(unset.retrievalLoading).to.equal(false);
  expect(unset.retrievalHasMore).to.equal(false);
  expect(unset.contextTotal).to.equal(0);
  expect(defaultComposer.status).to.equal('idle');
  expect(defaultComposer.minRows).to.equal(1);
  expect(defaultComposer.maxRows).to.equal(8);
});

it('normalizes hostile composer-status without rewriting the workspace host’s authored attribute', async () => {
  const el = await fixture<LyraAgentWorkspace>(
    html`<lr-agent-workspace composer-status="busy"></lr-agent-workspace>`
  );
  const composer = el.shadowRoot!.querySelector('lr-chat-composer') as HTMLElement & {
    status: string;
    updateComplete: Promise<unknown>;
  };
  await composer.updateComplete;

  expect(el.composerStatus).to.equal('idle');
  expect(el.getAttribute('composer-status')).to.equal('busy');
  expect(composer.status).to.equal('idle');
  expect(composer.getAttribute('status')).to.equal('idle');

  (el as unknown as { composerStatus: unknown }).composerStatus = 'busy';
  await el.updateComplete;
  await composer.updateComplete;

  expect(el.composerStatus).to.equal('idle');
  expect(el.getAttribute('composer-status')).to.equal('busy');
  expect(composer.status).to.equal('idle');
});

it('gates built-in detail sections on canonical nonblank collection identities', async () => {
  const el = await fixture<LyraAgentWorkspace>(html`<lr-agent-workspace></lr-agent-workspace>`);
  el.tools = [{ id: ' ', name: 'blank', args: {}, status: 'success' }] as LyraAgentWorkspace['tools'];
  el.retrievalChunks = [{ ...chunk, id: ' ' }, null] as unknown as LyraAgentWorkspace['retrievalChunks'];
  el.citations = [{ id: ' ' }, null] as unknown as LyraAgentWorkspace['citations'];
  el.contextSegments = [{ id: ' ', label: 'blank', text: '', tokens: 0 }] as LyraAgentWorkspace['contextSegments'];
  await el.updateComplete;

  expect(el.shadowRoot!.querySelector('lr-tool-timeline') === null).to.be.true;
  expect(el.shadowRoot!.querySelector('lr-retrieval-results') === null).to.be.true;
  expect(el.shadowRoot!.querySelector('lr-grounding-summary') === null).to.be.true;
  expect(el.shadowRoot!.querySelector('lr-context-inspector') === null).to.be.true;
});

it("forwards caller-supplied retrieval failure text through the child errorText contract", async () => {
  const el = await fixture<LyraAgentWorkspace>(html`
    <lr-agent-workspace
      retrieval-error-text="Retrieval service unavailable"
    ></lr-agent-workspace>
  `);
  const results = el.shadowRoot!.querySelector(
    "lr-retrieval-results"
  ) as HTMLElement & {
    errorText: string;
    updateComplete: Promise<unknown>;
  };
  await results.updateComplete;

  expect(results.errorText).to.equal("Retrieval service unavailable");
  expect(
    results.shadowRoot!.querySelector('[part="error"]')?.textContent
  ).to.equal("Retrieval service unavailable");
});

it("forwards lr-cancel from the built-in agent run carrying that run's own object detail", async () => {
  const el = await fixture<LyraAgentWorkspace>(
    html`<lr-agent-workspace .run=${run}></lr-agent-workspace>`
  );
  await el.updateComplete;
  const agentRun = el.shadowRoot!.querySelector("lr-agent-run");
  expect(
    agentRun === null,
    "the built-in agent run renders when `run` is set"
  ).to.equal(false);

  let detailIsObject = false;
  let reason: string | undefined;
  el.addEventListener("lr-cancel", (event) => {
    detailIsObject = typeof event.detail === "object" && event.detail !== null;
    // `event` is typed straight off `LyraAgentWorkspaceEventMap` via LyraElement's
    // addEventListener overload, so reading `.reason` here is only well-typed while that map
    // declares `CancelEventDetail` rather than `undefined`.
    reason = event.detail.reason;
  });
  // Exactly what <lr-agent-run>'s own Cancel button emits (`emit('lr-cancel', {})`), plus a
  // `reason` the shape allows -- both cross the shadow boundary unchanged.
  agentRun!.dispatchEvent(
    new CustomEvent<CancelEventDetail>("lr-cancel", {
      detail: { reason: "stopped" },
      bubbles: true,
      composed: true,
    })
  );

  expect(detailIsObject).to.equal(true);
  expect(reason).to.equal("stopped");
});

it("renders ordered message parts when present while preserving legacy text messages", async () => {
  const el = await fixture<LyraAgentWorkspace>(html`
    <lr-agent-workspace
      .messages=${[
        {
          id: "parts-message",
          role: "assistant",
          text: "Legacy fallback",
          parts: [
            {
              id: "reasoning",
              type: "reasoning",
              text: "Checking",
              state: "complete",
            },
            {
              id: "answer",
              type: "text",
              text: "Structured answer",
              state: "complete",
            },
          ],
        },
        { id: "legacy-message", role: "assistant", text: "Legacy answer" },
      ]}
    ></lr-agent-workspace>
  `);
  expect(el.shadowRoot!.querySelectorAll("lr-message-parts")).to.have.lengthOf(
    1
  );
  expect(el.shadowRoot!.querySelectorAll("lr-markdown")).to.have.lengthOf(1);
});

it('does not expose composed events from its owned legacy Markdown renderer', async () => {
  const el = await fixture<LyraAgentWorkspace>(html`
    <lr-agent-workspace
      .messages=${[{ id: 'm1', role: 'assistant', text: '**Answer**' }]}
    ></lr-agent-workspace>
  `);
  const markdown = el.shadowRoot!.querySelector('lr-markdown')!;
  const leaked: string[] = [];
  for (const name of [
    'lr-render-error',
    'lr-link-click',
    'lr-highlight-activate',
    'lr-text-select',
    'lr-anchor-result',
  ]) {
    const listener = () => { leaked.push(name); };
    el.addEventListener(name, listener);
    markdown.dispatchEvent(new CustomEvent(name, {
      bubbles: true,
      composed: true,
      detail: {},
    }));
    el.removeEventListener(name, listener);
  }
  expect(leaked).to.deep.equal([]);
});

it("projects built-in messages as viewport rows so unread boundaries use message indices", async () => {
  const el = await fixture<LyraAgentWorkspace>(html`<lr-agent-workspace
    unread-start-index="1"
    .messages=${[
      { id: "m-1", role: "assistant", text: "First" },
      { id: "m-2", role: "assistant", text: "Second" },
      { id: "m-3", role: "assistant", text: "Third" },
    ]}
  ></lr-agent-workspace>`);
  await new Promise<void>((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
  );
  const rows = el.shadowRoot!.querySelectorAll("lr-chat-message");
  const boundary = el.shadowRoot!.querySelector(
    "[data-lr-chat-viewport-unread-boundary]"
  );
  const rowElements: Element[] = Array.from(rows);
  expect(rows).to.have.lengthOf(3);
  expect(
    rowElements.indexOf(boundary?.nextElementSibling as Element)
  ).to.equal(1);
});

it("forwards a slotted virtual list as the viewport's virtual content shape", async () => {
  const el = await fixture<LyraAgentWorkspace>(html`
    <lr-agent-workspace>
      <lr-virtual-list
        slot="messages"
        .items=${[1, 2, 3]}
        .renderItem=${(item: unknown) => html`${item}`}
      ></lr-virtual-list>
    </lr-agent-workspace>
  `);
  await new Promise<void>((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
  );
  const viewport = el.shadowRoot!.querySelector("lr-chat-viewport")!;
  expect(
    viewport
      .shadowRoot!.querySelector('[part="scroll"]')!
      .hasAttribute("tabindex")
  ).to.be.false;
});

it("forwards a stable message id with retry events", async () => {
  const el = await fixture<LyraAgentWorkspace>(
    html`<lr-agent-workspace
      .messages=${[
        {
          id: "message-7",
          role: "assistant",
          status: "failed",
          text: "Failed",
        },
      ]}
    ></lr-agent-workspace>`
  );
  const message = el.shadowRoot!.querySelector("lr-chat-message")!;
  const event = oneEvent(el, "lr-message-retry");
  message
    .shadowRoot!.querySelector<HTMLButtonElement>('[part="retry-button"]')!
    .click();
  expect((await event).detail).to.deep.equal({ messageId: "message-7" });
});

it("forwards a controlled retrieval selection as lr-retrieval-select, without leaking the raw lr-select", async () => {
  const el = await fixture<LyraAgentWorkspace>(html`
    <lr-agent-workspace .retrievalChunks=${[chunk]}></lr-agent-workspace>
  `);
  const results = el.shadowRoot!.querySelector("lr-retrieval-results")!;

  let rawLeaked = false;
  el.addEventListener("lr-select", () => {
    rawLeaked = true;
  });

  const listener = oneEvent(el, "lr-retrieval-select");
  results.dispatchEvent(
    new CustomEvent("lr-select", {
      detail: { chunkIds: ['chunk-1'], chunks: [chunk] },
      bubbles: true,
      composed: true,
    })
  );
  const event = (await listener) as CustomEvent<{
    chunkIds: string[];
    chunks: (typeof chunk)[];
  }>;

  expect(event.detail).to.deep.equal({ chunkIds: ['chunk-1'], chunks: [chunk] });
  expect(
    el.selectedRetrievalChunkIds,
    "request events do not mutate controlled selection"
  ).to.deep.equal([]);
  expect(
    rawLeaked,
    "the raw lr-select from lr-retrieval-results must not leak past agent-workspace"
  ).to.be.false;
});

it("owns a clone-owned snapshot of selectedRetrievalChunkIds -- a later mutation of the assigned array does not change the retained value", async () => {
  const el = await fixture<LyraAgentWorkspace>(
    html`<lr-agent-workspace></lr-agent-workspace>`
  );
  const source = ["chunk-1", "chunk-2"];
  el.selectedRetrievalChunkIds = source;
  source.push("chunk-3");
  source[0] = "mutated";

  expect(el.selectedRetrievalChunkIds).to.not.equal(source);
  expect(el.selectedRetrievalChunkIds).to.deep.equal(["chunk-1", "chunk-2"]);
});

it("lets named slots replace the data-driven transcript and details", async () => {
  const el = await fixture<LyraAgentWorkspace>(html`
    <lr-agent-workspace .messages=${messages}>
      <div slot="details" id="custom-details">Custom details</div>
      <div slot="composer" id="custom-composer">Custom composer</div>
    </lr-agent-workspace>
  `);
  expect(el.querySelector("#custom-composer")).to.exist;
  expect(el.querySelector("#custom-details")).to.exist;
});

it("observes details content added and removed after mount", async () => {
  const el = await fixture<LyraAgentWorkspace>(
    html`<lr-agent-workspace></lr-agent-workspace>`
  );
  const body = el.shadowRoot!.querySelector('[part="body"]')!;
  expect(body.getAttribute("data-details")).to.equal("false");

  const details = document.createElement("div");
  details.slot = "details";
  details.textContent = "Dynamic details";
  el.append(details);
  await el.updateComplete;
  await new Promise((resolve) => requestAnimationFrame(resolve));
  expect(body.getAttribute("data-details")).to.equal("true");
  expect(
    (el.shadowRoot!.querySelector('[part="details"]') as HTMLElement).hidden
  ).to.be.false;

  details.remove();
  await el.updateComplete;
  await new Promise((resolve) => requestAnimationFrame(resolve));
  expect(body.getAttribute("data-details")).to.equal("false");
  expect(
    (el.shadowRoot!.querySelector('[part="details"]') as HTMLElement).hidden
  ).to.be.true;
});

it("showComposer=false suppresses only the built-in fallback and keeps a custom composer visible", async () => {
  const el = await fixture<LyraAgentWorkspace>(html`
    <lr-agent-workspace show-composer="false">
      <div slot="composer" id="custom-composer">Custom composer</div>
    </lr-agent-workspace>
  `);
  expect(el.shadowRoot!.querySelector("lr-chat-composer") == null).to.be.true;
  expect(
    (el.shadowRoot!.querySelector('[part="composer"]') as HTMLElement).hidden
  ).to.be.false;
  expect(el.querySelector("#custom-composer")).to.exist;
});

it("renders a bounded latest-message window for very large fallback transcripts", async function () {
  // Rendering 500 lr-chat-message children is inherently more expensive than the framework's
  // default budget assumes, especially on non-Chromium engines and under CI/full-suite
  // contention -- give this one test a margined threshold (see document-library.test.ts's
  // equivalent 1000-row case and web-test-runner.config.js's shared 6000ms default).
  this.timeout(20_000);
  const manyMessages: ChatMessage[] = Array.from(
    { length: 510 },
    (_, index) => ({
      id: `message-${index}`,
      role: "assistant",
      text: `Message ${index}`,
    })
  );
  const el = await fixture<LyraAgentWorkspace>(
    html`<lr-agent-workspace
      .messages=${manyMessages}
      unread-start-index="505"
    ></lr-agent-workspace>`
  );
  const rendered = el.shadowRoot!.querySelectorAll("lr-chat-message");
  expect(rendered).to.have.lengthOf(500);
  expect((rendered[0] as HTMLElement).getAttribute("message-id")).to.equal(
    "message-10"
  );
  const viewport = el.shadowRoot!.querySelector(
    "lr-chat-viewport"
  ) as unknown as {
    unreadStartIndex: number | null;
  };
  expect(viewport.unreadStartIndex).to.equal(495);
});

it("recomputes the unread index when the messages slot is filled or emptied after mount", async () => {
  // `safeUnreadStartIndex` branches on `hasSlotted('messages')`: a slotted transcript owns its own
  // indexing, so the authored index passes through untouched, while the data-driven list remaps it
  // through the deduplicated projection. Without a `slotchange` binding on that slot the branch is
  // only ever evaluated at mount, so slotting a transcript in (or pulling it back out) later leaves
  // the viewport reading the wrong boundary.
  const el = await fixture<LyraAgentWorkspace>(html`<lr-agent-workspace
    unread-start-index="9"
    .messages=${[
      { id: "first", role: "assistant", text: "First" },
      { id: "first", role: "assistant", text: "Ignored duplicate" },
      { id: "", role: "assistant", text: "Ignored empty" },
      { id: "second", role: "assistant", text: "Second" },
    ]}
  ></lr-agent-workspace>`);
  const viewport = el.shadowRoot!.querySelector("lr-chat-viewport") as HTMLElement & {
    unreadStartIndex: number | null;
  };
  const messagesSlot = el.shadowRoot!.querySelector(
    'slot[name="messages"]'
  ) as HTMLSlotElement;
  // Two of the four authored messages survive deduplication, so the data-driven branch remaps 9
  // down to 2. Both branches land past the last rendered row, which keeps the composed viewport's
  // own unread-divider offset at null throughout -- otherwise this test would be measuring
  // lr-chat-viewport's separate change-in-update wart rather than the slot binding.
  expect(viewport.unreadStartIndex).to.equal(2);

  const slotted = document.createElement("div");
  slotted.slot = "messages";
  slotted.textContent = "Virtualized transcript";
  let changed = oneEvent(messagesSlot, "slotchange");
  el.append(slotted);
  await changed;
  await el.updateComplete;
  expect(
    viewport.unreadStartIndex,
    "a slotted transcript passes the authored index straight through"
  ).to.equal(9);

  changed = oneEvent(messagesSlot, "slotchange");
  slotted.remove();
  await changed;
  await el.updateComplete;
  expect(
    viewport.unreadStartIndex,
    "removing it returns to the projected data-driven index"
  ).to.equal(2);
});

it("maps the authored unread index through the same normalized message projection", async () => {
  const el = await fixture<LyraAgentWorkspace>(html`<lr-agent-workspace
    unread-start-index="3"
    .messages=${[
      { id: "first", role: "assistant", text: "First" },
      { id: "first", role: "assistant", text: "Ignored duplicate" },
      { id: "", role: "assistant", text: "Ignored empty" },
      { id: "second", role: "assistant", text: "Second" },
    ]}
  ></lr-agent-workspace>`);
  const viewport = el.shadowRoot!.querySelector("lr-chat-viewport") as HTMLElement & {
    unreadStartIndex: number | null;
  };
  expect(viewport.unreadStartIndex).to.equal(1);
});

it("uses both narrow body tracks without leaving dead space above the composer", async () => {
  const el = await fixture<LyraAgentWorkspace>(html`
    <lr-agent-workspace
      style="inline-size:360px; block-size:640px"
      .messages=${messages}
    >
      <div slot="details" style="block-size:500px">Tall details</div>
    </lr-agent-workspace>
  `);
  await new Promise((resolve) => requestAnimationFrame(resolve));
  const body = el.shadowRoot!.querySelector('[part="body"]') as HTMLElement;
  const details = el.shadowRoot!.querySelector(
    '[part="details"]'
  ) as HTMLElement;
  expect(
    Math.abs(
      body.getBoundingClientRect().bottom -
        details.getBoundingClientRect().bottom
    )
  ).to.be.at.most(1);
  expect(
    (
      el.shadowRoot!.querySelector('[part="conversation"]') as HTMLElement
    ).getBoundingClientRect().height
  ).to.be.greaterThan(100);
});

it("contains long localized workspace content at 320px", async () => {
  const longText = "LocalizedWorkspaceContentWithoutNaturalBreaks".repeat(4);
  const longMessages: ChatMessage[] = [
    { id: "long-message", role: "assistant", text: longText },
  ];
  const wrapper = await fixture<HTMLDivElement>(html`
    <div style="inline-size:320px; block-size:640px">
      <lr-agent-workspace
        style="inline-size:100%; block-size:100%"
        .messages=${longMessages}
        .strings=${{
          agentWorkspaceLabel: longText,
          composerPlaceholder: longText,
        }}
      >
        <lr-button slot="header-actions" size="s" variant="neutral"
          >${longText}</lr-button
        >
      </lr-agent-workspace>
    </div>
  `);
  const el = wrapper.querySelector(
    "lr-agent-workspace"
  ) as LyraAgentWorkspace | null;
  expect(
    el !== null,
    "the workspace renders inside the 320px allocation"
  ).to.equal(true);
  if (el === null) return;

  await el.updateComplete;
  await new Promise((resolve) => requestAnimationFrame(resolve));
  const base = el.shadowRoot!.querySelector(
    '[part="base"]'
  ) as HTMLElement | null;
  const heading = el.shadowRoot!.querySelector(
    '[part="heading"]'
  ) as HTMLElement | null;
  expect(base !== null, "the workspace exposes its base part").to.equal(true);
  expect(heading !== null, "the workspace exposes its heading part").to.equal(
    true
  );
  if (base === null || heading === null) return;

  expect(el.getBoundingClientRect().width).to.be.at.most(321);
  expect(base.scrollWidth).to.be.at.most(base.clientWidth + 1);
  expect(heading.scrollWidth).to.be.at.most(heading.clientWidth + 1);
});

it("is accessible in a populated state", async () => {
  const el = await fixture<LyraAgentWorkspace>(
    html`<lr-agent-workspace
      .messages=${messages}
      .run=${run}
    ></lr-agent-workspace>`
  );
  expect(el.shadowRoot!.querySelector("lr-chat-message")).to.exist;
  await expect(el).to.be.accessible();
});

// -- Bridged child events ---------------------------------------------------

it("forwards composer input without mutating the controlled draft", async () => {
  const el = await fixture<LyraAgentWorkspace>(
    html`<lr-agent-workspace .run=${run}></lr-agent-workspace>`
  );
  await el.updateComplete;
  const composer = el.shadowRoot!.querySelector(
    "lr-chat-composer"
  ) as HTMLElement;
  expect(composer != null, "the composer renders by default").to.equal(true);

  const forwarded = oneEvent(el, "lr-input");
  composer.dispatchEvent(
    new CustomEvent("lr-input", {
      detail: { value: "draft text" },
      bubbles: true,
      composed: true,
    })
  );
  expect((await forwarded).detail).to.deep.equal({ value: "draft text" });
  await el.updateComplete;
  expect(el.composerValue, "the host applies accepted value changes").to.equal(
    ""
  );
});

it("forwards follow requests without mutating controlled follow state", async () => {
  const el = await fixture<LyraAgentWorkspace>(
    html`<lr-agent-workspace .run=${run}></lr-agent-workspace>`
  );
  await el.updateComplete;
  const viewport = el.shadowRoot!.querySelector(
    "lr-chat-viewport"
  ) as HTMLElement;
  expect(el.follow, "follow defaults on").to.be.true;

  const released = oneEvent(el, "lr-follow-change");
  viewport.dispatchEvent(
    new CustomEvent("lr-follow-change", {
      detail: { following: false },
      bubbles: true,
      composed: true,
    })
  );
  expect((await released).detail).to.deep.equal({ following: false });
  await el.updateComplete;
  expect(el.follow, "the host applies accepted follow changes").to.be.true;

  const reengaged = oneEvent(el, "lr-follow-change");
  viewport.dispatchEvent(
    new CustomEvent("lr-follow-change", {
      detail: { following: true },
      bubbles: true,
      composed: true,
    })
  );
  expect((await reengaged).detail).to.deep.equal({ following: true });
  await el.updateComplete;
  expect(el.follow).to.be.true;
});

it("preserves an explicitly empty accessible-name override by presence", async () => {
  const el = await fixture<LyraAgentWorkspace>(
    html`<lr-agent-workspace aria-label=""></lr-agent-workspace>`
  );
  expect(
    el.shadowRoot!.querySelector('[part="base"]')!.getAttribute("aria-label")
  ).to.equal("");
});

it("uses first-wins identity for duplicate message ids in the bounded fallback", async () => {
  const el = await fixture<LyraAgentWorkspace>(
    html`<lr-agent-workspace
      .messages=${[
        { id: "same", role: "assistant", text: "first" },
        { id: "same", role: "assistant", text: "second" },
      ]}
    ></lr-agent-workspace>`
  );
  const rendered = el.shadowRoot!.querySelectorAll("lr-chat-message");
  expect(rendered).to.have.lengthOf(1);
  expect(
    (
      rendered[0]!.querySelector("lr-markdown") as HTMLElement & {
        content: string;
      }
    ).content
  ).to.equal("first");
});

it("normalizes nonempty message identities before applying the 500-message window", async () => {
  const repeatedTail = Array.from({ length: 499 }, () => ({
    id: "tail",
    role: "assistant" as const,
    text: "duplicate tail",
  }));
  const el = await fixture<LyraAgentWorkspace>(html`<lr-agent-workspace
    .messages=${[
      { id: "kept", role: "assistant", text: "kept before malformed tail" },
      ...repeatedTail,
      { id: "", role: "assistant", text: "empty" },
      { id: "   ", role: "assistant", text: "whitespace" },
    ]}
  ></lr-agent-workspace>`);

  const rendered = [...el.shadowRoot!.querySelectorAll<HTMLElement>("lr-chat-message")];
  expect(rendered.map((message) => message.getAttribute("message-id"))).to.deep.equal([
    "kept",
    "tail",
  ]);
});

describe("definite-allocation overflow", () => {
  it("clips oversized header and composer content instead of scrolling, collapsing the conversation row", async () => {
    const shell = await fixture<HTMLElement>(html`
      <div style="block-size: 200px; inline-size: 40rem">
        <lr-agent-workspace>
          <div slot="header-actions" style="block-size: 300px">toolbar</div>
          <div slot="composer" style="block-size: 300px">composer</div>
        </lr-agent-workspace>
      </div>
    `);
    const el = shell.querySelector<LyraAgentWorkspace>("lr-agent-workspace")!;
    await el.updateComplete;
    const root = el.shadowRoot!.querySelector<HTMLElement>('[part="base"]')!;
    const header = el.shadowRoot!.querySelector<HTMLElement>('[part="header"]')!;
    const body = el.shadowRoot!.querySelector<HTMLElement>('[part="body"]')!;

    expect(root.clientHeight).to.be.at.most(200);
    expect(root.scrollHeight > root.clientHeight).to.be.true;
    expect(body.clientHeight).to.equal(0);
    expect(
      Math.round(header.getBoundingClientRect().bottom - root.getBoundingClientRect().bottom) > 0
    ).to.be.true;
  });

  it("gives an oversized header toolbar its own scroll owner through ::part(header)", async () => {
    const shell = await fixture<HTMLElement>(html`
      <div class="workspace-shell" style="block-size: 200px; inline-size: 40rem">
        <style>
          .workspace-shell lr-agent-workspace::part(header) {
            max-block-size: 64px;
            overflow: auto;
          }
        </style>
        <lr-agent-workspace>
          <div slot="header-actions" style="block-size: 300px">toolbar</div>
        </lr-agent-workspace>
      </div>
    `);
    const el = shell.querySelector<LyraAgentWorkspace>("lr-agent-workspace")!;
    await el.updateComplete;
    const root = el.shadowRoot!.querySelector<HTMLElement>('[part="base"]')!;
    const header = el.shadowRoot!.querySelector<HTMLElement>('[part="header"]')!;
    const body = el.shadowRoot!.querySelector<HTMLElement>('[part="body"]')!;

    expect(header.scrollHeight > header.clientHeight).to.be.true;
    expect(root.scrollHeight).to.equal(root.clientHeight);
    expect(body.clientHeight > 0).to.be.true;
    header.scrollTop = 100;
    expect(header.scrollTop > 0).to.be.true;
  });

  it("gives a tall custom composer its own scroll owner through ::part(composer)", async () => {
    const shell = await fixture<HTMLElement>(html`
      <div class="composer-shell" style="block-size: 200px; inline-size: 40rem">
        <style>
          .composer-shell lr-agent-workspace::part(composer) {
            max-block-size: 72px;
            overflow: auto;
          }
        </style>
        <lr-agent-workspace>
          <div slot="composer" style="block-size: 300px">composer</div>
        </lr-agent-workspace>
      </div>
    `);
    const el = shell.querySelector<LyraAgentWorkspace>("lr-agent-workspace")!;
    await el.updateComplete;
    const root = el.shadowRoot!.querySelector<HTMLElement>('[part="base"]')!;
    const composer = el.shadowRoot!.querySelector<HTMLElement>('[part="composer"]')!;
    const body = el.shadowRoot!.querySelector<HTMLElement>('[part="body"]')!;

    expect(composer.scrollHeight > composer.clientHeight).to.be.true;
    expect(root.scrollHeight).to.equal(root.clientHeight);
    expect(body.clientHeight > 0).to.be.true;
  });
});

describe("a slotted [hidden] message", () => {
  it("is removed from the rendered box, not just from the accessibility tree", async () => {
    const el = await fixture<LyraAgentWorkspace>(html`
      <lr-agent-workspace>
        <div id="gone" slot="messages" hidden>filtered out</div>
        <div id="shown" slot="messages">still here</div>
      </lr-agent-workspace>
    `);
    await el.updateComplete;
    const gone = el.querySelector<HTMLElement>("#gone")!;
    const shown = el.querySelector<HTMLElement>("#shown")!;
    expect(getComputedStyle(gone).display).to.equal("none");
    expect(gone.getClientRects().length).to.equal(0);
    // The companion proves the slot[name='messages']::slotted(*) rule is still live, so the
    // assertion above cannot pass merely because the workspace stopped styling its messages.
    expect(getComputedStyle(shown).display).to.equal("block");
    expect(shown.getClientRects().length).to.equal(1);
  });

  it("still lets find-in-page reveal a hidden='until-found' message", async () => {
    const el = await fixture<LyraAgentWorkspace>(html`
      <lr-agent-workspace>
        <div id="findable" slot="messages" hidden="until-found">collapsed transcript</div>
      </lr-agent-workspace>
    `);
    await el.updateComplete;
    expect(
      getComputedStyle(el.querySelector<HTMLElement>("#findable")!).display
    ).to.equal("block");
  });
});
