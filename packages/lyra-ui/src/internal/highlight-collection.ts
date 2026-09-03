import type { LyraHighlight } from '../components/viewers/document-viewer/anchors.js';
import {
  getOwnDataDescriptor,
  MISSING_OWN_DATA_DESCRIPTOR,
  UNSAFE_OWN_DATA_DESCRIPTOR,
} from './data-descriptors.js';

/** Maximum host-highlight records admitted into one immutable target snapshot. */
export const HIGHLIGHT_SNAPSHOT_LIMIT = 10_000;

const HIGHLIGHT_SNAPSHOT_OVERFLOW = 1;
const EMPTY_HIGHLIGHTS: readonly LyraHighlight[] = Object.freeze([]);
const HIGHLIGHT_TONES = new Set(['accent', 'success', 'warning', 'danger', 'neutral']);
const SNAPSHOT_ANCHOR_KINDS = new WeakMap<LyraHighlight, string>();

function isSafeArrayLength(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function dataValue(
  source: object,
  key: PropertyKey,
): unknown | typeof MISSING_OWN_DATA_DESCRIPTOR | typeof UNSAFE_OWN_DATA_DESCRIPTOR {
  const descriptor = getOwnDataDescriptor(source, key);
  return descriptor === MISSING_OWN_DATA_DESCRIPTOR || descriptor === UNSAFE_OWN_DATA_DESCRIPTOR
    ? descriptor
    : descriptor.value;
}

/**
 * The public highlight collection has long accepted a computed `id`; preserve that narrow
 * compatibility path without restoring broad record spreading. The getter is resolved exactly
 * once, under containment, and every other field remains an own-data-only projection.
 */
function highlightIdValue(
  source: object,
): unknown | typeof MISSING_OWN_DATA_DESCRIPTOR | typeof UNSAFE_OWN_DATA_DESCRIPTOR {
  try {
    const descriptor = Object.getOwnPropertyDescriptor(source, 'id');
    if (!descriptor) return MISSING_OWN_DATA_DESCRIPTOR;
    if (Object.hasOwn(descriptor, 'value')) return descriptor.value;
    if (typeof descriptor.get !== 'function') return UNSAFE_OWN_DATA_DESCRIPTOR;
    try {
      return Reflect.apply(descriptor.get, source, []);
    } catch {
      return UNSAFE_OWN_DATA_DESCRIPTOR;
    }
  } catch {
    return UNSAFE_OWN_DATA_DESCRIPTOR;
  }
}

/**
 * Copies the exact display schema every highlight-aware surface reads. Anchors deliberately remain
 * opaque identities: callers can target the original object by reference, while each renderer
 * projects the anchor fields it actually needs through its own descriptor-safe boundary.
 */
function projectLyraHighlight(value: unknown): LyraHighlight | undefined {
  try {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) return undefined;

    const idValue = highlightIdValue(value);
    const anchorValue = dataValue(value, 'anchor');
    if (
      idValue === MISSING_OWN_DATA_DESCRIPTOR ||
      idValue === UNSAFE_OWN_DATA_DESCRIPTOR ||
      anchorValue === MISSING_OWN_DATA_DESCRIPTOR ||
      anchorValue === UNSAFE_OWN_DATA_DESCRIPTOR ||
      typeof idValue !== 'string' ||
      anchorValue === null ||
      typeof anchorValue !== 'object' ||
      Array.isArray(anchorValue)
    )
      return undefined;

    const kind = dataValue(anchorValue, 'kind');
    if (
      kind === MISSING_OWN_DATA_DESCRIPTOR ||
      kind === UNSAFE_OWN_DATA_DESCRIPTOR ||
      typeof kind !== 'string' ||
      kind.trim().length === 0
    )
      return undefined;

    const id = idValue.trim();
    if (id.length === 0) return undefined;

    const label = dataValue(value, 'label');
    const note = dataValue(value, 'note');
    const tone = dataValue(value, 'tone');
    const highlight = Object.freeze({
      id,
      anchor: anchorValue as LyraHighlight['anchor'],
      ...(typeof label === 'string' ? { label } : {}),
      ...(typeof note === 'string' ? { note } : {}),
      ...(typeof tone === 'string' && HIGHLIGHT_TONES.has(tone) ? {
        tone: tone as LyraHighlight['tone'],
      } : {}),
    });
    SNAPSHOT_ANCHOR_KINDS.set(highlight, kind);
    return highlight;
  } catch {
    return undefined;
  }
}

/** Returns the discriminator copied while the immutable highlight snapshot was admitted. */
export function snapshotLyraHighlightAnchorKind(highlight: LyraHighlight): string | undefined {
  return SNAPSHOT_ANCHOR_KINDS.get(highlight);
}

/** Builds the shared immutable highlight snapshot used by highlight-aware viewers. */
export function snapshotLyraHighlights(value: unknown): readonly LyraHighlight[] {
  try {
    if (!Array.isArray(value)) return EMPTY_HIGHLIGHTS;
    const length = dataValue(value, 'length');
    if (
      length === MISSING_OWN_DATA_DESCRIPTOR ||
      length === UNSAFE_OWN_DATA_DESCRIPTOR ||
      !isSafeArrayLength(length)
    )
      return EMPTY_HIGHLIGHTS;

    const output: LyraHighlight[] = [];
    const seenIds = new Set<string>();
    // Inspect one bounded overflow occurrence so an ignored duplicate/blank at the ceiling does
    // not unnecessarily reduce a full 10,000-record snapshot. Rendering has its own lower
    // candidate cap.
    const candidateCount = Math.min(
      length,
      HIGHLIGHT_SNAPSHOT_LIMIT + HIGHLIGHT_SNAPSHOT_OVERFLOW,
    );
    for (
      let index = 0;
      index < candidateCount && output.length < HIGHLIGHT_SNAPSHOT_LIMIT;
      index += 1
    ) {
      const entry = dataValue(value, String(index));
      if (entry === MISSING_OWN_DATA_DESCRIPTOR || entry === UNSAFE_OWN_DATA_DESCRIPTOR) continue;
      const highlight = projectLyraHighlight(entry);
      if (!highlight || seenIds.has(highlight.id)) continue;
      seenIds.add(highlight.id);
      output.push(highlight);
    }
    return Object.freeze(output);
  } catch {
    return EMPTY_HIGHLIGHTS;
  }
}
