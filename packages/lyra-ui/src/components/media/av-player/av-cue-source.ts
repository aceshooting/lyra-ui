import type { LyraSourceRevision } from '../../../data-sources.js';
import type { LyraSourceRequest, LyraSourceValue } from '../../../utilities/data-preparation.js';
import { sourceCount, sourceRevision } from '../../../internal/source-request-controller.js';
import { MAX_CUE_ID_CHARS, MAX_CUE_TEXT_CHARS, MAX_CUE_SPEAKER_CHARS, type LyraAvCue } from './av-metadata.js';

/** Full transcript indexing is provider-owned. IDs are globally unique within a revision.
 * Methods and metadata must be own data properties. Replace/rebind after changing the source. */
export interface LyraAvCueSource {
  readonly revision: LyraSourceRevision;
  readonly count: number;
  getCue(index: number, request: LyraSourceRequest): LyraSourceValue<LyraAvCue | null>;
  findCue(cueId: string, request: LyraSourceRequest): LyraSourceValue<{ readonly index: number; readonly cue: LyraAvCue } | null>;
  activeAt(time: number, request: LyraSourceRequest): LyraSourceValue<LyraAvActiveCue>;
  search(query: string, request: LyraSourceRequest & { readonly locale: string }): LyraSourceValue<LyraAvCueSearch>;
}
/** Greatest start, then later original index, wins within [start,end). An omitted cue end is
 * resolved by the provider. Bounds describe one complete answer interval, including no-active. */
export interface LyraAvActiveCue {
  readonly index: number | null;
  readonly cue: LyraAvCue | null;
  readonly validFrom: number;
  readonly validUntil: number;
}
/** Exact full-source matches in provider order; each original source index occurs at most once. */
export interface LyraAvCueSearch {
  readonly count: number;
  getMatch(matchIndex: number, request: LyraSourceRequest): LyraSourceValue<{ readonly index: number; readonly cue: LyraAvCue }>;
}

export function cueField(value: unknown, name: string, optional = false): unknown {
  if (!value || typeof value !== 'object') throw new TypeError('Invalid cue source record');
  const descriptor = Object.getOwnPropertyDescriptor(value, name);
  if (!descriptor && optional) return undefined;
  if (!descriptor || !('value' in descriptor)) throw new TypeError('Invalid cue source field');
  return descriptor.value;
}

export function captureCueSource(value: unknown): LyraAvCueSource {
  const revision = sourceRevision(cueField(value, 'revision'));
  const count = sourceCount(cueField(value, 'count'));
  const getCue = cueField(value, 'getCue');
  const findCue = cueField(value, 'findCue');
  const activeAt = cueField(value, 'activeAt');
  const search = cueField(value, 'search');
  if (typeof getCue !== 'function' || typeof findCue !== 'function' || typeof activeAt !== 'function' || typeof search !== 'function') {
    throw new TypeError('Invalid cue source methods');
  }
  return Object.freeze({ revision, count, getCue: getCue.bind(value), findCue: findCue.bind(value),
    activeAt: activeAt.bind(value), search: search.bind(value) });
}

const OWNED_SOURCE_CUES = new WeakSet<object>();

/** Strict provider admission never truncates text, coerces timestamps, or compacts positions. */
export function captureSourceCue(value: unknown): LyraAvCue {
  if (typeof value === 'object' && value !== null && OWNED_SOURCE_CUES.has(value)) return value as LyraAvCue;
  const cueId = cueField(value, 'cueId');
  const start = cueField(value, 'start');
  const end = cueField(value, 'end', true);
  const text = cueField(value, 'text');
  const speaker = cueField(value, 'speaker', true);
  if (typeof cueId !== 'string' || !cueId || cueId !== cueId.trim() || cueId.length > MAX_CUE_ID_CHARS ||
    typeof start !== 'number' || !Number.isFinite(start) || start < 0 ||
    (end !== undefined && (typeof end !== 'number' || !Number.isFinite(end) || end < start)) ||
    typeof text !== 'string' || text.length > MAX_CUE_TEXT_CHARS ||
    (speaker !== undefined && (typeof speaker !== 'string' || speaker.length > MAX_CUE_SPEAKER_CHARS))) {
    throw new TypeError('Invalid source cue');
  }
  const cue = Object.freeze({ cueId, start, text, ...(end !== undefined ? { end } : {}), ...(speaker !== undefined ? { speaker } : {}) });
  OWNED_SOURCE_CUES.add(cue);
  return cue;
}

export function captureCueLocation(value: unknown, count: number): { readonly index: number; readonly cue: LyraAvCue } {
  const index = sourceCount(cueField(value, 'index'));
  if (index >= count) throw new RangeError('Invalid cue index');
  return Object.freeze({ index, cue: captureSourceCue(cueField(value, 'cue')) });
}

export function captureActiveCue(value: unknown, count: number, time: number): LyraAvActiveCue {
  const validFrom = cueField(value, 'validFrom');
  const validUntil = cueField(value, 'validUntil');
  if (typeof validFrom !== 'number' || typeof validUntil !== 'number' ||
    !(validFrom < validUntil) || !(time >= validFrom && time < validUntil)) throw new RangeError('Invalid cue validity interval');
  const index = cueField(value, 'index');
  const cue = cueField(value, 'cue');
  if (index === null && cue === null) return Object.freeze({ index, cue, validFrom, validUntil });
  const location = captureCueLocation({ index, cue }, count);
  if (time < location.cue.start || (location.cue.end !== undefined && time >= location.cue.end)) throw new RangeError('Inactive source cue');
  return Object.freeze({ ...location, validFrom, validUntil });
}

export function sameSourceCue(left: LyraAvCue, right: LyraAvCue): boolean {
  return left.cueId === right.cueId && left.start === right.start && left.end === right.end &&
    left.text === right.text && left.speaker === right.speaker;
}

/** Capture the exact-count handle without enumerating any matches or invoking field accessors. */
export function captureCueSearch(value: unknown, sourceSize: number): LyraAvCueSearch {
  const count = sourceCount(cueField(value, 'count'));
  const getMatch = cueField(value, 'getMatch');
  if (count > sourceSize || typeof getMatch !== 'function') throw new TypeError('Invalid cue search');
  return Object.freeze({ count, getMatch: getMatch.bind(value) });
}

export function sourceCueMatches(cue: LyraAvCue, query: string, locale: string): boolean {
  const folded = query.toLocaleLowerCase(locale);
  return folded.length > 0 && (cue.text.toLocaleLowerCase(locale).includes(folded) ||
    (cue.speaker ?? '').toLocaleLowerCase(locale).includes(folded));
}
