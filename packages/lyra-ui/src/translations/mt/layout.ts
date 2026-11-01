// The `layout` slice of the mt translation catalog for @aceshooting/lyra-ui: strings owned exclusively by `src/components/layout/**`.
// A side-effect-only module: a consumer writes a bare
// `import '@aceshooting/lyra-translations/mt/layout';` and reads nothing from it. Keep the
// keys in DEFAULT_STRINGS order -- `scripts/check-translations.mjs` enforces coverage, order,
// placeholder names and the plural-category set for this slice, and a catalog that cannot be
// diffed against another line-for-line is a catalog nobody will review.
// Regenerate the SHAPE (never the translations) with:
//   node scripts/scaffold-translation.mjs mt --force
import { registerLyraLocale } from '../../internal/localization-runtime.js';
import type { LyraLocaleStrings } from '../../internal/localization.js';

const strings: LyraLocaleStrings = {
  carousel: 'karużell',
  carouselLabel: 'Karużell',
  carouselSlide: 'slajd',
  carouselSlidePosition: 'Slajd {index} minn {total}',
  carouselSlideAnnouncement: '{position}: {content}',
  carouselSlideAnnouncementSeparator: '. ',
  carouselIndicators: 'Slajds tal-karużell',
  carouselGoTo: 'Mur għas-slajd {index}',
  scrollerLabel: 'Kontenut li jiskrollja',
  scrollPrevious: 'Skrollja lura',
  scrollNext: 'Skrollja ’l quddiem',
  closeNavigation: 'Agħlaq in-navigazzjoni',
  openNavigation: 'Iftaħ in-navigazzjoni',
  resizeNavigation: 'Ibdel id-daqs tan-navigazzjoni',
  appRailCollapse: 'Ikkollassa n-navigazzjoni',
  appRailExpand: 'Espandi n-navigazzjoni',
  appRailPin: 'Waħħal in-navigazzjoni',
  appRailUnpin: 'Neħħi l-waħħil tan-navigazzjoni',
  appRailItemCollapse: 'Ikkollassa {label}',
  appRailItemExpand: 'Espandi {label}',
  resizeValuePercent: '{value} fil-mija',
  commandPaletteLabel: 'Paletta tal-kmandi',
  commandPalettePlaceholder: 'Fittex kmandi…',
  commandPaletteEmpty: 'L-ebda kmand ma jaqbel.',
  commandPaletteResults: 'Kmandi',
  dockPanelCollapse: 'Ikkollassa l-pannell',
  dockPanelExpand: 'Espandi l-pannell',
  dockPanelResize: 'Ibdel id-daqs tal-pannell',
  responsivePanel: 'Pannell',
  breadcrumb: 'Mogħdija tan-navigazzjoni',
  resizeDivider: 'Ibdel id-daqs tad-diviżorju bejn il-pannell {a} u l-pannell {b}',
  widgetFullscreenPanel: 'Pannell fuq skrin sħiħ',
  widgetViewGroup: 'Veduta tal-pannell',
  widgetExitFullscreen: 'Oħroġ mill-iskrin sħiħ',
  widgetExpandToFullscreen: 'Espandi għal skrin sħiħ',
  widgetCollapse: 'Ikkollassa l-pannell',
  widgetExpand: 'Espandi l-pannell',
  skipToContent: 'Aqbeż għall-kontenut',
  dashboardGridLabel: 'Grilja tal-pannell tal-kontroll',
  dashboardCellCollisionRejected: '{label} ma jistax jitqiegħed hemm għax jikkoinċidi ma’ ċellola oħra.',
  dashboardCellMoved: '{label} imċaqlaq għall-kolonna {x}, ringiela {y}.',
  dashboardCellResized: 'Id-daqs ta’ {label} inbidel għal wisa’ {w}, għoli {h}.',
  filterBarReset: 'Irrisettja l-filtri',
  filterBarActiveFilters: 'Filtri attivi',
  drilldownDocuments: 'Dokumenti',
  drilldownRuns: 'Eżekuzzjonijiet tal-aġenti',
  drilldownEmpty: 'L-ebda element magħżul',
  drilldownUntitledNode: 'Pass bla titlu',
  reorderMovePending: 'Riordinar pendenti.',
  reorderMoveCancelled: 'Riordinar ikkanċellat.',
  commandPaletteResultCount: {
    few: '{count} kmandi',
    many: '{count} kmand',
    one: '{count} kmand',
    other: '{count} kmand',
    two: '{count} kmandi',
  },
  commandPaletteInputLimit: 'Xi kmandi tħallew barra għax intlaħaq limitu tal-input.',
};

registerLyraLocale('mt', strings);
