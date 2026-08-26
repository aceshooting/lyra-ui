import type { LyraHighlight } from '../components/viewers/document-viewer/anchors.js';

/** Maximum host-highlight records admitted into one immutable target snapshot. */
export const HIGHLIGHT_SNAPSHOT_LIMIT = 10_000;

const HIGHLIGHT_SNAPSHOT_OVERFLOW = 1;
const EMPTY_HIGHLIGHTS: readonly LyraHighlight[] = Object.freeze([]);

/** Builds the shared immutable highlight snapshot used by highlight-aware viewers. */
export function snapshotLyraHighlights(value: unknown): readonly LyraHighlight[] {
  if (!Array.isArray(value)) return EMPTY_HIGHLIGHTS;
  const output: LyraHighlight[] = [];
  const seenIds = new Set<string>();
  // Inspect one bounded overflow occurrence so an ignored duplicate/blank at the ceiling does not
  // unnecessarily reduce a full 10,000-record snapshot. Rendering has its own lower candidate cap.
  const candidateCount = Math.min(
    value.length,
    HIGHLIGHT_SNAPSHOT_LIMIT + HIGHLIGHT_SNAPSHOT_OVERFLOW,
  );
  for (
    let index = 0;
    index < candidateCount && output.length < HIGHLIGHT_SNAPSHOT_LIMIT;
    index++
  ) {
    try {
      const highlight: unknown = value[index];
      if (
        highlight === null ||
        typeof highlight !== 'object' ||
        Array.isArray(highlight)
      ) continue;
      // Spread once so an accessor-backed record is admitted without invoking its getters twice
      // (first for identity and again for ownership). The clone keeps `anchor` by reference.
      const owned = { ...highlight } as Record<string, unknown>;
      const rawId = owned['id'];
      if (typeof rawId !== 'string') continue;
      const id = rawId.trim();
      if (id.length === 0 || seenIds.has(id)) continue;
      // The anchor must be a discriminated object so every adopter's `highlight.anchor.kind`
      // dereference is safe by construction; beyond that it remains an opaque caller identity --
      // several viewers deliberately support `scrollToAnchor(highlight.anchor)` by reference, so
      // once admitted it is pushed unchanged (never cloned).
      const anchor = owned['anchor'];
      const anchorKind =
        anchor !== null && typeof anchor === 'object' && !Array.isArray(anchor)
          ? (anchor as Record<string, unknown>)['kind']
          : undefined;
      if (
        anchor === null ||
        typeof anchor !== 'object' ||
        Array.isArray(anchor) ||
        typeof anchorKind !== 'string' ||
        anchorKind.trim().length === 0
      ) continue;
      seenIds.add(id);
      output.push(Object.freeze({ ...owned, id }) as unknown as LyraHighlight);
    } catch {
      // Keep later valid records when an admitted entry has a hostile getter.
    }
  }
  return Object.freeze(output);
}
