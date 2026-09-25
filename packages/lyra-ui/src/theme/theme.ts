/**
 * Zero-dependency theme mode/accent runtime, published as the `@aceshooting/lyra-ui/theme.js`
 * subpath. Nothing here imports Lit, any component, or any other module in this package: the
 * whole point of the subpath is that an application can persist and apply a theme without
 * pulling the component graph into its first-paint bundle. Keep it dependency-free.
 *
 * This module is side-effect-free -- importing it never touches the document or storage -- and
 * therefore carries no `package.json#sideEffects` entry, so bundlers may drop it when unused.
 */

const STORAGE_KEY = 'lyra-theme';

export interface LyraThemeBootstrapOptions {
  /** The localStorage key holding a `{ mode, accent, surface, tokens? }` theme record. */
  storageKey?: string;
}

/**
 * Theme selection mode. `'light'` and `'dark'` are explicit overrides. `'auto'` resolves and
 * continues following `prefers-color-scheme`; `'unset'` removes Lyra's mode attributes so an
 * application-owned cascade can decide instead.
 */
export type LyraThemeMode = 'light' | 'dark' | 'auto' | 'unset';

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

/**
 * A theme input a token map may set: a `--lr-theme-*` custom property name. At run time a name
 * must also match `^--lr-theme-[a-z0-9]+(?:-[a-z0-9]+)*$`, be at most 80 characters long, and not be
 * `--lr-theme-accent`, which the accent runtime owns.
 */
export type LyraThemeTokenName = `--lr-theme-${string}`;

/**
 * A token's CSS value for both resolved modes, or a `{ light?, dark? }` pair. A `null` or omitted
 * branch leaves that mode to the stylesheets.
 */
export type LyraThemeTokenValue = string | { readonly light?: string | null; readonly dark?: string | null };

/**
 * Validated `--lr-theme-*` overrides, written inline on the document root. A map always replaces
 * the previous one wholesale; compose maps with object spread.
 */
export type LyraThemeTokens = { readonly [name: LyraThemeTokenName]: LyraThemeTokenValue };

/** Persisted theme selection, optional per-role accent, optional surface reference, and optional token map. */
export interface LyraTheme {
  /** Requested selection mode; `auto` remains distinct from its resolved light/dark value. */
  mode: LyraThemeMode;
  /**
   * Absolute CSS brand color, a per-role `LyraThemeAccentValue` map (each role optionally
   * per-mode via `{ light?, dark? }`), or `null` to use the active stylesheet palette.
   */
  accent: LyraThemeAccent;
  /**
   * Absolute CSS color used as the ramp mix base instead of the shipped light/dark surface
   * defaults (`#1a1a1a` dark / `#ffffff` light). `null` keeps those defaults. An alpha channel in
   * the supplied color is composited against the default surface for that mode before use.
   */
  surface: string | null;
  /**
   * Validated `--lr-theme-*` token map applied inline on the document root, or `null` to leave
   * every input to the stylesheets. Absent from every snapshot and stored record while no map is
   * applied; when present it is the normalized, deep-frozen map (trimmed strings, and per-mode
   * entries always carrying both `light` and `dark`, `null` for a missing branch).
   */
  tokens?: LyraThemeTokens | null;
}

/** Snapshot carried by the global `lr-theme-change` event. */
export type LyraThemeChangeDetail = Readonly<LyraTheme>;

declare global {
  interface WindowEventMap {
    'lr-theme-change': CustomEvent<LyraThemeChangeDetail>;
  }
}

/**
 * The complete internal theme state. Unlike the public `LyraTheme` snapshot it always carries
 * `tokens`; `toSnapshot`/`toRecord` are the only projections that build public values from it.
 */
interface ThemeState {
  mode: LyraThemeMode;
  accent: LyraThemeAccent;
  surface: string | null;
  tokens: LyraThemeTokens | null;
}

const DEFAULT_STATE: Readonly<ThemeState> = Object.freeze({ mode: 'auto', accent: null, surface: null, tokens: null });

type ResolvedThemeMode = 'light' | 'dark';
type Rgb = readonly [red: number, green: number, blue: number];

// The token-map grammar. scripts/fixtures/theme-token-grammar.json is the single source of these
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
 * The last theme this module applied. `localStorage` is the source of truth whenever it is
 * readable *and* writable; this is the fallback for the contexts where it is not (sandboxed
 * iframe, blocked third-party storage, private browsing, quota exhaustion). Without it every
 * `setLyraTheme` call would merge over `DEFAULT_STATE` and silently reset fields an earlier call
 * set -- breaking the documented "degrades to apply-without-persist" guarantee across two calls --
 * and `getLyraTheme()` would report a state the document does not actually have, so a toggle UI
 * bound to it would render the wrong position.
 */
let lastApplied: ThemeState = { ...DEFAULT_STATE };

/**
 * The token names this module last wrote inline. The shared ownership expando on `<html>` records
 * the same list for the bootstrap and other copies of the library; this module-local copy still
 * covers this module's own writes when a hostile page makes that expando unwritable.
 */
let writtenTokenNames: readonly string[] = [];

/**
 * What this module last asked for per inline name, and what the engine then serialized it as.
 * WebKit re-serializes a quoted string in a custom property value with double quotes, so comparing
 * the requested value with `getPropertyValue()` alone would rewrite every font-family token on
 * every apply there.
 */
const inlineWrites = new Map<string, { requested: string; serialized: string }>();

/**
 * True once a persist attempt has thrown and has not since succeeded. Storage may still be
 * *readable* in that state (quota exhaustion is the common case), but it no longer holds what we
 * applied, so a read would return a stale value; `lastApplied` is the truer answer.
 */
let persistenceFailed = false;

/**
 * `theme.css` keys its light/dark blocks off `data-lr-theme` (and the equivalent `.lr-light`/
 * `.lr-dark` classes). `data-theme` is the generic attribute apps and `ThemeWatcher`
 * (`src/internal/theme-watcher.ts`, which canvas-rendered components use to know when to
 * repaint) watch for. Both are written so a mode switch reaches the shipped stylesheet *and*
 * triggers a canvas repaint; writing only one leaves half the library on the old theme.
 */
const MODE_ATTRIBUTES = ['data-lr-theme', 'data-theme'] as const;

let autoMediaQuery: MediaQueryList | null = null;
let autoMediaListener: ((event: MediaQueryListEvent) => void) | null = null;

function isThemeMode(value: unknown): value is LyraThemeMode {
  return value === 'light' || value === 'dark' || value === 'auto' || value === 'unset';
}

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
 * characters, and never the reserved `--lr-theme-accent`. Shared with `presets.ts`.
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
 * and balanced parentheses and quotes. Shared with `presets.ts`, so a map `defineLyraThemePreset()`
 * accepts is never dropped at run time.
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
  return prototype === Object.prototype || prototype === null;
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
      const value = raw[name];
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
      const light = normalizeTokenBranch(value['light']);
      const dark = normalizeTokenBranch(value['dark']);
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
function normalizeColor(value: unknown): string | null {
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
  const probe = document.createElement('span');
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

function parseResolvedRgb(value: string, background: Rgb): Rgb | null {
  try {
    const canvas = document.createElement('canvas');
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
function ensureSurfaceContrast(color: Rgb, background: Rgb, minimum = 3, alsoAgainst: Rgb = background): Rgb {
  const passes = (candidate: Rgb): boolean =>
    contrastRatio(candidate, background) >= minimum && contrastRatio(candidate, alsoAgainst) >= minimum;
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

/** The shipped light/dark surface default a ramp mixes against when no `surface` is supplied. */
function defaultBackground(mode: ResolvedThemeMode): Rgb {
  return MODE_DEFAULTS[mode].surface;
}

/**
 * Resolves the mix base for every ramp: the supplied `surface` reference (its alpha, if any,
 * composited against the mode's own default surface), or that default surface unchanged.
 */
function resolveBackground(mode: ResolvedThemeMode, surface: string | null): Rgb {
  const fallback = defaultBackground(mode);
  if (!surface) return fallback;
  return parseResolvedRgb(surface, fallback) ?? fallback;
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
): Record<string, string> | null {
  const resolved = parseResolvedRgb(base, background);
  if (!resolved) return null;
  const quiet = mixRgb(background, resolved, mode === 'dark' ? 0.24 : 0.14);
  const normal = mixRgb(background, resolved, mode === 'dark' ? 0.62 : 0.55);
  const loud = resolved;
  const borderTarget: Rgb = mode === 'dark' ? [255, 255, 255] : [0, 0, 0];
  const borderQuiet = mixRgb(background, resolved, mode === 'dark' ? 0.46 : 0.38);
  const borderNormal = ensureSurfaceContrast(
    mixRgb(background, resolved, mode === 'dark' ? 0.78 : 0.72),
    background,
  );
  const borderLoud = ensureSurfaceContrast(mixRgb(resolved, borderTarget, 0.2), background);
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
  if (role === 'brand') ramp['--lr-theme-color-focus'] = serializeRgb(ensureSurfaceContrast(resolved, background));
  return ramp;
}

function detachAutoListener(): void {
  if (!autoMediaQuery || !autoMediaListener) return;
  if (typeof autoMediaQuery.removeEventListener === 'function') {
    autoMediaQuery.removeEventListener('change', autoMediaListener);
  } else {
    autoMediaQuery.removeListener(autoMediaListener);
  }
  autoMediaQuery = null;
  autoMediaListener = null;
}

function resolveThemeMode(mode: LyraThemeMode): ResolvedThemeMode | null {
  if (mode === 'light' || mode === 'dark') return mode;
  if (mode === 'unset') return null;
  return matchMedia(COLOR_SCHEME_QUERY).matches ? 'dark' : 'light';
}

function writeResolvedMode(mode: ResolvedThemeMode | null): void {
  const root = document.documentElement;
  for (const attribute of MODE_ATTRIBUTES) {
    if (mode) root.setAttribute(attribute, mode);
    else root.removeAttribute(attribute);
  }
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
): { applied: LyraThemeAccent; properties: Map<string, string> } {
  const properties = new Map<string, string>();
  if (!accent) return { applied: null, properties };
  if (!mode) return { applied: accent, properties };
  if (typeof accent === 'string') {
    const ramp = createRoleRamp('brand', accent, mode, background);
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
      const ramp = createRoleRamp(role, base, mode, background);
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
function resolveTokenColor(value: string | undefined, background: Rgb | null): Rgb | null {
  if (value === undefined || !background || !normalizeColor(value)) return null;
  return parseResolvedRgb(value, background);
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
): Map<string, string> {
  const painted = new Map(entries);
  const prefix = '--lr-theme-';
  const defaults = MODE_DEFAULTS[mode];
  const reference = (name: string, fallback: Rgb): Rgb | null =>
    entries.has(prefix + name) ? resolveTokenColor(entries.get(prefix + name), surface) : fallback;
  const raised = reference('color-surface-raised', defaults.raised);
  const floor = (name: string, over: Rgb | null, against: Rgb | null, minimum: number, alsoAgainst?: Rgb | null): void => {
    const value = painted.get(name);
    if (value === undefined || !against || alsoAgainst === null) return;
    const color = resolveTokenColor(value, over);
    if (!color) return;
    const repaired = ensureSurfaceContrast(color, against, minimum, alsoAgainst ?? against);
    if (repaired !== color) painted.set(name, serializeRgb(repaired));
  };

  // Row 1: body and quiet text against the page and the raised surface.
  floor(`${prefix}color-text-normal`, surface, surface, 4.5, raised);
  floor(`${prefix}color-text-quiet`, surface, surface, 4.5, raised);
  const text = entries.has(`${prefix}color-text-normal`)
    ? resolveTokenColor(painted.get(`${prefix}color-text-normal`), surface)
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
    const color = resolveTokenColor(on, fill);
    if (color && contrastRatio(color, fill) < 4.5) painted.set(onName, serializeRgb(contrastForeground(fill)));
  };
  for (const role of SEMANTIC_ROLES) {
    for (const tier of RAMP_TIERS) {
      const fillName = `${prefix}color-${role}-fill-${tier}`;
      if (!entries.has(fillName)) continue;
      pairForeground(`${prefix}color-${role}-on-${tier}`, resolveTokenColor(entries.get(fillName), surface));
    }
  }

  // Row 3: the strong scrim's foreground, synthesized when the map carries only the scrim.
  const overlayName = `${prefix}color-overlay-strong`;
  const overlay = entries.has(overlayName)
    ? resolveTokenColor(entries.get(overlayName), surface)
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

function writeOwnershipList(names: readonly string[]): void {
  try {
    (document.documentElement as unknown as Record<symbol, unknown>)[Symbol.for(TOKEN_OWNERSHIP_SYMBOL)] = Object.freeze([...names]);
  } catch {
    // A hostile page made the expando unwritable; `writtenTokenNames` still covers our own writes.
  }
}

/**
 * Writes the inline part of a theme state on `<html>`: the token map's entries for the resolved
 * mode (contrast-floored), then the accent ramp over them. Only names that change are touched: a
 * name this runtime (or the bootstrap) owned before and no longer wants is removed, a desired value
 * that differs is set, and re-applying an identical state performs no mutation at all. Returns the
 * accent value actually applied.
 */
function applyInlineTheme(state: ThemeState, mode: ResolvedThemeMode | null): LyraThemeAccent {
  const rootStyle = document.documentElement.style;
  const previous = new Set<string>([
    ...ALL_RAMP_PROPERTIES,
    '--lr-theme-accent',
    ...writtenTokenNames,
    ...readOwnershipList(),
  ]);
  const entries = tokenEntries(state.tokens, mode);
  let painted = entries;
  let background: Rgb = MODE_DEFAULTS.light.surface;
  if (mode) {
    // An explicit surface reference wins over the map's own page surface.
    background = resolveBackground(mode, state.surface ?? normalizeColor(entries.get('--lr-theme-color-surface-default')));
    painted = floorTokenEntries(entries, mode, background);
  }
  const accent = paintAccent(state.accent, mode, background);
  const desired = new Map(painted);
  for (const [name, value] of accent.properties) desired.set(name, value);

  const owned = [...painted.keys()];
  writtenTokenNames = owned;
  writeOwnershipList(owned);

  for (const name of previous) {
    if (desired.has(name)) continue;
    inlineWrites.delete(name);
    if (rootStyle.getPropertyValue(name) !== '') rootStyle.removeProperty(name);
  }
  for (const [name, value] of desired) {
    const current = rootStyle.getPropertyValue(name);
    const written = inlineWrites.get(name);
    if (current === value || (written?.requested === value && written.serialized === current)) continue;
    rootStyle.setProperty(name, value);
    inlineWrites.set(name, { requested: value, serialized: rootStyle.getPropertyValue(name) });
  }
  return accent.applied;
}

/** The public snapshot of a state: `tokens` appears only while a map is applied. */
function toSnapshot(state: ThemeState): LyraTheme {
  const snapshot: LyraTheme = { mode: state.mode, accent: state.accent, surface: state.surface };
  if (state.tokens) snapshot.tokens = state.tokens;
  return snapshot;
}

/** The persisted record of a state; the same shape as the snapshot. */
function toRecord(state: ThemeState): LyraTheme {
  return toSnapshot(state);
}

function readStoredState(): ThemeState {
  // Storage cannot be trusted to hold what we applied -- honour the session's own state instead.
  if (persistenceFailed) return { ...lastApplied };

  let raw: string | null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    // Storage is unreachable (sandboxed iframe, blocked third-party storage, private browsing).
    // What this module last applied is a truer answer than the default.
    return { ...lastApplied };
  }

  // Reachable storage with nothing in it is a genuine "unset" -- distinct from the cases above,
  // and the one case where the default really is correct.
  if (!raw) return { ...DEFAULT_STATE };

  try {
    const parsed = JSON.parse(raw) as Partial<LyraTheme> | null;
    if (!parsed || typeof parsed !== 'object') return { ...DEFAULT_STATE };
    return {
      mode: isThemeMode(parsed.mode) ? parsed.mode : 'auto',
      accent: normalizeAccent(parsed.accent),
      surface: normalizeColor(parsed.surface),
      tokens: normalizeTokens(parsed.tokens),
    };
  } catch {
    // Readable storage holding garbage (another tool wrote the key, a truncated write): also a
    // genuine "nothing valid stored", so the default applies rather than `lastApplied`.
    return { ...DEFAULT_STATE };
  }
}

function applyTheme(state: ThemeState): void {
  detachAutoListener();
  let resolvedMode = resolveThemeMode(state.mode);
  const accent = applyInlineTheme(state, resolvedMode);
  lastApplied = { ...state, accent };
  writeResolvedMode(resolvedMode);

  if (state.mode !== 'auto') return;
  autoMediaQuery = matchMedia(COLOR_SCHEME_QUERY);
  autoMediaListener = (event) => {
    resolvedMode = event.matches ? 'dark' : 'light';
    writeResolvedMode(resolvedMode);
    applyInlineTheme(lastApplied, resolvedMode);
    window.dispatchEvent(new CustomEvent('lr-theme-change', { detail: toSnapshot(lastApplied) }));
  };
  if (typeof autoMediaQuery.addEventListener === 'function') {
    autoMediaQuery.addEventListener('change', autoMediaListener);
  } else {
    autoMediaQuery.addListener(autoMediaListener);
  }
}

/**
 * Sets the persisted theme mode/accent/surface/tokens, applies it to `document.documentElement`
 * (via `data-lr-theme`/`data-theme`, the token map's inline `--lr-theme-*` values, and a complete
 * `--lr-theme-color-<role>-*` ramp per role `accent` supplies), and dispatches `lr-theme-change`
 * on `window` with `detail: { mode, accent, surface, tokens? }`. Unspecified fields keep their
 * current value. Never throws -- a `localStorage` failure (private browsing, quota, sandboxed
 * iframe) degrades to apply-without-persist, and unspecified fields still keep their value across
 * calls in that state, because the merge falls back to the last applied theme rather than to the
 * default.
 *
 * `accent` is either an absolute CSS color (shorthand for `{ brand: <color> }`), a per-role
 * `{ brand?, success?, warning?, danger?, neutral? }` map, or `null`. Each role's value is in turn
 * either a bare CSS color/`null` (applied to both resolved modes) or a `{ light?, dark? }` map
 * deriving that role's ramp from a *different* base color per resolved mode -- e.g.
 * `{ brand: { light: '#2563eb', dark: '#60a5fa' } }`. `surface` is an absolute CSS color used as
 * every ramp's mix base instead of the shipped light/dark defaults, or `null` to keep those
 * defaults. Malformed (including an unclosed parenthesis or quote), CSS-wide, relative, and
 * unresolved `var()` values fail closed to `null` at the field (or, for a per-role/per-mode value,
 * the individual role/branch) they appear in. Each generated fill receives a black or white
 * foreground with at least 4.5:1 contrast; normal/loud borders and the brand focus color have at
 * least 3:1 contrast against the resolved surface.
 *
 * `tokens` is a map of `--lr-theme-*` inputs, each a CSS value or a `{ light?, dark? }` pair, that
 * replaces the previous map wholesale; `null`, `{}` or a map with no valid entry removes it.
 * Invalid names and values are dropped individually (see the package docs for the grammar), a
 * per-mode branch applies only while Lyra resolves that mode (so `mode: 'unset'` writes bare values
 * only), and colour families the static contrast gate checks are floored against the map's own
 * surfaces before they are written. An accent ramp overrides the map for the roles it paints.
 */
export function setLyraTheme(theme: Partial<LyraTheme>): void {
  // A direct mode/accent/surface edit is no longer exactly the named preset that may have produced
  // the previous state. applyLyraThemePreset() writes its marker back after this call completes.
  document.documentElement.removeAttribute('data-lr-theme-preset');
  const current = readStoredState();
  const next: ThemeState = {
    mode: theme.mode === undefined
      ? current.mode
      : isThemeMode(theme.mode)
        ? theme.mode
        : 'auto',
    accent: theme.accent === undefined ? current.accent : normalizeAccent(theme.accent),
    surface: theme.surface === undefined ? current.surface : normalizeColor(theme.surface),
    tokens: theme.tokens === undefined ? current.tokens : normalizeTokens(theme.tokens),
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toRecord(next)));
    persistenceFailed = false;
  } catch {
    // Persistence is best-effort; the theme still applies for this session. Latching the failure
    // makes subsequent calls merge over what we actually applied (`lastApplied`) instead of over
    // a stale read or the default, so nothing silently resets.
    persistenceFailed = true;
  }
  applyTheme(next);
  // applyTheme can fail a computed color (or one role of it) closed even after the syntax-level
  // check above.
  const applied = lastApplied;
  if (!accentsEqual(applied.accent, next.accent)) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(toRecord(applied)));
      persistenceFailed = false;
    } catch {
      persistenceFailed = true;
    }
  }
  window.dispatchEvent(new CustomEvent('lr-theme-change', { detail: toSnapshot(applied) }));
}

/**
 * Reads the current theme mode/accent/surface (plus `tokens` while a map is applied), defaulting
 * to `{ mode: 'auto', accent: null, surface: null }` when nothing has been set or the stored value
 * is malformed. Storage is re-read on every call -- there is no in-memory cache -- so a value
 * written by another tab or a previous session is picked up cold.
 *
 * When `localStorage` is unreadable or unwritable this reports the theme this module last
 * applied, not the default: the returned value always describes what the document is actually
 * showing, so a toggle UI bound to it stays in sync even where nothing can be persisted.
 */
export function getLyraTheme(): LyraTheme {
  return toSnapshot(readStoredState());
}

/**
 * Kept self-contained because createLyraThemeBootstrap serializes this function verbatim -- every
 * identifier it references must be either a parameter, a local declaration, or a browser global,
 * never a module-scoped constant, or the serialized string throws a ReferenceError when it later
 * runs standalone with no `theme.ts` module loaded.
 *
 * The config-resolution prelude lets an external `<script src="theme-bootstrap.js">` override the
 * generation-time defaults via two attributes on its own tag --
 * `data-lr-theme-storage-key`/`data-lr-theme-attributes` (space-separated) -- read via
 * `document.currentScript` at parse time. Hostile or malformed values fail closed to the
 * caller-supplied default rather than throwing.
 *
 * It mirrors the runtime's token pipeline step for step (grammar, per-mode branch, contrast floor,
 * ownership list) with literal copies, clears what the shared ownership list names, then writes the
 * list before the values so the runtime's first apply can remove exactly what was written here.
 */
function applyStoredThemeBeforePaint(
  defaultStorageKey: string,
  defaultModeAttributes: readonly string[],
): void {
  try {
    // Config-resolution prelude: an external classic script (never a module or async script) can
    // reach its own <script> element synchronously through `document.currentScript` before this
    // IIFE runs, so a single static asset can be reconfigured per host page via two attributes on
    // its own tag, with no per-app regeneration. Both are optional and fail closed -- a missing,
    // empty, oversized, or malformed value keeps the generation-time default -- so a host page
    // with neither attribute (including every inline use, where a `<script>` normally carries
    // neither) behaves byte-for-byte like before this existed.
    const attributeNamePattern = /^data-[a-z0-9]+(?:-[a-z0-9]+)*$/;
    const maxStorageKeyLength = 200;
    const maxModeAttributeCount = 8;
    const maxModeAttributeNameLength = 64;

    const isValidStorageKey = (value: string): boolean =>
      value.length > 0 && value.length <= maxStorageKeyLength;

    const isValidModeAttributeName = (value: string): boolean =>
      value.length > 0
      && value.length <= maxModeAttributeNameLength
      && attributeNamePattern.test(value);

    const isValidModeAttributeList = (value: string[]): boolean => {
      if (value.length === 0 || value.length > maxModeAttributeCount) return false;
      const seen = new Set<string>();
      for (const name of value) {
        if (!isValidModeAttributeName(name) || seen.has(name)) return false;
        seen.add(name);
      }
      return true;
    };

    let storageKey = defaultStorageKey;
    let modeAttributes = defaultModeAttributes;
    // `currentScript` is `null` for a module or async script (documented as unsupported for this
    // asset) -- guarded here, not just by the outer try/catch, so a null/absent script always
    // resolves to the defaults above rather than skipping the rest of the bootstrap.
    const configScript = document.currentScript as HTMLScriptElement | null;
    if (configScript) {
      const rawStorageKey = configScript.getAttribute('data-lr-theme-storage-key');
      if (rawStorageKey !== null && isValidStorageKey(rawStorageKey)) {
        storageKey = rawStorageKey;
      }
      const rawModeAttributes = configScript.getAttribute('data-lr-theme-attributes');
      if (rawModeAttributes !== null) {
        const parsedModeAttributes = rawModeAttributes.trim().length > 0
          ? rawModeAttributes.trim().split(/\s+/)
          : [];
        if (isValidModeAttributeList(parsedModeAttributes)) {
          modeAttributes = parsedModeAttributes;
        }
      }
    }

    const raw = localStorage.getItem(storageKey);
    let theme: { mode?: unknown; accent?: unknown; surface?: unknown; tokens?: unknown } = {};
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as unknown;
        if (parsed && typeof parsed === 'object') {
          theme = parsed as { mode?: unknown; accent?: unknown; surface?: unknown; tokens?: unknown };
        }
      } catch {
        // A corrupt record has the same automatic default as the module getter.
      }
    }
    const mode = theme.mode === 'light' || theme.mode === 'dark' || theme.mode === 'unset'
      ? theme.mode
      : 'auto';
    let resolvedMode: 'light' | 'dark' | null = null;
    if (mode === 'light' || mode === 'dark') resolvedMode = mode;
    else if (mode === 'auto') {
      resolvedMode = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    for (const attribute of modeAttributes) {
      if (resolvedMode) document.documentElement.setAttribute(attribute, resolvedMode);
      else if (mode === 'unset') document.documentElement.removeAttribute(attribute);
    }

    const root = document.documentElement;
    const style = root.style;
    const roles = ['brand', 'success', 'warning', 'danger', 'neutral'];
    const channels = ['fill', 'border', 'on'];
    const tiers = ['quiet', 'normal', 'loud'];
    const properties: string[] = [];
    for (const role of roles) {
      for (const channel of channels) {
        for (const tier of tiers) properties.push(`--lr-theme-color-${role}-${channel}-${tier}`);
      }
    }
    properties.push('--lr-theme-color-focus');

    // Literal copy of the token-map grammar (scripts/fixtures/theme-token-grammar.json is the single
    // source; scripts/theme-token-grammar.test.mjs keeps this copy identical to it).
    const tokenNamePattern = /^--lr-theme-[a-z0-9]+(?:-[a-z0-9]+)*$/;
    const tokenNameMaxLength = 80;
    const tokenReservedName = '--lr-theme-accent';
    const tokenEntryMax = 512;
    const tokenSynthesizedMax = 16;
    const tokenValueMaxLength = 256;
    const tokenForbiddenPattern = /[\x00-\x1f\x7f\\;{}!<>@[\]`$^|~=?&:\u2028\u2029]|\/\*|\*\//;
    const tokenCssWidePattern = /^(?:inherit|initial|revert(?:-layer)?|unset)$/i;
    const tokenFunctionPattern = /([a-z0-9_-]+)\s*\(/gi;
    const tokenAllowedFunctions = 'rgb rgba hsl hsla hwb lab lch oklab oklch color color-mix light-dark calc min max clamp var cubic-bezier steps linear'.split(' ');
    const tokenOwnershipKey = Symbol.for('@aceshooting/lyra-ui.theme-tokens.v1');
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

    // Clear what a previous page (or another copy of the runtime) owned: every ramp property, the
    // accent hook, and each validated name on the shared ownership list.
    const ownedBefore: string[] = [];
    try {
      const list = (root as unknown as Record<symbol, unknown>)[tokenOwnershipKey];
      if (Array.isArray(list)) {
        const length = Math.min(list.length, tokenEntryMax + tokenSynthesizedMax);
        for (let index = 0; index < length; index += 1) {
          const name: unknown = list[index];
          if (isTokenName(name)) ownedBefore.push(name);
        }
      }
    } catch {
      ownedBefore.length = 0;
    }
    for (const property of [...properties, '--lr-theme-accent', ...ownedBefore]) style.removeProperty(property);

    // The stored token map's entries for the resolved mode, normalized exactly as the runtime does.
    const entries = new Map<string, string>();
    try {
      const rawTokens = theme.tokens;
      const names = isPlain(rawTokens) ? Object.keys(rawTokens) : [];
      if (isPlain(rawTokens) && names.length <= tokenEntryMax) {
        for (const name of names) {
          if (!isTokenName(name)) continue;
          const value = rawTokens[name];
          if (typeof value === 'string') {
            const normalized = safeTokenValue(value);
            if (normalized !== null) entries.set(name, normalized);
            continue;
          }
          if (!isPlain(value)) continue;
          const hasLight = Object.prototype.hasOwnProperty.call(value, 'light');
          const hasDark = Object.prototype.hasOwnProperty.call(value, 'dark');
          if ((!hasLight && !hasDark) || Object.keys(value).some((key) => key !== 'light' && key !== 'dark')) continue;
          const branch = resolvedMode ? safeTokenValue(value[resolvedMode]) : null;
          if (branch !== null) entries.set(name, branch);
        }
      }
    } catch {
      entries.clear();
    }

    const unsupported = (value: string) =>
      tokenCssWidePattern.test(value)
        || /^(?:accentcolor|accentcolortext|activetext|buttonborder|buttonface|buttontext|canvas|canvastext|field|fieldtext|graytext|highlight|highlighttext|linktext|mark|marktext|selecteditem|selecteditemtext|visitedtext)$/i.test(value)
        || /\bcurrentcolor\b/i.test(value)
        || /\bvar\s*\(/i.test(value)
        || /\blight-dark\s*\(/i.test(value)
        || /\b(?:rgb|rgba|hsl|hsla|hwb|lab|lch|oklab|oklch|color)\s*\(\s*from\b/i.test(value);

    const normalize = (raw: unknown): string | null => {
      if (typeof raw !== 'string') return null;
      const trimmed = raw.trim();
      if (!trimmed || !isBalanced(trimmed) || unsupported(trimmed)) return null;
      const syntaxProbe = document.createElement('span');
      syntaxProbe.style.color = trimmed;
      return syntaxProbe.style.color ? trimmed : null;
    };

    // A role's raw value is a bare color, `null`, or a `{ light, dark }` per-mode map -- resolves
    // to the branch matching `resolvedMode` (mirroring theme.ts's own `resolveAccentValueForMode`)
    // before the same syntax-level `normalize` every other color passes through.
    const resolveRoleAccent = (raw: unknown): string | null => {
      if (typeof raw === 'string') return normalize(raw);
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
      const perMode = raw as Record<string, unknown>;
      if (!resolvedMode || (!('light' in perMode) && !('dark' in perMode))) return null;
      return normalize(perMode[resolvedMode]);
    };

    const accentRoles: Record<string, string> = {};
    const rawAccent = theme.accent;
    if (typeof rawAccent === 'string') {
      const normalized = normalize(rawAccent);
      if (normalized) accentRoles['brand'] = normalized;
    } else if (rawAccent && typeof rawAccent === 'object' && !Array.isArray(rawAccent)) {
      for (const role of roles) {
        const normalized = resolveRoleAccent((rawAccent as Record<string, unknown>)[role]);
        if (normalized) accentRoles[role] = normalized;
      }
    }

    let context: CanvasRenderingContext2D | null = null;
    if (resolvedMode && (entries.size > 0 || Object.keys(accentRoles).length > 0)) {
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
        contrast(candidate, background) >= minimum && contrast(candidate, alsoAgainst) >= minimum;
      if (passes(value)) return value;
      const target = contrast(background, black) >= contrast(background, white) ? black : white;
      for (let step = 1; step <= 10; step += 1) {
        const candidate = mix(value, target, step / 10);
        if (passes(candidate)) return candidate;
      }
      return target;
    };
    const rgb = (value: number[]) => `rgb(${value.join(' ')})`;

    const defaults = modeDefaults[resolvedMode ?? 'light'];
    const defaultSurface = defaults.surface;
    const surface = normalize(theme.surface) ?? normalize(entries.get('--lr-theme-color-surface-default'));
    const background = (surface && paintRgb(surface, defaultSurface)) || defaultSurface;

    // The contrast floor, row for row the runtime's: an unresolved value or reference is written
    // verbatim and synthesizes nothing.
    const painted = new Map(entries);
    if (resolvedMode) {
      const prefix = '--lr-theme-';
      const resolveToken = (value: string | undefined, over: number[] | null): number[] | null =>
        value !== undefined && over && normalize(value) ? paintRgb(value, over) : null;
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
      const synthesized = new Map<string, string>();
      const pairForeground = (onName: string, fill: number[] | null): void => {
        if (!fill) return;
        const onValue = painted.get(onName);
        if (onValue === undefined) {
          synthesized.set(onName, rgb(on(fill)));
          return;
        }
        const color = resolveToken(onValue, fill);
        if (color && contrast(color, fill) < 4.5) painted.set(onName, rgb(on(fill)));
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
      const boundaries = [
        ...roles.flatMap((role) => [`${prefix}color-${role}-border-normal`, `${prefix}color-${role}-border-loud`]),
        `${prefix}color-surface-border`,
        `${prefix}color-border-strong`,
        `${prefix}color-focus`,
      ];
      for (const name of boundaries) floor(name, background, background, 3);
      for (const name of entries.keys()) {
        if (/^--lr-theme-color-chart-\d+$/.test(name)) floor(name, background, background, 3);
        else if (/^--lr-theme-terminal-color-[a-z0-9-]+$/.test(name)) floor(name, raised, raised, 4.5);
        else if (/^--lr-theme-terminal-bg-[a-z0-9-]+$/.test(name)) floor(name, raised, text, 4.5);
      }
      for (const [name, value] of synthesized) painted.set(name, value);
    }

    // Ownership first, so a later runtime apply removes exactly these names; then the values.
    try {
      (root as unknown as Record<symbol, unknown>)[tokenOwnershipKey] = Object.freeze([...painted.keys()]);
    } catch {
      // An unwritable expando only costs the handoff; the values are still written.
    }
    for (const [name, value] of painted) style.setProperty(name, value);

    if (!resolvedMode || !context) {
      style.removeProperty('--lr-theme-accent');
      return;
    }

    let appliedBrand: string | null = null;
    for (const role of roles) {
      const base = accentRoles[role];
      if (!base) continue;
      const color = paintRgb(base, background);
      if (!color) continue;
      const quiet = mix(background, color, resolvedMode === 'dark' ? 0.24 : 0.14);
      const normal = mix(background, color, resolvedMode === 'dark' ? 0.62 : 0.55);
      const borderTarget = resolvedMode === 'dark' ? white : black;
      const borderQuiet = mix(background, color, resolvedMode === 'dark' ? 0.46 : 0.38);
      const borderNormal = ensureContrast(
        mix(background, color, resolvedMode === 'dark' ? 0.78 : 0.72),
        background,
      );
      const borderLoud = ensureContrast(mix(color, borderTarget, 0.2), background);
      const prefix = `--lr-theme-color-${role}`;
      style.setProperty(`${prefix}-fill-quiet`, rgb(quiet));
      style.setProperty(`${prefix}-fill-normal`, rgb(normal));
      style.setProperty(`${prefix}-fill-loud`, rgb(color));
      style.setProperty(`${prefix}-border-quiet`, rgb(borderQuiet));
      style.setProperty(`${prefix}-border-normal`, rgb(borderNormal));
      style.setProperty(`${prefix}-border-loud`, rgb(borderLoud));
      style.setProperty(`${prefix}-on-quiet`, rgb(on(quiet)));
      style.setProperty(`${prefix}-on-normal`, rgb(on(normal)));
      style.setProperty(`${prefix}-on-loud`, rgb(on(color)));
      if (role === 'brand') {
        style.setProperty('--lr-theme-color-focus', rgb(ensureContrast(color, background)));
        appliedBrand = base;
      }
    }
    if (appliedBrand) style.setProperty('--lr-theme-accent', appliedBrand);
    else style.removeProperty('--lr-theme-accent');
  } catch {
    // A no-flash bootstrap must never block the rest of the document head.
  }
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
 * does. Missing and malformed records use the runtime's automatic/no-accent default.
 * The serialized options escape HTML script terminators and JavaScript line separators.
 * Pass an application-owned `storageKey` to reuse the no-flash bootstrap independently of this
 * module's `setLyraTheme()`/`getLyraTheme()` persistence key.
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
  return `(${applyStoredThemeBeforePaint.toString()})(${serializeInlineScriptData(storageKey)},${serializeInlineScriptData(MODE_ATTRIBUTES)});`;
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
export const lyraThemeBootstrap = createLyraThemeBootstrap();
