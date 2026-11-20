import { OwnedFrame } from '../../../internal/owned-timer.js';
import type { ReactiveControllerHost } from 'lit';
import { ThemeWatcher } from '../../../internal/theme-watcher.js';
import { isAccessibilityVisible } from '../../../internal/accessibility-visibility.js';
import { observeAdmission } from '../../../internal/engine-admission.js';
import { ENGINE_STYLE_MEDIA_QUERIES, resolveEngineStyle, type EngineStyle } from '../../../internal/engine-style.js';
import { createEngine3dLoader, type Engine3dInstance } from '../../../internal/engine-3d-loader.js';
import {
  Engine3dSelection,
  engine3dFailureReason,
  webgl2Available,
  type Engine3dFallbackDetail,
  type Engine3dFallbackReason,
  type Engine3dPreference,
} from '../../../internal/engine-3d.js';
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
  private admission?: () => void;
  private resizeObserver?: ResizeObserver;
  private themeWatcher?: ThemeWatcher;
  private cachedStyle?: EngineStyle;
  private readonly refreshFrame: OwnedFrame;

  constructor(
    private readonly host: HTMLElement & ReactiveControllerHost,
    private readonly callbacks: Chart3dEngineCallbacks,
  ) { this.refreshFrame = new OwnedFrame(host); }

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
    this.admission?.();
    this.admission = undefined;
    this.resizeObserver?.disconnect();
    this.resizeObserver = undefined;
    if (this.themeWatcher) {
      this.themeWatcher.hostDisconnected();
      this.host.removeController(this.themeWatcher);
      this.themeWatcher = undefined;
    }
    this.cachedStyle = undefined;
    const engine = this.engine;
    this.engine = undefined;
    this.refreshFrame.cancel();
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
    // A data-only change on a live renderer replaces its buffers in place; the context, the camera
    // and the mounted DOM survive. Anything else retires the renderer.
    const inPlace =
      this.data !== data && this.container === container && this.preference === preference &&
      !!data?.positions.length && !!this.engine && this.configured && !this.contextLost;
    if (inPlace) {
      const engine = this.engine!;
      const generation = this.generation;
      this.data = data;
      this.hover = -1;
      try {
        engine.setData(data!, ++this.revision);
      } catch {
        if (generation === this.generation && this.engine === engine) this.fail('error');
      }
      if (generation !== this.generation || this.engine !== engine) return;
    } else if (this.data !== data || this.container !== container || this.preference !== preference) {
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
    if (this.attempted || this.admission) return;
    this.awaitAdmission(container);
  }

  /**
   * Starts the renderer the first time the chart is both on screen (native intersection) and
   * exposed to the user. Removing an ancestor's hidden, inert or aria-hidden fence changes no
   * geometry, so no intersection event follows; only the pending admission observes those
   * attributes, and it stops observing the moment the renderer starts.
   */
  private awaitAdmission(container: HTMLElement): void {
    const generation = this.generation;
    let admitted = false;
    const admission = observeAdmission(this.host, container, {
      isReady: () => generation === this.generation && !this.attempted,
      isExposed: () => chart3dEngineEnvironment.visible(this.host),
      onAdmit: () => {
        admitted = true;
        this.admission = undefined;
        void this.start();
      },
    });
    if (!admitted) this.admission = admission;
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
      if (!this.refreshFrame.pending) this.refreshFrame.schedule(apply);
    };
    const apply = () => {
      if (!current() || !this.ready || !engine) return;
      try {
        const previous = this.cachedStyle;
        const style = this.style();
        if (style !== previous) engine.setStyle(style);
        if (current()) resize();
      } catch {
        if (current()) this.fail('error');
      }
    };
    if (view?.ResizeObserver) {
      this.resizeObserver = new view.ResizeObserver(refresh);
      this.resizeObserver.observe(container);
    }
    this.themeWatcher = new ThemeWatcher(this.host, refresh, ENGINE_STYLE_MEDIA_QUERIES);
  }

  /** Resolves tokens, fonts, point and line sizes and media preferences into plain values. */
  private style(): EngineStyle {
    // The probe carries the point-size and line-width tokens, so their units resolve live; without
    // one the host's own box carries them.
    return this.cachedStyle = resolveEngineStyle(this.host, { probe: this.host.shadowRoot?.querySelector('[data-style-probe]') ?? this.host });
  }
}
