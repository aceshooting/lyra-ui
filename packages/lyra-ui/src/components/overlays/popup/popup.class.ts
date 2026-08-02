import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property, query } from 'lit/decorators.js';
import type { Placement } from '@floating-ui/dom';
import { LyraElement } from '../../../internal/lyra-element.js';
import {
  place,
  virtualAnchorFromRect,
  type PlaceAutoSize,
  type PlaceBoundary,
  type PlaceFlipFallbackStrategy,
  type PlaceStrategy,
  type PlaceSync,
  type VirtualAnchor,
} from '../../../internal/positioner.js';
import { rtlAwarePlacement } from '../../../internal/rtl.js';
import { finiteNumber } from '../../../internal/numbers.js';
import { applyOverlayArrow, type LyraArrowPlacement } from '../overlay/overlay-arrow.js';
import { styles } from './popup.styles.js';

export type {
  LyraArrowPlacement,
  PlaceAutoSize,
  PlaceBoundary,
  PlaceFlipFallbackStrategy,
  PlaceStrategy,
  PlaceSync,
};

/** Shared boundary vocabulary exposed by the mapped popup primitive. */
export type LyraPopupBoundary = 'viewport' | 'scroll';

/** Every public anchor form the mapped primitive accepts. */
export type LyraPopupAnchor = Element | string | VirtualAnchor;

/** The mapped spelling is `initial`; `initial-placement` remains a compatibility alias. */
export type LyraPopupFlipFallbackStrategy = 'best-fit' | 'initial' | 'initial-placement';

/** Every `Placement` Floating UI accepts, for validating the `flip-fallback-placements` list. */
const PLACEMENTS: ReadonlySet<string> = new Set([
  'top',
  'top-start',
  'top-end',
  'bottom',
  'bottom-start',
  'bottom-end',
  'left',
  'left-start',
  'left-end',
  'right',
  'right-start',
  'right-end',
]);

/** An unrecognised `auto-size`/`sync` attribute is inert rather than half-applied: both write
 *  directly to the popup's box, so guessing at a typo would resize it for the wrong reason. */
const AUTO_SIZE_AXES: ReadonlySet<string> = new Set(['horizontal', 'vertical', 'both']);
const SYNC_AXES: ReadonlySet<string> = new Set(['width', 'height', 'both']);

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
 * The v8 defaults match the mapped primitive: `placement="top"`, `strategy="absolute"`, zero
 * distance/padding, and opt-in flip/shift. `auto-size` narrows an always-on measurement rather
 * than switching one on: this element publishes the available space as
   * `--lr-positioner-available-inline-size`/`--lr-positioner-available-block-size` and caps the
 * popup with them, so `auto-size` re-measures the named axes against `auto-size-boundary` and
 * `auto-size-padding` instead of the shared `padding`.
 *
 * @customElement lr-popup
 * @slot anchor - The element to position against. Ignored when `anchor`, `for`, or
 * `virtualAnchor` is set.
 * @slot - The floating content.
 * @event lr-reposition - Emitted after each recomputation. `detail: { placement }` carries the
 * placement actually used, which `flip` may have changed.
 * @csspart anchor - The anchor slot wrapper.
 * @csspart popup - The positioned floating surface. Carries the resolved side (`top`, `bottom`,
 * `left`, `right`) in its part name, so `::part(popup bottom)` can style one side — state after
 * `::part()` never matches.
 * @csspart arrow - The arrow element, rendered only when `arrow` is set. Its part name also
 * carries the resolved side (`arrow-top`, `arrow-bottom`, `arrow-left`, `arrow-right`), matching
 * `<lr-popover>` and `<lr-tooltip>`.
 * @csspart hover-bridge - The invisible quad spanning the `distance` gap between anchor and popup,
 * rendered only when `hover-bridge` is set.
 * @cssprop [--arrow-size=var(--lr-popup-arrow-size,var(--lr-size-0-375rem))] - Half-width of the
 * arrow square. `--lr-popup-arrow-size` remains a compatibility alias.
 * @cssprop --lr-popup-arrow-size - Retained Lyra fallback for `--arrow-size`.
 * @cssprop [--arrow-color=var(--lr-color-surface-raised)] - Arrow fill.
 * @cssprop [--popup-border-width=var(--lr-border-width-thin)] - Popup/arrow border width.
 * @cssprop [--show-duration=var(--lr-duration-fast)] - Activation transition duration.
 * @cssprop [--hide-duration=var(--lr-duration-fast)] - Deactivation transition duration.
 * @cssprop --auto-size-available-width - Read-only available inline size.
 * @cssprop --auto-size-available-height - Read-only available block size.
 * @status stable
 * @since 8.0.0
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

  /** Element, same-root id string, or Floating UI-compatible virtual element to position against.
   *  Takes precedence over `for` and the anchor slot; `virtualAnchor` remains the highest-priority
   *  Lyra compatibility path. */
  @property() anchor: LyraPopupAnchor | null = null;

  /** Preferred placement. `flip`/`shift` may override it; the result is reported by `lr-reposition`. */
  @property({ reflect: true }) placement: Placement = 'top';

  /**
   * CSS positioning scheme. `fixed` escapes every ancestor's
   * transform/filter/containment context; `absolute` positions against the nearest positioned
   * ancestor, so the popup scrolls away with the content it belongs to. Defaults to `absolute`.
   */
  @property({ reflect: true }) strategy: PlaceStrategy = 'absolute';

  /** Distance from the anchor along the placement axis, in pixels. */
  @property({ type: Number }) distance = 0;

  /** Offset along the anchor's edge, in pixels. */
  @property({ type: Number }) skidding = 0;

  /** Flip to the opposite side when the preferred one does not fit. */
  @property({ type: Boolean, reflect: true }) flip = false;

  /**
   * Space-delimited placements `flip` tries, in order, instead of just the opposite side —
   * `flip-fallback-placements="right bottom"`. Unrecognised entries are ignored.
   */
  @property({ attribute: 'flip-fallback-placements' }) flipFallbackPlacements = '';

  /**
   * What `flip` settles on when none of the candidate placements fit: `best-fit` takes the
   * least-overflowing one, `initial` keeps `placement` as written. `initial-placement` remains a
   * compatibility alias.
   */
  @property({ attribute: 'flip-fallback-strategy' })
  flipFallbackStrategy: LyraPopupFlipFallbackStrategy = 'best-fit';

  /** Shared clipping boundary. `viewport` ignores clipping ancestors; `scroll` uses them. The
   *  separate flip/shift/auto-size boundaries below override this value one middleware at a time. */
  @property({ reflect: true }) boundary: LyraPopupBoundary = 'viewport';

  /** Element(s) `flip` measures overflow against, instead of the popup's clipping ancestors. */
  @property({ attribute: false }) flipBoundary: PlaceBoundary | null = null;

  /** Padding kept clear inside the flip boundary, in pixels. */
  @property({ type: Number, attribute: 'flip-padding' }) flipPadding = 0;

  /** Shift along the anchor's edge to stay within the viewport. */
  @property({ type: Boolean, reflect: true }) shift = false;

  /** Element(s) `shift` measures overflow against, instead of the popup's clipping ancestors. */
  @property({ attribute: false }) shiftBoundary: PlaceBoundary | null = null;

  /** Padding kept clear inside the shift boundary, in pixels. */
  @property({ type: Number, attribute: 'shift-padding' }) shiftPadding = 0;

  /** Viewport padding kept clear by `shift` and by the available-size measurement. */
  @property({ type: Number }) padding = 0;

  /**
   * Re-measures the available space on the named axes against `auto-size-boundary` and
   * `auto-size-padding` rather than the shared `padding`. The popup is capped by that measurement
   * either way — this narrows or widens the cap, it does not introduce one.
   */
  @property({ attribute: 'auto-size' }) autoSize: PlaceAutoSize | null = null;

  /** Element(s) the `auto-size` measurement uses, instead of the popup's clipping ancestors. */
  @property({ attribute: false }) autoSizeBoundary: PlaceBoundary | null = null;

  /** Padding kept clear inside the auto-size boundary, in pixels. */
  @property({ type: Number, attribute: 'auto-size-padding' }) autoSizePadding = 0;

  /** Copies the anchor's inline size, block size, or both onto the popup. */
  @property() sync: PlaceSync | null = null;

  /**
   * Renders an invisible quad across the `distance` gap between anchor and popup, so a pointer
   * travelling between them never leaves both at once. Purely geometric — this element owns no
   * hover policy of its own; the component built on top reads the hover.
   */
  @property({ type: Boolean, attribute: 'hover-bridge', reflect: true }) hoverBridge = false;

  /** Render an arrow that points at the anchor. */
  @property({ type: Boolean, reflect: true }) arrow = false;

  /** Where the arrow sits along the popup's edge. `anchor` tracks the anchor's centre. */
  @property({ attribute: 'arrow-placement' }) arrowPlacement: LyraArrowPlacement = 'anchor';

  /** Keeps the arrow this far from the popup's corners, in pixels. */
  @property({ type: Number, attribute: 'arrow-padding' }) arrowPadding = 10;

  /**
   * Anchor against an arbitrary rectangle rather than an element — a canvas hit, a chart datum, a
   * text-selection range. Takes precedence over `for` and the `anchor` slot. Assign `null` to go
   * back to element anchoring.
   */
  @property({ attribute: false }) virtualAnchor: VirtualAnchor | { x: number; y: number; width?: number; height?: number } | null = null;

  /** The positioned popup element, exposed for mapped popup integrations. Upstream public types
   * permit assignment, so writes are accepted for source compatibility; the shadow-owned node
   * remains authoritative because replacing it would detach positioning, parts, and animation. */
  get popup(): HTMLElement {
    return this.renderRoot?.querySelector<HTMLElement>('[part~="popup"]') as HTMLElement;
  }
  set popup(_next: HTMLElement) {}
  @query('[part~="arrow"]') private arrowElement!: HTMLElement;
  @query('[part~="hover-bridge"]') private hoverBridgeElement!: HTMLElement;
  @query('[part="anchor"]') private anchorSlotWrapper!: HTMLElement;

  private stopPlacing?: () => void;
  private resolvedPlacement: Placement = 'top';

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
    if (!this.active || !this.popup) return;
    const anchor = this.resolveAnchor();
    if (!anchor) return;
    const arrowPadding = Math.max(0, finiteNumber(this.arrowPadding, 0));
    this.stopPlacing = place(anchor, this.popup, {
      placement: rtlAwarePlacement(this.placement, this),
      strategy: this.strategy === 'absolute' ? 'absolute' : 'fixed',
      offset: finiteNumber(this.distance, 0),
      skidding: finiteNumber(this.skidding, 0),
      boundary: this.boundary === 'scroll' ? undefined : [],
      flip: this.flip,
      flipFallbackPlacements: this.parsedFlipFallbackPlacements,
      flipFallbackStrategy:
        this.flipFallbackStrategy === 'initial' || this.flipFallbackStrategy === 'initial-placement'
          ? 'initial-placement'
          : 'best-fit',
      flipBoundary: this.flipBoundary ?? undefined,
      flipPadding: Math.max(0, finiteNumber(this.flipPadding, 0)),
      shift: this.shift,
      shiftBoundary: this.shiftBoundary ?? undefined,
      shiftPadding: Math.max(0, finiteNumber(this.shiftPadding, 0)),
      padding: Math.max(0, finiteNumber(this.padding, 0)),
      autoSize: AUTO_SIZE_AXES.has(this.autoSize as string) ? (this.autoSize as PlaceAutoSize) : undefined,
      autoSizeBoundary: this.autoSizeBoundary ?? undefined,
      autoSizePadding: Math.max(0, finiteNumber(this.autoSizePadding, 0)),
      sync: SYNC_AXES.has(this.sync as string) ? (this.sync as PlaceSync) : undefined,
      arrow: this.arrow ? this.arrowElement : undefined,
      arrowPadding,
      hoverBridge: this.hoverBridge ? this.hoverBridgeElement : undefined,
      onPlaced: ({ placement, arrow }) => {
        // Upstream exposes these two read-only compatibility properties without a prefix. Write
        // them from the token-backed internal measurement rather than declaring an unprefixed
        // design value in component CSS (which the repository style policy correctly rejects).
        this.popup.style.setProperty(
          '--auto-size-available-width',
          this.popup.style.getPropertyValue('--lr-positioner-available-inline-size'),
        );
        this.popup.style.setProperty(
          '--auto-size-available-height',
          this.popup.style.getPropertyValue('--lr-positioner-available-block-size'),
        );
        // The same arrow geometry <lr-popover> and <lr-tooltip> use, so `arrow-placement` means
        // one thing across every anchored surface in the library.
        const side = applyOverlayArrow(this.arrowElement ?? null, {
          placement,
          coords: arrow,
          enabled: this.arrow,
          arrowPlacement: this.arrowPlacement,
          arrowPadding,
          rtl: this.effectiveDirection === 'rtl',
          sizeProperty: '--arrow-size',
          fallbackSizeProperty: '--lr-popup-arrow-size',
        });
        this.applyArrowSidePart(side);
        if (placement === this.resolvedPlacement) return;
        this.resolvedPlacement = placement;
        this.applySidePart(placement);
        this.emit('lr-reposition', { placement });
      },
    });
  }

  /** `flip-fallback-placements` is a space-delimited attribute, mirroring the upstream primitive.
   *  Unrecognised tokens are dropped rather than forwarded — Floating UI would otherwise place
   *  against a placement string it cannot resolve. */
  private get parsedFlipFallbackPlacements(): Placement[] | undefined {
    const raw = (this.flipFallbackPlacements ?? '').trim();
    if (!raw) return undefined;
    const parsed = raw.split(/[\s,]+/).filter((token): token is Placement => PLACEMENTS.has(token));
    return parsed.length ? parsed : undefined;
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
    if (this.anchor) {
      if (typeof this.anchor === 'string') {
        const root = this.getRootNode() as Document | ShadowRoot;
        const target = root.getElementById?.(this.anchor) ?? null;
        if (target) return target;
      } else if (this.anchor instanceof Element) {
        return this.anchor;
      } else if (typeof this.anchor.getBoundingClientRect === 'function') {
        return this.anchor;
      }
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
    this.popup?.setAttribute('part', `popup ${side}`);
  }

  /** Same rule as `applySidePart`: the resolved side rides in the part name, never in an
   *  attribute after `::part()`. Matches `<lr-popover>`/`<lr-tooltip>`'s `arrow-<side>` token. */
  private applyArrowSidePart(side: 'top' | 'bottom' | 'left' | 'right'): void {
    this.arrowElement?.setAttribute('part', `arrow arrow-${side}`);
  }

  override render(): TemplateResult {
    const side = this.resolvedPlacement.split('-')[0];
    return html`
      ${this.hoverBridge ? html`<span part="hover-bridge" ?data-active=${this.active}></span>` : nothing}
      <span part="anchor"><slot name="anchor"></slot></span>
      <div part="popup ${side}" ?data-active=${this.active}>
        <slot></slot>
        ${this.arrow ? html`<span part="arrow arrow-${side}"></span>` : nothing}
      </div>
    `;
  }
}

declare global { interface HTMLElementTagNameMap { 'lr-popup': LyraPopup; } }
