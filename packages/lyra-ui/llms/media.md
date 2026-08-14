## `lr-flag`

Country/language flag image. Flag artwork ships in a **separate, optional peer package**
(`@aceshooting/lyra-flags`) — importing `lyra-ui` core never pulls in flag image weight.

**Properties:**
- `country?: string` (ISO 3166-1 alpha-2, e.g. `"fr"` — takes precedence over `language`)
- `language?: string` (BCP-47-ish tag, e.g. `"en"`/`"en-US"`, resolved to a representative country
  via `languageToCountry()`)
- `src?: string` (a pre-resolved flag image URL — takes precedence over `country`/`language` and
  skips the peer-package lookup/loading-skeleton round trip entirely; mainly useful to avoid even
  the small per-flag async hop when you already have the URL at build time, e.g. from
  `import frUrl from '@aceshooting/lyra-flags/flags/fr.svg?url'`. `label` is effectively required
  alongside `src` since there's no `country`/`language` to derive a fallback `alt` from.)
- `label?: string` (accessible name / `alt` text — **defaults to a localized, human-readable region
  name derived from the *resolved country* code via `Intl.DisplayNames` if omitted**, see gotchas)
- `accessibleLabel: string | null = null` (attribute `aria-label`) — takes precedence over `label`
  and the derived region name; an explicit empty value marks the image decorative
- `round: boolean = false` (reflected — circular crop)
- `variant?: 'compact' | 'standard' | 'detailed'` (attribute `variant`, not reflected — picks a
  fidelity tier for the ~65 codes whose source art embeds a coat of arms/seal/emblem; every other
  code resolves to the same file regardless of `variant`. `'compact'` = a tiny WebP raster for
  icon-scale use (menus, language pickers, ~12–28px); `'standard'` (the effective default, when
  `variant` is unset) = the icon-optimized vector for card/row sizes (~28–96px); `'detailed'` = the
  pristine full-fidelity vector for hero-scale display. No effect when `src` is set.)

**Removed in 8.0.0:** the boolean `detailed` attribute. `variant="detailed"` selects the same tier.
A leftover `detailed` is now an unknown attribute — it renders the `standard` tier silently, so
rewrite it rather than leaving it in place.

**Events:** none.

**Slots:** none.

**CSS parts:** `image` (the underlying `<img>`, present only once a URL has resolved), `error`
(ordinary localized visible text rendered instead when the peer resolver is unavailable or rejects)

**Themeable custom properties:** `--lr-flag-radius` (default `calc(var(--lr-radius) * 0.33)` —
non-`round` corner radius), `--lr-flag-aspect-ratio` (default `4 / 3`), and
`--lr-flag-object-fit` (default `cover`); also consumes `--lr-color-border` for the inset ring.

**Optional peer deps:** `@aceshooting/lyra-flags` — required for the component to actually render an
image when `country` or `language` is used. Import
`@aceshooting/lyra-ui/components/media/flag/flag-peer.js` once to opt into
that resolver; a pre-resolved `src` works without the peer registration entry. If the peer is not
installed, the component fails closed with localized visible `[part="error"]` text and a shared
light-DOM assertive announcement (see gotchas).

Also exported from the package root:
`languageToCountry(language: string): string | undefined` and the `LANGUAGE_TO_COUNTRY` lookup
table (region subtag wins, e.g. `en-US` → `us`; plain `en` → `gb`; override the table per-app if you
need different defaults), plus `localeNativeName(tag: string): string`.

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
pronounces the endonym in its own language, and use `variant="compact"` at icon scale.

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
import { localeNativeName, languageToCountry } from '@aceshooting/lyra-ui/components/media/flag/language-map.js';

const rows = ['en', 'fr', 'de', 'pt-BR', 'ja', 'ar'].map((tag) => ({
  tag,
  name: localeNativeName(tag),   // endonym, e.g. "português (Brasil)"
  country: languageToCountry(tag), // flag code for the same row
}));
```

```html
<lr-flag country="fr" label="France"></lr-flag>
<lr-flag language="en-US" round></lr-flag>
<lr-flag country="es" variant="compact"></lr-flag>  <!-- tiny WebP raster, icon-scale -->
<lr-flag country="es" variant="detailed"></lr-flag> <!-- pristine full-fidelity vector -->
```

```bash
pnpm add @aceshooting/lyra-flags   # required peer — without it, <lr-flag> renders nothing
```

```js
import '@aceshooting/lyra-ui/components/media/flag/flag-peer.js';
```

**Known gotchas:**
- `country`/`language` resolution is opt-in through
  `@aceshooting/lyra-ui/components/media/flag/flag-peer.js`; `all.js`
  registers the component without importing the optional flag asset graph. Requires the optional
  peer `@aceshooting/lyra-flags` to actually render an image; without it the component still shows a
  decorative `<lr-skeleton variant="rect" announce="false">` placeholder while resolving. The
  host exposes `aria-busy="true"`, and ordinary sr-only text preserves the localized `loading`
  label without creating a shadow live region. Resolution failure then **fails closed** into ordinary localized
  `<span part="error">` text (the `flagLoadError` message key, `"Flag unavailable"` by default).
  Each fresh failure appends that same localized message to the document's pre-mounted
  `[data-lr-live-region="assertive"]` sink, so the shadow chrome itself is not live and identical
  retries remain separate additions. The failure also produces a one-time `console.warn`
  once the resolver rejects (lazy `import()`, cached module-wide so the warning fires only once per
  page even with many `<lr-flag>` instances). An *empty* template is a different, non-error outcome:
  the peer resolved fine but returned no URL for that code (e.g. `country="zz"`) — no `[part="error"]`,
  no `<img>`, no warning.
- Rendering is async even when the peer *is* installed: `src` resolves after an `import()` +
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
  import when the deployment artifact must be pruned. If you already have a flag's URL at build
  time, `src` skips the peer-package round trip (and its loading-skeleton flash) entirely.
- 65 of `@aceshooting/lyra-flags`' 249 flags (any whose design includes a detailed coat of
  arms/seal/emblem, e.g. `es`, `pt`, `sv`) ship **three** fidelity tiers, selected via the `variant`
  property (`flagUrl(code, { variant })` under the hood): `"compact"` — a tiny WebP raster for
  icon-scale use (menus, language pickers, dense lists); `"standard"` — the default, the
  icon-optimized vector for card/row sizes, ~84% smaller on average than the pristine source for the
  65 affected codes with no visible fidelity loss at that scale; `"detailed"` — the pristine
  full-fidelity vector, for hero-scale display where the extra illustrative detail is actually
  visible. The other 184 codes resolve to the same file regardless of `variant` — a safe no-op.

**Additional API surface:**

- `part="error"` — Ordinary localized visible text rendered when the optional peer resolver is
  unavailable or fails; the fresh transition is announced by the shared light-DOM assertive sink.

---

## `lr-playback`

Steps an index through `[0, length)` on a fixed interval — play/pause for time-series scrubbing.

**Properties:**
- `length: number = 0`
- `index: number = 0`
- `intervalMs: number = 900` (attribute `interval-ms`)
- `playing: boolean = false` (reflected)
- `loop: boolean = true`
- `hidden: boolean = false` (reflected; re-declared over the native IDL property so Lit's
  change-tracking sees it and auto-pauses on `hidden = true`)

**Methods:** `play()`, `pause()`, `toggle()`, `next()`, `previous()`, `goTo(index: number)` — all
idempotent/clamped; `length <= 1` is a no-op degenerate case. `focus(options?)`, `blur()`, and
`click()` forward to the play button.

**Events:** `lr-play`, `lr-pause` (no detail), `lr-step` (`detail: { index }`, fired on every
tick and manual step); internal `focus`/`blur` are relayed exactly once as owner-realm native
`FocusEvent`s (bubbling and composed, preserving `relatedTarget`), followed by
`lr-focus`/`lr-blur`.

**Slots:** none.

**CSS parts:** `base`, `play-button`, `slider`

The `slider` carries `aria-valuetext` — a localized `Step {index} of {total}` (key
`playbackStepPosition`, both numbers formatted with the component's effective locale) — so a screen
reader announces "Step 4 of 10" rather than the bare zero-based index the range input holds.

**Themeable custom properties:** `--lr-playback-icon-size` (default
`calc(var(--lr-icon-button-size) * 0.35)` — the play/pause glyph's size; applied as the button's
`font-size`, and the inline SVG renders at `1em`).
`--lr-playback-play-button-active-bg` (default
`color-mix(in oklab, var(--lr-color-surface), var(--lr-color-mix-partner) var(--lr-color-mix-active))`) —
the pressed play/pause background; and `--lr-playback-play-button-active-border-color` (default
`var(--lr-color-brand)`) — its pressed border. Both are inline `var()` fallbacks, so a value set on
the element or an ancestor inherits without being shadowed by a host default. Plus shared tokens `--lr-space-s`,
`--lr-color-border`, `--lr-color-surface`, `--lr-color-text`, `--lr-color-brand`,
`--lr-icon-button-size` (the play button's box), `--lr-opacity-disabled` (play button/slider
dimming at `length <= 1`), `--lr-focus-ring-*`.

**Optional peer deps:** none.

```html
<lr-playback length="24" interval-ms="500"></lr-playback>
<script>
  const pb = document.querySelector('lr-playback');
  pb.addEventListener('lr-step', (e) => renderFrame(e.detail.index));
</script>
```

**Known gotchas:**
- `index` is now re-clamped into `[0, length)` as soon as `length` shrinks (in `willUpdate()`, not
  waiting for the next `tick()`/`goTo()`/`next()`/`previous()` call) — setting `el.length = 2` while
  `el.index = 7` immediately pulls `index` back to `1`, and playback auto-pauses if `length` drops
  to `<= 1` while playing (the play button and slider would otherwise both become disabled with no
  way to stop it — both are `?disabled` whenever `length <= 1`, not just the button).
- `intervalMs` is live-reactive mid-playback: ticking is a self-rescheduling `setTimeout` (not one
  long-lived `setInterval`), so `intervalMs` is re-read fresh before every tick — changing
  `interval-ms` while `playing` takes effect on the very next step instead of only after a
  pause/play cycle.
- `length` and `index` are normalized to finite non-negative integer counts, with `index` clamped
  into `[0, length)`; fractional, negative, `NaN`, infinite, and oversized values cannot poison
  end conditions or the slider.
- `interval-ms` is clamped to the 16ms floor and the browser's finite timer ceiling: a non-finite or
  lower value ticks at 16ms, while an oversized value uses the timer ceiling. Each distinct invalid
  value is warned once (deduplicated per value, not a single once-ever flag).
- No *visible* "N of M" position label beside the range input (the `aria-valuetext` above covers
  the screen-reader case only).
- Calling `play()`/`pause()` programmatically (not via the button) gives no `aria-live`
  announcement of the Play/Pause state change.

---

## `lr-map`

A `maplibre-gl` wrapper with a declarative legend, a single choropleth GeoJSON fill layer, markers,
and additive plain-GeoJSON `dataLayers`, plus a peer-neutral `map` getter for common imperative
operations. Its runtime value is the underlying MapLibre map.

**Properties:**
- `center: [number, number] = [0, 0]`
- `zoom: number = 2`
- `mapStyle: LyraMapStyleSpecification | string = DEFAULT_STYLE` (attribute: false) —
  `LyraMapStyleSpecification` is the peer-neutral structural subset accepted from MapLibre's
  `StyleSpecification`, including its string or multi-sprite form. The default is a
  basic OSM raster tile style pointing at **OpenStreetMap's shared demo tile server**. Fine for
  local development, but its usage policy forbids bulk/production traffic, requires an identifying
  User-Agent, and rate-limits or IP-blocks non-compliant clients
  (https://operations.osmfoundation.org/policies/tiles/). **Production apps must pass their own
  `mapStyle`** — a hosted vector/raster style from a tile provider you have a plan with.
- `legend: LegendEntry[] = []` (attribute: false) — `LegendEntry { color: string; label: string }`
  (discrete swatch rows only, no continuous gradient bar)
- `choropleth?: ChoroplethLayer` (attribute: false) — `ChoroplethLayer { sourceId: string; geojson:
  GeoJSON.FeatureCollection; field: string; stops: [number, string][] }` (interpolated
  fill-color expression from `field`'s value against `stops`; `stops` must contain at least one
  `[value, color]` pair — an empty array is ignored, leaving whatever fill layer already exists, if
  any, untouched, rather than being applied)
- `markers: MapMarker[] = []` (attribute: false) — `MapMarker { id?: string; lngLat: [number,
  number]; color?: string; label?: string; unsafeHtml?: string }`; reconciled by `id` (falling back
  to a `lng,lat` key, disambiguated by occurrence order for duplicate-coordinate id-less markers,
  when `id` is omitted) so an unchanged marker isn't torn down and recreated on every `markers`
  reassignment — its `lngLat` **and** its popup content (`unsafeHtml`/`label`, in that precedence)
  are both updated in place, and the popup is removed if a later update sets neither. `unsafeHtml` is
  rendered via `Popup.setHTML()` — **raw markup, inline event handlers included** — only pass trusted
  content, sanitize anything derived from user input first; prefer `label` (`Popup.setText()`,
  escaped) when the content is plain text. A marker whose `color` changes for a persisting `id`
  can't be recolored in place (no `Marker.setColor()`) and is torn down/reconstructed instead — see
  gotchas. Entries with non-finite coordinates or latitude outside `[-90, 90]` are skipped without
  aborting valid siblings. `color` is used only when the browser accepts it as CSS `color`;
  declaration breaks and `url()` paint servers fall back to MapLibre's default marker color.
- `dataLayers: GeoJsonDataLayer[] = []` (attribute: false) — `GeoJsonDataLayer { sourceId: string;
  geojson: GeoJSON.Feature | GeoJSON.FeatureCollection; tone?: 'accent' | 'success' | 'warning' |
  'danger' | 'neutral' }`. Each entry adds one GeoJSON source plus three geometry-filtered layers
  (fill, line, and circle, so a mixed `FeatureCollection` renders correctly), colored from the
  matching `--lr-color-*` token (`tone` defaults to `'accent'` → `--lr-color-brand`). The component
  assigns collision-free private MapLibre ids for those resources: `sourceId` is the stable
  declarative reconciliation key, **not** an id to retrieve from `map`. This prevents a data layer
  from overwriting or removing a same-named source supplied by `mapStyle`. Independent of
  `choropleth` — no `field`/`stops` color-interpolation, just the geometry rendered in a flat tone;
  use `choropleth` instead when you need a data-driven color ramp. An entry whose `sourceId`
  persists across a `dataLayers` reassignment gets its GeoJSON updated in place (`setData()`), one
  that's dropped has its private source/layers removed, and a genuinely new `sourceId` gets new
  resources — nothing leaks on removal, style change, or disconnect.
- `label: string = ''` — accessible-name fallback for MapLibre's actual focusable canvas. A plain
  host `aria-label` takes precedence over `label`; with neither set, the canvas uses the localized
  `'map'` message. The non-semantic `[part="base"]` wrapper is not named instead.

**Getters:** `map: LyraMapInstance | undefined` → the underlying runtime `maplibregl.Map`, exposed
through the peer-neutral `getCanvas()`, `getCenter()`, `getZoom()`, `setCenter()`, `setZoom()`, and
`resize()` subset so merely importing Lyra does not require `maplibre-gl` declarations. A consumer
that installed the optional peer and needs its full imperative API can explicitly narrow the runtime
value to `maplibregl.Map`.

**Methods:** `LyraMap.preload(): Promise<boolean>` is a static optional-peer warm-up that starts the
shared `maplibre-gl` import without constructing a map or allocating a WebGL context. It resolves to
`false` when the peer is unavailable, allowing an application to choose a fallback before connecting
an element.

**Events:** `lr-map-load` (fired once, after the underlying map's own `'load'`), `lr-map-click`
(`detail: { lngLat: [lng, lat], feature? }` — feature only populated if a choropleth fill layer
exists and was hit)

**Slots:** none.

**CSS parts:** `base`, `container`, `legend`, `legend-swatch`, `popup-close-button`, `error`.
`popup-close-button` is the MapLibre-generated close control on an open marker popup. `error` is
ordinary localized visible text rendered in place of `container` if the optional `maplibre-gl` peer
dependency fails to load, e.g. not installed. The post-mount failure is appended to the document's
pre-mounted `[data-lr-live-region="assertive"]` sink rather than making shadow chrome live.

**Themeable custom properties:**
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
  import { setWorkerUrl } from 'maplibre-gl';
  import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
  setWorkerUrl(workerUrl);

  const m = document.querySelector('lr-map');
  m.choropleth = {
    sourceId: 'regions',
    geojson: myGeoJson,
    field: 'value',
    stops: [[0, '#cde2fb'], [100, '#0969da']],
  };
  m.legend = [{ color: '#cde2fb', label: 'Low' }, { color: '#0969da', label: 'High' }];
  m.markers = [{ lngLat: [2.29, 48.86], label: 'Eiffel Tower' }];
  m.addEventListener('lr-map-click', (e) => console.log(e.detail.feature?.properties));
</script>
```

Webpack, esbuild, Rollup, and direct-browser ESM use different worker URL forms; use MapLibre's ESM
installation guide for the matching setup:
https://maplibre.org/maplibre-gl-js/docs/#esm.

**Known gotchas:**
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
- A marker uses `label` as its accessible name, falling back to the localized map label. Popup
  ownership is exposed through `aria-controls`/`aria-expanded`; an open popup is a named
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
- `LegendEntry.color` is validated against a strict CSS-color-syntax allowlist before being applied
  to the legend swatch's `background`, rejecting anything that isn't recognizable color syntax
  (notably `url(...)`, which `background` also accepts and would otherwise fetch as soon as the
  swatch renders).
- while the `maplibre-gl` peer is resolving, the host/base expose `aria-busy="true"` and show a
  decorative `<lr-skeleton variant="rect" announce="false">` in place of the map container.
  Ordinary sr-only text preserves the localized `loading` label without creating a shadow live
  region.
- construction of the real `maplibregl.Map` (and its WebGL context) is additionally gated on this
  element being observed intersecting the viewport (`IntersectionObserver`), independent of whether
  the `maplibre-gl` peer has already loaded — an off-screen `<lr-map>` swaps its skeleton for the
  empty `[part="container"]` div as soon as the peer resolves, but `map` stays `undefined` and
  `lr-map-load` never fires until the element is actually scrolled into view. Deliberate: caps
  concurrent WebGL contexts when many `<lr-map>`s sit in one dashboard/grid. Skipped entirely
  (constructs immediately once the peer loads) when `IntersectionObserver` itself is unavailable.

---

## `lr-file-input`

A form-associated drag-drop + click-to-browse file dropzone. It stores and renders raw `File[]`;
no client-side CSV/XLSX/etc. parsing is performed (that's left entirely to the host).

**Properties:**
- `multiple: boolean = false` (reflected)
- `disabled: boolean = false` (reflected)
- `files: File[] = []` — selected files; programmatic writes are event-silent and immediately
  synchronize rendering, validity, and form submission
- `fileCount: number = 0` and `dragging: boolean = false` — writable public state. Assigning
  `files` resynchronizes `fileCount` to the selected-file count; the next real drag event resumes
  ownership of `dragging` and its accept/reject state.
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
- `allowedMimeTypes: string[] = []` (attribute: false) — exact MIME-string allowlist
- `forbiddenMimeTypes: string[] = []` (attribute: false) — exact MIME-string denylist, checked
  **before** (and takes precedence over) `allowedMimeTypes`
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
  localized generic message rather than escaping into the caller. `checkValidity()` and
  `reportValidity()` recompute at call time, so a validator that starts failing without any host
  property changing is still seen. Own or fieldset-cascaded `disabled` bars configured validators
  exactly as it bars the intrinsic constraint. Exported types:
  `LyraFileInputValidator`, `LyraFileInputValidatorResult`, `LyraFileInputObjectValidator`,
  `LyraFileInputObjectValidatorResult`.
- `validationTarget: HTMLElement | undefined` — the focusable base of the dropzone control after
  first render. Assign another shadow descendant to override where native constraint-validation UI
  is anchored; assign `undefined` to restore the default focusable base
- `accessibleLabel: string = ''` (attribute `aria-label`) — overrides `label` as the internal
  dropzone/button accessible name without changing visible copy
- `acceptedMessage: string = '{count} file(s) added.'` (attribute `accepted-message`) — live-region
  message after an accepted selection; `{count}` is replaced with the accepted count
- `rejectedMessage: string = '{count} file(s) rejected.'` (attribute `rejected-message`) — live-region
  message after rejected files; `{count}` is replaced with the rejected count

**Methods:** `openPicker()` programmatically opens the native file dialog; `focus(options?)`,
`blur()`, and `click()` forward to the interactive dropzone. Standard FACE methods are
`getForm()`, `checkValidity()`, `reportValidity()`, `setCustomValidity(message)`, and
`resetValidity()`; reset clears only consumer custom validity and restores current intrinsic
`required` validity.

**Events:** a user selection or removal emits native bubbling/composed `input`, then `change`;
programmatic `files` writes are silent. `lr-files` (`detail: { files: File[], rejected: RejectedFile[] }`, fired on both drop
and manual file-picker selection) — `RejectedFile = { file: File; reason: 'type' | 'count' | 'size' | 'directory'
}`: `'type'` from `accept`/`allowedMimeTypes`/`forbiddenMimeTypes`, `'count'` when a single-file
input (`multiple` unset) receives more than one file (in which case *all* files are rejected, none
accepted), `'size'` from `maxFileSize`, or `'directory'` for a dropped folder. `focus`/`blur` fire
when the semantic dropzone (the actual keyboard-focusable element, not the hidden native `<input>`)
gains/loses focus.
`lr-invalid` is the bubbling/composed alias of native invalidity.

Each rejected file also renders as its own line in the visible `[part="rejection"]` region, naming
the file and the reason via one of four locale keys: `fileInputRejectedType` (default
`'{filename}: this file type is not accepted.'`), `fileInputRejectedSize` (default
`'{filename}: this file is too large.'`), `fileInputRejectedCount` (default `'{filename}: only one
file can be selected at a time.'`), and — for `'directory'` — the pre-existing
`fileInputFolderRejected` (default `'Folders are not accepted here.'`, reused verbatim, so it has no
`{filename}` placeholder). The filename is interpolated as caller-supplied data, never localized
itself. The region is cleared (and unrendered) as soon as a subsequent selection rejects nothing.

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
- **A test that asserted `::part(rejection)` had `role="alert"`, or that read announcements out of
  `::part(status)`, now fails.** Assert against the shared light-DOM region instead — query
  `[data-lr-live-region="assertive"]` (or `"polite"`) in the document, which is also where every
  other Lyra announcement lands.
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
  const input = document.querySelector('#dataset-files');
  input.allowedMimeTypes = ['text/csv'];
  input.addEventListener('lr-files', (e) => {
    console.log('accepted:', e.detail.files, 'rejected:', e.detail.rejected); // rejected[i].reason
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
- Dragged folders are traversed recursively in `multiple` mode with a 10,000-entry budget. An
  over-budget, cancelled, or superseded traversal rejects the complete drop and emits no partial
  `lr-files` result. In single-file mode a folder is reported as `rejected[].reason === 'directory'`
  (paired with a synthetic zero-byte `File` carrying the folder name).
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

**Events:** one native bubbling/composed `input` (`Event`) plus `lr-position-change` (`detail:
{ position }`) after every live range update, and one native bubbling/composed `change` (`Event`)
plus `lr-change` after a gesture commits. `focus`/`blur` are relayed exactly once as owner-realm
native `FocusEvent`s preserving `relatedTarget`, followed by the `lr-focus`/`lr-blur` aliases.

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
  <img slot="before" alt="Before" src="before.png">
  <img slot="after" alt="After" src="after.png">
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
- `allowfullscreen: boolean = false`, `loading: 'eager' | 'lazy' = 'eager'`,
  `referrerpolicy: string = ''`, and `sandbox: string = 'allow-same-origin'` forward the native
  iframe controls after validation. Invalid loading becomes `eager`; an invalid non-empty referrer
  policy becomes `no-referrer`.
- `zoom: number = 1` (reflected) — current scale. Finite programmatic values do not have to occur
  in `zoomLevels`; unsafe/non-finite layout values render as a finite positive fallback.
- `zoomLevels: string = '25% 50% 75% 100% 125% 150% 175% 200%'` (attribute `zoom-levels`) —
  decimal/percentage stops used by the controls, parsed, deduplicated, and sorted.
- `withoutControls: boolean = false`, `withoutInteraction: boolean = false`, and
  `withThemeSync: boolean = false` (reflected attributes `without-controls`,
  `without-interaction`, `with-theme-sync`) — respectively remove the toolbar, remove pointer and
  sequential-keyboard iframe interaction, and opt into best-effort same-origin theme sync.
- `accessibleLabel: string | null` (attribute `aria-label`) — forwarded to the actual iframe
  `title`; otherwise the localized zoomable-frame label names it.
- readonly `iframe?: HTMLIFrameElement`, `contentWindow: Window | null`, and
  `contentDocument: Document | null`. Both content accessors return `null` while detached;
  `contentDocument` also returns `null` across an origin boundary.

**Methods:** `zoomIn()` selects the nearest configured level above the current value;
`zoomOut()` selects the nearest below it. The toolbar also accepts `+`/`=` and `-`/`_` while one
of its controls has focus. `focus(options?)`, `blur()`, and `click()` forward to the internal
iframe — the component's primary interactive surface, still programmatically focusable under
`without-interaction` — rather than to the two-button zoom toolbar, which has no single primary
action.

**Slots:** `zoom-in-icon` and `zoom-out-icon` replace the decorative control glyphs. Their
flattened subtrees are always inert and hidden from assistive technology, so use an SVG or glyph
rather than a second interactive control; the native zoom buttons remain the sole focus and pointer
actions.

**Events:** internal `focus`/`blur` from the iframe are relayed exactly once as owner-realm native
`FocusEvent`s (bubbling and composed, preserving `relatedTarget`), followed by
`lr-focus`/`lr-blur`; native `load` and `error` are relayed exactly once from the current iframe
generation as non-bubbling, non-composed `Event` instances. Navigation/source-policy changes
replace the iframe, so a late event from an earlier document is ignored; detached frames do not
notify.

**CSS parts:** `iframe`, `controls`, `zoom-in-button`, and `zoom-out-button`.

**CSS custom properties:** read-only `--lr-zoomable-frame-zoom`, resolved from the `zoom`
property and applied to the internal iframe scale; and `--lr-zoomable-frame-control-hover-background`
(default `var(--lr-color-brand-quiet)`), which colors a zoom control on hover and supplies the base
for its active color.

**RTL behavior:** the scaled iframe is a physical canvas and remains pinned to physical top-left in
both directions. Its zoom controls remain logical interface chrome, so RTL places the toolbar at
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
import '@aceshooting/lyra-ui/components/media/zoomable-frame/zoomable-frame.js';
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
- `src: string = ''` and `alt: string = ''` — optional safe image source; otherwise the default
  slot renders
- `accessibleLabel: string | null` (attribute `aria-label`) — names the region and its focusable
  viewport

**Methods:** `zoomIn()`, `zoomOut()`, and `resetZoom()` update zoom and emit `lr-zoom-change`
(`detail: { zoom }`). `resetZoom()` preserves pan; `resetView()` also scrolls the viewport to the
origin. The viewport accepts `+`/`=`, `-`/`_`, and `0`, without consuming keys from a slotted editor.

**Slots:** default — inspected content, ignored while `src` renders an image.

`focus(options?)`, `blur()`, and `click()` forward to the scrollable `viewport`, which is the
component's own keyboard target — a bare host `.focus()` would otherwise be a silent no-op.

**Events:** `lr-zoom-change` (`detail: { zoom }`); internal `focus`/`blur` from the viewport are
relayed exactly once as owner-realm native `FocusEvent`s (bubbling and composed, preserving
`relatedTarget`), followed by `lr-focus`/`lr-blur`.

**CSS parts:** `base`, `viewport`, `content`, `controls`, `zoom-out`, `zoom-in`, and `reset`. The
`reset` button's visible text is the live zoom percentage, locale-formatted and recomputed from
`zoom` on every render (not a fixed "100%").

**Themeable custom properties:** `--lr-pan-zoom-min-block-size` (default `var(--lr-size-10rem)`)
and the read-only `--lr-pan-zoom-zoom`. The former `--lr-zoomable-frame-min-block-size` and
`--lr-zoomable-frame-zoom` names remain temporary fallbacks during the tag migration.

```js
import '@aceshooting/lyra-ui/components/media/pan-zoom/pan-zoom.js';
```

```html
<lr-pan-zoom src="map-preview.png" alt="Map preview" aria-label="Map preview"></lr-pan-zoom>
```

---

## `lr-attachment-chip`

A compact chip representing one file queued for (or already part of) a chat message — used in a
composer's pre-send attachment tray or a sent message's attachments display. Two independent ways
to populate it: set `file` to a real `File` (fresh from a picker/drop), from which `name`/`bytes`/
`mime-type` and the image thumbnail are all auto-derived; or set the plain `name`/`bytes`/
`mime-type`/`thumbnail-src` props instead, for reconstructing a chip from server-persisted
attachment metadata after a page reload, when no real `File` object exists any more. `file` always
wins when both are present. When a real `File` or `preview-src` is available, the chip also offers
a localized preview action that opens `<lr-document-viewer>` using the same effective MIME type.

**Properties:**
- `file?: File` (attribute `false`, i.e. property-only) — when set, `name`/`bytes`/`mimeType`/the
  image thumbnail are all derived from it, taking precedence over the independent props below
- `name: string = ''` — filename, used only while `file` is unset
- `bytes: number = 0` — file size in bytes, used only while `file` is unset
- `mimeType: string = ''` (attribute `mime-type`) — used only while `file` is unset
- `thumbnailSrc: string = ''` (attribute `thumbnail-src`) — thumbnail image URL, used only while
  `file` is unset; rendered whenever present regardless of `mimeType` (no `file`-derived equivalent
  exists for a non-image file)
- `previewSrc: string = ''` (attribute `preview-src`) — source URL used for preview and download when
  `file` is unset; a real `File` takes precedence and uses a temporary blob URL
- `previewable: boolean = true` (reflected) — shows the preview action whenever a `file` or
  `preview-src` is available
- `status: AttachmentChipStatus = 'pending'` (reflected) — `'pending' | 'uploading' | 'error' |
  'done'`; drives the accent tint and which of `progress`/`spinner`/`retry-button` renders
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
- `removeLabel: string = 'Remove'` (attribute `remove-label`) — verb used in the remove button's
  accessible name; the default routes through the complete localized `removeWithContext` template
- `retryLabel: string = 'Retry'` (attribute `retry-label`) — verb used in the retry button's
  accessible name; the default routes through the complete localized attachment template
- `uploadingLabel: string = 'Uploading'` (attribute `uploading-label`) — verb used in the visible
  uploading status; the untouched default uses complete localized messages for progress,
  indeterminate state, and filename context so translators can reorder every value
- `uploadFailedLabel: string = 'Upload failed'` (attribute `upload-failed-label`) — visible status
  text shown for `status="error"`; override for i18n/locale
- `untitledLabel: string = 'Untitled file'` (attribute `untitled-label`) — fallback filename and
  tooltip when neither `file` nor `name` supplies a name

**Renamed in 8.0.0 — breaking:** the byte count is `bytes`, not `size` (same rename as
`lr-file-icon`'s). Everywhere else in this library `size` names a tier on the shared size ladder,
and a numeric byte count answering to the same property name is a collision a consumer only
discovers at runtime. A leftover `size="245000"` is an unknown attribute now: `bytes` stays `0` and
the `size` part renders nothing.

The component identifies *which* attachment a `lr-remove`/`lr-retry` event is about via the
platform's own `id` attribute/property rather than a second, differently-named prop. Set `id="..."`
when you have a stable server-side attachment id; when unset and `file` is set, a stable id is
derived from `` `${file.name}:${file.size}:${file.lastModified}` ``; when neither is available, a
generated internal id is used as a last resort.

**Events:** `lr-remove` (`detail: { id }`, only rendered while `removable`), `lr-retry`
(`detail: { id }`, only rendered while `status="error"`), `lr-preview` (`detail: { id, name,
mimeType, src }`, emitted when the preview action opens the document viewer)

**Slots:** none.

**CSS parts:** `base`, `thumbnail`, `meta`, `name`, `size` (the formatted `bytes` count; the part
keeps its pre-rename name — it is the rendered size *text*, and renaming a part would break shipped
`::part()` rules for no gain), `status-text` (the visible text twin of
the status accent color, so the state is carried in words and not only in color; empty and hidden
for `pending`/`done`), `progress`, `progress-fill`, `spinner` (decorative/`aria-hidden` while the
adjacent `status-text` supplies the wording), `retry-button`, `preview-button`,
`remove-button`

**`status-text` carries no live-region role (public surface change).** It is plain visible text
that stays in the accessibility tree and reads normally once a user reaches the chip. The
interrupting announcement a transition *into* `status="error"` makes — so a screen-reader user not
already focused on the chip still hears an upload failure — goes to the library's shared
**light-DOM** assertive region instead, appended to the consumer's `<body>` and marked
`data-lr-live-region="assertive"`: a live region inside a shadow root is not reliably announced
(JAWS with Firefox ignores one outright). Two consequences worth knowing:

- Only a *transition* into `error` announces. A chip that mounts already failed is history the user
  can read at their own pace, and a retry that fails the same way twice is announced twice rather
  than being a silent no-op. The ticking `uploading` readout announces nothing at all — a live
  region re-announcing every progress tick is noise, not information.
- A test that asserted `::part(status-text)` had `role="alert"` now fails; query
  `[data-lr-live-region="assertive"]` in the document instead. `::part(status-text)` is still the
  styling hook, and still the place to read the visible status wording.

**Themeable custom properties:** `--lr-attachment-chip-accent` (default
`var(--lr-color-text-quiet)`), `--lr-attachment-chip-bg` (default `var(--lr-color-surface)`),
`--lr-attachment-chip-border` (default `var(--lr-color-border)`) — this trio is swapped per
`status` (`uploading` → brand/brand-quiet/transparent, `error` → danger/danger-quiet/transparent,
`done` → success/success-quiet/transparent); `--lr-attachment-chip-compact-thumbnail-size` (default
`1.75rem`), `--lr-attachment-chip-compact-font-size` (default `var(--lr-font-size-xs)`),
`--lr-attachment-chip-compact-gap` (default `0.25rem`) — govern the chip's thumbnail size, text
size, and internal gap while `compact` is set; `--lr-attachment-chip-spinner-duration` (default
`0.8s`) controls the indeterminate rotation and stops under reduced motion; plus shared tokens `--lr-space-xs`, `--lr-space-s`,
`--lr-radius`, `--lr-color-text`, `--lr-color-danger`, `--lr-icon-button-size`,
`--lr-transition-fast`, `--lr-transition-base`, `--lr-focus-ring-width`,
`--lr-focus-ring-color`, `--lr-focus-ring-offset`.

**Optional peer deps:** none.

Also exported from the package root: `formatFileSize(bytes: number): string` — `512` → `"512 B"`
(whole bytes never get a decimal), `2415919` → `"2.3 MB"` (every unit past bytes gets exactly one
decimal place), and a negative or non-finite input (`NaN`, `Infinity`) returns `""` so an unknown
size renders nothing instead of `"NaN B"`.

```html
<lr-attachment-chip name="report.pdf" bytes="245000" mime-type="application/pdf" status="done"></lr-attachment-chip>
<lr-attachment-chip id="att-2" status="uploading" progress="42"></lr-attachment-chip>
<script type="module">
  import { formatFileSize } from '@aceshooting/lyra-ui/components/media/attachment-chip/file-size.js';

  const chip = document.createElement('lr-attachment-chip');
  chip.file = pickedFile; // name/bytes/mime-type/thumbnail all derived from the File
  chip.addEventListener('lr-remove', (e) => removeAttachment(e.detail.id));
  chip.addEventListener('lr-retry', (e) => retryUpload(e.detail.id));
  chip.addEventListener('lr-preview', (e) => console.log(e.detail));
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
- A `0` `bytes` value and an unset `bytes` value are indistinguishable (there's no separate flag for
  "genuinely empty file"); the `size` part is hidden entirely rather than showing a literal `"0 B"`.
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
next to the label in `variant="label"` mode; `0`, the default, renders no size), `label`,
`decorative`, and `variant: 'icon' | 'label'`. A host `aria-label` wins over the computed localized
file-type/size name. `decorative` changes the semantic owner to presentation and renders
`aria-hidden="true"` explicitly.

**Renamed in 8.0.0 — breaking:** the byte count is `bytes`, not `size`. Everywhere else in this
library `size` names a tier on the shared size ladder, and a numeric byte count answering to the
same property name is a collision a consumer only discovers at runtime. A leftover `size="245000"`
is an unknown attribute now: `bytes` stays `0` and the badge silently renders without a size.

**CSS parts:** `base`, `icon`, `label`, and `size` (the part keeps its name — it is the rendered
size *text*, and renaming a part would break shipped `::part()` rules for no gain).

**Themeable custom properties:** `--lr-file-icon-size` (default `var(--lr-size-2rem)` — the
format badge's inline and block size).

**Exports:** `LyraFileTypeMetadata`, `LyraFileTypeIcon`, `LyraFileTypeCategory`,
`getFileTypeMetadata()`, and `registerFileTypeMetadata()` for application-specific mappings.

```html
<lr-file-icon mime-type="application/pdf" variant="label" bytes="245000"></lr-file-icon>
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
- `kind?: 'image' | 'video' | 'file'` (reflected) — explicit format dispatch. Leave unset to
  auto-detect from `mimeType`.
- `mimeType: string = ''` (attribute `mime-type`) — drives auto-detection when `kind` is unset.
- `filename: string = ''` — shown in the file-chip fallback, used as the download link's suggested
  filename, and folded into the accessible name.
- `alt: string = ''` — alt text for the image case (and reused as a video label fallback). Falls
  back to `filename`, then a generic per-kind description.
- `accessibleLabel: string = ''` (attribute `aria-label`) — overrides the localized action name on
  the actual button/link without replacing image alt text or the video control's own label
- `maxHeight: string = ''` (attribute `max-height`) — a CSS length (e.g. `"16rem"`); once set,
  overrides the `--lr-media-card-max-height` custom property for this instance only (applied
  inline on `[part="base"]`, so it reliably wins over a `:host{}`-declared default from outside the
  shadow root) — same contract as `<lr-document-preview>`'s identically-named prop. Values that do
  not parse as CSS `max-height`, contain declaration breaks, or contain `url()` are ignored, leaving
  the stylesheet token in control.
- `frame: 'card' | 'plain' = 'card'` (reflected) — container treatment, on the library-wide `frame`
  vocabulary. `'card'` (the default) keeps the bordered, filled box. `'plain'` removes
  `[part="base"]`'s border, background, padding, and corner radius, so a card inside a dense chat
  transcript (or any container already drawing its own separation between attachments) doesn't
  double the frame.

**Renamed in 8.0.0 — breaking:** this was `appearance`. Library-wide, `appearance` now means only
"how a control fills itself" and `frame` means "whether a container draws itself as a bounded card";
this property was always the second. There is no alias — `appearance` on `<lr-media-card>` is simply
an unknown attribute now, so a card left on `appearance="plain"` silently renders the full card
chrome again.

**Events:** `lr-open` (`detail: { src: string; filename: string }`, cancelable) — fired when the
card (or, for `kind="video"`, its separate `open-button`) is activated. `detail.src` is whichever
safe-URL sink actually rendered (`safeMediaSrc(src) ?? safeLinkHref(src) ?? src.trim()`), not
necessarily the raw `src` property verbatim — a whitespace-padded value is trimmed, so `detail.src`
always matches what the DOM would show if it were safe. This component never navigates on its own
for `image`/`video` — a host decides what "open" means. The `file`-chip case is the exception: when
`src` passes the stricter href safety check, the chip is a real `<a href download>` so a bare
drop-in still does something useful, but `lr-open` fires first — a host calling
`preventDefault()` on it suppresses that default download/open so it can substitute its own
handling.

**Methods:** `focus(options?)`, `blur()`, and `click()` forward to the primary action for the
current media kind.

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
<lr-media-card kind="image" src="https://example.com/photo.jpg" alt="Screenshot" filename="photo.jpg"
  @lr-open=${(e) => openLightbox(e.detail.src)}
></lr-media-card>
<lr-media-card kind="file" src="https://example.com/report.pdf" filename="report.pdf"></lr-media-card>
```

**Safe-URL checking.** `src` is validated (exported as `safeMediaSrc()`/`safeLinkHref()`) before it's
ever assigned to an `<img>`/`<video>` `src` or an `<a href>` — only `http:`/`https:`/`blob:` (plus
`data:` for a *media* `src` only) or a scheme-relative/relative URL with no scheme at all pass;
anything else (`javascript:`, `vbscript:`, and similarly suspicious schemes) is rejected. `data:` is
allowed for `safeMediaSrc()` (a browser never executes script from a media element's `src`) but
rejected by the stricter `safeLinkHref()` (a `data:text/html` URI navigated to via a clicked `<a
href>` runs as a full document and can execute script) — the same scheme gets a different verdict
depending on which DOM sink it's headed for. Both functions delegate to the platform's own `new
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
the video's own native controls bubble up and spuriously fire `lr-open`.

**Known gotchas:**
- Calling the real `.click()` (or dispatching a `click`/`MouseEvent`) on the file-chip's `<a href>`
  in a test genuinely triggers real browser navigation — always `preventDefault()` on a `click`
  listener registered before triggering it, the same precaution `lr-document-preview`'s own
  download-link tests already take. A synthetic `dispatchEvent(new MouseEvent('click', {cancelable:
  true}))` still invokes the anchor's native activation behavior if nothing calls
  `preventDefault()` during dispatch — it is not a safe no-op.
- `kind` only reflects to the host attribute when explicitly set — CSS keying off the
  auto-detected resolved kind should target the rendered `[part]`/element (e.g. `video[part="media"]`),
  not `:host([kind=...])`, since the latter won't see an auto-detected kind.

---

## `lr-attachment-trigger`

A compact attach affordance designed for a chat composer's leading slot (see `lr-chat-composer`'s
own `leading` slot, which this drops straight into, though it has no code dependency on it). First-
party invention (no Web Awesome equivalent). Its shape adapts to how many attachment `capabilities`
are configured: exactly one renders a single plain icon button; more than one renders a small
anchored menu (composed from the already-landed `lr-menu`/`lr-menu-item`) listing each
capability as a row.

**Properties:**
- `capabilities: AttachmentCapability[] = ['files']` (property only, no attribute) — which
  capabilities to offer, in display order. `AttachmentCapability = 'files' | 'image' | 'camera' |
  'audio'`; `FileBackedCapability = 'files' | 'image'` (the two that actually open the file
  picker).
- `accept: string = ''` — a native-file-input-style accept string (e.g. `'image/*'` or
  `'.pdf,.docx'`), forwarded to the hidden file input for the `files`/`image` capabilities. `image`
  defaults it to `'image/*'` unless this prop overrides it; `files` always uses it as-is (empty
  means "any file type").
- `multiple: boolean = true` (reflected) — forwarded to the hidden file input's own `multiple`
  attribute.
- `disabled: boolean = false` (reflected)
- `triggerLabel?: string` (attribute `trigger-label`) — overrides the single-capability trigger
  button's accessible-name fallback, which otherwise comes from the localized capability metadata
  (e.g. `'Attach files'`); only affects the single-capability button (`[part='trigger']`). The
  multi-capability trigger uses its localized `'Add attachment'` fallback. A host `aria-label`
  takes precedence on either trigger shape.
- `triggerTitle?: string` (attribute `trigger-title`) — forwards a sighted-user hover tooltip to
  both the single-capability and multi-capability trigger buttons

**Events:** `lr-pick` (`detail: { capability: 'files' | 'image'; files: FileList }`) — fired once a
file-backed capability's hidden input produces a real selection. The `FileList` is an independent
snapshot (rehomed into a fresh `DataTransfer`), not a live reference to the input's own `.files` —
see the gotcha below for why that distinction matters. `lr-camera-request` and `lr-audio-request`
(both no detail — `detail` is `null`, not `undefined`, per the DOM spec's `CustomEventInit`
default) — fired when the `camera` / `audio` capability is activated; this component implements no
capture UI of its own, the host owns everything from here (there's no single right answer for
`getUserMedia` vs. `<input capture>` vs. a native wrapper's own camera API; for `audio` the
typical host response is opening `<lr-push-to-talk>` in an overlay, then handing the resulting
blob to `<lr-attachment-chip>`). `focus`/`blur` from the active single- or multi-capability trigger
are relayed exactly once as owner-realm native `FocusEvent`s (bubbling and composed, preserving
`relatedTarget`), followed by `lr-focus`/`lr-blur`; the hidden file input is not the focus owner.

**Slots:** none — capabilities are configured entirely via the `capabilities` prop.

**CSS parts:** `trigger` (the single-capability button, only rendered when
`capabilities.length === 1`), `menu` (the `lr-menu` wrapper, only rendered when
`capabilities.length > 1`), `menu-trigger` (the multi-capability button slotted into `lr-menu`'s own
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
<lr-attachment-trigger .capabilities=${['files', 'image', 'camera']} accept=".pdf,.docx"
  @lr-pick=${(e) => queueFiles(e.detail.capability, e.detail.files)}
  @lr-camera-request=${openCameraFlow}
></lr-attachment-trigger>
```

**Known gotchas:**
- `HTMLInputElement.files` is a *live* view in most browsers — clearing `input.value` after reading
  `.files` (needed so re-picking the exact same file still fires another `change` event next time)
  mutates that exact `FileList` object back to empty in place, not just detaches a stale reference.
  A consumer reading `lr-pick`'s `detail.files` even one microtask later (an `async` handler, a
  queued upload) would otherwise observe an empty list — this component avoids that by rehoming the
  selection into a fresh `DataTransfer` before emitting, but any other file-input-adjacent code
  emitting `input.files` directly without that rehoming step has the same latent bug.
- The `camera`/`audio` capabilities never touch the hidden `<input type="file">` at all — both are
  scope-limited by design to firing `lr-camera-request`/`lr-audio-request` and nothing else. The
  hidden input is only rendered when `capabilities` contains `files` or `image`.
- Setting `disabled` closes an open capability menu, disables its items as well as the trigger, and
  discards a native file selection that arrives after the component became disabled.

**Additional API surface:**

- `click()` — Activates the internal attachment trigger.

---

## `lr-avatar`

A small, fixed-size identity marker: default-slotted icon/glyph content, an image, an
`icon`-slotted fallback glyph, or a fallback of initials text — in that priority order, whichever is
set takes over from the next. Mirrors `wa-avatar` / `sl-avatar` (`image`, `initials`, `loading`,
`shape`, the `icon` slot, the image-load error event) and adds this library's shared `size` and
`variant` vocabulary. Purely presentational, with no built-in interactivity; wrap it in a
`<button>`/`<lr-menu>` trigger for a user-menu affordance.

**Properties:**
- `initials: string = ''` — fallback text (typically 1-2 characters), shown whenever no glyph and no
  image is set, or the image fails to load and no `icon` slot content is provided.
- `image: string = ''` — image URL; takes priority over the `icon` slot and `initials` when set and
  loads successfully (but never over default-slotted glyph content), falling back to them on a load
  error. **Renamed from `src` in 8.0.0** to match `wa-avatar`: a mechanical `wa-` → `lr-` rename
  used to leave the property unset, so a migrated avatar silently dropped its photo and rendered
  initials instead.
- `label: string = ''` — upstream-compatible accessible description. A host `aria-label` wins,
  followed by `label`, then the older `alt` compatibility property.
- `alt: string = ''` — compatibility image alt text; set alongside `image` for accessibility, and also the source
  of the accessible name for the glyph and initials cases (the glyph is `aria-hidden`, and the
  initials text is hidden from AT once `alt` supplies a name, so `[part="base"]` carries
  `role="img"` + that name instead).
- host `aria-label` — overrides `alt` as the image/fallback accessible name without changing the
  visible initials or image
- `loading: 'eager' | 'lazy' = 'eager'` (new in 8.0.0) — passthrough to the rendered `<img>`'s
  native `loading` attribute. `'lazy'` defers the request until the avatar approaches the viewport,
  which is worth setting for avatars far down a long list and never for one above the fold. It only
  reaches the DOM while the image tier is the one rendering; the default matches the native default,
  so an avatar that never sets it behaves exactly as it did before the property existed.
- `size: '2xs' | 'xs' | 's' | 'm' | 'l' | 'xl' | 'small' | 'medium' | 'large' | 'sm' | 'md' | 'lg'
  = 'medium'` (reflected) — the library's shared six-step ladder, in either the `s`/`m`/`l` or the
  `small`/`medium`/`large` spelling, plus this component's own older `sm`/`md`/`lg` shorthands.
  Every one of the six tiers renders a distinct diameter — 1rem (`2xs`), 1.25rem (`xs`), 1.5rem
  (`s`/`small`/`sm`), 2rem (`m`/`medium`/`md`, the default), 2.5rem (`l`/`large`/`lg`, which matches
  `--lr-icon-button-size`), 3rem (`xl`) — and the initials font size steps alongside it. The three
  spellings of a tier render identically, and the attribute reflects back whichever one was set
  (`size="lg"` stays `"lg"`). **8.0.0 widened this from `sm`/`md`/`lg` to the full shared ladder**
  and made `medium` the default.
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

**Slots:** default slot — icon/glyph content (e.g. an inline SVG or non-whitespace text/emoji),
shown in place of the image and initials, e.g. to mark a chat avatar as "AI" vs. "user" with a role
glyph. Takes priority over `image`, the `icon` slot, and `initials`. `icon` (new in 8.0.0) — a
fallback glyph shown only when there is no default-slotted content and no loadable `image`; that is
the role `wa-avatar`'s `icon` slot fills, a stand-in for the `initials` text rather than an override
of the photo. Content in either slot is treated as decorative (`aria-hidden`) — set `alt` alongside
it for an accessible name.

**CSS parts:** `base` (the outer circle/rounded/square container), `icon` (wrapper around whichever
glyph slot is currently winning the fallback order — both slots stay mounted so their `slotchange`
handlers keep firing, so this wrapper carries the native `hidden` attribute whenever no glyph is the
winning tier: with neither slot filled, and equally while a loadable `image` is showing over
icon-slot content), `image` (the `<img>`, only rendered while `image` is set, hasn't failed to load, and no
default-slot glyph is provided), `initials` (the initials text, only rendered once every glyph and
image tier ahead of it in the priority order has been ruled out).

**Themeable custom properties:** `--size` is the upstream-compatible diameter and falls back to
`--lr-avatar-size` (default `var(--lr-size-2rem)`, stepped across
the ladder from `var(--lr-size-1rem)` at `2xs` to `var(--lr-size-3rem)` at `xl` — every spelling of
a tier selects the same declarations), `--lr-avatar-bg` (default `var(--lr-color-border)`, swapped
per non-neutral `variant` to that variant's `-quiet` fill; there is no `--lr-color-surface-alt`
token in this library, despite what older copies of this page claimed), `--lr-avatar-color`
(default `var(--lr-color-text)`, swapped per non-neutral `variant` to that variant's loud color),
`--lr-avatar-font-size` (default `var(--lr-font-size-sm)`) — the font size of the initials fallback,
and of any `em`-sized slotted glyph. `size` steps it alongside the diameter (`--lr-font-size-2xs` at
`2xs`/`xs`, `--lr-font-size-xs` at `s`, `--lr-font-size-m` at `l`, `--lr-font-size-lg` at `xl`), so
the initials track the circle instead of staying one fixed size across every tier; override it on
the element for a size the built-in scale doesn't cover. Plus shared tokens `--lr-radius`/`-pill`,
`--lr-font-weight-semibold`.

The variant colors are deliberately **not** the library's generic quiet-fill/on-quiet-text pairing:
an avatar's initials *are* the accent, so they read in the variant's own loud color on that
variant's quiet tint.

**Optional peer deps:** none.

```html
<lr-avatar initials="JS" variant="brand"></lr-avatar>
<lr-avatar image="/users/42/photo.jpg" alt="Jane Smith" size="large" shape="rounded"></lr-avatar>
<lr-avatar alt="Assistant"><svg viewBox="0 0 24 24"><!-- role glyph --></svg></lr-avatar>

<!-- Far down a long list: defer the request, fall back to a glyph, and report a broken URL. -->
<lr-avatar
  image="/users/7/photo.jpg"
  alt="Ada Lovelace"
  loading="lazy"
  @lr-error=${(e) => reportBrokenAvatar(e.detail.image)}
>
  <svg slot="icon" viewBox="0 0 24 24"><!-- fallback glyph --></svg>
</lr-avatar>
```

**Known gotchas:**
- a leftover `src="…"` from a pre-8.0.0 avatar is now inert: nothing errors, the attribute is simply
  not observed, and the avatar renders the `icon` slot or the initials as though no image were set.
  Grep migrated markup for `<lr-avatar` carrying `src`, and rename it to `image`. A leftover
  `tone="…"` fails the same silent way — rename it to `variant`.
- an image load failure falls back to the `icon` slot when it has content, otherwise to `initials`.
  Changing `image` clears the failure state so the replacement URL gets its own load attempt,
  including when a later transition returns to a URL that failed previously.
- when `alt` or host `aria-label` supplies a name, the base preserves that name through the glyph
  and initials fallbacks while hiding duplicate initials text from assistive technology.
- the `icon` slot yields to a loadable `image`; the default slot does not. Put a role glyph that
  must always win in the default slot, and a stand-in for a missing photo in `slot="icon"`.

---

## `lr-animated-image`

An animated GIF/APNG/WebP with a play/pause control, frozen to a captured still frame at rest and
automatically under `prefers-reduced-motion: reduce`.

**Properties:**
- `src: string = ''` — re-validated through `safeMediaSrc()` (same allowlist as `lr-media-card`)
  before reaching the real `<img src>`.
- `alt: string = ''` — falls back to the localized `animatedImageDefaultAlt` when empty; an explicit
  `alt=""` does **not** mark the image decorative.
- `play: boolean = false` — the caller's *intent* (reflected).
- `playing: boolean` (readonly getter, reflected as a `playing` host attribute) — the *effective*
  state after reduced-motion arbitration: `play && !(respectReducedMotion && <OS prefers reduce>)`.
  Assigning to it is a silent no-op; drive playback via `play`.
- `respectReducedMotion: boolean = true` (reflected, attribute `respect-reduced-motion`) — while
  `true` and the OS reports `prefers-reduced-motion: reduce`, playback stays frozen and
  `[part="play-button"]` is `disabled` regardless of `play`.
- `accessibleLabel: string = ''` (attribute `aria-label`) — overrides `[part="play-button"]`'s
  computed Play/Pause label verbatim in *both* states (it does not itself vary by state). Never
  touches the image's `alt`/the canvas's `aria-label`. For state-sensitive custom wording, override
  the `playWithContext`/`pauseWithContext`/`animatedImageDefaultAlt` strings instead.

**Methods:** `focus(options?)` and `blur()` forward to the play/pause button.

**Events:** `lr-load` (the live `<img>` loaded; fires again on every successful `src` change),
`lr-error` (native decode failure, or a non-empty `src` that failed the safe-URL check — never for
an empty `src`), `lr-play`/`lr-pause` (real transitions of the effective `playing` value only, so a
`play = true` that reduced motion blocks emits nothing, while a live reduced-motion change that
forces a freeze does emit `lr-pause`). Internal `focus`/`blur` are relayed exactly once as
owner-realm native `FocusEvent`s (bubbling and composed, preserving `relatedTarget`), followed by
the `lr-focus`/`lr-blur` compatibility aliases.

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
  `threshold: number | number[] = 0` (both attribute: false) plus `rootMargin: string = '0px'`
  (attribute `root-margin`) configure that observer.
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
import '@aceshooting/lyra-ui/components/media/animation/animation.js';
import { setAnimation } from '@aceshooting/lyra-ui/utilities/animation-registry.js';

const animation = document.createElement('lr-animation');
animation.name = 'slide-in-start';
animation.iterations = 1;
animation.innerHTML = '<span>Registry-controlled content</span>';
const release = setAnimation(animation, 'animation.slide-in-start', {
  keyframes: [
    { transform: 'translateX(calc(-1 * var(--lr-size-2rem)))' },
    { transform: 'translateX(0)' },
  ],
  rtlKeyframes: [
    { transform: 'translateX(var(--lr-size-2rem))' },
    { transform: 'translateX(0)' },
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
- `size: AvatarSize = 'medium'` (reflected) — reused verbatim from `<lr-avatar>`'s own union (the
  shared six-step ladder in either spelling, plus the `sm`/`md`/`lg` shorthands) and defaulting to
  the same `'medium'` tier, so a group and the avatars inside it read as one vocabulary. Every tier
  drives the same badge-size/overlap/badge-font-size swap the avatars get.
- `shape: AvatarShape = 'circle'` (reflected) — `'circle' | 'rounded' | 'square'`, also reused from
  `<lr-avatar>`; it shapes the overflow badge only.
- `variant: AvatarVariant = 'neutral'` (reflected) — `'neutral' | 'brand' | 'success' | 'warning' |
  'danger'`; recolors the overflow badge only. **Renamed from `tone` in 8.0.0** alongside
  `<lr-avatar>`'s, with no alias.
- `label: string = ''` — the group's `role="group"` accessible name. A host-level `aria-label` wins
  if both are set; with neither, no `aria-label` is rendered.

**Events:** `lr-overflow-click` (`detail: { hiddenCount: number; hiddenAvatars: LyraAvatar[] }`) —
the badge was activated by click or Enter/Space. Non-cancelable, purely informational: the
component keeps rendering the same collapsed stack, and a host typically wires this to its own
popover/dialog listing the hidden members. There is no `expanded` state and no `aria-expanded`.

**Slots:** default slot — `<lr-avatar>` elements (any content works, but the avatar pairing is the
intended usage). Children past `max` have their native `hidden` attribute set.

**CSS parts:** `base` (the outer inline-flex container holding the slot and the badge),
`overflow-badge` (the "+N" `<button>`; only rendered while `max` is actively overflowing).

**Themeable custom properties:** `--lr-avatar-group-avatar-size` (default `var(--lr-size-2rem)`,
stepped across the same six tiers as `<lr-avatar>`'s `--lr-avatar-size`, from `var(--lr-size-1rem)`
at `2xs` to `var(--lr-size-3rem)` at `xl`), `--lr-avatar-group-overlap` (default
`var(--lr-size-neg-6px)`, swapped per `size`; a logical `margin-inline-start`, so it auto-mirrors
under `dir="rtl"` — setting `0` or a positive length turns the stack into normal spacing),
`--lr-avatar-group-ring-color` (default `var(--lr-color-surface)`),
`--lr-avatar-group-ring-width` (default `var(--lr-border-width-medium)`),
`--lr-avatar-group-badge-bg` (default `var(--lr-color-border)`, swapped per `variant`),
`--lr-avatar-group-badge-color` (default `var(--lr-color-text)`, swapped per `variant`),
`--lr-avatar-group-badge-font-size` (default `var(--lr-font-size-sm)`) — the font size of the "+N"
badge label. `size` steps it per tier alongside the badge diameter, matching `<lr-avatar>`'s own
`--lr-avatar-font-size` scale so the badge and the avatars it caps read at the same optical weight;
override it alongside `--lr-avatar-font-size` on the avatars themselves when tuning a custom tier.

The overflow badge keeps a `--lr-icon-button-size` (2.5rem) minimum activation target at every tier,
including the ones whose avatar circles are smaller than that; this does not change the visible
avatar circles themselves.

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
- `size`/`shape`/`variant` do **not** cascade onto slotted avatars — they only drive this
  component's own ring, overlap, and badge. Each `<lr-avatar>`'s own `--lr-avatar-size` lives in its
  own shadow-scoped `:host` block and unconditionally overrides an inherited value, so set a
  matching `size`/`shape` on both the group and every child.
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
- `open: boolean = false` (reflected) — set this or call `close()`; there is no `show()`/`hide()`.
- `images: LyraLightboxImage[] = []` (attribute: false) — `LyraLightboxImage { src: string; alt?:
  string; caption?: string }`. `src` is passed to the embedded frame, which runs it through
  `safeMediaSrc()`. `alt`/`caption` are caller data, never localized.
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

**Methods:** `next()`, `previous()`, `goTo(index)`, `close(reason?)` — `goTo()` ignores a non-finite
index without changing state or emitting `lr-index-change`. A finite fractional index is truncated
toward zero before clamping or loop wrapping, so `lr-index-change.detail.index` is always the
actual rendered integer index; `reason` defaults to `'api'` and is forwarded as the close event's
detail.

**Events:** `lr-lightbox-close` (`detail: LyraLightboxCloseReason = 'escape' | 'backdrop' |
'close-button' | 'api' | 'unmount' | (string & {})`; **cancelable** — `preventDefault()` blocks
closing on every path, including a consumer's own `close()` call. Also fires with `'unmount'` when
the element is removed from the DOM while still open); `lr-index-change` (`detail: { index }`, fired
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
embedded `<lr-pan-zoom>`; its internal parts are not re-exported), `previous-button`,
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
- keyboard navigation is RTL-aware and bound on `[part="panel"]`, so it also sees keydowns bubbling
  out of the embedded frame's shadow tree: Arrow forward/back (mirrored under `rtl`), `Home`, `End`.
  It never collides with the frame's own `+`/`-`/`0` zoom shortcuts.
- initial focus deliberately goes to `close-button`, not the first tabbable element — a slotted
  `actions` button placed before it does not steal focus.
- zoom/pan reset on navigation is imperative (`resetView()` from `updated()`), not a binding; the
  frame element is reused across navigations rather than recreated, so a keyboard user who tabbed
  into the viewport keeps focus.
- scope for v1: no per-image slotted content (data-driven via `images` only), no dot indicators, no
  open/close transition, no click-image-to-navigate, no touch-swipe.

## `lr-qr-code`

Renders `value` as a QR code using the optional `qrcode` peer dependency. **Properties:** `value`,
`label`, `size` (clamped to `1`–`2048` CSS px), `radius` (clamped to `0`–`0.5`), and
`errorCorrection` (`error-correction`, `L`/`M`/`Q`/`H`, default `H`); `fill` and `background` are
mapped color aliases that take precedence over the equivalent CSS custom properties. `image` accepts
a safe media URL for a centered overlay, `imageBackground` (`image-background`) paints its coverage
box, `imageCoverage` (`image-coverage`, default `0.5`) controls that box as a fraction of the canvas
side, and `imagePadding` (`image-padding`, default `0`) pads the image within it. Image geometry is
finite-number guarded and clamped; supplying a valid image forces error correction to `H` so the
covered modules remain recoverable. Unsafe image URLs are ignored and a failed image load leaves the
base QR symbol intact.

The canvas owns `role="img"`; its accessible name uses host `aria-label`, then `label`, then `value`.
Empty values render an empty state. `generate(): Promise<void>` explicitly re-encodes the current
value. `refreshTheme(): void` redraws cached modules for consumer-owned token changes; ordinary
ancestor theme and color-scheme changes redraw automatically. Async peer and image results are
generation-guarded, including across disconnect/reconnect.
`LyraQrCode.preload(): Promise<boolean>` is a static optional-peer warm-up that starts the shared
`qrcode` import without encoding a value; it resolves to `false` when the peer is unavailable.
**CSS parts:** `base` and `qr-code` are aliases on the same outer wrapper; `canvas`, `empty`,
`loading`, and `error`. **CSS custom properties:**
`--lr-qr-code-fill` and `--lr-qr-code-background`. Ancestor theme-attribute and color-scheme
changes redraw automatically. The mapped `fill`/`background` properties win when non-empty.

`error` is ordinary localized visible text, not a shadow live region. A missing peer or encode
failure appends the localized message to the document's pre-mounted
`[data-lr-live-region="assertive"]` sink; identical retries append distinct children, and sink
ownership is released/reacquired across disconnect or document adoption.

## `lr-image-viewer`

A full pan/zoom raster-image viewer with labeled region highlights and opt-in region annotation, the
landing surface for `region`-anchored citations. Distinct from `<lr-svg-viewer>` (rendered SVG
documents) and `<lr-image-comparer>` (before/after slotted surfaces). Adopts `DocumentAnchorTarget`
with `anchorKinds: ['region']` only — no text selection is bound.

**Properties:** `src: string = ''`, `name: string = ''`, `alt?: string`, `fit: 'contain' | 'width' |
'actual' = 'contain'` (reflected), `zoom: number = 1` (reflected), `minZoom: number = 0.5` (attribute
`min-zoom`), `maxZoom: number = 4` (attribute `max-zoom`), `zoomStep: number = 0.25` (attribute
`zoom-step`) — `minZoom`/`maxZoom`/`zoomStep` are pure pass-throughs to the embedded
`<lr-pan-zoom>` as its own `.minZoom`/`.maxZoom`/`.zoomStep`, which does the actual
clamping/normalizing; same names/defaults as `<lr-lightbox>`'s identical trio, both wrapping the
same pan/zoom surface — `rotation: 0 | 90 | 180 | 270 = 0`
(reflected), and `annotatable: boolean = false` (reflected). The inherited anchor-target surface is
`highlights: LyraHighlight[] = []` (property only; reassign after mutation),
`activeHighlightId: string | null = null` (attribute `active-highlight-id`),
`anchor: LyraAnchor | string | null = null` (property only), and readonly
`anchorKinds: readonly LyraAnchorKind[] = ['region']`.

**Methods:** `rotate()` advances `rotation` by 90°. `zoomIn()`, `zoomOut()`, and `resetZoom()` adjust
the embedded pan-zoom surface's zoom. `scrollToAnchor(target: LyraAnchor | string):
Promise<boolean>` resolves a `region` anchor (or a highlight id) after the image loads, reports
whether it resolved, and makes an id-addressed match active; the complete image is already inside
the pan/zoom viewport, so no additional page scroll is needed.

**Events:** `lr-load` (`detail: { naturalWidth, naturalHeight }`), `lr-zoom-change` (`detail: {
zoom }`), `lr-rotation-change` (`detail: { rotation }`), `lr-fit-change` (`detail: { fit }`),
`lr-highlight-activate` (`detail: { id }`), `lr-annotation-create` (`detail: { anchor }`, kind
`'region'`), `lr-anchor-result` (`detail: { found }`), and `lr-render-error` (`detail: { error
}`).

`lr-text-select` is not part of this raster viewer's event contract because it binds no selectable
text.

**CSS parts:** `base`, `toolbar`, `fit-control`, `rotate-button`, `annotate-toggle`, `frame` (the
embedded `lr-pan-zoom`), `image-wrapper`, `image`, `highlight-layer`, `highlight` (carries
`data-tone`/`data-active`), `highlight-label`, `annotation-box`, and `error`.

`error` is ordinary localized visible text, not a shadow live region. A fresh post-mount image
failure or transition to an unsafe source appends the localized message to the document's
pre-mounted `[data-lr-live-region="assertive"]` sink. An already-unsafe initial `src` remains
visible but does not interrupt on mount; identical later failures append distinct children.

While `annotatable`, `image-wrapper` is a named `role="group"` with the localized annotation hint.
Only `region` highlights whose `rect` contains finite numeric `x`/`y`/`width`/`height` and
nonnegative dimensions are rendered; malformed rectangles are omitted rather than reaching inline
styles or anchor hit testing.

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
`var()` fallbacks at the point of use rather than on `:host`, so each can be set on the element *or
on any ancestor*:
`::part(highlight)[data-active]` is invalid CSS — Shadow Parts forbids an attribute selector after
`::part()` — which previously left overriding the library-wide
`--lr-color-brand`/`--lr-color-brand-quiet` tokens as the only lever, repainting every other
element that read them. Unset, each falls back to the token its rule used before.

## `lr-av-player`

An audio/video player built on a native `<audio>`/`<video>` element, plus a cue transcript synced to
`currentTime`, `time-range` anchor/highlight support, an optional dependency-free waveform (peaks
in, no in-component decoding), and playback-rate control. Owns recorded-media transcript sync —
distinct from `<lr-transcript-feed>` (live captions for an in-progress voice session) and
`<lr-playback>` (an index stepper, no media). Adopts `DocumentAnchorTarget` with
`anchorKinds: ['time-range']` only — no text selection is bound. The transcript virtualizes through
`<lr-virtual-list>` the same way `lr-pdf-viewer` virtualizes pages.

**Properties:** `src: string = ''`, `name: string = ''`, `kind?: 'audio' | 'video'`
(attribute-backed auto-detection override), `mimeType: string = ''` (attribute `mime-type`), `poster: string =
''`, `loop: boolean = false`, `muted: boolean = false`, `preload: 'none' | 'metadata' | 'auto' =
'metadata'`, `playbackRate: number = 1` (attribute `playback-rate`, reflected), `rates: number[] =
[0.75, 1, 1.25, 1.5, 2]` (attribute: false), `cues: LyraAvCue[] = []` (attribute: false), `peaks:
number[] = []` (attribute: false), and `tracks: LyraAvTrack[] = []` (attribute: false). The inherited
anchor-target surface is `highlights: LyraHighlight[] = []` (property only; reassign after
mutation), `activeHighlightId: string | null = null` (attribute `active-highlight-id`),
`anchor: LyraAnchor | string | null = null` (property only), and readonly
`anchorKinds: readonly LyraAnchorKind[] = ['time-range']`.
`LyraAvCue = { id, start, end?, text, speaker? }`; `LyraAvTrack = { src, kind: 'subtitles' |
'captions' | 'descriptions', srclang, label, default? }`.

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
`lr-rate-change` (`detail: { rate }`), `lr-cue-change` (`detail: { id }`, `id` is `null` when no
cue is active), `lr-highlight-activate` (`detail: { id }`), `lr-anchor-result` (`detail: {
found }`), `lr-search-change` (`detail: { query, matchCount, activeIndex }`), and
`lr-render-error` (`detail: { error }`). The native `ended`, `error`, `loadedmetadata`, `pause`,
`play`, `timeupdate`, and `volumechange`
events are also relayed exactly once from the host as native `Event` instances. Like the original
media notifications, these relays are non-bubbling, non-composed, and non-cancelable. The richer
`lr-*` notifications above remain unchanged. The native media element's `focus`/`blur` are relayed
exactly once as owner-realm native `FocusEvent`s (bubbling and composed, preserving
`relatedTarget`), followed by `lr-focus`/`lr-blur`. `lr-text-select` is not part of this
player's event contract: transcript rows live inside the embedded virtual list's nested shadow
root, so no selection binding is installed.

**CSS parts:** `base`, `media` (the native `<audio>`/`<video>` element), `toolbar`, `rate-select`,
`timeline` (click-to-seek and arrow-key seeking), `timeline-marker` (one per `time-range` highlight;
`data-tone`, `data-active`), `transcript` (the `<lr-virtual-list>` itself), `cue` (`aria-current`,
`data-match`, `data-active-match`), `cue-current` (added alongside `cue` on the row the playhead is
inside), `cue-match` (added alongside `cue` on a row matching the current search query),
`cue-active-match` (added alongside `cue`/`cue-match` on the row holding the current match),
`cue-time`, `cue-speaker`, `cue-text`, and `error`.

`error` is ordinary localized visible text, not a shadow live region. A fresh post-mount native,
playback, or unsafe-source failure appends the localized message to the document's pre-mounted
`[data-lr-live-region="assertive"]` sink. An already-unsafe initial `src` remains visible but does
not interrupt on mount; identical later failures append distinct children. `[part="base"]` remains
a named `role="region"` in the unsafe-source branch and across a safe-to-unsafe transition, so the
player does not lose its landmark or accessible name when its media is replaced by the error.

Every cue-level part above is rendered into the embedded `<lr-virtual-list>`'s own shadow root and
forwarded back out through `exportparts`, so `lr-av-player::part(cue)` and friends work from a
consumer stylesheet. The three cue states are separate part *names* rather than attribute selectors,
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

`controls="standard"` renders play/pause, timeline and elapsed/duration labels, volume/mute,
available captions, and capability-gated fullscreen. `controls="full"` adds playback rate and
capability-gated picture in picture. `controls="none"` removes the control bar but leaves the
poster and active caption overlays available. Fullscreen/PiP/caption affordances are feature-gated
instead of browser-name-gated.

**Methods:** `getState(): VideoState` returns a fresh synchronous
`{ playing, currentTime, duration, volume, muted, playbackRate }` snapshot;
`LyraVideoState` remains an equivalent Lyra-prefixed type alias;
`getVideoElement(): HTMLVideoElement | undefined` returns the private native element after mount;
`play(): Promise<void>` returns the exact native promise and preserves its rejection; `pause()`,
`togglePlay()`, `toggleMute()`, `seek(time)`, `setPlaybackRate(rate)`, and `setVolume(volume)` proxy
finite, clamped media state; `requestFullscreen()` and `exitFullscreen()` preserve the platform
promise/rejection and reject with `NotSupportedError` when the capability is absent. `load()` is a
Lyra extension that re-clones current light-DOM sources/tracks and restarts native resource
selection under a fresh event generation. `focus(options?)`, `blur()`, and `click()` forward to the
play/pause control (absent, and therefore a no-op, under `controls="none"`).

**Events:** native `ended`, `error`, `loadedmetadata`, `pause`, `play`, `timeupdate`, and
`volumechange`, relayed exactly once from the host as native `Event` instances. They remain
non-bubbling, non-composed, and non-cancelable. Scrubbing the custom timeline also dispatches an
immediate host `timeupdate`, before a browser's eventual native seek notification. The internal
play/pause control's `focus`/`blur` are relayed exactly once as owner-realm native `FocusEvent`s
(bubbling and composed, preserving `relatedTarget`), followed by `lr-focus`/`lr-blur`.

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

**CSS parts:** `base` and `video-wrapper` (aliases on the same root node), `caption`,
`caption-overlay`, `controls`, `controls-overlay`, `poster-overlay`, `poster-play-button`,
`progress`, `thumbnail`, `timeline`, `timeline-indicator`, `timeline-thumb`, `timeline-track`,
`video`, and `video-title-overlay`.

The `progress` range input carries `aria-valuetext` as well as `aria-label` — a localized
`{current} of {duration}` (key `avPlayerPosition`, shared with `lr-av-player`) built from the same
locale-formatted clock times the visible elapsed/duration labels show, so a screen reader announces
"1:07 of 5:00" instead of raw seconds.

**Themeable custom properties:** `--controls-background` (default
`var(--lr-color-overlay-strong)`), `--controls-color` (default `var(--lr-color-text)`), and
`--poster-play-button-background` (default `var(--lr-color-surface-overlay)`). These exact names are
kept for mechanical Web Awesome migration. Lyra also supplies
`--lr-video-poster-play-button-hover-background` (default is the existing hover color mix) and
`--lr-video-poster-play-button-hover-border-color` (default `var(--lr-color-brand)`).

Caption and playback-rate selectors remain native `<select>` controls with decorative, pointer-inert
chevrons; their option foreground and background inherit `--controls-color` and
`--controls-background`.

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
  <source src="/video/demo.webm" type="video/webm">
  <source src="/video/demo.mp4" type="video/mp4">
  <track src="/captions/demo-en.vtt" kind="captions" srclang="en" label="English" default>
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
the roving tab stop (falling back to the first enabled row), which is otherwise unreachable from
outside the shadow root.

**Events:** internal `focus`/`blur` from a playlist row are relayed exactly once as owner-realm
native `FocusEvent`s (bubbling and composed, preserving `relatedTarget`), followed by
`lr-focus`/`lr-blur`. `lr-video-change` is bubbling and composed but non-cancelable, with exact
detail `{ previousIndex, currentIndex, video }`. `video` is a fresh frozen plain-data snapshot with
exact shape `{ title, poster, sources, tracks }`, not the live child element. `sources` contains
frozen `{ src, type, media }` records for the child's direct `src` and `<source>` declarations; `tracks`
contains frozen `{ src, kind, srclang, label, default }` records. Consumer mutation cannot alter a
child or a later event snapshot.

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
current time does not. Events and rejected play promises from a superseded activation cannot affect
the current child. Removing or reordering duplicate-metadata children is identity-safe, and
disconnecting pauses/unloads every child before a later reconnect creates one fresh listener
generation.

The playlist buttons use one roving tab stop, skip inert children, support Up/Down, Home/End, and
mirrored Left/Right navigation, and expose the selected item with `aria-current`. At narrow
allocations the sidebar moves below the video through a container query; long titles ellipsize
without widening the host.

**A child marked `inert` is unavailable:** it never becomes the active video,
`next()`/`previous()`/`goTo()` and auto-advance step past it, and its playlist row renders `disabled`
so the roving `tabindex` can never strand focus on it — an inert element refuses focus, which would
leave `focus()` a silent no-op and kill the next arrow press. `<lr-video>` has no `disabled`
property; use the platform `inert` state exclusively. Only the child's **own** `inert` counts: a
playlist inerted wholesale by an open modal keeps playing. The attribute is watched live, so
marking the *current* video inert moves the selection to the nearest enabled child (emitting
`lr-video-change`) and hands the roving focus to the row that replaced it, instead of leaving a
stale tab stop on a row that can no longer take focus.

```html
<lr-video-playlist controls="full" repeat="all">
  <lr-video title="Introduction" poster="/posters/introduction.jpg">
    <source src="/video/introduction.mp4" type="video/mp4">
  </lr-video>
  <lr-video title="Advanced workflow" poster="/posters/advanced.jpg">
    <source src="/video/advanced.mp4" type="video/mp4">
    <track src="/captions/advanced-en.vtt" kind="captions" srclang="en" label="English" default>
  </lr-video>
</lr-video-playlist>
```
