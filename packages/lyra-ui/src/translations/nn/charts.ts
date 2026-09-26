// The `charts` slice of the nn translation catalog for @aceshooting/lyra-ui: strings owned exclusively by `src/components/charts/**`.
// A side-effect-only module: a consumer writes a bare
// `import '@aceshooting/lyra-ui/translations/nn/charts';` and reads nothing from it. Keep the
// keys in DEFAULT_STRINGS order -- `scripts/check-translations.mjs` enforces coverage, order,
// placeholder names and the plural-category set for this slice, and a catalog that cannot be
// diffed against another line-for-line is a catalog nobody will review.
// Regenerate the SHAPE (never the translations) with:
//   node scripts/scaffold-translation.mjs nn --force
import { registerLyraLocale } from '../../internal/localization-runtime.js';
import type { LyraLocaleStrings } from '../../internal/localization.js';

const strings: LyraLocaleStrings = {
  chartCategory: 'Kategori',
  chartTotal: 'Totalt',
  chartAxisTotal: '{axis} totalt',
  chartPrimaryAxis: 'Primærakse',
  chartSecondaryAxis: 'Sekundærakse',
  chartPointLabel: 'Punkt {n}',
  chartPointCoordinates: 'x {x}, y {y}',
  chartBubblePointCoordinates: 'x {x}, y {y}, radius {radius}',
  chartLabeledPoint: '{label}: {coordinates}',
  chartTrendIncreasing: 'stigande',
  chartTrendDecreasing: 'fallande',
  chartTrendFlat: 'flat',
  chartSummary: '{label}: {count} verdiar, område {min} til {max}, trend: {trend}',
  chartSeriesNoData: '{label}: ingen data',
  chartSummaryWithData: '{type}diagram. {summaries}.',
  chartSummaryEmpty: '{type}diagram utan data.',
  chartSummarySeparator: '. ',
  chartData: 'Diagramdata',
  chartDataSampled: 'Den genererte datatabellen viser eit utval på opptil 1 000 postar. Legg ved ein eigen datatabell for å få tilgang til alle diagramdata.',
  chartZoomUnavailable: 'Zoom er ikkje tilgjengeleg, men sjølve diagrammet er framleis tilgjengeleg.',
  chartDataLabelsUnavailable: 'Dataetikettar er ikkje tilgjengelege, men sjølve diagrammet er framleis tilgjengeleg.',
  chartStackTotalsUnavailable: 'Summar for stablar er ikkje tilgjengelege, men sjølve diagrammet er framleis tilgjengeleg.',
  chartAnnotationsUnavailable: 'Diagrammerknader er ikkje tilgjengelege, men sjølve diagrammet er framleis tilgjengeleg.',
  chartTypeLine: 'Linje',
  chartTypeBar: 'Stolpe',
  chartTypeScatter: 'Punkt',
  chartTypePie: 'Kake',
  chartTypeDoughnut: 'Smultring',
  chartTypeRadar: 'Radar',
  chartTypePolarArea: 'Polarområde',
  chartTypeBubble: 'Boble',
  boxPlotSeriesSummary: '{label}: {count} fordelingar, medianområde {min} til {max}, mediantrend: {trend}',
  boxPlotSummaryWithData: 'Boksplott. {summaries}.',
  boxPlotSummaryEmpty: 'Boksplott utan data.',
  boxPlotData: 'Boksplottdata',
  chartSeriesLabel: 'Serie',
  boxPlotMin: 'Min.',
  boxPlotQ1: 'Q1',
  boxPlotMedian: 'Median',
  boxPlotQ3: 'Q3',
  boxPlotMax: 'Maks.',
  boxPlot: 'Boksplott',
  histogramFrequency: 'Frekvens',
  liteChartMarkSummary: '{series}, {label}: {value} ({index} av {total})',
  liteChartBarLabel: '{series}, {label}: {value}',
  chartValuePercentageLabel: '{label}: {value} ({percentage})',
  liteChartCustomMarkSummary: '{content} ({index} av {total})',
  chartMissingLibrary: 'Denne komponenten treng den valfrie pakken «chart.js» for å teikne diagram.',
  boxPlotMissingLibrary: 'Denne komponenten treng den valfrie diagrampakken for boksplott for å teikne boksplott.',
};

registerLyraLocale('nn', strings);
