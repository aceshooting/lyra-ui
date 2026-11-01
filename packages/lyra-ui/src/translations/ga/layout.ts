// The `layout` slice of the ga translation catalog for @aceshooting/lyra-ui: strings owned exclusively by `src/components/layout/**`.
// A side-effect-only module: a consumer writes a bare
// `import '@aceshooting/lyra-translations/ga/layout';` and reads nothing from it. Keep the
// keys in DEFAULT_STRINGS order -- `scripts/check-translations.mjs` enforces coverage, order,
// placeholder names and the plural-category set for this slice, and a catalog that cannot be
// diffed against another line-for-line is a catalog nobody will review.
// Regenerate the SHAPE (never the translations) with:
//   node scripts/scaffold-translation.mjs ga --force
import { registerLyraLocale } from '../../internal/localization-runtime.js';
import type { LyraLocaleStrings } from '../../internal/localization.js';

const strings: LyraLocaleStrings = {
  carousel: 'timpeallán',
  carouselLabel: 'Timpeallán',
  carouselSlide: 'sleamhnán',
  carouselSlidePosition: 'Sleamhnán {index} as {total}',
  carouselSlideAnnouncement: '{position}: {content}',
  carouselSlideAnnouncementSeparator: '. ',
  carouselIndicators: 'Sleamhnáin an timpealláin',
  carouselGoTo: 'Téigh go sleamhnán {index}',
  scrollerLabel: 'Ábhar inscrollaithe',
  scrollPrevious: 'Scrollaigh siar',
  scrollNext: 'Scrollaigh ar aghaidh',
  closeNavigation: 'Dún an nascleanúint',
  openNavigation: 'Oscail an nascleanúint',
  resizeNavigation: 'Athraigh méid na nascleanúna',
  appRailCollapse: 'Laghdaigh an nascleanúint',
  appRailExpand: 'Leathnaigh an nascleanúint',
  appRailPin: 'Pionnáil an nascleanúint',
  appRailUnpin: 'Díphionnáil an nascleanúint',
  appRailItemCollapse: 'Laghdaigh {label}',
  appRailItemExpand: 'Leathnaigh {label}',
  resizeValuePercent: '{value} faoin gcéad',
  commandPaletteLabel: 'Pailéad orduithe',
  commandPalettePlaceholder: 'Cuardaigh orduithe…',
  commandPaletteEmpty: 'Níl aon ordú comhoiriúnach ann.',
  commandPaletteResults: 'Orduithe',
  dockPanelCollapse: 'Laghdaigh an painéal',
  dockPanelExpand: 'Leathnaigh an painéal',
  dockPanelResize: 'Athraigh méid an phainéil',
  responsivePanel: 'Painéal',
  breadcrumb: 'Conair nascleanúna',
  resizeDivider: 'Athraigh méid an roinnteora idir painéal {a} agus painéal {b}',
  widgetFullscreenPanel: 'Painéal lánscáileáin',
  widgetViewGroup: 'Amharc painéil',
  widgetExitFullscreen: 'Scoir den lánscáileán',
  widgetExpandToFullscreen: 'Leathnaigh go lánscáileán',
  widgetCollapse: 'Laghdaigh an painéal',
  widgetExpand: 'Leathnaigh an painéal',
  skipToContent: 'Léim chuig an ábhar',
  dashboardGridLabel: 'Greille an deais',
  dashboardCellCollisionRejected: 'Ní féidir {label} a chur ansin mar go bhforluíonn sé cill eile.',
  dashboardCellMoved: 'Bogadh {label} go colún {x}, ró {y}.',
  dashboardCellResized: 'Athraíodh méid {label} go leithead {w}, airde {h}.',
  filterBarReset: 'Athshocraigh na scagairí',
  filterBarActiveFilters: 'Scagairí gníomhacha',
  drilldownDocuments: 'Doiciméid',
  drilldownRuns: 'Rití gníomhairí',
  drilldownEmpty: 'Níl aon mhír roghnaithe',
  drilldownUntitledNode: 'Céim gan teideal',
  reorderMovePending: 'Athordú ar feitheamh.',
  reorderMoveCancelled: 'Athordú cealaithe.',
  commandPaletteResultCount: {
    few: '{count} ordú',
    many: '{count} n-ordú',
    one: '{count} ordú',
    other: '{count} ordú',
    two: '{count} ordú',
  },
  commandPaletteInputLimit: 'Fágadh roinnt orduithe ar lár mar gur sroicheadh teorainn ionchuir.',
};

registerLyraLocale('ga', strings);
