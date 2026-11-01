// The `layout` slice of the lt translation catalog for @aceshooting/lyra-ui: strings owned exclusively by `src/components/layout/**`.
// A side-effect-only module: a consumer writes a bare
// `import '@aceshooting/lyra-translations/lt/layout';` and reads nothing from it. Keep the
// keys in DEFAULT_STRINGS order -- `scripts/check-translations.mjs` enforces coverage, order,
// placeholder names and the plural-category set for this slice, and a catalog that cannot be
// diffed against another line-for-line is a catalog nobody will review.
// Regenerate the SHAPE (never the translations) with:
//   node scripts/scaffold-translation.mjs lt --force
import { registerLyraLocale } from '../../internal/localization-runtime.js';
import type { LyraLocaleStrings } from '../../internal/localization.js';

const strings: LyraLocaleStrings = {
  carousel: 'karuselė',
  carouselLabel: 'Karuselė',
  carouselSlide: 'skaidrė',
  carouselSlidePosition: 'Skaidrė {index} iš {total}',
  carouselSlideAnnouncement: '{position}: {content}',
  carouselSlideAnnouncementSeparator: '. ',
  carouselIndicators: 'Karuselės skaidrės',
  carouselGoTo: 'Pereiti į {index} skaidrę',
  scrollerLabel: 'Slenkamas turinys',
  scrollPrevious: 'Slinkti atgal',
  scrollNext: 'Slinkti pirmyn',
  closeNavigation: 'Uždaryti naršymą',
  openNavigation: 'Atidaryti naršymą',
  resizeNavigation: 'Keisti naršymo dydį',
  appRailCollapse: 'Suskleisti naršymą',
  appRailExpand: 'Išskleisti naršymą',
  appRailPin: 'Prisegti naršymą',
  appRailUnpin: 'Atsegti naršymą',
  appRailItemCollapse: 'Suskleisti {label}',
  appRailItemExpand: 'Išskleisti {label}',
  resizeValuePercent: '{value} procentų',
  commandPaletteLabel: 'Komandų paletė',
  commandPalettePlaceholder: 'Ieškoti komandų…',
  commandPaletteEmpty: 'Atitinkančių komandų nėra.',
  commandPaletteResults: 'Komandos',
  dockPanelCollapse: 'Suskleisti skydelį',
  dockPanelExpand: 'Išskleisti skydelį',
  dockPanelResize: 'Keisti skydelio dydį',
  responsivePanel: 'Skydelis',
  breadcrumb: 'Naršymo kelias',
  resizeDivider: 'Keisti skirtuko tarp skydelių {a} ir {b} padėtį',
  widgetFullscreenPanel: 'Viso ekrano skydelis',
  widgetViewGroup: 'Skydelio rodinys',
  widgetExitFullscreen: 'Išeiti iš viso ekrano režimo',
  widgetExpandToFullscreen: 'Išskleisti per visą ekraną',
  widgetCollapse: 'Suskleisti skydelį',
  widgetExpand: 'Išskleisti skydelį',
  skipToContent: 'Pereiti prie turinio',
  dashboardGridLabel: 'Skydelio tinklelis',
  dashboardCellCollisionRejected: '{label} negalima ten padėti, nes persidengia su kitu langeliu.',
  dashboardCellMoved: '{label} perkelta į {x} stulpelį, {y} eilutę.',
  dashboardCellResized: '{label} dydis pakeistas: plotis {w}, aukštis {h}.',
  filterBarReset: 'Atkurti filtrus',
  filterBarActiveFilters: 'Aktyvūs filtrai',
  drilldownDocuments: 'Dokumentai',
  drilldownRuns: 'Agento paleidimai',
  drilldownEmpty: 'Nepasirinktas joks elementas',
  drilldownUntitledNode: 'Veiksmas be pavadinimo',
  reorderMovePending: 'Laukiama pertvarkymo.',
  reorderMoveCancelled: 'Pertvarkymas atšauktas.',
  commandPaletteResultCount: {
    few: '{count} komandos',
    many: '{count} komandos',
    one: '{count} komanda',
    other: '{count} komandų',
  },
  commandPaletteInputLimit: 'Kai kurios komandos praleistos, nes pasiekta įvesties riba.',
};

registerLyraLocale('lt', strings);
