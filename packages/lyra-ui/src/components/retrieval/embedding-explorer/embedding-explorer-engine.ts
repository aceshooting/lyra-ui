import { createEngine3dLoader, type Engine3dInstance } from '../../../internal/engine-3d-loader.js';
import { Engine3dSelection, engine3dFailureReason, webgl2Available, type Engine3dFallbackDetail, type Engine3dFallbackReason, type Engine3dPreference } from '../../../internal/engine-3d.js';
import { tag } from '../../../internal/prefix.js';
import { ENGINE_CHART_PALETTE, engineStyle, observeAdmission, watchEngineStyle } from '../../../internal/engine-admission.js';
import type { EmbeddingRows } from './embedding-explorer-data.js';

export const embeddingPointsLoader = createEngine3dLoader({
  entry: 'points', tag: tag('embedding-explorer'), load: () => import('@aceshooting/lyra-3d/points'),
});

/** Platform capability seam; the loader still validates every supplied engine. */
export const embeddingEngineEnvironment = {
  available: (document: Document): boolean => webgl2Available(() => document.createElement('canvas')),
};

interface EmbeddingEngineHost extends HTMLElement {
  requestUpdate(): void;
}

/** Owns the optional renderer; row identity, keyboard and event projection remain in the element. */
export class EmbeddingEngineController {
  readonly selection = new Engine3dSelection(true);
  notice: Engine3dFallbackDetail | null = null;
  loading = false;
  ready = false;
  software = false;
  private engine?: Engine3dInstance;
  private generation = 0;
  private revision = 0;
  private readonly disposed = new WeakSet<Engine3dInstance>();
  private rows: EmbeddingRows | null = null;
  private container: HTMLElement | null = null;
  private admission?: () => void;
  private resizeObserver?: ResizeObserver;
  private pending = false;
  private attempted = false;
  private preference: Engine3dPreference = 'builtin';
  private sourceMode = false;
  private releaseTheme?: () => void;
  private hover = -1;
  private selected = -1;
  private focus = -1;

  constructor(
    private readonly host: EmbeddingEngineHost,
    private readonly changed: () => void,
    private readonly fallback: (detail: Engine3dFallbackDetail) => void,
    private readonly pick: (index: number) => void,
  ) {}

  private dispose(engine: Engine3dInstance | null | undefined): void {
    if (!engine || this.disposed.has(engine)) return;
    this.disposed.add(engine);
    try { engine.dispose(); } catch { /* A failed disposer still retires ownership. */ }
  }

  /** Release ownership first; callers must preserve any newer cycle started by disposal. */
  private releaseEngine(): number {
    const generation = ++this.generation;
    this.admission?.(); this.admission = undefined;
    this.resizeObserver?.disconnect(); this.resizeObserver = undefined;
    this.releaseTheme?.(); this.releaseTheme = undefined;
    const engine = this.engine; this.engine = undefined;
    this.ready = this.loading = this.pending = false;
    this.software = false; this.hover = -1;
    this.dispose(engine);
    return generation;
  }

  /** Invalidate immediately on changed public writes, before the next render can accept stale picks. */
  invalidate(): void { this.invalidateCycle(); }

  private invalidateCycle(): number {
    const generation = this.releaseEngine();
    if (generation !== this.generation) return generation;
    this.attempted = false;
    this.selection.prefer(this.preference); this.notice = null;
    return generation;
  }

  disconnect(): void {
    const generation = this.invalidateCycle();
    if (generation !== this.generation) return;
    this.container = null; this.rows = null;
  }

  update(preference: Engine3dPreference, rows: EmbeddingRows | null, sourceMode: boolean, container: HTMLElement | null, selected: number, focus: number): void {
    const changed = preference !== this.preference || rows !== this.rows || sourceMode !== this.sourceMode || container !== this.container;
    if (changed) {
      const generation = this.invalidateCycle();
      if (generation !== this.generation) return;
      this.preference = preference; this.rows = rows; this.sourceMode = sourceMode; this.container = container;
      this.selection.prefer(preference); this.notice = null;
    }
    this.selected = selected; this.focus = focus;
    if (preference !== 'webgl' || !this.host.isConnected) return;
    if (sourceMode) {
      if (!this.attempted) { this.attempted = true; this.fail('unsupported'); }
      return;
    }
    if (!rows?.count || !container) return;
    if (this.engine && this.ready) {
      const generation = this.generation;
      try {
        this.engine.setStyle(this.style());
        if (generation === this.generation) this.syncState();
      } catch { if (generation === this.generation) this.fail('error'); }
      return;
    }
    if (this.pending || this.attempted || this.selection.renderer !== 'webgl') return;
    if (this.admission) return;
    const generation = this.generation;
    // Only pending admission observes author fences; no polling or subtree/document observer.
    let admitted = false;
    const admission = observeAdmission(this.host, container, {
      isReady: () => generation === this.generation && !this.pending && !this.attempted,
      onAdmit: () => { admitted = true; this.admission = undefined; void this.start(); },
    });
    if (!admitted) this.admission = admission;
  }

  private fail(reason: Engine3dFallbackReason): void {
    // Late WebGL failure callbacks cannot invalidate the SVG fallback.
    const detail = this.selection.renderer === 'webgl' ? this.selection.fail(reason) : null;
    this.loading = this.ready = false;
    if (reason !== 'context-lost') {
      const generation = this.releaseEngine();
      if (generation !== this.generation) return;
      this.attempted = true;
    }
    if (!detail) return;
    this.notice = detail;
    this.changed();
    this.fallback(detail);
  }

  private syncState(): void {
    this.engine?.setState?.({ selected: new Set(this.selected < 0 ? [] : [this.selected]), dimmed: new Set(), hover: this.hover, focus: this.focus });
  }

  private async start(): Promise<void> {
    const container = this.container, rows = this.rows, owner = this.host.ownerDocument;
    if (!container || !rows || !this.host.isConnected || this.preference !== 'webgl') return;
    const generation = this.generation;
    const current = () => generation === this.generation && this.host.isConnected && this.host.ownerDocument === owner && this.container === container;
    this.attempted = this.pending = true;
    if (!embeddingEngineEnvironment.available(owner)) { this.pending = false; this.fail('unsupported'); return; }
    this.loading = true; this.changed();
    let engine: Engine3dInstance | null = null;
    try {
      engine = await embeddingPointsLoader.create();
      if (!current()) { this.dispose(engine); return; }
      if (!engine) { this.pending = false; this.fail('unavailable'); return; }
      this.engine = engine;
      await engine.mount(container, {
        hover: index => {
          if (!current() || !this.ready) return;
          this.hover = index !== null && rows.point(index) ? index : -1;
          try { this.syncState(); } catch { if (current()) this.fail('error'); }
        },
        pick: index => { if (current() && this.ready && index !== null && rows.point(index)) this.pick(index); },
        camera: () => {},
        lost: reason => { if (current()) this.fail(reason); },
        rendering: info => { if (current()) { this.software = info.software; this.changed(); } },
        restored: () => {
          if (!current() || !this.engine || !this.selection.restore()) return;
          try {
            this.ready = true; this.notice = null; this.syncState();
            if (current()) this.changed();
          } catch { if (current()) this.fail('error'); }
        },
      });
      if (!current()) { this.dispose(engine); return; }
      engine.setStyle(this.style());
      if (!current()) return;
      engine.setData(rows.data(), ++this.revision);
      if (!current()) return;
      const resize = () => {
        if (!current()) return;
        const box = container.getBoundingClientRect();
        engine!.resize(Math.max(1, box.width), Math.max(1, box.height));
      };
      resize();
      if (!current()) return;
      engine.fit?.();
      if (!current()) return;
      const view = owner.defaultView;
      if (view?.ResizeObserver) {
        this.resizeObserver = new view.ResizeObserver(() => {
          if (!current() || !this.ready) return;
          try { engine!.setStyle(this.style()); resize(); } catch { if (current()) this.fail('error'); }
        });
        this.resizeObserver.observe(container);
      }
      const refreshStyle = () => {
        if (!current() || !this.ready) return;
        try { engine!.setStyle(this.style()); } catch { if (current()) this.fail('error'); }
      };
      // Theme attributes and the style media queries only, never every ancestor attribute.
      this.releaseTheme = watchEngineStyle(this.host, refreshStyle);
      this.pending = this.loading = false;
      this.ready = this.selection.renderer === 'webgl';
      this.syncState();
      if (current()) this.changed();
    } catch (error) {
      if (!current()) { this.dispose(engine); return; }
      this.fail(engine3dFailureReason(error));
    }
  }

  private style(): unknown {
    return engineStyle(this.host, ENGINE_CHART_PALETTE, 12, 1);
  }
}
