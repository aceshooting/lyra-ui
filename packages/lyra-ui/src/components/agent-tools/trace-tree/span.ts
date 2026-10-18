import { projectLyraSpans } from './span-projection.js';
import { MAX_RENDERED_LYRA_SPANS, type LyraSpan } from './span-shared.js';
export { MAX_RENDERED_LYRA_SPANS, normalizeLyraSpanKind, normalizeLyraSpanStatus } from './span-shared.js';
export type { LyraSpan, LyraSpanKind, LyraSpanStatus } from './span-shared.js';

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
