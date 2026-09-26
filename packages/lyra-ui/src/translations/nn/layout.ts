// The `layout` slice of the nn translation catalog for @aceshooting/lyra-ui: strings owned exclusively by `src/components/layout/**`.
// A side-effect-only module: a consumer writes a bare
// `import '@aceshooting/lyra-ui/translations/nn/layout';` and reads nothing from it. Keep the
// keys in DEFAULT_STRINGS order -- `scripts/check-translations.mjs` enforces coverage, order,
// placeholder names and the plural-category set for this slice, and a catalog that cannot be
// diffed against another line-for-line is a catalog nobody will review.
// Regenerate the SHAPE (never the translations) with:
//   node scripts/scaffold-translation.mjs nn --force
import { registerLyraLocale } from '../../internal/localization-runtime.js';
import type { LyraLocaleStrings } from '../../internal/localization.js';

const strings: LyraLocaleStrings = {
  carousel: 'karusell',
  carouselLabel: 'Karusell',
  carouselSlide: 'lysbilete',
  carouselSlidePosition: 'Lysbilete {index} av {total}',
  carouselSlideAnnouncement: '{position}: {content}',
  carouselSlideAnnouncementSeparator: '. ',
  carouselIndicators: 'Lysbilete i karusellen',
  carouselGoTo: 'Gå til lysbilete {index}',
  scrollerLabel: 'Rullbart innhald',
  scrollPrevious: 'Rull bakover',
  scrollNext: 'Rull framover',
  closeNavigation: 'Lukk navigasjonen',
  openNavigation: 'Opne navigasjonen',
  resizeNavigation: 'Endre storleik på navigasjonen',
  appRailCollapse: 'Fald saman navigasjonen',
  appRailExpand: 'Utvid navigasjonen',
  appRailItemCollapse: 'Fald saman {label}',
  appRailItemExpand: 'Utvid {label}',
  resizeValuePercent: '{value} prosent',
  commandPaletteLabel: 'Kommandopalett',
  commandPalettePlaceholder: 'Søk etter kommandoar…',
  commandPaletteEmpty: 'Ingen samsvarande kommandoar.',
  commandPaletteResults: 'Kommandoar',
  dockPanelCollapse: 'Fald saman panelet',
  dockPanelExpand: 'Utvid panelet',
  dockPanelResize: 'Endre storleik på panelet',
  responsivePanel: 'Panel',
  breadcrumb: 'Brødsmulesti',
  resizeDivider: 'Endre storleik på skiljelinja mellom panel {a} og panel {b}',
  widgetFullscreenPanel: 'Panel i fullskjerm',
  widgetViewGroup: 'Panelvising',
  widgetExitFullscreen: 'Avslutt fullskjerm',
  widgetExpandToFullscreen: 'Utvid til fullskjerm',
  widgetCollapse: 'Fald saman panelet',
  widgetExpand: 'Utvid panelet',
  skipToContent: 'Hopp til innhaldet',
  dashboardGridLabel: 'Rutenett for kontrollpanel',
  dashboardCellCollisionRejected: '{label} kan ikkje plasserast der fordi det overlappar ei anna celle.',
  dashboardCellMoved: '{label} flytta til kolonne {x}, rad {y}.',
  dashboardCellResized: '{label} endra til breidd {w}, høgd {h}.',
  filterBarReset: 'Tilbakestill filter',
  filterBarActiveFilters: 'Aktive filter',
  drilldownDocuments: 'Dokument',
  drilldownRuns: 'Agentkøyringar',
  drilldownEmpty: 'Ingen element er valt',
  drilldownUntitledNode: 'Steg utan namn',
  reorderMovePending: 'Omsortering ventar.',
  reorderMoveCancelled: 'Omsortering avbroten.',
};

registerLyraLocale('nn', strings);
