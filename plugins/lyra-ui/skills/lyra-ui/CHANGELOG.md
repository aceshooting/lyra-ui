# Changelog

## 12.1.2

### Patch Changes

- a58f119: Fix accessibility naming, interaction guards, data normalization, remote media safety, and generated contract coverage across the component library.

## 12.1.1

### Patch Changes

- 50754fa: Keep clone-owned collection properties referentially stable when a declarative renderer rebinds
  the same unchanged input, avoiding redundant work such as resetting an unchanged map style while
  preserving explicit change detectors and updates made by assigning a new collection.
- 92cdb49: Correct the first-release annotations for the 12.1 date preset, filter-bar, and map-layer APIs in
  the packaged LLM reference.

## 12.1.0

### Minor Changes

- 6504adc: Expand `lr-map` with zoom-responsive heatmap radius and intensity, heatmap opacity,
  construction-time world-copy control, allocation-aware resizing, and accessible declarative marker
  activation events.
- 81dbb6a: Add opt-in automatic value-axis gutter sizing and category-label density to `lr-lite-chart`.
- acf4c5f: Avoid redundant `lr-heatmap` redraws for unchanged legend snapshots, and keep stable-ID `lr-map`
  GeoJSON additions, removals, and order changes on MapLibre's incremental update path.
- 5e801f9: Add an opt-in `scroll-mode="auto"` to `lr-table` that keeps page flow while content fits and contains horizontal overflow when the table narrows.
- 12b4791: Add opt-in collision clustering to time-scaled timelines, with allocation-aware accessible count markers and a typed member activation event.

### Patch Changes

- b36d915: Defer anchored-positioning and form-label runtime paths until they are needed, keeping granular
  popover and combobox registrations lighter and documenting first-interaction progressive loading
  for strict initial-JavaScript budgets.

## 12.0.0

### Major Changes

- bd0f05f: **Breaking:** `LyraElement` no longer declares the static `getPropertyDescriptor()`, so that member
  is gone from every element's public surface in `custom-elements.json`.

  This is the release's only substantive breaking change, and in practice nothing consumer-callable
  was removed: `getPropertyDescriptor()` is Lit's own finalization hook, called *by* `ReactiveElement`
  during `finalize()` and never by application code. It appeared on all 285 tags purely because this
  library overrode it, and the manifest projects an inherited static onto every subclass. Only code
  that subclassed an `lr-*` element and overrode the hook itself is affected — a path Lit has already
  deprecated and states will not be called under standard decorators.

  The major is nonetheless correct rather than pedantic. By this package's own definition of public
  surface, a public static was removed from every element, and the reachable-declaration set of every
  export shrank as a result. The semver gate reports that honestly, and the alternative — shipping it
  as a minor behind a blanket exception — would have meant weakening the gate to let one change past
  it.

  `@lit/reactive-element` 2.1.2 deprecates that hook and warns during `finalize()`, so every consumer
  saw an unactionable dev-mode warning on every page load that mounted any `lr-*` element, not
  silenceable without disabling Lit's dev warnings wholesale.

  The more important half was invisible. That override was what implemented the documented
  clone-owned/bounded/frozen collection contract on 182 enrolled property names across 87 modules
  (`colorSteps`, `legendStops`, `annotations` and their equivalents): it wrapped every reactive setter
  and routed owned values through the snapshot helpers. It worked only because the published dist
  ships experimental decorators, which still call the hook. Lit states plainly that standard
  decorators will not — so a migration, or a consumer build applying them, would have silently
  reverted every one of those properties to storing the caller's live array by reference. No clone, no
  freeze, no error, no warning, and no test would have caught it.

  The contract now rides a decorator-agnostic seam that re-defines the already-finished prototype
  accessor. Legacy `@property`, standard `accessor`/setter decorators, a `static properties` block and
  hand-written getter/setter pairs all end in a prototype accessor by finalization, so this walks the
  finished accessor rather than the hook Lit refuses to call. It installs from the finalization
  trigger Lit itself documents, and registration strictly precedes every instance — constructing an
  unregistered custom element throws — so no assignment can reach an unwrapped setter.

  `finalize()` was deliberately not hooked: that would add a static method to the class surface, which
  the component inventory records per component and a pinned-manifest gate grades. The chosen seam
  changes no static surface at all.

  **No migration is expected.** If you do not override `getPropertyDescriptor()` on an `lr-*`
  subclass, there is nothing to do.

### Minor Changes

- 103922d: `<lr-chip-group>` gained `accessibleLabel` (attribute `aria-label`) and now renders
  `role="group"` on `[part='base']` whenever a name is supplied.

  A chip group is a group, and every peer grouping primitive in this library already said so —
  `<lr-radio-group>` renders `role="radiogroup"`, `<lr-segmented>` the same, each forwarding a host
  `aria-label` inward to the element that owns the role. `<lr-chip-group>` rendered a roleless
  container and read no accessible name at all. Because a host `aria-label` does not cross a shadow
  boundary, a consumer labelling the host named nothing: the chips were announced as unrelated
  toggle buttons with no indication of what set they belonged to.

  This surfaced from a real multi-select filter row, where the consumer had to hand-write
  `role="group" aria-label="…"` onto the host to get a named group. That workaround is the evidence
  the capability was wanted and was reachable only by reaching around the component.

  The role is applied only *with* a name, deliberately. An unnamed group role adds verbosity without
  adding information, and applying it unconditionally would change the accessibility tree of every
  decorative chip row already shipped. An explicit unset-regression test pins that.
- bd0f05f: Completed the date-preset story across the three components that share it.

  `<lr-date-input>` now mirrors the nested picker's `appliedPreset` as a read-only getter. 11.0.0 added
  `presets` to `<lr-date-picker>`; 11.1.0 then separately forwarded `presets` to `<lr-date-input>` and
  added `appliedPreset` to the picker — but never joined the two halves, so the readback landed on the
  component that does not need it and the component that does could set presets and not read the
  result. `appliedPreset`'s own documentation describes the dashboard time filter ("'Last 7 days' must
  still mean the last 7 days after tomorrow's reload"), and that shape is the compact
  text-field-plus-popover input, not the inline calendar.

  There was no workaround. The nested picker lives in the input's shadow root with no documented
  readback path: `input`/`change` are deliberately native events and carry no detail, and every
  alternative the docs already reject applied — matching `value` back against the preset list is "the
  mapping table `presets` exists to delete" and is ambiguous (Today and This month coincide on the
  1st), while reaching for `[part='preset-button'][data-active]` depends on private structure and on
  the popover having been opened at least once.

  The mirror is the input's own field rather than a shadow-root lookup, so it is correct (`undefined`)
  when the popover has never been opened. It carries both halves of the picker's contract — set before
  `commit()`, so a consumer reading it inside their own `change` handler sees the causing preset, and
  cleared on a hand-pick — plus three clear paths the picker cannot see because typing, clearing and
  resetting never reach it: a typed commit that actually changes the value (deliberately not a no-op
  re-commit, which would otherwise silently drop the preset), `clear()`, and `formResetCallback()`.

  `<lr-filter-bar>` can now pass `presets` on its `date-range` filter and reports the resolved preset
  on the `lr-input` detail as `appliedPreset`. The bar already composed `<lr-date-input>` and already
  forwarded that control's `min`/`max`, but had no path at all for `presets` — so the quick-range row
  and the component built for the same dashboard shape could not be combined. `type: 'custom'` was a
  poor substitute: hand-rendering the control plus a full adapter to set one property, and forfeiting
  the built-in date-range chip localization the docs themselves flag as non-trivial.

  `presets` is declared on the `date-range` definition only, not the shared base: a preset names two
  dates and the picker ignores the list outside range mode, so putting it on `'date'` would type-check
  a guaranteed-inert field.
- bd0f05f: `<lr-heatmap>` gained `sticky-labels` (`'none' | 'rows' | 'cols' | 'both'`, default `'none'`), which
  paints the matrix label bands into their own layers instead of into the scrolling bitmap.

  Matrix labels shared one canvas with the cells, so a tall grid lost its column header on scroll: a
  160-row matrix at cell-size 32 is about 5,100px of bitmap, and a header baked into it cannot be
  `position: sticky` on its own. The only workaround was a light-DOM mirror row, which had to follow
  the gutter width and cell size — and before `matrixGeometry` shipped it had to hardcode them, which
  made the workaround mutually exclusive with `row-label-width="auto"`: a consumer got the automatic
  fit or the sticky header, never both. (Scale on why the gutter matters: against the component's own
  10px label font, 160 country names ellipsized 37 times in the built-in 60px gutter and 3 times in a
  120px one.)

  A closed set rather than a boolean, because a boolean cannot express one axis at all and a later
  one-axis need would force either a second property or a breaking type change; and rather than a
  `sticky-row-labels`/`sticky-col-labels` pair, which is two attributes and four states for one
  concept with no single reflected value to select on in CSS. `rows`/`cols` name the axes this
  component already names everywhere else (`rowLabels`, `row-label-width`, `colLabels`,
  `col-label-height`), which `freeze-axis="x|y"` would have clashed with.

  Default `'none'` reproduces today's single-canvas output exactly, including in calendar mode, and an
  unrecognized value normalizes back to `'none'` and repairs the attribute.
- bd0f05f: New component `<lr-funnel>`: a conversion funnel — an ordered set of stages, each drawn as a bar
  whose length is that stage's share of the FIRST stage, read top-to-bottom as progressive drop-off.

  Nothing in the catalogue expressed this. A funnel is not a sorted bar chart: it normalizes to the
  first stage rather than the data maximum, its value axis carries no information worth drawing, and it
  is read as stage-to-stage retention rather than category comparison. Reaching one through
  `lr-bar-chart` meant switching off axes, grid and legend, hand-computing every percentage, and still
  pulling the Chart.js peers for what is a handful of rectangles. `lr-span-waterfall` encodes time
  offset, not share; `lr-flow-canvas` draws a graph, not a quantitative comparison; `lr-stepper` and
  `lr-progress-bar` express position or completion, not per-stage magnitude.

  It lives in the `data` family beside `lr-heatmap` and `lr-gauge` as an analytics primitive, and pulls
  no peer at all.

  Each stage carries both its absolute value and its share, because the interesting question is usually
  the percentage but the credibility check is the count. `comparison` draws a second series behind each
  bar, normalized to ITS OWN first stage, so a cohort's funnel *shape* can be read against a baseline
  whose absolute volumes are not comparable — comparing one entity against a many-entity peer group is
  the common case, and per-series normalization is what makes it legible. `dropoff` (on by default)
  renders the consecutive-stage change.

  The chart is plain HTML — an ordered list of stages with real text and a percentage-width bar — so
  the accessible representation *is* the chart rather than a transcript bolted onto a sighted-only
  drawing.

  Degenerate cases are defined and tested rather than left to chance: an empty series renders a
  localized empty state, a single stage renders one bar and no drop-off, a zero or negative first stage
  suppresses shares instead of dividing by it, a stage larger than its predecessor (real in funnels
  with re-entry) is not clamped, and a comparison series of a different length is matched by position.
- bd0f05f: `<lr-map>`'s `dataLayers` gained declarative marker clustering and a heatmap layer kind. Both are
  strictly additive — today's behaviour is the default in each.

  `cluster?: { radius?, maxZoom?, radiusSteps?, colorSteps?, countFont? }` opts an entry into
  MapLibre's native clustering: the source gains `cluster`/`clusterRadius`/`clusterMaxZoom` and the
  entry emits a cluster circle layer, a count symbol layer, and a circle layer for points that stayed
  unclustered. `markers` creates one `maplibregl.Marker` per entry, which is right for tens of pins and
  wrong for thousands — a consumer rendering up to 5,000 listings in a country-sized viewport got 5,000
  DOM nodes and an unreadable map. `radiusSteps`/`colorSteps` are `['step', …]` breaks on `point_count`
  in the same ascending `[value, output]` vocabulary `choropleth.stops` already uses, including the
  same "the first stop's output is also the base" rule.

  `kind?: 'auto' | 'heatmap'` plus `heatmap?: { weightField?, weightRange?, stops?, radius?, intensity? }`
  reaches MapLibre's first-class `heatmap` layer type. `dataLayers` emitted exactly three
  geometry-filtered layers — fill, line and circle — so a weighted-point density surface was
  unreachable declaratively even though the peer implements it. The colour ramp reuses the same
  `[value, color]` stop vocabulary `choropleth.stops` and `legendGradient` share.

  Between them these were the only remaining reason for raw MapLibre in at least one consumer, which
  carried roughly 212 lines behind the `.map` escape hatch — plus a `style.load` listener and
  idempotent remove-then-add, because a basemap swap wipes every layer and `<lr-map>` restored only its
  own. Both new renderings join the component's existing re-application path, so a `mapStyle` swap
  restores them too.
- bd0f05f: New opt-in stylesheet `@aceshooting/lyra-ui/tokens-root.css` publishes a curated subset of the
  resolved `--lr-*` layer at document scope, so an application's own custom elements can read the
  kit's tokens.

  `theme.css` ships the `--lr-theme-*` INPUT layer at `:root`, but the resolved OUTPUT layer
  (`--lr-color-*`, `--lr-space-*`, `--lr-radius`, `--lr-shadow-*`, `--lr-font-*`) is declared only
  inside each `lr-*` component's own shadow `:host`. An app's own elements are not descendants of any
  `lr-*` host, so nothing inherits it to them. Consumers measured the consequence in Chromium rather
  than inferring it: at document scope `--lr-color-brand`, `--lr-color-border` and `--lr-focus-ring`
  all resolve to the empty string while `--lr-theme-focus-ring-width` resolves fine. One project found
  550 `var(--lr-*)` references in its own components reading nothing — 358 with no fallback at all,
  the rest silently running on a literal fallback that never tracked the theme. Neither failure is
  detectable without reading computed styles in a browser, because an undefined custom property is not
  an error.

  The subset is curated rather than complete, deliberately: `--lr-*` is documented as the internal
  output layer precisely so it can change without a major, and publishing all of it would make several
  hundred names permanent public API. 114 names are in — ambient surfaces/text/borders, the semantic
  colour grid and its flat aliases, the spacing scale, radii, border widths, elevation, font sizes and
  weights, the focus-ring parts, and the base motion pair — each with a stated reason in the file, as
  is each deliberate omission.

  It is generated from the same canonical token source as everything else, so it cannot drift, and a
  fail-closed validator in the existing `check:design-tokens` gate rejects a curated token whose value
  reaches an internal name the file does not declare — the case that would otherwise ship an empty
  `var()` at `:root`. Ramp references resolve to literals at generation time and stay behind their
  `--lr-theme-*` input, so the file is self-sufficient without `theme.css`, still fully rethemable,
  publishes no ramp names, and computes byte-identical values to what a component reaches through the
  ramp.

  Opt-in, and layered in `lr-theme` like `theme.css`, so it changes nothing for anyone who does not
  import it and an app's own unlayered rules still win.
- bd0f05f: `web-types.json` now carries `js.properties`, `js.events` and `slots` alongside its attributes.

  It previously declared attributes and nothing else: 0 of 284 tags had properties, events or slots,
  while `custom-elements.json` in the same tarball described 1,029 events, 3,102 public fields and 445
  slots. 865 of those fields are `attribute: false` and were therefore invisible to JetBrains
  completion entirely — and they are frequently the primary API rather than an edge case
  (`lr-chart.datasets`, `.labels`, `.config`, `lr-heatmap.legendStops`, `.colorSteps`, `.cellColor`,
  `lr-lite-chart.datasets`).

  That gap mattered more here than it would for a typical component library: these are Lit components,
  so the idiomatic usage is `.prop=${…}` and `@event=${…}` in a template, not attributes. The shipped
  metadata covered the minority binding style and omitted the majority.

  The web-types schema the file already declared supports all three directly, and the data was already
  generated for the manifest, so this was a projection gap rather than missing information. It now
  emits every public instance field with its type and default, every declared event with its
  `CustomEvent<…Detail>` handler type, and every slot. Static fields and methods are deliberately
  excluded (a `.formAssociated=` completion would be wrong, and web-types has no IDE-integrated method
  kind).

  The sibling `vscode-html-data.json` stays attributes-only, which is correct: the VS Code custom-data
  format defines no properties/events/slots concept.

### Patch Changes

- 103922d: Documented that `<lr-chart>`'s `description` **replaces** the generated accessible summary rather
  than adding to it.

  Unset, the component builds an sr-only per-series summary from the actual data; set, it discards
  that summary entirely and substitutes the supplied text. That is the right behaviour for a full
  override, but the property was documented only as "Accessible chart description", which reads as
  additive — and a consumer adding a one-line caveat to five charts would have silently traded away
  the data summary on all five. They caught it by reading the source, and applied it only where the
  trade was actually wanted.

  No behaviour change; the JSDoc and the family reference now state the trade and point at the better
  tool for a caveat, which is visible text beside the chart rather than a note only screen-reader
  users hear.
- 2a156eb: Added the missing package-export route for
  `@aceshooting/lyra-ui/components/media/flag/flag-peer-bulk.js`. 11.2.0 led with that module as the
  opt-in bulk peer-registration entry point for `<lr-flag>`, and `llms/components/lr-flag.md` and
  `flag.class.d.ts` both told readers to import it — but it was never listed in `package.json`'s
  `exports`, and an exports map blocks everything it does not list. Following the documentation was a
  hard build error (`"…/flag-peer-bulk.js" is not exported under the conditions […]`), so the
  release's headline `<lr-flag>` feature was unreachable by any consumer.

  The derivation that exists to prevent exactly this — every `*-loader.ts` / `*-peer.ts` /
  `*-register.ts` / `registry.ts` module must be explicitly classified as public or internal — missed
  it because a *qualified* suffix (`-peer-bulk`) is not the bare suffix (`-peer`). The convention now
  accepts qualified variants; across the whole source tree that widening catches this file and
  nothing else.

  A second, independent instance surfaced in the same sweep and is fixed too:
  `@aceshooting/lyra-ui/components/data/flow-canvas/flow-types.js` is shown as an import in
  `llms/data.md` and in the generated `llms/components/lr-flow-canvas.md`, and was likewise
  unlisted. (Those types were still reachable through `flow-canvas.class.js`, so this adds the route
  the docs already named rather than any new surface.)

  Both were promises made in documentation, which no naming convention over the source tree can see.
  So a new release gate, `check:doc-specifiers`, now reads the promises instead: every
  `@aceshooting/lyra-ui/…` specifier a shipped file tells a reader to import must resolve through the
  exports map. It understands prose instructions as well as fenced code examples — the
  `flag-peer-bulk.js` promise was a sentence, not a code block.
- 8084d04: Added `flag-peer-bulk.js` (and the new `flag-peer-bulk-standard.js`) to `package.json`'s
  `sideEffects` list.

  These modules exist purely for their import-time side effect: a consumer writes a bare
  `import '…/flag-peer-bulk.js'` and never reads an export, so a bundler honouring `sideEffects` drops
  the module outright unless it is declared. The generator that derives these entries matched the bare
  suffix `-peer.ts` but not the qualified `-peer-bulk.ts` — the same blind spot that left the module
  out of the `exports` map.

  This half failed more quietly than that one. The missing export route was a hard build error; a
  missing `sideEffects` entry compiles cleanly and then simply does nothing in a production build, so
  `<lr-flag>` would fall back to no resolver with no diagnostic at all.
- bd0f05f: `<lr-flag>` now distinguishes a peer that is not installed from one that is installed but does not
  carry the capability the chosen entry point needs.

  Both cases previously produced the same warning — "install it with `pnpm add
  @aceshooting/lyra-flags`" — which is advice a reader in the second case has already followed, and
  which sends them looking for the wrong problem entirely.

  That case stops being exotic from this release on. `flag-peer-bulk-standard.js` requires
  `createFlagUrlResolver()` on the tier-committed `./standard` subpath, which older peers do not
  export at all, so a consumer who upgrades `@aceshooting/lyra-ui` while pinning
  `@aceshooting/lyra-flags` reaches it by the ordinary route. The peer-range floor moves in the same
  release to make that a resolution warning rather than a silent one, and this makes the runtime
  message match: it now says the package is present, that this is a version mismatch, and where to
  look for the floor it expects.
- 2a156eb: `<lr-heatmap>`'s `matrixGeometry` now returns the geometry the last matrix-mode draw actually
  painted with, instead of recomputing from current layout on every read.

  It is documented as "the gutter/cell geometry the last matrix-mode draw actually painted with", and
  11.2.0's notes claimed it "can never disagree" with the canvas because it reuses the same internal
  getters `drawMatrix()` calls. Reusing those getters is precisely what made it disagree: they read
  *current* layout, not the last paint, so any interval where layout has moved but no draw has
  happened made the getter describe a canvas that does not exist. Two such intervals are routine —
  full redraws pause while the host is outside the viewport (documented behaviour of this component),
  and `rowLabelWidth`/`colLabelHeight` are not redraw-triggering properties at all, so assigning one
  moved the getter *permanently* ahead of the canvas rather than for a transient window.

  That landed squarely on the use case the property was added for: a light-DOM sticky-header mirror
  for a tall matrix — i.e. exactly the component most likely to be scrolled out of view. A mirror
  synced from the getter while the grid was off-screen lined up with geometry the canvas was not
  using, which is the same misalignment the property exists to eliminate. It also silently disagreed
  with `lr-matrix-geometry-change`, which fires only from the draw path and was always correct.

  The getter now returns the frozen object the draw stored and the event carried, so the two are
  equal by construction. The returned object is frozen, so a consumer cannot corrupt the component's
  own change detection by mutating it.
- 2a156eb: Fixed two defects in `<lr-map>`'s `maxBounds`, reported together because the first was the only
  thing hiding the second.

  `maxBounds` never reached maplibre-gl when set declaratively. It is `attribute: false`, so a
  property binding is the only way to set it, which puts its one and only appearance in `changed` on
  the first update — before the component's asynchronous peer import and WebGL initialization have
  produced a map. The `updated()` guard `changed.has('maxBounds') && this._map` therefore
  short-circuited, and because the property never changed again it was never retried: a documented
  property that read back as set, did nothing, permanently, and warned about none of it. It is now
  applied from the map-ready path as well, so a declaratively-set box reaches the peer; a later
  reassignment still goes through `updated()` as before.

  The property's guard also could not run in the case it was written for. It applies the bounds and
  then reads the camera back to detect a non-finite zoom — but at the conditions its own warning text
  names (sub-1 fractional zooms in wide containers) maplibre-gl 6.x throws synchronously out of
  `setMaxBounds()` instead, so the readback line was never reached. With no `try`/`catch` the
  exception escaped `updated()` into the consumer's render cycle, degenerating into repeated throws
  from the peer's own matrix math on every later `resize`/`setZoom` and a canvas that never painted
  again. A throw now routes into the same drop-the-constraint-and-restore-the-camera path the
  non-finite-camera branch already used, so the documented worst case — an unconstrained map plus one
  dev-mode warning — is now the real worst case.
- 2a156eb: The release process now fails when the published upgrade feed lags npm.

  The documented upgrade workflow tells consumers — and upgrading agents — to fetch
  `https://www.lyra-ui.com/changelog.json` and read every release between their installed version and
  its `latest`. That feed is built from this package's `CHANGELOG.md` by the sibling website and
  deployed separately, after the release, so between `npm publish` and that deploy it advertises the
  *previous* release as current.

  Consumers reported that window twice, from two different projects, on two consecutive releases: the
  site said 11.0.0 while npm had 11.1.0, then 11.1.0 while npm had 11.2.0. It fails silently and it
  inverts the workflow's own advice — a reader who trusts the feed concludes they are already current
  and never reads the new release. One release skipped that way contained a fix the reader was
  waiting for. Both reporters caught it only by reading the installed tarball's `CHANGELOG.md`
  instead, which is what the workflow tells them they should not have to do.

  `release-integrity.mjs verify-site-freshness` now checks npm's dist-tag, the published feed's
  `latest`, the presence of the new version in its `releases` array (it went missing entirely once,
  which defeats even a reader who ignores `latest`), and the component catalog's `catalog_version` —
  which rides the same deploy and was caught a release behind at the same time. The release script
  waits on it, so a stale feed is now a loud, actionable release failure rather than something a
  consumer discovers weeks later.

  No published component surface changes.
- 8084d04: Restored two public property names that were renamed with no alias, no changelog entry and no
  deprecation record, silently breaking shipped consumers.

  - `<lr-app-rail-item>`: `active` is back as a deprecated alias for `current`, read alongside it —
    the item is current when either is true, in both property and attribute form.
  - `<lr-widget>`: `activeView` is back as a deprecated alias for `activeViewId`, which it seeds.

  Both were the members' *original* public names. `active` shipped documented as public API ("add an
  `active` property that reflects `aria-current="page"` onto the item"), and a later release's notes
  still described it as `active` after the rename had already happened. `activeView` never appears in
  `CHANGELOG.md` at all, so its rename was never announced in any form.

  The breakage was invisible by construction: a Lit `.prop=${…}` binding on a custom element is
  untyped, so `.active=${…}` and `.activeView=${…}` did not error — they became dead expandos. No
  consumer type check, test suite or build step could see it. One consumer's app rail consequently
  had no current-item indicator and a permanent `aria-current="false"` — an accessibility regression
  — and its widgets fell back to their first view, with everything still passing.

  This is what the house rule about mirrored members already required in general: a rename adds a
  second name, it does not swap one out from under shipped consumers. The compatibility window runs
  long (`removalNotBefore` two majors out) because these aliases are not new API — they are the names
  consumers already wrote.

  `activeView` seeds rather than being read alongside, because unlike a boolean flag it is a property
  the component itself writes (a view-toggle click, and the fallback when `views` no longer contains
  the active id); a read-alongside alias would undo a later interactive change on the next update.
- Updated dependencies [bd0f05f]
  - @aceshooting/lyra-flags@2.2.0

## 11.2.0

### Minor Changes

- a44e6e1: Added a first-class bulk-resolution path for `<lr-flag>`, for a page that renders most/all flags at
  once (a country table, a full locale picker) instead of independently resolving each instance:

  - `@aceshooting/lyra-flags` gained `createFlagUrlResolver()`, a `flagUrl`-shaped resolver factory
    backed by one shared `flagUrls()` fetch instead of a fresh per-code lazy resolution per call.
  - `@aceshooting/lyra-ui` gained `flag-peer-bulk.js` (`components/media/flag/flag-peer-bulk.js`), an
    opt-in alternative peer-registration entry point to the default `flag-peer.js` — import one or the
    other, never both. Only worthwhile when the page renders most/all flags; `flag-peer.js` remains
    the right default for a handful of flags. `fidelity="compact"/"detailed"` on individual elements
    still resolves correctly either way — only the standard tier is bulk-fetched.
- a44e6e1: Two consumer-filed `<lr-heatmap>` gaps:

  - **`matrixGeometry` readback + `lr-matrix-geometry-change` event.** Matrix mode's resolved gutter/
    cell geometry (`padLeft`, `padTop`, `cellSize`) was entirely private, so a consumer building a
    sticky light-DOM header mirror for a tall matrix had to hardcode numbers that `row-label-width`/
    `col-label-height`'s `"auto"` resolution could silently change out from under them. `matrixGeometry`
    now exposes exactly what the last matrix-mode draw painted with (reusing the same internal getters
    `drawMatrix()` itself calls, so it can never disagree), and `lr-matrix-geometry-change` fires
    whenever a redraw actually changes it.
  - **`HeatmapLegendStop.partOfRamp`.** The dev-mode ramp/legend-mismatch warning had no way to
    express a legend swatch that is intentionally outside `colorSteps` — e.g. a calendar heatmap's
    fixed neutral "no data" color shown alongside an N-step sequential ramp. Set `partOfRamp: false`
    on that stop to exclude it from the comparison; every other stop (and every existing consumer
    that never sets this) keeps today's exact behavior.

### Patch Changes

- f5dde67: Bumped the optional `dompurify` peer dependency range floor from `^3.4.13` to `^3.4.14` (a
  DOMPurify patch release). Every other dependency change in this release is dev-tooling only
  (Storybook, Vite, publint, oxc-parser) and carries no published surface.
- a44e6e1: Four documentation gaps reported against 11.1.0 by a real-world consumer audit:

  - **`<lr-flag>` sizing.** The host sizes from `font-size` (`block-size: 1em`, `inline-size` derived
    via `aspect-ratio`), never documented anywhere. Setting `width`/`inline-size` directly makes both
    axes definite, which defeats `aspect-ratio` and squashes the image instead of scaling it. Now
    documented on the class JSDoc and in `llms/media.md`.
  - **`<lr-flag>` bulk rendering.** Nothing pointed a consumer rendering many flags at once (a country
    table, a locale picker) at `@aceshooting/lyra-flags`'s existing `flagUrls()` — one call resolving
    every flag, instead of each `<lr-flag>` instance independently calling `flagUrl()`. Now
    cross-linked from the class JSDoc and `llms/media.md`, alongside the new per-tier peer-resolver
    entry points (see the paired `@aceshooting/lyra-flags` changeset).
  - **`accessibleLabel`'s two conventions.** Most components alias it directly onto native
    `aria-label`; a minority (e.g. `lr-callout`, `lr-table`) that separately compute an internal
    accessible name expose it through a bespoke `accessible-label` attribute instead, so a host
    `aria-label` can still override it. Both are individually correct, but nothing stated the split,
    so `accessible-label="…"` on an `aria-label`-only component was a silent no-op. Now documented in
    `llms/shared.md`'s accessibility contract section.
  - **Shadow-scoped resolved tokens.** The quick-start theming snippet (README and `llms/shared.md`)
    never warned that the resolved `--lr-color-*`/`--lr-space-*`/`--lr-radius`/`--lr-shadow-*`/
    `--lr-font-*` layer is declared only on each `lr-*` element's own shadow `:host` — unreachable
    from plain application CSS or a consumer's own custom elements. The deeper explanation already
    existed in "Where an override actually reaches"; it's now also stated up front, at the first
    theming snippet.
- a44e6e1: `LyraElement` no longer statically imports `internal/form-control-labels.js` (the external-label
  bridge + form-internals capture that only a form-associated component ever uses). Every
  presentational component — `lr-flag`, `lr-popover`, and everything else that doesn't opt into form
  association — no longer ships that module in its reachable bundle graph (measured previously at
  ~6KB gzip on `lr-flag`). Form-associated components register it themselves (the `FormAssociated`
  mixin and 19 hand-rolled form controls each now import it explicitly), so every form control's
  label/hint/error/reset/validity behavior is unchanged.
- Updated dependencies [a44e6e1]
- Updated dependencies [a44e6e1]
  - @aceshooting/lyra-flags@2.1.0

## 11.1.0

### Minor Changes

- 555154e: Four follow-ups to 11.0.0, all reported against the shipped release:

  - **`<lr-date-input>` forwards `presets`** to its nested picker, and exports the `presets` /
    `preset-button` parts. 11.0.0 landed the feature on the inline calendar only, while the compact
    text-field-plus-popover shape is the one a dashboard time filter actually uses — and there was no
    consumer-side escape hatch, since a CSS part cannot set a JS property.
  - **`<lr-date-picker>` gains a read-only `appliedPreset`**, reporting which preset produced the
    current value (`undefined` for a hand-picked range). 11.0.0 presented commit-path
    indistinguishability as a feature; it is, for serialization and clamping, but it destroyed the one
    fact a dashboard filter needs, because "Last 7 days" must stay *relative* across a reload.
    Re-deriving it by matching `value` is both the mapping table `presets` exists to delete and
    ambiguous — Today and This month coincide on the 1st.
  - **`LyraDateRangePreset.start`/`.end` are now optional**, meaning an open bound that resolves to
    `min`/`max`. The changelog and doc comment advertised an "All time" preset that the type could not
    express and `applyPreset` silently ignored, so that button rendered and did nothing. Where the
    matching `min`/`max` is unset the button now renders **disabled** rather than looking live.
  - **`<lr-lite-chart>` gains `showDataTable` and `dataTableToggle`** with the same semantics and the
    same `data-table-toggle` part as `<lr-chart>`. It extends `LyraElement` directly and inherited
    nothing from the 11.0.0 addition, which left the component that exists to avoid the Chart.js peers
    as the only one still needing a hand-rolled `<details>` — or Chart.js, for a button.

### Patch Changes

- 555154e: Corrected 14 documentation annotations that named **10.1.0**, a version that was never published.
  Those members shipped in 11.0.0: the docs were written while the release was expected to be a
  minor, the public-API semver gate then required a major, and nothing restamped the annotations.

  This was worse than a typo. A consumer on 10.0.1 reading "new in 10.1.0" either installs a version
  that does not exist, or assumes their 10.0.1 install already has the feature and debugs an
  attribute that silently does nothing — Lit accepts an unknown attribute without error, so there is
  no failure signal at all.

  Also corrects the generated per-component "Optional peers" header, which attributed peers reached
  only through an erased `import type`. `lr-lite-chart` was listed under all four Chart.js peers
  despite existing precisely to avoid them, inverting the choice the component offers; the same fix
  drops several other over-attributions (the d3 peers were credited to 12 tags and genuinely belong
  to 2). Side-effect registration edges still count, so transitive peers are unaffected.
- 555154e: **Fixes a silent focus-ring regression introduced in 11.0.0.** `--lr-focus-ring` was added as a
  composite outline shorthand explicitly to replace the Web Awesome `outline: var(--wa-focus-ring)`
  idiom — but it was declared only inside each component's `:host`, and that idiom is written by a
  consumer against their *own* element. At document scope the token resolved to the empty string,
  which makes the whole `outline` declaration invalid at computed-value time; because `outline` does
  not inherit, the ring did not fall back, it **disappeared**. No console warning, no test signal —
  a WCAG 2.4.7 failure that looked correct in review. The library evidenced the gap itself:
  `styles/native.css` hand-expanded the ring rather than using the composite.

  `theme.css` now declares `--lr-focus-ring` and its three parts at document scope, on `:root` and on
  both mode selectors — not `:root` alone, because `.lr-dark` / `[data-lr-theme='dark']` may sit on
  any ancestor, and resolving the colour once at `:root` would freeze the light value for a subtree
  that later switches. Components are unaffected: their own `:host` declarations still win, which is
  now asserted.

  `styles/native.css` deliberately keeps its fallback-chained expansion so it continues to work for
  consumers who load it without `theme.css`.

  Reported twice independently, with a live `getComputedStyle` repro showing `outlineStyle: "none"`.
- 2821af9: Three defects reported against 11.0.0:

  - **`<lr-pdf-viewer>` text layer, reopened.** 10.0.0 fixed only half of it. The chunk bounding
    guarded against copying an `undefined` style over a good one, but it also *rebuilt* the style map
    from the fonts of the items retained in that chunk — so a style PDF.js announces ahead of the
    items that use it was dropped and never re-sent. Both failures end the same way: a later lookup
    reads `undefined.vertical` and aborts the rest of the page. Measured by the reporter on a 9-page
    document as 4 affected pages and 101 of 271 spans orphaned. Now every own entry the chunk carries
    is copied and only `undefined` is skipped, so falsy-but-defined styles (`null`, `0`, `''`) still
    survive and an inherited `constructor`/`toString` stays unreachable.

  - **`<lr-table>` no longer dies on a column missing its `cell` renderer.** `cell` is typed and
    documented required, but columns arrive through a lit `.columns=${...}` binding, which `tsc` does
    not type-check — so required-ness was unenforced where it is written *and* unguarded at runtime.
    A single malformed column threw out of lit's `repeat`, taking the whole table down with a stack
    naming neither the column nor the table. It now degrades to an empty cell and reports once per
    column, naming the key, the tag and the missing member.

  - **The shared scratch canvas is created with `willReadFrequently`.** `<lr-heatmap>`'s colour
    resolution does a 1×1 `getImageData()` readback for any colour the canvas normalizes into a form
    its string parsers reject (`color-mix()`, `oklch()`, `lab()`), which Chrome warns about on every
    page carrying a heatmap. A `color-mix()` ramp takes that readback per cell.

## 11.0.0

### Major Changes

- 5066d4b: **Version note: this major carries no known breaking change for consumers.**

  Everything in this release is additive or a bug fix — no public member was removed, renamed, or
  had its behaviour or default altered. The major bump is taken because the public-API semver gate
  (`check:public-api`) classifies 328 changes as breaking, and every one of them is fingerprint or
  generated-type churn rather than a real break:

  - 248 `:dependencies` and 39 `:contract` hash changes — a symbol's transitive-dependency
    fingerprint moves whenever a widely-composed base class gains a member, so adding one property to
    `LyraChart` rewrites the hash of every chart subclass and every subpath that re-exports it.
  - 39 generated React/Vue/Svelte props **type strings**, widened by the newly added props. The
    differ compares the printed type text, which cannot distinguish an additive union widening from a
    removal.
  - 2 `lr-popover` `popup-role` default entries moving `null → 'dialog'`. The default did not change;
    this release simply documents it with `@default` for the first time, so the manifest records a
    value where it previously recorded none.

  Consumers upgrading from 10.x should not need code changes. If you use the generated framework
  prop types, the unions gained members but lost none.

### Minor Changes

- 2fb4af7: `<lr-chart>` (and every chart subclassing it — bar, line, pie, doughnut, radar, polar-area,
  scatter, bubble, histogram) and `<lr-box-plot>` gain `dataTableToggle` (`data-table-toggle`), which
  renders a localized disclosure button above the accessible data table.

  `showDataTable` was all-or-nothing: the table was either permanently screen-reader-only or
  permanently visible, so a sighted reader who wanted the numbers behind a chart could only get them
  if the consumer hand-rolled a `<details>` around a duplicated copy of the table. With the toggle
  on, `showDataTable` becomes the disclosure's initial state rather than its whole behavior. The
  table stays in the DOM in both states, so assistive technology never loses it, and the button
  carries `aria-expanded` plus `aria-controls`. A new `data-table-toggle` CSS part styles the
  control. Unset, nothing renders and behavior is unchanged.
- e084afb: `<lr-combobox>` now renders `<lr-option>`'s adornment slots, and gains `visibleOptions` for bounding
  the suggestion popup's height.

  **Adornments (a fixed contract, not just a new feature).** `<lr-option>` documented `start`/`end`
  slots, their `prefix`/`suffix` aliases, and four matching CSS parts — but `<lr-combobox>` builds its
  popup from normalized row *data* rather than from the light-DOM nodes, so inside the one component
  `<lr-option>` exists to feed, none of them rendered. A row could show a colour dot, a badge and a
  sub-line but not a 16px image, which is the one adornment a country, currency, language or user
  picker most often wants, and neither documented workaround was available (`::part(option)` cannot be
  compounded past the part, and `dot-color` rejects `url()`).

  Adornments now render as new `option-start` / `option-end` parts, inert and `aria-hidden` so they
  never join the option's accessible name. The nodes are **cloned** into the row, so the author's own
  `<lr-option>` subtree is left exactly where they put it rather than being moved into a shadow root
  as a side effect of opening a dropdown. Async `source` rows can supply the same `start`/`end`
  fields alongside the existing `icon`.

  **`visibleOptions`** (`visible-options`) bounds the popup to about that many rows, leaving the rest
  reachable by scrolling. It is measured from where row N actually starts, since a row's height varies
  with sub-lines, adornments and group labels. Unset, the listbox keeps exactly its previous
  max-height behavior.

  The doc comments on all three caps — `visibleOptions`, `maxRender`, and `maxOptionsVisible` — now
  each state how they differ from the other two, which was the confusion that prompted this.
- 3b3af14: `<lr-date-picker>` gains `presets`, a quick-range button row for the dashboard time-filter shape
  (Today / Last 7 days / Last 30 days / This month / All time).

  The pieces for this existed but were split across two components that each held half the contract:
  the date components had the calendar, locale and range logic but no preset affordance, while
  `<lr-time-range>` had exactly the wanted preset API but is a two-handle numeric brush with no date
  logic, so a caller had to map a time axis onto `[min, max]` themselves and got no calendar. Building
  it by hand meant a ~260-line control plus its own preset/custom state machine.

  `LyraDateRangePreset` is deliberately the same `label`/`start`/`end` shape as `TimeRangePreset`, so
  the library has one preset vocabulary rather than two — only the unit differs (ISO `YYYY-MM-DD`
  instead of numbers). Range mode only; unset renders nothing. Applying a preset commits through the
  same path a two-click selection uses, so ISO serialization, `min`/`max` clamping and the
  `input`-then-`change` pair are identical. A reversed preset normalizes, and a malformed one is
  ignored rather than clearing the value, so a bad entry in a config-driven list never reads as "the
  user picked nothing". New `presets` and `preset-button` CSS parts.
- c915980: Added `--lr-focus-ring`, a composite outline shorthand (`var(--lr-focus-ring-width) solid
  var(--lr-focus-ring-color)`) alongside the three existing parts, which stay exactly as they are.

  Web Awesome exposes `--wa-focus-ring` as a ready-made outline value, so the common consumer idiom
  is `outline: var(--wa-focus-ring)`. Migrating it meant hand-expanding every site, which is easy to
  get subtly wrong — omitting the `solid` keyword yields an outline that renders in some engines and
  not others — and each hand-expanded copy stops tracking any future change to how the ring is
  composed. `--lr-focus-ring-offset` stays separate because `outline-offset` is its own property, not
  part of the `outline` shorthand.

  `llms/tokens.md` also now documents why an ancestor `--lr-*` override does not survive a nested
  component boundary: every component re-derives that layer from `--lr-theme-*` on its own `:host`,
  so the override is reset at the first `lr-*` inside another `lr-*`'s shadow root and degrades
  silently. The `--lr-theme-*` input layer is the one that inherits.
- 3d7a6a5: `<lr-heatmap>` matrix mode gains `colLabelRotation` (`col-label-rotation`) and an `'auto'` value for
  `colLabelHeight` (`col-label-height`), giving column labels the escape hatch the row gutter got in
  10.0.0.

  Column labels were horizontal-only in a fixed 20px band, so in a dense matrix — where every column
  is far narrower than a typical label — adjacent labels collided and the axis became unreadable,
  with no rotation or angle property anywhere in the surface. Each label now rotates about an anchor
  at its own column's centre with the label's end at that anchor, so it leans back over the columns
  to its left and the last column's label cannot overflow the canvas. `col-label-height="auto"`
  measures the labels and projects their width through the rotation, so the band sizes itself.

  Unset, both are inert and painting is unchanged. Values outside `[0, 90]` clamp and non-finite
  values normalize to `0`. Rotation is deliberately not mirrored under `dir="rtl"`, matching the
  documented rule that both grid modes retain physical LTR geometry.
- 20728fb: `<lr-map>` gains a `'step'` choropleth interpolation and independent fill/stroke colours on
  `dataLayers` — the two declarative gaps that stopped an application migrating off a first-party
  MapLibre wrapper after every other property already matched.

  **`interpolation: 'step'`** emits maplibre's `['step', …]` instead of `['interpolate', …]`, giving
  discrete bands rather than a continuous ramp. A ramp is wrong whenever the legend advertises a fixed
  set of ranges with one swatch each: it puts colours on the map that appear nowhere in the legend and
  renders two regions in the same advertised band as visibly different colours. `stepBaseColor` sets
  the colour below the first threshold (which `['step', …]` requires) and defaults to the first stop's
  own colour.

  **`dataLayers[].color` / `.strokeColor`** override `tone` for the fill and for the line/circle
  layers respectively, falling back to `color` and then `tone`. They are separable because a fill and
  its outline want opposite things on a choropleth-plus-overlay map: the fill competes for area and
  must sit quiet, while the 1px outline competes with nothing and is the only thing keeping a no-data
  region's shape readable once the fill is that faint. Deriving one from the other measured 1.41:1
  against a light basemap, under WCAG 1.4.11's 3:1 floor for graphical objects. A `var(--lr-…)`
  reference is resolved against the host first, since MapLibre paints to a WebGL canvas and never sees
  the CSS cascade.

  Both are additive: an unset `interpolation` still interpolates linearly, and a `tone`-only data
  layer paints exactly as before.
- 4a701e7: `<lr-popover>` gains a third `popupRole` value, `none`, so the library can express the WAI-ARIA
  disclosure-navigation pattern. Previously `popupRole` was `dialog | menu` only, which left a header
  nav flyout with no correct option: `menu` announces "menu, menu item" and expects `menuitem`
  children, while a navigation flyout is a list of links, and `dialog` implies an interruptive
  surface. Consumers had to abandon the library's overlays and hand-roll a
  `button[aria-expanded][aria-controls]` plus a plain list.

  Under `popup-role="none"` the popup surface renders no `role` and no generated `aria-label`, and
  the trigger carries no `aria-haspopup`, so the slotted `<nav>` owns the semantics and the
  accessible name. Everything else — `aria-expanded`/`aria-controls`, light dismiss, Escape, focus
  return, positioning — is unchanged. Purely additive: `dialog` remains the default, and
  `lr-dropdown` still pins its own role to `menu`.

### Patch Changes

- e6ed0ca: The migration codemod now warns about four classes of `wa-*`/`sl-*` reference it does not rewrite,
  instead of leaving them silent: tag selectors inside a `` css`` `` tagged template, `::slotted()`,
  DOM selector strings reached through `this`/`this.shadowRoot`, and `--wa-*`/`--sl-*` custom
  properties.

  Each of these fails silently at runtime after a migration — a CSS rule keyed on a tag that no
  longer exists matches nothing, `::slotted()` likewise, `querySelector` returns null, and a `var()`
  naming a removed token falls back to its second argument or to nothing. Nothing throws, nothing
  fails a build, and a typechecker cannot see inside a template literal. Because `--check` is
  documented as a CI gate, the silence meant CI certified a migration that had visibly broken the
  component's styling.

  Tokens are deliberately reported rather than rewritten: the two spacing scales are offset by one
  step (Web Awesome `m` is 1rem, Lyra `m` is 0.75rem), so renaming by name alone silently tightens
  every gap, while mapping by value has no target for 1.5rem or 2.5rem. Warnings are filtered against
  the rewrites the same pass produced, so a reference the inventory does map is never both rewritten
  and warned about, and a self-declared `--wa-*` property (the consumer's own, merely sharing the
  prefix) is exempt.

  `<lr-dialog>`'s docs also now warn that `lr-close` is not a dialog-scoped name — nine components
  emit it, several of which are routinely nested inside a dialog, and library events bubble and are
  composed, so a listener bound on the dialog also receives a descendant's close.
- c5baec5: `<lr-flag>` now warns once in the console when `country`/`language` is set but no flag resolver has
  been registered, naming the offending code and the `flag-peer.js` import that fixes it. Previously
  this failed to the visible `[part="error"]` state in complete silence, which is indistinguishable
  from missing flag data — the resolver is deliberately absent from the core component's module
  graph, so an unimported peer entry is the single likeliest cause and was the hardest to diagnose.
  The warning is emitted once per resolver-registration generation, so a page of many flags does not
  repeat it. An already-resolved `src`, a registered resolver, and a well-formed-but-unmapped code
  (which is data, not a defect) all stay silent.
- b573859: The `lr-locale-picker` Storybook page now registers the optional flag peer, so its rows render real
  flags instead of silently empty frames. Found by the new `<lr-flag>` missing-resolver warning on its
  first run — `flag.stories.ts` had always imported `flag-peer.js` for exactly this reason, and the
  locale-picker page never did.
- c915980: The `lyra-ui-migrate` CLI no longer silently does nothing when launched through a package manager's
  bin shim. Its entry guard compared `process.argv[1]` to `import.meta.url` as raw paths; under pnpm
  the package directory is a symlink into the virtual store, so the two never matched and `run()`
  never executed. The process printed nothing — not even `--help` — rewrote nothing, wrote no report,
  and exited 0.

  The serious half is that `--check` is documented as a CI gate that "exits nonzero while rewrites or
  warnings remain". A silent exit 0 is indistinguishable from success, so on every pnpm project the
  gate passed unconditionally — worse than having no gate, because it is trusted. npm and yarn were
  unaffected, which is why it survived. The guard now compares realpaths, and a regression test
  invokes the CLI through a symlink that mimics the pnpm layout.

## 10.0.1

### Patch Changes

- 84a28c2: Fixed `lr-combobox`, `lr-token-input` and `lr-radio-button` declaring a
  `text-overflow: ellipsis` that could never fire.

  `text-overflow` only applies to content that overflows its line box inline. Each
  of these parts was left at `white-space: normal`, so the text wrapped instead of
  overflowing and the box never had horizontal overflow at any label length --
  `scrollWidth === clientWidth` in every case. `lr-combobox`'s and
  `lr-token-input`'s labels additionally set `overflow-wrap: anywhere`, which put
  the wrap *inside* a word.

  The visible effect was worst on `lr-combobox`, whose tag caps at
  `--tag-max-size` (80px by default): a selected `Received` rendered as `Receiv/ed`
  across two lines, and a wrapped tag row could overflow a trigger pinned with
  `--lr-combobox-trigger-height`.

  All three now carry `white-space: nowrap`, matching `lr-select`'s
  `[part='tag-label']`, which has always had it. Content that fits today is
  unchanged; content that used to wrap now truncates, which is what the existing
  declaration asked for.

  `--tag-max-size` still defaults to 80px on `lr-combobox` against `lr-select`'s
  12rem. That difference is deliberate for now -- changing it alters default
  rendering rather than fixing a dead declaration -- and is tracked separately.

## 10.0.0

### Major Changes

- c640e0a: **10.0.0.** This release removes the members deprecated during 9.x, which is the whole of its
  breaking surface. Everything else in 10.0.0 is additive — no component's default rendering changes,
  and no existing property, event, slot, part or CSS custom property was renamed or repointed.

  Removed, each with a like-for-like replacement that has shipped since 9.x:

  - `confirm()`: the `tone` option on `ConfirmOptions` → `variant`. (An earlier draft of this note
    attributed the rename to `<lr-confirm-bar>`; that component's `tone` → `variant` landed in 9.x
    and left no alias, so nothing changes there in 10.0.0. The member removed here is the one on the
    `confirm()` helper in `overlays/dialog/confirm.ts`.)
  - `<lr-swatch-picker>`: `options` → `items`, `label` → `accessibleLabel` (or the host `aria-label`),
    and the `SwatchOption` type → `SwatchPickerItem`.

  Deliberately **kept**, so migrating consumers are not caught out:

  - `<lr-icon>`'s `autoWidth` / `auto-width` stays, deprecation notice and all. Web Awesome's own
    pinned manifest still publishes `auto-width` on `wa-icon`, and a mirrored tag owes its whole
    upstream surface — dropping it classifies `wa-icon` as an `unsupported` mapping, which is a
    release blocker. Prefer `canvas="auto"`; the alias goes when upstream's does.
  - The same holds for **seven more** deprecated aliases whose records say `removalNotBefore: 10.0.0`
    and which are therefore, on paper, removable now: the `base` part on `<lr-accordion-item>`,
    `<lr-file-input>`, `<lr-qr-code>`, `<lr-sparkline>` and `<lr-video-playlist>`, and the `label`
    part on `<lr-file-input>` and `<lr-known-date>`. Every one is published by the pinned upstream
    manifest, and removing them was measured against the real comparison pipeline: each produces an
    `unsupported` mapping. `<lr-qr-code>`'s `base` is the sharpest case — `sl-qr-code` publishes it as
    its ONLY part and does not deprecate it at all.

    That `10.0.0` is not a plan anyone made. Policy requires a removal to clear one whole subsequent
    major, so `10.0.0` is simply the earliest legal value for a deprecation dating to 8.x. The records
    now say so, because read literally they promised a removal that will never happen while upstream
    ships the same names.

  - `lr-geojson-view` stays. It is a permanent compatibility class for the pre-v9 tag, not a
    deprecation.
  - `base` / `wrapper` on `<lr-switch>` and `<lr-checkbox>` stay pointing at the control owner. They
    are Web Awesome / Shoelace compatibility names, and the library's parity contract is that a
    mirrored name keeps its meaning; `row` (new in this release) names the row wrapper instead.
- 082b885: **10.0.0.** A set of public-contract corrections that need a major boundary, plus a larger set of
  additive fixes. Breaking items first; each one states what to change if you relied on the old
  behavior.

  ### Breaking

  **`<lr-calendar>` derives the week start from the locale.** `firstDayOfWeek` defaulted to a
  hardcoded `1` (Monday) and never consulted the locale — while the very same component already
  threaded `effectiveLocale` through its weekday *label* formatting. Measured, same `en-US` page:
  `<lr-calendar>` rendered `Mon Tue Wed…` while `<lr-date-picker>` rendered `Sun Mon Tue…`. The
  default is now `'auto'`, resolved through the same `resolveFirstDayOfWeek()` contract
  `<lr-date-picker>`/`<lr-date-input>` already use. The type is now exactly
  `'auto' | 'sun' | … | 'sat'`: the bare `0`–`6` integer form is gone rather than kept as a second
  spelling, so there is one way to express a week start instead of two that had to be sanitized and
  wrapped against each other. Replace `first-day-of-week="1"` with `first-day-of-week="mon"` to keep
  the old rendering. There is no `wa-calendar`, so no upstream parity is affected.

  **`<lr-progress-ring>` gains `show-value`, defaulting to `false`.** A determinate ring rendered its
  percentage unconditionally, with no way to suppress it short of slotting replacement content — while
  its sibling `<lr-progress-bar>` has had opt-in `show-value` all along, and the reference has always
  claimed the two share "the same value contract". They now actually do. Add `show-value` to keep the
  percentage. `aria-valuetext` still carries it either way, so the accessible value is unchanged.

  **`<lr-media-card>`'s `alt` becomes optional, so a decorative image is expressible.** It was
  `alt: string = ''`, and the render read `this.alt || this.filename || <localized generic>` — so an
  explicit `alt=""` was indistinguishable from an absent one and came out as `alt="Image attachment"`.
  There was no way to mark the image decorative, which is the one thing `alt=""` means in HTML. The
  type is now `alt?: string` and the render uses `??`, matching `<lr-image-viewer>` and
  `<lr-document-preview>`, which already documented that contract. Omitting `alt` is unchanged; only
  the value read back from an unset property differs (`''` becomes `undefined`), so a consumer
  comparing `el.alt === ''` should read `el.alt ?? ''`. The nested `<video controls>` label
  deliberately does NOT follow: an empty `alt` there would leave an interactive player with no
  accessible name, and "decorative" is not a state a media control can be in.

  **`<lr-attachment-chip>`'s `lr-preview-request` is no longer cancelable.** It was advertised as a
  veto point, but the chip never read `defaultPrevented` and owns no preview default action to
  cancel — its own docs say it "never registers or owns a viewer/overlay" — so `preventDefault()` was
  a no-op. The flag is removed rather than left as a promise the component cannot keep.

  ### Event vocabulary: one name per event

  Several events had two spellings. 10.0.0 keeps the canonical name and **removes the old one
  outright** rather than shipping a deprecated alias into a library that has no released consumers
  yet — a dual-emit alias is a permanent tax paid to protect users who do not exist.

  Rename the listener; the detail object is unchanged in every case.

  | Removed | Use instead | On |
  |---|---|---|
  | `lr-entity-activate` | `lr-entity-select` | `<lr-entity-card>`, `<lr-entity-chip>`, `<lr-neighbor-list>` |
  | `lr-visible-range-changed` | `lr-visible-range-change` | `<lr-virtual-list>` |
  | `lr-run-select` | `lr-run-change` | `<lr-rag-eval-dashboard>` |
  | `lr-dialog-close` | `lr-close` | `<lr-dialog>`, `<lr-drawer>` |

  `lr-visible-range-changed` was the only past-tense `-changed` spelling among 58 `-change`-family
  events, so a convention-driven listener silently missed it — on a component embedded in ten viewers.

  Two deliberate non-removals. `<lr-community-card>` and `<lr-path-strip>` keep `lr-entity-activate`:
  it is their only name and never was an alias. `<lr-accordion>` keeps `lr-expand`/`lr-collapse`,
  which mirror `wa-accordion`'s real event names — removing them would have broken upstream parity
  rather than tidied it. `lr-citation-badge` was also left alone: `lr-citation-select` is an
  established *container*-level event with a richer `{ citation }` detail that containers translate
  its `{ sourceId, index }` into, so unifying there would have delivered two shapes under one name.

  ### Interaction, focus and visibility corrections

  A sweep with a CSS-specificity analyzer found rules that were supposed to win losing to another rule
  in the same shadow stylesheet, so their declarations never applied. The code read correctly and the
  tests were green; only a rendered probe showed the difference.

  - **The keyboard highlight is visible on the selected row again** in `<lr-select>`, `<lr-combobox>`,
    `<lr-model-select>` and `<lr-voice-picker>`. Each had `[aria-selected="true"]` written after the
    active-descendant rule at equal specificity, so arrow-keying onto the already-selected option
    produced no visible highlight at all.
  - **`appearance="filled"` has a focus indicator again** on `<lr-combobox>` and `<lr-date-input>`.
    Both had none: the appearance rule out-ranked `:focus-within`, and the only `outline` in the focus
    rule was `solid transparent`. Both now express appearance as private custom properties, so no
    `[part]` rule can out-rank another and the failure mode is structurally impossible.
  - **Pointer feedback restored** where a state rule or a resting rule was swallowing it:
    `<lr-code-block>`'s line-gutter button (neither hover nor press, ever), `<lr-pagination>`'s page
    input, `<lr-table>`'s sticky sortable header, `<lr-time-range>`'s active preset,
    `<lr-agent-trace>`'s active handoff, `<lr-compare-panel>`'s cast vote, `<lr-flow-canvas>`'s
    selected edge, `<lr-conversation-item>`'s open session, `<lr-option>`, `<lr-entity-chip>` and
    `<lr-approval-queue>`.
  - **Focus rings restored** on `<lr-calendar>`'s today cell, `<lr-sequence-strip>`'s selected cell,
    `<lr-embedding-explorer>`'s selected point, and `<lr-dashboard-grid>`/`<lr-flow-canvas>` cells in a
    collision or drop state.
  - **`hidden` works again** where the component's own stylesheet was defeating the UA default:
    `<lr-flag>` painted a full-size broken image beside its skeleton while loading, `<lr-video>` kept
    the controls play button both painted and focusable behind a poster, and nine components let a
    consumer's `hidden` slotted child stay visible.
  - **Disabled controls look disabled**: `<lr-entity-chip>` and `<lr-approval-queue>` rendered their
    disabled buttons pixel-identical to enabled ones, with a pointer cursor and full hover feedback.
  - **`<lr-random-content>` actually hides** the candidates it is not showing; its rotation was
    previously observable only to assistive technology.
  - **`<lr-video>` keeps captions** for a `<track>` with no `kind` attribute, whose HTML missing-value
    default is `subtitles`.

  ### Additive

  - **`lr-search-change` detail is consistent again.** `<lr-terminal>` and `<lr-av-player>` now emit
    the canonical `LyraSearchChangeDetail` including `matchCountExact`, which 18 of 21 emitters already
    did. This matters most on `<lr-terminal>`, which truncates at 10,000 matches and previously had no
    way to signal that its count was a lower bound. `<lr-knowledge-graph-explorer>`'s detail is now exactly
    `{ query, matchCount, matchCountExact }` — `searchQuery` is replaced by the canonical `query`
    rather than carried beside it; it deliberately has no `activeIndex`, being a live node filter
    rather than a cursor-based search. (The `searchQuery` *property* is unaffected.)
  - **`<lr-token-input>` can veto all three mutations.** `lr-add` and `lr-token-edit` are now
    cancelable, matching `lr-remove`, which already was. A vetoed add keeps the typed draft so the user
    can correct it; a vetoed edit leaves the inline editor open with the edited text intact.
  - **`<lr-dialog>`'s close event is `lr-close`** (`DialogCloseReason` detail, cancelable);
    `<lr-drawer>` inherits it. See the removal table above.
  - **`<lr-accordion>` also emits a cancelable `lr-toggle-request`** (`{ collapsed, item }`) alongside
    its upstream-mirroring `lr-expand`/`lr-collapse`, matching the convention
    `<lr-code-block>`/`<lr-chat-message>` use. `preventDefault()` on either vetoes the transition.
  - **`<lr-popover>` gains `disabled`.** Both `<lr-tooltip>` and its own subclass `<lr-dropdown>` had
    it; the base did not. `<lr-dropdown>` now inherits it, with byte-identical behavior.
  - **`<lr-table>` emits `lr-selection-change`** when a `selectionMode` flip to `'single'` coerces a
    multi-row selection down to one key — previously a silent mutation a host mirroring the event could
    not see.
  - **`<lr-command-palette>` re-emits `focus`/`blur`** from its search input; native ones neither bubble
    nor cross the shadow boundary.
  - **`PptxViewerAdapter` and friends are importable.** `pptx-loader.js` had no `package.json#exports`
    entry despite the reference documenting the import, so it failed with
    `ERR_PACKAGE_PATH_NOT_EXPORTED`. A new check now requires every helper module to be classified
    public or internal, closing the same class that stranded `archive-viewer-register.js` in 9.0.0.
  - **`PlaceSync`** is re-exported from `dropdown.class.js`, and ~13 constituent types are re-exported
    from the composite components whose public properties use them.
  - **`<lr-knowledge-graph-explorer>` no longer announces on mount.** A preset `search-query` fired its
    live region before any user action.

### Minor Changes

- 357ee35: `<lr-chart>`: declarative reference lines and shaded bands via a new `annotations` property.

  Marking a threshold, an event year, a regime change or a highlighted period previously meant
  importing `chartjs-plugin-annotation` yourself and wiring it through the raw `config` passthrough —
  the point where a declarative component dropped the user into raw Chart.js, for one of the most
  common things anyone needs on a time series.

  - `annotations: readonly LyraChartAnnotation[]`, where `LyraChartAnnotation` is
    `{ axis?: 'x' | 'y'; value?: number; from?: number; to?: number; label?: string; tone?: 'neutral'
    | 'brand' | 'success' | 'warning' | 'danger' }`. A finite `value` renders a reference line on that
    axis; a finite `from`/`to` pair renders a band bounded on that axis and spanning the other. `axis`
    defaults to `'y'`.
  - Entries specifying neither a finite value nor a finite range are dropped rather than handed to
    Chart.js, where they render nothing at best; a reversed range is normalized rather than rejected.
  - Tones resolve through the same `getComputedStyle`-then-`resolveCanvasColor` path every other chart
    color takes, since canvas silently ignores an unparseable `strokeStyle`/`fillStyle`.
  - Labelled entries are included in the generated accessible description, mirroring `lr-heatmap`. The
    label is consumer-supplied text and so is not localized; an unlabelled line has no nameable
    meaning to announce beyond a coordinate.
  - The optional `chartjs-plugin-annotation` peer loads on first actual demand, so a page with no
    annotated charts never downloads it. Without it installed the chart still renders and a single
    console warning explains the no-op — the same fail-closed contract `data-labels` uses.

  On the filed concern about Chart.js's page-wide singleton registry: this plugin is registered
  globally, like `chartjs-plugin-zoom` and unlike `chartjs-plugin-datalabels`. The distinction is that
  datalabels draws on every dataset the moment it is globally registered, whereas annotation draws
  nothing at all unless a chart supplies annotation options — so the registration is unobservable to a
  chart that sets none, covered by an explicit test. It also *has* to be global: registration is what
  installs the plugin's own element types and defaults, and an inline `config.plugins` entry skips
  that, leaving the plugin to throw on missing `borderWidth`/`borderCapStyle` the moment it draws.
- 8e3f602: `<lr-chart>`: add a logarithmic value axis via a new `scaleType` property.

  The core loader registered `LinearScale`, `CategoryScale` and `RadialLinearScale` but never
  Chart.js's `LogarithmicScale`, so a logarithmic axis was unreachable — there was no property for it,
  and the raw `config` passthrough could not supply one either, because Chart.js rejects an
  unregistered scale type at construction. Any dataset spanning several orders of magnitude (prices,
  growth, population, latency percentiles, file sizes) could not be charted honestly, since a linear
  axis collapses everything below the maximum into the baseline.

  - `scaleType: 'linear' | 'logarithmic' = 'linear'` (attribute `scale-type`, type
    `LyraChartScaleType`, exported from the root barrel) targets the **value** axis; the categorical
    axis is never affected. Inherited by `lr-line-chart`, `lr-scatter-chart` and `lr-bar-chart`, and
    applied to the secondary `y2` axis when one is present.
  - `beginAtZero` is not forwarded on a logarithmic axis, since `log(0)` is `-Infinity` and Chart.js
    would otherwise be handed a bound it cannot place.
  - `LogarithmicScale` is registered with the core rather than behind the feature loader: unlike the
    zoom and datalabels plugins it is not a separate package, so it already ships inside the
    `chart.js` module namespace the loader imports and costs no extra download weight.

  Default is unchanged and covered by an explicit unset test.
- 744da58: Four consumer-filed defects, plus one the sweep for the same defect class turned up.

  **`<lr-checkbox-group>`: `value` is settable.** It was a getter with no setter. Reading was fine,
  but `.value=${...}` — the binding every other form control here accepts — compiles to a plain
  property assignment that `readonly` cannot catch at the binding site, so it threw
  "Cannot set property value ... which has only a getter" from inside lit-html during a *later*
  render, blaming framework internals rather than the offending line. Assigning now mirrors the array
  onto the owned checkboxes; it is controlled input, so it emits no `lr-change`, and an assignment
  made before the children exist is applied once they arrive.

  **`<lr-time-input>`: `valueAsNumber` and `valueAsDate` are settable.** Nobody filed this — sweeping
  the library for the same "public getter a consumer would naturally bind, with no setter" shape found
  it. `<lr-input>`, `<lr-date-picker>`, `<lr-slider>` and `<lr-known-date>` all ship both, and the
  native `<input type="time">` this mirrors accepts both; `<lr-time-input>` was the lone outlier.
  Out-of-range or non-finite figures clear the field rather than wrapping into a different time.

  **`<lr-map>`: `lr-map-click` resolves `feature` against `dataLayers`, not only the choropleth.**
  Clicking a shape painted through `dataLayers` reported `feature: undefined`, indistinguishable from
  clicking empty ocean — which broke the pattern the two properties invite: choropleth for features
  that have a value, a data layer for features that exist but have none. The detail gains `origin`
  (`'choropleth' | 'data-layer'`) and `sourceId` (the authored `dataLayers[].sourceId`) so a hit is
  attributable.

  **`<lr-map>`: an untileable numeric feature property is now named up front.** MapLibre GL tiles
  GeoJSON through a worker, where an oversized integer throws "Given varint doesn't fit into 10
  bytes" — uncatchable by the app, invisible except as an opaque message, and with the rest of the
  layer still painting. Sources are pre-scanned and any property beyond `Number.MAX_SAFE_INTEGER`
  draws a dev-mode warning naming the feature and property.

  **`<lr-heatmap>`: the matrix row-label gutter is configurable, and labels truncate.** It was a
  hardcoded 60px with no measurement, so a longer row label was clipped mid-word by whatever was
  painted beside it on the canvas — which reads as a rendering fault. `rowLabelWidth` now pins a
  width or takes `'auto'` to measure the widest label and size to fit (floored at 60, capped at 40%
  of the host so one label cannot squeeze out the cells it describes), `colLabelHeight` does the same
  for the column band, and a label too wide for the resolved gutter is truncated with an ellipsis
  instead of clipped. The default stays 60: auto-sizing every chart would silently reflow layouts
  whose labels already fit, which is a bigger change than the clipping it fixes.
- d92bfb2: Two dev-mode defects that shipped in 9.x, plus the per-point chart color cost behind them.

  **The unknown-attribute diagnostic no longer reports a component's own API as a mistake.**
  Components can now declare a `knownUnobservedAttributes` static for attributes they own without
  observing, and four do. Without it the diagnostic fired on correct markup and on state components
  set on themselves:

  - `<lr-page disable-sticky="header">` is documented public API read only by
    `:host([disable-sticky~="..."])` rules, so it has no reactive property — authoring it correctly
    drew a warning saying it was wrong.
  - `<lr-animated-image>` (`playing`), `<lr-menu-item>` (`submenu-open`) and `<lr-app-rail>`
    (`mode`, `dragging`) reflect read-only state onto their own host. Each reported its own output
    as an unknown attribute, in every consumer app, the moment that state turned on.

  **Per-point chart colors are resolved once per distinct color, not once per point.**
  `resolveCanvasColor` inserts a probe element and forces a synchronous style recalculation on every
  call, which `<lr-chart>` paid for each entry of a series' `color`, `segmentColors` and
  `pointColors` arrays — 2,000 probe insertions for a 2,000-point series, before drawing anything.
  The new `resolveCanvasColors` memoizes by color string across the batch, and authored ramps are
  typically a handful of distinct colors repeated across many points. The cache lives for one call,
  so a later draw still picks up live `--lr-*` theme changes.

  **`<lr-tooltip>` no longer schedules a wasted second render on close.** Its `anchorPositioned`
  reset moved from `updated()` to `willUpdate()`, where it belongs — nothing visible changes, since
  that render already hides the popup via `open`.
- 19d15f6: Five consumer-reported gaps, several of them follow-ups to the charts/timeline work in this release.

  **`<lr-chart>`: the formatter now receives the `export` and `spoken` surfaces.** `LyraChartFormatSurface`
  has always declared both and `<lr-lite-chart>` has always emitted them, but `lr-chart` only ever
  passed `visual` and `table` — so one formatter written against the documented contract behaved
  differently depending on which chart rendered it, silently, in exactly the places unit formatting
  matters most. CSV cells now route through `export` and the live announcement through `spoken`. With
  no formatter installed, CSV cells stay the raw machine-readable number (no locale grouping a
  spreadsheet would misparse) and announcements keep their locale format.

  **`<lr-map>`: choropleth interpolation is selectable.** The fill expression was hard-coded to
  `['interpolate', ['linear'], …]`, so a heavy-tailed quantity — price, population, income — put every
  value below the maximum into the first colour band. `LyraMapChoroplethLayer.interpolation`
  (`'linear' | 'logarithmic'`, default `'linear'`) emits maplibre's own
  `['interpolate', ['exponential', 0.25], …]`, exposing an existing capability rather than adding one.
  **`stops` stay in the data's own units**, so the legend keeps reading in real values instead of log
  units.

  **`<lr-heatmap>`: a dev-mode warning when `legendStops` and `colorSteps` disagree.** Both are
  deliberate and independent — that independence is what lets a `cellColor` consumer describe a ramp
  the grid no longer uses — but nothing checked they described the same thing, and a legend that
  confidently labels colours the cells never use is worse than no legend. Warning rather than deriving
  one from the other: deriving would silently change what an existing `colorSteps`-only consumer sees
  and would break that escape hatch. Caption-only stops (the `less ▢▢▢▢ more` shape) claim no colour
  and never warn.

  **`<lr-timeline>`: `collision="stack"` for dense `scale="time"` chronologies.** Coincident items
  overlapped, which is the common case rather than the exception at realistic density. `'stack'` steps
  each colliding item one lane along the cross axis (`--lr-timeline-collision-offset`); an isolated
  item returns to lane 0 rather than inheriting a preceding run's depth. No `'cluster'` mode: collapsing
  items into one expandable marker needs a selection model and click events this deliberately passive
  component does not have.

  **`<lr-sequence-strip>`: activation and a controlled selection.** The strip read as pickable but had
  no click handling and no event to hook. `lr-item-activate` (`detail: { index, id, item }`) fires on
  click and on Enter/Space at the roving-tabindex focus, and `selectedIndex` marks the current item
  with `aria-current` and `data-selected`. Controlled on purpose: activation does not move the
  selection itself, so the strip cannot drift from a playback index it does not own. The selection is
  drawn as a ring, not a tint — a cell's background is data (its category colour).

  All five are additive; unset, every component renders as before.
- b3b9d30: `<lr-flag>`: accept ISO 3166-1 alpha-3 country codes, and render a neutral fallback for codes that
  cannot resolve.

  Two related consumer reports.

  **Alpha-3.** `country` took alpha-2 only, while public statistical sources — World Bank, UN, IMF and
  most open-data portals — key country records on alpha-3, so every consumer plotting country-level
  data shipped and maintained its own ~249-row conversion table purely to satisfy this component.
  `country` now accepts either: length alone disambiguates the two code spaces, so no format hint or
  new API is needed. The 249 officially-assigned mappings are packed as a ~1.2 KB fixed-width string
  and expanded into a lookup lazily on the first alpha-3 use, so an alpha-2-only app never pays for
  them. Withdrawn and user-assigned codes deliberately do **not** map to a successor state — a
  dissolved federation has no current flag, so it takes the unresolved path below.

  **Unresolved ≠ error.** An unresolvable code rendered localized error text into `[part="error"]` and
  reflected `data-error`. That is right for a genuine mistake, but historical and longitudinal
  datasets legitimately contain states with no current ISO code, and in a table or card grid those
  rows want a neutral placeholder occupying the same footprint, not wording that reads to a user as a
  bug. Styling `[part="error"]` could not fix it, because the localized string is contained text
  rather than substitutable content.

  - A new `fallback` slot renders in place of the flag for an unresolvable code, and a `fallback`
    property takes a placeholder image URL (rendered as `[part="fallback-image"]`) when no slot
    content is supplied.
  - The host now reflects `data-unresolved` separately from `data-error`, so the two cases can be
    styled apart.

  Both additive: a resolvable code renders exactly as before, covered by an explicit inert-by-default
  test.
- 990f4d6: `<lr-heatmap>`: support signed data via new `domain` and `midpoint` properties, and stop dropping
  the negative half of a signed dataset.

  Two related reports. The ramp always spanned the data's own `min`…`max`, so two heatmaps of
  comparable data could not share a scale — each silently normalized to its own extremes — and a
  diverging palette could not be centred: with data running -4.93 to +28.8, the neutral colour landed
  at 15% of the range rather than on zero, painting "no change" onto a substantial decrease.
  Separately, the cell-fill guard was `value < 0 || !Number.isFinite(value)`, so *every* negative
  rendered as no-data, not just the documented `-1` sentinel — indistinguishable from a genuinely
  missing cell, and silent (32.7% of cells in the reporter's dataset).

  - `domain?: [number, number]` pins the ramp's input domain, so comparable charts can share a scale.
    A reversed pair is normalized; a degenerate or non-finite one falls back to the derived range.
  - `midpoint?: number` anchors a diverging ramp's neutral colour, scaling the two halves
    independently (`lo`→0, `midpoint`→0.5, `hi`→1). A midpoint outside the domain degrades to plain
    normalization rather than distorting the ramp.
  - Setting either one opts into **signed data**, where only a non-finite value is no-data. That
    gating is deliberate: `-1` is the long-documented sentinel and a matrix of counts has no
    meaningful negative, so declaring a domain or midpoint is what disambiguates the two. With
    neither set, behavior is byte-identical to before — covered by an explicit unset-regression test.
  - A structurally absent matrix cell now reads as `NaN` in signed mode (non-finite is no-data in
    both modes), so it stays a hole while a real `-1` beside it renders on the ramp. The default
    mode still resolves an absent cell to `-1`, keeping `valueAt()` and the `lr-cell-click` payload
    unchanged.
  - The accessible cell labels track the painted contract, so a rendered negative is announced with
    its value instead of "no data".
  - `scale="sqrt"` continues to reject negatives — a square root of a negative has no meaning — now
    explicitly rather than as a side effect of the shared guard.
- 17b540a: `<lr-lite-chart>`: add a base-10 `scale="logarithmic"` value axis.

  The dependency-free SVG chart does not extend `LyraChart`, so it did not inherit the `scaleType`
  support added for the Chart.js-backed charts, leaving no way to plot data spanning several orders of
  magnitude honestly — a linear axis collapses everything below the maximum into the baseline.

  - `scale` now accepts `'logarithmic'` alongside `'linear'` and `'sqrt'`, defaulting to `'linear'`.
  - Unlike `'sqrt'` (which compresses bars only, by long-standing design), the logarithmic axis
    applies to **bars, line points and gridlines alike** — a log axis whose gridlines stayed linear
    would misrepresent the plot. All three now resolve through one `valueFraction()` dispatcher so the
    scale can never apply to some marks and not others.
  - Its lower bound is the smallest *positive* datum, not the linear `lo`. `beginAtZero` defaults to
    true, so `lo` is normally `0`, which has no logarithm; deriving the floor from the data is what
    makes a 1…1000 series span three even decades instead of collapsing onto one. Measured: decade
    gaps of 80.7/80.6/80.7px versus linear's 2.2/21.8/217.8px on the same data.
  - Zero and negative values pin to the axis floor rather than reaching the SVG as `-Infinity`, which
    would blank the series — this renderer has no Chart.js-style "drop the point" fallback. A
    degenerate domain falls back to the linear fraction.

  `'linear'` and `'sqrt'` render exactly as before, covered by an explicit unchanged-default test.
- 1b0aa52: `<lr-map>`: render a continuous choropleth legend, via a new `legendGradient` property and a
  `legend` slot.

  `choropleth` builds an interpolated fill expression from `stops` — a continuous ramp — but `legend`
  accepted only `{ color, label, pattern }` rows rendered as discrete swatches, and the component
  exposed no slots. The standard key for a choropleth (a gradient bar with endpoint ticks) could not
  be rendered inside the component that produces the gradient, so a consumer had to draw a second,
  unaligned legend outside the map and keep its stops manually in sync with the layer's.

  - `legendGradient: readonly (readonly [number, string])[]` takes the same `[value, color]` shape as
    `choropleth.stops`, so the usual assignment is `map.legendGradient = myChoropleth.stops` and the
    key cannot drift from the layer it describes. Stops are sorted ascending, bounded to 64, and
    filtered to finite values with a CSS-parsable color; fewer than two usable stops render no bar,
    since a one-stop "gradient" is a flat block that describes nothing. Each stop sits at its true
    proportion of the value range rather than being evenly spaced.
  - `legendGradientLoLabel` / `legendGradientHiLabel` override the endpoint captions, which otherwise
    default to the lowest/highest stop value in the component's own locale-aware formatting.
  - New `legend-gradient`, `legend-lo` and `legend-hi` parts, named to mirror `lr-heatmap`'s gradient
    legend as the request asked, so one styling vocabulary covers both. The bar is `aria-hidden` and
    `inert`; the captions carry the meaning. It mirrors under RTL like the heatmap's does.
  - A new `legend` slot renders custom legend content inside the panel's own layout, so it stays
    positioned with the map. Supplying it opens the panel even when both legend inputs are empty.

  All additive: with none of them set the component renders exactly as before, covered by an explicit
  unset test.
- 1625356: Ship an optional `reservations.css` stylesheet that prevents layout shift from lazy-upgrading
  elements, and document the library's scope boundaries.

  An undefined custom element is an inline box with no intrinsic size, so every `lr-*` in the initial
  viewport contributes a reflow as its definition loads; components that additionally defer on an
  optional peer (`lr-chart`, `lr-map`, `lr-flag`, `lr-flow-canvas`, `lr-knowledge-graph-explorer`)
  can cost a second shift when the peer resolves. Each is individually well-behaved — the aggregate on
  a first paint is what costs a Cumulative Layout Shift score. Until now every consumer derived its own
  `:not(:defined)` sizing rules per component by measurement, and those rules rotted silently whenever
  a component's default dimensions changed.

  ```css
  @import "@aceshooting/lyra-ui/reservations.css";
  ```

  - Reserves each component's intrinsic footprint before upgrade, styling **only** `:not(:defined)`
    elements inside an `@layer lr-reservations`, so it is inert the moment a definition upgrades and
    can never fight a component's own layout. No colors, no `:root` rules.
  - Every reservation is expressed with the **same custom property and fallback token the component's
    own stylesheet uses** (`--lr-chart-height`/`--lr-size-280px`, `--lr-flag-aspect-ratio`,
    `--lr-form-control-height`, …). That is what makes it worth shipping rather than documenting
    measured pixels: the reservations track the components, and theming a component re-themes its
    reservation with it.
  - Reservations target each component's *final* default size rather than its skeleton's, so a
    skeleton-to-content swap stays stable too.

  `llms/shared.md` gains a matching CLS section with the hand-rolled equivalent for consumers who
  prefer their own rules, plus a new **Scope: what this library does not provide** section stating the
  boundaries explicitly — client-side routing (there is no router and no route outlet; the navigation
  components expose active state as ordinary properties to be driven by the application's own router),
  data fetching/state management, and form-submission orchestration.
- 870ed4f: `<lr-switch>` and `<lr-checkbox>`: expose the row wrapper as a new `row` CSS part.

  Both controls render the track/box owner and the rich label as *siblings* inside a wrapper element
  that carried no `part` at all, while `base` names the owner box rather than the row. A consumer
  laying out a column of switches therefore had no selector for "the row": `inline-size: 100%` on any
  part inside it resolved against a shrink-to-fit parent, and because the owner box centers its track
  and its width tracks the label's, a longer label shifted the track's x-position from row to row —
  visibly ragged.

  `row` names the real wrapper, so `::part(row)` can stretch or align it. `base`/`switch`/`wrapper`
  and `base`/`checkbox` keep their existing nodes and meaning — they are documented Web Awesome /
  Shoelace compatibility names, so repointing them would have broken shipped consumers. This is
  purely additive; an unstyled control renders identically.
- 8cb3545: Four more consumer-filed defects, two per component.

  **`<lr-table>`: cell links are themeable.** A column's `cell(row)` renders its TemplateResult inside
  the component's shadow root, so an anchor it returns is unreachable from page CSS — and `::part()`
  cannot select past the first compound selector to reach it either. It computed to the UA default
  link blue, the one colour on the page belonging to no design system. Cells now take
  `--lr-table-cell-color`, and a cell anchor takes `--lr-table-cell-link-color` (brand by default)
  plus `--lr-table-cell-link-hover-color`. `:where()` keeps specificity at zero so an inline style on
  the returned anchor still wins, and `revert` hands the UA default back.

  **`<lr-table>`: `scroll-mode="page"` makes an uncapped table's sticky header work.** `[part="base"]`
  was unconditionally `overflow: auto`, which makes it the sticky containing block for the header
  whether or not anything can scroll in it — so with no `--lr-table-max-height` the header scrolled
  away with the page, and an uncapped page-scrolling table and a pinned header were mutually
  exclusive. That is a real CSS constraint rather than an oversight: a scroll container clips *both*
  axes. The fix is therefore an explicit opt-in, not a changed default, since dropping the overflow
  unconditionally would cost every uncapped wide table its horizontal scrolling.

  **`<lr-map>`: a guarded `maxBounds`.** Calling `map.setMaxBounds()` through the `.map` escape hatch
  can wedge maplibre-gl at a sub-1 fractional zoom in a wide container: `getZoom()` returns `null`
  permanently, every frame throws from inside the peer's matrix math, and the canvas never paints
  again — a blank map, with nothing thrown at the call site. The property applies the same call, reads
  the camera back, and reverts if it did not survive, so the worst case is an unconstrained map plus a
  dev-mode warning.

  **`<lr-map>`: property-only choropleth updates no longer re-tile the whole source.** `setData()`
  re-tiles unconditionally, which is invisible on a static map and expensive on an animated one. When
  an update changes only feature properties, the component now emits maplibre-gl's incremental
  `updateData()`. The fast path requires the same feature count, an addressable `id` per feature, and
  geometry that is the *same object* as last time — a deep compare would cost about what the re-tile
  costs, and a false positive would paint stale geometry. Anything else falls back to `setData()`.
- 10b7d14: `<lr-timeline>`: position items along a real time axis with the new `scale="time"` mode.

  The timeline was an evenly-spaced sequence in which `timestamp` was rendered as text but never used
  for placement, so a chronology spanning a long period lost the main thing a timeline conveys — two
  events weeks apart and the next decades later all looked equidistant, and the shape of the history
  was invisible.

  - `scale: 'flow' | 'time' = 'flow'` (type `LyraTimelineScale`, exported from the root barrel).
    `'flow'` is today's layout, unchanged and still the default. `'time'` positions each item at its
    true proportion of the range.
  - `rangeStart` / `rangeEnd` pin the axis instead of deriving it from the earliest and latest items;
    a reversed or non-finite pair falls back to the derived range.
  - `--lr-timeline-time-extent` (default `var(--lr-size-20rem)`) sets the distance to distribute
    along — `block-size` when vertical, `inline-size` when horizontal. Items are absolutely
    positioned, and a percentage against an auto-sized track would resolve to zero.
  - An item with no parseable `timestamp` — including one supplied only through the `timestamp` slot,
    which carries no machine-readable instant — keeps document order and is spread evenly, so a
    partially-timestamped list degrades instead of stacking every unknown at the origin.
  - Positions are written to each child as a private `--_lr-timeline-item-offset` custom property and
    removed again when switching back to `'flow'`, so the component still never alters its children's
    content or structure.

  Scope note: this covers the request's preferred option. Items sharing an instant overlap rather than
  being fanned into lanes — the denser case (parallel lanes by category, a brushable/zoomable range,
  per-event click events, collision handling) would change this component's deliberately passive,
  zero-event contract, so it belongs in a sibling component with its own design, not here.

### Patch Changes

- c174d2d: Fix three defects found while auditing test coverage:

  - `<lr-chat-message>`: with `actions-position="outside"`, the slotted actions row is a sibling of
    the bubble rather than a flex item nested inside the footer, so the footer's role-conditional
    auto-margin alignment became a no-op (a box that already fills its container has no spare space
    for `auto` margins to distribute). A user turn's actions stayed pinned to the inline-start edge
    instead of aligning to the inline-end edge next to its own right-aligned bubble. Now aligned via
    `justify-content` on the actions row itself.
  - `<lr-file-input>`: the dropzone collapsed to its own intrinsic content height instead of filling
    a host given a definite block size (e.g. absolutely positioned with `inset: 0` over a sized
    panel) — none of `[part="form-control"]`, `.dropzone`, or `[part~="base"]` propagated the host's
    height down the chain.
  - `<lr-chart>`: a chart whose row count exceeded the 1,000-record rendering budget but whose series
    count did not got its shared `labels` array correctly sampled down, but each series' own
    `data`/`color`/`pointRadius`/`pointColors`/`segmentColors` arrays stayed at full source length —
    a length mismatch handed straight to Chart.js. Row sampling now applies to every series
    regardless of whether the series dimension itself also needed sampling.
- bf447ca: `<lr-tooltip>`: close a pointer-held tooltip when a re-render replaces its trigger.

  A list that re-renders — a chat transcript, a log view, anything virtualized — replaces the `for`
  target with a fresh node rather than moving the existing one. The outgoing element is detached
  before it can fire the `mouseleave` that normally closes a resting tooltip, and the incoming element
  is not necessarily under the pointer. `adoptTrigger()` correctly rebound its listeners to the new
  node but let the tooltip inherit the outgoing node's open state, so the tooltip hung open over a
  trigger nobody was pointing at. Reported live as several resting tooltips visible at once with the
  pointer over none of them, via `<lr-copy-button>`'s default `tooltip="full"`.

  A trigger swap now re-derives the open state from the incoming element: the tooltip stays open only
  while that element is genuinely held — the pointer resting over it (`:hover`) or focus inside it —
  and closes otherwise. Focus-, click- and `manual`-opened tooltips are untouched, and re-rendering a
  row the pointer still rests on leaves its tooltip alone. Verified on Chromium, Firefox and WebKit.

  The same report's secondary note about a tooltip being clipped inside a scroll container is existing
  behavior with existing API: pass `hoist` (`<lr-copy-button>` already forwards it to its tooltip) to
  render the popup in the top layer and escape the clipping ancestor.

## 9.1.1

### Patch Changes

- 3de3498: Document 18 additive public surface additions from 9.0.0 that had no changelog entry:

  - `<lr-chip>`: new `end` slot (trailing content, typically an icon, after the label).
  - `<lr-claim-evidence>`: new `compact` and `frame` properties.
  - `<lr-code-editor>`: new `size` property.
  - `<lr-ebook-viewer>`, `<lr-pptx-viewer>`, `<lr-spreadsheet-viewer>`: new `maxHeight` property on
    each.
  - `<lr-token-input>`: new `start` and `end` adornment slots.
  - New CSS custom-property indirection (a themeable `--lr-*` hook backing a previously
    hardcoded/token-only value) on `<lr-dock-panel>`, `<lr-retrieval-compare>`,
    `<lr-spreadsheet-viewer>`, `<lr-stream-status>`, `<lr-code-block>`/`<lr-code-block-core>`,
    `<lr-page-rail>`, and `<lr-pdf-viewer>`.

  All 18 are additive and backward-compatible — nothing removed or renamed, no behavior change when
  left unset — but none were individually called out in the 9.0.0 changelog entry, unlike the many
  other opt-in additions from the same release that are documented by exact component/property name.
- d04b07e: Document six cancelable pre-mutation events added in 9.0.0 with no changelog entry:
  `<lr-dock-panel>`'s `lr-collapse-request`, `<lr-widget>`'s `lr-collapse-request`,
  `lr-fullscreen-request`, and `lr-view-request`, `<lr-page>`'s `lr-nav-toggle`, and
  `<lr-split-panel>`'s `lr-reposition-request`.

  9.0.0 added a consistent propose-then-commit event pair to several components that previously
  only fired a single post-commit notification: a new cancelable `*-request` event fires first with
  the proposed next state, and a consumer's `preventDefault()` on it now vetoes the change before
  the existing non-cancelable `*-change`/completion event fires. `<lr-dock-panel>` gained
  `lr-collapse-request` alongside its existing `lr-collapse-change`; `<lr-widget>` gained its own,
  independent `lr-collapse-request` (alongside `lr-collapse-change`) plus `lr-fullscreen-request`
  and `lr-view-request` (alongside `lr-fullscreen-change`/`lr-view-change`); `<lr-page>` gained
  `lr-nav-toggle`, its first event of any kind; `<lr-split-panel>` gained `lr-reposition-request`
  alongside its existing `lr-reposition` post-commit event. All six are genuine new opt-in public
  API — a consumer can now veto a collapse, fullscreen, view, nav-open, or divider-reposition
  mutation before it commits — but none were called out in the 9.0.0 changelog entry, unlike the
  many other opt-in additions from the same release that are individually documented by name.
- 7bcef3e: Document further additive 9.0.0 public surface that had no changelog entry, found auditing the
  two largest 9.0.0 remediation commits:

  - `<lr-context-inspector>`: five new events — `lr-error`, `lr-copy-error`, `lr-export-error`,
    `lr-show`, `lr-hide` (all from its embedded copy/export controls).
  - `<lr-graph>`: eight categorical fallback CSS custom properties, `--lr-graph-cat-1` through
    `--lr-graph-cat-8`, backing the default node-type color palette.
  - `<lr-tag>`: new `lr-remove` event (non-cancelable notification that the remove button was
    activated).
  - `<lr-rating>`: new `focus`/`blur` native-passthrough events, `focus()`/`blur()`/`click()`
    methods, and `base`/`rating` csspart compatibility aliases (same node, two names).
  - A long tail of new, narrowly-scoped CSS custom properties (visual tokens only, no new
    interaction surface) on `<lr-activity-feed>`, `<lr-prompt-studio>`, `<lr-task-list>`,
    `<lr-tool-approval-dialog>`, `<lr-tool-param-form>`, `<lr-push-to-talk>`, `<lr-flow-controls>`,
    `<lr-menu-item>`, `<lr-chip-group>`, and further `<lr-rating>` properties; plus new slot aliases
    on `<lr-prompt-input>` (`start`/`leading`/`end`/`trailing`) and `<lr-push-to-talk>`
    (`microphone-icon`/`icon`), and new cssparts on `<lr-model-select>`, `<lr-push-to-talk>`, and
    `<lr-source-picker>`.

  All additive and backward-compatible — nothing removed or renamed, no behavior change when left
  unset.
- d59f8c5: Fix `<lr-button>`'s start/end adornments claiming a 40%-of-row flex-basis instead of just being
  capped at 40%.

  A 9.0.0 change gave `[part~="start"]`/`[part~="end"]` `flex: 0 1 40%`, which sets the flex
  *basis* to 40% of the button's own internal row -- a preferred size the flex algorithm tries to
  honor before shrinking -- not merely `max-inline-size: 40%`'s ceiling. Because the basis is
  self-referential (relative to the button's own internal row, unrelated to its position in the
  page), even a small icon claimed a 40% preferred share before shrinking, squeezing
  `[part="label"]`'s `flex: 1 1 auto` below what its text needed and ellipsizing labels that had
  room to spare, with visible unused space left in the row. Adornments now use `flex: 0 0 auto`
  (content-sized); `max-inline-size: 40%` remains as the actual cap for a genuinely oversized
  adornment.
- f7de4a5: Fix the same `overflow-wrap: anywhere` mid-word-break defect already fixed across seven other
  components (see the `overflow-wrap-anywhere-sibling-components` and `switch-label-break-word`
  changesets) in `<lr-card>` too — a straggler that remediation pass missed. Both `[part="body"]`
  and a slotted `[slot="header"]` collapsed their min-content contribution to near nothing while
  sitting as a flex item next to a non-shrinking sibling, splitting an ordinary short word mid-
  syllable instead of wrapping at the space before it. `overflow-wrap: break-word` gives the
  identical last-resort rescue for a genuinely unbreakable long token without that regression.
- e57c135: Fix `<lr-chat-message>`'s `[part='actions']` pinning its footer actions to the inline end
  regardless of `message-role`, detaching an assistant/system turn's copy/regenerate controls from
  their own start-aligned (and often transparent-background) bubble. `[part='actions']` now scopes
  its `margin-inline-start: auto` to `message-role="user"` and adds the mirrored
  `margin-inline-end: auto` for `assistant`/`system`, matching the role-conditional alignment
  `[part='bubble']` already uses. `actions-position="outside"` is unaffected for every role.
- f7de4a5: Fix `<lr-checkbox-group>` occasionally leaking a child `<lr-checkbox>`'s own raw `lr-change`
  (`{checked, value}`-shaped detail) to an ancestor listener, ahead of the group's own translated
  `lr-change` (`{value: string[]}`-shaped detail) — two events instead of one, the first the wrong
  shape. `onChildEvent`'s `stopImmediatePropagation()` only protects a listener that runs *after* it;
  the internal listener was registered on the default bubble phase in `connectedCallback()`, which
  only outraces a consumer's *own* bubble-phase listener when that listener happens to be registered
  later. A Lit `@lr-change=${...}` template binding — the common case — attaches its listener while
  the element is still a disconnected fragment, before `connectedCallback` ever runs, so it saw the
  unstopped child event first. The internal listener now runs in the capture phase instead, which
  always completes before any bubble-phase listener on the same node fires, regardless of
  registration order.
- 7d2ad99: Fix `<lr-dashboard-grid>`'s auto-created default `<lr-widget>` cell tripping the dev-mode
  unknown-attribute diagnostic. The component marked its own library-created default cell with a
  plain `cell-id` attribute — the same name used for the public, author-facing routing attribute a
  consumer writes on their own light-DOM children (`<div cell-id="a">`), but `cell-id` isn't (and
  shouldn't be) a real `<lr-widget>` property, since `lr-widget` is a general-purpose component with
  no concept of dashboard-grid cells. The auto-created default cell now carries `data-cell-id`
  instead — internal bookkeeping through the universally dev-mode-exempt `data-*` prefix, consistent
  with the existing `data-dashboard-grid-default-cell` marker on the same element — while
  author-authored content continues to use the public `cell-id` attribute unchanged.
- 7a03421: Add a dev-mode console warning when an `lr-*` element is connected with an attribute it doesn't
  observe.

  A typo'd or renamed attribute previously failed silently: the browser stores it inertly, the
  component keeps rendering its default, and nothing signals the mismatch, in any environment. In
  development only -- gated on Lit's own dev-mode signal (`globalThis.litIssuedWarnings`, already
  populated whenever a consumer's bundler resolves `lit`'s `development` build, exactly as it
  already does for Lit's own dev-mode warnings) -- each `lr-*` component now warns once per
  `(tag, attribute-name)` for an attribute outside its observed set, with a did-you-mean suggestion
  when a close match exists: `` `<lr-lite-chart>: unknown attribute 'hide-axis' — did you mean
  'without-value-axis'?` ``. Global HTML attributes (`class`, `id`, `style`, `hidden`, `slot`,
  `part`, ...), `data-*`, and `aria-*` are always exempt. No production behavior change -- the
  check is fully inert when Lit's own dev-mode signal isn't present.

  Scoped to attributes only; an unrecognized `.property =` write is not detected (there is no safe
  way to intercept it generically without either enumerating instance properties -- which floods
  false positives against this codebase's extensive use of TypeScript's `private` keyword for
  internal state -- or wrapping every instance in a Proxy, which cannot intercept parser-driven
  custom-element upgrades).
- e57c135: Fix `<lr-heatmap>` silently substituting the built-in fallback ramp color whenever
  `--lr-heatmap-scale-lo`/`-hi` (or a `colorSteps` entry) was set to a modern CSS color function --
  `color-mix()`, `oklch()`, `lab()`, `color(display-p3 ...)`, etc. -- with no warning. `resolveRgb()`
  previously re-parsed the canvas's `ctx.fillStyle` read-back as a string (hex or `rgb()`/`rgba()`
  only), which neither recognizes the `color(srgb r g b [/ a])` form Chromium normalizes
  `color-mix()` to, nor the literal `oklch()`/`lab()`/`color(display-p3 ...)` syntax canvas
  round-trips as-is for those functions. It now falls back to reading the actual rendered pixel back
  via `getImageData(0, 0, 1, 1)` -- the same idiom already used in `theme.ts`/`shiki-dark-theme.ts`/
  `color-core.ts` -- resolving any CSS color syntax the canvas accepts instead of only the forms a
  hand-written parser recognizes. A genuinely invalid color string is unaffected: it still triggers
  `warnInvalidColor()` and falls back.
- 3a9ae9d: Fix `<lr-knowledge-graph-explorer>`'s composed legend starving the graph pane when `nodeTypes` is long.

  The explorer's flex column gives `[part='graph']` `flex: 1 1 auto; min-block-size: 0` so it's the
  one part designed to shrink, but `[part='legend']` had no size cap — browser-default flex-item
  sizing floors it at its full content height, so a `nodeTypes` list long enough to exceed the
  host's allocated height pushed 100% of the shrinkage onto the graph pane instead, silently
  ignoring the documented `height` property. `[part='legend']` now caps at `var(--lr-size-12rem)`
  and scrolls internally past that, matching the existing `[part='search-results']` pattern in the
  same stylesheet.
- fa7b8a1: Fix `<lr-lightbox>`'s caption starving the stage when it's unusually long.

  `[part='stage']` is `flex: 1 1 auto; min-block-size: 0` — the one part designed to shrink — but
  `[part='caption']` had no size cap, so an unusually long caller-supplied caption could floor at
  its full multi-line content height and squeeze the stage's allocation. `[part='caption']` now
  caps at `var(--lr-size-8rem)` and scrolls internally past that. Same mechanism, same fix shape, as
  `<lr-knowledge-graph-explorer>`'s composed-legend fix in this same release.
- 53ad948: Raise the optional `marked` peer dependency's lower bound to `^18.0.10` (was `^18.0.9`), picking
  up an upstream patch release. Affects every Markdown-rendering component that declares `marked` as
  an optional peer: `lr-agent-workspace`, `lr-dashboard-grid`, `lr-eval-run`, `lr-markdown`,
  `lr-markdown-core`, `lr-message-parts`, `lr-notebook-viewer`, `lr-rag-answer`,
  `lr-streaming-text`, and `lr-widget-renderer`.
- f7de4a5: Fix `<lr-multi-split>`'s `'floating'` collapse state requiring `!important` to override its
  drawer's `position`/`inset-block`/`inset-inline-start`/`inset-inline-end`. All four were applied
  as owned *inline* styles — always higher cascade priority than any external stylesheet rule,
  regardless of specificity — even though their floating-state value is always the same fixed
  literal (`absolute`, `0`), never per-render computed data. They're ordinary (overridable)
  stylesheet rules now, keyed off the already-reflected `collapse` host attribute and the panel's
  existing `data-collapse-state="floating"` marker, so a consumer's own CSS wins at normal
  specificity. `flex`/`order`/`inline-size` are unaffected and stay inline: `inline-size` in
  particular is intentionally live, mirroring the panel's own draggable `sizes` percentage so there's
  no visual jump un-floating — a consumer wanting a different floating *width* should set `.sizes`
  rather than override the stylesheet rule.
- 961987b: Document `<lr-multi-split>`'s 9.0.0 behavior change: leaving a non-floating collapse state now
  actually clears `open`, a change that shipped without a changelog entry.

  Before 8.2.3, the component reference already promised: "Leaving 'floating' while `open` is still
  `true` also closes it, the same way `<lr-app-rail>` closes its mobile overlay when leaving
  'mobile' while open." 8.2.3's compiled class never implemented it — there was no assignment
  clearing `open` anywhere in the collapse path; `this.open = false` appeared only as the property
  initializer.

  9.0.0 implemented it, in `applyEffectiveCollapseTransition`: for any transition to a state other
  than `'floating'`, `open` is now cleared. The direction of the fix was correct — the code now
  matches what was always documented — but it shipped silently, and the reference read identically
  in both versions since it described the intended behavior all along, giving no changelog signal
  to grep for.

  The ordering matters to any `lr-multi-split-collapse-change` handler that reads `open`: the clear
  happens **after** the event fires, not before, so a listener reading `this.open` synchronously
  inside its own handler still sees the pre-clear value.

  This is the same omission class already retro-documented twice in 9.1.0 (the heatmap
  flat-property-to-`data` collapse, and the tab group's removed `slot`/`label` child model).
- 22056b1: Fix the same `overflow-wrap: anywhere` mid-word-break defect just fixed in `<lr-switch>` (see the
  sibling `switch-label-break-word` changeset) in six more components, found by auditing the rest of
  the library for the same `overflow-wrap: anywhere` + `min-inline-size: 0` fingerprint on
  natural-language text: `<lr-agent-eval-dashboard>` (heading and run-label text),
  `<lr-realtime-session>` (status text), `<lr-spinner>` (the after-placement label),
  `<lr-schema-viewer>` (name/description/issue text), `<lr-subagent-panel>` (label/task/model text),
  and `<lr-callout>` (content/message text). Same root cause and fix in every case:
  `overflow-wrap: break-word` gives the identical last-resort rescue for a genuinely unbreakable
  long token without collapsing normal min-content sizing, so ordinary text now only wraps when it
  truly cannot fit, and wraps at a word boundary when it does.
- efb4b9b: Fix `<lr-popover>` and `<lr-tooltip>` getting stuck visible and interactive after closing.

  Both components drove their popup's `data-hidden` attribute through a Lit declarative template
  binding *and* an imperative direct DOM write to the same attribute, keyed off a plain
  non-reactive private field (`anchorPositioned`). The imperative write silently desynced Lit's own
  dirty-check cache for that attribute part; because neither component's `updated()` lifecycle hook
  repositions on close (only while `open`), a later close transition could evaluate the same
  boolean expression to a value matching Lit's stale cache and skip the DOM write entirely — leaving
  the popup visually and interactively present (`pointer-events: auto`) after every dismissal route
  (trigger click, outside click, Escape, `.hide()`) once it had opened once. `anchorPositioned` is
  now a real reactive `@state()` property in both classes, and the redundant imperative writes are
  removed, making Lit's own render cycle the single source of truth for the attribute.
- 34c12fa: Harden `<lr-popup>` against the same imperative/declarative attribute-write desync just fixed in
  `<lr-popover>`/`<lr-tooltip>`.

  `<lr-popup>` shared the identical pattern (`anchorPositioned` as a plain non-reactive field, an
  imperative `toggleAttribute` write alongside a declarative template binding for the same
  `data-active`/`data-awaits-position` attributes) but never exhibited the observable bug, because
  its `updated()` lifecycle hook unconditionally repositions on every update cycle regardless of
  which property changed -- masking any stale-cache skip with a redundant imperative correction on
  the same cycle. `anchorPositioned` is now a real reactive `@state()` property here too, removing
  the fragile reliance on that masking behavior.
- 03fd04f: Fix `<lr-switch>`'s label/hint/error text breaking mid-syllable, and possibly wrapping, well
  before it runs out of room.

  The shared `[part="form-control"], [part="label"], [part~="hint"], [part="error"]` rule used
  `overflow-wrap: anywhere`, which -- unlike `overflow-wrap: break-word` -- also collapses the
  element's min-content contribution to essentially a single character. Combined with the same
  rule's `min-inline-size: 0`, an ordinary short label could be squeezed far below its longest
  word's width and forced to split it mid-syllable, even when there was ample room to sit on one
  line or wrap cleanly at a space.

  Switching to `overflow-wrap: break-word` alone regressed the pre-existing 320px unbreakable-token
  test: without a width propagated down to it, `.switch-layout` (an `inline-flex` box with no
  explicit size) falls back to shrink-to-fit sizing, which can never size narrower than its own
  min-content -- and `break-word` (correctly) keeps that min-content at the token's full width, so
  the layout overflowed its ancestor instead of shrinking into it. Adding `max-inline-size: 100%` to
  both `:host` and `.switch-layout` propagates an ancestor's real constraint all the way down to the
  flex layout, fixing the overflow. `min-inline-size: 0` was deliberately *not* added to either of
  those two rules: leaving their automatic minimum size content-based means an outer flex/grid
  ancestor (e.g. a settings-panel row with another sibling control) won't disproportionately squeeze
  the switch below its longest word's width the way `overflow-wrap: anywhere`'s near-zero min-content
  let it -- at the cost of the row overflowing slightly rather than breaking a word, which is the
  tradeoff `break-word` intends.
- f7de4a5: Fix `<lr-thread-list>`'s exported `row-start`/`row-actions` parts sitting on the row's inline text
  baseline (adding descender strut height above and below) instead of vertically centering their
  `renderStart`/`renderActions` adornment content. Both parts are plain `<span>`s and default to
  `display: inline`; they are now `display: inline-flex; align-items: center`, matching every other
  adornment slot in the library. `row-content`/`row-meta`, which hold real text, are unaffected.

## 9.1.0

### Minor Changes

- b027f44: Re-export `LyraNodeTypeStyle` from every component module whose public API types a property
  against it (`lr-graph`, `lr-knowledge-graph-explorer`, `lr-drilldown-panel`, `lr-agent-trace`,
  `lr-entity-dossier`, `lr-entity-card`, `lr-memory-panel`, `lr-provenance-panel`,
  `lr-graph-legend`). The type was previously only reachable from the package root barrel
  (`@aceshooting/lyra-ui`'s `LyraNodeTypeStyle` export); a consumer importing one of these
  components from its own granular subpath, as this library's own examples do, had no local type
  to import against and had to either duplicate the shape by hand or reach into the disallowed
  `internal/` path.
- d8fe77e: Restore `./components/viewers/archive-viewer/archive-viewer-register.js` and
  `./components/viewers/ebook-viewer/ebook-viewer-register.js` as importable package subpaths. Both
  files register a `<lr-document-viewer>` renderer (`application/zip`/`.zip` and
  `application/epub+zip`/`.epub` respectively) and are genuinely opt-in for a granular consumer not
  using the `all.js` compatibility bundle. Neither had an entry in `package.json`'s `exports` map, so
  the documented import pattern (matching `flag-peer.js`'s precedent) hit
  `ERR_PACKAGE_PATH_NOT_EXPORTED` even though both files ship in `dist/` and are correctly declared in
  `sideEffects` — the same defect class as the historical `flag-peer.js` `sideEffects` omission, this
  time in the exports map instead.

### Patch Changes

- c9a9303: Document `<lr-heatmap>`'s flat-property-to-`data` replacement, a 9.0.0 breaking change that shipped
  without a changelog entry.

  9.0.0 replaced ten independent top-level `<lr-heatmap>` members with a single discriminated-union
  `data` property. The removed members are `mode`, `days`, `rowLabels`, `colLabels`, `values`,
  `firstDayOfWeek`, `columnX`, `rowY`, `weekdayLabelText`, and `monthLabelText`. They are now fields on
  one of the two `data` branches — `HeatmapMatrixData` (`{ kind: 'matrix', rowLabels, colLabels,
  values }`) or `HeatmapCalendarData` (`{ kind: 'calendar', days, firstDayOfWeek?, columnX?, rowY?,
  weekdayLabelText?, monthLabelText? }`) — united as `HeatmapData` and exported from the package root.

  There are no runtime aliases, and assigning a removed member is silent: Lit accepts it as an
  unobserved instance property, so the component keeps rendering its default empty grid instead of
  erroring. That silence is why this entry exists — the 9.0.0 notes omitted the change entirely, so a
  consumer grepping the changelog for `HeatmapMatrixData`, `HeatmapCalendarData`, `HeatmapData`, or any
  of the removed member names found nothing and had no way to learn the API had moved.

  The `data` shape itself is unchanged and intentional; only the changelog record was missing.
  `llms/data.md`'s "9.0 migration" note already carries the full recipe, including the related removal
  of the magic `value-label="value"` localization sentinel:

  ```js
  // removed in 9.0.0
  el.mode = 'matrix';
  el.rowLabels = ['Mon', 'Tue'];
  el.colLabels = ['00h', '06h'];
  el.values = [
    [1, 2],
    [3, 4],
  ];

  // 9.0.0 and later
  el.data = {
    kind: 'matrix',
    rowLabels: ['Mon', 'Tue'],
    colLabels: ['00h', '06h'],
    values: [
      [1, 2],
      [3, 4],
    ],
  };
  ```
- 3f294c1: Fix `<lr-lite-chart>`'s first category label colliding with the bottom y-axis tick.

  A line chart centres its first category label on `plotX`, so that label always reaches left into the
  y-axis tick column — a measured 5.7px horizontal overlap on both Chromium and Firefox. The only thing
  holding the two apart is the vertical gap between the label row and the bottom tick, which is
  `dominant-baseline="middle"` on the plot floor and therefore hangs half its line box below that floor
  into the label row.

  That gap was 1.3px on Chromium and **-0.7px on Firefox**, whose line box for the same 10px
  `system-ui` font is 16px against Chromium's 14px. Firefox therefore painted the first x-axis label
  overlapping the `0` tick. Raising `CATEGORY_LABEL_OFFSET` 18 → 24 and `PAD_BOTTOM` 24 → 30 together
  leaves ~5px clear on both engines, comfortably past that 2px cross-engine variation.

  Because both constants moved by the same amount, the category-label row does not shift: the plot
  floor rises instead, so a chart's labels stay where they were and its plot area is 6px shorter. Charts
  with an `x-label` axis title are unaffected beyond that, since `AXIS_TITLE_SPACE` is measured from
  `padBottom`.

  Note the truncation width model is unchanged: `displayCategoryLabel()` still estimates fit from
  `APPROX_LABEL_CHARACTER_WIDTH`, so a label's *horizontal* extent remains an approximation rather than
  a measurement. This change makes the label row robust to that approximation being wrong rather than
  making the approximation exact.
- 7ae8930: Document `<lr-tab-group>`'s removed `slot`/`label` child model, a 9.0.0 breaking change that shipped
  without a changelog entry.

  9.0.0 removed the pre-9.0 attribute child model, in which a direct `<div slot="x" label="…">` child
  became a tab captioned by its `label` with its own content as the panel, and a sibling
  `slot="x-icon"` child supplied that tab's leading icon. `<lr-tab-group>` now builds its tab list
  only from `<lr-tab panel="x">` descriptors paired with `<lr-tab-panel name="x">` panels; any other
  child element is skipped regardless of its `slot`/`label` attributes, so markup still written in the
  old shape renders an empty tab strip with no console warning.

  The removal itself is unchanged and intentional — this entry only records it, because the 9.0.0 notes
  omitted it while `README.md` continued to state that the `slot`/`label` shape "still works
  unchanged". Both README claims are corrected (the 7.x → 8.0.0 rename table and the component/mirror
  table), which also clears the same stale claim from three generated `llms/migration.md` rows
  (`<wa-tab>`, `<wa-tab-panel>`, `<sl-tab-panel>`) and the packaged skill reference. `llms/layout.md`
  already described the removal correctly and is unchanged.

  To migrate, rewrite each former child as one descriptor plus one panel, folding any former
  `slot="x-icon"` sibling's content into the `<lr-tab>`'s own default slot:

  ```html
  <!-- removed in 9.0.0 -->
  <lr-tab-group>
    <div slot="general" label="General">General settings</div>
  </lr-tab-group>

  <!-- 9.0.0 and later -->
  <lr-tab-group>
    <lr-tab panel="general">General</lr-tab>
    <lr-tab-panel name="general">General settings</lr-tab-panel>
  </lr-tab-group>
  ```

  A regression test now asserts a plain `slot`/`label` child produces no tab and no rendered panel, so
  the behavior cannot drift back into being documented as supported.

## 9.0.0

### Major Changes

- 000b9e3: This major version finalizes lyra-ui's 9.0 public-contract cleanup: it closes the deprecation and
  rename windows opened in 8.0.0, aligns the shared vocabulary with Web Awesome and Shoelace, and adds
  cross-component security, accessibility, internationalization, theming, and performance work. The
  generated migration reference (`llms/migration.md`) records the exact replacement for every renamed
  or removed member; sections below group every change by what it means for a consumer evaluating this
  upgrade.

  ### Breaking changes

  - make `lr-button` submit/reset behavior a true post-click default action, so
    `click.preventDefault()` vetoes it while propagation control alone does not.
  - `lr-tool-call-chip` / `lr-message-parts`: `lr-tool-chip-select` → `lr-tool-call-chip-select`
    (identical detail). `lr-tool-timeline` bound both, so a host listener fired **twice** per click;
    it now fires once.
  - `lr-flow-canvas`: `--lr-flow-canvas-node-current-outline-color` →
    `--lr-flow-canvas-node-selected-outline-color`
  - `lr-usage-badge`: `compact` → `abbreviate`. It selected `Intl` compact *notation* while 20 other
    components use `compact` for visual density.
  - `lr-chart` (and every typed subclass): `horizontal` → `index-axis="y"`
  - `lr-rag-answer`, `lr-retrieval-results`: `error` → `errorText` / `error-text`
  - `lr-document-preview`: `errorMessage` → `errorText` / `error-text`
  - `lr-ingestion-queue`, `lr-activity-feed`: `virtualizeThreshold` → `virtualizeAt`, and the bound is
    now exclusive to match the other four components — `virtualize-threshold="N"` becomes
    `virtualize-at="N-1"` for an identical switchover point.
  - `lr-knowledge-base`: `lr-kb-create`/`-sync`/`-pause`/`-delete` → `lr-source-*` (identical details;
    hosts listening on `lr-knowledge-base-admin` are unaffected).
  - `lr-data-grid`: option fields `columns` → `columnIds`, `filename` → `fileName` (upstream's own
    spellings — this moves *toward* the mirror).
  - `lr-test-results`: legacy `detail-{suiteId}-{testId}` and `detail-{testId}` slots → the canonical
    `testResultDetailSlotName(suiteId, testId)`.
  - `lr-confirm-bar`: `compact` is density only; use `compact frame="plain"` for the old flat
    presentation. `--lr-confirm-bar-compact-{border,background,radius}` removed.
  - `lr-accordion`: direct `<lr-details>` children are no longer coordinated — use
    `<lr-accordion-item>` (which still accepts `summary`/`open`/`show()`/`hide()`).
  - `lr-ebook-viewer`: `accessibleLabel` is private (the property never had any effect; set the
    `aria-label` attribute), and the permanently-empty `announcer` part is gone.
  - `lr-sequence-strip`: `orientation` removed — a single-member union that nothing read or styled.
  - `lr-split-panel`: `SplitPanelSnapFunctionOptions` / `SplitPanelSnapFunctionParams` removed; both
    aliased `SnapFunctionParams`.
  - Compatibility type aliases `ActivityEntryTone`, `ConfirmBarTone`, and `ChipTone` removed; use
    `LyraVariant`, `ConfirmBarVariant`, and `ChipVariant` respectively. The corresponding public
    properties already use `variant`, so these aliases duplicated the canonical type vocabulary.
  - Ten orphaned localization keys removed — they shipped translated into all ten locales while no
    component rendered them: `trendIncreased`/`trendDecreased`/`trendGoodSuffix`/`trendBadSuffix` (use
    `statTrend*`), `subagentPanelCancel` (use `subagentPanelCancelRun`), plus
    `contactViewerOrganizationLabel`, `evaluationDashboardMetricLabel`, `heatmapCellSelectedSuffix`,
    `liteChartMarkPosition`, `spanTokens`. A generator gate now fails on any future orphan.
  - `srOnly` now hides via `clip-path: inset(50%)` instead of the deprecated `clip: rect(0 0 0 0)`. If
    you reveal an `.sr-only` element on focus, replace `clip: auto` with `clip-path: none`. Note
    `clip-path` establishes a containing block for absolutely-positioned descendants.
  - **Migration coverage improves measurably**: `warning-required` mappings drop from 13 to 9,
    `exact` rises 54 → 56 and `rewritten` 78 → 80. `<wa-button>`, `<sl-button>`, `<wa-breadcrumb-item>`
    and `<sl-breadcrumb-item>` now migrate mechanically — previously the codemod refused *every* one of
    them, including buttons with no `href` at all, because the warning is emitted per tag rather than
    per member.
  - complete the v9 identity migrations from `lr-split`, `lr-query-builder`, `lr-playback`,
    `lr-generation-status`, and `lr-flow-run-overlay` to `lr-multi-split`,
    `lr-condition-builder`, `lr-sequence-playback`, `lr-generation-metrics`, and
    `lr-flow-run-status`, including their class, type, event, CSS-hook, storage-key, registration,
    and framework surfaces; the pre-v9 `lr-geojson-view` tag remains the documented compatibility
    alias for canonical `lr-geojson-viewer`;
  - replace ambiguous generic public type aliases with the curated `Lyra*` vocabulary and remove
    superseded root and granular aliases; the generated migration reference records each exact
    replacement and every surface that now requires manual review;
  - use `CustomEvent<null>` for no-payload library events, frozen named detail objects for scalar
    state, and cancelable before/invalid events only where vetoing changes the originating action;
  - unify model and voice catalogs on readonly `LyraCatalog<T>` and move their shared filtering,
    popup, selection, form, and native-event behavior into one catalog-picker contract;
  - treat omitted localized labels as the only request for a default string: an explicit empty
    string or the former English default is now caller-owned data and is never silently translated.
  - make public collection inputs and collection-bearing event details bounded readonly snapshots,
    with clone/freeze admission for structured records and copy-on-write updates instead of retained
    mutable aliases;
  - require stable, non-empty domain identifiers across collection-driven components, use
    deterministic first-valid-wins duplicate handling, and carry those identifiers through state,
    persistence, and event details rather than relying on array position or display text;

  ### Security

  - strip authored inline CSS from sanitized Markdown while preserving only strict Shiki palette
    colors, and paint-contain the explicit unsanitized escape hatch;
  - reject excessive ZIP entry and declared-expansion metadata before `lr-archive-viewer` asks JSZip
    to materialize its entry graph.
  - isolate fetched `lr-svg-viewer` content from author styles, SVG animation, and external resource
    references while retaining local paint servers.
  - reject XML document type declarations before browser entity expansion and preserve mixed XML
    child-node source order in `lr-xml-viewer`.
  - place `lr-mcp-app`'s inline CSP before every app-controlled token so head decoys cannot bypass it.
  - bound streamed ANSI CSI/OSC carry and recover `lr-terminal` after overlong unterminated sequences.
  - namespace `lr-thread-list` group and thread identities independently so unrestricted raw thread
    ids cannot steal active ownership from or collide with virtual group headers.
  - scope `lr-widget-renderer` warning dedupe to the current root/registry generation so streamed
    attacker-controlled type and prop names cannot accumulate for the instance lifetime.
  - reject malformed reachable `lr-widget-renderer` nodes before dereference, clear stale content,
    and report exactly one render error instead of throwing from a streamed update.
  - fail closed on duplicate `lr-tree` data ids so one public identity cannot own multiple focus,
    selection, expansion, or reorder targets.
  - widen the CSV formula-injection guard to fullwidth sigils and leading whitespace, and share one
    definition between `lr-data-grid` and the export helper instead of two drifted copies;
  - drop an `lr-mcp-app` tool result whose originating frame has been replaced, via an additive
    `frameGeneration` correlation on the event detail and an optional `postToolResult()` argument;
  - reject or truncate hostile oversized string, tree, registry, schema, and traversal inputs at
    documented ceilings while keeping valid siblings usable and async generation ownership intact.

  ### Accessibility

  - preserve keyboard focus when retrieval paths, chips, and source collections change;
  - preserve `lr-emoji-picker` option focus by identity or nearest survivor when controlled groups
    reorder or shrink, without stealing search or external focus, and materialize off-window roving
    targets before transferring focus;
  - move `lr-time-input` focus to a surviving segment when a controlled pattern change removes the
    focused segment, without reclaiming focus from another control;
  - restore `lr-export-button` to sequential keyboard navigation after loading or disablement ends;
  - report and announce `lr-diff-view` clipboard failures without falsely confirming stale or failed writes;
  - fully suppress the visible `lr-toast-item` progress animation under reduced motion;
  - reconcile and announce retained `lr-xml-viewer` search state after XML reloads.
  - preserve `lr-code-block` and `lr-code-block-core` roving focus when controlled code shrinks.
  - keep disabled, hidden, and inert custom controls out of `lr-message-actions` roving navigation.
  - skip unavailable `lr-thread-list` rows locally and across virtual-window keyboard boundaries.
  - preserve `lr-prompt-queue` focus when a controlled removal is accepted.
  - enforce `lr-push-to-talk`'s hit floor and keep custom trigger glyphs decorative.
  - preserve `lr-sequence-strip` and `lr-heatmap` roving focus through controlled refreshes, and honor the strip's host name.
  - preserve `lr-graph-query-builder` focus when filter chips or saved queries are removed.
  - transfer `lr-realtime-session` focus when its public capture surface is hidden.
  - preserve `lr-selection-toolbar` focus when its controlled action set changes.
  - keep `lr-stat` slotted controls outside its whole-card link and forward its host accessible name.
  - normalize `lr-combobox`'s active descendant after local or async option-set changes.
  - preserve `lr-table` row and header focus when controlled collections shrink or reorder.
  - retain a non-color visual state and part hook for hidden chart legend series.
  - honor host `aria-label` presence on `lr-filter-bar`, including an explicitly empty value, before
    falling back to the component's `label` property.
  - preserve host `aria-label` precedence by attribute presence, including explicitly empty values,
    across archive, calendar, contact, CSV, dataset, comparison, document, and DOCX viewers and the
    nested dialog path used by `lr-document-viewer`.
  - preserve `lr-select`'s keyboard-active option by identity across live reorders and rehome
    removed or disabled active rows to the nearest navigable survivor.
  - make `lr-thread-list` Home/End navigation resolve the complete virtual model, skipping group
    records and unavailable endpoint rows instead of stopping at the mounted window.
  - remove disabled `lr-token-input` edit triggers from focus, expose their disabled state, retire
    internal focus, and suppress enabled hover feedback until the control is re-enabled.
  - retain the shared icon-button hit-area floor for every emoji-picker option while compact size
    tiers continue to scale the glyph independently.
  - retain the shared 40px compact-target floor for circle/icon-only buttons and label-less
    checkboxes across every size tier while keeping their visible glyph and box tier-sized.
  - integrate combobox listboxes with the shared nonmodal overlay stack so z-order, Escape,
    outside-pointer dismissal, and focus handoff remain topmost-only beside color-picker popups.
  - announce `lr-tree` reorder success only after the host-owned sibling order confirms the exact
    request, keeping ignored or rejected requests silent.
  - realign canceled `lr-carousel` mouse drags instantly under reduced motion while preserving
    smooth full-motion recovery, including the pointer-capture-loss path.
  - cancel stale `lr-sequence-strip` arrow/Home/End focus continuations across controlled item
    replacement and disconnect/reconnect instead of focusing a new model by an old numeric index.
  - give custom `lr-page` navigation toggles a resolvable host bridge for their private drawer and
    restore only component-owned ARIA across replacement, removal, and reconnect.
  - rehome `lr-locale-picker`'s active option when a live locale catalog shrinks, keeping
    `aria-activedescendant` and the next keyboard command valid.
  - make `lr-time-input.focus()` honor direct and fieldset disablement, matching its click and tab-stop
    contract without emitting synthetic host focus events.
  - preserve `lr-av-player`'s named region when an unsafe media source renders its error branch.
  - announce `lr-flow-minimap` viewport changes for map clicks, wheel zoom, keyboard commands, and
    completed drags while keeping canceled drags silent.
  - make `lr-token-input.focus()` synchronously honor direct and fieldset-cascaded disablement before
    the internal draft input has re-rendered disabled.
  - preserve `lr-swatch-picker` keyboard focus across live palette reorders and focused-option
    removal without changing its controlled value or emitting a user-change event.
  - isolate all seven `lr-video` icon slots in inert decorative sibling layers so accidentally
    interactive glyph markup cannot nest actions or add keyboard stops.
  - `lr-xml-viewer` search now scrolls the active match into view, honoring reduced motion.
  - `lr-breadcrumb.accessibleLabel` is consumed instead of ignored.
  - move `lr-transcript-feed` announcements out of its shadow `role="log"` and onto the shared
    light-DOM polite sink, leaving the shadow region non-live;
  - give `lr-thinking-panel`'s always-tabbable scroll region a real focus ring and a distinct hover
    preview, matching `lr-code-block` and `lr-virtual-list`;
  - draw `lr-mind-map`'s focus ring as soon as the widget takes focus, rather than only after the
    first arrow key;
  - hand `lr-confirm-bar` focus to its status region when a host defers the decision, instead of
    dropping it to `<body>` while the just-activated button becomes `disabled`;
  - name an icon-only toggleable `lr-chip`'s real control, and give `lr-phone-input` an accessible-name
    fallback;
  - carry a persistent region landmark on `lr-dataset-viewer` in every fetch state;
  - announce timeline and step position on `lr-video` and `lr-sequence-playback` through localized
    `aria-valuetext`;
  - floor the `lr-flow-minimap` viewport rect and `lr-data-grid` hit targets to a real pointer size.
  - give `lr-box-plot` and `lr-lite-chart` the chart family's forced-colors series encodings;

  ### New capabilities

  - add standard error text, rich error-slot chrome, and handle descriptions to `lr-slider`;
  - add standard error text, rich error-slot chrome, SSR presence hints, and semantic descriptions
    to `lr-file-input`;
  - export public component property and configuration types from the registration-free package root;
  - complete `lr-voice-picker`'s standard form-control frame and slotted-label contract.
  - add owned error chrome and the standard form-control frame to `lr-checkbox`.
  - accept canonical `start`/`end` adornment slots on `lr-chat-composer` while retaining legacy aliases.
  - accept canonical `start`/`end` adornment slots on `lr-radio-button` while retaining Shoelace
    `prefix`/`suffix` aliases.
  - accept canonical `start` adornment content on `lr-conversation-item` while retaining `leading`.
  - complete `lr-model-select`'s standard slotted-label and `form-control` frame contract.
  - expose the shared configurable Markdown parser and public refresh method on `lr-markdown-core`.
  - relay `lr-data-grid` search and filter focus transitions through its host as native events.
  - expose `lr-model-select`'s free-text input, selection, and range-editing facade.
  - separate chart legend, data-table, and reset-zoom hover/pressed theme hooks.
  - expose `lr-lite-chart`'s selected-mark outline width alongside its color.
  - let `lr-calendar` themes independently inherit selected, outside-month, and today paint hooks.
  - keep every `lr-flow-canvas` edge tone and its referenced arrowhead independently themeable.
  - expose peer-neutral Markdown, message-feedback, and model-select types from the registration-free
    package root and the relevant granular Markdown entries.
  - forward semantic `lr-filter-bar` control parts so consumers can theme its composed select,
    combobox, text, and date fields through the bar's shadow boundary.
  - expose independently inheritable progress, action, current-page, hover, and pressed color hooks
    for `lr-flow-node`, `lr-graph-query-builder`, and `lr-pagination`, preserving the existing palette
    as exact fallbacks.
  - split `lr-pagination` summary, control-group, and numbered-page spacing into independent
    inheritable layout hooks that retain the existing spacing defaults.
  - let `lr-message-feedback` hosts hold a submission for async persistence, then explicitly finalize
    or revert it without premature success UI.
  - let `lr-table`, `lr-timeline-item`, and `lr-word-cloud` inherit their public theme hooks from
    ancestor theme wrappers while preserving direct-host precedence and existing defaults.
  - expose independent `lr-stat` emphasis edge/value hooks and checked/indeterminate `lr-tree-item`
    checkbox border, background, and glyph hooks without changing their semantic-token fallbacks.
  - expose `lr-otp-input` compact-string selection and range-editing APIs, with sanitized silent
    replacements kept synchronized across visual cells, form value, and validity.
  - define `lr-realtime-session.errorCode` as host-readable diagnostic metadata while retaining one
    safe localized generic failure for all provider codes.
  - publish normalized effective zoom bounds in flow-canvas companion snapshots and use them for
    `lr-flow-controls` button availability.
  - add the canonical `start` leading-icon slot to `lr-stat`, with the shipped unnamed slot retained
    as its deterministic fallback.
  - add the purpose-named `marker-icon` slot to `lr-timeline-item`, retaining `icon` as its
    deterministic fallback.
  - keep form-control theme inputs inheritable through ancestor wrappers across size, appearance,
    and pill fallbacks for emoji picker, icon button, input subclasses, locale picker, OTP input,
    and phone input.
  - expose inheritable component-scoped gap and radius hooks for segmented time input, preserving
    shared size and pill tokens as fallbacks.
  - expose independent, inheritable state-paint hooks for input actions/focus, segmented-time
    surfaces and options, locale selection weight, and OTP active/invalid segments.
  - expose independent component-scoped state paint for checkbox/group/editor invalid and
    interaction states, color-picker selection, option current/selection, and the full date-picker
    title/navigation/day/range/selection-view state family.
  - add the shared reflected size ladder to `lr-voice-picker` in both picker modes while retaining
    the preview action's compact hit-area floor.
  - expose independent component-scoped hover and pressed paint hooks for `lr-time-range` presets
    and handles and for `lr-token-input` edit/remove actions, preserving the prior shared-token and
    aggregate-action hooks as backwards-compatible fallbacks.
  - expose independent component-scoped hover, pressed, checked, open, action, thumb, and field paint
    hooks across radio, radio-button, rubric-form, select, slider, switch, and textarea while
    preserving their existing shared-token fallbacks.
  - expose instance-scoped content and row gap hooks for radio-button chrome, slider, and switch,
    preserving the shared spacing tokens as defaults.
  - expose independently inheritable appearance, hover, and pressed paint hooks for app rail,
    app-rail item, breadcrumb item, card, and carousel states without changing their existing defaults.
  - expose independently inheritable appearance, border, hover, and pressed paint hooks across
    details, accordion, and accordion-item while retaining every existing shared-token fallback.
  - expose inheritable `lr-details` summary gap and surface radius hooks independently of its shared
    density ladder, preserving the existing spacing and radius tokens as defaults.
  - expose `lr-token-input`'s native draft selection and event-silent range-editing facade, keeping
    programmatic range edits synchronized with the next token commit.
  - expose every composed push-to-talk event through `lr-realtime-session`'s TypeScript, CEM,
    framework, Storybook, and authored-reference contracts without re-emitting the runtime events.
  - add optional peer-neutral literal icons to `lr-suggestion-chips`, rendered through a stable
    decorative part while the chip button retains focus and selection ownership.
  - accept Web Awesome's exact `currentSlide` carousel markup spelling after HTML normalization,
    retaining `current-slide` as the reflected canonical attribute and initial-conflict winner.
  - New `bridgeLyraLocale()` and `subscribeLyraLocale` (`@aceshooting/lyra-ui/utilities/localization.js`)
    mirror the active locale onto a host element's `lang`/`dir` and re-render non-`LyraElement` hosts on
    locale change.
  - `lr-combobox` exposes `part="group-label"`, matching `lr-select`.
  - `lr-stack-trace` gains `compact`; `lr-confirm-bar` gains `frame`.
  - `rel` is now settable on `lr-button` and `lr-breadcrumb-item`. Both mirror upstream's `rel`, so
    `nofollow`, `me`, `license` and `external` survive a `wa-`/`sl-` → `lr-` rename instead of being
    silently dropped. The security guarantee is unchanged and not removable: `opener` is always
    stripped, and `noopener noreferrer` is force-added whenever `target` is set. A same-tab link (no
    `target`) renders the author's tokens verbatim, because it opens no new browsing context.
    `lr-breadcrumb-item` defaults to `'noreferrer noopener'`, matching both upstreams; `lr-button` keeps
    no default, matching `wa-button` — defaulting it would start suppressing the `Referer` header on
    every same-tab link.
  - `lr-terminal` gains `compact` and `frame`, matching its agent-tools siblings;
  - `lr-swatch-picker` gains `disabled`; `lr-context-meter` gains `showLegend` and legend parts;
  - `lr-node-palette` gains `reorderable`; `lr-retrieval-results` gains custom grouping;
  - `lr-knowledge-graph-explorer` gains a presettable `searchQuery`;
  - `lr-xml-viewer` gains host-supplied highlights and attribute-path precision;
  - `lr-box-plot` gains per-box keyboard and pointer interactivity;
  - `lr-time-range` gains click-to-seek; `lr-filter-bar` options accept an icon;
  - `lr-document-viewer` gains an immutable discriminated renderer payload and typed registry
    adapters, letting the AV renderer receive bounded cues/tracks and advertise search only when its
    retained transcript is searchable without widening legacy `DocumentFile` callbacks;
  - host `focus()`/`blur()`/`click()` forwarding and re-emitted focus/blur on `lr-av-player`,
    `lr-pan-zoom`, `lr-video`, `lr-video-playlist`, and `lr-zoomable-frame`.
  - export the chart, graph, map, and geojson classes from the registration-free package root.
  - Expose `lr-provenance-panel`'s entity-chip row as the `entity-row` CSS part and make its line
    packing themeable through `--lr-provenance-panel-entity-justify` (default `flex-start`, so nothing
    changes when unset). The row wraps N entity chips but carried only a class, and it fills
    `::part(body)`'s inline size, so justifying the body could not move the wrapped lines — the same
    unreachable-packing gap fixed for `lr-suggestion-chips` in this release.
  - Expose `lr-suggestion-chips`' chip row as the `row` CSS part and make its line packing themeable
    through `--lr-suggestion-chips-justify` (default `flex-start`, so nothing changes when unset).
    Centering the chips under centered empty-state text previously had no reachable hook: the row is
    rendered in both the wrapping and the scrolling layout, carried only a class, and styling
    `::part(base)` as a centered flex container centered the chips only while they fit a single line —
    once they wrapped, the row filled the inline size and every line, the short final one included,
    packed to the start edge.
  - Add theming, accessibility, responsive-layout, and controlled-interaction improvements across the
    component library, including new component CSS hooks, prompt-input aliases, model option icons, and
    cancelable pre-commit layout events.

  ### Fixes

  - notify every same-variant Markdown instance when a shared in-flight KaTeX load settles, without
    duplicating completion work across repeated renders;
  - preserve retrieval evidence locators through `lr-retrieval-trace`;
  - honor slot-only answer and source content in `lr-rag-answer`;
  - normalize invalid `lr-knowledge-base-admin` tab state to its Sources fallback;
  - remove unintended nested card chrome from generated RAG sources and evaluation metrics;
  - isolate registered renderer dialog events so inner dialogs cannot close `lr-document-viewer`;
  - surface nonfatal `lr-dataset-viewer` parser diagnostics while preserving recoverable rows;
  - restore `lr-tool-param-form`'s cloned initial value and pristine interaction state on native form reset.
  - validate every `lr-box-plot` canvas theme color and fall back from invalid CSS expressions.
  - materialize `lr-audio-visualizer` canvas colors, including `currentColor`, in the live theme scope.
  - preserve author-supplied `lr-tree-item` names across data-model refreshes.
  - preserve nested `lr-evaluation-run` approval dialogs when a host vetoes the correlated decision event.
  - keep `lr-markdown-core` leading-tab parsing and `tab-size` behavior aligned with `lr-markdown`.
  - honor documented `lr-data-grid` copy/export/scroll option interfaces, including an explicit copy
    delimiter overriding the format default.
  - theme `lr-data-grid`'s search placeholder through the shared quiet-text token.
  - align `lr-code-block-core`'s reflected `copyable` states with the full code block.
  - export a total `lr-test-results` detail-slot-name helper for malformed UTF-16 ids.
  - stop `lr-flow-canvas`'s numeric grid fallback from shadowing its public theme hook.
  - wrap `lr-flow-canvas` corner companions so controls and minimaps do not overlap at 320px.
  - keep obsolete `lr-code-block-core` language-map loads from clearing the current loading state.
  - share full/core Markdown parsing, fallback, anchor, highlight, and rendering behavior while
    retaining their intentionally distinct Shiki grammar loaders.
  - keep the contained menu's standalone `lr-menu-select` alias inside `lr-dropdown`, leaving one
    documented cancelable `lr-select` event for direct, nested, and consumer-supplied menu shapes.
  - contain composed controls' `lr-input`/`lr-change` aliases inside `lr-filter-bar` while preserving
    one bar-owned full-value `lr-input` and the controls' native-style event path.
  - enforce `lr-dropdown[disabled]` as an opening invariant for initial markup, pre-upgrade property
    replay, and later imperative opening, independent of assignment order.
  - contain 200- and 500-item `lr-sequence-strip` datasets at 320px through a documented dense-collapse
    policy while preserving every semantic cell, tooltip, and roving keyboard stop.
  - keep `lr-push-to-talk` timer, level sampling, and maximum-duration deadline synchronized with
    option changes during an active recording.
  - prevent a shared Markdown dependency settlement from parsing twice when `lr-markdown` or
    `lr-markdown-core` reconnects before its promise callback runs.
  - keep `lr-document-library` search, tag-filter, and checkbox implementation events inside the
    component while emitting one documented filter or selection event per interaction.
  - roll back `lr-data-grid` pointer resize state on cancellation or lost capture without emitting a
    committed resize; retain pointerup as the commit path.
  - make a live `lr-flow-canvas[locked]` transition cancel and roll back active gestures, retire
    global pointer listeners, and block imperative viewport mutation.
  - retire `lr-flow-canvas` node-drag and connect gestures when the controlled node model is
    replaced so stale ids cannot move or connect after refresh.
  - keep `lr-flow-minimap` click-to-center available after a canceled viewport drag while consuming
    only the browser-synthesized click after a completed drag.
  - constrain emoji-grid and segmented-time-picker scrollports to their intended block axis under
    undersized allocations, without introducing phantom horizontal scrollbars.
  - reconcile action-bearing input, number, segmented-time, and phone rows on one shared rendered
    size ladder while preserving compact plain-field tiers.
  - keep `lr-tree-item` constructible when optional `ElementInternals` custom-state support is
    absent or only partially implemented.
  - restore `lr-graph-query-builder`'s normalized initial query on form reset instead of always
    erasing it, while retaining pristine-state cleanup and native custom-validity persistence.
  - normalize non-finite `lr-query-builder` number conditions at controlled-model, late-field, and
    user-input boundaries so blank number controls cannot retain JSON-null-producing infinities.
  - strictly round-trip-validate `lr-filter-bar` ISO date chips, preserving impossible values raw and
    retaining literal four-digit years below 0100 instead of JavaScript's 1900 remapping.
  - make `lr-token-input` overflow ownership explicit: uncapped rows grow, while exact-height rows
    clip inline overflow and scroll in the block axis so wrapped tokens and actions remain reachable.
  - make a vetoed `lr-combobox` close atomic, preserving its filter query, active option, async rows,
    reflected open state, and overlay ownership until a close is accepted.
  - roll canceled or capture-lost `lr-color-picker` pointer previews back to their pre-gesture
    visible and submitted value without emitting a commit, while preserving authoritative consumer
    assignments.
  - bind `lr-otp-input` auto-submit tasks to the exact completed code generation so a stale task
    cannot submit a later full value after replacement, reset, restoration, or reconnection.
  - keep `lr-filter-bar`'s reset action on the same default `m` height tier as its adjacent built-in
    fields instead of hardcoding the shorter `s` tier.
  - keep short resizable dashboard-grid cells at the shared interactive-action height floor so their
    absolute resize handles cannot overlap the preceding stacked cell or gap.
  - commit a pending `lr-time-range` keyboard gesture exactly once when its handle loses focus before
    key release.
  - invalidate active `lr-time-range` keyboard and pointer gestures on direct/fieldset disablement or
    form reset so later physical releases cannot commit stale values.
  - co-tokenize `lr-date-picker`'s mirrored `date-picker` part and deprecated `base` alias on
    the same visible shell so either consumer selector reaches identical chrome.
  - contain `lr-model-settings-panel`'s internal live slider event while preserving its mirrored
    temperature readout and consolidated committed-change contract.
  - Nine form-associated components silently never published their validity custom states in
    environments without `ElementInternals`; their fallback lacked a `states` set.
  - `lr-combobox.validators` and `lr-file-input.validators` type-checked and assigned but **never
    ran**. Both are now wired to the same contract `lr-date-input` uses.
  - `lr-flow-node.nodeId` now reflects, so a JS property write is visible to `lr-flow-canvas`, which
    adopts children by attribute.
  - `lr-spreadsheet-viewer.jumpToCell()` no longer reports a phantom `found: true` when nothing loaded.
  - keep a cancelled `lr-animation` cancelled when the play state is later synced;
  - report an honest failure when a concurrent `src` reassignment lands mid-anchor-resolution in the
    archive, CSV, and dataset viewers;
  - guard `lr-code-block`'s async highlight continuations on `isConnected`;
  - ignore a non-primary pointer button when starting an `lr-image-viewer` annotation.
  - bound and cache text-quote indexing, search, DOM-range painting, and host highlight resolution;
    `lr-search-change` now includes `matchCountExact`, so capped or partially loaded viewers report
    a truthful lower bound instead of presenting it as a complete count;
  - wire Shiki's dark palette through `lr-markdown` and `lr-markdown-core`;
  - move documented per-component custom-property defaults to private fallback tokens and apply the
    public hook at each use site, so values inherited from an ancestor are no longer shadowed by a
    `:host` declaration.
  - Forward `lr-tree-item`'s complete public CSS-part surface through recursively rendered data-model
    children. A single `::part()` selector on the outer item can now theme matching rows, labels,
    states, badges, checkboxes, and disclosure controls at every rendered depth.

  ### Performance

  - cap explicit and page-derived `lr-table` skeleton row counts before allocating placeholder cells.
  - forward text and reasoning part streaming state from `lr-message-parts` into its composed Markdown
    renderers so parse and highlighting work coalesces until completion.
  - compute `lr-message-parts` citation ranks in one linear pass instead of rescanning every prefix.
  - suspend full `lr-heatmap` canvas work while offscreen, coalesce hidden invalidations into one
    visibility-entry redraw, and repaint locale-derived canvas labels when locale changes.
  - resolve `lr-terminal` highlight ownership and search-match state in one pass per render instead of
    rescanning per line;
  - cache tree ordering in `lr-subagent-panel`, status counts in `lr-test-results`, the filter/categorize/roving chain in `lr-node-palette`, the dedupe/sort/group pipeline in
    `lr-retrieval-results`, the folded-quote transform in `lr-email-viewer`, and the text index in
    `lr-docx-viewer` (now binary-searched);
  - coalesce `lr-scroller`'s `lr-scroll` to one emission per animation frame.

  ### Internationalization and RTL

  - harden rendered safe-area coverage for every `lr-toast` placement in LTR and RTL;
  - replace English `lr-test-results` status initials with language-neutral decorative marks.
  - localize generated matrix and category counts in `lr-heatmap` and `lr-sequence-strip`.
  - let `lr-select` triggers and overlaid tag rows shrink so long placeholders, selected labels, and
    multi-select chips remain inside constrained LTR and RTL rows.
  - localize complete highlighted-cell names in CSV, dataset, and spreadsheet viewers with separate
    value and annotation placeholders, allowing each locale to control their order and punctuation.
  - format compact `lr-rubric-form` score labels with the effective locale, matching its slider
    branch while preserving stable raw item and submission values.
  - contain long RTL input adornments and segmented-time chrome, with exact-320px stories for input,
    number, segmented-time, and OTP action/fixed-cell compositions.
  - contain button, checkbox, option, and date-input labels/adornments in narrow LTR and RTL rows
    while preserving fixed interactive and glyph geometry.
  - contain standalone `lr-radio`, `lr-radio-button`, and `lr-slider` label, adornment, reference,
    and hint content within narrow LTR and RTL allocations without shrinking fixed controls.
  - correct the `lr-heatmap` cell-text contract to describe its localized matrix/calendar templates
    and reserve `cellText` for application-specific wording rather than ordinary translation.
  - contain unbroken consumer-authored dashboard-grid cell content within narrow LTR/RTL stacks while
    preserving explicitly child-owned horizontal scrollports.
  - contain unbroken active-filter chip values within narrow LTR/RTL filter bars by zeroing nested
    flex minima while retaining the chip's own ellipsis and removal behavior.
  - localize `lr-callout`'s complete labeled live-announcement template so locales can reorder its
    context/content fields and choose their own punctuation.
  - `setLyraLocale()` was **inert on any page with `<html lang>`** — i.e. essentially every
    well-formed page — because the document element won the precedence walk. An explicit call now
    wins; element and ancestor `lang`/`locale` still override it, per a documented order.
  - add `playbackStepPosition`, `phoneInputLabel`, and `emojiPickerLoadError`, translated into all ten
    shipped locale catalogs; `lr-phone-input` and `lr-emoji-picker` no longer borrow another
    component's message key;
  - format `lr-grounding-summary` evidence offsets with the effective locale;
  - fix an RTL double-mirror in `lr-chart`'s DOM legend placement by removing a redundant mirror
    rather than adding a third;
  - stop re-mirroring MapLibre's physically-assigned popup anchors under `dir="rtl"`.
  - `lr-data-grid` accepts `'start'`/`'end'` as spelling aliases for the existing RTL-relative
    `'left'`/`'right'` pin sides, and renders its pager glyphs as mirroring icons;

  ### Internal quality and coverage (informational)

  - complete standalone theme inputs and semantic contrast coverage;
  - publish every `lr-typing-indicator` geometry hook through CEM/editor metadata and gate its
    legacy public token namespace against future omissions;
  - cover `lr-spinner`'s populated, forwarded visible-label accessibility state.
  - make authored CSS-part references exact and complete, and correct `lr-model-select` accessible-name precedence prose.
  - verify conversation placeholder theming, typing motion, and native search-decoration suppression
    through rendered browser behavior, including WebKit's still-clickable search cancel control.
  - keep Web Test Runner failure payloads primitive-only and gate component tests against live DOM-node Chai assertions.
  - verify `lr-agent-run` spinner motion through live full-motion and reduced-motion computed styles.
  - verify `lr-prompt-studio` native option palettes through live light- and dark-theme computed styles.
  - harden agent-tool motion, native-control, placeholder, and footer layout contracts with rendered checks.
  - verify `lr-code-block-core` Shiki token palettes through rendered light and dark computed colors.
  - clarify that `lr-prompt-input` submits its composite state through typed events, not native form data.
  - cover every concrete typed chart controller in a shared 320px RTL long-content story fixture.
  - cover `lr-calendar` in an exact 320px RTL fixture with long localized event content.
  - keep lean code-block and Markdown bundles free of Shiki's full grammar table, enforced through
    peer-inclusive dependency-graph checks.
  - correct the documented Markdown heading-outline return type and guard its keys against the
    exported `MarkdownHeadingItem` interface.
  - enroll standalone theme inputs in the canonical design-token artifacts and keep stripped
    internal Shiki test seams out of published declarations.
  - recognize constant-backed `exportparts` vocabularies in the manifest contract and document the
    chart subclasses' inherited hidden-legend and control-state theming surfaces.
  - cover `lr-query-builder` at exactly 320px with long public and localized select labels in both
    LTR and RTL, guarding the composed `lr-select` min-content repair.
  - add paired exact-320px LTR/RTL Storybook baselines for long stat, table priority/action, vertical
    and horizontal timeline, and word-cloud legend compositions.
  - add exact-320px RTL Storybook and rendered baselines for checkbox-group wrapping and code-editor
    form-chrome/source-overflow ownership.
  - correct transcript-feed documentation for plain `scrollToBottom()` behavior and conditional
    interim-area rendering, with a focused regression for follow-state preservation.
  - align thread-list documentation with the shipped conditional `row-wrapper` part and clarify its
    nesting around built-in and custom row actions.
  - document and verify a genuinely lean widget-renderer manual-definition route whose real bundle
    graph excludes the eager default registry and all eight default mapped classes.
  - add exact-320px LTR/RTL long-content Storybook and rendered baselines for horizontal radio-button
    groups, switch labels/hints, and rubric fields/actions.
  - add exact-320px RTL long-content Storybook and rendered baselines for app rail, breadcrumb,
    button-group, and carousel compositions, including open mobile chrome and populated controls.
  - add exact-320px RTL long-summary, expanded-content, and action Storybook/rendered baselines for
    details and the composed accordion/accordion-item family.
  - add an exact-320px RTL long-content Storybook/rendered baseline for expanded and collapsed
    `lr-dock-panel` layouts beside independently scrolling main content.
  - correct the npm README and internal rationale for `lr-sequence-strip` to describe its named
    roving list/listitem inspection model instead of the retired aggregate-image model.
  - publish `lr-flow-canvas` zoom controls as real prototype methods in CEM and remove them from
    generated framework assignable-prop unions.
  - correct `lr-flow-canvas` running-edge documentation and metadata to use the time-only ambient
    duration token, with rendered coverage that distinguishes it from the transition shorthand.
  - nest `lr-flow-controls` and `lr-flow-minimap` inside the canonical `lr-flow-canvas` example so
    their documented corner slots are actually assigned.
  - remove `lr-stream-status` real-timer test races by installing stall listeners before connection
    or recovery can arm and fire their timers.
  - verify `lr-streaming-text` cursor theming and reduced-motion behavior through live rendered
    geometry, animation, and opacity instead of stylesheet-source assertions.
  - follow static, dynamic, side-effect, single-quoted, and double-quoted component imports when
    attributing optional peers, and document `lr-streaming-text`'s exact Markdown fallback matrix.
  - eagerly wire the `lr-stream-status` LiveDemo so its first Connect click works, and invalidate a
    pending connection completion when the demo is stopped.
  - replace source-only CSS assertions with rendered submit-color, listbox-overflow, and
    currentColor-glyph coverage for rubric form, select, and swatch picker.
  - stop the default-string slice generator from treating an incidental string literal in a helper
    module as a reachable message key, which had been pulling unused messages into component bundles;
  - forward a README mirror row's migration note into the generated migration disposition;

## 8.2.3

### Patch Changes

- 7d76af5: Fix horizontally scrolled Shiki code and diff backgrounds, provide shadow-local MapLibre canvas,
  marker, popup, and control layout, and prevent inline-size query containers from collapsing in
  shrink-to-fit layouts.
- db49718: Raise the optional `postal-mime` peer range to `^2.7.6`.

## 8.2.2

### Patch Changes

- f0a41be: Fix: `<lr-input>` now forwards `name` and a host-supplied `id` to its internal native `<input>`, restoring password-manager autofill/save detection for shadow-DOM-aware password managers that key field detection off the actual control's `name`/`id` rather than `autocomplete` alone. The internal `<label for>` tracks whichever id is in use. Leaving `id` unset keeps the internal input at `id="input"`, unchanged from before.

## 8.2.1

### Patch Changes

- 6c00bbc: Fix `<lr-chat-composer>` marking a field touched from a blur the platform forces when the control becomes disabled while focused, which could trip a Lit dev-mode reentrancy warning.
- 3a942eb: Fix `<lr-checkbox>` marking a field touched/interacted from a blur the platform forces when the control (or an ancestor `<fieldset>`) becomes disabled while it is focused, which could leave the control primed to show as invalid immediately on re-enable, or trip a Lit dev-mode reentrancy warning.
- 842484a: Fix `<lr-model-select>` marking a field touched from a blur the platform forces when the trigger button or combobox input becomes disabled while focused, which could trip a Lit dev-mode reentrancy warning.
- 9c69ed7: Fix `<lr-textarea>` marking a field touched from a blur the platform forces when the control becomes disabled while focused, which could trip a Lit dev-mode reentrancy warning.
- 9476967: Fix `<lr-time-input>` marking a segment touched from a blur the platform forces when the focused segment becomes disabled (its tabindex drops below zero while it still holds focus), which could trip a Lit dev-mode reentrancy warning.
- 823b395: `@aceshooting/lyra-ui/testing`'s `installHappyDomFormAssociatedShims()` now resolves the stub `ElementInternals.form` live via `host.closest('form')` instead of always `null` — a form-associated component that calls `attachInternals()` from its constructor (before it's inserted anywhere) previously got a permanently-`null` form owner even after being placed inside a real `<form>`, silently breaking anything (like `<lr-button>`) that resolves its submit target through `internals.form`.
- de626e7: Fix `<lr-input>` marking a field touched from a blur the platform forces when the control becomes disabled while focused, and stop `formDisabledCallback()` redoing validity/render work that a same-tick `disabled` write already performed — together these could trip Lit's dev-mode "scheduled an update after an update completed" warning inside a real `<lr-dialog>` for a re-render nothing observable needed.
- 340d39b: Fix `<lr-known-date>` marking a field touched from a blur the platform forces when the field becomes disabled while focused, which could trip a Lit dev-mode reentrancy warning.
- db19f3e: `LyraElement`'s ancestor `class`/`style` observer (kept for CSS-only direction/locale context changes) now only calls `requestUpdate()` when the resolved direction or locale actually changes, instead of on every ancestor `class`/`style` mutation regardless of relevance — an unrelated ancestor style write (e.g. an overlay's own stacking-index custom property) could otherwise schedule a spurious re-render.
- 6ef43b1: Fix `LyraElement`'s ancestor `class`/`style` observer (introduced in the previous release to stop spurious re-renders) forcing a `getComputedStyle()` read on _every_ ancestor `class`/`style`/`locale`/`lang` mutation, even ones with nothing to do with direction. That forced read — from a sibling's own unrelated `MutationObserver` reacting to an ancestor's inline-style write — could permanently break a completely unrelated host's own shadow-DOM CSS custom-property resolution in Chromium (observed with `<lr-chip-group>`'s `--lr-chip-group-overflow-expanded-color`), and forced an extra synchronous style read on every reconnect/adoption regardless of whether anything direction-relevant changed. The observer now only calls `getComputedStyle()` when the mutation could plausibly affect direction (an explicit `dir`/`class` change, or a `style` change that actually declares `direction`), and seeds its baseline from whatever the host's own render already resolved instead of forcing an extra read at connect time.
- 0eb1de0: Fix `<lr-token-input>` marking a field touched (and committing a pending draft) from a blur the platform forces when the control becomes disabled while focused, which could trip a Lit dev-mode reentrancy warning.
- e849075: Fix `<lr-code-editor>` marking a field touched from a blur the platform forces when the control becomes disabled while focused, which could trip a Lit dev-mode reentrancy warning.
- f4b8304: Fix `<lr-phone-input>` marking a field touched from a blur the platform forces when the control becomes disabled while focused, which could trip a Lit dev-mode reentrancy warning.
- a9cd82e: Fix `<lr-file-input>` marking its dropzone touched from a blur the platform forces when the focused `[part="base"]` button becomes disabled, which could trip a Lit dev-mode reentrancy warning.
- 9c35472: Fix `<lr-emoji-picker>` marking a field touched from a blur the platform forces when the control becomes disabled while focused, which could trip a Lit dev-mode reentrancy warning.
- 5b96432: Fix `<lr-checkbox-group>` marking the group touched from a blur the platform forces when a focused child `<lr-checkbox>` becomes disabled -- either directly or via an ancestor `<fieldset disabled>` cascading down -- which could trip a Lit dev-mode reentrancy warning.
- 3d5b695: Fix `<lr-date-input>` marking the field touched from a blur the platform forces when the internal date text input becomes disabled while focused, which could trip a Lit dev-mode reentrancy warning.
- 8e1eb54: Fix `<lr-otp-input>` marking a field touched from a blur the platform forces when the control becomes disabled while focused, which could trip a Lit dev-mode reentrancy warning.
- 530c30b: Fix `<lr-voice-picker>` marking a field touched from a blur the platform forces when the trigger button or free-text combobox input becomes disabled while focused, which could trip a Lit dev-mode reentrancy warning.
- 614ee6a: Fix `<lr-switch>` marking a field touched from a blur the browser forces when the control (a form-associated custom element) becomes disabled while focused, which could trip a Lit dev-mode reentrancy warning and could flash `user-invalid` styling on a later re-enable for an interaction the user never had.
- 6149517: Fix `<lr-select>` marking a field touched from a blur the platform forces when the trigger becomes disabled while focused, which could trip a Lit dev-mode reentrancy warning.
- 1c58af5: Fix `<lr-combobox>` marking its field touched from a blur the platform forces when the internal input becomes disabled while focused, which could trip a Lit dev-mode reentrancy warning.
- aa345d8: Fix `<lr-locale-picker>` marking a field touched from a blur the platform forces when the control becomes disabled while focused, which could trip a Lit dev-mode reentrancy warning.

## 8.2.0

### Minor Changes

- 5944ba7: Add a `click()` override to five multi-control form wrapper elements —
  `<lr-radio-group>`, `<lr-checkbox-group>`, `<lr-rubric-form>`, `<lr-graph-query-builder>`, and
  `<lr-tool-param-form>` — so a host click (whether from a `<label for>` association or a
  programmatic `.click()`) reaches the first relevant internal control instead of being a no-op.
  `<lr-radio-group>` activates its selected (or first enabled) radio, matching its own `focus()`
  override; the other four move focus to their first field.

## 8.1.0

### Minor Changes

- 968d39c: Fix `<lr-locale-picker>`'s trigger button never rendering a flag for the currently selected
  locale — `showFlags` only ever affected the open listbox's rows, so a consumer relying on the
  default `show-flags` still saw a text-only trigger (e.g. "English") with no flag until the
  dropdown was opened. The trigger now renders the same `<lr-flag>` (new `trigger-flag` part,
  honoring a `country` catalog override exactly like the row does) that the matching row shows.

### Patch Changes

- b8028f8: Fix `DocumentAnchorTarget` (the shared mixin behind every viewer's `.scrollToAnchor()`) so a
  throwing `applyAnchor()` reliably degrades to a resolved `false` and still emits
  `lr-anchor-result:{found:false}`, instead of leaving the promise rejected and the documented
  "always reports a definite result" contract broken. A previous attempt at this (a blanket
  try/catch) was reverted because it made `lr-ebook-viewer`'s own override's localized
  rendition-failure alert unreachable; `scrollToAnchor()` is now split into a thin public wrapper
  carrying the safety net and a `performScrollToAnchor()` the mixin's own subclasses (currently only
  `lr-ebook-viewer`) can call directly to bypass it and keep full control of their own catch.
- a260188: `lr-archive-viewer` no longer binds an untrusted ZIP entry name as a DOM `id` (`renderEntry()` set
  `id=${entry.name}`, a classic DOM-clobbering primitive — a crafted archive entry named e.g.
  `"body"` or `"documentElement"` could shadow a global DOM property lookup for code elsewhere in the
  page). Fragment-anchor resolution (`scrollToAnchor()`'s `'fragment'` kind) now matches the target
  row by its rendered `textContent` instead of by `id`, and no longer delegates to the shared
  `TextViewerTarget` base's generic `id`-based fragment resolution for this component.
- 21ff77f: Harden three more components against untrusted values reaching a CSS sink unvalidated (same class
  of fix as the earlier ANSI-color/`align`/`open-link` hardening):

  - `lr-selection-toolbar` computed its floating position directly from a caller-supplied `rect`
    (`DOMRectReadOnly | null`, but nothing enforces that shape at runtime) into a `styleMap()`-bound
    custom property. A non-finite or non-numeric `left`/`top`/`width`/`bottom` could produce `NaNpx`
    or, since `styleMap()`'s first commit serializes the whole `style` value as one string, break out
    of the declaration. Both `coordinates()` and `updateToolbarPosition()` now coerce `rect` through a
    shared `safeRect()` helper before use.
  - `lr-data-grid`'s `columnStyle()` wrote a column's `width` into a `--column-authored-width` custom
    property with no numeric guard, unlike the sibling `gridTemplate` getter's own `Number.isFinite`
    check for the same field — inconsistent, and reachable by the same first-commit `styleMap()`
    string-injection class of bug above.
  - `lr-entity-card`'s data-driven type-badge color only rejected `;`/`{`/`}` structural characters,
    not `url(...)`, unlike every other color sink in this library. Now routed through the shared
    `sanitizeCssColor()` helper.

- 38d4511: Fix `<lr-flow-minimap>` not respecting a paired `<lr-flow-canvas>`'s `locked` state. Click-to-center,
  wheel-zoom, viewport-rectangle drag, and the viewport rectangle's keyboard controls now check the
  linked canvas's `locked` property before calling `setViewport()`/`zoomIn()`/`zoomOut()`/`fit()`,
  mirroring the same guard `<lr-flow-canvas>` already applies to each of its own gesture handlers.
  Previously the minimap relied entirely on the paired canvas separately gating those calls itself;
  a locked canvas now stays locked even if a `FlowCanvasLike` companion does not also guard its own
  methods. The `FlowCanvasLike` structural interface gained a read-only `locked` accessor to support
  this.
- fbcf0ef: Fix `installHappyDomFormAssociatedShims()`'s stub `ElementInternals` missing a `states`
  (`CustomStateSet`) property. Any form-associated component that calls
  `this.internals.states.add()`/`.delete()`/`.has()` (added in 8.0's custom-state work, e.g.
  `lr-input`'s `blank` state) threw on its very first update under the documented happy-dom test
  setup.
- 867f68c: `lr-icon` and `lr-icon-button` clone slotted custom SVG content into a real SVG namespace so it
  paints reliably (Chromium doesn't reliably paint slotted SVG geometry). That clone copied every
  source attribute verbatim, including event handlers (`onload`, `onclick`, ...) and `href`/
  `xlink:href`, with no sanitizer in the loop — unlike a fetched `src` document, which is already
  sanitized through DOMPurify. Both clone paths now drop event-handler and `href`/`xlink:href`
  attributes (a new shared `isUnsafeSvgCloneAttribute()` helper); every other presentational
  attribute (`d`, `fill`, `stroke`, `viewBox`, `transform`, gradient stops, ...) is unaffected.
- 21e6f07: Fix `<lr-knowledge-graph-explorer>`'s `[part="search-empty"]` "no matches" message rendering as a
  direct child of the `role="list"` `[part="search-results"]` container without `role="listitem"` --
  invalid ARIA, since every child of a list role must itself be `listitem` (or one of a small allowed
  set), unlike the real `[part="search-result"]` match rows which already carry it. It now carries
  `role="listitem"` too.
- 2e0d525: Fix `custom-elements.json` under-reporting `cssParts` for components that extend another
  component's class (e.g. `<lr-number-input>` extending `<lr-input>`, `<lr-dropdown>` extending
  `<lr-popover>`). The manifest-compaction step pruned any inherited-and-resolvable entry — including
  CSS parts — off a subclass's own declaration, on the assumption that a consumer would walk the JS
  `extends` chain to see the full contract, the same way it does for members/attributes. Unlike those,
  `::part()` has no such chain for its consumers (docs generators, editor tooling, `::part()` usage
  checks), which read a tag's `cssParts` list directly, per tag — exactly how `cssStates` already
  behaved. `<lr-number-input>` now declares `form-control`, `form-control-label`, `input-wrapper`, and
  `input` (inherited from `<lr-input>`) in addition to its own parts, and `<lr-dropdown>` now declares
  `trigger`, `popup`, `dialog`, `popup__popup`, `content`, `body`, `arrow`, and `popup__arrow`
  (inherited from `<lr-popover>`). 15 other components with the same inheritance shape (the icon
  charts, `<lr-native-time-input>`, `<lr-radio-button>`, `<lr-accordion-item>`, `<lr-dropdown-item>`,
  `<lr-tag>`, `<lr-drawer>`) gained the same correction. Generated docs (`llms/components/*.md`) and
  other manifest consumers were already unaffected, since they already read parts through
  `expandManifestInheritance()`; only the checked-in compact manifest itself was missing them.
- 6313c1b: `lr-avatar`'s `image`, `lr-attachment-chip`'s `thumbnail-src` and file-object preview URL, and
  `lr-flag`'s pre-resolved `src` are now validated through the shared `safeMediaSrc()` helper before
  reaching an `<img src>` sink, rejecting `javascript:`/other unsafe schemes. Each falls back to its
  existing placeholder state (initials, the generic file glyph, or an empty render) instead of
  rendering an unsafe URL.
- ad5a464: Fix partial child-event stopping in three components whose nested `<lr-virtual-list>`/child
  controls only had some of their bubbling events stopped at the host boundary:

  - `<lr-notebook-viewer>` and `<lr-page-rail>` each already stopped the nested `<lr-virtual-list>`'s
    `lr-visible-range-changed` event from leaking past the host, but left its `lr-scroll` event (and,
    for `<lr-page-rail>`, its `lr-load-more` event too) undocumented and free to bubble straight
    through. Both are now stopped the same way, mirroring the existing `lr-visible-range-changed`
    handling.
  - `<lr-query-builder>`'s add/remove condition buttons called `addCondition()`/`removeCondition()`
    directly from their `@click` handlers, bypassing the `consumeChildEvent()` helper every other
    handler in the component consistently uses to stop the raw composed child event before emitting
    the component's own wrapper event. The two buttons now route through `consumeChildEvent()` like
    the rest of the file.

  `retrieval-results.class.ts` and `tool-select-dialog.class.ts` already stop every child event
  consistently, so neither needed a change.

- d53cec6: `lr-spreadsheet-viewer` now validates that the optional `xlsx` peer's parsed `workbook.SheetNames`
  is actually an array of strings before using it, instead of trusting an unchecked type assertion.
  A malformed shape (a real risk here, since the workbook is parsed from consumer-supplied,
  untrusted `src` content) now surfaces the standard localized load-failure state instead of silently
  producing corrupted sheet tabs.
- d84fca9: Harden three components against untrusted values reaching CSS/URL sinks unvalidated:

  - `lr-terminal` and `lr-notebook-viewer`'s shared ANSI-segment styling (`segmentStyle()`) wrote a
    parsed stream's `fg`/`bg` color tokens directly into an inline `style` declaration; a
    crafted ANSI color escape could inject CSS syntax. Both now validate through
    `sanitizeCssColor()` before the value reaches `styleMap()`.
  - `lr-widget-renderer`'s agent-authored widget tree wrote an arbitrary `align` prop string
    directly into `align-items` with no allowlist. Now normalized through a bounded value map;
    an unrecognized value renders as unset rather than reaching the declaration list.
  - `lr-mcp-app`'s `open-link` message handler forwarded a `postMessage`-supplied `href` to
    consumers verbatim as long as it was a string, with no scheme validation. Now validated through
    `safeLinkHref()` (rejects `javascript:`/other unsafe schemes) before the `lr-mcp-open-link`
    event fires.

- 0e6d53e: Fix `lr-switch`'s thumb miscentering when a consumer styles the `track` part with a `border`.
  `box-sizing: border-box` (the library-wide default) let an added border eat into the padding box
  the thumb is absolutely positioned against, while the thumb's own size/travel math stayed derived
  from the track's declared (border-box) dimensions -- breaking symmetric clearance on the far edge
  in both the unchecked and checked states. The track part now uses `box-sizing: content-box`, so an
  added border grows the track's outer footprint instead of shrinking the space the thumb positions
  within, keeping clearance symmetric regardless of border width.
- 7f37a42: `<lr-table>`'s `TableColumn.cellStyle` hook now sanitizes every property/value pair before it
  reaches `styleMap()`: the property name must match a safe CSS-identifier shape, the value must
  contain no `;`/`{`/`}` structural characters or a `url(...)` function, and the browser must accept
  the property/value pair via `CSS.supports()` (falling back to a permissive regex where
  `CSS.supports` is unavailable). A custom property (`--foo`) is exempted from the `CSS.supports`
  check, since arbitrary custom-property values are always valid CSS.
- 7987719: Fix `lr-table` rows and `lr-tree-item` where hovering an already-selected row/item had no visible
  effect. The `:hover` rule and the selected-state resting rule both resolved to the same
  `--lr-color-brand-quiet` fallback at equal CSS specificity (and, for `lr-tree-item`, the
  `:host([aria-selected='true'])`-scoped selected rule outranked a bare `[part='row']:hover`
  outright), so the selected rule always won and hovering produced no change. Mirrors the fix already
  applied to these same files' `:active`-while-selected rules: the hover rule now also matches through
  the same specificity-matching selector arm (source order deciding the tie), and its resting fill is
  a distinct `color-mix()` step (using `--lr-color-mix-hover`) instead of the plain `brand-quiet`
  fallback, so hovering a selected row/item is visually distinguishable from its resting state.
- 4392216: Fix `<lr-tree>`'s `expandAll()` bypassing lazy-loading. It used to set `expanded = true` directly
  on every node, skipping `<lr-tree-item>`'s own `expand()` -- the only code path that emits
  `lr-lazy-load` and calls `beginLazyLoad()` for a `lazy` node whose children have not been fetched
  yet. A tree containing lazy nodes would render them visually expanded but empty after
  `expandAll()`, with their content never actually requested. `expandAll()` now calls each node's
  `expand()` directly, so a lazy node triggers the same load request whether it was expanded by a
  click or by `expandAll()`.

## 8.0.1

### Patch Changes

- Fix three bugs surfaced by the full Chromium/Firefox/WebKit browser-engine suite:

  - `lr-page-rail`: a `thumbWidth` change scheduled its thumbnail-state invalidation from a
    post-render hook, forcing an extra Lit update cycle instead of reflecting the new width in the
    same pass.
  - `lr-graph`: a pointer-capture call on canvas pointerdown was unguarded against browsers
    rejecting capture for a synthetic (non-driver) pointer id, unlike its sibling release call.
  - `lr-map`: a GeoJSON-view WebGL2 load-failure flag could stay set across a re-entrant load
    triggered while the real availability check was still racing a test override.

## 8.0.0

### Major Changes

- aa9f6ff: 8.0.0 — one styling vocabulary, a colour system that works in the dark, and a migration promise that is actually true.

  This release is mostly about removing accidents: names that meant two things, values that were only ever solved for light mode, and a mirror table that claimed more than the components could honour. Almost every break below is a rename with a mechanical fix.

  ### The migration promise

  All 145 pinned Web Awesome and Shoelace tags now have a checked migration classification. `scripts/check-migration-coverage.mjs` fails when the inventory, README relationship, or registered target drifts. The codemod applies only `exact` and fully specified `rewritten` mappings; `warning-required`, `conceptual-only`, and `unsupported` uses stay unchanged and are reported with their source location.

  Lyra 7 overlay defaults have their own explicit, opt-in codemod profile. Run
  `migrate-wa.mjs --origin=lyra-v7 --dry-run …` to preserve the old popup positioning and
  popover/tooltip arrow behavior before upgrading. It inserts only absent attributes, emits true
  booleans as presence (`flip`, `shift`, `without-arrow`), never rewrites an `lr-*` tag/import, and
  blocks on opaque spreads or DOM aliases rather than guessing.

  - **Both upstream spellings of the clear button are now accepted** on `lr-input`, `lr-select` and `lr-combobox`. Shoelace spells it `clearable`, Web Awesome spells it `with-clear`, and each control previously honoured only one — so half of all migrations silently lost the control. Neither spelling is deprecated: deprecating Web Awesome's own name would work against the promise.

  ### Complete mapped components without losing Lyra behavior

  Public names now describe one coherent contract. Where an existing Lyra component meant
  something different, its behavior remains available under a truthful tag instead of being
  deleted or silently mixed with the mapped API:

  - `lr-time-input` is now the locale-aware segmented time field; the former browser-native field
    is `lr-native-time-input`.
  - `lr-zoomable-frame` is now the sandboxed iframe preview; the former slotted/image inspection
    surface is `lr-pan-zoom`.
  - New `lr-split-panel` supplies the exact two-pane separator contract while the richer multipanel
    `lr-split` remains unchanged.
  - Accordion/Item, Tree/Item, Dropdown/Menu, Carousel, Popup/Popover/Tooltip, Dialog/Drawer,
    form controls, formatters, Include, Icon, Chart/Sparkline, Date Picker/Input, File Input and the
    remaining mapped helpers now carry their complete attributes, defaults, slots, events, parts,
    CSS properties, methods, native relays and form behavior.
  - New `lr-page` is an allocation-responsive semantic application shell with per-instance skip
    targets and shared-overlay mobile navigation.
  - New `lr-video` and `lr-video-playlist` use a shared generation-safe native-media controller,
    preserve platform media promises, cap remote thumbnail input, and keep inactive players
    unloaded so a playlist cannot overlap audio.
  - Experimental `lr-data-grid` returns with the complete mapped data-grid contract and full semver
    coverage; `lr-table` remains its smaller, independent table component.
  - Mapped writable IDLs are writable in both TypeScript and runtime behavior:
    `lr-select.selectedOptions` accepts exact live option occurrences without emitting user events,
    while `lr-combobox.validationTarget`, `lr-date-input.validationTarget`, and
    `lr-file-input.validationTarget` accept validity anchors with `undefined` restoring each
    component's internal default. Assigning `lr-popup.popup` is source-compatible but deliberately
    leaves the shadow-owned positioning/animation node authoritative.
  - `lr-option.defaultSelected` now maps the `selected` attribute (with non-reflecting property
    writes) to the parent combobox/select reset default, while `lr-option.selected` is property-only
    live state. User selection no longer rewrites the declarative default; changing
    `defaultSelected` after mount updates what `form.reset()` restores without clobbering a dirty
    live selection.
  - Mapped string setters accept upstream `null` writes without making reads nullable: `name` and
    `for` clear to `''`, ordinary string values clear to `''`, and checkbox/switch values restore
    their native absent-attribute `'on'` default.
  - Additional upstream write compatibility keeps canonical reads stable: breadcrumb `href`, icon
    `name`/`src`, icon-button `name`, and split-panel `snap` accept `undefined`; animation names
    accept arbitrary registered strings; badge/tag/rating/toast size and variant aliases normalize
    to Lyra's canonical values; and date-input accepts Web Awesome object validators, including
    their observed-attribute revalidation contract. The deprecated
    `lr-known-date::part(label)` alias remains on the `form-control-label` node and will not be
    removed before 10.0.0.

  Registration examples use granular component modules. The principal new and compatibility
  surfaces register from these exact paths:

  ```js
  import "@aceshooting/lyra-ui/components/lr-page.js";
  import "@aceshooting/lyra-ui/components/lr-video.js";
  import "@aceshooting/lyra-ui/components/lr-video-playlist.js";
  import "@aceshooting/lyra-ui/components/lr-native-time-input.js";
  import "@aceshooting/lyra-ui/components/lr-pan-zoom.js";
  import "@aceshooting/lyra-ui/components/lr-split-panel.js";
  import "@aceshooting/lyra-ui/components/lr-alert.js";
  ```

  The component-family references contain the exact surface and the 7.x migration notes for
  changed defaults and event timing.

  ### Security-preserving differences

  Migration never trades away Lyra's stronger defaults. `lr-include` still sanitizes every
  fragment, has no script-executing mode, and defaults to same-origin fetches; independently
  authored link `rel` values are not copied onto controls that derive
  `rel="noopener noreferrer"` from `target`; iframe/media URLs and remote thumbnail input remain
  validated and bounded. Those uses receive location-aware warnings instead of silent rewrites.

  ### Platform and distribution

  - Root and granular imports are server-safe. `ssr-loader.js` publishes an exhaustive
    render-and-hydrate/client-render matrix, installs Lit hydration support in the browser, and
    exposes diagnostics; CI verifies server rendering and real-browser node reuse.
  - Generated opt-in React JSX, Vue and Svelte declarations come from the same Custom Elements
    Manifest as editor data. The manifest has its own package export and packed consumers exercise
    each framework surface without runtime wrappers.
  - The side-effect-free manual autoloader and guarded CDN entry discover only inventory-known
    rendered tags; optional peers remain opt-in. `allDefined()` is also available as a readiness
    barrier after explicit or automatic registration.
  - `native.css` and `utilities.css` are independent opt-in, layered, tokenized assets. Neither is
    imported by the root entry or installs a page-wide reset.
  - A public animation registry supports page and per-element overrides, logical RTL keyframes and
    reduced motion without changing component lifecycle events.
  - Overlay consumers share rendered-state suspension, and third-party modal systems can use the
    scoped, nestable `suspendLyraModalsFor()` handle from
    `@aceshooting/lyra-ui/utilities/overlay-manager.js` without abandoning Lyra's focus/inert stack.
  - Canvas renderers watch theme/style/link/CSSOM/adopted-sheet/media-query changes. A host theme
    engine with an otherwise unobservable mutation can call `invalidateLyraTheme()` from
    `@aceshooting/lyra-ui/utilities/theme.js` for the owning document realm.
  - Component status, history-derived `since`, and actionable deprecation metadata flow through
    CEM, Storybook, editor data and the agent reference. Stable and experimental published APIs both
    receive semver protection; a deprecation names its replacement and cannot be removed before the
    major after the complete following major release line.
  - Registration imports, allowlists, package side effects, migration classifications and the
    component scaffold are inventory-driven and freshness-checked.

  ### Design-system operations and integrations

  - Every public tag has a stable tag-shaped registration entry point such as
    `@aceshooting/lyra-ui/components/lr-input.js`. Existing family registration paths remain
    supported, while class-only modules stay available at their family paths.
  - Public optional-peer APIs now use Lyra-owned structural interfaces instead of leaking peer
    implementation types or `any`. They remain compatible with the supported Chart.js, Marked,
    Shiki, MapLibre, D3, DOMPurify and document-viewer peers without making those packages required
    dependencies.
  - Event contract checks now compare concrete detail schemas across event maps, class JSDoc and
    the Custom Elements Manifest, reject `any`, and preserve native `Event`/`InputEvent`
    constructors for native relays.
  - The theme runtime distinguishes system-following `auto` from cascade-owned `unset`, supports a
    validated brand accent, and provides reusable built-in or application-defined presets through
    the same persistence and change-event path.
  - An authored canonical token inventory generates DTCG-compatible interchange, fixture CSS,
    Storybook token data and stable documentation/editor inputs, with freshness checks against the
    production token styles.
  - Synthetic `en-XA` and mirrored RTL `ar-XB` pseudo-locales exercise string expansion,
    interpolation and direction without presenting themselves as human translations.
  - Runnable React 19, Vue and Svelte examples verify granular registration, typed properties and
    typed custom events against the packed package.
  - Generated component quality and integration references expose recorded accessibility,
    browser, SSR, optional-peer, dependency and bundle evidence without converting missing human
    review into a pass.
  - Governance, support and RFC documents define the contribution and compatibility process, and
    the bundled composition skill teaches consumers to assemble Lyra interfaces from stable public
    entry points.

  ### Attribute renames (breaking)

  Every one of these is a find-and-replace. Where the default flips, the behaviour is the upstream one.

  | 7.x                                                            | 8.0.0                   | Note                                                                                                                                                                                |
  | -------------------------------------------------------------- | ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
  | `no-light-dismiss`                                             | `light-dismiss`         | polarity un-inverted; default flips to off                                                                                                                                          |
  | `hide-summary`                                                 | `with-summary`          | polarity un-inverted; default flips to off                                                                                                                                          |
  | `total-items`                                                  | `total`                 |                                                                                                                                                                                     |
  | `<lr-avatar src>`                                              | `<lr-avatar image>`     |                                                                                                                                                                                     |
  | `<lr-drawer>` default `placement`                              | `start` → `end`         | matches the upstream default                                                                                                                                                        |
  | `<lr-tabs>`                                                    | `<lr-tab-group>`        | plus `lr-tabs-change` → `lr-tab-show`/`lr-tab-hide`, and `--lr-tabs-*` → `--lr-tab-group-*`                                                                                         |
  | `<lr-tree-node>`                                               | `<lr-tree-item>`        |                                                                                                                                                                                     |
  | `<lr-slider>` `fill` part                                      | `indicator` part        |                                                                                                                                                                                     |
  | `<lr-callout variant="danger">` `[part="base"]` `role="alert"` | shared live-region sink | announcements now flow through the shared light-DOM live-region sink instead; `[part="base"]` carries `role="group"` (only when the host has an accessible label) or no role at all |
  | `<lr-spinner>` `part="base"`                                   | `part="base spinner"`   | an exact-match `[part="base"]` attribute selector no longer matches; `::part(base)` is unaffected. Also gained `role="progressbar"`                                                 |

  The JavaScript-only string property `.autoCorrect` on `lr-input`, `lr-textarea`, and
  `lr-combobox` is now the upstream-compatible `.autocorrect` IDL, which always reads as boolean.
  Web Awesome boolean writes remain canonical. For a prefix-only Shoelace migration, `lr-input`
  also accepts `'off'`/`'on'` writes and `lr-textarea` accepts its complete string write surface;
  both normalize the result back to a boolean. The HTML attribute name remains `autocorrect`; use
  `autocorrect="on"` / `autocorrect="off"` in markup.

  ### Colour, in both modes

  The palette is generated from a numeric ramp and a 45-slot semantic grid, and `scripts/check-contrast.mjs` proves 367 pairs across light and dark on every run. Colours shifted where the generated ramp put them — the brand seed moved `#0969da` → `#035ec6`. Restoring the old hexes would reintroduce the failures the ramp exists to prevent.

  - **Dark mode had no elevation.** `--lr-shadow` was a single black step at 12–22% alpha, which against a near-black surface is not a luminance difference at all. There are now five steps (`--lr-shadow-xs` … `-xl`), declared per mode with roughly tripled dark alphas, and every call site is tiered by role. A theme that set `--lr-theme-shadow-color` keeps working; one that overrode `--lr-shadow` directly should move to the step it meant.
  - **Modal panels no longer share the page surface token.** New `--lr-color-surface-overlay`: the page surface in light mode, lighter than the page in dark. Before this, an open dialog in dark mode was a scrim with text floating on it and no visible panel. Both scrims (`--lr-color-overlay`, `--lr-color-overlay-strong`) also gained dark values.
  - **The terminal's ANSI palette is now two token sets.** `--lr-terminal-color-*` remains the foreground set; SGR 40-47/100-107 now read a new `--lr-terminal-bg-*` set solved against the panel's default text. One set could not serve both roles: once the foregrounds were solved to be legible on a light panel they were all dark, so `ESC[41m` painted a near-black red behind near-black default text. `white` and `black` also no longer resolve to the same hex, which had made `ESC[30;47m` invisible text on its own colour.

  ### Interaction states

  `filter: brightness()` is gone as the hover mechanism. It multiplies every channel — so it lightened a dark control and darkened a light one only by coincidence, did nothing whatsoever to a pure white or black fill, and shifted the control's text and icons along with its background. Hover and press are now a colour mix toward `--lr-color-mix-partner`, tunable library-wide through `--lr-color-mix-hover` / `--lr-color-mix-active`. `--lr-hover-brightness` still resolves but no component reads it.

  Every interactive part that responds to `:hover` now also responds to `:active`, enforced by `scripts/check-interaction-states.mjs`.

  ### One styling vocabulary

  `variant`, `tone` and `kind` meant the same thing on different components; `appearance` meant two unrelated things; twenty-two size unions covered four different ladders. The shared vocabulary now lives in one place.

  - **`tone` → `variant`** on `lr-avatar`, `lr-avatar-group`, `lr-chip` and `lr-confirm-bar`, and on the activity-feed / tree-badge data fields. No alias.
  - **`appearance="card|plain"` → `frame="card|plain"`** on the thirteen container components that had it. `appearance` now means the fill vocabulary only: `accent | filled | outlined | filled-outlined | plain`.
  - **`lr-button`'s default `appearance` is now `accent`**, and `filled` is a genuinely different, quieter tier — the two used to render identically for every variant except neutral, where `filled` resolved to the page background.
  - **`size` accepts both ladders everywhere**: the library's `2xs|xs|s|m|l|xl` and Web Awesome's `small|medium|large`.
  - **Numeric properties that were misnamed `size` are renamed**: `lr-attachment-chip` and `lr-file-icon` take `bytes`; `lr-dock-panel` takes `extent` (with `min-extent`/`max-extent`).
  - **`lr-badge`, `lr-tag` and `lr-chip` are no longer unconditionally pill-shaped.** They default to a rounded rectangle; add `pill` for the old shape.

  ### Tokens and theming

  - **CSS cascade layers.** `theme.css` declares `@layer lr-base, lr-theme, lr-utilities, lr-overrides` and its tokens sit in `lr-theme`. Any _unlayered_ consumer declaration now beats every Lyra one regardless of specificity or load order. If you previously wrapped your overrides in your own `@layer`, they now sort relative to `lr-theme` instead of losing to an unlayered `:root`.
  - **Compound motion tokens are split** into duration and easing.
  - **`--lr-font-size-md` is removed**; use `--lr-font-size-m`. The two were the same value under two names, which is why `lr-button` rendered `size="m"` and `size="l"` at identical text sizes.
  - **New `--lr-form-control-*` tier** (height, font-size, padding, gap, radius), one ladder shared by every control.
  - **The required-field marker is themeable.** The `*` every labelled control appends to its label reads `--lr-form-control-required-content` (default `' *'`), `--lr-form-control-required-color` (default `--lr-color-danger`) and `--lr-form-control-required-offset` (default `0`) — so a locale that wants `' (required)'`, a design that wants the marker in the label's own colour, or a form that wants no marker at all is one declaration, not a per-component override. Deliberately undeclared rather than given a `--lr-theme-*` input: an undeclared custom property inherits, so a single `:root` rule retunes every marker in the application; declaring them on `:host` would have made the host's own value win and cut off exactly that route.

  ### Localization

  - **Pluralized messages are now CLDR category objects**, selected through `Intl.PluralRules`, replacing the paired `<key>` + `<key>Plural` convention. A catalog registered through `registerLyraLocale()` or a per-instance `.strings` that used the old pair must be rewritten as `{ one: '…', other: '…' }` — with that locale's real categories, which for Russian is four and for Arabic six.
  - **Ten complete translation catalogs ship**, as side-effect-only modules: `import '@aceshooting/lyra-ui/translations/de.js';` and so on for `ar`, `es`, `fa`, `fr`, `he`, `ja`, `pt-BR`, `ru`, `zh-CN`. Persian and Hebrew add regional fallback and RTL coverage; set `dir="rtl"` explicitly because locale selection does not change writing direction.

  ### Form validation

  - **`lr-invalid` is now `cancelable`.** It is the alias for the platform's own `invalid` event, which is cancelable, and cancelling a copy of an event can only honestly mean cancelling the original — so `event.preventDefault()` on `lr-invalid` now forwards to the native event and suppresses the browser's validation bubble and `reportValidity()`'s focus/scroll. An app that wired `lr-invalid` to its own error banner previously had no way to stop the native UI appearing alongside it. Nothing breaks by adding cancelability, but a listener that already called `preventDefault()` speculatively now actually vetoes something.
  - **A control barred from constraint validation no longer publishes `:state(invalid)` / `:state(user-invalid)`** — nor `valid`/`user-valid`. Disabled, fieldset-disabled and readonly controls match neither `:valid` nor `:invalid` natively (verified against real `<input required disabled>` and `<input required readonly>`), and publishing `invalid` from one is what made the documented `lr-input:state(user-invalid) { border-color: red }` rule paint every disabled required field red. `:state(required)` / `:state(optional)` describe the attribute rather than the outcome, so they keep publishing exactly like native `:required`/`:optional`. A stylesheet that relied on the old behaviour to style disabled fields must select `:disabled` instead. The `readonly` bar had also been copy-pasted per component and missed one — `<lr-rating required readonly>` reported `valueMissing` while `<lr-otp-input required readonly>` did not; both now route through one shared predicate.

  ### Registration is no longer a side effect of the package root

  **`import '@aceshooting/lyra-ui'` registers nothing. Rewrite it as `import '@aceshooting/lyra-ui/all.js'`.**

  The package root is now a pure export surface. In 7.x it was both: importing it for a type also defined all 268 root-included tags, which meant a consumer could not name a class or an event-map type without conceding the whole library to their bundle. Those 268 registration side effects now live in `all.js`, and `package.json#sideEffects` moved with them, so the root is genuinely free to import.

  - Every named and type export stays on the root, under the same specifier, with the same name. `import { LyraSelect, type LyraSelectEventMap } from '@aceshooting/lyra-ui'` is unchanged — it just no longer registers anything. Only the side effect moved.
  - `all.js` registers the same 268 tags the root used to, and still excludes the same 15 optional-peer-family tags (`lr-chart` and its 8 typed subclasses, `lr-box-plot`, `lr-histogram`, `lr-map`, `lr-graph`, `lr-knowledge-graph-explorer`, `lr-geojson-view`), which keep requiring their own granular import. Granular per-component imports remain the recommendation; `all.js` exists so an application can upgrade in one line, not because 268 elements is a sensible bundle.
  - **A missed migration does not throw.** The import still resolves, the build still succeeds, and the tags simply never upgrade — an unknown inert `<lr-select>` with its light DOM showing through and nothing in the console. That silence is what makes this the nastiest item in the release: every rename above fails loudly, this one does not.
  - `ssr-loader.js` is unaffected — it still installs Lit's hydration hook and then pulls the full `all.js` closure, exactly as before. A server integration that wants granular registration can import the new `@aceshooting/lyra-ui/hydration.js` first instead, then only the components it renders; `@aceshooting/lyra-ui/ssr/all.js` is the server-side convenience that registers the complete 283-tag inventory.

  ### Packaging

  - **`@aceshooting/lyra-ui/internal/*` is no longer a published subpath.** The supported helpers live under `@aceshooting/lyra-ui/utilities/*`, which now also carries `FormAssociated` and `groupByRecency` — previously reachable only through the side-effectful root barrel.
  - **`lr-flag`'s deprecated `detailed` boolean is removed**; use `variant="detailed"`.
  - **`lr-combobox`'s `withClear` alias is removed** in favour of the two upstream spellings above.
  - **Published tarballs no longer contain source maps.** `package.json#files` ships `dist` and not `src`, so every `.js.map` / `.d.ts.map` pointed at a `../../../../src/**/*.ts` path that does not exist in an install and carried no `sourcesContent` — dead weight, and actively worse for `declarationMap`, which routed an editor's Go-to-Definition at that missing `.ts` and failed there instead of falling back to the readable `.d.ts`. Maps stay on for local type-checking and docs; only the published artifact drops them.
  - **`emit()` is type-checked against each component's event map.** `LyraElement<Events>` now checks both the event name and the detail shape against the same map that types `addEventListener`, so a misspelled name or a detail that disagrees with the JSDoc, manifest and docs is a compile error rather than an event nobody listens for. This is a `protected` member, so it reaches consumers only through subclassing: a subclass that emits an event outside its base class's map must declare its own map. A component that declares no map keeps the permissive default.

## 7.8.1

### Patch Changes

- d699c7c: Stop letting a throwing `ShadowRoot.activeElement` getter escape a component. `ShadowRoot.activeElement`
  is not universally safe to read: under happy-dom 20.11.1 — the DOM a large share of consumers get by
  default from Vitest — that getter _itself_ throws `TypeError: Cannot read properties of undefined
(reading 'getRootNode')` whenever the document has no active element. Optional chaining was no
  defence, because `root?.activeElement` only guards `root` being nullish and the throw happens
  _inside_ the getter, after `?.` has already decided to proceed.

  Because these reads live in `willUpdate()` and in keydown handlers, the symptom was not a failed
  assertion but an _unhandled rejection_: one downstream suite reported 120 in a single run, all the
  same stack, from an `<lr-segmented>` re-rendering after its items changed. The suite still passed
  while the runner exited non-zero, and the stack pointed at library internals rather than anything
  the consumer wrote.

  Reported against `<lr-segmented>`, but a sweep found the same read at **every** focus-rehoming,
  roving-tabindex and focus-restoration site in the library — 30 modules across 11 families, including
  `<lr-tabs>`, `<lr-stepper>`, `<lr-table>`, `<lr-tree>`, `<lr-graph>`, `<lr-combobox>`'s siblings and
  the shared overlay manager. All of them now read through a new internal helper that returns `null`
  instead of throwing; `<lr-tree>`'s nested-shadow-root walk was the worst case, reading the raw
  getter in its _loop condition_ where a guard on the assignment alone would not have helped.

  Returning `null` is the honest answer: a DOM that cannot say what is focused is indistinguishable,
  for these call sites, from one where nothing is — and every one of them already handles that as the
  ordinary state, so the guard degrades to skipping focus restoration. Real browsers never take the
  catch, so behavior there is unchanged.

- 21b1051: Declare `flag-peer.js` in `package.json#sideEffects`, so `<lr-flag>` still resolves images in a
  production build. `sideEffects` is an explicit allowlist, and every entry in it was derived from a
  `*.class.ts` file's sibling registration module. `flag-peer.ts` has no `*.class.ts` of its own, so
  neither the generator nor the completeness check ever visited it and it shipped undeclared. It is a
  side-effect-only module — a consumer writes a bare `import '.../flag-peer.js'` and reads no export
  — so any bundler honoring `sideEffects` dropped it outright. `setFlagUrlResolver()` then never ran,
  `loadFlagUrlResolver()` cached `Promise.resolve(null)`, and every `<lr-flag>` given a
  `country`/`language` rendered the localized "flag unavailable" alert instead of an image. Silently:
  that null-resolver path logs nothing, and dev servers don't tree-shake, so it only ever appeared in
  a built artifact.

  Both scripts now derive `*-peer.ts` and `*-register.ts` modules, plus the per-family
  `components/<family>/index.ts` barrels, straight from the file tree rather than carrying them over
  from the previous `package.json` — so a rename or a family move can't strand an entry again. The
  completeness check fails on the missing `flag-peer` entries before the fix and passes after.

- 899543f: Centre content that a hit-area floor makes narrower than its own box, in `<lr-calendar>`,
  `<lr-citation-badge>`, `<lr-entity-chip>`, `<lr-rating>` and the `<lr-chart>` / box-plot legend
  items. These carry the same defect reported against `<lr-widget>`'s view toggle: a flex part with a
  `min-inline-size: var(--lr-icon-button-size)` floor (a WCAG 2.5.8 tappable-size requirement, not a
  layout intent) but no `justify-content`, so whenever the content is narrower than that floor the
  default `justify-content: normal` — resolving to `flex-start` — dumps every pixel of slack on the
  trailing side.

  `<lr-calendar>` was the most visible: its month-nav buttons hold a single chevron glyph and rendered
  **8.8px** off centre, sitting right next to a symmetric month title. `<lr-citation-badge>` left its
  one- or two-digit number hugging the badge's leading edge, and `<lr-entity-chip>` did the same to a
  short entity label inside an otherwise symmetric pill.

  Adding `justify-content: center` only changes rendering in precisely the buggy case: once content
  already fills or exceeds the floor there is no slack left to redistribute and the declaration is a
  no-op, so every component whose content was already wide enough renders exactly as before. The chart
  legends were checked for the overflow case specifically — long series names wrap rather than
  overflow, and both legends are wrapping horizontal rows, so per-item centring cannot make a column
  of items ragged.

  The sweep also cleared roughly ten other parts carrying the same floor where `flex-start` is
  correct — full-width header and list rows, whose content should start-align regardless.

  Rendered-geometry regression tests (measuring the glyph's centre against its button's) cover
  `<lr-widget>` and `<lr-calendar>`; both reproduce the offset without the fix, the widget one at the
  same 4.5px the report cited.

- 8a67993: Stop driving mask alpha from `--lr-color-shadow` in `<lr-segmented>`, `<lr-tabs>`, `<lr-stepper>`,
  `<lr-timeline>` and `<lr-document-preview>`. All five used `var(--lr-color-shadow)` for the
  _opaque_ stops of a `mask-image` gradient — 22 references across 12 declarations. A mask reads
  alpha only, but that token is a documented consumer theming input (`--lr-theme-color-shadow`) whose
  job is coloring shadows: setting it to something translucent such as `rgb(0 0 0 / 0.25)`, entirely
  reasonable for a shadow color, silently dropped the mask alpha across the _entire_ element rather
  than just its edges. Every affected component then rendered uniformly washed out — indistinguishable
  from a broken disabled state, with nothing pointing back at the shadow token as the cause. It worked
  only because that token's default happens to be opaque black.

  The opaque stops now use a new `--lr-mask-opaque`, declared in the internal tokens sheet.
  Deliberately **not** themeable and deliberately not a second alias of the shadow token: "opaque" is
  not a design decision a consumer tunes — a mask's opaque stop must be opaque by definition — so
  giving it its own `--lr-theme-*` hook would just reintroduce the same footgun under a new name.

  `<lr-document-preview>`'s determinate progress ring was the least obvious casualty: its mask punches
  the ring's centre out, so a translucent shadow theme faded the whole ring rather than cutting a hole
  in it.

  Regression-tested in all five components by rendering under `--lr-theme-color-shadow: rgb(0 0 0 /
0.25)` and asserting the resolved computed mask, which reproduces `rgba(0, 0, 0, 0.25)` at the
  opaque stops without the fix.

- 8a67993: Paint the horizontal edge fade only while the track actually overflows, in `<lr-segmented>`,
  `<lr-tabs>`, `<lr-stepper>`, and `<lr-timeline>`. All four applied their `--lr-scroll-fade-size`
  `mask-image` unconditionally, described in-code as an intentionally static, observer-free
  affordance. That is only harmless when there _is_ overflow. On a track that fits, the fade is pure
  damage: at the `2rem`-per-edge default a two-option `<lr-segmented>` (`Overall | Daily`) is
  narrower than its own two fades, so both labels rendered half-transparent and the control read as
  permanently disabled; a short `<lr-tabs>` row dimmed its first and last tab for no reason.

  A new internal `ScrollOverflowController` measures `scrollWidth` vs `clientWidth` and toggles a
  `data-scroll-overflow` attribute on the track (inside the shadow root — not consumer-visible DOM),
  which now gates each mask rule. It re-measures from two sources, because they catch different
  changes: a `ResizeObserver` on the track for container resizes, and the host's own update cycle for
  content changes, which need not alter the track's border box at all. Overflowing tracks keep
  exactly their previous rendering.

  Note for anyone spying on `ResizeObserver` construction: `<lr-stepper>` now arms one of its own
  regardless of the `orientationBreakpoint` feature.

- 899543f: Center the glyph in an icon-only `<lr-widget>` view toggle. `[part="view-toggle"]` set
  `align-items: center` but no `justify-content`, unlike the sibling `collapse-button` /
  `fullscreen-button` rules, which set both. `min-inline-size` floors the pill at the square
  icon-button size, so a 13px glyph inside a 40px pill has slack that the default
  `justify-content: normal` (→ `flex-start`) dumps entirely on the trailing side — measured 4.5px off
  true center once the asymmetric inline padding is counted, and plainly visible as an off-center
  icon in a round toggle. A labeled toggle was never affected: its content already fills a pill that
  sizes to fit.

## 7.8.0

### Minor Changes

- 2c3934b: `<lr-embedding-explorer>`'s `height` property now actually sizes the plot. It was rendered as an
  SVG `height` presentation attribute while the component's own stylesheet declared
  `[part='plot'] { block-size: auto }` — and any stylesheet declaration outranks a presentation
  attribute, so the property was inert at every value, including its documented `360px` default: the
  plot always sized itself from the `viewBox` aspect ratio instead.

  `height` is now published on the host as the new `--lr-embedding-explorer-height` custom property,
  which `[part='plot']`'s `block-size` reads. Consequences worth knowing before upgrading:

  - The default `height="360px"` now takes effect, so a plot wider than 640px is no longer as tall as
    its allocation implies. Set `height="auto"` to keep the previous aspect-ratio-preserved sizing.
  - A value the browser cannot parse as a `block-size` is dropped rather than applied, leaving the
    `auto` behavior instead of collapsing the plot.
  - A consumer's own `::part(plot) { block-size: ... }` rule still overrides `height`, and the
    narrow-allocation `min-block-size` floor still raises it.

- 2c3934b: `<lr-memory-panel>` no longer strands keyboard focus when a row action opens its confirmation step.
  Activating "Add to long-term memory", "Remove", or "Forget all" destroys the button that had focus,
  and nothing moved focus into the `lr-confirm-bar` that replaces it, so focus fell back to `<body>`:
  a keyboard user was dumped at the top of the page with nothing announced, and had to re-tab through
  the whole document to reach the confirmation they had just opened. Focus now moves into the
  confirmation (its Deny control -- the safe action -- falling back to the bar's status element), and
  is handed back to the row (or to the "Forget all" control) once the decision resolves. Pressing
  Escape while the confirmation holds focus now cancels it exactly like pressing Deny: no event is
  emitted, focus returns the same way, and the key does not propagate past the panel.
- 2c3934b: `<lr-notebook-viewer>`: `searchNext()` and `searchPrevious()` now resolve `true` when the active
  match moved and `false` when there was nothing to move to, matching the shared viewer search
  contract (`LyraTextViewerTarget`) that every other searchable viewer already honors. They
  previously returned nothing, so a find-in-page host driving several viewers polymorphically —
  `if (await viewer.searchNext()) { ... }`, or awaiting the call before reading its own match
  counter — got `undefined` from the notebook viewer alone and took its falsy "no more matches"
  branch on every press, even mid-notebook.

  This is an additive widening: the methods return a resolved promise instead of nothing, and callers
  that ignored the return value are unaffected. `search()` already resolved the match count and is
  unchanged.

- 80e0ef1: Repair four regressions left by earlier fixes:

  - `<lr-radio-group>`: arrow-key selection now emits `input` and `change` alongside `lr-change`, as
    click and Space already did and as native `<input type=radio>` does. The earlier fix for a
    duplicate `lr-change` had left the keyboard path emitting only the group event, so a consumer
    bound to the native-mirroring events silently missed every keyboard selection.
  - `<lr-progress-ring>`: an unslotted ring is named from the localized fallback again. Its slot's
    fallback content is the formatted percent, and `assignedNodes({flatten:true})` returns fallback
    children when nothing is assigned, so the control had been naming itself "40%" and no
    `registerLyraLocale()` override could reach it.
  - `<lr-tour>`: opening a detached tour no longer locks scroll on the document or installs a global
    Escape handler with nothing visible, matching the guard `<lr-dialog>` already had.
  - `text-quote` anchors and highlights now case-fold with the component's locale in
    `<lr-docx-viewer>`, `<lr-pdf-viewer>`, `<lr-markdown>` and `<lr-markdown-core>`. Under `lang="tr"`
    a quote of "istanbul" silently failed to match "İSTANBUL" in these four while resolving correctly
    in every viewer built on the shared text-viewer mixin.

- d8a026d: Give `<lr-table>`'s sorted column header an opaque default fill. The header is `position: sticky`
  and the sorted-state rule defaulted to `transparent`, so in any height-capped table the body rows
  scrolled visibly through the sorted column's header cell.

  Give `<lr-pdf-viewer>`'s toolbar buttons a hover fill that differs from the toolbar behind them —
  the rule existed but resolved to the toolbar's own opaque token, so hovering produced no visual
  change at all. Retunable via the new `--lr-pdf-viewer-toolbar-button-hover-bg`.

  Correct three `<lr-chat-message>` snippets in the authored reference that used `role="user"`. The
  property reflects to `data-role`, so `role` was never observed: consumers copying those examples
  got a message rendered as the default `assistant`, plus an invalid ARIA role token in the DOM.

- 2c3934b: `<lr-xml-viewer>`, `<lr-av-player>`, and `<lr-terminal>` now resolve a boolean from `searchNext()`
  and `searchPrevious()`, matching the shared `LyraTextViewerTarget` search contract that
  `search()` already followed on all three. They returned `void`, so a host driving several
  searchable components through that one typed surface — `if (await viewer.searchNext())` — read
  `undefined` and took the "nothing to move to" branch on every press.

### Patch Changes

- ed7f463: Stop retaining one live `Range` per search match in every text viewer. `<lr-archive-viewer>`,
  `<lr-calendar-viewer>`, `<lr-contact-viewer>`, `<lr-email-viewer>`, `<lr-geojson-view>`,
  `<lr-html-viewer>`, `<lr-include>`, and `<lr-pptx-viewer>` share a search mixin that held a live
  `Range` for every match. The engine revalidates each retained `Range` on every DOM mutation in its
  document, so a short query over a long document made every later mutation dramatically slower.
  Matches are now kept as inert offsets, and only a bounded window around the active match is
  materialized and painted. `matchCount`, `searchNext()`, and `searchPrevious()` still cover every
  match.
- 2d149dc: `<lr-dashboard-grid>` no longer starts a cell drag when the pointer lands on a button, link, or
  input inside the cell. The guard compared a slotted light-DOM control against a shadow-root wrapper
  with `contains()`, which never crosses the slot boundary, so it could never fire and every control
  click inside a draggable cell dragged the cell instead of activating the control.

  `<lr-tree>` no longer throws on the first arrow key when a `<lr-tree-node>` is written declaratively
  into its documented slot. `item` is `attribute: false`, so such a node has none until a host assigns
  one, and the keyboard handler read `item.id` unguarded.

- 9083c9b: `<lr-document-library>` now sorts its Updated column chronologically. It ordered rows correctly by
  timestamp itself, then handed the composed `<lr-table>` both those rows and a `sortKey` without
  `sort-mode="server"`, so the table sorted them a second time in client mode — from the column's
  rendered output, which is a _formatted_ date. The result was alphabetical by month name.
- 2c3934b: `<lr-env-list>` no longer paints its screen-reader-only "Value hidden" announcement as visible text
  beside the mask. The template emitted `class="sr-only"` but the component never adopted the shared
  stylesheet that defines that class, and no rule in `LyraElement.styles` supplies it.
- 2c3934b: Hide the anchor-announcement live region in `<lr-include>` and `<lr-pptx-viewer>`.

  Both viewers render the shared anchor-target mixin's `role="status"` live region, which the mixin
  marks up with `class="sr-only"`, but neither component's shadow stylesheet defined that class. The
  region therefore laid out as an ordinary block, so the first anchor jump (or a failed one) painted
  its localized announcement — "Jumped to highlighted passage." / "Passage not found in this
  document." — as visible body text: beside the transcluded fragment for `<lr-include>`, and as an
  extra row under the fidelity notice for `<lr-pptx-viewer>`. The announcement is now visually hidden
  and screen-reader-only, matching every other viewer that adopts the same mixin.

- 0e2dbf3: `LyraElement`'s internal `scheduleAfterUpdate()` now coalesces per key instead of collapsing every
  caller in an update cycle onto one slot. It tracked pending work in a single boolean, so the second
  caller in a cycle early-returned and its callback was dropped and never replayed — a component that
  scheduled two genuinely different pieces of after-update work silently lost one of them. Repeated
  schedules under the same key still collapse to one run, so the load path keeps producing one fetch
  per cycle rather than one per property write.
- 2cd5fb5: `<lr-artifact-panel>`, `<lr-commit-card>`, `<lr-heatmap>`, `<lr-query-builder>`, `<lr-tree>`, and
  `<lr-word-cloud>` now format the numbers they interpolate into localized strings with the effective
  locale. `localize()` substitutes values with a bare `String(value)` and does no number formatting,
  so these rendered Western digits inside otherwise fully-translated sentences — under a locale using
  its own numbering system (`ar-u-nu-arab`, `hi-u-nu-deva`, …) a single announcement mixed two digit
  sets.

  `<lr-attachment-chip>` also no longer falls back to an empty `src` on its thumbnail `<img>`; an
  empty `src` is a valid URL that resolves against the document, so it would make the browser
  re-request the page as an image.

- df4dac8: Reject non-integer index segments in anchor resolution. A range-only guard (`i < 0 || i >= len`)
  does not reject `NaN` (both comparisons are false) or a fractional index, so `<lr-xml-viewer>`
  reported `lr-anchor-result { found: true }` and announced "Jumped to…" for a `node-path` that
  matched nothing, and a non-trailing bad segment threw — rejecting `scrollToAnchor()` so
  `lr-anchor-result` never fired at all, and surfacing as an unhandled rejection on the declarative
  `anchor` path. `<lr-notebook-viewer>` had the same false-positive shape, and
  `<lr-virtual-list>.scrollToIndex(NaN)` silently scrolled the list to the top.

  `DocumentAnchorTarget` now also degrades a throwing `applyAnchor()` to "not resolved" instead of
  letting it reject, so the mixin keeps its documented promise of always reporting a definite result.

- c76ebf8: Fix `<lr-mcp-app>`'s remote `src` mode, which never loaded: binding `srcdoc` to an empty string
  still produced a _present_ `srcdoc=""` attribute, and the HTML spec's iframe processing branches on
  that attribute's presence, so the frame navigated to `about:srcdoc` and ignored `src` entirely
  (while still firing `lr-mcp-ready`). The same empty-string-vs-absent shape is fixed in
  `<lr-av-player>` (a bare player painted a "Failed to load the media" alert before a `src` was set)
  and `<lr-zoomable-frame>` (a rejected `src` rendered a broken-image glyph).

  Validate consumer-supplied CSS lengths before they reach an inline style declaration list, so a
  crafted value can no longer inject extra declarations: `<lr-stack-trace>`'s `max-height`,
  `<lr-code-block>`/`<lr-code-block-core>`'s `max-height`, `<lr-table>`'s column
  `width`/`minWidth`/`maxWidth`, and `<lr-browser-frame>`'s agent-supplied ping coordinates (which are
  now also clamped to the documented 0-100 range instead of serializing `NaN`).

- ed7f463: `<lr-virtual-list>` no longer rescans the whole `items` array on every scroll frame to resolve
  `active-id`. The lookup is now memoized on the `items`/`active-id`/`keyFunction` identities, so
  scrolling a large list stops calling `keyFunction` once per item per frame.

## 7.7.0

### Minor Changes

- 3ccd0ed: Improve component accessibility, localization, responsive behavior, interaction cleanup, and
  remote-content safety across the library. Add the new documented component APIs and strengthen
  event, packaging, and public-contract validation.

### Patch Changes

- 7bcac52: Raise the optional `pdfjs-dist` peer range to `^6.2.108` (from `^6.1.200`), alongside routine
  development-dependency upgrades. Only consumers of `<lr-pdf-viewer>` are affected, and only if they
  pin `pdfjs-dist` below `6.2.108`.

## 7.6.0

### Minor Changes

- b91bd2c: Add `type: 'custom'` filters to `lr-filter-bar`, letting a filter definition supply its own renderer and value adapter so any existing Lyra control (`lr-checkbox`, `lr-time-range`, an async `lr-combobox`, ...) can participate in the same controlled `value`, active-chip, reset, disabled, and validation contract as the built-in filter types.

## 7.5.0

### Minor Changes

- 33352e4: Add readonly support to `lr-textarea`, themeable `lr-thread-list` excerpt highlights, durable virtual-row stacking for open action menus, and cross-browser adjacent-row keyboard navigation.

## 7.4.0

### Minor Changes

- 3e6ab4c: Add public surface, accessibility, i18n, and documentation improvements across
  the library. No breaking change — every item below is additive, and every new custom property is an
  inline `var()` fallback carrying today's value, so rendering is unchanged when it is left unset.

  New public API:

  - `<lr-svg-viewer>` adopts the shared `DocumentAnchorTarget` contract: it gains the reactive `anchor`
    property alongside the existing `highlights`/`activeHighlightId`, a retrying
    `scrollToAnchor(target): Promise<boolean>`, the `anchor-live-region` part, and the
    `lr-anchor-result` event (`detail: { found: boolean }`). Its registry entry declares
    `capabilities: { anchors: ['region'], search: false, textSelect: false }`, so opening an SVG
    through `<lr-document-viewer>` no longer drops deep-link anchors and highlights. The same
    registry wiring and `capabilities` declaration was added for `<lr-html-viewer>`,
    `<lr-pptx-viewer>` and `<lr-archive-viewer>`.
  - `<lr-table>`'s `lr-column-resize` becomes cancelable **at the commit only**: a pointer drag still
    streams non-cancelable per-pixel feedback, then fires exactly one `{ cancelable: true }` event for
    the width committed at drag-end, and a keyboard step (Arrow/Shift+Arrow/Home/End) fires that single
    cancelable commit directly. `preventDefault()` reverts the column to its pre-gesture width.
  - `<lr-pdf-viewer>` gains the `previous-button`, `next-button`, `zoom-out-button` and
    `zoom-in-button` CSS parts, so the toolbar controls are reachable from a consumer stylesheet (a
    descendant combinator after `::part()` never matched).
  - `<lr-tool-param-form>` gains the `control` CSS part on its `string`/`number`/`integer` native
    inputs.
  - `<lr-commit-card>` gains the `file-status` CSS part: the one-letter git-status badge now carries a
    localized expansion as its accessible name, reusing `<lr-file-tree>`'s shared `gitStatus*` message
    keys.

  New component-scoped custom properties, each defaulting to the value its rule already used:
  `--lr-chart-canvas-hover-outline-width`, `--lr-chip-group-overflow-expanded-color`,
  `--lr-confirm-bar-approved-color`, `--lr-confirm-bar-denied-color`, `--lr-date-picker-nav-hover-bg`,
  `--lr-knowledge-base-admin-tab-selected-border`, `--lr-knowledge-base-admin-tab-selected-color`,
  `--lr-pagination-invalid-border`, `--lr-radio-checked-border-color`, `--lr-radio-checked-dot-color`,
  `--lr-result-card-compact-header-gap`, `--lr-result-card-compact-body-gap`,
  `--lr-schema-viewer-info-border`, `--lr-schema-viewer-info-bg`, `--lr-split-divider-hit-slop`,
  `--lr-task-list-compact-header-gap`, `--lr-widget-view-toggle-hover-bg`,
  `--lr-widget-view-toggle-hover-color`. `--lr-tree-selected-bg`/`--lr-tree-selected-color` were
  already honored by the stylesheet and are now declared, so editor tooling and the manifest see them.

  New `DEFAULT_STRINGS` message keys (additive; the English defaults match what shipped before, except
  `flagLoadError`, which previously rendered its own key name):

  - `emojiPickerGroupSmileysEmotion`, `emojiPickerGroupPeopleBody`, `emojiPickerGroupComponent`,
    `emojiPickerGroupAnimalsNature`, `emojiPickerGroupFoodDrink`, `emojiPickerGroupTravelPlaces`,
    `emojiPickerGroupActivities`, `emojiPickerGroupObjects`, `emojiPickerGroupSymbols`,
    `emojiPickerGroupFlags` — `<lr-emoji-picker>`'s auto-loaded group headings now follow
    `registerLyraLocale()`. `EmojiPickerGroup` gains an optional `labelKey`, set only by the built-in
    `emoji-picker-element-data` adapter; a consumer-supplied group is still rendered verbatim.
  - `flagLoadError` — `<lr-flag>`'s fail-closed alert had no default entry, so it rendered the literal
    string `flagLoadError` unless a locale was registered.

  Accessibility, correctness and lifecycle fixes:

  - Container components no longer leak an internal child's composed event past their own host under
    an undocumented name (`lr-activity-feed`, `lr-document-library`, `lr-filter-bar`,
    `lr-claim-evidence`, `lr-knowledge-graph-explorer`, `lr-message-feedback`).
  - A host `aria-label` now wins over the computed internal name on `<lr-document-viewer>` and
    `<lr-flow-canvas>`.
  - `<lr-split>`'s divider and `<lr-image-viewer>`'s fit/rotate/annotate controls meet the shared
    minimum hit-area floor on both axes.
  - `<lr-slider>`, `<lr-time-range>` and `<lr-swatch-picker>` forward host `focus()`/`blur()`/`click()`
    to their real internal control; `<lr-prompt-studio>` bridges its native `focus`/`blur` to the host
    and pairs its role select with a visible chevron affordance.
  - `<lr-subagent-panel>` implements the full roving-tabindex tree keyboard model
    (ArrowUp/ArrowDown/Home/End) its `role="tree"` already advertised.
  - `<lr-compare-panel>` no longer clobbers a new pair's vote when a listener re-entrantly changes
    `itemId`; `<lr-approval-queue>` marks the selected row with `aria-current`; `<lr-schema-viewer>`
    renders `info`-severity issues distinctly from `error`; `<lr-heatmap>` drops a focused cell that a
    `values` refresh made non-interactive; `<lr-test-results>` and `<lr-notebook-viewer>` key their
    expand state by stable identity instead of position; `<lr-box-plot>` preserves legend-toggled
    visibility across a redraw; `<lr-selection-toolbar>` re-arms positioning after a reconnect;
    `<lr-graph>`'s canvas renderer draws the expand badges and honors `--lr-graph-hull-opacity`;
    `<lr-diff-view>` locks code content to LTR under an RTL ancestor.
  - `<lr-chart>` redraws on a live `dir`/`lang` change, and its zoom-plugin loader reads
    `mod.default ?? mod`.
  - `<lr-voice-picker>` no longer throws when constructed in a DOM without `attachInternals()`; that
    guard now shares one implementation with the `FormAssociated` mixin and also covers an
    `attachInternals()` that throws.
  - `<lr-locale-picker>`, `<lr-flag>` and `<lr-chart>` call `super.willUpdate()`/`super.updated()`.
  - `<lr-button-group>` no longer collapses to zero width when it has no definite inline size.

  Documentation: corrected the drifted default values, anchor kinds, sanitizer, ARIA model and
  object-URL lifecycle claims across `llms/`, switched every copy-paste helper example from the root
  barrel to its side-effect-free granular subpath, and documented all of the surface above.

## 7.3.0

### Minor Changes

- 2cff771: Add the opt-in `wrap-labels` property to `<lr-stepper>` for wrapping long labels on the vertical axis.

## 7.2.0

### Minor Changes

- 9670255: Add accessible-table totals and a knowledge-graph selection event:

  - `<lr-chart>`: `stackTotals` now also feeds the generated accessible data table with a per-axis
    total column (localized `chartTotal`/`chartAxisTotal` header), and only activates when `stacked`
    is set (previously it could draw totals on unstacked bar/line charts). `valueFormatter` gains a
    `'table'` context so callers can format the new total cells and existing value cells consistently.
  - `<lr-lite-chart>`: new `tableCellFormatter` property formats the built-in multi-series accessible
    table's numeric cells (including its new opt-in `tableTotals` total column for stacked bar
    charts), via the new `LyraLiteChartTableCellFormatter`/`LyraLiteChartTableCellContext`/
    `LyraLiteChartTableCellKind` types.
  - `<lr-knowledge-graph-explorer>`: emits a new `lr-selection-change` event whenever its
    self-managed `selectedNodeId` changes from search, graph, neighbor, path, entity-card,
    invalidation, or popover-close interactions (direct host assignment stays silent).

## 7.1.0

### Minor Changes

- bf9ac61: Resolve public integration gaps:

  - add the side-effect-free `@aceshooting/lyra-ui/localization.js` runtime entry;
  - add `--lr-icon-button-border-hover`, falling back to the base border;
  - document and test the reflected `ariaControlsElements` contract for menu triggers;
  - make popover/dropdown `aria-controls` target their public host so native and Lyra triggers can
    resolve it;
  - make tooltip and checkbox descriptions resolvable across their trigger/control shadow
    boundaries; and
  - accept MapLibre GL JS v5 or v6, with version-specific worker guidance.

## 7.0.0

### Major Changes

- fb14fa1: Make the approved breaking contract corrections for the next major release.

  - `<lr-checkbox-group>` now consumes each child's native-style events and emits exactly one
    group-owned `input`, `change`, and `lr-change` sequence with `{ value: string[] }`. It also scopes
    selection to checkboxes owned by that group and silently resynchronizes its value and form data
    after programmatic child changes. Consumers that listened for leaked child events on the group
    must instead listen on the child checkbox itself.
  - `<lr-diff-view>` now defaults `maxLines` to `5000` and renders a localized fallback above that
    ceiling. Set `maxLines` to `Infinity` to preserve uncapped behavior; the line diff now uses a
    linear-space algorithm, but exceptionally large diffs can still be expensive.
  - `<lr-popover>` now returns focus to its trigger consistently after light dismiss and
    programmatic close, matching its Escape behavior. Use `hide({ focusTrigger: false })` when a
    programmatic close must leave focus elsewhere.
  - Remove the never-emitted `lr-highlight-activate` event declarations from `<lr-code-block>`,
    `<lr-code-block-core>`, and `<lr-notebook-viewer>`. Listen to the viewer's documented anchor and
    text-selection events instead.
  - `<lr-stepper>` now exposes list/progress-navigation semantics with
    `aria-current="step"` instead of incomplete tab semantics without associated tab panels.
    Selected-step state and keyboard activation remain available.
  - Toggleable `<lr-chip>` instances now put their toggle semantics on a separate native control;
    default-slot content is an inert label rather than an unrestricted interactive subtree. Move
    links and buttons outside a toggleable chip.

### Minor Changes

- fb14fa1: Expand the public component contracts needed by advanced consumers.

  - Export the document-viewer anchor, highlight, search, selection, and target types through the
    owning granular component entry, with type tests covering those imports.
  - Complete native-style `input`/`change`, focus, selection, and editing contracts across the
    affected form and conversation controls, including emoji picker and token input.
  - Add the documented viewer navigation, search, highlight, comparison, preview, and theme hooks,
    plus the corresponding component parts and custom properties.
  - Complete the typed agent-evaluation, evaluation-dataset, retrieval, and data-view surfaces that
    previously required consumers to infer internal shapes.

- 19022c7: Resolve the current feature-request backlog:

  - add configurable no-flash theme bootstraps and a Lit-free gemstone palette entry;
  - expose a pre-mount chart `seriesPalette()` helper and document its theme-token indirection;
  - let `lr-app-rail` select persisted fields, including `preferredMode`, without restoring transient
    mobile-open state;
  - add `lr-icon-button` border and hover-foreground tokens;
  - size gemstone swatches from their fill token and keep `lr-table`'s unnamed-grid warning out of
    production; and
  - document the supported SheetJS CDN install path and the unsafe npm-audit downgrade suggestion.

### Patch Changes

- fb14fa1: Correct accessibility, localization, lifecycle, security, responsive-layout, and rendering defects
  across the component families.

  - Reconcile accessible names, stateful ARIA, roving focus, focus return, wrapped-child event
    suppression, live regions, disabled behavior, and native control forwarding.
  - Make inherited locale and direction reactive through composed trees, use locale-aware text
    folding and sparse highlight offsets, and localize the remaining viewer and status messages.
  - Harden remote viewer loading, sanitization, generation ownership, size/resource guards, and
    reconnect behavior while preserving empty and error states.
  - Fix container-responsive layouts, hover/focus parity, reduced-motion behavior, theme-token
    resolution, and viewer allocation/geometry updates.
  - Avoid quadratic DOM walks when painting capped DOCX search matches.

## 6.2.0

### Minor Changes

- 7af01bf: Add `href`, `target`, and `download` to `<lr-button>`, giving it a real `<a>` anchor mode instead of
  a `<button>` that a consumer has to wrap or intercept.

  `rel` is derived from `target` rather than being independently settable, so a `target="_blank"`
  button cannot ship without `rel="noopener noreferrer"`. Hrefs are validated through the internal
  link allowlist; a `download` paired with a `mailto:` href falls back to the native `<button>`, since
  `mailto:` names no retrievable bytes.

- 7af01bf: Round out the chart components so app code stops reaching into raw `config` passthrough.

  - `data-labels` and `stack-totals` boolean attributes on `<lr-chart>` and its subclasses render
    value and stacked-total labels using themed tick colors and `--lr-font-*`, replacing hand-rolled
    `afterDatasetsDraw` painters with hardcoded colors. These require the new optional peer
    `chartjs-plugin-datalabels` (see the separate peer-dependency note); the plugin registers
    per chart instance, never globally.
  - `Series.pointRadius` accepts an array for per-point sizing, and `Series.segmentColors` maps to
    Chart.js segment coloring.
  - `seriesPalette()` is now public, so app code can read the resolved, dark-aware chart ramp instead
    of re-resolving `--lr-theme-color-chart-N` through `getComputedStyle` itself.
  - Charts re-theme automatically via a shared `ThemeWatcher` controller when the ambient theme
    changes.
  - `<lr-lite-chart>` renders a real `<table part="data-table">` screen-reader alternative when there
    is more than one series; the previous flat `<ul>` degenerated for multi-series data.

- 7af01bf: Add `chartjs-plugin-datalabels` (`^2.2.0`) as a new **optional** peer dependency, backing the new
  `data-labels`/`stack-totals` chart attributes.

  It is optional in the same sense as the other chart peers: install it only if you use those two
  attributes. Without it, charts render exactly as before and the label layer fails closed rather than
  throwing.

- 8e0540a: Add five agentic AI / RAG roadmap components: `lr-agent-eval-dashboard`, `lr-approval-queue`, `lr-embedding-explorer`, `lr-knowledge-base-admin`, and `lr-rag-answer`.
- 7af01bf: Fill several gaps in the form-control surface that were pushing logic onto consumers.

  - `<lr-input>` and `<lr-textarea>` gain `minlength`/`maxlength` constraints wired into the validity
    bridge, so length violations participate in constraint validation instead of being advisory.
    Length is counted in code points, so astral characters count as one.
  - `<lr-select>` and `<lr-combobox>` now emit value-carrying `lr-change` events, and their `input`/
    `change` events carry a typed detail — no more `as unknown as { value }` at every call site.
  - `<lr-card>` gains `target` for anchor-mode cards, with `rel="noopener noreferrer"` derived from it
    rather than settable on its own.
  - `<lr-combobox>` accepts an `AbortSignal` for `source` and a configurable `source-delay`
    (default 200ms), so a fast typist no longer races stale in-flight results.

- 7af01bf: Assorted layout and accessibility improvements.

  - `<lr-split>`'s `defaultSizes` accepts CSS length strings (`['200px', 50]`) alongside percentages,
    resolved against the measured container and renormalized — a fixed-width sidebar no longer needs a
    `firstUpdated()` measure-and-convert dance.
  - `<lr-table>` gains typed `accessible-label`/`caption` properties and warns in development when a
    grid ships with no accessible name.
  - `<lr-popover>` gains `hide({ focusTrigger })` for explicit focus return on programmatic close.
  - `<lr-segmented>` auto-reveals the selection when `value` is set programmatically, and exposes
    `scrollToValue()`.
  - `<lr-heatmap>` warns when no 2D canvas context is available instead of silently rendering nothing.
  - `<lr-file-input>` shows visible, localized rejection feedback per reason, replacing the sr-only
    count-only message.
  - `<lr-tool-result-view>` renderers can signal failure via a reflected `status`.
  - `gemstoneGlyph()` defaults its fill to `currentColor` and carries an intrinsic `1em` box.

- ad9165a: Add `mode="gemstone"` to `<lr-swatch-picker>`, shared gemstone accent data and glyph helpers, and
  apply the selected shine animation to custom icon swatches as well as plain color fills.
- 7af01bf: Add opt-in `storage-key` persistence to `<lr-table>`, `<lr-widget>`, and `<lr-app-rail>`, so layout
  state survives a reload without every application rebuilding the same `localStorage` plumbing.

  Set `storage-key` to persist `<lr-table>`'s `showAllColumns`, `<lr-widget>`'s `collapsed` state, and
  `<lr-app-rail>`'s open state and width. The attribute is unset by default — behavior without it is
  unchanged. All three share one internal helper with the `try`/`catch` handling needed for
  environments where `localStorage` throws (private mode, disabled storage, cross-origin frames).

- 7af01bf: Add theming tokens for surfaces that previously forced consumers through `::part()` overrides.

  - `<lr-icon-button>`: `--lr-icon-button-background`, `--lr-icon-button-background-hover`, and
    `--lr-icon-button-color`, so a bordered or tinted icon button no longer needs `::part(button)`.
  - `<lr-button>`: `--lr-button-shadow` (default `none`) for themed elevation.
  - `<lr-table>`: sorted-header theming tokens, plus a specificity fix so consumer `::part()` rules can
    actually win against the internal sort-state rule.
  - `<lr-select>` and `<lr-model-select>`: selected-state tokens; `<lr-combobox>` gains the matching
    `option-selected` token indirection.
  - `<lr-empty>`: `--lr-empty-compact-font-size` for compact heading typography.
  - `<lr-typing-indicator>`: `--lr-typing-duration`, so its speed is no longer keyed off the shared
    `--lr-transition-ambient`.
  - `<lr-conversation-item>`: tokenized active-row indicator part.

  Every token's `var()` fallback is the value it replaces, so unset rendering is unchanged.

- 7af01bf: Add `@aceshooting/lyra-ui/theme.js` — a zero-dependency theme runtime and no-flash bootstrap, so
  applications stop rebuilding mode/accent persistence by hand.

  The new subpath exports `setLyraTheme(theme)`, `getLyraTheme()`, the `LyraTheme`/`LyraThemeMode`
  (`'light' | 'dark' | 'auto'`) types, and `lyraThemeBootstrap` — a string of head-script source you
  inline before first paint to apply the persisted theme without a flash of the wrong mode. Theme
  changes persist to `localStorage` and announce themselves with an `lr-theme-change` event.

  The runtime deliberately does not include WCAG contrast math: deriving an accessible palette from a
  single brand color is application product logic, not a library concern.

### Patch Changes

- 7af01bf: Fix several rendering and correctness bugs.

  - `<lr-chart>`: a `valueFormatter` no longer corrupts the **category** axis. Formatted indices
    (`"0"`, `"1"`, `"2"`) were rendering in place of the category labels, because the tick callback was
    wired to every axis rather than only the value axes.
  - `<lr-diff-view>`: normalize CRLF and lone-CR line endings, so a Windows-authored file no longer
    diffs as entirely changed.
  - `<lr-app-rail>`: anchor the resizer to `:host`, pin `overflow-x`, and free fixed-position popups
    that were being clipped by the rail.
  - `<lr-button>`: collapse empty start/end adornment wrappers, which were reserving visible space for
    slots with nothing in them.
  - `<lr-swatch-picker>`: keep the selected glow on gemstone swatches.

- a656a10: Add a tokenized active-row indicator part to `lr-conversation-item` and export it through data-mode `lr-thread-list` rows.
- 203cbce: Forward host `aria-describedby` values to `lr-checkbox`'s internal checkbox role.
- 983dd04: Validate download anchors against a stricter URL allowlist than navigation anchors. A `mailto:` URL
  is a legitimate navigation destination but names no retrievable bytes, so pairing it with a
  `download` attribute produced an affordance that could never download anything.

  `safeDownloadHref()` (internal) is now `safeLinkHref()` minus `mailto:`, and the download sinks use
  it: `<lr-document-viewer>` and `<lr-document-preview>` omit their download link for a `mailto:`
  `src`, `<lr-media-card>` falls back to its inert file chip, and `<lr-button>` falls back to the
  native `<button>` when `download` is set alongside a `mailto:` `href` (a `mailto:` href _without_
  `download` still renders the anchor, unchanged).

  Behavior change: the `safeLinkHref()` re-exported from the package root is `<lr-media-card>`'s
  download-sink wrapper, so it now returns `null` for `mailto:` where it previously returned the URL.
  The general-purpose navigation validator is unchanged.

- 88dfe78: Add `LyraTreeEventMap` so `<lr-tree>`'s `lr-node-toggle`, `lr-node-select`, and `lr-reorder` events are typed on listeners (`addEventListener`), matching every other component with public events.
- a595ec7: Give `<lr-widget>`'s collapse-button `aria-label` its own dedicated locale keys,
  `widgetCollapse`/`widgetExpand`, instead of borrowing `<lr-dock-panel>`'s `dockPanelCollapse`/
  `dockPanelExpand`. Default English strings are unchanged ("Collapse panel"/"Expand panel"). If you
  had registered a locale under the old borrowed `dockPanel*` keys specifically to translate
  `<lr-widget>`'s collapse button, move that override to `widgetCollapse`/`widgetExpand` —
  `<lr-dock-panel>`'s own keys and behavior are unaffected.

## 6.1.0

### Minor Changes

- f9e1e18: Make `lr-app-rail`'s `lr-toggle` event cancelable: a listener calling `preventDefault()` keeps the
  rail open/closed as it was. The one exception is the forced close that fires when `mode` leaves
  `'mobile'` while open, which stays unconditional since it's a consistency fix-up rather than a
  user dismissal.
- f9e1e18: Add themeable `--*-gap`/`--*-radius` CSS custom properties to `lr-input`, `lr-select`, and
  `lr-combobox` (gap + radius), `lr-chip`/`lr-badge`/`lr-tag` (radius), and `lr-icon-button`
  (radius) — extending the pattern `lr-button` already shipped, so these values can be retuned
  without a `::part()` override. Every default is unchanged.
- f6d966e: Add an optional `country` field to `lr-locale-picker`'s `locales` catalog entries, letting a
  consumer override a row's derived flag (e.g. showing Lebanon's flag for an `ar` row instead of
  the library's default Saudi Arabia mapping).
- 3c9f478: Make `lr-reorder-list`'s `lr-reorder` event cancelable: a listener calling `preventDefault()`
  holds the move (reflecting `pending` on the affected `lr-reorder-item`) until the host calls the
  new `finalizePendingMove()`/`revertPendingMove()` methods — mirroring `lr-confirm-bar`'s cancelable
  approve/deny pattern, for hosts that persist the new order asynchronously.
- f9e1e18: Make `lr-token-input`'s `lr-remove` event cancelable: a listener calling `preventDefault()` (for
  example to run async removal validation, or to protect a token) keeps the token in place instead
  of it being removed unconditionally. Scoped to direct removal; multi-candidate paste/edit flows
  are unaffected.

### Patch Changes

- a4c4825: Fix `lr-agent-workspace` never emitting its documented `lr-retrieval-select` event when a row is
  selected in the built-in retrieval results, and leaking the internal `lr-retrieval-results`'s raw
  `lr-select` event through under the wrong name instead.
- f9e1e18: Fix `lr-date-input`'s `selectionDirection` getter returning `undefined` instead of `null` before
  the internal input has rendered, despite its declared `LyraDateInputSelectionDirection | null`
  return type.
- 2dabe8e: Fix `lr-icon-button`'s bare-SVG-geometry fallback rendering slotted stroke-style icon path data
  (no fill/stroke of its own) as a solid black shape instead of an outline, by giving
  `[part="fallback"]` the same `fill`/`stroke`/`stroke-width`/`stroke-linecap`/`stroke-linejoin`
  defaults `lr-icon`'s own wrapper svg already has.
- f9e1e18: Fix `lr-retrieval-results` and `lr-menu` leaking a wrapped child's own event under the wrong
  name alongside the documented, consolidated one: `lr-retrieval-results` leaked `lr-virtual-list`'s
  `lr-load-more` and `lr-chunk-inspector`'s `lr-chunk-open` (the latter also carrying an
  undocumented extra `anchor` field); `lr-menu` leaked `lr-menu-item`'s raw `lr-menu-item-select`
  alongside the documented `lr-menu-select`.
- cc90b3a: Fix two `lr-thread-list` bugs: a row click fired `lr-select` twice (the correct re-emit plus the
  original bare event leaking through unstopped), and content slotted into `slot="empty"` rendered
  unconditionally instead of only when the list has zero visible threads.

## 6.0.0

### Major Changes

- 5c93d1b: Remove `<lr-data-grid>`. It was a strict functional subset of `<lr-table>` (same `role="grid"` +
  roving-tabindex + sort/select/loading pattern, with none of `<lr-table>`'s filtering, pagination,
  inline editing, resize, grouping, expansion, heat-tint, sticky columns, or footers), implemented
  independently with no shared code. Use `<lr-table>` instead:

  - `DataGridColumn<T>`'s optional `value(row)` becomes `TableColumn<T>`'s required `cell(row)`.
  - `<lr-data-grid>`'s `emptyText` string becomes `<lr-table>`'s `emptyHeading`/`emptyDescription`
    pair (rendered via an internal `<lr-empty>`, not a plain text cell).
  - `<lr-data-grid>` always mutated `selectedKey` and emitted `lr-selection-change` on row
    click/activation; `<lr-table>` only does that when `selection-mode` is `"single"` or
    `"multiple"` (default `"none"`, presentational) — listen on `lr-row-click` (`detail: { row }`)
    instead if you don't need `<lr-table>`'s own selection bookkeeping.
  - `accessibleLabel`/`aria-label` — unchanged; `<lr-table>` reads a plain `aria-label` attribute the
    same way.

  `<lr-eval-dataset>` and `<lr-eval-result>` composed `<lr-data-grid>` internally and now compose
  `<lr-table>` instead. `<lr-eval-result>`'s public `columns` property changes type accordingly from
  `DataGridColumn<EvalRunResult>[]` to `TableColumn<EvalRunResult>[]` — update any `value(row)`
  column definitions you pass in to `cell(row)`.

### Minor Changes

- 5c93d1b: Add a `3xs` size tier to `<lr-chip>`, one step below `2xs`, for dense inline count pills.
- 8e6e045: `lr-confirm-bar`: swap the hand-rolled `deny-button`/`approve-button` native `<button>`s for
  `<lr-button>`, so `--lr-button-*` theming and a consumer's existing `lr-button` style fragments
  reach them like every other button in an app. Adds a host-writable
  `pending: 'approved' | 'denied' | null` property and makes `lr-approve`/`lr-deny` cancelable: a
  listener calling `preventDefault()` sets `pending` to the decision being made (showing `loading`
  on that button, `disabled` on the other) instead of resolving synchronously, so a host whose
  approval hits a network call can keep the UI honest about being in flight. Finalize by setting
  `.decision`, or bounce back by clearing `.pending` to `null`.

  **Breaking (CSS only):** `::part(deny-button)`/`::part(approve-button)` now select an `<lr-button>`
  host, not a native `<button>`.

  Before:
  lr-confirm-bar::part(deny-button) { padding: 4px 8px; border: ...; }
  After (use the re-exported sub-parts):
  lr-confirm-bar::part(deny-button-base) { padding: 4px 8px; border: ...; }

  Runtime API (events, `tone`, `compact`, slots, the new `pending` property) is unchanged.

- 050c43c: Fix `<lr-control-group>` collapsing to 0 inline size when placed as an ordinary flex-basis:auto
  child of a shrink-to-fit flex row (its own stated primary use case). The `@container`
  narrow-allocation breakpoint is now opt-in via a new `responsive` property instead of always-on.
- 18e7b10: Add `--lr-dashboard-grid-cell-hover-outline-color` to `<lr-dashboard-grid>`, theming the mouse-hover preview outline on `[part="cell"]` independently of the shared `--lr-color-border-strong` token. Set it to `transparent` to opt out of the hover treatment entirely.
- bd2e594: Add `--lr-flow-canvas-node-hover-outline-color` to `<lr-flow-canvas>`, theming the mouse-hover preview outline on `[part="node"]` independently of the shared `--lr-color-border-strong` token. Set it to `transparent` to opt out of the hover treatment entirely.
- 76690c7: Add `--lr-button-gap` and `--lr-button-radius` custom properties to `<lr-button>`, so the
  icon/label gap and corner radius are retunable without a `::part(base)` rule — matching the
  retunable-without-`::part()` treatment `--lr-button-padding-block/-inline` and
  `--lr-button-font-size` already have.
- f8810d7: Add `<lr-locale-picker>`: a closed-list locale switcher over the locale registry
  (`getRegisteredLyraLocales()`) or an explicit `locales` catalog, form-associated and mirroring
  `<lr-select>`'s hand-rolled listbox. Selecting a row emits a cancelable `lr-change` and, unless
  vetoed, applies the pick via `setLyraLocale()`.
- 77377ed: Add `getRegisteredLyraLocales()` and `subscribeLyraLocaleRegistry()` so a consumer can enumerate
  and live-track every locale registered via `registerLyraLocale()` (plus `'en'`) — the piece that
  unblocks a locale-picker component built on top of the existing locale runtime.
- 0771a83: Add a `renderExcerpt` hook to `<lr-thread-list>`, rendering rich per-row excerpt content into the
  row `<lr-conversation-item>`'s own `excerpt` slot — where it wins over the plain-string `excerpt`
  property — for cases like a server-highlighted search-match snippet, without giving up the built-in
  title layout and inline-rename affordance the way `renderRowContent` requires.
- 02cd69d: Add `<lr-reorder-item>`, one row of the new `<lr-reorder-list>` flat-list reorder primitive.
- 2cf4206: Add `<lr-reorder-list>`, a generic flat-list reorder primitive with move-up/move-down buttons and
  a Ctrl/Cmd+ArrowUp/ArrowDown keyboard shortcut, emitting the full new order on every move.
- c6af1b7: `lr-tool-approval-dialog`: swap the hand-rolled `deny-button`/`approve-button` native `<button>`s
  for `<lr-button>` (`variant="neutral"`/`"brand"`), so `--lr-button-*` theming and a consumer's
  existing `lr-button` style fragments reach them like every other button in an app. Adds a
  host-writable `pending: 'approve' | 'deny' | null` property and makes `lr-approve`/`lr-deny`
  cancelable: a listener calling `preventDefault()` sets `pending` to the decision being made
  (showing `loading` on that button, `disabled` on the other) instead of closing immediately, so a
  host whose approval hits a network call can keep the dialog honest about being in flight.
  Finalize by calling `close('approve'|'deny')`, or bounce back by clearing `.pending` to `null`.
  While `pending` is set, Escape and backdrop dismissal are suppressed; `pending` itself resets to
  `null` every time the dialog re-opens. The `edit-button` is unaffected.

  **Breaking (CSS only):** `::part(deny-button)`/`::part(approve-button)` now select an `<lr-button>`
  host, not a native `<button>`.

  Before:
  lr-tool-approval-dialog::part(deny-button) { padding: 4px 8px; border: ...; }
  After (use the re-exported sub-parts):
  lr-tool-approval-dialog::part(deny-button-base) { padding: 4px 8px; border: ...; }

  Runtime API (events, `editable` and its editing behavior, slots, the new `pending` property) is
  unchanged.

- 65d6a2b: Add `--lr-virtual-list-hover-outline-color` to `<lr-virtual-list>`, theming the mouse-hover preview outline on `[part="base"]` independently of the shared `--lr-color-border-strong` token. Set it to `transparent` to opt out of the hover treatment entirely.

### Patch Changes

- 3fd9bbd: Regenerate the agent-tools reference docs and custom-elements manifest for the `lr-confirm-bar`/
  `lr-tool-approval-dialog` `lr-button` swap and their new `pending` properties (see the sibling
  changesets for the runtime changes themselves).
- 9ebb38c: `lr-icon-button`: restore rendering for slotted bare SVG geometry (`<path>`, `<circle>`, etc. with
  no enclosing `<svg>`) when `icon` is unset. 5.2.0's natural-aspect-ratio change made the default
  slot a sibling of the internal glyph instead of nesting it inside an SVG, which silently stopped
  this narrow case from painting (no console error, no type error). A small whitelist of raw SVG
  geometry tag names is now cloned into a real SVG-namespaced element the same way `<lr-icon>`'s own
  custom-content slot already does — every other case (complete `<svg>`, `<img>`, custom elements) is
  untouched, so the `createElementNS`-on-custom-elements bug 5.2.0 fixed for `<lr-flag>` cannot
  regress.

## 5.2.0

### Minor Changes

- 602177a: `lr-button`: expose its per-size geometry and its outlined fill as custom properties, so a consumer
  no longer needs a `::part(base)` rule to fit a button into a dense toolbar or to tint an outline.

  - `--lr-button-padding-block`, `--lr-button-padding-inline` and `--lr-button-font-size` now carry
    each `size` tier's padding/font-size (the `:host` defaults are the `m` tier). Every tier is now
    pure custom-property re-assignment — matching `lr-input`, `lr-select`, `lr-combobox`,
    `lr-segmented` and `lr-date-input` — so overriding one knob retunes the tier instead of fighting
    the stylesheet.
  - `--lr-button-min-height` carries the active tier's `min-block-size` floor (it resolves to that
    tier's existing `--lr-button-size-*` token), and the new `--lr-button-height` pins an exact
    height — flooring _and_ capping the button, e.g. to match a fixed toolbar row. It is deliberately
    left undeclared by default so each tier's floor still applies when it is unset.
  - `--lr-button-outlined-fill` (default `transparent`) tints `appearance="outlined"`. Like
    `--lr-button-quiet-*` it is not swapped per `variant`. Note that the existing hover
    `filter: brightness()` visibly brightens a tinted fill, where a transparent one showed no change.

  `appearance="link"` continues to ignore all of these and render as zero-chrome inline text. With
  every property unset, all six tiers render byte-identical to before.

- fe06b7d: `lr-card`: `interactive` now grants real activation semantics when `href` is not also set.
  `[part='base']` becomes focusable (`tabindex="0"`), responds to Enter and Space (Space calls
  `preventDefault()` so the page does not scroll under the focused card), and emits a new
  `lr-card-activate` event (no detail) — so a clickable tile no longer needs a consumer-supplied
  wrapper or a `::part(base)` hack to be keyboard-operable.

  - The card deliberately carries **no** `role="button"`. A card is a container that routinely holds
    slotted buttons and links, and `role="button"` around focusable descendants is the axe-core
    `nested-interactive` violation this library's own a11y gate enforces (unlike `lr-chip`'s
    `toggleable` mode, which can forbid focusable children and therefore can carry the role).
  - Because of that, "did the user aim at the card or at a control inside it?" is answered at event
    time: the handler walks `composedPath()` from the original target up to `[part='base']` and bails
    out if anything on the way is itself a control (a link, button, form control, `[tabindex]`, or an
    interactive `role`). A click on a slotted `lr-button` or `<a>` therefore never activates the card.
  - With `href` set, the root is still a real `<a>`: native navigation remains the activation, no
    extra `tabindex` is added, and `lr-card-activate` is never fired.
  - Without `interactive`, the rendered output is unchanged — no `tabindex`, no listeners, no events.

- 76b4ef7: `lr-chat-composer` gains `appearance="plain"` (reflected, `'card' | 'plain'`, default `'card'`), so a
  composer docked inside a chat panel, dialog footer or toolbar that already draws its own border
  doesn't double the frame. `plain` drops `[part="base"]`'s border, background, padding and corner
  radius; the row layout, disabled treatment and the send/stop button's own chrome are unaffected.

  Focus stays visible either way. The card's only focus affordance is a border-color shift, and there
  is no border left to recolor under `plain` (the internal textarea sets `outline: none`), so `plain`
  swaps in an underline across the input row instead — drawn as an inset box-shadow from
  `--lr-focus-ring-width`/`--lr-focus-ring-color`, so it costs no layout.

  An unset composer renders byte-identically to before.

- 89dc89a: Add density and chrome-less escape hatches to six card-chrome components so an embedded card no
  longer forces its own frame on a host that already draws one:

  - `lr-agent-run`, `lr-entity-card`, `lr-source-card` each gain both a reflected `compact` boolean
    (tighter padding/gap, tunable via `--lr-<component>-compact-padding` / `-gap`) and
    `appearance="plain"` (drops border, background, padding and radius). `plain` wins over `compact`
    when both are set.
  - `lr-stack-trace` and `lr-flow-run-overlay` gain `appearance="plain"` — for nesting inside an
    `lr-result-card` / `lr-agent-run` or a host toolbar that already draws a border, without doubling
    the frame. `lr-flow-run-overlay`'s `plain` also drops its floating-surface shadow.
  - `lr-file-input` gains a reflected `compact` boolean (tighter dropzone padding, gap and label
    font, tunable via `--lr-file-input-compact-padding` / `-gap` / `-font-size`) so the dropzone fits
    a toolbar or table cell.

  All escapes default off; an unset component renders byte-identically to before. Interactive
  affordances that live on child controls (agent-run's Cancel/Retry, stack-trace's copy/frame
  buttons, source-card's title/toggle) keep their own chrome under `plain`.

- bca1353: `lr-flow-controls` gains `appearance="plain"` (reflected, `'card' | 'plain'`, default `'card'`), for
  clusters placed in a host toolbar or panel that already draws its own surface. `plain` drops
  `[part="base"]`'s border, background, padding, corner radius **and** its floating-surface
  `box-shadow` — a lift shadow with no surface under it reads as a stray smudge — matching what
  `lr-flow-run-overlay`'s `plain` already does.

  The cluster keeps its layout, its `orientation` axis, every button's shared minimum hit area
  (`--lr-icon-button-size`) and their hover/focus rings. No `compact` is offered: the padding is
  already the smallest spacing step, and the only remaining room is that hit-area floor.

  The existing `for`, `orientation` and `hideLock` properties are now documented too. An unset cluster
  renders byte-identically to before.

- ddf52ba: `lr-flow-node` now exposes its card as a CSS part and gains a density escape:

  - The bordered, filled card is reachable as `::part(card)` (it keeps its `.card` class, so nothing
    that already targeted it changes).
  - New reflected `compact` boolean tightens the card padding for dense canvases and palette previews,
    tunable via `--lr-flow-node-compact-padding` (default `var(--lr-space-xs)`) and
    `--lr-flow-node-compact-gap` (default `var(--lr-space-2xs)`). The border, background, shadow and
    the `selected`/`status="running"` treatments all stay.

  Two documentation/CSS bugs are fixed in passing: the `base` part is documented as what it actually
  is (the row wrapping the handles and the card, carrying no chrome of its own), and a duplicated
  `min-inline-size: 0` that overrode the card's own minimum width is removed — the documented
  `--lr-flow-node-min-inline-size` custom property was dead until now and once again sets the card's
  minimum inline size (default `11rem`).

  An unset node renders as before apart from that restored minimum width.

- 81f615b: `lr-checkbox` / `lr-radio`: publish the label indent, and stop hard-sizing the radio's circle.

  - **New `--lr-checkbox-label-indent` and `--lr-radio-label-indent`** carry the distance from the
    control's start edge to the start of the label — the box/circle's own floor
    (`min(--lr-icon-button-size, 1.75rem)`) plus the label gap (`--lr-space-s`), i.e. `2.25rem` at the
    default tokens. Consumers composing per-option hint text under a checkbox previously had to
    hardcode that `2.25rem` after reading it out of the shadow styles, where neither term was a public
    contract, so the hint silently de-aligned on any retheme. `[part='base']`'s `gap` is now _derived
    from_ the published property rather than repeating `--lr-space-s`, so the advertised value and the
    rendered geometry cannot drift: setting the property moves the label. Rendering is byte-identical
    when it is left unset.

    **Read this before assuming it closes the filed case.** The property is declared on the
    component's `:host`, so it is readable by the element itself and overridable from your own
    stylesheet (`lr-checkbox { --lr-checkbox-label-indent: … }` beats a `:host` rule), but custom
    properties inherit _down_, not sideways — a **sibling** `<p>` in your own tree can never read it
    off the checkbox. What actually solves that case is the `--lr-theme-icon-button-size` bridge that
    landed alongside this release: compute `calc(min(var(--lr-theme-icon-button-size, 2.5rem), 1.75rem)

    - var(--lr-theme-space-s, 0.5rem))` on your own wrapper from tokens you control, and both the
      control and your hint text stay aligned through a retheme. The new "Aligning per-option hint text"
      stories show both halves. This is not an unfixed gap; please do not re-file it as one.

  - **Bug fix — `lr-radio`'s `[part='circle']` was hard-sized**, with `inline-size`/`block-size` where
    `lr-checkbox`'s `[part='box']` correctly uses `min-inline-size`/`min-block-size`. Since
    `[part='base']` carries no box of its own, that circle _is_ the entire tap target for a label-less
    radio, and a hard size can be smaller than its own content — an enlarged indicator overflowed it
    instead of growing it. It is now a floor, matching `lr-checkbox` exactly. Default rendering is
    unchanged (28×28 at the default tokens, above the WCAG 2.2 SC 2.5.8 24×24 minimum).

    Note the residual, unchanged in this release: neither control guarantees the 24×24 minimum once
    `--lr-icon-button-size` is themed below it — `min()` still tracks the token down 1:1. Both
    controls behave identically here; a hard floor would need its own decision, since it would also
    block a deliberately dense checkbox.

  `lr-checkbox` deliberately still has no `hint`/`errorText` chrome of its own (see its class docs);
  that omission is intentional and adding it would require a `form-control` wrapper that changes the
  part structure for existing consumers.

- 6bf969f: Themeable code tab width, chat bubble geometry, and the code-block active-line outline color.

  - `--lr-code-block-tab-size` (default `2`) sets the tab width of rendered code. It is honoured by
    `lr-code-block`, `lr-code-block-core`, `lr-markdown`, and `lr-markdown-core`, and shares the
    default of the existing `--lr-code-editor-tab-size`, so the editable and read-only code surfaces
    agree. The markdown viewers declare it themselves because they are sibling elements of
    `lr-code-block`, not descendants — one declaration could not have reached them. `lr-code-block`
    reads the token rather than writing `tab-size` inline, so the override survives shiki's own
    inline `style` on the highlighted `<pre>`. Note that a markdown code block wraps
    (`white-space: pre-wrap`) while `lr-code-block` does not, so the same value can render
    differently on a wrapped line, where tab stops restart.
  - `--lr-chat-message-bubble-padding` (default `var(--lr-space-m)`) and
    `--lr-chat-message-bubble-radius` (default `var(--lr-radius)`) reshape `lr-chat-message`'s
    bubble. Use these instead of a `::part(bubble)` padding/radius override: an outer-tree `::part`
    declaration outranks every rule inside the component's shadow tree, which silently suppressed
    the per-`status` (`failed`, `streaming`) and per-role bubble treatments. The radius prop is
    bubble-only — `collapse-button` and `retry-button` keep reading the shared `--lr-radius`.
  - `--lr-code-block-active-line-outline-color` (default `var(--lr-color-brand)`) retints only the
    outline of the line marked active by `active-highlight-id`, leaving the language pill, hover,
    and focus surfaces on `--lr-color-brand`.

  All three default to exactly today's rendering, so a consumer who overrides none of them sees no
  visual change.

- fe06b7d: `lr-confirm-bar`: new reflected `compact` property that collapses the bar from a full card
  (bordered, padded, `display: block` surface) into a chrome-less inline row, for a confirmation that
  has to live inside an existing container — a table cell, a card's action row, a toolbar.

  - The **host** flips to `inline-flex` under `[compact]`, not just `[part='base']`: restyling the
    part alone still leaves a `display: block` host that breaks the row it was dropped into.
  - The narrow-allocation container query is switched off with it (`container-type: normal`). A
    compact bar is _expected_ to be narrow, so leaving the query live would fire it essentially
    always and stretch the Deny/Approve buttons to fill — the opposite of the intent.
  - Re-chrome it through `--lr-confirm-bar-compact-padding` (default `0`),
    `--lr-confirm-bar-compact-gap` (default `var(--lr-space-s)`), `--lr-confirm-bar-compact-border`
    (default `none`), `--lr-confirm-bar-compact-radius` (default `0`) and
    `--lr-confirm-bar-compact-background` (default `transparent`).
  - Everything else is unchanged: `lr-approve`/`lr-deny` shapes, `role="group"` and its heading
    label, and the contract that focus moves synchronously to `[part='status']` _before_ the
    Deny/Approve buttons unmount. Leaving `compact` unset renders exactly as before.

- 49e0738: `lr-conversation-item` gains a `compact` density flag

  A reflected boolean `compact` (default `false`, matching `lr-empty`'s convention) tightens
  `[part='base']`'s padding from `var(--lr-space-s) var(--lr-space-m)` to
  `var(--lr-space-xs) var(--lr-space-s)`, its gap from `var(--lr-space-xs)` to `var(--lr-space-2xs)`,
  and collapses `[part='content']`'s inter-line gap to `0`. Both tuned values sit behind the new
  `--lr-conversation-item-compact-padding` / `--lr-conversation-item-compact-gap` custom properties —
  declared as inline `var()` fallbacks at the point of use, never on `:host`, so a surrounding list can
  retune every row at once from an ancestor. Unset, a row renders exactly as before.

  Nothing else changes. In particular `[part='rename-button']` keeps its
  `min-inline-size`/`min-block-size: var(--lr-icon-button-size)` floor under `compact`, so a density
  flag can never silently drop a row's icon target below the shared minimum; the excerpt stays visible
  (it is already single-line ellipsised and `hidden`-bindable per row) and the excerpt/timestamp font
  sizes stay at their existing steps. `:host([compact]) [part='base']` is ordered before
  `:host([active]) [part='base']`, which is equal specificity, so an active row keeps its background
  and its promoted excerpt/timestamp contrast when both are set.

- 3737d4c: Add consumer-settable CSS custom properties for state-styled surfaces in the data and agent-tools
  families that previously took their color straight from a library-wide `--lr-color-*` token with no
  component-scoped indirection. Because CSS Shadow Parts forbids an attribute selector after `::part()`
  (`::part(row)[aria-selected]` is invalid), these states could only be restyled by hijacking the
  shared token, which repaints everything else that reads it. Each new property uses an inline
  `var()` fallback to its old token value, so an unset consumer renders byte-identically to before:

  - `lr-data-grid`: `--lr-data-grid-row-selected-bg` (selected row background).
  - `lr-env-list`: `--lr-env-list-reveal-active-bg`, `--lr-env-list-reveal-active-border` (pressed
    reveal toggle background/border).
  - `lr-flow-node`: `--lr-flow-node-selected-border` (selected card border color).
  - `lr-flow-canvas`: `--lr-flow-canvas-node-current-outline-color` (current node outline color).
  - `lr-artifact-panel`: `--lr-artifact-panel-view-active-bg`, `--lr-artifact-panel-view-active-color`
    (pressed preview/code toggle background/text).
  - `lr-test-results`: `--lr-test-results-filter-active-bg`, `--lr-test-results-filter-active-border`,
    `--lr-test-results-filter-active-color` (pressed status filter toggle).
  - `lr-span-waterfall`: `--lr-span-waterfall-row-active-bg` (active row background).
  - `lr-trace-tree`: `--lr-trace-tree-row-active-bg` (active row background).
  - `lr-agent-trace`: `--lr-agent-trace-handoff-active-bg` (active handoff quick-jump entry background).
  - `lr-policy-summary`: `--lr-policy-summary-count-allow-color`,
    `--lr-policy-summary-count-deny-color`, `--lr-policy-summary-count-needs-review-color` (per-state
    count text colors).

- 8e4e5cc: `<lr-filter-bar>` gains a `'text'` filter type, composing `<lr-input>` for an open-ended query, plus
  an optional per-filter `debounce` (ms). A dashboard whose toolbar is a search box next to a few
  dropdowns can now be a single filter bar — the search box participates in the same `value` object,
  the same removable active-filter chips (shown verbatim, so a query containing a slash is no longer
  mangled), the same reset button and `loading` state — and can delete its own hand-rolled debounce
  timer. A pending debounce is flushed by the field's own change/blur and cancelled by `reset()`, a
  chip removal, and disconnection, and the text field stays uncontrolled-with-sync so a re-render
  mid-typing never disturbs the caret.
- f8bc916: Form controls: exact-height escape hatches and `start`/`end` adornment slots.

  - `--lr-combobox-trigger-height` and `--lr-input-control-height` are new custom properties that pin
    an exact control height — flooring _and_ capping the row — so `lr-select`, `lr-combobox` and
    `lr-input` can be pixel-matched in one toolbar without a `::part()` rule. Both are deliberately
    left undeclared by default, so each tier's existing `*-min-height` floor still applies when they
    are unset. Because the component never declares them, they can also be set from an ancestor or an
    outer-tree rule, not only inline on the element. On `lr-combobox` the hatch is a single-row
    affordance: in `multiple` mode a tag row long enough to wrap overflows the pinned box visibly
    (nothing is clipped), so leave it unset there.
  - **Behaviour change:** `lr-select` declared `--lr-select-trigger-height: auto` on `:host`, which
    made the `var()` fallback to `--lr-select-trigger-min-height` unreachable and left that property
    dead at the default `m` tier (four extra specificity rules patched the floor back for
    `xs`/`s`/`l`/`xl` only). The sentinel is now genuinely undeclared and the patch rules are gone, so
    `--lr-select-trigger-min-height` is live at every tier. The visible consequence is that a
    default-size `lr-select` trigger now honours the `2.5rem` floor it already declared — byte
    identical to `lr-input`'s and `lr-combobox`'s own `m` floor, so the three controls line up.
    `getComputedStyle(el).getPropertyValue('--lr-select-trigger-height')` now returns `''` rather than
    `'auto'`; assert the rendered `min-block-size`/`block-size` instead.
  - `lr-combobox` and `lr-date-input` gain `start`/`end` adornment slots with matching `start`/`end`
    CSS parts, mirroring `lr-input`'s existing implementation: the wrappers are `hidden` while nothing
    is slotted, and they inherit the control's own padding so no consumer spacing is needed. `end`
    renders before the dropdown chevron (`lr-combobox`) and before the calendar toggle
    (`lr-date-input`), so consumer content never sits outboard of the built-in trigger. Slotted
    adornments are never collected as `lr-combobox` options.
  - `lr-select` is deliberately excluded from `start`/`end`: its `[part='trigger']` is a native
    `<button>`, whose content model forbids interactive descendants, and its `justify-content:
space-between` would push the label to the middle. `lr-date-input` is deliberately excluded from
    the exact-height hatch: its row has no `min-block-size`, and its height is pinned transitively by
    `--lr-icon-button-size` on the calendar button — capping it would crush the 24x24 target.

- 4a43cc0: `<lr-heatmap>`: `CalendarCellPos` now carries the resolved ISO `yyyy-mm-dd` `date` alongside
  `week`/`weekday`. Every calendar-mode position handed to `cellText`, `cellColor` and
  `cellInteractive` is populated — **including grid positions with no matching entry in `days`**
  (a gap in a sparse calendar still sits on a real calendar day) — so a callback can key off the date
  directly instead of re-deriving the grid's `firstWeekStart + week * 7 + weekday` anchor arithmetic,
  which was the only way to answer "is this cell in the future?" before.

  The date comes from a per-grid cache built once whenever the calendar grid is rebuilt, so it costs
  an array read rather than a `Date` allocation per cell per repaint, and it is deliberately excluded
  from the internal hover/focus position-equality check so repaint diffs are unchanged. Matrix mode's
  `MatrixCellPos` is untouched, and `lr-cell-click`'s detail shape is unchanged.

  `date` is a **required** field of `CalendarCellPos`. No API on this component accepts a
  `CalendarCellPos` as input — it is purely a callback parameter type — so this is additive for every
  supported use; the only way to notice it is hand-constructing a `CalendarCellPos` literal in
  TypeScript, which now needs a `date`.

- 4a43cc0: `<lr-heatmap>`: `HeatmapLegendStop.color` is now optional, so a `legendStops` entry can be a
  **caption-only** stop. A stop with no `color` (or an empty-string `color`) renders its
  `[part="legend-stop-label"]` with **no `[part="legend-swatch"]` element in the DOM at all**, rather
  than an empty 0.6rem swatch box — the shape a GitHub-style "Less ▢▢▢▢ More" key needs for the bare
  captions bracketing its colored ramp. Colored stops are unchanged, and an all-colored `legendStops`
  array renders exactly as before.

  The trailing `valueLabel` caption that closes the legend row also gained
  `part="legend-value-label"` (it was the one unaddressable node in `[part='legend']`), in both the
  gradient and the `legendStops` branch. Nothing else in the legend markup changed.

- 4a43cc0: `<lr-heatmap>` gained `maxCellSize` (`max-cell-size`) and `minCellSize` (`min-cell-size`), bounding
  the cell size `fit-to-width` derives from the host's measured width in **both** calendar and matrix
  mode. Without a ceiling, a 5-week calendar or a 3-column matrix in a wide pane inflates into a few
  giant blocks; without a raisable floor, a year-long calendar in a narrow pane collapses onto the
  built-in 4px minimum.

  Both are ignored while `fit-to-width` is unset — an explicit `cell-size` is an exact request and is
  never clamped — and both default to unset, so an untouched consumer's geometry is byte-identical.
  `min-cell-size` can only raise the built-in 4px floor, never lower it; when both are set and
  `max-cell-size < min-cell-size` the ceiling wins. A non-finite or empty attribute means unset rather
  than `0`.

  Note that the canvas is sized from the _clamped_ cell size, so a capped grid leaves the host's
  remaining width unfilled instead of stretching to it — align it with normal CSS on the host.

- 068cb85: `lr-icon-button` hosts natural-aspect-ratio content

  The default slot is now rendered as a **sibling** of the built-in glyph instead of being piped
  through `<lr-icon>`, and `<lr-icon>` is mounted only when `icon` is set. The button box is also
  floored with `min-inline-size`/`min-block-size: var(--lr-icon-button-size)` instead of being pinned
  to it, matching that token's documented contract (a minimum tappable box, not a fixed size).

  Slotted content previously went through `lr-icon`'s node-cloning path, which rebuilds every
  assigned node with `document.createElementNS('http://www.w3.org/2000/svg', localName)` — a slotted
  custom element such as `<lr-flag>` became an SVG-namespaced element that never upgraded and never
  painted. It now renders normally, at its own aspect ratio.

  **Migration.** Slotted **bare SVG geometry** (`<path>`, `<circle>`, …) with no `icon` attribute
  relied on the removed `<lr-icon>` wrapper to supply an SVG parent, and must now be wrapped
  explicitly:

  ```html
  <!-- before -->
  <lr-icon-button aria-label="Star"><path d="…"></path></lr-icon-button>
  <!-- after -->
  <lr-icon-button aria-label="Star"
    ><lr-icon path="…"></lr-icon
  ></lr-icon-button>
  ```

  A complete element — an `<svg>`, an `<img>`, an `<lr-flag>` — keeps working, renders more reliably,
  and is no longer constrained to a 1:1 box: content larger than `--lr-icon-button-size` now grows the
  button and keeps its own aspect ratio, while a small glyph still pads out to the full tappable
  target on both axes.

- 9ed6aa8: Add component-scoped state-styling cssprops to eight layout/forms components, so a selected/active/current state can be restyled from outside without hijacking a library-wide `--lr-color-*` token (which repaints everything else reading it). `::part(x)[state]` is invalid CSS — an attribute selector cannot follow `::part()` — so hijacking the shared token used to be the only lever. Each new prop is an inline `var()` fallback (never declared on `:host`, which would re-stamp per instance and shadow any ancestor value), and every default is the exact token the rule used before, so an unset consumer renders byte-identically.

  - `lr-app-rail-item`: `--lr-app-rail-item-current-bg`, `--lr-app-rail-item-current-color` for the `active`/`aria-current="page"` item.
  - `lr-stepper`: `--lr-stepper-current-color`, `--lr-stepper-error-color`, `--lr-stepper-current-index-bg`, `--lr-stepper-current-index-color`.
  - `lr-widget`: `--lr-widget-view-toggle-active-bg`, `--lr-widget-view-toggle-active-color` for the pressed view toggle.
  - `lr-carousel`: `--lr-carousel-indicator-current-bg`, `--lr-carousel-indicator-current-border-color` for the current slide's indicator dot.
  - `lr-breadcrumb-item`: `--lr-breadcrumb-current-color` for the current-page item.
  - `lr-command-palette`: `--lr-command-palette-active-bg` for the active command row.
  - `lr-time-range`: `--lr-time-range-preset-active-bg`, `--lr-time-range-preset-active-border-color`, `--lr-time-range-preset-active-color` for the active preset button.
  - `lr-emoji-picker`: `--lr-emoji-picker-active-bg` for the keyboard-active and hovered emoji (both share one rule, so one hook retints both).

- cea6d8e: New `localeNativeName(tag)` helper next to `languageToCountry()` / `LANGUAGE_TO_COUNTRY`: it returns
  a locale's endonym — its name written in that locale itself (`'fr'` → `français`, `'pt-BR'` →
  `português (Brasil)`) — which is what a language switcher should list. It reads through the shared
  memoized `Intl.DisplayNames` cache, so no name table ships and repeat lookups are free, and it
  degrades to the tag itself for an unknown or structurally invalid tag instead of throwing. Paired
  with `languageToCountry()` and `lr-popover`, it composes the locale-picker recipe shown in the new
  Flag story.
- 184bfff: `lr-menu`: Escape from `header`/`footer` content closes the menu and refocuses the trigger
  unconditionally, with no opt-in required.

  That matches `<lr-popover>`, which already dismisses on Escape from arbitrary popup content, and it
  is the only sensible contract for a region the component now positively invites you to fill: a
  filter field you can Tab into but not Escape out of is a trap.

  - `closeOnEscapeAnywhere` is **unchanged** — not deprecated, still `false` by default, and still
    governing exactly one thing: Escape from non-item content slotted into the **default** slot.
    Escape bubbling up from inside `[part='list']` is left entirely to the list's own handler.
  - Arrow/ArrowUp/Home/End/Enter/Space from header/footer content keep their full native behavior;
    the item-target gate that guarantees that is untouched, and nothing in the new region handler
    calls `preventDefault()` for those keys.

- 184bfff: `lr-menu`: new `header` and `footer` slots for composed, non-menu-item content, rendered inside
  `[part='popup']` but **outside** the `role="menu"` list — with matching `header`/`footer` CSS parts.

  A filter field, a section title, an "Apply"/"Done" button and friends have always been a real use
  case for this component (`closeOnEscapeAnywhere` exists for exactly that), but the only place to put
  them was the default slot — i.e. inside `role="menu"`, where ARIA permits only
  `menuitem`/`menuitemradio`/`menuitemcheckbox`/`group`/`separator` children. Anything else there is an
  `aria-required-children` violation. The new slots give that content a valid home.

  - Nothing about the default slot changes: item discovery, roving tabindex, type-ahead,
    `closeOnEscapeAnywhere` and its `false` default all behave exactly as before, and `items` still
    only ever contains `<lr-menu-item>`s no matter what the new slots hold.
  - With neither slot filled the rendered result is unchanged — both wrappers collapse to no box at
    all, `[part='list']` keeps its exact position and size inside the popup, and the host gains no
    attribute of any kind.
  - Emptiness is tracked from each slot's own `slotchange` (reflected as `data-has-header` /
    `data-has-footer` / `data-list-empty` on the host) rather than with `:empty`, which can never match
    a part that contains a slot: Chromium counts the whitespace-only text nodes Lit leaves there.
  - Non-item content in the **default** slot keeps working exactly as it did, with no runtime warning,
    but the new slots are now the supported place for it.

- 184bfff: `lr-menu`: Tab now moves focus into the `header`/`footer` regions instead of closing the menu, and
  tabbing out of the popup's last focusable finally closes it.

  Two halves of the same defect. `onListKeyDown` gated every key except Escape behind "is the event
  target a real `<lr-menu-item>`?", so (a) Tab from an item always closed the menu — you could never
  Tab _into_ composed content, in either direction, since Shift+Tab is `key === 'Tab'` too — and
  (b) Tab from composed content did nothing at all: focus walked out of the popup while the menu
  stayed open, an untested dismissal hole.

  Tab handling therefore moves from `[part='list']` to `[part='popup']`, which also sees keydowns from
  the new regions, and the menu now closes only when Tab would leave the popup entirely:

  - Tab from an item with a focusable `footer` (or Shift+Tab with a focusable `header`) keeps the menu
    open and lets the browser's own Tab advance carry focus into the region.
  - Tab out of the last focusable in the popup — in either direction, from an item or from composed
    content — closes the menu.
  - **With no header/footer content, Tab closes exactly as before**, and non-item content in the
    default slot stays deliberately Tab-unreachable from an item.
  - `preventDefault()` is still never called for Tab, in any branch: native focus navigation proceeds
    untouched, only the now-stale open state is cleared.

- fe06b7d: `lr-menu`: `show(focus?)` and `hide(options?)` are now public.

  - `hide({ focusTrigger: true })` closes the menu **and** returns DOM focus to the `trigger`-slotted
    element — the case the trigger alone cannot express, e.g. a slotted "Apply"/"Done" button inside
    the menu, or a consumer-owned keyboard shortcut. `hide()` on its own closes without moving focus,
    for dismissals where the interaction has already put focus somewhere the user chose.
  - `show()` is promoted alongside it (rather than shipping an asymmetric API) and still accepts the
    `'first' | 'last'` initial focus target.
  - The roving-tabindex reset moved from `hide()` into `updated()`, so a bare `el.open = false` from
    outside now resets `activeIndex` too. Previously that path left a stale `tabindex="0"` tab stop on
    whichever item was last active, so Tab could land inside a closed menu. `hide()` stays thin and
    `updated()` remains the single owner of positioning, listeners and the `lr-show`/`lr-hide` events;
    focus restoration deliberately stays in `hide()` so `disconnectedCallback()`'s own `open = false`
    teardown reset can never steal focus.

- 09bdfde: `lr-activity-feed`: make the virtualized entry rows actually styleable, by this component and by a
  consumer.

  At/above `virtualizeThreshold` the entries are produced by this component's `renderItem` but
  committed into the embedded `<lr-virtual-list>`'s own shadow root, one boundary deeper than a
  `[part='entry']` selector can reach — so every entry, icon, text and timestamp rule was silently
  inert and a long feed rendered as unstyled rows. Each rule now pairs its plain selector (still
  correct below the threshold, where the same template renders into this component's own shadow root)
  with an `lr-virtual-list::part(…)` twin, and an `exportparts` forwarding declaration makes the same
  parts reachable as `lr-activity-feed::part(entry)` etc. from a consuming stylesheet.

  The tone dot is promoted from an internal class to a named `tone-dot` part, since a class selector
  cannot cross a shadow boundary either. `::part()` cannot be followed by an attribute selector, so
  the tone carries a second name in the dot's part list rather than being matched through
  `[data-tone]` (`::part()` matches with `part~=` semantics, so both names select the same element).
  New parts: `tone-dot`, plus `tone-dot-neutral`/`tone-dot-brand`/`tone-dot-success`/
  `tone-dot-warning`/`tone-dot-danger`. The `data-tone` attributes are unchanged, and a consumer can
  now retint a single tone instead of overriding a library-wide color token.

- 9150bb1: `lr-archive-viewer`: make the virtualized entry rows actually styleable, by this component and by a
  consumer.

  Entry rows are produced by this component's `renderItem` but committed into the embedded
  `<lr-virtual-list>`'s own shadow root, one boundary deeper than a `[part='entry']` selector can
  reach — so all five row-level rules were silently inert and the listing rendered as unstyled stacked
  text with no row layout, no icon sizing, no truncation and no size column treatment. They now reach
  through `lr-virtual-list::part(…)`, and an `exportparts` forwarding declaration makes the same parts
  reachable as `lr-archive-viewer::part(entry)` etc. from a consuming stylesheet.

  New part `entry-name-dir`: `::part()` cannot be followed by a descendant combinator, so the
  directory-row emphasis that used to be written as a descendant selector now targets a second part
  name on the name element itself. A directory row's name is `part="entry-name entry-name-dir"`, and
  `::part()` matches with `part~=` semantics, so both names select it.

- 3e171e6: Fix `lr-av-player`'s transcript cue styling never applying, and make every cue-level part reachable
  from a consumer stylesheet.

  Cues are composed through `lr-virtual-list`, whose `renderItem` result is committed inside that
  element's **own** shadow root — one boundary below the player's. A bare `[part='cue']` selector in
  the player's stylesheet cannot cross that boundary, so every cue rule was silently inert and each
  transcript row fell back to the raw browser button appearance: a grey background, a visible border,
  `1px 6px` padding and centered text, with no timestamp or speaker treatment and no visual state for
  the playing cue or the search matches. Every one of those rules now goes through
  `lr-virtual-list::part(…)`.

  `::part()` cannot be followed by an attribute selector, so the three cue states get their own part
  names, added alongside `cue` as a part list (`::part()` carries `part~=` semantics, so both names
  match the same element):

  - **New:** `cue-current` — the row the playhead is inside.
  - **New:** `cue-match` — a row matching the current search query.
  - **New:** `cue-active-match` — the row holding the current search match.

  The `aria-current`, `data-match` and `data-active-match` attributes are unchanged and still describe
  each row's state.

  This also makes two documented custom properties live for the first time:
  `--lr-av-player-cue-current-bg` now retints the playing cue, and
  `--lr-av-player-cue-active-match-color` now recolors the active search match's outline. Both
  previously resolved against a rule that never matched anything.

  The player forwards `cue`, `cue-current`, `cue-match`, `cue-active-match`, `cue-time`, `cue-speaker`
  and `cue-text` through `exportparts`, so `lr-av-player::part(cue)` and friends work from a consumer
  stylesheet for the first time.

- c0f00ac: `lr-csv-viewer` and `lr-spreadsheet-viewer`: make the documented `cell-highlight` part actually
  visible, and reachable from a consumer stylesheet.

  Both viewers already emitted `part="cell cell-highlight"` for a cell covered by a `highlights`
  entry, but neither had a single CSS rule for it anywhere — a highlighted cell rendered
  indistinguishably from a plain one. Highlighted cells render inside the internal
  `<lr-virtual-list>`'s own shadow root (they are `renderItem`'s output), so the styling is applied
  through `lr-virtual-list::part(cell-highlight)`, using the same outline tokens `lr-dataset-viewer`
  gives its own `cell-highlight` so a highlight reads identically across the table viewers.

  - New `--lr-csv-viewer-highlight-color` / `--lr-spreadsheet-viewer-highlight-color` custom
    properties (default `var(--lr-color-brand)`) set the outline color; the active highlight sets it
    inline to `var(--lr-color-warning, var(--lr-color-brand))`, so the active match is now
    distinguishable from the other highlighted cells.
  - A paired `:focus-visible` rule restores the shared focus ring, which the unconditional highlight
    outline would otherwise swallow on this focusable cell.
  - Both viewers now forward `exportparts` for `data-row`, `cell` and `cell-highlight` from the
    internal `<lr-virtual-list>`, so `lr-csv-viewer::part(cell)` and friends reach the real rendered
    rows instead of matching nothing.

- 99d5500: Fix `lr-chunk-inspector`'s entire chunk-row styling never applying above `virtualize-at`, and make
  every row-level part reachable from a consumer stylesheet.

  Past the threshold the row template becomes `lr-virtual-list`'s `renderItem`, whose result is
  committed inside that element's **own** shadow root — one boundary below this component's. A bare
  `[part='chunk']` selector cannot cross that boundary, so a long chunk list lost its row layout and
  separators, the score line's size/color/tabular figures, the score bar and its tone-mapped fill, the
  line clamp on the collapsed text preview, and the borderless brand styling on the open and
  show-more buttons, which fell back to the raw browser button appearance. Both documented custom
  properties (`--lr-chunk-inspector-current-bg`, `--lr-chunk-inspector-current-color`) were dead
  there too. Every rule now pairs its original selector with an `lr-virtual-list::part(…)` arm, so
  both rendering paths present identically — below the threshold the rows are still rendered into this
  component's own shadow root, where the bare selector is the one that matches.

  `::part()` cannot be followed by an attribute selector, and it cannot be followed into the matched
  element's subtree either, so row state is now carried by an additional part name (added alongside
  the base name as a part list — `::part()` carries `part~=` semantics, so both names match the same
  element):

  - **New:** `chunk-current` — the row matching `activeId`.
  - **New:** `score-current` — that row's score line, previously reached through a descendant
    selector no `::part()` can express.
  - **New:** `score-fill-success`, `score-fill-warning`, `score-fill-danger` — the score bar fill in
    each scoring tier.
  - **New:** `text-clamped` — the text preview while still collapsed.

  The `aria-current`, `data-tone` and `data-clamped` attributes are unchanged and still describe each
  element's state.

  While virtualized, the chunk row no longer carries its own `role="listitem"`: `lr-virtual-list`
  already wraps every row it renders in one, and the nested duplicate left the inner list item with a
  list-item rather than list parent — an invalid ARIA containment that axe flags.

  The internal `lr-virtual-list` now forwards every row part through `exportparts`, so
  `lr-chunk-inspector::part(chunk)` and friends work from a consumer stylesheet in both paths.

- 5bdb6d7: Fix `lr-notebook-viewer`'s cell and output styling never applying, and make every cell-level part
  reachable from a consumer stylesheet.

  Cells are composed through `lr-virtual-list`, whose `renderItem` result is committed inside that
  element's **own** shadow root — one boundary below the viewer's. A bare `[part='cell']` selector in
  the viewer's stylesheet cannot cross that boundary, so the rules for `cell`, `cell-gutter`,
  `outputs`, `output` and `output-toggle` were all silently inert: cells rendered without their
  two-column grid, padding and separator, the execution-count gutter without its monospace/quiet
  treatment, stderr and error outputs untinted, and the show-all-output control as a raw browser
  button. Every one of those rules now goes through `lr-virtual-list::part(…)`, including the
  narrow-allocation `@container` block — container queries resolve through the flat tree, so they
  still evaluate against the viewer's own `:host` container across the shadow boundary.

  `::part()` cannot be followed by an attribute selector or a descendant combinator, so three states
  and one descendant get their own part names, added alongside the existing ones as a part list
  (`::part()` carries `part~=` semantics, so both names match the same element):

  - **New:** `cell-active` — the cell an anchor currently targets. This is what
    `--lr-notebook-viewer-active-bg` retints; that custom property had no effect until now.
  - **New:** `output-error` — a stderr stream or an error output, carrying the danger tint.
  - **New:** `error-output-label` — the label introducing an error output's traceback.

  The `data-active`, `data-stream` and `data-output-type` attributes are unchanged and still describe
  each element for scripting.

  The viewer forwards `cell`, `cell-active`, `cell-gutter`, `cell-source`, `outputs`, `output`,
  `output-error`, `error-output-label` and `output-toggle` through `exportparts`, so
  `lr-notebook-viewer::part(cell)` and friends work from a consumer stylesheet for the first time.

- 2e3be2e: `lr-page-rail`: make the virtualized page rows actually styleable, by this component and by a
  consumer.

  Page rows are produced by this component's `renderItem` but committed into the embedded
  `<lr-virtual-list>`'s own shadow root, one boundary deeper than a `[part='page']` selector can
  reach — so all 13 row-level rules were silently inert and every page button rendered as a raw
  browser `<button>` (UA background, UA border, UA padding) instead of the intended rail row. They now
  reach through `lr-virtual-list::part(…)`, and an `exportparts` forwarding declaration makes the same
  parts reachable as `lr-page-rail::part(page)` etc. from a consuming stylesheet.

  `--lr-page-rail-current-bg` becomes live with this fix: it previously documented a background that
  nothing applied. It now tints the current page row, and keeps it tinted while the row is hovered so
  the current page stays identifiable under the pointer.

  `::part()` cannot be followed by an attribute selector, so state variants carry a second part name
  in the element's part list instead (`::part()` matches with `part~=` semantics, so both names select
  the same element). New parts: `page-current` on the current page button (alongside `page`), and
  `heat-dot-accent`/`heat-dot-success`/`heat-dot-warning`/`heat-dot-danger`/`heat-dot-neutral`/
  `heat-dot-overflow` on the heat markers (alongside `heat-dot`). The `data-tone`/`data-overflow`
  attributes are unchanged.

- 3217988: Fix `lr-pdf-viewer`'s page styling never applying, and make every page-level part reachable from a
  consumer stylesheet.

  Pages are composed through `lr-virtual-list`, whose `renderItem` result is committed inside that
  element's **own** shadow root — one boundary below the viewer's. A bare `[part='page']` selector in
  the viewer's stylesheet cannot cross that boundary, so the rules for `page`, `text-layer`, the page
  canvas, the generated text runs, the selection tint, and both search-match states were all silently
  inert: pages rendered without their centering/padding wrapper, the canvas without its border,
  the text layer unpositioned, and search matches unhighlighted. Every one of those rules now goes
  through `lr-virtual-list::part(…)`, including the RTL text-layer mirror.

  Because `::part()` cannot be followed by a descendant combinator, two elements that were previously
  addressed as descendants get their own names:

  - **New:** `page-canvas` — the canvas a page's content is painted onto.
  - **New:** `text-span` — one generated text run inside a page's text layer. The selection tint hangs
    off this part (`::part(text-span)::selection`), since a highlight pseudo is matched against the
    element the selected text originates in.

  `search-match` / `search-match-active` are now matched directly by name (`::part()` already carries
  `part~=` semantics), and the viewer forwards `page`, `page-canvas`, `text-layer`, `text-span`,
  `search-match` and `search-match-active` through `exportparts`, so `lr-pdf-viewer::part(page)` and
  friends work from a consumer stylesheet for the first time.

- 6f3db46: Fix `lr-retrieval-results`' row, selection and metadata styling never applying while virtualized,
  and make every row-level part reachable from a consumer stylesheet.

  Rows are composed through `lr-virtual-list`, whose `renderItem` result is committed inside that
  element's **own** shadow root — one boundary below this component's. A bare `[part='row-body']`
  selector in this component's stylesheet cannot cross that boundary, so the checkbox offset, the
  row-body layout, the selected-row indicator and the whole metadata list were silently inert
  whenever the list virtualized. `grouping="source"` always virtualizes, so every grouped consumer
  saw an unstyled result set, and the documented `--lr-retrieval-results-selected-border` custom
  property had nothing to recolor there. Each of those rules now pairs its original selector with an
  `lr-virtual-list::part(…)` arm, so both rendering paths present identically — the flat path below
  `virtualize-at` still renders these parts into this component's own shadow root, where the bare
  selector is the one that matches.

  `::part()` cannot be followed by an attribute selector, nor by a descendant combinator, so two
  kinds of rule needed new part names:

  - **New:** `row-body-selected` — added alongside `row-body` as a part list (`::part()` carries
    `part~=` semantics, so both names match the same element) on the selected row. The `data-selected`
    attribute is unchanged and still describes the row's state.
  - **New:** `metadata-term` and `metadata-value` — the `<dt>`/`<dd>` inside a `metadata-entry`,
    previously styled through a descendant selector that `::part()` cannot express. The trailing colon
    after a metadata key is now `::part(metadata-term)::after`.

  The group header in grouped mode also gains a separator matching the one this component's rows use;
  `lr-virtual-list` supplies the rest of its appearance.

  `exportparts` now forwards `select`, `row-body`, `row-body-selected`, `metadata`, `metadata-entry`,
  `metadata-term` and `metadata-value` alongside the existing `row`/`group-header`, and forwards each
  per-row `lr-chunk-inspector`'s own parts onward under a `chunk-` prefix (`chunk`, `chunk-current`,
  `chunk-score`, `chunk-score-current`, `chunk-score-bar`, `chunk-score-fill`,
  `chunk-score-fill-success`/`-warning`/`-danger`, `chunk-open-button`, `chunk-title`, `chunk-text`,
  `chunk-text-clamped`, `chunk-toggle`) — those live two shadow hops deep and were unreachable from
  outside the component entirely.

- 583f359: `lr-phone-input`: rebuild the country selector's closed state and add an opt-in `flags` API.

  The old closed control was the bare native `<select>` showing each option's full
  `"Country name (+code)"` text: long localized names clipped under the UA chevron (the trigger was
  capped at 45% of the field), the calling code appeared twice (inside the option text and again in
  `calling-code`), and the popup fell back to UA colors (a white panel in dark themes). The native
  `<select>` is kept — its popup, localized full country names, keyboard type-ahead, and native
  mobile pickers are irreplaceable and fully accessible — but it is now stretched invisibly over a
  compact decorative trigger:

  - New closed state: selected alpha-2 code (localized "Select" placeholder when no countries exist)
    plus the shared design-system chevron, with a pointer cursor, a hover tint, and an inner
    focus-visible ring so keyboard focus on the selector is distinguishable from focus on the
    telephone input. No more clipping and no duplicated calling code.
  - Popup options now pin `--lr-color-surface`/`--lr-color-text` so the open list follows the theme
    in dark mode.
  - New `flags` boolean attribute renders the selected country's flag in the trigger as
    `<lr-flag variant="compact" aria-label="">` (decorative — the select already announces the
    country). The `<lr-flag>` definition is registered lazily on first use, so nothing flag-related
    is bundled while `flags` stays off; flag artwork keeps the standalone `<lr-flag>` contract
    (install optional `@aceshooting/lyra-flags` + import
    `components/media/flag/flag-peer.js` once). Without it the trigger simply omits the image.
  - New CSS parts: `country` (selector region), `country-trigger`, `flag`, `country-code`
    (`data-placeholder` when empty), `expand-icon`. Existing parts are unchanged in name, but
    `country-select` is now the invisible overlay — a consumer rule that painted its text/background
    should target `country-trigger`/`country-code` instead.

- e83deb1: Selected-state styling hooks for `lr-segmented` and `lr-tabs`, an exact-height hatch for the
  `lr-segmented` track, and a marker legend row for `lr-sequence-strip`.

  - `lr-segmented` gains `--lr-segmented-selected-bg`, `--lr-segmented-selected-color`,
    `--lr-segmented-selected-font-weight`, `--lr-segmented-selected-shadow` and
    `--lr-segmented-hover-color`. Recoloring the checked pill previously required hijacking
    library-wide `--lr-color-surface`/`--lr-color-text`, which necessarily repainted hovered
    _unselected_ segments too (they read the same tokens); `::part(segment)[aria-checked='true']` is
    not valid CSS, so there was no other route. The hover color is now its own hook, so the two states
    are independent.
  - `lr-segmented` also gains `--lr-segmented-track-height`, pinning the track to an exact height at
    every `size` tier for a row that must line up with a hard-sized toolbar control. It is genuinely
    unset by default, so each tier keeps its `--lr-segmented-track-min-height` floor until you set it.
  - `lr-tabs` gains `--lr-tabs-selected-color`, `--lr-tabs-indicator-color` and
    `--lr-tabs-hover-color` for the same reason: the selected tab's text/underline and the hovered
    tab's text no longer share `--lr-color-brand`/`--lr-color-text` with the rest of the library.
  - `lr-sequence-strip` gains `markerLabel` (`marker-label`). When set alongside `show-legend` it adds
    one trailing legend row — `[part="legend-marker-swatch"]`, a neutral chip (themeable via the new
    `--lr-sequence-strip-legend-marker-bg`) carrying the cell's own bottom bar in
    `--lr-sequence-strip-marker-color` — and the marker's count joins the strip's auto-generated
    `aria-label` summary, so the visual legend keeps no entry without a spoken counterpart.

  Every new custom property is an inline `var()` fallback resolving to the token the rule already
  used, so an unset consumer renders exactly as before.

- 36dce60: Fill the sized-control cssprop gaps for `lr-date-input`, `lr-pagination`, `lr-known-date`,
  `lr-chip`, `lr-avatar`, and `lr-avatar-group`, matching the per-tier theming surface
  `lr-input`/`lr-select`/`lr-combobox` already expose.

  - **`lr-avatar` / `lr-avatar-group` (visible bug fix):** the initials fallback and the "+N"
    overflow badge were painted at a fixed `--lr-font-size-sm` at every `size`, so initials did not
    scale with the avatar circle. They now scale via new per-tier `--lr-avatar-font-size` and
    `--lr-avatar-group-badge-font-size` knobs (`sm`/`md`/`lg`). The `md` default is unchanged, so
    existing avatars render identically.
  - **`lr-date-input`:** adds a per-tier `--lr-date-input-control-min-height` floor and an exact-height
    `--lr-date-input-control-height` hatch on the input row (it previously had neither). The calendar
    toggle keeps its own 24x24 touch target even when the height hatch pins a shorter row.
  - **`lr-known-date`:** adds a per-tier `--lr-known-date-field-min-height` floor and an exact-height
    `--lr-known-date-field-height` hatch on each field input.
  - **`lr-chip`:** the interactive tap-target floor is now the per-tier `--lr-chip-min-height` (was a
    single hardcoded `1.5rem` shared by every tier), and a new `--lr-chip-height` hatch pins an exact
    height. Interactive chips keep the 24px WCAG 2.2 SC 2.5.8 minimum at every tier; a `--lr-chip-height`
    below that is for non-interactive chips only.
  - **`lr-pagination`:** the nav buttons' and page input's inner padding is now the
    `--lr-pagination-control-padding` knob (was a hardcoded `var(--lr-space-xs)`), kept uniform across
    tiers so current rendering is unchanged.

  All new knobs default to today's exact values, so unset consumers render byte-identical at every
  tier (the `lr-avatar` `sm`/`lg` font-size fix is the sole deliberate exception).

- 6ab596d: `<lr-split>`: `rail-breakpoint` and `float-breakpoint` now accept a CSS length (`'640px'`,
  `'68.75rem'`, `'3em'`) as well as the original bare pixel number, and a new
  `collapse-breakpoint-basis="viewport"` measures both against the viewport via `matchMedia` instead
  of the split's own `[part="base"]` allocation — for collapsing in step with a page-level `@media`
  layout. Both thresholds are classified together on every change, so a fast resize crossing both at
  once still lands on one correct state and fires `lr-split-collapse-change` once; under viewport
  basis the first paint already carries the right `data-collapse-state` with no `ResizeObserver`
  round-trip, and that initial state is not announced as a transition. Note `(max-width:)` is
  inclusive while container basis compares strictly `<`, so switching basis shifts each crossing
  point by 1px. An unparseable length (`'80vw'`, `'calc(…)'`, garbage) falls back to the documented
  `640`/`400` defaults rather than switching collapse off, and the "rail must sit above float"
  invariant is still enforced, in pixel space, under both bases.

  Because both properties now accept a string, they use Lit's default string converter: reading
  `el.railBreakpoint` after `rail-breakpoint="640"` returns `'640'` rather than `640` (matching how
  `orientationBreakpoint` already behaves). Authored values and crossing behavior are unchanged.

- e1d4af8: `lr-stat` gains two layout axes and stops reserving space for an absent label.

  - `appearance="card" | "plain"` (default `card`, reflected). `plain` removes the border,
    background, padding, corner radius and the `block-size: 100%` stretch, so a stat can sit inline
    in prose, a toolbar or a table cell instead of only as a card. A `plain` stat with a safe `href`
    underlines its `[part="value"]` on hover/focus, since the card's border-color-shift affordance is
    invisible with no border; the focus ring is unchanged. `plain` also wins over `compact` when both
    are set, and drops `emphasis`'s accent edge (card chrome) while keeping its brand value tint.
  - `orientation="vertical" | "horizontal"` (default `vertical`, reflected). `horizontal` lays label,
    value + unit, trend, sub and caption out on a single wrapping baseline row; `[part="spark"]` and
    `[part="rows"]` stay stacked on their own full-width line beneath it.
  - `[part="label"]` is now `hidden` whenever `label` is empty, so a label-less stat no longer leaves
    a blank gap above its value. A non-empty label is never hidden and its `aria-labelledby` pairing
    with `[part="value"]` is unchanged.

- 3312708: Add component-scoped CSS custom properties for state styling across thirteen conversation, retrieval, viewer and media components. Each of these components previously painted a selected/active/current state straight from a library-wide `--lr-color-*` token, which left the state unrestylable from outside: `::part(x)[data-active]` is invalid CSS, so the only lever was hijacking the shared token — repainting every other surface on the page that read it.

  Every new property uses the inline `var()` fallback form and is deliberately **not** declared on `:host`, so a value set on the element or any ancestor is honoured rather than shadowed. With none of them set, rendering is byte-identical to before.

  - `lr-conversation-item` — `--lr-conversation-item-active-bg`, `--lr-conversation-item-active-color`
  - `lr-push-to-talk` — `--lr-push-to-talk-recording-color`
  - `lr-chunk-inspector` — `--lr-chunk-inspector-current-bg`, `--lr-chunk-inspector-current-color`
  - `lr-retrieval-results` — `--lr-retrieval-results-selected-border`
  - `lr-retrieval-trace` — `--lr-retrieval-trace-active-border`
  - `lr-source-picker` — `--lr-source-picker-checked-bg`, `--lr-source-picker-checked-border`, `--lr-source-picker-mixed-bg`
  - `lr-page-rail` — `--lr-page-rail-current-bg`
  - `lr-notebook-viewer` — `--lr-notebook-viewer-active-bg`
  - `lr-svg-viewer` — `--lr-svg-viewer-active-border`
  - `lr-document-preview` — `--lr-document-preview-active-border`
  - `lr-xml-viewer` — `--lr-xml-viewer-active-match-color`
  - `lr-av-player` — `--lr-av-player-marker-active-color`, `--lr-av-player-cue-current-bg`, `--lr-av-player-cue-active-match-color`
  - `lr-image-viewer` — `--lr-image-viewer-annotate-active-bg`, `--lr-image-viewer-annotate-active-border`, `--lr-image-viewer-highlight-active-color`

  `--lr-conversation-item-active-*` and `--lr-chunk-inspector-current-*` are documented as contrast-sensitive pairs: each background is half of a WCAG-AA dependency with the text color rendered on it.

  Also fixes a WCAG-AA contrast failure in `lr-chunk-inspector`: the current (`active-id`) chunk's score line rendered in `--lr-color-text-quiet`, which reaches only ~4.24:1 against the `--lr-color-brand-quiet` current-row background — under the 4.5:1 floor for normal-size text. It now uses full-strength text while current, matching the identical fix already carried by `lr-attachment-chip`, `lr-chat-message` and `lr-conversation-item`. Non-current rows keep the quiet treatment.

- 5e9a18e: `lr-table`: keep focus inside a persistent (`editable: 'always'`) cell editor when the rows are
  re-sorted underneath it. Row rendering is keyed by row key, so a re-sort _moves_ the editor's
  `<input>` node — the typed value rides along, but a DOM move drops focus on its own — so the table
  now records the focused editor's cell and restores focus to it after the move. A row that has left
  the rendered set entirely (paginated away, filtered out) only clears the record: focus is not yanked
  to whichever unrelated row now occupies that position.
- 5e9a18e: `lr-table`: give a persistent (`editable: 'always'`) cell editor its own Enter/Escape semantics.
  Enter commits and keeps focus in the field rather than closing an editor that has no closed state,
  and Escape — which has nothing to cancel back to — is no longer cancelled, so an ancestor
  dialog/popover still acts on it. A double-click editor's Enter-commits-and-closes and
  Escape-cancels behavior is unchanged. Adds the accompanying `AlwaysOnEditors` story.
- 5e9a18e: `lr-table`: widen `TableColumn.editable` to `boolean | 'always'`. `true` keeps today's
  double-click-to-open editor unchanged; the new `'always'` renders a persistent editor in every body
  cell of that column from first paint, for settings/rate-style grids where double-clicking each cell
  to change a value is the wrong interaction. Persistent editors are plain tab stops (no `tabindex` of
  their own), exactly like the existing row-expand toggle, so the roving header/row tabindex model is
  untouched; each one keeps its individually interpolated `tableEditCell` accessible name, and
  double-clicking an `'always'` cell no longer opens a second, competing editor inside it.
- 5e9a18e: `lr-table`: a persistent (`editable: 'always'`) cell editor binds its `value` as a content attribute
  rather than as the `.value` property, so native dirty-value-flag semantics apply — an out-of-band
  `rows` update to a cell the user has already typed into no longer replaces the draft they are still
  editing, while an untouched editor still picks up a new `rows` value normally. Double-click editors
  (`editable: true`) keep the property binding and its deliberate re-assert, unchanged. `lr-cell-edit`
  remains the only mutation channel; the table still never mutates `row`.
- 43ee7d0: `lr-table`: the empty state is now addressable, cells can carry a native tooltip, `table-layout` is
  settable, and the selected row has its own background custom property.

  - Every built-in `<lr-empty>` the table renders carries `part="empty"` and re-exports its own inner
    parts as `empty-base`/`empty-icon`/`empty-heading`/`empty-description`/`empty-actions`, so the
    empty state can be restyled from outside without replacing it. Note that the no-columns and
    no-rows states return the empty element as the shadow root's own root, so `::part(base)` does not
    apply in those two states — only in the filtered-to-zero one.
  - A new `empty` slot replaces the built-in empty state wholesale on the two _data_-empty branches
    (no rows at all, and filtered/paginated down to zero). The no-columns branch keeps its own
    `noColumnsHeading` copy and is deliberately not slot-replaceable — it reports a configuration
    problem, not an empty result set.
  - New `emptyCompact` property (`empty-compact` attribute) overrides the built-in empty state's
    `compact` density. Left unset it preserves today's per-branch behaviour exactly: spacious for the
    whole-table states, compact for the in-table filtered-to-zero one.
  - New `columns[].cellTitle(row)` renders the generated `<td>`'s native `title`, symmetrical with
    `cellStyle`. Returning `undefined` or an empty string omits the attribute entirely rather than
    rendering `title=""`, which would suppress an ancestor's own tooltip, and the attribute is
    suppressed while that cell is in inline-edit mode so the tooltip cannot shadow the editor. Some
    screen readers announce a `<td title>` as the cell's accessible name, so use it only for a longer
    form of what the cell already shows.
  - New `layout: 'auto' | 'fixed' = 'auto'` property (reflected) sets a floor for the table's
    `table-layout`. `fixed` applies the fixed algorithm even with no column widths declared; the
    default `auto` still resolves to fixed whenever a column declares a `width` or a drag-resize is in
    flight, since resizing does not work under `table-layout: auto`. Under `fixed` with no declared
    widths the first row determines every column's width — so revealing a `priority`-hidden column
    re-measures all of them — and `columns[].minWidth`/`maxWidth` are ignored by the fixed algorithm.
  - New `--lr-table-row-selected-bg` custom property (default `var(--lr-color-brand-quiet)`) recolors
    the `aria-selected` row. Shadow Parts forbids an attribute selector after `::part()`, so
    `::part(row)[aria-selected]` is invalid CSS and the selected row could previously only be
    restyled by overriding the library-wide brand-quiet token. Unset, rendering is unchanged.

- 437bef5: `lr-table`: add a skeleton loading mode. A new `loadingAppearance: 'spinner' | 'skeleton'`
  property (attribute `loading-appearance`, default `'spinner'` — unchanged output) controls how
  `loading` renders. `'skeleton'` keeps the real `<colgroup>`, `<thead>`, filter field and
  pagination footer in place and fills the table body with placeholder `<lr-skeleton>` rows, so a
  cold load sketches the grid's shape and holds its column geometry instead of collapsing to a
  spinner and reflowing when the rows arrive. The placeholder row count comes from the new
  `skeletonRows` property (attribute `skeleton-rows`, default `0` = derive from the normalized
  `pageSize`, capped at 20, else 3). Exactly one `role="status"` live region announces the load —
  each placeholder opts out of its own announcement, so there is no per-cell live-region storm. A
  `priority`-hidden column is given no visible placeholder cell. New `skeleton` CSS part targets the
  placeholders.
- bc8cb8b: Make the focus-ring and icon-button-size tokens themeable from an ancestor, and fill out
  `theme.css` with the inputs it was missing.

  `--lr-focus-ring-width`, `--lr-focus-ring-offset` and `--lr-icon-button-size` were the only
  three tokens declared as bare literals instead of chaining through a `--lr-theme-*` input.
  That made them the only tokens genuinely unreachable for subtree theming: a `--lr-*` token is
  re-declared on **every** `LyraElement`'s `:host`, so a value set on an ancestor is shadowed at
  the first intervening lyra host and never reaches anything nested inside it. `--lr-theme-*`
  inputs are declared only at `:root` (in `theme.css`) and never in component shadow styles, so
  they _do_ inherit through nested shadow roots — which is why the bridge is the supported route.
  The three tokens now read `--lr-theme-focus-ring-width`, `--lr-theme-focus-ring-offset` and
  `--lr-theme-icon-button-size`, with their existing values as fallbacks, so nothing renders
  differently by default.

  Keep a resolved `--lr-theme-icon-button-size` at or above 24px: it backs the hit area of
  `lr-date-input`, `lr-combobox`, `lr-input` and `lr-select`, and anything smaller fails
  WCAG 2.2 SC 2.5.8 (Target Size (Minimum)).

  `src/theme.css` also gains the type scale, spacing scale, stacking layers, chart palette,
  the 16 ANSI terminal slots, the raised surface and both overlay scrims as real inputs — every
  one set to the exact value it already fell back to, so importing the sheet changes no computed
  value. Two fixes came with that:

  - `.lr-dark` never set `--lr-theme-color-surface-raised`, so a `.lr-dark` page rendered raised
    surfaces at the light `#f6f8fa` while `prefers-color-scheme: dark` rendered them at `#22272e`.
    The dark block now mirrors the raised surface and the eight chart colors.
  - `--lr-color-overlay` and `--lr-color-overlay-strong` both read a single
    `--lr-theme-color-overlay` input, so defining that input flattened the strong scrim's `0.92`
    onto the plain scrim's value. `--lr-color-overlay-strong` now has its own
    `--lr-theme-color-overlay-strong` input, chained through the old one so a theme that sets only
    `--lr-theme-color-overlay` still tints both exactly as before.

- e9c4f22: `lr-thread-list` forwards a `compact` row density

  A reflected boolean `compact` (default `false`) that sets `compact` on every data-mode row
  `<lr-conversation-item>`, mirroring how `editable` is already forwarded — the one-attribute way to
  tighten a whole sidebar, where previously the only lever was styling `::part(row-item-base)` and
  `::part(row-item-title)` by hand. The density itself lives on the row item; this property only
  forwards it, so both components stay in sync from one implementation.

  Slotted mode (empty `threads` _with_ real slotted content) is a documented no-op: that mode renders
  host-supplied `<lr-conversation-item>`s as-is, so the host sets `compact` on its own items there —
  the same division of responsibility slotted mode already has for every other row property.

- b9d78b7: `lr-thread-list` now forwards the row `<lr-conversation-item>`'s own CSS parts out of data mode under
  a `row-item-*` namespace: `row-item-base`, `row-item-option`, `row-item-leading`, `row-item-content`,
  `row-item-title`, `row-item-title-input`, `row-item-rename-button`, `row-item-excerpt`,
  `row-item-meta`, `row-item-timestamp` and `row-item-actions`.

  Data mode builds each row itself, two shadow roots down, so until now none of those eleven parts were
  reachable from outside — including the two declarations that set row height. Row density could only
  be changed with `lr-thread-list::part(row) { --lr-theme-space-s: … }`, a whole-subtree retheme that
  also shrank everything nested in the row (a `renderActions` menu's items dropped below the
  touch-target floor and had to be un-retheme'd inline). `lr-thread-list::part(row-item-base)
{ padding-block: … }` now sets row density with no token override and no collateral damage.

  The existing `row-leading`/`row-content`/`row-meta`/`row-actions`/`row-wrapper` parts are unchanged;
  they wrap this component's render-callback output, which is a different surface from the item's own
  internals. Purely additive: an unstyled thread list renders identically.

- 9010a89: `lr-thread-list` exposes a `row-wrapper` CSS part around `wrapRow` output.

  `wrapRow` was the one row hook with no library-added part -- `renderLeading`, `renderRowContent`,
  `renderMeta` and `renderActions` each get a `row-*` wrapper, so a host wrapping a whole row had to
  thread its own class through the callback to lay it out. Its return value is now placed inside a
  `part="row-wrapper"` block `<div>`, reachable from outside as `lr-thread-list::part(row-wrapper)`.

  The wrapper is deliberately unstyled and block-level, and is added only when `wrapRow` is set: the
  box the internal `lr-virtual-list` measures for windowing is its own `[part="row"]` one level up,
  and an unstyled block box contributes exactly its child's height to it, so measured row heights are
  unchanged. The part is row-only -- group headers never pass through `wrapRow` and never carry it.

- 81af4b0: Add `sticky-groups` to `lr-thread-list`: the current date/custom group's header stays pinned to the
  top of the scroll viewport while its rows are in view, and is pushed off as the next group's header
  arrives. Group headers are ordinary virtualized rows, so this renders an `aria-hidden` copy into
  `lr-virtual-list`'s sticky layer — the real row keeps the `role="heading"` semantics and the tab
  order, while the pinned copy stays clickable and requests the same `lr-group-toggle` collapse. The
  band is exported as `::part(group-sticky)`, and the copy renders the same
  `group-header`/`group-toggle`/`group-label`/`group-icon` parts as the real header, so existing
  header styling applies to both. Default `false` renders exactly as before.
- 81af4b0: Remove `lr-thread-list`'s reach into the internal `lr-virtual-list`'s shadow root. Arrowing past the
  rendered window now scrolls through the child's public `scrollContainer` and waits for its
  `lr-scroll` notification before moving focus, instead of mutating the scroll position of an element
  found by querying the child's render root and then dispatching a fabricated `scroll` event at it —
  which also raced the child's re-render rather than following it. Row lookup goes through a new
  `lr-virtual-list.renderedRows` accessor (the currently-windowed `[part="row"]` wrappers, in item
  order), added because a windowed list gives a host no other way to reach a row that may not have
  existed a frame earlier; `exportparts` forwards styling, not element references.
- cea6d8e: `lr-token-input` can now edit a token in place. Set `editable` and each token becomes a roving tab
  stop that opens an inline editor on click, Enter, or F2: Enter commits and emits
  `lr-token-edit` with `{ value, previousValue, index }`, Escape reverts silently, and a blur commits
  without stealing focus back. New `token-label` and `token-editor` CSS parts (rendered only while
  `editable` is set) and a `--lr-token-input-editor-inline-size` custom property style the two states;
  with `editable` unset the token row renders exactly as before and stays non-focusable.

  `delimiter` now accepts `null` — as a property, or via `delimiter="none"` / `delimiter=""` — so a
  token may contain commas verbatim (`Bash(git status:*)`): nothing is split and no keystroke is
  treated as a commit key. Removing the attribute restores the `,` default, and an empty delimiter no
  longer explodes a draft into one token per character.

- 0a5666d: `<lr-tree>` gains a `reorderable` opt-in for keyboard reordering. With it set, Ctrl/Cmd+ArrowUp /
  Ctrl/Cmd+ArrowDown on the focused row emits `lr-reorder` with
  `detail: { id, parentId, fromIndex, toIndex }` — sibling-scoped indices within the node's own
  parent's child list (`parentId` is `null` for a top-level item), so a reorder can never turn into
  a reparent at a subtree boundary. The keybinding matches `<lr-dashboard-grid>`'s existing
  `cells-draggable` keyboard move; Alt+Arrow was avoided because it is browser back/forward on
  Windows and Linux. `data` stays host-owned — the event is a request, and the move is announced
  through an internal `<lr-live-region>` (new `treeNodeMoved` message key).

  Also fixes a pre-existing focus bug this surfaced: reassigning `data` in a way that merely
  _re-indexes_ the focused node (rather than removing it) dropped real DOM focus to `<body>`.
  Focus now follows the node, including for nested rows several shadow roots down.

  `reorderable` is `false` by default — unset, markup and keyboard behaviour are unchanged and no
  `lr-reorder` is ever emitted. `<lr-file-tree>` deliberately does not forward it: its tree items are
  derived from `nodes` and keyed by filesystem path, an order it does not own.

- 8774f0d: Add `lr-virtual-list` position queries: `offsetForIndex(index)` returns the pixel top row `index`
  renders at (clamped to `0…items.length`, so `offsetForIndex(items.length)` is the total content
  height), and `indexAtOffset(px)` returns the row whose box contains that offset (`-1` for an empty
  list). Both work in the same coordinate space as the scroll container's `scrollTop`, so a host can
  do scroll-linked layout without duplicating the windowing math; in `row-height="auto"` mode an
  unmeasured row's offset stays estimate-based until its `ResizeObserver` measurement lands.
- 8774f0d: Add `lr-virtual-list`'s sticky group header layer. Setting `renderStickyGroup` renders a
  `[part="sticky-group"]` overlay pinned to the top of the scroll viewport showing whichever `groups`
  entry the viewport is currently inside, pushed out by the overlap as the next group's header arrives
  rather than swapped abruptly. Native `position: sticky` on the rows themselves is structurally inert
  here, since every row is absolutely positioned and transform-offset by the windowing math.

  The overlay is a visual copy of content that already exists in the list, so it is `aria-hidden`, its
  ordinary focusable content is forced to `tabindex="-1"` (the real row keeps sole ownership of the
  heading semantics and of the tab order), and it is `pointer-events: none` until a consumer opts in
  with `lr-virtual-list::part(sticky-group) { pointer-events: auto; }`. It is measured by its own
  `ResizeObserver` and never by the row observer, so a group header that is also a real row is not
  double-counted in `row-height="auto"` mode. A `groups` entry whose `label` is the empty string now
  renders no `[part="group"]` marker — it is a pure position anchor, for a host that renders its own
  group headers as rows. With `renderStickyGroup` unset, nothing about the rendered output changes.

- 8774f0d: Add `lr-virtual-list`'s public `scrollContainer` getter (the `[part="base"]` scroll box, `undefined`
  before the first render) and an `lr-scroll` event (`detail: { scrollTop, viewportHeight }`). The
  event is emitted from the animation frame that already coalesces native `scroll` events, so a burst
  of them produces at most one `lr-scroll` per frame and none at all when the position did not change.
  Together they let a host follow _sub-row_ scroll movement — which `lr-visible-range-changed`, firing
  only on index-range changes, cannot report — without reaching into the component's shadow root or
  dispatching synthetic `scroll` events at it.

### Patch Changes

- 2e16fad: Fix `lr-artifact-panel`'s restore/copy/download header buttons rendering fully raw browser chrome
  (zero CSS at all) while the adjacent header buttons in the same row are fully themed, and give
  view-button its own hover/focus-visible to match its version-previous/version-next siblings.
- c2ddee5: Fix `lr-av-player`'s playback-rate `<select>` rendering raw browser chrome with an unthemed
  (typically white) option popup regardless of theme -- it now resets native appearance, themes its
  option list, and gains hover/focus-visible states and a decorative chevron in place of the removed
  native one.
- db4e0a5: Fix `lr-calendar`'s previous-month nav button never matching its own styling rule (it rendered with
  raw browser button chrome next to a fully themed next button) and add missing `:hover`/`:focus-visible`
  treatment to the nav buttons, day-grid cells, and agenda-event buttons.
- bfaf7f9: `lr-checkbox-group`: document `value` as a read-out of child state, and warn on the two ways it is
  misused.

  `value` shipped with no documentation at all while the generated docs listed it among settable
  properties, so it read as an input. It never was one: `sync()` recomputes it from the
  `<lr-checkbox>` children and assigns it on every child toggle, `slotchange`, `name`/`required`
  change, blur and `form.reset()` — and `connectedCallback()` syncs _before the first render_, so even
  a constructor-time or template-time `.value=` binding is discarded before it is ever observed. It
  now carries that contract in its JSDoc, and:

  - assigning `value` from outside logs a `console.warn` naming the property and pointing at `checked`
    on the children (once per element — a repeat assignment is the same mistake, not new information);
  - a group with two or more children sharing a `value` logs a `console.warn` too. This is the _easy_
    mistake, not an exotic one: `<lr-checkbox>`'s `value` defaults to `'on'`, so five undifferentiated
    children yield `['on','on','on','on','on']` and a `FormData` that cannot say which was checked.

  Both warnings follow the same plain-`console.warn` shape as the library's other authoring-mistake
  warnings (`lr-task-list` over-nesting, `lr-dashboard-grid` unmatched `cell-id`, `lr-flow-canvas`
  unrecognized child). No behavior changed for the normal children-drive-value flow, which warns not
  at all.

  `value` was deliberately **not** made authoritative. Push-down is unimplementable without surprise
  while children default to `value = 'on'` (a host assigning `['on']` would check every
  undifferentiated child), and it would additionally need a re-entrancy guard and a pending-value
  retention path for children that have not upgraded yet. Recorded here so a later release can add a
  distinct `defaultValue` API without reversing anything documented now.

- 2a45da4: Fix four components (`lr-chunk-inspector`, `lr-community-card`, `lr-provenance-panel`,
  `lr-notebook-viewer`) whose real `<button>`s get UA-chrome reset (`border:none; background:
transparent; cursor:pointer;`) but no hover or focus-visible of their own -- `lr-provenance-panel`'s
  disclosure header (`aria-expanded`/`aria-controls`) had zero visible keyboard focus indicator at all.
- 1d121a9: Fix `lr-code-block`/`lr-code-block-core`'s shiki dark-theme override only activating on the OS-level
  `prefers-color-scheme` media query -- a consumer who sets `--lr-theme-color-*` explicitly, without the
  OS itself being in dark mode, now correctly gets the dark shiki syntax theme too, matching every other
  `--lr-color-*` token's consumer-overrides-first resolution.
- 1372546: Fix `lr-color-picker`'s native color swatch -- the directly visible, directly focusable control --
  having no hover or focus-visible treatment, so tabbing to it fell through to the browser's raw
  default color-input focus ring.
- f8bc916: `lr-combobox`: the `clearable` button now covers the filter axis as well as the selection.

  Typing a query that matches nothing left the user with no affordance to clear it — the button was
  gated on a committed selection alone, and `clear()` early-returned on an empty selection. It now
  renders whenever there is something to clear on either axis, and each axis announces only its own
  change: clearing a selection still emits `input`/`change`/`lr-clear`, while clearing filter text
  emits `lr-filter` with an empty `value` and no spurious selection events.

  The query half of the gate is scoped to states where the query is actually visible — the open
  listbox in single-select, or any time in `multiple` mode. A closed single-select shows the selected
  label rather than the query, so a stale query alone never surfaces a button offering to clear text
  the user cannot see.

- 77bfb28: Fix `lr-data-grid`'s sort-header focus ring targeting `<th>`, which can never itself receive
  keyboard focus (only its nested sort button can) -- tabbing to a sortable column header now shows
  the library's focus ring instead of the browser's raw default, and the sort button gains a
  matching hover state.
- dfd6199: Fix `lr-date-picker`'s previous/next month-nav buttons having a hover state but no focus-visible ring
  -- the file's only focus-visible coverage was on day cells, leaving keyboard users with no visible
  indicator on the nav buttons.
- 7c99e80: Route several stray hardcoded style values through design tokens so visually-identical states stay
  in sync across components:

  - **Disabled controls** in `lr-node-palette`, `lr-flow-controls`, `lr-compare-panel`,
    `lr-graph-query-builder`, and `lr-rubric-form` now dim through the shared `--lr-opacity-disabled`
    token instead of one-off `0.4`/`0.5`/`0.6` literals, so every disabled control fades by the same
    amount (and rethemes with one property).
  - **Anchored popovers/menus/tooltips** (`lr-menu`, `lr-select`, `lr-combobox`, `lr-date-input`,
    `lr-model-select`, `lr-voice-picker`, `lr-mention-popover`, `lr-export-button`, `lr-tour`,
    `lr-tool-call-chip`, `lr-usage-badge`, `lr-citation-badge`, `lr-entity-chip`,
    `lr-knowledge-graph-explorer`) share a new `--lr-popover-viewport-clamp` token (default `92vw`,
    themeable via `--lr-theme-popover-viewport-clamp`). Previously these split between `92vw` and
    `90vw`, so two popovers side by side could clamp to different widths; they now clamp consistently.
  - **Solid-fill hover lift** on `lr-chat-composer`, `lr-tool-approval-dialog`, `lr-message-feedback`,
    `lr-tour`, and `lr-retrieval-search` now shares a new `--lr-hover-brightness` token (default
    `1.08`, themeable via `--lr-theme-hover-brightness`), replacing per-component `filter: brightness()`
    magic numbers. Note `lr-retrieval-search`'s submit button now _brightens_ on hover like every other
    brand button, where it previously darkened (`0.92`).
  - `lr-calendar`'s narrow-container day-cell floor now references the existing `--lr-size-4rem` token
    instead of a raw `4rem`, matching its wide-container sibling.

  Also adds a new consumer override hook: `--lr-responsive-panel-sheet-max-block-size` (default `85dvh`,
  falling back to `85vh` where `dvh` is unsupported) lets you set the maximum height of an
  `lr-responsive-panel` `variant="bottom-sheet"` overlay, which previously had no override at all.

- ac5936a: Fix `lr-details`' summary -- the component's real, natively-focusable/clickable surface -- having no
  hover or focus-visible treatment at all. `lr-accordion-item` (which extends `lr-details` with no
  style override) is fixed by the same change.
- 188335c: Sync the consumer-facing agent reference (`llms/`) with the part-reachability, density and composed
  -content work that just landed across the viewers, media, retrieval, agent-tools, layout,
  conversation and data families.

  - Document the newly forwarded and newly named CSS parts on `lr-pdf-viewer`, `lr-archive-viewer`,
    `lr-page-rail`, `lr-notebook-viewer`, `lr-csv-viewer`, `lr-spreadsheet-viewer`,
    `lr-dataset-viewer`, `lr-av-player`, `lr-terminal`, `lr-ingestion-queue`, `lr-neighbor-list`,
    `lr-chunk-inspector`, `lr-retrieval-results` and `lr-activity-feed`, including why row state is
    published as an extra part name rather than an attribute on the part.
  - Replace the paragraphs that described `--lr-page-rail-current-bg`,
    `--lr-notebook-viewer-active-bg`, `--lr-av-player-cue-current-bg` and
    `--lr-av-player-cue-active-match-color` as declared-but-inert; all four now take effect.
  - Document `--lr-csv-viewer-highlight-color` and `--lr-spreadsheet-viewer-highlight-color`, and
    `--lr-trace-tree-row-active-color` (plus the pairing rule it forms with
    `--lr-trace-tree-row-active-bg`, and the knock-on note under `lr-agent-trace`).
  - Document `lr-menu`'s `header`/`footer` slots and parts, the revised Escape/Tab keyboard contract,
    and the narrowed scope of `closeOnEscapeAnywhere`.
  - Document `lr-table`'s `columns[].editable: 'always'` persistent editors, `lr-flow-node`'s
    `compact` and `card` part, `lr-flow-controls`' and `lr-chat-composer`'s `appearance`, and
    `lr-conversation-item`/`lr-thread-list`'s `compact`.

- 2be1ad5: Sync the consumer-facing agent reference (`llms/`) with the sticky group-header work on
  `lr-virtual-list` and `lr-thread-list`.

  - Document `lr-virtual-list`'s `renderStickyGroup`, the `sticky-group` CSS part, and the four
    behaviors a consumer would otherwise get wrong: the band is `aria-hidden` with its focusable
    descendants forced to `tabindex="-1"` (so it is never a second tab stop or a second heading, and a
    focus-delegating custom element inside it must set its own), it is `pointer-events: none` until
    opted back in through `lr-virtual-list::part(sticky-group)`, it is never measured as a row, and it
    stays mounted but hidden above the first group so its scroll inset is measurable before the first
    jump.
  - Document that a `groups` entry with an **empty** `label` renders no marker and acts as a pure
    position anchor, and drop the stale claim that `groups` had no visible effect and that its marker
    carried `role="heading"`.
  - Document `offsetForIndex()`/`indexAtOffset()`, the `scrollContainer`/`renderedRows` getters, the
    `lr-scroll` event and its `VirtualListScroll` detail type, and add a sticky-group usage example.
  - Document `lr-thread-list`'s `stickyGroups` property (attribute `sticky-groups`) and the
    `group-sticky` exported part, including that the real header row keeps the
    `role="heading"`/`aria-level` semantics and the tab order while the pinned copy stays clickable.

- ed762ff: `lr-xml-viewer` treats `--lr-icon-button-size` as a floor

  `lr-xml-viewer`'s node `[part='toggle']` is an interactive button that pinned the shared
  minimum-target token as a fixed `inline-size`/`block-size` with `padding: 0` and no floor — the
  opposite of what the token's own definition documents ("components pad out to this via
  `min-inline-size`/`min-block-size`, not by growing the glyph itself"). It now sizes its glyph box at
  `--lr-size-1-25rem` with `min-inline-size`/`min-block-size: var(--lr-icon-button-size)`, mirroring
  `lr-code-block`'s equivalent toggle, so lowering the token shrinks the hit area but never squashes
  the chevron.

- 4c59cc2: Fix `lr-image-viewer`'s fit-mode `<select>` rendering raw browser chrome with an unthemed option
  popup, and add missing hover/focus-visible to all three toolbar controls (fit-control, rotate-button,
  annotate-toggle) -- previously none of the three had either state.
- 10c8b91: Fix `lr-input` (and `lr-time-input`, which renders through the same template/stylesheet) keeping
  native browser chrome in three cases: the search-cancel glyph only reset while `clearable` was set
  (the common non-clearable case kept it), `type="number"` never resetting the spin-button, and
  `type="time"` never touching its calendar-picker-indicator at all -- now restyled, not suppressed,
  since it's the only mouse/touch affordance to open the native time picker.
- 0410eb7: Fix two factual errors in the shipped agent-facing reference (`llms/shared.md`, and the
  `llms.txt`/`llms-full.txt`/`llms/` artifacts generated from it): the internals section stated
  `LYRA_PREFIX = 'lyra'` when the constant is `'lr'` — on the same line that correctly showed
  `tag(name)` producing `` `lr-${name}` `` — and claimed a hardcoded count of 127 `Lyra*EventMap`
  types when there are now 181. The count is no longer stated as a number, so it cannot drift again.
- 184bfff: `lr-menu`: axe coverage for a composed popup, stories moved onto the new `header`/`footer` slots,
  and the three shipped descriptions of what this component accepts finally agree.

  - New axe assertion for a menu with a `header` `<input>` and a `footer` `<button>` — the exact shape
    that was an `aria-required-children` violation while the only place for it was inside
    `role="menu"`, and which no test covered.
  - `show() / hide({ focusTrigger: true })`'s Apply button moves to `slot="footer"`, and the filter
    field gets a new `header`-slot story. The old default-slot filter story stays, relabelled as the
    legacy shape it now is, so its `closeOnEscapeAnywhere` behavior remains covered.
  - The class doc's `@slot` tag said "menu items and `<hr>` only" while the interaction contract two
    paragraphs above it promised slotted controls "keep their own full default keyboard behavior" and
    `show()`/`hide()` named a slotted Apply button as a supported case. All three now describe the
    same component.

- 3c8a299: Add missing `:hover` to six agent-tools components (`lr-browser-frame`, `lr-commit-card`,
  `lr-terminal`, `lr-test-results`, `lr-compare-panel`, `lr-confirm-bar`) whose interactive buttons
  already had `cursor: pointer` and a correct focus-visible ring but no hover affordance for mouse
  users.
- 4ac6c31: Add missing `:hover` to six components (`lr-stack-trace`, `lr-span-waterfall`, `lr-chat-viewport`,
  `lr-checkpoint`, `lr-push-to-talk`, `lr-transcript-feed`) whose interactive controls already had
  `cursor: pointer` and a correct focus-visible ring but no hover affordance for mouse users.
- 696cc7f: Add missing `:hover` to six components (`lr-env-list`, `lr-graph-query-builder`, `lr-rubric-form`,
  `lr-chart`, `lr-scroller`, `lr-widget`) whose interactive controls already had `cursor: pointer` and a
  correct focus-visible ring but no hover affordance for mouse users; `lr-chart`'s reset-zoom-button also
  gains `font: inherit`, which it was missing entirely.
- e1b9c22: Add missing `:hover` to six components (`lr-carousel`, `lr-dashboard-grid`, `lr-callout`,
  `lr-memory-panel`, `lr-neighbor-list`, `lr-path-strip`) whose interactive controls already had
  `cursor: pointer` and a correct focus-visible ring (where applicable) but no hover affordance for
  mouse users.
- e73a243: Add missing `:hover` to six components (`lr-retrieval-results`, `lr-pdf-viewer`, `lr-ebook-viewer`,
  `lr-pptx-viewer`, `lr-email-viewer`, `lr-dataset-viewer`) whose interactive controls already had
  `cursor: pointer` and a correct focus-visible ring but no hover affordance for mouse users.
- ae8e04e: Fix nine components (`lr-combobox`, `lr-eval-dataset`, `lr-command-palette`, `lr-table`,
  `lr-tool-select-dialog`, `lr-code-editor`, `lr-message-feedback`, `lr-model-select`, `lr-voice-picker`)
  whose native `<input>`/`<textarea>` themed background/color/border correctly but left `::placeholder`
  at the browser's fixed light-tuned default -- each field's placeholder text now uses
  `--lr-color-text-quiet`, with Firefox's reduced default `::placeholder` opacity undone on the
  `type="search"` fields.
- e649e77: Fix `lr-node-palette`'s search field being the only `type="search"` field in its family with zero
  focus-ring styling (its siblings `lr-thread-list`/`lr-emoji-picker` already wire this), and reset the
  native search-cancel glyph to match.
- e879ff6: Fix `<lr-split>` and `<lr-stepper>` reporting a stale `effectiveOrientation` (and
  `data-effective-orientation`) when `orientation-breakpoint-basis="viewport"` and the viewport
  crossed the breakpoint while the element was detached from the DOM. The media-query listener is
  torn down on disconnect and a plain reconnect schedules no Lit update, so the missed crossing was
  never noticed; reconnecting now re-reads the query and announces the crossing (including
  `lr-split-orientation-change` / `lr-stepper-orientation-change`) only when the matched state
  actually differs. A plain mount, and a reconnect that crossed nothing, stay silent as before.
- c2ea153: Fix `lr-pagination`'s page-input and `lr-tool-param-form`'s numeric JSON-schema fields rendering the
  native spin-button inside a fixed-size control box -- the adjacent prev/next buttons (pagination) and
  form validation (tool-param-form) already provide stepping, so removing the spinner loses no
  functionality.
- 94fa823: `lr-terminal`, `lr-ingestion-queue` and `lr-dataset-viewer`: forward the CSS parts rendered through
  their internal `<lr-virtual-list>` so a consumer can actually reach them.

  All three already styled those parts correctly from their own stylesheets, but none forwarded
  `exportparts` from the `<lr-virtual-list>` element. Because the rows are `renderItem`'s output and
  therefore live inside that element's own shadow root, a consumer rule like
  `lr-terminal::part(line)` matched nothing at all — the documented parts were unreachable from
  outside the component.

  - `lr-terminal` now exports `line`.
  - `lr-ingestion-queue` now exports `item`, `item-header`, `item-name`, `item-progress`,
    `item-meta`, `item-error`, `item-actions`, `retry-button` and `cancel-button`.
  - `lr-dataset-viewer` now exports `data-row`, `cell`, `cell-highlight` and `cell-highlight-action`.

  No styling changed and no new parts were added.

- 56f7b65: Add a build-time guard against `::part()` CSS that parses but never matches.

  Two classes of silently-inert rule are now caught by `pnpm lint` (a new
  `scripts/check-part-reachability.mjs` in the contract-policy chain), neither of which any existing
  check — TypeScript, the style policy, or a test that inspects stylesheet text — could see:

  - **`cross-root-part`** — a component that mounts `<lr-virtual-list>` and hands it a
    `renderItem`/`renderGroup` callback renders those rows into _that element's_ shadow root, so a
    bare `[part='x']` selector in the composing component's own stylesheet can never match them. The
    checker cross-references the literal part names emitted from the callback (following the class
    members it reaches) against the bare `[part]` selectors in the sibling `*.styles.ts`, and reports
    any name that has no `lr-virtual-list::part(x)` rule anywhere in that file. Components that
    legitimately render the same part into both roots — below/above a virtualization threshold, or a
    directly-rendered header row — carry both selectors and are not flagged; a
    `policy-allow(cross-root-part):` comment covers anything else.
  - **`part-compound`** — per Selectors L4 a pseudo-element may only be followed by pseudo-classes, so
    `::part(a)[attr]`, `::part(a).cls`, `::part(a) .descendant` and `::part(a) > .child` parse and
    then match nothing. Every `*.styles.ts` is scanned for those shapes; `::part(a):hover`,
    `::part(a)::selection` and the part-list form `::part(a b)` remain valid and pass.

  No component behavior changes; the library is clean under both rules today.

- cce32a2: `lr-neighbor-list`: make the virtualized relationship rows and group headers actually styleable, by
  this component and by a consumer.

  Above `virtualizeAt` the rows are produced by this component's `renderItem` but committed into the
  embedded `<lr-virtual-list>`'s own shadow root, one boundary deeper than a `[part='row']` selector
  can reach — so every row, node-label, direction, relation, meta and expand-button rule was silently
  inert and a large neighborhood rendered as raw browser `<button>`s with no dividers. Each rule now
  pairs its plain selector (still correct at/below the threshold) with an `lr-virtual-list::part(…)`
  twin, and an `exportparts` forwarding declaration makes the same parts reachable as
  `lr-neighbor-list::part(node-label)` etc. from a consuming stylesheet.

  Group headers were unstyled whenever the list virtualized: in that path the header is the internal
  virtual-list's own `group` part, which this component neither styled nor exported. It is now styled
  to match `group-header` and exported under that same name, so grouped rows present identically
  either side of the threshold.

  The virtualized rows no longer nest a second `role="listitem"`/`part="row"` element inside the
  virtual-list's own row wrapper. `renderItem` returns just the row's content, exactly as the
  non-virtualized path's own wrapper receives it: the duplicate nesting both reported a `listitem`
  inside a `listitem` and made the row's padding and divider border apply twice, since `::part()`
  matches at any depth of the target shadow tree.

- 1e518e6: Fix `lr-playback`'s range slider only getting a pointer cursor in its disabled state, unlike the
  adjacent play button, and add a matching hover affordance.
- 5e9a18e: `lr-table`: focus the cell editor that was actually just opened by a double-click. The autofocus
  looked up `[part="cell-editor"]` across the whole grid and focused whichever one came first in the
  DOM — indistinguishable from correct while only one editor could ever exist at a time, but wrong as
  soon as a column renders persistent (`editable: 'always'`) editors of its own. It is now scoped to
  the opening cell's own row and column.
- 326973c: Fix `lr-thread-list` and `lr-emoji-picker`'s otherwise fully-themed search fields showing a raw
  gray browser "x" glyph (with its own hit target and hover behavior, ignoring every token applied to
  the field) once non-empty.
- 9010a89: `lr-thread-list` and `lr-chat-viewport` now size their virtual list to their own height.

  Both composed an `lr-virtual-list` without ever setting `--lr-virtual-list-height`, so the list
  scrolled inside that token's 24rem default no matter how tall the surrounding pane was -- a
  `<lr-thread-list>` in a 700px sidebar showed a 384px scroller with dead space underneath, and every
  consumer had to hand-set `--lr-virtual-list-height` to work around it. Both now fill the height they
  are given with no consumer CSS. `lr-thread-list` degrades safely: in a container with no resolvable
  height the internal viewport still renders at exactly the 24rem it does today (the shipped default
  becomes the list's flex-basis rather than a percentage that would collapse to zero or grow to the
  full un-virtualized content height). `lr-chat-viewport`'s virtual mode uses a percentage -- the
  slotted list lives in the consumer's light DOM, out of reach of `::part()` -- so it, like slotted
  mode's own scroll container, needs a height-bounded parent. A consumer rule or inline style setting
  `--lr-virtual-list-height` on the list still wins in both components.

  Also fixes `lr-chat-viewport`'s virtual-mode layout rules, which were written as
  `:host(:has(> lr-virtual-list))`. `:has()` is invalid inside `:host()`, so those rules were silently
  dropped: in virtual mode `[part="scroll"]` kept the padding and `overflow-y: auto` it is documented
  to give up, and `[part="content"]` never got the height the slotted list sizes against.

- 3e1d4f8: Fix `lr-token-input`'s draft-input and inline token-editor leaving `::placeholder` at the browser's
  default color, and add missing `:hover`/`:focus-visible` to the per-token remove button.
- 67a7881: Cover `lr-trace-tree`'s active row with an axe assertion. The active-row test group previously
  carried a comment explaining why no accessibility assertion could be made there — the default tint
  put the row's own secondary text below the WCAG AA contrast floor, so any axe run against a
  populated active row would have failed. With that fixed, the assertion now runs for real: a
  populated tree is asserted accessible with each status tone in turn made active, after first
  proving the fixture actually reached the `[data-active]` state so the check cannot pass vacuously.
  It was verified to bite by reverting the fix and confirming axe reports the exact contrast
  violations it is meant to catch. The active-row Storybook story now sets
  `--lr-trace-tree-row-active-bg` and `--lr-trace-tree-row-active-color` together and documents why
  they are a pair.
- 67a7881: Fix `lr-trace-tree`'s active-row secondary text falling below the WCAG AA 4.5:1 contrast floor. The
  active (`activeSpanId`) row paints `--lr-color-brand-quiet`, against which `--lr-color-text-quiet`
  lands at ~4.25:1 — so `detail`, `duration`, `tokens-in`, `tokens-out`, `cost` and the `pending`
  status label were all failing while the row was active, even though every one of them passes
  comfortably against the plain row background. Those parts now render at full-strength
  `--lr-color-text` once the row is active (15.3:1 in light mode, 11.2:1 in dark), the same fix
  `lr-conversation-item` already carries for the identical bug. Darkening the active tint instead
  would have made it worse: every failing foreground is dark text.

  This changes default rendering on the active row, which is intended — the previous default was a
  real accessibility failure. The new `--lr-trace-tree-row-active-color` custom property retunes it;
  it pairs with `--lr-trace-tree-row-active-bg`, and a consumer setting that to a dark tint in light
  mode should set both, because the defaults assume the active background stays on the same side of
  the lightness midpoint as the ambient surface.

- 67a7881: Raise `lr-trace-tree`'s active-row status labels to clear WCAG AA without flattening their hue.
  `[part='status-text']` on the active row now renders
  `color-mix(in srgb, var(--lr-color-<tone>) 75%, var(--lr-color-text))` for each semantic tone —
  success moves from 4.46:1 to 6.18:1 and `denied` from 4.28:1 to 5.96:1 against the default active
  tint, while `error` and `running` (which only barely cleared the floor) gain headroom too. Keeping
  the hue matters: an error row that stops being red once selected loses the fastest scan signal in a
  trace list.

  The mix is applied to every semantic tone rather than only the two that fail at the shipped
  defaults, because a per-status carve-out is theme-fragile — a consumer retheming one `--lr-color-*`
  moves that ratio and would silently re-break. It is also theme-symmetric by construction:
  `--lr-color-text` flips with the color scheme, so the same declaration darkens the label in light
  mode and lightens it in dark mode. `[part='bar']` is deliberately untouched — it is a non-text
  graphic on a 3:1 floor it already passes, and scoping the mix to `[part='status-text']` avoids
  re-pointing a consumer's own `--lr-color-*` override inside one row.

- 4df6ca1: `lr-virtual-list` no longer traps a popup opened from inside a row underneath the rows that follow
  it. `[part="row"]` sets `will-change: transform`, which makes every row its own stacking context, and
  rows carried no `z-index` — so they painted in DOM order and each row painted over the previous one.
  A `lr-menu` dropdown rendered in a row (for example through `lr-thread-list`'s `renderActions`) was
  positioned, visible and hit-testable, yet painted _under_ the next rows: its own `z-index: 900` only
  orders siblings inside its row's context. The last row always looked correct, so small fixtures never
  caught it.

  `[part="row"]:focus-within` now lifts the row to `var(--lr-layer-content)` — the same layer
  `[part="group"]` already uses — for exactly as long as something inside it holds focus. This also
  stops outward focus rings on a row being clipped by later rows. Nothing changes when no row holds
  focus.

- 8774f0d: Keep `lr-virtual-list`'s scroll-into-view clear of the sticky group band. With `renderStickyGroup`
  set, the band's measured height is applied as `scroll-padding-block-start` on the scroll container —
  so native keyboard and anchor scrolling get the same treatment — and subtracted from the
  top-aligned targets `active-id` and `scrollToIndex({ align: 'start' })` compute, which otherwise
  parked the target row underneath the band. `align: 'end'` is unaffected, since the band never
  covers the viewport's bottom edge. With `renderStickyGroup` unset the inset is zero and both scroll
  paths behave exactly as before, with no inline style on the container at all.

## 5.1.0

### Minor Changes

- 5f82bf7: Add role-scoped bubble cssprops to `lr-chat-message` — `--lr-chat-message-bubble-bg`,
  `--lr-chat-message-bubble-color`, `--lr-chat-message-user-bubble-bg`, and
  `--lr-chat-message-user-bubble-color` — so a consumer can retint one role's bubble fill/text
  without overriding the shared `--lr-color-brand-quiet`/`--lr-color-surface`/`--lr-color-text`
  tokens, which also drive unrelated parts of the component (e.g. `[part="collapse-button"]:hover`).
  All four default to exactly the values the bubble already used, so nothing changes for existing
  consumers who set none of them.
- abd60dd: `lr-stepper`'s `orientation-breakpoint` now accepts a CSS length, not only a bare pixel number:
  `500`, `'500'`, `'500px'`, `'31.25rem'` and `'3em'` are all valid, and equal computed values behave
  identically.

  `rem` resolves against the **document root**'s computed font size — exactly as a `rem` in a CSS
  `@media` query does, and deliberately _not_ against the stepper itself — so a breakpoint authored in
  `rem` stays numerically in step with the sibling `@media (max-width: …rem)` rule it has to agree
  with, instead of silently drifting from it when the root font size changes (browser zoom, a user
  font-size preference, an app base-size token). `em` resolves against the stepper's own computed font
  size. The length is re-resolved on every measurement and never cached, so those changes are picked
  up without any invalidation step on the consumer's side.

  A value that isn't a usable length — `%`, `vw`, `calc()`, `'auto'`, an unparseable string — now
  behaves exactly as unset: no `ResizeObserver` is armed and no `data-effective-orientation` attribute
  appears, rather than arming a breakpoint that can never be crossed. For a viewport-relative
  breakpoint, leave `orientationBreakpoint` unset and drive `orientation` from your own `matchMedia()`
  controller; `orientationBreakpoint` measures the stepper's own allocated inline size, not the
  viewport.

  The property's TypeScript type widens from `number | undefined` to `number | string | undefined`,
  and the `orientation-breakpoint` attribute is no longer coerced through Lit's `Number` converter.
  Every existing numeric usage — attribute or property — is unaffected. This mirrors the identical
  change to `lr-split`, whose `orientationBreakpoint`/`narrowOrientation` contract `lr-stepper`
  deliberately shares.

- 22cb935: `lr-heatmap` gains a `legendStops` property so the built-in legend can describe a custom
  `cellColor` domain. Because `cellColor` overrides a cell's color entirely, the legend's
  `--lr-heatmap-scale-lo`/`-hi` gradient bar could describe a ramp the grid no longer used, leaving a
  consumer to hide `::part(legend)` and hand-roll swatches.

  `legendStops: HeatmapLegendStop[]` (`{ value, color, label? }`, `attribute: false`) renders a
  discrete key **instead of** that gradient bar — one `[part="legend-stop"]` per entry in array order,
  each a `[part="legend-swatch"]` in the entry's color plus a `[part="legend-stop-label"]`. Labels
  default to the component's own locale-aware numeric formatting of `value`, so an explicit `label` is
  only needed when the number isn't the right caption. `[part="legend-lo"]`/`[part="legend-hi"]` and
  the bar are omitted while stops are supplied; labeled `annotations` still render their
  `[part="legend-annotation"]` entries alongside them.

  The stops are presentation only — they never feed back into the color ramp, the bucket math, the
  tooltip or the accessible name. Left unset (or empty), the legend renders exactly as before.

- ce2a423: `lr-combobox` now emits `lr-filter` (`detail: { value: string }`) on every user-driven change to its
  in-progress filter text, so consumers that need the live as-you-typed string — a "no matches for
  “x”" empty state, a debounced side effect — no longer have to reach into the component's shadow DOM
  for `[part="combobox-input"]`.

  The name is deliberately not `lr-input`: on `lr-combobox` the host's `value` is the _committed
  selection_, so reusing `lr-input`'s event name would make one event name carry a different string on
  different components. `lr-filter` fires for user input only — picking a row, the clear button,
  `form.reset()`, dismissing the listbox, a programmatic `value` write and `setRangeText()` all blank
  the filter silently, mirroring how `<lr-input>`'s `lr-input` only reports user edits.

  The `ComboboxFilterDetail` detail type is exported and `LyraComboboxEventMap` carries the new entry,
  so `addEventListener('lr-filter', …)` is typed.

- 7c46ced: `<lr-split>`'s `orientationBreakpoint` now accepts a CSS length string as well as a bare pixel
  number, so it can be authored in the same unit as the sibling CSS `@media` rule it has to agree
  with.

  Accepted forms: `900` / `orientation-breakpoint="900"` (unchanged), `'900px'`, `'56.25rem'`, and
  `'3em'`. `rem` resolves against the **document root**'s font size — exactly as a `rem` in a CSS
  `@media` query does, not against the element — so a breakpoint written to match
  `@media (max-width: 56.25rem)` stays in sync with it across browser zoom, a user font-size
  preference, or an app-level base-size change. `em` resolves against the split's own computed font
  size. The length is re-resolved on **every** measurement rather than cached at first render, so a
  root font-size change moves the crossing width with no invalidation step.

  Anything that isn't a resolvable length now behaves exactly as unset — no `ResizeObserver`, no
  `data-effective-orientation` marker — where before, a non-numeric attribute became `NaN` and armed
  observation for a threshold that could never be crossed. That deliberately includes `%`, `vw`/`vh`
  and `calc()`, which would mix a viewport-relative threshold into a measurement of the element's own
  allocation; drive `orientation` from your own `matchMedia()` controller for a viewport-relative
  breakpoint instead.

  One visible consequence of dropping the `Number` attribute converter: reading `.orientationBreakpoint`
  back after setting the attribute now returns the authored string (`'900'`), not the number `900`.
  The resulting layout behavior is identical, and the property type is now `number | string`.

- 2be0a50: `<lr-split>` gains `orientationBreakpointBasis` (`"container"` by default, `"viewport"`
  opt-in), selecting whether `orientationBreakpoint` is compared against the component's own
  measured inline size or a `matchMedia('(max-width: …)')` query. Viewport basis lets sibling
  components in one row flip orientation together at a single shared breakpoint — impossible
  to express with a self-measured threshold when the row stacks via a CSS `@media` rule — and
  lets the browser resolve a `rem` breakpoint with real media-query semantics. Left unset,
  behavior is unchanged.
- 96ea325: `<lr-stepper>` gains `orientationBreakpointBasis` (`"container"` by default, `"viewport"`
  opt-in), selecting whether `orientationBreakpoint` is compared against the stepper's own
  measured inline size or a `matchMedia('(max-width: …)')` query. Viewport basis is the only
  way a stepper with a fixed width in a row layout can react to that row stacking at a shared
  breakpoint. Left unset, behavior is unchanged.
- b1ce3f6: `lr-sequence-strip`: add `showLegend` for a persistent category key.

  The strip colors each cell by category, but the only way to read that mapping was to hover every
  cell one at a time — consumers were hand-rolling a swatch key underneath instead. `showLegend`
  (attribute `show-legend`, reflected, default `false`) now renders that key from the `categories`
  array the component already receives, as `legend` / `legend-item` / `legend-swatch` /
  `legend-label` CSS parts, with `--lr-sequence-strip-legend-swatch-size` to resize the chips.

  The legend is deliberately static — it lists every `categories` entry whether or not any item uses
  it, and toggles nothing (`lr-graph-legend` remains the interactive, filtering legend). Because it
  only repeats the category names the strip already announces through `[part="base"]`'s `role="img"`
  summary, the whole legend is `aria-hidden`: visible on screen, announced exactly once. Left unset,
  rendering is unchanged.

- 3127d5e: Restructure the AI-agent-facing reference so a component lookup costs a few hundred tokens instead
  of the whole catalog, and close the gaps that made it unreliable.

  **New published layout.** `llms/index.md` maps every tag to its import path and one-line purpose;
  `llms/components/<tag>.md` is a self-contained per-component reference addressed directly from the
  tag name; `llms/shared.md`, `llms/tokens.md`, `llms/peers.md` and `llms/migration.md` carry the
  library-wide contracts. `llms.txt` is now the entry index over all of it, and `llms-full.txt` keeps
  its role as the single-file concatenation. Everything is generated from per-family authored sources
  by `pnpm run llms` and diffed in CI, so the docs cannot drift from `custom-elements.json`.

  **Corrected documentation that was wrong, not merely missing:**

  - Import paths in the docs had not been updated for the family directory layout —
    `components/combobox/combobox.js` does not resolve; it is
    `components/forms/combobox/combobox.js`. CI now fails on any documented path that has no source
    module.
  - 26 components were documented twice with divergent content; the freshness check validated the
    weaker copy.
  - `lr-include` was documented with the wrong purpose, property semantics, event name and CSS parts.
  - Wrong or non-existent CSS parts on `lr-timeline`/`lr-timeline-item`, `lr-tour`, `lr-known-date`,
    `lr-random-content`, `lr-avatar-group`, `lr-breadcrumb`, `lr-swatch-picker`.
  - `lr-button` was missing the `quiet` appearance and the `2xs` size; `lr-attachment-trigger` was
    missing the `audio` capability; `lr-avatar` was documented as having no slots.
  - `lr-widget` event details are objects, not scalars; three overlay-color tokens do resolve to
    `var(--lr-color-overlay)`; `lr-histogram`'s `label` default is localized, not `'Frequency'`.
  - The root barrel skips 15 peer-gated tags, not 13 — `lr-knowledge-graph-explorer` and
    `lr-geojson-view` were undocumented omissions.

  **Newly documented:** the `@aceshooting/lyra-ui/ai` provider-neutral data types, the `locale` and
  `strings` properties present on every element, the localization API surface
  (`setLyraLocale`/`getLyraLocale`/`resolveLyraString`/`LYRA_DEFAULT_STRINGS` and its 996 message
  keys), the full design-token catalog, framework integration (React/Vue/Angular/Svelte property and
  event binding), TypeScript usage (the 127 `Lyra*EventMap` types, the typed `addEventListener`,
  `HTMLElementTagNameMap`), SSR/declarative-shadow-DOM status, the component-to-peer-dependency table,
  editor tooling metadata, and `<lr-map>`'s OpenStreetMap demo-tile-server production hazard.

  The freshness check now covers events, slots, CSS parts and themeable custom properties in addition
  to properties — it previously only checked properties, which is how 87 public names came to be
  documented nowhere.

### Patch Changes

- 7bdefd2: `lr-time-input` now accepts `min`/`max` as attributes. It inherits both from `lr-input`, where they
  are declared `type: Number` for the `type="number"` contract, so a `min="09:00"` attribute parsed to
  `NaN` and reached the native `<input type="time">` as the literal string `"NaN"` — which the browser
  discards, silently dropping the bound. Only a direct property assignment worked, and it needed a
  TypeScript widening cast to do so.

  `LyraTimeInput` now redeclares `min`/`max` with a converter that forwards the attribute verbatim, so
  `<lr-time-input min="09:00" max="17:00">` reaches the native input intact and its own constraint
  validation reports `rangeUnderflow`/`rangeOverflow` as it should. Seconds-precision bounds
  (`min="09:00:30"` alongside `step="1"`) work the same way, removing the attribute clears the bound,
  and both are typed `string | number | undefined` so an assignment no longer needs a cast.

  `<lr-input type="number">` is unchanged: its `min`/`max` attributes still parse to numbers.

- 2724dec: Add an internal `resolveCssLength()` helper that resolves a CSS length (a bare/`px` number, `rem`,
  or `em`) to pixels, reading the document root font size at call time so a `rem`-authored threshold
  tracks browser zoom, a user font-size preference, or an app changing its base size. Units that only
  make sense against a different reference box (`%`, `vw`/`vh`, `ch`), absolute units, and
  `calc()`/`var()` expressions resolve to `undefined`, which callers treat as "unset".

  No public API change yet — this is the shared groundwork for letting `lr-split` and `lr-stepper`
  accept `orientation-breakpoint` as a CSS length.

- 356f5fb: `lr-emoji-picker` now resolves its three geometry custom properties to real pixels before using
  them for the windowed layout. `--lr-emoji-picker-item-size`, `--lr-emoji-picker-gap`, and
  `--lr-emoji-picker-row-height` were read with `parseFloat(getComputedStyle(host).getPropertyValue(
token))`, which hands back the property's computed _token stream_ rather than a length: the shipped
  `2.5rem` item size was used as `2.5px`, the `0.125rem` gap as `0.125px`, and the `calc()`-based
  default row height was unparseable and always fell back to a hardcoded `64`. The windowed grid
  therefore packed its column cap of 20 emoji into a row that could only paint five, and scrolled at a
  row pitch that did not match the painted rows.

  Each token is now assigned to an off-flow probe box in the shadow root and read back as that box's
  used inline size, so the browser performs the unit math — `rem`, `em`, `ch`, `%`, `calc()`, any CSS
  length resolves correctly, and the item-size probe carries the same `--lr-icon-button-size` minimum
  the emoji buttons do, so the measured item size is the painted one. The result is cached and
  re-derived only when it can actually change: the probe boxes are themselves observed, so a token
  override applied after the first render, a theme swap, or a root/host font-size change updates the
  geometry without any per-frame measurement. Numeric fallbacks still cover the case where no box has
  been laid out yet.

  Consumers no longer have to express these tokens in `px` for the windowed geometry to line up with
  what is painted.

- 4ddf1fb: Document `orientationBreakpointBasis` on `<lr-split>` and `<lr-stepper>`, and the four
  role-scoped bubble custom properties on `<lr-chat-message>`. Also corrects a claim that
  a `rem` inside a CSS `@media` query resolves against the document root's computed font
  size — it resolves against the browser's _initial_ font size, which is exactly why the
  `'viewport'` basis, and not `'container'`, is the one that matches a CSS `@media` rule.
- 2a0cb74: Add an internal `OrientationBreakpointController` that owns orientation-breakpoint
  resolution, basis selection, and media-query lifecycle for the layout components. No
  consumer-visible change on its own.
- 8057596: Fix `<lr-pdf-viewer>`'s `search()` throwing an uncaught `IndexSizeError` when a search term occurs
  more than once inside a single PDF.js text-layer node (e.g. a repeated substring within one text
  item's `<span>`). `paintSearchMatches()` computed every match's DOM range against a pristine,
  pre-painting snapshot of each text node, but wrapping the first match with `Range.surroundContents()`
  splits/shrinks that node out from under the second match's precomputed offset, so `setStart()`/
  `setEnd()` threw before the existing `surroundContents()` try/catch ever ran. Offsets for a node are
  now tracked against the node as it actually stands after each prior match is painted, so every
  repeated occurrence within one text-layer node is now correctly highlighted instead of crashing
  `search()`.
- 415e61f: `<lr-code-editor>`: make `--lr-code-editor-tab-size` actually themeable.

  The stylesheet read the token on the `textarea` part, but `render()` also wrote an inline
  `tab-size:${tabSize}` on that same element on every update, and an inline declaration always beats a
  rule — so the documented token was inert and a host-level override was silently ignored.

  `render()` now writes the token itself, and only when `tabSize` was explicitly assigned. The
  resulting precedence, highest first: an explicitly set `tabSize` (property or `tab-size` attribute)

  > a host-level `--lr-code-editor-tab-size` > the `:host` default of `2`. `tabSize` therefore remains
  > the primary knob and still wins wherever it is used; it just stops shadowing the token while it sits
  > at its default. The Tab key follows the same order, so the indent unit and the rendered tab stops
  > cannot disagree — except for a length-valued token (`40px`, `2ch`, …), which stays a purely visual
  > tab-stop metric and leaves the inserted-space count at `tabSize`.

## 5.0.0

### Major Changes

- 3abb16e: Reorganized `packages/lyra-ui/src/components/` into 11 named family subfolders (Conversation &
  Chat, Agent Tools & Observability, Retrieval & Knowledge Graphs, Forms & Inputs, Data Display,
  Charts, Layout & Navigation, Overlays & Feedback, Document & File Viewers, Media & Files, Utility)
  instead of a flat 212-directory list.

  **Breaking:** any consumer importing an individual component's granular subpath (e.g.
  `@aceshooting/lyra-ui/components/combobox/combobox.js`) must add that component's family segment
  (`@aceshooting/lyra-ui/components/forms/combobox/combobox.js`). The root entry
  (`@aceshooting/lyra-ui`) and the `@aceshooting/lyra-ui/components/*` wildcard export are
  unaffected for consumers who only import the root barrel. See
  `packages/lyra-ui/scripts/component-families.json` for the full directory-to-family mapping.

### Minor Changes

- 0ed6e71: Added a frame-coalesced `lr-viewport-change` event to `lr-graph`, firing at most once per
  animation frame for every source that can move a rendered node's screen position (pan/zoom, a
  `focusNode()`/`fit()` tween, or a simulation tick) so a consumer anchoring its own UI to a node's
  `getBoundingClientRect()` no longer needs to poll its own `requestAnimationFrame` loop.
  `--lr-graph-dimmed-opacity` now defaults to `0.35` (previously the inert `1`), so `dimmedNodeIds`/
  `dimmedLinkIds` are visible out of the box with no host styling required.

  `lr-knowledge-graph-explorer` now computes and forwards `dimmedLinkIds` alongside
  `dimmedNodeIds`, switched its details-popover pan/zoom tracking from RAF polling to the new
  `lr-viewport-change` event, and added a `highlight: 'selection' | 'hover' | 'none' = 'selection'`
  property: `'hover'` also dims by the currently pointer-hovered node's neighborhood, `'none'` opts
  a host out of this component's own dimming entirely.

- bd501b7: Added `defaultSizes` to `lr-split` for an initialization-only fallback (a valid restored
  `storageKey` layout still wins, then `defaultSizes`, then equal distribution) that's never
  overwritten by a later reactive parent render. Added an opt-in `orientationBreakpoint`/
  `narrowOrientation` responsive-axis contract (mirrored below by `lr-stepper`): below the
  component's own measured inline size, `narrowOrientation` becomes the effective resize axis
  instead of the authored `orientation`, exposed via `effectiveOrientation`, a
  `data-effective-orientation` attribute, and `lr-split-orientation-change`. Extended
  `panelConstraints` with `minPercent`/`maxPercent`, combining with `minPx`/`maxPx` on the same side
  via the stricter bound.
- 5319ed6: Added an opt-in `orientationBreakpoint`/`narrowOrientation` responsive-axis contract to
  `lr-stepper`, mirroring `lr-split`'s identically-named properties: below the stepper's own
  measured inline size, `narrowOrientation` becomes the effective layout/navigation axis instead of
  the authored `orientation`, exposed via `effectiveOrientation`, a `data-effective-orientation`
  attribute, and `lr-stepper-orientation-change`. Unset (the default), behavior is unchanged.

## 4.2.0

### Minor Changes

- f3ae130: Adds an `@aceshooting/lyra-ui/ai` entrypoint re-exporting the provider-neutral AI/agent data
  contracts from `src/ai/types.ts` (also re-exported as types from the root `lyra.ts` barrel), so
  consumers importing these shared types don't have to reach into `./ai/types` directly.
- 46eb4d2: `<lr-diff-view>` gains a `contextLines` property: collapses a run of unchanged lines longer than
  `2 * contextLines` behind a single localized fold marker reporting how many lines it hides, keeping
  only `contextLines` lines of context immediately before/after each change (leading/trailing runs
  keep only their nearest `contextLines` lines) — the same context-window convention `git diff -U<n>`
  uses. Default `undefined` renders every line unconditionally, exactly as before this property
  existed. Works identically in both `unified` and `split` layout.

### Patch Changes

- fffd101: `<lr-chart>` no longer tracks its resolved Chart.js draw-time chart-area geometry as a reactive
  `@state()` field — recording it during Chart.js's own draw pass could trigger a second synchronous
  Lit update mid-draw. It's now a plain private field with a microtask-coalesced `requestUpdate()`,
  so repeated geometry updates within the same draw pass collapse into a single re-render.
- 273d5da: Fixed `lr-csv-viewer` and `lr-spreadsheet-viewer`: data rows rendered as unstyled stacked text
  instead of a proper grid, because their styling lived in a `[part='data-row']`/`[part='cell']`
  CSS selector scoped to the wrong shadow root (data rows render inside the nested
  `<lr-virtual-list>`'s own shadow tree via its `renderItem` callback, not the viewer's own). Only
  the header row, rendered directly by the viewer, was ever actually styled. Fixed with
  `lr-virtual-list::part(data-row)`/`::part(cell)` rules that correctly reach across that shadow
  boundary.
- a15cb97: `<lr-notebook-viewer>` now interprets ANSI SGR color/style escape codes embedded in stream and error
  outputs (common in colorized Python tracebacks and console output), rendering them as styled spans
  via the same shared `internal/ansi.ts` parser `<lr-terminal>` uses, instead of showing the raw
  escape sequences as literal text.
- ef988d8: `<lr-trace-tree>` now syncs `focusedId` from `activeSpanId` in `willUpdate()` instead of `updated()`,
  so the roving-tabindex target updates before render rather than one tick after it.

## 4.1.0

### Minor Changes

- b28758d: New `<lr-agent-run>` component: the top-level shell for one `AgentRun` (from `@aceshooting/lyra-ui/ai/types`) -- lifecycle-status badge, elapsed time, current step, model/cost summary, and built-in Cancel/Retry controls in a header, plus four named composition slots (`tasks`/`tools`/`reasoning`/`output`) for the run's actual content. Composes `lr-generation-status` for the live elapsed-time ticker while a run is in progress, `lr-usage-badge` for the cost summary, `lr-task-list` for the `tasks` slot's default content (mapped from `run.steps`), and `lr-badge`/`lr-empty` for the status pill and empty state -- no new step-rendering logic. Emits `lr-cancel`/`lr-retry` (`CancelEventDetail`/`RetryEventDetail`) rather than cancelling or retrying anything itself.
- f33364d: New `<lr-agent-trace>` component: a provider-neutral agent/LLM trace view combining a span-kind
  filter row, a handoff quick-jump list, and the full trace hierarchy, all driven by one shared
  `LyraSpan[]` array. All trace rendering -- hierarchy, expand/collapse, keyboard navigation,
  duration bars, empty state -- is entirely `<lr-trace-tree>`'s own; this component only ever hands
  it a (possibly filtered) `spans` array plus pass-through properties, never building its own row
  markup. The filter row composes `<lr-graph-legend>` (the same type/visibility-toggle legend
  pattern already established for `<lr-graph>` node types, reused here for `LyraSpan.kind`
  visibility) and the handoff list composes `<lr-handoff-divider>` for each visible `'agent'`-kind
  span. Selection (`activeSpanId`) is controlled end-to-end for deep-linking: both a tree-row click
  and a handoff quick-jump activation update it and fire the identical `lr-span-select` `{ id }`
  shape.
- eb3e833: New provider-neutral shared type surface at `@aceshooting/lyra-ui/ai/types`: `AgentStatus`,
  `AgentRun`, `AgentStep`, `ChatMessage`, `ToolInvocation`, `RetrievalQuery`, `RetrievalChunk`,
  `Citation`, `DocumentRef`, `GroundingAssessment`, and shared run-lifecycle/retrieval-progress/
  citation-select/tool-approval/cancel/retry/export event-detail types. A foundational types-only
  module (no runtime code, no new custom elements) for the upcoming retrieval, agent-run,
  knowledge-graph, dashboard, and evaluation component families -- structurally compatible with the
  prop shapes `lr-chat-message`, `lr-citation-badge`, `lr-tool-call-chip`, `lr-tool-result-view`,
  `lr-source-card`, `lr-attachment-chip`, and `lr-document-preview` already expose, so these types
  assign directly onto those components' own properties with no adapters. `ToolInvocation.status`
  reuses `lr-tool-call-chip`'s own `ToolCallStatus` union rather than the broader `AgentStatus`
  shape, since a single tool call's terminal state is exactly what that existing vocabulary already
  covers.
- c2d8f05: `lyra-chat-message` gains a `failure` slot, only ever rendered while `status="failed"`. Left empty
  (the default), today's built-in failed-state UI is unchanged: the `[part="status-text"]` message,
  the `[part="retry-button"]`, and the `chatFailedAnnounce` live-region announcement all keep working
  exactly as before. Once the slot has assigned content, that built-in status text and retry button
  are suppressed -- the host is now fully responsible for its own failure presentation (e.g. a
  prominent, translated `role="alert"` banner with its own retry control), and the built-in
  live-region announcement is suppressed too, so a host's own alert content doesn't get double
  announced alongside a generic built-in one. The `failure` slot itself contributes no box
  (`display: contents`), so the host's content lays out exactly as authored without needing any
  `::part(failure)` override. Content assigned to it should carry `role="alert"` itself when it
  represents an actionable send failure -- this component has no way to add that role on the host's
  behalf. Programmatic focus is rescued to `[part="bubble"]` (mirroring the existing built-in retry
  button's own focus rescue) whenever the failure slot's content held focus and `status` changes away
  from `"failed"`, so a host's own retry control clearing the failed state never silently drops focus
  to `document.body`. The existing `lr-retry` event contract is untouched; a host's own retry control
  can dispatch it manually to stay consistent with listeners elsewhere in a conversation surface, but
  nothing requires it to.
- 3f35f20: New `<lr-context-inspector>` component: an inspection view of the exact context assembled for a
  model call. Renders per-segment token estimates through an embedded `<lr-context-meter>`, source
  attribution through `<lr-citation-badge>`, and copy/export affordances through
  `<lr-copy-button>`/`<lr-export-button>` -- composing all four rather than re-implementing any of
  their rendering. Adds two small, purpose-built presentational features no existing primitive
  covers: a truncation-boundary marker for a segment cut short of its original content
  (`ContextInspectorSegment.truncated`/`omittedTokens`), and titled `<mark part="redaction">`
  highlighting for character ranges a segment's `text` already carries a redaction placeholder in
  (`ContextInspectorSegment.redactions`) -- this component never receives or renders unredacted
  content, only marks where a host-side redaction already happened. Pure projection: never fetches,
  estimates tokens, or performs redaction itself.
- 607b832: Add `<lr-dashboard-grid>`, a responsive, keyboard-accessible widget-layout shell: a controlled
  `layout: DashboardCell[]` (grid-unit `x`/`y`/`w`/`h` + a widget descriptor) drives a CSS Grid,
  composing `<lr-widget>`/`<lr-widget-renderer>` for each cell's default content unless a
  light-DOM `[cell-id]` child is authored instead. Pointer drag/resize and Ctrl/Cmd+Arrow (move) /
  Ctrl/Cmd+Shift+Arrow (resize) keyboard equivalents both route through the same `collision`-policy
  resolution (`'reject'` the default, `'push'`, or `'overlap'`), emitting `lr-cell-move`/
  `lr-cell-resize`/`lr-collision`/`lr-layout-change` -- the component never mutates `layout` itself
  nor touches `localStorage`/network; the host applies (or ignores) every event and owns persistence
  entirely, matching `lr-flow-canvas`/`lr-table`'s own controlled-component convention. Below a
  ~40rem container allocation (`@container`, not the viewport), cells stack into a single flowing
  column instead of shrinking columns unreadably.
- 21de4b4: `lyra-date-input` gains a `size: '2xs' | 'xs' | 's' | 'm' | 'l' | 'xl' = 'm'` property, matching
  `lyra-input`/`lyra-select`/`lyra-combobox`'s shared control-size scale. `size="s"` now renders the
  field at the same height/density as `lyra-input size="s"`, so a date field can sit flush beside a
  compact input or select in the same form row or toolbar. The calendar-toggle and clear buttons
  keep their existing minimum touch target at every tier instead of shrinking below it. The default
  `m` tier is pixel-identical to this component's previous, only rendering.
- d44e979: New `<lr-document-compare>` component: side-by-side or inline comparison of two document versions,
  composed entirely from existing primitives -- `<lr-diff-view>` (the real two-string line diff,
  `view="diff"`, the default) and `<lr-document-preview>` (each version's own actual rendered
  content, `view="side-by-side"`). The side-by-side panes are independently scrollable, so this
  component adds two minimal, purpose-built coordination mechanisms scoped narrowly to that: a
  proportional scroll-position sync (`syncScroll`, default `true`, mirroring `<lr-compare-panel>`'s
  own proven algorithm) and highlight-anchor sync (activating a region highlight shared by `id`
  across both versions' `highlights` scrolls the other pane to its own matching highlight). A shared
  `anchor` property (matching `<lr-document-viewer>`'s own) drives both panes to the same target at
  once. New `DocumentCompareVersion` type extends the shared `DocumentRef` (from `@aceshooting/lyra-ui/ai/types`)
  with `text` (diffed directly, no fetch) and per-version `highlights`.
- 7dfbed7: New `<lr-document-library>`: a searchable, filterable document inventory with versions, tags,
  owners, freshness, and bulk selection. Consumes the shared `DocumentRef` type from
  `@aceshooting/lyra-ui/ai/types` (`id`/`name`/`mimeType`/`uri`/`version`) as its base row shape,
  extended locally (`LibraryDocument`) with `tags`/`owner`/`updatedAt`/`freshness` -- the fields an
  inventory view needs that a provider-neutral document reference deliberately doesn't carry.
  Composes `<lr-table>` for the grid itself (`<lr-data-grid>` was evaluated and ruled out: it only
  supports a single `selectedKey` and stringifies every cell value, so it cannot host the checkbox/
  chip/icon content bulk selection, tags, and per-row type icons need; `<lr-table>` supports
  arbitrary cell content and `priority`-driven responsive column hiding), `<lr-chip>`/`<lr-chip-
group>` for tags and the freshness badge, `<lr-file-icon>` for per-document type icons, `<lr-
input type="search">` for free-text search, and `<lr-combobox multiple>` for a tag facet filter
  (AND semantics -- a document must carry every selected tag). Bulk selection renders a `<lr-
checkbox>` per row plus a header select-all checkbox (indeterminate when some but not all visible
  rows are selected) independently of `<lr-table>`'s own built-in `selectionMode`, since that mode's
  click-anywhere-on-the-row toggle would conflict with the row's own name button opening the
  document. A controlled data view like this package's other orchestration-level list surfaces: no
  upload/sync/mutation logic of its own, only `lr-filter-change` / `lr-sort` / `lr-selection-change`
  / `lr-open` request-and-notification events. `selectedIds` referencing a document no longer present
  in `documents` is silently pruned (no event fires for that pruning, mirroring `<lr-chip-group>`'s
  identical silent-resync convention) rather than left dangling.
- a012673: New `<lr-drilldown-panel>` component: controlled navigation from a chart/table datum to its related
  evidence, documents, entities, or agent runs. A navigation shell only -- an `lr-breadcrumb` trail
  over a host-owned `path`, plus, for whichever categories the current node actually has content for,
  the one existing primitive that already renders that content type (`lr-source-card` for evidence,
  `lr-document-preview` for documents, `lr-entity-card` for entities), wrapped in an `lr-tabs` strip
  only when more than one category has content. Agent-run content has no dedicated rendering primitive
  yet in this library, so it composes via a `runs` slot instead of inventing bespoke rendering.
  Activating a non-current breadcrumb step fires `lr-drilldown-navigate` (`detail: { id, index }`) --
  the component never mutates `path` itself.
- a0bb717: New `<lr-entity-dossier>` component: a full knowledge-graph entity detail surface combining
  properties, relationships, supporting chunks, confidence, and provenance into one composed
  layout. A persistent header renders `<lr-entity-card>` (the entity's summary/properties) next to
  an optional confidence `<lr-stat>`, above an `<lr-tabs>` strip for Relationships
  (`<lr-neighbor-list>`), Supporting chunks (`<lr-chunk-inspector>`), and Provenance
  (`<lr-provenance-panel>`). Pure layout -- it never fetches, ranks, or mutates graph/document state,
  and never re-renders what any of those five composed components already render themselves; every
  one of their own events bubbles through unmodified rather than being re-declared as this
  component's own. Tab labels reuse the exact `localize()` keys the composed child underneath
  already uses for its own accessible name (`neighborListLabel`, `chunkInspectorLabel`,
  `provenancePanelLabel`), so no new localization keys were needed and a translated locale only has
  to cover each string once.
- 5f2927f: New `<lr-eval-dataset>` component: dataset management for an evaluation suite -- a filterable,
  taggable list of `EvalExample` rows (`id`, `input`, `expectedOutput?`, `tags?`, `metadata?`) with
  add/remove/import/export affordances. Fully controlled, matching this library's established
  convention for the rest of the agentic-AI orchestration layer: `examples` is the host's own data,
  and the component never mutates it or performs any I/O itself -- every action fires an
  `lr-example-select` / `lr-example-add-request` / `lr-example-remove-request` /
  `lr-import-request` / `lr-export-request` event and the host decides how to act on it.

  Composes `<lr-data-grid>` for the row list, `<lr-chip>`/`<lr-chip-group>` as a toggleable,
  OR-matched tag-browse filter, `<lr-file-input>` for the import affordance, and
  `<lr-export-button>` for the export affordance (its own built-in client-side download is
  suppressed so every configured format routes through `lr-export-request` uniformly). Ships with a
  searchable free-text filter, RTL and 320px-allocation coverage, and localized strings with
  `.strings` override support.

- f5870ef: New `<lr-eval-result>`: rubric scoring, human review, and comparison across a single evaluation
  example's runs (one per model or prompt version), LangSmith/Arize-eval-result style. Composes
  three existing primitives directly rather than re-deriving their behavior: `<lr-data-grid>` renders
  the `runs` comparison table (`columns` is a plain pass-through to its own `DataGridColumn[]`
  shape); `<lr-rubric-form>` is the human-review scoring surface for whichever run is selected,
  reading/writing that run's own `review` value and re-emitting its
  `lr-input`/`lr-validity-change`/`lr-submit`/`lr-skip` events as
  `lr-review-input`/`lr-review-validity-change`/`lr-review-submit`/`lr-review-skip` with the run id
  attached; `<lr-diff-view>` compares the selected run's output against `baselineRunId`'s output --
  `layout="split"` once they resolve to two distinct runs, `layout="unified"` (an all-equal diff,
  i.e. a plain read of the one run's output) once they resolve to the same run or no baseline
  resolves at all. `selectedRunId`/`baselineRunId` are both fully controlled (never mutated
  internally) and fall back to `runs[0]?.id` purely for rendering when unset, so the component
  renders something useful with zero configuration beyond `runs`; a `selectedRunId`/`baselineRunId`
  that matches no entry in `runs` degrades gracefully (the comparison grid still renders, the
  review/diff sections simply don't).
- 3827a19: New `<lr-evaluation-run>` component: an evaluation batch's live progress. An overall
  `<lr-progress-bar>` counts terminal (done/error/cancelled) examples against the batch's `total`
  (or `examples.length` when unset), with running/failed count badges alongside it. Each example
  renders as its own `<lr-details>` disclosure showing input/output via `<lr-markdown>` or
  `<lr-code-block>` (per `inputFormat`/`outputFormat`), a composed `<lr-grounding-summary>` when the
  example carries a `GroundingAssessment` (plus optional evidence `citations`), and a composed
  `<lr-tool-timeline>` when it carries `toolTrace` entries -- this component defines no grounding-
  scoring or tool-call rendering of its own. `status` reuses the shared `AgentStatus` contract from
  `@aceshooting/lyra-ui/ai/types`, the same run-lifecycle vocabulary an agent step already uses.
  Nested `<lr-grounding-summary>`/`<lr-tool-timeline>` selection and approval events are intercepted
  and re-emitted as this component's own `lr-example-citation-select`/
  `lr-example-tool-approval-decide`, correlated with the originating example's `id` so a host never
  needs to walk the DOM to find out which example a nested interaction came from. Per-example
  disclosure toggling fires `lr-example-toggle`. A live region announces per-example status
  transitions (started/completed/failed/cancelled/needs input/needs approval), gated so a freshly-
  mounted run never announces its initial statuses.
- 0669f01: New `<lr-filter-bar>` component: a row of composable dashboard filters, each declared by the host
  (`filters: FilterBarFilterDefinition[]`) rather than invented by this component -- every filter
  renders an existing Lyra input (`<lr-select>`/`<lr-combobox>` for closed choice sets,
  `<lr-date-input>` in single or `mode="range"` for dates), plus a `<lr-chip-group>` of removable
  `<lr-chip>`s summarizing the active filters, an `<lr-button>` reset action, and (while `loading`)
  an `<lr-spinner>` status indicator. Controlled, like every other Lyra data component: `value` is a
  plain, JSON-serializable `FilterBarValue` object the host reads/writes directly -- this component
  never touches `location`/`history`/storage itself, so turning `value` into (and back out of) a URL
  querystring or app-state store is entirely the host's own concern. `required`-flagged filters get
  live `invalidFilterIds`/`checkValidity()`/`reportValidity()` and a `lr-validity-change` event, with
  each filter's own inline error rendered by its already-chromed composed control rather than a
  second, duplicate label/hint/error frame. `reset()` restores every filter to its own
  `defaultValue` (or unset) and emits both the standard `lr-input` and a dedicated `lr-reset`,
  mirroring `<lr-combobox>`'s own `clear()`/`lr-clear` pattern.
- c5a4786: New `<lr-graph-query-builder>` component: an editor for a single typed relationship/path filter
  (`GraphQuery`) over a knowledge graph -- start/end entity anchors, relationship-type and
  node-type "add" pickers (`<lr-select>`) with a removable active-filter chip display
  (`<lr-chip>`/`<lr-chip-group>`), a traversal direction, a min/max hop range, validation
  (`value`/`checkValidity()`/`reportValidity()`/`lr-validity-change`, form-associated via
  `ElementInternals` the same way `<lr-rubric-form>`/`<lr-tool-param-form>` are), and a
  host-persisted saved-query list (`savedQueries` + `lr-query-save`/`lr-query-load`/
  `lr-query-delete`). `GraphQuery` is a serializable, provider-neutral query model suitable for
  handing straight to a GraphRAG retrieval/traversal backend via `value` or the `lr-query-run`
  event's payload.
- a5723c3: New `<lr-grounding-summary>` component: the claim-level scorecard for one generated answer,
  consuming `GroundingAssessment` from `@aceshooting/lyra-ui`'s `src/ai/types.ts` directly as its
  `assessment` property. Composes `lr-stat` for the supported/unsupported claim counts, citation
  coverage, and optional confidence numeric displays (tone-mapped via a `thresholds` property), and
  `lr-citation-badge` for an optional `citations` list linking each evidence entry back to its exact
  `span`. Activating a citation badge emits `lr-citation-select` (detail: `{ citation }`, the
  `CitationSelectEventDetail` shape from `src/ai/types.ts`) carrying the full citation record, in
  addition to the badge's own `lr-citation-activate` still bubbling through unmodified. Warnings
  render verbatim as caller-supplied data; every other label is localized via `this.localize()`.
- 497c8d3: New `<lr-ingestion-queue>` component: a controlled list of documents moving through an ingestion
  pipeline (`queued` → `uploading` → `extracting` → `chunking` → `embedding` → `indexing`, plus the
  terminal `done`/`failed`/`cancelled` stages), each row composing `lr-badge` for its stage label,
  `lr-progress-bar` for in-flight progress, and chunk-count/embedding-status/attempt-count text.
  `lr-empty` renders the zero-items state. Presentation only -- this component runs no ingestion
  itself and never mutates `items`; retrying a `failed` row or cancelling any non-terminal row fires
  a controlled `lr-retry`/`lr-cancel` request event (`detail` extends the shared `RetryEventDetail`/
  `CancelEventDetail` from `src/ai/types.ts` with the `itemId` identifying which row) and waits for
  the host to supply an updated `items` array, the same request/response convention
  `<lr-thread-list>`'s row-action events already establish. At or above `virtualizeThreshold` items
  the list renders through an internal `<lr-virtual-list>` instead of a plain keyed list, matching
  `<lr-thread-list>`'s data mode and `<lr-activity-feed>`'s own `virtualizeThreshold` precedent.
- 593e879: New `<lr-knowledge-base>` component: a knowledge-base source list showing sync status, indexing
  health, and permissions per source, plus an aggregate summary row. A controlled data view -- it
  never syncs or indexes anything itself, only presents `sources: KnowledgeSource[]` and emits
  request-only `lr-kb-create`/`lr-kb-sync`/`lr-kb-pause`/`lr-kb-delete` events for the host to act on
  and reflect back into a new `sources` value, mirroring `lr-thread-list`'s `lr-thread-pin`/
  `-archive`/`-delete` convention. Composes `lr-table` for the source list (its own interactive-cell
  click guarding keeps the per-row `lr-menu` from misfiring row activation), `lr-badge` for the
  sync-status/indexing-health/permission indicators, `lr-stat` for the aggregate summary, and
  `lr-menu` for the per-row Sync now/Pause sync/Delete source actions.
- f04b670: Add `<lr-knowledge-graph-explorer>`, an orchestration-level knowledge-graph surface composing the
  existing `lr-graph` canvas with entity search, type filters (via `lr-graph-legend`), neighborhood
  expansion, pinned nodes, path finding between pins (via `lr-path-strip`), node selection, and a
  node-details popover (via `lr-popover.showAt()` and `lr-entity-card`/`lr-neighbor-list`). Composes
  existing primitives rather than re-implementing graph rendering. New events `lr-path-request` and
  `lr-pin-change`; every composed primitive's own event (`lr-node-click`, `lr-node-expand`,
  `lr-selection-change`, `lr-community-click`, `lr-relation-activate`, etc.) bubbles straight through
  unmodified.
- 593e879: New `<lr-memory-panel>` component: an agent's working memory surface -- short-term context and
  long-term memories, each item's confidence and optional grounding provenance, and add/remove/forget
  actions gated behind an explicit confirmation step. Composes `<lr-provenance-panel>` for a per-item
  provenance breakdown (behind a disclosure toggle, only rendered when an item defines one) and
  `<lr-confirm-bar>` for every add/remove/forget confirmation, reusing this repo's existing inline
  confirmation pattern rather than inventing a new one. A memory item's confidence reuses
  `<lr-citation-badge>`'s own confidence vocabulary, tiered against `thresholds` the same way
  `<lr-chunk-inspector>` tiers a chunk's relevance score. `shortTerm`/`longTerm` are controlled and
  never mutated by the component -- approving a pending action only fires the matching `lr-add` /
  `lr-remove` / `lr-forget` event; the host applies the resulting state change.
- ac4857d: Add `showAt(rect, options?)` to `<lr-popover>` and `<lr-tooltip>`, a virtual-anchor API that opens
  the overlay positioned against an arbitrary rectangle (`{ x, y, width?, height? }`, defaulting to a
  zero-size point) instead of the slotted `trigger`. This lets a canvas/SVG surface -- a `<lr-graph>`
  node, a chart datum, a text-selection range -- get flip/shift/RTL-aware positioning, Escape,
  light-dismiss, and (optional, via `options.returnFocusTo`) focus-return for free, without a
  consumer hand-rolling absolute positioning and dismissal logic around it. Both components remain
  fully backward compatible: a component that never calls `showAt()` behaves byte-identical to
  before. `place()` (`src/internal/positioner.ts`) is widened from `HTMLElement` to `Element |
VirtualAnchor` to support this, with no behavior change for existing real-element anchors.
- 823f19b: New `<lr-policy-summary>` component: a read-only list of guardrail, permission, privacy, and
  tool-policy decisions, each carrying an `allow` / `deny` / `needs-review` state and an
  always-visible, accessible explanation of why that decision was made -- never conveyed by color
  alone. Composes `<lr-badge>` for the compact per-decision state indicator and `<lr-callout
inline>` for the explanation text, whose own `role="alert"`/`role="status"` semantics already
  carry the right urgency per state, plus `<lr-details>` for a decision's optional richer `detail`
  (matched rule text, policy id, cited evidence) behind progressive disclosure. `decisions` is
  controlled and never mutated by the component -- this is a summary surface, not an approval gate
  (see `<lr-tool-approval-dialog>`/`<lr-confirm-bar>` for that).
- c6dd883: New `<lr-query-builder>` component: a composable structured-query builder for tabular/dashboard
  data queries -- a flat list of field/operator/value condition rows combined with one AND/OR
  combinator. Distinct from `<lr-graph-query-builder>`, which builds typed relationship/path
  queries over a knowledge graph -- a genuinely different data model that never shares a file or a
  value type with this one.

  Fully controlled: a host supplies `fields` (available columns, each carrying a
  `QueryBuilderFieldType` of `string` / `number` / `boolean` / `date` / `enum` that determines its
  offered operators and value control) and a plain, serializable `value: { combinator, conditions }`
  object, the same controlled-plain-object-`value` convention as `<lr-rubric-form>`. Each row
  composes `<lr-select>` for the field and operator pickers and a value control chosen from the
  selected field's type: `<lr-input type="text">`, `<lr-input type="number">`, `<lr-select>` with
  True/False options, `<lr-date-input>`, or `<lr-select>`/a multi-select `<lr-combobox>` for `enum`
  fields (`eq`/`neq` vs. `in`/`notIn`). A unary operator (`isEmpty`/`isNotEmpty`) renders no value
  control. `<lr-icon-button icon="trash">` removes a row and `<lr-button>` appends one, both
  surfaced through public `addCondition()`/`removeCondition(id)` methods and `lr-add-condition`/
  `lr-remove-condition`/`lr-input` events -- the component never mutates `fields`/`value` in place
  or touches storage/network itself.

- b443be6: New `<lr-retrieval-results>` component: the orchestration-level ranked-chunk-list surface for
  retrieval/grounding workflows, consuming `RetrievalChunk[]` from `@aceshooting/lyra-ui/ai/types`.
  Composes an internal `<lr-chunk-inspector>` per row (reusing its score bar, tier coloring, title/
  page rendering, expandable text, and `compact` mode verbatim -- no hand-rolled chunk-card markup)
  and an internal `<lr-virtual-list>` for windowing once the result count is large or `grouping` is
  active. Adds deduplication by `id` (keeping the higher-scoring duplicate), optional grouping by
  `source.id` (bucketed, best-scoring group first, same convention `<lr-thread-list>`'s date grouping
  already uses), multi-selection via a per-row `<lr-checkbox>` (`selectedIds` controlled, `lr-select`
  emits the updated ids and matching chunks), pagination/infinite loading (`has-more`/`loading`
  forwarded to the internal `<lr-virtual-list>` while virtualized, or a `[part="load-more"]` button
  otherwise -- both paths emit `lr-load-more`), and a `compact`/`expanded` `presentation` switch.
  `metadata` (arbitrary `Record<string, unknown>`, not rendered by any existing primitive) shows as a
  plain key/value list in `expanded` presentation. A row's `lr-chunk-open` is forwarded verbatim for
  routing into `<lr-document-viewer>`.
- 5f2927f: New `<lr-retrieval-search>` component: the query bar for a retrieval/RAG surface, composing
  `lr-input` (query text), `lr-segmented` (vector/keyword/hybrid mode), `lr-chip`/`lr-chip-group`
  (removable active-filter/scope chips), `lr-spinner` (loading), and `lr-empty` (empty results).
  Fully controlled and network-free -- `query`/`mode`/`filters`/`scope` are host-owned properties,
  and the component only emits `lr-search` (detail: a `RetrievalQuery` from `@aceshooting/lyra-ui`'s
  `src/ai/types.ts`) on Enter or the submit button; the host performs the actual retrieval and
  toggles `loading` around it. Because this component has no way to know when a request resolves,
  submitting again while already `loading` is treated as superseding the in-flight request:
  `lr-cancel` fires immediately before the new `lr-search`, and the submit button itself doubles as
  an explicit Cancel affordance while `loading`. Filter/scope chip removal updates this component's
  own copy first, then emits `lr-filters-change` with the complete next `{ filters, scope }` state,
  mirroring `lr-source-picker`'s existing round-trip convention.
- 3d6479f: New `<lr-retrieval-trace>` component: a retrieval pipeline's stage timeline (query rewriting,
  embedding, retrieval, reranking, filtering), rendered through `<lr-span-waterfall>`'s existing
  time-scaled bar rendering rather than a new timeline widget -- each `RetrievalStage` projects to
  one `LyraSpan`, with `kind` mapped onto whichever existing `LyraSpan['kind']` fits best (`embed`
  -> `'embedding'`, `retrieve` -> `'retriever'`, `query-rewrite` -> `'llm'`, `rerank`/`filter` ->
  `'tool'`). Below the timeline, a disclosure list exposes each stage's expandable evidence panel:
  free-form text, retrieved/reranked/filtered chunks via a compact `<lr-chunk-inspector>` (`chunks`
  accepts `RetrievalChunk` from `@aceshooting/lyra-ui/ai/types` directly), and/or arbitrary stage
  metadata as a key/value list. Controlled `stages`/`activeStageId` properties; emits `lr-stage-select`
  and `lr-stage-toggle`. Never fetches, ranks, or computes retrieval results itself.
- 5597050: `lyra-thread-list` gains a `renderActions?: (thread: ChatThread) => TemplateResult` data-mode
  property, an escape hatch for a fully custom per-row action surface (e.g. a `<lr-menu>` with
  Rename/Delete, a rename dialog, delete-confirmation state) that the existing `rowActions`'s closed
  `pin | archive | delete` set can't express. Its content is appended after any built-in `rowActions`
  buttons in the same row's `actions` slot -- additive, not a replacement, the same composition
  direction `wrapRow` already takes elsewhere on the row. Set `rowActions` to `[]` (its default) to
  use only the callback's content. `renderActions` is re-invoked per row on every render with the
  current thread (never memoized/stale) and its content sits as a DOM sibling of the row's own
  selectable region, so activating a custom action never also fires `lr-select` -- the same
  structural mechanism the built-in row-action buttons already rely on. Leaving `renderActions`
  unset leaves `rowActions`' rendered output byte-for-byte unchanged, and `wrapRow` continues to
  compose independently around the result either way.
- c67e88b: New `<lr-tool-timeline>` component: a chronological list of an agent run's tool calls, rendering
  each entry through `<lr-tool-call-chip>` (name/status/duration) and `<lr-tool-result-view>`
  (args/result) -- both already built for exactly this -- plus one shared `<lr-tool-approval-dialog>`
  for entries gated behind a human decision. Its own job is strictly ordering and layout on top of
  those existing primitives: `entries` (a new `ToolTimelineEntry[]`, extending `ToolInvocation` from
  `@aceshooting/lyra-ui/ai/types` with `startedAt`/`endedAt`, `retryCount`, `redactedFields`,
  `needsApproval`, and `approved`) sorts ascending by `startedAt`, with untimed entries trailing in
  their original relative order; duration is derived from `startedAt`/`endedAt` and handed to the
  chip's own `durationMs`; a retry badge renders only while `retryCount > 0`; and per-entry
  `redactedFields` (dotted paths, or a bare `"args"`/`"result"`/`"error"` for a whole branch) mask
  sensitive values in the read-only detail view with a "Value hidden" placeholder -- the copy of
  `args` handed to the approval dialog is always the real, unredacted value, since approving a call
  requires seeing what will actually run. Activating a pending entry's chip opens the shared dialog;
  approving or denying it emits this component's own `lr-tool-approval-decide`
  (`{ invocationId, approved, args? }`, extending the shared `ToolApprovalEventDetail`) and never
  mutates `entries` itself -- a host applies the decision and re-assigns `entries`, and the dialog
  closes on its own if the entry under review disappears or resolves out from under it in the
  meantime.

## 4.0.0

### Major Changes

- cf2cbbb: Release 4.0.0 renames the public custom-element, event, and design-token prefixes from
  `lyra-*`/`--lyra-*` to `lr-*`/`--lr-*`. The package name, JavaScript `Lyra*` class names,
  and `lyra-ui` repository/package paths remain unchanged. This is a breaking migration:
  update element tags, library-specific event names, and CSS custom-property overrides.

### Minor Changes

- cf2cbbb: New `lr-control-group` primitive: a responsive layout wrapper (`role="group"`, `flex-wrap: wrap`,
  `align-items: center`) for a row of mixed form controls and action buttons — a segmented switcher
  beside a select and an export button, for example. Distinct from `lr-button-group` (which
  stretches uniform-height buttons to a shared row height): `lr-control-group` centers children of
  differing intrinsic heights instead, since it makes no assumption about child type. Gap is
  themeable via `--lr-control-group-gap`.
- aa1fb49: `lr-segmented` gains a `size: '2xs' | 'xs' | 's' | 'm' | 'l' | 'xl' = 'm'` property, matching
  `lr-select`/`lr-combobox`'s compact-form-control scale (`xs`-`xl`) plus `lr-input`'s `2xs`
  tier. `size="s"` now renders at the same control height as `lr-select size="s"`/
  `lr-combobox size="s"`, so a segmented metric switcher can sit flush beside a compact select or
  combobox in the same toolbar without consumer CSS reaching into `::part(base)`. The default `m`
  tier is pixel-identical to this component's previous, only rendering.

### Patch Changes

- 5266832: Fixed `lr-select`'s `size="xs"`/`"s"`/`"l"`/`"xl"` to actually enforce their documented
  per-size minimum trigger height. A `var()` fallback bug meant `--lr-select-trigger-min-height`
  was silently dead code at every size — only padding and font-size ever varied, height did not.
  The default (`m`) tier's rendering is unchanged; a consumer-set `--lr-select-trigger-height`
  override still wins over the per-size floor, as before.

## 3.9.0

### Minor Changes

- abdd967: `lr-activity-feed` gains `renderText?: (entry: ActivityEntry) => TemplateResult`, overriding the
  default plain-text `[part="entry-text"]` rendering with arbitrary rich content — rendered markdown,
  or markdown plus a trailing tool-call chip list — identically whether or not the feed is currently
  virtualized, since both the plain and virtualized paths render every entry through the same
  internal template. Previously `ActivityEntry.text` could only ever render as plain escaped text,
  with no way to attach richer per-entry content.
- b64d4d2: `lr-graph` gains `dimmedNodeIds`/`dimmedLinkIds` (controlled, mirroring
  `selectedNodeIds`/`selectedLinkIds`): a host can now apply a themeable low-opacity treatment to
  arbitrary nodes/links -- e.g. dimming every non-neighbor of a hovered node -- via a new
  `--lr-graph-dimmed-opacity` custom property, in both the `svg` (default) and `canvas` renderers.
  Previously the only way to express this was reaching into the shadow DOM; `1` (no-op) by default,
  so existing usage is unaffected.
- 1d1935e: `lr-input` gains `'search'` as a documented `LyraInputType` member. It already worked at runtime
  via unchecked passthrough to the internal native `<input type="search">` (`type` has no runtime
  validation), but the exported type union didn't include it, so a consumer setting `type="search"`
  got no compile-time confirmation it was supported and no protection against a future stricter-typed
  release silently dropping it.
- f6b4957: New `<lr-markdown-core>` entry point: a build-lean variant of `<lr-markdown>` for a consumer
  whose `languages` map already covers every language it renders, mirroring the existing
  `<lr-code-block>`/`<lr-code-block-core>` split. Its own module never imports shiki's ~200-
  language default dynamic-import table -- `<lr-markdown>`'s existing `languagesOnly` flag can't
  give a bundler that guarantee, since it's checked at runtime, not statically provable. Every other
  capability (GFM, heading anchors, text-quote highlights, math) is unchanged from `<lr-markdown>`;
  a fenced block whose language isn't in `languages` always renders the plain-text fallback.
- 0a5227e: `lr-thread-list` gains `wrapRow?: (thread: ChatThread, row: TemplateResult) => TemplateResult`
  (data mode only): wraps each row's built-in `lr-conversation-item` with host-supplied content
  that has no home in the item's own `title`/`excerpt`/`meta`/`actions` surface — most notably a
  leading purpose icon, since `lr-conversation-item` has no default slot to receive one at all.
  Previously data mode forced an all-or-nothing choice between its built-in grouping/virtualization
  and a host's need for row content outside that surface, which only slotted mode (no grouping, no
  virtualization) could accommodate.
- d3f2e13: `lr-usage-badge` gains `formatLatency?: (ms: number) => string`, overriding the built-in duration
  algorithm (which has no minutes/hours tier — `'{ms}ms'`, or one-decimal seconds above 1000ms) in
  both the visible strip and the tooltip row. Mirrors `lr-activity-feed`'s `formatTimestamp`
  convention. Previously a consumer whose latencies commonly exceed a minute (e.g. a long-running
  agent run) had no way to render its own duration scale instead of a bare seconds count.

## 3.8.0

### Minor Changes

- c4cb188: Adds `<lr-activity-feed>`: an append-only streaming log of granular agent actions, collapsing to
  a localized "Completed N steps" summary once the run is over. Implements the shared follow
  (stick-to-bottom) contract (`follow` property, `lr-follow-change` event) and virtualizes its body
  through an internal `<lr-virtual-list>` at/above `virtualizeThreshold` entries, using that
  component's `scrollToIndex()` method to drive its stick-to-bottom follow. `<lr-virtual-list>`
  also gains `aria-label` forwarding from the host element onto its internal `role="list"`
  container, usable independently of `<lr-activity-feed>`.
- 5a0276e: Adds an internal, dependency-free ANSI/SGR parser (`src/internal/ansi.ts`, not a public export) —
  shared groundwork for `lr-terminal`'s streamed console-output rendering. No public API surface
  change on its own; ships alongside the `lr-terminal` component in the same release.
- b92b5d4: Adds `<lr-artifact-panel>`: a shell around one generated artifact — title/kind header, a
  preview↔code toggle (rendered only once the `code` slot has content), version navigation with a
  "Restore this version" affordance (`lr-version-change`/`lr-restore`, versions are host state),
  `streaming`/`aria-busy` state, and built-in copy/download actions. Renders none of the artifact
  itself — content is slotted.
- cf005b9: `lr-attachment-trigger` gains an `'audio'` capability, following the existing `camera` capability's
  request-only pattern exactly: activating it fires `lr-audio-request` (no embedded recorder), and the
  host opens its own capture UI — typically `<lr-push-to-talk>` in a `<lr-overlay>`/popover — then
  hands the resulting blob to its attachment tray. Purely additive: the default `capabilities` stays
  `['files']`, and every existing `files`/`image`/`camera` behavior is unchanged.
- b85934b: Adds `<lr-audio-visualizer>`: a presentational, canvas-drawn voice-activity visualization (bars or
  waveform), driven by a `MediaStream` (lazily wired to a WebAudio analyser), a numeric `level`, or a
  `state` (`idle`/`listening`/`thinking`/`speaking`) alone for an ambient animation. Pairs with
  `lr-push-to-talk`'s `stream`/`lr-level` output. Zero dependencies — native Web Audio only,
  reduced-motion-aware.
- 3310f16: Adds `<lr-av-player>`: an audio/video player built on a native media element with a cue transcript
  synced to playback, `time-range` anchor/highlight support, an optional dependency-free waveform
  (peaks-in, no in-component decoding), playback-rate control, and imperative transcript search.
  Self-registers into the document-viewer registry for the common audio/video MIME types. Owns
  recorded-media transcript sync — distinct from `lr-transcript-feed` (live voice-session captions)
  and from `lr-playback` (an index stepper, no media).
- 0fe240b: Adds `<lr-branch-picker>`: a controlled "‹ 2 / 5 ›" navigator across regenerated/edited variants of
  one chat message, mirroring `lr-pagination`'s "never mutates its own state" contract. Fires
  `lr-branch-change` with the requested (always in-bounds) index; the host swaps the displayed branch
  content and applies the new index back. Designed to slot into `lr-message-actions`' default slot or
  directly into `lr-chat-message`'s `actions`/`badges` slots.
- bc75a1f: Adds `<lr-browser-frame>`: a presentational "agent computer" viewport — a safe-URL-gated
  screenshot/frame stream `<img>` (or slotted live media), read-only address bar, visible (never
  color-only) connection status, kind-distinct action-ping overlays, and take-over/stop affordances
  (`lr-take-over`, `lr-stop`). No automation transport and no input relay — take-over is an event;
  the host swaps in its own interactive element.
- e29f575: `lr-button` and `lr-input` gain `size="2xs"`, a sub-`xs` tier for dense, toolbar-embedded controls
  (e.g. a search input and text buttons inside a compact dialog header). Composes with `appearance`/
  `variant` the same way the existing five sizes already do.
- e4762fd: `lr-button` gains `appearance="quiet"`: a bordered, transparent-until-hover tier for a toolbar-style
  icon+label action whose border/text read fixed `--lr-color-border`/`--lr-color-text-quiet` tokens
  regardless of `variant`, unlike `appearance="outlined"`'s variant-tinted text — for a call site that
  needs a genuinely muted resting state rather than a bold bordered button. New
  `--lr-button-quiet-border`/`--lr-button-quiet-text` custom properties back the two tokens.
- 4ac983b: `lr-chat-message` gains `actionsOutsideBubble` (reflects to `actions-outside-bubble`): renders the
  `actions` slot's content as a sibling immediately after the message bubble instead of nested inside its
  footer's own padding/background box. Previously a consumer whose action row (e.g. a hover-reveal copy
  button) had to sit visually outside the bubble's chrome could not adopt this component at all, since
  `::part(footer)` styling alone cannot detach it from the bubble's box.
- 65a1f8c: Adds `<lr-chat-viewport>`: the transcript scroll container for a chat/agent conversation surface —
  owns the stick-to-bottom `follow` state machine (`follow` property, `lr-follow-change` event,
  matching the same shared follow contract `<lr-activity-feed>` already implements) while an answer
  streams, a built-in "jump to latest" pill with a pluralized unread count, and an unread divider. Two
  content shapes are auto-detected: ordinary element children (slotted mode) or exactly one
  `lr-virtual-list` (virtual mode, built on that component's `scrollToIndex()` method). Renders no
  messages and computes no unread state itself — the host supplies `unreadStartIndex` and slots its
  own message elements or a virtual list.
- bf601c8: Adds `<lr-checkpoint>`: an inline conversation restore point — a labeled marker between messages
  whose Restore affordance confirms inline (an accessible-name-carrying button swap, focus-managed,
  Escape/focus-out-aware) before firing a `lr-restore { checkpointId, label }` event. Persists and
  restores nothing itself — host state in, events out. `confirmRestore="false"` skips the inline
  confirm step entirely; `restorable="false"` renders a plain, non-interactive marker for read-only
  views or the currently-restored point.
- 22c1006: Adds `<lr-chunk-inspector>`: a ranked retrieved-chunks "why this answer" panel — relevance score
  bars with tier-mapped tones, expandable chunk text (state keyed by chunk id, survives streaming
  reassignment), and `lr-chunk-open` for landing a chunk in `lr-document-viewer` with its anchor.
  Virtualizes automatically above `virtualizeAt` rows via the existing `lr-virtual-list`.
- c274bd6: `lr-code-block` and `lr-code-block-core` gain `highlight-lines` (declarative `"3-5,7"`-style
  line emphasis), `interactive-lines` (turns the line-number gutter into a keyboard-navigable,
  clickable roving-tabindex group emitting `lr-line-click`), and `line-range` anchor-target support
  (`highlights`, `activeHighlightId`, `scrollToAnchor()`, event `lr-text-select`) — identical on
  both components since they share the new line-addressing logic. Previously there was no way to
  emphasize or deep-link to a specific line/range of lines in a rendered code block.
- f71fcac: Adds `<lr-commit-card>`: a compact commit summary card — abbreviated/copyable hash, subject/body
  message split, author/time meta, a non-color-only aggregate `+N -M` diffstat, and a collapsible
  per-file change list (`lr-file-select` on activation) reusing `lr-file-tree`'s `GitStatus`
  vocabulary and shared `gitStatus*` labels.
- 22c1006: Adds `<lr-community-card>`: a GraphRAG community-report card — label, summary excerpt, member
  count, member chips with a "+N" overflow chip, and a drill-in action (`lr-drill`) surfaced from
  the header, an explicit drill button, and the overflow chip alike. A `compact` mode renders just
  title + member count + drill button for dense listings (e.g. inside `lr-provenance-panel`).
- 1432601: Add `lr-compare-panel`: side-by-side A/B output comparison with a winner vote (LMSYS-arena /
  LangSmith-pairwise style) — two slotted panes (`a`/`b`), an optional shared `prompt` header, a
  `role="group"` vote bar (better-A / better-B / tie / both-bad, the last two individually
  hideable), and optional proportional `syncScroll` between panes. No hotkeys (slotted content may
  contain inputs); casting a vote announces through an internal live region.
- bc75a1f: Adds `<lr-confirm-bar>`: an inline, non-modal approve/deny block for one proposed action — the
  in-flow sibling of `lr-tool-approval-dialog` for confirmations that belong in the transcript instead
  of an overlay. Same `lr-approve`/`lr-deny` event shapes and the same heading/args-label/deny/approve
  localization keys as the dialog, so the two stay in lockstep. No focus trap, scroll lock, or
  Escape/backdrop handling; on activation, focus moves synchronously to the always-present decided-state
  text before the Deny/Approve buttons unmount, and an internal live region announces the outcome.
- 23bfb7b: `lr-conversation-item` gains a `meta` slot (small, non-focusable structured fields below the
  title/excerpt — e.g. a day label, project name, cost) and an `excerpt` slot that wins over the
  existing `excerpt` property whenever it has assigned content, mirroring `lr-timeline-item`'s own
  `timestamp` slot-wins-over-property pattern. Previously a consumer needing a rich excerpt (e.g. a
  search-hit snippet with `<mark>` highlighting) or a multi-field meta line had to flatten that
  structure into the plain-text `excerpt` property or hand-roll the row entirely.
- 2ad038b: `lr-dataset-viewer` now virtualizes through `lr-virtual-list` (a new `item-role="row"` mode,
  mapping to a proper `role="table"`/`role="row"`/`role="rowgroup"` accessibility tree) instead of a
  single synchronous `<table>`, lifting its row cap from 1,000 to the shared 10,000-row default every
  other tabular viewer already uses. It also gains `cell-range` anchor-target support (`highlights`,
  `activeHighlightId`, `scrollToAnchor()`, event `lr-highlight-activate`) and an imperative
  in-document search API (`search()`, `searchNext()`, `searchPrevious()`, `clearSearch()`, event
  `lr-search-change`), sharing the same raw-grid cell addressing as `lr-csv-viewer`, with the
  header row always included since this viewer always parses with PapaParse's `header: true`. The
  `lyra:dataset` document-viewer registration now declares `capabilities: { anchors: ['cell-range'],
search: true, textSelect: false }`. `lr-virtual-list` itself gains the underlying
  `item-role`/`row-index-offset` properties this required, additive and defaulting to today's exact
  `listitem` behavior for every other consumer. Previously a 1,001+ row dataset file failed to load at
  all, and there was no way to highlight or search a cell.
- 2ad038b: `lr-diff-view` gains `layout="split"` (two side-by-side columns derived from the same line-diff
  alignment as the default unified view — unbalanced replace hunks pad the shorter side with empty
  placeholder rows) and optional syntax highlighting via `language`/`languages` (same fine-grained
  shiki-core-only shape as `lr-code-block-core`, so the peer-free default stays truly peer-free).
  Previously diff-view only rendered a single interleaved unified view with no highlighting option.
- dc168c7: `lr-docx-viewer` gains `getHeadingTree()` (a document-ordered heading outline stamped with
  GitHub-slugger-style ids, using the same slugging algorithm as `lr-markdown`), `fragment`/
  `text-quote` anchor-target support (`highlights`, `activeHighlightId`, `scrollToAnchor()`, events
  `lr-highlight-activate`/`lr-text-select`/`lr-anchor-result`), and an imperative in-document
  search API (`search()`, `searchNext()`, `searchPrevious()`, `clearSearch()`, event
  `lr-search-change`). Previously there was no way to deep-link into a section, highlight a quoted
  passage, or search inside a rendered Word document.
- d3edf31: `lr-ebook-viewer` gains `getToc()` (a flat, nested table of contents from the EPUB's own
  navigation document), a `location` property (get/set the current CFI or spine href, with
  `lr-location-change` on user navigation), an imperative in-book search API (`search()`,
  `searchNext()`, `searchPrevious()`, `clearSearch()`, event `lr-search-change`), and `cfi`/
  `text-quote` anchor-target support (`highlights`, `activeHighlightId`, `scrollToAnchor()`, events
  `lr-highlight-activate`/`lr-text-select`). Previously there was no way to read an EPUB's table
  of contents, deep-link into a specific location, or search inside a rendered book.
- 2ad038b: `lr-email-viewer` attachments become interactive: each row is now a real button emitting
  `lr-attachment-open { attachment: { filename, mimeType, content } }` with the attachment's decoded
  bytes attached (the component itself never opens/downloads anything — host-owned routing, e.g. into
  `lr-document-viewer`). A new `fold-quotes` property collapses trailing quoted-reply text/HTML
  (`>`-prefixed text runs, `gmail_quote`/`yahoo_quoted`/Outlook-style HTML blocks) behind a localized
  toggle. Previously attachments were inert metadata with no way to retrieve their content, and quoted
  reply chains always rendered in full.
- ba094cb: Adds `<lr-emoji-picker>`: a searchable, keyboard-navigable, form-associated emoji picker
  (`value`/`lr-change`, matching this library's other form-control conventions). `groups` is fully
  consumer-suppliable — this component ships no emoji data of its own — with an optional convenience
  auto-loader for a default set via the `emoji-picker-element-data` peer when `groups` is left unset.
  Lets a consumer currently wrapping the third-party `emoji-picker-element` custom element (plus its
  locale-data package) as a direct dependency replace it with a first-party `lr-*` component instead.
- 22c1006: Adds `<lr-entity-card>`: a dossier card for one knowledge-graph entity (`LyraEntity`) — type
  badge, description, key/value property rows, relationship-degree and community rows, and a
  built-in "focus in graph" action that emits `lr-entity-activate` for a host to route into
  `lr-graph`'s `focusNode()`.
- 22c1006: Adds `<lr-entity-chip>`: an inline `@entity` mention for agent prose with a hover/focus preview
  popover, reusing `lr-citation-badge`'s interaction contract wholesale (200ms hover-leave grace,
  independent hover/focus hold-open state, Escape dismissal, Space opens/Enter activates). The
  knowledge-graph sibling of `lr-citation-badge` — renders its `label` text rather than a `[n]`
  index, and reflects `type` for host-level per-type theming.
- 2ab49e6: Adds `<lr-env-list>`: a masked key/value list for environment variables and secrets
  (`<dl>`/`<dt>`/`<dd>` semantics), defaulting every entry to masked (a fixed eight-bullet run,
  length-independent so value length is never leaked) with per-row reveal (`lr-reveal-change`, state
  keyed by name and position, and reset for a row whose name shifts position) and copy (`lr-copy`,
  always copies the real value). `revealable=false` for screen-share-safe hosts. Masking is
  presentational, not a security boundary.
- 892c9d3: Adds `<lr-file-tree>`: a file-explorer preset over `lr-tree` + `lr-file-icon` with path-keyed
  nodes, per-file git-status badges and `+N -M` diffstat, lazy directory loading (`setChildren()`,
  `lr-load-children`), `revealPath()`, and `lr-file-select`/`lr-file-open` events (matching the
  "Enter/click on an already-selected file opens it" keyboard parity rule).
- 22c1006: Adds `<lr-flow-canvas>`: a dependency-free, pannable/zoomable DAG workflow canvas — HTML card
  nodes with typed connection handles, SVG Bézier edges with arrowheads and labels, a shared layered
  auto-layout for unpositioned nodes, and controlled selection/drag/connect gestures behind three
  independent opt-in flags (`nodes-draggable`, `connectable`, `droppable`). Readonly viewer by default;
  never mutates `nodes`/`edges` itself. Ships a `registerCompanion()` hook so `lr-flow-minimap`,
  `lr-flow-controls`, and `lr-flow-run-overlay` (following in subsequent releases) can attach
  without reaching into its shadow DOM.
- 22c1006: Adds `<lr-flow-controls>`: the zoom in/out, fit, and interaction-lock button cluster for
  `lr-flow-canvas`, so every flow surface ships the same affordances without hosts rebuilding them.
  Zoom buttons disable at the resolved canvas's `minZoom`/`maxZoom` bounds; the lock toggle stays in
  sync with the canvas's `locked` attribute regardless of what changed it.
- 22c1006: Adds `<lr-flow-minimap>`: a corner overview map for `lr-flow-canvas` — scaled node rectangles
  (status-tinted) plus a draggable, keyboard-operable viewport rectangle for orientation and fast
  navigation on canvases larger than the screen. Attaches via `registerCompanion()`, either slotted
  into one of the canvas's corner slots or externally via `for="canvas-id"`.
- 22c1006: Adds `<lr-flow-node>`: the workflow node card — header/body/toolbar chrome, tool-lifecycle status
  tones with a visible (never color-only) status chip, a determinate progress bar, and named
  connection-handle elements. Used automatically by `lr-flow-canvas` as the default card for any
  node without a slotted override, and usable standalone for palette previews or docs.
- 22c1006: Adds `<lr-flow-run-overlay>`: execution-state presentation for `lr-flow-canvas` — mirrors a
  `FlowRunDecorations` map into the resolved canvas (which owns the actual node/edge paint) and
  renders a compact "{done} of {total} steps complete" summary strip with per-status counts.
  Status transitions announce through a throttled live region. Pure pushed state — no execution,
  polling, or internal clock.
- 2ad038b: Adds an internal `application/geo+json` document-viewer registry bridge (`<lr-geojson-view>`,
  `.geojson` filename matching included): fetches and validates a GeoJSON `Feature`/`FeatureCollection`/
  bare-geometry payload, computes a bounding-box fit, and renders it through `lr-map`'s new
  `dataLayers` property with a feature-count status line. Falls back to `lr-json-viewer` with a
  missing-library callout when the optional `maplibre-gl` peer isn't installed. Not a documented public
  tag this round — importing `geojson-view/geojson-view.js` opts a host into the bridge, matching how
  `lr-map`/`lr-graph`/the chart family already stay out of the root barrel import.
- ca9258f: `lr-graph` gains `renderer: 'svg' | 'canvas'` (default `'svg'`, unchanged). `'canvas'` swaps the
  per-node/per-link SVG DOM for a single DPR-aware `<canvas>` (reusing `lr-heatmap`'s proven backing-
  store/resize/DPR-watch machinery), targeting roughly 5,000 nodes / 10,000 links versus SVG's ~500/
  ~1,500 ceiling. Hit-testing uses an offscreen color-picking canvas (exact hits for all three node
  shapes, stroked/dashed links, and hull blobs, one code path, zero new dependencies); pointer drag,
  click, double-click-to-expand, and hover tooltips all work via that same hit-test. Keyboard/screen-
  reader parity is preserved through an offscreen virtual-cursor button list driving the identical
  roving/announcement logic as SVG mode — the honest v1 trade-off is no `::part(node)`/`::part(link)`
  styling (pixels, not elements) and a drawn focus ring instead of a CSS one, both documented. Fully
  additive — the default `renderer: 'svg'` reproduces today's DOM exactly.
- c6ab7c8: `lr-graph` gains `GraphNode.communityId` and a `communities` property, rendering one translucent
  convex-hull blob per entry (membership = union of `memberIds` and matching `communityId`) behind
  links/nodes. Hulls are keyboard/click-activatable (`lr-community-click`), join the roving focus
  ring after nodes and links, and are included in `fit()`'s bounding-box calculation. Fully additive
  — an empty `communities` array (the default) renders no hulls and leaves the roving ring/`fit()`
  behavior unchanged.
- c996af0: `lr-graph` gains `showEdgeLabels` (default `false`) to draw each link's `label` as visible SVG
  text at the segment midpoint, and `edgeLabelMinZoom` (default `0.6`) to hide all edge labels below
  that zoom scale. A per-label length gate also hides a label whose measured text width exceeds 85%
  of its edge's current on-screen length. Labels are `aria-hidden` (the accessible name already
  carries `label` via the existing link announcement) and fully opt-in — a graph that never sets
  `showEdgeLabels` renders no edge-label DOM at all.
- 7f7511a: `lr-graph` gains a double-activate expand gesture: double-clicking a node, or activating the same
  focused node twice via Enter/Space within 500ms, emits `lr-node-expand { id }`. A new
  `GraphNode.expandable` flag renders a "+" badge and adds "expandable" to the node's spoken text. A
  node newly linked to an already-positioned neighbor (e.g. appended after an expand) now spawns near
  that neighbor instead of a random position. Fully additive — no existing click/keyboard behavior
  changes, and a graph that never sets `expandable` never renders the badge (though the
  `lr-node-expand` event itself fires for any double-activated node, matching native
  dblclick semantics).
- 5d77b48: `lr-graph` gains a programmatic camera (`focusNode(id, { zoom? })`, `fit({ padding? })`, both
  reduced-motion-aware rAF tweens that keep d3-zoom's own state consistent), a declarative
  `focusId` twin (centers once, renders a persistent `focus-halo` ring), and a controlled selection
  model (`selectionMode: 'none' | 'single' | 'multiple'`, `selectedNodeIds`/`selectedLinkIds`,
  `lr-selection-change`) mirroring `lr-heatmap.selectedCell`'s controlled contract — the
  component only ever emits intent, never assigns the selection props itself. Fully additive: default
  `selectionMode: 'none'` and unset `focusId` reproduce today's behavior exactly.
- 844fe95: `lr-graph` gains `lr-node-enter`/`lr-node-leave`/`lr-link-enter`/`lr-link-leave` hover
  events (mirroring the existing `lr-node-click`/`lr-link-click` detail shapes) plus a `data-hovered`
  attribute toggled on the hovered node/link element for pure-CSS theming. Both are suppressed while a
  drag or pan gesture is in progress, so a drag crossing over other nodes/links doesn't spam
  enter/leave pairs. Previously a consumer computing an adjacency-based neighbor highlight on hover
  (e.g. dimming every unconnected node/link) had no way to observe which node/link was currently
  hovered from outside the component.
- f8d6b9e: `lr-graph` gains `layout: 'force' | 'layered'` (default `'force'`, unchanged). `'layered'`
  computes a deterministic Sugiyama-lite layout instead of running d3-force — longest-path layering,
  barycenter crossing reduction, cycle-safe (back edges reversed internally, the caller's data is
  never mutated). The algorithm itself lives in a new shared, dependency-free
  `src/internal/layered-layout.ts`, a standalone util suitable for any future layered-diagram
  consumer. Node drag is disabled in layered mode; pan/zoom, keyboard, focus/fit, hulls, edge labels,
  and type filtering all work identically to force mode. Fully additive — the default `layout:
'force'` reproduces today's simulation-driven layout exactly.
- 22c1006: Adds `<lr-graph-legend>`: a node-type legend for a paired `lr-graph`, rendering one swatch +
  label + count row per declared node type and doubling as a visibility filter. Event-decoupled from any
  graph instance — a host forwards `graph.nodeTypes` in as `types` and forwards
  `lr-visibility-change`'s `hiddenTypes` back out to `graph.hiddenTypes`.
- 942798e: `lr-graph` gains `GraphNode.type` and a new `nodeTypes` property declaring each type's legend
  label, fill color, and shape (`circle`/`square`/`diamond`). Fill resolution precedence is
  `node.color` > the type's own color > an ordered categorical fallback palette
  (`--lr-graph-cat-1`…`--lr-graph-cat-8`, new tokens) by the type's index in `nodeTypes` > the
  existing untyped default. Typed nodes also gain richer spoken text ("{label} ({type})"). Fully
  additive — a graph with no `type`/`nodeTypes` set renders identical circles, unchanged.
- 32f7b12: `lr-graph` gains `hiddenTypes: string[]`, hiding every node whose `type` is listed (plus incident
  links) from rendering, the simulation, the keyboard roving ring, and the accessible data list/
  counts. Positions round-trip via a new remembered-position cache, so toggling a type off and back
  on restores each node where it was instead of re-randomizing. Fully additive — an empty
  `hiddenTypes` (the default) renders every node/link exactly as before.
- e022166: Adds `<lr-handoff-divider>`: a labeled semantic separator marking control transfer between agents
  in a transcript (e.g. "Transferred to Research Agent"), with an optional `avatar` slot. Root is
  `role="separator"` named by the computed label; the label is announced once on first connect
  through an internal live region, since a handoff lands mid-stream and later property changes never
  re-announce.
- 4cddc07: Adds `<lr-highlight-layer>`: a presentational overlay that paints highlight rectangles
  (percent-of-box coordinates) over positioned content — a pdf page, an image, any relatively-positioned
  frame. Roving-tabindex keyboard access (ArrowUp/Down/Left/Right honoring RTL, Home/End, Enter/Space),
  `aria-current` on the active rect, a one-shot `flash()` emphasis pulse with a reduced-motion static
  fallback, and token-mapped tones. Zero dependencies. `lr-pdf-viewer` adopts it next for per-page
  highlight painting.
- 4c707de: Adds `<lr-image-viewer>`: a full pan/zoom raster-image viewer with labeled region highlights and
  opt-in region annotation (pointer-drag or keyboard), self-registering into the document-viewer
  registry for `image/png`, `image/jpeg`, `image/webp`, `image/gif`, `image/avif`, and `image/bmp`.
  Distinct from `<lr-svg-viewer>` (vector documents) and `<lr-image-comparer>` (before/after
  comparison) — this is the landing surface for `region`-anchored citations (bounding-box grounding).
- 2ad038b: `lr-json-viewer` gains an imperative search API (`runSearch()`, `searchNext()`,
  `searchPrevious()`, `clearSearch()`, event `lr-search-change`) as a thin layer over its existing
  declarative `search` property -- the property, its highlighting, and its force-expand behavior are
  unchanged; the new methods add match-count resolution and a navigable cursor (`data-active` on the
  current match) on top. The count-resolving entry point is named `runSearch()` rather than `search()`
  (unlike this same quartet on other viewers) because `search` is already this component's own public
  string property -- a method can't share its name. Previously there was no way to count matches or
  step between them programmatically.
- ac19eb0: `lr-lite-chart` gains a `legendText?: (label: string, datasetIndex: number) => string` hook,
  appending formatter-supplied text (e.g. a value or percentage share) after each series' label in the
  built-in legend row — mirrors the existing `pointText`/`tickFormat` opt-in-hook convention. Previously
  a consumer needing per-series legend text beyond the bare label had to hand-roll an entire replacement
  legend instead of using the built-in `legend` prop.
- c721d97: `lr-map` gains a `dataLayers: GeoJsonDataLayer[]` property: each entry adds a GeoJSON source plus
  fill/line/circle layers (colored from `--lr-*` tokens by an optional `tone`), independent of the
  existing `choropleth` prop (which requires `field`/`stops` and can't display plain geometry). Defaults
  to an empty array — zero behavior change for existing `lr-map` users. This is the enabler for the
  upcoming GeoJSON-file document-viewer bridge, and is useful standalone for rendering arbitrary
  GeoJSON shapes (routes, zones, points of interest) without hand-building maplibre-gl layers.
- 92955fc: `lr-markdown` gains `heading-anchors` (stamps computed GitHub-slugger-style ids on headings),
  `getHeadingTree()` (a document-ordered heading outline, computed regardless of `heading-anchors`),
  `fragment`/`text-quote` anchor-target support (`highlights`, `activeHighlightId`, `anchor`,
  `scrollToAnchor()`, events `lr-highlight-activate`/`lr-text-select`/`lr-anchor-result`), and
  `math` (renders `$...$`/`$$...$$` TeX as MathML via the optional `katex` peer, falling back to
  literal source text when the peer isn't installed). Previously there was no way to deep-link into a
  section, highlight a quoted passage, or render math in rendered Markdown content.
- 3492739: `lr-markdown` gains real shiki syntax highlighting for fenced code blocks, reusing
  `<lr-code-block>`'s own optional `shiki` peer and grammar-loading machinery directly (not by
  embedding `<lr-code-block>` itself, which would have hit DOMPurify's default custom-element
  blocklist and re-mounted — losing state and re-triggering async loads — on every streaming chunk).
  On by default whenever the `shiki` peer is installed (set `highlightCode="false"` to opt out); new
  `languages`/`languagesOnly` properties mirror `<lr-code-block>`'s own fine-grained bundle-size
  controls. Highlighting is skipped entirely while `streaming` is `true` and applied once a stream
  settles, so there is no added per-chunk cost while content is still arriving.
- e5df5af: Adds `<lr-message-actions>`: the per-message action toolbar for `lr-chat-message`'s `actions` slot
  — opt-in built-ins (`copy` / `regenerate` / `edit` / `feedback`, in `controls`-array order) that emit
  intent events (`lr-regenerate`, `lr-edit`, plus bubbled `lr-copy`/`lr-change`/`lr-submit`
  from the embedded copy button and thumbs-only feedback), and a default slot for custom controls (e.g.
  a slotted `lr-branch-picker`) that participate in the toolbar's ArrowLeft/ArrowRight/Home/End
  navigation. Optional `reveal-on-hover` hides the bar until the enclosing `lr-chat-message` is
  hovered or a control inside has focus.
- 9544450: Add `lr-message-feedback`: thumbs up/down for one assistant message, with an optional inline
  detail step (multi-select reason chips + a free-text comment) that opens as a disclosure directly
  below the thumbs rather than a floating overlay. Fires `lr-change` on every rating toggle and
  `lr-submit` (`{ value, reasonIds, comment }`) from the panel's submit button; stores nothing
  itself — a host persists the rating and may reflect a previously-recorded one back via `value` +
  `disabled`. Re-activating the pressed thumb clears the rating unless its own detail panel is open,
  in which case that click re-opens the panel with any surviving draft instead.
- 22c1006: Adds `<lr-mind-map>`: a radial expandable topic tree (NotebookLM-style Mind Maps) — zero-dependency
  SVG, closed-form arc-subdivision layout in its own `mind-map-layout.ts` module, single-tab-stop
  keyboard roving (mirroring `lr-word-cloud`), and `lr-topic-select`/`lr-topic-toggle` events.
  Multiple root topics hang off an implicit center hub; expansion state is keyed by topic id and
  survives streaming `topics` reassignment.
- 2ad038b: Recorded decision: `.msg` (Outlook) files are not supported this round. `.msg` is OLE/CFB binary per
  MS-OXMSG; the available npm parser (`@kenjiuno/msgreader` plus its `decompressrtf` companion) is
  below this library's maintenance bar for an optional peer. `.msg` files continue to resolve to
  `<lr-document-preview>`'s generic download fallback, exactly like any other unregistered format —
  convert to `.eml` server-side to use `<lr-email-viewer>` instead. No API change; this changeset
  exists to document the decision, guarded by a permanent regression test.
- 22c1006: Adds `<lr-neighbor-list>`: one entity's relationship rows (relation, direction, neighbor) with
  per-row navigate (`lr-entity-activate`) and expand-in-graph (`lr-node-expand`, matching
  `lr-graph`'s own event name/detail) affordances, optional relation grouping, and automatic
  `lr-virtual-list` virtualization above `virtualizeAt` rows.
- 22c1006: Adds `<lr-node-palette>`: a searchable, categorized node library for workflow editors — drag an
  item onto a `droppable` `lr-flow-canvas`, or place it by keyboard (`lr-palette-place`/
  `lr-select`). Fully decoupled from the canvas itself, agreeing only on the exported
  `FLOW_PALETTE_MIME_TYPE` drag-payload constant.
- a0e579a: Adds `<lr-notebook-viewer>`: a read-only Jupyter notebook (nbformat 4.x) renderer that parses
  `.ipynb` JSON natively and composes `lr-markdown`/`lr-code-block`/`lr-json-viewer` per cell,
  with `node-path`/`fragment` cell anchors and imperative search over cell sources and text outputs.
  Self-registers into the document-viewer registry for `application/x-ipynb+json`. Execution, kernels,
  and ipywidgets are out of scope; stream/error outputs render as plain preformatted text this round.
- 15062d0: Adds `<lr-page-rail>`: a virtualized vertical thumbnail rail for page-addressed documents, with
  per-page highlight heat markers. Wired mode (`viewer`/`for`) tracks page/count from a
  `PageThumbnailSource`-shaped viewer's own `lr-load`/`lr-page-change` events and lazily renders
  thumbnails as rows materialize (`lr-pdf-viewer` satisfies this structurally); mediated mode
  (`page-count`/`page`) works as a fully functional pager without a wired viewer. Roving-tabindex
  keyboard access via `lr-virtual-list`, typed-digit page jump, `lr-page-select` event.
- 22c1006: Adds `<lr-path-strip>`: a compact, horizontally scrollable node -> relation -> node chain
  rendering a GraphRAG reasoning path, with one roving tab stop across every element (nodes and
  relations alike), logical (RTL-mirroring) directed-edge arrows, and `lr-entity-activate`/
  `lr-relation-activate` events.
- 75c17bd: `lr-pdf-viewer` becomes the reference `DocumentAnchorTarget` implementation: resolves `page`,
  `text-quote`, and `region` anchors (`scrollToAnchor()`), paints highlights per page via
  `lr-highlight-layer`, exposes `getPageText(page)` and `renderPageThumbnail(page, canvas, options?)`
  for rail/search/chunking consumers, and emits `lr-load { pageCount }`,
  `lr-highlight-activate`/`lr-text-select`/`lr-anchor-result`. The `application/pdf` document-
  viewer registration now declares its anchor/text-select capabilities and forwards `anchor`/
  `highlights`. All additive — existing `src`/`page`/`zoom`/`nextPage()`/`previousPage()`/`zoomIn()`/
  `zoomOut()` and their events are unchanged.
- 1879c40: `lr-pdf-viewer` gains an imperative in-document search API (`search()`, `searchNext()`,
  `searchPrevious()`, `clearSearch()`, event `lr-search-change`), a public `goToPage(page):
Promise<boolean>` method, and `getOutline(): Promise<PdfOutlineItem[]>` for reading a PDF's table of
  contents. Search matches paint as `<mark part="search-match">` (`search-match-active` for the
  current one) without touching any highlight state. The `application/pdf` document-viewer
  registration now declares `search: true` in its capabilities. Previously there was no way to search
  inside a rendered PDF, jump to a page programmatically, or read its outline.
- 22c1006: Adds `<lr-provenance-panel>`: the grounding breakdown for one answer — a four-section disclosure
  panel (Entities / Relationships / Communities / Text chunks) composing `lr-entity-chip`,
  `lr-path-strip`, compact `lr-community-card`s, and a compact `lr-chunk-inspector`. Every child
  event bubbles straight through unmodified; its own `lr-toggle` event tracks per-section
  expand/collapse state, which survives streaming `provenance` reassignment.
- 2d15c51: Adds `<lr-push-to-talk>`: a mic capture button owning the full `getUserMedia`/`MediaRecorder`
  lifecycle — permission request, hold or toggle recording, optional chunked streaming
  (`lr-record-chunk`) for streaming STT, an opt-in RMS level meter (`lr-level`), a `max-duration-ms`
  auto-stop guard, and `lr-record-start`/`lr-record-stop`/`lr-record-cancel`/`lr-record-error`
  events. No SDK dependency — native browser APIs only. Previously lyra-ui had no voice-capture
  component at all; every agentic voice UI had to hand-roll this lifecycle from scratch.
- 3a2f6d2: Add `lr-rubric-form`: a configurable annotation rubric (LangSmith annotation-queue style) —
  score, category, and freeform-comment keys with a submit-and-next flow for working through an eval
  queue. Follows `lr-tool-param-form`'s exact `ElementInternals`-attached-directly, JSON-serialized
  form-value pattern; a `score` key renders `lr-segmented` (≤10 integer steps) or `lr-slider`,
  `category` renders `lr-select` or `lr-checkbox-group` (`multiple`), and `comment` renders
  `lr-textarea`.
- c388b94: Add themeable static edge fades and native horizontal scrolling to overflowing `lr-segmented` and
  `lr-tabs` rows.
- de5b8b7: Adds `<lr-sequence-strip>`: a compact, one-thin-cell-per-item strip visualizing a sequence of
  categorical states with an optional secondary per-cell marker (e.g. a CI build-step strip, a
  log-severity strip, or — the motivating case — a per-turn conversation-history strip). Pure CSS/flex,
  zero dependencies, `role="img"` with an auto-generated per-category "label: count" `aria-label`
  summary (matching `lr-sparkline`'s accessibility model), plus a pointer-hover tooltip showing each
  item's own label.
- 22c1006: Adds `<lr-source-picker>`: a checkbox tree/list scoping which sources ground the next answer —
  tri-state folders, select-all, `lr-file-icon` type icons, and built-in search that keeps matching
  descendants' ancestors visible. Deliberately not `FormAssociated` (a scoping panel, not a form
  control, mirroring `lr-tool-select-dialog`'s stance) and renders its own `role="tree"` rather than
  composing `lr-tree`, since `TreeItem` has no tri-state checkbox model.
- 685eb35: Add `lr-span-waterfall`: the horizontal-timeline projection of the same `LyraSpan[]`
  `lr-trace-tree` consumes — a time axis, one row per span in start order, and status-toned,
  keyboard-navigable bars (Langfuse timeline / Temporal event-history style). Declarative
  `viewStartMs`/`viewEndMs` window props (composable with `lr-time-range` as a brush) stand in for
  zoom/pan gestures this round. Both components emit the same `lr-span-select { id }` and accept
  the same `activeSpanId`, so a host syncs selection between them with two listeners and one property
  binding.
- 2ad038b: `lr-spreadsheet-viewer` and `lr-csv-viewer` gain `cell-range` anchor-target support
  (`highlights`, `activeHighlightId`, `scrollToAnchor()`, event `lr-highlight-activate`) and an
  imperative in-document search API (`search()`, `searchNext()`, `searchPrevious()`, `clearSearch()`,
  event `lr-search-change`) — identical on both viewers, addressing cells by the same 1-based raw
  grid (header row included) an A1 reference already implies. Spreadsheet's search/anchor resolution
  additionally spans every sheet, switching `lr-tabs` as needed. Both registry entries now declare
  `capabilities: { anchors: ['cell-range'], search: true, textSelect: false }`. Previously there was
  no way to highlight or search a specific cell/range in a rendered spreadsheet or CSV file.
- 761ab24: Adds `<lr-stack-trace>`: parses V8/JS-TS, Firefox/Safari, and Python stack traces (including
  chained-error groups) into a message plus collapsible, activatable frames (`lr-frame-select`),
  folding internal frames (`node_modules/`, `node:internal`, `site-packages/`, ...) behind a
  count-labeled toggle. Falls back to verbatim raw text when nothing parses.
- b33bb35: Adds `<lr-suggestion-chips>`: starter prompts (empty thread) and follow-up suggestions (after a
  response) as a horizontally scrollable chip row (or a wrapping grid via `wrap`), each with an optional
  secondary detail line. Fires `lr-suggestion-select` (`{ id, label }`) on activation — never writes
  into a composer or sends anything itself. Keyed `repeat()` on `id` preserves focus across a mid-stream
  suggestions replacement.
- 2ad038b: `lr-svg-viewer` and `lr-document-preview` (its image-format path) gain an opt-in `zoomable`
  property that wraps the rendered content in an internal `lr-zoomable-frame` for pan/zoom
  inspection, plus display-only `region` anchor-target support (`highlights`, `activeHighlightId`,
  `scrollToAnchor()`, event `lr-highlight-activate`) for percent-unit bounding-box highlights that
  scale with the zoom level. `zoomable` defaults to `false` on both, so an inline thumbnail (e.g. in a
  chat stream) doesn't unexpectedly grow a focusable zoom-chrome viewport. Previously neither viewer
  had any pan/zoom or region-highlighting capability.
- 1e051a4: `lr-swatch-picker` options gain an optional `icon` field (`SwatchOption.icon`, mirroring
  `lr-segmented`'s `SegmentedItem.icon`): a consumer-supplied shape (e.g. a brand glyph) rendered in
  place of the plain filled circle, exposed as `::part(swatch-icon)`. A `currentColor`-based SVG picks up
  the option's `color` automatically through the swatch's `color` custom property, so consumers who
  previously hand-rolled a row of colored icon buttons (rather than plain color circles) can now use the
  picker directly.

  The selected swatch also gains two new opt-in, off-by-default custom properties for a more emphatic
  selected state: `--lr-swatch-picker-selected-blur` (0 by default, a crisp ring; set a real length for
  a soft glow tinted by the swatch's own color -- works for both a plain color circle and an icon swatch,
  via a `box-shadow`/`drop-shadow` split so the glow follows the icon's actual silhouette rather than an
  invisible transparent box) and `--lr-swatch-picker-shine-duration` (0s by default, static; set a real
  duration for a rhythmic brighten-and-settle pulse, disabled under `prefers-reduced-motion: reduce`).
  Together they cover a "shining" gemstone-style accent-theme picker without changing the default look
  for any existing consumer.

- 55140c3: `lr-table` gains heat-tint mode: a per-column `heatValue(row)` accessor drives a `color-mix()`-based
  cell background computed from a shared min/max scale across the whole grid (auto-derived from the
  data, or overridden via the new `heatTintScale` property), matching `lr-heatmap`'s own
  `--lr-heatmap-scale-lo`/`-hi` ramp-token convention via new `--lr-table-heat-tint-lo`/`-hi` custom
  properties. Previously a consumer needing a value-driven cell background had to hand-compute a color
  string themselves via the existing `cellStyle` escape hatch.
- 6f7c938: `lr-table` gains `rowTotal`/`grandTotal`: a trailing column showing each row's total (`rowTotal`)
  and, when at least one column also defines `footer`, a grand-total cell at its bottom-right
  intersection (`grandTotal`). Both share the existing `footer(rows)` hook's "consumer computes/renders,
  table only positions" contract rather than assuming addition. Previously a consumer needing row/grand
  totals alongside `lr-table`'s existing per-column `footer` had to render them outside the table
  entirely, breaking column alignment.
- 4cae327: Adds `<lr-task-list>`: a live, collapsible tracker for an agent's plan, embedded in the
  transcript. Renders ordered steps with per-step lifecycle status (`pending`/`running`/`success`/
  `error`) and one level of nested sub-steps; status changes are announced through an internal
  throttled live region. A dynamic `detail-<id>` slot per item accepts rich content such as a
  `<lr-tool-call-chip>`. Unlike `<lr-stepper>` (a single-selection navigation control),
  `<lr-task-list>` is a read-only status report — several steps may be `running` at once, and
  there is no selection.
- bf223ca: Adds `<lr-terminal>`: a read-only, virtualized ANSI console for streamed agent/tool output — SGR
  color rendering (16 named colors, 256-color, truecolor), stick-to-bottom `follow` with a
  `lr-follow-change` event, `write()`/`content` streaming, `\r`/`\b`/`\t` cursor handling so progress
  bars render correctly, in-buffer `search()`/`searchNext()`/`searchPrevious()`/`clearSearch()`,
  `line-range` highlight/anchor support (`scrollToAnchor()`, `lr-highlight-activate`), and built-in
  copy/download affordances. Not a PTY — no stdin/keystroke handling or cursor-addressed full-screen
  apps.
- 52a90e5: Adds `<lr-test-results>`: a pass/fail suite summary with visible (never color-only) per-status
  counts, `aria-pressed` status filter toggles, and failure rows that auto-expand by default and can
  host a slotted `detail-{testId}` diff/code block. Row state (expansion, filter) survives a streaming
  `suites` reassignment mid-run, and a run's completion is announced through an internal live region.
- 967e785: Adds `<lr-thread-list>`: the conversation sidebar — a grouped ("Pinned / Today / Yesterday / Previous
  7 days / …"), searchable list of chat sessions built on `lr-conversation-item` and virtualized via
  `lr-virtual-list`. Data mode (`threads` array) renders rows with optional pin/archive/delete row
  actions, all controlled events (`lr-thread-pin`/`-archive`/`-delete`/`-rename`) carrying the
  _requested_ new state — no CRUD or persistence of its own. Slotted mode (host-supplied
  `lr-conversation-item`s) skips grouping/virtualization/row-actions entirely, for a host that wants
  full control over a short, unconstrained list.
- 9448c10: Add `lr-trace-tree`: a collapsible span hierarchy for one agent/LLM trace (Langfuse/LangSmith
  run-tree style) — kind icon, name, status, an inline duration bar on the shared trace time scale,
  and optional tokens/cost columns. Consumes a flat `LyraSpan[]` array (hierarchy derived from
  `parentId`); expand state survives a streaming reassignment of `spans`. The shared `LyraSpan` type
  (`components/trace-tree/span.ts`) is also consumed by the upcoming `lr-span-waterfall`, so the
  two components can render the same trace as two synchronized projections.
- bef6b0d: Adds `<lr-transcript-feed>`: a data-driven live-captions surface for an in-progress voice session —
  `entries` in (`{ id, speaker?, text, interim?, timestamp? }[]`), reconciled keyed by `id` so a same-id
  interim-to-final upgrade moves the row into the announcing `role="log"` region without a duplicate
  announcement. Ships the shared stick-to-bottom "follow" contract (`follow`/`lr-follow-change`, the
  same vocabulary `lr-terminal` uses). No dependency, no STT/diarization built in — bring your own
  transcription source and stream entries in.
- ec5fe96: Adds the `DocumentAnchorTarget` mixin (`internal/anchor-target.ts`) and its `LyraAnchorTarget`
  interface: the shared implementation of the anchor-target contract every anchor-capable lyra-ui
  viewer adopts — `highlights`/`activeHighlightId`/`anchor` properties, `scrollToAnchor()` with a
  generation-guarded retry-until-loaded loop and screen-reader announcements, and
  `lr-highlight-activate`/`lr-text-select`/`lr-anchor-result` event plumbing including
  selection->anchor emission. Internal module; no adopter yet in this release (`lr-pdf-viewer` adopts
  it next). No behavior change for any existing component.
- 44b6de7: Adds the shared `LyraAnchor`/`LyraHighlight` grounding-bridge type module
  (`@aceshooting/lyra-ui/components/document-viewer/anchors.js`): a W3C Web-Annotation-inspired
  discriminated union (`page`, `text-quote`, `fragment`, `line-range`, `cell-range`, `cfi`,
  `time-range`, `region`, `node-path`) that every anchor-capable viewer and every knowledge-grounded
  citation surface will address a passage through. Pure types plus one constant; nothing to register,
  no runtime behavior change for existing components.
- c644abd: Widens `DocumentFile` with optional `anchor`/`highlights`/`alt` fields and
  `DocumentRendererDefinition` with an optional `capabilities` declaration; `lr-document-viewer` gains
  matching `anchor`/`highlights`/`alt` properties, forwards them to the resolved renderer, and emits
  `lr-anchor-result { found }` once per applied anchor. Every addition is optional and every existing
  registration/usage is unaffected — this removes the previous limitation where even a renderer's own
  props (like pdf's `page`) couldn't be reached through the router.
- 5f92994: Adds `internal/text-highlights.ts`: a highlight paint manager for HTML-flow document viewers, using
  the CSS Custom Highlight API when available and falling back to `<mark>`-wrapping otherwise, with a
  uniform `acquireHighlightHandle()` API that never requires callers to branch on browser support
  themselves. Internal module with no public tag and no adopter yet in this release; ships ahead of the
  markdown/html-viewer/docx-viewer highlight support that will consume it. No behavior change for any
  existing component.
- b067b83: Adds `internal/text-quote.ts`: dependency-free `text-quote` anchor resolution (quote/prefix/suffix ->
  DOM `Range`, and the reverse — a selection `Range` -> a `text-quote` anchor with captured context).
  Internal module with no public tag; used by the `DocumentAnchorTarget` mixin's default selection
  handling and by `lr-pdf-viewer`'s anchor/highlight resolution. No behavior change for any existing
  component.
- bc75a1f: Adds `<lr-usage-badge>`: a compact, static resource strip for one message or run — tokens in/out,
  cost, latency — with a hover/focus tooltip breakdown (full grouped figures, plus a computed Total
  tokens row when both counts are set). Purely formatting: it computes no counts, rates, or prices,
  and every segment is independently optional. Reuses `<lr-tool-call-chip>`'s hover/focus/Escape
  tooltip contract. Distinct from `<lr-context-meter>` (occupancy of a fixed capacity) and
  `<lr-generation-status>` (a live ticking readout with a Stop button) — this is the static spend
  record shown after a message or run completes.
- f3c744b: `lr-virtual-list` gains a public `scrollToIndex(index, { align, behavior })` method: scrolls a
  specific row into view (`align: 'start' | 'end' | 'auto'`, reduced-motion-aware `behavior`) without
  the `aria-current`/"active row" side effect of the existing `active-id` property. In
  `row-height="auto"` mode, a far-off target's estimate-based offset is corrected with a single re-scroll
  once the row's real height is measured. Previously there was no way to programmatically scroll to a
  specific row at all except by driving `active-id`, which also marks that row as the current selection —
  a streaming transcript's own stick-to-bottom auto-scroll has nothing to do with "selection."
- e24ae10: Adds `<lr-voice-picker>`: a TTS voice selector mirroring `lr-model-select`'s closed-dropdown/
  free-text-combobox dual mode and form-association, with a `catalog` entry shape carrying
  `language`/`description`/`previewUrl`, and an event-first preview affordance (`lr-preview-request`,
  cancelable) that plays through one internal `<audio>` when a `previewUrl` is present and the host
  doesn't take over. No TTS SDK, no catalog fetching, no selection persistence — those stay host
  concerns.
- 37a89cb: Adds `lr-widget-renderer`'s internal type registry (`registerWidgetType()`,
  `getDefaultWidgetTypeRegistry()`) and its security-critical, DOM-free allowlist resolver
  (`resolveTree()`): unknown widget types and disallowed/mistyped props are skipped, never rendered;
  `forcedProps` always win; a child's `slot` outside its parent's allowlist renders unslotted; depth
  (32) and node-count (5000) caps are enforced. No public API surface change on its own — groundwork
  for the `<lr-widget-renderer>` element, landing in the same release.
- bcd3c2b: Adds `<lr-widget-renderer>`: renders an agent-streamed declarative JSON widget tree through an
  allowlisted `type → lyra tag` registry (`card`/`badge`/`button`/`stat`/`result-card`/`result-field`/
  `markdown`/`image` built in, plus `row`/`col`/`text` structural built-ins) — unknown types and
  disallowed/mistyped props are silently skipped, never rendered, with a deduped dev-mode warning; a
  single bubbling `lr-widget-action` event surfaces actions; streamed updates reconcile keyed by
  `id` (or structural path), so a mapped widget's own internal state survives a re-resolve.
  `registerWidgetType()` extends the default registry app-side; a per-instance `registry` property
  fully overrides it. No `innerHTML`/`unsafeHTML` path exists anywhere in the implementation.
- dc168c7: Adds `<lr-xml-viewer>`: a `DOMParser`-based collapsible XML tree view mirroring
  `lr-json-viewer`'s UX (`collapsed-depth`, `copyable`, structural-path expand state that
  survives a same-shape `xml` reassignment), with an imperative `search()`/`searchNext()`/
  `searchPrevious()`/`clearSearch()` API and `node-path` anchors (element indices plus an optional
  trailing `'@attrName'` segment for attribute-level targeting). Self-registers into the
  document-viewer registry for `application/xml`/`text/xml` and `.xml`/`.xsd`/`.xsl`/`.xslt`/`.rss`/
  `.atom` files. No XPath/XSLT evaluation, no editing, no schema validation.

### Patch Changes

- 7bbd069: Internal only: adds three new `src/internal/` modules (`slugger.ts`, `cell-range.ts`,
  `viewer-search.ts`) and five new localization keys (`viewerSearchMatchCount(Plural)`,
  `viewerSearchNoMatches`, `viewerSearchActiveMatch`, `viewerHighlightLabel`) used by upcoming
  per-viewer search/anchor/highlight support. No consumer-visible behavior change on its own.
- da8bbf0: Requires `@aceshooting/lyra-flags` `^1.4.0` (up from `^1.3.0`) as the optional flag-asset peer.
  1.4.0 is a docs/metadata-only release of the flags package (no runtime change), so this is a
  range refresh, not a behavioral requirement bump.
- 967e785: Fixes `<lr-virtual-list>`: a `groups`-supplied group marker no longer carries `role="heading"`
  `aria-level="2"`. Those markers render inside the scroll container's `role="list"`, and ARIA's `list`
  role only permits `listitem` as a direct owned child — a `heading` sibling was a critical
  `aria-required-children` violation for any consumer combining `groups` with an accessibility check
  (surfaced by `<lr-thread-list>`'s date-grouped rows). The marker is still rendered as visible,
  non-interactive text; it's just no longer exposed as a heading landmark.

## 3.7.0

### Minor Changes

- 05c9f9c: Add `appearance="link"` to `<lr-button>`: a true inline-link tier that renders as zero-chrome underlined text — no padding, border, border-radius, or `min-block-size` floor — colored from the same `--lr-button-accent` token `appearance="plain"` uses (so `variant` still selects the link color) and inheriting the surrounding font-size/weight so it flows within a sentence rather than as a button-shaped control. Previously the smallest `<lr-button>` was still a padded, rounded, 24px-tall pill with a (transparent-but-present) border and no `text-decoration`, so an inline text link had to be hand-rolled; `appearance="link"` now covers that case directly. The notable design choice: the link rules are declared after the per-`size` rules so `font: inherit` and the zero padding/border/min-height win over whatever `size` is set, and the shared `[part='base']:focus-visible` outline is deliberately left intact.
- 2ed831d: `<lr-file-icon>` gains a `size` property (bytes, formatted via the same convention as `<lr-attachment-chip>`) shown alongside its label, and exposes the raw MIME type as a `title` tooltip.
- a5482d8: Add `<lr-swatch-picker>`, a single-select picker over a small, fixed set of color swatches — the row-of-round-accent-color-buttons pattern apps hand-roll, generalized into a first-party component. It carries the WAI-ARIA APG `radiogroup` contract (`role="radiogroup"`/`role="radio"`, roving tabindex, automatic activation on click or arrow-key move, cyclic Arrow/Home/End navigation), takes an `options: { value; color; label }[]` array plus a controlled `value`, and emits `lr-change` (`detail: { value }`) only when the selection actually changes. It is distinct from `<lr-color-picker>`'s freeform native color input: this picks exactly one of N designer-chosen named colors.

  Notable design choice: the selection ring uses a dedicated `--lr-swatch-picker-selected-color` token (defaulting to `--lr-color-brand`) so it retheme independently of the focus ring, mirroring `<lr-heatmap>`'s `--lr-heatmap-selected-color`; each swatch's fill comes from its option's `color`, applied through a per-swatch custom property so a consumer's `::part(swatch)` background rule can still override it.

### Patch Changes

- f3a606f: Fix `<lr-file-icon>`'s format badge overflowing its fixed size for multi-word localized labels (e.g. "Word document") — long badge text now truncates with an ellipsis instead of spilling outside the badge.
- 64e6cb6: Document `<lr-file-icon>`'s new `size` property and `size` csspart in `llms-full.txt`, and add the explicit-MIME-vs-filename-extension precedence test called for by the original feature request's acceptance criteria.
- 0975bcd: Fix `<lr-map>` throwing an unhandled error when the underlying maplibre-gl `Map` emits an `'error'` event (e.g. a tile/style source request failing) with no listener attached — maplibre-gl's `Evented` base rethrows in that case. The error is now caught and logged via `console.error` instead of surfacing as an uncaught exception.

## 3.6.0

### Minor Changes

- 30db265: Nine new components:

  - `lr-animated-image` — a still/animated-GIF-style image that pauses on `prefers-reduced-motion`
    and exposes a play/pause toggle.
  - `lr-animation` — declarative Web Animations API wrapper for a slotted target, with named
    timing presets, `prefers-reduced-motion` handling, and `lr-start`/`lr-finish`/`lr-cancel`
    events.
  - `lr-avatar-group` — a stacked, overlapping set of avatars with a "+N" overflow indicator.
  - `lr-include` — fetches and renders external HTML/Markdown/plain-text content client-side, with
    URL validation and DOMPurify sanitization.
  - `lr-known-date` — a form-associated day/month/year input for approximate or partial dates
    (e.g. a birth date where only the year is known).
  - `lr-lightbox` — a full-screen, modal, click-to-enlarge image viewer with prev/next navigation
    across an ordered set of images, built on the same shared overlay infrastructure as
    `lr-dialog`/`lr-command-palette`.
  - `lr-qr-code` — renders a QR code from text/URL data, via the optional `qrcode` peer dependency
    (same optional-peer pattern as the chart/map bundles).
  - `lr-random-content` — displays a randomly (or sequentially) chosen subset of its slotted
    children, with optional autoplay.
  - `lr-timeline`/`lr-timeline-item` — a vertical event timeline with per-item status/icon
    markers.
  - `lr-tour` — a guided, multi-step product-tour overlay that highlights target elements in
    sequence.

### Patch Changes

- e1aca7e: Harden shared infrastructure and close cross-component consistency gaps:

  - `lr-contact-viewer` and `lr-email-viewer` now expose a proper localized `aria-label` on their
    root surface (previously had no naming mechanism at all); `lr-calendar-viewer` gets the same
    fallback chain's final localized tier.
  - `lr-stat`'s trend announcement now interpolates the percentage into one localized template
    instead of concatenating separately-localized fragments (word order safe for non-English locales).
  - Fixed a real bug in `lr-model-settings-panel`'s `decimalPlaces` helper that returned `0` instead
    of the correct precision for exponential-notation step values (e.g. `1e-7`); it now shares the
    same exponential-aware implementation as `lr-slider`/`lr-time-range` via a new
    `src/internal/numbers.ts` export instead of a diverging local copy.
  - Deduplicated five other byte-identical/near-identical helpers that had drifted into 2-5 separate
    component files each (`prefersReducedMotion`, canvas-context memoization, swatch-color
    sanitization, slotted-content detection, and a title-attribute-stripping mixin) into single
    `src/internal/` implementations.
  - Removed an unused, never-adopted RTL helper (`rtlAwareSide`/`PhysicalSide`) from
    `src/internal/rtl.ts`.
  - Added missing accessibility test coverage for `lr-icon-button` and the standalone `lr-option`
    element (previously the only two custom elements in the library with no axe check).

## 3.5.0

### Minor Changes

- 681ed1f: Broad component hardening pass across ~50 components:

  - `lr-command-palette` now uses the shared overlay infrastructure (`lr-dialog`'s
    focus-trap/Escape/backdrop/scroll-lock manager) instead of a bespoke implementation, adds
    `aria-activedescendant` tracking, and keeps the highlighted row scrolled into view.
  - `lr-table` forwards `spellcheck`/`autocapitalize`/`autocorrect` to its filter input and inline
    text-cell editor, matching the string-aware `spellcheck` converter already used by
    `lr-textarea`/`lr-model-select`.
  - `lr-token-input` and `lr-code-editor` fix `label`/`hint`/`error` slot-vs-attribute detection
    (a `[part]:empty` selector never matches since the part always contains a `<slot>`), and
    `lr-token-input` adopts the `effectiveDisabled`/`_fieldsetDisabled` pattern so a `<fieldset
disabled>` ancestor no longer permanently overwrites its own `disabled` property.
  - `lr-calendar`: month grid gets proper `role="grid"`/`role="row"`/`role="gridcell"` semantics,
    per-day `aria-label`, a sanitized event-color style (rejects `url(...)` and anything else that
    isn't real CSS color syntax), and RTL-aware nav chevrons; `firstDayOfWeek` tolerates out-of-range
    input instead of producing `Invalid Date`.
  - `lr-icon` clones custom slotted SVG content into the component's own `<svg>` so slotted
    path/circle/group children paint reliably in Chromium.
  - `lr-document-preview` simplifies its abortable-fetch generation tracking onto the shared
    `beginAbortableLoad` helper.
  - `lr-app-rail-item`'s tooltip text now ignores text incidentally living in the decorative `icon`
    slot, mirroring `lr-chip`'s `labelText` getter.
  - Smaller accessibility/consistency fixes across app-rail, attachment-chip, breadcrumb, callout,
    chart/histogram, checkbox-group, data-grid, empty, format-\*, heatmap, html-viewer,
    image-comparer, intersection/mutation/resize-observer, map, model-select, pdf-viewer,
    phone-input, progress, radio/radio-group, responsive-panel, scroller, segmented, sparkline,
    split, stat, stepper, streaming-text, switch, tool-param-form, tool-select-dialog, widget, and
    zoomable-frame, plus a new standalone `breadcrumb-item.styles.ts` module and expanded test
    coverage throughout.

## 3.4.0

### Minor Changes

- d0ee919: Add command-palette, checkbox-group, token-input, icon/icon-button, code-editor, data-grid, and
  calendar components. Harden file-input with clipboard paste, native directory selection, and
  dropped-folder rejection reporting.
- 1293f48: Hardening pass across ~70 components: document the button/spinner interaction custom-property APIs
  (`--lr-button-width`, hover-brightness, active-scale, spinner-duration) and add missing cssparts;
  `lr-breadcrumb` now reads its accessible-name override from the standard `aria-label` attribute
  (was `accessible-label`); phone-input preserves the caret through adapter reformats and ships a
  libphonenumber-js-backed adapter path with a clearer incomplete-number message; prune unused
  localization keys and size/line-height tokens; broaden test coverage across the library.

## Unreleased

### Minor Changes

- Added `<lr-command-palette>` with searchable command registration, groups, keyboard navigation,
  Escape dismissal, and a configurable `mod+k` shortcut.
- Added `<lr-checkbox-group>` and `<lr-token-input>` as form-associated composite controls with
  array values, native reset/validity behavior, localized chrome, and accessible focus/editing APIs.
- Added `<lr-icon>` and `<lr-icon-button>` as dependency-free SVG and icon-only action primitives.
- Added `<lr-code-editor>` with line numbers, tab insertion, native textarea selection APIs, and
  editing-assistance passthrough.
- Added `<lr-data-grid>` with sortable headers, roving cell focus, row selection events, loading/
  empty states, and responsive overflow.
- Added `<lr-calendar>` with responsive month and agenda views, event markers, date navigation,
  RTL-aware keyboard navigation, and date/event selection events.
- Hardened `<lr-file-input>` with clipboard paste support, optional native directory selection, and
  explicit dropped-folder rejection reporting.
- Updated the component catalog, consumer API reference, custom-elements manifest, stories, and
  accessibility/behavior coverage for the new public surface.

## 3.3.0

### Minor Changes

- 7e7cc44: Harden every remote-resource viewer against oversized, cancelled, and failed loads, and close a set of localization gaps.

  **Resource limits.** A new internal resource loader caps any remote resource a viewer fetches at 25 MB before handing it to a parser, enforced by streaming the response so the cap holds even when the server omits `Content-Length`. Parsed tabular data is additionally capped at 10,000 rows and 1,000 columns before it is retained or rendered. Exceeding either limit now surfaces the localized `documentPreviewResourceTooLarge` message instead of attempting the parse. This is a behavior change for consumers previewing documents above those thresholds — they will now see a size error where the viewer previously tried (and typically hung or crashed) on them.

  **Cancellable loads.** `LyraElement` gained internal `beginAbortableLoad()` and `scheduleAfterUpdate()` helpers. In-flight fetches are now aborted when the element disconnects or its `src` changes again, and loads are coalesced to one per update rather than firing from `willUpdate`. This fixes stale responses racing a newer `src` and work continuing after an element is removed from the DOM. A `src` assigned while an element is detached is held and replayed when it reconnects, rather than being dropped.

  **Error messages no longer leak internals.** Viewers previously rendered raw `error.message` text (fetch/parser internals, URLs) directly into the UI on failure. They now render the localized `documentPreviewFailedToLoad` message, with the underlying error still available to consumers via the `lr-render-error` event.

  Affected viewers: `lr-archive-viewer`, `lr-calendar-viewer`, `lr-contact-viewer`, `lr-csv-viewer`, `lr-dataset-viewer`, `lr-docx-viewer`, `lr-document-preview`, `lr-ebook-viewer`, `lr-email-viewer`, `lr-html-viewer`, `lr-pdf-viewer`, `lr-pptx-viewer`, `lr-spreadsheet-viewer`, `lr-svg-viewer`.

  **Localization fixes.**

  - Form-associated components rendered the required-field validation message as a hardcoded English string (`Please fill out this field.`). It now resolves through the `fieldRequired` message key, so `registerLyraLocale()` and per-element `strings` overrides apply. Note that this also changes the default English text to `This field is required.` — if you assert on `validationMessage`, update the expected string.
  - Removed a duplicate `hidePassword` member from the `LyraMessageKey` union. The key itself is unchanged and still used by `lr-input`; only the redundant second declaration is gone.

  **Component coverage contract.** A new `check-component-coverage.mjs` gate runs as part of `contract-policy` (and therefore `lint`), requiring every public tag in the manifest to be exercised by a story and a behavior test, and every component family to carry an accessibility assertion. Stories and tests were added across the library to satisfy it, and `test:coverage` now runs the full test suite rather than five hardcoded files. No public API change.

## 3.2.0

### Minor Changes

- 62c6b05: `lr-attachment-chip` gains a preview action: a new `previewSrc` property (used when `file` is
  unset; a real `File` takes precedence via a temporary blob URL) and `previewable` boolean (default
  `true`) show a new `preview-button` part whenever a file or preview source is available, emitting
  `lr-preview` (`detail: { id, name, mimeType, src }`) to open `<lr-document-viewer>` with the
  same effective MIME type. `lr-document-viewer` gains a matching `download-link` slot and
  `lr-download` event for a safe native download action. Both properties/events are additive and
  default off/no-op, so existing usages are unaffected.

## 3.1.0

### Minor Changes

- de80dc5: Adds `<lr-archive-viewer>` for listing names and human-readable sizes inside `.zip` archives via
  the optional `jszip` peer. It registers standard ZIP MIME types and a `.zip` filename fallback with
  `<lr-document-viewer>`; other archive formats remain on the generic download fallback.
- de80dc5: Adds the optional `line-numbers` display to `<lr-code-block>` and `<lr-code-block-core>`.
- 53c7c13: Add sanitized SVG and HTML viewers, plus PapaParse-backed dataset and vCard contact viewers to the document renderer registry.
- c6dd26c: Adds `<lr-document-viewer>`, a dialog-hosted, format-dispatching document viewer, plus a
  `registerDocumentRenderer()` registry for plugging in per-format renderers. Files without a
  registered renderer fall back to the existing `<lr-document-preview>` component.
- d992ee7: Adds `<lr-docx-viewer>`, rendering `.docx` Word documents as sanitized semantic HTML through the
  optional `mammoth` and `dompurify` peers. It registers the official WordprocessingML MIME type and
  falls back to matching `.docx` filenames.
- de80dc5: Adds `<lr-ebook-viewer>` using the optional `epubjs` peer and registers EPUB files with the
  document-viewer registry.
- 49f7b87: Adds `<lr-email-viewer>` for sanitized `.eml` messages via the optional `postal-mime` and
  `dompurify` peers, plus `<lr-calendar-viewer>` for `.ics` event lists via optional `ical.js`.
  Both viewers register their standard MIME types and filename-extension fallbacks with
  `<lr-document-viewer>`.
- de80dc5: Adds `getFileTypeMetadata()`, `registerFileTypeMetadata()`, and `<lr-file-icon>` for localized,
  tokenized MIME/filename format presentation.
- 68bb5e3: Adds `<lr-pdf-viewer>`, a PDF renderer built on optional `pdfjs-dist`, with pagination, zoom, selectable text, and virtualized page rendering.
- de80dc5: Adds `<lr-pptx-viewer>` using the optional `@aiden0z/pptx-renderer` peer for best-effort client-side
  PPTX rendering with a persistent fidelity notice.
- 0b6f412: Add SheetJS-backed spreadsheet and PapaParse-backed CSV document viewers with virtualized rows.

## 3.0.0

### Major Changes

- a712749: **Breaking:** the outer, externally-overridable tier of the design-token chain no longer lives in
  the previous external theme-input namespace — it moved to lyra's own `--lr-theme-*` namespace
  (for example, the brand fill input now uses `--lr-theme-color-brand-fill-loud`). Any consumer
  retheming components through the old external custom properties must rename those
  properties to `--lr-theme-*`; the two-tier override mechanism itself (set one property at any
  ancestor to retheme every component) is unchanged. This removes lyra-ui's remaining live runtime
  CSS coupling to Web Awesome.

### Minor Changes

- 66c8819: Adds an independent `--lr-theme-*` shared token layer, aligns `<lr-button>`'s medium size with
  the standard Lyra font scale, exposes its host-width and size contracts, and adds opt-in native
  per-cell semantics to `<lr-heatmap>` through `accessible-cells`.

### Patch Changes

- 11e6a03: `lr-details`/`lr-accordion-item` no longer render the localized "Details" fallback text alongside rich content slotted into `summary` when the plain-string `summary` prop is left unset. The fallback previously always rendered whenever `summary` was empty, regardless of whether a `slot="summary"` child was present — visible only when a consumer needed markup (an icon, multiple spans) in the summary rather than a plain string.
- 581f5f3: `installHappyDomFormAssociatedShims()` no longer throws a `ReferenceError` when `HTMLElement` isn't a global at all — e.g. a plain Node Vitest environment sharing one `setupFiles` entry with happy-dom/jsdom test files. It previously read `HTMLElement.prototype` unconditionally, contradicting its own documented "safe to call unconditionally from a shared setup file used across multiple test environments" contract.
- b5de65c: `lr-popover`/`lr-dropdown`/`lr-tooltip`'s `[part="popup"]` is now `position: fixed` from the start instead of only once the popup is first opened and JS positions it. Previously, while closed, the popup stayed `position: static` sized to its full slotted content, inflating the component's own inline-block host box to match -- an invisible-but-still-hit-testable area that could sit on top of unrelated page content and intercept pointer events until the trigger was first clicked.

## 2.13.0

### Minor Changes

- 80cb577: `lr-table` gains opt-in row selection (`selectionMode: 'single' | 'multiple'`, `selectedKeys`,
  `lr-selection-change`), a built-in filter field (`filterable`, `filterText`, `filter`,
  `lr-filter-change`), controlled pagination through `<lr-pagination>` (`pageSize`, `page`,
  `totalItems`, `paginationMode`, `lr-page-change`), a `loading` state with an indeterminate
  spinner, per-column double-click inline editing (`TableColumn.editable`/`editValue`/`editType`,
  `lr-cell-edit`), and row grouping (`groupBy`, `groupLabel`). All new properties default to
  today's exact behavior when left unset.
- 5628327: `lr-input` and `lr-textarea` now also emit native-style `input`/`change` events (composed,
  matching the native element's own timing) alongside the existing `lr-input`/`lr-change`
  aliases, so consumers migrating from a native `<input>`/`<textarea>` don't need to rename their
  listeners. Both components also forward `spellcheck`, `autocapitalize`, `autocorrect`,
  `inputmode`, and `enterkeyhint` to their internal native control.
- d009cd8: Adds a new "Web Awesome parity primitives" family: `lr-badge`/`lr-tag`, `lr-callout`,
  `lr-divider`, `lr-breadcrumb`/`lr-breadcrumb-item`, `lr-details`/`lr-accordion`/
  `lr-accordion-item`, `lr-button-group`, `lr-carousel`/`lr-carousel-item`,
  `lr-color-picker`, `lr-drawer`, `lr-popover`/`lr-tooltip`/`lr-dropdown`/
  `lr-dropdown-item`, `lr-radio`/`lr-radio-group`, `lr-rating`, `lr-spinner`,
  `lr-progress-bar`/`lr-progress-ring`, `lr-format-number`/`lr-format-date`/
  `lr-format-bytes`/`lr-relative-time`, `lr-image-comparer`, `lr-zoomable-frame`,
  `lr-scroller`, and headless `lr-intersection-observer`/`lr-mutation-observer`/
  `lr-resize-observer` wrappers. `lr-number-input` and `lr-time-input` join `lr-input` as
  sibling native-input-type primitives.

  These close out the remaining free-tier Web Awesome components with no prior lyra-ui equivalent —
  133 tags total, up from 97.

### Patch Changes

- 5766257: `installHappyDomFormAssociatedShims()`'s stub `ElementInternals` now implements `setValidity()` as a no-op. `AnchoredValidityController` (used by every form-associated component) calls `internals.setValidity()` on every update, not just at construction, so a consumer's happy-dom test suite installing the shim would throw the moment any shimmed component's value changed after mount.

## 2.12.0

### Minor Changes

- 42036af: `lr-table` gains expandable rows: a table-level `expandedContent?: (row) => unknown` renders a
  full-width panel beneath any row whose key is in the new consumer-owned `expandedKeys: Set<string |
number>` property, toggled via a built-in leading chevron cell and the new `lr-row-expand-toggle`
  event (`detail: { row, key }`). An optional `canExpand?: (row) => boolean` gates which rows get an
  interactive toggle at all. All three properties are additive and default to a no-op, so existing
  tables are unaffected.

- d612939: Make card headers wrap with their actions in narrow allocations, expose citation previews through
  a stable tooltip relationship, and localize the complete citation status announcement.

  Add reactive `accessibleLabel` overrides to both code-block variants and media cards so host
  `aria-label` values reach the actionable or semantic element inside shadow DOM. Media-card's
  unnamed actions now use complete, per-kind localized messages.

  Keep markdown within logical narrow allocations and make its `streaming` state hold `aria-busy`
  until the final content update.

- 159f3c9: `lr-file-input` now forwards host accessible names to its dropzone and file input, exposes an
  imperative focus target, reports explicit enabled/disabled ARIA state, and announces accepted and
  rejected file counts with correct singular and plural messages.

  `lr-export-button` now forwards host accessible names to its trigger, exposes native focus and
  blur methods, and keeps long format menus within the positioned overlay's available space.

  `lr-document-preview` now supports explicit image alternative text (including `alt=""` for
  decorative previews), aborts superseded text fetches, and documents its sizing, font, and spinner
  motion custom properties.

- 3da4f80: `lr-button` ships a default `:hover`/`:active` pointer-interaction treatment on `[part='base']`
  (`filter: brightness(--lr-button-hover-brightness)` on hover, `transform: scale(--lr-button-active-scale)`
  on active, both disabled under `prefers-reduced-motion`) -- previously it had zero hover/active CSS,
  so a mechanical `wa-button` -> `lr-button` rename silently dropped all pointer-interaction feedback.

  `lr-button` is now form-associated (`static formAssociated = true` + `attachInternals()`), so it
  participates in an ancestor `<form>.elements` the same way `wa-button` does -- a sibling text field's
  own Enter-to-submit lookup (which scans `form.elements` for a `type === 'submit'` control) now finds
  it, instead of silently failing to submit the form.

  `lr-button` gains an `appearance="accent"` value -- a loud, high-contrast filled tier equivalent to
  `wa-button`'s own runtime-default appearance, including for `variant="neutral"` (`'filled'` reads the
  ambient surface color there, matching `wa-button`'s `appearance="filled"`; `'accent'` reads a solid
  neutral fill, matching `wa-button`'s own unset-appearance default). New `--lr-button-accent-fill`/
  `-accent-on-fill` custom properties back it.

  `lr-heatmap` gains a `monthLabelText?: (jsMonth: number, year: number) => string | undefined`
  property, the month-axis analogue of the existing `weekdayLabelText` -- lets a consumer's calendar-mode
  month labels track the same locale signal (e.g. an app's own i18n store) as every other localizable
  string on the component, instead of always following `toLocaleString(undefined, ...)`'s browser/OS-
  language default. Unset (the default) reproduces today's exact locale-derived output.

- 8a1777b: `lr-skeleton` adds an `announce` switch so grouped or decorative placeholders can avoid
  duplicating live-region announcements. Pulse and sheen effects now use the shared
  `--lr-transition-ambient` motion token and remain disabled by the reduced-motion branch.
- 8e8a77f: `lr-tool-result-dialog` now forwards host `aria-label` to the internal dialog, exports its
  typed event map, localizes complete duration messages, omits non-finite durations, exposes its
  running-spin timing, and wraps footer actions in narrow layouts.

### Patch Changes

- 6ba4d1f: Localize generation metrics, graph position announcements, attachment upload context, and duration templates. Mirror JSON viewer disclosure chevrons in RTL and give map content a named semantic group with correct host-label precedence.
- b67a25e: Forward host accessible names to the semantic canvas or SVG in the chart, histogram, box-plot,
  and lite-chart families. Localize numeric summaries, mirror chart axes in RTL, refresh derived
  histogram data, improve BoxPlot theming and reduced-motion behavior, and support narrow allocations
  with long content across charts and context meters.
- 5dd8066: `lr-chat-message` now formats its default timestamp with the component's effective locale,
  uses the shared ambient-motion token for streaming feedback, and wraps crowded footer controls
  in narrow allocations.
- e95f942: Adds a complete interpolated localization message for citation status announcements so
  translations can reorder the citation index and status naturally.
- 303e701: `lr-heatmap` now localizes its built-in value label and formats legend, accessible-range, cell,
  and calendar-date values with the component's effective locale. Explicit `value-label` text remains
  verbatim.
- 87eb96a: `lr-heatmap` now mirrors its low-to-high legend ramp in right-to-left layouts, including
  consumer-provided multi-stop palettes.
- 134dba0: Adds a complete interpolated localization message for lite-chart mark announcements so
  translations can reorder series, label, value, and position naturally.
- 0260f9b: Harden `lr-app-rail`, `lr-attachment-chip`, `lr-avatar`, and `lr-chip-group`: respect the
  configured element prefix, preserve localized attachment-message word order, support image `File`
  objects in thumbnail-only mode, make spinner timing themeable, retry replacement avatar images,
  forward avatar accessible-name overrides, and collapse slot-forwarded overflow chips correctly.
- 9033a43: Forward host naming and native textarea editing APIs through `lr-chat-composer`, complete
  `lr-phone-input` selection and range-editing methods, and expose observable focus/blur contracts
  for pagination, playback, and select controls.
- acbbf00: Logical safe-area tokens now mirror the underlying physical browser insets in right-to-left
  layouts, keeping dialogs, toasts, widgets, and tool overlays clear of notches on the correct side.
- 1f93e0c: `lr-sparkline` now applies its generated or consumer-provided accessible name to the internal
  SVG that owns the image role. Generated value summaries also respect the component's effective
  locale and per-instance message overrides.
- 18003e2: `lr-tool-call-chip` now interpolates duration values through localized message templates and
  exposes coherent motion controls for its running spin and pending pulse. Its event map is also
  exported for typed listeners.
- 140f9ea: Align `lr-checkbox` with the native checkbox keyboard, focus, reset, ARIA-state, and `input`/`change` event contracts while retaining `lr-change` as a compatibility alias.
- d099ea7: Complete the combobox's native editing surface and clearable compatibility, align conversation-item event and story semantics, add accessible disabled and timing controls to copy-button, and localize and theme flag presentation.

## 2.11.0

### Minor Changes

- c0648ec: `lr-input` gains a `size: 'xs' | 's' | 'm' | 'l' | 'xl' = 'm'` property (reflected), the same scale
  `lr-select`/`lr-combobox` already use — `--lr-input-padding-block`/`-padding-inline`/
  `-font-size` swap per size, the same pattern as `lr-select`'s own size tokens. Unset (the default,
  `'m'`) reproduces today's exact sizing.

## 2.10.0

### Minor Changes

- f506542: `lr-heatmap` gains a `selectedCell` property (`{ row, col }` in matrix mode, `{ date }` in
  calendar mode) — a controlled, consumer-owned marker (mirroring `lr-lite-chart`'s
  `selectedIndex`) that draws a persistent canvas ring independent of keyboard focus, appends a
  "Selected: ..." description to the host's own `aria-label` so it stays discoverable after focus
  moves elsewhere, and appends a "(selected)" suffix to the keyboard live-region announcement. Unset
  (the default, `null`) reproduces today's exact output.
- 6f6d758: Add `lr-button`, a generic action-button primitive (`variant`/`appearance`/`size`/`loading`/`disabled`/`type`, default + `start`/`end` slots) -- the `lr-*` equivalent of a plain `wa-button`.
- 5eda04d: Add `lr-input`, a single-line plain-text input primitive (`type="text"`/`"password"`/`"email"`/`"number"`, label/hint/error chrome, form-associated validation, a built-in password-visibility toggle) -- the `lr-*` equivalent of a plain `wa-input`.
- 7c95e95: `lr-tool-result-view` gains a real `fallback="text"` mode (previously accepted as an attribute
  value but silently treated identically to `"json"`): a string `result` renders as preformatted text
  instead of being forced through `<lr-json-viewer>`'s tree view, falling back to the `"json"`
  behavior when `result` isn't a string. A new `copyable` property adds a copy-to-clipboard affordance
  to either fallback kind. Additive — unset, both fallback kinds and every existing consumer render
  byte-identical to before.

### Patch Changes

- 83fe6ba: Fix `lr-heatmap`'s `llms-full.txt` section, which was missing four real, already-shipped members
  (`cellInteractive`, `weekdayLabelText`, `colorSteps`, `refreshTheme`), and add a matching
  `focus()`/`blur()` mention to `lr-button`'s own section. Add a `pnpm run llms-freshness` lint gate
  (wired into `contract-policy`, so it runs in `lint`/CI/`publish.sh`) that fails the build if any
  custom element's public property isn't mentioned anywhere in its own `llms-full.txt` section, so
  this can't silently drift again. A small baseline of ~20 pre-existing drift items on unrelated
  components (chart family, dialog, menu, split, tree-node, widget, etc.), discovered while building
  this check, is exempted for now via a documented allowlist in the script — out of scope for this
  change, left for a follow-up cleanup.

## 2.9.0

### Minor Changes

- b4a6f5b: `lr-heatmap`'s color ramp now preserves a translucent `rgba()`/`hsla()`/hex-with-alpha color instead of silently resolving it to fully opaque. `resolveRgb()`/`hexToRgb()` return an `[r, g, b, a]` quadruple (previously `[r, g, b]`), and the ramp emits `rgba(...)` whenever an endpoint is translucent — unchanged `rgb(...)` output for opaque colors, so an existing consumer using only opaque `--lr-heatmap-scale-lo`/`-hi` values sees no difference. Lets a consumer key a ramp endpoint off a themed semi-transparent surface token (e.g. a "quiet baseline" tint) and get the intended translucent cell color instead of a stark opaque one.

## 2.8.0

### Minor Changes

- 0331bbf: `lr-table` gains a public, reflected `showAllColumns` property/`show-all-columns` attribute for its reveal-hidden-columns state, plus a `lr-columns-revealed` event fired when `[part='reveal-columns-button']` toggles it. Consumers can now read the current reveal state back (to persist it) and set an initial one (to restore a previously-persisted preference), mirroring the read-back/set-forward contract `sortKey`/`sortDir` already support. The button still toggles the state itself by default, so existing usage is unaffected.

## 2.7.0

### Minor Changes

- af61856: `lr-app-rail`'s navigation landmark (and its `role="dialog"` while the mobile overlay is open) now honors a host-level `aria-label` attribute, taking precedence over the `label` property and its localized `"Navigation"` default, mirroring `<lr-date-input>`'s `accessibleLabel` pattern. Previously a host-level `aria-label` on `<lr-app-rail>` had no effect on the accessible name computed inside its shadow DOM.
- 4ee4e76: `lr-chat-composer` forwards `spellcheck`/`autocapitalize`/`autocorrect` onto its internal `<textarea>` and re-dispatches bubbling, composed `blur`/`focus` events so a host-level listener can observe focus changes across the shadow boundary.
- 06e5fda: `lr-chip` gains a `--lr-chip-pressed-bg` custom property (falls back to `--lr-chip-bg`) so the pressed/selected background can be set independent of the resting background. A toggleable-but-unpressed chip now announces `aria-pressed="false"` instead of omitting the attribute entirely, matching the ARIA Authoring Practices convention for toggle buttons.
- a158b6b: `lr-combobox` gains a `size` property (`'xs'|'s'|'m'|'l'|'xl'`, default `'m'`) mirroring `lr-select`'s existing scale, including matched sizing for the "+N" overflow tag so it stays visually consistent with the trigger at every size. Async `ComboboxSourceRow` results can now carry a decorative `icon`, trailing `badge`, richer `accessibleLabel`, and opaque `data`; the read-only `selectedRows` getter retains the structured rows and payloads for the current selection. The new visuals are exposed through `option-icon` and `option-badge` CSS parts.
- 480d9e2: `lr-conversation-item` forwards `spellcheck`/`autocapitalize`/`autocorrect` onto its in-place rename `<input>` and re-dispatches bubbling, composed `blur`/`focus` events so a host-level listener can observe focus changes across the shadow boundary while a rename is in progress.
- 74dcaa7: `lr-date-input` forwards `spellcheck`/`autocapitalize`/`autocorrect` onto its internal `<input>` and re-dispatches bubbling, composed `blur`/`focus` events so a host-level listener can observe focus changes across the shadow boundary.
- 22f206c: `lr-dialog` now lets a host-level `aria-label` attribute win over its computed accessible name (a slotted heading, `heading`, or `label`), matching `<lr-date-input>`'s `accessibleLabel` pattern. Previously a consumer setting `aria-label` directly on `<lr-dialog>` was silently ignored in favor of the bespoke `label`/`heading` props. Additive — left unset, today's existing three-tier fallback is unchanged.
- 80b22ba: `lr-empty`'s `compact` mode gains a `--lr-empty-compact-align` custom property (defaulting to today's exact `flex-start`/`start` pair) so a consumer can combine `compact`'s denser padding with a centered heading/description layout by setting it to `center`.
- 0f21c57: `lr-export-button` accepts custom format descriptors with consumer-supplied labels, descriptions, and extension metadata. Custom formats emit `lr-export` for application handling without bundling an encoder, while a new controlled `loading` state exposes busy semantics and prevents duplicate activation during async exports.
- 3ac5e4d: `lr-gauge` gains a full-circle `type="ring"` presentation and a `--lr-gauge-fill` custom property for setting the fill stroke per instance across radial, ring, and linear gauges.
- f6b2aa5: `lr-graph` nodes gain independent accessible labels and SVG tooltip descriptions. Links gain stable ids, spoken-name/tooltip relationship-label fallbacks (not visible edge text), tooltip descriptions, directed arrowheads, per-link colors, and dash patterns; `lr-link-click` now includes the optional link id and the marker is exposed through the `arrowhead` CSS part. A host `aria-label` is forwarded to the internal semantic SVG.
- efc1182: `lr-map` now forwards a host-level `aria-label` attribute onto `[part="base"]`'s accessible name as a fallback when `label` is left unset, matching `lr-slider`/`lr-checkbox`/`lr-switch` — previously a host `aria-label` was silently dropped in favor of the localized `'map'` default.
- 085d173: `lr-mention-popover` now honors a host-level `aria-label` attribute as the accessible name for its internal `role="listbox"` popup, taking priority over the `label` property and its localized default. Previously the popup's name came only from `label`/`localize()`, so a plain `aria-label` set on `<lr-mention-popover>` itself was silently ignored — matches the same fallback already used by `lr-combobox`/`lr-table`.
- 3b59e94: `lr-menu`'s `role="menu"` popup now honors a host-level `aria-label` attribute over both the `label` prop and its localized default, matching `lr-select`/`lr-model-select`'s established `this.getAttribute('aria-label') || <computed default>` precedence. Additive — `aria-label` is unset by default, so every existing consumer (whether relying on the default `"Menu"` text or an explicit `label` prop) renders byte-identical to before.
- 653173d: `lr-model-select` gains an opt-in `hint`/`error-text` form-control chrome (matching named slots and `hint`/`error` CSS parts, mirroring `lr-select`, with `aria-describedby` wired to the rendered ids), plus `spellcheck`/`autocapitalize`/`autocorrect` passthrough and bubbling `blur`/`focus` events on the free-text mode's internal `<input>`. All additive — a bare `<lr-model-select>` with none of these set renders byte-identical to before.
- 992b0ba: Add `lr-pagination`, a controlled, localized page-navigation component with previous/next controls, a validated numeric page jump, range summaries, applied-page announcements, loading/empty handling, RTL-aware icons, five sizes, and container-responsive stacking. Enrich `TreeItem` rows with optional `icon`, `description`, and `accessibleLabel` fields plus matching structured CSS parts while preserving the existing tree keyboard model.
- dfb2f5e: Add `lr-phone-input`, a form-associated country/telephone field that keeps canonical form values in E.164 while preserving partial editable input. Numbering metadata stays opt-in through an injected adapter or the consumer-loaded `loadLibphonenumberAdapter()` helper; `libphonenumber-js` is an optional peer and international E.164 input works without a formatter.
- d88377a: `lr-switch` gains an opt-in `hint`/`error-text` form-control chrome (props + matching named `hint`/`error` slots + CSS parts), mirroring `lr-select`'s pattern for those two pieces, with `aria-describedby` wired to whichever are rendered. Left unset, neither renders and the control is unchanged. The default slot stays the control's visible, clickable label (same as `lr-checkbox`) — no separate top-of-field `label` prop was added.
- c8709cd: `lr-textarea` gains optional label/hint/error chrome, accessible-name forwarding, bounded auto-resize, editing-assistance attributes, public native-input and selection/caret APIs, synchronized `setRangeText()`, and bubbling composed focus/blur events. Existing visual and behavioral defaults remain unchanged when the new options are unused.
- fca0ffb: `lr-tool-approval-dialog`'s raw-JSON args `<textarea>` now also hardcodes `autocapitalize="off"` and `autocorrect="off"` alongside its existing `spellcheck="false"`, so a mobile browser (notably iOS Safari, which defaults textarea `autocapitalize` to `'sentences'`) can no longer auto-capitalize or auto-correct JSON key/value text while a user edits tool-call arguments, silently corrupting the JSON.
- 5b9b056: `lr-tree` now forwards a host-level `aria-label` attribute onto the internal `role="tree"` element's accessible name as a fallback when `label` is left unset, matching `lr-slider`/`lr-select` — previously a host `aria-label` was silently dropped since `role="tree"` lives on an internal element, not the host.
- 12595bd: `lr-typing-indicator`'s dots-variant stagger delays are now themeable via `--lr-typing-dot-stagger-1`/`-2` (defaulting to today's exact `600ms`/`1200ms`), so a consumer retiming `--lr-transition-ambient` can keep the stagger proportional.

## 2.6.0

### Minor Changes

- 78d4b58: `lr-chat-message` gains an `attachments-position` prop (`'before' | 'after'`, default `'after'`) so the `attachments` slot can render above the message body instead of below it, keeping DOM/visual/reading order in sync.
- a072af9: `lr-chip` gains a `--lr-chip-pressed-border` custom property so a consumer can set the pressed/selected border color independent of `--lr-chip-accent` (which also drives the label text color). Falls back to `--lr-chip-accent`, so existing consumers are unaffected.
- b56bdb2: `lr-empty` gains a `--lr-empty-compact-padding` custom property to override `compact`'s fixed uniform padding (e.g. with an asymmetric shorthand like `8px 2px`). Falls back to `var(--lr-space-xs)`, today's exact value.
- e029ac2: `lr-heatmap` calendar mode gains a `weekdayLabelText?: (jsWeekday: number) => string | undefined` hook to override the weekday-axis label text (e.g. for a consumer with its own locale/translation state independent of the browser's runtime locale).
- 6d5f9c4: Add `lr-textarea`, a bare multiline plain-text input primitive (value/rows/resize/placeholder, form-associated validation) — the `lr-*` equivalent of a plain `wa-textarea`.
- bbe8007: `lr-segmented`'s `SegmentedItem` gains an optional `icon` field, rendered before the item's label.
- e98013a: `lr-table`'s `TableColumn` gains a `headerCell` render hook (mirroring `cell`/`footer`) and `width`/`minWidth` fields. Any column defining `width` switches the table to `table-layout: fixed` so widths are authoritative.
- 993809a: `lr-widget` gains a `backdrop-inset` prop to decouple the fullscreen backdrop's inset from the panel's own `fullscreen-inset`. Falls back to `fullscreen-inset`, so existing consumers are unaffected.

### Patch Changes

- 1c78bd2: Fix `lr-poll-status`, `lr-typing-indicator`, and `lr-stream-status`'s ambient "still alive" pulse/bounce animations, which reused `--lr-transition-base` (180ms — reserved for discrete UI micro-interactions) and rendered as a fast flicker instead of a calm breathing loop. Adds a dedicated `--lr-transition-ambient` token (1.8s) for infinite looping indicators.
- e029ac2: Fix `lr-heatmap`'s `cellColor` hook silently rendering solid black when it returns a CSS custom property or other non-literal color (e.g. `color-mix(...)`) — the value is now resolved via a cached, hidden probe element before being assigned to the canvas `fillStyle`.
- 600544f: Fix `lr-skeleton` rendering as an invisible 0×0 box everywhere: `[part='base']` was a bare `<span>` (UA default `display: inline`), so its own `inline-size`/`block-size` were CSS no-ops per spec. Adds `display: block`.

## 2.5.0

### Minor Changes

- 84cefde: `lr-attachment-trigger`'s single-capability trigger `aria-label`s ("Attach files"/"Attach an
  image"/"Use camera"), its multi-capability menu's "Add attachment" label/aria-label, and its menu
  item labels ("Upload files"/"Upload a photo"/"Take a photo") now route through `this.localize()`,
  overridable via `.strings`/`registerLyraLocale()`. Default English output is unchanged when no
  override is set.
- 6bf30ea: `lr-avatar` now accepts default-slotted icon/glyph content (e.g. an inline SVG), shown in place of
  the image/initials and taking priority over both `src` and `initials` — useful for a chat UI
  distinguishing an "AI" avatar from a "user" avatar by role glyph rather than a photo or initials. Set
  `alt` alongside the icon for an accessible name, since the glyph itself is treated as decorative.
- 87890ea: `lr-checkbox`'s built-in required-field validation message ("Please check this box if you want
  to continue.") now routes through `this.localize()`, overridable via `.strings`/
  `registerLyraLocale()`. Default English output is unchanged when no override is set.
- b720eda: Fixed `lr-chip`'s opt-in `selected` toggle/pressed mode so it stays interactive after the first
  click. `[part='base']`'s `role="button"`, `tabindex`, `aria-pressed`, and click/keydown handlers
  used to be gated on the _current_ value of `selected`, so a chip that started `selected` and was
  clicked (flipping it to `false`) lost its focusable/clickable semantics on the next render — there
  was no way to click it back on. `selected` becoming `true` at any point now latches the chip into
  toggle mode for good, so it stays clickable in both directions. A chip that must be interactive
  from the outset while starting **unselected** (e.g. an initially-inactive filter chip) can opt in
  explicitly with the new `toggleable` property, since `selected`'s own default (`false`) can't be
  told apart from "never opted in" on its own.
- cbfec47: `lr-citation-badge`'s visible status words folded into its computed accessible name ("High
  confidence"/"Medium confidence"/"Low confidence"/"Verified"/"Unverified") now route through
  `this.localize()`, overridable via `.strings`/`registerLyraLocale()`. Default English output is
  unchanged when no override is set.
- dba57e9: `lr-context-meter`'s accessible summary ("{used} of {total} used" / "{used} used") now routes
  through `this.localize()`, overridable via `.strings`/`registerLyraLocale()`. Default English
  output is unchanged when no override is set.
- 7379a41: `lr-conversation-item`'s "Untitled conversation" fallback title now routes through
  `this.localize()`, overridable via `.strings`/`registerLyraLocale()`. Default English output is
  unchanged when no override is set.
- acdaa37: `lr-dock-panel`'s resize-handle and collapse-toggle `aria-label`s ("Resize panel",
  "Collapse panel"/"Expand panel") now route through `this.localize()`, overridable via
  `.strings`/`registerLyraLocale()`. Default English output is unchanged when no override is set.
- eca2ea4: `lr-document-preview`'s hardcoded English strings — the image-preview `alt` fallback
  ("Document preview"), the unsafe-URL error ("Document URL is not allowed."), the non-`Error`
  fetch-failure message ("Failed to load document."), and the empty-`error-message` fallback
  ("Something went wrong.") — now route through `this.localize()`, overridable via
  `.strings`/`registerLyraLocale()`. Its in-flight text-fetch spinner label ("Loading document…")
  is now also wired through the existing `loadingDocument` message key. Default English output is
  unchanged when no override is set.
- a3c4ebf: `lr-export-button`'s trigger button text (default "Export", also reused for the format menu's
  `aria-label`) now routes through `this.localize()` when `label` is left at its built-in default,
  overridable via `.strings`/`registerLyraLocale()` — matching `lr-attachment-chip`'s
  `removeLabel`/`retryLabel` convention. Setting the `label` attribute/property explicitly still
  overrides it directly. Default English output is unchanged when no override is set.
- df8341b: `lr-generation-status`'s stop-button `aria-label` ("Stop generating") now routes through
  `this.localize()` (sharing the existing `stopGenerating` key used elsewhere in the library), and
  the tokens segment's singular/plural noun ("token"/"tokens") is now localizable too, matching
  `lr-json-viewer`'s/`lr-word-cloud`'s existing count-noun pattern. Overridable via
  `.strings`/`registerLyraLocale()`. Default English output is unchanged when no override is set.
- 20ae3e7: `lr-graph`'s visually-hidden data-list `aria-label` ("Graph data") now routes through
  `this.localize()`, overridable via `.strings`/`registerLyraLocale()`. Default English output is
  unchanged when no override is set.
- 8c29581: `lr-segmented` gains a `label` property giving its `role="radiogroup"` root an accessible name.
  When unset, a plain `aria-label` attribute on the host element is honored as a fallback, matching
  `lr-slider`'s existing `label`/`aria-label` convention. Previously the radiogroup had no way to
  receive an accessible name at all.
- 259c0c6: Completed a full-library i18n/RTL/styling standardization pass across the remaining component
  families not yet covered by earlier rounds — `chart` (and `box-plot`/`histogram`/`lite-chart`),
  `avatar`, `code-block`, `combobox`, `date-picker`, `dialog`, `document-preview`, `export-button`,
  `file-input`, `graph`, `heatmap`, `map`, `time-range`, `tool-call-chip`, `tool-param-form`,
  `tool-result-dialog`, `tree`, `widget`, and several smaller components. Highlights:

  - Routed remaining hardcoded English strings (accessible descriptions, aria-labels, empty-state
    text) through `this.localize()`.
  - Fixed RTL gaps: `date-picker`'s previous/next chevrons now mirror under `dir="rtl"` (rotating
    the wrapping `part`, not the icon), matching the grid's own arrow-key swap.
  - `lr-avatar`: fixed a dangling `--lr-color-surface-alt` token reference, corrected its `size`
    JSDoc, and extended the accessible-name role/`aria-label` to the initials-fallback path (not
    just the icon-slot path) whenever `alt` is set.
  - `lr-export-button` now fires `lr-show`/`lr-hide` on its format menu, matching the same
    convention already used by `lr-menu`/`lr-select`/`lr-combobox`.
  - Fixed a `this.localize(key, literalFallback)` pattern that unconditionally short-circuited
    `registerLyraLocale()` lookups for the affected keys (the fallback is now omitted wherever
    `DEFAULT_STRINGS` already carries the same default).

  AGENTS.md gained a new "Internationalization (i18n), RTL, and theming" section documenting the
  resulting standard, and both READMEs now summarize it for consumers.

- 79e4390: Fixed gaps found during a full re-verification pass over previously-completed work:

  - `lr-menu`'s type-ahead navigation now excludes `hidden`/`aria-hidden` items (it already
    excluded `disabled` ones), matching the Arrow/Home/End roving-focus navigation it sits next to.
  - The root barrel (`src/lyra.ts`) now re-exports 13 component event-map types that were previously
    unreachable from the package root even though their owning classes were exported: `LyraChip`,
    `LyraChipGroup`, `LyraCitationBadge`, `LyraCopyButton`, `LyraDiffView`, `LyraFileInput`,
    `LyraHeatmap`, `LyraLiteChart`, `LyraMediaCard`, `LyraSelect`, `LyraSourceCard`, `LyraSplit`, and
    `LyraTimeRange`'s `*EventMap` types are now all importable from `@aceshooting/lyra-ui`.

- 59d4477: `lr-media-card`'s hardcoded English fallback strings — the file-chip "Untitled file" name, the
  `image`/`video` alt-text fallbacks ("Image attachment"/"Video attachment"), and the accessible
  "Open …" label (both the named and generic-kind forms) — now route through `this.localize()`,
  overridable via `.strings`/`registerLyraLocale()`. Default English output is unchanged when no
  override is set.
- ea774a8: `lr-mention-popover`'s default listbox accessible name ("Suggestions") now routes through
  `this.localize()`, overridable via `.strings`/`registerLyraLocale()` — matching the already-shared
  `noMatches` key its empty-state row uses. An explicit `label`/`empty-text` value still wins
  verbatim. Default English output is unchanged when no override is set.
- cd10606: `<lr-menu>` gains an opt-in `closeOnEscapeAnywhere` property. Escape has always closed the menu
  and refocused the trigger when it originates from a real `<lr-menu-item>`, but slotted non-item
  content (e.g. a form control slotted alongside the items) previously got full default keyboard
  behavior with no way to close the menu on Escape. Setting `closeOnEscapeAnywhere` extends that
  same Escape-closes-and-refocuses behavior to keydowns from anywhere in the list, including slotted
  non-item content. Defaults to `false`, so existing consumers are unaffected.
- 7d63af9: `lr-menu`'s `role="menu"` popup default accessible name ("Menu") now routes through
  `this.localize()`, overridable via `.strings`/`registerLyraLocale()`. An explicit `label` value
  still wins verbatim. Default English output is unchanged when no override is set.
- f232381: `lr-model-settings-panel`'s hardcoded English strings — the visible "Temperature" caption
  (also reused as the nested `lr-slider`'s accessible name) and the internal `lr-model-select`'s
  "Select a model…" placeholder — now route through `this.localize()`, overridable via
  `.strings`/`registerLyraLocale()`. Default English output is unchanged when no override is set.
- 1686322: `lr-playback`'s play/pause button and position-slider `aria-label`s ("Play"/"Pause",
  "Playback position") now route through `this.localize()`, overridable via
  `.strings`/`registerLyraLocale()`. Default English output is unchanged when no override is set.
- 0cacb4d: `lr-poll-status`'s pause/resume button aria-label, due-state countdown text ("Refreshing…"), and its
  three live-region announcements ("Paused."/"Resumed."/"Refreshing now.") now route through
  `this.localize()`, overridable via `.strings`/`registerLyraLocale()`. It also now shows a distinct
  "Paused" countdown state while `paused`, instead of freezing on whatever value it last displayed.
  Default English output is unchanged when no override is set.
- 870523f: `lr-widget` gains two new named slots, `collapse-icon` and `fullscreen-icon`, overriding the
  built-in chevron/expand-or-close glyphs on the collapse and fullscreen toggle buttons entirely
  (platform slot-fallback-content mechanism: whatever is assigned wins, otherwise the default glyph
  renders unchanged). `WidgetView`'s `label` is now optional and a new `ariaLabel` field lets a view
  toggle be icon-only while still exposing an accessible name — previously a toggle with no `label`
  had no accessible name at all.
- c2bc232: Align every component with the library's i18n/RTL/theming standard and fix the remaining
  gaps:

  - Removed several `this.localize(key, literalFallback)` call sites (`toolApprovalHeading`,
    `playback`'s play/pause/position labels, `model-settings-panel`'s temperature/model labels,
    `media-card`'s five accessible-name strings, `kbd`'s shortcut-token labels, `chat-composer`'s
    composer label) where the literal fallback silently defeated `registerLyraLocale()` translation
    for that call site.
  - Routed remaining hardcoded strings through `this.localize()`: `date-picker`'s next-month label
    and `date-input`'s validation messages, `toast-item`'s/`chip`'s/`combobox`'s remove/close
    labels (now interpolated via a `{placeholder}` instead of string concatenation), `heatmap`'s
    matrix/calendar aria-labels and "no data"/row/col fallbacks, `chart`/`box-plot`'s description
    and data-table text, `lite-chart`'s mark-position announcement, `document-preview`'s empty-state
    nouns, `json-viewer`'s copy/expand/collapse/count labels, `stat`'s trend announcement,
    `dialog`'s `confirm()` cancel button, `typing-indicator`'s default label, `tool-param-form`'s
    edge-case validation message, and `tool-result-dialog`/`tool-call-chip`'s duration seconds unit.
  - Fixed RTL gaps: `app-rail-item`'s icon tooltip now flips side under `dir="rtl"` via
    `rtlAwarePlacement()`, `chat-message`'s and `source-list`'s collapse/disclosure chevrons now
    mirror under RTL, and `lite-chart`'s roving-tabindex point navigation now swaps
    ArrowLeft/ArrowRight under RTL.

  Also compressed the shared string registry (`internal/localization.ts`): removed 21 `kbd*` base
  keys (`kbdEnter`, `kbdEscape`, `kbdTab`, etc.) that were fully superseded by their `*Word`/`*Visual`
  counterparts and had no remaining call sites anywhere in the library, reducing the packed consumer
  bundle size.

- aeef118: `lr-select`'s required-field validation message ("Please select an option.") and its
  trigger's fallback accessible name ("Select", used only when no `aria-label`, `label`, or
  `placeholder` is set) now route through `this.localize()`, overridable via
  `.strings`/`registerLyraLocale()`. Default English output is unchanged when no override is set.
- 4fb27a2: `lr-skeleton`'s default accessible name ("Loading…") now routes through `this.localize()`
  (reusing the shared `loading` key), overridable via `.strings`/`registerLyraLocale()`. An
  explicit `label` still wins verbatim. Default English output is unchanged when no override is set.
- f7b9f0e: `lr-source-list`'s fallback header text ("Sources", used only when neither `label` nor
  `label-plural` is set) now routes through `this.localize()`, overridable via
  `.strings`/`registerLyraLocale()`. Default English output is unchanged when no override is set.
- f2ea145: `lr-stepper`'s `StepItem` gains an optional `title` field, rendered as a native `title` tooltip on
  that step's button — useful for explaining why a `disabled` step is locked (e.g. "Complete Basics
  first"). Steps that omit it render no `title` attribute at all, unchanged from today.
- 9e5864a: `lr-stream-status`'s built-in stalled-message default ("Taking longer than usual…") and its
  three live-region announcements ("Connection stalled."/"Connection restored."/"No longer
  stalled.") now route through `this.localize()`, overridable via `.strings`/`registerLyraLocale()`.
  Default English output is unchanged when no override is set.
- 9174500: `lr-switch`'s built-in required-field validation message ("Please turn this on.") now routes
  through `this.localize()`, overridable via `.strings`/`registerLyraLocale()`. Default English
  output is unchanged when no override is set.
- 60084ba: `lr-thinking-panel`'s default header label ("Thinking") and its duration-display text ("Thought
  for …"/"Thinking…") now route through `this.localize()`, overridable via
  `.strings`/`registerLyraLocale()`. An explicit `label` still wins verbatim. Default English
  output is unchanged when no override is set.
- b113bda: `lr-tool-approval-dialog`'s heading text, generic tool-name fallback, args-editor accessible
  name, invalid-JSON fallback error, and its Deny/Edit/Approve button labels now route through
  `this.localize()`, overridable via `.strings`/`registerLyraLocale()`. Default English output is
  unchanged when no override is set.
- 3b1f930: `lr-tool-call-chip`'s visible status labels (Pending/Running/Success/Error/Denied, shared with
  `lr-tool-result-dialog`'s identical vocabulary) and its unnamed-tool fallback ("Tool call") now
  route through `this.localize()`, overridable via `.strings`/`registerLyraLocale()`. Default English
  output is unchanged when no override is set.
- bbaea80: `lr-tool-param-form`'s validation messages (required field, wrong type for a string/number/
  integer/boolean, enum mismatch, const mismatch, unsupported field type, malformed schema shape,
  non-serializable value) now route through `this.localize()`, overridable via
  `.strings`/`registerLyraLocale()`. Default English output is unchanged when no override is set.
- bda19ac: `lr-tool-select-dialog`'s dialog title, search placeholder, "use default tools" switch label
  and hint, category count/"Other" fallback, tools-enabled summary, no-matches message, and the
  no-tools-available empty state now route through `this.localize()`, overridable via
  `.strings`/`registerLyraLocale()`. Default English output is unchanged when no override is set.
- 220bd73: `lr-widget`'s collapse/expand, exit-fullscreen/expand-to-fullscreen, and view-toggle-group
  aria-labels, plus its fullscreen dialog's fallback accessible name, now route through
  `this.localize()`, overridable via `.strings`/`registerLyraLocale()`. The collapse/expand labels
  reuse `lr-dock-panel`'s existing `dockPanelCollapse`/`dockPanelExpand` keys. Default English
  output is unchanged when no override is set.

### Patch Changes

- 00ce49f: Fix `lr-date-picker`'s day-grid keyboard navigation to swap ArrowLeft/ArrowRight under `dir="rtl"`, matching the grid's own visual mirroring (the day cells use unset `direction`, so the browser already lays them out right-to-left). ArrowUp/ArrowDown (by week) are unaffected.
- 37e1a2f: `lr-table`'s header-cell ArrowLeft/ArrowRight roving-tabindex navigation now derives its RTL
  check through the shared `isRtl()` helper instead of a duplicated inline `getComputedStyle`
  check, and gains test coverage confirming ArrowRight/ArrowLeft already swap correctly under
  `dir="rtl"` (a native `<table>` mirrors column visual order under RTL on its own) while
  ArrowUp/ArrowDown row navigation is unaffected. No behavior change.
- 2fd3786: Fix calendar-heatmap weekday-axis labels to respect firstDayOfWeek instead of always labeling grid rows 1/3/5.

## 2.4.0

### Minor Changes

- 171bdbd: `lr-attachment-chip`'s file-size unit abbreviations ("B"/"KB"/"MB"/"GB"/"TB") now route through
  `this.localize()` when rendered, overridable via `.strings`/`registerLyraLocale()`. The exported
  `formatFileSize()` pure function gains an optional `unitLabel` resolver parameter, defaulting to the
  plain English abbreviation — every existing single-argument call is unaffected.
- 5f043ba: `lr-chart`'s data-table "Category" column header, per-row "Point N" fallback label, and "Reset
  zoom" button text now route through `this.localize()`, overridable via `.strings`/
  `registerLyraLocale()`. Default English text is unchanged.
- 5e90140: `lr-chat-composer`'s action button labels ("Send message"/"Stop generating") now route through
  `this.localize()`, overridable via `.strings`/`registerLyraLocale()`. Also adds `stoppable: boolean =
true` — when set to `false`, the button never renders as a Stop/cancel control while busy; it stays a
  disabled Send button instead, for backends with no cancellation endpoint. Default behavior is
  unchanged.
- 558e76c: `lr-chat-message`'s visible status text ("Sending…"/"Responding…"/"Failed to send") and its two
  live-region status-change announcements ("Message failed to send."/"Message complete.") now route
  through `this.localize()`, overridable via `.strings`/`registerLyraLocale()`. Default English text is
  unchanged.
- 238c8d7: `lr-chip-group`'s collapsed overflow-indicator's visible "+N" text now routes through
  `this.localize('showMoreCollapsed', ...)`, matching the aria-label it sits beside, which was already
  localized. Default English output ("+N") is unchanged.
- 0d9018f: `lr-code-block`'s collapse-toggle, copy-button, and code-region aria-labels now route entirely
  through `this.localize()` instead of concatenating a localized verb with a hardcoded English suffix
  ("code"/"to clipboard"/"Code"). Default English output is unchanged.
- a249bd6: `lr-diff-view`'s copy-button aria-label now routes entirely through `this.localize('copyDiff', ...)`
  instead of concatenating the localized "copy" verb with a hardcoded " diff" suffix. Default English
  output ("Copy diff") is unchanged.
- 58c6e59: `lr-file-input`'s drag-preview live-region announcements ("Release to add the file." / "This file
  type is not accepted.") now route through `this.localize()`, overridable via `.strings`/
  `registerLyraLocale()`. Default English text is unchanged. The post-drop `acceptedMessage`/
  `rejectedMessage` properties and the visible `label` property are unaffected (already
  consumer-overridable).
- b3e3bb6: `lr-json-viewer`'s root-node toggle/copy fallback words ("array"/"object"/"value", used only when a
  node has no key label) now route through `this.localize()`, overridable via `.strings`/
  `registerLyraLocale()`. Default English text is unchanged.
- b322e75: `lr-model-select`'s synthetic stale-value row badge ("not in catalog") now routes through
  `this.localize('notInCatalog')`, so it can be overridden via `.strings`/`registerLyraLocale()` like
  the component's other built-in message (`noMatches`). Default English text is unchanged.
- e54eeee: `lr-source-card`'s "Untitled source" fallback and its " — p. N" page-suffix format now route
  through `this.localize()`, overridable via `.strings`/`registerLyraLocale()`. Default English output
  is unchanged.
- 0576643: `lr-split` now redistributes the track space freed when a `panelConstraints` pixel bound clamps a
  panel's percentage basis down (e.g. a `maxPx` cap on a wide viewport) to sibling panels that have no
  pixel constraint of their own, instead of leaving that space unused. No behavior change for splits
  without `panelConstraints`, or where no panel is actually clamped this render.
- 97756af: `lr-table`'s `columns[].sticky` option now accepts `'start' | 'end'` in addition to the legacy
  `boolean` (`true` continues to mean `'start'`, unchanged). An `'end'`-sticky column pins to the
  inline-end edge instead — useful for a trailing actions column that would otherwise be pushed off
  a narrow viewport — via the same `inset-inline-*` logical-property approach, so RTL is unaffected.
- ffee803: `lr-tool-result-dialog`'s tool-name fallback ("Tool call"), visible status label
  ("Pending"/"Running"/"Success"/"Error"/"Denied"), and maximize/restore button aria-label now route
  through `this.localize()`, overridable via `.strings`/`registerLyraLocale()`. Default English output
  is unchanged.
- f9f57f9: `lr-word-cloud`'s default aria-label's pluralized "word"/"words" noun now routes through
  `this.localize()` too, so a registered translation of the `wordCloud` template's `{word}` slot is no
  longer stuck in English. Default output is unchanged.

## 2.3.0

### Minor Changes

- a1b2f8e: `lr-app-rail` gains `dragging` (reflected boolean, true for the duration of a pointer-driven
  resize -- not a keyboard step -- so its own `[part='base']` transition suppresses during the drag
  instead of visibly "chasing" the pointer) and `hideToggle` (suppresses the built-in mobile hamburger
  button for a consumer that owns its own external toggle wired to `open`).
- e9075b8: `lr-app-rail-item` gains an opt-in `tooltip` property: a hover/focus flyout showing the item's
  label text while `icon-only` hides it from view, using the library's existing Floating-UI-backed
  `place()` positioner -- an explicit, documented alternative to hand-rolling a `::part()`+`::after`
  tooltip composition.
- 8160548: `lr-attachment-chip`'s `compact` variant now also shrinks font-size and gap (via new
  `--lr-attachment-chip-compact-font-size`/`-compact-gap` custom properties), not just
  border/radius/padding/thumbnail-size. Also adds `thumbnailOnly`, which -- combined with `compact`
  on an image-mime chip -- hides the filename/size text entirely for a pure thumbnail density with
  no consumer-side CSS.
- 099fa8a: Add `lr-avatar`: a small, fixed-size identity marker (image, or an initials fallback) for a
  user-menu trigger or similar identity affordance -- `size`/`shape`/`tone` variants mirror
  `lr-chip`'s existing tone vocabulary for consistency.
- bf9d442: Add `lr-card`: a generic bordered content container (`appearance` variants mirroring `wa-card`,
  `header`/`media`/`footer`/`actions` slots) for the "small bordered surface with padding" idiom
  common across hero highlights and clickable grid tiles -- a real `lyra-ui` parity counterpart to
  `wa-card`, which this library otherwise mirrors 1:1.
- f9ecffd: `lr-chip` gains an opt-in `selected`/pressed interactive mode: `[part='base']` becomes
  keyboard-activatable and reflects `aria-pressed`, toggling on click/Enter/Space and emitting
  `lr-chip-select`. Not combinable with `removable` (avoids a nested-interactive a11y violation);
  today's passive-label-pill usage is unaffected since `selected` defaults to `false`.
- db24359: Add `lr-code-block-core`: a build-lean variant of `lr-code-block` for a consumer whose
  `languages` map already covers every language it renders. Unlike `languagesOnly` (a runtime flag
  on `lr-code-block` itself, which a bundler can't prove always-true and so can't tree-shake),
  `lr-code-block-core` is a genuinely separate module that never references shiki's full
  ~200-language default entry point at all -- importing it instead of `code-block.js` gives a real
  compile-time exclusion of that table from the build output.
- 83ba36c: `lr-dialog` gains `--lr-dialog-width`, unset by default -- when set, the panel actually
  stretches to that width instead of only shrink-wrapping its content capped at
  `--lr-dialog-max-width`, which was a real gotcha for anyone porting from `wa-dialog`'s
  assertive `--width` token.
- a1d7030: Add `lr-diff-view`: a real two-string line diff (LCS-aligned), rendered as interleaved
  unified-diff output -- unlike diff-flavored syntax highlighting over an already-formatted string,
  this computes the alignment itself, so a one-line change inside a longer block renders as one
  red/green pair near the change instead of every old line then every new line.
- b56abda: `lr-empty`'s `heading`/`description` gain the same slot-override-attribute treatment
  `lr-stat`'s `caption`/`sub` already have -- a consumer can now pass rich mid-sentence content
  (e.g. an inline `<code>` reference) while the plain-string attribute stays the default.
- 4324a73: `lr-graph` now renders a link whose `target` isn't a real node as a short dashed stub off the
  source's position, instead of silently dropping it -- for a wiki-style `[[link]]`/broken-reference
  visualization where "this edge exists but its endpoint doesn't" is a meaningful state, not noise.
  A dangling `source` is still dropped (no position to draw a stub from).
- 1e71d71: Rewrite `lr-heatmap`'s two weekday-axis-label tests to assert against independently fixed dates
  instead of re-deriving the implementation's own formula, which could never fail regardless of
  correctness -- the underlying `weekdayLabels()`/`firstDayOfWeek` anchoring was already correct.
  Also add `cellColor`, an optional per-cell color override function (mirroring the existing
  `cellText`/`cellInteractive` shape) that bypasses the color ramp entirely for an exact value.
- 2e74ea0: Fix `lr-lite-chart`'s `minBarHeight` z-order bug for stacked bars: a floored near-zero segment
  was being overdrawn by the segment stacked on top of it, since each segment's position was derived
  independently from cumulative value rather than from where the previous (possibly-floored) segment
  actually ended on screen. Also add `selectedIndex: number[]`, reflecting `data-selected` onto every
  bar at a given category index across all datasets, for highlighting a whole selected column.
- 00f3b37: `lr-markdown` gains `escapeHtml`, an opt-in property overriding `marked`'s `html` renderer hook
  to emit escaped text instead of parsed/sanitized markup -- for a consumer rendering arbitrary
  already-written content (transcripts, logs) where a stray angle bracket should render as visible
  text rather than a real DOM element, without giving up GFM tables/lists/etc.
- d3fbf36: Add `lr-poll-status`: a "next scheduled refresh" countdown with a built-in pause control -- a
  ticking M:SS display, a "Refreshing…" due state, and an internal live region announcing phase
  transitions, mirroring `lr-stream-status`'s own composition for a different concern (a scheduled
  interval, not transport/connection health).
- b5464bd: Add `lr-segmented`: a single-select button row with the WAI-ARIA APG `radiogroup` contract
  (role="radio", roving tabindex, automatic-activation Arrow/Home/End navigation) built in --
  "choose exactly one of N labeled options" is ubiquitous settings/filter-panel UI that otherwise
  gets hand-rolled without keyboard/ARIA semantics every time.
- 551f272: `lr-select` gains `--lr-select-trigger-height`, unset (auto) by default -- when a consumer sets
  it, the trigger resolves to exactly that height (both floor and cap) instead of only being
  floored by `--lr-select-trigger-min-height`, for pixel-matching a sibling form field in the same
  row without a blunt `::part(trigger){block-size:...}` override.
- 1fddbdc: Add `lr-stepper`: ordered multi-step wizard navigation (label + index, current/completed/
  locked/error state, click-to-jump, horizontal/vertical orientation). Fully data-driven and
  controlled -- like `lr-table`, it never mutates its own `steps` data, firing a cancelable
  `lr-step-select` event and leaving state updates to the host, so gating a jump behind an
  external validity check (e.g. "does the target step's data exist yet") is a normal listener, not a
  workaround.
- 60dbf18: `lr-table` gains two per-column hooks: `footer(rows)`, rendered in a real sticky-bottom
  `<tfoot>` (only when at least one column defines it) -- e.g. a totals row; and `cellStyle(row)`,
  applied via `styleMap` directly to the generated `<td>` -- e.g. a computed heat-tint background --
  which coexists safely with the existing sticky-column offset styling.
- 6ce5b87: Add a new `./testing` subpath exporting `installHappyDomFormAssociatedShims()` -- an opt-in,
  environment-guarded polyfill for `HTMLElement.prototype.attachInternals`, for a downstream
  consumer's own Vitest+happy-dom test suite (happy-dom has no `ElementInternals` implementation,
  and every form-associated `lr-*` component calls `attachInternals()` unconditionally in its
  constructor). Not used by this package's own tests, which already run against real browsers.
- 25254f2: `lr-widget` gains a leading `icon` slot, rich `label`/`sublabel` slot overrides (mirroring
  `lr-stat`'s `caption`/`sub` pattern), and a `views` property driving a built-in header toggle
  group plus one named slot per entry -- for a chart/table (or similar) toggle inside the same card
  chrome, so a consumer no longer has to hand-roll that shell around a bare default slot.

### Patch Changes

- 062f036: Fix `lr-attachment-trigger`'s internal hidden `<input type="file">` actually rendering as a
  visible, focusable-adjacent element in normal document flow — it now has `display: none` by
  default (and a new `hidden-input` CSS part, for the rare integration that needs to override that).
- 9094b39: Fix `lr-chart` losing a user's legend-toggled hidden-dataset state on every data-driven redraw --
  `draw()` now snapshots each dataset's `isDatasetVisible()` state before reassigning `chart.data` and
  restores it via `setDatasetVisibility()` afterward, since Chart.js's own dataset-object identity
  changes on every reactive update from a live-polling consumer.
- a413c8c: Fix `lr-chip-group`'s "+N"/"Show less" overflow toggle hardcoding English strings instead of using
  the library's own existing `localize()`/`strings` override mechanism, which every other component
  with translatable text already uses (including the identical `showMore`/`showLess` keys, already
  consumed by `lr-source-card`).
- 4010bc4: `lr-menu`'s `onListKeyDown` now ignores a keydown whose target isn't a real `<lr-menu-item>`,
  matching the same `instanceof LyraMenuItem` guard `onItemSelect`/`onListFocusIn` already use --
  previously it unconditionally intercepted Arrow/Home/End/Enter/Space/Escape/Tab from any keydown
  bubbling through `[part="list"]`, including from non-item slotted content (e.g. a custom-range
  date input), hijacking keystrokes meant for it. Note: Escape/Tab now also only close the menu when
  the event originates from a real item -- a slotted non-item control gets fully default keyboard
  behavior instead.
- a5a055f: Fix `lr-split`'s fixed-percent panels not reserving space for the auto-inserted divider between
  them, causing a deterministic `(panelCount - 1) * dividerWidth` container overflow in the default
  (uncollapsed) state. Panels now get a nonzero `flex-shrink` so they absorb the dividers' own width
  instead of the row overflowing.
- 18003f0: Fix `lr-stat`'s `[part='base']` not stretching to fill its host in a CSS Grid -- a stat tile with
  a longer `sub`/breakdown-rows line rendered visibly taller than its row-mates. `block-size: 100%` on
  `[part='base']` now matches the convention `lr-word-cloud`/`lr-context-meter` already use.
- 55c384e: Fix `lr-tabs`'s `tablist` part showing a phantom vertical scrollbar on a tablist with no
  vertically-overflowing content — `overflow-x: auto` alone can leave the y axis's computed overflow
  at `auto` too per the CSS overflow spec, which sub-pixel rounding can trip; `overflow-y: hidden` is
  now explicit, since the tablist is never meant to scroll vertically.

## 2.2.0

### Minor Changes

- ff41aba: `lr-app-rail`: add a `resizable` opt-in (drag + keyboard-steppable `[part="resizer"]` handle,
  `railWidthPx`/`minRailWidthPx`/`maxRailWidthPx`, `lr-rail-resize` event) for the `'full'` state's
  width; add `preferredMode` to manually prefer `'full'`/`'icon-only'` while the mobile breakpoint
  keeps tracking automatically; and fix the mobile toggle button's `aria-label` to use a proper
  `openNavigation` message key (consistent with the existing `closeNavigation` key) instead of
  concatenating a hardcoded `" navigation"` suffix onto a partially-localized string.
- 3b1a404: `lr-app-rail-item`: add an `active` property that reflects `aria-current="page"` onto the
  internal link/button, mirroring `lr-conversation-item`'s existing `active` pattern.
- 3b7a98b: `lr-attachment-chip`: fix the uploading progressbar/spinner's `aria-label` to actually use
  `uploadingLabel` (previously hardcoded, unlike the adjacent visible status text); add an
  `untitledLabel` override for the empty-name fallback; add a `compact` density variant.
- 49be9e4: `lr-attachment-trigger`: add a `triggerTitle` property forwarded to the internal trigger
  button(s)' native `title` (a sighted-mouse-user hover tooltip, distinct from `triggerLabel`'s
  `aria-label` role); reduce the internal `.trigger-button:hover` rule's specificity via `:where()`
  so a consumer's `::part(trigger):hover` override wins without needing `!important`.
- 4d04843: `lr-code-block`: add a `languagesOnly` opt-in that skips the default `loadShikiHighlighter()`
  call entirely, so a consumer whose `languages` map already covers every language it renders has no
  bundler-reachable path to shiki's full per-language dynamic-import table.
- 2968d7b: Add `lr-copy-button`: a standalone icon-only copy-to-clipboard button for a plain text `value`,
  with no positioning opinion of its own — for a consumer needing just the copy/checkmark-swap
  affordance without adopting `lr-code-block`'s or `lr-json-viewer`'s full content model.
- 49be9e4: `lr-dialog`: add `noLightDismiss` to opt out of backdrop-click dismissal, and make `close()`
  actually respect a `lr-dialog-close` listener's `preventDefault()` (the event is now genuinely
  `cancelable: true`) for every dismissal path — Escape, backdrop, the built-in close button, and a
  consumer's own `close()` call.
- 6958595: `lr-heatmap`: add a `cellInteractive` predicate to opt individual cells out of hit-testing and
  keyboard roving focus, and a `colorSteps` discrete-array ramp as an alternative to the 2-endpoint
  `--lr-heatmap-scale-lo`/`-hi` linear interpolation (governs both `mode`s and both `scale`
  values). Also adds test coverage confirming `firstDayOfWeek`'s calendar-mode weekday-axis labels
  are correct for a non-Sunday-first week (the underlying computation was already correct; only the
  test combining the two was missing).
- 2c6fc82: `lr-lite-chart`: add a `minBarHeight`/`min-bar-height` pixel floor for near-zero stacked
  segments, fix `scale="sqrt"` proportionality for stacked bars (previously compressed each
  segment's absolute cumulative stack position independently instead of the bar's total height
  split linearly by segment share), and add a `chartLabel`/`chart-label` override for the chart's
  auto-derived `aria-label`.
- e29b2f9: `lr-markdown`: add `part="paragraph"`, `part="list"` (both `<ul>` and `<ol>`), and
  `part="inline-code"` (bare inline codespans only, not a fenced code block's `<code>`, which
  already has its own `part="code-block"` wrapper) so a consumer's `::part()` CSS can reach plain
  text elements that previously had no themeable hook.
- 3b7a98b: `lr-split`: add a `dividerLabel` function property overriding the auto-inserted divider's
  hardcoded English `aria-label` template.

## 2.1.0

### Minor Changes

- 82a3419: `<lr-attachment-chip>`: added four label-override properties for i18n/locale — `removeLabel`/`retryLabel` (`remove-label`/`retry-label` attributes, the verb prefixed to the remove/retry buttons' `aria-label` ahead of the interpolated filename) and `uploadingLabel`/`uploadFailedLabel` (`uploading-label`/`upload-failed-label` attributes, the verb/phrase used in the visible uploading/error status text, keeping the live percentage interpolation intact for `uploadingLabel`). All four default to today's exact hardcoded English text (`'Remove'`, `'Retry'`, `'Uploading'`, `'Upload failed'`), so leaving them unset changes nothing for existing consumers.
- 82a3419: `<lr-attachment-trigger>`: added a `triggerLabel` property (`trigger-label` attribute) that overrides the single-capability trigger button's `aria-label`, which previously came unconditionally from the built-in `CAPABILITY_META` table (e.g. `'Attach files'`, `'Attach an image'`, `'Use camera'`). Lets a host localize the accessible name without forking the component. Unset (the default) preserves today's exact `CAPABILITY_META`-derived label for every capability.
- 82a3419: Add `<lr-code-block>` `languages`, a map of language id to an already-imported shiki grammar module (e.g. `import bash from 'shiki/langs/bash.mjs'`). When `language` matches a key in `languages`, highlighting for it is seeded from exactly that pre-supplied grammar via a fine-grained `createHighlighterCore()` highlighter (`code-loader.ts`'s new `loadShikiHighlighterCore()`), bypassing the default `loadShikiHighlighter()` singleton and its dynamic per-language `loadLanguage()` import entirely for that language — no loading skeleton either, since this path never waits on that singleton. shiki's main entry point (what the default path imports) bundles a dynamic `import()` per bundled language (~200 of them), since a bundler can't statically narrow which of those a `loadLanguage(lang: string)` call might request at runtime; `shiki/core`'s fine-grained API has no such table, so a consumer who pins its full, known language set this way gets a build output scoped to just those languages instead of shiki's entire bundled set. A `language` value absent from `languages` (or left unset, or when `languages` itself is unset) still falls back to the ordinary dynamic-import path unchanged — this is a partial, additive opt-in, not a replacement for it.
- 82a3419: Fixed 'confirm()''s own usage example to import from the granular subpath
  ('@aceshooting/lyra-ui/components/dialog/confirm.js') instead of the root barrel
  ('@aceshooting/lyra-ui') — following the root-barrel example as written previously pulled in the
  library's entire ~80-component side-effect-import chain into a consumer's eager bundle
  (confirmed via a real build: +79 KB gzip regression, fixed by switching to the subpath import).
  No code changed, documentation only.
- 82a3419: Add `heading`/`closable` convenience chrome and a `--lr-dialog-max-width` token to `<lr-dialog>`. `<lr-dialog>` previously required a consumer to hand-build any visible title bar (by slotting a real heading element) and any close affordance (via a footer button wired to `close()`) — `heading` now renders a visible header row with that text when no heading element is slotted (still deferring to a slotted heading, unchanged, when present), and `closable` renders a built-in close (X) button in that same header row, wired through the exact same `close()` path Escape/backdrop-dismiss already use, with reason `'close-button'`. `[part="panel"]`'s previously-hardcoded `max-inline-size: min(32rem, 100%)` is now `min(var(--lr-dialog-max-width, 32rem), 100%)`, mirroring `<lr-media-card>`'s `--lr-media-card-max-height` — the default stays exactly `32rem` when unset. All three are additive/opt-in; existing consumers see no behavior change.
- 82a3419: `<lr-heatmap>`'s calendar mode gained four additive extensions. `firstDayOfWeek` (0-6, Sunday-first default, same numbering as `CalendarCellPos.weekday`) anchors the week grid at a different weekday instead of always Sunday, threaded into `buildCalendarGrid()`'s new `firstDayOfWeek` parameter; matrix mode ignores it. `rowY` overrides the y-origin computed for each weekday row, the vertical analogue of the existing `columnX`, consulted consistently by drawing, hit-testing, and the keyboard focus ring via a new private `rowYFor()` helper mirroring `columnXFor()`'s exact dispatch-with-computed-fallback shape. The previously matrix-mode-only `cellSize`/`fitToWidth` properties now also size calendar mode's grid, replacing its hardcoded 11px cell constant when explicitly set (unset, calendar mode keeps that original 11px default). The previously matrix-mode-only `scale` property now also governs calendar mode's bucketing: `scale="sqrt"` compresses via the same square-root magnitude compression matrix mode uses instead of always calling `quartileBucket()`, so one heavy day doesn't wash out a skewed dataset; the default `"linear"` preserves today's exact quartile-only calendar behavior. All four are opt-in and no-ops when left unset/default.
- 82a3419: `<lr-lite-chart>` gained seven additive properties. `pointText` overrides the per-bar/per-point `<title>`/`aria-label` tooltip text (mirrors `lr-heatmap`'s `cellText` hook), falling back to today's exact raw-value template when unset. `roundedBars` draws bars as a rounded-top-corner path instead of a square-cornered rect (default `false` keeps the plain rect). `skipZero` omits a bar entirely — no mark, no `tabindex`, no tooltip — for a value that is exactly `0`, instead of today's zero-height-but-focusable bar (default `false` unchanged). `padLeft`/`barGapRatio` override the internal `PAD_LEFT`/`BAR_GROUP_GAP` layout constants (36px / 0.2 respectively) when set. `scale` (`'linear' | 'sqrt'`, `type="bar"` only) switches the bar-height mapping from the default linear `niceDomain` fraction to a `Math.sqrt(value / domainMax)` compression mirroring `lr-heatmap`'s matrix-mode `sqrt` scale, so a skewed dataset's smaller bars aren't washed out by one dominant value; `type="line"` ignores `scale` entirely. `hideAxis` suppresses `renderGrid()`'s gridlines and y-axis tick labels altogether (x-axis category labels are unaffected). All seven are opt-in and no-ops when left unset/`false`.
- 82a3419: `<lr-markdown>` gains four additive properties. Every rendered `<img>` now carries a `part="img"` (with a matching `[part='img'] { max-width: 100% }` base style), alongside the existing `content`/`heading`/`code-block`/`link`/`table`/`blockquote` parts — previously images went through marked's default renderer with no styling hook at all. `heading-offset` (default `0`) shifts every rendered heading's depth before emitting `<h${depth}>`, clamped to `<h1>`–`<h6>`, letting a consumer nest rendered markdown under an existing heading level without losing document outline. `link-target` (default `'_blank'`, unchanged) can now be set to `null`/`''` to omit `target`/`rel="noopener noreferrer"` entirely and open links in the same tab, instead of always forcing a new tab. `eager-load` (default `false`) skips `connectedCallback()`'s async `marked`/`dompurify` `import()` and renders synchronously whenever the shared module cache (`markdown-loader.ts`) is already warm — e.g. a second `<lr-markdown>` on the same page, or a consumer that primes `loadMarkdownDeps()` at startup — avoiding the brief plain-text fallback paint that otherwise happens on every connect, even when both peers load without error. All four are opt-in; unset, output is byte-identical to before.
- 82a3419: `<lr-menu-item>` gained a `type` property (`'normal' | 'checkbox'`, default `'normal'`) and a `checked` boolean, mirroring `wa-dropdown-item`'s identical `type="checkbox"` pattern for building things like a "Word wrap" or "Show minimap" toggle inside a `<lr-menu>`. A `type="checkbox"` item renders `role="menuitemcheckbox"` (instead of `role="menuitem"`) with `aria-checked` reflecting `checked` and a checkmark glyph shown once checked; activating it (click, or Enter/Space via a parent `<lr-menu>`'s roving-focus handling) toggles `checked` and fires a new `lr-menu-item-change` event (`detail: { value, checked }`) in addition to — not instead of — the existing `lr-menu-item-select`, so a parent menu still closes and re-fires its consolidated `lr-menu-select` exactly as before. `type="normal"` (the default, and every existing `<lr-menu-item>` in the wild) is completely unaffected: same role, same rendering, same events as prior releases.
- 82a3419: `<lr-model-select>`: added a `label` property that renders a visible `part="form-control-label"` title above the trigger/combobox, paired with it via `for`/`id`, mirroring `<lr-select>`'s own `label` exactly. Once non-empty it also takes over as the accessible-name source, with an explicit host `aria-label` still winning over it (same precedence as `lr-select`). Unset (the default), the control keeps today's exact `aria-label || placeholder || 'Model'` fallback chain unchanged.
- 82a3419: `<lr-select>`'s single-enabled-option auto-commit trigger (added 1.3.0) is now gated behind a new `autoCommitSingleOption` property, default `false`. Previously this behavior was unconditional as soon as exactly one `<lr-option>` was enabled, silently swapping the trigger's ARIA role and keyboard model on any consumer whose option list happened to narrow to one entry at runtime. Existing consumers now get the pre-1.3.0 combobox trigger unless they explicitly opt in with `auto-commit-single-option`.
- 82a3419: `<lr-split>`'s `collapseState` is now a public accessor with force/auto semantics mirroring `<lr-app-rail>`'s `mode`: it was previously derived only from the `ResizeObserver`-measured container width, but assigning a concrete `'wide'`/`'rail'`/`'floating'` value now pins it there (ignoring further measurement) until released back to automatic tracking by assigning the write-only `'auto'` sentinel, which immediately re-derives it from the current width. `lr-split-collapse-change` fires on both a forced assignment and a release-to-auto, exactly as it already did for a breakpoint crossing, and only when the effective state actually changes. The `'floating'` tier also gains a new `open` property (default `false`): previously this state always rendered its pane as an always-visible overlay card the moment the container narrowed past `float-breakpoint`; it's now a hidden-by-default drawer — the pane renders nothing (hidden, out of the accessibility tree) until a consumer sets `open`, at which point it renders with a `[part="backdrop"]` scrim, traps focus, and closes (`open = false`) on Escape or a backdrop click, mirroring `<lr-app-rail>`'s mobile overlay. `collapseState` still reflects to a `collapse-state` attribute for CSS targeting. `open` defaulting to `false` is a deliberate behavior change for the `'floating'` tier specifically (it was previously always visible); every other collapse behavior, and `collapse="none"` (the default), is unaffected.
- 82a3419: `<lr-tabs>` can now render a leading icon inside a generated tab button without changing its accessible name. Give a panel's tab an extra direct-child sibling of `<lr-tabs>` carrying `slot="<id>-icon"` (any markup — an inline SVG, an emoji span, a custom icon element) and it renders ahead of the label inside that tab's button, wrapped in a new `part="tab-icon"` `aria-hidden="true"` span so it's always excluded from the button's accessible name (which stays exactly the `label` attribute's text, as before). A tab with no matching `<id>-icon` sibling renders no icon wrapper at all, so every existing text-only `<lr-tabs>` is byte-for-byte unaffected. A named slot (rather than an `icon="<name>"` attribute keyed into this library's internal `icons.ts`) was chosen because that internal set is a small closed vocabulary of chrome glyphs for this library's own components, not a public icon registry — a slot lets a consumer supply an arbitrary, domain-specific icon instead.

## 2.0.0

### Major Changes

- 8b5f729: **Breaking:** the root `@aceshooting/lyra-ui` entry point no longer re-exports or
  side-effect-registers the optional-peer-dependent component families — `<lr-chart>`
  and its typed subclasses, `<lr-box-plot>`, `<lr-histogram>`, `<lr-map>`, and
  `<lr-graph>`. Import each of these directly from its own subpath instead (the README
  already recommends granular subpath imports as the primary pattern):

  ```js
  import "@aceshooting/lyra-ui/components/chart/chart.js";
  import "@aceshooting/lyra-ui/components/map/map.js";
  ```

  Why: the root barrel previously re-exported every component's public API from one
  `lyra.ts` file, so TypeScript had to resolve `chart.js`/`maplibre-gl`/`d3-force`'s type
  declarations even for a consumer who only imports an unrelated component (e.g.
  `LyraEmpty`) from the package root — a hard compile error for anyone who hadn't
  installed every optional peer. Splitting these families out of the root barrel means
  importing `@aceshooting/lyra-ui` (or any of its remaining members) never requires an
  optional peer's types to be resolvable.

  Every other component (including `<lr-lite-chart>`, which has zero peer
  dependencies) is unaffected — the root barrel still re-exports/registers everything
  else exactly as before.

### Minor Changes

- 144ad8f: Add a `compact` flag tier and expose three fidelity tiers via `variant`.

  `@aceshooting/lyra-flags`: the ~65 emblem flags now ship a tiny WebP raster at
  `flags/compact/<code>.webp` (~1–3 KB) alongside the standard vector and the pristine `detailed`
  original. `flagUrl(code, { variant: 'compact' | 'standard' | 'detailed' })` selects a tier,
  code-split per flag _and_ per tier so a bundled app ships only the tiers it actually uses. The
  `standard` tier was also re-derived from the pristine originals so every flag is now under 80 KB
  (no fidelity loss perceptible at card/row scale).

  `@aceshooting/lyra-ui`: `<lr-flag>` gains a `variant="compact" | "standard" | "detailed"`
  property — a tiny raster for icon-scale use (menu items, language selectors), the default
  icon-optimized vector for card/row sizes, or the pristine full-detail vector for hero display.
  The `detailed` boolean is deprecated but kept working as an alias for `variant="detailed"`.

- 2a7390d: Fix `lr-heatmap` calendar mode's month/weekday axis labels to follow the runtime locale instead of hardcoded English, and add a `columnX` override so a calendar's week columns can be pixel-aligned with an external coordinate function.
- 43864d6: Add `lr-lite-chart` `layout="scroll"` (fixed-width, horizontally-scrollable bars via `barWidth`), `maxLabels` axis-label decimation, and a `barX` coordinate override for pixel-aligning bars with a sibling `lr-heatmap`.
- 043b7b0: Move `LyraSelectSize` above `<lr-select>`'s class JSDoc block so `custom-elements.json` correctly documents `lr-select` as a custom element.
- 7bbe3d2: Add `lr-split` opt-in responsive collapse (`collapse="start"|"end"`, `rail-width`, `rail-breakpoint`, `float-breakpoint`): below `rail-breakpoint` the chosen pane clamps to a fixed rail width, below `float-breakpoint` it becomes an absolutely-positioned floating overlay, both signaled via a `data-collapse-state` attribute/dataset marker and the new `lr-split-collapse-change` event.
- f14165f: `<lr-stat>` breakdown rows (`StatRow`) gain an optional `exactValue` field, mirroring the headline value's tooltip: setting it renders a `title` tooltip and makes that row's `[part='row-value']` keyboard-focusable, independently per row.
- d62725d: `lr-table`'s `[part='reveal-columns-button']` now renders only when a `priority` column is actually hidden by the `@container` breakpoints (or `showAllColumns` force-visible mode is active), instead of whenever any column merely declares a `priority`; the new `columnsHidden` reactive property and `lr-columns-hidden-change` event expose the same real-time state to consumers.

### Patch Changes

- Updated dependencies [144ad8f]
  - @aceshooting/lyra-flags@1.3.0

## 1.3.0

### Minor Changes

- 6358479: Added a "Conversation & Agent UI" family: chat/tool-call/agent-config building blocks for
  streaming AI interfaces, plus the general-purpose primitives (dialog, tabs, checkbox, switch,
  menu, chip, JSON viewer, live region, markdown, code block) they're built from. No breaking
  changes to any existing component.

  New tags: `lr-dialog`/`confirm()`, `lr-tabs`, `lr-checkbox`, `lr-switch`,
  `lr-json-viewer`, `lr-live-region` (+ `internal/announcer.ts`'s throttled `Announcer`),
  `lr-markdown` (needs the optional peers `marked`/`dompurify`), `lr-chat-message`,
  `lr-typing-indicator`, `lr-tool-call-chip`, `lr-tool-result-view` (+ its
  `registerToolRenderer()` renderer registry), `lr-tool-result-dialog`, `lr-chat-composer`
  (form-associated), `lr-attachment-chip`, `lr-stream-status`, `lr-virtual-list`,
  `lr-conversation-item`, `lr-model-select`, `lr-slider` (form-associated),
  `lr-tool-select-dialog`, `lr-citation-badge`, `lr-source-list`/`lr-source-card`,
  `lr-app-rail`, `lr-responsive-panel`, `lr-mention-popover`, `lr-streaming-text`,
  `lr-thinking-panel`, `lr-generation-status`, `lr-code-block` (needs the optional peer
  `shiki`), `lr-tool-approval-dialog`, `lr-tool-param-form`, `lr-menu`/`lr-menu-item`,
  `lr-chip`/`lr-chip-group`, `lr-model-settings-panel`, `lr-context-meter`,
  `lr-dock-panel`, `lr-document-preview`, `lr-media-card`, `lr-attachment-trigger`,
  `lr-kbd`, `lr-result-card`/`lr-result-field`.

  Also extends `internal/rtl.ts` with `rtlAwareSide()`/`rtlAwarePlacement()` (mirrors a physical
  `left`/`right` value, or the `left`/`right` component of a Floating UI `Placement`, under RTL) —
  used by `lr-menu`'s `placement` property so an explicit `placement="left-start"` still anchors
  to the trailing edge instead of the physical left when the page is RTL.

- 6358479: `<lr-select>`: when exactly one `<lr-option>` is enabled, the trigger now auto-commits that
  option on click or Arrow Up/Down instead of opening a single-row listbox — no chevron, no popup,
  `role="button"` instead of `role="combobox"`. Avoids an unnecessary extra click for "only one
  choice available" states (e.g. a filtered picker that's converged to a single match). Multi-option
  selects are unaffected; `value`/validity defaults are unchanged. Not gated behind a new prop — this
  is the new default trigger behavior for any select with a single enabled option.

## 1.2.0

### Minor Changes

- 6e832d5: `<lr-chart>`: added `IntersectionObserver`-gated lazy redraw and content-signature memoization — a
  chart skips calling into Chart.js while scrolled off-screen (redrawing once when it re-enters the
  viewport) or when none of its content-affecting properties (`type`, `labels`, `datasets`, `legend`,
  `area`, `xLabel`, `yLabel`, `y2Label`, `beginAtZero`, `horizontal`, `stacked`, `config`) have actually
  changed since the last draw. `refreshTheme()` is unaffected and always redraws.
- 9d36af5: `<lr-combobox>`: the input's accessible name now checks a host-level `aria-label` attribute before
  falling back to `label`/`placeholder`/`"Combobox"` — previously a plain `aria-label` on
  `<lr-combobox>` was silently ignored. Matches the same fix in `<lr-select>`.
- 0b3ea6c: `<lr-flag>`: added a `detailed` boolean property that requests the pristine, full-detail source SVG
  for the minority of flags whose default rendering was recently optimized for icon scale (e.g. `es`,
  `pt`, `sv` — see the `@aceshooting/lyra-flags` changeset). A safe no-op for every other flag. Useful
  for a flag rendered larger than icon scale (e.g. a hero display) where the extra illustrative detail
  is actually visible.
- 2027e3f: `<lr-flag>`: the default accessible name (`alt`, used when `label` is unset) is now a human-readable
  region name via `Intl.DisplayNames` (e.g. `language="en"` → `"United Kingdom"`) instead of the bare
  uppercase country code (`"GB"`, previously read letter-by-letter by most screen readers).
- 49569ed: `<lr-heatmap>`: fixed `role="img"` conflicting with the canvas's own focusable, keyboard-interactive
  descendant (arrow-key roving focus, Enter/Space activation) — now `role="group"`, matching
  `lr-lite-chart`/`lr-word-cloud`'s existing pattern. Added `cellText?: (pos, value) => string`, a
  formatter hook for the per-cell hover tooltip and keyboard live-region announcement (both draw from the
  built-in English template by default; this is additive, not breaking). Also fixed calendar mode's date
  label formatting, which hardcoded the literal `'en'` locale instead of the runtime locale.
- ef74f4a: `<lr-lite-chart>`: added `tickFormat?: (value: number) => string` to customize y-axis tick label
  formatting (e.g. currency, duration) instead of the built-in nice-number formatter. Also added
  `IntersectionObserver`-gated lazy rendering and content-signature memoization — a chart skips
  recomputing its grid/marks while scrolled off-screen or when none of its content-affecting properties
  (`type`, `labels`, `datasets`, `legend`, `xLabel`, `yLabel`, `beginAtZero`, `stacked`, plot size) have
  actually changed since the last render.
- 22cf001: `<lr-select>`: added a `size` property (`xs`/`s`/`m`/`l`/`xl`, default `m`, same scale as
  `lr-toast-item`'s `size`) for compact toolbar placements that don't fit the default trigger height.
  Also, the trigger's accessible name now checks a host-level `aria-label` attribute before falling back
  to `label`/`placeholder`/`"Select"` — previously a plain `aria-label` on `<lr-select>` was silently
  ignored.
- 4bf80aa: `<lr-stat>`: added `exact-value` (shown as a hover/focus tooltip on the headline value, e.g.
  `value="$1.2K" exact-value="$1,204.37"`), a `sub` property/slot (a secondary line distinct from
  `caption`, e.g. a comparison-period label), a `prose` boolean (renders `value` as smaller/lighter text
  with `unit` hidden, for a loading/status message in place of a numeric value), and a `compact` boolean
  (tighter padding for constrained spaces — same convention as `lr-empty`'s and `lr-widget`'s
  `compact`).
- c8206f8: `<lr-widget>`: added `fullscreen-inset` (a raw CSS `inset` shorthand, e.g. `"0 0 0 240px"`, applied to
  the fullscreen panel and backdrop instead of the default `var(--lr-space-l)` on every side — for apps
  with a persistent sidebar/toolbar that should stay visible during fullscreen) and a `compact` boolean
  (tighter header/body padding), matching `lr-empty`'s existing `compact` convention.
- a768a20: `<lr-word-cloud>`: fixed the rendered `<svg>` not respecting a host-assigned height —
  `[part='base']` had no `block-size` rule, so the internal `svg { block-size: 100% }` resolved against
  an indefinite containing-block height and fell back to the spiral layout's own intrinsic size instead,
  overflowing past the host's box. `[part='base']` now constrains to `block-size: 100%`, matching the
  component's own documented `<lr-word-cloud style="height: 20rem">` usage pattern.

### Patch Changes

- Updated dependencies [da766cb]
  - @aceshooting/lyra-flags@1.2.0

## 1.1.0

### Minor Changes

- c033ec0: `@aceshooting/lyra-flags`: `flagUrl(code)` is now genuinely code-split per flag — each code is
  its own dynamically-`import()`ed chunk, so using it (directly, or via `<lr-flag
country=...>`/`<lr-flag language=...>`) only ever fetches the flags actually requested at
  runtime, not all 249. This makes `flagUrl()` `async` (**breaking**: `Promise<string | undefined>`
  instead of `string`). `FLAG_URLS` (the old synchronous, eager, all-249-at-once map) is no longer
  exported from the package root — the equivalent for a consumer that genuinely wants every flag up
  front (e.g. a flag-picker listing every country) is the new `flagUrls()` (`async`, resolves the
  full map). `FLAG_LOADERS` (the new lazy per-code map `flagUrl()` is built on) is exported directly
  for consumers that want the per-code laziness without going through `flagUrl()`.

  `@aceshooting/lyra-ui`: `<lr-flag>` transparently picks up the lazy-loading fix — no changes
  needed at call sites using `country`/`language`. Also adds a new `src` property: a pre-resolved
  flag image URL that takes precedence over `country`/`language` and skips the peer-package lookup
  (and its loading-skeleton round trip) entirely, for consumers who already have a flag's URL at
  build time (e.g. via `import frUrl from '@aceshooting/lyra-flags/flags/fr.svg?url'`).

- c033ec0: Added `<lr-lite-chart>` — a dependency-free bar/line chart (plain SVG/DOM rendering, zero peer
  dependencies) for projects whose architecture forbids a charting dependency outright. Covers
  grouped/stacked bars, multi-series lines, per-point click (`lr-point-click`, same detail shape as
  `lr-chart`'s), and hover tooltips via native SVG `<title>`. Not a full `lr-chart` replacement —
  no zoom/pan, no pie/doughnut/radar/scatter/bubble types, no horizontal/dual-y-axis, no raw-config
  passthrough. Reuses `lr-chart`'s `--lr-chart-*` theme token names for free cross-component
  theming.
- c033ec0: Added `<lr-word-cloud>` — a dependency-free SVG word/tag cloud, laid out via an outward
  Archimedean-spiral placement search (heaviest word first). Supports `linear`/`sqrt` weight-to-font
  scaling, optional `mixed` (rotated) orientation, per-word or per-`group` coloring with a themeable
  `--lr-word-cloud-color-1..8` palette, and roving-tabindex keyboard navigation matching
  `lr-heatmap`'s pattern (a single tab stop, arrow keys, Home/End, a live-region announcement).

  Also a hardening pass across the rest of the library — real bugs fixed, not just polish:

  - `lr-skeleton`: `width`/`height` properties had zero visual effect (the custom property was set
    on the wrong shadow-DOM node); now actually resizes the placeholder.
  - `lr-combobox`: setting `open` directly (bypassing `show()`) never wired up click-outside or
    fired `lr-show`/`lr-hide`; picking a row or clearing while using `source` left stale async
    results displayed; a `<lr-option selected>` appended after the first slotchange was ignored;
    two nameless `multiple` comboboxes in the same form merged their submitted values; a pending
    debounced `source` fetch could fire after the element was removed.
  - `lr-chart`: bubble-chart series got a categorical (not numeric) x-axis, collapsing every point
    onto one tick; `resetZoom()` double-emitted `lr-zoom`, briefly reporting the stale pre-reset
    `zoomed` state to `{ once: true }` listeners.
  - `lr-date-picker` / `lr-date-input`: the already-exported `clampDate()` was never actually
    wired in, so `goToDate()`/`goToToday()` could navigate to (and focus) an out-of-range date;
    locale/weekday-format/first-day-of-week wiring gained test coverage; outside-month placeholder
    cells are now `aria-hidden` only in rows that also have a real visible day.
  - `lr-tree`: mouse-driven expand/collapse/select could desync the roving-tabindex `activeId` from
    real DOM focus; arrow-key expand/collapse is now RTL-aware, matching `lr-split`/`lr-time-range`.
  - `lr-widget`: the fullscreen focus trap didn't pierce into a slotted custom element's own shadow
    root, letting focus escape to a hidden nested control.
  - `lr-toast-item`: the close button used the native `disabled` attribute, which force-blurs a
    focused element with nothing to restore it — switched to `aria-disabled`.
  - `lr-empty`: gained a live-region announcement when entering the empty state, matching
    `lr-skeleton`'s existing `role="status"` convention.
  - Accessibility, documentation, and test-coverage fixes across most other components; `llms.txt`,
    `llms-full.txt`, and both READMEs corrected for drift against the current API surface.

  No breaking changes.

### Patch Changes

- Updated dependencies [c033ec0]
  - @aceshooting/lyra-flags@1.1.0

## 1.0.1

### Patch Changes

- 436b1ce: Fix `scripts/publish.sh` to commit `CHANGELOG.md` and `custom-elements.json` with each release commit (previously only `package.json`/the lockfile were staged, leaving those generated files uncommitted after every release). Remove the redundant `.github/workflows/publish.yml` CI job, which always failed by re-publishing a version `publish.sh` had already shipped.

## 1.0.0

### Major Changes

- 99fb0e0: Added several new components

### Patch Changes

- Updated dependencies [99fb0e0]
  - @aceshooting/lyra-flags@1.0.0

All notable changes to `@aceshooting/lyra-ui` are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Release notes on GitHub (`gh release create --generate-notes`) are generated from commit
history and may be more granular than this file; this file is the curated, human-readable
summary.

## [0.1.3] baseline

Current published baseline at the time this changelog was introduced. Historical versions
prior to 0.1.3 were not backfilled into this file — see git tags (`git tag -l`) and GitHub
Releases for the full release history.

- Free, clean-room Lit 3 web-component library — an open-source companion to Web Awesome.
- Tiered component set (layout/atoms, forms, overlays, data-viz/dashboard, temporal/graph,
  map/file/flag families) — see `packages/lyra-ui/llms.txt` and `llms-full.txt` for the full
  API reference.
- `@aceshooting/lyra-flags` optional companion package for `<lr-flag>` artwork.

[0.1.3]: https://github.com/aceshooting/lyra-ui/releases/tag/0.1.3
