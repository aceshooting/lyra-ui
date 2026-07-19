import type { OptionalPeerApi } from '../../../internal/optional-peer-types.js';
import type { EmojiPickerGroup } from './emoji-picker.class.js';

export type EmojiDataApi = OptionalPeerApi;

let cached: Promise<EmojiPickerGroup[] | null> | undefined;

/**
 * Loads the optional peer dependency `emoji-picker-element-data` and adapts its JSON export into
 * this component's own `EmojiPickerGroup[]` shape via `adaptEmojiPickerElementData()` below. Never
 * throws — resolves `null` (with a one-time `console.warn`) if the peer isn't installed or the
 * import otherwise fails, mirroring `pdf-loader.ts`'s `loadPdfJsDeps()` exact shape. `importData` is
 * an injectable seam for tests (see `emoji-data-loader.test.ts`).
 */
export async function loadEmojiData(
  importData: () => Promise<OptionalPeerApi> = () =>
    import('emoji-picker-element-data/en/emojibase/data.json', { with: { type: 'json' } }) as Promise<OptionalPeerApi>,
): Promise<EmojiPickerGroup[] | null> {
  try {
    const raw = await importData();
    return adaptEmojiPickerElementData(raw);
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
 * `GROUP_LABELS` lookup above (the raw entries carry no label of their own).
 */
function adaptEmojiPickerElementData(raw: OptionalPeerApi): EmojiPickerGroup[] {
  const entries = Array.isArray(raw) ? raw : [];
  const byGroup = new Map<number, EmojiPickerGroup>();
  for (const entry of entries as Array<{
    emoji?: string;
    group?: number;
    annotation?: string;
    shortcodes?: string[];
  }>) {
    if (!entry.emoji || !entry.annotation || entry.group === undefined) continue;
    let bucket = byGroup.get(entry.group);
    if (!bucket) {
      bucket = { key: String(entry.group), label: GROUP_LABELS[entry.group] ?? `Group ${entry.group}`, emojis: [] };
      byGroup.set(entry.group, bucket);
    }
    bucket.emojis.push({ emoji: entry.emoji, name: entry.annotation, shortcodes: entry.shortcodes });
  }
  return [...byGroup.entries()].sort(([a], [b]) => a - b).map(([, group]) => group);
}
