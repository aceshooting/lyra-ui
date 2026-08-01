import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { LyraElement, type LyraEventMap } from '../../../internal/lyra-element.js';
import type { LyraAppearance, LyraSizeStep, LyraVariant } from '../../../internal/variants.js';
import { variants } from '../../../internal/variants.styles.js';
import { styles } from './badge.styles.js';

/** The library's one semantic-tone vocabulary. */
export type BadgeVariant = LyraVariant;
/** The library's one size ladder. */
export type BadgeSize = LyraSizeStep;
/** Visual treatment of a labelled surface: how much of the variant palette is spent on fill,
 *  border, and text. The library's one `appearance` vocabulary. */
export type BadgeAppearance = LyraAppearance;
/** Opt-in attention-seeking animation. Every value other than `none` stops outright under
 *  `prefers-reduced-motion: reduce`. */
export type BadgeAttention = 'none' | 'pulse' | 'bounce';

/**
 * `<lr-badge>` — a compact status label.
 *
 * Two independent visual axes: `variant` picks the semantic palette (neutral through danger, read
 * from the library's shared semantic grid), and `appearance` decides how much of that palette
 * lands on the fill, the border, and the text. `variant="neutral"` deliberately opts out of the
 * grid's own neutral row and keeps the ambient surface/border/text treatment, so a badge with no
 * status to signal reads as plain rather than grey-tinted.
 * `pill` switches the rounded rectangle for fully-rounded ends, and `attention` adds an opt-in,
 * reduced-motion-aware animation for a badge that has to be noticed.
 *
 * @customElement lr-badge
 * @slot - Badge content.
 * @slot start - Content placed before the label, typically an icon. The wrapper collapses
 * entirely (no stray gap) while empty. Mark purely decorative content `aria-hidden`.
 * @slot end - Content placed after the label, typically an icon. The wrapper collapses entirely
 * (no stray gap) while empty. Mark purely decorative content `aria-hidden`.
 * @csspart base - The badge surface.
 * @csspart start - Wrapper around the `start` slot. Hidden entirely while empty.
 * @csspart content - Wrapper around the default slot; the part that truncates with an ellipsis.
 * @csspart end - Wrapper around the `end` slot. Hidden entirely while empty.
 * @cssprop [--lr-badge-background=var(--lr-badge-fill)] - Explicit override for the badge's
 * background, winning over whatever `variant` and `appearance` resolved. Left unset (the default)
 * so it still inherits from a consumer's own ancestor rule.
 * @cssprop [--lr-badge-border=var(--lr-badge-stroke)] - Explicit override for the badge's border
 * color, on the same terms as `--lr-badge-background`.
 * @cssprop [--lr-badge-color=var(--lr-badge-text)] - Explicit override for the badge's text color,
 * on the same terms as `--lr-badge-background`.
 * @cssprop [--lr-badge-tint=var(--lr-color-surface)] - Palette slot: the variant's quiet fill.
 * Each non-neutral `variant` sets it to that variant's quiet fill from the shared semantic grid.
 * @cssprop [--lr-badge-solid=var(--lr-color-fill-loud)] - Palette slot: the variant's loud fill,
 * used by `appearance="accent"`.
 * @cssprop [--lr-badge-edge=var(--lr-color-border)] - Palette slot: the variant's border color.
 * Each non-neutral `variant` sets it to that variant's loud fill.
 * @cssprop [--lr-badge-ink=var(--lr-color-text)] - Palette slot: the variant's text color. Each
 * non-neutral `variant` sets it to that variant's loud fill.
 * @cssprop [--lr-badge-on-solid=var(--lr-color-on-loud)] - Palette slot: the text color that
 * stays legible on `--lr-badge-solid`.
 * @cssprop [--lr-badge-fill=var(--lr-badge-tint)] - Surface slot: which palette entry `appearance`
 * routed onto the background. Set it to retune a single appearance without touching the palette.
 * @cssprop [--lr-badge-stroke=var(--lr-badge-edge)] - Surface slot: which palette entry
 * `appearance` routed onto the border color.
 * @cssprop [--lr-badge-text=var(--lr-badge-ink)] - Surface slot: which palette entry `appearance`
 * routed onto the label color.
 * @cssprop [--lr-badge-font-size=var(--lr-font-size-sm)] - The badge's label font size. Each `size`
 * sets it to that step's font size.
 * @cssprop [--lr-badge-padding-inline=var(--lr-space-s)] - The badge's inline padding. Each `size`
 * sets it to that step's inline padding.
 * @cssprop [--lr-badge-min-height=var(--lr-size-1-25rem)] - The badge's minimum block size. Each
 * `size` sets it to that step's minimum block size.
 * @cssprop [--lr-badge-gap=var(--lr-space-2xs)] - Space between the `start` slot, the label, and
 * the `end` slot.
 * @cssprop [--lr-badge-radius=var(--lr-radius)] - Corner radius of the badge surface. `pill`
 * raises it to `var(--lr-radius-pill)`. Does not vary by `size` tier.
 * @cssprop [--lr-badge-attention-duration=var(--lr-duration-ambient)] - One cycle of the
 * `attention` animation.
 * @cssprop [--lr-badge-attention-easing=var(--lr-easing-emphasized)] - Timing function of the
 * `attention` animation.
 * @cssprop [--lr-badge-pulse-color=color-mix(in srgb, currentColor 40%, transparent)] - Color of
 * the expanding ring drawn by `attention="pulse"`.
 * @cssprop [--lr-badge-pulse-spread=var(--lr-size-0-25rem)] - How far the `attention="pulse"` ring
 * expands.
 * @cssprop [--lr-badge-bounce-distance=var(--lr-size-0-1875rem)] - Peak travel of the
 * `attention="bounce"` hop.
 */
export class LyraBadge<Events = LyraEventMap> extends LyraElement<Events> {
  static override styles = [LyraElement.styles, variants, styles];

  /** Semantic palette. */
  @property({ reflect: true }) variant: BadgeVariant = 'neutral';

  /** Visual density, matching `<lr-chip>`'s `2xs`–`xl` size scale. `m` preserves the original
   *  badge dimensions. */
  @property({ reflect: true }) size: BadgeSize = 'm';

  /** How much of the `variant` palette is spent on fill, border, and text. The default
   *  (`filled-outlined`: quiet tint, loud border, loud text) reproduces the badge's original
   *  treatment. */
  @property({ reflect: true }) appearance: BadgeAppearance = 'filled-outlined';

  /** Draws fully-rounded ends instead of the default rounded rectangle. */
  @property({ type: Boolean, reflect: true }) pill = false;

  /** Opt-in attention-seeking animation. Stops entirely under `prefers-reduced-motion: reduce`. */
  @property({ reflect: true }) attention: BadgeAttention = 'none';

  // A `[part]` always contains a literal `<slot>` child element regardless of assigned content, so
  // `:empty` never matches -- real emptiness is tracked in JS instead and reflected through the
  // `hidden` attribute, the same fix `<lr-chip>`'s `hasIconSlot` already establishes.
  @state() private hasStartSlot = false;
  @state() private hasEndSlot = false;

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    // Seed from the light-DOM children synchronously before the very first render so declarative
    // start/end content doesn't flash hidden for one frame waiting on `slotchange`.
    if (!this.hasUpdated) {
      this.hasStartSlot = Array.from(this.children).some((el) => el.getAttribute('slot') === 'start');
      this.hasEndSlot = Array.from(this.children).some((el) => el.getAttribute('slot') === 'end');
    }
  }

  private onStartSlotChange = (e: Event): void => {
    this.hasStartSlot = (e.target as HTMLSlotElement).assignedNodes({ flatten: true }).some(
      (node) => node.nodeType === Node.ELEMENT_NODE || (node.textContent ?? '').trim().length > 0,
    );
  };

  private onEndSlotChange = (e: Event): void => {
    this.hasEndSlot = (e.target as HTMLSlotElement).assignedNodes({ flatten: true }).some(
      (node) => node.nodeType === Node.ELEMENT_NODE || (node.textContent ?? '').trim().length > 0,
    );
  };

  /** Extension point for a subclass rendering its own trailing control inside `[part='base']` --
   *  see `<lr-tag>`'s remove button. Renders nothing here. */
  protected renderTrailing(): unknown {
    return nothing;
  }

  override render(): TemplateResult {
    return html`<span part="base">
      <span part="start" ?hidden=${!this.hasStartSlot}>
        <slot name="start" @slotchange=${this.onStartSlotChange}></slot>
      </span>
      <span part="content"><slot></slot></span>
      <span part="end" ?hidden=${!this.hasEndSlot}>
        <slot name="end" @slotchange=${this.onEndSlotChange}></slot>
      </span>
      ${this.renderTrailing()}
    </span>`;
  }
}
declare global {
  interface HTMLElementTagNameMap {
    'lr-badge': LyraBadge;
  }
}
