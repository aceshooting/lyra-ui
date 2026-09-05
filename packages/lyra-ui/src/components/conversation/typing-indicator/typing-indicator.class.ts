import type { PropertyValues } from 'lit';
import { html, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import type { LyraSize } from '../../../internal/variants.js';
import { srOnly } from '../../../internal/a11y.js';
import { styles } from './typing-indicator.styles.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_thinking } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END


/**
 * Which decorative animation shape to draw.
 */
export type TypingIndicatorShape = 'dots' | 'pulse' | 'cursor';
/**
 * An alias of the shared {@linkcode LyraSize} ladder, so this component speaks the same size
 * vocabulary as everything else (it used to have a private `'sm' | 'md'` scale of its own).
 * A presence cue has three usefully distinguishable sizes rather than six, so the ladder renders as
 * three tiers: `2xs`/`xs`/`s`/`small` are compact, `m`/`medium` is the default, and
 * `l`/`large`/`xl` are roomy. Every accepted value matches a rule — none is silently inert.
 */
export type TypingIndicatorSize = LyraSize;

/**
 * `<lr-typing-indicator>` — a purely presentational "assistant is
 * responding" presence cue. No events, no interactivity: a consumer mounts
 * it while a response is being generated and removes it (or hides it) once
 * real content has arrived.
 *
 * Three visual shapes share one component rather than three separate tags
 * because callers pick between them along a single axis — how the
 * surrounding surface wants the cue to read — and nothing else about the
 * component differs:
 * - `dots` (default) — three dots with a staggered bounce, the classic
 *   "typing…" affordance for a standalone status line.
 * - `pulse` — a single breathing dot, a quieter cue for a tighter space
 *   (e.g. next to an avatar).
 * - `cursor` — a blinking vertical bar, meant to sit inline at the tail end
 *   of streamed text that is still being appended to.
 *
 * Accessibility: this indicator typically mounts and unmounts around a real
 * generation lifecycle (appears when a response starts, disappears once one
 * arrives) rather than emitting a stream of updates of its own, so it does
 * *not* route through `<lr-live-region>`/`Announcer`
 * (`../../internal/announcer.js`) — that machinery exists to coalesce many
 * rapidly-changing announcements into one, and there is only ever a single
 * announcement here: the mount itself. A plain `role="status"` plus an
 * accessible name derived from `label` is sufficient, set both as an
 * `aria-label` on the host *and* as a visually-hidden text node in the
 * shadow tree, so the name survives even if only one of the two is picked up
 * by a given assistive-tech/browser pairing. An empty or whitespace-only
 * `label` falls back to the localized "Thinking…" copy in
 * both places, rather than leaving the component with no accessible name at
 * all. An `aria-label` set directly on the host element (the idiomatic way to
 * name any custom element) wins over the `label`-derived default, in both
 * places -- the host attribute is never silently clobbered on first render.
 * The animated dots/pulse/cursor
 * shape is `aria-hidden="true"` — it's decorative; `label` is the entire
 * accessible content, so nothing narrates individual animation frames.
 *
 * @customElement lr-typing-indicator
 * @csspart base - The decorative (`aria-hidden`) wrapper around the animated shape.
 * @csspart dot - Each of the three dots in the `dots` shape.
 * @csspart pulse - The single pulsing dot in the `pulse` shape.
 * @csspart cursor - The blinking bar in the `cursor` shape.
 * @cssprop [--lr-typing-dot-size=var(--lr-space-s)] - Diameter of each dot in the `dots` and
 * `pulse` variants. The `size` property supplies compact and roomy tier overrides.
 * @cssprop [--lr-typing-gap=var(--lr-space-xs)] - Gap between dots in the `dots` variant. The
 * `size` property supplies compact and roomy tier overrides.
 * @cssprop [--lr-inline-cursor-width=var(--lr-size-0-125rem)] - Shared inline-cursor width. The
 * `size` property supplies compact and roomy tier fallbacks.
 * @cssprop [--lr-inline-cursor-height=var(--lr-size-1em)] - Shared inline-cursor height.
 * @cssprop [--lr-typing-duration=var(--lr-transition-ambient)] - Animation duration and timing
 * function for the dot-bounce/pulse/cursor-blink loop, shared by all variants. Aliases the
 * shared `--lr-transition-ambient` token (default `1.8s ease-in-out`) by default, so retiming
 * just this component doesn't affect other ambient-looping components in the library.
 * @cssprop [--lr-typing-dot-stagger-1=600ms] - Delay for the second dot in the dots variant.
 * @cssprop [--lr-typing-dot-stagger-2=1200ms] - Delay for the third dot in the dots variant.
 * @status stable
 * @since 4.0.0
 */
export class LyraTypingIndicator extends LyraElement {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    thinking: LYRA_DEFAULT_thinking,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static override styles = [LyraElement.styles, styles, srOnly];

  /** Which decorative presentation to render. */
  @property({ reflect: true }) shape: TypingIndicatorShape = 'dots';

  /** Accessible name, exposed via `role="status"`. Not re-announced on every
   *  animation frame — only mount (and any later change to this property)
   *  produces a new announcement. Removing the attribute restores the localized fallback; an
   *  explicit host aria-label keeps precedence. An empty or whitespace-only value falls
   *  back to the localized "Thinking…" copy (see
   *  `accessibleLabel`) so the component never loses its accessible name. */
  @property() label = '';

  /** Visual size on the shared ladder — drop to `s`/`small` (or below) for dense layouts, e.g.
   *  inline with a message bubble. `'m'` (the default) is the standalone status-line size. */
  @property({ reflect: true }) size: TypingIndicatorSize = 'm';

  // `label` supplies the default accessible name, but an author-provided host `aria-label` must
  // win (the idiomatic way to name any custom element for assistive tech) -- tracked the same way
  // `<lr-gauge>` tracks its own `explicitAriaLabel`/`appliedAriaLabel` pair, so later `label`
  // updates stay distinguishable from author attribute edits: the value last applied by this
  // component is remembered, and only a *different* current `aria-label` (i.e. one the host, not
  // this component, just wrote) is captured as the override.
  private appliedAriaLabel: string | null = null;
  private explicitAriaLabel: string | null = null;

  /** The accessible name actually used: an explicit host `aria-label` wins outright; otherwise
   *  falls back to the localized `'thinking'` message (`"Thinking…"` in English) when `label` is
   *  empty/whitespace-only -- otherwise both the
   *  `aria-label` and the sr-only text node would go blank, leaving this purely-decorative
   *  component with no accessible name at all. A caller-customized `label` is used verbatim (not a
   *  translation concern), same convention as `<lr-date-picker>`'s `previousLabel`. */
  private get accessibleLabel(): string {
    if (this.explicitAriaLabel !== null) return this.explicitAriaLabel;
    const trimmed = (this.label ?? '').trim();
    return trimmed === '' ? this.localize('thinking') : trimmed;
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    this.setAttribute('role', 'status');
    const currentAriaLabel = this.getAttribute('aria-label');
    if (currentAriaLabel !== this.appliedAriaLabel) {
      this.explicitAriaLabel = currentAriaLabel;
    }
    this.setAttribute('aria-label', this.accessibleLabel);
    this.appliedAriaLabel = this.accessibleLabel;
  }

  override render(): TemplateResult {
    return html`
      <span part="base" aria-hidden="true">${this.renderShape()}</span>
      <span class="sr-only">${this.accessibleLabel}</span>
    `;
  }

  private renderShape(): TemplateResult {
    switch (this.shape) {
      case 'pulse':
        return html`<span part="pulse"></span>`;
      case 'cursor':
        return html`<span part="cursor"></span>`;
      case 'dots':
      default:
        return html`<span part="dot"></span><span part="dot"></span><span part="dot"></span>`;
    }
  }
}


declare global {
  interface HTMLElementTagNameMap {
    'lr-typing-indicator': LyraTypingIndicator;
  }
}
