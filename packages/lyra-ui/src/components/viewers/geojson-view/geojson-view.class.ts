import { LyraGeoJsonViewer } from './geojson-viewer.class.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_anchorJumped, LYRA_DEFAULT_anchorJumpedToPage, LYRA_DEFAULT_anchorNotFound } from '../../../internal/default-strings/shared.generated.js';
import { LYRA_DEFAULT_documentPreviewFailedToLoad, LYRA_DEFAULT_documentPreviewResourceTooLarge } from '../../../internal/default-strings/viewers.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END


/**
 * Subclass exported by the viewers family barrel only (not the root barrel).
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
    documentPreviewFailedToLoad: LYRA_DEFAULT_documentPreviewFailedToLoad,
    documentPreviewResourceTooLarge: LYRA_DEFAULT_documentPreviewResourceTooLarge,
  };
  // GENERATED DEFAULT-STRING SLICE: END
}
