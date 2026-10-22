import { admitMapImages } from './map-image-admission.js';
import { admitMapOverlays } from './map-overlay-admission.js';
import { projectMapStyleOverrides } from './map-style-override-admission.js';

export interface MapOwnedFeatureInput {
  readonly overlays: unknown;
  readonly images: unknown;
  readonly styleOverrides: unknown;
}

export function failMapResources(): never {
  const error = new Error('Map resources could not be restored.'); error.name = 'MapResourceError'; throw error;
}

/** Capture component assignments before any unrelated feature preparation can yield. */
export function snapshotMapOwnedFeatureInput(input: MapOwnedFeatureInput): MapOwnedFeatureInput {
  const overlays = admitMapOverlays(input.overlays);
  const images = admitMapImages(input.images);
  const overrides = projectMapStyleOverrides(input.styleOverrides);
  if (!overlays.ok || !images.ok || !overrides) failMapResources();
  return Object.freeze({ overlays: overlays.overlays, images: images.images, styleOverrides: overrides });
}
