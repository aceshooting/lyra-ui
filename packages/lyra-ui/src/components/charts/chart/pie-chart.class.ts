import { LyraChart, lockChartType } from './chart.class.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_collapse, LYRA_DEFAULT_details, LYRA_DEFAULT_open } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END


/**
 * `<lr-pie-chart>` — `<lr-chart>` with `type` locked to `"pie"`. Single-series:
 * one `Series` with `data: number[]` and `color: string[]` as the slice palette.
 *
 * @customElement lr-pie-chart
 * @status stable
 * @since 4.0.0
 */
export class LyraPieChart extends LyraChart {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    collapse: LYRA_DEFAULT_collapse,
    details: LYRA_DEFAULT_details,
    open: LYRA_DEFAULT_open,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  declare type: 'pie';
}

lockChartType(LyraPieChart, 'pie');


declare global {
  interface HTMLElementTagNameMap {
    'lr-pie-chart': LyraPieChart;
  }
}

