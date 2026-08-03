import { LyraChart, lockChartType } from './chart.class.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_collapse, LYRA_DEFAULT_details, LYRA_DEFAULT_open } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END


/**
 * `<lr-bar-chart>` — `<lr-chart>` with `type` locked to `"bar"`.
 *
 * @customElement lr-bar-chart
 * @status stable
 * @since 4.0.0
 */
export class LyraBarChart extends LyraChart {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    collapse: LYRA_DEFAULT_collapse,
    details: LYRA_DEFAULT_details,
    open: LYRA_DEFAULT_open,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  declare type: 'bar';
}

lockChartType(LyraBarChart, 'bar');


declare global {
  interface HTMLElementTagNameMap {
    'lr-bar-chart': LyraBarChart;
  }
}

