// The `layout` slice of the bg translation catalog for @aceshooting/lyra-ui: strings owned exclusively by `src/components/layout/**`.
// A side-effect-only module: a consumer writes a bare
// `import '@aceshooting/lyra-translations/bg/layout';` and reads nothing from it. Keep the
// keys in DEFAULT_STRINGS order -- `scripts/check-translations.mjs` enforces coverage, order,
// placeholder names and the plural-category set for this slice, and a catalog that cannot be
// diffed against another line-for-line is a catalog nobody will review.
// Regenerate the SHAPE (never the translations) with:
//   node scripts/scaffold-translation.mjs bg --force
import { registerLyraLocale } from '../../internal/localization-runtime.js';
import type { LyraLocaleStrings } from '../../internal/localization.js';

const strings: LyraLocaleStrings = {
  carousel: 'въртележка',
  carouselLabel: 'Въртележка',
  carouselSlide: 'слайд',
  carouselSlidePosition: 'Слайд {index} от {total}',
  carouselSlideAnnouncement: '{position}: {content}',
  carouselSlideAnnouncementSeparator: '. ',
  carouselIndicators: 'Слайдове на въртележката',
  carouselGoTo: 'Към слайд {index}',
  scrollerLabel: 'Превъртаемо съдържание',
  scrollPrevious: 'Превърти назад',
  scrollNext: 'Превърти напред',
  closeNavigation: 'Затвори навигацията',
  openNavigation: 'Отвори навигацията',
  resizeNavigation: 'Преоразмери навигацията',
  appRailCollapse: 'Свий навигацията',
  appRailExpand: 'Разгъни навигацията',
  appRailPin: 'Закачи навигацията',
  appRailUnpin: 'Откачи навигацията',
  appRailItemCollapse: 'Свий {label}',
  appRailItemExpand: 'Разгъни {label}',
  resizeValuePercent: '{value} процента',
  commandPaletteLabel: 'Палитра с команди',
  commandPalettePlaceholder: 'Търсене на команди…',
  commandPaletteEmpty: 'Няма съответстващи команди.',
  commandPaletteResults: 'Команди',
  dockPanelCollapse: 'Свий панела',
  dockPanelExpand: 'Разгъни панела',
  dockPanelResize: 'Преоразмери панела',
  responsivePanel: 'Панел',
  breadcrumb: 'Навигационна пътека',
  resizeDivider: 'Преоразмери разделителя между панел {a} и панел {b}',
  widgetFullscreenPanel: 'Панел на цял екран',
  widgetViewGroup: 'Изглед на панела',
  widgetExitFullscreen: 'Изход от цял екран',
  widgetExpandToFullscreen: 'Разгъни на цял екран',
  widgetCollapse: 'Свий панела',
  widgetExpand: 'Разгъни панела',
  skipToContent: 'Към съдържанието',
  dashboardGridLabel: 'Мрежа на таблото',
  dashboardCellCollisionRejected: '{label} не може да бъде поставен там, защото се припокрива с друга клетка.',
  dashboardCellMoved: '{label} е преместен в колона {x}, ред {y}.',
  dashboardCellResized: '{label} е преоразмерен до ширина {w}, височина {h}.',
  filterBarReset: 'Нулирай филтрите',
  filterBarActiveFilters: 'Активни филтри',
  drilldownDocuments: 'Документи',
  drilldownRuns: 'Изпълнения на агенти',
  drilldownEmpty: 'Няма избран елемент',
  drilldownUntitledNode: 'Стъпка без заглавие',
  reorderMovePending: 'Пренареждането предстои.',
  reorderMoveCancelled: 'Пренареждането е отменено.',
  commandPaletteResultCount: {
    one: '{count} команда',
    other: '{count} команди',
  },
  commandPaletteInputLimit: 'Някои команди са пропуснати, защото е достигнато ограничение за входните данни.',
};

registerLyraLocale('bg', strings);
