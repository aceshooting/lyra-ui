/**
 * Anchored positioning over Floating UI: `place()`, `trackRect()`, and virtual anchors.
 *
 * Part of the curated `@aceshooting/lyra-ui/utilities/*` surface: these re-exports are the
 * supported entry points, and they are covered by semver. The `internal/` modules they forward to
 * are not — that tree is free to move.
 */
export { place, trackRect, virtualAnchorFromRect } from '../internal/positioner.js';
export type {
  PlacementResult,
  PlaceAutoSize,
  PlaceBoundary,
  PlaceFlipFallbackStrategy,
  PlaceOptions,
  PlaceStrategy,
  PlaceSync,
  VirtualAnchor,
} from '../internal/positioner.js';
