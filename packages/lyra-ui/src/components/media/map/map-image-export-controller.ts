import { normalizeMapControlOptions } from './map-control-options.js';
import { collectMapExportAttribution } from './map-export-attribution.js';
import { LyraMapImageExportError, type LyraMapImageExportErrorCode } from './map-image-export-error.js';
import { exportMapImage, type MapImageExportServices } from './map-image-export.js';
import type { MapLibreMapCapability } from './map-loader.js';

/** One `exportImage()` request, admitted synchronously by the element before this runtime loads. */
export interface MapImageExportRequest {
  readonly map: MapLibreMapCapability;
  readonly style: number;
  readonly connection: number;
  /** Detached own-data options, or `undefined` when the caller passed none. */
  readonly options: unknown;
  /** The caller's options could not be admitted. */
  readonly invalid: boolean;
}

/** The private element capabilities an export needs. */
export interface MapImageExportHost {
  readonly element: HTMLElement & { readonly controls?: unknown; whenIdle(): Promise<void> };
  /** Whether `map`, `style` and `connection` still name the element's current engine and style. */
  current(map: MapLibreMapCapability, style: number, connection: number): boolean;
  /** Feature-preparation and drawing generations; a change cancels the export in progress. */
  generations(): readonly [features: number, drawing: number];
  /** Component work a fresh frame must wait for. */
  pending(): boolean;
  onRender(map: MapLibreMapCapability, listener: () => void): () => void;
  clearFeedback(): void;
  /** Publishes localized feedback for a non-cancelled failure and emits `lr-map-export-error`. */
  fail(code: LyraMapImageExportErrorCode): void;
}

interface MapImageExportOwner {
  readonly map: MapLibreMapCapability;
  readonly style: number;
  readonly connection: number;
  readonly controller: AbortController;
  readonly services: MapImageExportServices;
  readonly request: { attribution: boolean; attributionFailed: boolean; features: number; drawing: number; controls: unknown };
  busy: boolean;
}

/** Owns one element's export transactions; a style replacement or disconnect cancels them. */
export class MapImageExportController {
  private owner?: MapImageExportOwner;
  private idleWait?: Promise<void>;

  constructor(private readonly host: MapImageExportHost) {}

  cancel(): void {
    const owner = this.owner;
    this.owner = undefined;
    this.idleWait = undefined;
    owner?.controller.abort();
  }

  export(input: MapImageExportRequest): Promise<Blob> {
    const { map, style, connection } = input, host = this.host, element = host.element;
    // The runtime may have loaded after the element replaced its style or disconnected.
    if (!host.current(map, style, connection)) return Promise.reject(new LyraMapImageExportError('cancelled'));
    let owner = this.owner;
    if (!owner || owner.controller.signal.aborted || owner.map !== map || owner.style !== style || owner.connection !== connection) {
      this.cancel();
      const controller = new AbortController();
      const [features, drawing] = host.generations();
      const request = { attribution: true, attributionFailed: false, features, drawing, controls: element.controls };
      const current = (): boolean => {
        if (controller.signal.aborted || !host.current(map, style, connection)) return false;
        const [nextFeatures, nextDrawing] = host.generations();
        return nextFeatures === request.features && nextDrawing === request.drawing && element.controls === request.controls;
      };
      let attribution = '';
      const services: MapImageExportServices = {
        current,
        ready: async signal => {
          if (!current() || signal.aborted) throw new LyraMapImageExportError('cancelled');
          if (!this.idleWait) {
            const pending = element.whenIdle();
            this.idleWait = pending;
            void pending.finally(() => { if (this.idleWait === pending) this.idleWait = undefined; }).catch(() => undefined);
          }
          await this.idleWait;
          if (!current() || signal.aborted) throw new LyraMapImageExportError('cancelled');
          if (typeof map.triggerRepaint !== 'function' || typeof map.off !== 'function' || typeof map.loaded !== 'function') throw new LyraMapImageExportError('not-ready');
          request.attributionFailed = false;
          attribution = '';
          if (request.attribution) {
            try {
              if (typeof map.getStyle !== 'function') throw new LyraMapImageExportError('attribution-failed');
              const normalized = normalizeMapControlOptions(element.controls);
              const customAttribution = normalized.controls.get('attribution')?.options['customAttribution'];
              attribution = await collectMapExportAttribution({ getStyle: () => map.getStyle!(), getSource: id => map.getSource(id) },
                { document: element.ownerDocument, customAttribution, signal, current });
            } catch (error) {
              request.attributionFailed = error instanceof LyraMapImageExportError && error.code === 'attribution-failed';
              throw error;
            }
          }
          if (!current() || signal.aborted) throw new LyraMapImageExportError('cancelled');
        },
        onRender: callback => host.onRender(map, () => {
          if (!current()) { callback(); return; }
          if (host.pending()) return;
          try {
            const moving = map.isMoving?.() === true;
            if (!current()) { callback(); return; }
            if (moving || host.pending()) return;
            const loaded = map.loaded!() === true;
            if (!current()) { callback(); return; }
            if (!loaded || host.pending()) return;
            callback();
          } catch { controller.abort(); }
        }),
        requestRender: () => { if (!current()) throw new LyraMapImageExportError('cancelled'); map.triggerRepaint!(); },
        canvas: () => { if (!current()) throw new LyraMapImageExportError('cancelled'); return map.getCanvas(); },
        attributionText: () => attribution,
        createCanvas: () => element.ownerDocument.createElement('canvas'),
      };
      owner = { map, style, connection, controller, services, request, busy: false };
      this.owner = owner;
    }
    const active = owner, admitted = !owner.busy;
    if (admitted) {
      active.busy = true;
      [active.request.features, active.request.drawing] = host.generations();
      active.request.controls = element.controls;
      active.request.attribution = (input.options as { readonly attribution?: unknown } | undefined)?.attribution !== false;
      host.clearFeedback();
    }
    const work = !admitted ? Promise.reject(new LyraMapImageExportError('busy')) : input.invalid
      ? Promise.reject(new LyraMapImageExportError('invalid-options')) : exportMapImage(input.options, active.services, active.controller.signal);
    return work.catch(error => {
      const code = error instanceof LyraMapImageExportError
        ? error.code === 'not-ready' && active.request.attributionFailed ? 'attribution-failed' : error.code : 'capture-failed';
      if (this.owner === active && element.isConnected) host.fail(code);
      throw error instanceof LyraMapImageExportError && error.code === code ? error : new LyraMapImageExportError(code);
    }).finally(() => { if (admitted) active.busy = false; });
  }
}
