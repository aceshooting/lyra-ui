import { html, nothing, type TemplateResult, type PropertyValues } from 'lit';
import { property } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { isRtl } from '../../../internal/rtl.js';
import { nextId } from '../../../internal/a11y.js';
import { chevronIcon } from '../../../internal/icons.js';
import { flattenedParentElement } from '../../../internal/composed-tree.js';
import { styles } from './dock-panel.styles.js';
import { resolveCssLength } from '../../../internal/css-length.js';
import { getNumberFormat } from '../../../internal/intl-cache.js';
import { SeparatorDragController, separatorArrowDirection, separatorCoordinate } from '../../../internal/separator-drag.js';
import { markVetoGuardWrite, VetoWriteGuard } from '../../../internal/veto-write-guard.js';
import { requestThenCommit } from '../../../internal/request-commit.js';
import { shadowFocusTarget } from '../../../internal/active-element.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_dockPanelCollapse, LYRA_DEFAULT_dockPanelExpand, LYRA_DEFAULT_dockPanelResize, LYRA_DEFAULT_resizeValuePixels } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END

/** Which edge of the panel's own container it's docked to. `'start'`/`'end'`
 *  are logical-inline (mirror left/right depending on writing direction);
 *  `'top'`/`'bottom'` are block-direction and unaffected by RTL. */
export type LyraDockPanelEdge = 'start' | 'end' | 'top' | 'bottom';

export interface LyraDockPanelResizeDetail {
  /** The panel's new extent along its resize axis, always as a `px` CSS length string. */
  readonly extent: string;
}
export interface LyraDockPanelCollapseChangeDetail {
  /** Whether the panel's content is (or, on the request, would be) shown. */
  readonly expanded: boolean;
}

export interface LyraDockPanelEventMap {
  'lr-resize-request': CustomEvent<LyraDockPanelResizeDetail>;
  'lr-resize': CustomEvent<LyraDockPanelResizeDetail>;
  'lr-resize-input': CustomEvent<LyraDockPanelResizeDetail>;
  'lr-resize-change': CustomEvent<LyraDockPanelResizeDetail>;
  /** @deprecated Use `lr-toggle-request`; same expanded detail. */
  'lr-collapse-request': CustomEvent<LyraDockPanelCollapseChangeDetail>;
  /** @deprecated Use `lr-toggle`; same expanded detail. */
  'lr-collapse-change': CustomEvent<LyraDockPanelCollapseChangeDetail>;
  'lr-toggle-request': CustomEvent<LyraDockPanelCollapseChangeDetail>;
  'lr-toggle': CustomEvent<LyraDockPanelCollapseChangeDetail>;
}

/** Arrow-key step, in px, per keydown on the resize handle. */
const KEYBOARD_STEP_PX = 16;

interface DragState {
  readonly pointerId: number;
  readonly startPos: number;
  readonly startSizePx: number;
  readonly axis: 'inline' | 'block';
  readonly growSign: 1 | -1;
  readonly placement: LyraDockPanelEdge;
  readonly minExtent: string;
  readonly maxExtent: string;
  readonly containerPx: number;
  readonly bounds: { minPx: number; maxPx: number };
  currentSizePx: number;
  expectedExtent: string;
  finalExtent: string;
  acceptedResize: boolean;
}

/**
 * `<lr-dock-panel>` — a single panel docked to one edge of whatever
 * contains it, resizable by dragging its inner edge. Unlike `<lr-multi-split>`
 * (which owns and lays out N sibling panels, and requires restructuring a
 * layout so every panel becomes its direct child), this is one self-
 * contained element you drop next to your existing content -- typically as
 * an absolutely-positioned child of a `position: relative` parent, or as a
 * flex item alongside a main-content sibling. It deliberately imposes no
 * `position`/`inset` of its own (see the styles module): it only manages its
 * own size along the resize axis (`inline-size` for `start`/`end`,
 * `block-size` for `top`/`bottom`) and fills 100% of the cross axis, leaving
 * where it sits in the page entirely up to the consumer's own layout. Live
 * container changes and direct property writes are reconciled without resize
 * interaction events so the rendered extent and separator range remain
 * bounded atomically.
 *
 * `lr-multi-split` stays the right primitive for the multi-sibling-panel case;
 * this is the primitive for the single-edge-docked case, kept as a separate
 * component rather than a second mode bolted onto `lr-multi-split`'s API.
 *
 * Pointer-drag-resize mirrors `lr-multi-split`'s pointer-capture technique
 * (an admitted primary-button pointerdown captures the pointer on the handle,
 * pointermove computes a new size, and pointerup/pointercancel/
 * lostpointercapture all release it) but
 * for a single draggable edge instead of N-1 dividers between N panels, and
 * reasons in raw pixels throughout rather than percent -- `extent` is a CSS
 * length, and pointer movement is naturally pixels, so there's no percent
 * domain to convert through here. Every resize (drag step, drag release, or
 * keyboard step) always commits `extent` as a `px` string regardless of what
 * unit `extent`/`min-extent`/`max-extent` were originally expressed in -- a drag
 * inherently produces a pixel-precise result, so re-expressing it in the
 * caller's original unit (e.g. back into `rem`) would just be lossy
 * re-derivation for no benefit.
 *
 * Collapsing hides the slotted content but keeps the panel itself at a
 * small persistent "rail" width/height (`--lr-dock-panel-collapsed-size`,
 * default `var(--lr-icon-button-size)`) rather than collapsing to zero --
 * a zero-size collapsed panel would have nowhere left to host the toggle
 * button that re-expands it. `extent` itself is left untouched while
 * collapsed, so re-expanding restores what it was unless the live container
 * bounds now require a smaller or larger valid extent.
 *
 * @customElement lr-dock-panel
 * @slot - The panel's own content.
 * @event lr-resize-request - Cancelable proposed `detail: { extent }` before each pointer or
 *   keyboard resize step. Preventing it leaves the current extent unchanged.
 * @event lr-resize - Accepted pointer or keyboard step with frozen `detail: { extent }`.
 * @event lr-resize-input - Frozen `detail: { extent }` (a `px` CSS length string), fired for every
 *   genuine pointer or keyboard value transition. Fully clamped/no-op attempts emit nothing.
 * @event lr-resize-change - Frozen `detail: { extent }`, fired once on genuine pointerup after at
 *   least one accepted value transition, and after each accepted keyboard step. Pointer
 *   cancellation, lost capture, policy/geometry mutation, no-op attempts, and a prevented
 *   `lr-resize-request` all emit nothing.
 * @event lr-collapse-request - A cancelable proposed `collapsed` state from the built-in collapse
 *   toggle. Call `preventDefault()` to keep `collapsed` unchanged. Not fired when a consumer sets
 *   `collapsed` directly. `detail: { expanded }` carries the proposed state.
 * @event lr-collapse-change - Non-cancelable post-commit notification from the built-in collapse
 *   toggle. Not fired when a consumer sets `collapsed` directly. `detail: { expanded }` carries the new state.
 * @event lr-toggle-request - Cancelable proposed `detail: { expanded }` before the built-in toggle commits.
 * @event lr-toggle - Accepted built-in disclosure change with `detail: { expanded }`.
 * @csspart base - The panel root.
 * @csspart content - The wrapper around the default slot; hidden while `collapsed`.
 * @csspart handle - The draggable resize handle on the panel's inner edge. Its numeric ARIA range
 *   remains in CSS pixels while `aria-valuetext` reports the current extent through the effective
 *   locale. Only rendered when not `without-resize` and not `collapsed`.
 * @csspart collapse-toggle - The collapse/expand toggle button. Only rendered when `collapsible`.
 * @cssprop [--lr-dock-panel-collapsed-size=var(--lr-icon-button-size)] - The extent the panel
 *   keeps along its resize axis while `collapsed` -- enough to still host the toggle button that
 *   re-expands it.
 * @cssprop [--lr-dock-panel-collapse-toggle-hover-bg=var(--lr-color-brand-quiet)] - Background of
 *   `collapse-toggle` on hover; also feeds its pressed background via `color-mix()`.
 * @cssprop [--lr-dock-panel-collapse-toggle-hover-color=var(--lr-color-brand)] - Text/icon color
 *   of `collapse-toggle` on hover, reused verbatim for its pressed color too.
 * @cssprop [--lr-dock-panel-handle-hover-color=var(--lr-color-brand)] - Background of `handle` on
 *   hover and keyboard focus -- scoped separately from `collapse-toggle`'s own hover tokens above
 *   even though both default to the same brand token, since the two serve unrelated purposes
 *   (drag affordance vs. button feedback).
 * @cssprop [--lr-dock-panel-handle-active-color=color-mix(in oklab, var(--lr-dock-panel-handle-hover-color, var(--lr-color-brand)), var(--lr-color-mix-partner) var(--lr-color-mix-active))] -
 *   Background of `handle` while actively dragged/pressed.
 * @cssprop [--lr-dock-panel-handle-hit-area=var(--lr-space-m)] - Requested resize target width;
 *   the target is at least `--lr-icon-button-size` and stays inside the panel's clipped edge.
 * @status stable
 * @since 4.0.0
 */
export class LyraDockPanel extends LyraElement<LyraDockPanelEventMap> {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    dockPanelCollapse: LYRA_DEFAULT_dockPanelCollapse,
    dockPanelExpand: LYRA_DEFAULT_dockPanelExpand,
    dockPanelResize: LYRA_DEFAULT_dockPanelResize,
    resizeValuePixels: LYRA_DEFAULT_resizeValuePixels,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static override styles = [LyraElement.styles, styles];

  /** Which edge of its own container the panel is docked to. `'start'`/`'end'` are logical-inline
   *  (they mirror under RTL); `'top'`/`'bottom'` are block-direction. */
  @property({ reflect: true }) placement: LyraDockPanelEdge = 'end';

  private _extent = '280px';
  /** The current docked extent along the resize axis, as a CSS length (e.g. `"320px"`).
   *
   *  Spelled `extent`, not `size`: everywhere else in the library `size` names a tier on the
   *  shared six-step ladder (`internal/variants.ts`'s `LyraSize`), and this is an arbitrary CSS
   *  length instead. A clean rename with no alias -- `size`/`min-size`/`max-size` on
   *  `<lr-dock-panel>` are simply unknown attributes now. */
  @property()
  get extent(): string { return this._extent; }
  set extent(value: string) {
    const old = this._extent;
    this._extent = value;
    markVetoGuardWrite(this.resizeWriteGuard);
    this.requestUpdate('extent', old);
  }
  /** Minimum resize bound, as a CSS length. */
  @property({ attribute: 'min-extent' }) minExtent = '160px';
  /** Maximum resize bound, as a CSS length. Empty means "no explicit cap" -- the live extent of
   *  the containing element is used instead, so the panel still can't be dragged wider/taller than
   *  its container. */
  @property({ attribute: 'max-extent' }) maxExtent = '';
  @property({ type: Boolean, reflect: true }) collapsible = false;
  private readonly toggleWriteGuard = new VetoWriteGuard();
  private _collapsed = false;
  @property({ type: Boolean, reflect: true })
  get collapsed(): boolean { return this._collapsed; }
  set collapsed(next: boolean) {
    const old = this._collapsed;
    this._collapsed = next;
    markVetoGuardWrite(this.toggleWriteGuard);
    this.requestUpdate('collapsed', old);
  }
  /** When set, no drag handle renders at all and the panel is a fixed size. */
  @property({ type: Boolean, reflect: true, attribute: 'without-resize' }) withoutResize = false;

  private drag: DragState | null = null;
  private readonly resizeWriteGuard = new VetoWriteGuard();
  private resizeRequestSequence = 0;
  private renderBounds?: { minPx: number; maxPx: number };
  private renderSizePx?: number;
  private readonly dragController = new SeparatorDragController(
    this,
    (event) => this.onPointerMove(event),
    (event) => event.type === 'pointerup' ? this.onPointerUp(event) : this.onPointerCancel(event),
  );
  private readonly contentId = nextId('dock-panel-content');
  // Keeps aria-valuemax/aria-valuenow (and the %/max-extent fallback they're
  // derived from) live against a *passive* container resize -- window
  // resize, a sibling collapsing, a media query -- none of which touch any
  // reactive property here, so without this they'd otherwise only refresh
  // on the next unrelated Lit re-render. Mirrors lr-multi-split's own
  // collapseResizeObserver technique, just observing the containing element
  // instead of the component's own base.
  private containerResizeObserver?: ResizeObserver;

  override connectedCallback(): void {
    super.connectedCallback();
    this.renderBounds = undefined;
    this.renderSizePx = undefined;
    this.applyHostSize();
    this.armContainerResizeObserver();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.endDrag();
    this.containerResizeObserver?.disconnect();
    this.containerResizeObserver = undefined;
  }

  override adoptedCallback(): void {
    super.adoptedCallback();
    this.renderBounds = undefined;
    this.renderSizePx = undefined;
    this.endDrag();
    this.containerResizeObserver?.disconnect();
    this.containerResizeObserver = undefined;
  }

  /** Creates (idempotently) and observes both the containing element and this
   *  host. The parent catches allocation changes; the host catches flex
   *  reallocation whose parent box itself did not resize. */
  private armContainerResizeObserver(): void {
    const ResizeObserverCtor = this.ownerDocument.defaultView?.ResizeObserver;
    const container = this.container;
    if (!container || !ResizeObserverCtor) return;
    this.containerResizeObserver ??= new ResizeObserverCtor(() => {
      if (!this.isConnected) return;
      if (this.drag && !this.dragSnapshotIsCurrent(this.drag)) this.endDrag();
      this.reconcileLiveExtent();
      this.requestUpdate();
    });
    this.containerResizeObserver.observe(container);
    this.containerResizeObserver.observe(this);
  }

  /** The element this panel docks to: its flat-tree parent, looking through slots. */
  private get container(): Element | null {
    let parent = flattenedParentElement(this);
    while (parent?.localName === 'slot') parent = flattenedParentElement(parent);
    return parent;
  }

  /** Focus lands on the collapse toggle, or on the host itself when the panel has no toggle. */
  private relocateFocus(): void {
    const toggle = this.renderRoot.querySelector<HTMLElement>('[part="collapse-toggle"]');
    if (toggle) {
      toggle.focus();
      return;
    }
    if (!this.hasAttribute('tabindex')) {
      this.tabIndex = -1;
      this.addEventListener('blur', () => this.removeAttribute('tabindex'), { once: true });
    }
    this.focus();
  }

  // Applied in willUpdate (before render), not updated (after render): the
  // handle's aria-valuenow is computed during render from the host's own
  // live getBoundingClientRect(), so the new inline-size/block-size has to
  // already be on the host *before* render runs, or aria-valuenow would
  // read back the size from one update cycle ago.
  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    if (
      this.hasUpdated &&
      ((changed.has('collapsed') && this.collapsed && this.matches(':focus-within')) ||
        (changed.has('withoutResize') && this.withoutResize && shadowFocusTarget(this)?.matches('[part="handle"]')))
    ) this.relocateFocus();
    if (
      changed.has('extent') ||
      changed.has('minExtent') ||
      changed.has('maxExtent') ||
      changed.has('collapsed') ||
      changed.has('placement')
    ) {
      if (this.drag && !this.dragSnapshotIsCurrent(this.drag)) this.endDrag();
      this.reconcileLiveExtent();
    } else if (
      this.drag &&
      ((changed.has('withoutResize') && this.withoutResize) ||
        (changed.has('collapsed') && this.collapsed))
    ) {
      this.endDrag();
    }
  }

  /** `'inline'` for the `start`/`end` edges (resizing changes `inline-size`), `'block'` for
   *  `top`/`bottom` (resizing changes `block-size`). */
  private get axis(): 'inline' | 'block' {
    return this.placement === 'start' || this.placement === 'end' ? 'inline' : 'block';
  }

  /** +1 or -1: which physical pointer-movement/keyboard direction *grows* the panel, folding in
   *  both which edge is pinned (the opposite edge is what's dragged) and, for the inline axis
   *  only, the current RTL-ness -- mirrors lr-multi-split's own horizontal+RTL delta inversion, just
   *  generalized to four possible pinned edges instead of split's always-LTR-authored pair order. */
  private get growSign(): 1 | -1 {
    if (this.placement === 'top') return 1;
    if (this.placement === 'bottom') return -1;
    const rtl = isRtl(this);
    if (this.placement === 'start') return rtl ? -1 : 1;
    return rtl ? 1 : -1; // placement === 'end'
  }

  private applyHostSize(bounds = this.resolveBoundsPx()): void {
    const value = this.collapsed
      ? 'var(--lr-dock-panel-collapsed-size, var(--_lr-dock-panel-collapsed-size))'
      : this.extent;
    if (this.axis === 'inline') {
      this.style.inlineSize = value;
      this.style.blockSize = '';
      this.style.minBlockSize = '';
      this.style.maxBlockSize = '';
      this.style.minInlineSize = this.collapsed ? '' : `${bounds.minPx}px`;
      this.style.maxInlineSize = this.collapsed ? '' : `${bounds.maxPx}px`;
    } else {
      this.style.blockSize = value;
      this.style.inlineSize = '';
      this.style.minInlineSize = '';
      this.style.maxInlineSize = '';
      this.style.minBlockSize = this.collapsed ? '' : `${bounds.minPx}px`;
      this.style.maxBlockSize = this.collapsed ? '' : `${bounds.maxPx}px`;
    }
  }

  /** Live pixel size of the containing block along the resize axis, used both to resolve a `%`
   *  `min-extent`/`max-extent` and as the `max-extent` fallback when unset. Falls back to the viewport
   *  when there's no container (e.g. not yet connected). */
  private containerPx(): number {
    const rect = this.container?.getBoundingClientRect();
    const ownerWindow = this.ownerDocument.defaultView;
    if (this.axis === 'inline')
      return rect?.width ?? ownerWindow?.innerWidth ?? 0;
    return rect?.height ?? ownerWindow?.innerHeight ?? 0;
  }

  private resolveBoundsPx(containerSize = this.containerPx()): { minPx: number; maxPx: number } {
    const containerPx = Math.max(0, containerSize);
    const lengthContext = {
      host: this,
      percentBase: containerPx,
      viewportBasis: this.ownerDocument.defaultView ?? undefined,
    } as const;
    const authoredMax = Math.max(
      0,
      resolveCssLength(this.maxExtent, lengthContext) ?? containerPx
    );
    const maxPx = Math.min(containerPx, authoredMax);
    const authoredMin = Math.max(
      0,
      resolveCssLength(this.minExtent, lengthContext) ?? 0
    );
    const minPx = Math.min(authoredMin, maxPx);
    return { minPx, maxPx };
  }

  /** The panel's own current rendered size (px) along the resize axis, read straight off the
   *  live box -- this is what lets `extent` be expressed in any CSS unit and still drag/step
   *  correctly from wherever it actually rendered, with no separate unit-conversion path for the
   *  "current" value. */
  private currentSizePx(): number {
    const rect = this.getBoundingClientRect();
    return this.axis === 'inline' ? rect.width : rect.height;
  }

  private resizeValueText(sizePx: number): string {
    return this.localize('resizeValuePixels', undefined, {
      value: getNumberFormat(this.effectiveLocale).format(Math.round(sizePx)),
    });
  }

  private reconcileLiveExtent(): void {
    const containerPx = this.containerPx();
    const bounds = this.resolveBoundsPx(containerPx);
    this.applyHostSize(bounds);
    this.renderBounds = bounds;
    if (this.collapsed) return;

    const authoredPx = resolveCssLength(this.extent, {
      host: this,
      percentBase: containerPx,
      viewportBasis: this.ownerDocument.defaultView ?? undefined,
    });
    const renderedPx = this.currentSizePx();
    this.renderSizePx = renderedPx;
    const candidate = authoredPx ?? renderedPx;
    if (!Number.isFinite(candidate)) return;
    const clamped = Math.min(Math.max(candidate, bounds.minPx), bounds.maxPx);
    const renderedOutsideBounds =
      Number.isFinite(renderedPx) &&
      (renderedPx < bounds.minPx - 0.5 || renderedPx > bounds.maxPx + 0.5);
    if (Math.abs(candidate - clamped) <= 0.5 && !renderedOutsideBounds) return;

    const nextExtent = `${Math.round(clamped)}px`;
    if (this.extent !== nextExtent) this.extent = nextExtent;
    this.applyHostSize(bounds);
    this.renderSizePx = this.currentSizePx();
  }

  /** Computes the clamped extent a raw pixel size would resolve to, without applying it --
   *  `undefined` when it's a no-op against the current live size. Split from `applyProposal()` so
   *  a pointer or keyboard step can offer the proposed extent
   *  through the cancelable `lr-resize-request` veto before mutating anything. */
  private resolveProposal(
    px: number,
    bounds = this.resolveBoundsPx(),
    currentSizePx = this.currentSizePx(),
  ): { bounds: { minPx: number; maxPx: number }; nextExtent: string } | undefined {
    const clamped = Math.min(Math.max(px, bounds.minPx), bounds.maxPx);
    const nextExtent = `${Math.round(clamped)}px`;
    const currentExtent = `${Math.round(currentSizePx)}px`;
    if (nextExtent === currentExtent) return undefined;
    return { bounds, nextExtent };
  }

  private applyProposal(bounds: { minPx: number; maxPx: number }, nextExtent: string): void {
    this.extent = nextExtent;
    // Apply the new host size synchronously instead of waiting for Lit's
    // (microtask-batched) update cycle to reach willUpdate: currentSizePx()
    // measures the *live* box, so back-to-back steps (rapid keyboard repeat,
    // or another pointermove before a paint) must each see the size the
    // previous step just committed, not a stale pre-update box.
    this.applyHostSize(bounds);
  }

  /** Proposes `extent` through the cancelable `lr-resize-request` veto point (mirroring
   *  `lr-collapse-request`'s propose-then-commit shape) and applies it only when not
   *  `defaultPrevented`. Returns whether it was applied. */
  private requestResize(bounds: { minPx: number; maxPx: number }, extent: string): string | undefined {
    const requestSequence = ++this.resizeRequestSequence;
    const snapshot = {
      drag: this.drag,
      extent: this.extent,
      placement: this.placement,
      collapsed: this.collapsed,
      withoutResize: this.withoutResize,
      minExtent: this.minExtent,
      maxExtent: this.maxExtent,
      growSign: this.growSign,
      containerPx: this.drag?.containerPx ?? this.containerPx(),
    };
    let committed: string | undefined;
    requestThenCommit({
      requestDetail: Object.freeze({ extent }),
      emitRequest: (detail, init: { cancelable: true }) => this.emit('lr-resize-request', detail, init),
      guard: this.resizeWriteGuard,
      commit: () => {
        const currentBounds = this.resolveBoundsPx(snapshot.containerPx);
        if (
          this.drag !== snapshot.drag || this.collapsed || this.collapsed !== snapshot.collapsed ||
          this.resizeRequestSequence !== requestSequence ||
          this.withoutResize || this.withoutResize !== snapshot.withoutResize ||
          this.extent !== snapshot.extent || this.placement !== snapshot.placement ||
          this.minExtent !== snapshot.minExtent || this.maxExtent !== snapshot.maxExtent ||
          this.growSign !== snapshot.growSign ||
          Math.abs(this.containerPx() - snapshot.containerPx) > 0.5 ||
          Math.abs(currentBounds.minPx - bounds.minPx) > 0.5 ||
          Math.abs(currentBounds.maxPx - bounds.maxPx) > 0.5
        ) {
          if (snapshot.drag && this.drag === snapshot.drag) this.endDrag();
          return;
        }
        this.applyProposal(bounds, extent);
        committed = this.extent;
      },
    });
    return committed;
  }

  private emitResize(
    type: 'lr-resize' | 'lr-resize-input' | 'lr-resize-change',
    extent: string
  ): void {
    this.emit(type, Object.freeze({ extent }));
  }

  private dragSnapshotIsCurrent(drag: DragState): boolean {
    return (
      !this.withoutResize &&
      !this.collapsed &&
      this.placement === drag.placement &&
      this.axis === drag.axis &&
      this.growSign === drag.growSign &&
      this.extent === drag.expectedExtent &&
      this.minExtent === drag.minExtent &&
      this.maxExtent === drag.maxExtent &&
      Math.abs(this.containerPx() - drag.containerPx) <= 0.5
    );
  }

  private onPointerDown = (e: PointerEvent): void => {
    if (
      !e.isPrimary ||
      e.button !== 0 ||
      this.withoutResize ||
      this.collapsed ||
      this.drag
    ) {
      return;
    }
    const handle = e.currentTarget as HTMLElement;
    if (!this.dragController.start(e, handle)) return;
    const axis = this.axis;
    const growSign = this.growSign;
    const containerPx = this.containerPx();
    const startSizePx = this.currentSizePx();
    this.drag = {
      pointerId: e.pointerId,
      startPos: separatorCoordinate(e, axis),
      startSizePx,
      axis,
      growSign,
      placement: this.placement,
      minExtent: this.minExtent,
      maxExtent: this.maxExtent,
      containerPx,
      bounds: this.resolveBoundsPx(containerPx),
      currentSizePx: startSizePx,
      expectedExtent: this.extent,
      finalExtent: this.extent,
      acceptedResize: false,
    };
  };

  private onPointerMove = (e: PointerEvent): void => {
    const drag = this.drag;
    if (!drag || e.pointerId !== drag.pointerId) return;
    if (
      this.withoutResize || this.collapsed || this.placement !== drag.placement ||
      this.axis !== drag.axis || this.growSign !== drag.growSign ||
      this.extent !== drag.expectedExtent || this.minExtent !== drag.minExtent ||
      this.maxExtent !== drag.maxExtent
    ) {
      this.endDrag();
      return;
    }
    const pos = separatorCoordinate(e, drag.axis);
    const delta = drag.growSign * (pos - drag.startPos);
    const proposal = this.resolveProposal(drag.startSizePx + delta, drag.bounds, drag.currentSizePx);
    if (!proposal) return;
    const extent = this.requestResize(proposal.bounds, proposal.nextExtent);
    if (!extent || this.drag !== drag) return;
    drag.expectedExtent = extent;
    drag.finalExtent = extent;
    drag.currentSizePx = parseFloat(extent);
    drag.acceptedResize = true;
    this.emitResize('lr-resize', extent);
    if (this.drag !== drag || this.extent !== extent || this.collapsed || this.withoutResize) return;
    this.emitResize('lr-resize-input', extent);
  };

  private onPointerUp = (e: PointerEvent): void => {
    const drag = this.drag;
    if (!drag || e.pointerId !== drag.pointerId) return;
    const shouldCommit =
      drag.acceptedResize && this.dragSnapshotIsCurrent(drag);
    const finalExtent = drag.finalExtent;
    this.endDrag();
    if (!shouldCommit) return;
    this.emitResize('lr-resize-change', finalExtent);
  };

  private onPointerCancel = (e: PointerEvent): void => {
    if (!this.drag || e.pointerId !== this.drag.pointerId) return;
    this.endDrag();
  };

  private endDrag(): void {
    const pointerId = this.drag?.pointerId;
    this.drag = null;
    if (pointerId != null) this.dragController.end(pointerId);
  }

  private onHandleKeyDown = (e: KeyboardEvent): void => {
    if (this.withoutResize || this.collapsed || e.altKey || e.ctrlKey || e.metaKey || e.isComposing) return;
    // The physical "positive direction" key is always Right/Down; growSign
    // already encodes whether that direction grows or shrinks the panel for
    // the current edge + RTL-ness, exactly mirroring how onPointerMove folds
    // it into the drag delta above.
    const arrowDirection = separatorArrowDirection(e, this.axis, false);
    let proposal: { bounds: { minPx: number; maxPx: number }; nextExtent: string } | undefined;
    if (e.key === 'Home' || e.key === 'End') {
      e.preventDefault();
      const { minPx, maxPx } = this.resolveBoundsPx();
      proposal = this.resolveProposal(e.key === 'Home' ? minPx : maxPx);
    } else if (arrowDirection === 1) {
      e.preventDefault();
      proposal = this.resolveProposal(
        this.currentSizePx() + this.growSign * KEYBOARD_STEP_PX
      );
    } else if (arrowDirection === -1) {
      e.preventDefault();
      proposal = this.resolveProposal(
        this.currentSizePx() - this.growSign * KEYBOARD_STEP_PX
      );
    }
    if (!proposal) return;
    const extent = this.requestResize(proposal.bounds, proposal.nextExtent);
    if (!extent) return;
    this.emitResize('lr-resize', extent);
    if (this.extent !== extent || this.collapsed || this.withoutResize) return;
    this.emitResize('lr-resize-input', extent);
    if (this.extent !== extent || this.collapsed || this.withoutResize) return;
    this.emitResize('lr-resize-change', extent);
  };

  private dispatchingToggle = false;
  private toggleCollapsed = (): void => {
    if (this.dispatchingToggle) return;
    const previous = this.collapsed;
    const detail = () => Object.freeze({ expanded: previous });
    this.dispatchingToggle = true;
    try {
      requestThenCommit({
        requestDetail: detail(),
        emitRequest: (proposal, init: { cancelable: true }) => {
          const request = this.emit('lr-toggle-request', proposal, init);
          const legacy = this.emit('lr-collapse-request', detail(), init);
          if (legacy.defaultPrevented) request.preventDefault();
          return request;
        },
        guard: this.toggleWriteGuard,
        commit: () => {
          if (this.collapsed !== previous) return;
          this.collapsed = !previous;
          this.emit('lr-collapse-change', detail());
          this.emit('lr-toggle', detail());
        },
      });
    } finally {
      this.dispatchingToggle = false;
    }
  };

  /** Rotation (deg) for the collapse-toggle's chevron on the `top`/`bottom` edges: it points
   *  toward the panel's pinned edge when expanded (the direction clicking it will shrink toward)
   *  and away from it when collapsed (the direction clicking it will grow toward) -- mirrors
   *  lr-widget's collapse-button rotate-the-wrapping-part technique. Direction-independent (the
   *  block axis is unaffected by `dir`), so it stays a plain JS-computed inline rotation.
   *  `start`/`end` mirroring, which DOES depend on `dir`, is a live `:dir(rtl)` CSS rule on
   *  `[part="collapse-toggle"] span` instead (dock-panel.styles.ts) so an ancestor `dir` flip
   *  repaints it with no re-render needed -- returns `undefined` for those two edges so the
   *  template leaves no competing inline `transform` behind. */
  private get topBottomChevronDeg(): number | undefined {
    if (this.placement === 'top') return this.collapsed ? 90 : -90;
    if (this.placement === 'bottom') return this.collapsed ? -90 : 90;
    return undefined;
  }

  private handleTemplate(): TemplateResult | typeof nothing {
    if (this.withoutResize || this.collapsed) return nothing;
    const { minPx, maxPx } = this.renderBounds ?? this.resolveBoundsPx();
    const nowPx = Math.min(Math.max(this.renderSizePx ?? this.currentSizePx(), minPx), maxPx);
    // hit-area-exempt: a drag-handle separator (role="separator",
    // mouse-drag/arrow-key resize), not a tap-to-activate icon button: the
    // visible bar stays a slim 3px while [part='handle']::before (see
    // dock-panel.styles.ts) widens the real pointer-capture hit-slop, which
    // the base's overflow clip limits to the panel's own edge.
    return html`<div
      part="handle"
      role="separator"
      aria-label=${this.localize('dockPanelResize')}
      aria-orientation=${this.axis === 'inline' ? 'vertical' : 'horizontal'}
      aria-valuenow=${Math.round(nowPx)}
      aria-valuetext=${this.resizeValueText(nowPx)}
      aria-valuemin=${Math.round(minPx)}
      aria-valuemax=${Math.round(maxPx)}
      tabindex="0"
      @pointerdown=${this.onPointerDown}
      @keydown=${this.onHandleKeyDown}
    ></div>`;
  }

  private collapseToggleTemplate(): TemplateResult | typeof nothing {
    if (!this.collapsible) return nothing;
    return html`<button
      part="collapse-toggle"
      type="button"
      aria-expanded=${this.collapsed ? 'false' : 'true'}
      aria-controls=${this.contentId}
      aria-label=${this.collapsed
        ? this.localize('dockPanelExpand')
        : this.localize('dockPanelCollapse')}
      @click=${this.toggleCollapsed}
    >
      <span
        style=${this.topBottomChevronDeg === undefined
          ? 'display:inline-flex'
          : `display:inline-flex;transform:rotate(${this.topBottomChevronDeg}deg)`}
        >${chevronIcon()}</span
      >
    </button>`;
  }

  override render(): TemplateResult {
    return html`
      <div part="base">
        <div part="content" id=${this.contentId} ?hidden=${this.collapsed}>
          <slot></slot>
        </div>
        ${this.handleTemplate()} ${this.collapseToggleTemplate()}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-dock-panel': LyraDockPanel;
  }
}
