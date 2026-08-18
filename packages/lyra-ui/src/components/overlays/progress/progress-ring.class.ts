import { html, nothing, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { bindAccessibleTextObserver } from '../../../internal/accessibility-visibility.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { variants } from '../../../internal/variants.styles.js';
import type { LyraProgressVariant } from './progress-bar.class.js';
import {
  formatProgressPercent,
  joinAccessibleVisibleText,
  progressPercent,
  progressSafeMax,
  progressSafeValue,
  resolveProgressLabel,
} from './progress-shared.js';
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
 * determinate and `show-value` is set (`''` otherwise, and always `''` while `indeterminate`) --
 * the same value contract as `<lr-progress-bar>`'s `showValue`.
 * @csspart base - Compatibility name for the progress wrapper; use `progress-ring`.
 * @csspart progress-ring - The progress wrapper. It is the same node as `base`.
 * @csspart track - The SVG track.
 * @csspart indicator - The SVG indicator.
 * @csspart label - The center label.
 * @cssprop [--lr-progress-ring-size=var(--lr-size-2-5rem)] - Outer diameter of the ring.
 * @cssprop [--lr-progress-ring-track-width=var(--lr-size-4px)] - Track stroke width.
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
export class LyraProgressRing extends LyraElement {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    progress: LYRA_DEFAULT_progress,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static override styles = [LyraElement.styles, variants, ringStyles];
  // numeric-guard-exempt: normalized by progressSafeValue() in ./progress-shared.ts, which is where this component's finiteRange() guard now lives
  @property({ type: Number, reflect: true }) value = 0;
  // numeric-guard-exempt: normalized by progressSafeMax() in ./progress-shared.ts, which is where this component's finiteRange() guard now lives
  @property({ type: Number }) max = 100;
  @property({ type: Boolean, reflect: true }) indeterminate = false;
  /** Selects the indicator's semantic palette from the shared semantic grid, matching sibling
   *  `<lr-progress-bar>`'s `variant`. */
  @property({ reflect: true }) variant: LyraProgressVariant = 'brand';
  /** Shows the formatted percentage as the default slot's fallback content while determinate.
   *  `false` by default, matching sibling `<lr-progress-bar>`'s `showValue`/`show-value` exactly --
   *  a determinate ring with no `show-value` renders no percentage text. Only the fallback is
   *  gated: a consumer who slots their own content always sees that content instead, with or
   *  without `show-value` (native `<slot>` projection semantics, unaffected by this property). */
  @property({ type: Boolean, attribute: 'show-value' }) showValue = false;
  /** Mapped accessible-label property. */
  @property() label = '';
  /** Explicit accessible name, on the library-wide `accessibleLabel`/`accessible-label` convention
   *  shared by every Lyra component that names a shadow-owned role. Not an alias kept for one
   *  upstream: `label` is the mapped upstream name and this is Lyra's own spelling; both are read,
   *  with `label` first and a host `aria-label` above both. */
  @property({ attribute: 'accessible-label' }) accessibleLabel = '';
  // Assigned nodes do not exist in Lit's server DOM. Cache their accessible text only when the
  // browser can sample it, before a client-only first paint or just after the hydration render.
  private cachedVisibleLabelText = '';
  private labelObserver?: MutationObserver;
  private readonly onLabelSlotChange = (event: Event): void => {
    const target = event.target as Element | null;
    if (target?.nodeType !== 1 || target.localName !== 'slot') return;
    this.bindLabelObserverTargets();
    this.recomputeVisibleLabelText();
  };

  override connectedCallback(): void {
    super.connectedCallback();
    this.addEventListener('slotchange', this.onLabelSlotChange);
    this.rebuildLabelObserver();
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
    this.rebuildLabelObserver();
  }

  /** Tears down and reconstructs `labelObserver` bound to the current `ownerDocument`'s realm, then
   *  rebinds every current target. Called on connect and on adoption -- see `adoptedCallback()`. */
  private rebuildLabelObserver(): void {
    this.labelObserver?.disconnect();
    const MutationObserverCtor = (this.ownerDocument as Document | undefined)?.defaultView
      ?.MutationObserver;
    this.labelObserver = MutationObserverCtor
      ? new MutationObserverCtor(() => {
          this.bindLabelObserverTargets();
          this.recomputeVisibleLabelText();
        })
      : undefined;
    this.bindLabelObserverTargets();
  }

  private bindLabelObserverTargets(): void {
    bindAccessibleTextObserver(this.labelObserver, this);
  }

  override disconnectedCallback(): void {
    this.removeEventListener('slotchange', this.onLabelSlotChange);
    this.labelObserver?.disconnect();
    this.labelObserver = undefined;
    super.disconnectedCallback();
  }

  private computeVisibleLabelText(): string {
    const renderRoot = this.renderRoot as ParentNode | undefined;
    const slot = renderRoot?.querySelector<HTMLSlotElement>('slot:not([name])');
    const lightDomNodes = (this as unknown as { childNodes?: NodeListOf<ChildNode> }).childNodes;
    // assignedNodes({flatten:true}) returns the slot's FALLBACK children when nothing is
    // assigned, and this slot's fallback is the formatted percent -- so an unslotted ring would
    // name itself "40%" and the localized 'progress' name (plus any registerLyraLocale override)
    // would be permanently unreachable. Only consumer-assigned content may name the control.
    const nodes = slot
      ? slot.assignedNodes().length > 0
        ? slot.assignedNodes({ flatten: true })
        : []
      : Array.from(lightDomNodes ?? []).filter(
          (node) => node.nodeType !== 1 || ((node as Element).getAttribute('slot') ?? '') === '',
        );
    return joinAccessibleVisibleText(nodes);
  }

  private recomputeVisibleLabelText(): void {
    const next = this.computeVisibleLabelText();
    if (next === this.cachedVisibleLabelText) return;
    this.cachedVisibleLabelText = next;
    this.requestUpdate();
  }

  // Value normalization, percent formatting and accessible-name precedence live in
  // ./progress-shared.ts, so the ring and the bar can never disagree about the same numbers.
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

  /** Live SVG indicator circle, or `null` before the render root is populated. */
  get indicator(): SVGCircleElement | null {
    return this.renderRoot.querySelector<SVGCircleElement>('[part="indicator"]');
  }

  /** Current normalized stroke offset used by the rendered indicator. */
  get indicatorOffset(): number {
    const circumference = 2 * Math.PI * 42;
    return this.indeterminate ? circumference * 0.65 : circumference * (1 - this.percent / 100);
  }

  override render(): TemplateResult {
    const radius = 42;
    const circumference = 2 * Math.PI * radius;
    const offset = this.indicatorOffset;
    const label = resolveProgressLabel(this, {
      label: this.label,
      accessibleLabel: this.accessibleLabel,
      visibleText: this.cachedVisibleLabelText,
      localizedFallback: this.localize('progress'),
    });
    return html`<div part="base progress-ring" role="progressbar" aria-label=${label}
      aria-valuemin="0" aria-valuemax=${this.safeMax} aria-valuenow=${this.indeterminate ? nothing : this.safeValue}
      aria-valuetext=${this.indeterminate ? nothing : this.formattedPercent}>
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <circle part="track" cx="50" cy="50" r=${radius} stroke-width="10"></circle>
        <circle part="indicator" cx="50" cy="50" r=${radius} stroke-width="10"
          stroke-dasharray=${circumference} stroke-dashoffset=${offset}></circle>
      </svg>
      <span part="label"><slot @slotchange=${this.onLabelSlotChange}>${this.indeterminate || !this.showValue ? '' : this.formattedPercent}</slot></span>
    </div>`;
  }
}
declare global { interface HTMLElementTagNameMap { 'lr-progress-ring': LyraProgressRing; } }
