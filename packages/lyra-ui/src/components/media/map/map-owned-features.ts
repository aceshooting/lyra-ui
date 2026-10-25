export { MapBasemapOrder } from './map-basemap-order.js';
export { planMapLayerOrder } from './map-layer-order.js';
export { MapExternalSourceEffects } from './map-external-source-effects.js';
import { getInheritedPropertyDescriptor, getOwnDataDescriptor, isPlainDataRecord } from '../../../internal/data-descriptors.js';
import { loadMapImageRuntime, loadMapStyleOverrideRuntime } from './map-resource-feature-loaders.js';
import { admitMapImages, MAP_IMAGE_LIMITS, type LyraMapImage } from './map-image-admission.js';
import type { prepareMapImages, PreparedMapImage } from './map-images.js';
import type { MapLibreMapCapability } from './map-loader.js';
import { failMapResources as failed, type MapOwnedFeatureInput } from './map-owned-feature-input.js';
import { admitMapOverlays, isIdentityGeoJsonData, type MapOwnedOverlaySnapshot } from './map-overlay-admission.js';
import { MapOwnedResources, type MapOwnedResourcePeer, type MapOwnedSourceChange } from './map-owned-resources.js';
import { expandMapStyleOverrides, projectMapStyleOverrides, type LyraMapStyleValue } from './map-style-override-admission.js';
import type { LyraMapStyleLayer } from './map-interaction-options.js';
import type { MapStyleOverridePeer, MapStyleOverrides } from './map-style-overrides.js';
import { planMapSourceUpdate } from './map-source-updates.js';

import { MapImageProvider } from './map-image-provider.js';

// Admission runs here too, so a map without overlays, images or overrides never loads it.
export { snapshotMapOwnedFeatureInput } from './map-owned-feature-input.js';
export { projectMapStyleOverrides };
export interface MapOwnedFeatureContext {
  readonly owner: Element;
  readonly signal: AbortSignal;
  readonly isCurrent: () => boolean;
  readonly isGeneratedLayer: (id: string) => boolean;
  readonly resolve: (value: LyraMapStyleValue, property: string) => unknown;
  readonly beforeSourceChange?: (change: MapOwnedSourceChange) => void;
  /** The current basemap layers that `styleOverrides` selectors match against. */
  readonly styleLayers?: () => readonly LyraMapStyleLayer[];
}
interface CachedImage { readonly key: string; readonly image: PreparedMapImage; }
function aborted(): never { throw new DOMException('Map resource work was cancelled.', 'AbortError'); }
const imageKey = (descriptor: LyraMapImage): string => JSON.stringify(descriptor);

/** Compare admitted data only; native canvas handles match by identity. */
function sameSnapshot(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (isIdentityGeoJsonData(left) || isIdentityGeoJsonData(right)) return false;
  if (Array.isArray(left) && Array.isArray(right)) return left.length === right.length &&
    left.every((entry, index) => sameSnapshot(entry, right[index]));
  if (!isPlainDataRecord(left) || !isPlainDataRecord(right)) return false;
  const keys = Object.keys(left);
  return keys.length === Object.keys(right).length && keys.every(key =>
    Object.hasOwn(right, key) && sameSnapshot(left[key], right[key]));
}

/**
 * Overlay layers whose paint values resolve through the element (theme tokens, modern color
 * functions) before they reach the engine. Unchanged layers keep their admitted identity, so a
 * theme that resolves to the same colors leaves every native layer in place.
 */
function resolveOverlayPaint(overlays: MapOwnedOverlaySnapshot, resolve: MapOwnedFeatureContext['resolve']): MapOwnedOverlaySnapshot {
  let changed = false;
  const layers = overlays.layers.map(entry => {
    const paint = entry.layer['paint'];
    if (!isPlainDataRecord(paint)) return entry;
    let differs = false;
    const resolved: Record<string, unknown> = {};
    for (const [property, value] of Object.entries(paint)) {
      const next = resolve(value as LyraMapStyleValue, property);
      if (!sameSnapshot(next, value)) differs = true;
      resolved[property] = next;
    }
    if (!differs) return entry;
    changed = true;
    return Object.freeze({ ...entry, layer: Object.freeze({ ...entry.layer, paint: Object.freeze(resolved) }) });
  });
  return changed ? Object.freeze({ sources: overlays.sources, layers: Object.freeze(layers) }) : overlays;
}

/** Resolve theme paint and re-admit its final bytes before any peer work. */
export function resolveMapOwnedOverlayPaint(overlays: MapOwnedOverlaySnapshot,
  resolve: MapOwnedFeatureContext['resolve']): MapOwnedOverlaySnapshot {
  const admitted = admitMapOverlays(resolveOverlayPaint(overlays, resolve));
  if (!admitted.ok) failed();
  return admitted.overlays;
}

/**
 * The admitted paint of `overlays.layers` as text, so the element can discover the theme tokens it
 * names without snapshotting overlay source data. Empty for unusable input.
 */
export function overlayPaintText(overlays: unknown): string {
  try {
    if (!isPlainDataRecord(overlays)) return '';
    const layers = getOwnDataDescriptor(overlays, 'layers');
    if (typeof layers !== 'object' || layers.value === undefined) return '';
    const admitted = admitMapOverlays({ layers: layers.value });
    return admitted.ok ? JSON.stringify(admitted.overlays.layers.map(entry => entry.layer['paint'] ?? null)) : '';
  } catch { return ''; }
}

/** Image fetching, sanitizing and rasterizing load only once admitted images need preparing. */
const prepareOnDemand: typeof prepareMapImages = async (value, context, services) =>
  (loadMapImageRuntime.loaded ?? await loadMapImageRuntime()).prepareMapImages(value, context, services);

/** Coordinates admitted resources and portable image preparation for one component owner. */
export class MapOwnedFeatures {
  private readonly resources = new MapOwnedResources();
  private readonly provider = new MapImageProvider();
  private overrides?: MapStyleOverrides;
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

  constructor(private readonly prepareImages: typeof prepareMapImages = prepareOnDemand) {}

  ownsLayer(id: string): boolean { return this.resources.ownsLayer(id); }
  ownsGeoJsonSource(id: string): boolean { return this.resources.ownsGeoJsonSource(id); }

  /** Installs, replaces or removes the lazy `imageProvider` for one live engine. */
  configureImageProvider(map: MapLibreMapCapability | undefined, provider: unknown, owner: Element): void {
    this.provider.configure(map, provider, {
      owner, prepare: this.prepareImages,
      ownedIds: () => new Set(this.cache.keys()),
      ownedUsage: () => {
        let encodedBytes = 0, decodedPixels = 0;
        for (const entry of this.cache.values()) {
          encodedBytes += entry.image.encodedBytes ?? MAP_IMAGE_LIMITS.totalBytes;
          decodedPixels += entry.image.decodedPixels ?? MAP_IMAGE_LIMITS.totalPixels;
        }
        return { count: this.cache.size, encodedBytes, decodedPixels };
      },
    });
  }

  cancel(): void {
    const abort = this.abort;
    this.abort = undefined; this.epoch += 1;
    this.resources.cancel(); this.provider.cancelOwnedUpdate();
    if (this.overriding) this.overrides?.reset();
    abort?.abort();
  }

  /** The engine must be removed first: retained pixels can still belong to its image atlas. */
  dispose(): void {
    if (this.disposing) return;
    this.disposing = true;
    try {
      this.provider.dispose(); this.cancel(); this.resources.dispose(); this.overrides?.reset(); this.cache.clear();
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
      if (this.epoch === epoch) { this.resources.cancel(); if (this.overriding) this.overrides?.reset(); }
    };
    context.signal.addEventListener('abort', cancel, { once: true });
    this.resources.cancel();
    previous?.abort(); this.provider.cancelOwnedUpdate();
    const created: PreparedMapImage[] = []; let transferred = false;
    let imageUpdate: ReturnType<MapImageProvider['beginOwnedUpdate']> | undefined;
    try {
      check();
      const overlays = admitMapOverlays(input.overlays);
      const images = admitMapImages(input.images);
      const overrides = projectMapStyleOverrides(input.styleOverrides);
      check();
      if (!overlays.ok || !images.ok || !overrides) failed();
      const overlaySnapshot = resolveMapOwnedOverlayPaint(overlays.overlays, context.resolve);
      check();
      const hasResources = overlays.overlays.sources.length > 0 || overlays.overlays.layers.length > 0 || images.images.length > 0;
      const hasOverrides = overrides.length > 0;
      if (!hasResources && !hasOverrides && !this.hasResources && !this.hasOverrides) return;
      if (hasOverrides && !this.overrides) {
        // Basemap override ownership loads once an override is requested, before any native
        // mutation, so a slow or failed load never leaves resources applied without overrides.
        const runtime = loadMapStyleOverrideRuntime.loaded ?? await loadMapStyleOverrideRuntime();
        check();
        this.overrides ??= new runtime.MapStyleOverrides();
      }
      this.bind(map);
      imageUpdate = this.provider.beginOwnedUpdate(images.images.map(descriptor => descriptor.id));
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
        !Number.isFinite(decodedPixels) || decodedPixels < 0 || decodedPixels > MAP_IMAGE_LIMITS.totalPixels ||
        !imageUpdate.budget({ count: desired.size, encodedBytes, decodedPixels })) failed();
      check();
      const desiredImages = images.images.map(descriptor => desired.get(descriptor.id)!.image);
      const committed = this.committedResources;
      const unchanged = committed?.map === map && Object.is(committed.style, style) &&
        sameSnapshot(committed.overlays, overlaySnapshot) &&
        committed.images.length === desiredImages.length && committed.images.every((image, index) => image === desiredImages[index]) &&
        sameSnapshot(committed.layerIds, this.resourcePeer!.layerIds());
      check();
      if ((hasResources || this.hasResources) && !unchanged) {
        if (typeof map.getStyle !== 'function' || typeof map.moveLayer !== 'function') failed();
        if (images.images.length > 0 || this.cache.size > 0) {
          if (typeof map.hasImage !== 'function' || typeof map.addImage !== 'function' || typeof map.removeImage !== 'function') failed();
        }
        // An ID that `images` now owns replaces its lazily provided copy instead of colliding.
        imageUpdate.detach(); check();
        transferred = true; this.hasResources = true; this.committedResources = undefined;
        const result = await this.resources.reconcile(this.resourcePeer!, style, overlaySnapshot, desiredImages, {
            isCurrent: current,
            beforeMutation: () => { check(); imageUpdate!.beforeNativeMutation(); check(); },
            // Release the native lease before callback-queued work runs, not after this await.
            afterMutation: safeToRestore => { imageUpdate!.settleNative(safeToRestore); },
            beforeSourceChange: context.beforeSourceChange,
            prepare: async (requirements, signal) => {
              if (typeof map.prepareFeatures === 'function') await map.prepareFeatures(requirements, { signal });
            },
          });
        check();
        if (!result.ok) failed();
        const layerIds = this.resourcePeer!.layerIds(); check();
        this.cache = desired; this.hasResources = hasResources;
        imageUpdate.commit(); check();
        this.committedResources = { map, style, overlays: overlaySnapshot, images: desiredImages, layerIds };
      }
      if (hasOverrides || this.hasOverrides) {
        if (typeof map.getPaintProperty !== 'function' || typeof map.getLayoutProperty !== 'function' ||
          typeof map.setLayoutProperty !== 'function' || typeof map.triggerRepaint !== 'function') failed();
        // Created above for requested overrides; earlier overrides created it when they were applied.
        const owner = this.overrides;
        if (!owner) failed();
        this.overriding = true;
        const result = (() => {
          try {
            const targets = expandMapStyleOverrides(overrides, context.styleLayers?.() ?? []);
            if (!targets) failed();
            return owner.reconcile(this.overridePeer!, style, targets, {
              isOwned: id => this.resources.ownsLayer(id) || context.isGeneratedLayer(id),
              resolve: (value, detail) => context.resolve(value, detail.property),
            });
          } finally { this.overriding = false; }
        })();
        check();
        if (!result.accepted || result.diagnostics.some(entry => entry.code !== 'external-change' && entry.code !== 'missing-layer')) failed();
        this.hasOverrides = hasOverrides;
      }
    } catch (error) {
      if (!current() || error instanceof DOMException && error.name === 'AbortError') aborted();
      failed();
    } finally {
      const restorationFailed = imageUpdate?.rollback() === false && current();
      context.signal.removeEventListener('abort', cancel);
      if (!transferred) for (const image of created) image.dispose();
      if (this.abort === controller) this.abort = undefined;
      if (restorationFailed) failed();
    }
  }

  private bind(map: MapLibreMapCapability): void {
    if (this.peer === map) return;
    this.peer = map;
    // Optional setters are data methods, never native accessors with side effects. Capture their
    // receiver once so registry guards directly bracket the callback-capable invocation.
    const nativeMethod = (key: string): ((...args: unknown[]) => unknown) | undefined => {
      const descriptor = getInheritedPropertyDescriptor(map, key);
      return descriptor && Object.hasOwn(descriptor, 'value') && typeof descriptor.value === 'function'
        ? (...args) => Reflect.apply(descriptor.value as (...values: unknown[]) => unknown, map, args) : undefined;
    };
    const setPaintProperty = nativeMethod('setPaintProperty'), setLayoutProperty = nativeMethod('setLayoutProperty');
    const setFilter = nativeMethod('setFilter'), setLayerZoomRange = nativeMethod('setLayerZoomRange'), triggerRepaint = nativeMethod('triggerRepaint');
    this.resourcePeer = {
      getSource: id => map.getSource(id), getLayer: id => map.getLayer(id),
      layerIds: () => {
        const layers = map.getStyle!().layers;
        if (!Array.isArray(layers) || layers.length > 20_000) failed();
        return layers.map(layer => layer.id);
      },
      // Native sources may update their options; retain the immutable journal and opaque payload identities.
      addSource: (id, source) => map.addSource(id, { ...source }), removeSource: id => map.removeSource(id),
      planSourceUpdate: (id, previous, next, checkCurrent) => planMapSourceUpdate(map.getSource(id), previous, next, checkCurrent),
      addLayer: (layer, before) => map.addLayer(layer, before), removeLayer: id => map.removeLayer(id),
      moveLayer: (id, before) => map.moveLayer!(id, before),
      ...(setPaintProperty ? { setPaintProperty } : {}), ...(setLayoutProperty ? { setLayoutProperty } : {}),
      ...(setFilter ? { setFilter } : {}), ...(setLayerZoomRange ? { setLayerZoomRange } : {}),
      ...(triggerRepaint ? { triggerRepaint } : {}),
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
