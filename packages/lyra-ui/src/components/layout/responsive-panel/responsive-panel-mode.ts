/** The configured mode; auto tracks the allocation breakpoint. */
export type LyraResponsivePanelMode = 'inline' | 'overlay' | 'auto';

/** The presentation after resolving the breakpoint. */
export type LyraResponsivePanelEffectiveMode = 'inline' | 'overlay';

/** Resolves the configured mode against the current allocation. */
export function resolveResponsivePanelEffectiveMode(
  mode: LyraResponsivePanelMode,
  belowBreakpoint: boolean,
): LyraResponsivePanelEffectiveMode {
  if (mode === 'inline' || mode === 'overlay') return mode;
  return belowBreakpoint ? 'overlay' : 'inline';
}
