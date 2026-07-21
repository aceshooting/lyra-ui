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
  label: string;
  emojis: EmojiPickerItem[];
}
