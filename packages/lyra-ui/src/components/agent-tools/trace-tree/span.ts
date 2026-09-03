import type { LyraToolStatus } from '../../../internal/shared-unions.js';
import {
  getOwnDataDescriptor,
  MISSING_OWN_DATA_DESCRIPTOR,
  UNSAFE_OWN_DATA_DESCRIPTOR,
} from '../../../internal/data-descriptors.js';
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
      id.length === 0 ||
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

/** One bounded, runtime-safe projection shared by every agent trace view. Invalid records and
 * later duplicate ids are omitted, while closed provider enums normalize to their documented
 * fallbacks. When `activeSpanId` resolves, that span and as much of its nearest ancestor path as
 * fits reserve positions inside the 500-row ceiling; ordinary rows then fill the remaining
 * positions in input order. */
export function normalizeLyraSpans(
  values: readonly unknown[],
  activeSpanId: string | null = null,
): LyraSpanProjection {
  const source = Array.isArray(values) ? values : [];
  const normalized = canonicalLyraSpans(source).map(({ span }) => span);
  const normalizedById = new Map<string, LyraSpan>();
  for (const span of normalized) normalizedById.set(span.id, span);

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
