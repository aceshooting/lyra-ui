/**
 * `lockScroll()` — a ref-counted document scroll lock, safe to acquire concurrently.
 *
 * Part of the curated `@aceshooting/lyra-ui/utilities/*` surface: these re-exports are the
 * supported entry points, and they are covered by semver. The `internal/` modules they forward to
 * are not — that tree is free to move.
 */
export { lockScroll } from '../internal/scroll-lock.js';
