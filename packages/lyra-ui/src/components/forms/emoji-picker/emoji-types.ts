// Shared emoji-picker data types, extracted so `emoji-data-loader.ts` can type its return without
// importing from `emoji-picker.class.ts` (which imports the loader back) -- that pair was a
// type-only import cycle. `emoji-picker.class.ts` re-exports these, so every public path is unchanged.

export interface EmojiPickerItem {
  readonly emoji: string;
  /** Accessible/searchable name (e.g. 'grinning face'). Used for the picked button's `aria-label`
   *  and as one of the two fields `queryText` matches against. */
  readonly name: string;
  /** Additional searchable aliases (e.g. `['grinning']`). Matched the same way `name` is. */
  readonly shortcodes?: readonly string[];
}

export interface EmojiPickerGroup {
  readonly key: string;
  /** The heading text. Consumer-supplied content is rendered verbatim. Groups produced by the
   *  built-in data adapter are recognized privately by their canonical numeric key so their
   *  library-owned headings can be localized without exposing localization metadata here. */
  readonly label: string;
  readonly emojis: readonly EmojiPickerItem[];
}
