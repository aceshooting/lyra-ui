import type * as MaplibreModule from 'maplibre-gl';

let maplibre: Promise<typeof MaplibreModule | null> | undefined;

/**
 * Lazily loads the optional peer dependency `maplibre-gl` once per page.
 * Resolves to `null` (with a one-time warning) if it isn't installed —
 * mirrors `<lyra-flag>`'s peer-dependency pattern. Consumers must separately
 * import `maplibre-gl/dist/maplibre-gl.css` once they install the peer.
 */
export function loadMaplibre(): Promise<typeof MaplibreModule | null> {
  if (!maplibre) {
    maplibre = import('maplibre-gl').catch(() => {
      console.warn(
        '<lyra-map> needs the optional peer dependency `maplibre-gl` — install it with ' +
          '`pnpm add maplibre-gl` and import `maplibre-gl/dist/maplibre-gl.css` once in your app.',
      );
      return null;
    });
  }
  return maplibre;
}
