import { html, type PropertyValues, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import {
  bindAccessibleTextObserver,
  composedAccessibilityText,
} from '../../../internal/accessibility-visibility.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { styles } from './spinner.styles.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_loading } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END


export type SpinnerLabelPlacement = 'none' | 'after';

/**
 * `<lr-spinner>` — an indeterminate busy indicator. It uses non-live `progressbar` semantics so
 * mounting ordinary loading UI does not announce a false status update.
 *
 * @customElement lr-spinner
 * @slot - Optional label. `label-placement="after"` renders it and uses its live, visible
 * accessible text as the progressbar name, including through forwarding slots; `none` hides it
 * from both rendering and the accessibility tree.
 * @csspart base - Compatibility name for the outer wrapper; use `spinner`.
 * @csspart spinner - The outer wrapper. It is the same node as `base`.
 * @csspart spinner-indicator - The animated indicator inside the wrapper.
 * @csspart label - The accessible/visible label wrapper.
 * @cssprop [--lr-spinner-size=var(--lr-size-1-25rem)] - Outer diameter of the indicator.
 * @cssprop [--lr-spinner-track-width=var(--lr-border-width-medium)] - Thickness of the ring track.
 * @cssprop [--lr-spinner-duration=var(--lr-transition-ambient)] - Duration/easing of one
 * rotation. Not read under
 *   `prefers-reduced-motion: reduce`, where the animation is disabled entirely.
 * @cssprop [--track-width=var(--lr-spinner-track-width)] - Upstream-compatible track width.
 * @cssprop [--track-color=var(--lr-color-brand-quiet)] - Upstream-compatible track color.
 * @cssprop [--indicator-color=var(--lr-color-brand)] - Upstream-compatible indicator color.
 * @cssprop [--speed=var(--lr-spinner-duration)] - Upstream-compatible rotation duration.
 * @status stable
 * @since 4.0.0
 */
export class LyraSpinner extends LyraElement {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    loading: LYRA_DEFAULT_loading,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static override styles = [LyraElement.styles, styles];
  @property({ attribute: 'label-placement', reflect: true }) labelPlacement: SpinnerLabelPlacement = 'none';
  /** Accessible name for the busy progress indicator, forwarded from a host `aria-label`. When unset, a
   *  visible `label-placement="after"` label names it, then the localized "Loading…" fallback. */
  @property({ attribute: 'aria-label' }) accessibleLabel: string | null = null;
  // Assigned nodes do not exist in Lit's server DOM. Cache their accessible text only when the
  // browser can sample it, before a client-only first paint or just after the hydration render.
  private cachedVisibleLabelText = '';
  private labelObserver?: MutationObserver;
  private readonly onLabelSlotChange = (event: Event): void => {
    if (this.labelPlacement !== 'after') return;
    const target = event.target as Element | null;
    if (target?.nodeType !== 1 || target.localName !== 'slot') return;
    this.bindLabelObserverTargets();
    this.recomputeVisibleLabelText();
  };

  override connectedCallback(): void {
    super.connectedCallback();
    this.addEventListener('slotchange', this.onLabelSlotChange);
    this.syncLabelObservation();
    if (this.labelPlacement !== 'after') return;
    if (this.hasUpdated) {
      this.recomputeVisibleLabelText(true, true);
      this.ownerDocument.defaultView?.queueMicrotask(() => {
        if (this.isConnected && this.labelPlacement === 'after') this.recomputeVisibleLabelText();
      });
    } else this.seedFirstRenderState(() => this.recomputeVisibleLabelText(false));
  }

  private syncLabelObservation(): void {
    this.labelObserver?.disconnect();
    this.labelObserver = undefined;
    if (!this.isConnected || this.labelPlacement !== 'after') return;
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

  private computeVisibleLabelText(preferLightDom = false): string {
    const renderRoot = this.renderRoot as ParentNode | undefined;
    const slot = renderRoot?.querySelector<HTMLSlotElement>('slot');
    const lightDomNodes = (this as unknown as { childNodes?: NodeListOf<ChildNode> }).childNodes;
    const assigned = slot?.assignedNodes({ flatten: true }) ?? [];
    const direct = Array.from(lightDomNodes ?? []).filter(
          (node) => node.nodeType !== 1 || ((node as Element).getAttribute('slot') ?? '') === '',
        );
    const nodes = !preferLightDom && assigned.length > 0 ? assigned : direct;
    return nodes
      .map((node) => composedAccessibilityText(node, {
        ancestorBoundary: this,
        // During cross-document adoption the connected callback can run before layout has
        // produced boxes or refreshed an old slot assignment in the new realm. The root element's
        // own authored hidden/inert/ARIA state remains authoritative; the subsequent
        // slotchange/observer sample restores ordinary composed-ancestor and rendered checks.
        requireRendered: !preferLightDom,
        skipRootAncestorValidation: preferLightDom,
      }))
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private recomputeVisibleLabelText(request = true, preferLightDom = false): void {
    const next = this.computeVisibleLabelText(preferLightDom);
    if (next === this.cachedVisibleLabelText) return;
    this.cachedVisibleLabelText = next;
    if (request) this.requestUpdate();
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    super.willUpdate(changed);
    if (!changed.has('labelPlacement')) return;
    this.syncLabelObservation();
    if (!this.hasUpdated) return;
    if (this.labelPlacement === 'after') this.recomputeVisibleLabelText(false, true);
    else this.cachedVisibleLabelText = '';
  }

  override render(): TemplateResult {
    const label =
      this.accessibleLabel !== null
        ? this.accessibleLabel
        : (this.labelPlacement === 'after' ? this.cachedVisibleLabelText : '') || this.localize('loading');
    return html`<span part="base spinner" role="progressbar" aria-label=${label}>
      <span part="spinner-indicator" aria-hidden="true"></span>
      <span part="label" ?hidden=${this.labelPlacement === 'none'}><slot @slotchange=${this.onLabelSlotChange}></slot></span>
    </span>`;
  }
}
declare global { interface HTMLElementTagNameMap { 'lr-spinner': LyraSpinner; } }
