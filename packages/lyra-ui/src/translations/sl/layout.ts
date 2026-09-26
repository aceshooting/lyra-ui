// The `layout` slice of the sl translation catalog for @aceshooting/lyra-ui: strings owned exclusively by `src/components/layout/**`.
// A side-effect-only module: a consumer writes a bare
// `import '@aceshooting/lyra-ui/translations/sl/layout';` and reads nothing from it. Keep the
// keys in DEFAULT_STRINGS order -- `scripts/check-translations.mjs` enforces coverage, order,
// placeholder names and the plural-category set for this slice, and a catalog that cannot be
// diffed against another line-for-line is a catalog nobody will review.
// Regenerate the SHAPE (never the translations) with:
//   node scripts/scaffold-translation.mjs sl --force
import { registerLyraLocale } from '../../internal/localization-runtime.js';
import type { LyraLocaleStrings } from '../../internal/localization.js';

const strings: LyraLocaleStrings = {
  carousel: 'vrtiljak',
  carouselLabel: 'Vrtiljak',
  carouselSlide: 'diapozitiv',
  carouselSlidePosition: 'Diapozitiv {index} od {total}',
  carouselSlideAnnouncement: '{position}: {content}',
  carouselSlideAnnouncementSeparator: '. ',
  carouselIndicators: 'Diapozitivi vrtiljaka',
  carouselGoTo: 'Pojdi na diapozitiv {index}',
  scrollerLabel: 'Drsna vsebina',
  scrollPrevious: 'Pomakni nazaj',
  scrollNext: 'Pomakni naprej',
  closeNavigation: 'Zapri navigacijo',
  openNavigation: 'Odpri navigacijo',
  resizeNavigation: 'Spremeni velikost navigacije',
  appRailCollapse: 'Strni navigacijo',
  appRailExpand: 'Razširi navigacijo',
  appRailItemCollapse: 'Strni {label}',
  appRailItemExpand: 'Razširi {label}',
  resizeValuePercent: '{value} odstotkov',
  commandPaletteLabel: 'Paleta ukazov',
  commandPalettePlaceholder: 'Iskanje ukazov …',
  commandPaletteEmpty: 'Ni ustreznih ukazov.',
  commandPaletteResults: 'Ukazi',
  dockPanelCollapse: 'Strni podokno',
  dockPanelExpand: 'Razširi podokno',
  dockPanelResize: 'Spremeni velikost podokna',
  responsivePanel: 'Podokno',
  breadcrumb: 'Drobtinice',
  resizeDivider: 'Spremeni velikost ločila med podoknom {a} in podoknom {b}',
  widgetFullscreenPanel: 'Celozaslonsko podokno',
  widgetViewGroup: 'Pogled podokna',
  widgetExitFullscreen: 'Zapri celozaslonski način',
  widgetExpandToFullscreen: 'Razširi na celoten zaslon',
  widgetCollapse: 'Strni podokno',
  widgetExpand: 'Razširi podokno',
  skipToContent: 'Preskoči na vsebino',
  dashboardGridLabel: 'Mreža nadzorne plošče',
  dashboardCellCollisionRejected: '{label} ni mogoče postaviti tja, ker se prekriva z drugo celico.',
  dashboardCellMoved: '{label} premaknjeno v stolpec {x}, vrstico {y}.',
  dashboardCellResized: 'Velikost {label} spremenjena na širino {w}, višino {h}.',
  filterBarReset: 'Ponastavi filtre',
  filterBarActiveFilters: 'Aktivni filtri',
  drilldownDocuments: 'Dokumenti',
  drilldownRuns: 'Zagoni agenta',
  drilldownEmpty: 'Noben element ni izbran',
  drilldownUntitledNode: 'Neimenovan korak',
  reorderMovePending: 'Prerazporejanje v teku.',
  reorderMoveCancelled: 'Prerazporejanje je preklicano.',
};

registerLyraLocale('sl', strings);
