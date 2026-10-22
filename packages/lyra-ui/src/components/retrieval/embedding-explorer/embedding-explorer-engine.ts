import { createEngine3dLoader, type Engine3dInstance } from '../../../internal/engine-3d-loader.js';
import { Engine3dSelection, engine3dFailureReason, webgl2Available, type Engine3dFallbackDetail, type Engine3dFallbackReason, type Engine3dPreference } from '../../../internal/engine-3d.js';
import { resolveCanvasColor } from '../../../internal/canvas-color.js';
import { finiteRange } from '../../../internal/numbers.js';
import { tag } from '../../../internal/prefix.js';
import { isAccessibilityVisible } from '../../../internal/accessibility-visibility.js';
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
  private rows: EmbeddingRows | null = null;
  private container: HTMLElement | null = null;
  private observer?: IntersectionObserver;
  private eligibility?: MutationObserver;
  private intersecting = false;
  private resizeObserver?: ResizeObserver;
  private pending = false;
  private attempted = false;
  private preference: Engine3dPreference = 'builtin';
  private sourceMode = false;
  private styleObserver?: MutationObserver;
  private mediaCleanup: (() => void)[] = [];
  private hover = -1;
  private selected = -1;
  private focus = -1;

  constructor(
    private readonly host: EmbeddingEngineHost,
    private readonly changed: () => void,
    private readonly fallback: (detail: Engine3dFallbackDetail) => void,
    private readonly pick: (index: number) => void,
  ) {}

  /** Release ownership first, so queued observers and disposal callbacks cannot reenter. */
  private releaseEngine(): void {
    this.generation++;
    this.observer?.disconnect(); this.observer = undefined;
    this.eligibility?.disconnect(); this.eligibility = undefined;
    this.intersecting = false;
    this.resizeObserver?.disconnect(); this.resizeObserver = undefined;
    this.styleObserver?.disconnect(); this.styleObserver = undefined;
    for (const cleanup of this.mediaCleanup) cleanup();
    this.mediaCleanup = [];
    const engine = this.engine; this.engine = undefined;
    this.ready = this.loading = this.pending = false;
    this.software = false; this.hover = -1;
    engine?.dispose();
  }

  /** Invalidate immediately on changed public writes, before the next render can accept stale picks. */
  invalidate(): void {
    this.releaseEngine();
    this.attempted = false;
    this.selection.prefer(this.preference); this.notice = null;
  }

  disconnect(): void { this.invalidate(); this.container = null; this.rows = null; }

  update(preference: Engine3dPreference, rows: EmbeddingRows | null, sourceMode: boolean, container: HTMLElement | null, selected: number, focus: number): void {
    const changed = preference !== this.preference || rows !== this.rows || sourceMode !== this.sourceMode || container !== this.container;
    if (changed) {
      this.invalidate();
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
      try { this.engine.setStyle(this.style()); this.syncState(); } catch { this.fail('error'); }
      return;
    }
    if (this.pending || this.attempted || this.selection.renderer !== 'webgl') return;
    if (this.observer || this.eligibility) return;
    const view = this.host.ownerDocument.defaultView;
    const generation = this.generation;
    this.intersecting = view?.IntersectionObserver === undefined;
    const admit = (): void => {
      if (generation !== this.generation || this.pending || this.attempted || !this.intersecting || !isAccessibilityVisible(this.host)) return;
      this.observer?.disconnect(); this.observer = undefined;
      this.eligibility?.disconnect(); this.eligibility = undefined;
      void this.start();
    };
    if (view?.IntersectionObserver) {
      this.observer = new view.IntersectionObserver(entries => {
        if (generation !== this.generation) return;
        for (const entry of entries) if (entry.target === container) this.intersecting = entry.isIntersecting;
        admit();
      });
      this.observer.observe(container);
    }
    // Only pending admission observes author fences; no polling or subtree/document observer.
    if (view?.MutationObserver) {
      this.eligibility = new view.MutationObserver(admit);
      let ancestor: Element | null = this.host;
      let depth = 0;
      while (ancestor && depth++ <= 256) {
        this.eligibility.observe(ancestor, { attributes: true, attributeFilter: ['aria-hidden', 'inert', 'hidden', 'style', 'class', 'open'] });
        const root: Node = ancestor.getRootNode();
        ancestor = ancestor.assignedSlot ?? ancestor.parentElement ?? (root instanceof view.ShadowRoot ? root.host : null);
      }
    }
    admit();
  }

  private fail(reason: Engine3dFallbackReason): void {
    // Only a failed WebGL renderer descends here. Repeated callbacks from a lost context must
    // never claim that the independently rendered SVG fallback has failed as well.
    const detail = this.selection.renderer === 'webgl' ? this.selection.fail(reason) : null;
    this.loading = this.ready = false;
    if (reason !== 'context-lost') {
      this.releaseEngine();
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
      if (!current()) { engine?.dispose(); return; }
      if (!engine) { this.pending = false; this.fail('unavailable'); return; }
      this.engine = engine;
      await engine.mount(container, {
        hover: index => {
          if (!current() || !this.ready) return;
          this.hover = index !== null && rows.point(index) ? index : -1;
          try { this.syncState(); } catch { this.fail('error'); }
        },
        pick: index => { if (current() && this.ready && index !== null && rows.point(index)) this.pick(index); },
        camera: () => {},
        lost: reason => { if (current()) this.fail(reason); },
        rendering: info => { if (current()) { this.software = info.software; this.changed(); } },
        restored: () => {
          if (!current() || !this.engine || !this.selection.restore()) return;
          try { this.ready = true; this.notice = null; this.syncState(); this.changed(); } catch { this.fail('error'); }
        },
      });
      if (!current()) { engine.dispose(); return; }
      engine.setStyle(this.style());
      engine.setData(rows.data(), ++this.revision);
      engine.fit?.();
      const resize = () => {
        if (!current()) return;
        const box = container.getBoundingClientRect();
        engine!.resize(Math.max(1, box.width), Math.max(1, box.height));
      };
      resize();
      const view = owner.defaultView;
      if (view?.ResizeObserver) {
        this.resizeObserver = new view.ResizeObserver(() => {
          if (!current() || !this.ready) return;
          try { engine!.setStyle(this.style()); resize(); } catch { this.fail('error'); }
        });
        this.resizeObserver.observe(container);
      }
      const refreshStyle = () => {
        if (!current() || !this.ready) return;
        try { engine!.setStyle(this.style()); } catch { this.fail('error'); }
      };
      if (view?.MutationObserver) {
        this.styleObserver = new view.MutationObserver(refreshStyle);
        let ancestor: Element | null = this.host;
        while (ancestor) {
          this.styleObserver.observe(ancestor, { attributes: true });
          const root: Node = ancestor.getRootNode();
          ancestor = ancestor.parentElement ?? (root instanceof view.ShadowRoot ? root.host : null);
        }
      }
      for (const query of ['(prefers-reduced-motion: reduce)', '(forced-colors: active)', '(prefers-color-scheme: dark)']) {
        const media = view?.matchMedia(query);
        media?.addEventListener('change', refreshStyle);
        if (media) this.mediaCleanup.push(() => media.removeEventListener('change', refreshStyle));
      }
      this.pending = this.loading = false;
      this.ready = this.selection.renderer === 'webgl';
      this.syncState(); this.changed();
    } catch (error) {
      if (!current()) { engine?.dispose(); return; }
      this.fail(engine3dFailureReason(error));
    }
  }

  private style(): unknown {
    const view = this.host.ownerDocument.defaultView!;
    const computed = view.getComputedStyle(this.host);
    const canvas = this.host.ownerDocument.createElement('canvas');
    canvas.width = canvas.height = 1;
    const context = canvas.getContext('2d', { willReadFrequently: true });
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
      background: color('--lr-color-surface'), foreground: color('--lr-color-text'), muted: color('--lr-color-text-quiet'),
      accent: color('--lr-color-brand'), focus: color('--lr-focus-ring-color'),
      palette: Array.from({ length: 8 }, (_, index) => color(`--lr-color-chart-${index + 1}`)),
      fontFamily: computed.fontFamily, fontSize: finiteRange(Number.parseFloat(computed.fontSize), 14, 1, 128),
      pointSize: 12, lineWidth: 1, devicePixelRatio: finiteRange(view.devicePixelRatio, 1, 0.25, 4),
      reducedMotion: view.matchMedia('(prefers-reduced-motion: reduce)').matches,
      forcedColors: view.matchMedia('(forced-colors: active)').matches,
    };
  }
}
