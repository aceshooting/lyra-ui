import type { LyraThemeTokens, LyraThemeTokenValue } from '../internal/theme-token-types.js';

/** @internal Pure saved-field resolution; serialized unchanged into the self-contained prepaint script. */
export function resolveStyleStartup(
  saved: unknown,
  defaults: { readonly look: string; readonly surface: string; readonly density: string; readonly mode: string; readonly accent: string },
  normalizeMap: (value: unknown) => LyraThemeTokens | null,
  supportsColor: (value: string) => boolean,
  allowed: (name: string, value: LyraThemeTokenValue) => boolean,
  gemstones: Readonly<Record<string, string>>,
): Record<string, unknown> {
  const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
  const field = (value: unknown, name: string): unknown => {
    if (!object(value)) return undefined;
    const descriptor = Object.getOwnPropertyDescriptor(value, name);
    return descriptor && 'value' in descriptor ? descriptor.value : undefined;
  };
  const id = (value: unknown): value is string => typeof value === 'string' && value.length <= 64 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
  const map = (value: unknown): LyraThemeTokens | null => {
    const result = normalizeMap(value);
    return result && Object.keys(result).length ? result : null;
  };
  const overrides = (value: unknown): LyraThemeTokens | null => {
    const entries = Object.entries(map(value) ?? {}).filter(([name, input]) => allowed(name, input));
    return entries.length ? Object.fromEntries(entries) : null;
  };
  const color = (value: unknown): string | undefined => {
    if (typeof value !== 'string') return undefined;
    const candidate = map({ '--lr-theme-startup-color': value })?.['--lr-theme-startup-color'];
    if (typeof candidate !== 'string' || /\b(?:var|light-dark)\s*\(|\b(?:currentcolor|from)\b/i.test(candidate)) return undefined;
    if (/^(?:accentcolor|accentcolortext|activetext|buttonborder|buttonface|buttontext|canvas|canvastext|field|fieldtext|graytext|highlight|highlighttext|linktext|mark|marktext|selecteditem|selecteditemtext|visitedtext)$/i.test(candidate)) return undefined;
    return supportsColor(candidate) ? candidate : undefined;
  };
  const pair = (value: unknown): unknown => {
    if (value === null) return null;
    if (typeof value === 'string') return color(value);
    if (!object(value)) return undefined;
    const result: Record<string, string | null> = {};
    for (const branch of ['light', 'dark']) {
      const input = field(value, branch);
      const normalized = input === null ? null : color(input);
      if (normalized !== undefined) result[branch] = normalized;
    }
    return Object.keys(result).length ? { light: result['light'] ?? null, dark: result['dark'] ?? null } : undefined;
  };
  const accent = (value: unknown): unknown => {
    if (value === null || typeof value === 'string') return pair(value);
    if (!object(value)) return undefined;
    const result: Record<string, unknown> = {};
    for (const role of ['brand', 'success', 'warning', 'danger', 'neutral']) {
      const normalized = pair(field(value, role));
      if (normalized !== undefined) result[role] = normalized;
    }
    return Object.keys(result).length ? result : undefined;
  };
  const fallback: Record<string, unknown> = {
    version: 2, look: defaults.look, treatment: defaults.surface, density: defaults.density,
    mode: defaults.mode, accent: gemstones[defaults.accent], accentName: defaults.accent, surface: null,
  };

  const version = field(saved, 'version');
  if (!object(saved) || (version !== undefined && version !== 2)) return fallback;
  const result = { ...fallback };
  const savedLook = field(saved, 'look');
  const tokens = map(field(saved, 'tokens'));
  if (id(savedLook) || tokens) {
    result['look'] = id(savedLook) ? savedLook : 'custom';
    delete result['tokens'];
    if (tokens) result['tokens'] = tokens;
  }
  for (const [key, values] of [
    ['treatment', ['solid', 'glass']], ['density', ['comfortable', 'compact', 'touch']], ['mode', ['light', 'dark', 'system', 'auto', 'unset']],
  ] as const) {
    const value = field(saved, key);
    if (typeof value === 'string' && (values as readonly string[]).includes(value)) result[key] = value === 'auto' ? 'system' : value;
  }
  const savedName = field(saved, 'accentName');
  const savedAccent = accent(field(saved, 'accent'));
  if (version === 2 && typeof savedName === 'string' && Object.hasOwn(gemstones, savedName)) {
    result['accentName'] = savedName;
    result['accent'] = gemstones[savedName];
  } else if (savedAccent !== undefined) {
    delete result['accentName'];
    result['accent'] = savedAccent;
  }
  const background = pair(field(saved, 'surface'));
  if (background !== undefined) result['surface'] = background;
  const savedOverrides = field(saved, 'overrides');
  const normalizedOverrides = overrides(savedOverrides);
  if (savedOverrides === null || normalizedOverrides) {
    delete result['overrides'];
    if (normalizedOverrides) result['overrides'] = normalizedOverrides;
  }
  return result;
}
