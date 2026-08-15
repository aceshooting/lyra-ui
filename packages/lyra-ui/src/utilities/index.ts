// The curated public helper surface. Everything re-exported here is supported and semver-covered;
// `src/internal/**` is not, and is no longer a published subpath.
//
// Import a single helper (`@aceshooting/lyra-ui/utilities/positioner`) rather than this barrel when
// you only need one -- the barrel reaches every module it names.
export { LyraElement } from './lyra-element.js';
export type {
  LyraEmitArgs,
  LyraEmittedEvent,
  LyraEmitOptions,
  LyraEventMap,
} from './lyra-element.js';
export { defineElement, LYRA_PREFIX, tag } from './prefix.js';
export { nextId, srOnly } from './a11y.js';
export {
  calendarIcon,
  chevronIcon,
  closeIcon,
  expandIcon,
  eyeIcon,
  eyeOffIcon,
  fileIcon,
  folderIcon,
  pauseIcon,
  playIcon,
  spinnerIcon,
} from './icons.js';
export { place, trackRect, virtualAnchorFromRect } from './positioner.js';
export type {
  PlacementResult,
  PlaceAutoSize,
  PlaceBoundary,
  PlaceFlipFallbackStrategy,
  PlaceOptions,
  PlaceStrategy,
  PlaceSync,
  VirtualAnchor,
} from './positioner.js';
export { activateOverlay, suspendLyraModalsFor } from './overlay-manager.js';
export type {
  OverlayActivationOptions,
  OverlayDeactivateOptions,
  OverlayHandle,
  OverlayRestoreFocusTarget,
} from './overlay-manager.js';
export { lockScroll } from './scroll-lock.js';
export {
  acquireAnnouncementSink,
  ANNOUNCEMENT_SINK_ATTRIBUTE,
  Announcer,
} from './announcer.js';
export type {
  AnnounceOptions,
  AnnouncementPoliteness,
  AnnouncementSink,
  AnnouncementSinkOptions,
  AnnouncerOptions,
  AnnouncerTimerHost,
} from './announcer.js';
export { layeredLayout } from './layered-layout.js';
export type {
  LayeredLayoutEdge,
  LayeredLayoutNode,
  LayeredLayoutOptions,
  LayeredLayoutResult,
} from './layered-layout.js';
export {
  attachInternalsSafely,
  createFallbackInternals,
  createStringArrayFormDataState,
  FormAssociated,
  isEmptyFormValue,
  readStringArrayFormDataState,
  stringFormValueAdapter,
} from './form-associated.js';
export type {
  FormAssociatedInterface,
  FormAssociatedSubclassInterface,
  FormOwnerValue,
  FormSubmissionValue,
  FormValueAdapter,
} from './form-associated.js';
export { groupByRecency } from './group-by-recency.js';
export type {
  GroupByRecencyOptions,
  RecencyBucket,
  RecencyLabels,
} from './group-by-recency.js';
export { bridgeLyraLocale, subscribeLyraLocale } from './localization.js';
export type {
  LyraLocaleBridgeCleanup,
  LyraLocaleBridgeOptions,
} from './localization.js';
export { getAnimation, setAnimation, setDefaultAnimation } from './animation-registry.js';
export type {
  LyraAnimationCleanup,
  LyraElementAnimation,
  LyraGetAnimationOptions,
  LyraResolvedElementAnimation,
} from './animation-registry.js';
export { allDefined } from './defined.js';
export type { AllDefinedOptions, LyraDefinitionRoot } from './defined.js';
export { resolveCssLength } from './css-length.js';
export type { ResolveCssLengthOptions } from './css-length.js';
export { invalidateLyraTheme } from './theme.js';
export type { LyraThemeRoot } from './theme.js';
export type { LyraCatalog, LyraCatalogEntry } from './catalog.js';
export type {
  LyraAnchorTarget,
  LyraAnchorTargetEventMap,
} from './anchor-target.js';
