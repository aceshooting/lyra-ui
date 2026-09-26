// The `layout` slice of the da translation catalog for @aceshooting/lyra-ui: strings owned exclusively by `src/components/layout/**`.
// A side-effect-only module: a consumer writes a bare
// `import '@aceshooting/lyra-ui/translations/da/layout';` and reads nothing from it. Keep the
// keys in DEFAULT_STRINGS order -- `scripts/check-translations.mjs` enforces coverage, order,
// placeholder names and the plural-category set for this slice, and a catalog that cannot be
// diffed against another line-for-line is a catalog nobody will review.
// Regenerate the SHAPE (never the translations) with:
//   node scripts/scaffold-translation.mjs da --force
import { registerLyraLocale } from '../../internal/localization-runtime.js';
import type { LyraLocaleStrings } from '../../internal/localization.js';

const strings: LyraLocaleStrings = {
  carousel: 'karrusel',
  carouselLabel: 'Karrusel',
  carouselSlide: 'dias',
  carouselSlidePosition: 'Dias {index} af {total}',
  carouselSlideAnnouncement: '{position}: {content}',
  carouselSlideAnnouncementSeparator: '. ',
  carouselIndicators: 'Karruseldias',
  carouselGoTo: 'Gå til dias {index}',
  scrollerLabel: 'Rulbart indhold',
  scrollPrevious: 'Rul tilbage',
  scrollNext: 'Rul frem',
  closeNavigation: 'Luk navigation',
  openNavigation: 'Åbn navigation',
  resizeNavigation: 'Tilpas størrelsen på navigationen',
  appRailCollapse: 'Skjul navigation',
  appRailExpand: 'Udvid navigation',
  appRailItemCollapse: 'Skjul {label}',
  appRailItemExpand: 'Udvid {label}',
  resizeValuePercent: '{value} procent',
  commandPaletteLabel: 'Kommandopalet',
  commandPalettePlaceholder: 'Søg efter kommandoer…',
  commandPaletteEmpty: 'Ingen matchende kommandoer.',
  commandPaletteResults: 'Kommandoer',
  dockPanelCollapse: 'Skjul panel',
  dockPanelExpand: 'Udvid panel',
  dockPanelResize: 'Tilpas størrelsen på panelet',
  responsivePanel: 'Panel',
  breadcrumb: 'Brødkrumme',
  resizeDivider: 'Tilpas skillelinjen mellem panel {a} og panel {b}',
  widgetFullscreenPanel: 'Panel i fuld skærm',
  widgetViewGroup: 'Panelvisning',
  widgetExitFullscreen: 'Afslut fuld skærm',
  widgetExpandToFullscreen: 'Udvid til fuld skærm',
  widgetCollapse: 'Skjul panel',
  widgetExpand: 'Udvid panel',
  skipToContent: 'Spring til indhold',
  dashboardGridLabel: 'Dashboardgitter',
  dashboardCellCollisionRejected: '{label} kan ikke placeres der, fordi den overlapper en anden celle.',
  dashboardCellMoved: '{label} flyttet til kolonne {x}, række {y}.',
  dashboardCellResized: '{label} ændret til bredde {w}, højde {h}.',
  filterBarReset: 'Nulstil filtre',
  filterBarActiveFilters: 'Aktive filtre',
  drilldownDocuments: 'Dokumenter',
  drilldownRuns: 'Agentkørsler',
  drilldownEmpty: 'Intet element valgt',
  drilldownUntitledNode: 'Unavngivet trin',
  reorderMovePending: 'Omarrangering afventer.',
  reorderMoveCancelled: 'Omarrangering annulleret.',
};

registerLyraLocale('da', strings);
