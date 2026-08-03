import { LyraChart, lockChartType } from './chart.class.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_collapse, LYRA_DEFAULT_details, LYRA_DEFAULT_open } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END


/**
 * `<lr-scatter-chart>` — `<lr-chart>` with `type` locked to `"scatter"`. Feed
 * points via `Series.points`.
 *
 * @customElement lr-scatter-chart
 * @status stable
 * @since 4.0.0
 */
export class LyraScatterChart extends LyraChart {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    collapse: LYRA_DEFAULT_collapse,
    details: LYRA_DEFAULT_details,
    open: LYRA_DEFAULT_open,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  declare type: 'scatter';
}

lockChartType(LyraScatterChart, 'scatter');


declare global {
  interface HTMLElementTagNameMap {
    'lr-scatter-chart': LyraScatterChart;
  }
}

