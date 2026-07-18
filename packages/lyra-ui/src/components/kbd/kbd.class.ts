import { html, nothing, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { LyraElement } from '../../internal/lyra-element.js';
import { hasRealContent } from '../../internal/a11y.js';
import { styles } from './kbd.styles.js';

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

  const named = NAMED_KEY_LABELS[lower];
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

/**
 * Detects macOS to decide whether `mod`/`alt` render their Mac glyphs (⌘/⌥)
 * or their generic-platform text (Ctrl/Alt). Prefers the modern
 * `navigator.userAgentData` (Client Hints) API when the browser exposes it,
 * falling back through `navigator.platform` and finally a `navigator.userAgent`
 * substring check — all three are deprecated/non-standard to varying
 * degrees (`userAgentData` is Chromium-only so far; `platform` is
 * long-deprecated; `userAgent` sniffing is a last resort) but remain, in
 * combination, the practical cross-browser way to answer "is this macOS"
 * today with no dependency.
 */
function detectIsMac(): boolean {
  if (typeof navigator === 'undefined') return false;
  const uaData = (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData;
  if (uaData?.platform) return uaData.platform.toLowerCase().includes('mac');
  if (navigator.platform) return /mac/i.test(navigator.platform);
  return /mac/i.test(navigator.userAgent ?? '');
}

// Computed once at module scope, not per-instance/per-render — a page's
// platform never changes mid-session, so there is nothing to gain (and a
// little cost, however small) from re-detecting it on every <lr-kbd>
// instance or every re-render.
const IS_MAC = detectIsMac();

/**
 * `<lr-kbd>` — a small chip representing a keyboard shortcut, rendering
 * the platform-appropriate glyph for cross-platform modifier keys (⌘ on
 * macOS, "Ctrl" elsewhere) from a single platform-neutral `keys` string.
 *
 * `keys` is a `+`-separated sequence of tokens, e.g. `"mod+k"` or
 * `"mod+shift+p"`. Recognized modifier tokens: `mod` (the platform-neutral
 * primary modifier — ⌘ on macOS, "Ctrl" elsewhere), `alt` (⌥ / "Alt"),
 * `shift` (⇧ on every platform), and `ctrl` (always the literal Control
 * key, distinct from `mod`, for a shortcut that's specifically Ctrl even on
 * macOS). Any other token renders as typed, except a bare single
 * letter/digit which is upper-cased, with a small built-in map of friendly
 * labels for common named keys (`enter` → `↵`, `esc` → "Esc", the four
 * arrow keys → arrow glyphs, plus `tab`/`space`/`backspace`/`delete`/`home`/
 * `end`/`pageup`/`pagedown`/`plus`/`minus`). `enter` renders as its `↵`
 * glyph (not the word "Enter") to match the other single-glyph modifier/
 * arrow keys visually — its spelled-out word form still appears in the
 * computed `aria-label`.
 *
 * Each token renders as its own key cap (`part="key"`); consecutive caps
 * are joined by a small "+" separator between them, matching how most
 * cross-platform shortcut documentation (including on macOS, despite the
 * OS's own native shortcut hints usually running the glyphs together with
 * no separator) reads unambiguously regardless of how many/which glyphs are
 * involved.
 *
 * The default slot is not used for the normal glyph rendering above — it's
 * an escape hatch for fully custom content (e.g. an icon instead of a text
 * glyph) that, when non-empty, replaces the `keys`-driven rendering
 * entirely and stops this component from asserting its own `aria-label`,
 * leaving the slotted content to carry its own accessible name.
 *
 * @customElement lr-kbd
 * @slot - Optional override for fully custom key-cap content, replacing the
 * `keys`-driven rendering. Leave empty to use `keys`.
 * @csspart base - The chip's root element.
 * @csspart key - Each rendered key cap (one per token in `keys`).
 */
export class LyraKbd extends LyraElement {
  static styles = [LyraElement.styles, styles];

  /** A `+`-separated shortcut, e.g. `'mod+k'`. See the class doc for the
   *  full token grammar. */
  @property() keys = '';

  // Real (non-whitespace) light-DOM content overrides the keys-driven
  // rendering below — same "seed synchronously, refine on slotchange"
  // pattern as lr-checkbox's hasLabelSlot/lr-citation-badge's
  // hasPreviewSlot, so a declaratively-slotted override doesn't flash the
  // keys rendering for one frame before the first slotchange event.
  @state() private hasCustomContent = false;

  protected willUpdate(): void {
    if (!this.hasUpdated) {
      this.hasCustomContent = hasRealContent(this.childNodes);
    }
  }

  private onSlotChange = (e: Event): void => {
    this.hasCustomContent = hasRealContent((e.target as HTMLSlotElement).assignedNodes({ flatten: true }));
  };

  render(): TemplateResult {
    const explicitLabel = this.getAttribute('aria-label');

    if (this.hasCustomContent) {
      return html`
        <span part="base" aria-label=${explicitLabel || nothing}>
          <slot @slotchange=${this.onSlotChange}></slot>
        </span>
      `;
    }

    // Deliberately drop the second (fallback) argument here: shortcutTokenLabel's
    // `resolve()` always sets `fallback` to the literal built-in English text for
    // the key (see the module doc), which already matches DEFAULT_STRINGS for
    // every key in this map -- forwarding it into `this.localize()`'s own
    // fallback slot would short-circuit resolveLyraString() before it ever
    // consults a registerLyraLocale()-registered translation. Passing only `key`
    // is intentional (KbdLocalize callers may ignore trailing params).
    const tokens = parseShortcut(this.keys, IS_MAC, (key) => this.localize(key));
    // role="img" treats the chip as one opaque unit (matching
    // lr-context-meter's/lr-chart's canvas usage of the same pattern):
    // the individual glyphs and "+" separators aren't real words, so
    // exposing them as separate accessible-tree text would read worse than
    // the single spelled-out aria-label below. An empty `keys` (and no
    // explicit override) renders nothing visible, so it's marked
    // aria-hidden instead of exposed as a nameless image.
    //
    // role/aria-hidden are both derived from this same `ariaLabel` value
    // (rather than each independently re-deriving "is there a label" from
    // tokens.length/explicitLabel) so role="img" can never be absent while
    // aria-label is present — that combination is an aria-prohibited-attr
    // violation (a nameless-but-labeled, role-less element).
    const ariaLabel = explicitLabel || tokens.map((t) => t.word).join('+');

    return html`
      <span
        part="base"
        role=${ariaLabel ? 'img' : nothing}
        aria-hidden=${ariaLabel ? nothing : 'true'}
        aria-label=${ariaLabel || nothing}
      >
        ${tokens.map(
          (t, i) => html`
            ${i > 0 ? html`<span class="sep" aria-hidden="true">+</span>` : nothing}
            <span part="key">${t.visual}</span>
          `,
        )}
        <slot @slotchange=${this.onSlotChange} hidden></slot>
      </span>
    `;
  }
}


declare global {
  interface HTMLElementTagNameMap {
    'lr-kbd': LyraKbd;
  }
}
