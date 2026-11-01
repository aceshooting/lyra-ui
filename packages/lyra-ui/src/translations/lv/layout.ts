// The `layout` slice of the lv translation catalog for @aceshooting/lyra-ui: strings owned exclusively by `src/components/layout/**`.
// A side-effect-only module: a consumer writes a bare
// `import '@aceshooting/lyra-translations/lv/layout';` and reads nothing from it. Keep the
// keys in DEFAULT_STRINGS order -- `scripts/check-translations.mjs` enforces coverage, order,
// placeholder names and the plural-category set for this slice, and a catalog that cannot be
// diffed against another line-for-line is a catalog nobody will review.
// Regenerate the SHAPE (never the translations) with:
//   node scripts/scaffold-translation.mjs lv --force
import { registerLyraLocale } from '../../internal/localization-runtime.js';
import type { LyraLocaleStrings } from '../../internal/localization.js';

const strings: LyraLocaleStrings = {
  carousel: 'karuselis',
  carouselLabel: 'Karuselis',
  carouselSlide: 'slaids',
  carouselSlidePosition: 'Slaids {index} no {total}',
  carouselSlideAnnouncement: '{position}: {content}',
  carouselSlideAnnouncementSeparator: '. ',
  carouselIndicators: 'Karuseļa slaidi',
  carouselGoTo: 'Pāriet uz {index}. slaidu',
  scrollerLabel: 'Ritināms saturs',
  scrollPrevious: 'Ritināt atpakaļ',
  scrollNext: 'Ritināt uz priekšu',
  closeNavigation: 'Aizvērt navigāciju',
  openNavigation: 'Atvērt navigāciju',
  resizeNavigation: 'Mainīt navigācijas izmēru',
  appRailCollapse: 'Sakļaut navigāciju',
  appRailExpand: 'Izvērst navigāciju',
  appRailPin: 'Piespraust navigāciju',
  appRailUnpin: 'Atspraust navigāciju',
  appRailItemCollapse: 'Sakļaut {label}',
  appRailItemExpand: 'Izvērst {label}',
  resizeValuePercent: '{value} procenti',
  commandPaletteLabel: 'Komandu palete',
  commandPalettePlaceholder: 'Meklēt komandas…',
  commandPaletteEmpty: 'Nav atbilstošu komandu.',
  commandPaletteResults: 'Komandas',
  dockPanelCollapse: 'Sakļaut paneli',
  dockPanelExpand: 'Izvērst paneli',
  dockPanelResize: 'Mainīt paneļa izmēru',
  responsivePanel: 'Panelis',
  breadcrumb: 'Navigācijas ceļš',
  resizeDivider: 'Mainīt atdalītāja starp paneli {a} un paneli {b} novietojumu',
  widgetFullscreenPanel: 'Pilnekrāna panelis',
  widgetViewGroup: 'Paneļa skats',
  widgetExitFullscreen: 'Iziet no pilnekrāna režīma',
  widgetExpandToFullscreen: 'Izvērst pilnekrāna režīmā',
  widgetCollapse: 'Sakļaut paneli',
  widgetExpand: 'Izvērst paneli',
  skipToContent: 'Pāriet uz saturu',
  dashboardGridLabel: 'Informācijas paneļa režģis',
  dashboardCellCollisionRejected: '{label} nevar novietot šeit, jo tas pārklājas ar citu šūnu.',
  dashboardCellMoved: '{label} pārvietots uz {x}. kolonnu, {y}. rindu.',
  dashboardCellResized: '{label} izmērs mainīts: platums {w}, augstums {h}.',
  filterBarReset: 'Atiestatīt filtrus',
  filterBarActiveFilters: 'Aktīvie filtri',
  drilldownDocuments: 'Dokumenti',
  drilldownRuns: 'Aģenta izpildes',
  drilldownEmpty: 'Nav atlasīts neviens vienums',
  drilldownUntitledNode: 'Nenosaukts solis',
  reorderMovePending: 'Pārkārtošana gaida.',
  reorderMoveCancelled: 'Pārkārtošana atcelta.',
  commandPaletteResultCount: {
    one: '{count} komanda',
    other: '{count} komandas',
    zero: '{count} komandas',
  },
  commandPaletteInputLimit: 'Dažas komandas tika izlaistas, jo tika sasniegts ievades ierobežojums.',
};

registerLyraLocale('lv', strings);
