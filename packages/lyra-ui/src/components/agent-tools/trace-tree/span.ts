import type { LyraToolStatus } from '../../../internal/shared-unions.js';
import { finiteRange } from '../../../internal/numbers.js';

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

export const MAX_RENDERED_LYRA_SPANS = 500;

export interface LyraSpanProjection {
  spans: LyraSpan[];
  byId: Map<string, LyraSpan>;
  truncated: boolean;
}

/** One bounded, runtime-safe projection shared by every agent trace view. Invalid records and
 * later duplicate ids are omitted, while closed provider enums normalize to their documented
 * fallbacks. When `activeSpanId` resolves, that span and as much of its nearest ancestor path as
 * fits reserve positions inside the 500-row ceiling; ordinary rows then fill the remaining
 * positions in input order. */
export function normalizeLyraSpans(
  values: readonly unknown[],
  activeSpanId: string | null = null,
): LyraSpanProjection {
  const normalized: LyraSpan[] = [];
  const normalizedById = new Map<string, LyraSpan>();
  const source = Array.isArray(values) ? values : [];
  for (const value of source) {
    if (value === null || typeof value !== 'object') continue;
    const candidate = value as Partial<LyraSpan>;
    if (
      typeof candidate.id !== 'string'
      || candidate.id.length === 0
      || normalizedById.has(candidate.id)
      || typeof candidate.startMs !== 'number'
      || !Number.isFinite(candidate.startMs)
      || (candidate.endMs != null && (typeof candidate.endMs !== 'number' || !Number.isFinite(candidate.endMs)))
    ) continue;
    const startMs = finiteRange(candidate.startMs, 0, 0, Number.MAX_SAFE_INTEGER);
    const endMs = candidate.endMs == null
      ? undefined
      : finiteRange(candidate.endMs, startMs, startMs, Number.MAX_SAFE_INTEGER);
    const span: LyraSpan = {
      ...(candidate as LyraSpan),
      id: candidate.id,
      name: typeof candidate.name === 'string' ? candidate.name : '',
      kind: normalizeLyraSpanKind(candidate.kind),
      status: normalizeLyraSpanStatus(candidate.status),
      startMs,
      ...(endMs === undefined ? {} : { endMs }),
      ...(typeof candidate.parentId === 'string' && candidate.parentId.length > 0
        ? { parentId: candidate.parentId }
        : {}),
    };
    if (typeof candidate.parentId !== 'string' || candidate.parentId.length === 0) {
      Reflect.deleteProperty(span, 'parentId');
    }
    normalized.push(span);
    normalizedById.set(span.id, span);
  }

  const chosenIds = new Set<string>();
  const visitedPath = new Set<string>();
  let current = activeSpanId ? normalizedById.get(activeSpanId) : undefined;
  while (current && chosenIds.size < MAX_RENDERED_LYRA_SPANS && !visitedPath.has(current.id)) {
    chosenIds.add(current.id);
    visitedPath.add(current.id);
    current = current.parentId ? normalizedById.get(current.parentId) : undefined;
  }
  for (const span of normalized) {
    if (chosenIds.size >= MAX_RENDERED_LYRA_SPANS) break;
    chosenIds.add(span.id);
  }

  const spans = normalized.filter((span) => chosenIds.has(span.id));
  const byId = new Map(spans.map((span) => [span.id, span]));
  return { spans, byId, truncated: spans.length < normalized.length };
}
