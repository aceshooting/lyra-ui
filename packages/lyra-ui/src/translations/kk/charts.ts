// The `charts` slice of the kk translation catalog for @aceshooting/lyra-ui: strings owned exclusively by `src/components/charts/**`.
// A side-effect-only module: a consumer writes a bare
// `import '@aceshooting/lyra-ui/translations/kk/charts';` and reads nothing from it. Keep the
// keys in DEFAULT_STRINGS order -- `scripts/check-translations.mjs` enforces coverage, order,
// placeholder names and the plural-category set for this slice, and a catalog that cannot be
// diffed against another line-for-line is a catalog nobody will review.
// Regenerate the SHAPE (never the translations) with:
//   node scripts/scaffold-translation.mjs kk --force
import { registerLyraLocale } from '../../internal/localization-runtime.js';
import type { LyraLocaleStrings } from '../../internal/localization.js';

const strings: LyraLocaleStrings = {
  chartCategory: 'Санат',
  chartTotal: 'Барлығы',
  chartAxisTotal: '{axis}: барлығы',
  chartPrimaryAxis: 'Негізгі ось',
  chartSecondaryAxis: 'Қосалқы ось',
  chartPointLabel: 'Нүкте {n}',
  chartPointCoordinates: 'x {x}, y {y}',
  chartBubblePointCoordinates: 'x {x}, y {y}, радиус {radius}',
  chartLabeledPoint: '{label}: {coordinates}',
  chartTrendIncreasing: 'өсу',
  chartTrendDecreasing: 'төмендеу',
  chartTrendFlat: 'тұрақты',
  chartSummary: '{label}: мәндер саны {count}, ауқымы {min} – {max}, үрдіс: {trend}',
  chartSeriesNoData: '{label}: деректер жоқ',
  chartSummaryWithData: 'Диаграмма түрі: {type}. {summaries}.',
  chartSummaryEmpty: 'Деректері жоқ диаграмма, түрі: {type}.',
  chartSummarySeparator: '. ',
  chartData: 'Диаграмма деректері',
  chartDataSampled: 'Жасалған деректер кестесі 1 000 жазбаға дейінгі үлгіні көрсетеді. Диаграмманың барлық деректеріне қол жеткізу үшін өз деректер кестеңізді беріңіз.',
  chartZoomUnavailable: 'Масштабтау қолжетімсіз, бірақ негізгі диаграмма қолжетімді.',
  chartDataLabelsUnavailable: 'Деректер белгілері қолжетімсіз, бірақ негізгі диаграмма қолжетімді.',
  chartStackTotalsUnavailable: 'Жинақталған қорытындылар қолжетімсіз, бірақ негізгі диаграмма қолжетімді.',
  chartAnnotationsUnavailable: 'Диаграмма аннотациялары қолжетімсіз, бірақ негізгі диаграмма қолжетімді.',
  chartTypeLine: 'Сызықтық',
  chartTypeBar: 'Бағаналы',
  chartTypeScatter: 'Нүктелік',
  chartTypePie: 'Дөңгелек',
  chartTypeDoughnut: 'Сақиналы',
  chartTypeRadar: 'Радарлық',
  chartTypePolarArea: 'Полярлық аймақ',
  chartTypeBubble: 'Көпіршікті',
  boxPlotSeriesSummary: '{label}: үлестірім саны {count}, медиана ауқымы {min} – {max}, медиана үрдісі: {trend}',
  boxPlotSummaryWithData: 'Қорапты диаграмма. {summaries}.',
  boxPlotSummaryEmpty: 'Деректері жоқ қорапты диаграмма.',
  boxPlotData: 'Қорапты диаграмма деректері',
  chartSeriesLabel: 'Қатар',
  boxPlotMin: 'Мин.',
  boxPlotQ1: 'Q1',
  boxPlotMedian: 'Медиана',
  boxPlotQ3: 'Q3',
  boxPlotMax: 'Макс.',
  boxPlot: 'Қорапты диаграмма',
  histogramFrequency: 'Жиілік',
  liteChartMarkSummary: '{series}, {label}: {value} ({index}, барлығы {total})',
  liteChartBarLabel: '{series}, {label}: {value}',
  chartValuePercentageLabel: '{label}: {value} ({percentage})',
  liteChartCustomMarkSummary: '{content} ({index}, барлығы {total})',
  chartMissingLibrary: 'Диаграммаларды көрсету үшін бұл компонентке қосымша "chart.js" бумасын орнату қажет.',
  boxPlotMissingLibrary: 'Қорапты диаграммаларды көрсету үшін бұл компонентке қосымша box-plot диаграмма бумасын орнату қажет.',
};

registerLyraLocale('kk', strings);
