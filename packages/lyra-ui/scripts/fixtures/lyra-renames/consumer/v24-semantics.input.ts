import { setLyraTheme, getLyraTheme, type LyraTheme, type LyraThemeMode } from '@aceshooting/lyra-ui/theme.js';
import { applyLyraThemePreset, defineLyraThemePreset, LYRA_THEME_PRESETS, type LyraThemePreset } from '@aceshooting/lyra-ui/theme/presets.js';
import { LYRA_SHADCN_THEME_PRESET } from '@aceshooting/lyra-ui/theme/presets/shadcn.js';
import '@aceshooting/lyra-ui/theme/presets.js';
import '@aceshooting/lyra-ui/theme/presets/shadcn.js';
import { LyraGeojsonView } from '@aceshooting/lyra-ui';
import '@aceshooting/lyra-ui/themes/shadcn.css';
import '@aceshooting/lyra-ui/components/agent-tools/activity-feed/activity-feed.js';
import '@aceshooting/lyra-ui/ssr-loader.js';

const legacyTheme: LyraTheme = getLyraTheme();
const legacyMode: LyraThemeMode = legacyTheme.mode;
const fixedPreset: LyraThemePreset = LYRA_THEME_PRESETS.shadcn;
setLyraTheme({ mode: 'auto', surface: 'Canvas', accent: 'red', tokens: { '--lr-theme-color-surface': '#fff' } });
applyLyraThemePreset(fixedPreset);
defineLyraThemePreset(LYRA_SHADCN_THEME_PRESET);
window.addEventListener('lr-theme-preset-change', () => {});
document.documentElement.setAttribute('data-lr-theme-preset', 'shadcn');
void [LyraGeojsonView, legacyMode];
