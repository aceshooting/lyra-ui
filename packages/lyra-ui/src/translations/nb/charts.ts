// The `charts` slice of the nb translation catalog for @aceshooting/lyra-ui: strings owned exclusively by `src/components/charts/**`.
// A side-effect-only module: a consumer writes a bare
// `import '@aceshooting/lyra-ui/translations/nb/charts';` and reads nothing from it. Keep the
// keys in DEFAULT_STRINGS order -- `scripts/check-translations.mjs` enforces coverage, order,
// placeholder names and the plural-category set for this slice, and a catalog that cannot be
// diffed against another line-for-line is a catalog nobody will review.
// Regenerate the SHAPE (never the translations) with:
//   node scripts/scaffold-translation.mjs nb --force
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
  chartTrendIncreasing: 'stigende',
  chartTrendDecreasing: 'synkende',
  chartTrendFlat: 'stabil',
  chartSummary: '{label}: {count} verdier, område {min} til {max}, {trend} trend',
  chartSeriesNoData: '{label}: ingen data',
  chartSummaryWithData: '{type}diagram. {summaries}.',
  chartSummaryEmpty: '{type}diagram uten data.',
  chartSummarySeparator: '. ',
  chartData: 'Diagramdata',
  chartDataSampled: 'Den genererte datatabellen viser et utvalg på opptil 1 000 poster. Oppgi en egendefinert datatabell for å få tilgang til alle diagramdataene.',
  chartZoomUnavailable: 'Zoom er ikke tilgjengelig, men selve diagrammet er fortsatt tilgjengelig.',
  chartDataLabelsUnavailable: 'Dataetiketter er ikke tilgjengelige, men selve diagrammet er fortsatt tilgjengelig.',
  chartStackTotalsUnavailable: 'Stabeltotaler er ikke tilgjengelige, men selve diagrammet er fortsatt tilgjengelig.',
  chartAnnotationsUnavailable: 'Diagrammerknader er ikke tilgjengelige, men selve diagrammet er fortsatt tilgjengelig.',
  chartTypeLine: 'Linje',
  chartTypeBar: 'Stolpe',
  chartTypeScatter: 'Punkt',
  chartTypePie: 'Sektor',
  chartTypeDoughnut: 'Smultring',
  chartTypeRadar: 'Radar',
  chartTypePolarArea: 'Polarområde',
  chartTypeBubble: 'Boble',
  boxPlotSeriesSummary: '{label}: {count} fordelinger, medianområde {min} til {max}, {trend} mediantrend',
  boxPlotSummaryWithData: 'Boksplott. {summaries}.',
  boxPlotSummaryEmpty: 'Boksplott uten data.',
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
  chartMissingLibrary: 'Denne komponenten krever at den valgfrie pakken «chart.js» er installert for å vise diagrammer.',
  boxPlotMissingLibrary: 'Denne komponenten krever at den valgfrie boksplottpakken er installert for å vise boksplott.',
};

registerLyraLocale('nb', strings);
