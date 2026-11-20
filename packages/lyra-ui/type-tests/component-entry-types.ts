// A granular component entry exports the named support types its own public signatures use, so a
// consumer of that entry can annotate a value without a deep import.
import type {
  LyraAccordion,
  LyraAccordionAppearance,
  LyraAccordionHeadingLevel,
  LyraAccordionIconPlacement,
} from '../src/components/lr-accordion.js';
import type {
  LyraAccordionItem,
  LyraAccordionAppearance as ItemAppearance,
} from '../src/components/lr-accordion-item.js';
import type { LyraBoxPlot, LyraChartFormatter, LyraChartValueFormatter } from '../src/components/lr-box-plot.js';
import type { LyraChartChromeLegendPosition, LyraLiteChart } from '../src/components/lr-lite-chart.js';
import type { LyraChartType, LyraLineChart } from '../src/components/lr-line-chart.js';
import type { LyraMapAnchor, LyraMapAnchorBoundary, LyraMapAnchorSafeArea } from '../src/components/lr-map-anchor.js';
import type { Engine3dPreference, LyraVideo } from '../src/components/lr-video.js';
import type { LyraAnchorKind, LyraAvPlayer } from '../src/components/lr-av-player.js';

declare const accordion: LyraAccordion;
declare const item: LyraAccordionItem;
declare const boxPlot: LyraBoxPlot;
declare const liteChart: LyraLiteChart;
declare const lineChart: LyraLineChart;
declare const mapAnchor: LyraMapAnchor;
declare const video: LyraVideo;
declare const player: LyraAvPlayer;

export const appearance: LyraAccordionAppearance = accordion.appearance;
export const headingLevel: LyraAccordionHeadingLevel = accordion.headingLevel;
export const iconPlacement: LyraAccordionIconPlacement = accordion.iconPlacement;
export const itemAppearance: ItemAppearance = item.appearance;
export const formatter: LyraChartFormatter | undefined = boxPlot.formatter;
export const valueFormatter: LyraChartValueFormatter | undefined = boxPlot.valueFormatter;
export const legendPosition: LyraChartChromeLegendPosition = liteChart.legendPosition;
export const chartType: LyraChartType = lineChart.type;
export const boundary: LyraMapAnchorBoundary | undefined = mapAnchor.boundary;
export const safeArea: LyraMapAnchorSafeArea | undefined = mapAnchor.safeArea;
export const engine: Engine3dPreference = video.engine;
export const anchorKinds: readonly LyraAnchorKind[] = player.anchorKinds;
