// The `charts` slice of the da translation catalog for @aceshooting/lyra-ui: strings owned exclusively by `src/components/charts/**`.
// A side-effect-only module: a consumer writes a bare
// `import '@aceshooting/lyra-ui/translations/da/charts';` and reads nothing from it. Keep the
// keys in DEFAULT_STRINGS order -- `scripts/check-translations.mjs` enforces coverage, order,
// placeholder names and the plural-category set for this slice, and a catalog that cannot be
// diffed against another line-for-line is a catalog nobody will review.
// Regenerate the SHAPE (never the translations) with:
//   node scripts/scaffold-translation.mjs da --force
import { registerLyraLocale } from '../../internal/localization-runtime.js';
import type { LyraLocaleStrings } from '../../internal/localization.js';

const strings: LyraLocaleStrings = {
  chartCategory: 'Kategori',
  chartTotal: 'I alt',
  chartAxisTotal: '{axis} i alt',
  chartPrimaryAxis: 'Primær akse',
  chartSecondaryAxis: 'Sekundær akse',
  chartPointLabel: 'Punkt {n}',
  chartPointCoordinates: 'x {x}, y {y}',
  chartBubblePointCoordinates: 'x {x}, y {y}, radius {radius}',
  chartLabeledPoint: '{label}: {coordinates}',
  chartTrendIncreasing: 'stigende',
  chartTrendDecreasing: 'faldende',
  chartTrendFlat: 'uændret',
  chartSummary: '{label}: {count} værdier, interval {min} til {max}, {trend} tendens',
  chartSeriesNoData: '{label}: ingen data',
  chartSummaryWithData: '{type}diagram. {summaries}.',
  chartSummaryEmpty: '{type}diagram uden data.',
  chartSummarySeparator: '. ',
  chartData: 'Diagramdata',
  chartDataSampled: 'Den genererede datatabel viser et udsnit på op til 1.000 poster. Angiv en brugerdefineret datatabel for at få adgang til alle diagrammets data.',
  chartZoomUnavailable: 'Zoom er ikke tilgængelig, men selve diagrammet er stadig tilgængeligt.',
  chartDataLabelsUnavailable: 'Dataetiketter er ikke tilgængelige, men selve diagrammet er stadig tilgængeligt.',
  chartStackTotalsUnavailable: 'Stakketotaler er ikke tilgængelige, men selve diagrammet er stadig tilgængeligt.',
  chartAnnotationsUnavailable: 'Diagramanmærkninger er ikke tilgængelige, men selve diagrammet er stadig tilgængeligt.',
  chartTypeLine: 'Kurve',
  chartTypeBar: 'Søjle',
  chartTypeScatter: 'Punkt',
  chartTypePie: 'Cirkel',
  chartTypeDoughnut: 'Kranse',
  chartTypeRadar: 'Radar',
  chartTypePolarArea: 'Polarområde',
  chartTypeBubble: 'Boble',
  boxPlotSeriesSummary: '{label}: {count} fordelinger, medianinterval {min} til {max}, {trend} mediantendens',
  boxPlotSummaryWithData: 'Boksplot. {summaries}.',
  boxPlotSummaryEmpty: 'Boksplot uden data.',
  boxPlotData: 'Boksplotdata',
  chartSeriesLabel: 'Serie',
  boxPlotMin: 'Min.',
  boxPlotQ1: 'K1',
  boxPlotMedian: 'Median',
  boxPlotQ3: 'K3',
  boxPlotMax: 'Maks.',
  boxPlot: 'Boksplot',
  histogramFrequency: 'Hyppighed',
  liteChartMarkSummary: '{series}, {label}: {value} ({index} af {total})',
  liteChartBarLabel: '{series}, {label}: {value}',
  chartValuePercentageLabel: '{label}: {value} ({percentage})',
  liteChartCustomMarkSummary: '{content} ({index} af {total})',
  chartMissingLibrary: 'Denne komponent kræver, at den valgfrie pakke "chart.js" er installeret, for at kunne vise diagrammer.',
  boxPlotMissingLibrary: 'Denne komponent kræver, at den valgfrie boksplotpakke er installeret, for at kunne vise boksplot.',
};

registerLyraLocale('da', strings);
