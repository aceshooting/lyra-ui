// The `layout` slice of the nb translation catalog for @aceshooting/lyra-ui: strings owned exclusively by `src/components/layout/**`.
// A side-effect-only module: a consumer writes a bare
// `import '@aceshooting/lyra-ui/translations/nb/layout';` and reads nothing from it. Keep the
// keys in DEFAULT_STRINGS order -- `scripts/check-translations.mjs` enforces coverage, order,
// placeholder names and the plural-category set for this slice, and a catalog that cannot be
// diffed against another line-for-line is a catalog nobody will review.
// Regenerate the SHAPE (never the translations) with:
//   node scripts/scaffold-translation.mjs nb --force
import { registerLyraLocale } from '../../internal/localization-runtime.js';
import type { LyraLocaleStrings } from '../../internal/localization.js';

const strings: LyraLocaleStrings = {
  carousel: 'karusell',
  carouselLabel: 'Karusell',
  carouselSlide: 'lysbilde',
  carouselSlidePosition: 'Lysbilde {index} av {total}',
  carouselSlideAnnouncement: '{position}: {content}',
  carouselSlideAnnouncementSeparator: '. ',
  carouselIndicators: 'Karusell-lysbilder',
  carouselGoTo: 'Gå til lysbilde {index}',
  scrollerLabel: 'Rullbart innhold',
  scrollPrevious: 'Rull bakover',
  scrollNext: 'Rull fremover',
  closeNavigation: 'Lukk navigasjon',
  openNavigation: 'Åpne navigasjon',
  resizeNavigation: 'Endre størrelse på navigasjon',
  appRailCollapse: 'Skjul navigasjon',
  appRailExpand: 'Utvid navigasjon',
  appRailItemCollapse: 'Skjul {label}',
  appRailItemExpand: 'Utvid {label}',
  resizeValuePercent: '{value} prosent',
  commandPaletteLabel: 'Kommandopalett',
  commandPalettePlaceholder: 'Søk etter kommandoer …',
  commandPaletteEmpty: 'Ingen samsvarende kommandoer.',
  commandPaletteResults: 'Kommandoer',
  dockPanelCollapse: 'Skjul panel',
  dockPanelExpand: 'Utvid panel',
  dockPanelResize: 'Endre størrelse på panel',
  responsivePanel: 'Panel',
  breadcrumb: 'Brødsmulesti',
  resizeDivider: 'Endre størrelse på skillelinjen mellom panel {a} og panel {b}',
  widgetFullscreenPanel: 'Fullskjermpanel',
  widgetViewGroup: 'Panelvisning',
  widgetExitFullscreen: 'Avslutt fullskjerm',
  widgetExpandToFullscreen: 'Utvid til fullskjerm',
  widgetCollapse: 'Skjul panel',
  widgetExpand: 'Utvid panel',
  skipToContent: 'Hopp til innhold',
  dashboardGridLabel: 'Rutenett for instrumentbord',
  dashboardCellCollisionRejected: '{label} kan ikke plasseres der fordi den overlapper en annen celle.',
  dashboardCellMoved: '{label} ble flyttet til kolonne {x}, rad {y}.',
  dashboardCellResized: '{label} ble endret til bredde {w}, høyde {h}.',
  filterBarReset: 'Tilbakestill filtre',
  filterBarActiveFilters: 'Aktive filtre',
  drilldownDocuments: 'Dokumenter',
  drilldownRuns: 'Agentkjøringer',
  drilldownEmpty: 'Ingen element valgt',
  drilldownUntitledNode: 'Trinn uten tittel',
  reorderMovePending: 'Omorganisering venter.',
  reorderMoveCancelled: 'Omorganisering avbrutt.',
};

registerLyraLocale('nb', strings);
