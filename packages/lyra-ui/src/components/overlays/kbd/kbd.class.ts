import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { detectPlatform } from '../../../internal/platform.js';
import { hasRealContent, hostAriaLabel } from '../../../internal/a11y.js';
import { styles } from './kbd.styles.js';
import { parseShortcut } from './kbd-shortcut.js';
export { shortcutTokenLabel, parseShortcut } from './kbd-shortcut.js';
export type { KbdKeyLabel, KbdLocalize } from './kbd-shortcut.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_kbdAltWord, LYRA_DEFAULT_kbdArrowDownWord, LYRA_DEFAULT_kbdArrowLeftWord, LYRA_DEFAULT_kbdArrowRightWord, LYRA_DEFAULT_kbdArrowUpWord, LYRA_DEFAULT_kbdBackspaceWord, LYRA_DEFAULT_kbdCommandWord, LYRA_DEFAULT_kbdControlVisual, LYRA_DEFAULT_kbdControlWord, LYRA_DEFAULT_kbdDeleteVisual, LYRA_DEFAULT_kbdDeleteWord, LYRA_DEFAULT_kbdEndWord, LYRA_DEFAULT_kbdEnterWord, LYRA_DEFAULT_kbdEscapeVisual, LYRA_DEFAULT_kbdEscapeWord, LYRA_DEFAULT_kbdHomeWord, LYRA_DEFAULT_kbdMinusWord, LYRA_DEFAULT_kbdOptionWord, LYRA_DEFAULT_kbdPageDownVisual, LYRA_DEFAULT_kbdPageDownWord, LYRA_DEFAULT_kbdPageUpVisual, LYRA_DEFAULT_kbdPageUpWord, LYRA_DEFAULT_kbdPlusWord, LYRA_DEFAULT_kbdShiftWord, LYRA_DEFAULT_kbdSpaceWord, LYRA_DEFAULT_kbdTabWord } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END


/** Platform vocabulary used to resolve the platform-neutral `mod` and `alt` shortcut tokens. */
export type KbdPlatform = 'auto' | 'mac' | 'windows' | 'linux';
/** Concrete platform produced after resolving `platform="auto"`. */
export type EffectiveKbdPlatform = Exclude<KbdPlatform, 'auto'>;

// Computed once at module scope, not per-instance/per-render — a page's
// platform never changes mid-session, so there is nothing to gain (and a
// little cost, however small) from re-detecting it on every <lr-kbd>
// instance or every re-render.
const AUTO_PLATFORM = detectPlatform();

function isEffectivePlatform(value: string | null): value is EffectiveKbdPlatform {
  return value === 'mac' || value === 'windows' || value === 'linux';
}

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
 * glyph) that, when non-empty, replaces the `keys`-driven rendering.
 * A host `aria-label` names that custom shortcut as one `role="img"` unit;
 * without one, the slotted content continues to own its own semantics.
 *
 * Removing keys safely clears the shortcut. Unknown tokens, including constructor and __proto__, render and name themselves verbatim; recognized modifiers keep their localized labels.
 *
 * @customElement lr-kbd
 * @slot - Optional override for fully custom key-cap content, replacing the
 * `keys`-driven rendering. Leave empty to use `keys`.
 * @csspart base - The chip's root element.
 * @csspart key - Each rendered key cap (one per token in `keys`).
 * @status stable
 * @since 4.0.0
 */
export class LyraKbd extends LyraElement {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    kbdAltWord: LYRA_DEFAULT_kbdAltWord,
    kbdArrowDownWord: LYRA_DEFAULT_kbdArrowDownWord,
    kbdArrowLeftWord: LYRA_DEFAULT_kbdArrowLeftWord,
    kbdArrowRightWord: LYRA_DEFAULT_kbdArrowRightWord,
    kbdArrowUpWord: LYRA_DEFAULT_kbdArrowUpWord,
    kbdBackspaceWord: LYRA_DEFAULT_kbdBackspaceWord,
    kbdCommandWord: LYRA_DEFAULT_kbdCommandWord,
    kbdControlVisual: LYRA_DEFAULT_kbdControlVisual,
    kbdControlWord: LYRA_DEFAULT_kbdControlWord,
    kbdDeleteVisual: LYRA_DEFAULT_kbdDeleteVisual,
    kbdDeleteWord: LYRA_DEFAULT_kbdDeleteWord,
    kbdEndWord: LYRA_DEFAULT_kbdEndWord,
    kbdEnterWord: LYRA_DEFAULT_kbdEnterWord,
    kbdEscapeVisual: LYRA_DEFAULT_kbdEscapeVisual,
    kbdEscapeWord: LYRA_DEFAULT_kbdEscapeWord,
    kbdHomeWord: LYRA_DEFAULT_kbdHomeWord,
    kbdMinusWord: LYRA_DEFAULT_kbdMinusWord,
    kbdOptionWord: LYRA_DEFAULT_kbdOptionWord,
    kbdPageDownVisual: LYRA_DEFAULT_kbdPageDownVisual,
    kbdPageDownWord: LYRA_DEFAULT_kbdPageDownWord,
    kbdPageUpVisual: LYRA_DEFAULT_kbdPageUpVisual,
    kbdPageUpWord: LYRA_DEFAULT_kbdPageUpWord,
    kbdPlusWord: LYRA_DEFAULT_kbdPlusWord,
    kbdShiftWord: LYRA_DEFAULT_kbdShiftWord,
    kbdSpaceWord: LYRA_DEFAULT_kbdSpaceWord,
    kbdTabWord: LYRA_DEFAULT_kbdTabWord,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static override styles = [LyraElement.styles, styles];

  /** A `+`-separated shortcut, e.g. `'mod+k'`. See the class doc for the
   *  full token grammar. */
  @property() keys = '';

  /** Platform used for the platform-neutral `mod` and `alt` tokens. `auto` performs browser
   * detection; an explicit value is deterministic across browsers, SSR, screenshots, and tests. */
  @property({ reflect: true }) platform: KbdPlatform = 'auto';

  // The browser-only default is snapshotted into rendered output. Hydration adopts that serialized
  // choice rather than re-sniffing in a different realm and replacing server-rendered key caps.
  private autoPlatform: EffectiveKbdPlatform = AUTO_PLATFORM;

  /** The concrete, serializable platform currently used to render the shortcut. */
  get effectivePlatform(): EffectiveKbdPlatform {
    return this.platform === 'auto' ? this.autoPlatform : this.platform;
  }

  // Real (non-whitespace) light-DOM content overrides the keys-driven
  // rendering below — same "seed synchronously, refine on slotchange"
  // pattern as lr-checkbox's hasLabelSlot/lr-citation-badge's
  // hasPreviewSlot, so a declaratively-slotted override doesn't flash the
  // keys rendering for one frame before the first slotchange event.
  @state() private hasCustomContent = false;

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    if (!this.hasUpdated && this.platform === 'auto') {
      const serialized = this.renderRoot
        ?.querySelector<HTMLElement>('[data-effective-platform]')
        ?.getAttribute('data-effective-platform') ?? null;
      if (isEffectivePlatform(serialized)) this.autoPlatform = serialized;
    }
    // A server render sees no light-DOM children, so a hydrating chip reproduces the server's
    // keys rendering first and adopts slotted content on the very next update instead.
    this.seedFirstRenderState(() => {
      this.hasCustomContent = hasRealContent(this.childNodes);
    });
  }

  private onSlotChange = (e: Event): void => {
    this.hasCustomContent = hasRealContent((e.target as HTMLSlotElement).assignedNodes({ flatten: true }));
  };

  override render(): TemplateResult {
    const explicitLabel = hostAriaLabel(this);

    // Deliberately drop the second (fallback) argument here: shortcutTokenLabel's
    // `resolve()` always sets `fallback` to the literal built-in English text for
    // the key (see the module doc), which already matches DEFAULT_STRINGS for
    // every key in this map -- forwarding it into `this.localize()`'s own
    // fallback slot would short-circuit resolveLyraString() before it ever
    // consults a registerLyraLocale()-registered translation. Passing only `key`
    // is intentional (KbdLocalize callers may ignore trailing params).
    const tokens = this.hasCustomContent
      ? []
      : parseShortcut(this.keys ?? '', this.effectivePlatform === 'mac', (key) => this.localize(key));
    // role="img" treats the chip as one opaque unit (matching
    // lr-context-meter's/lr-chart's canvas usage of the same pattern):
    // the individual glyphs and "+" separators aren't real words, so
    // exposing them as separate accessible-tree text would read worse than
    // the single spelled-out aria-label below. An empty `keys` (and no
    // explicit override) renders nothing visible, so it's marked
    // aria-hidden instead of exposed as a nameless image.
    //
    // The host's authored label wins by attribute presence, including an
    // explicit empty string. Keep that presence signal alongside the string:
    // an absent label and no tokens also produce an empty string, but must
    // remain the hidden, non-image state.
    const ariaLabel = explicitLabel ?? tokens.map((t) => t.word).join('+');
    const hasAriaLabel = explicitLabel !== null || tokens.length > 0;

    // One outer template for both renderings, with the branch inside it. Slotted content is only
    // discoverable in a browser, so a hydrating chip switches branches on its second update -- and
    // a swap of the *outer* template would discard (rather than reuse) the server's markup.
    return html`
      <span
        part="base"
        data-effective-platform=${this.effectivePlatform}
        role=${hasAriaLabel ? 'img' : nothing}
        aria-hidden=${!this.hasCustomContent && !hasAriaLabel ? 'true' : nothing}
        aria-label=${hasAriaLabel ? ariaLabel : nothing}
      >
        ${this.hasCustomContent
          ? html`<slot @slotchange=${this.onSlotChange}></slot>`
          : html`${tokens.map(
              (t, i) => html`
                ${i > 0 ? html`<span class="sep" aria-hidden="true">+</span>` : nothing}
                <span part="key">${t.visual}</span>
              `,
            )}
            <slot @slotchange=${this.onSlotChange} hidden></slot>`}
      </span>
    `;
  }
}


declare global {
  interface HTMLElementTagNameMap {
    'lr-kbd': LyraKbd;
  }
}
