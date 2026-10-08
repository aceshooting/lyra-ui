import { nothing, type PropertyValues } from 'lit';
import { property } from 'lit/decorators.js';
import { AccessibleTextController } from '../../../internal/accessible-text-controller.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import type { LyraVariant } from '../../../internal/variants.js';
import {
  formatProgressPercent,
  normalizeProgressVariant,
  progressPercent,
  progressSafeMax,
  progressSafeValue,
  resolveProgressLabel,
} from './progress-shared.js';

/** The library's one semantic-tone vocabulary. */
export type LyraProgressVariant = LyraVariant;

/** State and label plumbing the bar and the ring share, so they cannot disagree about the same numbers. */
export abstract class LyraProgressBase extends LyraElement {
  // numeric-guard-exempt: normalized by progressSafeValue() in ./progress-shared.ts, which is where this component's finiteRange() guard now lives
  @property({ type: Number, reflect: true }) value = 0;
  // numeric-guard-exempt: normalized by progressSafeMax() in ./progress-shared.ts, which is where this component's finiteRange() guard now lives
  @property({ type: Number }) max = 100;
  @property({ type: Boolean, reflect: true }) indeterminate = false;
  /** Semantic palette, read from the library's shared semantic-tone vocabulary. Recolors the
   *  indicator via the variant's loud fill from the shared semantic grid. */
  @property({ reflect: true }) variant: LyraProgressVariant = 'brand';
  /** Shows the locale-formatted percentage while determinate: in the label row on the bar, as the
   *  default slot's fallback content on the ring. */
  @property({ type: Boolean, attribute: 'with-value' }) withValue = false;
  /** Mapped accessible-name property. */
  @property() label = '';
  /** The host `aria-label`: names the progressbar ahead of every other source, by presence, so an
   *  explicitly empty value stays empty. */
  @property({ attribute: 'aria-label' }) protected hostAriaLabel: string | null = null;
  // Assigned nodes do not exist in Lit's server DOM, so the text is cached once the browser can sample it.
  protected cachedVisibleLabelText = '';
  private readonly labelTextObserver = new AccessibleTextController(
    this, ['', 'label'], () => this.recomputeVisibleLabelText(),
  );

  protected abstract computeVisibleLabelText(): string;

  /** The live indicator element, or `null` before the render root is populated. */
  get indicator(): Element | null {
    return this.renderRoot.querySelector('[part="indicator"]');
  }

  /** How far the indicator is from full: the unfilled percentage on the bar, the normalized stroke
   *  offset on the ring. */
  abstract get indicatorOffset(): number;

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    if (changed.has('variant')) this.variant = normalizeProgressVariant(this.variant);
  }

  override connectedCallback(): void {
    super.connectedCallback();
    if (this.hasUpdated) this.recomputeVisibleLabelText();
    else this.seedFirstRenderState(() => this.recomputeVisibleLabelText());
  }

  /** A MutationObserver stays bound to the window that built it, so adoption rebuilds it in the new realm. */
  override adoptedCallback(): void {
    super.adoptedCallback();
    this.labelTextObserver.adopted();
  }

  private recomputeVisibleLabelText(): void {
    const next = this.computeVisibleLabelText();
    if (next === this.cachedVisibleLabelText) return;
    this.cachedVisibleLabelText = next;
    this.requestUpdate();
  }

  protected get safeMax(): number {
    return progressSafeMax(this.max);
  }

  protected get safeValue(): number {
    return progressSafeValue(this.value, this.safeMax);
  }

  protected get percent(): number {
    return progressPercent(this.safeValue, this.safeMax);
  }

  protected get formattedPercent(): string {
    return formatProgressPercent(this.effectiveLocale, this.percent);
  }

  /** The accessible name both renderings give their `progressbar`. */
  protected get resolvedLabel(): string {
    return resolveProgressLabel({
      hostAriaLabel: this.hostAriaLabel,
      label: this.label,
      visibleText: this.cachedVisibleLabelText,
      localizedFallback: this.localize('progress'),
    });
  }

  protected get progressValueNow(): number | typeof nothing {
    return this.indeterminate ? nothing : this.safeValue;
  }

  protected get progressValueText(): string | typeof nothing {
    return this.indeterminate ? nothing : this.formattedPercent;
  }
}
