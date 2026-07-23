import { html, svg, nothing, type TemplateResult, type SVGTemplateResult, type PropertyValues } from 'lit';
import { property, state } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { tag } from '../../../internal/prefix.js';
import { nextId, srOnly } from '../../../internal/a11y.js';
import { getNumberFormat } from '../../../internal/intl-cache.js';
import type { FlowStructureSnapshot } from '../flow-canvas/flow-canvas.class.js';
import { styles } from './flow-minimap.styles.js';

/** The subset of `LyraFlowCanvas`'s public surface this companion drives — a structural type so
 *  this module never imports `LyraFlowCanvas` as a value (only its types, elsewhere), keeping
 *  registration order between the two components irrelevant. */
interface FlowCanvasLike extends HTMLElement {
  registerCompanion(cb: (snapshot: FlowStructureSnapshot) => void): () => void;
  setViewport(viewport: { x: number; y: number; zoom: number }): void;
  zoomIn(): void;
  zoomOut(): void;
  fit(options?: { padding?: number }): void;
}

/**
 * `<lr-flow-minimap>` — a corner overview map of a `lr-flow-canvas`: scaled node rectangles plus
 * a draggable viewport rectangle, for orientation and fast navigation on canvases larger than the
 * screen. Draws no edges (nodes only, matching the React Flow/n8n minimap convention) and never
 * reads `nodes` itself — geometry always comes from the canvas's `registerCompanion()` snapshots, so
 * the two can never disagree.
 *
 * @customElement lr-flow-minimap
 * @csspart base - The root wrapper.
 * @csspart map - The scaled SVG.
 * @csspart node - One rect per node.
 * @csspart viewport - The draggable, focusable view rectangle.
 * @csspart instructions - Visually hidden keyboard instructions for the viewport.
 * @csspart live-region - Visually hidden viewport-change announcements.
 * @cssprop [--lr-flow-minimap-inline-size=var(--lr-size-12rem)] - Map inline size.
 * @cssprop [--lr-flow-minimap-block-size=var(--lr-size-8rem)] - Map block size.
 */
export class LyraFlowMinimap extends LyraElement {
  static override styles = [LyraElement.styles, styles, srOnly];

  /** Id of the target `lr-flow-canvas`. When empty, the nearest ancestor is used (the
   *  slotted-into-a-corner-slot case, the primary wiring). */
  @property() for = '';
  /** Accessible name for the map region; falls back to a host `aria-label`, then `flowMinimapLabel`. */
  @property() label = '';

  @state() private snapshot: FlowStructureSnapshot | null = null;
  @state() private liveText = '';
  private canvasEl?: FlowCanvasLike;
  private unsubscribe?: () => void;
  private dragState?: { pointerId: number; startClientX: number; startClientY: number; startViewport: { x: number; y: number; zoom: number } };
  /** Set once an in-progress viewport drag actually moves. A completed pointer drag makes the
   *  browser synthesize a `click` on the captured element afterward, which bubbles up into the
   *  map's own `@click` (click-to-center) handler -- without this, releasing the viewport rect
   *  after dragging it re-centers the map on the release point, undoing the drag. Consumed (reset
   *  to `false`) the next time `onMapClick` runs, so a genuine click on the map still centers it. */
  private justDraggedViewport = false;
  private announceNextSnapshot = false;
  private readonly instructionsId = nextId('flow-minimap-instructions');
  /** Watches target lifecycle so late, removed, and same-id replacement canvases are reconciled. */
  private canvasWatcher?: MutationObserver;

  override connectedCallback(): void {
    super.connectedCallback();
    this.watchForCanvas();
    this.resolveAndAttach();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.unsubscribe?.();
    this.unsubscribe = undefined;
    this.canvasEl = undefined;
    this.canvasWatcher?.disconnect();
    this.canvasWatcher = undefined;
    // If the element is removed mid-drag, nothing else ever detaches the window-level drag
    // listeners, so they are removed unconditionally here.
    this.dragState = undefined;
    window.removeEventListener('pointermove', this.onViewportPointerMove);
    window.removeEventListener('pointerup', this.onViewportPointerUp);
    window.removeEventListener('pointercancel', this.onViewportPointerUp);
    window.removeEventListener('lostpointercapture', this.onViewportPointerUp);
  }

  // Guarded by `hasUpdated` -- `connectedCallback()` already ran the initial `resolveAndAttach()`
  // before the first render, so only a genuine runtime `for` change (never the first update, where
  // `for` always appears in `changed` alongside every other reactive property) should redo it.
  // Runs from `willUpdate()`, not `updated()`, so `snapshot`'s reset lands in the render this same
  // cycle produces instead of synchronously scheduling a second cycle from within `updated()`.
  protected override willUpdate(changed: PropertyValues): void {
    if (this.hasUpdated && changed.has('for')) {
      this.resolveAndAttach();
    }
  }

  private resolveCanvas(): FlowCanvasLike | null {
    if (this.for) {
      const root = this.getRootNode() as Document | ShadowRoot;
      const byId = root.getElementById?.(this.for);
      if (byId && byId.tagName.toLowerCase() === tag('flow-canvas')) return byId as unknown as FlowCanvasLike;
    }
    const ancestor = this.closest(tag('flow-canvas'));
    return (ancestor as unknown as FlowCanvasLike) ?? null;
  }

  private resolveAndAttach(): void {
    const canvas = this.resolveCanvas() ?? undefined;
    if (canvas === this.canvasEl) return;
    this.unsubscribe?.();
    this.unsubscribe = undefined;
    this.snapshot = null;
    this.canvasEl = canvas;
    if (!canvas) return;
    this.unsubscribe = canvas.registerCompanion((snapshot) => {
      this.snapshot = snapshot;
      if (this.announceNextSnapshot) {
        this.announceNextSnapshot = false;
        const number = getNumberFormat(this.effectiveLocale, { maximumFractionDigits: 0 });
        const percent = getNumberFormat(this.effectiveLocale, {
          style: 'percent',
          maximumFractionDigits: 1,
        });
        this.liveText = this.localize('flowMinimapViewportChanged', undefined, {
          x: number.format(snapshot.viewport.x),
          y: number.format(snapshot.viewport.y),
          zoom: percent.format(snapshot.viewport.zoom),
        });
      }
    });
  }

  private watchForCanvas(): void {
    if (this.canvasWatcher) return;
    const root = this.getRootNode() as Document | ShadowRoot;
    this.canvasWatcher = new MutationObserver(() => this.resolveAndAttach());
    this.canvasWatcher.observe(root, { childList: true, subtree: true });
  }

  private contentBounds(): { minX: number; minY: number; maxX: number; maxY: number } {
    const nodes = this.snapshot?.nodes ?? [];
    if (nodes.length === 0) return { minX: 0, minY: 0, maxX: 1, maxY: 1 };
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const n of nodes) {
      minX = Math.min(minX, n.x);
      minY = Math.min(minY, n.y);
      maxX = Math.max(maxX, n.x + n.width);
      maxY = Math.max(maxY, n.y + n.height);
    }
    return { minX, minY, maxX, maxY };
  }

  private viewportRectContent(): { x: number; y: number; width: number; height: number } {
    const vp = this.snapshot?.viewport;
    if (!vp || vp.zoom === 0) return { x: 0, y: 0, width: 0, height: 0 };
    return { x: -vp.x / vp.zoom, y: -vp.y / vp.zoom, width: vp.width / vp.zoom, height: vp.height / vp.zoom };
  }

  private clientToContentPoint(svgEl: SVGSVGElement, clientX: number, clientY: number): { x: number; y: number } {
    const ctm = svgEl.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const pt = svgEl.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const transformed = pt.matrixTransform(ctm.inverse());
    return { x: transformed.x, y: transformed.y };
  }

  private onMapClick = (e: MouseEvent): void => {
    if (this.justDraggedViewport) {
      this.justDraggedViewport = false;
      return;
    }
    if (!this.canvasEl || !this.snapshot) return;
    const point = this.clientToContentPoint(e.currentTarget as SVGSVGElement, e.clientX, e.clientY);
    const { zoom, width, height } = this.snapshot.viewport;
    this.canvasEl.setViewport({ x: width / 2 - point.x * zoom, y: height / 2 - point.y * zoom, zoom });
  };

  private onMapWheel = (e: WheelEvent): void => {
    if (!this.canvasEl) return;
    e.preventDefault();
    if (e.deltaY < 0) this.canvasEl.zoomIn();
    else this.canvasEl.zoomOut();
  };

  private onViewportPointerDown = (e: PointerEvent): void => {
    if (!this.canvasEl || !this.snapshot) return;
    e.stopPropagation();
    this.dragState = { pointerId: e.pointerId, startClientX: e.clientX, startClientY: e.clientY, startViewport: { ...this.snapshot.viewport } };
    (e.target as SVGElement).setPointerCapture?.(e.pointerId);
    window.addEventListener('pointermove', this.onViewportPointerMove);
    window.addEventListener('pointerup', this.onViewportPointerUp);
    // A touch scroll takeover can fire `pointercancel` (never `pointerup`), and losing capture
    // (e.g. element removed) fires `lostpointercapture` -- both need the same teardown as
    // pointerup or the drag listeners outlive the gesture.
    window.addEventListener('pointercancel', this.onViewportPointerUp);
    window.addEventListener('lostpointercapture', this.onViewportPointerUp);
  };

  private onViewportPointerMove = (e: PointerEvent): void => {
    const drag = this.dragState;
    if (!drag || e.pointerId !== drag.pointerId || !this.canvasEl) return;
    this.justDraggedViewport = true;
    const svgEl = this.renderRoot.querySelector('[part="map"]') as SVGSVGElement | null;
    const ctm = svgEl?.getScreenCTM();
    if (!ctm) return;
    const scale = ctm.a || 1; // uniform scale (no skew with preserveAspectRatio="xMidYMid meet")
    const dxContent = (e.clientX - drag.startClientX) / scale;
    const dyContent = (e.clientY - drag.startClientY) / scale;
    this.canvasEl.setViewport({
      x: drag.startViewport.x - dxContent * drag.startViewport.zoom,
      y: drag.startViewport.y - dyContent * drag.startViewport.zoom,
      zoom: drag.startViewport.zoom,
    });
  };

  private onViewportPointerUp = (e: PointerEvent): void => {
    if (!this.dragState || e.pointerId !== this.dragState.pointerId) return;
    this.dragState = undefined;
    window.removeEventListener('pointermove', this.onViewportPointerMove);
    window.removeEventListener('pointerup', this.onViewportPointerUp);
    window.removeEventListener('pointercancel', this.onViewportPointerUp);
    window.removeEventListener('lostpointercapture', this.onViewportPointerUp);
  };

  private onViewportKeyDown = (e: KeyboardEvent): void => {
    if (!this.canvasEl || !this.snapshot) return;
    if (e.key === '+' || e.key === '=') {
      e.preventDefault();
      this.announceNextSnapshot = true;
      this.canvasEl.zoomIn();
      return;
    }
    if (e.key === '-' || e.key === '_') {
      e.preventDefault();
      this.announceNextSnapshot = true;
      this.canvasEl.zoomOut();
      return;
    }
    if (e.key === 'Enter' || e.key === 'Home') {
      e.preventDefault();
      this.announceNextSnapshot = true;
      this.canvasEl.fit();
      return;
    }
    const { x, y, zoom, width, height } = this.snapshot.viewport;
    const stepX = width * 0.1;
    const stepY = height * 0.1;
    // policy-allow(rtl-arrow-keys): pans a 2-D spatial viewport in canvas coordinates; x always
    // increases toward the physical right regardless of text direction, so the arrows stay physical.
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      this.announceNextSnapshot = true;
      this.canvasEl.setViewport({ x: x - stepX, y, zoom });
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      this.announceNextSnapshot = true;
      this.canvasEl.setViewport({ x: x + stepX, y, zoom });
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      this.announceNextSnapshot = true;
      this.canvasEl.setViewport({ x, y: y - stepY, zoom });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      this.announceNextSnapshot = true;
      this.canvasEl.setViewport({ x, y: y + stepY, zoom });
    }
  };

  private renderNodes(): SVGTemplateResult {
    return svg`${(this.snapshot?.nodes ?? []).map(
      (n) => svg`<rect part="node" data-status=${n.status ?? nothing} x=${n.x} y=${n.y} width=${n.width} height=${n.height} rx="2"></rect>`,
    )}`;
  }

  override render(): TemplateResult {
    const label = this.getAttribute('aria-label') || this.label || this.localize('flowMinimapLabel');
    if (!this.canvasEl || !this.snapshot) {
      return html`<div part="base" aria-hidden="true"></div>`;
    }
    const bounds = this.contentBounds();
    const padding = 20;
    const vbX = bounds.minX - padding;
    const vbY = bounds.minY - padding;
    const vbW = Math.max(1, bounds.maxX - bounds.minX + padding * 2);
    const vbH = Math.max(1, bounds.maxY - bounds.minY + padding * 2);
    const viewportRect = this.viewportRectContent();
    return html`<div part="base" role="region" aria-label=${label}>
      <svg
        part="map"
        viewBox="${vbX} ${vbY} ${vbW} ${vbH}"
        preserveAspectRatio="xMidYMid meet"
        @click=${this.onMapClick}
        @wheel=${this.onMapWheel}
      >
        ${this.renderNodes()}
        <rect
          part="viewport"
          role="group"
          tabindex="0"
          aria-label=${this.localize('flowMinimapViewport')}
          aria-describedby=${this.instructionsId}
          aria-keyshortcuts="+ - Enter Home ArrowUp ArrowDown ArrowLeft ArrowRight"
          x=${viewportRect.x}
          y=${viewportRect.y}
          width=${viewportRect.width}
          height=${viewportRect.height}
          @pointerdown=${this.onViewportPointerDown}
          @keydown=${this.onViewportKeyDown}
        ></rect>
      </svg>
      <div part="instructions" class="sr-only" id=${this.instructionsId}>
        ${this.localize('flowMinimapInstructions')}
      </div>
      <div part="live-region" class="sr-only" role="status" aria-live="polite" aria-atomic="true">
        ${this.liveText}
      </div>
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-flow-minimap': LyraFlowMinimap;
  }
}
