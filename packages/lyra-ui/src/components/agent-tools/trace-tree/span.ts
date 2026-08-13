import type { LyraToolStatus } from '../../../internal/shared-unions.js';

export type LyraSpanKind = 'agent' | 'llm' | 'tool' | 'retriever' | 'embedding' | 'other';

/** The same tool-lifecycle vocabulary `<lr-tool-call-chip>`'s `ToolCallStatus` and
 *  `<lr-tool-result-dialog>`'s `ToolResultStatus` resolve to -- a span standing in for a call reads
 *  identically to the call itself. */
export type LyraSpanStatus = LyraToolStatus;

/** Normalizes foreign provider data before it reaches closed span-kind maps. */
export function normalizeLyraSpanKind(value: unknown): LyraSpanKind {
  switch (value) {
    case 'agent':
    case 'llm':
    case 'tool':
    case 'retriever':
    case 'embedding':
    case 'other':
      return value;
    default:
      return 'other';
  }
}

/** Normalizes foreign provider data before it reaches closed span-status maps. */
export function normalizeLyraSpanStatus(value: unknown): LyraSpanStatus {
  switch (value) {
    case 'pending':
    case 'running':
    case 'success':
    case 'error':
    case 'denied':
      return value;
    default:
      return 'pending';
  }
}

/**
 * One span in an agent/LLM trace. The same flat `LyraSpan[]` array powers
 * both `<lr-trace-tree>` (hierarchy projection, via `parentId`) and
 * `<lr-span-waterfall>` (timeline projection, via `startMs`/`endMs`) — two
 * views of one trace, never two separate data shapes.
 */
export interface LyraSpan {
  id: string;
  /** A span whose `parentId` is missing or doesn't resolve to another span in the same array renders as a root — never dropped. */
  parentId?: string;
  name: string;
  kind: LyraSpanKind;
  /** Milliseconds relative to the trace start (not a wall-clock timestamp). */
  startMs: number;
  /** Milliseconds relative to the trace start. Absent while the span is still running. */
  endMs?: number;
  /** Same vocabulary as the library's existing tool-lifecycle status. */
  status: LyraSpanStatus;
  tokensIn?: number;
  tokensOut?: number;
  /** Preformatted by the host (e.g. `"$0.0012"`) — rendered verbatim, never parsed or summed. */
  costText?: string;
  /** Secondary text rendered under/after the span's name. */
  detail?: string;
}
