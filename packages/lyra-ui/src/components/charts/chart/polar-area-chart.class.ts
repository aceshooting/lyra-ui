import { LyraChart, lockChartType } from './chart.class.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_collapse, LYRA_DEFAULT_details, LYRA_DEFAULT_open } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END


/**
 * `<lr-polar-area-chart>` — `<lr-chart>` with `type` locked to `"polarArea"`.
 *
 * @customElement lr-polar-area-chart
 * @status stable
 * @since 4.0.0
 */
export class LyraPolarAreaChart extends LyraChart {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    collapse: LYRA_DEFAULT_collapse,
    details: LYRA_DEFAULT_details,
    open: LYRA_DEFAULT_open,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  declare type: 'polarArea';
}

lockChartType(LyraPolarAreaChart, 'polarArea');


declare global {
  interface HTMLElementTagNameMap {
    'lr-polar-area-chart': LyraPolarAreaChart;
  }
}

