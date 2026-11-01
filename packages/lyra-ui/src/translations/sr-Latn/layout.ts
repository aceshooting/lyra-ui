// The `layout` slice of the sr-Latn translation catalog for @aceshooting/lyra-ui: strings owned exclusively by `src/components/layout/**`.
// A side-effect-only module: a consumer writes a bare
// `import '@aceshooting/lyra-translations/sr-Latn/layout';` and reads nothing from it. Keep the
// keys in DEFAULT_STRINGS order -- `scripts/check-translations.mjs` enforces coverage, order,
// placeholder names and the plural-category set for this slice, and a catalog that cannot be
// diffed against another line-for-line is a catalog nobody will review.
// Regenerate the SHAPE (never the translations) with:
//   node scripts/scaffold-translation.mjs sr-Latn --force
import { registerLyraLocale } from '../../internal/localization-runtime.js';
import type { LyraLocaleStrings } from '../../internal/localization.js';

const strings: LyraLocaleStrings = {
  carousel: 'vrteška',
  carouselLabel: 'Vrteška',
  carouselSlide: 'slajd',
  carouselSlidePosition: 'Slajd {index} od {total}',
  carouselSlideAnnouncement: '{position}: {content}',
  carouselSlideAnnouncementSeparator: '. ',
  carouselIndicators: 'Slajdovi vrteške',
  carouselGoTo: 'Idi na slajd {index}',
  scrollerLabel: 'Sadržaj koji se pomera',
  scrollPrevious: 'Pomeri unazad',
  scrollNext: 'Pomeri unapred',
  closeNavigation: 'Zatvori navigaciju',
  openNavigation: 'Otvori navigaciju',
  resizeNavigation: 'Promeni veličinu navigacije',
  appRailCollapse: 'Skupi navigaciju',
  appRailExpand: 'Proširi navigaciju',
  appRailPin: 'Zakači navigaciju',
  appRailUnpin: 'Otkači navigaciju',
  appRailItemCollapse: 'Skupi {label}',
  appRailItemExpand: 'Proširi {label}',
  resizeValuePercent: '{value} odsto',
  commandPaletteLabel: 'Paleta komandi',
  commandPalettePlaceholder: 'Pretražite komande…',
  commandPaletteEmpty: 'Nema odgovarajućih komandi.',
  commandPaletteResults: 'Komande',
  dockPanelCollapse: 'Skupi panel',
  dockPanelExpand: 'Proširi panel',
  dockPanelResize: 'Promeni veličinu panela',
  responsivePanel: 'Panel',
  breadcrumb: 'Putanja navigacije',
  resizeDivider: 'Promeni položaj razdelnika između panela {a} i panela {b}',
  widgetFullscreenPanel: 'Panel preko celog ekrana',
  widgetViewGroup: 'Prikaz panela',
  widgetExitFullscreen: 'Izađi iz prikaza preko celog ekrana',
  widgetExpandToFullscreen: 'Proširi preko celog ekrana',
  widgetCollapse: 'Skupi panel',
  widgetExpand: 'Proširi panel',
  skipToContent: 'Pređi na sadržaj',
  dashboardGridLabel: 'Mreža kontrolne table',
  dashboardCellCollisionRejected: '{label} ne može da se postavi tu jer se preklapa sa drugom ćelijom.',
  dashboardCellMoved: '{label}: premešteno u kolonu {x}, red {y}.',
  dashboardCellResized: '{label}: veličina je promenjena na širinu {w}, visinu {h}.',
  filterBarReset: 'Resetuj filtere',
  filterBarActiveFilters: 'Aktivni filteri',
  drilldownDocuments: 'Dokumenti',
  drilldownRuns: 'Izvršavanja agenata',
  drilldownEmpty: 'Nije izabrana nijedna stavka',
  drilldownUntitledNode: 'Korak bez naslova',
  reorderMovePending: 'Promena redosleda je na čekanju.',
  reorderMoveCancelled: 'Promena redosleda je otkazana.',
  commandPaletteResultCount: {
    few: '{count} komande',
    one: '{count} komanda',
    other: '{count} komandi',
  },
  commandPaletteInputLimit: 'Neke komande su izostavljene jer je dostignuto ograničenje unosa.',
};

registerLyraLocale('sr-Latn', strings);
