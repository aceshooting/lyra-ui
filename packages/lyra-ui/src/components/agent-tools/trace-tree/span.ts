import type { LyraToolStatus } from '../../../internal/shared-unions.js';
import {
  getOwnDataDescriptor,
  MISSING_OWN_DATA_DESCRIPTOR,
  UNSAFE_OWN_DATA_DESCRIPTOR,
} from '../../../internal/data-descriptors.js';
import { finiteCount, finiteRange } from '../../../internal/numbers.js';

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

/** A source span remains an opaque identity after its admitted data fields have been copied. */
interface CanonicalLyraSpan {
  readonly source: object;
  readonly span: LyraSpan;
}

const SPAN_PROPERTIES = [
  'id',
  'parentId',
  'name',
  'kind',
  'startMs',
  'endMs',
  'status',
  'tokensIn',
  'tokensOut',
  'costText',
  'detail',
] as const;

const normalizedSpanCache = new WeakMap<readonly unknown[], readonly CanonicalLyraSpan[]>();

function descriptorValue(value: object, property: PropertyKey): ReturnType<typeof getOwnDataDescriptor> {
  return getOwnDataDescriptor(value, property);
}

function projectLyraSpan(value: unknown): CanonicalLyraSpan | undefined {
  try {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) return undefined;
    const descriptors = new Map<
      (typeof SPAN_PROPERTIES)[number],
      ReturnType<typeof getOwnDataDescriptor>
    >();
    for (const property of SPAN_PROPERTIES) {
      const descriptor = descriptorValue(value, property);
      if (descriptor === UNSAFE_OWN_DATA_DESCRIPTOR) return undefined;
      descriptors.set(property, descriptor);
    }
    const descriptor = (property: (typeof SPAN_PROPERTIES)[number]): unknown | undefined => {
      const valueDescriptor = descriptors.get(property);
      if (
        valueDescriptor === undefined ||
        valueDescriptor === MISSING_OWN_DATA_DESCRIPTOR ||
        valueDescriptor === UNSAFE_OWN_DATA_DESCRIPTOR
      )
        return undefined;
      return valueDescriptor.value;
    };
    const id = descriptor('id');
    const start = descriptor('startMs');
    const end = descriptor('endMs');
    if (
      typeof id !== 'string' ||
      id.trim().length === 0 ||
      typeof start !== 'number' ||
      !Number.isFinite(start) ||
      (end != null && (typeof end !== 'number' || !Number.isFinite(end)))
    )
      return undefined;

    const startMs = finiteRange(start, 0, 0, Number.MAX_SAFE_INTEGER);
    const endMs = end == null
      ? undefined
      : finiteRange(end, startMs, startMs, Number.MAX_SAFE_INTEGER);
    const parentId = descriptor('parentId');
    const name = descriptor('name');
    const kind = descriptor('kind');
    const status = descriptor('status');
    const tokensIn = descriptor('tokensIn');
    const tokensOut = descriptor('tokensOut');
    const costText = descriptor('costText');
    const detail = descriptor('detail');
    const span: LyraSpan = {
      id,
      name: typeof name === 'string' ? name : '',
      kind: normalizeLyraSpanKind(kind),
      startMs,
      status: normalizeLyraSpanStatus(status),
      ...(endMs === undefined ? {} : { endMs }),
      ...(typeof parentId === 'string' && parentId.length > 0 ? { parentId } : {}),
      ...(typeof tokensIn === 'number' ? { tokensIn } : {}),
      ...(typeof tokensOut === 'number' ? { tokensOut } : {}),
      ...(typeof costText === 'string' ? { costText } : {}),
      ...(typeof detail === 'string' ? { detail } : {}),
    };
    Object.freeze(span);
    return Object.freeze({ source: value, span });
  } catch {
    return undefined;
  }
}

function canonicalLyraSpans(values: readonly unknown[]): readonly CanonicalLyraSpan[] {
  let cacheable = false;
  try {
    cacheable = Object.isFrozen(values);
  } catch {
    return [];
  }
  if (cacheable) {
    const cached = normalizedSpanCache.get(values);
    if (cached) return cached;
  }
  const canonical: CanonicalLyraSpan[] = [];
  const seenIds = new Set<string>();
  try {
    for (const value of values) {
      const projected = projectLyraSpan(value);
      if (!projected || seenIds.has(projected.span.id)) continue;
      seenIds.add(projected.span.id);
      canonical.push(projected);
    }
  } catch {
    return [];
  }
  const result = Object.freeze(canonical);
  if (cacheable) normalizedSpanCache.set(values, result);
  return result;
}

/** Stable component-owned projection; public callers receive independent mutable containers. @internal */
export interface InternalLyraSpanProjection {
  readonly spans: readonly LyraSpan[];
  readonly byId: ReadonlyMap<string, LyraSpan>;
  readonly truncated: boolean;
  readonly extentEndMs: number;
}

function protectedSpanProjection(spans: LyraSpan[], sourceCount: number, extentEndMs: number): InternalLyraSpanProjection {
  const backing = new Map(spans.map(span => [span.id, span]));
  const byId: ReadonlyMap<string, LyraSpan> = Object.freeze({
    get size() { return backing.size; },
    get: (key: string) => backing.get(key),
    has: (key: string) => backing.has(key),
    entries: () => backing.entries(),
    keys: () => backing.keys(),
    values: () => backing.values(),
    [Symbol.iterator]: () => backing[Symbol.iterator](),
    forEach(callback: (value: LyraSpan, key: string, map: ReadonlyMap<string, LyraSpan>) => void, thisArg?: unknown) {
      backing.forEach((value, key) => callback.call(thisArg, value, key, byId));
    },
  });
  return Object.freeze({ spans: Object.freeze(spans), byId, truncated: spans.length < sourceCount, extentEndMs });
}

interface SpanModel {
  spans: LyraSpan[];
  byId: Map<string, LyraSpan>;
  extentEndMs: number;
  projections: Map<number, InternalLyraSpanProjection>;
  reservation?: {active: string | null; limit: number; projection: InternalLyraSpanProjection};
}
const spanModels = new WeakMap<readonly CanonicalLyraSpan[], SpanModel>();

/** One bounded, runtime-safe projection shared by every agent trace view. Invalid records and
 * later duplicate ids are omitted. The default remains 500 rows; an optional limit permits
 * 1..5000 rows. A resolved active span and its nearest ancestors reserve positions, with
 * remaining positions filled in input order. @internal */
export function projectLyraSpans(
  values: readonly unknown[],
  activeSpanId: string | null = null,
  limit: number = MAX_RENDERED_LYRA_SPANS,
): InternalLyraSpanProjection {
  const canonical = canonicalLyraSpans(Array.isArray(values) ? values : []);
  let model = spanModels.get(canonical);
  if (!model) {
    const spans = canonical.map(({span}) => span);
    const byId = new Map(spans.map(span => [span.id, span]));
    let extentEndMs = 0;
    for (const span of spans) extentEndMs = Math.max(extentEndMs, span.endMs ?? span.startMs, span.startMs);
    model = {spans, byId, extentEndMs, projections: new Map()};
    spanModels.set(canonical, model);
  }
  const count = Math.max(1, Math.min(5000, finiteCount(limit, MAX_RENDERED_LYRA_SPANS)));
  let base = model.projections.get(count);
  if (!base) {
    const spans = model.spans.slice(0, count);
    base = protectedSpanProjection(spans, model.spans.length, model.extentEndMs);
    // Keep only the current budget rather than accumulating every possible public limit.
    model.projections.clear();
    model.projections.set(count, base);
  }
  if (model.reservation?.active === activeSpanId && model.reservation.limit === count) return model.reservation.projection;
  const chosenIds = new Set<string>();
  let current = activeSpanId ? model.byId.get(activeSpanId) : undefined;
  let contained = true;
  while (current && chosenIds.size < count && !chosenIds.has(current.id)) {
    chosenIds.add(current.id);
    contained &&= base.byId.has(current.id);
    current = current.parentId ? model.byId.get(current.parentId) : undefined;
  }
  if (contained) return base;
  for (const span of model.spans) {
    if (chosenIds.size >= count) break;
    chosenIds.add(span.id);
  }
  const spans = model.spans.filter(span => chosenIds.has(span.id));
  const projection = protectedSpanProjection(spans, model.spans.length, model.extentEndMs);
  model.reservation = {active: activeSpanId, limit: count, projection};
  return projection;
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
