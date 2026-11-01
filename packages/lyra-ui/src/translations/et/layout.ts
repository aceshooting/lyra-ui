// The `layout` slice of the et translation catalog for @aceshooting/lyra-ui: strings owned exclusively by `src/components/layout/**`.
// A side-effect-only module: a consumer writes a bare
// `import '@aceshooting/lyra-translations/et/layout';` and reads nothing from it. Keep the
// keys in DEFAULT_STRINGS order -- `scripts/check-translations.mjs` enforces coverage, order,
// placeholder names and the plural-category set for this slice, and a catalog that cannot be
// diffed against another line-for-line is a catalog nobody will review.
// Regenerate the SHAPE (never the translations) with:
//   node scripts/scaffold-translation.mjs et --force
import { registerLyraLocale } from '../../internal/localization-runtime.js';
import type { LyraLocaleStrings } from '../../internal/localization.js';

const strings: LyraLocaleStrings = {
  carousel: 'karussell',
  carouselLabel: 'Karussell',
  carouselSlide: 'slaid',
  carouselSlidePosition: 'Slaid {index}/{total}',
  carouselSlideAnnouncement: '{position}: {content}',
  carouselSlideAnnouncementSeparator: '. ',
  carouselIndicators: 'Karusselli slaidid',
  carouselGoTo: 'Mine slaidile {index}',
  scrollerLabel: 'Keritav sisu',
  scrollPrevious: 'Keri tagasi',
  scrollNext: 'Keri edasi',
  closeNavigation: 'Sule navigeerimine',
  openNavigation: 'Ava navigeerimine',
  resizeNavigation: 'Muuda navigeerimise suurust',
  appRailCollapse: 'Ahenda navigeerimine',
  appRailExpand: 'Laienda navigeerimine',
  appRailPin: 'Kinnita navigeerimine',
  appRailUnpin: 'Vabasta navigeerimine',
  appRailItemCollapse: 'Ahenda {label}',
  appRailItemExpand: 'Laienda {label}',
  resizeValuePercent: '{value} protsenti',
  commandPaletteLabel: 'Käsupalett',
  commandPalettePlaceholder: 'Otsi käske…',
  commandPaletteEmpty: 'Sobivaid käske pole.',
  commandPaletteResults: 'Käsud',
  dockPanelCollapse: 'Ahenda paneel',
  dockPanelExpand: 'Laienda paneel',
  dockPanelResize: 'Muuda paneeli suurust',
  responsivePanel: 'Paneel',
  breadcrumb: 'Leivapururada',
  resizeDivider: 'Muuda paneelide {a} ja {b} vahelise eraldaja asukohta',
  widgetFullscreenPanel: 'Täisekraanpaneel',
  widgetViewGroup: 'Paneeli vaade',
  widgetExitFullscreen: 'Välju täisekraanist',
  widgetExpandToFullscreen: 'Laienda täisekraanile',
  widgetCollapse: 'Ahenda paneel',
  widgetExpand: 'Laienda paneel',
  skipToContent: 'Liigu sisu juurde',
  dashboardGridLabel: 'Juhtpaneeli ruudustik',
  dashboardCellCollisionRejected: '{label} ei saa sinna paigutada, sest see kattub teise lahtriga.',
  dashboardCellMoved: '{label} teisaldati: veerg {x}, rida {y}.',
  dashboardCellResized: '{label} uus suurus: laius {w}, kõrgus {h}.',
  filterBarReset: 'Lähtesta filtrid',
  filterBarActiveFilters: 'Aktiivsed filtrid',
  drilldownDocuments: 'Dokumendid',
  drilldownRuns: 'Agendi käivitused',
  drilldownEmpty: 'Üksust pole valitud',
  drilldownUntitledNode: 'Nimetu samm',
  reorderMovePending: 'Ümberjärjestamine ootel.',
  reorderMoveCancelled: 'Ümberjärjestamine tühistatud.',
  commandPaletteResultCount: {
    one: '{count} käsk',
    other: '{count} käsku',
  },
  commandPaletteInputLimit: 'Osa käske jäeti välja, kuna sisendi piirang sai täis.',
};

registerLyraLocale('et', strings);
