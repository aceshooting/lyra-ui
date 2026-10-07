/** A single rendered key token: the compact glyph shown in the key cap, and
 *  the spelled-out word used in the chip's `aria-label` (glyphs like `⌘`/
 *  `⇧`/`⌥` are not reliably announced across every screen reader/platform
 *  combination, so the accessible name always spells them out in full). */
export interface KbdKeyLabel {
  visual: string;
  word: string;
}

/** Resolves a localization key to its localized text, falling back to
 *  `fallback` (the built-in English default) when no override applies --
 *  matches `LyraElement.localize()`'s own `(key, fallback)` shape, so a
 *  component can pass `(key, fallback) => this.localize(key, fallback)`
 *  directly. */
export type KbdLocalize = (key: string, fallback: string) => string;

interface NamedKeyLabel {
  visual: string;
  /** Localization key for `visual`, present only when it's real spelled/
   *  abbreviated text a locale would want to control -- omitted for the
   *  glyph-only visuals (e.g. `'↵'`, `'⌫'`, the arrow glyphs), which aren't
   *  translatable words. */
  visualKey?: string;
  word: string;
  /** Localization key for `word` -- every named key has one; `word` is
   *  always spelled-out text, never a bare glyph. */
  wordKey: string;
}

// A deliberately small map — just the modifier-adjacent/navigation keys
// common enough in real shortcuts to be worth a friendly glyph. Anything not
// listed here (e.g. 'f1', 'k', a punctuation key) falls through to the
// generic "render as typed, upper-case single letters" rule in
// `shortcutTokenLabel` below, per this component's spec.
//
// 'plus'/'minus' exist specifically so a shortcut that includes a literal
// "+" or "-" key (e.g. the classic zoom-in shortcut) has a way to say so:
// the '+'-separated `keys` grammar can't itself carry a literal "+" token
// (it's the delimiter), so callers spell it as the word instead. Their own
// `visual` ('+'/'−') is a bare punctuation symbol, not a translatable word,
// so (like the glyph-only entries) it has no `visualKey`.
const NAMED_KEY_LABELS: Record<string, NamedKeyLabel> = {
  enter: { visual: '↵', word: 'Enter', wordKey: 'kbdEnterWord' },
  esc: { visual: 'Esc', visualKey: 'kbdEscapeVisual', word: 'Escape', wordKey: 'kbdEscapeWord' },
  escape: { visual: 'Esc', visualKey: 'kbdEscapeVisual', word: 'Escape', wordKey: 'kbdEscapeWord' },
  tab: { visual: 'Tab', visualKey: 'kbdTabWord', word: 'Tab', wordKey: 'kbdTabWord' },
  space: { visual: 'Space', visualKey: 'kbdSpaceWord', word: 'Space', wordKey: 'kbdSpaceWord' },
  backspace: { visual: '⌫', word: 'Backspace', wordKey: 'kbdBackspaceWord' },
  delete: { visual: 'Del', visualKey: 'kbdDeleteVisual', word: 'Delete', wordKey: 'kbdDeleteWord' },
  home: { visual: 'Home', visualKey: 'kbdHomeWord', word: 'Home', wordKey: 'kbdHomeWord' },
  end: { visual: 'End', visualKey: 'kbdEndWord', word: 'End', wordKey: 'kbdEndWord' },
  pageup: { visual: 'PgUp', visualKey: 'kbdPageUpVisual', word: 'Page Up', wordKey: 'kbdPageUpWord' },
  pagedown: { visual: 'PgDn', visualKey: 'kbdPageDownVisual', word: 'Page Down', wordKey: 'kbdPageDownWord' },
  arrowup: { visual: '↑', word: 'Arrow Up', wordKey: 'kbdArrowUpWord' },
  arrowdown: { visual: '↓', word: 'Arrow Down', wordKey: 'kbdArrowDownWord' },
  arrowleft: { visual: '←', word: 'Arrow Left', wordKey: 'kbdArrowLeftWord' },
  arrowright: { visual: '→', word: 'Arrow Right', wordKey: 'kbdArrowRightWord' },
  plus: { visual: '+', word: 'Plus', wordKey: 'kbdPlusWord' },
  minus: { visual: '−', word: 'Minus', wordKey: 'kbdMinusWord' },
};

/**
 * Resolves one `+`-separated token of a `keys` string to its rendered glyph
 * and spelled-out word, given whether the shortcut is being shown on macOS.
 *
 * The platform and localization inputs are explicit so the function remains
 * deterministic for callers and preserves the built-in English defaults when
 * no localization function is supplied.
 */
export function shortcutTokenLabel(rawToken: string, isMac: boolean, localize?: KbdLocalize): KbdKeyLabel {
  const token = rawToken.trim();
  const lower = token.toLowerCase();
  const resolve = (key: string | undefined, fallback: string): string =>
    key && localize ? localize(key, fallback) : fallback;

  // 'mod' is the platform-neutral primary modifier: Command on macOS,
  // Control everywhere else. 'ctrl' is deliberately distinct — it always
  // means the literal Control key, even on macOS, for shortcuts that are
  // specifically Ctrl-based (e.g. terminal Ctrl+C) rather than
  // platform-adapted.
  if (lower === 'mod') {
    return isMac
      ? { visual: '⌘', word: resolve('kbdCommandWord', 'Command') }
      : { visual: resolve('kbdControlVisual', 'Ctrl'), word: resolve('kbdControlWord', 'Control') };
  }
  if (lower === 'ctrl' || lower === 'control') {
    return { visual: resolve('kbdControlVisual', 'Ctrl'), word: resolve('kbdControlWord', 'Control') };
  }
  if (lower === 'alt') {
    return isMac
      ? { visual: '⌥', word: resolve('kbdOptionWord', 'Option') }
      : { visual: resolve('kbdAltWord', 'Alt'), word: resolve('kbdAltWord', 'Alt') };
  }
  if (lower === 'shift') return { visual: '⇧', word: resolve('kbdShiftWord', 'Shift') };

  const named = Object.hasOwn(NAMED_KEY_LABELS, lower) ? NAMED_KEY_LABELS[lower] : undefined;
  if (named) {
    return { visual: resolve(named.visualKey, named.visual), word: resolve(named.wordKey, named.word) };
  }

  // Anything else renders as typed (preserving the caller's own casing),
  // except a bare single letter/digit, which is upper-cased for a
  // consistent key-cap look ('k' and 'K' both render 'K'). Neither branch is
  // a translatable word (an arbitrary key letter/digit, or an unrecognized
  // token rendered verbatim), so neither ever consults `localize`.
  if (token.length === 1) {
    const upper = token.toUpperCase();
    return { visual: upper, word: upper };
  }
  return { visual: token, word: token };
}

/** Splits a `keys` string (e.g. `'mod+shift+p'`) into its resolved token
 *  labels, dropping empty segments from stray/leading/trailing `+`s. */
export function parseShortcut(keys: string, isMac: boolean, localize?: KbdLocalize): KbdKeyLabel[] {
  return keys
    .split('+')
    .map((t) => t.trim())
    .filter((t) => t.length > 0)
    .map((t) => shortcutTokenLabel(t, isMac, localize));
}

