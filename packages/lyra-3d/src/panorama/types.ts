import type { Lyra3dEngine } from '../core/contract.js';

/** Caller-owned, already loaded media. The engine never loads a URL or controls playback. */
export type PanoramaSource =
  | { readonly kind: 'image'; readonly image: HTMLImageElement | HTMLCanvasElement | OffscreenCanvas | ImageBitmap }
  | { readonly kind: 'video'; readonly video: HTMLVideoElement };
export interface PanoramaData {
  /** At most 8192 pixels per axis and 33,554,432 pixels in total. */
  readonly source: PanoramaSource;
  /** Interleaved yaw/pitch radians, at most 10,000 hotspots; row order is the pick identity. */
  readonly hotspotAngles?: Float32Array;
  /** CSS-pixel diameters in [0, 256]. */
  readonly hotspotSizes?: Float32Array;
  readonly hotspotCategories?: Uint16Array;
}
export interface PanoramaCamera {
  /** Radians, positive toward image right. */
  readonly yaw: number;
  /** Radians, positive toward image top; constrained away from the poles. */
  readonly pitch: number;
  /** Vertical degrees in [20, 100]. */
  readonly fieldOfView: number;
}
export type PanoramaEngine = Lyra3dEngine<PanoramaData, PanoramaCamera>;
