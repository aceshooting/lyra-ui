# Internationalization (i18n), RTL, and theming — lyra-ui agent reference

> Detail behind the "i18n, RTL, and theming" digest in [AGENTS.md](../../AGENTS.md).

Three guarantees baked into every component: any user-facing string can be translated, layout
doesn't break under a right-to-left language, and the whole visual surface rethemes through design
tokens. They are cross-cutting — verified across every component, not opt-in per component — so
treat a gap in any of them as a bug, not a missing feature.

## i18n — `this.localize(key, fallback, values)`

- Every user-facing string — visible text, `aria-label`/`aria-description`, `title`,
  `placeholder`, `alt` — routes through `this.localize()` (`LyraElement`, backed by
  `src/internal/localization.ts`). Never hard-code an English UI string in a template. Exception:
  inherently caller-supplied data (file names, arbitrary API/user text, `Intl`-formatted
  numbers/dates) isn't an i18n concern — don't route data through `localize()`, only the
  library's own copy.
- Message keys live in `localization.ts`'s `LyraMessageKey` union + `DEFAULT_STRINGS`. **Reuse an
  existing key before adding a new one** (grep `DEFAULT_STRINGS` first), but don't force a reuse
  where the wording genuinely differs — a component-name-prefixed key (e.g. `dockPanelResize`,
  `chartTrendIncreasing`) beats bending an unrelated generic key like `noData` to a different
  literal string; the fallback text must still match whatever `DEFAULT_STRINGS` says for that key
  (next bullet).
- **Never pass a literal, unconditional fallback string as the 2nd argument once the key already
  has a `DEFAULT_STRINGS` entry.** `resolveLyraString()` resolves `this.strings` overrides, then
  a *defined* `fallback` argument, and only checks `registerLyraLocale()`-registered translations
  when both are `undefined` — so `this.localize('close', 'Close')` renders fine in English while
  silently defeating translation for that call site forever. Call it bare:
  `this.localize('close')`. The one legitimate fallback is *conditionally* derived from a public
  property a consumer might have explicitly customized away from its built-in default, so an
  explicit override still wins verbatim while the unmodified case resolves through the registry:
  `this.localize('previousMonth', this.previousLabel === 'Previous month' ? undefined : this.previousLabel)`.
  Passing `this.someProp` unconditionally has the same bug as a literal — it always
  short-circuits the registry unless the prop happens to be empty/`undefined`. This is the single
  easiest-to-introduce regression in the library. `scripts/check-source-policy.mjs` greps for the
  `this.localize('key', 'literal'` shape and fails on it, but it's a pattern-matcher, not a
  semantic check — a fallback that *looks* conditional but is actually unconditional (e.g.
  `this.someProp` passed straight through), or any variant the grep can't see, still slips past.
  Check each `localize()` call site by hand rather than assuming the gate caught it.
- **Never render a caught error's raw `.message` verbatim in a `role="alert"`/`role="status"`
  region.** A native exception's message is untranslated and engine-dependent — a `JSON.parse()`
  `SyntaxError` reads completely differently across V8, SpiderMonkey, and JavaScriptCore. Show
  only a `this.localize()`-derived message; the raw error belongs in the event `detail` payload.
  The one exception is `LyraUserFacingError` (`src/internal/resource-loader.ts`), itself
  constructed from a `localize()` call, so
  `error instanceof LyraUserFacingError ? error.message : this.localize(...)` is the established
  pattern — every document viewer already uses it; copy it.
- Interpolate via the 3rd `values` argument with `{placeholder}` syntax matching the
  `DEFAULT_STRINGS` template, e.g. `this.localize('showMoreCount', undefined, { count })` for
  `'Show {count} more'` — never string-concatenate translated text with data.
- **Every `Intl.*` formatter call passes `this.effectiveLocale`** (or a value derived from it) as
  its locale argument. That covers every
  `Intl.DateTimeFormat`/`NumberFormat`/`DisplayNames`/`RelativeTimeFormat` instance — obtained
  via the shared `getDateTimeFormat`/`getNumberFormat`/`getDisplayNames`/`getRelativeTimeFormat`
  caches in `src/internal/intl-cache.ts`, or a `Date.prototype.toLocaleString`-family call —
  never a hardcoded literal tag (e.g. `'en'`) and never an unconditional bare `undefined`, which
  silently falls back to the runtime/OS default instead of the page's resolved Lyra locale.
  Second-most independently rediscovered defect shape in this library's history; no automated
  gate checks it (`check-source-policy.mjs`'s `intl-outside-cache` rule only catches a formatter
  constructed outside the shared cache, not a wrong locale value passed into it) — review by
  hand.
- Test convention: at minimum, one test proves the built-in English fallback renders unchanged
  with no locale registered; for any component whose behavior depends on a key showing up
  correctly, add a `.strings` override test (e.g. `.strings=${{ someKey: 'Texte' }}`) proving the
  string actually reaches the DOM — a key existing in the union doesn't prove the call site is
  wired up correctly.

## RTL — logical properties, not a forced `dir`

- Components never set their own `dir` attribute. Direction is inherited from the nearest
  ancestor `dir`/`lang` (or computed style) via `resolveLyraDirection()` /
  `this.effectiveDirection` (`'ltr' | 'rtl'`).
- Prefer CSS logical properties over physical ones in every stylesheet:
  `inset-inline-start`/`-end` (not `left`/`right`), `margin-inline-*`, `padding-inline-*`,
  `border-inline-start`/`-end`, `text-align: start`/`end`. Logical properties auto-mirror under
  `dir="rtl"` with zero JS; physical ones silently don't. `:host(:dir(rtl))` is the escape hatch
  for the rare genuinely-needed explicit override (e.g. flipping a directional chevron's
  rotation).
- Keyboard navigation treating `ArrowLeft`/`ArrowRight` as "previous"/"next" (day-grids,
  roving-tabindex column nav, carousel-style controls) must consult `this.effectiveDirection` and
  swap which arrow means which under RTL — a plain `ArrowLeft === previous` hardcode is an RTL
  bug, not just an LTR-only shortcut. The single most common RTL miss in this library's own
  standardization pass (graph, heatmap, word-cloud roving-focus nav).
- A directional glyph (chevron/arrow meaning "expand toward", "previous", "next") must mirror
  under RTL: rotate the wrapping `part` element via
  `:host(:dir(rtl)) [part='x'] { transform: ... }` rather than baking a fixed rotation into the
  icon itself.

## Theming — design tokens only

See "Design tokens only" in [coding-conventions.md](coding-conventions.md) — every component value
references a centralized `--lr-*` property. Themeable base tokens bridge to `--lr-theme-*` with a
built-in fallback; aliases, computed/ramp tokens, environment values, and fixed contract constants
can resolve within the internal layer instead. This also makes i18n and RTL "just work" visually:
token-driven spacing and sizing hardcode no text direction or font width, so longer/shorter
translated strings and mirrored RTL layouts reflow correctly without component-specific
overrides.

### The dark palette has three parallel routes — keep all of them in sync

`src/internal/tokens/palette.styles.ts` declares each dark-mode value **three times**, once per
activation route: `:host([data-lr-theme='dark'])`, a `:host(...):host-context([data-lr-theme='dark'])`
pair, and `@media (prefers-color-scheme: dark)`. They carry identical values today, and they must
stay that way.

The trap is that **`:host-context(X)` matches when the host *itself* matches `X`**, not only when an
ancestor does. So for `<lr-badge data-lr-theme="dark">` in Chromium the winning declaration is the
`:host-context` block — later in the sheet *and* more specific — not the plain attribute block.
Firefox and WebKit do not implement `:host-context()` at all, so there the attribute block governs.

Consequence: **a defect introduced into only one of the two blocks is invisible in one engine.**
Verified empirically (2026-08-12) while tracing the badge/callout quiet-tier chain — injecting a
light-mode literal into just one block left the tests green in the other engine; both had to be
corrupted before a Chromium test went red. When you touch that file, change every route, and when
you write a dark-mode regression test remember that passing locally on one engine proves less than
it looks. `check:palette-freshness` covers generation, not cross-route agreement.

A related reading aid: the quiet-tier chain is *fully* token-driven end to end
(`badge.styles.ts` → `--lr-color-fill-quiet` → `internal/variants.styles.ts` →
`internal/tokens/palette.styles.ts`). The only literals in it are the OKLCH ramp steps themselves,
which are mode-independent by design — dark mode changes *which* ramp step a slot points at
(`--lr-ramp-warning-95` → `--lr-ramp-warning-30`), never the step's own value. `tokens.styles.ts`
only aliases `--lr-color-<variant>-quiet` onto that grid; the grid itself lives in
`tokens/palette.styles.ts`. A `var()` chain bottoming out in a second `var()` (e.g. `lr-callout`'s
`var(--lr-color-fill-quiet, var(--lr-color-brand-fill-quiet))` fallback arm) is not a hardcoded
literal — read the whole chain before filing one as a bug.
