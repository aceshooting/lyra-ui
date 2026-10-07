import type { LyraAppRailMode, LyraAppRailPreferredMode } from './app-rail.class.js';

/** Resolves viewport breakpoints and the preferred non-mobile mode. */
export function computeAppRailMode(
  iconOnlyMatches: boolean,
  mobileMatches: boolean,
  preferredMode?: LyraAppRailPreferredMode | null,
): LyraAppRailMode {
  if (mobileMatches) return 'mobile';
  if (preferredMode) return preferredMode;
  if (iconOnlyMatches) return 'icon-only';
  return 'full';
}
