## Breaking changes in 10.0.0

Per-release history for this family is in `CHANGELOG.md`; the component sections document only the current API.

## Breaking changes in 9.0.0

Per-release history for this family is in `CHANGELOG.md`; the component sections document only the current API.

## `lr-flag`

Country/language flag image. Flag artwork ships in a **separate, optional peer package**
(`@aceshooting/lyra-flags`) — importing `lyra-ui` core never pulls in flag image weight.

**Properties:**

- `country?: string` (ISO 3166-1 **alpha-2 or alpha-3**, e.g. `"fr"` or `"FRA"` — takes
  precedence over `language`). Length alone disambiguates the two code spaces, so no format hint
  is needed: a 2-letter value is alpha-2, a 3-letter value is alpha-3. Alpha-3 support exists
  because public statistical sources (World Bank, UN, IMF, most open-data portals) key country
  records on alpha-3; the 249 officially-assigned mappings are packed as a ~1.2 KB fixed-width
  string and expanded lazily on the first alpha-3 lookup, so an alpha-2-only app never pays for
  them. Withdrawn and user-assigned codes deliberately do not map to a successor state — they
  take the unresolved path below
- `fallback?: string` — placeholder image URL rendered when the code cannot resolve to a current
  flag. The `fallback` slot wins over it
- `language?: string` (BCP-47-ish tag, e.g. `"en"`/`"en-US"`, resolved to a representative country
  via `languageToCountry()`)
- `src?: string` (a pre-resolved flag image URL — takes precedence over `country`/`language` and
  skips the peer-package lookup; mainly useful to avoid even
  the small per-flag async hop when you already have the URL at build time, e.g. from
  `import frUrl from '@aceshooting/lyra-flags/flags/fr.svg?url'`. `label` is effectively required
  alongside `src` since there's no `country`/`language` to derive a fallback `alt` from.)
- `label?: string` (accessible name / `alt` text — **defaults to a localized, human-readable region
  name derived from the _resolved country_ code via `Intl.DisplayNames` if omitted**, see gotchas)
- host `aria-label` takes precedence over `label` and the derived region name; an explicit empty
  value marks the image decorative
- `shape: LyraFlagShape = 'rect'` (reflected, `'rect' | 'circle'`)
- `fidelity: LyraFlagFidelity = 'standard'` (reflected — picks a
  fidelity tier for the ~65 codes whose source art embeds a coat of arms/seal/emblem; every other
  code resolves to the same file regardless of `fidelity`. `'compact'` = a tiny WebP raster for
  icon-scale use (menus, language pickers, ~12–28px); `'standard'` = the icon-optimized vector for
  card/row sizes (~28–96px); `'detailed'` = the
  pristine full-fidelity vector for hero-scale display. No effect when `src` is set.)

Exported authoring types are `LyraFlagShape`, `LyraFlagFidelity`, and `LyraFlagUrlResolver`.

Concurrent flags resolving the same country and fidelity share pending resolver work within the
current resolver generation. Settled or failed requests do not prevent later retries.

**Events:** none.

**Slots:** `fallback` — rendered in place of the flag when `country`/`language` cannot resolve to a
current flag (an unassigned, historical, or malformed code). Wins over the `fallback` property.

**CSS parts:** `image` (the underlying `<img>`, exposed once native loading succeeds),
`fallback-image` (the `fallback` property's placeholder, when no slot content is supplied), `error`
(contained localized visible text rendered when URL validation, peer resolution, or native image
loading fails). The host reflects the terminal error state with `data-error`, and an unresolvable
code with `data-unresolved`. **The two are deliberately distinct:** a dissolved federation or
unrecognized territory in a longitudinal dataset is *data*, not a defect, so it renders the neutral
fallback (occupying its normal footprint in a table or card grid) rather than localized error
wording that reads to a user as a bug. Style the two states apart with those attributes.
The built-in `fallback-image` uses the same full-frame sizing, `object-fit`, circle clipping, and
forced-colors inset boundary as the resolved `image`; replacing it with slotted fallback content
leaves that content's presentation under the caller's control.

**Themeable custom properties:** `--lr-flag-radius` (default `calc(var(--lr-radius) * 0.33)` —
rectangular corner radius), `--lr-flag-aspect-ratio` (default `4 / 3`), and
`--lr-flag-object-fit` (default `cover`); also consumes `--lr-color-border-subtle` for the decorative inset ring.

**Sizing.** The host has no intrinsic `width` — it sizes from `font-size` (`block-size: 1em`,
`inline-size` derived from `--lr-flag-aspect-ratio` via CSS `aspect-ratio`), so it scales naturally
with surrounding text (`<lr-flag style="font-size: 2rem">`). Setting `width`/`inline-size` directly
instead makes both axes definite, which defeats `aspect-ratio` (only applies when at most one axis
is definite) and squashes the image rather than scaling it.

**Optional peer deps:** `@aceshooting/lyra-flags` — required for the component to actually render an
image when `country` or `language` is used. Import
`@aceshooting/lyra-ui/components/media/flag/flag-peer.js` once to opt into
that resolver; a pre-resolved `src` works without the peer registration entry. If the peer is not
installed — or if `flag-peer.js` was simply never imported, which looks identical from the page —
the component fails closed with localized visible `[part="error"]` text, a shared light-DOM
assertive announcement, and a one-time `console.warn` naming the unresolved code and this import
(see gotchas).

Also exported from the package root:
`languageToCountry(language: string): string | undefined` and the `LANGUAGE_TO_COUNTRY` lookup
table (region subtag wins, e.g. `en-US` → `us`; plain `en` → `gb`; override the table per-app if you
need different defaults). Only the table's own entries are eligible for base-language fallback;
inherited object members such as `constructor` resolve to `undefined`. A region-less tag whose
script subtag implies a different likely region than its bare language takes that region instead of
the table default, so Traditional and Simplified Chinese never share a flag: `zh-Hant` → `tw` while
`zh` and `zh-Hans` → `cn`. The rule is not specific to Chinese: `zh-Hanb` and `zh-Bopo` → `tw`, and
`kk-Arab` (Kazakh in Arabic script, as written in China) → `cn` rather than the `kk` default of `kz`;
pass `country` when a different flag is wanted. A script that implies the language's own likely
region keeps the table's convention (`en-Latn` → `gb`), a language with no table entry stays
unresolved, and an engine without `Intl.Locale` likely-subtags data uses the table default. Also
exported:
`localeNativeName(tag: string): string`.

`localeNativeName()` returns a BCP-47 tag's **endonym** — the locale's name written in that locale
itself (`'fr'` → `français`, `'pt-BR'` → `português (Brasil)`). That is what a language switcher
should list, so a reader who understands none of the current UI language can still find their own.
It derives from `Intl.DisplayNames`, so no name table ships with the library and results follow the
browser's own ICU data. The underlying formatter and resolved native names are cached, so repeated
catalog renders reuse prior results. A tag with no display name resolves to the
tag itself, and so does a structurally invalid one — `Intl.DisplayNames` throws a `RangeError` on
those rather than falling back, and a language picker should degrade to showing the raw tag rather
than tearing down the render. Pair it with `languageToCountry()` for the flag half of the same row.

**Locale picker recipe.** `<lr-locale-picker>`
(`@aceshooting/lyra-ui/components/lr-locale-picker.js`) is the built-in
locale switcher — a closed-list dropdown over the locale registry or an explicit catalog, with
`lr-flag`/`localeNativeName()` rows and full form association out of the box. The manual
composition below remains available for an app that wants different chrome (its own dismiss
surface, a different active-state marker, or a layout `<lr-locale-picker>` doesn't offer):
`<lr-popover>` supplies the light-dismiss surface, `<lr-flag>` the country mark,
`localeNativeName()` the endonym, and `aria-current="true"` marks the active choice. Which locales
exist is the app's decision, so the app owns the list. Set `lang` on each row so assistive tech
pronounces the endonym in its own language, and use `fidelity="compact"` at icon scale.

```html
<lr-popover placement="bottom-start">
  <button slot="trigger">
    <lr-flag language="fr" label="" style="height: 1rem"></lr-flag>
    <span>français</span>
  </button>
  <ul role="list">
    <!-- one <li><button lang="pt-BR" aria-current="false"> … </button></li> per offered locale -->
  </ul>
</lr-popover>
```

```js
import {
  localeNativeName,
  languageToCountry,
} from "@aceshooting/lyra-ui/components/media/flag/language-map.js";

const rows = ["en", "fr", "de", "pt-BR", "ja", "ar"].map((tag) => ({
  tag,
  name: localeNativeName(tag), // endonym, e.g. "português (Brasil)"
  country: languageToCountry(tag), // flag code for the same row
}));
```

```html
<lr-flag country="fr" label="France"></lr-flag>
<lr-flag language="en-US" shape="circle"></lr-flag>
<lr-flag country="es" fidelity="compact"></lr-flag>
<!-- tiny WebP raster, icon-scale -->
<lr-flag country="es" fidelity="detailed"></lr-flag>
<!-- pristine full-fidelity vector -->
```

```bash
pnpm add @aceshooting/lyra-flags   # required for country/language lookup; failures render error text
```

```js
import "@aceshooting/lyra-ui/components/media/flag/flag-peer.js";
```

**Known gotchas:**

- `country`/`language` resolution is opt-in through
  `@aceshooting/lyra-ui/components/media/flag/flag-peer.js`; `all.js`
  registers the component without importing the optional flag asset graph. Requires the optional
  peer `@aceshooting/lyra-flags` to actually render an image; without it the component still shows a
  decorative `<lr-skeleton shape="rect" announce="false">` placeholder while resolving. The
  host exposes `aria-busy="true"`, and ordinary sr-only text preserves the localized `loading`
  label without creating a shadow live region. Resolution failure then **fails closed** into ordinary localized
  `<span part="error">` text (the `flagLoadError` message key, `"Flag unavailable"` by default).
  Each fresh failure appends that same localized message to the document's pre-mounted
  `[data-lr-live-region="assertive"]` sink, so the shadow chrome itself is not live and identical
  retries remain separate additions. The failure also produces a one-time `console.warn`
  once the resolver rejects (lazy `import()`, cached module-wide so the warning fires only once per
  page even with many `<lr-flag>` instances). A **separate** one-time `console.warn` covers the
  commonest setup mistake — `country`/`language` set while no resolver was ever registered, i.e.
  `flag-peer.js` was not imported. It names the offending code and that import path, because the
  visible `[part="error"]` state alone is indistinguishable from missing flag data. It is armed
  once per resolver-registration generation, so a table of many flags warns once.
  An _empty_ template is a different, non-error outcome:
  the peer resolved fine but returned no URL for that code (e.g. `country="zz"`) — no `[part="error"]`,
  no `<img>`, no warning.
- Rendering is async even when the peer _is_ installed: `src` resolves after an `import()` +
  resolver call, so there's a brief loading-skeleton window on first paint/attribute change — don't
  assume the `<img>` exists synchronously right after setting `country`/`language`.
- if both `aria-label` and `label` are omitted, the accessible name (`alt`) falls back to a localized
  region name via `Intl.DisplayNames([effectiveLocale], { type: 'region' })` (e.g. `"United Kingdom"`) instead of
  a bare code — for `language="en"` that's derived from `"GB"` (the mapped country), not `"EN"` (the
  language tag itself). Falls back further to the bare uppercase code if `Intl.DisplayNames` throws
  for an unrecognized region or isn't available. You can still pass an explicit `label` (e.g.
  `"France"`) to override the derived name.
- an invalid `country` (anything not matching the ISO 3166-1 alpha-2 shape, e.g. containing `../`)
  is rejected before it ever reaches the peer's `flagUrl()` resolver — treated the same as an
  unknown/missing flag rather than being passed through. `languageToCountry()`'s region-subtag path
  is validated against that same alpha-2 shape too (not just a bare length-2 check), so a malformed
  region such as `"en-01"` correctly falls through to the `LANGUAGE_TO_COUNTRY[base]` lookup instead
  of being accepted verbatim as a country code.
- rapidly reassigning `country`/`language`/`src` no longer risks a stale resolution overwriting a
  newer one: each resolver call is tagged with a token captured at the time it was kicked off, and a
  `.then()` that fires after a later change (or after the field was cleared) is discarded instead of
  clobbering the rendered image/`loading`.
- `country`/`language` resolve through `@aceshooting/lyra-flags`'s `flagUrl(code)`, which lazily
  fetches one requested flag at runtime. A bundler may still emit the complete reachable lazy-chunk
  graph because every supported code has a literal loader import; use a literal asset subpath
  import when the deployment artifact must be pruned. If every `<lr-flag>` in the app is pinned to
  one `fidelity` (no per-instance switching), register
  `@aceshooting/lyra-flags/standard`/`/compact`/`/detailed` via `setFlagUrlResolver()` instead of
  importing `flag-peer.js` (which always registers the full three-tier resolver) — the tier-specific
  entry excludes the other two tiers' generated loader maps from the reachable graph; see that
  package's README. If you already have a flag's URL at build
  time, `src` skips the peer-package round trip; native image loading still uses the same bounded
  loading/error transaction.
- Rendering many flags at once (a country table, a picker listing every locale): resolve every code
  up front with `@aceshooting/lyra-flags`'s `flagUrls()` (one call, returns `{code: url}` for all
  249 flags) and pass results through `src`, instead of letting each `<lr-flag>` instance
  independently call `flagUrl()` — skips one peer-resolution round trip per instance. Image fetches
  themselves are unaffected either way (each flag is a distinct asset; there is no sprite).
  Alternatively, import `@aceshooting/lyra-ui/components/media/flag/flag-peer-bulk.js` instead of
  the default `flag-peer.js` (never both) to get this automatically: it registers a resolver backed
  by one shared `flagUrls()` call, so every `<lr-flag>` on the page benefits without threading `src`
  by hand. Only worth it when the page renders most/all flags — a page with a handful pays an
  unneeded 249-entry fetch. Only the standard tier is bulk-fetched this way;
  `fidelity="compact"/"detailed"` on individual elements still resolves through its own lazy
  per-code loader.
- Rendering many flags at once **and** leaving every `<lr-flag>` on the default
  `fidelity="standard"`: import
  `@aceshooting/lyra-ui/components/media/flag/flag-peer-bulk-standard.js` instead of
  `flag-peer-bulk.js` (never more than one of the three peer entries — each
  `setFlagUrlResolver()` call replaces the previous resolver). It registers
  `@aceshooting/lyra-flags/standard`'s `createFlagUrlResolver()`, which is backed by the same
  standard-tier-only eager map as the root's, without statically importing the detailed and
  compact loader maps the root entry needs for its per-call `variant`. Those maps are what
  `flag-peer-bulk.js` pays for its batching: on a real production build with a 156-country flag
  column, routing bulk resolution through the package root emitted +65 detailed SVGs and +31
  compact WebPs — +15.8MB of assets no route rendered — swamping the chunk-count win the bulk path
  exists for. The tradeoff is the tier commitment: `fidelity="compact"/"detailed"` on an individual
  element resolves to that code's standard asset instead (a silent no-op, not an error), so use
  `flag-peer-bulk.js` when per-instance fidelity must actually be honoured.
- 65 of `@aceshooting/lyra-flags`' 249 flags (any whose design includes a detailed coat of
  arms/seal/emblem, e.g. `es`, `pt`, `sv`) ship **three** fidelity tiers, selected via the
  `fidelity` property (`flagUrl(code, { variant: fidelity })` under the hood): `"compact"` — a tiny WebP raster for
  icon-scale use (menus, language pickers, dense lists); `"standard"` — the default, the
  icon-optimized vector for card/row sizes, ~84% smaller on average than the pristine source for the
  65 affected codes with no visible fidelity loss at that scale; `"detailed"` — the pristine
  full-fidelity vector, for hero-scale display where the extra illustrative detail is actually
  visible. The other 184 codes resolve to the same file regardless of `fidelity` — a safe no-op.

**Additional API surface:**

- `part="error"` — Ordinary localized visible text rendered when the optional peer resolver is
  unavailable or fails; the fresh transition is announced by the shared light-DOM assertive sink.

---

## `lr-sequence-playback`

Steps a current index through `[0, itemCount)` on a fixed interval — explicit discrete-sequence
playback for time-series scrubbing, without implying native audio/video playback.

When fewer than two items are available, the disabled play button retains its resting border and
background under hover and press. Enabled playback controls retain their token-driven pointer
feedback.

**Properties:**

- `itemCount: number = 0` (attribute `item-count`)
- `currentIndex: number = 0` (attribute `current-index`)
- `intervalMs: number = 900` (attribute `interval-ms`)
- `readonly playing: boolean` (reflected as the `playing` attribute) — whether playback is running.
  Start and stop it with `play()`, `pause()` or `toggle()`; assigning it throws in strict-mode code
  and an authored `playing` attribute starts nothing.
- `withoutLoop: boolean = false` (attribute `without-loop`) — stops playback on the last item
  instead of wrapping back to the first; read on every tick.
- `hidden: boolean = false` (reflected; re-declared over the native IDL property so Lit's
  change-tracking sees it and auto-pauses on `hidden = true`)

**Methods:** `play()`, `pause()`, `toggle()`, `next()`, `previous()`,
`goTo(currentIndex: number)` — all idempotent/clamped; `itemCount <= 1` is a no-op degenerate case.
`focus(options?)`, `blur()`, and
`click()` forward to the play button.

**Events:** `lr-play`, `lr-pause` (no detail), `lr-sequence-step`
(`detail: LyraSequencePlaybackStepDetail { currentIndex }`, fired on every tick and manual step);
internal `focus`/`blur` are relayed exactly once as owner-realm native `FocusEvent`s (bubbling and
composed, preserving `relatedTarget`).

**Class and event types:** `LyraSequencePlayback`, `LyraSequencePlaybackEventMap`, and
`LyraSequencePlaybackStepDetail`.

**Slots:** `play-icon`, `pause-icon` — decorative glyphs for the paused and playing states; an empty
slot keeps the built-in glyph. Assigned content renders in an inert, `aria-hidden` layer inside the
play/pause button, so do not use either slot for a second interactive control.

**CSS parts:** `base`, `play-button`, `slider`

The `slider` carries supplemental localized `aria-valuetext` — `Step {index} of {total}` (key
`playbackStepPosition`, both numbers formatted with the component's effective locale). Browsers may
ignore that override on a native range, so the interoperable semantic contract is itself one-based
(`min=1`, `max=itemCount`, `value=currentIndex+1`): assistive technologies receive the correct
ordinal even when they expose the native numeric value.

**Themeable custom properties:** `--lr-sequence-playback-icon-size` (default
`calc(var(--lr-icon-button-size) * 0.35)` — the play/pause glyph's size; applied as the button's
`font-size`, and the inline SVG renders at `1em`).
`--lr-sequence-playback-play-button-active-bg` (default
`color-mix(in oklab, var(--lr-color-surface), var(--lr-color-mix-partner) var(--lr-color-mix-active))`) —
the pressed play/pause background; and `--lr-sequence-playback-play-button-active-border-color` (default
`var(--lr-color-brand)`) — its pressed border. Both are inline `var()` fallbacks, so a value set on
the element or an ancestor inherits without being shadowed by a host default. Plus shared tokens `--lr-space-s`,
`--lr-color-border`, `--lr-color-surface`, `--lr-color-text`, `--lr-color-brand`,
`--lr-icon-button-size` (the play button's box), `--lr-opacity-disabled` (play button/slider
dimming at `itemCount <= 1`), `--lr-focus-ring-*`.

**Optional peer deps:** none.

```html
<lr-sequence-playback item-count="24" interval-ms="500"></lr-sequence-playback>
<script>
  const playback = document.querySelector("lr-sequence-playback");
  playback.addEventListener("lr-sequence-step", (event) => {
    renderFrame(event.detail.currentIndex);
  });
</script>
```

**Known gotchas:**

- `currentIndex` is re-clamped into `[0, itemCount)` as soon as `itemCount` shrinks (in
  `willUpdate()`, not waiting for the next `tick()`/`goTo()`/`next()`/`previous()` call) — setting
  `el.itemCount = 2` while `el.currentIndex = 7` immediately pulls `currentIndex` back to `1`, and
  playback auto-pauses if `itemCount` drops
  to `<= 1` while playing (the play button and slider would otherwise both become disabled with no
  way to stop it — both are `?disabled` whenever `itemCount <= 1`, not just the button).
- `intervalMs` is live-reactive mid-playback: ticking is a self-rescheduling `setTimeout` (not one
  long-lived `setInterval`), so `intervalMs` is re-read fresh before every tick — changing
  `interval-ms` while `playing` takes effect on the very next step instead of only after a
  pause/play cycle.
- `itemCount` and `currentIndex` are normalized to finite non-negative integer counts, with
  `currentIndex` clamped into `[0, itemCount)`; fractional, negative, `NaN`, infinite, and oversized
  values cannot poison end conditions or the slider.
- `interval-ms` is clamped to the 16ms floor and the browser's finite timer ceiling: a non-finite or
  lower value ticks at 16ms, while an oversized value uses the timer ceiling.
- No _visible_ "N of M" position label beside the range input; the native one-based range still
  exposes the current ordinal and total bounds, with localized `aria-valuetext` as a supplemental
  enhancement where the platform honors it.
- Calling `play()`/`pause()` programmatically (not via the button) gives no `aria-live`
  announcement of the Play/Pause state change.

---

### Shared epoch-time binding

Import `createSimulationClock` from `@aceshooting/lyra-ui/simulation-clock.js`, `createTimeIndex`
from `@aceshooting/lyra-ui/time-index.js`, and `bindSequencePlayback` from
`@aceshooting/lyra-ui/sequence-time-binding.js`. Register the control separately with
`@aceshooting/lyra-ui/components/lr-sequence-playback.js`; the helper registers nothing.

```js
const samples = createTimeIndex([Date.UTC(2026, 0, 1), Date.UTC(2026, 0, 1) + 4000,
  Date.UTC(2026, 0, 1) + 13000]);
const clock = createSimulationClock({ range: [samples.instantAt(0), samples.instantAt(2)],
  instant: samples.instantAt(0) });
const release = bindSequencePlayback(playback, clock, samples);
const unsubscribe = clock.subscribe(({ instant }) => updateApplicationViews(instant));
// When the application scope ends:
release(); unsubscribe(); clock.dispose();
```

The bound slider remains sample-index based; irregular sample durations come from the shared clock.
`itemCount` and `currentIndex` report the displayed count and lower sample index. The binding owns
those values: direct property/attribute writes do not seek shared time. `intervalMs` and
`withoutLoop` remain dormant while bound. Playback is forward-only and stops at the clock range end.
`goTo()` requests a sample timestamp, pauses, then emits one step even at the same index;
`next()`/`previous()` retain replay state and do nothing at their displayed endpoints. Clock range
clamping wins: event detail reports the actual mapped index, not an unreachable requested sample.
Empty bindings disable navigation/play without pausing other clock consumers. Singleton `goTo(0)`
can explicitly seek/pause; disabled UI prevents accidental activation.

`lr-play`/`lr-pause` reflect effective replay transitions; `lr-sequence-step` retains exactly
`{ currentIndex }`. Fractional movement within a sample emits no step, crossing several samples
emits one, and manual actions do not duplicate their subscription-driven projection. A pause
transition precedes its manual step. Commands are synchronous except commands issued during clock
fan-out, whose accepted projection is deferred to the next delivery. Reentrant release/disconnect
retires the old event continuation.

Attach/detach and restoration emit no synthetic play/pause/step events. Release restores standalone
index values paused. Host `hidden = true`, disconnect, adoption, or abort releases only that
control; other subscribers continue. Clock disposal releases all of its bindings and subscribers.
Show/reconnect requires explicit rebinding. Ancestor
CSS visibility is not observed. Import helper and control from the same package module instance;
duplicate installed copies do not share private attachment authority. Unsupported, inactive or
already-bound hosts fail before ownership transfer. See the shared clock utilities guide for
scheduling, live/replay, disposal and error-code contracts.

## `lr-map`

A MapLibre-compatible wrapper using the optional `@aceshooting/lyra-map` modular engine by default,
with a declarative legend, a single choropleth GeoJSON fill layer, markers,
and additive `dataLayers` — plain GeoJSON, natively clustered points, or a heatmap density surface —
plus a peer-neutral `map` getter for common imperative operations. Its runtime value is the
underlying MapLibre map. The component observes its own map-container allocation and calls the
peer's `resize()` when that allocation changes.

**Large spatial sources:** a catalog of a million logical geospatial records can stay in a
host-owned spatial service. Supply a hosted vector style URL, or a style object with vector tile
sources and layers, through `mapStyle`; the selected peer requests and renders tiles for the
viewport. The host owns durable records, spatial indexing, identity lookup, global bounds and
total counts. Keep those totals beside the map: a rendered-feature query describes the current
viewport, not the complete catalog. Tile density, zoom range and service response sizes remain
application decisions. This route does not require a million-feature inline GeoJSON collection.

Configure the selected engine's worker before constructing the map, as described below. For a
custom tile protocol, register `addProtocol()` from that same engine package before assigning a
style that uses its scheme (`@aceshooting/lyra-map` for the default, `maplibre-gl` for explicit
`engine="maplibre"`). The host protocol handler supplies real tile bytes and owns its transport,
authorization and cancellation. Remove registrations with `removeProtocol()` when no remaining
map uses them. A protocol registration is peer setup, not an `lr-map` provider property.

Use bounded `dataLayers` for changing selections or local overlays fetched by identity or spatial
query. Only the first 100 descriptors are inspected, and `markers` inspects at most 2,000 entries;
neither is a complete catalog browser. Stable unique feature IDs allow
`updateSourceData(sourceId, diff)` to update an applied generated GeoJSON source without replacing
the whole collection. Check its boolean result and retain the host's authoritative state; a later
controlled `dataLayers` assignment replaces imperative changes. Opaque GeoJSON handoff and
uncloned diffs avoid a Lyra deep copy, while the peer still parses, indexes, transfers and caches
data. The tile cache belongs to the peer; bounded wrapper DOM does not establish a bound on worker
heap or guarantee constant rendering cost as the source grows.

Markers and popups use the physical top-left origin required by MapLibre's projected transforms in
both LTR and RTL. Their text and surrounding controls retain logical direction-aware layout.

Live ancestor theme or token changes resolve the choropleth's stop colors and explicit or implicit
step base color again, as well as its opacity. These are paint-only updates on the existing fill
layer: the map instance, source, layer and viewport are preserved. Linear, logarithmic and step
modes use the same expression semantics at initial render and after a theme change.

**Readiness and declarative resources:** `whenStyleReady()` waits for the current style and
wrapper-owned resources for that style generation. After changing layer or source data on the same
style, await `whenIdle()` for the current resource and rendering work. Observe
`lr-map-style-load` and `lr-map-idle` for lifecycle notifications. Await these promises and handle
rejection when replacing styles or disconnecting; a returned `true` from a synchronous command
means admission, not asynchronous completion.

`whenControlsReady(): Promise<void>` waits for native control installation and public chrome hooks,
including default attribution. Await it after `whenStyleReady()` when measuring or styling installed
controls. Explicitly disabling all controls resolves after map construction. On a connected deferred
map, it waits for initialization rather than activating the map. Replacing `controls` or disconnecting
rejects the pending barrier with `AbortError`; initialization, invalid configuration or control
loading failure rejects with `MapReadinessError`. A style-only change preserves the controls
barrier. A completed promise describes its captured configuration; call again after assigning
`controls`.

URL `mapStyle` replacements and new objects on the modular peer use `setStyle(style, { diff: false })`.
Readiness waits for the replacement's committed `style.load` before capturing its catalog and
restoring owned layers, images and style overrides. Superseding an unfinished replacement also
rebuilds the style. This trades style diffs for reliable completion, including unchanged URL
responses and structurally equal new modular objects. Reassigning the exact same object is a no-op.
Loaded native MapLibre styles retain synchronous inline diffs. The live peer determines behavior;
`engine` changes apply after reconnect. Map and camera identity are preserved.

**On-demand runtimes:** optional `lr-map` features load their code on first use, so a bundler that
splits chunks keeps them out of the initial bundle. Drawing and vertex editing load when `drawMode`
becomes `line` or `polygon` or `editDrawing()` is first called; `exportImage()` loads export
capture; `hash` loads URL ownership when it is anything but `false`, `null` or `undefined`;
`overlays`, `images`, `styleOverrides`, external data layers and `interactiveBasemapLayers` load
resource ownership when they are not the empty defaults; an `imageProvider` function loads
resource ownership too. Image preparation and basemap override ownership load only for
non-empty `images` and `styleOverrides`; `anchorLngLat` loads
anchor placement; the first native control (default attribution included) loads control
ownership; and the first `setFeatureState()`/`removeFeatureState()` loads feature state. Each
runtime is imported once per page and every element shares it. `whenStyleReady()` and
`whenIdle()` wait for a resource-ownership load and for any drawing, URL or feature-state load in
progress, so awaiting them is the deterministic way to wait; anchor placement, export and controls
stay asynchronous as before. Once a runtime has loaded, its APIs are synchronous again.
While one is loading, `editDrawing()`, `setFeatureState()` and `removeFeatureState()` return
`false` without retaining anything: await `whenIdle()` and call again. `undoDrawing()`,
`completeDrawing()`, `closeAnchor()` and `focusAnchor()` return `false` because no session or
placed anchor exists yet; `cancelDrawing()` still cancels an armed mode synchronously with the
usual `lr-map-draw-cancel` detail. A runtime that cannot load fails closed with the feature's
existing localized feedback: drawing shows its unavailable message, export rejects with
`capture-failed`, resources show the initialization fallback, URL ownership and requested controls
show the control-unavailable message (default attribution alone stays silent, as when its own code
cannot load), feature state shows its unavailable message, and an anchor stays hidden. Drawing
retries when drawing is requested again, feature state after a new style or connection, URL
ownership after reconnection, controls when they next change, export on its next call, and an
anchor for a new coordinate.

`overlays: LyraMapOverlays = {}` owns native `sources` (`{ id, source }`) and `layers`
(`{ layer, before?, interactive?, priority? }`). Descriptors are snapshotted as bounded plain data:
at most 128 sources and 128 layers, 50,000 values, 10,000 entries per array or record and 1 MiB of
text; a rejected assignment shows the localized initialization failure. A `geojson` source whose
`data` is a `Feature` or `FeatureCollection` object is the exception: that object is kept by
identity (its envelope is checked, its contents are left to the engine, as for `dataLayers`), so
large data stays outside that budget. That is the supported way to draw large styled GeoJSON with
native paint and layout expressions (`match`, `interpolate` on `["zoom"]`,
`["coalesce", ["feature-state", "x"], ["get", "x"]]`), `filter`, `minzoom`/`maxzoom`, symbol layers,
`before` ordering, interaction and feature state, all replayed after a `mapStyle` swap. Assign a new
`data` object (in a new `overlays` value) to update the native source in place with `setData`: its
layers stay, and its feature state is retired as for any data change. Mutating the retained object is
not observed; `updateSourceData(sourceId, diff)` also accepts an overlay GeoJSON source ID for
incremental diffs (re-applied from `data` after the next style swap). Hits skip an interactive layer
outside its `minzoom`/`maxzoom` at the fractional camera zoom, with `visibility: 'none'`, or whose
every opacity (a constant or a `["zoom"]`-driven `interpolate`/`step`) is `0`, so a hidden tier never
shadows a visible one.

Reassign a fresh `overlays` snapshot to change an owned layer's `paint`, `layout`, `filter`,
`minzoom` or `maxzoom`. When its `id`, `type`, source/source-layer binding and other structural
fields stay the same and its source does not need replacement, the wrapper applies those mutable
fields in place. Removed paint and layout
keys are unset; removing `filter` clears it, and omitted zoom bounds return to `0`/`24`. The native
source and layer stay installed, so feature state, image references and interaction attribution
survive the change. The `before` order planner also runs when a snapshot changes. Changing a
structural field, or using a peer without the needed mutation methods, takes the existing
remove/add path instead. A failed native mutation is rolled back while the current peer can still
be used; if restoration fails, ownership stays uncertain until a fresh style or peer can rebuild
the resources. Failures
produce the localized resource error, without exposing the native exception or claiming readiness
for a partial update. Keep the application snapshot authoritative and await `whenIdle()` after a
successful assignment before relying on the new rendering.

```js
mapEl.overlays = {
  sources: [{ id: 'communes', source: { type: 'geojson', data: communes /* 600k values */, promoteId: 'code' } }],
  layers: [{ interactive: true, before: 'place-labels', layer: {
    id: 'communes-fill', type: 'fill', source: 'communes', minzoom: 9, maxzoom: 14,
    filter: ['==', ['get', 'level'], 'commune'],
    paint: {
      'fill-color': ['coalesce', ['feature-state', 'color'], ['get', 'color']],
      'fill-opacity': ['interpolate', ['linear'], ['zoom'], 9, 0, 10, 0.6],
    },
  } }],
};
mapEl.setFeatureState({ origin: 'overlay', source: 'communes', id: 'LU0101' }, { color: '#0d6efd' });
```

### Composing independent map modules

Keep one application owner of `overlays`. For example, publish eight module snapshots in this
explicit bottom-to-top order: districts, parcels, roads, transit, water, sensors, alerts, selection.
Each controller returns immutable `sources` and `layers` arrays with globally unique stable IDs
such as `city:roads:data` and `city:roads:fill`. These are application IDs; the aggregator never
prefixes or rewrites them. Freeze nested descriptor values too and treat retained GeoJSON as
immutable; create fresh descriptors when a controller changes. Keep large `data` objects by
reference instead of cloning or serializing them.

The tested **Independent Modules** story uses the following pure composition pattern (trusted
application snapshots, not an admission boundary for untrusted objects):

```ts
import type { LyraMapOverlays } from '@aceshooting/lyra-ui/components/media/map/map.class.js';

/** Application example, shared by the composition story and its tests. */
export const MAP_MODULE_ORDER = Object.freeze([
  'districts', 'parcels', 'roads', 'transit', 'water', 'sensors', 'alerts', 'selection',
] as const);
export type MapModuleName = typeof MAP_MODULE_ORDER[number];
export type MapModuleSnapshot = Required<LyraMapOverlays>;
export type MapModules = Readonly<Partial<Record<MapModuleName, MapModuleSnapshot>>>;

/** Match descriptor admission limits before publication, without visiting GeoJSON contents.
 * This example accepts plain immutable application descriptors, not canvas/other native objects. */
function validateDescriptors(sources: NonNullable<LyraMapOverlays['sources']>, layers: NonNullable<LyraMapOverlays['layers']>): void {
  if (sources.length > 128 || layers.length > 128) throw new Error('limit');
  let values = 0, text = 0;
  const visiting = new WeakSet<object>();
  const fail = (): never => { throw new Error('invalid-descriptor'); };
  const plain = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' &&
    (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
  const plainArray = (value: unknown): value is unknown[] => Array.isArray(value) && Object.getPrototypeOf(value) === Array.prototype;
  const own = (value: object, key: string): unknown => {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor) return undefined;
    if (!Object.hasOwn(descriptor, 'value')) return fail();
    return descriptor.value;
  };
  const safeKey = (key: string): void => { if (['__proto__', 'prototype', 'constructor'].includes(key)) fail(); };
  const addText = (value: string): void => { text += value.length; if (text > 1_048_576) throw new Error('limit'); };
  const walk = (value: unknown, depth: number): void => {
    values += 1;
    if (values > 50_000 || depth > 24) throw new Error('limit');
    if (value === null || typeof value === 'boolean') return;
    if (typeof value === 'string') { addText(value); return; }
    if (typeof value === 'number') { if (!Number.isFinite(value)) fail(); return; }
    if (typeof value !== 'object' || visiting.has(value)) return fail();
    visiting.add(value);
    try {
      if (plainArray(value)) {
        if (value.length > 10_000) throw new Error('limit');
        for (let i = 0; i < value.length; i++) walk(own(value, String(i)), depth + 1);
      } else {
        if (!plain(value)) fail();
        const keys = Object.keys(value);
        if (keys.length > 10_000) throw new Error('limit');
        for (const key of keys) {
          safeKey(key);
          const descriptor = Object.getOwnPropertyDescriptor(value, key);
          if (!descriptor || !Object.hasOwn(descriptor, 'value')) fail();
          addText(key); walk(descriptor!.value, depth + 1);
        }
      }
    } finally { visiting.delete(value); }
  };
  for (const { source } of sources) {
    if (!plain(source)) fail();
    const type = own(source, 'type');
    if (typeof type !== 'string' || !/^[a-z][a-z0-9-]{0,63}$/u.test(type)) fail();
    const data = own(source, 'data');
    const envelope = plain(data) && (own(data, 'type') === 'FeatureCollection' && plainArray(own(data, 'features')) ||
      own(data, 'type') === 'Feature' && (own(data, 'geometry') === null || plain(own(data, 'geometry'))));
    if (type === 'geojson' && envelope) {
      const keys = Object.keys(source);
      if (keys.length > 10_000) throw new Error('limit');
      for (const key of keys) {
        safeKey(key); addText(key);
        const value = own(source, key);
        if (key !== 'data') walk(value, 1);
      }
      continue;
    }
    walk(source, 0);
  }
  for (const { layer } of layers) {
    if (typeof layer.type !== 'string' || !/^[a-z][a-z0-9-]{0,63}$/u.test(layer.type)) fail();
    if (layer['source'] !== undefined && typeof layer['source'] !== 'string') fail();
    walk(layer, 0);
  }
}
function canonicalId(id: string): string {
  if (!id || id !== id.trim() || id.length > 128 || ['__proto__', 'prototype', 'constructor'].includes(id))
    throw new Error('noncanonical-id');
  return id;
}

/** Compose trusted application snapshots. IDs are never rewritten. External dependencies are
 * declared explicitly; callers must refresh those inventories when their basemap changes. */
export function composeMapModules(modules: MapModules, external: {
  readonly sources: readonly string[]; readonly layers: readonly string[];
} = { sources: [], layers: [] }): LyraMapOverlays {
  const sources = MAP_MODULE_ORDER.flatMap(name => modules[name]?.sources ?? []);
  const layers = MAP_MODULE_ORDER.flatMap(name => modules[name]?.layers ?? []);
  validateDescriptors(sources, layers);
  const sourceIds = new Set(external.sources.map(canonicalId)), layerIds = new Set(external.layers.map(canonicalId));
  for (const entry of sources) {
    canonicalId(entry.id);
    if (sourceIds.has(entry.id)) throw new Error(`duplicate-source:${entry.id}`);
    sourceIds.add(entry.id);
  }
  for (const entry of layers) {
    canonicalId(entry.layer.id);
    if (layerIds.has(entry.layer.id)) throw new Error(`duplicate-layer:${entry.layer.id}`);
    layerIds.add(entry.layer.id);
  }
  for (const entry of layers) {
    const source = entry.layer['source'];
    if (typeof source === 'string') canonicalId(source);
    if (entry.before !== undefined) canonicalId(entry.before);
    if (typeof source === 'string' && !sourceIds.has(source)) throw new Error(`missing-source:${source}`);
    if (entry.before !== undefined && !layerIds.has(entry.before)) throw new Error(`missing-layer:${entry.before}`);
  }
  const before = new Map(layers.map(entry => [entry.layer.id, entry.before]));
  for (const { layer } of layers) {
    const seen = new Set<string>(); let next: string | undefined = layer.id;
    while (next !== undefined && before.has(next)) {
      if (seen.has(next)) throw new Error(`cycle:${next}`);
      seen.add(next); next = before.get(next);
    }
  }
  // The component remains responsible for native order planning and bounded descriptor admission.
  return Object.freeze({ sources: Object.freeze(sources), layers: Object.freeze(layers) });
}

/** An application controller calls this once after batching its module changes. Validation runs
 * before the sole assignment; failures leave both the map and the last successful input intact. */
export function createMapModulePublisher(assign: (overlays: LyraMapOverlays) => void) {
  let previous: MapModules | undefined;
  return (modules: MapModules): boolean => {
    if (previous && MAP_MODULE_ORDER.every(name => previous?.[name] === modules[name])) return false;
    const overlays = composeMapModules(modules);
    assign(overlays);
    previous = Object.freeze({ ...modules });
    return true;
  };
}


const publish = createMapModulePublisher(value => { mapEl.overlays = value; });
try { publish(moduleSnapshots); }
catch (error) { reportCompositionDiagnostic(error); }
```

Collect all IDs before checking dependencies so modules can reference another module's source or
`before` layer regardless of publication order. If referencing basemap IDs, explicitly supply their
current source/layer inventories to validation, check collisions with them, and refresh those
inventories when changing styles. The self-contained example needs no external inventories.
This application preflight rejects noncanonical IDs (including surrounding whitespace), duplicate IDs, missing dependencies, cycles and the same aggregate descriptor budgets before assignment. It accepts trusted plain immutable native descriptors; canvas/native-object sources need their own validated application adapter. GeoJSON envelopes retain opaque data by identity outside the descriptor walk. Native option semantics remain the selected engine's responsibility. The map repeats bounded admission and native order planning; splitting resources into modules does not raise its limits.

A publisher can retain the last successful module references and skip publication when all eight
references are unchanged. Publish a fresh module snapshot on each change, then compose and make
exactly one assignment for the batch. Only update that reference cache after successful composition
and assignment. Duplicate IDs or missing dependencies reject the whole composition with a stable
application diagnostic; the last assigned aggregate remains intact. Remove a module by omitting its
snapshot, and resolve any dependent descriptors in the same batch. Unrelated module snapshots,
descriptors and GeoJSON retain their identity. Composition does not replace the map's native
lifecycle: resources replay after style changes, clicks keep `hit.origin === 'overlay'` and their
`sourceId`, and `setFeatureState({ origin: 'overlay', source: sourceId, id }, patch)` keeps the normal
identity and retirement rules described below. The story demonstrates style replay, attributed
selection, a module update/removal and a rejected conflicting module.

`images: readonly LyraMapImage[] = []` registers bounded image descriptors (`id`, `source`,
`width`, `height`, `pixelRatio`, `sdf?`), with SVG markup or a safe URL as the source: up to 1,024
images within an aggregate budget of 16,777,216 backing pixels and 8 MiB of encoded input, so a
sprite catalog fits. `sdf: true` registers a signed-distance-field image that `icon-color` and
`icon-halo-color` recolor. Reassigning `images` adds, replaces and removes images in place, without
removing or re-adding the layers that use them. These resources are restored after style
replacement; keep IDs distinct from basemap and generated resources.

`imageProvider?: LyraMapImageProvider` (attribute: false) supplies images on demand:
`(id) => LyraMapImage | null | undefined` (or a promise of one), called through the engine's
missing-image hook for an image ID a layer needs that neither `images` nor the basemap sprite has.
Return a descriptor with the same `id`; it is sanitized and rasterized like an `images` entry and
shares their count and pixel budget. A declined, invalid, failing or over-budget image stays missing
(development-mode warning) without failing the map. Each ID is asked once per provider and its
pixels are re-added after a style swap; an ID later assigned through `images` is handed over to it,
and replacing or clearing the provider removes what it supplied. The engine waits for the provider
before laying out the symbols that need it, so `whenIdle()` covers it.

```js
mapEl.imageProvider = async (id) => id.startsWith('poi-')
  ? { id, source: { kind: 'url', url: `/sprites/${id}.svg` }, width: 32, height: 32, pixelRatio: 2 }
  : undefined;
```

`styleOverrides: readonly LyraMapStyleOverride[] = []` applies `paint` and `layout` records by `layerId` to existing unowned style layers. Reassign fresh
descriptors to change desired state; unsupported or conflicting resources fail closed.

An override can also set `before: 'layer-or-group-id'` to move its matched basemap layers below a
native layer or public overlay group, or `before: null` to move them above all other layers.
Omitting `before` leaves placement unowned; removing it restores the original position relative to
surviving unowned successors. Active managed placement takes precedence. This uses native moves
only, without copying sources or recreating layers.
Selector matches move as one group in their original style order; explicit-id and earlier-selector
precedence applies to the entire entry, including placement. A concrete member used as an anchor
names its whole managed group. Missing anchors append with a dev-mode warning; self-anchors,
identity conflicts and cycles across basemap and owned groups reject before resource mutation.
Ordering-enabled overrides share the 128-group and 4,096-total-layer limits with owned overlays;
the existing 64-entry and 1,024-selector-match limits still apply.

A basemap subject absent from the current style is deferred, including its paint/layout overrides,
without failing readiness. Later reconciliation or style loading retries it, so one stable binding
can name alternative provider layer IDs without clearing and rebinding around a style change.
Observed absence discards the former restoration baseline. Owned subjects, invalid input, peer
errors and ordering cycles still fail.

Unrelated layers keep their relative order. Changing `before` retains the restoration baseline;
an observed external relocation updates it while the explicit placement remains authoritative.
An external relocation observed before the next reconciliation or just before removal wins over
the former baseline. During owned-resource reconciliation, changes solely relative to owned IDs
cannot be distinguished from controlled removal/recreation: controlled placement takes precedence,
while changes across surviving unowned basemap IDs can still establish a new baseline. A new style
captures a new baseline, and observed missing layers lose their old baseline. As with paint
overrides, an external remove-and-recreate under the same ID without an observable absence needs a new style generation
to distinguish the replacement. Basemap overrides cannot move generated or registered layers:
use those layers' own `before` field.

```js
map.styleOverrides = [{ sourceLayer: 'boundary', layerType: 'line', before: null }];
// Release placement ownership and restore surviving original positions.
map.styleOverrides = [];
```

An overlay layer's `source` may name a source of the basemap style itself rather than one of
`overlays.sources`, for example a vector tile source plus its `source-layer`, so you can add a
highlight or a restyled copy of basemap features without registering the source twice; the layer is
restored after every style swap whose new style still defines that source. Color-valued `paint`
strings in overlay layers and `styleOverrides` may be theme tokens (`var(--brand)`), `currentColor`
or CSS color functions (`oklch()`, `color-mix()`, `light-dark()`, …), also inside expressions. They
resolve against the host, convert to sRGB (engines parse only sRGB notations) and re-resolve when an
ancestor theme, class, style or color scheme changes; an unresolvable token fails closed like any
other invalid resource.

```js
map.overlays = {
  layers: [{ layer: { id: 'poi-highlight', type: 'circle', source: 'openmaptiles', 'source-layer': 'poi',
    paint: { 'circle-color': 'var(--lr-color-brand)', 'circle-radius': 6 } } }],
};
```

**Basemap selectors and the style catalog:** an `interactiveBasemapLayers` or `styleOverrides`
entry names one layer by `layerId`, or selects every layer of the current style whose `source`,
`sourceLayer` and `layerType` match the fields it gives (`LyraMapStyleLayerSelector`), for example
`{ sourceLayer: 'poi', layerType: 'symbol', paint: { 'icon-opacity': 0.4 } }`. An explicit id wins
over a selector and an earlier selector over a later one; an entry with both an id and a selector,
or with an empty selector, fails closed. Selectors re-match after each style swap, and a selector
may expand to at most 1,024 overridden layers. The read-only `styleLayers`
(`{ id, type, source?, sourceLayer? }[]`, at most 4,096) and `styleSources` (`{ id, type }[]`, at
most 1,024) list what the current `mapStyle` loaded, before the element added its own resources.
Both are frozen, empty until the style has loaded and replaced on every style swap; read them after
`lr-map-style-load` or `whenStyleReady()`.

`LyraMapDataLayer` includes GeoJSON and explicitly discriminated `vector`, `raster`, `image`, and
`canvas` descriptors. Tile descriptors use `source`; vector descriptors also require `sourceLayer`
and `render`. Image descriptors use `url` and canvas descriptors retain an `HTMLCanvasElement`;
both require four `coordinates` ordered top-left, top-right, bottom-right, bottom-left. External
layers accept `before`, `minZoom`, `maxZoom`, `opacity`, and `category`. GeoJSON and vector labels
use `label: LyraMapLabelOptions` with exactly one `field` or `expression`; text needs a style with
a glyph provider. Image/canvas interaction tests the full four-corner footprint, including
transparent pixels, and reports `sourceId` without inventing feature identity or `sourceLayer`.

For a retained canvas, change `redrawRevision` (default `0`, a nonnegative safe integer) in a
fresh `dataLayers` array after drawing. With `animate: false`, this uploads the new pixels once
without replacing the source or its layers. Repeating a revision does not request another upload.
An already animated canvas keeps its animation policy. Coordinate and revision changes can be
assigned together. Missing native upload support fails through the map's resource-error path.

Image-layer `url` also accepts strict base64 PNG/JPEG/WebP data URLs and blob URLs from the
current document origin. SVG and other local formats are rejected. Local image preparation has a
1 MiB byte limit, a 2,048-pixel per-axis limit, a 4,194,304-pixel limit and a 15-second deadline.
The map owns a separately validated object URL; it never revokes the caller's blob URL. Retained
local URLs share an 8 MiB encoded-byte retention budget, including older URLs awaiting native retirement.
This local-source budget is separate from the atlas-image budget used by `images` and `imageProvider`.
Keep an input blob URL available until preparation finishes. The owned URL survives style replay
and is released after its native use retires or the map disconnects. Tile and style URLs keep
their HTTP(S)-only policy.

Paint-only data-layer and choropleth changes request one repaint per synchronous mutation batch.
Equal paint produces no repaint; camera movement is not needed to show a metric or theme change.

**Interactions:** opt in with `interactive` and optional `priority` on a data layer, choropleth or
owned overlay layer; `interactiveBasemapLayers = []` explicitly enrolls basemap layers.
`lr-map-click`, `lr-map-contextmenu`, `lr-map-feature-enter`, and `lr-map-feature-leave` report routed interaction data;
legacy `lr-map-click` and cluster payloads remain available. `pickMode = false` enables a temporary
coordinate-picking session when set to true; `lr-map-pick` also supports keyboard center selection.
`keyboardActivation = false` (attribute `keyboard-activation`) opts in to keyboard activation: while
the map canvas has focus, an unmodified, non-repeated Enter or Space activates the interactive feature
at the view center (the camera center, inside any `cameraPadding`) through the same hit query and
priority as a click there, and emits `lr-map-click` with `trigger: 'keyboard'` (pointer clicks carry no
`trigger`). An empty center still emits a click without `feature`. It does nothing in pick mode, while
drawing is armed, or while the map is disabled or inert; unset, both keys are left to the browser.
`setFeatureState(target, patch)`, `getFeatureState(target)`, and `removeFeatureState(target, key?)`
use stable source/feature IDs and an optional `origin` (`choropleth`, `data-layer`, `overlay`, or
`basemap`). Check boolean admission and retain application state across source identity changes;
the first write returns `false` while the feature-state runtime loads (see **On-demand runtimes**).
`hash = false` opts out of URL camera synchronization; use true or a distinct string key to opt in.
With `hashFormat: LyraMapHashFormat = 'named'` (attribute `hash-format`) the camera is the
`#map=zoom/lat/lng[/bearing[/pitch]]` field (or the given key); other `&`-separated tokens are
preserved. `hashFormat = 'unnamed'` with `hash = true` reads and writes the raw engine's unnamed
form, `#zoom/lat/lng[/bearing[/pitch]]`, so existing deep links keep working: the camera is the
leading token without `=`, named fields after it are kept, and a fragment of named fields only gets
the camera prepended. A string `hash` under `'unnamed'` is invalid and shows the localized hash
message. An enabled `hash` delays map construction until URL ownership has loaded, so a valid
initial hash still sets the first camera, and it takes precedence over a queued initial
`fitBounds()`/`fitToData()`. Only a valid camera in the owned field or token suppresses that fit: an
absent, unrelated (`#section`) or malformed fragment leaves the fit to run, and a malformed owned
value is left untouched (no camera is written over it) until navigation replaces it.
`controls` also supports `geolocate` and `attribution` options; geolocation errors are sanitized in
`lr-map-geolocate-error`, and out-of-bounds reports use `lr-map-geolocate-out-of-bounds`. A
successful location, which only the user's activation of the geolocate button can start, emits
`lr-map-geolocate` with frozen `LyraMapGeolocateDetail { lngLat, accuracy }` (`accuracy` in metres),
again for each position update while the control tracks the user. Use it to store the position or
to compare it against your own bounds.
`lr-map-pointer-move` (frozen `LyraMapPointerDetail { lngLat, point }`) reports the mouse position
at most once per animation frame whatever lies under it, for tooltips and coordinate read-outs, and
`lr-map-pointer-leave` (detail `null`) follows when it leaves the map. `lr-map-feature-enter`,
`lr-map-feature-leave`, `lr-map-contextmenu` and `lr-map-pick` add `feature`, the hit as a detached,
deeply frozen GeoJSON `Feature` (`LyraMapFeature`) with its `[longitude, latitude]` geometry. That
geometry is the rendered one, so a large feature may be clipped to the tiles around the pointer, and
`geometry` is `null` above 100,000 coordinate values.

**Drawing:** `drawMode: LyraMapDrawingMode = 'none'` arms `line` or `polygon` drawing. The
controls render as soon as a mode is armed; the session starts once the drawing runtime has loaded
and the style is ready, and `whenIdle()` covers that load. Pointer
vertices and the keyboard center/undo/finish/cancel controls share one temporary session.
`undoDrawing()`, `completeDrawing()`, and `cancelDrawing()` return boolean admission.
`lr-map-draw-start`, `lr-map-draw-change`, `lr-map-draw-complete`, and `lr-map-draw-cancel` carry
immutable `LyraMapDrawingSnapshot` data (cancel adds a reason). Completion supplies geometry and
metrics: length in metres, area in square metres, and a geographic centroid. The 512-vertex cap
and simple-geometry, polar and antimeridian validation reject unsupported shapes. Persist the
completed snapshot in application state: temporary drawing resources are not a durable layer.
`editDrawing(snapshot)` explicitly starts editing a completed snapshot; completion does not
implicitly reopen it. Before the drawing runtime has loaded it returns `false` without reading the
snapshot and starts the load; await `whenIdle()` and call it again. Keyboard vertex handles and
pointer edits update the same session.
Use `whenIdle()` to await temporary rendering work.

While drawing, a dashed rubber band runs from the last vertex to the pointer (and, for a polygon,
on to the first vertex). A press within 12 CSS pixels of a polygon's first vertex, once it has three
vertices, completes it as clicking near the start does in common drawing tools. While the map
canvas has focus, Enter completes the drawing (or an edit) and Backspace removes the last vertex;
the canvas advertises them through `aria-keyshortcuts`, and the visible buttons remain the
discoverable path. A drawing or edit session survives a `mapStyle` swap: its temporary resources are
rebuilt on the new style and a captured vertex drag is released (the `style-change` cancel reason is
no longer reported). `lr-map-draw-change` fires for every intermediate drag position, so recompute
derived state on `lr-map-draw-vertex-end` (`LyraMapDrawingVertexEndDetail`, the snapshot plus the
moved vertex `index`), fired once when a drag that moved the vertex is released and after each
keyboard vertex move. Setting `drawingMeasurements` to `true` (attribute `drawing-measurements`;
default `false`) shows
localized, decorative on-map labels (`drawing-measurement`, with `data-kind` `segment`, `closing`,
`area` or `length`): every segment length, a polygon's closing segment and its area at the centroid,
and a line's total length; the same total is written beside the vertex count as `drawing-summary`
for assistive technology. Lengths are metres or kilometres through `Intl.NumberFormat` in the
component locale, areas `mapSquareMeters`/`mapSquareKilometers`. The temporary drawing, its rubber
band and the vertex handles use `--lr-map-drawing-color` (default: the brand accent), re-read after
a theme change.

**Anchored content:** `anchorLngLat` is the sole declarative open request for the `anchor` slot.
Its first coordinate loads anchor placement; placement, already asynchronous, follows that load.
`anchorBoundary?: LyraMapAnchorBoundary` accepts connected same-document elements (one element or
a dense array of at most 32). `anchorSafeArea?: LyraMapAnchorSafeArea` adds nonnegative finite
logical CSS-pixel edges (`blockStart`, `inlineEnd`, `blockEnd`, `inlineStart`); omitted edges are
zero, explicitly invalid edges fail closed. Placement intersects boundaries with the allocation
and retains its 8px padding. If the geographic target remains on the map but lies outside that
intersection, the panel shifts fully inside the available area; changing the safe area never
moves the map camera or changes `anchorLngLat`. An off-map target or collapsed allocation hides
the panel. `anchorClosable = false` leaves content passive; enabling it adds a
close button and nonmodal Escape handling. `focusAnchor()` explicitly focuses eligible visible
content synchronously; `closeAnchor()` closes a currently visible anchor. Both return booleans.
`lr-map-anchor-close` reports `api`, `close-button`, or `escape`; focus return respects ownership.
The close button is exposed as `anchor-close`.

**Multiple anchored panels:** when several panels must be open at once, each opened and closed by
its own owner, use `lr-map-anchor` children (see its section below) instead of the single `anchor`
slot. They render through the `anchors` slot, are placed exactly like the slot anchor, and use this
element's `anchorSafeArea` and `anchorBoundary` while their own `safeArea` and `boundary` are
`undefined`. The two kinds coexist: `closeAnchor()`, `focusAnchor()` and `lr-map-anchor-close`
concern only the `anchor` slot, and the slot panel joins the children's paint and Escape order only
while the map places at least one child anchor.

**Initialization and image export:** `initialization: LyraMapInitialization = 'visible'` defers
construction until visible; `idle` schedules idle construction and `eager` requests immediate
construction. `interaction` waits for the first input on the element (pointer press, touch, wheel,
key press or click) and shows the localized `initialization-activate` button over the placeholder,
so keyboard and screen-reader users can start the map; focus moves to the map canvas when the map
was started from that button. `initializationDelay?: number` (attribute `initialization-delay`,
milliseconds) also starts an `interaction` map that long after it connected; leave it unset to wait
for input only. Until then `map` is undefined and `whenStyleReady()`/`whenIdle()` wait; camera
commands and fits queue as usual. Deferred UI exposes `initialization-placeholder` and
`initialization-control`.
Static `LyraMap.preload(engine)` loads the engine without constructing a map.
`exportImage(options?: LyraMapImageExportOptions): Promise<Blob>` captures the current native
frame with `type` of `image/png` (default), `image/jpeg`, or `image/webp`. Attribution is included
by default, including admitted source credits and custom attribution; preserve required credits
when sharing an export. DOM markers, popups and slotted overlays are excluded. Export waits for
current-frame readiness; handle rejection as `LyraMapImageExportError` with a sanitized `code`.
`lr-map-export-error` carries `LyraMapImageExportErrorDetail`, never raw renderer errors. The first
call loads the export runtime; options are still admitted when the call is made, and a runtime that
cannot load rejects with `capture-failed`.

**Properties:**

- `engine: LyraMapEngine = 'modular'` — selects the optional `@aceshooting/lyra-map` companion.
  Set `engine="maplibre"` before connecting to explicitly use the full canonical `maplibre-gl`
  peer. A missing selected engine shows a localized fallback; it never selects another engine.
  Later changes take effect after disconnect/reconnect. Native compatibility includes the full
  engine payload and is a separate opt-in from the modular default.
- `center: [number, number] = [0, 0]`
- `zoom: number = 2` — `center` and `zoom` are the declarative camera. Assigning either moves the
  map without emitting anything. When the camera settles after a user gesture, `fitBounds()` or a
  camera command (`flyTo()`/`easeTo()`/`jumpTo()`), the
  element writes that camera into both and reports it through `lr-map-view-change`, so its next
  update never resets it, and a later, different assignment still moves the map. Assigning a value
  the map already shows moves nothing, so echoing a reported camera back, however late, never stops
  an animation or gesture. An assignment that does interrupt one (a fit still animating, a
  gesture's inertia) applies the whole declared camera, `center` and `zoom` alike, so the axis you
  did not assign is not left wherever the interrupted movement stopped; with nothing in flight,
  only the assigned axis moves. Because both track the settled camera, a map rebuilt after a
  disconnect/reconnect opens at the last settled camera rather than the originally declared one.
  `center` is compared by value against the last value assigned: a new array holding the same two
  numbers (a parent re-render rebuilding its arrays) is not a new request, even after a gesture,
  fit or camera command, so it never pulls the map back over the user's pan. Assign a different
  value to move the map, or call `jumpTo({ center })` to re-centre on the value already assigned.
  **Behavior change:** an equal re-assignment used to re-centre the map after a pan.
- `minZoom?: number` (attribute `min-zoom`) and `maxZoom?: number` (attribute `max-zoom`) — camera
  zoom limits in `[0, 24]`, forwarded to the engine at construction and whenever they change.
  Unset keeps the engine's `[0, 22]` (`maxZoom` defaults to `minZoom` when that is above 22).
  Gestures, `zoom`, the URL `hash`, `flyTo()`/`easeTo()`/`jumpTo()`, and the `maxZoom` of
  `fitBounds()`/`fitToData()` are all clamped into them. Raising `minZoom` above the camera (or
  lowering `maxZoom` below it) moves the camera inside and writes the clamped value into `zoom`,
  without an `lr-map-view-change`. A non-finite value counts as unset; an explicit
  `minZoom > maxZoom` pair is ignored as a whole, with a development-mode warning.

  ```js
  mapEl.minZoom = 5;   // country view at most
  mapEl.maxZoom = 21;  // building level at least
  ```
- `cameraPadding?: LyraMapPadding` (attribute: false) — screen pixels (`top`, `right`, `bottom`,
  `left`; an omitted, negative or non-finite side is `0`) the camera is measured inside, applied to
  the engine persistently. Every fit (`fitBounds()`, `fitToData()`) frames inside it, and the
  `bounds` that `lr-map-view-change` and `lr-map-move` report is the visible box inside it, so a
  panel or toolbar covering part of the map does not hide what the map frames. Changing it keeps
  the geographic centre fixed, shifts the picture and is not reported as a camera change. Sides are
  physical, not logical.
- `renderWorldCopies?: boolean` (attribute: false) — forwarded to MapLibre when its map is
  constructed. Leave it unset to preserve MapLibre's own current default; set `false` before
  construction to stop repeating the world horizontally. This is a construction-time option, so a
  later change takes effect after the component is disconnected and reconnected.
- `mapStyle?: LyraMapStyleSpecification | string` (attribute: false) — required before a map is
  constructed. Object assignments are detached and recursively frozen; create and reassign a new
  style to update it. `LyraMapStyleSpecification` is the peer-neutral structural subset accepted from
  MapLibre's `StyleSpecification`, including its string or multi-sprite form. No provider or style
  is selected implicitly: an unset, empty, or whitespace-only value renders the localized
  style-required failure and makes no tile/style request. Assign a hosted vector/raster style from
  a provider whose terms fit your application, or an explicitly network-silent style for local
  geometry. `LYRA_MAP_EMPTY_STYLE` (exported from `@aceshooting/lyra-ui` and the map module) is that
  style for the common case: a frozen `{ version: 8, sources: {}, layers: [] }` with no basemap, so
  a choropleth, `dataLayers` and markers draw on a blank canvas and no tile request is made. Assign
  it as is (`map.mapStyle = LYRA_MAP_EMPTY_STYLE`); build a new style object to add to it.
- `legendGradient: readonly (readonly [number, string])[] = []` (attribute: false, type
  `LyraMapLegendGradientStop[]`) — renders the legend as a **continuous** gradient bar with endpoint
  captions instead of (or alongside) the discrete `legend` swatches, which is the standard key for a
  choropleth whose `interpolate` fill is itself a continuous ramp. Takes the same `[value, color]`
  stop shape as `choropleth.stops`, so the usual assignment is `map.legendGradient =
  myChoropleth.stops` and the key cannot drift from the layer it describes. Stops are sorted
  ascending, bounded to 64, and filtered to finite values carrying a CSS-parsable color; fewer than
  two usable stops render no bar at all, since a one-stop "gradient" is a flat block that describes
  nothing. Each stop sits at its true proportion of the value range, so the bar shows the ramp the
  expression actually produces rather than evenly spacing unevenly-spaced values. A logarithmic
  choropleth renders bounded samples of the same exponential interpolation in the gradient rather
  than showing a misleading CSS-linear ramp. In development, independently authored
  `legendGradient` and `choropleth.stops` arrays that disagree produce a once-per-page warning;
  assigning the same stops (or deriving both from one source) avoids drift. Part names
  (`legend-gradient`, `legend-lo`, `legend-hi`) mirror `lr-heatmap`'s gradient legend, and the bar
  is `aria-hidden`/`inert` with the captions carrying the meaning. Mirrors under RTL
- `legendGradientLoLabel: string | null = null` (attribute `legend-gradient-lo-label`),
  `legendGradientHiLabel: string | null = null` (attribute `legend-gradient-hi-label`) — override
  the endpoint captions, which otherwise default to the lowest/highest stop value in the component's
  own locale-aware numeric formatting
- `legendGradientTicks: readonly (number | LyraMapLegendGradientTick)[]` (attribute: false; the
  getter returns the frozen `LyraMapLegendGradientTick { value: number; label?: string }` list) —
  labelled marks under the `legendGradient` bar, each at its value's true position on the ramp
  (the bar and its marks share one track, so a logarithmic ramp keeps them at the data positions).
  A bare number is a mark labelled with the locale-formatted value; a `label` is caller data and is
  rendered verbatim. At most 16 marks are kept, sorted ascending and de-duplicated; a mark outside
  the ramp's lowest and highest stop, or a non-finite one, is not drawn, and without a gradient
  there is nothing to mark. Marks are positioned from the inline start, so they mirror with the
  flipped bar under RTL. Parts `legend-ticks` and `legend-tick`.
- `choroplethLegend: boolean = false` (attribute `choropleth-legend`, reflected) — derives the key
  from `choropleth` instead of a hand-built copy that can drift. A `'step'` ramp renders one swatch
  row per band in `legend-derived`: `< 20`, `20 – 50`, `≥ 50` (numbers formatted for
  `effectiveLocale`, each range wrapped in bidi isolates so it keeps its order in a right-to-left
  legend); an explicit `stepBaseColor` becomes its own `< first` band, otherwise the first band
  absorbs the values below the first threshold exactly as the fill does, and a lone stop without a
  base colour describes nothing so it adds no band. A `'linear'` or `'logarithmic'` ramp renders the
  gradient bar from `choropleth.stops` (a logarithmic one sampled as the fill is) with the interior
  stop values as ticks, because a continuous ramp has no bands to list. When `choropleth.noData`
  is set, a hatched swatch (`data-pattern="diagonal"`, the non-colour cue) captioned with its
  `label`, or the localized "No data", ends the derived rows. Authored input wins where it overlaps:
  a non-empty `legendGradient` replaces the derived bar, an assigned `legendGradientTicks` (even
  `[]`) replaces the derived ticks, and `legend` rows render ahead of the derived rows. Derived rows
  are not interactive. Default off, so an unset map renders what it rendered before.
- `legend: readonly LyraMapLegendEntry[] = []` (attribute: false) — immutable defensive snapshots
  of `LyraMapLegendEntry { readonly color: string; readonly label: string; readonly pattern:
LyraMapLegendPattern }`, where `LyraMapLegendPattern` is `'solid' | 'diagonal' | 'dots' |
'crosshatch'`. Pattern supplies the non-color cue for rows without an icon; an icon row uses its
glyph shape as that cue. At most 100 valid
  rows, 256 characters per label, and 8,192 aggregate label characters are retained; colors are
  bounded before validation. The overlay scrolls within the map allocation.
  A row may also carry its own `value`: the category key that row stands for — the same string a
  `point.colors`/`point.icons` entry matches against `point.field`/`point.iconField`. It is
  trimmed, bounded to 256 characters (sliced, never ellipsized, so a bounded key still matches) and
  **retained** in the canonical readback; a non-string, empty or whitespace-only key leaves no
  `value` property on the frozen row at all. It is what makes a row operable under
  `legendInteractive`, and it does not count toward the label budget.
  A row may also carry `icon`, deliberately the same record a `point.icons` entry uses — hand the
  legend the very icon object its point layer renders and the key shows the symbol drawn on the
  map instead of describing it in colour alone. The **icon record's own** `value` is a separate
  field from the row-level one above: it is accepted so a pass-through needs no reshaping, and it
  is still left out of the canonical readback. A row's key is never derived from its glyph's, which
  would silently make a row interactive that the author never marked;
  `path`, `viewBox`, `mode`, `strokeWidth`, `lineCap` and `lineJoin` keep their point-icon meaning
  and their point-icon defaults, and the same validation applies (path data only, at most 8,192
  characters, positive `viewBox` dimensions). An unusable record is dropped and that row keeps
  rendering its colour swatch, exactly as a row that supplies no `icon` does.
  A row may finally carry a `group`: the section it belongs to, for a key that describes two
  layers at once and otherwise could not say which rows belong to which. The rule is pinned
  rather than inferred: **consecutive** entries sharing an identical `group` render as one section
  — a visible heading plus a `role="group"` that heading names — an entry with **no** `group`
  keeps its **declared** position rather than being hoisted above or sunk below a section, and a
  `group` that reappears after an interruption opens a *second* section rather than reordering
  rows to merge them. Declaration order is the one thing the legend never rewrites, because the
  order is itself information about the map. `group` is caller-supplied **data**: it renders
  verbatim and is never resolved through the locale catalogue. It is trimmed and bounded to 256
  characters (ellipsized, since it is rendered prose rather than a key matched against
  `point.field`); a non-string, empty or whitespace-only value leaves no `group` property on the
  frozen row at all, so an empty string means "ungrouped" instead of an empty heading. Like the
  row-level `value`, it does not count toward the aggregate label budget — the rendered total is
  already finite and stated: at most one heading per rendered row, so at most 100 of them. A
  section is not a row: the 100-row cap and the `legend-limit` summary count rows, never sections.
- readonly `legendProjection: LyraMapLegendProjection` — frozen `{ inputCount, renderedCount,
omittedCount, truncatedLabelCount, truncated }` result for the latest assignment. A truncated
  projection renders a localized visible `1–N of M items` summary rather than silently claiming
  the bounded rows are complete.
- `legendInteractive: boolean = false` (attribute `legend-interactive`, reflected) — opt-in: turns
  every legend row that carries a `value` into a keyboard-operable visibility toggle, and leaves a
  row without one inert. Unset, the legend renders exactly the read-only key it rendered before —
  no `button`, no extra attribute, and no extra MapLibre paint key. Each toggle is an independently
  tabbable native `button`, so Enter and Space are the platform's own activation and there is no
  roving tabindex: a 100-row interactive legend contributes 100 tab stops, exactly as a 100-series
  `lr-chart` legend does. Each interactive row also grows to the shared `--lr-icon-button-size`
  hit-area floor (WCAG 2.5.8), which the panel's existing `max-block-size` and scrolling contain.
- `legendControlRole: 'button' | 'checkbox' = 'button'` (attribute `legend-control-role`,
  reflected) — how each `legendInteractive` row's toggle presents itself to assistive tech; inert
  while `legendInteractive` is unset, exactly like the toggle itself. `'button'` is byte-identical
  to every legend rendered before this property existed: `<button aria-pressed>`. `'checkbox'`
  renders the SAME `<button>` element with its implicit role overridden to `role="checkbox"` and
  `aria-checked` in place of `aria-pressed` — the swatch, the label, the click handler and the
  platform's own Enter/Space activation are unchanged, so `hiddenCategories`, the cancelable
  `lr-map-legend-toggle-request` veto, `group` sections and `legendCollapsible` all compose with either
  role. `aria-checked` tracks the same visibility flag `aria-pressed` does, inverted from
  `hiddenCategories`: a hidden category renders `aria-checked="false"`. Prefer `'checkbox'` when the
  legend reads as a checklist of independent show/hide toggles; prefer the `'button'` default when
  it reads as a set of filtering actions. An unsupported value normalizes back to `'button'`.
- `legendCollapsible: boolean = false` (attribute `legend-collapsible`, reflected) — opt-in: renders
  a `legend-disclosure` `button` inside the panel that collapses the key down to its header, so a
  large legend stops permanently covering part of the map. Unset, the panel renders exactly what it
  rendered before — no button, no `id` minted on the row list, and no `hidden` attribute anywhere.
  Collapsing hides the gradient bar, the rows, the `legend-limit` summary and the trailing `legend`
  slot; the `legend-start` slot and the disclosure itself stay visible, so a slotted header survives
  the collapse and the control that restores the key is never what the collapse hides.
- `legendOpen: boolean = true` (attribute `legend-open`, reflected) — whether a `legendCollapsible`
  panel is expanded. It defaults **open**, so adding only `legendCollapsible` never hides an existing
  key, and it does nothing at all while `legendCollapsible` is unset. Because it is a
  `true`-defaulting boolean it uses a custom attribute converter, so `legend-open="false"` parses —
  the bare presence-based boolean form cannot express `false` at all — and the reflection follows the
  same converter: open (the default) reflects as an **absent** attribute and collapsed reflects as
  `legend-open="false"`. It is controlled public state and survives a disconnect/reconnect. Assigning
  it programmatically reconciles the rendered panel and emits nothing.
- `hiddenCategories: readonly string[] = []` (attribute: false) — the complete controlled set of
  muted category keys, mirroring `lr-chart`'s `hiddenDatasets`. Clone-owned and frozen; non-string,
  empty, whitespace-only and duplicate entries are dropped (first occurrence wins, matching
  `point.colors`), and at most 100 keys are retained. Honoured on the **first** render and the
  first MapLibre paint, not only after a user toggle, so a host can restore a saved selection. An
  empty array deliberately means every category is visible. It is controlled public state and
  survives a disconnect/reconnect. A hidden key that matches no category is harmless. Assigning it
  programmatically emits nothing.
- `choropleth?: LyraMapChoroplethLayer` (attribute: false) — `LyraMapChoroplethLayer { sourceId:
string; geojson: GeoJSON.FeatureCollection; field: string; stops: [number, string][]; interpolation?:
'linear' | 'logarithmic' | 'step'; stepBaseColor?: string }` (interpolated
  fill-color expression from `field`'s value against `stops`; `stops` must contain at least one
  `[value, color]` pair — an empty array is ignored, leaving whatever fill layer already exists, if
  any, untouched, rather than being applied).
  `interpolation` (type `LyraMapChoroplethInterpolation`, default `'linear'`) chooses how the colour
  is interpolated between stops. `'logarithmic'` compresses the ramp, which is what a heavy-tailed
  quantity — price, population, income — needs: on a linear ramp every value below the maximum falls
  into the first colour band, so the map reads as one flat colour plus a couple of outliers. It
  emits maplibre's own `['interpolate', ['exponential', 0.25], …]`, exposing an existing capability
  rather than adding one (maplibre has no `['log']` interpolation type; a sub-1 exponential base is
  the documented way to weight a ramp toward the low end). **`stops` stay in the data's own units
  under either mode**, so the legend keeps reading in real values instead of log units — no
  pre-transforming to log10 and hand-relabelling the legend back.
  `'step'` emits maplibre's `['step', …]` instead of `['interpolate', …]`, giving
  **discrete bands rather than a continuous ramp**. Use it whenever the legend advertises a fixed
  set of ranges with one swatch each: a ramp would put colours on the map that appear nowhere in the
  legend, and would render two regions in the same advertised band as visibly different colours
  (`legendGradient` covers the opposite case, a gradient legend). `stepBaseColor` is the colour for
  values below the first threshold, which `['step', …]` requires; it defaults to the first stop's own
  colour, so a legend whose first band starts at the data minimum needs no extra configuration.
  Stop colors and `stepBaseColor` accept CSS custom-property references; Lyra resolves them from
  the live host cascade before passing the expression to MapLibre's WebGL renderer.
  `noData?: LyraMapChoroplethNoData { color?: string; strokeColor?: string; label?: string }`
  says how features without a usable value look and read, instead of splitting the data into a
  second layer. A feature has no value when its `field` property is missing, `null` or not a number;
  without `noData` such a feature is not painted by the choropleth at all (the expression cannot
  evaluate). With it, `fill-color` becomes `['case', <is a number>, <ramp>, <noData color>]` under
  every interpolation, `color` defaults to the neutral data tone and takes the same CSS colours and
  `var(--lr-…)` references as `stops`, and the colour follows live theme changes. `strokeColor`
  adds an outline drawn on no-data features only (other features keep the default outline, their own
  fill colour); omitted, nothing distinct is drawn. `label` is caller data, trimmed and bounded to
  256 characters, shown verbatim as the legend caption under `choroplethLegend` (default: the
  localized "No data"). `noData: {}` accepts every default. A click on such a feature reports
  `noData: true` in the `lr-map-click` detail.
- `markers: LyraMapMarker[] = []` (attribute: false) — `LyraMapMarker { id?: string; lngLat:
[number, number]; color?: string; label?: string; unsafeHtml?: string }`; an explicit `id` is
  trimmed and must be nonempty, and the first successfully admitted marker for an explicit ID wins.
  Only the first 2,000 authored entries are inspected; `markersTruncated` reports an omitted
  suffix. Use clustered `dataLayers` for larger point collections. A malformed earlier row does
  not reserve that ID. Markers are reconciled
  by that explicit ID (falling back
  to a `lng,lat` key, disambiguated by occurrence order for duplicate-coordinate id-less markers,
  when `id` is omitted) so an unchanged marker isn't torn down and recreated on every `markers`
  reassignment — its `lngLat` **and** its popup content (`unsafeHtml`/`label`, in that precedence)
  are both updated in place, and the popup is removed if a later update sets neither. `unsafeHtml` is
  rendered via `Popup.setHTML()` — **raw markup, inline event handlers included** — only pass trusted
  content, sanitize anything derived from user input first; prefer `label` (`Popup.setText()`,
  escaped) when the content is plain text. For marker/popup naming, visible text is extracted from
  trusted markup while `script`, `style`, `template`, `[hidden]`, and `aria-hidden="true"` subtrees
  are excluded; an explicitly supplied `label` remains the more predictable accessible name. A
  marker whose authored `color` changes for a persisting `id`
  can't be recolored in place (no `Marker.setColor()`) and is torn down/reconstructed instead — see
  gotchas. Entries with non-finite coordinates, latitude outside `[-90, 90]`, or a runtime
  non-string `label` are skipped without aborting valid siblings. `color` is used only when the
  browser accepts it as CSS `color`;
  declaration breaks and `url()` paint servers fall back to the default color. Without an authored
  color, markers follow `--lr-color-brand` through CSS `currentColor`; rethemes preserve marker and
  popup identity, including an open popup. Explicit authored color changes still reconstruct markers.
  Every retained marker is a named `role="button"` tab stop, including one without a popup. Click,
  Enter, and Space emit `lr-map-marker-activate`; Space suppresses its page-scroll default while
  preserving MapLibre's popup toggle. A popup-bearing marker additionally exposes
  `aria-haspopup="dialog"`, `aria-controls`, and explicit `aria-expanded`.
- `dataLayers: readonly LyraMapDataLayer[] = []` (attribute: false) accepts GeoJSON, vector,
  raster, image and canvas entries. The external-source forms are described under
  **Readiness and declarative resources** above. The GeoJSON form is
  `LyraMapGeoJsonDataLayer { sourceId: string; geojson: GeoJSON.Feature |
GeoJSON.FeatureCollection; tone?: 'accent' | 'success' | 'warning' |
'danger' | 'neutral'; color?: string; strokeColor?: string; line?: LyraMapLineOptions;
point?: LyraMapPointOptions; kind?: LyraMapDataLayerKind;
heatmap?: LyraMapHeatmapOptions; cluster?: LyraMapClusterOptions }`. `sourceId` is trimmed and must be nonempty; the first layer for a
  `sourceId` that is successfully admitted wins. Only the first 100 entries are inspected; blank,
  malformed, and later duplicate records are
  ignored without reserving an identity for a valid later sibling. Each retained GeoJSON entry adds one
  GeoJSON source plus three geometry-filtered layers
  (fill, line, and circle, so a mixed `FeatureCollection` renders correctly), colored from the
  matching `--lr-color-*` token (`tone` defaults to `'accent'` → `--lr-color-brand`).
  `color` and `strokeColor` (both new in 11.0.0) override that per surface — `color` paints the
  polygon fill, `strokeColor` the line and circle layers, falling back to `color` and then to `tone`.
  They are separable because a fill and its outline want opposite things on a
  choropleth-plus-overlay map, and the difference is measurable rather than aesthetic: the fill
  competes for area with the choropleth beside it and has to sit quiet, while the 1px outline
  competes with nothing and is the only thing keeping a no-data region's shape readable once the
  fill is that faint. Deriving one from the other measured 1.41:1 against a light basemap — under
  WCAG 1.4.11's 3:1 floor for graphical objects. A `var(--lr-…)` reference is resolved against the
  host before it reaches MapLibre, which paints to a WebGL canvas and never sees the CSS cascade.
  Data-layer, choropleth, cluster, and heatmap paint colors also accept modern CSS color functions
  such as `color()`, `oklch()`, and `color-mix()`; Lyra resolves them to MapLibre-compatible sRGB
  on application and theme repaint. An invalid explicit color falls back to the layer tone.
  The component
  assigns collision-free private MapLibre ids for those resources: `sourceId` is the stable
  declarative reconciliation key, **not** an id to retrieve from `map`. This prevents a data layer
  from overwriting or removing a same-named source supplied by `mapStyle`. Independent of
  `choropleth` — no `field`/`stops` color-interpolation, just the geometry rendered in a flat tone;
  use `choropleth` instead when you need a data-driven color ramp. An entry whose `sourceId`
  persists across a `dataLayers` reassignment gets its GeoJSON updated in place (`updateData()`
  when stable feature IDs make a safe diff possible, otherwise `setData()`), one that's dropped has
  its private source/layers removed, and a genuinely new `sourceId` gets new resources — nothing
  leaks on removal, style change, or disconnect.

  The component snapshots the configuration it reads. It passes `choropleth.geojson` and
  `dataLayers[].geojson` through to MapLibre; assign a new `choropleth`, `dataLayers`, or `markers`
  value after changing configuration, because mutating an assigned value is not observed.
  For an in-place change to pass-through GeoJSON, call `requestUpdate()` explicitly to refresh its
  comparison snapshot. This refresh still applies when coalesced with a named presentation update.
  Changed geometry or bounding boxes replace the peer source data. For comparable feature
  collections, unchanged snapshots avoid a redundant write; eligible property-only changes keep
  the incremental update path. A refreshed standalone feature or over-limit collection uses a
  full replacement even when its data is unchanged.

  `cluster` and `kind` (both new in 12.0.0) opt one entry out of that three-layer geometry split.
  **Both are strictly additive: an entry that sets neither renders exactly what it rendered before,
  down to the layer ids and the point layer's filter.**

  `cluster?: LyraMapClusterOptions { radius?: number; maxZoom?: number; radiusSteps?: [number,
number][]; colorSteps?: [number, string][]; strokeColor?: string; countFont?: string[]; countColor?: string;
countHaloColor?: string; countHaloWidth?: number; zoomOnClick?: boolean }` turns the entry's source into a
  natively clustered one — `cluster`/`clusterRadius` (default 50)/`clusterMaxZoom` (default 14) on
  the source, plus a `${sourceId}-cluster` circle filtered on `has('point_count')`, a
  `${sourceId}-cluster-count` label, and a `${sourceId}-circle` layer for the points that stayed
  unclustered. `cluster: {}` opts in at every default. This is what a thousands-of-points map needs
  and what `markers` cannot be: `markers` mints one real, individually focusable DOM element per
  entry, which is right for tens of pins and both unreadable and expensive for thousands.
  `radiusSteps` and `colorSteps` are `['step', …]` breaks keyed on `point_count`, in the same
  ascending `[value, output]` vocabulary as `choropleth.stops` — including the same base rule, where
  the first entry's own output covers everything below the first threshold, and the same colour
  resolution, where a `var(--lr-…)` reference in a `colorSteps` entry is resolved against the host
  before it reaches MapLibre (which paints to a WebGL canvas and never sees the CSS cascade), so a
  retheme moves the cluster breaks with everything else. No fill or line layer is created for a
  clustered entry, because MapLibre's clustering keeps point features only. The cluster's optional
  `strokeColor` overrides only the aggregate circle outline; omitted, invalid,
  or removed values use the entry's `strokeColor`, then `color`, then `tone`. Individual points keep
  the entry's own paint. The override accepts CSS colors and live host token references and updates
  without rebuilding a retained clustered source. The count label needs glyphs: a style that
  declares none gets the graduated circles without the numbers
  (adding a text layer against a glyph-less style paints nothing and only emits peer errors), and
  `countFont` names the font stack when your style's glyph source lacks MapLibre's spec default.
  `countColor` overrides the on-tone label foreground, which is useful when `colorSteps` mixes light
  and dark circles. `countHaloColor` adds an outline for contrast; `countHaloWidth` defaults to 1
  CSS pixel with a halo color and is bounded to 0–3 (one quarter of the 12px label size). An
  explicit width of 0 disables the outline. Both count colors accept CSS colors or `var(--lr-…)`
  references resolved against the host on theme repaint. Omitting or removing these options
  restores the previous on-tone label and halo-free default.
  `zoomOnClick` (default `false`) eases the camera into a clicked cluster: after `lr-map-click`
  fires with `origin: 'cluster'`, the element asks the cluster's source for the zoom at which it
  breaks apart (promise or callback peers both work) and calls `easeTo({ center: <cluster>, zoom })`,
  so reduced motion, the write-back into `center`/`zoom` and `lr-map-view-change` with
  `source: 'command'` all apply, and the zoom is clamped to the camera range. A later cluster click
  supersedes an earlier lookup still pending; a peer without the lookup, or a cluster that has
  vanished, leaves the camera alone. It is not cancelable from the click event.
  Cluster options are baked into the source at creation time by MapLibre and have no setter, so
  changing them (or `kind`) rebuilds that one entry's source and layers; every other update still
  reconciles in place.

  `kind?: 'auto' | 'heatmap'` (`LyraMapDataLayerKind`, default `'auto'` — today's geometry split)
  renders the source as MapLibre's own first-class `heatmap` layer instead, which the geometry split
  cannot express at all: thousands of overlapping circles read as one opaque blob rather than as
  where the data is concentrated. `heatmap?: LyraMapHeatmapOptions { weightField?: string;
weightRange?: [number, number]; stops?: [number, string][]; radius?: LyraMapHeatmapZoomValue;
intensity?: LyraMapHeatmapZoomValue; opacity?: number }`, where `LyraMapHeatmapZoomValue` is a
  scalar number or bounded `[zoom, value][]` stops,
  configures it. `weightField` weights each point by a feature property, and `weightRange` maps that
  property's own units onto the 0–1 weight MapLibre expects — without it the raw value is passed
  through, which saturates the surface for any quantity above ~1; with neither, every point weighs 1.
  `stops` are `[density, color]` pairs with density in `[0, 1]`, **the same `[value, color]`
  vocabulary `choropleth.stops` and `legendGradient` already share**, so a `legendGradient` bar can
  describe the ramp without a second copy of it, and `var(--lr-…)` stops resolve against the host the
  same way `color`/`strokeColor` do. A ramp that doesn't start at density 0 gets a fully transparent
  stop prepended, because a coloured zero tints the entire map — so **a single stop is already a
  complete ramp**, as long as it sits above density 0: `stops: [[1, '#ff0000']]` is exactly
  transparent → red. The one authored ramp that can't be honoured is a lone stop AT density 0, which
  describes a flat colour rather than a gradient; that one — like an unset or wholly unusable
  `stops` — falls back to the built-in ramp, which runs transparent → `--lr-color-brand` →
  `--lr-color-success` → `--lr-color-warning` → `--lr-color-danger`, so a retheme moves the density
  surface with everything else. Scalar `radius` (default 30) and `intensity` (default 1) preserve
  their established behavior. Two or more usable `[zoom, value]` stops emit linear zoom
  interpolation; stops are sorted, duplicate zooms removed, zoom clamped into `[0, 24]`, radius
  into `[1, 200]`, and intensity into `[0, 100]`. One usable stop becomes a scalar and an unusable
  array falls back to the existing default. `opacity` is clamped into `[0, 1]`; omission leaves the
  peer's default untouched on construction, and dropping a previously-authored value restores 1.
  `cluster` is ignored on a heatmap entry: a heatmap already aggregates density, and clustering its
  input would feed it one point per cluster instead of the real distribution.
  `line?: LyraMapLineOptions { field?: string; stops?: readonly (readonly [number, string])[];
  width?: number; opacity?: number }` configures line/outline paint for an ordinary `dataLayers`
  entry. `field` names a numeric feature property; two usable `[value, color]` stops produce a
  continuous linear ramp. Missing, null, and non-numeric feature values use `strokeColor`, then
  `color`, then `tone`. Stops inspect the first 64 entries, discard non-finite values and invalid
  CSS colors, sort ascending, and retain the first duplicate threshold. Fewer than two stops or
  an absent field preserves flat color. Values beyond the endpoints clamp to their endpoint color.
  CSS variables resolve on the host during reconciliation and retheming. `width` defaults to 2 CSS
  pixels and clamps to `[0, 200]`; `opacity` defaults to 1 and clamps to `[0, 1]`. Non-finite values
  restore those defaults, as does dropping a previously-authored option. Point colors and polygon
  fills are unaffected; cluster and heatmap entries ignore `line`.

  `point?: LyraMapPointOptions` styles individual points on ordinary and clustered auto entries.
  It is ignored for heatmaps. `field` names a **string** feature property; `colors` maps exact
  `[category, CSS color]` pairs. Missing, unknown and non-string categories use the existing
  `strokeColor`/`color`/`tone` fallback. The first 32 pairs are inspected and valid duplicates are
  first-wins. CSS variables resolve on the host and follow ancestor theme changes. `radius`
  defaults to 5 CSS pixels and `strokeWidth` to 0; both clamp to `[0, 200]`. `strokeColor` overrides
  the outline only, with the layer's flat color as fallback. Dropping options restores defaults.

  `radius` also accepts `LyraMapPointRadiusOptions { field, stops, interpolation?, fallback? }`
  for **numeric** feature-driven sizes. `field` is independent of the category field. The first 32
  pairs are inspected and finite `[value, radius]` pairs are sorted ascending; duplicate thresholds are first-wins and
  radii clamp to `[0, 200]`. `interpolation` defaults to `'step'`: below the first threshold use
  its radius, and each threshold is inclusive. `'linear'` interpolates between adjacent stops and
  clamps outside the domain. One usable stop is a constant for numeric features. Missing, null,
  non-numeric and non-finite feature values use `fallback` (default 5, clamped to `[0, 200]`), as
  do an empty field, unusable stops or a linear domain that cannot retain distinct finite intervals.
  Invalid interpolation values use step. These options style individual/unclustered points;
  cluster-count radii remain independent. Switching back to a number or removing the radius
  scale restores the fixed radius without recreating the source.

  `point.icons` maps exact category values to `LyraMapPointIcon { value: string; path: string;
  viewBox?: readonly [number, number, number, number]; mode?: LyraMapPointIconMode;
  strokeWidth?: number; lineCap?: LyraMapPointIconLineCap; lineJoin?: LyraMapPointIconLineJoin }`.
  `iconField` defaults to `field`. Each icon is **SVG path data**, not SVG markup or a URL. Copy an icon's path data,
  combine filled subpaths in that string, and supply its `[minX, minY, width, height]` viewBox
  (default `[0, 0, 24, 24]`). `mode` defaults to `'fill'`; `'stroke'` draws open outline paths,
  and `'fill-stroke'` paints both. `strokeWidth` uses **viewBox units** (default 2, clamped to
  `[0, 200]`; zero omits the stroke), so it scales with the icon. `lineCap` accepts `'butt'`,
  `'round'`, or `'square'`; `lineJoin` accepts `'miter'`, `'round'`, or `'bevel'`. Both default
  to round; miter joins retain a limit of 10. Invalid modes/caps/joins restore their defaults,
  and a non-finite stroke width restores 2. Keep padding inside the viewBox for strokes at its
  edges, which are clipped to the fixed atlas square. These are icon-path options;
  `point.strokeWidth` and `point.strokeColor` continue to style the surrounding circle only.
  The first 32 entries are inspected, valid duplicates are first-wins, path data is capped at
  8192 characters, and viewBox coordinates must be finite within ±10000 with dimensions at least
  0.001. Invalid paths are ignored; markup, external references and event handlers cannot execute.
  Rasterization is synchronous and local, with no fetch or HTML/SVG document insertion.
  `iconColor` supplies both fill and stroke ink, accepts CSS variables and defaults to the tone's contrasting foreground; `iconSize`
  is the displayed bounding square in CSS pixels (default 16, clamped to `[1, 200]`). The fixed
  64px raster preserves the viewBox aspect ratio. Unknown categories, invalid icons and partial
  peers lacking image-atlas methods retain their colored circles. No sprite or glyph URL is needed.

  All categories use the **same GeoJSON source** and cluster across categories. Cluster circles
  keep the existing count-based styling; only unclustered points get category colors/icons.
  An optional symbol layer and at most 32 images are allocated per configured source, with no
  per-feature DOM markers. Data changes reuse the source, retheming updates paint/icon pixels,
  and style reloads restore the owned resources. Removing the entry or icons releases its images.
  `lr-map-click` on either a point's circle or icon returns `origin: 'data-layer'`, the public
  `sourceId`, and the rendered feature. For clustered GeoJSON, use numeric feature IDs and keep
  string business IDs in feature properties, as MapLibre's cluster tiling uses numeric IDs. Canvas export includes both; supply an accessible textual
  legend/list for category interpretation and individual keyboard actions.

  ```js
  import '@aceshooting/lyra-ui/components/lr-map.js';
  map.dataLayers = [{
    sourceId: 'places', geojson: locations, cluster: {},
    point: {
      field: 'category',
      radius: { field: 'visits', stops: [[0, 10], [10, 12], [50, 14], [100, 16]], fallback: 10 },
      strokeWidth: 1,
      colors: [['home', 'var(--lr-color-brand)'], ['work', 'var(--lr-color-success)']],
      icons: [
        { value: 'home', path: 'M2 12L12 2L22 12V22H2Z' },
        { value: 'work', path: 'M8 6V3H16V6M3 6H21V21H3ZM3 11H21',
          mode: 'stroke', strokeWidth: 1.75, lineCap: 'round', lineJoin: 'round' },
      ],
      iconSize: 14,
    },
  }];
  ```

  Share the same stops with `legendGradient` and set its endpoint labels for units. A gradient
  matching a line ramp remains linear even alongside a logarithmic choropleth. Changing metric,
  filtered GeoJSON, width or opacity reconciles existing resources; style reloads restore the layer.
  Lines remain in MapLibre's canvas and can be captured with the map's normal render-event PNG
  export flow.

  ```js
  mapElement.dataLayers = [{
    sourceId: 'routes', geojson: routes,
    line: { field: 'kmh', stops: speedStops, width: 4, opacity: 0.9 }
  }];
  mapElement.legendGradient = speedStops;
  mapElement.legendGradientLoLabel = '0 km/h';
  mapElement.legendGradientHiLabel = '100 km/h';
  ```
- `maxBounds: LyraMapBounds | null = null` (attribute: false) — box the map may not pan outside,
  `[[west, south], [east, north]]`. Prefer it over calling `map.setMaxBounds()` through the `.map`
  escape hatch: constraining the camera can wedge maplibre-gl at a sub-1 fractional zoom in a wide
  container, leaving `getZoom()` returning `null` permanently, every frame throwing from inside the
  peer's own matrix math, and the canvas never painting again — a blank map, with nothing thrown at
  the call site to attribute it to. This property applies the same call, then reads the camera back.
  A camera below zoom 1, fractional zoom included, is tolerated: a box the peer rejects there is
  retried once from zoom 1 and the zoom and centre that were showing are restored, so the limit
  applies to a map that currently shows the whole world and no warning is issued. A box that still
  cannot be applied reverts (restoring zoom and centre), so the worst case is an
  unconstrained map plus a dev-mode warning. The defensive camera snapshots are inside the same
  failure boundary, so a peer whose damaged transform already throws from `getZoom()` or
  `getCenter()` is also reduced to an unconstrained map instead of leaking through Lit's update.
  A malformed box is rejected rather than clamped
- `controls?: Readonly<LyraMapControls>` (attribute: false) — `LyraMapControls { navigation?: boolean |
  LyraMapNavigationControlOptions; scale?: boolean | LyraMapScaleControlOptions;
  geolocate?: boolean | LyraMapGeolocateControlOptions;
  attribution?: boolean | LyraMapAttributionControlOptions }`, with
  `LyraMapNavigationControlOptions { position?: LyraMapControlPosition; order?: number }`,
  `LyraMapScaleControlOptions { position?: LyraMapControlPosition; order?: number; unit?: LyraMapScaleUnit }`,
  `LyraMapControlPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'` and
  `LyraMapScaleUnit = 'metric' | 'imperial'`. The element adds the engine's standard controls once
  the map exists, moves one whose corner changes, replaces one whose other options change and removes one that
  is dropped, so an application no longer imports control classes and calls `map.addControl()`.
  All control option objects accept finite `order` numbers, defaulting to `0`. Within each
  corner, ascending order controls both visual and keyboard order; ties retain the existing
  navigation, scale, geolocate, globe, terrain, attribution sequence. Changing only order moves existing controls
  without reconstructing them. Invalid order values produce localized configuration feedback.
  `true` takes the defaults (navigation `'top-right'`, scale `'bottom-left'` and `'metric'`); an
  unknown navigation/scale position or unit falls back to its default. Malformed geolocate or
  attribution options are rejected with localized feedback. The control code comes from the selected
  engine (`maplibre-gl`, or the companion's granular control entries). Requested controls load
  on demand; unavailable controls show localized feedback while the map remains usable. Geolocation
  starts only on user activation. Attribution is enabled by default; set `attribution: false` to
  disable it. Attribution options accept `position`, `compact`, `initialExpanded`, and `customAttribution` as a string,
  `LyraMapAttributionLink { readonly label: string; readonly url: string }`, or a readonly array of
  either. Labels are escaped text; links open in a new tab with `rel="noopener noreferrer"`.
  Link URLs must be absolute HTTP(S), no longer than 2,048 characters, with no credentials or
  control characters. At most 32 credits and 16 KiB of label/URL text are accepted, with each label
  limited to 4,096 characters. Admission snapshots own data properties without invoking accessors.
  An invalid item rejects the whole custom option and shows localized feedback while retaining
  provider credits. Image exports include link labels as text alongside provider credits, without
  the link URLs or markup. `initialExpanded?: boolean` sets the compact credits disclosure once, when
  the control is installed and only while the native control is compact; omit it to keep the native
  initial state. It never hides noncompact credits, and later resizing, dragging or user activation
  stay native: it is not a controlled state. Changing it replaces the control; position- or
  order-only changes keep the current user-selected state, and reconnecting applies it again. A
  malformed value is rejected like other malformed attribution options, with the default credits
  retained. `lr-map-attribution-toggle` (`LyraMapAttributionToggleDetail { expanded }`) reports each
  later settled change of the owned (or default) attribution control: synchronous native changes
  coalesce to their result, repeats are not reported, and installation, seeding, replacement and
  reconnect emit nothing. Persist `expanded` and pass it as `initialExpanded` for a later
  installation:

  ```js
  mapElement.controls = { attribution: { compact: true, initialExpanded: saved ?? false } };
  mapElement.addEventListener('lr-map-attribution-toggle', event => { saved = event.detail.expanded; });
  ```

  For example:

  ```js
  mapElement.controls = {
    navigation: { position: 'bottom-left' },
    scale: { position: 'bottom-left' },
    geolocate: { position: 'bottom-left', order: -1 },
    attribution: { position: 'bottom-left', customAttribution: [
      'Survey team', { label: 'Data contributors', url: 'https://example.com/credits' }
    ] }
  };
  ```

  Within each corner the visual and keyboard order is navigation, scale, geolocate, globe, terrain, attribution,
  including when constructors load in a different order or one fails. A subset keeps that relative
  order. Changing only a corner moves the existing controls and retains focused buttons. Corners
  continue to follow text direction under RTL. Geolocation is never activated by reconfiguration
  or reconnect.
  Button names come from `zoomIn`, `zoomOut` and `mapResetNorth`
  and are re-applied whenever `lang`, `locale` or `strings` change, so they follow a live language
  switch. Controls survive a `mapStyle` swap and are dropped with the map on disconnect, then added
  again to the next one. Parts `navigation`, `zoom-in`, `zoom-out`, `compass`, `scale`.
- `anchorLngLat?: readonly [number, number] | null` (attribute: false) — where content in the
  `anchor` slot sits. Pair it with the `lngLat` of an `lr-map-click` to show a clicked feature's
  details, replacing a hand-positioned popup. The first coordinate loads anchor placement on
  demand; the anchor stays hidden until it has been placed. See **Slots**.

**Choropleth and `dataLayers` updates are diffed before they reach the peer.** `setData()`
unconditionally re-tiles and repaints an entire source, which is invisible on a static map and
expensive on an animated one. When every feature has a unique `string`/`number` `id` and retained
features keep semantically unchanged geometry/bbox values, the component emits MapLibre's
incremental `updateData()` for property changes, additions, removals, and order changes. The exact
next order is preserved: an unchanged prefix stays in place and only the invalidated suffix is
removed and re-added. Lyra snapshots control and projection data while retaining opaque GeoJSON
identity at the MapLibre boundary. Immutable admitted geometry and bbox identities reuse their
validated comparison projections; replace those identities when their contents change. Otherwise,
a bounded, accessor-free comparison verifies the JSON geometry graph. Automatic comparison
supports at most 10,000 features, with a work budget of at least 50,000 values or 4,096 values per
feature, whichever is larger, capped at 10,000,000 values. A missing/duplicate ID, changed geometry,
exceeded bound, or uncertain
comparison falls back to `setData()` with no change in rendered behaviour. Peers without
`updateData()` always take the old path.

**Feature properties are tiled, and therefore bounded in numeric magnitude.** MapLibre GL tiles
every GeoJSON source through a worker into a protobuf vector tile, so a property carrying a huge
integer throws *inside that worker* — "Given varint doesn't fit into 10 bytes". That throw is not
catchable by your app and not a rejected promise; it reaches you only as an opaque message on
`lr-map`'s own error handler, while the rest of the layer still paints, so one bad feature in a
large collection is invisible until someone walks the data by hand. Both `choropleth.geojson` and
`dataLayers[].geojson` are now pre-scanned (first 10,000 features) and any numeric property beyond
`Number.MAX_SAFE_INTEGER` draws a dev-mode warning naming the feature and the property. Carry a
reduced figure in the feature — a log, a bucket, an index — and keep the exact value in your own
payload beside the map.

- `label?: string` — accessible name for MapLibre's actual focusable canvas. A host `aria-label`
  (an empty one included) wins and names the canvas. Omitting `label` localizes the default `map`
  message; an explicit empty string suppresses that default and renders an empty canvas name. The
  non-semantic `[part="base"]` wrapper is not named instead.

**Authoring types:** `LyraMapLegendEntry`, `LyraMapLegendPattern`, `LyraMapLegendProjection`, `LyraMapChoroplethLayer`,
`LyraMapGeoJsonDataLayer`, `LyraMapDataLayerKind`, `LyraMapClusterOptions`, `LyraMapHeatmapOptions`,
`LyraMapHeatmapZoomValue`, `LyraMapLineOptions`, `LyraMapPointOptions`, `LyraMapPointRadiusOptions`,
`LyraMapPointRadiusInterpolation`, `LyraMapPointIcon`, `LyraMapPointIconMode`,
`LyraMapPointIconLineCap`, `LyraMapPointIconLineJoin`, `LyraMapMarker`, `LyraMapMarkerActivationDetail`,
`LyraMapMarkerActivationSource`, `LyraMapLegendToggleDetail`, `LyraMapLegendPanelToggleDetail`,
`LyraMapChoroplethNoData`, `LyraMapLegendGradientTick`, `LyraMapControls`,
`LyraMapNavigationControlOptions`, `LyraMapScaleControlOptions`, `LyraMapControlPosition`,
`LyraMapScaleUnit`, `LyraMapStyleSpecification`, `LyraMapEngine`, `LyraMapFeatureRequirements`,
`LyraMapSourceDataDiff`, the `LYRA_MAP_EMPTY_STYLE` constant, and `LyraMapInstance`.

**Getters:** `map: LyraMapInstance | undefined` → the underlying runtime `maplibregl.Map`, exposed
through the peer-neutral `getCanvas()`, `getCenter()`, `getZoom()`, `setCenter()`, `setZoom()`, and
`resize()` subset so merely importing Lyra does not require `maplibre-gl` declarations. A consumer
that installed the optional peer and needs its full imperative API can explicitly narrow the runtime
value to the selected engine's `Map` type. `LyraMapInstance.prepareFeatures?()` is present on the
modular engine and absent on canonical MapLibre, so guard it or narrow to the companion `Map`
before calling. Identity is preserved: `.map` is the engine instance, not a proxy.

Paint or layout changes made directly on the engine instance (for example
`map.setPaintProperty('background', 'background-color', '#f00')`) are rendered into the WebGL
buffer at once, but WebKit with `preserveDrawingBuffer: false` (MapLibre's default) can keep
presenting the previous frame until another frame is requested; this reproduces with plain
`maplibre-gl` and is not specific to `lr-map`. Chromium and Firefox present immediately. After a
direct engine mutation that must be visible without further interaction (a screenshot, an
export), call the narrowed engine's `map.triggerRepaint()` once. `lr-map` does not force a
repaint after every idle, because that would re-render forever.

For style-owned layers, set `interactiveBasemapLayers` to opt their IDs into the component's
hit routing and `lr-map-click` events. For queries outside that routing, narrow `.map` to the
selected engine's type and call `queryRenderedFeatures(point, { layers: [...] })`; `point` is a
screen position available from `project([longitude, latitude])`.

`markersTruncated: boolean` (read-only) is true when authored marker entries exceed the 2,000-entry
inspection ceiling; it does not count malformed rows skipped within that prefix.

The modular engine automatically prepares initial and replacement style requirements, including
projection and terrain. `<lr-map>` additionally awaits per-map main-thread and worker readiness
before adding generated choropleth or `dataLayers` sources and layers. New heatmap, clustering, and
symbol requirements are prepared when introduced. Failed or superseded preparations never apply
stale overlays, and disconnect aborts outstanding preparation.

For direct imperative mutations, call `await map.prepareFeatures(requirements, { signal })` with
actual `sources`, `layers`, `projection`, and `terrain` descriptors before introducing new families
through synchronous `addSource`, `addLayer`, `setProjection`, or `setTerrain` calls. Requirements use
`LyraMapFeatureRequirements`; `signal` is optional. A map constructed with `style: null` is initialized
by this per-map method before those mutations. Global `prepareStyle()` warms main modules only;
it does not replace per-map worker readiness. Same-family updates remain synchronous after readiness.

**Methods:** `LyraMap.preload(engine: LyraMapEngine = 'modular'): Promise<boolean>` starts the selected
optional-peer import without constructing a map or allocating a WebGL context. Pass `'maplibre'`
for an explicitly native element. It resolves to `false` when the selected peer is unavailable,
allowing an application to choose a fallback before connecting an element.

`updateSourceData(sourceId: string, diff: LyraMapSourceDataDiff): boolean` forwards a caller-authored
incremental GeoJSON diff to an applied `dataLayers` or choropleth public `sourceId`. It returns
`false` before the source is ready, after disconnect, for an unknown source, or when the engine
lacks `updateData()`. Feature IDs must be stable and unique; the caller owns diff validity. The
diff is forwarded without cloning, and peer exceptions propagate. It does not change the controlled
properties. Automatic comparison history is invalidated before forwarding, so a later controlled
GeoJSON reassignment replaces the imperative state in full. Use this route for changes beyond the
automatic comparison ceiling.

`fitBounds(bounds: LyraMapBounds, options?: LyraMapFitBoundsOptions): boolean` frames a box
`[[west, south], [east, north]]` in the viewport: the way to show every current marker, or a
selected region, whenever the data set changes. Use it instead of calling the peer's own
`fitBounds()` through `map`, which the element neither knows about nor reports. Once the camera
settles, the element writes it into `center`/`zoom` and emits `lr-map-view-change` with
`source: 'fit'`, so declarative state stays in sync and the element never resets the fitted camera.

- `options.padding` — screen pixels kept clear around the box: one number for every side, or a
  `LyraMapPadding { top?, right?, bottom?, left? }`. The sides are the viewport's physical sides in
  both text directions, because the map's projected space is physical. A negative or non-finite
  side counts as `0`. Defaults to `0`.
- `options.maxZoom` — the highest zoom the fit may reach, so one marker or a tight cluster does not
  zoom to the street. Clamped into the zoom limits (`minZoom`/`maxZoom`, `[0, 22]` by default) when
  the fit runs; a non-finite value sets no ceiling beyond `maxZoom`.
- `options.animate` — defaults to `true`. The camera never animates under
  `prefers-reduced-motion: reduce`.
- Latitudes lie in `[-90, 90]`, with `south <= north`, and longitudes in `[-180, 180]`. A box
  crossing the antimeridian takes either of MapLibre's forms: `west > east`, or `east` unwrapped
  past 180, up to one full turn east of `west` (`[[170, -10], [190, 10]]`, the form MapLibre's
  `LngLatBounds` produces). A single point is a valid zero-size box; pair it with `maxZoom`.
  Anything else (non-finite or non-number values, out-of-range coordinates, an inverted latitude
  span, the wrong shape) returns `false` without moving or queueing anything, with a
  development-mode warning.
- Callable before the map exists, whether the peer is still loading or an off-screen map has not
  been constructed yet. The most recent request is queued and applied without animation right
  after construction, unless `center` or `zoom` has been given a different value since the call.
  Re-assigning the value already held (a framework re-render building an equal array, say) keeps
  the queued fit.
- A `center`/`zoom` assignment made while a fit is still animating wins: the interrupted fit is
  neither written back nor reported, and the camera lands on the whole declared `center`/`zoom`.
- Returns `true` once the fit is running or queued, and `false` when the loaded peer cannot fit a
  box. When the padded box cannot fit the map's current size (padding wider or taller than the
  map), MapLibre leaves the camera where it is and logs its own warning: the call still returns
  `true`, and no `lr-map-view-change` fires.

`fitToData(options?: LyraMapFitBoundsOptions): boolean` frames everything the map draws: `markers`,
every `dataLayers` source and the `choropleth`, measured from the geometry the element has already
admitted (not from your raw values), so you no longer compute a box yourself. It is `fitBounds()` of
the union of their extents, with the same options, queueing, `cameraPadding`, write-back and
`source: 'fit'`. `maxZoom` defaults to `16`, so one marker does not zoom to the street; pass it
(a non-finite value for no ceiling) to change that. The extent is a plain west-to-east span, so data
on both sides of the antimeridian frames the long way round. Returns `false`, doing nothing, when
nothing with geometry is drawn. Assignments to `markers`/`dataLayers`/`choropleth` made in the same
tick are already counted.

`fitBounds()`, `fitToData()` and the camera commands below are not interrupted by a `center` or
`zoom` assignment made in the same tick: they run after the update that pushes that assignment, so
the order you wrote them in is the order they take effect (`el.center = x; el.fitBounds(box)` no
longer needs an `await el.updateComplete` in between). Their return value is `true` once accepted
or deferred.

`flyTo(options)`, `easeTo(options)` and `jumpTo(options)` (`LyraMapCameraOptions { center?, zoom?,
bearing?, pitch?, duration? }`; each returns `boolean`) move the camera with the engine's own
commands, a curved flight, an eased animation and an immediate jump respectively. Use them instead of
calling the same methods through `map`, which the element neither knows about nor reports.

- Reduced motion: under `prefers-reduced-motion: reduce` (or a `data-lr-motion="reduce"` scope)
  `flyTo()` and `easeTo()` jump.
- Write-back: once the camera settles, the element writes it into `center`/`zoom` and emits
  `lr-map-view-change` with `source: 'command'`; it never moves the camera a second time to apply
  what it just wrote. `jumpTo()` is the explicit re-centre (an equal `center` re-assignment is a
  no-op).
- Every option is optional and an unusable one is ignored: `center` must be a finite
  `[longitude, latitude]` (clamped into range), `zoom` is clamped into the zoom limits
  (`minZoom`/`maxZoom`, `[0, 22]` by default), `pitch` into
  `[0, 85]`, and a negative or non-finite `duration` means the engine's default. With nothing
  usable the call returns `false` (and warns in development) without moving anything.
- Callable before the map exists: the most recent request (or `fitBounds()` call) is queued and
  applied without animation right after construction, unless `center` or `zoom` has been given a
  different value since. Returns `true` once the move is running or queued, `false` when the loaded
  engine has no such command.

`project(lngLat)` returns the `[x, y]` CSS pixel position of a `[longitude, latitude]` in the map's
container, and `unproject([x, y])` the inverse, so an overlay can sit on a coordinate; both read the
camera as it is now and return `undefined` before the map exists, for a non-finite input, or when
the engine cannot project. Pair `project()` with `lr-map-move` to keep an overlay glued to a moving
map.

`getVisibleBounds(options?: LyraMapVisibleBoundsOptions): LyraMapBounds | null` synchronously reads
the visible box as frozen `[[west, south], [east, north]]`. By default it is the box inside the
applied `cameraPadding`, the one `lr-map-move` and `lr-map-view-change` report; `{ padded: false }`
reads the whole viewport. `west` is wrapped into [-180, 180] and `east` keeps the span, so it can
exceed 180 across the antimeridian; latitudes are clamped to [-90, 90]. It returns `null` before the
engine exists or when the engine cannot report a box. Use it instead of reading bounds from `.map`:

```js
const box = mapElement.getVisibleBounds({ padded: false });
if (box) loadTiles({ west: box[0][0], south: box[0][1], east: box[1][0], north: box[1][1] });
```

There is deliberately no declarative `bounds` property. `center` and `zoom` already describe the
camera; a third camera input would need a precedence rule against them, and a framework that
rebuilds its arrays on every render would refit on every render, pulling the camera away from a user
who has just panned. A one-shot command whose result lands in `center`/`zoom` keeps one camera input.

```ts
import type {
  LyraMap,
  LyraMapBounds,
  LyraMapMarker,
  LyraMapViewChangeDetail,
} from '@aceshooting/lyra-ui/components/media/map/map.class.js';

let camera: LyraMapViewChangeDetail | undefined;
const mapEl = document.querySelector('lr-map') as LyraMap;
mapEl.addEventListener('lr-map-view-change', (event) => {
  // Keep the host's own camera state in step: { center, zoom, source, bounds }.
  camera = event.detail;
});

function showMarkers(markers: LyraMapMarker[]): void {
  mapEl.markers = markers;
  if (markers.length === 0) return;
  const lngs = markers.map((marker) => marker.lngLat[0]);
  const lats = markers.map((marker) => marker.lngLat[1]);
  const box: LyraMapBounds = [
    [Math.min(...lngs), Math.min(...lats)],
    [Math.max(...lngs), Math.max(...lats)],
  ];
  mapEl.fitBounds(box, { padding: 48, maxZoom: 14 });
}

// The same, without computing the box, inside a toolbar that covers the left 320px:
mapEl.cameraPadding = { left: 320 };
mapEl.fitToData({ maxZoom: 14 });

// Camera commands report as `source: 'command'` and write back into center/zoom:
mapEl.flyTo({ center: [2.35, 48.85], zoom: 11 });

// Keep an overlay on a coordinate while the map moves:
mapEl.addEventListener('lr-map-move', () => {
  const point = mapEl.project([2.35, 48.85]);
  if (point) overlay.style.translate = `${point[0]}px ${point[1]}px`;
});
```

**Events:** `lr-map-load` (fired once, after the underlying map's own `'load'`),
`lr-map-legend-toggle-request` (**cancelable**; frozen `LyraMapLegendToggleDetail { value, visible,
hiddenCategories }` — the activated row's category key, its proposed visibility, and the complete
proposed hidden set in the order it would be committed, with the array detached and frozen so a
listener cannot mutate the component's state through it). `preventDefault()` is a genuine veto, not
a notification: `hiddenCategories` is not written, the row's `aria-pressed` does not change, the
MapLibre paint is untouched, and nothing is announced — which is exactly what a host needs to own
the set and assign its own value instead. There is deliberately no second, confirmation event: the
committed state is `hiddenCategories`, which the host already observes, so a paired before/after
vocabulary would be permanent public surface nobody asked for. The event is a DOM-interaction
proposal only, so a programmatic `hiddenCategories` assignment reconciles without emitting it.
Also `lr-map-legend-panel-toggle-request` (**cancelable**; frozen
`LyraMapLegendPanelToggleDetail { open }` — the proposed `legendOpen` value), fired once when the
`legendCollapsible` disclosure is activated by pointer or by Enter/Space. It is the *panel's*
disclosure, not a *category's* visibility, so it deliberately does not reuse
`lr-map-legend-toggle-request`. `preventDefault()` is the same genuine veto: `legendOpen` is not
written, the rendered rows and the disclosure's `aria-expanded` do not change, so a host can own the
open state and assign its own value from `event.detail.open`. A programmatic `legendOpen` assignment
reconciles without emitting it, so a controlled host cannot loop.
Also `lr-map-marker-activate` (non-cancelable; frozen `LyraMapMarkerActivationDetail { id, lngLat,
marker, source }`; `id` is the trimmed explicit identity or `undefined`, `marker` is the accepted
declarative snapshot, and `source` is `'pointer' | 'keyboard'`), and `lr-map-click`
(frozen `detail: { readonly lngLat: readonly [lng, lat], readonly feature?, readonly origin?,
readonly sourceId?, readonly noData?, readonly trigger? }`, `trigger` being `'keyboard'` only for a
`keyboardActivation`; the tuple and any hit GeoJSON feature are detached and
recursively frozen). `noData` is `true` only for a choropleth hit whose `field` value is missing,
`null` or not a number while `choropleth.noData` is configured, and is absent otherwise.
`feature` resolves against the choropleth fill layer **and** every applied `dataLayers`
fill/line/circle/cluster layer, topmost first — so a shape painted through `dataLayers` is
identifiable instead of being indistinguishable from empty space. `origin` is `'choropleth'`,
`'data-layer'` or `'cluster'`, and `sourceId` carries the authored `dataLayers[].sourceId` for a
data-layer or cluster hit; both are `undefined` whenever `feature` is. A cluster hit is reported
separately because it is a synthetic aggregate rather than one of your features: its useful payload
is MapLibre's `point_count`/`point_count_abbreviated`/`cluster_id` properties, which is what a
zoom-to-cluster handler reads (or set `cluster.zoomOnClick` and let the element ease into it).
The count label is deliberately not hit-tested (it sits exactly on
the circle already queried and would only make the label the topmost hit), and a `kind: 'heatmap'`
layer is never queried at all — MapLibre returns no features for a rendered density surface.
Also `lr-map-view-change` (non-cancelable; frozen `LyraMapViewChangeDetail { center, zoom, source,
bounds? }`, `source` being `LyraMapViewChangeSource = 'user' | 'fit' | 'command'`), fired once each
time the camera settles after a user gesture (drag, wheel, touch, keyboard, Shift+drag box zoom, or
a standard peer navigation button), a `fitBounds()`/`fitToData()` call (`'fit'`), or a
`flyTo()`/`easeTo()`/`jumpTo()` call (`'command'`). `center` is `[longitude, latitude]` with the
longitude wrapped into `[-180, 180]`. `bounds` is the visible `[[west, south], [east, north]]` box
inside `cameraPadding` (`west` within `[-180, 180]`, `east` possibly past 180 across the antimeridian,
so `fitBounds()` accepts it back); it is absent when the engine cannot report bounds. The element has already written the camera into `center` and `zoom`
when it fires, so a host that mirrors camera state assigns the detail back, at any later time,
without moving the map. Assigning `center`/`zoom` reconciles without emitting it, so a controlled
host cannot loop, and camera moves made directly through `map` are not reported — which is why
`'user'`, `'fit'` and `'command'` are the only sources.
Also `lr-map-move` (non-cancelable; frozen `LyraMapMoveDetail { center, zoom, bounds? }`), fired at
most once per animation frame while the camera moves, whatever moves it (a gesture, an animation,
a camera command, a fit, a `center`/`zoom` assignment or a move made directly through `map`), and
once more when the move ends so the last position is never missed. It reports the camera as it is,
not a settled intent: use `lr-map-view-change` for where the camera came to rest, and this event to
keep an overlay in step with the map while it travels (pair it with `project()`). It stops when the
element disconnects.
Readiness: `lr-map-style-load` (frozen `LyraMapReadinessDetail { generation }`) fires once per
connection and style after generated and registered overlays, images, style overrides and their
asynchronous preparation are restored; `lr-map-idle` (same detail) fires after style readiness
whenever the peer and current component work are idle, including after later camera or source
updates. `generation` increases monotonically across reconnects and style replacements.
Interactions: `lr-map-feature-enter` and `lr-map-feature-leave` (frozen `LyraMapInteractionDetail
{ lngLat, hit?, feature? }`) report the pointer entering a different admitted feature and leaving the previous
one; `lr-map-pointer-move` (frozen `LyraMapPointerDetail { lngLat, point }`, at most once per frame) and
`lr-map-pointer-leave` (detail `null`) report the pointer itself; `lr-map-contextmenu` (same detail) reports a secondary click without preventing the native
context menu; `lr-map-pick` (frozen `LyraMapPickDetail { lngLat, hit?, trigger }`, `trigger` being
`'pointer' | 'keyboard'`) reports a pick-mode selection, a keyboard pick using the camera center.
`lr-map-anchor-close` (frozen `LyraMapAnchorCloseDetail { reason }`) fires after an open anchor
closes by `closeAnchor()`, its close button or Escape.
Drawing: `lr-map-draw-start` (after the first accepted vertex), `lr-map-draw-change` (after an
accepted vertex, undo or vertex edit) and `lr-map-draw-complete` (valid geometry with spherical
metrics) carry a frozen `LyraMapDrawingSnapshot`; `lr-map-draw-cancel` carries
`LyraMapDrawingCancelDetail`, the cancelled snapshot plus a stable `reason`; `lr-map-draw-vertex-end`
carries `LyraMapDrawingVertexEndDetail` once a vertex drag or keyboard move ends.
Location: `lr-map-geolocate` (frozen `LyraMapGeolocateDetail { lngLat, accuracy }`) after the
user-activated geolocate control locates the user.
Failures: `lr-map-geolocate-error` (frozen `LyraMapGeolocateErrorDetail { code }`, a
`LyraMapGeolocationErrorCode`) and `lr-map-geolocate-out-of-bounds` (`{ code: 'out-of-bounds' }`)
expose no coordinates or native messages; `lr-map-export-error` (frozen
`LyraMapImageExportErrorDetail { code }`) reports a sanitized `exportImage()` failure.
Attribution: `lr-map-attribution-toggle` (`LyraMapAttributionToggleDetail { expanded }`) after the owned
attribution control's credits are shown or hidden. None of these events is cancelable; all bubble and
are composed.

The outer marker-activation detail is frozen, while an opaque marker `unsafeHtml` value remains the
original supplied value at the MapLibre popup and marker-activation boundary. Treat it as trusted
markup as described above.

**Slots:** `anchor` — content placed at `anchorLngLat`, replacing a hand-positioned popup. It sits
above the point (flipped below near the top edge, shifted to stay inside the map), follows the point
through every camera move, resize and `anchorLngLat` change, and is hidden while `anchorLngLat` is
unset or unusable, the point is outside the visible map, or the map does not exist (before the peer
loads, after a failure or a disconnect). The element only places it: `part="anchor"` supplies a
default surface (padding, border, radius, shadow, above the legend and controls) and the slotted
content owns its semantics, labelling, close control and focus, so name it and manage focus as you
would any dialog or popup of your own. Positioning uses the library's shared popup positioner, in
the map's container, and the wrapper's size never depends on the placement, so it adds no layout
loop. Typical use: `map.addEventListener('lr-map-click', (e) => { card.hidden = false;
map.anchorLngLat = e.detail.lngLat; })`.
`anchors` — `lr-map-anchor` children; a direct child anchor assigns itself here. An element assigned
here may also wrap anchors (a framework component host, say); it renders inside the map, so it
should hold only anchors.
`legend` — custom legend content, rendered inside the legend panel's own layout so it
stays positioned with the map instead of floating beside it. Supplying it opens the panel even
when `legend` and `legendGradient` are both empty. `legend-start` — the same extension point at the
**top** of the panel: it renders ahead of the gradient bar and every projected row, where `legend`
renders after them, so a host-authored panel header is no longer forced to be a footer. Content in
it alone opens the panel too, and neither slot is ever made interactive by `legendInteractive`,
which only reaches rows projected from `legend`.

**CSS parts:** `base`, `container`, `legend`, `legend-disclosure`, `legend-disclosure-icon`,
`legend-group`, `legend-group-heading`, `legend-swatch`, `legend-toggle`,
`legend-toggle-hidden`, `legend-gradient`, `legend-lo`,
`legend-hi`, `legend-ticks`, `legend-tick`, `legend-derived`, `legend-limit`, `anchor`,
`anchor-close`, `marker`, `popup`, `popup-content`, `popup-close-button`, `attribution`,
`attribution-toggle`, `attribution-content`, `navigation`, `zoom-in`, `zoom-out`, `compass`, `scale`,
`geolocate`, `geolocate-control`, `controls`, `controls-top`, `controls-bottom`, `controls-top-left`, `controls-top-right`,
`controls-bottom-left`, `controls-bottom-right`, `zoom-in-icon`, `zoom-out-icon`, `compass-icon`,
`geolocate-icon`, `geolocate-waiting`, `geolocate-active`, `geolocate-background`, `geolocate-error`,
`attribution-link`, `attribution-expanded`, `controls-attribution-expanded`,
`configuration-error`, `error`.
Before native construction, `initialization-placeholder` is the stable surface and
`initialization-skeleton` is its decorative skeleton. `initialization-controls` also exposes `controls`;
its rows expose `controls-top` and `controls-bottom`, and each `initialization-corner` also exposes its
matching corner token. `initialization-control` outlines explicitly requested controls, with
`initialization-navigation`, `initialization-scale`, `initialization-geolocate` or
`initialization-attribution` identifying the kind. Placeholder corners and order follow those options;
implicit default attribution has no placeholder. Once the map is constructed, the activation surface
and skeleton are gone, but `initialization-controls` stays (`aria-hidden`, inert, no pointer events)
with outlines only for requested controls whose lazy code is still installing. Those controls load and
install in one pass, so their outlines are removed together when the pass settles, whether every
control installed or one failed; a later `controls` change replaces them and disconnecting clears them.
Already installed controls gain no outline. Outlines paint with the same glass or solid surface material
as the installed controls, so the swap does not change their fill. For `initialization="interaction"`,
`initialization-activate` starts the map and `initialization-activate-label` styles its visible label.
Hiding that label retains the button's localized accessible name. Pick mode renders `pick-controls` with
`pick-center` and `pick-cancel`; draw mode renders `drawing-controls` with `drawing-add`,
`drawing-undo`, `drawing-complete`, `drawing-cancel` and the `drawing-status` vertex count (plus
`drawing-summary` with `drawingMeasurements`), vertex editing renders `drawing-handles` containing
one `drawing-vertex` per editable vertex, and `drawingMeasurements` renders `drawing-measurements`
holding the `drawing-measurement` labels.
The compact attribution summary has a decorative, current-color information glyph and retains
MapLibre's accessible name, keyboard/touch disclosure behavior and attribution links. To make
only this control compact, scope the shared target-size token to its public wrapper:

```css
lr-map::part(attribution) { --lr-icon-button-size: var(--lr-size-24px); }
```

Keep that target at least 24px in both axes. This leaves navigation controls at their existing size.

`geolocate-control` targets the native geolocation control's whole wrapper; `geolocate` remains its
button. Apply layout offsets to the wrapper to avoid enlarging the button's painted group.
`attribution-content` targets the credits inside `attribution`, separately from `attribution-toggle`.
For example, a host can place a bounded, scrollable credits panel above the compact toggle without
changing the control's footprint when it opens:

```css
lr-map::part(geolocate-control) { margin-block-end: var(--lr-space-2xl); }
lr-map::part(attribution-content) {
  position: absolute;
  inset-inline-end: 0;
  inset-block-end: calc(100% + var(--lr-space-xs));
  inline-size: var(--lr-size-16rem);
  max-block-size: var(--lr-size-8rem);
  overflow: auto;
  background: var(--lr-color-surface);
}
```

Choose panel bounds that fit the map's allocation and keep required provider credits reachable.

`controls` targets the native control container; `controls-top` and `controls-bottom` are independent
row grids. `controls-top-left`, `controls-top-right`,
`controls-bottom-left` and `controls-bottom-right` target its corners. Their names match the control
position vocabulary; positioning follows the inherited text direction. Use these parts for corner
insets, gaps and responsive layouts. Icon parts target the native spans: styling `compass-icon`
preserves the engine's bearing rotation. Geolocation button state adds `geolocate-waiting`,
`geolocate-active`, `geolocate-background` or `geolocate-error` tokens as applicable.
`attribution-link` reaches each credit link. While credits are expanded, `attribution-expanded`
is added to the attribution wrapper, toggle and content, allowing each surface to be styled directly.

`--lr-map-scale-bar-display` defaults to `block`; set it to `none` to hide the ruler while retaining
the distance text. For example:

```css
lr-map { --lr-map-scale-bar-display: none; }
lr-map::part(controls-bottom-right) { gap: var(--lr-space-s); }
lr-map::part(compass-icon) { color: var(--lr-color-brand); }
lr-map::part(attribution-link) { padding-inline: var(--lr-space-xs); }
lr-map::part(attribution-toggle) { background: transparent; }
```

Corner spacing also includes each control's margin; reset those public wrapper margins when
replacing them with a corner gap. Keep required credits visible and controls within the map.

When any attribution in the container is expanded, `controls-attribution-expanded` is added to
that container, both rows and all four corners. Compound part selectors can therefore reflow the
corners without observing shadow DOM. This bounded example stacks the two bottom corners on narrow
viewports; choose the breakpoint and footer reservation for the application:

```css
@media (max-width: 40rem) {
  lr-map::part(controls controls-attribution-expanded) {
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    gap: var(--lr-space-s);
  }
  lr-map::part(controls-top controls-attribution-expanded),
  lr-map::part(controls-bottom controls-attribution-expanded) { display: contents; }
  lr-map::part(controls-bottom-left controls-attribution-expanded),
  lr-map::part(controls-bottom-right controls-attribution-expanded) { position: static; }
  lr-map::part(controls-bottom-left controls-attribution-expanded) { align-self: flex-start; }
  lr-map::part(controls-bottom-right controls-attribution-expanded) { align-self: flex-end; }
}
```

Map content is clipped to its allocation. The host application owns stacking relative to page
siblings and the stacking contexts established by its ancestors.

`legend` is a localized `role="group"` containing a real list associated to the map canvas with
`aria-describedby`; each entry is a `listitem`, decorative swatches are inert/accessibility-hidden,
and the overlay is bounded to the map allocation with scrolling and long-label wrapping.
A swatch rendering an entry's `icon` carries `data-icon="true"`, paints the glyph in that entry's
own colour through `currentColor`, and drops the colour block, its border and the `pattern`
overlay — all three would sit on top of the shape they identify. The glyph stays decorative: the row's
visible label carries its meaning. That association is advertised only while it is true — while
the selected optional map peer is still loading, and after any failure, there is no map
container in the tree, so `legend` withholds `aria-controls` rather than leaving a dangling
idref.
Under `legendInteractive`, a row carrying a `value` wraps its swatch and label in a
`legend-toggle` `button` with `aria-pressed` rendered as the literal `"true"`/`"false"` — never
omitted, because a missing attribute reports "not a toggle button" rather than "unpressed". Setting
`legendControlRole="checkbox"` renders the SAME `button` with `role="checkbox"` and `aria-checked`
(also always the literal `"true"`/`"false"`) in place of `aria-pressed`, and nothing else about the
row changes. The button's accessible name is its own visible label (caller-supplied data, so
deliberately not localized), scoped by the legend's own localized group name; no `aria-label`
restates the state, which would make assistive tech announce it twice. A hidden row's button
additionally carries the
`legend-toggle-hidden` token — state lives in the part name, so `::part(legend-toggle-hidden)` is a
reachable hook — and dims only its `aria-hidden` swatch while re-colouring the label through the
quiet text token, so the label keeps AA contrast rather than fading with the whole button. In
forced colors the hidden row falls back to `line-through`, which survives a system-color collapse.
Each activation is announced through the shared light-DOM polite live region, using the same
`legendTypeShown`/`legendTypeHidden` strings `lr-graph-legend` announces with.
Under `legendCollapsible`, `legend-disclosure` is a native `button` whose **visible localized text
is its accessible name** and whose `aria-expanded` renders the literal `"true"`/`"false"` — never
omitted — with `aria-controls` naming the row list in the same shadow root (idrefs do not cross
shadow boundaries, so this is deliberately not an idref into the light DOM). It carries the shared
`--lr-icon-button-size` hit-area floor, and `legend-disclosure-icon` is the decorative chevron it
rotates: the shared icon set ships one right-pointing glyph and asks callers to rotate the wrapping
part, so collapsed points along the reading direction and expanded points down in both directions.
The rotation runs on `--lr-transition-fast`, which the token layer already flattens under
`prefers-reduced-motion`. A collapsed panel hides its gradient, rows, `legend-limit` summary and
trailing `legend` slot with the plain `hidden` attribute, so they leave layout, the accessibility
tree and the tab order together.
When at least one entry carries a `group`, each consecutive run renders inside `legend-group`
(`role="group"`, named by its own `legend-group-heading` through `aria-labelledby`) and **each run
gets its own `role="list"`**, because a `list` may only own `listitem`s — a `group` sitting directly
inside the outer list is an `aria-required-children`/`aria-required-parent` violation. The outer
container therefore drops its own `role` in that case; a legend with no groups keeps the single
`role="list"` it has always had. Row `aria-posinset`/`aria-setsize` stay whole-key values inside a
section: `aria-setsize` already reports the *input* count so a bounded key stays honest, and a
dropped row carries no attributable group, so a section adds a labelled sub-region without
renumbering the key.
`legend-limit` is the localized bounded-projection summary. The five peer-chrome parts project
stable Lyra names onto MapLibre-generated DOM without erasing peer-supplied part tokens;
`marker` retains a 24px minimum target in both axes even when a peer/custom marker has no intrinsic
content size. `popup-close-button` is the generated close control on an open marker popup. `error` is ordinary localized visible
text rendered in place of `container` for four distinct states: explicit style required, optional
peer unavailable, owner-realm WebGL2 unavailable, or initialization failed. A post-mount failure is
appended to the document's pre-mounted `[data-lr-live-region="assertive"]` sink rather than making
shadow chrome live; raw caught errors are never exposed.

**Standard peer controls:** after `lr-map-load`, narrow `.map` to the selected engine's `Map`.
For the default engine, import `NavigationControl` from `@aceshooting/lyra-map/controls/navigation`
and `ScaleControl` from `@aceshooting/lyra-map/controls/scale`, then use `addControl(new NavigationControl(), 'bottom-right')` and
`addControl(new ScaleControl({ unit: 'metric' }), 'bottom-left')`. No document-level peer CSS or
shadow-root modification is needed: navigation buttons, compass glyph, scale bar and control
corners are styled with Lyra tokens. The corners follow inline start/end under RTL. The legend
reserves vertical room for these controls and attribution, including after resize or removal.
Attribution also reserves legend space when it is the only control. Opposing occupied corners
share the available width, so expanded attribution wraps without covering a scale or navigation
control on the other side; controls stay aligned to their logical edge in both text directions.
Prefer the declarative `controls` property (`controls = { navigation: true, scale: { unit: 'metric' } }`),
which does the dynamic import, `addControl()` and removal for you; the imperative route below stays
supported for controls it does not cover, such as fullscreen.
Navigation exposes `navigation`, `zoom-in`, `zoom-out`, and `compass` parts; the scale exposes `scale`.
Button names update through `zoomIn`, `zoomOut`, and `mapResetNorth` locale strings. MapLibre retains
keyboard activation, compass rotation, zoom limits, scale units and viewport updates. No controls
other than default attribution are created until declared in `controls` or added by the application.

Navigation, scale, attribution and the legend follow the surrounding Glass or Solid surface
treatment. Their decorative filtering leaves native control behavior and map data paint intact.
The legend keeps its material stationary while its public surface scrolls. Solid, unsupported
filtering, reduced transparency, increased contrast and forced colors use opaque surfaces.
Remove opaque `background` overrides on these parts to allow the shared material to paint;
geometry and foreground overrides remain available through the existing public parts and tokens.

**Themeable custom properties:**

- `--lr-map-height` (default `var(--lr-size-24rem)`) — host block size, shared with the optional
  pre-upgrade reservation stylesheet. An explicit outer `block-size` still wins.
- `--lr-map-choropleth-fill-opacity` (default `0.75`) — fill opacity for the declarative
  `choropleth` layer and polygon fills in every `dataLayers` entry. It intentionally inherits from
  an ancestor, so one scoped declaration rethemes every nested map without setting each host.
- `--lr-map-hidden-category-opacity` (default `0.15`) — opacity a category listed in
  `hiddenCategories` is muted to in the rendered MapLibre paint: `circle-opacity` and
  `circle-stroke-opacity` on the points layer and `icon-opacity` on the point-icon symbol layer.
  Like the fill-opacity token it is read from the resolved cascade on every paint, because MapLibre
  draws to a WebGL canvas the CSS cascade never reaches, and it inherits from an ancestor. A
  `kind: 'heatmap'` entry is out of scope: a density surface has no per-category field to mute.
- `--lr-map-legend-hidden-swatch-opacity` (default `0.5`) — opacity of a hidden interactive legend
  row's decorative swatch. Only the `aria-hidden` swatch dims; the label re-colours through
  `--lr-color-text-quiet` instead, so it never drops below 4.5:1.
- `--lr-map-drawing-color` (default `var(--lr-color-brand)`) — color of the temporary drawing, its
  rubber band and the vertex handles. Read from the resolved cascade, so a theme change repaints it.
- `--lr-map-popup-close-button-hover-bg` (default `var(--lr-color-brand-quiet)`) and
  `--lr-map-popup-close-button-hover-color` (default `var(--lr-color-brand)`) — hover background
  and foreground of `popup-close-button`.
- `--lr-map-popup-close-button-active-bg` (default `color-mix(in oklab,
var(--lr-color-brand-quiet), var(--lr-color-mix-partner) var(--lr-color-mix-active))`) and
  `--lr-map-popup-close-button-active-color` (default `var(--lr-color-brand)`) — pressed
  background and foreground of `popup-close-button`.
- Shared tokens — `--lr-space-xs/-s`, `--lr-color-surface`, `--lr-color-border` (the navigation
  control group), `--lr-color-border-subtle` (popup, legend and legend-limit rule edges),
  `--lr-shadow`, `--lr-radius`.

### Migrating a raw engine map to `lr-map`

Move the map's desired state into the component before connecting it. Keep `mapStyle` for the
basemap and `overlays` for application-owned native sources and layers. The component prepares the
modular features, installs those resources and restores them after each style replacement.

| Raw engine operation | Component-owned equivalent |
| --- | --- |
| `new Map({ style, center, zoom })` | `mapStyle`, `center`, `zoom` and the element's allocation |
| `addSource()` / `addLayer()` and style-load replay | `overlays.sources` / `overlays.layers`, or `dataLayers` for the documented data-layer models |
| `addImage()` / missing-image listener | `images` / `imageProvider` |
| Basemap `setPaintProperty()` / `setLayoutProperty()` / `moveLayer()` | `styleOverrides` with a basemap `layerId` or selector; `before` controls placement |
| Camera moves and fitting | `flyTo()`, `easeTo()`, `jumpTo()`, `fitBounds()` and `fitToData()` |
| Polling `isStyleLoaded()` and installing a style-load listener | `whenStyleReady()` for style restoration; `whenIdle()` for subsequent resource/render work |

For example, this overlay remains owned when the basemap changes:

```ts
import {
  LYRA_MAP_EMPTY_STYLE,
  type LyraMapStyleSpecification,
} from '@aceshooting/lyra-ui/components/lr-map.js';

const mapEl = document.createElement('lr-map');
mapEl.setAttribute('aria-label', 'Locations');
mapEl.style.blockSize = '24rem';
mapEl.initialization = 'eager';
mapEl.mapStyle = LYRA_MAP_EMPTY_STYLE;
mapEl.center = [2.35, 48.85];
mapEl.zoom = 10;
mapEl.overlays = {
  sources: [{
    id: 'locations-source',
    source: {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: [{
          type: 'Feature', id: 'location-1', properties: {},
          geometry: { type: 'Point', coordinates: [2.35, 48.85] },
        }],
      },
    },
  }],
  layers: [{
    interactive: true,
    layer: {
      id: 'locations-circles', type: 'circle', source: 'locations-source',
      paint: { 'circle-color': 'var(--lr-color-brand)', 'circle-radius': 6 },
    },
  }],
};
document.body.append(mapEl);
await mapEl.whenStyleReady();
await mapEl.whenControlsReady();

async function replaceBasemap(style: LyraMapStyleSpecification): Promise<void> {
  mapEl.mapStyle = style;
  await mapEl.whenStyleReady();
  // The component has restored locations-source and locations-circles.
}
```

Configure the companion worker as shown below before running this example. Handle rejected
readiness promises when navigation disconnects the element, a newer style supersedes the request,
or resource preparation fails. After reassigning overlay data or mutable paint/layout on the same
style, await `whenIdle()` before relying on the rendered result.

Keep the application snapshot authoritative and assign fresh `overlays`, `images` and
`styleOverrides` values when they change. An incremental `updateSourceData()` call does not rewrite
that snapshot: the next style replacement restores the controlled source data. Keep source, layer
and image IDs distinct from the basemap and component-generated resources. A `before` anchor must
be valid for the replacement basemap too; omit it when no shared anchor exists.

Remove the old callbacks that re-add these same resources on every style load. Use
`lr-map-style-load` to observe completed restoration. Direct mutations through the `map` getter
remain outside declarative ownership; move resources that must survive basemap changes into the
properties above. Retain application selection state across source identity changes, and check
boolean admission when applying it through `setFeatureState()`.

**Optional peer deps:** the default is `@aceshooting/lyra-map` `^1.0.0` (lazy-loaded). Install and
configure the companion's Vite plugin so the engine and module worker share the same emitted
feature graph:

```ts
// vite.config.ts
import { defineConfig } from 'vite';
import { lyraMapWorkerPlugin } from '@aceshooting/lyra-map/vite';
export default defineConfig({ plugins: [lyraMapWorkerPlugin()] });
```

The plugin configures the worker as the selected renderer is bundled; application startup needs
no companion pre-import or readiness gate. Configure one plugin instance per application build,
including when a workspace re-exports it. For an optional warm-up when navigation intent is known:

```ts
import { LyraMap } from '@aceshooting/lyra-ui/components/lr-map.js';

void LyraMap.preload();
```

`preload()` starts the selected engine import without constructing a map, creating a WebGL context
or waiting for a style. It is optional and does not replace worker configuration or an element's
`whenStyleReady()` / `whenIdle()` promises. Await its boolean result only when the application needs
to choose its own fallback; `false` means that the selected engine could not load. For an element
that will use `engine="maplibre"`, warm that engine with `LyraMap.preload('maplibre')` instead.

The plugin disables document module-preload helpers for chunks also imported by workers. See the
companion README for Rollup/Rolldown integration or the explicit `setWorkerUrl()` override. Missing
worker configuration fails visibly. Importing the companion during SSR is safe; worker creation
occurs in the browser.

`<lr-map>` styles the generated canvas, marker, popup, and control DOM inside its shadow root;
a page-level map stylesheet is neither required nor able to reach those nodes. The explicit
`engine="maplibre"` choice uses the separate optional `maplibre-gl` `>=5 <7` peer. Canonical v6 needs
its own bundler-specific module-worker URL; v5's standard build includes its worker.

With the default companion configured:

```html
<lr-map center="[2.35, 48.85]" zoom="10"></lr-map>
<script type="module">
  const m = document.querySelector("lr-map");
  m.mapStyle = { version: 8, sources: {}, layers: [] }; // explicit, network-silent baseline
  m.choropleth = {
    sourceId: "regions",
    geojson: myGeoJson,
    field: "value",
    stops: [
      [0, "#cde2fb"],
      [100, "#0969da"],
    ],
  };
  m.legend = [
    { color: "#cde2fb", label: "Low", pattern: "solid" },
    { color: "#0969da", label: "High", pattern: "diagonal" },
  ];
  m.markers = [{ lngLat: [2.29, 48.86], label: "Eiffel Tower" }];
  m.renderWorldCopies = false;
  m.addEventListener("lr-map-marker-activate", (e) =>
    console.log(e.detail.id, e.detail.lngLat)
  );
  m.addEventListener("lr-map-click", (e) =>
    console.log(e.detail.feature?.properties)
  );
</script>
```

### Moving from full MapLibre to the modular engine

For an existing `lr-map`, install the compatible `@aceshooting/lyra-map` companion, add
`lyraMapWorkerPlugin()` to the Vite configuration above, and set `engine="modular"` before the
element connects (or omit `engine`, whose default is `modular`). Existing style descriptors and
component-owned overlays keep the same shape. Changing `engine` on a connected element takes
effect only after disconnect/reconnect.

Register custom protocols through `@aceshooting/lyra-map` when using the modular engine; protocol
registrations on `maplibre-gl` belong to that other engine. Declarative component resources prepare
their required feature families automatically. Any remaining direct `map.addSource()` /
`map.addLayer()` / projection / terrain mutations must await the modular map's
`prepareFeatures()` with their real descriptors first, as described above.

The modular plugin does not configure full MapLibre's worker. If an element still explicitly uses
`engine="maplibre"`, retain that engine's setup. For Vite and MapLibre v6:

```ts
import { setWorkerUrl } from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import {
  LYRA_MAP_EMPTY_STYLE,
} from '@aceshooting/lyra-ui/components/lr-map.js';

setWorkerUrl(workerUrl);
const nativeMapEl = document.createElement('lr-map');
nativeMapEl.engine = 'maplibre';
nativeMapEl.mapStyle = LYRA_MAP_EMPTY_STYLE;
nativeMapEl.style.blockSize = '24rem';
document.body.append(nativeMapEl);
```

Run worker setup before connecting any full-engine element. MapLibre v5's standard build includes
its worker; other build variants and bundlers have their own setup (see
https://maplibre.org/maplibre-gl-js/docs/#esm). Remove the full-engine worker import and dependency
only when no remaining consumer uses them. The component styles its own shadow DOM for either
engine; keep a page-level engine stylesheet only for raw maps that still need it. Deploy the
modular renderer, worker and every emitted feature chunk together.

**Known gotchas:**

- Construction is transactional. A constructor/setup/get-canvas failure removes any partially
  created peer instance, renders only the localized initialization failure, and can retry after a
  new style or reconnect without an unhandled promise rejection. Capability probes and error
  constructors come from the current owner document, including after same-origin adoption.
- Every marker handles Enter and Space as button activation. Space suppresses the page-scroll
  default whether or not a popup exists; when one does, MapLibre still receives its own popup
  toggle and the component emits exactly one `lr-map-marker-activate` notification.
- clearing or swapping the choropleth no longer leaks the old layer: setting `choropleth =
undefined`, or changing `choropleth.sourceId` to a different value, now calls `removeLayer`/
  `removeSource` on whatever was previously applied before adding the new one (or nothing, if
  cleared).
- `mapStyle` changes after construction now call `setStyle()` (in addition to `center`/`zoom`
  already calling `setCenter`/`setZoom`) — the choropleth and `dataLayers` are both automatically
  re-applied once the new style's own `'style.load'` fires, since a style change wipes every
  layer/source maplibre-gl knows about.
- Point markers now have a declarative API (`markers`, above) with popup support — narrowing the
  runtime `.map` value and manually constructing `new maplibregl.Marker()` are no longer the only
  way to place pins.
- A marker uses `label` as its accessible name, then visible text extracted from trusted
  `unsafeHtml`, and only then the localized map label. Popup ownership is exposed through
  `aria-controls`/`aria-expanded`; an open popup is a named
  `role="dialog"` and its localized close button exposes `part="popup-close-button"`. The map
  canvas, markers, popups, and MapLibre's own control strings all follow the component's effective
  locale.
- Ancestor theme-attribute and custom-property changes repaint the already-applied choropleth and
  data-layer colors/opacities in place. This does not recreate MapLibre sources/layers, replace the
  style, or reset the current viewport.
- a marker whose authored `color` changes for a persisting `id` is torn down and reconstructed (maplibre-gl's
  `Marker` has no `setColor()`) rather than mutated in place — this also closes any popup the user
  currently has open on that marker (a fresh, closed `Popup` is built for the new instance); an
  accepted side effect of the reconstruction fallback, not a bug.
- Clicking does not select or highlight a feature automatically. Use `setFeatureState()` with
  feature-state-aware paint for application-owned selection, or assign `anchorLngLat` and slotted
  anchor content to show feature details. Marker popups remain available through `unsafeHtml`/`label`.
- `LyraMapLegendEntry.color` is validated against a strict CSS-color-syntax allowlist before being applied
  to the legend swatch's `background-color`, rejecting anything that isn't recognizable color syntax
  (notably `url(...)`, which `background` also accepts and would otherwise fetch as soon as the
  swatch renders). The required `pattern` remains distinct in forced colors through solid, dashed,
  dotted, and double border/shape encodings.
- while the selected map peer is resolving, the host/base expose `aria-busy="true"` and show a
  decorative `<lr-skeleton shape="rect" announce="false">` in place of the map container.
  Ordinary sr-only text preserves the localized `loading` label without creating a shadow live
  region.
- `initialization='visible'` (the default) waits for the element to intersect the viewport before
  constructing its map and WebGL context. `idle` and `eager` select the other admission modes.
  Deferred construction shows the localized initialization placeholder; `map` remains undefined
  and `lr-map-load` waits for construction. Without `IntersectionObserver`, visible admission
  proceeds once the peer and caller inputs are ready.
- Once constructed, the owner realm's `ResizeObserver` watches the rendered map container and calls
  the current peer's `resize()` on allocation changes. It is replaced on reconnect/adoption and
  disconnected before peer teardown, so a stale delivery cannot resize a removed map. Browsers
  without `ResizeObserver` retain MapLibre's own window-resize behavior.

---

### Declarative globe and terrain configuration

`lr-map.projection` accepts `'mercator'` or `'globe'`. Leaving it unset preserves the projection
in `mapStyle`, including a native projection expression. Clearing an override restores the
captured configuration of the **current** style; an asynchronous style replacement establishes
a new baseline after that replacement actually loads. Removing the `projection` attribute or
assigning `undefined` releases ownership. Invalid projection strings normalize to unset.

The property-only `terrain` accepts `{ source, exaggeration? }`. `source` must name an existing
`raster-dem` source in the current `mapStyle`; the component never adds a DEM provider or removes
caller-owned sources. Exaggeration defaults to 1 and accepts finite numbers greater than or equal
to zero, with no upper cap. Assign `null` to disable terrain explicitly, or `undefined` to restore
the current style's terrain. The record is snapshotted on assignment; replace the record to change
it. The new settings do not change the existing camera, overlay or control ownership contracts.

```ts
import '@aceshooting/lyra-ui/components/lr-map.js';
import type { LyraMapTerrain } from '@aceshooting/lyra-ui/components/lr-map.js';

const map = document.querySelector('lr-map')!;
// Supply mapStyle with a raster-dem source named "elevation" before enabling terrain.
const terrain: LyraMapTerrain = { source: 'elevation', exaggeration: 1.5 };
map.projection = 'globe';
map.terrain = terrain;
await map.whenIdle();

map.terrain = null;       // Disable terrain, preserving its source.
await map.whenIdle();
map.projection = undefined;
map.terrain = undefined;  // Restore this style's original configuration.
await map.whenIdle();
```

Initial overrides and style-replacement replay are included in `whenStyleReady()` and
`lr-map-style-load`. A same-style change leaves that completed style barrier alone; await
`whenIdle()` for each new configuration. An equal effective configuration does not call the
native setters again. Superseded preparation cannot mutate a newer style or a disconnected map.

Unsupported capabilities, malformed terrain or a missing/wrong-kind elevation source reject
readiness with `MapReadinessError` and show the existing localized map fallback. Native setters
are not an atomic transaction; a failed application retires the map instead of reporting a
partially configured scene as ready. Reconnect or assign a valid `mapStyle` to retry. Do not
mutate native projection/terrain while the matching declarative override owns it; clear the
override first. Native toolbar controls are not added by these properties: compose ordinary
Lyra buttons and a slider around the map, or opt into the component-owned toggles below. Terrain exaggeration is
a display scale, not a physical simulation.

### Component-owned globe and terrain controls

`controls.globe` accepts `true` or `{ position?, order? }`. `controls.terrain` accepts
`false` or `{ source, exaggeration?, position?, order? }`; the source is required and `true`
is not accepted. Both default to `top-right`, order 0. Equal-order controls read navigation,
scale, geolocate, globe, terrain, attribution. Existing corner mirroring follows RTL.

```ts
map.controls = {
  globe: true,
  terrain: { source: 'elevation', exaggeration: 1.5 },
};
```

Installing or changing these controls does not change the scene. Activation assigns `projection`
or `terrain` first, then emits a noncancelable request event: `lr-map-projection-change` carries
`{ projection, source: 'control' }`; `lr-map-terrain-change` carries
`{ terrain, source: 'control' }`. Await `whenIdle()` for application. Programmatic changes and
style replay do not emit either event. A controlled application can synchronously reassign the
property in the event handler; its latest assignment wins.

Pressed state reflects settled native configuration. Literal globe is pressed, mercator is not;
expression-valued projection is mixed. Transition metadata does not change a literal's state.
The terrain toggle disables any active terrain, including a different source; enabling uses its
configured source and scale. A missing enable source disables that action with localized feedback;
disabling active terrain remains available. Source availability recovers after style/source updates.
Controls are disabled while scene changes are pending. `whenControlsReady()` covers installation,
not terrain tiles or scene application. Showing a control never downloads or guesses a DEM source.

Use `globe-control`, `globe-button`, `globe-icon`, `terrain-control`, `terrain-button` and
`terrain-icon` parts for the owned chrome. Labels use `mapGlobe` and `mapTerrain` localization keys.

## `lr-map-anchor`

Experimental. An independent panel of rich, interactive content anchored to a coordinate of its
`lr-map`. Whoever owns it opens, moves and closes it without touching the map's other anchors or
its `anchor` slot, so several feature-detail panels, owned by separate modules, can be open at once.
The content stays your own light-DOM nodes, never cloned, serialized or moved, so their listeners,
component state and application CSS survive camera moves, off-screen hiding, `mapStyle`
replacement and map reconnects. `lr-map.js` does not register it; import it as well:

```js
import '@aceshooting/lyra-ui/components/lr-map.js';
import '@aceshooting/lyra-ui/components/lr-map-anchor.js';
```

**Attachment:** make it a direct child of `lr-map`, where it assigns itself `slot="anchors"` unless a
`slot` is authored, or author `slot="anchors"` yourself. Author it in server-rendered and hydrated
markup, so the server and client markup match. An element assigned to the map's `anchors` slot may
also wrap anchors (a framework component host); it renders inside the map, so it should hold only
anchors. An anchor outside a map, in another slot or inside another anchor's content stays hidden,
with a development warning while it is open, and `focusContent()` returns `false`.

**Properties:**

- `open: boolean = false` (attribute `open`, reflected) — the owner's open request. The close
  button, Escape and `close()` write `false`; assigning it never emits events.
- `lngLat?: readonly [number, number] | null` (property only) — where the panel points,
  `[longitude, latitude]`. Compared by identity like the map's `anchorLngLat`, so assign a new array
  to move it. A missing or invalid coordinate hides the panel without closing it.
- `closable: boolean = false` (attribute `closable`, reflected) — adds the localized close button
  and nonmodal Escape ownership. `close()` works either way.
- `label?: string` (attribute `label`) — names the panel, which then becomes a `role="group"`. A host
  `aria-label` wins. Without a name the content owns its semantics; for dialog semantics, put
  `role="dialog"` and its labelling on your content root.
- `boundary?: LyraMapAnchorBoundary` (property only) — extra clipping elements, as for the map's
  `anchorBoundary`, which applies while this is `undefined`; `[]` opts out of the map's.
- `safeArea?: LyraMapAnchorSafeArea` (property only) — logical CSS-pixel insets inside the map
  allocation, as for the map's `anchorSafeArea`, which applies while this is `undefined`; `{}` opts
  out of the map's. Logical edges follow the map's direction, never the anchor's or the content's.

**Methods:**

- `close(): boolean` — requests a close with reason `'api'` whether or not the panel is shown (for
  example an off-screen panel whose layer was switched off). Returns `true` only when it closed:
  `false` when it was not open, when a listener vetoed the request, or when the request listener
  changed `open`, `lngLat` or the anchor's map. The map's `closeAnchor()`, by contrast, acts only on a
  placed slot anchor.
- `focusContent(): boolean` — synchronously focuses the first eligible content control, else the
  close button. Returns `false` while the panel is hidden or not yet placed, when it is inert, or when
  nothing in it can take focus. It never queues focus.

**Events:** `lr-close-request` and `lr-close` both bubble, are composed and carry a frozen
`detail: { reason }` (`LyraMapAnchorCloseDetail`, with `reason` `'api'`, `'close-button'` or `'escape'`).

- `lr-close-request` — cancelable, before a requested close; `preventDefault()` keeps the anchor
  open.
- `lr-close` — after an accepted close has set `open = false`. Not fired when the panel merely
  hides, for an `open = false` assignment, or for removal or disconnect. A listener may reopen the
  anchor (focus then stays where it is) or remove it.

The names are the library's shared dismissal pair, so they also bubble through a surrounding dialog
or drawer: an ancestor that handles only its own dismissal checks `event.target`. The map's
`lr-map-anchor-close` never fires for these anchors.

**Slots:** the default slot holds the anchored content, any light DOM. `close-icon` replaces the
close glyph.

**CSS parts:** `base` (the positioned panel surface; a `z-index` set here replaces the automatic
ordering), `body` (the scrolling content wrapper), `close-button` (the localized icon close button),
`close-icon` (the wrapper of the close glyph).

**CSS custom states:** `placed`, while the panel is placed and shown.

**Themeable custom properties:** none of its own. The close button follows the map's four
`--lr-map-popup-close-button-*` properties (`hover-bg`, `hover-color`, `active-bg`, `active-color`),
which inherit from `lr-map` or any ancestor.

**Placement and visibility:** while `open`, with a valid `lngLat` and content, the panel sits 12px
above the point, flips below it near the top edge and shifts on both axes to stay inside the map
allocation minus the safe area and boundaries, with 8px padding, following the point through every
camera move and resize without moving the camera. Its maximum size follows the available space and
`body` scrolls. It hides, without closing and without events, while the point is off the map, the
content is empty, the anchor is `hidden`, the map is not ready, inert or disabled, or the remaining
area is 16px or less on either axis; it returns, without taking focus, once that changes. It stays
placed through a `mapStyle` replacement and re-places when the new style is restored. At most 16
open anchors of one map are placed, in document order; later ones wait, hidden and with a
development warning, until an earlier one closes.

**Stacking, focus and Escape:** anchors do not avoid each other. Overlapping panels are painted in
the order they were last opened, focused or pressed, with the anchor containing focus in front;
the ordering never moves the elements, so Tab keeps document order (the map, its `anchor` slot,
these anchors, then the legend). The panels share the map's stacking context above the legend and
controls, so a `z-index` on `lr-map-anchor::part(base)` still interleaves one panel with your page
panels. Opening never moves focus, except to an `[autofocus]` element of the content on the first
placement after `open` becomes true. When a shown anchor that holds focus hides, closes or is
removed, focus returns to where it entered from, else to the map, unless it has already moved
elsewhere. On Escape a closable anchor closes after any overlay open inside it: the anchor
containing focus first, else the frontmost closable one.

```js
const map = document.querySelector('lr-map');
map.anchorSafeArea = { blockStart: 72 }; // keeps every anchor clear of a search bar

/** One module's panel: its own element, listeners and lifetime. */
function openDetails(details, lngLat, label) {
  const anchor = document.createElement('lr-map-anchor');
  anchor.lngLat = lngLat;
  anchor.closable = true;
  anchor.label = label;
  anchor.append(details); // your own live element
  anchor.addEventListener('lr-close', () => anchor.remove(), { once: true });
  map.append(anchor);
  anchor.open = true;
  return anchor;
}
```

Declaratively, for example with Lit:

```js
html`<lr-map .mapStyle=${style}>
  <lr-map-anchor slot="anchors" open closable label="Place details" .lngLat=${place.lngLat}
    @lr-close=${() => { this.place = null; }}>
    <place-card .place=${place}></place-card>
  </lr-map-anchor>
</lr-map>`;
```

**A fixed header over scrolling details:** turn the body into a column that does not scroll itself,
and let a region of your content scroll instead.

```css
lr-map-anchor::part(body) { display: flex; flex-direction: column; overflow: hidden; }
.detail-card { display: flex; flex-direction: column; min-block-size: 0; }
.detail-card > .rows { min-block-size: 0; overflow: auto; }
```

**Frameworks:** React 19, Svelte 5, Vue 3 and Lit set the properties and listen to `lr-close`
directly. In Vue, bind the property-only members with `.prop` when the element may upgrade after
the first render, as for every property-only Lyra member. Angular needs `CUSTOM_ELEMENTS_SCHEMA`;
when a component host wraps the anchor, that host carries `slot="anchors"`, or the anchor sits in an
`ng-container`.

**Known gotchas:**

- `exportImage()` never includes anchors, like every other DOM overlay.
- Two anchors at the same coordinate with the same content size cover each other exactly; Tab or a
  press brings the covered one to the front.

---

## `lr-drop-zone`

A drag-and-drop region wrapper with no file input of its own. Wrap it around an arbitrary region —
a chat composer, a whole conversation viewport, a panel far larger than any single control — to
make that entire region a file-drop target: it owns the drag-session state, renders a themeable
drag-over overlay, applies `accept`/size/count limits, and emits the same `lr-files` event shape
`lr-file-input` does. It never renders a native file picker, a selected-file list, or any focusable
control of its own; wrap `lr-file-input` itself (or any other focusable content) inside it when the
region also needs a click-to-browse affordance. The drag-session mechanics are the exact ones
`lr-file-input` uses, shared through `internal/drop-session-controller.ts` rather than
reimplemented.

**Properties:**

- `disabled: boolean = false` (reflected) — disables drag/drop handling entirely; the wrapped
  content keeps its own interactivity
- `multiple: boolean = false` (reflected) — opts into more than one file per drop and recursive
  folder-drop traversal, matching `lr-file-input`. Explicit `multiple="false"` remains false;
  removal restores single-file mode. Set `multiple` to preserve the former batch default.
- `accept: string = ''` — identical native-`accept`-style parsing to `lr-file-input`'s `accept`, via
  the same shared `matchesAccept()`
- `maxFileSize: number = 0` (attribute `max-file-size` — bytes; `0` disables the check), `maxFiles:
  number = 0` (attribute `max-files`), `maxTotalSize: number = 0` (attribute `max-total-size`) —
  identical contract and invalid-override fail-safe fallback to `lr-file-input`'s own three limits.
  Since this component retains nothing of its own between drops, `maxFiles`/`maxTotalSize` would
  otherwise always cover only the current drop — `heldFileCount`/`heldTotalSize` below are what let
  a cumulative cap span separate drops.
- `heldFileCount: number = 0` (attribute `held-file-count`) and `heldTotalSize: number = 0`
  (attribute `held-total-size`) — externally held baseline added to the running count/byte-total
  `maxFiles`/`maxTotalSize` evaluate against, identical contract to `lr-file-input`'s own
  `heldFileCount`/`heldTotalSize`: `0` (the default) means "nothing held" and reproduces prior
  behavior exactly, and a negative, `NaN`, or `Infinity` override is normalized to `0` via
  `finiteCount` rather than corrupting every later comparison.
- `allowedMimeTypes` / `forbiddenMimeTypes: readonly string[] = []` (property only) — exact MIME
  allow/deny lists, identical to `lr-file-input`'s (denylist first); a mismatch rejects with `'type'`.
- `acceptedMessage` / `rejectedMessage: string` (attributes `accepted-message` / `rejected-message`) —
  caller-owned outcome copy with `{count}`; unset uses the localized default.
- `readonly dragging: boolean` — `true` during an active drag session
- `size: LyraSize = 'm'` (reflected) — density tier for the overlay's padding, icon and
  instructional text; identical contract and scale to `lr-file-input`'s own `size`, so a drop-zone
  can match a neighboring small-tier `lr-file-input` in the same dense layout.

**Events:** `lr-files` (`detail: LyraDropZoneFilesDetail`, with fresh frozen readonly `files` and
`rejected` arrays and frozen rejected-file records, plus `remainingFiles`/`remainingTotalSize`
reporting the allowance still left under `maxFiles`/`maxTotalSize` after this drop (`null` while
that limit is unset), fired on drop; immutable `File` objects retain identity) — typed as
`LyraDropZoneFilesEvent`, so `event.target`/`event.currentTarget` are `LyraDropZone` without a
cast. `LyraDropZoneRejectedFile = { readonly file: File; readonly reason: 'type' | 'count' | 'size'
| 'directory' | 'read' | 'limit' | 'maxFiles' | 'maxTotalSize' }`, the same reason vocabulary as
`lr-file-input`'s `LyraFileInputRejectedFile`.

**Slots:** the default slot is the wrapped region, rendered as ordinary light DOM; `overlay`
overrides the localized accept/reject overlay text.

**CSS parts:** `base` (wraps the default slot and the overlay), `overlay` (the drag-over overlay,
layered above the slotted content via `position: absolute; inset: 0`, hidden outside an active drag
session), `overlay-icon`, `overlay-text`, `status` (a visually-hidden, `aria-hidden` mirror of the
drag state and counts — announcements go through the shared light-DOM regions, same as
`lr-file-input`), `rejection` (a visible region listing each currently-rejected file, rendered only
while one exists).

**CSS custom states:** `dragging`, matching `lr-file-input`'s.

**Themeable custom properties:** `--lr-drop-zone-radius` (default `var(--lr-radius)`),
`--lr-drop-zone-overlay-border-color` (default `var(--lr-color-brand)`, the dashed overlay border in
its neutral drag state, before an accept/reject verdict) and `--lr-drop-zone-overlay-bg` (default
`color-mix(in srgb, var(--lr-color-brand) 8%, transparent)`, that same neutral state's fill),
`--lr-drop-zone-overlay-font-size` (default `var(--lr-font-size-md-sm)`, retuned per `size` tier),
`--lr-drop-zone-overlay-icon-size` (default `var(--lr-font-size-xl)`, retuned per `size` tier),
`--lr-drop-zone-overlay-padding` (default `var(--lr-space-l)`, retuned per `size` tier),
`--lr-drop-zone-overlay-gap` (default `var(--lr-space-xs)`), and the drag accept/reject highlight —
`--lr-drop-zone-accept-border-color`/`--lr-drop-zone-accept-bg` (defaults `var(--lr-color-success)`/
`color-mix(in srgb, var(--lr-color-success) 12%, transparent)`) and
`--lr-drop-zone-reject-border-color`/`--lr-drop-zone-reject-bg` (defaults `var(--lr-color-danger)`/
`color-mix(in srgb, var(--lr-color-danger) 12%, transparent)`) — independently overridable on the
element or any ancestor, mirroring `lr-file-input`'s equivalent hooks.

**Optional peer deps:** none.

```html
<lr-drop-zone id="chat-surface" accept="image/*,.pdf" max-files="5">
  <div class="chat-panel">
    <!-- an existing chat composer / viewport, unrelated to this component -->
  </div>
</lr-drop-zone>
<script>
  document.querySelector("#chat-surface").addEventListener("lr-files", (e) => {
    console.log("accepted:", e.detail.files, "rejected:", e.detail.rejected);
  });
</script>
```

Composing `lr-file-input` inside the wrapped region gives that region both a click-to-browse picker
and a drop target covering the whole surrounding panel. A drop on the nested input is handled by the
input alone (the zone only ends its own drag session), so one drop fires one `lr-files`; the nested
input's and `lr-attachment-trigger`'s `lr-files` still bubble through the zone with the same detail
shape, so check `event.target` when a zone-level listener must react to the zone's own drops only:

```html
<lr-drop-zone>
  <div class="chat-panel">
    <lr-file-input></lr-file-input>
  </div>
</lr-drop-zone>
```

**Known gotchas:**

- No paste-from-clipboard handling (unlike `lr-file-input`, which accepts pasted files unless
  `without-paste` is set) — this component is drag/drop only.
- Dragged folders are traversed recursively while `multiple` (not the default here), with the same
  10,000-entry budget and `'read'`/`'limit'` failure reasons as `lr-file-input`. While not
  `multiple`, a dropped folder is rejected outright with reason `'directory'`.

---

## `lr-file-input`

A form-associated drag-drop + click-to-browse file dropzone. It stores and renders raw `File[]`;
no client-side CSV/XLSX/etc. parsing is performed (that's left entirely to the host).

Removing `label` or `hint` consumes it as absent without changing the property's `null` readback. An
explicit empty string remains empty. Text chrome and label/description associations disappear when
no corresponding slot or explicit presence hint remains, and a later value restores them. The
form label (`label`) and the dropzone instruction are independent surfaces: setting, clearing or
removing `label` never changes the dropzone text. Disabled file removal buttons,
including fieldset disablement, retain resting foreground and background under hover and press;
enabled buttons retain pointer feedback.

The auto-sized host includes the label, dropzone, selected files and visible feedback, including
inside intrinsic grid rows. A definite host height (such as an absolutely positioned full-area
drop target) gives the dropzone the remaining space after the other field content; leave enough
height for that content and the dropzone's minimum size.

**Properties:**

- `multiple: boolean = false` (reflected) — `multiple="false"` reads as false, like
  `lr-drop-zone` and `lr-attachment-trigger`; bare `multiple` opts into batches
- `disabled: boolean = false` (reflected)
- `files: File[] = []` — selected files; programmatic writes are event-silent and immediately
  synchronize rendering, validity, and form submission
- `readonly fileCount: number` and `readonly dragging: boolean` — derived state. Assigning `files`
  updates the selected-file count; real drag events alone own the drag session and its
  accept/reject state.
- `name: string | null = null`, `required: boolean = false`, `form`, `labels`, `validity`,
  `validationMessage`, and `willValidate` — standard form-associated surface. One file submits as a
  `File`; `multiple` submits repeated entries under `name`
- `customError: string | null` (attribute `custom-error`) — reflected consumer validation message;
  a non-empty value blocks submission until cleared with `setCustomValidity('')` or
  `resetValidity()`
- `accept: string = ''` — a native-`accept`-style string (`.csv,.xlsx`, `text/csv`, `image/*`, or any
  comma-separated mix); now enforced on **both** the native picker dialog and the drag-drop path, see
  gotchas
- `capture: '' | 'user' | 'environment' = ''` — forwarded to the native file picker
- `allowedMimeTypes: readonly string[] = []` (attribute: false) — exact MIME-string allowlist
- `forbiddenMimeTypes: readonly string[] = []` (attribute: false) — exact MIME-string denylist,
  checked **before** (and taking precedence over) `allowedMimeTypes`. Both properties take frozen
  snapshots, retain valid string entries, and inspect at most 10,000 candidates per assignment;
  update them by assigning a new collection.
- `maxFileSize: number = 0` (attribute `max-file-size` — bytes; `0` disables the check)
- `maxFiles: number = 0` (attribute `max-files`) — largest total file count accepted, counting
  retained files (unless `nonRetaining`; a single-file input replaces its file, so it retains
  none) plus `heldFileCount` plus the current batch; `0` disables the check. An excess file in the batch is rejected with reason `'maxFiles'`, in the same
  `[part="rejection"]` shape as `maxFileSize`.
- `maxTotalSize: number = 0` (attribute `max-total-size`) — largest combined byte size accepted,
  summing retained files (unless `nonRetaining` or a single-file input) plus `heldTotalSize` plus
  the current batch; `0` disables the check. Same rejection-UI shape and fail-safe invalid-override behavior as
  `maxFileSize` (see gotchas).
- `heldFileCount: number = 0` (attribute `held-file-count`) — externally held file count added to
  the running count `maxFiles` evaluates against, in both retaining and `nonRetaining` modes — the
  numeric counterpart of `valuePresent`, for a cumulative cap (e.g. a server-backed upload limit)
  that spans separate picker sessions rather than resetting to what this control alone can see. `0`
  (the default) means "nothing held" and reproduces prior behavior exactly. A negative, `NaN`, or
  `Infinity` override is normalized to `0` via `finiteCount` rather than corrupting every later
  comparison or permanently blocking every future file.
- `heldTotalSize: number = 0` (attribute `held-total-size`) — externally held byte total added to
  the running size `maxTotalSize` evaluates against, in both retaining and `nonRetaining` modes.
  Same contract, default, and invalid-input normalization as `heldFileCount`.
- `nonRetaining: boolean = false` (reflected, attribute `non-retaining`) — opt-in mode where an
  accepted selection still fires `lr-files`/`input`/`change` but is never written to `files` or
  rendered as a built-in `[part="file"]` row. For a host that persists files elsewhere and renders
  its own list, so assigning `files` (even to reset it) never fights that host-owned rendering.
  `required` validity and the `blank` custom state then read `valuePresent` instead of
  `files.length`. Does not affect `formStateRestoreCallback()` or a direct `files` assignment, both
  of which still retain.
- `valuePresent: boolean = false` (reflected, attribute `value-present`) — external "a value is
  present" signal a `nonRetaining` host sets once it has taken ownership of the selected files, so
  `required` validity and the `blank` state reflect externally-held files. Ignored while
  `nonRetaining` is `false`.
- `directory: boolean = false` (reflected) — enables native directory selection where supported
- `withoutPaste: boolean = false` (reflected, attribute `without-paste`) — ignores files pasted
  into the dropzone, which are otherwise accepted.
- `label?: string` — form-control label, rendered in `form-control-label` and naming the dropzone
  button (unless a host `aria-label` or `accessibleLabel` is set). It never replaces the dropzone
  instruction — customize that with the `dropzone` slot or the `fileInputDefaultLabel` string.
  Omitted, `''` and whitespace-only values render identically: no visible label, and the button is
  named by the localized instruction. `hint: string = ''`
  remains empty when omitted and can be supplied through the named slot as well
- `errorText: string = ''` (attribute `error-text`) — plain-text owned validation feedback. When
  it is empty, a `customError` message is rendered when present; otherwise an intrinsic validation
  message appears after the control has been interacted with. Rich `error` slot content replaces
  that text.
- `withLabel: boolean = false`, `withHint: boolean = false`, and `withError: boolean = false`
  (attributes `with-label`, `with-hint`, and `with-error`) — SSR slot-presence hints. Use
  `with-error` when the rich `error` slot is populated in initial declarative-shadow-DOM output,
  before hydration can observe the assigned light-DOM content.
- `size: LyraSize = 'm'` (reflected) — tier for the whole dropzone (see the custom properties
  below); `s` and the steps below it give a denser dropzone for constrained spaces (a toolbar, a
  table cell).
- `validators: LyraFileInputValidator[] = []` (attribute: false) — additional JavaScript
  constraints, run after the intrinsic `required` check. It implements the same contract as `lr-date-input`/`lr-combobox`:
  - a function `(files: File[], input: LyraFileInput) => void | boolean | string | ValidityStateFlags`
    — `undefined`/`true` passes, a string is the validation message (raising `customError`), `false`
    is a generic failure using the localized `valueInvalid` string, and a `ValidityStateFlags` object
    names the flags to raise;
  - an object with `validate(files, input)` returning the same shapes;
  - the mapped object-validator shape `{ observedAttributes?, checkValidity(input), message? }`,
    whose `checkValidity()` returns `{ isValid, invalidKeys, message }`. Unrecognized `invalidKeys`
    are dropped, and an empty mapped set synthesizes `customError`. The message falls back from the
    result's own `message` to the validator's static or function `message`, then to the localized
    default. Attributes listed in `observedAttributes` are watched on the host and revalidate live.
    Validators run in order and the first failure wins. A validator that throws fails closed with the
    localized generic message rather than escaping into the caller. Unreadable proxy-backed
    validator collections/results are contained too: a collection or result trap fails closed,
    returned validity flags are copied through the native flag vocabulary, and an unreadable
    `observedAttributes` list is skipped without rejecting the component's update. The public array
    remains the live mutable mirrored contract; each validation/observer pass takes only a transient
    iteration snapshot. `checkValidity()` and `reportValidity()` recompute at call time, so a
    validator that starts failing without any host property changing is still seen. Own or
    fieldset-cascaded `disabled` bars configured validators exactly as it bars the intrinsic
    constraint. Exported types:
    `LyraFileInputValidator`, `LyraFileInputValidatorResult`, `LyraFileInputObjectValidator`,
    `LyraFileInputObjectValidatorResult`.
- `validationTarget: HTMLElement | undefined` — the focusable base of the dropzone control after
  first render. Assign another shadow descendant to override where native constraint-validation UI
  is anchored; assign `undefined` to restore the default focusable base
- `acceptedMessage?: string` (attribute `accepted-message`) — live-region message after an
  accepted selection; `{count}` is replaced with the accepted count. Absence uses the localized
  singular/plural `fileInputAcceptedOne`/`fileInputAcceptedMany` default. Every explicit string,
  including empty and the former `'{count} file(s) added.'` English default, wins verbatim.
- `rejectedMessage?: string` (attribute `rejected-message`) — live-region message after rejected
  files; `{count}` is replaced with the rejected count. Absence uses the localized singular/plural
  `fileInputRejectedOne`/`fileInputRejectedMany` default. Every explicit string, including empty
  and the former `'{count} file(s) rejected.'` English default, wins verbatim.

**Methods:** `openPicker()` programmatically opens the native file dialog; `focus(options?)`,
`blur()`, and `click()` forward to the interactive dropzone. Standard FACE methods are
`getForm()`, `checkValidity()`, `reportValidity()`, `setCustomValidity(message)`, and
`resetValidity()`; reset clears only consumer custom validity and restores current intrinsic
`required` validity.

**Events:** a user selection or removal emits native bubbling/composed `input`, `lr-input`,
native `change`, then `lr-change`; the typed pair carries `{ value: readonly File[] }` with a frozen
snapshot of the current files and preserves each File identity. Programmatic `files` writes are
silent (the event pairs still fire while `nonRetaining` is set,
even though `files` itself is not written in that mode). `lr-files` (`detail:
LyraFileInputFilesDetail`, with fresh frozen readonly `files` and `rejected` arrays and frozen
rejected-file records, plus `remainingFiles`/`remainingTotalSize` reporting the allowance still left
under `maxFiles`/`maxTotalSize` after this batch (`null` while that limit is unset), fired on both
drop and manual file-picker selection; immutable `File` objects retain identity) — typed as
`LyraFileInputFilesEvent`, so `event.target`/`event.currentTarget` are `LyraFileInput` without a
cast. `LyraFileInputRejectedFile = { readonly file: File; readonly reason:
'type' | 'count' | 'size' | 'directory' | 'read' | 'limit' | 'maxFiles' | 'maxTotalSize' }`: `'type'`
from `accept`/`allowedMimeTypes`/`forbiddenMimeTypes`, `'count'` when a single-file input
(`multiple` unset) receives more than one file (in which case _all_ files are rejected, none
accepted), `'size'` from `maxFileSize`, `'maxFiles'`/`'maxTotalSize'` from the two aggregate limits,
`'directory'` for a dropped folder in single-file mode, `'read'` when a file/directory reader fails,
or `'limit'` when folder traversal exceeds its bounded entry budget. Read/limit failures reject the
complete selection atomically; lifecycle cancellation and supersession stay silent. `focus`/`blur`
fire when the semantic dropzone (the actual keyboard-focusable element, not the hidden native
`<input>`) gains/loses focus. `lr-invalid` is the bubbling/composed alias of native invalidity.

Each rejected file also renders as its own line in the visible `[part="rejection"]` region, naming
the file and the reason via one of eight locale keys: `fileInputRejectedType` (default
`'{filename}: this file type is not accepted.'`), `fileInputRejectedSize` (default
`'{filename}: this file is too large.'`), `fileInputRejectedCount` (default `'{filename}: only one
file can be selected at a time.'`), `fileInputRejectedMaxFiles` (default `'{filename}: the maximum
number of files has been reached.'`), `fileInputRejectedMaxTotalSize` (default `'{filename}: adding
this file would exceed the total size limit.'`), and — for `'directory'` — the pre-existing
`fileInputFolderRejected` (default `'Folders are not accepted here.'`, reused verbatim, so it has no
`{filename}` placeholder). Terminal traversal failures use `fileInputRejectedRead` (default
`'{filename}: the file could not be read.'`) and `fileInputRejectedLimit` (default
`'{filename}: the folder contains too many entries.'`). The filename is interpolated as
caller-supplied data, never localized itself. The same per-reason text is announced assertively;
the region is cleared (and unrendered) as soon as a subsequent selection rejects nothing.

**Slots:** `dropzone` (with the default slot retained as its fallback) supplies custom dropzone
content; `label`, `hint`, and `error` supply form chrome. Slotted dropzone content does not name the
control: the semantic button's accessible name comes from a non-empty host `aria-label` (or
`accessibleLabel`), then the form label (`label` or the `label` slot), then the localized instruction, so icon-only slot
content still announces correctly. Slotted content is a sibling of
the button rather than nested inside it: links, buttons, inputs, and other interactive slotted
controls keep their own activation and do not also open the picker; clicking non-interactive custom
content still activates the dropzone.

**Form label vs. dropzone instruction.** The two are separate surfaces; pick one of these patterns:

- `label` plus the default instruction: `<lr-file-input label="Reference files">` shows the form
  label above the localized drop-or-browse text.
- `label` plus a custom instruction: add `<span slot="dropzone">Drop PDFs here or browse</span>`.
- App-wide or per-instance copy: override `fileInputDefaultLabel` through `registerLyraLocale()` or
  `.strings`.
- Icon-only: a slotted glyph plus a host `aria-label` (the `AccessibleNameOverride` story).

Custom slotted text without a `label` should carry a matching host `aria-label`, so the accessible
name contains the visible text. A component that renders `lr-file-input` inside its own shadow root
must slot that copy itself, because per-instance `.strings` does not cascade into nested components;
`lr-eval-dataset` is the in-library example.

The semantic button describes its rendered owned error and hint in that order. A supplied
`errorText` or `error` slot marks it `aria-invalid="true"`; a required intrinsic message appears
after interaction, while a custom validity message is immediately visible and survives native form
reset until `resetValidity()` or `setCustomValidity('')` clears it.

**CSS parts:** `file-input` (the native dropzone button, visually behind but semantically beside
the slotted content) and `form-control` (the complete form-control
frame), `form-control-label`, `hint`, `error`, `dropzone`, `dropzone-icon`, `dropzone-text`,
`input`, `file-list`, `file`, `file-thumbnail`, `file-image`, `file-icon`,
`file-details`, `file-name`, `file-size`, `remove-button`, `status` (a visually-hidden,
`aria-hidden` mirror of the drag accept/reject state and the aggregate accepted/rejected count),
`rejection` (a **visible** region, rendered only while a rejection exists, listing each
currently-rejected file next to a per-reason message — in addition to, never in place of, the
sr-only `status` mirror above)

**Both live regions moved out of the shadow root (public surface change).** Neither `status` nor
`rejection` carries a live-region role any more: `status` is an `aria-hidden` mirror, and
`rejection` is plain visible text. A live region inside a shadow root is not reliably announced
(JAWS with Firefox ignores one outright), so the announcements now go to the library's shared
**light-DOM** regions appended to the consumer's `<body>` and marked
`data-lr-live-region="polite"` / `data-lr-live-region="assertive"` — the drag/selection summary
politely, and a rejection assertively, so it still interrupts.

What this changes for you:

- **Nothing about what the visible text says or where it renders.** `[part="rejection"]`'s text is
  ordinary visible content and stays in the accessibility tree, so a user who reaches it reads it
  normally. Both parts remain the right styling hooks.
- **Read announcements from the shared light-DOM region** — query
  `[data-lr-live-region="assertive"]` or `[data-lr-live-region="polite"]` in the document rather
  than the styling parts.
- **A `::part(rejection)[role]`-style selector never matched anyway** — an attribute selector
  cannot follow `::part()`. Nothing that worked before stopped working.

**CSS custom states:** `blank` and `dragging`, plus the shared validity states `required`,
`optional`, `valid`, `invalid`, `user-valid`, and `user-invalid`. As on every other form-associated
control, `valid`/`invalid` and `user-valid`/`user-invalid` stop matching entirely while the control
is barred from constraint validation (its own `disabled`, or an ancestor `<fieldset disabled>`),
matching native `:invalid`; `required`/`optional` keep publishing.

**The required marker.** With `required` set and a populated `label`, `[part="form-control-label"]`
paints the library's shared required marker — the same `::after` rule every labelled control in
the library uses, not a copy of it, so `--lr-form-control-required-content`,
`--lr-form-control-required-color` and `--lr-form-control-required-offset` retune or suppress it
here exactly as they do on `lr-input`. See `llms/shared.md` → "The required-field marker".

**Themeable custom properties:** `--lr-file-input-gap` (default `var(--lr-space-xs)`) — gap between
the dropzone's slotted children; `--lr-file-input-radius` (default `var(--lr-radius)`) — corner
radius of `[part='file-input']`. At `size="s"` or `size="small"`,
`--lr-file-input-compact-padding`, `--lr-file-input-compact-gap`, and
`--lr-file-input-compact-font-size` optionally override the padding, content gap, and instruction
font size. They take precedence over the corresponding dropzone padding/font and general gap
properties; when omitted, the ordinary small-size geometry stays unchanged. They do not affect
unset, medium, or other sizes. `--lr-file-input-font-size` (default
`var(--lr-form-control-font-size)`) controls the label and selected-filename text size.

`size` retunes the whole dropzone, not just its label: `--lr-file-input-dropzone-font-size`
(default `var(--lr-font-size-md-sm)`) for the instructional text,
`--lr-file-input-dropzone-icon-size` (default `var(--lr-font-size-xl)`) for `[part='dropzone-icon']`,
`--lr-file-input-dropzone-padding` (default `var(--lr-space-l)`) for the dropzone's own padding, and
`--lr-file-input-detail-font-size` (default `var(--lr-font-size-sm)`) for the secondary text (hint,
validation error, each file's formatted size). Each documented default is the `m`/`medium` tier, and
each is re-declared per `size` tier — so an unset or default-size control renders exactly as before,
while `size="xl"` scales the dropzone coherently instead of enlarging the label alone. The drag accept/reject
highlight on `[part='file-input'][data-drag-state='accept'|'reject']` is independently overridable too:
`--lr-file-input-accept-border-color` (default `var(--lr-color-success)`) and
`--lr-file-input-accept-bg` (default `color-mix(in srgb, var(--lr-color-success) 8%, transparent)`)
for the drag-accept state; `--lr-file-input-reject-border-color` (default `var(--lr-color-danger)`)
and `--lr-file-input-reject-bg` (default `color-mix(in srgb, var(--lr-color-danger) 8%,
transparent)`) for drag-reject. All four are inline `var()` fallbacks at the point of use, settable
on the element or any ancestor, so a consumer can retint just this dropzone's drag highlight without
hijacking the shared `--lr-color-success`/`--lr-color-danger` tokens used elsewhere.

The **resting** dropzone — the state it spends most of its life in — has the same three hooks as of
16.0.0: `--lr-file-input-dropzone-fill` (default `var(--lr-color-surface)`),
`--lr-file-input-dropzone-border-color` (default `var(--lr-color-border)`; the dashed border style
itself is unchanged), and `--lr-file-input-dropzone-hover-border-color` (default
`var(--lr-color-brand)`), which recolours the edge whether the pointer is over the button or over
the content stacked on it. The shared field halo `--lr-form-control-focus-shadow` (default `none`)
paints a `box-shadow` while the dropzone holds focus; it is additive, so the
`[part='file-input']:focus-visible` outline is untouched. Plus shared
tokens — `--lr-space-xs`, `--lr-space-l`,
`--lr-color-border`, `--lr-color-border-subtle` (the selected-file rows' edge), `--lr-radius`,
`--lr-color-surface`, `--lr-color-text-quiet`,
`--lr-focus-ring-width/-color/-offset` (`[part="file-input"]:focus-visible` outline),
`--lr-opacity-disabled` (`:host([disabled])` dimming).

**Optional peer deps:** none.

```html
<lr-file-input id="dataset-files" multiple accept=".csv,.xlsx"></lr-file-input>
<script>
  const input = document.querySelector("#dataset-files");
  input.allowedMimeTypes = ["text/csv"];
  input.addEventListener("lr-files", (e) => {
    console.log("accepted:", e.detail.files, "rejected:", e.detail.rejected); // rejected[i].reason
  });
</script>
```

Note: `allowedMimeTypes`/`forbiddenMimeTypes` are complex properties (`attribute: false`) — set
them via JS (`el.allowedMimeTypes = [...]`), not as a JSON string attribute.

`accept.ts` exports `matchesAccept(file, accept, assumeExtensionMatch?)` (internal — not
re-exported from the package root) — parses the same three `accept` forms the browser's native
picker accepts (extension, exact MIME, `type/*` wildcard) and reports whether a `File` matches. Used
both for the drop path's real rejection and for the dragenter preview, where a `DataTransferItem` (no
`.name`, only `.type`) can't evaluate an extension pattern yet — `assumeExtensionMatch: true` treats
that as a possible match during preview so the drag-over UI doesn't flash a false "reject" state for
an extension-only `accept` list.

**Known gotchas:**

- Paste-from-clipboard **is** supported and on by default: a `paste` event on the dropzone reads
  `e.clipboardData.files` and routes it through the same accept/reject classification as a drop.
  Set `without-paste` (or `.withoutPaste = true`) to opt out.
- Dragged folders are traversed recursively in `multiple` mode with a 10,000-entry budget. A read
  failure or over-budget traversal rejects the complete drop atomically and emits one `lr-files`
  result with `rejected[].reason === 'read'` or `'limit'`, plus dedicated visible and assertive
  localized feedback. Lifecycle cancellation and supersession remain silent and emit no partial
  result. In single-file mode a folder is reported as `rejected[].reason === 'directory'` (paired
  with a synthetic zero-byte `File` carrying the folder name).
- `maxFileSize` fails safe rather than open: `0` (the default) or `Infinity` mean "no limit", but a
  `NaN`/negative value — an unparsable `max-file-size` attribute, or a config that hasn't loaded
  yet — falls back to a 25 MB cap (exported as `DEFAULT_MAX_FILE_SIZE_BYTES`) instead of disabling
  the check. `maxFiles` and `maxTotalSize` fail safe the identical way, falling back to
  `DEFAULT_MAX_FILES` (100) and `DEFAULT_MAX_TOTAL_SIZE_BYTES` (250 MB) respectively.
- The drag-session mechanics (nested-depth tracking, accept/reject preview, folder traversal) live
  in `internal/drop-session-controller.ts`, shared verbatim with `lr-drop-zone` below rather than
  reimplemented per component.
- `maxFileSize`/`accept` extension patterns can't be evaluated during the dragenter preview (no real
  `File.size`/`.name` available yet from a `DataTransferItem`) — the live preview state (border/
  background color, `status` announcement) is therefore only a best-effort hint; the authoritative
  accept/reject decision (and `rejected[].reason`) is always the one made at actual drop time.
- the click/keyboard-to-browse path is correctly operable (`role="button"`, `tabindex` 0/-1 by
  disabled, `aria-disabled`, Enter/Space handling).

---

## `lr-image-comparer`

Before/after comparison surface with two named slots and a keyboard-accessible native range handle.

**Properties:**

- `position: number = 50` (attribute `position`, reflected) — divider position from 0 to 100
- `orientation: 'horizontal'|'vertical' = 'horizontal'` (attribute `orientation`, reflected)
- `accessibleLabel: string | null` (attribute `aria-label`) — accessible name for the comparison
  and its range handle
- `beforeLabel`/`afterLabel` — fallback text for empty named slots

**Events:** exactly one owner-realm, bubbling/composed native `input` (`Event`) after every live
range update, and exactly one owner-realm native `change` (`Event`) after a gesture commits.
Each is followed by `lr-input` or `lr-change` respectively, with `detail: { value: number }`
containing the current percentage position.
`focus`/`blur` are relayed exactly once as owner-realm native `FocusEvent`s preserving
`relatedTarget`; a dirty keyboard edit commits its `change` before `blur`.

Arrow handling is explicit so browser engines cannot disagree: in horizontal orientation,
Left/Right follows the mirrored inline axis (and Up/Down increases/decreases); in vertical
orientation, Up/Left decreases toward the physical top and Down/Right increases toward the
physical bottom, independent of document direction. Home/End select 0/100 and PageUp/PageDown
move by 10. Only a primary left-button pointer may begin a drag.

**Methods:** `focus(options?)`, `blur()`, and `click()` forward to the internal range handle.

**Slots:** `before`, `after`, and `handle` (decorative content inside the visible drag handle). The
flattened `handle` subtree is always inert and hidden from assistive technology, so even an
accidentally interactive slotted descendant cannot become a second focus target; the native range
remains the sole interaction surface.

**CSS parts:** `base` and `comparison` are aliases on the same comparison viewport; `before`,
`after`, `divider`, `handle` (the full interaction wrapper), and `input` (the transparent native
range input).

**CSS custom properties:** `--lr-image-comparer-divider-width` (default
`var(--divider-width, var(--lr-size-1px))`) controls the dividing line's thickness, and
`--lr-image-comparer-handle-size` (default `var(--handle-size, var(--lr-icon-button-size))`) sizes
the visible handle in both axes. Those namespaced names are the ones to override: the bare
Shoelace-compat `--divider-width`/`--handle-size` are retained as their fallback source, but an
unprefixed custom property inherits, so setting one high up the tree silently retunes every other
element below that reads a property of the same generic name. The `dragging` CSS custom state is present only while a pointer gesture is active and is
cleared on pointer cancellation, blur, or disconnect.

```html
<lr-image-comparer aria-label="Before and after">
  <img slot="before" alt="Before" src="before.png" />
  <img slot="after" alt="After" src="after.png" />
  <span slot="handle" aria-hidden="true">↔</span>
</lr-image-comparer>
```

---

## `lr-zoomable-frame`

Sandboxed iframe preview that mirrors Web Awesome's zoomable-frame contract. It scales a real
`<iframe>` through discrete controls without changing the document's own viewport, and fills its
allocated inline size with a 16:9 aspect ratio by default (override `aspect-ratio` on the host).

Focus on either zoom control does not enter the iframe browsing context, and `blur()` does not blur
a focused zoom control.

**Properties:**

- `src: string = ''` — iframe URL. Relative, `http:`, `https:`, `blob:`, and exact `about:blank`
  values are accepted; active `data:`/`javascript:` and non-embeddable schemes are omitted.
- `srcdoc: string = ''` — inline iframe document. A present `srcdoc` wins over `src`, including an
  explicitly empty `srcdoc` attribute.
- `allowfullscreen: boolean = false`, `loading: LyraZoomableFrameLoading = 'eager'`
  (`'eager' | 'lazy'`),
  `referrerpolicy: string = ''`, and `sandbox: string = 'allow-same-origin'` forward the native
  iframe controls after validation. Invalid loading becomes `eager`; an invalid non-empty referrer
  policy becomes `no-referrer`.
- `zoom: number = 1` (reflected) — current scale. Finite programmatic values do not have to occur
  in `zoomLevels`; unsafe/non-finite layout values render as a finite positive fallback.
- `zoomLevels: string = '25% 50% 75% 100% 125% 150% 175% 200%'` (attribute `zoom-levels`) —
  decimal/percentage stops used by the controls. The cached projection reads at most the first
  16,384 UTF-16 code units and 256 whitespace-delimited tokens before deduplicating and sorting;
  a token cut by the source ceiling is ignored, and later source text cannot affect the controls.
- `withoutControls: boolean = false`, `withoutInteraction: boolean = false`, and
  `withThemeSync: boolean = false` (reflected attributes `without-controls`,
  `without-interaction`, `with-theme-sync`) — respectively remove the zoom controls, remove pointer and
  sequential-keyboard iframe interaction by making the browsing context native `inert`, and opt
  into best-effort same-origin theme sync. The inert frame also refuses programmatic focus/click
  and carries no unsupported `aria-disabled` claim.
- `accessibleLabel: string | null` (attribute `aria-label`) — titles the iframe; a host
  `aria-label` attribute does the same, and an empty attribute stays an empty title. Without
  either (or with an empty property) the iframe gets its localized purpose title.
- readonly `iframe?: HTMLIFrameElement`, `contentWindow: Window | null`, and
  `contentDocument: Document | null`. Both content accessors return `null` while detached;
  `contentDocument` also returns `null` across an origin boundary.

**Authoring type:** `LyraZoomableFrameLoading`.

**Methods:** `zoomIn()` selects the nearest configured level above the current value;
`zoomOut()` selects the nearest below it. The control group also accepts `+`/`=` and `-`/`_` while one
of its controls has focus. `focus(options?)`, `blur()`, and `click()` forward to the internal
iframe — the component's primary interactive surface — only while the component is connected and
interaction is enabled. Under `without-interaction` they are deliberate no-ops rather than an
escape around native `inert`; the two-button zoom-control group has no single primary action. Both
buttons are ordinary independent Tab stops inside a labelled `role="group"`; the container does not
claim the roving-arrow-key contract of an ARIA toolbar.

**Slots:** `zoom-in-icon` and `zoom-out-icon` replace the decorative control glyphs. Their
flattened subtrees are always inert and hidden from assistive technology, so use an SVG or glyph
rather than a second interactive control; the native zoom buttons remain the sole focus and pointer
actions.

**Events:** `lr-zoom-change` (`detail: { zoom }`) when `zoomIn()`/`zoomOut()` (buttons or keys)
change `zoom`; assigning `zoom` stays silent. Internal `focus`/`blur` from the iframe are relayed exactly once as owner-realm native
`FocusEvent`s (bubbling and composed, preserving external `relatedTarget`; a transition to or from an internal zoom control uses `null` because retargeting that control to the host would suppress the relay);
native `load` and `error` are relayed exactly once from the current iframe
generation as non-bubbling, non-composed `Event` instances. Navigation/source-policy changes
replace the iframe, so a late event from an earlier document is ignored; detached frames do not
notify.

**CSS parts:** `iframe`, `controls`, `zoom-in-button`, and `zoom-out-button`. Real focus entry into
the browsing context (Tab, pointer, or `focus()`) exposes `data-frame-focused` on the host and paints
the shared focus ring around the iframe boundary; blur, navigation rekey, disablement, and removal
clear it. Moving between the iframe and a zoom control clears or restores the marker and emits one matching native blur or focus relay; focusing a zoom control alone leaves the marker absent.

**CSS custom properties:** read-only `--lr-zoomable-frame-zoom`, resolved from the `zoom`
property and applied to the internal iframe scale; and `--lr-zoomable-frame-control-hover-bg`
(default `var(--lr-color-brand-quiet)`), which colors a zoom control on hover and supplies the base
for its active color.

**RTL behavior:** the scaled iframe is a physical canvas and remains pinned to physical top-left in
both directions. Its zoom controls remain logical interface chrome, so RTL places the control group at
inline-end (the physical left edge).

**Security and theme sync:** the iframe always keeps a `sandbox` attribute. The secure Lyra default
allows same-origin access but not scripts, forms, popups, downloads, or top navigation. Supplied
sandbox tokens are allowlisted; if both `allow-scripts` and `allow-same-origin` are requested, the
latter is dropped so framed script cannot escape a same-origin sandbox. `with-theme-sync` never
widens those permissions: when the document is accessible it copies only Lyra theme-selector
classes, theme attributes, computed `--lr-theme-*` inputs, and `color-scheme`; cross-origin
documents remain untouched. Turning `with-theme-sync` off restores only the iframe classes,
attributes, and inline properties Lyra changed, preserving any later iframe-owned edits. Changing
a watched host-page theme attribute syncs again.

```js
import "@aceshooting/lyra-ui/components/lr-zoomable-frame.js";
```

```html
<lr-zoomable-frame
  aria-label="Component preview"
  srcdoc="<!doctype html><html><body><h1>Preview</h1></body></html>"
  zoom="0.75"
  with-theme-sync
></lr-zoomable-frame>
```

---

## `lr-pan-zoom`

Scrollable inspection surface for slotted DOM or one image, with bounded zoom and native-scroll
panning. This is the compatibility destination for Lyra's former `lr-zoomable-frame` behavior:
existing consumers that inspect DOM/images should rename the tag to `lr-pan-zoom` (and the class
import to `LyraPanZoom`); `lr-zoomable-frame` now means the mapped iframe component above.

**Properties:**

- `zoom: number = 1` (reflected), `minZoom: number = 0.5`, `maxZoom: number = 4`, and
  `zoomStep: number = 0.25` — bounded, finite zoom configuration. Lyra anchored overlays opened in
  zoomed content (dropdowns, tooltips, popovers, selects) align with their trigger at any zoom, with
  either strategy, and render at UI scale rather than at the content's zoom
- `src: string = ''` and `alt: string = ''` — optional safe image source. A rejected URL is treated
  as absent and the default slot renders; no empty or unsafe `<img>` replaces that fallback.
- `fit: LyraImageFit = 'actual'` (reflected) — base sizing policy for an image supplied through
  `src`, using the same `contain`/`width`/`actual` vocabulary as `<lr-image-viewer>`. `actual`
  preserves the historical natural-size layout; the other modes resolve against the viewport and
  update with its allocation, including when an image loads after the frame first renders.
- `accessibleLabel: string | null` (attribute `aria-label`) — names the focusable viewport; a host
  `aria-label` attribute does the same, and an empty attribute stays empty. Without either (or with
  an empty property) the viewport gets the localized inspection-surface name.

**Methods:** `zoomIn()`, `zoomOut()`, and `resetZoom()` update zoom and emit `lr-zoom-change`
(`detail: { zoom }`). `resetZoom()` preserves pan; `resetView()` also scrolls the viewport to the
origin. Reset reaches 100% exactly whenever it is within `minZoom`/`maxZoom`; it is not quantized to
the nearest `zoomStep`. The viewport accepts `+`/`=`, `-`/`_`, and `0`, without consuming keys from
a slotted editor; with Ctrl, Cmd or Alt they stay the browser's page-zoom shortcuts. The three zoom buttons are independently tabbable inside a labelled `group`; the
container does not claim toolbar arrow-key navigation.

**Slots:** default — inspected content, ignored while `src` renders an image.

`focus(options?)`, `blur()`, and `click()` forward to the scrollable `viewport`, which is the
component's own keyboard target — a bare host `.focus()` would otherwise be a silent no-op.

**Events:** `lr-zoom-change` (`detail: { zoom }`); internal `focus`/`blur` from the viewport are
relayed exactly once as owner-realm native `FocusEvent`s (bubbling and composed, preserving
`relatedTarget`).

**CSS parts:** `base`, `viewport`, `content`, `controls`, `zoom-out`, `zoom-in`, and `reset`. The
`reset` button's visible text is the live zoom percentage, locale-formatted and recomputed from
`zoom` on every render (not a fixed "100%"). Its accessible name includes both the localized reset
action and that visible percentage, so the visible label is contained in the computed name.

**Themeable custom properties:** `--lr-pan-zoom-min-block-size` (default `var(--lr-size-10rem)`)
and the read-only `--lr-pan-zoom-zoom`. Scaling
uses layout-participating CSS `zoom`, not a paint-only transform, so the viewport's native scroll
range reaches the entire painted footprint at both logical edges in LTR and RTL.

```js
import "@aceshooting/lyra-ui/components/lr-pan-zoom.js";
```

```html
<lr-pan-zoom
  src="map-preview.png"
  alt="Map preview"
  aria-label="Map preview"
></lr-pan-zoom>
```

---

## `lr-attachment-chip`

A compact chip representing one file queued for (or already part of) a chat message — used in a
composer's pre-send attachment tray or a sent message's attachments display. Two independent ways
to populate it: set `file` to a real `File` (fresh from a picker/drop), from which `name`/`bytes`/
`mime-type` and the image thumbnail are all auto-derived; or set the plain `name`/`bytes`/
`mime-type`/`thumbnail-src` props instead, for reconstructing a chip from server-persisted
attachment metadata after a page reload, when no real `File` object exists any more. `file` always
wins when both are present. When a real `File` or `preview-src` is available, the chip offers a
localized action that emits a plain, non-cancelable `lr-preview-request`; it never registers or owns a viewer
or overlay, so the host composes the desired preview surface.

An error already present at first mount or reconnection renders as existing state without an
announcement, including a failure assigned while detached and reconnected before the next render. A
new connected transition to error still appends one localized failure announcement; repeated
connected failures remain separately announced, including a retry whose uploading and error writes
coalesce into one update.

**Properties:**

- `file?: File` (attribute `false`, i.e. property-only) — when set, `name`/`bytes`/`mimeType`/the
  image thumbnail are all derived from it, taking precedence over the independent props below
- `name: string = ''` — filename, used only while `file` is unset
- `bytes?: number` — file size in bytes, used only while `file` is unset. `0` is a known empty file
  and renders `0 B`; omission means unknown. Negative/non-finite writes normalize to omission.
- `attachmentId: string = ''` (attribute `attachment-id`) — stable domain identity carried by
  attachment action events. Empty or whitespace-only values use the fallback identity below. The
  platform `id` remains available for DOM identity/idrefs only.
- `mimeType: string = ''` (attribute `mime-type`) — used only while `file` is unset
- `thumbnailSrc: string = ''` (attribute `thumbnail-src`) — thumbnail image URL, used only while
  `file` is unset; rendered whenever present regardless of `mimeType` (no `file`-derived equivalent
  exists for a non-image file)
- `previewSrc: string = ''` (attribute `preview-src`) — source URL used for preview and download when
  `file` is unset; a real `File` takes precedence and uses a temporary blob URL
- `withoutPreview: boolean = false` (reflected, attribute `without-preview`) — hides the preview
  action, which otherwise renders whenever a `file` or `preview-src` is available.
- `status: LyraAttachmentUploadStatus = 'pending'` (reflected) — `'pending' | 'uploading' |
'error' | 'success'`; invalid values normalize to `pending`. Drives the accent tint and which of
  `progress`/`spinner`/`retry-button` renders.
- `progress: number = 0` — upload completion, 0-100; only meaningful while `status="uploading"`, a
  value of `0` or `NaN` falls back to the indeterminate spinner
- `withoutRemoveButton: boolean = false` (reflected, attribute `without-remove-button`) — hides the
  remove (×) button, which otherwise renders.
- `size?: LyraSize` (reflected, unset by default) — density on the library's one size ladder,
  `'2xs'|'xs'|'s'|'m'|'l'|'xl'` or `'small'|'medium'|'large'`. `s` and the steps below it select the
  compact density — a smaller, borderless pill instead of the default bordered chip, e.g. for a
  composer's pending-attachment tray; `m` and above keep the standard chip, and leaving it unset
  renders exactly as before. An unsupported value normalizes to unset and removes the attribute.

- `thumbnailOnly: boolean = false` (reflected, attribute `thumbnail-only`) — at the compact density,
  hides `[part='meta']` (the filename/size text) entirely for an image-mime attachment, leaving only
  the thumbnail. Has no effect for a non-image chip, or at the default density. `false` (the
  default) reproduces the chip's exact existing output. While it actually hides
  `[part='meta']`, `[part='base']` also switches to a reduced, symmetric padding sized for a lone
  thumbnail instead of the compact text row's padding — see
  `--lr-attachment-chip-compact-thumbnail-only-padding` below.
- `removeLabel?: string` (attribute `remove-label`) — the remove button's accessible name, with
  `{label}` replaced by the file name; omitted or blank, it routes through the complete localized
  `removeWithContext` template
- `retryLabel?: string` (attribute `retry-label`) — the retry button's accessible name, with
  `{label}` replaced by the file name; omitted or blank, it routes through the complete localized
  `attachmentRetryWithContext` template
- `uploadingLabel?: string` (attribute `uploading-label`) — the visible uploading status and the
  progress bar's accessible name, with `{label}` replaced by the file name and `{percent}` by the
  progress; omitted, it uses complete localized messages for progress, indeterminate state, and
  filename context so translators can reorder every value. An explicit empty value hides the
  visible status, and the progress bar keeps its localized name
- `uploadFailedLabel?: string` (attribute `upload-failed-label`) — visible status text shown for
  `status="error"`; override for i18n/locale. Omitting it reads back `undefined` and uses the
  localized default (`'Upload failed'` in English)
- `untitledLabel?: string` (attribute `untitled-label`) — fallback filename and tooltip when
  neither `file` nor `name` supplies a name. Omitting it reads back `undefined` and uses the
  localized default (`'Untitled file'` in English)

The component identifies _which_ attachment an action event is about through `attachmentId`. Set
`attachment-id="..."` when you have a stable server-side identity; when unset or whitespace-only
and `file` is set, a stable attachment id is
derived from `` `${file.name}:${file.size}:${file.lastModified}` ``; when neither is available, a
generated internal id is used as a last resort.

**Events:** `lr-remove` (`detail: { attachmentId }`; the button is not rendered while
`without-remove-button` is set), `lr-retry`
(`detail: { attachmentId }`, only rendered while `status="error"`), and
`lr-preview-request` (`detail: { attachmentId, name, mimeType, src }`) — a plain, non-cancelable
notification that the preview action was activated.

**Slots:** none.

**CSS parts:** `base`, `thumbnail`, `meta`, `name`, `size` (the formatted `bytes` count; the part
keeps its pre-rename name — it is the rendered size _text_, and renaming a part would break shipped
`::part()` rules for no gain), `status-text` (the visible text twin of
the status accent color, so the state is carried in words and not only in color; empty and hidden
for `pending`/`success`), `progress`, `progress-fill`, `spinner` (decorative/`aria-hidden` while the
adjacent `status-text` supplies the wording), `retry-button`, `preview-button`,
`remove-button`

**`status-text` carries no live-region role (public surface change).** It is plain visible text
that stays in the accessibility tree and reads normally once a user reaches the chip. The
interrupting announcement a transition _into_ `status="error"` makes — so a screen-reader user not
already focused on the chip still hears an upload failure — goes to the library's shared
**light-DOM** assertive region instead, appended to the consumer's `<body>` and marked
`data-lr-live-region="assertive"`: a live region inside a shadow root is not reliably announced
(JAWS with Firefox ignores one outright). Two consequences worth knowing:

- Only a _transition_ into `error` announces. A chip that mounts already failed is history the user
  can read at their own pace, and a retry that fails the same way twice is announced twice rather
  than being a silent no-op. The ticking `uploading` readout announces nothing at all — a live
  region re-announcing every progress tick is noise, not information.
- Read the announcement from `[data-lr-live-region="assertive"]` in the document;
  `::part(status-text)` remains the styling hook and visible-status text.

**Themeable custom properties:** `--lr-attachment-chip-accent` (default
`var(--lr-color-text-quiet)`), `--lr-attachment-chip-bg` (default `var(--lr-color-surface)`),
`--lr-attachment-chip-border` (default `var(--lr-color-border-subtle)`) — the trio's private
defaults change per `status` (`uploading` → brand/brand-quiet/transparent, `error` →
danger/danger-quiet/transparent, `success` → success/success-quiet/transparent), while an inherited
or direct public value remains authoritative; `--lr-attachment-chip-compact-thumbnail-size` (default
`1.75rem`), `--lr-attachment-chip-compact-font-size` (default `var(--lr-font-size-xs)`),
`--lr-attachment-chip-compact-gap` (default `0.25rem`) — govern the chip's thumbnail size, text
size, and internal gap at the compact density (`size="s"` and below);
`--lr-attachment-chip-spinner-duration` (default `var(--lr-transition-ambient)`) controls the
indeterminate rotation's duration and easing and stops under reduced motion.
`--lr-attachment-chip-padding` (default `var(--lr-space-xs) var(--lr-space-s)`) and
`--lr-attachment-chip-compact-padding` (default `var(--lr-size-0-125rem) var(--lr-space-xs)`) make
`[part='base']`'s padding themeable at the default and compact densities respectively — both were
previously hardcoded. `--lr-attachment-chip-compact-thumbnail-only-padding` (default
`var(--lr-size-0-125rem)`, applied symmetrically to every side) governs `[part='base']`'s padding
specifically while the compact density and `thumbnail-only` together actually hide `[part='meta']`
for an image-mime attachment — reduced from the compact padding above, since the lone thumbnail no
longer needs inline padding sized for a text row that isn't rendering. It has no effect for a
non-image chip, where `[part='meta']` stays visible and the ordinary compact padding still applies.
Plus shared tokens `--lr-space-xs`, `--lr-space-s`,
`--lr-radius`, `--lr-color-text`, `--lr-color-danger`, `--lr-icon-button-size`,
`--lr-transition-fast`, `--lr-transition-base`, `--lr-focus-ring-width`,
`--lr-focus-ring-color`, `--lr-focus-ring-offset`.

**Optional peer deps:** none.

Also exported from the package root:
`formatFileSize(bytes: number, unitLabel?: (unit: 'B' | 'KB' | 'MB' | 'GB' | 'TB') => string,
numberLabel?: (value: number, fractionDigits: number) => string): string`. `unitLabel` localizes each
selected unit abbreviation; `numberLabel` formats the scaled value and receives `fractionDigits`
as `0` for bytes or `1` for larger units. Their defaults preserve the built-in output: `512` →
`"512 B"` (whole bytes never get a decimal), `2415919` → `"2.3 MB"` (every unit past bytes gets
exactly one decimal place), and a negative or non-finite input (`NaN`, `Infinity`) returns `""` so
an unknown size renders nothing instead of `"NaN B"`. The same module's
`localizedNumberLabel(locale: string): (value: number, fractionDigits: number) => string` is the
ready-made `numberLabel` for `locale`, rendering exactly the requested fraction digits.

```html
<lr-attachment-chip
  name="report.pdf"
  bytes="245000"
  mime-type="application/pdf"
  status="success"
></lr-attachment-chip>
<lr-attachment-chip
  attachment-id="att-2"
  status="uploading"
  progress="42"
></lr-attachment-chip>
<script type="module">
  import { formatFileSize } from "@aceshooting/lyra-ui/components/media/attachment-chip/file-size.js";

  const chip = document.createElement("lr-attachment-chip");
  chip.file = pickedFile; // name/bytes/mime-type/thumbnail all derived from the File
  chip.addEventListener("lr-remove", (e) =>
    removeAttachment(e.detail.attachmentId)
  );
  chip.addEventListener("lr-retry", (e) => retryUpload(e.detail.attachmentId));
  chip.addEventListener("lr-preview-request", (e) => openPreview(e.detail));
  console.log(formatFileSize(pickedFile.size));
</script>
```

The image thumbnail for a real `File` is a cached `URL.createObjectURL()` blob URL, allocated in
`willUpdate()` — the update lifecycle, deliberately **never** from `render()`, so rendering stays a
pure projection of already-prepared state and URL allocation never happens as a render side effect.
It is created only when `file` is an image (or `without-preview` is unset), reused for as long as the same
`File` object stays assigned, and revoked when `file` changes to a different `File`, to a non-image,
or to `undefined`, and again on disconnect. Because the same pass that allocates also revokes the
previous entry, reassigning `file` several times before the next paint leaks nothing.

**Known gotchas:**

- `file` always wins over `name`/`bytes`/`mimeType` when both are set — assigning those props while
  `file` is also set has no visible effect on the rendered chip.
- A `0` `bytes` value is a known empty file and renders `"0 B"`; only omission means unknown and
  hides the `size` part. Negative and non-finite writes normalize to omission.
- `progress` only renders as a numeric bar when `status="uploading"` **and** `progress` is finite
  and `> 0`; otherwise it's either nothing (non-`uploading` status) or the indeterminate spinner
  (`uploading` with no known progress).
- `thumbnailSrc` is used whenever present regardless of `mimeType` — pass a URL that's already known
  to be an image; there's no non-image fallback check for it the way there is for `file`.
- `previewSrc` is used only when `file` is unset. A preview action is omitted when neither a real
  `File` nor `preview-src` supplies a source. The viewer's footer omits its download link for unsafe
  source schemes.

---

## `lr-file-icon`

File-format badge showing an unlocalized format token or generic glyph with a localized accessible
name for surrounding upload rows, cards, selectors, and viewer headers. The companion
`getFileTypeMetadata(mimeType, fileName?)` utility covers common document,
spreadsheet, presentation, code, archive, image, audio, and video formats. An explicit known MIME
type wins; filename extension fallback is used only for an empty or `application/octet-stream`
MIME type. Unknown values return a generic file result.

**Properties:** `mimeType` (attribute `mime-type`), `name`, `bytes` (file size **in bytes**, shown
next to the label in `mode="label"`; `0`, the default, renders no size), `label`, `decorative`,
`mode: LyraFileIconMode = 'icon' | 'label'` (invalid values normalize to `icon`), and
`registry: LyraFileTypeMetadataRegistry` (property-only, defaulting to the immutable built-in
registry). A host `aria-label` wins over the computed localized file-type/size name. `decorative`
changes the semantic owner to presentation and renders `aria-hidden="true"` explicitly.

**CSS parts:** `base`, `icon`, `label`, `description` (consumer-authored registry metadata in label
mode), and `size` (the part keeps its name — it is the rendered size _text_, and renaming a part
would break shipped `::part()` rules for no gain).

In `mode="icon"`, the badge shows a short unlocalized format token such as `PDF`, `DOCX`, or a
filename-derived extension. The first qualifying extension (1–4 ASCII letters/digits/`+`, with at
least one letter) is used when the MIME type is explicit; a filename's final extension is preferred
when resolving an empty or `application/octet-stream` MIME type. A generic file glyph is used when
no token applies, and replaces the token below about `1.25rem` (long tokens: about `1.75rem`).
Tokens use logical-start ellipsis and scale with the badge. The full localized label remains only in
the accessible name and in `mode="label"`; the host's baseline is the badge bottom edge in every
rendered token or glyph state.

**Themeable custom properties:** `--lr-file-icon-size` (default `var(--lr-size-2rem)` — the
format badge's inline and block size). `--lr-file-icon-bg` (default `var(--lr-color-brand-quiet)`)
and `--lr-file-icon-color` (default `var(--lr-color-brand)`) retint the `icon` badge — every file
category renders the same fill today, so either can be set without hijacking the shared
`--lr-color-brand-quiet`/`--lr-color-brand` tokens used elsewhere in the theme.

**Exports:** `LyraFileTypeMetadata`, `LyraFileTypeMetadataEntry`, `LyraResolvedFileTypeMetadata`,
`LyraFileTypeMetadataRegistry`, `LyraFileTypeIcon`, `LyraFileTypeCategory`,
`createFileTypeMetadataRegistry(entries)`, `defaultFileTypeMetadataRegistry`, and the compatibility
lookup `getFileTypeMetadata()`. `LyraFileTypeMetadata` also accepts an optional `abbreviation` for a
custom, unlocalized badge token. It is trimmed, blank values are absent, and a non-string or value
longer than eight code points drops the record. Registries validate and deeply snapshot records, use
deterministic longest registered-suffix matching (including multi-dot/punctuation suffixes), and
isolate custom mappings per instance instead of mutating module-global state. Consumer
labels/descriptions remain verbatim in the accessible name and `mode="label"`; built-in labels route
through localization. `fileType*` string overrides therefore never change the badge token. A
consumer record replacing a built-in MIME also owns that type's verbatim label, so an app that uses
`abbreviation` must provide its own localized label.

```html
<lr-file-icon
  mime-type="application/pdf"
  mode="label"
  bytes="245000"
></lr-file-icon>
```

## `lr-media-card`

A lightweight inline preview for one already-sent, already-available attachment inside a rendered
chat message body — distinct from `lr-document-preview` (a fuller viewer with an async
server-side-conversion state machine) and `lr-attachment-chip` (a pre-send queued-file chip with
upload progress). This component has neither concern; it only ever shows a `src` that's already
final.

Removing `mime-type` consumes the hint as absent and restores generic file detection unless `kind`
explicitly selects a format. Property readback stays `null`; an explicit empty hint remains empty
and later MIME values restore detection.

**Properties:**

- `src: string = ''` — the media URL. Always re-validated against a safe-scheme allowlist before
  use (see below) — never trust it unsanitized even though it's typed as a plain string.
- `kind?: LyraMediaCardKind` (`'image' | 'video' | 'file'`, reflected) — explicit format dispatch. Leave unset to
  auto-detect from `mimeType`.
- `mimeType: string = ''` (attribute `mime-type`) — drives auto-detection when `kind` is unset.
- `filename: string = ''` — shown in the file-chip fallback, used as the download link's suggested
  filename, and folded into the accessible name.
- `alt?: string` — alt text for the image case (and reused as a video label fallback). Unset falls
  back to `filename`, then a generic per-kind description. An explicit `alt=""` survives to the
  rendered `<img alt="">`, which is the HTML idiom for a decorative image — same contract as
  `<lr-image-viewer>` and `<lr-document-preview>`. The `<video>` case is deliberately outside that
  carve-out: an empty `alt` there still falls through to `filename`/the generic description, because
  an empty accessible name would leave an interactive player unnamed rather than mark it decorative.
- `accessibleLabel: string | null = null` (attribute `aria-label`) — a declarative attribute names
  the host as a whole while its nested button/link keeps a purpose-specific localized action name. A property-only assignment names the nested action and updates reactively when no host label is present, without creating a host attribute. An explicit
  empty string behaves like the unset `null` default — both fall through to the generated
  purpose-specific name. Image alt text and the native video's own purpose label remain independent;
  an explicitly empty host still leaves every interactive descendant named.
- `maxHeight: string = ''` (attribute `max-height`) — a CSS length (e.g. `"16rem"`); once set,
  overrides the `--lr-media-card-max-height` custom property for this instance only (applied
  inline on `[part="base"]`, so it reliably wins over a `:host{}`-declared default from outside the
  shadow root) — same contract as `<lr-document-preview>`'s identically-named prop. Values that do
  not parse as CSS `max-height`, contain declaration breaks, or contain `url()` are ignored, leaving
  the stylesheet token in control.
- `frame: LyraFrame = 'card'` (reflected) — container treatment, on the library-wide `frame`
  vocabulary. `'card'` (the default) keeps the bordered, filled box. `'plain'` removes
  `[part="base"]`'s border, background, padding, and corner radius, so a card inside a dense chat
  transcript (or any container already drawing its own separation between attachments) doesn't
  double the frame.
- `disabled: boolean = false` (reflected) — turns off this card's OWN action. The `kind="image"`
  button and the `kind="video"` `open-button` render `disabled`; a safe file chip's anchor loses
  its `href` and `download`, so it genuinely cannot fetch, and gains an explicit `role="link"` so
  its accessible name and `aria-current` stay valid on an element that no longer has an implicit
  role. `lr-media-open` and `lr-media-download-request` stop firing from every path, `click()`
  included, the action leaves the tab order, and it paints at `--lr-opacity-disabled` with a
  `not-allowed` cursor. Deliberately does NOT reach into the `kind="video"` player: `<video
  controls>` is media content with its own native transport, not this card's action. An
  unsafe-`src` file chip has no action at all, so `disabled` leaves it unchanged. Not
  form-associated, so an ancestor `<fieldset disabled>` does not cascade here. The disabled paint
  keys off the state each element already carries — `::part(base):disabled` and
  `::part(open-button):disabled` restyle the two buttons from outside; the file chip's anchor has no
  such pseudo-class, so target it through the reflected host attribute
  (`lr-media-card[disabled]::part(base)`).
- `aria-pressed` and `aria-current` (attributes only) — forwarded reactively onto whichever native
  control carries this card's action, the same mechanism `<lr-button>`/`<lr-icon-button>` use.
  `aria-pressed` accepts `'true' | 'false' | 'mixed'` and reaches BUTTONS only (`kind="image"`'s
  `base` and `kind="video"`'s `open-button`) — the file chip's anchor never receives it, because
  `link` has no pressed state. The global `aria-current` accepts `'page' | 'step' | 'location' |
  'date' | 'time' | 'true' | 'false'` and reaches every kind, anchor included. Anything outside
  those sets is dropped rather than passed through.

**Authoring types:** `LyraMediaCardKind` and `LyraMediaCardOpenDetail`; `frame` uses the shared
`LyraFrame` directly. URL validators are implementation details,
not exports from the component entry.

**Events:** `lr-media-open` (`detail: LyraMediaCardOpenDetail { src: string; filename: string }`,
noncancelable) notifies
after image-card or video open-button activation; those kinds have no component-owned navigation,
so a host decides what "open" means. `lr-media-download-request` carries the same detail and is
cancelable only for a safe file anchor immediately before its native download/open default; calling
`preventDefault()` there suppresses that exact default. `detail.src` is whichever internally
validated safe-URL sink actually rendered, not necessarily the raw `src` property verbatim — a
whitespace-padded value is trimmed, so it matches the rendered sink.
Native `focus` and `blur` are each relayed once from the current primary action as bubbling,
composed `FocusEvent`s whose target is the `lr-media-card` host.

**Methods:** `focus(options?)`, `blur()`, and `click()` forward to the primary action for the
current media kind. The forwarded focus/blur transition produces the relayed host event described
above.

**Slots:** none.

**CSS parts:** `base` (a `<button>` for `kind="image"`, a plain wrapper `<div>` for `kind="video"`,
an `<a>` or `<span>` for the file-chip fallback depending on href safety), `media` (the `<img>`/
`<video>`), `file-icon`, `filename` (file-chip fallback only), `open-button` (video only — see
below).

**Themeable custom properties:** `--lr-media-card-max-height` (default `var(--lr-size-20rem)` — caps `[part="media"]`'s
block-size so one oversized image/video can't blow out a chat bubble; same naming/contract as
`<lr-document-preview>`'s identical `--lr-document-preview-max-height`; override per-instance via
the `max-height` attribute instead of this property directly).
`--lr-media-card-bg` (default `var(--lr-color-surface)`) retints the RESTING `frame="card"`
chrome — the companion to the pressed state's `--lr-media-card-active-bg` below, and the tier a
card sits at all day; `frame="plain"` still drops the fill entirely.
`--lr-media-card-active-border-color` (default
`color-mix(in oklab, var(--lr-color-brand), var(--lr-color-mix-partner) var(--lr-color-mix-active))`)
and `--lr-media-card-active-bg` (default
`color-mix(in oklab, var(--lr-media-card-bg, var(--lr-color-surface)), var(--lr-color-mix-partner) var(--lr-color-mix-active))`)
independently retint only a pressed image/file action; the pressed default mixes from
`--lr-media-card-bg`, so retinting the resting card carries the pressed state with it. Both are inline `var()` fallbacks in the
pressed state, so values on a chat or attachment-list ancestor inherit into every card rather than
being shadowed by host defaults. Plus shared tokens
`--lr-space-xs`/`-s`, `--lr-color-border`, `--lr-color-surface`, `--lr-color-text`/`-text-quiet`,
`--lr-color-brand` (hover border), `--lr-radius`, `--lr-icon-button-size` (video's `open-button`
sizing), `--lr-focus-ring-*`, `--lr-transition-fast`.

**Optional peer deps:** none.

```html
<lr-media-card
  id="image-card"
  kind="image"
  src="https://example.com/photo.jpg"
  alt="Screenshot"
  filename="photo.jpg"
></lr-media-card>
<lr-media-card id="file-card" kind="file" src="https://example.com/report.pdf" filename="report.pdf">
</lr-media-card>
<script type="module">
  document
    .getElementById("image-card")
    .addEventListener("lr-media-open", (e) => openLightbox(e.detail.src));
  document
    .getElementById("file-card")
    .addEventListener("lr-media-download-request", (e) => shouldUseNativeDownload || e.preventDefault());
</script>
```

**Safe-URL checking.** `src` is validated by internal sink-specific helpers before it's
ever assigned to an `<img>`/`<video>` `src` or an `<a href>` — only `http:`/`https:`/`blob:` (plus
`data:` for a _media_ `src` only) or a scheme-relative/relative URL with no scheme at all pass;
anything else (`javascript:`, `vbscript:`, and similarly suspicious schemes) is rejected. `data:` is
allowed for a media source (a browser never executes script from a media element's `src`) but
rejected by the stricter link validator (a `data:text/html` URI navigated to via a clicked `<a
href>` runs as a full document and can execute script) — the same scheme gets a different verdict
depending on which DOM sink it's headed for. Both validators delegate to the platform's own `new
URL()` parser rather than a hand-rolled scheme regex, specifically because `new URL()` already
implements the WHATWG URL Standard's input normalization (stripping tab/newline/leading-trailing
space before looking for a scheme) — a naive regex is vulnerable to exactly the kind of
tab-injected-into-a-scheme bypass a browser attribute sink still normalizes and executes. An
`image`/`video` `kind` whose `src` fails the media-src check falls back to the generic file-chip
rendering, which then separately re-validates `src` against the stricter href allowlist for its own
download affordance.

`kind="video"` renders its open affordance as a separate `[part="open-button"]` next to
`[part="media"]` rather than wrapping the whole card in one `<button>`/`<a>` (the pattern
`image`/`file` use) — a `<video controls>` element is itself interactive content, and HTML forbids
nesting interactive content inside a `<button>`/`<a>`; doing so anyway would also make every click on
the video's own native controls bubble up and spuriously fire `lr-media-open`.

**Known gotchas:**

- `kind` only reflects to the host attribute when explicitly set — CSS keying off the
  auto-detected resolved kind should target the rendered `[part]`/element (e.g. `video[part="media"]`),
  not `:host([kind=...])`, since the latter won't see an auto-detected kind.

---

## `lr-attachment-trigger`

A compact attach affordance designed for a chat composer's start slot (see `lr-chat-composer`'s
own `start` slot, which this drops straight into, though it has no code dependency on it). First-
party invention (no Web Awesome equivalent). Its shape adapts to how many attachment `capabilities`
are configured: exactly one renders a single plain icon button; more than one renders a small
anchored menu (composed from `lr-dropdown`/`lr-menu`/`lr-menu-item`) listing each
capability as a row.

**Properties:**

- `capabilities: readonly LyraAttachmentCapability[] = ['files']` (property only, no attribute) —
  which capabilities to offer, in display order. `LyraAttachmentCapability = 'files' | 'image' |
'camera' | 'audio'`; `LyraFileBackedCapability = 'files' | 'image'` (the two that actually open
  the file picker). Writes inspect at most the first 64 candidates and normalize to a frozen,
  deduplicated, at-most-four entry snapshot. Unknown values and duplicates do not consume that
  four-entry output budget; hostile/invalid collections fail closed to the default.
- `accept: string = ''` — a native-file-input-style accept string (e.g. `'image/*'` or
  `'.pdf,.docx'`), forwarded to the hidden file input for the `files`/`image` capabilities. `image`
  defaults it to `'image/*'` unless this prop overrides it; `files` always uses it as-is (empty
  means "any file type").
- Host `aria-label` attribute (default absent) — overrides the localized accessible name on the
  single-capability button or multi-capability menu trigger. An explicitly empty value is ignored,
  so the control keeps its localized name.
- `multiple: boolean = false` (reflected) — forwarded to the hidden file input. Bare `multiple`
  opts into batches; `multiple="false"` remains false and removal restores single-file mode.
- `disabled: boolean = false` (reflected)
- `triggerTitle?: string` (attribute `trigger-title`) — forwards a sighted-user hover tooltip to
  both the single-capability and multi-capability trigger buttons
- `appearance: LyraAppearance = 'plain'` (reflected) — how the trigger fills itself, from the
  library's shared `accent`/`filled`/`outlined`/`filled-outlined`/`plain` vocabulary. `'plain'` is
  exactly the treatment this component shipped before it had the property
- `size: LyraSize = 'm'` (reflected) — size on the shared six-step ladder, accepting the
  `small`/`medium`/`large` spellings too. The tier scales the **glyph**, never the tappable box:
  `--lr-icon-button-size` is an accessibility floor and the ladder's tightest steps resolve below
  WCAG 2.5.8's minimum. Override `--lr-icon-button-size` to make that trade-off explicitly

**Events:** `lr-files` (`detail: { capability: 'files' | 'image'; files, rejected, remainingFiles,
remainingTotalSize }`, the same shape as `lr-file-input`'s) — fired once a file-backed capability's
hidden input produces a real selection. `files` are the picks matching `accept` as a fresh frozen
owner-realm array snapshot, not a live reference to the input's own `.files`; picks the OS dialog's
"All files" filter let through that do not match `accept` are listed in `rejected` with reason
`'type'`. No size or count limit applies here, so both `remaining*` fields are `null`. `lr-camera-request`
and `lr-audio-request`
(both no detail — `detail` is `null`, not `undefined`, per the DOM spec's `CustomEventInit`
default) — fired when the `camera` / `audio` capability is activated; this component implements no
capture UI of its own, the host owns everything from here (there's no single right answer for
`getUserMedia` vs. `<input capture>` vs. a native wrapper's own camera API; for `audio` the
typical host response is opening `<lr-push-to-talk>` in an overlay, then handing the resulting
blob to `<lr-attachment-chip>`). `focus`/`blur` from the active single- or multi-capability trigger
are relayed exactly once as owner-realm native `FocusEvent`s (bubbling and composed, preserving
`relatedTarget`); the hidden file input is not the focus owner.
The composed dropdown/menu implementation lifecycle, item-state, and selection events are
contained inside the trigger. Only the attachment events listed above cross the host boundary.

**Slots:** none — capabilities are configured entirely via the `capabilities` prop.

**CSS parts:** `trigger` (the single-capability button, only rendered when
`capabilities.length === 1`), `menu` (the `lr-dropdown` shell, only rendered when
`capabilities.length > 1`), `menu-trigger` (the multi-capability button slotted into `lr-dropdown`'s
`trigger` slot, only rendered when `capabilities.length > 1`), `expand-icon` (the disclosure chevron
inside the multi-capability trigger button, only rendered when `capabilities.length > 1`),
`trigger-control` / `menu-trigger-control` (each trigger's own native `<button>` — as of 16.0.0
both triggers are composed `<lr-icon-button>`s, so `trigger`/`menu-trigger` name those hosts and the
painted surface sits one boundary deeper),
`hidden-input` (the internal native `<input type="file">` that actually opens the OS file picker;
hidden via CSS by default, exposed as a part only so a consumer can override that with
`::part(hidden-input)` in the unlikely case their integration needs to).

**An ancestor's public border wins over this component's own relayed default, not just its
absence.** Unlike most composing components, the `outlined`/`filled-outlined` appearances here DO
relay a non-zero `--_lr-icon-button-border-default` (a themed edge) into the trigger's private
fallback tier. That does not change the resolution order: `--lr-icon-button-border` (and its
`-hover`/`-active` variants) is still the FIRST arm of the token chain, read by the composed
trigger ahead of whatever this component relays, so setting it on this element or an ancestor
overrides the outlined edge exactly as it overrides the `plain`/`filled`/`accent` appearances'
zero default. The private relay is only this component's own default opinion, never a gate the
public token must pass through. Size remains the one exception that does not cross this way: use
`--lr-theme-icon-button-size`, never `--lr-icon-button-size`, as noted above.

**Themeable custom properties:** shared tokens only — `--lr-space-xs`, `--lr-color-text`/
`-text-quiet`, `--lr-icon-button-size`, `--lr-focus-ring-*`, `--lr-opacity-disabled`,
`--lr-radius`, `--lr-transition-fast`.

**Optional peer deps:** none.

```html
<lr-attachment-trigger accept=".pdf,.docx"></lr-attachment-trigger>
<script type="module">
  const trigger = document.querySelector("lr-attachment-trigger");
  trigger.capabilities = ["files", "image", "camera"];
  trigger.addEventListener("lr-files", (e) => queueFiles(e.detail.capability, e.detail.files));
  trigger.addEventListener("lr-camera-request", openCameraFlow);
</script>
```

**Known gotchas:**

- `HTMLInputElement.files` is a _live_ view in most browsers — clearing `input.value` after reading
  `.files` (needed so re-picking the exact same file still fires another `change` event next time)
  mutates that exact `FileList` object back to empty in place, not just detaches a stale reference.
  A consumer reading `lr-files` later would otherwise observe an empty list — this component
  copies into a fresh frozen `File[]` before clearing the native input.
- The `camera`/`audio` capabilities never touch the hidden `<input type="file">` at all — both are
  scope-limited by design to firing `lr-camera-request`/`lr-audio-request` and nothing else. The
  hidden input is only rendered when `capabilities` contains `files` or `image`.
- Setting `disabled` closes an open capability menu, disables its items as well as the trigger, and
  discards a native file selection that arrives after the component became disabled.

**Additional API surface:**

- `click()` — Activates the internal attachment trigger.

---

## `lr-avatar`

A small, fixed-size identity marker: an image, an `icon`-slotted fallback glyph, or initials — in
that priority order. Mirrors `wa-avatar` / `sl-avatar` (`image`, `initials`, `loading`, `shape`, the
named `icon` slot, label and image-load error event) and adds this library's shared `size` and
`variant` vocabulary. Purely presentational, with no built-in interactivity; wrap it in a
`<button>`/`<lr-menu>` trigger for a user-menu affordance.

Removing the attribute consumes the label as absent while preserving its `null` property readback.
Explicit empty labels remain empty, host `aria-label` precedence remains intact, and later label
values restore the image or fallback name.

**Properties:**

- `initials: string = ''` — fallback text (typically 1-2 characters), shown whenever no glyph and no
  image is set, or the image fails to load and no `icon` slot content is provided.
- `image: string = ''` — image URL; takes priority over the `icon` slot and `initials` when set and
  loads successfully, falling back to them on a load
  error. Matches `wa-avatar`'s `image`.
- `label: string = ''` — upstream-compatible accessible description. A host `aria-label` wins.
  The same resolved name reaches the image `alt` and every fallback tier.
- host `aria-label` — overrides `label` as the image/fallback accessible name without changing the
  visible initials or image
- `loading: 'eager' | 'lazy' = 'eager'` — passthrough to the rendered `<img>`'s
  native `loading` attribute. `'lazy'` defers the request until the avatar approaches the viewport,
  which is worth setting for avatars far down a long list and never for one above the fold. It only
  reaches the DOM while the image tier is the one rendering; the default matches the native default,
  so an avatar that never sets it behaves exactly as it did before the property existed.
- `size: LyraSize = 'm'` (reflected) — `'2xs' | 'xs' | 's' | 'm' | 'l' | 'xl' |
'small' | 'medium' | 'large'`. Every tier renders a distinct diameter: 1.5rem (`2xs`), 2rem
  (`xs`), 2.5rem (`s`/`small`), 3rem (`m`/`medium`, the mirrored default), 4rem (`l`/`large`),
  and 5rem (`xl`). Invalid and removed `sm`/`md`/`lg` writes
  normalize to `medium`.
- `shape: 'circle' | 'rounded' | 'square' = 'circle'` (reflected) — three distinct corner radii:
  `circle` (the pill radius), `rounded` (the shared `--lr-radius`), `square` (no radius at all).
- `variant: 'neutral' | 'brand' | 'success' | 'warning' | 'danger' = 'neutral'` (reflected) —
  recolors the initials-fallback background/text on the library's one semantic-tone vocabulary;
  `neutral` (the default) reads as a plain, unaccented circle.

**Events:** `lr-error` (`detail: { image: string }`) — the image failed to load;
`detail.image` carries the URL that failed, so a consumer can retry or report it. Bubbling,
composed, non-cancelable, and purely informational: by the time it fires the avatar has already
fallen back to the `icon` slot or the initials on its own. It never fires for an avatar with no
`image` set, and fires once more for each replacement `image` that also fails.

**Slots:** `icon` — a
fallback glyph shown only when there is no loadable `image`; that is
the role `wa-avatar`'s `icon` slot fills, a stand-in for the `initials` text rather than an override
of the photo. Its content is decorative (`aria-hidden`) — set `label` alongside it for an
accessible name. There is no default slot.

**CSS parts:** `base` (the outer circle/rounded/square container), `icon` (wrapper around the named
fallback slot while it is the winning tier), `image` (the `<img>`, only while a safe, non-failed
`image` is usable), and `initials` (only once the image and icon tiers are unavailable).

**Themeable custom properties:** `--size` is the upstream-compatible diameter and falls back to
`--lr-avatar-size` (default `var(--lr-size-3rem)`, with a private default stepped across the ladder
from `var(--lr-size-1-5rem)` at `2xs` to `var(--lr-size-5rem)` at `xl`), `--lr-avatar-bg` (default
`var(--lr-color-neutral-fill-quiet)`, the same quiet fill tier the variants use, whose private default changes for a non-neutral `variant` to that
variant's `-quiet` fill; there is no `--lr-color-surface-alt` token in this library, despite what
older copies of this page claimed), `--lr-avatar-color` (default `var(--lr-color-text)`, whose
private default changes for a non-neutral `variant` to that variant's loud color),
`--lr-avatar-font-size` (default `var(--lr-font-size-m)`) — the font size of the initials fallback,
and of any `em`-sized slotted glyph. Its private default follows `size` alongside the diameter
(`--lr-font-size-xs` at `2xs`, `--lr-font-size-sm` at `xs`, `--lr-font-size-md-sm` at `s`,
`--lr-font-size-m` at `m`, `--lr-font-size-lg` at `l`, and `--lr-font-size-xl` at `xl`), so the
initials track the circle instead of staying one fixed size across every tier. `--lr-avatar-radius`
(default `var(--lr-radius-pill)`) — corner radius of the container. Its private default follows
`shape` (`var(--lr-radius-pill)` for `circle`, `var(--lr-radius)` for `rounded`, `0` for `square`);
an inherited or direct public value overrides uniformly across every shape, the same way
`--lr-avatar-size` spans every size tier. `--lr-avatar-border` (default `none`) — border shorthand
on `base`, applying to image, glyph and initials avatars in every shape. Border-box sizing keeps
the border inside the outer diameter set by `--size`, `--lr-avatar-size` or the size ladder;
image content fills the remaining inner area. Forced colors preserves the system-color boundary
instead of the normal token border. Existing `::part(base)` border customization remains supported.
Every public value
above can be inherited from an ancestor or set directly on the avatar and remains authoritative
across size/variant states in normal color modes. Plus shared tokens
`--lr-radius`/`-pill`, `--lr-font-weight-semibold`.

The variant colors are deliberately **not** the library's generic quiet-fill/on-quiet-text pairing:
an avatar's initials _are_ the accent, so they read in the variant's own loud color on that
variant's quiet tint.

**Optional peer deps:** none.

```html
<lr-avatar initials="JS" variant="brand"></lr-avatar>
<lr-avatar image="/users/42/photo.jpg" label="Jane Smith" size="large" shape="rounded"></lr-avatar>
<lr-avatar label="Assistant"><svg slot="icon" viewBox="0 0 24 24"><!-- role glyph --></svg></lr-avatar>
<lr-avatar initials="JS" style="--lr-avatar-border: var(--lr-border-width-medium) solid var(--lr-color-border)"></lr-avatar>

<!-- Far down a long list: defer the request, fall back to a glyph, and report a broken URL. -->
<lr-avatar id="lazy-avatar" image="/users/7/photo.jpg" label="Ada Lovelace" loading="lazy">
  <svg slot="icon" viewBox="0 0 24 24"><!-- fallback glyph --></svg>
</lr-avatar>
<script type="module">
  document
    .getElementById("lazy-avatar")
    .addEventListener("lr-error", (e) => reportBrokenAvatar(e.detail.image));
</script>
```

**Known gotchas:**

- additive `alt`, default glyph content and `sm`/`md`/`lg` aliases were removed for exact mirrored
  vocabulary: migrate `alt→label`, default glyph content to `slot="icon"`, and size aliases to
  `small`/`medium`/`large`. The older `src→image` and `tone→variant` migrations still apply.
- an image load failure falls back to the `icon` slot when it has content, otherwise to `initials`.
  Changing `image` clears the failure state so the replacement URL gets its own load attempt,
  including when a later transition returns to a URL that failed previously.
- when `label` or host `aria-label` supplies a name, the base preserves that name through the glyph
  and initials fallbacks while hiding duplicate initials text from assistive technology.
- the `icon` slot yields to a loadable `image` and becomes the fallback if the image fails.

---

## `lr-animated-image`

An animated GIF/APNG/WebP with a play/pause control, frozen to a captured still frame at rest and
automatically under `prefers-reduced-motion: reduce`.

**Properties:**

- `src: string = ''` — re-validated through `safeMediaSrc()` (same allowlist as `lr-media-card`)
  before reaching the real `<img src>`.
- `alt?: string` — forwarded to the live image and frozen canvas. An absent or explicitly empty
  value keeps both visual owners decorative; a nonempty value names whichever one is exposed. The
  independent play/pause action still uses localized context when no nonempty `alt` is available.
- `play: boolean = false` — the caller's _intent_ (reflected).
- `playing: boolean` (readonly getter, reflected as a `playing` host attribute) — the _effective_
  state after reduced-motion arbitration:
  `play && (ignoreReducedMotion || a play-button press || !<OS prefers reduce>)`.
  It is a genuine getter-only property, so assigning to it from a strict JavaScript module throws a
  `TypeError`; drive playback via `play`.
- `ignoreReducedMotion: boolean = false` (reflected, attribute `ignore-reduced-motion`) — a
  deliberate page-author override that lets `play` take effect even when the OS reports
  `prefers-reduced-motion: reduce`. Unset, that preference keeps playback frozen regardless of
  `play`, until the user presses `[part="play-button"]` (an explicit press always plays).
- `accessibleLabel: string = ''` (attribute `aria-label`) — when the host attribute is present
  and nonempty, it overrides `[part="play-button"]`'s computed Play/Pause label
  verbatim in _both_ states (it does not itself vary by state). Never
  touches the image's `alt`/the canvas's `aria-label`. For state-sensitive custom wording, override
  the `playWithContext`/`pauseWithContext`/`animatedImageDefaultAlt` strings instead.

**Methods:** `focus(options?)` and `blur()` forward to the play/pause button.

**Events:** `lr-load` (the live `<img>` loaded; fires again on every successful `src` change),
`lr-error` (native decode failure, or a non-empty `src` that failed the safe-URL check — never for
an empty `src`), `lr-play`/`lr-pause` (real transitions of the effective `playing` value only, so a
`play = true` that reduced motion blocks emits nothing, while a live reduced-motion change that
forces a freeze does emit `lr-pause`). Internal `focus`/`blur` are relayed exactly once as
owner-realm native `FocusEvent`s (bubbling and composed, preserving `relatedTarget`).

**Slots:** `play-icon`, `pause-icon` — decorative custom glyphs for the frozen/paused and playing
states. Both stay mounted and are toggled via the native `hidden` attribute. Their assigned content
renders in an inert, `aria-hidden`, pointer-transparent sibling layer over the named play/pause
button, so do not use either slot for a second interactive control.

**CSS parts:** `base` (positioning context), `image` (the live `<img>`), `canvas` (the
frozen-frame `<canvas>`, shown in place of `image` while not playing), `control-box` (the
backgrounded circle around the button; only rendered once loaded and error-free), `play-button`.

**Themeable custom properties:** upstream `--control-box-size` and `--icon-size` feed
`--lr-animated-image-control-box-size` (default
`var(--lr-icon-button-size)`), `--lr-animated-image-icon-size` (default
`calc(var(--lr-icon-button-size) * 0.35)`), `--lr-animated-image-max-height` (default
`var(--lr-size-20rem)` — caps the rendered media's block-size, same contract as
`--lr-media-card-max-height`).

**Optional peer deps:** none.

**Known gotchas:**

- the freeze frame is captured once per successful `src` load, in the `<img>`'s own `load` handler
  (at the image's natural size, not scaled by the device pixel ratio), not re-captured on each pause — pausing always reverts to that first
  frame, never to the frame that was on screen.
- both `image` and `canvas` stay mounted at all times (never `display: none`/removed) so the
  browser's native decode loop keeps running while visually covered; only opacity and `aria-hidden`
  swap.
- reduced-motion arbitration is re-evaluated on every reconnect, so a preference change made while
  the element was detached cannot leave `playing` stale.

**Additional API surface:**

- `click()` — Activate the play/pause control.

## `lr-animation`

Declaratively animates one slotted element through the native Web Animations API.

An initial playing mount creates one native animation and emits one `lr-start`. A real target or
timing change still rebuilds the animation, while replay and reconnect retain their normal
start/finish lifecycle, including reduced motion.

**Properties:**

- `name: string = 'none'` — accepts any animation registry name. The built-in names are `'none' |
'fade-in' | 'fade-out' | 'zoom-in' | 'zoom-out' | 'slide-in-start' | 'slide-in-end' |
'slide-out-start' | 'slide-out-end' | 'slide-in-up' | 'slide-in-down' | 'bounce' | 'pulse' |
'spin' | 'shake'`; `LyraAnimationPreset` remains the exported convenience type for that built-in
  subset. Other strings resolve through the registry key `animation.<name>`. The four built-in
  `-start`/`-end` slide presets are logical: "start" is physically left under `ltr`, right under
  `rtl`.
- `keyframes?: Keyframe[]` (attribute: false) — raw WAAPI keyframes; always wins over `name`.
- `play: boolean = false` (reflected) — playback intent.
- `delay: number = 0`, `duration: number = 1000`, `endDelay: number = 0` (attribute `end-delay`),
  `easing: string = 'linear'`, `fill: FillMode = 'auto'`, `direction: PlaybackDirection = 'normal'`,
  `iterations: number = Infinity`, `iterationStart: number = 0` (attribute `iteration-start`),
  `playbackRate: number = 1` (attribute `playback-rate`) — straight WAAPI timing. `direction` is
  the WAAPI `PlaybackDirection`, unrelated to text direction; `iterations` is always numeric.
- `timingPreset: LyraAnimationTimingPreset = 'custom'` (attribute `timing-preset`, reflected) —
  `'custom' | 'fast' | 'base' | 'ambient'`. Anything other than `'custom'` derives `duration` and
  `easing` from the matching `--lr-transition-*` token (read off computed style and decomposed into
  the numeric ms + easing string WAAPI needs), ignoring the `duration`/`easing` properties.
- `ignoreReducedMotion: boolean = false` (attribute `ignore-reduced-motion`, reflected) — plays
  normally even under `prefers-reduced-motion: reduce`. Unset, that preference caps playback at one
  iteration and calls `finish()` immediately instead of playing, so the target snaps to its
  resolved end state; `lr-start`/`lr-finish` still fire in order. Reserve it for genuine
  user-triggered feedback.
- `playOnVisible: boolean = false` (attribute `play-on-visible`, reflected) — starts playback via
  `IntersectionObserver` once the target intersects. `playOnVisibleRepeat: boolean = false`
  (attribute `play-on-visible-repeat`, reflected) — re-plays on each re-entry and pauses on exit;
  when unset the observer disconnects after the first trigger. `root: Element | null = null` and
  `threshold: number | readonly number[] = 0` (both attribute: false) plus
  `rootMargin: string = '0px'` (attribute `root-margin`) configure that observer. Threshold arrays
  are frozen snapshots, retain only finite values from 0 through 1, and inspect at most 1,000
  candidates per assignment; invalid scalar thresholds normalize to `0`. Assigning the same array
  again is a no-op, and `keyframes` is compared by reference: bind stable arrays (hoist them or use
  Lit's `guard()`), because an inline literal restarts a running animation on every parent render.
- `currentTime: CSSNumberish` — the underlying `Animation.currentTime` (`0` when no animation
  exists); writable and forwarded when one exists. Non-finite numeric assignments are ignored.

**Methods:** `start()` (sugar for `play = true` — named `start` because `play` is already a
property), `pause()` (`play = false`), `finish()`, `cancel()`. `cancel()` leaves the target reverted
to its own CSS: the `play = false` that the resulting `lr-cancel` sets never re-pauses the now-idle
`Animation`, which per the Web Animations API would un-cancel it back to keyframe zero and freeze the
target there.

**Events:** `lr-start` (a new animation was created and playback began/restarted), `lr-finish`
(natural end, including the reduced-motion instant-finish path), `lr-cancel` (the public `cancel()`
method or external cancellation). `lr-finish`/`lr-cancel` both reset `play` to `false`.

**Slots:** default slot — the element to animate. A second slotted element is accepted without
error but ignored.

**CSS parts:** none (`:host { display: contents }`; the animated element is light-DOM content).

**Themeable custom properties:** `--lr-animation-slide-distance` (default `100%` — travel distance
for the slide presets), `--lr-animation-zoom-scale` (default `0.5` — start/end scale for
`zoom-in`/`zoom-out`), `--lr-animation-bounce-height` (default `25%` — peak lift of `bounce`),
`--lr-animation-shake-distance` (default `4%` — horizontal travel of `shake`).

**Animation registry:** every named preset resolves the public registry key
`animation.<name>` before using its built-in keyframes. A per-element `setAnimation()` registration
wins over `setDefaultAnimation()`; a keyframes-only registration retains this component's
property- or token-derived timing, and `rtlKeyframes` is selected from the live inherited text
direction. Both setters return an idempotent cleanup. Passing `null` disables interpolation but
still emits `lr-start` then `lr-finish`, so code sequencing work from the lifecycle does not stall.
Direct `keyframes` property input remains the strongest, instance-local override and does not use a
registry name. Register an override before the first render when creating an animation
programmatically. For an already-rendered `<lr-animation>`, the override is selected on its next
normal rebuild (a keyframe/timing/direction change or reconnect); the registry never mutates a
native timeline that is already running.

```js
import "@aceshooting/lyra-ui/components/lr-animation.js";
import { setAnimation } from "@aceshooting/lyra-ui/utilities/animation-registry.js";

const animation = document.createElement("lr-animation");
animation.name = "slide-in-start";
animation.iterations = 1;
animation.innerHTML = "<span>Registry-controlled content</span>";
const release = setAnimation(animation, "animation.slide-in-start", {
  keyframes: [
    { transform: "translateX(calc(-1 * var(--lr-size-2rem)))" },
    { transform: "translateX(0)" },
  ],
  rtlKeyframes: [
    { transform: "translateX(var(--lr-size-2rem))" },
    { transform: "translateX(0)" },
  ],
});
document.body.append(animation);
animation.start();
// release() restores the previous registration.
```

**Optional peer deps:** none.

**Known gotchas:**

- `iterations` defaults to `Infinity` (mirrors the upstream Web Awesome/Shoelace contract) — a named
  preset plays forever unless you set `iterations="1"`.
- changing any timing/keyframe property rebuilds the animation from scratch; the rebuild's internal
  `cancel()` is deliberately silent (no `lr-cancel`), only the public `cancel()` emits.
- the slide presets re-resolve when an inherited text-direction change is observed. The old native
  animation is replaced rather than mirrored in place, so its timeline restarts from the new edge.
- reduced-motion handling is entirely in JS; the shared shadow-DOM reduced-motion CSS block can't
  reach light-DOM slotted content driven by `Element.animate()`.

## `lr-avatar-group`

Stacks slotted `<lr-avatar>` children into one overlapping row and, past `max`, collapses the
excess into a localized "+N" badge. Composed over `<lr-avatar>` via plain light-DOM slotted content
(no `.items` array); it does **not** import/register `<lr-avatar>` — the consumer does that.

**Properties:**

- `max?: number` — how many assigned children stay visible before the rest collapse behind the
  badge. Unset (the default) means no limit. Any assigned value is sanitized to a finite,
  non-negative integer. Flattened slot-forwarded children count the same as direct children.
- `size: LyraSize = 'm'` (reflected) — reused from `<lr-avatar>`'s canonical six-step ladder.
- `shape: LyraAvatarShape = 'circle'` (reflected) — `'circle' | 'rounded' | 'square'`.
- `variant: LyraVariant = 'neutral'` (reflected) — `'neutral' | 'brand' | 'success' | 'warning' |
'danger'`.

`size`/`shape`/`variant` style the overflow badge and provide defaults only to assigned avatars
that omit the corresponding attribute. Explicit child attributes remain authoritative; owned
defaults are restored without overwriting later author writes across removal, reparenting,
disconnect and reconnect.

- `label: string = ''` — the group's `role="group"` accessible name. A host-level `aria-label` wins
  if both are set; with neither, no `aria-label` is rendered.

**Events:** `lr-overflow-activate` (frozen
`detail: { readonly hiddenCount: number; readonly hiddenAvatars: readonly LyraAvatar[] }`) —
the badge was activated by click or Enter/Space. Non-cancelable, purely informational: the
component keeps rendering the same collapsed stack, and a host typically wires this to its own
popover/dialog listing the hidden members. There is no `expanded` state and no `aria-expanded`.

**Slots:** default slot — direct or forwarded `<lr-avatar>` elements. Other elements are ignored
and remain untouched. Author-hidden/inert avatars do not consume visible capacity. Excess eligible
avatars are hidden through reversible component-owned state.

**CSS parts:** `base` (the outer inline-flex container holding the slot and the badge),
`overflow-badge` (the `--lr-icon-button-size`-minimum action surface; only rendered while `max` is actively
overflowing), and `overflow-badge-visual` (the avatar-tier-sized painted disc inside it).

**Themeable custom properties:** `--lr-avatar-group-avatar-size` (default `var(--lr-size-3rem)`,
with a private default stepped across the same six tiers as `<lr-avatar>`'s `--lr-avatar-size`,
from `var(--lr-size-1-5rem)` at `2xs`, through `var(--lr-size-2rem)`/
`var(--lr-size-2-5rem)`/`var(--lr-size-3rem)`/`var(--lr-size-4rem)`, to
`var(--lr-size-5rem)` at `xl`),
`--lr-avatar-group-overlap` (default `var(--lr-size-neg-6px)`, whose private default follows `size`;
a logical `margin-inline-start`, so it auto-mirrors
under `dir="rtl"` — setting `0` or a positive length turns the stack into normal spacing),
`--lr-avatar-group-ring-color` (default `var(--lr-color-surface)`),
`--lr-avatar-group-ring-width` (default `var(--lr-border-width-medium)`),
`--lr-avatar-group-badge-bg` (default `var(--lr-color-neutral-fill-quiet)`, with a private default that follows
`variant`), `--lr-avatar-group-badge-color` (default `var(--lr-color-text)`, with a private default
that follows `variant`),
`--lr-avatar-group-badge-font-size` (default `var(--lr-font-size-m)`) — the font size of the "+N"
badge label. Its private default follows `size` alongside the badge diameter, matching
`<lr-avatar>`'s own `--lr-avatar-font-size` scale (`xs`/`sm`/`md-sm`/`m`/`lg`/`xl` font tokens from
the `2xs` through `xl` size tiers), so the badge and the avatars it caps read at the same optical
weight. `--lr-avatar-group-radius` (default `var(--lr-radius-pill)`) — corner radius of the
slotted avatars' ring and of the overflow badge's painted disc. Its private default follows
`shape` (`var(--lr-radius-pill)` for `circle`, `var(--lr-radius)` for `rounded`, `0` for `square`);
an inherited or direct public value overrides both uniformly, mirroring `<lr-avatar>`'s own
`--lr-avatar-radius` — a per-avatar `shape` override still wins for that individual avatar's own
ring, matching the existing mixed-shape-group support. An inherited or direct public value remains
authoritative for every hook.

The overflow badge keeps a `--lr-icon-button-size` minimum activation target at every tier — a
floor, not a cap, so the action surface grows past it to always contain the nested visual disc
once `--lr-avatar-group-avatar-size` exceeds it (every tier from `s` up) — while small
tiers still paint an exactly avatar-sized disc instead of an oversized circle.

**Optional peer deps:** none.

```html
<lr-avatar-group max="3" label="Project members">
  <lr-avatar initials="JS"></lr-avatar>
  <lr-avatar initials="AM"></lr-avatar>
  <lr-avatar initials="RT"></lr-avatar>
  <lr-avatar initials="KL"></lr-avatar>
</lr-avatar-group>
```

**Known gotchas:**

- group defaults only fill omitted child attributes; they deliberately do not overwrite explicit
  heterogeneous child presentation.
- the row never wraps (`flex-wrap` stays `nowrap`) — wrapping an overlapping stack breaks the
  visual.
- avatars are non-interactive, so there is no roving tabindex / arrow-key handling; the badge is the
  only tab stop.

## `lr-lightbox`

A modal, full-screen image viewer with prev/next navigation, captions, and pan/zoom delegated to one
stable embedded `<lr-pan-zoom>`. It renders its own dialog panel (not a nested `<lr-dialog>`)
but shares the same overlay infrastructure as `<lr-dialog>`/`<lr-command-palette>` — stacking, focus
trap, Escape/backdrop dismissal, scroll lock, and focus return.

Closing returns focus to the element that held it when the lightbox opened, including an opener the host re-shows only after the close.

A lightbox opened outside an existing native `dialog.showModal()` stays interactive through an internal native modal surface. The host keeps its authored parent, and close vetoes, Escape, and focus return retain their normal behavior.

**Properties:**

- `open: boolean = false` (reflected) — post-render writes run the same cancelable lifecycle as
  `show()`/`hide()`/`close()`. Initial `open` markup is state and emits no lifecycle events.
- `images: readonly LyraLightboxImage[] = []` (attribute: false) —
  `LyraLightboxImage { readonly src: string; readonly alt?: string; readonly caption?: string }`.
  Assignment clones/freezes the records and inspects at most 10,000 candidates; malformed records
  are omitted and updates require a new collection assignment. `src` is passed to the embedded
  frame, which runs it through `safeMediaSrc()`. `alt`/`caption` are caller data, never localized.
- `imageSource: LyraLightboxSource | undefined` (attribute: false) — identity-owned
  access to the complete ordered collection, taking precedence over `images` while defined.
  Invalid defined sources show a localized error and retry action; they never fall back to the
  legacy array. Setting `undefined` restores the current `images` input. Reassign the source,
  including the same object, or call a keyless `requestUpdate()` after changing its revision or
  mutable provider state. Unrelated named display updates do not refresh the source.
- `index: number = 0` (reflected) — clamped defensively for rendering and re-synced (emitting
  `lr-index-change`) when the active collection shrinks. In source mode, it retains the requested
  logical index while its descriptor and image load.
- `loop: boolean = false` (reflected) — wraps prev/next past the ends.
- `lightDismiss: boolean = false` (attribute `light-dismiss`) — opt in to backdrop dismissal. Off by default, matching `lr-dialog`.
- `withoutCounter: boolean = false` (attribute `without-counter`, **not reflected**) — hides the
  visible `[part="counter"]`; the polite position announcement stays active. Nothing is ever
  written back to the attribute — no stylesheet or selector keys off it.
  Spoken position updates remain active when the counter is hidden: the shadow
  `[part="live-region"]` is only an `aria-hidden` text mirror, while announcements append to the
  shared light-DOM polite sink. Announcements stay silent when the lightbox or a composed ancestor
  is excluded from the accessibility tree.
- `minZoom: number = 0.5`, `maxZoom: number = 4`, `zoomStep: number = 0.25` (attributes `min-zoom`/
  `max-zoom`/`zoom-step`) — pure pass-throughs to the embedded `<lr-pan-zoom>`, which does the
  normalizing.
- `fit: LyraImageFit = 'actual'` (reflected) — opt-in base sizing policy for the current image,
  reusing `<lr-image-viewer>`'s `contain`/`width`/`actual` vocabulary. The default preserves the
  existing natural-size behavior. `contain` fits both landscape and tall images inside the stage;
  `width` fills its inline size. CSS recalculates either policy when the stage is resized or a
  delayed image source finishes loading, so navigation and opening do not require consumer timers.
  Fit is the base zoom policy: an explicit user zoom remains until navigation or a reset, and
  changing the theme does not mutate the lightbox's zoom property.
- `accessibleLabel: string | null = null` (attribute `aria-label`) — the panel's accessible name,
  overriding the localized `lightboxLabel`.

**Methods:** promise-based `show()`, `hide()`, and `close(reason?)`, plus `next()`, `previous()`, and
`goTo(index)`. `show()`/`hide()` resolve after the successful rendered transition; a veto resolves
without changing state. `goTo()` ignores a non-finite
index without changing state or emitting `lr-index-change`. A finite fractional index is truncated
toward zero before clamping or loop wrapping, so `lr-index-change.detail.index` is always the
accepted logical integer index, including while a source image is loading; `reason` defaults to
`'api'` and is forwarded as the close event's
detail.

**Full image collections:** `LyraLightboxSource` has `revision` and
`images: LyraIndexedView<LyraSourceRecord<LyraLightboxImage>>`, using the types from
`@aceshooting/lyra-ui/data-sources.js`. The host supplies a nonnegative safe-integer `images.count`
and either synchronous indexed access or asynchronous bounded range reads. Each record supplies
a stable global `key`, canonical nonnegative safe-integer `order`, and image `value`. Keep the view
stable within a revision; publish a new revision and refresh when its contents change. Navigation,
clamping, looping and the localized counter use the full logical count, so first, middle and final
images remain reachable in a million-image host collection without copying it into `images`.
Current navigation emits `lr-index-change` for the logical destination before its image finishes
loading; direct consumer `index` writes stay event-silent. Source mode adds no new event.

Only the current image loads, after resolving its descriptor. The component retains at most three
descriptors in one-record pages, with one range read physically pending and no neighbour prefetch.
Supplied record and image fields must be own data properties; accessors are rejected without
invocation. Each key, `src`, `alt` and `caption` admits at most 65,536 UTF-16 units; oversized or
malformed values fail visibly instead of being clipped. URLs pass `safeMediaSrc()` before loading.
The host owns provider storage and response allocations; actual image decode/pixel memory belongs
to the browser and is not bounded by the descriptor cache.

Source loading clears the old image/caption, marks the stage busy and leaves logical navigation
available. Descriptor or image-load failure shows localized retry chrome; a valid empty collection
is a separate state. Replacing a source, navigating, refreshing, disconnecting or changing owner
document revokes obsolete work, so a late completion cannot display an old image. The same
pan/zoom frame stays mounted and retains focus. The provider should honor the request's abort
signal; stale-result protection does not make an abort-ignoring provider settle promptly.

**Events:** cancelable `lr-show`, followed after a successful open render by `lr-after-show`;
conditionally cancelable `lr-hide` (`detail: LyraLightboxHideDetail = { source: Element }`):
cancelable before a requested close, non-cancelable when an open instance unmounts. A requested
close then emits cancelable `lr-close-request` with `{ reason: LyraLightboxCloseReason }`.
An accepted dismissal sets `open = false` and emits non-cancelable `lr-close` with the same reason
object. Use
`lr-close-request` for vetoes and `lr-close` for accepted dismissals.
`lr-after-hide` follows the closed render. Removal while open cannot be vetoed and reports reason
`unmount`. `lr-index-change` (`detail: { index }`, fired
for internally-driven navigation — a button, a keyboard shortcut, or `next()`/`previous()`/
`goTo()` — and when a shrinking active collection normalizes the index; **not** when a consumer sets
`index` directly); `lr-zoom-change` (`detail: {
zoom }`) is not emitted by the lightbox itself — it bubbles up composed from the embedded frame.

**Slots:** `actions` — extra toolbar buttons (download/share/delete), rendered in `[part="toolbar"]`
between the counter and the close button.

**CSS parts:** `backdrop`, `panel` (`role="dialog"` + `aria-modal="true"` while open; fills the
padded safe area rather than shrink-wrapping), `toolbar`, `counter` (visible localized "Image N of
Total"), `live-region` (an `aria-hidden` shadow text mirror; each post-mount `index` change,
including a consumer-driven one, appends the localized position to the document's shared
`[data-lr-live-region="polite"]` sink; initial mount and reconnect are silent), `actions` (wrapper,
`hidden` when nothing is slotted),
`close-button` (always rendered — unlike `<lr-dialog>`'s, which `without-close-button` removes), `stage`, `frame` (the
embedded `<lr-pan-zoom>`), forwarded aliases `frame-viewport`, `frame-content`, `frame-controls`,
`previous-button`,
`previous-glyph`, `next-button`, `next-glyph`, `caption` (only when the current image has one; its
`id` is the panel's `aria-describedby` target), `source-loading`, `source-error`, and `source-retry`
(the current source image's retry button). `stage` exposes `aria-busy="true"` while source
descriptor or native image loading is pending.

**Themeable custom properties:** `--lr-lightbox-overlay-color` (default
`var(--lr-color-overlay-strong)` — the backdrop scrim), `--lr-lightbox-control-bg` (default
`var(--lr-color-neutral)`) and `--lr-lightbox-control-color` (default `var(--lr-color-on-neutral)`)
— background/foreground for the counter, caption, and every floating/toolbar icon button; these use
the solid neutral token rather than `--lr-color-surface` because the controls float over arbitrary
photo content.

**Optional peer deps:** none.

**Known gotchas:**

- keyboard navigation is RTL-aware on panel/chrome: Arrow forward/back (mirrored under `rtl`),
  `Home`, `End`. When the embedded pan/zoom viewport owns focus, those keys remain with its native
  scroll surface and never change gallery item; `+`/`-`/`0` remain its zoom shortcuts.
- initial focus deliberately goes to `close-button`, not the first tabbable element — a slotted
  `actions` button placed before it does not steal focus.
- zoom/pan reset on navigation is imperative (`resetView()` from `updated()`), not a binding; the
  frame element is reused across navigations rather than recreated, so a keyboard user who tabbed
  into the viewport keeps focus.
- fit sizing is CSS-driven inside the stable frame. The rendered DOM image is not copied or
  measured by the lightbox, so stale load events cannot apply a previous image's size. The fit
  policy covers the painted image only; the lightbox's DOM caption, toolbar, legend-like actions,
  and tooltip content remain outside that image surface.
- scope for v1: no per-image slotted content (data-driven via `images` or `imageSource`), no dot indicators, no
  visual open/close animation, no click-image-to-navigate, no touch-swipe. Lifecycle phases are
  still observable through the before/after events and methods above.

## `lr-qr-code`

Renders `value` as a QR code using the optional `qrcode` peer dependency. **Properties:** `value`,
`label`, `size` (clamped to `1`–`2048` CSS px), `radius` (clamped to `0`–`0.5`), and
`errorCorrection` (`error-correction`, `L`/`M`/`Q`/`H`, default `H`). Standard host `color` and
`background-color` control paint; optional `--lr-qr-code-fill` and
`--lr-qr-code-bg` aliases override those host styles, while the permanent upstream parity
properties `fill` and `background` remain the highest-precedence paint inputs. `image` accepts
a safe media URL for a centered overlay, `imageBackground` (`image-background`) paints its coverage
box, `imageCoverage` (`image-coverage`, default `0.5`) controls that box as a fraction of the canvas
side, and `imagePadding` (`image-padding`, default `0`) pads the image within it. Image geometry is
finite-number guarded and clamped; supplying a valid image forces error correction to `H` so the
covered modules remain recoverable. Unsafe image URLs are ignored and a failed image load leaves the
base QR symbol intact. Peer output is validated and cloned into an owned finite QR matrix before
paint; malformed or hostile module shapes fail closed to the localized error state.

The host is the single image-semantic owner; its accessible name uses host `aria-label`, then
`label`, then `value`, and it publishes `aria-busy="true"`/`"false"`. The stable public
`canvas: HTMLCanvasElement` is presentational and remains the same live node through
empty/loading/ready/error, reconnect, and adoption (hidden outside ready). Empty values render an
empty state. `generate(): void` synchronously starts re-encoding the current value.
`refreshTheme(): void` redraws cached modules for consumer-owned token changes; ordinary ancestor
theme and color-scheme changes redraw automatically. Async peer and image results are
generation-guarded, including across disconnect/reconnect.
`LyraQrCode.preload(): Promise<boolean>` is a static optional-peer warm-up that starts the shared
`qrcode` import without encoding a value; it resolves to `false` when the peer is unavailable.

When `IntersectionObserver` is available, painting waits for a valid intersecting entry and resumes
whenever the code re-enters view. If the API is unavailable, its constructor fails, or `observe()`
throws, rendering proceeds immediately. Invalid resolved paint colors fall back to the documented
safe fill/background without changing the QR's loading or error state: foreground becomes black,
background becomes transparent, and `imageBackground` becomes the resolved QR background.

At ordinary sizes the backing store is a fixed `2×` the CSS size, independent of device pixel
ratio. It degrades uniformly only to stay within 4,096 pixels per dimension and 8,388,608 total
pixels. Modules span the full canvas with no injected quiet zone; add host padding when a scanner
or physical output needs one.

**CSS parts:** `qr-code` (the outer wrapper); `canvas`, `empty`, `loading`, and `error`. **CSS custom properties:**
`--lr-qr-code-fill` and `--lr-qr-code-bg`.

`error` is ordinary localized visible text, not a shadow live region. A missing peer or encode
failure appends the localized message to the document's pre-mounted
`[data-lr-live-region="assertive"]` sink; identical retries append distinct children, and sink
ownership is released/reacquired across disconnect or document adoption. Meaningful post-mount
loading transitions use the corresponding polite light-DOM sink; initial mount remains silent.

## `lr-image-viewer`

A full pan/zoom raster-image viewer with labeled region highlights and opt-in region annotation, the
landing surface for `region`-anchored citations. Distinct from `<lr-svg-viewer>` (rendered SVG
documents) and `<lr-image-comparer>` (before/after slotted surfaces). Adopts `DocumentAnchorTarget`
with `anchorKinds: ['region']` only — no text selection is bound.

**Optional panorama:** `projection: LyraMediaProjection = 'flat'` accepts `'flat'` or
`'equirectangular'`. Set `projection="equirectangular"` and `engine="webgl"` together to request
spherical rendering from optional `@aceshooting/lyra-3d/panorama`. The default
`engine: Engine3dPreference = 'builtin'` retains flat media. Invalid values normalize to defaults.
Missing companion, unavailable WebGL2, errors or context loss retain native flat media with
localized feedback. `lr-engine-fallback` carries `{ from, to, reason }`, where reason is
`'unavailable'`, `'unsupported'`, `'context-lost'` or `'error'`.

`panoramaCamera: LyraPanoramaCamera` (property only) defaults to
`{ yaw: 0, pitch: 0, fieldOfView: 75 }`. Yaw/pitch are radians; vertical fieldOfView is degrees,
clamped to 20–100. Authored writes are silent. Arrow keys look around (horizontal keys honor
RTL), +/- zoom, and Home resets. `lr-panorama-camera-change` carries `{ camera }` after gestures
or keyboard changes.

`hotspots: readonly LyraPanoramaHotspot[] = []` (property only) accepts
`{ id, yaw, pitch, label? }`, with radians and pitch within ±π/2. Invalid rows are omitted;
first valid unique ID wins. Reassign after changes. A visible keyboard alternative pages 200
hotspots with arrows, Home/End and Previous/Next navigation. `lr-panorama-hotspot-select` carries
`{ hotspot, id, index }`.

Disabled fit, rotate and annotate controls retain their resting paint on hover and press. Enabled
controls keep their token-driven feedback.

The annotation wrapper displays the shared token-driven focus ring in keyboard modality. The ring
sits inside the wrapper so an image filling the scroll viewport cannot clip it. Annotation commands
apply when that wrapper itself owns keyboard input. Enter on a highlight button activates that
highlight without starting or committing an annotation, whether or not a draft exists; wrapper arrow
commands retain physical image-coordinate semantics in both directions.

A region highlight paints exactly the percentage rectangle it names, at every fit, zoom and
rotation: its box never takes the shared `--lr-icon-button-size` minimum, so a small region cannot
grow past its data or overlap a neighbour. The accessible pointer target is a separate transparent
`::after` of the `[part="highlight"]` button, centred on the box and grown to
`--lr-icon-button-size` on any axis where the box is smaller. Overlap rule: a region's own painted
box always wins over another region's enlarged area, and where only enlarged areas overlap the
later highlight in document order wins. Keyboard navigation between highlights is unaffected.

**Properties:** `src: string = ''`, `name: string = ''`, `alt?: string`,
`fit: LyraImageFit = 'contain' | 'width' | 'actual'` (reflected; invalid writes normalize to
`contain`), `zoom: number = 1` (reflected), `minZoom: number = 0.5` (attribute
`min-zoom`), `maxZoom: number = 4` (attribute `max-zoom`), `zoomStep: number = 0.25` (attribute
`zoom-step`) — `minZoom`/`maxZoom`/`zoomStep` are pure pass-throughs to the embedded
`<lr-pan-zoom>` as its own `.minZoom`/`.maxZoom`/`.zoomStep`, which does the actual
clamping/normalizing; same names/defaults as `<lr-lightbox>`'s identical trio, both wrapping the
same pan/zoom surface — `rotation: LyraImageRotation = 0 | 90 | 180 | 270` (reflected; finite
writes round to the nearest right angle and wrap), and `annotatable: boolean = false` (reflected).
`LyraImageRegionRect` is the public `{ x, y, width, height }` percentage-coordinate shape. The
inherited anchor-target surface is
`highlights: readonly LyraHighlight[] = []` (property only; assign a new collection to update),
`activeHighlightId: string | null = null` (attribute `active-highlight-id`),
`anchor: LyraAnchor | string | null = null` (property only), and readonly
`anchorKinds: readonly LyraAnchorKind[] = ['region']`.

**Methods:** `rotate()` advances `rotation` by 90°. `zoomIn()`, `zoomOut()`, and `resetZoom()` adjust
the embedded pan-zoom surface's zoom; `resetZoom()` keeps the pan position. `scrollToAnchor(target: LyraAnchor | string):
Promise<boolean>` resolves a canonical finite, positive, in-bounds `region` anchor (or unique
highlight id) after the image loads, scrolls its rendered target into the pan/zoom viewport, and
reports true only when the target visibly intersects that viewport. Malformed/out-of-range regions
report false.

**Events:** `lr-load` (`detail: { naturalWidth, naturalHeight }`), `lr-zoom-change` (`detail: {
zoom }`), `lr-rotation-change` (`detail: { rotation }`) and `lr-fit-change` (`detail: { fit }`),
which also fire for programmatic changes, `lr-annotatable-change` (`detail: { annotatable }`, the
annotate toggle only), `lr-highlight-activate` (`detail: { highlightId }`), `lr-annotation-create` (`detail: { anchor }`, kind
`'region'`), `lr-anchor-result` (`detail: { found }`), and `lr-render-error` (`detail: { error
}`).
With the optional panorama, `lr-panorama-camera-change` (`detail: { camera }`, after a user gesture or
keyboard change), `lr-panorama-hotspot-select` (`detail: { hotspot, id, index }`) and
`lr-engine-fallback` (`detail: { from, to, reason }`) are emitted; none is cancelable.

`lr-text-select` is not part of this raster viewer's event contract because it binds no selectable
text.

**CSS parts:** `base`, `toolbar`, `fit-control`, `rotate-button`, `annotate-toggle`, `frame` (the
embedded `lr-pan-zoom`), forwarded aliases `frame-viewport`, `frame-content`, `frame-controls`,
`rotation-frame` (the axis-swapped 90°/270° layout footprint), `image-wrapper`, `image`,
`highlight-layer`, `highlight` (carries `data-tone`/`data-active`), `highlight-label`,
`annotation-box`, `error`, and `anchor-live-region` (an aria-hidden, non-live shadow mirror of the
latest anchor-jump message; the spoken copy is appended to the shared document-level polite sink
only while the viewer and its composed ancestors are exposed to the accessibility tree).
Panorama parts (with `projection="equirectangular"`): `panorama` (the keyboard-operable spherical
viewport), `panorama-engine` (the optional renderer container), `panorama-notice` (localized
renderer loading or fallback feedback), `panorama-hotspots` (the paginated hotspot alternative)
with one `panorama-hotspot` button per hotspot, and `panorama-page` (a hotspot page action).

`error` is ordinary localized visible text, not a shadow live region. A fresh post-mount image
failure or transition to an unsafe source appends the localized message to the document's
pre-mounted `[data-lr-live-region="assertive"]` sink. An already-unsafe initial `src` remains
visible but does not interrupt on mount; identical later failures append distinct children.

Fit, rotate and annotate controls remain disabled until the current source reaches its own loaded
terminal. Requested annotation mode resumes after a successful replacement load, but is not
exposed as pressed/operable during idle, loading, or error state.

While effectively annotatable, `image-wrapper` is a named `role="group"` with the localized
annotation hint. Only `region` highlights whose rectangle is finite, positive and wholly within
the 0–100 image coordinate space are rendered. Malformed, empty, and blank IDs are omitted; later
duplicates use first-wins uniqueness. At most
`IMAGE_VIEWER_HIGHLIGHT_LIMIT` (200) region buttons are projected at once; one roving `tabindex=0`
is maintained, Arrow keys/Home/End move within the projection, and an active item beyond the
leading window replaces its final entry so identity stays reachable. `data-truncated` and
`data-total` on `highlight-layer` expose the bounded state. Highlight tones retain distinct border
styles as well as colors, including forced-colors mode.

At 90°/270°, `rotation-frame` swaps the untransformed wrapper's layout axes and centers the painted
transform inside that footprint, keeping every fit mode reachable in the scroll geometry in LTR
and RTL.

**RTL behavior:** the raster and annotation geometry use physical image coordinates. In annotation
mode, ArrowLeft/ArrowRight decrease/increase a draft's `x` coordinate and their Shift variants
decrease/increase its width in both text directions; the surrounding toolbar remains logical.

**Themeable custom properties:** `--lr-image-viewer-annotate-active-bg` (default
`var(--lr-color-brand-quiet)`) and `--lr-image-viewer-annotate-active-border` (default
`var(--lr-color-brand)`) — the background and border of `[part='annotate-toggle']` while annotation
mode is on. The toggle carries its own glyph in `--lr-color-text`, so keep a 4.5:1 ratio against it
when overriding the background. `--lr-image-viewer-highlight-active-color` (default
`var(--lr-color-brand)`) — the outline of the `[part='highlight']` matching `activeHighlightId`,
independent of the per-tone border colors, so the active box stays distinguishable whatever tone it
carries. `--lr-image-viewer-highlight-active-border-width` (default
`var(--lr-border-width-thick)`) controls the active highlight border width;
`--lr-image-viewer-highlight-active-outline-width` (default `var(--lr-focus-ring-width)`) and
`--lr-image-viewer-highlight-active-outline-offset` (default `var(--lr-focus-ring-offset)`) control
its outline geometry. Like the existing active color hook, each is an inline `var()` fallback and
can be set on the viewer or any ancestor. Highlight tone styling is exposed through
`--lr-image-viewer-highlight-border`,
`--lr-image-viewer-highlight-bg`, and the tone-specific
`--lr-image-viewer-highlight-success-border`, `--lr-image-viewer-highlight-success-bg`,
`--lr-image-viewer-highlight-warning-border`, `--lr-image-viewer-highlight-warning-bg`,
`--lr-image-viewer-highlight-danger-border`, `--lr-image-viewer-highlight-danger-bg`,
`--lr-image-viewer-highlight-neutral-border`, and `--lr-image-viewer-highlight-neutral-bg`
properties. `--lr-image-viewer-highlight-fill` is the resting fill a `[part='highlight']` actually
renders, resolved per tone from the `-bg` knobs above; its hover and pressed states are color mixes
taken from that value, so setting it directly retints all three states of one highlight at once —
retint a whole tone through the matching `-bg` knob instead. `--lr-image-viewer-annotation-box-border`
(default `var(--lr-color-brand)`) and `--lr-image-viewer-annotation-box-bg` (default
`color-mix(in srgb, var(--lr-color-brand) 15%, transparent)`) retint `[part='annotation-box']`, the
in-progress draft rectangle drawn while actively annotating, independent of the saved highlights'
own tone colors. These properties are declared as inline
`var()` fallbacks at the point of use rather than on `:host`, so each can be set on the element _or
on any ancestor_:
`::part(highlight)[data-active]` is invalid CSS — Shadow Parts forbids an attribute selector after
`::part()` — which previously left overriding the library-wide
`--lr-color-brand`/`--lr-color-brand-quiet` tokens as the only lever, repainting every other
element that read them. Unset, each falls back to the token its rule used before.

## `lr-av-player`

`controls-surface="regular"` (default) keeps the owned playback-rate toolbar's ordinary surface.
`controls-surface="clear"` opts that toolbar into a white foreground over its own dark gradient
scrim. Load `@aceshooting/lyra-ui/surfaces/glass.css` for its translucent recipe; without it the
scrim remains opaque. This option never changes browser-owned native media controls. Increased
contrast and reduced-transparency preferences make the treatment opaque; forced colours use
system colours. The `LyraAvControlsSurface` type is `'regular' | 'clear'`.

An audio/video player built on a native `<audio>`/`<video>` element, plus a cue transcript synced to
`currentTime`, `time-range` anchor/highlight support, an optional dependency-free waveform (peaks
in, no in-component decoding), and playback-rate control. Owns recorded-media transcript sync —
distinct from `<lr-transcript-feed>` (live captions for an in-progress voice session) and
`<lr-sequence-playback>` (a discrete sequence stepper, no native media). Adopts
`DocumentAnchorTarget` with
`anchorKinds: ['time-range']` only — no text selection is bound. The transcript virtualizes through
`<lr-virtual-list>` the same way `lr-pdf-viewer` virtualizes pages.

Removing `mime-type` consumes the absent hint safely and restores automatic video fallback unless
`kind` explicitly selects audio. Attribute removal keeps its `null` property readback; an explicit
empty hint remains empty, and a later audio MIME value restores audio detection.

With `cueSource` null, a cue with no `end` extends to the next strictly chronological applicable start, or remains
open-ended when none exists. Equal starts do not end each other. The player indexes starts on cue
assignment/duration changes in O(n log n) work with O(n) retained intervals. Seek/time updates
resolve the interval in O(log n), or O(1) while the previous answer interval still applies. Overlaps
choose the greatest effective start, then the later original index. Caller order, first ID
admission and explicit ends are retained; a paused seek uses
replacement cues immediately, even before rendering. Duration changes preserve the same
effective-start rules.

An unavailable timeline keeps its resting border and background under hover and press. Enabled
seeking retains token-driven pointer feedback.

The default document-viewer renderer advertises `time-range` anchors but not search: the generic
document payload has no cue/transcript field, so advertising search there would expose a control
whose result is always empty. Standalone `<lr-av-player>` search remains available whenever the
consumer supplies `cues` or a complete `cueSource` directly.

**Complete indexed transcript:** `cueSource: LyraAvCueSource | null = null` (attribute: false)
takes display precedence over `cues`, bypassing the legacy snapshot, tick index and search scans.
Invalid non-null providers fail visibly; setting `null` restores the current legacy cue input and
recomputes its retained search. The legacy `cues` route retains its 10,000-cue cap. Provider storage,
interval indexing and full-text/speaker search remain host-owned; no complete transcript array,
all-ID index or match array is retained by the player.

```ts
import type { LyraAvCueSource, LyraAvActiveCue, LyraAvCueSearch, LyraAvCue } from
  "@aceshooting/lyra-ui/components/media/av-player/av-player.class.js";
import type { LyraSourceRequest, LyraSourceValue } from
  "@aceshooting/lyra-ui/utilities/data-preparation.js";
```

`LyraAvCueSource` supplies immutable `revision` (a nonempty string or finite number), safe
nonnegative integer `count`, and four required own-data methods. Methods may return values or
PromiseLike results; requests include an abort `signal`:

- `getCue(index, request): LyraSourceValue<LyraAvCue | null>` returns the cue at its exact original
  zero-based source index. An unavailable/null in-range position stays an unavailable,
  noninteractive row; it never deletes or compacts a logical position.
- `findCue(cueId, request): LyraSourceValue<{ index, cue } | null>` resolves a globally unique ID
  directly, without scanning cached rows. Returned identity/index must agree with the request.
- `activeAt(time, request): LyraSourceValue<LyraAvActiveCue>` resolves the complete source's active
  cue and its exact validity interval.
- `search(query, request): LyraSourceValue<LyraAvCueSearch>` searches the complete index; this
  request additionally includes the effective `locale`.

Provider cue records are closed, cloned and frozen own-data values:
`{ cueId, start, end?, text, speaker? }`. `cueId` must already be trimmed, nonempty and at most
256 UTF-16 units; `text` is at most 100,000 units and `speaker` at most 4,096. Start is finite and
nonnegative; an explicit end is finite and at least start. Malformed, accessor-backed, oversized,
duplicate or contradictory locally observed records fail without silent coercion/truncation.
The provider guarantees global ID uniqueness and immutable agreement among row, lookup, active
and search replies; the player checks only its bounded observable records. Source timestamps are
absolute media seconds and are never clamped into invented end-of-media active cues. Committed
row activation seeks that row's original start through the existing media seek contract.

`LyraAvActiveCue` is `{ index: number | null, cue: LyraAvCue | null, validFrom, validUntil }`.
Index/cue must both be null or both valid; a real index is below source count. The half-open
`[validFrom, validUntil)` interval must be nonempty and contain the requested time; infinities
are allowed only as interval bounds. Explicit cue start/end must also contain the requested time.
The provider resolves omitted ends and overlaps using greatest start, then later original source
index, including complete no-active intervals. The player retains one completed answer interval;
ticks inside it make no active request. Seeks invalidate that interval even when they stay within
its bounds. Out-of-interval ticks coalesce to the latest desired time; returning to a cached answer
revokes an obsolete pending intent. `lr-cue-change` retains `{ cueId, index }` with the original
source index, or `null`/`-1`, and emits only on an actual active identity/index transition.

The transcript uses 32-row pages, at most 128 ready cues/four pages, and at most two staged pages
(64 cues). `getCue` calls are sequential within each page, with at most two physically pending
calls across pages. At most two additional active/selected-or-transient-match records are retained.
The resulting 194-record payload ceiling is 20,244,288 UTF-16 units at maximum field sizes,
separate from object overhead, validation temporaries, query strings and opaque provider storage.
The list exposes the full logical `count`; cache size does not redefine transcript length.

Existing `search(query): Promise<number>` trims its query and matches locale-aware,
case-insensitive substrings of complete cue text OR speaker. `LyraAvCueSearch` supplies exact safe
`count <= source.count` and own-data `getMatch(matchIndex, request)`, returning `{ index, cue }`
for an original row. Each source index occurs at most once in provider match order. The player
captures this indexed handle without enumerating hits, reveals the first match before resolving,
and retains only the count, match ordinal and one selected record. `searchNext()`/`searchPrevious()`
wrap the complete match ordinal and reveal the original list row without seeking media. Returned
matches must satisfy the query and agree with subsequently loaded rows before scroll/highlight
commit. Visible ready-row highlighting checks only bounded cue text/speaker.

`lr-search-change` keeps `{ query, matchCount, matchCountExact: true, activeIndex }`, where
`activeIndex` is the match ordinal, not the cue's original row index. Only authoritative completed
matches, exact-zero results and explicit clears emit. Empty queries/`clearSearch()` clear state
without provider work; canceled/unavailable search resolves `0` and navigation resolves `false`
without fabricating an exact-zero event. Unavailable text uses the existing localized `error`
surface and light-DOM failure announcements; loading uses the existing loading label. Locale
changes restart the current query;
ordinary playback ticks do not repeat search.

One physical `activeAt`, one `findCue`, one `search` and one `getMatch` may run alongside the two
`getCue` calls: six fixed physical permits, each with only the latest logical demand. Ignored aborts
hold permits until actual settlement; cancellation settles obsolete search/navigation promises
promptly without allowing overlapping replacement calls. Reassign even the same source, or call
a keyless `requestUpdate()`, after revision/state changes. Named presentation updates reuse admitted
data. Rebind, replacement, clearing, disconnect and adoption revoke old rows, intervals, search
handles and effects; reconnect recaptures current input. Existing transcript/cue/state parts and
time-range anchor methods apply; no new cue-ID anchor kind or cue-selection event is added.

**Exported cue-source declarations:**

These types are exported from the granular AV class entry shown above.

`LyraAvCueSource {
  readonly revision: LyraSourceRevision;
  readonly count: number;
  getCue(index: number, request: LyraSourceRequest): LyraSourceValue<LyraAvCue | null>;
  findCue(cueId: string, request: LyraSourceRequest): LyraSourceValue<{ readonly index: number; readonly cue: LyraAvCue } | null>;
  activeAt(time: number, request: LyraSourceRequest): LyraSourceValue<LyraAvActiveCue>;
  search(query: string, request: LyraSourceRequest & { readonly locale: string }): LyraSourceValue<LyraAvCueSearch>;
}`

`LyraAvActiveCue {
  readonly index: number | null;
  readonly cue: LyraAvCue | null;
  readonly validFrom: number;
  readonly validUntil: number;
}`

`LyraAvCueSearch {
  readonly count: number;
  getMatch(matchIndex: number, request: LyraSourceRequest): LyraSourceValue<{ readonly index: number; readonly cue: LyraAvCue }>;
}`

**Properties:** `src: string = ''`, `name: string = ''`, `kind?: 'audio' | 'video'`
(attribute-backed auto-detection override), `mimeType: string = ''` (attribute `mime-type`), `poster: string =
''`, `loop: boolean = false`, `muted: boolean = false`, `preload: 'none' | 'metadata' | 'auto' =
'metadata'`, `playbackRate: number = 1` (attribute `playback-rate`, reflected),
`volume: number = 1` (attribute `volume`, reflected; normalized to `0..1`),
`controlsSurface: LyraAvControlsSurface = 'regular'` (attribute `controls-surface`, reflected) —
selects the owned playback-rate toolbar treatment; `'clear'` uses a white foreground and dark
gradient scrim, while browser-owned native media controls are unchanged,
`rates: readonly number[] = [0.75, 1, 1.25, 1.5, 2]` (attribute: false),
`cues: readonly LyraAvCue[] = []` (attribute: false), `peaks: readonly number[] = []`
(attribute: false), and `tracks: readonly LyraAvTrack[] = []` (attribute: false). Each collection is
normalized synchronously on assignment into a bounded, cloned, frozen snapshot when its legacy
route is active; mutate by assigning a new collection. The inherited
anchor-target surface is `highlights: readonly LyraHighlight[] = []` (property only; assign a new
collection to update), `activeHighlightId: string | null = null` (attribute `active-highlight-id`),
`anchor: LyraAnchor | string | null = null` (property only), and readonly
`anchorKinds: readonly LyraAnchorKind[] = ['time-range']`.
`LyraAvCue = { readonly cueId, readonly start, readonly end?, readonly text, readonly speaker? }`;
`LyraAvTrack = { readonly src, readonly kind: 'subtitles' | 'captions' | 'descriptions', readonly
srclang, readonly label, readonly default? }`. Their retained records are frozen as well as the
outer arrays. Cue IDs are trimmed and must be nonempty; the first cue for a `cueId` is retained and
blank or later duplicate records are ignored.

Only exact `kind="audio"` and `kind="video"` values override MIME auto-detection. An unrecognized
runtime or attribute value falls back to `mimeType` (`audio/*` renders audio; every other value
renders video) and never appears in `lr-load`'s `detail.kind`.

`poster` is ignored for audio and is validated with the same safe media-source allowlist as `src`
before reaching the native video element; an unsafe poster URL is omitted.

Runtime legacy input is normalized before it reaches media, canvas, or `Intl`: cue/highlight times
and waveform peaks are clamped to their valid ranges; non-finite native duration/current time
cannot leak into state or events. `rates` keeps only unique finite values in the supported
`0.0625..16` range, while always including the normalized current `playbackRate`.

**Prepared whole-duration waveform:** `waveform: LyraPreparedWaveform | null = null`
(attribute: false) takes precedence over `peaks` for waveform presence, painting and failure state.
Set `null` to restore current legacy peaks/validity. The supplied descriptor remains caller-owned
and retained by identity; the player clones/freezes only its bounded accepted fields/buckets.
It never decodes media, calls a sample reader or materializes original samples.

```ts
import { prepareLyraWaveform } from "@aceshooting/lyra-ui/utilities/data-preparation.js";
import type { LyraPreparedWaveform, LyraIndexedInput } from
  "@aceshooting/lyra-ui/utilities/data-preparation.js";

player.waveform = await prepareLyraWaveform(samples, {
  duration: durationSeconds,
  maxBuckets: 1000,
});
```

`prepareLyraWaveform(input: LyraIndexedInput<number>, options: LyraPreparationOptions &
{ duration: number; maxBuckets?: number }): Promise<LyraPreparedWaveform>` asynchronously scans
every original position once. Its immutable reader supplies `revision`, safe nonnegative `count`,
and `read(start, count, { signal })`; each response must be an array of exactly the requested size.
Preparation yields between chunks, supports `signal`, defaults `batchSize` to 2,048 and clamps it
to at most 8,192. Budgets must be positive safe integers; `maxBuckets` defaults/clamps to 65,536.
Finite samples clamp to `[0, 1]`; nonfinite/missing samples preserve their positions and contribute
no peak. Revision/count changes or reader failures reject. Only bounded chunks and output buckets
are retained; source storage/index construction remains caller-owned. Hosts may also author a
complete bounded envelope directly, with responsibility for truthful full-source statistics.

`LyraPreparedWaveform` has `{ revision, counts: { sourceCount, validCount, invalidCount },
sampleCount, duration, buckets, firstAmplitude, lastAmplitude }`. Counts/sampleCount are safe
nonnegative integers, `sampleCount === sourceCount`, and valid/invalid counts conserve the source.
Revision is a nonempty string or finite number; duration is finite nonnegative seconds.
At most 65,536 own-data buckets `{ startIndex, endIndex, maxAmplitude }` must form ordered,
contiguous, nonempty half-open intervals partitioning `[0, sampleCount)`. Maxima are finite in
`[0, 1]`. Endpoint amplitudes describe the original first/last samples, each null when invalid or
absent, otherwise finite `[0, 1]` and no larger than its covering bucket's maximum. Empty input
requires zero counts, empty buckets and null endpoints; all-invalid input has zero bucket maxima
and null endpoints. Accessors, sparse fields, gaps/overlaps and malformed counts/amplitudes reject
without clipping or legacy fallback.

Painting maps each original index interval across the complete duration; unequal intervals retain
their actual proportions. A monotone O(bucketCount + barCount) pass merges overlapping interval
maxima into at most 4,096 physical bars. Final-bucket energy survives even when the final endpoint
amplitude is quiet. Canvas backing stores stay within 4,096 per dimension and 8,388,608 pixels.
Once positive native media metadata is authoritative, envelope duration must agree within
`0.001 + 4 * Number.EPSILON * max(mediaDuration, envelopeDuration)` seconds. Mismatch shows a
localized `error` and plain seek rail until metadata/envelope agree, without changing native
duration or seek coordinates. Before metadata the envelope may show proportions, but cannot enable
native seeking. Source/kind/MIME changes reset old metadata authority; duration changes recheck it.

Malformed/mismatched waveforms use localized `avPlayerWaveformUnavailable` feedback and a fresh
post-mount assertive light-DOM announcement, without a new waveform event or `lr-render-error`.
Reassign even the same descriptor, or call a keyless `requestUpdate()`, after changing it; named
playback/presentation updates reuse the accepted snapshot. Legacy `peaks` must already represent
the whole recording: arrays over 65,536 entries reject before reading any entry, retaining no
prefix. Valid bounded peaks keep their existing normalization and endpoint-preserving downsampling.
Prepared presence hides inactive legacy admission errors; clearing it exposes current legacy
validity again.

**Waveform lifecycle:** with `peaks` or `waveform`, waveform canvas painting is gated by player visibility when
`IntersectionObserver` is available. Peak, theme, and resize changes while the player is
off-screen coalesce into one paint on re-entry; environments without that API retain eager
painting.

**Methods:** `play(): Promise<void>` proxies the native media element and preserves its native
promise/rejection (before the media mounts it returns an already-resolved promise). `pause()` and
`toggle()` proxy the native element; an internal toggle that cannot start playback renders the
error state and emits `lr-render-error`. `seek(seconds)` sets `currentTime` and forces an immediate
`lr-time-change`. `search(query)` resolves the match count; `searchNext()`/`searchPrevious()` wrap
and reveal the active match in the virtualized transcript without seeking playback; `clearSearch()`
resets the query and match state. `focus(options?)`, `blur()`, and `click()` forward to the native
`[part='media']` element, which carries `controls` and is therefore the player's primary focusable
affordance. `scrollToAnchor(target: LyraAnchor | string): Promise<boolean>` seeks to a resolved
`time-range` anchor's `start` after media metadata loads and makes an id-addressed highlight active;
unsupported or unresolved targets report `false` through the return value and `lr-anchor-result`.

**Events:** `lr-play`, `lr-pause`, `lr-load` (`detail: { duration, kind }`), `lr-time-change`
(`detail: { currentTime }`, throttled to at most 4/s while playing plus one extra per `seek()`),
`lr-rate-change` (`detail: { rate }`), `lr-cue-change`
(`detail: { readonly cueId, readonly index }`; `cueId` is `null` and `index` is `-1` when no cue is active),
`lr-highlight-activate` (`detail: { highlightId }`), `lr-anchor-result` (`detail: {
found }`), `lr-search-change` (`detail: { query, matchCount, matchCountExact, activeIndex }`;
`matchCountExact` is always `true` for emitted results — legacy search covers the admitted `cues`
array with no additional ceiling, while source search reports the complete indexed count), and
`lr-render-error` (`detail: { error }`). The native `ended`, `error`, `loadedmetadata`, `pause`,
`play`, `timeupdate`, and `volumechange`
events are also relayed exactly once from the host as native `Event` instances. Like the original
media notifications, these relays are non-bubbling, non-composed, and non-cancelable. The richer
`lr-*` notifications above remain unchanged. The native media element's `focus`/`blur` are relayed
exactly once as owner-realm native `FocusEvent`s (bubbling and composed, preserving
`relatedTarget`). `lr-text-select` is not part of this
player's event contract: transcript rows live inside the embedded virtual list's nested shadow
root, so no selection binding is installed.

**CSS parts:** `base`, `media` (the native `<audio>`/`<video>` element), `toolbar`, `rate-select`,
`timeline` (click-to-seek and arrow-key seeking), `timeline-marker` (one per `time-range` highlight;
`data-tone`, `data-active`), `transcript` (the `<lr-virtual-list>` itself), `cue` (`aria-current`,
`data-match`, `data-active-match`), `cue-current` (added alongside `cue` on the row the playhead is
inside), `cue-match` (added alongside `cue` on a row matching the current search query),
`cue-active-match` (added alongside `cue`/`cue-match` on the row holding the current match),
`cue-time`, `cue-speaker`, `cue-text`, `error`, and `anchor-live-region` (an aria-hidden, non-live
shadow mirror of the latest anchor-jump message; the spoken copy is appended to the shared
document-level polite sink only while the viewer and its composed ancestors are exposed to the
accessibility tree).

`error` is ordinary localized visible text, not a shadow live region. A fresh post-mount native,
playback, or unsafe-source failure appends the localized message to the document's pre-mounted
`[data-lr-live-region="assertive"]` sink. An already-unsafe initial `src` remains visible but does
not interrupt on mount; identical later failures append distinct children. `[part="base"]` remains
a named `role="region"` in the unsafe-source branch and across a safe-to-unsafe transition, so the
player does not lose its landmark or accessible name when its media is replaced by the error.

Every cue-level part above is rendered into the embedded `<lr-virtual-list>`'s own shadow root and
forwarded back out through `exportparts`, so `lr-av-player::part(cue)` and friends work from a
consumer stylesheet. The three cue states are separate part _names_ rather than attribute selectors,
because Shadow Parts forbids an attribute selector after `::part()` —
`::part(cue)[aria-current='true']` is invalid CSS, so use `::part(cue-current)`. The `aria-current`
and `data-*` attributes remain on each row for semantics and scripting.

**Themeable custom properties:** `--lr-av-player-transcript-height` (default
`var(--lr-size-16rem)` — block size of the transcript pane; forwarded to the embedded
`<lr-virtual-list>`'s own `--lr-virtual-list-height`). `--lr-av-player-marker-active-color` (default
`var(--lr-color-brand)`) — the outline of the `[part='timeline-marker']` matching
`activeHighlightId`, leaving the per-tone marker fills alone. It is an inline `var()` fallback at
the point of use rather than a `:host` declaration, so it can be set on the element or on any
ancestor — `::part(timeline-marker)[data-active]` is invalid CSS (Shadow Parts forbids an attribute
selector after `::part()`), so re-pointing the shared `--lr-color-brand` token was the only previous
lever.

Each `[part='timeline-marker']`'s own background is independently overridable per tone, the same
inline-`var()`-fallback pattern as `--lr-av-player-marker-active-color` above:
`--lr-av-player-marker-bg` (default `color-mix(in srgb, var(--lr-color-brand) 35%, transparent)`) —
no (or an unrecognized) `data-tone`; `--lr-av-player-marker-success-bg` (default `color-mix(in srgb,
var(--lr-color-success) 35%, transparent)`) — `data-tone="success"`;
`--lr-av-player-marker-warning-bg` (default `color-mix(in srgb, var(--lr-color-warning) 35%,
transparent)`) — `data-tone="warning"`; `--lr-av-player-marker-danger-bg` (default `color-mix(in
srgb, var(--lr-color-danger) 35%, transparent)`) — `data-tone="danger"`; and
`--lr-av-player-marker-neutral-bg` (default `color-mix(in srgb, var(--lr-color-text) 25%,
transparent)`) — `data-tone="neutral"`. Each can be set on the element or on any ancestor without
hijacking the shared `--lr-color-success`/`-warning`/`-danger`/`-brand`/`-text` tokens used
elsewhere in the theme. `--lr-av-player-marker-fill` is the resting fill a marker actually renders,
resolved per tone from those `-bg` knobs; its hover and pressed states are color mixes taken from
that value, so setting it directly retints all three states of one marker at once — retint a whole
tone through the matching `-bg` knob instead.

Three further cue-state properties tint the transcript: `--lr-av-player-cue-hover-bg` (default
`var(--lr-color-brand-quiet)`) is the background of a hovered `cue` row, and its pressed state is a
color mix taken from that same value rather than a separate knob, so retuning it keeps its pressed
step too. `--lr-av-player-cue-current-bg` (default `var(--lr-color-brand-quiet)`) is the background
of the `cue-current` row the playhead is inside, and `--lr-av-player-cue-active-match-color`
(default `var(--lr-color-warning)`) is the outline of the `cue-active-match` row, leaving the other
matches' dashed outline on the shared warning token. All three are inline `var()` fallbacks at the
point of use rather than `:host` declarations, so any of them can be set on the element or on any
ancestor.

**RTL behavior:** surrounding controls follow the inherited direction, but the elapsed-media axis
on `[part='timeline']` stays physical left-to-right. ArrowLeft rewinds and ArrowRight advances in
both LTR and RTL.

## `lr-video`

Experimental inline native video player with custom controls, safe declarative sources/tracks,
selectable captions, and bounded WebVTT thumbnail previews. It mirrors the public Web Awesome Video
API under the `lr-` prefix. Import the granular registration entry with
`import '@aceshooting/lyra-ui/components/lr-video.js'`.

**Optional panorama:** `projection: LyraMediaProjection = 'flat'` accepts `'flat'` or
`'equirectangular'`. Set `projection="equirectangular"` and `engine="webgl"` together to request
spherical rendering from optional `@aceshooting/lyra-3d/panorama`. The default
`engine: Engine3dPreference = 'builtin'` retains flat media. Invalid values normalize to defaults.
Missing companion, unavailable WebGL2, errors or context loss retain native flat media with
localized feedback. `lr-engine-fallback` carries `{ from, to, reason }`, where reason is
`'unavailable'`, `'unsupported'`, `'context-lost'` or `'error'`.

`panoramaCamera: LyraPanoramaCamera` (property only) defaults to
`{ yaw: 0, pitch: 0, fieldOfView: 75 }`. Yaw/pitch are radians; vertical fieldOfView is degrees,
clamped to 20–100. Authored writes are silent. Arrow keys look around (horizontal keys honor
RTL), +/- zoom, and Home resets. `lr-panorama-camera-change` carries `{ camera }` after gestures
or keyboard changes.

`hotspots: readonly LyraPanoramaHotspot[] = []` (property only) accepts
`{ id, yaw, pitch, label? }`, with radians and pitch within ±π/2. Invalid rows are omitted;
first valid unique ID wins. Reassign after changes. A visible keyboard alternative pages 200
hotspots with arrows, Home/End and Previous/Next navigation. `lr-panorama-hotspot-select` carries
`{ hotspot, id, index }`.

When progress is unavailable, the disabled native range input and its visible timeline track retain
resting paint under hover and press. Once media duration makes progress available, the track retains
its token-driven hover and press feedback.

**Properties:** `autoplay: boolean = false`, `autoplayMuted: boolean = false` (attribute
`autoplay-muted`), `autoplayOnVisible: boolean = false` (attribute `autoplay-on-visible`),
`controls: 'none' | 'standard' | 'full' = 'standard'`, `currentTime: number = 0` (attribute
`currentTime`; HTML exposes it as lowercase `currenttime`, with legacy `current-time` also
accepted), `duration: number = 0` (live/read-only in normal use), `iconLibrary: string =
'system'` (attribute `icon-library`), `loop: boolean = false`, `muted: boolean = false`,
`readonly playing: boolean` (live state reflected as the `playing` attribute; drive it with `play()`
and `pause()`, since assigning it throws in strict-mode code), `poster: string = ''`, `preload: 'auto'
| 'metadata' | 'none' = 'metadata'`, `src: string = ''`, `thumbnails: string = ''`, `title: string =
''`, and `volume: number = 1`. The private native `<video>` always carries `playsinline`; native
browser controls stay disabled because the selected Lyra preset owns the control surface.
`autoplayOnVisible` does not start a video merely because it is visible: it pauses a currently
playing video when it leaves view and resumes only that visibility-owned pause when it returns.
Turning the property off while such a pause is pending resumes immediately; observer rebuilds,
temporary disconnects, reconnects, and same-origin adoption preserve the pending ownership. An
explicit user/API pause or source reload/change revokes it so later visibility changes cannot
restart user-stopped media.

`controls="standard"` renders play/pause, timeline and elapsed/duration labels, volume/mute,
available captions, and capability-gated fullscreen. `controls="full"` adds playback rate and
capability-gated picture in picture. `controls="none"` removes the control bar but leaves the
poster and active caption overlays available. Fullscreen/PiP/caption affordances are feature-gated
instead of browser-name-gated and are probed through the concrete native element's current owner
realm. While the poster is visible, its button is the only exposed play action; the ordinary
control-bar play toggle is hidden until the poster is dismissed.

**Methods:** `getState(): VideoState` returns a fresh synchronous
`{ playing, currentTime, duration, volume, muted, playbackRate }` snapshot. `VideoState` is the
canonical upstream-compatible authoring type.
`getVideoElement(): HTMLVideoElement | undefined` returns the private native element after mount;
`play(): Promise<void>` returns the exact native promise and preserves its rejection; `pause()`,
`togglePlay()`, `toggleMute()`, `seek(time)`, `setPlaybackRate(rate)`, and `setVolume(volume)` proxy
finite, clamped media state; `requestFullscreen()` and `exitFullscreen()` preserve the platform
promise/rejection and reject with an owner-realm `DOMException` named `NotSupportedError` when the
capability is absent. `load()` is a
Lyra extension that re-clones current light-DOM sources/tracks and restarts native resource
selection under a fresh event generation. `focus(options?)`, `blur()`, and `click()` forward to the
play/pause control (absent, and therefore a no-op, under `controls="none"`).

**Events:** native `ended`, `error`, `loadedmetadata`, `pause`, `play`, `timeupdate`, and
`volumechange`, relayed exactly once from the host as native `Event` instances. They remain
non-bubbling, non-composed, and non-cancelable. Scrubbing the custom timeline also dispatches an
immediate host `timeupdate`, before a browser's eventual native seek notification. The internal
play/pause control's `focus`/`blur` are relayed exactly once as owner-realm native `FocusEvent`s
(bubbling and composed, preserving `relatedTarget`).
With the optional panorama, `lr-panorama-camera-change` (`detail: { camera }`, after a user gesture or
keyboard change), `lr-panorama-hotspot-select` (`detail: { hotspot, id, index }`) and
`lr-engine-fallback` (`detail: { from, to, reason }`) are emitted; none is cancelable.

**Slots:** the default slot accepts direct `<source>` and `<track>` children;
`controls-after-play`, `controls-start`, `exit-fullscreen-icon`, `fullscreen-icon`, `mute-icon`,
`pause-icon`, `play-icon`, `poster-icon`, and `volume-icon` customize the control surface. Consumer
source/track nodes remain in light DOM: the component inserts fresh private clones containing only
safe URL, source (`type`, `media`), and track (`kind`, `srclang`, `label`, `default`) attributes.
The seven `*-icon` slots are decorative glyph overrides: assigned content renders in an inert,
`aria-hidden`, pointer-transparent visual layer beside the named native button, never inside its
flat-tree descendants. An accidentally supplied link, button, or input therefore cannot create a
nested action or second keyboard stop. `controls-start` and `controls-after-play` remain ordinary
composition slots and may intentionally contain interactive controls.

A declarative host `aria-label` or `title` remains the component's overall name and is not copied to
the private native video; that element receives the localized player-purpose name. An explicitly
empty host `aria-label` is preserved exactly as an empty native-video name. Caption/subtitle tracks
selected for Lyra's custom overlay use native `mode="hidden"`, keeping cue activity available
without asking the browser to paint a duplicate native caption layer.

**CSS parts:** `base` and `video-wrapper` (aliases on the same root node), `caption`,
`caption-overlay`, `controls`, `controls-overlay`, `poster-overlay`, `poster-play-button`,
`progress`, `thumbnail`, `timeline`, `timeline-indicator`, `timeline-thumb`, `timeline-track`,
`video`, and `video-title-overlay`.
Panorama parts (with `projection="equirectangular"`): `panorama` (the keyboard-operable spherical
viewport), `panorama-engine` (the optional renderer container), `panorama-notice` (localized
renderer loading or fallback feedback), `panorama-hotspots` (the paginated hotspot alternative)
with one `panorama-hotspot` button per hotspot, and `panorama-page` (a hotspot page action).

The `progress` range carries `aria-label` and points through `aria-describedby` to a localized
`{current} of {duration}` description (key `avPlayerPosition`, shared with `lr-av-player`) built
from the same locale-formatted clock times as the visible labels. This deliberately avoids relying
on `aria-valuetext`, which browsers ignore on native range semantics. Before duration is available,
the same range remains in the DOM as a disabled `0..0` control with its description intact,
avoiding a disappearing/reappearing semantic target.

**Themeable custom properties:** `--controls-background` (default
`var(--lr-color-overlay-strong)`), `--controls-color` (default
`var(--lr-color-on-strong-overlay)`), and
`--poster-play-button-background` (default `var(--lr-color-surface-overlay)`). These exact names are
kept for mechanical Web Awesome migration. Lyra also supplies
`--lr-video-poster-play-button-hover-bg` (default is the existing hover color mix) and
`--lr-video-poster-play-button-hover-border-color` (default `var(--lr-color-brand)`).

Caption and playback-rate selectors remain native `<select>` controls with decorative, pointer-inert
chevrons; their option foreground and background inherit `--controls-color` and
`--controls-background`. Controls, elapsed/title text, caption text, and selectors consistently use
the semantic strong-overlay foreground. The fallback remains legible in light and dark themes.
The poster play button and its glyph instead default to `--lr-color-text` against their
`--lr-color-surface-overlay` surface. An explicit `--controls-color` retains final precedence on
both poster and overlay controls, and forced-colors mode remains UA-owned.

**RTL behavior:** surrounding controls follow the inherited direction, while the elapsed-media axis
stays physical left-to-right. Native ArrowRight advances and ArrowLeft rewinds the timeline in both
LTR and RTL.

**Thumbnail security and lifecycle:** `thumbnails` is validated before `fetch()`, read through a
256 KiB byte ceiling, and parsed up to 2,000 cues. Cue image URLs are resolved relative to the VTT
file and validated again before reaching `<img>`; `#xywh=x,y,width,height` sprite fragments are
supported. A generation token is checked after every await, and changing `thumbnails` or
disconnecting prevents an older response from painting over newer state. Invalid, oversized,
failed, or empty thumbnail files fail closed to no preview; no caught remote error text is shown.

```html
<lr-video controls="full" poster="/posters/demo.jpg" title="Product demo">
  <source src="/video/demo.webm" type="video/webm" />
  <source src="/video/demo.mp4" type="video/mp4" />
  <track
    src="/captions/demo-en.vtt"
    kind="captions"
    srclang="en"
    label="English"
    default
  />
</lr-video>
```

## `lr-video-playlist`

Experimental direct-child `<lr-video>` playlist with a visible current-video stage and
keyboard-navigable item list. It mirrors the public Web Awesome Video Playlist API under the `lr-`
prefix. Import the granular registration entry with
`import '@aceshooting/lyra-ui/components/lr-video-playlist.js'`.

**Properties:** `controls: 'none' | 'standard' | 'full' = 'full'` (reflected and forwarded to every
direct child), and `iconLibrary: string = 'system'` (attribute `icon-library`, non-reflected and
forwarded). Lyra additionally provides `withoutAutoAdvance: boolean = false` (attribute
`without-auto-advance`; disables completion-driven navigation, so `repeat` has no effect either)
and `repeat: 'none' | 'one' | 'all' = 'none'`. Leaving `without-auto-advance` unset preserves the
mirrored behavior in which an ended video starts the next one. `repeat="one"` restarts the current video; `repeat="all"` wraps the final video to the
first. `items: readonly LyraVideoPlaylistItem[] = []` (attribute: false) is deterministic
first-render row metadata with `{ title, poster?, duration?, unavailable? }`, indexed to the direct
video children. Assign the same value before the server and browser first render. Seeded rows stay
visible but disabled while live children are unavailable; after hydration, each child's live
title/poster/duration and native `inert` state become authoritative in a corrective update that
reuses the server-rendered row nodes. Once live children have been observed, later removal does not
make stale seed rows reappear.
Live-child updates no longer scan the superseded seed metadata. Removing every adopted child
keeps live-child ownership; it does not reactivate the original seed rows.

**Methods:** `goTo(index)` selects a finite integer direct-child index; invalid, fractional, and
inert-child indexes are no-ops. Calling it for the current index still emits `lr-video-change`, matching
the mirrored contract. `next()` and `previous()` select the next or previous enabled child when one
exists. `focus(options?)`, `blur()`, and `click()` forward to the playlist row that currently owns
the optional-arrow navigation cursor (falling back to the first enabled row). This forwarding is a
convenience; every enabled row is independently reachable through ordinary sequential Tab order.

**Events:** internal `focus`/`blur` from a playlist row are relayed exactly once as owner-realm
native `FocusEvent`s (bubbling and composed, preserving `relatedTarget`).
`lr-video-change` is bubbling and composed but non-cancelable, with exact
detail `{ previousIndex, currentIndex, video }`. `video` is a fresh detached, recursively frozen plain-data snapshot with
exact shape `{ title, poster, sources, tracks }`, not the live child element, or `null`. `sources`
contains fresh `{ src, type, media }` records for the child's direct `src` and `<source>`
declarations; `tracks` contains fresh `{ src, kind, srclang, label, default }` records. A listener
that needs to annotate or reshape the payload must create its own mutable copy; the dispatched
detail and every nested record/array reject mutation. Also fired when a light-DOM mutation (a video
removed, or every remaining video made `inert`/disabled) leaves no enabled video to replace a
previously active one: `video` is `null` and `currentIndex` is `-1` in that case.

**Slot:** the default slot accepts direct `<lr-video>` children. Nested videos and other elements
are not playlist items.

**CSS parts:** `video-playlist` (the root node), `playlist`,
`playlist-duration`, `playlist-item`, `playlist-thumbnail`, and `playlist-title`.

**Themeable custom properties:** `--lr-video-playlist-item-current-border-color` (default
`var(--lr-color-brand)`) and `--lr-video-playlist-item-current-bg` (default
`var(--lr-color-brand-fill-quiet)`) style the active playlist row, and are kept under the pointer:
its hover and press mix from the current background rather than the plain-row surface.

Only the active child is visible and loaded. Before another child is activated, the outgoing native
player is synchronously paused, stripped of its private source/track clones, and reloaded into an
empty selection state. The incoming child then safely re-clones its own light-DOM declarations.
Valid user volume, mute, playback-rate, and selected-caption preferences carry across that boundary;
selected caption tracks use `hidden`, not `showing`, so the active child's custom overlay is the only
caption paint. Current time does not carry. Events and rejected play promises from a superseded
activation cannot affect the current child. The playlist snapshots each child's authored
`controls`, `iconLibrary`, and `hidden` values before projecting effective state, and restores those
values plus resource selection when that exact child is removed or reparented. Removing or
reordering duplicate-metadata children is identity-safe; disconnecting pauses/unloads every child
while preserving ownership for a later reconnect in a new realm.

Every enabled playlist button has `tabindex="0"`; disabled rows for inert children use `-1`.
Up/Down, Home/End, and mirrored Left/Right remain optional shortcuts, and the selected item exposes
`aria-current`. Each visible known duration is associated with its row using `aria-describedby`;
missing duration creates no empty description, and metadata updates replace the localized value.
At narrow
allocations the sidebar moves below the video through a container query; long titles ellipsize
without widening the host.

**A child marked `inert` is unavailable:** it never becomes the active video,
`next()`/`previous()`/`goTo()` and automatic advancement step past it, and its playlist row renders `disabled`
and `tabindex="-1"` so neither sequential nor optional-arrow focus can land on it — an inert element
refuses focus, which would leave `focus()` a silent no-op and kill the next arrow press. `<lr-video>`
has no `disabled`
property; use the platform `inert` state exclusively. Only the child's **own** `inert` counts: a
playlist inerted wholesale by an open modal keeps playing. The attribute is watched live, so
marking the _current_ video inert moves the selection to the nearest enabled child (emitting
`lr-video-change`) and hands optional-arrow focus to the row that replaced it, instead of leaving a
stale arrow-navigation cursor on a row that can no longer take focus.

Only the native `ended` notification drives automatic advancement and repeat completion. A native `error`
records the stopped state but never changes selection; recovery and retry remain consumer-owned.

```html
<lr-video-playlist controls="full" repeat="all">
  <lr-video title="Introduction" poster="/posters/introduction.jpg">
    <source src="/video/introduction.mp4" type="video/mp4" />
  </lr-video>
  <lr-video title="Advanced workflow" poster="/posters/advanced.jpg">
    <source src="/video/advanced.mp4" type="video/mp4" />
    <track
      src="/captions/advanced-en.vtt"
      kind="captions"
      srclang="en"
      label="English"
      default
    />
  </lr-video>
</lr-video-playlist>
```

## Exported TypeScript contracts

These named interfaces and helper signatures are available to typed integrations. They are grouped by capability so the component sections above can stay focused.

- **`components-media-animation-animation-catalog-contracts`** — Supporting data types and helpers for this component family.
  Import: `@aceshooting/lyra-ui/components/media/animation/animation.class.js`.
  `getAnimationNames(): LyraMirrorAnimationName[]`
  Import: `@aceshooting/lyra-ui/components/media/animation/animation.class.js`.
  `getEasingNames(): LyraAnimationEasingName[]`

- **`components-media-attachment-chip-attachment-chip-contracts`** — Supporting data types and helpers for this component family.
  Import: `@aceshooting/lyra-ui/components/media/attachment-chip/attachment-chip.class.js`.
  `LyraAttachmentIdDetail {
    attachmentId: string;
  }`
  Import: `@aceshooting/lyra-ui/components/media/attachment-chip/attachment-chip.class.js`.
  `LyraAttachmentPreviewRequestDetail extends LyraAttachmentIdDetail {
    name: string;
    mimeType: string;
    src: string;
    // Inherited from LyraAttachmentIdDetail.
    attachmentId: string;
  }`

- **`components-media-attachment-trigger-attachment-trigger-contracts`** — Supporting data types and helpers for this component family.
  Import: `@aceshooting/lyra-ui/components/media/attachment-trigger/attachment-trigger.class.js`.
  `LyraAttachmentFilesDetail {
    capability: LyraFileBackedCapability;
    files: readonly File[];
    rejected: readonly LyraFileInputRejectedFile[];
    remainingFiles: number | null;
    remainingTotalSize: number | null;
  }`

- **`components-media-av-player-av-metadata-contracts`** — Supporting data types and helpers for this component family.
  Import: `@aceshooting/lyra-ui/components/media/av-player/av-player.class.js`.
  `LyraAvCue {
    readonly cueId: string;
    readonly start: number;
    readonly end?: number;
    readonly text: string;
    readonly speaker?: string;
  }`
  Import: `@aceshooting/lyra-ui/components/media/av-player/av-player.class.js`.
  `LyraAvTrack {
    readonly src: string;
    readonly kind: 'subtitles' | 'captions' | 'descriptions';
    readonly srclang: string;
    readonly label: string;
    readonly default?: boolean;
  }`

- **`components-media-av-player-av-player-contracts`** — Supporting data types and helpers for this component family.
  Import: `@aceshooting/lyra-ui/components/media/av-player/av-player.class.js`.
  `LyraAvCueChangeDetail {
    readonly cueId: string | null;
    readonly index: number;
  }`

- **`components-media-avatar-group-avatar-group-contracts`** — Supporting data types and helpers for this component family.
  Import: `@aceshooting/lyra-ui/components/media/avatar-group/avatar-group.class.js`.
  `LyraAvatarGroupOverflowDetail {
    readonly hiddenCount: number;
    readonly hiddenAvatars: readonly LyraAvatar[];
  }`

- **`components-media-avatar-avatar-contracts`** — Supporting data types and helpers for this component family.
  Import: `@aceshooting/lyra-ui/components/media/avatar/avatar.class.js`.
  `LyraAvatarErrorDetail {
    image: string;
  }`

- **`components-media-drop-zone-drop-zone-contracts`** — Supporting data types and helpers for this component family.
  Import: `@aceshooting/lyra-ui/components/media/drop-zone/drop-zone.class.js`.
  `LyraDropZoneRejectedFile {
    readonly file: File;
    readonly reason: 'type' | 'count' | 'size' | 'directory' | 'read' | 'limit' | 'maxFiles' | 'maxTotalSize';
  }`
  Import: `@aceshooting/lyra-ui/components/media/drop-zone/drop-zone.class.js`.
  `LyraDropZoneFilesDetail {
    readonly files: readonly File[];
    readonly rejected: readonly LyraDropZoneRejectedFile[];
    readonly remainingFiles: number | null;
    readonly remainingTotalSize: number | null;
  }`
  Import: `@aceshooting/lyra-ui/components/media/drop-zone/drop-zone.class.js`.
  `LyraDropZoneFilesEvent extends CustomEvent<LyraDropZoneFilesDetail> {
    readonly target: LyraDropZone;
    readonly currentTarget: LyraDropZone;
  }`
  `lr-files`'s event type on `<lr-drop-zone>`, narrowing `target`/`currentTarget` to `LyraDropZone`
  so a listener reads them without casting — same convention as `lr-file-input`'s own
  `LyraFileInputFilesEvent` below.

- **`components-media-file-icon-file-type-metadata-contracts`** — Supporting data types and helpers for this component family.
  Import: `@aceshooting/lyra-ui/components/lr-file-icon.js`.
  `createFileTypeMetadataRegistry(entries?: readonly LyraFileTypeMetadataEntry[]): LyraFileTypeMetadataRegistry`
  Import: `@aceshooting/lyra-ui/components/lr-file-icon.js`.
  `getFileTypeMetadata(mimeType: string, fileName?: string): LyraResolvedFileTypeMetadata`
  Import: `@aceshooting/lyra-ui/components/lr-file-icon.js`.
  `LyraFileTypeMetadataEntry {
    readonly mimeTypes: string | readonly string[];
    readonly metadata: LyraFileTypeMetadata;
  }`
  Import: `@aceshooting/lyra-ui/components/lr-file-icon.js`.
  `LyraFileTypeMetadata {
    readonly label: string;
    readonly description?: string;
    readonly abbreviation?: string;
    readonly icon: LyraFileTypeIcon;
    readonly category: LyraFileTypeCategory;
    readonly extensions?: readonly string[];
  }`
  Import: `@aceshooting/lyra-ui/components/lr-file-icon.js`.
  `LyraFileTypeMetadataRegistry {
    resolve(mimeType: string, fileName?: string): LyraResolvedFileTypeMetadata;
  }`
  Import: `@aceshooting/lyra-ui/components/lr-file-icon.js`.
  `LyraResolvedFileTypeMetadata extends LyraFileTypeMetadata {
    readonly provenance: 'builtin' | 'consumer';
    // Inherited from LyraFileTypeMetadata.
    readonly label: string;
    readonly description?: string;
    readonly abbreviation?: string;
    readonly icon: LyraFileTypeIcon;
    readonly category: LyraFileTypeCategory;
    readonly extensions?: readonly string[];
  }`

- **`components-media-file-input-file-input-contracts`** — Supporting data types and helpers for this component family.
  Import: `@aceshooting/lyra-ui/components/media/file-input/file-input.class.js`.
  `LyraFileInputFilesDetail {
    readonly files: readonly File[];
    readonly rejected: readonly LyraFileInputRejectedFile[];
    readonly remainingFiles: number | null;
    readonly remainingTotalSize: number | null;
  }`
  Import: `@aceshooting/lyra-ui/components/media/file-input/file-input.class.js`.
  `LyraFileInputObjectValidator {
    observedAttributes?: string[];
    checkValidity: (input: never) => LyraFileInputObjectValidatorResult;
    message?: string | ((input: never) => string);
  }`
  Import: `@aceshooting/lyra-ui/components/media/file-input/file-input.class.js`.
  `LyraFileInputObjectValidatorResult {
    message: string;
    isValid: boolean;
    invalidKeys: Exclude<keyof ValidityState, 'valid'>[];
  }`
  Import: `@aceshooting/lyra-ui/components/media/file-input/file-input.class.js`.
  `LyraFileInputRejectedFile {
    readonly file: File;
    readonly reason: 'type' | 'count' | 'size' | 'directory' | 'read' | 'limit' | 'maxFiles' | 'maxTotalSize';
  }`
  Import: `@aceshooting/lyra-ui/components/media/file-input/file-input.class.js`.
  `LyraFileInputFilesEvent extends CustomEvent<LyraFileInputFilesDetail> {
    readonly target: LyraFileInput;
    readonly currentTarget: LyraFileInput;
  }`
  `lr-files`'s event type, narrowing `target`/`currentTarget` to `LyraFileInput` so a listener reads
  them without casting.

- **`components-media-flag-flag-peer-bulk-standard-contracts`** — Supporting data types and helpers for this component family.
  Import: `@aceshooting/lyra-ui/components/media/flag/flag-peer-bulk-standard.js`.
  `registerLyraFlagStandardBulkPeer(): Promise<LyraFlagUrlResolver | null>`

- **`components-media-flag-flag-peer-bulk-contracts`** — Supporting data types and helpers for this component family.
  Import: `@aceshooting/lyra-ui/components/media/flag/flag-peer-bulk.js`.
  `registerLyraFlagBulkPeer(): Promise<LyraFlagUrlResolver | null>`

- **`components-media-flag-flag-peer-contracts`** — Supporting data types and helpers for this component family.
  Import: `@aceshooting/lyra-ui/components/media/flag/flag-peer.js`.
  `registerLyraFlagPeer(): Promise<LyraFlagUrlResolver | null>`

- **`components-media-flag-flag-contracts`** — Supporting data types and helpers for this component family.
  Import: `@aceshooting/lyra-ui/components/media/flag/flag.class.js`.
  `loadFlagUrl(importFlags: () => Promise<unknown>): Promise<LyraFlagUrlResolver | null>`
  Import: `@aceshooting/lyra-ui/components/media/flag/flag.class.js`.
  `loadBulkFlagUrl(importFlags: () => Promise<unknown>): Promise<LyraFlagUrlResolver | null>`
  Import: `@aceshooting/lyra-ui/components/media/flag/flag.class.js`.
  `setFlagUrlResolver(value: LyraFlagUrlResolver | Promise<LyraFlagUrlResolver | null> | null): void`

- **`components-media-flag-language-map-contracts`** — Supporting data types and helpers for this component family.
  Import: `@aceshooting/lyra-ui/components/media/flag/language-map.js`.
  `alpha3ToAlpha2(code: string): string | undefined`
  Import: `@aceshooting/lyra-ui/components/media/flag/language-map.js`.
  `languageToCountry(language: string): string | undefined`
  Import: `@aceshooting/lyra-ui/components/media/flag/language-map.js`.
  `localeNativeName(tag: string): string`

- **`components-media-image-viewer-image-viewer-contracts`** — Supporting data types and helpers for this component family.
  Import: `@aceshooting/lyra-ui/components/media/image-viewer/image-viewer.class.js`.
  `LyraImageRegionRect {
    x: number;
    y: number;
    width: number;
    height: number;
  }`

- **`components-media-lightbox-lightbox-contracts`** — Supporting data types and helpers for this component family.
  Import: `@aceshooting/lyra-ui/components/media/lightbox/lightbox.class.js`.
  `LyraLightboxHideDetail {
    source: Element;
  }`
  Import: `@aceshooting/lyra-ui/components/media/lightbox/lightbox.class.js`.
  `LyraLightboxImage {
    readonly src: string;
    readonly alt?: string;
    readonly caption?: string;
  }`
  Import: `@aceshooting/lyra-ui/components/media/lightbox/lightbox.class.js`.
  `LyraLightboxSource {
    readonly revision: LyraSourceRevision;
    readonly images: LyraIndexedView<LyraSourceRecord<LyraLightboxImage>>;
  }`

- **`components-media-map-map-loader-contracts`** — Supporting data types and helpers for this component family.
  Import: `@aceshooting/lyra-ui/components/media/map/map-loader.js`.
  `loadMaplibre(): Promise<MaplibreModule | null>` — explicit canonical-engine loader.
  Import: `@aceshooting/lyra-ui/components/media/map/map-loader.js`.
  `loadModularMap(): Promise<ModularMapModule | null>` — default modular-engine loader.
  Import: `@aceshooting/lyra-ui/components/media/map/map-loader.js`.
  `LyraMapFeatureRequirements {
    readonly sources?: Readonly<Record<string, unknown>>;
    readonly layers?: readonly unknown[];
    readonly projection?: unknown;
    readonly terrain?: unknown;
  }`
  Import: `@aceshooting/lyra-ui/components/media/map/map-loader.js`.
  `ModularMapModule {
    Map: new (options: Record<string, unknown>) => MapLibreMapCapability & { prepareFeatures(requirements: LyraMapFeatureRequirements, options?: { signal?: AbortSignal }): Promise<void>; };
    Map: new (options: Record<string, unknown>) => MapLibreMapCapability;
    Marker: new (options?: { color?: string }) => MapLibreMarkerCapability;
    Popup: new (options?: { offset?: number }) => MapLibrePopupCapability;
    NavigationControl?: MapLibreControlConstructor;
    ScaleControl?: MapLibreControlConstructor;
    GeolocateControl?: MapLibreControlConstructor;
    AttributionControl?: MapLibreControlConstructor;
  }`
  Import: `@aceshooting/lyra-ui/components/media/map/map-loader.js`.
  `MapLibreSourceDataDiff {
    readonly removeAll?: boolean;
    readonly remove?: readonly (string | number)[];
    readonly add?: readonly Feature[];
    readonly update?: readonly {
      readonly id: string | number;
      readonly newGeometry?: Geometry;
      readonly removeAllProperties?: boolean;
      readonly removeProperties?: readonly string[];
      readonly addOrUpdateProperties?: readonly {
        readonly key: string;
        readonly value: unknown;
      }[];
    }[];
  }`
  Import: `@aceshooting/lyra-ui/components/media/map/map-loader.js`.
  `MapLibreGeoJsonDiff {
    readonly remove?: readonly (string | number)[];
    readonly add?: readonly Feature[];
    readonly update: readonly {
      readonly id: string | number;
      readonly addOrUpdateProperties: readonly {
        readonly key: string;
        readonly value: unknown;
      }[];
      readonly removeProperties: readonly string[];
    }[];
  }`
  Import: `@aceshooting/lyra-ui/components/media/map/map-loader.js`.
  `MapLibreGeoJsonSource {
    setData(data: unknown): void;
    updateData?(diff: MapLibreSourceDataDiff): void;
    getClusterExpansionZoom?(clusterId: number, callback?: (error: unknown, zoom?: number) => void): Promise<number> | void;
  }`
  Import: `@aceshooting/lyra-ui/components/media/map/map-loader.js`.
  `MapLibreMapCapability {
    prepareFeatures?(requirements: LyraMapFeatureRequirements, options?: { signal?: AbortSignal }): Promise<void>;
    getCanvas(): HTMLCanvasElement;
    getCenter(): { lng: number; lat: number };
    getZoom(): number;
    getBearing?(): number;
    getPitch?(): number;
    setCenter(center: [number, number]): unknown;
    setZoom(zoom: number): unknown;
    resize(): unknown;
    setMinZoom?(zoom: number): unknown;
    setMaxZoom?(zoom: number): unknown;
    getMaxZoom?(): number;
    setMaxBounds?(bounds: readonly [readonly [number, number], readonly [number, number]] | null): unknown;
    fitBounds?( bounds: [[number, number], [number, number]], options: Record<string, unknown>, eventData: Record<string, unknown>, ): unknown;
    isMoving?(): boolean;
    isStyleLoaded?(): boolean;
    loaded?(): boolean;
    off?(type: string, listener: () => void): this;
    flyTo?(options: Record<string, unknown>, eventData?: Record<string, unknown>): unknown;
    easeTo?(options: Record<string, unknown>, eventData?: Record<string, unknown>): unknown;
    jumpTo?(options: Record<string, unknown>, eventData?: Record<string, unknown>): unknown;
    setPadding?(padding: { top: number; right: number; bottom: number; left: number }): unknown;
    project?(lngLat: [number, number]): { x: number; y: number };
    unproject?(point: [number, number]): { lng: number; lat: number };
    addControl?(control: unknown, position?: string): unknown;
    removeControl?(control: unknown): unknown;
    getBounds?(): { getWest(): number; getSouth(): number; getEast(): number; getNorth(): number };
    remove(): void;
    on(type: 'error', listener: (event: { error?: unknown }) => void): this;
    on(type: 'render' | 'load' | 'style.load' | 'idle' | 'dataloading' | 'sourcedata' | 'movestart' | 'move' | 'error', listener: () => void): this;
    on(type: 'moveend', listener: (event: Readonly<Record<string, unknown>> | undefined) => void): this;
    on(type: 'move', listener: () => void): this;
    on(type: 'boxzoomend', listener: () => void): this;
    on(type: 'movestart' | 'boxzoomstart', listener: (event: Readonly<Record<string, unknown>> | undefined) => void): this;
    on(type: 'click', listener: (event: { point: unknown; lngLat: { lng: number; lat: number }; }) => void): this;
    once(type: 'style.load', listener: () => void): this;
    setStyle(style: unknown, options?: { diff?: boolean }): this;
    getStyle?(): { readonly layers?: readonly { readonly id: string }[] };
    getProjection?(): unknown;
    getTerrain?(): unknown;
    setProjection?(value: unknown): unknown;
    setTerrain?(value: unknown): unknown;
    moveLayer?(id: string, before?: string): unknown;
    getPaintProperty?(id: string, property: string): unknown;
    getLayoutProperty?(id: string, property: string): unknown;
    setLayoutProperty?(id: string, property: string, value: unknown): unknown;
    setFilter?(id: string, filter: unknown): unknown;
    setLayerZoomRange?(id: string, min: number, max: number): unknown;
    setFeatureState?(target: import('./map-feature-state.js').LyraMapFeatureIdentifier, state: import('./map-feature-state.js').LyraMapFeatureState): unknown;
    removeFeatureState?(target: import('./map-feature-state.js').LyraMapFeatureIdentifier, key: string): unknown;
    triggerRepaint?(): unknown;
    getSource(id: string): MapLibreGeoJsonSource | undefined;
    addSource(id: string, source: unknown): this;
    removeSource(id: string): this;
    getLayer(id: string): unknown;
    addLayer(layer: unknown, before?: string): this;
    removeLayer(id: string): this;
    setPaintProperty(layerId: string, name: string, value: unknown): this;
    hasImage?(id: string): boolean;
    addImage?(id: string, image: ImageData, options: { pixelRatio: number; sdf?: boolean }): unknown;
    setMissingStyleImageResolver?(resolver: ((id: string) => void | Promise<void>) | null): unknown;
    updateImage?(id: string, image: ImageData): unknown;
    removeImage?(id: string): unknown;
    queryRenderedFeatures(point: unknown, options?: { layers?: string[] }): unknown[];
  }`
  Import: `@aceshooting/lyra-ui/components/media/map/map-loader.js`.
  `MapLibreMarkerCapability {
    setLngLat(lngLat: [number, number]): this;
    setPopup(popup?: MapLibrePopupCapability): this;
    getPopup(): MapLibrePopupCapability | undefined;
    addTo(map: MapLibreMapCapability): this;
    remove(): void;
    getElement?(): HTMLElement;
  }`
  Import: `@aceshooting/lyra-ui/components/media/map/map-loader.js`.
  `MaplibreModule {
    Map: new (options: Record<string, unknown>) => MapLibreMapCapability;
    Marker: new (options?: { color?: string }) => MapLibreMarkerCapability;
    Popup: new (options?: { offset?: number }) => MapLibrePopupCapability;
    NavigationControl?: MapLibreControlConstructor;
    ScaleControl?: MapLibreControlConstructor;
    GeolocateControl?: MapLibreControlConstructor;
    AttributionControl?: MapLibreControlConstructor;
  }`
  Import: `@aceshooting/lyra-ui/components/media/map/map-loader.js`.
  `MapLibrePopupCapability {
    setHTML(html: string): this;
    setText(text: string): this;
    on?(type: 'open' | 'close', listener: () => void): this;
    isOpen?(): boolean;
    getElement?(): HTMLElement | undefined;
    options?: { focusAfterOpen?: boolean };
  }`

- **`components-media-map-scene-configuration-contracts`** — Declarative projection and terrain overrides.
  Import: `@aceshooting/lyra-ui/components/lr-map.js`.
  `LyraMapProjection = 'mercator' | 'globe'`
  `LyraMapTerrain {
    readonly source: string;
    readonly exaggeration?: number;
  }`
  The source names an existing raster elevation source. Exaggeration defaults to 1 and must be finite and nonnegative.

- **`components-media-map-map-contracts`** — Supporting data types and helpers for this component family.
  Import: `@aceshooting/lyra-ui/components/media/map/map.class.js`.
  `buildGeoJsonPropertyDiff(previous: unknown, next: unknown): MapLibreGeoJsonDiff | null`
  Import: `@aceshooting/lyra-ui/components/media/map/map.class.js`.
  `LyraMapSourceDataDiff = MapLibreSourceDataDiff`
  Import: `@aceshooting/lyra-ui/components/media/map/map.class.js`.
  `LyraMapEngine = 'modular' | 'maplibre'`
  Import: `@aceshooting/lyra-ui/components/media/map/map.class.js`.
  `LyraMapChoroplethLayer {
    readonly sourceId: string;
    readonly geojson: FeatureCollection;
    readonly field: string;
    readonly stops: readonly (readonly [number, string])[];
    readonly interpolation?: LyraMapChoroplethInterpolation;
    readonly stepBaseColor?: string;
    readonly noData?: LyraMapChoroplethNoData;
    readonly interactive?: boolean;
    readonly priority?: number;
  }`
  Import: `@aceshooting/lyra-ui/components/media/map/map.class.js`.
  `LyraMapChoroplethNoData {
    readonly color?: string;
    readonly strokeColor?: string;
    readonly label?: string;
  }`
  Import: `@aceshooting/lyra-ui/components/media/map/map.class.js`.
  `LyraMapClusterOptions {
    readonly radius?: number;
    readonly maxZoom?: number;
    readonly radiusSteps?: readonly (readonly [number, number])[];
    readonly colorSteps?: readonly (readonly [number, string])[];
    readonly strokeColor?: string;
    readonly countFont?: readonly string[];
    readonly countColor?: string;
    readonly countHaloColor?: string;
    readonly countHaloWidth?: number;
    readonly zoomOnClick?: boolean;
  }`
  Import: `@aceshooting/lyra-ui/components/media/map/map.class.js`.
  `LyraMapGeoJsonDataLayer {
    readonly sourceId: string;
    readonly geojson: Feature | FeatureCollection;
    readonly before?: string;
    readonly minZoom?: number;
    readonly maxZoom?: number;
    readonly tone?: 'accent' | 'success' | 'warning' | 'danger' | 'neutral';
    readonly color?: string;
    readonly strokeColor?: string;
    readonly line?: LyraMapLineOptions;
    readonly point?: LyraMapPointOptions;
    readonly kind?: LyraMapDataLayerKind;
    readonly heatmap?: LyraMapHeatmapOptions;
    readonly cluster?: LyraMapClusterOptions;
    readonly label?: LyraMapLabelOptions;
    readonly interactive?: boolean;
    readonly priority?: number;
  }`
  Import: `@aceshooting/lyra-ui/components/media/map/map.class.js`.
  `LyraMapHeatmapOptions {
    readonly weightField?: string;
    readonly weightRange?: readonly [number, number];
    readonly stops?: readonly (readonly [number, string])[];
    readonly radius?: LyraMapHeatmapZoomValue;
    readonly intensity?: LyraMapHeatmapZoomValue;
    readonly opacity?: number;
  }`
  Import: `@aceshooting/lyra-ui/components/media/map/map.class.js`.
  `LyraMapLineOptions {
    readonly field?: string;
    readonly stops?: readonly (readonly [number, string])[];
    readonly width?: number;
    readonly opacity?: number;
  }`
  Import: `@aceshooting/lyra-ui/components/media/map/map.class.js`.
  `LyraMapPointIcon {
    readonly value: string;
    readonly path: string;
    readonly viewBox?: readonly [number, number, number, number];
    readonly mode?: LyraMapPointIconMode;
    readonly strokeWidth?: number;
    readonly lineCap?: LyraMapPointIconLineCap;
    readonly lineJoin?: LyraMapPointIconLineJoin;
  }`
  Import: `@aceshooting/lyra-ui/components/media/map/map.class.js`.
  `LyraMapPointOptions {
    readonly field?: string;
    readonly colors?: readonly (readonly [string, string])[];
    readonly radius?: number | LyraMapPointRadiusOptions;
    readonly strokeWidth?: number;
    readonly strokeColor?: string;
    readonly iconField?: string;
    readonly icons?: readonly LyraMapPointIcon[];
    readonly iconColor?: string;
    readonly iconSize?: number;
  }`
  Import: `@aceshooting/lyra-ui/components/media/map/map.class.js`.
  `LyraMapPointRadiusOptions {
    readonly field: string;
    readonly stops: readonly (readonly [number, number])[];
    readonly interpolation?: LyraMapPointRadiusInterpolation;
    readonly fallback?: number;
  }`
  `LyraMapLegendGradientTick {
    readonly value: number;
    readonly label?: string;
  }`
  Import: `@aceshooting/lyra-ui/components/media/map/map.class.js`.
  `LyraMapControls {
    readonly globe?: boolean | LyraMapGlobeControlOptions;
    readonly terrain?: false | LyraMapTerrainControlOptions;
    readonly navigation?: boolean | LyraMapNavigationControlOptions;
    readonly scale?: boolean | LyraMapScaleControlOptions;
    readonly geolocate?: boolean | LyraMapGeolocateControlOptions;
    readonly attribution?: boolean | LyraMapAttributionControlOptions;
  }`
  `LyraMapGlobeControlOptions {
    readonly position?: LyraMapControlPosition;
    readonly order?: number;
  }`
  `LyraMapTerrainControlOptions {
    readonly position?: LyraMapControlPosition;
    readonly order?: number;
    readonly source: string;
    readonly exaggeration?: number;
  }`
  `LyraMapProjectionChangeDetail {
    readonly projection: LyraMapProjection;
    readonly source: 'control';
  }`
  `LyraMapTerrainChangeDetail {
    readonly terrain: LyraMapTerrain | null;
    readonly source: 'control';
  }`
  Import: `@aceshooting/lyra-ui/components/media/map/map.class.js`.
  `LyraMapNavigationControlOptions {
    readonly position?: LyraMapControlPosition;
    readonly order?: number;
  }`
  Import: `@aceshooting/lyra-ui/components/media/map/map.class.js`.
  `LyraMapScaleControlOptions {
    readonly position?: LyraMapControlPosition;
    readonly order?: number;
    readonly unit?: LyraMapScaleUnit;
  }`
  Import: `@aceshooting/lyra-ui/components/media/map/map.class.js`.
  `LyraMapPointRadiusInterpolation = 'step' | 'linear'`;
  `LyraMapPointIconMode = 'fill' | 'stroke' | 'fill-stroke'`;
  `LyraMapPointIconLineCap = 'butt' | 'round' | 'square'`;
  `LyraMapPointIconLineJoin = 'miter' | 'round' | 'bevel'`.
  Import: `@aceshooting/lyra-ui/components/media/map/map.class.js`.
  `LyraMapInstance {
    prepareFeatures?(requirements: LyraMapFeatureRequirements, options?: { signal?: AbortSignal }): Promise<void>;
    getCanvas(): HTMLCanvasElement;
    getCenter(): {
      lng: number;
      lat: number;
    };
    getZoom(): number;
    setCenter(center: [number, number]): unknown;
    setZoom(zoom: number): unknown;
    resize(): unknown;
    setMaxBounds?(bounds?: unknown): unknown;
  }`
  Import: `@aceshooting/lyra-ui/components/media/map/map.class.js`.
  `LyraMapLegendEntry {
    readonly color: string;
    readonly label: string;
    readonly pattern: LyraMapLegendPattern;
    readonly icon?: LyraMapPointIcon | Omit<LyraMapPointIcon, 'value'>;
    readonly group?: string;
  }`
  Import: `@aceshooting/lyra-ui/components/media/map/map.class.js`.
  `LyraMapLegendProjection {
    readonly inputCount: number;
    readonly renderedCount: number;
    readonly omittedCount: number;
    readonly truncatedLabelCount: number;
    readonly truncated: boolean;
  }`
  Import: `@aceshooting/lyra-ui/components/media/map/map.class.js`.
  `LyraMapMarker {
    readonly id?: string;
    readonly lngLat: readonly [number, number];
    readonly color?: string;
    readonly label?: string;
    readonly unsafeHtml?: string;
  }`
  Import: `@aceshooting/lyra-ui/components/media/map/map.class.js`.
  `LyraMapMarkerActivationDetail {
    readonly id: string | undefined;
    readonly lngLat: readonly [number, number];
    readonly marker: LyraMapMarker;
    readonly source: LyraMapMarkerActivationSource;
  }`
  Import: `@aceshooting/lyra-ui/components/media/map/map.class.js`.
  `LyraMapLegendToggleDetail {
    readonly value: string;
    readonly visible: boolean;
    readonly hiddenCategories: readonly string[];
  }`
  Import: `@aceshooting/lyra-ui/components/media/map/map.class.js`.
  `LyraMapLegendPanelToggleDetail {
    readonly open: boolean;
  }`
  Import: `@aceshooting/lyra-ui/components/media/map/map.class.js`.
  `LyraMapPadding {
    readonly top?: number;
    readonly right?: number;
    readonly bottom?: number;
    readonly left?: number;
  }`
  Import: `@aceshooting/lyra-ui/components/media/map/map.class.js`.
  `LyraMapVisibleBoundsOptions {
    readonly padded?: boolean;
  }`
  Import: `@aceshooting/lyra-ui/components/media/map/map.class.js`.
  `LyraMapFitBoundsOptions {
    readonly padding?: number | LyraMapPadding;
    readonly maxZoom?: number;
    readonly animate?: boolean;
  }`
  Import: `@aceshooting/lyra-ui/components/media/map/map.class.js`.
  `LyraMapViewChangeDetail {
    readonly center: readonly [number, number];
    readonly zoom: number;
    readonly source: LyraMapViewChangeSource;
    readonly bounds?: LyraMapBounds;
  }`
  `LyraMapViewChangeSource = 'user' | 'fit' | 'command'`.
  Import: `@aceshooting/lyra-ui/components/media/map/map.class.js`.
  `LyraMapMoveDetail {
    readonly center: readonly [number, number];
    readonly zoom: number;
    readonly bounds?: LyraMapBounds;
  }`
  `LyraMapPoint = readonly [number, number]`.
  Import: `@aceshooting/lyra-ui/components/media/map/map.class.js`.
  `LyraMapCameraOptions {
    readonly center?: readonly [number, number];
    readonly zoom?: number;
    readonly bearing?: number;
    readonly pitch?: number;
    readonly duration?: number;
  }`
  Import: `@aceshooting/lyra-ui/components/media/map/map.class.js`.
  `LyraMapStyleSpecification {
    readonly version: 8;
    readonly sources: Readonly<Record<string, unknown>>;
    readonly layers: readonly unknown[];
    readonly name?: string;
    readonly sprite?: string | readonly Readonly<{
      id: string;
      url: string;
    }>[];
    readonly glyphs?: string;
    readonly projection?: unknown;
    readonly terrain?: unknown;
  }`

- **`components-media-media-card-media-card-contracts`** — Supporting data types and helpers for this component family.
  Import: `@aceshooting/lyra-ui/components/media/media-card/media-card.class.js`.
  `LyraMediaCardOpenDetail {
    src: string;
    filename: string;
  }`

- **`components-media-sequence-playback-sequence-playback-contracts`** — Supporting data types and helpers for this component family.
  Import: `@aceshooting/lyra-ui/components/media/sequence-playback/sequence-playback.class.js`.
  `LyraSequencePlaybackStepDetail {
    currentIndex: number;
  }`

- **`components-media-video-playlist-video-playlist-contracts`** — Supporting data types and helpers for this component family.
  Import: `@aceshooting/lyra-ui/components/media/video-playlist/video-playlist.class.js`.
  `LyraVideoPlaylistChangeDetail {
    readonly previousIndex: number;
    readonly currentIndex: number;
    readonly video: LyraVideoPlaylistVideo | null;
  }`
  Import: `@aceshooting/lyra-ui/components/media/video-playlist/video-playlist.class.js`.
  `LyraVideoPlaylistItem {
    readonly title: string;
    readonly poster?: string;
    readonly duration?: number;
    readonly unavailable?: boolean;
  }`
  Import: `@aceshooting/lyra-ui/components/media/video-playlist/video-playlist.class.js`.
  `LyraVideoPlaylistSource {
    readonly src: string;
    readonly type: string;
    readonly media: string;
  }`
  Import: `@aceshooting/lyra-ui/components/media/video-playlist/video-playlist.class.js`.
  `LyraVideoPlaylistTrack {
    readonly src: string;
    readonly kind: string;
    readonly srclang: string;
    readonly label: string;
    readonly default: boolean;
  }`
  Import: `@aceshooting/lyra-ui/components/media/video-playlist/video-playlist.class.js`.
  `LyraVideoPlaylistVideo {
    readonly title: string;
    readonly poster: string;
    readonly sources: readonly LyraVideoPlaylistSource[];
    readonly tracks: readonly LyraVideoPlaylistTrack[];
  }`

- **`components-media-video-video-contracts`** — Supporting data types and helpers for this component family.
  Import: `@aceshooting/lyra-ui/components/media/video/video.class.js`.
  `VideoState {
    playing: boolean;
    currentTime: number;
    duration: number;
    volume: number;
    muted: boolean;
    playbackRate: number;
  }`

Numeric language regions (for example `es-419` and `en-001`) do not derive a single country flag.
Use the locale's visible label, or explicitly choose a `country` when the application needs a
particular country. Representative language mappings also include `lb` (Luxembourgish) and `fil`
(Filipino); these mappings do not imply that a Lyra translation catalog is installed.

- **`components-media-map-owned-contracts`** — Map resource, interaction, drawing and lifecycle data contracts.
  Import these types from `@aceshooting/lyra-ui/components/media/map/map.class.js`.
  External layer signatures include their inherited interaction and source options. Drawing
  coordinates use longitude/latitude pairs; length is in metres and area is in square metres.
  `LyraMapAnchorSafeArea {
    readonly blockStart?: number;
    readonly inlineEnd?: number;
    readonly blockEnd?: number;
    readonly inlineStart?: number;
  }`
  `LyraMapCanvasDataLayer {
    readonly kind: 'canvas';
    readonly canvas: HTMLCanvasElement;
    readonly coordinates: LyraMapSourceCoordinates;
    readonly animate?: boolean;
    readonly redrawRevision?: number;
    readonly sourceId: string;
    readonly before?: string;
    readonly minZoom?: number;
    readonly maxZoom?: number;
    readonly opacity?: number;
    readonly category?: string;
    readonly interactive?: boolean;
    readonly priority?: number;
  }`
  `LyraMapExternalDataLayerOptions {
    readonly sourceId: string;
    readonly before?: string;
    readonly minZoom?: number;
    readonly maxZoom?: number;
    readonly opacity?: number;
    readonly category?: string;
    readonly interactive?: boolean;
    readonly priority?: number;
  }`
  `LyraMapImageDataLayer {
    readonly kind: 'image';
    readonly url: string;
    readonly coordinates: LyraMapSourceCoordinates;
    readonly sourceId: string;
    readonly before?: string;
    readonly minZoom?: number;
    readonly maxZoom?: number;
    readonly opacity?: number;
    readonly category?: string;
    readonly interactive?: boolean;
    readonly priority?: number;
  }`
  `LyraMapLabelOptions {
    readonly field?: string;
    readonly expression?: readonly LyraMapLabelValue[];
    readonly placement?: 'point' | 'line';
    readonly anchor?: LyraMapLabelAnchor;
    readonly offset?: readonly [number, number];
    readonly size?: number;
    readonly color?: string;
    readonly haloColor?: string;
    readonly haloWidth?: number;
    readonly minZoom?: number;
    readonly font?: readonly string[];
    readonly allowOverlap?: boolean;
    readonly ignorePlacement?: boolean;
  }`
  `LyraMapRasterDataLayer {
    readonly kind: 'raster';
    readonly source: LyraMapTileSource & { readonly tileSize?: number };
    readonly sourceId: string;
    readonly before?: string;
    readonly minZoom?: number;
    readonly maxZoom?: number;
    readonly opacity?: number;
    readonly category?: string;
    readonly interactive?: boolean;
    readonly priority?: number;
  }`
  `LyraMapTileSource {
    readonly url?: string;
    readonly tiles?: readonly string[];
    readonly minZoom?: number;
    readonly maxZoom?: number;
    readonly attribution?: string;
    readonly scheme?: 'xyz' | 'tms';
  }`
  `LyraMapVectorDataLayer {
    readonly kind: 'vector';
    readonly source: LyraMapTileSource;
    readonly sourceLayer: string;
    readonly render: 'line' | 'circle' | 'fill' | 'symbol';
    readonly color?: string;
    readonly strokeColor?: string;
    readonly width?: number;
    readonly radius?: number;
    readonly categoryField?: string;
    readonly paint?: LyraMapVectorPaint;
    readonly layout?: LyraMapVectorLayout;
    readonly filter?: LyraMapVectorStyleExpression;
    readonly label?: LyraMapLabelOptions;
    readonly sourceId: string;
    readonly before?: string;
    readonly minZoom?: number;
    readonly maxZoom?: number;
    readonly opacity?: number;
    readonly category?: string;
    readonly interactive?: boolean;
    readonly priority?: number;
  }`
  `LyraMapVectorPaint {
    readonly 'line-color'?: LyraMapVectorColorValue;
    readonly 'line-width'?: LyraMapVectorNumericValue;
    readonly 'circle-color'?: LyraMapVectorColorValue;
    readonly 'circle-radius'?: LyraMapVectorNumericValue;
    readonly 'circle-stroke-color'?: LyraMapVectorColorValue;
    readonly 'circle-stroke-width'?: LyraMapVectorNumericValue;
    readonly 'fill-color'?: LyraMapVectorColorValue;
    readonly 'fill-outline-color'?: LyraMapVectorColorValue;
    readonly 'icon-color'?: LyraMapVectorColorValue;
    readonly 'icon-halo-color'?: LyraMapVectorColorValue;
    readonly 'icon-halo-width'?: LyraMapVectorNumericValue;
    readonly 'text-color'?: LyraMapVectorColorValue;
    readonly 'text-halo-color'?: LyraMapVectorColorValue;
    readonly 'text-halo-width'?: LyraMapVectorNumericValue;
  }`
  `LyraMapVectorLayout {
    readonly 'line-cap'?: 'butt' | 'round' | 'square';
    readonly 'line-join'?: 'bevel' | 'round' | 'miter';
    readonly 'icon-image'?: string | LyraMapVectorStyleExpression;
    readonly 'icon-size'?: LyraMapVectorNumericValue;
    readonly 'icon-allow-overlap'?: boolean;
    readonly 'icon-ignore-placement'?: boolean;
    readonly 'text-size'?: LyraMapVectorNumericValue;
    readonly 'text-allow-overlap'?: boolean;
    readonly 'text-ignore-placement'?: boolean;
    readonly 'symbol-placement'?: 'point' | 'line';
  }`
  `LyraMapDrawingMetrics {
    readonly length: number;
    readonly area: number;
    readonly centroid: readonly [number, number] | null;
  }`
  `LyraMapDrawingSnapshot {
    readonly mode: 'line' | 'polygon';
    readonly phase: 'drawing' | 'completed' | 'cancelled';
    readonly vertices: readonly (readonly [number, number])[];
    readonly metrics?: LyraMapDrawingMetrics;
    readonly geometry?: Readonly<{ type: 'LineString'; coordinates: readonly (readonly [number, number])[]; }> | Readonly<{ type: 'Polygon'; coordinates: readonly (readonly (readonly [number, number])[])[]; }>;
  }`
  `LyraMapFeatureStateTarget {
    readonly origin?: LyraMapFeatureOrigin;
    readonly source: string;
    readonly sourceLayer?: string;
    readonly id: string | number;
  }`
  `LyraMapResolvedFeatureStateTarget {
    readonly origin: LyraMapFeatureOrigin;
    readonly source: string;
    readonly sourceLayer?: string;
    readonly id: string | number;
  }`
  `LyraMapFeatureIdentifier {
    readonly source: string;
    readonly sourceLayer?: string;
    readonly id: string | number;
  }`
  `LyraMapImageExportOptions {
    readonly type?: LyraMapImageExportType;
    readonly attribution?: boolean;
  }`
  `LyraMapImage {
    readonly id: string;
    readonly source: { readonly kind: 'svg'; readonly markup: string } | { readonly kind: 'url'; readonly url: string };
    readonly width: number;
    readonly height: number;
    readonly pixelRatio: number;
    readonly sdf?: boolean;
  }`
  `LyraMapStyleOverride {
    readonly layerId?: string;
    readonly before?: string | null;
    readonly paint?: Readonly<Record<string, LyraMapStyleValue>>;
    readonly layout?: Readonly<Record<string, LyraMapStyleValue>>;
    readonly source?: string;
    readonly sourceLayer?: string;
    readonly layerType?: string;
  }`
  `LyraMapBasemapInteraction {
    readonly layerId?: string;
    readonly interactive?: boolean;
    readonly priority?: number;
    readonly source?: string;
    readonly sourceLayer?: string;
    readonly layerType?: string;
  }`
  An entry gives either `layerId` or at least one selector field, never both.
  `LyraMapStyleLayerSelector {
    readonly source?: string;
    readonly sourceLayer?: string;
    readonly layerType?: string;
  }`
  `LyraMapStyleLayer {
    readonly id: string;
    readonly type: string;
    readonly source?: string;
    readonly sourceLayer?: string;
  }`
  `LyraMapStyleSource {
    readonly id: string;
    readonly type: string;
  }`
  `LyraMapInteractionOptions {
    readonly interactive?: boolean;
    readonly priority?: number;
  }`
  `LyraMapAnchorCloseDetail {
    readonly reason: LyraMapAnchorCloseReason;
  }`
  `LyraMapDrawingCancelDetail {
    readonly reason: LyraMapDrawingCancelReason;
    readonly mode: 'line' | 'polygon';
    readonly phase: 'drawing' | 'completed' | 'cancelled';
    readonly vertices: readonly (readonly [number, number])[];
    readonly metrics?: LyraMapDrawingMetrics;
    readonly geometry?: Readonly<{ type: 'LineString'; coordinates: readonly (readonly [number, number])[]; }> | Readonly<{ type: 'Polygon'; coordinates: readonly (readonly (readonly [number, number])[])[]; }>;
  }`
  `LyraMapDrawingVertexEndDetail {
    readonly index: number;
    readonly mode: 'line' | 'polygon';
    readonly phase: 'drawing' | 'completed' | 'cancelled';
    readonly vertices: readonly (readonly [number, number])[];
    readonly metrics?: LyraMapDrawingMetrics;
    readonly geometry?: Readonly<{ type: 'LineString'; coordinates: readonly (readonly [number, number])[]; }> | Readonly<{ type: 'Polygon'; coordinates: readonly (readonly (readonly [number, number])[])[]; }>;
  }`
  `LyraMapFeatureHit {
    readonly layerId: string;
    readonly origin: LyraMapFeatureOrigin;
    readonly source: string;
    readonly sourceLayer?: string;
    readonly id?: string | number;
    readonly properties: { readonly [key: string]: LyraMapFeatureValue };
    readonly target?: LyraMapResolvedFeatureStateTarget;
  }`
  `LyraMapGeolocateErrorDetail {
    readonly code: LyraMapGeolocationErrorCode;
  }`
  `LyraMapGeolocateDetail {
    readonly lngLat: readonly [number, number];
    readonly accuracy: number;
  }`
  `LyraMapPointerDetail {
    readonly lngLat: readonly [number, number];
    readonly point: LyraMapPoint;
  }`
  `LyraMapGeolocateControlOptions {
    readonly position?: LyraMapControlPosition;
    readonly order?: number;
    readonly trackUserLocation?: boolean;
    readonly showUserLocation?: boolean;
    readonly showAccuracyCircle?: boolean;
    readonly zoomToUserAccuracy?: boolean;
    readonly positionOptions?: { readonly enableHighAccuracy?: boolean; readonly timeout?: number; readonly maximumAge?: number };
    readonly fitBoundsOptions?: { readonly maxZoom?: number };
  }`
  `LyraMapAttributionLink { readonly label: string; readonly url: string }`
  `LyraMapAttributionControlOptions {
    readonly position?: LyraMapControlPosition;
    readonly order?: number;
    readonly compact?: boolean;
    readonly customAttribution?: string | LyraMapAttributionLink | readonly (string | LyraMapAttributionLink)[];
    readonly initialExpanded?: boolean;
  }`
  `LyraMapAttributionToggleDetail {
    readonly expanded: boolean;
  }`
  `LyraMapGeolocateOutOfBoundsDetail {
    readonly code: 'out-of-bounds';
  }`
  `LyraMapImageExportErrorDetail {
    readonly code: LyraMapImageExportErrorCode;
  }`
  `LyraMapInteractionDetail {
    readonly lngLat: readonly [number, number];
    readonly hit?: LyraMapFeatureHit;
    readonly feature?: LyraMapFeature;
  }`
  `LyraMapOverlays {
    readonly sources?: readonly LyraMapOverlaySource[];
    readonly layers?: readonly LyraMapOverlayLayer[];
  }`
  `LyraMapOverlaySource {
    readonly id: string;
    readonly source: Readonly<Record<string, unknown>>;
  }`
  `LyraMapOverlayLayer {
    readonly layer: Readonly<Record<string, unknown>> & { readonly id: string; readonly type: string };
    readonly before?: string;
    readonly interactive?: boolean;
    readonly priority?: number;
  }`
  `LyraMapPickDetail {
    readonly trigger: 'pointer' | 'keyboard';
    readonly lngLat: readonly [number, number];
    readonly hit?: LyraMapFeatureHit;
    readonly feature?: LyraMapFeature;
  }`
  `LyraMapReadinessDetail {
    readonly generation: number;
  }`

- **`components-media-image-viewer-panorama-contracts`** — Shared panorama camera, hotspot and selection data for image and video viewers.
  Import types from `@aceshooting/lyra-ui/components/lr-image-viewer.js` or
  `@aceshooting/lyra-ui/components/lr-video.js`.
  `LyraPanoramaCamera {
    readonly yaw: number;
    readonly pitch: number;
    readonly fieldOfView: number;
  }`
  Angles are radians; fieldOfView is degrees. Camera writes are normalized by the viewer.
  `LyraPanoramaHotspot {
    readonly id: string;
    readonly yaw: number;
    readonly pitch: number;
    readonly label?: string;
  }`
  `LyraPanoramaHotspotSelectDetail {
    readonly hotspot: LyraPanoramaHotspot;
    readonly id: string;
    readonly index: number;
  }`
  Selection identifies the admitted hotspot and its row in the viewer's current hotspot data.


### GeoJSON row order, zoom bounds and label placement

A GeoJSON `dataLayers` row accepts `before`, `minZoom` and `maxZoom`, matching external
source rows. `before` names another row's public `sourceId` or a native layer; a concrete member
of a generated row anchors its whole group. Fill, outline, point/icon, cluster/count, heatmap and
label members keep their internal order. Missing anchors append with a development diagnostic;
self-anchors and cycles reject the proposed assignment before native mutation. While an ordering
anchor is active, the complete mixed proposal must fit the existing planner limits: 128 logical
groups and 1,024 characters per group identifier. An authored `before` target is limited to
128 characters. These ordering limits do not apply to otherwise-default rows after all anchors
have been removed and their default order restored.

Finite zoom bounds are clamped to `[0,24]`. Omitted bounds use `0` and `24`; the minimum is
inclusive and maximum exclusive. Equal bounds describe an empty interval. A reversed authored
range or invalid new field rejects the whole proposal while the previous accepted map remains
installed. Changing only order or zoom bounds retains source identity and feature state. The
row range applies to every generated member, including count labels and point icons. A label's
effective minimum is the greater of its own `minZoom` and the row minimum. Native clustering's
`cluster.maxZoom` is a source clustering threshold and does not replace the row's visibility range.

`label.anchor` accepts `center`, `left`, `right`, `top`, `bottom`, `top-left`, `top-right`,
`bottom-left` or `bottom-right`. `label.offset` is a frozen copy of two finite numbers in
`[-16,16]`, measured in ems of the effective native text size. Omission preserves the native
center anchor and `[0,0]` offset. These are physical native coordinates: positive x points right
and positive y down in label coordinates. RTL changes text shaping, not these coordinates.
Bearing, pitch and line placement follow native symbol rotation/alignment; down does not always
mean geographic south or viewport down. Collision rules can still suppress a label.

```ts
import '@aceshooting/lyra-ui/components/lr-map.js';
import type { LyraMapGeoJsonDataLayer } from '@aceshooting/lyra-ui/components/media/map/map.class.js';

// Use a glyph-capable mapStyle and localized name properties in the GeoJSON.
const places: LyraMapGeoJsonDataLayer = {
  sourceId: 'places', geojson: placeFeatures, before: 'roads', minZoom: 3, maxZoom: 18,
  label: { field: 'name', anchor: 'top', offset: [0, 1.25] },
};
map.dataLayers = [places, roads];
```

A top anchor with positive y offset places the label below its feature anchor. Choose enough
offset for the authored icon and text sizes; there is no implicit icon measurement. The same
label options apply to vector and GeoJSON point/line label routes. Removing an authored anchor
or offset restores native defaults without replacing a compatible label layer.

### Typed vector row styling

A `kind: 'vector'` row accepts optional `paint`, `layout` and `filter` objects. Their finite
vocabulary depends on `render`: line color/width and cap/join; circle color/radius/stroke;
fill color/outline; or symbol icon/text color, halo, size, overlap and placement. Row `opacity`
and category muting own alpha. Explicit primary paint/layout entries override defaults;
secondary labels on line/circle/fill rows continue to use `label` options. A row filter applies
to both its primary layer and secondary label. Omission restores defaults without replacing
an unchanged source. Unsupported properties/operators and explicitly supplied `undefined`
reject the proposed assignment before native mutation.

Expressions admit bounded `case`, `match`, `step` and linear `interpolate`, with finite numeric
or string feature reads and zoom inputs. Filters admit bounded boolean combinations, property
presence and scalar comparisons. Arithmetic, arbitrary native operators and feature-state
expressions are not accepted here; use `overlays` for the broader native descriptor API.
Only color outputs resolve CSS values against the map element. Property names, match labels,
filter strings and image IDs remain data, even when they resemble CSS tokens.

An icon-only symbol needs `layout['icon-image']` and does not require glyphs. Text symbols
require the existing glyph-capable style and `label`. Icon IDs are finite literal leaves or
bounded conditional outputs, supplied by `images` or the existing missing-image provider.
Icon color and halo affect SDF images; ordinary raster icons retain their original colors.
Neither symbols nor labels render HTML.

The compiled per-row ceilings (65,536 values, depth 20 and 8 MiB of text) are upper bounds,
subject to the existing complete native proposal admission limits: 50,000 values and 1 MiB of
text shared by owned overlays and external rows. Compilation, resolved colors, concrete order
anchors and prepared local-image URLs are checked together before generated or native writes.

```ts
import type { LyraMapVectorDataLayer } from '@aceshooting/lyra-ui/components/media/map/map.class.js';

const roads: LyraMapVectorDataLayer = {
  kind: 'vector', sourceId: 'roads', source: { url: tileJsonUrl }, sourceLayer: 'roads', render: 'line',
  paint: {
    'line-color': ['match', ['get', 'class'], 'primary', 'var(--lr-color-brand-600)', '#667788'],
    'line-width': ['interpolate', ['linear'], ['zoom'], 4, 1, 14, 8],
  },
  layout: { 'line-cap': 'round', 'line-join': 'round' },
  filter: ['has', 'class'],
};
map.dataLayers = [roads];
```
