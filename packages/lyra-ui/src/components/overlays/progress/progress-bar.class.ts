import { html, nothing, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { bindAccessibleTextObserver } from '../../../internal/accessibility-visibility.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import type { LyraVariant } from '../../../internal/variants.js';
import { variants } from '../../../internal/variants.styles.js';
import {
  formatProgressPercent,
  joinAccessibleVisibleText,
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
export type ProgressVariant = LyraVariant;

/**
 * `<lr-progress-bar>` — a determinate or indeterminate progress indicator. `variant` selects the
 * indicator's semantic palette from the library's shared semantic grid (`neutral` through
 * `danger`), defaulting to `brand`.
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
  @property({ reflect: true }) variant: ProgressVariant = 'brand';
  @property({ type: Boolean, attribute: 'show-value' }) showValue = false;
  /** Mapped accessible-label property. */
  @property() label = '';
  /** Explicit accessible name, on the library-wide `accessibleLabel`/`accessible-label` convention
   *  shared by every Lyra component that names a shadow-owned role. Not an alias kept for one
   *  upstream: `label` is the mapped upstream name and this is Lyra's own spelling; both are read,
   *  with `label` first and a host `aria-label` above both. */
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
    const label = resolveProgressLabel(this, {
      label: this.label,
      accessibleLabel: this.accessibleLabel,
      visibleText: this.cachedVisibleLabelText,
      localizedFallback: this.localize('progress'),
    });
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
