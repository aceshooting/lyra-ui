// The `layout` slice of the lv translation catalog for @aceshooting/lyra-ui: strings owned exclusively by `src/components/layout/**`.
// A side-effect-only module: a consumer writes a bare
// `import '@aceshooting/lyra-translations/lv/layout';` and reads nothing from it. Keep the
// keys in DEFAULT_STRINGS order -- `scripts/check-translations.mjs` enforces coverage, order,
// placeholder names and the plural-category set for this slice, and a catalog that cannot be
// diffed against another line-for-line is a catalog nobody will review.
// Regenerate the SHAPE (never the translations) with:
//   node scripts/scaffold-translation.mjs lv --force
import { registerLyraLocale } from '../../internal/localization-runtime.js';
import type { LyraLocaleStrings } from '../../internal/localization.js';

const strings: LyraLocaleStrings = {
  carousel: 'carousel',
  carouselLabel: 'Carousel',
  carouselSlide: 'slide',
  carouselSlidePosition: 'Slide {index} of {total}',
  carouselSlideAnnouncement: '{position}: {content}',
  carouselSlideAnnouncementSeparator: '. ',
  carouselIndicators: 'Carousel slides',
  carouselGoTo: 'Go to slide {index}',
  scrollerLabel: 'Scrollable content',
  scrollPrevious: 'Scroll backward',
  scrollNext: 'Scroll forward',
  closeNavigation: 'Close navigation',
  openNavigation: 'Open navigation',
  resizeNavigation: 'Resize navigation',
  appRailCollapse: 'Collapse navigation',
  appRailExpand: 'Expand navigation',
  appRailPin: 'Pin navigation',
  appRailUnpin: 'Unpin navigation',
  appRailItemCollapse: 'Collapse {label}',
  appRailItemExpand: 'Expand {label}',
  resizeValuePercent: '{value} percent',
  commandPaletteLabel: 'Command palette',
  commandPalettePlaceholder: 'Search commands…',
  commandPaletteEmpty: 'No matching commands.',
  commandPaletteResults: 'Commands',
  dockPanelCollapse: 'Collapse panel',
  dockPanelExpand: 'Expand panel',
  dockPanelResize: 'Resize panel',
  responsivePanel: 'Panel',
  breadcrumb: 'Breadcrumb',
  resizeDivider: 'Resize divider between panel {a} and panel {b}',
  widgetFullscreenPanel: 'Fullscreen panel',
  widgetViewGroup: 'Panel view',
  widgetExitFullscreen: 'Exit fullscreen',
  widgetExpandToFullscreen: 'Expand to fullscreen',
  widgetCollapse: 'Collapse panel',
  widgetExpand: 'Expand panel',
  skipToContent: 'Skip to content',
  dashboardGridLabel: 'Dashboard grid',
  dashboardCellCollisionRejected: '{label} cannot be placed there because it overlaps another cell.',
  dashboardCellMoved: '{label} moved to column {x}, row {y}.',
  dashboardCellResized: '{label} resized to width {w}, height {h}.',
  filterBarReset: 'Reset filters',
  filterBarActiveFilters: 'Active filters',
  drilldownDocuments: 'Documents',
  drilldownRuns: 'Agent runs',
  drilldownEmpty: 'No item selected',
  drilldownUntitledNode: 'Untitled step',
  reorderMovePending: 'Reorder pending.',
  reorderMoveCancelled: 'Reorder cancelled.',
  commandPaletteResultCount: {
    one: '{count} command',
    other: '{count} commands',
    zero: '{count} commands',
  },
  commandPaletteInputLimit: 'Some commands were omitted because an input limit was reached.',
};

registerLyraLocale('lv', strings);
