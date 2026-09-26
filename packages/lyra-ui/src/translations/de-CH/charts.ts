// The `charts` slice of the de-CH translation catalog for @aceshooting/lyra-ui: strings owned exclusively by `src/components/charts/**`.
// A side-effect-only module: a consumer writes a bare
// `import '@aceshooting/lyra-ui/translations/de-CH/charts';` and reads nothing from it. Keep the
// keys in DEFAULT_STRINGS order -- `scripts/check-translations.mjs` enforces coverage, order,
// placeholder names and the plural-category set for this slice, and a catalog that cannot be
// diffed against another line-for-line is a catalog nobody will review.
// Regenerate the SHAPE (never the translations) with:
//   node scripts/scaffold-translation.mjs de-CH --force
import { registerLyraLocale } from '../../internal/localization-runtime.js';
import type { LyraLocaleStrings } from '../../internal/localization.js';

const strings: LyraLocaleStrings = {
  chartCategory: 'Kategorie',
  chartTotal: 'Gesamt',
  chartAxisTotal: '{axis} gesamt',
  chartPrimaryAxis: 'Primärachse',
  chartSecondaryAxis: 'Sekundärachse',
  chartPointLabel: 'Punkt {n}',
  chartPointCoordinates: 'x: {x}, y: {y}',
  chartBubblePointCoordinates: 'x: {x}, y: {y}, Radius: {radius}',
  chartLabeledPoint: '{label} – {coordinates}',
  chartTrendIncreasing: 'steigend',
  chartTrendDecreasing: 'fallend',
  chartTrendFlat: 'gleichbleibend',
  chartSummary: '{label}: {count} Werte, Bereich {min} bis {max}, Trend {trend}',
  chartSeriesNoData: '{label}: keine Daten',
  chartSummaryWithData: '{type}-Diagramm. {summaries}.',
  chartSummaryEmpty: '{type}-Diagramm ohne Daten.',
  chartSummarySeparator: '. ',
  chartData: 'Diagrammdaten',
  chartDataSampled: 'Die generierte Datentabelle zeigt eine Stichprobe von bis zu 1.000 Datensätzen. Stellen Sie eine eigene Datentabelle bereit, um auf alle Diagrammdaten zuzugreifen.',
  chartZoomUnavailable: 'Die Zoomfunktion ist nicht verfügbar, aber das Diagramm bleibt verfügbar.',
  chartDataLabelsUnavailable: 'Datenbeschriftungen sind nicht verfügbar, aber das Diagramm bleibt verfügbar.',
  chartStackTotalsUnavailable: 'Stapelsummen sind nicht verfügbar, aber das Diagramm bleibt verfügbar.',
  chartAnnotationsUnavailable: 'Diagrammanmerkungen sind nicht verfügbar, aber das Diagramm bleibt verfügbar.',
  chartTypeLine: 'Linien',
  chartTypeBar: 'Balken',
  chartTypeScatter: 'Streu',
  chartTypePie: 'Kreis',
  chartTypeDoughnut: 'Ring',
  chartTypeRadar: 'Radar',
  chartTypePolarArea: 'Polarflächen',
  chartTypeBubble: 'Blasen',
  boxPlotSeriesSummary: '{label}: {count} Verteilungen, Medianbereich {min} bis {max}, Median-Trend {trend}',
  boxPlotSummaryWithData: 'Boxplot. {summaries}.',
  boxPlotSummaryEmpty: 'Boxplot ohne Daten.',
  boxPlotData: 'Boxplot-Daten',
  chartSeriesLabel: 'Datenreihe',
  boxPlotMin: 'Min',
  boxPlotQ1: 'Q1',
  boxPlotMedian: 'Median',
  boxPlotQ3: 'Q3',
  boxPlotMax: 'Max',
  boxPlot: 'Boxplot',
  histogramFrequency: 'Häufigkeit',
  liteChartMarkSummary: '{series}, {label}: {value} ({index} von {total})',
  liteChartBarLabel: '{series}, {label}: {value}',
  chartValuePercentageLabel: '{label}: {value} ({percentage})',
  liteChartCustomMarkSummary: '{content} ({index} von {total})',
  chartMissingLibrary: 'Für diese Komponente muss das optionale Paket «chart.js» installiert sein, um Diagramme darzustellen.',
  boxPlotMissingLibrary: 'Für diese Komponente muss das optionale Boxplot-Diagrammpaket installiert sein, um Boxplots darzustellen.',
};

registerLyraLocale('de-CH', strings);
