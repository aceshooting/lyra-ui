import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import {
  LyraElement,
  type LyraEventMap,
} from '../../../internal/lyra-element.js';
import {
  normalizeSize,
  type LyraAppearance,
  type LyraSize,
  type LyraSizeStep,
  type LyraVariant,
} from '../../../internal/variants.js';
import { effectiveSemanticVariant, type SemanticVariant } from '../../../internal/semantic-variant.js';
import { variants } from '../../../internal/variants.styles.js';
import { SlotPresenceController } from '../../../internal/slot-presence-controller.js';
import { renderInertPresentation } from '../../../internal/inert-presentation.js';
import { devWarnOnce } from '../../../internal/dev-warning.js';
import { styles } from './badge.styles.js';

/** The library's semantic-tone vocabulary plus Shoelace's spelling for the brand tone. */
export type BadgeVariant = SemanticVariant;
/** The library's one size ladder, including both upstream long-form spellings. */
export type BadgeSize = LyraSize;
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
 * Badge content is static by default, matching both mirrored upstreams. Authors whose badge holds
 * genuinely changing status text can opt into live-region semantics with `role="status"`; any
 * authored role is preserved. `<lr-tag>` inherits the same visual and author-owned semantic
 * contract.
 * `wrap` lets a long label break across lines instead of truncating with an ellipsis. `dot` adds a
 * leading status dot coloured from `variant`; the dot itself is decorative, so the badge's text
 * still carries the status. A dot-only badge (no text content) must be named with `aria-label` or
 * `aria-labelledby`, which then gives the host `role="img"` unless the author set a role;
 * without a name a development warning reports that colour would be the only cue.
 *
 * @customElement lr-badge
 * @slot - Badge content.
 * @slot start - Decorative content placed before the label, typically an icon. Its flattened
 * subtree stays visible but is inert and aria-hidden, like the leading icon of lr-chip, lr-alert and
 * lr-callout; put meaningful text in the default slot. The wrapper collapses entirely (no stray gap)
 * while empty.
 * @slot end - Content placed after the label, such as a count or an icon. It stays in the
 * accessibility tree because it often carries meaning; mark purely decorative content
 * `aria-hidden`. The wrapper collapses entirely (no stray gap) while empty.
 * @csspart base - Compatibility name for the badge surface; use `badge`.
 * @csspart badge - The badge surface. It is the same node as `base`.
 * @csspart start - Inert, aria-hidden wrapper around the `start` slot. Hidden entirely while empty.
 * @csspart dot - The leading status dot, rendered only while `dot` is set. Decorative
 * (`aria-hidden`).
 * @csspart content - Wrapper around the default slot; the part that truncates with an ellipsis
 * (wraps instead while `wrap` is set). Hidden for a dot-only badge.
 * @csspart end - Wrapper around the `end` slot. Hidden entirely while empty.
 * @cssprop [--lr-badge-background=var(--lr-badge-fill)] - Explicit override for the badge's
 * background, winning over whatever `variant` and `appearance` resolved. Left unset (the default)
 * so it still inherits from a consumer's own ancestor rule.
 * @cssprop [--lr-badge-border=var(--lr-badge-stroke)] - Explicit override for the badge's border
 * color, on the same terms as `--lr-badge-background`.
 * @cssprop [--lr-badge-color=var(--lr-badge-text)] - Explicit override for the badge's text color,
 * on the same terms as `--lr-badge-background`.
 * @cssprop [--lr-badge-tint=var(--lr-color-surface)] - Palette slot: the variant's quiet fill.
 * Its private default follows each non-neutral `variant`'s quiet fill from the shared semantic
 * grid; an inherited or direct public value remains authoritative.
 * @cssprop [--lr-badge-solid=var(--lr-color-fill-loud)] - Palette slot: the variant's loud fill,
 * used by `appearance="accent"`.
 * @cssprop [--lr-badge-edge=var(--lr-color-border-subtle)] - Palette slot: the variant's border color.
 * Its private default follows each non-neutral `variant`'s loud fill; an inherited or direct
 * public value remains authoritative.
 * @cssprop [--lr-badge-ink=var(--lr-color-text)] - Palette slot: the variant's text color. Its
 * private default follows each non-neutral `variant`'s loud fill; an inherited or direct public
 * value remains authoritative.
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
 * @cssprop [--lr-badge-dot-size=var(--lr-size-0-5rem)] - Diameter of the `dot` status dot.
 * @cssprop [--lr-badge-dot-color=var(--lr-badge-ink)] - Colour of the `dot` status dot. Its private
 * default follows the variant's text colour, and the on-solid colour for `appearance="accent"`.
 * @cssprop [--lr-badge-attention-duration=var(--lr-duration-ambient)] - One cycle of the
 * `attention` animation.
 * @cssprop [--lr-badge-attention-easing=var(--lr-easing-emphasized)] - Timing function of the
 * `attention` animation.
 * @cssprop [--lr-badge-pulse-color=color-mix(in srgb, currentColor 40%, transparent)] - Color of
 * the expanding ring drawn by `attention="pulse"`.
 * @cssprop [--pulse-color=var(--lr-badge-pulse-color)] - Upstream-compatible pulse-ring color.
 * @cssprop [--lr-badge-pulse-spread=var(--lr-size-0-25rem)] - How far the `attention="pulse"` ring
 * expands.
 * @cssprop [--lr-badge-bounce-distance=var(--lr-size-0-1875rem)] - Peak travel of the
 * `attention="bounce"` hop.
 * @status stable
 * @since 4.0.0
 */
export class LyraBadge<
  Events = LyraEventMap,
  Variant extends BadgeVariant | 'text' = BadgeVariant
> extends LyraElement<Events> {
  static override styles = [LyraElement.styles, variants, styles];

  /** Semantic palette. Every valid upstream spelling remains observable verbatim; rendering uses
   * the private canonical value instead of rewriting the public property or reflected attribute. */
  @property({ reflect: true }) variant: Variant = 'neutral' as Variant;

  /** Visual density on the shared `2xs`–`xl` ladder. `m` preserves the original badge
   * dimensions. Valid `small`/`medium`/`large` values round-trip exactly. */
  @property({ reflect: true }) size: BadgeSize = 'm';

  /** How much of the `variant` palette is spent on fill, border, and text. The default
   *  (`filled-outlined`: quiet tint, loud border, loud text) reproduces the badge's original
   *  treatment. */
  @property({ reflect: true }) appearance: BadgeAppearance = 'filled-outlined';

  /** Draws fully-rounded ends instead of the default rounded rectangle. */
  @property({ type: Boolean, reflect: true }) pill = false;

  /** Opt-in attention-seeking animation. An explicit `'none'` suppresses the `pulse` shorthand.
   *  Stops entirely under `prefers-reduced-motion: reduce`. */
  @property({ reflect: true, useDefault: true }) attention: BadgeAttention = 'none';

  /** Lets a long label wrap onto several lines instead of truncating with an ellipsis. */
  @property({ type: Boolean, reflect: true }) wrap = false;

  /** Renders a leading status dot coloured from `variant`. With no text content, name the badge
   *  with `aria-label` so colour is never the only cue. `attention="pulse"` pulses the dot. */
  @property({ type: Boolean, reflect: true }) dot = false;

  /** Host accessible name; on a dot-only badge it also gives the host `role="img"` unless the
   *  author set a role. */
  @property({ attribute: 'aria-label' }) private hostAriaLabel: string | null = null;
  /** Host accessible name by reference; on a dot-only badge it also gives the host `role="img"`
   *  unless the author set a role. */
  @property({ attribute: 'aria-labelledby' }) private hostAriaLabelledBy: string | null = null;

  /** Whether this element, not the author, wrote the host's `role="img"`. */
  private ownsImageRole = false;

  /** Upstream-compatible pulse shorthand. Equivalent to `attention="pulse"` only while the
   *  `attention` attribute is omitted; every explicit attention value takes precedence. */
  @property({ type: Boolean, reflect: true }) pulse = false;

  // A `[part]` always contains a literal `<slot>` child element regardless of assigned content, so
  // `:empty` never matches -- real emptiness is tracked in JS and reflected through `hidden`.
  private readonly slotPresence = new SlotPresenceController(this);

  protected get effectiveVariant(): LyraVariant {
    return effectiveSemanticVariant(this.variant);
  }

  protected get effectiveSize(): LyraSizeStep {
    const value = this.size as string;
    if (
      !['2xs', 'xs', 's', 'm', 'l', 'xl', 'small', 'medium', 'large'].includes(
        value
      )
    )
      return 'm';
    return normalizeSize(value as LyraSize);
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    this.setAttribute('data-effective-variant', this.effectiveVariant);
    this.setAttribute('data-effective-size', this.effectiveSize);
    this.syncDotSemantics();
  }

  /** A dot with no text names itself through the host, which needs a role to carry that name. */
  private syncDotSemantics(): void {
    const dotOnly = this.dot && !this.slotPresence.has();
    const named = this.hostAriaLabel !== null || this.hostAriaLabelledBy !== null;
    if (dotOnly && named) {
      if (!this.hasAttribute('role')) {
        this.setAttribute('role', 'img');
        this.ownsImageRole = true;
      }
    } else if (this.ownsImageRole) {
      if (this.getAttribute('role') === 'img') this.removeAttribute('role');
      this.ownsImageRole = false;
    }
    if (dotOnly && !named) {
      devWarnOnce(
        'lr-badge:unnamed-dot',
        '<lr-badge dot> has no text and no aria-label or aria-labelledby, so its colour is the only cue. Name the status.',
      );
    }
  }

  /** Extension point for a subclass rendering its own trailing control inside `[part~='base']` --
   *  see `<lr-tag>`'s remove button. Renders nothing here. */
  protected renderTrailing(): unknown {
    return nothing;
  }

  override render(): TemplateResult {
    const dotOnly = this.dot && !this.slotPresence.has();
    return html`<span part="base badge">
      ${this.dot ? html`<span part="dot" aria-hidden="true"></span>` : nothing}
      ${renderInertPresentation(html`<slot name="start"></slot>`, {
        part: 'start',
        hidden: !this.slotPresence.has('start'),
      })}
      <span part="content" ?hidden=${dotOnly}><slot></slot></span>
      <span part="end" ?hidden=${!this.slotPresence.has('end')}>
        <slot name="end"></slot>
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
