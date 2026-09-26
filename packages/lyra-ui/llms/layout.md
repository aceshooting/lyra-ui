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

Feasible `minPx` floors also constrain flex shrinking after the divider target gutters take their
allocation: a 600px split with a 40px divider can render panels of 300px and 260px. If the floors
cannot fit, the remaining panel space is shared proportionally instead of overflowing. The budget
follows allocation and the actual divider geometry, including font-relative tokens resolved in the
divider's own font context. Panel font sizes do not change that gutter budget; stored percentages,
initialization precedence, and resize event values retain their existing meaning.

In responsive `collapse="start"`/`"end"` mode, the divider beside a floating panel takes no
layout track whether its drawer is open or closed. It remains a programmatically focusable
separator for focus recovery. Rail mode keeps the divider track because both panes remain visible.

Granular import: `@aceshooting/lyra-ui/components/layout/multi-split/multi-split.js`.
The Lyra-original v9 identity migration is mechanical: `lr-split` → `lr-multi-split`,
`LyraSplit` → `LyraMultiSplit`, generic container authoring types → the corresponding
`LyraMultiSplit*` names, identity-specific `lr-split-*` events → `lr-multi-split-*`, and
`--lr-split-*` hooks/storage keys → `--lr-multi-split-*`/`lr-multi-split:*`. The separate mirrored
`lr-split-panel`, its `LyraSplitPanel` class, `SnapFunction`, and `SNAP_NONE` are unchanged.

With a definite block size, each direct panel owns a native `overflow: auto` scroll surface.
Unconstrained panels have a zero block minimum, so long content stays inside the split rather than
escaping into following content. Set `overflow` directly on an individual panel when its content
needs a different scrolling surface.

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
  `flex-basis`, via a native CSS `clamp()` across container resizes) change for a constrained panel.
  Pixel minimums also account for live divider dimensions. Bounds on neighboring panels remain
  active during collapse transitions, including when constraints are updated from an
  `lr-multi-split-collapse-change` handler.
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
  card this state rendered before `open` existed — not just visually hidden; this holds even
  against an author `display` rule targeting the panel directly. Setting `open = true` reveals it as a
  focus-trapped floating panel with a `[part="backdrop"]` scrim; Escape or a backdrop click set
  proposes a cancelable close before changing `open`. While open, the floating panel is the modal root and every sibling pane
  behind it is inert. Leaving `'floating'` while `open` is still `true` also closes it, the same
  way `<lr-app-rail>` closes its mobile overlay when leaving `'mobile'` while open.
- `releasePinOnBreakpoint: boolean = false` (attribute `release-pin-on-breakpoint`, reflected) — opts a
  pinned `collapseState` in to releasing itself when the layout it was made for is gone: either the
  measured collapse band changes to a different one than the pin was made in, or
  `effectiveOrientation` crosses `orientationBreakpoint`. The pin is dropped exactly as if `'auto'`
  had been assigned and the state re-derives from the current measurement, firing
  `lr-multi-split-collapse-change` when that is a real transition. Re-measuring the same band never
  releases a pin, so ordinary resizing inside one band leaves it alone. Left unset (the default), a
  pin survives every band and orientation change until a consumer writes `'auto'` — the pre-existing
  behavior.

**Methods:** `expandPane()`, `collapsePane()` and `togglePane()` drive the collapse feature
semantically, each picking the mechanism the pane's *current band* provides rather than its pinned
state: inside the `floatBreakpoint` band that is the overlay drawer (`open`), above it it is the
`collapseState` pin (`'wide'` expanded, `'rail'` collapsed). `togglePane()` reads the pane's current
presentation — `'wide'` counts as expanded, `'rail'` as collapsed, `'floating'` as expanded exactly
while `open` — so toggling a pane pinned to `'rail'` after the container narrowed into the floating
band opens the drawer instead of doing nothing visible. All three are no-ops while `collapse='none'`
or fewer than two panels exist, none creates a pin the band already produces, and a pin one of them
cancels is released rather than replaced, so an expand/collapse cycle leaves automatic breakpoint
tracking as it found it. They emit no `lr-toggle`, matching the existing rule that a direct `open`
write does not. They are named `…Pane()` rather than `expand()`/`collapse()`/`toggle()` because
`collapse` is already the pane-selection property, following `<lr-page>`'s `showNavigation()` trio.
The component still renders no trigger of its own — wire these to your own control.

`collapse`'s three resulting states — `'wide'` (default, today's plain layout) / `'rail'` / `'floating'`
— are exposed as: a `data-collapse-state` attribute on both the host and the collapsing panel element
itself (absent for `'wide'`/`collapse="none"`); and the `lr-multi-split-collapse-change` event below. The
divider adjacent to the collapsed panel is drag/keyboard-disabled (`aria-disabled="true"`) while
collapsed. Beside a `'floating'` pane (drawer open or closed) that divider also takes no track and
paints no hairline, so the other pane(s) fill the split; beside a `'rail'` pane it keeps both. A
consumer `::part(divider)` or `::part(base)` rule that sets `flex`, a minimum size, padding, border,
`gap` or `::before` content can re-open that gutter; scope such a rule with
`lr-multi-split:not([data-collapse-state="floating"])`, which covers every divider of the split, not
only the one beside the pane. `collapse="none"` (the default) is byte-for-byte identical to
pre-collapse-feature behavior.

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
on a real `collapse`-state transition, never on every resize/render. It fires *after* the collapsing
panel is decorated for the new state — its `data-collapse-state` marker, the closed drawer's `hidden`
flag and its owned inline sizing are all applied first — so a listener can read the panel
synchronously inside its own handler instead of deferring past `updateComplete`. Focus is also moved
out of a pane the new state hides (`'floating'` while closed) or clamps (`'rail'`) before the event
fires, landing on the first surviving pane that can take it, otherwise on one of the split's own
dividers, preferring one that stays enabled; focus anywhere other than the collapsing pane is untouched),
`lr-toggle` (`detail: LyraMultiSplitToggleDetail = { open: boolean }`) — Escape/backdrop close
proposals are cancelable and fire before `open` changes; preventing the event or making a synchronous
reentrant mutation aborts the proposal. A forced close when a responsive collapse transition leaves
`floating` fires noncancelably after `open` is false. Direct `open` writes and no-op dismissals are silent,
`lr-multi-split-constraints-invalid` (`detail: LyraMultiSplitConstraintIssueDetail`, fired once when the configured
panel minimums/maximums cannot fit the track; the infeasible set is rejected for interaction and a
normalized percent minimum is used instead), `lr-multi-split-orientation-change` (`detail: { orientation }`,
fired only when an enabled `orientationBreakpoint` actually changes `effectiveOrientation`)

**Slots:** default (each direct child element is one panel; set a unique `panel-id` on every child
when `storage-key` is used).

**CSS parts:** `base` (`position: relative`, so the `'floating'` state can anchor to it), `divider`
(carries `aria-disabled="true"` and is drag/keyboard-inert while its adjacent panel is collapsed;
while that panel is `'floating'` it takes no track and paints no line, but stays focusable as the
collapse-focus fallback; beside a `'rail'` panel it keeps both),
`backdrop` (the `'floating'` drawer's scrim — only rendered while `collapseState === 'floating'` and
`open`)

**Themeable custom properties:** `--lr-multi-split-overlay-color` (default `var(--lr-color-overlay)`) —
the `'floating'` drawer's `[part='backdrop']` scrim; scoped to `[part='base']`, not the viewport.
`--lr-multi-split-divider-target-size` (default
`max(var(--lr-icon-button-size), var(--lr-size-3px))`) — the real flex track/gutter reserved for the
divider along the resize axis, except beside a `'floating'` pane. The visual rule is painted in its center; no pseudo-element
extends into either adjacent panel, so slotted controls retain pointer ownership up to their edge.
Set it on an ancestor to retune a split subtree or directly on one component; either public value
remains authoritative.
`--lr-multi-split-divider-thickness` (default `var(--lr-size-3px)`) sets the painted hairline's own
width, independent of `--lr-multi-split-divider-target-size` above — retuning one never changes the
other, so the WCAG 2.5.8 pointer target can never be shrunk by a thinner or thicker visual line.
`--lr-multi-split-divider-color` (default `var(--lr-color-border)`),
`--lr-multi-split-divider-hover-color` (default `var(--lr-color-brand)`), and
`--lr-multi-split-divider-active-color` (default
`color-mix(in oklab, var(--lr-color-brand), var(--lr-color-mix-partner) var(--lr-color-mix-active))`)
theme the divider hairline's resting/hover/pressed color; the active color is only reachable while a
resize gesture is pressed (pointer capture holds `:active` for the whole gesture).
`--lr-multi-split-floating-panel-inline-size` overrides the `'floating'` collapse state's overlay
card `inline-size`, which otherwise mirrors its own live `sizes[i]` percent (i.e. what it renders
at in the `'wide'` state, so un-floating never jumps). Unset, the rendered geometry is unchanged;
set (e.g. on an ancestor), it wins over that percent at ordinary specificity, with no `!important`
needed against the inline style the component rewrites on every render.
`--lr-multi-split-floating-panel-inset` (default `0`) sets the `'floating'` drawer's distance from
`[part="base"]`'s edges, applied to both block insets and to whichever logical inline edge
`collapse` anchors the drawer to, so one declaration insets all three anchored edges; the free inline
edge stays governed by the panel's own width. Unset, the drawer is flush with its container exactly
as before.
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
the visually-adjacent panel). Home and End jump directly to that divider's current achievable
minimum and maximum, including per-panel px/percent constraints.

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

Both `lr-reposition-request` detail fields `position` and `positionInPixels` measure from the
selected primary edge and agree with accepted public property readback, including `primary="end"`.
Canceling preserves both prior values; direct property writes remain silent.

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

- `label: string = ''` — header title; a removed attribute renders as absent while preserving
  `null` readback. Supplied empty strings remain empty and later values recover normally.
- `sublabel: string = ''` — secondary header copy with the same removal, empty-string and recovery
  behavior.
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
  view externally; also updated internally when a view toggle is clicked. `activeView`, a
  deprecated alias that seeded this property, was removed in 16.0.0 (available since 11.2.0;
  eligible for removal from 13.0.0) — use `activeViewId`.
- `accessibleLabel: string | null = null` (attribute `aria-label`) — overrides the label-derived
  fullscreen dialog name. An explicitly empty value is retained; property, slotted-label, and
  localized fallbacks apply only when it is absent.
- `storageKey?: string` (attribute `storage-key`) — when set, persists `collapsed` to `localStorage`
  under `lr-widget:${storageKey}` and restores it on the next mount, without overwriting a
  `collapsed`/`.collapsed=${…}` binding already assigned on that same mount — including one that
  assigns `false`, the default. The restore runs once, before the first paint, and is skipped for
  any property the consumer assigned; `lr-app-rail` and `lr-table` share the same mechanism. Without
  a `storageKey` there is no persistence and storage is never touched — listen for
  `lr-collapse-change` and persist the state yourself.

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
active view's `viewId`. Also emitted when a `views` reassignment drops the currently-active view,
forcing a fallback to the first remaining view. Not emitted when a consumer sets `activeViewId`
directly, even to a now-invalid id), and
`lr-activate` (non-cancelable; `detail: { value }` — note the key is `value`, not `viewId` — is the
activated view's `viewId`, fired on **every** accepted header view-toggle activation whether or not
`activeViewId` actually moved. `lr-view-request` stays the veto point, and a vetoed activation emits
no activation at all. Use it for the repeat pick `lr-view-change` deliberately stays silent for —
"rebuild that view" is a real intent — which is otherwise unobservable, because the toggles live in
this shadow root, so a retargeted `click` names no view. When an activation _does_ move the view,
`lr-view-request` and `lr-view-change` are emitted first. Not emitted when a consumer sets
`activeViewId` directly)

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
tokens (`--lr-space-*`, `--lr-color-border/-border-subtle/-surface/-text-quiet`,
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

`--lr-widget-collapse-button-hover-bg` (default `var(--lr-color-brand-quiet)`) and
`--lr-widget-collapse-button-hover-color` (default `var(--lr-color-brand)`), plus
`--lr-widget-fullscreen-button-hover-bg` (default `var(--lr-color-brand-quiet)`) and
`--lr-widget-fullscreen-button-hover-color` (default `var(--lr-color-brand)`), are
the same inline-`var()`-fallback shape for `[part="collapse-button"]` and `[part="fullscreen-button"]`
respectively; each button's pressed fill mixes from its own `-hover-bg` token. Before these existed,
both buttons read the library-wide `--lr-color-brand-quiet`/`--lr-color-brand` tokens directly, so a
consumer retinting those tokens upstream to change only the view toggle's hover (the reason the
view-toggle pair above exists) also silently repainted these two buttons; each now has its own scoped
escape hatch, independent of the other and of the view toggle.

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
- an explicit `collapsed` assignment before the first update — an attribute, a property, or a
  framework binding, including one that pins the property to its own default `false` — always wins
  over a `storageKey`-restored value for that mount, and skips the restore entirely. For
  uncontrolled persistence, don't bind `collapsed`: read the restored value back after
  `updateComplete` and track further changes from `lr-collapse-change`, pushing the property down
  imperatively only for later external changes.
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

**Keyboard:** focus the `scroll-container` viewport to navigate with Arrow keys (horizontal LTR/RTL
or vertical), Home, and End. Keys originating in a native input, textarea, contenteditable surface,
or supported custom control remain owned by that editor, including when the editor is the assigned
slide itself; they do not change the active slide or move focus away from it.

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
- `accessibleLabel?: string` (attribute `accessible-label`) — fallback landmark name. Omitting it
  reads back `undefined` and uses the localized `carouselLabel` default; an explicitly empty value
  is used as-is. A host `aria-label` takes precedence by presence, including an explicitly empty
  value

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
from a method, button, key, pagination item, autoplay tick, or settled user scroll. Also emitted
when a `slidesPerPage` change or a slide's removal forces the active index onto a different slide.
Not emitted when a consumer sets `currentSlide` directly to an out-of-range value; that assignment
is clamped silently. `slide` is the original assigned element at `index`, never a loop endcap.

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
brand/active-mix rendering when unset. The scroll-snap viewport's mouse-hover preview has its own
four-longhand outline shape, matching `lr-scroller`'s viewport:
`--lr-carousel-scroll-container-hover-outline-width` (default `var(--lr-border-width-thin)`),
`--lr-carousel-scroll-container-hover-outline-style` (default `solid`),
`--lr-carousel-scroll-container-hover-outline-color` (default `var(--lr-color-border-strong)`, set
to `transparent` to opt out entirely), and `--lr-carousel-scroll-container-hover-outline-offset`
(default `var(--lr-focus-ring-offset)`). Unset, all four resolve to the rule's previous literal
paint. The `scroll-container` part also honors the opt-in theme-level
`--lr-theme-scrollbar-width`/`--lr-theme-scrollbar-gutter` hooks (defaults `none`/`auto`, matching
its previous unconditional `scrollbar-width: none`) — set either on `:root` or any ancestor for one
declaration to retheme every internal scroll container in the library. Chromium and Safari ignore
the standard `scrollbar-width` property for any element a page also styles through the legacy
`::-webkit-scrollbar` pseudo-element, which this part's own stylesheet still does to hide its
scrollbar there, so on those two engines the hook only visibly retunes this part in Firefox.

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
It holds no state and handles no keys; for a row of toggles with pressed state behind one tab stop,
use `lr-toggle-group`.

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

**Events:** `lr-scroll` has detail `{ scrollStart, scrollEnd, scrollLeft, scrollTop }`.
Scroll-driven emissions are coalesced through one `requestAnimationFrame` tick, so a fling that
fires dozens of native `scroll` events produces at most one `lr-scroll` per frame. This is the
scroller's own event shape, not `lr-virtual-list`'s `lr-virtual-scroll` event
(`{ scrollTop, viewportHeight }`).

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
upstream-named props), and win when both spellings are set. The viewport's mouse-hover preview has
its own four-longhand outline shape, matching `lr-virtual-list`'s: `--lr-scroller-hover-outline-width`
(default `var(--lr-border-width-thin)`), `--lr-scroller-hover-outline-style` (default `solid`),
`--lr-scroller-hover-outline-color` (default `var(--lr-color-border)`, set to `transparent` to opt
out entirely), and `--lr-scroller-hover-outline-offset` (default `var(--lr-focus-ring-offset)`).
Unset, all four resolve to the rule's previous literal paint. The `viewport` part also honors the
opt-in theme-level `--lr-theme-scrollbar-width`/`--lr-theme-scrollbar-gutter` hooks (defaults
`auto`/`auto`, matching its previous unconditional `scrollbar-width: auto`) — set either on `:root`
or any ancestor for one declaration to retheme every internal scroll container in the library,
including `lr-table`, `lr-virtual-list`, `lr-code-block`, and `lr-code-editor`.

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

With manual activation, removing the focused unselected tab rehomes actual focus to a valid survivor
while retaining a valid selected tab and panel. This repair emits no show/hide events and preserves
focus already held by an outside control.

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
direct-label text or visibility changes refresh it. `active` on a paired or labeled unpaneled tab is
an SSR hint: the group reads an initially active tab and then keeps the source tab and any matching
panel attributes synchronized with its own selection after hydration.

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
- `lr-activate` (`detail: { value: string }`) — fired on **every** user activation of a navigable
  tab (a click, an Arrow/Home/End key under `activation="auto"`, or Enter/Space under
  `activation="manual"`), whether or not the active tab actually moved. Bubbling, composed, not
  cancelable — it reports that the user picked a tab and gates nothing. `value` is the activated
  tab's panel name, the same identity `lr-tab-show` reports under the key `name`. Use it for the
  repeat pick `lr-tab-show` deliberately stays silent for: "reload that panel". From the keyboard
  that case is otherwise unobservable, because Home on an already-first active tab (or End on an
  already-last one) activates a tab and produces no click at all. When an activation _does_ move the
  tab, `lr-tab-hide` and `lr-tab-show` are emitted first. The programmatic `show()` method is not a
  user activation and never fires it.

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

The active panel's mouse-hover preview — a subtler cue than `:focus-visible` for a panel that is
also keyboard-focusable, matching `lr-scroller`'s viewport and `lr-carousel`'s scroll container —
has its own four-longhand outline shape: `--lr-tab-group-panel-hover-outline-width` (default
`var(--lr-border-width-thin)`), `--lr-tab-group-panel-hover-outline-style` (default `solid`),
`--lr-tab-group-panel-hover-outline-color` (default `var(--lr-color-border)`, set to `transparent`
to opt out entirely), and `--lr-tab-group-panel-hover-outline-offset` (default
`var(--lr-focus-ring-offset)`). Unset, all four resolve to the rule's previous literal paint.

Otherwise shared tokens — `--lr-space-xs/-s/-m`,
`--lr-color-border/-border-subtle/-text-quiet/-text/-brand`, `--lr-transition-fast`, `--lr-radius`,
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
- `readonly: boolean = false` (reflected) — renders the same `steps` data as a passive progress
  display instead of a navigable control. Each step becomes a non-interactive item inside its
  existing `role="listitem"` wrapper rather than a `<button>`: no `tabindex` (the stepper takes no
  tab stop at all), no `aria-disabled`, no click or Enter/Space activation, and therefore no
  `lr-step-select` — including from a synthetic click dispatched at `::part(step)`.
  Arrow/Home/End become a no-op and no longer call `preventDefault()`, so Space keeps scrolling
  the page the way it does anywhere else in static content. Everything that describes _progress_
  is untouched: the `step-index` chip, the `step-check` glyph, the optional `step-icon`, the
  per-step `title`, `aria-current="step"` on the current step, and every `--lr-stepper-*` custom
  property. It is deliberately **not** a disabled treatment — `disabled` means "you may not do
  this", read-only means "there is nothing to do here" — so a read-only step keeps normal opacity
  and only loses its pointer cursor, matching `<lr-slider>`'s and `<lr-rating>`'s own `readonly`.
  A per-step `disabled` flag is inert while read-only for the same reason: there is no activation
  left for it to gate, so it adds no dimming, and the step still shows its progress state. A
  focused step loses focus when `readonly` is turned on mid-session, because the control holding
  it stops existing; nothing is left stranded in the tab order. Unset (the default) is
  byte-for-byte the previous behavior.
- `effectiveOrientation: 'horizontal' | 'vertical'` (readonly getter) — the live layout/navigation
  axis actually in effect; identical to `orientation` whenever `orientationBreakpoint` is unset or
  doesn't resolve to a length. Also reflected as `data-effective-orientation` (only present while
  `orientationBreakpoint` resolves to a usable length).
- `accessibleLabel: string | null = null` (attribute `aria-label`) — accessible name applied to the
  `role="list"` step strip; attribute-reflects from a host-level `aria-label`. Unset, the list
  renders without an `aria-label` (there is no localized default name); an explicitly empty
  attribute remains empty rather than being treated as absent.

**Events:** `lr-step-select` (`detail: { stepId, index }`) — fired on click, or Enter/Space while
focused, on a non-`disabled` step. Never fired while `readonly`. It is non-cancelable because the
component takes no default action to veto: it never mutates `steps`. `lr-stepper-orientation-change`
(`detail: { orientation }`) — fired only when an enabled `orientationBreakpoint` actually changes
`effectiveOrientation`.

**Slots:** none.

**CSS parts:** `base` (root wrapper, `role="list"`), `step-item` (the `role="listitem"` wrapper for
one step), `step` (a single native button — or a non-interactive `<div>` carrying the same part
while `readonly`; the current step carries `aria-current="step"` and every
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
  inline size**, so it fits a stepper that is the sole flex/grid item in its measured container. It
  does **not** fit a stepper sitting beside a fixed-width sibling in a row that stacks via a CSS
  `@media` rule: while the row is a row, the stepper's width shrinks with the viewport; the instant
  the row stacks (a pure-CSS event no component can observe) it jumps to the _full_ row width —
  wider than it was just before the transition. Because the measured width is not monotonic across
  that transition, no single container threshold both stays wide while the row is a row and goes
  narrow exactly when it stacks — and a fixed-width sibling is worse still, since its own width
  never changes with the viewport at all, so no container breakpoint on it can ever react to the
  stacking. Use `orientationBreakpointBasis='viewport'` for that layout — give the stepper and its
  sibling the same `orientation-breakpoint` and `orientation-breakpoint-basis='viewport'` and they
  flip together, in lockstep with the CSS rule that stacks the row:
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
`<lr-tab>`'s own host is `color: inherit; font: inherit;` for exactly this reason — it makes the
projected element (and therefore its visible label) pick up the real tab button's own computed
color and font, so `--lr-tab-group-selected-color`/`--lr-tab-group-hover-color` reach the rendered
tab text rather than being shadowed by the library's own default text color.

Before group hydration, an unassigned tab places itself in the public `nav` slot. The group then
writes its internal per-tab `slot` attribute itself. A labeled tab with no `panel` gets a stable
synthetic name from its position; the allocator avoids every authored tab and panel name, so mixed
paired/unpaired markup cannot collapse two tabs into one key. An unpaneled descriptor with no
accessibility-exposed label is omitted instead of exposing the synthetic key as its spoken name.

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
- `responsive: boolean = false` (reflected) — makes the host a CSS size-query container
  (`container-type: inline-size`) so a future `@container` rule can react to this group's own
  allocated width. Left unset, the host is `container-type: normal`, since `container-type:
  inline-size` unconditionally would collapse the group to 0 inline size whenever it sits as an
  ordinary (`flex-basis: auto`) child of a shrink-to-fit flex row — this component's own primary
  use case. `[part="base"]` itself now fills the host's inline size unconditionally (not gated by
  `responsive`): a percentage inline-size against an indefinite/shrink-to-fit containing block
  resolves as `auto`, so this is a no-op unless the host is given a definite inline size, directly
  or via an ancestor.

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
- `[part="base"]` fills the host's inline size unconditionally, but the host itself never gets a
  size from `responsive`/`container-type` alone — give the host a definite inline size directly
  (a percentage width, a grid track, a block-level parent) for the fill to have any visible effect.
- Setting `responsive` while this group also sits as a shrink-to-fit flex child re-introduces the
  0-width collapse the unset default is designed to avoid — only opt in when the group's own size
  comes from somewhere else.

---

## `lr-reorder-list` / `lr-reorder-item`

A generic flat-list reorder primitive: per-row move-up/move-down buttons (always available), plus
Ctrl/Cmd+ArrowUp/ArrowDown from focus anywhere inside a row — the same modifier convention
`<lr-tree>`'s `reorderable` and `<lr-dashboard-grid>`'s `cells-draggable` already establish. By
default this list physically moves its own slotted `<lr-reorder-item>` light-DOM nodes itself
(there is no `data` array prop to reconcile against), and emits `lr-reorder` with the full new
order so the host can persist it without hand-rolling its own splice/resort logic. Setting
`controlled` opts into `<lr-tree>`'s controlled `reorderable` contract instead: the list stops
moving anything itself, and waits for the host to reorder its own backing data and re-render the
slotted items to match — reconciled by each item's `value` rather than by element reference, so a
non-keyed host re-render that recreates the moved row (or merely rewrites `value` on the elements
already at each position) still completes the move once the resulting order matches. `lr-reorder`
is cancelable — a listener calling `preventDefault()` holds the move open (mirroring
`lr-confirm-bar`'s cancelable approve/deny pattern) until the host calls
`finalizePendingMove()`/`revertPendingMove()`; `controlled` changes what "applying" the move
means (host re-render instead of a physical DOM move) but not this cancelable contract.

Direct item `value` property or attribute edits refresh the owning list's valid identities and
movement boundaries. Correcting a missing or duplicate identity re-enables the corresponding
controls; making it invalid disables them. Identity edits do not emit a reorder event. Removing the
value attribute from a standalone item renders it as absent while preserving `null` readback; an
explicit empty string remains supplied and later valid values recover.

### `lr-reorder-list`

**Properties:**

- `label: string = ''` — accessible-name fallback for the internal `role="list"`. A present host
  `aria-label` always wins over `label`, including when the host value is explicitly empty.
- `disabled: boolean = false` (reflected) — disables every item's move buttons and the Ctrl/Cmd+
  Arrow shortcut, without mutating any item's own `disabled` attribute.
- `controlled: boolean = false` (reflected) — opts into the controlled mode described above:
  an accepted move waits for a matching host re-render (reconciled by `value`) instead of moving
  the DOM itself. Every move action stays disabled and `aria-busy="true"`/`:state(busy)` apply
  list-wide for the whole wait, the same as a `preventDefault()`-held move. A host re-render that
  never reaches the exact emitted `order` leaves the move pending indefinitely; one that drops the
  moved `value` entirely (removes or renames that row) cancels it silently, with no announcement.
  Toggling this off while a reconciliation is pending drops it rather than leaving the list stuck
  busy.

**Events:** `lr-reorder`
(`detail: LyraReorderDetail { readonly order: readonly string[], readonly fromIndex: number,
readonly toIndex: number }`, cancelable) — fired before a move is applied; `order` is an immutable
snapshot of every valid item's stable `value` in the order the move WOULD produce. Uncanceled, the
move applies synchronously only if the exact mover, target, membership, order, identities, and
availability remain valid after dispatch — or, while `controlled`, starts waiting for the host's
own re-render to reach that `order` instead. `preventDefault()` holds the move instead: the
internal list exposes `aria-busy="true"`, every move action is disabled, the affected item exposes
`:state(pending)`, and no other move can start until the host resolves it — see **Methods** below.
Synchronous finalize/revert calls from the canceling listener are supported.

**Methods:** `finalizePendingMove()` — applies a move held via `preventDefault()` (or, while
`controlled`, starts waiting for the host's own re-render instead of moving the DOM itself).
`revertPendingMove(options?: { silent?: boolean })` — discards a held move, restoring the prior
order; pass `{ silent: true }` to suppress the built-in `reorderMoveCancelled` announcement, e.g.
when a host is deferring the decision to a flow of its own (a confirmation dialog, say) that will
communicate the outcome itself. Both methods no-op when nothing is pending.

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
- `controlled` reconciliation is keyed by `value`, never by element reference: a host re-render
  that recreates the moved row as a brand-new element, or one that leaves every node in place and
  just rewrites `value` at each position (the common outcome of a non-keyed `Array.map()` into the
  default slot), both complete the move once the resulting order matches.

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

**Methods:** `focusMoveButton(direction: 'up' | 'down'): boolean` — moves focus to the requested
move control and returns whether it did; a no-op returning `false` when that control is disabled
for any reason (this item's own `disabled`, the owning list's `listDisabled`, a move held or a
controlled reconciliation pending anywhere in the list, an invalid identity, or that direction
already being this item's boundary). The owning `<lr-reorder-list>` uses it for its own post-move
focus restore, including onto a freshly recreated element instance while `controlled`; a host can
call it the same way.

**Slots:** default — arbitrary row content.

**CSS parts:** `base` (row wrapper), `move-up-button`, `move-down-button`,
`move-up-button__control` / `move-down-button__control` (each move control's own native `<button>` —
as of 16.0.0 the move controls are composed `<lr-icon-button>`s: the old part names keep placement,
rotation and activation, while background, radius, hover/press mixes, focus ring and hit-area floor
come from `--lr-icon-button-*`, and the component's own `--lr-reorder-item-move-button-*` hooks still
win over those defaults), `content` (default-slot wrapper).

**Border reaches the composed move controls the same way background/color/radius do.** This
component paints no resting border on either move control, so it relays no
`--_lr-icon-button-border-default` into their private fallback tier — but that absence is not a
gap. The public `--lr-icon-button-border` (and its `-hover`/`-active` variants) is the FIRST arm
of the token chain, resolved by ordinary custom-property inheritance regardless of whether this
component relays a default for that same property, so setting it on either move control or an
ancestor reaches it exactly as the background/color/radius tokens do. A component with no resting
border simply has no default to relay, which is different from border theming being broken. Size
remains the one exception that does not cross this way: use `--lr-theme-icon-button-size`, never
`--lr-icon-button-size` — every `LyraElement` re-declares the latter on its own `:host`, so it
never reaches a composed child (see `llms/tokens.md`).

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
Re-picking the selected value never clears it; for an optional choice the user may clear, or for
zero-or-more pressed buttons, use `lr-toggle-group`.
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

**Events:**

- `lr-change` (`detail: { value }`) — fired when the selected value changes via click or keyboard.
- `lr-activate` (`detail: { value }`) — fired on **every** activation of a non-disabled
  segment (a click, or an Arrow/Home/End key that lands on one), whether or not the selection
  actually moved. Bubbling, composed, not cancelable — it reports that the user picked a segment
  and gates nothing. Use it for the repeat pick `lr-change` deliberately stays silent for: "run
  that report again", reopening a panel, re-fetching the same range. A `click` listener only
  half-covers that case, because keyboard activation produces no click — pressing Home on an
  already-first selection, End on an already-last one, or an arrow key in a one-item row activates
  a segment and fires no click at all. When an activation _does_ move the selection, `lr-change` is
  emitted first and `lr-activate` second, so either listener reads the settled `value`. A
  disabled segment fires neither event.

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
bleeds onto hover. `--lr-segmented-hover-bg` (default `transparent`) and `--lr-segmented-hover-shadow`
(default `none`) style that same hovered segment's background and box shadow; both are undeclared by
default, so they fall back to the segment's own resting values and change nothing about today's
hover paint until set. These seven state hooks are inline `var()` fallbacks at the
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
  seg.addEventListener("lr-activate", (e) => console.log("activated", e.detail.value));
</script>
```

**Known gotchas:**

- arrow-key navigation cycles (past the last non-disabled item wraps to the first, and vice versa)
  rather than clamping at the first/last item, unlike `lr-stepper`'s clamped Left/Right.
- this component self-selects on navigation: clicking or arrow-navigating to an item immediately
  updates `value` and fires `lr-change` — there's no separate "commit" step the way, e.g.,
  `lr-select`'s popup has. `lr-change` is change-only, so re-picking the segment that is already
  selected fires nothing on it; listen for `lr-activate` if a repeat pick is meaningful to
  your application.
- the semantic `radiogroup` lives inside shadow DOM. Set `label` (preferred for reactive code) or a
  host `aria-label`; a present host attribute wins, including an explicit empty value, and the
  component deliberately forwards the resulting name to that internal role.

**Additional API surface:**

- `--lr-segmented-track-gap` — Gap between segments. Default: `var(--lr-size-0-125rem)`.
- `--lr-segmented-track-radius` — Track corner radius. Default: `var(--lr-radius)`.
- `--lr-segmented-segment-radius` — Each segment's own corner radius, independent of the track's.
  Default: `calc(var(--lr-form-control-radius) * 0.7)`.
- `--lr-segmented-track-padding` — Track inset padding. Default: `var(--lr-size-0-125rem)`.
- `--lr-segmented-track-bg` — Background of the `base` track. Undeclared by default (transparent),
  matching its own current absence of a background.
- `--lr-segmented-track-border-color` — Border color of the `base` track, which previously read
  `--lr-color-border` as a literal with no override hook. Default: `var(--lr-color-border)`.

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
- `source?: LyraVirtualListSource` (attribute: false) — a readonly array or a count/index-backed
  `{ readonly count: number; itemAt(index): unknown; keyAt?(index): string | number;
indexOfKey?(key): number }`. When set it takes precedence over `items`. The indexed form performs
  bounded random access for only the rendered window instead of allocating `0…count`; invalid counts
  normalize to zero. Prefer a stable object identity and stable `keyAt`/`indexOfKey` implementations
  for synthetic, paged, or remote collections. `indexOfKey` is required when `active-item-id` should
  target an indexed source: the list never performs a count-sized fallback scan; invalid or
  out-of-range results mean no match. An array source receives the same clone-owned frozen sequence
  and row-identity contract as `items`; an indexed-source object passes through by identity.
- `renderItem: (item: unknown, index: number) => unknown = () => nothing` (attribute: false) — renders
  one row's content, typically returning a `lit-html` `TemplateResult`. JS-only. The returned value
  is stamped inside `<lr-virtual-list>`'s own shadow root, not the caller's light DOM, so
  document-level selectors cannot style arbitrary returned descendants. Use inherited custom
  properties, the public row parts, or a self-styled custom element in the returned template.

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
- `groups?: LyraVirtualListGroup[]` (attribute: false) — renders a labeled marker at each group's
  `startIndex` as a measured virtual entry immediately before that row. Its live block size
  contributes to every following offset, so a variable-height or late-resizing marker never covers
  the group's first row. Markers remain windowed with their rows. Groups are sorted by `startIndex`;
  a non-object entry or a `startIndex` that's non-integer, out of range, or a duplicate of an earlier
  group's is silently dropped rather than rendered wrong. An entry whose
  `label` is the **empty string** renders no marker at all — it is a pure position anchor, for a host
  that renders its own group header as an ordinary row (and would otherwise end up with two stacked
  headers) but still needs this component to know where each group starts, e.g. to drive
  `renderStickyGroup` below. Omitting `label` entirely still falls back to rendering `key`.
- `renderStickyGroup?: (group: LyraVirtualListGroup) => unknown` (attribute: false) — renders a pinned
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
- `rowProjection: 'shadow' | 'light' = 'shadow'` (attribute `row-projection`) — where
  `renderItem`'s output is instantiated. `'shadow'` (default) stamps it inside this component's own
  shadow root, so only inherited custom properties and the public row parts reach it. `'light'`
  renders the windowed rows into the host's own light DOM instead, assigned into the shadow viewport
  through internal named slots, so ordinary document CSS styles a virtualized row exactly as it
  styles the same row unvirtualized. The component keeps owning windowing, measurement, spacer
  sizing, `scrollToIndex()`, the external-scroller mode and the ARIA contract either way, and
  positioning stays on the shadow-side `[part="row"]` wrapper that document CSS cannot select — so
  consumer styles can never break windowing. Any other value canonicalizes to `'shadow'`. Left
  unset, the rendered output is byte-identical to before and the host's light DOM stays empty.
  See **Light-DOM row projection** below for the trade-offs it carries.
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
- `scrollElement?: Element | Window` (attribute: false) — an ancestor that already owns a scrollbar,
  or the window itself, for a list embedded in a longer scrolling page rather than sized as its own
  panel. JS-only; set via a property/lit-html binding. While set, `[part="base"]` stops scrolling and
  grows to the list's full virtual extent, so the page's single scrollbar spans the whole list and
  `[part="sticky-group"]` sticks to that outer scrollport instead of this component's. Everything
  expressed in list coordinates keeps answering in list coordinates — `offsetForIndex()`,
  `indexAtOffset()`, `scrollToIndex()`, `active-item-id` scroll-into-view, and `lr-virtual-scroll`'s
  `scrollTop` are all still measured from the top of the list, with the component converting to and
  from the external scroller's position; auto-height scroll anchoring moves the external scroller
  too, so measuring a row above the viewport does not make the page jump. There is deliberately no
  ancestor auto-detection: the scroller is the element you name and nothing else, so adding an
  unrelated `overflow` rule to some wrapper can never silently take the job over. Two consequences:
  `[part="base"]` drops its `tabindex` and its hover outline, because it is no longer a scrollable
  region and a focus stop that scrolls nothing is worse than none — keyboard scrolling belongs to the
  external scroller; and horizontal scrolling of row content that opted out of wrapping becomes the
  external scroller's responsibility, since CSS cannot leave one axis visible while the other
  scrolls. The list's position inside the scroller is re-read on scroll, on the scroller's own
  resize, and whenever the list re-renders; a layout change _above_ the list that shifts it without
  any of those happening is not observable, so re-assign the property to force a re-read. Listeners
  follow the property — re-pointing it, disconnecting, and reconnecting all rebind against the
  current target and leave nothing behind on the previous one. A value that is neither an `Element`
  nor a `Window` is ignored and the list keeps scrolling its own viewport, so wiring this from a ref
  that is still empty on a first render is safe.

**Exported types:** `LyraVirtualListRowHeight = number | 'auto'`;
`LyraVirtualListSource<T> = readonly T[] | LyraVirtualListIndexedSource<T>` and
`LyraVirtualListIndexedSource<T> { readonly count: number; itemAt(index): T; keyAt?(index): string |
number; indexOfKey?(key: string | number): number }`; `LyraVirtualListRange { start: number; end: number }` (the `lr-visible-range-change`
detail shape); `LyraVirtualListGroup { key: string | number; label?: string; startIndex: number }` — the
shape consumed by `groups` above; `LyraVirtualListScroll { scrollTop: number; viewportHeight: number }` —
the `lr-virtual-scroll` detail shape.
`groupByRecency(items, options?)` is a DOM-free helper that returns non-empty
Today/Yesterday/Previous 7 Days/Older buckets, preserves input order within each bucket, and accepts
a timestamp extractor, reference date, and label overrides. Import it from its granular subpath —
the package root also re-exports it without registering custom elements, while the granular
route limits the named-export module graph. `@aceshooting/lyra-ui/all.js` is the separate eager
registration entry:

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
the scroll container's `scrollTop`; under an external `scrollElement` that space is unchanged — it
measures from the top of the list itself, not from the top of the external scroller's content, and
the component converts between the two. It is clamped to `0…count`, so `offsetForIndex(count)`
is the total content height and an empty list is always `0`. `indexAtOffset(px)` is its inverse — the
row whose box contains that offset, clamped at both ends, `-1` for an empty list — so
`indexAtOffset(offsetForIndex(i)) === i` and `indexAtOffset(scrollContainer.scrollTop)` is the row at
the top of the viewport. In `row-height="auto"` mode both are estimate-based for any row that (or
above which) has not been measured yet, and converge as those `ResizeObserver` measurements land;
fixed numeric `row-height` offsets are exact from the first render. Both read the most recent render,
so `await el.updateComplete` after assigning `items` or `source` before querying.

**Getters:** `scrollContainer: HTMLElement | undefined` — the real scroll container (`[part="base"]`),
`undefined` before the first render; for a host that needs the live scroll position or wants to scroll
the list itself without reaching into the shadow root. While `scrollElement` is set this element
still exists and still hosts every row, but it no longer scrolls — read and write the position on the
external scroller, or keep using `scrollToIndex()`, which targets whichever of the two is currently
in charge. `renderedRows: HTMLElement[]` — the row
wrappers (`[part="row"]`) that currently exist as real DOM, in item order (the current window, not the
whole collection; empty before the first render). It exists for hosts that must _reach_ a rendered row
rather than style it — keyboard focus management across a windowed list, where the row to focus may
not have existed a frame earlier, and which `exportparts` cannot serve since it forwards styling, not
element references. Treat both as read-only: positioning, keys, and lifetime belong to the windowing
math, and any row element can be recycled or removed on the next update.

**Events:** `lr-load-more` (no detail — fired once per approach to the bottom of the list while
`has-more` is true and `loading` is false; does not refire on every scroll tick while still near the
bottom — scrolling back away from the bottom and returning, or `items` growing enough to move the
window away from the end, re-arms it), `lr-visible-range-change` (`detail: LyraVirtualListRange`, the
current visible, non-overscanned item index range — fired only when it actually changes; it was
spelled `lr-visible-range-changed` before 10.0.0, the only past-tense `-changed` spelling among 58
`-change`-family events, so a convention-driven `lr-${x}-change` listener silently missed it),
`lr-virtual-scroll`
(`detail: LyraVirtualListScroll` — the scroll container moved. `scrollTop` is always in the list's own
offset space (`offsetForIndex()`'s space), including under an external `scrollElement`, where it is how
far the list has scrolled past the top of that scroller rather than the scroller's own position;
emitted from the same animation frame that
already coalesces native `scroll` events, so a fling produces at most one per frame and none at all
when the position did not change. Unlike `lr-visible-range-change`, which only fires on index-range
changes, this reports _sub-row_ movement, which is what scroll-linked layout needs)

**Slots:** none — all content comes from `renderItem`.

**CSS parts:** `base` (the scrollable container, `role="list"` — or `role="rowgroup"` in
`item-role="row"` mode — `tabindex="0"`; under an external `scrollElement` it stops scrolling, drops
that `tabindex` and its hover outline, and sizes itself to the list's full virtual extent instead of
`--lr-virtual-list-height`), `spacer` (the full-content-height inner element
establishing true scroll extent; `role="presentation"` in `item-role="row"` mode), `row` (one
rendered row's absolutely-positioned wrapper, `role="listitem"` — or `role="row"` with
`aria-rowindex` in `item-role="row"` mode), `group` (a `groups` entry's positioned marker; not
rendered for an entry whose `label` is the empty string), `sticky-group` (the pinned copy of the
current group, present only while `renderStickyGroup` is set — `aria-hidden`, `inert`, and
pointer-transparent, and it shows nothing while the viewport is above the first group)

**Themeable custom properties:** `--lr-virtual-list-height` (default `24rem` — the host's bounded
scroll extent; component-specific since a virtualized list is meaningless without a sized viewport,
and ignored while `scrollElement` names an external scroller, whose own height is the visible band),
plus shared `--lr-focus-ring-width/-color/-offset` (inward-offset ring on `[part="base"]`, negative
so it isn't clipped by the container's own `overflow: auto`). `[part="base"]` also carries a
mouse-hover outline — a subtler preview of that same `:focus-visible` ring, shown because the part
carries `tabindex="0"` and is a real keyboard-navigable target whenever it owns the scrollport (both
the tab stop and this outline are dropped under an external `scrollElement`) — tinted via
`--lr-virtual-list-hover-outline-color` (default `var(--lr-color-border-strong)`); set it to
`transparent` to opt out of the hover treatment entirely. Its remaining longhands are independently
themeable with `--lr-virtual-list-hover-outline-width` (default
`var(--lr-border-width-thin)`), `--lr-virtual-list-hover-outline-style` (default `solid`), and
`--lr-virtual-list-hover-outline-offset` (default
`calc(-1 * var(--lr-border-width-thin))`). All four hover-outline hooks are inline fallbacks and
there is intentionally no pressed state: the list viewport is a scroll surface rather than an
activation target. `[part="base"]` also honors the opt-in theme-level
`--lr-theme-scrollbar-width`/`--lr-theme-scrollbar-gutter` hooks (defaults `auto`/`auto`, matching
its previous unconditional `scrollbar-width: auto`) — set either on `:root` or any ancestor for one
declaration to retheme every internal scroll container in the library, including `lr-table`,
`lr-scroller`, `lr-carousel`, `lr-code-block`, and `lr-code-editor`.

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
  an `<lr-dropdown>` popup containing a row-action menu, a tooltip, an outward focus ring — is therefore painted
  _underneath_ every following row, no matter how high its own `z-index` is: that `z-index` only
  orders siblings inside the row's own context. The last row always looks correct, which is exactly
  why the failure tends to hide in short lists. A row lifts to `--lr-layer-content` while something
  inside it holds focus or while it contains an open `lr-dropdown`. The explicit dropdown-open branch covers
  imperative opening and virtual measurement/render cycles, where focus can temporarily return to
  the document while the popup remains visible. The value deliberately _matches_
  `[part='group']`'s rather than exceeding it, so the two land on the same layer and DOM order
  decides: groups render before the rows, so an active row wins while (and only while) it needs to,
  which is right — a group header is a non-interactive `pointer-events: none` label.

### Light-DOM row projection

`rowProjection="light"` exists for one shape: an application whose list rows are already styled by
its own global stylesheet, and which therefore could not adopt virtualization without rehoming a
dozen descendant rules per row into a new custom element or a growing set of custom properties. In
projection mode the windowed rows render into the host's own light DOM, so ordinary document CSS
reaches row content directly.

Positioning, measurement and semantics stay where they were. The `[part="row"]` wrapper remains in
the shadow root and keeps `position: absolute`, the per-frame `transform`, `role`, `aria-setsize`/
`aria-posinset` (or `aria-rowindex`) and the `ResizeObserver` box — document CSS cannot select it,
so consumer styles can never break windowing. The whole part vocabulary (`base`, `spacer`, `row`,
`group`, `sticky-group`) keeps matching in both modes, and `row-height="auto"` still measures
projected content because the light row is an ordinary in-flow child of that wrapper.

`projectedRows: HTMLElement[]` returns the projected light-DOM row wrappers in item order, and is
empty outside projection mode. The exported type is `LyraVirtualListRowProjection`; the reserved
attributes marking library-owned light-DOM nodes are exported as `VIRTUAL_LIST_ROW_ATTRIBUTE`
(`data-lr-virtual-list-row`) and `VIRTUAL_LIST_STICKY_ATTRIBUTE` (`data-lr-virtual-list-sticky`).

**Known gotchas, all inherent to handing the cascade back to the consumer:**

- **One component-owned wrapper sits between the host and your markup.** A slot cannot assign a text
  node or a multi-root fragment by attribute, so each row's content lives inside a wrapper carrying
  `data-lr-virtual-list-row`. Descendant selectors (`lr-virtual-list .row-title`) port unchanged;
  child combinators (`lr-virtual-list > .row`), `:nth-child`, `:first-child` and sibling combinators
  written against the unvirtualized markup do not. `:nth-child` on the wrappers reflects the current
  *window*, not the item index.
- **`closest('[part="row"]')` stops resolving.** A delegated listener on the host now sees an
  un-retargeted `event.target` inside the light DOM. Use `closest('[data-lr-virtual-list-row]')`.
- **The document cascade now reaches row content**, including resets and element-level rules that
  previously could not, so a projected row can look different from the same row in shadow mode.
- **Per-row light-DOM state does not survive a disconnect/reconnect.** Disconnect removes the
  projected rows completely (no rows, no markers, no anchor left behind), so a reparenting move
  rebuilds them. Scroll position, measurements and the window are unaffected — they live in
  component state, not in the rows.
- **Projection activates one task after hydration.** A server render has no DOM to project into, so
  the first window is shadow-rendered, hydration matches the server markup, and the rows then swap
  into the light DOM on the next task.
- **A row taken out of flow collapses its wrapper.** `position: fixed`/`absolute` or
  `display: none` on your own row leaves nothing for the wrapper to measure.

---

## `lr-app-rail`

A responsive navigation rail, and the library's application sidebar, that adapts across three presentations as the _viewport_ narrows (not
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

In mobile mode the closed `[part="panel"]` has no shadow and parks one pixel beyond the inline-start
edge, including at fractional widths. The open-only `--lr-app-rail-panel-shadow` defaults to
`var(--lr-shadow-l)`. Elevation snaps with the open state while the panel slides. Only real open/close
changes animate: runtime direction changes and entering mobile mode leave a closed panel parked
without a sweep. Closed content remains inert. Keep the rail outside ancestors establishing a fixed
containing block (`transform`, `filter`, `will-change: transform`, or layout/paint containment),
because geometric parking otherwise follows that ancestor's edge instead of the viewport.

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
automatically regardless — it's only consulted while `forceMode` is `'auto'` or unset; an explicit
`forceMode` value takes full priority. A `preferredMode` restored from `localStorage` on mount is
observable the same way a live change is: it fires `lr-mode-change` too (see **Events** below),
letting a consumer that syncs app chrome to the rail's mode pick up the restored value on load.

**Properties:**

- `frame?: LyraFrame` — optional `'card'` floating frame or `'plain'` edgeless inline surface.
  Unset retains the flush rail. Unknown values clear the attribute. In mobile mode framing is inert.
- `triggerCollapses: boolean = false` (attribute `trigger-collapses`) — extend the `trigger`/`for`
  association to full/icon-only modes, managing `aria-expanded`, `aria-controls` and
  `aria-keyshortcuts`. Wire the trigger's click to `toggle()`. Independent of `collapsible`, which
  alone decides whether the built-in collapse control renders.
- `hotkey: string = ''` — optional chord such as `mod+b`, `ctrl+b`, `meta+b`, or `alt+b`.
  Requires a non-Shift modifier. Removing the attribute restores the empty default. See the shortcut
  behavior below.


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
  while `mode` is `'mobile'`; leaving mobile mode closes it so a later mobile transition cannot
  restore a stale modal. Set this directly, or use the built-in toggle button — there is no separate
  `show()`/`hide()` pair.
- `label?: string` — optional accessible name for the rail's navigation landmark and mobile dialog.
  Every nonempty supplied string is honored literally; only absence/empty uses the localized
  navigation fallback. A host-level `aria-label` attribute (including an explicit empty value)
  takes precedence.
- `preferredMode?: 'full' | 'icon-only' | null` (attribute `preferred-mode`) — manually prefers
  `'full'` or `'icon-only'` for the non-mobile breakpoint axis, while `mobile-breakpoint` continues to
  be tracked automatically regardless — e.g. a user's manual collapse toggle that should still yield
  to a genuinely too-narrow-for-any-inline-rail viewport. Only consulted while `forceMode` is
  `'auto'` or unset (see above); an explicit `forceMode` value takes full priority.
  Unset (the default, `null`) reproduces the original breakpoint-only behavior exactly.
- `collapsible: boolean = false` (reflected) — opts in a desktop collapse control rendered inside
  `[part="header"]`. It flips the rail between its `'full'` and `'icon-only'` presentations by
  writing `preferredMode`, so the `mobile-breakpoint` keeps being tracked automatically and a
  genuinely too-narrow viewport still wins. The control is not rendered at all while `mode` is
  `'mobile'`, and `[part="header"]`'s layout is unchanged when this is unset. The collapse survives
  a reload only when `storage-key` is set AND `persist` includes `preferred-mode` — the default
  `persist` is `open width`, which does not. Pair them: `persist="width preferred-mode"`. Either
  route announces itself through the existing `lr-mode-change` event; there is no new event.
- `hideToggle: boolean = false` (reflected, attribute `hide-toggle`) — suppresses the built-in mobile
  `[part='toggle']` hamburger/OPEN button, for a consumer that already owns an external mobile-menu
  trigger wired to this rail's own `open` property (pair it with `trigger`/`for` below so focus
  still returns to that external trigger on close). `false` (the default) reproduces the exact
  existing output. This does not remove the button once the overlay is open: at that point it has
  been reparented inside the trapped `[part="panel"]` (see the CSS parts entry below) as the
  panel's only in-panel dismiss control, and hiding it there too would leave the open panel with no
  in-panel way to close it at all besides Escape/backdrop.
- `trigger: HTMLElement | null = null` (attribute: false) — direct reference to an external element
  that opens this rail's mobile overlay (e.g. an application-chrome hamburger button used together
  with `hideToggle`). When set (or resolved through `for`), closing the overlay by any path —
  Escape, backdrop click, a nav-item click, or the built-in toggle itself — returns focus to it, the
  same guarantee the built-in toggle's own click already gets. Needed because a consumer's own
  JS-driven `open = true` never focuses anything, and even a real click does not reliably focus its
  target in every browser. Resolved once when the overlay opens; reassigning afterward changes the
  return target for the remainder of that overlay's open lifetime. Read alongside `for`; this direct
  reference wins when both resolve to different elements. Unset (the default, `null`) reproduces the
  exact existing behavior: only the built-in toggle's own click supplies a return target, for that
  interaction alone. The resolved trigger also receives `aria-expanded` (rendered in both states)
  and `aria-controls` pointing at the rail's own panel, so an external control announces the
  overlay's state across the shadow boundary. Because a light-DOM element cannot hold a raw
  reference into another element's shadow tree, engines resolve `aria-controls` to the
  `<lr-app-rail>` host itself; either resolution is correct. The association applies while `mode` is
  `'mobile'`, or in full/icon-only when `trigger-collapses` is set; otherwise it is released.
  Disconnect also releases it, and reassigning `trigger` moves the state to the new element.
- `for: string = ''` — id of an external element that opens this rail's mobile overlay, the
  label/`htmlFor`-style alternative to assigning `trigger` directly (mirrors `<lr-page-rail>`'s
  `for`). Resolved against this element's own root (shadow root or document) when the overlay opens.
  Ignored once `trigger` is itself set.
- `resizable: boolean = false` (reflected) — opts a continuously draggable width in for the `'full'`
  state, exposing a `[part='resizer']` handle clamped to `[minRailWidthPx, maxRailWidthPx]`. `false`
  (the default) renders no resizer and leaves the fixed-width `--lr-app-rail-width` CSS token
  exactly as before this property existed.
- `railWidthPx?: number` (attribute `rail-width-px`) — the rail's current width in px while
  `resizable`; settable/gettable directly. Unset defers to `--lr-app-rail-width`'s own resolved
  width.
- `storageKey?: string` (attribute `storage-key`) — when set, persists the fields selected by
  `persist` to `localStorage` under `lr-app-rail:${storageKey}` and restores them on the next
  mount. Each field is restored only when the consumer has not assigned it on that same mount: an
  `open`/`rail-width-px`/`preferred-mode` attribute, or a `.open=${false}`-style binding, wins over
  stored state, and a restored `open` fires no `lr-toggle`. Effective `mode` is breakpoint-derived
  and never persisted. Unset means no persistence.
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

**Methods:** `toggle(): void` opens/closes the mobile overlay through cancelable `lr-toggle`, or
flips the full/icon-only preference. It is a no-op while disconnected. While pinned, it records
only the preference; releasing `forceMode` applies it.

`toggleCollapse(): void` performs the same `'full'`/`'icon-only'` flip `collapsible`'s
built-in control does, for a consumer rendering its own control (app chrome, a command palette, a
keyboard shortcut). A no-op while `mode` is `'mobile'`. While `forceMode` pins the mode the
preference alternates relative to `preferredMode ?? mode` on every call and takes effect once the pin is released.

**Events:** `lr-mode-change` (`detail: LyraAppRailModeChangeDetail` = `{ mode: LyraAppRailMode }`; the
effective mode changed, whether from a breakpoint crossing, a `forceMode` assignment, or a
persisted `preferred-mode` restored on mount (`storage-key` + `persist="preferred-mode"`) — the
restored-on-mount case fires once, from the first `updated()` after that mount's render and
attribute reflection have both landed, rather than synchronously during the mount itself; it is
not fired for a redundant reassignment to the mode already in effect, nor when no preferred mode
was persisted), `lr-toggle`
(`detail: LyraAppRailToggleDetail` = `{ open: boolean }`; the mobile overlay is opening or closing — via
the built-in toggle button, Escape, a backdrop click, a nav-item click while open, or a
breakpoint/forced mode change leaving `'mobile'` while open — not fired when a consumer sets `open`
directly. Cancelable for every trigger except the forced mode-change close, which always applies —
vetoing that one would leave `open` stuck `true` in a mode where it's meaningless; call
`preventDefault()` to keep the overlay as it is for the other triggers),
`lr-rail-resize-request` (`detail: LyraAppRailResizeDetail` = `{ widthPx: number }`; a cancelable
proposed width from drag or keyboard stepping, emitted before the component assigns
`railWidthPx` — call `preventDefault()` to keep the current width. A synchronous request listener
that disables resizing, leaves full mode, or disconnects the rail also cancels the proposal,
preserving any width the listener assigned and publishing no accepted resize. Assigning only
`railWidthPx` does not veto the proposal. It is not fired when a consumer sets `railWidthPx` directly), and `lr-rail-resize` (`detail: LyraAppRailResizeDetail` =
`{ widthPx: number }`; non-cancelable committed width, emitted immediately for a genuine keyboard
step and once at pointerup for a genuine drag. Clamped/no-op steps, canceled/lost gestures, and
consumer property writes emit no committed event).

**Slots:** default (nav items — generic slotted content, e.g. `<a>`/`<button>` elements the consumer
builds with its own icon+label structure; clicking anywhere in this slot closes the mobile overlay if
open), `header` (logo/brand content, shown above the nav items in every mode), `footer` (a trailing
user/settings trigger, shown below the nav items).

**CSS parts:** `base`, `header`, `nav`, `footer`, `toggle` (hidden via CSS outside `'mobile'` mode, or
-- while it is not also serving as the panel's only in-panel dismiss control -- via `hideToggle`;
reparented to be the first child of `[part="panel"]` for exactly as long as the mobile overlay is
open, so the shared focus trap, scoped to the panel alone, can reach it and Tab cycles through it
like `<lr-dialog>`'s in-panel close button, then moved back to its resting position, a sibling
immediately ahead of `[part="panel"]`, once closed; the same button element is reused throughout,
never destroyed/recreated, so a reference captured before opening remains valid after closing, and
it renders as its own reserved row ahead of the `header` slot rather than an absolute overlay on
top of it, so a wide/slotted header is never obscured), `backdrop`, `panel` (`base`/`panel` are mutually exclusive on the same
underlying element — see above), `resizer` (the `resizable` opt-in's drag handle, only rendered while
`resizable` and `mode` is `'full'`; its hit target is `--lr-icon-button-size`-wide), `resizer-track`
(the slim 3px visible drag line centered inside that hit target, tinted `--lr-color-brand` on hover),
`collapse-toggle` (the opt-in desktop collapse control, rendered inside `[part="header"]` only while
`collapsible` is set and `mode` is not `'mobile'`; it renders `aria-expanded` in both states, points
`aria-controls` at `[part="nav"]` — the item list whose presentation actually changes, never the
containing `[part="base"]`/`[part="panel"]` — and takes a localized name from the
`appRailCollapse`/`appRailExpand` keys) and `collapse-icon` (the chevron wrapper, mirrored by its own
`transform` under RTL). Collapsing to `'icon-only'` keeps each item's own accessible name and
clips its `label`/`meta` visually, while hiding nested disclosure controls and child lists — so `aria-expanded` reports which of the two
presentations is on screen, for magnifier and braille users, rather than announcing hidden content.

**Themeable custom properties:**
`--lr-app-rail-frame-gap` (default `var(--lr-space-s)`), `--lr-app-rail-frame-radius` (default
`var(--lr-radius)`), and `--lr-app-rail-frame-shadow` (default `var(--lr-shadow-s)`) customize a
card frame. The card host uses `display: flow-root` to contain its margins; a consumer overriding
host `display` owns that formatting context. Plain frames default to a transparent background,
while an explicit `--lr-app-rail-background` still wins. Forced colors restores the plain frame's
boundary. `--lr-app-rail-panel-shadow` (default `var(--lr-shadow-l)`) affects only the open mobile
panel; no value can paint elevation while closed. Prefer that token over an unqualified
`::part(panel)` shadow rule, which would also paint while closed; state-scope a part override with
`lr-app-rail[mode="mobile"][open]::part(panel)`.

Other hooks: `--lr-app-rail-width` (default `15rem` — the inline rail width in
`'full'` mode), `--lr-app-rail-icon-width` (default `4rem` — the inline rail width in `'icon-only'`
mode), `--lr-app-rail-mobile-width` (default `18rem`, capped at `85vw` — the mobile overlay panel
width), `--lr-app-rail-overlay-color` (default `var(--lr-color-overlay)` — the mobile backdrop scrim
color; component-specific since no shared token exists), `--lr-app-rail-panel-inset-block-start`
(default `0`, applied to both `[part="panel"]` and `[part="backdrop"]` — raise it to leave room for
a fixed app bar/status area above the drawer instead of the panel/scrim starting flush with the
viewport top), `--lr-app-rail-panel-radius` (default `0` — uniform corner radius of `[part="panel"]`;
pairs naturally with a nonzero `--lr-app-rail-panel-inset-block-start`, which exposes the panel's top
corners). Four direction-aware per-corner tokens each default to `--lr-app-rail-panel-radius`, so
setting only the uniform token still rounds all four corners exactly as before:
`--lr-app-rail-panel-radius-start-start` and `--lr-app-rail-panel-radius-end-start` (logical
`border-start-start-radius`/`border-end-start-radius` — the two corners at the panel's own flush
inline-start edge, since the drawer always sits flush against `inset-inline-start: 0`) and
`--lr-app-rail-panel-radius-start-end`/`--lr-app-rail-panel-radius-end-end` (logical
`border-start-end-radius`/`border-end-end-radius` — the two corners away from that flush edge, the
pair a flush-against-one-edge drawer typically rounds). All four are logical, so which physical
corner each one paints swaps under `dir="rtl"` with no second consumer rule.
`--lr-app-rail-panel-overflow-block` (default `auto`) and
`--lr-app-rail-panel-overflow-inline` (default `clip`) — `[part="panel"]`'s logical overflow axes;
either non-`visible` value clips a `position: fixed` popup opened by a slotted/nav-item control
(e.g. a slotted `<lr-select>`/`<lr-menu>`) whenever its rendered box extends past the panel,
regardless of that popup's own containing block. Per the CSS overflow spec, a lone `visible` axis
paired with a non-`visible` other axis computes as `auto` instead (still clipping) — set **both**
tokens to `visible` together to actually stop the clipping, accepting that wide header/footer
content can then scroll/bleed both ways. `--lr-app-rail-background` (default
`var(--lr-color-surface)` — `[part="base"]`'s background, the docked non-overlay presentation) and
`--lr-app-rail-panel-background` (default `var(--lr-color-surface-overlay)` — `[part="panel"]`'s
background, the mobile overlay presentation; kept separate from `--lr-app-rail-background`/
`--lr-app-rail-overlay-color` since the panel is deliberately themed as a modal surface, not the
docked rail chrome). `--lr-app-rail-header-padding` and `--lr-app-rail-footer-padding` (both default
`var(--lr-space-m)`) retune `[part="header"]`/`[part="footer"]`'s padding independently.
`--lr-app-rail-header-min-block-size` (default `auto`, the property's own initial value, so unset
reproduces today's exact height) reserves a minimum height for `[part="header"]`, for content that
mounts or resizes asynchronously. `--lr-app-rail-nav-padding` and `--lr-app-rail-nav-gap` (default
`var(--lr-space-s)`/`var(--lr-space-xs)`, the values this rule hard-coded before either token
existed) retune `[part="nav"]`'s own padding and inter-item gap — the rail's vertical rhythm,
previously reachable only through `::part(nav)`. Plus shared
tokens (`--lr-color-border`, `--lr-color-border-subtle`,
`--lr-color-surface`, `--lr-color-text`, `--lr-color-brand`, `--lr-color-brand-quiet`,
`--lr-space-*`, `--lr-radius`, `--lr-shadow`, `--lr-icon-button-size`,
`--lr-focus-ring-*`, `--lr-transition-base`). The rail's inline-end edge and its header/footer rules
use the decorative `--lr-color-border-subtle`, except while the resizer renders (`resizable` in
`'full'` mode): its track is transparent at rest, so the edge is then the separator's only visible
mark and stays on `--lr-color-border`. `resizable`'s width is driven entirely by
`railWidthPx`'s inline `inline-size` style rather than a new custom property.
The mobile toggle's hover/pressed background and foreground are independently inheritable through
`--lr-app-rail-toggle-hover-bg`, `--lr-app-rail-toggle-hover-color`,
`--lr-app-rail-toggle-active-bg`, and `--lr-app-rail-toggle-active-color`. `[part="collapse-toggle"]`
has the matching set: `--lr-app-rail-collapse-toggle-hover-bg` (default
`var(--lr-color-brand-quiet)`), `--lr-app-rail-collapse-toggle-hover-color` (default
`var(--lr-color-brand)`), `--lr-app-rail-collapse-toggle-active-bg` (no default) and
`--lr-app-rail-collapse-toggle-active-color` (default `var(--lr-color-brand)`). The resizer track uses
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
rail.forceMode = "icon-only"; // force a presentation regardless of viewport width
rail.forceMode = "auto"; // release the force, resume live breakpoint tracking
```

The package root also exports a pure `computeAppRailMode(iconOnlyMatches: boolean, mobileMatches:
boolean, preferredMode?: 'full' | 'icon-only' | null): LyraAppRailMode` resolver (plus the
`LyraAppRailMode`/`LyraAppRailModeInput`/`LyraAppRailPreferredMode`/`LyraAppRailPersistField`/
`LyraAppRailModeChangeDetail`/`LyraAppRailToggleDetail`/`LyraAppRailResizeDetail` types) — the same
logic the element's internal `matchMedia` listeners call, exposed standalone so a
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

- `mode` is the readonly `LyraAppRailMode` result. `forceMode` accepts the non-mobile
  `LyraAppRailPreferredMode` values plus the `'auto'` release sentinel, so whether the rail is
  pinned or tracking the viewport remains directly observable.
- reassigning `icon-only-breakpoint`/`mobile-breakpoint` after first render tears down and rebuilds
  the `matchMedia` listeners, but does not itself clear `forceMode` — if a consumer set
  `forceMode = 'icon-only'`, changing the breakpoints won't resume auto-tracking until
  `forceMode = 'auto'` is set explicitly.
- leaving `'mobile'` mode while `open` (via a breakpoint crossing or a `forceMode` reassignment)
  auto-closes the overlay through the same path as the toggle button, so `lr-toggle` still fires
  and the scroll lock/focus trap still release normally — a consumer listening only for explicit
  toggle-button clicks would miss this closure.
- the mobile panel is also given `inert` whenever `mode === 'mobile'` and `open` is `false` — it's
  removed from the accessibility tree and tab order via `inert` at the same time it's hidden visually
  via `transform: translateX(calc(-100% - var(--lr-size-1px)))`, both applied simultaneously rather than one implying the other.
- the offscreen slide direction for the mobile panel is flipped for RTL via a `:dir(rtl)` CSS
  selector (`translateX(calc(100% + var(--lr-size-1px)))`), not through the shared `internal/rtl.ts` JS helper used for pointer/
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
- the built-in toggle physically moves in the DOM: it is a sibling immediately ahead of
  `[part="base"]`/`[part="panel"]` while closed (or outside mobile mode), and the first child of
  `[part="panel"]` while the mobile overlay is open. This is a real reparent via `insertBefore`
  (not a template-conditional recreate), so an event listener or a captured element reference
  stays valid across the transition — a MutationObserver watching a specific fixed container would
  still need to account for the move.
- opening the mobile overlay moves initial focus to the first focusable nav item (or the panel
  itself when nothing in the slotted content is focusable), never to the toggle — even now that
  the toggle lives inside the panel as its structurally-first child. Tab still reaches it as part
  of the trap's normal cycle.

### Building an app sidebar

The rail's shortcut uses the same grammar and per-window owner registry as `lr-command-palette`.
The last-connected eligible owner acts once. Rails ignore repeat/composition/key-less events,
`defaultPrevented`, text-entry and contenteditable targets, invisible/inert rails, and pinned modes.
A pinned rail still accepts explicit `toggle()` calls to record a preference. Chords match the
printed key; ASCII letter/digit chords fall back to `event.code` only when the event key is
non-ASCII, preserving Dvorak/AZERTY printed-letter behavior. Mod resolves to Meta on macOS and
Control elsewhere. Built-in controls and applicable external triggers expose `aria-keyshortcuts`.
`lr-button` and `lr-icon-button` forward this and `aria-expanded` to their focused control; other
custom triggers must implement forwarding themselves. Cross-shadow element-reference
`aria-controls` forwarding by those custom triggers is not claimed.

A hidden rail is not a desktop-offcanvas mode: `toggle()` never clears `hidden`, hotkeys ignore it,
and a `trigger-collapses` trigger reports the last inline presentation. Collapse normally preserves
focus. A focused resizer returns focus to the rail, and a hidden nested control returns it to the
visible parent item.

**Standalone recipe: viewport offcanvas, one trigger.**

```html
<div class="shell">
  <lr-app-rail id="sidebar" label="Workspace" frame="card" hide-toggle trigger-collapses
    for="sidebar-trigger" hotkey="mod+b" storage-key="app" persist="preferred-mode">
    <lr-app-rail-group heading="Platform">
      <lr-app-rail-item href="/projects" current tooltip><span slot="icon">▦</span>Projects</lr-app-rail-item>
    </lr-app-rail-group>
    <lr-divider></lr-divider>
  </lr-app-rail>
  <main><button id="sidebar-trigger" type="button">Toggle sidebar</button></main>
</div>
```

```css
.shell { display: flex; block-size: 100dvh; }
.shell main { flex: 1; min-inline-size: 0; }
lr-app-rail lr-divider { align-self: stretch; }
```

```js
const rail = document.getElementById('sidebar');
document.getElementById('sidebar-trigger').addEventListener('click', () => rail.toggle());
```

Import the rail, group, item and divider from their granular `components/lr-*.js` entries. The
rail owns mobile offcanvas at its viewport breakpoint (600px default). For an inset composition,
use `frame="plain"` and style the sibling main region as a card with surface, radius, border and
shadow tokens. A raised sidebar tint is opt-in with
`--lr-app-rail-background: var(--lr-color-surface-raised)`.

**Page recipe: allocation offcanvas, two view-scoped controls.**

```html
<lr-page id="workspace">
  <lr-app-rail slot="navigation" id="workspace-nav" label="Workspace" frame="plain"
    mobile-breakpoint="0px" icon-only-breakpoint="0px" collapsible hotkey="mod+b"
    storage-key="app" persist="preferred-mode">
    <lr-app-rail-item href="/projects"><span slot="icon">▦</span>Projects</lr-app-rail-item>
  </lr-app-rail>
  <p>Main content</p>
</lr-page>
```

```css
lr-page[view='mobile'] lr-app-rail::part(collapse-toggle) { display: none; }
lr-app-rail lr-divider { align-self: stretch; }
```

```js
const page = document.getElementById('workspace');
const nav = document.getElementById('workspace-nav');
const syncRail = () => { nav.forceMode = page.view === 'mobile' ? 'full' : 'auto'; };
const observer = new MutationObserver(syncRail);
observer.observe(page, { attributes: true, attributeFilter: ['view'] });
syncRail();
// Call observer.disconnect() when disposing this application composition.
```

`lr-page` owns the sole drawer at narrow allocations and its built-in or slotted
`navigation-toggle` owns mobile trigger ARIA. The rail's built-in collapse control owns desktop
collapse. An external desktop control may use `trigger-collapses` if hidden in mobile view.
The pin shows the full rail inside the drawer and preserves its desktop preference. The shortcut
acts only on desktop; it cannot open the page drawer. Give the rail a distinct `label`, since the
page and rail navigation landmarks nest. This recipe uses the page's default start-side placement.

### `lr-app-rail-item`

In icon-only presentation the nested disclosure and children list are hidden while `expanded`
is preserved. Returning full restores the list. If a disclosure or descendant had focus, it moves
to the outermost visible parent item's base control. The parent link remains operable. The `end`
slot stays visible; reserve an icon-only rail width of at least twice the nav padding plus the icon
square, item gap and end content. A 1.5rem badge requires 5.5rem with default tokens. Keep end actions
out of default-width compact rails, or use a rail that never collapses.


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
  current location). `active`, a deprecated alias in both property and attribute form, was removed
  in 16.0.0 (available since 11.2.0; eligible for removal from 13.0.0) — use `current`.
- `tooltip: boolean = false` (reflected) — opt-in hover/focus flyout (`[part='tooltip']`) showing
  this item's label text while the rail's `icon-only` mode (set externally by the parent
  `<lr-app-rail>` as the viewport narrows) hides it from view. No effect outside icon-only mode,
  since the label is already visible there. `false` (the default) reproduces the exact existing
  output.
- `expanded: boolean = false` (reflected) — whether this item's own `children` are shown. `false`
  reproduces exactly what an item without this property rendered before this feature existed.
  Driven through the same request/commit pair as `<lr-app-rail-group>`'s `open`, see Events below.

A host `aria-label` is copied to the rendered native link or button by attribute presence,
including an explicitly empty value; without it, the default slot supplies the native name. The
same precedence supplies the tooltip text when that opt-in flyout is visible, and the disclosure's
interpolated `{label}` (see Events below).

**Events:** `lr-toggle-request` — cancelable, emitted before `expanded` changes from the built-in
disclosure (`detail: { open }` — the field is named `open`, matching `<lr-app-rail-group>`'s
identical event name and detail shape exactly). Call `preventDefault()` to keep the current state,
or assign `expanded` from the listener to resolve it yourself; a write during the dispatch
suppresses the default commit even when it assigns the value the property already held. Not
emitted for a direct `expanded` write. `lr-toggle` — non-cancelable, emitted after `expanded` is
written, never for a vetoed or listener-resolved request (`detail: { open }`).

**Methods:** `click(): void` activates the internal native link or button; it is a no-op while
`disabled`.

If an `href`/`disabled` update replaces a focused link or button, focus follows an available native
replacement. When that replacement is disabled or inert, focus returns to the available element
that led into the item, or to the stable owning rail surface when no return target exists. A newer
external focus move is always preserved, and this repair dispatches no activation event.

**Slots:** default (the visible label), `icon` (the leading decorative icon, always hidden from
assistive technology and inert across its flattened subtree; the default slot or host `aria-label`
names the native control, which remains the sole action).

- `meta` slot — secondary trailing text (an unread count, a keyboard shortcut). Rendered as a
  SIBLING of the item's own link/button, so its text is not part of the item's accessible name and a
  pointer landing on it does not activate the item. Visually clipped in `icon-only` mode exactly as
  the label is, staying available to assistive technology.
- `end` slot — trailing controls or adornments (an overflow-menu trigger, a status badge). Also a
  sibling of the link/button — the shape `<lr-details>` uses for `header-actions` — so a slotted
  control keeps its own click, keyboard activation and focus order instead of being swallowed.
  Unlike `meta` it stays visible in `icon-only` mode, where it shares the narrow rail's width with
  the icon.
- `children` slot — nested `<lr-app-rail-item>`s disclosed beneath this item (the
  treeitem-with-link pattern: the row itself navigates, a separate disclosure expands its own
  child rows). Slotting anything into it grows a built-in `[part="toggle"]` disclosure button as a
  SIBLING of the item's own link/button, never nested inside it, so the link keeps navigating on
  its own and the disclosure keeps toggling on its own — clicking one never triggers the other.
  Leaving `children` empty renders neither the disclosure nor `[part="children"]` at all: an item
  authored without any `children` content renders byte-identically to one authored before this
  slot existed. The disclosure carries `aria-expanded` (both states) and `aria-controls` pointing
  at `[part="children"]`'s id, and a localized accessible name interpolating this item's own label
  (`Expand {label}`/`Collapse {label}` in the default locale — no literal fallback, so a
  `registerLyraLocale()` translation or a `.strings` override always reaches it). `<lr-app-rail-group>`
  cannot express this pattern: its collapsible heading *is* the toggle, so a navigable link cannot
  live inside it without nesting an interactive element inside a button.

  `icon-only` forwards from this item onto every `<lr-app-rail-item>` it directly owns through
  `children` — including ones appended later — exactly how `<lr-app-rail-group>` forwards onto the
  items and nested groups it owns. The disclosure is a fixed icon-button-sized square in full
  presentation, sharing the link/button state tokens. Icon-only hides it and the nested list while
  preserving expansion and recovering focus to the visible parent item. There is no ancestor-current treatment — `<lr-app-rail-group>` has
  no equivalent concept for a group containing the current item, so none is invented here either; a
  current descendant stays perceivable only through its own `current` property.

Both wrappers (`[part="meta"]`, `[part="end"]`) are hidden while empty, so an item using neither
renders exactly as before. Note that while the mobile overlay is open, a click anywhere in the
rail's default slot closes it — including a click on an `end` control; that is the rail's documented
nav-slot behaviour, not new to these slots.

**CSS parts:** `base`, `icon`, `label`, `current-indicator` (a decorative inline indicator rendered
only while the item is `current`/`aria-current="page"`, mirroring `<lr-conversation-item>`'s
shipped `active-indicator` part — suppressed by default while `icon-only`, see the current-ring
tokens below), `tooltip` (the hover/focus label flyout, only rendered while `tooltip` is set, the
item is `icon-only`, and it is hovered or focused), `meta` (the wrapper around the `meta` slot,
hidden while empty), `end` (the wrapper around the `end` slot, hidden while empty), `toggle` (the
`children` disclosure, rendered only while something is slotted into `children`; a sibling of
`base`, never nested inside it), `toggle-icon` (the wrapper around the disclosure chevron,
direction-aware through this wrapper's own `transform` — mirrors `<lr-app-rail-group>`'s own
`[part="toggle-icon"]`) and `children` (the wrapper around the `children` slot, rendered only
alongside `toggle`; hidden — but present, so `aria-controls` keeps resolving — while `expanded` is
`false`).

**Themeable custom properties:** `--lr-app-rail-item-current-bg` (default
`var(--lr-color-brand-quiet)`), `--lr-app-rail-item-current-color` (default
`var(--lr-color-brand)`), and `--lr-app-rail-item-current-font-weight` (default
`var(--lr-font-weight-semibold)`) — background, text/icon color, and font weight of the `current`
(`aria-current="page"`) item. All three are scoped to `[aria-current='page']` only and declared as
inline `var()` fallbacks at the point of use, never on `:host`, so any can be set on the item itself
_or on any ancestor_ — including on `<lr-app-rail>` or a wrapper above it, to retheme every item's
current state at once. `::part(base)[aria-current='page']` is invalid CSS (Shadow Parts forbids an
attribute selector after `::part()`), so before these hooks the only lever was overriding the
library-wide `--lr-color-brand-quiet`/`--lr-color-brand`/`--lr-font-weight-semibold` tokens, which
repainted every other element reading them. Unset, each falls back to the token its rule used
before. `--lr-app-rail-item-current-font-weight` mirrors `<lr-stepper>`'s
`--lr-stepper-current-font-weight` and `<lr-segmented>`'s `--lr-segmented-selected-font-weight`.
`--lr-app-rail-item-current-indicator-color` (default `var(--lr-color-brand)`),
`--lr-app-rail-item-current-indicator-width` (default `var(--lr-size-2px)`), and
`--lr-app-rail-item-current-indicator-inset-inline` (default `0 auto`; set `auto 0` to place the
indicator at the inline-end edge instead) theme `[part="current-indicator"]`.
`--lr-app-rail-item-current-indicator-display` (no default; unset resolves to `none` while
`icon-only`) restores the indicator bar in icon-only presentation — a full-height edge bar reads
as a rendering glitch on the square icon-only tile, so it is suppressed there by default; full
presentation is unaffected either way, since its own `[part="current-indicator"]` rule declares no
`display` at all. `--lr-app-rail-item-current-ring` (no default; unset resolves to `none` in full
presentation and an inset ring in icon-only presentation) sets `box-shadow` on `[part="base"]`
while current: unset, icon-only gets an inset ring automatically — the non-color-only signal
(WCAG 1.4.1) that replaces the bar suppressed there, since full presentation already conveys
current state through the indicator bar and `--lr-app-rail-item-current-font-weight`. Setting this
token explicitly applies the same value in both presentations.
Ordinary interaction states are independently inheritable through
`--lr-app-rail-item-hover-bg`, `--lr-app-rail-item-hover-color`,
`--lr-app-rail-item-active-bg`, and `--lr-app-rail-item-active-color`, again retaining the former
brand/active-mix values as fallbacks.
`--lr-app-rail-item-min-block-size` (default `var(--lr-icon-button-size)`, floor-clamped to that
same token regardless of the override so the row's own hit target can never shrink below the WCAG
2.5.8 minimum), `--lr-app-rail-item-padding` (default `var(--lr-space-s)`),
`--lr-app-rail-item-gap` (default `var(--lr-space-s)`, the gap between `[part="icon"]` and
`[part="label"]`, and now also between the item's control and the `meta`/`end` adornments),
`--lr-app-rail-item-meta-color` (default `var(--lr-color-text-quiet)`),
`--lr-app-rail-item-meta-font-size` (default `var(--lr-font-size-sm)`),
`--lr-app-rail-item-icon-size` (default `var(--lr-icon-button-size)`, not
floor-clamped since the icon is decorative, not itself a pointer target), and
`--lr-app-rail-item-font-size` (default `inherit`, set after the `font` shorthand so only the size
is retuned while family/weight/line-height stay inherited) retune the row's geometry.
While `icon-only`, `[part="base"]` resolves to a square hit target matching the icon-button
footprint used elsewhere in this library (`aspect-ratio: 1` against its already floor-clamped
block size) instead of stretching across the rail's icon column. `--lr-app-rail-item-icon-only-size`
(no default) sizes that square directly — both `inline-size` and `block-size`, and the row's own
`min-block-size` floor — independent of `--lr-app-rail-item-min-block-size`, so a taller expanded
row and an icon-only square pinned to `--lr-icon-button-size` can coexist. Unset, the square is
still derived via `aspect-ratio: 1` against the row's block size exactly as before.

**`--lr-positioning-strategy`** (16.0.0) — the icon-only flyout tooltip reads this same cascading
`absolute`/`fixed` override documented on `<lr-popover>` when it is (re)positioned, falling back to
its own `fixed` default when nothing is set. There is no per-instance `positioning-strategy`
property on `<lr-app-rail-item>`; set the custom property on `:root`, a theme, or one clipping
ancestor to change every unset rail item's flyout beneath it.

`--lr-app-rail-item-indent` (default `var(--lr-space-l)`) sets `[part="children"]`'s
`padding-inline-start`. Applied once per nesting level — a doubly-nested `children` list compounds
two insets automatically, since each level's own `[part="children"]` applies the token again.
Logical, so it mirrors under `dir="rtl"` with no separate rule.

**Optional peer deps:** none.

---

### `lr-app-rail-group`

Titles, and optionally collapses, a section of `<lr-app-rail-item>`s. Grouping is by composition —
the group holds whatever it is given; there is no items array and no renderer callback, so it can
never disagree with what is rendered inside it.

```html
<script type="module">
  import '@aceshooting/lyra-ui/components/layout/app-rail-group/app-rail-group.js';
</script>

<lr-app-rail>
  <lr-app-rail-group heading="Workspaces" collapsible>
    <button slot="header-actions" aria-label="Add workspace">+</button>
    <lr-app-rail-item href="/atlas" current>Atlas</lr-app-rail-item>
    <lr-app-rail-item href="/beacon">Beacon</lr-app-rail-item>
  </lr-app-rail-group>
</lr-app-rail>
```

**Properties:**

- `heading: string = ''` — the section title. The `heading` slot replaces it when populated.
- `headingLevel: number = 3` (attribute `heading-level`) — the `aria-level` the heading landmark
  reports. Clamped to 1-6 and rounded; a non-finite value falls back to `3`. Settable because a rail
  sits at a different depth in every page that embeds it.
- `collapsible: boolean = false` (reflected) — opts in the built-in collapse control. The heading's
  own text becomes the button carrying `aria-expanded` and `aria-controls`, which is the accordion
  pattern; an unnamed group falls back to a localized `Collapse`/`Expand` name.
- `open: boolean = true` (reflected) — whether the content is shown. Carries a true-default
  converter, so `open="false"` parses from markup (a plain presence-based boolean cannot). `open`
  governs visibility whether or not `collapsible` is set, so a consumer can drive collapse entirely
  from its own chrome.

**Events:** `lr-toggle-request` — cancelable, emitted before `open` changes from the built-in
control (`detail: { open }`). Call `preventDefault()` to keep the current state, or assign `open`
from the listener to resolve it yourself; a write during the dispatch suppresses the default commit
even when it assigns the value the property already held. Not emitted for a direct `open` write.
`lr-toggle` — non-cancelable, emitted after `open` is written, never for a vetoed or
listener-resolved request (`detail: { open }`).

**Slots:** default — the group's items, and any nested `<lr-app-rail-group>`s; `heading` — rich
heading content; `header-actions` — controls beside the heading, rendered as a sibling of the
collapse control so activating one never toggles the group.

**CSS parts:** `base`, `header`, `heading`, `heading-text`, `toggle`, `toggle-icon`,
`header-actions`, `content`.

**Themeable custom properties:** `--lr-app-rail-group-gap` (default `var(--lr-space-xs)`),
`--lr-app-rail-group-padding-block` (default `var(--lr-space-xs)`),
`--lr-app-rail-group-heading-color` (default `var(--lr-color-text-quiet)`),
`--lr-app-rail-group-heading-font-size` (default `var(--lr-font-size-sm)`),
`--lr-app-rail-group-hover-bg` (default `var(--lr-color-brand-quiet)`),
`--lr-app-rail-group-hover-color` (default `var(--lr-color-brand)`),
`--lr-app-rail-group-active-bg` (no default), `--lr-app-rail-group-active-color` (default
`var(--lr-color-brand)`).

The owning rail marks a slotted group `icon-only` exactly as it marks a slotted item, and the group
forwards that to the items and nested groups it *directly* owns — including ones appended later —
so grouping survives the rail's icon-only presentation. A nested group re-forwards in turn, so
exactly one element ever writes `icon-only` onto any given node and a nested group clips its own
heading too. In that mode the heading text is clipped out of layout — whether or not the group is
collapsible — but stays in the accessibility tree. While `collapsible` too, `[part="toggle"]`
resolves to a square hit target matching the icon-button footprint used elsewhere in this library,
instead of stretching across the header row (mirroring `<lr-app-rail-item>`'s own `[part="base"]`).

**Optional peer deps:** none.

---

## `lr-responsive-panel`

The same slotted content either docked inline in its containing layout or presented as a
full-screen/bottom-sheet/side-anchored overlay, depending on the panel's allocated inline size.
First-party invention (no `wa-*`/`sl-*` counterpart).

**Properties:**

- `open: boolean = false` (reflected) — in the inline presentation this just means visible/mounted;
  in the overlay presentation this is the actual modal open/closed state.
- `mode: LyraResponsivePanelMode = 'auto'` (reflected) — `'auto'` tracks `overlay-breakpoint`
  against the component's allocation; `'inline'`/`'overlay'` force that presentation.
- `effectiveMode: LyraResponsivePanelEffectiveMode` (readonly) — the currently resolved
  `'inline'|'overlay'` presentation.
- `shape: LyraResponsivePanelShape = 'fullscreen'` (reflected) — only affects the overlay
  presentation's visual treatment: `'fullscreen'` covers the whole viewport; `'bottom-sheet'`
  anchors to its block-end edge and does not cover the full height; `'start'`/`'end'` anchor to the
  matching *logical* inline edge instead, like a docked sidebar's slide-in-from-the-edge overlay
  counterpart — the anchored edge and the panel's rounded free edge both flip automatically under
  `dir="rtl"` (logical `inset-inline-*`/border-radius properties, no `:dir()` selector involved).
  Has no visual effect while the effective presentation resolves to `'inline'`.
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
isn't supported — the maximum height of a `shape="bottom-sheet"` overlay panel, so a long sheet
stops short of the top of the viewport instead of covering it; it has no effect on
`shape="fullscreen"` or on the inline presentation),
`--lr-responsive-panel-side-inline-size` (default `var(--lr-size-20rem)` — the width of a
`shape="start"`/`shape="end"` overlay panel along the inline axis; no effect on any other shape or
on the inline presentation),
`--lr-responsive-panel-overlay-panel-bg` (default `var(--lr-color-surface-overlay)`), and
`--lr-responsive-panel-overlay-panel-shadow` (default `var(--lr-shadow-l)`). The latter two are
inherited inline fallbacks for `[part="panel"]` only while the effective presentation is overlay;
they do not affect inline panels. Plus shared tokens (`--lr-color-border-subtle`, `--lr-color-surface`,
`--lr-space-*`, `--lr-radius`, `--lr-shadow`).

**Optional peer deps:** none.

```html
<lr-responsive-panel
  id="settings-panel"
  label="Settings"
  shape="bottom-sheet"
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
`LyraResponsivePanelMode`/`LyraResponsivePanelEffectiveMode`/`LyraResponsivePanelShape`/
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
- `shape="bottom-sheet"`/`shape="start"`/`shape="end"` have no visible effect at all while the
  effective presentation is `'inline'` — they only change the overlay presentation's
  anchoring/height/width.
- `shape="start"`/`shape="end"` are logical, not physical: `'start'` anchors to the inline-start
  edge (left in `dir="ltr"`, right in `dir="rtl"`) and `'end'` to the inline-end edge, so neither
  value alone tells you which physical side a given instance renders on without also knowing its
  resolved direction.
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
already set a `role`, which is left alone. `<lr-menu>` enumerates its interactive items by local tag
name (`lr-menu-item` or `lr-dropdown-item`), not `instanceof`, so an adopted same-origin
foreign-realm item remains enrollable. A label matches neither tag, is never enrolled in the roving
tabindex, and can never become a focus stop; nothing on `<lr-menu>` has to know this element exists.

Keep selectable items directly assigned to the menu's default slot, or forward them through a
slot, with `lr-menu-label` as a sibling visual caption. Arbitrary `role="group"` wrappers do not
provide a supported menu-group API. `aria-labelledby` cannot reference this element's shadow
internals because idrefs do not cross a shadow boundary.

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

Removing or disabling the remembered active item repairs the roving stop without taking focus from
outside controls or the menu's header/footer. If the changed item held actual focus, focus moves to
a valid survivor or through the existing owner dismissal path when none remain.

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

**Themeable custom properties:** the standalone menu surface and a submenu's own surface paint from
the **shared overlay-surface family** (16.0.0) — `--lr-overlay-surface` (default
`var(--lr-color-surface-overlay)`), `--lr-overlay-border` (default `var(--lr-color-border-subtle)`),
`--lr-overlay-radius` (default `var(--lr-radius)`) and, on the submenu only,
`--lr-overlay-shadow-anchored` (default `var(--lr-shadow-m)`). None is declared on `:host`, so one
declaration on `:root` (or on any ancestor, to scope it) retints this menu together with every other
floating surface. A menu contained by `<lr-dropdown>` paints no surface of its own, so the family has
no effect there — the dropdown's popup carries it. The header/footer dividing rules and a slotted
`<hr>` deliberately stay outside the family on the decorative `--lr-color-border-subtle`: they
separate content rather than draw the surface's edge. Otherwise shared spacing and motion tokens.
Row chrome is controlled through the menu-item properties listed below.

Width is a pair, applied to the standalone surface and to a submenu's own surface alike:
`--lr-menu-max-inline-size` (default `var(--lr-size-20rem)`) and `--lr-menu-min-inline-size`
(default `var(--lr-size-10rem)`). They move together — the floor wins over the ceiling, so capping
alone cannot take a menu below 10rem. Neither is declared on `:host`, so an ancestor theme wrapper's
value reaches the menu. The ceiling takes a length or a percentage; `100%` and `none` both uncap it
to the container, and any other value outside `<length-percentage>` is treated as `none` rather than
dropping the cap's safety terms. Those terms — the shared `--lr-popover-viewport-clamp` and the
container allocation — are applied outside the name, so no value of the hook can make a menu wider
than its container or the viewport. (That guarantee is enforced by a registered custom property, so
an out-of-syntax value falls back cleanly instead of invalidating the whole declaration; an engine
without `CSS.registerProperty` degrades to "use `100%`, not `none`".) A menu contained by
`<lr-dropdown>` sizes from its dropdown and is unaffected by both names.

**`--lr-positioning-strategy`** (16.0.0) — the private submenu surface reads this same cascading
`absolute`/`fixed` override documented on `<lr-popover>` when it is (re)positioned, falling back to
its own `fixed` default when nothing is set. There is no per-instance `positioning-strategy`
property on `<lr-menu>`; set the custom property on `:root`, a theme, or one clipping ancestor to
change every unset submenu beneath it. A menu contained by `<lr-dropdown>` is positioned by the
dropdown instead and is unaffected.

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
`menuitemcheckbox`/`menuitemradio`) and roving `tabindex`; `[part="base"]` is only the visual row.

**Properties:**

- `value: string = ''` — identifier available as `event.detail.item.value` on `lr-select`
- `size: '2xs' | 'xs' | 's' | 'm' | 'l' | 'xl' | 'small' | 'medium' | 'large' = 'm'`
- `disabled: boolean = false`
- `variant: 'default' | 'danger' = 'default'`
- `type: 'normal' | 'checkbox' | 'radio' = 'normal'`
- `checked: boolean = false` — meaningful only for `type="checkbox"`/`type="radio"`
- `group?: string` — narrows a `type="radio"` item's exclusive-choice scope to only the other
  radio items sharing this same string. Unset, the scope is every `type="radio"` item the same
  owning `<lr-menu>` owns directly — a nested submenu's radio items belong to that submenu's own
  `<lr-menu>` instead, so they're never in scope regardless of `group`. Meaningless for
  `type="normal"`/`"checkbox"`
- `loading: boolean = false`
- `href?: string` — when set to a safe link URL (`http:`/`https:`/`blob:`/`mailto:`/relative; see
  `safeLinkHref`, or `safeDownloadHref` when `download` is set, which drops `mailto:`),
  `[part="base"]` renders as a real `<a href=…>` instead of a `<span>`, and activation (click, or
  the owning menu's Enter/Space handling, which forwards through `click()` for a link item so the
  anchor's own native default action runs) navigates there in addition to firing the usual
  `select()`/`lr-select` contract. An unsafe/unparseable value falls back to the plain `<span>`,
  matching `lr-button`'s identical fallback
- `target?: string` — native anchor `target`, used only while `href` resolves to a link. Setting it
  (e.g. `'_blank'`) always force-adds `noopener noreferrer` to the rendered anchor's `rel`,
  matching `lr-button`'s identical pattern
- `rel?: string` — independently settable author relationship tokens, no default. Author tokens are
  merged rather than replaced: `opener` is always stripped, and whenever `target` is set the
  non-removable `noopener noreferrer` floor is added, so a same-tab link (no `target`) keeps
  exactly the author's tokens while a link opening a new context can never lose the guard
- `download?: string` — native anchor `download` attribute, used only while `href` resolves to a
  link. Presence narrows the safe-URL allowlist to `safeDownloadHref`'s, which drops `mailto:` — a
  mail handoff names no retrievable bytes, so it cannot be a download target
- `hasSubmenu: boolean` (read-only)
- `submenuOpen: boolean = false` — transient live state; assigning it drives an existing submenu
  without moving focus and disconnect resets it

**Methods:**

- `click(): void` forwards programmatic activation through the visual-row path
- `select(): void` activates through the current owning menu; it is inert while disabled/loading
- `openSubmenu(focus: 'first' | 'last' | 'none' = 'first'): Promise<void>`
- `closeSubmenu(): Promise<void>`
- `getTextLabel(): string` returns the accessibility-visible label used by type-ahead

The computed name is derived from the row's own visible label and does not depend on whether the
menu is currently displayed, so a row inside a closed dropdown — whose popup is `visibility:
hidden` — is named the same as an open one, and `getTextLabel()` drives type-ahead either way.
A row with no label text carries **no** `aria-label` attribute rather than an empty one, so the
browser falls back to the row's own content; an `aria-label` or `aria-labelledby` you set yourself,
including an explicitly empty value, still wins.

A checkbox activation first emits cancelable `lr-menu-item-change` with the proposed
`detail: { value, checked }`. Preventing that event retains the current checked state; the owning
menu's canonical `lr-select` still follows. A submenu parent is a disclosure instead of an action:
activation opens its submenu and emits neither checkbox-change nor selection.

A `type="radio"` item works the same way, with exclusive-choice semantics layered on top:
activating an already-checked radio is a no-op on `checked` — no `lr-menu-item-change`, no state
change, matching native `<input type="radio">` — but still falls through to the owning menu's
usual selection. Activating an unchecked radio fires `lr-menu-item-change` with
`checked: true`; once not prevented, this item becomes `checked` and every other `type="radio"`
item the same owning `<lr-menu>` owns directly whose `group` matches is unchecked directly
(without an `lr-menu-item-change` of its own).

**Events:**

- `lr-menu-item-change` — cancelable checkbox/radio-state proposal; never fired when activating an
  already-checked radio
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
`--lr-menu-item-danger-active-bg`, `--lr-menu-item-checked-bg` (default `transparent`),
`--lr-menu-item-checked-color` (default `inherit`), `--lr-menu-item-checked-font-weight` (default
`inherit`), and `--submenu-offset`, plus shared size/focus/color/spacing tokens. The checked hooks
apply to a `type="checkbox" checked` or `type="radio" checked` row's `[part="base"]`, matching the
checked/selected-state hooks `<lr-option>`, `<lr-select>`, `<lr-combobox>`, and `<lr-tree-item>`
already expose; unset, a checked row paints identically to an unchecked one.

Four more row-chrome hooks land in 16.0.0, each an inline fallback so unset rendering is
byte-identical: `--lr-menu-item-hover-bg` (default `var(--lr-color-brand-quiet)`) is the enabled
row's fill under the pointer, and the pressed state mixes from that same value, so a retuned hover
fill keeps its pressed step instead of snapping back to the brand default; `--lr-menu-item-active-bg`
(default `color-mix(in oklab, var(--lr-menu-item-hover-bg, var(--lr-color-brand-quiet)),
var(--lr-color-mix-partner) var(--lr-color-mix-active))`) overrides that pressed fill directly,
matching `--lr-option-active-bg`'s equivalent hook — unset, the pressed row keeps mixing from
`--lr-menu-item-hover-bg` exactly as before this hook existed; `--lr-menu-item-icon-color` (default
`inherit`) recolours `[part="icon"]` without touching the label beside it, so it still follows the
row while the row is disabled or `variant="danger"` unless you say otherwise; and
`--lr-menu-item-min-height` (default `max(var(--lr-form-control-height), var(--lr-size-24px))`)
sets the row's minimum block size for a denser or roomier menu, replacing a `::part(base)` rule per
item. A value below the 24px floor is your call, exactly as it is when overriding the shared ladder
itself.

Any element assigned to `details` counts as content, including a shadow-rendered
`<lr-kbd slot="details" keys="mod+t">` chip or an icon. An intentionally empty placeholder element
also shows the part and reserves one `--lr-menu-item-gap`; whitespace-only text and empty forwarding
slots keep the part hidden. This also applies to `lr-dropdown-item`.

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
properties, slots, parts, methods, checkbox/radio/state events, roving focus, and canonical parent
`lr-select` behavior. Its host also exposes native, non-bubbling, composed `focus` and `blur`
events.

**Attributes:** `href`, `target`, `rel`, and `download` — the same link-rendering properties
documented above for `<lr-menu-item>`, settable directly in markup
(`<lr-dropdown-item href="/settings" target="_blank">`). The `rel` guard is identical: author
tokens merge rather than get replaced, `opener` is always stripped, and setting `target` force-adds
the non-removable `noopener noreferrer` floor, so a same-tab link keeps exactly the author's tokens
while a link opening a new context can never lose the guard.

**Events:** native, non-bubbling, composed, non-cancelable `focus` and `blur` (`FocusEvent`) when
the focusable host gains or loses focus, plus the shared menu-item events above.

**Themeable custom properties:** every `<lr-menu-item>` hook above, including 16.0.0's
`--lr-menu-item-hover-bg`, `--lr-menu-item-active-bg`, `--lr-menu-item-icon-color` and
`--lr-menu-item-min-height`.
`--lr-overlay-surface`, `--lr-overlay-border` and `--lr-overlay-radius` are listed on this tag
because it shares a stylesheet directory with `<lr-menu>`, whose surface reads them; a dropdown item
is a row **inside** that surface and paints no surface of its own, so setting them here is a no-op —
set them on the menu or on any ancestor instead. The row's own corner stays `--lr-menu-item-radius`.

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

## `lr-menubar` / `lr-menubar-item`

A horizontal application menubar following the APG menubar pattern. Import
`@aceshooting/lyra-ui/components/lr-menubar.js`; it registers the item and menu dependencies.
Use only `lr-menubar-item` elements in the default slot. A title's `menu` slot takes exactly one
`lr-menu`; without it the title is a plain action that dispatches native `click`.

```html
<lr-menubar label="Application">
  <lr-menubar-item>
    File
    <lr-menu slot="menu">
      <lr-menu-item value="new-tab" aria-keyshortcuts="Control+T Meta+T">
        New tab <lr-kbd slot="details" keys="mod+t"></lr-kbd>
      </lr-menu-item>
      <lr-menu-item>Share<lr-menu slot="submenu"><lr-menu-item>Email link</lr-menu-item></lr-menu></lr-menu-item>
      <hr />
      <lr-menu-item value="print">Print…</lr-menu-item>
    </lr-menu>
  </lr-menubar-item>
  <lr-menubar-item>Edit<lr-menu slot="menu"><lr-menu-item>Undo</lr-menu-item></lr-menu></lr-menubar-item>
  <lr-menubar-item>Help</lr-menubar-item>
</lr-menubar>
```

Import `@aceshooting/lyra-ui/components/lr-kbd.js` separately for shortcut chips. Displaying a
shortcut does not bind it. `Control+T Meta+T` describes a handler accepting either `ctrlKey` or
`metaKey`. If the app binds only its platform modifier, keep the ARIA value aligned with the chip:
`item.setAttribute('aria-keyshortcuts', kbd.effectivePlatform === 'mac' ? 'Meta+T' : 'Control+T')`.
The chip's decorative `details` subtree is hidden from assistive technology.

### `lr-menubar`

**Properties:**

- `label?: string` — accessible name of the menubar. The host `aria-label` wins, including `""`;
  an explicit `label=""` stays empty. When both are absent, no name attribute is rendered.
- `size: LyraSize = 'm'` — shared control ladder, inherited by the titles.
- `frame: LyraFrame = 'card'` — surface, subtle border and shadow; `'plain'` makes the same
  geometry transparent. Other values use the card appearance.

**Events:** `lr-select`, cancelable `CustomEvent<MenuItemSelectDetail>`, bubbles once from the
owning menu with `detail.item`. Prevent default to keep the menu open. Checkbox/radio
`lr-menu-item-change` also bubbles from its item. There are no menubar lifecycle events or public
open/close methods.

**Slots:** default, containing only `lr-menubar-item` elements. **CSS parts:** `base`.
The menu width hooks `--lr-menu-min-inline-size` and `--lr-menu-max-inline-size` inherit from the
menubar or an ancestor and apply to every slotted menu.

### `lr-menubar-item`

**Properties:** `disabled: boolean = false` — removes the title from traversal, closes its menu,
and suppresses mouse, touch, keyboard and programmatic activation. Disabled `mousedown` does not
move focus. Consumer capture listeners on a further ancestor can still observe a dispatched
click, but listeners on the item and bubbling ancestor listeners do not receive it.

**Slots:** default, the visual label; `menu`, exactly one `lr-menu` (the first assigned menu wins;
other elements are ignored). **CSS parts:** `base`, `label`. No own custom events. Native `click`
is the action contract for a title without a menu. **Methods:** `click(): void` does nothing while
disabled, otherwise dispatches a native host click.

The host owns `role="menuitem"`, literal `aria-disabled`, and, only with a menu,
`aria-haspopup="menu"` plus literal `aria-expanded`. Its accessible name comes from the default
slot, so open menu contents never leak into it; author `aria-label` or `aria-labelledby` wins.
Menus inherit the title's name unless given their own `aria-label` or `label`. An empty title
leaves the menu's localized `menuLabel` fallback intact.

**Themeable custom properties:**

- `--lr-menubar-item-hover-bg` (default `var(--lr-color-brand-quiet)`) paints hover, focus-visible
  and the open title.
- `--lr-menubar-item-active-bg` (default
  `color-mix(in oklab, var(--lr-menubar-item-hover-bg, var(--lr-color-brand-quiet)), var(--lr-color-mix-partner) var(--lr-color-mix-active))`)
  paints the pressed title, including when already open.

Both hooks inherit from the item, menubar or any ancestor. Open titles receive an outline in
forced colors. Reduced motion removes menu transitions and minimizes title transitions.

### Keyboard and pointer behavior

| Focus | Key | Result |
|---|---|---|
| Title | Left/Right | Previous/next enabled title, wrapping; directions reverse in RTL |
| Title | Home/End | First/last enabled title |
| Title | Down, Enter, Space | Open and focus first menu item; Enter/Space click a plain action |
| Title | Up | Open and focus last menu item; unhandled on plain actions |
| Title | Printable character | Case-insensitive typeahead with a 500ms buffer |
| Expanded title | Traversal or matching typeahead | Carry the open menu along; focus stays on the title |
| Menu leaf | Inline forward/back arrow | Carry to next/previous title; nested back closes only that submenu |
| Menu | Up/Down, Home/End, Enter/Space | Existing menu navigation and activation |
| Open menu/title | Escape | Close the innermost menu; menu focus returns to its title |
| Open menu/title | Tab | Close and continue native traversal; Shift+Tab from the menu returns to its title |

Handled keys prevent page scrolling. Escape/Tab while collapsed and unmatched typeahead remain
unhandled. Header/footer inputs retain their own arrow behavior. Disabled, hidden, aria-hidden and
inert titles are skipped. Moving onto a plain action collapses an open menu.

Clicking a menu title toggles its menu and keeps focus on the title. While one menu is open,
hovering another enabled menu title carries the menu immediately; hovering while collapsed,
hovering plain actions, and touch pointer-over events do nothing. Clicking a title that hover just
opened closes it. Outside pointers, focus leaving the menubar, removal or disablement close the
menu. Selection closes and focuses its title unless canceled. Reconnecting resumes collapsed.
Closing preserves the current focus even with another overlay beneath; if nothing remains focused
because the menubar was removed, the shared overlay stack may focus its previous entry.

### Sizing and narrow allocations

Titles wrap, with no horizontal scrollbar or automatic overflow menu. The keyboard order stays
linear. Long titles ellipsize while retaining their full accessible name. A single row measures
`max(H, 24px + 2P + 2B)`, where H is `--lr-form-control-height`, P is
`--lr-form-control-padding-block`, and B is `--lr-border-width-thin`. With default tokens this is
26px at `xs`, 30px at `s`, 40px at `m`, and 48px at `l`; each title is at least 24px in both axes.
Font, inline padding and radius follow the shared size ladder. Coarse-pointer size floors still
apply. The shadcn theme gives 32px at `s` and 36px at `m`. Additional wrapped rows add their title
height plus the shared gap. No container containment is imposed, so intrinsic sizing in a centered
grid or shrink-to-fit header remains content-based. Both tags render and hydrate on the server;
menu wrappers begin hidden and inert until connected client behavior attaches their menus.

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
being dragged. Plus shared tokens `--lr-color-surface`, `--lr-color-border`,
`--lr-color-border-subtle`, `--lr-color-brand`, `--lr-color-brand-quiet`, `--lr-color-text`,
`--lr-radius`, `--lr-space-xs`, `--lr-focus-ring-width/-color/-offset`, `--lr-transition-fast`,
`--lr-icon-button-size`.

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
- `disabled: boolean = false` (reflected) — turns the card's OWN activation off. The native
  `activation-button` renders `disabled`; a linked card's stretched `<a>` loses its `href`, so it
  genuinely cannot navigate rather than merely claiming to be disabled while still clickable, and
  gains an explicit `role="link"` so its accessible name and `aria-current` stay valid on an
  element that no longer has an implicit role. `lr-card-activate` stops firing from every path,
  `click()` included, the control leaves the tab order, and the card paints at
  `--lr-opacity-disabled` with a `not-allowed` cursor. Scoped to the card's own action: a passive
  card (no `actionable`, no `href`) has nothing to turn off, so `disabled` leaves it untouched,
  and slotted controls stay yours to disable. `<lr-card>` is deliberately not form-associated (it
  is a layout container, not a form control), so an ancestor `<fieldset disabled>` does not
  cascade into it — disable each card explicitly.
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
- `aria-pressed` and `aria-current` (attributes only) — forwarded reactively onto the native
  control the card actually renders, the same mechanism `<lr-button>` and `<lr-icon-button>` use.
  `aria-pressed` accepts `'true' | 'false' | 'mixed'` and reaches the `activation-button` only —
  `link` has no pressed state, so a linked card never receives it — the same **16.0.0** carve-out
  `<lr-button>` and `<lr-icon-button>` took. The global `aria-current`
  accepts `'page' | 'step' | 'location' | 'date' | 'time' | 'true' | 'false'` and reaches both the
  activation button and the stretched link. Anything outside those sets is dropped rather than
  passed through, so a typo never reaches the accessibility tree. This is what lets a single-select
  list of card-shaped tiles announce which one is the active selection.

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
gap around card sections. Shoelace-compatible `--padding` is its fallback; `--border-color`
(default `var(--lr-color-border-subtle)`), `--border-radius`, and `--border-width` control the outer
and section borders. An `actionable` or linked (`href`) card is the exception: unset, its outer edge
falls back to `--lr-color-border`, because that edge is then the whole-card control's only visible
boundary (WCAG 2.2 SC 1.4.11); its header and footer rules stay on the subtle tier. Otherwise shared
tokens — `--lr-color-border`/`-border-subtle`/`-surface`/`-brand`/`-brand-quiet`, `--lr-radius`,
`--lr-space-s`/`-m`, `--lr-transition-fast`, `--lr-focus-ring-*`.
Appearance and interaction paint can be rethemed independently through `--lr-card-outlined-bg`
(the DEFAULT `outlined` appearance's background, and `accent`'s, which adds a stripe without
restating a surface — defaults to `var(--lr-color-surface)`, mirroring `<lr-details>`'s
`--lr-details-outlined-bg`), `--lr-card-filled-bg`,
`--lr-card-filled-outlined-bg`, `--lr-card-accent-border-color`,
`--lr-card-interactive-hover-border-color`, `--lr-card-interactive-active-border-color`, and
`--lr-card-interactive-active-overlay`. They inherit from ancestors and fall back to the exact
former brand and active-mix values when unset.
`--lr-card-shadow` is **undeclared by default**, so `box-shadow` falls back to `none` —
byte-identical to before this property existed — mirroring `--lr-button-shadow`'s pattern; set it
for a raised card without a `::part(base)` rule. `--lr-card-interactive-hover-shadow` styles an
`actionable`/linked card's shadow while hovered, falling back to `--lr-card-shadow` itself so a
card given only a resting shadow keeps that exact shadow on hover.

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

Hotkeys share last-connected eligible ownership with `lr-app-rail` in the same window. Removing the
`hotkey` attribute disables the chord, and key-less browser autofill events are ignored. Non-ASCII
layout keys may match a single ASCII letter/digit chord through `event.code`; printed ASCII keys
remain authoritative. Existing palette behavior in editable content and for already-prevented events
is unchanged.

Searchable application command menu. Renders nothing at all while closed. Uses the same shared
overlay infrastructure as `lr-dialog` (focus-trapping Tab, Escape dismissal, backdrop-click
dismissal, ref-counted document scroll lock).

Valid string keywords still participate in search alongside the command's label, description, and
group. Unsafe keyword entries are skipped without invoking accessors, and selection returns the
original command object.

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
  label; a command with no `icon` renders no `icon` part at all. A runtime `keywords` value that is
  not an array is ignored, as are non-string members, without dropping otherwise-valid commands.
  Filtering is case-insensitive
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
- `accessibleLabel?: string` (attribute `aria-label`) — overrides the localized dialog name.
  Omitting it reads back `undefined` and uses the localized `commandPaletteLabel` default; an
  explicitly empty value is used as-is

**Methods:** `openPalette()` (after an accepted open, clears the query and resets the active row;
no-op if already open),
`close()`, `registerCommand(command)` — appends to `commands` and returns an unregister function.

**Keyboard:** ArrowUp/ArrowDown move the active option, skipping `disabled` rows and clamping (not
cycling) at the ends; the active row is scrolled into view. Enter selects. Hovering a non-disabled
row also makes it active.

**Events:** `lr-show`, `lr-close` (both `detail: null`, cancelable — fired before the
mutation, `preventDefault()` keeps the palette in its current open state), `lr-select`
(`detail: { command }`, fired before the command's own `onSelect` runs and before the palette
closes), and no-detail `focus`/`blur` events re-dispatched from the host whenever the search input
gains or loses focus. `lr-open` is a deprecated alias for `lr-show` (same `detail: null`,
cancelability, and timing, fired at the same call site; either event's `preventDefault()` vetoes
the open) kept for the 20.x line and removed no earlier than 21.0.0. The `focus`/`blur` bridge is
new in 10.0.0: native `focus`/`blur` neither
bubble nor cross the shadow boundary, so a host-level `el.addEventListener('focus', …)` previously
never fired at all.

**Slots:** none.

**CSS parts:** `backdrop`, `dialog` (the `role="dialog" aria-modal="true"` panel), `search` (the
input row), `input` (the `type="search"` field), `clear-button` (clears the search field,
replacing the native search-cancel glyph the component resets; rendered only while it has a
value), `list` (the `role="listbox"`), `group` (a group
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
that token, so rendering is unchanged. `--lr-command-palette-search-padding` (default
`var(--lr-space-m)`) and `--lr-command-palette-search-gap` (default `var(--lr-space-s)`) size the
query row; `--lr-command-palette-search-min-height` (default `auto`) and
`--lr-command-palette-search-font-size` (default `inherit`) size the field itself. Point the height
at `--lr-form-control-height-s` (or any tier of that ladder) to match the palette's query field to a
themed search field elsewhere in the application. Unset, all four leave the row exactly as it
shipped.

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

`lr-toggle` reports the direction and source of an accepted Details transition. Accordion
coordinates only its direct `lr-accordion-item` children; Details retains independent state and
optional grouping through a shared non-empty `name`.

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

> **A nested `lr-accordion`'s events are not scoped to it — filter by target.** Every accordion
> event goes through the shared `emit()` helper with `bubbles: true, composed: true`, so an inner
> `<lr-accordion>` slotted inside an outer item sends its own `lr-expand`, `lr-collapse`,
> `lr-toggle-request`, `lr-after-expand` and `lr-after-collapse` straight through the outer group.
> A listener bound directly on the outer `<lr-accordion>` therefore also receives the inner
> group's — and their `detail.item` is an item of the inner group, so an outer handler that looks
> that item up among its own children finds nothing, or acts on a panel it does not own.
> Coordination itself is already scoped: an outer group never applies its single-panel invariant,
> roving keyboard model, or lifecycle to an inner group's items. It is only the listener that
> needs the guard, the same one `<lr-details>` and `<lr-dialog>` document for their own events:
>
> ```html
> <lr-accordion id="outer">
>   <lr-accordion-item label="Outer">
>     <lr-accordion>
>       <lr-accordion-item label="Inner">Inner content.</lr-accordion-item>
>     </lr-accordion>
>   </lr-accordion-item>
> </lr-accordion>
> <script type="module">
>   const outer = document.querySelector('#outer');
>   outer.addEventListener('lr-expand', (event) => {
>     if (event.target !== event.currentTarget) return; // a nested group expanded, not this one
>     // ...
>   });
> </script>
> ```

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

> **A nested `lr-details`' events are not scoped to it — filter by target.** Every Details event
> goes through the shared `emit()` helper with `bubbles: true, composed: true` hardcoded, with no
> exception for this component. A `<lr-details>` nested inside another `<lr-details>` (as ordinary
> slotted content, e.g. inside `header-actions` or the default panel) has its own
> `lr-show`/`lr-hide`/`lr-toggle`/`lr-after-show`/`lr-after-hide` bubble straight through the outer
> panel, so a listener bound directly on the outer `<lr-details>` also receives the inner one's
> events — an inner disclosure opening or closing looks identical to the outer one doing the same,
> the same failure mode `lr-dialog`'s `lr-close` carries and documents in its own section. Guard on
> the target:
>
> ```html
> <lr-details id="outer" summary="Outer">
>   Some outer content.
>   <lr-details id="inner" summary="Inner">Inner content.</lr-details>
> </lr-details>
> <script type="module">
>   const outer = document.querySelector('#outer');
>   outer.addEventListener('lr-toggle', (event) => {
>     if (event.target !== outer) return; // the inner details toggled, not this one
>     // ...
>   });
> </script>
> ```
>
> This is deliberate, not a bug to fix: non-bubbling Details events would be a breaking change, and
> `event.target`/`event.currentTarget` already give every listener exactly what it needs to tell the
> two apart.

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
extra controls (e.g. a trailing "add" button) as a sibling of the private native `<details>` in the
complete header row, so they stay rendered, visible, and hit-testable while the panel is collapsed
or disabled. Activating one never toggles the panel: a click whose
composed path crosses `[part~="header-actions"]` is exempted from disclosure activation. Its wrapper
is hidden and reclaims layout space whenever the slot is empty.

**CSS parts:** accordion exposes `base`. Accordion item exposes `base` and `accordion-item` on the
same outer wrapper, plus `heading`, `button`, `label`, `icon`, `panel`, and `content`. Details
exposes `base` and `details` on the same outer container, plus `header`, `summary`, `icon`,
`header-actions`, and `content`. The native `<details>` is private; `content` is inside its
findable `hidden="until-found"` closed-state gate.
The Details icon wrapper also carries Shoelace's `summary-icon` alias, so either part name styles
the same node. `header-actions` is the wrapper around the `header-actions` slot.

Open panel content now fills and scrolls inside a bounded host: place `<lr-details>` (or an
ancestor of it) in a container with a resolved block size and, once open, `[part="content"]`
fills the remaining space below the summary row and scrolls its own overflow internally instead
of the panel growing past the host. This has no effect on an ordinary unsized disclosure — the
chain resolves to `auto` and the panel stays exactly as content-sized as before. It has no effect
on the closed state either: the private closed-state findability gate (`hidden="until-found"`)
is untouched, and the open/close lifecycle (`show()`/`hide()`, `lr-show`/`lr-toggle`/
`lr-after-show`/`lr-hide`/`lr-after-hide`) is unaffected.

For rich independent actions, reserve a useful basis on `header-actions` so the complete action
group wraps onto another row before its checkbox label becomes too narrow. The header already
wraps; its summary belongs to a private native-details flex item, so setting `flex` on
`::part(summary)` does not control that item's allocation. This recipe uses public parts and
ordinary light-DOM layout:

```html
<style>
  lr-details.responsive-actions::part(header-actions) {
    flex: 1 1 12rem;
    min-inline-size: min(100%, 12rem);
    padding: var(--lr-space-xs);
    box-sizing: border-box;
  }
  .details-action-group {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--lr-space-s);
    min-inline-size: 0;
  }
  .details-action-group lr-checkbox { flex: 1 1 auto; min-inline-size: 0; }
</style>
<lr-details class="responsive-actions" summary="Settings">
  <span slot="header-actions" class="details-action-group">
    <lr-checkbox size="s">Show distribution details</lr-checkbox>
    <lr-badge>Live</lr-badge>
  </span>
  Distribution settings.
</lr-details>
```

Import the granular details, checkbox and badge registration entries. Adjust the `12rem` basis
for the actual labels. Logical sizing supports RTL and narrower allocations; the checkbox remains
independently focusable and operable when the summary is disabled.

**Themeable custom properties:** accordion item exposes `--lr-accordion-item-spacing` (default
`var(--lr-form-control-padding-inline)`), `--lr-accordion-item-show-duration` and
`--lr-accordion-item-hide-duration` (both default `var(--lr-duration-base)`), and
`--lr-accordion-item-easing` (default `var(--lr-easing-standard)`). The mapped unprefixed names
`--spacing`, `--show-duration`, `--hide-duration`, and `--easing` remain accepted aliases and win
when set. Panel and icon transitions stop under `prefers-reduced-motion: reduce`.

Accordion appearance paint is independently inheritable: `--lr-accordion-outlined-bg` (default
`var(--lr-color-surface)`) and `--lr-accordion-outlined-border-color` (default
`var(--lr-color-border-subtle)`); `--lr-accordion-filled-bg` (default
`var(--lr-color-surface-raised)`) and `--lr-accordion-filled-border-color` (default `transparent`);
and `--lr-accordion-filled-outlined-bg` (default `var(--lr-color-surface-raised)`) plus
`--lr-accordion-filled-outlined-border-color` (default `var(--lr-color-border-subtle)`). Direct item
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
collapse the summary row. The summary's and the panel content's padding can also be tuned
independently of each other and of `--lr-details-spacing`: `--lr-details-summary-padding-block` and
`--lr-details-summary-padding-inline` control the summary alone, and
`--lr-details-content-padding-block-end` and `--lr-details-content-padding-inline` control the
panel content alone. All four default to the same `--lr-details-spacing` resolution described
above, mirroring how `--lr-details-gap`/`--lr-details-radius` (below) are already independent of
the spacing knob. `--spacing` aliases the Details rhythm and remains the highest-precedence
override, ahead of these four as well. `--show-duration` and
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

**`lr-breadcrumb` properties:** `label?: string` names the trail; omitting it reads back `undefined`
and falls back to the localized `"Breadcrumb"`, while an explicitly empty string stays empty.
`accessibleLabel?: string` (attribute **`aria-label`**) overrides both, with the same
omitted-versus-explicitly-empty distinction. The
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

Pointer move and resize gestures measure the rendered column/row pitch, including the gutter, so
movement by four painted tracks proposes four logical columns in either LTR or RTL. Row-height and
gap overrides also govern vertical pointer snapping. The component continues to emit controlled
layout proposals; the caller accepts them by assigning `layout`.

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
- `--lr-dashboard-grid-interaction-shadow` — Box shadow applied during a cell drag or resize. Default: `var(--lr-shadow-m)`.

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

Choice option entries must expose string `value` and `label` data fields; malformed entries are
omitted independently, while supplied empty strings remain valid. A custom definition requires its
adapter and a callable `render`; a rejected definition does not reserve its filter ID. Valid
siblings remain available. Exceptions thrown by an admitted trusted renderer still propagate. A
chip-only definition requires neither options nor an adapter — a stable filter ID and a label are
the whole schema, since a malformed `formatValue`/`isEmpty` still has a correct fallback and so is
guarded where it is used rather than rejected outright.

**Lean registration entry.** `components/layout/filter-bar/filter-bar.js` (the default entry)
eagerly imports every composed control this bar could possibly render — `<lr-select>`,
`<lr-combobox>`, `<lr-dropdown>` + `<lr-dropdown-item>` (the `'checkbox-menu'` branch),
`<lr-date-input>`, `<lr-input>`, `<lr-chip>`/`<lr-chip-group>` (the active-filter row), and
`<lr-button>`/`<lr-spinner>` (the reset action and the loading status) — because `filters` is a
runtime value it cannot inspect ahead of time. A bar that only ever declares `'select'`/`'text'`
filters still pays for `<lr-combobox>` and `<lr-date-input>` through that entry: a measured ~69.5 kB
gzip more than importing only what it uses. A consumer who knows their own filter `type`s ahead of
time can import `components/layout/filter-bar/filter-bar-register.js` instead, which registers
`<lr-filter-bar>` and nothing else, then import each composed control's own registration entry for
the filter `type`s actually declared:

| Filter `type` | Registration entry |
| --- | --- |
| `'select'` | `components/forms/select/select.js` |
| `'combobox'` | `components/forms/combobox/combobox.js` |
| `'checkbox-menu'` | `components/overlays/overlay/dropdown.js` **and** `components/layout/menu/dropdown-item.js` |
| `'date'` / `'date-range'` | `components/forms/date-picker/date-input.js` |
| `'text'` | `components/forms/input/input.js` |
| `'chip'` | none — renders no control |

Two more are unconditional regardless of which filter `type`s are declared: `<lr-button>` renders
the reset action on every bar, and `<lr-chip>`/`<lr-chip-group>` render the active-filter row
whenever any filter has a value (further gated by `activeFiltersDisplay`, but never provably absent
for a generic bar) — `components/forms/button/button.js` and `components/overlays/chip/chip.js` +
`components/overlays/chip/chip-group.js`. `<lr-spinner>`
(`components/overlays/spinner/spinner.js`) is the one built-in dependency the lean entry omits even
though every bar could use it: `loading` is a plain boolean any consumer can leave unset entirely,
unlike a filter `type`, which `filters` always names outright — import it too if the bar ever sets
`loading`. A filter definition whose `type` has no matching import above renders no usable control
until something else registers it, the same trade `icon-button-register.js` documents for
`<lr-icon-button>`'s own `icon`/`src` attribute.

**Properties:**

- `filters: readonly LyraFilterBarFilterDefinition[] = []` (attribute: false) — filter schema in
  render order. Every definition carries a nonempty, whitespace-stable, unique `filterId` and a
  `label` that is a non-blank string; invalid definitions (including a missing, non-string, or
  blank `label`) and later duplicate filter IDs are ignored deterministically. The first 10,000
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
- `hasActiveFilters: boolean` (read-only) — whether any configured filter currently has a value,
  including one sitting at its own declared `defaultValue`. Drives the reset button's own disabled
  state in every `activeFiltersDisplay` mode except `'changed'`; the getter itself is unaffected by
  `activeFiltersDisplay`.
- `hasChangedFilters: boolean` (read-only) — whether any filter's value differs from its own
  declared `defaultValue`, using the same equality `activeFiltersDisplay: 'changed'` filters its
  chip row on: a `readonly string[]` default compares positionally, everything else compares with
  `Object.is`. This is the counterpart to `hasActiveFilters`, not a synonym — a bar whose filters
  were all declared with non-empty defaults and never touched reads `hasActiveFilters === true` and
  `hasChangedFilters === false`, because a bar whose defaults narrow the view on load has not been
  narrowed by the user. A filter with no declared `defaultValue` counts as changed the moment it
  holds any value at all (there is nothing for it to still equal), and clearing a filter that *does*
  declare one counts as changed too, since `reset()` would restore it — which is the one case where
  this getter and the `'changed'` chip row differ, the row's entries being non-empty by
  construction. Always live, never cached.
- `invalidFilterIds: readonly string[]` (read-only) — immutable ids of required filters whose
  values are unset.
- `activeFiltersDisplay: 'all' | 'changed' | 'hidden' = 'all'` (reflected, attribute
  `active-filters-display`) — which currently-active filters render as removable chips in the row
  below the fields. `'all'` (the default, and this component's only behavior before this property
  existed) shows one chip per non-empty filter, including one sitting at its own `defaultValue`.
  `'changed'` shows a chip only for a filter whose value differs from its own `defaultValue` — so a
  bar whose defaults narrow the view on load does not claim the user narrowed it — and a filter with
  no declared `defaultValue` counts as changed as soon as it has any value at all. `'hidden'` never
  renders the row. Array values compare against `defaultValue` positionally (same length, same entry
  at each index), matching this component's only other array-equality precedent (a custom adapter's
  own `clearValue` comparison); a `'date-range'` value is a single composed string, so it compares
  like any other string. Removing a chip always clears that filter, unaffected by this property.
  `'changed'` additionally gates the reset button on `hasChangedFilters` instead of
  `hasActiveFilters`, so an untouched defaults-only bar — which renders no chip in this mode — no
  longer offers an enabled reset that would change nothing. Enablement under `'all'` and `'hidden'`
  is unchanged, `disabled`/`loading` still win in every mode, and `reset()` itself is untouched.

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

**Events:** `lr-input`, `lr-reset`, `lr-validity-change`.

**Slots:** `end` — extra host-supplied controls (for example, a "Save search" or "Export"
action) rendered inside `controls`, next to the reset button. Hidden and claiming no layout
space while nothing is slotted.

**CSS parts:** `base`, `controls`, `field`, `field-<filterId>`, `end`, `filter-control`,
`filter-control-label`, `filter-control-label-group`, `filter-control-field`,
`filter-control-input`, `filter-control-start`, `filter-control-end`, `filter-control-listbox`,
`filter-control-option`, `filter-control-tags`, `filter-control-tag`, `filter-control-tag-label`,
`filter-control-tag-remove-button`, `filter-control-tag-remove-button-base`,
`filter-control-clear-button`, `filter-control-expand-button`, `filter-control-expand-icon`,
`filter-control-popup`, `filter-control-error`, `filter-control-hint`, `active-filters`, `chips`,
`chip`, `reset-button`, `status`.

The `filter-control-*` parts are semantic aliases forwarded from each built-in control's shadow
surface. `filter-control-field` consistently reaches the select trigger, combobox container, or
text/date input wrapper; `filter-control-input` reaches the corresponding display or editable input.
Listbox/option aliases apply to select and combobox filters, `filter-control-tags`/
`filter-control-tag`/`filter-control-tag-label` apply to a `multiple` combobox filter's selected-tag
chips (`filter-control-tag-label` is capped by that control's own `--tag-max-size`), and
expand-button/popup apply to date filters. `filter-control-tag-remove-button`/
`filter-control-tag-remove-button-base` reach a selected tag's own remove button and its inner icon
wrapper — the same reach a standalone `lr-combobox`/`lr-select` consumer already has, now available
from `lr-filter-bar` too, for a consumer re-skinning filter tags as pills who needs the remove
target inside one to be stylable. This lets a consumer theme the composed tier from
`lr-filter-bar::part(...)` without depending on the built-in control type selected by a filter
definition. Custom renderers retain ownership of their own part forwarding.

A `multiple` `'combobox'` filter collapses past its own `max-options-visible` (3 by default, an
`<lr-combobox>` property this component does not forward) into a localized "+N" overflow indicator,
the same substance as `lr-select`'s own `multiple`-mode overflow chip. The one remaining difference:
`lr-select`'s overflow chip carries a second, distinguishing `tag-overflow` part
(`part="tag tag-overflow tag__base"`) so a consumer can style just that chip; `lr-combobox`'s
overflow chip carries only the plain `tag` part, with no equivalent token to forward as
`filter-control-tag-overflow`. Adding one is `<lr-combobox>`'s own surface to grow, not something
`lr-filter-bar`'s `exportparts` can manufacture for a part its composed child never renders — noted
here as a known, deliberate gap rather than silently undocumented.
On a `'checkbox-menu'` filter, `filter-control-field` is the trigger button's own frame — the
element inside `<lr-button>` that draws the border, background and radius, not the chrome-less
button host, so a `::part(filter-control-field) { border-color: … }` rule works there exactly as it
does for every other filter type. `filter-control-start` is that trigger's adornment wrapper (where
a definition `icon` lands), `filter-control-input` is its selection summary, `filter-control-label`
is the trigger's own label text (not a stacked label above the control), `filter-control-listbox` is
the dropdown's popup surface, `filter-control-option` is one `role="menuitemcheckbox"` row, and
`filter-control-error` is the revealed required message — rendered by the bar itself, because the
composed dropdown has no error chrome of its own. The trigger also renders a `with-caret` disclosure
chevron, matching `lr-select`'s own — forwarded as `filter-control-expand-icon`, the same name a
select/combobox/date-input filter's own chevron already uses, so one consumer rule styles every
filter type's expand icon. `filter-control-label-group` reaches the trigger's own label wrapper —
the flex row this component lays `filter-control-label` and `filter-control-input` out in, which
also grows to fill the stretched trigger (via `with-caret`) so its content starts at the leading
edge instead of centring; no other filter type renders this part, since every other type's label and
input are two independent elements with no shared wrapper of their own. This component does not
render a stacked label above a `'checkbox-menu'` field the way every other built-in type does:
every other type's stacked label is rendered by the composed control itself, and there is no
equivalent shared "stacked label" template inside `<lr-filter-bar>` for this branch to reuse without
inventing a new one, so `labelVisibility` keeps its narrower meaning here (whether the trigger's own
baked-in label text is visible or screen-reader-only).

`field` wraps one filter's composed control and its validation spacer inside `controls`; its
flex-basis is themeable via `--lr-filter-bar-field-basis` (default `var(--lr-size-12rem)`).
`--lr-filter-bar-gap` (default `var(--lr-space-s)`) themes the gap between filter fields, the
`end` slot, the reset button, and the loading status in the `controls` row. Both are byte-identical
to the previous hardcoded values when unset.

Each field wrapper also carries a second, per-filter part token, `field-<filterId>` (for example
`part="field field-status"`), so a single field can be targeted directly --
`lr-filter-bar::part(field-status) { flex: 2 1 20rem; }` -- setting any layout property, not just a
width, while `::part(field)` rules continue to match every field unchanged. The `field-<filterId>`
token is present only when `filterId` reads as a plain CSS ident (ASCII letters/digits/`-`/`_`,
starting with a letter); an id that doesn't (for example one containing whitespace) renders `field`
alone, exactly as before this part existed, rather than risking a `part` attribute whose
space-separated token list fabricates an unrelated second token.

A `'select'`, `'combobox'` or `'checkbox-menu'` filter's required `options` entries are
`LyraFilterBarOption { value, label, icon?, searchText?, disabled? }`. `searchText` is extra text
the option also matches on, forwarded verbatim to `<lr-option>`'s own `search-text`, so a row can
keep a short visible `label` ("Urgent") while still matching a long canonical key ("SEV-1
production outage"). It affects a `'combobox'` filter only: the attribute is written on every
choice type's `<lr-option>`, but `<lr-select>`'s listbox type-ahead matches the option's `label`
alone and never reads it, and a `'checkbox-menu'` has no text entry to match against. `disabled`
marks the option non-actionable: forwarded to `<lr-option disabled>` for `'select'`/`'combobox'`
and to the composed `<lr-dropdown-item disabled>` for `'checkbox-menu'`, so the row renders
genuinely disabled (no tab/roving stop, no hover/press affordance) and arrow-key navigation already
steps past it, since that is the composed control's own existing `disabled` behavior. Omitted or
`false` renders the option exactly as before this field existed.
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
text the user typed, not a truncated or normalized form. `'chip'` is the one type that renders no
control at all (see **Chip-only filters** below): its value belongs to a widget elsewhere on the
page, so the bar renders only its active-filter chip and gives it no toolbar cell.

Every built-in (non-`'custom'`) filter definition additionally accepts optional `size: LyraSize`,
`icon: unknown` and `labelVisibility: 'visible' | 'hidden' | 'auto'` fields, and every one whose
composed control ships a clear action also accepts `clearable: boolean`. They are forwarded verbatim to that
control's own same-named property — `icon` into its `start` slot exactly like a choice option's own
`icon`, rendered inert and `aria-hidden`; `clearable` reaching `<lr-date-input>` under its own
`with-clear` spelling, since that control has no `clearable`. `'text'` also accepts
`inputType: LyraInputType` (forwarded to the composed `<lr-input>`'s own `type`, e.g.
`'search'`/`'email'`/`'tel'`/`'url'`), and `'combobox'` also accepts `emptyText: string` (forwarded
to its `empty-text`, the row its listbox shows when a query matches none of the declared options). A
`'custom'` definition deliberately accepts none of them: its renderer owns the control's markup
outright, so a field the bar could not forward anywhere would be inert API. Every one of these is
optional and defaults to that composed control's own default, so an existing filter definition
renders unchanged.

`labelVisibility: 'hidden'` routes the filter's `label` to the composed control's own `aria-label`
instead of rendering it as a stacked visible label, and — when the definition declares no
`placeholder` of its own — also uses it as the placeholder. The label is re-routed, never dropped,
so a compact toolbar row still names every field for assistive technology; visually hiding
`::part(filter-control-label)` in CSS, the only previous option, removed the accessible name along
with the text.

`labelVisibility: 'auto'` is the width-dependent middle between the two. It renders exactly what
`'visible'` renders — the same stacked label element, the same accessible name computed from it, no
`aria-label` and no placeholder fallback — and the bar's own stylesheet visually clips that label
once the bar's allocation drops below `30rem`. The threshold is a container query on the host, so it
reads the bar's own allocated width, not the viewport's: the same definitions render labelled across
a dashboard and unlabelled in a 320px side panel, dialog or split pane, with no host-side breakpoint
logic. The label element is never removed at any width, so the field's accessible name is identical
in both states, and `'auto'` deliberately does not route the name onto the control the way
`'hidden'` does — doing so would name a wide-allocation field twice. A `'checkbox-menu'` filter
participates through its own trigger label run, the same one `'hidden'` already clips there. The
threshold is fixed rather than themeable: a CSS container query's prelude cannot read a custom
property (`var()` is not substituted in an at-rule prelude), so a `--lr-*` hook for it would parse
and silently never apply.

`'combobox'` also accepts the same `debounce?: number` (ms) `'text'` already had: it coalesces a
burst of rapid selection changes (picks, a multi-select toggle, an
`allowCustomValue`/`allowCreate` commit, or the clear action) into one delayed commit. Unlike
`'text'`'s uncontrolled-with-sync field, the composed `<lr-combobox>`'s `.value=` binding stays
fully controlled: while a commit is pending it renders that pending selection rather than the
last-committed `value`, so the control's own display never reverts mid-delay. A pending debounce
is flushed by the control's own blur and cancelled by `reset()`, a chip removal, and
disconnection — identical to `'text'`.

### `'checkbox-menu'` filters

A `'checkbox-menu'` filter composes `<lr-dropdown>` plus one `<lr-dropdown-item type="checkbox">`
(`role="menuitemcheckbox"`) per option, behind a single toolbar trigger button. The menu stays open
across toggles, so several categories can be switched in one visit. Its value is a `string[]`,
identical to a `'combobox'` with `multiple`, so the two are interchangeable everywhere the bar's own
bookkeeping is concerned — the same `value` record, active-filter chips, `reset()` path, `required`
validation and single full-value `lr-input`. Choose between them on interaction, not on data shape:
reach for `'checkbox-menu'` when the set is small and fixed and typing to filter would only be in
the way.

Rows are controlled by `value` rather than self-toggling, so a toggle the bar refuses (a `disabled`
bar, a filter removed mid-interaction) can never leave a checkmark the bar disagrees with.

It is the one built-in type that renders no stacked label above its control: the trigger button
carries the `label` as its own text next to the selection summary, and `labelVisibility: 'hidden'`
makes that text visually hidden — never removed — so the button keeps its accessible name. In the
one case where the hidden label would be the *only* thing the button says (hidden routing, no
declared `placeholder`, nothing selected) the label routes to the visible summary instead of being
emitted twice, so the trigger's accessible name stays "Teams", never "Teams Teams".
`labelVisibility: 'auto'` clips that same trigger label run, and only below the `30rem` threshold —
the label run is always emitted under `'auto'`, since nothing is routed to the summary there.

Because its trigger is a button rather than a field, a `required` `'checkbox-menu'` deliberately
renders **no** required asterisk and sets **no** `aria-invalid`: the shared required marker has no
selector that matches a button trigger's label, and `<lr-button>` does not forward a host
`aria-invalid` onto the element that owns the button role, so writing one would be silently inert. A
revealed required error still reaches assistive technology — it joins the trigger's accessible name
as a screen-reader-only run, alongside the visible `filter-control-error` line under the field.

```ts
const filters: LyraFilterBarFilterDefinition[] = [
  {
    filterId: "teams",
    label: "Teams",
    type: "checkbox-menu",
    placeholder: "Any team",
    options: [
      { value: "core", label: "Core" },
      { value: "infra", label: "Infrastructure" },
      { value: "design", label: "Design" },
    ],
  },
];
// bar.value -> { teams: ["core", "design"] }
```

A filter bar detached and reattached while a checkbox menu is open comes back closed, like every
other transient state the bar owns.

### Date-range quick ranges

A `'date-range'` definition also accepts `presets?: readonly LyraDateRangePreset[]` (new in 12.0.0),
forwarded to its composed `<lr-date-input>` exactly like `min`/`max`, so the quick-range row
("Today", "Last 7 days", "All time") renders inside that filter's own calendar popover. Entries are
`LyraDateRangePreset { label, start?, end?, id? }` with ISO `YYYY-MM-DD` bounds; an omitted bound is
open and resolves to the filter's `min`/`max`, and an open bound with no corresponding limit renders
that button disabled. The optional `id` is a caller-owned correlation key, never read by the bar
itself -- it exists purely so `appliedPreset.id` (below) is typed without a cast. `presets` is
deliberately **not** accepted on a single `'date'` filter: a preset names two dates, so
`lr-date-picker` ignores the list outside range mode, and a list passed there is dropped rather
than rendering a row that cannot do anything.

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
keystroke can never overwrite a reset or fire after teardown. `'combobox'` accepts the same
`debounce`, and so does `'custom'` (see below); `debounce` is ignored for every other `type`, whose
commits are discrete choices with nothing to debounce.

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

A `'custom'` definition also accepts the same optional `debounce?: number` (ms) `'text'`/
`'combobox'` already have: it delays committing whatever `context.onValueChange`/`onInput`/
`onChange` reads through `adapter.valueFromEvent`, coalescing a burst of rapid commits into one.
Omitted, `0`, or a non-finite value means no debounce, exactly as before this field existed. While
one is pending, `context.value` carries that pending value rather than the last-committed one, so a
renderer binding it as a fully controlled value never reverts mid-delay; a pending commit is
**flushed** by `context.onFocusout` and **cancelled outright** by `reset()`, removing that filter's
chip, and disconnect — identical to `'text'`/`'combobox'`. This is what closes the gap those two
types' own debounce left: before this field existed, a custom free-text filter had to hand-roll the
same timer, flush, and cancellation lifecycle itself just to match `'text'`.

The adapter's required `clearValue` is used when the active chip is removed. Its optional
`isEmpty(value)` defines domain emptiness; without one, the bar compares against `clearValue`
(including shallow string-array equality). Its optional `formatValue(value, locale)` controls chip
display; `locale` is the filter bar's `effectiveLocale`, the same value every built-in filter
type's own chip formatting already receives, so an existing single-argument `formatValue`
implementation keeps working unchanged — JS simply ignores a second parameter it never declared.
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

### Chip-only filters

Use `type: 'chip'` when the value is already owned by a widget elsewhere on the page — a calendar
heatmap cell, a map selection, a chart brush — and the bar's job is only to *show* that the filter
is applied and to let the user take it off. Unlike `type: 'custom'`, which still renders a control
inside the toolbar, a chip-only filter renders **no control and no toolbar cell at all**: no `field`
wrapper is emitted for it, so `lr-filter-bar::part(field)` and `::part(field-<filterId>)` never
match one and a bar whose filters are *all* chip-only shows no empty column — its `controls` row
still holds the reset button (the "clear all" action such a bar needs), the `end` slot, and the
loading spinner, exactly like a bar with no filters at all.

Everything else is unchanged from any other filter type. The value lives in `value` under its own
filter ID, rides every `lr-input`/`lr-reset` detail, counts toward `hasActiveFilters` (so it enables
the reset button) and toward `invalidFilterIds` when the definition is `required`, renders a
removable active-filter chip subject to `activeFiltersDisplay`, and is cleared both by removing that
chip and by `reset()`. A `required` chip-only filter is honoured in **bookkeeping only**: it joins
`invalidFilterIds`, fails `checkValidity()` and moves `lr-validity-change`, but renders no inline
error, because the bar renders no element of its own for it — the owning widget is responsible for
its own error affordance. The inherited `placeholder` is inert here for the same reason it is for
`type: 'custom'`: there is no field to place it in.

A chip-only definition adds three optional fields of its own:

```ts
type: 'chip';
formatValue?: (value: LyraFilterBarFieldValue, locale: string) => string;
clearValue?: LyraFilterBarFieldValue;
isEmpty?: (value: LyraFilterBarFieldValue) => boolean;
```

`formatValue` produces the chip's text, and its `locale` argument is the bar's `effectiveLocale` —
the same locale every built-in type's own chip formatting and a custom adapter's `formatValue`
already receive, and the reason a chip-only value (normally an already-formatted string such as a
localized date) can be localized by the caller. That output is caller data, so — like a filter's
own label — the bar never routes it through its own localization. Omitted, the fallback ladder is
the one a custom adapter's omitted `formatValue` uses: a string array renders as a localized
conjunction list, anything else renders verbatim through `String(value)`, and an unset value renders
as the empty string. Verbatim is exact: a chip-only value is never run through the date branch that
localizes a `'date'`/`'date-range'` chip, so an ISO day is not silently reformatted and a value
containing a slash is not mangled.

`clearValue` is what a chip removal (and `clearFilter()`) writes, defaulting to the empty string —
what every non-multi built-in type writes. Declare an empty array for an array-valued chip-only
filter. `isEmpty` overrides the built-in emptiness rule (absent, `false`, the empty string and the
empty array are empty; everything else is set). **A domain sentinel must pair the two**: declaring
a sentinel clear value without a matching `isEmpty` leaves the bar reading the "cleared" value as
still set, so it keeps rendering a chip for it — the identical pairing a custom adapter's own
`clearValue`/`isEmpty` documents. With the pair declared, the sentinel is never stored in `value`
(cleared keys are omitted) and an absent key reads back as the sentinel for the owning widget.

```ts
const filters: LyraFilterBarFilterDefinition[] = [
  { filterId: "query", label: "Query", type: "text" },
  {
    filterId: "day",
    label: "Day",
    type: "chip",
    formatValue: (value, locale) =>
      new Intl.DateTimeFormat(locale, {
        dateStyle: "medium",
        timeZone: "UTC",
      }).format(new Date(`${String(value)}T00:00:00Z`)),
  },
];

// The calendar heatmap beside the bar owns the value; the bar only shows and removes it.
heatmap.addEventListener("app-select-day", (event) => {
  const { isoDate } = (event as CustomEvent<{ isoDate: string }>).detail;
  bar.value = { ...bar.value, day: isoDate };
});
bar.addEventListener("lr-input", (event) => {
  const { value } = (event as LyraFilterBarInputEvent).detail;
  heatmap.selectedDay = (value["day"] as string | undefined) ?? "";
});
```

**TypeScript:** `LyraFilterBar<Defs extends readonly LyraFilterBarFilterDefinition[] =
readonly LyraFilterBarFilterDefinition[]>` — `value` and the `lr-input`/`lr-reset` detail `value`
narrow to a record keyed per `filterId`, whose value type follows that filter's own definition (a
`'select'`, a non-`multiple` `'combobox'`, `'text'`, `'date'`, and `'date-range'` narrow to
`string`; a `'checkbox-menu'` and a `multiple: true` `'combobox'` narrow to `readonly string[]`; a
`'custom'` filter keeps the full unconstrained field value, and so does a `'chip'` filter, whose
value is owned by a widget this component never renders). Declare the schema with `as const
satisfies readonly LyraFilterBarFilterDefinition[]` and type the element as
`LyraFilterBar<typeof FILTERS>` to pick it up. Types only; the runtime is unchanged, and an untyped
`<lr-filter-bar>` keeps today's `LyraFilterBarValue` (`Readonly<Record<string, string | readonly
string[] | boolean | undefined>>`). `LyraFilterBarValueFor<Defs>` is the standalone alias for the
narrowed record, and `LyraFilterBarInputEvent<Defs>`/`LyraFilterBarResetEvent<Defs>` are stable
per-event aliases so a handler can name one event's type without restating the detail shape.

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

## Consumer integration notes

- **Multi-split:** `LyraMultiSplitToggleDetail` is `{ open: boolean }`. Escape or a backdrop click
  proposes a floating-panel state cancelably before `open` changes; `preventDefault()` or a
  synchronous reentrant write aborts the proposal. Leaving floating mode closes the panel, emits
  the collapse change, and then emits noncancelable `lr-toggle`; direct writes and no-ops stay
  silent. Divider numeric ARIA values remain percentages and their `aria-valuetext` is localized.
- **Resizers:** `lr-split-panel` retains numeric percent ranges with localized current-percent
  `aria-valuetext`; `lr-app-rail` and `lr-dock-panel` expose CSS-pixel ranges with localized current
  width/extent text. The app-rail toggle inherits rail typography and its glyph is `1em`.
- **Details structure:** `base` is the outer details container and `header` is its complete row.
  A private native `<details>` owns the summary; `header-actions` is its sibling after that native
  element, stays enabled and non-toggling even while the disclosure is disabled, and `content` is
  behind a private `hidden="until-found"` gate. `beforematch` or a fragment reveal follows the
  normal programmatic lifecycle, or re-arms the gate after a veto or disabled state.

## Exported TypeScript contracts

These named interfaces and helper signatures are available to typed integrations. They are grouped by capability so the component sections above can stay focused.

- **`components-layout-app-rail-app-rail-contracts`** — Supporting data types and helpers for this component family.
  Import: `@aceshooting/lyra-ui/components/layout/app-rail/app-rail.class.js`.
  `LyraAppRailModeChangeDetail {
    mode: LyraAppRailMode;
  }`
  Import: `@aceshooting/lyra-ui/components/layout/app-rail/app-rail.class.js`.
  `LyraAppRailResizeDetail {
    widthPx: number;
  }`
  Import: `@aceshooting/lyra-ui/components/layout/app-rail/app-rail.class.js`.
  `LyraAppRailToggleDetail {
    open: boolean;
  }`
  Import: `@aceshooting/lyra-ui/components/layout/app-rail/app-rail.class.js`.
  `computeAppRailMode(iconOnlyMatches: boolean, mobileMatches: boolean, preferredMode?: LyraAppRailPreferredMode | null): LyraAppRailMode`

- **`components-layout-app-rail-group-app-rail-group-contracts`** — Supporting data types and helpers for this component family.
  Import: `@aceshooting/lyra-ui/components/layout/app-rail-group/app-rail-group.class.js`.
  `LyraAppRailGroupToggleDetail {
    open: boolean;
  }`

- **`components-layout-app-rail-item-app-rail-item-contracts`** — Supporting data types and helpers for this component family.
  Import: `@aceshooting/lyra-ui/components/layout/app-rail/app-rail-item.class.js`.
  `LyraAppRailItemToggleDetail {
    open: boolean;
  }`

- **`components-layout-command-palette-command-palette-contracts`** — Supporting data types and helpers for this component family.
  Import: `@aceshooting/lyra-ui/components/layout/command-palette/command-palette.class.js`.
  `LyraCommand {
    commandId: string;
    label: string;
    description?: string;
    group?: string;
    shortcut?: string;
    keywords?: readonly string[];
    disabled?: boolean;
    icon?: unknown;
    onSelect?: () => void;
  }`

- **`components-layout-dashboard-grid-dashboard-grid-contracts`** — Supporting data types and helpers for this component family.
  Import: `@aceshooting/lyra-ui/components/layout/dashboard-grid/dashboard-grid.class.js`.
  `LyraDashboardCellMoveDetail {
    readonly cellId: string;
    readonly position: Readonly<{
      x: number;
      y: number;
    }>;
    readonly previous: Readonly<{
      x: number;
      y: number;
    }>;
  }`
  Import: `@aceshooting/lyra-ui/components/layout/dashboard-grid/dashboard-grid.class.js`.
  `LyraDashboardCellResizeDetail {
    readonly cellId: string;
    readonly size: Readonly<{
      w: number;
      h: number;
    }>;
    readonly previous: Readonly<{
      w: number;
      h: number;
    }>;
  }`
  Import: `@aceshooting/lyra-ui/components/layout/dashboard-grid/dashboard-grid.class.js`.
  `LyraDashboardCollisionDetail {
    readonly cellId: string;
    readonly collidedCellIds: readonly string[];
    readonly policy: LyraDashboardCollisionPolicy;
    readonly accepted: boolean;
  }`
  Import: `@aceshooting/lyra-ui/components/layout/dashboard-grid/dashboard-grid.class.js`.
  `LyraDashboardLayoutChangeDetail {
    readonly layout: readonly LyraDashboardCell[];
  }`

- **`components-layout-dashboard-grid-layout-types-contracts`** — Supporting data types and helpers for this component family.
  Import: `@aceshooting/lyra-ui/components/layout/dashboard-grid/dashboard-grid.js`.
  `LyraDashboardCell {
    readonly cellId: string;
    readonly x: number;
    readonly y: number;
    readonly w: number;
    readonly h: number;
    readonly minW?: number;
    readonly minH?: number;
    readonly maxW?: number;
    readonly maxH?: number;
    readonly locked?: boolean;
    readonly widget?: LyraWidgetNode | null;
    readonly label?: string;
  }`
  Import: `@aceshooting/lyra-ui/components/layout/dashboard-grid/dashboard-grid.js`.
  `LyraDashboardPlacementResult {
    readonly accepted: boolean;
    readonly layout: readonly LyraDashboardCell[];
    readonly collidedCellIds: readonly string[];
  }`

- **`components-layout-dashboard-grid-layout-contracts`** — Supporting data types and helpers for this component family.
  Import: `@aceshooting/lyra-ui/components/layout/dashboard-grid/dashboard-grid.js`.
  `resolveLyraDashboardPlacement(layout: readonly LyraDashboardCell[], candidateCellId: string, requested: Readonly<{
    x: number;
    y: number;
    w: number;
    h: number;
  }>, columns: number, policy: LyraDashboardCollisionPolicy): LyraDashboardPlacementResult`

- **`components-layout-details-accordion-contracts`** — Supporting data types and helpers for this component family.
  Import: `@aceshooting/lyra-ui/components/layout/details/accordion.class.js`.
  `LyraAccordionEventDetail {
    readonly item: LyraAccordionItem;
  }`

- **`components-layout-details-details-contracts`** — Supporting data types and helpers for this component family.
  Import: `@aceshooting/lyra-ui/components/layout/details/details.class.js`.
  `LyraDetailsToggleDetail {
    open: boolean;
    source: LyraDetailsToggleSource;
  }`

- **`components-layout-dock-panel-dock-panel-contracts`** — Supporting data types and helpers for this component family.
  Import: `@aceshooting/lyra-ui/components/layout/dock-panel/dock-panel.class.js`.
  `LyraDockPanelCollapseChangeDetail {
    readonly collapsed: boolean;
  }`
  Import: `@aceshooting/lyra-ui/components/layout/dock-panel/dock-panel.class.js`.
  `LyraDockPanelResizeDetail {
    readonly extent: string;
  }`

- **`components-layout-drilldown-panel-drilldown-panel-contracts`** — Supporting data types and helpers for this component family.
  Import: `@aceshooting/lyra-ui/components/layout/drilldown-panel/drilldown-panel.class.js`.
  `LyraDrilldownCategoryChangeDetail {
    readonly nodeId: string;
    readonly category: LyraDrilldownCategory;
    readonly previousCategory: LyraDrilldownCategory;
  }`
  Import: `@aceshooting/lyra-ui/components/layout/drilldown-panel/drilldown-panel.class.js`.
  `LyraDrilldownDocumentDownloadDetail {
    readonly nodeId: string;
    readonly documentId: string;
    readonly src: string;
    readonly filename: string;
  }`
  Import: `@aceshooting/lyra-ui/components/layout/drilldown-panel/drilldown-panel.class.js`.
  `LyraDrilldownDocumentHighlightActivateDetail {
    readonly nodeId: string;
    readonly documentId: string;
    readonly highlightId: string;
  }`
  Import: `@aceshooting/lyra-ui/components/layout/drilldown-panel/drilldown-panel.class.js`.
  `LyraDrilldownDocument {
    readonly documentId: string;
    readonly name: string;
    readonly mimeType?: string;
    readonly uri?: string;
    readonly version?: string;
  }`
  Import: `@aceshooting/lyra-ui/components/layout/drilldown-panel/drilldown-panel.class.js`.
  `LyraDrilldownDocumentRenderErrorDetail {
    readonly nodeId: string;
    readonly documentId: string;
    readonly error: unknown;
  }`
  Import: `@aceshooting/lyra-ui/components/layout/drilldown-panel/drilldown-panel.class.js`.
  `LyraDrilldownEntityActivateDetail {
    readonly nodeId: string;
    readonly entityId: string;
  }`
  Import: `@aceshooting/lyra-ui/components/layout/drilldown-panel/drilldown-panel.class.js`.
  `LyraDrilldownEntity {
    readonly entityId: string;
    readonly label: string;
    readonly type?: string;
    readonly description?: string;
    readonly properties?: Readonly<Record<string, string | number>>;
    readonly degree?: number;
    readonly communityId?: string;
  }`
  Import: `@aceshooting/lyra-ui/components/layout/drilldown-panel/drilldown-panel.class.js`.
  `LyraDrilldownEvidenceExpandDetail {
    readonly nodeId: string;
    readonly evidenceId: string;
    readonly expanded: boolean;
  }`
  Import: `@aceshooting/lyra-ui/components/layout/drilldown-panel/drilldown-panel.class.js`.
  `LyraDrilldownEvidenceItem {
    readonly evidenceId: string;
    readonly title: string;
    readonly page?: string | number;
    readonly href?: string;
    readonly excerpt?: string;
    readonly full?: string;
  }`
  Import: `@aceshooting/lyra-ui/components/layout/drilldown-panel/drilldown-panel.class.js`.
  `LyraDrilldownEvidenceOpenDetail {
    readonly nodeId: string;
    readonly evidenceId: string;
    readonly href?: string;
  }`
  Import: `@aceshooting/lyra-ui/components/layout/drilldown-panel/drilldown-panel.class.js`.
  `LyraDrilldownNavigateDetail {
    readonly nodeId: string;
    readonly index: number;
  }`
  Import: `@aceshooting/lyra-ui/components/layout/drilldown-panel/drilldown-panel.class.js`.
  `LyraDrilldownNode {
    readonly nodeId: string;
    readonly label: string;
    readonly evidence?: readonly LyraDrilldownEvidenceItem[];
    readonly documents?: readonly LyraDrilldownDocument[];
    readonly entities?: readonly LyraDrilldownEntity[];
  }`

- **`components-layout-filter-bar-filter-bar-contracts`** — Supporting data types and helpers for this component family.
  Import: `@aceshooting/lyra-ui/components/layout/filter-bar/filter-bar.class.js`.
  `LyraFilterBarComboboxDefinition extends LyraFilterBarClearableDefinitionBase {
    readonly type: 'combobox';
    readonly options: readonly LyraFilterBarOption[];
    readonly multiple?: boolean;
    readonly debounce?: number;
    readonly emptyText?: string;
    // Inherited from LyraFilterBarClearableDefinitionBase.
    readonly clearable?: boolean;
    // Inherited from LyraFilterBarComposedDefinitionBase.
    readonly size?: LyraSize;
    readonly icon?: unknown;
    readonly labelVisibility?: LyraFilterBarLabelVisibility;
    // Inherited from LyraFilterBarDefinitionBase.
    readonly filterId: string;
    readonly label: string;
    readonly placeholder?: string;
    readonly required?: boolean;
    readonly defaultValue?: string | readonly string[] | boolean;
  }`
  Import: `@aceshooting/lyra-ui/components/layout/filter-bar/filter-bar.class.js`.
  `LyraFilterBarCheckboxMenuDefinition extends LyraFilterBarComposedDefinitionBase {
    readonly type: 'checkbox-menu';
    readonly options: readonly LyraFilterBarOption[];
    // Inherited from LyraFilterBarComposedDefinitionBase.
    readonly size?: LyraSize;
    readonly icon?: unknown;
    readonly labelVisibility?: LyraFilterBarLabelVisibility;
    // Inherited from LyraFilterBarDefinitionBase.
    readonly filterId: string;
    readonly label: string;
    readonly placeholder?: string;
    readonly required?: boolean;
    readonly defaultValue?: string | readonly string[] | boolean;
  }`
  Import: `@aceshooting/lyra-ui/components/layout/filter-bar/filter-bar.class.js`.
  `LyraFilterBarChipDefinition extends LyraFilterBarDefinitionBase {
    readonly type: 'chip';
    readonly formatValue?: (value: LyraFilterBarFieldValue, locale: string) => string;
    readonly clearValue?: LyraFilterBarFieldValue;
    readonly isEmpty?: (value: LyraFilterBarFieldValue) => boolean;
    // Inherited from LyraFilterBarDefinitionBase.
    readonly filterId: string;
    readonly label: string;
    readonly placeholder?: string;
    readonly required?: boolean;
    readonly defaultValue?: string | readonly string[] | boolean;
  }`
  Import: `@aceshooting/lyra-ui/components/layout/filter-bar/filter-bar.class.js`.
  `LyraFilterBarCustomControlAdapter {
    readonly valueFromEvent: (event: Event) => LyraFilterBarFieldValue;
    readonly clearValue: LyraFilterBarFieldValue;
    readonly isEmpty?: (value: LyraFilterBarFieldValue) => boolean;
    readonly formatValue?: (value: LyraFilterBarFieldValue, locale: string) => string;
  }`
  Import: `@aceshooting/lyra-ui/components/layout/filter-bar/filter-bar.class.js`.
  `LyraFilterBarCustomControlContext {
    readonly filterId: string;
    readonly label: string;
    readonly definition: LyraFilterBarCustomDefinition;
    readonly value: LyraFilterBarFieldValue;
    readonly disabled: boolean;
    readonly required: boolean;
    readonly errorText: string;
    readonly signal: AbortSignal;
    readonly generation: number;
    readonly setValue: (value: LyraFilterBarFieldValue) => void;
    readonly onValueChange: (event: Event) => void;
    readonly onInput: (event: Event) => void;
    readonly onChange: (event: Event) => void;
    readonly onFocusout: () => void;
  }`
  Import: `@aceshooting/lyra-ui/components/layout/filter-bar/filter-bar.class.js`.
  `LyraFilterBarCustomControl {
    readonly render: (context: LyraFilterBarCustomControlContext) => TemplateResult;
    readonly adapter: LyraFilterBarCustomControlAdapter;
  }`
  Import: `@aceshooting/lyra-ui/components/layout/filter-bar/filter-bar.class.js`.
  `LyraFilterBarCustomDefinition extends LyraFilterBarDefinitionBase {
    readonly type: 'custom';
    readonly custom: LyraFilterBarCustomControl;
    readonly debounce?: number;
    // Inherited from LyraFilterBarDefinitionBase.
    readonly filterId: string;
    readonly label: string;
    readonly placeholder?: string;
    readonly required?: boolean;
    readonly defaultValue?: string | readonly string[] | boolean;
  }`
  Import: `@aceshooting/lyra-ui/components/layout/filter-bar/filter-bar.class.js`.
  `LyraFilterBarDateDefinition extends LyraFilterBarDateDefinitionBase {
    readonly type: 'date';
    // Inherited from LyraFilterBarDateDefinitionBase.
    readonly min?: string;
    readonly max?: string;
    readonly clearable?: boolean;
    readonly size?: LyraSize;
    readonly icon?: unknown;
    readonly labelVisibility?: LyraFilterBarLabelVisibility;
    readonly filterId: string;
    readonly label: string;
    readonly placeholder?: string;
    readonly required?: boolean;
    readonly defaultValue?: string | readonly string[] | boolean;
  }`
  Import: `@aceshooting/lyra-ui/components/layout/filter-bar/filter-bar.class.js`.
  `LyraFilterBarDateRangeDefinition extends LyraFilterBarDateDefinitionBase {
    readonly type: 'date-range';
    readonly presets?: readonly LyraDateRangePreset[];
    // Inherited from LyraFilterBarDateDefinitionBase.
    readonly min?: string;
    readonly max?: string;
    readonly clearable?: boolean;
    readonly size?: LyraSize;
    readonly icon?: unknown;
    readonly labelVisibility?: LyraFilterBarLabelVisibility;
    readonly filterId: string;
    readonly label: string;
    readonly placeholder?: string;
    readonly required?: boolean;
    readonly defaultValue?: string | readonly string[] | boolean;
  }`
  Import: `@aceshooting/lyra-ui/components/layout/filter-bar/filter-bar.class.js`.
  `LyraFilterBarInputDetail {
    readonly value: LyraFilterBarValue;
    readonly filterId?: string;
    readonly appliedPreset?: LyraDateRangePreset;
  }`
  Import: `@aceshooting/lyra-ui/components/layout/filter-bar/filter-bar.class.js`.
  `LyraFilterBarOption {
    readonly value: string;
    readonly label: string;
    readonly icon?: unknown;
    readonly searchText?: string;
    readonly disabled?: boolean;
  }`
  Import: `@aceshooting/lyra-ui/components/layout/filter-bar/filter-bar.class.js`.
  `LyraFilterBarResetDetail {
    readonly value: LyraFilterBarValue;
  }`
  Import: `@aceshooting/lyra-ui/components/layout/filter-bar/filter-bar.class.js`.
  `LyraFilterBarSelectDefinition extends LyraFilterBarClearableDefinitionBase {
    readonly type: 'select';
    readonly options: readonly LyraFilterBarOption[];
    // Inherited from LyraFilterBarClearableDefinitionBase.
    readonly clearable?: boolean;
    // Inherited from LyraFilterBarComposedDefinitionBase.
    readonly size?: LyraSize;
    readonly icon?: unknown;
    readonly labelVisibility?: LyraFilterBarLabelVisibility;
    // Inherited from LyraFilterBarDefinitionBase.
    readonly filterId: string;
    readonly label: string;
    readonly placeholder?: string;
    readonly required?: boolean;
    readonly defaultValue?: string | readonly string[] | boolean;
  }`
  Import: `@aceshooting/lyra-ui/components/layout/filter-bar/filter-bar.class.js`.
  `LyraFilterBarTextDefinition extends LyraFilterBarClearableDefinitionBase {
    readonly type: 'text';
    readonly debounce?: number;
    readonly inputType?: LyraInputType;
    // Inherited from LyraFilterBarClearableDefinitionBase.
    readonly clearable?: boolean;
    // Inherited from LyraFilterBarComposedDefinitionBase.
    readonly size?: LyraSize;
    readonly icon?: unknown;
    readonly labelVisibility?: LyraFilterBarLabelVisibility;
    // Inherited from LyraFilterBarDefinitionBase.
    readonly filterId: string;
    readonly label: string;
    readonly placeholder?: string;
    readonly required?: boolean;
    readonly defaultValue?: string | readonly string[] | boolean;
  }`
  Import: `@aceshooting/lyra-ui/components/layout/filter-bar/filter-bar.class.js`.
  `LyraFilterBarValidityDetail {
    readonly valid: boolean;
    readonly invalidFilterIds: readonly string[];
  }`

- **`components-layout-menu-menu-item-contracts`** — Supporting data types and helpers for this component family.
  Import: `@aceshooting/lyra-ui/components/layout/menu/menu-item.class.js`.
  `MenuItemChangeDetail {
    value: string;
    checked: boolean;
  }`
  Import: `@aceshooting/lyra-ui/components/layout/menu/menu-item.class.js`.
  `MenuItemStateChangeDetail {
    disabled: boolean;
    hidden: boolean;
    inert: boolean;
  }`

- **`components-layout-menu-menu-contracts`** — Supporting data types and helpers for this component family.
  Import: `@aceshooting/lyra-ui/components/layout/menu/menu.class.js`.
  `MenuItemSelectDetail {
    readonly item: LyraMenuItem;
  }`

- **`components-layout-multi-split-multi-split-contracts`** — Supporting data types and helpers for this component family.
  Import: `@aceshooting/lyra-ui/components/layout/multi-split/multi-split.class.js`.
  `LyraMultiSplitCollapseChangeDetail {
    readonly state: LyraMultiSplitCollapseState;
  }`
  Import: `@aceshooting/lyra-ui/components/layout/multi-split/multi-split.class.js`.
  `LyraMultiSplitToggleDetail {
    readonly open: boolean;
  }`
  Import: `@aceshooting/lyra-ui/components/layout/multi-split/multi-split.class.js`.
  `LyraMultiSplitConstraintIssueDetail {
    readonly reason: LyraMultiSplitConstraintIssueReason;
    readonly panelCount: number;
    readonly minimumTotal: number;
    readonly maximumTotal: number | null;
    readonly containerSize: number;
  }`
  Import: `@aceshooting/lyra-ui/components/layout/multi-split/multi-split.class.js`.
  `LyraMultiSplitOrientationChangeDetail {
    readonly orientation: LyraOrientation;
  }`
  Import: `@aceshooting/lyra-ui/components/layout/multi-split/multi-split.class.js`.
  `LyraMultiSplitPanelConstraint {
    readonly minPx?: number;
    readonly maxPx?: number;
    readonly minPercent?: number;
    readonly maxPercent?: number;
  }`
  Import: `@aceshooting/lyra-ui/components/layout/multi-split/multi-split.class.js`.
  `LyraMultiSplitResizeDetail {
    readonly sizes: readonly number[];
  }`

- **`components-layout-navigation-menu-item-navigation-menu-item-contracts`** — Supporting data types and helpers for this component family.
  Import: `@aceshooting/lyra-ui/components/layout/navigation-menu-item/navigation-menu-item.class.js`.
  `LyraNavigationMenuToggleDetail {
    open: boolean;
    source: LyraDetailsToggleSource;
  }`

- **`components-layout-navigation-menu-navigation-menu-contracts`** — Supporting data types and helpers for this component family.
  Import: `@aceshooting/lyra-ui/components/layout/navigation-menu/navigation-menu.class.js`.
  `LyraNavigationMenuExpandedChangeDetail {
    expanded: boolean;
    source: LyraNavigationMenuExpandedChangeSource;
  }`

- **`components-layout-reorder-list-reorder-list-contracts`** — Supporting data types and helpers for this component family.
  Import: `@aceshooting/lyra-ui/components/layout/reorder-list/reorder-list.class.js`.
  `LyraReorderDetail {
    readonly order: readonly string[];
    readonly fromIndex: number;
    readonly toIndex: number;
  }`

- **`components-layout-responsive-panel-responsive-panel-contracts`** — Supporting data types and helpers for this component family.
  Import: `@aceshooting/lyra-ui/components/layout/responsive-panel/responsive-panel.class.js`.
  `LyraResponsivePanelModeChangeDetail {
    mode: LyraResponsivePanelEffectiveMode;
  }`
  Import: `@aceshooting/lyra-ui/components/layout/responsive-panel/responsive-panel.class.js`.
  `resolveResponsivePanelEffectiveMode(mode: LyraResponsivePanelMode, belowBreakpoint: boolean): LyraResponsivePanelEffectiveMode`

- **`components-layout-segmented-segmented-contracts`** — Supporting data types and helpers for this component family.
  Import: `@aceshooting/lyra-ui/components/layout/segmented/segmented.class.js`.
  `LyraSegmentedItem {
    value: string;
    label: string;
    icon?: unknown;
    disabled?: boolean;
  }`

- **`components-layout-split-panel-split-panel-contracts`** — Supporting data types and helpers for this component family.
  Import: `@aceshooting/lyra-ui/components/layout/split-panel/split-panel.class.js`.
  `SNAP_NONE(options: { pos: number; size: number; snapThreshold: number; }): number`
  Import: `@aceshooting/lyra-ui/components/layout/split-panel/split-panel.class.js`.
  `LyraSplitPanelSnapFunctionParams {
    pos: number;
    size: number;
    snapThreshold: number;
  }`
  Import: `@aceshooting/lyra-ui/components/layout/split-panel/split-panel.class.js`.
  `LyraSplitPanelRepositionDetail {
    position: number;
    positionInPixels: number;
  }`

- **`components-layout-stepper-stepper-contracts`** — Supporting data types and helpers for this component family.
  Import: `@aceshooting/lyra-ui/components/layout/stepper/stepper.class.js`.
  `LyraStepItem {
    stepId: string;
    label: string;
    state: LyraStepState;
    disabled?: boolean;
    title?: string;
    icon?: unknown;
  }`
  Import: `@aceshooting/lyra-ui/components/layout/stepper/stepper.class.js`.
  `LyraStepperOrientationChangeDetail {
    orientation: LyraOrientation;
  }`

- **`components-layout-virtual-list-virtual-list-contracts`** — Supporting data types and helpers for this component family.
  Import: `@aceshooting/lyra-ui/components/layout/virtual-list/virtual-list.class.js`.
  `LyraVirtualListGroup {
    key: string | number;
    label?: string;
    startIndex: number;
  }`
  Import: `@aceshooting/lyra-ui/components/layout/virtual-list/virtual-list.class.js`.
  `LyraVirtualListIndexedSource<T = unknown> {
    readonly count: number;
    itemAt(index: number): T;
    keyAt?(index: number): string | number;
    indexOfKey?(key: string | number): number;
  }`
  Import: `@aceshooting/lyra-ui/components/layout/virtual-list/virtual-list.class.js`.
  `LyraVirtualListRange {
    start: number;
    end: number;
  }`
  Import: `@aceshooting/lyra-ui/components/layout/virtual-list/virtual-list.class.js`.
  `LyraVirtualListScroll {
    scrollTop: number;
    viewportHeight: number;
  }`

- **`components-layout-widget-widget-contracts`** — Supporting data types and helpers for this component family.
  Import: `@aceshooting/lyra-ui/components/layout/widget/widget.class.js`.
  `LyraWidgetView {
    viewId: string;
    label?: string;
    icon?: unknown;
    ariaLabel?: string;
  }`

## `lr-navigation-menu`

Site-header navigation following the WAI-ARIA **disclosure navigation** pattern (first-party, no
`wa-*`/`sl-*` counterpart): a `nav` landmark holding a `role="list"` row of
`<lr-navigation-menu-item>` links and disclosure buttons. A disclosure's flyout panel opens in one
shared region below the bar. It never uses `menu`/`menubar` roles — application menus belong to
`lr-menu`, and no arrow key ever opens or closes a panel.

- **Opening.** Hovering a trigger opens its panel after `showDelay` (mouse only; touch and pen never
  open on hover). While a panel is open, hovering another trigger switches immediately and the
  shared region resizes to the new content. A click, Enter or Space opens a panel too. A click on a
  hover-opened trigger *pins* it, so leaving no longer closes it; the next click closes it.
  Opening one panel closes the other (`lr-toggle` with `source: 'peer'`).
- **Hover grace.** A hover that arrives within `skipDelay` ms of a panel closing opens immediately.
- **Closing.** Escape (focus returns to the trigger only when focus was inside the item), a press
  outside the open item or on a non-trigger item, focus leaving the item, a hover-opened panel losing
  the pointer after `hideDelay`, and activating a link — a plain primary click on an `a[href]` inside
  a panel or on a link item, even when a router calls `preventDefault()`. Ctrl, Meta, Shift and
  middle clicks close nothing. A panel that holds focus never switches away on hover.
- **Focus repair.** Whenever a close or collapse would hide the focused element, focus first moves
  to that item's trigger, or to the toggle when the collapsed list hides.
- **Keyboard (bar layout).** Every top-level link or button stays in the Tab order and Tab from an
  open trigger enters its panel. ArrowRight/ArrowLeft move to the next/previous item without
  wrapping (swapped under right-to-left text); Home/End jump to the first/last. Hidden, `inert`
  and `aria-hidden` items are skipped. ArrowDown on an *open* trigger focuses the first control in
  its panel; on a closed trigger, a link or a plain button it does nothing. Inside a panel,
  ArrowDown/ArrowUp/Home/End move between its links and buttons (text fields and composite widgets
  keep their own keys). Keys with Alt, Ctrl or Meta are never handled.

**Properties:**

- `accessibleLabel?: string` (attribute `aria-label`) — names the `nav` landmark by attribute
  presence; an explicitly empty `aria-label=""` leaves it unnamed. Unset, the landmark is named with
  the localized `navigation` string ("Navigation"). Several menus on one page (for example a header
  and a footer) need distinct labels, or axe reports `landmark-unique`.
- `mobileBreakpoint?: string` (attribute `mobile-breakpoint`) — a bare number or a `px`, `rem` or
  `em` length. The menu collapses while its own content-box inline size is at or below it (the same
  `<=` comparison and name as `lr-page`). Unlike `lr-page` and `lr-app-rail` there is no default:
  unset or unresolvable means the menu never collapses and its row wraps instead.
- `expanded: boolean = false` (reflected) — whether the list shows in the collapsed layout. Kept
  while the bar layout is active and applied at the next collapse; reset to `false` (with
  `lr-expanded-change`, source `programmatic`) when the menu leaves the collapsed layout.
- `indicator: boolean = false` (reflected) — shows a decorative notch under the trigger whose panel
  is open.
- `panelAnchor: LyraNavigationMenuPanelAnchor = 'menu'` (attribute `panel-anchor`, reflected) —
  `menu` aligns every panel with the start edge of the item row, so switching panels resizes one
  region in place; `item` aligns each panel with its own trigger (no resize animation). Unsupported
  values, including untyped property writes, normalize to `menu` and repair the attribute.
- `showDelay: number = 200` (attribute `show-delay`) — hover-open delay in ms.
- `hideDelay: number = 150` (attribute `hide-delay`) — delay before a hover-opened panel closes once
  the pointer leaves the item.
- `skipDelay: number = 300` (attribute `skip-delay`) — the hover grace window; `0` disables it.
- `distance: number = 6` — gap in px between the anchor and a floating panel.
- `collapsed` (read-only boolean getter) — whether the collapsed layout is active; `false` on the
  server and until the first measurement. Mirrored to the `collapsed` custom state.

The three delays are JavaScript timer inputs, not CSS custom properties, and use the same
`show-delay`/`hide-delay` vocabulary as `lr-tooltip`/`lr-popover`. Non-finite values fall back to
the defaults and negative values clamp to `0` (a `0` show delay opens in the same turn).

**Methods:** `close(): void` closes the open panel and collapses an expanded list (both announced
with source `programmatic`), for single-page route changes. Focus moves only when the close would
hide the focused element; a router's own later `focus()` still wins.

**Events:** `lr-expanded-change` — `detail: LyraNavigationMenuExpandedChangeDetail`
(`{ expanded, source: 'user' | 'programmatic' }`), not cancelable, fired after a change to
`expanded` renders. `user` covers the toggle, Escape in the collapsed list, and a link or
plain-button activation that collapses it. The menu never emits `lr-toggle` itself.

**Slots:** default — `lr-navigation-menu-item` children only; `toggle-icon` — replaces the hamburger
glyph (inert, `aria-hidden`). Every default-slot child renders inside the `role="list"`, so a
non-item child fails axe and draws a one-time development warning: keep header chrome such as a
logo, search or actions *outside* the menu.

**CSS parts:** `base` (the `nav`), `list`, `toggle` (collapsed layout only), `toggle-icon`,
`toggle-label`, `indicator` (with `indicator`, bar layout only) and `indicator-arrow`.

**Custom state:** `collapsed`.

**Custom properties:** `--lr-navigation-menu-gap` (default `var(--lr-space-xs)`, both layouts),
`--lr-navigation-menu-indicator-size` (default `var(--lr-size-0-375rem)`),
`--lr-navigation-menu-indicator-color` (default
`var(--lr-overlay-border, var(--lr-color-border-subtle))`, matching the panel edge), and
`--lr-navigation-menu-toggle-active-color` (default `var(--lr-color-text)`), and
`--lr-positioning-strategy` (read by the items when positioning their panels). All are read through
inline fallbacks, so they can be set on the menu or any ancestor.

**Collapsed layout.** A "Menu" toggle (`aria-expanded`/`aria-controls` pointing at the list; the
visible text is the localized `menuLabel`) shows and hides the items as a column. Items stretch to
the full width and each panel opens in flow below its trigger, indented with a decorative subtle
rule. Hover and arrow keys are off; Escape first closes an open panel (focus to its trigger), then
collapses the list (focus to the toggle). The same nodes serve both layouts; nothing moves between
containers, so the collapse never drops focus. Crossing the breakpoint closes the open panel
(source `programmatic`) and repairs focus. For a drawer, place the menu inside `lr-drawer` or
`lr-page`'s `navigation` slot.

**Host allocation.** The host defaults to `display: block; flex: 1 1 0%; min-inline-size: 0`. In a
flex-row header (including `lr-page`'s header) the menu therefore takes the remaining space rather
than its content size; a content-sized collapsed menu could otherwise shrink to its toggle and never
measure wide enough to leave the collapsed layout. Outside a flex parent the declaration is inert.
In a column flex parent (for example `lr-page`'s navigation region) the host grows in the block axis
instead — set `flex: none` there. Shrink-to-fit contexts (an `auto` grid track, inline-flex, floats,
absolute positioning) can still latch collapsed: give the menu a definite inline size there.

**Motion.** Panels open and close through the `navigation-menu.show` and `navigation-menu.hide`
registry animations; a switch between panels resizes the shared region (timed by
`--lr-navigation-menu-switch-duration`) while the new content slides in through
`navigation-menu.enter-from-start` or `navigation-menu.enter-from-end`. The menu is the registry host
for every owned item, so `setAnimation(menu, 'navigation-menu.show', null)` applies to all of them.
Reduced motion flattens every transition and skips the resize.

**SSR and hydration.** The server renders the bar layout with the landmark named. Every link item is
an `<a>`; every other item renders as a trigger (caret visible, `aria-expanded="false"`) because slot
content cannot be inspected on the server, and every panel renders hidden, even for `open` markup.
The first browser update drops the caret and ARIA from plain buttons, sets `role="listitem"` on the
item hosts, keeps only the first `open` item, and reveals and positions its panel.

```html
<script type="module">
  import '@aceshooting/lyra-ui/components/layout/navigation-menu/navigation-menu.js';
</script>

<header style="display: flex; align-items: center; justify-content: space-between">
  <a href="/">Acme</a>
  <lr-navigation-menu aria-label="Main" mobile-breakpoint="40rem">
    <lr-navigation-menu-item>
      Products
      <ul slot="panel">
        <li><a href="/analytics">Analytics</a></li>
        <li><a href="/billing">Billing</a></li>
      </ul>
    </lr-navigation-menu-item>
    <lr-navigation-menu-item href="/docs" current>Docs</lr-navigation-menu-item>
    <lr-navigation-menu-item href="/pricing">Pricing</lr-navigation-menu-item>
  </lr-navigation-menu>
  <a href="/sign-in">Sign in</a>
</header>
```

The registration module also registers `lr-navigation-menu-item`.

### `lr-navigation-menu-item`

One entry of the bar. The kind follows from the markup:

1. A safe `href` makes a **link item**: a native `<a>` with `aria-current="page"` while `current`
   (otherwise `"false"`). Its `panel` slot is never displayed. This is decided from attributes alone,
   so it is stable without JavaScript. An unsafe scheme such as `javascript:` renders a button.
2. Otherwise the item is a native `<button type="button">`: a **disclosure trigger** when the `panel`
   slot has content (it gains `aria-expanded` in both states, `aria-controls` pointing at the panel
   in the same shadow root, and the caret), or a **plain button** with no disclosure state when it
   does not — useful for single-page routers. Activating a plain button closes the open panel (and
   collapses the collapsed list).

The panel has no role and no name; the lists and links inside own the semantics. Outside an
`lr-navigation-menu` the item works as a plain in-flow disclosure: no positioning, no overlay, no
hover opening.

**Properties:**

- `accessibleLabel?: string` (attribute `aria-label`) — forwarded by presence to the link or button,
  including an explicitly empty value.
- `href: string = ''` — link URL, sanitized; a safe value makes a link item.
- `target: string = ''` — native link target. Any non-empty value forces `noopener noreferrer`.
- `rel: string = ''` — author tokens are kept, `opener` is dropped in any letter case, duplicates
  collapse, and `noopener noreferrer` is added whenever `target` is set; nothing left omits the
  attribute.
- `current: boolean = false` (reflected) — on a link, `aria-current="page"`; on a trigger or plain
  button, only the `base-current` part (a disclosure is not the page — mark the current link inside
  the panel instead).
- `open: boolean = false` (reflected) — whether the panel is shown. A write is refused silently only
  when the item cannot disclose: it is a link item, or its `panel` slot is empty once slot content can
  be inspected. Within one menu only one item is open at a time.

**Methods:** `focus(options?)` and `click()` forward to the link or button.

**Events:** `lr-toggle` — `detail: LyraNavigationMenuToggleDetail` (`{ open, source }`, where
`source` is `'user' | 'programmatic' | 'peer'`, the same vocabulary as `lr-details`), not cancelable,
fired after an accepted change renders and never for initial markup. `user` covers click, Enter,
Space, hover, Escape, light dismiss, focus leaving and link activation; `programmatic` covers `open`
writes, the menu's `close()`, a layout change and losing the panel content; `peer` means a sibling
opened. Panel content such as `lr-details` also bubbles `lr-toggle`, so a delegated listener filters
on `event.target.localName`.

**Slots:** default — the label; `start`/`end` — adornments inside the link or button; `panel` —
flyout content; `expand-icon` — replaces the caret (inert, `aria-hidden`).

**CSS parts:** `base` (the `<a>` or `<button>`, also carrying `base-current` while `current` and
`base-open` while its panel is open — state lives in the part name because only pseudo-classes may
follow `::part()`), `base-current`, `base-open`, `start`, `label`, `end`, `expand-icon` and `panel`.

**Custom properties:** `--lr-navigation-menu-item-padding-inline` (default `var(--lr-space-l)`),
`--lr-navigation-menu-item-min-block-size` (default
`var(--lr-form-control-height-m, var(--lr-theme-form-control-height-m, var(--lr-size-2-5rem)))`,
never below `--lr-icon-button-size`), `--lr-navigation-menu-item-font-size` (default
`var(--lr-font-size-m)`), `--lr-navigation-menu-item-font-weight` (default
`var(--lr-font-weight-medium)`), `--lr-navigation-menu-item-hover-bg` (default
`var(--lr-color-brand-quiet)`), `--lr-navigation-menu-item-hover-color` (default
`var(--lr-color-brand)`), `--lr-navigation-menu-item-active-bg` (default a `color-mix()` of
`--lr-color-brand-quiet` toward `--lr-color-mix-partner`), `--lr-navigation-menu-item-open-bg`
(default `var(--lr-color-brand-quiet)`), `--lr-navigation-menu-item-active-color` (default
`var(--lr-color-text)`), `--lr-navigation-menu-item-current-color` (default
`var(--lr-color-brand)`), `--lr-navigation-menu-item-current-font-weight` (default
`var(--lr-font-weight-semibold)`), `--lr-navigation-menu-panel-padding` (default `var(--lr-space-s)`),
`--lr-navigation-menu-panel-max-inline-size` (default `var(--lr-size-48rem)`, also capped by the
space the viewport leaves), `--lr-navigation-menu-panel-indent` (default `var(--lr-space-l)`,
collapsed layout), `--lr-navigation-menu-show-duration` and `--lr-navigation-menu-hide-duration`
(default `var(--lr-duration-fast)`), `--lr-navigation-menu-switch-duration` (default
`var(--lr-duration-base)`), the shared floating-surface family `--lr-overlay-surface`,
`--lr-overlay-border` (panels take the subtle edge tier), `--lr-overlay-radius` and
`--lr-overlay-shadow-anchored`, and `--lr-positioning-strategy` (the floating panel is `fixed` by
default). All are inline fallbacks, so they can be set on the item, on the menu or on any ancestor.
The item does not take the `size` ladder.

```html
<script type="module">
  import '@aceshooting/lyra-ui/components/layout/navigation-menu-item/navigation-menu-item.js';
</script>

<lr-navigation-menu-item>
  Products
  <ul slot="panel">
    <li><a href="/analytics">Analytics</a></li>
  </ul>
</lr-navigation-menu-item>
<lr-navigation-menu-item href="https://example.com/" target="_blank" rel="external">Example</lr-navigation-menu-item>
```


- **`components-layout-menubar-contracts`** — Typed pass-through menu selection.
  Import: `@aceshooting/lyra-ui/components/layout/menubar/menubar.class.js`.
  `LyraMenubarEventMap { 'lr-select': CustomEvent<MenuItemSelectDetail>; }`
