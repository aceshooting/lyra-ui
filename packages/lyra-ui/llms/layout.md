## Breaking changes in 10.0.0

**`lr-virtual-list`:** the `lr-visible-range-changed` event is removed — listen for
`lr-visible-range-change` instead. The detail (`LyraVirtualListRange`), the firing conditions and the
gesture are all unchanged; only the name moved. The old spelling was the library's only past-tense
`-changed` event among 58 members of the `-change` family, so a convention-driven `lr-${x}-change`
listener silently missed it on a component embedded in ten viewers. It is removed outright rather
than kept as a dual-emitting alias, because the library has no released consumers and an alias is a
permanent tax paid to protect users who do not exist. Rename the listener; nothing else changes.

Also corrected in 10.0.0 — not breaking, but visible. `<lr-dashboard-grid>`'s cell keeps a focus
indicator while it is in a collision or drop state: the collision rule owns the outline channel by
design, but the side effect was that the focus ring vanished entirely during exactly the drag or
resize a keyboard user most needs it, so the ring is now re-expressed on a second channel. And
`<lr-card>` honors a `hidden` slotted media child instead of painting it — the component's own
`display` declaration is author-origin and was beating the UA stylesheet's `[hidden] { display: none }`.

## Breaking changes in 9.0.0

**`lr-app-rail`:** `mode`'s write side is removed: the accessor is now strictly read-only (always resolves to
'full'/'icon-only'/'mobile', never 'auto'). A new `forceMode` property/attribute (`force-mode`, type
`'full' | 'icon-only' | 'auto'`, unset by default) replaces it: assign 'full'/'icon-only' to pin that
mode, 'auto' (or unset) to release the pin and resume automatic breakpoint tracking. Unlike the
removed mode setter, 'mobile' can no longer be force-pinned — the mobile breakpoint is always tracked
automatically regardless, mirroring `preferredMode`'s existing scope; if a consumer needs a
guaranteed-mobile demo/test state, widen `mobile-breakpoint` instead. Whether the rail is currently
pinned is now itself observable (`forceMode === 'auto'` or unset means auto-tracking). `dragging`
loses its public setter — it's read-only; assigning it now throws (`el.dragging = true` ->
TypeError), matching that this component has always owned every drag transition itself. Exported
types renamed (TypeScript-only, no markup/runtime change): `AppRailMode` -> `LyraAppRailMode`,
`AppRailModeInput` -> `LyraAppRailModeInput`, `AppRailPreferredMode` -> `LyraAppRailPreferredMode`,
`AppRailPersistField` -> `LyraAppRailPersistField`, `AppRailModeChangeDetail` ->
`LyraAppRailModeChangeDetail`, `AppRailToggleDetail` -> `LyraAppRailToggleDetail`,
`AppRailResizeDetail` -> `LyraAppRailResizeDetail`.

**`lr-tab-group`:** Exported types renamed, TypeScript-only: `TabGroupPlacement` ->
`LyraTabGroupPlacement`, `TabGroupActivation` -> `LyraTabGroupActivation`.

**`lr-virtual-list`:** Exported types renamed, TypeScript-only: `VirtualListRange` ->
`LyraVirtualListRange`, `VirtualListGroup` -> `LyraVirtualListGroup`, `VirtualListItemRole` ->
`LyraVirtualListItemRole`, `VirtualListRowHeight` -> `LyraVirtualListRowHeight`,
`VirtualListIndexedSource` -> `LyraVirtualListIndexedSource`, `VirtualListSource` ->
`LyraVirtualListSource`, `VirtualListScroll` -> `LyraVirtualListScroll`.

**`lr-split-panel`:** Exported types renamed, TypeScript-only: `SplitPanelOrientation` ->
`LyraSplitPanelOrientation`, `SplitPanelPrimary` -> `LyraSplitPanelPrimary`, `SnapFunctionParams` ->
`LyraSplitPanelSnapFunctionParams`, `SnapFunction` -> `LyraSplitPanelSnapFunction`,
`SplitPanelRepositionDetail` -> `LyraSplitPanelRepositionDetail`. The unused, undocumented
`SplitPanelSnapFunction` compatibility alias (of what is now `LyraSplitPanelSnapFunction`) is deleted
outright — import `LyraSplitPanelSnapFunction` directly. `SNAP_NONE` and the `<lr-split-panel>`
tag/runtime API are unchanged.

**`lr-widget`:** `LyraWidgetView.icon` widens from `TemplateResult` to `unknown`, matching
`LyraSegmentedItem.icon`/`LyraStepItem.icon`. Purely additive: an existing `TemplateResult` icon
value keeps working unchanged; a plain string, DOM node, or any other Lit-renderable value is now
also accepted.

## `lr-multi-split`

Resizable panels for dashboard layouts. Direct **light-DOM children are the panels**; a divider is
auto-inserted between each adjacent pair. Panels participating in persistence carry a unique,
nonempty, whitespace-stable `panel-id`; this business identity stays independent from the platform
`id` attribute and is never rewritten.

Granular import: `@aceshooting/lyra-ui/components/layout/multi-split/multi-split.js`.
The Lyra-original v9 identity migration is mechanical: `lr-split` → `lr-multi-split`,
`LyraSplit` → `LyraMultiSplit`, generic container authoring types → the corresponding
`LyraMultiSplit*` names, identity-specific `lr-split-*` events → `lr-multi-split-*`, and
`--lr-split-*` hooks/storage keys → `--lr-multi-split-*`/`lr-multi-split:*`. The separate mirrored
`lr-split-panel`, its `LyraSplitPanel` class, `SnapFunction`, and `SNAP_NONE` are unchanged.

With a definite block size, each direct panel owns a native `overflow: auto` scroll surface and has
`min-block-size: 0`, so long content stays inside the split rather than escaping into following
content. Set `overflow` directly on an individual panel when its content needs a different scrolling
surface.

**Properties:**

- `sizes: number[] = []` (attribute: false — percentages per panel, auto-computed equally if
  omitted/mismatched)
- `defaultSizes: (number | string)[] = []` (attribute: false) — initialization-only fallback: a
  valid restored `storageKey` layout wins first; otherwise a valid `defaultSizes` wins over equal
  distribution. Initialization occurs on the first update so framework property bindings committed
  after connection in the same turn — including `defaultSizes` and `storageKey` — are honored
  before the layout becomes live. Later reassignment never overwrites live drag/persisted state —
  set it once, at mount. Each entry is either a plain **number** (percent-of-container, validated unchanged: a
  pure-number array that does not sum to ~100, e.g. `[30, 60]`, is still rejected and falls through
  to the equal split) or a CSS **length string** (`'200px'`, `'20%'`, `'3rem'`). When at least one
  entry is a length string, every entry is resolved through the public contextual
  `resolveCssLength()` utility (`%` against the measured container, `rem`/`em` against the
  owner-document/host, and `vw`/`vh` against the owner window), then normalized to percentages
  before the same validation applies — so `['200px', '300px']` on a 500px container initializes to
  `[40, 60]`.
- `min: number = 10` (min % per panel)
- `orientation: 'horizontal'|'vertical' = 'horizontal'` (reflected) — the axis used at/above
  `orientationBreakpoint` (or always, when that's unset).
- `orientationBreakpoint?: number | string` (attribute `orientation-breakpoint`) — opt-in inline-size
  breakpoint measured on `[part='base']`; unset (the default) means no behavior change at all, and
  no `ResizeObserver` is armed. Below it, `narrowOrientation` becomes the effective axis instead of
  `orientation`. Accepts a bare pixel number (`900`, `orientation-breakpoint="900"`) or a CSS length
  string: `'900px'`, `'56.25rem'`, `'3em'`. Under the default `orientationBreakpointBasis='container'`,
  `rem` resolves against the document root's **computed** font size (the rule a `@container` query
  follows) and `em` against this element's own computed font size. The length is **re-resolved on
  every measurement**, never cached at first render, so a root font-size change moves the crossing
  width with no invalidation step on the consumer's side. Anything that isn't a resolvable length
  behaves exactly as unset (no observation, no `data-effective-orientation`): `''`, `'auto'`,
  garbage, a non-finite number, and deliberately `%`, `vw`/`vh` and `calc()` — a viewport-relative
  threshold would mix reference boxes against a measurement of the element's own allocation. For a
  genuinely viewport-relative breakpoint set `orientationBreakpointBasis='viewport'` instead.
- `orientationBreakpointBasis: 'container'|'viewport' = 'container'` (reflected, attribute
  `orientation-breakpoint-basis`) — which box `orientationBreakpoint` is compared against. Unset,
  behavior is identical to before this property existed. `'container'` measures this component's own
  `[part='base']` via `ResizeObserver` and compares strictly `<`. `'viewport'` evaluates
  `matchMedia('(max-width: <breakpoint>)')` and arms no `ResizeObserver` for the orientation feature
  at all, so the shared observer stays armed only for `collapse`; its comparison is inclusive (`<=`),
  because that is what native `max-width` means — deliberate, so the crossing point matches a CSS
  `@media` rule authored with the same length exactly.
  **`rem`/`em` mean different things under the two bases, and this is the reason `'viewport'` exists.**
  Inside a media query, relative units resolve against the browser's _initial_ font size and ignore
  any `html { font-size }` override; under `'container'` they resolve against live computed font
  sizes. The two agree unless an app re-points the root font size. So when the breakpoint must stay
  in lockstep with a CSS `@media` rule, `'viewport'` is the exact match — the browser evaluates the
  same query, live, across browser zoom and user font-size preferences, with no px re-derivation.
- `narrowOrientation: 'horizontal'|'vertical' = 'vertical'` (reflected, attribute `narrow-orientation`)
- `effectiveOrientation: 'horizontal'|'vertical'` (readonly getter) — the live resize/layout axis
  actually in effect; identical to `orientation` whenever `orientationBreakpoint` is unset or
  doesn't resolve to a length. Also reflected as `data-effective-orientation` (only present while
  `orientationBreakpoint` resolves to a usable length).
- `storageKey?: string` (attribute `storage-key`) — persists a versioned list of `{ panelId, size }`
  records to `localStorage` under `` `lr-multi-split:${key}:panels` ``. Every direct panel must have
  a unique, nonempty, whitespace-stable `panel-id`; a missing, surrounding-whitespace, or duplicate identity fails persistence closed without
  disabling the live split. Restores and same-instance membership reconciliation follow `panelId`,
  so a reorder/replacement never transfers a saved size to a different business panel.
- `panelConstraints: (LyraMultiSplitPanelConstraint | null)[] = []` (attribute: false) — `LyraMultiSplitPanelConstraint { minPx?:
number; maxPx?: number; minPercent?: number; maxPercent?: number }`, index-aligned with `sizes`; a
  `null`/missing entry (or an omitted bound within an entry) leaves that side of that panel purely
  percent-based (the existing `min`-only behavior). Combining a px and a percent bound on the same
  side resolves to the stricter one (larger for min, smaller for max) via a native CSS `max()`/`min()`
  in the rendered `clamp()` flex-basis. `sizes`, the `lr-resize` payload, and localStorage persistence
  stay percent-based regardless — only the effective drag/keyboard clamp bounds (and the rendered
  `flex-basis`, via a native CSS `clamp()` so a constrained panel stays pinned between its bounds
  across container resizes with no extra `ResizeObserver`) change for a constrained panel.
- `collapse: 'start'|'end'|'none' = 'none'` (reflected) — opt-in responsive collapse for one panel:
  `'start'`/`'end'` is a _logical_ position (RTL-aware, matching CSS logical properties — the panel at
  the document's visual leading/trailing edge, not a raw array index). `lr-multi-split` only owns the
  width-collapse mechanics/state signaling below; it renders no icon-only UI itself — the collapsing
  panel's own slotted content is expected to adapt itself (e.g. via its own `@container` query reading
  the panel's clamped width or `data-collapse-state`, see below).
- `railWidth: string = '3.5rem'` (attribute `rail-width`) — the fixed CSS length the collapsing panel
  clamps to in `'rail'` state.
- `railBreakpoint: number | string = 640` (attribute `rail-breakpoint`) — below this width, the
  collapsing panel switches from its normal drag-resizable percent width to the fixed `railWidth`.
  Accepts a bare pixel number (`640`, `rail-breakpoint="640"` — the original form) or a CSS length
  string: `'640px'`, `'68.75rem'`, `'3em'`. Under the default `collapseBreakpointBasis='container'`
  it is compared against this component's own measured `[part='base']` inline size (a
  `ResizeObserver`, active only while `collapse !== 'none'`), and `rem` resolves against the
  document root's **computed** font size while `em` resolves against this element's own; the length
  is re-resolved on every measurement, never cached. Anything the grammar rejects — `''`, `'auto'`,
  garbage, a non-finite number, and deliberately `%`, `vw`/`vh`, `calc()` and `var()` — falls back
  to the `640` default rather than switching the feature off (unlike `orientationBreakpoint`, this
  breakpoint has a documented default to fall back to). A negative length is floored at `0`, i.e.
  never crossed. Must stay above `floatBreakpoint` — an inverted pair is sanitized by raising this
  one to match, collapsing the `'rail'` band away rather than reporting a wide container as
  collapsed.
- `floatBreakpoint: number | string = 400` (attribute `float-breakpoint`) — below this narrower
  width, the collapsing panel instead becomes an absolutely-positioned overlay ("floating card") on
  top of the other pane(s), removed from the normal flex flow; the sibling(s) take the full width.
  Same accepted forms, basis, and sanitization as `railBreakpoint`; an unparseable value falls back
  to the `400` default.
- `collapseBreakpointBasis: 'container'|'viewport' = 'container'` (reflected, attribute
  `collapse-breakpoint-basis`) — which box `railBreakpoint`/`floatBreakpoint` are measured against.
  Unset, behavior is identical to before this property existed. `'container'` observes this
  component's own `[part='base']` inline size via `ResizeObserver` and compares strictly `<`;
  `'viewport'` evaluates `matchMedia('(max-width: <breakpoint>)')` for each of the two thresholds,
  which is inclusive (`<=`) — native `max-width` semantics, deliberately, so the crossing point
  matches a CSS `@media` rule authored with the same length exactly. Use `'viewport'` to collapse in
  step with a page-level responsive layout (a shell whose own `@media` rules restack at the same
  width) rather than with this split's own allocation; it is also what lets the browser resolve a
  `rem` breakpoint with real `@media` semantics (against the _initial_ font size, ignoring an
  `html { font-size }` override). Both bands are classified from both queries together on every
  change, so a fast resize crossing both thresholds at once still lands on one correct state and
  fires `lr-multi-split-collapse-change` once; under `'viewport'` the first paint is already correct — no
  `ResizeObserver` round-trip — and that initial state is not announced as a transition.
- `collapseState: 'wide'|'rail'|'floating'` (reflected, attribute `collapse-state`) — a public
  accessor with force/auto semantics mirroring `<lr-app-rail>`'s `mode`: normally derived
  automatically from the measured container width, but assigning it a concrete value pins it there
  (stopping automatic breakpoint tracking) — useful for a consumer-driven toggle (e.g. a button that
  forces `'floating'` regardless of width). Assigning the write-only `'auto'` sentinel releases the
  pin and immediately re-derives the state from the current measured width; the getter never returns
  `'auto'`. This is an **effective** state: while `collapse='none'` or fewer than two panels exist,
  the getter/reflected attribute stays `'wide'` and forced rail/floating intent produces no event,
  marker, backdrop, focus trap, or scroll lock. Enabling an eligible pane can make retained forced
  intent effective; disabling/removing it transitions back to `'wide'`, closes `open`, releases
  overlay ownership, and restores focus.
- `open: boolean = false` (reflected) — whether the `'floating'` collapse state's drawer is shown.
  While `collapseState` is `'floating'` and `open` is `false` (the default), the collapsing panel
  renders nothing (`hidden`, out of the accessibility tree) instead of the always-visible overlay
  card this state rendered before `open` existed. Setting `open = true` reveals it as a
  focus-trapped floating panel with a `[part="backdrop"]` scrim; Escape or a backdrop click set
  `open` back to `false`. Leaving `'floating'` while `open` is still `true` also closes it, the same
  way `<lr-app-rail>` closes its mobile overlay when leaving `'mobile'` while open.

`collapse`'s three resulting states — `'wide'` (default, today's plain layout) / `'rail'` / `'floating'`
— are exposed as: a `data-collapse-state` attribute on both the host and the collapsing panel element
itself (absent for `'wide'`/`collapse="none"`); and the `lr-multi-split-collapse-change` event below. The
divider adjacent to the collapsed panel is drag/keyboard-disabled (`aria-disabled="true"`) while
collapsed. `collapse="none"` (the default) is byte-for-byte identical to pre-collapse-feature behavior.

`dividerLabel?: (index: number, panelCount: number) => string` (attribute: false) customizes the
localized accessible label generated for each auto-inserted divider.

**Events:** `lr-resize-request` (cancelable; `detail: { sizes }` is the proposed constrained size
array from a divider drag or keyboard step. Call `preventDefault()` to leave `sizes` and its
persisted layout unchanged. It is not emitted when a consumer assigns `sizes` directly or a
keyboard/pointer proposal clamps to the already-current sizes),
`lr-resize` (non-cancelable; the same `detail: { sizes }`, emitted after an accepted drag movement
or keyboard step commits. A genuine pointer gesture has one terminal persistence write on
`pointerup`; no-move, fully clamped, vetoed, canceled, and lost-capture gestures have none. Pointer
release emits no additional event; direct `sizes` assignments stay silent),
`lr-multi-split-collapse-change` (`detail: { state: 'wide'|'rail'|'floating' }`, fired only
on a real `collapse`-state transition, never on every resize/render),
`lr-multi-split-constraints-invalid` (`detail: LyraMultiSplitConstraintIssueDetail`, fired once when the configured
panel minimums/maximums cannot fit the track; the infeasible set is rejected for interaction and a
normalized percent minimum is used instead), `lr-multi-split-orientation-change` (`detail: { orientation }`,
fired only when an enabled `orientationBreakpoint` actually changes `effectiveOrientation`)

**Slots:** default (each direct child element is one panel; set a unique `panel-id` on every child
when `storage-key` is used).

**CSS parts:** `base` (`position: relative`, so the `'floating'` state can anchor to it), `divider`
(carries `aria-disabled="true"` and is drag/keyboard-inert while its adjacent panel is collapsed),
`backdrop` (the `'floating'` drawer's scrim — only rendered while `collapseState === 'floating'` and
`open`)

**Themeable custom properties:** `--lr-multi-split-overlay-color` (default `var(--lr-color-overlay)`) —
the `'floating'` drawer's `[part='backdrop']` scrim; scoped to `[part='base']`, not the viewport.
`--lr-multi-split-divider-target-size` (default
`max(var(--lr-icon-button-size), var(--lr-size-3px))`) — the real flex track/gutter reserved for the
divider along the resize axis. The 3px visual rule is painted in its center; no pseudo-element
extends into either adjacent panel, so slotted controls retain pointer ownership up to their edge.
Set it on an ancestor to retune a split subtree or directly on one component; either public value
remains authoritative.
Otherwise shared tokens only.

**Optional peer deps:** none.

```html
<lr-multi-split storage-key="dashboard-main" min="15">
  <div panel-id="navigation">Panel A</div>
  <div panel-id="content">Panel B</div>
  <div panel-id="inspector">Panel C</div>
</lr-multi-split>
```

Keyboard: focus a divider (`Tab`), then `ArrowRight`/`ArrowLeft` (horizontal) or
`ArrowDown`/`ArrowUp` (vertical) to resize by a fixed 2% step — RTL-aware for horizontal layouts
(under `direction: rtl`, the forward/backward keys and drag-delta sign both swap so they still track
the visually-adjacent panel).

**Known gotchas:**

- Panel membership tracks the complete ordered direct-child identity sequence, not just its count.
  Same-count `replaceWith()` and DOM reorder immediately reconcile visual order with DOM/AX order
  while preserving sizes by `panel-id`; count changes retain existing panels' relative proportions
  and allocate an equal share to each new identity. Without a complete unique `panel-id` set, the
  live layout retains the positional fallback but persistence is deliberately disabled. Every temporary
  inline layout/collapse declaration, `hidden`, and `data-collapse-state` value is
  snapshot/adopt/restore-owned, so late author writes survive removal, disconnect/adoption, reuse,
  and reconnect without stale multi-split state.
- divider `aria-valuemin`/`aria-valuemax` are computed per adjacent pair from the same resolved
  `panelConstraints` bounds used by pointer and keyboard resizing, rather than a blanket
  `100 - min`. They therefore remain accurate for 3+-panel layouts and for px/percent constraints.
  Each divider also has its own `aria-label` ("Resize divider between panel N and panel N+1")
  distinguishing it from any other divider in a multi-divider layout.
- infeasible aggregate constraints (for example, three panels with `min=40`) are reported through
  `lr-multi-split-constraints-invalid`; interaction rejects that set and uses a normalized percent minimum
  with aggregate slack, so the divider remains operable instead of silently freezing.
- concurrent drags are tracked per `pointerId` (not a single scalar), so a multi-touch drag on two
  different dividers moves both independently instead of the second pointer clobbering the first's
  drag state; `pointercancel`/`lostpointercapture` (not just `pointerup`) both end a drag.
- `localStorage.getItem`/`setItem` calls are now both wrapped in their own `try`/`catch` (in addition
  to the `JSON.parse` result already being caught), so a blocked or quota-exceeded store fails
  silently instead of throwing from inside a `pointerup`/`keydown` handler. A malformed/duplicate
  identity record or layout whose sizes are already below the current `min` floor is rejected rather
  than restored.
- Pointer-drag lifecycle (pointer capture, window-listener cleanup on both drag-end and
  `disconnectedCallback`) is solid and safe to rely on.
- `orientationBreakpoint` shares its `[part='base']` `ResizeObserver` with `collapse` (one observer,
  not two) — arming logic covers either feature being opted into independently.
- **Switching a basis moves the crossing point by exactly 1px.** Container basis compares strictly
  `<` against a measured width; viewport basis asks `matchMedia('(max-width: …)')`, which is
  inclusive (`<=`). So at a breakpoint of `640`, a container-basis split is still `'wide'` at 640px
  while a viewport-basis one has already collapsed. This is deliberate on both sides: `<` is the
  right comparison for "how much room do I actually have", and `<=` is what a CSS `@media` rule with
  the same length does, which is the whole point of the viewport basis.
- `collapseBreakpointBasis='viewport'` does **not** drop the `ResizeObserver` the way the
  orientation feature's viewport basis does. The measured width it feeds is still read by a
  container-basis `orientationBreakpoint` and by the `collapseState = 'auto'` release path, which
  re-derives from the current measured width. Collapse's basis changes only _which values_ the
  classification consults, never whether the split measures itself.
- `railBreakpoint`/`floatBreakpoint` are typed `number | string`. Authored as attributes they read
  back as **strings** (`el.railBreakpoint === '640'`, not `640`) — the same value, a different type.
  Compare with `Number(el.railBreakpoint)` rather than `===`, or assign the property directly when a
  numeric identity matters.
- **Picking a basis.** `orientationBreakpointBasis='container'` (the default) observes the
  component's own allocated inline size, so it fits a component that is the sole flex/grid item in
  the container being measured. It does **not** fit a component sitting beside a fixed-width sibling
  in a row that stacks via a CSS `@media` rule: while the row is a row, this element's width shrinks
  with the viewport; the instant the row stacks (a pure-CSS event no component can observe) it jumps
  to the _full_ row width — wider than it was just before the transition. Because the measured width
  is not monotonic across that transition, no single container threshold both stays wide while the
  row is a row and goes narrow exactly when it stacks. A fixed-width sibling is worse still: its own
  width never changes with the viewport at all, so no container breakpoint on it can react to the
  stacking.
  That layout is what `orientationBreakpointBasis='viewport'` is for. Give every sibling the same
  `orientation-breakpoint` and `orientation-breakpoint-basis='viewport'` and they flip together, in
  lockstep with the CSS rule that stacks the row:
  ```html
  <lr-stepper
    orientation-breakpoint="56.25rem"
    orientation-breakpoint-basis="viewport"
  ></lr-stepper>
  <lr-multi-split
    orientation-breakpoint="56.25rem"
    orientation-breakpoint-basis="viewport"
  ></lr-multi-split>
  <style>
    @media (max-width: 56.25rem) {
      .shell {
        flex-direction: column;
      }
    }
  </style>
  ```
  A consumer-side `matchMedia()` controller driving the `orientation` attribute directly is still
  supported and still correct — it is simply no longer required for this case.

---

## `lr-split-panel`

Accessible two-pane resizing with the public `wa-split-panel` / `sl-split-panel` contract. Use this
component when migrated markup has named `start` and `end` panes. The separate `<lr-multi-split>` is
Lyra's multi-panel layout: its direct default-slot children, responsive collapse modes, and
multi-divider events are intentionally a different API.

**Properties:**

- `position: number = 50` (reflected) — divider position from the selected `primary` pane's edge,
  as a percentage from 0–100. With no `primary`, the logical `start` pane is the reference.
- `positionInPixels: number` (attribute `position-in-pixels`) — the same position in pixels.
  Assigning either position updates the other after the component has a layout box; both remain
  synchronized after pointer/keyboard changes and host resizes.
- `orientation: 'horizontal'|'vertical' = 'horizontal'` (reflected) — side-by-side panes or stacked
  panes. `vertical: boolean = false` (reflected) is the synchronized Shoelace spelling: setting
  either API updates the other. If both attributes occur in initial markup, the canonical
  `orientation` attribute wins.
- `disabled: boolean = false` (reflected) — makes the divider pointer/keyboard-inert and removes it
  from the tab order. Host resizing can still update synchronized position values.
- `primary?: 'start'|'end'` — when unset, the panes resize proportionally and `position` stays fixed
  as the host changes size. When set, that pane keeps its pixel size and the other pane absorbs the
  resize. Position values are always measured from the selected primary edge.
- `snap: string | SnapFunction = ''` — pointer-drag snap behavior. A string accepts space-separated
  pixels, percentages, and repeat expressions (`'160px 50% repeat(100px)'`) and reflects to the
  `snap` attribute. It parses and caches the numeric value/unit projection from at most the first
  16,384 UTF-16 code units and 256 finite valid tokens; later source text cannot affect snapping. A property-bound
  `SnapFunction` receives `{ pos, size, snapThreshold }` in pixels and returns the desired pixel
  position; callback code decides how to use the supplied threshold. The setter also accepts
  `undefined` for mapped source compatibility, clearing the configuration to the canonical `''`
  read value. Function and empty values remove the serializable attribute.
- `snapThreshold: number = 12` (attribute `snap-threshold`) — maximum pixel distance at which a
  string snap point takes effect. Non-finite values fall back safely and negative values clamp to
  zero.

**Events:** `lr-reposition-request` (cancelable; `detail: SplitPanelRepositionDetail`, where
`{ position, positionInPixels }` is the final snapped and constrained proposed position measured
from the selected `primary` pane's edge. Call `preventDefault()` to leave both position properties
unchanged. It is not emitted when a consumer assigns `position` or `positionInPixels` directly),
`lr-reposition` (non-cancelable, no detail) — bubbling and composed, emitted after an accepted
pointer or keyboard interaction commits the divider position; direct property assignments stay
silent.

**Slots:** `start` (logical start pane), `end` (logical end pane), `divider` (optional decorative
custom-handle content inside the separator; its assigned subtree is inert, so the separator remains
the sole pointer/keyboard resize control). Under RTL, logical start/end and horizontal pointer/arrow
behavior mirror together; vertical behavior does not invert.

**CSS parts:** `base split-panel` (both tokens are on the same outer wrapper), `start panel` and
`end panel` (each pane exposes its individual token plus the shared `panel` token), `divider`
(focusable `role="separator"`, with value/min/max and disabled ARIA state).

**Themeable custom properties:** `--divider-width` (default `4px`), `--divider-hit-area` (requested
default `12px`, with Lyra's `--lr-icon-button-size` minimum target remaining the floor), `--min`
(default `0`) and `--max` (default `100%`) for the primary pane, or the start pane when no primary is
selected. Lyra-prefixed aliases are `--lr-split-panel-divider-width`,
`--lr-split-panel-divider-hit-area`, `--lr-split-panel-min`, and `--lr-split-panel-max`; when both
spellings are set, the Lyra-prefixed value wins. Constraint values may be lengths, percentages, or
`calc()` expressions and are re-applied when their computed sizes change.

`--lr-split-panel-divider-hover-color` (default `var(--lr-color-brand)`) is the divider's background
on hover/keyboard focus. `--lr-split-panel-divider-active-color` (default
`var(--lr-color-border-strong)`) is its background while being dragged, or focused and pressed via
the keyboard. Both are independent, component-scoped hooks rather than the bare shared token, so
retinting this divider does not also retint any other component that happens to default to the same
color.

Keyboard: focus the divider, then use Left/Right for a horizontal split or Up/Down for a vertical
split. Each arrow moves one percent of the current allocation; horizontal arrows mirror under RTL.
`Home` and `End` move to the current `--min` and `--max` bounds. Pointer dragging uses capture and
cleans up on pointer up, cancellation, capture loss, disconnect, and orientation changes.

**Optional peer deps:** none.

```js
import "@aceshooting/lyra-ui/components/layout/split-panel/split-panel.js";
```

```html
<lr-split-panel
  primary="start"
  position-in-pixels="240"
  snap="25% 50% 75%"
  aria-label="Resize editor panes"
  style="block-size: 20rem; --min: 10rem; --max: 30rem"
>
  <nav slot="start" aria-label="Files">…</nav>
  <main slot="end">…</main>
  <span slot="divider" aria-hidden="true">⋮</span>
</lr-split-panel>
```

**Known gotchas:** a vertical split needs a definite block size so percentages have an axis to
resolve against. `snap` callbacks are JavaScript functions and must be assigned as properties, not
serialized into an HTML attribute. The visible divider can remain narrow because its transparent
hit region expands independently; use `--divider-width` for the painted line and
`--divider-hit-area` for the requested interaction region.

---

## `lr-widget`

A titled panel shell with an optional collapse toggle and an optional fullscreen-expand toggle.
First-party invention (no `wa-*`/`sl-*` counterpart). Fullscreen promotes the same host element in
place (a CSS state, not a clone/portal), so slotted content (a chart, a running simulation, scroll
position) survives the transition.

**Properties:**

- `label: string = ''`
- `sublabel: string = ''`
- `collapsible: boolean = false` (reflected — shows the collapse/expand chevron button)
- `collapsed: boolean = false` (reflected)
- `expandable: boolean = false` (reflected — shows the fullscreen toggle button)
- `fullscreen: boolean = false` (reflected)
- `fullscreenInset: string = ''` (attribute `fullscreen-inset`) — CSS `inset` shorthand applied to
  `[part="base"]` while fullscreen instead of the default per-side
  `max(var(--lr-space-l), <safe-area inset>)`, e.g. `"0 0 0 240px"` to leave a 240px persistent
  sidebar/toolbar visible during fullscreen. Invalid values, declaration-breaking input, and
  `url()` are ignored.
- `compact: boolean = false` (reflected) — tighter header/body padding, same convention as
  `lr-empty`'s `compact`
- `backdropInset: string = ''` (attribute `backdrop-inset`) — overrides the fullscreen backdrop's
  CSS `inset`; when empty or invalid, the backdrop remains viewport-filling (`0`) independently of
  `fullscreenInset`
- `views: readonly LyraWidgetView[] = []` (attribute: false) — named alternate views for the panel body, e.g. a
  chart/table toggle inside the same card chrome; `LyraWidgetView { viewId: string; label?: string; icon?:
TemplateResult; ariaLabel?: string }`. Each entry gets a header toggle button
  (`[part='view-toggle']`) and a `<slot name="view-${viewId}">`. An icon-only view should set
  `ariaLabel`; if both labels are omitted, the button uses `viewId` as a last-resort accessible name.
  Empty (the default) renders today's single unnamed default slot as the sole view, unchanged.
  Up to 256 valid records are snapshotted; IDs must be unique, nonempty, and whitespace-stable.
  Malformed/hostile entries are ignored without rejecting the component update.
- `activeViewId: string = ''` (attribute: false) — the currently active view's `viewId`; defaults to the
  first entry of `views` (or `''` when `views` is empty). Settable directly to control the active
  view externally; also updated internally when a view toggle is clicked.
- `activeView: string = ''` (attribute: false) — **deprecated alias for `activeViewId`**, which it
  seeds. `activeView` was this member's original public name and the rename was never announced, so
  a shipped `.activeView=${…}` binding silently became inert and the widget fell back to its first
  view. It seeds rather than being read alongside, because the component itself writes
  `activeViewId` (a toggle click, and the fallback when `views` drops the active id) — so a stale
  alias must not undo a later interactive change. Prefer `activeViewId` in new code.
- `accessibleLabel: string | null = null` (attribute `aria-label`) — overrides the label-derived
  fullscreen dialog name. An explicitly empty value is retained; property, slotted-label, and
  localized fallbacks apply only when it is absent.
- `storageKey?: string` (attribute `storage-key`) — when set, persists `collapsed` to `localStorage`
  under `lr-widget:${storageKey}` and restores it on the next mount (mirrors `lr-app-rail`'s/
  `lr-table`'s identical `storage-key` pattern). Without a `storageKey` there is no persistence and
  storage is never touched — listen for `lr-collapse-change` and persist the state yourself.

**Events:** `lr-collapse-request` (cancelable; `detail: { collapsed }` is the state proposed by the
built-in collapse toggle. Call `preventDefault()` to leave `collapsed` and any persisted state
unchanged. It is not emitted when a consumer assigns `collapsed` directly), `lr-collapse-change`
(non-cancelable; `detail: { collapsed }` is the accepted built-in-toggle state. It is not emitted
when a consumer assigns `collapsed` directly), `lr-fullscreen-request` (cancelable; `detail: {
fullscreen }` is the state proposed by the fullscreen toggle, Escape, or a backdrop click. Call
`preventDefault()` to leave `fullscreen` unchanged. Not emitted when a consumer assigns
`fullscreen` directly), `lr-fullscreen-change` (non-cancelable; `detail: { fullscreen }` is the
accepted state — also fired when fullscreen is exited via Escape or a backdrop click, not just the
toggle button. Not emitted when a consumer assigns `fullscreen` directly), `lr-view-request`
(cancelable; `detail: { viewId }` is the view proposed by a header view-toggle click. Call
`preventDefault()` to leave `activeViewId` unchanged. Not emitted when a consumer assigns
`activeViewId` directly), `lr-view-change` (non-cancelable; `detail: { viewId }`, the accepted
active view's `viewId`. Not emitted when a consumer sets `activeViewId` directly)

**Slots:** default (the panel body, rendered only while `views` is empty), `icon` (optional leading
icon in the title row; its flattened subtree is inert and aria-hidden), `label` (rich label content,
overrides the `label` attribute), `sublabel` (rich sublabel content, overrides the `sublabel`
attribute), `actions` (header action controls,
rendered before the collapse/expand buttons), `collapse-icon` (replaces the built-in chevron in the
collapse toggle via native slot fallback; its assigned content is decorative, inert, and aria-hidden
so the outer toggle remains the only action. The whole button rotates while expanded, so use a
collapsed/right-facing baseline for a directional override; only meaningful while `collapsible`),
`fullscreen-icon` (replaces the built-in glyph in the fullscreen toggle — the override replaces
_both_ the "expand" and "exit fullscreen" defaults, so the consumer owns that distinction, e.g. by
reading the `fullscreen` attribute; its assigned content is decorative, inert, and aria-hidden so
the outer toggle remains the only action; only meaningful while `expandable`), and one `view-{viewId}`
slot per `views` entry, used instead of the default slot

**CSS parts:** `base`, `header`, `title`, `icon` (wrapper around the `icon` slot, hidden entirely when
empty), `label-group` (wrapper around the label and sublabel), `label`, `sublabel`, `actions`,
`view-toggles` (the header toggle-button group, only rendered when `views` is non-empty),
`view-toggle` (a single view toggle button), `view-icon` (a decorative view glyph whose rendered
subtree is inert and aria-hidden, leaving the toggle as the sole action), `view-label`
(a view's visible label), `collapse-button`, `fullscreen-button`, `body`, `backdrop`

Both header rows (`actions` and `view-toggles`) scroll horizontally on their own when the header is
too narrow for them, and each independently paints a `--lr-scroll-fade-size` edge fade while — and
only while — it actually overflows, so a clipped row reads as scrollable rather than truncated. The
overflow is measured, not assumed: a row that fits is left unmasked.
Forced-colors mode disables those decorative masks while retaining the native scroll owners. The
body is the block-axis scroll owner whenever the widget receives a constrained height, so the
header remains fixed while deep body content scrolls.

**Themeable custom properties:** `--lr-widget-overlay-color` (default `var(--lr-color-overlay)` —
the fullscreen backdrop scrim color), `--lr-widget-fullscreen-inset` (default per side
`max(var(--lr-space-l), <safe-area inset>)` — the fullscreen `[part="base"]` inset; the
`fullscreen-inset` attribute overrides it), and `--lr-widget-backdrop-inset` (defaults to `0` so
the modal backdrop covers the viewport; the `backdrop-inset` attribute overrides it), plus shared
tokens (`--lr-space-*`, `--lr-color-border/-surface/-text-quiet`,
`--lr-radius`, `--lr-shadow`, `--lr-icon-button-size`, `--lr-focus-ring-*`).

Three properties style the pressed view toggle: `--lr-widget-view-toggle-active-bg` (default
`var(--lr-color-brand-quiet)`) and `--lr-widget-view-toggle-active-color` (default
`var(--lr-color-brand)`), plus `--lr-widget-view-toggle-active-border-color` (default
`transparent`) — the background, text, and border color of the `aria-pressed="true"` toggle. All three
are **state hooks**: declared as inline `var()` fallbacks at the point of use and never on `:host`,
so setting any of them on the element _or on any ancestor_ reaches the toggle. That shape exists because
`::part(view-toggle)[aria-pressed='true']` is not valid CSS — Shadow Parts forbids an attribute
selector after `::part()` — so before these hooks the only way to recolor an active toggle was to
override the library-wide `--lr-color-brand-quiet`/`--lr-color-brand` tokens, repainting every other
element that reads them. Left unset, each falls back to exactly the token the rule used before, so
rendering is unchanged.

`--lr-widget-view-toggle-hover-bg` (default `var(--lr-color-brand-quiet)`) and
`--lr-widget-view-toggle-hover-color` (default `var(--lr-color-text)`) are the same shape for the
_hover_ state, and the `:hover` rule wraps its selector in `:where()` so a consumer's own
`::part(view-toggle):hover` override wins without `!important`.

**Optional peer deps:** none.

```html
<lr-widget label="Load profile" sublabel="Last 7 days" collapsible expandable>
  <span slot="actions"><button>Refresh</button></span>
  <div>Panel body content — a chart, a table, anything.</div>
</lr-widget>
```

While `fullscreen`, `[part="base"]` (not the host itself) takes `role="dialog"` + `aria-modal="true"`
(with `aria-label`, including an explicitly empty value, taking precedence; otherwise the `label`
property, slotted label, then `"Fullscreen panel"` supply the name), document scroll is locked
(ref-counted, safe with multiple simultaneously-fullscreen widgets), and Tab/Shift+Tab are bounded
to the panel's own focusable content (`actions` slot → collapse/fullscreen buttons → body slot,
matching visual tab order — resolved shadow-piercingly, so a slotted custom element's real
focusable target inside its own shadow root is found too) so keyboard focus can't escape to page
content hidden behind the backdrop. Escape or clicking the backdrop exits fullscreen and returns
focus to whichever button triggered it. Set `fullscreen-inset` (e.g. `"0 0 0 240px"`) to reserve
panel space for a persistent sidebar/toolbar while the default backdrop still covers the complete
viewport. Set `backdrop-inset` explicitly only when the scrim should leave the same frame open. Set
`compact` for tighter header/body padding.

The collapse-button `aria-label` is localized via its own `widgetCollapse` (default `'Collapse
panel'`) and `widgetExpand` (default `'Expand panel'`) keys.

**Known gotchas:**

- a reconnect that preserves the same element instance (e.g. a drag-and-drop reparent) resumes its
  shared overlay registration and re-acquires the scroll lock if `fullscreen` was still `true`
  across the move — `disconnectedCallback`/`connectedCallback` fire back-to-back with no update in
  between, so `willUpdate()` alone wouldn't otherwise notice.
- `collapsed` hides the body via `hidden` rather than an animated height transition — collapsing is
  instant, not a slide.
- prior to this release the collapse-button `aria-label` was localized through `lr-dock-panel`'s
  own `dockPanelCollapse`/`dockPanelExpand` keys (a borrowed, differently-named pair). A locale
  registered against those keys specifically to target `lr-widget`'s collapse button should move
  to `widgetCollapse`/`widgetExpand`; the default English strings are unchanged, and `lr-dock-panel`
  itself is unaffected.

**Additional API surface:**

- `part="view-icon"` — Decorative icon content inside a view toggle.
- `part="view-label"` — Visible label text inside a view toggle.

---

## `lr-carousel`

Accessible scroll-snap carousel for arbitrary slotted slide elements. Mirrors `wa-carousel` /
`sl-carousel`, including their opt-in navigation and pagination, multi-slide pages, logical
orientation, autoplay, loop, mouse dragging, slots, methods, parts, and custom properties. Slide
semantics (`role="group"`, a localized "slide" role description, and a localized "Slide N of M"
label) are added only to `<lr-carousel-item>` children. An arbitrary slotted element keeps its own
native or authored semantics, and an explicit `role`, `aria-roledescription`, or `aria-label` on an
`<lr-carousel-item>` wins over generated metadata. Later author changes to those attributes and to
`hidden`, `inert`, or `aria-hidden` remain in effect across carousel updates. The carousel
temporarily makes off-page slides inert and aria-hidden, then restores their retained author state
when they become visible, are removed, or the carousel disconnects.

**Properties:**

- `currentSlide: number = 0` (attribute `current-slide`, reflected) — zero-based index of the first
  slide in the active page. The pinned Web Awesome markup spelling `currentSlide` is also accepted
  through HTML's normalized
  `currentslide` attribute as a permanent compatibility alias. When both spellings are present on
  initial markup, canonical `current-slide` wins.
- `loop: boolean = false` (attribute `loop`, reflected) — wraps navigation at either end
- `autoplay: boolean = false` (attribute `autoplay`, reflected) and
  `autoplayInterval: number = 3000` (attribute `autoplay-interval`) — optional timed advance.
  Autoplay pauses while the page is hidden or the user is hovering, focusing, or dragging the
  carousel, and remains off under `prefers-reduced-motion: reduce`.
- `navigation: boolean = false` (attribute `navigation`, reflected) — renders previous and next
  buttons
- `pagination: boolean = false` (attribute `pagination`, reflected) — renders page indicators.
- `slidesPerPage: number = 1` (attribute `slides-per-page`) — number of simultaneously operable
  slides. Values used for layout are finite integers clamped to at least one and at most the live
  slide count.
- `slidesPerMove: number = 1` (attribute `slides-per-move`) — number advanced by `next()` and
  `previous()`, clamped to `slidesPerPage`. A final partial movement lands on the last full page.
- `orientation: 'horizontal'|'vertical' = 'horizontal'` — inline-axis or block-axis layout and
  scrolling. Give a vertical carousel a definite block size.
- `mouseDragging: boolean = false` (attribute `mouse-dragging`, reflected) — adds desktop
  click-and-drag scrolling without replacing native touch and trackpad scrolling. Pointer
  cancellation releases capture, removes drag state, and returns to the active snap position.
  Gestures begin only for a primary left-mouse pointer on noninteractive slide content; native,
  custom, shadow-wrapped, labelled, disabled, and editable controls retain their own pointer input.
- `slides: number` (read-only) — live assigned-slide count, updated after dynamic child changes.
- `accessibleLabel: string = ''` (attribute `accessible-label`) — fallback landmark name; a host
  `aria-label` takes precedence by presence, including an explicitly empty value

**9.0 cleanup:** the redundant Lyra-only `index`, `showIndicators`, and `goTo()` aliases were
removed. Use mapped `currentSlide`, `pagination`, and `goToSlide()`. The writable/reflected
`slides` readout also became a readonly composition-derived property. Navigation and pagination
retain their mapped opt-in defaults, and the autoplay interval remains 3000ms.

**Methods:**

- `next(behavior: ScrollBehavior = 'smooth')` and
  `previous(behavior: ScrollBehavior = 'smooth')` move by `slidesPerMove`
- `goToSlide(index, behavior: ScrollBehavior = 'smooth')` moves to a specific slide
- `addSlide(slide: LyraCarouselItem)` appends a slide and `removeSlide(index)` removes one; page
  count, active range, inertness, eligible loop snapshots, and pagination reconcile
  automatically

**Events:** `lr-slide-change` (`detail: { index, slide }`) — emitted after the active slide changes
from a method, button, key, pagination item, autoplay tick, or settled user scroll. `slide` is the
original assigned element at `index`, never a loop endcap.

**Paging and scrolling.** In non-loop mode the page count is the set of reachable starts from zero
to `slideCount - slidesPerPage`, stepping by `slidesPerMove` and always including the final start.
Loop pagination exposes every slide as an exact valid start, so the current loop start always has
one and only one current indicator. Multi-slide basis conserves the allocation as
`(100% - (slidesPerPage - 1) * gap) / slidesPerPage`, including final partial pages. All
slides in the active page are restored to their authored `inert`/`aria-hidden` state; every other
slide keeps its layout box but becomes `inert` and `aria-hidden="true"`, so visible multi-slide
pages remain fully operable while off-page links are unreachable. Native mandatory scroll snap
owns touch, trackpad, momentum, and rubber-band behavior. Settling adopts the nearest page once and
emits one event for the whole gesture. Programmatic movement scrolls the same track; first mount
and reduced-motion alignment are instant. Loop mode adds inert, accessibility-hidden snapshots only
for side-effect-free plain HTML, so forward/backward wrapping can continue in the requested
direction before silently resetting to the matching original slide. Those snapshots refresh after
light-DOM content or attribute changes, and their idrefs/form-identifying attributes are removed. A
slide containing a custom element, media/resource owner, form state, script/style, or non-HTML
descendant is never cloned; wrapping falls back to the original slide instead, avoiding duplicate
lifecycle, network/playback, and state owners even when the physical wrap cannot use an endcap in
the requested direction.

Manual active-page changes after mount are appended to Lyra's shared light-DOM polite
announcement sink. The focusable `scroll-container` is not itself a shadow-root live
region. Initial connection and reconnection stay silent. Timer-driven autoplay advances also stay
silent, while click, keyboard, method, scroll-gesture, and property changes are announced even
when `autoplay` remains enabled. A change made while the carousel or a composed ancestor is
`hidden`, `inert`, `aria-hidden`, or CSS-hidden stays silent. Slide announcement text likewise
omits accessibility-hidden descendants. A subtree-pruned active slide root suppresses the entire
page announcement rather than synthesizing a position for content outside the tree; a
`visibility:hidden|collapse` root can still contribute a descendant that explicitly restores
`visibility:visible`, in which case the position and that exposed descendant are announced.
Nested forwarding slots contribute their flattened assigned content. Slot fallback text contributes
only when there is no direct assignment; an accessibility-hidden assignment remains authoritative
and does not expose the fallback. The `carouselSlideAnnouncement` message (English default:
`{position}: {content}`) controls the order and punctuation of each position/content pair, and
`carouselSlideAnnouncementSeparator` (English default: `. `) separates multiple visible-slide
summaries. A registered locale or the instance's `strings` override can customize both.

Horizontal Left/Right keys follow logical direction and swap under RTL; vertical carousels use
Up/Down without an RTL inversion. Home and End move to the first and final reachable start. The
populated multi-slide state remains accessible at a 320px allocation.
If a controlled page/page-size change or slide removal would make the currently focused slide
inert or disconnected, focus moves to the stable `scroll-container` before exclusion. A
newer external focus destination is never reclaimed.

**Slots:** default slides, `previous-icon`, and `next-icon`. Named icon slots replace only the
decorative glyph content; their flattened subtrees remain visible but are inert and aria-hidden.
Lyra retains the localized native-button names, actions, and minimum hit areas.

**CSS parts:** `base carousel` (same region node), `scroll-container` (focusable scroll port),
`navigation`, `navigation-button`, `navigation-button-previous` /
`navigation-button-next`, Shoelace aliases `navigation-button--previous` /
`navigation-button--next`, plus `previous-glyph` / `next-glyph`; `pagination`, `pagination-item`,
active aliases `pagination-item-active` / `pagination-item--active`, and `indicator-dot`. `track` and
`controls` are Lyra extensions.

**Themeable custom properties:** mapped `--aspect-ratio` (default `16/9`), `--scroll-hint`
(logical scroll-area padding), and `--slide-gap` (default `var(--lr-space-m)`). Lyra extensions
`--lr-carousel-indicator-current-bg` (default `var(--lr-color-brand-quiet)`) and
`--lr-carousel-indicator-current-border-color` (default `var(--lr-color-brand)`) color only the
active `indicator-dot`. `--lr-carousel-slide-basis` remains a compatibility escape hatch that
overrides the basis computed from `slidesPerPage`; prefer the property for normal multi-slide
layouts because it also updates paging and accessibility state.
Navigation buttons use independent `--lr-carousel-navigation-hover-bg`,
`--lr-carousel-navigation-hover-border-color`, `--lr-carousel-navigation-active-bg`, and
`--lr-carousel-navigation-active-border-color` hooks. Pagination dots use the corresponding
`--lr-carousel-pagination-hover-bg`, `--lr-carousel-pagination-hover-border-color`,
`--lr-carousel-pagination-active-bg`, and `--lr-carousel-pagination-active-border-color` hooks.
All are inline fallbacks at their state rules, inherit from ancestors, and retain the previous
brand/active-mix rendering when unset.

```html
<lr-carousel navigation pagination aria-label="Screenshots">
  <lr-carousel-item
    ><img alt="Dashboard overview" src="overview.png"
  /></lr-carousel-item>
  <lr-carousel-item
    ><img alt="Dashboard details" src="details.png"
  /></lr-carousel-item>
</lr-carousel>
```

```html
<lr-carousel
  navigation
  pagination
  mouse-dragging
  slides-per-page="3"
  slides-per-move="2"
  aria-label="Projects"
>
  <lr-card>Solar</lr-card>
  <lr-card>Wind</lr-card>
  <lr-card>Battery</lr-card>
  <lr-card>Hydro</lr-card>
</lr-carousel>
```

---

## `lr-carousel-item`

Optional semantic wrapper for one slide in `<lr-carousel>`. Mirrors `wa-carousel-item` /
`sl-carousel-item`. The carousel also accepts arbitrary slotted elements, so this element is useful
when a migration needs the explicit item tag — and it is the one slide shape whose contract lets the
carousel generate group semantics and a localized "Slide N of M" name for it (see `<lr-carousel>`
above). An explicit `role`, `aria-roledescription` or `aria-label` you set yourself always wins,
including a value added, changed, or removed after connection. The carousel temporarily controls
`inert` and `aria-hidden` while an item is off page, then restores your retained values when it is
visible, removed, or disconnected.

**Slots:** default slide content.

**CSS parts:** `base`.

**Themeable custom properties:** `--aspect-ratio` — inherited from the owning carousel unless set
on the item itself.

```html
<lr-carousel>
  <lr-carousel-item>Dashboard overview</lr-carousel-item>
  <lr-carousel-item>Dashboard details</lr-carousel-item>
</lr-carousel>
```

---

## `lr-button-group`

Responsive semantic grouping primitive for related action controls. It preserves the slotted
controls and exposes `role="group"` on its internal wrapper.

**Properties:**

- `orientation: LyraOrientation = 'horizontal'` (reflected; the shared
  `'horizontal' | 'vertical'` layout axis, with no component-local alias)
- `label: string = ''` — accessible group-name fallback; a host `aria-label`, when present, wins
  including an explicitly empty value

**Slots:** default action controls.

**CSS parts:** `base` (the `role="group"` flex wrapper; wraps, and goes full-width below a 20rem
container inline-size).

**Themeable custom properties:** `--lr-button-group-gap` (default `var(--lr-space-2xs)`) — gap
between slotted controls on both axes.

**Sizing gotcha — give it an explicit width.** `:host` is `display: inline-flex` _and_ declares
`container-type: inline-size` unconditionally (that is what makes the 20rem `@container` rule above
fire at all). Inline-size containment means the box's own content can no longer contribute to its
width, so in any context where the host would otherwise be shrink-to-fit — plain block flow, an
`inline-flex`/`flex` parent, anywhere with no definite width — the group uses its
`contain-intrinsic-inline-size` fallback of `var(--lr-size-12rem)` instead of growing to fit the
slotted buttons. Give `<lr-button-group>` a definite width (`inline-size`, `width: 100%`, `flex: 1`,
or a grid track) whenever it isn't already in a layout that supplies one. Under tighter allocation,
`min-inline-size: var(--lr-icon-button-size)` remains the hard 2.5rem lower bound rather than the
unallocated fallback.

---

## `lr-scroller`

Responsive overflow surface with optional previous/next controls. The default slot remains the
consumer's content, and the viewport is a native scroll container that works in narrow panels as
well as full-width layouts.

**Properties:**

- `orientation: 'horizontal' | 'vertical' = 'horizontal'` (reflected)
- `controls: boolean = false` (reflected) — show previous/next controls
- `withoutScrollbar: boolean = false` (attribute `without-scrollbar`, reflected) — hides the
  native scrollbar while preserving scrolling
- `withoutShadow: boolean = false` (attribute `without-shadow`, reflected) — suppresses both
  logical edge cues without changing native scrolling or the optional controls
- `scrollStep: number = 0` (attribute `scroll-step`) — custom step; zero uses 80% of the viewport
- `label: string = ''` — accessible region name; a host `aria-label` is used when set

**Events:** `lr-scroll` with `scrollStart`, `scrollEnd`, `scrollLeft`, and `scrollTop` in the
detail object. Scroll-driven emissions are coalesced through one `requestAnimationFrame` tick, so a
fling that fires dozens of native `scroll` events produces at most one `lr-scroll` per frame — the
same contract `lr-virtual-list`'s identically-named event carries, so the two are interchangeable
for scroll-linked layout work.

**Slots:** default scrollable content.

**CSS parts:** `base`, `viewport`, `content`, `start-shadow`, `end-shadow`, `previous`, `next`,
`control` (shared by `previous` and `next`), and `previous-glyph`/`next-glyph` (the chevron inside
each, mirrored under RTL). Each shadow is hidden at its corresponding measured edge and uses
logical positioning, so both cues and gradients mirror under RTL and rotate to the block axis in a
vertical scroller. Before the first client measurement, both cues are hidden and both optional
controls are disabled, so server-rendered markup never advertises a false scroll direction.

**Themeable custom properties:** `--lr-scroller-control-size` (default `var(--lr-size-2rem)`) — the
previous/next control's box size; the interactive target never shrinks below `--lr-icon-button-size`
regardless. `--lr-scroller-min-block-size` (default `var(--lr-size-10rem)`) — the vertical
orientation's minimum block size, ignored while horizontal. `--shadow-color` (default
`var(--lr-color-surface)`) and `--shadow-size` (default `var(--lr-size-2rem)`) theme each edge cue's
base color and logical extent; `--lr-scroller-shadow-color` and `--lr-scroller-shadow-size` are
Lyra-prefixed aliases for the same two (mirroring `lr-split-panel`'s alias pattern for its own
upstream-named props), and win when both spellings are set.

```html
<lr-scroller controls label="Project cards">
  <lr-card>Solar</lr-card>
  <lr-card>Wind</lr-card>
  <lr-card>Battery</lr-card>
</lr-scroller>
```

---

## `lr-tab-group`

A tab strip. Mirrors `wa-tab-group` / `sl-tab-group`.

**Renamed in 8.0.0.** This element used to be `<lr-tabs>`. The tag is now `<lr-tab-group>`, its
single `lr-tabs-change` event is now the `lr-tab-hide` → `lr-tab-show` pair below, and every
`--lr-tabs-*` custom property is now spelled `--lr-tab-group-*` (`--lr-tabs-selected-color` →
`--lr-tab-group-selected-color`, and so on). Neither old spelling survives as an alias, and all
three fail silently: `<lr-tabs>` is an unknown element that renders its children unstyled,
`lr-tabs-change` never fires, and a `--lr-tabs-*` declaration is inert. Rename all three in the same
change. The rename is what lets `<lr-tab>` and `<lr-tab-panel>` (below) exist as a family, which is
what makes migrating from either upstream a pure tag rename.

**Canonical child model:** direct `<lr-tab panel="x">` + `<lr-tab-panel name="x">` pairs. This is
the single shape shared with both upstreams, so markup renames mechanically. The pre-9.0
`<div slot="x" label="…">` data/attribute model is removed; migrate each former child into one
descriptor and one matching panel. An unpaired panel never creates a tab.

The group assigns private projection `slot` values itself; consumers do not need to write them.
Those writes are temporary ownership, not destructive normalization: when a descriptor or panel is
removed, moved to another group, disconnected/reconnected, or adopted into another document, the
group restores that element's latest author-owned `slot` value. An author write made while the group
owns the projection is remembered and then reprojected until release.

Each `<lr-tab>`'s content is projected into the real `role="tab"` button, so a tab can carry an icon
or badge while the button's accessible name stays exactly its accessibility-exposed flattened text.
Direct default-slot element roots in that visual label become inert while projected and regain
their latest author-owned inert state when released; use text/glyph markup, not an independent
action. Author `aria-hidden`, hidden, inert, and CSS-hidden branches are excluded from the name, and
direct-label text or visibility changes refresh it. `active` on a tab/panel pair is an SSR hint: the
group reads an initially active tab and then keeps both child attributes synchronized with its own
selection after hydration.

Implements the WAI-ARIA APG tabs pattern. With the default `activation="auto"`, Left/Right (swapped
under RTL, or Up/Down when `placement` is `start`/`end`) move focus _and_ selection together; with
`activation="manual"` they move focus only and Enter/Space commits. Home/End jump to the first/last
enabled tab, and a roving `tabindex` follows the focused tab.
Keyboard handling starts from the real event-target tab (then actual shadow focus), so a controlled
`active` write cannot make Arrow/Delete/Enter operate on a different remembered tab.
An enabled `closable` `<lr-tab>` also puts `aria-keyshortcuts="Delete"` on its real tab button.
Delete emits that descriptor's `lr-close` request without creating a second tab stop or changing
selection.

**Properties:**

- `active: string = ''` (reflected) — the active tab's panel name; falls back to the first enabled
  tab whenever the current value doesn't resolve to one (including on every children/attribute
  change, tracked via a `MutationObserver`)
- `accessibleLabel: string | null = null` (attribute `aria-label`) — accessible name applied to the
  `role="tablist"` strip; attribute-reflects from a host-level `aria-label`. `null` omits the
  attribute; an explicitly empty value is preserved (there is no localized default name).
- `placement: 'top' | 'bottom' | 'start' | 'end' = 'top'` (attribute `placement`, reflected) — which
  edge the strip sits on. `start`/`end` are _logical_, so they mirror under RTL with no `:dir()`
  rule of your own; either turns the tablist vertical, which sets `aria-orientation="vertical"` and
  switches the navigation keys to Up/Down per the APG.
- `activation: 'auto' | 'manual' = 'auto'` (reflected) — `auto` moves selection with focus; `manual`
  moves focus only and waits for Enter or Space. Use `manual` whenever revealing a panel is
  expensive: automatic activation would reveal every panel the user arrows past. Under `manual` the
  roving `tabindex="0"` sits on the _focused_ tab, which may differ from the selected one.
- `withoutScrollControls: boolean = false` (reflected, attribute `without-scroll-controls`) and
  `noScrollControls: boolean = false` (reflected, attribute `no-scroll-controls`) — the same opt-out
  under Web Awesome's spelling and Shoelace's. Both are read, either one suppresses the overflow
  scroll controls described below, and neither is deprecated: a consumer arriving from either
  upstream finds their own attribute working. Left unset, an overflowing horizontal strip gets the
  controls.
- `fixedScrollControls: boolean = false` (reflected, attribute `fixed-scroll-controls`) —
  keeps both controls laid out across an overflowing range. Without it, the start control is hidden
  at the logical start and the end control is hidden at the logical end; an exhausted control is a
  no-op in either mode. The flag never makes controls appear on a row that fits, which remains gated
  on real overflow.
- `defaultSlot: HTMLSlotElement` (property only) — the real unnamed shadow slot expected by mapped
  integrations. Lyra exposes it for slot observation but keeps it hidden because every accepted
  tab and panel is projected through a deterministic named slot.

**Methods:** `show(name: string): void` activates the matching enabled tab through the same
`lr-tab-hide` then `lr-tab-show` sequence as pointer/keyboard selection. Unknown, disabled, and
already-active names are no-ops.

**Overflow and scrolling.** The tablist is a native scroll container (`overflow-x: auto`). A
horizontal row that does not fit additionally gets two pointer scroll controls flanking it inside
`[part="nav"]`. Logical edge state drives both controls and the mask: at the initial edge only the
inline-end fade/control appears, in the middle both appear, and at the final edge only inline-start
appears. Native scroll plus a `ResizeObserver` on the strip and its rendered tabs refresh that state,
so intrinsic label/font geometry changes cannot leave stale controls. The same contract works under
RTL, and forced-colors mode removes the alpha mask entirely instead of obscuring text. A row that
fits gets neither affordance.

Controls are rendered only for horizontal placement. A `start`/`end` strip scrolls natively in the
block direction, and in a fixed block allocation the vertical nav, tablist, and panel body stay
within the group: the tablist and body become their own scroll containers rather than expanding the
host. One horizontal control press travels 80% of the visible row smoothly, or instantly under
`prefers-reduced-motion`; under RTL the physical delta mirrors.

The controls are `aria-hidden="true"` and `tabindex="-1"`: a pointer affordance only, matching
upstream. The strip is already fully keyboard-scrollable without them — the roving `tabindex` puts
every tab one arrow key away and focusing a tab scrolls it into view — so two extra tab stops in the
middle of the strip would buy no capability. They still carry a localized `aria-label`, so the name
is there for automation and for a consumer that chooses to expose them. Pressing one does not move
focus off the tab the user was on.

**Events:**

- `lr-tab-show` (`detail: { name: string }`) — a tab became active via click, keyboard, or `show()`.
  Not fired
  when `active` self-corrects to a valid tab (initial default, or a tab disappearing/becoming
  disabled underneath the current selection).
- `lr-tab-hide` (`detail: { name: string }`) — the outgoing tab, emitted immediately _before_ the
  matching `lr-tab-show`, so a listener that tears down the old panel always runs before the one
  that builds the new one. Not fired when there was no previous selection.

**Slots:** default — canonical `<lr-tab>`/`<lr-tab-panel>` pairs. `nav` is the upstream-compatible
projection slot a standalone `<lr-tab>` uses before a hydrated group assigns its private slot.

```html
<!-- element model: renames straight across from wa-/sl- -->
<lr-tab-group placement="start" activation="manual">
  <lr-tab panel="general">General</lr-tab>
  <lr-tab panel="danger" disabled>Danger zone</lr-tab>
  <lr-tab-panel name="general">General settings</lr-tab-panel>
  <lr-tab-panel name="danger">Danger zone</lr-tab-panel>
</lr-tab-group>
```

**CSS parts:** `base` and `tab-group` are aliases on the same root wrapper around the tablist and
panels; `nav` (the row wrapping the
tablist together with the two overflow scroll controls; mirrors the upstream part of the same name),
`tablist` and `tabs` (aliases on the `role="tablist"` row of tab buttons and scroll container),
`body` (wrapper around all panels), `scroll-button` and `scroll-button__base` (aliases shared by
both overflow controls), `scroll-button-start`/`scroll-button--start` and
`scroll-button-end`/`scroll-button--end` (aliases on the individual
controls that scroll the tabs toward their inline start and end — under RTL "start" is the
right-hand one), `scroll-button-glyph` (the chevron wrapper inside a control; this wrapper is what
mirrors under RTL, never the icon), `tab` (a single tab button), `active-tab-indicator` (the selected
tab's directional indicator), and `panel`
(a single `role="tabpanel"` wrapper, one per tab, hidden unless active).
The two controls exist in the DOM whenever the group can have them at all (horizontal `placement`,
no opt-out). Non-overflow and inactive-edge qualifiers are wrapped in `:where()`, so a consumer's
own `::part(scroll-button)` rule can override presentation without `!important`.

**Themeable custom properties:** `--lr-scroll-fade-size` (default `2rem`) — width of the mask fade
at each inline scroll edge of the tablist, painted only while the tablist actually overflows and
only for a horizontal `placement`. `--lr-tab-group-selected-color` (default
`var(--lr-color-brand)`) — text color of the selected tab, scoped to `[aria-selected='true']` only,
so it never repaints a hovered unselected tab. `--lr-tab-group-indicator-color` (default
`var(--lr-color-brand)`) — the selected tab's indicator rule, themeable independently of its text
color (an underline on a `top`/`bottom` strip, an inline edge on a vertical one).
`--lr-tab-group-hover-color` (default `var(--lr-color-text)`) — text color of a hovered, non-disabled
tab, independent of the two selected-state hooks. All three are declared as inline `var()` fallbacks
at the point of use rather than on `:host`, so each can be set on the element _or on any ancestor_ —
the pattern exists because `::part(tab)[aria-selected='true']` is invalid CSS (Shadow Parts forbids
an attribute selector after `::part()`), which previously left overriding the library-wide
`--lr-color-brand`/`--lr-color-text` tokens as the only way to restyle a selected or hovered tab,
repainting everything else that reads them. Unset, each falls back to the token its rule used
before, so rendering is unchanged. The upstream hooks `--indicator-color` (selected indicator),
`--track-color` (resting strip rule), and `--track-width` (resting strip-rule thickness) are read
first, with the Lyra/token values as fallbacks. `--lr-tab-group-vertical-nav-max-inline-size`
(default `var(--lr-size-12rem)`) caps a `start`/`end` nav's logical inline size while still allowing
it to shrink in a constrained allocation. Its inline fallback means it can be set on the group or
an ancestor; long single-line tab labels ellipsize within the cap rather than expanding the group or
starving the panel.

`--lr-tab-group-active-bg` (default `color-mix(in oklab, transparent,
var(--lr-color-mix-partner) var(--lr-color-mix-active))`) and
`--lr-tab-group-active-color` (default
`var(--lr-tab-group-hover-color, var(--lr-color-text))`) style a pressed, non-disabled tab.
The overflowing row's controls have their own hooks:
`--lr-tab-group-scroll-button-hover-color` (default `var(--lr-color-text)`),
`--lr-tab-group-scroll-button-active-bg` (default `color-mix(in oklab, transparent,
var(--lr-color-mix-partner) var(--lr-color-mix-active))`), and
`--lr-tab-group-scroll-button-active-color` (default `var(--lr-color-text)`). Each is an
inline fallback, so a wrapper can retheme the interaction state without affecting ordinary tabs,
selection, or the other control state.

Otherwise shared tokens — `--lr-space-xs/-s/-m`,
`--lr-color-border/-text-quiet/-text/-brand`, `--lr-transition-fast`, `--lr-radius`,
`--lr-focus-ring-width/-color/-offset`, `--lr-opacity-disabled`.

**Optional peer deps:** none.

```html
<lr-tab-group active="general">
  <lr-tab panel="general">General</lr-tab>
  <lr-tab panel="advanced" disabled>Advanced</lr-tab>
  <lr-tab-panel name="general">General settings…</lr-tab-panel>
  <lr-tab-panel name="advanced">Advanced settings…</lr-tab-panel>
</lr-tab-group>
<script type="module">
  const group = document.querySelector("lr-tab-group");
  group.addEventListener("lr-tab-show", (e) => console.log(e.detail.name));
  group.show("general");
</script>
```

**Known gotchas:**

- **`inert` on a child excludes its tab from arrow-key navigation, exactly as `disabled` does.** An
  inert element refuses focus outright, so a roving `tabindex` that stepped onto one would leave
  `focus()` a silent no-op and strand the arrow key with focus back on `<body>`. The tab button
  rendered for an inert source child is itself marked `inert`, so the two can never disagree,
  Home/End skip it, and `active` is never resolved to it. Only the child's **own** `inert` counts,
  never an ancestor's: a tab group inside a subtree an open modal has inerted is inert as a whole,
  and treating every tab as unreachable there would reset `active` to `''` and blank every panel for
  as long as the dialog is open.
- Tabs are rebuilt from direct children via a `MutationObserver` — not `slotchange` — because a
  brand-new tab's `slot` name has no matching `<slot>` to fire `slotchange` on until this component
  has already rendered one for it, and neither `slotchange` nor any Lit lifecycle hook observes a
  plain attribute edit on a light-DOM child at all. Text/content and relevant
  accessibility/visibility mutations below a direct `<lr-tab>` refresh that button's flattened
  name; arbitrary nested mutations inside panels remain ignored.
- If two `<lr-tab>` descriptors share the same panel name, the first wins. A second matching panel
  is likewise ignored for projection, keeping selection, focus, events, and ARIA idrefs unambiguous.
- The navigation keys follow `placement`, not the writing mode: a `top`/`bottom` strip uses
  Left/Right (swapped under RTL via `internal/rtl.ts`'s `isRtl()`), and a `start`/`end` strip uses
  Up/Down with no RTL swap, because block flow does not reverse. Only one pair is live at a time —
  there is no set of keys that works for both placements.
- The two overflow controls are `aria-hidden`, so an automated check that looks for a _focusable_
  "scroll tabs" button will not find one. Assert on `[part~="scroll-button"]` (and on the tablist's
  `scrollLeft` moving) instead.

---

## `lr-stepper`

Ordered multi-step wizard/form navigation: an index/label per step, independent
`pending`/`current`/`completed`/`error` progress plus disabled availability, and click-to-jump.
First-party invention (no `wa-*`/`sl-*` counterpart). Fully
data-driven and controlled, like `lr-table`'s `columns`/`rows` — it never mutates `steps` itself; a
click, or Enter/Space on a non-disabled step, fires a non-cancelable `lr-step-select`, and the host
decides whether/how `steps` changes in response.

**Properties:**

- `steps: readonly LyraStepItem[] = []` (attribute: false) — `LyraStepItem { stepId: string; label:
string; state: LyraStepState; disabled?: boolean; title?: string; icon?: unknown }`, where
  `LyraStepState` is `'pending' | 'current' | 'completed' | 'error'`. `disabled` independently gates
  activation and roving focus, so locking a current/completed/error step does not erase its progress.
  `title` is an optional native tooltip for the step's button (e.g. explaining why a `disabled` step
  is locked) — omit it for no `title` attribute at all, not an empty string. `icon` is an optional
  leading topic glyph (a `TemplateResult`, an emoji string, etc. — not restricted to a square icon)
  rendered as inert, `aria-hidden` decoration in the `step-icon` part, additionally to — never
  instead of — the state-driven `step-index`/`step-check` glyph. It provides no independent action
  or accessible name. Input is read through a realm-neutral bounded schema snapshot (at most 256
  positions); malformed/hostile entries are skipped while valid neighbors survive, and the frozen
  returned array/records never alias caller-owned objects. Duplicate step IDs are supported as
  ordered occurrences because selection detail always includes `index`; keyed rendering and focus
  restoration correlate `{ stepId, index }` so a refresh retains the focused duplicate occurrence.
  Empty (the default) renders nothing.
- `orientation: 'horizontal' | 'vertical' = 'horizontal'` (reflected) — `'horizontal'` (the default)
  lays steps out in a row (Left/Right, RTL-aware, navigate); `'vertical'` stacks them (Up/Down
  navigate instead, no RTL swap needed). The axis used at/above `orientationBreakpoint` (or always,
  when that's unset).
- `orientationBreakpoint?: number | string` (attribute `orientation-breakpoint`) — opt-in inline-size
  breakpoint measured on `[part='base']`; unset (the default) means no behavior change at all, and
  no `ResizeObserver` is armed. Below it, `narrowOrientation` becomes the effective axis instead of
  `orientation`. Accepts a bare pixel number (`900`, `orientation-breakpoint="900"`) or a CSS length
  string: `'900px'`, `'56.25rem'`, `'3em'`. Under the default `orientationBreakpointBasis='container'`,
  `rem` resolves against the document root's **computed** font size (the rule a `@container` query
  follows) and `em` against this element's own computed font size. The length is **re-resolved on
  every measurement**, never cached at first render, so a root font-size change moves the crossing
  width with no invalidation step on the consumer's side. Anything that isn't a resolvable length
  behaves exactly as unset (no observation, no `data-effective-orientation`): `''`, `'auto'`,
  garbage, a non-finite number, and deliberately `%`, `vw`/`vh` and `calc()` — a viewport-relative
  threshold would mix reference boxes against a measurement of the element's own allocation. Mirrors
  `<lr-multi-split>`'s identically-named contract, unit handling included.
- `orientationBreakpointBasis: 'container'|'viewport' = 'container'` (reflected, attribute
  `orientation-breakpoint-basis`) — which box `orientationBreakpoint` is compared against. Unset,
  behavior is identical to before this property existed. `'container'` measures the stepper's own
  `[part='base']` via `ResizeObserver`, comparing strictly `<`; `'viewport'` evaluates
  `matchMedia('(max-width: <breakpoint>)')`, arms no `ResizeObserver`, and compares inclusively
  (`<=`) per native `max-width` semantics. **A stepper given a fixed width in a row layout cannot
  react to that row stacking by measuring itself — its own width never changes — so that case
  requires `'viewport'`.** Relative units also differ by basis: inside a media query they resolve
  against the browser's _initial_ font size, ignoring `html { font-size }`, which is precisely why
  `'viewport'` matches a CSS `@media` rule authored with the same length. Mirrors `<lr-multi-split>`'s
  identically-named contract.
- `narrowOrientation: 'horizontal' | 'vertical' = 'vertical'` (reflected, attribute
  `narrow-orientation`)
- `wrapLabels: boolean = false` (reflected, attribute `wrap-labels`) — when true, allows long
  labels to wrap when the effective orientation is vertical. The default preserves single-line
  labels, and horizontal labels remain single-line even when this is enabled. Set this when a
  narrow or localized vertical stepper would otherwise clip labels or overflow its allocation.
- `effectiveOrientation: 'horizontal' | 'vertical'` (readonly getter) — the live layout/navigation
  axis actually in effect; identical to `orientation` whenever `orientationBreakpoint` is unset or
  doesn't resolve to a length. Also reflected as `data-effective-orientation` (only present while
  `orientationBreakpoint` resolves to a usable length).
- `accessibleLabel: string | null = null` (attribute `aria-label`) — accessible name applied to the
  `role="list"` step strip; attribute-reflects from a host-level `aria-label`. Unset, the list
  renders without an `aria-label` (there is no localized default name); an explicitly empty
  attribute remains empty rather than being treated as absent.

**Events:** `lr-step-select` (`detail: { stepId, index }`) — fired on click, or Enter/Space while
focused, on a non-`disabled` step. It is non-cancelable because the component takes no default
action to veto: it never mutates `steps`. `lr-stepper-orientation-change`
(`detail: { orientation }`) — fired only when an enabled `orientationBreakpoint` actually changes
`effectiveOrientation`.

**Slots:** none.

**CSS parts:** `base` (root wrapper, `role="list"`), `step-item` (the `role="listitem"` wrapper for
one step), `step` (a single native button; the current step carries `aria-current="step"` and every
other step carries `aria-current="false"`),
`step-icon` (optional inert, `aria-hidden` leading topic glyph from the step's `icon` field; only
rendered when the step has one, additionally to — never instead of — `step-index`/`step-check`),
`step-index` (the numbered index chip, shown for `pending`/`current`/`error` steps), `step-check`
(the completed-checkmark glyph, shown for `completed` steps instead of `step-index`), `step-label`
(the step's label text).

**Themeable custom properties:** `--lr-stepper-hover-bg` (default
`var(--lr-color-brand-quiet)`) and `--lr-stepper-hover-color` (default
`var(--lr-color-text)`) style a hovered non-disabled step. `--lr-stepper-active-bg` (default
`color-mix(in oklab, var(--lr-color-brand-quiet), var(--lr-color-mix-partner)
var(--lr-color-mix-active))`) and `--lr-stepper-active-color` (default `var(--lr-color-text)`)
style a pressed non-disabled step. `--lr-stepper-current-color` (default `var(--lr-color-text)`) —
text color of the `current` step. `--lr-stepper-current-font-weight` (default
`var(--lr-font-weight-semibold)`) — font weight of the `current` step's label.
`--lr-stepper-error-color` (default `var(--lr-color-danger)`) —
text color of an `error` step. `--lr-stepper-current-index-bg` (default `var(--lr-color-brand)`) and
`--lr-stepper-current-index-color` (default `var(--lr-color-on-brand)`) — background and text color
of the `current` step's numbered `step-index` chip. The text color reads the dedicated on-brand
foreground token, not `--lr-color-surface`, so the chip stays legible in dark mode and under forced
colors, where surface and on-brand diverge. Each is an inline `var()` fallback at the point
of use, never declared on `:host`, so it can be set on the element or on any ancestor; and each is
scoped to its own `data-state`, so recoloring the current step leaves `pending`/`completed`/`error`
steps alone. The hooks exist because `::part(step)[data-state='current']` is invalid CSS — Shadow
Parts forbids an attribute selector after `::part()` — so state-specific theming previously meant
overriding a library-wide `--lr-color-*` token and repainting everything else that read it. Unset,
each falls back to the token its rule used before.
`--lr-scroll-fade-size` (default `2rem`) controls the decorative horizontal overflow fade, which is
disabled under forced-colors while the native scroll owner remains available. Otherwise shared tokens —
`--lr-space-m`/`-xs`/`-2xs`,
`--lr-color-text-quiet`/`-text`/`-danger`/`-brand`/`-on-brand`, `--lr-radius`/`-pill`,
`--lr-font-size-xs`, `--lr-font-weight-semibold`, `--lr-opacity-disabled`,
`--lr-focus-ring-*`.

**Optional peer deps:** none.

```html
<lr-stepper></lr-stepper>
<script type="module">
  const stepper = document.querySelector("lr-stepper");
  stepper.steps = [
    { stepId: "account", label: "Account", state: "completed" },
    { stepId: "billing", label: "Billing", state: "current" },
    { stepId: "review", label: "Review", state: "pending" },
  ];
  stepper.addEventListener("lr-step-select", (e) =>
    console.log(e.detail.stepId, e.detail.index)
  );
</script>
```

**Known gotchas:**

- `orientationBreakpointBasis='container'` (the default) observes **the stepper's own allocated
  inline size**, so it fits a stepper that is the sole flex/grid item in its measured container. In
  a row where the stepper is a fixed-width sidebar beside another element, its own width never
  changes with the viewport at all, so no container breakpoint can react to that row stacking via a
  CSS `@media` rule. Use `orientationBreakpointBasis='viewport'` for that layout — give the stepper
  and its sibling the same `orientation-breakpoint` and both flip in lockstep with the CSS rule. See
  `<lr-multi-split>`'s own note above for the full explanation of why a shared row can't be inferred from
  one element's measurement, and for a worked example.
- there's no built-in "step forward/back" method — advancing the wizard is entirely the host's job:
  react to `lr-step-select` (or its own Next/Back buttons) and reassign `steps` with updated
  `state` values.
- The stepper exposes ordered progress/navigation semantics (`list`/`listitem` plus native step
  buttons), not tabs: it owns no tab panels. Roving tabindex and orientation-aware arrow-key
  navigation remain available independently of those semantics.
- Left/Right (horizontal) and Up/Down (vertical) are mutually exclusive per `orientation` — there's
  no single set of keys that works in both.

---

## `lr-tab`

One tab in a `<lr-tab-group>`'s strip. Mirrors `wa-tab` / `sl-tab`.

A **declarative descriptor, not the interactive control**: the group renders the real `role="tab"`
button and projects this element's content into it, so the whole ARIA and roving-tabindex contract
stays in one place. The host is `display: contents`, contributing no box of its own inside that
button. Direct default-slot element roots in the visual label are inert while projected, while their flattened
accessibility-exposed text explicitly names the real tab button; author-hidden, inert, and CSS-hidden
branches do not contribute. Use text/glyph markup rather than a second action.

**Properties:** `panel: string = ''` (reflected) — the `name` of the `<lr-tab-panel>` this tab
reveals; `disabled: boolean = false` (reflected) — removes the tab from keyboard navigation and
prevents activation; `active: boolean = false` (reflected) — SSR selection hint, synchronized by
the owning group after hydration; `closable: boolean = false` (reflected) — shows the mapped close
affordance.

**Events:** `lr-close` (no detail) — the Lyra-convention mapping of Shoelace's `sl-close`, emitted
when the close affordance is clicked or Delete is pressed on the focused owning tab. It bubbles, is
composed and noncancelable. A disabled tab never emits it. The tab never removes itself or its
panel; the consumer handles the request. The owning group separately emits
`lr-tab-show`/`lr-tab-hide`. **Slots:** default (the tab's visual label content; direct default-slot element roots
are inert while projected, and its accessibility-exposed flattened text names the real tab button).
**CSS parts:** `base`
and `tab` are aliases on the same projected-content slot; `close-button` and
`close-button__base` are aliases on the same non-focusable visual close affordance. Style the
group's `tab` part for the real interactive tab button.

**Themeable custom properties:** none of its own, and the group's are not settable here. The button
this tab is projected into lives in `<lr-tab-group>`'s shadow root, so it inherits
`--lr-tab-group-selected-color`, `--lr-tab-group-indicator-color` and `--lr-tab-group-hover-color`
from the group host or an ancestor of it. Declaring one on the `<lr-tab>` itself does nothing: this
element is _inside_ that button in the flattened tree, and inheritance only runs the other way.

Before group hydration, an unassigned tab places itself in the public `nav` slot. The group then
writes its internal per-tab `slot` attribute itself. A tab with no `panel` still gets a stable
synthetic name from its position, so an unpaired tab renders a button with an empty panel rather
than silently disappearing.

The visual close affordance is non-focusable because `<lr-tab-group>` projects this descriptor
inside the real `role="tab"` button. Rendering another focusable button there would create a
nested-interactive accessibility violation and break the APG's one-stop roving-tabindex model. The
glyph carries a localized `title`, stays out of the accessible name, and stops propagation so
closing an inactive tab never selects it first. Keyboard users focus the same real tab button and
press Delete, advertised through `aria-keyshortcuts`. Remove the corresponding `<lr-tab>` and
`<lr-tab-panel>` in an `lr-close` listener; the group then reconciles selection automatically.

```html
<lr-tab-group id="documents" aria-label="Open documents">
  <lr-tab panel="overview" active>Overview</lr-tab>
  <lr-tab panel="notes" closable>Notes</lr-tab>
  <lr-tab-panel name="overview" active>Overview content</lr-tab-panel>
  <lr-tab-panel name="notes">Notes content</lr-tab-panel>
</lr-tab-group>
```

```js
const group = document.querySelector("#documents");
group.addEventListener("lr-close", (event) => {
  const tab = event.target;
  const name = tab.panel;
  tab.remove();
  group.querySelector(`lr-tab-panel[name="${CSS.escape(name)}"]`)?.remove();
});
```

---

## `lr-tab-panel`

The content revealed by the `<lr-tab>` whose `panel` matches this element's `name`. Mirrors
`wa-tab-panel` / `sl-tab-panel`.

Deliberately carries **no `role="tabpanel"` of its own**: the group renders the `role="tabpanel"`
wrapper this element is projected into, and a second nested tabpanel role would leave the panel
announced twice. Show/hide is the group's job too — this element is always present in the DOM.

**Properties:** `name: string = ''` (reflected) — matches the `panel` of the `<lr-tab>` that reveals
it; `active: boolean = false` (reflected) — SSR visibility hint, synchronized by the owning group
after hydration. **Events:** none. **Slots:** default (the panel's content). **CSS parts:** `base`
(the content wrapper); the owning group also exposes its outer `panel` wrapper. **Themeable custom
properties:** `--padding` (default `0`) — inner padding on the panel's own `base` wrapper.

---

---

## `lr-control-group`

Semantic grouping for mixed controls and actions. It keeps slotted children in a wrapping
inline-flex row and centers children with different intrinsic heights. Use it for dashboard
toolbars that combine segmented controls, selects, buttons, and other interactive elements.

**Properties:**

- `label: string = ''` — accessible-name fallback for the internal `role="group"`; a host
  `aria-label`, when present, wins including an explicitly empty value.
- `responsive: boolean = false` (reflected) — opts into a `@container` narrow-allocation breakpoint
  (switches to a full-width allocation below `20rem`) by making the host a CSS size-query
  container. Left unset, the host is `container-type: normal`, since `container-type: inline-size`
  unconditionally would collapse the group to 0 inline size whenever it sits as an ordinary
  (`flex-basis: auto`) child of a shrink-to-fit flex row — this component's own primary use case.

**Events:** none.

**Slots:** default — controls, buttons, or other action content.

**CSS parts:** `base` — the internal `role="group"` wrapper.

**Themeable custom properties:** `--lr-control-group-gap` (default `var(--lr-space-xs)`) — gap
between grouped controls; shared spacing and layout tokens apply as well.

```html
<lr-control-group label="Chart controls">
  <lr-segmented></lr-segmented>
  <lr-select></lr-select>
  <lr-button>Export</lr-button>
</lr-control-group>
```

**Known gotchas:**

- This is a layout and semantics primitive; it does not coordinate child values or emit a group
  change event.
- Children wrap according to the group's own allocated inline size, not the viewport width.
- The `@container` narrow-allocation breakpoint only applies when `responsive` is set. Setting
  `responsive` while this group also sits as a shrink-to-fit flex child re-introduces the 0-width
  collapse this default is designed to avoid — only opt in when the group's own size comes from
  somewhere else (a percentage width, a grid track, a block-level parent).

---

## `lr-reorder-list` / `lr-reorder-item`

A generic flat-list reorder primitive: per-row move-up/move-down buttons (always available), plus
Ctrl/Cmd+ArrowUp/ArrowDown from focus anywhere inside a row — the same modifier convention
`<lr-tree>`'s `reorderable` and `<lr-dashboard-grid>`'s `cells-draggable` already establish. Unlike
`<lr-tree>`'s controlled `reorderable` mode, this list physically moves its own slotted
`<lr-reorder-item>` light-DOM nodes itself (there is no `data` array prop to reconcile against),
and emits `lr-reorder` with the full new order so the host can persist it without hand-rolling its
own splice/resort logic. `lr-reorder` is cancelable — a listener calling `preventDefault()` holds
the move open (mirroring `lr-confirm-bar`'s cancelable approve/deny pattern) until the host calls
`finalizePendingMove()`/`revertPendingMove()`.

### `lr-reorder-list`

**Properties:**

- `label: string = ''` — accessible name for the internal `role="list"`; when empty, a host
  `aria-label` is forwarded as a fallback.
- `disabled: boolean = false` (reflected) — disables every item's move buttons and the Ctrl/Cmd+
  Arrow shortcut, without mutating any item's own `disabled` attribute.

**Events:** `lr-reorder`
(`detail: LyraReorderDetail { readonly order: readonly string[], readonly fromIndex: number,
readonly toIndex: number }`, cancelable) — fired before a move is applied; `order` is an immutable
snapshot of every valid item's stable `value` in the order the move WOULD produce. Uncanceled, the
move applies synchronously only if the exact mover, target, membership, order, identities, and
availability remain valid after dispatch. `preventDefault()` holds the move instead: the internal
list exposes `aria-busy="true"`, every move action is disabled, the affected item exposes
`:state(pending)`, and no other move can start until the host resolves it — see **Methods** below.
Synchronous finalize/revert calls from the canceling listener are supported.

**Methods:** `finalizePendingMove()` — applies a move held via `preventDefault()`.
`revertPendingMove()` — discards a held move, restoring the prior order. Both no-op when nothing
is pending.

**Slots:** default — `<lr-reorder-item>` elements.

**CSS parts:** `base` — the internal `role="list"` wrapper.

**Themeable custom properties:** `--lr-reorder-list-gap` (default `var(--lr-space-2xs)`) — gap
between rows.

```html
<lr-reorder-list label="Form fields">
  <lr-reorder-item value="name">Name</lr-reorder-item>
  <lr-reorder-item value="email">Email</lr-reorder-item>
  <lr-reorder-item value="phone">Phone</lr-reorder-item>
</lr-reorder-list>
<script type="module">
  document
    .querySelector("lr-reorder-list")
    .addEventListener("lr-reorder", (e) => console.log(e.detail.order));
</script>
```

**Known gotchas:**

- Boundary-disabled state (`atStart`/`atEnd`), `listDisabled`, and `pending` are readonly effective
  state computed by the owning list and exposed through item custom states.
- Every item requires a unique, nonempty stable `value`. Missing, whitespace-only, and later
  duplicate identities remain visible but their move actions are unavailable until corrected.
- Ctrl/Cmd+Arrow is consumed only for a valid owned move. A boundary/no-op gesture or one from a
  nested input, select, link, button, editable region, or custom control retains its native action.
- No pointer drag-and-drop; move-up/move-down buttons and the keyboard shortcut only.

---

### `lr-reorder-item`

**Properties:**

- `value: string = ''` — required unique, nonempty stable identifier included in the parent's
  `lr-reorder` order array.
- `accessibleLabel?: string` (attribute `accessible-label`) — explicit row identity appended to
  each repeated move action's accessible name; otherwise the item derives a bounded accessible
  text projection from its row content.
- `disabled: boolean = false` (reflected) — disables this row's own move buttons only; does not
  hide its slotted content.
- `atStart: boolean`, `atEnd: boolean`, `listDisabled: boolean`, `pending: boolean` (readonly) —
  effective owner state. Corresponding custom states include `:state(at-start)`, `:state(at-end)`,
  `:state(list-disabled)`, `:state(pending)`, and `:state(busy)`.

**Events:** `lr-move-request` (`detail: { direction: 'up' | 'down' }` — a move button was activated
while not disabled; handled by the parent `<lr-reorder-list>`, which performs the actual move)

**Slots:** default — arbitrary row content.

**CSS parts:** `base` (row wrapper), `move-up-button`, `move-down-button`, `content` (default-slot
wrapper).

**Themeable custom properties:** `--lr-reorder-item-gap` (default `var(--lr-space-xs)`) — gap
between the move buttons and the row content. The move-button interaction paints are independent,
inherited inline fallbacks: `--lr-reorder-item-move-button-hover-bg` (default
`var(--lr-color-brand-quiet)`), `--lr-reorder-item-move-button-hover-color` (default
`var(--lr-color-brand)`), `--lr-reorder-item-move-button-active-bg` (default `color-mix(in oklab,
var(--lr-color-brand-quiet), var(--lr-color-mix-partner) var(--lr-color-mix-active))`), and
`--lr-reorder-item-move-button-active-color` (default `var(--lr-color-brand)`). Set them on an item
or any ancestor to retheme only the hover or pressed move affordance.

---

## `lr-segmented`

A single-select button row with the WAI-ARIA APG `radiogroup` contract built in:
`role="radiogroup"`/`role="radio"`, roving tabindex, automatic activation (click or arrow-key move
both select immediately, like a native radio group), cyclic Arrow/Home/End navigation among
non-disabled items. First-party invention (no `wa-*`/`sl-*` counterpart) — "choose exactly one of N
labeled options, rendered as a button row" is ubiquitous settings/filter-panel UI.
Navigation starts from the segment that actually received the keyboard event, even when a
controlled `value` write changed the selected or remembered roving item first.

**Properties:**

- `items: readonly LyraSegmentedItem[] = []` (attribute: false) — `LyraSegmentedItem { value:
string; label: string; icon?: unknown; disabled?: boolean }`; `icon` renders as an inert,
  `aria-hidden` decorative leading
  visual inside `segment-icon`. It does not replace the required text label or provide an independent
  action or accessible name. Input is read through a realm-neutral bounded schema snapshot (at most
  256 positions); malformed/hostile entries are skipped, later duplicate values use
  first-valid-value-wins, and the frozen returned array/records never alias caller-owned objects.
- `value: string = ''` — the currently selected item's `value`.
- `label: string = ''` — accessible-name fallback copied to the internal `role="radiogroup"`. A
  host-level `aria-label` wins by attribute presence, including an explicitly empty value.
- `size: '2xs' | 'xs' | 's' | 'm' | 'l' | 'xl' | 'small' | 'medium' | 'large' = 'm'` (reflected) —
  visual size on the library's **shared** ladder, the same `--lr-form-control-*` scale
  `lr-input`/`lr-select`/`lr-combobox`/`lr-button` resolve, so a row of mixed controls set to one
  `size` lines up at a matching height. Both spellings of every tier are accepted (`s`/`small`,
  `m`/`medium`, `l`/`large`), so migrating from either upstream is a tag rename with no attribute
  rewrite. Before 8.0.0 this component carried its own six-tier scale that had drifted from that
  one; `m` is still the default, but the tiers now resolve to the shared control heights, paddings
  and font sizes rather than to this component's former private values.

**Events:** `lr-change` (`detail: { value }`) — fired when the selected value changes via click or
keyboard.

**Methods:**

- `scrollToValue(value: string): void` — scroll the segment with the given `value` into view within
  the (possibly overflowing) track, without changing the selection. Honors
  `prefers-reduced-motion` (falls back to `behavior: 'auto'`). This runs automatically when `value`
  is changed programmatically (keyboard navigation already reveals the focused segment on its own),
  so you only need to call it for the "reveal without selecting" case.

**Slots:** none.

**CSS parts:** `base` (the `role="radiogroup"` root), `segment` (a single `role="radio"` button),
`segment-icon` (an optional inert, `aria-hidden` decorative leading icon), `segment-label` (the
segment's label text).

**Themeable custom properties:** `--lr-scroll-fade-size` (default `2rem`) — width of the mask fade
at each horizontal scroll edge of the track, painted only while the track actually overflows (a row
that fits is never dimmed). Forced-colors mode removes the decorative mask while preserving the
native horizontal scroll owner. `--lr-segmented-track-min-height` (default
`var(--lr-form-control-height)`), `--lr-segmented-segment-padding` (default
`var(--lr-form-control-padding-block) var(--lr-form-control-padding-inline)`), and
`--lr-segmented-font-size` (default `var(--lr-form-control-font-size)`) are the three knobs the
`size` tier moves — each points at the shared ladder rather than carrying a per-tier value of its
own, so retuning one tier for this component alone is a one-line override instead of a fork. Their
private defaults follow the tier; a public value inherited from an ancestor or set directly on the
element remains authoritative in every tier.

`--lr-segmented-track-height` pins the `base` track's exact height at every `size` tier (it sets
both `block-size` and `min-block-size`), for a row that has to sit flush beside a hard-sized toolbar
control. It is **genuinely undeclared by default** — not `auto` — and that is load-bearing: an
exact-height hatch only works as an undeclared sentinel, because `auto` is itself a valid value that
would always win and would silently turn every tier's `--lr-segmented-track-min-height` floor into
dead code. While it is unset, each tier keeps its own floor and the track grows with its content.
The floor at the two compact tiers is the ladder's own (20px at `2xs`, 24px at `xs`), but every
`2xs`/`xs` _segment_ separately carries a 24×24px minimum box, so the tappable target holds even
when a label is a single character and the track ends up taller than its nominal floor.

`--lr-segmented-selected-bg` (default `var(--lr-color-surface)`), `--lr-segmented-selected-color`
(default `var(--lr-color-text)`), `--lr-segmented-selected-font-weight` (default
`var(--lr-font-weight-semibold)`) and `--lr-segmented-selected-shadow` (default
`var(--lr-shadow-xs)` — the shallowest step in the elevation scale, since the checked segment is a
thumb lifted a hair off its own track) style the checked segment's pill;
`--lr-segmented-hover-color` (default `var(--lr-color-text)`) styles a hovered segment that is
neither checked nor disabled, independently of the four above — so recoloring the checked pill never
bleeds onto hover. These five existing state hooks are inline `var()` fallbacks at the
point of use rather than `:host` declarations, so each can be set on the element _or on any
ancestor_; unset, each falls back to the token its rule used before. They exist because
`::part(segment)[aria-checked='true']` is invalid CSS — Shadow Parts forbids an attribute selector
after `::part()` — which previously left hijacking the library-wide
`--lr-color-surface`/`--lr-color-text` tokens as the only way to restyle a selected segment,
repainting every other element that read them.

`--lr-segmented-active-bg` (default `color-mix(in oklab, transparent,
var(--lr-color-mix-partner) var(--lr-color-mix-active))`) and
`--lr-segmented-active-color` (default
`var(--lr-segmented-hover-color, var(--lr-color-text))`) style a pressed segment that is neither
checked nor disabled. They use the same inline-fallback inheritance, leaving checked and merely
hovered siblings independent.

Otherwise shared tokens — `--lr-color-border`/`-surface`/`-text`/
`-text-quiet`, `--lr-radius`, `--lr-font-weight-semibold`, `--lr-shadow-xs`,
`--lr-opacity-disabled`, `--lr-focus-ring-*`, and the `--lr-form-control-*` knobs the `size` tier
resolves.

**Optional peer deps:** none.

```html
<lr-segmented></lr-segmented>
<script type="module">
  const seg = document.querySelector("lr-segmented");
  seg.items = [
    { value: "day", label: "Day", icon: "☀" },
    { value: "week", label: "Week", icon: "▦" },
    { value: "month", label: "Month" },
  ];
  seg.value = "week";
  seg.addEventListener("lr-change", (e) => console.log(e.detail.value));
</script>
```

**Known gotchas:**

- arrow-key navigation cycles (past the last non-disabled item wraps to the first, and vice versa)
  rather than clamping at the first/last item, unlike `lr-stepper`'s clamped Left/Right.
- this component self-selects on navigation: clicking or arrow-navigating to an item immediately
  updates `value` and fires `lr-change` — there's no separate "commit" step the way, e.g.,
  `lr-select`'s popup has.
- the semantic `radiogroup` lives inside shadow DOM. Set `label` (preferred for reactive code) or a
  host `aria-label`; a present host attribute wins, including an explicit empty value, and the
  component deliberately forwards the resulting name to that internal role.

**Additional API surface:**

- `--lr-segmented-track-gap` — Gap between segments. Default: `var(--lr-size-0-125rem)`.
- `--lr-segmented-track-radius` — Track corner radius. Default: `var(--lr-radius)`.
- `--lr-segmented-track-padding` — Track inset padding. Default: `var(--lr-size-0-125rem)`.

---

## `lr-virtual-list`

A generic windowed/virtualized list host. Renders only the items within the current viewport (plus
`overscan` padding rows on each side) as real DOM, regardless of how large its source is, so a
multi-thousand-row chat-history sidebar (or a long message thread) stays cheap to scroll. Content is
entirely caller-supplied: `renderItem(item, index)` returns whatever `lit-html` value should represent
that row, and `keyFunction(item, index)` gives it a stable identity for DOM reconciliation. First-party
invention (no `wa-*`/`sl-*` counterpart).

Before a viewport can be measured, including during server rendering, the component emits a bounded
deterministic first window (the first visible row plus `overscan`) rather than a false empty list.
Hydration preserves that window on its first pass and then reconciles it with the measured browser
viewport; an ordinary browser-only mount retains the established empty-until-measured range-event
contract.

**Properties:**

- `items: readonly unknown[] = []` (attribute: false) — the full, non-windowed item collection. JS-only; set via
  a property/lit-html binding (`.items=`), not an HTML attribute. This remains the compatibility
  source whenever `source` is unset. Its sequence is copied, bounded, and frozen while generic row
  identities are retained; reassign a new array after sequence changes.
- `source?: VirtualListSource` (attribute: false) — a readonly array or a count/index-backed
  `{ readonly count: number; itemAt(index): unknown; keyAt?(index): string | number;
indexOfKey?(key): number }`. When set it takes precedence over `items`. The indexed form performs
  bounded random access for only the rendered window instead of allocating `0…count`; invalid counts
  normalize to zero. Prefer a stable object identity and stable `keyAt`/`indexOfKey` implementations
  for synthetic, paged, or remote collections. `indexOfKey` is required when `active-item-id` should
  target an indexed source: the list never performs a count-sized fallback scan; invalid or
  out-of-range results mean no match. An array source receives the same clone-owned frozen sequence
  and row-identity contract as `items`; an indexed-source object passes through by identity.
- `renderItem: (item: unknown, index: number) => unknown = () => nothing` (attribute: false) — renders
  one row's content, typically returning a `lit-html` `TemplateResult`. JS-only.

**Narrow rows:** ordinary `renderItem` content can shrink and wraps even at a 320px allocation,
including an otherwise-unbroken value; in `row-height="auto"` mode the measured row height follows
those extra lines. This is direction-neutral: LTR and RTL use the same inline-size containment. To
intentionally preserve an unbroken row, set `white-space: nowrap` on the caller-rendered content; the
list's `base` scroll container exposes horizontal scrolling for that explicit opt-out.

- `keyFunction?: (item: unknown, index: number) => string | number` (attribute: false) — derives a
  row's stable reconciliation key. JS-only. Falls back to the effective source index when omitted,
  which is only a safe identity while a collection never reorders/inserts/removes — provide this
  whenever possible, or scroll position and per-row DOM state (e.g. an `<audio>` element's playback
  position) can attach to the wrong row across a mutation.
- `groups?: VirtualListGroup[]` (attribute: false) — renders a labeled marker at each group's
  `startIndex` as a measured virtual entry immediately before that row. Its live block size
  contributes to every following offset, so a variable-height or late-resizing marker never covers
  the group's first row. Markers remain windowed with their rows. Groups are sorted by `startIndex`;
  a `startIndex` that's non-integer, out of range, or a duplicate of an earlier group's is silently
  dropped rather than rendered wrong. An entry whose
  `label` is the **empty string** renders no marker at all — it is a pure position anchor, for a host
  that renders its own group header as an ordinary row (and would otherwise end up with two stacked
  headers) but still needs this component to know where each group starts, e.g. to drive
  `renderStickyGroup` below. Omitting `label` entirely still falls back to rendering `key`.
- `renderStickyGroup?: (group: VirtualListGroup) => unknown` (attribute: false) — renders a pinned
  copy of whichever `groups` entry the viewport is currently inside, into a `[part="sticky-group"]`
  overlay that stays at the top of the scroll viewport and is pushed out by the overlap as the next
  group's header arrives (rather than swapped abruptly at the boundary). Native `position: sticky` on
  the rows or markers themselves cannot do this: every row is absolutely positioned and
  transform-offset by the windowing math, which makes sticky structurally inert. Unset (the default)
  renders no overlay element whatsoever and changes nothing about the list's output. The overlay is a
  _visual copy_ of content that already exists in the list, which fixes its contract:

  - it is `aria-hidden` and `inert`, so the real row keeps sole ownership of heading semantics,
    focus and activation. The component never traverses or rewrites callback-owned descendants,
    including open custom-element shadow roots;
  - it is pointer-transparent and deliberately cannot become a mouse-only action. Put interactive
    group actions in the real row;
  - it is never measured as a row, so a group header that is also a real row is not double-counted in
    `row-height="auto"` mode;
  - its measured height is applied as `scroll-padding-block-start` on the scroll container and
    subtracted from top-aligned scroll targets, so `active-item-id`, `scrollToIndex({ align: 'start' })`
    and native keyboard scrolling all stop _below_ the band instead of parking the row behind it.

  The callback runs on every scroll-driven update, so keep it cheap and side-effect free. While the
  viewport is above the first group there is nothing to pin: the band shows nothing, but it stays
  mounted (called with the first group, rendered hidden) so its height is known before the first
  programmatic jump rather than only after it.

- `rowHeight: number | 'auto' = 'auto'` (attribute `row-height`) — `'auto'` measures each row's real
  height via `ResizeObserver`; a numeric markup value (for example `row-height="56"`) parses to the
  number `56` and fixes every row to that many pixels. Property callers assign a number, not a
  numeric string. Anything else (non-numeric, zero, negative, non-finite) safely canonicalizes to
  `'auto'` rather than throwing.
- `itemRole: 'listitem' | 'row' = 'listitem'` (attribute `item-role`) — `'listitem'` (default)
  preserves the plain `role="list"`/`role="listitem"` mapping with `aria-setsize`/`aria-posinset`.
  `'row'` additionally maps `[part="base"]` to `role="rowgroup"`, `[part="spacer"]` to
  `role="presentation"`, and each row to `role="row"` with `aria-rowindex` instead — for a consumer
  composing its own `role="table"` wrapper and header row around this component (see
  `lr-dataset-viewer`).
- `rowIndexOffset: number = 0` (attribute `row-index-offset`) — added to a row's 1-based index to
  compute `aria-rowindex` in `item-role="row"` mode (e.g. `1` when a consumer renders its own header
  row occupying `aria-rowindex="1"` outside this component). Negative and non-finite values become
  zero, fractions are truncated, and the final positive ARIA integer saturates safely. No effect in
  `'listitem'` mode.
- `overscan: number = 6` — extra rows rendered beyond the visible viewport on each side; finite
  values are floored and clamped to 0–100, while non-finite values use the default 6, so an invalid
  runtime value cannot disable windowing and render the entire collection.
- `activeItemId: string | number | '' = ''` (attribute `active-item-id`) — when set and it matches a row's `keyFunction`
  result (compared with `Object.is` against the typed value — attribute values arrive as strings, so
  assign the property directly for a numeric key), that row is smoothly scrolled into view whenever
  this changes, and rendered with `aria-current="true"`.
- `loading: boolean = false` (reflected) — sets `aria-busy` on the scroll container and a `cursor:
progress` style, and gates `lr-load-more` while a consumer's fetch is in flight.
- `hasMore: boolean = false` (attribute `has-more`, reflected) — when true, scrolling near the bottom
  fires `lr-load-more` (gated by `loading`).

**Exported types:** `VirtualListRowHeight = number | 'auto'`;
`VirtualListSource<T> = readonly T[] | VirtualListIndexedSource<T>` and
`VirtualListIndexedSource<T> { readonly count: number; itemAt(index): T; keyAt?(index): string |
number; indexOfKey?(key: string | number): number }`; `VirtualListRange { start: number; end: number }` (the `lr-visible-range-change`
detail shape); `VirtualListGroup { key: string | number; label?: string; startIndex: number }` — the
shape consumed by `groups` above; `VirtualListScroll { scrollTop: number; viewportHeight: number }` —
the `lr-virtual-scroll` detail shape.
`groupByRecency(items, options?)` is a DOM-free helper that returns non-empty
Today/Yesterday/Previous 7 Days/Older buckets, preserves input order within each bucket, and accepts
a timestamp extractor, reference date, and label overrides. Import it from its granular subpath —
the package root re-exports it too, but that entry pulls in the eager registration barrel:

```ts
import { groupByRecency } from "@aceshooting/lyra-ui/utilities/group-by-recency.js";
```

**Methods:** `scrollToIndex(index, options?)` — the programmatic counterpart to `active-item-id`'s
automatic scroll-into-view, for a host that needs to scroll to a specific row without changing which
row is "active." `options.align` is `'start'`, `'end'`, or `'auto'` (default — no scroll at all when
already fully visible); `options.behavior` (default `'smooth'`) is forced to `'auto'` under
`prefers-reduced-motion: reduce`. `index` is clamped to the effective source's `0…count-1` range.
In auto-height mode, estimate-based jumps are corrected as row and group-marker measurements arrive.
That correction is bound to the source, key function, and target identity and is canceled on a new
target, data replacement, manual scroll intent, or disconnect, so late observations cannot pull a
newer view back to stale content.
`offsetForIndex(index)` returns the pixel top row `index` renders at, in the same coordinate space as
the scroll container's `scrollTop`; it is clamped to `0…count`, so `offsetForIndex(count)`
is the total content height and an empty list is always `0`. `indexAtOffset(px)` is its inverse — the
row whose box contains that offset, clamped at both ends, `-1` for an empty list — so
`indexAtOffset(offsetForIndex(i)) === i` and `indexAtOffset(scrollContainer.scrollTop)` is the row at
the top of the viewport. In `row-height="auto"` mode both are estimate-based for any row that (or
above which) has not been measured yet, and converge as those `ResizeObserver` measurements land;
fixed numeric `row-height` offsets are exact from the first render. Both read the most recent render,
so `await el.updateComplete` after assigning `items` or `source` before querying.

**Getters:** `scrollContainer: HTMLElement | undefined` — the real scroll container (`[part="base"]`),
`undefined` before the first render; for a host that needs the live scroll position or wants to scroll
the list itself without reaching into the shadow root. `renderedRows: HTMLElement[]` — the row
wrappers (`[part="row"]`) that currently exist as real DOM, in item order (the current window, not the
whole collection; empty before the first render). It exists for hosts that must _reach_ a rendered row
rather than style it — keyboard focus management across a windowed list, where the row to focus may
not have existed a frame earlier, and which `exportparts` cannot serve since it forwards styling, not
element references. Treat both as read-only: positioning, keys, and lifetime belong to the windowing
math, and any row element can be recycled or removed on the next update.

**Events:** `lr-load-more` (no detail — fired once per approach to the bottom of the list while
`has-more` is true and `loading` is false; does not refire on every scroll tick while still near the
bottom — scrolling back away from the bottom and returning, or `items` growing enough to move the
window away from the end, re-arms it), `lr-visible-range-change` (`detail: VirtualListRange`, the
current visible, non-overscanned item index range — fired only when it actually changes; it was
spelled `lr-visible-range-changed` before 10.0.0, the only past-tense `-changed` spelling among 58
`-change`-family events, so a convention-driven `lr-${x}-change` listener silently missed it),
`lr-virtual-scroll`
(`detail: VirtualListScroll` — the scroll container moved; emitted from the same animation frame that
already coalesces native `scroll` events, so a fling produces at most one per frame and none at all
when the position did not change. Unlike `lr-visible-range-change`, which only fires on index-range
changes, this reports _sub-row_ movement, which is what scroll-linked layout needs)

**Slots:** none — all content comes from `renderItem`.

**CSS parts:** `base` (the scrollable container, `role="list"` — or `role="rowgroup"` in
`item-role="row"` mode — `tabindex="0"`), `spacer` (the full-content-height inner element
establishing true scroll extent; `role="presentation"` in `item-role="row"` mode), `row` (one
rendered row's absolutely-positioned wrapper, `role="listitem"` — or `role="row"` with
`aria-rowindex` in `item-role="row"` mode), `group` (a `groups` entry's positioned marker; not
rendered for an entry whose `label` is the empty string), `sticky-group` (the pinned copy of the
current group, present only while `renderStickyGroup` is set — `aria-hidden`, `inert`, and
pointer-transparent, and it shows nothing while the viewport is above the first group)

**Themeable custom properties:** `--lr-virtual-list-height` (default `24rem` — the host's bounded
scroll extent; component-specific since a virtualized list is meaningless without a sized viewport),
plus shared `--lr-focus-ring-width/-color/-offset` (inward-offset ring on `[part="base"]`, negative
so it isn't clipped by the container's own `overflow: auto`). `[part="base"]` also carries a
mouse-hover outline — a subtler preview of that same `:focus-visible` ring, shown because the part
always carries `tabindex="0"` and is a real keyboard-navigable target — tinted via
`--lr-virtual-list-hover-outline-color` (default `var(--lr-color-border-strong)`); set it to
`transparent` to opt out of the hover treatment entirely. Its remaining longhands are independently
themeable with `--lr-virtual-list-hover-outline-width` (default
`var(--lr-border-width-thin)`), `--lr-virtual-list-hover-outline-style` (default `solid`), and
`--lr-virtual-list-hover-outline-offset` (default
`calc(-1 * var(--lr-border-width-thin))`). All four hover-outline hooks are inline fallbacks and
there is intentionally no pressed state: the list viewport is a scroll surface rather than an
activation target.

**Optional peer deps:** none.

```ts
import { html } from "lit";

const view = html`<lr-virtual-list
  .items=${sessions}
  .renderItem=${(item, index) => html`
    <lr-conversation-item
      id=${item.id}
      title=${item.title}
      .timestamp=${item.updatedAt}
      ?active=${item.id === currentId}
    ></lr-conversation-item>
  `}
  .keyFunction=${(item) => item.id}
  active-item-id=${currentId}
  ?has-more=${hasMorePages}
  ?loading=${isLoadingMore}
  @lr-load-more=${() => loadNextPage()}
  @lr-visible-range-change=${(e) => console.log("visible", e.detail.start, e.detail.end)}
  @lr-virtual-scroll=${(e) => console.log("scroll top", e.detail.scrollTop)}
></lr-virtual-list>`;
```

```ts
import { html } from "lit";

// No count-sized array: only the current window is read.
const syntheticRows = {
  count: 100_000,
  itemAt: (index: number) => ({ page: index + 1 }),
  keyAt: (index: number) => index + 1,
  indexOfKey: (key: string | number) =>
    typeof key === "number" ? key - 1 : -1,
};

html`<lr-virtual-list
  row-height="72"
  .source=${syntheticRows}
  .renderItem=${(row) => html`Page ${row.page}`}
></lr-virtual-list>`;
```

```ts
import { html } from "lit";

// Sticky group headers: the header is a real row, so the `groups` entries are position anchors
// only (`label: ''`); the pinned copy remains strictly presentational.
const view = html`<lr-virtual-list
  .items=${rows}
  .groups=${groupStarts /* [{ key: 'Today', label: '', startIndex: 0 }, …] */}
  .renderItem=${(item, index) => (item.isHeader ? headerTemplate(item) : rowTemplate(item))}
  .renderStickyGroup=${(group) => headerTemplate(group)}
></lr-virtual-list>`;
```

Every row is positioned by a `transform: translateY(offset)`, rather than page flow, so only a small
DOM window exists while the scrollbar still reflects the full collection. Array sources retain their
cumulative-offset cache, rebuilt only when the collection/height/key inputs or a measurement change —
never on a pure scroll tick. Indexed sources never synthesize count-sized item, key, identity, or
offset arrays: fixed-height offsets are direct count arithmetic, while auto-height offsets combine the
default estimate with sparse `ResizeObserver` measurements for rows that have actually mounted.

**Known gotchas:**

- `items`, `source`, `renderItem`, `keyFunction`, and `groups` are all `attribute: false` — they must
  be set as JS properties (`.source=`, `.items=`, `.renderItem=`, …), never as HTML attribute strings.
- The container is `role="list"` with rows `role="listitem"`, deliberately not `listbox`/`option` —
  this component only provides windowing, not the roving-tabindex/`aria-activedescendant`
  keyboard-interaction contract a real `listbox` requires. `active-item-id` only scrolls a row into view and
  marks it `aria-current`; it is not a selection widget. Compose your own selection behavior on top if
  needed.
- `[part="base"]` carries `tabindex="0"` unconditionally, since `renderItem`'s caller-supplied content
  isn't guaranteed to contain a focusable element and an otherwise-unreachable-by-keyboard scroll
  region would result.
- Ordinary row content wraps by default, including long unbroken values. Set `white-space: nowrap`
  only for content that intentionally needs an unbroken horizontal scrollport; it overrides that
  default without clipping the row.
- `aria-setsize`/`aria-posinset` are computed from a row's real index in the full `items` array, not its
  position among the currently-rendered DOM window, so assistive tech still announces e.g. "item 12 of
  340" correctly even though only a handful of rows exist in the DOM at a time.
- `groups`, `renderStickyGroup`, `offsetForIndex()`/`indexAtOffset()` and the `lr-virtual-scroll`
  event are
  all expressed against the _same_ windowing math, so they agree with each other — but that math is
  estimate-based in `row-height="auto"` mode until the rows involved have been measured. Read a
  position after `await el.updateComplete`, and expect the value to converge rather than be final on
  the first frame.
- A sticky band only appears when `renderStickyGroup` _and_ at least one valid `groups` entry are
  both present; `groups` alone renders positioned markers with nothing pinned, and
  `renderStickyGroup` alone renders no overlay element at all.
- **A row that renders a popup needs the active-row lift, and this is why `[part='row']` has one.**
  Each row carries `will-change: transform` (a compositor hint for the per-frame translate), which
  makes every row its own stacking context. Rows otherwise carry no `z-index`, so they paint in DOM
  order and each one paints over the previous. Anything a row renders that overflows its own box —
  an `<lr-menu>` popup in a row-action menu, a tooltip, an outward focus ring — is therefore painted
  _underneath_ every following row, no matter how high its own `z-index` is: that `z-index` only
  orders siblings inside the row's own context. The last row always looks correct, which is exactly
  why the failure tends to hide in short lists. A row lifts to `--lr-layer-content` while something
  inside it holds focus or while it contains an open `lr-menu`. The explicit menu-open branch covers
  imperative opening and virtual measurement/render cycles, where focus can temporarily return to
  the document while the popup remains visible. The value deliberately _matches_
  `[part='group']`'s rather than exceeding it, so the two land on the same layer and DOM order
  decides: groups render before the rows, so an active row wins while (and only while) it needs to,
  which is right — a group header is a non-interactive `pointer-events: none` label.

---

## `lr-app-rail`

A responsive navigation rail that adapts across three presentations as the _viewport_ narrows (not
this element's own inline size): `'full'` (nav items show icon + label, inline), `'icon-only'` (a
narrower inline rail, icons only), and `'mobile'` (hidden behind a toggle button; opening it shows a
focus-trapped floating overlay over the page). First-party invention (no `wa-*`/`sl-*` counterpart).
Breakpoints are viewport-width `matchMedia()` queries against `icon-only-breakpoint`/
`mobile-breakpoint`, not a `ResizeObserver` on this element — presentation tracks the actual device/
window width the way a native OS shell's navigation does, not however much horizontal space a
particular layout happens to give it. `[part="base"]` (the inline `'full'`/`'icon-only'`
presentation) and `[part="panel"]` (the mobile overlay) are the _same_ element promoted in place
across modes (mirrors `<lr-widget>`'s fullscreen mode) — never both at once, and slotted nav
content is never duplicated.

Opting in to `resizable` adds a continuously draggable width for the `'full'` state: a
`[part="resizer"]` handle (pointer-drag and Left/Right-arrow keyboard stepping, RTL-aware) clamped to
`[minRailWidthPx, maxRailWidthPx]`. Set `storageKey` (attribute `storage-key`) to persist the fields
selected by `persist` to `localStorage` under `lr-app-rail:${storageKey}` and restore them on the
next mount (mirrors `lr-multi-split`'s `storage-key`; effective `mode` is breakpoint-derived and never
persisted). The backward-compatible allowlist is `open width`; use
`persist="width preferred-mode"` for durable layout preference without restoring the transient
mobile overlay. Without a `storageKey` there is no persistence — listen for `lr-rail-resize` and
persist its committed `widthPx` yourself. Listen for the preceding cancelable
`lr-rail-resize-request` event when a host needs to veto a proposed width.
`preferredMode` separately lets a host manually prefer `'full'`/`'icon-only'` for the non-mobile
breakpoint axis (e.g. a user's own collapse toggle) while `mobile-breakpoint` continues to be tracked
automatically regardless — it's only consulted while `mode` isn't force-pinned via the `mode`
accessor itself, which still takes full priority.

**Properties:**

- `mode: LyraAppRailMode` (custom accessor, reflected, read-only as of 9.0.0) — always resolves to
  one of the three real modes (`'full'|'icon-only'|'mobile'`), never `'auto'`; assigning it now
  throws (`el.mode = 'icon-only'` -> TypeError).
- `forceMode?: 'full' | 'icon-only' | 'auto'` (attribute `force-mode`, reflected) — replaces `mode`'s
  former write side as of 9.0.0. Assigning `'full'`/`'icon-only'` pins that mode and stops the
  element responding to breakpoint changes; assigning `'auto'` (or leaving it unset) releases the
  pin and resumes automatic viewport tracking. `'mobile'` can never be force-pinned here — the
  mobile breakpoint is always tracked automatically regardless, mirroring `preferredMode`'s scope
  below; widen `mobile-breakpoint` for a guaranteed-mobile state instead. Settable via the
  `force-mode` attribute too (`force-mode="icon-only"`, `force-mode="auto"`).
- `iconOnlyBreakpoint: string = '960px'` (attribute `icon-only-breakpoint`) — any valid CSS length,
  used directly in a `(max-width: ...)` media query; below it the rail switches from `'full'` to
  `'icon-only'`.
- `mobileBreakpoint: string = '600px'` (attribute `mobile-breakpoint`) — same mechanism; below it the
  rail switches from `'icon-only'` to `'mobile'`. Should be smaller than `iconOnlyBreakpoint` to
  produce all three states as the viewport narrows.
- `open: boolean = false` (reflected) — whether the mobile floating overlay is shown. Only meaningful
  while `mode` is `'mobile'` — the value is preserved (not reset) while another mode is active, but
  no overlay chrome renders until `mode` is `'mobile'` again. Set this directly, or use the built-in
  toggle button — there is no separate `show()`/`hide()` pair.
- `label?: string` — optional accessible name for the rail's navigation landmark and mobile dialog.
  Every nonempty supplied string is honored literally; only absence/empty uses the localized
  navigation fallback. A host-level `aria-label` attribute (including an explicit empty value)
  takes precedence.
- `preferredMode?: 'full' | 'icon-only' | null` (attribute `preferred-mode`) — manually prefers
  `'full'` or `'icon-only'` for the non-mobile breakpoint axis, while `mobile-breakpoint` continues to
  be tracked automatically regardless — e.g. a user's manual collapse toggle that should still yield
  to a genuinely too-narrow-for-any-inline-rail viewport. Only consulted while `mode` isn't
  force-pinned via its own accessor (see above) — that continues to take full priority, unchanged.
  Unset (the default, `null`) reproduces the original breakpoint-only behavior exactly.
- `hideToggle: boolean = false` (reflected, attribute `hide-toggle`) — suppresses the built-in mobile
  `[part='toggle']` hamburger/close button entirely, for a consumer that already owns an external
  mobile-menu toggle wired to this rail's own `open` property. `false` (the default) reproduces the
  exact existing output; note `open` still has no built-in external trigger of its own once this is
  set, since `lr-toggle` only fires from the toggle button being activated.
- `resizable: boolean = false` (reflected) — opts a continuously draggable width in for the `'full'`
  state, exposing a `[part='resizer']` handle clamped to `[minRailWidthPx, maxRailWidthPx]`. `false`
  (the default) renders no resizer and leaves the fixed-width `--lr-app-rail-width` CSS token
  exactly as before this property existed.
- `railWidthPx?: number` (attribute `rail-width-px`) — the rail's current width in px while
  `resizable`; settable/gettable directly. Unset defers to `--lr-app-rail-width`'s own resolved
  width.
- `storageKey?: string` (attribute `storage-key`) — when set, persists the fields selected by
  `persist` to `localStorage` under `lr-app-rail:${storageKey}` and restores them on the next
  mount. Effective `mode` is breakpoint-derived and never persisted. Unset means no persistence.
- `persist: string = 'open width'` — whitespace-separated field allowlist used with `storageKey`.
  Valid `LyraAppRailPersistField` tokens are `open`, `width` (`railWidthPx`), and `preferred-mode`
  (`preferredMode`). The default preserves the existing open+width behavior. Use
  `persist="width preferred-mode"` when overlay-open state is controlled or should stay
  session-only.
- `minRailWidthPx: number = 190` (attribute `min-rail-width-px`) — minimum `railWidthPx` a
  drag/keyboard resize can reach.
- `maxRailWidthPx: number = 440` (attribute `max-rail-width-px`) — maximum `railWidthPx` a
  drag/keyboard resize can reach.
- `dragging: boolean = false` (reflected, read-only as of 9.0.0) — `true` for the duration of an
  active pointer-driven resize drag (not a keyboard step); reflected so a consumer (or this
  component's own styles) can suppress `[part='base']`'s `transition: inline-size` during the drag,
  which otherwise visibly "chases" the pointer instead of tracking it 1:1. This component always
  owned every drag transition itself; assigning it now throws (`el.dragging = true` -> TypeError).

Also settable as a plain `aria-label` attribute (not a reactive property): overrides the computed
`label`/localized-default accessible name on both the navigation landmark and the mobile dialog
role, matching `<lr-date-input>`'s `accessibleLabel`.

**Events:** `lr-mode-change` (`detail: LyraAppRailModeChangeDetail` = `{ mode: LyraAppRailMode }`; the
effective mode changed, whether from a breakpoint crossing or a `forceMode` assignment — not
fired for a redundant reassignment to the mode already in effect), `lr-toggle`
(`detail: LyraAppRailToggleDetail` = `{ open: boolean }`; the mobile overlay is opening or closing — via
the built-in toggle button, Escape, a backdrop click, a nav-item click while open, or a
breakpoint/forced mode change leaving `'mobile'` while open — not fired when a consumer sets `open`
directly. Cancelable for every trigger except the forced mode-change close, which always applies —
vetoing that one would leave `open` stuck `true` in a mode where it's meaningless; call
`preventDefault()` to keep the overlay as it is for the other triggers),
`lr-rail-resize-request` (`detail: LyraAppRailResizeDetail` = `{ widthPx: number }`; a cancelable
proposed width from drag or keyboard stepping, emitted before the component assigns
`railWidthPx` — call `preventDefault()` to keep the current width. It is not fired when a consumer
sets `railWidthPx` directly), and `lr-rail-resize` (`detail: LyraAppRailResizeDetail` =
`{ widthPx: number }`; non-cancelable committed width, emitted immediately for a genuine keyboard
step and once at pointerup for a genuine drag. Clamped/no-op steps, canceled/lost gestures, and
consumer property writes emit no committed event).

**Slots:** default (nav items — generic slotted content, e.g. `<a>`/`<button>` elements the consumer
builds with its own icon+label structure; clicking anywhere in this slot closes the mobile overlay if
open), `header` (logo/brand content, shown above the nav items in every mode), `footer` (a trailing
user/settings trigger, shown below the nav items).

**CSS parts:** `base`, `header`, `nav`, `footer`, `toggle` (hidden via CSS outside `'mobile'` mode, or
entirely via `hideToggle`), `backdrop`, `panel` (`base`/`panel` are mutually exclusive on the same
underlying element — see above), `resizer` (the `resizable` opt-in's drag handle, only rendered while
`resizable` and `mode` is `'full'`; its hit target is `--lr-icon-button-size`-wide), `resizer-track`
(the slim 3px visible drag line centered inside that hit target, tinted `--lr-color-brand` on hover).

**Themeable custom properties:** `--lr-app-rail-width` (default `15rem` — the inline rail width in
`'full'` mode), `--lr-app-rail-icon-width` (default `4rem` — the inline rail width in `'icon-only'`
mode), `--lr-app-rail-mobile-width` (default `18rem`, capped at `85vw` — the mobile overlay panel
width), `--lr-app-rail-overlay-color` (default `var(--lr-color-overlay)` — the mobile backdrop scrim
color; component-specific since no shared token exists), plus shared tokens (`--lr-color-border`,
`--lr-color-surface`, `--lr-color-text`, `--lr-color-brand`, `--lr-color-brand-quiet`,
`--lr-space-*`, `--lr-radius`, `--lr-shadow`, `--lr-icon-button-size`,
`--lr-focus-ring-*`, `--lr-transition-base`). `resizable`'s width is driven entirely by
`railWidthPx`'s inline `inline-size` style rather than a new custom property.
The mobile toggle's hover/pressed background and foreground are independently inheritable through
`--lr-app-rail-toggle-hover-bg`, `--lr-app-rail-toggle-hover-color`,
`--lr-app-rail-toggle-active-bg`, and `--lr-app-rail-toggle-active-color`. The resizer track uses
`--lr-app-rail-resizer-hover-bg` and `--lr-app-rail-resizer-active-bg`. Each hook is an inline
fallback at its exact state rule and preserves the previous brand or active-mix value when unset.

**Optional peer deps:** none.

```html
<lr-app-rail
  label="Main navigation"
  icon-only-breakpoint="960px"
  mobile-breakpoint="600px"
  resizable
>
  <span slot="header"><img src="/logo.svg" alt="Acme" /></span>
  <a href="/inbox" aria-label="Inbox"
    ><svg aria-hidden="true">...</svg><span>Inbox</span></a
  >
  <a href="/settings" aria-label="Settings"
    ><svg aria-hidden="true">...</svg><span>Settings</span></a
  >
  <span slot="footer"><button>Profile</button></span>
</lr-app-rail>
<script type="module">
  const rail = document.querySelector("lr-app-rail");
  rail.addEventListener("lr-rail-resize-request", (e) => {
    if (e.detail.widthPx > 360) e.preventDefault();
  });
  rail.addEventListener("lr-rail-resize", (e) =>
    localStorage.setItem("railWidthPx", String(e.detail.widthPx))
  );
</script>
```

```ts
rail.mode = "icon-only"; // force a presentation regardless of viewport width
rail.mode = "auto"; // release the force, resume live breakpoint tracking
```

The package root also exports a pure `computeAppRailMode(iconOnlyMatches: boolean, mobileMatches:
boolean, preferredMode?: 'full' | 'icon-only' | null): AppRailMode` resolver (plus the
`AppRailMode`/`AppRailModeInput`/`AppRailModeChangeDetail`/`AppRailToggleDetail`/`AppRailResizeDetail`
types) — the same logic the element's internal `matchMedia` listeners call, exposed standalone so a
consumer can compute or unit-test the same resolution without a real browser window. `mobileMatches`
wins over everything else when true (the viewport is narrower than both breakpoints at once);
otherwise `preferredMode` (when set) wins over `iconOnlyMatches`.

The mobile state keeps its own panel template rather than nesting `<lr-dialog>`, while its modal
behavior participates in the shared overlay stack. It is a plain `<div>` with an explicit
`role="navigation"` (swapping to `role="dialog"` while the overlay is open) rather than a literal
`<nav>` tag, since a
`<nav>`'s implicit role can't be overridden to `role="dialog"` without an `aria-allowed-role`
violation. In `'icon-only'` mode, slotted nav items lose their visible text label — give each one a
real accessible name (`aria-label`, visually hidden text, or `title`) regardless, since this
component only lays out whatever is slotted and can't inspect or fix up a consumer's own markup.

**Known gotchas:**

- `mode`'s setter accepts the wider `AppRailModeInput` (including the `'auto'` sentinel) but the
  getter's return type is the narrower `AppRailMode` — assigning `'auto'` is a one-way instruction,
  not a value read back later; there is no `isForced`-style property to check whether the rail is
  currently locked to a mode or tracking the viewport.
- reassigning `icon-only-breakpoint`/`mobile-breakpoint` after first render tears down and rebuilds
  the `matchMedia` listeners, but does not itself un-force a previously-forced `mode` — if a consumer
  set `mode = 'icon-only'`, changing the breakpoints won't resume auto-tracking until `mode = 'auto'`
  is set explicitly.
- leaving `'mobile'` mode while `open` (via a breakpoint crossing or a forced `mode` reassignment)
  auto-closes the overlay through the same path as the toggle button, so `lr-toggle` still fires
  and the scroll lock/focus trap still release normally — a consumer listening only for explicit
  toggle-button clicks would miss this closure.
- the mobile panel is also given `inert` whenever `mode === 'mobile'` and `open` is `false` — it's
  removed from the accessibility tree and tab order via `inert` at the same time it's hidden visually
  via `transform: translateX(-100%)`, both applied simultaneously rather than one implying the other.
- the offscreen slide direction for the mobile panel is flipped for RTL via a `:dir(rtl)` CSS
  selector (`translateX(100%)`), not through the shared `internal/rtl.ts` JS helper used for pointer/
  keyboard math elsewhere in this library — a physical `transform` isn't expressible with logical
  properties, so this one case is handled purely in CSS.
- a reconnect that preserves the same element instance (e.g. a drag-and-drop reparent) resumes its
  shared overlay registration and re-acquires the scroll lock if the overlay was still active
  across the move — `disconnectedCallback`/`connectedCallback` fire back-to-back with no update in
  between, so `willUpdate()` alone wouldn't otherwise notice.
- `resizable`'s drag handle is pointer-only (`pointerdown`/`pointermove`/`pointerup`/
  `pointercancel`/`lostpointercapture`) plus discrete Left/Right-arrow keyboard stepping (8px per
  press, RTL-aware) — there's no dedicated touch gesture beyond what Pointer Events already unify.
- reassigning `railWidthPx` while `resizable` is unset has no visible effect on the rendered width —
  the fixed-width `--lr-app-rail-width` token still governs `'full'`-mode width until `resizable`
  is also set.
- reassigning `icon-only-breakpoint`/`mobile-breakpoint`/`preferredMode` does not itself un-force a
  previously-forced `mode` — same caveat as above, `preferredMode` is only consulted while `mode`
  isn't force-pinned.

### `lr-app-rail-item`

An explicit navigation item for `<lr-app-rail>`. It renders an accessible link when `href` is
set and enabled, otherwise a button; the rail can add its `icon-only` presentation state without
removing the label from the accessibility tree.

**Properties:**

- `href: string = ''` — optional destination. Without it, the item renders as a button.
- `target: string = ''` — optional link target.
- `disabled: boolean = false` (reflected) — prevents activation while retaining the item in the rail.
- `current: boolean = false` (reflected) — marks this as the destination for the current page/view;
  reflects `aria-current="page"` on `[part='base']` and drives the current visual treatment. The rail
  has no built-in routing, so the consumer sets this per item (e.g. by comparing `href` against the
  current location).
- `active: boolean = false` — **deprecated alias for `current`**, read alongside it: the item is
  current when either is true. `active` was this member's original public name, in both property and
  attribute form; it was renamed to `current` without an alias, so shipped consumers writing
  `.active=${…}` or `<lr-app-rail-item active>` silently lost their current-item indicator and kept a
  permanent `aria-current="false"`. A Lit property binding on a custom element is untyped, so nothing
  in a consumer's type check or test suite could catch it. Prefer `current` in new code.
- `tooltip: boolean = false` (reflected) — opt-in hover/focus flyout (`[part='tooltip']`) showing
  this item's label text while the rail's `icon-only` mode (set externally by the parent
  `<lr-app-rail>` as the viewport narrows) hides it from view. No effect outside icon-only mode,
  since the label is already visible there. `false` (the default) reproduces the exact existing
  output.

A host `aria-label` is copied to the rendered native link or button by attribute presence,
including an explicitly empty value; without it, the default slot supplies the native name. The
same precedence supplies the tooltip text when that opt-in flyout is visible.

**Methods:** `click(): void` activates the internal native link or button; it is a no-op while
`disabled`.

If an `href`/`disabled` update replaces a focused link or button, focus follows an available native
replacement. When that replacement is disabled or inert, focus returns to the available element
that led into the item, or to the stable owning rail surface when no return target exists. A newer
external focus move is always preserved, and this repair dispatches no activation event.

**Slots:** default (the visible label), `icon` (the leading decorative icon, always hidden from
assistive technology and inert across its flattened subtree; the default slot or host `aria-label`
names the native control, which remains the sole action).

**CSS parts:** `base`, `icon`, `label`, `tooltip` (the hover/focus label flyout, only rendered while
`tooltip` is set, the item is `icon-only`, and it is hovered or focused).

**Themeable custom properties:** `--lr-app-rail-item-current-bg` (default
`var(--lr-color-brand-quiet)`) and `--lr-app-rail-item-current-color` (default
`var(--lr-color-brand)`) — background and text/icon color of the `current` (`aria-current="page"`)
item. Both are scoped to `[aria-current='page']` only and declared as inline `var()` fallbacks at
the point of use, never on `:host`, so either can be set on the item itself _or on any ancestor_ —
including on `<lr-app-rail>` or a wrapper above it, to tint every item's current state at once.
`::part(base)[aria-current='page']` is invalid CSS (Shadow Parts forbids an attribute selector after
`::part()`), so before these hooks the only lever was overriding the library-wide
`--lr-color-brand-quiet`/`--lr-color-brand` tokens, which repainted every other element reading
them. Unset, each falls back to the token its rule used before.
Ordinary interaction states are independently inheritable through
`--lr-app-rail-item-hover-bg`, `--lr-app-rail-item-hover-color`,
`--lr-app-rail-item-active-bg`, and `--lr-app-rail-item-active-color`, again retaining the former
brand/active-mix values as fallbacks.

**Optional peer deps:** none.

---

## `lr-responsive-panel`

The same slotted content either docked inline in its containing layout or presented as a
full-screen/bottom-sheet overlay, depending on the panel's allocated inline size. First-party
invention (no `wa-*`/`sl-*` counterpart).

**Properties:**

- `open: boolean = false` (reflected) — in the inline presentation this just means visible/mounted;
  in the overlay presentation this is the actual modal open/closed state.
- `mode: LyraResponsivePanelMode = 'auto'` (reflected) — `'auto'` tracks `overlay-breakpoint`
  against the component's allocation; `'inline'`/`'overlay'` force that presentation.
- `effectiveMode: LyraResponsivePanelEffectiveMode` (readonly) — the currently resolved
  `'inline'|'overlay'` presentation.
- `variant: LyraResponsivePanelVariant = 'fullscreen'` (reflected) — only affects the overlay
  presentation's visual treatment: `'fullscreen'` covers the whole viewport; `'bottom-sheet'`
  anchors to its block-end edge and does not cover the full height. Has no visual effect while the effective
  presentation resolves to `'inline'`.
- `label: string = ''` — accessible name for the overlay presentation's `role="dialog"`, used
  verbatim when set — but a plain `aria-label` attribute on the host wins outright over `label`
  when both are present, the standard ARIA convention for a consumer that wants full control over
  the announced name (matching `lr-dialog`'s `accessibleLabel` pattern). When both the host
  `aria-label` and `label` are empty, this falls back to the `header` slot's content: a heading
  element (`h1`–`h6` or `[role="heading"]`) among the slotted header content wins if present,
  otherwise the header slot's combined text content is used (mirrors `lr-dialog`'s
  `detectHeading()` fallback, via `aria-label` rather than `aria-labelledby` since the header
  content is light DOM while `[part="panel"]` is in shadow DOM). A panel opened with none of a host
  `aria-label`, `label`, or header content uses the localized `responsivePanel` fallback (`"Panel"`
  in the default locale), so its dialog is never unnamed. Unused in the inline presentation, which
  has no dialog semantics to name.
- `overlayBreakpoint: string = '768px'` (attribute `overlay-breakpoint`) — CSS length compared with
  the component's allocated inline size in `mode="auto"`; at or below it, the effective presentation
  is `'overlay'`.

**Methods:** `close(reason: LyraResponsivePanelCloseReason = 'api'): void` — requests a close by
emitting `lr-close` with `reason` before changing `open`. A listener can call `preventDefault()` to
keep the panel open; otherwise it sets `open = false` and — only in the overlay presentation —
returns focus to whichever element triggered the open. No-op if already closed. Built-in overlay
triggers call this with `'escape'`/`'backdrop'`; a consumer's own close affordance (a footer button,
a docked panel's own toggle) should call it directly with its own reason string.

**Events:** `lr-close` (`detail: LyraResponsivePanelCloseReason` = `'escape'|'backdrop'|'api'|string`;
cancelable pre-close veto, fired by the overlay presentation's built-in dismiss triggers — Escape,
backdrop click — and by any `close()` call, in either presentation; calling `preventDefault()` keeps
the panel open and leaves active overlay chrome/focus trapping intact. A plain `open = false`
property write does **not** fire it, only going through `close()` counts as a dismissal),
`lr-mode-change`
(`detail: LyraResponsivePanelModeChangeDetail` = `{ mode: LyraResponsivePanelEffectiveMode }`; fired whenever
the _effective_ mode — not the `mode` prop's possibly-`'auto'` literal value — changes between
`'inline'` and `'overlay'`; never fired on the initial render, only for a live change thereafter).

**Slots:** default (the panel body), `header` (optional header content, rendered above the body),
`footer` (optional footer content, e.g. action buttons, rendered below the body).

**CSS parts:** `base`, `backdrop`, `panel`, `header`, `body`, `footer` (`backdrop` is only rendered
in the overlay presentation).

**Themeable custom properties:** `--lr-responsive-panel-overlay-color` (default
`var(--lr-color-overlay)` — the overlay presentation's backdrop scrim color),
`--lr-responsive-panel-sheet-max-block-size` (default `85dvh`, falling back to `85vh` where `dvh`
isn't supported — the maximum height of a `variant="bottom-sheet"` overlay panel, so a long sheet
stops short of the top of the viewport instead of covering it; it has no effect on
`variant="fullscreen"` or on the inline presentation),
`--lr-responsive-panel-overlay-panel-bg` (default `var(--lr-color-surface-overlay)`), and
`--lr-responsive-panel-overlay-panel-shadow` (default `var(--lr-shadow-l)`). The latter two are
inherited inline fallbacks for `[part="panel"]` only while the effective presentation is overlay;
they do not affect inline panels. Plus shared tokens (`--lr-color-border`, `--lr-color-surface`,
`--lr-space-*`, `--lr-radius`, `--lr-shadow`).

**Optional peer deps:** none.

```html
<lr-responsive-panel
  id="settings-panel"
  label="Settings"
  variant="bottom-sheet"
  overlay-breakpoint="48rem"
>
  <span slot="header"><h2>Settings</h2></span>
  <div>Panel body content — a form, a list, anything.</div>
  <span slot="footer"
    ><button onclick="document.getElementById('settings-panel').close()">
      Done
    </button></span
  >
</lr-responsive-panel>
```

Breakpoint detection uses `ResizeObserver` on the component allocation. Resizing a parent layout
across `overlayBreakpoint` while `mode="auto"` updates the effective presentation without
unmounting or re-creating the slotted content.
Inline and overlay presentations share the same shadow DOM, so slotted content and scroll position
survive the transition. Focus already inside the panel is preserved. If focus is outside when an
open inline panel becomes an overlay, focus moves to the first composed focus target (falling back
to the panel), so it cannot remain behind `aria-modal="true"`. An allowed close restores the element
captured when the panel originally opened, even when that original open happened inline. The overlay
presentation participates in the shared modal stack rather than nesting a `<lr-dialog>`.

The granular route exports the pure
`resolveResponsivePanelEffectiveMode(mode: LyraResponsivePanelMode,
belowBreakpoint: boolean): LyraResponsivePanelEffectiveMode` resolver alongside the
`LyraResponsivePanelMode`/`LyraResponsivePanelEffectiveMode`/`LyraResponsivePanelVariant`/
`LyraResponsivePanelCloseReason`/`LyraResponsivePanelModeChangeDetail` types. It's the same logic
the element's allocation observer calls: `'inline'`/`'overlay'` pass straight through
unchanged; `'auto'` resolves to `'overlay'` when `belowBreakpoint` is true, `'inline'` otherwise —
exposed standalone so a consumer can compute or unit-test the same resolution without a real browser
window.

**Known gotchas:**

- assigning `open` directly still does not emit `lr-close` and therefore cannot be vetoed; use
  `close()` when the dismissal event/reason or a close guard is required. While overlay chrome is
  active, however, the `true` → `false` state transition restores opener focus regardless of
  whether it came from an allowed `close()` call, a property write, or attribute removal.
- crossing inline → overlay while already open preserves focus that is already inside and moves
  outside focus into the panel; do not expect focus to remain on page content behind the modal.
- `variant="bottom-sheet"` has no visible effect at all while the effective presentation is
  `'inline'` — it only changes the overlay presentation's anchoring/height.
- a reconnect that preserves the same element instance (e.g. a drag-and-drop reparent) resumes its
  shared overlay registration and re-acquires the scroll lock if overlay chrome was still active
  across the move — `disconnectedCallback`/`connectedCallback` fire back-to-back with no update in
  between, so `willUpdate()` alone wouldn't otherwise notice.
- `overlay-breakpoint` follows allocation, not the viewport. Use `mode="overlay"` for a deliberate
  viewport-modal policy independent of the component's containing layout.

---

## `lr-menu-label`

A non-interactive section heading inside `<lr-menu>`'s default slot. Mirrors `sl-menu-label`.

The host takes `role="presentation"` on connect (a `role="menu"` may only contain menu-item roles,
so a heading with a generic role would make the menu's own children invalid) — unless the consumer
already set a `role`, which is left alone. `<lr-menu>` enumerates its items by `instanceof
LyraMenuItem`, so a label is never enrolled in the roving tabindex and can never become a focus
stop; nothing on `<lr-menu>` has to know this element exists.

To announce a _named group_ rather than a caption, wrap the labelled items in an element with
`role="group"` and give it a matching `aria-label`. `aria-labelledby` pointing at this element's
internals would not resolve — idrefs do not cross a shadow boundary.

**Properties:** none. **Events:** none. **Slots:** default (the heading text).
**CSS parts:** `base` (the heading row).

**Themeable custom properties:** shared tokens only — `--lr-color-text-quiet`, `--lr-font-size-sm`,
`--lr-font-weight-semibold`, `--lr-space-xs`/`--lr-space-s`.

```html
<lr-menu>
  <lr-menu-label>Recently used</lr-menu-label>
  <lr-menu-item value="open">Open…</lr-menu-item>
</lr-menu>
```

---

## `lr-menu` / `lr-menu-item`

The inline semantic menu mapped from Shoelace's `sl-menu`, plus its action-row element. A root
`<lr-menu>` is always visible and owns the named `role="menu"` list, real roving DOM focus,
wrapping keyboard navigation, type-ahead, and one canonical selection event. It deliberately has no
trigger, positioned popup, root open state, placement API, or overlay lifecycle.

For a menu button or other anchored overlay, compose the semantic controller inside
`<lr-dropdown>`:

```html
<lr-dropdown label="Row actions">
  <button slot="trigger" aria-label="Row actions">⋮</button>
  <lr-menu>
    <lr-menu-item value="edit">Edit</lr-menu-item>
    <lr-menu-item value="delete" variant="danger">Delete</lr-menu-item>
  </lr-menu>
</lr-dropdown>
```

The dropdown shell owns trigger relationships, positioning, opening/closing, outside dismissal,
focus return, and lifecycle events. The contained menu remains the sole semantic owner: its
`header`/default/`footer` regions and named `role="menu"` list are preserved, while the outer popup
is neutral. This is also the composition used for direct `<lr-dropdown-item>` children.

### `lr-menu`

**Properties:**

- `label?: string` — accessible name for the `role="menu"` list. A host `aria-label`
  attribute is authoritative, including `aria-label=""`; any supplied `label` follows (including `"Menu"` or
  `""`),
  then a containing dropdown's supplied fallback, then the localized menu label. Omission,
  not comparison with an English sentinel, is what selects localization.
- `dropdownOpen: boolean = false` (attribute: false) — the containing dropdown's controlled open
  state, used to synchronize the menu interaction engine while it is rendered inside a popup.

**Events:**

- `lr-select` — cancelable, with `detail: { item }`. It originates exactly once at the menu that
  owns the activated item, then bubbles unchanged through ancestor menus and a containing dropdown.
  Preventing it anywhere keeps the current menu/submenu chain open. There are no
  `lr-menu-select`, `lr-menu-item-select`, or nested-selection aliases.

**Slots:** default (`<lr-menu-item>`/`<lr-dropdown-item>` plus semantic separators), `header`, and
`footer`. Header and footer are composed controls or explanatory regions outside the
`role="menu"` list, so filters, counts, or footer actions do not violate the menu required-child
contract. Arbitrary non-item content in the default slot still renders, but is not enrolled as a
menu item.

**CSS parts:** `header`, `list`, and `footer`. Root `trigger` and `popup` parts do not exist;
style those on `<lr-dropdown>` when using the overlay composition.

**Themeable custom properties:** shared surface, border, radius, spacing, and motion tokens. Row
chrome is controlled through the menu-item properties listed below.

**Methods:** no menu-specific public overlay methods. Use `<lr-dropdown>`'s `show()`/`hide()` and
`open` state for an overlay. Menu-item submenu methods remain public because they drive a row's
nested disclosure.

**Keyboard and focus:** exactly one navigable row has `tabindex="0"`. ArrowDown/ArrowUp wrap;
Home/End move to the first/last navigable row; Enter/Space activate; printable input performs
locale-aware type-ahead. Rows that are disabled, loading, hidden, `aria-hidden`, inert, or inside an
inert subtree are skipped. Navigation is repaired live when those states or light-DOM membership
change. A root inline menu does not consume Escape or turn Tab into overlay dismissal; a containing
dropdown owns those root-level behaviors.

### `lr-menu-item`

A focusable action row owned by `<lr-menu>`. The host itself carries `role="menuitem"` (or
`menuitemcheckbox`) and roving `tabindex`; `[part="base"]` is only the visual row.

**Properties:**

- `value: string = ''` — identifier available as `event.detail.item.value` on `lr-select`
- `size: '2xs' | 'xs' | 's' | 'm' | 'l' | 'xl' | 'small' | 'medium' | 'large' = 'm'`
- `disabled: boolean = false`
- `variant: 'default' | 'danger' = 'default'`
- `type: 'normal' | 'checkbox' = 'normal'`
- `checked: boolean = false` — meaningful only for `type="checkbox"`
- `loading: boolean = false`
- `hasSubmenu: boolean` (read-only)
- `submenuOpen: boolean = false` — transient live state; assigning it drives an existing submenu
  without moving focus and disconnect resets it

**Methods:**

- `click(): void` forwards programmatic activation through the visual-row path
- `select(): void` activates through the current owning menu; it is inert while disabled/loading
- `openSubmenu(focus: 'first' | 'last' | 'none' = 'first'): Promise<void>`
- `closeSubmenu(): Promise<void>`
- `getTextLabel(): string` returns the accessibility-visible label used by type-ahead

A checkbox activation first emits cancelable `lr-menu-item-change` with the proposed
`detail: { value, checked }`. Preventing that event retains the current checked state; the owning
menu's canonical `lr-select` still follows. A submenu parent is a disclosure instead of an action:
activation opens its submenu and emits neither checkbox-change nor selection.

**Events:**

- `lr-menu-item-change` — cancelable checkbox-state proposal
- `lr-menu-item-state-change` — internal navigation repair signal with
  `detail: { disabled, hidden, inert }`; the owning menu consumes and contains it, so it does not
  escape a menu or a composite wrapper as an apparent public event

Item activation itself is private owner plumbing, not a public child event. Listen for `lr-select`
on the owning menu.

**Slots:** default label, `icon`, `prefix`, `details`, `suffix`, and `submenu`. Display slots are
inert visual content; their accessibility-visible default-slot text names the focusable host. The
submenu slot accepts either one nested `<lr-menu>` or direct mapped items. Long `details` and
`suffix` content shrinks and ellipsizes within the allocated row in both directions rather than
expanding the popup.

**CSS parts:** `base`, `icon`, `prefix`, `label`, `details`, `suffix`, `checkmark`,
`checked-icon`, `spinner`, `spinner__base`, `submenu-icon`, and `submenu`.

**Themeable custom properties:** `--lr-menu-item-gap`, `--lr-menu-item-radius`,
`--lr-menu-item-danger-color`, `--lr-menu-item-danger-hover-bg`,
`--lr-menu-item-danger-active-bg`, and `--submenu-offset`, plus shared size/focus/color/spacing
tokens.

### Nested submenus

Both supported authoring shapes use the `submenu` slot:

```html
<lr-menu label="Share actions">
  <lr-menu-item value="share">
    Share
    <lr-menu slot="submenu" label="Share options">
      <lr-menu-item value="email">Email</lr-menu-item>
      <lr-menu-item value="link">Copy link</lr-menu-item>
    </lr-menu>
  </lr-menu-item>
</lr-menu>
```

```html
<lr-dropdown-item>
  Share
  <lr-dropdown-item slot="submenu" value="email">Email</lr-dropdown-item>
  <lr-dropdown-item slot="submenu" value="link">Copy link</lr-dropdown-item>
</lr-dropdown-item>
```

The submenu presentation is private to the parent row, not a second root-menu API. A submenu parent
has `aria-haspopup="menu"`, explicit `aria-expanded="true|false"`, the transient
`submenu-open` state, and a logical-direction chevron. Its submenu is named from the parent's
accessible label unless the submenu supplies its own `aria-label` or non-default `label`.

The into-branch and back-out arrow keys swap under RTL. Enter/Space and the into key open and focus
the first child; the back-out key and Escape close only the innermost branch and return focus to its
parent row. Pointer hover uses an intent delay, outside pointer dismissal closes the branch, and at
most one branch per level is open. Selection bubbles as the same single `lr-select`; a non-vetoed
selection closes the full nested chain.

### `lr-dropdown-item`

The Web Awesome-compatible name for the same item implementation. It shares all menu-item
properties, slots, parts, methods, checkbox/state events, roving focus, and canonical parent
`lr-select` behavior. Its host also exposes native, non-bubbling, composed `focus` and `blur`
events.

**Events:** native, non-bubbling, composed, non-cancelable `focus` and `blur` (`FocusEvent`) when
the focusable host gains or loses focus, plus the shared menu-item events above.

`submenuOpen` reflects to canonical `submenu-open`. HTML normalizes Web Awesome's documented
mixed-case spelling to `submenuopen`, so that lowercase token is a permanent compatibility alias.
Adding either spelling opens the submenu and synchronizes the other; removing either closes it and
removes both. Internal close paths — `closeSubmenu()`, Escape, outside dismissal, selection,
replacement, and disconnect — clear both spellings, preventing a persistent alias from reopening a
dismissed branch. An authored initial open request remains pending until submenu content connects.

### 9.0 migration

Root overlay behavior moved from `<lr-menu>` to `<lr-dropdown>`. Migrate mechanically:

- Move a former menu `trigger` slot and menu `open`, `placement`, `anchor`, or
  `close-on-escape-anywhere` policy to an enclosing `<lr-dropdown>`.
- Replace `menu.show()`/`menu.hide()` and menu `lr-show`/`lr-hide` listeners with the equivalent
  dropdown APIs/events.
- Replace `lr-menu-select` (`detail.value`) and `lr-menu-item-select` listeners with one
  `lr-select` listener on the menu or dropdown and read `event.detail.item`.
- Replace menu `::part(trigger)`/`::part(popup)` rules with dropdown part styling. Menu
  `header`/`list`/`footer` parts remain on the semantic controller.

Standalone mapped `<sl-menu>` markup needs no wrapper: the mechanical `sl-` → `lr-` tag rename
continues to produce an inline menu.

---

## `lr-dock-panel`

A single panel docked to one edge of whatever contains it, resizable by dragging its inner edge.
First-party invention (no `wa-*`/`sl-*` counterpart). Unlike `lr-multi-split` (which owns and lays out N
sibling panels, and requires restructuring a layout so every panel becomes its direct child), this is
one self-contained element you drop next to your existing content — typically as an absolutely-
positioned child of a `position: relative` parent, or as a flex item alongside a main-content sibling.
It deliberately imposes no `position`/`inset` of its own: it only manages its own size along the
resize axis (`inline-size` for `start`/`end`, `block-size` for `top`/`bottom`) and fills 100% of the
cross axis, leaving where it sits in the page entirely up to the consumer's own layout. `lr-multi-split`
stays the right primitive for the multi-sibling-panel case; this is the primitive for the single-edge-
docked case.

**Properties:**

- `edge: 'start' | 'end' | 'top' | 'bottom' = 'end'` (reflected) — which edge of the panel's own
  container it's docked to. `start`/`end` are logical-inline (mirror left/right depending on writing
  direction); `top`/`bottom` are block-direction and unaffected by RTL.
- `extent: string = '280px'` — the current docked size along the resize axis, as a CSS length.
- `minExtent: string = '160px'` (attribute `min-extent`) — minimum resize bound, as a CSS length.
- `maxExtent: string = ''` (attribute `max-extent`) — maximum resize bound. Empty means "no explicit
  cap": the live extent of the containing element is used instead (falling back to the viewport if
  there's no parent, e.g. not yet connected). An explicit maximum is still capped to that live
  containing extent, and an effective minimum above the maximum is reduced to the maximum, so the
  separator always exposes `min <= now <= max`.
- `collapsible: boolean = false` (reflected)
- `collapsed: boolean = false` (reflected)
- `resizable: boolean = true` (reflected) — when `false`, no drag handle renders at all and the panel
  is a fixed size. Its string-aware converter accepts `resizable="false"` as false despite the
  true default. A Lit property binding (`.resizable=${false}`) also disables it; a false
  boolean-attribute binding (`?resizable=${false}`) only removes the attribute and cannot override
  a true-defaulting property.

**Renamed in 8.0.0: `size`/`min-size`/`max-size` are now `extent`/`min-extent`/`max-extent`**, and
the then-current resize detail key moved with them (`{ size }` → `{ extent }`). Everywhere else in the library
`size` names a tier on the shared six-step ladder; here it was an arbitrary CSS length, which is the
collision the rename resolves. It is a clean rename with no alias, and it fails quietly in both
directions: `size="320px"` is now an unknown attribute the browser ignores, so the panel silently
renders at the `280px` default, and `event.detail.size` reads `undefined`.

**Exported types:** `LyraDockPanelEdge = 'start' | 'end' | 'top' | 'bottom'`, readonly
`LyraDockPanelResizeDetail = { extent: string }`, readonly
`LyraDockPanelCollapseChangeDetail = { collapsed: boolean }`, and `LyraDockPanelEventMap`.
The former dock-specific `parseLengthPx()` export is removed; dock length resolution is now a
private adapter over the library's canonical CSS-length resolver, with container/viewport units
resolved in the host's owner realm.

**Events:**

- `lr-resize-request` (cancelable; `detail: { extent }` is the proposed `px` CSS length string),
  fired before a discrete keyboard step commits and before a pointer drag's final settle commits.
  Call `preventDefault()` to reject it: a keyboard step simply does not apply, and a drag's final
  settle snaps the panel back to the size it had before that drag gesture began. Not fired for a
  continuous pointer drag's own intermediate ticks — checking a cancelable event on every
  `pointermove` would make a live drag visibly stutter — only its final settle on release.
- `lr-resize-input` — frozen `detail: { extent }` (a `px` CSS length string), fired for each genuine
  pointer or keyboard value transition. Fully clamped/no-op attempts emit nothing.
- `lr-resize-change` — a fresh frozen detail snapshot, fired exactly once on genuine `pointerup`
  after at least one value transition and the drag's `lr-resize-request` was not prevented, and
  after each genuine keyboard step whose own `lr-resize-request` was not prevented. `pointercancel`,
  lost capture, disconnect/adoption, live policy/geometry mutation, no-op attempts, and a prevented
  `lr-resize-request` all emit nothing.
- `lr-collapse-request` (cancelable; `detail: { collapsed }` is the state proposed by the built-in
  collapse toggle. Call `preventDefault()` to leave `collapsed` unchanged. Not fired when a
  consumer assigns `collapsed` directly), `lr-collapse-change` (non-cancelable; `detail: {
collapsed }` is the accepted built-in-toggle state. Not fired when a consumer assigns `collapsed`
  directly). Both details are fresh readonly/frozen snapshots.

The Lyra-original v9 event migration is mechanical: listen for `lr-resize-input` for live layout
feedback and `lr-resize-change` for persistence/telemetry instead of the removed `lr-resize` name.
Type imports likewise move from `DockPanel*` to `LyraDockPanel*`.

**Slots:** default — the panel's own content.

**CSS parts:** `base` (the panel root), `content` (wraps the default slot; hidden while `collapsed`),
`handle` (the draggable resize edge; only rendered when `resizable` and not `collapsed`),
`collapse-toggle` (only rendered when `collapsible`)

**Themeable custom properties:** `--lr-dock-panel-collapsed-size` (default
`var(--lr-icon-button-size)`) — the persistent "rail" width/height the panel holds at while
`collapsed`, rather than collapsing to zero (a zero-size collapsed panel would have nowhere to host
the re-expand toggle); component-specific since collapse never zeroes the box. The `collapse-toggle`
button and the resize `handle` used to share the bare `--lr-color-brand`/`--lr-color-brand-quiet`
tokens for their hover/pressed feedback even though they're unrelated visual purposes (button
affordance vs. drag affordance); each now has its own scoped override, all still defaulting to the
exact same colors as before: `--lr-dock-panel-collapse-toggle-hover-bg` (default
`var(--lr-color-brand-quiet)`) and `--lr-dock-panel-collapse-toggle-hover-color` (default
`var(--lr-color-brand)`) theme the toggle's hover state and are reused verbatim (color) or through
`color-mix()` (background) for its pressed state; `--lr-dock-panel-handle-hover-color` (default
`var(--lr-color-brand)`) themes the handle's hover/keyboard-focus state, and
`--lr-dock-panel-handle-active-color` (default a `color-mix()` of the hover color) themes it while
being dragged. Plus shared tokens `--lr-color-surface`, `--lr-color-border`, `--lr-color-brand`,
`--lr-color-brand-quiet`, `--lr-color-text`, `--lr-radius`, `--lr-space-xs`,
`--lr-focus-ring-width/-color/-offset`, `--lr-transition-fast`, `--lr-icon-button-size`.

**Optional peer deps:** none.

```html
<div style="position: relative; block-size: 100vh;">
  <lr-dock-panel edge="end" extent="320px" min-extent="200px" max-extent="480px" collapsible>
    <div>Sidebar content — a chat thread list, an inspector, anything.</div>
  </lr-dock-panel>
</div>
<script type="module">
  const panel = document.querySelector("lr-dock-panel");
  panel.addEventListener("lr-resize-input", (e) => updateLayoutPreview(e.detail.extent));
  panel.addEventListener("lr-resize-change", (e) => persistExtent(e.detail.extent));
  panel.addEventListener("lr-collapse-change", (e) => console.log(e.detail.collapsed));
</script>
```

Pointer-drag-resize admits only a primary pointer using its primary button, then mirrors
`lr-multi-split`'s pointer-capture technique (`pointerdown` captures the pointer on the handle;
`pointermove` computes a new size; `pointerup`/`pointercancel`/`lostpointercapture` all release it,
since a drag can end without a clean `pointerup`) but reasons in raw pixels throughout rather than
percent. A genuine interaction — pointer movement or a keyboard step
(<kbd>ArrowLeft</kbd>/<kbd>ArrowRight</kbd> for the inline axis, <kbd>ArrowUp</kbd>/<kbd>ArrowDown</kbd>
for the block axis, 16px per step) — commits `extent` as a rounded `px` string regardless of what
unit `extent`/`min-extent`/`max-extent` were originally expressed in. Passive container/bounds
reconciliation emits neither resize event and preserves an in-range authored relative unit.

**Known gotchas:**

- `collapsed` doesn't zero the panel's box — it shrinks to the persistent rail size
  (`--lr-dock-panel-collapsed-size`). `extent` itself is left untouched while collapsed, so
  re-expanding restores what it was unless the current bounds require a valid clamp.
- Parent or flex allocation shrink, direct out-of-range property writes, and live min/max changes
  reconcile atomically. A later container grow does not silently restore an extent that was clamped
  during shrink.
- `handle` only renders while `resizable && !collapsed`; `collapse-toggle` only renders while
  `collapsible` — a panel with both `false` renders neither control, just fixed-size slotted content.
  `resizable` and `collapsed` interact: dragging is disabled whenever `collapsed` is `true`, even if
  `resizable` is also `true`.
- The collapse-toggle's chevron rotates to point toward the panel's pinned edge when expanded (the
  direction clicking it will shrink toward) and away from it when collapsed — this is folded through
  both `edge` and, for `start`/`end`, current RTL-ness, so the same markup visually flips correctly
  under `dir="rtl"` with no extra author work.

---

## `lr-card`

A generic, styled bordered content container — the "small bordered surface with padding" idiom common
to hero highlights, clickable grid tiles, and management-list items. A direct `<lr-*>` counterpart
to `<wa-card>`'s contract, staying slot-compatible with `lr-result-card` where they overlap.

**Properties:**

- `appearance: 'accent' | 'filled' | 'outlined' | 'filled-outlined' | 'plain' = 'outlined'`
  (reflected) — `'outlined'` (the default) is a plain bordered surface; `'filled'` swaps the border
  for a quiet brand-tinted background; `'filled-outlined'` keeps the border and adds that same tinted
  background; `'accent'` drops the border for a single colored accent stripe on the leading edge;
  `'plain'` has no border or background at all.
- `orientation: LyraOrientation = 'vertical'` (reflected; the shared
  `'horizontal' | 'vertical'` layout axis) — vertical renders media,
  header/actions, body, and footer/footer-actions as sections. Horizontal arranges media/image,
  body, and `actions` in logical order and stacks them when the card's own container drops below
  30rem.
- `withHeader`, `withHeaderActions`, `withMedia`, `withFooter`, and `withFooterActions` (boolean,
  reflected as `with-header`, `with-header-actions`, `with-media`, `with-footer`, and
  `with-footer-actions`) — SSR presence hints. They expose an otherwise-empty section wrapper before
  slot assignment can be measured; populated slots are still detected automatically after hydration.
- `actionable: boolean = false` (reflected) — opt-in no-link whole-card action behavior: the hover/focus-visible
  treatment (border-color shift, `cursor: pointer`) plus, when `href` is **not** also set, real
  activation semantics. Those come from a real native `<button part="activation-button">` stretched
  across the card, not from making `[part='base']` itself focusable: it is the keyboard tab stop,
  it answers Enter and Space natively, and activating it emits `lr-card-activate`. With `href` set,
  a stretched sibling native `<a>` owns navigation, no activation button renders, and
  `lr-card-activate` never fires. Consumer slots stay outside that link, so their controls remain
  independent. A valid `href` is inherently actionable and receives the same interaction paint
  without this flag. `false` (the default) leaves a no-link card static: no button, listeners, or
  events.
- `accessibleLabel: string | null = null` (attribute `aria-label`) — the accessible name of the
  native whole-card owner: the activation button without `href`, or the stretched link with it.
  An explicitly empty value is retained; only an absent value falls back to card or linked content,
  so set it explicitly for a card whose content is an image or a chart.
- `href?: string` — when set, a real stretched `<a href=...>` renders behind the consumer slots for
  a whole-card link (e.g. a wide CTA tile). A click on noninteractive card content follows that
  link, while slotted controls keep their own native or Lyra behavior. Unset (the default) renders
  a plain `<div>`.
- `target?: string` — native anchor target, applied only while `href` resolves to a link. Setting it
  to `'_blank'` (or any other target) forces `noopener noreferrer` on the rendered anchor.
- `rel?: string` — author relationship tokens such as `nofollow`, `sponsored`, `me`, or `license`.
  `opener` is always stripped, other tokens are preserved, and any set `target` force-adds the
  non-negotiable `noopener noreferrer` floor. With no target, safe author tokens render unchanged.

**Events:** `lr-card-activate` (no detail) — the whole card was activated, by a click anywhere on it
or by Enter/Space on `[part='activation-button']`. Only fired while `actionable` is set **without**
`href`. Never fired for an interaction that originated in a slotted control, so a card can keep its
own action buttons (see the gotchas below).

**Methods:** `click(): void` activates the native whole-card owner: the linked anchor when `href` is
safe, or the activation button while `actionable` is set without a link. Passive cards remain
inert.

Changing `href` or `actionable` while the whole-card owner has focus transfers focus across the
link, activation button, and a programmatically focusable passive base. It never overrides a newer
external focus destination.

**Slots:** default (the card body), `header` (vertical header content), `media` and `image` (aliases
for media above the header vertically or at logical start horizontally), `footer` (vertical footer
content), `header-actions` and `footer-actions` (controls aligned with those vertical sections), and
`actions` (horizontal-card actions; retained as the legacy header-actions spelling vertically).

**CSS parts:** `base` (the outer container — a `<div>`, or a stretched `<a>` behind consumer slots
when `href` is set),
`activation-button` (the native whole-card action, rendered only while `actionable` without `href`;
it is absolutely positioned across the card, `pointer-events: none` so it never intercepts a click
meant for slotted content, and it owns the card's `:focus-visible` ring), `media` and `image`
(aliases on the wrapper around both media slots, hidden entirely when empty), `header` (wrapper around the `header` slot and
`actions`, hidden entirely when both are empty), `actions` (wrapper around the `actions` slot,
hidden entirely when empty), `body` (wrapper around the default slot), `footer` (wrapper around the
`footer` and `footer-actions` slots, hidden entirely when both are empty).

**Themeable custom properties:** `--spacing` (default `var(--lr-space-m)`) controls the padding and
gap around card sections. Shoelace-compatible `--padding` is its fallback; `--border-color`,
`--border-radius`, and `--border-width` control the outer and section borders. Otherwise shared
tokens — `--lr-color-border`/`-surface`/`-brand`/
`-brand-quiet`, `--lr-radius`, `--lr-space-s`/`-m`, `--lr-transition-fast`,
`--lr-focus-ring-*`.
Appearance and interaction paint can be rethemed independently through `--lr-card-filled-bg`,
`--lr-card-filled-outlined-bg`, `--lr-card-accent-border-color`,
`--lr-card-interactive-hover-border-color`, `--lr-card-interactive-active-border-color`, and
`--lr-card-interactive-active-overlay`. They inherit from ancestors and fall back to the exact
former brand and active-mix values when unset.

**Optional peer deps:** none.

```html
<lr-card appearance="outlined" href="/reports/42" with-media with-header>
  <img slot="image" src="/thumb.png" alt="" />
  <span slot="header">Q3 Report</span>
  <span slot="header-actions"><lr-chip tone="success">Ready</lr-chip></span>
  Revenue up 12% quarter-over-quarter.
  <span slot="footer">Updated 2 days ago</span>
  <button slot="footer-actions" type="button">Download</button>
</lr-card>
```

**Known gotchas:**

- every `appearance` renders on the _same_ `[part="base"]` element — there's no separate element per
  variant, so a `::part(base)` override applies uniformly regardless of `appearance`.
- **a card clips, it does not scroll — and it never picks a scroll owner for you.** `[part='base']`
  stretches to the host's allocated block-size and clips its overflow, which is what keeps a
  full-bleed `media`/`image` child inside the rounded border. In an auto-sized row the card simply
  grows and nothing is clipped; give it a _definite_ allocation (a fixed grid row, an explicit
  `block-size`) and body content taller than that allocation is clipped silently, with no
  scrollbar. Neither upstream card exposes an overflow, block-size, or scroll hook and neither does
  this one: the public `body` part already carries the whole decision, and a `::part()` rule from
  your tree wins over the shadow stylesheet regardless of specificity. A fixed-height tile that
  must hold more content says so itself:

  ```css
  .tile-grid {
    display: grid;
    grid-template-rows: 12rem;
  }
  .tile-grid lr-card::part(body) {
    overflow: auto;
    overscroll-behavior: contain;
  }
  ```

  `overflow` other than `visible` also zeroes the body's automatic minimum size, so that one
  declaration is enough — the body shrinks into the tile and scrolls, and `max-block-size` /
  `scrollbar-gutter` stay available on the same rule. The linked (`href`) card behaves identically.
- slot-presence (`header`/`media`/`image`/`footer`/`actions`/`header-actions`/`footer-actions`) is
  tracked in JS, not via CSS `:empty` (a
  `[part]` wrapper always contains a literal `<slot>` child, so `:empty` never matches) — the same
  pattern `lr-empty`/`lr-widget` use.
- The `with-*` hints force section presence; do not set one for a section that should stay absent.
  They are safe to leave in server-rendered markup once hydrated, because actual slot detection is
  combined with—not substituted for—the hints.
- Horizontal orientation intentionally omits the vertical header/footer presentation and uses the
  `actions` slot beside the body. Its 30rem breakpoint is a container query on the card allocation,
  not a viewport media query, so the same card can be horizontal in a wide region and stacked in a
  narrow sidebar on one page.
- **`[part='base']` itself deliberately carries no `role="button"` and is not focusable.** A card is
  a _container_ — it routinely holds slotted buttons and links — and `role="button"` around
  focusable descendants is the `nested-interactive` accessibility violation this library's own a11y
  gate enforces. (`lr-chip`'s `toggleable` mode _can_ carry `role="button"` because it forbids
  focusable children outright.) The whole-card action is therefore a _sibling_ of the slotted
  content — `[part='activation-button']` — so the actionable roles are never nested inside one
  another, and the card still announces as a real button rather than as an unnamed focusable region.
- because the base element carries no `role="button"` to disambiguate, "did the user aim at the card
  or at a control inside it?" is answered at event time: the composed path from the original target
  up to `[part='base']` is walked, and `lr-card-activate` is suppressed if anything along the way is
  itself a control (a link, `button`, `input`, `select`, `textarea`, `label`, `summary`,
  `contenteditable`, anything carrying a `tabindex` other than `-1`, or an ARIA widget role such as
  `button`/`link`/`checkbox`/`switch`/`radio`/`menuitem`/`option`/`tab`/`textbox`/`slider`/
  `spinbutton`). Using the _composed_
  path is what makes this work through a slotted component's own shadow root — a click on
  `<lr-button>` retargets to the host, but its composed path still contains the internal native
  `<button>`.
- a click whose composed path starts on `[part='activation-button']` skips that walk entirely and
  always activates — it _is_ the whole-card action, so there is nothing to disambiguate.
- with `href`, `[part='base']` is a stretched real anchor sibling behind the visible content rather
  than an ancestor of it. Clicks from noninteractive slotted content are delegated to that anchor;
  composed-path arbitration leaves native and Lyra buttons, links, and fields independent. The
  linked example's `Download` button therefore does not navigate the card.

---

## `lr-command-palette`

Searchable application command menu. Renders nothing at all while closed. Uses the same shared
overlay infrastructure as `lr-dialog` (focus-trapping Tab, Escape dismissal, backdrop-click
dismissal, ref-counted document scroll lock).

**Properties:**

- `open: boolean = false` (reflected) — after the initial silent render, property and attribute
  writes use the same synchronous cancelable transaction as `openPalette()`/`close()`; a veto
  restores reflection and prevents query/active-row opening side effects
- `commands: readonly LyraCommand[] = []` (attribute: false) — `{ commandId, label, description?, group?,
shortcut?, keywords?: readonly string[], disabled?, icon?, onSelect? }`. The sequence is copied,
  bounded, and frozen while each command object's identity is retained for `onSelect`; create and
  reassign a new command array after sequence or row changes. `commandId` is a stable business identity and
  must be nonempty and unique; invalid rows are omitted and the first duplicate wins. Replacing or
  reordering the array preserves the active command by `commandId`. `icon` is an optional leading glyph (a `TemplateResult`,
  an emoji string, etc. — not restricted to a square icon) rendered in the `icon` part before the
  label; a command with no `icon` renders no `icon` part at all. Filtering is case-insensitive
  substring matching over `label` + `description` + `group` + `keywords` joined together (not
  fuzzy/subsequence), memoized per `commands` array identity — reassign the array, never mutate it
  in place. Consecutive commands sharing a `group` render one `[part='group']` heading, so pre-sort
  by group yourself.
- `hotkey: string = 'mod+k'` — exact global activation chord parsed as `+`-separated parts; `mod`
  resolves to Cmd on Mac and Ctrl elsewhere. Detection prefers Client Hints, then falls back to
  the legacy platform string and reduced user-agent string rather than trusting
  `navigator.platform` alone. Repeats, composition keys, and extra modifiers do not match. If
  several connected palettes use the same chord, the last connected palette owns it;
  activation is idempotently open rather than a toggle.
- `accessibleLabel: string = ''` (attribute `aria-label`) — overrides the localized dialog name

**Methods:** `openPalette()` (after an accepted open, clears the query and resets the active row;
no-op if already open),
`close()`, `registerCommand(command)` — appends to `commands` and returns an unregister function.

**Keyboard:** ArrowUp/ArrowDown move the active option, skipping `disabled` rows and clamping (not
cycling) at the ends; the active row is scrolled into view. Enter selects. Hovering a non-disabled
row also makes it active.

**Events:** `lr-open`, `lr-close` (both `detail: undefined`, cancelable — fired before the
mutation, `preventDefault()` keeps the palette in its current open state), `lr-select`
(`detail: { command }`, fired before the command's own `onSelect` runs and before the palette
closes), and no-detail `focus`/`blur` events re-dispatched from the host whenever the search input
gains or loses focus. The `focus`/`blur` bridge is new in 10.0.0: native `focus`/`blur` neither
bubble nor cross the shadow boundary, so a host-level `el.addEventListener('focus', …)` previously
never fired at all.

**Slots:** none.

**CSS parts:** `backdrop`, `dialog` (the `role="dialog" aria-modal="true"` panel), `search` (the
input row), `input` (the `type="search"` field), `list` (the `role="listbox"`), `group` (a group
heading), `command-group` (a labeled ARIA group of commands), `command` (a `role="option"` button),
`icon` (a command's leading icon glyph; only rendered when the command has one), `label`,
`description`, `shortcut`, `list-spacer` (the virtual result extent), `empty`.

**Themeable custom properties:** `--lr-command-palette-z-index` (default
`var(--lr-overlay-stack-index, var(--lr-layer-modal))`), `--lr-command-palette-offset-block-start`
(default `12vh` — how far down the viewport the dialog sits), `--lr-command-palette-max-inline-size`
(default `var(--lr-size-48rem)`), `--lr-command-palette-max-block-size` (default `70vh`),
`--lr-command-palette-list-max-block-size` (default `50vh` — the scrolling result list), and
`--lr-command-palette-active-bg` (default `var(--lr-color-brand-quiet)` — the background of the
active, keyboard-highlighted command row). That last one is an inline `var()` fallback at the point
of use rather than a `:host` declaration, so it can be set on the element _or on any ancestor_:
`::part(command)[data-active='true']` is invalid CSS (Shadow Parts forbids an attribute selector
after `::part()`), so highlighting the active row previously required hijacking the library-wide
`--lr-color-brand-quiet` token and repainting everything else that read it. Unset, it falls back to
that token, so rendering is unchanged.

**Additional API surface:**

- `part="command-group"` — A labeled ARIA group containing visible command options.
- `part="list-spacer"` — Virtual result extent inside the scrolling list.
- `--lr-command-palette-row-height` — Virtual command-row height. Default: `var(--lr-size-3rem)`.
  Its live resolved value drives the painted height, row transforms, keyboard-scroll coordinates,
  and result extent together.
- `--lr-command-palette-group-height` — Virtual group-heading height. Default:
  `var(--lr-size-2rem)`. Its live resolved value drives heading/row transforms and the result extent
  together.

## `lr-details`, `lr-accordion`, and `lr-accordion-item`

`lr-details` is a native-semantics disclosure panel; it mirrors `wa-details` / `sl-details`.
`lr-accordion` and `lr-accordion-item` mirror `wa-accordion` / `wa-accordion-item`: the group owns
mode, presentation, lifecycle events, and roving focus, while each item renders a heading button
and animated panel. The two components intentionally keep distinct vocabularies: accordion items
use `expanded`, `label`, and `expand()`/`collapse()`/`toggle()`, while `open`, `summary`, and
`show()`/`hide()` belong only to Details.

**Breaking in 9.0.0:** an accordion coordinates direct `lr-accordion-item` children only. Direct
`lr-details` panels used to be accepted as well; they are not any more. A `lr-details` slotted into
an accordion today is ordinary content owning its own disclosure lifecycle — the group applies
neither its presentation, nor its single-panel invariant, nor its roving keyboard model, nor its
`lr-expand`/`lr-collapse` lifecycle to it, and `expandAll()`/`collapseAll()` skip it. Migrate both
the tag and its member vocabulary: `<lr-details summary="..." open>` becomes
`<lr-accordion-item label="..." expanded>`, and `show()`/`hide()` become
`expand()`/`collapse()`. `lr-details` on its own, outside an accordion, is unchanged.

**Accordion properties:**

- `mode: 'single' | 'single-collapsible' | 'multiple' = 'multiple'` (reflected). `multiple` allows
  any number of expanded items. `single` permits at most one and activating the expanded item is a
  no-op. `single-collapsible` permits at most one but allows zero.
- `iconPlacement: 'start' | 'end' = 'end'` (attribute `icon-placement`, reflected),
  `headingLevel: string = '3'` (attribute `heading-level`, reflected; `1`–`6` select that heading,
  `none` omits it, and every other value renders the documented h3 fallback), and
  `appearance: 'filled' | 'outlined' | 'filled-outlined' | 'plain' = 'outlined'` (reflected). The
  group applies all three to each direct `lr-accordion-item` whenever children or properties
  change.

**Accordion-item properties:** `label: string = ''`, `expanded: boolean = false` (reflected),
`disabled: boolean = false` (reflected), plus the same `iconPlacement`, `headingLevel`, and
`appearance` properties listed above. **Removed in 9.0.0:** inherited Details members `open`,
`summary`, `name`, `size`, `show()`, and `hide()`; use the canonical accordion-item members or use
`lr-details` when the Details contract is required. Accordion expansion policy likewise has one
authority: migrate `multiple` to `mode="multiple"`, and `multiple="false"` to the intended
`mode="single"` or `mode="single-collapsible"` behavior.

**Details properties:** `open: boolean = false` (reflected), `disabled: boolean = false`
(reflected — blocks activation and sets `aria-disabled="true"`; its native summary uses
`tabindex="-1"` while disabled so sequential navigation matches a disabled accordion-item
trigger), `summary: string = ''`, `name: string = ''` (reflected — disclosures with the same
non-empty name in one document or shadow root are mutually exclusive),
`appearance: 'filled' | 'outlined' | 'filled-outlined' | 'plain' = 'outlined'` (reflected),
`iconPlacement: 'start' | 'end' = 'end'` (attribute `icon-placement`, reflected and logical), and
`size`.

A host `aria-label`, when present, names the actual Details summary or accordion-item trigger;
it wins over summary/label content even when explicitly empty. When the host attribute is absent,
Details and accordion-item property/localized fallbacks keep their native name-from-content
behavior. An active accordion-item `label` slot contributes its normalized
accessibility-visible text as the trigger's explicit name; its rendered subtree is inert and hidden
from assistive technology so the trigger remains the sole action.

`size: '2xs' | 'xs' | 's' | 'm' | 'l' | 'xl' | 'small' | 'medium' | 'large' = 'm'` (reflected, new
in 8.0.0) is the library's shared size ladder, so a disclosure scales with the controls around it
instead of being the one fixed-density element in a compact panel. Both spellings of every tier are
accepted — `s`/`small`, `m`/`medium`, `l`/`large` — so markup migrated from either upstream needs no
attribute rewrite. `m` is the default and reproduces the disclosure this component had before `size`
existed. The tier drives two custom properties (below) rather than any `::part()` rule, so a tier
the ladder doesn't cover is a two-line override rather than a fork.

**Methods:**

- Accordion: `expandAll()` expands every direct enabled item only in `multiple` mode;
  `collapseAll()` collapses every direct expanded item. Nested accordion items are never included.
- Accordion item: `expand(): Promise<void>`, `collapse(): Promise<void>`, and
  `toggle(): Promise<void>` initiate the corresponding transition and settle after its rendered
  motion. Disabled items are unchanged. `focus()` and the host's `click()` target the trigger.
- Details: `show(): Promise<void>` expands and `hide(): Promise<void>` collapses. Each promise
  settles after its matching `lr-after-show` or `lr-after-hide`; a vetoed, disabled, or
  already-satisfied request resolves without changing state. Assigning `open` runs the same
  Details lifecycle. `show()` is a no-op while disabled; `hide()` can still close a disabled
  Details panel.

**Events:**

- `lr-expand`, `lr-collapse`, `lr-toggle-request`, `lr-after-expand`, `lr-after-collapse` —
  accordion group lifecycle.
- `lr-show`, `lr-hide`, `lr-toggle`, `lr-after-show`, `lr-after-hide` — Details lifecycle only.

On the accordion, `lr-expand` and `lr-collapse` fire before a direct item changes, are cancelable,
and carry `detail: { item }`. **New in 10.0.0:** a cancelable `lr-toggle-request`
(`detail: { collapsed, item }`) fires alongside the matching directional event for every transition,
including sibling auto-collapses in `single`/`single-collapsible` mode and `collapseAll()`. It carries
the direction in the detail rather than the event name, matching `<lr-code-block>`/`<lr-chat-message>`'s
`lr-toggle-request` convention, plus an `item` reference the single-panel siblings do not need (an
accordion's toggling entity is one of several children, so the event target alone cannot identify it).
`preventDefault()` on **either** event vetoes the transition — the two are a symmetric veto pair, not
a primary and a notification. Note `<lr-thinking-panel>`'s own `lr-toggle-request` spells its detail
`{ expanded }` rather than `{ collapsed }`; the two conventions are not fully unified. **Changed in 9.0.0:** `item` is now always a `LyraAccordionItem` —
it could previously also be a `LyraDetails`. The exported `LyraAccordionPanel` union that spelled
that has been removed; use `LyraAccordionItem`. An accepted transition finishes with the
non-cancelable
`lr-after-expand` or `lr-after-collapse`, carrying the same item. In `single` mode, activating the
already-expanded item is a no-op and emits no collapse lifecycle. Nested accordions own their own
triggers; an outer group does not close siblings or emit its own lifecycle for an inner item. Item
methods and group methods use this lifecycle too. When opening an item in a single mode, the previously expanded
sibling's cancelable collapse is consulted before the new panel changes state; vetoing it keeps the
old item open and cancels the new expansion, so the group never silently violates its one-item
invariant.

The Details events `lr-show` and `lr-hide` have no detail payload and are cancelable; preventing
either leaves the panel in its previous state. Accepted changes emit `lr-toggle` with
`detail: { open, source }`, then the non-cancelable `lr-after-show` or `lr-after-hide` once
rendering and motion settle. `source` is `user` for a summary click or keyboard activation,
`programmatic` for `show()`, `hide()`, or assigning `open`, and `peer` when another Details with
the same non-empty `name` closes this one. The full orders are `lr-show` → `lr-toggle` →
`lr-after-show` and `lr-hide` → `lr-toggle` → `lr-after-hide`. Initially open markup emits
nothing, and an interrupted transition drops its stale after-event. The `animating` CSS custom
state is present only between an accepted state change and that settled boundary, and is cleared
when the element disconnects.

**Keyboard:** each direct enabled accordion item contributes one heading button. Exactly one is in
the tab order; ArrowDown/ArrowUp move cyclically, horizontal arrows provide the same next/previous
movement and swap under RTL, and Home/End jump to the first/last enabled item. Disabled items are
skipped. Enter and Space use the native button activation contract. Focus and key handling stay
inside the nearest nested accordion.

**Slots:** accordion has a default slot for direct items. Accordion item has default panel content,
`label`, and `icon`; `label` slot → `label` property → localized `"Details"` is the precedence
order. The label slot accepts rich visible markup, but its flattened subtree is inert and hidden
from assistive technology: do not place independent links, buttons, inputs, form state, or focus
targets there. The accordion-item `icon` slot follows the same flattened-tree inert and aria-hidden
visual contract, while the trigger button remains the sole action. Details has `summary`,
`header-actions`, `expand-icon`, `collapse-icon`, plus default content. `header-actions` renders
extra controls (e.g. a trailing "add" button) as a peer of the summary row, never a descendant of
the native `<summary>` toggle target — nesting an interactive control inside `summary` would make
every press on it also toggle the panel. Its wrapper is hidden and reclaims layout space whenever
the slot is empty.

**CSS parts:** accordion exposes `base`. Accordion item exposes `base` and `accordion-item` on the
same outer wrapper, plus `heading`, `button`, `label`, `icon`, `panel`, and `content`. Details
exposes `base` and `details` on the same native `<details>` wrapper, plus `header`, `summary`,
`icon`, `header-actions`, and `content`.
The Details icon wrapper also carries Shoelace's `summary-icon` alias, so either part name styles
the same node. `header-actions` is the wrapper around the `header-actions` slot.

**Themeable custom properties:** accordion item exposes `--lr-accordion-item-spacing` (default
`var(--lr-form-control-padding-inline)`), `--lr-accordion-item-show-duration` and
`--lr-accordion-item-hide-duration` (both default `var(--lr-duration-base)`), and
`--lr-accordion-item-easing` (default `var(--lr-easing-standard)`). The mapped unprefixed names
`--spacing`, `--show-duration`, `--hide-duration`, and `--easing` remain accepted aliases and win
when set. Panel and icon transitions stop under `prefers-reduced-motion: reduce`.

Accordion appearance paint is independently inheritable: `--lr-accordion-outlined-bg` (default
`var(--lr-color-surface)`) and `--lr-accordion-outlined-border-color` (default
`var(--lr-color-border)`); `--lr-accordion-filled-bg` (default
`var(--lr-color-surface-raised)`) and `--lr-accordion-filled-border-color` (default `transparent`);
and `--lr-accordion-filled-outlined-bg` (default `var(--lr-color-surface-raised)`) plus
`--lr-accordion-filled-outlined-border-color` (default `var(--lr-color-border)`). Direct item
surfaces have matching `--lr-accordion-item-outlined-bg`, `--lr-accordion-item-filled-bg`, and
`--lr-accordion-item-filled-outlined-bg` hooks with the same surface fallbacks. Item trigger paint
uses `--lr-accordion-item-button-hover-bg` (default `var(--lr-color-brand-quiet)`) and
`--lr-accordion-item-button-active-bg` (default the existing active `color-mix(...)`). These hooks
are read as inline fallbacks rather than declared on the host, so an ancestor theme can set them.

Details exposes `--lr-details-font-size` (default
`var(--lr-form-control-font-size)`) — the text size of both the summary and the panel.
`--lr-details-spacing` (default `var(--lr-form-control-padding-inline)`) — the block rhythm: the
summary's block padding and the panel's trailing padding, kept equal so a stack of disclosures reads
evenly. Each `size` tier changes both private defaults from the shared ladder; a public value on an
ancestor or the element remains authoritative. Note that the spacing knob
deliberately reads the ladder's _inline_-padding value: a stacked panel wants generous block rhythm,
whereas the ladder's own block padding exists to fit text inside a fixed control height and would
collapse the summary row. `--spacing` aliases the Details rhythm, while `--show-duration` and
`--hide-duration` (both default `var(--lr-duration-base)`) tune its icon transitions. Motion stops
under `prefers-reduced-motion`, so the `lr-after-*` events still settle promptly in that branch.
`--lr-details-gap` (default `var(--lr-space-s)`) independently controls the summary content/icon
gap, and `--lr-details-radius` (default `var(--lr-radius)`) controls the surface corners. Both use
inline fallbacks, inherit from ancestors, and remain independent of the `size` density ladder.
Details surface paint uses `--lr-details-outlined-bg` / `--lr-details-outlined-border-color`,
`--lr-details-filled-bg` / `--lr-details-filled-border-color`, and
`--lr-details-filled-outlined-bg` / `--lr-details-filled-outlined-border-color`; their defaults are
respectively the existing surface/border, brand-quiet/transparent, and brand-quiet/border values.
Summary interaction paint uses `--lr-details-summary-hover-bg` (default
`var(--lr-color-brand-quiet)`) and `--lr-details-summary-active-bg` (default the existing active
`color-mix(...)`). All eight are inheritable inline-fallback hooks, so they isolate one disclosure
theme without requiring shared-token changes or shadow-part selectors.

```html
<lr-details summary="Advanced options">Panel content</lr-details>
<script type="module">
  const panel = document.querySelector("lr-details");
  let ready = false;
  // Cancelable: veto the open until some precondition is met.
  panel.addEventListener("lr-show", (e) => {
    if (!ready) e.preventDefault();
  });
  panel.addEventListener("lr-after-show", () =>
    panel.querySelector("input")?.focus()
  );
  ready = true;
  await panel.show();
</script>
```

```html
<lr-accordion
  mode="single-collapsible"
  icon-placement="start"
  heading-level="2"
>
  <lr-accordion-item label="Account" expanded
    >Profile settings</lr-accordion-item
  >
  <lr-accordion-item>
    <strong slot="label">Notifications</strong>
    Notification settings
  </lr-accordion-item>
</lr-accordion>
<script type="module">
  const accordion = document.querySelector("lr-accordion");
  accordion.addEventListener("lr-expand", (event) => {
    if (event.detail.item.disabled) event.preventDefault();
  });
</script>
```

## `lr-breadcrumb` and `lr-breadcrumb-item`

Responsive navigation trail primitives.

**`lr-breadcrumb` properties:** `label: string = ''` names the trail, falling back to the localized
`"Breadcrumb"`; `accessibleLabel: string = ''` (attribute **`aria-label`**) overrides both. The
shadow-root `<nav>` landmark never inherits a host attribute on its own, so the value is copied onto
it. **Fixed in 9.0.0:** the property used to be declared but never read — only the literal host
`aria-label` attribute reached the landmark, so `el.accessibleLabel = 'Docs trail'` type-checked and
did nothing. Both spellings now work, with an authored host attribute still winning (including an
explicitly empty `aria-label=""`, which stays empty rather than falling back).

**`lr-breadcrumb-item` properties:** `href: string = ''` (URL-sanitized; an unsafe scheme renders the
non-link form; assigning `undefined` clears it and reads back as the canonical `''`),
`target?: LyraBreadcrumbItemTarget`, and `current: boolean = false` (reflected — renders a
`<span aria-current="page">` instead of an `<a>`, even when `href` is set). A target derives
the mandatory `noopener noreferrer` floor. `rel: string = 'noreferrer noopener'` is independently
settable: author tokens are preserved, `opener` is stripped, and any target force-adds the floor. Each item
sets `role="listitem"` on itself. A non-current item without `href` renders a native button. A host
`aria-label` is forwarded to either non-current native owner by attribute presence, including an
explicitly empty value; when absent, the default slot supplies its name.

**`lr-breadcrumb-item` methods:** `click(): void` activates the internal native link or button. It
is a no-op for the current-page label.

Changing `href` or `current` while that native owner has focus transfers focus across the link,
button, and programmatically focusable current-page label. External focus is preserved.

**Slots:** breadcrumb's default slot takes `lr-breadcrumb-item` children and its `separator` slot is
copied to every item without an item-level override. Both breadcrumb and item `separator` slots are
decorative-only: their rendered content is inert and hidden from assistive technology, so it must not
provide interactive behavior, a focus target, or form state. Generated shared copies omit identifiers,
ID-reference relationships, form associations, and submission attributes. Source text, attributes,
and compatible subtrees update live; identity-compatible clone nodes are patched in place instead of
being disconnected and recreated. The first owned breadcrumb item is determined independently of
separator sources or other auxiliary siblings, so it never renders a leading separator. An item's default slot is
its label; `start`/`prefix` and `end`/`suffix` are the two upstream adornment vocabularies, and
`separator` overrides the `/` fallback.

**CSS parts:** breadcrumb `base` and `breadcrumb` are aliases on the same `<nav>`; `list` is the
`role="list"` flex row wrapping the slotted items; item `base` (the `<a>`, `<button>`, or current
`<span>`), `label`,
`separator`, and the alias pairs `start`/`prefix` and `end`/`suffix`.
Interactive link/button bases retain a 24px minimum target in both axes even with empty content;
the inert current-page label remains content-sized.

**Themeable custom properties:** `--lr-breadcrumb-current-color` (default
`var(--lr-color-text-quiet)`) — text color of the current-page item (`current`/`aria-current="page"`).
It is an inline `var()` fallback at the point of use rather than a `:host` declaration, so it can be
set on the item, on `<lr-breadcrumb>`, or on any ancestor above the trail:
`::part(base)[aria-current='page']` is invalid CSS (Shadow Parts forbids an attribute selector after
`::part()`), so tinting the current item previously meant overriding the library-wide
`--lr-color-text-quiet` token and repainting everything else that read it. Unset, it falls back to
that token.
`--lr-breadcrumb-item-active-bg` independently themes a non-current link/button's pressed fill;
unset, it retains the former transparent active mix.

**Additional API surface:**

- `part="separator"` — Decorative separator shown before non-first items.

## `lr-dashboard-grid`

Responsive, keyboard-accessible controlled widget grid. It positions layout entries and emits
move, resize, collision, and layout-change requests; the host owns persistence and applies updates.

**Properties:** `layout: readonly LyraDashboardCell[] = []` (attribute: false, never mutated by the component),
`columns: number = 12`, `rowHeight: number = 80` (px, also the row snap pitch), `gap: number = 8`
(px, both axes), `collision: 'reject' | 'push' | 'overlap' = 'reject'`, `cellsDraggable: boolean = false`
(attribute `cells-draggable` — pointer drag plus Ctrl/Cmd+Arrow), `cellsResizable: boolean = false`
(attribute `cells-resizable` — the resize handle plus Ctrl/Cmd+Shift+Arrow), `locked: boolean =
false` (reflected — disables every gesture grid-wide), `accessibleLabel: string | null = null`
(attribute `aria-label`, falls back to a localized grid name).

**Events:** `lr-cell-move` (`detail: { cellId, position, previous }`), `lr-cell-resize`
(`detail: { cellId, size, previous }`), `lr-collision`
(`detail: { cellId, collidedCellIds, policy, accepted }`),
`lr-layout-change` (`detail: { layout }`, the full proposed layout after an accepted change).
The collection-bearing collision and layout-change details are detached and recursively frozen;
listeners apply changes by creating and assigning a new layout.
Rejected-collision feedback is appended immediately to the shared light-DOM polite announcement
sink. Accepted move/resize success is appended only after a later controlled `layout` assignment
contains the requested target geometry; ignoring a request never announces a change that did not
happen. All feedback remains silent while the grid or a composed ancestor is excluded from the
accessibility tree.
**Slots:** `cell-{cellId}`. **CSS parts:** `base`, `cell`, `empty`, `resize-handle`, `live-region` (an
`aria-hidden` shadow mirror of the latest spoken message).

`layout` is normalized into an immutable snapshot before rendering. Reads are bounded to the first
1,000 positions; foreign-realm arrays are accepted; malformed records, hostile accessors, and later
duplicate cell IDs are skipped without discarding valid neighbors. Geometry and min/max constraints
are finite and consistent, and neither the returned array nor its cells alias caller-owned objects.
Each admitted `cell.widget` is also copied immediately through the canonical bounded widget-document
factory: its node records, child arrays, and prop records are frozen without cloning opaque prop or
payload leaves. A hostile or malformed widget is omitted while its otherwise-valid cell remains.
Direct light-DOM children with `cell-id` remain the authored source of truth across insertion,
removal, cell-ID retargeting, reconnect, and document adoption. The first authored child for a cell
ID wins; when it disappears, the default cell is restored without mistaking a forged marker
attribute for a library-owned node.

The default content assigns a version-two document created from `cell.widget` to
`<lr-widget-renderer>.document`; it never uses the legacy `tree` input. Pointer gestures admit only
the primary button/pointer and ignore controls, links, labels, editable content, and interactive
roles in the composed path. Keyboard resizing uses physical directions in both LTR and RTL:
Right/Down grow and Left/Up shrink, while pointer resizing retains the logical inline-end handle.

In the narrow stacked layout, a cell that currently owns a resize handle keeps at least the shared
interactive-action block-size (`--lr-icon-button-size`). The handle is absolutely positioned and
cannot contribute intrinsic size itself; the state-aware floor prevents it from overlapping the
preceding cell or gap while readonly and locked short cells retain content-derived sizing.
Host, grid, cell, and direct slotted-content boundaries also permit intrinsic inline shrinkage and
inherit `overflow-wrap: anywhere`, so an unbroken consumer-authored text run cannot widen a 320px
stack. This does not seize overflow from child-owned widgets: custom content can still declare
`overflow: auto` and `white-space: nowrap` to retain a contained internal scrollport.

**Themeable custom properties:** `--lr-dashboard-grid-columns`, `--lr-dashboard-grid-row-height`,
and `--lr-dashboard-grid-gap` back the CSS Grid's `grid-template-columns`/`grid-auto-rows`/`gap`.
They are real cascade-authoritative public hooks: the `columns`/`rowHeight`/`gap` properties supply
private computed fallbacks rather than overwriting these public variables inline.
`--lr-dashboard-grid-cell-hover-outline-color`
(default `var(--lr-color-border-strong)`) retints the mouse-hover outline on `[part='cell']` — a
preview of its own `:focus-visible` ring, shown because every cell is a real focusable,
draggable/resizable target; set it to `transparent` to opt out of the hover treatment entirely.

**Additional API surface:**

- `LyraDashboardCell`, `LyraDashboardCollisionPolicy`, and
  `LyraDashboardPlacementResult` — readonly public authoring/result types.
- `resolveLyraDashboardPlacement(layout, candidateCellId, requested, columns, policy)` — the only public
  runtime layout utility. It returns an immutable normalized result; collision indexing,
  clamping, sorting, and push-cascade helpers are intentionally implementation-private.
- `LyraDashboardCellMoveDetail`, `LyraDashboardCellResizeDetail`,
  `LyraDashboardCollisionDetail`, and `LyraDashboardLayoutChangeDetail` — readonly event-detail
  interfaces used by `LyraDashboardGridEventMap`.
- `--lr-dashboard-grid-collision-outline-color` — Outline color of a cell whose current drag/resize preview collides with another cell. Default: `var(--lr-color-danger)`.
- `--lr-dashboard-grid-interaction-shadow` — Box shadow applied during a cell drag or resize. Default: `var(--lr-shadow)`.

## `lr-drilldown-panel`

Controlled navigation shell from a chart or table datum to related evidence, documents, entities,
or agent runs. It renders a breadcrumb path and delegates the effective category to existing
source-card, document-preview, and entity-card primitives.

**Properties:**

- `path: readonly LyraDrilldownNode[] = []` (attribute: false) — host-owned breadcrumb trail. Each
  node uses `nodeId` and may carry readonly `evidence`, `documents`, and `entities` collections.
  Evidence records use `evidenceId`, documents use `documentId`, and entities use `entityId`.
- `activeCategory: LyraDrilldownCategory | '' = ''` (attribute `active-category`, reflected) —
  controlled category authority. Empty or unavailable values resolve to the first populated
  category without mutating the property. A tab interaction emits a change request; the host
  accepts it by assigning `event.detail.category`.
- `types: readonly LyraNodeTypeStyle[] = []` (attribute: false) — shared node-type badge styles
  forwarded to composed entity cards. The shape is structurally identical to the graph/entity
  node-style vocabulary.
- `accessibleLabel: string | null = null` (attribute `aria-label`) — names the nested tab group or
  sole category region. `null` leaves a tab strip unnamed and falls back to the sole category
  label; an explicit empty string is preserved.
- `communityLabel: string = ''` (attribute `community-label`) and
  `showFocusButton: boolean = true` (attribute `show-focus-button`) — forwarded to active entity
  cards.

Structured inputs cross a realm-neutral schema boundary. The component clones and freezes all
accepted records, nested arrays, and entity property maps; ignores accessors, malformed records,
whitespace-unstable identities, and later duplicate IDs; and bounds the retained model to 256 path
nodes, 1,000 records per category, 256 type styles, and 128 entity properties. A localized range
under `limit` truthfully reports source input omitted by a ceiling.

Only the effective category's child components are mounted. Each category is paged eight records
at a time, with a localized `start–end of total` summary and Previous/Next controls. Consequently an
active document category owns at most eight simultaneous `lr-document-preview` lifecycles (and at
most eight of that viewer's individually byte-capped text resources); hidden categories own no
preview fetches. Paging, path replacement, category changes, and disconnect remove obsolete
previews, which abort their owner-realm requests. The embedded tab group uses manual activation so
arrowing across tabs does not request expensive categories until Enter/Space commits.

**Events:**

- `lr-drilldown-navigate` — frozen `{ nodeId, index }`; a request only, never a `path` mutation.
- `lr-drilldown-category-change` — frozen `{ nodeId, category, previousCategory }`; a controlled
  request only.
- `lr-drilldown-evidence-expand`, `lr-drilldown-evidence-open`,
  `lr-drilldown-document-download`, `lr-drilldown-document-render-error`,
  `lr-drilldown-document-highlight-activate`, and `lr-drilldown-entity-activate` — correlated
  wrapper events carrying the current `nodeId` and the relevant `evidenceId`, `documentId`, or
  `entityId`. The document-highlight wrapper carries `{ nodeId, documentId, highlightId }`,
  preserving the preview event's domain-specific highlight identity. Raw events from owned source
  cards, previews, entity cards, and tabs are contained;
  events from consumer-owned `runs` slot content continue bubbling normally.

**Slots:** `runs`. **CSS parts:** `base`, `breadcrumb`, `breadcrumb-item`, `breadcrumb-button`,
`tabs`, `category`, `content`, `evidence-item`, `document-item`, `entity-item`, `pagination`,
`pagination-summary`, `previous-button`, `next-button`, `limit`, `empty`.

**9.0 migration:** the generic `Drilldown*` authoring types are now `LyraDrilldown*`. Replace node
`id` with `nodeId`, evidence `id` with `evidenceId`, document `id` with `documentId`, entity `id`
with `entityId`, and read `lr-drilldown-navigate.detail.nodeId`. Hidden category DOM is no longer
eagerly present; query the source data or accept `lr-drilldown-category-change` before accessing
that category's composed children.

## `lr-filter-bar`

Dashboard filter row that composes Lyra inputs and removable chips, with reset and loading states.

**Properties:**

- `filters: readonly LyraFilterBarFilterDefinition[] = []` (attribute: false) — filter schema in
  render order. Every definition carries a nonempty, whitespace-stable, unique `filterId`; invalid
  definitions and later duplicate filter IDs are ignored deterministically. The first 10,000
  definitions and nested collection entries are detached and deeply frozen at assignment; the
  optional Lit `icon` payload retains its rendering identity. Create and reassign a new array after
  changes. Writing `null` or `undefined` clears the schema; reads remain the canonical non-null
  empty array.
- `value: LyraFilterBarValue = {}` (attribute: false) — sparse current values keyed by `filterId`.
  Cleared fields are omitted. Reads, writes, event details, and string-array fields are immutable
  snapshots rather than references to caller-owned data, capped at 10,000 record keys and 10,000
  entries per string-array field. Create and reassign a new record after changes. Writing `null` or
  `undefined` clears the value; reads remain the canonical non-null empty record. Built-in controls
  use strings/string arrays; if an untyped boundary supplies a boolean, `false` is canonical empty
  and omitted while `true` remains set. Custom controls instead use their adapter's `isEmpty` or
  `clearValue` contract, so either boolean can be meaningful in a custom domain.
- `label: string = ''` — accessible-name fallback for the internal `role="group"`. A host
  `aria-label` wins by attribute presence, including an explicitly empty value.
- `disabled: boolean = false` (reflected) — disables every filter control and reset action.
- `loading: boolean = false` (reflected) — shows the status spinner and disables reset while leaving
  filters editable.
- `hasActiveFilters: boolean` (read-only) — whether any configured filter currently has a value.
- `invalidFilterIds: readonly string[]` (read-only) — immutable ids of required filters whose
  values are unset.

The composed reset action uses `lr-button`'s default `m` size tier, matching the default rendered
height of adjacent select, combobox, input, and date fields instead of introducing a shorter action
inside the same controls row.
The host, root, controls, active-filter row, composed chip group, and chips all zero nested flex
auto minima and cap themselves to the allocated inline size. A single unbroken localized active
value therefore stays inside a 320px LTR or RTL bar, with the chip's own label ellipsis retaining
overflow ownership rather than widening the page.

Each edit exposes one filter-bar `lr-input` carrying a detached, deeply frozen snapshot of the
complete value object, plus the `filterId` that changed and (new in 12.0.0) `appliedPreset` — see
"Date-range quick ranges" below. A built-in or
custom control's own `lr-input`/`lr-change` aliases stay inside the wrapper so their incompatible
detail shapes cannot escape as duplicate bar events; native-style `input`/`change` events from the
composed controls continue bubbling normally.

**Methods:** `checkValidity(): boolean` returns whether every required filter is set without
revealing errors; `reportValidity(): boolean` returns the same state and reveals every current
required-field error; `reset(): void` restores each definition's `defaultValue` (or unsets it),
unless the bar is disabled.

**Events:** `lr-input`, `lr-reset`, `lr-validity-change`. **CSS parts:** `base`, `controls`,
`filter-control`, `filter-control-label`, `filter-control-field`, `filter-control-input`,
`filter-control-start`, `filter-control-end`, `filter-control-listbox`, `filter-control-option`,
`filter-control-clear-button`, `filter-control-expand-button`, `filter-control-expand-icon`,
`filter-control-popup`, `filter-control-error`, `filter-control-hint`, `active-filters`, `chips`,
`chip`, `reset-button`, `status`.

The `filter-control-*` parts are semantic aliases forwarded from each built-in control's shadow
surface. `filter-control-field` consistently reaches the select trigger, combobox container, or
text/date input wrapper; `filter-control-input` reaches the corresponding display or editable input.
Listbox/option aliases apply to select and combobox filters, while expand-button/popup apply to date
filters. This lets a consumer theme the composed tier from `lr-filter-bar::part(...)` without
depending on the built-in control type selected by a filter definition. Custom renderers retain
ownership of their own part forwarding.

A `'select'`/`'combobox'` filter's required `options` entries are
`LyraFilterBarOption { value, label, icon? }`.
`icon` is optional Lit content — a status dot, a type glyph, a flag — rendered into the composed
`<lr-option>`'s own `start` slot as inert, `aria-hidden` chrome, so it never joins the option's
accessible name:

```ts
options: [
  {
    value: "open",
    label: "Open",
    icon: html`<lr-icon name="circle"></lr-icon>`,
  },
  { value: "closed", label: "Closed" },
];
```

Each filter definition's `type` selects which existing Lyra input renders it — this component
composes them and never invents a control of its own. `'select'`/`'combobox'` map to their
same-named counterparts (with `combobox`'s `multiple` opting into a multi-value filter),
`'date'`/`'date-range'` both map to `<lr-date-input>` (single vs. `mode="range"`), and `'text'` maps
to `<lr-input>` for an open-ended free-text query rather than a closed choice set. A `'text'`
filter's value is the raw query string, verbatim, and its chip shows exactly that string — the same
text the user typed, not a truncated or normalized form.

### Date-range quick ranges

A `'date-range'` definition also accepts `presets?: readonly LyraDateRangePreset[]` (new in 12.0.0),
forwarded to its composed `<lr-date-input>` exactly like `min`/`max`, so the quick-range row
("Today", "Last 7 days", "All time") renders inside that filter's own calendar popover. Entries are
`LyraDateRangePreset { label, start?, end? }` with ISO `YYYY-MM-DD` bounds; an omitted bound is open
and resolves to the filter's `min`/`max`, and an open bound with no corresponding limit renders that
button disabled. `presets` is deliberately **not** accepted on a single `'date'` filter: a preset
names two dates, so `lr-date-picker` ignores the list outside range mode, and a list passed there is
dropped rather than rendering a row that cannot do anything.

The `lr-input` emitted by such a commit carries `appliedPreset`, the definition entry whose button
produced it — the bar's own frozen snapshot, so it compares identical to `filters[i].presets[j]`. It
is `undefined` for every other filter type and for a range picked or typed by hand. A filter bar
whose values round-trip through a query string needs it because `value` holds only the frozen ISO
range: persisting "Last 7 days" as a preset id keeps it meaning the last 7 days after the next
reload, and re-deriving it by string-matching `value` is both the mapping table `presets` exists to
delete and ambiguous (Today and This month coincide on the 1st). It rides the event rather than
`value` because it is metadata about one edit, not a filter value — `value` stays the plain,
JSON-serializable record it has always been.

```ts
const filters: LyraFilterBarFilterDefinition[] = [
  {
    filterId: "period",
    label: "Reporting period",
    type: "date-range",
    min: "2020-01-01",
    max: "2030-12-31",
    presets: [
      { label: "Last 7 days", start: "2026-08-13", end: "2026-08-19" },
      { label: "This month", start: "2026-08-01", end: "2026-08-31" },
      { label: "All time" },
    ],
  },
];

bar.addEventListener("lr-input", (event) => {
  const { value, filterId, appliedPreset } = event.detail;
  persist({ ...value, periodPreset: appliedPreset?.label });
});
```

Before this, the only way to give a filter-bar date range a quick-range row was `type: 'custom'`,
which means hand-rendering an `lr-date-input` plus a full adapter (`clearValue`, `isEmpty`,
`formatValue`) to set one property, and forfeits the built-in date-range chip localization described
next.

Date chips localize exactly one round-trip-valid ISO `YYYY-MM-DD` segment; date-range chips require
exactly two slash-separated segments. Four-digit
years `0000`–`0099` retain those literal years rather than inheriting JavaScript's 1900 offset;
impossible days/months, extra/missing segments, inverted ranges, and a range with either invalid
endpoint stay verbatim instead of silently rolling into another date or discarding data.

A `'text'` filter is the one control that is **not** a fully controlled `.value=` binding.
Re-rendering a text field from `value` mid-typing would push a stale value back in and drop the
caret to the end, so the field owns its own value while the user types, and an external `value`
write is synced back into it only once no edit is in flight (a host write, a chip removal, and
`reset()` all take that path).

`'text'` filters also accept an optional per-filter `debounce` (ms) — how long to wait after the
last keystroke before committing the typed value to `value` and emitting a single `lr-input`, so a
server-side query runs once per pause instead of once per character. Omitted, `0`, or a non-finite
value means no debounce at all: every keystroke commits immediately. A pending debounce is always
**flushed** by the field's own `change`/blur, so a blur never loses the last keystroke, and
**cancelled outright** by `reset()`, by removing that filter's chip, and on disconnect — a stale
keystroke can never overwrite a reset or fire after teardown. `debounce` is ignored for every other
`type`, whose commits are discrete choices with nothing to debounce.

### Custom controls

Use `type: 'custom'` when an existing Lyra control does not fit the built-in filter types. Provide a
`custom` object with a `render(context)` function and an `adapter`. The renderer owns the control's
markup and should bind the context's `value`, `disabled`, `required`, and `errorText` as appropriate;
`context.onValueChange` (or its `onInput`/`onChange` aliases) reads the event through
`adapter.valueFromEvent` and commits it to the filter bar. `context.setValue(value)` is available for
controls that expose a value without an event payload, and `context.onFocusout` marks the filter
touched for required validation. Every context also carries its `filterId`, a monotonic
`generation`, and an `AbortSignal`; replacement/removal of the schema, disconnection, and reconnect
abort stale contexts, whose callbacks become inert.

The adapter's required `clearValue` is used when the active chip is removed. Its optional
`isEmpty(value)` defines domain emptiness; without one, the bar compares against `clearValue`
(including shallow string-array equality). Its optional `formatValue` controls chip display.
Consequently `false` remains a meaningful active value unless the adapter explicitly declares it
empty. Custom values may be strings, string arrays, booleans, or `undefined`, so controls such as
`lr-time-range`, `lr-checkbox`, and an async-backed `lr-combobox` can participate in the same
controlled value, active-chip, reset, disabled, and validation contract:

```ts
const filters: LyraFilterBarFilterDefinition[] = [
  {
    filterId: "archived",
    label: "Include archived",
    type: "custom",
    custom: {
      adapter: {
        valueFromEvent: (event) =>
          (event as CustomEvent<{ checked: boolean }>).detail.checked,
        clearValue: false,
        formatValue: (value) => (value === true ? "Enabled" : "Disabled"),
      },
      render: (context) => html`
        <lr-checkbox
          .checked=${context.value === true}
          ?disabled=${context.disabled}
          @lr-change=${context.onValueChange}
          @focusout=${context.onFocusout}
          >${context.label}</lr-checkbox
        >
      `,
    },
  },
];
```

The custom renderer returns a Lit `TemplateResult`; the filter bar places it in its
`filter-control` part and re-renders it whenever the controlled value or validation state changes.

## `lr-page`

Semantic application/page shell with page-wide banner/header/subheader/footer regions, a compact
menu, primary navigation, main header/content/footer, and an aside. It derives mobile versus
desktop presentation from **its own allocated inline size**, not the viewport: a Page inside a
narrow split pane becomes mobile even on a wide monitor. The first/server-safe state is desktop;
the first live measurement corrects it before normal interaction.

Navigation has one static shadow subtree and one `navigation` slot in both presentations. Desktop
places it in the grid; mobile promotes that exact subtree into a logical-edge modal drawer. Assigned
nodes are never cloned or recreated, so focus, custom-element instances, form state, scroll state,
and event listeners survive every breakpoint crossing.

**Properties:**

- `view: 'mobile' | 'desktop' = 'desktop'` (reflected) — current allocation-derived presentation.
- `navOpen: boolean = false` (attribute `nav-open`, reflected) — mobile drawer state. Navigation is
  visible on desktop independently. The state is retained through a desktop crossing, so returning
  to mobile restores the same open drawer rather than replacing its content.
- `mobileBreakpoint: string = '768px'` (attribute `mobile-breakpoint`, not reflected) — accepts a
  bare number/px length, `rem` resolved against the live root font size, or `em` resolved against
  the Page's live font size. It is re-resolved on every allocation measurement. Invalid values,
  including `%`, viewport units, `calc()`, and `var()`, fall back to `768px`.
- `navigationPlacement: 'start' | 'end' = 'start'` (attribute `navigation-placement`, reflected) —
  a logical placement: `start` is left in LTR and right in RTL; `end` is the reverse.
- `tabindex: string = '-1'` (reflected) — the host fragment target's native focusability. The Page
  preserves an authored value and otherwise keeps the host target focusable programmatically so a
  skip link or URL fragment can transfer focus into the main content.
- `disableNavigationToggle: boolean = false` (attribute `disable-navigation-toggle`, reflected) —
  hides the built-in mobile toggle. One or more custom controls assigned to `navigation-toggle`, or
  a slotted control carrying `data-toggle-nav`, can still own the action.
- `strings`/`locale` and host `aria-label` follow the shared localization contract. `aria-label`
  overrides the localized name of the internal navigation landmark.

**Methods:** `showNavigation(): void`, `hideNavigation(): void`, and
`toggleNavigation(): void` update `navOpen`. `visiblePixelsInViewport(element: HTMLElement | null):
number` returns the element's finite, viewport-clamped vertical intersection in CSS pixels (`0` for
`null`, invalid geometry, no intersection, or an element in a detached document with no viewport).
This is a deliberate owner-realm safety divergence from Web Awesome 3.11, whose method returns
`null` for a null input and measures detached-document geometry against the ambient page viewport;
code migrating from `wa-page` should treat Lyra's always-finite `number` result as canonical.

**Events:** `lr-nav-toggle` (cancelable; `detail: { open }` is the `navOpen` state proposed by
`showNavigation()`/`hideNavigation()`/`toggleNavigation()` or a built-in dismissal — backdrop
click, Escape, or the default/custom navigation-toggle control, all of which route through those
same methods. Call `preventDefault()` to leave `navOpen` unchanged.)

The default mobile toggle is a native button with localized open/close names and explicit
`aria-haspopup="dialog"`, `aria-expanded="true|false"`, plus `aria-controls` pointing to this
Page's unique drawer. Opening
uses Lyra's shared modal overlay stack for inerting, scroll lock, Escape/backdrop dismissal, focus
trapping, stacking, reconnect suspension, and focus return. Modal inerting is scoped to the live
drawer root, so header/main/footer siblings inside the Page become inert without inerting the
drawer itself. Every custom `navigation-toggle` and the composed descendant that actually receives
focus are wired to the same state with `aria-haspopup="dialog"`, synchronized `aria-expanded`, and
a localized label when unnamed; any available assigned control opens the same Page-owned drawer,
while disabled, `aria-disabled`, hidden, and inert controls remain non-actions. The component
supplies the real drawer to the shared controls owner; current browsers normalize that inward
private relationship to the public Page host. Generated whole-value state remains authoritative
while assigned, authored relationship tokens compose, and exact initial or late-authored baselines
return when a toggle is replaced, removed, or the Page disconnects. If the opening toggle is
replaced while the drawer is open, both the ARIA owner and eventual focus-return target retarget to
the next available assigned toggle's real composed control.

`navigation-toggle-icon` is decorative visual content: its assigned subtree is inert and hidden
from assistive technology, while the native toggle retains the sole action and localized name.
Likewise, `skip-to-content` replaces only visible skip-link text; its assigned subtree is inert and
hidden from assistive technology, but its text names the Page's sole skip link. Supply text or a
glyph as appropriate to the slot, not a separate interactive control: `skip-to-content` needs
descriptive text, while `navigation-toggle-icon` needs a glyph.

The focus-visible skip link has a localized `Skip to content` fallback and focuses the unique
internal `<main>`. Native URL fragments cannot address an id inside a shadow root, so the Page host
is the unique, programmatically focusable fragment target; activation then focuses and scrolls its
own main landmark. Multiple Page instances therefore never share a global `#main-content` target.

**Slots (15):** default (main content), `aside`, `banner`, `footer`, `header`, `main-footer`,
`main-header`, `menu`, `navigation`, `navigation-footer`, `navigation-header`,
`navigation-toggle`, `navigation-toggle-icon`, `skip-to-content`, and `subheader`.

**CSS parts (22):** `aside`, `banner`, `base` and `page` (same root node), `body`,
`dialog-wrapper`, `drawer`, `footer`, `header`, `main`, `main-content`, `main-footer`,
`main-header`, `menu`, `navigation` and `navigation-desktop` (same navigation landmark),
`navigation-footer`, `navigation-header`, `navigation-toggle`, `navigation-toggle-icon`,
`skip-to-content`, and `subheader`.

**Themeable custom properties:** `--lr-page-aside-width` (default `auto`),
`--lr-page-banner-height` (`0px`), `--lr-page-header-height` (`0px`),
`--lr-page-main-width` (`1fr`), `--lr-page-menu-width` (`auto`), and
`--lr-page-subheader-height` (`0px`). The six Web Awesome spellings remain accepted as aliases:
`--aside-width`, `--banner-height`, `--header-height`, `--main-width`, `--menu-width`, and
`--subheader-height`. Set either spelling on the Page itself; the prefixed name is Lyra's canonical
form. The following interaction and overlay paints are inherited inline fallbacks, so an element or
ancestor may retheme only the named state: `--lr-page-skip-to-content-hover-bg` (default
`var(--lr-color-brand-quiet)`), `--lr-page-skip-to-content-hover-color` (default
`var(--lr-color-brand)`), `--lr-page-skip-to-content-active-bg` (default `color-mix(in oklab,
var(--lr-color-brand-quiet), var(--lr-color-mix-partner) var(--lr-color-mix-active))`),
`--lr-page-skip-to-content-active-color` (default `var(--lr-color-brand)`),
`--lr-page-navigation-toggle-hover-bg` (default `var(--lr-color-brand-quiet)`),
`--lr-page-navigation-toggle-hover-color` (default `var(--lr-color-brand)`),
`--lr-page-navigation-toggle-active-bg` (default `color-mix(in oklab, var(--lr-color-brand-quiet),
var(--lr-color-mix-partner) var(--lr-color-mix-active))`),
`--lr-page-navigation-toggle-active-color` (default `var(--lr-color-brand)`),
`--lr-page-navigation-backdrop-bg` (default `var(--lr-color-overlay)`),
`--lr-page-navigation-drawer-bg` (default `var(--lr-color-surface-overlay)`), and
`--lr-page-navigation-drawer-shadow` (default `var(--lr-shadow-l)`).

`disable-sticky` is a whitespace-token attribute, not a comma-separated value. Accepted tokens are
`banner`, `header`, `subheader`, `menu`, and `aside`; each only disables that region. Sticky offsets
use the three configured height properties, so set them to the real minimum heights when those rows
carry content. Motion uses Lyra transition tokens and is removed under `prefers-reduced-motion`.
Every region has a zero-minimum inline size and anywhere wrapping; the drawer clamps inside a 320px
allocation, and long localized or consumer-provided text cannot widen the Page.

Import only the Page registration when it is the only layout component this bundle needs:

```js
import "@aceshooting/lyra-ui/components/layout/page/page.js";
```

```html
<lr-page
  mobile-breakpoint="48rem"
  navigation-placement="start"
  disable-sticky="aside"
  style="--lr-page-main-width: 1fr; --lr-page-aside-width: 14rem"
>
  <strong slot="header">Workspace</strong>
  <button slot="header" data-toggle-nav>Sections</button>
  <h2 slot="navigation-header">Sections</h2>
  <a slot="navigation" href="/overview">Overview</a>
  <a slot="navigation" href="/reports">Reports</a>
  <h1 slot="main-header">Overview</h1>
  <p>Main content</p>
  <aside slot="aside">Related reports</aside>
  <small slot="footer">Workspace footer</small>
</lr-page>
```

## Exported TypeScript contracts

These named interfaces and helper signatures are available to typed integrations. They are grouped by capability so the component sections above can stay focused.

- **`components-layout-app-rail-app-rail-contracts`** — Supporting data types and helpers for this component family.
  `LyraAppRailModeChangeDetail {
  mode: unknown;
}`
  `LyraAppRailResizeDetail {
  widthPx: unknown;
}`
  `LyraAppRailToggleDetail {
  open: unknown;
}`
  `computeAppRailMode(/* public names: iconOnlyMatches, mobileMatches, preferredMode */): unknown`

- **`components-layout-command-palette-command-palette-contracts`** — Supporting data types and helpers for this component family.
  `LyraCommand {
  commandId: unknown;
  label: unknown;
  description: unknown;
  group: unknown;
  shortcut: unknown;
  keywords: unknown;
  disabled: unknown;
  icon: unknown;
  onSelect: unknown;
}`

- **`components-layout-dashboard-grid-dashboard-grid-contracts`** — Supporting data types and helpers for this component family.
  `LyraDashboardCellMoveDetail {
  cellId: unknown;
  position: unknown;
  x: unknown;
  y: unknown;
  previous: unknown;
}`
  `LyraDashboardCellResizeDetail {
  cellId: unknown;
  size: unknown;
  w: unknown;
  h: unknown;
  previous: unknown;
}`
  `LyraDashboardCollisionDetail {
  cellId: unknown;
  collidedCellIds: unknown;
  policy: unknown;
  accepted: unknown;
}`
  `LyraDashboardLayoutChangeDetail {
  layout: unknown;
}`

- **`components-layout-dashboard-grid-layout-types-contracts`** — Supporting data types and helpers for this component family.
  `LyraDashboardCell {
  cellId: unknown;
  x: unknown;
  y: unknown;
  w: unknown;
  h: unknown;
  minW: unknown;
  minH: unknown;
  maxW: unknown;
  maxH: unknown;
  locked: unknown;
  widget: unknown;
  label: unknown;
}`
  `LyraDashboardPlacementResult {
  accepted: unknown;
  layout: unknown;
  collidedCellIds: unknown;
}`

- **`components-layout-dashboard-grid-layout-contracts`** — Supporting data types and helpers for this component family.
  `resolveLyraDashboardPlacement(/* public names: layout, candidateCellId, requested, x, y, w, h, columns, policy */): unknown`

- **`components-layout-details-accordion-contracts`** — Supporting data types and helpers for this component family.
  `LyraAccordionEventDetail {
  item: unknown;
}`

- **`components-layout-details-details-contracts`** — Supporting data types and helpers for this component family.
  `LyraDetailsToggleDetail {
  open: unknown;
  source: unknown;
}`

- **`components-layout-dock-panel-dock-panel-contracts`** — Supporting data types and helpers for this component family.
  `LyraDockPanelCollapseChangeDetail {
  collapsed: unknown;
}`
  `LyraDockPanelResizeDetail {
  extent: unknown;
}`

- **`components-layout-drilldown-panel-drilldown-panel-contracts`** — Supporting data types and helpers for this component family.
  `LyraDrilldownCategoryChangeDetail {
  nodeId: unknown;
  category: unknown;
  previousCategory: unknown;
}`
  `LyraDrilldownDocumentDownloadDetail {
  nodeId: unknown;
  documentId: unknown;
  src: unknown;
  filename: unknown;
}`
  `LyraDrilldownDocumentHighlightActivateDetail {
  nodeId: unknown;
  documentId: unknown;
  highlightId: unknown;
}`
  `LyraDrilldownDocument {
  documentId: unknown;
  name: unknown;
  mimeType: unknown;
  uri: unknown;
  version: unknown;
}`
  `LyraDrilldownDocumentRenderErrorDetail {
  nodeId: unknown;
  documentId: unknown;
  error: unknown;
}`
  `LyraDrilldownEntityActivateDetail {
  nodeId: unknown;
  entityId: unknown;
}`
  `LyraDrilldownEntity {
  entityId: unknown;
  label: unknown;
  type: unknown;
  description: unknown;
  properties: unknown;
  degree: unknown;
  communityId: unknown;
}`
  `LyraDrilldownEvidenceExpandDetail {
  nodeId: unknown;
  evidenceId: unknown;
  expanded: unknown;
}`
  `LyraDrilldownEvidenceItem {
  evidenceId: unknown;
  title: unknown;
  page: unknown;
  href: unknown;
  excerpt: unknown;
  full: unknown;
}`
  `LyraDrilldownEvidenceOpenDetail {
  nodeId: unknown;
  evidenceId: unknown;
  href: unknown;
}`
  `LyraDrilldownNavigateDetail {
  nodeId: unknown;
  index: unknown;
}`
  `LyraDrilldownNode {
  nodeId: unknown;
  label: unknown;
  evidence: unknown;
  documents: unknown;
  entities: unknown;
}`

- **`components-layout-filter-bar-filter-bar-contracts`** — Supporting data types and helpers for this component family.
  `LyraFilterBarComboboxDefinition {
  type: unknown;
  options: unknown;
  multiple: unknown;
  filterId: unknown;
  label: unknown;
  placeholder: unknown;
  required: unknown;
  defaultValue: unknown;
}`
  `LyraFilterBarCustomControlAdapter {
  valueFromEvent: unknown;
  event: unknown;
  clearValue: unknown;
  isEmpty: unknown;
  value: unknown;
  formatValue: unknown;
}`
  `LyraFilterBarCustomControlContext {
  filterId: unknown;
  label: unknown;
  definition: unknown;
  value: unknown;
  disabled: unknown;
  required: unknown;
  errorText: unknown;
  signal: unknown;
  generation: unknown;
  setValue: unknown;
  onValueChange: unknown;
  event: unknown;
  onInput: unknown;
  onChange: unknown;
  onFocusout: unknown;
}`
  `LyraFilterBarCustomControl {
  render: unknown;
  context: unknown;
  adapter: unknown;
}`
  `LyraFilterBarCustomDefinition {
  type: unknown;
  custom: unknown;
  filterId: unknown;
  label: unknown;
  placeholder: unknown;
  required: unknown;
  defaultValue: unknown;
}`
  `LyraFilterBarDateDefinition {
  type: unknown;
  min: unknown;
  max: unknown;
  filterId: unknown;
  label: unknown;
  placeholder: unknown;
  required: unknown;
  defaultValue: unknown;
}`
  `LyraFilterBarDateRangeDefinition {
  type: unknown;
  presets: unknown;
  min: unknown;
  max: unknown;
  filterId: unknown;
  label: unknown;
  placeholder: unknown;
  required: unknown;
  defaultValue: unknown;
}`
  `LyraFilterBarInputDetail {
  value: unknown;
  filterId: unknown;
  appliedPreset: unknown;
}`
  `LyraFilterBarOption {
  value: unknown;
  label: unknown;
  icon: unknown;
}`
  `LyraFilterBarResetDetail {
  value: unknown;
}`
  `LyraFilterBarSelectDefinition {
  type: unknown;
  options: unknown;
  filterId: unknown;
  label: unknown;
  placeholder: unknown;
  required: unknown;
  defaultValue: unknown;
}`
  `LyraFilterBarTextDefinition {
  type: unknown;
  debounce: unknown;
  filterId: unknown;
  label: unknown;
  placeholder: unknown;
  required: unknown;
  defaultValue: unknown;
}`
  `LyraFilterBarValidityDetail {
  valid: unknown;
  invalidFilterIds: unknown;
}`

- **`components-layout-menu-menu-item-contracts`** — Supporting data types and helpers for this component family.
  `MenuItemChangeDetail {
  value: unknown;
  checked: unknown;
}`
  `MenuItemStateChangeDetail {
  disabled: unknown;
  hidden: unknown;
  inert: unknown;
}`

- **`components-layout-menu-menu-contracts`** — Supporting data types and helpers for this component family.
  `MenuItemSelectDetail {
  item: unknown;
}`

- **`components-layout-multi-split-multi-split-contracts`** — Supporting data types and helpers for this component family.
  `LyraMultiSplitCollapseChangeDetail {
  state: unknown;
}`
  `LyraMultiSplitConstraintIssueDetail {
  reason: unknown;
  panelCount: unknown;
  minimumTotal: unknown;
  maximumTotal: unknown;
  containerSize: unknown;
}`
  `LyraMultiSplitOrientationChangeDetail {
  orientation: unknown;
}`
  `LyraMultiSplitPanelConstraint {
  minPx: unknown;
  maxPx: unknown;
  minPercent: unknown;
  maxPercent: unknown;
}`
  `LyraMultiSplitResizeDetail {
  sizes: unknown;
}`

- **`components-layout-reorder-list-reorder-list-contracts`** — Supporting data types and helpers for this component family.
  `LyraReorderDetail {
  order: unknown;
  fromIndex: unknown;
  toIndex: unknown;
}`

- **`components-layout-responsive-panel-responsive-panel-contracts`** — Supporting data types and helpers for this component family.
  `LyraResponsivePanelModeChangeDetail {
  mode: unknown;
}`
  `resolveResponsivePanelEffectiveMode(/* public names: mode, belowBreakpoint */): unknown`

- **`components-layout-segmented-segmented-contracts`** — Supporting data types and helpers for this component family.
  `LyraSegmentedItem {
  value: unknown;
  label: unknown;
  icon: unknown;
  disabled: unknown;
}`

- **`components-layout-split-panel-split-panel-contracts`** — Supporting data types and helpers for this component family.
  `SNAP_NONE(/* public names: options, pos, size, snapThreshold */): unknown`
  `LyraSplitPanelSnapFunctionParams {
  pos: unknown;
  size: unknown;
  snapThreshold: unknown;
}`
  `LyraSplitPanelRepositionDetail {
  position: unknown;
  positionInPixels: unknown;
}`

- **`components-layout-stepper-stepper-contracts`** — Supporting data types and helpers for this component family.
  `LyraStepItem {
  stepId: unknown;
  label: unknown;
  state: unknown;
  disabled: unknown;
  title: unknown;
  icon: unknown;
}`
  `LyraStepperOrientationChangeDetail {
  orientation: unknown;
}`

- **`components-layout-virtual-list-virtual-list-contracts`** — Supporting data types and helpers for this component family.
  `LyraVirtualListGroup {
  key: unknown;
  label: unknown;
  startIndex: unknown;
}`
  `LyraVirtualListIndexedSource {
  count: unknown;
  itemAt: unknown;
  index: unknown;
  keyAt: unknown;
  indexOfKey: unknown;
  key: unknown;
}`
  `LyraVirtualListRange {
  start: unknown;
  end: unknown;
}`
  `LyraVirtualListScroll {
  scrollTop: unknown;
  viewportHeight: unknown;
}`

- **`components-layout-widget-widget-contracts`** — Supporting data types and helpers for this component family.
  `LyraWidgetView {
  viewId: unknown;
  label: unknown;
  icon: unknown;
  ariaLabel: unknown;
}`
