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
  `this.localize('close')`. Passing `this.someProp` unconditionally has the same bug as a literal —
  it always short-circuits the registry unless the prop happens to be `undefined`, and it gives
  `.strings` priority over a defined property override. Resolve public copy properties before
  calling `localize()` as described in the next bullet. This is the easiest regression to introduce. `scripts/check-source-policy.mjs` greps for the
  `this.localize('key', 'literal'` shape and fails on it, but it's a pattern-matcher, not a
  semantic check — a fallback that *looks* conditional but is actually unconditional (e.g.
  `this.someProp` passed straight through), or any variant the grep can't see, still slips past.
  Check each `localize()` call site by hand rather than assuming the gate caught it.
- **A public copy override is optional, not an English sentinel or an empty-string sentinel.**
  Declare it as `label?: string`, then resolve it with
  `this.label == null ? this.localize('messageKey') : this.label` (the `null` arm covers removal of
  the reflected string attribute at runtime). This preserves all three
  observable states: omission enters localization, an explicitly supplied built-in English value
  remains the caller's literal even when `.strings` is non-English, and an explicit empty string
  stays empty. A default such as `label = 'Close'` cannot distinguish omission from a caller that
  deliberately wrote `label="Close"`; `this.label || undefined` likewise destroys the distinction
  between omission and `label=""`. Do not pass a defined override through `localize()` because
  per-instance `.strings` is intentionally checked first there; bypass localization once the copy
  property is present. If the override is a message template, interpolate its documented
  placeholders after this branch, just as the localized path does.
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
  No automated
  gate checks it (`check-source-policy.mjs`'s `intl-outside-cache` rule only catches a formatter
  constructed outside the shared cache, not a wrong locale value passed into it) — review by
  hand.
- Test convention: at minimum, one test proves the built-in English fallback renders unchanged
  with no locale registered; for any component whose behavior depends on a key showing up
  correctly, add a `.strings` override test (e.g. `.strings=${{ someKey: 'Texte' }}`) proving the
  string actually reaches the DOM — a key existing in the union doesn't prove the call site is
  wired up correctly.

## Pinned plural-category requirements

`packages/lyra-ui/scripts/fixtures/cldr-plural-categories.json` records the catalog qualification
categories captured with Node 22.23.2, ICU 78.2, CLDR 48.0 and Unicode 17.0. The translation
checker and scaffold read this snapshot instead of deriving requirements from an arbitrary host's
ICU. Normal generators never rewrite it, and a locale missing from the pin fails closed.

To add a locale, use the exact contributor runtime (`nvm use`) and the exported
`capturePluralCategoryPin([...Object.keys(pin.locales), newTag])` helper in
`scripts/cldr-plural-categories.mjs`. Inspect the candidate's version/provenance and category diff,
run `validatePluralCategoryPin(candidate)`, and save the fixture only after review. Changing an
existing category set also requires checking every affected plural message; it is not an automatic
consequence of upgrading Node. Runtime message selection still uses the browser's `Intl` and its
documented fallback behavior.

Authored tags `tl` and `pnb` canonicalize to `fil` and `lah`. ICU 78.2 does not support `lah` plural
rules, so that entry explicitly records the existing `en-US` fallback categories `one`/`other` in
`runtimeFallbacks.lah`. This preserves the current runtime contract and does not certify Western
Punjabi or Lahnda grammar. Do not generalize that exception to another unsupported locale or
advertise either canonical alias as an additional translated catalog.

Author Portuguese (Portugal) differences in `scripts/fixtures/pt-PT-overrides.ts`, against the
complete `pt-BR` catalog. The translation slice generator resolves those differences into full,
standalone `src/translations/pt-PT/<family>.ts` modules. Edit the override fixture rather than the
generated `pt-PT` slices. A consumer importing one `pt-PT` family never imports `pt-BR`; the
translation checker compares the emitted messages with the authored base and overrides, while
review snapshots still cover the complete resolved Portuguese (Portugal) catalog.

## Catalog review tiers and native-speaker review

Author review evidence in `scripts/fixtures/translation-reviews/locales/<source-locale>.json`
in the library package. The shared `index.json` owns the English source snapshot, upstream
provenance, release groups and ordered source locale IDs. Keep the authored IDs `tl` and `pnb`;
their canonical loader identities remain `fil` and `lah`. The existing
`scripts/fixtures/translation-reviews.json` is a generated aggregate; never edit it directly.
Its schema version 2 separates structural coverage from linguistic evidence and records `reviewTier` as
`ai-assisted`, `independent-human`, or `native-speaker`; `reviewer.status` remains a separate
approval state. Current AI-assisted catalog reviews must stay labeled AI-assisted, even when
approved. Never infer human or native-speaker review from complete keys, an English-identical
allowlist, a translated language name, or a contributor's form submission.

Volunteers can open the repository's **Translation review** issue form. It asks for the exact
locale/script/register, a public reviewer handle, reviewed commit and catalog hash, review scope,
and evidence covering meaning, terminology, plural counts, placeholders, accessible labels and
mixed-direction text. It accepts native-speaker and fluent-human offers without treating either
as completed approval. Do not request private contact information or a legal identity.

A maintainer validates the stated review scope and evidence before updating the ledger. A human
review tier requires an approved review with a date, public `reviewer.identity`, an HTTPS
`reviewer.evidenceUrl` pointing to the accepted review record, and `reviewer.catalogSha256`
matching the current catalog snapshot. A native-speaker tier additionally represents an actual
native-speaker review of that locale and written register, not merely linguistic fluency or AI
assistance. Record the reviewer-confirmed scope in `reviewer.evidence`; the intake issue alone is
not evidence of completion. Catalog edits invalidate an old human-review hash until reviewed
again. Do not update that hash mechanically or fabricate reviewers to pass a gate.

After review metadata changes, run `pnpm --filter @aceshooting/lyra-ui translation-review-fixture`,
then `test:translation-review-source`, `test:translation-reviews` and `check:translations` with
the same package filter. Regeneration assembles the recorded evidence; it must not approve a
review or update its hash automatically. The generated locale manifest reports coverage and review tier/status
separately; fallback messages must never be counted as translated coverage. The pinned CLDR
category fixture defines structural requirements without claiming linguistic quality.

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
  For list-like controls, use `resolveListMove()` from `internal/list-navigation.ts` with the
  host's `effectiveDirection`; each component still owns its focus and selection side effects.
  Shared typeahead uses `TypeAheadBuffer`, including its composition guard and circular matcher.
- A directional glyph (chevron/arrow meaning "expand toward", "previous", "next") must mirror
  under RTL: rotate the wrapping `part` element via
  `:host(:dir(rtl)) [part='x'] { transform: ... }` rather than baking a fixed rotation into the
  icon itself.

## Theming — design tokens only

The token rules are under "Design tokens only" in [coding-conventions.md](coding-conventions.md).
Token-driven spacing and sizing hardcode no text direction or font width, so longer or shorter
translations and mirrored RTL layouts reflow without component-specific overrides.

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
A literal injected into just one block leaves tests green in the other engine. When you touch that file, change every route, and when
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
