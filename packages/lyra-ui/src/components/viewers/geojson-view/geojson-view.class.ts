import { LyraGeoJsonViewer } from './geojson-viewer.class.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_anchorJumped, LYRA_DEFAULT_anchorJumpedToPage, LYRA_DEFAULT_anchorNotFound } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END


/**
 * Compatibility constructor retained by the root and viewers family barrels.
 * It is a distinct subclass of `LyraGeoJsonViewer` and does not register a custom element.
 * Use `LyraGeoJsonViewer` and the `lr-geojson-viewer` registration for new elements.
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
