import {
  invalidateLyraTheme,
  type LyraThemeRoot,
} from '../src/lyra.js';
import {
  invalidateLyraTheme as invalidateGranular,
  type LyraThemeRoot as GranularThemeRoot,
} from '../src/utilities/theme.js';

declare const root: LyraThemeRoot;
declare const granularRoot: GranularThemeRoot;

invalidateLyraTheme();
invalidateLyraTheme(root);
invalidateGranular(granularRoot);

// @ts-expect-error arbitrary values are not valid theme roots
invalidateLyraTheme('document');
