/**
 * `activateOverlay()` — the per-document topmost-overlay stack that coordinates
 * Escape handling, light dismiss and focus return across every overlay in the library.
 *
 * Part of the curated `@aceshooting/lyra-ui/utilities/*` surface: these re-exports are the
 * supported entry points, and they are covered by semver. The `internal/` modules they forward to
 * are not — that tree is free to move.
 */
export { activateOverlay, suspendLyraModalsFor } from '../internal/overlay-manager.js';
export type {
  OverlayActivationOptions,
  OverlayDeactivateOptions,
  OverlayHandle,
  OverlayRestoreFocusTarget,
} from '../internal/overlay-manager.js';
