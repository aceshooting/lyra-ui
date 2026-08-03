import { GEMSTONES } from './gemstones-data.js';
import { setLyraTheme, type LyraTheme } from './theme.js';

/** A named, reusable application theme choice. */
export interface LyraThemePreset {
  /** Stable lowercase identifier reflected to `data-lr-theme-preset`. */
  readonly id: string;
  /** Mode/accent fields passed through the production theme runtime. */
  readonly theme: Readonly<Partial<LyraTheme>>;
}

/** Detail emitted on `window` after a preset is applied. */
export interface LyraThemePresetChangeDetail {
  /** Applied preset id. */
  readonly id: string;
  /** Semantic fields requested by the preset. */
  readonly theme: Readonly<Partial<LyraTheme>>;
}

declare global {
  interface WindowEventMap {
    'lr-theme-preset-change': CustomEvent<LyraThemePresetChangeDetail>;
  }
}

/**
 * Validates and freezes an application-owned preset. The id, closed mode vocabulary, and accent
 * value shape are checked here; CSS color syntax is validated by the production runtime when the
 * preset is applied. Presets intentionally contain semantic choices rather than arbitrary token
 * strings, keeping OS following, contrast validation, persistence, canvas invalidation, and
 * no-flash boot on the same production path.
 */
export function defineLyraThemePreset<const Preset extends LyraThemePreset>(
  preset: Preset,
): Readonly<Preset> {
  if (typeof preset?.id !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(preset.id)) {
    throw new TypeError('Lyra theme preset ids must be lowercase kebab-case.');
  }
  if (!preset.theme || typeof preset.theme !== 'object' || Array.isArray(preset.theme)) {
    throw new TypeError('Lyra theme presets require a theme record.');
  }
  const { mode, accent } = preset.theme;
  if (mode !== undefined
      && mode !== 'light'
      && mode !== 'dark'
      && mode !== 'auto'
      && mode !== 'unset') {
    throw new TypeError('Lyra theme preset mode must be light, dark, auto, or unset.');
  }
  if (accent !== undefined && accent !== null && typeof accent !== 'string') {
    throw new TypeError('Lyra theme preset accent must be a CSS color string or null.');
  }
  const theme = Object.freeze({ ...preset.theme });
  return Object.freeze({ ...preset, theme }) as Readonly<Preset>;
}

/** Built-in semantic and gemstone-accent choices. */
export const LYRA_THEME_PRESETS = Object.freeze({
  system: defineLyraThemePreset({ id: 'system', theme: { mode: 'auto', accent: null } }),
  light: defineLyraThemePreset({ id: 'light', theme: { mode: 'light', accent: null } }),
  dark: defineLyraThemePreset({ id: 'dark', theme: { mode: 'dark', accent: null } }),
  unset: defineLyraThemePreset({ id: 'unset', theme: { mode: 'unset', accent: null } }),
  emerald: defineLyraThemePreset({
    id: 'emerald',
    theme: { mode: 'auto', accent: GEMSTONES.emerald.fill },
  }),
  ruby: defineLyraThemePreset({
    id: 'ruby',
    theme: { mode: 'auto', accent: GEMSTONES.ruby.fill },
  }),
  amethyst: defineLyraThemePreset({
    id: 'amethyst',
    theme: { mode: 'auto', accent: GEMSTONES.amethyst.fill },
  }),
  sapphire: defineLyraThemePreset({
    id: 'sapphire',
    theme: { mode: 'auto', accent: GEMSTONES.sapphire.fill },
  }),
});

export type LyraThemePresetName = keyof typeof LYRA_THEME_PRESETS;

/** Applies a built-in key or an application preset and announces the completed change. */
export function applyLyraThemePreset(
  presetOrName: LyraThemePresetName | Readonly<LyraThemePreset>,
): void {
  const preset = typeof presetOrName === 'string'
    ? Object.prototype.hasOwnProperty.call(LYRA_THEME_PRESETS, presetOrName)
      ? LYRA_THEME_PRESETS[presetOrName as LyraThemePresetName]
      : undefined
    : presetOrName;
  if (!preset) throw new TypeError(`Unknown Lyra theme preset: ${String(presetOrName)}`);
  // Revalidate external objects even when callers bypass defineLyraThemePreset().
  const normalized = defineLyraThemePreset(preset);
  setLyraTheme(normalized.theme);
  document.documentElement.dataset['lrThemePreset'] = normalized.id;
  const detail: LyraThemePresetChangeDetail = {
    id: normalized.id,
    theme: normalized.theme,
  };
  window.dispatchEvent(new CustomEvent<LyraThemePresetChangeDetail>('lr-theme-preset-change', {
    detail,
  }));
}
