// Shared emoji-picker data types, extracted so `emoji-data-loader.ts` can type its return without
// importing from `emoji-picker.class.ts` (which imports the loader back) -- that pair was a
// type-only import cycle. `emoji-picker.class.ts` re-exports these, so every public path is unchanged.

export interface EmojiPickerItem {
  emoji: string;
  /** Accessible/searchable name (e.g. 'grinning face'). Used for the picked button's `aria-label`
   *  and as one of the two fields `queryText` matches against. */
  name: string;
  /** Additional searchable aliases (e.g. `['grinning']`). Matched the same way `name` is. */
  shortcodes?: string[];
}

export interface EmojiPickerGroup {
  key: string;
  /** The heading text. For a consumer-supplied group this is rendered verbatim (caller-owned
   *  content is never translated by this library). For a group produced by the built-in
   *  `emoji-picker-element-data` adapter it is the English default that `labelKey` resolves to when
   *  no locale is registered. */
  label: string;
  /** A `LyraMessageKey` naming `label`'s localized form. Set only by the built-in adapter (the
   *  headings come from emojibase's fixed group ids, not from the consumer), so an auto-loaded emoji
   *  set follows `registerLyraLocale()`/`.strings` instead of staying English. Leave it unset on a
   *  hand-authored group and `label` is rendered as-is. */
  labelKey?: string;
  emojis: EmojiPickerItem[];
}
