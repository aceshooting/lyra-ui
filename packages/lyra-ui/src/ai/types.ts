import type { ChatMessageRole, ChatMessageStatus } from '../components/chat-message/chat-message.class.js';
import type { ToolCallStatus } from '../components/tool-call-chip/tool-call-chip.class.js';

export type { ChatMessageRole, ChatMessageStatus, ToolCallStatus };

/**
 * Provider-neutral shared type surface for the agentic AI component layer built on top of this
 * package's existing chat/agent/tool/graph primitives (`lr-chat-message`, `lr-citation-badge`,
 * `lr-tool-call-chip`, `lr-tool-result-view`, `lr-source-card`, `lr-chunk-inspector`, etc.).
 * Nothing exported here is a custom element, has a runtime side effect, or binds to any specific
 * LLM/agent vendor -- it is the plain-data vocabulary that retrieval, agent-run, knowledge-graph,
 * dashboard, and evaluation components compose those existing primitives around.
 *
 * Every shape below is deliberately structurally compatible with -- never a divergent duplicate
 * of -- the prop/event shapes those existing components already expose. Where a type reuses an
 * existing component's own exported type outright (`ChatMessageRole`, `ChatMessageStatus`,
 * `ToolCallStatus`), it is imported and re-exported here rather than redefined. See each
 * interface's own doc comment below for the specific existing component(s) it composes with.
 * `types.contract.ts` (a sibling file -- see its own header for why it is deliberately not named
 * `*.test.ts`) asserts this compatibility at compile time.
 *
 * Every `*EventDetail` type below is plain serializable data (no class instances, no functions),
 * matching this package's own `*EventMap`/`*Detail` event-contract convention (e.g.
 * `LyraCitationBadgeEventMap` / `CitationActivateDetail` in `citation-badge.class.ts`), since
 * these are meant to cross a `CustomEvent<T>` boundary.
 */

/**
 * Coarse lifecycle state for a whole agent run or a single step within one. Broader than any
 * single existing component's own status vocabulary (e.g. `ToolCallStatus`'s `'pending' |
 * 'running' | 'success' | 'error' | 'denied'`, reused as-is by `ToolInvocation` below) because a
 * run/step can also be waiting on the user (`'waiting-input'`), waiting on an approval gate
 * (`'waiting-approval'`), or user-cancelled (`'cancelled'`) -- states a single tool call's own
 * terminal status has no need to express.
 */
export type AgentStatusKind =
  | 'idle'
  | 'running'
  | 'queued'
  | 'collecting'
  | 'waiting-input'
  | 'waiting-approval'
  | 'done'
  | 'error'
  | 'cancelled'
  // Keep autocomplete for the built-in lifecycle while allowing an application
  // to add provider- or workflow-specific states.
  | (string & {});

/** A status value paired with an optional human-readable detail, e.g. `{ kind: 'error', message: 'Rate limited' }`. */
export interface AgentStatus {
  kind: AgentStatusKind;
  message?: string;
}

/**
 * One step in an agent run's summary timeline. A coarser unit than `LyraSpan`
 * (`trace-tree/span.ts`), which models a single trace span for the more detailed
 * `lr-trace-tree`/`lr-span-waterfall` views -- `kind` is intentionally a free-form string here
 * (not `LyraSpan['kind']`'s closed `'agent' | 'llm' | 'tool' | 'retriever' | 'embedding' |
 * 'other'` union) since an agent run's own step taxonomy is application-defined.
 */
export interface AgentStep {
  id: string;
  kind: string;
  label: string;
  status: AgentStatus;
  /** Epoch milliseconds. */
  startedAt?: number;
  /** Epoch milliseconds. */
  endedAt?: number;
}

/** A complete agent run: overall status plus its ordered `steps`. */
export interface AgentRun {
  id: string;
  status: AgentStatus;
  /** Epoch milliseconds. */
  startedAt?: number;
  /** Epoch milliseconds. */
  endedAt?: number;
  model?: string;
  costEstimate?: number;
  steps: AgentStep[];
}

/**
 * One message in a conversation, for orchestration-level components that hold/replay message
 * history. `<lr-chat-message>` itself takes these as individual properties rather than one object
 * prop, since it is a presentation shell around an arbitrary slotted body (see its own class
 * doc) -- but `role`/`status`/`timestamp` here reuse `<lr-chat-message>`'s own exported
 * `ChatMessageRole` / `ChatMessageStatus` types and its own `Date | string` timestamp shape
 * verbatim, so spreading a `ChatMessage`'s fields onto a `<lr-chat-message>` element's properties
 * (`message.role -> el.role`, `message.status -> el.status`, `message.timestamp -> el.timestamp`)
 * type-checks with no conversion.
 */
export interface ChatMessage {
  id: string;
  role: ChatMessageRole;
  status?: ChatMessageStatus;
  timestamp?: Date | string;
  /** Plain-text (or app-rendered-markdown-source) body; `<lr-chat-message>` renders none of the message content itself, so this is for state-holding/serialization, not direct binding. */
  text?: string;
  attachments?: DocumentRef[];
}

/**
 * One tool/function call an agent made -- the same concept `<lr-tool-call-chip>` and
 * `<lr-tool-result-view>` already render. `status` reuses `ToolCallStatus` (not the broader
 * `AgentStatus` above) so a `ToolInvocation` assigns directly onto `<lr-tool-call-chip>`'s own
 * `status` property with no adapter; that component's own `callId`/`name` properties correspond
 * to `id`/`name` here. `args`/`result` widen (never narrow) `<lr-tool-result-view>`'s own
 * `args: unknown` / `result: unknown` properties, so a `ToolInvocation`'s fields assign directly
 * onto that component too.
 */
export interface ToolInvocation {
  id: string;
  name: string;
  args: Record<string, unknown>;
  status: ToolCallStatus;
  result?: unknown;
  error?: string;
}

/**
 * A reference to a source document. `name`/`mimeType` match `<lr-attachment-chip>`'s own
 * `name`/`mimeType` properties and `<lr-document-preview>`'s own `mimeType` property field-for-
 * field, so a `DocumentRef` composes directly into either without renaming.
 */
export interface DocumentRef {
  id: string;
  name: string;
  mimeType?: string;
  uri?: string;
  version?: string;
}

/**
 * A single citation record, e.g. one entry a retrieval/grounding step produces. `sourceId`
 * matches the `sourceId` field carried by `<lr-citation-badge>`'s own `lr-citation-activate` /
 * `lr-citation-open` events (`CitationActivateDetail` / `CitationOpenDetail` in
 * `citation-badge.class.ts`) and `<lr-source-card>`'s own `source-id` property -- the same stable
 * id already used to correlate a citation badge with its source card. `span` follows this
 * package's established range-anchor shape (see `LyraChunkAnchor`'s `'line-range'` /
 * `'time-range'` variants, both `{ start; end? }`, in `chunk-inspector.class.ts`).
 */
export interface Citation {
  id: string;
  chunkId?: string;
  sourceId?: string;
  span?: { start: number; end: number };
  label?: string;
}

/** A retrieval request. Provider/backend-neutral -- no vendor-specific filter/query shape. */
export interface RetrievalQuery {
  text: string;
  filters?: Record<string, unknown>;
  mode: 'vector' | 'keyword' | 'hybrid';
  scope?: string[];
}

/**
 * One retrieved chunk. `source` carries a full `DocumentRef` (not just a bare id) since a
 * retrieval result set is exactly where a chunk's full document metadata first becomes
 * available. Maps onto `<lr-chunk-inspector>`'s own flatter `LyraChunk` display-row shape
 * (`chunk-inspector.class.ts`) via `source.id -> sourceId` and `source.name -> title` --
 * `lr-chunk-inspector` renders a display row per chunk; this type is the richer data record a
 * retrieval step produces upstream of that rendering step.
 */
export interface RetrievalChunk {
  id: string;
  text: string;
  score: number;
  source: DocumentRef;
  metadata?: Record<string, unknown>;
}

/** How well a generated response is supported by its retrieved/cited sources. */
export interface GroundingAssessment {
  supportedClaims: number;
  unsupportedClaims: number;
  /** 0-1. */
  coverage: number;
  /** 0-1. */
  confidence?: number;
  warnings?: string[];
}

/** `detail` for a run-lifecycle event (e.g. an agent run's status changing). */
export interface RunLifecycleEventDetail {
  runId: string;
  status: AgentStatus;
}

/** `detail` for a retrieval-in-progress event. */
export interface RetrievalProgressEventDetail {
  queryId: string;
  stage: string;
  progress?: number;
}

/** `detail` for a citation being selected/activated in an orchestration-level surface. */
export interface CitationSelectEventDetail {
  citation: Citation;
}

/** `detail` for a tool-approval decision (a human-in-the-loop gate). */
export interface ToolApprovalEventDetail {
  invocationId: string;
  approved: boolean;
}

/** `detail` for a cancellation request. */
export interface CancelEventDetail {
  reason?: string;
}

/** `detail` for a retry request. */
export interface RetryEventDetail {
  attempt: number;
  /** Stable id of the message being retried, when the message has one. */
  messageId?: string;
}

/** `detail` for an export request, e.g. "export this conversation/run as `format`". */
export interface ExportEventDetail {
  format: string;
}
