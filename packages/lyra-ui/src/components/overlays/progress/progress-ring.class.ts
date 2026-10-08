import { html, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import type { LyraSize } from '../../../internal/variants.js';
import { variants } from '../../../internal/variants.styles.js';
import { LyraProgressBase } from './progress-base.js';
import { joinAccessibleVisibleText } from './progress-shared.js';
import { ringStyles } from './progress.styles.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_progress } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END

/**
 * `<lr-progress-ring>` — a circular determinate or indeterminate progress indicator. `variant`
 * selects the indicator's semantic palette from the library's shared semantic grid (`neutral`
 * through `danger`), defaulting to `brand`, matching sibling `<lr-progress-bar>`.
 *
 * @customElement lr-progress-ring
 * @slot - Optional center label whose visible accessible text names the progressbar unless an
 * explicit accessible label overrides it; live mutations stay synchronized through forwarding
 * slots. When nothing is slotted, the fallback content is the formatted percentage while
 * determinate and `with-value` is set (`''` otherwise, and always `''` while `indeterminate`) --
 * the same value contract as `<lr-progress-bar>`'s `withValue`.
 * @slot label - Named alias for the optional center label, matching `<lr-progress-bar>`.
 * @csspart base - Compatibility name for the progress wrapper; use `progress-ring`.
 * @csspart progress-ring - The progress wrapper. It is the same node as `base`.
 * @csspart track - The SVG track.
 * @csspart indicator - The SVG indicator.
 * @csspart label - The center label.
 * @cssprop [--lr-progress-ring-size=var(--size,var(--_lr-progress-ring-size))] - Outer diameter of
 * the ring. The private fallback steps with `size` across the shared six-step ladder (`1.25rem` at
 * `2xs` up to `3.5rem` at `xl`, `2.5rem` unchanged at the `m` default); an inherited or direct
 * value here (or the upstream `--size` alias) still wins outright over every tier.
 * @cssprop [--lr-progress-ring-track-width=var(--lr-theme-progress-ring-track-width,var(--lr-size-4px))] - Track
 *   stroke width, `4px` by default. Bridges its own dedicated `--lr-theme-progress-ring-track-width`
 *   theme input rather than the widely-shared `--lr-theme-border-width-thick` (fed to the
 *   `--lr-border-width-thick` alias): `theme.css` declares that shared input at `3px` -- its correct
 *   default for the many surfaces that genuinely want it -- and bridging it directly here would have
 *   let importing `theme.css` alone silently repaint this ring's stroke to `3px` even with no
 *   consumer override. Set `--lr-theme-progress-ring-track-width` on `:root` or any ancestor to retune
 *   this ring specifically; it stays unset (and this default applies) whether or not `theme.css` is
 *   imported.
 * @cssprop [--lr-progress-ring-track-color=var(--lr-color-brand-quiet)] - Track stroke color.
 * @cssprop [--lr-progress-ring-indicator-width=var(--lr-progress-ring-track-width)] - Indicator stroke width.
 * @cssprop [--lr-progress-ring-indicator-color=var(--lr-progress-ring-indicator-variant-color)] -
 * Indicator stroke color, overriding the variant palette below.
 * @cssprop [--lr-progress-ring-indicator-variant-color=var(--lr-color-fill-loud,var(--lr-color-brand))] -
 * Palette slot: the active `variant`'s loud fill from the shared semantic grid. Feeds
 * `--lr-progress-ring-indicator-color` above unless that (or the upstream `--indicator-color`
 * alias) is itself set.
 * @cssprop [--lr-progress-ring-indicator-transition-duration=var(--lr-transition-base)] - Determinate indicator transition.
 * @cssprop [--lr-progress-duration=var(--lr-transition-ambient)] - Indeterminate rotation timing.
 * @cssprop [--size=var(--lr-progress-ring-size)] - Upstream-compatible outer diameter.
 * @cssprop [--track-width=var(--lr-progress-ring-track-width)] - Upstream-compatible track width.
 * @cssprop [--track-color=var(--lr-progress-ring-track-color)] - Upstream-compatible track color.
 * @cssprop [--indicator-width=var(--lr-progress-ring-indicator-width)] - Upstream-compatible indicator width.
 * @cssprop [--indicator-color=var(--lr-progress-ring-indicator-color)] - Upstream-compatible indicator color.
 * @cssprop [--indicator-transition-duration=var(--lr-progress-ring-indicator-transition-duration)] - Upstream-compatible transition duration.
 * @status stable
 * @since 4.0.0
 */
export class LyraProgressRing extends LyraProgressBase {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    progress: LYRA_DEFAULT_progress,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static override styles = [LyraElement.styles, variants, ringStyles];

  /** Outer diameter of the ring, on the library's shared six-step size ladder. `'m'` (the default)
   *  is this component's pre-existing behaviour, unchanged: an unset ring still renders at
   *  `--lr-progress-ring-size`'s literal `2.5rem` default. Every other tier scales that same
   *  diameter, from a compact `1.25rem` at `2xs` up to a roomy `3.5rem` at `xl`; an explicit
   *  `--lr-progress-ring-size` (or the upstream `--size` alias) still wins over any tier. Matching
   *  sibling `<lr-progress-bar>`'s own `size`, this scales exactly one dimension — the track/
   *  indicator stroke width and the center label's font size are unaffected by the tier. */
  @property({ reflect: true }) size: LyraSize = 'm';

  protected override computeVisibleLabelText(): string {
    const renderRoot = this.renderRoot as ParentNode | undefined;
    const slots = renderRoot?.querySelectorAll<HTMLSlotElement>(
      'slot:not([name]), slot[name="label"]',
    );
    const lightDomNodes = (this as unknown as { childNodes?: NodeListOf<ChildNode> }).childNodes;
    // assignedNodes({flatten:true}) returns a slot's FALLBACK children when nothing is assigned,
    // and the default slot's fallback is the formatted percent -- so an unslotted ring would name
    // itself "40%" and the localized 'progress' name (plus any registerLyraLocale override) would
    // be permanently unreachable. Only consumer-assigned content in either label slot may name
    // the control.
    const nodes = slots && slots.length > 0
      ? [...slots].flatMap((slot) =>
          slot.assignedNodes().length > 0 ? slot.assignedNodes({ flatten: true }) : [],
        )
      : Array.from(lightDomNodes ?? []).filter(
          (node) => {
            if (node.nodeType !== 1) return true;
            const slotName = (node as Element).getAttribute('slot') ?? '';
            return slotName === '' || slotName === 'label';
          },
        );
    return joinAccessibleVisibleText(nodes);
  }

  /** Live SVG indicator circle, or `null` before the render root is populated. */
  override get indicator(): SVGCircleElement | null {
    return this.renderRoot.querySelector<SVGCircleElement>('[part="indicator"]');
  }

  /** Current normalized stroke offset used by the rendered indicator. */
  override get indicatorOffset(): number {
    const circumference = 2 * Math.PI * 42;
    return this.indeterminate ? circumference * 0.65 : circumference * (1 - this.percent / 100);
  }

  override render(): TemplateResult {
    const radius = 42;
    const circumference = 2 * Math.PI * radius;
    const offset = this.indicatorOffset;
    const label = this.resolvedLabel;
    return html`<div part="base progress-ring" role="progressbar" aria-label=${label}
      aria-valuemin="0" aria-valuemax=${this.safeMax} aria-valuenow=${this.progressValueNow}
      aria-valuetext=${this.progressValueText}>
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <circle part="track" cx="50" cy="50" r=${radius} stroke-width="10"></circle>
        <circle part="indicator" cx="50" cy="50" r=${radius} stroke-width="10"
          stroke-dasharray=${circumference} stroke-dashoffset=${offset}></circle>
      </svg>
      <span part="label"><slot>${this.indeterminate || !this.withValue ? '' : this.formattedPercent}</slot><slot name="label"></slot></span>
    </div>`;
  }
}
declare global { interface HTMLElementTagNameMap { 'lr-progress-ring': LyraProgressRing; } }
