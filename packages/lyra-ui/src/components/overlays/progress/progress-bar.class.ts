import { html, nothing, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import {
  bindAccessibleTextObserver,
  composedAccessibleVisibleText,
} from '../../../internal/accessibility-visibility.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { finiteRange } from '../../../internal/numbers.js';
import { getNumberFormat } from '../../../internal/intl-cache.js';
import { styles } from './progress.styles.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_collapse, LYRA_DEFAULT_details, LYRA_DEFAULT_open, LYRA_DEFAULT_progress } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END


export type ProgressVariant = 'brand' | 'success' | 'warning' | 'danger';

const DEFAULT_MAX = 100;

/**
 * `<lr-progress-bar>` — a determinate or indeterminate progress indicator.
 *
 * @customElement lr-progress-bar
 * @slot - Label content, visible independently of `show-value`; live visible accessible text stays
 * synchronized through forwarding slots.
 * @slot label - Compatibility alias for the default label slot, with the same live-text behavior.
 * @csspart base - Compatibility name for the progress wrapper; use `progress-bar`.
 * @csspart progress-bar - The progress wrapper. It is the same node as `base`.
 * @csspart track - The track.
 * @csspart indicator - The filled progress indicator.
 * @csspart label - The label row.
 * @cssprop [--lr-progress-track-height=var(--lr-progress-height,var(--lr-size-1rem))] - Block size of the progress track.
 * @cssprop [--lr-progress-track-color=var(--lr-color-brand-quiet)] - Track color.
 * @cssprop [--lr-progress-indicator-color=var(--lr-color-brand)] - Indicator color.
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
    collapse: LYRA_DEFAULT_collapse,
    details: LYRA_DEFAULT_details,
    open: LYRA_DEFAULT_open,
    progress: LYRA_DEFAULT_progress,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static override styles = [LyraElement.styles, styles];
  @property({ type: Number, reflect: true }) value = 0;
  @property({ type: Number }) max = 100;
  @property({ type: Boolean, reflect: true }) indeterminate = false;
  @property({ reflect: true }) variant: ProgressVariant = 'brand';
  @property({ type: Boolean, attribute: 'show-value' }) showValue = false;
  /** Mapped accessible-label property. */
  @property() label = '';
  /** Lyra compatibility alias for `label`. */
  @property({ attribute: 'accessible-label' }) accessibleLabel = '';
  private cachedVisibleLabelText = '';
  private labelObserver?: MutationObserver;
  private pendingLabelRefresh?: {
    ownerWindow: Window;
    kind: 'frame' | 'timeout';
    handle: number;
  };
  private readonly onLabelSlotChange = (event: Event): void => {
    const target = event.target as Element | null;
    if (target?.nodeType !== 1 || target.localName !== 'slot') return;
    this.bindLabelObserverTargets();
    this.recomputeVisibleLabelText();
    this.requestUpdate();
    this.scheduleCascadeLabelRefresh();
  };

  override connectedCallback(): void {
    super.connectedCallback();
    const MutationObserverCtor = this.ownerDocument.defaultView?.MutationObserver;
    this.labelObserver = MutationObserverCtor
      ? new MutationObserverCtor(() => {
          this.bindLabelObserverTargets();
          this.recomputeVisibleLabelText();
          this.requestUpdate();
          this.scheduleCascadeLabelRefresh();
        })
      : undefined;
    this.addEventListener('slotchange', this.onLabelSlotChange);
    this.bindLabelObserverTargets();
    if (this.hasUpdated) this.recomputeVisibleLabelText();
    else this.seedFirstRenderState(() => this.recomputeVisibleLabelText());
  }

  private scheduleCascadeLabelRefresh(): void {
    const ownerWindow = this.ownerDocument?.defaultView;
    if (!ownerWindow) return;

    const pending = this.pendingLabelRefresh;
    if (pending?.ownerWindow === ownerWindow) return;
    if (pending) this.cancelCascadeLabelRefresh();

    const frameId = ownerWindow.requestAnimationFrame(() => {
      const current = this.pendingLabelRefresh;
      if (
        current?.ownerWindow !== ownerWindow ||
        current.kind !== 'frame' ||
        current.handle !== frameId
      ) {
        return;
      }
      if (!this.isConnected || this.ownerDocument.defaultView !== ownerWindow) {
        this.pendingLabelRefresh = undefined;
        return;
      }

      const timeoutId = ownerWindow.setTimeout(() => {
        const next = this.pendingLabelRefresh;
        if (
          next?.ownerWindow !== ownerWindow ||
          next.kind !== 'timeout' ||
          next.handle !== timeoutId
        ) {
          return;
        }
        this.pendingLabelRefresh = undefined;
        if (this.isConnected && this.ownerDocument.defaultView === ownerWindow) {
          this.recomputeVisibleLabelText();
        }
      }, 0);
      this.pendingLabelRefresh = { ownerWindow, kind: 'timeout', handle: timeoutId };
    });
    this.pendingLabelRefresh = { ownerWindow, kind: 'frame', handle: frameId };
  }

  private cancelCascadeLabelRefresh(): void {
    const pending = this.pendingLabelRefresh;
    if (!pending) return;
    if (pending.kind === 'frame') pending.ownerWindow.cancelAnimationFrame(pending.handle);
    else pending.ownerWindow.clearTimeout(pending.handle);
    this.pendingLabelRefresh = undefined;
  }

  private bindLabelObserverTargets(): void {
    bindAccessibleTextObserver(this.labelObserver, this);
  }

  override disconnectedCallback(): void {
    this.removeEventListener('slotchange', this.onLabelSlotChange);
    this.labelObserver?.disconnect();
    this.labelObserver = undefined;
    this.cancelCascadeLabelRefresh();
    super.disconnectedCallback();
  }

  /** Resolve inherited visibility parent-first before extracting descendant overrides. */
  private primeVisibilityCascade(node: Node): void {
    if (node.nodeType !== 1) return;
    const element = node as Element;
    void element.ownerDocument.defaultView?.getComputedStyle(element).visibility;
    const childNodes =
      element.localName === 'slot' && (element as HTMLSlotElement).assignedNodes().length > 0
        ? (element as HTMLSlotElement).assignedNodes({ flatten: true })
        : element.childNodes;
    for (const child of childNodes) this.primeVisibilityCascade(child);
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
    for (const node of nodes) this.primeVisibilityCascade(node);
    return nodes
      .map(composedAccessibleVisibleText)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private recomputeVisibleLabelText(): void {
    const next = this.computeVisibleLabelText();
    if (next === this.cachedVisibleLabelText) return;
    this.cachedVisibleLabelText = next;
    this.requestUpdate();
  }

  /** `max`, normalized to a finite number and guarded against `<= 0` — which would otherwise
   *  divide-by-zero in `percent` below — falling back to the property's own default of `100`. */
  private get safeMax(): number {
    const max = finiteRange(this.max, DEFAULT_MAX, 0);
    return max > 0 ? max : DEFAULT_MAX;
  }

  /** `value`, normalized to a finite number clamped to `[0, safeMax]`. */
  private get safeValue(): number {
    return finiteRange(this.value, 0, 0, this.safeMax);
  }

  private get percent(): number {
    return (this.safeValue / this.safeMax) * 100;
  }

  private get formattedPercent(): string {
    return getNumberFormat(this.effectiveLocale, {
      style: 'percent',
      maximumFractionDigits: 0,
    }).format(this.percent / 100);
  }

  override render(): TemplateResult {
    const hostLabel = this.getAttribute('aria-label');
    const label =
      hostLabel !== null
        ? hostLabel
        : this.label || this.accessibleLabel || this.cachedVisibleLabelText || this.localize('progress');
    const hasVisibleLabel = Boolean(this.cachedVisibleLabelText) || this.showValue;
    return html`<div part="base progress-bar" role="progressbar" aria-label=${label}
      aria-valuemin="0" aria-valuemax=${this.safeMax} aria-valuenow=${this.indeterminate ? nothing : this.safeValue}
      aria-valuetext=${this.indeterminate ? nothing : this.formattedPercent}>
      <div part="label" ?hidden=${!hasVisibleLabel}><slot @slotchange=${this.onLabelSlotChange}></slot><slot name="label" @slotchange=${this.onLabelSlotChange}></slot>${this.showValue && !this.indeterminate ? html`<span>${this.formattedPercent}</span>` : nothing}</div>
      <div part="track"><div part="indicator" style="inline-size:${this.indeterminate ? '40%' : `${this.percent}%`}"></div></div>
    </div>`;
  }
}
declare global { interface HTMLElementTagNameMap { 'lr-progress-bar': LyraProgressBar; } }
