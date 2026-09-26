// The `layout` slice of the hr translation catalog for @aceshooting/lyra-ui: strings owned exclusively by `src/components/layout/**`.
// A side-effect-only module: a consumer writes a bare
// `import '@aceshooting/lyra-ui/translations/hr/layout';` and reads nothing from it. Keep the
// keys in DEFAULT_STRINGS order -- `scripts/check-translations.mjs` enforces coverage, order,
// placeholder names and the plural-category set for this slice, and a catalog that cannot be
// diffed against another line-for-line is a catalog nobody will review.
// Regenerate the SHAPE (never the translations) with:
//   node scripts/scaffold-translation.mjs hr --force
import { registerLyraLocale } from '../../internal/localization-runtime.js';
import type { LyraLocaleStrings } from '../../internal/localization.js';

const strings: LyraLocaleStrings = {
  carousel: 'vrtuljak',
  carouselLabel: 'Vrtuljak',
  carouselSlide: 'slajd',
  carouselSlidePosition: 'Slajd {index} od {total}',
  carouselSlideAnnouncement: '{position}: {content}',
  carouselSlideAnnouncementSeparator: '. ',
  carouselIndicators: 'Slajdovi vrtuljka',
  carouselGoTo: 'Idi na slajd {index}',
  scrollerLabel: 'Pomični sadržaj',
  scrollPrevious: 'Pomakni unatrag',
  scrollNext: 'Pomakni naprijed',
  closeNavigation: 'Zatvori navigaciju',
  openNavigation: 'Otvori navigaciju',
  resizeNavigation: 'Promijeni veličinu navigacije',
  appRailCollapse: 'Sažmi navigaciju',
  appRailExpand: 'Proširi navigaciju',
  appRailItemCollapse: 'Sažmi: {label}',
  appRailItemExpand: 'Proširi: {label}',
  resizeValuePercent: '{value} posto',
  commandPaletteLabel: 'Paleta naredbi',
  commandPalettePlaceholder: 'Pretraži naredbe…',
  commandPaletteEmpty: 'Nema odgovarajućih naredbi.',
  commandPaletteResults: 'Naredbe',
  dockPanelCollapse: 'Sažmi ploču',
  dockPanelExpand: 'Proširi ploču',
  dockPanelResize: 'Promijeni veličinu ploče',
  responsivePanel: 'Ploča',
  breadcrumb: 'Putanja',
  resizeDivider: 'Promijeni veličinu razdjelnika između ploča {a} i {b}',
  widgetFullscreenPanel: 'Ploča preko cijelog zaslona',
  widgetViewGroup: 'Prikaz ploče',
  widgetExitFullscreen: 'Izađi iz prikaza preko cijelog zaslona',
  widgetExpandToFullscreen: 'Proširi na cijeli zaslon',
  widgetCollapse: 'Sažmi ploču',
  widgetExpand: 'Proširi ploču',
  skipToContent: 'Preskoči na sadržaj',
  dashboardGridLabel: 'Rešetka nadzorne ploče',
  dashboardCellCollisionRejected: 'Stavku {label} nije moguće postaviti ondje jer se preklapa s drugom ćelijom.',
  dashboardCellMoved: 'Stavka {label} premještena u stupac {x}, redak {y}.',
  dashboardCellResized: 'Veličina stavke {label} promijenjena na širinu {w}, visinu {h}.',
  filterBarReset: 'Poništi filtre',
  filterBarActiveFilters: 'Aktivni filtri',
  drilldownDocuments: 'Dokumenti',
  drilldownRuns: 'Izvođenja agenta',
  drilldownEmpty: 'Nije odabrana nijedna stavka',
  drilldownUntitledNode: 'Korak bez naziva',
  reorderMovePending: 'Promjena redoslijeda na čekanju.',
  reorderMoveCancelled: 'Promjena redoslijeda otkazana.',
};

registerLyraLocale('hr', strings);
