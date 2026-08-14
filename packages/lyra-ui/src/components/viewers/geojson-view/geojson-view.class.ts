import {
  LyraGeoJsonViewer,
  type LyraGeoJsonViewerEventMap,
} from './geojson-viewer.class.js';

export {
  type GeoJsonTypeTag,
  LyraGeoJsonViewer,
  type LyraGeoJsonViewerEventMap,
} from './geojson-viewer.class.js';

/** Event contract retained by the `lr-geojson-view` compatibility tag. */
export type LyraGeojsonViewEventMap = LyraGeoJsonViewerEventMap;

/**
 * Permanent compatibility class for the pre-v9 `lr-geojson-view` tag.
 *
 * Use `LyraGeoJsonViewer` and `lr-geojson-viewer` for new code. This distinct subclass preserves
 * `instanceof LyraGeoJsonViewer` while allowing both tag names in one custom-elements registry.
 *
 * @customElement lr-geojson-view
 * @status stable
 * @since 4.0.0
 */
export class LyraGeojsonView extends LyraGeoJsonViewer {}

declare global {
  interface HTMLElementTagNameMap {
    'lr-geojson-view': LyraGeojsonView;
  }
}
