import type { MapLibreMapCapability } from './map-loader.js';
import { mapOwnValue } from './map-readers.js';
import { loadMapImageRuntime } from './map-resource-feature-loaders.js';
import { MAP_IMAGE_MAX_DIMENSION } from './map-image-limits.js';
import { finiteRange } from '../../../internal/numbers.js';

/** Image admission accepts atlas pixel ratios up to 4. */
const MAX_THUMBNAIL_PIXEL_RATIO = 4;

export interface CanonicalPointImage {
  readonly field: string;
  readonly size: number;
  readonly shape: 'circle' | 'square';
  readonly border: string | undefined;
}

interface Thumbnail {
  readonly url: string;
  readonly id: string;
  readonly controller: AbortController;
  state: 'queued' | 'loading' | 'ready' | 'failed';
}
interface PhotoLayer {
  readonly source: string;
  readonly clustered: boolean;
  readonly options: CanonicalPointImage;
  readonly border: string | undefined;
  readonly thumbnails: Map<string, Thumbnail>;
}

/** Viewport-scoped thumbnails share a single atlas and transfer budget across all data layers.
 * Transfers are progressive decoration: they never hold map readiness, and a finished batch repaints. */
export class MapPointImages {
  private readonly layers = new Map<string, PhotoLayer>();
  private active = 0;
  private nextId = 0;

  constructor(private readonly owner: Element, private readonly map: MapLibreMapCapability,
    private readonly removeLayer: (id: string) => void) {}

  configure(source: string, clustered: boolean, options: CanonicalPointImage, border: string | undefined): boolean {
    const old = this.layers.get(source);
    if (old?.options.field === options.field && old.options.size === options.size &&
      old.options.shape === options.shape && old.border === border) return true;
    if (!this.map.addImage || !this.map.removeImage || !this.map.hasImage || !this.map.setLayoutProperty) return false;
    if (old) {
      this.layers.delete(source);
      this.map.setLayoutProperty(`${source}-point-image`, 'icon-image', undefined);
      for (const item of old.thumbnails.values()) this.release(item);
      old.thumbnails.clear();
    } else {
      const points = ['==', ['geometry-type'], 'Point'];
      this.map.addLayer({ id: `${source}-point-image`, type: 'symbol', source,
        filter: clustered ? ['all', points, ['!', ['has', 'point_count']]] : points,
        layout: { 'icon-allow-overlap': true, 'icon-ignore-placement': true } });
    }
    this.layers.set(source, { source, clustered, options, border, thumbnails: new Map() });
    return true;
  }

  remove(source: string): void {
    const layer = this.layers.get(source);
    if (!layer) return;
    this.layers.delete(source);
    if (this.map.getLayer(`${source}-point-image`)) this.removeLayer(`${source}-point-image`);
    for (const item of layer.thumbnails.values()) this.release(item);
    layer.thumbnails.clear();
  }

  clear(): void {
    for (const source of this.layers.keys()) this.remove(source);
  }

  private release(item: Thumbnail): void {
    item.controller.abort();
    if (item.state === 'ready' && this.map.hasImage?.(item.id)) this.map.removeImage?.(item.id);
  }

  refresh(): void {
    let remaining = 128;
    for (const layer of this.layers.values()) {
      const wanted = new Set<string>();
      const features = remaining ? this.map.queryRenderedFeatures(undefined, { layers: [`${layer.source}-circle`] }) : [];
      for (const feature of features) {
        const properties = mapOwnValue(feature, 'properties');
        const url = mapOwnValue(properties, layer.options.field);
        if (typeof url !== 'string' || !url.trim() || url.length > 4096 ||
          (layer.clustered && mapOwnValue(properties, 'point_count') !== undefined)) continue;
        wanted.add(url);
        if (wanted.size >= remaining) break;
      }
      remaining -= wanted.size;
      let changed = false;
      for (const [url, item] of layer.thumbnails) {
        if (wanted.has(url)) continue;
        layer.thumbnails.delete(url);
        if (item.state === 'ready') changed = true;
        this.release(item);
      }
      if (changed) this.paint(layer);
      for (const url of wanted) {
        if (layer.thumbnails.has(url)) continue;
        let id: string;
        do { id = `lr-point-photo-${this.nextId++}`; } while (this.map.hasImage?.(id));
        layer.thumbnails.set(url, { url, id, state: 'queued', controller: new AbortController() });
      }
    }
    this.pump();
  }

  private pump(): void {
    for (const layer of this.layers.values()) {
      for (const item of layer.thumbnails.values()) {
        if (this.active >= 4) return;
        if (item.state !== 'queued') continue;
        item.state = 'loading';
        this.active++;
        void this.load(layer, item).catch(() => {
          if (item.state === 'ready') this.release(item);
          item.state = 'failed';
        }).finally(() => {
          this.active--;
          this.pump();
          if (!this.active && this.layers.size) this.map.triggerRepaint?.();
        }).catch(() => { /* A peer failure while scheduling keeps the fallback circles. */ });
      }
    }
  }

  private async load(layer: PhotoLayer, item: Thumbnail): Promise<void> {
    const current = (): boolean => this.owner.isConnected && !item.controller.signal.aborted &&
      this.layers.get(layer.source) === layer && layer.thumbnails.get(item.url) === item;
    const runtime = await loadMapImageRuntime();
    if (!current()) return;
    const size = layer.options.size;
    // Rasterize for the display density so thumbnails stay sharp on high-density screens.
    const density = finiteRange(this.owner.ownerDocument.defaultView?.devicePixelRatio ?? 1, 1, 1, MAX_THUMBNAIL_PIXEL_RATIO);
    const backing = Math.min(MAP_IMAGE_MAX_DIMENSION, Math.round(size * density));
    const pixelRatio = backing / size;
    const result = await runtime.prepareMapImages([{ id: item.id, source: { kind: 'url', url: item.url },
      width: backing, height: backing, pixelRatio }], { owner: this.owner, signal: item.controller.signal,
      fetchController: item.controller, isCurrent: current, thumbnail: { shape: layer.options.shape, border: layer.border } });
    if (!result.ok) { item.state = 'failed'; return; }
    try {
      const pixels = result.images[0]?.image;
      if (!pixels || !current() || this.map.hasImage?.(item.id)) return;
      // A peer can throw or retire the layer synchronously after installing the pixels.
      item.state = 'ready';
      this.map.addImage!(item.id, pixels, { pixelRatio });
      if (current()) this.paint(layer);
      else this.release(item);
    } finally { result.dispose(); }
  }

  private paint(layer: PhotoLayer): void {
    const pairs = [...layer.thumbnails.values()].filter(item => item.state === 'ready').flatMap(item => [item.url, item.id]);
    this.map.setLayoutProperty!(`${layer.source}-point-image`, 'icon-image',
      pairs.length ? ['match', ['get', layer.options.field], ...pairs, ''] : undefined);
  }
}
