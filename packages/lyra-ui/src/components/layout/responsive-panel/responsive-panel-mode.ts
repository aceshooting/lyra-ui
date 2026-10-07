import type { LyraResponsivePanelMode, LyraResponsivePanelEffectiveMode } from './responsive-panel.class.js';

/** Resolves the configured mode against the current allocation. */
export function resolveResponsivePanelEffectiveMode(
  mode: LyraResponsivePanelMode,
  belowBreakpoint: boolean,
): LyraResponsivePanelEffectiveMode {
  if (mode === 'inline' || mode === 'overlay') return mode;
  return belowBreakpoint ? 'overlay' : 'inline';
}
