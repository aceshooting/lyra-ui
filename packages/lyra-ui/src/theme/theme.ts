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
  /** The localStorage key holding a `{ mode, accent, surface }` theme record. */
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

/** Persisted theme selection, optional per-role accent, and optional surface reference. */
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
}

/** Snapshot carried by the global `lr-theme-change` event. */
export type LyraThemeChangeDetail = Readonly<LyraTheme>;

declare global {
  interface WindowEventMap {
    'lr-theme-change': CustomEvent<LyraThemeChangeDetail>;
  }
}

const DEFAULT_THEME: Readonly<LyraTheme> = Object.freeze({ mode: 'auto', accent: null, surface: null });

type ResolvedThemeMode = 'light' | 'dark';
type Rgb = readonly [red: number, green: number, blue: number];

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
 * `setLyraTheme` call would merge over `DEFAULT_THEME` and silently reset fields an earlier call
 * set -- breaking the documented "degrades to apply-without-persist" guarantee across two calls --
 * and `getLyraTheme()` would report a state the document does not actually have, so a toggle UI
 * bound to it would render the wrong position.
 */
let lastApplied: LyraTheme = { ...DEFAULT_THEME };

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

/** Syntax-level validation shared by a bare accent string, a per-role accent value, and `surface`. */
function normalizeColor(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  const candidate = value.trim();
  // Relative and CSS-wide values cannot be converted into a deterministic semantic ramp.
  if (/^(?:inherit|initial|revert(?:-layer)?|unset)$/i.test(candidate)) return null;
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

function ensureSurfaceContrast(color: Rgb, background: Rgb): Rgb {
  if (contrastRatio(color, background) >= 3) return color;
  const black: Rgb = [0, 0, 0];
  const white: Rgb = [255, 255, 255];
  const target = contrastRatio(background, black) >= contrastRatio(background, white) ? black : white;
  for (let step = 1; step <= 10; step += 1) {
    const candidate = mixRgb(color, target, step / 10);
    if (contrastRatio(candidate, background) >= 3) return candidate;
  }
  return target;
}

/** The shipped light/dark surface default a ramp mixes against when no `surface` is supplied. */
function defaultBackground(mode: ResolvedThemeMode): Rgb {
  return mode === 'dark' ? [26, 26, 26] : [255, 255, 255];
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
 * Clears every ramp property, then (re)derives whichever roles `accent` supplies against `surface`
 * (or the mode default). Returns the accent value actually applied -- `null` when nothing could be
 * resolved, a bare string when the single brand ramp applied, or an object of only the roles that
 * resolved (or, for a `{ light, dark }` role value, still carry an unpainted branch for the other
 * mode), so callers can tell a total failure apart from what was requested and so a later mode
 * change can still resolve a branch that the active mode did not paint.
 */
function writeAccent(
  accent: LyraThemeAccent,
  surface: string | null,
  mode: ResolvedThemeMode | null,
): LyraThemeAccent {
  const rootStyle = document.documentElement.style;
  for (const property of ALL_RAMP_PROPERTIES) rootStyle.removeProperty(property);
  if (!accent) {
    rootStyle.removeProperty('--lr-theme-accent');
    return null;
  }
  if (!mode) {
    rootStyle.removeProperty('--lr-theme-accent');
    return accent;
  }
  const background = resolveBackground(mode, surface);
  if (typeof accent === 'string') {
    const ramp = createRoleRamp('brand', accent, mode, background);
    if (!ramp) {
      rootStyle.removeProperty('--lr-theme-accent');
      return null;
    }
    rootStyle.setProperty('--lr-theme-accent', accent);
    for (const [property, value] of Object.entries(ramp)) rootStyle.setProperty(property, value);
    return accent;
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
        for (const [property, propertyValue] of Object.entries(ramp)) rootStyle.setProperty(property, propertyValue);
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
  if (appliedBrandColor) rootStyle.setProperty('--lr-theme-accent', appliedBrandColor);
  else rootStyle.removeProperty('--lr-theme-accent');
  return Object.keys(applied).length > 0 ? applied : null;
}

function readStoredTheme(): LyraTheme {
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
  if (!raw) return { ...DEFAULT_THEME };

  try {
    const parsed = JSON.parse(raw) as Partial<LyraTheme>;
    return {
      mode: isThemeMode(parsed.mode) ? parsed.mode : 'auto',
      accent: normalizeAccent(parsed.accent),
      surface: normalizeColor(parsed.surface),
    };
  } catch {
    // Readable storage holding garbage (another tool wrote the key, a truncated write): also a
    // genuine "nothing valid stored", so the default applies rather than `lastApplied`.
    return { ...DEFAULT_THEME };
  }
}

function applyTheme(theme: LyraTheme): void {
  detachAutoListener();
  let resolvedMode = resolveThemeMode(theme.mode);
  const accent = writeAccent(theme.accent, theme.surface, resolvedMode);
  lastApplied = { ...theme, accent };
  writeResolvedMode(resolvedMode);

  if (theme.mode !== 'auto') return;
  autoMediaQuery = matchMedia(COLOR_SCHEME_QUERY);
  autoMediaListener = (event) => {
    resolvedMode = event.matches ? 'dark' : 'light';
    writeResolvedMode(resolvedMode);
    writeAccent(lastApplied.accent, lastApplied.surface, resolvedMode);
    window.dispatchEvent(new CustomEvent('lr-theme-change', { detail: { ...lastApplied } }));
  };
  if (typeof autoMediaQuery.addEventListener === 'function') {
    autoMediaQuery.addEventListener('change', autoMediaListener);
  } else {
    autoMediaQuery.addListener(autoMediaListener);
  }
}

/**
 * Sets the persisted theme mode/accent/surface, applies it to `document.documentElement` (via
 * `data-lr-theme`/`data-theme` and a complete `--lr-theme-color-<role>-*` ramp per role `accent`
 * supplies), and dispatches `lr-theme-change` on `window` with `detail: { mode, accent, surface }`.
 * Unspecified fields keep their current value. Never throws -- a `localStorage` failure (private
 * browsing, quota, sandboxed iframe) degrades to apply-without-persist, and unspecified fields
 * still keep their value across calls in that state, because the merge falls back to the last
 * applied theme rather than to the default.
 *
 * `accent` is either an absolute CSS color (shorthand for `{ brand: <color> }`), a per-role
 * `{ brand?, success?, warning?, danger?, neutral? }` map, or `null`. Each role's value is in turn
 * either a bare CSS color/`null` (applied to both resolved modes) or a `{ light?, dark? }` map
 * deriving that role's ramp from a *different* base color per resolved mode -- e.g.
 * `{ brand: { light: '#2563eb', dark: '#60a5fa' } }`. `surface` is an absolute CSS color used as
 * every ramp's mix base instead of the shipped light/dark defaults, or `null` to keep those
 * defaults. Malformed, CSS-wide, relative, and unresolved `var()` values fail closed to `null` at
 * the field (or, for a per-role/per-mode value, the individual role/branch) they appear in. Each
 * generated fill receives a black or white foreground with at least 4.5:1 contrast; normal/loud
 * borders and the brand focus color have at least 3:1 contrast against the resolved surface.
 */
export function setLyraTheme(theme: Partial<LyraTheme>): void {
  // A direct mode/accent/surface edit is no longer exactly the named preset that may have produced
  // the previous state. applyLyraThemePreset() writes its marker back after this call completes.
  document.documentElement.removeAttribute('data-lr-theme-preset');
  const current = readStoredTheme();
  const next: LyraTheme = {
    mode: theme.mode === undefined
      ? current.mode
      : isThemeMode(theme.mode)
        ? theme.mode
        : 'auto',
    accent: theme.accent === undefined ? current.accent : normalizeAccent(theme.accent),
    surface: theme.surface === undefined ? current.surface : normalizeColor(theme.surface),
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
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
      localStorage.setItem(STORAGE_KEY, JSON.stringify(applied));
      persistenceFailed = false;
    } catch {
      persistenceFailed = true;
    }
  }
  window.dispatchEvent(new CustomEvent('lr-theme-change', { detail: { ...applied } }));
}

/**
 * Reads the current theme mode/accent/surface, defaulting to
 * `{ mode: 'auto', accent: null, surface: null }` when nothing has been set or the stored value is
 * malformed. Storage is re-read on every call -- there is no in-memory cache -- so a value written
 * by another tab or a previous session is picked up cold.
 *
 * When `localStorage` is unreadable or unwritable this reports the theme this module last
 * applied, not the default: the returned value always describes what the document is actually
 * showing, so a toggle UI bound to it stays in sync even where nothing can be persisted.
 */
export function getLyraTheme(): LyraTheme {
  return readStoredTheme();
}

/** Kept self-contained because createLyraThemeBootstrap serializes this function verbatim. */
function applyStoredThemeBeforePaint(storageKey: string, modeAttributes: readonly string[]): void {
  try {
    const raw = localStorage.getItem(storageKey);
    let theme: { mode?: unknown; accent?: unknown; surface?: unknown } = {};
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as unknown;
        if (parsed && typeof parsed === 'object') {
          theme = parsed as { mode?: unknown; accent?: unknown; surface?: unknown };
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

    const style = document.documentElement.style;
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
    for (const property of properties) style.removeProperty(property);

    const unsupported = (value: string) =>
      /^(?:inherit|initial|revert(?:-layer)?|unset)$/i.test(value)
        || /^(?:accentcolor|accentcolortext|activetext|buttonborder|buttonface|buttontext|canvas|canvastext|field|fieldtext|graytext|highlight|highlighttext|linktext|mark|marktext|selecteditem|selecteditemtext|visitedtext)$/i.test(value)
        || /\bcurrentcolor\b/i.test(value)
        || /\bvar\s*\(/i.test(value)
        || /\blight-dark\s*\(/i.test(value)
        || /\b(?:rgb|rgba|hsl|hsla|hwb|lab|lch|oklab|oklch|color)\s*\(\s*from\b/i.test(value);

    const normalize = (raw: unknown): string | null => {
      if (typeof raw !== 'string') return null;
      const trimmed = raw.trim();
      if (!trimmed || unsupported(trimmed)) return null;
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

    if (!resolvedMode || Object.keys(accentRoles).length === 0) {
      style.removeProperty('--lr-theme-accent');
      return;
    }

    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) {
      style.removeProperty('--lr-theme-accent');
      return;
    }

    const paintRgb = (value: string, background: number[]): number[] | null => {
      try {
        context.clearRect(0, 0, 1, 1);
        context.fillStyle = value;
        context.fillRect(0, 0, 1, 1);
        const channelsData = [...context.getImageData(0, 0, 1, 1).data];
        const alpha = (channelsData[3] ?? 0) / 255;
        return channelsData.slice(0, 3).map((channel, index) =>
          Math.round(channel * alpha + (background[index] ?? 0) * (1 - alpha)));
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
    const ensureContrast = (value: number[], background: number[]) => {
      if (contrast(value, background) >= 3) return value;
      const target = contrast(background, black) >= contrast(background, white) ? black : white;
      for (let step = 1; step <= 10; step += 1) {
        const candidate = mix(value, target, step / 10);
        if (contrast(candidate, background) >= 3) return candidate;
      }
      return target;
    };
    const rgb = (value: number[]) => `rgb(${value.join(' ')})`;

    const defaultSurface = resolvedMode === 'dark' ? [26, 26, 26] : [255, 255, 255];
    const surface = normalize(theme.surface);
    const background = (surface && paintRgb(surface, defaultSurface)) || defaultSurface;

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
 * stylesheet in `<head>`, that applies a persisted `{ mode, accent, surface }` theme before first
 * paint. Missing and malformed records use the runtime's automatic/no-accent default.
 * The serialized options escape HTML script terminators and JavaScript line separators.
 * Pass an application-owned `storageKey` to reuse the no-flash bootstrap independently of this
 * module's `setLyraTheme()`/`getLyraTheme()` persistence key.
 *
 * The returned value is deliberately a plain string (not a function) so it can be inlined without
 * shipping or parsing this whole module in an unbundled `<script>` context.
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
 */
export const lyraThemeBootstrap = createLyraThemeBootstrap();
