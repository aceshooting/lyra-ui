import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { AccessibleTextController } from '../../../internal/accessible-text-controller.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import type { LyraSize, LyraVariant } from '../../../internal/variants.js';
import { variants } from '../../../internal/variants.styles.js';
import {
  formatProgressPercent,
  joinAccessibleVisibleText,
  normalizeProgressVariant,
  progressPercent,
  progressSafeMax,
  progressSafeValue,
  resolveProgressLabel,
} from './progress-shared.js';
import { styles } from './progress.styles.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_progress } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END

/** The library's one semantic-tone vocabulary. */
export type LyraProgressVariant = LyraVariant;

/**
 * `<lr-progress-bar>` — a determinate or indeterminate progress indicator. `variant` selects the
 * indicator's semantic palette from the library's shared semantic grid (`neutral` through
 * `danger`), defaulting to `brand`.
 *
 * @customElement lr-progress-bar
 * @slot - Label content, visible independently of `with-value`; live visible accessible text stays
 * synchronized through forwarding slots.
 * @slot label - Compatibility alias for the default label slot, with the same live-text behavior.
 * @csspart base - Compatibility name for the progress wrapper; use `progress-bar`.
 * @csspart progress-bar - The progress wrapper. It is the same node as `base`.
 * @csspart track - The track.
 * @csspart indicator - The filled progress indicator.
 * @csspart label - The label row.
 * @cssprop [--lr-progress-track-height=var(--lr-progress-height,var(--_lr-progress-track-height))] - Block
 * size of the progress track. The innermost fallback steps with `size` across the shared six-step
 * ladder (`0.25rem` at `2xs` up to `1.5rem` at `xl`, `1rem` unchanged at the `m` default); an
 * inherited or direct value here still wins outright over every tier.
 * @cssprop [--lr-progress-track-color=var(--lr-color-brand-quiet)] - Track color.
 * @cssprop [--lr-progress-track-radius=var(--lr-radius-pill)] - Track corner radius. The indicator
 * inherits it, so retuning one retunes both without a `::part(track)`/`::part(indicator)` rule.
 * @cssprop [--lr-progress-indicator-color=var(--lr-progress-indicator-variant-color)] - Indicator
 * color, overriding the variant palette below.
 * @cssprop [--lr-progress-indicator-variant-color=var(--lr-color-fill-loud,var(--lr-color-brand))] -
 * Palette slot: the active `variant`'s loud fill from the shared semantic grid. Feeds
 * `--lr-progress-indicator-color` above unless that (or the upstream `--indicator-color` alias) is
 * itself set.
 * @cssprop [--lr-progress-label-color=var(--lr-color-text)] - Label color.
 * @cssprop [--lr-progress-duration=var(--lr-transition-ambient)] - Indeterminate sweep timing.
 * @cssprop [--height=var(--lr-progress-track-height)] - Shoelace-compatible track height.
 * @cssprop [--track-height=var(--lr-progress-track-height)] - Web Awesome-compatible track height.
 * @cssprop [--track-color=var(--lr-progress-track-color)] - Upstream-compatible track color.
 * @cssprop [--indicator-color=var(--lr-progress-indicator-color)] - Upstream-compatible indicator color.
 * @cssprop [--label-color=var(--lr-progress-label-color)] - Shoelace-compatible label color.
 * @status stable
 * @since 4.0.0
 */
export class LyraProgressBar extends LyraElement {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    progress: LYRA_DEFAULT_progress,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static override styles = [LyraElement.styles, variants, styles];

  // numeric-guard-exempt: normalized by progressSafeValue() in ./progress-shared.ts, which is where this component's finiteRange() guard now lives
  @property({ type: Number, reflect: true }) value = 0;
  // numeric-guard-exempt: normalized by progressSafeMax() in ./progress-shared.ts, which is where this component's finiteRange() guard now lives
  @property({ type: Number }) max = 100;
  @property({ type: Boolean, reflect: true }) indeterminate = false;
  /** Semantic palette, read from the library's shared semantic-tone vocabulary. Recolors the
   *  indicator via the variant's loud fill from the shared semantic grid. */
  @property({ reflect: true }) variant: LyraProgressVariant = 'brand';
  /** Appends the locale-formatted percentage to the label row while determinate. */
  @property({ type: Boolean, attribute: 'with-value' }) withValue = false;
  /** Visual thickness of the track/indicator, on the library's shared six-step size ladder. `'m'`
   *  (the default) is this component's pre-existing behaviour, unchanged: an unset bar still
   *  renders at `--lr-progress-track-height`'s literal `1rem` default. Every other tier scales that
   *  same height, from a slender `0.25rem` at `2xs` up to a bold `1.5rem` at `xl`; an explicit
   *  `--lr-progress-track-height` (or the upstream `--track-height`/`--height` aliases) still wins
   *  over any tier. */
  @property({ reflect: true }) size: LyraSize = 'm';
  /** Mapped accessible-name property. */
  @property() label = '';
  /** The host `aria-label`: names the progressbar ahead of every other source, by presence, so an
   *  explicitly empty value stays empty. */
  @property({ attribute: 'aria-label' }) private hostAriaLabel: string | null = null;
  private cachedVisibleLabelText = '';
  private readonly labelTextObserver = new AccessibleTextController(
    this, ['', 'label'], () => this.recomputeVisibleLabelText(),
  );

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    if (changed.has('variant')) this.variant = normalizeProgressVariant(this.variant);
  }

  override connectedCallback(): void {
    super.connectedCallback();
    if (this.hasUpdated) this.recomputeVisibleLabelText();
    else this.seedFirstRenderState(() => this.recomputeVisibleLabelText());
  }

  /**
   * `MutationObserver` instances are bound to the realm (`window`) that constructed them, not to
   * the node they observe: one built from a stale `window.MutationObserver` keeps delivering
   * through that window's microtask queue even after this element is adopted into a different
   * document, instead of the adopted document's own. Adoption (`document.adoptNode()`, or an
   * implicit cross-document `appendChild`) always runs `adoptedCallback()` -- while this element is
   * momentarily disconnected, ahead of any later `connectedCallback()` -- so this rebuilds the
   * observer here rather than only lazily on the next connect.
   */
  override adoptedCallback(): void {
    super.adoptedCallback();
    this.labelTextObserver.adopted();
  }

  private computeVisibleLabelText(): string {
    const renderRoot = (this as unknown as { renderRoot?: ParentNode }).renderRoot;
    const renderedSlots = renderRoot?.querySelectorAll<HTMLSlotElement>('slot');
    const lightDomNodes = (this as unknown as { childNodes?: NodeListOf<ChildNode> }).childNodes;
    const nodes = renderedSlots && renderedSlots.length > 0
      ? [...renderedSlots].flatMap((slot) => slot.assignedNodes({ flatten: true }))
      : Array.from(lightDomNodes ?? []).filter((node) => {
          if (node.nodeType !== 1) return true;
          const slotName = (node as Element).getAttribute('slot') ?? '';
          return slotName === '' || slotName === 'label';
        });
    // The shadow label wrapper is hidden when this semantic probe is empty. Starting the bounded
    // owned traversal at the assigned roots avoids letting that derived presentation state form a
    // false-empty cycle; each authored root's own hidden/inert/ARIA/CSS state is still enforced.
    return joinAccessibleVisibleText(nodes, {
      requireRendered: false,
      skipRootAncestorValidation: true,
    });
  }

  private recomputeVisibleLabelText(): void {
    const next = this.computeVisibleLabelText();
    if (next === this.cachedVisibleLabelText) return;
    this.cachedVisibleLabelText = next;
    this.requestUpdate();
  }

  // Value normalization, percent formatting and accessible-name precedence live in
  // ./progress-shared.ts, so the bar and the ring can never disagree about the same numbers.
  private get safeMax(): number {
    return progressSafeMax(this.max);
  }

  private get safeValue(): number {
    return progressSafeValue(this.value, this.safeMax);
  }

  private get percent(): number {
    return progressPercent(this.safeValue, this.safeMax);
  }

  private get formattedPercent(): string {
    return formatProgressPercent(this.effectiveLocale, this.percent);
  }

  override render(): TemplateResult {
    const label = resolveProgressLabel({
      hostAriaLabel: this.hostAriaLabel,
      label: this.label,
      visibleText: this.cachedVisibleLabelText,
      localizedFallback: this.localize('progress'),
    });
    const hasVisibleLabel = Boolean(this.cachedVisibleLabelText) || this.withValue;
    return html`<div part="base progress-bar" role="progressbar" aria-label=${label}
      aria-valuemin="0" aria-valuemax=${this.safeMax} aria-valuenow=${this.indeterminate ? nothing : this.safeValue}
      aria-valuetext=${this.indeterminate ? nothing : this.formattedPercent}>
      <div part="label" ?hidden=${!hasVisibleLabel}><slot></slot><slot name="label"></slot>${this.withValue && !this.indeterminate ? html`<span>${this.formattedPercent}</span>` : nothing}</div>
      <div part="track"><div part="indicator" style=${this.indeterminate ? nothing : `inline-size:${this.percent}%`}></div></div>
    </div>`;
  }
}
declare global { interface HTMLElementTagNameMap { 'lr-progress-bar': LyraProgressBar; } }
