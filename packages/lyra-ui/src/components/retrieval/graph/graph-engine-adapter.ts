import { createEngine3dLoader, type Engine3dHost, type Engine3dInstance } from '../../../internal/engine-3d-loader.js';
import { engine3dFailureReason, webgl2Available, type Engine3dFallbackReason } from '../../../internal/engine-3d.js';
import { tag } from '../../../internal/prefix.js';

const loader = createEngine3dLoader({ entry: 'graph', tag: tag('graph'), load: () => import('@aceshooting/lyra-3d/graph') });
export interface GraphComponentEngine extends Engine3dInstance { setAppearance(appearance: unknown): void; }
export interface GraphEngineRequest {
  readonly preference: unknown;
  /** True only for an eligible local-data 3D view. Source authority remains with the component. */
  readonly eligible: boolean;
  readonly visible: boolean;
  readonly container: HTMLElement;
  readonly host: Engine3dHost;
  readonly failure: (reason: Engine3dFallbackReason) => void;
}
export interface GraphEngineAdapterServices {
  readonly create?: () => Promise<Engine3dInstance | null>;
  readonly available?: () => boolean;
}
/** Owns a replaceable optional engine; semantic state and fallback presentation stay with the host. */
export class GraphEngineAdapter {
  private generation = 0;
  private engine?: Engine3dInstance;
  private readonly disposed = new WeakSet<Engine3dInstance>();
  constructor(private readonly services: GraphEngineAdapterServices = {}) {}
  private release(engine: Engine3dInstance): void { if (!this.disposed.has(engine)) { this.disposed.add(engine); engine.dispose(); } }
  close(): void { this.generation++; const previous = this.engine; this.engine = undefined; if (previous) this.release(previous); }
  async open(request: GraphEngineRequest): Promise<GraphComponentEngine | null> {
    this.close(); const generation = this.generation;
    if (request.preference !== 'webgl' || !request.eligible || !request.visible) return null;
    const available = (this.services.available ?? webgl2Available)();
    if (generation !== this.generation) return null;
    if (!available) { request.failure('unsupported'); return null; }
    let engine: Engine3dInstance | null;
    try { engine = await (this.services.create ?? (() => loader.create()))(); }
    catch { if (generation === this.generation) request.failure('unavailable'); return null; }
    if (generation !== this.generation) { if (engine) this.release(engine); return null; }
    if (!engine) { request.failure('unavailable'); return null; }
    let appearance = false; try { appearance = typeof (engine as Partial<GraphComponentEngine>).setAppearance === 'function'; } catch { /* Invalid optional companion capability. */ }
    if (generation !== this.generation) { this.release(engine); return null; }
    if (!appearance) { this.release(engine); request.failure('unavailable'); return null; }
    this.engine = engine;
    const current = () => generation === this.generation && this.engine === engine;
    let callbackThrew = false; let callbackError: unknown;
    const invoke = (action: () => void) => { if (!current()) return; try { action(); } catch (error) { callbackThrew = true; callbackError = error; throw error; } };
    const host: Engine3dHost = {
      hover: (item) => { invoke(() => request.host.hover(item)); },
      pick: (item, modifiers) => { invoke(() => request.host.pick(item, modifiers)); },
      camera: (camera) => { invoke(() => request.host.camera(camera)); },
      lost: (reason, detail) => { invoke(() => request.host.lost(reason, detail)); },
      restored: () => { invoke(() => request.host.restored?.()); },
      rendering: (info) => { invoke(() => request.host.rendering?.(info)); },
      progress: (loaded, total) => { invoke(() => request.host.progress?.(loaded, total)); },
    };
    try { await engine.mount(request.container, host); }
    catch (error) {
      const active = current(); if (active) { this.engine = undefined; this.generation++; }
      this.release(engine); if (callbackThrew && Object.is(error, callbackError)) throw error;
      if (active) request.failure(engine3dFailureReason(error)); return null;
    }
    if (!current()) { this.release(engine); return null; }
    return engine as GraphComponentEngine;
  }
}
