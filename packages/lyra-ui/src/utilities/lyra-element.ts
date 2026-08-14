/**
 * The base class every component extends: shared token styles, `emit()`, the typed
 * `addEventListener` overload, `locale`/`strings`, and the memoized `localize()` helpers.
 *
 * Part of the curated `@aceshooting/lyra-ui/utilities/*` surface: these re-exports are the
 * supported entry points, and they are covered by semver. The `internal/` modules they forward to
 * are not — that tree is free to move.
 */
export { LyraElement } from '../internal/lyra-element.js';
export type {
  LyraEmitArgs,
  LyraEmittedEvent,
  LyraEmitOptions,
  LyraEventMap,
} from '../internal/lyra-element.js';
