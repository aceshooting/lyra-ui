/**
 * Standalone style runtime, published as the `@aceshooting/lyra-ui/theme.js`
 * subpath. Shared helpers remain dependency-free; applications need no component imports.
 * Applications persist and apply styles without importing Lit or the component graph.
 *
 * This module is side-effect-free -- importing it never touches the document or storage -- and
 * therefore carries no `package.json#sideEffects` entry, so bundlers may drop it when unused.
 */

import { devWarnOnce, litDevWarnings } from '../internal/dev-warning.js';
import type { LyraThemeTokenName, LyraThemeTokens, LyraThemeTokenValue } from '../internal/theme-token-types.js';
import { readStyleOwnership, type StyleOwnership } from './style-ownership.js';
import { resolveStyleStartup } from './startup-resolution.js';

export type { LyraThemeTokenName, LyraThemeTokens, LyraThemeTokenValue } from '../internal/theme-token-types.js';

const STORAGE_KEY = 'lyra-theme';

export interface LyraThemeBootstrapOptions {
  /** The localStorage key holding a `{ mode, accent, surface, tokens? }` theme record. */
  storageKey?: string;
}

/**
 * A semantic role the runtime can derive a contrast-checked quiet/normal/loud/on-* ramp for.
 * Mirrors the five roles `--lr-color-<role>-*` already exposes in the static palette
 * (`src/internal/tokens/palette.styles.ts`): only `'brand'` also drives `--lr-theme-color-focus`.
 */
export type LyraThemeSemanticRole = 'brand' | 'success' | 'warning' | 'danger' | 'neutral';

/**
 * One semantic role's accent input: an absolute CSS color, `null` to clear that role back to the
 * palette default, or `{ light?, dark? }` to derive the role's ramp from a *different* base color
 * per resolved mode (each branch independently absolute-CSS-color-or-`null`, defaulting to `null`
 * when omitted). A bare string/`null` applies to both modes uniformly, matching every pre-16.0.0
 * per-role value unchanged.
 */
export type LyraThemeAccentValue = string | null | { readonly light?: string | null; readonly dark?: string | null };

/**
 * Absolute CSS color input for the accent ramp(s). A bare string is shorthand for
 * `{ brand: <that string> }`, matching every pre-16.0.0 caller unchanged. An object supplies a
 * `LyraThemeAccentValue` per semantic role -- only the roles present are (re)derived; omitted
 * roles keep whatever the shipped/inherited palette already provides. `null` (at either level)
 * clears that role back to the palette default.
 */
export type LyraThemeAccent =
  | string
  | null
  | { readonly [role in LyraThemeSemanticRole]?: LyraThemeAccentValue };

type ResolvedThemeMode = 'light' | 'dark';
type Rgb = readonly [red: number, green: number, blue: number];

// The theme-token grammar. scripts/fixtures/theme-token-grammar.json is the single source of these
// constants; this is one of its two literal copies in this file (the bootstrap carries the other,
// because it must stay self-contained), and scripts/theme-token-grammar.test.mjs fails if either
// drifts. The rule is DOM-free on purpose: CSS.supports() accepts every unclosed construct, which
// then corrupts the rest of the inline style attribute when it is re-parsed.
const TOKEN_NAME_PATTERN = /^--lr-theme-[a-z0-9]+(?:-[a-z0-9]+)*$/;
const TOKEN_NAME_MAX_LENGTH = 80;
const TOKEN_RESERVED_NAME = '--lr-theme-accent';
const TOKEN_ENTRY_MAX = 512;
const TOKEN_SYNTHESIZED_MAX = 16;
const TOKEN_VALUE_MAX_LENGTH = 256;
const TOKEN_FORBIDDEN_PATTERN = /[\x00-\x1f\x7f\\;{}!<>@[\]`$^|~=?&:\u2028\u2029]|\/\*|\*\//;
const TOKEN_CSS_WIDE_PATTERN = /^(?:inherit|initial|revert(?:-layer)?|unset)$/i;
const TOKEN_FUNCTION_PATTERN = /([a-z0-9_-]+)\s*\(/gi;
const TOKEN_ALLOWED_FUNCTIONS = 'rgb rgba hsl hsla hwb lab lch oklab oklch color color-mix light-dark calc min max clamp var cubic-bezier steps linear'.split(' ');
/** The ownership list's cap: every map entry plus the on-* partners the floor can synthesize. */
const TOKEN_OWNERSHIP_MAX = TOKEN_ENTRY_MAX + TOKEN_SYNTHESIZED_MAX;
/** `Symbol.for` key of the list of token names last written on `<html>`, shared with the bootstrap. */
const TOKEN_OWNERSHIP_SYMBOL = '@aceshooting/lyra-ui.theme-tokens.v1';

/**
 * theme.css's own mode values the contrast floor measures against when a token map does not carry
 * the reference itself: the page surface, the raised surface, the body text, and the strong scrim's
 * black alpha.
 */
const MODE_DEFAULTS: Readonly<Record<ResolvedThemeMode, {
  readonly surface: Rgb;
  readonly raised: Rgb;
  readonly text: Rgb;
  readonly overlayStrongAlpha: number;
}>> = {
  light: { surface: [255, 255, 255], raised: [246, 248, 250], text: [26, 26, 26], overlayStrongAlpha: 0.92 },
  dark: { surface: [26, 26, 26], raised: [34, 39, 46], text: [242, 242, 242], overlayStrongAlpha: 0.95 },
};

const COLOR_SCHEME_QUERY = '(prefers-color-scheme: dark)';

/** Every role the runtime knows how to derive a ramp for, in the order applied and cleared. */
const SEMANTIC_ROLES: readonly LyraThemeSemanticRole[] = ['brand', 'success', 'warning', 'danger', 'neutral'];
const RAMP_CHANNELS = ['fill', 'border', 'on'] as const;
const RAMP_TIERS = ['quiet', 'normal', 'loud'] as const;

function roleRampProperties(role: LyraThemeSemanticRole): string[] {
  const properties: string[] = [];
  for (const channel of RAMP_CHANNELS) {
    for (const tier of RAMP_TIERS) properties.push(`--lr-theme-color-${role}-${channel}-${tier}`);
  }
  return properties;
}

/** Every custom property any role's ramp can write, plus the brand-only focus token. */
const ALL_RAMP_PROPERTIES: readonly string[] = [
  ...SEMANTIC_ROLES.flatMap(roleRampProperties),
  '--lr-theme-color-focus',
];

/**
 * `theme.css` keys its light/dark blocks off `data-lr-theme` (and the equivalent `.lr-light`/
 * `.lr-dark` classes). `data-theme` is the generic attribute apps and `ThemeWatcher`
 * (`src/internal/theme-watcher.ts`, which canvas-rendered components use to know when to
 * repaint) watch for. Both are written so a mode switch reaches the shipped stylesheet *and*
 * triggers a canvas repaint; writing only one leaves half the library on the old theme.
 */
const MODE_ATTRIBUTES = ['data-lr-theme', 'data-theme'] as const;

/**
 * Parentheses and quotes balance. DOM-free, and shared (as literal copies) by the token grammar, by
 * `normalizeColor`, and by the bootstrap. Escapes and newlines need no handling because the token
 * grammar bans the backslash and every control character, and `normalizeColor`'s probe rejects them; nothing
 * is interpreted inside a quoted string.
 */
function isBalancedCssValue(value: string): boolean {
  let depth = 0;
  let quote = '';
  for (const character of value) {
    if (quote) {
      if (character === quote) quote = '';
      continue;
    }
    if (character === '\'' || character === '"') quote = character;
    else if (character === '(') depth += 1;
    else if (character === ')' && (depth -= 1) < 0) return false;
  }
  return quote === '' && depth === 0;
}

/**
 * @internal True for a settable `--lr-theme-*` input name: the token-name pattern, at most 80
 * characters, and never the reserved `--lr-theme-accent`. Shared with the style-axis generator.
 */
export function isLyraThemeTokenName(name: unknown): name is LyraThemeTokenName {
  return typeof name === 'string'
    && name.length <= TOKEN_NAME_MAX_LENGTH
    && TOKEN_NAME_PATTERN.test(name)
    && name !== TOKEN_RESERVED_NAME;
}

/**
 * @internal The DOM-free token-value grammar: 1-256 characters after trimming, none of the
 * forbidden characters or comment delimiters, not a CSS-wide keyword, only allow-listed functions,
 * and balanced parentheses and quotes. The same grammar is used by the style-axis generator.
 */
export function isSafeLyraThemeTokenValue(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > TOKEN_VALUE_MAX_LENGTH) return false;
  if (TOKEN_FORBIDDEN_PATTERN.test(trimmed) || TOKEN_CSS_WIDE_PATTERN.test(trimmed)) return false;
  for (const match of trimmed.matchAll(TOKEN_FUNCTION_PATTERN)) {
    if (!TOKEN_ALLOWED_FUNCTIONS.includes((match[1] ?? '').toLowerCase())) return false;
  }
  return isBalancedCssValue(trimmed);
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value) as unknown;
  if (prototype === Object.prototype || prototype === null) return true;
  if (Object.getPrototypeOf(prototype) !== null) return false;
  const constructor = Object.getOwnPropertyDescriptor(prototype, 'constructor')?.value;
  return typeof constructor === 'function' && Function.prototype.toString.call(constructor) === Function.prototype.toString.call(Object);
}

function normalizeTokenBranch(value: unknown): string | null {
  return isSafeLyraThemeTokenValue(value) ? value.trim() : null;
}

/**
 * Normalizes a raw token map: pure, DOM-free, and never throws (a hostile getter yields `null`).
 * Bad names and unsafe values drop their entry; a per-mode value keeps each surviving branch and
 * carries both `light` and `dark`. Returns `null` for a non-object, for 0 or more than 512 keys, and
 * when no entry survives; otherwise a frozen map whose per-mode entries are frozen too.
 */
function normalizeTokens(raw: unknown): LyraThemeTokens | null {
  try {
    if (!isPlainRecord(raw)) return null;
    const names = Object.keys(raw);
    if (names.length === 0 || names.length > TOKEN_ENTRY_MAX) return null;
    const result: Record<string, LyraThemeTokenValue> = {};
    let kept = 0;
    for (const name of names) {
      if (!isLyraThemeTokenName(name)) continue;
      const value = ownField(raw, name);
      if (typeof value === 'string') {
        const normalized = normalizeTokenBranch(value);
        if (normalized === null) continue;
        result[name] = normalized;
        kept += 1;
        continue;
      }
      if (!isPlainRecord(value)) continue;
      const keys = Object.keys(value);
      const hasLight = Object.prototype.hasOwnProperty.call(value, 'light');
      const hasDark = Object.prototype.hasOwnProperty.call(value, 'dark');
      if ((!hasLight && !hasDark) || keys.some((key) => key !== 'light' && key !== 'dark')) continue;
      const light = normalizeTokenBranch(ownField(value, 'light'));
      const dark = normalizeTokenBranch(ownField(value, 'dark'));
      if (light === null && dark === null) continue;
      result[name] = Object.freeze({ light, dark });
      kept += 1;
    }
    return kept > 0 ? Object.freeze(result) as LyraThemeTokens : null;
  } catch {
    return null;
  }
}

/**
 * @internal Structural equality for token maps: empty, `null` and `undefined` are equal, key sets
 * and values are compared, and a missing per-mode branch counts as `null`. Used by `presets.ts` to
 * decide whether the applied snapshot still matches a preset's requested map.
 */
export function tokensEqual(
  left: LyraThemeTokens | null | undefined,
  right: LyraThemeTokens | null | undefined,
): boolean {
  const leftNames = left ? Object.keys(left) : [];
  const rightNames = right ? Object.keys(right) : [];
  if (leftNames.length !== rightNames.length) return false;
  if (leftNames.length === 0) return true;
  const leftMap = left as Record<string, LyraThemeTokenValue>;
  const rightMap = right as Record<string, LyraThemeTokenValue>;
  return leftNames.every((name) => {
    if (!Object.prototype.hasOwnProperty.call(rightMap, name)) return false;
    const a = leftMap[name];
    const b = rightMap[name];
    if (typeof a === 'string' || typeof b === 'string') return a === b;
    if (!a || !b) return false;
    return (a.light ?? null) === (b.light ?? null) && (a.dark ?? null) === (b.dark ?? null);
  });
}

/** Syntax-level validation shared by a bare accent string, a per-role accent value, and `surface`. */
function normalizeColor(value: unknown, owner: Document = document): string | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  const candidate = value.trim();
  // An unclosed parenthesis or quote parses for the probe below in every engine, yet written raw
  // it corrupts the rest of the inline style attribute when that attribute is re-parsed.
  if (!isBalancedCssValue(candidate)) return null;
  // Relative and CSS-wide values cannot be converted into a deterministic semantic ramp.
  if (TOKEN_CSS_WIDE_PATTERN.test(candidate)) return null;
  if (/^(?:accentcolor|accentcolortext|activetext|buttonborder|buttonface|buttontext|canvas|canvastext|field|fieldtext|graytext|highlight|highlighttext|linktext|mark|marktext|selecteditem|selecteditemtext|visitedtext)$/i.test(candidate)) {
    return null;
  }
  if (/\bcurrentcolor\b/i.test(candidate)) return null;
  if (/\bvar\s*\(/i.test(candidate)) return null;
  if (/\blight-dark\s*\(/i.test(candidate)) return null;
  if (/\b(?:rgb|rgba|hsl|hsla|hwb|lab|lch|oklab|oklch|color)\s*\(\s*from\b/i.test(candidate)) {
    return null;
  }
  const probe = owner.createElement('span');
  probe.style.color = candidate;
  return probe.style.color ? candidate : null;
}

/**
 * Normalizes one role's accent input (`normalizeAccent`'s per-role element): a bare color string,
 * `null`, or a `{ light?, dark? }` per-mode map. A per-mode map with both branches unresolvable
 * (missing key, malformed color) collapses to `null` -- same "nothing to offer" meaning as a bare
 * `null`, so callers never need to distinguish an empty per-mode object from an absent role.
 */
function normalizeAccentValue(value: unknown): LyraThemeAccentValue {
  if (typeof value === 'string' || value === null) return normalizeColor(value);
  if (typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (!('light' in record) && !('dark' in record)) return null;
  const light = normalizeColor(record['light']);
  const dark = normalizeColor(record['dark']);
  return light || dark ? { light, dark } : null;
}

/** Normalizes a whole `accent` field: a bare color string, a per-role accent-value map, or `null`. */
function normalizeAccent(value: unknown): LyraThemeAccent {
  if (typeof value === 'string') return normalizeColor(value);
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const result: Partial<Record<LyraThemeSemanticRole, LyraThemeAccentValue>> = {};
  let hasRole = false;
  for (const role of SEMANTIC_ROLES) {
    if (!(role in record)) continue;
    hasRole = true;
    result[role] = normalizeAccentValue(record[role]);
  }
  return hasRole ? result : null;
}

/** Resolves one role's (possibly per-mode) accent value to the concrete color for `mode`. */
function resolveAccentValueForMode(value: LyraThemeAccentValue, mode: ResolvedThemeMode): string | null {
  if (typeof value === 'string') return value;
  return value ? value[mode] ?? null : null;
}

/** Structural equality for one role's `LyraThemeAccentValue`. */
function accentValueEqual(left: LyraThemeAccentValue, right: LyraThemeAccentValue): boolean {
  if (left === right) return true;
  if (typeof left === 'string' || typeof right === 'string' || left === null || right === null) return false;
  return (left['light'] ?? null) === (right['light'] ?? null) && (left['dark'] ?? null) === (right['dark'] ?? null);
}

/**
 * @internal Structural equality for `LyraThemeAccent`, since the object form is rebuilt on every
 * apply. Exported (not published -- see the `@internal` tag) so `presets.ts` can tell a
 * genuinely-changed accent apart from a freshly reconstructed object with the same role/color
 * pairs when deciding whether a preset's snapshot still matches. This is package-internal wiring
 * between two of this module's own siblings, not a capability an application needs to compare its
 * own accent values -- so, like `menu-shared.ts`'s `menuItemOwner`/`submenuPanelController` and
 * `reorder-owner.ts`'s owner-state helpers, it stays out of the public source-contract census
 * instead of becoming permanent public API nobody asked for.
 */
export function accentsEqual(left: LyraThemeAccent, right: LyraThemeAccent): boolean {
  if (left === right) return true;
  if (typeof left === 'string' || typeof right === 'string' || left === null || right === null) return false;
  const leftKeys = Object.keys(left) as LyraThemeSemanticRole[];
  const rightKeys = Object.keys(right) as LyraThemeSemanticRole[];
  if (leftKeys.length !== rightKeys.length) return false;
  return leftKeys.every((role) => accentValueEqual(left[role] as LyraThemeAccentValue, right[role] as LyraThemeAccentValue));
}

function parseResolvedRgb(value: string, background: Rgb, owner: Document = document): Rgb | null {
  if (!normalizeColor(value, owner)) return null;
  try {
    const canvas = owner.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) return null;
    context.clearRect(0, 0, 1, 1);
    context.fillStyle = value;
    context.fillRect(0, 0, 1, 1);
    const channels = context.getImageData(0, 0, 1, 1).data;
    const red = channels[0] ?? 0;
    const green = channels[1] ?? 0;
    const blue = channels[2] ?? 0;
    const alphaByte = channels[3] ?? 0;
    const alpha = alphaByte / 255;
    return [
      Math.round(red * alpha + background[0] * (1 - alpha)),
      Math.round(green * alpha + background[1] * (1 - alpha)),
      Math.round(blue * alpha + background[2] * (1 - alpha)),
    ];
  } catch {
    return null;
  }
}

function mixRgb(base: Rgb, color: Rgb, colorWeight: number): Rgb {
  return [
    Math.round(base[0] * (1 - colorWeight) + color[0] * colorWeight),
    Math.round(base[1] * (1 - colorWeight) + color[1] * colorWeight),
    Math.round(base[2] * (1 - colorWeight) + color[2] * colorWeight),
  ];
}

function serializeRgb(color: Rgb): string {
  return `rgb(${color.join(' ')})`;
}

function relativeLuminance(color: Rgb): number {
  const linearize = (channel: number): number => {
    const normalized = channel / 255;
    return normalized <= 0.04045
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4;
  };
  return linearize(color[0]) * 0.2126
    + linearize(color[1]) * 0.7152
    + linearize(color[2]) * 0.0722;
}

function contrastRatio(left: Rgb, right: Rgb): number {
  const a = relativeLuminance(left);
  const b = relativeLuminance(right);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

function contrastForeground(fill: Rgb): Rgb {
  const black: Rgb = [0, 0, 0];
  const white: Rgb = [255, 255, 255];
  return contrastRatio(fill, black) >= contrastRatio(fill, white) ? black : white;
}

/**
 * Returns `color` itself when it clears `minimum` against both `background` and `alsoAgainst`;
 * otherwise mixes it toward black or white (chosen from `background`) in tenths until a step clears
 * both, falling back to that target.
 */
function ensureSurfaceContrast(color: Rgb, background: Rgb, minimum = 3, alsoAgainst: Rgb = background, references: readonly Rgb[] = []): Rgb {
  const passes = (candidate: Rgb): boolean =>
    contrastRatio(candidate, background) >= minimum && contrastRatio(candidate, alsoAgainst) >= minimum && references.every(reference => contrastRatio(candidate, reference) >= minimum);
  if (passes(color)) return color;
  const black: Rgb = [0, 0, 0];
  const white: Rgb = [255, 255, 255];
  const target = contrastRatio(background, black) >= contrastRatio(background, white) ? black : white;
  for (let step = 1; step <= 10; step += 1) {
    const candidate = mixRgb(color, target, step / 10);
    if (passes(candidate)) return candidate;
  }
  return target;
}

/**
 * Derives one role's contrast-checked quiet/normal/loud fill/border/on-* ramp (plus, for
 * `'brand'` only, the focus token) against a resolved mix base. Returns `null` when `base` cannot
 * be resolved to a concrete color at all (malformed syntax already filtered by `normalizeColor`,
 * or a canvas failure at paint time).
 */
function createRoleRamp(
  role: LyraThemeSemanticRole,
  base: string,
  mode: ResolvedThemeMode,
  background: Rgb,
  owner: Document = document,
): Record<string, string> | null {
  const references = STYLE_CONTRAST_SURFACES[mode].flatMap(color => {
    const value = parseResolvedRgb(color, MODE_DEFAULTS[mode].surface, owner);
    return value ? [value] : [];
  });
  const resolved = parseResolvedRgb(base, background, owner);
  if (!resolved) return null;
  const quiet = mixRgb(background, resolved, mode === 'dark' ? 0.24 : 0.14);
  const normal = mixRgb(background, resolved, mode === 'dark' ? 0.62 : 0.55);
  const loud = ensureSurfaceContrast(resolved, background, 4.5, quiet, references);
  const borderTarget: Rgb = mode === 'dark' ? [255, 255, 255] : [0, 0, 0];
  const borderQuiet = mixRgb(background, resolved, mode === 'dark' ? 0.46 : 0.38);
  const borderNormal = ensureSurfaceContrast(
    mixRgb(background, resolved, mode === 'dark' ? 0.78 : 0.72),
    background, 3, background, references,
  );
  const borderLoud = ensureSurfaceContrast(mixRgb(loud, borderTarget, 0.2), background, 3, background, references);
  const prefix = `--lr-theme-color-${role}`;
  const ramp: Record<string, string> = {
    [`${prefix}-fill-quiet`]: serializeRgb(quiet),
    [`${prefix}-fill-normal`]: serializeRgb(normal),
    [`${prefix}-fill-loud`]: serializeRgb(loud),
    [`${prefix}-border-quiet`]: serializeRgb(borderQuiet),
    [`${prefix}-border-normal`]: serializeRgb(borderNormal),
    [`${prefix}-border-loud`]: serializeRgb(borderLoud),
    [`${prefix}-on-quiet`]: serializeRgb(contrastForeground(quiet)),
    [`${prefix}-on-normal`]: serializeRgb(contrastForeground(normal)),
    [`${prefix}-on-loud`]: serializeRgb(contrastForeground(loud)),
  };
  if (role === 'brand') ramp['--lr-theme-color-focus'] = serializeRgb(ensureSurfaceContrast(resolved, background, 3, background, references));
  return ramp;
}

/**
 * Derives whichever roles `accent` supplies against the resolved mix base `background`, without
 * touching the document. Returns the accent value actually applied -- `null` when nothing could be
 * resolved, a bare string when the single brand ramp applied, or an object of only the roles that
 * resolved (or, for a `{ light, dark }` role value, still carry an unpainted branch for the other
 * mode), so callers can tell a total failure apart from what was requested and so a later mode
 * change can still resolve a branch that the active mode did not paint -- plus the ramp properties
 * and `--lr-theme-accent` to write. With no resolved mode nothing is painted and the accent is
 * retained, since there is no known surface to contrast against.
 */
function paintAccent(
  accent: LyraThemeAccent,
  mode: ResolvedThemeMode | null,
  background: Rgb,
  owner: Document = document,
): { applied: LyraThemeAccent; properties: Map<string, string> } {
  const properties = new Map<string, string>();
  if (!accent) return { applied: null, properties };
  if (!mode) return { applied: accent, properties };
  if (typeof accent === 'string') {
    const ramp = createRoleRamp('brand', accent, mode, background, owner);
    if (!ramp) return { applied: null, properties };
    properties.set('--lr-theme-accent', accent);
    for (const [property, value] of Object.entries(ramp)) properties.set(property, value);
    return { applied: accent, properties };
  }
  const applied: Partial<Record<LyraThemeSemanticRole, LyraThemeAccentValue>> = {};
  let appliedBrandColor: string | null = null;
  for (const role of SEMANTIC_ROLES) {
    const value = accent[role];
    if (!value) continue;
    const isPerMode = typeof value !== 'string';
    const base = resolveAccentValueForMode(value, mode);
    let painted = false;
    if (base) {
      const ramp = createRoleRamp(role, base, mode, background, owner);
      if (ramp) {
        for (const [property, propertyValue] of Object.entries(ramp)) properties.set(property, propertyValue);
        painted = true;
        if (role === 'brand') appliedBrandColor = base;
      }
    }
    // A bare string that failed to paint (rare canvas failure) drops from `applied`, exactly like
    // pre-16.0.0 behaviour; a `{ light, dark }` value is retained regardless of whether the active
    // mode's own branch painted, so the *other* mode's branch survives a later mode change/flip
    // instead of being silently dropped from persisted/reported state.
    if (painted || isPerMode) applied[role] = value;
  }
  if (appliedBrandColor) properties.set('--lr-theme-accent', appliedBrandColor);
  return { applied: Object.keys(applied).length > 0 ? applied : null, properties };
}

/** The values a token map writes for `mode`: every bare value, plus that mode's non-null branches. */
function tokenEntries(tokens: LyraThemeTokens | null, mode: ResolvedThemeMode | null): Map<string, string> {
  const entries = new Map<string, string>();
  if (!tokens) return entries;
  for (const [name, value] of Object.entries(tokens) as [string, LyraThemeTokenValue][]) {
    if (typeof value === 'string') entries.set(name, value);
    else if (mode) {
      const branch = value[mode];
      if (branch) entries.set(name, branch);
    }
  }
  return entries;
}

/** A token value resolved to painted RGB over `background`, or `null` when it cannot be. */
function resolveTokenColor(value: string | undefined, background: Rgb | null, owner: Document): Rgb | null {
  if (value === undefined || !background || !normalizeColor(value, owner)) return null;
  return parseResolvedRgb(value, background, owner);
}

/**
 * Applies the contrast floor to a token map's entries for a resolved mode. Returns the map to
 * paint: repaired values serialized as `rgb(r g b)`, passing and unchecked values verbatim, plus
 * any synthesized on-* partner. A value (or a reference) that does not resolve is written verbatim
 * and synthesizes nothing -- including every value when the canvas is unavailable.
 */
function floorTokenEntries(
  entries: ReadonlyMap<string, string>,
  mode: ResolvedThemeMode,
  surface: Rgb,
  owner: Document = document,
): Map<string, string> {
  const resolveColor = (value: string | undefined, background: Rgb | null): Rgb | null => resolveTokenColor(value, background, owner);
  const painted = new Map(entries);
  const prefix = '--lr-theme-';
  const defaults = MODE_DEFAULTS[mode];
  const reference = (name: string, fallback: Rgb): Rgb | null =>
    entries.has(prefix + name) ? resolveColor(entries.get(prefix + name), surface) : fallback;
  const raised = reference('color-surface-raised', defaults.raised);
  const floor = (name: string, over: Rgb | null, against: Rgb | null, minimum: number, alsoAgainst?: Rgb | null): void => {
    const value = painted.get(name);
    if (value === undefined || !against || alsoAgainst === null) return;
    const color = resolveColor(value, over);
    if (!color) return;
    const repaired = ensureSurfaceContrast(color, against, minimum, alsoAgainst ?? against);
    if (repaired !== color) painted.set(name, serializeRgb(repaired));
  };

  // Row 1: body and quiet text against the page and the raised surface.
  floor(`${prefix}color-text-normal`, surface, surface, 4.5, raised);
  floor(`${prefix}color-text-quiet`, surface, surface, 4.5, raised);
  const text = entries.has(`${prefix}color-text-normal`)
    ? resolveColor(painted.get(`${prefix}color-text-normal`), surface)
    : defaults.text;

  // Row 2: each on-* against its own fill, synthesized when the map carries only the fill.
  const synthesized = new Map<string, string>();
  const pairForeground = (onName: string, fill: Rgb | null): void => {
    if (!fill) return;
    const on = painted.get(onName);
    if (on === undefined) {
      synthesized.set(onName, serializeRgb(contrastForeground(fill)));
      return;
    }
    const color = resolveColor(on, fill);
    if (color && contrastRatio(color, fill) < 4.5) painted.set(onName, serializeRgb(contrastForeground(fill)));
  };
  for (const role of SEMANTIC_ROLES) {
    for (const tier of RAMP_TIERS) {
      const fillName = `${prefix}color-${role}-fill-${tier}`;
      if (!entries.has(fillName)) continue;
      pairForeground(`${prefix}color-${role}-on-${tier}`, resolveColor(entries.get(fillName), surface));
    }
  }

  // Row 3: the strong scrim's foreground, synthesized when the map carries only the scrim.
  const overlayName = `${prefix}color-overlay-strong`;
  const overlay = entries.has(overlayName)
    ? resolveColor(entries.get(overlayName), surface)
    : mixRgb(surface, [0, 0, 0], defaults.overlayStrongAlpha);
  // With no scrim in the map, pairForeground only checks an on-strong-overlay that is present.
  if (entries.has(overlayName) || entries.has(`${prefix}color-on-strong-overlay`)) {
    pairForeground(`${prefix}color-on-strong-overlay`, overlay);
  }

  // Rows 4-7: boundaries, chart series and terminal colours.
  const boundaries = [
    ...SEMANTIC_ROLES.flatMap((role) => [`${prefix}color-${role}-border-normal`, `${prefix}color-${role}-border-loud`]),
    `${prefix}color-surface-border`,
    `${prefix}color-border-strong`,
    `${prefix}color-focus`,
  ];
  for (const name of boundaries) floor(name, surface, surface, 3);
  for (const name of entries.keys()) {
    if (/^--lr-theme-color-chart-\d+$/.test(name)) floor(name, surface, surface, 3);
    else if (/^--lr-theme-terminal-color-[a-z0-9-]+$/.test(name)) floor(name, raised, raised, 4.5);
    else if (/^--lr-theme-terminal-bg-[a-z0-9-]+$/.test(name)) floor(name, raised, text, 4.5);
  }

  for (const [name, value] of synthesized) painted.set(name, value);
  return painted;
}

/** The validated ownership list another copy of this runtime (or the bootstrap) left on `<html>`. */
function readOwnershipList(): string[] {
  try {
    const list = (document.documentElement as unknown as Record<symbol, unknown>)[Symbol.for(TOKEN_OWNERSHIP_SYMBOL)];
    if (!Array.isArray(list)) return [];
    const names: string[] = [];
    const length = Math.min(list.length, TOKEN_OWNERSHIP_MAX);
    for (let index = 0; index < length; index += 1) {
      const name: unknown = list[index];
      if (isLyraThemeTokenName(name)) names.push(name);
    }
    return names;
  } catch {
    return [];
  }
}

/**
 * Self-contained token normalization and contrast paint, serialized into the pre-paint adapter.
 * The adapter owns storage and document writes; this factory shares validation and returns paint maps.
 * Its token grammar and color pipeline mirror the runtime without importing module state.
 */
function applyStoredThemeBeforePaint() {
  const roles = ['brand', 'success', 'warning', 'danger', 'neutral'] as const;
  const tiers = ['quiet', 'normal', 'loud'];

  // Literal copy of the token-map grammar (scripts/fixtures/theme-token-grammar.json is the single
  // source; scripts/theme-token-grammar.test.mjs keeps this copy identical to it).
  const tokenNamePattern = /^--lr-theme-[a-z0-9]+(?:-[a-z0-9]+)*$/;
  const tokenNameMaxLength = 80;
  const tokenReservedName = '--lr-theme-accent';
  const tokenEntryMax = 512;
  const tokenValueMaxLength = 256;
  const tokenForbiddenPattern = /[\x00-\x1f\x7f\\;{}!<>@[\]`$^|~=?&:\u2028\u2029]|\/\*|\*\//;
  const tokenCssWidePattern = /^(?:inherit|initial|revert(?:-layer)?|unset)$/i;
  const tokenFunctionPattern = /([a-z0-9_-]+)\s*\(/gi;
  const tokenAllowedFunctions = 'rgb rgba hsl hsla hwb lab lch oklab oklch color color-mix light-dark calc min max clamp var cubic-bezier steps linear'.split(' ');
  const modeDefaults = {
    light: { surface: [255, 255, 255], raised: [246, 248, 250], text: [26, 26, 26], overlayStrongAlpha: 0.92 },
    dark: { surface: [26, 26, 26], raised: [34, 39, 46], text: [242, 242, 242], overlayStrongAlpha: 0.95 },
  };

  const isBalanced = (value: string): boolean => {
    let depth = 0;
    let quote = '';
    for (const character of value) {
      if (quote) {
        if (character === quote) quote = '';
        continue;
      }
      if (character === '\'' || character === '"') quote = character;
      else if (character === '(') depth += 1;
      else if (character === ')' && (depth -= 1) < 0) return false;
    }
    return quote === '' && depth === 0;
  };
  const isTokenName = (name: unknown): name is string =>
    typeof name === 'string'
      && name.length <= tokenNameMaxLength
      && tokenNamePattern.test(name)
      && name !== tokenReservedName;
  const safeTokenValue = (value: unknown): string | null => {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    if (!trimmed || trimmed.length > tokenValueMaxLength) return null;
    if (tokenForbiddenPattern.test(trimmed) || tokenCssWidePattern.test(trimmed)) return null;
    for (const match of trimmed.matchAll(tokenFunctionPattern)) {
      if (!tokenAllowedFunctions.includes((match[1] ?? '').toLowerCase())) return null;
    }
    return isBalanced(trimmed) ? trimmed : null;
  };
  const isPlain = (value: unknown): value is Record<string, unknown> => {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
    const prototype = Object.getPrototypeOf(value) as unknown;
    return prototype === Object.prototype || prototype === null;
  };

  const normalizeMap = (rawTokens: unknown): LyraThemeTokens => {
    const normalizedTokens: Record<string, LyraThemeTokenValue> = {};
    try {
      if (!isPlain(rawTokens)) return normalizedTokens as LyraThemeTokens;
      const names = Object.keys(rawTokens);
      if (names.length <= tokenEntryMax) {
        for (const name of names) {
          if (!isTokenName(name)) continue;
          const value = rawTokens[name];
          if (typeof value === 'string') {
            const normalized = safeTokenValue(value);
            if (normalized !== null) normalizedTokens[name] = normalized;
            continue;
          }
          if (!isPlain(value)) continue;
          const hasLight = Object.hasOwn(value, 'light');
          const hasDark = Object.hasOwn(value, 'dark');
          if ((!hasLight && !hasDark) || Object.keys(value).some((key) => key !== 'light' && key !== 'dark')) continue;
          const light = safeTokenValue(value['light']);
          const dark = safeTokenValue(value['dark']);
          if (light !== null || dark !== null) normalizedTokens[name] = { light, dark };
        }
      }
    } catch { /* An invalid map contributes no entries. */ }
    return normalizedTokens as LyraThemeTokens;
  };
  const normalizeColor = (raw: unknown): string | undefined => {
    const value = safeTokenValue(raw);
    if (!value || /\b(?:var|light-dark)\s*\(|\b(?:currentcolor|from)\b/i.test(value)
      || /^(?:accentcolor|accentcolortext|activetext|buttonborder|buttonface|buttontext|canvas|canvastext|field|fieldtext|graytext|highlight|highlighttext|linktext|mark|marktext|selecteditem|selecteditemtext|visitedtext)$/i.test(value)) return undefined;
    return CSS.supports('color', value) ? value : undefined;
  };
  // Private boundary: the adapter supplies only token maps and accents validated by resolveStartup.
  const paint = (
    tokens: LyraThemeTokens,
    resolvedMode: 'light' | 'dark',
    referenceSurface: unknown,
    accent: LyraThemeAccent,
    references: readonly number[][],
  ): Map<string, string> => {
    const entries = new Map<string, string>();
    for (const [name, value] of Object.entries(tokens)) {
      const branch = typeof value === 'string' ? value : value[resolvedMode];
      if (branch) entries.set(name, branch);
    }

    const accentInput: Exclude<LyraThemeAccent, string> = typeof accent === 'string' ? { brand: accent } : accent;
    const accentRoles: Partial<Record<LyraThemeSemanticRole, string>> = {};
    for (const role of roles) {
      const value = accentInput?.[role];
      const color = typeof value === 'string' ? value : value?.[resolvedMode];
      if (color) accentRoles[role] = color;
    }

    let context: CanvasRenderingContext2D | null = null;
    if (entries.size > 0 || Object.keys(accentRoles).length > 0) {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 1;
        canvas.height = 1;
        context = canvas.getContext('2d', { willReadFrequently: true });
      } catch {
        context = null;
      }
    }

    const paintRgb = (value: string, background: number[]): number[] | null => {
      if (!context) return null;
      try {
        context.clearRect(0, 0, 1, 1);
        context.fillStyle = value;
        context.fillRect(0, 0, 1, 1);
        const channelsData = [...context.getImageData(0, 0, 1, 1).data];
        const alpha = (channelsData[3] ?? 0) / 255;
        return [0, 1, 2].map((index) =>
          Math.round((channelsData[index] ?? 0) * alpha + (background[index] ?? 0) * (1 - alpha)));
      } catch {
        return null;
      }
    };
    const mix = (base: number[], foreground: number[], weight: number) =>
      base.map((channel, index) =>
        Math.round(channel * (1 - weight) + (foreground[index] ?? 0) * weight));
    const luminance = (rgb: number[]) => {
      const linear = rgb.map((channel) => {
        const normalized = channel / 255;
        return normalized <= 0.04045
          ? normalized / 12.92
          : ((normalized + 0.055) / 1.055) ** 2.4;
      });
      return (linear[0] ?? 0) * 0.2126
        + (linear[1] ?? 0) * 0.7152
        + (linear[2] ?? 0) * 0.0722;
    };
    const contrast = (left: number[], right: number[]) => {
      const a = luminance(left);
      const b = luminance(right);
      return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    };
    const black = [0, 0, 0];
    const white = [255, 255, 255];
    const on = (fill: number[]) => contrast(fill, black) >= contrast(fill, white) ? black : white;
    const ensureContrast = (value: number[], background: number[], minimum = 3, alsoAgainst = background) => {
      const passes = (candidate: number[]) =>
        contrast(candidate, background) >= minimum && contrast(candidate, alsoAgainst) >= minimum && references.every(reference => contrast(candidate, reference) >= minimum);
      if (passes(value)) return value;
      const target = contrast(background, black) >= contrast(background, white) ? black : white;
      for (let step = 1; step <= 10; step += 1) {
        const candidate = mix(value, target, step / 10);
        if (passes(candidate)) return candidate;
      }
      return target;
    };
    const rgb = (value: number[]) => `rgb(${value.join(' ')})`;

    const defaults = modeDefaults[resolvedMode];
    const defaultSurface = defaults.surface;
    const surface = normalizeColor(referenceSurface) ?? normalizeColor(entries.get('--lr-theme-color-surface-default'));
    const background = (surface && paintRgb(surface, defaultSurface)) || defaultSurface;

    // The contrast floor, row for row the runtime's: an unresolved value or reference is written
    // verbatim and synthesizes nothing.
    const painted = new Map(entries);
    const prefix = '--lr-theme-';
    const resolveToken = (value: string | undefined, over: number[] | null): number[] | null =>
      value !== undefined && over && normalizeColor(value) ? paintRgb(value, over) : null;
    const reference = (name: string, fallback: number[]): number[] | null =>
      entries.has(prefix + name) ? resolveToken(entries.get(prefix + name), background) : fallback;
    const raised = reference('color-surface-raised', defaults.raised);
    const floor = (
      name: string,
      over: number[] | null,
      against: number[] | null,
      minimum: number,
      alsoAgainst?: number[] | null,
    ): void => {
      const value = painted.get(name);
      if (value === undefined || !against || alsoAgainst === null) return;
      const color = resolveToken(value, over);
      if (!color) return;
      const repaired = ensureContrast(color, against, minimum, alsoAgainst ?? against);
      if (repaired !== color) painted.set(name, rgb(repaired));
    };
    floor(`${prefix}color-text-normal`, background, background, 4.5, raised);
    floor(`${prefix}color-text-quiet`, background, background, 4.5, raised);
    const text = entries.has(`${prefix}color-text-normal`)
      ? resolveToken(painted.get(`${prefix}color-text-normal`), background)
      : defaults.text;
    const pairForeground = (onName: string, fill: number[] | null): void => {
      if (!fill) return;
      const onValue = painted.get(onName);
      const color = onValue === undefined ? null : resolveToken(onValue, fill);
      if (onValue === undefined || (color && contrast(color, fill) < 4.5)) painted.set(onName, rgb(on(fill)));
    };
    for (const role of roles) {
      for (const tier of tiers) {
        const fillName = `${prefix}color-${role}-fill-${tier}`;
        if (!entries.has(fillName)) continue;
        pairForeground(`${prefix}color-${role}-on-${tier}`, resolveToken(entries.get(fillName), background));
      }
    }
    const overlayName = `${prefix}color-overlay-strong`;
    const overlay = entries.has(overlayName)
      ? resolveToken(entries.get(overlayName), background)
      : mix(background, black, defaults.overlayStrongAlpha);
    if (entries.has(overlayName) || entries.has(`${prefix}color-on-strong-overlay`)) {
      pairForeground(`${prefix}color-on-strong-overlay`, overlay);
    }
    // Repair only supplied boundary tokens; absent tokens remain the stylesheet's responsibility.
    for (const name of entries.keys()) {
      if (/^--lr-theme-color-(?:(?:brand|success|warning|danger|neutral)-border-(?:normal|loud)|surface-border|border-strong|focus|chart-\d+)$/.test(name)) floor(name, background, background, 3);
      else if (/^--lr-theme-terminal-color-[a-z0-9-]+$/.test(name)) floor(name, raised, raised, 4.5);
      else if (/^--lr-theme-terminal-bg-[a-z0-9-]+$/.test(name)) floor(name, raised, text, 4.5);
    }

    if (!context) return painted;

    let appliedBrand: string | null = null;
    for (const role of roles) {
      const base = accentRoles[role];
      if (!base) continue;
      const color = paintRgb(base, background);
      if (!color) continue;
      const quiet = mix(background, color, resolvedMode === 'dark' ? 0.24 : 0.14);
      const normal = mix(background, color, resolvedMode === 'dark' ? 0.62 : 0.55);
      const loud = ensureContrast(color, background, 4.5, quiet);
      const borderTarget = resolvedMode === 'dark' ? white : black;
      const borderQuiet = mix(background, color, resolvedMode === 'dark' ? 0.46 : 0.38);
      const borderNormal = ensureContrast(
        mix(background, color, resolvedMode === 'dark' ? 0.78 : 0.72),
        background,
      );
      const borderLoud = ensureContrast(mix(loud, borderTarget, 0.2), background);
      const prefix = `--lr-theme-color-${role}`;
      painted.set(`${prefix}-fill-quiet`, rgb(quiet));
      painted.set(`${prefix}-fill-normal`, rgb(normal));
      painted.set(`${prefix}-fill-loud`, rgb(loud));
      painted.set(`${prefix}-border-quiet`, rgb(borderQuiet));
      painted.set(`${prefix}-border-normal`, rgb(borderNormal));
      painted.set(`${prefix}-border-loud`, rgb(borderLoud));
      painted.set(`${prefix}-on-quiet`, rgb(on(quiet)));
      painted.set(`${prefix}-on-normal`, rgb(on(normal)));
      painted.set(`${prefix}-on-loud`, rgb(on(loud)));
      if (role === 'brand') {
        painted.set('--lr-theme-color-focus', rgb(ensureContrast(color, background)));
        appliedBrand = base;
      }
    }
    if (appliedBrand) painted.set('--lr-theme-accent', appliedBrand);
    return painted;
  };
  return [normalizeMap, normalizeColor, paint] as const;
}

/** Material opt-outs for granular components before a document stylesheet is available. */
function styleMaterial(desired: Map<string, string>, surface: LyraSurface): void {
  const glass = surface === 'glass';
  for (const [name, value] of Object.entries({
    enabled: glass ? '1' : '0', content: glass ? '\'\'' : 'none', isolation: glass ? 'isolate' : 'auto',
    'child-filter': glass ? 'none' : 'initial', 'child-opacity': glass ? '1' : '0',
  })) desired.set(`--_lr-surface-${name}`, value);
  desired.set('--_lr-glass-blocker', glass ? 'initial' : 'none');
  if (!glass) desired.set('--_lr-glass-parent-opacity', '0');
}

/** Self-contained v2 adapter around the shared pre-paint contrast pipeline. */
function applyStoredStyleBeforePaint(
  defaultStorageKey: string,
  defaultModeAttributes: readonly string[],
  createPaint: typeof applyStoredThemeBeforePaint,
  allowed: typeof styleTokenAllowed,
  readOwnership: typeof readStyleOwnership,
  resolveStartup: typeof resolveStyleStartup,
  material: typeof styleMaterial,
  model: { defaults: typeof STYLE_DEFAULTS; inputs: string; surfaces: typeof STYLE_REFERENCE_SURFACES; contrastSurfaces: typeof STYLE_CONTRAST_SURFACES; gemstones: typeof STYLE_GEMSTONES },
): void {
  const { surfaces: STYLE_REFERENCE_SURFACES, contrastSurfaces: STYLE_CONTRAST_SURFACES, gemstones: STYLE_GEMSTONES } = model;
  // Store each property suffix once. The leading digit carries density/follow/accent membership.
  const membership = new Map<string, number>();
  for (const input of model.inputs.split(' ')) membership.set(`--lr-theme-${input.slice(1)}`, Number(input[0]));
  const STYLE_SLOTTED = [...membership.keys()];
  function styleSlot(name: string, mode: 'light' | 'dark', accent = false): string {
    return `--_lr-${accent ? 'a' : 'l'}${mode === 'light' ? 'l' : 'd'}-${name.slice(11)}`;
  }
  function styleBranch(name: string, mode: 'light' | 'dark'): string {
    const flags = membership.get(name) ?? 0;
    let result = `var(${styleSlot(name, mode)})`;
    if (flags & 2) {
      const key = mode === 'light' ? 'l' : 'd';
      const target = name.replace(/color-(?:success|warning|danger|neutral)-/, 'color-brand-');
      result = `var(--_lr-f${key}-${name.slice(11)},${result})var(--_lr-o${key}-${name.slice(11)},var(${styleSlot(target, mode, true)},var(${styleSlot(target, mode)})))`;
    }
    return flags & 4 ? `var(${styleSlot(name, mode, true)},${result})` : result;
  }
  function styleResolvedInput(name: string): string {
    const input = `var(--_lr-dark-on,${styleBranch(name, 'light')})var(--_lr-light-on,${styleBranch(name, 'dark')})`;
    if (!((membership.get(name) ?? 0) & 1)) return input;
    const spacing = name.startsWith('--lr-theme-space-');
    return `var(--_lr-dense-on,${input})var(--_lr-dense-off,max(calc((${input}) * var(--_lr-density-${spacing ? 'space' : 'control'},1)),${spacing ? '0px' : 'var(--_lr-density-target-min,0px)'}))`;
  }

  try {
    const script = document.currentScript;
    const configuredKey = script?.getAttribute('data-lr-theme-storage-key');
    const key = configuredKey && configuredKey.length <= 200 ? configuredKey : defaultStorageKey;
    const names = script?.getAttribute('data-lr-theme-attributes')?.trim().split(/\s+/);
    const attributes = names?.length && names.length <= 8 && new Set(names).size === names.length && names.every(name => name.length <= 64 && /^data-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name)) ? names : defaultModeAttributes;
    let saved: unknown;
    try { saved = JSON.parse(localStorage.getItem(key) ?? 'null'); }
    catch { /* A corrupt or inaccessible record uses the built-in profile. */ }
    const root = document.documentElement;
    const [normalizeMap, normalizeColor, paint] = createPaint();
    const record = resolveStartup(saved, model.defaults, normalizeMap,
      normalizeColor, (name, value) => allowed(name, value, STYLE_SLOTTED), STYLE_GEMSTONES);
    const mode = record['mode'] as LyraMode;
    const resolved = mode === 'unset' ? null : mode === 'system' ? matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light' : mode;
    const desiredAttributes: Record<string, string> = {};
    const resolver = getComputedStyle(root).getPropertyValue('--_lr-style-resolver').trim() === '1';
    const asMap = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
    const lookTokens = record['tokens'] as LyraThemeTokens | undefined;
    const overrides = record['overrides'] as LyraThemeTokens | undefined;
    const tokens: LyraThemeTokens = { ...lookTokens, ...overrides };
    const look = record['look'] as string;
    desiredAttributes['data-lr-look'] = look;
    desiredAttributes['data-lr-density'] = record['density'] as string;
    desiredAttributes['data-lr-surface'] = record['treatment'] as string;
    if (mode !== 'unset') desiredAttributes['data-lr-mode'] = mode;
    if (resolved) for (const name of attributes) desiredAttributes[name] = resolved;
    const accentName = record['accentName'] as string | undefined;
    let accent = record['accent'] as LyraThemeAccent;
    if (mode !== 'unset' && accent && typeof accent === 'object' && !Object.values(accent).some(value =>
      typeof value === 'string' || (value && Object.values(value).some(Boolean)))) accent = null;
    desiredAttributes['data-lr-accent'] = accentName ?? (accent ? 'custom' : 'none');
    const desired = new Map<string, string>();
    if (mode === 'unset') for (const [name, value] of Object.entries(tokens)) {
      if (typeof value === 'string') desired.set(name, value);
    }
    for (const branch of ['light', 'dark'] as const) {
      const background = typeof record['surface'] === 'string' ? record['surface'] : asMap(record['surface'])[branch];
      const surfaceToken = typeof tokens['--lr-theme-color-surface-default'] === 'string' ? tokens['--lr-theme-color-surface-default'] : asMap(tokens['--lr-theme-color-surface-default'])[branch];
      const surface = background ?? surfaceToken ?? STYLE_REFERENCE_SURFACES[look]?.[branch];
      // Separate paints preserve accent precedence in nested mode islands without flattening it into the look.
      for (const accentPass of [false, true]) {
        if (accentPass && (!accent || accentName)) continue;
        const painted = paint(accentPass ? {} : tokens, branch, surface, accentPass ? accent : null,
          accentPass ? STYLE_CONTRAST_SURFACES[branch].map(color => [1, 3, 5].map(index => parseInt(color.slice(index, index + 2), 16))) : []);
        for (const [name, value] of painted) {
          if (name === '--lr-theme-accent') { if (branch === resolved) desired.set(name, value); continue; }
          const flags = membership.get(name);
          if (flags !== undefined && allowed(name, value, STYLE_SLOTTED)) {
            const channel = name.match(/^--lr-theme-color-(?:success|warning|danger|neutral)-((?:fill|border|on)-(?:quiet|normal|loud))$/)?.[1];
            const follows = !accentPass && channel && value === `var(--lr-theme-color-brand-${channel})`;
            const suffix = name.slice(11);
            const key = branch === 'light' ? 'l' : 'd';
            if (!follows) desired.set(styleSlot(name, branch, accentPass), value);
            if (!accentPass && (flags & 2)) {
              desired.set(`--_lr-f${key}-${suffix}`, follows ? ' ' : 'initial');
              desired.set(`--_lr-o${key}-${suffix}`, follows ? 'initial' : ' ');
            }
            if (branch === resolved) desired.set(name, resolver ? styleResolvedInput(name) : value);
          } else if (branch === resolved) desired.set(name, value);
        }
      }
    }
    if (desired.size || (mode === 'unset' && accent && !accentName)) desiredAttributes['data-lr-theme-scope'] = '';
    if (!resolver) material(desired, record['treatment'] as LyraSurface);
    const ownershipKey = Symbol.for('@aceshooting/lyra-ui.style-ownership.v1');
    const node = root as unknown as Record<symbol, unknown>;
    let previous: StyleOwnership | undefined;
    try { previous = readOwnership(node[ownershipKey]); } catch { /* Ignore inaccessible ownership. */ }
    const ownership = previous ?? { attributes: new Map(), properties: new Map() };
    if (mode === 'unset') for (const name of attributes) {
      if (!ownership.attributes.has(name)) root.removeAttribute(name);
    }
    try {
      const legacyKey = Symbol.for('@aceshooting/lyra-ui.theme-tokens.v1');
      const legacy = node[legacyKey];
      if (Array.isArray(legacy)) {
        const names = legacy.slice(0, 528).filter(name => typeof name === 'string' && name.length <= 80 && /^--lr-theme-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name));
        for (const name of [...names, ...STYLE_SLOTTED.filter(name => membership.get(name)! & 4), '--lr-theme-accent']) {
          if (!ownership.properties.has(name) && root.style.getPropertyValue(name)) {
            ownership.properties.set(name, { before: null, priority: '', written: root.style.getPropertyValue(name) });
          }
        }
        try { delete node[legacyKey]; } catch { /* A sealed root still receives its new values. */ }
      }
    } catch { /* Ignore inaccessible legacy ownership. */ }

    for (const [name, old] of ownership.attributes) {
      if (Object.hasOwn(desiredAttributes, name)) continue;
      if (root.getAttribute(name) === old.written) { if (old.before === null) root.removeAttribute(name); else root.setAttribute(name, old.before); }
      ownership.attributes.delete(name);
    }
    for (const [name, value] of Object.entries(desiredAttributes)) {
      if (!ownership.attributes.has(name)) ownership.attributes.set(name, { before: root.getAttribute(name), priority: '', written: value });
      root.setAttribute(name, value);
      ownership.attributes.get(name)!.written = value;
    }
    for (const [name, old] of ownership.properties) {
      if (desired.has(name)) continue;
      if (root.style.getPropertyValue(name) === old.written && !root.style.getPropertyPriority(name)) {
        if (old.before) root.style.setProperty(name, old.before, old.priority); else root.style.removeProperty(name);
      }
      ownership.properties.delete(name);
    }
    for (const [name, value] of desired) {
      if (!ownership.properties.has(name)) ownership.properties.set(name, { before: root.style.getPropertyValue(name), priority: root.style.getPropertyPriority(name), written: null });
      if (root.style.getPropertyPriority(name)) root.style.removeProperty(name);
      root.style.setProperty(name, value, '');
      ownership.properties.get(name)!.written = root.style.getPropertyValue(name);
    }
    try { node[ownershipKey] = ownership; } catch { /* A sealed document still receives its initial paint. */ }
  } catch { /* The bootstrap must never block parsing the rest of the document. */ }
}

// Built via String.fromCharCode rather than a \uXXXX regex escape so the source bytes are
// unambiguous regardless of how this file is transmitted/edited.
const LINE_SEPARATOR = String.fromCharCode(0x2028);
const PARAGRAPH_SEPARATOR = String.fromCharCode(0x2029);

function serializeInlineScriptData(value: string | readonly string[]): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(new RegExp(LINE_SEPARATOR, 'g'), '\\u2028')
    .replace(new RegExp(PARAGRAPH_SEPARATOR, 'g'), '\\u2029');
}

/**
 * Creates a self-contained IIFE body, safe to inline into a `<script>` tag placed before any
 * stylesheet in `<head>`, that applies a persisted `{ mode, accent, surface, tokens? }` theme before
 * first paint -- including the stored token map, validated and contrast-floored exactly as the runtime
 * does. Missing and invalid fields independently use the built-in Shadcn/Glass/Emerald/System
 * profile. Explicit saved choices, including Solid surfaces and null accents, take precedence.
 * The serialized options escape HTML script terminators and JavaScript line separators.
 * Pass an application-owned `storageKey` to reuse the no-flash bootstrap independently of this
 * v1 theme records and the current style API's `lyra-theme` persistence key.
 *
 * The returned value is deliberately a plain string (not a function) so it can be inlined without
 * shipping or parsing this whole module in an unbundled `<script>` context. Whichever `<script>`
 * element ends up running the string -- inline or, for the static `theme-bootstrap.js` asset,
 * external -- may itself carry `data-lr-theme-storage-key`/`data-lr-theme-attributes` attributes
 * to override `storageKey`/the mode attribute list at parse time without regenerating the string;
 * see `applyStoredThemeBeforePaint`'s config-resolution prelude for the validation rules. Absent
 * or invalid attributes keep this call's own `storageKey`/the default mode attributes, so ordinary
 * inline use (no such attributes on the wrapping `<script>`) is unaffected.
 */
export function createLyraThemeBootstrap(
  options: LyraThemeBootstrapOptions = {},
): string {
  const storageKey = options.storageKey ?? STORAGE_KEY;
  const inputs = STYLE_SLOTTED.map(name => {
    const flags = Number(STYLE_DENSITY.includes(name))
      | (Number(STYLE_FOLLOW.includes(name)) << 1)
      | (Number(ALL_RAMP_PROPERTIES.includes(name)) << 2);
    return `${flags}${name.slice(11)}`;
  }).join(' ');
  const model = JSON.stringify({ defaults: STYLE_DEFAULTS, inputs, surfaces: STYLE_REFERENCE_SURFACES, contrastSurfaces: STYLE_CONTRAST_SURFACES, gemstones: STYLE_GEMSTONES });
  // These self-contained helpers do not recurse. Their module bindings stay named and hoisted;
  // only the serialized function expressions omit names unused by the standalone script.
  const functions = [applyStoredStyleBeforePaint, applyStoredThemeBeforePaint, styleTokenAllowed, readStyleOwnership, resolveStyleStartup, styleMaterial]
    .map(helper => helper.toString().replace(/^function\s+[\w$]+/, 'function'));
  return `(${functions[0]})(${serializeInlineScriptData(storageKey)},${serializeInlineScriptData(MODE_ATTRIBUTES)},${functions.slice(1).join(',')},${model});`;
}

/**
 * The default-key no-flash bootstrap. Equivalent to `createLyraThemeBootstrap()` and retained for
 * consumers that store their theme under `localStorage['lyra-theme']`.
 *
 * Also published as the static, non-module script asset `@aceshooting/lyra-ui/theme-bootstrap.js`
 * -- byte-identical to this string -- for a Content-Security-Policy that forbids `unsafe-inline`
 * and cannot mint a per-response nonce. That external asset is a classic (non-module, non-async)
 * script, so `document.currentScript` is reliably its own `<script>` element while it runs,
 * letting a host page opt into an application-owned storage key or mode-attribute list by adding
 * attributes to the tag instead of inlining a per-app copy.
 */


/** Independently selected style dimensions. */
export type LyraStyleAxis = 'look' | 'surface' | 'density' | 'mode' | 'accent';
export type LyraStyleField = LyraStyleAxis | 'accentBackground' | 'overrides';
export type LyraLookId = 'lyra' | 'shadcn' | 'material' | (string & {});
export type LyraSurface = 'solid' | 'glass';
export type LyraDensity = 'compact' | 'comfortable' | 'touch';
export type LyraMode = 'light' | 'dark' | 'system' | 'unset';
export type LyraAccentName = 'emerald' | 'peridot' | 'topaz' | 'ruby' | 'tourmaline' | 'amethyst' | 'aquamarine' | 'sapphire' | 'hematite';
export type LyraAccent = LyraAccentName | LyraThemeAccent;
export type LyraAccentBackground = string | { readonly light?: string | null; readonly dark?: string | null } | null;
export interface LyraLook { readonly id: LyraLookId; readonly tokens: LyraThemeTokens; }
export interface LyraStyle {
  readonly look: LyraLookId;
  readonly lookForm: 'stylesheet' | 'runtime';
  readonly surface: LyraSurface;
  readonly density: LyraDensity;
  readonly mode: LyraMode;
  readonly accent: LyraAccent;
  /** Distinguishes a named palette from an identically named CSS color in saved legacy themes. */
  readonly accentName: LyraAccentName | null;
  readonly accentBackground: LyraAccentBackground;
  readonly overrides?: LyraThemeTokens;
  readonly resolvedMode: 'light' | 'dark' | null;
}
export interface LyraStyleChoices {
  look?: LyraLookId | LyraLook | null;
  surface?: LyraSurface | null;
  density?: LyraDensity | null;
  mode?: LyraMode | null;
  accent?: LyraAccent;
  accentBackground?: LyraAccentBackground;
  overrides?: LyraThemeTokens | null;
}
/** Complete scoped choices: an omitted axis inherits; null passed to the helper removes the scope. */
export interface LyraStyleScopeChoices {
  look?: LyraLookId | LyraLook;
  surface?: LyraSurface;
  density?: LyraDensity;
  mode?: 'light' | 'dark' | 'system';
  accent?: LyraAccent;
  accentBackground?: LyraAccentBackground;
  overrides?: LyraThemeTokens;
}
export interface LyraStyleChangeDetail {
  readonly style: Readonly<LyraStyle>;
  readonly changed: readonly (LyraStyleField | 'resolvedMode')[];
}
declare global {
  interface WindowEventMap { 'lr-style-change': CustomEvent<LyraStyleChangeDetail>; }
}

// GENERATED STYLE MODEL: START
const STYLE_SLOTTED: readonly string[] = [
  '--lr-theme-color-border-strong',
  '--lr-theme-color-brand-border-loud',
  '--lr-theme-color-brand-border-normal',
  '--lr-theme-color-brand-border-quiet',
  '--lr-theme-color-brand-fill-loud',
  '--lr-theme-color-brand-fill-normal',
  '--lr-theme-color-brand-fill-quiet',
  '--lr-theme-color-brand-on-loud',
  '--lr-theme-color-brand-on-normal',
  '--lr-theme-color-brand-on-quiet',
  '--lr-theme-color-chart-1',
  '--lr-theme-color-chart-2',
  '--lr-theme-color-chart-3',
  '--lr-theme-color-chart-4',
  '--lr-theme-color-chart-5',
  '--lr-theme-color-chart-6',
  '--lr-theme-color-chart-7',
  '--lr-theme-color-chart-8',
  '--lr-theme-color-chart-diverging-1',
  '--lr-theme-color-chart-diverging-2',
  '--lr-theme-color-chart-diverging-3',
  '--lr-theme-color-chart-sequential-1',
  '--lr-theme-color-chart-sequential-2',
  '--lr-theme-color-chart-sequential-3',
  '--lr-theme-color-danger-border-loud',
  '--lr-theme-color-danger-border-normal',
  '--lr-theme-color-danger-border-quiet',
  '--lr-theme-color-danger-fill-loud',
  '--lr-theme-color-danger-fill-normal',
  '--lr-theme-color-danger-fill-quiet',
  '--lr-theme-color-danger-on-loud',
  '--lr-theme-color-danger-on-normal',
  '--lr-theme-color-danger-on-quiet',
  '--lr-theme-color-focus',
  '--lr-theme-color-mix-partner',
  '--lr-theme-color-neutral-border-loud',
  '--lr-theme-color-neutral-border-normal',
  '--lr-theme-color-neutral-border-quiet',
  '--lr-theme-color-neutral-fill-loud',
  '--lr-theme-color-neutral-fill-normal',
  '--lr-theme-color-neutral-fill-quiet',
  '--lr-theme-color-neutral-on-loud',
  '--lr-theme-color-neutral-on-normal',
  '--lr-theme-color-neutral-on-quiet',
  '--lr-theme-color-no-data',
  '--lr-theme-color-on-strong-overlay',
  '--lr-theme-color-overlay',
  '--lr-theme-color-overlay-strong',
  '--lr-theme-color-success-border-loud',
  '--lr-theme-color-success-border-normal',
  '--lr-theme-color-success-border-quiet',
  '--lr-theme-color-success-fill-loud',
  '--lr-theme-color-success-fill-normal',
  '--lr-theme-color-success-fill-quiet',
  '--lr-theme-color-success-on-loud',
  '--lr-theme-color-success-on-normal',
  '--lr-theme-color-success-on-quiet',
  '--lr-theme-color-surface-border',
  '--lr-theme-color-surface-border-subtle',
  '--lr-theme-color-surface-container',
  '--lr-theme-color-surface-container-high',
  '--lr-theme-color-surface-container-highest',
  '--lr-theme-color-surface-container-low',
  '--lr-theme-color-surface-container-lowest',
  '--lr-theme-color-surface-default',
  '--lr-theme-color-surface-overlay',
  '--lr-theme-color-surface-raised',
  '--lr-theme-color-text-normal',
  '--lr-theme-color-text-quiet',
  '--lr-theme-color-warning-border-loud',
  '--lr-theme-color-warning-border-normal',
  '--lr-theme-color-warning-border-quiet',
  '--lr-theme-color-warning-fill-loud',
  '--lr-theme-color-warning-fill-normal',
  '--lr-theme-color-warning-fill-quiet',
  '--lr-theme-color-warning-on-loud',
  '--lr-theme-color-warning-on-normal',
  '--lr-theme-color-warning-on-quiet',
  '--lr-theme-form-control-height-2xs',
  '--lr-theme-form-control-height-l',
  '--lr-theme-form-control-height-m',
  '--lr-theme-form-control-height-s',
  '--lr-theme-form-control-height-xl',
  '--lr-theme-form-control-height-xs',
  '--lr-theme-graph-cat-1',
  '--lr-theme-graph-cat-2',
  '--lr-theme-graph-cat-3',
  '--lr-theme-graph-cat-4',
  '--lr-theme-graph-cat-5',
  '--lr-theme-graph-cat-6',
  '--lr-theme-graph-cat-7',
  '--lr-theme-graph-cat-8',
  '--lr-theme-icon-button-size',
  '--lr-theme-shadow-l',
  '--lr-theme-shadow-m',
  '--lr-theme-shadow-s',
  '--lr-theme-shadow-xl',
  '--lr-theme-shadow-xs',
  '--lr-theme-space-2xl',
  '--lr-theme-space-2xs',
  '--lr-theme-space-l',
  '--lr-theme-space-m',
  '--lr-theme-space-s',
  '--lr-theme-space-xs',
  '--lr-theme-terminal-bg-black',
  '--lr-theme-terminal-bg-blue',
  '--lr-theme-terminal-bg-bright-black',
  '--lr-theme-terminal-bg-bright-blue',
  '--lr-theme-terminal-bg-bright-cyan',
  '--lr-theme-terminal-bg-bright-green',
  '--lr-theme-terminal-bg-bright-magenta',
  '--lr-theme-terminal-bg-bright-red',
  '--lr-theme-terminal-bg-bright-white',
  '--lr-theme-terminal-bg-bright-yellow',
  '--lr-theme-terminal-bg-cyan',
  '--lr-theme-terminal-bg-green',
  '--lr-theme-terminal-bg-magenta',
  '--lr-theme-terminal-bg-red',
  '--lr-theme-terminal-bg-white',
  '--lr-theme-terminal-bg-yellow',
  '--lr-theme-terminal-color-black',
  '--lr-theme-terminal-color-blue',
  '--lr-theme-terminal-color-bright-black',
  '--lr-theme-terminal-color-bright-blue',
  '--lr-theme-terminal-color-bright-cyan',
  '--lr-theme-terminal-color-bright-green',
  '--lr-theme-terminal-color-bright-magenta',
  '--lr-theme-terminal-color-bright-red',
  '--lr-theme-terminal-color-bright-white',
  '--lr-theme-terminal-color-bright-yellow',
  '--lr-theme-terminal-color-cyan',
  '--lr-theme-terminal-color-green',
  '--lr-theme-terminal-color-magenta',
  '--lr-theme-terminal-color-red',
  '--lr-theme-terminal-color-white',
  '--lr-theme-terminal-color-yellow',
];
const STYLE_DENSITY: readonly string[] = [
  '--lr-theme-space-2xs',
  '--lr-theme-space-xs',
  '--lr-theme-space-s',
  '--lr-theme-space-m',
  '--lr-theme-space-l',
  '--lr-theme-space-2xl',
  '--lr-theme-form-control-height-2xs',
  '--lr-theme-form-control-height-xs',
  '--lr-theme-form-control-height-s',
  '--lr-theme-form-control-height-m',
  '--lr-theme-form-control-height-l',
  '--lr-theme-form-control-height-xl',
  '--lr-theme-icon-button-size',
];
const STYLE_FOLLOW: readonly string[] = [
  '--lr-theme-color-danger-border-loud',
  '--lr-theme-color-danger-border-normal',
  '--lr-theme-color-danger-border-quiet',
  '--lr-theme-color-danger-fill-loud',
  '--lr-theme-color-danger-fill-normal',
  '--lr-theme-color-danger-fill-quiet',
  '--lr-theme-color-danger-on-loud',
  '--lr-theme-color-danger-on-normal',
  '--lr-theme-color-danger-on-quiet',
  '--lr-theme-color-neutral-border-loud',
  '--lr-theme-color-neutral-border-normal',
  '--lr-theme-color-neutral-border-quiet',
  '--lr-theme-color-neutral-fill-loud',
  '--lr-theme-color-neutral-fill-normal',
  '--lr-theme-color-neutral-fill-quiet',
  '--lr-theme-color-neutral-on-loud',
  '--lr-theme-color-neutral-on-normal',
  '--lr-theme-color-neutral-on-quiet',
  '--lr-theme-color-success-border-loud',
  '--lr-theme-color-success-border-normal',
  '--lr-theme-color-success-border-quiet',
  '--lr-theme-color-success-fill-loud',
  '--lr-theme-color-success-fill-normal',
  '--lr-theme-color-success-fill-quiet',
  '--lr-theme-color-success-on-loud',
  '--lr-theme-color-success-on-normal',
  '--lr-theme-color-success-on-quiet',
  '--lr-theme-color-warning-border-loud',
  '--lr-theme-color-warning-border-normal',
  '--lr-theme-color-warning-border-quiet',
  '--lr-theme-color-warning-fill-loud',
  '--lr-theme-color-warning-fill-normal',
  '--lr-theme-color-warning-fill-quiet',
  '--lr-theme-color-warning-on-loud',
  '--lr-theme-color-warning-on-normal',
  '--lr-theme-color-warning-on-quiet',
];
const STYLE_REFERENCE_SURFACES: Readonly<Record<string, { light: string; dark: string }>> = {
  'lyra': { light: '#ffffff', dark: '#1a1a1a' },
  'data': { light: '#ffffff', dark: '#101820' },
  'high-contrast': { light: '#ffffff', dark: '#000000' },
  'material': { light: '#fff8f5', dark: '#18120f' },
  'shadcn': { light: '#ffffff', dark: '#0a0a0a' },
  'terminal': { light: '#fcfdf9', dark: '#0e1713' },
};
const STYLE_CONTRAST_SURFACES: Readonly<Record<'light' | 'dark', readonly string[]>> = {
  light: [
  '#ffffff',
  '#f6f8fa',
  '#f2f5f8',
  '#fff8f5',
  '#f8eeea',
  '#fcf2ed',
  '#f2e7e0',
  '#ecdfd7',
  '#fafafa',
  '#fcfdf9',
  '#f1f5eb',
],
  dark: [
  '#1a1a1a',
  '#22272e',
  '#2b3038',
  '#101820',
  '#192630',
  '#202e39',
  '#000000',
  '#18120f',
  '#251d19',
  '#302621',
  '#120d0a',
  '#211914',
  '#3a2f29',
  '#0a0a0a',
  '#171717',
  '#0e1713',
  '#18271e',
  '#203227',
],
};
const STYLE_GEMSTONES: Readonly<Record<string, string>> = {
  'emerald': '#34d399',
  'peridot': '#a8d84a',
  'topaz': '#f0a83c',
  'ruby': '#e63950',
  'tourmaline': '#ec4899',
  'amethyst': '#9d6df0',
  'aquamarine': '#22d3ee',
  'sapphire': '#4f8ff7',
  'hematite': '#94a3b8',
};
// GENERATED STYLE MODEL: END

const LOOK_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const LOOK_STAMP = Symbol.for('@aceshooting/lyra-ui.look.v1');
const STYLE_OWNERSHIP = Symbol.for('@aceshooting/lyra-ui.style-ownership.v1');
const STYLE_FIELDS: readonly LyraStyleField[] = ['look', 'surface', 'density', 'mode', 'accent', 'accentBackground', 'overrides'];
interface StyleState {
  look: string;
  tokens: LyraThemeTokens | null;
  surface: LyraSurface;
  density: LyraDensity;
  mode: LyraMode;
  accent: LyraThemeAccent;
  accentName: LyraAccentName | null;
  accentBackground: LyraAccentBackground;
  overrides: LyraThemeTokens | null;
}
const DEFAULT_STYLE: Readonly<StyleState> = Object.freeze({ ...STYLE_DEFAULTS, tokens: null, accent: STYLE_GEMSTONES[STYLE_DEFAULTS.accent]!, accentName: STYLE_DEFAULTS.accent, accentBackground: null, overrides: null });
let lastStyle: StyleState = { ...DEFAULT_STYLE };
let stylePersistenceFailed = false;
let styleModeCleanup: (() => void) | undefined;
let styleModeRoot: WeakRef<Element> | undefined;
const styleOwnershipFallback = new WeakMap<Element, StyleOwnership>();
const scopeModes = new WeakMap<Element, () => void>();

function ownField(value: object, key: string): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  return descriptor && 'value' in descriptor ? descriptor.value : undefined;
}
function styleId(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 64 && LOOK_ID.test(value);
}
function styleTokenAllowed(name: string, value: LyraThemeTokenValue, slotted: readonly string[] = STYLE_SLOTTED): boolean {
  if (name.startsWith('--lr-theme-surface-') || (typeof value !== 'string' && !slotted.includes(name))) return false;
  for (const branch of typeof value === 'string' ? [value] : [value.light, value.dark]) {
    if (!branch) continue;
    for (const reference of branch.matchAll(/var\(\s*(--[\w-]+)/g)) {
      if (reference[1] === '--lr-theme-shadow-color') continue;
      const channel = name.match(/^--lr-theme-color-(?:success|warning|danger|neutral)-((?:fill|border|on)-(?:quiet|normal|loud))$/)?.[1];
      if (!channel || branch !== `var(--lr-theme-color-brand-${channel})`) return false;
    }
  }
  return true;
}
function styleTokens(value: unknown): LyraThemeTokens | null {
  const tokens = normalizeTokens(value);
  if (!tokens) return null;
  const entries = Object.entries(tokens).filter(([name, input]) => styleTokenAllowed(name, input));
  return entries.length ? Object.freeze(Object.fromEntries(entries)) as LyraThemeTokens : null;
}

/** Validates and freezes a look definition; it does not register an id or install CSS. */
export function defineLyraLook<const Look extends LyraLook>(look: Look): Readonly<Look> {
  if (!look || !styleId(ownField(look, 'id')) || look.id === 'custom') throw new TypeError('Invalid look id');
  const raw = ownField(look, 'tokens');
  if (!isPlainRecord(raw) || Object.keys(raw).length > TOKEN_ENTRY_MAX) throw new TypeError('Invalid look tokens');
  for (const [name, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(raw))) {
    if (!('value' in descriptor)) throw new TypeError(`Look inputs must be data properties: ${name}`);
    const value: unknown = descriptor.value;
    if (typeof value === 'string') {
      if (!isSafeLyraThemeTokenValue(value)) throw new TypeError(`Invalid look value: ${name}`);
      continue;
    }
    if (!isPlainRecord(value) || !STYLE_SLOTTED.includes(name)) throw new TypeError(`Invalid per-mode look input: ${name}`);
    const branches = Object.entries(Object.getOwnPropertyDescriptors(value));
    if (!branches.length || branches.some(([key, branch]) =>
      !['light', 'dark'].includes(key) || !('value' in branch) ||
      (branch.value !== null && !isSafeLyraThemeTokenValue(branch.value)))) {
      throw new TypeError(`Invalid look mode pair: ${name}`);
    }
  }
  const tokens = styleTokens(raw);
  if (Object.keys(raw).length !== Object.keys(tokens ?? {}).length) throw new TypeError('Invalid look token or cross-axis reference');
  const stamped = { ...tokens, [LOOK_STAMP]: look.id };
  Object.freeze(stamped);
  return Object.freeze({ id: look.id, tokens: stamped }) as Readonly<Look>;
}

/** DOM-free syntactic color validation; final browser painting revalidates absolute colors. */
function styleColor(value: unknown, browserColors = false): string | null {
  if (!isSafeLyraThemeTokenValue(value)) return null;
  const text = value.trim();
  if (/\b(?:var|light-dark)\s*\(|\b(?:currentcolor|from)\b/i.test(text)) return null;
  if (/^(?:accentcolor|accentcolortext|activetext|buttonborder|buttonface|buttontext|canvas|canvastext|field|fieldtext|graytext|highlight|highlighttext|linktext|mark|marktext|selecteditem|selecteditemtext|visitedtext)$/i.test(text)) return null;
  if (browserColors && typeof CSS !== 'undefined') return CSS.supports('color', text) ? text : null;
  return /^(?:#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})|[a-z]+|(?:rgb|rgba|hsl|hsla|hwb|lab|lch|oklab|oklch|color|color-mix)\(.+\))$/i.test(text) ? text : null;
}
function styleColorPair(value: unknown): LyraAccentBackground {
  if (typeof value === 'string') return styleColor(value);
  if (!isPlainRecord(value)) return null;
  const light = styleColor(ownField(value, 'light'));
  const dark = styleColor(ownField(value, 'dark'));
  return light || dark ? Object.freeze({ light, dark }) : null;
}
function styleAccent(value: unknown): LyraThemeAccent {
  if (typeof value === 'string') return styleColor(value);
  if (!isPlainRecord(value)) return null;
  const entries = SEMANTIC_ROLES.filter(role => Object.hasOwn(value, role)).map(role => [role, styleColorPair(ownField(value, role))]);
  return entries.length ? Object.freeze(Object.fromEntries(entries)) : null;
}
function normalizeStyleChoices(raw: unknown, base: StyleState): StyleState {
  const next = { ...base };
  if (!isPlainRecord(raw)) return next;
  const look = ownField(raw, 'look');
  if (look !== undefined) {
    next.look = DEFAULT_STYLE.look; next.tokens = null;
    if (styleId(look)) next.look = look;
    else if (isPlainRecord(look)) {
      try {
        const definition = defineLyraLook(look as unknown as LyraLook);
        next.look = definition.id;
        next.tokens = definition.tokens;
      } catch { /* Invalid runtime definitions reset only the look axis. */ }
    }
  }
  const surface = ownField(raw, 'surface');
  if (surface !== undefined) next.surface = surface === 'glass' || surface === 'solid' ? surface : DEFAULT_STYLE.surface;
  const density = ownField(raw, 'density');
  if (density !== undefined) next.density = density === 'comfortable' || density === 'compact' || density === 'touch' ? density : DEFAULT_STYLE.density;
  const mode = ownField(raw, 'mode');
  if (mode !== undefined) next.mode = mode === 'light' || mode === 'dark' || mode === 'system' || mode === 'unset' ? mode : DEFAULT_STYLE.mode;
  const accent = ownField(raw, 'accent');
  if (accent !== undefined) {
    next.accentName = typeof accent === 'string' && Object.hasOwn(STYLE_GEMSTONES, accent) ? accent as LyraAccentName : null;
    next.accent = next.accentName ? STYLE_GEMSTONES[next.accentName]! : styleAccent(accent);
  }
  const background = ownField(raw, 'accentBackground');
  if (background !== undefined) next.accentBackground = styleColorPair(background);
  const overrides = ownField(raw, 'overrides');
  if (overrides !== undefined) next.overrides = styleTokens(overrides);
  return next;
}
function styleFromRecord(value: unknown, browserColors = false): StyleState {
  const record = resolveStyleStartup(value, STYLE_DEFAULTS, normalizeTokens,
    input => styleColor(input, browserColors) ?? undefined,
    styleTokenAllowed, STYLE_GEMSTONES);
  const state = normalizeStyleChoices({
    look: ownField(record, 'look'), mode: ownField(record, 'mode'), density: ownField(record, 'density'),
    surface: ownField(record, 'treatment'), overrides: ownField(record, 'overrides'), accentBackground: ownField(record, 'surface'),
  }, { ...DEFAULT_STYLE });
  // Legacy CSS keywords stay colors; only accentName selects the named palette.
  state.accent = styleAccent(ownField(record, 'accent'));
  const accentName = ownField(record, 'accentName');
  state.accentName = null;
  if (typeof accentName === 'string' && Object.hasOwn(STYLE_GEMSTONES, accentName)) {
    state.accentName = accentName as LyraAccentName;
    state.accent = STYLE_GEMSTONES[accentName]!;
  }
  state.tokens = normalizeTokens(ownField(record, 'tokens'));
  if (state.tokens && !styleId(ownField(record, 'look'))) state.look = 'custom';
  return state;
}
function styleRecord(state: StyleState): Record<string, unknown> {
  return { version: 2, mode: state.mode, look: state.look, density: state.density, treatment: state.surface,
    accent: state.accent, surface: state.accentBackground,
    ...(state.accentName ? { accentName: state.accentName } : {}),
    ...(state.tokens ? { tokens: state.tokens } : {}), ...(state.overrides ? { overrides: state.overrides } : {}) };
}
function styleResolvedMode(mode: LyraMode, view?: Window | null): 'light' | 'dark' | null {
  if (mode === 'unset') return null;
  if (mode !== 'system') return mode;
  return view?.matchMedia?.(COLOR_SCHEME_QUERY).matches ? 'dark' : 'light';
}
function styleSnapshot(state: StyleState, view?: Window | null): Readonly<LyraStyle> {
  return Object.freeze({ look: state.look, lookForm: state.tokens ? 'runtime' : 'stylesheet', surface: state.surface,
    density: state.density, mode: state.mode, accent: state.accentName ?? state.accent, accentName: state.accentName,
    accentBackground: state.accentBackground, ...(state.overrides ? { overrides: state.overrides } : {}),
    resolvedMode: styleResolvedMode(state.mode, view) });
}
/** Normalizes a parsed persisted record without browser APIs; CSS color validation is syntactic. */
export function parseLyraStyleRecord(value: unknown): Readonly<LyraStyle> {
  const state = styleFromRecord(value);
  const result = styleSnapshot(state);
  return state.mode === 'system' ? Object.freeze({ ...result, resolvedMode: null }) : result;
}
/** Requested-axis attributes for server rendering. Resolved-mode attributes belong to the browser. */
export function lyraStyleAttributes(style: Partial<LyraStyle>): Readonly<Record<string, string>> {
  const attributes: Record<string, string> = {};
  if (styleId(style.look)) attributes['data-lr-look'] = style.look;
  if (style.surface === 'solid' || style.surface === 'glass') attributes['data-lr-surface'] = style.surface;
  if (style.density === 'compact' || style.density === 'comfortable' || style.density === 'touch') attributes['data-lr-density'] = style.density;
  if (style.mode === 'light' || style.mode === 'dark' || style.mode === 'system') attributes['data-lr-mode'] = style.mode;
  if (style.accent !== undefined) attributes['data-lr-accent'] = style.accent === null ? 'none'
    : style.accentName === null ? 'custom'
    : typeof style.accent === 'string' && Object.hasOwn(STYLE_GEMSTONES, style.accent) ? style.accent : 'custom';
  return Object.freeze(attributes);
}
function readStyleState(): StyleState {
  if (stylePersistenceFailed) return { ...lastStyle };
  let stored: string | null;
  try { stored = localStorage.getItem(STORAGE_KEY); }
  catch { return { ...lastStyle }; }
  try { return styleFromRecord(JSON.parse(stored ?? 'null'), true); }
  catch { return { ...DEFAULT_STYLE }; }
}
function persistStyle(state: StyleState): void {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(styleRecord(state))); stylePersistenceFailed = false; }
  catch { stylePersistenceFailed = true; }
  lastStyle = state;
}
function ownershipFor(element: Element): StyleOwnership {
  const node = element as unknown as Record<symbol, unknown>;
  try {
    const existing = readStyleOwnership(node[STYLE_OWNERSHIP]);
    if (existing) {
      styleOwnershipFallback.set(element, existing);
      try { node[STYLE_OWNERSHIP] = existing; } catch { /* Retain the validated local copy. */ }
      return existing;
    }
  } catch { /* A hostile getter cannot prevent applying or restoring a style. */ }
  const fallback = styleOwnershipFallback.get(element);
  if (fallback) return fallback;
  const record: StyleOwnership = { attributes: new Map(), properties: new Map() };
  styleOwnershipFallback.set(element, record);
  try { node[STYLE_OWNERSHIP] = record; } catch { /* The local weak map retains ownership. */ }
  return record;
}
function writeStyleAttributes(element: Element, desired: Readonly<Record<string, string>>): void {
  const ownership = ownershipFor(element).attributes;
  for (const [name, value] of ownership) {
    if (Object.hasOwn(desired, name)) continue;
    if (element.getAttribute(name) === value.written) {
      if (value.before === null) element.removeAttribute(name); else element.setAttribute(name, value.before);
    }
    ownership.delete(name);
  }
  for (const [name, value] of Object.entries(desired)) {
    if (!ownership.has(name)) ownership.set(name, { before: element.getAttribute(name), priority: '', written: value });
    if (element.getAttribute(name) !== value) element.setAttribute(name, value);
    ownership.get(name)!.written = value;
  }
}
function writeStyleProperties(element: Element, desired: ReadonlyMap<string, string>): void {
  const style = (element as HTMLElement | SVGElement).style;
  if (!style) return;
  const ownership = ownershipFor(element).properties;
  for (const [name, value] of ownership) {
    if (desired.has(name)) continue;
    if (style.getPropertyValue(name) === value.written && style.getPropertyPriority(name) === '') {
      if (value.before) style.setProperty(name, value.before, value.priority); else style.removeProperty(name);
    }
    ownership.delete(name);
  }
  for (const [name, value] of desired) {
    if (!ownership.has(name)) ownership.set(name, { before: style.getPropertyValue(name), priority: style.getPropertyPriority(name), written: null });
    const record = ownership.get(name)!;
    if (style.getPropertyPriority(name) !== '' ||
      (style.getPropertyValue(name) !== value && !(record.requested === value && record.written === style.getPropertyValue(name)))) {
      // WebKit retains an existing important priority unless the declaration is removed first.
      if (style.getPropertyPriority(name)) style.removeProperty(name);
      style.setProperty(name, value, '');
    }
    record.requested = value;
    record.written = style.getPropertyValue(name);
  }
}
function styleSlot(name: string, mode: 'light' | 'dark', accent = false): string {
  return `--_lr-${accent ? 'a' : 'l'}${mode === 'light' ? 'l' : 'd'}-${name.slice(11)}`;
}
function styleFollow(name: string, value: string): boolean {
  const channel = name.match(/^--lr-theme-color-(?:success|warning|danger|neutral)-((?:fill|border|on)-(?:quiet|normal|loud))$/)?.[1];
  return Boolean(channel && value === `var(--lr-theme-color-brand-${channel})`);
}
function styleBranch(name: string, mode: 'light' | 'dark'): string {
  let result = `var(${styleSlot(name, mode)})`;
  if (STYLE_FOLLOW.includes(name)) {
    const key = mode === 'light' ? 'l' : 'd';
    const target = name.replace(/color-(?:success|warning|danger|neutral)-/, 'color-brand-');
    result = `var(--_lr-f${key}-${name.slice(11)},${result})var(--_lr-o${key}-${name.slice(11)},var(${styleSlot(target, mode, true)},var(${styleSlot(target, mode)})))`;
  }
  return ALL_RAMP_PROPERTIES.includes(name) ? `var(${styleSlot(name, mode, true)},${result})` : result;
}
function styleResolvedInput(name: string): string {
  const input = `var(--_lr-dark-on,${styleBranch(name, 'light')})var(--_lr-light-on,${styleBranch(name, 'dark')})`;
  if (!STYLE_DENSITY.includes(name)) return input;
  const spacing = name.startsWith('--lr-theme-space-');
  return `var(--_lr-dense-on,${input})var(--_lr-dense-off,max(calc((${input}) * var(--_lr-density-${spacing ? 'space' : 'control'},1)),${spacing ? '0px' : 'var(--_lr-density-target-min,0px)'}))`;
}
function styleBackground(state: StyleState, entries: ReadonlyMap<string, string>, mode: 'light' | 'dark', element: Element): string | undefined {
  const explicit = typeof state.accentBackground === 'string' ? state.accentBackground : state.accentBackground?.[mode];
  const ownLook = element.getAttribute('data-lr-look');
  let reference = explicit ?? entries.get('--lr-theme-color-surface-default') ??
    (ownLook ? (STYLE_REFERENCE_SURFACES[ownLook] ?? STYLE_REFERENCE_SURFACES['lyra'])?.[mode] : undefined);
  if (!reference) {
    const slot = styleSlot('--lr-theme-color-surface-default', mode);
    const style = (element as HTMLElement | SVGElement).style;
    const owned = ownershipFor(element).properties.get(slot);
    const suspend = owned && style?.getPropertyValue(slot) === owned.written && !style.getPropertyPriority(slot);
    // Read the new inherited scope rather than the surface left by a previous runtime map.
    // Restore the old write immediately; the ownership writer handles its replacement below.
    try {
      if (suspend) {
        if (owned.before) style.setProperty(slot, owned.before, owned.priority);
        else style.removeProperty(slot);
      }
      reference = element.ownerDocument.defaultView?.getComputedStyle(element).getPropertyValue(slot).trim();
    } finally {
      if (suspend && owned.written !== null) style.setProperty(slot, owned.written);
    }
  }
  return reference;
}
const stylePaintCache = new WeakMap<Element, Map<string, { key: string; tokens: Map<string, string>; accent: Map<string, string>; applied: LyraThemeAccent }>>();
function stylePaint(state: StyleState, element: Element, wholeDocument: boolean): Map<string, string> {
  const desired = new Map<string, string>();
  const mode = styleResolvedMode(state.mode, element.ownerDocument.defaultView);
  const tokens = { ...state.tokens, ...state.overrides };
  if (wholeDocument && mode === null) for (const [name, value] of tokenEntries(tokens, null)) desired.set(name, value);
  if (!Object.keys(tokens).length && (!state.accent || state.accentName)) {
    stylePaintCache.delete(element);
    return desired;
  }
  const resolver = element.ownerDocument.defaultView?.getComputedStyle(element).getPropertyValue('--_lr-style-resolver').trim() === '1';
  let cache = stylePaintCache.get(element);
  if (!cache) { cache = new Map(); stylePaintCache.set(element, cache); }
  let applied = state.accent;
  for (const branch of ['light', 'dark'] as const) {
    const entries = tokenEntries(tokens, branch);
    const reference = styleBackground(state, entries, branch, element);
    const key = JSON.stringify([tokens, state.accent, state.accentName, reference]);
    let cached = cache.get(branch);
    if (!cached || cached.key !== key) {
      const background = reference ? parseResolvedRgb(reference, MODE_DEFAULTS[branch].surface, element.ownerDocument) ?? MODE_DEFAULTS[branch].surface : MODE_DEFAULTS[branch].surface;
      const accent = state.accentName ? { applied: state.accent, properties: new Map<string, string>() } : paintAccent(state.accent, branch, background, element.ownerDocument);
      cached = { key, tokens: floorTokenEntries(entries, branch, background, element.ownerDocument), accent: accent.properties, applied: accent.applied };
      cache.set(branch, cached);
    }
    if (branch === mode) applied = cached.applied;
    const painted = cached.tokens;
    for (const [name, value] of painted) {
      if (STYLE_SLOTTED.includes(name) && styleTokenAllowed(name, value)) {
        if (styleFollow(name, value)) {
          desired.set(`--_lr-f${branch === 'light' ? 'l' : 'd'}-${name.slice(11)}`, ' ');
          desired.set(`--_lr-o${branch === 'light' ? 'l' : 'd'}-${name.slice(11)}`, 'initial');
        } else {
          desired.set(styleSlot(name, branch), value);
          if (STYLE_FOLLOW.includes(name)) {
            desired.set(`--_lr-f${branch === 'light' ? 'l' : 'd'}-${name.slice(11)}`, 'initial');
            desired.set(`--_lr-o${branch === 'light' ? 'l' : 'd'}-${name.slice(11)}`, ' ');
          }
        }
        if (wholeDocument && branch === mode) desired.set(name, resolver ? styleResolvedInput(name) : value);
      } else if (wholeDocument ? branch === mode : typeof tokens[name as LyraThemeTokenName] === 'string' && !STYLE_SLOTTED.includes(name)) desired.set(name, value);
    }
    // Named accents are stylesheet choices; only custom colors own inline ramp values.
    if (state.accent && !state.accentName) {
      for (const [name, value] of cached.accent) {
        if (name === '--lr-theme-accent') { if (branch === mode) desired.set(name, value); continue; }
        desired.set(styleSlot(name, branch, true), value);
        if (wholeDocument && branch === mode) desired.set(name, resolver ? styleResolvedInput(name) : value);
      }
    }
  }
  state.accent = applied;
  return desired;
}
interface StyleModeSubscription {
  readonly element: WeakRef<Element>;
  readonly callback: (element: Element) => void;
}
interface StyleModeGroup {
  readonly query: MediaQueryList;
  readonly subscriptions: Set<StyleModeSubscription>;
  readonly detach: () => void;
}
const styleModeGroups = new WeakMap<Window, StyleModeGroup>();
function attachStyleMode(element: Element, callback: (element: Element) => void): () => void {
  const view = element.ownerDocument.defaultView;
  if (!view?.matchMedia) return () => {};
  let group = styleModeGroups.get(view);
  if (!group) {
    const query = view.matchMedia(COLOR_SCHEME_QUERY);
    const subscriptions = new Set<StyleModeSubscription>();
    const modern = typeof query.addEventListener === 'function' && typeof query.removeEventListener === 'function';
    const detach = (): void => {
      if (modern) query.removeEventListener('change', listener);
      else query.removeListener?.(listener);
    };
    const listener = (): void => {
      for (const subscription of subscriptions) {
        const node = subscription.element.deref();
        if (node?.ownerDocument.defaultView === view) subscription.callback(node);
        else subscriptions.delete(subscription);
      }
      if (!subscriptions.size) {
        detach();
        styleModeGroups.delete(view);
      }
    };
    group = { query, subscriptions, detach };
    styleModeGroups.set(view, group);
    if (modern) query.addEventListener('change', listener);
    else query.addListener?.(listener);
  }
  const subscription = { element: new WeakRef(element), callback };
  group.subscriptions.add(subscription);
  const active = group;
  return () => {
    active.subscriptions.delete(subscription);
    if (!active.subscriptions.size) {
      active.detach();
      styleModeGroups.delete(view);
    }
  };
}
function applyStyleState(element: Element, state: StyleState, fields?: ReadonlySet<string>): void {
  const snapshot = styleSnapshot(state, element.ownerDocument.defaultView);
  const attributes = { ...lyraStyleAttributes(snapshot) };
  if (fields) for (const [field, name] of [['look', 'look'], ['surface', 'surface'], ['density', 'density'], ['mode', 'mode'], ['accent', 'accent']]) {
    if (!fields.has(field!)) delete attributes[`data-lr-${name}`];
  }
  // The parsed v1 color keyword must not accidentally select the gemstone stylesheet.
  if (state.accent && !state.accentName && (!fields || fields.has('accent'))) attributes['data-lr-accent'] = 'custom';
  if ((!fields || fields.has('mode')) && snapshot.resolvedMode) {
    attributes['data-lr-theme'] = snapshot.resolvedMode;
    attributes['data-theme'] = snapshot.resolvedMode;
  }
  if (state.tokens || state.overrides || (state.accent && !state.accentName)) attributes['data-lr-theme-scope'] = '';
  writeStyleAttributes(element, attributes);
  const desired = stylePaint(state, element, !fields);
  if ((!fields || fields.has('surface')) && element.ownerDocument.defaultView?.getComputedStyle(element).getPropertyValue('--_lr-style-resolver').trim() !== '1') {
    styleMaterial(desired, state.surface);
  }
  if (!state.accent && snapshot.accent) {
    attributes['data-lr-accent'] = 'none';
    if (!state.tokens && !state.overrides) delete attributes['data-lr-theme-scope'];
    writeStyleAttributes(element, attributes);
  }
  writeStyleProperties(element, desired);
  diagnoseStyleSheets(element, state, fields);
}

function diagnoseStyleSheets(element: Element, state: StyleState, fields?: ReadonlySet<string>): void {
  if (!litDevWarnings()) return;
  const selected = (field: string): boolean => !fields || fields.has(field);
  const required: [string, string, string][] = [];
  if (selected('look') && !state.tokens && state.look !== 'lyra' && state.look !== DEFAULT_STYLE.look) {
    required.push(['--_lr-look-installed', `${state.look}-1`, `the stylesheet for look '${state.look}'`]);
  }
  if (selected('surface') && state.surface === 'glass' && state.surface !== DEFAULT_STYLE.surface) required.push(['--_lr-surface-installed', '1', 'surfaces/glass.css']);
  if (selected('density') && state.density !== 'comfortable') required.push(['--_lr-density-installed', '1', 'density.css']);
  if (selected('accent') && state.accentName && state.accentName !== DEFAULT_STYLE.accentName) required.push(['--_lr-accent-installed', `${state.accentName}-1`, 'accents.css']);
  // A scoped runtime look paints private branches that theme.css resolves at that boundary.
  const scopedRuntime = Boolean(fields && (state.tokens || state.overrides || (state.accent && !state.accentName)));
  const alternateProfile = (selected('look') && !state.tokens && state.look !== DEFAULT_STYLE.look)
    || (selected('accent') && !state.accent);
  if (!required.length && !scopedRuntime && !alternateProfile) return;
  const computed = element.ownerDocument.defaultView?.getComputedStyle(element);
  if (!computed) return;
  if (computed.getPropertyValue('--_lr-style-resolver').trim() !== '1') {
    devWarnOnce('lyra-style:resolver', 'Lyra style choices require theme.css in the scope that owns their attributes.');
  }
  for (const [property, expected, stylesheet] of required) {
    if (computed.getPropertyValue(property).trim() !== expected) {
      devWarnOnce(`lyra-style:${property}:${expected}`, `Lyra could not find ${stylesheet} in this style scope; import or adopt the stylesheet before selecting it.`);
    }
  }
}
function emitStyleChange(state: StyleState, changed: readonly (LyraStyleField | 'resolvedMode')[]): void {
  const style = styleSnapshot(state, window);
  window.dispatchEvent(new CustomEvent('lr-style-change', { detail: Object.freeze({ style, changed: Object.freeze([...changed]) }) }));
}
/** Selects independent axes on the document root. Omitted fields keep their choices; null resets, except accent null clears. */
export function setLyraStyle(choices: LyraStyleChoices): Readonly<LyraStyle> {
  const before = readStyleState();
  return commitStyle(before, normalizeStyleChoices(choices, before));
}
function commitStyle(before: StyleState, next: StyleState): Readonly<LyraStyle> {
  if (typeof document !== 'undefined') {
    next.accent = normalizeAccent(next.accent);
    if (typeof next.accentBackground === 'string') next.accentBackground = normalizeColor(next.accentBackground);
    if (!next.accent) next.accentName = null;
  }
  persistStyle(next);
  if (typeof document !== 'undefined') {
    const root = document.documentElement;
    if (next.mode !== 'system' || styleModeRoot?.deref() !== root) {
      styleModeCleanup?.();
      styleModeCleanup = undefined;
      styleModeRoot = undefined;
    }
    adoptLegacyOwnership(root);
    const requestedAccent = next.accent;
    applyStyleState(root, next);
    if (!accentsEqual(requestedAccent, next.accent)) persistStyle(next);
    if (next.mode === 'system' && !styleModeCleanup) {
      styleModeRoot = new WeakRef(root);
      styleModeCleanup = attachStyleMode(root, element => {
        applyStyleState(element, lastStyle);
        emitStyleChange(lastStyle, ['resolvedMode']);
      });
    }
    const changed = STYLE_FIELDS.filter(field => field === 'look'
      ? before.look !== next.look || !tokensEqual(before.tokens, next.tokens)
      : field === 'accent' ? before.accentName !== next.accentName || !accentsEqual(before.accent, next.accent)
      : JSON.stringify(before[field as keyof StyleState]) !== JSON.stringify(next[field as keyof StyleState]));
    emitStyleChange(next, changed);
  }
  return styleSnapshot(next, typeof window === 'undefined' ? undefined : window);
}
function adoptLegacyOwnership(root: HTMLElement): void {
  // Bootstrap v1 stored only the names it painted. Adopt once before the v2 writer takes over.
  const symbol = Symbol.for(TOKEN_OWNERSHIP_SYMBOL);
  const node = root as unknown as Record<symbol, unknown>;
  try { if (!Array.isArray(node[symbol])) return; } catch { return; }
  const ownership = ownershipFor(root).properties;
  for (const name of [...readOwnershipList(), ...ALL_RAMP_PROPERTIES, '--lr-theme-accent']) {
    if (ownership.has(name) || !root.style.getPropertyValue(name)) continue;
    ownership.set(name, { before: null, priority: '', written: root.style.getPropertyValue(name) });
  }
  try { delete node[symbol]; } catch { /* Ownership remains available on a sealed root. */ }
}
/** Reads the persisted selection, falling back to the applied state if persistence failed. */
export function getLyraStyle(): Readonly<LyraStyle> {
  return styleSnapshot(readStyleState(), typeof window === 'undefined' ? undefined : window);
}
/** Resets selected fields to defaults, or all fields when no list is supplied. */
export function resetLyraStyle(fields: readonly LyraStyleField[] = STYLE_FIELDS): Readonly<LyraStyle> {
  const defaults: LyraStyleChoices = { ...STYLE_DEFAULTS, accentBackground: null, overrides: null };
  return setLyraStyle(Object.fromEntries(fields.filter(field => STYLE_FIELDS.includes(field)).map(field => [field, defaults[field]])));
}
/** Replaces one element's scoped choices. Omitted axes inherit; null restores author-owned values. */
export function applyLyraStyleScope(element: Element, choices: LyraStyleScopeChoices | null): void {
  scopeModes.get(element)?.(); scopeModes.delete(element);
  if (choices === null) { writeStyleAttributes(element, {}); writeStyleProperties(element, new Map()); return; }
  const state = normalizeStyleChoices(choices, { ...DEFAULT_STYLE });
  const fields = new Set(STYLE_FIELDS.filter(field => ownField(choices, field) !== undefined));
  applyStyleState(element, state, fields);
  if (choices.mode === 'system') scopeModes.set(element, attachStyleMode(element, node => applyStyleState(node, state, fields)));
}

/** Default-key pre-paint bootstrap; importing this string does not access browser globals. */
export const lyraThemeBootstrap = createLyraThemeBootstrap();
