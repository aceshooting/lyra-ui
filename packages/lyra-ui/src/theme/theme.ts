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
 * The three theme modes. `'light'`/`'dark'` are explicit overrides written to the root element.
 * `'auto'` means **no override** -- both mode attributes are removed -- which is not the same as
 * "follow the OS":
 *
 * - With `theme.css` imported, its `:root` block sets the full light palette unconditionally and
 *   the file ships no `prefers-color-scheme` block, so `'auto'` renders **light** regardless of
 *   the OS setting.
 * - Without `theme.css`, no real `--lr-theme-*` value is set, so the token layer's
 *   `prefers-color-scheme: dark` fallback (`src/internal/tokens.styles.ts`) applies and bare
 *   components do follow the OS.
 *
 * To follow the OS *alongside* `theme.css`, resolve the preference in the app
 * (`matchMedia('(prefers-color-scheme: dark)')`) and call `setLyraTheme` with a concrete mode.
 */
export type LyraThemeMode = 'light' | 'dark' | 'auto';

export interface LyraTheme {
  mode: LyraThemeMode;
  accent: string | null;
}

const DEFAULT_THEME: LyraTheme = { mode: 'auto', accent: null };

/**
 * The last theme this module applied. `localStorage` is the source of truth whenever it is
 * readable *and* writable; this is the fallback for the contexts where it is not (sandboxed
 * iframe, blocked third-party storage, private browsing, quota exhaustion). Without it every
 * `setLyraTheme` call would merge over `DEFAULT_THEME` and silently reset fields an earlier call
 * set -- breaking the documented "degrades to apply-without-persist" guarantee across two calls --
 * and `getLyraTheme()` would report a state the document does not actually have, so a toggle UI
 * bound to it would render the wrong position.
 */
let lastApplied: LyraTheme = DEFAULT_THEME;

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

function readStoredTheme(): LyraTheme {
  // Storage cannot be trusted to hold what we applied -- honour the session's own state instead.
  if (persistenceFailed) return lastApplied;

  let raw: string | null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    // Storage is unreachable (sandboxed iframe, blocked third-party storage, private browsing).
    // What this module last applied is a truer answer than the default.
    return lastApplied;
  }

  // Reachable storage with nothing in it is a genuine "unset" -- distinct from the cases above,
  // and the one case where the default really is correct.
  if (!raw) return DEFAULT_THEME;

  try {
    const parsed = JSON.parse(raw) as Partial<LyraTheme>;
    return {
      mode:
        parsed.mode === 'light' || parsed.mode === 'dark' || parsed.mode === 'auto'
          ? parsed.mode
          : 'auto',
      accent: typeof parsed.accent === 'string' && parsed.accent ? parsed.accent : null,
    };
  } catch {
    // Readable storage holding garbage (another tool wrote the key, a truncated write): also a
    // genuine "nothing valid stored", so the default applies rather than `lastApplied`.
    return DEFAULT_THEME;
  }
}

function applyTheme(theme: LyraTheme): void {
  lastApplied = theme;
  const root = document.documentElement;
  for (const attribute of MODE_ATTRIBUTES) {
    if (theme.mode === 'auto') root.removeAttribute(attribute);
    else root.setAttribute(attribute, theme.mode);
  }
  if (theme.accent) root.style.setProperty('--lr-theme-accent', theme.accent);
  else root.style.removeProperty('--lr-theme-accent');
}

/**
 * Sets the persisted theme mode/accent, applies it to `document.documentElement` (via
 * `data-lr-theme`/`data-theme` and the `--lr-theme-accent` custom property), and dispatches
 * `lr-theme-change` on `window` with `detail: { mode, accent }`. Unspecified fields keep their
 * current value. Never throws -- a `localStorage` failure (private browsing, quota, sandboxed
 * iframe) degrades to apply-without-persist, and unspecified fields still keep their value across
 * calls in that state, because the merge falls back to the last applied theme rather than to the
 * default. This module intentionally has zero dependencies and
 * does not compute or validate color contrast -- see `llms/shared.md`'s "Theming and design
 * tokens" section for the `--lr-theme-*` convention this integrates with.
 */
export function setLyraTheme(theme: Partial<LyraTheme>): void {
  const current = readStoredTheme();
  const next: LyraTheme = {
    mode: theme.mode ?? current.mode,
    accent: theme.accent === undefined ? current.accent : (theme.accent ?? null),
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
  window.dispatchEvent(new CustomEvent('lr-theme-change', { detail: next }));
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

/**
 * Creates a self-contained IIFE body, safe to inline into a `<script>` tag placed before any
 * stylesheet in `<head>`, that applies a persisted `{ mode, accent }` theme before first paint.
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
  return `(function(){try{var raw=localStorage.getItem(${JSON.stringify(storageKey)});if(!raw)return;var t=JSON.parse(raw);if(t.mode==='light'||t.mode==='dark'){${MODE_ATTRIBUTES.map(
    (attribute) => `document.documentElement.setAttribute(${JSON.stringify(attribute)},t.mode);`,
  ).join('')}}if(typeof t.accent==='string'&&t.accent){document.documentElement.style.setProperty('--lr-theme-accent',t.accent);}}catch(e){}})();`;
}

/**
 * The default-key no-flash bootstrap. Equivalent to `createLyraThemeBootstrap()` and retained for
 * consumers that store their theme under `localStorage['lyra-theme']`.
 */
export const lyraThemeBootstrap = createLyraThemeBootstrap();
