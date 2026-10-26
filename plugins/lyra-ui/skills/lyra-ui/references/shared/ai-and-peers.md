# AI types and optional peers

## Provider-neutral AI types: `@aceshooting/lyra-ui/ai`

The agentic components share one vocabulary, exported as types from a dedicated subpath. Use these
instead of hand-rolling state shapes — they bind field-for-field onto the components, with no
adapter layer:

```ts
import {
  createAgentStreamState,
  reduceAgentStream,
  adaptAiSdkMessage,
  AgUiStreamAdapter,
  adaptA2UiSurface,
  type AgentRun,
  type ChatMessage,
  type MessagePart,
  type RetrievalChunk,
} from "@aceshooting/lyra-ui/ai";
```

- **Run/step state** — `AgentStatusKind`, `AgentStatus`, `AgentStep`, `AgentRun`
- **Conversation** — `ChatMessage`, ordered `MessagePart` variants, `ToolInvocation`
- **Documents & grounding** — `DocumentRef`, `Citation`, `RetrievalQuery`, `RetrievalChunk`,
  `RetrievalScoreBreakdown`, `GroundedClaim`, `GroundingAssessment`, `DocumentLocator`
- **Streaming runtime** — `AgentStreamEvent`, `AgentStreamState`, `createAgentStreamState()`,
  `reduceAgentStream()`, `reduceAgentStreamEvents()`; every event carries a monotonic `generation`
  and strictly increasing `sequence`. A newer generation atomically retires the previous run, while
  an older or replayed cursor is ignored. JSON Patch input is structurally validated and rejects
  prototype-mutating paths.
- **Structural adapters** — `adaptAiSdkMessage()` maps structural provider messages and
  `AgUiStreamAdapter` maps events onto the neutral runtime without pulling vendor SDKs into the
  package. Feed AG-UI events through `new AgUiStreamAdapter().push(event)`; the constructor accepts
  `(limits?: Partial<AgUiAdapterLimits>, options?: AgUiAdapterOptions)`.
  `adaptA2UiSurface()` is a limited A2UI-like graph helper, described below; it does not implement
  the native A2UI protocol or its surface lifecycle.
  Adapter inputs are treated as untrusted data, recursively snapshotted, and rejected without
  throwing when malformed, non-serializable, or over their configured budgets.
  `adaptAiSdkMessage()` maps AI SDK tool states structurally: `output-error` → `error`,
  `output-available` → `success`, `approval-requested` → `pending`, `output-denied` → `denied`
  (a complete part), `approval-responded` with `approval.approved === false` → `denied` (still
  streaming until the SDK moves it on), and every other state, including an approved
  `approval-responded`, → `running`. The denial reason is not mapped.
- **Tool invocation timing and redaction** — `ToolInvocation` optionally carries `startedAt` and
  `endedAt` (epoch milliseconds; together they derive the duration `<lr-message-parts
  tool-display="block">` and `<lr-tool-timeline>` show) and `redactedFields` (dotted paths within
  `args`/`result`/`error` masked wherever Lyra renders the invocation's payload). The stream runtime
  validates them on `tool-upsert` events and `tool-call` parts: a non-finite or non-number time, or
  a `redactedFields` that is not an array of at most 100 strings of at most 4,096 characters, fails
  the event as `invalid_stream_event`.
- **Tool display name and incomplete calls** — `ToolInvocation.displayName` is the
  application's own, already-translated tool label; `<lr-message-parts>` (both `tool-display`
  modes) and `<lr-tool-timeline>` show it in place of `name`, which still selects the result
  renderer. `status: 'incomplete'` marks a call that ended without a result (an interrupted stream,
  a cancelled run); set it yourself on a `tool-upsert` or `tool-call` part, since the adapters never
  infer it. The runtime accepts both on `tool-upsert` events, `tool-call` parts and message
  snapshots; a `displayName` that is not a string of at most `maxIdentifierCharacters` fails the
  event as `invalid_stream_event`, and a later upsert that omits it keeps the retained one.
- **Resource limits** — pass a partial `AgentStreamLimits` to `createAgentStreamState()`, or adapter
  limit options to the relevant adapter. The exported `DEFAULT_AGENT_STREAM_LIMITS`,
  `DEFAULT_AI_SDK_ADAPTER_LIMITS`, `DEFAULT_AG_UI_ADAPTER_LIMITS`, and
  `DEFAULT_A2UI_ADAPTER_LIMITS` constants document the defaults; invalid limit values fall back to
  them. Runtime breaches become an explicit error state/event, while snapshot/A2UI rejection
  returns `null` or an empty adapter result as documented by that boundary.
- **Message-part invariants** — `MessagePartState` is transport-only
  (`'streaming' | 'complete' | 'interrupted'`): failures use an `ErrorMessagePart` or the owning
  domain error. Tool results are a success/error union, and a `type: 'data'` part contains exactly
  one of `data` or `widget`.
- **Event payloads** — `RunLifecycleEventDetail`, `RetrievalProgressEventDetail`,
  `CitationSelectEventDetail`, `ToolApprovalEventDetail`, `CancelEventDetail`, `RetryEventDetail`,
  `ExportEventDetail`

These structural, provider-agnostic types correspond to the component inputs above; map a vendor
payload onto them at the edge.

### AG-UI reasoning, activity, and custom events

`AgUiLikeEvent` is the structural input shape; `push()` also accepts unknown input for guarded
admission. Visible `REASONING_MESSAGE_*` events become reasoning parts. `ACTIVITY_SNAPSHOT`
uses `messageId`, `activityType`, object `content`, and optional `replace`; `replace: false`
keeps an existing message. `ACTIVITY_DELTA` uses `patch` against a prior snapshot with the same
`messageId` and `activityType`. Activity content becomes a named data part and remains subject to
the adapter's snapshot and buffered-content budgets.

`CUSTOM` requires `name` and `value` plus explicit host routing. Set
`AgUiAdapterOptions.customEventTarget` to receive an `AgUiCustomEvent { name, value }` and return
an `AgUiCustomEventTarget { messageId, partId }`, or `null` to ignore it. Repeated targets replace
their data part. The callback owns those identities; the application registers named data renderers
and controls which event names it accepts. An omitted callback ignores custom events. Named data values remain data,
including values that resemble widgets or actions.

`AgUiAdapterLimits.maxBufferedMessages` bounds retained message identities, including activity
patch baselines; its default is 512. `maxBufferedTools`, `maxToolArgumentBytes`,
`maxTextDeltaCharacters`, and the inherited provider snapshot limits remain independently bounded.
Run boundaries and `reset()` clear retained buffers. Compact chunks require upstream expansion;
phase, encrypted, raw, step, subagent, deprecated thinking, and unknown events are ignored.
See the [AG-UI adapter guide](https://github.com/aceshooting/lyra-ui/blob/main/docs/ag-ui-adapter.md)
for event mappings, routing examples, error behavior, and the supported subset.

### Limited A2UI-like graph helper

`adaptA2UiSurface(surface, typeMap, limits?)` accepts one structural graph:
`{ rootId, components: [{ id, type, props?, text?, children?: string[], action?: { id, payload? } }], data? }`.
The host-owned `typeMap` maps those type names to allowlisted widget types. Unsupported native
A2UI lifecycle messages are not accepted as graphs; the helper does not maintain surfaces,
process native data-model updates, or provide native A2UI catalog compatibility.

The result is `A2UiAdapterResult | null`: a widget-compatible `{ version: '2', root }` plus
`bindingState` when `surface.data` is present. Assign `bindingState` separately; the widget-v2
document itself never supplies controlled state. Explicit `data: null` remains `bindingState: null`.
The original `state` field remains an equal compatibility alias in the helper result; renderers
do not read it. Input, props, action payloads and state are detached under the adapter budgets.

```ts
import { adaptA2UiSurface } from "@aceshooting/lyra-ui/ai";
import "@aceshooting/lyra-ui/components/lr-message-parts.js";
import "@aceshooting/lyra-ui/components/lr-input.js";
import { createWidgetTypeRegistry } from "@aceshooting/lyra-ui/components/lr-widget-renderer.js";

const registry = createWidgetTypeRegistry([["field", {
  tag: "lr-input", interaction: "control", props: { label: "string", value: "string" },
  bindings: { value: { event: "lr-input" } },
}]]);
const adapted = adaptA2UiSurface({
  rootId: "name-field",
  components: [{ id: "name-field", type: "Field", props: {
    label: "Name", value: { $bind: "/name" },
  } }],
  data: { name: "Ada" },
}, { Field: "field" });
const message = document.querySelector("lr-message-parts")!;
if (adapted) {
  message.widgetRegistry = registry;
  message.widgetBindingState = adapted.bindingState;
  message.parts = [{ id: "name-form", type: "data", widget: adapted.root }];
}
message.addEventListener("lr-widget-state-change", (event) => {
  if (event.detail.path === "/name") message.widgetBindingState = { name: event.detail.value };
});
```

For host-specific content, keep using `renderPart(part, index)`: return `undefined` to delegate
one part, or return a template to replace it and own its interaction. No extra part registry is
required. Widget type registries control the existing widget renderer's allowed component types,
separately from the message-part rendering hook.

### Interrupting and resuming a streamed run

`stream-interrupt` and `stream-resume` are reducer events for the host-owned transport lifecycle;
they do not open, close, or reconnect a network stream. Both carry the current `runId` and the
stream's `generation` plus next `sequence`. The reducer ignores events for a different run without
consuming its cursor. An interrupt takes `{ resumable, reason? }`, where `reason` is caller-owned,
already-localized text. It marks currently streaming message parts as interrupted and attaches that
context to those parts. Resume is accepted only while the current run interruption has
`resumable: true`, and restores only interrupted parts whose own context has `resumable: true`;
non-resumable parts stay interrupted. Keep sequence numbers increasing within a generation, and
advance the generation when starting a replacement run. `AgentStreamState.interruption` exposes
the current run context; `MessagePartBase.interruption` retains the context on each unfinished
part. Both use `MessagePartInterruption { resumable: boolean; reason?: string }`. Resuming clears
the run context and the context on resumed parts; it leaves non-resumable parts unchanged.

```ts
state = reduceAgentStream(state, {
  type: 'stream-interrupt', generation: 4, sequence: 12, runId: 'run-7',
  interruption: { resumable: true, reason: localizedDisconnectReason },
});
// Reconnect the transport in application code, then resume the same run:
state = reduceAgentStream(state, {
  type: 'stream-resume', generation: 4, sequence: 13, runId: 'run-7',
});
```

### Task-first AI composition guide

- **Render one model response:** `lr-message-parts`; use `lr-chat-message` only when the message
  shell (avatar, author, actions) is also needed.
- **Build the main prompt affordance:** `lr-prompt-input`; it already composes attachments,
  model/voice/source controls, mentions/commands, and `lr-prompt-queue`.
- **Run an agent workspace:** `lr-agent-workspace` + `reduceAgentStream()`; add
  `lr-subagent-panel` for nested runs and `lr-mcp-app` only for executable MCP App resources.
- **Show grounded output:** `lr-rag-answer`; pass claim records for `lr-claim-evidence`, use
  `lr-retrieval-compare` for retrieval tuning and `lr-rag-eval-dashboard` for run metrics.
- **Develop prompts/tools:** `lr-prompt-studio` and `lr-json-schema-viewer`.
- **Build voice sessions:** `lr-realtime-session`; it composes the existing audio visualizer,
  push-to-talk control, and transcript feed while leaving transport ownership with the host.

Family registration entry points are additive: importing
`@aceshooting/lyra-ui/components/conversation`, `/agent-tools`, or `/retrieval` registers and
exports that complete family. Granular component entry points remain the smallest bundles and are
preferred in production.

## Optional peer dependencies

All 32 peers are optional, in two groups. The 29 component-facing peers remain outside the default
install; components load them on demand where applicable. React, Svelte, and Vue are
compile-time-only peers for their matching
opt-in declaration entries (`custom-elements-jsx`, `svelte`, and `vue`): those entries emit empty
JavaScript, no component loads a framework, and Lyra ships no runtime wrapper. `llms/peers.md` is the
generated peer-role/component table. Loading and failure UI for component peers is
component-specific: viewer sections document their localized loading/error/notice states, while
`lr-include` preserves its light-DOM fallback/live region and emits `lr-include-error` when its
sanitizer is unavailable. Some components additionally issue a deduped warning. Consult the owning
component section instead of assuming every peer user renders an `<lr-skeleton>` or the same
degraded state. `lr-phone-input` is the exception to dynamic peer import: it takes a consumer-built
adapter (`loadLibphonenumberAdapter()`) rather than importing `libphonenumber-js` itself.

### Experimental DOCX editing companion

Use `@aceshooting/lyra-docs` for editing; `lr-docx-viewer` remains a viewer in Lyra UI.
The companion bundles a lazily loaded document engine. Its installed README owns
installation, admission limits, lifecycle, exact supported structures and save receipts.

```ts
import '@aceshooting/lyra-ui/theme.css';
import '@aceshooting/lyra-docs/docx/editor';
import '@aceshooting/lyra-docs/docx/editor.css';
import { createDocxSession } from '@aceshooting/lyra-docs/docx';
```

`lr-docx-editor` provides command search (Ctrl/Command+K), bounded find excerpts and
replace-and-advance, Outline, Checks and Review panels, table formatting and local raster
image tools. `createDocxSession({ mount })` supports a host-owned toolbar; it requires a
connected empty light-DOM mount. Both routes expose `can()`/`execute()`, `find()`/
`selectMatch()`/`replaceMatch()`, `outline()`/`selectOutlineItem()`, `inspectDocument()`/
`selectDiagnostic()`, and `review()`/`selectReviewItem()`. Await `execute()` before inspecting its
result or issuing a dependent command; it includes any required feature preparation. Query rows are copied, bounded
and revision-scoped; refresh after edits and pass the returned `expectedRevision` when
navigating. Queries do not save or fetch. Inspection covers body metadata only; capability
fields `preserved`, `renderable` and `editable` remain `unverified`, and the report is not
an accessibility certification.

`insertImage(source, options)` copies local raster bytes and requires explicit dimensions;
its narrow package profile includes visible styles and plain table cells at existing
paragraph/run boundaries. `replaceImage(bytes, options)` preserves selected image size,
title and description. Both use `DocxInsertImageOptions` for retained selection, revision
and cancellation. `canInsertImage()` and `canReplaceImage()` are advisory; unsupported
content refuses unchanged after canonical qualification.

Table actions cover simple topology, explicit first-row headers, current-cell vertical
alignment/shading/borders, and equal-column table width. Adding or replying to comments
and changing tracking mode require an explicit author; supported comments can be replied
to, resolved/reopened and deleted.
Only bounded simple body text insertion/deletion revisions support accept/reject;
unsupported revisions remain `readOnly`. These contracts do not qualify every native
engine gesture or promise arbitrary DOCX fidelity.

The host persists bytes explicitly: `save()` returns a receipt; call
`acknowledgeSaved(receipt)` only after durable persistence. Disconnect destroys the
session and undo history. See the [companion README](https://github.com/aceshooting/lyra-ui/blob/main/packages/lyra-docs/README.md)
for complete public types, bounds and guarded examples.
