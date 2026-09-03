## Breaking changes in 10.0.0

`<lr-media-card>`'s `alt` becomes optional (`alt?: string`, was `alt: string = ''`), so a decorative
image is expressible at last. The image render used to fall through `alt`, then `filename`, then a
localized generic description with `||`, which made an explicit `alt=""` indistinguishable from an
absent one and published it as `alt="Image attachment"` — there was no way to mark the image
decorative, which is the one thing
`alt=""` means in HTML. It now reads `??`, matching `<lr-image-viewer>` and `<lr-document-preview>`,
which already documented that contract. Omitting `alt` is unchanged; only the value read back from
an unset property differs (`''` becomes `undefined`), so a consumer comparing `el.alt === ''` should
read `el.alt ?? ''`. The nested `<video controls>` label deliberately does **not** follow: an empty
`alt` there would leave an interactive player with no accessible name, and "decorative" is not a
state a media control can be in, so the video path still falls through to `filename` and the generic
description.

`<lr-attachment-chip>`'s `lr-preview-request` is no longer cancelable. It was advertised as a veto
point, but the chip never read `defaultPrevented` and owns no preview default action to cancel — it
never registers or owns a viewer or overlay, by its own documented contract — so `preventDefault()`
was a no-op. The flag is removed rather than left as a promise the component cannot keep: a host that
was calling `preventDefault()` can drop the call, and one that believed the call was suppressing
something was never being served. `<lr-voice-picker>`'s same-named event belongs to a different
component, owns a real internal default action, and stays cancelable.

Also corrected in 10.0.0 — not breaking, but visible. `<lr-flag>` no longer paints a full-size
undecoded image beside its own skeleton while loading; `<lr-video>` no longer keeps a second,
duplicate controls play button both painted and focusable behind a poster, and it now keeps captions
for a `<track>` with no `kind` attribute, whose HTML missing-value default is `subtitles`; and
`<lr-avatar>` and `<lr-image-comparer>` honor a consumer's `hidden` slotted child. In each case the
component's own author-origin declaration was beating the UA stylesheet's `[hidden] { display: none }`
regardless of specificity.

## Breaking changes in 9.0.0

`<lr-media-card>`'s `accessibleLabel` property now defaults to `null` instead of `''`
(`string | null`, matching `<lr-pan-zoom>`/`<lr-zoomable-frame>`). Behavior is unchanged: an explicit
empty string and the unset default both still fall through to the generated purpose-specific action
name — only the value read back from an unset property differs. A consumer comparing against `''`
should switch to `== null` / `?? ''`.

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

The v9 vocabulary replaces `round` with `shape="circle"` and `variant` with `fidelity`; exported
authoring types are `LyraFlagShape`, `LyraFlagFidelity`, and `LyraFlagUrlResolver`.

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
`--lr-flag-object-fit` (default `cover`); also consumes `--lr-color-border` for the inset ring.

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
inherited object members such as `constructor` resolve to `undefined`. Also exported:
`localeNativeName(tag: string): string`.

`localeNativeName()` returns a BCP-47 tag's **endonym** — the locale's name written in that locale
itself (`'fr'` → `français`, `'pt-BR'` → `português (Brasil)`). That is what a language switcher
should list, so a reader who understands none of the current UI language can still find their own.
It derives from `Intl.DisplayNames`, so no name table ships with the library and results follow the
browser's own ICU data; the underlying instance comes from a shared memoized cache, since a picker
does one lookup per offered locale on every render pass. A tag with no display name resolves to the
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

**Properties:**

- `itemCount: number = 0` (attribute `item-count`)
- `currentIndex: number = 0` (attribute `current-index`)
- `intervalMs: number = 900` (attribute `interval-ms`)
- `playing: boolean = false` (reflected)
- `loop: boolean = true`
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
`LyraSequencePlaybackStepDetail`. The former generic `LyraPlayback`, `<lr-playback>`, `length`,
`index`, and `lr-step` names are removed in v9 rather than retained as ambiguous aliases.

**Slots:** none.

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
- Initial `playing` and `item-count` attributes are resolved together on the first update, so
  playback starts consistently regardless of their source order; an invalid final `itemCount <= 1`
  clears the reflected `playing` state.
- No _visible_ "N of M" position label beside the range input; the native one-based range still
  exposes the current ordinal and total bounds, with localized `aria-valuetext` as a supplemental
  enhancement where the platform honors it.
- Calling `play()`/`pause()` programmatically (not via the button) gives no `aria-live`
  announcement of the Play/Pause state change.

---

## `lr-map`

A `maplibre-gl` wrapper with a declarative legend, a single choropleth GeoJSON fill layer, markers,
and additive `dataLayers` — plain GeoJSON, natively clustered points, or a heatmap density surface —
plus a peer-neutral `map` getter for common imperative operations. Its runtime value is the
underlying MapLibre map. The component observes its own map-container allocation and calls the
peer's `resize()` when that allocation changes.

**Properties:**

- `center: [number, number] = [0, 0]`
- `zoom: number = 2`
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
  geometry.
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
- `legend: readonly LyraMapLegendEntry[] = []` (attribute: false) — immutable defensive snapshots
  of `LyraMapLegendEntry { readonly color: string; readonly label: string; readonly pattern:
LyraMapLegendPattern }`, where `LyraMapLegendPattern` is `'solid' | 'diagonal' | 'dots' |
'crosshatch'`. Pattern is required so color is never the sole category cue. At most 100 valid
  rows, 256 characters per label, and 8,192 aggregate label characters are retained; colors are
  bounded before validation. The overlay scrolls within the map allocation.
- readonly `legendProjection: LyraMapLegendProjection` — frozen `{ inputCount, renderedCount,
omittedCount, truncatedLabelCount, truncated }` result for the latest assignment. A truncated
  projection renders a localized visible `1–N of M items` summary rather than silently claiming
  the bounded rows are complete.
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
  `'step'` (new in 11.0.0) emits maplibre's `['step', …]` instead of `['interpolate', …]`, giving
  **discrete bands rather than a continuous ramp**. Use it whenever the legend advertises a fixed
  set of ranges with one swatch each: a ramp would put colours on the map that appear nowhere in the
  legend, and would render two regions in the same advertised band as visibly different colours
  (`legendGradient` covers the opposite case, a gradient legend). `stepBaseColor` is the colour for
  values below the first threshold, which `['step', …]` requires; it defaults to the first stop's own
  colour, so a legend whose first band starts at the data minimum needs no extra configuration.
  Stop colors and `stepBaseColor` accept CSS custom-property references; Lyra resolves them from
  the live host cascade before passing the expression to MapLibre's WebGL renderer.
- `markers: LyraMapMarker[] = []` (attribute: false) — `LyraMapMarker { id?: string; lngLat:
[number, number]; color?: string; label?: string; unsafeHtml?: string }`; an explicit `id` is
  trimmed and must be nonempty, and the first successfully admitted marker for an explicit ID wins.
  A malformed earlier row does not reserve that ID. Markers are reconciled
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
  marker whose `color` changes for a persisting `id`
  can't be recolored in place (no `Marker.setColor()`) and is torn down/reconstructed instead — see
  gotchas. Entries with non-finite coordinates, latitude outside `[-90, 90]`, or a runtime
  non-string `label` are skipped without aborting valid siblings. `color` is used only when the
  browser accepts it as CSS `color`;
  declaration breaks and `url()` paint servers fall back to MapLibre's default marker color.
  Every retained marker is a named `role="button"` tab stop, including one without a popup. Click,
  Enter, and Space emit `lr-map-marker-activate`; Space suppresses its page-scroll default while
  preserving MapLibre's popup toggle. A popup-bearing marker additionally exposes
  `aria-haspopup="dialog"`, `aria-controls`, and explicit `aria-expanded`.
- `dataLayers: LyraMapGeoJsonDataLayer[] = []` (attribute: false) —
  `LyraMapGeoJsonDataLayer { sourceId: string; geojson: GeoJSON.Feature |
GeoJSON.FeatureCollection; tone?: 'accent' | 'success' | 'warning' |
'danger' | 'neutral'; color?: string; strokeColor?: string; kind?: LyraMapDataLayerKind;
heatmap?: LyraMapHeatmapOptions; cluster?: LyraMapClusterOptions }`. `sourceId` is trimmed and must be nonempty; the first layer for a
  `sourceId` that is successfully admitted wins; blank, malformed, and later duplicate records are
  ignored without reserving an identity for a valid later sibling. Each retained entry adds one
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

  `cluster` and `kind` (both new in 12.0.0) opt one entry out of that three-layer geometry split.
  **Both are strictly additive: an entry that sets neither renders exactly what it rendered before,
  down to the layer ids and the point layer's filter.**

  `cluster?: LyraMapClusterOptions { radius?: number; maxZoom?: number; radiusSteps?: [number,
number][]; colorSteps?: [number, string][]; countFont?: string[] }` turns the entry's source into a
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
  clustered entry, because MapLibre's clustering keeps point features only. The count
  label needs glyphs: a style that declares none gets the graduated circles without the numbers
  (adding a text layer against a glyph-less style paints nothing and only emits peer errors), and
  `countFont` names the font stack when your style's glyph source lacks MapLibre's spec default.
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
- `maxBounds: LyraMapBounds | null = null` (attribute: false) — box the map may not pan outside,
  `[[west, south], [east, north]]`. Prefer it over calling `map.setMaxBounds()` through the `.map`
  escape hatch: constraining the camera can wedge maplibre-gl at a sub-1 fractional zoom in a wide
  container, leaving `getZoom()` returning `null` permanently, every frame throwing from inside the
  peer's own matrix math, and the canvas never painting again — a blank map, with nothing thrown at
  the call site to attribute it to. This property applies the same call, then reads the camera back
  and reverts (restoring zoom and centre) if it did not survive, so the worst case is an
  unconstrained map plus a dev-mode warning. The defensive camera snapshots are inside the same
  failure boundary, so a peer whose damaged transform already throws from `getZoom()` or
  `getCenter()` is also reduced to an unconstrained map instead of leaking through Lit's update.
  A malformed box is rejected rather than clamped

**Choropleth and `dataLayers` updates are diffed before they reach the peer.** `setData()`
unconditionally re-tiles and repaints an entire source, which is invisible on a static map and
expensive on an animated one. When every feature has a unique `string`/`number` `id` and retained
features keep semantically unchanged geometry/bbox values, the component emits MapLibre's
incremental `updateData()` for property changes, additions, removals, and order changes. The exact
next order is preserved: an unchanged prefix stays in place and only the invalidated suffix is
removed and re-added. Lyra snapshots control and projection data while retaining opaque GeoJSON
identity at the MapLibre boundary; a bounded, accessor-free comparison verifies the JSON geometry
graph instead. A missing/duplicate ID, changed geometry, exceeded bound, or uncertain
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

- `label: string = ''` — purpose-specific accessible name for MapLibre's actual focusable canvas.
  A nonempty host `aria-label` remains on the host and is not duplicated onto the canvas; the canvas
  uses `label` or the localized map name. An explicitly empty host `aria-label` is preserved as an
  empty canvas name. The non-semantic `[part="base"]` wrapper is not named instead.

**Authoring types:** `LyraMapLegendEntry`, `LyraMapLegendPattern`, `LyraMapLegendProjection`, `LyraMapChoroplethLayer`,
`LyraMapGeoJsonDataLayer`, `LyraMapDataLayerKind`, `LyraMapClusterOptions`, `LyraMapHeatmapOptions`,
`LyraMapHeatmapZoomValue`, `LyraMapMarker`, `LyraMapMarkerActivationDetail`,
`LyraMapMarkerActivationSource`, `LyraMapStyleSpecification`, and `LyraMapInstance`.
The former `LegendEntry`, `ChoroplethLayer`, `GeoJsonDataLayer`, and `MapMarker` names are removed
in v9 rather than retained as aliases.

**Getters:** `map: LyraMapInstance | undefined` → the underlying runtime `maplibregl.Map`, exposed
through the peer-neutral `getCanvas()`, `getCenter()`, `getZoom()`, `setCenter()`, `setZoom()`, and
`resize()` subset so merely importing Lyra does not require `maplibre-gl` declarations. A consumer
that installed the optional peer and needs its full imperative API can explicitly narrow the runtime
value to `maplibregl.Map`.

**Methods:** `LyraMap.preload(): Promise<boolean>` is a static optional-peer warm-up that starts the
shared `maplibre-gl` import without constructing a map or allocating a WebGL context. It resolves to
`false` when the peer is unavailable, allowing an application to choose a fallback before connecting
an element.

**Events:** `lr-map-load` (fired once, after the underlying map's own `'load'`),
`lr-map-marker-activate` (non-cancelable; frozen `LyraMapMarkerActivationDetail { id, lngLat,
marker, source }`; `id` is the trimmed explicit identity or `undefined`, `marker` is the accepted
declarative snapshot, and `source` is `'pointer' | 'keyboard'`), and `lr-map-click`
(frozen `detail: { readonly lngLat: readonly [lng, lat], readonly feature?, readonly origin?,
readonly sourceId? }`; the tuple and any hit GeoJSON feature are detached and recursively frozen).
`feature` resolves against the choropleth fill layer **and** every applied `dataLayers`
fill/line/circle/cluster layer, topmost first — so a shape painted through `dataLayers` is
identifiable instead of being indistinguishable from empty space. `origin` is `'choropleth'`,
`'data-layer'` or `'cluster'`, and `sourceId` carries the authored `dataLayers[].sourceId` for a
data-layer or cluster hit; both are `undefined` whenever `feature` is. A cluster hit is reported
separately because it is a synthetic aggregate rather than one of your features: its useful payload
is MapLibre's `point_count`/`point_count_abbreviated`/`cluster_id` properties, which is what a
zoom-to-cluster handler reads. The count label is deliberately not hit-tested (it sits exactly on
the circle already queried and would only make the label the topmost hit), and a `kind: 'heatmap'`
layer is never queried at all — MapLibre returns no features for a rendered density surface

The outer marker-activation detail is frozen, while an opaque marker `unsafeHtml` value remains the
original supplied value at the MapLibre popup and marker-activation boundary. Treat it as trusted
markup as described above.

**Slots:** `legend` — custom legend content, rendered inside the legend panel's own layout so it
stays positioned with the map instead of floating beside it. Supplying it opens the panel even
when `legend` and `legendGradient` are both empty.

**CSS parts:** `base`, `container`, `legend`, `legend-swatch`, `legend-gradient`, `legend-lo`,
`legend-hi`, `legend-limit`, `marker`, `popup`,
`popup-content`, `popup-close-button`, `attribution`, `attribution-toggle`, `error`.
`legend` is a localized `role="group"` containing a real list associated to the map canvas with
`aria-describedby`; each entry is a `listitem`, decorative swatches are inert/accessibility-hidden,
and the overlay is bounded to the map allocation with scrolling and long-label wrapping.
`legend-limit` is the localized bounded-projection summary. The five peer-chrome parts project
stable Lyra names onto MapLibre-generated DOM without erasing peer-supplied part tokens;
`marker` retains a 24px minimum target in both axes even when a peer/custom marker has no intrinsic
content size. `popup-close-button` is the generated close control on an open marker popup. `error` is ordinary localized visible
text rendered in place of `container` for four distinct states: explicit style required, optional
peer unavailable, owner-realm WebGL2 unavailable, or initialization failed. A post-mount failure is
appended to the document's pre-mounted `[data-lr-live-region="assertive"]` sink rather than making
shadow chrome live; raw caught errors are never exposed.

**Themeable custom properties:**

- `--lr-map-height` (default `var(--lr-size-24rem)`) — host block size, shared with the optional
  pre-upgrade reservation stylesheet. An explicit outer `block-size` still wins.
- `--lr-map-choropleth-fill-opacity` (default `0.75`) — fill opacity for the declarative
  `choropleth` layer and polygon fills in every `dataLayers` entry. It intentionally inherits from
  an ancestor, so one scoped declaration rethemes every nested map without setting each host.
- `--lr-map-popup-close-button-hover-bg` (default `var(--lr-color-brand-quiet)`) and
  `--lr-map-popup-close-button-hover-color` (default `var(--lr-color-brand)`) — hover background
  and foreground of `popup-close-button`.
- `--lr-map-popup-close-button-active-bg` (default `color-mix(in oklab,
var(--lr-color-brand-quiet), var(--lr-color-mix-partner) var(--lr-color-mix-active))`) and
  `--lr-map-popup-close-button-active-color` (default `var(--lr-color-brand)`) — pressed
  background and foreground of `popup-close-button`.
- Shared tokens — `--lr-space-xs/-s`, `--lr-color-surface`, `--lr-color-border`, `--lr-shadow`,
  `--lr-radius`.

**Optional peer deps:** `maplibre-gl` `>=5 <7` (lazy-loaded). `<lr-map>` styles MapLibre's
generated canvas, marker, popup, and control DOM inside its shadow root; a page-level MapLibre
stylesheet is neither required nor able to reach those nodes. MapLibre v5's standard build includes
its worker. MapLibre v6 is ESM-only, requires WebGL2, and additionally needs its module-worker URL
configured for the bundler once — the component cannot choose a bundler-specific worker URL. For
Vite with v6:

```html
<lr-map center="[2.35, 48.85]" zoom="10"></lr-map>
<script type="module">
  import { setWorkerUrl } from "maplibre-gl";
  import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
  setWorkerUrl(workerUrl);

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

Webpack, esbuild, Rollup, and direct-browser ESM use different worker URL forms; use MapLibre's ESM
installation guide for the matching setup:
https://maplibre.org/maplibre-gl-js/docs/#esm.

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
- a marker whose `color` changes for a persisting `id` is torn down and reconstructed (maplibre-gl's
  `Marker` has no `setColor()`) rather than mutated in place — this also closes any popup the user
  currently has open on that marker (a fresh, closed `Popup` is built for the new instance); an
  accepted side effect of the reconstruction fallback, not a bug.
- No click-select visual highlight on choropleth features (no `setFeatureState` call) — clicking
  only fires the event, no built-in visual feedback. Popups are still only reachable declaratively
  through `markers`' `unsafeHtml`/`label` — a choropleth-feature click still has no built-in popup,
  only the raw `lr-map-click` event.
- `LyraMapLegendEntry.color` is validated against a strict CSS-color-syntax allowlist before being applied
  to the legend swatch's `background-color`, rejecting anything that isn't recognizable color syntax
  (notably `url(...)`, which `background` also accepts and would otherwise fetch as soon as the
  swatch renders). The required `pattern` remains distinct in forced colors through solid, dashed,
  dotted, and double border/shape encodings.
- while the `maplibre-gl` peer is resolving, the host/base expose `aria-busy="true"` and show a
  decorative `<lr-skeleton shape="rect" announce="false">` in place of the map container.
  Ordinary sr-only text preserves the localized `loading` label without creating a shadow live
  region.
- construction of the real `maplibregl.Map` (and its WebGL context) is additionally gated on this
  element being observed intersecting the viewport (`IntersectionObserver`), independent of whether
  the `maplibre-gl` peer has already loaded — an off-screen `<lr-map>` swaps its skeleton for the
  empty `[part="container"]` div as soon as the peer resolves, but `map` stays `undefined` and
  `lr-map-load` never fires until the element is actually scrolled into view. Deliberate: caps
  concurrent WebGL contexts when many `<lr-map>`s sit in one dashboard/grid. Skipped entirely
  (constructs immediately once the peer loads) when `IntersectionObserver` itself is unavailable.
- Once constructed, the owner realm's `ResizeObserver` watches the rendered map container and calls
  the current peer's `resize()` on allocation changes. It is replaced on reconnect/adoption and
  disconnected before peer teardown, so a stale delivery cannot resize a removed map. Browsers
  without `ResizeObserver` retain MapLibre's own window-resize behavior.

---

## `lr-file-input`

A form-associated drag-drop + click-to-browse file dropzone. It stores and renders raw `File[]`;
no client-side CSV/XLSX/etc. parsing is performed (that's left entirely to the host).

**Properties:**

- `multiple: boolean = false` (reflected)
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
- `directory: boolean = false` (reflected) — enables native directory selection where supported
- `paste: boolean = true` (reflected) — accepts files pasted into the dropzone
- `compact: boolean = false` (reflected) — tighter dropzone padding, gap and label font for
  constrained spaces (a toolbar, a table cell) — the same convention as `lr-empty`'s `compact`. The
  dashed border stays; only the internal spacing shrinks. `false` (the default) keeps the full
  `--lr-space-l` dropzone.
- `label: string = ''` and `hint: string = ''`; an empty `label` leaves the localized dropzone
  instruction (`fileInputDefaultLabel`) as the visible fallback
- `errorText: string = ''` (attribute `error-text`) — plain-text owned validation feedback. When
  it is empty, a `customError` message is rendered when present; otherwise an intrinsic validation
  message appears after the control has been interacted with. Rich `error` slot content replaces
  that text.
- `withLabel: boolean = false`, `withHint: boolean = false`, and `withError: boolean = false`
  (attributes `with-label`, `with-hint`, and `with-error`) — SSR slot-presence hints. Use
  `with-error` when the rich `error` slot is populated in initial declarative-shadow-DOM output,
  before hydration can observe the assigned light-DOM content.
- `size: LyraSize = 'm'` (reflected)
- `validators: LyraFileInputValidator[] = []` (attribute: false) — additional JavaScript
  constraints, run after the intrinsic `required` check. **Fixed in 9.0.0:** the property was
  previously declared (typed `unknown[]`) and read by nothing, so an assigned validator silently
  never ran. It now implements the same contract as `lr-date-input`/`lr-combobox`:
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
- `accessibleLabel: string = ''` (attribute `aria-label`) — overrides `label` as the internal
  dropzone/button accessible name without changing visible copy
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

**Events:** a user selection or removal emits native bubbling/composed `input`, then exactly one
host `change`; programmatic `files` writes are silent. `lr-files` (`detail: LyraFileInputFilesDetail`, with fresh
frozen readonly `files` and `rejected` arrays and frozen rejected-file records, fired on both drop
and manual file-picker selection; immutable `File` objects retain identity) —
`LyraFileInputRejectedFile = { readonly file: File; readonly reason: 'type' | 'count' | 'size' | 'directory' | 'read' | 'limit'
}`: `'type'` from `accept`/`allowedMimeTypes`/`forbiddenMimeTypes`, `'count'` when a single-file
input (`multiple` unset) receives more than one file (in which case _all_ files are rejected, none
accepted), `'size'` from `maxFileSize`, `'directory'` for a dropped folder in single-file mode,
`'read'` when a file/directory reader fails, or `'limit'` when folder traversal exceeds its bounded
entry budget. Read/limit failures reject the complete selection atomically; lifecycle cancellation
and supersession stay silent. `focus`/`blur` fire when the semantic dropzone (the actual
keyboard-focusable element, not the hidden native `<input>`) gains/loses focus.
`lr-invalid` is the bubbling/composed alias of native invalidity.

Each rejected file also renders as its own line in the visible `[part="rejection"]` region, naming
the file and the reason via one of six locale keys: `fileInputRejectedType` (default
`'{filename}: this file type is not accepted.'`), `fileInputRejectedSize` (default
`'{filename}: this file is too large.'`), `fileInputRejectedCount` (default `'{filename}: only one
file can be selected at a time.'`), and — for `'directory'` — the pre-existing
`fileInputFolderRejected` (default `'Folders are not accepted here.'`, reused verbatim, so it has no
`{filename}` placeholder). Terminal traversal failures use `fileInputRejectedRead` (default
`'{filename}: the file could not be read.'`) and `fileInputRejectedLimit` (default
`'{filename}: the folder contains too many entries.'`). The filename is interpolated as
caller-supplied data, never localized itself. The same per-reason text is announced assertively;
the region is cleared (and unrendered) as soon as a subsequent selection rejects nothing.

**Slots:** `dropzone` (with the default slot retained as its fallback) supplies custom dropzone
content; `label`, `hint`, and `error` supply form chrome. The semantic button's accessible name comes from
`accessibleLabel`/host `aria-label`,
then `label`, so icon-only slot content still announces correctly. Slotted content is a sibling of
the button rather than nested inside it: links, buttons, inputs, and other interactive slotted
controls keep their own activation and do not also open the picker; clicking non-interactive custom
content still activates the dropzone.

The semantic button describes its rendered owned error and hint in that order. A supplied
`errorText` or `error` slot marks it `aria-invalid="true"`; a required intrinsic message appears
after interaction, while a custom validity message is immediately visible and survives native form
reset until `resetValidity()` or `setCustomValidity('')` clears it.

**CSS parts:** `file-input` (compatibility alias) and `form-control` (the complete form-control
frame), `form-control-label`, `label`, `hint`, `error`, `dropzone`, `dropzone-icon`, `dropzone-text`,
`base` (the native dropzone button, visually behind but semantically beside the
slotted content), `input`, `file-list`, `file`, `file-thumbnail`, `file-image`, `file-icon`,
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
radius of `[part='base']`; `--lr-file-input-compact-padding` (default `var(--lr-space-s)`) —
`[part='base']`'s padding while `compact`; `--lr-file-input-compact-gap` (default
`var(--lr-space-2xs)`) — the gap between the dropzone's slotted children while `compact`; and
`--lr-file-input-compact-font-size` (default `var(--lr-font-size-sm)`) — the label's font size while
`compact`. `--lr-file-input-font-size` (default `var(--lr-form-control-font-size)`) controls the
label and selected-filename text size.

`size` retunes the whole dropzone, not just its label: `--lr-file-input-dropzone-font-size`
(default `var(--lr-font-size-md-sm)`) for the instructional text,
`--lr-file-input-dropzone-icon-size` (default `var(--lr-font-size-xl)`) for `[part='dropzone-icon']`,
`--lr-file-input-dropzone-padding` (default `var(--lr-space-l)`) for the dropzone's own padding, and
`--lr-file-input-detail-font-size` (default `var(--lr-font-size-sm)`) for the secondary text (hint,
validation error, each file's formatted size). Each documented default is the `m`/`medium` tier, and
each is re-declared per `size` tier — so an unset or default-size control renders exactly as before,
while `size="xl"` scales the dropzone coherently instead of enlarging the label alone. `compact`
still overrides the dropzone padding and font size independently of the tier. The compact gap falls back to `--lr-file-input-gap` when its compact-specific
property is unset. The compact properties apply only while `compact` is set, so they are the way to tune a dense dropzone
without re-pointing shared spacing tokens for everything else on the page. The drag accept/reject
highlight on `[part='base'][data-drag-state='accept'|'reject']` is independently overridable too:
`--lr-file-input-accept-border-color` (default `var(--lr-color-success)`) and
`--lr-file-input-accept-bg` (default `color-mix(in srgb, var(--lr-color-success) 8%, transparent)`)
for the drag-accept state; `--lr-file-input-reject-border-color` (default `var(--lr-color-danger)`)
and `--lr-file-input-reject-bg` (default `color-mix(in srgb, var(--lr-color-danger) 8%,
transparent)`) for drag-reject. All four are inline `var()` fallbacks at the point of use, settable
on the element or any ancestor, so a consumer can retint just this dropzone's drag highlight without
hijacking the shared `--lr-color-success`/`--lr-color-danger` tokens used elsewhere. Plus shared
tokens — `--lr-space-xs`, `--lr-space-l`,
`--lr-color-border`, `--lr-radius`, `--lr-color-surface`, `--lr-color-text-quiet`,
`--lr-focus-ring-width/-color/-offset` (`[part="base"]:focus-visible` outline),
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
  Set `paste="false"` (or `.paste = false`) to opt out.
- Dragged folders are traversed recursively in `multiple` mode with a 10,000-entry budget. A read
  failure or over-budget traversal rejects the complete drop atomically and emits one `lr-files`
  result with `rejected[].reason === 'read'` or `'limit'`, plus dedicated visible and assertive
  localized feedback. Lifecycle cancellation and supersession remain silent and emit no partial
  result. In single-file mode a folder is reported as `rejected[].reason === 'directory'` (paired
  with a synthetic zero-byte `File` carrying the folder name).
- `maxFileSize` fails safe rather than open: `0` (the default) or `Infinity` mean "no limit", but a
  `NaN`/negative value — an unparsable `max-file-size` attribute, or a config that hasn't loaded
  yet — falls back to a 25 MB cap (exported as `DEFAULT_MAX_FILE_SIZE_BYTES`) instead of disabling
  the check.
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
- `accessibleLabel: string | null` (attribute `aria-label`) — a declarative attribute remains on
  the host while the iframe gets its localized purpose title, avoiding a duplicate name on two
  semantic owners. A property-only value names the iframe. Explicit empty host naming is preserved
  as an empty iframe title rather than replaced through truthiness.
- readonly `iframe?: HTMLIFrameElement`, `contentWindow: Window | null`, and
  `contentDocument: Document | null`. Both content accessors return `null` while detached;
  `contentDocument` also returns `null` across an origin boundary.

**Authoring type:** `LyraZoomableFrameLoading`. The former unprefixed
`ZoomableFrameLoading` name is removed in v9 rather than retained as an alias.
The former deep-class-module implementation exports `DEFAULT_ZOOM_LEVELS`,
`DEFAULT_IFRAME_SANDBOX`, `safeZoomableFrameSrc()`, and `safeZoomableFrameSandbox()` are also
removed in v9. They were never part of the registration, root, or documented component surface;
configure the corresponding public properties instead of depending on sink-policy internals.

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

**Events:** internal `focus`/`blur` from the iframe are relayed exactly once as owner-realm native
`FocusEvent`s (bubbling and composed, preserving `relatedTarget`);
native `load` and `error` are relayed exactly once from the current iframe
generation as non-bubbling, non-composed `Event` instances. Navigation/source-policy changes
replace the iframe, so a late event from an earlier document is ignored; detached frames do not
notify.

**CSS parts:** `iframe`, `controls`, `zoom-in-button`, and `zoom-out-button`. Real focus entry into
the browsing context (Tab, pointer, or `focus()`) exposes `data-frame-focused` on the host and paints
the shared focus ring around the iframe boundary; blur, navigation rekey, disablement, and removal
clear it.

**CSS custom properties:** read-only `--lr-zoomable-frame-zoom`, resolved from the `zoom`
property and applied to the internal iframe scale; and `--lr-zoomable-frame-control-hover-background`
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
import "@aceshooting/lyra-ui/components/media/zoomable-frame/zoomable-frame.js";
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
  `zoomStep: number = 0.25` — bounded, finite zoom configuration
- `src: string = ''` and `alt: string = ''` — optional safe image source. A rejected URL is treated
  as absent and the default slot renders; no empty or unsafe `<img>` replaces that fallback.
- `accessibleLabel: string | null` (attribute `aria-label`) — a declarative host label remains on
  the host while the focusable viewport receives the localized inspection-surface purpose name.
  A property-only value can name the viewport. This avoids cloning one author label onto both the
  outer component and nested `role="group"`.

**Methods:** `zoomIn()`, `zoomOut()`, and `resetZoom()` update zoom and emit `lr-zoom-change`
(`detail: { zoom }`). `resetZoom()` preserves pan; `resetView()` also scrolls the viewport to the
origin. Reset reaches 100% exactly whenever it is within `minZoom`/`maxZoom`; it is not quantized to
the nearest `zoomStep`. The viewport accepts `+`/`=`, `-`/`_`, and `0`, without consuming keys from
a slotted editor. The three zoom buttons are independently tabbable inside a labelled `group`; the
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
and the read-only `--lr-pan-zoom-zoom`. The former `--lr-zoomable-frame-min-block-size` and
`--lr-zoomable-frame-zoom` compatibility names were removed in v9; migrate them to the two
`--lr-pan-zoom-*` names. Scaling
uses layout-participating CSS `zoom`, not a paint-only transform, so the viewport's native scroll
range reaches the entire painted footprint at both logical edges in LTR and RTL.

```js
import "@aceshooting/lyra-ui/components/media/pan-zoom/pan-zoom.js";
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
- `previewable: boolean = true` (reflected) — shows the preview action whenever a `file` or
  `preview-src` is available
- `status: LyraAttachmentUploadStatus = 'pending'` (reflected) — `'pending' | 'uploading' |
'error' | 'success'`; invalid values normalize to `pending`. Drives the accent tint and which of
  `progress`/`spinner`/`retry-button` renders.
- `progress: number = 0` — upload completion, 0-100; only meaningful while `status="uploading"`, a
  value of `0` or `NaN` falls back to the indeterminate spinner
- `removable: boolean = true` (reflected) — shows the remove (×) button
- `compact: boolean = false` (reflected) — renders a smaller, borderless pill presentation instead of
  the default bordered/chrome-heavy chip, e.g. for a composer's pending-attachment tray. `false` (the
  default) is visually identical to the standard chip.
- `thumbnailOnly: boolean = false` (reflected, attribute `thumbnail-only`) — when both this and
  `compact` are set, hides `[part='meta']` (the filename/size text) entirely for an image-mime
  attachment, leaving only the thumbnail. Has no effect for a non-image chip, or when `compact` is
  unset. `false` (the default) reproduces the chip's exact existing output.
- `removeLabel?: string` (attribute `remove-label`) — verb used in the remove button's accessible
  name; omitting it reads back `undefined` and routes through the complete localized
  `removeWithContext` template
- `retryLabel?: string` (attribute `retry-label`) — verb used in the retry button's accessible
  name; omitting it reads back `undefined` and routes through the complete localized
  `attachmentRetryWithContext` template
- `uploadingLabel?: string` (attribute `uploading-label`) — verb used in the visible uploading
  status; omitting it reads back `undefined` and uses complete localized messages for progress,
  indeterminate state, and filename context so translators can reorder every value
- `uploadFailedLabel?: string` (attribute `upload-failed-label`) — visible status text shown for
  `status="error"`; override for i18n/locale. Omitting it reads back `undefined` and uses the
  localized default (`'Upload failed'` in English)
- `untitledLabel?: string` (attribute `untitled-label`) — fallback filename and tooltip when
  neither `file` nor `name` supplies a name. Omitting it reads back `undefined` and uses the
  localized default (`'Untitled file'` in English)

**Renamed in 8.0.0 — breaking:** the byte count is `bytes`, not `size` (same rename as
`lr-file-icon`'s). Everywhere else in this library `size` names a tier on the shared size ladder,
and a numeric byte count answering to the same property name is a collision a consumer only
discovers at runtime. A leftover `size="245000"` is an unknown attribute now: `bytes` stays omitted
and the `size` part renders nothing.

The component identifies _which_ attachment an action event is about through `attachmentId`. Set
`attachment-id="..."` when you have a stable server-side identity; when unset or whitespace-only
and `file` is set, a stable attachment id is
derived from `` `${file.name}:${file.size}:${file.lastModified}` ``; when neither is available, a
generated internal id is used as a last resort.

**Events:** `lr-remove` (`detail: { attachmentId }`, only rendered while `removable`), `lr-retry`
(`detail: { attachmentId }`, only rendered while `status="error"`), and
`lr-preview-request` (`detail: { attachmentId, name, mimeType, src }`) — a plain, non-cancelable
notification that the preview action was activated. **Breaking in 10.0.0:** this event was
advertised as cancelable, but the chip never read `defaultPrevented` and owns no preview default
action to veto (it never registers or owns a viewer/overlay), so `preventDefault()` was a no-op.
The flag is gone rather than left as a promise the component cannot keep.

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
`--lr-attachment-chip-border` (default `var(--lr-color-border)`) — the trio's private defaults
change per `status` (`uploading` → brand/brand-quiet/transparent, `error` →
danger/danger-quiet/transparent, `success` → success/success-quiet/transparent), while an inherited
or direct public value remains authoritative; `--lr-attachment-chip-compact-thumbnail-size` (default
`1.75rem`), `--lr-attachment-chip-compact-font-size` (default `var(--lr-font-size-xs)`),
`--lr-attachment-chip-compact-gap` (default `0.25rem`) — govern the chip's thumbnail size, text
size, and internal gap while `compact` is set; `--lr-attachment-chip-spinner-duration` (default
`var(--lr-transition-ambient)`) controls the indeterminate rotation's duration and easing and stops
under reduced motion; plus shared tokens `--lr-space-xs`, `--lr-space-s`,
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
an unknown size renders nothing instead of `"NaN B"`.

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
It is created only when `file` is an image (or `previewable` is set), reused for as long as the same
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

Localized, tokenized file-format badge for surrounding upload rows, cards, selectors, and viewer
headers. The companion `getFileTypeMetadata(mimeType, fileName?)` utility covers common document,
spreadsheet, presentation, code, archive, image, audio, and video formats. An explicit known MIME
type wins; filename extension fallback is used only for an empty or `application/octet-stream`
MIME type. Unknown values return a generic file result.

**Properties:** `mimeType` (attribute `mime-type`), `name`, `bytes` (file size **in bytes**, shown
next to the label in `mode="label"`; `0`, the default, renders no size), `label`, `decorative`,
`mode: LyraFileIconMode = 'icon' | 'label'` (invalid values normalize to `icon`), and
`registry: LyraFileTypeMetadataRegistry` (property-only, defaulting to the immutable built-in
registry). A host `aria-label` wins over the computed localized file-type/size name. `decorative`
changes the semantic owner to presentation and renders `aria-hidden="true"` explicitly.

**Renamed in 8.0.0 — breaking:** the byte count is `bytes`, not `size`. Everywhere else in this
library `size` names a tier on the shared size ladder, and a numeric byte count answering to the
same property name is a collision a consumer only discovers at runtime. A leftover `size="245000"`
is an unknown attribute now: `bytes` stays `0` and the badge silently renders without a size.

**CSS parts:** `base`, `icon`, `label`, `description` (consumer-authored registry metadata in label
mode), and `size` (the part keeps its name — it is the rendered size _text_, and renaming a part
would break shipped `::part()` rules for no gain).

**Themeable custom properties:** `--lr-file-icon-size` (default `var(--lr-size-2rem)` — the
format badge's inline and block size).

**Exports:** `LyraFileTypeMetadata`, `LyraFileTypeMetadataEntry`, `LyraResolvedFileTypeMetadata`,
`LyraFileTypeMetadataRegistry`, `LyraFileTypeIcon`, `LyraFileTypeCategory`,
`createFileTypeMetadataRegistry(entries)`, `defaultFileTypeMetadataRegistry`, and the compatibility
lookup `getFileTypeMetadata()`. Registries validate and deeply snapshot records, use deterministic
longest registered-suffix matching (including multi-dot/punctuation suffixes), and isolate custom
mappings per instance instead of mutating module-global state. Consumer labels/descriptions remain
verbatim; built-in labels route through localization.

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
  the host as a whole while its nested button/link keeps a purpose-specific localized action name. A
  property-only assignment can override the nested action when no host label is present. An explicit
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

**Renamed in 8.0.0 — breaking:** this was `appearance`. Library-wide, `appearance` now means only
"how a control fills itself" and `frame` means "whether a container draws itself as a bounded card";
this property was always the second. There is no alias — `appearance` on `<lr-media-card>` is simply
an unknown attribute now, so a card left on `appearance="plain"` silently renders the full card
chrome again.

**Authoring types:** `LyraMediaCardKind` and `LyraMediaCardOpenDetail`; `frame` uses the shared
`LyraFrame` directly. The former `MediaCardKind`, `MediaCardOpenDetail`, and `MediaCardFrame`
names are removed in v9 rather than retained as aliases. URL validators are implementation details,
not exports from the component entry.

**Events:** `lr-media-open` (`detail: LyraMediaCardOpenDetail { src: string; filename: string }`,
noncancelable) notifies
after image-card or video open-button activation; those kinds have no component-owned navigation,
so a host decides what "open" means. `lr-before-media-download` carries the same detail and is
cancelable only for a safe file anchor immediately before its native download/open default; calling
`preventDefault()` there suppresses that exact default. `detail.src` is whichever internally
validated safe-URL sink actually rendered, not necessarily the raw `src` property verbatim — a
whitespace-padded value is trimmed, so it matches the rendered sink.
The former generic `lr-open` event is removed in v9: notification and veto phases now have distinct,
truthful names.
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
`--lr-media-card-active-border-color` (default
`color-mix(in oklab, var(--lr-color-brand), var(--lr-color-mix-partner) var(--lr-color-mix-active))`)
and `--lr-media-card-active-bg` (default
`color-mix(in oklab, var(--lr-color-surface), var(--lr-color-mix-partner) var(--lr-color-mix-active))`)
independently retint only a pressed image/file action. Both are inline `var()` fallbacks in the
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
    .addEventListener("lr-before-media-download", (e) => shouldUseNativeDownload || e.preventDefault());
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
- `multiple: boolean = true` (reflected) — forwarded to the hidden file input's own `multiple`
  attribute.
- `disabled: boolean = false` (reflected)
- `accessibleLabel?: string` (attribute `accessible-label`) — overrides either trigger shape's
  localized accessible-name fallback. A host `aria-label`, including explicit empty, wins.
- `triggerTitle?: string` (attribute `trigger-title`) — forwards a sighted-user hover tooltip to
  both the single-capability and multi-capability trigger buttons

**Events:** `lr-files` (`detail: { capability: 'files' | 'image'; files: readonly File[] }`) — fired
once a file-backed capability's hidden input produces a real selection. `files` is a fresh frozen
owner-realm array snapshot, not a live reference to the input's own `.files`. `lr-camera-request`
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
`hidden-input` (the internal native `<input type="file">` that actually opens the OS file picker;
hidden via CSS by default, exposed as a part only so a consumer can override that with
`::part(hidden-input)` in the unlikely case their integration needs to).

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

**Properties:**

- `initials: string = ''` — fallback text (typically 1-2 characters), shown whenever no glyph and no
  image is set, or the image fails to load and no `icon` slot content is provided.
- `image: string = ''` — image URL; takes priority over the `icon` slot and `initials` when set and
  loads successfully, falling back to them on a load
  error. **Renamed from `src` in 8.0.0** to match `wa-avatar`: a mechanical `wa-` → `lr-` rename
  used to leave the property unset, so a migrated avatar silently dropped its photo and rendered
  initials instead.
- `label: string = ''` — upstream-compatible accessible description. A host `aria-label` wins.
  The same resolved name reaches the image `alt` and every fallback tier.
- host `aria-label` — overrides `label` as the image/fallback accessible name without changing the
  visible initials or image
- `loading: 'eager' | 'lazy' = 'eager'` (new in 8.0.0) — passthrough to the rendered `<img>`'s
  native `loading` attribute. `'lazy'` defers the request until the avatar approaches the viewport,
  which is worth setting for avatars far down a long list and never for one above the fold. It only
  reaches the DOM while the image tier is the one rendering; the default matches the native default,
  so an avatar that never sets it behaves exactly as it did before the property existed.
- `size: LyraSize = 'medium'` (reflected) — `'2xs' | 'xs' | 's' | 'm' | 'l' | 'xl' |
'small' | 'medium' | 'large'`. Every tier renders a distinct diameter: 1.5rem (`2xs`), 2rem
  (`xs`), 2.5rem (`s`/`small`), 3rem (`m`/`medium`, the mirrored default), 4rem (`l`/`large`,
  matching `--lr-icon-button-size`), and 5rem (`xl`). Invalid and removed `sm`/`md`/`lg` writes
  normalize to `medium`.
- `shape: 'circle' | 'rounded' | 'square' = 'circle'` (reflected) — three distinct corner radii:
  `circle` (the pill radius), `rounded` (the shared `--lr-radius`), `square` (no radius at all).
  **`rounded` is new in 8.0.0.**
- `variant: 'neutral' | 'brand' | 'success' | 'warning' | 'danger' = 'neutral'` (reflected) —
  recolors the initials-fallback background/text on the library's one semantic-tone vocabulary;
  `neutral` (the default) reads as a plain, unaccented circle. **Renamed from `tone` in 8.0.0**,
  with no alias: `tone="brand"` is an unknown attribute now and renders the neutral circle.

**Events:** `lr-error` (`detail: { image: string }`, new in 8.0.0) — the image failed to load;
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
`var(--lr-color-border)`, whose private default changes for a non-neutral `variant` to that
variant's `-quiet` fill; there is no `--lr-color-surface-alt` token in this library, despite what
older copies of this page claimed), `--lr-avatar-color` (default `var(--lr-color-text)`, whose
private default changes for a non-neutral `variant` to that variant's loud color),
`--lr-avatar-font-size` (default `var(--lr-font-size-m)`) — the font size of the initials fallback,
and of any `em`-sized slotted glyph. Its private default follows `size` alongside the diameter
(`--lr-font-size-xs` at `2xs`, `--lr-font-size-sm` at `xs`, `--lr-font-size-md-sm` at `s`,
`--lr-font-size-m` at `m`, `--lr-font-size-lg` at `l`, and `--lr-font-size-xl` at `xl`), so the
initials track the circle instead of staying one fixed size across every tier. Every public value
above can be inherited from an ancestor or set directly on the avatar and remains authoritative
across size/variant states. Plus shared tokens
`--lr-radius`/`-pill`, `--lr-font-weight-semibold`.

The variant colors are deliberately **not** the library's generic quiet-fill/on-quiet-text pairing:
an avatar's initials _are_ the accent, so they read in the variant's own loud color on that
variant's quiet tint.

**Optional peer deps:** none.

```html
<lr-avatar initials="JS" variant="brand"></lr-avatar>
<lr-avatar image="/users/42/photo.jpg" label="Jane Smith" size="large" shape="rounded"></lr-avatar>
<lr-avatar label="Assistant"><svg slot="icon" viewBox="0 0 24 24"><!-- role glyph --></svg></lr-avatar>

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
  state after reduced-motion arbitration: `play && !(respectReducedMotion && <OS prefers reduce>)`.
  It is a genuine getter-only property, so assigning to it from a strict JavaScript module throws a
  `TypeError`; drive playback via `play`.
- `respectReducedMotion: boolean = true` (reflected, attribute `respect-reduced-motion`) — while
  `true` and the OS reports `prefers-reduced-motion: reduce`, playback stays frozen and
  `[part="play-button"]` is `disabled` regardless of `play`.
- `accessibleLabel: string = ''` (attribute `aria-label`) — when the host attribute is present,
  including explicitly empty, it overrides `[part="play-button"]`'s computed Play/Pause label
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
  (a DPR-aware `drawImage()`), not re-captured on each pause — pausing always reverts to that first
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
- `respectReducedMotion: boolean = true` (attribute `respect-reduced-motion`, reflected) — under
  `prefers-reduced-motion: reduce`, caps playback at one iteration and calls `finish()` immediately
  instead of playing, so the target snaps to its resolved end state; `lr-start`/`lr-finish` still
  fire in order.
- `playOnVisible: boolean = false` (attribute `play-on-visible`, reflected) — starts playback via
  `IntersectionObserver` once the target intersects. `playOnVisibleRepeat: boolean = false`
  (attribute `play-on-visible-repeat`, reflected) — re-plays on each re-entry and pauses on exit;
  when unset the observer disconnects after the first trigger. `root: Element | null = null` and
  `threshold: number | readonly number[] = 0` (both attribute: false) plus
  `rootMargin: string = '0px'` (attribute `root-margin`) configure that observer. Threshold arrays
  are frozen snapshots, retain only finite values from 0 through 1, and inspect at most 1,000
  candidates per assignment; invalid scalar thresholds normalize to `0`.
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
import "@aceshooting/lyra-ui/components/media/animation/animation.js";
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
- `size: LyraSize = 'medium'` (reflected) — reused from `<lr-avatar>`'s canonical six-step ladder.
- `shape: LyraAvatarShape = 'circle'` (reflected) — `'circle' | 'rounded' | 'square'`.
- `variant: LyraVariant = 'neutral'` (reflected) — `'neutral' | 'brand' | 'success' | 'warning' |
'danger'`.

`size`/`shape`/`variant` style the overflow badge and provide defaults only to assigned avatars
that omit the corresponding attribute. Explicit child attributes remain authoritative; owned
defaults are restored without overwriting later author writes across removal, reparenting,
disconnect and reconnect.

- `label: string = ''` — the group's `role="group"` accessible name. A host-level `aria-label` wins
  if both are set; with neither, no `aria-label` is rendered.

**Events:** `lr-overflow-click` (frozen
`detail: { readonly hiddenCount: number; readonly hiddenAvatars: readonly LyraAvatar[] }`) —
the badge was activated by click or Enter/Space. Non-cancelable, purely informational: the
component keeps rendering the same collapsed stack, and a host typically wires this to its own
popover/dialog listing the hidden members. There is no `expanded` state and no `aria-expanded`.

**Slots:** default slot — direct or forwarded `<lr-avatar>` elements. Other elements are ignored
and remain untouched. Author-hidden/inert avatars do not consume visible capacity. Excess eligible
avatars are hidden through reversible component-owned state.

**CSS parts:** `base` (the outer inline-flex container holding the slot and the badge),
`overflow-badge` (the 40px-minimum action surface; only rendered while `max` is actively
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
`--lr-avatar-group-badge-bg` (default `var(--lr-color-border)`, with a private default that follows
`variant`), `--lr-avatar-group-badge-color` (default `var(--lr-color-text)`, with a private default
that follows `variant`),
`--lr-avatar-group-badge-font-size` (default `var(--lr-font-size-m)`) — the font size of the "+N"
badge label. Its private default follows `size` alongside the badge diameter, matching
`<lr-avatar>`'s own `--lr-avatar-font-size` scale (`xs`/`sm`/`md-sm`/`m`/`lg`/`xl` font tokens from
the `2xs` through `xl` size tiers), so the badge and the avatars it caps read at the same optical
weight. An inherited or direct public value remains authoritative for every hook.

The overflow badge keeps a `--lr-icon-button-size` minimum activation target at every tier while
the nested visual disc stays exactly avatar-sized, so small tiers do not paint as oversized 40px
circles.

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

**Properties:**

- `open: boolean = false` (reflected) — post-render writes run the same cancelable lifecycle as
  `show()`/`hide()`/`close()`. Initial `open` markup is state and emits no lifecycle events.
- `images: readonly LyraLightboxImage[] = []` (attribute: false) —
  `LyraLightboxImage { readonly src: string; readonly alt?: string; readonly caption?: string }`.
  Assignment clones/freezes the records and inspects at most 10,000 candidates; malformed records
  are omitted and updates require a new collection assignment. `src` is passed to the embedded
  frame, which runs it through `safeMediaSrc()`. `alt`/`caption` are caller data, never localized.
- `index: number = 0` (reflected) — clamped defensively for rendering and silently re-synced (no
  event) when `images` shrinks.
- `loop: boolean = false` (reflected) — wraps prev/next past the ends.
- `lightDismiss: boolean = false` (attribute `light-dismiss`) — opt in to backdrop dismissal. Off by default, matching `lr-dialog`.
- `showCounter: boolean = true` (attribute `show-counter`, **not reflected**) — shows the visible
  `[part="counter"]`. `show-counter="false"` clears it from plain HTML (the attribute is parsed by
  literal string, not by presence, so a true-defaulting boolean can actually be turned off), and a
  `.showCounter=${false}` property binding does the same. Nothing is ever written back to the
  attribute — no stylesheet or selector keys off `[show-counter]`.
  Spoken position updates remain active when the counter is hidden: the shadow
  `[part="live-region"]` is only an `aria-hidden` text mirror, while announcements append to the
  shared light-DOM polite sink. Announcements stay silent when the lightbox or a composed ancestor
  is excluded from the accessibility tree.
- `minZoom: number = 0.5`, `maxZoom: number = 4`, `zoomStep: number = 0.25` (attributes `min-zoom`/
  `max-zoom`/`zoom-step`) — pure pass-throughs to the embedded `<lr-pan-zoom>`, which does the
  normalizing.
- `accessibleLabel: string | null = null` (attribute `aria-label`) — the panel's accessible name,
  overriding the localized `lightboxLabel`.

**Methods:** promise-based `show()`, `hide()`, and `close(reason?)`, plus `next()`, `previous()`, and
`goTo(index)`. `show()`/`hide()` resolve after the successful rendered transition; a veto resolves
without changing state. `goTo()` ignores a non-finite
index without changing state or emitting `lr-index-change`. A finite fractional index is truncated
toward zero before clamping or loop wrapping, so `lr-index-change.detail.index` is always the
actual rendered integer index; `reason` defaults to `'api'` and is forwarded as the close event's
detail.

**Events:** cancelable `lr-show`, followed after a successful open render by `lr-after-show`;
cancelable `lr-hide` (`detail: LyraLightboxHideDetail = { source: Element }`), then
`lr-lightbox-close` (`detail: LyraLightboxCloseReason = 'escape' | 'backdrop' |
'close-button' | 'api' | 'unmount' | (string & {})`; **cancelable** — `preventDefault()` blocks
closing on every path, including a consumer's own `close()` call), followed after a successful
closed render by `lr-after-hide`. Removal while open emits the settled non-vetoable
hide/close/after-hide order with reason `'unmount'`. `lr-index-change` (`detail: { index }`, fired
only for internally-driven navigation — a button, a keyboard shortcut, or `next()`/`previous()`/
`goTo()`; **not** when a consumer sets `index`/`images` directly); `lr-zoom-change` (`detail: {
zoom }`) is not emitted by the lightbox itself — it bubbles up composed from the embedded frame.

**Slots:** `actions` — extra toolbar buttons (download/share/delete), rendered in `[part="toolbar"]`
between the counter and the close button.

**CSS parts:** `backdrop`, `panel` (`role="dialog"` + `aria-modal="true"` while open; fills the
padded safe area rather than shrink-wrapping), `toolbar`, `counter` (visible localized "Image N of
Total"), `live-region` (an `aria-hidden` shadow text mirror; each post-mount `index` change,
including a consumer-driven one, appends the localized position to the document's shared
`[data-lr-live-region="polite"]` sink; initial mount and reconnect are silent), `actions` (wrapper,
`hidden` when nothing is slotted),
`close-button` (always rendered — unlike `<lr-dialog>`'s opt-in `closable`), `stage`, `frame` (the
embedded `<lr-pan-zoom>`), forwarded aliases `frame-viewport`, `frame-content`, `frame-controls`,
`previous-button`,
`previous-glyph`, `next-button`, `next-glyph`, `caption` (only when the current image has one; its
`id` is the panel's `aria-describedby` target).

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
- scope for v1: no per-image slotted content (data-driven via `images` only), no dot indicators, no
  visual open/close animation, no click-image-to-navigate, no touch-swipe. Lifecycle phases are
  still observable through the before/after events and methods above.

## `lr-qr-code`

Renders `value` as a QR code using the optional `qrcode` peer dependency. **Properties:** `value`,
`label`, `size` (clamped to `1`–`2048` CSS px), `radius` (clamped to `0`–`0.5`), and
`errorCorrection` (`error-correction`, `L`/`M`/`Q`/`H`, default `H`). Standard host `color` and
`background-color` control paint; optional `--lr-qr-code-fill` and
`--lr-qr-code-background` aliases override those host styles, while the permanent upstream parity
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

**CSS parts:** `base` and `qr-code` are aliases on the same outer wrapper; `canvas`, `empty`,
`loading`, and `error`. **CSS custom properties:**
`--lr-qr-code-fill` and `--lr-qr-code-background`.

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
the embedded pan-zoom surface's zoom. `scrollToAnchor(target: LyraAnchor | string):
Promise<boolean>` resolves a canonical finite, positive, in-bounds `region` anchor (or unique
highlight id) after the image loads, scrolls its rendered target into the pan/zoom viewport, and
reports true only when the target visibly intersects that viewport. Malformed/out-of-range regions
report false.

**Events:** `lr-load` (`detail: { naturalWidth, naturalHeight }`), `lr-zoom-change` (`detail: {
zoom }`), `lr-rotation-change` (`detail: { rotation }`), `lr-fit-change` (`detail: { fit }`),
`lr-highlight-activate` (`detail: { highlightId }`), `lr-annotation-create` (`detail: { anchor }`, kind
`'region'`), `lr-anchor-result` (`detail: { found }`), and `lr-render-error` (`detail: { error
}`).

`lr-text-select` is not part of this raster viewer's event contract because it binds no selectable
text.

**CSS parts:** `base`, `toolbar`, `fit-control`, `rotate-button`, `annotate-toggle`, `frame` (the
embedded `lr-pan-zoom`), forwarded aliases `frame-viewport`, `frame-content`, `frame-controls`,
`rotation-frame` (the axis-swapped 90°/270° layout footprint), `image-wrapper`, `image`,
`highlight-layer`, `highlight` (carries `data-tone`/`data-active`), `highlight-label`,
`annotation-box`, `error`, and `anchor-live-region` (an aria-hidden, non-live shadow mirror of the
latest anchor-jump message; the spoken copy is appended to the shared document-level polite sink
only while the viewer and its composed ancestors are exposed to the accessibility tree).

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
retint a whole tone through the matching `-bg` knob instead. These properties are declared as inline
`var()` fallbacks at the point of use rather than on `:host`, so each can be set on the element _or
on any ancestor_:
`::part(highlight)[data-active]` is invalid CSS — Shadow Parts forbids an attribute selector after
`::part()` — which previously left overriding the library-wide
`--lr-color-brand`/`--lr-color-brand-quiet` tokens as the only lever, repainting every other
element that read them. Unset, each falls back to the token its rule used before.

## `lr-av-player`

An audio/video player built on a native `<audio>`/`<video>` element, plus a cue transcript synced to
`currentTime`, `time-range` anchor/highlight support, an optional dependency-free waveform (peaks
in, no in-component decoding), and playback-rate control. Owns recorded-media transcript sync —
distinct from `<lr-transcript-feed>` (live captions for an in-progress voice session) and
`<lr-sequence-playback>` (a discrete sequence stepper, no native media). Adopts
`DocumentAnchorTarget` with
`anchorKinds: ['time-range']` only — no text selection is bound. The transcript virtualizes through
`<lr-virtual-list>` the same way `lr-pdf-viewer` virtualizes pages.

The default document-viewer renderer advertises `time-range` anchors but not search: the generic
document payload has no cue/transcript field, so advertising search there would expose a control
whose result is always empty. Standalone `<lr-av-player>` search remains available whenever the
consumer supplies `cues` directly.

**Properties:** `src: string = ''`, `name: string = ''`, `kind?: 'audio' | 'video'`
(attribute-backed auto-detection override), `mimeType: string = ''` (attribute `mime-type`), `poster: string =
''`, `loop: boolean = false`, `muted: boolean = false`, `preload: 'none' | 'metadata' | 'auto' =
'metadata'`, `playbackRate: number = 1` (attribute `playback-rate`, reflected),
`volume: number = 1` (attribute `volume`, reflected; normalized to `0..1`),
`rates: readonly number[] = [0.75, 1, 1.25, 1.5, 2]` (attribute: false),
`cues: readonly LyraAvCue[] = []` (attribute: false), `peaks: readonly number[] = []`
(attribute: false), and `tracks: readonly LyraAvTrack[] = []` (attribute: false). Each collection is
normalized synchronously on assignment into a bounded, cloned, frozen snapshot; mutate by assigning a
new collection. The inherited
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

Runtime numeric input is normalized before it reaches media, canvas, or `Intl`: cue/highlight times
and waveform peaks are clamped to their valid ranges; non-finite native duration/current time
cannot leak into state or events. `rates` keeps only unique finite values in the supported
`0.0625..16` range, while always including the normalized current `playbackRate`.

**Waveform lifecycle:** with `peaks`, waveform canvas painting is gated by player visibility when
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
`matchCountExact` is always `true` — `search()` matches over the already-loaded `cues` array with no
additional ceiling), and
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

Two further cue-state properties tint the transcript: `--lr-av-player-cue-current-bg` (default
`var(--lr-color-brand-quiet)`) is the background of the `cue-current` row the playhead is inside,
and `--lr-av-player-cue-active-match-color` (default `var(--lr-color-warning)`) is the outline of
the `cue-active-match` row, leaving the other matches' dashed outline on the shared warning token.
Both are inline `var()` fallbacks at the point of use rather than `:host` declarations, so either
can be set on the element or on any ancestor.

**RTL behavior:** surrounding controls follow the inherited direction, but the elapsed-media axis
on `[part='timeline']` stays physical left-to-right. ArrowLeft rewinds and ArrowRight advances in
both LTR and RTL.

## `lr-video`

Experimental inline native video player with custom controls, safe declarative sources/tracks,
selectable captions, and bounded WebVTT thumbnail previews. It mirrors the public Web Awesome Video
API under the `lr-` prefix. Import the granular registration entry with
`import '@aceshooting/lyra-ui/components/media/video/video.js'`.

**Properties:** `autoplay: boolean = false`, `autoplayMuted: boolean = false` (attribute
`autoplay-muted`), `autoplayOnVisible: boolean = false` (attribute `autoplay-on-visible`),
`controls: 'none' | 'standard' | 'full' = 'standard'`, `currentTime: number = 0` (attribute
`currentTime`; HTML exposes it as lowercase `currenttime`, with legacy `current-time` also
accepted), `duration: number = 0` (live/read-only in normal use), `iconLibrary: string =
'system'` (attribute `icon-library`), `loop: boolean = false`, `muted: boolean = false`, `playing:
boolean = false` (live/read-only in normal use), `poster: string = ''`, `preload: 'auto' |
'metadata' | 'none' = 'metadata'`, `src: string = ''`, `thumbnails: string = ''`, `title: string =
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
canonical upstream-compatible authoring type; the redundant `LyraVideoState` alias is removed in
v9;
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
`--lr-video-poster-play-button-hover-background` (default is the existing hover color mix) and
`--lr-video-poster-play-button-hover-border-color` (default `var(--lr-color-brand)`).

Caption and playback-rate selectors remain native `<select>` controls with decorative, pointer-inert
chevrons; their option foreground and background inherit `--controls-color` and
`--controls-background`. Controls, elapsed/title text, caption text, and selectors consistently use
the semantic strong-overlay foreground. The fallback remains legible in light and dark themes;
an explicit `--controls-color` still has final precedence, and forced-colors mode remains UA-owned.

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
`import '@aceshooting/lyra-ui/components/media/video-playlist/video-playlist.js'`.

**Properties:** `controls: 'none' | 'standard' | 'full' = 'full'` (reflected and forwarded to every
direct child), and `iconLibrary: string = 'system'` (attribute `icon-library`, non-reflected and
forwarded). Lyra additionally provides `autoAdvance: boolean = true` (attribute `auto-advance`;
`auto-advance="false"` disables completion-driven navigation) and `repeat: 'none' | 'one' | 'all' =
'none'`. Keeping `autoAdvance` true preserves the mirrored behavior in which an ended video starts
the next one. `repeat="one"` restarts the current video; `repeat="all"` wraps the final video to the
first. `items: readonly LyraVideoPlaylistItem[] = []` (attribute: false) is deterministic
first-render row metadata with `{ title, poster?, duration?, unavailable? }`, indexed to the direct
video children. Assign the same value before the server and browser first render. Seeded rows stay
visible but disabled while live children are unavailable; after hydration, each child's live
title/poster/duration and native `inert` state become authoritative in a corrective update that
reuses the server-rendered row nodes. Once live children have been observed, later removal does not
make stale seed rows reappear.

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
exact shape `{ title, poster, sources, tracks }`, not the live child element. `sources` contains
fresh `{ src, type, media }` records for the child's direct `src` and `<source>` declarations;
`tracks` contains fresh `{ src, kind, srclang, label, default }` records. A listener that needs to
annotate or reshape the payload must create its own mutable copy; the dispatched detail and every
nested record/array reject mutation.

**Slot:** the default slot accepts direct `<lr-video>` children. Nested videos and other elements
are not playlist items.

**CSS parts:** `base` and `video-playlist` (aliases on the same root node), `playlist`,
`playlist-duration`, `playlist-item`, `playlist-thumbnail`, and `playlist-title`.

**Themeable custom properties:** `--lr-video-playlist-item-current-border-color` (default
`var(--lr-color-brand)`) and `--lr-video-playlist-item-current-background` (default
`var(--lr-color-brand-fill-quiet)`) style the active playlist row.

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
`next()`/`previous()`/`goTo()` and auto-advance step past it, and its playlist row renders `disabled`
and `tabindex="-1"` so neither sequential nor optional-arrow focus can land on it — an inert element
refuses focus, which would leave `focus()` a silent no-op and kill the next arrow press. `<lr-video>`
has no `disabled`
property; use the platform `inert` state exclusively. Only the child's **own** `inert` counts: a
playlist inerted wholesale by an open modal keeps playing. The attribute is watched live, so
marking the _current_ video inert moves the selection to the nearest enabled child (emitting
`lr-video-change`) and hands optional-arrow focus to the row that replaced it, instead of leaving a
stale arrow-navigation cursor on a row that can no longer take focus.

Only the native `ended` notification drives `autoAdvance`/repeat completion. A native `error`
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
  `getAnimationNames(): unknown`
  `getEasingNames(): unknown`

- **`components-media-attachment-chip-attachment-chip-contracts`** — Supporting data types and helpers for this component family.
  `LyraAttachmentIdDetail {
  attachmentId: unknown;
}`
  `LyraAttachmentPreviewRequestDetail {
  name: unknown;
  mimeType: unknown;
  src: unknown;
  attachmentId: unknown;
}`

- **`components-media-attachment-trigger-attachment-trigger-contracts`** — Supporting data types and helpers for this component family.
  `LyraAttachmentFilesDetail {
  capability: unknown;
  files: unknown;
}`

- **`components-media-av-player-av-metadata-contracts`** — Supporting data types and helpers for this component family.
  `LyraAvCue {
  cueId: unknown;
  start: unknown;
  end: unknown;
  text: unknown;
  speaker: unknown;
}`
  `LyraAvTrack {
  src: unknown;
  kind: unknown;
  srclang: unknown;
  label: unknown;
  default: unknown;
}`

- **`components-media-av-player-av-player-contracts`** — Supporting data types and helpers for this component family.
  `LyraAvCueChangeDetail {
  cueId: unknown;
  index: unknown;
}`

- **`components-media-avatar-group-avatar-group-contracts`** — Supporting data types and helpers for this component family.
  `LyraAvatarGroupOverflowDetail {
  hiddenCount: unknown;
  hiddenAvatars: unknown;
}`

- **`components-media-avatar-avatar-contracts`** — Supporting data types and helpers for this component family.
  `LyraAvatarErrorDetail {
  image: unknown;
}`

- **`components-media-file-icon-file-type-metadata-contracts`** — Supporting data types and helpers for this component family.
  `createFileTypeMetadataRegistry(/* public names: entries */): unknown`
  `getFileTypeMetadata(/* public names: mimeType, fileName */): unknown`
  `LyraFileTypeMetadataEntry {
  mimeTypes: unknown;
  metadata: unknown;
}`
  `LyraFileTypeMetadata {
  label: unknown;
  description: unknown;
  icon: unknown;
  category: unknown;
  extensions: unknown;
}`
  `LyraFileTypeMetadataRegistry {
  resolve: unknown;
  mimeType: unknown;
  fileName: unknown;
}`
  `LyraResolvedFileTypeMetadata {
  provenance: unknown;
  label: unknown;
  description: unknown;
  icon: unknown;
  category: unknown;
  extensions: unknown;
}`

- **`components-media-file-input-file-input-contracts`** — Supporting data types and helpers for this component family.
  `LyraFileInputFilesDetail {
  files: unknown;
  rejected: unknown;
}`
  `LyraFileInputObjectValidator {
  observedAttributes: unknown;
  checkValidity: unknown;
  input: unknown;
  message: unknown;
}`
  `LyraFileInputObjectValidatorResult {
  message: unknown;
  isValid: unknown;
  invalidKeys: unknown;
}`
  `LyraFileInputRejectedFile {
  file: unknown;
  reason: unknown;
}`

- **`components-media-flag-flag-peer-bulk-standard-contracts`** — Supporting data types and helpers for this component family.
  `registerLyraFlagStandardBulkPeer(): unknown`

- **`components-media-flag-flag-peer-bulk-contracts`** — Supporting data types and helpers for this component family.
  `registerLyraFlagBulkPeer(): unknown`

- **`components-media-flag-flag-peer-contracts`** — Supporting data types and helpers for this component family.
  `registerLyraFlagPeer(): unknown`

- **`components-media-flag-flag-contracts`** — Supporting data types and helpers for this component family.
  `loadFlagUrl(/* public names: importFlags */): unknown`
  `loadBulkFlagUrl(/* public names: importFlags */): unknown`
  `setFlagUrlResolver(/* public names: value */): unknown`

- **`components-media-flag-language-map-contracts`** — Supporting data types and helpers for this component family.
  `alpha3ToAlpha2(/* public names: code */): unknown`
  `languageToCountry(/* public names: language */): unknown`
  `localeNativeName(/* public names: tag */): unknown`

- **`components-media-image-viewer-image-viewer-contracts`** — Supporting data types and helpers for this component family.
  `LyraImageRegionRect {
  x: unknown;
  y: unknown;
  width: unknown;
  height: unknown;
}`

- **`components-media-lightbox-lightbox-contracts`** — Supporting data types and helpers for this component family.
  `LyraLightboxHideDetail {
  source: unknown;
}`
  `LyraLightboxImage {
  src: unknown;
  alt: unknown;
  caption: unknown;
}`

- **`components-media-map-map-loader-contracts`** — Supporting data types and helpers for this component family.
  `loadMaplibre(): unknown`
  `MapLibreGeoJsonDiff {
  remove: unknown;
  add: unknown;
  update: unknown;
  id: unknown;
  addOrUpdateProperties: unknown;
  key: unknown;
  value: unknown;
  removeProperties: unknown;
}`
  `MapLibreGeoJsonSource {
  setData: unknown;
  data: unknown;
  updateData: unknown;
  diff: unknown;
}`
  `MapLibreMapCapability {
  getCanvas: unknown;
  getCenter: unknown;
  lng: unknown;
  lat: unknown;
  getZoom: unknown;
  setCenter: unknown;
  center: unknown;
  setZoom: unknown;
  zoom: unknown;
  resize: unknown;
  setMaxBounds: unknown;
  bounds: unknown;
  remove: unknown;
  on: unknown;
  type: unknown;
  listener: unknown;
  event: unknown;
  error: unknown;
  point: unknown;
  lngLat: unknown;
  once: unknown;
  setStyle: unknown;
  style: unknown;
  getSource: unknown;
  id: unknown;
  addSource: unknown;
  source: unknown;
  removeSource: unknown;
  getLayer: unknown;
  addLayer: unknown;
  layer: unknown;
  removeLayer: unknown;
  setPaintProperty: unknown;
  layerId: unknown;
  name: unknown;
  value: unknown;
  queryRenderedFeatures: unknown;
  options: unknown;
  layers: unknown;
}`
  `MapLibreMarkerCapability {
  setLngLat: unknown;
  lngLat: unknown;
  setPopup: unknown;
  popup: unknown;
  getPopup: unknown;
  addTo: unknown;
  map: unknown;
  remove: unknown;
  getElement: unknown;
}`
  `MaplibreModule {
  Map: unknown;
  Marker: unknown;
  color: unknown;
  Popup: unknown;
  offset: unknown;
}`
  `MapLibrePopupCapability {
  setHTML: unknown;
  html: unknown;
  setText: unknown;
  text: unknown;
  on: unknown;
  type: unknown;
  listener: unknown;
  isOpen: unknown;
  getElement: unknown;
}`

- **`components-media-map-map-contracts`** — Supporting data types and helpers for this component family.
  `buildGeoJsonPropertyDiff(/* public names: previous, next */): unknown`
  `LyraMapChoroplethLayer {
  sourceId: unknown;
  geojson: unknown;
  field: unknown;
  stops: unknown;
  interpolation: unknown;
  stepBaseColor: unknown;
}`
  `LyraMapClusterOptions {
  radius: unknown;
  maxZoom: unknown;
  radiusSteps: unknown;
  colorSteps: unknown;
  countFont: unknown;
}`
  `LyraMapGeoJsonDataLayer {
  sourceId: unknown;
  geojson: unknown;
  tone: unknown;
  color: unknown;
  strokeColor: unknown;
  kind: unknown;
  heatmap: unknown;
  cluster: unknown;
}`
  `LyraMapHeatmapOptions {
  weightField: unknown;
  weightRange: unknown;
  stops: unknown;
  radius: unknown;
  intensity: unknown;
  opacity: unknown;
}`
  `LyraMapInstance {
  getCanvas: unknown;
  getCenter: unknown;
  lng: unknown;
  lat: unknown;
  getZoom: unknown;
  setCenter: unknown;
  center: unknown;
  setZoom: unknown;
  zoom: unknown;
  resize: unknown;
  setMaxBounds: unknown;
  bounds: unknown;
}`
  `LyraMapLegendEntry {
  color: unknown;
  label: unknown;
  pattern: unknown;
}`
  `LyraMapLegendProjection {
  inputCount: unknown;
  renderedCount: unknown;
  omittedCount: unknown;
  truncatedLabelCount: unknown;
  truncated: unknown;
}`
  `LyraMapMarker {
  id: unknown;
  lngLat: unknown;
  color: unknown;
  label: unknown;
  unsafeHtml: unknown;
}`
  `LyraMapMarkerActivationDetail {
  id: unknown;
  lngLat: unknown;
  marker: unknown;
  source: unknown;
}`
  `LyraMapStyleSpecification {
  version: unknown;
  sources: unknown;
  layers: unknown;
  name: unknown;
  sprite: unknown;
  id: unknown;
  url: unknown;
  glyphs: unknown;
}`

- **`components-media-media-card-media-card-contracts`** — Supporting data types and helpers for this component family.
  `LyraMediaCardOpenDetail {
  src: unknown;
  filename: unknown;
}`

- **`components-media-sequence-playback-sequence-playback-contracts`** — Supporting data types and helpers for this component family.
  `LyraSequencePlaybackStepDetail {
  currentIndex: unknown;
}`

- **`components-media-video-playlist-video-playlist-contracts`** — Supporting data types and helpers for this component family.
  `LyraVideoPlaylistChangeDetail {
  previousIndex: unknown;
  currentIndex: unknown;
  video: unknown;
}`
  `LyraVideoPlaylistItem {
  title: unknown;
  poster: unknown;
  duration: unknown;
  unavailable: unknown;
}`
  `LyraVideoPlaylistSource {
  src: unknown;
  type: unknown;
  media: unknown;
}`
  `LyraVideoPlaylistTrack {
  src: unknown;
  kind: unknown;
  srclang: unknown;
  label: unknown;
  default: unknown;
}`
  `LyraVideoPlaylistVideo {
  title: unknown;
  poster: unknown;
  sources: unknown;
  tracks: unknown;
}`

- **`components-media-video-video-contracts`** — Supporting data types and helpers for this component family.
  `VideoState {
  playing: unknown;
  currentTime: unknown;
  duration: unknown;
  volume: unknown;
  muted: unknown;
  playbackRate: unknown;
}`
