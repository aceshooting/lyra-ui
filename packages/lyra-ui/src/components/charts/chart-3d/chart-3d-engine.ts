import { isAccessibilityVisible } from '../../../internal/accessibility-visibility.js';
import { resolveCanvasColor } from '../../../internal/canvas-color.js';
import { createEngine3dLoader, type Engine3dInstance } from '../../../internal/engine-3d-loader.js';
import {
  Engine3dSelection,
  engine3dFailureReason,
  webgl2Available,
  type Engine3dFallbackDetail,
  type Engine3dFallbackReason,
  type Engine3dPreference,
} from '../../../internal/engine-3d.js';
import { finiteRange } from '../../../internal/numbers.js';
import { tag } from '../../../internal/prefix.js';
import { normalizeChart3dCamera, type Chart3dEngineData, type LyraChart3dCamera } from './chart-3d-data.js';

/** The literal import keeps the optional points renderer in its own lazy chunk. */
export const chart3dPointsLoader = createEngine3dLoader({
  entry: 'points',
  tag: tag('chart-3d'),
  load: () => import('@aceshooting/lyra-3d/points'),
});

/**
 * Platform seams: WebGL2 capability before any download, and whether the host is exposed to the
 * user (not hidden, inert, aria-hidden or invisible). Whether it is on screen comes from the
 * native intersection observer.
 */
export const chart3dEngineEnvironment = {
  available: (document: Document): boolean => webgl2Available(() => document.createElement('canvas')),
  visible: (host: HTMLElement): boolean => isAccessibilityVisible(host),
};

interface Chart3dEngineCallbacks {
  /** The controller's visible state (loading, ready, notice, software rendering) changed. */
  changed(): void;
  fallback(detail: Engine3dFallbackDetail): void;
  /** A user activated visible row `index` in the graphical renderer. */
  pick(index: number): void;
  /** A user gesture in the graphical renderer moved the camera. */
  camera(camera: LyraChart3dCamera): void;
}

/**
 * Owns the optional points renderer. Row identity, keyboard interaction and the accessible table
 * stay in the element. Every asynchronous step and every peer callback re-checks a generation
 * token, so a renderer that was retired by a data, preference or connection change can no longer
 * mutate the element, emit events or report a stale failure.
 */
export class Chart3dEngineController {
  readonly selection = new Engine3dSelection(false);
  notice: Engine3dFallbackDetail | null = null;
  loading = false;
  ready = false;
  software = false;
  private engine?: Engine3dInstance;
  private generation = 0;
  private revision = 0;
  private readonly disposed = new WeakSet<object>();
  private data?: Chart3dEngineData;
  private container?: HTMLElement;
  private preference: Engine3dPreference = 'builtin';
  private camera?: LyraChart3dCamera;
  private selected = -1;
  private cursor = -1;
  private hover = -1;
  private attempted = false;
  private configured = false;
  private contextLost = false;
  private observer?: IntersectionObserver;
  private eligibility?: MutationObserver;
  private intersecting = false;
  private resizeObserver?: ResizeObserver;
  private styleObserver?: MutationObserver;
  private cleanup: (() => void)[] = [];
  private colorContext?: CanvasRenderingContext2D | null;

  constructor(
    private readonly host: HTMLElement,
    private readonly callbacks: Chart3dEngineCallbacks,
  ) {}

  /** Disposes a renderer exactly once; a throwing peer disposer still retires ownership. */
  private dispose(engine: Engine3dInstance | undefined): void {
    if (!engine || this.disposed.has(engine)) return;
    this.disposed.add(engine);
    try {
      engine.dispose();
    } catch {
      // Ownership is retired even if the peer's disposer throws.
    }
  }

  /**
   * Retires the current renderer and every observer, and returns the new generation. A caller that
   * continues afterwards compares its own value with `this.generation`: a peer disposer may have
   * re-entered the element and started a newer cycle.
   */
  invalidate(): number {
    const generation = ++this.generation;
    this.observer?.disconnect();
    this.observer = undefined;
    this.eligibility?.disconnect();
    this.eligibility = undefined;
    this.intersecting = false;
    this.resizeObserver?.disconnect();
    this.resizeObserver = undefined;
    this.styleObserver?.disconnect();
    this.styleObserver = undefined;
    for (const cleanup of this.cleanup) cleanup();
    this.cleanup = [];
    const engine = this.engine;
    this.engine = undefined;
    this.colorContext = undefined;
    this.loading = this.ready = this.configured = this.attempted = this.contextLost = this.software = false;
    this.hover = -1;
    this.notice = null;
    this.selection.prefer(this.preference);
    this.dispose(engine);
    return generation;
  }

  disconnect(): void {
    const generation = this.invalidate();
    if (generation !== this.generation) return;
    this.container = undefined;
    this.data = undefined;
  }

  /**
   * Reconciles the renderer with the element's current inputs after each update. Data, container
   * or preference changes retire the renderer; the same inputs only refresh the camera and the
   * selected, hovered and focused rows. A renderer starts at most once per input set, the first
   * time the element is on screen.
   */
  update(
    data: Chart3dEngineData | undefined,
    container: HTMLElement | undefined,
    preference: Engine3dPreference,
    selected: number,
    cursor: number,
    camera?: LyraChart3dCamera,
  ): void {
    if (this.data !== data || this.container !== container || this.preference !== preference) {
      const generation = this.invalidate();
      if (generation !== this.generation) return;
      this.data = data;
      this.container = container;
      this.preference = preference;
      this.selection.prefer(preference);
    }
    const cameraChanged = camera !== this.camera;
    this.camera = camera;
    this.selected = selected;
    this.cursor = cursor;
    if (this.engine && this.configured && !this.contextLost) {
      const engine = this.engine;
      const generation = this.generation;
      const current = () => generation === this.generation && this.engine === engine;
      try {
        if (cameraChanged && camera) engine.setCamera(camera);
        if (current()) this.syncState();
      } catch {
        if (current()) this.fail('error');
      }
      if (!current()) return;
    }
    if (preference !== 'webgl' || !data?.positions.length || !container || !this.host.isConnected) return;
    if (this.attempted || this.observer || this.eligibility) return;
    this.awaitAdmission(container);
  }

  /**
   * Starts the renderer the first time the chart is both on screen (native intersection) and
   * exposed to the user. Removing an ancestor's hidden, inert or aria-hidden fence changes no
   * geometry, so no intersection event follows; only the pending admission observes those
   * attributes, and it stops observing the moment the renderer starts.
   */
  private awaitAdmission(container: HTMLElement): void {
    const view = this.host.ownerDocument.defaultView;
    const generation = this.generation;
    this.intersecting = view?.IntersectionObserver === undefined;
    const admit = (): void => {
      if (generation !== this.generation || this.attempted || !this.intersecting) return;
      if (!chart3dEngineEnvironment.visible(this.host)) return;
      this.observer?.disconnect();
      this.observer = undefined;
      this.eligibility?.disconnect();
      this.eligibility = undefined;
      void this.start();
    };
    if (view?.IntersectionObserver) {
      this.observer = new view.IntersectionObserver((entries) => {
        if (generation !== this.generation) return;
        for (const entry of entries) if (entry.target === container) this.intersecting = entry.isIntersecting;
        admit();
      });
      this.observer.observe(container);
    }
    if (view?.MutationObserver) {
      this.eligibility = new view.MutationObserver(admit);
      let ancestor: Element | null = this.host;
      for (let depth = 0; ancestor && depth <= 256; depth++) {
        this.eligibility.observe(ancestor, {
          attributes: true,
          attributeFilter: ['aria-hidden', 'inert', 'hidden', 'style', 'class', 'open'],
        });
        const root: Node = ancestor.getRootNode();
        ancestor = ancestor.assignedSlot ?? ancestor.parentElement ?? (root instanceof view.ShadowRoot ? root.host : null);
      }
    }
    admit();
  }

  /**
   * Moves one step down the fallback chain (WebGL goes straight to the table, which is always
   * rendered). A lost context keeps its renderer so a restore can resume it; any other failure
   * retires it for good. A failure that has nowhere further to fall keeps the notice already shown.
   */
  private fail(reason: Engine3dFallbackReason): void {
    const previous = this.notice;
    const detail = this.selection.renderer === 'webgl' ? this.selection.fail(reason) : null;
    if (reason === 'context-lost') {
      this.contextLost = true;
      this.ready = this.loading = false;
    } else {
      const generation = this.invalidate();
      if (generation !== this.generation) return;
      this.selection.prefer('webgl');
      this.selection.fail(reason);
      this.attempted = true;
    }
    this.notice = detail ?? previous;
    if (!detail) {
      if (previous && reason !== 'context-lost') this.callbacks.changed();
      return;
    }
    this.callbacks.changed();
    this.callbacks.fallback(detail);
  }

  private syncState(): void {
    this.engine?.setState?.({
      selected: new Set(this.selected < 0 ? [] : [this.selected]),
      dimmed: new Set(),
      hover: this.hover,
      focus: this.cursor,
    });
  }

  private async start(): Promise<void> {
    const container = this.container;
    const data = this.data;
    const owner = this.host.ownerDocument;
    if (!container || !data || !this.host.isConnected || this.preference !== 'webgl' || this.attempted) return;
    const generation = this.generation;
    const current = () =>
      generation === this.generation &&
      this.host.isConnected &&
      this.host.ownerDocument === owner &&
      this.container === container;
    this.attempted = true;
    // Probe the capability before downloading anything.
    if (!chart3dEngineEnvironment.available(owner)) {
      this.fail('unsupported');
      return;
    }
    this.loading = true;
    this.callbacks.changed();
    let engine: Engine3dInstance | null = null;
    try {
      engine = await chart3dPointsLoader.create();
      if (!current()) {
        this.dispose(engine ?? undefined);
        return;
      }
      if (!engine) {
        this.fail('unavailable');
        return;
      }
      this.engine = engine;
      const mounted = engine;
      const rowCount = data.positions.length / 3;
      const valid = (index: number | null): index is number =>
        index !== null && Number.isSafeInteger(index) && index >= 0 && index < rowCount;
      await engine.mount(container, {
        hover: (index) => {
          if (!current() || !this.ready) return;
          this.hover = valid(index) ? index : -1;
          try {
            this.syncState();
          } catch {
            if (current()) this.fail('error');
          }
        },
        pick: (index) => {
          if (current() && this.ready && valid(index)) this.callbacks.pick(index);
        },
        camera: (value) => {
          if (!current() || !this.ready) return;
          this.camera = normalizeChart3dCamera(value);
          this.callbacks.camera(this.camera);
        },
        lost: (reason) => {
          if (current()) this.fail(reason);
        },
        rendering: (info) => {
          if (!current()) return;
          this.software = info.software;
          this.callbacks.changed();
        },
        restored: () => {
          if (!current()) return;
          this.contextLost = false;
          if (!this.configured || !this.selection.restore()) return;
          try {
            mounted.setStyle(this.style());
            if (!current()) return;
            if (this.camera) mounted.setCamera(this.camera);
            if (!current() || this.contextLost) return;
            this.ready = true;
            this.notice = null;
            this.syncState();
            if (current()) this.callbacks.changed();
          } catch {
            if (current()) this.fail('error');
          }
        },
      });
      if (!current()) {
        this.dispose(engine);
        return;
      }
      engine.setStyle(this.style());
      if (!current()) return;
      engine.setData(data, ++this.revision);
      if (!current()) return;
      if (this.camera) engine.setCamera(this.camera);
      else engine.fit?.();
      if (!current()) return;
      const resize = () => {
        if (!current()) return;
        const rect = container.getBoundingClientRect();
        mounted.resize(Math.max(1, rect.width), Math.max(1, rect.height));
      };
      resize();
      if (!current()) return;
      this.observe(container, resize, current);
      this.configured = true;
      this.loading = false;
      this.ready = !this.contextLost;
      if (this.ready) {
        this.selection.restore();
        this.notice = null;
      }
      this.syncState();
      if (current()) this.callbacks.changed();
    } catch (error) {
      if (current()) this.fail(engine3dFailureReason(error));
      else this.dispose(engine ?? undefined);
    }
  }

  /** Re-resolves the renderer's style when the box, an ancestor's attributes or a media query change. */
  private observe(container: HTMLElement, resize: () => void, current: () => boolean): void {
    const view = this.host.ownerDocument.defaultView;
    const engine = this.engine;
    const refresh = () => {
      if (!current() || !this.ready || !engine) return;
      try {
        engine.setStyle(this.style());
        if (current()) resize();
      } catch {
        if (current()) this.fail('error');
      }
    };
    if (view?.ResizeObserver) {
      this.resizeObserver = new view.ResizeObserver(refresh);
      this.resizeObserver.observe(container);
    }
    if (view?.MutationObserver) {
      this.styleObserver = new view.MutationObserver(refresh);
      let ancestor: Element | null = this.host;
      while (ancestor) {
        this.styleObserver.observe(ancestor, { attributes: true });
        const root: Node = ancestor.getRootNode();
        ancestor = ancestor.parentElement ?? (root instanceof view.ShadowRoot ? root.host : null);
      }
    }
    for (const query of ['(prefers-reduced-motion: reduce)', '(forced-colors: active)', '(prefers-color-scheme: dark)']) {
      const media = view?.matchMedia(query);
      media?.addEventListener('change', refresh);
      if (media) this.cleanup.push(() => media.removeEventListener('change', refresh));
    }
  }

  /** Resolves tokens, fonts, point and line sizes and media preferences into plain values. */
  private style(): unknown {
    const view = this.host.ownerDocument.defaultView!;
    const computed = view.getComputedStyle(this.host);
    // The probe carries the point-size and line-width tokens, so their units resolve live.
    const probe = this.host.shadowRoot?.querySelector('[data-style-probe]');
    const measured = probe ? view.getComputedStyle(probe) : computed;
    // One 1x1 canvas converts every CSS color to concrete rgba for the renderer; it lives as long
    // as the renderer does, so a burst of resizes allocates nothing.
    if (this.colorContext === undefined) {
      const canvas = this.host.ownerDocument.createElement('canvas');
      canvas.width = canvas.height = 1;
      this.colorContext = canvas.getContext('2d', { willReadFrequently: true });
    }
    const context = this.colorContext;
    const color = (name: string): string => {
      const resolved = resolveCanvasColor(this.host, `var(${name})`, computed.color);
      if (!context) return resolved;
      context.clearRect(0, 0, 1, 1);
      context.fillStyle = resolved;
      context.fillRect(0, 0, 1, 1);
      const rgba = context.getImageData(0, 0, 1, 1).data;
      return `rgba(${rgba[0]}, ${rgba[1]}, ${rgba[2]}, ${rgba[3]! / 255})`;
    };
    return {
      background: color('--lr-color-surface'),
      foreground: color('--lr-color-text'),
      muted: color('--lr-color-text-quiet'),
      accent: color('--lr-color-brand'),
      focus: color('--lr-focus-ring-color'),
      palette: Array.from({ length: 8 }, (_, index) => color(`--lr-color-chart-${index + 1}`)),
      fontFamily: computed.fontFamily,
      fontSize: finiteRange(Number.parseFloat(computed.fontSize), 14, 1, 128),
      pointSize: finiteRange(Number.parseFloat(measured.inlineSize), 8, 1, 1024),
      lineWidth: finiteRange(Number.parseFloat(measured.borderBlockStartWidth), 1, 0, 64),
      devicePixelRatio: finiteRange(view.devicePixelRatio, 1, 0.25, 4),
      reducedMotion: view.matchMedia('(prefers-reduced-motion: reduce)').matches,
      forcedColors: view.matchMedia('(forced-colors: active)').matches,
    };
  }
}
