import { LyraChart, lockChartType } from './chart.class.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_collapse, LYRA_DEFAULT_details, LYRA_DEFAULT_open } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END


/**
 * `<lr-line-chart>` — `<lr-chart>` with `type` locked to `"line"`.
 *
 * @customElement lr-line-chart
 * @status stable
 * @since 4.0.0
 */
export class LyraLineChart extends LyraChart {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    collapse: LYRA_DEFAULT_collapse,
    details: LYRA_DEFAULT_details,
    open: LYRA_DEFAULT_open,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  declare type: 'line';
}

lockChartType(LyraLineChart, 'line');


declare global {
  interface HTMLElementTagNameMap {
    'lr-line-chart': LyraLineChart;
  }
}

