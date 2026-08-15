import { html, nothing, type TemplateResult, type PropertyValues } from "lit";
import { property } from "lit/decorators.js";
import { LyraElement } from "../../../internal/lyra-element.js";
import { isRtl } from "../../../internal/rtl.js";
import { nextId } from "../../../internal/a11y.js";
import { chevronIcon } from "../../../internal/icons.js";
import { styles } from "./dock-panel.styles.js";
import { trueDefaultBooleanConverter } from "../../../internal/converters.js";
import { resolveCssLength } from "../../../internal/css-length.js";
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from "../../../internal/localization.js";
import {
  LYRA_DEFAULT_dockPanelCollapse,
  LYRA_DEFAULT_dockPanelExpand,
  LYRA_DEFAULT_dockPanelResize,
} from "../../../internal/default-strings.generated.js";
// GENERATED DEFAULT-STRING SLICE IMPORT: END

/** Which edge of the panel's own container it's docked to. `'start'`/`'end'`
 *  are logical-inline (mirror left/right depending on writing direction);
 *  `'top'`/`'bottom'` are block-direction and unaffected by RTL. */
export type LyraDockPanelEdge = "start" | "end" | "top" | "bottom";

export interface LyraDockPanelResizeDetail {
  /** The panel's new extent along its resize axis, always as a `px` CSS length string. */
  readonly extent: string;
}
export interface LyraDockPanelCollapseChangeDetail {
  readonly collapsed: boolean;
}

export interface LyraDockPanelEventMap {
  "lr-resize-input": CustomEvent<LyraDockPanelResizeDetail>;
  "lr-resize-change": CustomEvent<LyraDockPanelResizeDetail>;
  "lr-collapse-request": CustomEvent<LyraDockPanelCollapseChangeDetail>;
  "lr-collapse-change": CustomEvent<LyraDockPanelCollapseChangeDetail>;
}

/** Arrow-key step, in px, per keydown on the resize handle. */
const KEYBOARD_STEP_PX = 16;

interface DragState {
  readonly pointerId: number;
  readonly startPos: number;
  readonly startSizePx: number;
  readonly axis: "inline" | "block";
  readonly growSign: 1 | -1;
  readonly edge: LyraDockPanelEdge;
  readonly minExtent: string;
  readonly maxExtent: string;
  readonly containerPx: number;
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
 * @event lr-resize-input - Frozen `detail: { extent }` (a `px` CSS length string), fired for every
 *   genuine pointer or keyboard value transition. Fully clamped/no-op attempts emit nothing.
 * @event lr-resize-change - Frozen `detail: { extent }`, fired once on genuine pointerup after at
 *   least one value transition, and after each genuine keyboard step. Pointer cancellation, lost
 *   capture, policy/geometry mutation, and no-op attempts emit nothing.
 * @event lr-collapse-request - A cancelable proposed `collapsed` state from the built-in collapse
 *   toggle. Call `preventDefault()` to keep `collapsed` unchanged. Not fired when a consumer sets
 *   `collapsed` directly. `detail: { collapsed }`.
 * @event lr-collapse-change - Non-cancelable post-commit notification from the built-in collapse
 *   toggle. Not fired when a consumer sets `collapsed` directly. `detail: { collapsed }` (the new
 *   `collapsed` state).
 * @csspart base - The panel root.
 * @csspart content - The wrapper around the default slot; hidden while `collapsed`.
 * @csspart handle - The draggable resize handle on the panel's inner edge. Only rendered when
 *   `resizable` and not `collapsed`.
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
 * @status stable
 * @since 4.0.0
 */
export class LyraDockPanel extends LyraElement<LyraDockPanelEventMap> {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> =
    {
      ...super.defaultStrings,
      dockPanelCollapse: LYRA_DEFAULT_dockPanelCollapse,
      dockPanelExpand: LYRA_DEFAULT_dockPanelExpand,
      dockPanelResize: LYRA_DEFAULT_dockPanelResize,
    };
  // GENERATED DEFAULT-STRING SLICE: END

  static override styles = [LyraElement.styles, styles];

  @property({ reflect: true }) edge: LyraDockPanelEdge = "end";
  /** The current docked extent along the resize axis, as a CSS length (e.g. `"320px"`).
   *
   *  Spelled `extent`, not `size`: everywhere else in the library `size` names a tier on the
   *  shared six-step ladder (`internal/variants.ts`'s `LyraSize`), and this is an arbitrary CSS
   *  length instead. A clean rename with no alias -- `size`/`min-size`/`max-size` on
   *  `<lr-dock-panel>` are simply unknown attributes now. */
  @property() extent = "280px";
  /** Minimum resize bound, as a CSS length. */
  @property({ attribute: "min-extent" }) minExtent = "160px";
  /** Maximum resize bound, as a CSS length. Empty means "no explicit cap" -- the live extent of
   *  the containing element is used instead, so the panel still can't be dragged wider/taller than
   *  its container. */
  @property({ attribute: "max-extent" }) maxExtent = "";
  @property({ type: Boolean, reflect: true }) collapsible = false;
  @property({ type: Boolean, reflect: true }) collapsed = false;
  /** When `false`, no drag handle renders at all and the panel is a fixed size. */
  @property({
    type: Boolean,
    reflect: true,
    converter: trueDefaultBooleanConverter,
  })
  resizable = true;

  private drag: DragState | null = null;
  private dragOwnerWindow?: Window;
  private readonly contentId = nextId("dock-panel-content");
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
    this.endDrag();
    this.containerResizeObserver?.disconnect();
    this.containerResizeObserver = undefined;
  }

  /** Creates (idempotently) and observes both the containing element and this
   *  host. The parent catches allocation changes; the host catches flex
   *  reallocation whose parent box itself did not resize. */
  private armContainerResizeObserver(): void {
    const ResizeObserverCtor = this.ownerDocument.defaultView?.ResizeObserver;
    if (!this.parentElement || !ResizeObserverCtor) return;
    this.containerResizeObserver ??= new ResizeObserverCtor(() => {
      if (!this.isConnected) return;
      if (this.drag && !this.dragSnapshotIsCurrent(this.drag)) this.endDrag();
      this.reconcileLiveExtent();
      this.requestUpdate();
    });
    this.containerResizeObserver.observe(this.parentElement);
    this.containerResizeObserver.observe(this);
  }

  // Applied in willUpdate (before render), not updated (after render): the
  // handle's aria-valuenow is computed during render from the host's own
  // live getBoundingClientRect(), so the new inline-size/block-size has to
  // already be on the host *before* render runs, or aria-valuenow would
  // read back the size from one update cycle ago.
  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    if (
      changed.has("extent") ||
      changed.has("minExtent") ||
      changed.has("maxExtent") ||
      changed.has("collapsed") ||
      changed.has("edge")
    ) {
      if (this.drag && !this.dragSnapshotIsCurrent(this.drag)) this.endDrag();
      this.reconcileLiveExtent();
    } else if (
      this.drag &&
      ((changed.has("resizable") && !this.resizable) ||
        (changed.has("collapsed") && this.collapsed))
    ) {
      this.endDrag();
    }
  }

  /** `'inline'` for the `start`/`end` edges (resizing changes `inline-size`), `'block'` for
   *  `top`/`bottom` (resizing changes `block-size`). */
  private get axis(): "inline" | "block" {
    return this.edge === "start" || this.edge === "end" ? "inline" : "block";
  }

  /** +1 or -1: which physical pointer-movement/keyboard direction *grows* the panel, folding in
   *  both which edge is pinned (the opposite edge is what's dragged) and, for the inline axis
   *  only, the current RTL-ness -- mirrors lr-multi-split's own horizontal+RTL delta inversion, just
   *  generalized to four possible pinned edges instead of split's always-LTR-authored pair order. */
  private get growSign(): 1 | -1 {
    if (this.edge === "top") return 1;
    if (this.edge === "bottom") return -1;
    const rtl = isRtl(this);
    if (this.edge === "start") return rtl ? -1 : 1;
    return rtl ? 1 : -1; // edge === 'end'
  }

  private applyHostSize(bounds = this.resolveBoundsPx()): void {
    const value = this.collapsed
      ? "var(--lr-dock-panel-collapsed-size, var(--_lr-dock-panel-collapsed-size))"
      : this.extent;
    if (this.axis === "inline") {
      this.style.inlineSize = value;
      this.style.blockSize = "";
      this.style.minBlockSize = "";
      this.style.maxBlockSize = "";
      this.style.minInlineSize = this.collapsed ? "" : `${bounds.minPx}px`;
      this.style.maxInlineSize = this.collapsed ? "" : `${bounds.maxPx}px`;
    } else {
      this.style.blockSize = value;
      this.style.inlineSize = "";
      this.style.minInlineSize = "";
      this.style.maxInlineSize = "";
      this.style.minBlockSize = this.collapsed ? "" : `${bounds.minPx}px`;
      this.style.maxBlockSize = this.collapsed ? "" : `${bounds.maxPx}px`;
    }
  }

  /** Live pixel size of the containing block along the resize axis, used both to resolve a `%`
   *  `min-extent`/`max-extent` and as the `max-extent` fallback when unset. Falls back to the viewport
   *  when there's no parent element (e.g. not yet connected). */
  private containerPx(): number {
    const parent = this.parentElement;
    const rect = parent?.getBoundingClientRect();
    const ownerWindow = this.ownerDocument.defaultView;
    if (this.axis === "inline")
      return rect?.width ?? ownerWindow?.innerWidth ?? 0;
    return rect?.height ?? ownerWindow?.innerHeight ?? 0;
  }

  private resolveBoundsPx(): { minPx: number; maxPx: number } {
    const containerPx = Math.max(0, this.containerPx());
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
    return this.axis === "inline" ? rect.width : rect.height;
  }

  private reconcileLiveExtent(): void {
    const bounds = this.resolveBoundsPx();
    this.applyHostSize(bounds);
    if (this.collapsed) return;

    const containerPx = this.containerPx();
    const authoredPx = resolveCssLength(this.extent, {
      host: this,
      percentBase: containerPx,
      viewportBasis: this.ownerDocument.defaultView ?? undefined,
    });
    const renderedPx = this.currentSizePx();
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
  }

  private commitSize(px: number): string | undefined {
    const bounds = this.resolveBoundsPx();
    const clamped = Math.min(Math.max(px, bounds.minPx), bounds.maxPx);
    const nextExtent = `${Math.round(clamped)}px`;
    const currentExtent = `${Math.round(this.currentSizePx())}px`;
    if (nextExtent === currentExtent) return undefined;
    this.extent = nextExtent;
    // Apply the new host size synchronously instead of waiting for Lit's
    // (microtask-batched) update cycle to reach willUpdate: currentSizePx()
    // measures the *live* box, so back-to-back steps (rapid keyboard repeat,
    // or another pointermove before a paint) must each see the size the
    // previous step just committed, not a stale pre-update box.
    this.applyHostSize(bounds);
    return nextExtent;
  }

  private emitResize(
    type: "lr-resize-input" | "lr-resize-change",
    extent: string
  ): void {
    this.emit(type, Object.freeze({ extent }));
  }

  private dragSnapshotIsCurrent(drag: DragState): boolean {
    return (
      this.resizable &&
      !this.collapsed &&
      this.edge === drag.edge &&
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
      !this.resizable ||
      this.collapsed ||
      this.drag
    ) {
      return;
    }
    const handle = e.currentTarget as HTMLElement;
    const ownerWindow = handle.ownerDocument.defaultView;
    if (!ownerWindow) return;
    const axis = this.axis;
    const growSign = this.growSign;
    this.drag = {
      pointerId: e.pointerId,
      startPos: axis === "inline" ? e.clientX : e.clientY,
      startSizePx: this.currentSizePx(),
      axis,
      growSign,
      edge: this.edge,
      minExtent: this.minExtent,
      maxExtent: this.maxExtent,
      containerPx: this.containerPx(),
      expectedExtent: this.extent,
      finalExtent: this.extent,
      acceptedResize: false,
    };
    this.dragOwnerWindow = ownerWindow;
    handle.setPointerCapture(e.pointerId);
    ownerWindow.addEventListener("pointermove", this.onPointerMove);
    ownerWindow.addEventListener("pointerup", this.onPointerUp);
    // A drag can end without a pointerup: a system gesture / palm rejection
    // can fire pointercancel, and losing capture (e.g. element removed) fires
    // lostpointercapture -- both need the same teardown as pointerup or the
    // handle keeps "resizing" in response to unrelated movement.
    ownerWindow.addEventListener("pointercancel", this.onPointerCancel);
    ownerWindow.addEventListener("lostpointercapture", this.onPointerCancel);
  };

  private onPointerMove = (e: PointerEvent): void => {
    const drag = this.drag;
    if (!drag || e.pointerId !== drag.pointerId) return;
    if (!this.dragSnapshotIsCurrent(drag)) {
      this.endDrag();
      return;
    }
    const pos = drag.axis === "inline" ? e.clientX : e.clientY;
    const delta = drag.growSign * (pos - drag.startPos);
    const extent = this.commitSize(drag.startSizePx + delta);
    if (extent === undefined) return;
    drag.expectedExtent = extent;
    drag.finalExtent = extent;
    drag.acceptedResize = true;
    this.emitResize("lr-resize-input", extent);
  };

  private onPointerUp = (e: PointerEvent): void => {
    const drag = this.drag;
    if (!drag || e.pointerId !== drag.pointerId) return;
    const shouldCommit =
      drag.acceptedResize && this.dragSnapshotIsCurrent(drag);
    const finalExtent = drag.finalExtent;
    this.endDrag();
    if (shouldCommit) this.emitResize("lr-resize-change", finalExtent);
  };

  private onPointerCancel = (e: PointerEvent): void => {
    if (!this.drag || e.pointerId !== this.drag.pointerId) return;
    this.endDrag();
  };

  private endDrag(): void {
    const ownerWindow = this.dragOwnerWindow;
    this.drag = null;
    this.dragOwnerWindow = undefined;
    ownerWindow?.removeEventListener("pointermove", this.onPointerMove);
    ownerWindow?.removeEventListener("pointerup", this.onPointerUp);
    ownerWindow?.removeEventListener("pointercancel", this.onPointerCancel);
    ownerWindow?.removeEventListener(
      "lostpointercapture",
      this.onPointerCancel
    );
  }

  private onHandleKeyDown = (e: KeyboardEvent): void => {
    if (!this.resizable || this.collapsed) return;
    // The physical "positive direction" key is always Right/Down; growSign
    // already encodes whether that direction grows or shrinks the panel for
    // the current edge + RTL-ness, exactly mirroring how onPointerMove folds
    // it into the drag delta above.
    const forwardKey = this.axis === "inline" ? "ArrowRight" : "ArrowDown";
    const backwardKey = this.axis === "inline" ? "ArrowLeft" : "ArrowUp";
    let extent: string | undefined;
    if (e.key === forwardKey) {
      e.preventDefault();
      extent = this.commitSize(
        this.currentSizePx() + this.growSign * KEYBOARD_STEP_PX
      );
    } else if (e.key === backwardKey) {
      e.preventDefault();
      extent = this.commitSize(
        this.currentSizePx() - this.growSign * KEYBOARD_STEP_PX
      );
    }
    if (extent === undefined) return;
    this.emitResize("lr-resize-input", extent);
    this.emitResize("lr-resize-change", extent);
  };

  private toggleCollapsed = (): void => {
    const next = !this.collapsed;
    const request = this.emit(
      "lr-collapse-request",
      Object.freeze({ collapsed: next }),
      { cancelable: true }
    );
    if (request.defaultPrevented) return;
    this.collapsed = next;
    this.emit("lr-collapse-change", Object.freeze({ collapsed: next }));
  };

  /** Rotation (deg) for the collapse-toggle's chevron: it points toward the
   *  panel's pinned edge when expanded (that's the direction clicking it
   *  will shrink toward) and away from it when collapsed (the direction
   *  clicking it will grow toward) -- mirrors lr-widget's collapse-button
   *  rotate-the-wrapping-part technique, generalized across four possible
   *  pinned edges and, for `start`/`end`, RTL. */
  private get toggleChevronDeg(): number {
    if (this.edge === "top") return this.collapsed ? 90 : -90;
    if (this.edge === "bottom") return this.collapsed ? -90 : 90;
    const pinnedPhysicalEnd = this.edge === "end" ? !isRtl(this) : isRtl(this);
    return this.collapsed !== pinnedPhysicalEnd ? 0 : 180;
  }

  private handleTemplate(): TemplateResult | typeof nothing {
    if (!this.resizable || this.collapsed) return nothing;
    const { minPx, maxPx } = this.resolveBoundsPx();
    const nowPx = Math.min(Math.max(this.currentSizePx(), minPx), maxPx);
    // hit-area-exempt: a drag-handle separator (role="separator",
    // mouse-drag/arrow-key resize), not a tap-to-activate icon button --
    // mirrors lr-multi-split's own [part="divider"] precedent exactly: the
    // visible bar stays a slim 3px while [part='handle']::before (see
    // dock-panel.styles.ts) widens the real pointer-capture hit-slop.
    return html`<div
      part="handle"
      role="separator"
      aria-label=${this.localize("dockPanelResize")}
      aria-orientation=${this.axis === "inline" ? "vertical" : "horizontal"}
      aria-valuenow=${Math.round(nowPx)}
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
      aria-expanded=${this.collapsed ? "false" : "true"}
      aria-controls=${this.contentId}
      aria-label=${this.collapsed
        ? this.localize("dockPanelExpand")
        : this.localize("dockPanelCollapse")}
      @click=${this.toggleCollapsed}
    >
      <span
        style=${`display:inline-flex;transform:rotate(${this.toggleChevronDeg}deg)`}
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
    "lr-dock-panel": LyraDockPanel;
  }
}
