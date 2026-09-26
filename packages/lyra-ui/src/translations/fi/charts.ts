// The `charts` slice of the fi translation catalog for @aceshooting/lyra-ui: strings owned exclusively by `src/components/charts/**`.
// A side-effect-only module: a consumer writes a bare
// `import '@aceshooting/lyra-ui/translations/fi/charts';` and reads nothing from it. Keep the
// keys in DEFAULT_STRINGS order -- `scripts/check-translations.mjs` enforces coverage, order,
// placeholder names and the plural-category set for this slice, and a catalog that cannot be
// diffed against another line-for-line is a catalog nobody will review.
// Regenerate the SHAPE (never the translations) with:
//   node scripts/scaffold-translation.mjs fi --force
import { registerLyraLocale } from '../../internal/localization-runtime.js';
import type { LyraLocaleStrings } from '../../internal/localization.js';

const strings: LyraLocaleStrings = {
  chartCategory: 'Luokka',
  chartTotal: 'Yhteensä',
  chartAxisTotal: '{axis} yhteensä',
  chartPrimaryAxis: 'Ensisijainen akseli',
  chartSecondaryAxis: 'Toissijainen akseli',
  chartPointLabel: 'Piste {n}',
  chartPointCoordinates: 'x {x}, y {y}',
  chartBubblePointCoordinates: 'x {x}, y {y}, säde {radius}',
  chartLabeledPoint: '{label}: {coordinates}',
  chartTrendIncreasing: 'nouseva',
  chartTrendDecreasing: 'laskeva',
  chartTrendFlat: 'tasainen',
  chartSummary: '{label}: {count} arvoa, vaihteluväli {min}–{max}, trendi: {trend}',
  chartSeriesNoData: '{label}: ei tietoja',
  chartSummaryWithData: 'Kaavio ({type}). {summaries}.',
  chartSummaryEmpty: 'Kaavio ({type}) ilman tietoja.',
  chartSummarySeparator: '. ',
  chartData: 'Kaavion tiedot',
  chartDataSampled: 'Luotu datataulukko näyttää otoksen, jossa on enintään 1 000 tietuetta. Anna mukautettu datataulukko, jotta kaikki kaavion tiedot ovat käytettävissä.',
  chartZoomUnavailable: 'Zoomaus ei ole käytettävissä, mutta peruskaavio on edelleen käytettävissä.',
  chartDataLabelsUnavailable: 'Arvojen tunnisteet eivät ole käytettävissä, mutta peruskaavio on edelleen käytettävissä.',
  chartStackTotalsUnavailable: 'Pinottujen arvojen summat eivät ole käytettävissä, mutta peruskaavio on edelleen käytettävissä.',
  chartAnnotationsUnavailable: 'Kaavion merkinnät eivät ole käytettävissä, mutta peruskaavio on edelleen käytettävissä.',
  chartTypeLine: 'Viiva',
  chartTypeBar: 'Pylväs',
  chartTypeScatter: 'Hajonta',
  chartTypePie: 'Piirakka',
  chartTypeDoughnut: 'Rengas',
  chartTypeRadar: 'Tutka',
  chartTypePolarArea: 'Polaarialue',
  chartTypeBubble: 'Kupla',
  boxPlotSeriesSummary: '{label}: {count} jakaumaa, mediaanien vaihteluväli {min}–{max}, mediaanin trendi: {trend}',
  boxPlotSummaryWithData: 'Laatikkokaavio. {summaries}.',
  boxPlotSummaryEmpty: 'Laatikkokaavio ilman tietoja.',
  boxPlotData: 'Laatikkokaavion tiedot',
  chartSeriesLabel: 'Sarja',
  boxPlotMin: 'Min',
  boxPlotQ1: 'Q1',
  boxPlotMedian: 'Mediaani',
  boxPlotQ3: 'Q3',
  boxPlotMax: 'Maks',
  boxPlot: 'Laatikkokaavio',
  histogramFrequency: 'Frekvenssi',
  liteChartMarkSummary: '{series}, {label}: {value} ({index}/{total})',
  liteChartBarLabel: '{series}, {label}: {value}',
  chartValuePercentageLabel: '{label}: {value} ({percentage})',
  liteChartCustomMarkSummary: '{content} ({index}/{total})',
  chartMissingLibrary: 'Tämä komponentti tarvitsee valinnaisen ”chart.js”-paketin kaavioiden piirtämiseen.',
  boxPlotMissingLibrary: 'Tämä komponentti tarvitsee valinnaisen laatikkokaaviopaketin laatikkokaavioiden piirtämiseen.',
};

registerLyraLocale('fi', strings);
