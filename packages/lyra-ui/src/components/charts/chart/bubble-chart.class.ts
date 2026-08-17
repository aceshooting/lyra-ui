import { LyraChart, type LyraChartType } from './chart.class.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_collapse, LYRA_DEFAULT_details, LYRA_DEFAULT_map, LYRA_DEFAULT_navigation, LYRA_DEFAULT_open, LYRA_DEFAULT_popover, LYRA_DEFAULT_progress, LYRA_DEFAULT_search, LYRA_DEFAULT_select } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END


/**
 * `<lr-bubble-chart>` — `<lr-chart>` with a `"bubble"` default and the mirrored writable type. Feed
 * points via `LyraChartSeries.points`, whose exported `LyraChartPoint` type carries
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
    map: LYRA_DEFAULT_map,
    navigation: LYRA_DEFAULT_navigation,
    open: LYRA_DEFAULT_open,
    popover: LYRA_DEFAULT_popover,
    progress: LYRA_DEFAULT_progress,
    search: LYRA_DEFAULT_search,
    select: LYRA_DEFAULT_select,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  override type: LyraChartType = 'bubble';
}


declare global {
  interface HTMLElementTagNameMap {
    'lr-bubble-chart': LyraBubbleChart;
  }
}
