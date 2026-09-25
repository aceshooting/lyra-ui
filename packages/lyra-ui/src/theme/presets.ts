import { GEMSTONES } from './gemstones-data.js';
import {
  accentsEqual,
  getLyraTheme,
  isLyraThemeTokenName,
  isSafeLyraThemeTokenValue,
  setLyraTheme,
  tokensEqual,
  type LyraTheme,
  type LyraThemeTokens,
  type LyraThemeTokenValue,
} from './theme.js';

/** A named, reusable application theme choice. */
export interface LyraThemePreset {
  /** Stable lowercase identifier reflected to `data-lr-theme-preset`. */
  readonly id: string;
  /** Mode/accent/surface/tokens fields passed through the production theme runtime. */
  readonly theme: Readonly<Partial<LyraTheme>>;
}

/** Detail emitted on `window` after a preset is applied. */
export interface LyraThemePresetChangeDetail {
  /** Applied preset id. */
  readonly id: string;
  /** Complete semantic snapshot the production runtime applied. */
  readonly theme: Readonly<LyraTheme>;
}

declare global {
  interface WindowEventMap {
    'lr-theme-preset-change': CustomEvent<LyraThemePresetChangeDetail>;
  }
}

const TOKEN_ENTRY_MAX = 512;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value) as unknown;
  return prototype === Object.prototype || prototype === null;
}

function validateTokenValue(name: string, value: unknown): string {
  if (!isSafeLyraThemeTokenValue(value)) {
    throw new TypeError(`Lyra theme preset token ${name} has an unsafe or malformed CSS value.`);
  }
  return value.trim();
}

/**
 * Validates a preset token map against the runtime grammar and returns a trimmed, deep-frozen
 * copy whose per-mode entries carry both `light` and `dark`. Throws exactly where the runtime would
 * drop, so a define-valid map is never changed by runtime normalization.
 */
function validatePresetTokens(tokens: unknown): LyraThemeTokens | null {
  if (tokens === null) return null;
  if (!isPlainObject(tokens)) {
    throw new TypeError('Lyra theme preset tokens must be a plain object of --lr-theme-* values, or null.');
  }
  const names = Object.keys(tokens);
  if (names.length > TOKEN_ENTRY_MAX) {
    throw new TypeError(`Lyra theme preset tokens are limited to ${TOKEN_ENTRY_MAX} entries.`);
  }
  const result: Record<string, LyraThemeTokenValue> = {};
  for (const name of names) {
    if (!isLyraThemeTokenName(name)) {
      throw new TypeError(`Lyra theme preset token names must be --lr-theme-* inputs other than --lr-theme-accent: ${name}`);
    }
    const value = tokens[name];
    if (typeof value === 'string') {
      result[name] = validateTokenValue(name, value);
      continue;
    }
    if (!isPlainObject(value)) {
      throw new TypeError(`Lyra theme preset token ${name} must be a CSS value string or a { light, dark } record.`);
    }
    const keys = Object.keys(value);
    if (keys.some((key) => key !== 'light' && key !== 'dark')
        || (!Object.prototype.hasOwnProperty.call(value, 'light') && !Object.prototype.hasOwnProperty.call(value, 'dark'))) {
      throw new TypeError(`Lyra theme preset token ${name} must use only light and dark keys, and at least one of them.`);
    }
    const branch = (mode: 'light' | 'dark'): string | null => {
      const raw = value[mode];
      if (raw === undefined || raw === null) return null;
      return validateTokenValue(name, raw);
    };
    const light = branch('light');
    const dark = branch('dark');
    if (light === null && dark === null) {
      throw new TypeError(`Lyra theme preset token ${name} needs a light or a dark value.`);
    }
    result[name] = Object.freeze({ light, dark });
  }
  return Object.freeze(result) as LyraThemeTokens;
}

/**
 * Validates and freezes an application-owned preset. The id, the closed mode vocabulary, the
 * accent value shape and the whole token map are checked here; accent and surface colour syntax is
 * still validated by the production runtime when the preset is applied.
 *
 * `tokens` is a validated map of `--lr-theme-*` inputs, each a CSS value or a `{ light, dark }`
 * pair. It is checked against the same DOM-free grammar the runtime and the no-flash bootstrap
 * apply (names, value characters, allowed functions, balanced parentheses and quotes, at most 512
 * entries), and any violation throws `TypeError`, so a map accepted here always survives runtime
 * normalization unchanged. The stored copy is trimmed and deep-frozen, with both `light` and
 * `dark` on every per-mode entry. A token map is a look: an independent axis from `mode`, `accent`
 * and `surface`, so a preset that omits those fields leaves them as they are, and the built-in
 * presets, which never mention `tokens`, leave a look in place. Every field still goes through the
 * production path: OS following, contrast validation, persistence, canvas invalidation, and
 * no-flash boot.
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
  const { mode, accent, surface } = preset.theme;
  if (mode !== undefined
      && mode !== 'light'
      && mode !== 'dark'
      && mode !== 'auto'
      && mode !== 'unset') {
    throw new TypeError('Lyra theme preset mode must be light, dark, auto, or unset.');
  }
  const isPlainAccentRecord = typeof accent === 'object' && accent !== null && !Array.isArray(accent);
  if (accent !== undefined && accent !== null && typeof accent !== 'string' && !isPlainAccentRecord) {
    throw new TypeError(
      'Lyra theme preset accent must be a CSS color string, a per-role color record, or null.',
    );
  }
  if (surface !== undefined && surface !== null && typeof surface !== 'string') {
    throw new TypeError('Lyra theme preset surface must be a CSS color string or null.');
  }
  const { tokens } = preset.theme;
  const theme = tokens === undefined
    ? Object.freeze({ ...preset.theme })
    : Object.freeze({ ...preset.theme, tokens: validatePresetTokens(tokens) });
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

/**
 * Applies a built-in key or an application preset. The preset marker and
 * `lr-theme-preset-change` event are published only when runtime normalization accepts every
 * explicitly requested field; otherwise `lr-theme-change` remains the truthful notification for
 * the normalized state and no exact named-preset identity is claimed.
 */
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
  const applied = Object.freeze({ ...getLyraTheme() });
  // Read via a widened alias: a built-in preset's theme infers an ultra-narrow literal type that
  // never mentions `surface` or `tokens` at all (none of them set either), which
  // `normalized.theme.surface` alone cannot type-check against.
  const requested = normalized.theme as Partial<LyraTheme>;
  const matchesApplied = (requested.mode === undefined || requested.mode === applied.mode)
    && (requested.accent === undefined || accentsEqual(requested.accent, applied.accent))
    && (requested.surface === undefined || requested.surface === applied.surface)
    && (requested.tokens === undefined || tokensEqual(requested.tokens, applied.tokens));
  if (!matchesApplied) return;

  document.documentElement.dataset['lrThemePreset'] = normalized.id;
  const detail: LyraThemePresetChangeDetail = Object.freeze({
    id: normalized.id,
    theme: applied,
  });
  window.dispatchEvent(new CustomEvent<LyraThemePresetChangeDetail>('lr-theme-preset-change', {
    detail,
  }));
}
