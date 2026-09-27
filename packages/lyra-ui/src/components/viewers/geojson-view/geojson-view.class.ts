import {
  LyraGeoJsonViewer,
  type LyraGeoJsonViewerEventMap,
} from './geojson-viewer.class.js';
import { warnDeprecatedUsage } from '../../../internal/dev-mode-attribute-warning.js';
import { tag } from '../../../internal/prefix.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_anchorJumped, LYRA_DEFAULT_anchorJumpedToPage, LYRA_DEFAULT_anchorNotFound } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END


export {
  type GeoJsonTypeTag,
  LyraGeoJsonViewer,
  type LyraGeoJsonViewerEventMap,
} from './geojson-viewer.class.js';

/**
 * Event contract retained by the deprecated `lr-geojson-view` compatibility tag.
 *
 * @deprecated Use `LyraGeoJsonViewerEventMap`; removal not before 23.0.0.
 */
export type LyraGeojsonViewEventMap = LyraGeoJsonViewerEventMap;

/**
 * Deprecated compatibility class for the pre-v9 `lr-geojson-view` tag.
 *
 * Use `LyraGeoJsonViewer` and `<lr-geojson-viewer>` instead, registered by importing
 * `components/lr-geojson-viewer.js`. This alias keeps working unchanged, with the same
 * attributes, events and document-registry contract, until a major release no earlier than 23.0.0
 * removes it; connecting one logs a one-time development warning. It remains a distinct subclass
 * so `instanceof LyraGeoJsonViewer` holds and both tag names share one custom-elements registry.
 *
 * @customElement lr-geojson-view
 * @deprecated Use `<lr-geojson-viewer>` (`LyraGeoJsonViewer`); removal not before 23.0.0.
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

  override connectedCallback(): void {
    super.connectedCallback();
    // Connecting is the exact usage signal: importing the route (which also registers the
    // canonical tag) or creating an element that never connects stays silent.
    warnDeprecatedUsage(this, 'component', tag('geojson-view'), `<${tag('geojson-viewer')}>`);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-geojson-view': LyraGeojsonView;
  }
}
