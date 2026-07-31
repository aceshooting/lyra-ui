import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property, query } from 'lit/decorators.js';
import type { Placement } from '@floating-ui/dom';
import { LyraElement } from '../../../internal/lyra-element.js';
import { place, virtualAnchorFromRect, type VirtualAnchor } from '../../../internal/positioner.js';
import { rtlAwarePlacement } from '../../../internal/rtl.js';
import { finiteNumber } from '../../../internal/numbers.js';
import { trueDefaultBooleanConverter } from '../../../internal/converters.js';
import { styles } from './popup.styles.js';

export interface LyraPopupEventMap {
  'lr-reposition': CustomEvent<{ placement: Placement }>;
}

/**
 * `<lr-popup>` — the low-level anchored-positioning primitive.
 *
 * It positions its `popup` slot against an anchor and keeps the two aligned through scroll,
 * resize and layout change. That is *all* it does: no dismiss behaviour, no focus management, no
 * ARIA relationship, no trigger semantics. Those are policy, and policy belongs to the component
 * built on top — `<lr-popover>`, `<lr-dropdown>` and `<lr-tooltip>` each layer their own.
 *
 * Reach for it when you need a floating surface the library does not already ship: an anchored
 * inline editor, a colour-picker panel, a custom autocomplete list. If you find yourself adding
 * light dismiss and focus return on top, use `<lr-popover>` instead.
 *
 * @customElement lr-popup
 * @slot anchor - The element to position against. Ignored when `for` or `virtualAnchor` is set.
 * @slot - The floating content.
 * @event lr-reposition - Emitted after each recomputation. `detail: { placement }` carries the
 * placement actually used, which `flip` may have changed.
 * @csspart anchor - The anchor slot wrapper.
 * @csspart popup - The positioned floating surface. Carries the resolved side (`top`, `bottom`,
 * `left`, `right`) in its part name, so `::part(popup bottom)` can style one side — state after
 * `::part()` never matches.
 * @csspart arrow - The arrow element, rendered only when `arrow` is set.
 * @cssprop [--lr-popup-arrow-size=var(--lr-size-0-375rem)] - Half-width of the arrow square.
 */
export class LyraPopup extends LyraElement<LyraPopupEventMap> {
  static override styles = [LyraElement.styles, styles];

  /** Whether the popup is rendered and positioned. Nothing else changes when it flips. */
  @property({ type: Boolean, reflect: true }) active = false;

  /**
   * Id of an element elsewhere in the same root to anchor against, instead of the `anchor` slot.
   * Resolved in this element's own root, so it works inside a shadow tree where an idref could not
   * cross the boundary.
   */
  @property({ reflect: true }) for = '';

  /** Preferred placement. `flip`/`shift` may override it; the result is reported by `lr-reposition`. */
  @property({ reflect: true }) placement: Placement = 'bottom-start';

  /** Distance from the anchor along the placement axis, in pixels. */
  @property({ type: Number }) distance = 4;

  /** Offset along the anchor's edge, in pixels. */
  @property({ type: Number }) skidding = 0;

  /** Flip to the opposite side when the preferred one does not fit. */
  @property({ type: Boolean, converter: trueDefaultBooleanConverter, reflect: true }) flip = true;

  /** Shift along the anchor's edge to stay within the viewport. */
  @property({ type: Boolean, converter: trueDefaultBooleanConverter, reflect: true }) shift = true;

  /** Viewport padding kept clear by `shift` and by the available-size measurement. */
  @property({ type: Number }) padding = 8;

  /** Render an arrow that points at the anchor. */
  @property({ type: Boolean, reflect: true }) arrow = false;

  /** Keeps the arrow this far from the popup's corners, in pixels. */
  @property({ type: Number, attribute: 'arrow-padding' }) arrowPadding = 0;

  /**
   * Anchor against an arbitrary rectangle rather than an element — a canvas hit, a chart datum, a
   * text-selection range. Takes precedence over `for` and the `anchor` slot. Assign `null` to go
   * back to element anchoring.
   */
  @property({ attribute: false }) virtualAnchor: VirtualAnchor | { x: number; y: number; width?: number; height?: number } | null = null;

  @query('[part~="popup"]') private popupElement!: HTMLElement;
  @query('[part="arrow"]') private arrowElement!: HTMLElement;
  @query('[part="anchor"]') private anchorSlotWrapper!: HTMLElement;

  private stopPlacing?: () => void;
  private resolvedPlacement: Placement = 'bottom-start';

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    // Transient positioning state never survives a detach: autoUpdate holds listeners on the
    // anchor's scroll ancestors, and a re-attached element re-resolves its anchor from scratch.
    this.teardown();
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    // Any of these changes the anchor, the geometry or whether there is anything to position.
    this.reposition();
    void changed;
  }

  /** Recomputes the position now. Rarely needed — the popup already tracks scroll, resize and
   *  layout change — but a consumer that moved a virtual anchor imperatively can force a pass. */
  reposition(): void {
    this.teardown();
    if (!this.active || !this.popupElement) return;
    const anchor = this.resolveAnchor();
    if (!anchor) return;
    this.stopPlacing = place(anchor, this.popupElement, {
      placement: rtlAwarePlacement(this.placement, this),
      offset: finiteNumber(this.distance, 4),
      skidding: finiteNumber(this.skidding, 0),
      flip: this.flip,
      shift: this.shift,
      padding: finiteNumber(this.padding, 8),
      arrow: this.arrow ? this.arrowElement : undefined,
      arrowPadding: finiteNumber(this.arrowPadding, 0),
      onPlaced: ({ placement, arrow }) => {
        this.applyArrow(placement, arrow);
        if (placement === this.resolvedPlacement) return;
        this.resolvedPlacement = placement;
        this.applySidePart(placement);
        this.emit('lr-reposition', { placement });
      },
    });
  }

  private teardown(): void {
    this.stopPlacing?.();
    this.stopPlacing = undefined;
  }

  private resolveAnchor(): Element | VirtualAnchor | null {
    if (this.virtualAnchor) {
      const candidate = this.virtualAnchor as VirtualAnchor;
      if (typeof candidate.getBoundingClientRect === 'function') return candidate;
      const rect = this.virtualAnchor as { x: number; y: number; width?: number; height?: number };
      if (!Number.isFinite(rect.x) || !Number.isFinite(rect.y)) return null;
      return virtualAnchorFromRect(rect);
    }
    if (this.for) {
      const root = this.getRootNode() as Document | ShadowRoot;
      const target = root.getElementById?.(this.for) ?? null;
      if (target) return target;
    }
    const slot = this.anchorSlotWrapper?.querySelector('slot');
    return (slot as HTMLSlotElement | null)?.assignedElements({ flatten: true })[0] ?? null;
  }

  /** The resolved side lives in the part name, never as an attribute after `::part()` — that
   *  selector shape silently never matches. */
  private applySidePart(placement: Placement): void {
    const side = placement.split('-')[0] ?? 'bottom';
    this.popupElement?.setAttribute('part', `popup ${side}`);
  }

  private applyArrow(placement: Placement, coords: { x?: number; y?: number } | undefined): void {
    if (!this.arrow || !this.arrowElement) return;
    const side = placement.split('-')[0] ?? 'bottom';
    const opposite = { top: 'bottom', bottom: 'top', left: 'right', right: 'left' }[side] ?? 'top';
    const style = this.arrowElement.style;
    style.left = coords?.x === undefined ? '' : `${coords.x}px`;
    style.top = coords?.y === undefined ? '' : `${coords.y}px`;
    style.right = '';
    style.bottom = '';
    style.setProperty(opposite, 'calc(-1 * var(--lr-popup-arrow-size, var(--lr-size-0-375rem)))');
  }

  override render(): TemplateResult {
    return html`
      <span part="anchor"><slot name="anchor"></slot></span>
      <div part="popup ${this.resolvedPlacement.split('-')[0]}" ?data-active=${this.active}>
        <slot></slot>
        ${this.arrow ? html`<span part="arrow"></span>` : nothing}
      </div>
    `;
  }
}

declare global { interface HTMLElementTagNameMap { 'lr-popup': LyraPopup; } }
