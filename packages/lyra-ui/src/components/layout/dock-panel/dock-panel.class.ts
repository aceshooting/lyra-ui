import { html, nothing, type TemplateResult, type PropertyValues } from 'lit';
import { property } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { isRtl } from '../../../internal/rtl.js';
import { nextId } from '../../../internal/a11y.js';
import { chevronIcon } from '../../../internal/icons.js';
import { styles } from './dock-panel.styles.js';

/** Which edge of the panel's own container it's docked to. `'start'`/`'end'`
 *  are logical-inline (mirror left/right depending on writing direction);
 *  `'top'`/`'bottom'` are block-direction and unaffected by RTL. */
export type DockPanelEdge = 'start' | 'end' | 'top' | 'bottom';

export interface DockPanelResizeDetail {
  size: string;
}
export interface DockPanelCollapseChangeDetail {
  collapsed: boolean;
}

export interface LyraDockPanelEventMap {
  'lr-resize': CustomEvent<DockPanelResizeDetail>;
  'lr-collapse-change': CustomEvent<DockPanelCollapseChangeDetail>;
}

/** Arrow-key step, in px, per keydown on the resize handle. */
const KEYBOARD_STEP_PX = 16;

const LENGTH_RE = /^(-?[\d.]+)(px|rem|em|vw|vh|%)?$/;

/**
 * Resolves an arbitrary CSS length (`px`, `rem`, `em`, `vw`, `vh`, `%`, or a
 * bare/unitless number treated as `px`) to a live pixel value, without a DOM
 * probe measurement -- `min-size`/`max-size` are pure constraints that are
 * never themselves rendered anywhere, so there's nothing to measure; the
 * *current* `size` is instead always read back from the host's own
 * `getBoundingClientRect()` (see `currentSizePx()`), which handles any unit
 * for free since the browser already resolved it during layout. Returns
 * `undefined` for an empty/unparseable string.
 */
export function parseLengthPx(
  length: string,
  containerPx: number,
  fontSizeEl: Element = document.documentElement,
): number | undefined {
  const trimmed = length.trim();
  if (!trimmed) return undefined;
  const match = LENGTH_RE.exec(trimmed);
  if (!match) return undefined;
  const value = parseFloat(match[1]);
  switch (match[2]) {
    case '%':
      return (value / 100) * containerPx;
    case 'rem':
      return value * parseFloat(getComputedStyle(document.documentElement).fontSize);
    case 'em':
      return value * parseFloat(getComputedStyle(fontSizeEl).fontSize);
    case 'vw':
      return (value / 100) * window.innerWidth;
    case 'vh':
      return (value / 100) * window.innerHeight;
    default:
      return value;
  }
}

interface DragState {
  pointerId: number;
  startPos: number;
  startSizePx: number;
}

/**
 * `<lr-dock-panel>` — a single panel docked to one edge of whatever
 * contains it, resizable by dragging its inner edge. Unlike `<lr-split>`
 * (which owns and lays out N sibling panels, and requires restructuring a
 * layout so every panel becomes its direct child), this is one self-
 * contained element you drop next to your existing content -- typically as
 * an absolutely-positioned child of a `position: relative` parent, or as a
 * flex item alongside a main-content sibling. It deliberately imposes no
 * `position`/`inset` of its own (see the styles module): it only manages its
 * own size along the resize axis (`inline-size` for `start`/`end`,
 * `block-size` for `top`/`bottom`) and fills 100% of the cross axis, leaving
 * where it sits in the page entirely up to the consumer's own layout.
 *
 * `lr-split` stays the right primitive for the multi-sibling-panel case;
 * this is the primitive for the single-edge-docked case, kept as a separate
 * component rather than a second mode bolted onto `lr-split`'s API.
 *
 * Pointer-drag-resize mirrors `lr-split`'s pointer-capture technique
 * (pointerdown captures the pointer on the handle, pointermove computes a
 * new size, pointerup/pointercancel/lostpointercapture all release it) but
 * for a single draggable edge instead of N-1 dividers between N panels, and
 * reasons in raw pixels throughout rather than percent -- `size` is a CSS
 * length, and pointer movement is naturally pixels, so there's no percent
 * domain to convert through here. Every resize (drag step, drag release, or
 * keyboard step) always commits `size` as a `px` string regardless of what
 * unit `size`/`min-size`/`max-size` were originally expressed in -- a drag
 * inherently produces a pixel-precise result, so re-expressing it in the
 * caller's original unit (e.g. back into `rem`) would just be lossy
 * re-derivation for no benefit.
 *
 * Collapsing hides the slotted content but keeps the panel itself at a
 * small persistent "rail" width/height (`--lr-dock-panel-collapsed-size`,
 * default `var(--lr-icon-button-size)`) rather than collapsing to zero --
 * a zero-size collapsed panel would have nowhere left to host the toggle
 * button that re-expands it. `size` itself is left untouched while
 * collapsed, so re-expanding restores exactly what it was.
 *
 * @customElement lr-dock-panel
 * @slot - The panel's own content.
 * @event lr-resize - `detail: { size }` (a `px` CSS length string), fired on every drag step,
 *   drag release, and keyboard step.
 * @event lr-collapse-change - `detail: { collapsed }`, fired whenever the collapse toggle changes
 *   `collapsed`.
 * @csspart base - The panel root.
 * @csspart content - The wrapper around the default slot; hidden while `collapsed`.
 * @csspart handle - The draggable resize handle on the panel's inner edge. Only rendered when
 *   `resizable` and not `collapsed`.
 * @csspart collapse-toggle - The collapse/expand toggle button. Only rendered when `collapsible`.
 * @cssprop [--lr-dock-panel-collapsed-size=var(--lr-icon-button-size)] - The extent the panel
 *   keeps along its resize axis while `collapsed` -- enough to still host the toggle button that
 *   re-expands it.
 */
export class LyraDockPanel extends LyraElement<LyraDockPanelEventMap> {
  static styles = [LyraElement.styles, styles];

  @property({ reflect: true }) edge: DockPanelEdge = 'end';
  /** The current docked size along the resize axis, as a CSS length (e.g. `"320px"`). */
  @property() size = '280px';
  /** Minimum resize bound, as a CSS length. */
  @property({ attribute: 'min-size' }) minSize = '160px';
  /** Maximum resize bound, as a CSS length. Empty means "no explicit cap" -- the live extent of
   *  the containing element is used instead, so the panel still can't be dragged wider/taller than
   *  its container. */
  @property({ attribute: 'max-size' }) maxSize = '';
  @property({ type: Boolean, reflect: true }) collapsible = false;
  @property({ type: Boolean, reflect: true }) collapsed = false;
  /** When `false`, no drag handle renders at all and the panel is a fixed size. */
  @property({ type: Boolean, reflect: true }) resizable = true;

  private drag: DragState | null = null;
  private readonly contentId = nextId('dock-panel-content');
  // Keeps aria-valuemax/aria-valuenow (and the %/max-size fallback they're
  // derived from) live against a *passive* container resize -- window
  // resize, a sibling collapsing, a media query -- none of which touch any
  // reactive property here, so without this they'd otherwise only refresh
  // on the next unrelated Lit re-render. Mirrors lr-split's own
  // collapseResizeObserver technique, just observing the containing element
  // instead of the component's own base.
  private containerResizeObserver?: ResizeObserver;

  connectedCallback(): void {
    super.connectedCallback();
    this.applyHostSize();
    this.armContainerResizeObserver();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.drag = null;
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);
    window.removeEventListener('pointercancel', this.onPointerUp);
    window.removeEventListener('lostpointercapture', this.onPointerUp);
    this.containerResizeObserver?.disconnect();
  }

  /** Creates (idempotently) and (re-)observes the containing element with a
   *  `ResizeObserver` that just requests a re-render on every callback --
   *  `containerPx()`/`currentSizePx()` already read the live DOM on every
   *  render, so there's no separate cached value to update here, only the
   *  render that was otherwise never being triggered. A no-op when not yet
   *  connected (no `parentElement`). */
  private armContainerResizeObserver(): void {
    if (!this.parentElement) return;
    this.containerResizeObserver ??= new ResizeObserver(() => this.requestUpdate());
    this.containerResizeObserver.observe(this.parentElement);
  }

  // Applied in willUpdate (before render), not updated (after render): the
  // handle's aria-valuenow is computed during render from the host's own
  // live getBoundingClientRect(), so the new inline-size/block-size has to
  // already be on the host *before* render runs, or aria-valuenow would
  // read back the size from one update cycle ago.
  protected willUpdate(changed: PropertyValues): void {
    if (changed.has('size') || changed.has('collapsed') || changed.has('edge')) {
      this.applyHostSize();
    }
  }

  /** `'inline'` for the `start`/`end` edges (resizing changes `inline-size`), `'block'` for
   *  `top`/`bottom` (resizing changes `block-size`). */
  private get axis(): 'inline' | 'block' {
    return this.edge === 'start' || this.edge === 'end' ? 'inline' : 'block';
  }

  /** +1 or -1: which physical pointer-movement/keyboard direction *grows* the panel, folding in
   *  both which edge is pinned (the opposite edge is what's dragged) and, for the inline axis
   *  only, the current RTL-ness -- mirrors lr-split's own horizontal+RTL delta inversion, just
   *  generalized to four possible pinned edges instead of split's always-LTR-authored pair order. */
  private get growSign(): 1 | -1 {
    if (this.edge === 'top') return 1;
    if (this.edge === 'bottom') return -1;
    const rtl = isRtl(this);
    if (this.edge === 'start') return rtl ? -1 : 1;
    return rtl ? 1 : -1; // edge === 'end'
  }

  private applyHostSize(): void {
    const value = this.collapsed ? 'var(--lr-dock-panel-collapsed-size)' : this.size;
    if (this.axis === 'inline') {
      this.style.inlineSize = value;
      this.style.blockSize = '';
    } else {
      this.style.blockSize = value;
      this.style.inlineSize = '';
    }
  }

  /** Live pixel size of the containing block along the resize axis, used both to resolve a `%`
   *  `min-size`/`max-size` and as the `max-size` fallback when unset. Falls back to the viewport
   *  when there's no parent element (e.g. not yet connected). */
  private containerPx(): number {
    const parent = this.parentElement;
    const rect = parent?.getBoundingClientRect();
    if (this.axis === 'inline') return rect?.width ?? window.innerWidth;
    return rect?.height ?? window.innerHeight;
  }

  private resolveBoundsPx(): { minPx: number; maxPx: number } {
    const containerPx = this.containerPx();
    const minPx = Math.max(0, parseLengthPx(this.minSize, containerPx, this) ?? 0);
    const maxPx = Math.max(minPx, parseLengthPx(this.maxSize, containerPx, this) ?? containerPx);
    return { minPx, maxPx };
  }

  /** The panel's own current rendered size (px) along the resize axis, read straight off the
   *  live box -- this is what lets `size` be expressed in any CSS unit and still drag/step
   *  correctly from wherever it actually rendered, with no separate unit-conversion path for the
   *  "current" value (only `min-size`/`max-size`, which are never themselves rendered, need
   *  `parseLengthPx`). */
  private currentSizePx(): number {
    const rect = this.getBoundingClientRect();
    return this.axis === 'inline' ? rect.width : rect.height;
  }

  private applySize(px: number): void {
    const { minPx, maxPx } = this.resolveBoundsPx();
    const clamped = Math.min(Math.max(px, minPx), maxPx);
    this.size = `${Math.round(clamped)}px`;
    // Apply the new host size synchronously instead of waiting for Lit's
    // (microtask-batched) update cycle to reach willUpdate: currentSizePx()
    // measures the *live* box, so back-to-back steps (rapid keyboard repeat,
    // or another pointermove before a paint) must each see the size the
    // previous step just committed, not a stale pre-update box.
    this.applyHostSize();
    this.emit<DockPanelResizeDetail>('lr-resize', { size: this.size });
  }

  private onPointerDown = (e: PointerEvent): void => {
    if (!this.resizable || this.collapsed || this.drag) return;
    this.drag = {
      pointerId: e.pointerId,
      startPos: this.axis === 'inline' ? e.clientX : e.clientY,
      startSizePx: this.currentSizePx(),
    };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
    // A drag can end without a pointerup: a system gesture / palm rejection
    // can fire pointercancel, and losing capture (e.g. element removed) fires
    // lostpointercapture -- both need the same teardown as pointerup or the
    // handle keeps "resizing" in response to unrelated movement.
    window.addEventListener('pointercancel', this.onPointerUp);
    window.addEventListener('lostpointercapture', this.onPointerUp);
  };

  private onPointerMove = (e: PointerEvent): void => {
    const drag = this.drag;
    if (!drag || e.pointerId !== drag.pointerId) return;
    const pos = this.axis === 'inline' ? e.clientX : e.clientY;
    const delta = this.growSign * (pos - drag.startPos);
    this.applySize(drag.startSizePx + delta);
  };

  private onPointerUp = (e: PointerEvent): void => {
    if (!this.drag || e.pointerId !== this.drag.pointerId) return;
    this.drag = null;
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);
    window.removeEventListener('pointercancel', this.onPointerUp);
    window.removeEventListener('lostpointercapture', this.onPointerUp);
  };

  private onHandleKeyDown = (e: KeyboardEvent): void => {
    if (!this.resizable || this.collapsed) return;
    // The physical "positive direction" key is always Right/Down; growSign
    // already encodes whether that direction grows or shrinks the panel for
    // the current edge + RTL-ness, exactly mirroring how onPointerMove folds
    // it into the drag delta above.
    const forwardKey = this.axis === 'inline' ? 'ArrowRight' : 'ArrowDown';
    const backwardKey = this.axis === 'inline' ? 'ArrowLeft' : 'ArrowUp';
    if (e.key === forwardKey) {
      e.preventDefault();
      this.applySize(this.currentSizePx() + this.growSign * KEYBOARD_STEP_PX);
    } else if (e.key === backwardKey) {
      e.preventDefault();
      this.applySize(this.currentSizePx() - this.growSign * KEYBOARD_STEP_PX);
    }
  };

  private toggleCollapsed = (): void => {
    this.collapsed = !this.collapsed;
    this.emit<DockPanelCollapseChangeDetail>('lr-collapse-change', { collapsed: this.collapsed });
  };

  /** Rotation (deg) for the collapse-toggle's chevron: it points toward the
   *  panel's pinned edge when expanded (that's the direction clicking it
   *  will shrink toward) and away from it when collapsed (the direction
   *  clicking it will grow toward) -- mirrors lr-widget's collapse-button
   *  rotate-the-wrapping-part technique, generalized across four possible
   *  pinned edges and, for `start`/`end`, RTL. */
  private get toggleChevronDeg(): number {
    if (this.edge === 'top') return this.collapsed ? 90 : -90;
    if (this.edge === 'bottom') return this.collapsed ? -90 : 90;
    const pinnedPhysicalEnd = this.edge === 'end' ? !isRtl(this) : isRtl(this);
    return this.collapsed !== pinnedPhysicalEnd ? 0 : 180;
  }

  private handleTemplate(): TemplateResult | typeof nothing {
    if (!this.resizable || this.collapsed) return nothing;
    const { minPx, maxPx } = this.resolveBoundsPx();
    // hit-area-exempt: a drag-handle separator (role="separator",
    // mouse-drag/arrow-key resize), not a tap-to-activate icon button --
    // mirrors lr-split's own [part="divider"] precedent exactly: the
    // visible bar stays a slim 3px while [part='handle']::before (see
    // dock-panel.styles.ts) widens the real pointer-capture hit-slop.
    return html`<div
      part="handle"
      role="separator"
      aria-label=${this.localize('dockPanelResize')}
      aria-orientation=${this.axis === 'inline' ? 'vertical' : 'horizontal'}
      aria-valuenow=${Math.round(this.currentSizePx())}
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
      aria-label=${this.collapsed ? this.localize('dockPanelExpand') : this.localize('dockPanelCollapse')}
      @click=${this.toggleCollapsed}
    >
      <span style=${`display:inline-flex;transform:rotate(${this.toggleChevronDeg}deg)`}
        >${chevronIcon()}</span
      >
    </button>`;
  }

  render(): TemplateResult {
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

