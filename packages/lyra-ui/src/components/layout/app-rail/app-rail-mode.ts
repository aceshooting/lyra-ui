/** The rail's effective presentation. */
export type LyraAppRailMode = 'full' | 'icon-only' | 'mobile';

/** The effective mode plus the automatic breakpoint sentinel. */
export type LyraAppRailModeInput = LyraAppRailMode | 'auto';

/** The manually preferred non-mobile mode. */
export type LyraAppRailPreferredMode = Exclude<LyraAppRailMode, 'mobile'>;

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
