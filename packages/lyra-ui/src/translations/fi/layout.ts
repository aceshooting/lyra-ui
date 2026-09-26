// The `layout` slice of the fi translation catalog for @aceshooting/lyra-ui: strings owned exclusively by `src/components/layout/**`.
// A side-effect-only module: a consumer writes a bare
// `import '@aceshooting/lyra-ui/translations/fi/layout';` and reads nothing from it. Keep the
// keys in DEFAULT_STRINGS order -- `scripts/check-translations.mjs` enforces coverage, order,
// placeholder names and the plural-category set for this slice, and a catalog that cannot be
// diffed against another line-for-line is a catalog nobody will review.
// Regenerate the SHAPE (never the translations) with:
//   node scripts/scaffold-translation.mjs fi --force
import { registerLyraLocale } from '../../internal/localization-runtime.js';
import type { LyraLocaleStrings } from '../../internal/localization.js';

const strings: LyraLocaleStrings = {
  carousel: 'karuselli',
  carouselLabel: 'Karuselli',
  carouselSlide: 'dia',
  carouselSlidePosition: 'Dia {index}/{total}',
  carouselSlideAnnouncement: '{position}: {content}',
  carouselSlideAnnouncementSeparator: '. ',
  carouselIndicators: 'Karusellin diat',
  carouselGoTo: 'Siirry diaan {index}',
  scrollerLabel: 'Vieritettävä sisältö',
  scrollPrevious: 'Vieritä taaksepäin',
  scrollNext: 'Vieritä eteenpäin',
  closeNavigation: 'Sulje navigointi',
  openNavigation: 'Avaa navigointi',
  resizeNavigation: 'Muuta navigoinnin kokoa',
  appRailCollapse: 'Tiivistä navigointi',
  appRailExpand: 'Laajenna navigointi',
  appRailItemCollapse: 'Tiivistä: {label}',
  appRailItemExpand: 'Laajenna: {label}',
  resizeValuePercent: '{value} prosenttia',
  commandPaletteLabel: 'Komentopaletti',
  commandPalettePlaceholder: 'Hae komentoja…',
  commandPaletteEmpty: 'Ei vastaavia komentoja.',
  commandPaletteResults: 'Komennot',
  dockPanelCollapse: 'Tiivistä paneeli',
  dockPanelExpand: 'Laajenna paneeli',
  dockPanelResize: 'Muuta paneelin kokoa',
  responsivePanel: 'Paneeli',
  breadcrumb: 'Murupolku',
  resizeDivider: 'Muuta paneelien {a} ja {b} välisen jakajan kokoa',
  widgetFullscreenPanel: 'Koko näytön paneeli',
  widgetViewGroup: 'Paneelinäkymä',
  widgetExitFullscreen: 'Poistu koko näytön tilasta',
  widgetExpandToFullscreen: 'Laajenna koko näytölle',
  widgetCollapse: 'Tiivistä paneeli',
  widgetExpand: 'Laajenna paneeli',
  skipToContent: 'Siirry sisältöön',
  dashboardGridLabel: 'Koontinäytön ruudukko',
  dashboardCellCollisionRejected: 'Kohdetta {label} ei voi sijoittaa tähän, koska se menee toisen solun päälle.',
  dashboardCellMoved: '{label} siirretty: sarake {x}, rivi {y}.',
  dashboardCellResized: '{label}: koko muutettu, leveys {w}, korkeus {h}.',
  filterBarReset: 'Nollaa suodattimet',
  filterBarActiveFilters: 'Aktiiviset suodattimet',
  drilldownDocuments: 'Asiakirjat',
  drilldownRuns: 'Agenttiajot',
  drilldownEmpty: 'Ei valittua kohdetta',
  drilldownUntitledNode: 'Nimetön vaihe',
  reorderMovePending: 'Järjestyksen muutos odottaa.',
  reorderMoveCancelled: 'Järjestyksen muutos peruttu.',
};

registerLyraLocale('fi', strings);
