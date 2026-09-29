import { defineLyraLook, getLyraStyle, setLyraStyle } from '@aceshooting/lyra-ui/theme.js';
import type { LyraLook, LyraMode, LyraStyle, LyraStyleChoices } from '@aceshooting/lyra-ui/theme.js';
import { LYRA_SHADCN_LOOK } from '@aceshooting/lyra-ui/theme/looks/shadcn.js';
import '@aceshooting/lyra-ui/theme.css';
import '@aceshooting/lyra-ui/looks/shadcn.css';
import '@aceshooting/lyra-ui/components/lr-activity-feed.js';
import { LyraGeoJsonViewer } from '@aceshooting/lyra-ui/components/viewers/geojson-view/geojson-viewer.class.js';

const namedPalette: LyraStyleChoices = { mode: 'system', surface: 'glass', density: 'compact', accent: 'sapphire' };
const literalColor: LyraStyleChoices = { mode: 'system', accentBackground: 'red' };
const pairedSurfaceColor: LyraStyleChoices = {
  mode: 'system',
  surface: 'solid',
  overrides: { '--lr-theme-color-surface': { light: 'Canvas', dark: '#17191d' } },
};
const customLook: LyraLook = defineLyraLook({
  id: 'consumer-look',
  tokens: { '--lr-theme-color-surface': { light: '#f7f7f8', dark: '#17191d' } },
});
const restored: Readonly<LyraStyle> = getLyraStyle();
const mode: LyraMode = restored.mode;
setLyraStyle(namedPalette);
setLyraStyle(literalColor);
setLyraStyle(pairedSurfaceColor);
setLyraStyle({ look: customLook });
setLyraStyle({ look: LYRA_SHADCN_LOOK });
const canonicalClass: typeof LyraGeoJsonViewer = LyraGeoJsonViewer;
void [mode, canonicalClass];

export async function loadForRuntime(): Promise<void> {
  if (typeof window === 'undefined') {
    await import('@aceshooting/lyra-ui/ssr.js');
    return;
  }
  await import('@aceshooting/lyra-ui/hydration.js');
  await import('@aceshooting/lyra-ui/components/lr-activity-feed.js');
}
