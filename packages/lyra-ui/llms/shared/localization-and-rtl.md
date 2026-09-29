# Localization and RTL

## Localization: `locale`, `strings`, and the locale runtime

Every built-in string — button labels, accessible names, descriptions, validation messages, status
announcements, empty/loading states — resolves through the locale runtime. Consumer data and slotted
content are never translated.

Two knobs exist on **every** `lr-*` element, inherited from `LyraElement` and therefore not repeated
in the per-component sections:

- **`locale: string = ''`** (reflected attribute) — per-instance locale override. Empty means "use
  the nearest `locale`/`lang` ancestor".
- **`strings: LyraLocaleStrings = {}`** (property only, no attribute) — per-instance message
  overrides, merged over the registered catalog. Assignment takes an immutable snapshot of up to
  4,096 own enumerable data properties. Mutating the assigned object later has no effect; assign a
  new object to update it. Accessors and malformed entries are ignored per key without being run.

```ts
import {
  registerLyraLocale,
  setLyraLocale,
} from "@aceshooting/lyra-ui/localization.js";

registerLyraLocale("fr", { close: "Fermer", retry: "Réessayer" }); // app-wide, partial catalogs fine
setLyraLocale("fr"); // page-level selection; see the precedence order below
```

```html
<lr-toast></lr-toast>
<script type="module">
  document.querySelector("lr-toast").strings = { close: "Fermer" };
</script>
```

**Which locale a component ends up using.** Four sources, first answer wins:

1. **The component's own `locale`, then its own `lang`.**
2. **The nearest ancestor declaring `locale` or `lang`** (crossing shadow boundaries), except that
   `lang` on `<html>` is not read here — see 4. A `locale` attribute on `<html>` _is_, since that
   attribute is this library's own and can only be a deliberate opt-in.
3. **`setLyraLocale(tag)`**, the page-level selection.
4. **`<html lang>`**, the document default.
5. **`'en'`.**

An explicit `setLyraLocale()` selection takes precedence over `<html lang>`. Clear it with
`setLyraLocale('')` to let the document language apply again. A per-subtree `lang`/`locale`
override takes precedence over either page-level choice.

To keep `<html lang>`/`dir` in step with `setLyraLocale()` — which everything _outside_ this library
reads, from `:lang()` rules to spellcheck to a screen reader's pronunciation — use
`bridgeLyraLocale()` from `@aceshooting/lyra-ui/localization.js` (see
[Shared helpers](./testing-and-utilities.md#shared-helpers-utilities)).

The side-effect-free `@aceshooting/lyra-ui/localization.js` entry exports
`registerLyraLocale`, `registerLyraLocaleDelta`, `setLyraLocale`, `getLyraLocale`, `getLyraLocaleDirection`,
`getRegisteredLyraLocales`, `getRegisteredLyraLocaleKeys`, `subscribeLyraLocaleRegistry`,
`subscribeLyraLocale`, `bridgeLyraLocale`, `resolveLyraLocale`, `resolveLyraDirection`,
`resolveLyraString`, `resolveLyraScopedString`, `LYRA_DEFAULT_STRINGS`, and the types
`LyraLocaleStrings`, `LyraLocaleMeta`, `LyraLocaleDirection`, `LyraMessageKey`, `LyraMessage`,
`LyraPluralMessage`, `LyraPluralCategory`, `LyraLocaleBridgeOptions` and `LyraLocaleBridgeCleanup`.
The package root continues to re-export the runtime for compatibility and remains registration-free;
use the dedicated entry when the application only needs locale setup and the narrower import graph.
The `@aceshooting/lyra-ui/utilities/localization.js` entry point is deprecated, with removal not
before 23.0.0: every name it exports is exported here as the identical binding, so change the import
specifier to `@aceshooting/lyra-ui/localization.js` and nothing else.
**`LYRA_DEFAULT_STRINGS` is the authoritative key list** (matching the `LyraMessageKey` union) —
read it to find the key to override rather than guessing one. Date, number, byte, relative-time and
calendar output goes through `Intl`.

**Locale-tag identity.** Registration, active selection, `getLyraLocale()`, registry enumeration,
component resolution and `bridgeLyraLocale()` all use the same public spelling. `_` remains an input
alias, and structurally valid BCP-47 tags go through the platform canonicalizer, so `PT_BR` becomes
`pt-BR` and deprecated aliases collapse onto their current tag. Private-use-only and short legacy
application tags that the platform canonicalizer rejects remain supported as bounded lowercase
identities. `registerLyraLocale()` and `setLyraLocale()` reject values that are neither valid BCP-47
nor bounded alphanumeric custom tags; an inherited invalid over-complex `locale`/`lang` safely
resolves to English. Structurally valid long BCP-47 tags remain accepted.

**Regional delta catalogs.** `registerLyraLocaleDelta(locale, parent, strings, meta?)` registers
only the regional wording that differs from an explicit parent catalog. Parent messages and
writing direction remain live references: loading or extending the parent later updates dependent
components. Ordinary `registerLyraLocale()` calls can extend the delta without discarding its
parent. Self-references, cycles and parent chains beyond 32 edges reject before changing the outer
registration. Delta catalogs do not become reverse fallbacks for another tag sharing the language.
The existing complete built-in regional catalogs retain their original messages.

```js
import { registerLyraLocale, registerLyraLocaleDelta } from "@aceshooting/lyra-ui/localization.js";
registerLyraLocale("en", { workspaceName: "Workspace" });
registerLyraLocaleDelta("en-GB", "en", { workspaceName: "Project workspace" });
```

This example supplies an application-owned message, not a claim that a complete `en-GB` catalog
ships with Lyra. A delta's own registered-key list reports only its own authored keys.

**Optional lazy loading.** `loadLyraLocale(tag)` from `@aceshooting/lyra-ui/locale-loader.js`
loads one complete built-in catalog without selecting the page locale. Tags that canonicalize to
the same shipped catalog identity share one in-flight/completed import; failure permits retry. `en`
resolves without an import. A tag with no exact shipped identity, such as an unshipped regional
variant, rejects instead of quietly loading another language. The optional loader is outside the
default component and localization graphs. Assign it to `lr-locale-picker.localeLoader` with an
explicit offered locale list to use the picker's loading, failure/retry and stale-selection
protection; see the forms guide.

**Lookup order for a tag.** Every message resolves through one chain, and `Intl.PluralRules`
category selection walks the same chain, so the two can never disagree:

1. **The BCP-47 truncation walk, most specific first**, with any explicitly registered delta parent chain inserted immediately after its child — `zh-Hans-CN` → `zh-Hans` → `zh`.
   Casing and `_` separators are normalized, so `pt_BR` and `pt-br` are the same key. Lookup chains
   are memoized and capped at 64 candidates. A structurally valid tag beyond the normal complexity
   ceiling retains its exact tag, base language and English fallback without constructing an
   unbounded prefix ladder; malformed over-complex inherited input goes directly to English.
2. **Then any registered, well-formed BCP-47 catalog sharing the base language**, which is how a
   _regional-only_ catalog is reached from a less specific tag (`lang="zh"` finds `zh-CN`,
   `lang="pt"` finds `pt-BR`). Order is deterministic and independent of import order:
   1. **Same likely script** — the explicit script subtag, else CLDR likely subtags via
      `Intl.Locale#maximize()`. `zh-Hant`, `zh-HK`, `zh-MO` and `zh-Hant-CN` reach Traditional
      `zh-TW`; `zh`, `zh-Hans`, `zh-SG` and `zh-Hans-HK` reach Simplified `zh-CN`. An unknown
      script (none, `Zzzz`, or no `Intl.Locale`) never matches.
   2. **Same likely region** — a region-less tag reaches its CLDR default region: bare `pt` picks
      `pt-BR` even with `pt-PT` imported.
   3. **Most shared subtags**, counting each occurrence (`pt-AO` and `pt-MZ` pick `pt-PT`;
      `qaa-Hant-TW` picks `qaa-TW` over `qaa-CN`).
   4. **Alphabetical**, as a stable tie-break.

   Register the regional tag you mean if the ordering isn't what you want. Legacy/custom tags are
   exact/truncation-addressable only and never become regional siblings.
3. **Then `en`**, always available through the built-in English defaults.

Step 1 always beats step 2: with both `zh` and `zh-CN` registered, `zh-Hans-CN` resolves to `zh`.

```ts
import { getLyraLocaleDirection } from "@aceshooting/lyra-ui/localization.js";

getLyraLocaleDirection("ar-EG"); // 'rtl' — declared by the shipped `ar` catalog, inherited by the region
getLyraLocaleDirection("de"); // 'ltr'
```

`getLyraLocaleDirection(tag): 'ltr' | 'rtl'` answers "does this locale need `dir="rtl"`?" without
an application keeping its own tag table. It reads a `dir` declared by `registerLyraLocale()`'s
optional third argument first (walked through the same chain above, so a region inherits its base
language's declaration), then `Intl.Locale`'s text-info surface where the engine has it, and
finally `'ltr'`. It only _reports_ a direction — nothing in the library applies one; see
[RTL and direction](#rtl-and-direction).

```ts
registerLyraLocale("ar", { close: "إغلاق" }, { dir: "rtl", name: "العربية" });
```

`registerLyraLocale(tag, strings, meta?)`'s third argument is optional catalog metadata —
`{ dir?: 'ltr' | 'rtl'; name?: string }` (`LyraLocaleMeta`). Nothing in it is ever rendered: `dir`
feeds `getLyraLocaleDirection()`, `name` is the locale's endonym for an application's own locale
list. It merges the same way `strings` does, so a later two-argument call adding messages never
drops metadata, and the two-argument call remains the normal way to register a catalog.

Registration snapshots at most 4,096 own enumerable catalog properties before publishing them.
Each accepted value is either a string or a plain/null-prototype CLDR plural record whose own data
properties are string categories and which includes `other`. Nested plural records are cloned and
frozen. Arrays, `null`, inherited properties, accessors and malformed records are ignored per key:
they never execute and never replace that key's last valid translation, while valid sibling keys
still merge. Empty strings remain intentional translations. Per-instance `.strings` overrides use
the same validation, so `resolveLyraString()` always returns a string and malformed overrides fall
through to the next valid tier.

`getRegisteredLyraLocales(): readonly string[]` returns a fresh frozen list of every locale with strings registered via
`registerLyraLocale()`, plus `'en'` (always available through the built-in English fallback),
sorted, deduped and canonically spelled. `subscribeLyraLocaleRegistry(listener: () => void): () =>
void` fires when registry membership grows, including for a newly registered locale that is not
active; extending an existing catalog does not change membership and does not fire it.
`subscribeLyraLocale()` (also on `@aceshooting/lyra-ui/localization.js`) instead fires when the
active selection changes or a registration can alter the active locale's messages/direction, and
filters unrelated registrations. Both return an idempotent unsubscribe. Delivery uses the eligible
starting listener snapshots: one callback failure cannot prevent later active, component or
registry listeners from running. State commits first, then the mutator throws one `AggregateError`
containing all callback failures after delivery completes. `<lr-locale-picker>` is the built-in
consumer of the registry subscription; see `llms/components/lr-locale-picker.md`.

`getRegisteredLyraLocaleKeys(locale: string): readonly string[]` returns a frozen snapshot of
exactly the keys `locale`'s own catalog carries — no BCP-47 fallback-chain widening and no merge
with the built-in English defaults. This answers "what has this locale actually been given",
distinct from `getRegisteredLyraLocales()`, which reports registry *membership* (which tags exist)
rather than catalog *content*. Diff the result's length against
`Object.keys(LYRA_DEFAULT_STRINGS).length` to measure a locale's own translation coverage without a
silent English-fallback merge making a partial catalog look complete. A locale nothing ever
registered — including `'en'` itself, unless it was explicitly passed to `registerLyraLocale()` —
returns an empty snapshot.

In development (Lit's own dev-mode signal; silent in production), resolving a message for a
resolved locale other than English that has no override, no fallback, and no registered catalog
entry for that key warns once per (locale, key) to `console.warn` before falling through to the
English default — the same silent-fallback `resolveLyraString()`, `localize()`, and
`resolveLyraScopedString()` all shared with no way to detect it before. It never fires for an
English-resolved locale, since falling through to `defaults` is simply how English itself resolves.

Gotcha: `localize()`'s optional second argument is a fallback string. Passing a defined literal there
silently defeats a registered catalog — omit it, or pass `undefined`.

### Ready-made catalogs: `@aceshooting/lyra-ui/translations/<locale>.js`

Sixty-six full catalogs ship with the package, each covering every key in `LYRA_DEFAULT_STRINGS`.
The public `@aceshooting/lyra-ui/locales.json` manifest lists their canonical identities, authored
source spellings, import paths, and structural coverage. It also distinguishes translation
coverage from linguistic review tier. The catalogs are **side-effect-only modules**: import one
bare, read nothing from it, and it calls `registerLyraLocale()` for you.

```ts
import "@aceshooting/lyra-ui/translations/de.js";
import "@aceshooting/lyra-ui/translations/de-CH.js"; // Swiss Standard German
import "@aceshooting/lyra-ui/translations/ar.js"; // declares dir: 'rtl'; direction still comes from dir
import "@aceshooting/lyra-ui/translations/fa.js"; // fa-IR falls back to this base catalog
import "@aceshooting/lyra-ui/translations/he.js"; // he-IL falls back to this base catalog
import "@aceshooting/lyra-ui/translations/it.js"; // Italian
import "@aceshooting/lyra-ui/translations/pt-BR.js"; // Brazilian: serves pt and pt-BR
import "@aceshooting/lyra-ui/translations/pt-PT.js"; // European: serves pt-PT, pt-AO, pt-MZ
import "@aceshooting/lyra-ui/translations/ro.js"; // Romanian
import "@aceshooting/lyra-ui/translations/zh-CN.js"; // Simplified: serves zh, zh-Hans, zh-SG and zh-Hans-CN
import "@aceshooting/lyra-ui/translations/zh-TW.js"; // Traditional: serves zh-Hant, zh-HK and zh-MO
```

Persian and Hebrew use CLDR plural categories (`fa`: `one`/`other`; `he`:
`one`/`two`/`other`); Italian uses a non-default set too (`it`: `one`/`many`/`other`), and so does
Romanian (`ro`: `one`/`few`/`other`, where `few` covers `0` and `2`-`19` and `other` is the
`de`-requiring form from `20` upward). The Slavic catalogs carry their own sets as well (`cs`:
`one`/`few`/`many`/`other`; `hr`: `one`/`few`/`other`; `sl`: `one`/`two`/`few`/`other`). `ar`, `fa`
and `he` declare `dir: 'rtl'`, so `getLyraLocaleDirection()`
answers for them (and for `ar-EG`, `fa-IR`, `he-IL`) — but locale selection still does not _force_
writing direction: set `dir="rtl"` on the page or an ancestor yourself.

`de-CH`, `pt-BR`, `pt-PT`, `zh-CN`, and `zh-TW` are regional catalogs: an exact tag always selects
its own catalog, and a less specific tag reaches one through step 2 only when nothing on its
truncation walk answers first (with `de` imported, `lang="de-AT"` resolves to `de`, never `de-CH`).
The same routing drives plural selection and `getLyraLocaleDirection()`. They are listed under
their real tags in `getRegisteredLyraLocales()`.

Import only the locales the application can actually offer — each is a separate module, so unimported
ones cost nothing. A catalog registered this way is merged like any other, so a later
`registerLyraLocale('de', { close: '…' })` still overrides individual keys, and a per-instance
`.strings` still wins over both. Importing a catalog registers it; it does not _select_ it —
`setLyraLocale()` or `<html lang>` still chooses. What the import does do is make the locale show up
in `getRegisteredLyraLocales()`, and therefore in `<lr-locale-picker>`, so the set you import is the
set a user can switch between.

### Smaller catalogs: `@aceshooting/lyra-ui/translations/<locale>/<family>.js`

Each locale above is also published as twelve smaller, side-effect-only **family slices** — one per
component family (`agent-tools`, `charts`, `conversation`, `data`, `forms`, `layout`, `media`,
`overlays`, `retrieval`, `utility`, `viewers`), plus `shared` for the handful of messages more than
one family reaches (roving-focus/overlay/a11y strings like `collapse`, `open`, `search`). Import only
the families the application actually renders instead of the whole-locale aggregate above:

```ts
import "@aceshooting/lyra-ui/translations/fr/forms.js"; // lr-input, lr-select, lr-combobox, ...
import "@aceshooting/lyra-ui/translations/fr/data.js"; // lr-table, lr-tree, lr-data-grid, ...
import "@aceshooting/lyra-ui/translations/fr/shared.js"; // cross-cutting strings both families reach
```

`@aceshooting/lyra-ui/translations/fr.js` is unchanged: it is now a thin aggregate that imports every
slice above, so the plain whole-locale import from the previous section keeps working exactly as
before — this is a purely additive, opt-in way to shrink a non-English bundle, mirroring the
per-component tree-shaking English defaults already get for free. A component's family is the
directory it ships under (`src/components/<family>/<name>/`); when in doubt, import the aggregate and
measure, or import `shared` alongside whichever family slices you do import so a cross-cutting string
is never silently missing.

### Pluralized messages

A message may be a plain string or a **`LyraPluralMessage`** — an object keyed by CLDR plural
category, one string per category the language needs:

```ts
import { registerLyraLocale } from "@aceshooting/lyra-ui/localization.js";

registerLyraLocale("en", {
  viewerSearchMatchCount: { one: "{count} match", other: "{count} matches" },
});
registerLyraLocale("ru", {
  viewerSearchMatchCount: {
    one: "{count} совпадение",
    few: "{count} совпадения",
    many: "{count} совпадений",
    other: "{count} совпадения",
  },
});
```

- **The categories are `zero | one | two | few | many | other`** — the values
  `Intl.PluralRules.prototype.select()` can return. A language uses only the subset its grammar
  needs: English and German `one`/`other`, Russian `one`/`few`/`many`/`other`, Arabic all six,
  Japanese and Chinese only `other`.
- **`other` is required.** It is the terminal step of the category fallback chain, so every
  selection is guaranteed to land on a real string. TypeScript enforces it; the remaining five keys
  are optional. A missing intermediate category widens to a grammatical neighbour before falling
  back to `other`.
- **Selection is driven by `values.count`**, run through `Intl.PluralRules` at the component's
  effective locale — never at the locale the catalog was authored in, so an unregistered locale
  still pluralizes correctly against whatever strings it does have.
- **`pluralCount` is the escape hatch for a pre-formatted count.** When `{count}` must render as
  locale-grouped text (`Intl.NumberFormat` output is a string, and `'1,024'` cannot select a
  category), pass the display string as `count` and the raw number as `pluralCount`. A non-finite
  or absent value selects `other`.

Pluralized messages use one object-valued entry keyed by CLDR categories. A catalog with separate
singular and `<key>Plural` entries should fold them into `{ one: …, other: … }` under the singular
key's name; the plural key is not read.

## RTL and direction

Direction is inherited from the platform `dir` cascade; locale/`lang` selection does not change it,
and no component forces its own. Pair an RTL locale with `dir="rtl"` — ask
`getLyraLocaleDirection(tag)` rather than hard-coding a list of RTL tags, and note that
`<lr-locale-picker>`'s `lr-change` detail already carries the picked locale's `direction`, so
applying it is `document.documentElement.dir = event.detail.direction`. Layout mirrors through CSS
logical properties. Where physical math is unavoidable — drag ratios, arrow-key direction, anchored
placement — components share one internal direction helper: `isRtl(el)` (used by `lr-multi-split`,
`lr-time-range`, `lr-dock-panel`), plus `rtlAwareSide(side, el)` and `rtlAwarePlacement(placement,
el)`, which swap the `left`/`right` component of a value under RTL and pass it through unchanged
under LTR (`lr-menu` resolves its `placement` this way). These are implementation detail, not a
published subpath — resolve direction in your own code with `getComputedStyle(el).direction`, which
is the same answer through the same inheritance. Test both directions for anything with horizontal
order, start/end
placement, drag deltas, or previous/next navigation.


### Locale coverage and review evidence

`@aceshooting/lyra-ui/locales.json` lists the shipped catalogs, their import paths and structural
message coverage. Coverage and linguistic review are separate fields: an approved AI-assisted
review is still AI-assisted. Human and native-speaker tiers require attributable evidence bound
to the current catalog hash. English is the source catalog, and pseudo locales are test fixtures;
neither is advertised as another translated language. The repository's Translation review issue
form is the volunteer human/native-speaker review channel; opening an issue does not approve a
catalog or promote its review tier.


A manifest entry separates its canonical locale tag from `sourceLocale`, the authored catalog file
identifier. For example, the requested Tagalog catalog is authored as `tl` and canonicalized as
`fil`; Western Punjabi is authored as `pnb` and canonicalized as `lah`. These are aliases of one
catalog each, not additional Filipino or Lahnda translations. Loader calls using either spelling
share the same catalog import. Coverage/review evidence remains attached to the actual authored
catalog and written register.
