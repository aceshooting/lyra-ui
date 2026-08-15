import {
  LyraGeoJsonViewer,
  type LyraGeoJsonViewerEventMap,
} from './geojson-viewer.class.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_anchorJumped, LYRA_DEFAULT_anchorJumpedToPage, LYRA_DEFAULT_anchorNotFound } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END


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
export class LyraGeojsonView extends LyraGeoJsonViewer {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    anchorJumped: LYRA_DEFAULT_anchorJumped,
    anchorJumpedToPage: LYRA_DEFAULT_anchorJumpedToPage,
    anchorNotFound: LYRA_DEFAULT_anchorNotFound,
  };
  // GENERATED DEFAULT-STRING SLICE: END
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-geojson-view': LyraGeojsonView;
  }
}
