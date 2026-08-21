import { finiteNumber } from '../../../internal/numbers.js';

/** One synced transcript entry. `end` is exclusive; an omitted `end` extends to the next cue (or
 * forever, for the last one). Cue collections require a trimmed nonempty `cueId` and retain the
 * first occurrence when IDs repeat. */
export interface LyraAvCue {
  readonly cueId: string;
  readonly start: number;
  readonly end?: number;
  readonly text: string;
  readonly speaker?: string;
}

/** A native `<track>` source (subtitles/captions/descriptions). */
export interface LyraAvTrack {
  readonly src: string;
  readonly kind: 'subtitles' | 'captions' | 'descriptions';
  readonly srclang: string;
  readonly label: string;
  readonly default?: boolean;
}

const MAX_LYRA_AV_CUES = 10_000;
const MAX_LYRA_AV_TRACKS = 64;
const MAX_CUE_ID_CHARS = 256;
const MAX_CUE_TEXT_CHARS = 100_000;
const MAX_CUE_SPEAKER_CHARS = 4_096;
const MAX_TRACK_SRC_CHARS = 16_384;
const MAX_TRACK_LANGUAGE_CHARS = 128;
const MAX_TRACK_LABEL_CHARS = 4_096;
const OWNED_AV_METADATA_COLLECTIONS = new WeakSet<object>();

function ownedSnapshot<T>(values: T[]): readonly T[] {
  const snapshot = Object.freeze(values);
  OWNED_AV_METADATA_COLLECTIONS.add(snapshot);
  return snapshot;
}

export const EMPTY_LYRA_AV_CUES = ownedSnapshot<LyraAvCue>([]);
export const EMPTY_LYRA_AV_TRACKS = ownedSnapshot<LyraAvTrack>([]);

function normalizeArray<T>(
  value: unknown,
  limit: number,
  normalize: (candidate: unknown) => T | undefined,
  fallback: readonly T[],
): readonly T[] {
  try {
    if (!Array.isArray(value)) return fallback;
    if (OWNED_AV_METADATA_COLLECTIONS.has(value)) return value as readonly T[];
    const result: T[] = [];
    const length = Math.min(value.length, limit);
    for (let index = 0; index < length; index += 1) {
      try {
        const normalized = normalize(value[index]);
        if (normalized !== undefined) result.push(normalized);
      } catch {
        // A hostile entry does not discard earlier valid entries.
      }
    }
    return ownedSnapshot(result);
  } catch {
    return fallback;
  }
}

/** Clones, validates, bounds, and freezes transcript cues. */
export function snapshotLyraAvCues(value: unknown): readonly LyraAvCue[] {
  const seenIds = new Set<string>();
  return normalizeArray(
    value,
    MAX_LYRA_AV_CUES,
    (candidate) => {
      if (candidate === null || typeof candidate !== 'object') return undefined;
      const record = candidate as Record<string, unknown>;
      if (typeof record['cueId'] !== 'string' || typeof record['text'] !== 'string') return undefined;
      const cueId = record['cueId'].trim();
      if (!cueId || cueId.length > MAX_CUE_ID_CHARS || seenIds.has(cueId)) return undefined;
      seenIds.add(cueId);
      const rawStart = record['start'];
      const start = Math.max(0, finiteNumber(typeof rawStart === 'number' ? rawStart : 0, 0));
      const rawEnd = record['end'];
      const end = typeof rawEnd === 'number' && Number.isFinite(rawEnd)
        ? Math.max(start, rawEnd)
        : undefined;
      const rawSpeaker = record['speaker'];
      const speaker = typeof rawSpeaker === 'string'
        ? rawSpeaker.slice(0, MAX_CUE_SPEAKER_CHARS)
        : undefined;
      return Object.freeze({
        cueId,
        start,
        text: record['text'].slice(0, MAX_CUE_TEXT_CHARS),
        ...(end !== undefined ? { end } : {}),
        ...(speaker !== undefined ? { speaker } : {}),
      });
    },
    EMPTY_LYRA_AV_CUES,
  );
}

/** Clones, validates, bounds, and freezes native text-track metadata. */
export function snapshotLyraAvTracks(value: unknown): readonly LyraAvTrack[] {
  return normalizeArray(
    value,
    MAX_LYRA_AV_TRACKS,
    (candidate) => {
      if (candidate === null || typeof candidate !== 'object') return undefined;
      const record = candidate as Record<string, unknown>;
      if (
        typeof record['src'] !== 'string' ||
        (record['kind'] !== 'subtitles' && record['kind'] !== 'captions' && record['kind'] !== 'descriptions') ||
        typeof record['srclang'] !== 'string' ||
        typeof record['label'] !== 'string'
      ) {
        return undefined;
      }
      return Object.freeze({
        src: record['src'].slice(0, MAX_TRACK_SRC_CHARS),
        kind: record['kind'],
        srclang: record['srclang'].slice(0, MAX_TRACK_LANGUAGE_CHARS),
        label: record['label'].slice(0, MAX_TRACK_LABEL_CHARS),
        default: record['default'] === true,
      });
    },
    EMPTY_LYRA_AV_TRACKS,
  );
}

/** Whether the retained cue snapshot contains text or speaker content that `search()` can match. */
export function hasSearchableLyraAvCues(cues: readonly LyraAvCue[]): boolean {
  return cues.some((cue) => Boolean(cue.text.trim() || cue.speaker?.trim()));
}
