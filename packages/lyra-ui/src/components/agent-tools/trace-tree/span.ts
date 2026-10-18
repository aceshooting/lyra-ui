import type { LyraToolStatus } from '../../../internal/shared-unions.js';
import { projectLyraSpans } from './span-projection.js';

export type LyraSpanKind = 'agent' | 'llm' | 'tool' | 'retriever' | 'embedding' | 'other';

/** The shared tool lifecycle plus `incomplete` for an interrupted span and neutral `unknown` for
 *  an explicitly unrecognized provider status. */
export type LyraSpanStatus = LyraToolStatus | 'incomplete' | 'unknown';

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
    case 'incomplete':
    case 'unknown':
      return value;
    default:
      return value == null ? 'pending' : 'unknown';
  }
}

/**
 * One span in an agent/LLM trace. The same flat `LyraSpan[]` array powers
 * both `<lr-trace-tree>` (hierarchy projection, via `parentId`) and
 * `<lr-span-waterfall>` (timeline projection, via `startMs`/`endMs`) — two
 * views of one trace, never two separate data shapes.
 */
export interface LyraSpan {
  /** Nonblank stable identity. Surrounding whitespace in a nonblank ID is preserved. */
  id: string;
  /** A span whose `parentId` is missing or doesn't resolve to another span in the same array renders as a root — never dropped. */
  parentId?: string;
  name: string;
  kind: LyraSpanKind;
  /** Milliseconds relative to the trace start (not a wall-clock timestamp). */
  startMs: number;
  /** Milliseconds relative to the trace start. Absent while the span is still running. */
  endMs?: number;
  /** Tool-lifecycle status plus `incomplete`; unrecognized provider values become neutral `unknown`, while absent values become `pending`. */
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
  /**
   * The greatest trace-relative end across every span in the source array, measured BEFORE the
   * `MAX_RENDERED_LYRA_SPANS` cap drops anything — never below `0`. A maximum, not the last
   * element's end: `normalizeLyraSpans()` preserves input order, so an unsorted `spans` can put
   * the latest-ending span anywhere in the array.
   *
   * A timeline view has to scale to this, not to `spans`'s own extent: the cap keeps the first
   * spans, so on a trace whose long tail is truncated the surviving extent collapses and every
   * remaining bar stretches to fill the track. `<lr-span-waterfall>` then drew a 1s span in a 10s
   * trace at 100% width, and `<lr-trace-tree>` did the same, both silently. Truncating the ROWS is
   * a resource bound; rescaling the AXIS underneath them is a misreport.
   */
  extentEndMs: number;
}

/** Runtime-safe projection with independent mutable result containers. The default is 500 rows;
 * an optional limit permits 1..5000. A resolved active span and its nearest ancestors reserve
 * positions before ordinary input-order rows. Invalid records and later duplicate ids are omitted. */
export function normalizeLyraSpans(
  values: readonly unknown[],
  activeSpanId: string | null = null,
  limit: number = MAX_RENDERED_LYRA_SPANS,
): LyraSpanProjection {
  const projection = projectLyraSpans(values, activeSpanId, limit);
  return { ...projection, spans: [...projection.spans], byId: new Map(projection.byId) };
}
