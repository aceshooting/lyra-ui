import { html, nothing, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { LyraElement } from '../../internal/lyra-element.js';
import { defineElement } from '../../internal/prefix.js';
import { styles } from './kbd.styles.js';

/** A single rendered key token: the compact glyph shown in the key cap, and
 *  the spelled-out word used in the chip's `aria-label` (glyphs like `⌘`/
 *  `⇧`/`⌥` are not reliably announced across every screen reader/platform
 *  combination, so the accessible name always spells them out in full). */
export interface KbdKeyLabel {
  visual: string;
  word: string;
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
// (it's the delimiter), so callers spell it as the word instead.
const NAMED_KEY_LABELS: Record<string, KbdKeyLabel> = {
  enter: { visual: '↵', word: 'Enter' },
  esc: { visual: 'Esc', word: 'Escape' },
  escape: { visual: 'Esc', word: 'Escape' },
  tab: { visual: 'Tab', word: 'Tab' },
  space: { visual: 'Space', word: 'Space' },
  backspace: { visual: '⌫', word: 'Backspace' },
  delete: { visual: 'Del', word: 'Delete' },
  home: { visual: 'Home', word: 'Home' },
  end: { visual: 'End', word: 'End' },
  pageup: { visual: 'PgUp', word: 'Page Up' },
  pagedown: { visual: 'PgDn', word: 'Page Down' },
  arrowup: { visual: '↑', word: 'Arrow Up' },
  arrowdown: { visual: '↓', word: 'Arrow Down' },
  arrowleft: { visual: '←', word: 'Arrow Left' },
  arrowright: { visual: '→', word: 'Arrow Right' },
  plus: { visual: '+', word: 'Plus' },
  minus: { visual: '−', word: 'Minus' },
};

/**
 * Resolves one `+`-separated token of a `keys` string to its rendered glyph
 * and spelled-out word, given whether the shortcut is being shown on macOS.
 *
 * Exported as a pure function (parameterized on `isMac` rather than reading
 * the module-scope platform constant directly) so both the macOS and
 * non-macOS branches are directly unit-testable without having to spoof
 * `navigator` in a browser test environment that only ever runs as one
 * platform.
 */
export function shortcutTokenLabel(rawToken: string, isMac: boolean): KbdKeyLabel {
  const token = rawToken.trim();
  const lower = token.toLowerCase();

  // 'mod' is the platform-neutral primary modifier: Command on macOS,
  // Control everywhere else. 'ctrl' is deliberately distinct — it always
  // means the literal Control key, even on macOS, for shortcuts that are
  // specifically Ctrl-based (e.g. terminal Ctrl+C) rather than
  // platform-adapted.
  if (lower === 'mod') return isMac ? { visual: '⌘', word: 'Command' } : { visual: 'Ctrl', word: 'Control' };
  if (lower === 'ctrl' || lower === 'control') return { visual: 'Ctrl', word: 'Control' };
  if (lower === 'alt') return isMac ? { visual: '⌥', word: 'Option' } : { visual: 'Alt', word: 'Alt' };
  if (lower === 'shift') return { visual: '⇧', word: 'Shift' };

  const named = NAMED_KEY_LABELS[lower];
  if (named) return named;

  // Anything else renders as typed (preserving the caller's own casing),
  // except a bare single letter/digit, which is upper-cased for a
  // consistent key-cap look ('k' and 'K' both render 'K').
  if (token.length === 1) {
    const upper = token.toUpperCase();
    return { visual: upper, word: upper };
  }
  return { visual: token, word: token };
}

/** Splits a `keys` string (e.g. `'mod+shift+p'`) into its resolved token
 *  labels, dropping empty segments from stray/leading/trailing `+`s. */
export function parseShortcut(keys: string, isMac: boolean): KbdKeyLabel[] {
  return keys
    .split('+')
    .map((t) => t.trim())
    .filter((t) => t.length > 0)
    .map((t) => shortcutTokenLabel(t, isMac));
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
// little cost, however small) from re-detecting it on every <lyra-kbd>
// instance or every re-render.
const IS_MAC = detectIsMac();

/**
 * `<lyra-kbd>` — a small chip representing a keyboard shortcut, rendering
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
 * @customElement lyra-kbd
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
  // pattern as lyra-checkbox's hasLabelSlot/lyra-citation-badge's
  // hasPreviewSlot, so a declaratively-slotted override doesn't flash the
  // keys rendering for one frame before the first slotchange event.
  @state() private hasCustomContent = false;

  protected willUpdate(): void {
    if (!this.hasUpdated) {
      this.hasCustomContent = Array.from(this.childNodes).some((n) => (n.textContent ?? '').trim().length > 0);
    }
  }

  private onSlotChange = (e: Event): void => {
    this.hasCustomContent = (e.target as HTMLSlotElement).assignedNodes({ flatten: true }).length > 0;
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

    const tokens = parseShortcut(this.keys, IS_MAC);
    // role="img" treats the chip as one opaque unit (matching
    // lyra-context-meter's/lyra-chart's canvas usage of the same pattern):
    // the individual glyphs and "+" separators aren't real words, so
    // exposing them as separate accessible-tree text would read worse than
    // the single spelled-out aria-label below. An empty `keys` renders
    // nothing visible, so it's marked aria-hidden instead of exposed as a
    // nameless image.
    const ariaLabel = explicitLabel || tokens.map((t) => t.word).join('+');

    return html`
      <span
        part="base"
        role=${tokens.length > 0 ? 'img' : nothing}
        aria-hidden=${tokens.length === 0 && !explicitLabel ? 'true' : nothing}
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

defineElement('kbd', LyraKbd);

declare global {
  interface HTMLElementTagNameMap {
    'lyra-kbd': LyraKbd;
  }
}
