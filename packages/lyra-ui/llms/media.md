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
  icon-scale use (menus, language pickers, ~12–28px); `'standard'` (the effective default, when both
  `variant` and `detailed` are unset) = the icon-optimized vector for card/row sizes (~28–96px);
  `'detailed'` = the pristine full-fidelity vector for hero-scale display. Takes precedence over the
  deprecated `detailed` below. No effect when `src` is set.)
- `detailed: boolean = false` (reflected — **deprecated: use `variant="detailed"` instead**. Kept as
  an alias for one minor cycle — when `variant` is left unset, `detailed` still maps to the detailed
  tier — scheduled for removal in the next major. No effect when `src` is set.)

**Events:** none.

**Slots:** none.

**CSS parts:** `image`

**Themeable custom properties:** `--lr-flag-radius` (default `calc(var(--lr-radius) * 0.33)` —
non-`round` corner radius), `--lr-flag-aspect-ratio` (default `4 / 3`), and
`--lr-flag-object-fit` (default `cover`); also consumes `--lr-color-border` for the inset ring.

**Optional peer deps:** `@aceshooting/lyra-flags` — required for the component to actually render an
image when `country` or `language` is used. Import `components/flag/flag-peer.js` once to opt into
that resolver; a pre-resolved `src` works without the peer registration entry. If the peer is not
installed, renders an empty template (see gotchas).

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

**Locale picker recipe.** A locale picker is a composition, not a component: `<lr-popover>` supplies
the light-dismiss surface, `<lr-flag>` the country mark, `localeNativeName()` the endonym, and
`aria-current="true"` marks the active choice. Which locales exist is the app's decision, so the app
owns the list. Set `lang` on each row so assistive tech pronounces the endonym in its own language,
and use `variant="compact"` at icon scale.

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
import { localeNativeName, languageToCountry } from '@aceshooting/lyra-ui';

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
- `country`/`language` resolution is opt-in through `components/flag/flag-peer.js`; the root barrel
  registers the component without importing the optional flag asset graph. Requires the optional
  peer `@aceshooting/lyra-flags` to actually render an image; without it the component still shows a
  `<lr-skeleton variant="rect">` placeholder (with `aria-busy="true"` on
  the host) while resolving, then settles into an **empty template** plus a one-time `console.warn`
  once the resolver rejects (lazy `import()`, cached module-wide so the warning fires only once per
  page even with many `<lr-flag>` instances).
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
  icon-optimized vector for card/row sizes, ~65% smaller on average than the pristine source for the
  65 affected codes with no visible fidelity loss at that scale; `"detailed"` — the pristine
  full-fidelity vector, for hero-scale display where the extra illustrative detail is actually
  visible. The other 184 codes resolve to the same file regardless of `variant` — a safe no-op. The
  older boolean `detailed` attribute predates `variant` and is now **deprecated**
  (`variant="detailed"` is the replacement); left unset, `variant` falls back to honoring `detailed`
  for one more minor version before removal.

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
idempotent/clamped; `length <= 1` is a no-op degenerate case. `focus(options?)` and `blur()` forward
to the play button.

**Events:** `lr-play`, `lr-pause` (no detail), `lr-step` (`detail: { index }`, fired on every
tick and manual step); internal `focus`/`blur` are bridged as bubbling, composed host events.

**Slots:** none.

**CSS parts:** `base`, `play-button`, `slider`

**Themeable custom properties:** `--lr-playback-icon-size` (default
`calc(var(--lr-icon-button-size) * 0.35)` — the play/pause glyph's size; applied as the button's
`font-size`, and the inline SVG renders at `1em`); plus shared tokens `--lr-space-s`,
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
- No `aria-valuetext`/visible "N of M" position label on the range input.
- Calling `play()`/`pause()` programmatically (not via the button) gives no `aria-live`
  announcement of the Play/Pause state change.

---

## `lr-map`

A `maplibre-gl` wrapper with a declarative legend, a single choropleth GeoJSON fill layer, markers,
and additive plain-GeoJSON `dataLayers`, plus a raw `map` escape hatch for anything unexposed.

**Properties:**
- `center: [number, number] = [0, 0]`
- `zoom: number = 2`
- `mapStyle: StyleSpecification | string = DEFAULT_STYLE` (attribute: false) — the default is a
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
  gotchas.
- `dataLayers: GeoJsonDataLayer[] = []` (attribute: false) — `GeoJsonDataLayer { sourceId: string;
  geojson: GeoJSON.Feature | GeoJSON.FeatureCollection; tone?: 'accent' | 'success' | 'warning' |
  'danger' | 'neutral' }`. Each entry adds one GeoJSON source plus three layers
  (`${sourceId}-fill`/`${sourceId}-line`/`${sourceId}-circle`, filtered by geometry type so a mixed
  `FeatureCollection` renders correctly across all three), colored from the matching `--lr-color-*`
  token (`tone` defaults to `'accent'` → `--lr-color-brand`). Independent of `choropleth` — no
  `field`/`stops` color-interpolation, just the geometry rendered in a flat tone; use `choropleth`
  instead when you need a data-driven color ramp. Reconciled by `sourceId` the same way `choropleth`
  is: an entry whose `sourceId` persists across a `dataLayers` reassignment gets its GeoJSON updated
  in place (`setData()`), one that's dropped has its source/layers removed, and a genuinely new
  `sourceId` gets a new source/layers — nothing leaks on removal, style change, or disconnect.
- `label: string = ''` — accessible name for the map region, applied as `[part="base"]`'s
  `aria-label`. A plain `aria-label` attribute on the host itself is honored as a fallback when
  `label` is left unset, matching `lr-slider`/`lr-checkbox`/`lr-switch`; with neither set, it
  falls back to the localized `'map'` message.

**Getters:** `map` → the raw `maplibregl.Map` instance.

**Events:** `lr-map-load` (fired once, after the underlying map's own `'load'`), `lr-map-click`
(`detail: { lngLat: [lng, lat], feature? }` — feature only populated if a choropleth fill layer
exists and was hit)

**Slots:** none.

**CSS parts:** `base`, `container`, `legend`, `legend-swatch`

**Themeable custom properties:** shared tokens only — `--lr-space-xs/-s`, `--lr-color-surface`,
`--lr-color-border`, `--lr-shadow`, `--lr-radius`.

**Optional peer deps:** `maplibre-gl` (lazy-loaded; consumer must **separately** `import
'maplibre-gl/dist/maplibre-gl.css'` once — the component does not do this for you).

```html
<lr-map center="[2.35, 48.85]" zoom="10"></lr-map>
<script>
  import 'maplibre-gl/dist/maplibre-gl.css';
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

**Known gotchas:**
- clearing or swapping the choropleth no longer leaks the old layer: setting `choropleth =
  undefined`, or changing `choropleth.sourceId` to a different value, now calls `removeLayer`/
  `removeSource` on whatever was previously applied before adding the new one (or nothing, if
  cleared).
- `mapStyle` changes after construction now call `setStyle()` (in addition to `center`/`zoom`
  already calling `setCenter`/`setZoom`) — the choropleth and `dataLayers` are both automatically
  re-applied once the new style's own `'style.load'` fires, since a style change wipes every
  layer/source maplibre-gl knows about.
- Point markers now have a declarative API (`markers`, above) with popup support — the `.map` escape
  hatch and manual `new maplibregl.Marker()` are no longer the only way to place pins.
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
- while the `maplibre-gl` peer is resolving, the host shows a `<lr-skeleton variant="rect">` with
  `aria-busy="true"` in place of the map container.
- construction of the real `maplibregl.Map` (and its WebGL context) is additionally gated on this
  element being observed intersecting the viewport (`IntersectionObserver`), independent of whether
  the `maplibre-gl` peer has already loaded — an off-screen `<lr-map>` swaps its skeleton for the
  empty `[part="container"]` div as soon as the peer resolves, but `map` stays `undefined` and
  `lr-map-load` never fires until the element is actually scrolled into view. Deliberate: caps
  concurrent WebGL contexts when many `<lr-map>`s sit in one dashboard/grid. Skipped entirely
  (constructs immediately once the peer loads) when `IntersectionObserver` itself is unavailable.

---

## `lr-file-input`

A drag-drop + click-to-browse file dropzone. Emits raw `File[]` only — no client-side CSV/XLSX/etc.
parsing (that's left entirely to the host).

**Properties:**
- `multiple: boolean = false` (reflected)
- `disabled: boolean = false` (reflected)
- `accept: string = ''` — a native-`accept`-style string (`.csv,.xlsx`, `text/csv`, `image/*`, or any
  comma-separated mix); now enforced on **both** the native picker dialog and the drag-drop path, see
  gotchas
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
- `label: string = 'Drop files here or click to browse'`
- `accessibleLabel: string = ''` (attribute `aria-label`) — overrides `label` as the internal
  dropzone/button accessible name without changing visible copy
- `acceptedMessage: string = '{count} file(s) added.'` (attribute `accepted-message`) — live-region
  message after an accepted selection; `{count}` is replaced with the accepted count
- `rejectedMessage: string = '{count} file(s) rejected.'` (attribute `rejected-message`) — live-region
  message after rejected files; `{count}` is replaced with the rejected count

**Methods:** `openPicker()` programmatically opens the native file dialog; `focus(options?)`
forwards to the interactive dropzone.

**Events:** `lr-files` (`detail: { files: File[], rejected: RejectedFile[] }`, fired on both drop
and manual file-picker selection) — `RejectedFile = { file: File; reason: 'type' | 'count' | 'size' | 'directory'
}`: `'type'` from `accept`/`allowedMimeTypes`/`forbiddenMimeTypes`, `'count'` when a single-file
input (`multiple` unset) receives more than one file (in which case *all* files are rejected, none
accepted), `'size'` from `maxFileSize`, or `'directory'` for a dropped folder. `focus`/`blur` fire
when the semantic dropzone (the actual keyboard-focusable element, not the hidden native `<input>`)
gains/loses focus.

**Slots:** default slot — custom dropzone content, overrides the `label` attribute text when
provided. The accessible name always comes from `label` regardless, so icon-only slot content still
announces correctly.

**CSS parts:** `base`, `input`, `status` (a visually-hidden `role="status" aria-live="polite"`
element carrying the drag accept/reject announcement)

**Themeable custom properties:** `--lr-file-input-compact-padding` (default `var(--lr-space-s)`) —
`[part='base']`'s padding while `compact`; `--lr-file-input-compact-gap` (default
`var(--lr-space-2xs)`) — the gap between the dropzone's slotted children while `compact`; and
`--lr-file-input-compact-font-size` (default `var(--lr-font-size-sm)`) — the label's font size while
`compact`. All three apply only while `compact` is set, so they are the way to tune a dense dropzone
without re-pointing shared spacing tokens for everything else on the page. Plus shared tokens —
`--lr-space-xs`, `--lr-space-l`,
`--lr-color-border`, `--lr-radius`, `--lr-color-surface`, `--lr-color-text-quiet`,
`--lr-color-success` (drag-accept state), `--lr-color-danger` (drag-reject state),
`--lr-focus-ring-width/-color/-offset` (`[part="base"]:focus-visible` outline),
`--lr-opacity-disabled` (`:host([disabled])` dimming).

**Optional peer deps:** none.

```html
<lr-file-input multiple accept=".csv,.xlsx" allowed-mime-types='["text/csv"]'></lr-file-input>
<script>
  document.querySelector('lr-file-input').addEventListener('lr-files', (e) => {
    console.log('accepted:', e.detail.files, 'rejected:', e.detail.rejected); // rejected[i].reason
  });
</script>
```

Note: `allowedMimeTypes`/`forbiddenMimeTypes` are complex properties (`attribute: false`) — set
them via JS (`el.allowedMimeTypes = [...]`), not as a JSON string attribute; the snippet above is
illustrative of intent only.

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
  Set `paste="false"` (or `.paste = false`) to opt out. (The package README's "Known limitations"
  entry claiming there is no paste support, and none for dragged folders, is stale — both work.)
- Dragged folders **are** detected via `webkitGetAsEntry()` and reported as
  `rejected[].reason === 'directory'` (paired with a synthetic zero-byte `File` carrying the folder
  name), not silently accepted as a phantom file.
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

**Events:** `lr-position-change` (`detail: { position }`), plus composed `focus` and `blur` events
from the internal range handle.

**Slots:** `before`, `after`.

**CSS parts:** `base`, `before`, `after`, `divider`, and `handle`.

```html
<lr-image-comparer aria-label="Before and after">
  <img slot="before" alt="Before" src="before.png">
  <img slot="after" alt="After" src="after.png">
</lr-image-comparer>
```

---

## `lr-zoomable-frame`

Scrollable inspection frame with bounded zoom controls and keyboard shortcuts. Scrolling provides
panning when zoomed content exceeds the viewport.

**Properties:**
- `zoom: number = 1` (attribute `zoom`, reflected), `minZoom: number = 0.5`, `maxZoom: number = 4`,
  and `zoomStep: number = 0.25` — bounded zoom configuration
- `src: string = ''` and `alt: string = ''` — optional image source; otherwise the default slot is
  rendered
- `accessibleLabel: string | null` (attribute `aria-label`) — host-level accessible name

**Methods:** `zoomIn()`, `zoomOut()`, and `resetZoom()` update the zoom and emit
`lr-zoom-change` (`detail: { zoom }`). `resetView()` calls `resetZoom()` **and** scrolls the
viewport back to the origin — `resetZoom()` deliberately preserves the current pan/scroll offset
(it backs the built-in reset button and the `0` shortcut), `resetView()` is the stronger reset for
a caller swapping in entirely new content (`<lr-lightbox>` calls it on every navigation). The
viewport accepts `+`/`=` (zoom in), `-`/`_` (zoom out), and `0` (reset zoom) while focused.

**Slots:** default slot — content to inspect; ignored while `src` is set (an `<img>` renders
instead).

**Events:** `lr-zoom-change` (`detail: { zoom }`).

**CSS parts:** `base`, `viewport`, `content`, `controls`, `zoom-out`, `zoom-in`, and `reset`.

**Themeable custom properties:** `--lr-zoomable-frame-min-block-size` (default
`var(--lr-size-10rem)` — the scrollable viewport's minimum block size).
`--lr-zoomable-frame-zoom` is a read-only hook, not a knob: the component writes the resolved
zoom factor inline on `[part="content"]`, which `transform: scale()` consumes — setting it from
outside is overwritten on the next render.

```html
<lr-zoomable-frame src="map-preview.png" alt="Map preview" aria-label="Map preview"></lr-zoomable-frame>
```

**Known gotchas:**
- `zoom`/`minZoom`/`maxZoom`/`zoomStep` are all normalized before any zoom math: `minZoom` falls
  back to `0.5`, `maxZoom` to `4` (and is floored at the effective `minZoom`), `zoomStep` to
  `0.25`, each clamped into `[0.01, 1000]`, so a `NaN`/zero/negative attribute can't stall or
  reverse `zoomIn()`/`zoomOut()`.
- every zoom is snapped to a multiple of `zoomStep` and rounded to 2 decimals, so `zoom` will not
  always equal the exact value you assigned.

---

## `lr-attachment-chip`

A compact chip representing one file queued for (or already part of) a chat message — used in a
composer's pre-send attachment tray or a sent message's attachments display. Two independent ways
to populate it: set `file` to a real `File` (fresh from a picker/drop), from which `name`/`size`/
`mime-type` and the image thumbnail are all auto-derived; or set the plain `name`/`size`/
`mime-type`/`thumbnail-src` props instead, for reconstructing a chip from server-persisted
attachment metadata after a page reload, when no real `File` object exists any more. `file` always
wins when both are present. When a real `File` or `preview-src` is available, the chip also offers
a localized preview action that opens `<lr-document-viewer>` using the same effective MIME type.

**Properties:**
- `file?: File` (attribute `false`, i.e. property-only) — when set, `name`/`size`/`mimeType`/the
  image thumbnail are all derived from it, taking precedence over the independent props below
- `name: string = ''` — filename, used only while `file` is unset
- `size: number = 0` — file size in bytes, used only while `file` is unset
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

The component identifies *which* attachment a `lr-remove`/`lr-retry` event is about via the
platform's own `id` attribute/property rather than a second, differently-named prop. Set `id="..."`
when you have a stable server-side attachment id; when unset and `file` is set, a stable id is
derived from `` `${file.name}:${file.size}:${file.lastModified}` ``; when neither is available, a
generated internal id is used as a last resort.

**Events:** `lr-remove` (`detail: { id }`, only rendered while `removable`), `lr-retry`
(`detail: { id }`, only rendered while `status="error"`), `lr-preview` (`detail: { id, name,
mimeType, src }`, emitted when the preview action opens the document viewer)

**Slots:** none.

**CSS parts:** `base`, `thumbnail`, `meta`, `name`, `size`, `status-text`, `progress`,
`progress-fill`, `spinner`, `retry-button`, `preview-button`, `remove-button`

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
<lr-attachment-chip name="report.pdf" size="245000" mime-type="application/pdf" status="done"></lr-attachment-chip>
<lr-attachment-chip id="att-2" status="uploading" progress="42"></lr-attachment-chip>
<script type="module">
  import { formatFileSize } from '@aceshooting/lyra-ui';

  const chip = document.createElement('lr-attachment-chip');
  chip.file = pickedFile; // name/size/mime-type/thumbnail all derived from the File
  chip.addEventListener('lr-remove', (e) => removeAttachment(e.detail.id));
  chip.addEventListener('lr-retry', (e) => retryUpload(e.detail.id));
  chip.addEventListener('lr-preview', (e) => console.log(e.detail));
  console.log(formatFileSize(pickedFile.size));
</script>
```

The image thumbnail for a real `File` is a lazily-created `URL.createObjectURL()` blob URL —
created only from `render()`, i.e. only once a thumbnail is actually about to paint, never eagerly
on `file` assignment — and revoked automatically once `file` changes to a different `File` (or to
`undefined`) and on disconnect, so reassigning `file` several times before the next paint never
leaks URLs that were created but never shown.

**Known gotchas:**
- `file` always wins over `name`/`size`/`mimeType` when both are set — assigning those props while
  `file` is also set has no visible effect on the rendered chip.
- A `0`-byte size and an unset size are indistinguishable (there's no separate flag for "genuinely
  empty file"); the `size` part is hidden entirely rather than showing a literal `"0 B"`.
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

**Properties:** `mimeType` (attribute `mime-type`), `name`, `size` (bytes; `0` renders no size),
`label`, `decorative`, and `variant: 'icon' | 'label'`.

**CSS parts:** `base`, `icon`, `label`, and `size`.

**Themeable custom properties:** `--lr-file-icon-size` (default `var(--lr-size-2rem)` — the
format badge's inline and block size).

**Exports:** `LyraFileTypeMetadata`, `LyraFileTypeIcon`, `LyraFileTypeCategory`,
`getFileTypeMetadata()`, and `registerFileTypeMetadata()` for application-specific mappings.

```html
<lr-file-icon mime-type="application/pdf" variant="label"></lr-file-icon>
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
  shadow root) — same contract as `<lr-document-preview>`'s identically-named prop.

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

**Slots:** none.

**CSS parts:** `base` (a `<button>` for `kind="image"`, a plain wrapper `<div>` for `kind="video"`,
an `<a>` or `<span>` for the file-chip fallback depending on href safety), `media` (the `<img>`/
`<video>`), `file-icon`, `filename` (file-chip fallback only), `open-button` (video only — see
below).

**Themeable custom properties:** `--lr-media-card-max-height` (default `20rem` — caps `[part="media"]`'s
block-size so one oversized image/video can't blow out a chat bubble; same naming/contract as
`<lr-document-preview>`'s identical `--lr-document-preview-max-height`; override per-instance via
the `max-height` attribute instead of this property directly). Plus shared tokens
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
  button's `aria-label`, which otherwise comes from `CAPABILITY_META[capability].triggerLabel` (e.g.
  `'Attach files'`); only affects the single-capability button (`[part='trigger']`) — the
  multi-capability menu's own trigger keeps its fixed `'Add attachment'` label regardless. Unset
  (the default) keeps the built-in English default.
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
blob to `<lr-attachment-chip>`). Internal `focus`/`blur` from the hidden input are re-emitted as
host events.

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

---

## `lr-avatar`

A small, fixed-size identity marker: default-slotted icon/glyph content, an image, or a fallback of
initials text — in that priority order, whichever is set takes over from the next. First-party
invention (no Web Awesome equivalent) — purely presentational, with no built-in interactivity; wrap
it in a `<button>`/`<lr-menu>` trigger for a user-menu affordance.

**Properties:**
- `initials: string = ''` — fallback text (typically 1-2 characters), shown whenever no slotted icon
  and no image is set, or the image fails to load.
- `src?: string` — image URL; takes priority over `initials` when set and loads successfully (but
  never over slotted icon content), falling back to `initials` on a load error.
- `alt: string = ''` — image alt text; set alongside `src` for accessibility, and also the source of
  the accessible name for the icon-slot and initials cases (the glyph is `aria-hidden`, and the
  initials text is hidden from AT once `alt` supplies a name, so `[part="base"]` carries
  `role="img"` + that name instead).
- host `aria-label` — overrides `alt` as the image/fallback accessible name without changing the
  visible initials or image
- `size: 'sm' | 'md' | 'lg' = 'md'` (reflected).
- `shape: 'circle' | 'square' = 'circle'` (reflected).
- `tone: 'neutral' | 'brand' | 'success' | 'warning' | 'danger' = 'neutral'` (reflected) — recolors
  the initials-fallback background/text, mirroring `lr-chip`'s `tone` vocabulary; `neutral` (the
  default) reads as a plain, unaccented circle.

**Events:** none.

**Slots:** default slot — icon/glyph content (e.g. an inline SVG), shown in place of the image and
initials, e.g. to mark a chat avatar as "AI" vs. "user" with a role glyph. Takes priority over both
`src` and `initials`. The glyph is treated as decorative (`aria-hidden`) — set `alt` alongside it
for an accessible name.

**CSS parts:** `base` (the outer circle/square container), `icon` (wrapper around the slotted
icon/glyph, only shown while the slot has assigned content), `image` (the `<img>`, only rendered
while `src` is set, hasn't failed to load, and no icon is slotted), `initials` (the fallback
initials text, rendered whenever neither `icon` nor `image` is).

**Themeable custom properties:** `--lr-avatar-size` (default `2rem`, swapped to `1.5rem`/`2.5rem`
per `size="sm"`/`"lg"`), `--lr-avatar-bg` (default `var(--lr-color-surface-alt,
var(--lr-color-border))`, swapped per `tone`), `--lr-avatar-color` (default
`var(--lr-color-text)`, swapped per `tone`), `--lr-avatar-font-size` (default
`var(--lr-font-size-sm)`) — the font size of the initials fallback, and of any `em`-sized slotted
glyph. `size` swaps it per tier too (`var(--lr-font-size-xs)` at `sm`, `var(--lr-font-size-md)` at
`lg`), so the initials track the circle instead of staying one fixed size across every tier;
override it on the element for a size the built-in scale doesn't cover. Plus shared tokens
`--lr-radius`/`-pill`, `--lr-font-size-sm`, `--lr-font-weight-semibold`.

**Optional peer deps:** none.

```html
<lr-avatar initials="JS" tone="brand"></lr-avatar>
<lr-avatar src="/users/42/photo.jpg" alt="Jane Smith" size="lg"></lr-avatar>
<lr-avatar alt="Assistant"><svg viewBox="0 0 24 24"><!-- role glyph --></svg></lr-avatar>
```

**Known gotchas:**
- an image load failure falls back to `initials` automatically. Changing `src` clears the failure
  state so the replacement URL gets its own load attempt.
- when `alt` or host `aria-label` supplies a name, the base preserves that name through the
  initials fallback while hiding duplicate initials text from assistive technology.

---

## `lr-animated-image`

An animated GIF/APNG/WebP with a play/pause control, frozen to a captured still frame at rest and
automatically under `prefers-reduced-motion: reduce`.

**Properties:**
- `src: string = ''` — re-validated through `safeMediaSrc()` (same allowlist as `lr-media-card`)
  before reaching the real `<img src>`.
- `alt: string = ''` — falls back to the localized `animatedImageDefaultAlt` when empty; an explicit
  `alt=""` does **not** mark the image decorative.
- `play: boolean = false` — the caller's *intent*. Not reflected.
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
forces a freeze does emit `lr-pause`); internal `focus`/`blur` are re-dispatched as bubbling,
composed host events.

**Slots:** `play-icon`, `pause-icon` — custom glyphs on `[part="play-button"]` for the
frozen/paused and playing states. Both are always rendered and toggled via the native `hidden`
attribute, so slotted content for both stays mounted.

**CSS parts:** `base` (positioning context), `image` (the live `<img>`), `canvas` (the
frozen-frame `<canvas>`, shown in place of `image` while not playing), `control-box` (the
backgrounded circle around the button; only rendered once loaded and error-free), `play-button`.

**Themeable custom properties:** `--lr-animated-image-control-box-size` (default
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

## `lr-animation`

Declaratively animates one slotted element through the native Web Animations API.

**Properties:**
- `name: LyraAnimationPreset = 'none'` — `'none' | 'fade-in' | 'fade-out' | 'zoom-in' | 'zoom-out' |
  'slide-in-start' | 'slide-in-end' | 'slide-out-start' | 'slide-out-end' | 'slide-in-up' |
  'slide-in-down' | 'bounce' | 'pulse' | 'spin' | 'shake'`. The four `-start`/`-end` slide presets
  are logical: "start" is physically left under `ltr`, right under `rtl`.
- `keyframes?: Keyframe[]` (attribute: false) — raw WAAPI keyframes; always wins over `name`.
- `play: boolean = false` (reflected) — playback intent.
- `delay: number = 0`, `duration: number = 1000`, `endDelay: number = 0` (attribute `end-delay`),
  `easing: string = 'linear'`, `fill: FillMode = 'auto'`, `direction: PlaybackDirection = 'normal'`,
  `iterations: number = Infinity`, `iterationStart: number = 0` (attribute `iteration-start`),
  `playbackRate: number = 1` (attribute `playback-rate`) — straight WAAPI timing. `direction` is
  the WAAPI `PlaybackDirection`, unrelated to text direction.
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
- `currentTime: number` — the underlying `Animation.currentTime` (`0` when no animation exists);
  writable, forwarded to the animation when one exists.

**Methods:** `start()` (sugar for `play = true` — named `start` because `play` is already a
property), `pause()` (`play = false`), `finish()`, `cancel()`.

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

**Optional peer deps:** none.

**Known gotchas:**
- `iterations` defaults to `Infinity` (mirrors the upstream Web Awesome/Shoelace contract) — a named
  preset plays forever unless you set `iterations="1"`.
- changing any timing/keyframe property rebuilds the animation from scratch; the rebuild's internal
  `cancel()` is deliberately silent (no `lr-cancel`), only the public `cancel()` emits.
- the slide presets read the inherited text direction only when the animation is (re)built — an
  animation already mid-flight is not re-mirrored if an ancestor `dir` flips.
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
- `size: AvatarSize = 'md'` (reflected) — `'sm' | 'md' | 'lg'`, reused from `<lr-avatar>`.
- `shape: AvatarShape = 'circle'` (reflected) — `'circle' | 'square'`.
- `tone: AvatarTone = 'neutral'` (reflected) — `'neutral' | 'brand' | 'success' | 'warning' |
  'danger'`; recolors the overflow badge only.
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
swapped to `1.5rem`/`2.5rem` per `size`), `--lr-avatar-group-overlap` (default
`var(--lr-size-neg-6px)`, swapped per `size`; a logical `margin-inline-start`, so it auto-mirrors
under `dir="rtl"` — setting `0` or a positive length turns the stack into normal spacing),
`--lr-avatar-group-ring-color` (default `var(--lr-color-surface)`),
`--lr-avatar-group-ring-width` (default `var(--lr-border-width-medium)`),
`--lr-avatar-group-badge-bg` (default `var(--lr-color-border)`, swapped per `tone`),
`--lr-avatar-group-badge-color` (default `var(--lr-color-text)`, swapped per `tone`),
`--lr-avatar-group-badge-font-size` (default `var(--lr-font-size-sm)`) — the font size of the "+N"
badge label. `size` swaps it per tier (`var(--lr-font-size-xs)` at `sm`, `var(--lr-font-size-md)` at
`lg`), matching `<lr-avatar>`'s own `--lr-avatar-font-size` scale so the badge and the avatars it
caps read at the same optical weight; override it alongside `--lr-avatar-font-size` on the avatars
themselves when tuning a custom tier.

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
- `size`/`shape`/`tone` do **not** cascade onto slotted avatars — they only drive this component's
  own ring, overlap, and badge. Each `<lr-avatar>`'s own `--lr-avatar-size` lives in its own
  shadow-scoped `:host` block and unconditionally overrides an inherited value, so set a matching
  `size`/`shape` on both the group and every child.
- the row never wraps (`flex-wrap` stays `nowrap`) — wrapping an overlapping stack breaks the
  visual.
- avatars are non-interactive, so there is no roving tabindex / arrow-key handling; the badge is the
  only tab stop.

## `lr-lightbox`

A modal, full-screen image viewer with prev/next navigation, captions, and pan/zoom delegated to one
stable embedded `<lr-zoomable-frame>`. It renders its own dialog panel (not a nested `<lr-dialog>`)
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
- `noLightDismiss: boolean = false` (attribute `no-light-dismiss`) — opts out of backdrop dismissal.
- `showCounter: boolean = true` (attribute `show-counter`) — shows `[part="counter"]` and its
  live-region announcement.
- `minZoom: number = 0.5`, `maxZoom: number = 4`, `zoomStep: number = 0.25` (attributes `min-zoom`/
  `max-zoom`/`zoom-step`) — pure pass-throughs to the embedded `<lr-zoomable-frame>`, which does the
  normalizing.
- `accessibleLabel: string | null = null` (attribute `aria-label`) — the panel's accessible name,
  overriding the localized `lightboxLabel`.

**Methods:** `next()`, `previous()`, `goTo(index)`, `close(reason?)` — `reason` defaults to `'api'`
and is forwarded as the close event's detail.

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
Total"), `live-region` (visually-hidden `role="status"` that announces position on *every* `index`
change, including consumer-driven ones), `actions` (wrapper, `hidden` when nothing is slotted),
`close-button` (always rendered — unlike `<lr-dialog>`'s opt-in `closable`), `stage`, `frame` (the
embedded `<lr-zoomable-frame>`; its internal parts are not re-exported), `previous-button`,
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

Renders `value` as a QR code using the optional `qrcode` peer dependency. **Properties:** `value`, `label`,
`size`, `radius`, and `errorCorrection` (`error-correction`, `L`/`M`/`Q`/`H`). The canvas owns `role="img"`;
its accessible name uses `label`, host `aria-label`, then `value`. Empty values render an empty state.
**CSS parts:** `base`, `canvas`, `empty`, `loading`, and `error`. **CSS custom properties:**
`--lr-qr-code-fill` and `--lr-qr-code-background`. Call `refreshTheme()` after external theme changes
when the computed QR colors need to be redrawn immediately.

## `lr-image-viewer`

A full pan/zoom raster-image viewer with labeled region highlights and opt-in region annotation, the
landing surface for `region`-anchored citations. Distinct from `<lr-svg-viewer>` (rendered SVG
documents) and `<lr-image-comparer>` (before/after slotted surfaces). Adopts `DocumentAnchorTarget`
with `anchorKinds: ['region']` only — no text selection is bound.

**Properties:** `src: string = ''`, `name: string = ''`, `alt?: string`, `fit: 'contain' | 'width' |
'actual' = 'contain'` (reflected), `zoom: number = 1` (reflected), `rotation: 0 | 90 | 180 | 270 = 0`
(reflected), and `annotatable: boolean = false` (reflected).

**Methods:** `rotate()` advances `rotation` by 90°. `zoomIn()`, `zoomOut()`, and `resetZoom()` adjust
the embedded zoomable-frame's zoom.

**Events:** `lr-load` (`detail: { naturalWidth, naturalHeight }`), `lr-zoom-change` (`detail: {
zoom }`), `lr-rotation-change` (`detail: { rotation }`), `lr-fit-change` (`detail: { fit }`),
`lr-highlight-activate` (`detail: { id }`), `lr-annotation-create` (`detail: { anchor }`, kind
`'region'`), `lr-anchor-result` (`detail: { found }`), and `lr-render-error` (`detail: { error
}`).

**CSS parts:** `base`, `toolbar`, `fit-control`, `rotate-button`, `annotate-toggle`, `frame` (the
embedded `lr-zoomable-frame`), `image-wrapper`, `image`, `highlight-layer`, `highlight` (carries
`data-tone`/`data-active`), `highlight-label`, `annotation-box`, and `error`.

**Themeable custom properties:** `--lr-image-viewer-annotate-active-bg` (default
`var(--lr-color-brand-quiet)`) and `--lr-image-viewer-annotate-active-border` (default
`var(--lr-color-brand)`) — the background and border of `[part='annotate-toggle']` while annotation
mode is on. The toggle carries its own glyph in `--lr-color-text`, so keep a 4.5:1 ratio against it
when overriding the background. `--lr-image-viewer-highlight-active-color` (default
`var(--lr-color-brand)`) — the outline of the `[part='highlight']` matching `activeHighlightId`,
independent of the per-tone border colors, so the active box stays distinguishable whatever tone it
carries. All three are declared as inline `var()` fallbacks at the point of use rather than on
`:host`, so each can be set on the element *or on any ancestor*: `::part(highlight)[data-active]` is
invalid CSS — Shadow Parts forbids an attribute selector after `::part()` — which previously left
overriding the library-wide `--lr-color-brand`/`--lr-color-brand-quiet` tokens as the only lever,
repainting every other element that read them. Unset, each falls back to the token its rule used
before.

## `lr-av-player`

An audio/video player built on a native `<audio>`/`<video>` element, plus a cue transcript synced to
`currentTime`, `time-range` anchor/highlight support, an optional dependency-free waveform (peaks
in, no in-component decoding), and playback-rate control. Owns recorded-media transcript sync —
distinct from `<lr-transcript-feed>` (live captions for an in-progress voice session) and
`<lr-playback>` (an index stepper, no media). Adopts `DocumentAnchorTarget` with
`anchorKinds: ['time-range']` only — no text selection is bound. The transcript virtualizes through
`<lr-virtual-list>` the same way `lr-pdf-viewer` virtualizes pages.

**Properties:** `src: string = ''`, `name: string = ''`, `kind?: 'audio' | 'video'` (attribute:
false auto-detection override), `mimeType: string = ''` (attribute `mime-type`), `poster: string =
''`, `loop: boolean = false`, `muted: boolean = false`, `preload: 'none' | 'metadata' | 'auto' =
'metadata'`, `playbackRate: number = 1` (attribute `playback-rate`, reflected), `rates: number[] =
[0.75, 1, 1.25, 1.5, 2]` (attribute: false), `cues: LyraAvCue[] = []` (attribute: false), `peaks:
number[] = []` (attribute: false), and `tracks: LyraAvTrack[] = []` (attribute: false).
`LyraAvCue = { id, start, end?, text, speaker? }`; `LyraAvTrack = { src, kind: 'subtitles' |
'captions' | 'descriptions', srclang, label, default? }`.

**Methods:** `play()`, `pause()`, and `toggle()` proxy the native media element. `seek(seconds)`
sets `currentTime` and forces an immediate `lr-time-change`. `search(query)` resolves the match
count; `searchNext()`/`searchPrevious()` wrap; `clearSearch()` resets.

**Events:** `lr-play`, `lr-pause`, `lr-load` (`detail: { duration, kind }`), `lr-time-change`
(`detail: { currentTime }`, throttled to at most 4/s while playing plus one extra per `seek()`),
`lr-rate-change` (`detail: { rate }`), `lr-cue-change` (`detail: { id }`, `id` is `null` when no
cue is active), `lr-highlight-activate` (`detail: { id }`), `lr-anchor-result` (`detail: {
found }`), `lr-search-change` (`detail: { query, matchCount, activeIndex }`), and
`lr-render-error` (`detail: { error }`).

**CSS parts:** `base`, `media` (the native `<audio>`/`<video>` element), `toolbar`, `rate-select`,
`timeline` (click-to-seek and arrow-key seeking), `timeline-marker` (one per `time-range` highlight;
`data-tone`, `data-active`), `transcript` (the `<lr-virtual-list>` itself), `cue` (`aria-current`,
`data-match`, `data-active-match`), `cue-time`, `cue-speaker`, `cue-text`, and `error`.

**Themeable custom properties:** `--lr-av-player-transcript-height` (default
`var(--lr-size-16rem)` — block size of the transcript pane; forwarded to the embedded
`<lr-virtual-list>`'s own `--lr-virtual-list-height`). `--lr-av-player-marker-active-color` (default
`var(--lr-color-brand)`) — the outline of the `[part='timeline-marker']` matching
`activeHighlightId`, leaving the per-tone marker fills alone. It is an inline `var()` fallback at
the point of use rather than a `:host` declaration, so it can be set on the element or on any
ancestor — `::part(timeline-marker)[data-active]` is invalid CSS (Shadow Parts forbids an attribute
selector after `::part()`), so re-pointing the shared `--lr-color-brand` token was the only previous
lever.

Two further cue-state properties are declared — `--lr-av-player-cue-current-bg` (intended default
`var(--lr-color-brand-quiet)`, the background of the `[part='cue']` the playhead is inside) and
`--lr-av-player-cue-active-match-color` (intended default `var(--lr-color-warning)`, the outline of
the cue holding the current search match, leaving the other matches on the shared warning token) —
but **their rules do not currently take effect.** The transcript rows are rendered into the embedded
`<lr-virtual-list>`'s own shadow root, one boundary deeper than this component's stylesheet (and
than a consuming stylesheet) reaches, so the declarations targeting `[part='cue']` never match the
rendered rows. They are documented here for completeness; do not rely on them to restyle the
current cue or the active search match today. `--lr-av-player-marker-active-color` is unaffected —
`[part='timeline-marker']` lives in this component's own shadow root and is live.
