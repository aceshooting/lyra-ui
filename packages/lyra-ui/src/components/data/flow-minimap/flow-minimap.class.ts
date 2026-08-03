import { html, svg, nothing, type TemplateResult, type SVGTemplateResult, type PropertyValues } from 'lit';
import { property, state } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { tag } from '../../../internal/prefix.js';
import { nextId, srOnly } from '../../../internal/a11y.js';
import { getNumberFormat } from '../../../internal/intl-cache.js';
import {
  acquireAnnouncementSink,
  type AnnouncementSink,
} from '../../../internal/announcer.js';
import type { FlowStructureSnapshot } from '../flow-canvas/flow-canvas.class.js';
import { styles } from './flow-minimap.styles.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_collapse, LYRA_DEFAULT_details, LYRA_DEFAULT_flowMinimapInstructions, LYRA_DEFAULT_flowMinimapLabel, LYRA_DEFAULT_flowMinimapViewport, LYRA_DEFAULT_flowMinimapViewportChanged, LYRA_DEFAULT_open } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END


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
 * the two can never disagree. The initial companion snapshot is silent; interaction-requested
 * viewport changes append to the document's shared light-DOM polite sink, including identical
 * repeats, while `[part="live-region"]` remains an aria-hidden mirror.
 *
 * @customElement lr-flow-minimap
 * @csspart base - The root wrapper.
 * @csspart map - The scaled SVG.
 * @csspart node - One rect per node.
 * @csspart viewport - The draggable, focusable view rectangle.
 * @csspart instructions - Visually hidden keyboard instructions for the viewport.
 * @csspart live-region - An aria-hidden shadow mirror of viewport-change announcements; the actual
 *   announcements use the shared light-DOM polite sink.
 * @cssprop [--lr-flow-minimap-inline-size=var(--lr-size-12rem)] - Map inline size.
 * @cssprop [--lr-flow-minimap-block-size=var(--lr-size-8rem)] - Map block size.
 * @cssprop [--lr-flow-minimap-node-color=var(--lr-color-border-strong)] - Fill of nodes without
 *   an execution status.
 * @cssprop [--lr-flow-minimap-node-pending-color=var(--lr-color-border-strong)] - Pending-node fill.
 * @cssprop [--lr-flow-minimap-node-running-color=var(--lr-color-brand)] - Running-node fill.
 * @cssprop [--lr-flow-minimap-node-success-color=var(--lr-color-success)] - Successful-node fill.
 * @cssprop [--lr-flow-minimap-node-error-color=var(--lr-color-danger)] - Failed-node fill.
 * @cssprop [--lr-flow-minimap-node-denied-color=var(--lr-color-warning)] - Denied-node fill.
 * @status stable
 * @since 4.0.0
 */
export class LyraFlowMinimap extends LyraElement {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    collapse: LYRA_DEFAULT_collapse,
    details: LYRA_DEFAULT_details,
    flowMinimapInstructions: LYRA_DEFAULT_flowMinimapInstructions,
    flowMinimapLabel: LYRA_DEFAULT_flowMinimapLabel,
    flowMinimapViewport: LYRA_DEFAULT_flowMinimapViewport,
    flowMinimapViewportChanged: LYRA_DEFAULT_flowMinimapViewportChanged,
    open: LYRA_DEFAULT_open,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static override styles = [LyraElement.styles, styles, srOnly];

  /** Id of the target `lr-flow-canvas`. When empty, the nearest ancestor is used (the
   *  slotted-into-a-corner-slot case, the primary wiring). */
  @property() for = '';
  /** Accessible name for the map region; falls back to a host `aria-label`, then `flowMinimapLabel`. */
  @property() label = '';

  @state() private snapshot: FlowStructureSnapshot | null = null;
  @state() private liveText = '';
  private announcementSink?: AnnouncementSink;
  private canvasEl?: FlowCanvasLike;
  private unsubscribe?: () => void;
  private dragState?: { pointerId: number; startClientX: number; startClientY: number; startViewport: { x: number; y: number; zoom: number } };
  /** Window that owns the active viewport drag's global pointer listeners. */
  private dragEventWindow?: Window;
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
    this.syncAnnouncementSink();
    this.watchForCanvas();
    this.resolveAndAttach();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.releaseAnnouncementSink();
    this.announceNextSnapshot = false;
    this.liveText = '';
    this.unsubscribe?.();
    this.unsubscribe = undefined;
    this.canvasEl = undefined;
    this.canvasWatcher?.disconnect();
    this.canvasWatcher = undefined;
    // If the element is removed mid-drag, nothing else ever detaches the owner-window drag
    // listeners, so they are removed unconditionally here.
    this.dragState = undefined;
    this.detachViewportDragListeners();
  }

  private releaseAnnouncementSink(): void {
    this.announcementSink?.release();
    this.announcementSink = undefined;
  }

  private syncAnnouncementSink(): void {
    if (!this.isConnected) {
      this.releaseAnnouncementSink();
      return;
    }
    if (this.announcementSink?.element.ownerDocument === this.ownerDocument) return;
    this.releaseAnnouncementSink();
    this.announcementSink = acquireAnnouncementSink('polite', {
      document: this.ownerDocument,
      source: this,
    });
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
        const text = this.localize('flowMinimapViewportChanged', undefined, {
          x: number.format(snapshot.viewport.x),
          y: number.format(snapshot.viewport.y),
          zoom: percent.format(snapshot.viewport.zoom),
        });
        this.liveText = text;
        this.announcementSink?.announce(text);
      }
    });
  }

  private watchForCanvas(): void {
    if (this.canvasWatcher) return;
    const root = this.getRootNode() as Document | ShadowRoot;
    const owner = this.ownerDocument.defaultView;
    const MutationObserverCtor = owner?.MutationObserver;
    if (!MutationObserverCtor) return;
    let observer: MutationObserver | undefined;
    observer = new MutationObserverCtor(() => {
      if (
        !this.isConnected ||
        this.ownerDocument.defaultView !== owner ||
        this.canvasWatcher !== observer
      ) {
        return;
      }
      this.resolveAndAttach();
    });
    this.canvasWatcher = observer;
    observer.observe(root, { childList: true, subtree: true });
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
    const dragEventWindow = this.ownerDocument.defaultView;
    if (!this.canvasEl || !this.snapshot || !dragEventWindow) return;
    e.stopPropagation();
    this.detachViewportDragListeners();
    this.dragState = { pointerId: e.pointerId, startClientX: e.clientX, startClientY: e.clientY, startViewport: { ...this.snapshot.viewport } };
    (e.target as SVGElement).setPointerCapture?.(e.pointerId);
    this.dragEventWindow = dragEventWindow;
    dragEventWindow.addEventListener('pointermove', this.onViewportPointerMove);
    dragEventWindow.addEventListener('pointerup', this.onViewportPointerUp);
    // A touch scroll takeover can fire `pointercancel` (never `pointerup`), and losing capture
    // (e.g. element removed) fires `lostpointercapture` -- both need the same teardown as
    // pointerup or the drag listeners outlive the gesture.
    dragEventWindow.addEventListener('pointercancel', this.onViewportPointerUp);
    dragEventWindow.addEventListener('lostpointercapture', this.onViewportPointerUp);
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
    this.detachViewportDragListeners();
  };

  private detachViewportDragListeners(): void {
    const dragEventWindow = this.dragEventWindow;
    if (!dragEventWindow) return;
    dragEventWindow.removeEventListener('pointermove', this.onViewportPointerMove);
    dragEventWindow.removeEventListener('pointerup', this.onViewportPointerUp);
    dragEventWindow.removeEventListener('pointercancel', this.onViewportPointerUp);
    dragEventWindow.removeEventListener('lostpointercapture', this.onViewportPointerUp);
    this.dragEventWindow = undefined;
  }

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
      <div part="live-region" class="sr-only" aria-hidden="true">
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
