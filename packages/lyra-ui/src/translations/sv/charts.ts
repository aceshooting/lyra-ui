// The `charts` slice of the sv translation catalog for @aceshooting/lyra-ui: strings owned exclusively by `src/components/charts/**`.
// A side-effect-only module: a consumer writes a bare
// `import '@aceshooting/lyra-ui/translations/sv/charts';` and reads nothing from it. Keep the
// keys in DEFAULT_STRINGS order -- `scripts/check-translations.mjs` enforces coverage, order,
// placeholder names and the plural-category set for this slice, and a catalog that cannot be
// diffed against another line-for-line is a catalog nobody will review.
// Regenerate the SHAPE (never the translations) with:
//   node scripts/scaffold-translation.mjs sv --force
import { registerLyraLocale } from '../../internal/localization-runtime.js';
import type { LyraLocaleStrings } from '../../internal/localization.js';

const strings: LyraLocaleStrings = {
  chartCategory: 'Kategori',
  chartTotal: 'Totalt',
  chartAxisTotal: '{axis} totalt',
  chartPrimaryAxis: 'Primär axel',
  chartSecondaryAxis: 'Sekundär axel',
  chartPointLabel: 'Punkt {n}',
  chartPointCoordinates: 'x {x}, y {y}',
  chartBubblePointCoordinates: 'x {x}, y {y}, radie {radius}',
  chartLabeledPoint: '{label}: {coordinates}',
  chartTrendIncreasing: 'stigande',
  chartTrendDecreasing: 'fallande',
  chartTrendFlat: 'oförändrad',
  chartSummary: '{label}: {count} värden, intervall {min} till {max}, trend {trend}',
  chartSeriesNoData: '{label}: inga data',
  chartSummaryWithData: '{type}diagram. {summaries}.',
  chartSummaryEmpty: '{type}diagram utan data.',
  chartSummarySeparator: '. ',
  chartData: 'Diagramdata',
  chartDataSampled: 'Den genererade datatabellen visar ett urval på högst 1 000 poster. Ange en egen datatabell för att komma åt alla diagramdata.',
  chartZoomUnavailable: 'Zoom är inte tillgänglig, men själva diagrammet är fortfarande tillgängligt.',
  chartDataLabelsUnavailable: 'Dataetiketter är inte tillgängliga, men själva diagrammet är fortfarande tillgängligt.',
  chartStackTotalsUnavailable: 'Staplade summor är inte tillgängliga, men själva diagrammet är fortfarande tillgängligt.',
  chartAnnotationsUnavailable: 'Diagramanteckningar är inte tillgängliga, men själva diagrammet är fortfarande tillgängligt.',
  chartTypeLine: 'Linje',
  chartTypeBar: 'Stapel',
  chartTypeScatter: 'Punkt',
  chartTypePie: 'Cirkel',
  chartTypeDoughnut: 'Ring',
  chartTypeRadar: 'Radar',
  chartTypePolarArea: 'Polärområdes',
  chartTypeBubble: 'Bubbel',
  boxPlotSeriesSummary: '{label}: {count} fördelningar, medianintervall {min} till {max}, mediantrend {trend}',
  boxPlotSummaryWithData: 'Lådagram. {summaries}.',
  boxPlotSummaryEmpty: 'Lådagram utan data.',
  boxPlotData: 'Lådagramsdata',
  chartSeriesLabel: 'Serie',
  boxPlotMin: 'Min',
  boxPlotQ1: 'K1',
  boxPlotMedian: 'Median',
  boxPlotQ3: 'K3',
  boxPlotMax: 'Max',
  boxPlot: 'Lådagram',
  histogramFrequency: 'Frekvens',
  liteChartMarkSummary: '{series}, {label}: {value} ({index} av {total})',
  liteChartBarLabel: '{series}, {label}: {value}',
  chartValuePercentageLabel: '{label}: {value} ({percentage})',
  liteChartCustomMarkSummary: '{content} ({index} av {total})',
  chartMissingLibrary: 'Den här komponenten behöver det valfria paketet ”chart.js” för att kunna rita diagram.',
  boxPlotMissingLibrary: 'Den här komponenten behöver det valfria lådagramspaketet för att kunna rita lådagram.',
};

registerLyraLocale('sv', strings);
