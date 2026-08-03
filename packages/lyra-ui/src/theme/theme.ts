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
  /** The localStorage key holding a `{ mode, accent }` theme record. */
  storageKey?: string;
}

/**
 * Theme selection mode. `'light'` and `'dark'` are explicit overrides. `'auto'` resolves and
 * continues following `prefers-color-scheme`; `'unset'` removes Lyra's mode attributes so an
 * application-owned cascade can decide instead.
 */
export type LyraThemeMode = 'light' | 'dark' | 'auto' | 'unset';

/** Persisted theme selection and optional brand accent. */
export interface LyraTheme {
  /** Requested selection mode; `auto` remains distinct from its resolved light/dark value. */
  mode: LyraThemeMode;
  /** Absolute CSS brand color, or `null` to use the active stylesheet palette. */
  accent: string | null;
}

/** Snapshot carried by the global `lr-theme-change` event. */
export type LyraThemeChangeDetail = Readonly<LyraTheme>;

declare global {
  interface WindowEventMap {
    'lr-theme-change': CustomEvent<LyraThemeChangeDetail>;
  }
}

const DEFAULT_THEME: Readonly<LyraTheme> = Object.freeze({ mode: 'auto', accent: null });

type ResolvedThemeMode = 'light' | 'dark';
type Rgb = readonly [red: number, green: number, blue: number];

const COLOR_SCHEME_QUERY = '(prefers-color-scheme: dark)';
const BRAND_RAMP_PROPERTIES = [
  '--lr-theme-color-brand-fill-quiet',
  '--lr-theme-color-brand-fill-normal',
  '--lr-theme-color-brand-fill-loud',
  '--lr-theme-color-brand-border-quiet',
  '--lr-theme-color-brand-border-normal',
  '--lr-theme-color-brand-border-loud',
  '--lr-theme-color-brand-on-quiet',
  '--lr-theme-color-brand-on-normal',
  '--lr-theme-color-brand-on-loud',
  '--lr-theme-color-focus',
] as const;

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

function normalizeAccent(value: unknown): string | null {
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

function createAccentRamp(accent: string, mode: ResolvedThemeMode): Record<string, string> | null {
  const background: Rgb = mode === 'dark' ? [26, 26, 26] : [255, 255, 255];
  const resolvedAccent = parseResolvedRgb(accent, background);
  if (!resolvedAccent) return null;
  const quiet = mixRgb(background, resolvedAccent, mode === 'dark' ? 0.24 : 0.14);
  const normal = mixRgb(background, resolvedAccent, mode === 'dark' ? 0.62 : 0.55);
  const loud = resolvedAccent;
  const borderTarget: Rgb = mode === 'dark' ? [255, 255, 255] : [0, 0, 0];
  const borderQuiet = mixRgb(background, resolvedAccent, mode === 'dark' ? 0.46 : 0.38);
  const borderNormal = ensureSurfaceContrast(
    mixRgb(background, resolvedAccent, mode === 'dark' ? 0.78 : 0.72),
    background,
  );
  const borderLoud = ensureSurfaceContrast(mixRgb(resolvedAccent, borderTarget, 0.2), background);
  return {
    '--lr-theme-color-brand-fill-quiet': serializeRgb(quiet),
    '--lr-theme-color-brand-fill-normal': serializeRgb(normal),
    '--lr-theme-color-brand-fill-loud': serializeRgb(loud),
    '--lr-theme-color-brand-border-quiet': serializeRgb(borderQuiet),
    '--lr-theme-color-brand-border-normal': serializeRgb(borderNormal),
    '--lr-theme-color-brand-border-loud': serializeRgb(borderLoud),
    '--lr-theme-color-brand-on-quiet': serializeRgb(contrastForeground(quiet)),
    '--lr-theme-color-brand-on-normal': serializeRgb(contrastForeground(normal)),
    '--lr-theme-color-brand-on-loud': serializeRgb(contrastForeground(loud)),
    '--lr-theme-color-focus': serializeRgb(ensureSurfaceContrast(resolvedAccent, background)),
  };
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

function writeAccent(accent: string | null, mode: ResolvedThemeMode | null): string | null {
  const rootStyle = document.documentElement.style;
  for (const property of BRAND_RAMP_PROPERTIES) rootStyle.removeProperty(property);
  if (!accent) {
    rootStyle.removeProperty('--lr-theme-accent');
    return null;
  }
  if (!mode) {
    rootStyle.removeProperty('--lr-theme-accent');
    return accent;
  }
  const ramp = createAccentRamp(accent, mode);
  if (!ramp) {
    rootStyle.removeProperty('--lr-theme-accent');
    return null;
  }
  rootStyle.setProperty('--lr-theme-accent', accent);
  for (const [property, value] of Object.entries(ramp)) rootStyle.setProperty(property, value);
  return accent;
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
  const accent = writeAccent(theme.accent, resolvedMode);
  lastApplied = { ...theme, accent };
  writeResolvedMode(resolvedMode);

  if (theme.mode !== 'auto') return;
  autoMediaQuery = matchMedia(COLOR_SCHEME_QUERY);
  autoMediaListener = (event) => {
    resolvedMode = event.matches ? 'dark' : 'light';
    writeResolvedMode(resolvedMode);
    writeAccent(lastApplied.accent, resolvedMode);
    window.dispatchEvent(new CustomEvent('lr-theme-change', { detail: { ...lastApplied } }));
  };
  if (typeof autoMediaQuery.addEventListener === 'function') {
    autoMediaQuery.addEventListener('change', autoMediaListener);
  } else {
    autoMediaQuery.addListener(autoMediaListener);
  }
}

/**
 * Sets the persisted theme mode/accent, applies it to `document.documentElement` (via
 * `data-lr-theme`/`data-theme` and a complete `--lr-theme-color-brand-*` ramp), and dispatches
 * `lr-theme-change` on `window` with `detail: { mode, accent }`. Unspecified fields keep their
 * current value. Never throws -- a `localStorage` failure (private browsing, quota, sandboxed
 * iframe) degrades to apply-without-persist, and unspecified fields still keep their value across
 * calls in that state, because the merge falls back to the last applied theme rather than to the
 * default. Accent values must be absolute CSS colors; malformed, CSS-wide, relative, and
 * unresolved `var()` values fail closed to `null`. Each generated fill receives a black or white
 * foreground with at least 4.5:1 contrast; normal/loud borders and the focus color have at least
 * 3:1 contrast against the shipped light/dark surface defaults.
 */
export function setLyraTheme(theme: Partial<LyraTheme>): void {
  // A direct mode/accent edit is no longer exactly the named preset that may have produced the
  // previous state. applyLyraThemePreset() writes its marker back after this call completes.
  document.documentElement.removeAttribute('data-lr-theme-preset');
  const current = readStoredTheme();
  const next: LyraTheme = {
    mode: theme.mode === undefined
      ? current.mode
      : isThemeMode(theme.mode)
        ? theme.mode
        : 'auto',
    accent: theme.accent === undefined ? current.accent : normalizeAccent(theme.accent),
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
  // applyTheme can fail a computed color closed even after the syntax-level check above.
  const applied = lastApplied;
  if (applied.accent !== next.accent) {
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
 * Reads the current theme mode/accent, defaulting to `{ mode: 'auto', accent: null }` when
 * nothing has been set or the stored value is malformed. Storage is re-read on every call --
 * there is no in-memory cache -- so a value written by another tab or a previous session is
 * picked up cold.
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
    let theme: { mode?: unknown; accent?: unknown } = {};
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as unknown;
        if (parsed && typeof parsed === 'object') {
          theme = parsed as { mode?: unknown; accent?: unknown };
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
    const properties = [
      '--lr-theme-color-brand-fill-quiet',
      '--lr-theme-color-brand-fill-normal',
      '--lr-theme-color-brand-fill-loud',
      '--lr-theme-color-brand-border-quiet',
      '--lr-theme-color-brand-border-normal',
      '--lr-theme-color-brand-border-loud',
      '--lr-theme-color-brand-on-quiet',
      '--lr-theme-color-brand-on-normal',
      '--lr-theme-color-brand-on-loud',
      '--lr-theme-color-focus',
    ];
    for (const property of properties) style.removeProperty(property);
    const accent = typeof theme.accent === 'string' ? theme.accent.trim() : '';
    const unsupportedAccent = /^(?:inherit|initial|revert(?:-layer)?|unset)$/i.test(accent)
      || /^(?:accentcolor|accentcolortext|activetext|buttonborder|buttonface|buttontext|canvas|canvastext|field|fieldtext|graytext|highlight|highlighttext|linktext|mark|marktext|selecteditem|selecteditemtext|visitedtext)$/i.test(accent)
      || /\bcurrentcolor\b/i.test(accent)
      || /\bvar\s*\(/i.test(accent)
      || /\blight-dark\s*\(/i.test(accent)
      || /\b(?:rgb|rgba|hsl|hsla|hwb|lab|lch|oklab|oklch|color)\s*\(\s*from\b/i.test(accent);
    if (!accent || !resolvedMode || unsupportedAccent) {
      style.removeProperty('--lr-theme-accent');
      return;
    }
    const syntaxProbe = document.createElement('span');
    syntaxProbe.style.color = accent;
    if (!syntaxProbe.style.color) {
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
    context.clearRect(0, 0, 1, 1);
    context.fillStyle = accent;
    context.fillRect(0, 0, 1, 1);
    const channels = [...context.getImageData(0, 0, 1, 1).data];
    const background = resolvedMode === 'dark' ? [26, 26, 26] : [255, 255, 255];
    const alpha = (channels[3] ?? 0) / 255;
    const color = channels.slice(0, 3).map((channel, index) =>
      Math.round(channel * alpha + (background[index] ?? 0) * (1 - alpha)),
    );
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
    const quiet = mix(background, color, resolvedMode === 'dark' ? 0.24 : 0.14);
    const normal = mix(background, color, resolvedMode === 'dark' ? 0.62 : 0.55);
    const borderTarget = resolvedMode === 'dark' ? white : black;
    const ensureContrast = (value: number[]) => {
      if (contrast(value, background) >= 3) return value;
      const target = contrast(background, black) >= contrast(background, white) ? black : white;
      for (let step = 1; step <= 10; step += 1) {
        const candidate = mix(value, target, step / 10);
        if (contrast(candidate, background) >= 3) return candidate;
      }
      return target;
    };
    const borderNormal = ensureContrast(
      mix(background, color, resolvedMode === 'dark' ? 0.78 : 0.72),
    );
    const borderLoud = ensureContrast(mix(color, borderTarget, 0.2));
    const rgb = (value: number[]) => `rgb(${value.join(' ')})`;
    const ramp: Record<string, number[]> = {
      '--lr-theme-color-brand-fill-quiet': quiet,
      '--lr-theme-color-brand-fill-normal': normal,
      '--lr-theme-color-brand-fill-loud': color,
      '--lr-theme-color-brand-border-quiet': mix(background, color, resolvedMode === 'dark' ? 0.46 : 0.38),
      '--lr-theme-color-brand-border-normal': borderNormal,
      '--lr-theme-color-brand-border-loud': borderLoud,
      '--lr-theme-color-brand-on-quiet': on(quiet),
      '--lr-theme-color-brand-on-normal': on(normal),
      '--lr-theme-color-brand-on-loud': on(color),
      '--lr-theme-color-focus': ensureContrast(color),
    };
    style.setProperty('--lr-theme-accent', accent);
    for (const [property, value] of Object.entries(ramp)) style.setProperty(property, rgb(value));
  } catch {
    // A no-flash bootstrap must never block the rest of the document head.
  }
}

function serializeInlineScriptData(value: string | readonly string[]): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

/**
 * Creates a self-contained IIFE body, safe to inline into a `<script>` tag placed before any
 * stylesheet in `<head>`, that applies a persisted `{ mode, accent }` theme before first paint.
 * Missing and malformed records use the runtime's automatic/no-accent default.
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
