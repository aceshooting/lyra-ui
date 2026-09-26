// The `layout` slice of the de-CH translation catalog for @aceshooting/lyra-ui: strings owned exclusively by `src/components/layout/**`.
// A side-effect-only module: a consumer writes a bare
// `import '@aceshooting/lyra-ui/translations/de-CH/layout';` and reads nothing from it. Keep the
// keys in DEFAULT_STRINGS order -- `scripts/check-translations.mjs` enforces coverage, order,
// placeholder names and the plural-category set for this slice, and a catalog that cannot be
// diffed against another line-for-line is a catalog nobody will review.
// Regenerate the SHAPE (never the translations) with:
//   node scripts/scaffold-translation.mjs de-CH --force
import { registerLyraLocale } from '../../internal/localization-runtime.js';
import type { LyraLocaleStrings } from '../../internal/localization.js';

const strings: LyraLocaleStrings = {
  carousel: 'Karussell',
  carouselLabel: 'Karussell',
  carouselSlide: 'Folie',
  carouselSlidePosition: 'Folie {index} von {total}',
  carouselSlideAnnouncement: '{position}: {content}',
  carouselSlideAnnouncementSeparator: '. ',
  carouselIndicators: 'Karussellfolien',
  carouselGoTo: 'Zu Folie {index} wechseln',
  scrollerLabel: 'Scrollbarer Inhalt',
  scrollPrevious: 'Zurückscrollen',
  scrollNext: 'Vorwärtsscrollen',
  closeNavigation: 'Navigation schliessen',
  openNavigation: 'Navigation öffnen',
  resizeNavigation: 'Navigationsgrösse ändern',
  appRailCollapse: 'Navigation einklappen',
  appRailExpand: 'Navigation ausklappen',
  appRailItemCollapse: '{label} einklappen',
  appRailItemExpand: '{label} ausklappen',
  resizeValuePercent: '{value} Prozent',
  commandPaletteLabel: 'Befehlspalette',
  commandPalettePlaceholder: 'Befehle suchen…',
  commandPaletteEmpty: 'Keine passenden Befehle.',
  commandPaletteResults: 'Befehle',
  dockPanelCollapse: 'Bereich einklappen',
  dockPanelExpand: 'Bereich ausklappen',
  dockPanelResize: 'Bereichsgrösse ändern',
  responsivePanel: 'Bereich',
  breadcrumb: 'Navigationspfad',
  resizeDivider: 'Trennlinie zwischen Bereich {a} und Bereich {b} verschieben',
  widgetFullscreenPanel: 'Vollbildbereich',
  widgetViewGroup: 'Bereichsansicht',
  widgetExitFullscreen: 'Vollbild beenden',
  widgetExpandToFullscreen: 'Auf Vollbild vergrössern',
  widgetCollapse: 'Bereich einklappen',
  widgetExpand: 'Bereich ausklappen',
  skipToContent: 'Zum Inhalt springen',
  dashboardGridLabel: 'Dashboard-Raster',
  dashboardCellCollisionRejected: '{label} kann dort nicht platziert werden, weil es eine andere Zelle überlappt.',
  dashboardCellMoved: '{label} in Spalte {x}, Zeile {y} verschoben.',
  dashboardCellResized: '{label} auf Breite {w}, Höhe {h} geändert.',
  filterBarReset: 'Filter zurücksetzen',
  filterBarActiveFilters: 'Aktive Filter',
  drilldownDocuments: 'Dokumente',
  drilldownRuns: 'Agentenläufe',
  drilldownEmpty: 'Kein Element ausgewählt',
  drilldownUntitledNode: 'Unbenannter Schritt',
  reorderMovePending: 'Neuordnung ausstehend.',
  reorderMoveCancelled: 'Neuordnung abgebrochen.',
};

registerLyraLocale('de-CH', strings);
