import type { OptionalPeerApi } from '../../../internal/optional-peer-types.js';

type MaplibreModule = OptionalPeerApi;
let maplibre: Promise<MaplibreModule | null> | undefined;

/**
 * Lazily loads the optional peer dependency `maplibre-gl` once per page.
 * Resolves to `null` (with a one-time warning) if it isn't installed —
 * mirrors `<lr-flag>`'s peer-dependency pattern. Consumers must separately
 * import `maplibre-gl/dist/maplibre-gl.css` and configure MapLibre v6's
 * module-worker URL for their bundler once they install the peer.
 */
export function loadMaplibre(): Promise<MaplibreModule | null> {
  if (!maplibre) {
    maplibre = (import('maplibre-gl') as Promise<MaplibreModule>).catch(() => {
      console.warn(
        '<lr-map> needs the optional peer dependency `maplibre-gl` — install it with ' +
          '`pnpm add maplibre-gl` and import `maplibre-gl/dist/maplibre-gl.css` once in your app.',
      );
      return null;
    });
  }
  return maplibre;
}
