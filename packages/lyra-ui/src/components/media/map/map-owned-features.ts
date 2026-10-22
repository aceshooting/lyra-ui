import { isPlainDataRecord } from '../../../internal/data-descriptors.js';
import { admitMapImages, MAP_IMAGE_LIMITS, prepareMapImages, type LyraMapImage, type PreparedMapImage } from './map-images.js';
import type { MapLibreMapCapability } from './map-loader.js';
import { admitMapOverlays, MapOwnedResources, type MapOwnedOverlaySnapshot, type MapOwnedResourcePeer, type MapOwnedSourceChange } from './map-owned-resources.js';
import { MapStyleOverrides, projectMapStyleOverrides, type MapStyleOverridePeer, type LyraMapStyleValue } from './map-style-overrides.js';
import { planMapSourceUpdate } from './map-source-updates.js';

export interface MapOwnedFeatureInput {
  readonly overlays: unknown;
  readonly images: unknown;
  readonly styleOverrides: unknown;
}
export interface MapOwnedFeatureContext {
  readonly owner: Element;
  readonly signal: AbortSignal;
  readonly isCurrent: () => boolean;
  readonly isGeneratedLayer: (id: string) => boolean;
  readonly resolve: (value: LyraMapStyleValue, property: string) => unknown;
  readonly beforeSourceChange?: (change: MapOwnedSourceChange) => void;
}
interface CachedImage { readonly key: string; readonly image: PreparedMapImage; }
function failed(): never {
  const error = new Error('Map resources could not be restored.'); error.name = 'MapResourceError'; throw error;
}
function aborted(): never { throw new DOMException('Map resource work was cancelled.', 'AbortError'); }
const imageKey = (descriptor: LyraMapImage): string => JSON.stringify(descriptor);

/** Compare admitted data only; native canvas handles match by identity. */
function sameSnapshot(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (Array.isArray(left) && Array.isArray(right)) return left.length === right.length &&
    left.every((entry, index) => sameSnapshot(entry, right[index]));
  if (!isPlainDataRecord(left) || !isPlainDataRecord(right)) return false;
  const keys = Object.keys(left);
  return keys.length === Object.keys(right).length && keys.every(key =>
    Object.hasOwn(right, key) && sameSnapshot(left[key], right[key]));
}

/** Capture component assignments before any unrelated feature preparation can yield. */
export function snapshotMapOwnedFeatureInput(input: MapOwnedFeatureInput): MapOwnedFeatureInput {
  const overlays = admitMapOverlays(input.overlays);
  const images = admitMapImages(input.images);
  const overrides = projectMapStyleOverrides(input.styleOverrides);
  if (!overlays.ok || !images.ok || !overrides) failed();
  return Object.freeze({ overlays: overlays.overlays, images: images.images, styleOverrides: overrides });
}

/** Coordinates admitted resources and portable image preparation for one component owner. */
export class MapOwnedFeatures {
  private readonly resources = new MapOwnedResources();
  private readonly overrides = new MapStyleOverrides();
  private cache = new Map<string, CachedImage>();
  private peer?: MapLibreMapCapability;
  private resourcePeer?: MapOwnedResourcePeer;
  private overridePeer?: MapStyleOverridePeer;
  private abort?: AbortController;
  private epoch = 0;
  private hasResources = false;
  private committedResources?: { readonly map: MapLibreMapCapability; readonly style: unknown;
    readonly overlays: MapOwnedOverlaySnapshot; readonly images: readonly PreparedMapImage[]; readonly layerIds: readonly string[] };
  private hasOverrides = false;
  private overriding = false;
  private disposing = false;

  constructor(private readonly prepareImages: typeof prepareMapImages = prepareMapImages) {}

  ownsLayer(id: string): boolean { return this.resources.ownsLayer(id); }

  cancel(): void {
    const abort = this.abort;
    this.abort = undefined; this.epoch += 1;
    this.resources.cancel();
    if (this.overriding) this.overrides.reset();
    abort?.abort();
  }

  /** The engine must be removed first: retained pixels can still belong to its image atlas. */
  dispose(): void {
    if (this.disposing) return;
    this.disposing = true;
    try {
      this.cancel(); this.resources.dispose(); this.overrides.reset(); this.cache.clear();
      this.peer = undefined; this.resourcePeer = undefined; this.overridePeer = undefined;
      this.hasResources = false; this.hasOverrides = false; this.committedResources = undefined;
    } finally { this.disposing = false; }
  }

  async reconcile(map: MapLibreMapCapability, style: unknown, input: MapOwnedFeatureInput, context: MapOwnedFeatureContext): Promise<void> {
    if (this.disposing) aborted();
    const previous = this.abort;
    const controller = new AbortController(); this.abort = controller;
    const epoch = ++this.epoch;
    const current = (): boolean => {
      try { return this.epoch === epoch && this.abort === controller && !controller.signal.aborted &&
        !context.signal.aborted && context.isCurrent() && this.epoch === epoch && this.abort === controller &&
        !controller.signal.aborted && !context.signal.aborted; } catch { return false; }
    };
    const check = (): void => { if (!current()) aborted(); };
    const cancel = (): void => {
      controller.abort();
      if (this.epoch === epoch) { this.resources.cancel(); if (this.overriding) this.overrides.reset(); }
    };
    context.signal.addEventListener('abort', cancel, { once: true });
    this.resources.cancel();
    previous?.abort();
    const created: PreparedMapImage[] = []; let transferred = false;
    try {
      check();
      const overlays = admitMapOverlays(input.overlays);
      const images = admitMapImages(input.images);
      const overrides = projectMapStyleOverrides(input.styleOverrides);
      check();
      if (!overlays.ok || !images.ok || !overrides) failed();
      const hasResources = overlays.overlays.sources.length > 0 || overlays.overlays.layers.length > 0 || images.images.length > 0;
      const hasOverrides = overrides.length > 0;
      if (!hasResources && !hasOverrides && !this.hasResources && !this.hasOverrides) return;
      this.bind(map);
      const desired = new Map<string, CachedImage>();
      const changed = images.images.filter(descriptor => {
        const cached = this.cache.get(descriptor.id);
        if (cached?.key === imageKey(descriptor) && cached.image.image) { desired.set(descriptor.id, cached); return false; }
        return true;
      });
      if (changed.length > 0) {
        const prepared = await this.prepareImages(changed, { owner: context.owner, signal: controller.signal, isCurrent: current });
        if (prepared.ok) created.push(...prepared.images);
        check();
        if (!prepared.ok || prepared.images.length !== changed.length) failed();
        for (let index = 0; index < changed.length; index += 1) {
          const descriptor = changed[index]!; const image = prepared.images[index];
          if (!image || image.id !== descriptor.id) failed();
          desired.set(descriptor.id, { key: imageKey(descriptor), image });
        }
      }
      // Older injected preparers without accounting are conservatively charged a whole batch.
      const encodedBytes = [...desired.values()].reduce((total, entry) => total + (entry.image.encodedBytes ?? MAP_IMAGE_LIMITS.totalBytes), 0);
      const decodedPixels = [...desired.values()].reduce((total, entry) => total + (entry.image.decodedPixels ?? MAP_IMAGE_LIMITS.totalPixels), 0);
      if (!Number.isFinite(encodedBytes) || encodedBytes < 0 || encodedBytes > MAP_IMAGE_LIMITS.totalBytes ||
        !Number.isFinite(decodedPixels) || decodedPixels < 0 || decodedPixels > MAP_IMAGE_LIMITS.totalPixels) failed();
      check();
      const desiredImages = images.images.map(descriptor => desired.get(descriptor.id)!.image);
      const committed = this.committedResources;
      const unchanged = committed?.map === map && Object.is(committed.style, style) &&
        sameSnapshot(committed.overlays, overlays.overlays) &&
        committed.images.length === desiredImages.length && committed.images.every((image, index) => image === desiredImages[index]) &&
        sameSnapshot(committed.layerIds, this.resourcePeer!.layerIds());
      check();
      if ((hasResources || this.hasResources) && !unchanged) {
        if (typeof map.getStyle !== 'function' || typeof map.moveLayer !== 'function') failed();
        if (images.images.length > 0 || this.cache.size > 0) {
          if (typeof map.hasImage !== 'function' || typeof map.addImage !== 'function' || typeof map.removeImage !== 'function') failed();
        }
        transferred = true; this.hasResources = true; this.committedResources = undefined;
        const result = await this.resources.reconcile(this.resourcePeer!, style, overlays.overlays, desiredImages, {
            isCurrent: current,
            beforeSourceChange: context.beforeSourceChange,
            prepare: async (requirements, signal) => {
              if (typeof map.prepareFeatures === 'function') await map.prepareFeatures(requirements, { signal });
            },
          });
        check();
        if (!result.ok) failed();
        const layerIds = this.resourcePeer!.layerIds(); check();
        this.cache = desired; this.hasResources = hasResources;
        this.committedResources = { map, style, overlays: overlays.overlays, images: desiredImages, layerIds };
      }
      if (hasOverrides || this.hasOverrides) {
        if (typeof map.getPaintProperty !== 'function' || typeof map.getLayoutProperty !== 'function' ||
          typeof map.setLayoutProperty !== 'function' || typeof map.triggerRepaint !== 'function') failed();
        this.overriding = true;
        const result = (() => {
          try {
            return this.overrides.reconcile(this.overridePeer!, style, overrides, {
              isOwned: id => this.resources.ownsLayer(id) || context.isGeneratedLayer(id),
              resolve: (value, detail) => context.resolve(value, detail.property),
            });
          } finally { this.overriding = false; }
        })();
        check();
        if (!result.accepted || result.diagnostics.some(entry => entry.code !== 'external-change')) failed();
        this.hasOverrides = hasOverrides;
      }
    } catch (error) {
      if (!current() || error instanceof DOMException && error.name === 'AbortError') aborted();
      failed();
    } finally {
      context.signal.removeEventListener('abort', cancel);
      if (!transferred) for (const image of created) image.dispose();
      if (this.abort === controller) this.abort = undefined;
    }
  }

  private bind(map: MapLibreMapCapability): void {
    if (this.peer === map) return;
    this.peer = map;
    this.resourcePeer = {
      getSource: id => map.getSource(id), getLayer: id => map.getLayer(id),
      layerIds: () => {
        const layers = map.getStyle!().layers;
        if (!Array.isArray(layers) || layers.length > 20_000) failed();
        return layers.map(layer => layer.id);
      },
      addSource: (id, source) => map.addSource(id, source), removeSource: id => map.removeSource(id),
      planSourceUpdate: (id, previous, next, checkCurrent) => planMapSourceUpdate(map.getSource(id), previous, next, checkCurrent),
      addLayer: (layer, before) => map.addLayer(layer, before), removeLayer: id => map.removeLayer(id),
      moveLayer: (id, before) => map.moveLayer!(id, before),
      hasImage: id => map.hasImage!(id), addImage: (id, image, options) => map.addImage!(id, image, options),
      removeImage: id => map.removeImage!(id),
    };
    this.overridePeer = {
      getLayer: id => map.getLayer(id), getPaintProperty: (id, property) => map.getPaintProperty!(id, property),
      getLayoutProperty: (id, property) => map.getLayoutProperty!(id, property),
      setPaintProperty: (id, property, value) => map.setPaintProperty(id, property, value),
      setLayoutProperty: (id, property, value) => map.setLayoutProperty!(id, property, value),
      triggerRepaint: () => map.triggerRepaint!(),
    };
  }
}
