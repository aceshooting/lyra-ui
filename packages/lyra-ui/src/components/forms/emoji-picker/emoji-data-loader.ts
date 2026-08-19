import type { EmojiPickerGroup, EmojiPickerItem } from './emoji-types.js';

export type EmojiDataApi = unknown;

let cached: Promise<EmojiPickerGroup[] | null> | undefined;

/**
 * Loads the optional peer dependency `emoji-picker-element-data` and adapts its JSON export into
 * this component's own `EmojiPickerGroup[]` shape via `adaptEmojiPickerElementData()` below. Never
 * throws — resolves `null` (with a one-time `console.warn`) if the peer isn't installed, the import
 * otherwise fails, or the resolved module matches neither the expected bare-array nor
 * `{ default: [...] }` namespace shape (a broken or spoofed peer) — that last case fails closed
 * rather than silently folding into `[]`, which would be indistinguishable from a well-formed peer
 * that legitimately produced zero groups. Mirrors `pdf-loader.ts`'s `loadPdfJsDeps()` exact shape.
 * `importData` is an injectable seam for tests (see `emoji-data-loader.test.ts`).
 */
export async function loadEmojiData(
  importData: () => Promise<unknown> = () =>
    import('emoji-picker-element-data/en/emojibase/data.json', { with: { type: 'json' } }),
): Promise<EmojiPickerGroup[] | null> {
  try {
    const raw = await importData();
    const adapted = adaptEmojiPickerElementData(raw);
    if (adapted === null) {
      // Neither a bare array nor a `{ default: [...] }` namespace -- a broken or spoofed peer,
      // not a legitimately-installed one with zero entries. Throwing here (rather than returning
      // `[]`) routes it through the same fail-closed warning below instead of silently rendering
      // indistinguishably from "this peer legitimately has no data".
      throw new TypeError(
        'The emoji-picker-element-data peer does not expose the expected array (or ' +
          '{ default: array }) shape.',
      );
    }
    return adapted;
  } catch (error) {
    console.warn(
      '<lr-emoji-picker> needs the optional peer dependency `emoji-picker-element-data` to show a ' +
        'default emoji set — install it with `pnpm add emoji-picker-element-data`, or supply `groups` ' +
        'directly:',
      error,
    );
    return null;
  }
}

/** Cached per page, mirroring `pdf-loader.ts`'s `loadPdfJs()` single-flight shape. */
export function loadEmojiDataCached(): Promise<EmojiPickerGroup[] | null> {
  if (!cached) cached = loadEmojiData();
  return cached;
}

/** @internal Test-only cache reset. */
export function clearEmojiDataCache(): void {
  cached = undefined;
}

// Group id -> label, mirroring emojibase's own canonical grouping (verified 2026-07-17 against
// `emojibase-data`'s published `meta/groups.json` and `emoji-picker-element`'s own
// `src/picker/groups.js` + `src/picker/i18n/en.js`, since `emoji-picker-element-data`'s flat
// `data.json` entries carry only a numeric `group` id with no label of their own). Id 2
// ("component") covers skin-tone/hair-style modifier swatches, which are intentionally included
// here for completeness even though this component has no skin-tone UI of its own (see the class
// doc on `LyraEmojiPicker`) -- entries in that group are rare in practice and simply render under a
// "Component" heading like any other group if present in a consumer's raw payload.
const GROUP_LABELS: Record<number, string> = {
  0: 'Smileys & Emotion',
  1: 'People & Body',
  2: 'Component',
  3: 'Animals & Nature',
  4: 'Food & Drink',
  5: 'Travel & Places',
  6: 'Activities',
  7: 'Objects',
  8: 'Symbols',
  9: 'Flags',
};

/**
 * Adapts `emoji-picker-element-data`'s raw JSON export (e.g. `en/emojibase/data.json`) into
 * `EmojiPickerGroup[]`.
 *
 * VERIFIED SHAPE (2026-07-17, fetched the real published `emoji-picker-element-data@latest/en/
 * emojibase/data.json` from unpkg since the package isn't installed anywhere in this monorepo): a
 * flat array of entries, each carrying `emoji` (the glyph -- NOT `unicode`), `group` (a numeric
 * category id per emojibase's `meta/groups.json`), `annotation` (the human-readable name), and an
 * optional `shortcodes` array (plus other fields this adapter ignores: `tags`, `order`, `version`,
 * `emoticon`, `skins`). Entries are bucketed by `group`, and each bucket's label comes from the
 * `GROUP_LABELS` lookup above (the raw entries carry no label of their own). The picker keeps the
 * built-in provenance and localization-key mapping private, so this adapter does not leak internal
 * localization metadata into the consumer-authored `EmojiPickerGroup` contract.
 *
 * Returns `null` -- rather than `[]` -- when `raw` matches neither the bare-array nor the
 * `{ default: [...] }` namespace shape, so `loadEmojiData()` can fail closed (a broken or spoofed
 * peer) instead of that being indistinguishable from a well-formed peer that legitimately produced
 * zero groups.
 */
function adaptEmojiPickerElementData(raw: unknown): EmojiPickerGroup[] | null {
  // A JSON module import resolves to either the bare array directly or a namespace object
  // wrapping it as `.default`, depending on the bundler/interop configuration doing the
  // resolving -- confirmed against the real published package: Node's native JSON import
  // attributes resolve it as `{ default: [...] }`, not a bare array. Falling back to `.default`
  // when `raw` itself isn't an array (rather than assuming the bare-array shape and silently
  // substituting `[]` for the real data) mirrors spreadsheet-loader.ts's identical fallback.
  const candidate = (raw as { default?: unknown } | null)?.default;
  const entries = Array.isArray(raw) ? raw : Array.isArray(candidate) ? candidate : null;
  if (entries === null) return null;
  const byGroup = new Map<number, Omit<EmojiPickerGroup, 'emojis'> & { emojis: EmojiPickerItem[] }>();
  for (const entry of entries as Array<{
    emoji?: string;
    group?: number;
    annotation?: string;
    shortcodes?: string[];
  }>) {
    if (!entry.emoji || !entry.annotation || entry.group === undefined) continue;
    let bucket = byGroup.get(entry.group);
    if (!bucket) {
      bucket = {
        key: String(entry.group),
        // A bare numeric fallback, deliberately NOT assembled English prose: this loader is a
        // plain module with no `localize()` in scope. `<lr-emoji-picker>`'s own `groupLabel()`
        // localizes any built-in group id it doesn't recognize (via the `emojiPickerGroupUnknown`
        // DEFAULT_STRINGS key) at render time instead of reading this field for that case; this
        // value only reaches a caller who consumes `loadEmojiData()` directly.
        label: GROUP_LABELS[entry.group] ?? String(entry.group),
        emojis: [],
      };
      byGroup.set(entry.group, bucket);
    }
    bucket.emojis.push({ emoji: entry.emoji, name: entry.annotation, shortcodes: entry.shortcodes });
  }
  return [...byGroup.entries()].sort(([a], [b]) => a - b).map(([, group]) => group);
}
