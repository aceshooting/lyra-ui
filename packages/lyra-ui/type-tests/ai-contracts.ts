import type { LyraChatMessage } from '../src/components/conversation/chat-message/chat-message.class.js';
import type { LyraToolCallChip } from '../src/components/agent-tools/tool-call-chip/tool-call-chip.class.js';
import type { LyraToolResultView } from '../src/components/agent-tools/tool-result-view/tool-result-view.class.js';
import type { LyraSourceCard } from '../src/components/retrieval/source-card/source-card.class.js';
import type { LyraAttachmentChip } from '../src/components/media/attachment-chip/attachment-chip.class.js';
import type { LyraDocumentPreview } from '../src/components/viewers/document-preview/document-preview.class.js';
import {
  AgUiStreamAdapter,
  adaptA2UiSurface,
  adaptAiSdkMessage,
  createAgentStreamState,
  reduceAgentStream,
} from '../src/ai/index.js';
import type {
  AgentRun,
  AgentStatus,
  AgentStep,
  AgentStreamEvent,
  CancelEventDetail,
  ChatMessage,
  Citation,
  CitationSelectEventDetail,
  DataMessagePart,
  DocumentRef,
  ExportEventDetail,
  GroundedClaim,
  GroundingAssessment,
  MessagePart,
  MessagePartState,
  RetrievalChunk,
  RetrievalProgressEventDetail,
  RetrievalQuery,
  RetrievalScoreBreakdown,
  RetryEventDetail,
  RunLifecycleEventDetail,
  ToolApprovalEventDetail,
  ToolInvocation,
  ToolResultMessagePart,
  WidgetMessagePart,
} from '../src/ai/index.js';

const status: AgentStatus = { kind: 'running', message: 'Searching' };
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
  model: 'example-model',
  costEstimate: 0.0042,
  steps: [step],
};
const documentRef: DocumentRef = {
  id: 'doc-1',
  name: 'annual-report.pdf',
  mimeType: 'application/pdf',
  uri: 'https://example.com/annual-report.pdf',
  version: '3',
};
const citation: Citation = {
  id: 'cite-1',
  sourceId: 'doc-1',
  locator: { kind: 'page', page: 12 },
  answerRange: { start: 0, end: 28 },
};
const retrievalQuery: RetrievalQuery = {
  text: 'quarterly revenue growth',
  filters: { year: 2026 },
  mode: 'hybrid',
  scope: ['doc-1'],
};
const retrievalScores: RetrievalScoreBreakdown = {
  dense: 0.8,
  sparse: 0.6,
  rerank: 0.91,
  final: 0.91,
};
const retrievalChunk: RetrievalChunk = {
  id: 'chunk-1',
  text: 'Revenue grew year over year.',
  score: 0.87,
  source: documentRef,
  rank: 1,
  locator: { kind: 'page', page: 12 },
  queryId: 'query-1',
  stage: 'rerank',
  traceId: 'trace-1',
  scores: retrievalScores,
};
const groundedClaim: GroundedClaim = {
  id: 'claim-1',
  text: 'Revenue grew year over year.',
  status: 'supported',
  citationIds: [citation.id],
  confidence: 0.94,
};
const groundingAssessment: GroundingAssessment = {
  supportedClaims: 1,
  unsupportedClaims: 0,
  coverage: 1,
  confidence: 0.9,
  claims: [groundedClaim],
};
const chatMessage: ChatMessage = {
  id: 'message-1',
  role: 'assistant',
  status: 'sent',
  attachments: [documentRef],
  parts: [
    { id: 'text', type: 'text', text: 'Answer', state: 'complete' },
    { id: 'citation', type: 'citation', citation },
  ],
};
const toolInvocation: ToolInvocation = {
  id: 'call-1',
  name: 'search',
  args: { query: 'answer' },
  status: 'success',
  result: { hits: 3 },
};
const messagePart: MessagePart = {
  id: 'result',
  type: 'tool-result',
  invocationId: toolInvocation.id,
  result: toolInvocation.result,
};
const runLifecycle: RunLifecycleEventDetail = { runId: run.id, status };
const retrievalProgress: RetrievalProgressEventDetail = { queryId: 'query-1', stage: 'ranking', progress: 0.5 };
const citationSelect: CitationSelectEventDetail = { citation };
const toolApproval: ToolApprovalEventDetail = { invocationId: toolInvocation.id, approved: true };
const cancel: CancelEventDetail = { reason: 'user-cancelled' };
const retry: RetryEventDetail = { attempt: 2, messageId: chatMessage.id };
const exportRequest: ExportEventDetail = { format: 'markdown' };

declare const chatMessageElement: LyraChatMessage;
declare const toolCallElement: LyraToolCallChip;
declare const toolResultElement: LyraToolResultView;
declare const sourceCardElement: LyraSourceCard;
declare const attachmentElement: LyraAttachmentChip;
declare const documentPreviewElement: LyraDocumentPreview;

function bindExistingComponents(message: ChatMessage, invocation: ToolInvocation, value: Citation, ref: DocumentRef): void {
chatMessageElement.messageRole = message.role;
  chatMessageElement.status = message.status ?? 'sent';
  chatMessageElement.timestamp = message.timestamp;
  toolCallElement.callId = invocation.id;
  toolCallElement.name = invocation.name;
  toolCallElement.status = invocation.status;
  toolResultElement.toolName = invocation.name;
  toolResultElement.args = invocation.args;
  toolResultElement.result = invocation.result;
  sourceCardElement.sourceId = value.sourceId ?? '';
  attachmentElement.name = ref.name;
  attachmentElement.mimeType = ref.mimeType ?? '';
  documentPreviewElement.mimeType = ref.mimeType ?? '';
}

const generationEvent: AgentStreamEvent = {
  type: 'run-start',
  generation: 1,
  sequence: 1,
  runId: run.id,
};
reduceAgentStream(createAgentStreamState(), generationEvent);
new AgUiStreamAdapter();
adaptAiSdkMessage({ id: 'message', role: 'assistant', parts: [] });
adaptA2UiSurface({ rootId: 'root', components: [] }, {});

const progress: MessagePartState = 'streaming';
const successfulResult: ToolResultMessagePart = {
  id: 'success',
  type: 'tool-result',
  invocationId: 'call-1',
  result: null,
};
const failedResult: ToolResultMessagePart = {
  id: 'failure',
  type: 'tool-result',
  invocationId: 'call-1',
  error: 'failed',
  result: { partial: true },
};
const dataPart: DataMessagePart = { id: 'data', type: 'data', data: { value: 1 } };
const widgetPart: WidgetMessagePart = { id: 'widget', type: 'data', widget: { version: '2' } };

// @ts-expect-error failures use an explicit error part or domain error field
const invalidProgress: MessagePartState = 'error';
// @ts-expect-error a tool result cannot omit both success and error outcomes
const missingToolOutcome: ToolResultMessagePart = { id: 'missing', type: 'tool-result', invocationId: 'call-1' };
// @ts-expect-error data and widget payloads are separate variants
const ambiguousData: DataMessagePart | WidgetMessagePart = { id: 'ambiguous', type: 'data', data: {}, widget: {} };
// @ts-expect-error stream events require an explicit generation and sequence
const implicitGeneration: AgentStreamEvent = { type: 'run-start', runId: 'run-2' };

void bindExistingComponents;
void chatMessage;
void retrievalQuery;
void retrievalScores;
void retrievalChunk;
void groundedClaim;
void groundingAssessment;
void messagePart;
void runLifecycle;
void retrievalProgress;
void citationSelect;
void toolApproval;
void cancel;
void retry;
void exportRequest;
void progress;
void successfulResult;
void failedResult;
void dataPart;
void widgetPart;
void invalidProgress;
void missingToolOutcome;
void ambiguousData;
void implicitGeneration;
