// The `layout` slice of the hu translation catalog for @aceshooting/lyra-ui: strings owned exclusively by `src/components/layout/**`.
// A side-effect-only module: a consumer writes a bare
// `import '@aceshooting/lyra-ui/translations/hu/layout';` and reads nothing from it. Keep the
// keys in DEFAULT_STRINGS order -- `scripts/check-translations.mjs` enforces coverage, order,
// placeholder names and the plural-category set for this slice, and a catalog that cannot be
// diffed against another line-for-line is a catalog nobody will review.
// Regenerate the SHAPE (never the translations) with:
//   node scripts/scaffold-translation.mjs hu --force
import { registerLyraLocale } from '../../internal/localization-runtime.js';
import type { LyraLocaleStrings } from '../../internal/localization.js';

const strings: LyraLocaleStrings = {
  carousel: 'karusszel',
  carouselLabel: 'Karusszel',
  carouselSlide: 'dia',
  carouselSlidePosition: '{index}/{total}. dia',
  carouselSlideAnnouncement: '{position}: {content}',
  carouselSlideAnnouncementSeparator: '. ',
  carouselIndicators: 'Karusszel diái',
  carouselGoTo: 'Ugrás a diára: {index}',
  scrollerLabel: 'Görgethető tartalom',
  scrollPrevious: 'Görgetés vissza',
  scrollNext: 'Görgetés előre',
  closeNavigation: 'Navigáció bezárása',
  openNavigation: 'Navigáció megnyitása',
  resizeNavigation: 'Navigáció átméretezése',
  appRailCollapse: 'Navigáció összecsukása',
  appRailExpand: 'Navigáció kibontása',
  appRailItemCollapse: 'Összecsukás: {label}',
  appRailItemExpand: 'Kibontás: {label}',
  resizeValuePercent: '{value} százalék',
  commandPaletteLabel: 'Parancspaletta',
  commandPalettePlaceholder: 'Parancsok keresése…',
  commandPaletteEmpty: 'Nincsenek egyező parancsok.',
  commandPaletteResults: 'Parancsok',
  dockPanelCollapse: 'Panel összecsukása',
  dockPanelExpand: 'Panel kibontása',
  dockPanelResize: 'Panel átméretezése',
  responsivePanel: 'Panel',
  breadcrumb: 'Morzsamenü',
  resizeDivider: 'Elválasztó átméretezése a panelek között: {a} és {b}',
  widgetFullscreenPanel: 'Teljes képernyős panel',
  widgetViewGroup: 'Panelnézet',
  widgetExitFullscreen: 'Kilépés a teljes képernyőből',
  widgetExpandToFullscreen: 'Kibontás teljes képernyőre',
  widgetCollapse: 'Panel összecsukása',
  widgetExpand: 'Panel kibontása',
  skipToContent: 'Ugrás a tartalomhoz',
  dashboardGridLabel: 'Irányítópult-rács',
  dashboardCellCollisionRejected: '{label} nem helyezhető ide, mert átfedésben van egy másik cellával.',
  dashboardCellMoved: 'Áthelyezve: {label}, oszlop: {x}, sor: {y}.',
  dashboardCellResized: 'Átméretezve: {label}, szélesség: {w}, magasság: {h}.',
  filterBarReset: 'Szűrők visszaállítása',
  filterBarActiveFilters: 'Aktív szűrők',
  drilldownDocuments: 'Dokumentumok',
  drilldownRuns: 'Ügynökfuttatások',
  drilldownEmpty: 'Nincs kijelölt elem',
  drilldownUntitledNode: 'Névtelen lépés',
  reorderMovePending: 'Átrendezés folyamatban.',
  reorderMoveCancelled: 'Átrendezés megszakítva.',
};

registerLyraLocale('hu', strings);
