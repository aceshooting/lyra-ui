import type { LyraChatMessage } from '../components/conversation/chat-message/chat-message.class.js';
import type { LyraToolCallChip } from '../components/agent-tools/tool-call-chip/tool-call-chip.class.js';
import type { LyraToolResultView } from '../components/agent-tools/tool-result-view/tool-result-view.class.js';
import type { LyraSourceCard } from '../components/retrieval/source-card/source-card.class.js';
import type { LyraAttachmentChip } from '../components/media/attachment-chip/attachment-chip.class.js';
import type { LyraDocumentPreview } from '../components/viewers/document-preview/document-preview.class.js';
import type {
  AgentRun,
  AgentStatus,
  AgentStep,
  CancelEventDetail,
  ChatMessage,
  Citation,
  CitationSelectEventDetail,
  DocumentRef,
  ExportEventDetail,
  GroundingAssessment,
  RetrievalChunk,
  RetrievalProgressEventDetail,
  RetrievalQuery,
  RetryEventDetail,
  RunLifecycleEventDetail,
  ToolApprovalEventDetail,
  ToolInvocation,
} from './types.js';

/**
 * Compile-time-only structural assertions for `./types.ts` -- there is no runtime behavior to
 * test in a types-only module, so "test" here means "fails `tsc` if a shape is wrong", the same
 * idea as this package's root-level `type-tests/*.ts` files (see `tsconfig.type-tests.json`).
 *
 * Deliberately NOT named `types.test.ts`: this package's `tsconfig.json` excludes
 * `src/**\/*.test.ts` from the very `tsc -p tsconfig.json` run that both `pnpm build` and
 * `pnpm lint` use to type-check `src/ai/**` (verified empirically -- a deliberately wrong
 * assignment in a `src/ai/types.test.ts` was silently accepted by every gate), and
 * `web-test-runner.config.js`'s `files: 'src/**\/*.test.ts'` glob would additionally load a
 * `types.test.ts` here as a zero-assertion browser spec (harmless, but pointless, and it still
 * wouldn't type-check anything -- `wtr`'s `esbuildPlugin` transpiles, it does not type-check).
 * `tsconfig.type-tests.json`'s own `include` (`type-tests/**\/*.ts`, `src/**\/*.d.ts`) does not
 * reach a plain `.ts` file under `src/ai/` either. A plain, non-`.test.ts`-suffixed file under
 * `src/` is therefore the only name that is actually covered by `tsc -p tsconfig.json` -- i.e.
 * the only name that makes a wrong shape here fail `pnpm build`/`pnpm lint` for real.
 *
 * Nothing below is ever executed (`declare const` bindings have no runtime value, and the
 * "binder" functions are declared but never called) -- this file compiles into a practically
 * empty `dist/ai/types.contract.js`, and a wrong shape fails `tsc` at the offending line instead.
 */

// --- Standalone literal construction: compiles only if every required field is present with the
// --- right type, and no extra/misspelled field sneaks past excess-property checking. ---

const status: AgentStatus = { kind: 'running', message: 'Searching…' };

const step: AgentStep = {
  id: 'step-1',
  kind: 'retrieval',
  label: 'Searching knowledge base',
  status,
  startedAt: 0,
  endedAt: 120,
};

const run: AgentRun = {
  id: 'run-1',
  status,
  startedAt: 0,
  endedAt: 4200,
  model: 'gpt-5',
  costEstimate: 0.0042,
  steps: [step],
};

const documentRef: DocumentRef = {
  id: 'doc-1',
  name: 'annual_report.pdf',
  mimeType: 'application/pdf',
  uri: 'https://example.com/annual_report.pdf',
  version: '3',
};

const citation: Citation = {
  id: 'cite-1',
  chunkId: 'chunk-1',
  sourceId: 'doc-1',
  span: { start: 0, end: 42 },
  label: '[1]',
};

const retrievalQuery: RetrievalQuery = {
  text: 'quarterly revenue growth',
  filters: { year: 2026 },
  mode: 'hybrid',
  scope: ['doc-1', 'doc-2'],
};
void retrievalQuery;

const retrievalChunk: RetrievalChunk = {
  id: 'chunk-1',
  text: 'Revenue grew 12% year over year…',
  score: 0.87,
  source: documentRef,
  metadata: { page: 12 },
};
void retrievalChunk;

const groundingAssessment: GroundingAssessment = {
  supportedClaims: 8,
  unsupportedClaims: 1,
  coverage: 0.89,
  confidence: 0.7,
  warnings: ['One claim could not be matched to a source.'],
};
void groundingAssessment;

const chatMessage: ChatMessage = {
  id: 'msg-1',
  role: 'assistant',
  status: 'sent',
  timestamp: new Date(),
  text: 'Revenue grew 12% year over year.',
  attachments: [documentRef],
};

const toolInvocation: ToolInvocation = {
  id: 'call-1',
  name: 'web_search',
  args: { query: 'quarterly revenue growth' },
  status: 'success',
  result: { hits: 3 },
};

const runLifecycleDetail: RunLifecycleEventDetail = { runId: run.id, status };
void runLifecycleDetail;

const retrievalProgressDetail: RetrievalProgressEventDetail = { queryId: 'query-1', stage: 'ranking', progress: 0.5 };
void retrievalProgressDetail;

const citationSelectDetail: CitationSelectEventDetail = { citation };
void citationSelectDetail;

const toolApprovalDetail: ToolApprovalEventDetail = { invocationId: toolInvocation.id, approved: true };
void toolApprovalDetail;

const cancelDetail: CancelEventDetail = { reason: 'user-cancelled' };
void cancelDetail;

const retryDetail: RetryEventDetail = { attempt: 2 };
void retryDetail;

const exportDetail: ExportEventDetail = { format: 'markdown' };
void exportDetail;

// --- Cross-component structural compatibility: each `declare const` below is an ambient,
// --- never-constructed element reference (same pattern `type-tests/event-types.ts` uses for real
// --- component classes) -- the assignments inside each never-called function only compile if a
// --- `./types.ts` value's type is actually assignable to that existing component's own property
// --- type, i.e. if the shared type really is "structurally compatible with, not divergent from"
// --- what the component already accepts, per this module's own file-level doc comment. ---

declare const chatMessageEl: LyraChatMessage;
function bindChatMessage(message: ChatMessage): void {
  chatMessageEl.role = message.role;
  chatMessageEl.status = message.status ?? 'sent';
  chatMessageEl.timestamp = message.timestamp;
}
void bindChatMessage;

declare const toolCallChipEl: LyraToolCallChip;
function bindToolInvocationToChip(invocation: ToolInvocation): void {
  toolCallChipEl.callId = invocation.id;
  toolCallChipEl.name = invocation.name;
  toolCallChipEl.status = invocation.status;
}
void bindToolInvocationToChip;

declare const toolResultViewEl: LyraToolResultView;
function bindToolInvocationToResultView(invocation: ToolInvocation): void {
  toolResultViewEl.toolName = invocation.name;
  toolResultViewEl.args = invocation.args;
  toolResultViewEl.result = invocation.result;
}
void bindToolInvocationToResultView;

declare const sourceCardEl: LyraSourceCard;
function bindCitationToSourceCard(value: Citation): void {
  // `Citation.sourceId` is optional (a citation without a resolved source is still valid); the
  // fallback empty string matches `<lr-source-card>`'s own `sourceId = ''` default.
  sourceCardEl.sourceId = value.sourceId ?? '';
}
void bindCitationToSourceCard;

declare const attachmentChipEl: LyraAttachmentChip;
declare const documentPreviewEl: LyraDocumentPreview;
function bindDocumentRef(ref: DocumentRef): void {
  attachmentChipEl.name = ref.name;
  attachmentChipEl.mimeType = ref.mimeType ?? '';
  documentPreviewEl.mimeType = ref.mimeType ?? '';
}
void bindDocumentRef;
