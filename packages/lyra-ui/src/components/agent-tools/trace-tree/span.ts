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
  kind: 'agent' | 'llm' | 'tool' | 'retriever' | 'embedding' | 'other';
  /** Milliseconds relative to the trace start (not a wall-clock timestamp). */
  startMs: number;
  /** Milliseconds relative to the trace start. Absent while the span is still running. */
  endMs?: number;
  /** Same vocabulary as the library's existing tool-lifecycle status. */
  status: 'pending' | 'running' | 'success' | 'error' | 'denied';
  tokensIn?: number;
  tokensOut?: number;
  /** Preformatted by the host (e.g. `"$0.0012"`) — rendered verbatim, never parsed or summed. */
  costText?: string;
  /** Secondary text rendered under/after the span's name. */
  detail?: string;
}
