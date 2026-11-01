// The `layout` slice of the sr translation catalog for @aceshooting/lyra-ui: strings owned exclusively by `src/components/layout/**`.
// A side-effect-only module: a consumer writes a bare
// `import '@aceshooting/lyra-translations/sr/layout';` and reads nothing from it. Keep the
// keys in DEFAULT_STRINGS order -- `scripts/check-translations.mjs` enforces coverage, order,
// placeholder names and the plural-category set for this slice, and a catalog that cannot be
// diffed against another line-for-line is a catalog nobody will review.
// Regenerate the SHAPE (never the translations) with:
//   node scripts/scaffold-translation.mjs sr --force
import { registerLyraLocale } from '../../internal/localization-runtime.js';
import type { LyraLocaleStrings } from '../../internal/localization.js';

const strings: LyraLocaleStrings = {
  carousel: 'вртешка',
  carouselLabel: 'Вртешка',
  carouselSlide: 'слајд',
  carouselSlidePosition: 'Слајд {index} од {total}',
  carouselSlideAnnouncement: '{position}: {content}',
  carouselSlideAnnouncementSeparator: '. ',
  carouselIndicators: 'Слајдови вртешке',
  carouselGoTo: 'Иди на слајд {index}',
  scrollerLabel: 'Садржај који се помера',
  scrollPrevious: 'Помери уназад',
  scrollNext: 'Помери унапред',
  closeNavigation: 'Затвори навигацију',
  openNavigation: 'Отвори навигацију',
  resizeNavigation: 'Промени величину навигације',
  appRailCollapse: 'Скупи навигацију',
  appRailExpand: 'Прошири навигацију',
  appRailPin: 'Закачи навигацију',
  appRailUnpin: 'Откачи навигацију',
  appRailItemCollapse: 'Скупи {label}',
  appRailItemExpand: 'Прошири {label}',
  resizeValuePercent: '{value} одсто',
  commandPaletteLabel: 'Палета команди',
  commandPalettePlaceholder: 'Претражите команде…',
  commandPaletteEmpty: 'Нема одговарајућих команди.',
  commandPaletteResults: 'Команде',
  dockPanelCollapse: 'Скупи панел',
  dockPanelExpand: 'Прошири панел',
  dockPanelResize: 'Промени величину панела',
  responsivePanel: 'Панел',
  breadcrumb: 'Путања навигације',
  resizeDivider: 'Промени положај разделника између панела {a} и панела {b}',
  widgetFullscreenPanel: 'Панел преко целог екрана',
  widgetViewGroup: 'Приказ панела',
  widgetExitFullscreen: 'Изађи из приказа преко целог екрана',
  widgetExpandToFullscreen: 'Прошири преко целог екрана',
  widgetCollapse: 'Скупи панел',
  widgetExpand: 'Прошири панел',
  skipToContent: 'Пређи на садржај',
  dashboardGridLabel: 'Мрежа контролне табле',
  dashboardCellCollisionRejected: '{label} не може да се постави ту јер се преклапа са другом ћелијом.',
  dashboardCellMoved: '{label}: премештено у колону {x}, ред {y}.',
  dashboardCellResized: '{label}: величина је промењена на ширину {w}, висину {h}.',
  filterBarReset: 'Ресетуј филтере',
  filterBarActiveFilters: 'Активни филтери',
  drilldownDocuments: 'Документи',
  drilldownRuns: 'Извршавања агената',
  drilldownEmpty: 'Није изабрана ниједна ставка',
  drilldownUntitledNode: 'Корак без наслова',
  reorderMovePending: 'Промена редоследа је на чекању.',
  reorderMoveCancelled: 'Промена редоследа је отказана.',
  commandPaletteResultCount: {
    few: '{count} команде',
    one: '{count} команда',
    other: '{count} команди',
  },
  commandPaletteInputLimit: 'Неке команде су изостављене јер је достигнуто ограничење уноса.',
};

registerLyraLocale('sr', strings);
