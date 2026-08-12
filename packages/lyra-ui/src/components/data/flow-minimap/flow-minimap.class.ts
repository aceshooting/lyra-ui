import { html, svg, nothing, type TemplateResult, type SVGTemplateResult, type PropertyValues } from 'lit';
import { property, state } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { tag } from '../../../internal/prefix.js';
import { nextId, srOnly } from '../../../internal/a11y.js';
import { resolveCssLength } from '../../../internal/css-length.js';
import { getNumberFormat } from '../../../internal/intl-cache.js';
import {
  acquireAnnouncementSink,
  type AnnouncementSink,
} from '../../../internal/announcer.js';
import type { FlowStructureSnapshot } from '../flow-canvas/flow-canvas.class.js';
import { styles } from './flow-minimap.styles.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_flowMinimapInstructions, LYRA_DEFAULT_flowMinimapLabel, LYRA_DEFAULT_flowMinimapViewport, LYRA_DEFAULT_flowMinimapViewportChanged } from '../../../internal/default-strings.generated.js';
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
  /** When `true`, this companion must not call `setViewport()`/`zoomIn()`/`zoomOut()`/`fit()` --
   *  mirrors every gesture handler `LyraFlowCanvas` itself gates on its own `locked` property, so
   *  a locked canvas stays locked even against a `FlowCanvasLike` implementation that (unlike
   *  `LyraFlowCanvas`) does not also guard those methods internally. */
  readonly locked: boolean;
}

/** Fallback for `--lr-flow-minimap-viewport-min-size` when the token resolves to nothing usable:
 *  WCAG 2.2 SC 2.5.8's 24px minimum target size, in CSS px. */
const DEFAULT_VIEWPORT_MIN_SIZE_PX = 24;

/**
 * `<lr-flow-minimap>` — a corner overview map of a `lr-flow-canvas`: scaled node rectangles plus
 * a draggable viewport rectangle, for orientation and fast navigation on canvases larger than the
 * screen. Draws no edges (nodes only, matching the React Flow/n8n minimap convention) and never
 * reads `nodes` itself — geometry always comes from the canvas's `registerCompanion()` snapshots, so
 * the two can never disagree. The initial companion snapshot is silent; keyboard, map-click, and
 * wheel viewport changes append their next rAF-coalesced snapshot to the document's shared
 * light-DOM polite sink, while a completed viewport drag appends its final position once.
 * Identical repeats remain distinct additions and `[part="live-region"]` stays an aria-hidden
 * mirror. A completed viewport drag consumes the browser-synthesized click that follows its
 * `pointerup`; canceled or lost-capture drags stay silent and leave the next genuine map click
 * available for click-to-center navigation.
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
 * @cssprop [--lr-flow-minimap-viewport-min-size=var(--lr-size-1-5rem)] - Smallest rendered size,
 *   in physical pixels, of the draggable `viewport` rectangle along either axis. On a canvas whose
 *   node bounds dwarf the visible viewport the raw rectangle collapses to a few pixels, which
 *   leaves the only pointer-drag handle for panning effectively unclickable; the floor grows it
 *   symmetrically about its own centre so it still points at what the viewport shows. Defaults to
 *   WCAG 2.2 SC 2.5.8's 24px minimum target size. Set `0` to opt out and render the exact
 *   viewport-to-content ratio instead.
 * @status stable
 * @since 4.0.0
 */
export class LyraFlowMinimap extends LyraElement {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    flowMinimapInstructions: LYRA_DEFAULT_flowMinimapInstructions,
    flowMinimapLabel: LYRA_DEFAULT_flowMinimapLabel,
    flowMinimapViewport: LYRA_DEFAULT_flowMinimapViewport,
    flowMinimapViewportChanged: LYRA_DEFAULT_flowMinimapViewportChanged,
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
  private dragState?: {
    pointerId: number;
    startClientX: number;
    startClientY: number;
    startViewport: { x: number; y: number; zoom: number };
    latestViewport?: { x: number; y: number; zoom: number };
    moved: boolean;
  };
  /** Window that owns the active viewport drag's global pointer listeners. */
  private dragEventWindow?: Window;
  /** Set once an in-progress viewport drag actually moves. A completed pointer drag makes the
   *  browser synthesize a `click` on the captured element afterward, which bubbles up into the
   *  map's own `@click` (click-to-center) handler -- without this, releasing the viewport rect
   *  after dragging it re-centers the map on the release point, undoing the drag. Consumed (reset
   *  to `false`) the next time `onMapClick` runs, so a genuine click on the map still centers it. */
  private justDraggedViewport = false;
  private announceNextSnapshot = false;
  /** Physical-pixel floor for the draggable viewport rect, resolved from the live
   *  `--lr-flow-minimap-viewport-min-size` token. */
  private viewportMinSizePx = DEFAULT_VIEWPORT_MIN_SIZE_PX;
  /** `[part='base']`'s resolved border width, which is what separates the host's own content box
   *  from the SVG's rendered box. */
  private baseBorderPx = 0;
  private readonly instructionsId = nextId('flow-minimap-instructions');
  /** Watches target lifecycle so late, removed, and same-id replacement canvases are reconciled. */
  private canvasWatcher?: MutationObserver;

  override connectedCallback(): void {
    super.connectedCallback();
    this.syncAnnouncementSink();
    this.watchForCanvas();
    this.resolveAndAttach();
  }

  /** Re-reads the live token values the viewport-rect floor depends on. */
  private refreshViewportMetrics(): void {
    // Optional-chained: this runs from willUpdate(), which @lit-labs/ssr invokes during server
    // render, where the element shim has no `ownerDocument` at all -- a bare property access
    // throws before the guard below can reject it. There is no layout to measure server-side
    // anyway; the first client update re-runs this with a real view.
    const view = this.ownerDocument?.defaultView;
    if (!view || !this.isConnected) return;
    const computed = view.getComputedStyle(this);
    // The token is deliberately NOT declared on :host -- a :host declaration would shadow a value
    // a consumer set on any ancestor, which is the natural place to theme a whole canvas. So its
    // default is read from the shared size token instead, exactly as the documented
    // `var(--lr-size-1-5rem)` default says, and the numeric constant below only guards an
    // environment where neither resolves at all.
    const minSize = resolveCssLength(
      computed.getPropertyValue('--lr-flow-minimap-viewport-min-size').trim() ||
        computed.getPropertyValue('--lr-size-1-5rem').trim(),
      this,
    );
    this.viewportMinSizePx =
      minSize !== undefined && Number.isFinite(minSize) && minSize >= 0
        ? minSize
        : DEFAULT_VIEWPORT_MIN_SIZE_PX;
    const border = resolveCssLength(
      computed.getPropertyValue('--lr-border-width-thin').trim(),
      this,
    );
    this.baseBorderPx =
      border !== undefined && Number.isFinite(border) && border >= 0 ? border : 0;
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
    this.justDraggedViewport = false;
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

  private announceViewport(
    viewport: Pick<FlowStructureSnapshot['viewport'], 'x' | 'y' | 'zoom'>,
  ): void {
    const number = getNumberFormat(this.effectiveLocale, { maximumFractionDigits: 0 });
    const percent = getNumberFormat(this.effectiveLocale, {
      style: 'percent',
      maximumFractionDigits: 1,
    });
    const text = this.localize('flowMinimapViewportChanged', undefined, {
      x: number.format(viewport.x),
      y: number.format(viewport.y),
      zoom: percent.format(viewport.zoom),
    });
    this.liveText = text;
    this.announcementSink?.announce(text);
  }

  // Guarded by `hasUpdated` -- `connectedCallback()` already ran the initial `resolveAndAttach()`
  // before the first render, so only a genuine runtime `for` change (never the first update, where
  // `for` always appears in `changed` alongside every other reactive property) should redo it.
  // Runs from `willUpdate()`, not `updated()`, so `snapshot`'s reset lands in the render this same
  // cycle produces instead of synchronously scheduling a second cycle from within `updated()`.
  protected override willUpdate(changed: PropertyValues): void {
    // Ahead of render(), so the geometry it computes stays pure. Both lengths are live theme
    // values, so they are re-read per update rather than cached once: a theme switch, a token a
    // consumer set on any ancestor, and a root font-size change all have to reach the floor.
    this.refreshViewportMetrics();
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
        this.announceViewport(snapshot.viewport);
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

  /** Physical size of the rendered map surface, in CSS px. `[part='map']` fills `[part='base']`'s
   *  content box, which is the host's own content box inset by that wrapper's border on each side
   *  (`box-sizing: border-box` is inherited library-wide) -- so this stays exact without measuring
   *  an element that does not exist yet on the first frame that renders the SVG. */
  private mapSizePx(): { width: number; height: number } {
    const inset = 2 * this.baseBorderPx;
    return {
      width: Math.max(0, this.clientWidth - inset),
      height: Math.max(0, this.clientHeight - inset),
    };
  }

  /** The viewport rectangle in map user-units, floored to a real pointer target.
   *
   *  The raw rect is the canvas viewport divided by its zoom, which is meaningful data but not a
   *  usable affordance: on the canvases this component exists for -- node bounds far larger than
   *  the screen -- it collapses to a couple of physical pixels inside a 12rem x 8rem map, leaving
   *  the only pointer-drag handle for panning effectively unclickable and near-invisible. The same
   *  shape `<lr-heatmap>` already solves for its data-driven cells, resolved from a live token the
   *  same way, and outside `check:hit-area`'s reach because that gate deliberately excludes SVG
   *  shape elements.
   *
   *  The floor is a physical-pixel length, so it is converted into user units through the SVG's own
   *  scale -- `preserveAspectRatio="xMidYMid meet"` scales uniformly by the SMALLER of the two
   *  viewBox-to-box ratios. Growth is symmetric about the rect's own centre, so a floored rect
   *  still points at the part of the graph the viewport is actually showing; keyboard panning and
   *  drag math read the canvas viewport directly and are untouched. */
  private viewportRectContent(
    viewBoxWidth: number,
    viewBoxHeight: number,
  ): { x: number; y: number; width: number; height: number } {
    const vp = this.snapshot?.viewport;
    if (!vp || vp.zoom === 0) return { x: 0, y: 0, width: 0, height: 0 };
    const x = -vp.x / vp.zoom;
    const y = -vp.y / vp.zoom;
    const width = vp.width / vp.zoom;
    const height = vp.height / vp.zoom;
    const map = this.mapSizePx();
    const scale =
      map.width > 0 && map.height > 0 && viewBoxWidth > 0 && viewBoxHeight > 0
        ? Math.min(map.width / viewBoxWidth, map.height / viewBoxHeight)
        : 0;
    const floor = scale > 0 ? this.viewportMinSizePx / scale : 0;
    if (!Number.isFinite(floor) || floor <= 0) return { x, y, width, height };
    const flooredWidth = Math.max(width, floor);
    const flooredHeight = Math.max(height, floor);
    return {
      x: x - (flooredWidth - width) / 2,
      y: y - (flooredHeight - height) / 2,
      width: flooredWidth,
      height: flooredHeight,
    };
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
    if (!this.canvasEl || !this.snapshot || this.canvasEl.locked) return;
    const point = this.clientToContentPoint(e.currentTarget as SVGSVGElement, e.clientX, e.clientY);
    const { zoom, width, height } = this.snapshot.viewport;
    this.announceNextSnapshot = true;
    this.canvasEl.setViewport({ x: width / 2 - point.x * zoom, y: height / 2 - point.y * zoom, zoom });
  };

  private onMapWheel = (e: WheelEvent): void => {
    if (!this.canvasEl || this.canvasEl.locked) return;
    e.preventDefault();
    this.announceNextSnapshot = true;
    if (e.deltaY < 0) this.canvasEl.zoomIn();
    else this.canvasEl.zoomOut();
  };

  private onViewportPointerDown = (e: PointerEvent): void => {
    const dragEventWindow = this.ownerDocument.defaultView;
    if (!this.canvasEl || !this.snapshot || !dragEventWindow || this.canvasEl.locked) return;
    e.stopPropagation();
    this.detachViewportDragListeners();
    this.justDraggedViewport = false;
    this.dragState = {
      pointerId: e.pointerId,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startViewport: { ...this.snapshot.viewport },
      moved: false,
    };
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
    if (!drag || e.pointerId !== drag.pointerId || !this.canvasEl || this.canvasEl.locked) return;
    const svgEl = this.renderRoot.querySelector('[part="map"]') as SVGSVGElement | null;
    const ctm = svgEl?.getScreenCTM();
    if (!ctm) return;
    const scale = ctm.a || 1; // uniform scale (no skew with preserveAspectRatio="xMidYMid meet")
    const dxContent = (e.clientX - drag.startClientX) / scale;
    const dyContent = (e.clientY - drag.startClientY) / scale;
    if (dxContent === 0 && dyContent === 0) return;
    drag.moved = true;
    drag.latestViewport = {
      x: drag.startViewport.x - dxContent * drag.startViewport.zoom,
      y: drag.startViewport.y - dyContent * drag.startViewport.zoom,
      zoom: drag.startViewport.zoom,
    };
    this.canvasEl.setViewport(drag.latestViewport);
  };

  private onViewportPointerUp = (e: PointerEvent): void => {
    const drag = this.dragState;
    if (!drag || e.pointerId !== drag.pointerId) return;
    this.justDraggedViewport = e.type === 'pointerup' && drag.moved;
    if (this.justDraggedViewport && drag.latestViewport && !this.canvasEl?.locked) {
      this.announceViewport(drag.latestViewport);
    }
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
    if (!this.canvasEl || !this.snapshot || this.canvasEl.locked) return;
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
    const viewportRect = this.viewportRectContent(vbW, vbH);
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
