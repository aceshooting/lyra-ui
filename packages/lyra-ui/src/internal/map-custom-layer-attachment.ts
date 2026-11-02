import type { LyraMapPosition } from '../components/media/map/map-scene-types.js';

/** Native map lifecycle notifications for one custom layer. */
export interface MapCustomLayerCallbacks {
  /** A style finished loading on `map`, the first one or a replacement. */
  styleReady(map: object): void;
  /** The current style is about to be replaced. */
  styleInvalidated(): void;
  /** The native map was removed; a later `styleReady` may bring a new one. */
  mapRemoved(): void;
  /** The element disconnected; the lease is over. */
  released(): void;
}
export interface MapCustomLayerActivation {
  readonly id: string;
  readonly layerId: string;
  readonly position?: LyraMapPosition;
}
export interface MapCustomLayerLease {
  /** The native map while its style is loaded. */
  nativeMap(): object | undefined;
  reducedMotion(): boolean;
  /** Emits `lr-map-scene-activate` once per native pointer event. */
  activate(detail: MapCustomLayerActivation, event: object): void;
  release(): void;
}
export interface MapCustomLayerAttachment {
  acquire(callbacks: MapCustomLayerCallbacks): MapCustomLayerLease;
}

const attachments = new WeakMap<HTMLElement, MapCustomLayerAttachment>();

/** Registers an instance capability without importing its component or any optional engine. */
export function registerMapCustomLayers(host: HTMLElement, attachment: MapCustomLayerAttachment): () => void {
  attachments.set(host, attachment);
  return () => { if (attachments.get(host) === attachment) attachments.delete(host); };
}
export function mapCustomLayerAttachment(host: HTMLElement): MapCustomLayerAttachment | undefined {
  return attachments.get(host);
}
