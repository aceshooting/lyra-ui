import { LyraChart, lockChartType } from './chart.class.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_collapse, LYRA_DEFAULT_details, LYRA_DEFAULT_open } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END


/**
 * `<lr-bubble-chart>` — `<lr-chart>` with `type` locked to `"bubble"`. Feed
 * points via `Series.points`, whose exported `ChartPoint` type carries
 * `x`/`y`, optional bubble `r` (radius), and an optional per-point `label`.
 *
 * @customElement lr-bubble-chart
 * @status stable
 * @since 4.0.0
 */
export class LyraBubbleChart extends LyraChart {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    collapse: LYRA_DEFAULT_collapse,
    details: LYRA_DEFAULT_details,
    open: LYRA_DEFAULT_open,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  declare type: 'bubble';
}

lockChartType(LyraBubbleChart, 'bubble');


declare global {
  interface HTMLElementTagNameMap {
    'lr-bubble-chart': LyraBubbleChart;
  }
}
